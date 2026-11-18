"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  atualizarDepartamento,
  criarDepartamento,
  excluirDepartamento,
} from "@/actions/cadastros";
import { EmptyState, Field, Panel, SubmitButton } from "@/components/ui";

type DepartamentoItem = {
  id: string;
  nome: string;
  colaboradores: number;
};

export function DepartamentosManager({
  departamentos,
}: {
  departamentos: DepartamentoItem[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<DepartamentoItem | null>(null);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function iniciarEdicao(item: DepartamentoItem) {
    setEditing(item);
    setNome(item.nome);
    setErro(null);
  }

  function cancelar() {
    setEditing(null);
    setNome("");
    setErro(null);
  }

  function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setErro(null);
    startTransition(async () => {
      try {
        await atualizarDepartamento(editing.id, { nome });
        cancelar();
        router.refresh();
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao atualizar.");
      }
    });
  }

  function remover(item: DepartamentoItem) {
    if (!window.confirm(`Excluir o departamento "${item.nome}"?`)) return;
    setErro(null);
    startTransition(async () => {
      try {
        await excluirDepartamento(item.id);
        if (editing?.id === item.id) cancelar();
        router.refresh();
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao excluir.");
      }
    });
  }

  return (
    <>
      <Panel title={editing ? "Editar departamento" : "Novo departamento"}>
        {editing ? (
          <form onSubmit={salvar} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">Nome</span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            {erro ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
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
          <form action={criarDepartamento} className="space-y-4">
            <Field label="Nome" name="nome" placeholder="Ex: Comercial" />
            <SubmitButton>Cadastrar</SubmitButton>
          </form>
        )}
      </Panel>

      <Panel title="Lista">
        {erro && !editing ? (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
        ) : null}
        {departamentos.length === 0 ? (
          <EmptyState message="Nenhum departamento cadastrado." />
        ) : (
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-brand-secondary text-xs uppercase tracking-wide text-white">
                  <th className="px-3 py-3 font-semibold">Nome</th>
                  <th className="px-3 py-3 font-semibold">Colaboradores</th>
                  <th className="px-3 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {departamentos.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 font-medium text-zinc-900">{item.nome}</td>
                    <td className="px-3 py-3 text-zinc-600">{item.colaboradores}</td>
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
                        disabled={pending}
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
