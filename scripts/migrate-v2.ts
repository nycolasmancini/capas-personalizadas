// Rodada 2: unidades de retirada, status "retirado" e ajustes padrão. Pode rodar mais de uma vez.
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { sql } = await import("drizzle-orm");
  const { db } = await import("../src/lib/db");
  const { orders, pickupPoints, settings } = await import("../src/lib/db/schema");

  await db.update(orders).set({ status: "retirado" }).where(sql`${orders.status} = 'enviado'`);

  await db
    .insert(pickupPoints)
    .values([
      { id: "sp", name: "São Paulo", address: "Endereço a definir no painel", leadDays: 3, priceCents: 2200, rank: 1 },
      { id: "limeira", name: "Limeira", address: "Endereço a definir no painel", leadDays: 3, priceCents: 2000, rank: 2 },
    ])
    .onConflictDoNothing();

  await db.insert(settings).values({ key: "whiteSpotName", value: "White" }).onConflictDoNothing();
  console.log("ok");
}

main().then(() => process.exit(0), (e) => (console.error(e), process.exit(1)));
