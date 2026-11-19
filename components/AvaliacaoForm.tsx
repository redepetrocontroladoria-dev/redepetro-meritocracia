"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getAvaliacaoDepartamento,
  salvarAvaliacao,
  verificarAvaliacaoExistente,
} from "@/actions/avaliacoes";
import { SeletorNotaDegrau } from "@/components/SeletorNotaDegrau";
import { MESES } from "@/lib/competencia";
import {
  calcularNotaFinalConsolidada,
  exigeJustificativa,
} from "@/lib/avaliacaoConsolidada";
import { classificarNota } from "@/lib/escala";

type ColaboradorOption = {
  id: string;
  nome: string;
  cargo: string;
  departamento: string;
  departamentoId: string;
};

type CriterioOption = {
  id: string;
  nome: string;
  peso: number;
  descricao: string | null;
  isGlobal: boolean;
  tipoAvaliacao: string;
  toleranciaZero?: boolean;
  departamentoIds: string[];
};

type EdicaoInicial = {
  id: string;
  colaboradorId: string;
  mes: number;
  ano: number;
  observacoes: string;
  notas: Record<string, string>;
  justificativas?: Record<string, string>;
};

type AvaliacaoFormProps = {
  colaboradores: ColaboradorOption[];
  criterios: CriterioOption[];
  departamentoId: string;
  mes: number;
  ano: number;
  edicaoInicial?: EdicaoInicial | null;
};

export function AvaliacaoForm({
  colaboradores,
  criterios,
  departamentoId,
  mes,
  ano,
  edicaoInicial = null,
}: AvaliacaoFormProps) {
  const router = useRouter();
  const [avaliacaoId, setAvaliacaoId] = useState(edicaoInicial?.id ?? "");
  const [modoEdicao, setModoEdicao] = useState(Boolean(edicaoInicial));
  const [colaboradorId, setColaboradorId] = useState(
    edicaoInicial?.colaboradorId ?? "",
  );
  const [notas, setNotas] = useState<Record<string, string>>(
    edicaoInicial?.notas ?? {},
  );
  const [justificativas, setJustificativas] = useState<Record<string, string>>(
    edicaoInicial?.justificativas ?? {},
  );
  const [observacoes, setObservacoes] = useState(
    edicaoInicial?.observacoes ?? "",
  );
  const [avisoExistente, setAvisoExistente] = useState<string | null>(
    edicaoInicial
      ? "Modo de edição: as notas existentes foram carregadas."
      : null,
  );
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [notasColetivas, setNotasColetivas] = useState<
    Record<string, number>
  >({});
  const [justColetivas, setJustColetivas] = useState<Record<string, string>>(
    {},
  );
  const [coletivasCarregadas, setColetivasCarregadas] = useState(false);
  const [pending, startTransition] = useTransition();

  const colaboradoresDoDepartamento = useMemo(
    () =>
      departamentoId
        ? colaboradores.filter((item) => item.departamentoId === departamentoId)
        : [],
    [colaboradores, departamentoId],
  );

  const mesLabel =
    MESES.find((item) => item.value === mes)?.label ?? String(mes);

  const colaboradorSelecionado = useMemo(
    () =>
      colaboradoresDoDepartamento.find((item) => item.id === colaboradorId) ??
      null,
    [colaboradoresDoDepartamento, colaboradorId],
  );

  useEffect(() => {
    if (!colaboradorId) return;
    const pertence = colaboradoresDoDepartamento.some(
      (item) => item.id === colaboradorId,
    );
    if (pertence) return;
    setColaboradorId("");
    setNotas({});
    setJustificativas({});
    setObservacoes("");
    setAvaliacaoId("");
    setModoEdicao(false);
    setAvisoExistente(null);
    setSucesso(null);
    setErro(null);
    setNotasColetivas({});
    setJustColetivas({});
    setColetivasCarregadas(false);
  }, [colaboradorId, colaboradoresDoDepartamento]);

  const criteriosDoSetor = useMemo(() => {
    if (!colaboradorSelecionado) return [];
    return criterios.filter(
      (criterio) =>
        criterio.isGlobal ||
        criterio.departamentoIds.includes(
          colaboradorSelecionado.departamentoId,
        ),
    );
  }, [criterios, colaboradorSelecionado]);

  const criteriosIndividuais = useMemo(
    () =>
      criteriosDoSetor.filter(
        (criterio) => criterio.tipoAvaliacao !== "DEPARTAMENTO",
      ),
    [criteriosDoSetor],
  );

  const criteriosColetivos = useMemo(
    () =>
      criteriosDoSetor.filter(
        (criterio) => criterio.tipoAvaliacao === "DEPARTAMENTO",
      ),
    [criteriosDoSetor],
  );

  const somaPesos = useMemo(
    () => criteriosDoSetor.reduce((total, item) => total + item.peso, 0),
    [criteriosDoSetor],
  );

  const pesosCompletos = Math.abs(somaPesos - 100) <= 0.01;
  const coletivasCompletas =
    criteriosColetivos.length === 0 ||
    criteriosColetivos.every((c) => Number.isFinite(notasColetivas[c.id]));

  const itensIndividuais = useMemo(() => {
    return criteriosIndividuais.map((criterio) => {
      const nota = Number(String(notas[criterio.id] ?? "").replace(",", "."));
      const notaValida = Number.isFinite(nota) ? nota : 0;
      const parcial =
        somaPesos > 0 ? (notaValida * criterio.peso) / somaPesos : 0;
      return { criterio, nota: notaValida, parcial };
    });
  }, [criteriosIndividuais, notas, somaPesos]);

  const notaFinal = calcularNotaFinalConsolidada(
    itensIndividuais.map((item) => ({
      criterioId: item.criterio.id,
      peso: item.criterio.peso,
      nota: item.nota,
    })),
    criteriosColetivos.map((criterio) => ({
      criterioId: criterio.id,
      peso: criterio.peso,
      nota: notasColetivas[criterio.id] ?? 0,
    })),
  );
  const classificacao = classificarNota(notaFinal);

  useEffect(() => {
    let ativo = true;

    if (!colaboradorId) {
      setAvisoExistente(null);
      setNotasColetivas({});
      setJustColetivas({});
      setColetivasCarregadas(false);
      return;
    }

    const colaborador = colaboradoresDoDepartamento.find(
      (item) => item.id === colaboradorId,
    );
    if (!colaborador) return;

    getAvaliacaoDepartamento(colaborador.departamentoId, mes, ano).then(
      (coletiva) => {
        if (!ativo) return;
        if (!coletiva) {
          setNotasColetivas({});
          setJustColetivas({});
          setColetivasCarregadas(false);
          return;
        }
        setNotasColetivas(
          Object.fromEntries(
            coletiva.itens.map((item) => [item.criterioId, item.nota]),
          ),
        );
        setJustColetivas(
          Object.fromEntries(
            coletiva.itens.map((item) => [
              item.criterioId,
              item.justificativa ?? "",
            ]),
          ),
        );
        setColetivasCarregadas(true);
      },
    );

    verificarAvaliacaoExistente(colaboradorId, mes, ano).then((existente) => {
      if (!ativo) return;
      if (!existente) {
        if (!modoEdicao) setAvisoExistente(null);
        return;
      }

      setAvaliacaoId(existente.id);
      setAvisoExistente(
        modoEdicao || avaliacaoId === existente.id
          ? "Modo de Edição de Avaliação — as notas existentes foram carregadas."
          : `Já existe avaliação nesta competência (nota ${existente.notaFinal.toFixed(2)}). Salvar atualizará o registro.`,
      );

      if (modoEdicao || !Object.keys(notas).length) {
        setNotas(
          Object.fromEntries(
            existente.itens.map((item) => [
              item.criterioId,
              String(item.notaObtida),
            ]),
          ),
        );
        setJustificativas(
          Object.fromEntries(
            existente.itens.map((item) => [
              item.criterioId,
              item.justificativa ?? "",
            ]),
          ),
        );
        setObservacoes(existente.observacoes ?? "");
        setModoEdicao(true);
      }
    });

    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaboradorId, mes, ano]);

  function executarSalvar(atualizarExistente: boolean) {
    const payload = criteriosIndividuais.map((criterio) => ({
      criterioId: criterio.id,
      notaObtida: Number(String(notas[criterio.id] ?? "").replace(",", ".")),
      justificativa: justificativas[criterio.id] ?? "",
    }));

    startTransition(async () => {
      const result = await salvarAvaliacao({
        colaboradorId,
        observacoes,
        itens: payload,
        mes,
        ano,
        atualizarExistente: atualizarExistente || modoEdicao,
        avaliacaoId: avaliacaoId || undefined,
      });

      if (!result.ok) {
        if (result.exists) {
          const confirmar = window.confirm(
            `${result.error}\n\nDeseja atualizar a avaliação existente?`,
          );
          if (confirmar) {
            executarSalvar(true);
          } else {
            setErro(result.error);
          }
          return;
        }
        setErro(result.error);
        return;
      }

      setSucesso(
        result.atualizado
          ? "Avaliação atualizada com sucesso."
          : "Avaliação salva com sucesso.",
      );
      setNotas({});
      setJustificativas({});
      setObservacoes("");
      setColaboradorId("");
      setAvaliacaoId("");
      setModoEdicao(false);
      setAvisoExistente(null);
      router.replace("/avaliar");
      router.refresh();
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!colaboradorId) {
      setErro("Selecione um colaborador.");
      return;
    }
    if (criteriosIndividuais.length === 0) {
      setErro("Não há critérios individuais para este departamento.");
      return;
    }
    if (!pesosCompletos) {
      setErro(
        `A soma dos pesos aplicáveis é ${somaPesos.toFixed(1)}% (deve ser 100%).`,
      );
      return;
    }
    if (criteriosColetivos.length > 0 && !coletivasCompletas) {
      setErro(
        "As metas coletivas do departamento ainda não foram preenchidas para esta competência.",
      );
      return;
    }

    const payload = criteriosIndividuais.map((criterio) => ({
      criterioId: criterio.id,
      notaObtida: Number(String(notas[criterio.id] ?? "").replace(",", ".")),
      justificativa: justificativas[criterio.id] ?? "",
    }));

    if (
      payload.some(
        (item) =>
          !Number.isFinite(item.notaObtida) ||
          item.notaObtida < 0 ||
          item.notaObtida > 10,
      )
    ) {
      setErro("Informe uma nota de 0.0 a 10.0 para todos os critérios individuais.");
      return;
    }

    for (const criterio of criteriosIndividuais) {
      const nota = Number(String(notas[criterio.id] ?? "").replace(",", "."));
      if (
        exigeJustificativa(nota, Boolean(criterio.toleranciaZero)) &&
        !String(justificativas[criterio.id] ?? "").trim()
      ) {
        setErro(
          `Justificativa obrigatória para "${criterio.nome}" (nota < 10.0).`,
        );
        return;
      }
    }

    executarSalvar(Boolean(avisoExistente) || modoEdicao);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {modoEdicao ? (
        <div className="rounded-md border border-brand-primary/30 bg-brand-primary/5 px-4 py-3 text-sm text-brand-secondary">
          <p className="font-semibold text-brand-primary">
            Modo de Edição de Avaliação
          </p>
          <p className="mt-1 text-zinc-600">
            As notas lançadas foram carregadas. Altere os valores e clique em
            Salvar Alterações.
          </p>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <h2 className="bg-brand-secondary px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white">
          Bloco 2 — Avaliação Individual
        </h2>
        <div className="space-y-4 p-5">
          <p className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            Competência sincronizada com o Bloco 1:{" "}
            <span className="font-semibold text-brand-secondary">
              {mesLabel}/{ano}
            </span>
          </p>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Selecionar colaborador
            </span>
            <select
              value={colaboradorId}
              onChange={(event) => {
                setColaboradorId(event.target.value);
                setNotas({});
                setJustificativas({});
                setObservacoes("");
                setAvaliacaoId("");
                setModoEdicao(false);
                setAvisoExistente(null);
                setSucesso(null);
                setErro(null);
              }}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              required
            >
              <option value="">Selecione...</option>
              {colaboradoresDoDepartamento.map((colaborador) => (
                <option key={colaborador.id} value={colaborador.id}>
                  {colaborador.nome} — {colaborador.cargo}
                </option>
              ))}
            </select>
            {departamentoId && colaboradoresDoDepartamento.length === 0 ? (
              <p className="text-xs text-zinc-500">
                Nenhum colaborador neste departamento.
              </p>
            ) : null}
          </label>
          {avisoExistente ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {avisoExistente}
            </p>
          ) : null}
        </div>
      </section>

      {colaboradorId ? (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  pesosCompletos
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                Soma dos pesos: {somaPesos.toFixed(1)}%
              </span>
            </div>

            {criteriosColetivos.length > 0 ? (
              <div
                className={`rounded-md border px-4 py-3 text-sm ${
                  coletivasCompletas
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {coletivasCompletas
                  ? "Metas coletivas do departamento carregadas (somente leitura)."
                  : "Atenção: as metas coletivas do departamento ainda não foram preenchidas para esta competência."}
              </div>
            ) : null}

            {criteriosColetivos.map((criterio) => (
              <div
                key={`coletivo-${criterio.id}`}
                className="rounded-lg border border-zinc-200 border-l-4 border-l-brand-secondary bg-zinc-50 p-5"
              >
                <h3 className="text-sm font-semibold text-zinc-900">
                  {criterio.nome}
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Peso: {criterio.peso.toFixed(1)}% · Coletivo (Departamento)
                  {criterio.toleranciaZero ? " · Tolerância zero" : ""}
                </p>
                <div className="mt-3">
                  <SeletorNotaDegrau
                    valor={
                      Number.isFinite(notasColetivas[criterio.id])
                        ? String(notasColetivas[criterio.id])
                        : ""
                    }
                    onChange={() => undefined}
                    toleranciaZero={Boolean(criterio.toleranciaZero)}
                    readOnly
                  />
                </div>
                {justColetivas[criterio.id]?.trim() ? (
                  <p className="mt-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
                    <span className="font-semibold text-brand-secondary">
                      Justificativa / Evidência:{" "}
                    </span>
                    {justColetivas[criterio.id]}
                  </p>
                ) : null}
              </div>
            ))}

            {criteriosIndividuais.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
                Nenhum critério individual para este departamento.
              </div>
            ) : (
              itensIndividuais.map(({ criterio, parcial }) => {
                const notaNum = Number(
                  String(notas[criterio.id] ?? "").replace(",", "."),
                );
                const obrigatoria =
                  Number.isFinite(notaNum) &&
                  exigeJustificativa(
                    notaNum,
                    Boolean(criterio.toleranciaZero),
                  );
                return (
                  <div
                    key={criterio.id}
                    className="rounded-lg border border-zinc-200 border-l-4 border-l-brand-primary bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-zinc-900">
                          {criterio.nome}
                        </h3>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Peso: {criterio.peso.toFixed(1)}% · Individual
                          {criterio.toleranciaZero ? " · Tolerância zero" : ""}
                        </p>
                        {criterio.descricao ? (
                          <div className="mt-3 rounded-md border-l-4 border-l-brand-secondary bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600">
                            {criterio.descricao}
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-md bg-zinc-100 px-3 py-1.5 text-right">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                          Contribuição
                        </p>
                        <p className="text-sm font-semibold text-zinc-900">
                          {parcial.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="mb-2 text-sm font-medium text-zinc-700">
                        Resultado / Atingimento
                      </p>
                      <SeletorNotaDegrau
                        valor={notas[criterio.id] ?? ""}
                        onChange={(nota) =>
                          setNotas((atual) => ({
                            ...atual,
                            [criterio.id]: nota,
                          }))
                        }
                        toleranciaZero={Boolean(criterio.toleranciaZero)}
                      />
                    </div>

                    <label className="mt-3 block space-y-1.5">
                      <span className="text-sm font-medium text-zinc-700">
                        Justificativa / Evidência
                        {obrigatoria ? (
                          <span className="ml-1 text-brand-primary">*</span>
                        ) : null}
                      </span>
                      <textarea
                        value={justificativas[criterio.id] ?? ""}
                        onChange={(e) =>
                          setJustificativas((atual) => ({
                            ...atual,
                            [criterio.id]: e.target.value,
                          }))
                        }
                        rows={2}
                        placeholder={
                          obrigatoria
                            ? "Obrigatório para nota abaixo de 10.0"
                            : "Opcional"
                        }
                        className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200 ${
                          obrigatoria
                            ? "border-brand-primary/40"
                            : "border-zinc-300"
                        }`}
                      />
                    </label>
                  </div>
                );
              })
            )}
          </section>

          <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-secondary px-5 py-3 text-white">
              <div>
                <p className="text-sm font-medium">Nota Final</p>
                <p className="text-xs text-white/70">
                  Média ponderada (0 a 10)
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-semibold tracking-tight">
                  {notaFinal.toFixed(2)}
                </p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classificacao.badgeClass}`}
                >
                  {classificacao.label}
                </span>
              </div>
            </div>

            <div className="p-5">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-700">
                  Observações Gerais
                </span>
                <textarea
                  value={observacoes}
                  onChange={(event) => setObservacoes(event.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                />
              </label>

              {!pesosCompletos ? (
                <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Não é possível salvar: a soma dos pesos aplicáveis é{" "}
                  <strong>{somaPesos.toFixed(1)}%</strong> e precisa ser{" "}
                  <strong>100%</strong>. Ajuste os critérios em{" "}
                  <strong>Critérios</strong> (hoje só há critérios globais
                  cadastrados somando {somaPesos.toFixed(1)}%).
                </p>
              ) : null}

              {erro ? (
                <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {erro}
                </p>
              ) : null}
              {sucesso ? (
                <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {sucesso}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={
                  pending ||
                  criteriosIndividuais.length === 0 ||
                  (criteriosColetivos.length > 0 && !coletivasCarregadas)
                }
                className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-800 disabled:opacity-60"
              >
                {pending
                  ? "Salvando..."
                  : modoEdicao
                    ? "Salvar Alterações"
                    : avisoExistente
                      ? "Atualizar Avaliação"
                      : "Salvar Avaliação"}
              </button>
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          Selecione um colaborador do departamento escolhido no Bloco 1.
        </div>
      )}
    </form>
  );
}
