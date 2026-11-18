"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getAvaliacaoDepartamento,
  salvarAvaliacaoDepartamento,
} from "@/actions/avaliacoes";
import { MESES } from "@/lib/competencia";

type DepartamentoOption = { id: string; nome: string };

type CriterioOption = {
  id: string;
  nome: string;
  peso: number;
  descricao: string | null;
  isGlobal: boolean;
  tipoAvaliacao: string;
  departamentoIds: string[];
};

const agora = new Date();
const ANOS = Array.from({ length: 6 }, (_, i) => agora.getFullYear() - 2 + i);

export function AvaliacaoDepartamentoForm({
  departamentos,
  criterios,
}: {
  departamentos: DepartamentoOption[];
  criterios: CriterioOption[];
}) {
  const router = useRouter();
  const [departamentoId, setDepartamentoId] = useState(
    departamentos[0]?.id ?? "",
  );
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const criteriosColetivos = useMemo(() => {
    if (!departamentoId) return [];
    return criterios.filter(
      (criterio) =>
        criterio.tipoAvaliacao === "DEPARTAMENTO" &&
        (criterio.isGlobal ||
          criterio.departamentoIds.includes(departamentoId)),
    );
  }, [criterios, departamentoId]);

  useEffect(() => {
    let ativo = true;
    setNotas({});
    setErro(null);
    setSucesso(null);

    if (!departamentoId) return;

    getAvaliacaoDepartamento(departamentoId, mes, ano).then((existente) => {
      if (!ativo || !existente) return;
      setNotas(
        Object.fromEntries(
          existente.itens.map((item) => [item.criterioId, String(item.nota)]),
        ),
      );
    });

    return () => {
      ativo = false;
    };
  }, [departamentoId, mes, ano]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!departamentoId) {
      setErro("Selecione um departamento.");
      return;
    }
    if (criteriosColetivos.length === 0) {
      setErro("Não há critérios coletivos para este departamento.");
      return;
    }

    const itens = criteriosColetivos.map((criterio) => ({
      criterioId: criterio.id,
      notaObtida: Number(String(notas[criterio.id] ?? "").replace(",", ".")),
    }));

    if (
      itens.some(
        (item) =>
          !Number.isFinite(item.notaObtida) ||
          item.notaObtida < 0 ||
          item.notaObtida > 10,
      )
    ) {
      setErro("Informe notas de 0.0 a 10.0 para todos os critérios coletivos.");
      return;
    }

    startTransition(async () => {
      const result = await salvarAvaliacaoDepartamento({
        departamentoId,
        mes,
        ano,
        itens,
      });
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      setSucesso(
        result.atualizado
          ? "Metas coletivas atualizadas."
          : "Metas coletivas salvas.",
      );
      router.refresh();
    });
  }

  if (departamentos.length === 0) {
    return null;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-secondary">
          Bloco 1 — Metas Coletivas do Departamento
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Lance uma vez por competência; aplica-se a todos os colaboradores do
          setor.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">Departamento</span>
          <select
            value={departamentoId}
            onChange={(e) => setDepartamentoId(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
          >
            {departamentos.map((departamento) => (
              <option key={departamento.id} value={departamento.id}>
                {departamento.nome}
              </option>
            ))}
          </select>
        </label>
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

      {criteriosColetivos.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
          Nenhum critério coletivo (Departamento) vinculado a este setor.
        </p>
      ) : (
        <div className="space-y-3">
          {criteriosColetivos.map((criterio) => (
            <div
              key={criterio.id}
              className="rounded-md border border-zinc-200 border-l-4 border-l-brand-secondary px-4 py-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {criterio.nome}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Peso {criterio.peso.toFixed(1)}% · Coletivo
                  </p>
                </div>
              </div>
              {criterio.descricao ? (
                <p className="mb-2 text-xs text-zinc-500">{criterio.descricao}</p>
              ) : null}
              <input
                type="text"
                inputMode="decimal"
                value={notas[criterio.id] ?? ""}
                onChange={(e) =>
                  setNotas((atual) => ({
                    ...atual,
                    [criterio.id]: e.target.value,
                  }))
                }
                placeholder="Nota 0 a 10"
                className="w-full max-w-[10rem] rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </div>
          ))}
        </div>
      )}

      {erro ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      ) : null}
      {sucesso ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {sucesso}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || criteriosColetivos.length === 0}
        className="rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Salvar Metas Coletivas"}
      </button>
    </form>
  );
}
