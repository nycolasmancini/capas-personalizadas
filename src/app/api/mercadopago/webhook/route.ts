import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { verifyWebhook } from "@/lib/mercadopago";
import { syncPayment } from "@/lib/order-flow";

// Aviso do Mercado Pago quando um pagamento muda. A assinatura é conferida e o
// status é sempre consultado de novo na API (o corpo do aviso não é confiável).
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
  const dataId = url.searchParams.get("data.id") ?? String(body.data?.id ?? "");
  const type = url.searchParams.get("type") ?? body.type;
  if (!dataId || type !== "payment") return new Response(null, { status: 200 });
  if (!verifyWebhook(req, dataId)) return new Response("assinatura inválida", { status: 401 });

  const [p] = await db.select().from(payments).where(eq(payments.mpPaymentId, dataId)).limit(1);
  if (!p) return new Response(null, { status: 200 });
  try {
    await syncPayment(p);
  } catch (e) {
    console.error("webhook mercadopago", e);
    return new Response("erro", { status: 500 });
  }
  return new Response(null, { status: 200 });
}
