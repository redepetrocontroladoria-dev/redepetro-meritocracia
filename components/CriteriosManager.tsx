"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  atualizarCriterio,
  criarCriterio,
  excluirCriterio,
} from "@/actions/cadastros";
import { EmptyState, Panel, SubmitButton } from "@/components/ui";

type DepartamentoOption = { id: string; nome: string };

type CriterioItem = {
  id: string;
  nome: string;
  peso: number;
  descricao: string | null;
  isGlobal: boolean;
  toleranciaZero: boolean;
  tipoAvaliacao: string;
  departamentos: DepartamentoOption[];
};

export function CriteriosManager({
  criterios,
  departamentos,
}: {
  criterios: CriterioItem[];
  departamentos: DepartamentoOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CriterioItem | null>(null);
  const [nome, setNome] = useState("");
  const [peso, setPeso] = useState("");
  const [descricao, setDescricao] = useState("");
  const [isGlobal, setIsGlobal] = useState(false);
  const [toleranciaZero, setToleranciaZero] = useState(false);
  const [tipoAvaliacao, setTipoAvaliacao] = useState("INDIVIDUAL");
  const [departamentoIds, setDepartamentoIds] = useState<string[]>([]);
  const [filtroDept, setFiltroDept] = useState("todos");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const somaGlobais = useMemo(
    () =>
      criterios
        .filter((item) => item.isGlobal)
        .reduce((total, item) => total + item.peso, 0),
    [criterios],
  );

  const resumoDepartamentos = useMemo(() => {
    return departamentos.map((departamento) => {
      const total = criterios.reduce((acc, item) => {
        if (item.isGlobal) return acc + item.peso;
        if (item.departamentos.some((d) => d.id === departamento.id)) {
          return acc + item.peso;
        }
        return acc;
      }, 0);
      return {
        id: departamento.id,
        nome: departamento.nome,
        total,
      };
    });
  }, [departamentos, criterios]);

  const criteriosFiltrados = useMemo(() => {
    if (filtroDept === "todos") return criterios;
    if (filtroDept === "global") {
      return criterios.filter((item) => item.isGlobal);
    }
    return criterios.filter(
      (item) =>
        item.isGlobal ||
        item.departamentos.some((d) => d.id === filtroDept),
    );
  }, [criterios, filtroDept]);

  const somaPreview = useMemo(() => {
    const valor = Number(String(peso).replace(",", "."));
    const pesoNum = Number.isFinite(valor) ? valor : 0;
    const alvos = isGlobal ? departamentos.map((d) => d.id) : departamentoIds;
    if (alvos.length === 0) return pesoNum;

    const totais = alvos.map((deptId) => {
      const atual = criterios.reduce((acc, item) => {
        if (editing && item.id === editing.id) return acc;
        if (item.isGlobal) return acc + item.peso;
        if (item.departamentos.some((d) => d.id === deptId)) {
          return acc + item.peso;
        }
        return acc;
      }, 0);
      return atual + pesoNum;
    });

    return Math.max(...totais);
  }, [peso, isGlobal, departamentoIds, editing, criterios, departamentos]);

  function toggleDepartamento(id: string) {
    setDepartamentoIds((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    );
  }

  function resetForm() {
    setEditing(null);
    setNome("");
    setPeso("");
    setDescricao("");
    setIsGlobal(false);
    setToleranciaZero(false);
    setTipoAvaliacao("INDIVIDUAL");
    setDepartamentoIds([]);
    setErro(null);
  }

  function iniciarEdicao(item: CriterioItem) {
    setEditing(item);
    setNome(item.nome);
    setPeso(String(item.peso));
    setDescricao(item.descricao ?? "");
    setIsGlobal(item.isGlobal);
    setToleranciaZero(item.toleranciaZero);
    setTipoAvaliacao(
      item.tipoAvaliacao === "DEPARTAMENTO" ? "DEPARTAMENTO" : "INDIVIDUAL",
    );
    setDepartamentoIds(item.departamentos.map((d) => d.id));
    setErro(null);
  }

  function montarFormData() {
    const formData = new FormData();
    formData.set("nome", nome);
    formData.set("peso", peso);
    formData.set("descricao", descricao);
    formData.set("tipoAvaliacao", tipoAvaliacao);
    if (isGlobal) formData.set("isGlobal", "on");
    if (toleranciaZero) formData.set("toleranciaZero", "on");
    for (const id of departamentoIds) {
      formData.append("departamentoIds", id);
    }
    return formData;
  }

  function cadastrar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    startTransition(async () => {
      const result = await criarCriterio(montarFormData());
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      resetForm();
      router.refresh();
    });
  }

  function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const pesoNum = Number(String(peso).replace(",", "."));
    setErro(null);
    startTransition(async () => {
      const result = await atualizarCriterio(editing.id, {
        nome,
        peso: pesoNum,
        descricao,
        isGlobal,
        toleranciaZero,
        tipoAvaliacao,
        departamentoIds,
      });
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      resetForm();
      router.refresh();
    });
  }

  function remover(item: CriterioItem) {
    if (!window.confirm(`Excluir o critério "${item.nome}"?`)) return;
    setErro(null);
    startTransition(async () => {
      const result = await excluirCriterio(item.id);
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      if (editing?.id === item.id) resetForm();
      router.refresh();
    });
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm lg:col-span-2">
        <div className="bg-brand-secondary px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white">
          Resumo por departamento (Globais + Vinculados)
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
              Globais: {somaGlobais.toFixed(1)}%
            </span>
            {resumoDepartamentos.map((item) => (
              <span
                key={item.id}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  item.total > 100
                    ? "bg-red-100 text-red-800"
                    : Math.abs(item.total - 100) <= 0.01
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-zinc-100 text-zinc-700"
                }`}
              >
                {item.nome}: {item.total.toFixed(1)}%
              </span>
            ))}
          </div>
          <p className="text-sm text-zinc-500">
            Maior soma prevista no formulário:{" "}
            <span className="font-semibold text-brand-secondary">
              {somaPreview.toFixed(1)}%
            </span>
          </p>
        </div>
      </section>

      <Panel title={editing ? "Editar critério" : "Novo critério"}>
        {erro ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </div>
        ) : null}

        <form
          onSubmit={editing ? salvar : cadastrar}
          className="space-y-4"
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Nome do Critério
            </span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Ex: Produtividade"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Porcentagem (%)
            </span>
            <input
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              required
              placeholder="Ex: 50"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Resumo / Diretrizes para Avaliação
            </span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Ex: Avaliar cumprimento de prazos, ausência de retrabalho e entrega das metas mensais..."
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={isGlobal}
              onChange={(e) => {
                setIsGlobal(e.target.checked);
                if (e.target.checked) setDepartamentoIds([]);
              }}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Aplicar a todos os departamentos (Global)
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Tipo de Apuração
            </span>
            <select
              value={tipoAvaliacao}
              onChange={(e) => setTipoAvaliacao(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
            >
              <option value="INDIVIDUAL">Individual (Por Colaborador)</option>
              <option value="DEPARTAMENTO">
                Coletivo (Por Departamento / Equipe)
              </option>
            </select>
          </label>

          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={toleranciaZero}
              onChange={(e) => setToleranciaZero(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300"
            />
            <span>
              Trava de Tolerância Zero (Qualquer falha abaixo de 100% zera o
              peso)
            </span>
          </label>

          {!isGlobal ? (
            <fieldset className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <legend className="text-sm font-medium text-zinc-700">
                  Departamentos
                </legend>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDepartamentoIds(departamentos.map((d) => d.id))
                    }
                    className="text-xs font-medium text-brand-primary hover:underline"
                  >
                    Marcar Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepartamentoIds([])}
                    className="text-xs font-medium text-zinc-500 hover:underline"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <div className="space-y-2 rounded-md border border-zinc-200 p-3">
                {departamentos.map((departamento) => (
                  <label
                    key={departamento.id}
                    className="flex items-center gap-2 text-sm text-zinc-700"
                  >
                    <input
                      type="checkbox"
                      checked={departamentoIds.includes(departamento.id)}
                      onChange={() => toggleDepartamento(departamento.id)}
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                    {departamento.nome}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {editing ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
              >
                Salvar Alterações
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar Edição
              </button>
            </div>
          ) : (
            <SubmitButton>{pending ? "Salvando..." : "Cadastrar"}</SubmitButton>
          )}
        </form>
      </Panel>

      <Panel title="Lista">
        <div className="mb-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">Filtrar</span>
            <select
              value={filtroDept}
              onChange={(e) => setFiltroDept(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
            >
              <option value="todos">Todos</option>
              <option value="global">Apenas Globais</option>
              {departamentos.map((departamento) => (
                <option key={departamento.id} value={departamento.id}>
                  {departamento.nome}
                </option>
              ))}
            </select>
          </label>
        </div>

        {criteriosFiltrados.length === 0 ? (
          <EmptyState message="Nenhum critério cadastrado." />
        ) : (
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-brand-secondary text-xs uppercase tracking-wide text-white">
                  <th className="px-3 py-3 font-semibold">Nome</th>
                  <th className="px-3 py-3 font-semibold">Peso (%)</th>
                  <th className="px-3 py-3 font-semibold">Abrangência</th>
                  <th className="px-3 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {criteriosFiltrados.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3">
                      <p className="font-medium text-zinc-900">{item.nome}</p>
                      {item.descricao ? (
                        <p className="mt-1 text-xs text-gray-500">
                          {item.descricao}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            item.tipoAvaliacao === "DEPARTAMENTO"
                              ? "bg-brand-secondary/10 text-brand-secondary"
                              : "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {item.tipoAvaliacao === "DEPARTAMENTO"
                            ? "Departamento"
                            : "Individual"}
                        </span>
                        {item.toleranciaZero ? (
                          <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-800">
                            Tolerância Zero
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">{item.peso.toFixed(1)}%</td>
                    <td className="px-3 py-3">
                      {item.isGlobal ? (
                        <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary">
                          Global (Todos)
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {item.departamentos.map((departamento) => (
                            <span
                              key={departamento.id}
                              className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700"
                            >
                              {departamento.nome}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => iniciarEdicao(item)}
                        className="mr-2 rounded-md px-2 py-1 text-xs font-medium text-brand-primary hover:bg-red-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => remover(item)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
