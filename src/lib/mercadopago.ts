import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// API de Pagamentos do Mercado Pago (PIX). Credenciais em variáveis de ambiente:
// MP_ACCESS_TOKEN (APP_USR-…) e MP_WEBHOOK_SECRET (assinatura secreta dos webhooks).

const API = "https://api.mercadopago.com/v1/payments";

type MpBankParty = {
  id?: string | number | null;
  long_name?: string | null;
  account_id?: string | number | null;
  account_holder_name?: string | null;
  identification?: { type?: string | null; number?: string | null } | null;
};

export type MpPayment = {
  id: number;
  status: "pending" | "approved" | "authorized" | "in_process" | "in_mediation" | "rejected" | "cancelled" | "refunded" | "charged_back";
  status_detail?: string | null;
  external_reference: string | null;
  transaction_amount: number;
  date_created?: string | null;
  date_approved: string | null;
  date_of_expiration: string | null;
  payer?: {
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    identification?: { type?: string | null; number?: string | null } | null;
  } | null;
  transaction_details?: { transaction_id?: string | null; net_received_amount?: number | null } | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      /** identificador end-to-end (E2E) da transferência PIX */
      transaction_id?: string | null;
      bank_info?: { payer?: MpBankParty | null; collector?: MpBankParty | null } | null;
    };
  };
};

/** Dados do comprovante de um PIX aprovado, no formato que as telas mostram. */
export type PixReceipt = {
  mpId: string;
  amountCents: number;
  approvedAt: string | null;
  payerName: string | null;
  /** CPF/CNPJ mascarado, ex.: ***.456.789-** */
  payerDoc: string | null;
  payerBank: string | null;
  collectorName: string | null;
  collectorBank: string | null;
  e2e: string | null;
};

function maskDoc(type: string | null | undefined, n: string | null | undefined) {
  const d = (n ?? "").replace(/\D/g, "");
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
  return d ? `${type ? type + " " : ""}…${d.slice(-4)}` : null;
}

function fullName(first?: string | null, last?: string | null) {
  const n = [first, last].filter(Boolean).join(" ").trim();
  return n || null;
}

/** Busca o pagamento no Mercado Pago e monta o comprovante. Devolve null se não deu para consultar. */
export async function getPixReceipt(mpPaymentId: string): Promise<PixReceipt | null> {
  if (!mpConfigured()) return null;
  try {
    const mp = await getMpPayment(mpPaymentId);
    const bank = mp.point_of_interaction?.transaction_data?.bank_info;
    const payerParty = bank?.payer;
    const collector = bank?.collector;
    return {
      mpId: String(mp.id),
      amountCents: Math.round((mp.transaction_amount ?? 0) * 100),
      approvedAt: mp.date_approved ?? null,
      payerName: fullName(mp.payer?.first_name, mp.payer?.last_name) ?? payerParty?.account_holder_name ?? null,
      payerDoc:
        maskDoc(mp.payer?.identification?.type, mp.payer?.identification?.number) ??
        maskDoc(payerParty?.identification?.type, payerParty?.identification?.number),
      payerBank: payerParty?.long_name ?? null,
      collectorName: collector?.account_holder_name ?? null,
      collectorBank: collector?.long_name ?? null,
      e2e: mp.point_of_interaction?.transaction_data?.transaction_id ?? mp.transaction_details?.transaction_id ?? null,
    };
  } catch (e) {
    console.error("mercadopago receipt", mpPaymentId, e);
    return null;
  }
}

export function mpConfigured() {
  return !!process.env.MP_ACCESS_TOKEN;
}

function token() {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error("Pagamento PIX ainda não configurado. Avise a produção.");
  return t;
}

/** Horário de Brasília no formato que o Mercado Pago aceita (…-03:00). */
function brasilia(d: Date) {
  return new Date(d.getTime() - 3 * 3600e3).toISOString().replace("Z", "-03:00");
}

export async function createPix(input: {
  idempotencyKey: string;
  amountCents: number;
  description: string;
  orderId: string;
  payerEmail: string;
  expiresAt: Date;
  notificationUrl?: string;
}) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: input.amountCents / 100,
      description: input.description,
      payment_method_id: "pix",
      external_reference: input.orderId,
      date_of_expiration: brasilia(input.expiresAt),
      payer: { email: input.payerEmail },
      ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
    }),
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok) {
    console.error("mercadopago create", res.status, body);
    throw new Error("O Mercado Pago não gerou o PIX. Tente de novo em instantes.");
  }
  return body as MpPayment;
}

export async function getMpPayment(id: string) {
  const res = await fetch(`${API}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Mercado Pago respondeu ${res.status}`);
  return (await res.json()) as MpPayment;
}

/**
 * Confere a assinatura do webhook (cabeçalho x-signature: "ts=…,v1=…").
 * Modelo assinado: "id:{data.id};request-id:{x-request-id};ts:{ts};"
 */
export function verifyWebhook(req: Request, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return false;
  const sig = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  let manifest = `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
