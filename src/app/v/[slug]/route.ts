import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sellers } from "@/lib/db/schema";

// Link personalizado do vendedor: guarda quem indicou e leva para o login.
// No cadastro, a loja nova fica ligada a esse vendedor.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [seller] = await db
    .select({ slug: sellers.slug })
    .from(sellers)
    .where(and(eq(sellers.slug, slug.toLowerCase()), eq(sellers.active, true)))
    .limit(1);
  const res = NextResponse.redirect(new URL("/entrar", req.url));
  if (seller) {
    res.cookies.set("vendedor", seller.slug, { maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: "lax", path: "/" });
  }
  return res;
}
