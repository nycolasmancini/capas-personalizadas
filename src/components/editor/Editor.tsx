"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  BringToFront,
  Check,
  Copy,
  FlipHorizontal2,
  ImagePlus,
  Images,
  LayoutGrid,
  Loader2,
  PaintBucket,
  Redo2,
  RefreshCw,
  SendToBack,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { saveOrder } from "@/app/actions";
import { CAMERA_NOTICE } from "@/components/CameraNotice";
import { cn } from "@/components/ui";
import { dataUrlToBlob, prepareImage, uploadFile } from "@/lib/client-upload";
import { buildSlots, COLLAGES, type Collage } from "@/lib/collages";
import type { Art } from "@/lib/db/schema";
import {
  clampSlotOffset,
  coverScale,
  effectiveDpi,
  LOW_DPI,
  MAX_SLOT_ZOOM,
  uid,
  type Design,
  type DesignEl,
  type ImageEl,
  type SlotEl,
  type TextEl,
} from "@/lib/design";
import { PHONE_COLORS, phoneColorHex } from "@/lib/devices/catalog";
import type { Device } from "@/lib/devices/types";
import { CASE_FONTS, loadCaseFonts } from "@/lib/fonts";
import { composePreviewCard, hasInk, whiteLayerFromPrint } from "./exporter";
import { historyReducer, initHistory, type ChangeMode } from "./history";
import type { SceneApi } from "./Scene";

const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-muted">
      <Loader2 className="animate-spin" />
    </div>
  ),
});

type Tool = "fotos" | "colagem" | "texto" | "artes" | "fundo" | "aparelho";

const TOOLS: { id: Tool; label: string; icon: typeof Images }[] = [
  { id: "fotos", label: "Fotos", icon: Images },
  { id: "colagem", label: "Colagem", icon: LayoutGrid },
  { id: "texto", label: "Texto", icon: Type },
  { id: "artes", label: "Artes", icon: Sparkles },
  { id: "fundo", label: "Fundo", icon: PaintBucket },
  { id: "aparelho", label: "Celular", icon: Smartphone },
];

const SWATCHES = [
  "#16181d", "#ffffff", "#1d3fb0", "#e0245e", "#f6c9d6", "#f3e3a0", "#cfe6d5",
  "#ffd3b0", "#c9a227", "#8a8f98", "#6b4fbb", "#0f766e", "#b42318", "#7c4a2d",
];

type PhotoMode = "auto" | "free" | `slot:${string}` | `replace:${string}`;
type Prepared = { url: string; width: number; height: number };

export type EditorInitial = {
  orderId: string;
  design: Design;
  customerName: string | null;
  notes: string | null;
  quantity: number;
};

/** "loja": lojista montando a prévia. "producao": ajuste interno depois da aprovação. */
export type EditorMode = "loja" | "producao";

type FinishMeta = { customerName: string; notes: string; quantity: number; reason?: string; reapproval?: boolean };

function patch(d: Design, id: string, p: Partial<DesignEl>): Design {
  return { ...d, elements: d.elements.map((e) => (e.id === id ? ({ ...e, ...p } as DesignEl) : e)) };
}

function collageFor(n: number): Collage {
  const id = n <= 1 ? "uma" : n === 2 ? "duas-h" : n === 3 ? "tres" : n === 4 ? "quatro" : n <= 6 ? "seis" : "nove";
  return COLLAGES.find((c) => c.id === id)!;
}

function fillSlot(s: SlotEl, p: Prepared): SlotEl {
  return { ...s, src: p.url, natW: p.width, natH: p.height, ox: 0, oy: 0, zoom: 1, flipX: false };
}

export function Editor({
  device,
  arts,
  initial,
  backHref,
  mode = "loja",
}: {
  device: Device;
  arts: Art[];
  initial?: EditorInitial;
  backHref: string;
  mode?: EditorMode;
}) {
  const g = device.geometry;
  const router = useRouter();
  const [hist, dispatch] = useReducer(
    historyReducer,
    initial?.design ?? { version: 1, deviceId: device.id, phoneColor: "preto", background: null, elements: [] },
    initHistory,
  );
  const design = hist.present;
  const update = useCallback(
    (fn: (d: Design) => Design, mode: ChangeMode = "commit") => dispatch({ type: "change", fn, mode }),
    [],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool | null>(initial ? null : "fotos");
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const boxRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<SceneApi | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoMode = useRef<PhotoMode>("auto");
  const uploads = useRef(new Map<string, Promise<string>>());

  const selected = design.elements.find((e) => e.id === selectedId) ?? null;
  // com foto real do aparelho a cor do celular não muda nada: a aba some
  const tools = useMemo(() => (device.mockup ? TOOLS.filter((t) => t.id !== "aparelho") : TOOLS), [device.mockup]);

  useEffect(() => {
    loadCaseFonts().finally(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // atalhos de teclado no computador
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        update((d) => ({ ...d, elements: d.elements.filter((x) => x.id !== selectedId) }));
        setSelectedId(null);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, update]);

  // --------------------------------------------------------------- fotos

  function pickPhotos(mode: PhotoMode) {
    photoMode.current = mode;
    if (fileRef.current) {
      fileRef.current.multiple = mode === "auto" || mode === "free";
      fileRef.current.value = "";
      fileRef.current.click();
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const mode = photoMode.current;
    setBusy("Preparando fotos…");
    setError(null);
    try {
      const prepared = await Promise.all(
        [...files].slice(0, 12).map(async (f) => {
          const p = await prepareImage(f);
          const ext = p.blob.type === "image/png" ? "png" : "jpg";
          const job = uploadFile(`fotos/${uid()}.${ext}`, p.blob);
          job.catch(() => {});
          uploads.current.set(p.url, job);
          return { url: p.url, width: p.width, height: p.height };
        }),
      );
      update((d) => placePhotos(d, prepared, mode));
    } catch {
      setError("Não consegui abrir essa foto. Tente outra (JPG ou PNG).");
    } finally {
      setBusy(null);
    }
  }

  function placePhotos(d: Design, photos: Prepared[], mode: PhotoMode): Design {
    let els = [...d.elements];
    const queue = [...photos];

    if (mode.startsWith("replace:")) {
      const id = mode.slice(8);
      const p = queue.shift()!;
      els = els.map((e) => {
        if (e.id !== id) return e;
        if (e.type === "slot") return fillSlot(e, p);
        if (e.type === "photo") {
          const h = (e.w * p.height) / p.width;
          return { ...e, src: p.url, natW: p.width, natH: p.height, h };
        }
        return e;
      });
      return { ...d, elements: els };
    }

    if (mode.startsWith("slot:")) {
      const id = mode.slice(5);
      const p = queue.shift()!;
      els = els.map((e) => (e.id === id && e.type === "slot" ? fillSlot(e, p) : e));
    }

    if (mode === "auto" || mode.startsWith("slot:")) {
      if (mode === "auto" && !els.some((e) => e.type === "slot")) {
        const slots = buildSlots(collageFor(queue.length), g.width, g.height);
        const firstFree = els.findIndex((e) => e.type !== "art");
        els.splice(firstFree === -1 ? els.length : firstFree, 0, ...slots);
      }
      els = els.map((e) => (e.type === "slot" && !e.src && queue.length ? fillSlot(e, queue.shift()!) : e));
    }

    // o que sobrar vira foto solta
    queue.forEach((p, i) => {
      const w = g.width * 0.62;
      els.push({
        id: uid(),
        type: "photo",
        src: p.url,
        natW: p.width,
        natH: p.height,
        x: g.width / 2 + i * 4,
        y: g.height * 0.55 + i * 4,
        w,
        h: (w * p.height) / p.width,
        rotation: 0,
      });
    });
    return { ...d, elements: els };
  }

  // --------------------------------------------------------------- colagem, texto, artes

  function applyCollage(c: Collage) {
    update((d) => {
      const old = d.elements.filter((e): e is SlotEl => e.type === "slot" && !!e.src);
      const slots = buildSlots(c, g.width, g.height).map((s, i) =>
        old[i] ? { ...s, src: old[i].src, natW: old[i].natW, natH: old[i].natH, flipX: old[i].flipX } : s,
      );
      const rest = d.elements.filter((e) => e.type !== "slot");
      const bgArts = rest.filter((e) => e.type === "art" && isBackgroundArtEl(e));
      const others = rest.filter((e) => !bgArts.includes(e));
      // fotos que não couberam viram fotos soltas
      const leftovers: ImageEl[] = old.slice(slots.length).map((s, i) => {
        const w = g.width * 0.5;
        return {
          id: uid(), type: "photo", src: s.src!, natW: s.natW!, natH: s.natH!,
          x: g.width / 2 + i * 4, y: g.height / 2 + i * 4, w, h: (w * s.natH!) / s.natW!, rotation: 0, flipX: s.flipX,
        };
      });
      return { ...d, elements: [...bgArts, ...slots, ...others, ...leftovers] };
    });
    setSelectedId(null);
  }

  function addText(preset?: Partial<TextEl>) {
    const el: TextEl = {
      id: uid(),
      type: "text",
      text: "Seu nome",
      font: "allura",
      size: 14,
      fill: "#16181d",
      align: "center",
      x: g.width / 2,
      y: g.height * 0.62,
      w: g.width * 0.86,
      rotation: 0,
      ...preset,
    };
    update((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
    setTool("texto");
  }

  const bgArtIds = useMemo(
    () => new Set(arts.filter((a) => isBackgroundCategory(a.category)).map((a) => a.id)),
    [arts],
  );
  function isBackgroundArtEl(e: DesignEl) {
    return e.type === "art" && !!e.artId && bgArtIds.has(e.artId);
  }

  function addArt(a: Art) {
    const bg = isBackgroundCategory(a.category);
    let el: ImageEl;
    if (bg) {
      const k = coverScale(a.width, a.height, g.width, g.height);
      el = {
        id: uid(), type: "art", artId: a.id, src: a.url, natW: a.width, natH: a.height,
        x: g.width / 2, y: g.height / 2, w: a.width * k, h: a.height * k, rotation: 0,
      };
      update((d) => ({ ...d, elements: [el, ...d.elements.filter((e) => !isBackgroundArtEl(e))] }));
    } else {
      const w = g.width * 0.55;
      el = {
        id: uid(), type: "art", artId: a.id, src: a.url, natW: a.width, natH: a.height,
        x: g.width / 2, y: g.height * 0.6, w, h: (w * a.height) / a.width, rotation: 0,
      };
      update((d) => ({ ...d, elements: [...d.elements, el] }));
    }
    setSelectedId(el.id);
  }

  // --------------------------------------------------------------- ações do item selecionado

  function remove(id: string) {
    update((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== id) }));
    setSelectedId(null);
  }
  function duplicate(el: DesignEl) {
    const copy = { ...el, id: uid(), x: el.x + 5, y: el.y + 5 } as DesignEl;
    update((d) => ({ ...d, elements: [...d.elements, copy] }));
    setSelectedId(copy.id);
  }
  function move(id: string, dir: 1 | -1) {
    update((d) => {
      const i = d.elements.findIndex((e) => e.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.elements.length) return d;
      const els = [...d.elements];
      [els[i], els[j]] = [els[j], els[i]];
      return { ...d, elements: els };
    });
  }

  // --------------------------------------------------------------- finalizar

  const emptySlots = design.elements.filter((e) => e.type === "slot" && !e.src).length;
  const lowRes = design.elements.filter(
    (e) => (e.type === "photo" || (e.type === "slot" && e.src)) && effectiveDpi(e as ImageEl | SlotEl) < LOW_DPI,
  ).length;
  const isEmpty = design.elements.length === 0 && !design.background;

  async function generate(meta: FinishMeta) {
    setError(null);
    setSelectedId(null);
    setBusy("Montando a prévia…");
    try {
      setExporting(true);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const api = apiRef.current!;
      const printData = api.exportPrint();
      const mockData = api.exportMockup(1100);
      setExporting(false);

      if (!(await hasInk(printData))) throw new Error("A capa está vazia. Adicione uma foto, texto ou arte.");

      const title = meta.customerName ? `Capa da ${meta.customerName}` : "Sua capa personalizada";
      const [preview, white] = await Promise.all([
        composePreviewCard(mockData, title, `${device.name} · capa transparente anti-impacto`),
        whiteLayerFromPrint(printData),
      ]);
      const print = dataUrlToBlob(printData);

      setBusy("Enviando fotos…");
      const finalDesign: Design = {
        ...design,
        elements: await Promise.all(
          design.elements.map(async (e) => {
            if ((e.type === "photo" || e.type === "slot") && e.src?.startsWith("blob:")) {
              const job = uploads.current.get(e.src);
              if (!job) throw new Error("Uma das fotos se perdeu. Adicione-a de novo.");
              return { ...e, src: await job };
            }
            return e;
          }),
        ),
      };

      setBusy("Gerando arquivos de produção…");
      const folder = `pedidos/${new Date().toISOString().slice(0, 10)}/${uid()}`;
      const [previewUrl, printUrl, whiteUrl] = await Promise.all([
        uploadFile(`${folder}/previa.jpg`, preview),
        uploadFile(`${folder}/impressao-300dpi.png`, print),
        uploadFile(`${folder}/camada-branco.png`, white),
      ]);

      setBusy("Salvando…");
      const { id } = await saveOrder({
        orderId: initial?.orderId,
        deviceId: device.id,
        phoneColor: design.phoneColor,
        design: finalDesign,
        customerName: meta.customerName,
        notes: meta.notes,
        quantity: meta.quantity,
        previewUrl,
        printUrl,
        whiteUrl,
        reason: meta.reason,
        reapproval: meta.reapproval,
      });
      router.push(mode === "producao" ? `/painel/pedidos/${id}` : `/loja/pedidos/${id}`);
    } catch (e) {
      setExporting(false);
      setBusy(null);
      setError((e as Error).message || "Algo deu errado. Tente novamente.");
    }
  }

  // --------------------------------------------------------------- render

  const selectedDpi =
    selected && (selected.type === "photo" || (selected.type === "slot" && selected.src))
      ? effectiveDpi(selected as ImageEl | SlotEl)
      : Infinity;

  return (
    <div className="fixed inset-0 flex flex-col bg-paper">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />

      {/* topo */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-paper/90 px-2 backdrop-blur sm:px-4">
        <Link href={backHref} className="grid size-10 place-items-center rounded-ctl hover:bg-sand" aria-label="Voltar">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[15px] font-semibold">{device.name}</p>
          <p className="truncate text-xs text-muted">
            {mode === "producao" ? "Ajuste da produção" : "Capa transparente anti-impacto"}
          </p>
        </div>
        <button
          className="grid size-10 place-items-center rounded-ctl hover:bg-sand disabled:opacity-30"
          onClick={() => dispatch({ type: "undo" })}
          disabled={!hist.past.length}
          aria-label="Desfazer"
        >
          <Undo2 size={19} />
        </button>
        <button
          className="grid size-10 place-items-center rounded-ctl hover:bg-sand disabled:opacity-30"
          onClick={() => dispatch({ type: "redo" })}
          disabled={!hist.future.length}
          aria-label="Refazer"
        >
          <Redo2 size={19} />
        </button>
        <button
          onClick={() => {
            setSelectedId(null);
            setFinishing(true);
          }}
          disabled={isEmpty}
          className="ml-1 inline-flex h-10 items-center gap-1.5 rounded-ctl bg-blue px-4 text-[15px] font-semibold text-white transition active:scale-95 disabled:opacity-40"
        >
          <Check size={18} /> Concluir
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* canvas */}
        <div ref={boxRef} className="relative min-h-0 flex-1 overflow-hidden">
          {box.w > 0 && fontsReady && (
            <Scene
              apiRef={apiRef}
              g={g}
              mockup={device.mockup}
              phoneHex={phoneColorHex(design.phoneColor)}
              design={design}
              width={box.w}
              height={box.h}
              selectedId={selectedId}
              onSelect={setSelectedId}
              update={update}
              exporting={exporting}
              onEmptySlot={(id) => pickPhotos(`slot:${id}`)}
            />
          )}
          {isEmpty && !busy && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
              <p className="animate-pop rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-lg">
                Comece escolhendo as fotos do cliente
              </p>
            </div>
          )}
          {selectedDpi < LOW_DPI && (
            <div className="absolute inset-x-0 top-3 flex justify-center px-3">
              <p className="animate-pop inline-flex items-center gap-2 rounded-full bg-butter px-3 py-1.5 text-xs font-semibold shadow">
                <AlertTriangle size={14} /> Foto com pouca resolução: pode sair pixelada
              </p>
            </div>
          )}
        </div>

        {/* painel */}
        <aside className="flex shrink-0 flex-col border-t border-line bg-card lg:w-[400px] lg:border-l lg:border-t-0">
          {selected && (
            <ContextBar
              el={selected}
              onReplace={() => pickPhotos(`replace:${selected.id}`)}
              onFill={() => pickPhotos(`slot:${selected.id}`)}
              onRemove={() => remove(selected.id)}
              onDuplicate={() => duplicate(selected)}
              onFront={() => move(selected.id, 1)}
              onBack={() => move(selected.id, -1)}
              onFlip={() => update((d) => patch(d, selected.id, { flipX: !(selected as ImageEl | SlotEl).flipX }))}
              onEditText={() => setTool("texto")}
              onZoom={(z, mode) =>
                update((d) => {
                  const s = d.elements.find((e) => e.id === selected.id) as SlotEl;
                  return patch(d, s.id, { zoom: z, ...clampSlotOffset({ ...s, zoom: z }, s.ox, s.oy) });
                }, mode)
              }
              onClearSlot={() =>
                update((d) => patch(d, selected.id, { src: undefined, natW: undefined, natH: undefined, ox: 0, oy: 0, zoom: 1, flipX: false }))
              }
              onClose={() => setSelectedId(null)}
            />
          )}

          {tool && (
            <div className="max-h-[34dvh] overflow-y-auto overscroll-contain px-4 pb-3 pt-3 lg:max-h-none lg:flex-1">
              {tool === "fotos" && (
                <PhotosPanel
                  onPick={() => pickPhotos("auto")}
                  onPickFree={() => pickPhotos("free")}
                  photos={design.elements.filter((e) => (e.type === "slot" && e.src) || e.type === "photo") as (SlotEl | ImageEl)[]}
                  onSelect={setSelectedId}
                />
              )}
              {tool === "colagem" && <CollagePanel onApply={applyCollage} aspect={g.width / g.height} />}
              {tool === "texto" && (
                <TextPanel
                  el={selected?.type === "text" ? selected : null}
                  onAdd={addText}
                  update={update}
                />
              )}
              {tool === "artes" && <ArtsPanel arts={arts} onPick={addArt} />}
              {tool === "fundo" && (
                <BackgroundPanel
                  value={design.background}
                  onChange={(c) => update((d) => ({ ...d, background: c }))}
                />
              )}
              {tool === "aparelho" && !device.mockup && (
                <PhonePanel value={design.phoneColor} onChange={(c) => update((d) => ({ ...d, phoneColor: c }))} />
              )}
            </div>
          )}

          <nav
            className="grid shrink-0 border-t border-line pb-[env(safe-area-inset-bottom)] lg:order-first lg:border-b lg:border-t-0"
            style={{ gridTemplateColumns: `repeat(${tools.length}, minmax(0, 1fr))` }}
            aria-label="Ferramentas"
          >
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool((cur) => (cur === t.id ? null : t.id))}
                aria-pressed={tool === t.id}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition",
                  tool === t.id ? "text-blue" : "text-muted hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-12 place-items-center rounded-full transition",
                    tool === t.id && "bg-blue-soft",
                  )}
                >
                  <t.icon size={20} />
                </span>
                {t.label}
              </button>
            ))}
          </nav>
        </aside>
      </div>

      {finishing && !busy && (
        <FinishSheet
          mode={mode}
          initial={initial}
          emptySlots={emptySlots}
          lowRes={lowRes}
          error={error}
          onCancel={() => {
            setFinishing(false);
            setError(null);
          }}
          onConfirm={generate}
        />
      )}

      {error && !finishing && (
        <div className="fixed inset-x-3 bottom-24 z-40 flex justify-center">
          <p className="animate-pop flex items-center gap-2 rounded-tile bg-ink px-4 py-3 text-sm text-white shadow-xl">
            {error}
            <button onClick={() => setError(null)} aria-label="Fechar">
              <X size={16} />
            </button>
          </p>
        </div>
      )}

      {busy && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-paper/80 backdrop-blur-sm">
          <div className="animate-pop flex flex-col items-center gap-3 rounded-tile bg-card px-8 py-6 shadow-xl">
            <Loader2 className="animate-spin text-blue" size={28} />
            <p className="font-semibold">{busy}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function isBackgroundCategory(category: string) {
  return /^fundo/i.test(category.trim());
}

// ===================================================================== painéis

function PanelTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <p className="text-[15px] font-bold">{children}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Btn({
  onClick,
  icon: Icon,
  children,
  danger,
}: {
  onClick: () => void;
  icon: typeof Copy;
  children: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-14 min-w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-ctl px-2 text-[11px] font-semibold transition hover:bg-sand active:scale-95",
        danger ? "text-danger" : "text-ink",
      )}
    >
      <Icon size={19} />
      {children}
    </button>
  );
}

function ContextBar(p: {
  el: DesignEl;
  onReplace: () => void;
  onFill: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onFront: () => void;
  onBack: () => void;
  onFlip: () => void;
  onEditText: () => void;
  onZoom: (z: number, mode: ChangeMode) => void;
  onClearSlot: () => void;
  onClose: () => void;
}) {
  const { el } = p;
  const label = el.type === "slot" ? "Espaço de foto" : el.type === "text" ? "Texto" : el.type === "art" ? "Arte" : "Foto";
  return (
    <div className="animate-pop border-b border-line bg-blue-soft/40">
      <div className="flex items-center justify-between px-4 pt-2">
        <span className="text-xs font-bold uppercase tracking-wide text-blue-deep">{label}</span>
        <button onClick={p.onClose} className="grid size-7 place-items-center rounded-full hover:bg-white" aria-label="Fechar">
          <X size={15} />
        </button>
      </div>
      {el.type === "slot" && el.src && (
        <div className="flex items-center gap-3 px-4 pt-1">
          <span className="text-xs font-semibold text-muted">Zoom</span>
          <input
            type="range"
            min={1}
            max={MAX_SLOT_ZOOM}
            step={0.01}
            value={el.zoom}
            onPointerDown={() => p.onZoom(el.zoom, "begin")}
            onChange={(e) => p.onZoom(Number(e.target.value), "live")}
            onPointerUp={() => p.onZoom(el.zoom, "end")}
            className="flex-1 accent-blue"
          />
        </div>
      )}
      <div className="scrollbar-none flex gap-1 overflow-x-auto px-2 pb-1">
        {el.type === "slot" && !el.src && <Btn onClick={p.onFill} icon={ImagePlus}>Pôr foto</Btn>}
        {el.type === "slot" && el.src && <Btn onClick={p.onFill} icon={RefreshCw}>Trocar</Btn>}
        {el.type === "slot" && el.src && <Btn onClick={p.onClearSlot} icon={X}>Esvaziar</Btn>}
        {el.type === "photo" && <Btn onClick={p.onReplace} icon={RefreshCw}>Trocar</Btn>}
        {el.type === "text" && <Btn onClick={p.onEditText} icon={Type}>Editar</Btn>}
        {(el.type === "photo" || el.type === "art" || (el.type === "slot" && el.src)) && (
          <Btn onClick={p.onFlip} icon={FlipHorizontal2}>Espelhar</Btn>
        )}
        {el.type !== "slot" && <Btn onClick={p.onDuplicate} icon={Copy}>Duplicar</Btn>}
        <Btn onClick={p.onFront} icon={BringToFront}>Frente</Btn>
        <Btn onClick={p.onBack} icon={SendToBack}>Trás</Btn>
        <Btn onClick={p.onRemove} icon={Trash2} danger>Excluir</Btn>
      </div>
    </div>
  );
}

function PhotosPanel({
  onPick,
  onPickFree,
  photos,
  onSelect,
}: {
  onPick: () => void;
  onPickFree: () => void;
  photos: (SlotEl | ImageEl)[];
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <button
        onClick={onPick}
        className="flex w-full items-center gap-3 rounded-tile bg-blue px-4 py-4 text-left text-white transition active:scale-[0.98]"
      >
        <span className="grid size-11 place-items-center rounded-full bg-white/15">
          <ImagePlus size={22} />
        </span>
        <span>
          <span className="block font-bold">Escolher fotos</span>
          <span className="block text-xs text-white/80">Uma ou várias. Montamos a colagem sozinhos.</span>
        </span>
      </button>
      <button onClick={onPickFree} className="mt-2 w-full rounded-ctl px-2 py-2 text-left text-sm font-semibold text-blue hover:bg-blue-soft/50">
        + Adicionar foto solta (logo, recorte, PNG)
      </button>
      {photos.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold text-muted">Na capa ({photos.length}) — toque para ajustar</p>
          <div className="scrollbar-none flex gap-2 overflow-x-auto">
            {photos.map((p) => (
              <button key={p.id} onClick={() => onSelect(p.id)} className="size-16 shrink-0 overflow-hidden rounded-ctl bg-sand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        Dica: arraste a foto com um dedo e use dois dedos para aproximar e girar.
      </p>
    </div>
  );
}

function CollagePanel({ onApply, aspect }: { onApply: (c: Collage) => void; aspect: number }) {
  return (
    <div>
      <PanelTitle hint="As fotos já colocadas são mantidas.">Modelos de colagem</PanelTitle>
      <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-4">
        {COLLAGES.map((c) => (
          <button key={c.id} onClick={() => onApply(c)} className="group flex flex-col items-center gap-1">
            <svg viewBox={`0 0 ${aspect * 100} 100`} className="w-full rounded-[8px] bg-sand p-1 transition group-active:scale-95 group-hover:bg-blue-soft">
              {c.cells.map((cell, i) => {
                const W = aspect * 100;
                const x = cell.x * W + 1.5;
                const y = cell.y * 100 + 1.5;
                const w = cell.w * W - 3;
                const h = cell.h * 100 - 3;
                if (cell.shape === "circle") {
                  const r = Math.min(w, h) / 2;
                  return <circle key={i} cx={x + w / 2} cy={y + h / 2} r={r} className="fill-blue/70" />;
                }
                if (cell.shape === "heart") {
                  const s = Math.min(w, h);
                  const hx = x + (w - s) / 2;
                  const hy = y + (h - s) / 2;
                  return (
                    <path
                      key={i}
                      transform={`translate(${hx} ${hy}) scale(${s / 100})`}
                      d="M50 28C50 24 43 6 25 6 2 6 0 30 0 36 0 58 22 78 50 96 78 78 100 58 100 36 100 30 98 6 75 6 57 6 50 24 50 28Z"
                      className="fill-blue/70"
                    />
                  );
                }
                return <rect key={i} x={x} y={y} width={w} height={h} rx={2} className="fill-blue/70" />;
              })}
            </svg>
            <span className="text-[11px] font-semibold text-muted">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TextPanel({
  el,
  onAdd,
  update,
}: {
  el: TextEl | null;
  onAdd: (p?: Partial<TextEl>) => void;
  update: (fn: (d: Design) => Design, mode?: ChangeMode) => void;
}) {
  if (!el) {
    return (
      <div>
        <PanelTitle hint="Toque em um texto da capa para editar.">Textos</PanelTitle>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Nome", p: { text: "Maria", font: "allura", size: 18 } },
            { label: "Frase", p: { text: "Amor que não cabe\nno peito", font: "playfair", size: 7 } },
            { label: "Iniciais", p: { text: "M & J", font: "great-vibes", size: 16 } },
            { label: "Data", p: { text: "12.06.2026", font: "bebas", size: 8 } },
          ].map((x) => (
            <button
              key={x.label}
              onClick={() => onAdd(x.p as Partial<TextEl>)}
              className="rounded-tile bg-sand px-3 py-3 text-left transition hover:bg-blue-soft active:scale-[0.98]"
            >
              <span className="block text-xs font-semibold text-muted">{x.label}</span>
              <span className="block truncate text-lg" style={{ fontFamily: CASE_FONTS.find((f) => f.key === x.p.font)?.family }}>
                {x.p.text.split("\n")[0]}
              </span>
            </button>
          ))}
        </div>
        <button onClick={() => onAdd()} className="mt-2 h-11 w-full rounded-ctl border-[1.5px] border-ink font-semibold transition hover:bg-ink hover:text-white">
          + Texto em branco
        </button>
      </div>
    );
  }

  const set = (p: Partial<TextEl>, mode: ChangeMode = "commit") => update((d) => patch(d, el.id, p), mode);
  return (
    <div className="space-y-3">
      <textarea
        value={el.text}
        rows={2}
        onFocus={() => set({}, "begin")}
        onChange={(e) => set({ text: e.target.value }, "live")}
        onBlur={() => set({}, "end")}
        className="w-full resize-none rounded-ctl border-[1.5px] border-line bg-white px-3 py-2 text-[16px] outline-none focus:border-blue"
        placeholder="Digite o texto"
      />
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
        {CASE_FONTS.map((f) => (
          <button
            key={f.key}
            onClick={() => set({ font: f.key })}
            className={cn(
              "h-11 shrink-0 rounded-ctl border-[1.5px] px-3 text-lg transition",
              el.font === f.key ? "border-blue bg-blue-soft" : "border-line bg-white",
            )}
            style={{ fontFamily: f.family, fontWeight: f.weight }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ColorRow value={el.fill} onChange={(c) => set({ fill: c })} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">Contorno</span>
        <button
          onClick={() => set({ stroke: undefined })}
          className={cn("h-8 rounded-full border-[1.5px] px-3 text-xs font-semibold", !el.stroke ? "border-blue bg-blue-soft" : "border-line")}
        >
          Sem
        </button>
        {["#ffffff", "#16181d", "#1d3fb0", "#c9a227"].map((c) => (
          <button
            key={c}
            onClick={() => set({ stroke: c, strokeWidth: el.size * 0.08 })}
            className={cn("size-8 rounded-full border-[3px]", el.stroke === c ? "border-blue" : "border-line")}
            style={{ background: c }}
            aria-label={`Contorno ${c}`}
          />
        ))}
        <span className="ml-auto flex gap-1">
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              onClick={() => set({ align: a })}
              className={cn("h-8 rounded-ctl px-2.5 text-xs font-semibold", el.align === a ? "bg-ink text-white" : "bg-sand")}
            >
              {a === "left" ? "Esq." : a === "center" ? "Centro" : "Dir."}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}

function ColorRow({ value, onChange }: { value: string | null; onChange: (c: string) => void }) {
  return (
    <div className="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4">
      {SWATCHES.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={cn("size-9 shrink-0 rounded-full border-[3px] transition active:scale-90", value === c ? "border-blue" : "border-line")}
          style={{ background: c }}
          aria-label={`Cor ${c}`}
        />
      ))}
      <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-full border-[3px] border-line bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]">
        <input type="color" value={value ?? "#000000"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0" />
      </label>
    </div>
  );
}

function ArtsPanel({ arts, onPick }: { arts: Art[]; onPick: (a: Art) => void }) {
  const cats = useMemo(
    () =>
      [...new Set(arts.map((a) => a.category))].sort(
        (a, b) => Number(isBackgroundCategory(b)) - Number(isBackgroundCategory(a)) || a.localeCompare(b),
      ),
    [arts],
  );
  const [cat, setCat] = useState(cats[0] ?? "");
  if (!arts.length)
    return <p className="py-6 text-center text-sm text-muted">Nenhuma arte cadastrada ainda. O designer pode subir artes no painel.</p>;
  return (
    <div>
      <div className="scrollbar-none -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition",
              cat === c ? "bg-ink text-white" : "bg-sand text-ink",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-3">
        {arts
          .filter((a) => a.category === cat)
          .map((a) => (
            <button
              key={a.id}
              onClick={() => onPick(a)}
              className="aspect-square overflow-hidden rounded-ctl bg-[repeating-conic-gradient(#ece7de_0_25%,#fff_0_50%)] bg-[length:14px_14px] transition active:scale-95"
              title={a.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} className="size-full object-cover" loading="lazy" />
            </button>
          ))}
      </div>
    </div>
  );
}

function BackgroundPanel({ value, onChange }: { value: string | null; onChange: (c: string | null) => void }) {
  return (
    <div>
      <PanelTitle hint="Sem fundo, a capa fica cristal e mostra a cor do celular.">Fundo da capa</PanelTitle>
      <button
        onClick={() => onChange(null)}
        className={cn(
          "mb-3 h-10 rounded-full border-[1.5px] px-4 text-sm font-semibold",
          value === null ? "border-blue bg-blue-soft" : "border-line",
        )}
      >
        Transparente
      </button>
      <ColorRow value={value} onChange={onChange} />
    </div>
  );
}

function PhonePanel({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <PanelTitle hint="Só muda a prévia — mostra como a capa fica no celular do cliente.">Cor do celular do cliente</PanelTitle>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-4">
        {PHONE_COLORS.map((c) => (
          <button key={c.id} onClick={() => onChange(c.id)} className="flex flex-col items-center gap-1" aria-pressed={value === c.id}>
            <span
              className={cn("h-12 w-8 rounded-[8px] border-[3px] transition", value === c.id ? "border-blue" : "border-line")}
              style={{ background: c.hex }}
            />
            <span className="text-[11px] font-semibold text-muted">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FinishSheet({
  mode,
  initial,
  emptySlots,
  lowRes,
  error,
  onCancel,
  onConfirm,
}: {
  mode: EditorMode;
  initial?: EditorInitial;
  emptySlots: number;
  lowRes: number;
  error: string | null;
  onCancel: () => void;
  onConfirm: (m: FinishMeta) => void;
}) {
  const [customerName, setName] = useState(initial?.customerName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [quantity, setQty] = useState(initial?.quantity ?? 1);
  const [reason, setReason] = useState("");
  const [reapproval, setReapproval] = useState(false);
  const producao = mode === "producao";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal
        aria-labelledby="finish-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-pop max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-card p-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:rounded-tile"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p id="finish-title" className="font-display text-2xl">
              {producao ? "Salvar ajuste" : "Tudo pronto?"}
            </p>
            <p className="text-sm text-muted">
              {producao
                ? "Gera uma nova versão da arte e dos arquivos de impressão. A anterior fica guardada."
                : "Vamos gerar a prévia para você mostrar ao cliente."}
            </p>
          </div>
          <button onClick={onCancel} className="grid size-9 place-items-center rounded-full hover:bg-sand" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {(emptySlots > 0 || lowRes > 0) && (
          <div className="mb-4 space-y-1 rounded-ctl bg-butter/70 px-3 py-2 text-sm">
            {emptySlots > 0 && <p>• {emptySlots} espaço(s) de foto vazio(s) — ficarão transparentes.</p>}
            {lowRes > 0 && <p>• {lowRes} foto(s) com pouca resolução podem sair pixeladas.</p>}
          </div>
        )}
        <div className="space-y-3">
          {producao && (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">O que foi ajustado?</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={200}
                  className="h-11 w-full rounded-ctl border-[1.5px] border-line px-3 text-[16px] outline-none focus:border-blue"
                  placeholder="Ex.: cliente pediu o nome embaixo"
                />
              </label>
              <label className="flex items-start gap-3 rounded-ctl bg-sand/70 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={reapproval}
                  onChange={(e) => setReapproval(e.target.checked)}
                  className="mt-0.5 size-5 accent-blue"
                />
                <span className="text-sm">
                  <span className="block font-semibold">Pedir nova aprovação ao cliente</span>
                  <span className="block text-muted">
                    O pedido volta para a loja mostrar a prévia nova. O pagamento já feito continua valendo.
                  </span>
                </span>
              </label>
            </>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Nome do cliente (opcional)</span>
            <input
              value={customerName}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-ctl border-[1.5px] border-line px-3 text-[16px] outline-none focus:border-blue"
              placeholder="Ex.: Ana"
            />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Quantidade</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="size-10 rounded-ctl bg-sand text-lg font-bold">−</button>
              <span className="w-10 text-center text-lg font-bold">{quantity}</span>
              <button onClick={() => setQty((q) => Math.min(500, q + 1))} className="size-10 rounded-ctl bg-sand text-lg font-bold">+</button>
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Observações para a produção</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-ctl border-[1.5px] border-line px-3 py-2 text-[16px] outline-none focus:border-blue"
              placeholder="Ex.: cliente retira sexta"
            />
          </label>
        </div>
        {!producao && (
          <p className="mt-3 flex gap-2 rounded-ctl bg-blue-soft/60 px-3 py-2 text-xs text-ink">
            <Camera size={14} className="mt-0.5 shrink-0 text-blue" />
            <span>
              <strong>{CAMERA_NOTICE.title}:</strong> {CAMERA_NOTICE.short}
            </span>
          </p>
        )}
        {error && <p className="mt-3 rounded-ctl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <button
          onClick={() => onConfirm({ customerName, notes, quantity, reason, reapproval })}
          className="mt-5 h-12 w-full rounded-ctl bg-blue text-base font-bold text-white transition active:scale-[0.98]"
        >
          {producao ? "Salvar nova versão" : "Gerar prévia"}
        </button>
      </div>
    </div>
  );
}
