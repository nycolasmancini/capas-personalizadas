import { Store, Trash2, UserPlus } from "lucide-react";
import { addMember, createStore, removeMember, setStoreBilling, setStoreSeller, toggleStore } from "@/app/actions";
import { AutoSelect } from "@/components/AutoSelect";
import { Button, cn, Empty, Field, inputCls } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { listNetworks, listSellers, listStoresWithMembers } from "@/lib/data";

export const metadata = { title: "Lojas e acessos" };

export default async function Lojas() {
  const me = await requireAdmin();
  const [{ stores, members }, sellerRows, networkRows] = await Promise.all([listStoresWithMembers(), listSellers(), listNetworks()]);
  const admins = members.filter((m) => m.role === "admin");
  const smallCls = "h-9 rounded-ctl border-[1.5px] border-line bg-white px-2 text-sm font-semibold outline-none focus:border-blue";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <h1 className="font-display text-3xl">Lojas parceiras</h1>
        {stores.length === 0 && (
          <Empty title="Nenhuma loja cadastrada.">Cadastre a primeira loja ao lado e libere o e-mail Google do lojista.</Empty>
        )}
        {stores.map((s) => {
          const team = members.filter((m) => m.storeId === s.id && m.role === "lojista");
          return (
            <div key={s.id} className={cn("rounded-tile bg-card p-4", !s.active && "opacity-60")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{s.name}</p>
                  <p className="text-sm text-muted">{[s.city, s.phone].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <form action={toggleStore.bind(null, s.id, !s.active)}>
                  <Button variant={s.active ? "ghost" : "outline"} className="h-9 text-sm">
                    {s.active ? "Desativar loja" : "Reativar loja"}
                  </Button>
                </form>
              </div>
              {s.networkId ? (
                <p className="mt-2 text-sm text-muted">
                  Rede {networkRows.find((n) => n.network.id === s.networkId)?.network.name}: vendedor e pagamento da rede.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={setStoreSeller.bind(null, s.id)}>
                    <AutoSelect name="sellerId" defaultValue={s.sellerId ?? ""} className={smallCls} aria-label="Vendedor">
                      <option value="">Sem vendedor (escolhe a retirada)</option>
                      {sellerRows.map(({ seller: v, pickupName }) => (
                        <option key={v.id} value={v.id}>
                          Vendedor: {v.name}
                          {pickupName ? ` · ${pickupName}` : ""}
                        </option>
                      ))}
                    </AutoSelect>
                  </form>
                  <form action={setStoreBilling.bind(null, s.id)}>
                    <AutoSelect name="billing" defaultValue={s.billing} className={smallCls} aria-label="Pagamento">
                      <option value="pix">PIX a cada pedido</option>
                      <option value="faturado">Faturado (paga depois)</option>
                    </AutoSelect>
                  </form>
                </div>
              )}
              <ul className="mt-3 space-y-1">
                {team.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-ctl bg-paper px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">{m.name ?? "Ainda não entrou"}</span>{" "}
                      <span className="text-muted">{m.email}</span>
                    </span>
                    <form action={removeMember.bind(null, m.id)}>
                      <button className="grid size-8 place-items-center rounded-ctl text-muted hover:bg-sand hover:text-danger" aria-label="Remover acesso">
                        <Trash2 size={15} />
                      </button>
                    </form>
                  </li>
                ))}
                {team.length === 0 && <li className="text-sm text-muted">Nenhum acesso liberado ainda.</li>}
              </ul>
            </div>
          );
        })}

        <div className="rounded-tile bg-card p-4">
          <p className="mb-2 font-bold">Equipe de produção (administradores)</p>
          <ul className="space-y-1">
            {admins.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-ctl bg-paper px-3 py-2 text-sm">
                <span className="truncate">
                  <span className="font-semibold">{m.name ?? "—"}</span> <span className="text-muted">{m.email}</span>
                </span>
                {m.id !== me.member.id && (
                  <form action={removeMember.bind(null, m.id)}>
                    <button className="grid size-8 place-items-center rounded-ctl text-muted hover:bg-sand hover:text-danger" aria-label="Remover acesso">
                      <Trash2 size={15} />
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <aside className="space-y-4">
        <form action={addMember} className="space-y-3 rounded-tile bg-blue-soft p-4">
          <p className="flex items-center gap-2 font-bold">
            <UserPlus size={18} /> Liberar acesso
          </p>
          <Field label="E-mail Google" hint="A pessoa entra com esse e-mail no botão 'Entrar com Google'.">
            <input name="email" type="email" required className={inputCls} placeholder="lojista@gmail.com" />
          </Field>
          <Field label="Tipo de acesso">
            <select name="role" className={inputCls} defaultValue="lojista">
              <option value="lojista">Lojista (monta capas)</option>
              <option value="admin">Produção (painel completo)</option>
            </select>
          </Field>
          <Field label="Loja" hint="Obrigatório para lojistas.">
            <select name="storeId" className={inputCls} defaultValue="">
              <option value="">Selecione…</option>
              {stores
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <Button className="w-full">Liberar acesso</Button>
        </form>

        <form action={createStore} className="space-y-3 rounded-tile bg-card p-4">
          <p className="flex items-center gap-2 font-bold">
            <Store size={18} /> Nova loja
          </p>
          <Field label="Nome da loja">
            <input name="name" required className={inputCls} placeholder="Ex.: Cell Center Centro" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Cidade">
              <input name="city" className={inputCls} />
            </Field>
            <Field label="Telefone">
              <input name="phone" className={inputCls} />
            </Field>
          </div>
          <Button variant="dark" className="w-full">
            Cadastrar loja
          </Button>
        </form>
      </aside>
    </div>
  );
}
