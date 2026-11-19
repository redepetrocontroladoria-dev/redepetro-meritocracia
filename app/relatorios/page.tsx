import { redirect } from "next/navigation";
import { getSessionGestor } from "@/actions/auth";
import { DesempenhoDepartamentos } from "@/components/DesempenhoDepartamentos";
import { MatrizCriterios } from "@/components/MatrizCriterios";
import {
  MetaEquipePanel,
  type ResumoMetaEquipe,
} from "@/components/MetaEquipePanel";
import {
  RelatoriosExport,
  type AvaliacaoRelatorio,
} from "@/components/RelatoriosExport";
import { TabelaAvaliacoesDetalhe } from "@/components/TabelaAvaliacoesDetalhe";
import {
  calcularVariacao,
  formatarCompetencia,
  mediaDeNotas,
  MESES,
  competenciaAnterior,
} from "@/lib/competencia";
import { consolidarItensAvaliacao } from "@/lib/avaliacaoConsolidada";
import { getDesempenhoPorDepartamento } from "@/lib/desempenho";
import { classificarNota } from "@/lib/escala";
import { prisma } from "@/lib/prisma";

export const instant = false;

type RelatoriosPageProps = {
  searchParams: Promise<{
    departamentoId?: string;
    mes?: string;
    ano?: string;
    historico?: string;
  }>;
};

export default async function RelatoriosPage({
  searchParams,
}: RelatoriosPageProps) {
  const gestor = await getSessionGestor();
  if (!gestor) redirect("/login");

  const params = await searchParams;
  const agora = new Date();
  const historico = params.historico === "1";
  const mes = Number(params.mes) || agora.getMonth() + 1;
  const ano = Number(params.ano) || agora.getFullYear();
  const departamentoFiltro = params.departamentoId?.trim() || "";
  const anterior = competenciaAnterior(mes, ano);

  const departamentosDisponiveis = gestor.isDiretoria
    ? await prisma.departamento.findMany({ orderBy: { nome: "asc" } })
    : gestor.departamentos;

  const filtroValido =
    departamentoFiltro &&
    (gestor.isDiretoria ||
      gestor.departamentoIds.includes(departamentoFiltro))
      ? departamentoFiltro
      : "";

  const departamentoMatrizId =
    filtroValido ||
    (!gestor.isDiretoria && gestor.departamentoIds.length === 1
      ? gestor.departamentoIds[0]
      : "");

  const whereBase = gestor.isDiretoria
    ? filtroValido
      ? { colaborador: { departamentoId: filtroValido } }
      : {}
    : {
        colaborador: {
          departamentoId: filtroValido
            ? filtroValido
            : { in: gestor.departamentoIds },
        },
      };

  const whereAtual = historico ? whereBase : { ...whereBase, mes, ano };

  const whereAnterior = {
    ...whereBase,
    mes: anterior.mes,
    ano: anterior.ano,
  };

  const [
    avaliacoesAtual,
    avaliacoesAnterior,
    todasHistoricas,
    totalColaboradoresDept,
    avaliacoesColetivas,
  ] = await Promise.all([
    prisma.avaliacao.findMany({
      where: whereAtual,
      orderBy: [{ ano: "desc" }, { mes: "desc" }, { data: "desc" }],
      include: {
        colaborador: { include: { departamento: true } },
        avaliadoPor: { select: { nome: true } },
        gestor: { select: { nome: true } },
        itens: { include: { criterio: true } },
      },
    }),
    historico
      ? Promise.resolve([])
      : prisma.avaliacao.findMany({
          where: whereAnterior,
          select: {
            notaFinal: true,
            colaboradorId: true,
            colaborador: { select: { departamentoId: true } },
          },
        }),
    prisma.avaliacao.findMany({
      where: whereBase,
      select: { colaboradorId: true, notaFinal: true },
    }),
    departamentoMatrizId
      ? prisma.colaborador.count({
          where: { departamentoId: departamentoMatrizId },
        })
      : Promise.resolve(0),
    prisma.avaliacaoDepartamento.findMany({
      where: historico
        ? gestor.isDiretoria
          ? filtroValido
            ? { departamentoId: filtroValido }
            : {}
          : {
              departamentoId: filtroValido
                ? filtroValido
                : { in: gestor.departamentoIds },
            }
        : {
            mes,
            ano,
            ...(gestor.isDiretoria
              ? filtroValido
                ? { departamentoId: filtroValido }
                : {}
              : {
                  departamentoId: filtroValido
                    ? filtroValido
                    : { in: gestor.departamentoIds },
                }),
          },
      include: {
        departamento: { select: { id: true, nome: true } },
        avaliadoPor: { select: { nome: true } },
        itens: {
          include: {
            criterio: {
              select: { id: true, nome: true, peso: true },
            },
          },
        },
      },
    }),
  ]);

  const coletivosPorChave = new Map<
    string,
    {
      criterioId: string;
      criterioNome: string;
      peso: number;
      nota: number;
      justificativa?: string | null;
    }[]
  >();
  for (const coletiva of avaliacoesColetivas) {
    coletivosPorChave.set(
      `${coletiva.departamentoId}-${coletiva.mes}-${coletiva.ano}`,
      coletiva.itens.map((item) => ({
        criterioId: item.criterioId,
        criterioNome: item.criterio.nome,
        peso: item.peso || item.criterio.peso,
        nota: item.nota,
        justificativa: item.justificativa,
      })),
    );
  }

  const filtroDesempenho = gestor.isDiretoria
    ? filtroValido
      ? { departamentoId: filtroValido }
      : {}
    : filtroValido
      ? { departamentoId: filtroValido }
      : { departamentoIds: gestor.departamentoIds };

  const consolidadoAtual = await getDesempenhoPorDepartamento({
    ...filtroDesempenho,
    ...(historico ? {} : { mes, ano }),
  });

  const consolidadoAnterior = historico
    ? []
    : await getDesempenhoPorDepartamento({
        ...filtroDesempenho,
        mes: anterior.mes,
        ano: anterior.ano,
      });

  const mediaAnteriorPorDept = new Map(
    consolidadoAnterior.map((item) => [item.departamentoId, item.notaMedia]),
  );

  const consolidado = consolidadoAtual.map((item) => {
    const variacao = calcularVariacao(
      item.notaMedia,
      mediaAnteriorPorDept.get(item.departamentoId) ?? null,
    );
    return {
      ...item,
      variacaoPontos: variacao.pontos,
      variacaoPercentual: variacao.percentual,
      variacaoLabel: variacao.label,
      variacaoBadgeClass: variacao.badgeClass,
    };
  });

  const mediaEmpresaAtual = mediaDeNotas(
    avaliacoesAtual.map((item) => item.notaFinal),
  );
  const mediaEmpresaAnterior = mediaDeNotas(
    avaliacoesAnterior.map((item) => item.notaFinal),
  );
  const variacaoEmpresa = calcularVariacao(
    mediaEmpresaAtual,
    mediaEmpresaAnterior,
  );

  const historicoPorColaborador = new Map<string, number[]>();
  for (const item of todasHistoricas) {
    const lista = historicoPorColaborador.get(item.colaboradorId) ?? [];
    lista.push(item.notaFinal);
    historicoPorColaborador.set(item.colaboradorId, lista);
  }

  const notaAnteriorPorColaborador = new Map(
    avaliacoesAnterior.map((item) => [item.colaboradorId, item.notaFinal]),
  );

  const dados: AvaliacaoRelatorio[] = avaliacoesAtual.map((avaliacao) => {
    const historicoNotas =
      historicoPorColaborador.get(avaliacao.colaboradorId) ?? [];
    const mediaHistorica = mediaDeNotas(historicoNotas) ?? avaliacao.notaFinal;
    const variacao = calcularVariacao(
      avaliacao.notaFinal,
      notaAnteriorPorColaborador.get(avaliacao.colaboradorId) ?? null,
    );
    const faixa = classificarNota(avaliacao.notaFinal);
    const coletivos =
      coletivosPorChave.get(
        `${avaliacao.colaborador.departamentoId}-${avaliacao.mes}-${avaliacao.ano}`,
      ) ?? [];
    const individuais = avaliacao.itens.map((item) => ({
      criterioId: item.criterioId,
      criterioNome: item.criterio.nome,
      peso: item.criterio.peso,
      nota: item.notaObtida,
      justificativa: item.justificativa,
    }));
    const consolidados = consolidarItensAvaliacao(individuais, coletivos);

    return {
      id: avaliacao.id,
      colaborador: avaliacao.colaborador.nome,
      cargo: avaliacao.colaborador.cargo,
      departamento: avaliacao.colaborador.departamento.nome,
      competencia: formatarCompetencia(avaliacao.mes, avaliacao.ano),
      data: new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(avaliacao.data),
      notaFinal: avaliacao.notaFinal,
      mediaHistorica,
      variacao: variacao.label,
      classificacao: faixa.label,
      variacaoBadgeClass: variacao.badgeClass,
      faixaBadgeClass: faixa.badgeClass,
      gestorNome: avaliacao.avaliadoPor?.nome ?? avaliacao.gestor?.nome ?? null,
      valorAlvo: avaliacao.colaborador.valorAlvo,
      itens: consolidados.map((item) => ({
        criterioId: item.criterioId,
        criterioNome: item.criterioNome ?? item.criterioId,
        peso: item.peso,
        nota: item.nota,
        pontos: (item.nota * item.peso) / 100,
        justificativa: item.justificativa,
        origem: item.origem,
      })),
    };
  });

  const avaliacoesMatriz = departamentoMatrizId
    ? avaliacoesAtual.filter(
        (avaliacao) =>
          avaliacao.colaborador.departamentoId === departamentoMatrizId,
      )
    : [];

  const criteriosMap = new Map<string, { id: string; nome: string; peso: number }>();
  for (const avaliacao of avaliacoesMatriz) {
    const coletivos =
      coletivosPorChave.get(
        `${avaliacao.colaborador.departamentoId}-${avaliacao.mes}-${avaliacao.ano}`,
      ) ?? [];
    const individuais = avaliacao.itens.map((item) => ({
      criterioId: item.criterioId,
      criterioNome: item.criterio.nome,
      peso: item.criterio.peso,
      nota: item.notaObtida,
    }));
    for (const item of consolidarItensAvaliacao(individuais, coletivos)) {
      if (!criteriosMap.has(item.criterioId)) {
        criteriosMap.set(item.criterioId, {
          id: item.criterioId,
          nome: item.criterioNome ?? item.criterioId,
          peso: item.peso,
        });
      }
    }
  }

  const criteriosMatriz = Array.from(criteriosMap.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );

  const linhasMatriz = avaliacoesMatriz.map((avaliacao) => {
    const coletivos =
      coletivosPorChave.get(
        `${avaliacao.colaborador.departamentoId}-${avaliacao.mes}-${avaliacao.ano}`,
      ) ?? [];
    const individuais = avaliacao.itens.map((item) => ({
      criterioId: item.criterioId,
      criterioNome: item.criterio.nome,
      peso: item.criterio.peso,
      nota: item.notaObtida,
    }));
    const consolidados = consolidarItensAvaliacao(individuais, coletivos);
    return {
      colaborador: avaliacao.colaborador.nome,
      cargo: avaliacao.colaborador.cargo,
      notaFinal: avaliacao.notaFinal,
      itens: consolidados.map((item) => ({
        criterioId: item.criterioId,
        criterioNome: item.criterioNome ?? item.criterioId,
        peso: item.peso,
        nota: item.nota,
        pontos: (item.nota * item.peso) / 100,
      })),
    };
  });

  const departamentoMatrizNome =
    departamentosDisponiveis.find((d) => d.id === departamentoMatrizId)
      ?.nome ?? "Departamento";

  const competenciaLabel = historico
    ? "Histórico completo"
    : formatarCompetencia(mes, ano);

  const mediaEquipeMeta = mediaDeNotas(
    avaliacoesMatriz.map((item) => item.notaFinal),
  );
  const atingimentoMeta =
    mediaEquipeMeta == null ? null : (mediaEquipeMeta / 10) * 100;
  const colaboradoresAvaliadosMeta = new Set(
    avaliacoesMatriz.map((item) => item.colaboradorId),
  ).size;
  const coberturaPercentual =
    totalColaboradoresDept > 0
      ? (colaboradoresAvaliadosMeta / totalColaboradoresDept) * 100
      : 0;

  const termometroCriterios = criteriosMatriz.map((criterio) => {
    const notas = avaliacoesMatriz
      .map(
        (avaliacao) =>
          avaliacao.itens.find((item) => item.criterioId === criterio.id)
            ?.notaObtida,
      )
      .filter((nota): nota is number => typeof nota === "number");
    const media =
      notas.length > 0
        ? notas.reduce((total, nota) => total + nota, 0) / notas.length
        : 0;
    const atingiramMaximo = notas.filter((nota) => nota >= 9.95).length;
    return {
      criterioId: criterio.id,
      nome: criterio.nome,
      peso: criterio.peso,
      media,
      atingimento: (media / 10) * 100,
      atingiramMaximo,
      totalAvaliados: notas.length,
    };
  });

  const resumoMeta: ResumoMetaEquipe | null = departamentoMatrizId
    ? {
        departamentoNome: departamentoMatrizNome,
        competenciaLabel,
        mediaEquipe: mediaEquipeMeta,
        atingimento: atingimentoMeta,
        colaboradoresAtivos: totalColaboradoresDept,
        colaboradoresAvaliados: colaboradoresAvaliadosMeta,
        coberturaPercentual,
        criterios: termometroCriterios,
      }
    : null;

  const anos = Array.from(
    { length: 6 },
    (_, i) => agora.getFullYear() - 2 + i,
  );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Dashboard e Relatórios
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Médias mensais, matriz por critério e evolução vs. mês anterior.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="block min-w-[10rem] space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">Mês</span>
          <select
            name="mes"
            defaultValue={String(mes)}
            disabled={historico}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"
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
            disabled={historico}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"
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
              defaultValue={filtroValido || departamentoMatrizId}
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
        <label className="flex items-center gap-2 pb-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="historico"
            value="1"
            defaultChecked={historico}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Ver histórico completo
        </label>
        <button
          type="submit"
          className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800"
        >
          Filtrar
        </button>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gestor.isDiretoria ? (
          <article className="rounded-lg border border-zinc-200 border-l-4 border-l-brand-primary bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Média Geral da Empresa
            </p>
            <p className="mt-2 text-3xl font-semibold text-brand-primary">
              {mediaEmpresaAtual == null
                ? "—"
                : mediaEmpresaAtual.toFixed(2)}
            </p>
            <span
              className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${variacaoEmpresa.badgeClass}`}
            >
              {variacaoEmpresa.label}
            </span>
          </article>
        ) : null}

        <article className="rounded-lg border border-zinc-200 border-l-4 border-l-brand-secondary bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {gestor.isDiretoria
              ? "Departamentos no ranking"
              : filtroValido
                ? "Média do departamento"
                : "Média da sua equipe"}
          </p>
          <p className="mt-2 text-3xl font-semibold text-brand-secondary">
            {gestor.isDiretoria
              ? String(consolidado.length)
              : mediaEmpresaAtual == null
                ? "—"
                : mediaEmpresaAtual.toFixed(2)}
          </p>
          {gestor.isDiretoria ? (
            <p className="mt-2 text-sm text-zinc-500">
              com avaliações nesta competência
            </p>
          ) : (
            <span
              className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${variacaoEmpresa.badgeClass}`}
            >
              {variacaoEmpresa.label}
            </span>
          )}
        </article>

        <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Competência
          </p>
          <p className="mt-2 text-2xl font-semibold text-brand-secondary">
            {competenciaLabel}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {avaliacoesAtual.length} avaliação(ões)
          </p>
        </article>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-secondary">
            Desempenho por Departamento
          </h2>
          <RelatoriosExport
            dados={dados}
            consolidado={consolidado}
            competenciaLabel={competenciaLabel}
            resumoMeta={resumoMeta}
          />
        </div>
        <DesempenhoDepartamentos itens={consolidado} />
      </section>

      {resumoMeta ? <MetaEquipePanel resumo={resumoMeta} /> : null}

      {departamentoMatrizId ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-secondary">
            Matriz de Desempenho por Critério
          </h2>
          <MatrizCriterios
            departamentoNome={departamentoMatrizNome}
            competenciaLabel={competenciaLabel}
            criterios={criteriosMatriz}
            linhas={linhasMatriz}
          />
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-zinc-200 bg-white px-5 py-6 text-sm text-zinc-500">
          Selecione um departamento no filtro para visualizar a matriz
          comparativa por critério.
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-secondary">
          Detalhamento de Avaliações
        </h2>

        {dados.length === 0 && avaliacoesColetivas.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500">
            Nenhuma avaliação encontrada.
          </p>
        ) : (
          <TabelaAvaliacoesDetalhe
            dados={dados}
            coletivos={avaliacoesColetivas.map((coletiva) => ({
              id: coletiva.id,
              departamentoId: coletiva.departamentoId,
              departamento: coletiva.departamento.nome,
              competencia: formatarCompetencia(coletiva.mes, coletiva.ano),
              mes: coletiva.mes,
              ano: coletiva.ano,
              avaliadoPorNome: coletiva.avaliadoPor?.nome ?? null,
              itens: coletiva.itens.map((item) => ({
                criterioId: item.criterioId,
                criterioNome: item.criterio.nome,
                peso: item.peso || item.criterio.peso,
                nota: item.nota,
                justificativa: item.justificativa,
              })),
            }))}
          />
        )}
      </section>
    </main>
  );
}
