"use client";

import { KeyRound } from "lucide-react";
import { useActionState, useState } from "react";
import { addNetworkStore, resetStorePassword } from "@/app/actions";
import { Button, Field, inputCls } from "./ui";

/** Senha fácil de ditar por telefone: uma palavra curta + 4 números (8 caracteres, o mínimo do Clerk). */
function suggestPassword() {
  const words = ["capa", "loja", "beep", "foto", "azul", "rosa", "nova", "vida", "mesa", "lado"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}${Math.floor(1000 + Math.random() * 9000)}`;
}

function Result({ state }: { state: { error?: string; ok?: string } | undefined }) {
  if (state?.error) return <p className="rounded-ctl bg-pink px-3 py-2 text-sm font-semibold text-danger">{state.error}</p>;
  if (state?.ok) return <p className="rounded-ctl bg-mint px-3 py-2 text-sm font-semibold">{state.ok}</p>;
  return null;
}

export function NetworkStoreForm({ networkId, prefix }: { networkId: string; prefix: string }) {
  const [state, action, pending] = useActionState(addNetworkStore, undefined);
  const [password, setPassword] = useState(suggestPassword);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="networkId" value={networkId} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Nome da loja">
          <input name="name" required className={inputCls} placeholder="Ex.: Beep Shopping Centro" />
        </Field>
        <Field label="Cidade">
          <input name="city" className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Usuário" hint="Sem espaços. Ex.: beep.centro">
          <input name="username" required className={inputCls} placeholder={`${prefix}.centro`} autoCapitalize="none" />
        </Field>
        <Field label="Senha">
          <input name="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Result state={state} />
      <Button className="w-full" disabled={pending}>
        {pending ? "Criando…" : "Criar loja e login"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState(resetStorePassword, undefined);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(suggestPassword);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue">
        <KeyRound size={13} /> Trocar senha
      </button>
    );
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <input name="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} h-9 max-w-48`} />
      <Button className="h-9 text-sm" disabled={pending}>
        {pending ? "…" : "Salvar senha"}
      </Button>
      <Result state={state} />
    </form>
  );
}
