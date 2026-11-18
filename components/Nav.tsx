import Link from "next/link";
import { logout } from "@/actions/auth";

type NavProps = {
  isDiretoria?: boolean;
  nomeGestor?: string;
};

export function Nav({ isDiretoria = false, nomeGestor }: NavProps) {
  const links = [
    { href: "/", label: "Início" },
    ...(isDiretoria
      ? [
          { href: "/departamentos", label: "Departamentos" },
          { href: "/gestores", label: "Gestores" },
          { href: "/criterios", label: "Critérios" },
        ]
      : []),
    { href: "/colaboradores", label: "Colaboradores" },
    { href: "/avaliar", label: "Avaliar" },
    { href: "/relatorios", label: "Relatórios" },
    { href: "/bonus", label: "Apuração / Bônus" },
  ];

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link
          href="/"
          className="text-sm font-bold italic tracking-tight text-brand-primary"
        >
          REDEPETRO
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          <nav className="flex flex-wrap gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-1.5 text-sm text-gray-800 transition hover:text-brand-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/perfil"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-brand-secondary transition hover:text-brand-primary"
            title={nomeGestor ? `Senha de ${nomeGestor}` : "Alterar minha senha"}
          >
            Minha Senha
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 text-sm text-gray-800 transition hover:text-brand-primary"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
