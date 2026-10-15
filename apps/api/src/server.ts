/**
 * Servidor HTTP do Lia Go.
 * `construirServidor` é usado pelos testes (sem abrir porta) e pelo main.ts.
 */
import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { ErroDeDominio } from "@lia-go/domain";
import type pg from "pg";
import { ZodError } from "zod";
import type { Config } from "./config.ts";
import { ErroHttp, mensagemSeguraDeErro } from "./errors.ts";
import { rotasAuth } from "./routes/auth.ts";
import { rotasDespesas } from "./routes/despesas.ts";
import { rotasRoteiro } from "./routes/roteiro.ts";
import { rotasSincronizacao } from "./routes/sincronizacao.ts";
import { rotasViagens } from "./routes/viagens.ts";

export interface Dependencias {
  pool: pg.Pool;
  config: Config;
}

export async function construirServidor(deps: Dependencias): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.config.producao
      ? {
          level: "info",
          // Nunca registrar cookie, token ou dado financeiro.
          redact: ["req.headers.cookie", "req.headers.authorization", "res.headers['set-cookie']"],
        }
      : false,
    trustProxy: deps.config.confiarProxy,
    bodyLimit: 256 * 1024,
  });

  await app.register(cookie);

  app.setErrorHandler((erro, _request, reply) => {
    if (erro instanceof ZodError) {
      return reply.status(400).send({ erro: "entrada_invalida", mensagem: "Dados inválidos na requisição." });
    }
    // Regra de negócio violada é erro de quem pediu (400), com a mensagem do domínio.
    if (erro instanceof ErroDeDominio) {
      return reply.status(400).send({ erro: "regra_violada", mensagem: erro.message });
    }
    const status = erro instanceof ErroHttp ? erro.status : statusDoErro(erro);
    const codigo = erro instanceof ErroHttp ? erro.codigo : status === 500 ? "erro_interno" : "requisicao_invalida";
    const detalhes = erro instanceof ErroHttp ? erro.detalhes : undefined;
    if (status >= 500) {
      // Log sem dados sensíveis: só o tipo e a mensagem técnica.
      app.log.error({ tipo: nomeDoErro(erro), mensagem: mensagemTecnica(erro) }, "Falha inesperada na API");
    }
    return reply.status(status).send({
      erro: codigo,
      mensagem: status >= 500 ? "Não foi possível concluir a operação agora." : mensagemSeguraDeErro(erro),
      ...(detalhes === undefined ? {} : { detalhes }),
    });
  });

  app.get("/saude", async () => {
    const { rows } = await deps.pool.query<{ ok: number }>("SELECT 1 AS ok");
    return { ok: rows[0]?.ok === 1, servico: "lia-go-api", versao: "0.1.0" };
  });

  rotasAuth(app, deps);
  rotasViagens(app, deps);
  rotasDespesas(app, deps);
  rotasRoteiro(app, deps);
  rotasSincronizacao(app, deps);

  return app;
}

/**
 * O erro que chega ao handler é `unknown`: qualquer coisa pode ter sido lançada.
 * Estes leitores nunca confiam no formato e nunca devolvem dado sensível.
 */
function statusDoErro(erro: unknown): number {
  if (typeof erro === "object" && erro !== null) {
    const bruto = (erro as { statusCode?: unknown }).statusCode;
    if (typeof bruto === "number" && Number.isInteger(bruto) && bruto >= 100 && bruto <= 599) return bruto;
  }
  return 500;
}

function nomeDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.name : typeof erro;
}

function mensagemTecnica(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  return typeof erro === "string" ? erro : "Erro sem mensagem";
}
