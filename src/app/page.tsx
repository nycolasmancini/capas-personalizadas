import { auth } from "@clerk/nextjs/server";
import { ArrowRight, Check, CreditCard, MapPin, Smartphone, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CaseShowcase, type ShowcaseArt } from "@/components/CaseShowcase";
import { ButtonLink, cn, focusRing, Logo, Tile } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { listDevices } from "@/lib/data";
import { DEVICE_CATALOG } from "@/lib/devices/catalog";
import type { DeviceGeometry, DeviceMockup } from "@/lib/devices/types";

export const metadata = { title: `${BRAND.name}. ${BRAND.product}` };

/** Artes de exemplo (as mesmas artes prontas que vêm com o app). */
const SAMPLES: ShowcaseArt[] = [
  { background: "/artes/fundo-estrelas.svg", text: { value: "Ana", font: "allura", size: 18, fill: "#ffffff", y: 0.7 } },
  {
    background: "/artes/fundo-degrade-por-do-sol.svg",
    text: { value: "M & J", font: "great-vibes", size: 14, fill: "#16181d", y: 0.66 },
  },
  {
    background: "/artes/fundo-vichy.svg",
    sticker: { url: "/artes/enfeite-coracao.svg", x: 0.5, y: 0.5, w: 0.5, rotate: -8 },
    text: { value: "Lu", font: "pacifico", size: 11, fill: "#ffffff", y: 0.8, stroke: "#1d3fb0" },
  },
];

type ShowcaseDevice = { id: string; name: string; geometry: DeviceGeometry; mockup: DeviceMockup | null };

/** Três aparelhos com foto (quando houver) para a vitrine da página inicial. */
async function showcaseDevices(): Promise<ShowcaseDevice[]> {
  const fallback = ["iphone-16", "galaxy-s24", "iphone-15"]
    .map((id) => DEVICE_CATALOG.find((d) => d.id === id) ?? DEVICE_CATALOG[0])
    .map((d) => ({ id: d.id, name: d.name, geometry: d.geometry, mockup: null }));
  try {
    const all = await listDevices();
    const withPhoto = all.filter((d) => d.mockup);
    const prefer = ["iphone-16", "iphone-15-pro", "galaxy-s24", "iphone-17", "iphone-14"];
    const picked: ShowcaseDevice[] = [];
    for (const id of prefer) {
      const d = withPhoto.find((x) => x.id === id);
      if (d && !picked.some((p) => p.id === d.id)) picked.push(d);
      if (picked.length === 3) break;
    }
    for (const d of withPhoto) {
      if (picked.length === 3) break;
      if (!picked.some((p) => p.id === d.id)) picked.push(d);
    }
    return picked.length === 3 ? picked : fallback;
  } catch {
    return fallback;
  }
}

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/inicio");
  const [main, second, third] = await showcaseDevices();

  const steps = [
    { icon: Smartphone, title: "Escolha o celular", text: "Dezenas de modelos com foto real, iPhone e Android." },
    { icon: Wand2, title: "Monte com as fotos", text: "Colagens, textos e artes prontas. Tudo pelo celular." },
    { icon: Sparkles, title: "Mostre a prévia", text: "O cliente aprova pelo WhatsApp antes de produzir." },
  ];
  const perks = [
    { icon: CreditCard, text: "Pague por PIX na hora ou fature no fim do mês" },
    { icon: MapPin, text: "Retire pronta na unidade em poucos dias úteis" },
    { icon: Check, text: "Arquivo de impressão UV gerado automaticamente" },
  ];

  return (
    <main className="min-h-dvh">
      <div className="bg-blue py-2 text-center text-[13px] font-medium text-white">
        Para lojistas de celular · cadastro grátis com sua conta Google
      </div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <ButtonLink href="/entrar" variant="dark" className="h-10">
          Entrar
        </ButtonLink>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-14 pt-4 lg:grid-cols-[1.05fr_1fr] lg:pt-10">
        <div>
          <h1 className="font-display text-[42px] leading-[0.98] tracking-tight sm:text-[64px]">
            Monte a capa.
            <br />
            <span className="relative inline-block -rotate-2 rounded-[14px] bg-blue px-3 pb-1 text-white">Mostre</span> ao
            cliente.
            <br />
            Mande produzir.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">
            Fotos, textos e colagens numa capa transparente anti-impacto, com prévia realista na hora e arquivo de
            impressão UV gerado automaticamente.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/entrar" className="h-12 px-5 text-base">
              Cadastrar com Google <ArrowRight size={18} />
            </ButtonLink>
            <span className="text-sm text-muted">Leva menos de um minuto.</span>
          </div>
          <ul className="mt-10 grid gap-3 sm:grid-cols-3">
            {perks.map((p) => (
              <li key={p.text} className="flex items-start gap-2.5 text-sm">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mint text-ink">
                  <p.icon size={14} />
                </span>
                <span className="leading-snug">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-[1.25fr_1fr] gap-3 sm:gap-4">
          <Tile tone="pink" className="relative row-span-2 grid place-items-center p-5 sm:p-8">
            <CaseShowcase device={main} art={SAMPLES[0]} className="max-h-[440px] drop-shadow-2xl" />
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow-md">
              <span className="grid size-4 place-items-center rounded-full bg-success text-white">
                <Check size={10} strokeWidth={3} />
              </span>
              Prévia pronta
            </span>
            <span className="absolute bottom-4 right-4 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white shadow-md">
              {main.name}
            </span>
          </Tile>
          <Tile tone="butter" className="grid place-items-center p-4 sm:p-5">
            <CaseShowcase device={second} art={SAMPLES[1]} className="max-h-[210px] drop-shadow-xl" color="#c3b6dc" />
          </Tile>
          <Tile tone="mint" className="grid place-items-center p-4 sm:p-5">
            <CaseShowcase device={third} art={SAMPLES[2]} className="max-h-[210px] drop-shadow-xl" color="#1f2023" />
          </Tile>
        </div>
      </section>

      <section className="border-t border-line bg-card/60">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <p className="text-sm font-bold uppercase tracking-wide text-muted">Como funciona</p>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-tile bg-card p-5 ring-1 ring-line">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-full bg-blue-soft text-blue">
                    <s.icon size={18} />
                  </span>
                  <span className="font-display text-2xl text-blue">{i + 1}</span>
                </div>
                <p className="mt-4 font-bold">{s.title}</p>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-tile bg-blue p-6 text-white">
            <div>
              <p className="font-display text-2xl">Comece agora, sem custo.</p>
              <p className="text-sm text-white/80">Você só paga a capa quando o cliente aprovar.</p>
            </div>
            <Link
              href="/entrar"
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-ctl bg-white px-4 text-[15px] font-semibold text-ink transition hover:bg-paper active:scale-[0.97]",
                focusRing,
              )}
            >
              Cadastrar com Google <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-6 text-center text-sm text-muted">
        {BRAND.name}. {BRAND.product}
      </footer>
    </main>
  );
}
