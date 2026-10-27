import { and, asc, eq, gte, lt, ne } from "drizzle-orm";
import Link from "next/link";
import { cn, Empty, formatBRL, formatDate } from "@/components/ui";
import { db } from "@/lib/db";
import { networks, orders, stores } from "@/lib/db/schema";

export const metadata = { title: "A faturar" };

/** Pedidos faturados (ex.: Beep) de um mês, agrupados por rede e loja, para o fechamento. */
export default async function Faturamento({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const now = new Date();
  const [y, m] = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes!.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  // mês no fuso de Brasília (UTC-3)
  const from = new Date(Date.UTC(y, m - 1, 1, 3));
  const to = new Date(Date.UTC(y, m, 1, 3));
  const key = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}`;
  const prev = m === 1 ? key(y - 1, 12) : key(y, m - 1);
  const next = m === 12 ? key(y + 1, 1) : key(y, m + 1);

  const rows = await db
    .select({ order: orders, storeName: stores.name, networkName: networks.name })
    .from(orders)
    .leftJoin(stores, eq(orders.storeId, stores.id))
    .leftJoin(networks, eq(stores.networkId, networks.id))
    .where(and(eq(orders.billing, "faturado"), ne(orders.status, "cancelado"), gte(orders.sentAt, from), lt(orders.sentAt, to)))
    .orderBy(asc(networks.name), asc(stores.name), asc(orders.sentAt));

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = r.networkName ?? r.storeName ?? "Sem loja";
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const sum = (list: typeof rows) => list.reduce((a, r) => a + (r.order.totalCents ?? 0), 0);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">A faturar</h1>
          <p className="text-muted">Pedidos de lojas faturadas que entraram na produção no mês.</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Link href={`/painel/faturamento?mes=${prev}`} className="rounded-ctl bg-card px-3 py-2 hover:bg-sand">←</Link>
          <span className="min-w-36 text-center capitalize">{label}</span>
          <Link href={`/painel/faturamento?mes=${next}`} className="rounded-ctl bg-card px-3 py-2 hover:bg-sand">→</Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty title="Nenhum pedido faturado neste mês." />
      ) : (
        [...groups.entries()].map(([name, list]) => (
          <div key={name} className="overflow-hidden rounded-tile bg-card">
            <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
              <p className="text-lg font-bold">{name}</p>
              <p className="font-bold">
                {list.reduce((a, r) => a + r.order.quantity, 0)} capas · {formatBRL(sum(list))}
              </p>
            </div>
            {list.map(({ order: o, storeName }) => (
              <Link
                key={o.id}
                href={`/painel/pedidos/${o.id}`}
                className={cn("grid grid-cols-[80px_1fr_auto] gap-3 border-b border-line px-4 py-2 text-sm last:border-0 hover:bg-paper")}
              >
                <span className="font-mono font-bold">#{o.code}</span>
                <span className="truncate">
                  {storeName} · {o.deviceName} · {o.quantity} un. · <span className="text-muted">{formatDate(o.sentAt!)}</span>
                </span>
                <span className="font-semibold">{formatBRL(o.totalCents)}</span>
              </Link>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
