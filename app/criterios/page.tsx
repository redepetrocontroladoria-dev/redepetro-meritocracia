import { requireDiretoria } from "@/actions/auth";
import { CriteriosManager } from "@/components/CriteriosManager";
import { PageShell } from "@/components/PageShell";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function CriteriosPage() {
  await requireDiretoria();

  const [criterios, departamentos] = await Promise.all([
    prisma.criterioAvaliacao.findMany({
      orderBy: { nome: "asc" },
      include: {
        departamentos: {
          orderBy: { nome: "asc" },
          select: { id: true, nome: true },
        },
      },
    }),
    prisma.departamento.findMany({ orderBy: { nome: "asc" } }),
  ]);

  return (
    <PageShell
      title="Critérios de Avaliação"
      description="Globais, compartilhados ou individuais — base 100% por departamento."
    >
      <CriteriosManager
        criterios={criterios.map((c) => ({
          id: c.id,
          nome: c.nome,
          peso: c.peso,
          descricao: c.descricao,
          isGlobal: c.isGlobal,
          toleranciaZero: c.toleranciaZero,
          tipoAvaliacao: c.tipoAvaliacao,
          departamentos: c.departamentos,
        }))}
        departamentos={departamentos.map((d) => ({
          id: d.id,
          nome: d.nome,
        }))}
      />
    </PageShell>
  );
}
