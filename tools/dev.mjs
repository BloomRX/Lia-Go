#!/usr/bin/env node
/**
 * tools/dev.mjs — orquestração do desenvolvimento do Lia Go.
 *
 * É o cérebro por trás do LiaGo.bat (Windows) e pode ser usado direto em qualquer sistema:
 *   node tools/dev.mjs tudo         → UMA tecla: atualiza, prepara, testa, relata, envia e deixa o app no ar
 *   node tools/dev.mjs atualizar    → traz a versão mais nova do GitHub (sem perder trabalho local)
 *   node tools/dev.mjs auto         → banco + migrações + testes + relatório + sincronização
 *   node tools/dev.mjs testes       → roda a suíte completa e grava relatório
 *   node tools/dev.mjs banco        → sobe o PostgreSQL local e aplica migrações
 *   node tools/dev.mjs dev          → sobe a API e o app web juntos
 *   node tools/dev.mjs android      → prepara a build Android (exige Android SDK/JDK 21)
 *   node tools/dev.mjs sincronizar  → commit + rebase + push da branch de trabalho (via DevKit)
 *
 * Nunca publica nada em nome de ninguém, nunca faz push em branch protegida e nunca
 * imprime segredo: a DATABASE_URL é sempre exibida com a senha oculta.
 *
 * ⚠️ Etapas que deixam processos vivos (o servidor do banco, por exemplo) devem usar saída herdada,
 * nunca "cano" (`stdio: "pipe"`): o processo que continua rodando herda o cano, o Node fica preso e a
 * rodada nunca termina — mesmo com todo o trabalho pronto. Ver `rodarHerdandoSaida` em `dev-util.mjs`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  abriuPromptDoWindows,
  candidatosDePython,
  classificarAlteracoesLocais,
  decidirAtualizacao,
  escolherAlvoDeAtualizacao,
  explicarEnvioQueFalhou,
  descreverDuracao,
  explicarLogDoServidor,
  tempoDecorrido,
  temConflitoNoStatus,
  caminhoDoLogDoNpm,
  diagnosticarComLog,
  diagnosticarFalhaNpm,
  erroDeSpawn,
  lerEnvDoTexto,
  montarComando,
  montarDiagnostico,
  ocultarUrl,
  rodarComSaidaAoVivo,
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

/** Em qual etapa da rodada automática estamos (usado para numerar os títulos). */
let ETAPA = { indice: 0, total: 0 };
function definirEtapa(indice, total) {
  ETAPA = { indice, total };
}

/**
 * Como `rodar()`, mas mostrando a saída conforme ela sai e avisando quando o processo fica quieto.
 * É o que evita a impressão de "travou" nas etapas demoradas (npm install, npm test).
 */
async function rodarAoVivo(comando, args, opcoes = {}) {
  const chamada = montarComando(comando, args);
  return await rodarComSaidaAoVivo(chamada.comando, chamada.args, {
    cwd: opcoes.cwd ?? RAIZ,
    shell: chamada.shell,
    legenda: opcoes.legenda,
    limiteMs: opcoes.limiteMs,
  });
}

function titulo(texto) {
  const numero = ETAPA.total > 0 ? `[${ETAPA.indice}/${ETAPA.total}] ` : "";
  console.log(`\n=== ${numero}${texto} ===`);
}

function rodar(comando, args, opcoes = {}) {
  const chamada = montarComando(comando, args);
  const resultado = spawnSync(chamada.comando, chamada.args, {
    cwd: opcoes.cwd ?? RAIZ,
    encoding: "utf8",
    shell: chamada.shell,
    env: { ...process.env, ...(opcoes.env ?? {}) },
    stdio: opcoes.capturar ? "pipe" : "inherit",
    // Limite de tempo: nenhuma etapa pode prender a rodada para sempre (a tela avisa se estourar).
    timeout: opcoes.timeout,
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
/** Teto de tempo para a etapa do banco (primeira criação no Windows pode ser lenta). */
const LIMITE_BANCO_MS = Number(process.env.LIA_LIMITE_BANCO_MS ?? 0) || 15 * 60 * 1000;
/** Tetos das outras etapas longas: instalar dependências e rodar a suíte. */
const LIMITE_INSTALL_MS = Number(process.env.LIA_LIMITE_INSTALL_MS ?? 0) || 10 * 60 * 1000;
const LIMITE_TESTES_MS = Number(process.env.LIA_LIMITE_TESTES_MS ?? 0) || 15 * 60 * 1000;

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

async function instalarDependencias(forcar = false) {
  titulo(forcar ? "Reinstalando dependências (npm install)" : "Dependências (npm install)");
  if (!forcar && dependenciasInstaladas()) {
    console.log("Já estão instaladas — nada a baixar agora.");
    return;
  }
  const registro = rodar(NPM, ["config", "get", "registry"], { capturar: true });
  const urlRegistro = registro.status === 0 ? registro.saida.trim() : "(não foi possível perguntar ao npm)";
  console.log(`Baixando pacotes de: ${urlRegistro}`);

  console.log(`⏳ Baixando pacotes do npm a partir de ${urlRegistro}. A saída aparece conforme chega (costuma levar de 10 a 60 segundos; na primeira vez, mais).`);
  const inicioInstall = Date.now();
  const primeira = await rodarAoVivo(NPM, ["install"], { legenda: "instalando dependências", limiteMs: LIMITE_INSTALL_MS });
  if (primeira.status === 0) {
    console.log(primeira.saida.trim());
    conferirInstalacaoReal("npm install", primeira);
    console.log(`Dependências instaladas em ${tempoDecorrido(inicioInstall)}.`);
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
    const limpa = await rodarAoVivo(NPM, ["install", "--no-audit", "--no-fund"], {
      legenda: "instalando dependências",
      limiteMs: LIMITE_INSTALL_MS,
    });
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
  const segunda = await rodarAoVivo(
    NPM,
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--fetch-retries=2",
      "--fetch-retry-maxtimeout=30000",
      "--fetch-timeout=60000",
    ],
    { legenda: "instalando dependências (2ª tentativa)", limiteMs: LIMITE_INSTALL_MS },
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
  const inicio = Date.now();
  // Sem capturar a saída: o que o banco escreve (download com barra, criação, tempos) aparece NA HORA.
  const resultado = rodar(NODE, [path.join(RAIZ, "tools", "db.mjs"), "up"], { timeout: LIMITE_BANCO_MS });
  if (resultado.error?.code === "ETIMEDOUT") {
    console.warn(`\nO banco demorou mais de ${descreverDuracao(LIMITE_BANCO_MS)} e eu interrompi,`);
    console.warn("para você não ficar esperando sem saber. O que já foi baixado está guardado.");
    console.warn("Rode de novo (pode ser só falta de memória ou o antivírus atrapalhando na primeira vez).");
    registrarAviso(`A etapa do banco passou de ${descreverDuracao(LIMITE_BANCO_MS)} e foi interrompida.`);
    return false;
  }
  if (resultado.status !== 0) {
    if (erroDeSpawn(resultado)) console.warn(erroDeSpawn(resultado));
    console.warn("Não foi possível subir o banco automaticamente (o motivo está nas linhas acima).");
    console.warn("Sem Docker, o Lia Go instala um PostgreSQL embutido sozinho — para isso precisa do Python 3 (python.org).");
    console.warn("Rode a opção 4 do LiaGo.bat para tentar de novo.");
    console.warn("Sem banco, os testes de integração são PULADOS com aviso — não é sucesso.");
    return false;
  }
  console.log(`Banco pronto em ${tempoDecorrido(inicio)}.`);
  const migrar = rodar(NPM, ["run", "migrate"]);
  if (migrar.status !== 0) console.warn("A migração falhou; os testes de API podem ser pulados.");
  return true;
}

/** Checagem de tipos de todos os pacotes: nada entra no repositório sem passar por aqui. */
function rodarTipos() {
  titulo("Checagem de tipos (domain, api e mobile)");
  console.log("⏳ Conferindo os tipos dos quatro pacotes (uns 20 a 40 segundos)…");
  const resultado = rodar(NPM, ["run", "typecheck"], { capturar: true });
  if (abriuPromptDoWindows(resultado.saida)) {
    console.error("O Windows abriu um prompt no lugar de rodar o npm — os tipos NÃO foram conferidos.");
    return { status: 1, saida: resultado.saida };
  }
  if (resultado.status !== 0) console.error(resultado.saida.trim() || "(tsc não explicou o motivo)");
  else console.log("Tipos conferidos sem erro.");
  return { status: resultado.status, saida: resultado.saida };
}

async function rodarTestes() {
  const tipos = rodarTipos();
  titulo("Testes (domínio + API)");
  console.log("⏳ Rodando a suíte completa (a saída aparece abaixo, teste por teste; costuma levar cerca de 30 segundos).");
  const inicio = Date.now();
  const resultado = await rodarAoVivo(NPM, ["test"], { legenda: "rodando os testes", limiteMs: LIMITE_TESTES_MS });
  const saida = resultado.saida;
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
  console.log(`Suíte concluída em ${tempoDecorrido(inicio)}.`);
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

/** Arquivos com alterações locais (inclui novos), no formato de caminho puro. */
function caminhosAlterados() {
  return rodar("git", ["status", "--porcelain"], { capturar: true })
    .saida.trim()
    .split("\n")
    .filter(Boolean)
    .map((linha) => {
      const corpo = linha.slice(3).trim();
      const caminho = corpo.includes(" -> ") ? corpo.split(" -> ").pop() : corpo;
      return caminho.replace(/^"|"$/g, "");
    });
}

function branchAtual() {
  return rodar("git", ["branch", "--show-current"], { capturar: true }).saida.trim();
}

/** Garante que o trabalho não vai para a branch protegida: cria/muda para uma branch de trabalho. */
/**
 * Qual é a branch "oficial" do projeto no GitHub (a que o repositório aponta como principal)?
 * Serve para reconectar uma cópia que ficou sem branch, em vez de criar uma branch nova e perdida.
 */
function branchPrincipalDoRemoto() {
  const simbolico = rodar("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { capturar: true }).saida.trim();
  if (simbolico.startsWith("origin/")) return simbolico.slice("origin/".length);
  // Sem origin/HEAD: usa a branch local que já segue algo do GitHub, se houver exatamente uma.
  const linhas = rodar("git", ["for-each-ref", "--format=%(refname:short) %(upstream:short)", "refs/heads"], { capturar: true })
    .saida.trim()
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => / origin\/\S+$/.test(linha));
  if (linhas.length === 1) return linhas[0].split(" ")[0];
  return "";
}

function garantirBranchDeTrabalho() {
  const atual = branchAtual();
  if (atual && atual !== "main" && atual !== "master") return atual;

  // Cópia sem branch ("HEAD solto"): reconecta na branch de verdade antes de qualquer outra coisa.
  // Sem isso, uma rodada criava uma branch nova que não existe no GitHub e nunca baixava novidades.
  if (!atual) {
    const alvo = branchPrincipalDoRemoto();
    if (alvo) {
      const existeLocal =
        rodar("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${alvo}`], { capturar: true }).status === 0;
      if (existeLocal) {
        titulo(`Sua cópia estava sem branch; voltando para a branch de trabalho "${alvo}"`);
        if (rodar("git", ["checkout", alvo], { capturar: true }).status === 0) return alvo;
      } else if (rodar("git", ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${alvo}`], { capturar: true }).status === 0) {
        titulo(`Sua cópia estava sem branch; criando "${alvo}" a partir do GitHub`);
        if (rodar("git", ["checkout", "-B", alvo, `origin/${alvo}`], { capturar: true }).status === 0) return alvo;
      }
    }
  }

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
  const jaEstavaEmConflito = temConflitoPendente();
  const resultado = rodar(python, args);
  if (resultado.status !== 0) {
    tratarConflitoDeSincronizacao(jaEstavaEmConflito);
    throw new Error("A sincronização não terminou. Nada foi forçado; confira o que o DevKit informou acima.");
  }
}

/** Monta a chamada de `npm run <script>` já no formato certo para o sistema (Windows precisa de shell). */
function comandoComoArgumentos(script) {
  const chamada = montarComando(NPM, ["run", script]);
  return [chamada.comando, chamada.args, { cwd: RAIZ, stdio: "inherit", shell: chamada.shell }];
}

async function comandoTestes() {
  verificarNode();
  banner();
  await instalarDependencias();
  subirBanco();
  const resultado = await rodarTestes();
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

async function comandoAuto() {
  const codigo = await comandoTestes();
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
  await instalarDependencias();
  subirBanco();
  titulo("Subindo API e app web juntos");
  await subirServidores();
}

/** Alguma coisa já está respondendo neste endereço? (app de uma rodada anterior, por exemplo) */
async function jaEstaNoAr(url) {
  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return resposta.ok;
  } catch {
    return false;
  }
}

/** Sobe a API e o app web e fica vigiando: se algum cair, a tela explica. */
async function subirServidores() {
  // Duplo clique com o app já aberto de uma rodada anterior: avisar é melhor do que dar erro de porta.
  if (await jaEstaNoAr("http://127.0.0.1:5273/")) {
    console.log("\nO app já está no ar de uma rodada anterior — não vou subir outro.");
    console.log("Abra no navegador: http://localhost:5273  (API em http://localhost:3000)");
    console.log("Para encerrar o que está rodando, feche aquela janela do Lia Go.");
    return;
  }
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

async function comandoAndroid() {
  titulo("Build Android (exige Android Studio + JDK 21 + SDK 36)");
  await instalarDependencias();
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
  const TOTAL_DE_ETAPAS = 7;
  console.log("=== Lia Go: rodada automática (não precisa escolher nada) ===");
  console.log("São 7 etapas; cada uma se anuncia abaixo. Na primeira vez, a etapa 3 baixa o banco (~12 MB).");

  definirEtapa(1, TOTAL_DE_ETAPAS);
  const atualizacao = atualizarDoGitHub();
  // Um programa em execução não troca o próprio código: se veio versão nova, a rodada recomeça
  // com ela. Sem isso, a correção baixada só valeria na próxima vez — foi o que aconteceu.
  if (atualizacao.atualizou && !process.env.LIA_REINICIADO) {
    console.log("\nO projeto foi atualizado. Vou reiniciar a rodada agora para usar a versão nova (uns segundos).");
    const reinicio = spawnSync(NODE, [path.join(RAIZ, "tools", "dev.mjs"), "tudo"], {
      cwd: RAIZ,
      stdio: "inherit",
      env: { ...process.env, LIA_REINICIADO: "1" },
    });
    return reinicio.status ?? 0;
  }
  if (atualizacao.atualizou) {
    console.log("Atenção: o projeto mudou de novo no meio da rodada; a próxima rodada já usa o que chegou agora.");
  }
  verificarNode();
  banner();

  definirEtapa(2, TOTAL_DE_ETAPAS);
  await instalarDependencias();

  definirEtapa(3, TOTAL_DE_ETAPAS);
  const bancoOk = subirBanco();

  definirEtapa(4, TOTAL_DE_ETAPAS);
  const testes = await rodarTestes();

  definirEtapa(5, TOTAL_DE_ETAPAS);
  titulo("Relatórios (rodada + diagnóstico do computador)");
  const caminhoRelatorio = gravarRelatorio(testes);
  gravarDiagnostico(bancoOk, testes);

  definirEtapa(6, TOTAL_DE_ETAPAS);
  const enviado = enviarParaOGitHub();

  definirEtapa(7, TOTAL_DE_ETAPAS);
  titulo("Resumo da rodada e subida do app");
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
  const antes = rodar("git", ["rev-parse", "HEAD"], { capturar: true }).saida.trim();
  console.log(`Branch: ${nome || "(destacada)"} · versão local: ${antes.slice(0, 7) || "(desconhecida)"}`);

  console.log("⏳ Falando com o GitHub (uns segundos)…");
  const inicio = Date.now();
  const busca = rodar("git", ["fetch", "origin"], { capturar: true });
  if (busca.status !== 0) {
    registrarAviso("Não consegui falar com o GitHub para baixar novidades nesta rodada.");
    console.warn("Não consegui falar com o GitHub agora; sigo com a versão que já existe aqui.");
    console.warn(resumoSaida(busca.saida, 4));
    console.warn("Se for internet ou login do GitHub, resolva e rode de novo para pegar as novidades.");
    return { atualizou: false };
  }
  console.log(`Resposta do GitHub em ${tempoDecorrido(inicio)}.`);

  // Qual referência seguir (a da branch, ou origin/<branch>), e se ela existe.
  const upstream = rodar("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], { capturar: true }).saida.trim();
  const upstreamExiste =
    upstream.length > 0 && rodar("git", ["rev-parse", "--verify", "--quiet", upstream], { capturar: true }).status === 0;
  const branchExisteNoRemoto =
    nome.length > 0 && rodar("git", ["rev-parse", "--verify", "--quiet", `origin/${nome}`], { capturar: true }).status === 0;
  const alvo = escolherAlvoDeAtualizacao({ upstream, upstreamExiste, branchExisteNoRemoto, branch: nome });
  const commitsNovos = alvo
    ? Number(rodar("git", ["rev-list", "--count", `HEAD..${alvo}`], { capturar: true }).saida.trim() || "0")
    : 0;
  const commitsLocais = alvo
    ? Number(rodar("git", ["rev-list", "--count", `${alvo}..HEAD`], { capturar: true }).saida.trim() || "0")
    : 0;
  const caminhosLocais = caminhosAlterados();
  const caminhosVindos = alvo
    ? rodar("git", ["diff", "--name-only", `HEAD..${alvo}`], { capturar: true })
        .saida.trim()
        .split("\n")
        .filter(Boolean)
    : [];
  const alteracoes = {
    tem: caminhosLocais.length > 0,
    ...classificarAlteracoesLocais({ caminhosLocais, caminhosQueChegam: caminhosVindos }),
  };
  const decisao = decidirAtualizacao({ alvo, commitsNovos, commitsLocais, alteracoes });

  if (decisao.acao === "sem-referencia") {
    console.log("Esta branch ainda não existe no GitHub, então não há versão nova para baixar.");
    return { atualizou: false };
  }
  if (decisao.acao === "atualizado") {
    console.log(`Já está na versão mais nova do GitHub (${alvo}).`);
    return { atualizou: false };
  }
  if (decisao.acao === "guardar-trabalho-e-atualizar") {
    // A rodada já commita o trabalho no fim; fazer isso ANTES de atualizar evita travar o atualizador
    // e, principalmente, não descarta nada (era o que o antigo stash + reset fazia de errado).
    console.log("Existem alterações aqui; vou guardá-las num commit antes de atualizar (nada é descartado)…");
    rodar("git", ["add", "-A"], { capturar: true });
    const guardou = rodar("git", ["commit", "-m", "chore: guarda o trabalho local antes de atualizar (LiaGo.bat)"], {
      capturar: true,
    });
    if (guardou.status === 0) {
      console.log("Trabalho guardado no histórico; sigo com a atualização.");
    } else {
      console.warn("Não consegui guardar automaticamente (o git pediu configuração de nome/e-mail?). Nada foi alterado.");
      console.warn(resumoSaida(guardou.saida, 4));
      console.warn("Resolva de um destes jeitos e rode de novo:");
      console.warn('  1) git config user.name "Seu Nome" && git config user.email "voce@exemplo.com"');
      console.warn("  2) ou commite na mão: git add -A && git commit -m \"meu trabalho\"");
      registrarAviso("A atualização foi adiada: não consegui guardar as alterações locais em um commit (nada foi descartado).");
      return { atualizou: false, adiada: true };
    }
  }
  if (decisao.acao === "pular-por-seguranca") {
    const lista = alteracoes.sobrepostos.slice(0, 6).join(", ");
    console.warn(
      `\nExistem ${commitsNovos} commit(s) novo(s) no GitHub, mas eu NÃO atualizei para não misturar o seu trabalho.`,
    );
    console.warn(alteracoes.sobrepostos.length > 0
      ? `Você tem alterações não commitadas em arquivo(s) que o GitHub também mudou: ${lista}.`
      : "Você tem alterações não commitadas e também commits seus; o git não deixa reaplicar assim.");
    console.warn("Nada foi alterado. Escolha uma destas e rode de novo:");
    console.warn("  1) guardar o que você fez: git add -A && git commit -m \"meu trabalho\"");
    console.warn(`  2) desfazer as suas mudanças nesses arquivos: git checkout -- ${lista || "<arquivo>"}`);
    registrarAviso(
      "A atualização foi adiada: existem alterações locais que colidem com o que chegou do GitHub (nada foi descartado).",
    );
    return { atualizou: false, adiada: true };
  }
  if (decisao.acao === "restaurar-gerados-e-atualizar") {
    console.log("Os relatórios antigos destas rodadas serão substituídos pelos do GitHub (são gerados de novo a cada vez)…");
    for (const caminho of alteracoes.sobrepostos) {
      const rastreado = rodar("git", ["ls-files", "--error-unmatch", caminho], { capturar: true }).status === 0;
      if (rastreado) rodar("git", ["checkout", "--", caminho], { capturar: true });
      else rmSync(path.join(RAIZ, caminho), { force: true });
    }
  }
  console.log(
    `Existem ${commitsNovos} commit(s) novo(s) no GitHub${commitsLocais > 0 ? ` e ${commitsLocais} seu(s) aqui — vou preservar o seu trabalho` : ""}.`,
  );

  const alteracoesAgora = caminhosAlterados().length > 0;
  let aplicou = rodar("git", ["merge", "--ff-only", alvo], { capturar: true });
  if (aplicou.status !== 0 && !alteracoesAgora) {
    console.log("Reaplicando os seus commits por cima da versão nova (rebase)…");
    aplicou = rodar("git", ["rebase", alvo], { capturar: true });
    if (aplicou.status !== 0) {
      rodar("git", ["rebase", "--abort"], { capturar: true });
      console.warn("\nO seu trabalho e o do GitHub mexem no mesmo trecho de um arquivo (conflito de verdade).");
      console.warn("O seu trabalho está guardado num commit, a cópia está limpa e NADA foi perdido.");
      console.warn(`Para juntar as duas partes quando quiser: git pull --rebase ${alvo}`);
      console.warn("(o git vai marcar os trechos; escolha o que fica e rode git rebase --continue).");
      registrarAviso(
        "A atualização foi adiada por conflito real no mesmo trecho de um arquivo. O trabalho local foi guardado em commit e a cópia ficou limpa.",
      );
      return { atualizou: false, adiada: true };
    }
  }
  if (aplicou.status !== 0) {
    console.warn(resumoSaida(aplicou.saida, 6));
    console.warn(`Não consegui atualizar automaticamente. Nada foi alterado. Para resolver na mão: git pull --rebase ${alvo}`);
    registrarAviso("A atualização automática não foi aplicada; sigo com a versão local e o usuário foi avisado.");
    return { atualizou: false };
  }

  const depois = rodar("git", ["rev-parse", "HEAD"], { capturar: true }).saida.trim();
  const mudou = depois !== antes;
  if (mudou) {
    const resumo = rodar("git", ["log", "--oneline", `${antes}..${depois}`], { capturar: true }).saida.trim();
    console.log(`Atualizado: ${antes.slice(0, 7)} → ${depois.slice(0, 7)}`);
    if (resumo) console.log(`Novidades:\n${resumo.split("\n").slice(0, 8).join("\n")}`);
  } else {
    console.log("Nada mudou nesta atualização.");
  }
  return { atualizou: mudou };
}


/**
 * A sincronização parou no meio de um conflito (o seu trabalho e o do GitHub no mesmo arquivo).
 * Num fluxo de um clique isso não pode ficar assim: a próxima rodada nem abriria. Desfazemos só
 * essa parte — o commit local continua intacto — e explicamos com todas as letras.
 */
function tratarConflitoDeSincronizacao(jaEstavaEmConflito) {
  if (jaEstavaEmConflito) return false;
  if (!temConflitoPendente()) return false;
  console.warn("O envio parou porque o seu trabalho e o do GitHub mexem no mesmo trecho de um arquivo.");
  console.warn("Desfazendo essa parte para deixar o projeto num estado seguro (nada seu é perdido)…");
  const desfeito = rodar("git", ["rebase", "--abort"], { capturar: true });
  if (desfeito.status !== 0) rodar("git", ["merge", "--abort"], { capturar: true });
  if (temConflitoPendente()) {
    console.warn("Não consegui desfazer sozinho. Rode: git rebase --abort — e depois o LiaGo.bat de novo.");
    registrarAviso("A cópia ficou no meio de um conflito; é preciso resolver antes de continuar.");
    return false;
  }
  console.warn("Pronto: o projeto voltou ao normal e o seu commit continua aqui.");
  console.warn("Na próxima rodada eu tento enviar de novo; para resolver na mão: git pull --rebase (e depois git push).");
  registrarAviso("O envio parou porque o seu trabalho e o do GitHub tocavam o mesmo arquivo; a cópia foi devolvida ao estado seguro.");
  return true;
}

/** Existe conflito pendente na cópia (rebase/merge pela metade)? */
function temConflitoPendente() {
  return temConflitoNoStatus(rodar("git", ["status", "--porcelain"], { capturar: true }).saida);
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

/** Só a atualização, com explicação do que aconteceu (usada quando algo deu errado antes). */
function comandoAtualizar() {
  const resultado = atualizarDoGitHub();
  if (resultado.atualizou) {
    console.log("\nAtualizado. Rode o LiaGo.bat (duplo clique) para a rodada completa com a versão nova.");
    return 0;
  }
  if (resultado.adiada) {
    console.log("\nA atualização ficou adiada para não mexer no seu trabalho.");
    console.log("Resolva as alterações listadas acima (guardar com git commit ou desfazer com git checkout --) e rode de novo.");
    return 0;
  }
  console.log("\nProjeto já está na versão mais nova do GitHub.");
  return 0;
}

async function principal() {
  const comando = (process.argv[2] ?? "auto").toLowerCase();
  switch (comando) {
    case "tudo":
      return comandoTudo();
    case "atualizar":
    case "pull":
      return comandoAtualizar();
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
      await instalarDependencias();
      sincronizar(process.argv[3] ?? null);
      return 0;
    case "instalar": {
      verificarNode();
      banner();
      await instalarDependencias(true);
      return 0;
    }
    case "relatorios": {
      const recentes = relatoriosRecentes();
      console.log(recentes.length === 0 ? "Nenhum relatório ainda. Rode: node tools/dev.mjs testes" : "Relatórios recentes:");
      for (const item of recentes) console.log(` - reports/${item.nome}`);
      return 0;
    }
    default:
      console.log("Comandos: tudo · atualizar · auto · testes · banco · dev · android · sincronizar · instalar · relatorios");
      return 1;
  }
}

principal()
  .then((codigo) => process.exit(codigo ?? 0))
  .catch((erro) => {
    console.error(`\nERRO: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exit(1);
  });
