import { SignIn } from "@clerk/nextjs";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { db } from "@/lib/db";
import { sellers } from "@/lib/db/schema";

export const metadata = { title: "Entrar" };

export default async function EntrarPage() {
  const slug = (await cookies()).get("vendedor")?.value;
  const [seller] = slug
    ? await db
        .select({ name: sellers.name })
        .from(sellers)
        .where(and(eq(sellers.slug, slug), eq(sellers.active, true)))
        .limit(1)
    : [];
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <Link href="/">
        <Logo />
      </Link>
      {seller && (
        <p className="rounded-full bg-blue-soft px-4 py-2 text-sm font-semibold">Convite de {seller.name}</p>
      )}
      <SignIn
        path="/entrar"
        routing="path"
        fallbackRedirectUrl="/inicio"
        signUpFallbackRedirectUrl="/cadastro"
        withSignUp
        appearance={{ elements: { footer: { display: "none" }, header: { display: "none" } } }}
      />
      <p className="max-w-xs text-center text-sm text-muted">
        Primeira vez? Entre com sua conta Google e, em seguida, informe o nome da sua loja, a cidade e o
        WhatsApp. Lojas de rede entram com o usuário e a senha recebidos.
      </p>
    </main>
  );
}
