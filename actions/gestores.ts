"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireDiretoria } from "@/actions/auth";
import { prisma } from "@/lib/prisma";

function lerDepartamentoIds(formData: FormData) {
  return formData
    .getAll("departamentoIds")
    .map((item) => String(item).trim())
    .filter(Boolean);
}

export async function criarGestor(formData: FormData) {
  await requireDiretoria();

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const isDiretoria = formData.get("isDiretoria") === "on";
  const departamentoIds = lerDepartamentoIds(formData);

  if (!nome || !email || !senha) {
    throw new Error("Nome, e-mail e senha são obrigatórios.");
  }

  if (!isDiretoria && departamentoIds.length === 0) {
    throw new Error("Selecione pelo menos 1 departamento para o gestor.");
  }

  const existente = await prisma.gestor.findUnique({ where: { email } });
  if (existente) throw new Error("Já existe um gestor com este e-mail.");

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
}

export async function atualizarGestor(
  id: string,
  dados: {
    nome: string;
    email: string;
    senha?: string;
    departamentoIds: string[];
    isDiretoria: boolean;
  },
) {
  await requireDiretoria();

  const gestorId = id?.trim();
  const nome = dados.nome?.trim() ?? "";
  const email = dados.email?.trim().toLowerCase() ?? "";
  const senha = dados.senha?.trim() ?? "";
  const departamentoIds = dados.departamentoIds ?? [];

  if (!gestorId || !nome || !email) {
    throw new Error("Nome e e-mail são obrigatórios.");
  }

  if (!dados.isDiretoria && departamentoIds.length === 0) {
    throw new Error("Selecione pelo menos 1 departamento para o gestor.");
  }

  const existente = await prisma.gestor.findFirst({
    where: { email, NOT: { id: gestorId } },
  });
  if (existente) throw new Error("Já existe um gestor com este e-mail.");

  await prisma.gestor.update({
    where: { id: gestorId },
    data: {
      nome,
      email,
      isDiretoria: dados.isDiretoria,
      ...(senha ? { senha: bcrypt.hashSync(senha, 10) } : {}),
      departamentos: {
        set: departamentoIds.map((deptId) => ({ id: deptId })),
      },
    },
  });

  revalidatePath("/gestores");
}

export async function redefinirSenhaGestor(id: string, novaSenha: string) {
  await requireDiretoria();

  const gestorId = id?.trim();
  const senha = novaSenha?.trim() ?? "";

  if (!gestorId) throw new Error("ID do gestor é obrigatório.");
  if (!senha || senha.length < 4) {
    throw new Error("Informe uma senha temporária com pelo menos 4 caracteres.");
  }

  const gestor = await prisma.gestor.findUnique({ where: { id: gestorId } });
  if (!gestor) throw new Error("Gestor não encontrado.");

  await prisma.gestor.update({
    where: { id: gestorId },
    data: { senha: bcrypt.hashSync(senha, 10) },
  });

  revalidatePath("/gestores");
}

export async function excluirGestor(id: string) {
  await requireDiretoria();

  const gestorId = id?.trim();
  if (!gestorId) throw new Error("ID do gestor é obrigatório.");

  const gestor = await prisma.gestor.findUnique({
    where: { id: gestorId },
    include: { _count: { select: { avaliacoes: true } } },
  });

  if (!gestor) throw new Error("Gestor não encontrado.");

  if (gestor._count.avaliacoes > 0) {
    throw new Error(
      "Não é possível excluir: existem avaliações vinculadas a este gestor.",
    );
  }

  await prisma.gestor.delete({ where: { id: gestorId } });
  revalidatePath("/gestores");
}
