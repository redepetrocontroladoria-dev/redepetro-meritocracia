"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BASES_VALOR_ALVO,
  formatarLabelCiclo,
  PERIODICIDADES,
  parseBaseValorAlvo,
  parsePeriodicidade,
  resolverIntervaloCiclo,
  type BaseValorAlvo,
  type PeriodicidadeCiclo,
} from "@/lib/cicloBonus";
import { MESES } from "@/lib/competencia";

type DepartamentoOption = { id: string; nome: string };

type BonusFiltrosProps = {
  departamentos: DepartamentoOption[];
  isDiretoria: boolean;
  anos: number[];
};

type FiltroState = {
  ciclo: PeriodicidadeCiclo;
  baseValor: BaseValorAlvo;
  mes: number;
  ano: number;
  trimestre: number;
  semestre: number;
  mesInicio: number;
  anoInicio: number;
  mesFim: number;
  anoFim: number;
  departamentoId: string;
};

function lerFiltros(
  searchParams: URLSearchParams,
  agora: Date,
): FiltroState {
  const mes = Number(searchParams.get("mes")) || agora.getMonth() + 1;
  const ano = Number(searchParams.get("ano")) || agora.getFullYear();
  return {
    ciclo: parsePeriodicidade(searchParams.get("ciclo") ?? undefined),
    baseValor: parseBaseValorAlvo(
      searchParams.get("baseValor") ?? undefined,
    ),
    mes,
    ano,
    trimestre: Number(searchParams.get("trimestre")) || Math.ceil(mes / 3),
    semestre: Number(searchParams.get("semestre")) || (mes <= 6 ? 1 : 2),
    mesInicio: Number(searchParams.get("mesInicio")) || 1,
    anoInicio: Number(searchParams.get("anoInicio")) || ano,
    mesFim: Number(searchParams.get("mesFim")) || 12,
    anoFim: Number(searchParams.get("anoFim")) || ano,
    departamentoId: searchParams.get("departamentoId")?.trim() || "",
  };
}

function paraQuery(state: FiltroState) {
  const params = new URLSearchParams();
  params.set("ciclo", state.ciclo);
  params.set("baseValor", state.baseValor);
  params.set("ano", String(state.ano));

  if (state.departamentoId) {
    params.set("departamentoId", state.departamentoId);
  }

  switch (state.ciclo) {
    case "mensal":
      params.set("mes", String(state.mes));
      break;
    case "trimestral":
      params.set("trimestre", String(state.trimestre));
      break;
    case "semestral":
      params.set("semestre", String(state.semestre));
      break;
    case "personalizado":
      params.set("mesInicio", String(state.mesInicio));
      params.set("anoInicio", String(state.anoInicio));
      params.set("mesFim", String(state.mesFim));
      params.set("anoFim", String(state.anoFim));
      break;
    default:
      break;
  }

  return params.toString();
}

export function BonusFiltros({
  departamentos,
  isDiretoria,
  anos,
}: BonusFiltrosProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const agora = useMemo(() => new Date(), []);

  const [filtros, setFiltros] = useState<FiltroState>(() =>
    lerFiltros(searchParams, agora),
  );

  useEffect(() => {
    setFiltros(lerFiltros(searchParams, agora));
  }, [searchParams, agora]);

  const { inicio, fim, competencias } = useMemo(
    () =>
      resolverIntervaloCiclo({
        ciclo: filtros.ciclo,
        mes: filtros.mes,
        ano: filtros.ano,
        trimestre: filtros.trimestre,
        semestre: filtros.semestre,
        mesInicio: filtros.mesInicio,
        anoInicio: filtros.anoInicio,
        mesFim: filtros.mesFim,
        anoFim: filtros.anoFim,
      }),
    [filtros],
  );

  const competenciaLabel = formatarLabelCiclo({
    ciclo: filtros.ciclo,
    inicio,
    fim,
    trimestre: filtros.trimestre,
    semestre: filtros.semestre,
  });

  function aplicar(proximo: FiltroState) {
    setFiltros(proximo);
    const query = paraQuery(proximo);
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  function atualizar<K extends keyof FiltroState>(
    chave: K,
    valor: FiltroState[K],
  ) {
    const proximo: FiltroState = { ...filtros, [chave]: valor };

    if (chave === "ciclo") {
      const novoCiclo = valor as PeriodicidadeCiclo;
      if (novoCiclo === "trimestral") {
        proximo.trimestre = filtros.trimestre || Math.ceil(filtros.mes / 3);
      }
      if (novoCiclo === "semestral") {
        proximo.semestre = filtros.semestre || (filtros.mes <= 6 ? 1 : 2);
      }
      if (novoCiclo === "personalizado") {
        proximo.mesInicio = filtros.mesInicio || 1;
        proximo.anoInicio = filtros.anoInicio || filtros.ano;
        proximo.mesFim = filtros.mesFim || 12;
        proximo.anoFim = filtros.anoFim || filtros.ano;
      }
    }

    aplicar(proximo);
  }

  const selectClass =
    "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200 disabled:opacity-60";

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[14rem] flex-1 space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">
            Periodicidade / Ciclo
          </span>
          <select
            value={filtros.ciclo}
            disabled={pending}
            onChange={(e) =>
              atualizar("ciclo", e.target.value as PeriodicidadeCiclo)
            }
            className={selectClass}
          >
            {PERIODICIDADES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[16rem] flex-[1.4] space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">
            Base do Valor-Alvo
          </span>
          <select
            value={filtros.baseValor}
            disabled={pending}
            onChange={(e) =>
              atualizar("baseValor", e.target.value as BaseValorAlvo)
            }
            className={selectClass}
          >
            {BASES_VALOR_ALVO.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {departamentos.length > 0 ? (
          <label className="block min-w-[14rem] flex-1 space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Departamento
            </span>
            <select
              value={filtros.departamentoId}
              disabled={pending}
              onChange={(e) => atualizar("departamentoId", e.target.value)}
              className={selectClass}
            >
              <option value="">
                {isDiretoria ? "Todos" : "Todos os meus departamentos"}
              </option>
              {departamentos.map((departamento) => (
                <option key={departamento.id} value={departamento.id}>
                  {departamento.nome}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {filtros.ciclo === "mensal" ? (
          <>
            <label className="block min-w-[10rem] space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">Mês</span>
              <select
                value={String(filtros.mes)}
                disabled={pending}
                onChange={(e) => atualizar("mes", Number(e.target.value))}
                className={selectClass}
              >
                {MESES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[8rem] space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">Ano</span>
              <select
                value={String(filtros.ano)}
                disabled={pending}
                onChange={(e) => atualizar("ano", Number(e.target.value))}
                className={selectClass}
              >
                {anos.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        {filtros.ciclo === "trimestral" ? (
          <>
            <label className="block min-w-[10rem] space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">
                Trimestre
              </span>
              <select
                value={String(filtros.trimestre)}
                disabled={pending}
                onChange={(e) =>
                  atualizar("trimestre", Number(e.target.value))
                }
                className={selectClass}
              >
                <option value="1">Q1 — Jan a Mar</option>
                <option value="2">Q2 — Abr a Jun</option>
                <option value="3">Q3 — Jul a Set</option>
                <option value="4">Q4 — Out a Dez</option>
              </select>
            </label>
            <label className="block min-w-[8rem] space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">Ano</span>
              <select
                value={String(filtros.ano)}
                disabled={pending}
                onChange={(e) => atualizar("ano", Number(e.target.value))}
                className={selectClass}
              >
                {anos.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        {filtros.ciclo === "semestral" ? (
          <>
            <label className="block min-w-[12rem] space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">
                Semestre
              </span>
              <select
                value={String(filtros.semestre)}
                disabled={pending}
                onChange={(e) =>
                  atualizar("semestre", Number(e.target.value))
                }
                className={selectClass}
              >
                <option value="1">1º Semestre — Jan a Jun</option>
                <option value="2">2º Semestre — Jul a Dez</option>
              </select>
            </label>
            <label className="block min-w-[8rem] space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">Ano</span>
              <select
                value={String(filtros.ano)}
                disabled={pending}
                onChange={(e) => atualizar("ano", Number(e.target.value))}
                className={selectClass}
              >
                {anos.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        {filtros.ciclo === "anual" ? (
          <label className="block min-w-[8rem] space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">Ano</span>
            <select
              value={String(filtros.ano)}
              disabled={pending}
              onChange={(e) => atualizar("ano", Number(e.target.value))}
              className={selectClass}
            >
              {anos.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {filtros.ciclo === "personalizado" ? (
          <>
            <label className="block min-w-[9rem] space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">
                Mês inicial
              </span>
              <select
                value={String(filtros.mesInicio)}
                disabled={pending}
                onChange={(e) =>
                  atualizar("mesInicio", Number(e.target.value))
                }
                className={selectClass}
              >
                {MESES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[8rem] space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">
                Ano inicial
              </span>
              <select
                value={String(filtros.anoInicio)}
                disabled={pending}
                onChange={(e) =>
                  atualizar("anoInicio", Number(e.target.value))
                }
                className={selectClass}
              >
                {anos.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[9rem] space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">
                Mês final
              </span>
              <select
                value={String(filtros.mesFim)}
                disabled={pending}
                onChange={(e) => atualizar("mesFim", Number(e.target.value))}
                className={selectClass}
              >
                {MESES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[8rem] space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">
                Ano final
              </span>
              <select
                value={String(filtros.anoFim)}
                disabled={pending}
                onChange={(e) => atualizar("anoFim", Number(e.target.value))}
                className={selectClass}
              >
                {anos.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        {pending ? (
          <p className="pb-2 text-xs font-medium text-brand-primary">
            Atualizando…
          </p>
        ) : null}
      </div>

      <p className="text-xs text-zinc-500">
        Período selecionado:{" "}
        <span className="font-semibold text-brand-secondary">
          {competenciaLabel}
        </span>{" "}
        ({competencias.length} {competencias.length === 1 ? "mês" : "meses"})
      </p>
    </div>
  );
}
