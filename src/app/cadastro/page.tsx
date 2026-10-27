import { SignOutButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/SignupForm";
import { Logo } from "@/components/ui";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Complete seu cadastro" };

export default async function Cadastro() {
  const s = await getSession();
  if (s === null) redirect("/entrar");
  if (s !== "new") redirect("/inicio");
  const user = await currentUser();
  const first = user?.firstName ?? user?.fullName?.split(" ")[0];

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <Logo />
      <div className="w-full max-w-sm rounded-tile bg-card p-6">
        <p className="text-muted">Olá{first ? `, ${first}` : ""} 👋</p>
        <h1 className="font-display text-3xl leading-tight">Falta pouco</h1>
        <p className="mt-2 text-sm text-muted">Conte qual é a sua loja para começar a montar capas.</p>
        <SignupForm />
      </div>
      <p className="text-center text-sm text-muted">
        Entrou como {user?.primaryEmailAddress?.emailAddress}.{" "}
        <SignOutButton redirectUrl="/entrar">
          <button className="font-semibold text-ink underline">Trocar de conta</button>
        </SignOutButton>
      </p>
    </main>
  );
}
