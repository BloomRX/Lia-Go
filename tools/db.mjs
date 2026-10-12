#!/usr/bin/env node
/**
 * tools/db.mjs — sobe/derruba o PostgreSQL local de desenvolvimento.
 *
 * Modos (nesta ordem de preferência):
 *  1. docker  — Docker Compose (padrão na máquina do desenvolvedor; decisão confirmada);
 *  2. local   — binários do PostgreSQL já instalados no sistema (PG_BIN ou PATH);
 *  3. pgserver— binários do PostgreSQL do pacote Python `pgserver` (usado no ambiente
 *               de testes automatizados, que não tem Docker);
 *  4. url     — não sobe nada: apenas valida a DATABASE_URL já definida.
 *
 * Sempre escreve `.env` na raiz quando o banco é iniciado (o .env é ignorado pelo Git).
 * Nunca apaga dados: `down` apenas para o serviço.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR_DADOS = path.join(RAIZ, ".pgdata");
const COMPOSE = path.join(RAIZ, "infra", "docker-compose.yml");
const PORTA = process.env.LIA_PG_PORTA ?? "55432";
const USUARIO = "lia_go";
const SENHA = "lia_go_local";
const BANCO = "lia_go";

function log(mensagem) {
  console.log(mensagem);
}

function tem(comando) {
  const resultado = spawnSync(comando, ["--version"], { stdio: "ignore" });
  return resultado.status === 0 || resultado.status === 1;
}

function dockerDisponivel() {
  const resultado = spawnSync("docker", ["info"], { stdio: "ignore" });
  return resultado.status === 0;
}

/** Descobre os binários do PostgreSQL do pacote Python pgserver, quando existirem. */
function binariosPgserver() {
  try {
    const saida = execFileSync("python3", [
      "-c",
      "import pgserver,os;print(os.path.join(os.path.dirname(pgserver.__file__),'pginstall','bin'))",
    ])
      .toString()
      .trim();
    if (saida && existsSync(path.join(saida, "initdb"))) return saida;
  } catch {
    // segue para a próxima tentativa
  }
  if (process.env.PG_BIN && existsSync(path.join(process.env.PG_BIN, "initdb"))) return process.env.PG_BIN;
  for (const candidato of ["/usr/lib/postgresql/17/bin", "/usr/lib/postgresql/16/bin", "/usr/local/pgsql/bin"]) {
    if (existsSync(path.join(candidato, "initdb"))) return candidato;
  }
  return null;
}

function iniciarComDocker() {
  log("Subindo PostgreSQL com Docker Compose (infra/docker-compose.yml)…");
  execFileSync("docker", ["compose", "-f", COMPOSE, "up", "-d"], { stdio: "inherit", cwd: RAIZ });
  log(`Aguardando o banco responder na porta ${PORTA}…`);
  for (let tentativa = 0; tentativa < 40; tentativa += 1) {
    const pronto = spawnSync("docker", ["exec", "lia-go-postgres", "pg_isready", "-U", USUARIO, "-d", BANCO], {
      stdio: "ignore",
    });
    if (pronto.status === 0) return;
    execFileSync("sleep", ["1"]);
  }
  throw new Error("O contêiner subiu, mas o PostgreSQL não respondeu a tempo.");
}

function iniciarComBinarios(bin) {
  if (!existsSync(path.join(DIR_DADOS, "PG_VERSION"))) {
    log(`Inicializando cluster local em ${path.relative(RAIZ, DIR_DADOS)} (fora do Git)…`);
    mkdirSync(DIR_DADOS, { recursive: true });
    execFileSync(path.join(bin, "initdb"), ["-D", DIR_DADOS, "-U", USUARIO, "--auth=trust", "--encoding=UTF8"], {
      stdio: "ignore",
    });
  }
  const emExecucao = spawnSync(path.join(bin, "pg_ctl"), ["-D", DIR_DADOS, "status"], { stdio: "ignore" });
  if (emExecucao.status !== 0) {
    log(`Iniciando PostgreSQL local na porta ${PORTA}…`);
    execFileSync(
      path.join(bin, "pg_ctl"),
      ["-D", DIR_DADOS, "-o", `-p ${PORTA} -c listen_addresses=127.0.0.1 -c unix_socket_directories=${DIR_DADOS}`, "-w", "-l", path.join(DIR_DADOS, "servidor.log"), "start"],
      { stdio: "inherit" },
    );
  }
  const psql = path.join(bin, "psql");
  const existe = spawnSync(psql, ["-h", "127.0.0.1", "-p", PORTA, "-U", USUARIO, "-d", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname='${BANCO}'`], {
    encoding: "utf8",
  });
  if ((existe.stdout ?? "").trim() !== "1") {
    execFileSync(path.join(bin, "createdb"), ["-h", "127.0.0.1", "-p", PORTA, "-U", USUARIO, BANCO], { stdio: "inherit" });
  }
}

function pararComDocker() {
  execFileSync("docker", ["compose", "-f", COMPOSE, "down"], { stdio: "inherit", cwd: RAIZ });
}

function pararComBinarios(bin) {
  const emExecucao = spawnSync(path.join(bin, "pg_ctl"), ["-D", DIR_DADOS, "status"], { stdio: "ignore" });
  if (emExecucao.status === 0) {
    execFileSync(path.join(bin, "pg_ctl"), ["-D", DIR_DADOS, "-m", "fast", "stop"], { stdio: "inherit" });
  } else {
    log("O cluster local não estava em execução.");
  }
}

function escreverEnv(url) {
  const destino = path.join(RAIZ, ".env");
  const linhas = [
    "# Gerado por tools/db.mjs — arquivo local, ignorado pelo Git.",
    `DATABASE_URL=${url}`,
    `TEST_DATABASE_URL=${url}`,
    "HOST=0.0.0.0",
    "PORT=3000",
    "",
  ];
  writeFileSync(destino, linhas.join("\n"), "utf8");
  log(`Configuração local escrita em .env (DATABASE_URL=${url.replace(/:[^:@/]+@/, ":****@")}).`);
}

function urlLocal() {
  return `postgres://${USUARIO}:${SENHA}@127.0.0.1:${PORTA}/${BANCO}`;
}

function urlBinarios() {
  return `postgres://${USUARIO}@127.0.0.1:${PORTA}/${BANCO}`;
}

async function principal() {
  const comando = process.argv[2] ?? "up";
  const modoForcado = process.env.LIA_DB_MODO;
  const temDocker = dockerDisponivel();
  const bin = binariosPgserver();

  if (comando === "url") {
    log(process.env.DATABASE_URL ?? (temDocker ? urlLocal() : bin ? urlBinarios() : ""));
    return;
  }
  if (comando === "status") {
    log(temDocker ? "Docker: disponível" : "Docker: indisponível neste ambiente");
    log(bin ? `Binários PostgreSQL: ${bin}` : "Binários PostgreSQL: não encontrados");
    log(`DATABASE_URL atual: ${process.env.DATABASE_URL ?? "(não definida)"}`);
    if (existsSync(path.join(RAIZ, ".env"))) log("Arquivo .env: presente (ignorado pelo Git)");
    return;
  }
  if (comando === "up") {
    if (modoForcado === "url" || (!temDocker && !bin)) {
      if (!process.env.DATABASE_URL) {
        throw new Error(
          "Nenhum PostgreSQL disponível: instale o Docker Desktop (recomendado) ou defina DATABASE_URL para um banco existente.",
        );
      }
      log("Usando a DATABASE_URL já definida.");
      escreverEnv(process.env.DATABASE_URL);
      return;
    }
    if (temDocker && modoForcado !== "binarios") {
      iniciarComDocker();
      escreverEnv(urlLocal());
    } else {
      iniciarComBinarios(bin);
      log("Aviso: modo binário local (sem Docker). Use apenas para desenvolvimento/testes com dados sintéticos.");
      escreverEnv(urlBinarios());
    }
    return;
  }
  if (comando === "down") {
    if (temDocker && modoForcado !== "binarios") pararComDocker();
    else if (bin) pararComBinarios(bin);
    else log("Nada para parar neste ambiente.");
    return;
  }
  throw new Error(`Comando desconhecido: ${comando}. Use up, down, status ou url.`);
}

principal().catch((erro) => {
  console.error(`db.mjs: ${erro instanceof Error ? erro.message : String(erro)}`);
  process.exit(1);
});

void readFileSync;
