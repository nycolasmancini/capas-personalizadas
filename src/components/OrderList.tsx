import { cn, Empty, formatBRL, formatDate, formatDay, StatusBadge } from "./ui";
import type { Order } from "@/lib/db/schema";

export type OrderListRow = { order: Order; storeName: string | null; pickupName: string | null };

/** Lista só de leitura para vendedor e gestor de rede. */
export function OrderList({ rows, empty }: { rows: OrderListRow[]; empty: string }) {
  if (!rows.length) return <Empty title={empty} />;
  return (
    <div className="overflow-hidden rounded-tile bg-card">
      {rows.map(({ order: o, storeName, pickupName }) => (
        <div key={o.id} className="flex items-center gap-3 border-b border-line p-3 last:border-0">
          <a href={o.previewUrl} target="_blank" rel="noreferrer" className="size-16 shrink-0 overflow-hidden rounded-[12px] bg-blue-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.previewUrl} alt="" className="size-full object-cover" loading="lazy" />
          </a>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold">#{o.code}</span>
              <StatusBadge status={o.status} />
            </p>
            <p className="truncate text-sm font-semibold">
              {storeName ?? "—"} · {o.deviceName} · {o.quantity} un.
            </p>
            <p className="truncate text-xs text-muted">
              {formatDate(o.sentAt ?? o.updatedAt)}
              {o.totalCents ? ` · ${formatBRL(o.totalCents)}` : ""}
              {pickupName ? ` · retirada ${pickupName}` : ""}
              {o.dueAt && !["retirado", "cancelado"].includes(o.status) && (
                <span className={cn(new Date(o.dueAt) < new Date() && o.status !== "pronto" && "font-bold text-danger")}>
                  {` · até ${formatDay(o.dueAt)}`}
                </span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
