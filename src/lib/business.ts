import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import { networks, pickupPoints, sellers, settings, type Billing, type PickupPoint, type Store } from "./db/schema";

export const SETTING_DEFAULTS = {
  /** nome da cor especial do branco no RIP da Mimaki (RasterLink) */
  whiteSpotName: "White",
};
export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting(key: SettingKey) {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value ?? SETTING_DEFAULTS[key];
}

export async function listPickupPoints({ includeInactive = false } = {}) {
  return db
    .select()
    .from(pickupPoints)
    .where(includeInactive ? undefined : eq(pickupPoints.active, true))
    .orderBy(asc(pickupPoints.rank), asc(pickupPoints.name));
}

/** Soma dias úteis (segunda a sexta). Feriados não entram na conta. */
export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

/**
 * Vendedor, forma de pagamento e unidade de retirada de uma loja.
 * Lojas de rede herdam da rede. Sem vendedor, a loja escolhe a unidade a cada pedido.
 */
export async function storeTerms(store: Store | null): Promise<{
  sellerId: string | null;
  sellerName: string | null;
  billing: Billing;
  pickup: PickupPoint | null;
  points: PickupPoint[];
}> {
  const points = await listPickupPoints();
  if (!store) return { sellerId: null, sellerName: null, billing: "pix", pickup: null, points };
  const network = store.networkId
    ? ((await db.select().from(networks).where(eq(networks.id, store.networkId)).limit(1))[0] ?? null)
    : null;
  const sellerId = network?.sellerId ?? store.sellerId;
  const seller = sellerId
    ? ((await db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1))[0] ?? null)
    : null;
  const pickup = (seller?.active && points.find((p) => p.id === seller.pickupPointId)) || null;
  return {
    sellerId: seller?.id ?? null,
    sellerName: seller?.name ?? null,
    billing: network?.billing ?? store.billing,
    pickup,
    points,
  };
}
