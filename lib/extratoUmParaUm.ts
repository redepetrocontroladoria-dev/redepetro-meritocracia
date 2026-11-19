import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { baixarOuAbrirPdf } from "@/lib/baixarPdf";
import { formatarMoeda } from "@/lib/calculoMeritocracia";

export type ExtratoItem = {
  criterioNome: string;
  peso: number;
  nota: number;
  partePaga?: number;
  contribuicao?: number;
  justificativa?: string | null;
  origem?: string;
};

export type ExtratoResumoMensal = {
  competencia: string;
  notaConsolidada: number | null;
  percentualAtingido: number | null;
  valorMes: number;
};

export type ExtratoUmParaUmInput = {
  colaborador: string;
  cargo: string;
  departamento: string;
  competencia: string;
  gestorResponsavel: string;
  notaFinal: number;
  percentualAtingido?: number | null;
  valorFinalBonus?: number | null;
  itens: ExtratoItem[];
  resumoMensal?: ExtratoResumoMensal[];
};

export function gerarExtratoUmParaUmPdf(input: ExtratoUmParaUmInput) {
  const doc = new jsPDF();
  const brand = { r: 176, g: 31, b: 36 };
  const dark = { r: 26, g: 26, b: 26 };

  doc.setFillColor(brand.r, brand.g, brand.b);
  doc.rect(0, 0, 210, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("REDEPETRO — Extrato de Feedback 1:1", 14, 12);

  doc.setTextColor(dark.r, dark.g, dark.b);
  doc.setFontSize(11);
  doc.text(input.colaborador, 14, 28);
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Cargo: ${input.cargo}`, 14, 34);
  doc.text(`Departamento: ${input.departamento}`, 14, 39);
  doc.text(`Competência: ${input.competencia}`, 14, 44);
  doc.text(`Gestor responsável: ${input.gestorResponsavel}`, 14, 49);

  let cursorY = 56;

  if (input.resumoMensal && input.resumoMensal.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [["Mês/Ano", "Nota", "% Atingido", "Valor R$"]],
      body: input.resumoMensal.map((mes) => [
        mes.competencia,
        mes.notaConsolidada != null ? mes.notaConsolidada.toFixed(2) : "—",
        mes.percentualAtingido != null
          ? `${mes.percentualAtingido.toFixed(1)}%`
          : "—",
        formatarMoeda(mes.valorMes),
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: {
        fillColor: [brand.r, brand.g, brand.b],
        textColor: [255, 255, 255],
      },
    });
    cursorY =
      ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? cursorY) + 8;
  }

  autoTable(doc, {
    startY: cursorY,
    head: [
      [
        "Critério",
        "Peso %",
        "Nota",
        "Degrau %",
        "Contrib. %",
        "Justificativa",
      ],
    ],
    body: input.itens.map((item) => [
      `${item.criterioNome}${item.origem === "DEPARTAMENTO" ? " (Coletivo)" : ""}`,
      item.peso.toFixed(1),
      item.nota.toFixed(1),
      item.partePaga != null ? item.partePaga.toFixed(1) : "—",
      item.contribuicao != null ? item.contribuicao.toFixed(2) : "—",
      item.justificativa?.trim() || "—",
    ]),
    styles: { fontSize: 7, cellPadding: 1.5, valign: "top" },
    headStyles: {
      fillColor: [dark.r, dark.g, dark.b],
      textColor: [255, 255, 255],
    },
    columnStyles: {
      5: { cellWidth: 55 },
    },
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 70;

  doc.setFillColor(248, 248, 248);
  doc.roundedRect(14, finalY + 8, 182, 28, 2, 2, "F");
  doc.setTextColor(dark.r, dark.g, dark.b);
  doc.setFontSize(10);
  doc.text("Resumo do Ciclo", 18, finalY + 16);
  doc.setFontSize(9);
  doc.text(`Nota consolidada: ${input.notaFinal.toFixed(2)}`, 18, finalY + 23);
  doc.text(
    `% Valor-Alvo: ${
      input.percentualAtingido != null
        ? `${input.percentualAtingido.toFixed(1)}%`
        : "—"
    }`,
    80,
    finalY + 23,
  );
  doc.setTextColor(brand.r, brand.g, brand.b);
  doc.text(
    `Bônus: ${
      input.valorFinalBonus != null
        ? formatarMoeda(input.valorFinalBonus)
        : "—"
    }`,
    140,
    finalY + 23,
  );

  const signY = finalY + 50;
  doc.setTextColor(dark.r, dark.g, dark.b);
  doc.setFontSize(9);
  doc.text("Ciência na reunião de feedback", 14, signY);
  doc.line(14, signY + 18, 90, signY + 18);
  doc.line(120, signY + 18, 196, signY + 18);
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Assinatura do Gestor", 14, signY + 23);
  doc.text("Assinatura do Colaborador", 120, signY + 23);

  const nome = `extrato-1para1-${input.colaborador}-${input.competencia}.pdf`;
  baixarOuAbrirPdf(doc, nome);
}
