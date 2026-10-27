"use server";

import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession, requireAdmin, requireSession, requireStoreUser } from "@/lib/auth";
import { storeTerms } from "@/lib/business";
import { db } from "@/lib/db";
import {
  artGenerations,
  arts,
  BILLING,
  devices,
  members,
  networks,
  orderRevisions,
  orders,
  ORDER_STATUSES,
  payments,
  pickupPoints,
  sellers,
  settings,
  stores,
} from "@/lib/db/schema";
import type { Design } from "@/lib/design";
import type { DeviceGeometry } from "@/lib/devices/types";
import { createPix, mpConfigured } from "@/lib/mercadopago";
import { latestPayment, revalidateOrder, startProduction, syncPayment } from "@/lib/order-flow";

/** Cookie gravado pelo link do vendedor (/v/slug) e lido no cadastro. */
const SELLER_COOKIE = "vendedor";

const code = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const blobUrl = z.string().url().startsWith("https://");

// ------------------------------------------------------------------ cadastro aberto

/** "(11) 98765-4321" → "5511987654321". Aceita com ou sem o 55 do Brasil. */
function normalizeWhatsapp(raw: string) {
  const digits = raw.replace(/\D/g, "");
  const full = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  if (!/^55\d{10,11}$/.test(full)) throw new Error("WhatsApp inválido. Use DDD + número, ex.: (11) 98765-4321");
  return full;
}

export type SignupState = { error?: string } | undefined;

export async function completeSignup(_: SignupState, formData: FormData): Promise<SignupState> {
  const s = await getSession();
  if (s === null) redirect("/entrar");
  if (s !== "new") redirect("/inicio");
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!user || !email) redirect("/entrar");

  const parsed = z
    .object({
      storeName: z.string().trim().min(2, "Informe o nome da loja").max(80),
      city: z.string().trim().min(2, "Informe a cidade").max(80),
      whatsapp: z.string().trim().min(1, "Informe o WhatsApp"),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let whatsapp: string;
  try {
    whatsapp = normalizeWhatsapp(parsed.data.whatsapp);
  } catch (e) {
    return { error: (e as Error).message };
  }

  // quem chegou pelo link de um vendedor já fica ligado a ele
  const slug = (await cookies()).get(SELLER_COOKIE)?.value;
  const [seller] = slug
    ? await db.select().from(sellers).where(and(eq(sellers.slug, slug), eq(sellers.active, true))).limit(1)
    : [];

  const storeId = crypto.randomUUID();
  await db.insert(stores).values({
    id: storeId,
    name: parsed.data.storeName,
    city: parsed.data.city,
    phone: whatsapp,
    sellerId: seller?.id ?? null,
  });
  await db
    .insert(members)
    .values({ id: crypto.randomUUID(), email, name: user.fullName, role: "lojista", storeId })
    .onConflictDoNothing({ target: members.email });
  revalidatePath("/painel/usuarios");
  redirect("/loja");
}

// ------------------------------------------------------------------ pedidos (lojista)

const saveOrderInput = z.object({
  orderId: z.string().optional(),
  deviceId: z.string(),
  phoneColor: z.string(),
  design: z.custom<Design>((v) => !!v && typeof v === "object" && Array.isArray((v as Design).elements)),
  customerName: z.string().max(80).optional(),
  notes: z.string().max(600).optional(),
  quantity: z.number().int().min(1).max(500),
  previewUrl: blobUrl,
  printUrl: blobUrl,
  whiteUrl: blobUrl,
  /** só no ajuste da produção */
  reason: z.string().max(200).optional(),
  reapproval: z.boolean().optional(),
});

export async function saveOrder(input: z.infer<typeof saveOrderInput>) {
  const s = await requireStoreUser();
  const data = saveOrderInput.parse(input);
  const [device] = await db.select().from(devices).where(eq(devices.id, data.deviceId)).limit(1);
  if (!device) throw new Error("Aparelho não encontrado");

  const values = {
    deviceId: device.id,
    deviceName: `${device.brand === "Apple" ? "" : device.brand + " "}${device.name}`,
    phoneColor: data.phoneColor,
    design: data.design,
    customerName: data.customerName?.trim() || null,
    notes: data.notes?.trim() || null,
    quantity: data.quantity,
    previewUrl: data.previewUrl,
    printUrl: data.printUrl,
    whiteUrl: data.whiteUrl,
    updatedAt: new Date(),
  };

  const logGeneration = (orderId: string, isEdit: boolean) =>
    db.insert(artGenerations).values({
      id: crypto.randomUUID(),
      memberId: s.member.id,
      email: s.email,
      storeId: s.store?.id ?? null,
      orderId,
      deviceName: values.deviceName,
      customerName: values.customerName,
      previewUrl: values.previewUrl,
      printUrl: values.printUrl,
      isEdit,
    });

  if (data.orderId) {
    const order = await getOwnOrder(data.orderId, s);
    if (s.member.role === "admin" && order.status !== "aguardando_cliente") {
      return saveProductionEdit(order, values, data.reason, data.reapproval ?? false, s.email);
    }
    if (order.status !== "aguardando_cliente") throw new Error("Este pedido já foi para produção");
    await db.update(orders).set(values).where(eq(orders.id, order.id));
    await logGeneration(order.id, true);
    revalidatePath(`/loja/pedidos/${order.id}`);
    return { id: order.id };
  }

  const id = crypto.randomUUID();
  await db.insert(orders).values({
    id,
    code: code(),
    storeId: s.store?.id ?? null,
    createdBy: s.email,
    status: "aguardando_cliente",
    ...values,
  });
  await logGeneration(id, false);
  revalidatePath("/loja");
  return { id };
}

/**
 * Ajuste da produção depois da aprovação: guarda a versão anterior (na primeira vez,
 * a original da loja) e a nova. Com "pedir nova aprovação", o pedido volta para a loja.
 */
async function saveProductionEdit(
  order: typeof orders.$inferSelect,
  values: Pick<typeof orders.$inferInsert, "design" | "previewUrl" | "printUrl" | "whiteUrl"> & Partial<typeof orders.$inferInsert>,
  reason: string | undefined,
  reapproval: boolean,
  editedBy: string,
) {
  if (order.status === "cancelado") throw new Error("Pedido cancelado");
  const [hasHistory] = await db.select({ id: orderRevisions.id }).from(orderRevisions).where(eq(orderRevisions.orderId, order.id)).limit(1);
  if (!hasHistory) {
    await db.insert(orderRevisions).values({
      id: crypto.randomUUID(),
      orderId: order.id,
      design: order.design,
      previewUrl: order.previewUrl,
      printUrl: order.printUrl,
      whiteUrl: order.whiteUrl,
      editedBy: order.createdBy,
      reason: "Versão aprovada pela loja",
      isOriginal: true,
      createdAt: order.sentAt ?? order.createdAt,
    });
  }
  await db.insert(orderRevisions).values({
    id: crypto.randomUUID(),
    orderId: order.id,
    design: values.design,
    previewUrl: values.previewUrl,
    printUrl: values.printUrl,
    whiteUrl: values.whiteUrl,
    editedBy,
    reason: reason?.trim() || null,
  });
  await db
    .update(orders)
    .set({
      ...values,
      ...(reapproval && order.status !== "aguardando_pagamento" ? { status: "aguardando_cliente" as const, needsReapproval: true } : {}),
    })
    .where(eq(orders.id, order.id));
  revalidateOrder(order.id);
  return { id: order.id };
}

/** Volta o pedido para uma versão anterior da arte (vira uma nova versão no histórico). */
export async function restoreRevision(revisionId: string) {
  const s = await requireAdmin();
  const [rev] = await db.select().from(orderRevisions).where(eq(orderRevisions.id, revisionId)).limit(1);
  if (!rev) throw new Error("Versão não encontrada");
  const [order] = await db.select().from(orders).where(eq(orders.id, rev.orderId)).limit(1);
  if (!order) throw new Error("Pedido não encontrado");
  await saveProductionEdit(
    order,
    { design: rev.design, previewUrl: rev.previewUrl, printUrl: rev.printUrl, whiteUrl: rev.whiteUrl, updatedAt: new Date() },
    `Voltou para a versão de ${rev.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    false,
    s.email,
  );
}

/**
 * A loja pagou o pedido errado: a produção troca a arte (e o aparelho) do pedido pago
 * pela de outro pedido da mesma loja. Fica no histórico de versões como qualquer ajuste.
 * O pedido de origem, se ainda não foi pago nem produzido, é cancelado para a loja não pagar duas vezes.
 */
export async function applyArtFromOrder(orderId: string, sourceOrderId: string) {
  const s = await requireAdmin();
  if (orderId === sourceOrderId) throw new Error("Escolha outro pedido");
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const [source] = await db.select().from(orders).where(eq(orders.id, sourceOrderId)).limit(1);
  if (!order || !source) throw new Error("Pedido não encontrado");
  if (order.status === "cancelado") throw new Error("Reative o pedido antes de trocar a arte");
  if ((order.storeId ?? order.createdBy) !== (source.storeId ?? source.createdBy)) throw new Error("Pedido de outra loja");

  await saveProductionEdit(
    order,
    {
      deviceId: source.deviceId,
      deviceName: source.deviceName,
      phoneColor: source.phoneColor,
      design: source.design,
      previewUrl: source.previewUrl,
      printUrl: source.printUrl,
      whiteUrl: source.whiteUrl,
      customerName: order.customerName ?? source.customerName,
      updatedAt: new Date(),
    },
    `Arte do pedido #${source.code}`,
    false,
    s.email,
  );

  const sourceCancelled = !source.paidAt && ["aguardando_cliente", "aguardando_pagamento"].includes(source.status);
  if (sourceCancelled) {
    await db
      .update(orders)
      .set({
        status: "cancelado",
        notes: [source.notes, `Arte aproveitada no pedido #${order.code} pela produção.`].filter(Boolean).join("\n"),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, source.id));
    revalidateOrder(source.id);
  }
  return { sourceCancelled };
}

/** Pedido pago que a loja cancelou por engano: volta para a fila da produção. */
export async function reactivateOrder(id: string) {
  await requireAdmin();
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order || order.status !== "cancelado") return;
  if (order.paidAt || order.billing === "faturado" || order.totalCents === 0) {
    await startProduction({ ...order, dueAt: null }, order.paidAt);
    return;
  }
  await db.update(orders).set({ status: "aguardando_pagamento", updatedAt: new Date() }).where(eq(orders.id, id));
  revalidateOrder(id);
}

async function getOwnOrder(id: string, s: Awaited<ReturnType<typeof requireSession>>) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) throw new Error("Pedido não encontrado");
  const isAdmin = s.member.role === "admin";
  if (!isAdmin && order.storeId !== s.store?.id) throw new Error("Pedido de outra loja");
  return order;
}

/**
 * Cliente aprovou. Grava a unidade de retirada e o preço da unidade.
 * Lojas faturadas (ou pedido já pago) vão direto para a produção; as demais pagam o PIX antes.
 */
export async function approveOrder(id: string, pickupPointId: string) {
  const s = await requireStoreUser();
  const order = await getOwnOrder(id, s);
  if (order.status !== "aguardando_cliente") return;
  const [store] = order.storeId ? await db.select().from(stores).where(eq(stores.id, order.storeId)).limit(1) : [];
  const terms = await storeTerms(store ?? null);
  // com vendedor, a unidade é a dele; sem vendedor, a loja escolhe
  const point = terms.pickup ?? terms.points.find((p) => p.id === pickupPointId);
  if (!point) throw new Error("Escolha onde vai retirar");

  // conta admin aprova para teste: sem cobrança, entra direto na produção
  const test = s.member.role === "admin" && !order.paidAt;
  const priced = {
    pickupPointId: point.id,
    billing: terms.billing,
    unitPriceCents: test ? 0 : order.paidAt ? order.unitPriceCents : point.priceCents,
    totalCents: test ? 0 : order.paidAt ? order.totalCents : point.priceCents * order.quantity,
    updatedAt: new Date(),
  };
  await db.update(orders).set(priced).where(eq(orders.id, id));
  const updated = { ...order, ...priced };

  if (test || terms.billing === "faturado" || order.paidAt) {
    await startProduction(updated, null);
    return;
  }
  await db.update(orders).set({ status: "aguardando_pagamento" }).where(eq(orders.id, id));
  revalidateOrder(id);
  if (!mpConfigured()) return;
  try {
    await createPayment(updated, s.email);
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const PIX_MINUTES = 30;

async function createPayment(order: typeof orders.$inferSelect, by: string) {
  if (!order.totalCents) throw new Error("Pedido sem valor");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const isPublic = !/^(localhost|127\.|192\.168\.)/.test(host);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + PIX_MINUTES * 60e3);
  const mp = await createPix({
    idempotencyKey: id,
    amountCents: order.totalCents,
    description: `Capa personalizada #${order.code} · ${order.quantity} un.`,
    orderId: order.id,
    payerEmail: by.includes("@") ? by : `pedido-${order.code.toLowerCase()}@capas.unilaser.com.br`,
    expiresAt,
    notificationUrl: isPublic ? `https://${host}/api/mercadopago/webhook` : undefined,
  });
  await db.insert(payments).values({
    id,
    orderId: order.id,
    mpPaymentId: String(mp.id),
    amountCents: order.totalCents,
    status: "pending",
    qrCode: mp.point_of_interaction?.transaction_data?.qr_code ?? null,
    qrCodeBase64: mp.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
    expiresAt,
    createdBy: by,
  });
  revalidateOrder(order.id);
}

/** Gera um PIX novo (o anterior venceu ou falhou). */
export async function newPix(id: string) {
  const s = await requireStoreUser();
  const order = await getOwnOrder(id, s);
  if (order.status !== "aguardando_pagamento") return;
  const last = await latestPayment(id);
  if (last?.status === "pending" && last.expiresAt && last.expiresAt > new Date()) return;
  try {
    await createPayment(order, s.email);
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** A tela de pagamento pergunta a cada poucos segundos se o PIX caiu. */
export async function checkPayment(id: string) {
  const s = await requireStoreUser();
  const order = await getOwnOrder(id, s);
  if (order.status !== "aguardando_pagamento") return { paid: !!order.paidAt, status: order.status, pix: null };
  const p = await latestPayment(id);
  const pix = p ? await syncPayment(p) : null;
  return { paid: pix === "approved", status: pix === "approved" ? "recebido" : order.status, pix };
}

/**
 * A produção confere no Mercado Pago se o PIX de um pedido já caiu (quando o aviso
 * automático não chegou). Se aprovado, o pedido entra na fila na hora.
 */
export async function syncOrderPayment(id: string) {
  await requireAdmin();
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return { error: "Pedido não encontrado." };
  if (order.status !== "aguardando_pagamento") return { pix: null, status: order.status };
  const p = await latestPayment(id);
  if (!p?.mpPaymentId) return { pix: null, status: order.status, error: "Este pedido ainda não gerou PIX." };
  try {
    const pix = await syncPayment(p);
    revalidateOrder(id);
    return { pix, status: pix === "approved" ? "recebido" : order.status };
  } catch (e) {
    return { pix: null, status: order.status, error: (e as Error).message };
  }
}

/** Pagamento recebido por fora (dinheiro, outro PIX): a produção libera o pedido. */
export async function markPaidManually(id: string) {
  const s = await requireAdmin();
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order || order.status !== "aguardando_pagamento") return;
  await db.insert(payments).values({
    id: crypto.randomUUID(),
    orderId: id,
    amountCents: order.totalCents ?? 0,
    status: "manual",
    paidAt: new Date(),
    createdBy: s.email,
  });
  await startProduction(order, new Date());
}

export async function cancelOrder(id: string) {
  const s = await requireStoreUser();
  const order = await getOwnOrder(id, s);
  const canCancel =
    s.member.role === "admin" || ["aguardando_cliente", "aguardando_pagamento", "recebido"].includes(order.status);
  if (!canCancel) throw new Error("O pedido já está em produção. Fale com a produção.");
  await db.update(orders).set({ status: "cancelado", updatedAt: new Date() }).where(eq(orders.id, id));
  revalidateOrder(id);
}

// ------------------------------------------------------------------ painel: pedidos

export async function setOrderStatus(id: string, status: (typeof ORDER_STATUSES)[number]) {
  await requireAdmin();
  z.enum(ORDER_STATUSES).parse(status);
  await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id));
  revalidateOrder(id);
}

// ------------------------------------------------------------------ painel: lojas e acessos

export async function createStore(formData: FormData) {
  await requireAdmin();
  const name = z.string().trim().min(2).max(80).parse(formData.get("name"));
  const city = z.string().trim().max(80).parse(formData.get("city") ?? "");
  const phone = z.string().trim().max(30).parse(formData.get("phone") ?? "");
  await db.insert(stores).values({ id: crypto.randomUUID(), name, city: city || null, phone: phone || null });
  revalidatePath("/painel/lojas");
}

export async function toggleStore(id: string, active: boolean) {
  await requireAdmin();
  await db.update(stores).set({ active }).where(eq(stores.id, id));
  revalidatePath("/painel/lojas");
}

export async function addMember(formData: FormData) {
  const s = await requireAdmin();
  const email = z.string().trim().toLowerCase().email("E-mail inválido").parse(formData.get("email"));
  const role = z.enum(["admin", "lojista"]).parse(formData.get("role") ?? "lojista");
  const storeId = role === "lojista" ? z.string().min(1).parse(formData.get("storeId")) : null;
  const [existing] = await db.select().from(members).where(eq(members.email, email)).limit(1);
  if (existing) {
    if (existing.id === s.member.id) return;
    await db.update(members).set({ role, storeId, active: true }).where(eq(members.id, existing.id));
  } else {
    await db.insert(members).values({ id: crypto.randomUUID(), email, role, storeId });
  }
  revalidatePath("/painel/lojas");
}

export async function toggleMember(id: string, active: boolean) {
  const s = await requireAdmin();
  if (id === s.member.id) throw new Error("Você não pode bloquear o próprio acesso");
  await db.update(members).set({ active }).where(eq(members.id, id));
  revalidatePath("/painel/usuarios");
  revalidatePath(`/painel/usuarios/${id}`);
  revalidatePath("/painel/lojas");
}

export async function removeMember(id: string) {
  const s = await requireAdmin();
  if (id === s.member.id) throw new Error("Você não pode remover o próprio acesso");
  const [m] = await db.delete(members).where(eq(members.id, id)).returning();
  // login por usuário e senha: apaga a conta no Clerk para liberar o nome de usuário
  if (m?.clerkUserId) await (await clerkClient()).users.deleteUser(m.clerkUserId).catch(() => {});
  revalidatePath("/painel/lojas");
  revalidatePath("/painel/redes");
}

export async function setStoreSeller(storeId: string, formData: FormData) {
  await requireAdmin();
  const sellerId = String(formData.get("sellerId") ?? "");
  await db.update(stores).set({ sellerId: sellerId || null }).where(eq(stores.id, storeId));
  revalidatePath("/painel/lojas");
  revalidatePath("/painel/vendedores");
}

export async function setStoreBilling(storeId: string, formData: FormData) {
  await requireAdmin();
  await db.update(stores).set({ billing: z.enum(BILLING).parse(formData.get("billing")) }).where(eq(stores.id, storeId));
  revalidatePath("/painel/lojas");
}

// ------------------------------------------------------------------ painel: unidades, preço e ajustes

/** "22,00" / "22.5" / "R$ 20" → centavos */
function parseMoney(raw: FormDataEntryValue | null) {
  const v = String(raw ?? "").replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Math.round(Number(v) * 100);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Preço inválido");
  return n;
}

export async function savePickupPoint(formData: FormData) {
  await requireAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  await db
    .update(pickupPoints)
    .set({
      name: z.string().trim().min(2).max(60).parse(formData.get("name")),
      address: z.string().trim().min(3).max(240).parse(formData.get("address")),
      hours: z.string().trim().max(120).parse(formData.get("hours") ?? "") || null,
      mapsUrl: z.string().trim().max(500).parse(formData.get("mapsUrl") ?? "") || null,
      leadDays: z.coerce.number().int().min(0).max(60).parse(formData.get("leadDays")),
      priceCents: parseMoney(formData.get("price")),
    })
    .where(eq(pickupPoints.id, id));
  revalidatePath("/painel/unidades");
}

export async function saveSetting(formData: FormData) {
  await requireAdmin();
  const value = z.string().trim().min(1).max(60).parse(formData.get("whiteSpotName"));
  await db
    .insert(settings)
    .values({ key: "whiteSpotName", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
  revalidatePath("/painel/unidades");
}

// ------------------------------------------------------------------ painel: vendedores

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Link: use só letras minúsculas, números e hífen (ex.: joao-sp)")
  .max(40);

export async function saveSeller(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "") || crypto.randomUUID();
  const isNew = !formData.get("id");
  const values = {
    name: z.string().trim().min(2).max(80).parse(formData.get("name")),
    slug: slugSchema.parse(formData.get("slug")),
    phone: z.string().trim().max(30).parse(formData.get("phone") ?? "") || null,
    pickupPointId: z.string().parse(formData.get("pickupPointId") ?? "") || null,
  };
  const [taken] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.slug, values.slug)).limit(1);
  if (taken && taken.id !== id) throw new Error("Já existe um vendedor com esse link");
  if (isNew) await db.insert(sellers).values({ id, ...values });
  else await db.update(sellers).set(values).where(eq(sellers.id, id));

  // login do vendedor (Google)
  const email = z.string().trim().toLowerCase().parse(formData.get("email") ?? "");
  if (email) {
    z.string().email("E-mail do vendedor inválido").parse(email);
    const [existing] = await db.select().from(members).where(eq(members.email, email)).limit(1);
    if (existing && existing.role === "admin") throw new Error("Esse e-mail é da produção");
    if (existing) {
      await db.update(members).set({ role: "vendedor", sellerId: id, storeId: null, active: true }).where(eq(members.id, existing.id));
    } else {
      await db.insert(members).values({ id: crypto.randomUUID(), email, name: values.name, role: "vendedor", sellerId: id });
    }
  }
  revalidatePath("/painel/vendedores");
}

export async function toggleSeller(id: string, active: boolean) {
  await requireAdmin();
  await db.update(sellers).set({ active }).where(eq(sellers.id, id));
  revalidatePath("/painel/vendedores");
}

// ------------------------------------------------------------------ painel: redes (ex.: Beep)

export async function saveNetwork(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const values = {
    name: z.string().trim().min(2).max(80).parse(formData.get("name")),
    sellerId: z.string().parse(formData.get("sellerId") ?? "") || null,
    billing: z.enum(BILLING).parse(formData.get("billing")),
  };
  if (id) await db.update(networks).set(values).where(eq(networks.id, id));
  else await db.insert(networks).values({ id: crypto.randomUUID(), ...values });
  revalidatePath("/painel/redes");
}

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{3,39}$/, "Usuário: 4 a 40 caracteres, letras minúsculas, números, ponto, hífen");
// 8 é o mínimo que o Clerk aceita (ajustado no painel do Clerk em Password settings).
const passwordSchema = z.string().min(8, "Senha com pelo menos 8 caracteres").max(72);

export type NetworkFormState = { error?: string; ok?: string } | undefined;

/** Loja de rede: cria a loja e um login com usuário e senha (sem e-mail) no Clerk. */
export async function addNetworkStore(_: NetworkFormState, formData: FormData): Promise<NetworkFormState> {
  await requireAdmin();
  try {
    const networkId = z.string().min(1).parse(formData.get("networkId"));
    const name = z.string().trim().min(2, "Informe o nome da loja").max(80).parse(formData.get("name"));
    const city = z.string().trim().max(80).parse(formData.get("city") ?? "");
    const username = usernameSchema.parse(formData.get("username"));
    const password = passwordSchema.parse(formData.get("password"));
    const [network] = await db.select().from(networks).where(eq(networks.id, networkId)).limit(1);
    if (!network) return { error: "Rede não encontrada" };
    const [taken] = await db.select({ id: members.id }).from(members).where(eq(members.email, username)).limit(1);
    if (taken) return { error: "Esse usuário já existe" };

    const user = await (await clerkClient()).users.createUser({ username, password, firstName: name.slice(0, 50) });
    const storeId = crypto.randomUUID();
    await db.insert(stores).values({ id: storeId, name, city: city || null, networkId, billing: network.billing });
    await db.insert(members).values({ id: crypto.randomUUID(), email: username, name, role: "lojista", storeId, clerkUserId: user.id });
    revalidatePath("/painel/redes");
    return { ok: `Loja criada. Login: ${username}` };
  } catch (e) {
    return { error: clerkMessage(e) };
  }
}

export async function resetStorePassword(_: NetworkFormState, formData: FormData): Promise<NetworkFormState> {
  await requireAdmin();
  try {
    const memberId = z.string().min(1).parse(formData.get("memberId"));
    const password = passwordSchema.parse(formData.get("password"));
    const [m] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
    if (!m?.clerkUserId) return { error: "Esse acesso não usa usuário e senha" };
    await (await clerkClient()).users.updateUser(m.clerkUserId, { password, signOutOfOtherSessions: true });
    return { ok: "Senha alterada" };
  } catch (e) {
    return { error: clerkMessage(e) };
  }
}

export async function addNetworkManager(formData: FormData) {
  await requireAdmin();
  const networkId = z.string().min(1).parse(formData.get("networkId"));
  const email = z.string().trim().toLowerCase().email("E-mail inválido").parse(formData.get("email"));
  const [existing] = await db.select().from(members).where(eq(members.email, email)).limit(1);
  if (existing?.role === "admin") throw new Error("Esse e-mail é da produção");
  if (existing) {
    await db.update(members).set({ role: "gestor", networkId, storeId: null, active: true }).where(eq(members.id, existing.id));
  } else {
    await db.insert(members).values({ id: crypto.randomUUID(), email, role: "gestor", networkId });
  }
  revalidatePath("/painel/redes");
}

function clerkMessage(e: unknown) {
  if (e instanceof z.ZodError) return e.issues[0].message;
  const errors = (e as { errors?: { code?: string; longMessage?: string; message?: string }[] }).errors;
  const first = errors?.[0];
  if (first?.code === "form_identifier_exists") return "Esse usuário já existe no login";
  if (first?.code === "form_password_pwned") return "Senha muito comum. Escolha outra.";
  if (first?.code === "form_password_length_too_short")
    return first.longMessage ?? "Senha muito curta para a regra do Clerk. Ajuste o mínimo no painel do Clerk.";
  if (first?.code === "form_param_unknown" || first?.code === "form_param_format_invalid")
    return "Login por usuário e senha ainda não está ativado no Clerk";
  return first?.longMessage ?? first?.message ?? (e as Error).message ?? "Erro ao criar o login";
}

// ------------------------------------------------------------------ painel: aparelhos

const holeSchema = z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive(), r: z.number().min(0) });
const lensSchema = z.object({ x: z.number(), y: z.number(), d: z.number().positive(), kind: z.enum(["lens", "flash", "sensor"]).optional() });
const geometrySchema = z.object({
  width: z.number().min(30).max(250),
  height: z.number().min(60).max(300),
  radius: z.number().min(0).max(40),
  holes: z.array(holeSchema).max(12),
  lenses: z.array(lensSchema).max(16),
});

export async function saveDevice(input: {
  id: string;
  isNew?: boolean;
  brand: string;
  name: string;
  rank: number;
  verified: boolean;
  active: boolean;
  geometry: DeviceGeometry;
}) {
  await requireAdmin();
  const geometry = geometrySchema.parse(input.geometry);
  const values = {
    brand: z.string().trim().min(1).parse(input.brand),
    name: z.string().trim().min(1).parse(input.name),
    rank: z.number().int().parse(input.rank),
    verified: input.verified,
    active: input.active,
    geometry,
    updatedAt: new Date(),
  };
  const id = z
    .string()
    .regex(/^[a-z0-9-]+$/, "Use só letras minúsculas, números e hífen")
    .parse(input.id);
  if (input.isNew) {
    await db.insert(devices).values({ id, ...values });
  } else {
    await db.update(devices).set(values).where(eq(devices.id, id));
  }
  revalidatePath("/painel/aparelhos");
  revalidatePath("/loja/nova");
  return { id };
}

export async function toggleDevice(id: string, active: boolean) {
  await requireAdmin();
  await db.update(devices).set({ active }).where(eq(devices.id, id));
  revalidatePath("/painel/aparelhos");
  revalidatePath("/loja/nova");
}

export async function setDevicesActive(ids: string[], active: boolean) {
  await requireAdmin();
  const list = z.array(z.string()).min(1).max(2000).parse(ids);
  await db.update(devices).set({ active }).where(inArray(devices.id, list));
  revalidatePath("/painel/aparelhos");
  revalidatePath("/loja/nova");
}

// ------------------------------------------------------------------ painel: artes

export async function createArt(input: { name: string; category: string; url: string; width: number; height: number }) {
  await requireAdmin();
  await db.insert(arts).values({
    id: crypto.randomUUID(),
    name: z.string().trim().min(1).max(60).parse(input.name),
    category: z.string().trim().min(1).max(40).parse(input.category),
    url: blobUrl.parse(input.url),
    width: Math.round(input.width),
    height: Math.round(input.height),
  });
  revalidatePath("/painel/artes");
}

export async function toggleArt(id: string, active: boolean) {
  await requireAdmin();
  await db.update(arts).set({ active }).where(eq(arts.id, id));
  revalidatePath("/painel/artes");
}

export async function deleteArt(id: string) {
  await requireAdmin();
  await db.delete(arts).where(and(eq(arts.id, id)));
  revalidatePath("/painel/artes");
}
