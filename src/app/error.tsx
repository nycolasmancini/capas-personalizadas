"use client";

import { Button, Logo, Tile } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5">
      <Logo />
      <Tile tone="peach" className="max-w-sm p-6 text-center">
        <p className="font-display text-2xl">Ops, algo deu errado</p>
        <p className="mt-2 text-sm">{error.message && !error.digest ? error.message : "Tente de novo em alguns segundos."}</p>
        <Button variant="dark" className="mt-5" onClick={reset}>
          Tentar de novo
        </Button>
      </Tile>
    </main>
  );
}
