import { CopyButton } from "@/components/CopyButton";
import { OrderList } from "@/components/OrderList";
import { SimpleShell } from "@/components/SimpleShell";
import { cn, formatWhatsapp, whatsappLink } from "@/components/ui";
import { requireSeller } from "@/lib/auth";
import { getPickupPoint, listSellerOrders, listSellerStores } from "@/lib/data";

export const metadata = { title: "Minhas lojas" };

export default async function VendedorHome() {
  const s = await requireSeller();
  const [stores, rows, point] = await Promise.all([
    listSellerStores(s.seller.id),
    listSellerOrders(s.seller.id),
    getPickupPoint(s.seller.pickupPointId),
  ]);
  const open = rows.filter((r) => ["aguardando_pagamento", "recebido", "em_producao", "pronto"].includes(r.order.status));

  return (
    <SimpleShell href="/vendedor" title={s.seller.name} subtitle={point ? `Retirada em ${point.name}` : "Vendedor"}>
      <div className="space-y-8">
        <section className="rounded-tile bg-blue p-5 text-white">
          <p className="text-sm text-white/80">Seu link de cadastro</p>
          <p className="mt-1 break-all font-mono text-lg">/v/{s.seller.slug}</p>
          <p className="mt-2 text-sm text-white/80">
            Lojas que se cadastram por esse link ficam ligadas a você e retiram {point ? `em ${point.name}` : "na unidade que escolherem"}.
          </p>
          <CopyButton text={`/v/${s.seller.slug}`} label="Copiar link" className="mt-3 bg-white text-ink" />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">
            Pedidos em andamento <span className="text-muted">({open.length})</span>
          </h2>
          <OrderList rows={open} empty="Nenhum pedido em andamento." />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">
            Suas lojas <span className="text-muted">({stores.length})</span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {stores.map(({ store, networkName }) => (
              <div key={store.id} className={cn("rounded-tile bg-card p-3 text-sm", !store.active && "opacity-60")}>
                <p className="font-semibold">{store.name}</p>
                <p className="text-muted">
                  {[networkName && `Rede ${networkName}`, store.city].filter(Boolean).join(" · ") || "—"}
                </p>
                {store.phone && (
                  <a href={whatsappLink(store.phone) ?? "#"} target="_blank" rel="noreferrer" className="font-semibold text-blue">
                    {formatWhatsapp(store.phone)}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">Histórico</h2>
          <OrderList rows={rows.filter((r) => !open.includes(r))} empty="Nenhum pedido finalizado ainda." />
        </section>
      </div>
    </SimpleShell>
  );
}
