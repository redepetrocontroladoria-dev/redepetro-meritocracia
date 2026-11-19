"use client";

import {
  encontrarFaixa,
  FAIXAS_PADRAO,
  notaParaAtingimento,
} from "@/lib/calculoMeritocracia";

const DEGRAUS = [
  { label: "100% Meta", detalhe: "10.0 — 100% peso", nota: 10 },
  { label: "95%", detalhe: "9.5 — 85% peso", nota: 9.5 },
  { label: "90%", detalhe: "9.0 — 70% peso", nota: 9 },
  { label: "85%", detalhe: "8.5 — 50% peso", nota: 8.5 },
  { label: "80%", detalhe: "8.0 — 30% peso", nota: 8 },
  { label: "Abaixo de 80%", detalhe: "5.0 — 0% peso", nota: 5 },
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
        {partePaga != null ? (
          <span className="rounded-full bg-brand-secondary px-2.5 py-1 text-[11px] font-semibold text-white">
            Parte paga: {partePaga.toFixed(0)}%
          </span>
        ) : null}
      </div>
    );
  }

  if (toleranciaZero) {
    const cumprida = nota != null && notaProxima(nota, 10);
    const ocorrencia = nota != null && notaProxima(nota, 0);
    return (
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onChange("10")}
            className={`rounded-md border px-3 py-3 text-left text-sm font-medium transition ${
              cumprida
                ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500"
                : "border-zinc-200 bg-white text-zinc-800 hover:border-emerald-400 hover:bg-emerald-50"
            }`}
          >
            ✅ Meta 100% Cumprida (Sem ocorrências)
            <span className="mt-1 block text-xs font-normal text-zinc-500">
              Nota 10.0 — 100% do peso
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChange("0")}
            className={`rounded-md border px-3 py-3 text-left text-sm font-medium transition ${
              ocorrencia
                ? "border-brand-primary bg-red-50 text-brand-primary ring-2 ring-brand-primary"
                : "border-zinc-200 bg-white text-zinc-800 hover:border-brand-primary hover:bg-red-50"
            }`}
          >
            ❌ Houve Ocorrência (Zera o peso)
            <span className="mt-1 block text-xs font-normal text-zinc-500">
              Nota 0.0 — 0% do peso
            </span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            Ajuste fino
            <input
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => onChange(e.target.value)}
              placeholder="0–10"
              className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-800 outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </label>
          {partePaga != null ? (
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                partePaga <= 0
                  ? "bg-brand-primary text-white"
                  : "bg-brand-secondary text-white"
              }`}
            >
              Parte paga: {partePaga.toFixed(0)}%
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {DEGRAUS.map((degrau) => {
          const ativo = nota != null && notaProxima(nota, degrau.nota);
          return (
            <button
              key={degrau.label}
              type="button"
              onClick={() => onChange(String(degrau.nota))}
              className={`min-w-[6.5rem] flex-1 rounded-md border px-2.5 py-2 text-left transition sm:flex-none ${
                ativo
                  ? "border-brand-primary bg-brand-primary text-white shadow-sm"
                  : "border-zinc-200 bg-white text-zinc-800 hover:border-brand-secondary hover:bg-zinc-50"
              }`}
            >
              <span className="block text-xs font-semibold">{degrau.label}</span>
              <span
                className={`mt-0.5 block text-[10px] ${
                  ativo ? "text-white/80" : "text-zinc-500"
                }`}
              >
                {degrau.detalhe}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          Nota exata
          <input
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ex: 9.2"
            className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-800 outline-none focus:ring-2 focus:ring-zinc-200"
          />
        </label>
        {partePaga != null ? (
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              partePaga <= 0
                ? "bg-brand-primary text-white"
                : partePaga >= 100
                  ? "bg-emerald-600 text-white"
                  : "bg-brand-secondary text-white"
            }`}
          >
            Parte paga: {partePaga.toFixed(0)}%
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500">
            Selecione um degrau
          </span>
        )}
      </div>
    </div>
  );
}
