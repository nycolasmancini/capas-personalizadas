"use client";

import { Check, Download, Link2, Pencil, Send, Share2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { approveOrder, cancelOrder } from "@/app/actions";
import type { Billing, OrderStatus, PickupPoint } from "@/lib/db/schema";
import { PickupCard } from "./PickupCard";
import { Button, cn, formatBRL } from "./ui";

/** Condições da loja para aprovar: unidade de retirada (do vendedor) ou opções, e forma de pagamento. */
export type ApproveTerms = {
  billing: Billing;
  pickup: PickupPoint | null;
  points: PickupPoint[];
  quantity: number;
  paid: boolean;
  /** conta admin: aprova sem pagamento, para testes */
  test?: boolean;
};

export function OrderActions({
  id,
  code,
  status,
  previewUrl,
  customerName,
  terms,
}: {
  id: string;
  code: string;
  status: OrderStatus;
  previewUrl: string;
  customerName: string | null;
  terms: ApproveTerms;
}) {
  const [confirming, setConfirming] = useState<"send" | "cancel" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${code}` : `/p/${code}`;
  const message = `${customerName ? `Oi, ${customerName}! ` : "Oi! "}Olha como ficou a prévia da sua capa 😍 Me confirma se podemos produzir: ${publicUrl}`;

  function flash(t: string) {
    setToast(t);
    setTimeout(() => setToast(null), 2200);
  }

  async function share() {
    try {
      const blob = await (await fetch(previewUrl)).blob();
      const file = new File([blob], `capa-${code}.jpg`, { type: blob.type || "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message });
        return;
      }
      if (navigator.share) {
        await navigator.share({ text: message, url: publicUrl });
        return;
      }
      await navigator.clipboard.writeText(message);
      flash("Mensagem copiada");
    } catch (e) {
      if ((e as Error).name !== "AbortError") flash("Não foi possível compartilhar");
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    flash("Link copiado");
  }

  if (status === "aguardando_cliente") {
    return (
      <div className="space-y-2">
        <Button onClick={share} className="h-12 w-full text-base">
          <Share2 size={18} /> Mostrar ao cliente
        </Button>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={copyLink} className="px-2 text-sm">
            <Link2 size={16} /> Link
          </Button>
          <a
            href={previewUrl}
            download={`capa-${code}.jpg`}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-ctl border-[1.5px] border-ink text-sm font-semibold hover:bg-ink hover:text-white"
          >
            <Download size={16} /> Imagem
          </a>
          <Link
            href={`/loja/editor?pedido=${id}`}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-ctl border-[1.5px] border-ink text-sm font-semibold hover:bg-ink hover:text-white"
          >
            <Pencil size={16} /> Editar
          </Link>
        </div>

        <div className="pt-3">
          {confirming === "send" ? (
            <ApproveBox id={id} terms={terms} onBack={() => setConfirming(null)} />
          ) : (
            <Button variant="dark" onClick={() => setConfirming("send")} className="h-12 w-full text-base">
              <Send size={18} /> Cliente aprovou
            </Button>
          )}
        </div>
        <CancelBlock id={id} confirming={confirming} setConfirming={setConfirming} />
        {toast && <Toast>{toast}</Toast>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={share}>
          <Share2 size={16} /> Compartilhar
        </Button>
        <Button variant="outline" onClick={copyLink}>
          <Link2 size={16} /> Link
        </Button>
      </div>
      {(status === "recebido" || status === "aguardando_pagamento") && (
        <CancelBlock id={id} confirming={confirming} setConfirming={setConfirming} />
      )}
      {toast && <Toast>{toast}</Toast>}
    </div>
  );
}

function ApproveBox({ id, terms, onBack }: { id: string; terms: ApproveTerms; onBack: () => void }) {
  const [pending, start] = useTransition();
  const [pointId, setPointId] = useState(terms.pickup?.id ?? (terms.points.length === 1 ? terms.points[0].id : ""));
  const [error, setError] = useState<string | null>(null);
  const point = terms.pickup ?? terms.points.find((p) => p.id === pointId) ?? null;
  const payNow = terms.billing === "pix" && !terms.paid && !terms.test;
  const total = point ? point.priceCents * terms.quantity : null;

  function confirm() {
    setError(null);
    start(async () => {
      try {
        const r = await approveOrder(id, pointId);
        if (r?.error) setError(r.error);
      } catch {
        setError("Não foi possível aprovar. Tente de novo.");
      }
    });
  }

  return (
    <div className="animate-pop space-y-3 rounded-tile bg-mint p-4">
      <div>
        <p className="font-semibold">O cliente aprovou a prévia?</p>
        <p className="text-sm text-muted">Depois de aprovada, a arte não pode mais ser alterada pela loja.</p>
      </div>

      {terms.pickup ? (
        <PickupCard point={terms.pickup} faturado={!payNow} />
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Onde você vai retirar?</p>
          {terms.points.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer gap-3 rounded-tile border-[1.5px] bg-card p-3 text-sm transition",
                pointId === p.id ? "border-blue" : "border-transparent",
              )}
            >
              <input
                type="radio"
                name="pickup"
                checked={pointId === p.id}
                onChange={() => setPointId(p.id)}
                className="mt-1 size-4 accent-blue"
              />
              <span className="min-w-0 flex-1">
                <span className="flex justify-between gap-2 font-semibold">
                  {p.name}
                  {payNow && <span>{formatBRL(p.priceCents)}/un.</span>}
                </span>
                <span className="block text-muted">{p.address}</span>
                <span className="block text-muted">
                  Pronto em até {p.leadDays} dia{p.leadDays === 1 ? "" : "s"} úte{p.leadDays === 1 ? "il" : "is"}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      {payNow && point && (
        <p className="flex items-baseline justify-between rounded-ctl bg-card px-3 py-2 text-sm">
          <span>
            {terms.quantity} × {formatBRL(point.priceCents)}
          </span>
          <span className="text-lg font-bold">{formatBRL(total)}</span>
        </p>
      )}
      {!payNow && (
        <p className="text-sm text-muted">
          {terms.test
            ? "Teste (conta admin): sem pagamento, entra direto na produção."
            : terms.paid
              ? "Este pedido já está pago."
              : "Pagamento faturado: entra no fechamento da sua rede."}
        </p>
      )}
      {error && <p className="rounded-ctl bg-pink px-3 py-2 text-sm font-semibold text-danger">{error}</p>}

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button variant="ghost" onClick={onBack} disabled={pending}>
          Voltar
        </Button>
        <Button variant="dark" disabled={pending || !point} onClick={confirm}>
          <Check size={18} />
          {pending ? "Aguarde…" : payNow ? "Aprovar e pagar com PIX" : "Aprovar e enviar"}
        </Button>
      </div>
    </div>
  );
}

function CancelBlock({
  id,
  confirming,
  setConfirming,
}: {
  id: string;
  confirming: "send" | "cancel" | null;
  setConfirming: (v: "send" | "cancel" | null) => void;
}) {
  const [pending, start] = useTransition();
  if (confirming === "cancel")
    return (
      <div className="animate-pop flex items-center justify-between gap-2 rounded-tile bg-sand p-3 text-sm">
        <span className="font-semibold">Cancelar este pedido?</span>
        <span className="flex gap-2">
          <Button variant="ghost" className="h-9" onClick={() => setConfirming(null)}>
            Não
          </Button>
          <Button variant="danger" className="h-9" disabled={pending} onClick={() => start(() => cancelOrder(id))}>
            Cancelar pedido
          </Button>
        </span>
      </div>
    );
  return (
    <button onClick={() => setConfirming("cancel")} className="mx-auto flex items-center gap-1 pt-1 text-sm font-semibold text-muted hover:text-danger">
      <X size={14} /> Cancelar pedido
    </button>
  );
}

function Toast({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <p className="animate-pop rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-lg">{children}</p>
    </div>
  );
}
