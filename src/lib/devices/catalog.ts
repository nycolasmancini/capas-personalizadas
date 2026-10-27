import type { DeviceGeometry, DeviceSeed, Hole, Lens } from "./types";

/*
 * Catálogo inicial. Largura/altura vêm das especificações oficiais de cada
 * fabricante. A posição e o tamanho dos módulos de câmera são aproximados e
 * devem ser conferidos com uma capa física; o painel permite ajustar cada
 * valor e marcar o modelo como "conferido".
 */

const CLEARANCE = 0.8; // folga do recorte da capa em volta do módulo

function moduleHole(x: number, y: number, w: number, h: number, r: number): Hole {
  return {
    x: x - CLEARANCE,
    y: y - CLEARANCE,
    w: w + CLEARANCE * 2,
    h: h + CLEARANCE * 2,
    r: r + CLEARANCE,
  };
}

function circleHole(cx: number, cy: number, d: number): Hole {
  const D = d + CLEARANCE * 2;
  return { x: cx - D / 2, y: cy - D / 2, w: D, h: D, r: D / 2 };
}

const lens = (x: number, y: number, d: number): Lens => ({ x, y, d, kind: "lens" });
const flash = (x: number, y: number, d = 3.6): Lens => ({ x, y, d, kind: "flash" });
const sensor = (x: number, y: number, d = 3): Lens => ({ x, y, d, kind: "sensor" });

/** iPhone com módulo quadrado e duas lentes */
function iphoneDual(
  width: number,
  height: number,
  radius: number,
  m: { x: number; y: number; s: number; r: number; d: number },
  layout: "vertical" | "diagonal",
): DeviceGeometry {
  const a = m.x + m.s * 0.27;
  const b = m.x + m.s * 0.73;
  const ta = m.y + m.s * 0.27;
  const tb = m.y + m.s * 0.73;
  const lenses =
    layout === "vertical"
      ? [lens(a, ta, m.d), lens(a, tb, m.d), flash(b, ta), sensor(b, tb, 2)]
      : [lens(a, ta, m.d), lens(b, tb, m.d), flash(b, ta), sensor(a, tb, 2)];
  return { width, height, radius, holes: [moduleHole(m.x, m.y, m.s, m.s, m.r)], lenses };
}

/** iPhone Pro: três lentes em triângulo */
function iphoneTriple(
  width: number,
  height: number,
  radius: number,
  m: { x: number; y: number; w: number; h: number; r: number; d: number },
): DeviceGeometry {
  const lx = m.x + m.w * 0.27;
  const rx = m.x + m.w * 0.74;
  return {
    width,
    height,
    radius,
    holes: [moduleHole(m.x, m.y, m.w, m.h, m.r)],
    lenses: [
      lens(lx, m.y + m.h * 0.26, m.d),
      lens(lx, m.y + m.h * 0.74, m.d),
      lens(rx, m.y + m.h * 0.5, m.d),
      flash(rx, m.y + m.h * 0.17),
      sensor(rx, m.y + m.h * 0.84, 3.4),
    ],
  };
}

/** iPhone 17 Pro: platô de câmera de lado a lado */
function iphonePlateau(
  width: number,
  height: number,
  radius: number,
  p: { h: number; d: number },
): DeviceGeometry {
  const x = 2.6;
  const y = 2.6;
  const w = width - 5.2;
  const lx = x + 9.5;
  const rx = x + 25.5;
  return {
    width,
    height,
    radius,
    holes: [moduleHole(x, y, w, p.h, 9)],
    lenses: [
      lens(lx, y + p.h * 0.27, p.d),
      lens(lx, y + p.h * 0.73, p.d),
      lens(rx, y + p.h * 0.5, p.d),
      flash(x + w - 9, y + p.h * 0.3),
      sensor(x + w - 9, y + p.h * 0.7, 3.4),
    ],
  };
}

/** iPhone 16/17: cápsula vertical + flash separado */
function iphonePill(width: number, height: number, radius: number): DeviceGeometry {
  const x = 5.6;
  const y = 5.6;
  const w = 17;
  const h = 35.5;
  return {
    width,
    height,
    radius,
    holes: [moduleHole(x, y, w, h, w / 2), circleHole(x + w + 6.2, y + 6, 5)],
    lenses: [
      lens(x + w / 2, y + w / 2, 12.4),
      lens(x + w / 2, y + h - w / 2, 12.4),
      flash(x + w + 6.2, y + 6, 4.2),
    ],
  };
}

/** Android com lentes individuais em coluna (padrão Galaxy A/S) */
function column(
  width: number,
  height: number,
  radius: number,
  c: { x: number; y: number; step: number; d: number[]; flashAt?: [number, number] },
): DeviceGeometry {
  const holes: Hole[] = [];
  const lenses: Lens[] = [];
  c.d.forEach((d, i) => {
    const cy = c.y + c.step * i;
    holes.push(circleHole(c.x, cy, d));
    lenses.push(lens(c.x, cy, d));
  });
  if (c.flashAt) {
    holes.push(circleHole(c.flashAt[0], c.flashAt[1], 3.6));
    lenses.push(flash(c.flashAt[0], c.flashAt[1], 3.4));
  }
  return { width, height, radius, holes, lenses };
}

/** Android com módulo retangular (Moto G / Redmi) */
function block(
  width: number,
  height: number,
  radius: number,
  m: { x: number; y: number; w: number; h: number; r: number },
  inner: Lens[],
): DeviceGeometry {
  return { width, height, radius, holes: [moduleHole(m.x, m.y, m.w, m.h, m.r)], lenses: inner };
}

export const DEVICE_CATALOG: DeviceSeed[] = [
  // ---------------- Apple ----------------
  { id: "iphone-11", brand: "Apple", name: "iPhone 11", rank: 9,
    geometry: iphoneDual(75.7, 150.9, 11.5, { x: 6.2, y: 6.2, s: 31, r: 8.5, d: 11.5 }, "vertical") },
  { id: "iphone-12", brand: "Apple", name: "iPhone 12", rank: 12,
    geometry: iphoneDual(71.5, 146.7, 10.5, { x: 5.8, y: 5.8, s: 28.5, r: 7.2, d: 10.5 }, "vertical") },
  { id: "iphone-13", brand: "Apple", name: "iPhone 13", rank: 6,
    geometry: iphoneDual(71.5, 146.7, 10.5, { x: 5.5, y: 5.5, s: 30.5, r: 7.6, d: 11 }, "diagonal") },
  { id: "iphone-14", brand: "Apple", name: "iPhone 14", rank: 8,
    geometry: iphoneDual(71.5, 146.7, 10.5, { x: 5.2, y: 5.2, s: 33, r: 8.2, d: 12.5 }, "diagonal") },
  { id: "iphone-15", brand: "Apple", name: "iPhone 15", rank: 4,
    geometry: iphoneDual(71.6, 147.6, 10.5, { x: 5.2, y: 5.2, s: 33, r: 8.2, d: 12.5 }, "diagonal") },
  { id: "iphone-15-pro", brand: "Apple", name: "iPhone 15 Pro", rank: 7,
    geometry: iphoneTriple(70.6, 146.6, 10, { x: 4.6, y: 4.6, w: 37, h: 38.5, r: 9, d: 13.5 }) },
  { id: "iphone-15-pro-max", brand: "Apple", name: "iPhone 15 Pro Max", rank: 10,
    geometry: iphoneTriple(76.7, 159.9, 11, { x: 4.6, y: 4.6, w: 40, h: 41.5, r: 9.5, d: 14.5 }) },
  { id: "iphone-16", brand: "Apple", name: "iPhone 16", rank: 3,
    geometry: iphonePill(71.6, 147.6, 10.5) },
  { id: "iphone-16-pro", brand: "Apple", name: "iPhone 16 Pro", rank: 5,
    geometry: iphoneTriple(71.5, 149.6, 10.5, { x: 4.6, y: 4.6, w: 38, h: 39.5, r: 9.2, d: 14 }) },
  { id: "iphone-16-pro-max", brand: "Apple", name: "iPhone 16 Pro Max", rank: 11,
    geometry: iphoneTriple(77.6, 163, 11.5, { x: 4.6, y: 4.6, w: 41, h: 42.5, r: 9.6, d: 15 }) },
  { id: "iphone-17", brand: "Apple", name: "iPhone 17", rank: 1,
    geometry: iphonePill(71.5, 149.6, 10.5) },
  { id: "iphone-17-pro", brand: "Apple", name: "iPhone 17 Pro", rank: 2,
    geometry: iphonePlateau(71.9, 150, 10.5, { h: 40, d: 14.5 }) },
  { id: "iphone-17-pro-max", brand: "Apple", name: "iPhone 17 Pro Max", rank: 13,
    geometry: iphonePlateau(78, 163.4, 11.5, { h: 42, d: 15.5 }) },

  // ---------------- Samsung ----------------
  { id: "galaxy-a06", brand: "Samsung", name: "Galaxy A06", rank: 16,
    geometry: column(77.3, 167.3, 9, { x: 12.5, y: 12.5, step: 13, d: [10, 8], flashAt: [21.5, 12.5] }) },
  { id: "galaxy-a15", brand: "Samsung", name: "Galaxy A15", rank: 14,
    geometry: column(76.8, 160.1, 9, { x: 12.5, y: 12.5, step: 12, d: [10, 8, 8], flashAt: [21.5, 12.5] }) },
  { id: "galaxy-a16", brand: "Samsung", name: "Galaxy A16", rank: 15,
    geometry: block(77.9, 164.4, 9, { x: 7, y: 6.5, w: 11.5, h: 35, r: 5.75 }, [
      lens(12.75, 12.3, 9.4), lens(12.75, 23.9, 8), lens(12.75, 35.5, 8), flash(23, 12.3),
    ]) },
  { id: "galaxy-a25", brand: "Samsung", name: "Galaxy A25", rank: 17,
    geometry: column(76.5, 161, 9, { x: 12.5, y: 12.5, step: 12, d: [10, 8, 8], flashAt: [21.5, 12.5] }) },
  { id: "galaxy-a35", brand: "Samsung", name: "Galaxy A35", rank: 18,
    geometry: column(78, 161.7, 9, { x: 12.5, y: 12.5, step: 12.5, d: [10.5, 8.5, 8.5], flashAt: [22, 12.5] }) },
  { id: "galaxy-a55", brand: "Samsung", name: "Galaxy A55", rank: 19,
    geometry: column(77.4, 161.1, 9, { x: 12.5, y: 12.5, step: 12.5, d: [10.5, 8.5, 8.5], flashAt: [22, 12.5] }) },
  { id: "galaxy-s24", brand: "Samsung", name: "Galaxy S24", rank: 20,
    geometry: column(70.6, 147, 10, { x: 11.5, y: 12, step: 11.6, d: [10, 10, 10], flashAt: [20.5, 12] }) },
  { id: "galaxy-s24-ultra", brand: "Samsung", name: "Galaxy S24 Ultra", rank: 22,
    geometry: (() => {
      const g = column(79, 162.3, 3.5, { x: 12.5, y: 13, step: 13.5, d: [11.5, 11.5, 11.5] });
      g.holes.push(circleHole(25.5, 13, 9), circleHole(25.5, 26.5, 4));
      g.lenses.push(lens(25.5, 13, 9), flash(25.5, 26.5));
      return g;
    })() },
  { id: "galaxy-s25", brand: "Samsung", name: "Galaxy S25", rank: 21,
    geometry: column(70.5, 146.9, 10, { x: 11.5, y: 12, step: 11.6, d: [10, 10, 10], flashAt: [20.5, 12] }) },

  // ---------------- Motorola ----------------
  { id: "moto-g24", brand: "Motorola", name: "Moto G24", rank: 23,
    geometry: block(75.8, 163.5, 10, { x: 6, y: 6, w: 22, h: 33, r: 6 }, [
      lens(13, 13, 11), lens(13, 29, 8), flash(22.5, 13),
    ]) },
  { id: "moto-g34", brand: "Motorola", name: "Moto G34", rank: 24,
    geometry: block(76.1, 162.7, 10, { x: 6, y: 6, w: 23, h: 34, r: 6.5 }, [
      lens(13.5, 13.5, 11.5), lens(13.5, 30, 8.5), flash(23, 13.5),
    ]) },
  { id: "moto-g54", brand: "Motorola", name: "Moto G54", rank: 25,
    geometry: block(73.8, 161.6, 10, { x: 6, y: 6, w: 23, h: 34, r: 6.5 }, [
      lens(13.5, 13.5, 11.5), lens(13.5, 30, 8.5), flash(23, 13.5),
    ]) },
  { id: "moto-g84", brand: "Motorola", name: "Moto G84", rank: 26,
    geometry: block(74.4, 160, 10, { x: 6, y: 6, w: 23, h: 34, r: 6.5 }, [
      lens(13.5, 13.5, 11.5), lens(13.5, 30, 8.5), flash(23, 13.5),
    ]) },
  { id: "moto-edge-50-fusion", brand: "Motorola", name: "Edge 50 Fusion", rank: 27,
    geometry: block(73.1, 161.9, 10, { x: 6, y: 6, w: 26, h: 36, r: 8 }, [
      lens(14.5, 15, 13), lens(14.5, 33, 9), flash(26, 14),
    ]) },

  // ---------------- Xiaomi ----------------
  { id: "redmi-note-13", brand: "Xiaomi", name: "Redmi Note 13", rank: 28,
    geometry: block(75.6, 162.2, 9.5, { x: 5.5, y: 5.5, w: 27, h: 37, r: 7 }, [
      lens(13, 13, 11.5), lens(13, 27, 8), lens(13, 37.5, 6), flash(25, 13),
    ]) },
  { id: "redmi-13c", brand: "Xiaomi", name: "Redmi 13C", rank: 29,
    geometry: block(78, 168, 10, { x: 6, y: 6, w: 32, h: 32, r: 8 }, [
      lens(14, 14, 12), lens(30, 14, 7), lens(14, 30, 7), flash(30, 30),
    ]) },
  { id: "redmi-note-14", brand: "Xiaomi", name: "Redmi Note 14", rank: 30,
    geometry: block(75.8, 163.3, 9.5, { x: 5.5, y: 5.5, w: 27, h: 38, r: 7 }, [
      lens(13, 13.5, 12), lens(13, 28, 8.5), lens(13, 38.5, 6), flash(25, 13.5),
    ]) },
];

export const PHONE_COLORS = [
  { id: "preto", name: "Preto", hex: "#1f2023" },
  { id: "branco", name: "Branco", hex: "#f1efe9" },
  { id: "titanio", name: "Titânio", hex: "#bdb6aa" },
  { id: "deserto", name: "Deserto", hex: "#c8b29a" },
  { id: "azul", name: "Azul", hex: "#3d5875" },
  { id: "azul-claro", name: "Azul claro", hex: "#b8cbe0" },
  { id: "rosa", name: "Rosa", hex: "#efc6cd" },
  { id: "verde", name: "Verde", hex: "#a9c4b0" },
  { id: "lilas", name: "Lilás", hex: "#c3b6dc" },
  { id: "amarelo", name: "Amarelo", hex: "#f1e3a2" },
  { id: "laranja", name: "Laranja", hex: "#e98a4a" },
] as const;

export type PhoneColorId = (typeof PHONE_COLORS)[number]["id"];

export function phoneColorHex(id: string) {
  return PHONE_COLORS.find((c) => c.id === id)?.hex ?? PHONE_COLORS[0].hex;
}
