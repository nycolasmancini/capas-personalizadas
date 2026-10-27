import { ChevronRight, MessageCircle, Search } from "lucide-react";
import Link from "next/link";
import { cn, Empty, formatDate, formatWhatsapp, inputCls, whatsappLink } from "@/components/ui";
import { daysAgo, isSuspicious, listMemberUsage } from "@/lib/data";

export const metadata = { title: "Cadastros e uso" };

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const all = (await listMemberUsage()).filter((r) => r.member.role === "lojista");
  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  const rows = term
    ? all.filter(
        ({ member: m, store: s }) =>
          [m.email, m.name, s?.name, s?.city].some((v) => v?.toLowerCase().includes(term)) ||
          (digits.length >= 4 && s?.phone?.includes(digits)),
      )
    : all;

  const weekAgo = daysAgo(7);
  const kpis = [
    { label: "Cadastros", n: all.length, tone: "bg-blue-soft" },
    { label: "Novos (7 dias)", n: all.filter((r) => r.member.createdAt.getTime() > weekAgo).length, tone: "bg-mint" },
    { label: "Artes (7 dias)", n: all.reduce((a, r) => a + r.last7, 0), tone: "bg-butter" },
    { label: "Para conferir", n: all.filter((r) => isSuspicious(r.total, r.sent)).length, tone: "bg-pink" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={cn("rounded-tile p-4", k.tone)}>
            <p className="text-sm font-semibold">{k.label}</p>
            <p className="font-display text-4xl">{k.n}</p>
          </div>
        ))}
      </div>

      <form className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input name="q" defaultValue={q} placeholder="Buscar por loja, cidade, e-mail ou WhatsApp" className={cn(inputCls, "pl-9")} />
      </form>

      <p className="text-sm text-muted">
        <strong className="text-ink">Artes</strong> conta cada vez que a pessoa tocou em “Concluir” no editor, inclusive edições.{" "}
        <strong className="text-ink">Para conferir</strong> = 10 ou mais artes e menos de 10% enviadas para produção.
      </p>

      {rows.length === 0 ? (
        <Empty title={term ? "Nenhum cadastro encontrado." : "Nenhum cadastro ainda."} />
      ) : (
        <div className="overflow-hidden rounded-tile bg-card">
          <div className="hidden grid-cols-[1.6fr_1.2fr_repeat(4,80px)_120px_24px] gap-3 border-b border-line px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted lg:grid">
            <span>Loja / pessoa</span>
            <span>WhatsApp</span>
            <span className="text-right">7 dias</span>
            <span className="text-right">30 dias</span>
            <span className="text-right">Total</span>
            <span className="text-right">Pedidos</span>
            <span>Última arte</span>
            <span />
          </div>
          {rows.map(({ member: m, store: s, total, last7, last30, sent, lastAt }) => {
            const wa = whatsappLink(s?.phone ?? null);
            const flagged = isSuspicious(total, sent);
            const blocked = !m.active || (s && !s.active);
            return (
              <div
                key={m.id}
                className={cn(
                  "relative grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-0 hover:bg-paper lg:grid-cols-[1.6fr_1.2fr_repeat(4,80px)_120px_24px]",
                  blocked && "opacity-60",
                )}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <Link href={`/painel/usuarios/${m.id}`} className="truncate after:absolute after:inset-0">
                      {s?.name ?? "Sem loja"}
                    </Link>
                    {flagged && <span className="rounded-full bg-pink px-2 text-xs font-semibold text-danger">Conferir</span>}
                    {blocked && <span className="rounded-full bg-ink px-2 text-xs font-semibold text-white">Bloqueado</span>}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {[m.name, s?.city].filter(Boolean).join(" · ")} · {m.email}
                  </p>
                </div>
                <div className="text-sm lg:order-none">
                  {wa ? (
                    <a href={wa} target="_blank" rel="noreferrer" className="relative z-10 inline-flex items-center gap-1.5 font-semibold text-blue hover:underline">
                      <MessageCircle size={15} /> {formatWhatsapp(s?.phone ?? null)}
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </div>
                <p className="col-span-2 text-sm text-muted lg:hidden">
                  <strong className="text-ink">{total}</strong> artes ({last7} na semana) · <strong className="text-ink">{sent}</strong> pedidos
                  {lastAt && <> · última {formatDate(lastAt)}</>}
                </p>
                <span className="hidden text-right tabular-nums lg:block">{last7}</span>
                <span className="hidden text-right tabular-nums lg:block">{last30}</span>
                <span className="hidden text-right font-semibold tabular-nums lg:block">{total}</span>
                <span className="hidden text-right tabular-nums lg:block">{sent}</span>
                <span className="hidden text-sm text-muted lg:block">{lastAt ? formatDate(lastAt) : "—"}</span>
                <ChevronRight size={16} className="hidden text-muted lg:block" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
