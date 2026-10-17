import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { temBanco, prepararAmbiente, configDeTeste, type AmbienteTeste, proximoEmail, registrarUsuario } from "./helpers.ts";
import { carregarConfig } from "../src/config.ts";
import { construirServidor } from "../src/server.ts";

const disponivel = temBanco();
let ambiente: AmbienteTeste;

before(async () => {
  if (disponivel) ambiente = await prepararAmbiente();
});
after(async () => {
  if (ambiente) await ambiente.encerrar();
});

test("registro cria conta, valida senha e não deixa e-mail duplicado", { skip: !disponivel && "sem banco de teste (rode npm run db:up)" }, async () => {
  const email = proximoEmail();
  const curta = await ambiente.app.inject({
    method: "POST",
    url: "/auth/registro",
    payload: { nome: "Ana", email, senha: "curta" },
  });
  assert.equal(curta.statusCode, 400);
  assert.match(curta.body, /10 caracteres|senha/i);

  const { usuario, resposta } = await registrarUsuario(ambiente.app, { nome: "Ana Teste", email });
  assert.equal(resposta.statusCode, 201);
  assert.ok(usuario.id);
  const cookie = resposta.cookies.find((item) => item.name === "lia_sessao");
  assert.equal(cookie?.httpOnly, true);
  assert.equal(cookie?.sameSite, "Lax");
  assert.ok(!resposta.body.includes("senha"), "resposta não devolve hash de senha");

  const duplicado = await ambiente.app.inject({
    method: "POST",
    url: "/auth/registro",
    payload: { nome: "Outra", email, senha: "outra-senha-forte" },
  });
  assert.equal(duplicado.statusCode, 409);
});

test("login responde igual para senha errada e e-mail inexistente", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario } = await registrarUsuario(ambiente.app);
  const senhaErrada = await ambiente.app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: usuario.email, senha: "senha-errada-123", cliente: "web" },
  });
  const inexistente = await ambiente.app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: proximoEmail("fantasma"), senha: "senha-errada-123", cliente: "web" },
  });
  assert.equal(senhaErrada.statusCode, 401);
  assert.equal(inexistente.statusCode, 401);
  assert.equal(senhaErrada.json().mensagem, inexistente.json().mensagem);
});

test("limite de tentativas bloqueia força bruta com 429", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario } = await registrarUsuario(ambiente.app);
  let ultimoStatus = 0;
  for (let tentativa = 0; tentativa < 12; tentativa += 1) {
    const resposta = await ambiente.app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: usuario.email, senha: "errada-de-novo-1", cliente: "web" },
    });
    ultimoStatus = resposta.statusCode;
    if (ultimoStatus === 429) break;
  }
  assert.equal(ultimoStatus, 429, "após várias falhas o servidor limita as tentativas");
});

test("sessão web funciona por cookie e é encerrada no logout", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario } = await registrarUsuario(ambiente.app);
  const sessao = await ambiente.app.inject({
    method: "GET",
    url: "/auth/sessao",
    headers: usuario.cookie ? { cookie: `lia_sessao=${usuario.cookie}` } : {},
  });
  assert.equal(sessao.statusCode, 200);
  assert.equal(sessao.json().usuario.email, usuario.email);

  const semCookie = await ambiente.app.inject({ method: "GET", url: "/auth/sessao" });
  assert.equal(semCookie.statusCode, 401);

  const logout = await ambiente.app.inject({
    method: "POST",
    url: "/auth/logout",
    headers: { cookie: `lia_sessao=${usuario.cookie}` },
  });
  assert.equal(logout.statusCode, 204);
  const depois = await ambiente.app.inject({
    method: "GET",
    url: "/auth/sessao",
    headers: { cookie: `lia_sessao=${usuario.cookie}` },
  });
  assert.equal(depois.statusCode, 401, "a sessão revogada deixa de valer imediatamente");
});

test("app nativo recebe access e refresh token; refresh é rotativo", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario } = await registrarUsuario(ambiente.app);
  const login = await ambiente.app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: usuario.email, senha: usuario.senha, cliente: "nativo", dispositivo: "android-teste" },
  });
  assert.equal(login.statusCode, 200);
  const corpo = login.json() as { acesso: { token: string }; refresh: { token: string } };
  assert.ok(corpo.acesso.token);
  assert.ok(corpo.refresh.token);

  const comToken = await ambiente.app.inject({
    method: "GET",
    url: "/auth/sessao",
    headers: { authorization: `Bearer ${corpo.acesso.token}` },
  });
  assert.equal(comToken.statusCode, 200);
  assert.equal(comToken.json().origem, "nativo");

  const renovado = await ambiente.app.inject({
    method: "POST",
    url: "/auth/token/renovar",
    payload: { refreshToken: corpo.refresh.token },
  });
  assert.equal(renovado.statusCode, 200);
  const novos = renovado.json() as { acesso: { token: string }; refresh: { token: string } };
  assert.notEqual(novos.refresh.token, corpo.refresh.token);

  const reutilizar = await ambiente.app.inject({
    method: "POST",
    url: "/auth/token/renovar",
    payload: { refreshToken: corpo.refresh.token },
  });
  assert.equal(reutilizar.statusCode, 401, "refresh antigo não pode ser reutilizado");
});

test("revogar sessões encerra tudo de uma vez", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario } = await registrarUsuario(ambiente.app);
  const loginNativo = await ambiente.app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: usuario.email, senha: usuario.senha, cliente: "nativo" },
  });
  const token = (loginNativo.json() as { acesso: { token: string } }).acesso.token;

  const revogar = await ambiente.app.inject({
    method: "POST",
    url: "/auth/sessoes/revogar",
    headers: { cookie: `lia_sessao=${usuario.cookie}` },
  });
  assert.equal(revogar.statusCode, 204);

  const cookieDepois = await ambiente.app.inject({
    method: "GET",
    url: "/auth/sessao",
    headers: { cookie: `lia_sessao=${usuario.cookie}` },
  });
  const tokenDepois = await ambiente.app.inject({
    method: "GET",
    url: "/auth/sessao",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(cookieDepois.statusCode, 401);
  assert.equal(tokenDepois.statusCode, 401);
});

test("saúde da API responde e exige banco de verdade", { skip: !disponivel && "sem banco de teste" }, async () => {
  const resposta = await ambiente.app.inject({ method: "GET", url: "/saude" });
  assert.equal(resposta.statusCode, 200);
  assert.equal(resposta.json().ok, true);
});


test("cookie de sessão: Lax por padrão, None+Secure só quando configurado (app embutido)", { skip: !disponivel && "sem banco de teste" }, async () => {
  const padrao = configDeTeste();
  assert.equal(padrao.cookieSameSite, "lax", "o padrão não enfraquece CSRF");

  // `COOKIE_SAMESITE=none` sem HTTPS (COOKIE_SEGURO) é recusado: o navegador descartaria o cookie.
  const semSeguro = carregarConfig({ DATABASE_URL: "postgres://x", COOKIE_SAMESITE: "none" });
  assert.equal(semSeguro.cookieSameSite, "lax");
  assert.equal(semSeguro.cookieSeguro, false);

  const embutido = carregarConfig({ DATABASE_URL: "postgres://x", COOKIE_SAMESITE: "none", COOKIE_SEGURO: "true" });
  assert.equal(embutido.cookieSameSite, "none");
  assert.equal(embutido.cookieSeguro, true);

  // E o servidor montado com essa configuração realmente manda o cookie que o navegador precisa.
  const app = await construirServidor({
    pool: ambiente.pool,
    config: { ...configDeTeste(), cookieSameSite: "none", cookieSeguro: true },
  });
  await app.ready();
  try {
    const { resposta } = await registrarUsuario(app);
    const cookie = resposta.cookies.find((item) => item.name === "lia_sessao");
    assert.equal(cookie?.sameSite, "None");
    assert.equal(cookie?.secure, true);
    assert.equal(cookie?.httpOnly, true, "continua fora do alcance de JavaScript");
  } finally {
    await app.close();
  }
});
