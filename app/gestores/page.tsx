import { requireDiretoria } from "@/actions/auth";
import { GestoresManager } from "@/components/GestoresManager";
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
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Gestores
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cadastre gestores e vincule um ou mais departamentos.
        </p>
      </div>
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
    </main>
  );
}
