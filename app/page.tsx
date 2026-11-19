import Link from "next/link";
import { getSessionGestor } from "@/actions/auth";
import { DashboardExecutivo } from "@/components/DashboardExecutivo";
import {
  calcularVariacao,
  formatarCompetencia,
  mediaDeNotas,
  competenciaAnterior,
  nomeMes,
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

function competenciaOffset(mes: number, ano: number, offset: number) {
  const total = ano * 12 + (mes - 1) - offset;
  return { mes: (total % 12) + 1, ano: Math.floor(total / 12) };
}

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

  let dashboard = null;

  if (gestor) {
    const departamentos = gestor.isDiretoria
      ? await prisma.departamento.findMany({ orderBy: { nome: "asc" } })
      : gestor.departamentos;

    const deptIds = departamentos.map((d) => d.id);

    const [
      colaboradores,
      avaliacoesMes,
      coletivasMes,
      criterios,
      avaliacoes6m,
    ] = await Promise.all([
      prisma.colaborador.findMany({
        where: { departamentoId: { in: deptIds } },
        select: { id: true, departamentoId: true },
      }),
      prisma.avaliacao.findMany({
        where: {
          mes,
          ano,
          colaborador: { departamentoId: { in: deptIds } },
        },
        select: {
          colaboradorId: true,
          colaborador: { select: { departamentoId: true } },
          itens: {
            select: {
              notaObtida: true,
              criterioId: true,
              criterio: { select: { id: true, nome: true } },
            },
          },
        },
      }),
      prisma.avaliacaoDepartamento.findMany({
        where: { mes, ano, departamentoId: { in: deptIds } },
        select: { departamentoId: true },
      }),
      prisma.criterioAvaliacao.findMany({
        include: { departamentos: { select: { id: true } } },
      }),
      prisma.avaliacao.findMany({
        where: {
          colaborador: { departamentoId: { in: deptIds } },
          OR: Array.from({ length: 6 }, (_, i) => {
            const c = competenciaOffset(mes, ano, i);
            return { mes: c.mes, ano: c.ano };
          }),
        },
        select: {
          mes: true,
          ano: true,
          notaFinal: true,
          colaborador: { select: { departamentoId: true } },
        },
      }),
    ]);

    const coletivasSet = new Set(coletivasMes.map((c) => c.departamentoId));
    const avaliadosPorDept = new Map<string, Set<string>>();
    for (const av of avaliacoesMes) {
      const deptId = av.colaborador.departamentoId;
      const set = avaliadosPorDept.get(deptId) ?? new Set();
      set.add(av.colaboradorId);
      avaliadosPorDept.set(deptId, set);
    }

    const pendencias = departamentos.map((dept) => {
      const temCriteriosColetivos = criterios.some(
        (c) =>
          c.tipoAvaliacao === "DEPARTAMENTO" &&
          (c.isGlobal || c.departamentos.some((d) => d.id === dept.id)),
      );
      const totalColaboradores = colaboradores.filter(
        (c) => c.departamentoId === dept.id,
      ).length;
      return {
        departamentoId: dept.id,
        nome: dept.nome,
        temCriteriosColetivos,
        metasColetivasLancadas: coletivasSet.has(dept.id),
        avaliados: avaliadosPorDept.get(dept.id)?.size ?? 0,
        totalColaboradores,
      };
    });

    const evolucao: {
      label: string;
      media: number | null;
      serie: string;
    }[] = [];

    for (let i = 5; i >= 0; i--) {
      const c = competenciaOffset(mes, ano, i);
      const label = `${nomeMes(c.mes).slice(0, 3)}/${String(c.ano).slice(2)}`;
      const doMes = avaliacoes6m.filter(
        (a) => a.mes === c.mes && a.ano === c.ano,
      );

      if (gestor.isDiretoria) {
        evolucao.push({
          label,
          serie: "Empresa",
          media: mediaDeNotas(doMes.map((a) => a.notaFinal)),
        });
      }

      for (const dept of departamentos) {
        const notas = doMes
          .filter((a) => a.colaborador.departamentoId === dept.id)
          .map((a) => a.notaFinal);
        evolucao.push({
          label,
          serie: dept.nome,
          media: mediaDeNotas(notas),
        });
      }
    }

    const mediasPorCriterio = new Map<string, { nome: string; notas: number[] }>();
    for (const av of avaliacoesMes) {
      for (const item of av.itens) {
        const atual = mediasPorCriterio.get(item.criterioId) ?? {
          nome: item.criterio.nome,
          notas: [],
        };
        atual.notas.push(item.notaObtida);
        mediasPorCriterio.set(item.criterioId, atual);
      }
    }

    for (const coletiva of await prisma.avaliacaoDepartamento.findMany({
      where: { mes, ano, departamentoId: { in: deptIds } },
      include: {
        itens: {
          include: { criterio: { select: { id: true, nome: true } } },
        },
      },
    })) {
      for (const item of coletiva.itens) {
        const atual = mediasPorCriterio.get(item.criterioId) ?? {
          nome: item.criterio.nome,
          notas: [],
        };
        atual.notas.push(item.nota);
        mediasPorCriterio.set(item.criterioId, atual);
      }
    }

    const ofensores = Array.from(mediasPorCriterio.entries())
      .map(([criterioId, data]) => ({
        criterioId,
        nome: data.nome,
        media:
          data.notas.reduce((t, n) => t + n, 0) / Math.max(1, data.notas.length),
      }))
      .sort((a, b) => a.media - b.media)
      .slice(0, 5);

    dashboard = (
      <DashboardExecutivo
        competenciaLabel={formatarCompetencia(mes, ano)}
        pendencias={pendencias}
        evolucao={evolucao}
        ofensores={ofensores}
        isDiretoria={gestor.isDiretoria}
      />
    );
  }

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

      {dashboard}

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
