import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { requireStoreUser } from "@/lib/auth";

export default async function LojaLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStoreUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/loja">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-sm leading-tight sm:block">
              <span className="block font-semibold">{s.store?.name ?? "Produção"}</span>
              <span className="block text-xs text-muted">{s.email}</span>
            </span>
            {s.member.role === "admin" && (
              <Link href="/painel" className="rounded-ctl bg-sand px-3 py-2 text-sm font-semibold">
                Painel
              </Link>
            )}
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">{children}</main>
    </div>
  );
}
