type ItemMatriz = {
  criterioId: string;
  criterioNome: string;
  peso: number;
  nota: number;
  pontos: number;
};

type LinhaMatriz = {
  colaborador: string;
  cargo: string;
  notaFinal: number;
  itens: ItemMatriz[];
};

type CriterioCabecalho = {
  id: string;
  nome: string;
  peso: number;
};

type MatrizCriteriosProps = {
  departamentoNome: string;
  competenciaLabel: string;
  criterios: CriterioCabecalho[];
  linhas: LinhaMatriz[];
};

function classeNota(nota: number) {
  if (nota >= 9) return "bg-emerald-50 text-emerald-800";
  if (nota < 7) return "bg-red-50 text-red-800";
  return "bg-white text-zinc-800";
}

export function MatrizCriterios({
  departamentoNome,
  competenciaLabel,
  criterios,
  linhas,
}: MatrizCriteriosProps) {
  if (criterios.length === 0 || linhas.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
        Sem avaliações com critérios para montar a matriz neste período.
      </p>
    );
  }

  const medias = criterios.map((criterio) => {
    const notas = linhas
      .map(
        (linha) =>
          linha.itens.find((item) => item.criterioId === criterio.id)?.nota,
      )
      .filter((nota): nota is number => typeof nota === "number");
    const media =
      notas.length > 0
        ? notas.reduce((total, nota) => total + nota, 0) / notas.length
        : null;
    return { criterioId: criterio.id, media };
  });

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200">
      <div className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
        {departamentoNome} · {competenciaLabel}
      </div>
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="bg-brand-secondary text-xs uppercase tracking-wide text-white">
            <th className="sticky left-0 z-10 bg-brand-secondary px-3 py-3 font-semibold">
              Colaborador
            </th>
            {criterios.map((criterio) => (
              <th
                key={criterio.id}
                className="min-w-[8.5rem] px-3 py-3 font-semibold"
              >
                <span className="block normal-case tracking-normal">
                  {criterio.nome}
                </span>
                <span className="mt-0.5 block text-[10px] font-normal text-white/70">
                  Peso {criterio.peso.toFixed(1)}%
                </span>
              </th>
            ))}
            <th className="px-3 py-3 text-right font-semibold">Nota Final</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {linhas.map((linha) => (
            <tr key={`${linha.colaborador}-${linha.cargo}`}>
              <td className="sticky left-0 z-10 bg-white px-3 py-3 font-medium text-zinc-900">
                <span className="block">{linha.colaborador}</span>
                <span className="text-xs font-normal text-zinc-500">
                  {linha.cargo}
                </span>
              </td>
              {criterios.map((criterio) => {
                const item = linha.itens.find(
                  (celula) => celula.criterioId === criterio.id,
                );
                if (!item) {
                  return (
                    <td
                      key={criterio.id}
                      className="px-3 py-3 text-center text-zinc-400"
                    >
                      —
                    </td>
                  );
                }
                return (
                  <td key={criterio.id} className="px-2 py-2">
                    <div
                      className={`rounded-md px-2 py-1.5 text-center ${classeNota(item.nota)}`}
                    >
                      <p className="text-sm font-semibold tabular-nums">
                        {item.nota.toFixed(1)}
                      </p>
                      <p className="text-[10px] opacity-80">
                        {item.pontos.toFixed(2)} pts
                      </p>
                    </div>
                  </td>
                );
              })}
              <td className="px-3 py-3 text-right font-semibold tabular-nums text-brand-secondary">
                {linha.notaFinal.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-brand-secondary">
            <td className="sticky left-0 z-10 bg-zinc-50 px-3 py-3">
              Média da equipe
            </td>
            {medias.map((item) => (
              <td key={item.criterioId} className="px-2 py-2">
                {item.media == null ? (
                  <span className="block text-center text-zinc-400">—</span>
                ) : (
                  <div
                    className={`rounded-md px-2 py-1.5 text-center normal-case tracking-normal ${classeNota(item.media)}`}
                  >
                    <p className="text-sm font-semibold tabular-nums">
                      {item.media.toFixed(1)}
                    </p>
                  </div>
                )}
              </td>
            ))}
            <td className="px-3 py-3 text-right tabular-nums">
              {(
                linhas.reduce((total, linha) => total + linha.notaFinal, 0) /
                linhas.length
              ).toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
