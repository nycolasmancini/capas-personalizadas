import { AlertTriangle, Search } from "lucide-react";
import Link from "next/link";
import { CheckPixButton } from "@/components/ProductionOrderTools";
import { StatusSelect } from "@/components/StatusSelect";
import { cn, Empty, formatBRL, formatDate, formatDay, inputCls, StatusBadge } from "@/components/ui";
import { listPickupPoints } from "@/lib/business";
import { countByStatus, latestPaymentsFor, listProductionOrders } from "@/lib/data";
import { ORDER_STATUSES, type OrderStatus, type Payment } from "@/lib/db/schema";

export const metadata = { title: "Pedidos" };

const FILTERS: { id: OrderStatus | "ativos"; label: string }[] = [
  { id: "ativos", label: "Em aberto" },
  { id: "aguardando_pagamento", label: "Pagamento pendente" },
  { id: "recebido", label: "Recebidos" },
  { id: "em_producao", label: "Em produção" },
  { id: "pronto", label: "Prontos" },
  { id: "retirado", label: "Retirados" },
  { id: "cancelado", label: "Cancelados" },
];

export default async function PainelPedidos({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; unidade?: string; q?: string }>;
}) {
  const { status: raw, unidade, q = "" } = await searchParams;
  const status = (ORDER_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as OrderStatus) : "ativos";
  const [all, counts, points] = await Promise.all([listProductionOrders(status, unidade), countByStatus(), listPickupPoints()]);
  // na aba de pagamento pendente, mostramos o PIX de cada pedido (gerado quando, venceu?)
  const pixByOrder =
    status === "aguardando_pagamento" ? await latestPaymentsFor(all.map(({ order }) => order.id)) : null;
  const term = q.trim().toLowerCase();
  const rows = term
    ? all.filter(({ order: o, storeName }) =>
        [o.code, storeName, o.customerName, o.deviceName, o.createdBy].some((v) => v?.toLowerCase().includes(term)),
      )
    : all;
  const href = (st: string, un?: string) => {
    const p = new URLSearchParams();
    if (st !== "ativos") p.set("status", st);
    if (un) p.set("unidade", un);
    if (term) p.set("q", q.trim());
    return p.size ? `/painel?${p}` : "/painel";
  };
  const today = new Date();
  const open = (counts.recebido ?? 0) + (counts.em_producao ?? 0) + (counts.pronto ?? 0);
  const awaitingPay = counts.aguardando_pagamento ?? 0;

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Novos", n: counts.recebido ?? 0, tone: "bg-blue-soft" },
          { label: "Em produção", n: counts.em_producao ?? 0, tone: "bg-peach" },
          { label: "Prontos", n: counts.pronto ?? 0, tone: "bg-mint" },
          { label: "Prévias nas lojas", n: counts.aguardando_cliente ?? 0, tone: "bg-butter" },
        ].map((k) => (
          <div key={k.label} className={cn("rounded-tile p-4", k.tone)}>
            <p className="text-sm font-semibold">{k.label}</p>
            <p className="font-display text-4xl">{k.n}</p>
          </div>
        ))}
      </div>

      {status === "ativos" && awaitingPay > 0 && (
        <Link
          href={href("aguardando_pagamento", unidade)}
          className="mb-4 flex items-center gap-3 rounded-tile bg-butter p-3 text-sm transition hover:bg-peach/70"
        >
          <AlertTriangle size={18} className="shrink-0" />
          <span>
            <strong>
              {awaitingPay} {awaitingPay === 1 ? "pedido aguardando pagamento" : "pedidos aguardando pagamento"}.
            </strong>{" "}
            Se a loja mandou comprovante e o pedido não apareceu aqui, confira o PIX nessa aba.
          </span>
        </Link>
      )}

      <form className="relative mb-4 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        {status !== "ativos" && <input type="hidden" name="status" value={status} />}
        {unidade && <input type="hidden" name="unidade" value={unidade} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por código, loja, cliente ou modelo"
          className={cn(inputCls, "pl-9")}
          aria-label="Buscar pedidos"
        />
      </form>

      <div className="scrollbar-none mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={href(f.id, unidade)}
            className={cn(
              "h-9 shrink-0 rounded-full px-4 text-sm font-semibold leading-9 transition",
              status === f.id ? "bg-ink text-white" : "bg-card hover:bg-sand",
            )}
          >
            {f.label}
            {f.id === "ativos" && open > 0 && <span className="ml-1.5 opacity-70">{open}</span>}
            {f.id === "aguardando_pagamento" && awaitingPay > 0 && (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 text-xs leading-5",
                  status === f.id ? "bg-white/20" : "bg-peach font-bold",
                )}
              >
                {awaitingPay}
              </span>
            )}
          </Link>
        ))}
      </div>

      {points.length > 1 && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="font-semibold text-muted">Retirada:</span>
          {[{ id: "", name: "Todas" }, ...points].map((p) => (
            <Link
              key={p.id}
              href={href(status, p.id || undefined)}
              className={cn(
                "h-8 rounded-full px-3 font-semibold leading-8",
                (unidade ?? "") === p.id ? "bg-blue text-white" : "bg-card hover:bg-sand",
              )}
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <Empty title={term ? `Nenhum pedido com “${q.trim()}”.` : "Nenhum pedido aqui."}>
          {term
            ? "Confira o código ou limpe a busca para ver todos."
            : status === "aguardando_pagamento"
              ? "Nenhum pedido esperando PIX. Quando uma loja enviar um pedido e ainda não pagar, ele fica aqui."
              : "Quando uma loja enviar um pedido, ele aparece nesta lista com aviso sonoro."}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-tile bg-card">
          {rows.map(({ order: o, storeName, pickupName }) => (
            <div key={o.id} className="flex items-center gap-4 border-b border-line p-3 last:border-0 sm:p-4">
              <Link href={`/painel/pedidos/${o.id}`} className="size-20 shrink-0 overflow-hidden rounded-[12px] bg-blue-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.previewUrl} alt="" className="size-full object-cover" loading="lazy" />
              </Link>
              <Link href={`/painel/pedidos/${o.id}`} className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold">#{o.code}</span>
                  <StatusBadge status={o.status} />
                  {o.status === "cancelado" && o.paidAt && (
                    <span className="rounded-full bg-peach px-2 py-0.5 text-xs font-semibold" title="Pedido pago que foi cancelado">
                      pago
                    </span>
                  )}
                </p>
                <p className="truncate font-semibold">
                  {o.deviceName} · {o.quantity} un.
                </p>
                <p className="truncate text-sm text-muted">
                  {storeName ?? "Sem loja"} {o.customerName ? `· ${o.customerName}` : ""} · {formatDate(o.sentAt ?? o.updatedAt)}
                </p>
                {pixByOrder && <PixLine pay={pixByOrder.get(o.id)} total={o.totalCents} now={today} />}
                {(pickupName || o.dueAt) && (
                  <p className="truncate text-sm">
                    {pickupName && <span className="font-semibold">{pickupName}</span>}
                    {o.dueAt && !["retirado", "cancelado"].includes(o.status) && (
                      <span className={cn(o.dueAt < today && o.status !== "pronto" && "font-bold text-danger")}>
                        {" "}
                        · entregar até {formatDay(o.dueAt)}
                      </span>
                    )}
                  </p>
                )}
              </Link>
              {pixByOrder ? (
                <CheckPixButton orderId={o.id} compact />
              ) : (
                <div className="hidden sm:block">
                  <StatusSelect id={o.id} status={o.status} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Situação do PIX na aba "Pagamento pendente": quando foi gerado, se venceu, valor. */
function PixLine({ pay, total, now }: { pay: Payment | undefined; total: number | null; now: Date }) {
  if (!pay) return <p className="text-sm text-danger">Pedido enviado sem PIX gerado ({formatBRL(total)}).</p>;
  const expired = pay.expiresAt ? pay.expiresAt < now : false;
  return (
    <p className={cn("text-sm", expired ? "text-muted" : "font-semibold")}>
      PIX de {formatBRL(pay.amountCents)} gerado {formatDate(pay.createdAt)}
      {pay.expiresAt && (expired ? ` · venceu ${formatDate(pay.expiresAt)}` : ` · vale até ${formatDate(pay.expiresAt)}`)}
      {pay.mpPaymentId && <span className="font-mono text-xs text-muted"> · MP {pay.mpPaymentId}</span>}
    </p>
  );
}
