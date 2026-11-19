import { formatarCompetencia, MESES, nomeMes } from "@/lib/competencia";

export type PeriodicidadeCiclo =
  | "mensal"
  | "trimestral"
  | "semestral"
  | "anual"
  | "personalizado";

export type BaseValorAlvo =
  | "mensal_x_meses"
  | "unico_ciclo"
  | "soma_mensal";

export type CompetenciaRef = { mes: number; ano: number };

export const PERIODICIDADES: {
  value: PeriodicidadeCiclo;
  label: string;
}[] = [
  { value: "mensal", label: "Mensal (1 mês)" },
  { value: "trimestral", label: "Trimestral (Q1–Q4)" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual (Jan–Dez)" },
  { value: "personalizado", label: "Personalizado" },
];

export const BASES_VALOR_ALVO: {
  value: BaseValorAlvo;
  label: string;
}[] = [
  {
    value: "mensal_x_meses",
    label: "Valor-Alvo Mensal × Meses do Ciclo",
  },
  {
    value: "unico_ciclo",
    label: "Valor-Alvo Único do Ciclo",
  },
  {
    value: "soma_mensal",
    label: "Bônus Calculado Mês a Mês (Soma)",
  },
];

function clampMes(mes: number) {
  if (!Number.isFinite(mes)) return 1;
  return Math.min(12, Math.max(1, Math.trunc(mes)));
}

function clampAno(ano: number) {
  if (!Number.isFinite(ano)) return new Date().getFullYear();
  return Math.min(2100, Math.max(2000, Math.trunc(ano)));
}

export function competenciaKey(mes: number, ano: number) {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function listarCompetencias(
  inicio: CompetenciaRef,
  fim: CompetenciaRef,
): CompetenciaRef[] {
  const lista: CompetenciaRef[] = [];
  let mes = clampMes(inicio.mes);
  let ano = clampAno(inicio.ano);
  const mesFim = clampMes(fim.mes);
  const anoFim = clampAno(fim.ano);

  for (let i = 0; i < 120; i += 1) {
    lista.push({ mes, ano });
    if (mes === mesFim && ano === anoFim) break;
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
    if (ano > anoFim || (ano === anoFim && mes > mesFim)) break;
  }
  return lista;
}

export function resolverIntervaloCiclo(params: {
  ciclo: PeriodicidadeCiclo;
  mes?: number;
  ano?: number;
  trimestre?: number;
  semestre?: number;
  mesInicio?: number;
  anoInicio?: number;
  mesFim?: number;
  anoFim?: number;
}): { inicio: CompetenciaRef; fim: CompetenciaRef; competencias: CompetenciaRef[] } {
  const ano = clampAno(params.ano ?? new Date().getFullYear());
  const mes = clampMes(params.mes ?? new Date().getMonth() + 1);

  let inicio: CompetenciaRef;
  let fim: CompetenciaRef;

  switch (params.ciclo) {
    case "trimestral": {
      const trimestre = Math.min(
        4,
        Math.max(1, Math.trunc(params.trimestre ?? Math.ceil(mes / 3))),
      );
      const mesIni = (trimestre - 1) * 3 + 1;
      inicio = { mes: mesIni, ano };
      fim = { mes: mesIni + 2, ano };
      break;
    }
    case "semestral": {
      const semestre = Math.min(
        2,
        Math.max(1, Math.trunc(params.semestre ?? (mes <= 6 ? 1 : 2))),
      );
      inicio = { mes: semestre === 1 ? 1 : 7, ano };
      fim = { mes: semestre === 1 ? 6 : 12, ano };
      break;
    }
    case "anual": {
      inicio = { mes: 1, ano };
      fim = { mes: 12, ano };
      break;
    }
    case "personalizado": {
      inicio = {
        mes: clampMes(params.mesInicio ?? mes),
        ano: clampAno(params.anoInicio ?? ano),
      };
      fim = {
        mes: clampMes(params.mesFim ?? mes),
        ano: clampAno(params.anoFim ?? ano),
      };
      const iniKey = competenciaKey(inicio.mes, inicio.ano);
      const fimKey = competenciaKey(fim.mes, fim.ano);
      if (iniKey > fimKey) {
        const tmp = inicio;
        inicio = fim;
        fim = tmp;
      }
      break;
    }
    case "mensal":
    default: {
      inicio = { mes, ano };
      fim = { mes, ano };
      break;
    }
  }

  return {
    inicio,
    fim,
    competencias: listarCompetencias(inicio, fim),
  };
}

export function formatarLabelCiclo(params: {
  ciclo: PeriodicidadeCiclo;
  inicio: CompetenciaRef;
  fim: CompetenciaRef;
  trimestre?: number;
  semestre?: number;
}) {
  const { ciclo, inicio, fim } = params;
  const ano = inicio.ano;

  switch (ciclo) {
    case "mensal":
      return formatarCompetencia(inicio.mes, inicio.ano);
    case "trimestral": {
      const trimestre =
        params.trimestre ?? Math.ceil(inicio.mes / 3);
      const nomes = MESES.filter(
        (m) => m.value >= inicio.mes && m.value <= fim.mes,
      )
        .map((m) => m.label.slice(0, 3))
        .join(" a ");
      return `Q${trimestre}/${ano} (${nomes})`;
    }
    case "semestral": {
      const semestre = params.semestre ?? (inicio.mes <= 6 ? 1 : 2);
      return `${semestre === 1 ? "1º" : "2º"} Semestre/${ano} (${nomeMes(inicio.mes).slice(0, 3)} a ${nomeMes(fim.mes).slice(0, 3)})`;
    }
    case "anual":
      return `Anual ${ano}`;
    case "personalizado":
      return `${formatarCompetencia(inicio.mes, inicio.ano)} a ${formatarCompetencia(fim.mes, fim.ano)}`;
    default:
      return formatarCompetencia(inicio.mes, inicio.ano);
  }
}

export function parsePeriodicidade(
  valor: string | undefined,
): PeriodicidadeCiclo {
  const v = String(valor ?? "").trim().toLowerCase();
  if (
    v === "trimestral" ||
    v === "semestral" ||
    v === "anual" ||
    v === "personalizado" ||
    v === "mensal"
  ) {
    return v;
  }
  return "mensal";
}

export function parseBaseValorAlvo(valor: string | undefined): BaseValorAlvo {
  const v = String(valor ?? "").trim().toLowerCase();
  if (v === "unico_ciclo" || v === "soma_mensal" || v === "mensal_x_meses") {
    return v;
  }
  return "mensal_x_meses";
}
