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

export function DashboardExecutivo({
  competenciaLabel,
  pendencias,
  evolucao,
  ofensores,
  isDiretoria,
}: {
  competenciaLabel: string;
  pendencias: PendenciaDepartamento[];
  evolucao: PontoEvolucao[];
  ofensores: Ofensor[];
  isDiretoria: boolean;
}) {
  const series = Array.from(new Set(evolucao.map((p) => p.serie)));
  const labels = Array.from(new Set(evolucao.map((p) => p.label)));
  const maxMedia = Math.max(
    10,
    ...evolucao.map((p) => p.media ?? 0),
    ...ofensores.map((o) => o.media),
  );

  return (
    <div className="mb-8 space-y-6">
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
            Evolução Mensal (Últimos 6 meses)
          </h2>
          <p className="mb-4 text-xs text-zinc-500">
            {isDiretoria
              ? "Média geral da empresa e departamentos."
              : "Média dos departamentos sob sua gestão."}
          </p>
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
          <p className="mb-4 text-xs text-zinc-500">
            Top 5 critérios com menor média de atingimento no mês atual.
          </p>
          {ofensores.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Sem avaliações suficientes neste mês.
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
