"use server";

import { revalidatePath } from "next/cache";
import { getSessionGestor, requireDiretoria } from "@/actions/auth";
import { prisma } from "@/lib/prisma";

function pesoAplicavelAoDepartamento(
  criterio: { peso: number; isGlobal: boolean; departamentos: { id: string }[] },
  departamentoId: string,
) {
  if (criterio.isGlobal) return criterio.peso;
  return criterio.departamentos.some((d) => d.id === departamentoId)
    ? criterio.peso
    : 0;
}

async function validarPesoCriterio(params: {
  peso: number;
  isGlobal: boolean;
  departamentoIds: string[];
  excludeId?: string;
}) {
  const { peso, isGlobal, departamentoIds, excludeId } = params;

  const [criterios, departamentos] = await Promise.all([
    prisma.criterioAvaliacao.findMany({
      where: excludeId ? { id: { not: excludeId } } : undefined,
      select: {
        peso: true,
        isGlobal: true,
        departamentos: { select: { id: true } },
      },
    }),
    prisma.departamento.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  const alvos = isGlobal
    ? departamentos
    : departamentos.filter((d) => departamentoIds.includes(d.id));

  if (!isGlobal && alvos.length === 0) {
    throw new Error("Selecione pelo menos 1 departamento.");
  }

  for (const departamento of alvos) {
    const somaAtual = criterios.reduce(
      (total, item) =>
        total + pesoAplicavelAoDepartamento(item, departamento.id),
      0,
    );
    const soma = somaAtual + peso;
    if (soma > 100) {
      throw new Error(
        `Ultrapassaria 100% no departamento ${departamento.nome} (${soma.toFixed(1)}%).`,
      );
    }
  }
}

function lerDepartamentoIds(formData: FormData) {
  return formData
    .getAll("departamentoIds")
    .map((item) => String(item).trim())
    .filter(Boolean);
}

export async function criarDepartamento(formData: FormData) {
  await requireDiretoria();

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Nome do departamento é obrigatório.");

  await prisma.departamento.create({ data: { nome } });
  revalidatePath("/departamentos");
  revalidatePath("/colaboradores");
}

export async function atualizarDepartamento(
  id: string,
  dados: { nome: string },
) {
  await requireDiretoria();

  const departamentoId = id?.trim();
  const nome = dados.nome?.trim() ?? "";
  if (!departamentoId || !nome) {
    throw new Error("Nome do departamento é obrigatório.");
  }

  await prisma.departamento.update({
    where: { id: departamentoId },
    data: { nome },
  });

  revalidatePath("/departamentos");
  revalidatePath("/colaboradores");
}

export async function excluirDepartamento(id: string) {
  await requireDiretoria();

  const departamentoId = id?.trim();
  if (!departamentoId) throw new Error("ID do departamento é obrigatório.");

  const departamento = await prisma.departamento.findUnique({
    where: { id: departamentoId },
    include: {
      _count: {
        select: { colaboradores: true, gestores: true, criterios: true },
      },
    },
  });

  if (!departamento) throw new Error("Departamento não encontrado.");

  const vinculados =
    departamento._count.colaboradores +
    departamento._count.gestores +
    departamento._count.criterios;

  if (vinculados > 0) {
    throw new Error(
      "Não é possível excluir: existem gestores, colaboradores ou critérios vinculados.",
    );
  }

  await prisma.departamento.delete({ where: { id: departamentoId } });
  revalidatePath("/departamentos");
  revalidatePath("/colaboradores");
}

export async function criarColaborador(formData: FormData) {
  const gestor = await getSessionGestor();
  if (!gestor) throw new Error("Sessão expirada. Faça login novamente.");

  const nome = String(formData.get("nome") ?? "").trim();
  const cargo = String(formData.get("cargo") ?? "").trim();
  const departamentoId = String(formData.get("departamentoId") ?? "").trim();
  const valorAlvoRaw = String(formData.get("valorAlvo") ?? "0")
    .trim()
    .replace(",", ".");
  const valorAlvo = Number(valorAlvoRaw);

  if (!nome || !cargo || !departamentoId) {
    throw new Error("Nome, cargo e departamento são obrigatórios.");
  }
  if (!Number.isFinite(valorAlvo) || valorAlvo < 0) {
    throw new Error("Valor-alvo do bônus inválido.");
  }

  if (
    !gestor.isDiretoria &&
    !gestor.departamentoIds.includes(departamentoId)
  ) {
    throw new Error(
      "Você só pode cadastrar colaboradores nos seus departamentos.",
    );
  }

  await prisma.colaborador.create({
    data: { nome, cargo, departamentoId, valorAlvo },
  });

  revalidatePath("/colaboradores");
  revalidatePath("/bonus");
}

export async function atualizarColaborador(
  id: string,
  dados: {
    nome: string;
    cargo: string;
    departamentoId: string;
    valorAlvo: number;
  },
) {
  const gestor = await getSessionGestor();
  if (!gestor) throw new Error("Sessão expirada. Faça login novamente.");

  const colaboradorId = id?.trim();
  const nome = dados.nome?.trim() ?? "";
  const cargo = dados.cargo?.trim() ?? "";
  const departamentoId = dados.departamentoId?.trim() ?? "";
  const valorAlvo = Number(dados.valorAlvo);

  if (!colaboradorId || !nome || !cargo || !departamentoId) {
    throw new Error("Nome, cargo e departamento são obrigatórios.");
  }
  if (!Number.isFinite(valorAlvo) || valorAlvo < 0) {
    throw new Error("Valor-alvo do bônus inválido.");
  }

  const colaborador = await prisma.colaborador.findUnique({
    where: { id: colaboradorId },
  });
  if (!colaborador) throw new Error("Colaborador não encontrado.");

  if (
    !gestor.isDiretoria &&
    !gestor.departamentoIds.includes(colaborador.departamentoId)
  ) {
    throw new Error(
      "Você só pode editar colaboradores dos seus departamentos.",
    );
  }

  if (
    !gestor.isDiretoria &&
    !gestor.departamentoIds.includes(departamentoId)
  ) {
    throw new Error(
      "Você não pode mover o colaborador para um departamento fora do seu escopo.",
    );
  }

  await prisma.colaborador.update({
    where: { id: colaboradorId },
    data: { nome, cargo, departamentoId, valorAlvo },
  });

  revalidatePath("/colaboradores");
  revalidatePath("/bonus");
}

export async function excluirColaborador(id: string) {
  const gestor = await getSessionGestor();
  if (!gestor) throw new Error("Sessão expirada. Faça login novamente.");

  const colaboradorId = id?.trim();
  if (!colaboradorId) throw new Error("ID do colaborador é obrigatório.");

  const colaborador = await prisma.colaborador.findUnique({
    where: { id: colaboradorId },
    include: { _count: { select: { avaliacoes: true } } },
  });

  if (!colaborador) throw new Error("Colaborador não encontrado.");

  if (
    !gestor.isDiretoria &&
    !gestor.departamentoIds.includes(colaborador.departamentoId)
  ) {
    throw new Error(
      "Você só pode excluir colaboradores dos seus departamentos.",
    );
  }

  if (colaborador._count.avaliacoes > 0) {
    throw new Error(
      "Não é possível excluir: existem avaliações vinculadas a este colaborador.",
    );
  }

  await prisma.colaborador.delete({ where: { id: colaboradorId } });
  revalidatePath("/colaboradores");
}

export type CriterioActionResult =
  | { ok: true }
  | { ok: false; error: string };

function resultadoErroCriterio(error: unknown): CriterioActionResult {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_")
  ) {
    throw error;
  }

  return {
    ok: false,
    error: error instanceof Error ? error.message : "Erro inesperado.",
  };
}

export async function criarCriterio(
  formData: FormData,
): Promise<CriterioActionResult> {
  try {
    await requireDiretoria();

    const nome = String(formData.get("nome") ?? "").trim();
    const descricao = String(formData.get("descricao") ?? "").trim() || null;
    const pesoRaw = String(formData.get("peso") ?? "").trim().replace(",", ".");
    const peso = Number(pesoRaw);
    const isGlobal = formData.get("isGlobal") === "on";
    const toleranciaZero = formData.get("toleranciaZero") === "on";
    const tipoAvaliacaoRaw = String(formData.get("tipoAvaliacao") ?? "INDIVIDUAL")
      .trim()
      .toUpperCase();
    const tipoAvaliacao =
      tipoAvaliacaoRaw === "DEPARTAMENTO" ? "DEPARTAMENTO" : "INDIVIDUAL";
    const departamentoIds = isGlobal ? [] : lerDepartamentoIds(formData);

    if (!nome) throw new Error("Nome do critério é obrigatório.");
    if (!Number.isFinite(peso) || peso <= 0 || peso > 100) {
      throw new Error("A porcentagem deve ser maior que 0 e no máximo 100.");
    }
    if (!isGlobal && departamentoIds.length === 0) {
      throw new Error("Selecione pelo menos 1 departamento.");
    }

    await validarPesoCriterio({ peso, isGlobal, departamentoIds });

    await prisma.criterioAvaliacao.create({
      data: {
        nome,
        peso,
        descricao,
        isGlobal,
        toleranciaZero,
        tipoAvaliacao,
        departamentos: isGlobal
          ? undefined
          : { connect: departamentoIds.map((id) => ({ id })) },
      },
    });

    revalidatePath("/criterios");
    revalidatePath("/avaliar");
    revalidatePath("/bonus");
    return { ok: true };
  } catch (error) {
    return resultadoErroCriterio(error);
  }
}

export async function atualizarCriterio(
  id: string,
  dados: {
    nome: string;
    peso: number;
    descricao?: string | null;
    isGlobal: boolean;
    toleranciaZero: boolean;
    tipoAvaliacao: string;
    departamentoIds: string[];
  },
): Promise<CriterioActionResult> {
  try {
    await requireDiretoria();

    const criterioId = id?.trim();
    const nome = dados.nome?.trim() ?? "";
    const descricao = dados.descricao?.trim() || null;
    const peso = Number(dados.peso);
    const isGlobal = Boolean(dados.isGlobal);
    const toleranciaZero = Boolean(dados.toleranciaZero);
    const tipoAvaliacao =
      String(dados.tipoAvaliacao ?? "INDIVIDUAL").toUpperCase() ===
      "DEPARTAMENTO"
        ? "DEPARTAMENTO"
        : "INDIVIDUAL";
    const departamentoIds = isGlobal ? [] : (dados.departamentoIds ?? []);

    if (!criterioId || !nome) {
      throw new Error("Nome do critério é obrigatório.");
    }
    if (!Number.isFinite(peso) || peso <= 0 || peso > 100) {
      throw new Error("A porcentagem deve ser maior que 0 e no máximo 100.");
    }
    if (!isGlobal && departamentoIds.length === 0) {
      throw new Error("Selecione pelo menos 1 departamento.");
    }

    await validarPesoCriterio({
      peso,
      isGlobal,
      departamentoIds,
      excludeId: criterioId,
    });

    await prisma.criterioAvaliacao.update({
      where: { id: criterioId },
      data: {
        nome,
        peso,
        descricao,
        isGlobal,
        toleranciaZero,
        tipoAvaliacao,
        departamentos: {
          set: departamentoIds.map((deptId) => ({ id: deptId })),
        },
      },
    });

    revalidatePath("/criterios");
    revalidatePath("/avaliar");
    revalidatePath("/bonus");
    return { ok: true };
  } catch (error) {
    return resultadoErroCriterio(error);
  }
}

export async function excluirCriterio(
  id: string,
): Promise<CriterioActionResult> {
  try {
    await requireDiretoria();

    const criterioId = id?.trim();
    if (!criterioId) throw new Error("ID do critério é obrigatório.");

    const criterio = await prisma.criterioAvaliacao.findUnique({
      where: { id: criterioId },
      include: { _count: { select: { itens: true } } },
    });

    if (!criterio) throw new Error("Critério não encontrado.");

    if (criterio._count.itens > 0) {
      throw new Error(
        "Não é possível excluir: existem itens de avaliação vinculados a este critério.",
      );
    }

    await prisma.criterioAvaliacao.delete({ where: { id: criterioId } });
    revalidatePath("/criterios");
    revalidatePath("/avaliar");
    return { ok: true };
  } catch (error) {
    return resultadoErroCriterio(error);
  }
}
