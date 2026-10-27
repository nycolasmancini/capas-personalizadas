"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "./ui";

/** Copia um texto; se começar com "/", copia o link completo do site. */
export function CopyButton({ text, label = "Copiar", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text.startsWith("/") ? `${window.location.origin}${text}` : text);
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
      className={cn("inline-flex h-9 items-center gap-1.5 rounded-ctl bg-sand px-3 text-sm font-semibold hover:bg-blue-soft", className)}
    >
      {done ? <Check size={15} /> : <Copy size={15} />} {done ? "Copiado" : label}
    </button>
  );
}
