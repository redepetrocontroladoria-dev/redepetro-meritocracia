"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  atualizarGestor,
  criarGestor,
  excluirGestor,
  redefinirSenhaGestor,
} from "@/actions/gestores";
import { EmptyState, Panel } from "@/components/ui";

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

  function limparFormulario() {
    setEditing(null);
    setNome("");
    setEmail("");
    setSenha("");
    setDepartamentoIds([]);
    setIsDiretoria(false);
  }

  function iniciarEdicao(item: GestorItem) {
    setEditing(item);
    setNome(item.nome);
    setEmail(item.email);
    setSenha("");
    setDepartamentoIds(item.departamentos.map((d) => d.id));
    setIsDiretoria(item.isDiretoria);
    setErro(null);
    setSucesso(null);
  }

  function cancelar() {
    limparFormulario();
    setErro(null);
  }

  function handleSubmitCadastro(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!isDiretoria && departamentoIds.length === 0) {
      setErro("Selecione pelo menos 1 departamento.");
      return;
    }

    startTransition(async () => {
      const result = await criarGestor({
        nome,
        email,
        senha,
        departamentoIds: [...departamentoIds],
        isDiretoria,
      });
      if (!result.ok) {
        setErro(result.error ?? "Erro ao cadastrar gestor.");
        return;
      }
      limparFormulario();
      setSucesso("Gestor cadastrado com sucesso.");
      router.refresh();
    });
  }

  function handleSubmitEdicao(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setErro(null);
    setSucesso(null);

    if (!isDiretoria && departamentoIds.length === 0) {
      setErro("Selecione pelo menos 1 departamento.");
      return;
    }

    startTransition(async () => {
      const result = await atualizarGestor(
        editing.id,
        nome,
        email,
        senha,
        [...departamentoIds],
        isDiretoria,
      );
      if (!result.ok) {
        setErro(result.error ?? "Erro ao atualizar gestor.");
        return;
      }
      limparFormulario();
      setSucesso("Gestor atualizado com sucesso.");
      router.refresh();
    });
  }

  function remover(item: GestorItem) {
    if (!window.confirm(`Excluir o gestor "${item.nome}"?`)) return;
    setErro(null);
    setSucesso(null);
    startTransition(async () => {
      const result = await excluirGestor(item.id);
      if (!result.ok) {
        setErro(result.error ?? "Erro ao excluir gestor.");
        return;
      }
      if (editing?.id === item.id) limparFormulario();
      setSucesso("Gestor excluído.");
      router.refresh();
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
      const result = await redefinirSenhaGestor(item.id, senhaTemporaria);
      if (!result.ok) {
        setErro(result.error ?? "Erro ao redefinir senha.");
        return;
      }
      setSucesso(`Senha temporária definida para ${item.nome}.`);
      setResetId(null);
      setSenhaTemporaria("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <Panel title={editing ? "Editar gestor" : "Novo gestor"}>
          {erro ? (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </p>
          ) : null}

          <form
            onSubmit={editing ? handleSubmitEdicao : handleSubmitCadastro}
            className="space-y-4"
          >
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
                {editing ? "Nova senha (opcional)" : "Senha"}
              </span>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required={!editing}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-zinc-700">
                Departamentos
              </legend>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-zinc-200 p-3">
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

            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
              >
                {pending
                  ? "Salvando..."
                  : editing
                    ? "Salvar Alterações"
                    : "Cadastrar"}
              </button>
              {editing ? (
                <button
                  type="button"
                  onClick={cancelar}
                  className="w-full rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar Edição
                </button>
              ) : null}
            </div>
          </form>
        </Panel>
      </div>

      <div className="min-w-0 lg:col-span-8">
        <Panel title="Lista">
          {sucesso ? (
            <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {sucesso}
            </p>
          ) : null}
          {gestores.length === 0 ? (
            <EmptyState message="Nenhum gestor cadastrado." />
          ) : (
            <div className="overflow-hidden rounded-md border border-zinc-200">
              <table className="w-full table-fixed text-left text-sm">
                <thead>
                  <tr className="bg-brand-secondary text-xs uppercase tracking-wide text-white">
                    <th className="w-[42%] px-3 py-3 font-semibold">Gestor</th>
                    <th className="w-[28%] px-3 py-3 font-semibold">
                      Departamentos
                    </th>
                    <th className="w-[12%] px-3 py-3 font-semibold">Perfil</th>
                    <th className="w-[18%] px-3 py-3 text-right font-semibold">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {gestores.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="px-3 py-3">
                        <p className="font-medium text-zinc-900">{item.nome}</p>
                        <p className="mt-0.5 break-all text-xs text-zinc-500">
                          {item.email}
                        </p>
                        {resetId === item.id ? (
                          <div className="mt-3 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                            <input
                              type="text"
                              value={senhaTemporaria}
                              onChange={(e) =>
                                setSenhaTemporaria(e.target.value)
                              }
                              placeholder="Senha temporária"
                              className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-zinc-200"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => confirmarReset(item)}
                                className="rounded-md bg-brand-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
                              >
                                Salvar senha
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setResetId(null);
                                  setSenhaTemporaria("");
                                }}
                                className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-white"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.isDiretoria ? (
                            <span className="whitespace-nowrap rounded-full bg-brand-primary/10 px-2 py-0.5 text-[11px] font-semibold text-brand-primary">
                              Todos
                            </span>
                          ) : item.departamentos.length === 0 ? (
                            <span className="text-xs text-zinc-400">—</span>
                          ) : (
                            item.departamentos.map((departamento) => (
                              <span
                                key={departamento.id}
                                className="whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700"
                              >
                                {departamento.nome}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-zinc-700">
                        {item.isDiretoria ? "Diretoria" : "Gestor"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => iniciarEdicao(item)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-brand-primary hover:bg-red-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirReset(item)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-brand-secondary hover:bg-zinc-100"
                          >
                            Senha
                          </button>
                          <button
                            type="button"
                            onClick={() => remover(item)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
