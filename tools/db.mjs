#!/usr/bin/env node
/**
 * tools/db.mjs — sobe/derruba o PostgreSQL local de desenvolvimento.
 *
 * Modos (nesta ordem de preferência):
 *  1. docker  — Docker Compose (padrão na máquina do desenvolvedor; decisão confirmada);
 *  2. local   — binários do PostgreSQL já instalados no sistema (PG_BIN, PATH ou pastas padrão);
 *  3. portatil— baixa uma única vez (~12 MB) os binários prontos do PostgreSQL para `.pgbin`
 *               (fora do Git): funciona sem Docker, sem administrador e sem depender do Python;
 *  4. pgserver— pacote Python `pgserver`, se já estiver instalado na máquina;
 *  5. local   — binários do PostgreSQL instalados no sistema (`PG_BIN` ou pastas padrão);
 *  6. url     — não sobe nada: apenas valida a DATABASE_URL já definida.
 *
 * Comandos: up · down · status · url · instalar
 * `LIA_DB_MODO=binarios|pgserver|portateis|url` força um modo (usado nos testes automatizados).
 *
 * Sempre escreve `.env` na raiz quando o banco é iniciado (o .env é ignorado pelo Git).
 * Nunca apaga dados: `down` apenas para o serviço.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  candidatosDePython,
  comandosDeExtracao,
  escolherArquivoDeBinarios,
  explicarLogDoServidor,
  PYTHON_MAX,
  PYTHON_MIN,
  versaoCompativel,
} from "./dev-util.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR_DADOS = path.join(RAIZ, ".pgdata");
/** Onde ficam os binários portáteis do PostgreSQL (baixados uma vez, fora do Git). */
const DIR_PORTATIL = path.join(RAIZ, ".pgbin");
const URL_PYPI = "https://pypi.org/pypi/pgserver/json";
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
 * Descobre os binários do PostgreSQL disponíveis na máquina, sem baixar nada:
 * `PG_BIN` → portáteis já baixados → pacote Python `pgserver` (se estiver instalado) → pastas do sistema.
 */
function binariosPostgres() {
  if (process.env.PG_BIN && existsSync(path.join(process.env.PG_BIN, "initdb" + EXE))) {
    return process.env.PG_BIN;
  }
  const portateis = binariosPortateis();
  if (portateis) return portateis;
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

/** Binários portáteis já baixados e extraídos, quando existirem. */
function binariosPortateis() {
  const bin = path.join(DIR_PORTATIL, "pgserver", "pginstall", "bin");
  return existsSync(path.join(bin, "initdb" + EXE)) ? bin : null;
}

/**
 * Apaga o que veio junto no pacote e não é usado para rodar o banco (sobras do Python: `.pyd`/`.so`
 * do módulo, `dist-info`, `.py`). Mantém `pginstall/{bin,share,lib}` e a pasta `*.libs`, que no
 * Linux guarda as bibliotecas compartilhadas que os programas do PostgreSQL procuram.
 */
function limparSobras() {
  const remover = [];
  for (const entrada of readdirSync(DIR_PORTATIL)) {
    // `*.libs` NÃO entra aqui: no Linux os programas do PostgreSQL procuram as bibliotecas dele.
    if (/\.(whl|dist-info)$/i.test(entrada) || /^_postgresql.*\.(so|pyd)$/i.test(entrada)) {
      remover.push(path.join(DIR_PORTATIL, entrada));
    }
  }
  const pastaPgserver = path.join(DIR_PORTATIL, "pgserver");
  if (existsSync(pastaPgserver)) {
    for (const entrada of readdirSync(pastaPgserver)) {
      if (entrada !== "pginstall") remover.push(path.join(pastaPgserver, entrada));
    }
  }
  for (const caminho of remover) rmSync(caminho, { recursive: true, force: true });
}

/** Extrai o arquivo baixado tentando os programas de extração disponíveis em cada sistema. */
function extrairArquivo(arquivo) {
  mkdirSync(DIR_PORTATIL, { recursive: true });
  for (const [programa, argumentos] of comandosDeExtracao(process.platform, arquivo, DIR_PORTATIL)) {
    const resultado = spawnSync(programa, argumentos, { stdio: "ignore" });
    if (resultado.status === 0 && binariosPortateis()) return true;
  }
  return false;
}

/**
 * Baixa os binários portáteis do PostgreSQL (uma vez, ~12 MB) para `.pgbin`.
 * É o caminho que funciona sem Docker, sem administrador e **sem depender do Python** da máquina —
 * inclusive quando o Python instalado é mais novo do que os pacotes publicados.
 */
async function baixarBinariosPortateis() {
  const pronto = binariosPortateis();
  if (pronto) return pronto;
  if (typeof fetch !== "function") {
    throw new Error("Este Node não sabe baixar arquivos (é preciso o Node 22 ou mais novo).");
  }
  log("Baixando os binários do PostgreSQL (arquivo único de ~12 MB, só na primeira vez)…");
  let catalogo;
  try {
    const resposta = await fetch(URL_PYPI);
    if (!resposta.ok) throw new Error(`o servidor respondeu ${resposta.status}`);
    catalogo = await resposta.json();
  } catch (erro) {
    throw new Error(
      `Não consegui consultar o catálogo do banco (${erro.message}). Confira a internet, o proxy ou o antivírus — ou abra o Docker Desktop.`,
    );
  }
  const arquivo = escolherArquivoDeBinarios(catalogo);
  if (!arquivo) {
    throw new Error(
      `Não existem binários portáteis do PostgreSQL para ${process.platform}/${process.arch}. ` +
        "Abra o Docker Desktop ou instale o PostgreSQL (https://www.postgresql.org/download/windows/) e defina PG_BIN.",
    );
  }
  log(`Binários disponíveis: ${arquivo.nome}`);
  mkdirSync(DIR_PORTATIL, { recursive: true });
  const destino = path.join(DIR_PORTATIL, arquivo.nome);
  try {
    const baixado = await fetch(arquivo.url);
    if (!baixado.ok) throw new Error(`o servidor respondeu ${baixado.status}`);
    writeFileSync(destino, Buffer.from(await baixado.arrayBuffer()));
  } catch (erro) {
    throw new Error(
      `A conexão falhou durante o download do banco (${erro.message}). Rode de novo para tentar outra vez — o arquivo só é usado quando estiver completo.`,
    );
  }
  log("Extraindo os binários…");
  if (!extrairArquivo(destino)) {
    rmSync(destino, { force: true });
    throw new Error(
      "Baixei o arquivo do banco, mas não consegui extrair (tentei tar, unzip e PowerShell). " +
        "Instale o 7-Zip (ou o unzip) e rode de novo, ou use o Docker Desktop.",
    );
  }
  rmSync(destino, { force: true });
  limparSobras();
  const bin = binariosPortateis();
  if (!bin) throw new Error("O download terminou, mas os programas do banco não apareceram na pasta esperada.");
  log(`Banco pronto em ${path.relative(RAIZ, DIR_PORTATIL)} (pasta fora do Git).`);
  return bin;
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

/**
 * Lê o fim do log do servidor para transformar "não subiu" em algo acionável.
 * Caso conhecido do Windows: o PostgreSQL se recusa a rodar com privilégios de administrador.
 */
function motivoDoLogDoServidor(caminho) {
  try {
    const linhas = readFileSync(caminho, "utf8").trim().split("\n").slice(-6).join("\n");
    if (!linhas) return "";
    return ` Últimas linhas do log:\n${linhas}${explicarLogDoServidor(linhas, PORTA)}`;
  } catch {
    return "";
  }
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
      throw new Error(
        `O PostgreSQL local não subiu.${motivoDoLogDoServidor(logDoServidor)} Log completo: ${path.relative(RAIZ, logDoServidor)}.`,
      );
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
  let bin = binariosPostgres();
  const usarDocker = temDocker && !["binarios", "pgserver", "portateis", "url"].includes(modo ?? "");

  if (comando === "url") {
    log(process.env.DATABASE_URL ?? (usarDocker ? urlLocal() : bin ? urlBinarios() : ""));
    return;
  }

  if (comando === "status") {
    log(temDocker ? "Docker: disponível" : "Docker: indisponível neste ambiente");
    log(
      bin
        ? `Binários PostgreSQL: ${bin}`
        : `Binários PostgreSQL: não encontrados — a opção 4 baixa um portátil em ${path.relative(RAIZ, DIR_PORTATIL)} (fora do Git)`,
    );
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
    bin = await baixarBinariosPortateis();
    log(`PostgreSQL pronto: ${bin}`);
    return;
  }

  if (comando === "up") {
    if (modo === "portateis") {
      bin = await baixarBinariosPortateis();
    }
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
      log("Não encontrei Docker nem PostgreSQL instalado — vou preparar um PostgreSQL portátil (sem administrador)…");
      bin = await baixarBinariosPortateis();
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
      "Nenhum PostgreSQL disponível. Rode `node tools/db.mjs instalar` para baixar o banco portátil, ou abra o Docker Desktop.",
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
