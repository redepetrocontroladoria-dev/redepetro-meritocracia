"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  atualizarGestor,
  criarGestor,
  excluirGestor,
  redefinirSenhaGestor,
} from "@/actions/gestores";
import { EmptyState, Field, Panel, SubmitButton } from "@/components/ui";

type DepartamentoOption = { id: string; nome: string };

type GestorItem = {
  id: string;
  nome: string;
  email: string;
  isDiretoria: boolean;
  departamentos: DepartamentoOption[];
};

export function GestoresManager({
  gestores,
  departamentos,
}: {
  gestores: GestorItem[];
  departamentos: DepartamentoOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<GestorItem | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [departamentoIds, setDepartamentoIds] = useState<string[]>([]);
  const [isDiretoria, setIsDiretoria] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [senhaTemporaria, setSenhaTemporaria] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleDepartamento(id: string) {
    setDepartamentoIds((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    );
  }

  function iniciarEdicao(item: GestorItem) {
    setEditing(item);
    setNome(item.nome);
    setEmail(item.email);
    setSenha("");
    setDepartamentoIds(item.departamentos.map((d) => d.id));
    setIsDiretoria(item.isDiretoria);
    setErro(null);
  }

  function cancelar() {
    setEditing(null);
    setNome("");
    setEmail("");
    setSenha("");
    setDepartamentoIds([]);
    setIsDiretoria(false);
    setErro(null);
  }

  function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (!isDiretoria && departamentoIds.length === 0) {
      setErro("Selecione pelo menos 1 departamento.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      try {
        await atualizarGestor(editing.id, {
          nome,
          email,
          senha,
          departamentoIds,
          isDiretoria,
        });
        cancelar();
        router.refresh();
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao atualizar.");
      }
    });
  }

  function remover(item: GestorItem) {
    if (!window.confirm(`Excluir o gestor "${item.nome}"?`)) return;
    setErro(null);
    setSucesso(null);
    startTransition(async () => {
      try {
        await excluirGestor(item.id);
        if (editing?.id === item.id) cancelar();
        router.refresh();
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao excluir.");
      }
    });
  }

  function abrirReset(item: GestorItem) {
    setResetId(item.id);
    setSenhaTemporaria("");
    setErro(null);
    setSucesso(null);
  }

  function confirmarReset(item: GestorItem) {
    if (!senhaTemporaria.trim()) {
      setErro("Informe a senha temporária.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      try {
        await redefinirSenhaGestor(item.id, senhaTemporaria);
        setSucesso(`Senha temporária definida para ${item.nome}.`);
        setResetId(null);
        setSenhaTemporaria("");
        router.refresh();
      } catch (error) {
        setErro(
          error instanceof Error ? error.message : "Erro ao redefinir senha.",
        );
      }
    });
  }

  return (
    <>
      <Panel title={editing ? "Editar gestor" : "Novo gestor"}>
        {erro ? (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        ) : null}

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
              <span className="text-sm font-medium text-zinc-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">
                Nova senha (opcional)
              </span>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-zinc-700">
                Departamentos
              </legend>
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

            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={isDiretoria}
                onChange={(e) => setIsDiretoria(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Acesso de Diretoria (Acesso Total)
            </label>

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
          <form action={criarGestor} className="space-y-4">
            <Field label="Nome" name="nome" placeholder="Ex: João Silva" />
            <Field
              label="Email"
              name="email"
              type="email"
              placeholder="Ex: joao@empresa.com"
            />
            <Field
              label="Senha"
              name="senha"
              type="password"
              placeholder="••••••••"
            />

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-zinc-700">
                Departamentos
              </legend>
              <div className="space-y-2 rounded-md border border-zinc-200 p-3">
                {departamentos.map((departamento) => (
                  <label
                    key={departamento.id}
                    className="flex items-center gap-2 text-sm text-zinc-700"
                  >
                    <input
                      type="checkbox"
                      name="departamentoIds"
                      value={departamento.id}
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                    {departamento.nome}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                name="isDiretoria"
                className="h-4 w-4 rounded border-zinc-300"
              />
              Acesso de Diretoria (Acesso Total)
            </label>
            <SubmitButton>Cadastrar</SubmitButton>
          </form>
        )}
      </Panel>

      <Panel title="Lista">
        {sucesso ? (
          <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {sucesso}
          </p>
        ) : null}
        {erro && !editing ? (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        ) : null}
        {gestores.length === 0 ? (
          <EmptyState message="Nenhum gestor cadastrado." />
        ) : (
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-brand-secondary text-xs uppercase tracking-wide text-white">
                  <th className="px-3 py-3 font-semibold">Nome</th>
                  <th className="px-3 py-3 font-semibold">Email</th>
                  <th className="px-3 py-3 font-semibold">Departamentos</th>
                  <th className="px-3 py-3 font-semibold">Perfil</th>
                  <th className="px-3 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {gestores.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 font-medium">{item.nome}</td>
                    <td className="px-3 py-3">{item.email}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.isDiretoria ? (
                          <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary">
                            Todos (Diretoria)
                          </span>
                        ) : item.departamentos.length === 0 ? (
                          <span className="text-xs text-zinc-400">—</span>
                        ) : (
                          item.departamentos.map((departamento) => (
                            <span
                              key={departamento.id}
                              className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700"
                            >
                              {departamento.nome}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {item.isDiretoria ? "Diretoria" : "Gestor"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {resetId === item.id ? (
                        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
                          <input
                            type="text"
                            value={senhaTemporaria}
                            onChange={(e) => setSenhaTemporaria(e.target.value)}
                            placeholder="Senha temporária"
                            className="w-40 rounded-md border border-zinc-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-zinc-200"
                          />
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => confirmarReset(item)}
                            className="rounded-md bg-brand-primary px-2 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResetId(null);
                              setSenhaTemporaria("");
                            }}
                            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => iniciarEdicao(item)}
                            className="mr-2 rounded-md px-2 py-1 text-xs font-medium text-brand-primary hover:bg-red-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirReset(item)}
                            className="mr-2 rounded-md px-2 py-1 text-xs font-medium text-brand-secondary hover:bg-zinc-100"
                          >
                            Redefinir Senha
                          </button>
                          <button
                            type="button"
                            onClick={() => remover(item)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Excluir
                          </button>
                        </>
                      )}
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
