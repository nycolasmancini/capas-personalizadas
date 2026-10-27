import "server-only";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { addBusinessDays } from "./business";
import { db } from "./db";
import { orders, payments, pickupPoints, type Order, type Payment } from "./db/schema";
import { getMpPayment } from "./mercadopago";

/**
 * Pedido aprovado e pago (ou faturado): entra na fila da produção.
 * O prazo de retirada conta a partir de agora, em dias úteis da unidade.
 */
export async function startProduction(order: Order, paidAt: Date | null) {
  const now = new Date();
  const [point] = order.pickupPointId
    ? await db.select().from(pickupPoints).where(eq(pickupPoints.id, order.pickupPointId)).limit(1)
    : [];
  await db
    .update(orders)
    .set({
      status: "recebido",
      paidAt: order.paidAt ?? paidAt,
      sentAt: order.sentAt ?? now,
      dueAt: order.dueAt ?? (point ? addBusinessDays(now, point.leadDays) : null),
      needsReapproval: false,
      updatedAt: now,
    })
    .where(eq(orders.id, order.id));
  revalidateOrder(order.id);
}

export function revalidateOrder(id: string) {
  revalidatePath(`/loja/pedidos/${id}`);
  revalidatePath(`/painel/pedidos/${id}`);
  revalidatePath("/loja");
  revalidatePath("/painel");
}

/** Consulta o PIX no Mercado Pago e, se pago, libera o pedido. Usado pelo webhook e pela tela de pagamento. */
export async function syncPayment(p: Payment) {
  if (!p.mpPaymentId || p.status !== "pending") return p.status;
  const mp = await getMpPayment(p.mpPaymentId);
  let status: Payment["status"] = "pending";
  if (mp.status === "approved") status = "approved";
  else if (mp.status === "rejected") status = "rejected";
  // PIX vencido volta do Mercado Pago como "cancelled"
  else if (mp.status === "cancelled") status = p.expiresAt && p.expiresAt < new Date() ? "expired" : "cancelled";
  if (status === "pending") return status;

  const paidAt = mp.date_approved ? new Date(mp.date_approved) : new Date();
  await db
    .update(payments)
    .set({ status, paidAt: status === "approved" ? paidAt : null })
    .where(eq(payments.id, p.id));

  if (status === "approved") {
    const [order] = await db.select().from(orders).where(eq(orders.id, p.orderId)).limit(1);
    if (order && order.status === "aguardando_pagamento") await startProduction(order, paidAt);
    else if (order && !order.paidAt) {
      await db.update(orders).set({ paidAt, updatedAt: new Date() }).where(eq(orders.id, order.id));
      revalidateOrder(order.id);
    }
  }
  return status;
}

export async function latestPayment(orderId: string) {
  const [p] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return p ?? null;
}
