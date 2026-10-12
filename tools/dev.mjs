#!/usr/bin/env node
/**
 * tools/dev.mjs — orquestração do desenvolvimento do Lia Go.
 *
 * É o cérebro por trás do LiaGo.bat (Windows) e pode ser usado direto em qualquer sistema:
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
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR_RELATORIOS = path.join(RAIZ, "reports");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const NODE = process.platform === "win32" ? "node.exe" : "node";

function titulo(texto) {
  console.log(`\n=== ${texto} ===`);
}

function rodar(comando, args, opcoes = {}) {
  const resultado = spawnSync(comando, args, {
    cwd: opcoes.cwd ?? RAIZ,
    encoding: "utf8",
    shell: false,
    env: { ...process.env, ...(opcoes.env ?? {}) },
    stdio: opcoes.capturar ? "pipe" : "inherit",
  });
  return {
    status: resultado.status ?? 1,
    saida: `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`,
  };
}

function ocultarUrl(url) {
  return url ? url.replace(/:\/\/([^:/@]+):[^@/]+@/, "://$1:****@") : "(não definida)";
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

function dependenciasInstaladas() {
  return existsSync(path.join(RAIZ, "node_modules", "fastify")) && existsSync(path.join(RAIZ, "node_modules", "vite"));
}

function instalarDependencias() {
  if (dependenciasInstaladas()) {
    console.log("Dependências já instaladas (npm install será pulado).");
    return;
  }
  titulo("Instalando dependências (npm install)");
  const resultado = rodar(NPM, ["install"]);
  if (resultado.status !== 0) throw new Error("Falha no npm install. Verifique a conexão e tente novamente.");
}

function subirBanco() {
  titulo("Banco de dados");
  const resultado = rodar(NODE, [path.join(RAIZ, "tools", "db.mjs"), "up"]);
  if (resultado.status !== 0) {
    console.warn("Não foi possível subir o banco automaticamente.");
    console.warn("Se você tem Docker Desktop, abra-o e rode de novo. Sem banco, os testes de integração são pulados.");
    return false;
  }
  const migrar = rodar(NPM, ["run", "migrate"]);
  if (migrar.status !== 0) console.warn("A migração falhou; os testes de API podem ser pulados.");
  return true;
}

/** Checagem de tipos de todos os pacotes: nada entra no repositório sem passar por aqui. */
function rodarTipos() {
  titulo("Checagem de tipos (domain, api e mobile)");
  const resultado = rodar(NPM, ["run", "typecheck"], { capturar: true });
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
  const banco = process.env.DATABASE_URL ?? "(não definida — testes de API pulados)";
  const arquivosNaoRastreados = git.status ? git.status.split("\n").length : 0;

  const conteudo = [
    `# Relatório de execução — Lia Go`,
    ``,
    `- **Quando:** ${agora.toISOString()} (local ${agora.toLocaleString("pt-BR")})`,
    `- **Branch:** ${git.branch || "(destacada)"}`,
    `- **Último commit:** ${git.ultimo || "(nenhum)"}`,
    `- **Node:** ${versaoNode()} · **npm:** ${rodar(NPM, ["--version"], { capturar: true }).saida.trim()}`,
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
    `> Testes de integração são pulados quando não há banco disponível. Suba com \`npm run db:up\`.`,
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

function comandoTestes() {
  verificarNode();
  instalarDependencias();
  subirBanco();
  const resultado = rodarTestes();
  const caminho = gravarRelatorio(resultado);
  if (resultado.falhou > 0 || resultado.status !== 0) {
    console.error(`\nExistem ${resultado.falhou} teste(s) falhando. Corrija antes de sincronizar.`);
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
  instalarDependencias();
  subirBanco();
  titulo("Subindo API e app web (Ctrl+C encerra os dois)");
  console.log("API: http://localhost:3000 · App: http://localhost:5273");
  const api = spawnSync(NPM, ["run", "dev:api"], { cwd: RAIZ, stdio: "inherit" });
  return api.status ?? 1;
}

async function comandoDevParalelo() {
  verificarNode();
  instalarDependencias();
  subirBanco();
  titulo("Subindo API e app web juntos");
  const { spawn } = await import("node:child_process");
  const api = spawn(NPM, ["run", "dev:api"], { cwd: RAIZ, stdio: "inherit", shell: false });
  const web = spawn(NPM, ["run", "dev:web"], { cwd: RAIZ, stdio: "inherit", shell: false });
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

async function principal() {
  const comando = (process.argv[2] ?? "auto").toLowerCase();
  switch (comando) {
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
    case "relatorios": {
      const recentes = relatoriosRecentes();
      console.log(recentes.length === 0 ? "Nenhum relatório ainda. Rode: node tools/dev.mjs testes" : "Relatórios recentes:");
      for (const item of recentes) console.log(` - reports/${item.nome}`);
      return 0;
    }
    default:
      console.log("Comandos: auto · testes · banco · dev · android · sincronizar · relatorios");
      return 1;
  }
}

principal()
  .then((codigo) => process.exit(codigo ?? 0))
  .catch((erro) => {
    console.error(`\nERRO: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exit(1);
  });
