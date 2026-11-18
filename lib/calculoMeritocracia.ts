export type FaixaDegrau = {
  minPercentual: number;
  maxPercentual: number;
  multiplicadorPeso: number;
  descricao: string;
};

export type ItemCalculoInput = {
  criterioId: string;
  criterioNome: string;
  peso: number;
  nota: number;
  toleranciaZero: boolean;
};

export type MemoriaCriterio = {
  criterioId: string;
  criterioNome: string;
  peso: number;
  nota: number;
  atingimento: number;
  partePaga: number;
  contribuicao: number;
  faixaDescricao: string;
  zeradoPorTolerancia: boolean;
};

export type ResultadoBonus = {
  percentualAtingido: number;
  valorAlvo: number;
  diasTrabalhados: number;
  diasBase: number;
  proporcionalidade: number;
  valorFinal: number;
  memoria: MemoriaCriterio[];
};

export const FAIXAS_PADRAO: FaixaDegrau[] = [
  {
    minPercentual: 100,
    maxPercentual: 100,
    multiplicadorPeso: 1,
    descricao: "100% do peso",
  },
  {
    minPercentual: 95,
    maxPercentual: 99.99,
    multiplicadorPeso: 0.85,
    descricao: "85% do peso",
  },
  {
    minPercentual: 90,
    maxPercentual: 94.99,
    multiplicadorPeso: 0.7,
    descricao: "70% do peso",
  },
  {
    minPercentual: 85,
    maxPercentual: 89.99,
    multiplicadorPeso: 0.5,
    descricao: "50% do peso",
  },
  {
    minPercentual: 80,
    maxPercentual: 84.99,
    multiplicadorPeso: 0.3,
    descricao: "30% do peso",
  },
  {
    minPercentual: 0,
    maxPercentual: 79.99,
    multiplicadorPeso: 0,
    descricao: "0% do peso",
  },
];

export function notaParaAtingimento(nota: number) {
  return Math.max(0, Math.min(100, nota * 10));
}

export function encontrarFaixa(
  atingimento: number,
  faixas: FaixaDegrau[],
): FaixaDegrau {
  const ordenadas = [...faixas].sort(
    (a, b) => b.minPercentual - a.minPercentual,
  );
  for (const faixa of ordenadas) {
    if (
      atingimento >= faixa.minPercentual - 0.0001 &&
      atingimento <= faixa.maxPercentual + 0.0001
    ) {
      return faixa;
    }
  }
  return (
    ordenadas.find((f) => f.multiplicadorPeso === 0) ??
    FAIXAS_PADRAO[FAIXAS_PADRAO.length - 1]
  );
}

export function calcularBonusColaborador(params: {
  itens: ItemCalculoInput[];
  valorAlvo: number;
  faixas: FaixaDegrau[];
  diasTrabalhados?: number;
  diasBase?: number;
}): ResultadoBonus {
  const diasTrabalhados = Math.min(
    30,
    Math.max(1, Number(params.diasTrabalhados) || 30),
  );
  const diasBase = Math.max(1, Number(params.diasBase) || 30);
  const proporcionalidade = diasTrabalhados / diasBase;

  const memoria = params.itens.map((item) => {
    const atingimento = notaParaAtingimento(item.nota);
    const zeradoPorTolerancia =
      item.toleranciaZero && atingimento < 100 - 0.0001;
    const faixa = encontrarFaixa(atingimento, params.faixas);
    const partePaga = zeradoPorTolerancia
      ? 0
      : faixa.multiplicadorPeso * 100;
    const contribuicao = item.peso * (partePaga / 100);

    return {
      criterioId: item.criterioId,
      criterioNome: item.criterioNome,
      peso: item.peso,
      nota: item.nota,
      atingimento,
      partePaga,
      contribuicao,
      faixaDescricao: zeradoPorTolerancia
        ? "Tolerância zero — peso zerado"
        : faixa.descricao,
      zeradoPorTolerancia,
    };
  });

  const percentualAtingido = memoria.reduce(
    (total, item) => total + item.contribuicao,
    0,
  );
  const valorFinal =
    (params.valorAlvo * percentualAtingido) / 100 * proporcionalidade;

  return {
    percentualAtingido,
    valorAlvo: params.valorAlvo,
    diasTrabalhados,
    diasBase,
    proporcionalidade,
    valorFinal,
    memoria,
  };
}

export function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}
