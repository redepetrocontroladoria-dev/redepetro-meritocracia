"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { ResumoMetaEquipe } from "@/components/MetaEquipePanel";
import type { DesempenhoDepartamento } from "@/lib/desempenho";
import { classificarNota } from "@/lib/escala";

export type ItemCriterioRelatorio = {
  criterioId: string;
  criterioNome: string;
  peso: number;
  nota: number;
  pontos: number;
};

export type AvaliacaoRelatorio = {
  id: string;
  colaborador: string;
  cargo: string;
  departamento: string;
  competencia: string;
  data: string;
  notaFinal: number;
  mediaHistorica: number;
  variacao: string;
  classificacao: string;
  variacaoBadgeClass?: string;
  faixaBadgeClass?: string;
  itens: ItemCriterioRelatorio[];
};

type RelatoriosExportProps = {
  dados: AvaliacaoRelatorio[];
  consolidado: DesempenhoDepartamento[];
  competenciaLabel: string;
  resumoMeta?: ResumoMetaEquipe | null;
};

export function RelatoriosExport({
  dados,
  consolidado,
  competenciaLabel,
  resumoMeta = null,
}: RelatoriosExportProps) {
  const semDados = dados.length === 0 && consolidado.length === 0;
  const detalhamento = dados.flatMap((item) =>
    item.itens.map((criterio) => ({
      Competência: item.competencia,
      Departamento: item.departamento,
      Colaborador: item.colaborador,
      Critério: criterio.criterioNome,
      "Peso (%)": Number(criterio.peso.toFixed(1)),
      "Nota (0-10)": Number(criterio.nota.toFixed(2)),
      "Pontos Ponderados": Number(criterio.pontos.toFixed(2)),
    })),
  );

  function exportarExcel() {
    const workbook = XLSX.utils.book_new();

    const sheetConsolidado = XLSX.utils.json_to_sheet(
      consolidado.map((item, index) => ({
        Ranking: index + 1,
        Competência: competenciaLabel,
        Departamento: item.departamento,
        "Total de Avaliações": item.totalAvaliacoes,
        "Colaboradores Avaliados": item.colaboradoresAvaliados,
        "Nota Média (0-10)": Number(item.notaMedia.toFixed(2)),
        "Variação vs. Mês Anterior": item.variacaoLabel ?? "—",
        Classificação: classificarNota(item.notaMedia).label,
      })),
    );
    XLSX.utils.book_append_sheet(workbook, sheetConsolidado, "Departamentos");

    const sheetAvaliacoes = XLSX.utils.json_to_sheet(
      dados.map((item) => ({
        Colaborador: item.colaborador,
        Cargo: item.cargo,
        Departamento: item.departamento,
        Competência: item.competencia,
        Data: item.data,
        "Nota Final (0-10)": item.notaFinal,
        "Média Histórica": item.mediaHistorica,
        "Variação vs. Mês Anterior": item.variacao,
        Classificação: item.classificacao,
      })),
    );
    XLSX.utils.book_append_sheet(workbook, sheetAvaliacoes, "Avaliações");

    const sheetDetalhe = XLSX.utils.json_to_sheet(
      detalhamento.length > 0
        ? detalhamento
        : [
            {
              Competência: "",
              Departamento: "",
              Colaborador: "",
              Critério: "",
              "Peso (%)": "",
              "Nota (0-10)": "",
              "Pontos Ponderados": "",
            },
          ],
    );
    XLSX.utils.book_append_sheet(
      workbook,
      sheetDetalhe,
      "Detalhamento por Critério",
    );

    XLSX.writeFile(workbook, "relatorio-avaliacoes.xlsx");
  }

  function exportarPdf() {
    const doc = new jsPDF();
    let cursorY = 16;

    doc.setFontSize(14);
    doc.setTextColor(176, 31, 36);
    doc.text("Relatório de Avaliações - REDEPETRO", 14, cursorY);
    cursorY += 6;
    doc.setFontSize(10);
    doc.setTextColor(26, 26, 26);
    doc.text(`Competência: ${competenciaLabel}`, 14, cursorY);
    cursorY += 6;

    if (resumoMeta) {
      const ating =
        resumoMeta.atingimento == null
          ? "—"
          : `${resumoMeta.atingimento.toFixed(1)}%`;
      const media =
        resumoMeta.mediaEquipe == null
          ? "—"
          : resumoMeta.mediaEquipe.toFixed(2);
      doc.setFontSize(10);
      doc.setTextColor(176, 31, 36);
      doc.text(
        `Atingimento Meta Equipe (${resumoMeta.departamentoNome}): ${ating}`,
        14,
        cursorY,
      );
      cursorY += 5;
      doc.setTextColor(26, 26, 26);
      doc.text(
        `Média: ${media}/10 · Cobertura: ${resumoMeta.colaboradoresAvaliados}/${resumoMeta.colaboradoresAtivos} (${resumoMeta.coberturaPercentual.toFixed(0)}%)`,
        14,
        cursorY,
      );
      cursorY += 4;

      if (resumoMeta.criterios.length > 0) {
        autoTable(doc, {
          startY: cursorY + 2,
          head: [["Critério", "Peso", "Média", "% Atingimento", "100%"]],
          body: resumoMeta.criterios.map((item) => [
            item.nome,
            `${item.peso.toFixed(1)}%`,
            item.media.toFixed(2),
            `${item.atingimento.toFixed(1)}%`,
            `${item.atingiramMaximo}/${item.totalAvaliados}`,
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: {
            fillColor: [176, 31, 36],
            textColor: [255, 255, 255],
          },
        });
        cursorY =
          (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
            ?.finalY ?? cursorY;
        cursorY += 8;
      } else {
        cursorY += 6;
      }
    }

    autoTable(doc, {
      startY: cursorY,
      head: [["#", "Departamento", "Avaliações", "Média", "Variação", "Classe"]],
      body: consolidado.map((item, index) => [
        String(index + 1),
        item.departamento,
        String(item.totalAvaliacoes),
        item.notaMedia.toFixed(2),
        item.variacaoLabel ?? "—",
        classificarNota(item.notaMedia).label,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: {
        fillColor: [26, 26, 26],
        textColor: [255, 255, 255],
      },
    });

    let finalY =
      (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? cursorY + 10;

    doc.setFontSize(11);
    doc.text("Histórico Individual", 14, finalY + 10);

    autoTable(doc, {
      startY: finalY + 14,
      head: [
        ["Colaborador", "Depto", "Competência", "Nota", "Histórica", "Variação"],
      ],
      body: dados.map((item) => [
        item.colaborador,
        item.departamento,
        item.competencia,
        item.notaFinal.toFixed(2),
        item.mediaHistorica.toFixed(2),
        item.variacao,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: {
        fillColor: [176, 31, 36],
        textColor: [255, 255, 255],
      },
    });

    finalY =
      (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? finalY;

    if (detalhamento.length > 0) {
      if (finalY > 250) {
        doc.addPage();
        finalY = 16;
      }

      doc.setFontSize(11);
      doc.setTextColor(26, 26, 26);
      doc.text("Detalhamento por Critério", 14, finalY + 12);

      autoTable(doc, {
        startY: finalY + 16,
        head: [
          [
            "Competência",
            "Depto",
            "Colaborador",
            "Critério",
            "Peso",
            "Nota",
            "Pts",
          ],
        ],
        body: detalhamento.map((item) => [
          String(item.Competência),
          String(item.Departamento),
          String(item.Colaborador),
          String(item.Critério),
          `${item["Peso (%)"]}%`,
          String(item["Nota (0-10)"]),
          String(item["Pontos Ponderados"]),
        ]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: {
          fillColor: [26, 26, 26],
          textColor: [255, 255, 255],
        },
        didParseCell: (data) => {
          if (data.section !== "body" || data.column.index !== 5) return;
          const nota = Number(data.cell.raw);
          if (!Number.isFinite(nota)) return;
          if (nota < 7) {
            data.cell.styles.textColor = [176, 31, 36];
            data.cell.styles.fontStyle = "bold";
          } else if (nota >= 9) {
            data.cell.styles.textColor = [6, 95, 70];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
    }

    doc.save("relatorio-avaliacoes.pdf");
  }

  return (
    <div className="mb-4 flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={exportarExcel}
        disabled={semDados}
        className="rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Exportar para Excel
      </button>
      <button
        type="button"
        onClick={exportarPdf}
        disabled={semDados}
        className="rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Exportar para PDF
      </button>
    </div>
  );
}
