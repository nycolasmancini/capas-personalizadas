import type { DeviceGeometry, DeviceMockup, Hole } from "./types";

/** Espessura da borda da capa anti-impacto em volta do aparelho (mm) */
export const CASE_RIM = 1.8;
/** Reforço extra nos cantos (mm) */
export const CASE_CORNER_BUMP = 1.2;

export const PRINT_DPI = 300;
export const PX_PER_MM_PRINT = PRINT_DPI / 25.4;

export type PathCtx = {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  arc(x: number, y: number, r: number, start: number, end: number, ccw?: boolean): void;
  bezierCurveTo(a: number, b: number, c: number, d: number, e: number, f: number): void;
  closePath(): void;
};

/** Desenha um retângulo arredondado. ccw=true inverte o sentido (vira "furo" na regra nonzero). */
export function roundRect(ctx: PathCtx, x: number, y: number, w: number, h: number, r: number, ccw = false) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!ccw) {
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
  } else {
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x, y, x, y + h, rr);
    ctx.arcTo(x, y + h, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x + w, y, rr);
    ctx.arcTo(x + w, y, x, y, rr);
  }
  ctx.closePath();
}

/** Área imprimível: traseira inteira menos os recortes de câmera. */
export function printAreaPath(ctx: PathCtx, g: DeviceGeometry) {
  roundRect(ctx, 0, 0, g.width, g.height, g.radius);
  for (const h of g.holes) roundRect(ctx, h.x, h.y, h.w, h.h, h.r, true);
}

/** Retângulo arredondado como `d` de SVG */
export function roundRectD(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const f = (n: number) => +n.toFixed(3);
  return [
    `M${f(x + rr)} ${f(y)}`,
    `H${f(x + w - rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w)} ${f(y + rr)}`,
    `V${f(y + h - rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w - rr)} ${f(y + h)}`,
    `H${f(x + rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x)} ${f(y + h - rr)}`,
    `V${f(y + rr)}`,
    `A${f(rr)} ${f(rr)} 0 0 1 ${f(x + rr)} ${f(y)}`,
    "Z",
  ].join(" ");
}

export function holeD(h: Hole) {
  return roundRectD(h.x, h.y, h.w, h.h, h.r);
}

/** SVG com a linha de corte em tamanho real (mm) para a produção. */
export function cutLineSvg(g: DeviceGeometry, title: string) {
  const paths = [roundRectD(0, 0, g.width, g.height, g.radius), ...g.holes.map(holeD)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}mm" height="${g.height}mm" viewBox="0 0 ${g.width} ${g.height}">
  <title>${title.replace(/[<&>]/g, "")}</title>
  <g fill="none" stroke="#ff00ff" stroke-width="0.1">
${paths.map((d) => `    <path d="${d}"/>`).join("\n")}
  </g>
</svg>`;
}

export function caseOuter(g: DeviceGeometry) {
  return {
    x: -CASE_RIM,
    y: -CASE_RIM,
    w: g.width + CASE_RIM * 2,
    h: g.height + CASE_RIM * 2,
    r: g.radius + CASE_RIM,
  };
}

/** Quadro do mockup em mm, esticado para a área imprimível coincidir com a traseira. */
export function mockupFrame(g: DeviceGeometry, m: DeviceMockup) {
  const sx = g.width / m.print.w;
  const sy = g.height / m.print.h;
  return { x: -m.print.x * sx, y: -m.print.y * sy, w: m.frame.w * sx, h: m.frame.h * sy };
}

/** As fotos vêm do S3 da Case4You por um proxy no mesmo domínio (o canvas precisa exportar). */
export function mockupUrl(path: string): string;
export function mockupUrl(path: string | null): string | undefined;
export function mockupUrl(path: string | null) {
  return path ? `/mockups/${path.split("/").map(encodeURIComponent).join("/")}` : undefined;
}

/** Escurece/clareia um hex (amt entre -1 e 1) */
export function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function isLight(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}
