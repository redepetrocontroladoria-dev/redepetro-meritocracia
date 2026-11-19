import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "gestor_session";

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET é obrigatório em produção.");
  }
  return "dev-insecure-auth-secret-change-me";
}

export function signSessionToken(gestorId: string): string {
  const sig = createHmac("sha256", getAuthSecret())
    .update(gestorId)
    .digest("base64url");
  return `${gestorId}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const sep = token.lastIndexOf(".");
  if (sep <= 0) return null;

  const gestorId = token.slice(0, sep);
  const sig = token.slice(sep + 1);
  if (!gestorId || !sig) return null;

  try {
    const expected = createHmac("sha256", getAuthSecret())
      .update(gestorId)
      .digest("base64url");
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
