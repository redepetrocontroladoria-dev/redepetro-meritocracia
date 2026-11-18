import { classificarNota } from "@/lib/escala";
import { prisma } from "@/lib/prisma";

export type DesempenhoDepartamento = {
  departamentoId: string;
  departamento: string;
  totalAvaliacoes: number;
  colaboradoresAvaliados: number;
  notaMedia: number;
  variacaoPontos?: number;
  variacaoPercentual?: number;
  variacaoLabel?: string;
  variacaoBadgeClass?: string;
};

type FiltroDesempenho = {
  departamentoId?: string;
  departamentoIds?: string[];
  mes?: number;
  ano?: number;
};

export async function getDesempenhoPorDepartamento(
  options?: FiltroDesempenho,
): Promise<DesempenhoDepartamento[]> {
  const filtroDepartamento = options?.departamentoId
    ? { departamentoId: options.departamentoId }
    : options?.departamentoIds?.length
      ? { departamentoId: { in: options.departamentoIds } }
      : undefined;

  const avaliacoes = await prisma.avaliacao.findMany({
    where: {
      ...(options?.mes && options?.ano
        ? { mes: options.mes, ano: options.ano }
        : {}),
      ...(filtroDepartamento
        ? { colaborador: filtroDepartamento }
        : {}),
    },
    select: {
      notaFinal: true,
      colaboradorId: true,
      colaborador: {
        select: {
          departamentoId: true,
          departamento: { select: { nome: true } },
        },
      },
    },
  });

  const mapa = new Map<
    string,
    {
      departamento: string;
      totalAvaliacoes: number;
      somaNotas: number;
      colaboradores: Set<string>;
    }
  >();

  for (const avaliacao of avaliacoes) {
    const id = avaliacao.colaborador.departamentoId;
    const atual = mapa.get(id) ?? {
      departamento: avaliacao.colaborador.departamento.nome,
      totalAvaliacoes: 0,
      somaNotas: 0,
      colaboradores: new Set<string>(),
    };

    atual.totalAvaliacoes += 1;
    atual.somaNotas += avaliacao.notaFinal;
    atual.colaboradores.add(avaliacao.colaboradorId);
    mapa.set(id, atual);
  }

  return Array.from(mapa.entries())
    .map(([departamentoId, item]) => ({
      departamentoId,
      departamento: item.departamento,
      totalAvaliacoes: item.totalAvaliacoes,
      colaboradoresAvaliados: item.colaboradores.size,
      notaMedia:
        item.totalAvaliacoes > 0 ? item.somaNotas / item.totalAvaliacoes : 0,
    }))
    .sort((a, b) => b.notaMedia - a.notaMedia);
}

export function classificarDesempenho(notaMedia: number) {
  const faixa = classificarNota(notaMedia);
  const percentual = Math.min(100, (notaMedia / 10) * 100);

  return {
    percentual,
    label: faixa.label,
    descricao: faixa.descricao,
    badgeClass: faixa.badgeClass,
    barClass: faixa.barClass,
  };
}
