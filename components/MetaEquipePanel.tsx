export type TermometroCriterio = {
  criterioId: string;
  nome: string;
  peso: number;
  media: number;
  atingimento: number;
  atingiramMaximo: number;
  totalAvaliados: number;
};

export type ResumoMetaEquipe = {
  departamentoNome: string;
  competenciaLabel: string;
  mediaEquipe: number | null;
  atingimento: number | null;
  colaboradoresAtivos: number;
  colaboradoresAvaliados: number;
  coberturaPercentual: number;
  criterios: TermometroCriterio[];
};

function statusMeta(atingimento: number) {
  if (atingimento >= 90) {
    return {
      label: "Meta 100% Atingida!",
      className: "bg-emerald-100 text-emerald-800",
      barClass: "bg-emerald-500",
    };
  }
  if (atingimento >= 70) {
    return {
      label: `Dentro do Esperado (${atingimento.toFixed(1)}% da meta)`,
      className: "bg-amber-100 text-amber-900",
      barClass: "bg-blue-500",
    };
  }
  return {
    label: `Abaixo da Meta (${atingimento.toFixed(1)}%)`,
    className: "bg-red-100 text-red-800",
    barClass: "bg-brand-primary",
  };
}

function corBarraCriterio(atingimento: number) {
  if (atingimento >= 100) return "bg-emerald-500";
  if (atingimento >= 70) return "bg-blue-500";
  return "bg-brand-primary";
}

export function MetaEquipePanel({ resumo }: { resumo: ResumoMetaEquipe }) {
  const atingimento = resumo.atingimento;
  const status =
    atingimento == null
      ? null
      : statusMeta(atingimento);
  const coberturaCompleta =
    resumo.colaboradoresAtivos > 0 &&
    resumo.colaboradoresAvaliados >= resumo.colaboradoresAtivos;

  return (
    <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-secondary">
          Atingimento de Meta da Equipe
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          {resumo.departamentoNome} · {resumo.competenciaLabel}
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 border-l-4 border-l-brand-primary bg-zinc-50 p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              % Atingimento da Meta
            </p>
            <p className="mt-1 text-4xl font-semibold tracking-tight text-brand-primary">
              {atingimento == null ? "—" : `${atingimento.toFixed(1)}%`}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Média da equipe:{" "}
              {resumo.mediaEquipe == null
                ? "—"
                : `${resumo.mediaEquipe.toFixed(2)} / 10`}
            </p>
          </div>
          {status ? (
            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${status.className}`}
            >
              {status.label}
            </span>
          ) : null}
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-200">
          <div
            className={`h-full rounded-full transition-all ${status?.barClass ?? "bg-zinc-400"}`}
            style={{
              width: `${Math.min(100, Math.max(0, atingimento ?? 0))}%`,
            }}
          />
        </div>

        <p
          className={`mt-3 text-sm ${
            coberturaCompleta
              ? "font-medium text-emerald-700"
              : "font-medium text-amber-800"
          }`}
        >
          {resumo.colaboradoresAvaliados} de {resumo.colaboradoresAtivos}{" "}
          colaboradores avaliados
          {resumo.colaboradoresAtivos > 0
            ? ` — ${resumo.coberturaPercentual.toFixed(0)}% ${
                coberturaCompleta ? "concluído" : "em andamento"
              }`
            : ""}
          {!coberturaCompleta && resumo.colaboradoresAtivos > 0
            ? " · faltam avaliações"
            : ""}
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Termômetro por Critério
        </h3>
        {resumo.criterios.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
            Sem critérios avaliados neste período.
          </p>
        ) : (
          <div className="space-y-3">
            {resumo.criterios.map((criterio) => (
              <div
                key={criterio.criterioId}
                className="rounded-md border border-zinc-200 px-4 py-3"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {criterio.nome}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Peso {criterio.peso.toFixed(1)}% · Média{" "}
                      {criterio.media.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-brand-secondary">
                    {criterio.atingimento.toFixed(1)}%
                  </p>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={`h-full rounded-full ${corBarraCriterio(criterio.atingimento)}`}
                    style={{
                      width: `${Math.min(100, Math.max(0, criterio.atingimento))}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  {criterio.atingiramMaximo} de {criterio.totalAvaliados}{" "}
                  colaboradores atingiram 100%
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
