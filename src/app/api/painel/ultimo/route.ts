import { desc, isNotNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";

export async function GET() {
  const s = await getSession();
  if (!s || typeof s === "string" || s.member.role !== "admin") {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  const [row] = await db
    .select({ sentAt: orders.sentAt, code: orders.code })
    .from(orders)
    .where(isNotNull(orders.sentAt))
    .orderBy(desc(orders.sentAt))
    .limit(1);
  return Response.json({ latest: row?.sentAt?.toISOString() ?? null, code: row?.code ?? null });
}
