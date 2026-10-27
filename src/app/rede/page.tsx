import Link from "next/link";
import { OrderList } from "@/components/OrderList";
import { SimpleShell } from "@/components/SimpleShell";
import { cn } from "@/components/ui";
import { requireNetworkManager } from "@/lib/auth";
import { listNetworkStores, listOrdersForStores } from "@/lib/data";

export const metadata = { title: "Pedidos da rede" };

export default async function RedeHome({ searchParams }: { searchParams: Promise<{ loja?: string }> }) {
  const s = await requireNetworkManager();
  const { loja } = await searchParams;
  const stores = await listNetworkStores(s.network.id);
  const ids = loja && stores.some((x) => x.id === loja) ? [loja] : stores.map((x) => x.id);
  const rows = await listOrdersForStores(ids, { includePreviews: true });
  const count = (id: string) => rows.filter((r) => r.order.storeId === id).length;

  return (
    <SimpleShell href="/rede" title={s.network.name} subtitle={`${stores.length} lojas`}>
      <h1 className="font-display text-3xl tracking-tight">Pedidos da rede {s.network.name}</h1>
      <div className="scrollbar-none my-4 flex gap-2 overflow-x-auto">
        <Link href="/rede" className={cn("h-9 shrink-0 rounded-full px-4 text-sm font-semibold leading-9", !loja ? "bg-ink text-white" : "bg-card")}>
          Todas
        </Link>
        {stores.map((x) => (
          <Link
            key={x.id}
            href={`/rede?loja=${x.id}`}
            className={cn("h-9 shrink-0 rounded-full px-4 text-sm font-semibold leading-9", loja === x.id ? "bg-ink text-white" : "bg-card")}
          >
            {x.name}
            {!loja && count(x.id) > 0 && <span className="ml-1.5 opacity-60">{count(x.id)}</span>}
          </Link>
        ))}
      </div>
      <OrderList rows={rows} empty="Nenhum pedido ainda." />
    </SimpleShell>
  );
}
