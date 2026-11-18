"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { excluirAvaliacao } from "@/actions/avaliacoes";
import type { AvaliacaoRelatorio } from "@/components/RelatoriosExport";

export function TabelaAvaliacoesDetalhe({
  dados,
}: {
  dados: AvaliacaoRelatorio[];
}) {
  const router = useRouter();
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [erro, setErro] = useState<string | null>(null);
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
    startTransition(async () => {
      try {
        await excluirAvaliacao(item.id);
        router.refresh();
      } catch (error) {
        setErro(
          error instanceof Error ? error.message : "Erro ao excluir avaliação.",
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      {erro ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
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
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100">
                                {item.itens.map((criterio) => (
                                  <tr key={criterio.criterioId}>
                                    <td className="px-3 py-2 font-medium text-zinc-800">
                                      {criterio.criterioNome}
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
  );
}
