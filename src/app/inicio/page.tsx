import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";

// Depois do login, manda cada pessoa para a área certa.
export default async function Inicio() {
  const s = await getSession();
  if (s === null) redirect("/entrar");
  if (s === "blocked") redirect("/sem-acesso");
  if (s === "new") redirect("/cadastro");
  redirect(homeFor(s.member.role));
}
