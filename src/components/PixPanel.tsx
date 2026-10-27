"use client";

import { Check, Copy, Loader2, QrCode, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { checkPayment, newPix } from "@/app/actions";
import { Button, cn, formatBRL } from "./ui";

type Pix = { qrCode: string | null; qrCodeBase64: string | null; expiresAt: string | null; status: string } | null;
type Outcome = "approved" | "expired" | "rejected";

/** Tempo da animação de aprovado antes de a página mostrar o pedido "Recebido". */
const CELEBRATE_MS = 3200;

function outcomeOf(status: string | null | undefined): Outcome | null {
  if (status === "approved") return "approved";
  if (status === "expired") return "expired";
  if (status === "rejected" || status === "cancelled") return "rejected";
  return null;
}

/**
 * QR Code e copia-e-cola do PIX. Pergunta ao servidor a cada 4 s se o pagamento
 * caiu; quando muda (pago, recusado, vencido), mostra a animação do novo status.
 * Use com `key` = id do pagamento, para recomeçar do zero a cada PIX novo.
 */
export function PixPanel({ orderId, totalCents, pix, configured }: { orderId: string; totalCents: number | null; pix: Pix; configured: boolean }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<Outcome | null>(() => outcomeOf(pix?.status));
  // anima só o que mudou com a tela aberta; status já resolvido ao abrir aparece parado
  const [animate, setAnimate] = useState(false);
  const lastCheck = useRef(false);

  const expiresAt = pix?.expiresAt ? new Date(pix.expiresAt).getTime() : 0;
  const live = !outcome && pix?.status === "pending" && expiresAt > now;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function settle(next: Outcome) {
    setAnimate(true);
    setOutcome(next);
    if (next === "approved") setTimeout(() => router.refresh(), CELEBRATE_MS);
  }

  useEffect(() => {
    if (!live) return;
    let stop = false;
    const t = setInterval(async () => {
      try {
        const r = await checkPayment(orderId);
        const next = r.paid ? "approved" : outcomeOf(r.pix);
        if (!stop && next) settle(next);
      } catch {}
    }, 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, orderId]);

  // venceu na tela: confere uma última vez (pode ter sido pago no último segundo)
  useEffect(() => {
    if (outcome || pix?.status !== "pending" || !expiresAt || expiresAt > now || lastCheck.current) return;
    lastCheck.current = true;
    checkPayment(orderId)
      .then((r) => settle(r.paid ? "approved" : "expired"))
      .catch(() => settle("expired"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, outcome, pix?.status, expiresAt, orderId]);

  function generate() {
    setError(null);
    start(async () => {
      const r = await newPix(orderId).catch(() => ({ error: "Não foi possível gerar o PIX." }));
      if (r?.error) setError(r.error);
      router.refresh();
    });
  }

  if (!configured) {
    return (
      <div className="rounded-tile bg-butter p-4 text-sm">
        <p className="font-semibold">Pagamento PIX em configuração</p>
        <p className="text-muted">A produção vai confirmar o pagamento de {formatBRL(totalCents)} com você.</p>
      </div>
    );
  }

  if (outcome === "approved") {
    return (
      <div className="animate-pop rounded-tile bg-mint p-6 text-center" role="status" aria-live="polite">
        <PixSeal kind="approved" animate={animate} />
        <div className={cn("mt-4 space-y-1", animate && "animate-rise")}>
          <p className="text-xl font-bold">Pagamento confirmado!</p>
          <p className="text-sm text-muted">
            {formatBRL(totalCents)} recebidos. O pedido já entrou na fila de produção.
          </p>
        </div>
      </div>
    );
  }

  if (outcome) {
    const expired = outcome === "expired";
    return (
      <div
        className={cn("animate-pop rounded-tile p-6 text-center", expired ? "bg-butter" : "bg-pink")}
        role="status"
        aria-live="polite"
      >
        <PixSeal kind={outcome} animate={animate} />
        <div className={cn("mt-4 space-y-1", animate && "animate-rise")}>
          <p className="text-xl font-bold">{expired ? "O PIX venceu" : "Pagamento não aprovado"}</p>
          <p className="text-sm text-muted">
            {expired
              ? "O código ficou 30 minutos sem pagamento. Gere um novo para continuar."
              : "O PIX foi recusado ou cancelado e nada foi cobrado. Gere um novo para tentar de novo."}
          </p>
        </div>
        <Button className={cn("mt-4 w-full", animate && "animate-rise")} onClick={generate} disabled={pending}>
          <RefreshCw size={16} className={pending ? "animate-spin" : ""} /> {pending ? "Gerando…" : "Gerar novo PIX"}
        </Button>
        {error && <p className="mt-3 rounded-ctl bg-card px-3 py-2 text-sm font-semibold text-danger">{error}</p>}
      </div>
    );
  }

  const left = Math.max(0, Math.floor((expiresAt - now) / 1000));
  return (
    <div className="space-y-3 rounded-tile bg-card p-4">
      <div className="flex items-baseline justify-between">
        <p className="flex items-center gap-2 font-semibold">
          <QrCode size={18} className="text-blue" /> Pague com PIX
        </p>
        <p className="text-xl font-bold">{formatBRL(totalCents)}</p>
      </div>

      {live && pix?.qrCodeBase64 ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${pix.qrCodeBase64}`} alt="QR Code PIX" className="mx-auto size-56 rounded-ctl bg-white p-2" />
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await navigator.clipboard.writeText(pix.qrCode ?? "");
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Código copiado" : "Copiar código PIX"}
          </Button>
          <p className="flex items-center justify-center gap-2 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" /> Aguardando pagamento · vence em {Math.floor(left / 60)}:
            {String(left % 60).padStart(2, "0")}
          </p>
        </>
      ) : pix?.status === "pending" ? (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Conferindo o pagamento…
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">Gere o PIX para enviar o pedido à produção.</p>
          <Button className="w-full" onClick={generate} disabled={pending}>
            <RefreshCw size={16} className={pending ? "animate-spin" : ""} /> {pending ? "Gerando…" : "Gerar PIX"}
          </Button>
        </>
      )}
      {error && <p className="rounded-ctl bg-pink px-3 py-2 text-sm font-semibold text-danger">{error}</p>}
      <p className="text-xs text-muted">O pedido entra na produção assim que o pagamento for confirmado.</p>
    </div>
  );
}

/** Selo do resultado: círculo que surge, ícone que se desenha; ondas no aprovado, tremida no recusado. */
function PixSeal({ kind, animate }: { kind: Outcome; animate: boolean }) {
  const color = kind === "approved" ? "bg-success" : kind === "expired" ? "bg-warn" : "bg-danger";
  return (
    <div className={cn("relative mx-auto size-20", animate && kind === "rejected" && "animate-shake")}>
      {animate && kind === "approved" && (
        <>
          <span className={cn("absolute inset-0 rounded-full", color, "animate-ripple")} />
          <span className={cn("absolute inset-0 rounded-full", color, "animate-ripple [animation-delay:0.8s]")} />
        </>
      )}
      <span
        className={cn("absolute inset-0 grid place-items-center rounded-full text-white", color, animate && "animate-seal")}
      >
        <svg viewBox="0 0 40 40" className="size-11" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {kind === "approved" && <path d="M10 21l7 7 13-15" className={animate ? "animate-draw" : undefined} />}
          {kind === "rejected" && (
            <>
              <path d="M13 13l14 14" className={animate ? "animate-draw" : undefined} />
              <path d="M27 13L13 27" className={animate ? "animate-draw [animation-delay:0.5s]" : undefined} />
            </>
          )}
          {kind === "expired" && (
            <>
              <circle cx="20" cy="20" r="12" strokeWidth={3.5} />
              <path d="M20 13v7l5 3" className={animate ? "animate-draw" : undefined} />
            </>
          )}
        </svg>
      </span>
    </div>
  );
}
