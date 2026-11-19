"use server";

import { revalidatePath } from "next/cache";
import { getSessionGestor } from "@/actions/auth";
import { prisma } from "@/lib/prisma";

export type FaixaPagamentoInput = {
  id?: string;
  minPercentual: number | string;
  maxPercentual: number | string;
  multiplicadorPeso: number | string;
  descricao: string;
};

export type BonusActionResult =
  | { ok: true }
  | { ok: false; error: string };

function parseNumero(valor: number | string) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : NaN;
  }
  const normalizado = String(valor ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  return Number(normalizado);
}

function revalidarRotasRegua() {
  revalidatePath("/bonus");
  revalidatePath("/avaliar");
  revalidatePath("/relatorios");
  revalidatePath("/");
}

function normalizarFaixa(dados: FaixaPagamentoInput) {
  const id = dados.id != null ? String(dados.id).trim() : "";
  const minPercentual = parseNumero(dados.minPercentual);
  const maxPercentual = parseNumero(dados.maxPercentual);
  let multiplicadorPeso = parseNumero(dados.multiplicadorPeso);
  const descricao = String(dados.descricao ?? "").trim();

  if (
    Number.isFinite(multiplicadorPeso) &&
    multiplicadorPeso > 1 &&
    multiplicadorPeso <= 100
  ) {
    multiplicadorPeso = multiplicadorPeso / 100;
  }

  if (!descricao) {
    return { ok: false as const, error: "Informe a descrição da faixa." };
  }
  if (!Number.isFinite(minPercentual) || !Number.isFinite(maxPercentual)) {
    return { ok: false as const, error: "Percentuais inválidos." };
  }
  if (
    minPercentual < 0 ||
    maxPercentual > 100 ||
    minPercentual > maxPercentual
  ) {
    return {
      ok: false as const,
      error: "Informe % mínimo e máximo válidos (0 a 100, mín ≤ máx).",
    };
  }
  if (
    !Number.isFinite(multiplicadorPeso) ||
    multiplicadorPeso < 0 ||
    multiplicadorPeso > 1
  ) {
    return {
      ok: false as const,
      error: "A parte paga deve estar entre 0% e 100%.",
    };
  }

  return {
    ok: true as const,
    id,
    minPercentual,
    maxPercentual,
    multiplicadorPeso,
    descricao,
  };
}

export async function salvarFaixaPagamento(
  dados: FaixaPagamentoInput,
): Promise<BonusActionResult> {
  try {
    const gestor = await getSessionGestor();
    if (!gestor?.isDiretoria) {
      return {
        ok: false,
        error: "Apenas a Diretoria pode alterar a régua de degraus.",
      };
    }

    const normalizado = normalizarFaixa(dados);
    if (!normalizado.ok) {
      return { ok: false, error: normalizado.error };
    }

    try {
      if (normalizado.id) {
        await prisma.faixaPagamento.update({
          where: { id: normalizado.id },
          data: {
            minPercentual: normalizado.minPercentual,
            maxPercentual: normalizado.maxPercentual,
            multiplicadorPeso: normalizado.multiplicadorPeso,
            descricao: normalizado.descricao,
          },
        });
      } else {
        await prisma.faixaPagamento.create({
          data: {
            minPercentual: normalizado.minPercentual,
            maxPercentual: normalizado.maxPercentual,
            multiplicadorPeso: normalizado.multiplicadorPeso,
            descricao: normalizado.descricao,
          },
        });
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Erro ao gravar faixa.",
      };
    }

    revalidarRotasRegua();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao salvar faixa.",
    };
  }
}

export async function salvarTodasFaixasPagamento(
  faixas: FaixaPagamentoInput[],
): Promise<BonusActionResult> {
  try {
    const gestor = await getSessionGestor();
    if (!gestor?.isDiretoria) {
      return {
        ok: false,
        error: "Apenas a Diretoria pode alterar a régua de degraus.",
      };
    }

    if (!Array.isArray(faixas) || faixas.length === 0) {
      return { ok: false, error: "Informe ao menos uma faixa para salvar." };
    }

    const normalizadas = [];
    for (const faixa of faixas) {
      const item = normalizarFaixa(faixa);
      if (!item.ok) {
        return { ok: false, error: item.error };
      }
      normalizadas.push(item);
    }

    try {
      for (const faixa of normalizadas) {
        if (faixa.id) {
          await prisma.faixaPagamento.update({
            where: { id: faixa.id },
            data: {
              minPercentual: faixa.minPercentual,
              maxPercentual: faixa.maxPercentual,
              multiplicadorPeso: faixa.multiplicadorPeso,
              descricao: faixa.descricao,
            },
          });
        } else {
          await prisma.faixaPagamento.create({
            data: {
              minPercentual: faixa.minPercentual,
              maxPercentual: faixa.maxPercentual,
              multiplicadorPeso: faixa.multiplicadorPeso,
              descricao: faixa.descricao,
            },
          });
        }
      }
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error ? err.message : "Erro ao gravar as faixas.",
      };
    }

    revalidarRotasRegua();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro ao salvar todas as faixas.",
    };
  }
}

export async function excluirFaixaPagamento(
  id: string,
): Promise<BonusActionResult> {
  try {
    const gestor = await getSessionGestor();
    if (!gestor?.isDiretoria) {
      return {
        ok: false,
        error: "Apenas a Diretoria pode alterar a régua de degraus.",
      };
    }

    const faixaId = id != null ? String(id).trim() : "";
    if (!faixaId) {
      return { ok: false, error: "ID da faixa é obrigatório." };
    }

    const total = await prisma.faixaPagamento.count();
    if (total <= 1) {
      return {
        ok: false,
        error: "Mantenha pelo menos 1 faixa na régua de degraus.",
      };
    }

    try {
      await prisma.faixaPagamento.delete({ where: { id: String(faixaId) } });
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Erro ao excluir faixa.",
      };
    }

    revalidarRotasRegua();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Erro ao excluir faixa.",
    };
  }
}
