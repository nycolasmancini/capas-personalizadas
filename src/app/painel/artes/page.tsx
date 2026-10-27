import { Trash2 } from "lucide-react";
import { deleteArt, toggleArt } from "@/app/actions";
import { ArtUploader } from "@/components/ArtUploader";
import { cn, Empty } from "@/components/ui";
import { listArts } from "@/lib/data";

export const metadata = { title: "Artes prontas" };

export default async function Artes() {
  const arts = await listArts({ includeInactive: true });
  const cats = [...new Set(arts.map((a) => a.category))];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <h1 className="font-display text-3xl">Artes prontas</h1>
        <p className="mb-5 text-sm text-muted">
          Aparecem na aba “Artes” do editor. Categorias que começam com <strong>Fundo</strong> preenchem a capa inteira;
          as demais entram como enfeite que o lojista posiciona.
        </p>
        {arts.length === 0 && <Empty title="Nenhuma arte ainda." />}
        {cats.map((c) => (
          <section key={c} className="mb-6">
            <h2 className="mb-2 font-bold">{c}</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 xl:grid-cols-7">
              {arts
                .filter((a) => a.category === c)
                .map((a) => (
                  <div key={a.id} className={cn("rounded-tile bg-card p-2", !a.active && "opacity-50")}>
                    <div className="aspect-square overflow-hidden rounded-[12px] bg-[repeating-conic-gradient(#ece7de_0_25%,#fff_0_50%)] bg-[length:14px_14px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt={a.name} className="size-full object-cover" loading="lazy" />
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold">{a.name}</p>
                    <div className="flex items-center justify-between">
                      <form action={toggleArt.bind(null, a.id, !a.active)}>
                        <button className="text-[11px] font-semibold text-muted hover:text-ink">{a.active ? "Ocultar" : "Mostrar"}</button>
                      </form>
                      <form action={deleteArt.bind(null, a.id)}>
                        <button className="grid size-7 place-items-center rounded-ctl text-muted hover:text-danger" aria-label="Excluir">
                          <Trash2 size={13} />
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
      <aside>
        <ArtUploader categories={cats} />
      </aside>
    </div>
  );
}
