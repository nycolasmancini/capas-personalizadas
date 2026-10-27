"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const LINKS = [
  { href: "/painel", label: "Pedidos" },
  { href: "/painel/usuarios", label: "Cadastros e uso" },
  { href: "/painel/lojas", label: "Lojas e acessos" },
  { href: "/painel/vendedores", label: "Vendedores" },
  { href: "/painel/redes", label: "Redes" },
  { href: "/painel/unidades", label: "Unidades e preços" },
  { href: "/painel/faturamento", label: "A faturar" },
  { href: "/painel/aparelhos", label: "Aparelhos" },
  { href: "/painel/artes", label: "Artes prontas" },
];

export function PanelNav() {
  const path = usePathname();
  return (
    <nav className="scrollbar-none mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
      {LINKS.map((l) => {
        const active = l.href === "/painel" ? path === "/painel" || path.startsWith("/painel/pedidos") : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "shrink-0 border-b-[3px] px-3 pb-2.5 pt-1 text-sm font-semibold transition",
              active ? "border-blue text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
