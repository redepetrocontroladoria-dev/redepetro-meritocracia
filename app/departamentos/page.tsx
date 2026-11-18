import { requireDiretoria } from "@/actions/auth";
import { DepartamentosManager } from "@/components/DepartamentosManager";
import { PageShell } from "@/components/PageShell";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function DepartamentosPage() {
  await requireDiretoria();

  const departamentos = await prisma.departamento.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { colaboradores: true } } },
  });

  return (
    <PageShell
      title="Departamentos"
      description="Cadastre e gerencie os departamentos da empresa."
    >
      <DepartamentosManager
        departamentos={departamentos.map((d) => ({
          id: d.id,
          nome: d.nome,
          colaboradores: d._count.colaboradores,
        }))}
      />
    </PageShell>
  );
}
