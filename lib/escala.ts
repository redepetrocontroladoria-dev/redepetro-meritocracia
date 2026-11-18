export type FaixaDesempenho = {
  label: string;
  descricao: string;
  badgeClass: string;
  barClass: string;
};

export function classificarNota(nota: number): FaixaDesempenho {
  if (nota >= 9) {
    return {
      label: "Excepcional",
      descricao: "Supera consistentemente as expectativas",
      badgeClass: "bg-emerald-100 text-emerald-800",
      barClass: "bg-emerald-600",
    };
  }

  if (nota >= 7) {
    return {
      label: "Pleno",
      descricao: "Atende plenamente às expectativas",
      badgeClass: "bg-blue-100 text-blue-800",
      barClass: "bg-blue-600",
    };
  }

  if (nota >= 4) {
    return {
      label: "Parcial",
      descricao: "Atende parcialmente",
      badgeClass: "bg-amber-100 text-amber-800",
      barClass: "bg-amber-500",
    };
  }

  return {
    label: "Não atendeu",
    descricao: "Abaixo das expectativas",
    badgeClass: "bg-red-100 text-red-800",
    barClass: "bg-brand-primary",
  };
}

export function calcularNotaFinal(
  itens: { nota: number; peso: number }[],
): number {
  const somaPesos = itens.reduce((total, item) => total + item.peso, 0);
  if (somaPesos <= 0) return 0;

  const somaPonderada = itens.reduce(
    (total, item) => total + item.nota * item.peso,
    0,
  );

  return somaPonderada / somaPesos;
}
