import { ArrowLeft, Download, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toggleMember } from "@/app/actions";
import { Button, cn, Empty, formatDate, formatWhatsapp, StatusBadge, whatsappLink } from "@/components/ui";
import { daysAgo, getMemberWithStore, isSuspicious, listMemberGenerations } from "@/lib/data";

export const metadata = { title: "Uso do cadastro" };

export default async function UsuarioDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getMemberWithStore(id);
  if (!row) notFound();
  const { member: m, store: s } = row;
  const gens = await listMemberGenerations(m.email);

  const weekAgo = daysAgo(7);
  const sentOrders = new Set(gens.filter((g) => g.status && g.status !== "aguardando_cliente" && g.status !== "cancelado").map((g) => g.gen.orderId));
  const total = gens.length;
  const wa = whatsappLink(s?.phone ?? null);
  const flagged = isSuspicious(total, sentOrders.size);

  return (
    <div className="space-y-6">
      <Link href="/painel/usuarios" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> Cadastros
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-tile bg-card p-5">
        <div className="min-w-0 space-y-1">
          <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl">
            {s?.name ?? "Sem loja"}
            {flagged && <span className="rounded-full bg-pink px-2.5 py-0.5 font-sans text-xs font-semibold text-danger">Conferir</span>}
            {!m.active && <span className="rounded-full bg-ink px-2.5 py-0.5 font-sans text-xs font-semibold text-white">Bloqueado</span>}
          </h1>
          <p className="text-muted">{[m.name, s?.city].filter(Boolean).join(" · ")}</p>
          <p className="text-sm">{m.email}</p>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue hover:underline">
              <MessageCircle size={15} /> {formatWhatsapp(s?.phone ?? null)}
            </a>
          )}
          <p className="text-xs text-muted">Cadastrado em {formatDate(m.createdAt)}</p>
        </div>
        {m.role === "lojista" && (
          <form action={toggleMember.bind(null, m.id, !m.active)}>
            <Button variant={m.active ? "danger" : "outline"} className="h-10 text-sm">
              {m.active ? "Bloquear acesso" : "Desbloquear"}
            </Button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Artes (7 dias)", n: gens.filter((g) => g.gen.createdAt.getTime() > weekAgo).length, tone: "bg-butter" },
          { label: "Artes no total", n: total, tone: "bg-blue-soft" },
          { label: "Enviados p/ produção", n: sentOrders.size, tone: "bg-mint" },
        ].map((k) => (
          <div key={k.label} className={cn("rounded-tile p-4", k.tone)}>
            <p className="text-sm font-semibold">{k.label}</p>
            <p className="font-display text-4xl">{k.n}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Artes geradas</h2>
        {gens.length === 0 ? (
          <Empty title="Nenhuma arte gerada ainda." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {gens.map(({ gen: g, code, status }) => (
              <div key={g.id} className="rounded-tile bg-card p-2">
                <a href={g.previewUrl} target="_blank" rel="noreferrer" className="block aspect-[4/5] overflow-hidden rounded-ctl bg-sand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.previewUrl} alt="" className="size-full object-cover" loading="lazy" />
                </a>
                <div className="space-y-1 px-1 pb-1 pt-2">
                  <p className="truncate text-sm font-semibold">{g.customerName || g.deviceName}</p>
                  <p className="truncate text-xs text-muted">
                    {g.customerName ? `${g.deviceName} · ` : ""}
                    {formatDate(g.createdAt)}
                    {g.isEdit && " · edição"}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    {status && g.orderId ? (
                      <Link href={`/painel/pedidos/${g.orderId}`} title={`Pedido #${code}`}>
                        <StatusBadge status={status} />
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">Pedido apagado</span>
                    )}
                    <a href={g.printUrl} target="_blank" rel="noreferrer" className="grid size-7 place-items-center rounded-ctl text-muted hover:bg-sand hover:text-ink" aria-label="Arquivo de impressão">
                      <Download size={14} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
