"use server";

import { revalidatePath } from "next/cache";
import { getSessionGestor } from "@/actions/auth";
import { prisma } from "@/lib/prisma";

export type ImportarColaboradorItem = {
  nome: string;
  departamentoId: string;
  cargo: string;
  valorAlvo?: number;
};

export type ImportarColaboradoresResult = {
  ok: boolean;
  criados?: number;
  atualizados?: number;
  error?: string;
};

function revalidarRotasColaboradores() {
  revalidatePath("/colaboradores");
  revalidatePath("/avaliar");
  revalidatePath("/bonus");
  revalidatePath("/relatorios");
  revalidatePath("/");
}

export async function importarColaboradoresLote(
  itens: ImportarColaboradorItem[],
): Promise<ImportarColaboradoresResult> {
  try {
    const gestor = await getSessionGestor();
    if (!gestor) {
      return { ok: false, error: "Sessão expirada. Faça login novamente." };
    }

    if (!Array.isArray(itens) || itens.length === 0) {
      return { ok: false, error: "Nenhum colaborador válido para importar." };
    }

    const departamentosPermitidos = new Set(
      gestor.isDiretoria
        ? (
            await prisma.departamento.findMany({ select: { id: true } })
          ).map((d) => d.id)
        : gestor.departamentoIds ?? [],
    );

    let criados = 0;
    let atualizados = 0;

    for (const bruto of itens) {
      const nome = String(bruto.nome ?? "").trim();
      const cargo = String(bruto.cargo ?? "").trim();
      const departamentoId = String(bruto.departamentoId ?? "").trim();
      const valorInformado = bruto.valorAlvo;
      const valorAlvo =
        valorInformado == null || String(valorInformado).trim() === ""
          ? null
          : Number(valorInformado);

      if (!nome || !cargo || !departamentoId) {
        return {
          ok: false,
          error: "Há linhas inválidas (nome, cargo ou departamento ausente).",
        };
      }

      if (!departamentosPermitidos.has(departamentoId)) {
        return {
          ok: false,
          error:
            "Você só pode importar colaboradores para os seus departamentos vinculados.",
        };
      }

      if (valorAlvo != null && (!Number.isFinite(valorAlvo) || valorAlvo < 0)) {
        return {
          ok: false,
          error: `Valor-alvo inválido para "${nome}".`,
        };
      }

      const existente = await prisma.colaborador.findFirst({
        where: {
          departamentoId,
          nome: { equals: nome, mode: "insensitive" },
        },
      });

      if (existente) {
        await prisma.colaborador.update({
          where: { id: existente.id },
          data: {
            cargo,
            ...(valorAlvo != null ? { valorAlvo } : {}),
          },
        });
        atualizados += 1;
      } else {
        await prisma.colaborador.create({
          data: {
            nome,
            cargo,
            departamentoId,
            valorAlvo: valorAlvo ?? 0,
          },
        });
        criados += 1;
      }
    }

    revalidarRotasColaboradores();
    return { ok: true, criados, atualizados };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro ao importar colaboradores.",
    };
  }
}
