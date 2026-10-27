// Importa os mockups (fotos) da Case4You. Os 30 modelos do catálogo ganham a foto;
// os demais entram desabilitados, com medidas estimadas pela foto, para o admin
// habilitar no painel. Seguro rodar mais de uma vez: só atualiza as fotos.
import { readFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local" });

type Row = {
  id: string;
  catalog: boolean;
  brand: string;
  name: string;
  background: string;
  border: string | null;
  mask: string;
  overlay: string | null;
  frame: [number, number];
  print: [number, number, number, number];
  cornerPx: number;
  camera: [number, number, number, number] | null;
};

/** Altura assumida quando não temos a medida oficial (mm) */
const NOMINAL_HEIGHT = 160;

const r1 = (n: number) => Math.round(n * 10) / 10;

async function main() {
  const { sql } = await import("drizzle-orm");
  const { db } = await import("../src/lib/db");
  const { devices } = await import("../src/lib/db/schema");
  const { DEVICE_CATALOG } = await import("../src/lib/devices/catalog");
  type Geometry = (typeof DEVICE_CATALOG)[number]["geometry"];

  const rows: Row[] = JSON.parse(readFileSync("scripts/data/case4you-devices.json", "utf8"));

  const mockupOf = (r: Row) => ({
    background: r.background,
    border: r.border,
    mask: r.mask,
    overlay: r.overlay,
    frame: { w: r.frame[0], h: r.frame[1] },
    print: { x: r.print[0], y: r.print[1], w: r.print[2], h: r.print[3] },
  });

  function estimate(r: Row): Geometry {
    const k = NOMINAL_HEIGHT / r.print[3];
    const width = r1(r.print[2] * k);
    const height = NOMINAL_HEIGHT;
    const holes = [];
    if (r.camera) {
      const [x, y, w, h] = r.camera.map((v) => v * k);
      holes.push({ x: r1(Math.max(0.5, x)), y: r1(Math.max(0.5, y)), w: r1(w), h: r1(h), r: r1(Math.min(w, h) * 0.25) });
    }
    return { width, height, radius: r1(Math.min(12, Math.max(3, r.cornerPx * k))), holes, lenses: [], estimated: true };
  }

  const catalog = new Map(DEVICE_CATALOG.map((d) => [d.id, d]));
  const values = rows.map((r) => {
    const seed = catalog.get(r.id);
    return seed
      ? { ...seed, active: true, verified: false, mockup: mockupOf(r) }
      : { id: r.id, brand: r.brand, name: r.name, rank: 999, geometry: estimate(r), active: false, verified: false, mockup: mockupOf(r) };
  });

  for (let i = 0; i < values.length; i += 100) {
    await db
      .insert(devices)
      .values(values.slice(i, i + 100))
      .onConflictDoUpdate({ target: devices.id, set: { mockup: sql`excluded.mockup` } });
  }
  const fromCatalog = rows.filter((r) => r.catalog).length;
  console.log(`mockups: ${fromCatalog} do catálogo atualizados, ${rows.length - fromCatalog} novos modelos (desabilitados)`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
