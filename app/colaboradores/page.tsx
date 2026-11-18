import { redirect } from "next/navigation";
import { getSessionGestor } from "@/actions/auth";
import { ColaboradoresManager } from "@/components/ColaboradoresManager";
import { PageShell } from "@/components/PageShell";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function ColaboradoresPage() {
  const gestor = await getSessionGestor();

  if (!gestor) {
    redirect("/login");
  }

  const [colaboradores, departamentos] = await Promise.all([
    prisma.colaborador.findMany({
      where: gestor.isDiretoria
        ? undefined
        : { departamentoId: { in: gestor.departamentoIds } },
      orderBy: { nome: "asc" },
      include: { departamento: true },
    }),
    prisma.departamento.findMany({
      where: gestor.isDiretoria
        ? undefined
        : { id: { in: gestor.departamentoIds } },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <PageShell
      title="Colaboradores"
      description="Cadastre colaboradores e vincule-os a um departamento."
    >
      <ColaboradoresManager
        colaboradores={colaboradores.map((colaborador) => ({
          id: colaborador.id,
          nome: colaborador.nome,
          cargo: colaborador.cargo,
          departamentoId: colaborador.departamentoId,
          departamentoNome: colaborador.departamento.nome,
          valorAlvo: colaborador.valorAlvo,
        }))}
        departamentos={departamentos.map((departamento) => ({
          id: departamento.id,
          nome: departamento.nome,
        }))}
      />
    </PageShell>
  );
}
