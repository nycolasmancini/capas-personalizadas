import { Receipt } from "lucide-react";
import type { Payment } from "@/lib/db/schema";
import { getPixReceipt } from "@/lib/mercadopago";
import { formatBRL } from "./ui";

/** "22/10/2026 18:59" (comprovante precisa do ano) */
function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(d));
}

/**
 * Comprovante do pagamento de um pedido: PIX aprovado (dados vindos do Mercado Pago)
 * ou recebimento por fora confirmado pela produção. Não mostra nada se não houve pagamento.
 */
export async function PaymentReceipt({ payment, code }: { payment: Payment | undefined; code: string }) {
  if (!payment) return null;
  if (payment.status === "manual")
    return (
      <Box>
        <Row k="Valor" v={formatBRL(payment.amountCents)} strong />
        <Row k="Forma" v="Recebido por fora (dinheiro ou outro PIX)" />
        <Row k="Confirmado em" v={payment.paidAt ? formatDate(payment.paidAt) : "—"} />
        <Row k="Confirmado por" v={payment.createdBy} />
        <Row k="Pedido" v={`#${code}`} />
      </Box>
    );
  if (payment.status !== "approved" || !payment.mpPaymentId) return null;

  const r = await getPixReceipt(payment.mpPaymentId);
  const paidAt = r?.approvedAt ?? payment.paidAt;
  return (
    <Box>
      <Row k="Valor" v={formatBRL(r?.amountCents ?? payment.amountCents)} strong />
      <Row k="Forma" v="PIX · Mercado Pago" />
      <Row k="Pago em" v={paidAt ? formatDate(paidAt) : "—"} />
      {r?.payerName && <Row k="Pagador" v={r.payerName} />}
      {r?.payerDoc && <Row k="CPF/CNPJ" v={r.payerDoc} />}
      {r?.payerBank && <Row k="Banco" v={r.payerBank} />}
      {(r?.collectorName || r?.collectorBank) && (
        <Row k="Recebedor" v={[r.collectorName, r.collectorBank].filter(Boolean).join(" · ")} />
      )}
      {r?.e2e && <Row k="ID E2E" v={r.e2e} mono />}
      <Row k="ID Mercado Pago" v={payment.mpPaymentId} mono />
      <Row k="Pedido" v={`#${code}`} />
      {!r && (
        <p className="col-span-2 pt-1 text-xs text-muted">
          Não deu para consultar os detalhes no Mercado Pago agora. Os dados acima são do nosso registro.
        </p>
      )}
    </Box>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-tile bg-mint/60 p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-bold">
        <Receipt size={16} /> Comprovante de pagamento
      </p>
      <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-sm">{children}</dl>
    </div>
  );
}

function Row({ k, v, strong, mono }: { k: string; v: string; strong?: boolean; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className={`min-w-0 break-all ${strong ? "font-bold" : ""} ${mono ? "font-mono text-xs leading-5" : ""}`}>{v}</dd>
    </>
  );
}
