"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireDiretoria } from "@/actions/auth";
import { prisma } from "@/lib/prisma";

export type GestorActionResult = {
  ok: boolean;
  error?: string;
};

export async function criarGestor(dados: {
  nome: string;
  email: string;
  senha: string;
  departamentoIds: string[];
  isDiretoria: boolean;
}): Promise<GestorActionResult> {
  await requireDiretoria();

  try {
    const nome = String(dados.nome ?? "").trim();
    const email = String(dados.email ?? "").trim().toLowerCase();
    const senha = String(dados.senha ?? "");
    const isDiretoria = Boolean(dados.isDiretoria);
    const departamentoIds = (dados.departamentoIds ?? [])
      .map((id) => String(id).trim())
      .filter(Boolean);

    if (!nome || !email || !senha) {
      return { ok: false, error: "Nome, e-mail e senha são obrigatórios." };
    }

    if (!isDiretoria && departamentoIds.length === 0) {
      return {
        ok: false,
        error: "Selecione pelo menos 1 departamento para o gestor.",
      };
    }

    const existente = await prisma.gestor.findUnique({ where: { email } });
    if (existente) {
      return { ok: false, error: "Já existe um gestor com este e-mail." };
    }

    await prisma.gestor.create({
      data: {
        nome,
        email,
        senha: bcrypt.hashSync(senha, 10),
        isDiretoria,
        departamentos: {
          connect: departamentoIds.map((id) => ({ id })),
        },
      },
    });

    revalidatePath("/gestores");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao cadastrar gestor." };
  }
}

export async function atualizarGestor(
  id: string,
  nome: string,
  email: string,
  senha: string,
  departamentoIds: string[],
  isDiretoria: boolean,
): Promise<GestorActionResult> {
  await requireDiretoria();

  try {
    const gestorId = String(id ?? "").trim();
    const nomeLimpo = String(nome ?? "").trim();
    const emailLimpo = String(email ?? "").trim().toLowerCase();
    const senhaLimpa = String(senha ?? "").trim();
    const depts = (departamentoIds ?? [])
      .map((deptId) => String(deptId).trim())
      .filter(Boolean);

    if (!gestorId || !nomeLimpo || !emailLimpo) {
      return { ok: false, error: "Nome e e-mail são obrigatórios." };
    }

    if (!isDiretoria && depts.length === 0) {
      return {
        ok: false,
        error: "Selecione pelo menos 1 departamento para o gestor.",
      };
    }

    const existente = await prisma.gestor.findFirst({
      where: { email: emailLimpo, NOT: { id: gestorId } },
    });
    if (existente) {
      return { ok: false, error: "Já existe um gestor com este e-mail." };
    }

    await prisma.gestor.update({
      where: { id: gestorId },
      data: {
        nome: nomeLimpo,
        email: emailLimpo,
        isDiretoria: Boolean(isDiretoria),
        ...(senhaLimpa ? { senha: bcrypt.hashSync(senhaLimpa, 10) } : {}),
        departamentos: {
          set: depts.map((deptId) => ({ id: deptId })),
        },
      },
    });

    revalidatePath("/gestores");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao atualizar gestor." };
  }
}

export async function redefinirSenhaGestor(
  id: string,
  novaSenha: string,
): Promise<GestorActionResult> {
  await requireDiretoria();

  try {
    const gestorId = String(id ?? "").trim();
    const senha = String(novaSenha ?? "").trim();

    if (!gestorId) {
      return { ok: false, error: "ID do gestor é obrigatório." };
    }
    if (!senha || senha.length < 4) {
      return {
        ok: false,
        error: "Informe uma senha temporária com pelo menos 4 caracteres.",
      };
    }

    const gestor = await prisma.gestor.findUnique({ where: { id: gestorId } });
    if (!gestor) {
      return { ok: false, error: "Gestor não encontrado." };
    }

    await prisma.gestor.update({
      where: { id: gestorId },
      data: { senha: bcrypt.hashSync(senha, 10) },
    });

    revalidatePath("/gestores");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao redefinir senha." };
  }
}

export async function excluirGestor(id: string): Promise<GestorActionResult> {
  await requireDiretoria();

  try {
    const gestorId = String(id ?? "").trim();
    if (!gestorId) {
      return { ok: false, error: "ID do gestor é obrigatório." };
    }

    const gestor = await prisma.gestor.findUnique({
      where: { id: gestorId },
      include: { _count: { select: { avaliacoes: true } } },
    });

    if (!gestor) {
      return { ok: false, error: "Gestor não encontrado." };
    }

    if (gestor._count.avaliacoes > 0) {
      return {
        ok: false,
        error:
          "Não é possível excluir: existem avaliações vinculadas a este gestor.",
      };
    }

    await prisma.gestor.delete({ where: { id: gestorId } });
    revalidatePath("/gestores");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao excluir gestor." };
  }
}
