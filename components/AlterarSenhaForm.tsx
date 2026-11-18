"use client";

import { useActionState } from "react";
import { alterarPropriaSenha } from "@/actions/auth";
import { Panel, SubmitButton } from "@/components/ui";

export function AlterarSenhaForm() {
  const [state, formAction] = useActionState(alterarPropriaSenha, null);

  return (
    <Panel title="Alterar senha">
      <form action={formAction} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">Senha atual</span>
          <input
            type="password"
            name="senhaAtual"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">Nova senha</span>
          <input
            type="password"
            name="novaSenha"
            required
            autoComplete="new-password"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">
            Confirmar nova senha
          </span>
          <input
            type="password"
            name="confirmarSenha"
            required
            autoComplete="new-password"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
          />
        </label>

        {state?.ok && state.success ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        ) : null}

        {state && !state.ok && state.error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}

        <SubmitButton>Salvar nova senha</SubmitButton>
      </form>
    </Panel>
  );
}
