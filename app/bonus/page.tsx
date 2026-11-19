import { redirect } from "next/navigation";
import { getSessionGestor } from "@/actions/auth";
import { BonusApuracao } from "@/components/BonusApuracao";
import { consolidarItensAvaliacao } from "@/lib/avaliacaoConsolidada";
import { formatarCompetencia, MESES } from "@/lib/competencia";
import { ensureFaixasPagamento } from "@/lib/faixasPagamento";
import { prisma } from "@/lib/prisma";

export const instant = false;

type BonusPageProps = {
  searchParams: Promise<{
    departamentoId?: string;
    mes?: string;
    ano?: string;
  }>;
};

export default async function BonusPage({ searchParams }: BonusPageProps) {
  const gestor = await getSessionGestor();
  if (!gestor) redirect("/login");

  const params = await searchParams;
  const agora = new Date();
  const mes = Number(params.mes) || agora.getMonth() + 1;
  const ano = Number(params.ano) || agora.getFullYear();
  const departamentoFiltro = params.departamentoId?.trim() || "";

  const faixasDb = await ensureFaixasPagamento();
  const faixas = faixasDb
    .map((faixa) => ({
      id: faixa.id,
      minPercentual: faixa.minPercentual,
      maxPercentual: faixa.maxPercentual,
      multiplicadorPeso: faixa.multiplicadorPeso,
      descricao: faixa.descricao,
    }))
    .sort((a, b) => b.minPercentual - a.minPercentual);

  const departamentosDisponiveis = gestor.isDiretoria
    ? await prisma.departamento.findMany({ orderBy: { nome: "asc" } })
    : gestor.departamentos;

  const filtroValido =
    departamentoFiltro &&
    (gestor.isDiretoria ||
      gestor.departamentoIds.includes(departamentoFiltro))
      ? departamentoFiltro
      : "";

  const whereColaboradores = gestor.isDiretoria
    ? filtroValido
      ? { departamentoId: filtroValido }
      : {}
    : {
        departamentoId: filtroValido
          ? filtroValido
          : { in: gestor.departamentoIds },
      };

  const [colaboradores, avaliacoesColetivas] = await Promise.all([
    prisma.colaborador.findMany({
      where: whereColaboradores,
      orderBy: { nome: "asc" },
      include: {
        departamento: true,
        avaliacoes: {
          where: { mes, ano },
          include: {
            avaliadoPor: { select: { nome: true } },
            gestor: { select: { nome: true } },
            itens: {
              include: {
                criterio: {
                  select: {
                    id: true,
                    nome: true,
                    peso: true,
                    toleranciaZero: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.avaliacaoDepartamento.findMany({
      where: {
        mes,
        ano,
        ...(filtroValido
          ? { departamentoId: filtroValido }
          : gestor.isDiretoria
            ? {}
            : { departamentoId: { in: gestor.departamentoIds } }),
      },
      include: {
        itens: {
          include: {
            criterio: {
              select: {
                id: true,
                nome: true,
                peso: true,
                toleranciaZero: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const coletivosPorDept = new Map(
    avaliacoesColetivas.map((coletiva) => [
      coletiva.departamentoId,
      coletiva.itens.map((item) => ({
        criterioId: item.criterio.id,
        criterioNome: item.criterio.nome,
        peso: item.peso || item.criterio.peso,
        nota: item.nota,
        toleranciaZero: item.criterio.toleranciaZero,
        justificativa: item.justificativa,
      })),
    ]),
  );

  const linhas = colaboradores.map((colaborador) => {
    const avaliacao = colaborador.avaliacoes[0] ?? null;
    const individuais = (avaliacao?.itens ?? []).map((item) => ({
      criterioId: item.criterio.id,
      criterioNome: item.criterio.nome,
      peso: item.criterio.peso,
      nota: item.notaObtida,
      toleranciaZero: item.criterio.toleranciaZero,
      justificativa: item.justificativa,
    }));
    const coletivos = coletivosPorDept.get(colaborador.departamentoId) ?? [];
    const itens = consolidarItensAvaliacao(individuais, coletivos).map(
      (item) => ({
        criterioId: item.criterioId,
        criterioNome: item.criterioNome ?? item.criterioId,
        peso: item.peso,
        nota: item.nota,
        toleranciaZero: Boolean(item.toleranciaZero),
        justificativa: item.justificativa,
        origem: item.origem,
      }),
    );
    return {
      colaboradorId: colaborador.id,
      colaborador: colaborador.nome,
      cargo: colaborador.cargo,
      departamento: colaborador.departamento.nome,
      valorAlvo: colaborador.valorAlvo,
      temAvaliacao: Boolean(avaliacao),
      gestorNome: avaliacao?.avaliadoPor?.nome ?? avaliacao?.gestor?.nome ?? null,
      itens,
    };
  });

  const competenciaLabel = formatarCompetencia(mes, ano);
  const anos = Array.from(
    { length: 6 },
    (_, i) => agora.getFullYear() - 2 + i,
  );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Apuração / Bônus
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Escada de gatilhos por critério, proporcionalidade de dias e valor
          final para RH/Folha.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="block min-w-[10rem] space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">Mês</span>
          <select
            name="mes"
            defaultValue={String(mes)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
          >
            {MESES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[8rem] space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">Ano</span>
          <select
            name="ano"
            defaultValue={String(ano)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
          >
            {anos.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {departamentosDisponiveis.length > 0 ? (
          <label className="block min-w-[14rem] flex-1 space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Departamento
            </span>
            <select
              name="departamentoId"
              defaultValue={filtroValido}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
            >
              <option value="">
                {gestor.isDiretoria
                  ? "Todos"
                  : "Todos os meus departamentos"}
              </option>
              {departamentosDisponiveis.map((departamento) => (
                <option key={departamento.id} value={departamento.id}>
                  {departamento.nome}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="submit"
          className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800"
        >
          Filtrar
        </button>
      </form>

      <BonusApuracao
        linhas={linhas}
        faixas={faixas}
        competenciaLabel={competenciaLabel}
        isDiretoria={gestor.isDiretoria}
      />
    </main>
  );
}
