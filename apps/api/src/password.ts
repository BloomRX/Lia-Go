/**
 * Senhas com scrypt (node:crypto). Parâmetros versionados no banco para permitir
 * endurecer depois sem invalidar contas existentes.
 * Nenhuma senha, hash ou token é registrado em log.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

/**
 * `promisify` só enxerga a sobrecarga de 3 argumentos de `crypto.scrypt`, mas usamos
 * a sobrecarga com custo (N, r, p). O tipo abaixo diz a verdade sem `any`.
 */
const scrypt = promisify(scryptCb) as (
  senha: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  opcoes?: ScryptOptions,
) => Promise<Buffer>;

export interface ParametrosScrypt {
  N: number;
  r: number;
  p: number;
  keylen: number;
}

export const PARAMETROS_PADRAO: ParametrosScrypt = { N: 2 ** 15, r: 8, p: 1, keylen: 64 };
const TAMANHO_SALT = 16;

export interface SenhaArmazenada {
  hash: string;
  salt: string;
  algoritmo: string;
}

function descreverParametros(parametros: ParametrosScrypt): string {
  return `scrypt-v1:${parametros.N}:${parametros.r}:${parametros.p}:${parametros.keylen}`;
}

export async function derivarSenha(
  senha: string,
  salt: string,
  parametros: ParametrosScrypt = PARAMETROS_PADRAO,
): Promise<Buffer> {
  return (await scrypt(senha.normalize("NFKC"), salt, parametros.keylen, {
    N: parametros.N,
    r: parametros.r,
    p: parametros.p,
    maxmem: 256 * 1024 * 1024,
  })) as Buffer;
}

export async function criarSenha(senha: string, parametros: ParametrosScrypt = PARAMETROS_PADRAO): Promise<SenhaArmazenada> {
  validarForcaMinima(senha);
  const salt = randomBytes(TAMANHO_SALT).toString("base64");
  const hash = (await derivarSenha(senha, salt, parametros)).toString("base64");
  return { hash, salt, algoritmo: descreverParametros(parametros) };
}

export async function verificarSenha(senha: string, armazenada: SenhaArmazenada): Promise<boolean> {
  const partes = armazenada.algoritmo.split(":");
  if (partes[0] !== "scrypt-v1" || partes.length !== 5) return false;
  const parametros: ParametrosScrypt = {
    N: Number(partes[1]),
    r: Number(partes[2]),
    p: Number(partes[3]),
    keylen: Number(partes[4]),
  };
  try {
    const calculado = await derivarSenha(senha, armazenada.salt, parametros);
    const esperado = Buffer.from(armazenada.hash, "base64");
    if (calculado.length !== esperado.length) return false;
    return timingSafeEqual(calculado, esperado);
  } catch {
    return false;
  }
}

export function validarForcaMinima(senha: string): void {
  if (typeof senha !== "string" || senha.length < 10) {
    throw new Error("A senha precisa ter ao menos 10 caracteres.");
  }
  if (/^\d+$/.test(senha)) {
    throw new Error("A senha não pode ser apenas números.");
  }
}
