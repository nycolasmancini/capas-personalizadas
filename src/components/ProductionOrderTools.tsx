"use client";

import { Banknote, History, RefreshCw, Replace, RotateCcw, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { markPaidManually, reactivateOrder, restoreRevision, applyArtFromOrder, syncOrderPayment } from "@/app/actions";
import type { OrderStatus } from "@/lib/db/schema";
import { Button, formatBRL, STATUS_INFO } from "./ui";

/** Pedido pago que a loja cancelou: a produção devolve para a fila. */
export function ReactivateButton({ id, paid }: { id: string; paid: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 rounded-tile bg-peach/70 p-3 text-sm">
      <p>
        {paid
          ? "Este pedido foi pago e depois cancelado pela loja. Se foi engano, reative: ele volta para a fila da produção."
          : "Pedido cancelado. Reativar devolve para “Aguardando pagamento”."}
      </p>
      <Button variant="outline" className="w-full" disabled={pending} onClick={() => start(() => reactivateOrder(id))}>
        <Undo2 size={16} /> {pending ? "Reativando…" : "Reativar pedido"}
      </Button>
    </div>
  );
}

export type ArtCandidate = {
  id: string;
  code: string;
  deviceName: string;
  customerName: string | null;
  previewUrl: string;
  status: OrderStatus;
  paid: boolean;
  createdAt: string;
};

/**
 * A loja pagou o pedido errado: a produção escolhe outro pedido da mesma loja
 * e a arte dele passa a valer neste pedido (vira uma versão no histórico).
 */
export function ArtFromOrderPicker({ orderId, candidates }: { orderId: string; candidates: ArtCandidate[] }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<ArtCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!candidates.length) return null;

  if (done) return <p className="rounded-tile bg-mint p-3 text-sm">{done}</p>;

  if (!open)
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Replace size={16} /> Usar a arte de outro pedido
      </Button>
    );

  if (chosen)
    return (
      <div className="animate-pop space-y-3 rounded-tile bg-butter p-3 text-sm">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={chosen.previewUrl} alt="" className="size-16 shrink-0 rounded-[10px] object-cover" />
          <p>
            Trocar a arte deste pedido pela do <b>#{chosen.code}</b> ({chosen.deviceName})?
            {!chosen.paid && ["aguardando_cliente", "aguardando_pagamento"].includes(chosen.status) && (
              <> O #{chosen.code} será cancelado para a loja não pagar duas vezes.</>
            )}
          </p>
        </div>
        {error && <p className="rounded-ctl bg-pink px-3 py-2 font-semibold text-danger">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => setChosen(null)} disabled={pending}>
            Voltar
          </Button>
          <Button
            variant="dark"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  const r = await applyArtFromOrder(orderId, chosen.id);
                  setDone(
                    r.sourceCancelled
                      ? `Arte do #${chosen.code} aplicada. O pedido #${chosen.code} foi cancelado.`
                      : `Arte do #${chosen.code} aplicada.`,
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              })
            }
          >
            {pending ? "Trocando…" : "Confirmar"}
          </Button>
        </div>
      </div>
    );

  return (
    <div className="animate-pop space-y-2 rounded-tile bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">Outros pedidos desta loja</p>
        <button onClick={() => setOpen(false)} className="text-xs font-semibold text-muted hover:text-ink">
          Fechar
        </button>
      </div>
      <div className="max-h-80 space-y-1.5 overflow-y-auto">
        {candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => setChosen(c)}
            className="flex w-full items-center gap-3 rounded-[12px] p-1.5 text-left transition hover:bg-blue-soft"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.previewUrl} alt="" className="size-14 shrink-0 rounded-[10px] bg-blue-soft object-cover" />
            <span className="min-w-0 flex-1 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="font-mono font-bold">#{c.code}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_INFO[c.status].tone}`}>
                  {STATUS_INFO[c.status].short}
                </span>
                {c.paid && <span className="rounded-full bg-mint px-2 py-0.5 text-[11px] font-semibold">pago</span>}
              </span>
              <span className="block truncate text-xs text-muted">
                {c.deviceName}
                {c.customerName ? ` · ${c.customerName}` : ""} ·{" "}
                {new Date(c.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const PIX_MSG: Record<string, string> = {
  approved: "PIX confirmado! O pedido entrou na fila da produção.",
  pending: "O Mercado Pago ainda não registrou este PIX como pago.",
  expired: "Este PIX venceu sem pagamento. A loja precisa gerar outro.",
  cancelled: "Este PIX foi cancelado no Mercado Pago.",
  rejected: "O Mercado Pago recusou este pagamento.",
};

/**
 * A produção pergunta ao Mercado Pago se o PIX do pedido já caiu — para quando o
 * aviso automático não chegou e a loja manda o comprovante.
 */
export function CheckPixButton({ orderId, compact = false }: { orderId: string; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const run = () =>
    start(async () => {
      const r = await syncOrderPayment(orderId);
      if (r.error) setMsg({ text: r.error, ok: false });
      else if (r.pix) setMsg({ text: PIX_MSG[r.pix] ?? r.pix, ok: r.pix === "approved" });
      else setMsg({ text: `Pedido já está em “${STATUS_INFO[r.status as OrderStatus]?.label ?? r.status}”.`, ok: true });
    });
  return (
    <div className={compact ? "flex flex-col items-end gap-1" : "space-y-2"}>
      <Button
        variant={compact ? "outline" : "dark"}
        className={compact ? "h-9 px-3 text-sm" : "w-full"}
        disabled={pending}
        onClick={run}
        title="Pergunta ao Mercado Pago se o PIX deste pedido já foi pago"
      >
        <RefreshCw size={16} className={pending ? "animate-spin" : undefined} />
        {pending ? "Conferindo…" : "Conferir PIX no Mercado Pago"}
      </Button>
      {msg && (
        <p className={`text-xs font-semibold ${msg.ok ? "text-green-700" : "text-danger"} ${compact ? "max-w-[220px] text-right" : ""}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

export function MarkPaidButton({ id, totalCents }: { id: string; totalCents: number | null }) {
  const [pending, start] = useTransition();
  const [sure, setSure] = useState(false);
  if (!sure)
    return (
      <Button variant="outline" className="w-full" onClick={() => setSure(true)}>
        <Banknote size={16} /> Recebi o pagamento por fora
      </Button>
    );
  return (
    <div className="animate-pop space-y-2 rounded-tile bg-butter p-3 text-sm">
      <p>
        Confirmar que {formatBRL(totalCents)} foi pago fora do PIX automático? O pedido entra na produção.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => setSure(false)} disabled={pending}>
          Voltar
        </Button>
        <Button variant="dark" disabled={pending} onClick={() => start(() => markPaidManually(id))}>
          {pending ? "Salvando…" : "Confirmar"}
        </Button>
      </div>
    </div>
  );
}

export type RevisionRow = {
  id: string;
  previewUrl: string;
  printUrl: string;
  editedBy: string;
  reason: string | null;
  isOriginal: boolean;
  createdAt: string;
  current: boolean;
};

/** Histórico de versões da arte com opção de voltar para uma anterior. */
export function RevisionList({ rows }: { rows: RevisionRow[] }) {
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-bold">
        <History size={16} /> Versões da arte
      </p>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 rounded-tile bg-card p-2.5">
          <a href={r.previewUrl} target="_blank" rel="noreferrer" className="size-14 shrink-0 overflow-hidden rounded-[10px] bg-blue-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.previewUrl} alt="" className="size-full object-cover" />
          </a>
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-semibold">
              {r.isOriginal ? "Original da loja" : r.reason || "Ajuste da produção"}
              {r.current && <span className="ml-1.5 rounded-full bg-mint px-2 py-0.5 text-[11px]">atual</span>}
            </p>
            <p className="truncate text-xs text-muted">
              {new Date(r.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })} ·{" "}
              {r.editedBy}
            </p>
          </div>
          {!r.current && (
            <button
              disabled={pending}
              onClick={() => {
                setBusyId(r.id);
                start(() => restoreRevision(r.id));
              }}
              className="grid size-9 shrink-0 place-items-center rounded-ctl text-muted hover:bg-sand hover:text-ink disabled:opacity-40"
              title="Voltar para esta versão"
              aria-label="Voltar para esta versão"
            >
              <RotateCcw size={16} className={pending && busyId === r.id ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
