import { SignOutButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { Logo, Tile } from "@/components/ui";

export const metadata = { title: "Acesso bloqueado" };

export default async function SemAcesso() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5">
      <Logo />
      <Tile tone="butter" className="max-w-sm p-6 text-center">
        <p className="font-display text-2xl">Acesso bloqueado</p>
        <p className="mt-3 text-sm">
          {email ? (
            <>
              O acesso de <strong>{email}</strong> está suspenso.
            </>
          ) : (
            "Sua conta não tem e-mail."
          )}{" "}
          Se acha que é um engano, fale com a empresa de design.
        </p>
        <SignOutButton redirectUrl="/entrar">
          <button className="mt-5 h-11 rounded-ctl bg-ink px-5 font-semibold text-white">Entrar com outra conta</button>
        </SignOutButton>
      </Tile>
    </main>
  );
}
