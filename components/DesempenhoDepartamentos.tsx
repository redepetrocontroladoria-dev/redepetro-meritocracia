import {
  classificarDesempenho,
  type DesempenhoDepartamento,
} from "@/lib/desempenho";

export function DesempenhoDepartamentos({
  itens,
}: {
  itens: DesempenhoDepartamento[];
}) {
  if (itens.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
        Sem dados consolidados de departamento.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {itens.map((item, index) => {
        const desempenho = classificarDesempenho(item.notaMedia);

        return (
          <article
            key={item.departamentoId}
            className="rounded-lg border border-zinc-200 border-l-4 border-l-brand-primary bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  #{index + 1}
                </p>
                <h3 className="text-base font-semibold text-brand-secondary">
                  {item.departamento}
                </h3>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${desempenho.badgeClass}`}
                >
                  {desempenho.label}
                </span>
                {item.variacaoLabel ? (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.variacaoBadgeClass}`}
                  >
                    {item.variacaoLabel}
                  </span>
                ) : null}
              </div>
            </div>

            <p className="text-3xl font-semibold tracking-tight text-brand-primary">
              {item.notaMedia.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Nota média (0 a 10) · {desempenho.descricao}
            </p>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${desempenho.barClass}`}
                style={{ width: `${desempenho.percentual}%` }}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-600">
              <span>{item.totalAvaliacoes} avaliação(ões)</span>
              <span>{item.colaboradoresAvaliados} colaborador(es)</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
