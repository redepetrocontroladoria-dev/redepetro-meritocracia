"use client";

import { useActionState, useState } from "react";
import { login } from "@/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);
  const [mostrarAjuda, setMostrarAjuda] = useState(false);

  return (
    <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
      <div className="mb-8 text-center">
        <p className="mb-2 text-sm font-bold italic text-brand-primary">
          REDEPETRO
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-secondary">
          Sistema Meritocracia
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Acesse com o e-mail e a senha do gestor.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="admin@redepetro.com.br"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">Senha</span>
          <input
            type="password"
            name="senha"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          />
        </label>

        {state && !state.ok ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setMostrarAjuda((atual) => !atual)}
          className="text-xs text-zinc-500 underline decoration-zinc-300 underline-offset-2 transition hover:text-brand-primary"
        >
          Esqueci minha senha
        </button>
      </div>

      {mostrarAjuda ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm text-zinc-600">
          Solicite a redefinição de senha à{" "}
          <span className="font-semibold text-brand-secondary">
            Diretoria / Controladoria
          </span>
          . O reset é feito imediatamente no menu{" "}
          <span className="font-semibold text-brand-secondary">Gestores</span>{" "}
          do sistema.
        </div>
      ) : null}
    </div>
  );
}
