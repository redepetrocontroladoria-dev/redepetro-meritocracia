"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getAvaliacaoDepartamento,
  salvarAvaliacao,
  verificarAvaliacaoExistente,
} from "@/actions/avaliacoes";
import { MESES } from "@/lib/competencia";
import { calcularNotaFinalConsolidada } from "@/lib/avaliacaoConsolidada";
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
  departamentoIds: string[];
};

type EdicaoInicial = {
  id: string;
  colaboradorId: string;
  mes: number;
  ano: number;
  observacoes: string;
  notas: Record<string, string>;
};

type AvaliacaoFormProps = {
  colaboradores: ColaboradorOption[];
  criterios: CriterioOption[];
  edicaoInicial?: EdicaoInicial | null;
};

const LEGENDA = [
  {
    faixa: "0.0 – 3.9",
    texto: "Abaixo das expectativas (Não atendeu)",
    className: "bg-red-100 text-red-800",
  },
  {
    faixa: "4.0 – 6.9",
    texto: "Atende parcialmente",
    className: "bg-amber-100 text-amber-800",
  },
  {
    faixa: "7.0 – 8.9",
    texto: "Atende plenamente às expectativas",
    className: "bg-blue-100 text-blue-800",
  },
  {
    faixa: "9.0 – 10.0",
    texto: "Supera consistentemente (Excepcional)",
    className: "bg-emerald-100 text-emerald-800",
  },
];

const agora = new Date();
const ANOS = Array.from({ length: 6 }, (_, i) => agora.getFullYear() - 2 + i);

export function AvaliacaoForm({
  colaboradores,
  criterios,
  edicaoInicial = null,
}: AvaliacaoFormProps) {
  const router = useRouter();
  const [avaliacaoId, setAvaliacaoId] = useState(edicaoInicial?.id ?? "");
  const [modoEdicao, setModoEdicao] = useState(Boolean(edicaoInicial));
  const [colaboradorId, setColaboradorId] = useState(
    edicaoInicial?.colaboradorId ?? "",
  );
  const [mes, setMes] = useState(edicaoInicial?.mes ?? agora.getMonth() + 1);
  const [ano, setAno] = useState(edicaoInicial?.ano ?? agora.getFullYear());
  const [notas, setNotas] = useState<Record<string, string>>(
    edicaoInicial?.notas ?? {},
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
  const [coletivasCarregadas, setColetivasCarregadas] = useState(false);
  const [pending, startTransition] = useTransition();

  const colaboradorSelecionado = useMemo(
    () => colaboradores.find((item) => item.id === colaboradorId) ?? null,
    [colaboradores, colaboradorId],
  );

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
      setColetivasCarregadas(false);
      return;
    }

    const colaborador = colaboradores.find((item) => item.id === colaboradorId);
    if (!colaborador) return;

    getAvaliacaoDepartamento(colaborador.departamentoId, mes, ano).then(
      (coletiva) => {
        if (!ativo) return;
        if (!coletiva) {
          setNotasColetivas({});
          setColetivasCarregadas(false);
          return;
        }
        setNotasColetivas(
          Object.fromEntries(
            coletiva.itens.map((item) => [item.criterioId, item.nota]),
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
          Competência
        </h2>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">Mês</span>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
            >
              {MESES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">Ano</span>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
            >
              {ANOS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-secondary">
          Escala de Notas Padronizada
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {LEGENDA.map((item) => (
            <div
              key={item.faixa}
              className="flex items-start gap-2 rounded-md border border-zinc-100 px-3 py-2"
            >
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.className}`}
              >
                {item.faixa}
              </span>
              <p className="text-xs text-zinc-600">{item.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <h2 className="bg-brand-secondary px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white">
          Colaborador
        </h2>
        <label className="block space-y-1.5 p-5">
          <span className="text-sm font-medium text-zinc-700">
            Selecionar colaborador
          </span>
          <select
            value={colaboradorId}
            onChange={(event) => {
              setColaboradorId(event.target.value);
              setNotas({});
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
            {colaboradores.map((colaborador) => (
              <option key={colaborador.id} value={colaborador.id}>
                {colaborador.nome} — {colaborador.cargo} (
                {colaborador.departamento})
              </option>
            ))}
          </select>
        </label>
        {avisoExistente ? (
          <p className="mx-5 mb-5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {avisoExistente}
          </p>
        ) : null}
      </section>

      {colaboradorId ? (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Bloco 2 — Avaliação Individual
              </h2>
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
                </p>
                <p className="mt-3 text-sm font-semibold text-brand-secondary">
                  Nota da equipe:{" "}
                  {Number.isFinite(notasColetivas[criterio.id])
                    ? notasColetivas[criterio.id].toFixed(1)
                    : "—"}
                </p>
              </div>
            ))}

            {criteriosIndividuais.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
                Nenhum critério individual para este departamento.
              </div>
            ) : (
              itensIndividuais.map(({ criterio, parcial }) => (
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

                  <label className="mt-4 block space-y-1.5">
                    <span className="text-sm font-medium text-zinc-700">
                      Nota (0.0 a 10.0)
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={notas[criterio.id] ?? ""}
                      onChange={(event) =>
                        setNotas((atual) => ({
                          ...atual,
                          [criterio.id]: event.target.value,
                        }))
                      }
                      placeholder="Ex: 8.5"
                      className="w-full max-w-[12rem] rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                      required
                    />
                  </label>
                </div>
              ))
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
          Selecione a competência e um colaborador para carregar os critérios.
        </div>
      )}
    </form>
  );
}
