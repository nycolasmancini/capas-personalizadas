// Estrutura da arte salva em cada pedido. Coordenadas em mm na área de impressão.

export type ImageEl = {
  id: string;
  type: "photo" | "art";
  src: string;
  natW: number;
  natH: number;
  /** centro */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  flipX?: boolean;
  artId?: string;
};

export type TextEl = {
  id: string;
  type: "text";
  text: string;
  font: string;
  /** altura da fonte em mm */
  size: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  align: "left" | "center" | "right";
  x: number;
  y: number;
  /** largura da caixa em mm */
  w: number;
  rotation: number;
};

export type SlotShape = "rect" | "circle" | "heart";

export type SlotEl = {
  id: string;
  type: "slot";
  shape: SlotShape;
  /** canto superior esquerdo */
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  src?: string;
  natW?: number;
  natH?: number;
  /** deslocamento do centro da foto em relação ao centro do espaço (mm) */
  ox: number;
  oy: number;
  /** 1 = preenche o espaço */
  zoom: number;
  flipX?: boolean;
};

export type DesignEl = ImageEl | TextEl | SlotEl;

export type Design = {
  version: 1;
  deviceId: string;
  phoneColor: string;
  background: string | null;
  elements: DesignEl[];
};

export function emptyDesign(deviceId: string): Design {
  return { version: 1, deviceId, phoneColor: "preto", background: null, elements: [] };
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export const MAX_SLOT_ZOOM = 4;

/** Escala para a foto cobrir o espaço (cover) */
export function coverScale(natW: number, natH: number, w: number, h: number) {
  return Math.max(w / natW, h / natH);
}

/** Mantém a foto cobrindo o espaço depois de arrastar/zoom */
export function clampSlotOffset(s: SlotEl, ox: number, oy: number) {
  if (!s.natW || !s.natH) return { ox: 0, oy: 0 };
  const sc = coverScale(s.natW, s.natH, s.w, s.h) * s.zoom;
  const maxX = Math.max(0, (s.natW * sc - s.w) / 2);
  const maxY = Math.max(0, (s.natH * sc - s.h) / 2);
  return { ox: Math.min(maxX, Math.max(-maxX, ox)), oy: Math.min(maxY, Math.max(-maxY, oy)) };
}

/** DPI efetivo de uma foto como será impressa */
export function effectiveDpi(el: ImageEl | SlotEl) {
  if (el.type === "slot") {
    if (!el.natW || !el.natH) return Infinity;
    const sc = coverScale(el.natW, el.natH, el.w, el.h) * el.zoom; // mm por px
    return 25.4 / sc;
  }
  return (el.natW / el.w) * 25.4;
}

export const LOW_DPI = 150;
