import Link from "next/link";
import { getSessionGestor } from "@/actions/auth";
import {
  calcularVariacao,
  formatarCompetencia,
  mediaDeNotas,
  competenciaAnterior,
} from "@/lib/competencia";
import { getDesempenhoPorDepartamento } from "@/lib/desempenho";
import { prisma } from "@/lib/prisma";

export const instant = false;

const cards = [
  {
    href: "/departamentos",
    title: "Departamentos",
    description: "Cadastre a estrutura organizacional.",
    diretoriaOnly: true,
  },
  {
    href: "/colaboradores",
    title: "Colaboradores",
    description: "Registre pessoas e vincule departamentos.",
    diretoriaOnly: false,
  },
  {
    href: "/criterios",
    title: "Critérios",
    description: "Defina critérios e pesos de avaliação.",
    diretoriaOnly: true,
  },
  {
    href: "/avaliar",
    title: "Avaliar",
    description: "Realize avaliações com cálculo em tempo real.",
    diretoriaOnly: false,
  },
  {
    href: "/relatorios",
    title: "Relatórios",
    description: "Histórico de avaliações e exportação Excel/PDF.",
    diretoriaOnly: false,
  },
];

export default async function Home() {
  const gestor = await getSessionGestor();
  const agora = new Date();
  const mes = agora.getMonth() + 1;
  const ano = agora.getFullYear();
  const anterior = competenciaAnterior(mes, ano);

  const filtroEquipe = gestor?.isDiretoria
    ? {}
    : { departamentoIds: gestor?.departamentoIds ?? [] };

  const consolidado = gestor
    ? await getDesempenhoPorDepartamento({
        ...filtroEquipe,
        mes,
        ano,
      })
    : [];

  const consolidadoAnterior = gestor
    ? await getDesempenhoPorDepartamento({
        ...filtroEquipe,
        mes: anterior.mes,
        ano: anterior.ano,
      })
    : [];

  let tituloIndice = "Índice de desempenho";
  let notaMedia: number | null = null;
  let detalhe = "Sem avaliações nesta competência.";
  let variacao = calcularVariacao(null, null);

  if (gestor?.isDiretoria) {
    tituloIndice = `Média geral da empresa — ${formatarCompetencia(mes, ano)}`;
    const atual = await prisma.avaliacao.findMany({
      where: { mes, ano },
      select: { notaFinal: true },
    });
    const ant = await prisma.avaliacao.findMany({
      where: { mes: anterior.mes, ano: anterior.ano },
      select: { notaFinal: true },
    });
    notaMedia = mediaDeNotas(atual.map((item) => item.notaFinal));
    variacao = calcularVariacao(
      notaMedia,
      mediaDeNotas(ant.map((item) => item.notaFinal)),
    );
    detalhe = `${atual.length} avaliação(ões) no mês`;
  } else if (gestor) {
    const nomes =
      gestor.departamentos.map((item) => item.nome).join(", ") || "Equipe";
    tituloIndice = `${nomes} — ${formatarCompetencia(mes, ano)}`;
    const somaAtual = consolidado.reduce(
      (total, item) => total + item.notaMedia * item.totalAvaliacoes,
      0,
    );
    const qtdAtual = consolidado.reduce(
      (total, item) => total + item.totalAvaliacoes,
      0,
    );
    const somaAnt = consolidadoAnterior.reduce(
      (total, item) => total + item.notaMedia * item.totalAvaliacoes,
      0,
    );
    const qtdAnt = consolidadoAnterior.reduce(
      (total, item) => total + item.totalAvaliacoes,
      0,
    );
    notaMedia = qtdAtual > 0 ? somaAtual / qtdAtual : null;
    variacao = calcularVariacao(
      notaMedia,
      qtdAnt > 0 ? somaAnt / qtdAnt : null,
    );
    detalhe = `${qtdAtual} avaliação(ões) · ${consolidado.length} departamento(s)`;
  }

  const cardsVisiveis = cards.filter(
    (card) => !card.diretoriaOnly || gestor?.isDiretoria,
  );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="mb-8">
        <p className="mb-2 text-sm font-bold italic text-brand-primary">
          REDEPETRO
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-brand-secondary">
          Sistema Meritocracia
        </h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-500">
          Avaliações mensais, médias consolidadas e evolução mês a mês.
        </p>
      </div>

      {gestor ? (
        <section className="mb-8 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="bg-brand-secondary px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white">
            {tituloIndice}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-5">
            <div>
              <p className="text-4xl font-semibold tracking-tight text-brand-primary">
                {notaMedia == null ? "—" : notaMedia.toFixed(2)}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{detalhe}</p>
              <span
                className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${variacao.badgeClass}`}
              >
                vs. mês anterior: {variacao.label}
              </span>
            </div>
            <Link
              href={`/relatorios?mes=${mes}&ano=${ano}`}
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800"
            >
              Ver relatórios
            </Link>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cardsVisiveis.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-zinc-200 border-t-4 border-t-brand-primary bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow"
          >
            <h2 className="text-base font-semibold text-zinc-900">
              {card.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{card.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
