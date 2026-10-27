"use client";

import { useActionState, useState } from "react";
import { completeSignup } from "@/app/actions";
import { Button, Field, inputCls } from "./ui";

/** Máscara simples: (11) 98765-4321. */
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function SignupForm() {
  const [state, action, pending] = useActionState(completeSignup, undefined);
  const [phone, setPhone] = useState("");

  return (
    <form action={action} className="mt-5 space-y-4">
      <Field label="Nome da loja">
        <input name="storeName" required minLength={2} maxLength={80} className={inputCls} placeholder="Ex.: Cell Center Centro" />
      </Field>
      <Field label="Cidade">
        <input name="city" required minLength={2} maxLength={80} className={inputCls} placeholder="Ex.: Campinas - SP" />
      </Field>
      <Field label="WhatsApp" hint="Com DDD. Usamos para falar com você sobre os pedidos.">
        <input
          name="whatsapp"
          required
          inputMode="tel"
          autoComplete="tel-national"
          className={inputCls}
          placeholder="(11) 98765-4321"
          value={phone}
          onChange={(e) => setPhone(maskPhone(e.target.value))}
        />
      </Field>
      {state?.error && <p className="rounded-ctl bg-pink px-3 py-2 text-sm font-semibold text-danger">{state.error}</p>}
      <Button className="w-full" disabled={pending}>
        {pending ? "Salvando…" : "Começar a usar"}
      </Button>
    </form>
  );
}
