import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { Design } from "../design";
import type { DeviceGeometry, DeviceMockup } from "../devices/types";

/** Unidades onde a loja retira as capas (São Paulo, Limeira). Cada uma tem preço e prazo próprios. */
export const pickupPoints = pgTable("pickup_points", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  hours: text("hours"),
  mapsUrl: text("maps_url"),
  /** prazo máximo em dias úteis, contado a partir do pagamento */
  leadDays: integer("lead_days").notNull().default(3),
  /** preço por capa, em centavos */
  priceCents: integer("price_cents").notNull(),
  rank: integer("rank").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const sellers = pgTable("sellers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** parte final do link personalizado: /v/{slug} */
  slug: text("slug").notNull().unique(),
  phone: text("phone"),
  pickupPointId: text("pickup_point_id").references(() => pickupPoints.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const BILLING = ["pix", "faturado"] as const;
export type Billing = (typeof BILLING)[number];

/** Redes com várias lojas (ex.: Beep). Cada loja entra com usuário e senha; o gestor vê todas. */
export const networks = pgTable("networks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sellerId: text("seller_id").references(() => sellers.id, { onDelete: "set null" }),
  billing: text("billing", { enum: BILLING }).notNull().default("faturado"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stores = pgTable("stores", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city"),
  phone: text("phone"),
  /** vendedor da loja; lojas de uma rede usam o vendedor da rede */
  sellerId: text("seller_id").references(() => sellers.id, { onDelete: "set null" }),
  networkId: text("network_id").references(() => networks.id, { onDelete: "set null" }),
  /** lojas de uma rede usam a forma de pagamento da rede */
  billing: text("billing", { enum: BILLING }).notNull().default("pix"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ROLES = ["admin", "lojista", "vendedor", "gestor"] as const;
export type Role = (typeof ROLES)[number];

export const members = pgTable("members", {
  id: text("id").primaryKey(),
  /** e-mail Google ou, nas lojas de rede, o nome de usuário (login com usuário e senha) */
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role", { enum: ROLES }).notNull().default("lojista"),
  storeId: text("store_id").references(() => stores.id, { onDelete: "set null" }),
  sellerId: text("seller_id").references(() => sellers.id, { onDelete: "set null" }),
  networkId: text("network_id").references(() => networks.id, { onDelete: "set null" }),
  /** conta criada pela produção no Clerk (usuário e senha) */
  clerkUserId: text("clerk_user_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Ajustes gerais editáveis no painel (chave → valor). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
  brand: text("brand").notNull(),
  name: text("name").notNull(),
  rank: integer("rank").notNull().default(999),
  geometry: jsonb("geometry").$type<DeviceGeometry>().notNull(),
  mockup: jsonb("mockup").$type<DeviceMockup>(),
  active: boolean("active").notNull().default(true),
  verified: boolean("verified").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const arts = pgTable("arts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  url: text("url").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ORDER_STATUSES = [
  "aguardando_cliente",
  "aguardando_pagamento",
  "recebido",
  "em_producao",
  "pronto",
  "retirado",
  "cancelado",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  storeId: text("store_id").references(() => stores.id, { onDelete: "set null" }),
  createdBy: text("created_by").notNull(),
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name").notNull(),
  phoneColor: text("phone_color").notNull(),
  customerName: text("customer_name"),
  notes: text("notes"),
  quantity: integer("quantity").notNull().default(1),
  design: jsonb("design").$type<Design>().notNull(),
  previewUrl: text("preview_url").notNull(),
  printUrl: text("print_url").notNull(),
  whiteUrl: text("white_url").notNull(),
  /** pedidos antigos; a Mimaki imprime por cima da câmera, então não geramos mais */
  cutUrl: text("cut_url"),
  status: text("status", { enum: ORDER_STATUSES }).notNull().default("aguardando_cliente"),
  pickupPointId: text("pickup_point_id").references(() => pickupPoints.id, { onDelete: "set null" }),
  billing: text("billing", { enum: BILLING }),
  unitPriceCents: integer("unit_price_cents"),
  totalCents: integer("total_cents"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  /** data limite de retirada, definida quando o pedido entra na produção */
  dueAt: timestamp("due_at", { withTimezone: true }),
  /** a produção ajustou a arte e pediu que o cliente aprove de novo */
  needsReapproval: boolean("needs_reapproval").notNull().default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Cada vez que alguém conclui uma arte no editor (nova ou edição de uma
 * prévia) fica um registro aqui, mesmo que o pedido depois seja alterado ou
 * cancelado. Serve para a produção acompanhar o uso por cadastro.
 */
export const artGenerations = pgTable("art_generations", {
  id: text("id").primaryKey(),
  memberId: text("member_id").references(() => members.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  storeId: text("store_id").references(() => stores.id, { onDelete: "set null" }),
  orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
  deviceName: text("device_name").notNull(),
  customerName: text("customer_name"),
  previewUrl: text("preview_url").notNull(),
  printUrl: text("print_url").notNull(),
  isEdit: boolean("is_edit").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Cada versão da arte ajustada pela produção (a original entra como primeira versão). */
export const orderRevisions = pgTable("order_revisions", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  design: jsonb("design").$type<Design>().notNull(),
  previewUrl: text("preview_url").notNull(),
  printUrl: text("print_url").notNull(),
  whiteUrl: text("white_url").notNull(),
  editedBy: text("edited_by").notNull(),
  reason: text("reason"),
  isOriginal: boolean("is_original").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const PAYMENT_STATUSES = ["pending", "approved", "rejected", "cancelled", "expired", "manual"] as const;

/** Cobranças PIX no Mercado Pago (uma por tentativa; o QR expira). */
export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  mpPaymentId: text("mp_payment_id").unique(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status", { enum: PAYMENT_STATUSES }).notNull().default("pending"),
  qrCode: text("qr_code"),
  qrCodeBase64: text("qr_code_base64"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PickupPoint = typeof pickupPoints.$inferSelect;
export type Seller = typeof sellers.$inferSelect;
export type Network = typeof networks.$inferSelect;
export type OrderRevision = typeof orderRevisions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Art = typeof arts.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type ArtGeneration = typeof artGenerations.$inferSelect;
