"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  excluirAvaliacao,
  excluirAvaliacaoDepartamento,
} from "@/actions/avaliacoes";
import type { AvaliacaoRelatorio } from "@/components/RelatoriosExport";
import {
  encontrarFaixa,
  FAIXAS_PADRAO,
  notaParaAtingimento,
} from "@/lib/calculoMeritocracia";
import { gerarExtratoUmParaUmPdf } from "@/lib/extratoUmParaUm";

export type LancamentoColetivoRelatorio = {
  id: string;
  departamentoId: string;
  departamento: string;
  competencia: string;
  mes: number;
  ano: number;
  avaliadoPorNome?: string | null;
  itens: {
    criterioId: string;
    criterioNome: string;
    peso: number;
    nota: number;
    justificativa?: string | null;
  }[];
};

export function TabelaAvaliacoesDetalhe({
  dados,
  coletivos = [],
}: {
  dados: AvaliacaoRelatorio[];
  coletivos?: LancamentoColetivoRelatorio[];
}) {
  const router = useRouter();
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(chave: string) {
    setAbertos((atual) => ({ ...atual, [chave]: !atual[chave] }));
  }

  function editar(id: string) {
    router.push(`/avaliar?editId=${id}`);
  }

  function excluir(item: AvaliacaoRelatorio) {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir esta avaliação?\n\n${item.colaborador} — ${item.competencia}`,
      )
    ) {
      return;
    }
    setErro(null);
    setSucesso(null);
    startTransition(async () => {
      try {
        await excluirAvaliacao(item.id);
        setSucesso("Avaliação individual excluída.");
        router.refresh();
      } catch (error) {
        setErro(
          error instanceof Error ? error.message : "Erro ao excluir avaliação.",
        );
      }
    });
  }

  function excluirColetivo(item: LancamentoColetivoRelatorio) {
    if (
      !window.confirm(
        `Excluir o lançamento coletivo?\n\n${item.departamento} — ${item.competencia}\n\nAs metas coletivas serão removidas e as notas individuais consolidadas serão recalculadas.`,
      )
    ) {
      return;
    }
    setErro(null);
    setSucesso(null);
    startTransition(async () => {
      const result = await excluirAvaliacaoDepartamento({
        avaliacaoDepartamentoId: item.id,
        departamentoId: item.departamentoId,
        mes: item.mes,
        ano: item.ano,
      });
      if (!result.ok) {
        setErro(result.error ?? "Erro ao excluir lançamento coletivo.");
        return;
      }
      setSucesso(
        `Lançamento coletivo de ${item.departamento} (${item.competencia}) excluído.`,
      );
      router.refresh();
    });
  }

  function gerarExtrato(item: AvaliacaoRelatorio) {
    const itens = item.itens.map((criterio) => {
      const atingimento = notaParaAtingimento(criterio.nota);
      const faixa = encontrarFaixa(atingimento, FAIXAS_PADRAO);
      const partePaga = faixa.multiplicadorPeso * 100;
      const contribuicao = (criterio.peso * partePaga) / 100;
      return {
        criterioNome: criterio.criterioNome,
        peso: criterio.peso,
        nota: criterio.nota,
        partePaga,
        contribuicao,
        justificativa: criterio.justificativa,
        origem: criterio.origem,
      };
    });
    const percentualAtingido = itens.reduce(
      (total, criterio) => total + (criterio.contribuicao ?? 0),
      0,
    );
    gerarExtratoUmParaUmPdf({
      colaborador: item.colaborador,
      cargo: item.cargo,
      departamento: item.departamento,
      competencia: item.competencia,
      gestorResponsavel: item.gestorNome ?? "—",
      notaFinal: item.notaFinal,
      percentualAtingido,
      valorFinalBonus:
        item.valorAlvo != null
          ? (item.valorAlvo * percentualAtingido) / 100
          : null,
      itens,
    });
  }

  return (
    <div className="space-y-6">
      {erro ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      ) : null}
      {sucesso ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {sucesso}
        </p>
      ) : null}

      {coletivos.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">
            Lançamentos Coletivos do Departamento
          </h3>
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-brand-secondary text-xs uppercase tracking-wide text-white">
                  <th className="px-3 py-3 font-semibold">Departamento</th>
                  <th className="px-3 py-3 font-semibold">Competência</th>
                  <th className="px-3 py-3 font-semibold">Critérios</th>
                  <th className="px-3 py-3 font-semibold">Lançado por</th>
                  <th className="px-3 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {coletivos.map((item) => {
                  const chave = `coletivo-${item.id}`;
                  const aberto = Boolean(abertos[chave]);
                  return (
                    <Fragment key={item.id}>
                      <tr className="text-zinc-800">
                        <td className="px-3 py-3 font-medium text-zinc-900">
                          {item.departamento}
                        </td>
                        <td className="px-3 py-3">{item.competencia}</td>
                        <td className="px-3 py-3 tabular-nums">
                          {item.itens.length}
                        </td>
                        <td className="px-3 py-3 text-zinc-600">
                          {item.avaliadoPorNome ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => toggle(chave)}
                              className="rounded-md px-2 py-1 text-xs font-medium text-brand-primary hover:bg-red-50"
                            >
                              {aberto ? "Ocultar" : "Detalhar"}
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => excluirColetivo(item)}
                              className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                            >
                              Excluir Coletivo
                            </button>
                          </div>
                        </td>
                      </tr>
                      {aberto ? (
                        <tr className="bg-zinc-50">
                          <td colSpan={5} className="px-3 py-3">
                            {item.itens.length === 0 ? (
                              <p className="text-xs text-zinc-500">
                                Sem critérios neste lançamento.
                              </p>
                            ) : (
                              <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
                                <table className="min-w-full text-left text-xs">
                                  <thead>
                                    <tr className="bg-brand-secondary/95 text-white">
                                      <th className="px-3 py-2 font-semibold">
                                        Critério
                                      </th>
                                      <th className="px-3 py-2 font-semibold text-right">
                                        Peso (%)
                                      </th>
                                      <th className="px-3 py-2 font-semibold text-right">
                                        Nota
                                      </th>
                                      <th className="px-3 py-2 font-semibold">
                                        Justificativa
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-100">
                                    {item.itens.map((criterio) => (
                                      <tr key={criterio.criterioId}>
                                        <td className="px-3 py-2 font-medium text-zinc-800">
                                          {criterio.criterioNome}
                                          <span className="ml-1 text-[10px] text-zinc-500">
                                            (Coletivo)
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {criterio.peso.toFixed(1)}%
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {criterio.nota.toFixed(1)}
                                        </td>
                                        <td className="px-3 py-2 text-zinc-600">
                                          {criterio.justificativa?.trim() ||
                                            "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {dados.length === 0 ? (
        coletivos.length === 0 ? null : (
          <p className="rounded-md border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
            Nenhuma avaliação individual neste filtro.
          </p>
        )
      ) : (
      <div className="space-y-3">
        {coletivos.length > 0 ? (
          <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">
            Avaliações Individuais
          </h3>
        ) : null}
        <div className="overflow-x-auto rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="bg-brand-secondary text-xs uppercase tracking-wide text-white">
                <th className="px-3 py-3 font-semibold">Colaborador</th>
                <th className="px-3 py-3 font-semibold">Departamento</th>
                <th className="px-3 py-3 font-semibold">Competência</th>
                <th className="px-3 py-3 font-semibold text-right">Nota</th>
                <th className="px-3 py-3 font-semibold text-right">
                  Média Histórica
                </th>
                <th className="px-3 py-3 font-semibold">Variação</th>
                <th className="px-3 py-3 font-semibold">Classificação</th>
                <th className="px-3 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {dados.map((item, index) => {
                const chave = `${item.id}-${index}`;
                const aberto = Boolean(abertos[chave]);
                return (
                  <Fragment key={chave}>
                    <tr className="text-zinc-800">
                      <td className="px-3 py-3 font-medium text-zinc-900">
                        {item.colaborador}
                      </td>
                      <td className="px-3 py-3">{item.departamento}</td>
                      <td className="px-3 py-3">{item.competencia}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {item.notaFinal.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {item.mediaHistorica.toFixed(2)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.variacaoBadgeClass}`}
                        >
                          {item.variacao}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.faixaBadgeClass}`}
                        >
                          {item.classificacao}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => toggle(chave)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-brand-primary hover:bg-red-50"
                          >
                            {aberto ? "Ocultar" : "Detalhar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => gerarExtrato(item)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-brand-secondary hover:bg-zinc-100"
                          >
                            Gerar Extrato 1:1 (PDF)
                          </button>
                          <button
                            type="button"
                            onClick={() => editar(item.id)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-brand-secondary hover:bg-zinc-100"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => excluir(item)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                    {aberto ? (
                      <tr className="bg-zinc-50">
                        <td colSpan={8} className="px-3 py-3">
                          <p className="mb-2 text-xs text-zinc-600">
                            Avaliado por:{" "}
                            <span className="font-semibold text-brand-secondary">
                              {item.gestorNome ?? "—"}
                            </span>
                          </p>
                          {item.itens.length === 0 ? (
                            <p className="text-xs text-zinc-500">
                              Sem itens de critério nesta avaliação.
                            </p>
                          ) : (
                            <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
                              <table className="min-w-full text-left text-xs">
                                <thead>
                                  <tr className="bg-brand-secondary/95 text-white">
                                    <th className="px-3 py-2 font-semibold">
                                      Critério
                                    </th>
                                    <th className="px-3 py-2 font-semibold text-right">
                                      Peso (%)
                                    </th>
                                    <th className="px-3 py-2 font-semibold text-right">
                                      Nota (0-10)
                                    </th>
                                    <th className="px-3 py-2 font-semibold text-right">
                                      Contribuição
                                    </th>
                                    <th className="px-3 py-2 font-semibold">
                                      Justificativa
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                  {item.itens.map((criterio) => (
                                    <tr key={criterio.criterioId}>
                                      <td className="px-3 py-2 font-medium text-zinc-800">
                                        {criterio.criterioNome}
                                        {criterio.origem === "DEPARTAMENTO" ? (
                                          <span className="ml-1 text-[10px] text-zinc-500">
                                            (Coletivo)
                                          </span>
                                        ) : null}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums">
                                        {criterio.peso.toFixed(1)}%
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <span
                                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                            criterio.nota >= 9
                                              ? "bg-emerald-100 text-emerald-800"
                                              : criterio.nota < 7
                                                ? "bg-red-100 text-red-800"
                                                : "bg-zinc-100 text-zinc-700"
                                          }`}
                                        >
                                          {criterio.nota.toFixed(1)}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums text-zinc-700">
                                        {criterio.pontos.toFixed(2)}
                                      </td>
                                      <td className="px-3 py-2 text-zinc-600">
                                        {criterio.justificativa?.trim() || "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
