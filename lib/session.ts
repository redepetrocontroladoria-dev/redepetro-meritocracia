import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "gestor_session";

/** Validade máxima do token assinado (expediente), em segundos. */
export const SESSION_TOKEN_TTL_SECONDS = 12 * 60 * 60;

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET é obrigatório em produção.");
  }
  return "dev-insecure-auth-secret-change-me";
}

function assinarPayload(payload: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(payload)
    .digest("base64url");
}

export function signSessionToken(gestorId: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TOKEN_TTL_SECONDS;
  const payload = `${gestorId}.${exp}`;
  const sig = assinarPayload(payload);
  return `${payload}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined | null,
): string | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  // Formato atual: gestorId.exp.sig
  // Formato legado (sem exp): gestorId.sig — rejeitado após o ajuste de segurança.
  if (parts.length === 2) {
    return null;
  }

  const sig = parts[parts.length - 1] ?? "";
  const payload = parts.slice(0, -1).join(".");
  const expRaw = parts[parts.length - 2] ?? "";
  const gestorId = parts.slice(0, -2).join(".");

  if (!gestorId || !sig || !expRaw) return null;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= 0) return null;
  if (Math.floor(Date.now() / 1000) > exp) return null;

  try {
    const expected = assinarPayload(payload);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }
    return gestorId;
  } catch {
    return null;
  }
}
