"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  signSessionToken,
  verifySessionToken,
} from "@/lib/session";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "admin@redepetro.com.br";
const ADMIN_SENHA = "admin";
const ADMIN_NOME = "Administrador Redepetro";
const ADMIN_DEPARTAMENTO = "Diretoria / Administração";

export type AuthState = {
  ok: false;
  error: string;
} | null;

export type SessionGestor = {
  id: string;
  nome: string;
  email: string;
  isDiretoria: boolean;
  departamentos: { id: string; nome: string }[];
  departamentoIds: string[];
};

export type AlterarSenhaState = {
  ok: boolean;
  error?: string;
  message?: string;
} | null;

export async function ensureDefaultAdmin() {
  const total = await prisma.gestor.count();
  if (total > 0) return;

  let departamento = await prisma.departamento.findFirst({
    where: { nome: ADMIN_DEPARTAMENTO },
  });

  if (!departamento) {
    departamento = await prisma.departamento.create({
      data: { nome: ADMIN_DEPARTAMENTO },
    });
  }

  await prisma.gestor.create({
    data: {
      nome: ADMIN_NOME,
      email: ADMIN_EMAIL,
      senha: bcrypt.hashSync(ADMIN_SENHA, 10),
      isDiretoria: true,
      departamentos: {
        connect: [{ id: departamento.id }],
      },
    },
  });
}

export async function getSessionGestor(): Promise<SessionGestor | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sessionId = verifySessionToken(token);

  if (!sessionId) {
    return null;
  }

  const gestor = await prisma.gestor.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      nome: true,
      email: true,
      isDiretoria: true,
      departamentos: {
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      },
    },
  });

  if (!gestor) {
    return null;
  }

  return {
    ...gestor,
    departamentoIds: gestor.departamentos.map((item) => item.id),
  };
}

export async function requireDiretoria() {
  const gestor = await getSessionGestor();

  if (!gestor?.isDiretoria) {
    redirect("/avaliar");
  }

  return gestor;
}

export async function login(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  await ensureDefaultAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    return { ok: false, error: "Informe e-mail e senha." };
  }

  const gestor = await prisma.gestor.findUnique({
    where: { email },
  });

  if (!gestor) {
    return { ok: false, error: "Credenciais inválidas." };
  }

  const senhaValida = await bcrypt.compare(senha, gestor.senha);

  if (!senhaValida) {
    return { ok: false, error: "Credenciais inválidas." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, signSessionToken(gestor.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function alterarPropriaSenha(
  _prevState: AlterarSenhaState,
  formData: FormData,
): Promise<AlterarSenhaState> {
  const gestor = await getSessionGestor();
  if (!gestor) {
    redirect("/login");
  }

  const senhaAtual = String(formData.get("senhaAtual") ?? "");
  const novaSenha = String(formData.get("novaSenha") ?? "");
  const confirmarSenha = String(formData.get("confirmarSenha") ?? "");

  if (!senhaAtual || !novaSenha || !confirmarSenha) {
    return { ok: false, error: "Preencha todos os campos." };
  }

  if (novaSenha !== confirmarSenha) {
    return { ok: false, error: "A nova senha e a confirmação não coincidem." };
  }

  if (novaSenha.length < 4) {
    return { ok: false, error: "A nova senha deve ter pelo menos 4 caracteres." };
  }

  try {
    const registro = await prisma.gestor.findUnique({
      where: { id: gestor.id },
      select: { senha: true },
    });

    if (!registro || !bcrypt.compareSync(senhaAtual, registro.senha)) {
      return { ok: false, error: "Senha atual incorreta." };
    }

    await prisma.gestor.update({
      where: { id: gestor.id },
      data: { senha: bcrypt.hashSync(novaSenha, 10) },
    });
  } catch {
    return { ok: false, error: "Erro ao atualizar senha" };
  }

  return { ok: true, message: "Senha alterada com sucesso." };
}

export async function criarGestorInicial() {
  try {
    const existente = await prisma.gestor.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (existente) {
      return {
        ok: false as const,
        error: "Gestor inicial já existe.",
      };
    }

    await ensureDefaultAdmin();

    const criado = await prisma.gestor.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (!criado) {
      return {
        ok: false as const,
        error: "Não foi possível criar o administrador padrão.",
      };
    }

    return {
      ok: true as const,
      email: ADMIN_EMAIL,
      senha: ADMIN_SENHA,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao criar gestor inicial.";
    return { ok: false as const, error: message };
  }
}
