"use client";

import {
  encontrarFaixa,
  FAIXAS_PADRAO,
  notaParaAtingimento,
} from "@/lib/calculoMeritocracia";

const DEGRAUS = [
  {
    label: "100% Meta",
    detalhe: "10.0 — 100% peso",
    nota: 10,
    minAtingimento: 100,
  },
  {
    label: "95%",
    detalhe: "9.5 — 85% peso",
    nota: 9.5,
    minAtingimento: 95,
  },
  {
    label: "90%",
    detalhe: "9.0 — 70% peso",
    nota: 9,
    minAtingimento: 90,
  },
  {
    label: "85%",
    detalhe: "8.5 — 50% peso",
    nota: 8.5,
    minAtingimento: 85,
  },
  {
    label: "80%",
    detalhe: "8.0 — 30% peso",
    nota: 8,
    minAtingimento: 80,
  },
  {
    label: "Abaixo de 80%",
    detalhe: "5.0 — 0% peso",
    nota: 5,
    minAtingimento: 0,
  },
] as const;

export const LEGENDA_REGUA_DEGRAUS = [
  { atingimento: "100%", parte: "100% do peso" },
  { atingimento: "95%", parte: "85% do peso" },
  { atingimento: "90%", parte: "70% do peso" },
  { atingimento: "85%", parte: "50% do peso" },
  { atingimento: "80%", parte: "30% do peso" },
  { atingimento: "< 80%", parte: "0% do peso" },
] as const;

function parseNota(valor: string) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function notaProxima(a: number, b: number) {
  return Math.abs(a - b) < 0.05;
}

function degrauAtivoPorFaixa(atingimento: number | null, minAtingimento: number) {
  if (atingimento == null) return false;
  const faixa = encontrarFaixa(atingimento, FAIXAS_PADRAO);
  if (minAtingimento >= 100) {
    return faixa.minPercentual >= 100;
  }
  if (minAtingimento === 0) {
    return faixa.multiplicadorPeso === 0 && faixa.minPercentual < 80;
  }
  return Math.abs(faixa.minPercentual - minAtingimento) < 0.01;
}

function BadgePartePaga({
  partePaga,
  vazio,
}: {
  partePaga: number | null;
  vazio?: string;
}) {
  if (partePaga == null) {
    return (
      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500">
        {vazio ?? "Selecione um degrau"}
      </span>
    );
  }

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        partePaga <= 0
          ? "bg-brand-primary text-white"
          : partePaga >= 100
            ? "bg-emerald-700 text-white"
            : "bg-brand-secondary text-white"
      }`}
    >
      Parte paga: {partePaga.toFixed(0)}%
    </span>
  );
}

export function SeletorNotaDegrau({
  valor,
  onChange,
  toleranciaZero = false,
  readOnly = false,
}: {
  valor: string;
  onChange: (nota: string) => void;
  toleranciaZero?: boolean;
  readOnly?: boolean;
}) {
  const nota = parseNota(valor);
  const atingimento = nota == null ? null : notaParaAtingimento(nota);
  const faixa =
    atingimento == null ? null : encontrarFaixa(atingimento, FAIXAS_PADRAO);
  const partePaga =
    toleranciaZero && nota != null && nota < 10
      ? 0
      : faixa
        ? faixa.multiplicadorPeso * 100
        : null;

  if (readOnly) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-brand-secondary">
          Nota: {nota == null ? "—" : nota.toFixed(1)}
        </p>
        <BadgePartePaga partePaga={partePaga} vazio="Sem nota" />
      </div>
    );
  }

  if (toleranciaZero) {
    const cumprida = nota != null && notaProxima(nota, 10);
    const ocorrencia = nota != null && nota < 10;

    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onChange("10")}
            className={`min-h-[4.5rem] rounded-lg border-2 px-4 py-4 text-left text-sm font-semibold transition ${
              cumprida
                ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500"
                : "border-zinc-200 bg-white text-brand-secondary hover:border-emerald-500 hover:bg-emerald-50"
            }`}
          >
            ✅ Meta 100% Cumprida (Sem ocorrências)
            <span
              className={`mt-1.5 block text-xs font-normal ${
                cumprida ? "text-emerald-700" : "text-zinc-500"
              }`}
            >
              Nota 10.0 — 100% do peso
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChange("0")}
            className={`min-h-[4.5rem] rounded-lg border-2 px-4 py-4 text-left text-sm font-semibold transition ${
              ocorrencia && nota != null && notaProxima(nota, 0)
                ? "border-brand-primary bg-red-50 text-brand-primary ring-2 ring-brand-primary"
                : ocorrencia
                  ? "border-brand-primary/40 bg-red-50/60 text-brand-primary"
                  : "border-zinc-200 bg-white text-brand-secondary hover:border-brand-primary hover:bg-red-50"
            }`}
          >
            ❌ Houve Ocorrência (Zera o peso)
            <span
              className={`mt-1.5 block text-xs font-normal ${
                ocorrencia ? "text-brand-primary/80" : "text-zinc-500"
              }`}
            >
              Nota 0.0 — 0% do peso
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            Ajuste fino
            <input
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => onChange(e.target.value)}
              placeholder="0–10"
              className="w-20 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1.5 text-sm text-brand-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </label>
          <BadgePartePaga partePaga={partePaga} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {DEGRAUS.map((degrau) => {
          const exato = nota != null && notaProxima(nota, degrau.nota);
          const faixaAtiva = degrauAtivoPorFaixa(
            atingimento,
            degrau.minAtingimento,
          );
          const ativo = exato || faixaAtiva;

          return (
            <button
              key={degrau.label}
              type="button"
              onClick={() => onChange(String(degrau.nota))}
              className={`min-h-[4.25rem] rounded-lg border-2 px-2.5 py-2.5 text-left transition ${
                ativo
                  ? "border-brand-primary bg-brand-primary text-white shadow-sm"
                  : "border-zinc-200 bg-white text-brand-secondary hover:border-brand-secondary hover:bg-zinc-50"
              }`}
            >
              <span className="block text-xs font-semibold leading-tight">
                {degrau.label}
              </span>
              <span
                className={`mt-1 block text-[10px] leading-snug ${
                  ativo ? "text-white/85" : "text-zinc-500"
                }`}
              >
                {degrau.detalhe}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          Nota exata
          <input
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ex: 9.2"
            className="w-20 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1.5 text-sm text-brand-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </label>
        <BadgePartePaga partePaga={partePaga} />
      </div>
    </div>
  );
}
