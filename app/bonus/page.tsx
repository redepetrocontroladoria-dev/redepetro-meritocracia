import { redirect } from "next/navigation";
import { getSessionGestor } from "@/actions/auth";
import { BonusApuracao } from "@/components/BonusApuracao";
import { consolidarItensAvaliacao } from "@/lib/avaliacaoConsolidada";
import {
  BASES_VALOR_ALVO,
  formatarLabelCiclo,
  PERIODICIDADES,
  parseBaseValorAlvo,
  parsePeriodicidade,
  resolverIntervaloCiclo,
} from "@/lib/cicloBonus";
import { MESES } from "@/lib/competencia";
import { ensureFaixasPagamento } from "@/lib/faixasPagamento";
import { prisma } from "@/lib/prisma";

export const instant = false;

type BonusPageProps = {
  searchParams: Promise<{
    departamentoId?: string;
    ciclo?: string;
    baseValor?: string;
    mes?: string;
    ano?: string;
    trimestre?: string;
    semestre?: string;
    mesInicio?: string;
    anoInicio?: string;
    mesFim?: string;
    anoFim?: string;
  }>;
};

export default async function BonusPage({ searchParams }: BonusPageProps) {
  const gestor = await getSessionGestor();
  if (!gestor) redirect("/login");

  const params = await searchParams;
  const agora = new Date();
  const ciclo = parsePeriodicidade(params.ciclo);
  const baseValor = parseBaseValorAlvo(params.baseValor);
  const mes = Number(params.mes) || agora.getMonth() + 1;
  const ano = Number(params.ano) || agora.getFullYear();
  const trimestre = Number(params.trimestre) || Math.ceil(mes / 3);
  const semestre = Number(params.semestre) || (mes <= 6 ? 1 : 2);
  const mesInicio = Number(params.mesInicio) || 1;
  const anoInicio = Number(params.anoInicio) || ano;
  const mesFim = Number(params.mesFim) || 12;
  const anoFim = Number(params.anoFim) || ano;
  const departamentoFiltro = params.departamentoId?.trim() || "";

  const { inicio, fim, competencias } = resolverIntervaloCiclo({
    ciclo,
    mes,
    ano,
    trimestre,
    semestre,
    mesInicio,
    anoInicio,
    mesFim,
    anoFim,
  });

  const competenciaLabel = formatarLabelCiclo({
    ciclo,
    inicio,
    fim,
    trimestre,
    semestre,
  });

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

  const orCompetencias = competencias.map((c) => ({
    mes: c.mes,
    ano: c.ano,
  }));

  const [colaboradores, avaliacoesColetivas] = await Promise.all([
    prisma.colaborador.findMany({
      where: whereColaboradores,
      orderBy: { nome: "asc" },
      include: {
        departamento: true,
        avaliacoes: {
          where: { OR: orCompetencias },
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
        OR: orCompetencias,
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

  const coletivosPorDeptMes = new Map<
    string,
    {
      criterioId: string;
      criterioNome: string;
      peso: number;
      nota: number;
      toleranciaZero: boolean;
      justificativa: string | null;
    }[]
  >();

  for (const coletiva of avaliacoesColetivas) {
    const key = `${coletiva.departamentoId}|${coletiva.ano}-${String(coletiva.mes).padStart(2, "0")}`;
    coletivosPorDeptMes.set(
      key,
      coletiva.itens.map((item) => ({
        criterioId: item.criterio.id,
        criterioNome: item.criterio.nome,
        peso: item.peso || item.criterio.peso,
        nota: item.nota,
        toleranciaZero: item.criterio.toleranciaZero,
        justificativa: item.justificativa,
      })),
    );
  }

  const linhas = colaboradores.map((colaborador) => {
    const avaliacoesPorKey = new Map(
      colaborador.avaliacoes.map((avaliacao) => [
        `${avaliacao.ano}-${String(avaliacao.mes).padStart(2, "0")}`,
        avaliacao,
      ]),
    );

    const meses = competencias.map((competencia) => {
      const key = `${competencia.ano}-${String(competencia.mes).padStart(2, "0")}`;
      const avaliacao = avaliacoesPorKey.get(key) ?? null;
      const individuais = (avaliacao?.itens ?? []).map((item) => ({
        criterioId: item.criterio.id,
        criterioNome: item.criterio.nome,
        peso: item.criterio.peso,
        nota: item.notaObtida,
        toleranciaZero: item.criterio.toleranciaZero,
        justificativa: item.justificativa,
      }));
      const coletivos =
        coletivosPorDeptMes.get(`${colaborador.departamentoId}|${key}`) ?? [];
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
        mes: competencia.mes,
        ano: competencia.ano,
        temAvaliacao: Boolean(avaliacao),
        gestorNome:
          avaliacao?.avaliadoPor?.nome ?? avaliacao?.gestor?.nome ?? null,
        itens,
      };
    });

    return {
      colaboradorId: colaborador.id,
      colaborador: colaborador.nome,
      cargo: colaborador.cargo,
      departamento: colaborador.departamento.nome,
      valorAlvo: colaborador.valorAlvo,
      meses,
    };
  });

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
          Ciclos flexíveis de pagamento definidos pela Diretoria, com avaliações
          mensais e proporcionalidade de dias.
        </p>
      </div>

      <form className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[14rem] flex-1 space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Periodicidade / Ciclo
            </span>
            <select
              name="ciclo"
              defaultValue={ciclo}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
            >
              {PERIODICIDADES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-[16rem] flex-[1.4] space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Base do Valor-Alvo
            </span>
            <select
              name="baseValor"
              defaultValue={baseValor}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
            >
              {BASES_VALOR_ALVO.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
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
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {ciclo === "mensal" ? (
            <>
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
            </>
          ) : null}

          {ciclo === "trimestral" ? (
            <>
              <label className="block min-w-[10rem] space-y-1.5">
                <span className="text-sm font-medium text-zinc-700">
                  Trimestre
                </span>
                <select
                  name="trimestre"
                  defaultValue={String(trimestre)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                >
                  <option value="1">Q1 — Jan a Mar</option>
                  <option value="2">Q2 — Abr a Jun</option>
                  <option value="3">Q3 — Jul a Set</option>
                  <option value="4">Q4 — Out a Dez</option>
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
            </>
          ) : null}

          {ciclo === "semestral" ? (
            <>
              <label className="block min-w-[12rem] space-y-1.5">
                <span className="text-sm font-medium text-zinc-700">
                  Semestre
                </span>
                <select
                  name="semestre"
                  defaultValue={String(semestre)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                >
                  <option value="1">1º Semestre — Jan a Jun</option>
                  <option value="2">2º Semestre — Jul a Dez</option>
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
            </>
          ) : null}

          {ciclo === "anual" ? (
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
          ) : null}

          {ciclo === "personalizado" ? (
            <>
              <label className="block min-w-[9rem] space-y-1.5">
                <span className="text-sm font-medium text-zinc-700">
                  Mês inicial
                </span>
                <select
                  name="mesInicio"
                  defaultValue={String(mesInicio)}
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
                <span className="text-sm font-medium text-zinc-700">
                  Ano inicial
                </span>
                <select
                  name="anoInicio"
                  defaultValue={String(anoInicio)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                >
                  {anos.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-[9rem] space-y-1.5">
                <span className="text-sm font-medium text-zinc-700">
                  Mês final
                </span>
                <select
                  name="mesFim"
                  defaultValue={String(mesFim)}
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
                <span className="text-sm font-medium text-zinc-700">
                  Ano final
                </span>
                <select
                  name="anoFim"
                  defaultValue={String(anoFim)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                >
                  {anos.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <button
            type="submit"
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800"
          >
            Filtrar
          </button>
        </div>

        <p className="text-xs text-zinc-500">
          Período selecionado:{" "}
          <span className="font-semibold text-brand-secondary">
            {competenciaLabel}
          </span>{" "}
          ({competencias.length}{" "}
          {competencias.length === 1 ? "mês" : "meses"})
        </p>
      </form>

      <BonusApuracao
        linhas={linhas}
        faixas={faixas}
        competenciaLabel={competenciaLabel}
        baseValor={baseValor}
        qtdMesesCiclo={competencias.length}
        isDiretoria={gestor.isDiretoria}
      />
    </main>
  );
}
