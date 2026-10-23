/**
 * Tokens de sessão e convite.
 * Só o HASH fica no banco: um vazamento de banco não permite reutilizar tokens.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";

export function novoId(): string {
  return randomUUID();
}

export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Hash estável para e-mail/origem em tabelas de tentativa (minimização de dados). */
export function hashDados(valor: string): string {
  return createHash("sha256").update(valor.trim().toLowerCase()).digest("hex");
}

export function agora(): Date {
  return new Date();
}

export function somarMinutos(data: Date, minutos: number): Date {
  return new Date(data.getTime() + minutos * 60_000);
}

export function somarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * 24 * 60 * 60_000);
}
