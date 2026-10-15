/**
 * Apoio dos testes de integração: banco real (PostgreSQL), servidor sem abrir porta
 * (fastify.inject) e dados 100% sintéticos.
 *
 * Sem TEST_DATABASE_URL/DATABASE_URL os testes de API são pulados com aviso claro —
 * nunca fingem sucesso. O .bat sobe o banco antes de rodar, então eles rodam de verdade.
 */
import type { FastifyInstance } from "fastify";
import pg from "pg";
import type { Config } from "../src/config.ts";
import { aplicarMigracoes, criarPool } from "../src/db.ts";
import { construirServidor } from "../src/server.ts";

export const URL_TESTE = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

export function temBanco(): boolean {
  return URL_TESTE.length > 0;
}

export interface AmbienteTeste {
  pool: pg.Pool;
  app: FastifyInstance;
  encerrar(): Promise<void>;
}

export function configDeTeste(): Config {
  return {
    databaseUrl: URL_TESTE,
    porta: 0,
    host: "127.0.0.1",
    cookieSeguro: false,
    nomeCookieSessao: "lia_sessao",
    sessaoWebHoras: 24 * 14,
    tokenAcessoMinutos: 30,
    refreshTokenDias: 60,
    confiarProxy: false,
    producao: false,
  };
}

export async function prepararAmbiente(): Promise<AmbienteTeste> {
  const pool = criarPool(URL_TESTE);
  await aplicarMigracoes(pool);
  await limparBanco(pool);
  const app = await construirServidor({ pool, config: configDeTeste() });
  await app.ready();
  return {
    pool,
    app,
    async encerrar() {
      await app.close();
      await pool.end();
    },
  };
}

/** Banco de teste sempre começa vazio: dados sintéticos, nada de dados reais. */
export async function limparBanco(pool: pg.Pool): Promise<void> {
  await pool.query(
    `TRUNCATE idempotencia, auditoria, reserva_eventos, reservas, atividade_eventos, atividades,
              despesa_eventos, despesas_partes, despesas, movimentos,
              convites, membros_viagem, viagens, tentativas_login, refresh_tokens, sessoes, usuarios
     RESTART IDENTITY CASCADE`,
  );
}

export interface UsuarioTeste {
  id: string;
  email: string;
  senha: string;
  cookie?: string;
  tokens?: { acesso: string; refresh: string };
}

let contador = 0;

export function proximoEmail(prefixo = "pessoa"): string {
  contador += 1;
  return `${prefixo}${contador}.teste@exemplo.com`;
}

export async function registrarUsuario(
  app: FastifyInstance,
  dados: { nome?: string; email?: string; senha?: string } = {},
): Promise<{ usuario: UsuarioTeste; resposta: Awaited<ReturnType<FastifyInstance["inject"]>> }> {
  const email = dados.email ?? proximoEmail();
  const senha = dados.senha ?? "senha-forte-123";
  const resposta = await app.inject({
    method: "POST",
    url: "/auth/registro",
    payload: { nome: dados.nome ?? "Pessoa Teste", email, senha },
  });
  const cookie = resposta.cookies.find((item) => item.name === "lia_sessao")?.value;
  const corpo = resposta.json() as { usuario?: { id: string } };
  if (resposta.statusCode !== 201) {
    throw new Error(`Falha ao registrar em teste (${resposta.statusCode}): ${resposta.body}`);
  }
  return { usuario: { id: corpo.usuario?.id ?? "", email, senha, ...(cookie ? { cookie } : {}) }, resposta };
}

export function comSessao(usuario: UsuarioTeste): Record<string, string> {
  return usuario.cookie ? { cookie: `lia_sessao=${usuario.cookie}` } : {};
}

export async function criarViagem(
  app: FastifyInstance,
  usuario: UsuarioTeste,
  dados: Record<string, unknown> = {},
): Promise<string> {
  const resposta = await app.inject({
    method: "POST",
    url: "/viagens",
    headers: comSessao(usuario),
    payload: {
      nome: "Viagem de teste",
      destino: "São Paulo",
      dataInicio: "2026-12-20",
      dataFim: "2026-12-27",
      fusoHorario: "America/Sao_Paulo",
      moeda: "BRL",
      ...dados,
    },
  });
  const corpo = resposta.json() as { id: string };
  if (resposta.statusCode !== 201) throw new Error(`Falha ao criar viagem: ${resposta.body}`);
  return corpo.id;
}

/** Cria a pessoa, convida pelo e-mail dela e aceita o convite (fluxo real de entrada). */
export async function adicionarParticipante(
  app: FastifyInstance,
  organizador: UsuarioTeste,
  viagemId: string,
): Promise<UsuarioTeste> {
  const { usuario: participante } = await registrarUsuario(app, { nome: "Participante Teste" });
  const convite = await app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/convites`,
    headers: comSessao(organizador),
    payload: { email: participante.email },
  });
  if (convite.statusCode !== 201) throw new Error(`Falha ao criar convite: ${convite.body}`);
  const token = (convite.json() as { token: string }).token;
  const aceite = await app.inject({
    method: "POST",
    url: "/convites/aceitar",
    headers: comSessao(participante),
    payload: { token },
  });
  if (aceite.statusCode !== 200) throw new Error(`Falha ao aceitar convite: ${aceite.body}`);
  return participante;
}
