"use client";

import type Konva from "konva";
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Circle, Group, Image as KImage, Layer, Rect, Shape, Stage, Text as KText, Transformer } from "react-konva";
import type { Context } from "konva/lib/Context";
import {
  CASE_CORNER_BUMP,
  CASE_RIM,
  PX_PER_MM_PRINT,
  caseOuter,
  mockupFrame,
  mockupUrl,
  printAreaPath,
  roundRect,
  type PathCtx,
  shade,
} from "@/lib/devices/geometry";
import type { DeviceGeometry, DeviceMockup } from "@/lib/devices/types";
import { clampSlotOffset, coverScale, MAX_SLOT_ZOOM, type Design, type DesignEl, type ImageEl, type SlotEl, type TextEl } from "@/lib/design";
import { caseFont } from "@/lib/fonts";
import type { ChangeMode } from "./history";
import { useImage } from "./useImage";

export type SceneApi = {
  exportPrint: () => string;
  exportMockup: (targetHeight: number) => string;
};

type Update = (fn: (d: Design) => Design, mode?: ChangeMode) => void;

type Props = {
  g: DeviceGeometry;
  mockup: DeviceMockup | null;
  phoneHex: string;
  design: Design;
  width: number;
  height: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  update: Update;
  exporting: boolean;
  onEmptySlot: (id: string) => void;
  apiRef: RefObject<SceneApi | null>;
};

function patchEl(d: Design, id: string, patch: Partial<DesignEl>): Design {
  return { ...d, elements: d.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as DesignEl) : e)) };
}

// ------------------------------------------------------------------ desenho do aparelho

function drawPhone(ctx: Context, g: DeviceGeometry, color: string) {
  const c = ctx._context;
  const o = caseOuter(g);

  // sombra projetada da capa
  c.save();
  c.shadowColor = "rgba(22,24,29,0.28)";
  c.shadowBlur = 28;
  c.shadowOffsetY = 14;
  c.beginPath();
  roundRect(c, o.x, o.y, o.w, o.h, o.r);
  c.fillStyle = shade(color, -0.1);
  c.fill();
  c.restore();

  // corpo do aparelho
  const body = c.createLinearGradient(0, 0, g.width, g.height);
  body.addColorStop(0, shade(color, 0.14));
  body.addColorStop(0.55, color);
  body.addColorStop(1, shade(color, -0.14));
  c.beginPath();
  roundRect(c, 0, 0, g.width, g.height, g.radius);
  c.fillStyle = body;
  c.fill();

  // borda metálica
  c.beginPath();
  roundRect(c, 0.25, 0.25, g.width - 0.5, g.height - 0.5, g.radius - 0.25);
  c.lineWidth = 0.5;
  c.strokeStyle = shade(color, 0.3);
  c.stroke();

  // módulos de câmera
  for (const h of g.holes) {
    const grad = c.createLinearGradient(h.x, h.y, h.x + h.w, h.y + h.h);
    grad.addColorStop(0, shade(color, 0.05));
    grad.addColorStop(1, shade(color, -0.25));
    c.beginPath();
    roundRect(c, h.x, h.y, h.w, h.h, h.r);
    c.fillStyle = grad;
    c.fill();
    c.lineWidth = 0.35;
    c.strokeStyle = shade(color, 0.35);
    c.stroke();
  }

  for (const l of g.lenses) {
    const r = l.d / 2;
    if (l.kind === "lens") {
      c.beginPath();
      c.arc(l.x, l.y, r, 0, Math.PI * 2);
      const ring = c.createLinearGradient(l.x - r, l.y - r, l.x + r, l.y + r);
      ring.addColorStop(0, "#5b5e66");
      ring.addColorStop(1, "#121316");
      c.fillStyle = ring;
      c.fill();
      c.beginPath();
      c.arc(l.x, l.y, r * 0.78, 0, Math.PI * 2);
      c.fillStyle = "#0c0d10";
      c.fill();
      c.beginPath();
      c.arc(l.x, l.y, r * 0.5, 0, Math.PI * 2);
      const glass = c.createRadialGradient(l.x - r * 0.15, l.y - r * 0.15, 0, l.x, l.y, r * 0.5);
      glass.addColorStop(0, "#3d4f7a");
      glass.addColorStop(0.6, "#151a2b");
      glass.addColorStop(1, "#08090c");
      c.fillStyle = glass;
      c.fill();
      c.beginPath();
      c.arc(l.x - r * 0.22, l.y - r * 0.22, r * 0.12, 0, Math.PI * 2);
      c.fillStyle = "rgba(255,255,255,0.55)";
      c.fill();
    } else {
      c.beginPath();
      c.arc(l.x, l.y, r, 0, Math.PI * 2);
      if (l.kind === "flash") {
        const f = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
        f.addColorStop(0, "#fffaf0");
        f.addColorStop(1, "#d9cfb4");
        c.fillStyle = f;
      } else {
        c.fillStyle = "#1c1d21";
      }
      c.fill();
    }
  }
}

/** Capa transparente anti-impacto desenhada por cima da arte */
function drawCase(ctx: Context, g: DeviceGeometry) {
  const c = ctx._context;
  const o = caseOuter(g);

  // aro da capa (entre a borda externa e o aparelho)
  c.beginPath();
  roundRect(c, o.x, o.y, o.w, o.h, o.r);
  roundRect(c, 0, 0, g.width, g.height, g.radius, true);
  c.fillStyle = "rgba(238,242,246,0.42)";
  c.fill();

  // reforço dos cantos (anti-impacto)
  const k = g.radius + CASE_RIM;
  const corners: [number, number, number][] = [
    [o.x + k, o.y + k, Math.PI],
    [o.x + o.w - k, o.y + k, Math.PI * 1.5],
    [o.x + o.w - k, o.y + o.h - k, 0],
    [o.x + k, o.y + o.h - k, Math.PI * 0.5],
  ];
  for (const [cx, cy, start] of corners) {
    c.beginPath();
    c.arc(cx, cy, k + CASE_CORNER_BUMP * 0.35, start - 0.12, start + Math.PI / 2 + 0.12);
    c.lineWidth = CASE_CORNER_BUMP * 1.6;
    c.lineCap = "round";
    c.strokeStyle = "rgba(255,255,255,0.55)";
    c.stroke();
  }

  // contorno externo
  c.beginPath();
  roundRect(c, o.x, o.y, o.w, o.h, o.r);
  c.lineWidth = 0.45;
  c.strokeStyle = "rgba(255,255,255,0.95)";
  c.stroke();
  c.beginPath();
  roundRect(c, o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1, o.r - 0.5);
  c.lineWidth = 0.18;
  c.strokeStyle = "rgba(0,0,0,0.16)";
  c.stroke();

  // borda dos recortes de câmera
  for (const h of g.holes) {
    c.beginPath();
    roundRect(c, h.x - 0.35, h.y - 0.35, h.w + 0.7, h.h + 0.7, h.r + 0.35);
    c.lineWidth = 0.7;
    c.strokeStyle = "rgba(255,255,255,0.6)";
    c.stroke();
  }

  // brilho do acrílico
  c.save();
  c.beginPath();
  roundRect(c, o.x, o.y, o.w, o.h, o.r);
  c.clip();
  const gloss = c.createLinearGradient(o.x, o.y, o.x + o.w * 0.9, o.y + o.h * 0.55);
  gloss.addColorStop(0, "rgba(255,255,255,0.28)");
  gloss.addColorStop(0.32, "rgba(255,255,255,0.06)");
  gloss.addColorStop(0.33, "rgba(255,255,255,0)");
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = gloss;
  c.fillRect(o.x, o.y, o.w, o.h);
  const band = c.createLinearGradient(o.x + o.w * 0.55, o.y, o.x + o.w, o.y + o.h * 0.25);
  band.addColorStop(0, "rgba(255,255,255,0)");
  band.addColorStop(0.5, "rgba(255,255,255,0.10)");
  band.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = band;
  c.fillRect(o.x, o.y, o.w, o.h);
  c.restore();
}

// ------------------------------------------------------------------ formas de colagem

export function slotPath(ctx: PathCtx, s: SlotEl) {
  const { w, h } = s;
  if (s.shape === "circle") {
    ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
  } else if (s.shape === "heart") {
    ctx.moveTo(w / 2, h * 0.28);
    ctx.bezierCurveTo(w / 2, h * 0.24, w * 0.43, h * 0.06, w * 0.25, h * 0.06);
    ctx.bezierCurveTo(w * 0.02, h * 0.06, 0, h * 0.3, 0, h * 0.36);
    ctx.bezierCurveTo(0, h * 0.58, w * 0.22, h * 0.78, w / 2, h * 0.96);
    ctx.bezierCurveTo(w * 0.78, h * 0.78, w, h * 0.58, w, h * 0.36);
    ctx.bezierCurveTo(w, h * 0.3, w * 0.98, h * 0.06, w * 0.75, h * 0.06);
    ctx.bezierCurveTo(w * 0.57, h * 0.06, w / 2, h * 0.24, w / 2, h * 0.28);
    ctx.closePath();
  } else {
    roundRect(ctx, 0, 0, w, h, s.radius);
  }
}

/** Cantos do espaço de foto, em mm, na ordem: sup. esq., sup. dir., inf. dir., inf. esq. */
function slotCorners(s: SlotEl): [number, number][] {
  return [
    [s.x, s.y],
    [s.x + s.w, s.y],
    [s.x + s.w, s.y + s.h],
    [s.x, s.y + s.h],
  ];
}

// ------------------------------------------------------------------ elementos

type ElProps = {
  update: Update;
  onSelect: (id: string) => void;
};

function ImageNode({ el, update, onSelect }: ElProps & { el: ImageEl }) {
  const img = useImage(el.src);
  return (
    <KImage
      id={el.id}
      image={img ?? undefined}
      x={el.x}
      y={el.y}
      width={el.w}
      height={el.h}
      offsetX={el.w / 2}
      offsetY={el.h / 2}
      rotation={el.rotation}
      scaleX={el.flipX ? -1 : 1}
      draggable
      onMouseDown={() => onSelect(el.id)}
      onTouchStart={() => onSelect(el.id)}
      onDragEnd={(e) => update((d) => patchEl(d, el.id, { x: e.target.x(), y: e.target.y() }))}
      onTransformEnd={(e) => {
        const n = e.target;
        const sx = Math.abs(n.scaleX());
        const sy = Math.abs(n.scaleY());
        n.scaleX(el.flipX ? -1 : 1);
        n.scaleY(1);
        update((d) =>
          patchEl(d, el.id, { x: n.x(), y: n.y(), w: el.w * sx, h: el.h * sy, rotation: n.rotation() }),
        );
      }}
    />
  );
}

function TextNode({ el, update, onSelect }: ElProps & { el: TextEl }) {
  const ref = useRef<Konva.Text>(null);
  const font = caseFont(el.font);
  useLayoutEffect(() => {
    const n = ref.current;
    if (!n) return;
    n.offsetX(n.width() / 2);
    n.offsetY(n.height() / 2);
    n.getLayer()?.batchDraw();
  });
  return (
    <KText
      ref={ref}
      id={el.id}
      text={el.text || " "}
      fontFamily={font.family}
      fontStyle={String(font.weight)}
      fontSize={el.size}
      lineHeight={1.12}
      fill={el.fill}
      stroke={el.stroke}
      strokeWidth={el.stroke ? (el.strokeWidth ?? el.size * 0.08) : 0}
      fillAfterStrokeEnabled
      align={el.align}
      width={el.w}
      wrap="word"
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      draggable
      onMouseDown={() => onSelect(el.id)}
      onTouchStart={() => onSelect(el.id)}
      onDragEnd={(e) => update((d) => patchEl(d, el.id, { x: e.target.x(), y: e.target.y() }))}
      onTransformEnd={(e) => {
        const n = e.target;
        const sx = Math.abs(n.scaleX());
        const sy = Math.abs(n.scaleY());
        n.scaleX(1);
        n.scaleY(1);
        update((d) =>
          patchEl(d, el.id, { x: n.x(), y: n.y(), w: el.w * sx, size: el.size * sy, rotation: n.rotation() }),
        );
      }}
    />
  );
}

function SlotNode({
  el,
  update,
  onSelect,
  exporting,
  onEmpty,
}: ElProps & { el: SlotEl; exporting: boolean; onEmpty: (id: string) => void }) {
  const img = useImage(el.src);
  const hasImg = !!(el.src && el.natW && el.natH);
  const sc = hasImg ? coverScale(el.natW!, el.natH!, el.w, el.h) * el.zoom : 1;
  const iw = hasImg ? el.natW! * sc : 0;
  const ih = hasImg ? el.natH! * sc : 0;
  return (
    <Group
      id={el.id}
      x={el.x}
      y={el.y}
      clipFunc={(ctx) => slotPath(ctx, el)}
      onMouseDown={() => onSelect(el.id)}
      onTouchStart={() => onSelect(el.id)}
      onClick={() => !hasImg && onEmpty(el.id)}
      onTap={() => !hasImg && onEmpty(el.id)}
    >
      {hasImg ? (
        <KImage
          image={img ?? undefined}
          x={el.w / 2 + el.ox}
          y={el.h / 2 + el.oy}
          width={iw}
          height={ih}
          offsetX={iw / 2}
          offsetY={ih / 2}
          scaleX={el.flipX ? -1 : 1}
          draggable
          onDragMove={(e) => {
            const n = e.target;
            const c = clampSlotOffset(el, n.x() - el.w / 2, n.y() - el.h / 2);
            n.x(el.w / 2 + c.ox);
            n.y(el.h / 2 + c.oy);
          }}
          onDragEnd={(e) => {
            const n = e.target;
            update((d) => patchEl(d, el.id, { ox: n.x() - el.w / 2, oy: n.y() - el.h / 2 }));
          }}
        />
      ) : (
        !exporting && (
          <>
            <Rect width={el.w} height={el.h} fill="#ece7de" opacity={0.92} />
            <Rect width={el.w} height={el.h} stroke="#1d3fb0" strokeWidth={0.35} dash={[1.4, 1]} opacity={0.6} />
            <KText
              text={"+\nfoto"}
              width={el.w}
              height={el.h}
              align="center"
              verticalAlign="middle"
              fontSize={Math.max(3.2, Math.min(el.w, el.h) * 0.12)}
              lineHeight={1.05}
              fontStyle="600"
              fill="#1d3fb0"
              listening={false}
            />
          </>
        )
      )}
    </Group>
  );
}

// ------------------------------------------------------------------ mockup (foto)

/** Algumas fotos vêm com fundo branco: apaga o branco ligado às bordas do quadro. */
function clearWhiteEdges(img: HTMLImageElement) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0);
  const data = x.getImageData(0, 0, w, h);
  const px = data.data;
  const white = (i: number) => px[i * 4 + 3] > 0 && px[i * 4] >= 246 && px[i * 4 + 1] >= 246 && px[i * 4 + 2] >= 246;
  const stack: number[] = [];
  for (let i = 0; i < w; i++) stack.push(i, (h - 1) * w + i);
  for (let j = 0; j < h; j++) stack.push(j * w, j * w + w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (!white(i)) continue;
    px[i * 4 + 3] = 0;
    const cx = i % w;
    if (cx > 0) stack.push(i - 1);
    if (cx < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < (h - 1) * w) stack.push(i + w);
  }
  x.putImageData(data, 0, 0);
  return c;
}

function usePhoto(src?: string) {
  const img = useImage(src);
  return useMemo(() => (img ? clearWhiteEdges(img) : null), [img]);
}

function useMockupImages(m: DeviceMockup | null) {
  return {
    background: usePhoto(m ? mockupUrl(m.background) : undefined),
    mask: useImage(m ? mockupUrl(m.mask) : undefined),
    overlay: usePhoto(m ? mockupUrl(m.overlay) : undefined),
    border: usePhoto(m ? mockupUrl(m.border) : undefined),
  };
}

// ------------------------------------------------------------------ cena

export default function Scene({
  g,
  mockup,
  phoneHex,
  design,
  width,
  height,
  selectedId,
  onSelect,
  update,
  exporting,
  onEmptySlot,
  apiRef,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const artRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const pinch = useRef<{ dist: number; angle: number; el: DesignEl } | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cornerDrag = useRef<{ dist: number; el: SlotEl } | null>(null);

  const photos = useMockupImages(mockup);
  // área ocupada pelo desenho, em mm: a capa vetorial ou o quadro da foto
  const o = mockup ? mockupFrame(g, mockup) : caseOuter(g);
  const margin = 18;
  const s = Math.max(0.5, Math.min((width - margin * 2) / o.w, (height - margin * 2) / o.h));
  const ox = (width - o.w * s) / 2 - o.x * s;
  const oy = (height - o.h * s) / 2 - o.y * s;

  const selected = useMemo(
    () => design.elements.find((e) => e.id === selectedId) ?? null,
    [design.elements, selectedId],
  );

  // conecta o transformador ao elemento selecionado
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (!exporting && selected && selected.type !== "slot") {
      const node = stage.findOne(`#${selected.id}`);
      tr.nodes(node ? [node] : []);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selected, exporting, design]);

  useImperativeHandle(
    apiRef,
    () => ({
      exportPrint() {
        // sem furos de câmera: a Mimaki imprime por cima e a tinta não pega no recorte da capa
        const node = artRef.current!;
        const clip = node.clipFunc();
        node.clipFunc((ctx) => roundRect(ctx, 0, 0, g.width, g.height, g.radius));
        try {
          return node.toDataURL({
            x: ox,
            y: oy,
            width: g.width * s,
            height: g.height * s,
            pixelRatio: PX_PER_MM_PRINT / s,
            mimeType: "image/png",
          });
        } finally {
          node.clipFunc(clip);
        }
      },
      exportMockup(targetHeight: number) {
        const pad = 6 * s;
        const box = {
          x: ox + o.x * s - pad,
          y: oy + o.y * s - pad,
          width: o.w * s + pad * 2,
          height: o.h * s + pad * 2 + 10,
        };
        return stageRef.current!.toDataURL({ ...box, pixelRatio: targetHeight / box.height, mimeType: "image/png" });
      },
    }),
    [ox, oy, s, g, o.x, o.y, o.w, o.h],
  );

  function applyPinch(base: DesignEl, k: number, da: number, mode: ChangeMode) {
    update((d) => {
      if (base.type === "slot") {
        const zoom = Math.min(MAX_SLOT_ZOOM, Math.max(1, base.zoom * k));
        const cur = d.elements.find((e) => e.id === base.id) as SlotEl | undefined;
        const c = clampSlotOffset({ ...base, zoom }, cur?.ox ?? base.ox, cur?.oy ?? base.oy);
        return patchEl(d, base.id, { zoom, ...c });
      }
      if (base.type === "text") {
        return patchEl(d, base.id, { size: Math.max(2, base.size * k), w: Math.max(8, base.w * k), rotation: base.rotation + da });
      }
      return patchEl(d, base.id, { w: Math.max(4, base.w * k), h: Math.max(4, base.h * k), rotation: base.rotation + da });
    }, mode);
  }

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      className="touch-canvas"
      onMouseDown={(e) => {
        if (e.target === e.target.getStage() || e.target.name() === "bg") onSelect(null);
      }}
      onTouchStart={(e) => {
        if (e.evt.touches.length === 1 && (e.target === e.target.getStage() || e.target.name() === "bg")) onSelect(null);
      }}
      onTouchMove={(e) => {
        const t = e.evt.touches;
        if (t.length !== 2 || !selected) return;
        e.evt.preventDefault();
        const dx = t[1].clientX - t[0].clientX;
        const dy = t[1].clientY - t[0].clientY;
        const dist = Math.hypot(dx, dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (!pinch.current) {
          stageRef.current?.find("Image, Text").forEach((n) => n.isDragging() && n.stopDrag());
          pinch.current = { dist, angle, el: selected };
          update((d) => d, "begin");
          return;
        }
        const b = pinch.current;
        applyPinch(b.el, dist / b.dist, b.el.type === "slot" ? 0 : angle - b.angle, "live");
      }}
      onTouchEnd={(e) => {
        if (pinch.current && e.evt.touches.length < 2) {
          pinch.current = null;
          update((d) => d, "end");
        }
      }}
      onWheel={(e) => {
        if (!selected) return;
        e.evt.preventDefault();
        const k = e.evt.deltaY < 0 ? 1.04 : 1 / 1.04;
        const cur = design.elements.find((x) => x.id === selected.id);
        if (!cur) return;
        if (!wheelTimer.current) update((d) => d, "begin");
        else clearTimeout(wheelTimer.current);
        applyPinch(cur, k, 0, "live");
        wheelTimer.current = setTimeout(() => {
          wheelTimer.current = null;
          update((d) => d, "end");
        }, 350);
      }}
    >
      <Layer listening={false}>
        {mockup ? (
          <KImage image={photos.background ?? undefined} x={ox + o.x * s} y={oy + o.y * s} width={o.w * s} height={o.h * s} />
        ) : (
          <Shape x={ox} y={oy} scaleX={s} scaleY={s} sceneFunc={(ctx) => drawPhone(ctx, g, phoneHex)} />
        )}
      </Layer>

      <Layer>
        <Group
          ref={artRef}
          x={ox}
          y={oy}
          scaleX={s}
          scaleY={s}
          clipFunc={(ctx) => {
            // com foto, a câmera do mockup cobre o recorte; o arquivo de impressão sai sem furos (exportPrint)
            if (mockup && !exporting) roundRect(ctx, 0, 0, g.width, g.height, g.radius);
            else printAreaPath(ctx, g);
          }}
        >
          <Rect name="bg" width={g.width} height={g.height} fill={design.background ?? undefined} />
          {design.elements.map((el) => {
            if (el.type === "slot")
              return (
                <SlotNode
                  key={el.id}
                  el={el}
                  update={update}
                  onSelect={onSelect}
                  exporting={exporting}
                  onEmpty={onEmptySlot}
                />
              );
            if (el.type === "text") return <TextNode key={el.id} el={el} update={update} onSelect={onSelect} />;
            return <ImageNode key={el.id} el={el} update={update} onSelect={onSelect} />;
          })}
        </Group>
        {photos.mask && (
          <KImage
            image={photos.mask}
            x={ox + o.x * s}
            y={oy + o.y * s}
            width={o.w * s}
            height={o.h * s}
            globalCompositeOperation="destination-in"
            listening={false}
          />
        )}
      </Layer>

      <Layer listening={false}>
        {mockup ? (
          <>
            {photos.overlay && <KImage image={photos.overlay} x={ox + o.x * s} y={oy + o.y * s} width={o.w * s} height={o.h * s} />}
            {photos.border && <KImage image={photos.border} x={ox + o.x * s} y={oy + o.y * s} width={o.w * s} height={o.h * s} />}
          </>
        ) : (
          <Shape x={ox} y={oy} scaleX={s} scaleY={s} sceneFunc={(ctx) => drawCase(ctx, g)} />
        )}
        {!exporting && selected?.type === "slot" && (
          <Shape
            listening={false}
            x={ox + selected.x * s}
            y={oy + selected.y * s}
            scaleX={s}
            scaleY={s}
            sceneFunc={(ctx, shape) => {
              ctx.beginPath();
              slotPath(ctx, selected);
              ctx.strokeShape(shape);
            }}
            stroke="#1d3fb0"
            strokeWidth={2.5}
            strokeScaleEnabled={false}
          />
        )}
      </Layer>

      <Layer>
        {/* puxadores nos cantos: zoom da foto do espaço, sempre proporcional */}
        {!exporting &&
          selected?.type === "slot" &&
          selected.src &&
          slotCorners(selected).map(([cx, cy], i) => {
            const center = { x: ox + (selected.x + selected.w / 2) * s, y: oy + (selected.y + selected.h / 2) * s };
            const corner = { x: ox + cx * s, y: oy + cy * s };
            const setCursor = (c: string) => {
              const el = stageRef.current?.container();
              if (el) el.style.cursor = c;
            };
            return (
              <Circle
                key={i}
                x={corner.x}
                y={corner.y}
                radius={8}
                fill="#ffffff"
                stroke="#1d3fb0"
                strokeWidth={2}
                hitStrokeWidth={24}
                draggable
                onMouseEnter={() => setCursor(i % 2 === 0 ? "nwse-resize" : "nesw-resize")}
                onMouseLeave={() => !cornerDrag.current && setCursor("")}
                onDragStart={(e) => {
                  const n = e.target;
                  cornerDrag.current = {
                    dist: Math.max(1, Math.hypot(n.x() - center.x, n.y() - center.y)),
                    el: selected,
                  };
                  update((d) => d, "begin");
                }}
                onDragMove={(e) => {
                  const b = cornerDrag.current;
                  if (!b) return;
                  const n = e.target;
                  const k = Math.hypot(n.x() - center.x, n.y() - center.y) / b.dist;
                  applyPinch(b.el, k, 0, "live");
                }}
                onDragEnd={(e) => {
                  cornerDrag.current = null;
                  e.target.position(corner);
                  setCursor("");
                  update((d) => d, "end");
                }}
              />
            );
          })}
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          rotationSnaps={[0, 90, 180, 270]}
          rotationSnapTolerance={4}
          anchorSize={16}
          anchorCornerRadius={8}
          anchorStroke="#1d3fb0"
          anchorFill="#ffffff"
          anchorStrokeWidth={2}
          borderStroke="#1d3fb0"
          borderStrokeWidth={1.5}
          rotateAnchorOffset={28}
          padding={4}
          ignoreStroke
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 16 || newBox.height < 16 ? oldBox : newBox)}
        />
      </Layer>
    </Stage>
  );
}
