import test from "node:test";
import assert from "node:assert/strict";
import {
  caminhoDoLogDoNpm,
  diagnosticarComLog,
  diagnosticarFalhaNpm,
  linhasRelevantes,
  erroDeSpawn,
  lerEnvDoTexto,
  montarComando,
  ocultarUrl,
  resumoSaida,
  valeTentarDeNovo,
} from "./dev-util.mjs";

test("Windows: npm (`.cmd`) é chamado por um shell — senão o Node nem executa", () => {
  const comando = montarComando("npm.cmd", ["install"], "win32", { ComSpec: "C:\\Windows\\System32\\cmd.exe" });
  assert.equal(comando.shell, true, "sem shell, o Node recusa executar .cmd (erro EINVAL) e nada aparece");
  assert.equal(comando.comando, "C:\\Windows\\System32\\cmd.exe");
  assert.deepEqual(comando.args, ["install"]);
});

test("Windows: programas .exe continuam sem shell (git, node, docker)", () => {
  for (const programa of ["git.exe", "node.exe", "docker.exe"]) {
    const comando = montarComando(programa, ["--version"], "win32");
    assert.equal(comando.shell, false, `${programa} não precisa de shell`);
    assert.equal(comando.comando, programa);
  }
});

test("Linux/macOS: nada de shell, mesmo com nome terminando em .cmd", () => {
  const comando = montarComando("npm.cmd", ["install"], "linux");
  assert.equal(comando.shell, false);
  assert.equal(comando.comando, "npm.cmd");
});

test("erro de spawn vira explicação em português, não um código solto", () => {
  assert.match(erroDeSpawn({ error: { code: "ENOENT" } }), /Node\.js está instalado/);
  assert.match(erroDeSpawn({ error: { code: "EINVAL" } }), /bloqueou a execução/);
  assert.match(erroDeSpawn({ error: { code: "EPERM" } }), /Sem permissão/);
  assert.equal(erroDeSpawn({ error: null }), null, "sem erro de spawn não há o que explicar");
});

test("rede instável vale tentar de novo; DNS/registro errado NÃO (seria perda de tempo)", () => {
  const instavel = diagnosticarFalhaNpm("npm error network ETIMEDOUT" + String.fromCharCode(10) + "npm error fetch failed");
  assert.equal(instavel[0].id, "rede");
  assert.equal(valeTentarDeNovo(instavel), true);

  const dns = diagnosticarFalhaNpm("npm error code ENOTFOUND\nnpm error network request to https://registry.invalid.example/ failed");
  assert.deepEqual(dns.map((dica) => dica.id), ["dns"], "a explicação específica substitui a genérica de rede");
  assert.equal(valeTentarDeNovo(dns), false, "endereço errado não melhora repetindo o comando");
  assert.match(dns[0].dica, /npm config get registry/);
});

test("sintoma 'Exit handler never called' (npm se perdendo) explica e manda tentar de novo", () => {
  const dicas = diagnosticarFalhaNpm("npm error Exit handler never called!\nnpm error A complete log of this run can be found in: /tmp/log");
  assert.equal(dicas[0].id, "npm_travou");
  assert.equal(valeTentarDeNovo(dicas), true);
  assert.match(dicas[0].dica, /reports\//);
});

test("quando a tela não explica, o log interno do npm entra em cena (caso real medido)", () => {
  const naTela = [
    "npm error Exit handler never called!",
    "npm error A complete log of this run can be found in: /home/user/.npm/_logs/2026-debug-0.log",
  ].join("\n");
  const noLog = [
    "63 verbose audit error FetchError: request to https://registry.invalid.example/-/npm/v1/security/audits/quick failed, reason: getaddrinfo ENOTFOUND registry.invalid.example",
    "63 verbose audit error   code: 'ENOTFOUND',",
    "63 verbose audit error   errno: 'ENOTFOUND',",
  ].join("\n");

  const analise = diagnosticarComLog(naTela, noLog);
  assert.equal(analise.fonte, "log", "o log interno é mais confiável do que 'npm se perdeu'");
  assert.deepEqual(analise.dicas.map((dica) => dica.id), ["dns"], "o sintoma genérico sai quando a causa real aparece");
  assert.equal(valeTentarDeNovo(analise.dicas), false, "com a causa clara, não se perde tempo repetindo");
  assert.ok(analise.linhasDoLog.some((linha) => /ENOTFOUND/.test(linha)), "a linha do motivo é mostrada");
});

test("quando a tela já explica, o log não é usado (não confunde a pessoa)", () => {
  const analise = diagnosticarComLog("npm error code EACCES", "verbose qualquer coisa ENOTFOUND");
  assert.equal(analise.fonte, "tela");
  assert.equal(analise.dicas[0].id, "permissao");
  assert.deepEqual(analise.linhasDoLog, []);
});

test("linhas relevantes são resumidas e sem repetição", () => {
  const log = [
    "info linha irrelevante",
    "verbose error code ENOTFOUND",
    "verbose error code ENOTFOUND",
    "verbose reason: getaddrinfo ENOTFOUND host",
  ].join("\n");
  const linhas = linhasRelevantes(log);
  assert.equal(linhas.filter((linha) => linha.includes("error code")).length, 1, "repetição não ajuda ninguém");
  assert.ok(linhas.some((linha) => linha.includes("getaddrinfo")));
  assert.ok(!linhas.some((linha) => linha.includes("irrelevante")));
});

test("o caminho do log interno do npm é encontrado na saída (é onde mora o motivo real)", () => {
  const saida = [
    "npm error code ENOTFOUND",
    "npm error A complete log of this run can be found in: /home/user/.npm/_logs/2026-10-12T23_03_36_452Z-debug-0.log",
  ].join("\n");
  assert.equal(caminhoDoLogDoNpm(saida), "/home/user/.npm/_logs/2026-10-12T23_03_36_452Z-debug-0.log");
  assert.equal(caminhoDoLogDoNpm("npm error sem caminho nenhum"), null);
});

test("Windows: o caminho do log com \\ também é reconhecido", () => {
  const saida = "npm error A complete log of this run can be found in: C:\\Users\\Ana\\AppData\\Local\\npm-cache\\_logs\\2026-debug-0.log";
  assert.equal(
    caminhoDoLogDoNpm(saida),
    "C:\\Users\\Ana\\AppData\\Local\\npm-cache\\_logs\\2026-debug-0.log",
  );
});

test("proxy com senha é reconhecido separadamente da rede comum", () => {
  const dicas = diagnosticarFalhaNpm("npm error 407 Proxy Authentication Required");
  assert.deepEqual(dicas.map((dica) => dica.id), ["proxy"]);
  assert.match(dicas[0].dica, /npm config get proxy/);
});

test("caso real: o pacote @fastify/proxy-addr no log NÃO é problema de proxy", () => {
  const trechoDoLog = [
    "491 http cache @fastify/proxy-addr@https://registry.invalid.example/@fastify/proxy-addr/-/proxy-addr-5.1.2.tgz 0ms (cache hit)",
    "683 silly tarball no local data for @fastify/proxy-addr@... Extracting by manifest.",
    "459 http fetch GET https://registry.invalid.example/uuid/-/uuid-7.0.3.tgz attempt 1 failed with ENOTFOUND",
  ].join("\n");
  const dicas = diagnosticarFalhaNpm(trechoDoLog);
  assert.deepEqual(dicas.map((dica) => dica.id), ["dns"]);
});

test("números soltos no log (tamanhos, códigos, portas) não viram causa falsa", () => {
  const log = "459 http fetch GET https://registry.npmjs.org/uuid/-/uuid-7.0.3.tgz attempt 1 failed with ENOTFOUND";
  const dicas = diagnosticarFalhaNpm(log);
  assert.deepEqual(dicas.map((dica) => dica.id), ["dns"], "o '407' de um log nunca deve virar 'seu proxy'");
});

test("antivírus/arquivo preso (EPERM) explica fechar janelas", () => {
  const dicas = diagnosticarFalhaNpm("npm error path C:\\Lia-Go\\node_modules\\pg\nnpm error errno -4048\nnpm error code EPERM");
  assert.equal(dicas[0].id, "permissao");
  assert.match(dicas[0].dica, /Feche todas as janelas/);
});

test("cada causa conhecida tem dica acionável", () => {
  const casos = [
    ["ENAMETOOLONG", "caminho_longo"],
    ["npm error code EINTEGRITY", "cache"],
    ["npm error code ERESOLVE", "conflito"],
    ["npm error code ENOSPC", "espaco"],
    ["npm error EBADENGINE Unsupported engine", "versao_node"],
    ["unable to get local issuer certificate", "certificado"],
  ];
  for (const [saida, esperado] of casos) {
    const dicas = diagnosticarFalhaNpm(saida);
    assert.equal(dicas[0].id, esperado, `saída "${saida}" deveria ser ${esperado}`);
    assert.ok(dicas[0].dica.length > 20, "a dica precisa dizer o que fazer");
  }
});

test("falha não reconhecida ainda dá orientação útil (e não mente sobre a causa)", () => {
  const dicas = diagnosticarFalhaNpm("npm error algo muito estranho aconteceu");
  assert.equal(dicas[0].id, "desconhecida");
  assert.match(dicas[0].causa, /não disse o motivo/);
  assert.equal(valeTentarDeNovo(dicas), true);
});

test("múltiplas causas específicas na mesma saída são todas reportadas", () => {
  const dicas = diagnosticarFalhaNpm("npm error code EPERM\nnpm error code ENOSPC");
  assert.deepEqual(dicas.map((dica) => dica.id), ["permissao", "espaco"]);
  assert.equal(valeTentarDeNovo(dicas), true, "arquivo preso pode se resolver tentando de novo");
  // E quando só há o sintoma genérico de rede, ele continua aparecendo.
  assert.deepEqual(diagnosticarFalhaNpm("npm error network fetch failed").map((dica) => dica.id), ["rede"]);
});

test("resumo da saída mostra o fim e nunca engole a mensagem de erro", () => {
  const saida = Array.from({ length: 100 }, (_, i) => `linha ${i}`).join("\n") + "\nnpm error code ENOTFOUND final";
  const resumo = resumoSaida(saida, 5);
  assert.equal(resumo.split("\n").length, 5);
  assert.match(resumo, /ENOTFOUND final/, "o motivo real precisa aparecer");
  assert.equal(resumoSaida(""), "(o comando não escreveu nada)");
  assert.equal(resumoSaida(null), "(o comando não escreveu nada)");
});

test("URL do banco é exibida sem senha (nunca vaza em relatório)", () => {
  assert.equal(ocultarUrl("postgres://lia_go:segredo@127.0.0.1:55432/lia_go"), "postgres://lia_go:****@127.0.0.1:55432/lia_go");
  assert.equal(ocultarUrl("postgres://lia_go@127.0.0.1:55432/lia_go"), "postgres://lia_go@127.0.0.1:55432/lia_go");
  assert.equal(ocultarUrl(""), "(não definida)");
});

test("leitura do .env ignora comentários e linhas vazias", () => {
  const valores = lerEnvDoTexto("# comentário\nDATABASE_URL=postgres://a@b/c\n\nPORT=\"3000\"\nHOST='0.0.0.0'\n");
  assert.equal(valores.DATABASE_URL, "postgres://a@b/c");
  assert.equal(valores.PORT, "3000");
  assert.equal(valores.HOST, "0.0.0.0");
});
