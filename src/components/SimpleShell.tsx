import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Logo } from "./ui";

/** Cabeçalho das áreas só de acompanhamento (vendedor e gestor de rede). */
export function SimpleShell({ href, title, subtitle, children }: { href: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href={href}>
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-right text-sm leading-tight">
              <span className="block font-semibold">{title}</span>
              <span className="block text-xs text-muted">{subtitle}</span>
            </span>
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">{children}</main>
    </div>
  );
}
