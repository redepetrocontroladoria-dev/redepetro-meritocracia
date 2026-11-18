"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  excluirFaixaPagamento,
  salvarFaixaPagamento,
} from "@/actions/bonus";
import {
  calcularBonusColaborador,
  formatarMoeda,
  type FaixaDegrau,
  type ResultadoBonus,
} from "@/lib/calculoMeritocracia";

export type ItemBonusInput = {
  criterioId: string;
  criterioNome: string;
  peso: number;
  nota: number;
  toleranciaZero: boolean;
};

export type LinhaBonus = {
  colaboradorId: string;
  colaborador: string;
  cargo: string;
  departamento: string;
  valorAlvo: number;
  temAvaliacao: boolean;
  itens: ItemBonusInput[];
};

export type FaixaEditavel = FaixaDegrau & { id: string };

type DraftFaixa = {
  id?: string;
  minPercentual: string;
  maxPercentual: string;
  multiplicadorPct: string;
  descricao: string;
};

type BonusApuracaoProps = {
  linhas: LinhaBonus[];
  faixas: FaixaEditavel[];
  competenciaLabel: string;
  isDiretoria?: boolean;
};

function parseDecimalLocal(valor: string) {
  return Number(
    String(valor ?? "")
      .trim()
      .replace(/\s/g, "")
      .replace(",", "."),
  );
}

function faixasParaDraft(faixas: FaixaEditavel[]): DraftFaixa[] {
  return faixas.map((faixa) => ({
    id: String(faixa.id),
    minPercentual: String(Number(faixa.minPercentual.toFixed(2))),
    maxPercentual: String(Number(faixa.maxPercentual.toFixed(2))),
    multiplicadorPct: String(
      Number((faixa.multiplicadorPeso * 100).toFixed(2)),
    ),
    descricao: faixa.descricao,
  }));
}

export function BonusApuracao({
  linhas,
  faixas,
  competenciaLabel,
  isDiretoria = false,
}: BonusApuracaoProps) {
  const router = useRouter();
  const [dias, setDias] = useState<Record<string, number>>(
    Object.fromEntries(linhas.map((item) => [item.colaboradorId, 30])),
  );
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [editandoRegua, setEditandoRegua] = useState(false);
  const [drafts, setDrafts] = useState<DraftFaixa[]>(() =>
    faixasParaDraft(faixas),
  );
  const [erroRegua, setErroRegua] = useState<string | null>(null);
  const [sucessoRegua, setSucessoRegua] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!editandoRegua || savingKey) return;
    setDrafts(faixasParaDraft(faixas));
  }, [faixas, editandoRegua, savingKey]);

  const apurados = useMemo(() => {
    return linhas.map((linha) => {
      const diasTrabalhados = dias[linha.colaboradorId] ?? 30;
      const resultado: ResultadoBonus | null = linha.temAvaliacao
        ? calcularBonusColaborador({
            itens: linha.itens,
            valorAlvo: linha.valorAlvo,
            faixas,
            diasTrabalhados,
          })
        : null;
      return { ...linha, diasTrabalhados, resultado };
    });
  }, [linhas, dias, faixas]);

  function abrirEdicao() {
    setDrafts(faixasParaDraft(faixas));
    setErroRegua(null);
    setSucessoRegua(null);
    setEditandoRegua(true);
  }

  function atualizarDraft(
    index: number,
    campo: keyof DraftFaixa,
    valor: string,
  ) {
    setDrafts((atual) =>
      atual.map((item, i) =>
        i === index ? { ...item, [campo]: valor } : item,
      ),
    );
  }

  function adicionarFaixa() {
    setDrafts((atual) => [
      ...atual,
      {
        minPercentual: "0",
        maxPercentual: "0",
        multiplicadorPct: "0",
        descricao: "Nova faixa",
      },
    ]);
  }

  function chaveFaixa(draft: DraftFaixa, index: number) {
    return draft.id ? String(draft.id) : `nova-${index}`;
  }

  function salvarFaixa(index: number) {
    const draft = drafts[index];
    if (!draft) return;

    const minPercentual = parseDecimalLocal(draft.minPercentual);
    const maxPercentual = parseDecimalLocal(draft.maxPercentual);
    const partePagaPct = parseDecimalLocal(draft.multiplicadorPct);

    if (
      !Number.isFinite(minPercentual) ||
      !Number.isFinite(maxPercentual) ||
      !Number.isFinite(partePagaPct)
    ) {
      setErroRegua("Informe números válidos (use vírgula ou ponto decimal).");
      setSucessoRegua(null);
      return;
    }

    const key = chaveFaixa(draft, index);
    setErroRegua(null);
    setSucessoRegua(null);
    setSavingKey(key);

    startTransition(async () => {
      try {
        const result = await salvarFaixaPagamento({
          id: draft.id ? String(draft.id) : undefined,
          minPercentual,
          maxPercentual,
          multiplicadorPeso: partePagaPct / 100,
          descricao: draft.descricao,
        });

        if (!result.ok) {
          setErroRegua(result.error);
          setSucessoRegua(null);
          return;
        }

        setSucessoRegua(
          draft.id
            ? "Faixa atualizada com sucesso!"
            : "Faixa criada com sucesso!",
        );
        router.refresh();
      } catch (error) {
        setErroRegua(
          error instanceof Error ? error.message : "Erro ao salvar faixa.",
        );
        setSucessoRegua(null);
      } finally {
        setSavingKey(null);
      }
    });
  }

  function excluirFaixa(index: number) {
    const draft = drafts[index];
    if (!draft) return;
    if (!draft.id) {
      setDrafts((atual) => atual.filter((_, i) => i !== index));
      return;
    }
    if (!window.confirm("Excluir esta faixa da régua?")) return;
    const key = chaveFaixa(draft, index);
    setErroRegua(null);
    setSucessoRegua(null);
    setSavingKey(key);
    startTransition(async () => {
      try {
        const result = await excluirFaixaPagamento(String(draft.id));
        if (!result.ok) {
          setErroRegua(result.error);
          return;
        }
        setSucessoRegua("Faixa excluída com sucesso!");
        router.refresh();
      } catch (error) {
        setErroRegua(
          error instanceof Error ? error.message : "Erro ao excluir faixa.",
        );
      } finally {
        setSavingKey(null);
      }
    });
  }

  const detalhe = apurados.find((item) => item.colaboradorId === detalheId);

  function exportarExcel() {
    const workbook = XLSX.utils.book_new();
    const resumo = apurados.map((item) => ({
      Competência: competenciaLabel,
      Colaborador: item.colaborador,
      Cargo: item.cargo,
      Departamento: item.departamento,
      "Valor-Alvo (R$)": item.valorAlvo,
      "% Atingido": item.resultado
        ? Number(item.resultado.percentualAtingido.toFixed(2))
        : null,
      Dias: item.diasTrabalhados,
      "Valor Final (R$)": item.resultado
        ? Number(item.resultado.valorFinal.toFixed(2))
        : null,
      Status: item.temAvaliacao ? "Avaliado" : "Sem avaliação",
    }));
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(resumo),
      "Apuração",
    );

    const memoria = apurados.flatMap((item) =>
      (item.resultado?.memoria ?? []).map((criterio) => ({
        Competência: competenciaLabel,
        Colaborador: item.colaborador,
        Departamento: item.departamento,
        Critério: criterio.criterioNome,
        "Peso (%)": criterio.peso,
        Nota: criterio.nota,
        "Atingimento (%)": Number(criterio.atingimento.toFixed(2)),
        "Parte Paga (%)": Number(criterio.partePaga.toFixed(2)),
        "Contribuição (%)": Number(criterio.contribuicao.toFixed(2)),
        Faixa: criterio.faixaDescricao,
      })),
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        memoria.length > 0
          ? memoria
          : [{ Competência: competenciaLabel, Colaborador: "", Critério: "" }],
      ),
      "Memória de Cálculo",
    );

    XLSX.writeFile(workbook, "apuracao-bonus.xlsx");
  }

  function exportarPdf() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.setTextColor(176, 31, 36);
    doc.text("Apuração de Bônus - REDEPETRO", 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(26, 26, 26);
    doc.text(`Competência: ${competenciaLabel}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [
        [
          "Colaborador",
          "Depto",
          "Valor-Alvo",
          "% Atingido",
          "Dias",
          "Valor Final",
        ],
      ],
      body: apurados.map((item) => [
        item.colaborador,
        item.departamento,
        formatarMoeda(item.valorAlvo),
        item.resultado
          ? `${item.resultado.percentualAtingido.toFixed(1)}%`
          : "—",
        String(item.diasTrabalhados),
        item.resultado ? formatarMoeda(item.resultado.valorFinal) : "—",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 26, 26], textColor: [255, 255, 255] },
    });

    let finalY =
      (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? 40;

    for (const item of apurados.filter((l) => l.resultado)) {
      if (finalY > 240) {
        doc.addPage();
        finalY = 16;
      }
      doc.setFontSize(10);
      doc.setTextColor(176, 31, 36);
      doc.text(
        `${item.colaborador} — ${item.resultado!.percentualAtingido.toFixed(1)}% → ${formatarMoeda(item.resultado!.valorFinal)}`,
        14,
        finalY + 10,
      );
      autoTable(doc, {
        startY: finalY + 14,
        head: [["Critério", "Peso", "Nota", "Ating.%", "Parte%", "Contrib.%"]],
        body: item.resultado!.memoria.map((c) => [
          c.criterioNome,
          `${c.peso.toFixed(1)}%`,
          c.nota.toFixed(1),
          `${c.atingimento.toFixed(1)}%`,
          `${c.partePaga.toFixed(1)}%`,
          `${c.contribuicao.toFixed(2)}%`,
        ]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [176, 31, 36], textColor: [255, 255, 255] },
      });
      finalY =
        (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? finalY;
    }

    doc.save("apuracao-bonus.pdf");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-secondary">
            Régua de Degraus (Escada de Gatilhos)
          </h2>
          {isDiretoria ? (
            <button
              type="button"
              onClick={() =>
                editandoRegua ? setEditandoRegua(false) : abrirEdicao()
              }
              className="rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            >
              {editandoRegua ? "Fechar Edição" : "Editar Régua"}
            </button>
          ) : null}
        </div>

        {editandoRegua && isDiretoria ? (
          <div className="space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
            {sucessoRegua ? (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {sucessoRegua}
              </p>
            ) : null}
            {erroRegua ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {erroRegua}
              </p>
            ) : null}
            {drafts.map((draft, index) => {
              const key = chaveFaixa(draft, index);
              const salvando = savingKey === key;
              return (
              <div
                key={key}
                className="grid gap-3 rounded-md border border-zinc-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5"
              >
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-600">
                    % Mínimo
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draft.minPercentual}
                    onChange={(e) =>
                      atualizarDraft(index, "minPercentual", e.target.value)
                    }
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-600">
                    % Máximo
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draft.maxPercentual}
                    onChange={(e) =>
                      atualizarDraft(index, "maxPercentual", e.target.value)
                    }
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-600">
                    Parte Paga (%)
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draft.multiplicadorPct}
                    onChange={(e) =>
                      atualizarDraft(index, "multiplicadorPct", e.target.value)
                    }
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2 lg:col-span-1">
                  <span className="text-xs font-medium text-zinc-600">
                    Descrição
                  </span>
                  <input
                    type="text"
                    value={draft.descricao}
                    onChange={(e) =>
                      atualizarDraft(index, "descricao", e.target.value)
                    }
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                  />
                </label>
                <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
                  <button
                    type="button"
                    disabled={pending || salvando}
                    onClick={() => salvarFaixa(index)}
                    className="rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
                  >
                    {salvando ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    type="button"
                    disabled={pending || salvando}
                    onClick={() => excluirFaixa(index)}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Excluir
                  </button>
                </div>
              </div>
              );
            })}
            <button
              type="button"
              onClick={adicionarFaixa}
              disabled={pending}
              className="rounded-md border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-brand-secondary hover:bg-white disabled:opacity-60"
            >
              + Nova Faixa
            </button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {faixas.map((faixa) => (
              <div
                key={faixa.id}
                className="rounded-md border border-zinc-200 border-l-4 border-l-brand-primary px-3 py-2"
              >
                <p className="text-xs font-semibold text-brand-secondary">
                  {faixa.minPercentual.toFixed(0)}% –{" "}
                  {faixa.maxPercentual.toFixed(2)}%
                </p>
                <p className="mt-1 text-sm text-zinc-700">{faixa.descricao}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Multiplicador: {(faixa.multiplicadorPeso * 100).toFixed(0)}%
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-secondary">
            Apuração por Colaborador
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportarExcel}
              className="rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            >
              Exportar Excel
            </button>
            <button
              type="button"
              onClick={exportarPdf}
              className="rounded-md bg-brand-secondary px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Exportar PDF
            </button>
          </div>
        </div>

        {apurados.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500">
            Nenhum colaborador no escopo selecionado.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-brand-secondary text-xs uppercase tracking-wide text-white">
                  <th className="px-3 py-3 font-semibold">Colaborador</th>
                  <th className="px-3 py-3 font-semibold">Departamento</th>
                  <th className="px-3 py-3 font-semibold text-right">
                    Valor-Alvo
                  </th>
                  <th className="px-3 py-3 font-semibold text-right">
                    % Atingido
                  </th>
                  <th className="px-3 py-3 font-semibold text-right">Dias</th>
                  <th className="px-3 py-3 font-semibold text-right">
                    Valor Final
                  </th>
                  <th className="px-3 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {apurados.map((item) => (
                  <tr key={item.colaboradorId}>
                    <td className="px-3 py-3">
                      <p className="font-medium text-zinc-900">
                        {item.colaborador}
                      </p>
                      <p className="text-xs text-zinc-500">{item.cargo}</p>
                    </td>
                    <td className="px-3 py-3">{item.departamento}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatarMoeda(item.valorAlvo)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {item.resultado
                        ? `${item.resultado.percentualAtingido.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={item.diasTrabalhados}
                        onChange={(e) =>
                          setDias((atual) => ({
                            ...atual,
                            [item.colaboradorId]: Math.min(
                              30,
                              Math.max(1, Number(e.target.value) || 1),
                            ),
                          }))
                        }
                        className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                      />
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-brand-primary">
                      {item.resultado
                        ? formatarMoeda(item.resultado.valorFinal)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        disabled={!item.resultado}
                        onClick={() =>
                          setDetalheId(
                            detalheId === item.colaboradorId
                              ? null
                              : item.colaboradorId,
                          )
                        }
                        className="rounded-md px-2 py-1 text-xs font-medium text-brand-primary hover:bg-red-50 disabled:opacity-40"
                      >
                        {detalheId === item.colaboradorId
                          ? "Ocultar"
                          : "Detalhar Cálculo"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detalhe?.resultado ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand-secondary">
            Memória de Cálculo — {detalhe.colaborador}
          </h3>
          <p className="mb-4 text-sm text-zinc-500">
            {detalhe.resultado.percentualAtingido.toFixed(1)}% do valor-alvo ×{" "}
            {detalhe.diasTrabalhados}/30 ={" "}
            <span className="font-semibold text-brand-primary">
              {formatarMoeda(detalhe.resultado.valorFinal)}
            </span>
          </p>
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-brand-secondary text-xs uppercase tracking-wide text-white">
                  <th className="px-3 py-3 font-semibold">Critério</th>
                  <th className="px-3 py-3 font-semibold text-right">Peso</th>
                  <th className="px-3 py-3 font-semibold text-right">Nota</th>
                  <th className="px-3 py-3 font-semibold text-right">
                    Atingimento
                  </th>
                  <th className="px-3 py-3 font-semibold text-right">
                    Parte Paga
                  </th>
                  <th className="px-3 py-3 font-semibold text-right">
                    Contribuição
                  </th>
                  <th className="px-3 py-3 font-semibold">Faixa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {detalhe.resultado.memoria.map((item) => (
                  <tr key={item.criterioId}>
                    <td className="px-3 py-3 font-medium">{item.criterioNome}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {item.peso.toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {item.nota.toFixed(1)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {item.atingimento.toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {item.partePaga.toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {item.contribuicao.toFixed(2)}%
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-600">
                      {item.faixaDescricao}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
