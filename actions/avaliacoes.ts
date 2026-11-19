"use server";

import { revalidatePath } from "next/cache";
import { getSessionGestor, type SessionGestor } from "@/actions/auth";
import {
  calcularNotaFinalConsolidada,
  exigeJustificativa,
} from "@/lib/avaliacaoConsolidada";
import { prisma } from "@/lib/prisma";

type ItemAvaliacaoInput = {
  criterioId: string;
  notaObtida: number;
  justificativa?: string | null;
};

type SalvarAvaliacaoInput = {
  colaboradorId: string;
  observacoes?: string;
  itens: ItemAvaliacaoInput[];
  mes: number;
  ano: number;
  atualizarExistente?: boolean;
  avaliacaoId?: string;
};

export type SalvarAvaliacaoResult =
  | { ok: true; atualizado: boolean }
  | { ok: false; exists?: boolean; error: string };

function criterioNoDepartamento(
  criterio: {
    isGlobal: boolean;
    departamentos: { id: string }[];
  },
  departamentoId: string,
) {
  return (
    criterio.isGlobal ||
    criterio.departamentos.some((d) => d.id === departamentoId)
  );
}

/** Lê todos os departamentos vinculados ao gestor (relação N:N), não um id legado. */
async function idsDepartamentosDoGestor(gestor: SessionGestor) {
  if (gestor.isDiretoria) return null;

  const atualizado = await prisma.gestor.findUnique({
    where: { id: gestor.id },
    select: {
      departamentos: { select: { id: true } },
    },
  });

  const ids = new Set(
    (atualizado?.departamentos ?? []).map((item) => item.id),
  );
  for (const id of gestor.departamentoIds ?? []) {
    if (id) ids.add(id);
  }
  return ids;
}

async function gestorTemAcessoDepartamento(
  gestor: SessionGestor,
  departamentoId: string,
) {
  if (gestor.isDiretoria) return true;
  if (!departamentoId) return false;
  const ids = await idsDepartamentosDoGestor(gestor);
  return ids?.has(departamentoId) ?? false;
}

function validarJustificativas(
  itens: ItemAvaliacaoInput[],
  criterios: { id: string; nome: string; toleranciaZero: boolean }[],
) {
  for (const item of itens) {
    const criterio = criterios.find((c) => c.id === item.criterioId);
    if (!criterio) continue;
    if (
      exigeJustificativa(item.notaObtida, criterio.toleranciaZero) &&
      !String(item.justificativa ?? "").trim()
    ) {
      return `Justificativa obrigatória para o critério "${criterio.nome}" (nota < 10.0).`;
    }
  }
  return null;
}

async function buscarCriteriosDoDepartamento(departamentoId: string) {
  const criterios = await prisma.criterioAvaliacao.findMany({
    include: { departamentos: { select: { id: true } } },
  });
  return criterios.filter((c) => criterioNoDepartamento(c, departamentoId));
}

async function itensColetivosDepartamento(
  departamentoId: string,
  mes: number,
  ano: number,
) {
  const avaliacaoDept = await prisma.avaliacaoDepartamento.findUnique({
    where: {
      departamentoId_mes_ano: { departamentoId, mes, ano },
    },
    include: {
      itens: {
        include: {
          criterio: {
            select: { id: true, nome: true, peso: true, toleranciaZero: true },
          },
        },
      },
    },
  });

  return (avaliacaoDept?.itens ?? []).map((item) => ({
    criterioId: item.criterioId,
    criterioNome: item.criterio.nome,
    peso: item.peso || item.criterio.peso,
    nota: item.nota,
    toleranciaZero: item.criterio.toleranciaZero,
    justificativa: item.justificativa,
  }));
}

async function recalcularNotasDepartamento(
  departamentoId: string,
  mes: number,
  ano: number,
) {
  const coletivos = await itensColetivosDepartamento(departamentoId, mes, ano);
  const avaliacoes = await prisma.avaliacao.findMany({
    where: {
      mes,
      ano,
      colaborador: { departamentoId },
    },
    include: {
      itens: {
        include: {
          criterio: { select: { id: true, peso: true } },
        },
      },
    },
  });

  for (const avaliacao of avaliacoes) {
    const individuais = avaliacao.itens.map((item) => ({
      criterioId: item.criterioId,
      peso: item.criterio.peso,
      nota: item.notaObtida,
    }));
    const notaFinal = calcularNotaFinalConsolidada(individuais, coletivos);
    await prisma.avaliacao.update({
      where: { id: avaliacao.id },
      data: { notaFinal },
    });
  }
}

export async function salvarAvaliacao(
  input: SalvarAvaliacaoInput,
): Promise<SalvarAvaliacaoResult> {
  try {
    const gestor = await getSessionGestor();
    if (!gestor) {
      return { ok: false, error: "Sessão expirada. Faça login novamente." };
    }

    const colaboradorId = input.colaboradorId?.trim();
    const observacoes = input.observacoes?.trim() || null;
    const itens = input.itens ?? [];
    const mes = Number(input.mes);
    const ano = Number(input.ano);

    if (!colaboradorId) {
      return { ok: false, error: "Selecione um colaborador." };
    }
    if (itens.length === 0) {
      return { ok: false, error: "Informe as notas dos critérios individuais." };
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      return { ok: false, error: "Mês inválido." };
    }
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
      return { ok: false, error: "Ano inválido." };
    }

    const colaborador = await prisma.colaborador.findUnique({
      where: { id: colaboradorId },
    });
    if (!colaborador) {
      return { ok: false, error: "Colaborador não encontrado." };
    }

    if (
      !(await gestorTemAcessoDepartamento(
        gestor,
        colaborador.departamentoId,
      ))
    ) {
      return {
        ok: false,
        error:
          "Você só pode avaliar colaboradores dos seus departamentos vinculados.",
      };
    }

    let existente = input.avaliacaoId
      ? await prisma.avaliacao.findUnique({ where: { id: input.avaliacaoId } })
      : await prisma.avaliacao.findUnique({
          where: {
            colaboradorId_mes_ano: { colaboradorId, mes, ano },
          },
        });

    if (
      existente &&
      (existente.colaboradorId !== colaboradorId ||
        existente.mes !== mes ||
        existente.ano !== ano)
    ) {
      existente = await prisma.avaliacao.findUnique({
        where: {
          colaboradorId_mes_ano: { colaboradorId, mes, ano },
        },
      });
    }

    if (existente && !input.atualizarExistente && !input.avaliacaoId) {
      return {
        ok: false,
        exists: true,
        error: `Este colaborador já possui avaliação em ${String(mes).padStart(2, "0")}/${ano}. Confirme para atualizar.`,
      };
    }

    const criteriosAplicaveis = await buscarCriteriosDoDepartamento(
      colaborador.departamentoId,
    );
    const criteriosIndividuais = criteriosAplicaveis.filter(
      (c) => c.tipoAvaliacao !== "DEPARTAMENTO",
    );
    const criteriosColetivos = criteriosAplicaveis.filter(
      (c) => c.tipoAvaliacao === "DEPARTAMENTO",
    );

    const somaPesos = criteriosAplicaveis.reduce(
      (total, item) => total + item.peso,
      0,
    );

    if (Math.abs(somaPesos - 100) > 0.01) {
      return {
        ok: false,
        error: `A soma dos pesos aplicáveis ao departamento é ${somaPesos.toFixed(1)}% (deve ser 100%).`,
      };
    }

    const idsIndividuais = new Set(criteriosIndividuais.map((item) => item.id));
    if (
      itens.length !== criteriosIndividuais.length ||
      itens.some((item) => !idsIndividuais.has(item.criterioId))
    ) {
      return {
        ok: false,
        error:
          "Os critérios informados não correspondem aos critérios individuais do departamento.",
      };
    }

    for (const item of itens) {
      if (
        !Number.isFinite(item.notaObtida) ||
        item.notaObtida < 0 ||
        item.notaObtida > 10
      ) {
        return {
          ok: false,
          error: "Cada nota deve ser um valor entre 0.0 e 10.0.",
        };
      }
    }

    const erroJust = validarJustificativas(itens, criteriosIndividuais);
    if (erroJust) {
      return { ok: false, error: erroJust };
    }

    if (criteriosColetivos.length > 0) {
      const coletivos = await itensColetivosDepartamento(
        colaborador.departamentoId,
        mes,
        ano,
      );
      if (coletivos.length < criteriosColetivos.length) {
        return {
          ok: false,
          error:
            "As metas coletivas do departamento ainda não foram lançadas para esta competência.",
        };
      }
    }

    const coletivos = await itensColetivosDepartamento(
      colaborador.departamentoId,
      mes,
      ano,
    );
    const individuais = itens.map((item) => {
      const criterio = criteriosIndividuais.find((c) => c.id === item.criterioId);
      return {
        criterioId: item.criterioId,
        peso: criterio?.peso ?? 0,
        nota: item.notaObtida,
      };
    });

    const notaFinal = calcularNotaFinalConsolidada(individuais, coletivos);
    const itensCreate = itens.map((item) => ({
      criterioId: item.criterioId,
      notaObtida: item.notaObtida,
      justificativa: String(item.justificativa ?? "").trim() || null,
    }));

    if (existente) {
      await prisma.itemAvaliacao.deleteMany({
        where: { avaliacaoId: existente.id },
      });

      await prisma.avaliacao.update({
        where: { id: existente.id },
        data: {
          gestorId: gestor.id,
          avaliadoPorId: gestor.id,
          notaFinal,
          observacoes,
          data: new Date(),
          itens: { create: itensCreate },
        },
      });
    } else {
      await prisma.avaliacao.create({
        data: {
          colaboradorId,
          gestorId: gestor.id,
          avaliadoPorId: gestor.id,
          notaFinal,
          observacoes,
          mes,
          ano,
          itens: { create: itensCreate },
        },
      });
    }

    revalidatePath("/avaliar");
    revalidatePath("/relatorios");
    revalidatePath("/bonus");
    revalidatePath("/");

    return { ok: true, atualizado: Boolean(existente) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Erro ao salvar avaliação.",
    };
  }
}

export async function salvarAvaliacaoDepartamento(input: {
  departamentoId: string;
  mes: number;
  ano: number;
  itens: ItemAvaliacaoInput[];
}): Promise<SalvarAvaliacaoResult> {
  try {
    const gestor = await getSessionGestor();
    if (!gestor) {
      return { ok: false, error: "Sessão expirada. Faça login novamente." };
    }

    const departamentoId = input.departamentoId?.trim();
    const mes = Number(input.mes);
    const ano = Number(input.ano);
    const itens = input.itens ?? [];

    if (!departamentoId) {
      return { ok: false, error: "Selecione um departamento." };
    }
    if (!(await gestorTemAcessoDepartamento(gestor, departamentoId))) {
      return {
        ok: false,
        error: "Você só pode lançar metas dos seus departamentos vinculados.",
      };
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      return { ok: false, error: "Mês inválido." };
    }
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
      return { ok: false, error: "Ano inválido." };
    }

    const criteriosAplicaveis = await buscarCriteriosDoDepartamento(
      departamentoId,
    );
    const criteriosColetivos = criteriosAplicaveis.filter(
      (c) => c.tipoAvaliacao === "DEPARTAMENTO",
    );

    if (criteriosColetivos.length === 0) {
      return {
        ok: false,
        error: "Não há critérios coletivos para este departamento.",
      };
    }

    const idsColetivos = new Set(criteriosColetivos.map((c) => c.id));
    if (
      itens.length !== criteriosColetivos.length ||
      itens.some((item) => !idsColetivos.has(item.criterioId))
    ) {
      return {
        ok: false,
        error: "Informe todos os critérios coletivos do departamento.",
      };
    }

    for (const item of itens) {
      if (
        !Number.isFinite(item.notaObtida) ||
        item.notaObtida < 0 ||
        item.notaObtida > 10
      ) {
        return {
          ok: false,
          error: "Cada nota deve ser um valor entre 0.0 e 10.0.",
        };
      }
    }

    const erroJust = validarJustificativas(itens, criteriosColetivos);
    if (erroJust) {
      return { ok: false, error: erroJust };
    }

    const existente = await prisma.avaliacaoDepartamento.findUnique({
      where: { departamentoId_mes_ano: { departamentoId, mes, ano } },
    });

    const pesoPorCriterio = new Map(
      criteriosColetivos.map((c) => [c.id, c.peso]),
    );

    const itensCreate = itens.map((item) => ({
      criterioId: item.criterioId,
      nota: item.notaObtida,
      peso: pesoPorCriterio.get(item.criterioId) ?? 0,
      justificativa: String(item.justificativa ?? "").trim() || null,
    }));

    if (existente) {
      await prisma.itemAvaliacaoDepartamento.deleteMany({
        where: { avaliacaoDepartamentoId: existente.id },
      });
      await prisma.avaliacaoDepartamento.update({
        where: { id: existente.id },
        data: {
          avaliadoPorId: gestor.id,
          itens: { create: itensCreate },
        },
      });
    } else {
      await prisma.avaliacaoDepartamento.create({
        data: {
          departamentoId,
          mes,
          ano,
          avaliadoPorId: gestor.id,
          itens: { create: itensCreate },
        },
      });
    }

    await recalcularNotasDepartamento(departamentoId, mes, ano);

    revalidatePath("/avaliar");
    revalidatePath("/relatorios");
    revalidatePath("/bonus");
    revalidatePath("/");

    return { ok: true, atualizado: Boolean(existente) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro ao salvar avaliação do departamento.",
    };
  }
}

export async function getAvaliacaoDepartamento(
  departamentoId: string,
  mes: number,
  ano: number,
) {
  const gestor = await getSessionGestor();
  if (!gestor) return null;

  const deptId = String(departamentoId ?? "").trim();
  if (!deptId) return null;
  if (!(await gestorTemAcessoDepartamento(gestor, deptId))) {
    return null;
  }

  return prisma.avaliacaoDepartamento.findUnique({
    where: {
      departamentoId_mes_ano: { departamentoId: deptId, mes, ano },
    },
    include: {
      itens: {
        select: {
          criterioId: true,
          nota: true,
          peso: true,
          justificativa: true,
        },
      },
      avaliadoPor: { select: { id: true, nome: true } },
    },
  });
}

export async function verificarAvaliacaoExistente(
  colaboradorId: string,
  mes: number,
  ano: number,
) {
  const existente = await prisma.avaliacao.findUnique({
    where: {
      colaboradorId_mes_ano: { colaboradorId, mes, ano },
    },
    select: {
      id: true,
      notaFinal: true,
      observacoes: true,
      itens: {
        select: { criterioId: true, notaObtida: true, justificativa: true },
      },
    },
  });

  return existente;
}

export async function getAvaliacaoParaEdicao(avaliacaoId: string) {
  const gestor = await getSessionGestor();
  if (!gestor) return null;

  const avaliacao = await prisma.avaliacao.findUnique({
    where: { id: avaliacaoId },
    include: {
      colaborador: { select: { id: true, departamentoId: true } },
      itens: {
        select: { criterioId: true, notaObtida: true, justificativa: true },
      },
    },
  });

  if (!avaliacao) return null;

  if (
    !(await gestorTemAcessoDepartamento(
      gestor,
      avaliacao.colaborador.departamentoId,
    ))
  ) {
    return null;
  }

  return {
    id: avaliacao.id,
    colaboradorId: avaliacao.colaboradorId,
    mes: avaliacao.mes,
    ano: avaliacao.ano,
    observacoes: avaliacao.observacoes,
    notaFinal: avaliacao.notaFinal,
    itens: avaliacao.itens,
  };
}

export async function excluirAvaliacao(avaliacaoId: string) {
  const gestor = await getSessionGestor();
  if (!gestor) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const id = avaliacaoId?.trim();
  if (!id) throw new Error("ID da avaliação é obrigatório.");

  const avaliacao = await prisma.avaliacao.findUnique({
    where: { id },
    include: {
      colaborador: { select: { departamentoId: true } },
    },
  });

  if (!avaliacao) throw new Error("Avaliação não encontrada.");

  if (
    !(await gestorTemAcessoDepartamento(
      gestor,
      avaliacao.colaborador.departamentoId,
    ))
  ) {
    throw new Error(
      "Você só pode excluir avaliações dos seus departamentos vinculados.",
    );
  }

  await prisma.itemAvaliacao.deleteMany({ where: { avaliacaoId: id } });
  await prisma.avaliacao.delete({ where: { id } });

  revalidatePath("/avaliar");
  revalidatePath("/relatorios");
  revalidatePath("/bonus");
  revalidatePath("/");
}

export async function excluirAvaliacaoDepartamento(input: {
  departamentoId?: string;
  mes?: number;
  ano?: number;
  avaliacaoDepartamentoId?: string;
}): Promise<SalvarAvaliacaoResult> {
  try {
    const gestor = await getSessionGestor();
    if (!gestor) {
      return { ok: false, error: "Sessão expirada. Faça login novamente." };
    }

    const avaliacaoId = String(input.avaliacaoDepartamentoId ?? "").trim();
    const departamentoId = String(input.departamentoId ?? "").trim();
    const mes = Number(input.mes);
    const ano = Number(input.ano);

    let existente = avaliacaoId
      ? await prisma.avaliacaoDepartamento.findUnique({
          where: { id: avaliacaoId },
          include: {
            departamento: { select: { id: true, nome: true } },
            _count: { select: { itens: true } },
          },
        })
      : null;

    if (!existente && departamentoId) {
      if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
        return { ok: false, error: "Mês inválido." };
      }
      if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
        return { ok: false, error: "Ano inválido." };
      }
      existente = await prisma.avaliacaoDepartamento.findUnique({
        where: {
          departamentoId_mes_ano: { departamentoId, mes, ano },
        },
        include: {
          departamento: { select: { id: true, nome: true } },
          _count: { select: { itens: true } },
        },
      });
    }

    if (!existente) {
      return {
        ok: false,
        error: "Lançamento coletivo não encontrado para esta competência.",
      };
    }

    if (
      !(await gestorTemAcessoDepartamento(gestor, existente.departamentoId))
    ) {
      return {
        ok: false,
        error:
          "Você só pode excluir lançamentos coletivos dos seus departamentos vinculados.",
      };
    }

    await prisma.itemAvaliacaoDepartamento.deleteMany({
      where: { avaliacaoDepartamentoId: existente.id },
    });
    await prisma.avaliacaoDepartamento.delete({
      where: { id: existente.id },
    });

    await recalcularNotasDepartamento(
      existente.departamentoId,
      existente.mes,
      existente.ano,
    );

    revalidatePath("/avaliar");
    revalidatePath("/relatorios");
    revalidatePath("/bonus");
    revalidatePath("/");

    return { ok: true, atualizado: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro ao excluir lançamento coletivo.",
    };
  }
}
