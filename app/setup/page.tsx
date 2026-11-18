"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { criarGestorInicial } from "@/actions/auth";

export default function SetupPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const result = await criarGestorInicial();

        if (result.ok) {
          setMessage(
            `Gestor criado com sucesso. Email: ${result.email} | Senha: ${result.senha}`,
          );
          return;
        }

        setError(result.error);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Falha ao chamar a Server Action.",
        );
      }
    });
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Setup inicial
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Crie o gestor administrador para o primeiro acesso ao sistema.
        </p>

        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Criando..." : "Criar gestor inicial"}
        </button>

        {message ? (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <p className="mt-6 text-center text-xs text-zinc-400">
          <Link href="/login" className="text-zinc-600 underline hover:text-zinc-900">
            Ir para o login
          </Link>
        </p>
      </div>
    </main>
  );
}
