/**
 * Apoio de HTTP: autenticação da requisição, idempotência e tratamento de erros.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { ZodError } from "zod";
import { ErroHttp, entradaInvalida, limiteExcedido, naoAutenticado } from "./errors.ts";
import { hashToken, somarMinutos } from "./tokens.ts";

export interface UsuarioAutenticado {
  usuarioId: string;
  origem: "web" | "nativo" | "sessao";
  sessaoId: string;
}

export interface OpcoesHttp {
  pool: pg.Pool;
  nomeCookieSessao: string;
}

export function tokenDaRequisicao(request: FastifyRequest, nomeCookieSessao: string): string | undefined {
  const doCookie = request.cookies?.[nomeCookieSessao];
  if (doCookie) return doCookie;
  const cabecalho = request.headers.authorization;
  if (cabecalho?.startsWith("Bearer ")) {
    const token = cabecalho.slice(7).trim();
    if (token) return token;
  }
  const daAba = request.headers["x-lia-sessao"];
  if (typeof daAba === "string" && daAba.trim()) return daAba.trim();
  const daQuery = (request.query as Record<string, unknown> | undefined)?._sessao;
  if (typeof daQuery === "string" && daQuery.trim()) return daQuery.trim();
  return undefined;
}

export async function autenticar(request: FastifyRequest, opcoes: OpcoesHttp): Promise<UsuarioAutenticado | null> {
  const token = tokenDaRequisicao(request, opcoes.nomeCookieSessao);
  if (!token) return null;

  const { rows } = await opcoes.pool.query<{ id: string; usuario_id: string; origem: string; ultimo_uso_em: string | null }>(
    `SELECT id, usuario_id, origem, ultimo_uso_em::text
       FROM sessoes
      WHERE token_hash = $1 AND revogada_em IS NULL AND expira_em > now()`,
    [hashToken(token)],
  );
  const sessao = rows[0];
  if (!sessao) return null;

  // Atualiza o último uso sem escrever a cada requisição.
  const ultimo = sessao.ultimo_uso_em ? new Date(sessao.ultimo_uso_em).getTime() : 0;
  if (Date.now() - ultimo > 5 * 60_000) {
    await opcoes.pool.query("UPDATE sessoes SET ultimo_uso_em = now() WHERE id = $1", [sessao.id]);
  }
  return { usuarioId: sessao.usuario_id, origem: sessao.origem as UsuarioAutenticado["origem"], sessaoId: sessao.id };
}

export async function exigirAutenticacao(request: FastifyRequest, opcoes: OpcoesHttp): Promise<UsuarioAutenticado> {
  const usuario = await autenticar(request, opcoes);
  if (!usuario) throw naoAutenticado();
  return usuario;
}

/** Aceita string, número inteiro ou bigint em centavos e devolve sempre bigint. */
export function centavosDoCorpo(valor: unknown, campo: string): bigint {
  if (typeof valor === "bigint") return valor;
  if (typeof valor === "string" && /^-?\d+$/.test(valor.trim())) return BigInt(valor.trim());
  if (typeof valor === "number" && Number.isSafeInteger(valor)) return BigInt(valor);
  throw entradaInvalida(`O campo ${campo} deve estar em centavos inteiros (por exemplo "1250" para R$ 12,50).`);
}

export function sha256(valor: string): string {
  return hashToken(valor);
}

export interface OpcoesIdempotencia {
  chave: string | undefined;
  usuarioId: string;
  rota: string;
}

/**
 * Idempotência de escrita: a mesma chave nunca aplica a operação duas vezes.
 * Necessário para reenvios de rede e para a fila offline do app.
 */
export async function comIdempotencia<T>(
  pool: pg.Pool,
  opcoes: OpcoesIdempotencia,
  trabalho: () => Promise<T>,
): Promise<{ resultado: T; repetido: boolean }> {
  if (!opcoes.chave) return { resultado: await trabalho(), repetido: false };

  const existente = await pool.query<{ resposta: unknown; usuario_id: string; rota: string }>(
    "SELECT resposta, usuario_id, rota FROM idempotencia WHERE chave = $1",
    [opcoes.chave],
  );
  const anterior = existente.rows[0];
  if (anterior) {
    if (anterior.usuario_id !== opcoes.usuarioId || anterior.rota !== opcoes.rota) {
      throw new ErroHttp(409, "conflito", "Esta chave de idempotência já foi usada em outra operação.");
    }
    return { resultado: anterior.resposta as T, repetido: true };
  }

  const resultado = await trabalho();
  await pool.query(
    "INSERT INTO idempotencia (chave, usuario_id, rota, resposta) VALUES ($1, $2, $3, $4) ON CONFLICT (chave) DO NOTHING",
    [opcoes.chave, opcoes.usuarioId, opcoes.rota, JSON.stringify(resultado)],
  );
  return { resultado, repetido: false };
}

export function idempotencyKey(request: FastifyRequest): string | undefined {
  const cabecalho = request.headers["idempotency-key"];
  if (typeof cabecalho !== "string") return undefined;
  const chave = cabecalho.trim();
  if (!chave) return undefined;
  if (chave.length > 200) throw entradaInvalida("Chave de idempotência muito longa.");
  return chave;
}

/**
 * Limite de tentativas em duas camadas:
 *  - por conta (e-mail): protege a conta de força bruta;
 *  - por origem (IP): limite mais alto, para não bloquear todo mundo atrás do mesmo IP
 *    (rede compartilhada, NAT) por causa de um atacante só.
 */
export async function verificarLimiteDeTentativas(
  pool: pg.Pool,
  emailHash: string,
  origemHash: string,
  limites: { porConta?: number; porOrigem?: number } = {},
): Promise<void> {
  const porConta = limites.porConta ?? 10;
  const porOrigem = limites.porOrigem ?? 50;
  const { rows } = await pool.query<{ da_conta: string; da_origem: string }>(
    `SELECT
       count(*) FILTER (WHERE email_hash = $1)::text AS da_conta,
       count(*) FILTER (WHERE origem_hash = $2)::text AS da_origem
       FROM tentativas_login
      WHERE sucesso = false AND criado_em > now() - interval '15 minutes'`,
    [emailHash, origemHash],
  );
  const conta = Number(rows[0]?.da_conta ?? "0");
  const origem = Number(rows[0]?.da_origem ?? "0");
  if (conta >= porConta || origem >= porOrigem) {
    throw limiteExcedido("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
  }
}

export async function registrarTentativa(
  pool: pg.Pool,
  emailHash: string,
  origemHash: string,
  sucesso: boolean,
): Promise<void> {
  await pool.query("INSERT INTO tentativas_login (email_hash, origem_hash, sucesso) VALUES ($1, $2, $3)", [
    emailHash,
    origemHash,
    sucesso,
  ]);
  if (sucesso) {
    // Entrada bem-sucedida limpa o histórico de falhas daquela conta.
    await pool.query("DELETE FROM tentativas_login WHERE email_hash = $1 AND sucesso = false", [emailHash]);
  }
  // Higiene: tentativas antigas não são úteis e não devem acumular.
  await pool.query("DELETE FROM tentativas_login WHERE criado_em < now() - interval '30 days'");
}

export function expiracaoAcesso(minutos: number): Date {
  return somarMinutos(new Date(), minutos);
}

/** Erro de validação (zod) vira 400 com caminho do campo, sem ecoar valor sensível. */
export function tratarErroDeValidacao(erro: ZodError): ErroHttp {
  const primeiro = erro.issues[0];
  const caminho = primeiro?.path.join(".") || "corpo";
  return entradaInvalida(`Campo inválido: ${caminho}. ${primeiro?.message ?? ""}`.trim());
}

export function enviarErro(reply: FastifyReply, erro: unknown): FastifyReply {
  if (erro instanceof ErroHttp) {
    return reply.status(erro.status).send({
      erro: erro.codigo,
      mensagem: erro.message,
      detalhes: erro.detalhes,
    });
  }
  throw erro;
}
