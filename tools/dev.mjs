#!/usr/bin/env node
/**
 * tools/dev.mjs — orquestração do desenvolvimento do Lia Go.
 *
 * É o cérebro por trás do LiaGo.bat (Windows) e pode ser usado direto em qualquer sistema:
 *   node tools/dev.mjs tudo         → UMA tecla: atualiza, prepara, testa, relata, envia e deixa o app no ar
 *   node tools/dev.mjs auto         → banco + migrações + testes + relatório + sincronização
 *   node tools/dev.mjs testes       → roda a suíte completa e grava relatório
 *   node tools/dev.mjs banco        → sobe o PostgreSQL local e aplica migrações
 *   node tools/dev.mjs dev          → sobe a API e o app web juntos
 *   node tools/dev.mjs android      → prepara a build Android (exige Android SDK/JDK 21)
 *   node tools/dev.mjs sincronizar  → commit + rebase + push da branch de trabalho (via DevKit)
 *
 * Nunca publica nada em nome de ninguém, nunca faz push em branch protegida e nunca
 * imprime segredo: a DATABASE_URL é sempre exibida com a senha oculta.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  abriuPromptDoWindows,
  candidatosDePython,
  explicarLogDoServidor,
  caminhoDoLogDoNpm,
  diagnosticarComLog,
  diagnosticarFalhaNpm,
  erroDeSpawn,
  lerEnvDoTexto,
  montarComando,
  montarDiagnostico,
  ocultarUrl,
  versaoCompativel,
  resumoSaida,
  valeTentarDeNovo,
} from "./dev-util.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR_RELATORIOS = path.join(RAIZ, "reports");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const NODE = process.platform === "win32" ? "node.exe" : "node";

/** Avisos coletados durante a rodada: vão para reports/estado-do-computador.md. */
const OCORRENCIAS = [];
function registrarAviso(texto) {
  OCORRENCIAS.push(texto);
}

function titulo(texto) {
  console.log(`\n=== ${texto} ===`);
}

function rodar(comando, args, opcoes = {}) {
  const chamada = montarComando(comando, args);
  const resultado = spawnSync(chamada.comando, chamada.args, {
    cwd: opcoes.cwd ?? RAIZ,
    encoding: "utf8",
    shell: chamada.shell,
    env: { ...process.env, ...(opcoes.env ?? {}) },
    stdio: opcoes.capturar ? "pipe" : "inherit",
  });
  return {
    status: resultado.status ?? 1,
    saida: `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`,
    // Quando o processo nem chega a rodar, o motivo vem aqui — e não pode ser descartado.
    error: resultado.error ?? null,
  };
}

/** Lê o .env do projeto (mesmo arquivo que a API usa). Nunca imprime os valores. */
function lerEnv() {
  const caminho = path.join(RAIZ, ".env");
  return existsSync(caminho) ? lerEnvDoTexto(readFileSync(caminho, "utf8")) : {};
}

function versaoNode() {
  return process.version;
}

function verificarNode() {
  const maior = Number(process.versions.node.split(".")[0]);
  const menor = Number(process.versions.node.split(".")[1] ?? "0");
  if (maior < 22 || (maior === 22 && menor < 12)) {
    throw new Error(`Node ${process.version} é antigo. Instale o Node 22.12 ou superior (https://nodejs.org).`);
  }
}

/**
 * Uma pasta node_modules existir não quer dizer que está completa: uma instalação parcial
 * (interrompida, ou um `npm install` de outro pacote) já deixou a API sem o driver do banco.
 * Por isso conferimos os pacotes de que cada parte depende, um por um.
 */
const PACOTES_OBRIGATORIOS = ["fastify", "@fastify/cookie", "pg", "zod", "vite", "react", "@capacitor/core"];

function dependenciasInstaladas() {
  // O npm escreve `node_modules/.package-lock.json` ao terminar uma instalação. Sem esse marcador,
  // a pasta pode estar pela metade — foi o que aconteceu quando o npm nem chegava a rodar no Windows.
  if (!existsSync(path.join(RAIZ, "node_modules", ".package-lock.json"))) return false;
  return PACOTES_OBRIGATORIOS.every((nome) => existsSync(path.join(RAIZ, "node_modules", ...nome.split("/"))));
}

/** Versão do npm (também serve de teste de vida: se o npm não roda, isso aparece no banner). */
function versaoNpm() {
  const resultado = rodar(NPM, ["--version"], { capturar: true });
  if (resultado.error || resultado.status !== 0) return "indisponível";
  // Em vez da versão, veio o banner do Windows? É o sintoma do prompt no lugar do npm.
  if (abriuPromptDoWindows(resultado.saida)) return "(não foi possível perguntar ao npm)";
  return resultado.saida.trim();
}

function banner() {
  console.log(`Lia Go · Node ${versaoNode()} · npm ${versaoNpm()} · ${process.platform}`);
}

/** A instalação realmente aconteceu? (o marcador é escrito pelo próprio npm) */
function instalacaoAconteceu() {
  return existsSync(path.join(RAIZ, "node_modules", ".package-lock.json"));
}

/**
 * Um `npm` que "termina bem" mas não instalou nada é o pior tipo de falha: parece sucesso.
 * Aconteceu no Windows quando o shell abria um prompt em vez de rodar o npm — por isso conferimos.
 */
function conferirInstalacaoReal(rotulo, resultado) {
  if (abriuPromptDoWindows(resultado.saida)) {
    throw new Error(
      `${rotulo}: o Windows abriu um prompt de comando no lugar de rodar o npm — NADA foi instalado. ` +
        "Atualize o projeto (opção 6 do LiaGo.bat) e rode de novo.",
    );
  }
  if (!instalacaoAconteceu()) {
    throw new Error(
      `${rotulo}: o comando terminou sem erro, mas a pasta node_modules não ficou pronta — NADA foi instalado. ` +
        "Rode de novo (opção 9 do LiaGo.bat) e, se repetir, envie o texto desta tela.",
    );
  }
}

function instalarDependencias(forcar = false) {
  if (!forcar && dependenciasInstaladas()) {
    console.log("Dependências já instaladas (npm install será pulado).");
    return;
  }
  titulo(forcar ? "Reinstalando dependências (npm install)" : "Instalando dependências (npm install)");
  const registro = rodar(NPM, ["config", "get", "registry"], { capturar: true });
  const urlRegistro = registro.status === 0 ? registro.saida.trim() : "(não foi possível perguntar ao npm)";
  console.log(`Baixando pacotes de: ${urlRegistro}`);

  const primeira = rodar(NPM, ["install"], { capturar: true });
  if (primeira.status === 0) {
    console.log(primeira.saida.trim());
    conferirInstalacaoReal("npm install", primeira);
    return;
  }

  // Falhou: a pessoa precisa ver o motivo real, não um aviso genérico.
  const dicas = relatarFalhaNpm("npm install", primeira, urlRegistro);
  if (erroDeSpawn(primeira) || !valeTentarDeNovo(dicas)) {
    throw new Error("npm install não foi concluído. O motivo e o que fazer estão nas linhas acima.");
  }

  // Árvore de dependências pela metade não se conserta tentando de novo: precisa limpar antes.
  if (dicas.some((dica) => dica.id === "arvore_pela_metade")) {
    console.log("\nA pasta de dependências ficou pela metade. Apagando node_modules (pasta gerada) e instalando limpo…");
    limparNodeModules();
    const limpa = rodar(NPM, ["install", "--no-audit", "--no-fund"], { capturar: true });
    if (limpa.status === 0) {
      console.log(limpa.saida.trim());
      conferirInstalacaoReal("npm install (após limpar)", limpa);
      console.log("Instalação limpa concluída.");
      return;
    }
    relatarFalhaNpm("npm install (após limpar node_modules)", limpa, urlRegistro);
    throw new Error("Mesmo com a pasta limpa o npm install falhou. O motivo está nas linhas acima.");
  }

  console.log("\nTentando de novo com tempo de espera limitado (rede instável pode funcionar na segunda vez)…");
  const segunda = rodar(
    NPM,
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--fetch-retries=2",
      "--fetch-retry-maxtimeout=30000",
      "--fetch-timeout=60000",
    ],
    { capturar: true },
  );
  if (segunda.status === 0) {
    console.log(segunda.saida.trim());
    conferirInstalacaoReal("npm install (2ª tentativa)", segunda);
    console.log("Deu certo na segunda tentativa.");
    return;
  }
  relatarFalhaNpm("npm install (2ª tentativa)", segunda, urlRegistro);
  throw new Error("npm install falhou duas vezes seguidas. As causas prováveis estão nas linhas acima.");
}

/** Mostra o erro real do npm, grava o log completo e diz o que fazer. Devolve as dicas. */
function relatarFalhaNpm(rotulo, resultado, urlRegistro) {
  const motivoDoSpawn = erroDeSpawn(resultado);
  const logDoNpm = caminhoDoLogDoNpm(resultado.saida);
  const textoDoLog = lerLogDoNpm(logDoNpm);
  const { dicas, linhasDoLog, fonte } = diagnosticarComLog(resultado.saida, textoDoLog);

  console.error(`\n--- ${rotulo} falhou ---`);
  if (motivoDoSpawn) console.error(motivoDoSpawn);
  console.error("Últimas linhas do que o npm disse:");
  console.error(resumoSaida(resultado.saida, 30));
  if (fonte === "log" && linhasDoLog.length > 0) {
    console.error("\nO log interno do npm mostra o motivo real:");
    for (const linha of linhasDoLog) console.error(`  ${linha}`);
  }
  const caminhoLog = gravarLogNpm(rotulo, resultado.saida, urlRegistro, logDoNpm);
  console.error(`\nLog completo: ${path.relative(RAIZ, caminhoLog)}`);
  if (logDoNpm) console.error(`(o log interno do npm também foi copiado para dentro desse arquivo)`);

  console.error("\nCausa provável e o que fazer:");
  for (const dica of dicas) console.error(` - ${dica.causa}\n   → ${dica.dica}`);
  console.error("\nGuia com todos os casos: docs/DEV_SETUP.md §6 (Problemas comuns).");
  return dicas;
}

/**
 * Apaga as pastas node_modules do projeto (raiz e de cada pacote/app).
 * É pasta gerada pelo npm: apagar não perde nada do projeto e é o que qualquer dev faria
 * quando a árvore de dependências fica corrompida. Nunca toca em código, .env nem no banco.
 */
function limparNodeModules() {
  const pastas = [RAIZ, ...readdirSync(path.join(RAIZ, "apps"), { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => path.join(RAIZ, "apps", item.name)),
  ...readdirSync(path.join(RAIZ, "packages"), { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => path.join(RAIZ, "packages", item.name))];

  for (const base of pastas) {
    const caminho = path.join(base, "node_modules");
    if (!existsSync(caminho)) continue;
    try {
      rmSync(caminho, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      console.log(`  removido: ${path.relative(RAIZ, caminho)}`);
    } catch (causa) {
      console.warn(`  não foi possível remover ${path.relative(RAIZ, caminho)} (${causa instanceof Error ? causa.code ?? causa.message : "erro"}).`);
      console.warn("  Feche as janelas do Lia Go/app e o antivírus e rode de novo.");
    }
  }
}

/** Lê o log interno do npm, quando existe e é legível. */
function lerLogDoNpm(logDoNpm) {
  if (!logDoNpm || !existsSync(logDoNpm)) return null;
  try {
    return readFileSync(logDoNpm, "utf8");
  } catch {
    return null;
  }
}

function gravarLogNpm(rotulo, saida, urlRegistro, logDoNpm = null) {
  mkdirSync(DIR_RELATORIOS, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const caminho = path.join(DIR_RELATORIOS, `npm-install-${carimbo}.log`);

  const partes = [
    `# Falha do npm — Lia Go`,
    `Quando: ${new Date().toISOString()}`,
    `Passo: ${rotulo}`,
    `Node: ${versaoNode()} · npm: ${versaoNpm()} · sistema: ${process.platform}`,
    `Registro configurado: ${urlRegistro}`,
    ``,
    `## Saída completa`,
    ``,
    String(saida ?? "").trim() || "(o comando não escreveu nada)",
    ``,
  ];

  // O log interno do npm é onde o motivo real aparece. Copiamos para cá: um arquivo só para enviar.
  if (logDoNpm && existsSync(logDoNpm)) {
    try {
      partes.push(`## Log interno do npm (${logDoNpm})`, ``, readFileSync(logDoNpm, "utf8").trim(), ``);
    } catch {
      partes.push(`## Log interno do npm`, ``, `Não foi possível ler ${logDoNpm}.`, ``);
    }
  }

  writeFileSync(caminho, partes.join("\n"), "utf8");
  return caminho;
}

function subirBanco() {
  titulo("Banco de dados");
  const resultado = rodar(NODE, [path.join(RAIZ, "tools", "db.mjs"), "up"], { capturar: true });
  if (resultado.status !== 0) {
    console.warn(resumoSaida(resultado.saida, 12));
    if (erroDeSpawn(resultado)) console.warn(erroDeSpawn(resultado));
    console.warn("Não foi possível subir o banco automaticamente (o motivo está nas linhas acima).");
    console.warn("Sem Docker, o Lia Go instala um PostgreSQL embutido sozinho — para isso precisa do Python 3 (python.org).");
    console.warn("Rode a opção 4 do LiaGo.bat para tentar de novo.");
    console.warn("Sem banco, os testes de integração são PULADOS com aviso — não é sucesso.");
    return false;
  }
  console.log(resumoSaida(resultado.saida, 6));
  const migrar = rodar(NPM, ["run", "migrate"]);
  if (migrar.status !== 0) console.warn("A migração falhou; os testes de API podem ser pulados.");
  return true;
}

/** Checagem de tipos de todos os pacotes: nada entra no repositório sem passar por aqui. */
function rodarTipos() {
  titulo("Checagem de tipos (domain, api e mobile)");
  const resultado = rodar(NPM, ["run", "typecheck"], { capturar: true });
  if (abriuPromptDoWindows(resultado.saida)) {
    console.error("O Windows abriu um prompt no lugar de rodar o npm — os tipos NÃO foram conferidos.");
    return { status: 1, saida: resultado.saida };
  }
  if (resultado.status !== 0) console.error(resultado.saida.trim() || "(tsc não explicou o motivo)");
  else console.log("Tipos conferidos sem erro.");
  return { status: resultado.status, saida: resultado.saida };
}

function rodarTestes() {
  const tipos = rodarTipos();
  titulo("Testes (domínio + API)");
  const resultado = rodar(NPM, ["test"], { capturar: true });
  const saida = resultado.saida;
  console.log(saida);
  const linhas = saida.split("\n");
  let passou = 0;
  let falhou = 0;
  let pulados = 0;
  for (const linha of linhas) {
    const m = linha.match(/^#\s*(pass|fail|skipped)\s+(\d+)/);
    if (m) {
      if (m[1] === "pass") passou += Number(m[2]);
      if (m[1] === "fail") falhou += Number(m[2]);
      if (m[1] === "skipped") pulados += Number(m[2]);
    }
  }
  return { status: resultado.status, passou, falhou, pulados, saida, tipos };
}

function gitInfo() {
  const branch = rodar("git", ["branch", "--show-current"], { capturar: true }).saida.trim();
  const status = rodar("git", ["status", "--short"], { capturar: true }).saida.trim();
  const ultimo = rodar("git", ["log", "-1", "--pretty=%h %s"], { capturar: true }).saida.trim();
  return { branch, status, ultimo };
}

function gravarRelatorio(resultadoTestes) {
  mkdirSync(DIR_RELATORIOS, { recursive: true });
  const agora = new Date();
  const carimbo = agora.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const caminho = path.join(DIR_RELATORIOS, `relatorio-${carimbo}.md`);
  const git = gitInfo();
  const dockerOk = rodar("docker", ["info"], { capturar: true }).status === 0;
  const env = lerEnv();
  const banco =
    process.env.DATABASE_URL ?? env.DATABASE_URL ?? "(não definida — os testes de integração serão pulados)";
  const arquivosNaoRastreados = git.status ? git.status.split("\n").length : 0;

  const conteudo = [
    `# Relatório de execução — Lia Go`,
    ``,
    `- **Quando:** ${agora.toISOString()} (local ${agora.toLocaleString("pt-BR")})`,
    `- **Branch:** ${git.branch || "(destacada)"}`,
    `- **Último commit:** ${git.ultimo || "(nenhum)"}`,
    `- **Node:** ${versaoNode()} · **npm:** ${versaoNpm()}`,
    `- **Docker:** ${dockerOk ? "disponível" : "indisponível"} · **PostgreSQL:** ${ocultarUrl(banco)}`,
    ``,
    `## Testes`,
    ``,
    `| Resultado | Quantidade |`,
    `|---|---|`,
    `| Passaram | ${resultadoTestes.passou} |`,
    `| Falharam | ${resultadoTestes.falhou} |`,
    `| Pulados | ${resultadoTestes.pulados} |`,
    `| Código de saída | ${resultadoTestes.status} |`,
    `| Checagem de tipos (\`npm run typecheck\`) | ${resultadoTestes.tipos?.status === 0 ? "sem erro" : "COM ERRO"} |`,
    ``,
    ...(resultadoTestes.passou === 0
      ? [
          `> ⚠️ **Nenhum teste rodou nesta execução — isso NÃO é sucesso.** Confira as dependências (opção 9 do LiaGo.bat) e rode de novo.`,
          ``,
        ]
      : []),
    `> Os testes de integração são pulados (com aviso, nunca em silêncio) quando o banco não responde.`,
    `> Banco local: \`LiaGo.bat\` opção 4, ou \`npm run db:up\` com o Docker aberto.`,
    ``,
    `## Alterações em andamento`,
    ``,
    `\`\`\``,
    git.status || "(working tree limpo)",
    `\`\`\``,
    ``,
    `Total de entradas em \`git status\`: ${arquivosNaoRastreados}`,
    ``,
    `## Próximos passos sugeridos`,
    ``,
    `1. Ressincronizar com \`LiaGo.bat\` (ou \`npm run db:up && npm test\`) antes de abrir PR.`,
    `2. Conferir no navegador: \`LiaGo.bat dev\` e abrir o endereço exibido.`,
    `3. Para o app Android: \`LiaGo.bat android\` (requer Android Studio + JDK 21).`,
    ``,
    `## Saída dos testes (trecho final)`,
    ``,
    "```",
    resultadoTestes.saida.split("\n").slice(-60).join("\n"),
    "```",
    ``,
  ].join("\n");

  writeFileSync(caminho, conteudo, "utf8");

  // Mantém os 20 relatórios mais recentes: histórico suficiente sem acumular arquivos no Git.
  const todos = readdirSync(DIR_RELATORIOS)
    .filter((nome) => /^relatorio-.*\.md$/.test(nome))
    .sort();
  for (const antigo of todos.slice(0, -20)) unlinkSync(path.join(DIR_RELATORIOS, antigo));

  console.log(`Relatório gravado em ${path.relative(RAIZ, caminho)}`);
  return caminho;
}

function branchAtual() {
  return rodar("git", ["branch", "--show-current"], { capturar: true }).saida.trim();
}

/** Garante que o trabalho não vai para a branch protegida: cria/muda para uma branch de trabalho. */
function garantirBranchDeTrabalho() {
  const atual = branchAtual();
  if (atual && atual !== "main" && atual !== "master") return atual;
  const destino = "trabalho/lia-go";
  titulo(`Você está em "${atual || "HEAD destacado"}"; criando/abrindo a branch de trabalho "${destino}"`);
  const cli = path.join(RAIZ, "tools", "project_cli.py");
  const python = process.platform === "win32" ? "py" : "python3";
  const args = process.platform === "win32" ? ["-3", cli, "new-branch", destino] : [cli, "new-branch", destino];
  const criar = rodar(python, args);
  if (criar.status !== 0) {
    const checkoutArgs = process.platform === "win32" ? ["-3", cli, "checkout", destino] : [cli, "checkout", destino];
    const abrir = rodar(python, checkoutArgs);
    if (abrir.status !== 0) throw new Error("Não foi possível abrir uma branch de trabalho. Nada foi enviado.");
  }
  return destino;
}

function sincronizar(mensagem) {
  titulo("Sincronização (DevKit: valida, commit, rebase e push da branch de trabalho)");
  garantirBranchDeTrabalho();
  const cli = path.join(RAIZ, "tools", "project_cli.py");
  const python = process.platform === "win32" ? "py" : "python3";
  const args = process.platform === "win32" ? ["-3", cli, "sync"] : [cli, "sync"];
  if (mensagem) args.push("-m", mensagem);
  const resultado = rodar(python, args);
  if (resultado.status !== 0) {
    throw new Error("A sincronização não terminou. Nada foi forçado; confira o que o DevKit informou acima.");
  }
}

/** Monta a chamada de `npm run <script>` já no formato certo para o sistema (Windows precisa de shell). */
function comandoComoArgumentos(script) {
  const chamada = montarComando(NPM, ["run", script]);
  return [chamada.comando, chamada.args, { cwd: RAIZ, stdio: "inherit", shell: chamada.shell }];
}

function comandoTestes() {
  verificarNode();
  banner();
  instalarDependencias();
  subirBanco();
  const resultado = rodarTestes();
  const caminho = gravarRelatorio(resultado);
  if (resultado.falhou > 0 || resultado.status !== 0) {
    console.error(`\nExistem ${resultado.falhou} teste(s) falhando. Corrija antes de sincronizar.`);
    return 1;
  }
  if (resultado.passou === 0) {
    console.error(
      "\nNenhum teste rodou — isso NÃO é sucesso. Confira a instalação das dependências (opção 9 do LiaGo.bat).",
    );
    return 1;
  }
  if (resultado.tipos?.status !== 0) {
    console.error("\nA checagem de tipos falhou. Corrija antes de sincronizar.");
    return 1;
  }
  console.log(`\nTudo verde: ${resultado.passou} teste(s) passaram.`);
  console.log(`Relatório: ${path.relative(RAIZ, caminho)}`);
  return 0;
}

function comandoAuto() {
  const codigo = comandoTestes();
  if (codigo !== 0) return codigo;
  sincronizar(null);
  return 0;
}

function comandoDev() {
  verificarNode();
  banner();
  instalarDependencias();
  subirBanco();
  titulo("Subindo API e app web (Ctrl+C encerra os dois)");
  console.log("API: http://localhost:3000 · App: http://localhost:5273");
  const chamada = montarComando(NPM, ["run", "dev:api"]);
  const api = spawnSync(chamada.comando, chamada.args, { cwd: RAIZ, stdio: "inherit", shell: chamada.shell });
  if (api.error) console.error(erroDeSpawn({ error: api.error }));
  return api.status ?? 1;
}

async function comandoDevParalelo() {
  verificarNode();
  banner();
  instalarDependencias();
  subirBanco();
  titulo("Subindo API e app web juntos");
  await subirServidores();
}

/** Sobe a API e o app web e fica vigiando: se algum cair, a tela explica. */
async function subirServidores() {
  const { spawn } = await import("node:child_process");
  const api = spawn(...comandoComoArgumentos("dev:api"));
  const web = spawn(...comandoComoArgumentos("dev:web"));
  const vigiar = (nome, processo) => {
    processo.on("error", (erro) => console.error(`\nNão foi possível iniciar ${nome}: ${erro.message}`));
    processo.on("exit", (codigo) => {
      if (typeof codigo === "number" && codigo !== 0) {
        console.error(`\n${nome} terminou com código ${codigo} — a causa está nas linhas acima.`);
      }
    });
  };
  vigiar("a API", api);
  vigiar("o app web", web);
  console.log("\nAPI: http://localhost:3000 · App web: http://localhost:5273");
  console.log("Para o celular na mesma rede: use o endereço 'Network' mostrado pelo app web e defina VITE_API_URL.");
  const encerrar = () => {
    api.kill();
    web.kill();
    process.exit(0);
  };
  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);
  await new Promise(() => {});
}

function comandoAndroid() {
  titulo("Build Android (exige Android Studio + JDK 21 + SDK 36)");
  instalarDependencias();
  const temSdk = Boolean(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT) || process.platform === "win32";
  if (!temSdk) {
    console.warn("Android SDK não detectado neste ambiente. No Windows, instale o Android Studio e rode este comando de novo.");
    return 1;
  }
  const build = rodar(NPM, ["run", "build:web"]);
  if (build.status !== 0) throw new Error("A build web falhou; corrija antes de gerar o app.");
  const existeAndroid = existsSync(path.join(RAIZ, "apps", "mobile", "android"));
  const passo = existeAndroid ? ["run", "cap:sync", "--workspace", "@lia-go/mobile"] : ["run", "cap:add:android", "--workspace", "@lia-go/mobile"];
  const resultado = rodar(NPM, passo, { cwd: path.join(RAIZ, "apps", "mobile") });
  if (resultado.status !== 0) throw new Error("Falha ao preparar o projeto Android.");
  console.log("Projeto Android pronto em apps/mobile/android.");
  console.log("Abra no Android Studio com: cd apps\\mobile && npx cap open android");
  return 0;
}

function relatoriosRecentes() {
  if (!existsSync(DIR_RELATORIOS)) return [];
  return readdirSync(DIR_RELATORIOS)
    .filter((nome) => nome.startsWith("relatorio-"))
    .map((nome) => ({ nome, quando: statSync(path.join(DIR_RELATORIOS, nome)).mtime }))
    .sort((a, b) => b.quando - a.quando)
    .slice(0, 5);
}

/**
 * O caminho de uma tecla só: baixa a versão nova, prepara tudo, roda os testes, grava os relatórios,
 * envia para o GitHub e deixa o app no ar. Nenhuma pergunta no meio do caminho.
 */
async function comandoTudo() {
  const inicio = Date.now();
  console.log("=== Lia Go: rodada automática (não precisa escolher nada) ===");
  atualizarDoGitHub();
  verificarNode();
  banner();
  instalarDependencias();
  const bancoOk = subirBanco();
  const testes = rodarTestes();
  const caminhoRelatorio = gravarRelatorio(testes);
  gravarDiagnostico(bancoOk, testes);
  const enviado = enviarParaOGitHub();
  resumoFinal({ bancoOk, testes, caminhoRelatorio, enviado, inicio });
  await subirServidores();
}

/** Traz o que houver de novo no GitHub — sem nunca descartar trabalho local. */
function atualizarDoGitHub() {
  titulo("Baixando a versão mais nova do projeto (GitHub)");
  const branch = branchAtual();
  if (!branch || branch === "main" || branch === "master") {
    garantirBranchDeTrabalho();
  }
  const nome = branchAtual();
  const busca = rodar("git", ["fetch", "origin"], { capturar: true });
  if (busca.status !== 0) {
    registrarAviso("Não consegui falar com o GitHub para baixar novidades nesta rodada.");
    console.warn("Não consegui falar com o GitHub agora; sigo com o que já existe aqui.");
    console.warn(resumoSaida(busca.saida, 4));
    return false;
  }
  const avancar = rodar("git", ["merge", "--ff-only", `origin/${nome}`], { capturar: true });
  if (avancar.status === 0) {
    console.log(resumoSaida(avancar.saida, 4) || "Projeto já estava atualizado.");
    return true;
  }
  console.log("Existem mudanças locais ou o histórico divergiu; a sincronização no fim da rodada resolve.");
  registrarAviso("A atualização automática não avançou sozinha (havia mudanças locais); a sincronização do fim resolve.");
  return false;
}

/** Envia o que a rodada produziu (relatórios e diagnóstico) para o GitHub. */
function enviarParaOGitHub() {
  titulo("Enviando o resultado para o GitHub");
  try {
    sincronizar(`chore: rodada automatica do LiaGo.bat (${new Date().toISOString().slice(0, 16).replace("T", " ")})`);
    console.log("Enviado. Os relatórios desta rodada já estão no GitHub.");
    return true;
  } catch (erro) {
    registrarAviso(`O envio para o GitHub não terminou: ${erro instanceof Error ? erro.message : String(erro)}`);
    console.error(`Não consegui enviar agora: ${erro instanceof Error ? erro.message : String(erro)}`);
    console.error("O trabalho local está salvo; a próxima rodada tenta enviar de novo.");
    return false;
  }
}

/** Escreve o retrato do computador (mesmo nome sempre) para o responsável ler no GitHub. */
function gravarDiagnostico(bancoOk, testes) {
  const env = lerEnv();
  const url = process.env.DATABASE_URL ?? env.DATABASE_URL ?? "";
  const portatil = path.join(RAIZ, ".pgbin", "pgserver", "pginstall", "bin", `initdb${process.platform === "win32" ? ".exe" : ""}`);
  const docker = rodar("docker", ["info"], { capturar: true }).status === 0 ? "disponível" : "indisponível";
  const pythons = candidatosDePython().map(([programa, prefixo]) => {
    const versao = rodar(programa, [...prefixo, "-c", "import sys;print('%d.%d' % sys.version_info[:2])"], { capturar: true }).saida.trim();
    return `${programa} ${versao}${versaoCompativel(versao) ? "" : " (sem binários prontos do banco)"}`;
  });
  const banco = bancoOk
    ? existsSync(portatil)
      ? "portátil em .pgbin (PostgreSQL do próprio projeto)"
      : `via ${ocultarUrl(url)}`
    : "NÃO SUBIU nesta rodada";
  const testesTexto = testes.passou === 0 ? "nenhum teste rodou (ver avisos)" : `${testes.passou} passaram, ${testes.falhou} falharam, ${testes.pulados} pulados`;
  const git = gitInfo();
  const arquivoDeLog = path.join(RAIZ, ".pgdata", "servidor.log");
  const conteudo = montarDiagnostico({
    quando: new Date().toLocaleString("pt-BR"),
    sistema: `${process.platform} ${process.arch}`,
    node: versaoNode(),
    npm: versaoNpm(),
    python: pythons.length ? pythons.join(" · ") : "não encontrado",
    docker,
    banco,
    dependencias: instalacaoAconteceu() ? "instaladas e conferidas" : "NÃO ficaram prontas",
    testes: testesTexto,
    branch: git.branch || "(destacada)",
    commit: git.ultimo || "(nenhum)",
    ocorrencias: OCORRENCIAS,
    detalhes: [
      { titulo: "Últimas linhas dos testes", texto: testes.saida.split("\n").slice(-25).join("\n") },
      { titulo: "Log do banco de dados (fim)", texto: lerFimDoArquivo(arquivoDeLog, 15) },
    ],
  });
  mkdirSync(DIR_RELATORIOS, { recursive: true });
  const destino = path.join(DIR_RELATORIOS, "estado-do-computador.md");
  writeFileSync(destino, conteudo, "utf8");
  console.log(`Diagnóstico do computador gravado em ${path.relative(RAIZ, destino)}`);
}

/** Lê as últimas linhas de um arquivo, sem estourar se ele não existir. */
function lerFimDoArquivo(caminho, quantas) {
  try {
    return readFileSync(caminho, "utf8").trim().split("\n").slice(-quantas).join("\n");
  } catch {
    return "(ainda não existe nesta máquina)";
  }
}

function resumoFinal({ bancoOk, testes, caminhoRelatorio, enviado, inicio }) {
  const segundos = Math.round((Date.now() - inicio) / 1000);
  console.log("\n==================== RESUMO DA RODADA ====================");
  console.log(`Banco de dados ....... ${bancoOk ? "pronto" : "não subiu (veja os avisos acima)"}`);
  console.log(`Testes ............... ${testes.passou} passaram · ${testes.falhou} falharam · ${testes.pulados} pulados`);
  console.log(`Relatório ............ ${path.relative(RAIZ, caminhoRelatorio)}`);
  console.log(`Diagnóstico do PC .... reports/estado-do-computador.md`);
  console.log(`Enviado ao GitHub .... ${enviado ? "sim" : "não (tentará de novo na próxima)"}`);
  console.log(`Tempo total .......... ${segundos}s`);
  console.log("O app está subindo nas próximas linhas. Ctrl+C encerra.");
  console.log("Para opções avançadas: LiaGo.bat menu");
  console.log("==========================================================");
}

async function principal() {
  const comando = (process.argv[2] ?? "auto").toLowerCase();
  switch (comando) {
    case "tudo":
      return comandoTudo();
    case "auto":
      return comandoAuto();
    case "testes":
    case "test":
      return comandoTestes();
    case "banco":
      return subirBanco() ? 0 : 1;
    case "dev":
      return comandoDevParalelo();
    case "android":
      return comandoAndroid();
    case "sincronizar":
    case "sync":
      instalarDependencias();
      sincronizar(process.argv[3] ?? null);
      return 0;
    case "instalar": {
      verificarNode();
      banner();
      instalarDependencias(true);
      return 0;
    }
    case "relatorios": {
      const recentes = relatoriosRecentes();
      console.log(recentes.length === 0 ? "Nenhum relatório ainda. Rode: node tools/dev.mjs testes" : "Relatórios recentes:");
      for (const item of recentes) console.log(` - reports/${item.nome}`);
      return 0;
    }
    default:
      console.log("Comandos: tudo · auto · testes · banco · dev · android · sincronizar · instalar · relatorios");
      return 1;
  }
}

principal()
  .then((codigo) => process.exit(codigo ?? 0))
  .catch((erro) => {
    console.error(`\nERRO: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exit(1);
  });
