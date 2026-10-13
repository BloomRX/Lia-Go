import test from "node:test";
import assert from "node:assert/strict";
import {
  caminhoDoLogDoNpm,
  diagnosticarComLog,
  diagnosticarFalhaNpm,
  linhasRelevantes,
  abriuPromptDoWindows,
  erroDeSpawn,
  lerEnvDoTexto,
  candidatosDePython,
  comandosDeExtracao,
  escolherArquivoDeBinarios,
  explicarLogDoServidor,
  formatarTamanho,
  linhaDeProgresso,
  tempoDecorrido,
  montarComando,
  montarDiagnostico,
  ocultarUrl,
  sufixoDeBinarios,
  versaoCompativel,
  resumoSaida,
  valeTentarDeNovo,
} from "./dev-util.mjs";

test("Windows: npm (`.cmd`) vira UMA linha executada pelo cmd.exe — sem `cmd.exe` sobrando na linha", () => {
  const comando = montarComando("npm.cmd", ["install"], "win32");
  assert.equal(comando.comando, "npm.cmd install", "o Node executa `cmd.exe /d /s /c \"npm.cmd install\"`");
  assert.deepEqual(comando.args, [], "sem args o Node não concatena nada (e não emite o aviso DEP0190)");
  assert.equal(comando.shell, true);
  assert.doesNotMatch(
    comando.comando,
    /cmd\.exe/i,
    "um `cmd.exe` dentro da linha abre um prompt interativo no lugar do npm: nada roda e o código é 0",
  );
});

test("Windows: caminho com espaço vira aspas (Program Files)", () => {
  const comando = montarComando("C:\\Program Files\\nodejs\\npm.cmd", ["run", "dev:web"], "win32");
  assert.equal(comando.comando, '"C:\\Program Files\\nodejs\\npm.cmd" run dev:web');
  assert.deepEqual(comando.args, []);
});

test("prompt no lugar do programa é reconhecido como 'não rodou nada'", () => {
  const banner =
    "Microsoft Windows [versão 10.0.26200.9457]" + String.fromCharCode(13, 10) +
    "(c) Microsoft Corporation. Todos os direitos reservados.";
  assert.equal(abriuPromptDoWindows(banner), true, "foi este o sintoma no PC do usuário");
  assert.equal(abriuPromptDoWindows("Microsoft Windows [Version 10.0.22631.3880]"), true);
  assert.equal(abriuPromptDoWindows("added 244 packages in 12s"), false);
  assert.equal(abriuPromptDoWindows(""), false);
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

test("Windows procura o Python como `py -3`/`python` — `python3` não existe lá", () => {
  const win = candidatosDePython("win32").map(([programa]) => programa);
  assert.deepEqual(win, ["py", "python", "python3"], "o launcher oficial vem primeiro; `python3` é só uma rede de segurança");
  assert.deepEqual(candidatosDePython("linux").map(([programa]) => programa), ["python3", "python"]);
});

test("janela de Python para o banco embutido (3.9–3.12) — fora dela o pip não teria binário para baixar", () => {
  for (const versao of ["3.9", "3.10", "3.11", "3.12"]) {
    assert.equal(versaoCompativel(versao), true, `${versao} tem binário publicado`);
  }
  for (const versao of ["3.8", "3.13", "3.14", "2.7", "4.0", ""]) {
    assert.equal(versaoCompativel(versao), false, `${versao} não tem binário publicado`);
  }
});

test("log do PostgreSQL vira dica acionável (administrador, porta ocupada)", () => {
  const admin = explicarLogDoServidor("FATAL: execution of PostgreSQL by a user with administrative permissions is not permitted");
  assert.match(admin, /administrador/, "no Windows, rodar como administrador impede o banco de subir");
  const porta = explicarLogDoServidor('could not bind IPv4 address "127.0.0.1": Address already in use', "55432");
  assert.match(porta, /55432/, "a dica precisa dizer qual porta está ocupada");
  assert.equal(explicarLogDoServidor("database system is ready to accept connections"), "", "log normal não gera dica");
});

test("escolhe o arquivo de binários certo por sistema (e avisa quando não existe)", () => {
  const catalogo = {
    info: { version: "0.1.4" },
    urls: [
      { filename: "pgserver-0.1.4-cp39-cp39-win_amd64.whl", url: "https://exemplo/win39.whl", size: 12 },
      { filename: "pgserver-0.1.4-cp312-cp312-win_amd64.whl", url: "https://exemplo/win312.whl", size: 13 },
      { filename: "pgserver-0.1.4-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", url: "https://exemplo/linux.whl", size: 11 },
    ],
  };
  const win = escolherArquivoDeBinarios(catalogo, "win32", "x64");
  assert.equal(win.url, "https://exemplo/win312.whl", "no Windows pega o pacote win_amd64 (o .pyd do Python não é usado: só os programas)");
  assert.equal(win.tamanho, 13);
  assert.match(escolherArquivoDeBinarios(catalogo, "linux", "x64").nome, /manylinux_2_17_x86_64/);
  assert.equal(sufixoDeBinarios("darwin", "arm64"), "macosx_11_0_arm64", "macOS Apple Silicon tem o seu próprio sufixo");
  assert.equal(escolherArquivoDeBinarios(catalogo, "darwin", "arm64"), null, "catálogo sem pacote para macOS devolve null");
  assert.equal(escolherArquivoDeBinarios({ urls: [] }, "win32", "x64"), null, "catálogo vazio não pode virar download errado");
});

test("avisa quando a plataforma não tem binário publicado (Windows/Linux ARM)", () => {
  assert.equal(sufixoDeBinarios("win32", "arm64"), "win_arm64");
  assert.equal(sufixoDeBinarios("linux", "arm64"), "manylinux_2_17_aarch64.manylinux2014_aarch64");
  const catalogo = { info: { version: "1" }, urls: [{ filename: "pgserver-0.1.4-cp312-cp312-win_amd64.whl", url: "x", size: 1 }] };
  assert.equal(escolherArquivoDeBinarios(catalogo, "win32", "arm64"), null);
});

test("extração do arquivo baixado tenta os programas certos em cada sistema", () => {
  assert.deepEqual(comandosDeExtracao("linux", "banco.whl", "destino").map(([programa]) => programa), [
    "tar",
    "unzip",
    "python3",
  ]);
  assert.deepEqual(comandosDeExtracao("win32", "banco.whl", "destino").map(([programa]) => programa), [
    "tar",
    "powershell",
  ]);
  const [, segundo] = comandosDeExtracao("win32", "banco.whl", "destino");
  assert.match(segundo[1].join(" "), /Expand-Archive/, "no Windows sem tar, o PowerShell extrai o zip");
});

test("diagnóstico do computador diz o essencial em português", () => {
  const texto = montarDiagnostico({
    quando: "12/10/2026 22:00",
    sistema: "win32 x64",
    node: "v26.8.1",
    npm: "11.18.0",
    python: "python 3.14 (sem binários prontos do banco)",
    docker: "indisponível",
    banco: "portátil em .pgbin (PostgreSQL do próprio projeto)",
    dependencias: "instaladas e conferidas",
    testes: "170 passaram, 0 falharam, 0 pulados",
    branch: "arena/f1ac5ed6-lia-go",
    commit: "49720ae",
    ocorrencias: ["O envio para o GitHub não terminou: sem rede"],
    detalhes: [{ titulo: "Log do banco de dados (fim)", texto: "database system is ready" }],
  });
  assert.match(texto, /Sistema:\*\* win32 x64/);
  assert.match(texto, /python 3\.14/);
  assert.match(texto, /170 passaram/);
  assert.match(texto, /Avisos desta rodada/);
  assert.match(texto, /sem rede/);
  assert.match(texto, /database system is ready/);
});

test("progresso do download é legível: barra, percentual, tamanho e velocidade", () => {
  const linha = linhaDeProgresso(6_300_000, 12_600_000, 4);
  assert.match(linha, /\[#{12}(?:#|-)*-*\]/, "a barra precisa avançar conforme o download");
  assert.match(linha, /50%/, "o percentual é o que a pessoa entende de imediato");
  assert.match(linha, /6,0 MB\/12,0 MB/);
  assert.match(linha, /MB\/s/, "sem velocidade não dá para saber se está lento ou travado");
  assert.equal(linhaDeProgresso(0, 0, 0).trim(), "recebido 0 B", "sem tamanho conhecido ainda mostra o que veio");
  const semAnimacao = linhaDeProgresso(3_150_000, 12_600_000, 9, false);
  assert.match(semAnimacao, /^  25% \(3,0 MB de 12,0 MB\) · 342 KB\/s$/, "em log (sem terminal) sai em linha simples");
});

test("tamanhos e tempos em português", () => {
  assert.equal(formatarTamanho(512), "512 B");
  assert.equal(formatarTamanho(2048), "2 KB");
  assert.equal(formatarTamanho(12_600_000), "12,0 MB");
  assert.equal(formatarTamanho(0), "0 B");
  assert.equal(tempoDecorrido(Date.now() - 12_000), "12s");
  assert.equal(tempoDecorrido(Date.now() - 65_000), "1 min 5s");
});
