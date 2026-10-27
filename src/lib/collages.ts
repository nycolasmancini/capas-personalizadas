import type { SlotEl, SlotShape } from "./design";
import { uid } from "./design";

type Cell = { x: number; y: number; w: number; h: number; shape?: SlotShape };

export type Collage = {
  id: string;
  name: string;
  /** células normalizadas (0..1) na área de impressão */
  cells: Cell[];
  /** espaço entre fotos em mm */
  gap: number;
  radius: number;
};

const grid = (cols: number, rows: number): Cell[] =>
  Array.from({ length: cols * rows }, (_, i) => ({
    x: (i % cols) / cols,
    y: Math.floor(i / cols) / rows,
    w: 1 / cols,
    h: 1 / rows,
  }));

export const COLLAGES: Collage[] = [
  { id: "uma", name: "1 foto", gap: 0, radius: 0, cells: [{ x: 0, y: 0, w: 1, h: 1 }] },
  { id: "duas-v", name: "2 em pé", gap: 1.5, radius: 0, cells: grid(2, 1) },
  { id: "duas-h", name: "2 deitadas", gap: 1.5, radius: 0, cells: grid(1, 2) },
  {
    id: "tres",
    name: "1 + 2",
    gap: 1.5,
    radius: 0,
    cells: [
      { x: 0, y: 0, w: 1, h: 0.58 },
      { x: 0, y: 0.58, w: 0.5, h: 0.42 },
      { x: 0.5, y: 0.58, w: 0.5, h: 0.42 },
    ],
  },
  { id: "tres-faixas", name: "3 faixas", gap: 1.5, radius: 0, cells: grid(1, 3) },
  { id: "quatro", name: "4 grade", gap: 1.5, radius: 0, cells: grid(2, 2) },
  { id: "seis", name: "6 grade", gap: 1.2, radius: 0, cells: grid(2, 3) },
  { id: "nove", name: "9 mosaico", gap: 1, radius: 0, cells: grid(3, 3) },
  {
    id: "polaroids",
    name: "Polaroids",
    gap: 0,
    radius: 1.5,
    cells: [
      { x: 0.1, y: 0.3, w: 0.8, h: 0.3 },
      { x: 0.1, y: 0.64, w: 0.8, h: 0.3 },
    ],
  },
  {
    id: "coracao",
    name: "Coração",
    gap: 0,
    radius: 0,
    cells: [{ x: 0.08, y: 0.32, w: 0.84, h: 0.42, shape: "heart" }],
  },
  {
    id: "circulos",
    name: "Círculos",
    gap: 0,
    radius: 0,
    cells: [
      { x: 0.12, y: 0.33, w: 0.76, h: 0.36, shape: "circle" },
      { x: 0.08, y: 0.72, w: 0.38, h: 0.18, shape: "circle" },
      { x: 0.54, y: 0.72, w: 0.38, h: 0.18, shape: "circle" },
    ],
  },
];

/** Converte as células do modelo em espaços de foto em mm para o aparelho */
export function buildSlots(c: Collage, width: number, height: number): SlotEl[] {
  const g = c.gap / 2;
  return c.cells.map((cell) => {
    let x = cell.x * width + (cell.x > 0 ? g : 0);
    let y = cell.y * height + (cell.y > 0 ? g : 0);
    let w = cell.w * width - (cell.x > 0 ? g : 0) - (cell.x + cell.w < 0.999 ? g : 0);
    let h = cell.h * height - (cell.y > 0 ? g : 0) - (cell.y + cell.h < 0.999 ? g : 0);
    if (cell.shape === "circle" || cell.shape === "heart") {
      const s = Math.min(w, h);
      x += (w - s) / 2;
      y += (h - s) / 2;
      w = s;
      h = s;
    }
    return {
      id: uid(),
      type: "slot" as const,
      shape: cell.shape ?? "rect",
      x,
      y,
      w,
      h,
      radius: c.radius,
      ox: 0,
      oy: 0,
      zoom: 1,
    };
  });
}
