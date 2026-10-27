import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, max, notInArray, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
  artGenerations,
  arts,
  devices,
  members,
  networks,
  orderRevisions,
  orders,
  payments,
  type Payment,
  pickupPoints,
  sellers,
  stores,
  type OrderStatus,
} from "./db/schema";

export async function listDevices({ includeInactive = false } = {}) {
  return db
    .select()
    .from(devices)
    .where(includeInactive ? undefined : eq(devices.active, true))
    .orderBy(asc(devices.rank), asc(devices.name));
}

export async function getDevice(id: string) {
  const [d] = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
  return d ?? null;
}

export async function listArts({ includeInactive = false } = {}) {
  return db
    .select()
    .from(arts)
    .where(includeInactive ? undefined : eq(arts.active, true))
    .orderBy(asc(arts.category), asc(arts.name));
}

export async function getOrder(id: string) {
  const [o] = await db
    .select({ order: orders, storeName: stores.name, store: stores })
    .from(orders)
    .leftJoin(stores, eq(orders.storeId, stores.id))
    .where(eq(orders.id, id))
    .limit(1);
  return o ?? null;
}

export async function getOrderByCode(code: string) {
  const [o] = await db
    .select({ order: orders, storeName: stores.name, storePhone: stores.phone })
    .from(orders)
    .leftJoin(stores, eq(orders.storeId, stores.id))
    .where(eq(orders.code, code.toUpperCase()))
    .limit(1);
  return o ?? null;
}

export async function listStoreOrders(storeId: string | null, email: string) {
  return db
    .select()
    .from(orders)
    .where(storeId ? eq(orders.storeId, storeId) : eq(orders.createdBy, email))
    .orderBy(desc(orders.updatedAt))
    .limit(60);
}

export async function listProductionOrders(status?: OrderStatus | "ativos", pickupPointId?: string) {
  const where =
    !status || status === "ativos"
      ? inArray(orders.status, ["recebido", "em_producao", "pronto"])
      : eq(orders.status, status);
  return db
    .select({ order: orders, storeName: stores.name, pickupName: pickupPoints.name })
    .from(orders)
    .leftJoin(stores, eq(orders.storeId, stores.id))
    .leftJoin(pickupPoints, eq(orders.pickupPointId, pickupPoints.id))
    .where(
      and(
        where,
        status === "aguardando_cliente" ? undefined : sql`${orders.status} <> 'aguardando_cliente'`,
        pickupPointId ? eq(orders.pickupPointId, pickupPointId) : undefined,
      ),
    )
    // pedidos com prazo mais curto primeiro; sem prazo (antigos) no fim
    .orderBy(sql`${orders.dueAt} asc nulls last`, desc(orders.sentAt), desc(orders.updatedAt))
    .limit(200);
}

export async function listRevisions(orderId: string) {
  return db.select().from(orderRevisions).where(eq(orderRevisions.orderId, orderId)).orderBy(desc(orderRevisions.createdAt));
}

/** Último PIX (ou pagamento) de cada pedido da lista; chave = id do pedido. */
export async function latestPaymentsFor(orderIds: string[]) {
  if (orderIds.length === 0) return new Map<string, Payment>();
  const rows = await db.select().from(payments).where(inArray(payments.orderId, orderIds)).orderBy(desc(payments.createdAt));
  const out = new Map<string, Payment>();
  for (const r of rows) if (!out.has(r.orderId)) out.set(r.orderId, r);
  return out;
}

export async function listPayments(orderId: string) {
  return db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt));
}

export async function getPickupPoint(id: string | null) {
  if (!id) return null;
  const [p] = await db.select().from(pickupPoints).where(eq(pickupPoints.id, id)).limit(1);
  return p ?? null;
}

// ------------------------------------------------------------------ vendedores e redes

export async function listSellers() {
  return db
    .select({ seller: sellers, pickupName: pickupPoints.name })
    .from(sellers)
    .leftJoin(pickupPoints, eq(sellers.pickupPointId, pickupPoints.id))
    .orderBy(asc(sellers.name));
}

/** Lojas atendidas pelo vendedor: ligadas a ele ou a uma rede dele. */
async function sellerStoreIds(sellerId: string) {
  const rows = await db
    .select({ id: stores.id })
    .from(stores)
    .leftJoin(networks, eq(stores.networkId, networks.id))
    .where(or(eq(stores.sellerId, sellerId), eq(networks.sellerId, sellerId)));
  return rows.map((r) => r.id);
}

export async function listSellerStores(sellerId: string) {
  return db
    .select({ store: stores, networkName: networks.name })
    .from(stores)
    .leftJoin(networks, eq(stores.networkId, networks.id))
    .where(or(eq(stores.sellerId, sellerId), eq(networks.sellerId, sellerId)))
    .orderBy(asc(stores.name));
}

export async function listOrdersForStores(storeIds: string[], { includePreviews = false } = {}) {
  if (!storeIds.length) return [];
  return db
    .select({ order: orders, storeName: stores.name, pickupName: pickupPoints.name })
    .from(orders)
    .leftJoin(stores, eq(orders.storeId, stores.id))
    .leftJoin(pickupPoints, eq(orders.pickupPointId, pickupPoints.id))
    .where(
      and(
        inArray(orders.storeId, storeIds),
        includePreviews ? undefined : notInArray(orders.status, ["aguardando_cliente"]),
      ),
    )
    .orderBy(desc(orders.updatedAt))
    .limit(200);
}

export async function listSellerOrders(sellerId: string) {
  return listOrdersForStores(await sellerStoreIds(sellerId));
}

export async function listNetworks() {
  return db
    .select({ network: networks, sellerName: sellers.name })
    .from(networks)
    .leftJoin(sellers, eq(networks.sellerId, sellers.id))
    .orderBy(asc(networks.name));
}

export async function listNetworkStores(networkId: string) {
  return db.select().from(stores).where(eq(stores.networkId, networkId)).orderBy(asc(stores.name));
}

export async function countByStatus() {
  const rows = await db.select({ status: orders.status, n: count() }).from(orders).groupBy(orders.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<OrderStatus, number>>;
}

export async function listStoresWithMembers() {
  const [s, m] = await Promise.all([
    db.select().from(stores).orderBy(asc(stores.name)),
    db.select().from(members).orderBy(asc(members.email)),
  ]);
  return { stores: s, members: m };
}

// ------------------------------------------------------------------ uso por cadastro

/** Instante de N dias atrás, em ms. */
export function daysAgo(n: number) {
  return Date.now() - n * 864e5;
}

/** Gera bastante arte mas quase nada vira pedido: vale olhar de perto. */
export function isSuspicious(total: number, sent: number) {
  return total >= 10 && sent / total < 0.1;
}

/** Um cadastro por linha, com quantas artes gerou e quantas viraram pedido. */
export async function listMemberUsage() {
  const gen = db
    .select({
      email: artGenerations.email,
      total: count().as("total"),
      last7: sql<number>`count(*) filter (where ${artGenerations.createdAt} > now() - interval '7 days')`
        .mapWith(Number)
        .as("last7"),
      last30: sql<number>`count(*) filter (where ${artGenerations.createdAt} > now() - interval '30 days')`
        .mapWith(Number)
        .as("last30"),
      lastAt: max(artGenerations.createdAt).as("last_at"),
    })
    .from(artGenerations)
    .groupBy(artGenerations.email)
    .as("gen");

  const sent = db
    .select({ email: orders.createdBy, sent: count().as("sent") })
    .from(orders)
    .where(isNotNull(orders.sentAt))
    .groupBy(orders.createdBy)
    .as("sent");

  return db
    .select({
      member: members,
      store: stores,
      total: sql<number>`coalesce(${gen.total}, 0)`.mapWith(Number),
      last7: sql<number>`coalesce(${gen.last7}, 0)`.mapWith(Number),
      last30: sql<number>`coalesce(${gen.last30}, 0)`.mapWith(Number),
      lastAt: gen.lastAt,
      sent: sql<number>`coalesce(${sent.sent}, 0)`.mapWith(Number),
    })
    .from(members)
    .leftJoin(stores, eq(members.storeId, stores.id))
    .leftJoin(gen, eq(gen.email, members.email))
    .leftJoin(sent, eq(sent.email, members.email))
    .orderBy(desc(sql`coalesce(${gen.last30}, 0)`), desc(members.createdAt));
}

export async function getMemberWithStore(id: string) {
  const [row] = await db
    .select({ member: members, store: stores })
    .from(members)
    .leftJoin(stores, eq(members.storeId, stores.id))
    .where(eq(members.id, id))
    .limit(1);
  return row ?? null;
}

export async function listMemberGenerations(email: string) {
  return db
    .select({ gen: artGenerations, code: orders.code, status: orders.status })
    .from(artGenerations)
    .leftJoin(orders, eq(artGenerations.orderId, orders.id))
    .where(eq(artGenerations.email, email))
    .orderBy(desc(artGenerations.createdAt))
    .limit(300);
}
