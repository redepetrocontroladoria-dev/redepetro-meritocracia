import Link from "next/link";
import { getSessionGestor } from "@/actions/auth";
import { DashboardHome } from "@/components/DashboardHome";
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

  const cardsVisiveis = cards
    .filter((card) => !card.diretoriaOnly || gestor?.isDiretoria)
    .map(({ href, title, description }) => ({ href, title, description }));

  if (!gestor) {
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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

  const departamentos = gestor.isDiretoria
    ? await prisma.departamento.findMany({ orderBy: { nome: "asc" } })
    : gestor.departamentos;

  const deptIds = departamentos.map((d) => d.id);
  const janela12 = Array.from({ length: 12 }, (_, i) =>
    competenciaOffset(mes, ano, i),
  );
  const anosJanela = Array.from(new Set([ano, ano - 1, ...janela12.map((c) => c.ano)]));

  const [
    colaboradores,
    avaliacoesMes,
    coletivasMes,
    criterios,
    avaliacoesPeriodo,
    coletivasPeriodo,
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
        OR: [
          ...janela12.map((c) => ({ mes: c.mes, ano: c.ano })),
          ...anosJanela.flatMap((a) =>
            Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, ano: a })),
          ),
        ],
      },
      select: {
        mes: true,
        ano: true,
        notaFinal: true,
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
      where: {
        departamentoId: { in: deptIds },
        OR: [
          ...janela12.map((c) => ({ mes: c.mes, ano: c.ano })),
          ...anosJanela.flatMap((a) =>
            Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, ano: a })),
          ),
        ],
      },
      include: {
        itens: {
          include: { criterio: { select: { id: true, nome: true } } },
        },
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

  const avaliacoesDash = avaliacoesPeriodo.map((av) => ({
    mes: av.mes,
    ano: av.ano,
    notaFinal: av.notaFinal,
    departamentoId: av.colaborador.departamentoId,
    itens: av.itens.map((item) => ({
      criterioId: item.criterioId,
      criterioNome: item.criterio.nome,
      nota: item.notaObtida,
    })),
  }));

  const coletivasDash = coletivasPeriodo.map((coletiva) => ({
    mes: coletiva.mes,
    ano: coletiva.ano,
    departamentoId: coletiva.departamentoId,
    itens: coletiva.itens.map((item) => ({
      criterioId: item.criterioId,
      criterioNome: item.criterio.nome,
      nota: item.nota,
    })),
  }));

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

      <DashboardHome
        isDiretoria={gestor.isDiretoria}
        mesAtual={mes}
        anoAtual={ano}
        departamentos={departamentos.map((d) => ({
          id: d.id,
          nome: d.nome,
        }))}
        avaliacoes={avaliacoesDash}
        coletivas={coletivasDash}
        pendencias={pendencias}
        cards={cardsVisiveis}
      />
    </main>
  );
}
