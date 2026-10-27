import { ButtonLink, Logo, Tile } from "@/components/ui";

export const metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5">
      <Logo />
      <Tile tone="butter" className="max-w-sm p-6 text-center">
        <p className="font-display text-2xl">Essa página não existe</p>
        <p className="mt-2 text-sm text-muted">O link pode estar errado ou o pedido foi cancelado.</p>
        <ButtonLink href="/inicio" variant="dark" className="mt-5">
          Ir para o início
        </ButtonLink>
      </Tile>
    </main>
  );
}
