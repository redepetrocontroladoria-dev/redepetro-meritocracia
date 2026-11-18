export const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
] as const;

export function nomeMes(mes: number) {
  return MESES.find((item) => item.value === mes)?.label ?? String(mes);
}

export function formatarCompetencia(mes: number, ano: number) {
  return `${nomeMes(mes).slice(0, 3)}/${ano}`;
}

export function competenciaAnterior(mes: number, ano: number) {
  if (mes <= 1) return { mes: 12, ano: ano - 1 };
  return { mes: mes - 1, ano };
}

export type Variacao = {
  pontos: number;
  percentual: number;
  label: string;
  tendencia: "alta" | "baixa" | "neutro";
  badgeClass: string;
};

export function calcularVariacao(
  atual: number | null | undefined,
  anterior: number | null | undefined,
): Variacao {
  if (atual == null || anterior == null) {
    return {
      pontos: 0,
      percentual: 0,
      label: "—",
      tendencia: "neutro",
      badgeClass: "bg-zinc-100 text-zinc-600",
    };
  }

  const pontos = atual - anterior;
  const percentual = anterior === 0 ? 0 : (pontos / anterior) * 100;

  if (Math.abs(pontos) < 0.005) {
    return {
      pontos: 0,
      percentual: 0,
      label: "0.00",
      tendencia: "neutro",
      badgeClass: "bg-zinc-100 text-zinc-600",
    };
  }

  if (pontos > 0) {
    return {
      pontos,
      percentual,
      label: `↑ +${pontos.toFixed(2)} (+${percentual.toFixed(1)}%)`,
      tendencia: "alta",
      badgeClass: "bg-emerald-100 text-emerald-800",
    };
  }

  return {
    pontos,
    percentual,
    label: `↓ ${pontos.toFixed(2)} (${percentual.toFixed(1)}%)`,
    tendencia: "baixa",
    badgeClass: "bg-red-100 text-red-800",
  };
}

export function mediaDeNotas(notas: number[]) {
  if (notas.length === 0) return null;
  return notas.reduce((total, nota) => total + nota, 0) / notas.length;
}
