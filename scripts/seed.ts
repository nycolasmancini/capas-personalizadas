// Popula aparelhos e artes iniciais. Seguro rodar mais de uma vez:
// não sobrescreve ajustes feitos pelo painel.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db");
  const { arts, devices } = await import("../src/lib/db/schema");
  const { DEVICE_CATALOG } = await import("../src/lib/devices/catalog");

  await db
    .insert(devices)
    .values(DEVICE_CATALOG.map((d) => ({ ...d, active: true, verified: false })))
    .onConflictDoNothing();
  console.log(`aparelhos: ${DEVICE_CATALOG.length} no catálogo`);

  const existing = await db.select({ id: arts.id }).from(arts).limit(1);
  if (!existing.length) {
    const seed = [
      ["Bolinhas", "Fundos", "fundo-bolinhas.svg"],
      ["Vichy azul", "Fundos", "fundo-vichy.svg"],
      ["Listras pêssego", "Fundos", "fundo-listras.svg"],
      ["Corações", "Fundos", "fundo-coracoes.svg"],
      ["Céu estrelado", "Fundos", "fundo-estrelas.svg"],
      ["Pôr do sol", "Fundos", "fundo-degrade-por-do-sol.svg"],
      ["Oceano", "Fundos", "fundo-degrade-oceano.svg"],
      ["Xadrez retrô", "Fundos", "fundo-xadrez-retro.svg"],
      ["Coração", "Enfeites", "enfeite-coracao.svg", 600, 600],
      ["Estrela dourada", "Enfeites", "enfeite-estrela.svg", 600, 600],
      ["Borboleta", "Enfeites", "enfeite-borboleta.svg", 600, 600],
      ["Moldura polaroid", "Enfeites", "enfeite-moldura-polaroid.svg", 600, 720],
    ] as const;
    await db.insert(arts).values(
      seed.map(([name, category, file, w, h]) => ({
        id: crypto.randomUUID(),
        name,
        category,
        url: `/artes/${file}`,
        width: w ?? 1000,
        height: h ?? 2000,
      })),
    );
    console.log(`artes: ${seed.length} inseridas`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
