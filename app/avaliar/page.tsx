import { redirect } from "next/navigation";
import { getSessionGestor } from "@/actions/auth";
import { getAvaliacaoParaEdicao } from "@/actions/avaliacoes";
import { AvaliacaoDepartamentoForm } from "@/components/AvaliacaoDepartamentoForm";
import { AvaliacaoForm } from "@/components/AvaliacaoForm";
import { prisma } from "@/lib/prisma";

export const instant = false;

type AvaliarPageProps = {
  searchParams: Promise<{ editId?: string }>;
};

export default async function AvaliarPage({ searchParams }: AvaliarPageProps) {
  const gestor = await getSessionGestor();

  if (!gestor) {
    redirect("/login");
  }

  const params = await searchParams;
  const editId = params.editId?.trim() || "";
  const edicao = editId ? await getAvaliacaoParaEdicao(editId) : null;

  if (editId && !edicao) {
    redirect("/avaliar");
  }

  const [colaboradores, criterios, departamentos] = await Promise.all([
    prisma.colaborador.findMany({
      where: gestor.isDiretoria
        ? undefined
        : { departamentoId: { in: gestor.departamentoIds } },
      orderBy: { nome: "asc" },
      include: { departamento: true },
    }),
    prisma.criterioAvaliacao.findMany({
      orderBy: { nome: "asc" },
      include: {
        departamentos: { select: { id: true } },
      },
    }),
    gestor.isDiretoria
      ? prisma.departamento.findMany({ orderBy: { nome: "asc" } })
      : Promise.resolve(gestor.departamentos),
  ]);

  const criteriosMapped = criterios.map((criterio) => ({
    id: criterio.id,
    nome: criterio.nome,
    peso: criterio.peso,
    descricao: criterio.descricao,
    isGlobal: criterio.isGlobal,
    tipoAvaliacao: criterio.tipoAvaliacao,
    toleranciaZero: criterio.toleranciaZero,
    departamentoIds: criterio.departamentos.map((d) => d.id),
  }));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Avaliação
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Metas coletivas do departamento e avaliação individual do
          colaborador.
        </p>
      </div>

      <AvaliacaoDepartamentoForm
        departamentos={departamentos.map((d) => ({
          id: d.id,
          nome: d.nome,
        }))}
        criterios={criteriosMapped}
      />

      <AvaliacaoForm
        colaboradores={colaboradores.map((colaborador) => ({
          id: colaborador.id,
          nome: colaborador.nome,
          cargo: colaborador.cargo,
          departamento: colaborador.departamento.nome,
          departamentoId: colaborador.departamentoId,
        }))}
        criterios={criteriosMapped}
        edicaoInicial={
          edicao
            ? {
                id: edicao.id,
                colaboradorId: edicao.colaboradorId,
                mes: edicao.mes,
                ano: edicao.ano,
                observacoes: edicao.observacoes ?? "",
                notas: Object.fromEntries(
                  edicao.itens.map((item) => [
                    item.criterioId,
                    String(item.notaObtida),
                  ]),
                ),
              }
            : null
        }
      />
    </main>
  );
}
