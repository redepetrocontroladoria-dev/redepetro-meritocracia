import Link from "next/link";

export const instant = false;

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-bold italic text-brand-primary">REDEPETRO</p>
      <h1 className="mt-2 text-2xl font-semibold text-brand-secondary">
        Página não encontrada
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        O endereço acessado não existe ou foi movido.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
