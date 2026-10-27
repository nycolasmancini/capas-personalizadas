import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import type { OrderStatus } from "@/lib/db/schema";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Logo({ sub = true, className }: { sub?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className="font-display text-[22px] leading-none tracking-tight">
        {BRAND.name}
        <span className="text-blue">.</span>
      </span>
      {sub && <span className="hidden text-sm font-medium text-muted sm:inline">{BRAND.product}</span>}
    </span>
  );
}

type Variant = "primary" | "dark" | "outline" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-blue text-white hover:bg-blue-deep",
  dark: "bg-ink text-white hover:bg-black",
  outline: "border-[1.5px] border-ink bg-transparent text-ink hover:bg-ink hover:text-white",
  ghost: "bg-transparent text-ink hover:bg-sand",
  danger: "border-[1.5px] border-danger text-danger hover:bg-danger hover:text-white",
};

export const focusRing =
  "outline-none focus-visible:ring-[3px] focus-visible:ring-blue/35 focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

const base = cn(
  "inline-flex items-center justify-center gap-2 rounded-ctl px-4 h-11 text-[15px] font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none select-none",
  focusRing,
);

export function Button({
  variant = "primary",
  className,
  ...p
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cn(base, variants[variant], className)} {...p} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...p
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cn(base, variants[variant], className)} {...p} />;
}

export function Tile({
  tone = "card",
  className,
  children,
}: {
  tone?: "card" | "pink" | "butter" | "mint" | "peach" | "blue" | "sand";
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    card: "bg-card",
    pink: "bg-pink",
    butter: "bg-butter",
    mint: "bg-mint",
    peach: "bg-peach",
    blue: "bg-blue-soft",
    sand: "bg-sand",
  };
  return <div className={cn("rounded-tile", tones[tone], className)}>{children}</div>;
}

export const STATUS_INFO: Record<
  OrderStatus,
  { label: string; short: string; tone: string; hint: string; next: string }
> = {
  aguardando_cliente: {
    label: "Aguardando cliente",
    short: "Prévia",
    tone: "bg-butter text-ink",
    hint: "A prévia está pronta.",
    next: "Mostre ao cliente e, quando ele aprovar, toque em “Cliente aprovou”.",
  },
  aguardando_pagamento: {
    label: "Aguardando pagamento",
    short: "Pagamento",
    tone: "bg-pink text-ink",
    hint: "O cliente aprovou.",
    next: "Pague o PIX para o pedido entrar na fila de produção.",
  },
  recebido: {
    label: "Recebido",
    short: "Recebido",
    tone: "bg-blue-soft text-blue-deep",
    hint: "A produção recebeu o pedido.",
    next: "Ele entra na impressão em seguida. Você acompanha por aqui.",
  },
  em_producao: {
    label: "Em produção",
    short: "Produção",
    tone: "bg-peach text-ink",
    hint: "A capa está sendo impressa.",
    next: "Avisamos aqui quando ficar pronta para retirar.",
  },
  pronto: {
    label: "Pronto para retirar",
    short: "Pronta",
    tone: "bg-mint text-ink",
    hint: "A capa está pronta!",
    next: "Retire na unidade indicada abaixo.",
  },
  retirado: { label: "Retirado", short: "Retirada", tone: "bg-ink text-white", hint: "Capa retirada pela loja.", next: "" },
  cancelado: {
    label: "Cancelado",
    short: "Cancelado",
    tone: "bg-sand text-muted line-through",
    hint: "Pedido cancelado.",
    next: "",
  },
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const s = STATUS_INFO[status];
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold", s.tone, className)}>
      {s.label}
    </span>
  );
}

/** Linha do tempo horizontal do pedido: etapas concluídas em azul, a atual em destaque. */
export function StatusStepper({ steps, current }: { steps: readonly OrderStatus[]; current: OrderStatus }) {
  const idx = steps.indexOf(current);
  return (
    <ol className="flex items-start" aria-label="Etapas do pedido">
      {steps.map((st, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={st} className="relative flex min-w-0 flex-1 flex-col items-center">
            {i > 0 && (
              <span
                aria-hidden
                className={cn("absolute left-0 right-1/2 top-3 h-[2px] -translate-y-1/2", done || active ? "bg-blue" : "bg-line")}
              />
            )}
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn("absolute left-1/2 right-0 top-3 h-[2px] -translate-y-1/2", done ? "bg-blue" : "bg-line")}
              />
            )}
            <span
              className={cn(
                "relative z-10 grid size-6 place-items-center rounded-full text-[11px] font-bold transition",
                done && "bg-blue text-white",
                active && "bg-blue text-white ring-4 ring-blue/20",
                !done && !active && "bg-card text-muted ring-[1.5px] ring-line",
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={cn(
                "mt-1.5 w-full truncate px-0.5 text-center text-[11px] leading-tight",
                active ? "font-bold text-ink" : done ? "font-semibold text-ink/70" : "text-muted",
              )}
            >
              {STATUS_INFO[st].short}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Empty({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-tile border-[1.5px] border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-sand text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Bloco cinza pulsando enquanto a página carrega. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-tile bg-sand", className)} />;
}

/** Título de página com subtítulo e ação opcional à direita. */
export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm text-muted">{eyebrow}</p>}
        <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full h-11 rounded-ctl border-[1.5px] border-line bg-white px-3 text-[16px] sm:text-[15px] outline-none transition focus:border-blue focus:ring-[3px] focus:ring-blue/15";

export function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(d));
}

export function formatBRL(cents: number | null | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** "qui., 30/10" */
export function formatDay(d: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(d));
}

/** "5511987654321" → "(11) 98765-4321". */
export function formatWhatsapp(digits: string | null) {
  if (!digits) return "—";
  const d = digits.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}

export function whatsappLink(digits: string | null) {
  const d = digits?.replace(/\D/g, "");
  if (!d) return null;
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`;
}
