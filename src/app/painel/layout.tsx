import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { LiveOrders } from "@/components/LiveOrders";
import { PanelNav } from "@/components/PanelNav";
import { Logo } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: { default: "Painel", template: "%s · Painel" } };

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link href="/painel" className="shrink-0">
            <Logo />
          </Link>
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-white">Produção</span>
          <div className="ml-auto flex items-center gap-3">
            <LiveOrders />
            <Link href="/loja" className="hidden rounded-ctl bg-sand px-3 py-2 text-sm font-semibold sm:block">
              Abrir editor
            </Link>
            <UserButton />
          </div>
        </div>
        <PanelNav />
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-6">{children}</main>
    </div>
  );
}
