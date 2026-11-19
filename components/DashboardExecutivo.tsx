"use client";

import { MESES } from "@/lib/competencia";

type PendenciaDepartamento = {
  departamentoId: string;
  nome: string;
  metasColetivasLancadas: boolean;
  temCriteriosColetivos: boolean;
  avaliados: number;
  totalColaboradores: number;
};

type PontoEvolucao = {
  label: string;
  media: number | null;
  serie: string;
};

type Ofensor = {
  criterioId: string;
  nome: string;
  media: number;
};

type DepartamentoOption = { id: string; nome: string };

type FiltrosEvolucao = {
  departamentoId: string;
  janela: "6" | "12" | "ano";
  ano: number;
  onDepartamentoChange: (id: string) => void;
  onJanelaChange: (janela: "6" | "12" | "ano") => void;
  onAnoChange: (ano: number) => void;
};

type FiltrosOfensores = {
  departamentoId: string;
  mes: number;
  ano: number;
  onDepartamentoChange: (id: string) => void;
  onMesChange: (mes: number) => void;
  onAnoChange: (ano: number) => void;
};

const selectClass =
  "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-200";

export function DashboardExecutivo({
  competenciaLabel,
  competenciaLabelOfensor,
  labelJanelaEvolucao,
  pendencias,
  evolucao,
  ofensores,
  isDiretoria,
  departamentos,
  anosDisponiveis,
  filtrosEvolucao,
  filtrosOfensores,
}: {
  competenciaLabel: string;
  competenciaLabelOfensor: string;
  labelJanelaEvolucao: string;
  pendencias: PendenciaDepartamento[];
  evolucao: PontoEvolucao[];
  ofensores: Ofensor[];
  isDiretoria: boolean;
  departamentos: DepartamentoOption[];
  anosDisponiveis: number[];
  filtrosEvolucao: FiltrosEvolucao;
  filtrosOfensores: FiltrosOfensores;
}) {
  const series = Array.from(new Set(evolucao.map((p) => p.serie)));
  const labels = Array.from(new Set(evolucao.map((p) => p.label)));
  const maxMedia = Math.max(
    10,
    ...evolucao.map((p) => p.media ?? 0),
    ...ofensores.map((o) => o.media),
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="bg-brand-secondary px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white">
          Semáforo de Pendências — {competenciaLabel}
        </div>
        <div className="divide-y divide-zinc-100">
          {pendencias.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500">
              Nenhum departamento no escopo.
            </p>
          ) : (
            pendencias.map((item) => {
              const pct =
                item.totalColaboradores > 0
                  ? (item.avaliados / item.totalColaboradores) * 100
                  : 0;
              const completo = pct >= 99.5;
              return (
                <div
                  key={item.departamentoId}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">{item.nome}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Metas coletivas:{" "}
                      {!item.temCriteriosColetivos ? (
                        <span className="font-semibold text-zinc-600">
                          N/A
                        </span>
                      ) : item.metasColetivasLancadas ? (
                        <span className="font-semibold text-emerald-700">
                          Lançado ✅
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-700">
                          Pendente ⚠️
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="w-full max-w-xs">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="text-zinc-600">
                        Individuais: {item.avaliados}/{item.totalColaboradores}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${
                          completo
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full rounded-full ${
                          completo ? "bg-emerald-500" : "bg-brand-primary"
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand-secondary">
            Evolução Mensal
          </h2>
          <p className="mb-3 text-xs text-zinc-500">
            {labelJanelaEvolucao}
            {isDiretoria
              ? " · Média geral e departamentos."
              : " · Departamentos sob sua gestão."}
          </p>

          <div className="mb-4 flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Departamento
              </span>
              <select
                value={filtrosEvolucao.departamentoId}
                onChange={(e) =>
                  filtrosEvolucao.onDepartamentoChange(e.target.value)
                }
                className={selectClass}
              >
                <option value="">Todos</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Janela
              </span>
              <select
                value={filtrosEvolucao.janela}
                onChange={(e) =>
                  filtrosEvolucao.onJanelaChange(
                    e.target.value as "6" | "12" | "ano",
                  )
                }
                className={selectClass}
              >
                <option value="6">Últimos 6 meses</option>
                <option value="12">Últimos 12 meses</option>
                <option value="ano">Ano selecionado</option>
              </select>
            </label>
            {filtrosEvolucao.janela === "ano" ? (
              <label className="space-y-1">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Ano
                </span>
                <select
                  value={filtrosEvolucao.ano}
                  onChange={(e) =>
                    filtrosEvolucao.onAnoChange(Number(e.target.value))
                  }
                  className={selectClass}
                >
                  {anosDisponiveis.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {labels.length === 0 ? (
            <p className="text-sm text-zinc-500">Sem dados no período.</p>
          ) : (
            <div className="space-y-4">
              {series.map((serie) => {
                const pontos = labels.map((label) => {
                  const ponto = evolucao.find(
                    (p) => p.serie === serie && p.label === label,
                  );
                  return { label, media: ponto?.media ?? null };
                });
                return (
                  <div key={serie}>
                    <p className="mb-2 text-xs font-medium text-zinc-700">
                      {serie}
                    </p>
                    <div className="flex h-28 items-end gap-1.5">
                      {pontos.map((ponto) => {
                        const altura =
                          ponto.media == null
                            ? 0
                            : Math.max(4, (ponto.media / maxMedia) * 100);
                        return (
                          <div
                            key={`${serie}-${ponto.label}`}
                            className="flex flex-1 flex-col items-center justify-end gap-1"
                          >
                            <span className="text-[10px] tabular-nums text-zinc-500">
                              {ponto.media == null
                                ? "—"
                                : ponto.media.toFixed(1)}
                            </span>
                            <div
                              className="w-full rounded-t bg-brand-primary/80"
                              style={{ height: `${altura}%` }}
                              title={
                                ponto.media == null
                                  ? "—"
                                  : ponto.media.toFixed(2)
                              }
                            />
                            <span className="text-[9px] text-zinc-500">
                              {ponto.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand-secondary">
            Ranking de Critérios Ofensores
          </h2>
          <p className="mb-3 text-xs text-zinc-500">
            Top 5 critérios com menor média — {competenciaLabelOfensor}.
          </p>

          <div className="mb-4 flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Departamento
              </span>
              <select
                value={filtrosOfensores.departamentoId}
                onChange={(e) =>
                  filtrosOfensores.onDepartamentoChange(e.target.value)
                }
                className={selectClass}
              >
                <option value="">Todos</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Mês
              </span>
              <select
                value={filtrosOfensores.mes}
                onChange={(e) =>
                  filtrosOfensores.onMesChange(Number(e.target.value))
                }
                className={selectClass}
              >
                {MESES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Ano
              </span>
              <select
                value={filtrosOfensores.ano}
                onChange={(e) =>
                  filtrosOfensores.onAnoChange(Number(e.target.value))
                }
                className={selectClass}
              >
                {anosDisponiveis.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {ofensores.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Sem avaliações suficientes nesta competência.
            </p>
          ) : (
            <ul className="space-y-3">
              {ofensores.map((item, index) => {
                const largura = (item.media / 10) * 100;
                return (
                  <li key={item.criterioId}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-zinc-800">
                        {index + 1}. {item.nome}
                      </span>
                      <span className="tabular-nums font-semibold text-brand-primary">
                        {item.media.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-brand-secondary"
                        style={{ width: `${Math.min(100, largura)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
