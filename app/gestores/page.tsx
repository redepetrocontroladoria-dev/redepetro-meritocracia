import { requireDiretoria } from "@/actions/auth";
import { GestoresManager } from "@/components/GestoresManager";
import { PageShell } from "@/components/PageShell";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function GestoresPage() {
  await requireDiretoria();

  const [gestores, departamentos] = await Promise.all([
    prisma.gestor.findMany({
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
      title="Gestores"
      description="Cadastre gestores e vincule um ou mais departamentos."
    >
      <GestoresManager
        gestores={gestores.map((g) => ({
          id: g.id,
          nome: g.nome,
          email: g.email,
          isDiretoria: g.isDiretoria,
          departamentos: g.departamentos,
        }))}
        departamentos={departamentos.map((d) => ({
          id: d.id,
          nome: d.nome,
        }))}
      />
    </PageShell>
  );
}
