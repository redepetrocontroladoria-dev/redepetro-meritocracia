import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionGestor } from "@/actions/auth";
import { BonusApuracao } from "@/components/BonusApuracao";
import { BonusFiltros } from "@/components/BonusFiltros";
import { consolidarItensAvaliacao } from "@/lib/avaliacaoConsolidada";
import {
  formatarLabelCiclo,
  parseBaseValorAlvo,
  parsePeriodicidade,
  resolverIntervaloCiclo,
} from "@/lib/cicloBonus";
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

      <Suspense
        fallback={
          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500 shadow-sm">
            Carregando filtros…
          </div>
        }
      >
        <BonusFiltros
          departamentos={departamentosDisponiveis.map((d) => ({
            id: d.id,
            nome: d.nome,
          }))}
          isDiretoria={gestor.isDiretoria}
          anos={anos}
        />
      </Suspense>

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
