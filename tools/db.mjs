#!/usr/bin/env node
/**
 * tools/db.mjs — sobe/derruba o PostgreSQL local de desenvolvimento.
 *
 * Modos (nesta ordem de preferência):
 *  1. docker  — Docker Compose (padrão na máquina do desenvolvedor; decisão confirmada);
 *  2. local   — binários do PostgreSQL já instalados no sistema (PG_BIN, PATH ou pastas padrão);
 *  3. binarios— idem, com os binários do pacote Python `pgserver` (PostgreSQL embutido);
 *  4. pgserver— instala o pacote Python `pgserver` sozinho e usa o PostgreSQL embutido
 *               (é o caminho sem Docker e sem administrador — importante no Windows);
 *  5. url     — não sobe nada: apenas valida a DATABASE_URL já definida.
 *
 * Comandos: up · down · status · url · instalar
 * `LIA_DB_MODO=binarios|pgserver|url` força um modo (usado nos testes automatizados).
 *
 * Sempre escreve `.env` na raiz quando o banco é iniciado (o .env é ignorado pelo Git).
 * Nunca apaga dados: `down` apenas para o serviço.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { candidatosDePython, PYTHON_MAX, PYTHON_MIN, versaoCompativel } from "./dev-util.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR_DADOS = path.join(RAIZ, ".pgdata");
const COMPOSE = path.join(RAIZ, "infra", "docker-compose.yml");
const PORTA = process.env.LIA_PG_PORTA ?? "55432";
const USUARIO = "lia_go";
const SENHA = "lia_go_local";
const BANCO = "lia_go";
const EXE = process.platform === "win32" ? ".exe" : "";

/** Caminho de um programa do PostgreSQL (no Windows todo programa termina em `.exe`). */
function exe(bin, nome) {
  return path.join(bin, nome + EXE);
}

/** Variáveis que fazem os binários achar os próprios arquivos, mesmo fora do PATH. */
function ambienteDoBin(bin) {
  const ambiente = { ...process.env, PG_BIN: bin };
  const share = path.join(path.dirname(bin), "share");
  if (existsSync(share)) ambiente.PGSHAREDIR = share;
  return ambiente;
}

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

/**
 * Todos os Python utilizáveis da máquina, na ordem de preferência.
 * No Windows o nome é `py` (launcher oficial) ou `python` — `python3` normalmente não existe lá.
 */
function pythonsDisponiveis() {
  const achados = [];
  for (const [programa, prefixo] of candidatosDePython()) {
    const teste = spawnSync(programa, [...prefixo, "-c", "import sys;print('%d.%d' % sys.version_info[:2])"], {
      encoding: "utf8",
    });
    const versao = (teste.stdout ?? "").trim();
    if (teste.status === 0 && /^\d+\.\d+$/.test(versao)) {
      achados.push({ programa, prefixo, versao, compativel: versaoCompativel(versao) });
    }
  }
  // `py -3` e `python` podem apontar para o mesmo interpretador: mostra uma vez só.
  return achados.filter((python, indice) => achados.findIndex((outro) => outro.versao === python.versao) === indice);
}

/** Python preferido para o banco embutido (um com binários publicados, se existir). */
function pythonParaBanco() {
  const todos = pythonsDisponiveis();
  return todos.find((python) => python.compativel) ?? todos[0] ?? null;
}

/** Pastas onde o PostgreSQL costuma estar instalado no Windows (inclui versões instaladas pelo EDB). */
function candidatosWindows() {
  const raizes = [
    "C:\\Program Files\\PostgreSQL",
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs", "PostgreSQL") : null,
  ].filter(Boolean);
  const pastas = [];
  for (const raiz of raizes) {
    if (!existsSync(raiz)) continue;
    try {
      for (const versao of readdirSync(raiz)) pastas.push(path.join(raiz, versao, "bin"));
    } catch {
      // sem permissão para listar: ignora esta raiz
    }
  }
  return pastas.sort().reverse(); // 17 antes de 16 antes de 15
}

/**
 * Descobre os binários do PostgreSQL instalados na máquina:
 * `PG_BIN` → pacote Python `pgserver` (embutido) → pastas padrão do sistema.
 */
function binariosPgserver() {
  if (process.env.PG_BIN && existsSync(path.join(process.env.PG_BIN, "initdb" + EXE))) {
    return process.env.PG_BIN;
  }
  for (const python of pythonsDisponiveis()) {
    try {
      const codigo =
        "import pgserver,os;print(os.path.join(os.path.dirname(pgserver.__file__),'pginstall','bin'))";
      // stderr fica escondido: é só uma sondagem (o pacote pode nem existir) e alguns Linux
      // imprimem avisos inofensivos de ambiente que só poluiriam a tela.
      const saida = execFileSync(python.programa, [...python.prefixo, "-c", codigo], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (saida && existsSync(path.join(saida, "initdb" + EXE))) return saida;
    } catch {
      // pgserver não instalado: segue para as pastas do sistema
    }
  }
  const pastas =
    process.platform === "win32"
      ? candidatosWindows()
      : ["/usr/lib/postgresql/17/bin", "/usr/lib/postgresql/16/bin", "/usr/local/pgsql/bin"];
  for (const candidato of pastas) {
    if (existsSync(path.join(candidato, "initdb" + EXE))) return candidato;
  }
  return null;
}

/**
 * Instala o PostgreSQL embutido (pacote Python `pgserver`) na conta do usuário.
 * É o caminho que não exige Docker Desktop nem administrador — decisivo no Windows.
 */
function instalarPgserver(python) {
  if (!python) {
    throw new Error(
      "Não encontrei o Python para instalar o PostgreSQL embutido. Instale o Python 3 (https://www.python.org/downloads/) e rode de novo, ou abra o Docker Desktop.",
    );
  }
  const temPip = spawnSync(python.programa, [...python.prefixo, "-m", "pip", "--version"], { encoding: "utf8" });
  if (temPip.status !== 0) {
    throw new Error(
      "O Python encontrado não tem o pip disponível. Reinstale o Python marcando a opção \"pip\" (ou use o Docker Desktop).",
    );
  }
  log("Instalando o PostgreSQL embutido (pacote pgserver) na sua conta — sem Docker e sem administrador…");
  const argumentos = [...python.prefixo, "-m", "pip", "install", "--user", "--disable-pip-version-check", "pgserver"];
  const primeira = spawnSync(python.programa, argumentos, { encoding: "utf8" });
  if (primeira.status !== 0) {
    const texto = `${primeira.stdout ?? ""}${primeira.stderr ?? ""}`;
    // No Ubuntu/Debian o Python do sistema é "externally managed" (PEP 668) e exige a flag abaixo.
    if (/externally-managed-environment|PEP 668/i.test(texto)) {
      log("O Python do sistema pede uma permissão extra; repetindo com --break-system-packages…");
      const segunda = spawnSync(python.programa, [...argumentos, "--break-system-packages"], { stdio: "inherit" });
      if (segunda.status === 0) return;
    } else {
      console.error(texto.trim().split("\n").slice(-12).join("\n"));
    }
    const dicaDeVersao = python.compativel
      ? ""
      : ` O Python ${python.versao} ainda não tem binários prontos deste pacote (a janela publicada é ${PYTHON_MIN.join(".")}–${PYTHON_MAX.join(".")}).`;
    throw new Error(
      `Não foi possível instalar o PostgreSQL embutido.${dicaDeVersao} Alternativas, em ordem: ` +
        "instalar um Python dessa janela (https://www.python.org/downloads/), " +
        "abrir o Docker Desktop, ou instalar o PostgreSQL (https://www.postgresql.org/download/windows/) e definir PG_BIN.",
    );
  }
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
  const ambiente = ambienteDoBin(bin);
  if (!existsSync(path.join(DIR_DADOS, "PG_VERSION"))) {
    log(`Inicializando cluster local em ${path.relative(RAIZ, DIR_DADOS)} (fora do Git)…`);
    mkdirSync(DIR_DADOS, { recursive: true });
    const resultado = spawnSync(
      exe(bin, "initdb"),
      ["-D", DIR_DADOS, "-U", USUARIO, "--auth=trust", "--encoding=UTF8"],
      { stdio: "inherit", env: ambiente },
    );
    if (resultado.status !== 0) {
      throw new Error(
        "O initdb não conseguiu criar o banco local. Apague a pasta .pgdata (só dados sintéticos ficam nela) e rode de novo.",
      );
    }
  }
  if (!emExecucao(bin, ambiente)) {
    log(`Iniciando PostgreSQL local na porta ${PORTA}…`);
    const opcoes = [`-p ${PORTA}`, "-c listen_addresses=127.0.0.1"];
    // O socket de arquivo só existe no Linux/macOS; no Windows a conexão é sempre por TCP.
    if (process.platform !== "win32") opcoes.push(`-c unix_socket_directories=${DIR_DADOS}`);
    const logDoServidor = path.join(DIR_DADOS, "servidor.log");
    const iniciar = spawnSync(
      exe(bin, "pg_ctl"),
      ["-D", DIR_DADOS, "-o", opcoes.join(" "), "-w", "-l", logDoServidor, "start"],
      { stdio: "inherit", env: ambiente },
    );
    if (iniciar.status !== 0) {
      throw new Error(`O PostgreSQL local não subiu. O motivo está em ${path.relative(RAIZ, logDoServidor)}.`);
    }
  }
  const psql = exe(bin, "psql");
  const existe = spawnSync(
    psql,
    ["-h", "127.0.0.1", "-p", PORTA, "-U", USUARIO, "-d", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname='${BANCO}'`],
    { encoding: "utf8", env: ambiente },
  );
  if ((existe.stdout ?? "").trim() !== "1") {
    const criar = spawnSync(exe(bin, "createdb"), ["-h", "127.0.0.1", "-p", PORTA, "-U", USUARIO, BANCO], {
      stdio: "inherit",
      env: ambiente,
    });
    if (criar.status !== 0) throw new Error(`Não foi possível criar o banco '${BANCO}'.`);
  }
}

/** O cluster local está respondendo? (usado antes de subir ou parar, para não dar erro bobo) */
function emExecucao(bin, ambiente = ambienteDoBin(bin)) {
  return spawnSync(exe(bin, "pg_ctl"), ["-D", DIR_DADOS, "status"], { stdio: "ignore", env: ambiente }).status === 0;
}

function pararComDocker() {
  execFileSync("docker", ["compose", "-f", COMPOSE, "down"], { stdio: "inherit", cwd: RAIZ });
}

function pararComBinarios(bin) {
  const ambiente = ambienteDoBin(bin);
  if (emExecucao(bin, ambiente)) {
    spawnSync(exe(bin, "pg_ctl"), ["-D", DIR_DADOS, "-m", "fast", "stop"], { stdio: "inherit", env: ambiente });
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
  const modo = process.env.LIA_DB_MODO;
  const temDocker = dockerDisponivel();
  const python = pythonParaBanco();
  let bin = binariosPgserver();
  const usarDocker = temDocker && modo !== "binarios" && modo !== "pgserver" && modo !== "url";

  if (comando === "url") {
    log(process.env.DATABASE_URL ?? (usarDocker ? urlLocal() : bin ? urlBinarios() : ""));
    return;
  }

  if (comando === "status") {
    log(temDocker ? "Docker: disponível" : "Docker: indisponível neste ambiente");
    log(bin ? `Binários PostgreSQL: ${bin}` : "Binários PostgreSQL: não encontrados (dá para instalar o embutido: `node tools/db.mjs instalar`)");
    const pythons = pythonsDisponiveis();
    log(
      pythons.length > 0
        ? `Python: ${pythons.map((p) => `${p.programa} ${p.versao}${p.compativel ? "" : " (sem binários prontos do banco embutido)"}`).join(" · ")}`
        : "Python: não encontrado (necessário para o PostgreSQL embutido)",
    );
    log(`Modo: ${modo ?? "(automático: Docker → binários do sistema → embutido)"}`);
    log(`DATABASE_URL atual: ${process.env.DATABASE_URL ?? "(não definida)"}`);
    if (existsSync(path.join(RAIZ, ".env"))) log("Arquivo .env: presente (ignorado pelo Git)");
    return;
  }

  if (comando === "instalar") {
    instalarPgserver(python);
    bin = binariosPgserver();
    if (!bin) {
      throw new Error(
        "O pacote foi instalado, mas os binários do PostgreSQL não apareceram. Rode de novo; se repetir, abra o Docker Desktop.",
      );
    }
    log(`PostgreSQL embutido pronto: ${bin}`);
    return;
  }

  if (comando === "up") {
    if (modo === "url") {
      if (!process.env.DATABASE_URL) throw new Error("O modo 'url' exige DATABASE_URL definida.");
      log("Usando a DATABASE_URL já definida.");
      escreverEnv(process.env.DATABASE_URL);
      return;
    }
    if (usarDocker) {
      iniciarComDocker();
      escreverEnv(urlLocal());
      return;
    }
    if (!bin && !process.env.DATABASE_URL) {
      log("Não encontrei Docker nem PostgreSQL instalado — vou preparar o PostgreSQL embutido (sem administrador)…");
      instalarPgserver(python);
      bin = binariosPgserver();
    }
    if (bin) {
      iniciarComBinarios(bin);
      log("Aviso: modo binário local (sem Docker). Use apenas para desenvolvimento/testes com dados sintéticos.");
      escreverEnv(urlBinarios());
      return;
    }
    if (process.env.DATABASE_URL) {
      log("Nenhum PostgreSQL local disponível: usando a DATABASE_URL já definida.");
      escreverEnv(process.env.DATABASE_URL);
      return;
    }
    throw new Error(
      "Nenhum PostgreSQL disponível. Instale o Python 3 (https://www.python.org/downloads/) e rode de novo — o Lia Go instala o resto sozinho.",
    );
  }

  if (comando === "down") {
    if (usarDocker) pararComDocker();
    else if (bin && emExecucao(bin)) pararComBinarios(bin);
    else log("Nada para parar neste ambiente.");
    return;
  }

  throw new Error(`Comando desconhecido: ${comando}. Use up, down, status, url ou instalar.`);
}

principal().catch((erro) => {
  console.error(`db.mjs: ${erro instanceof Error ? erro.message : String(erro)}`);
  process.exit(1);
});

void readFileSync;
