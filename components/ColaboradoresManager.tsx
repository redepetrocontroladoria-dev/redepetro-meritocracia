"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  atualizarColaborador,
  criarColaborador,
  excluirColaborador,
} from "@/actions/cadastros";
import {
  EmptyState,
  Field,
  Panel,
  SelectField,
  SubmitButton,
} from "@/components/ui";
import { formatarMoeda } from "@/lib/calculoMeritocracia";

type DepartamentoOption = { id: string; nome: string };
type ColaboradorItem = {
  id: string;
  nome: string;
  cargo: string;
  departamentoId: string;
  departamentoNome: string;
  valorAlvo: number;
};

export function ColaboradoresManager({
  colaboradores,
  departamentos,
}: {
  colaboradores: ColaboradorItem[];
  departamentos: DepartamentoOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ColaboradorItem | null>(null);
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [departamentoId, setDepartamentoId] = useState("");
  const [valorAlvo, setValorAlvo] = useState("0");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options = departamentos.map((d) => ({ value: d.id, label: d.nome }));

  function iniciarEdicao(item: ColaboradorItem) {
    setEditing(item);
    setNome(item.nome);
    setCargo(item.cargo);
    setDepartamentoId(item.departamentoId);
    setValorAlvo(String(item.valorAlvo));
    setErro(null);
  }

  function cancelar() {
    setEditing(null);
    setNome("");
    setCargo("");
    setDepartamentoId("");
    setValorAlvo("0");
    setErro(null);
  }

  function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setErro(null);
    startTransition(async () => {
      try {
        await atualizarColaborador(editing.id, {
          nome,
          cargo,
          departamentoId,
          valorAlvo: Number(String(valorAlvo).replace(",", ".")),
        });
        cancelar();
        router.refresh();
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao atualizar.");
      }
    });
  }

  function remover(item: ColaboradorItem) {
    if (!window.confirm(`Excluir o colaborador "${item.nome}"?`)) return;
    setErro(null);
    startTransition(async () => {
      try {
        await excluirColaborador(item.id);
        if (editing?.id === item.id) cancelar();
        router.refresh();
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao excluir.");
      }
    });
  }

  return (
    <>
      <Panel title={editing ? "Editar colaborador" : "Novo colaborador"}>
        {editing ? (
          <form onSubmit={salvar} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">Nome</span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">Cargo</span>
              <input
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">
                Departamento
              </span>
              <select
                value={departamentoId}
                onChange={(e) => setDepartamentoId(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">
                Valor-Alvo do Bônus (R$)
              </span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={valorAlvo}
                onChange={(e) => setValorAlvo(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            {erro ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </p>
            ) : null}
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
                onClick={cancelar}
                className="flex-1 rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar Edição
              </button>
            </div>
          </form>
        ) : (
          <form action={criarColaborador} className="space-y-4">
            <Field label="Nome" name="nome" placeholder="Ex: Ana Silva" />
            <Field label="Cargo" name="cargo" placeholder="Ex: Analista" />
            <SelectField
              label="Departamento"
              name="departamentoId"
              options={options}
              placeholder="Selecione o departamento"
            />
            <Field
              label="Valor-Alvo do Bônus (R$)"
              name="valorAlvo"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 1500"
              required={false}
            />
            <SubmitButton>Cadastrar</SubmitButton>
          </form>
        )}
      </Panel>

      <Panel title="Lista">
        {erro && !editing ? (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        ) : null}
        {colaboradores.length === 0 ? (
          <EmptyState message="Nenhum colaborador cadastrado." />
        ) : (
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-brand-secondary text-xs uppercase tracking-wide text-white">
                  <th className="px-3 py-3 font-semibold">Nome</th>
                  <th className="px-3 py-3 font-semibold">Cargo</th>
                  <th className="px-3 py-3 font-semibold">Departamento</th>
                  <th className="px-3 py-3 font-semibold text-right">
                    Valor-Alvo
                  </th>
                  <th className="px-3 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {colaboradores.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 font-medium">{item.nome}</td>
                    <td className="px-3 py-3">{item.cargo}</td>
                    <td className="px-3 py-3">{item.departamentoNome}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatarMoeda(item.valorAlvo)}
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
