import { eq } from "drizzle-orm";
import { UserPlus } from "lucide-react";
import { saveSeller, toggleSeller } from "@/app/actions";
import { CopyButton } from "@/components/CopyButton";
import { Button, cn, Empty, Field, formatWhatsapp, inputCls } from "@/components/ui";
import { listPickupPoints } from "@/lib/business";
import { db } from "@/lib/db";
import { members, type PickupPoint, type Seller } from "@/lib/db/schema";
import { listSellers, listSellerStores } from "@/lib/data";

export const metadata = { title: "Vendedores" };

export default async function Vendedores() {
  const [rows, points, logins] = await Promise.all([
    listSellers(),
    listPickupPoints(),
    db.select({ email: members.email, sellerId: members.sellerId }).from(members).where(eq(members.role, "vendedor")),
  ]);
  const storesBySeller = await Promise.all(rows.map((r) => listSellerStores(r.seller.id)));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-3xl">Vendedores</h1>
          <p className="text-muted">
            Quem se cadastra pelo link do vendedor já fica ligado a ele, e o pedido mostra o endereço de retirada da unidade dele.
            Para ligar uma loja que já existe, use <strong>Lojas e acessos</strong>.
          </p>
        </div>
        {rows.length === 0 && <Empty title="Nenhum vendedor cadastrado.">Cadastre ao lado e envie o link para ele.</Empty>}
        {rows.map(({ seller: v, pickupName }, i) => {
          const linked = storesBySeller[i];
          const login = logins.find((l) => l.sellerId === v.id)?.email;
          return (
            <div key={v.id} className={cn("rounded-tile bg-card p-4", !v.active && "opacity-60")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold">{v.name}</p>
                  <p className="text-sm text-muted">
                    {pickupName ? `Retirada em ${pickupName}` : "Sem unidade (loja escolhe)"} · {formatWhatsapp(v.phone)}
                  </p>
                  <p className="text-sm text-muted">Login: {login ?? "sem acesso ao app"}</p>
                </div>
                <div className="flex gap-2">
                  <CopyButton text={`/v/${v.slug}`} label="Copiar link" />
                  <form action={toggleSeller.bind(null, v.id, !v.active)}>
                    <Button variant="ghost" className="h-9 text-sm">
                      {v.active ? "Desativar" : "Reativar"}
                    </Button>
                  </form>
                </div>
              </div>
              <p className="mt-2 truncate font-mono text-xs text-muted">/v/{v.slug}</p>
              <p className="mt-3 text-sm font-semibold">
                {linked.length} loja{linked.length === 1 ? "" : "s"}
                {linked.length > 0 && (
                  <span className="font-normal text-muted">
                    : {linked.map((l) => (l.networkName ? `${l.store.name} (${l.networkName})` : l.store.name)).join(", ")}
                  </span>
                )}
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-blue">Editar</summary>
                <SellerForm seller={v} login={login} points={points} />
              </details>
            </div>
          );
        })}
      </div>

      <aside>
        <div className="rounded-tile bg-blue-soft p-4">
          <p className="flex items-center gap-2 font-bold">
            <UserPlus size={18} /> Novo vendedor
          </p>
          <SellerForm points={points} />
        </div>
      </aside>
    </div>
  );
}

function SellerForm({ seller, login, points }: { seller?: Seller; login?: string; points: PickupPoint[] }) {
  return (
    <form action={saveSeller} className="mt-3 space-y-3">
      {seller && <input type="hidden" name="id" value={seller.id} />}
      <Field label="Nome">
        <input name="name" defaultValue={seller?.name} required className={inputCls} placeholder="Ex.: João" />
      </Field>
      <Field label="Link personalizado" hint="Vira /v/joao-sp. Letras minúsculas, números e hífen.">
        <input name="slug" defaultValue={seller?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputCls} placeholder="joao-sp" />
      </Field>
      <Field label="Unidade de retirada">
        <select name="pickupPointId" defaultValue={seller?.pickupPointId ?? points[0]?.id ?? ""} className={inputCls}>
          {points.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="">Nenhuma (a loja escolhe)</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="WhatsApp">
          <input name="phone" defaultValue={seller?.phone ?? ""} className={inputCls} />
        </Field>
        <Field label="E-mail Google" hint="Para ele ver as lojas e pedidos.">
          <input name="email" type="email" defaultValue={login ?? ""} className={inputCls} />
        </Field>
      </div>
      <Button className="w-full">{seller ? "Salvar" : "Cadastrar vendedor"}</Button>
    </form>
  );
}
