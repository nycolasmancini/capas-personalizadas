import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { members, networks, sellers, stores, type Member, type Network, type Seller, type Store } from "./db/schema";

/**
 * `email` é o login da pessoa: e-mail Google ou, nas lojas de rede, o nome de usuário.
 * `network` é a rede da loja (lojista) ou a rede que o gestor acompanha.
 */
export type Session = { member: Member; store: Store | null; email: string; network: Network | null; seller: Seller | null };

function bootstrapAdmins() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Lê o usuário do Google (via Clerk) e procura o cadastro dele.
 * - sem cadastro → "new" (precisa preencher loja, cidade e WhatsApp em /cadastro);
 * - cadastro ou loja desativados pela produção → "blocked".
 * E-mails em ADMIN_EMAILS viram administradores no primeiro acesso.
 */
export const getSession = cache(async (): Promise<Session | null | "blocked" | "new"> => {
  const user = await currentUser();
  if (!user) return null;
  const email = (user.primaryEmailAddress?.emailAddress ?? user.username)?.toLowerCase();
  if (!email) return "blocked";

  let [member] = await db.select().from(members).where(eq(members.email, email)).limit(1);

  if (!member && bootstrapAdmins().includes(email)) {
    [member] = await db
      .insert(members)
      .values({ id: crypto.randomUUID(), email, name: user.fullName, role: "admin" })
      .returning();
  }
  if (!member) return "new";
  if (!member.active) return "blocked";

  if (!member.name && user.fullName) {
    await db.update(members).set({ name: user.fullName }).where(eq(members.id, member.id));
    member = { ...member, name: user.fullName };
  }

  const store = member.storeId
    ? ((await db.select().from(stores).where(eq(stores.id, member.storeId)).limit(1))[0] ?? null)
    : null;
  if (member.role === "lojista" && (!store || !store.active)) return "blocked";

  const networkId = member.role === "gestor" ? member.networkId : store?.networkId;
  const network = networkId
    ? ((await db.select().from(networks).where(eq(networks.id, networkId)).limit(1))[0] ?? null)
    : null;
  if (member.role === "gestor" && !network) return "blocked";

  const seller = member.sellerId
    ? ((await db.select().from(sellers).where(eq(sellers.id, member.sellerId)).limit(1))[0] ?? null)
    : null;
  if (member.role === "vendedor" && (!seller || !seller.active)) return "blocked";

  return { member, store, email, network, seller };
});

/** Página inicial de cada tipo de acesso. */
export function homeFor(role: Member["role"]) {
  return { admin: "/painel", lojista: "/loja", vendedor: "/vendedor", gestor: "/rede" }[role];
}

export async function requireSession() {
  const s = await getSession();
  if (s === null) redirect("/entrar");
  if (s === "blocked") redirect("/sem-acesso");
  if (s === "new") redirect("/cadastro");
  return s;
}

export async function requireAdmin() {
  const s = await requireSession();
  if (s.member.role !== "admin") redirect(homeFor(s.member.role));
  return s;
}

/** Área de montar capas: lojistas e a produção. */
export async function requireStoreUser() {
  const s = await requireSession();
  if (s.member.role !== "admin" && s.member.role !== "lojista") redirect(homeFor(s.member.role));
  return s;
}

export async function requireSeller() {
  const s = await requireSession();
  if (s.member.role !== "vendedor" || !s.seller) redirect(homeFor(s.member.role));
  return { ...s, seller: s.seller };
}

export async function requireNetworkManager() {
  const s = await requireSession();
  if (s.member.role !== "gestor" || !s.network) redirect(homeFor(s.member.role));
  return { ...s, network: s.network };
}
