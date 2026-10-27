"use client";

import { Bell, BellRing } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Confere a cada 15 s se chegou pedido novo. Quando chega: toca um aviso,
 * mostra notificação do navegador e atualiza a lista.
 */
export function LiveOrders() {
  const router = useRouter();
  const last = useRef<string | null>(null);
  const [fresh, setFresh] = useState(0);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
        const r = await fetch("/api/painel/ultimo", { cache: "no-store" });
        if (!r.ok) return;
        const { latest, code } = (await r.json()) as { latest: string | null; code: string | null };
        if (last.current === null) {
          last.current = latest ?? "";
          return;
        }
        if (latest && latest !== last.current) {
          last.current = latest;
          setFresh((n) => n + 1);
          beep();
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Novo pedido de capa", { body: code ? `Pedido #${code} chegou para produção` : undefined });
          }
          router.refresh();
        }
      } catch {}
    }
    tick();
    const t = setInterval(() => !stop && tick(), 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [router]);

  return (
    <button
      onClick={async () => {
        setFresh(0);
        if (perm === "default") setPerm(await Notification.requestPermission());
        router.refresh();
      }}
      className="relative grid size-10 place-items-center rounded-ctl hover:bg-sand"
      title={perm === "default" ? "Ativar avisos de novos pedidos" : "Avisos de novos pedidos"}
    >
      {fresh ? <BellRing size={20} className="text-blue" /> : <Bell size={20} />}
      {fresh > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-blue text-[11px] font-bold text-white">
          {fresh}
        </span>
      )}
      {perm === "default" && <span className="absolute bottom-1.5 right-1.5 size-2 rounded-full bg-danger" />}
    </button>
  );
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.17);
    });
  } catch {}
}
