import test from "node:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {
  arvoreDeDependenciasEmDia,
  dependenciasDeclaradas,
  dependenciasQueFaltam,
  estadoDoAppWeb,
  arquivosQueFalharam,
  extrairFalhas,
  caminhoDoLogDoNpm,
  diagnosticarComLog,
  diagnosticarFalhaNpm,
  linhasRelevantes,
  abriuPromptDoWindows,
  erroDeSpawn,
  lerEnvDoTexto,
  candidatosDePython,
  comandosDeExtracao,
  classificarAlteracoesLocais,
  decidirAtualizacao,
  descreverDuracao,
  lerPlacarDeTestes,
  descreverPlacarDeTestes,
  separarLinhas,
  escolherAlvoDeAtualizacao,
  escolherArquivoDeBinarios,
  explicarLogDoServidor,
  formatarTamanho,
  linhaDeProgresso,
  tempoDecorrido,
  temConflitoNoStatus,
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

test("atualização: escolhe a referência e nunca decide mexer no que é da pessoa", () => {
  // De onde puxar
  assert.equal(
    escolherAlvoDeAtualizacao({ upstream: "origin/arena", upstreamExiste: true, branchExisteNoRemoto: true, branch: "arena" }),
    "origin/arena",
    "a referência da branch manda",
  );
  assert.equal(
    escolherAlvoDeAtualizacao({ upstream: "origin/antiga", upstreamExiste: false, branchExisteNoRemoto: true, branch: "arena" }),
    "origin/arena",
    "upstream quebrado cai para origin/<branch>",
  );
  assert.equal(escolherAlvoDeAtualizacao({ branch: "local-so", branchExisteNoRemoto: false }), null);

  // Quais alterações colidem com o que chega
  const classificado = classificarAlteracoesLocais({
    caminhosLocais: ["reports/relatorio-1.md", "tools/dev.mjs", "docs/a.md"],
    caminhosQueChegam: ["tools/dev.mjs", "docs/b.md"],
  });
  assert.deepEqual(classificado.sobrepostos, ["tools/dev.mjs"], "só conta o que os dois lados mexeram");
  assert.equal(classificado.apenasGerados, false);
  const soRelatorios = classificarAlteracoesLocais({
    caminhosLocais: ["reports/relatorio-1.md"],
    caminhosQueChegam: ["reports/relatorio-1.md"],
  });
  assert.equal(soRelatorios.apenasGerados, true, "relatórios são gerados a cada rodada: podem ser refeitos");

  // O que fazer — cada caso do mundo real
  const decidir = (entrada) => decidirAtualizacao(entrada).acao;
  assert.equal(decidir({ alvo: "origin/x", commitsNovos: 3, commitsLocais: 0, alteracoes: { tem: false } }), "avancar");
  assert.equal(
    decidir({ alvo: "origin/x", commitsNovos: 1, commitsLocais: 1, alteracoes: { tem: false } }),
    "reaplicar-por-cima",
    "commit local não pode impedir a atualização (era o bug original)",
  );
  assert.equal(
    decidir({ alvo: "origin/x", commitsNovos: 2, commitsLocais: 0, alteracoes: { tem: true, sobrepostos: [], apenasGerados: false } }),
    "atualizar-com-alteracoes",
    "alterações em arquivos que o GitHub não tocou não impedem nada",
  );
  assert.equal(
    decidir({ alvo: "origin/x", commitsNovos: 2, commitsLocais: 0, alteracoes: { tem: true, sobrepostos: ["reports/a.md"], apenasGerados: true } }),
    "restaurar-gerados-e-atualizar",
  );
  assert.equal(
    decidir({ alvo: "origin/x", commitsNovos: 2, commitsLocais: 0, alteracoes: { tem: true, sobrepostos: ["tools/dev.mjs"], apenasGerados: false } }),
    "guardar-trabalho-e-atualizar",
    "colisão em arquivo de verdade: commitar o que existe (nunca descartar) e só então atualizar",
  );
  assert.equal(
    decidir({ alvo: "origin/x", commitsNovos: 2, commitsLocais: 2, alteracoes: { tem: true, sobrepostos: [], apenasGerados: false } }),
    "guardar-trabalho-e-atualizar",
    "com commits locais, o rebase exige a cópia limpa: guarda primeiro",
  );
  assert.equal(decidir({ alvo: "origin/x", commitsNovos: 0, commitsLocais: 5, alteracoes: { tem: true, sobrepostos: ["a"], apenasGerados: false } }), "atualizado");
  assert.equal(decidir({ alvo: null, commitsNovos: 0, commitsLocais: 0, alteracoes: { tem: false } }), "sem-referencia");
});

test("conflito pela metade é reconhecido (foi o que quebrou a rodada seguinte)", () => {
  assert.equal(temConflitoNoStatus(""), false, "cópia limpa não tem conflito");
  assert.equal(temConflitoNoStatus(" M tools/dev.mjs\n?? reports/x.md"), false, "arquivo alterado comum não é conflito");
  assert.equal(temConflitoNoStatus("UU tools/dev.mjs"), true, "rebase parado no meio deixa o arquivo como UU");
  assert.equal(temConflitoNoStatus(" M docs/a.md\nAA docs/b.md"), true);
  assert.equal(temConflitoNoStatus("DU tools/db.mjs"), true);
});

test("limites de tempo são explicados em linguagem simples", () => {
  assert.equal(descreverDuracao(4000), "4 segundo(s)");
  assert.equal(descreverDuracao(900000), "15 minuto(s)");
  assert.equal(descreverDuracao(100), "1 segundo(s)", "nunca dizer '0 segundos'");
});

test("a rodada NÃO fica presa quando sobra um processo vivo (o caso do PostgreSQL)", async () => {
  // Reproduz o travamento de ~1h no Windows: o programa que sobe o banco termina, mas o servidor
  // continua rodando e herda os canos de saída. Se esses canos ficarem abertos, o Node espera para
  // sempre e a rodada nunca termina — mesmo com todo o trabalho pronto (foi o que aconteceu).
  const { spawn } = await import("node:child_process");
  const caminhoDaUtil = new URL("./dev-util.mjs", import.meta.url).href;
  const comandos =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "/b", "ping", "-n", "20", "127.0.0.1"]]
      : ["bash", ["-c", "sleep 20 & echo pronto"]];
  const roteiro = [
    `const { rodarHerdandoSaida } = await import(${JSON.stringify(caminhoDaUtil)});`,
    `await rodarHerdandoSaida(${JSON.stringify(comandos[0])}, ${JSON.stringify(comandos[1])}, { intervaloMs: 60000 });`,
    `console.log("terminou");`,
  ].join("\n");
  const filho = spawn(process.execPath, ["--input-type=module", "-e", roteiro], { stdio: "ignore" });
  const saiuSozinho = await new Promise((resolve) => {
    const relogio = setTimeout(() => resolve(false), 8000);
    filho.on("exit", () => {
      clearTimeout(relogio);
      resolve(true);
    });
  });
  if (!saiuSozinho) {
    filho.kill("SIGKILL");
    spawn(process.platform === "win32" ? "taskkill" : "pkill", process.platform === "win32" ? ["/f", "/im", "ping.exe"] : ["-f", "sleep"], { stdio: "ignore" });
  }
  assert.equal(
    saiuSozinho,
    true,
    "o processo tem que sair sozinho depois de terminar: a saída não pode ficar num cano que o processo do banco herda",
  );
});

test("o placar dos testes é lido no console do Windows (ℹ) e no arquivo (TAP #) — nunca mais '0 passaram'", () => {
  // Caso real: no PC do usuário a suíte inteira passou (181) e o resumo disse "0 passaram",
  // porque a saída num console de verdade usa o formato "spec" (`ℹ pass 37`), e a leitura só
  // entendia o TAP (`# pass 37`), que é o que sai quando a saída é capturada.
  const comoSaiNoConsole = [
    "✔ Windows: npm (`.cmd`) vira UMA linha executada pelo cmd.exe — sem `cmd.exe` sobrando na linha (2.6174ms)",
    "ℹ tests 37",
    "ℹ suites 0",
    "ℹ pass 37",
    "ℹ fail 0",
    "ℹ skipped 0",
    "ℹ todo 0",
    "",
    "ℹ pass 54",
    "ℹ fail 0",
    "ℹ skipped 0",
    "ℹ pass 38",
    "ℹ fail 0",
    "ℹ skipped 0",
    "ℹ pass 13",
    "ℹ fail 0",
    "ℹ skipped 0",
    "ℹ pass 39",
    "ℹ fail 0",
    "ℹ skipped 0",
  ].join("\n");
  const consoleLido = lerPlacarDeTestes(comoSaiNoConsole);
  assert.deepEqual(
    { passou: consoleLido.passou, falhou: consoleLido.falhou, pulados: consoleLido.pulados, encontrouPlacar: consoleLido.encontrouPlacar },
    { passou: 181, falhou: 0, pulados: 0, encontrouPlacar: true },
    "as linhas '✔ …' de cada teste não podem ser contadas (só o placar conta)",
  );

  const comoSaiEmArquivo = ["# tests 37", "# pass 37", "# fail 0", "# skipped 2", "# pass 54"].join("\n");
  assert.deepEqual(lerPlacarDeTestes(comoSaiEmArquivo), { passou: 91, falhou: 0, pulados: 2, encontrouPlacar: true });

  const semPlacar = lerPlacarDeTestes("Suíte concluída em 24s.\n");
  assert.equal(semPlacar.encontrouPlacar, false);
  assert.equal(semPlacar.passou, 0);
  assert.doesNotMatch(descreverPlacarDeTestes({ ...semPlacar, status: 0 }), /^0/, "não pode anunciar '0 passaram' quando o placar só não foi lido");
  assert.match(descreverPlacarDeTestes({ ...semPlacar, status: 0 }), /não consegui ler o placar/);
  assert.match(descreverPlacarDeTestes({ ...semPlacar, status: 1 }), /não chegaram a rodar/);
  assert.equal(descreverPlacarDeTestes({ passou: 181, falhou: 0, pulados: 0, encontrouPlacar: true }), "181 passaram · 0 falharam · 0 pulados");
});

test("saída de servidor é repassada linha por linha (nunca cola uma linha na outra)", () => {
  // Dois servidores escrevendo ao mesmo tempo, com o pedaço cortado no meio de uma linha —
  // era assim que a tela ficava quando o texto ia direto para o console.
  const primeiro = separarLinhas("", "[api] subindo\n[app] VITE rea");
  assert.deepEqual(primeiro.linhas, ["[api] subindo"]);
  assert.equal(primeiro.resto, "[app] VITE rea", "linha pela metade fica para o próximo pedaço");

  const segundo = separarLinhas(primeiro.resto, "dy in 142 ms\n[api] porta 3000\n");
  assert.deepEqual(segundo.linhas, ["[app] VITE ready in 142 ms", "[api] porta 3000"]);
  assert.equal(segundo.resto, "");

  // \r\n (Windows) não pode virar "♪◙" na tela: é só uma quebra de linha.
  const janelas = separarLinhas("", "> @lia-go/api@0.1.0 dev\r\n> node --watch\r\n");
  assert.deepEqual(janelas.linhas, ["> @lia-go/api@0.1.0 dev", "> node --watch"]);
  assert.doesNotMatch(janelas.linhas.join("\n"), /[♪◙\r]/);

  // Barra de progresso: vale o que ficou depois do último \r (é o que a tela mostraria).
  const barra = separarLinhas("", "25%\r50%\r75%\n pronto\n");
  assert.deepEqual(barra.linhas, ["75%", " pronto"]);
});

test("as funções principais do orquestrador continuam existindo (nenhuma remoção acidental)", async () => {
  // Uma limpeza de código apagou `enviarParaOGitHub` sem avisar; o erro só apareceu no fim de uma rodada real.
  const { readFileSync } = await import("node:fs");
  const fonte = readFileSync(new URL("./dev.mjs", import.meta.url), "utf8");
  const esperadas = [
    "abrirNoNavegador",
    "atualizarDoGitHub",
    "caminhosAlterados",
    "conferirInstalacaoReal",
    "enviarParaOGitHub",
    "gravarDiagnostico",
    "gravarRelatorio",
    "instalarDependencias",
    "rodarAoVivo",
    "rodarTestes",
    "subirBanco",
    "subirServidores",
    "temConflitoPendente",
    "tratarConflitoDeSincronizacao",
  ];
  for (const nome of esperadas) {
    assert.match(fonte, new RegExp(`function ${nome}\\b`), `a função ${nome} precisa existir em tools/dev.mjs`);
  }
  // E toda chamada a uma função "nossa" precisa ter uma definição correspondente.
  const chamadas = [...fonte.matchAll(/(?<![.\w])([a-z][A-Za-z0-9]*)\(/g)].map((m) => m[1]);
  const definidas = new Set([...fonte.matchAll(/function ([A-Za-z0-9_]+)/g)].map((m) => m[1]));
  // O que vem de dev-util.mjs também conta como definido.
  for (const nome of [...fonte.matchAll(/import \{([\s\S]*?)\} from "\.\/dev-util\.mjs"/g)].flatMap((m) => m[1].split(","))) {
    const limpo = nome.trim();
    if (limpo) definidas.add(limpo);
  }
  const daCasa = [...new Set(chamadas)].filter((nome) => /^(atualizar|caminhos|conferir|enviar|gravar|instalar|rodar|subir|tem|tratar)/.test(nome));
  const faltando = daCasa.filter((nome) => !definidas.has(nome));
  assert.deepEqual(faltando, [], "chamadas sem definição quebram a rodada no meio do caminho");
});

// --- Falhas no relatório: sem o contexto, o relatório do PC chega sem motivo (caso real) ---

test("arquivo de teste que não carregou é reconhecido nos dois formatos do Node", () => {
  const doConsole = ["✖ apps/mobile/.ui-testes/viagens.test.mjs (60.0335ms)", "  'test failed'"].join("\n");
  const doTAP = ["not ok 1 - /home/user/Lia-Go/apps/mobile/.ui-testes/viagens.test.mjs", "  ---", "  error: 'test failed'"].join("\n");
  const doConsoleWindows = "✖ J:\\Lia-Go\\apps\\mobile\\.ui-testes\\viagens.test.mjs (60.0335ms)";

  assert.deepEqual(arquivosQueFalharam(doConsole), ["viagens.test.mjs"]);
  assert.deepEqual(arquivosQueFalharam(doTAP), ["viagens.test.mjs"]);
  assert.deepEqual(arquivosQueFalharam(doConsoleWindows), ["viagens.test.mjs"]);
});

test("teste comum que falhou NÃO é confundido com arquivo que não carregou", () => {
  const saida = ["not ok 3 - item criado sem rede fica na fila do aparelho", "ok 4 - outro teste"].join("\n");
  assert.deepEqual(arquivosQueFalharam(saida), [], "só nome terminado em .mjs conta como arquivo");
});

test("o relatório leva o erro com contexto, não só o placar", () => {
  const saida = [
    "ℹ tests 8",
    "ℹ pass 6",
    "ℹ fail 2",
    "not ok 1 - orcamento.test.ts",
    "  error: |",
    "    Expected values to be strictly equal:",
    "    actual: '0'",
    "    expected: '300000'",
  ].join("\n");

  const falhas = extrairFalhas(saida);

  assert.equal(falhas.length, 1);
  assert.match(falhas[0].split("\n")[0], /^not ok 1 - orcamento\.test\.ts$/);
  assert.match(falhas[0], /expected: '300000'/, "o valor esperado vai junto: é o que explica a falha");
});

test("erro de TypeScript também entra no relatório como falha", () => {
  const falhas = extrairFalhas("src/telas/Viagem.tsx(35,21): error TS2307: Cannot find module '../assets/lia-hero.jpg'.");
  assert.equal(falhas.length, 1);
  assert.match(falhas[0], /error TS2307/);
});

test("saída sem falha não inventa bloco de erro (relatório verde fica limpo)", () => {
  const saida = ["ℹ tests 39", "ℹ pass 39", "ℹ fail 0", "ok 1 - tudo certo"].join("\n");
  assert.deepEqual(extrairFalhas(saida), []);
});


// ---------------------------------------------------------------------------
// Dependências: a conferência que furava deixava a rodada sem instalar o que faltava
// ---------------------------------------------------------------------------

/** Árvore de mentira no disco: `package.json` da raiz, de um workspace e um node_modules. */
function arvoreDeMentira({ raizDeclaradas = {}, appDeclaradas = {}, instalados = [], extras = {} } = {}) {
  const base = mkdtempSync(path.join(tmpdir(), "lia-go-deps-"));
  const escrever = (caminho, dados) => {
    mkdirSync(path.dirname(caminho), { recursive: true });
    writeFileSync(caminho, JSON.stringify(dados), "utf8");
  };
  escrever(path.join(base, "package.json"), { name: "raiz", workspaces: ["apps/*"], ...raizDeclaradas });
  escrever(path.join(base, "apps", "mobile", "package.json"), { name: "@lia-go/mobile", ...appDeclaradas });
  const marcarInstalado = (nome) => {
    const pasta = path.join(base, "node_modules", ...nome.split("/"));
    mkdirSync(pasta, { recursive: true });
    writeFileSync(path.join(pasta, "package.json"), "{}", "utf8");
  };
  for (const nome of instalados) marcarInstalado(nome);
  if (extras.comMarcador !== false) {
    mkdirSync(path.join(base, "node_modules"), { recursive: true });
    writeFileSync(path.join(base, "node_modules", ".package-lock.json"), "{}", "utf8");
    writeFileSync(path.join(base, "package-lock.json"), "{}", "utf8");
  }
  return base;
}

test("dependências declaradas: lê a raiz e os workspaces (pacote novo entra na conta sozinho)", () => {
  const base = arvoreDeMentira({
    raizDeclaradas: { devDependencies: { rolldown: "1.0.0" } },
    appDeclaradas: { dependencies: { react: "19.0.0", "lucide-react": "0.5.0" } },
  });
  const nomes = dependenciasDeclaradas(base);
  assert.ok(nomes.includes("rolldown"));
  assert.ok(nomes.includes("react"));
  assert.ok(nomes.includes("lucide-react"), "o pacote que a rodada de 2026-10-16 não instalou");
});

test("pacote declarado e ausente do disco é reportado com o nome", () => {
  const base = arvoreDeMentira({
    appDeclaradas: { dependencies: { react: "19.0.0", "lucide-react": "0.5.0" } },
    instalados: ["react"],
  });
  assert.deepEqual(dependenciasQueFaltam(base), ["lucide-react"]);
});

test("pacote instalado no node_modules do workspace também conta", () => {
  const base = arvoreDeMentira({ appDeclaradas: { dependencies: { jsdom: "1.0.0" } }, instalados: [] });
  mkdirSync(path.join(base, "apps", "mobile", "node_modules", "jsdom"), { recursive: true });
  assert.deepEqual(dependenciasQueFaltam(base), []);
});

test("árvore em dia: marcador presente, nada faltando e trava mais antiga que o marcador", () => {
  const base = arvoreDeMentira({ appDeclaradas: { dependencies: { react: "19.0.0" } }, instalados: ["react"] });
  assert.equal(arvoreDeDependenciasEmDia(base), true);
});

test("pacote novo depois da última instalação manda instalar de novo (o defeito do lucide-react)", () => {
  const base = arvoreDeMentira({ appDeclaradas: { dependencies: { react: "19.0.0" } }, instalados: ["react"] });
  assert.equal(arvoreDeDependenciasEmDia(base, { extras: ["rolldown"] }), false, "extra que falta conta");
  writeFileSync(path.join(base, "package.json"), JSON.stringify({ dependencies: { vite: "1.0.0" } }), "utf8");
  assert.equal(
    arvoreDeDependenciasEmDia(base, { extras: ["react"] }),
    false,
    "declarado novo e não instalado precisa derrubar a conferência",
  );
});

test("sem o marcador do npm a árvore não está confiável", () => {
  const base = arvoreDeMentira({ appDeclaradas: { dependencies: { react: "1.0.0" } }, instalados: ["react"], extras: { comMarcador: false } });
  assert.equal(arvoreDeDependenciasEmDia(base), false);
});


// ---------------------------------------------------------------------------
// "O app abriu?" — a pergunta que a rodada não fazia (aviso vermelho só no navegador)
// ---------------------------------------------------------------------------

function resposta(corpo, { status = 200 } = {}) {
  return { ok: status >= 200 && status < 300, status, text: async () => corpo };
}

/** Como o Vite responde o módulo: página HTML de erro, com as aspas escapadas. */
function erroDoVite(pacote) {
  const corpo =
    `<script type="module">const error = {"message":"Failed to resolve import \\"${pacote}\\" from \\"apps/mobile/src/telas/Viagem.tsx\\". Does the file exist?"}</script>`;
  return resposta(corpo, { status: 500 });
}

test("app servindo: percorre o app da entrada até as telas, como o navegador", async () => {
  const modulos = {
    "/src/main.tsx": 'import { App } from "/src/App.tsx";',
    "/src/App.tsx": 'import { Viagem } from "/src/telas/Viagem.tsx";',
    "/src/telas/Viagem.tsx": 'import { Roteiro } from "/src/telas/Roteiro.tsx";',
    "/src/telas/Roteiro.tsx": "export const Roteiro = 1;",
  };
  const buscar = async (url) => {
    const caminho = new URL(url).pathname;
    if (caminho === "/") return resposta('<script type="module" src="/src/main.tsx"></script>');
    return modulos[caminho] ? resposta(modulos[caminho]) : resposta("", { status: 404 });
  };
  const estado = await estadoDoAppWeb("http://app/", buscar);
  assert.equal(estado.ok, true);
  assert.equal(estado.modulos, 4, "entrada, App e as duas telas foram visitadas");
});

test("dependência não instalada: a rodada percebe pelo módulo, não pela porta", async () => {
  const buscar = async (url) => {
    const caminho = new URL(url).pathname;
    if (caminho === "/") return resposta('<script type="module" src="/src/main.tsx"></script>');
    if (caminho === "/src/main.tsx") return resposta('import { App } from "/src/App.tsx";');
    if (caminho === "/src/App.tsx") return resposta('import { Viagem } from "/src/telas/Viagem.tsx";');
    // A tela funda é onde o import quebrado aparece — exatamente o caso do `lucide-react`.
    return erroDoVite("lucide-react");
  };
  const estado = await estadoDoAppWeb("http://app/", buscar);
  assert.equal(estado.ok, false);
  assert.equal(estado.modulo, "/src/telas/Viagem.tsx", "o motivo aponta onde quebrou");
  assert.match(estado.motivo, /lucide-react/, "o motivo precisa dizer **qual** dependência falta");
  assert.match(estado.motivo, /dependência/, 'e dizer que é dependência, não "erro misterioso"');
});

test("página fora do ar e servidor sem resposta também são falha explícita", async () => {
  const fora = await estadoDoAppWeb("http://app/", async () => resposta("", { status: 502 }));
  assert.equal(fora.ok, false);
  assert.match(fora.motivo, /502/);

  const semResposta = await estadoDoAppWeb("http://app/", async () => {
    throw new Error("fetch failed");
  });
  assert.equal(semResposta.ok, false);
  assert.match(semResposta.motivo, /fetch failed/);
});
