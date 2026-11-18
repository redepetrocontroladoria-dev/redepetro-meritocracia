import { redirect } from "next/navigation";
import { getSessionGestor } from "@/actions/auth";
import { AlterarSenhaForm } from "@/components/AlterarSenhaForm";
import { PageShell } from "@/components/PageShell";

export const instant = false;

export default async function PerfilPage() {
  const gestor = await getSessionGestor();
  if (!gestor) redirect("/login");

  return (
    <PageShell
      title="Minha Senha"
      description={`${gestor.nome} · ${gestor.email}`}
    >
      <AlterarSenhaForm />
      <div />
    </PageShell>
  );
}
