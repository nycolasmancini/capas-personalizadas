"use client";

import { useTransition } from "react";
import { setOrderStatus } from "@/app/actions";
import type { OrderStatus } from "@/lib/db/schema";
import { STATUS_INFO } from "./ui";

const FLOW: OrderStatus[] = ["recebido", "em_producao", "pronto", "retirado", "cancelado"];

export function StatusSelect({ id, status }: { id: string; status: OrderStatus }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => start(() => setOrderStatus(id, e.target.value as OrderStatus))}
      className="h-10 rounded-ctl border-[1.5px] border-line bg-white px-2 text-sm font-semibold outline-none focus:border-blue disabled:opacity-50"
    >
      {(FLOW.includes(status) ? FLOW : [status, ...FLOW]).map((s) => (
        <option key={s} value={s}>
          {STATUS_INFO[s].label}
        </option>
      ))}
    </select>
  );
}

export function NextStepButton({ id, status }: { id: string; status: OrderStatus }) {
  const [pending, start] = useTransition();
  const next: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
    recebido: { to: "em_producao", label: "Iniciar produção" },
    em_producao: { to: "pronto", label: "Marcar como pronto" },
    pronto: { to: "retirado", label: "Marcar como retirado" },
  };
  const n = next[status];
  if (!n) return null;
  return (
    <button
      disabled={pending}
      onClick={() => start(() => setOrderStatus(id, n.to))}
      className="h-12 w-full rounded-ctl bg-blue text-base font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "Atualizando…" : n.label}
    </button>
  );
}
