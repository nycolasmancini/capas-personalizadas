"use client";

import { Download, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveDevice } from "@/app/actions";
import { cutLineSvg } from "@/lib/devices/geometry";
import type { DeviceGeometry, DeviceMockup, Hole, Lens } from "@/lib/devices/types";
import { DeviceSvg } from "./DeviceSvg";
import { Button, Field, inputCls } from "./ui";

type Initial = {
  id: string;
  brand: string;
  name: string;
  rank: number;
  active: boolean;
  verified: boolean;
  geometry: DeviceGeometry;
  mockup: DeviceMockup | null;
};

function Num({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-semibold text-muted">{label}</span>
      <input
        type="number"
        step="0.1"
        value={Number.isFinite(value) ? +value.toFixed(2) : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-9 w-full rounded-ctl border-[1.5px] border-line bg-white px-2 text-sm outline-none focus:border-blue"
      />
    </label>
  );
}

export function DeviceForm({ initial, isNew }: { initial: Initial; isNew: boolean }) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [g, setG] = useState<DeviceGeometry>(structuredClone(initial.geometry));
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const setHole = (i: number, p: Partial<Hole>) =>
    setG((x) => ({ ...x, holes: x.holes.map((h, j) => (j === i ? { ...h, ...p } : h)) }));
  const setLens = (i: number, p: Partial<Lens>) =>
    setG((x) => ({ ...x, lenses: x.lenses.map((l, j) => (j === i ? { ...l, ...p } : l)) }));

  function downloadTemplate() {
    const blob = new Blob([cutLineSvg(g, `${d.brand} ${d.name}`)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gabarito-${d.id || "novo"}.svg`;
    a.click();
  }

  function save() {
    setErr(null);
    setSaved(false);
    start(async () => {
      try {
        const res = await saveDevice({ ...d, isNew, geometry: g });
        setG((x) => ({ ...x, estimated: undefined }));
        setSaved(true);
        if (isNew) router.replace(`/painel/aparelhos/${res.id}`);
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="lg:sticky lg:top-32 lg:self-start">
        <div className="grid place-items-center rounded-tile bg-sand p-6">
          <DeviceSvg g={g} mockup={d.mockup} className="h-[460px] max-w-full" showPrintArea />
        </div>
        {g.estimated && (
          <p className="mt-2 rounded-ctl bg-butter/60 px-3 py-2 text-xs">
            Medidas estimadas a partir da foto. Confira largura, altura e recortes com o aparelho antes de liberar para as
            lojas — o arquivo de impressão sai nesse tamanho.
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          Azul: área impressa. Rosa tracejado: linha de corte. Imprima o gabarito em 100% (sem ajustar à página) e
          confira sobre uma capa física.
        </p>
        <Button variant="outline" className="mt-3 w-full" onClick={downloadTemplate}>
          <Download size={16} /> Baixar gabarito SVG (tamanho real)
        </Button>
      </div>

      <div className="space-y-5">
        <div className="grid gap-3 rounded-tile bg-card p-4 sm:grid-cols-2">
          <Field label="Marca">
            <input value={d.brand} onChange={(e) => setD({ ...d, brand: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Nome do modelo">
            <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className={inputCls} placeholder="Galaxy A56" />
          </Field>
          <Field label="Código (URL)" hint="Ex.: galaxy-a56. Não muda depois de criado.">
            <input
              value={d.id}
              disabled={!isNew}
              onChange={(e) => setD({ ...d, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
              className={inputCls}
            />
          </Field>
          <Field label="Ordem (menor aparece primeiro)">
            <input type="number" value={d.rank} onChange={(e) => setD({ ...d, rank: parseInt(e.target.value) || 0 })} className={inputCls} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} className="size-5 accent-blue" />
            Visível para as lojas
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={d.verified} onChange={(e) => setD({ ...d, verified: e.target.checked })} className="size-5 accent-blue" />
            Gabarito conferido com capa física
          </label>
        </div>

        <div className="rounded-tile bg-card p-4">
          <p className="mb-2 font-bold">Traseira (mm)</p>
          <div className="grid grid-cols-3 gap-2">
            <Num label="Largura" value={g.width} onChange={(v) => setG({ ...g, width: v })} />
            <Num label="Altura" value={g.height} onChange={(v) => setG({ ...g, height: v })} />
            <Num label="Raio do canto" value={g.radius} onChange={(v) => setG({ ...g, radius: v })} />
          </div>
        </div>

        <div className="rounded-tile bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold">Recortes da capa (câmeras)</p>
            <button
              onClick={() => setG({ ...g, holes: [...g.holes, { x: 6, y: 6, w: 20, h: 20, r: 5 }] })}
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue"
            >
              <Plus size={15} /> Recorte
            </button>
          </div>
          <p className="mb-3 text-xs text-muted">Posição do canto superior esquerdo, medida a partir do canto da traseira.</p>
          <div className="space-y-2">
            {g.holes.map((h, i) => (
              <div key={i} className="grid grid-cols-[repeat(5,1fr)_auto] items-end gap-2">
                <Num label="X" value={h.x} onChange={(v) => setHole(i, { x: v })} />
                <Num label="Y" value={h.y} onChange={(v) => setHole(i, { y: v })} />
                <Num label="Largura" value={h.w} onChange={(v) => setHole(i, { w: v })} />
                <Num label="Altura" value={h.h} onChange={(v) => setHole(i, { h: v })} />
                <Num label="Raio" value={h.r} onChange={(v) => setHole(i, { r: v })} />
                <button
                  onClick={() => setG({ ...g, holes: g.holes.filter((_, j) => j !== i) })}
                  className="grid size-9 place-items-center rounded-ctl text-muted hover:bg-sand hover:text-danger"
                  aria-label="Remover recorte"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-tile bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold">Lentes e flash (só visual)</p>
            <button
              onClick={() => setG({ ...g, lenses: [...g.lenses, { x: 12, y: 12, d: 9, kind: "lens" }] })}
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue"
            >
              <Plus size={15} /> Item
            </button>
          </div>
          <div className="space-y-2">
            {g.lenses.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1.3fr_auto] items-end gap-2">
                <Num label="Centro X" value={l.x} onChange={(v) => setLens(i, { x: v })} />
                <Num label="Centro Y" value={l.y} onChange={(v) => setLens(i, { y: v })} />
                <Num label="Diâmetro" value={l.d} onChange={(v) => setLens(i, { d: v })} />
                <label className="block">
                  <span className="mb-0.5 block text-[11px] font-semibold text-muted">Tipo</span>
                  <select
                    value={l.kind ?? "lens"}
                    onChange={(e) => setLens(i, { kind: e.target.value as Lens["kind"] })}
                    className="h-9 w-full rounded-ctl border-[1.5px] border-line bg-white px-1 text-sm"
                  >
                    <option value="lens">Lente</option>
                    <option value="flash">Flash</option>
                    <option value="sensor">Sensor</option>
                  </select>
                </label>
                <button
                  onClick={() => setG({ ...g, lenses: g.lenses.filter((_, j) => j !== i) })}
                  className="grid size-9 place-items-center rounded-ctl text-muted hover:bg-sand hover:text-danger"
                  aria-label="Remover"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {err && <p className="rounded-ctl bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="sticky bottom-3 flex items-center gap-3">
          <Button onClick={save} disabled={pending} className="h-12 flex-1 text-base shadow-lg">
            {pending ? "Salvando…" : "Salvar aparelho"}
          </Button>
          {saved && <span className="text-sm font-semibold text-blue">Salvo ✓</span>}
        </div>
      </div>
    </div>
  );
}
