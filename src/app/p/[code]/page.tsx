import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CameraNotice } from "@/components/CameraNotice";
import { Logo, whatsappLink } from "@/components/ui";
import { getOrderByCode } from "@/lib/data";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const found = await getOrderByCode(code);
  if (!found) return { title: "Prévia" };
  return {
    title: "Prévia da sua capa",
    openGraph: { images: [found.order.previewUrl], title: "Prévia da sua capa personalizada" },
    robots: { index: false },
  };
}

// Página pública que o lojista manda para o cliente final ver a prévia.
export default async function PreviaPublica({ params }: Props) {
  const { code } = await params;
  const found = await getOrderByCode(code);
  if (!found || found.order.status === "cancelado") notFound();
  const { order, storeName, storePhone } = found;
  const wa = whatsappLink(storePhone);
  const reply = `Oi! Vi a prévia da capa #${order.code}${order.customerName ? ` (${order.customerName})` : ""}. `;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <Logo sub={false} />
        {storeName && <span className="truncate text-sm font-semibold text-muted">{storeName}</span>}
      </header>
      <h1 className="font-display text-3xl leading-tight tracking-tight">
        {order.customerName ? `${order.customerName}, sua capa ficou assim` : "Sua capa ficou assim"}
        <span className="whitespace-nowrap">&nbsp;✨</span>
      </h1>
      <p className="mt-1 text-muted">{order.deviceName} · capa transparente anti-impacto</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={order.previewUrl}
        alt="Prévia da capa"
        className="mt-5 w-full rounded-tile shadow-[0_20px_50px_-24px_rgba(22,24,29,0.45)]"
      />

      <div className="mt-4 rounded-tile bg-card p-4">
        <p className="font-semibold">Gostou?</p>
        <p className="mt-1 text-sm text-muted">
          Responda para a loja aprovando ou pedindo ajustes. A capa só vai para produção depois da sua confirmação.
        </p>
        {wa && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={`${wa}?text=${encodeURIComponent(`${reply}Aprovo, pode produzir! ✅`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-ctl bg-success px-3 text-sm font-semibold text-white"
            >
              <MessageCircle size={16} /> Aprovar
            </a>
            <a
              href={`${wa}?text=${encodeURIComponent(`${reply}Queria ajustar uma coisa: `)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-ctl border-[1.5px] border-ink px-3 text-sm font-semibold"
            >
              Pedir ajuste
            </a>
          </div>
        )}
      </div>

      <CameraNotice className="mt-3" />
      <p className="mt-3 text-xs text-muted">
        Prévia ilustrativa: cores e posição podem variar levemente na impressão.
      </p>
      <p className="mt-auto pt-8 text-center text-xs text-muted">Pedido #{order.code}</p>
    </main>
  );
}
