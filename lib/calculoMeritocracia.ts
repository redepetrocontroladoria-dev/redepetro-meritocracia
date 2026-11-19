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
    minPercentual: 90,
    maxPercentual: 99.99,
    multiplicadorPeso: 0.9,
    descricao: "90% do peso",
  },
  {
    minPercentual: 80,
    maxPercentual: 89.99,
    multiplicadorPeso: 0.8,
    descricao: "80% do peso",
  },
  {
    minPercentual: 70,
    maxPercentual: 79.99,
    multiplicadorPeso: 0.65,
    descricao: "65% do peso",
  },
  {
    minPercentual: 60,
    maxPercentual: 69.99,
    multiplicadorPeso: 0.5,
    descricao: "50% do peso",
  },
  {
    minPercentual: 0,
    maxPercentual: 59.99,
    multiplicadorPeso: 0,
    descricao: "0% do peso",
  },
];

export function legendaReguaDegraus(faixas: FaixaDegrau[] = FAIXAS_PADRAO) {
  const ordenadas = [...faixas].sort(
    (a, b) => b.minPercentual - a.minPercentual,
  );
  return ordenadas.map((faixa, index) => {
    const parte = `${Number((faixa.multiplicadorPeso * 100).toFixed(0))}% do peso`;
    if (faixa.minPercentual >= 100) {
      return { atingimento: "100%", parte };
    }
    if (faixa.multiplicadorPeso <= 0 || faixa.minPercentual <= 0) {
      const limiar =
        ordenadas[index - 1]?.minPercentual ??
        faixa.maxPercentual + 0.01;
      return { atingimento: `< ${Number(limiar.toFixed(0))}%`, parte };
    }
    return {
      atingimento: `${Number(faixa.minPercentual.toFixed(0))}%`,
      parte,
    };
  });
}

export function degrausRapidosDeFaixas(faixas: FaixaDegrau[] = FAIXAS_PADRAO) {
  const ordenadas = [...faixas].sort(
    (a, b) => b.minPercentual - a.minPercentual,
  );
  return ordenadas.map((faixa, index) => {
    const partePct = Number((faixa.multiplicadorPeso * 100).toFixed(0));
    const nota =
      faixa.minPercentual <= 0
        ? 0
        : Number((faixa.minPercentual / 10).toFixed(1));
    const limiarInferior =
      ordenadas[index - 1]?.minPercentual ?? faixa.maxPercentual + 0.01;
    const label =
      faixa.minPercentual >= 100
        ? "100% Meta"
        : faixa.multiplicadorPeso <= 0 || faixa.minPercentual <= 0
          ? `< ${Number(limiarInferior.toFixed(0))}%`
          : `${Number(faixa.minPercentual.toFixed(0))}%`;
    const detalhe = `${nota.toFixed(1)} — ${partePct}% peso`;
    return {
      label,
      detalhe,
      nota,
      minPercentual: faixa.minPercentual,
      maxPercentual: faixa.maxPercentual,
      multiplicadorPeso: faixa.multiplicadorPeso,
    };
  });
}

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

export type MesCicloInput = {
  mes: number;
  ano: number;
  temAvaliacao: boolean;
  itens: ItemCalculoInput[];
};

export type ResumoMesCiclo = {
  mes: number;
  ano: number;
  temAvaliacao: boolean;
  notaConsolidada: number | null;
  percentualAtingido: number | null;
  valorMes: number;
  memoria: MemoriaCriterio[];
};

export type ResultadoBonusCiclo = {
  mesesNoCiclo: number;
  mesesAvaliados: number;
  valorAlvoCiclo: number;
  percentualMedio: number;
  diasTrabalhados: number;
  diasBase: number;
  proporcionalidade: number;
  valorFinal: number;
  resumoMensal: ResumoMesCiclo[];
  memoriaConsolidada: MemoriaCriterio[];
};

export function calcularBonusCiclo(params: {
  meses: MesCicloInput[];
  valorAlvoMensal: number;
  faixas: FaixaDegrau[];
  baseValor: "mensal_x_meses" | "unico_ciclo" | "soma_mensal";
  diasTrabalhados?: number;
}): ResultadoBonusCiclo {
  const mesesNoCiclo = Math.max(1, params.meses.length);
  const diasBase = 30 * mesesNoCiclo;
  const diasTrabalhados = Math.min(
    diasBase,
    Math.max(1, Number(params.diasTrabalhados) || diasBase),
  );
  const proporcionalidade = diasTrabalhados / diasBase;

  const valorAlvoCiclo =
    params.baseValor === "unico_ciclo"
      ? params.valorAlvoMensal
      : params.valorAlvoMensal * mesesNoCiclo;

  const resumoMensal: ResumoMesCiclo[] = params.meses.map((competencia) => {
    if (!competencia.temAvaliacao || competencia.itens.length === 0) {
      return {
        mes: competencia.mes,
        ano: competencia.ano,
        temAvaliacao: false,
        notaConsolidada: null,
        percentualAtingido: null,
        valorMes: 0,
        memoria: [],
      };
    }

    const mensal = calcularBonusColaborador({
      itens: competencia.itens,
      valorAlvo: params.valorAlvoMensal,
      faixas: params.faixas,
      diasTrabalhados: 30,
      diasBase: 30,
    });

    const notaConsolidada = mensal.percentualAtingido / 10;

    return {
      mes: competencia.mes,
      ano: competencia.ano,
      temAvaliacao: true,
      notaConsolidada,
      percentualAtingido: mensal.percentualAtingido,
      valorMes: mensal.valorFinal,
      memoria: mensal.memoria,
    };
  });

  const mesesAvaliados = resumoMensal.filter((m) => m.temAvaliacao).length;

  const percentuais = resumoMensal.map((m) =>
    m.temAvaliacao && m.percentualAtingido != null ? m.percentualAtingido : 0,
  );
  const percentualMedio =
    percentuais.reduce((total, p) => total + p, 0) / mesesNoCiclo;

  let valorFinalBruto = 0;
  if (params.baseValor === "soma_mensal") {
    valorFinalBruto = resumoMensal.reduce((total, m) => total + m.valorMes, 0);
  } else {
    valorFinalBruto = (valorAlvoCiclo * percentualMedio) / 100;
  }

  const valorFinal = valorFinalBruto * proporcionalidade;

  const memoriaPorCriterio = new Map<string, MemoriaCriterio & { n: number }>();
  for (const mes of resumoMensal) {
    for (const item of mes.memoria) {
      const atual = memoriaPorCriterio.get(item.criterioId);
      if (!atual) {
        memoriaPorCriterio.set(item.criterioId, { ...item, n: 1 });
        continue;
      }
      memoriaPorCriterio.set(item.criterioId, {
        ...atual,
        nota: atual.nota + item.nota,
        atingimento: atual.atingimento + item.atingimento,
        partePaga: atual.partePaga + item.partePaga,
        contribuicao: atual.contribuicao + item.contribuicao,
        n: atual.n + 1,
      });
    }
  }

  const memoriaConsolidada = Array.from(memoriaPorCriterio.values()).map(
    (item) => ({
      criterioId: item.criterioId,
      criterioNome: item.criterioNome,
      peso: item.peso,
      nota: item.nota / item.n,
      atingimento: item.atingimento / item.n,
      partePaga: item.partePaga / item.n,
      contribuicao: item.contribuicao / item.n,
      faixaDescricao: item.faixaDescricao,
      zeradoPorTolerancia: item.zeradoPorTolerancia,
    }),
  );

  return {
    mesesNoCiclo,
    mesesAvaliados,
    valorAlvoCiclo,
    percentualMedio,
    diasTrabalhados,
    diasBase,
    proporcionalidade,
    valorFinal,
    resumoMensal,
    memoriaConsolidada,
  };
}
