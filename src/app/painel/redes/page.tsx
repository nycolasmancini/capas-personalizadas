import { and, eq, inArray } from "drizzle-orm";
import { Network as NetworkIcon, Trash2 } from "lucide-react";
import { addNetworkManager, removeMember, saveNetwork } from "@/app/actions";
import { NetworkStoreForm, ResetPasswordForm } from "@/components/NetworkForms";
import { Button, Empty, Field, inputCls } from "@/components/ui";
import { db } from "@/lib/db";
import { members, type Network, type Seller } from "@/lib/db/schema";
import { listNetworks, listNetworkStores, listSellers } from "@/lib/data";

export const metadata = { title: "Redes" };

export default async function Redes() {
  const [rows, sellerRows] = await Promise.all([listNetworks(), listSellers()]);
  const sellers = sellerRows.map((r) => r.seller);
  const details = await Promise.all(
    rows.map(async ({ network: n }) => {
      const stores = await listNetworkStores(n.id);
      const logins = stores.length
        ? await db.select().from(members).where(inArray(members.storeId, stores.map((s) => s.id)))
        : [];
      const managers = await db
        .select()
        .from(members)
        .where(and(eq(members.role, "gestor"), eq(members.networkId, n.id)));
      return { stores, logins, managers };
    }),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-3xl">Redes de lojas</h1>
          <p className="text-muted">
            Para clientes com várias lojas (ex.: Beep). Cada loja entra com <strong>usuário e senha</strong> próprios, sem e-mail, e
            os pedidos ficam separados por loja. O gestor da rede entra com Google e acompanha todas.
          </p>
        </div>
        {rows.length === 0 && <Empty title="Nenhuma rede cadastrada." />}
        {rows.map(({ network: n, sellerName }, i) => {
          const { stores, logins, managers } = details[i];
          return (
            <div key={n.id} className="space-y-4 rounded-tile bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xl font-bold">{n.name}</p>
                  <p className="text-sm text-muted">
                    {sellerName ? `Vendedor: ${sellerName}` : "Sem vendedor"} ·{" "}
                    {n.billing === "faturado" ? "Faturado (paga depois)" : "PIX por pedido"} · {stores.length} loja
                    {stores.length === 1 ? "" : "s"}
                  </p>
                </div>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-blue">Editar rede</summary>
                  <NetworkForm network={n} sellers={sellers} />
                </details>
              </div>

              <ul className="space-y-1">
                {stores.map((s) => {
                  const login = logins.find((m) => m.storeId === s.id);
                  return (
                    <li key={s.id} className="rounded-ctl bg-paper px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          <span className="font-semibold">{s.name}</span>{" "}
                          <span className="text-muted">{s.city ?? ""}</span>
                        </span>
                        <span className="shrink-0 font-mono text-xs">{login?.email ?? "sem login"}</span>
                      </div>
                      {login?.clerkUserId && <ResetPasswordForm memberId={login.id} />}
                    </li>
                  );
                })}
              </ul>

              <details className="rounded-tile bg-blue-soft/50 p-3">
                <summary className="cursor-pointer text-sm font-bold">+ Adicionar loja à rede</summary>
                <div className="mt-3">
                  <NetworkStoreForm networkId={n.id} prefix={n.name.toLowerCase().replace(/[^a-z0-9]/g, "") || "loja"} />
                </div>
              </details>

              <div>
                <p className="mb-1 text-sm font-bold">Gestores (veem todas as lojas)</p>
                <ul className="space-y-1">
                  {managers.map((m) => (
                    <li key={m.id} className="flex items-center justify-between rounded-ctl bg-paper px-3 py-1.5 text-sm">
                      <span className="truncate">
                        {m.name ? <span className="font-semibold">{m.name} </span> : null}
                        <span className="text-muted">{m.email}</span>
                      </span>
                      <form action={removeMember.bind(null, m.id)}>
                        <button className="grid size-8 place-items-center rounded-ctl text-muted hover:bg-sand hover:text-danger" aria-label="Remover gestor">
                          <Trash2 size={15} />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
                <form action={addNetworkManager} className="mt-2 flex gap-2">
                  <input type="hidden" name="networkId" value={n.id} />
                  <input name="email" type="email" required placeholder="gestor@gmail.com" className={inputCls} />
                  <Button variant="dark" className="shrink-0">
                    Adicionar
                  </Button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <aside className="space-y-4">
        <div className="rounded-tile bg-blue-soft p-4">
          <p className="flex items-center gap-2 font-bold">
            <NetworkIcon size={18} /> Nova rede
          </p>
          <NetworkForm sellers={sellers} />
        </div>
        <div className="rounded-tile bg-butter p-4 text-sm">
          <p className="font-bold">Antes da primeira loja</p>
          <p className="mt-1">
            O login por usuário e senha precisa estar ligado no Clerk: <em>Dashboard → User &amp; authentication → Username</em>{" "}
            (ativar) e <em>Password</em> (ativar), deixando o e-mail como opcional.
          </p>
        </div>
      </aside>
    </div>
  );
}

function NetworkForm({ network, sellers }: { network?: Network; sellers: Seller[] }) {
  return (
    <form action={saveNetwork} className="mt-3 space-y-3">
      {network && <input type="hidden" name="id" value={network.id} />}
      <Field label="Nome da rede">
        <input name="name" defaultValue={network?.name} required className={inputCls} placeholder="Ex.: Beep" />
      </Field>
      <Field label="Vendedor" hint="Vale para todas as lojas da rede (unidade de retirada e prazo).">
        <select name="sellerId" defaultValue={network?.sellerId ?? ""} className={inputCls}>
          <option value="">Sem vendedor</option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Pagamento">
        <select name="billing" defaultValue={network?.billing ?? "faturado"} className={inputCls}>
          <option value="faturado">Faturado (paga depois)</option>
          <option value="pix">PIX a cada pedido</option>
        </select>
      </Field>
      <Button className="w-full">{network ? "Salvar" : "Criar rede"}</Button>
    </form>
  );
}
