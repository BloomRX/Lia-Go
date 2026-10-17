/**
 * Autenticação: e-mail + senha (scrypt), cookie HttpOnly na web e
 * access/refresh token no app nativo (decisão confirmada de sessão híbrida).
 */
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import type { Config } from "../config.ts";
import { emTransacao } from "../db.ts";
import { ErroHttp, entradaInvalida, naoAutenticado } from "../errors.ts";
import { exigirAutenticacao, registrarTentativa, tratarErroDeValidacao, verificarLimiteDeTentativas } from "../http.ts";
import { criarSenha, verificarSenha } from "../password.ts";
import { gerarToken, hashDados, hashToken, novoId, somarDias, somarMinutos } from "../tokens.ts";

const esquemaRegistro = z.object({
  nome: z.string().trim().min(2, "informe seu nome").max(120),
  email: z.email("informe um e-mail válido"),
  senha: z.string().min(10, "a senha precisa ter ao menos 10 caracteres"),
});

const esquemaLogin = z.object({
  email: z.email("informe um e-mail válido"),
  senha: z.string().min(1),
  cliente: z.enum(["web", "nativo"]).default("web"),
  dispositivo: z.string().max(120).optional(),
});

const esquemaRenovar = z.object({ refreshToken: z.string().min(20) });

function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface UsuarioPublico {
  id: string;
  nome: string;
  email: string;
}

export function rotasAuth(app: FastifyInstance, deps: { pool: pg.Pool; config: Config }): void {
  const { pool, config } = deps;

  app.post("/auth/registro", async (request, reply) => {
    let corpo: z.infer<typeof esquemaRegistro>;
    try {
      corpo = esquemaRegistro.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }
    const emailNormalizado = normalizarEmail(corpo.email);
    const origemHash = hashDados(request.ip ?? "desconhecido");
    await verificarLimiteDeTentativas(pool, hashDados(emailNormalizado), origemHash, { porConta: 20, porOrigem: 80 });

    const senha = await criarSenha(corpo.senha);
    const usuarioId = novoId();
    try {
      await pool.query(
        `INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [usuarioId, corpo.nome.trim(), corpo.email.trim(), emailNormalizado, senha.hash, senha.salt, senha.algoritmo],
      );
    } catch (erro) {
      const codigo = (erro as { code?: string }).code;
      if (codigo === "23505") {
        throw new ErroHttp(409, "email_em_uso", "Já existe uma conta com este e-mail. Entre ou peça recuperação de acesso.");
      }
      throw erro;
    }

    await registrarTentativa(pool, hashDados(emailNormalizado), origemHash, true);
    const sessao = await abrirSessao(pool, config, usuarioId, "web", request.ip);
    reply.setCookie(config.nomeCookieSessao, sessao.token, opcoesCookie(config, config.sessaoWebHoras * 3600));
    return reply.status(201).send({
      usuario: { id: usuarioId, nome: corpo.nome.trim(), email: corpo.email.trim() },
      mensagem: "Conta criada. Você já está conectado.",
    });
  });

  app.post("/auth/login", async (request, reply) => {
    let corpo: z.infer<typeof esquemaLogin>;
    try {
      corpo = esquemaLogin.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }
    const emailNormalizado = normalizarEmail(corpo.email);
    const emailHash = hashDados(emailNormalizado);
    const origemHash = hashDados(request.ip ?? "desconhecido");
    await verificarLimiteDeTentativas(pool, emailHash, origemHash);

    const { rows } = await pool.query<{
      id: string;
      nome: string;
      email: string;
      senha_hash: string;
      senha_salt: string;
      senha_algoritmo: string;
    }>(
      "SELECT id, nome, email, senha_hash, senha_salt, senha_algoritmo FROM usuarios WHERE email_normalizado = $1",
      [emailNormalizado],
    );
    const usuario = rows[0];
    const valida = usuario
      ? await verificarSenha(corpo.senha, {
          hash: usuario.senha_hash,
          salt: usuario.senha_salt,
          algoritmo: usuario.senha_algoritmo,
        })
      : false;

    if (!usuario || !valida) {
      await registrarTentativa(pool, emailHash, origemHash, false);
      // Mensagem única para não revelar se o e-mail existe.
      throw new ErroHttp(401, "credenciais_invalidas", "E-mail ou senha incorretos.");
    }

    await registrarTentativa(pool, emailHash, origemHash, true);
    const publico: UsuarioPublico = { id: usuario.id, nome: usuario.nome, email: usuario.email };

    if (corpo.cliente === "nativo") {
      const sessao = await abrirSessao(pool, config, usuario.id, "nativo", corpo.dispositivo ?? null);
      const refresh = await abrirRefresh(pool, config, usuario.id);
      return reply.status(200).send({
        usuario: publico,
        acesso: { token: sessao.token, expiraEm: sessao.expiraEm.toISOString() },
        refresh: { token: refresh.token, expiraEm: refresh.expiraEm.toISOString() },
        aviso: "Guarde o refresh token em armazenamento seguro do aparelho; ele nunca deve ir para a web.",
      });
    }

    const sessao = await abrirSessao(pool, config, usuario.id, "web", request.ip);
    reply.setCookie(config.nomeCookieSessao, sessao.token, opcoesCookie(config, config.sessaoWebHoras * 3600));
    return reply.status(200).send({ usuario: publico });
  });

  app.get("/auth/sessao", async (request) => {
    const autenticado = await exigirAutenticacao(request, { pool, nomeCookieSessao: config.nomeCookieSessao });
    const { rows } = await pool.query<UsuarioPublico>(
      "SELECT id, nome, email FROM usuarios WHERE id = $1",
      [autenticado.usuarioId],
    );
    const usuario = rows[0];
    if (!usuario) throw naoAutenticado();
    return { usuario, origem: autenticado.origem };
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies?.[config.nomeCookieSessao];
    const cabecalho = request.headers.authorization;
    const tokenAcesso = token ?? (cabecalho?.startsWith("Bearer ") ? cabecalho.slice(7).trim() : undefined);
    if (tokenAcesso) {
      await pool.query("UPDATE sessoes SET revogada_em = now() WHERE token_hash = $1 AND revogada_em IS NULL", [
        hashToken(tokenAcesso),
      ]);
    }
    reply.clearCookie(config.nomeCookieSessao, { path: "/" });
    return reply.status(204).send();
  });

  app.post("/auth/token/renovar", async (request, reply) => {
    const corpo = esquemaRenovar.parse(request.body);
    const hash = hashToken(corpo.refreshToken);
    return emTransacao(pool, async (cliente) => {
      const { rows } = await cliente.query<{ id: string; usuario_id: string; expira_em: string }>(
        `SELECT id, usuario_id, expira_em::text FROM refresh_tokens
          WHERE token_hash = $1 AND revogado_em IS NULL AND expira_em > now() FOR UPDATE`,
        [hash],
      );
      const refresh = rows[0];
      if (!refresh) throw new ErroHttp(401, "refresh_invalido", "Sessão expirada. Entre novamente.");
      const novoRefresh = await abrirRefresh(cliente, config, refresh.usuario_id);
      await cliente.query("UPDATE refresh_tokens SET revogado_em = now(), substituido_por = $2 WHERE id = $1", [
        refresh.id,
        novoRefresh.id,
      ]);
      const sessao = await abrirSessao(cliente, config, refresh.usuario_id, "nativo", null);
      return reply.status(200).send({
        acesso: { token: sessao.token, expiraEm: sessao.expiraEm.toISOString() },
        refresh: { token: novoRefresh.token, expiraEm: novoRefresh.expiraEm.toISOString() },
      });
    });
  });

  app.post("/auth/sessoes/revogar", async (request, reply) => {
    const autenticado = await exigirAutenticacao(request, { pool, nomeCookieSessao: config.nomeCookieSessao });
    await emTransacao(pool, async (cliente) => {
      await cliente.query("UPDATE sessoes SET revogada_em = now() WHERE usuario_id = $1 AND revogada_em IS NULL", [
        autenticado.usuarioId,
      ]);
      await cliente.query("UPDATE refresh_tokens SET revogado_em = now() WHERE usuario_id = $1 AND revogado_em IS NULL", [
        autenticado.usuarioId,
      ]);
    });
    reply.clearCookie(config.nomeCookieSessao, { path: "/" });
    return reply.status(204).send();
  });

  // Sem chave de idempotência no registro de propósito: o e-mail único já impede conta duplicada.
  // Um reenvio de rede recebe 409 "e-mail em uso" e o app entra normalmente com as mesmas credenciais.
}

function opcoesCookie(config: Config, maxAgeSegundos: number) {
  return {
    httpOnly: true,
    // `none` só é aceito pelo navegador junto de `Secure`; a config garante essa combinação.
    sameSite: config.cookieSameSite,
    secure: config.cookieSeguro,
    path: "/",
    maxAge: maxAgeSegundos,
  };
}

async function abrirSessao(
  executor: pg.Pool | pg.PoolClient,
  config: Config,
  usuarioId: string,
  origem: "web" | "nativo",
  dispositivo: string | null,
): Promise<{ id: string; token: string; expiraEm: Date }> {
  const token = gerarToken();
  const expiraEm = somarMinutos(new Date(), config.tokenAcessoMinutos);
  // Sessão web dura a janela longa de sessão; token nativo é curto (renovado pelo refresh).
  const validade = origem === "web" ? somarMinutos(new Date(), config.sessaoWebHoras * 60) : expiraEm;
  const id = novoId();
  await executor.query(
    `INSERT INTO sessoes (id, usuario_id, token_hash, expira_em, origem, dispositivo)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, usuarioId, hashToken(token), validade, origem, dispositivo],
  );
  return { id, token, expiraEm: validade };
}

async function abrirRefresh(
  executor: pg.Pool | pg.PoolClient,
  config: Config,
  usuarioId: string,
): Promise<{ id: string; token: string; expiraEm: Date }> {
  const token = gerarToken() + gerarToken();
  const expiraEm = somarDias(new Date(), config.refreshTokenDias);
  const id = novoId();
  await executor.query("INSERT INTO refresh_tokens (id, usuario_id, token_hash, expira_em) VALUES ($1, $2, $3, $4)", [
    id,
    usuarioId,
    hashToken(token),
    expiraEm,
  ]);
  return { id, token, expiraEm };
}
