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

    const id = dados.id != null ? String(dados.id).trim() : "";
    const minPercentual = parseNumero(dados.minPercentual);
    const maxPercentual = parseNumero(dados.maxPercentual);
    let multiplicadorPeso = parseNumero(dados.multiplicadorPeso);
    const descricao = String(dados.descricao ?? "").trim();

    // Aceita tanto 0–1 quanto 0–100 (parte paga em %)
    if (
      Number.isFinite(multiplicadorPeso) &&
      multiplicadorPeso > 1 &&
      multiplicadorPeso <= 100
    ) {
      multiplicadorPeso = multiplicadorPeso / 100;
    }

    if (!descricao) {
      return { ok: false, error: "Informe a descrição da faixa." };
    }
    if (!Number.isFinite(minPercentual) || !Number.isFinite(maxPercentual)) {
      return { ok: false, error: "Percentuais inválidos." };
    }
    if (
      minPercentual < 0 ||
      maxPercentual > 100 ||
      minPercentual > maxPercentual
    ) {
      return {
        ok: false,
        error: "Informe % mínimo e máximo válidos (0 a 100, mín ≤ máx).",
      };
    }
    if (
      !Number.isFinite(multiplicadorPeso) ||
      multiplicadorPeso < 0 ||
      multiplicadorPeso > 1
    ) {
      return {
        ok: false,
        error: "A parte paga deve estar entre 0% e 100%.",
      };
    }

    try {
      if (id) {
        await prisma.faixaPagamento.update({
          where: { id: String(id) },
          data: {
            minPercentual,
            maxPercentual,
            multiplicadorPeso,
            descricao,
          },
        });
      } else {
        await prisma.faixaPagamento.create({
          data: {
            minPercentual,
            maxPercentual,
            multiplicadorPeso,
            descricao,
          },
        });
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Erro ao gravar faixa.",
      };
    }

    revalidatePath("/bonus");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro ao salvar faixa.",
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

    revalidatePath("/bonus");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Erro ao excluir faixa.",
    };
  }
}
