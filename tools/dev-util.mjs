/**
 * Peças puras do orquestrador (tools/dev.mjs), separadas para poderem ser testadas.
 *
 * A regra que motivou este arquivo: quando uma ferramenta falha, a pessoa precisa ver o motivo
 * real na tela — nunca um "falhou, verifique a conexão" que esconde a causa.
 */

// ---------------------------------------------------------------------------
// Execução de comandos
// ---------------------------------------------------------------------------

/**
 * Como chamar o comando em cada sistema.
 *
 * No Windows, o Node (correção de segurança de abril/2024) **não deixa** executar `.cmd`/`.bat`
 * diretamente: o processo nem começa (erro `EINVAL`). Como o `npm` do Windows é o `npm.cmd`,
 * é obrigatório passar por um shell — mas do jeito certo.
 *
 * ⚠️ Mandar shell **e** programa `.cmd` juntos quebra tudo: o Node monta
 * `cmd.exe /d /s /c "cmd.exe install"`, o `cmd.exe` interno abre em modo interativo, imprime o
 * banner "Microsoft Windows [versão …]", **não instala nada** e ainda devolve código 0 — um
 * "sucesso" falso que já nos custou uma rodada de depuração no PC do usuário.
 *
 * A forma certa é entregar a **linha inteira** em `comando`, com `args` vazio e `shell: true`:
 * o Node executa `%ComSpec% /d /s /c "<linha>"`, que roda o `.cmd` direto — sem `cmd.exe` sobrando,
 * sem o aviso DEP0190 (que só aparece quando se passam argumentos junto com shell) e sem o
 * problema de `%~dp0` que fazia o `npm.cmd` se perder.
 */
export function montarComando(comando, args, plataforma = process.platform) {
  if (plataforma === "win32" && /\.(cmd|bat)$/i.test(comando)) {
    return { comando: citarParaCmd(comando, args), args: [], shell: true };
  }
  return { comando, args, shell: false };
}

/**
 * Monta a linha de comando (com aspas) que o `cmd.exe /d /s /c` vai executar.
 * Aspas no programa são obrigatórias quando o caminho tem espaço (ex.: `C:\Program Files\nodejs`).
 */
export function citarParaCmd(comando, args) {
  const programa = /[\s"]/.test(comando) ? `"${comando}"` : comando;
  return [programa, ...args].join(" ");
}

/**
 * O Windows abriu um prompt de comando no lugar de executar o programa?
 * É o sintoma da chamada errada de `.cmd`/`.bat`: parece que funcionou (código 0), mas nada rodou.
 */
export function abriuPromptDoWindows(saida) {
  const texto = saida ?? "";
  return /^Microsoft Windows \[/mi.test(texto) || /\(c\) Microsoft Corporation/i.test(texto);
}

/** Traduz o erro de um spawn que nem chegou a rodar (npm ausente, caminho errado, bloqueio). */
export function erroDeSpawn(resultado) {
  const erro = resultado?.error;
  if (!erro) return null;
  if (erro.code === "ENOENT") {
    return "O comando não foi encontrado. Verifique se o Node.js está instalado e no PATH (reinstale o Node 22 LTS se necessário).";
  }
  if (erro.code === "EINVAL") {
    return "O sistema bloqueou a execução do comando (Windows + script .cmd). Rode de novo depois de atualizar o Lia Go; se persistir, avise com o texto desta tela.";
  }
  if (erro.code === "EACCES" || erro.code === "EPERM") {
    return "Sem permissão para executar o comando. Evite rodar dentro de pastas protegidas (Área de Trabalho sincronizada ou Program Files).";
  }
  return `Não foi possível executar o comando (${erro.code ?? erro.message}).`;
}

// ---------------------------------------------------------------------------
// Falha do npm install: causa provável em linguagem simples
// ---------------------------------------------------------------------------

const REGRAS = [
  {
    id: "proxy",
    // Cuidado: exigimos uma FALHA de proxy. A palavra "proxy" sozinha pega o nome do pacote
    // `@fastify/proxy-addr` e faria a pessoa procurar problema onde não existe.
    padrao: /(407 Proxy Authentication|proxy CONNECT|ECONNREFUSED\s+(127\.0\.0\.1|localhost)|https?-proxy)/i,
    causa: "Seu computador usa um proxy de internet que o npm não conhece (ou que exige senha).",
    dica: "Rode: npm config get proxy — se aparecer algo, confirme com quem cuida da sua rede. Em casa, apague com: npm config delete proxy && npm config delete https-proxy",
    transitorio: true,
  },
  {
    id: "dns",
    padrao: /ENOTFOUND/i,
    causa: "O endereço do servidor de pacotes não foi encontrado (internet fora, DNS com problema ou endereço de registro errado).",
    dica: "Teste a internet em outra aba e, no terminal, rode: npm ping — se falhar, confira a conexão e o registro com: npm config get registry (o correto é https://registry.npmjs.org/). Tentar de novo sem arrumar isso não ajuda.",
    transitorio: false,
  },
  {
    id: "npm_travou",
    padrao: /Exit handler never called/i,
    causa: "O npm se perdeu sozinho ao terminar (sintoma conhecido do npm, quase sempre por rede que caiu no meio do download).",
    dica: "Rode de novo — costuma funcionar. Se repetir, olhe o log do npm que foi copiado para reports/ (ele tem o motivo real) e teste a internet com: npm ping",
    transitorio: true,
  },
  {
    id: "rede",
    padrao: /(EAI_AGAIN|ETIMEDOUT|ECONNRESET|ECONNREFUSED|network|fetch failed|socket hang up|ERR_SOCKET_TIMEOUT)/i,
    causa: "O npm não conseguiu falar com o servidor de pacotes (internet ou bloqueio de rede).",
    dica: "Confira a internet, o Wi-Fi e o firewall/antivírus. Se estiver em rede de empresa/escola, pode ser bloqueio de download: tente em outra rede. Também vale: npm config set registry https://registry.npmjs.org/",
    transitorio: true,
  },
  {
    id: "certificado",
    padrao: /(UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT_IN_CHAIN|CERT_HAS_EXPIRED|unable to get local issuer certificate)/i,
    causa: "O certificado de segurança da conexão não pôde ser verificado (antivírus ou rede que inspeciona tráfego).",
    dica: "Costuma ser antivírus com inspeção HTTPS. Desative temporariamente a inspeção ou use outra rede. NÃO use npm config set strict-ssl false.",
    transitorio: false,
  },
  {
    id: "permissao",
    padrao: /(EPERM|EBUSY|EACCES|operation not permitted|resource busy|locked)/i,
    causa: "Algum arquivo está em uso ou bloqueado (antivírus, explorador de arquivos, ou o próprio app rodando em outra janela).",
    dica: "Feche todas as janelas do Lia Go/app/API e o explorador de arquivos na pasta do projeto, e rode de novo. Se usa OneDrive na pasta do projeto, mova o projeto para C:\\dev.",
    transitorio: true,
  },
  {
    id: "caminho_longo",
    padrao: /(ENAMETOOLONG|path too long|filename too long)/i,
    causa: "O caminho dos arquivos ficou longo demais para o Windows.",
    dica: "Mova o projeto para uma pasta curta (ex.: C:\\dev\\Lia-Go) e rode de novo.",
    transitorio: false,
  },
  {
    id: "arvore_pela_metade",
    padrao: /(ENOTEMPTY|ENOTDIR|syscall rename)/i,
    causa: "A pasta node_modules ficou pela metade (uma tentativa anterior foi interrompida no meio do download).",
    dica: "A automação apaga essa pasta e instala de novo sozinha (é pasta gerada, nada do projeto se perde). Se estiver rodando na mão: apague node_modules e rode de novo.",
    transitorio: true,
  },
  {
    id: "cache",
    padrao: /(EINTEGRITY|integrity checksum|checksum failed|ENOTCACHED)/i,
    causa: "Um arquivo baixado antes está corrompido no cache do npm.",
    dica: "Rode: npm cache verify — e depois: npm cache clean --force. Em seguida, rode o LiaGo.bat de novo.",
    transitorio: false,
  },
  {
    id: "conflito",
    padrao: /(ERESOLVE|could not resolve dependency|peer dep)/i,
    causa: "Conflito entre versões de pacotes (geralmente porque o package-lock.json do projeto não está atualizado).",
    dica: "Confirme que você atualizou o projeto (o LiaGo.bat faz isso na opção 6) e rode de novo. Não edite o package.json à mão.",
    transitorio: false,
  },
  {
    id: "espaco",
    padrao: /(ENOSPC|no space left|disk full)/i,
    causa: "Acabou o espaço em disco.",
    dica: "Libere espaço (o npm costuma precisar de algumas centenas de MB) e rode de novo.",
    transitorio: false,
  },
  {
    id: "versao_node",
    padrao: /(Unsupported engine|EBADENGINE|requires Node)/i,
    causa: "A versão do Node é mais antiga do que o projeto pede (Node 22.12 ou superior).",
    dica: "Instale o Node 22 LTS em https://nodejs.org e rode de novo.",
    transitorio: false,
  },
];

/** Dicas para a falha do npm, em ordem de probabilidade. Retorna lista de objetos explicativos. */
export function diagnosticarFalhaNpm(saida) {
  const texto = String(saida ?? "");
  let encontradas = REGRAS.filter((regra) => regra.padrao.test(texto));
  // "rede" e "npm travou" são explicações genéricas: quando reconhecemos o motivo de verdade
  // (DNS, proxy, permissão…), é ele que a pessoa precisa ler — e ele que decide sobre tentar de novo.
  if (encontradas.length > 1) {
    const especificas = encontradas.filter((regra) => regra.id !== "rede" && regra.id !== "npm_travou");
    if (especificas.length > 0) encontradas = especificas;
  }
  if (encontradas.length === 0) {
    return [
      {
        id: "desconhecida",
        causa: "O npm não disse o motivo em uma linha que a gente reconheça.",
        dica: "Veja as últimas linhas acima: normalmente a mensagem em inglês aponta o arquivo ou o pacote. Rode de novo com internet estável; se repetir, guarde o arquivo de log citado e avise.",
        transitorio: true,
      },
    ];
  }
  return encontradas.map(({ id, causa, dica, transitorio }) => ({ id, causa, dica, transitorio }));
}

/**
 * Vale tentar de novo automaticamente? Olhamos a **causa principal** (a primeira):
 * repetir o comando só ajuda quando o problema é passageiro — não quando já sabemos o motivo.
 */
export function valeTentarDeNovo(dicas) {
  return Boolean(dicas?.[0]?.transitorio);
}

// ---------------------------------------------------------------------------
// Saída de texto
// ---------------------------------------------------------------------------

/**
 * Linhas do log interno do npm que realmente explicam a falha.
 * Útil porque o npm às vezes só imprime "Exit handler never called" na tela.
 */
const LINHA_RELEVANTE =
  /(error code|errno|reason:|getaddrinfo|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EPERM|EACCES|ENOSPC|EINTEGRITY|ERESOLVE|EBADENGINE|proxy|407)/i;

export function linhasRelevantes(texto, maximo = 6) {
  const vistas = new Set();
  const escolhidas = [];
  for (const linha of String(texto ?? "").split("\n")) {
    const limpa = linha.trim();
    if (!limpa || !LINHA_RELEVANTE.test(limpa)) continue;
    // O log do npm é repetitivo: cada erro aparece em várias linhas parecidas.
    const chave = limpa.replace(/\s+/g, " ").slice(0, 120);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    escolhidas.push(limpa);
  }
  return escolhidas.slice(-maximo);
}

/**
 * Diagnóstico combinando o que o npm escreveu na tela e o log interno dele.
 * Quando a tela não explica (sintomas genéricos), o log é a fonte da verdade.
 */
export function diagnosticarComLog(saidaDoNpm, textoDoLog = null) {
  const daTela = diagnosticarFalhaNpm(saidaDoNpm);
  const generica = daTela[0].id === "npm_travou" || daTela[0].id === "desconhecida";
  if (!textoDoLog || !generica) return { dicas: daTela, linhasDoLog: [], fonte: "tela" };

  const doLog = diagnosticarFalhaNpm(textoDoLog);
  if (doLog[0].id === "desconhecida") return { dicas: daTela, linhasDoLog: linhasRelevantes(textoDoLog), fonte: "tela" };
  // Achamos a causa de verdade no log: o sintoma genérico da tela sai da lista para não confundir
  // (e para não provocar uma nova tentativa que já sabemos que não resolve).
  return { dicas: doLog, linhasDoLog: linhasRelevantes(textoDoLog), fonte: "log" };
}

/**
 * O npm esconde o motivo real em um log próprio (inclusive quando imprime
 * "Exit handler never called"). Aqui achamos o caminho desse arquivo na saída.
 */
export function caminhoDoLogDoNpm(saida) {
  const encontrado = /complete log of this run can be found in:?\s*(\S+)/i.exec(String(saida ?? ""));
  return encontrado ? encontrado[1] : null;
}

/** Últimas linhas de uma saída longa, sem estourar a tela. */
export function resumoSaida(saida, maxLinhas = 30) {
  const linhas = String(saida ?? "").replace(/\r\n/g, "\n").trimEnd().split("\n").filter((linha) => linha.trim() !== "");
  if (linhas.length === 0) return "(o comando não escreveu nada)";
  return linhas.slice(-maxLinhas).join("\n");
}

/** Esconde a senha de uma URL de banco (usada em relatórios e mensagens). */
export function ocultarUrl(url) {
  return url ? String(url).replace(/:\/\/([^:/@]+):[^@/]+@/, "://$1:****@") : "(não definida)";
}

/** Lê um .env em texto puro (sem imprimir valores em lugar nenhum). */
export function lerEnvDoTexto(texto) {
  const valores = {};
  for (const linha of String(texto ?? "").split("\n")) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const igual = limpa.indexOf("=");
    if (igual <= 0) continue;
    valores[limpa.slice(0, igual).trim()] = limpa.slice(igual + 1).trim().replace(/^["']|["']$/g, "");
  }
  return valores;
}

// ---------------------------------------------------------------------------
// Descobrir o Python da máquina (usado pelo banco embutido em tools/db.mjs)
// ---------------------------------------------------------------------------

/** Versões de Python com binários publicados do PostgreSQL embutido (`pgserver`). */
export const PYTHON_MIN = [3, 9];
export const PYTHON_MAX = [3, 12];

/**
 * A versão do Python está dentro da janela com binários prontos?
 * Fora dela, o `pip install` não teria o que baixar e a falha pareceria "sem internet".
 */
export function versaoCompativel(versao) {
  const [maior, menor] = String(versao).split(".").map(Number);
  if (!Number.isInteger(maior) || !Number.isInteger(menor)) return false;
  if (maior !== PYTHON_MIN[0]) return false;
  return menor >= PYTHON_MIN[1] && menor <= PYTHON_MAX[1];
}

/**
 * Nomes de programa a tentar, na ordem, para achar um Python.
 * No Windows o certo é o launcher `py -3` (ou `python`); **`python3` não existe lá** — foi o que
 * fez o banco embutido falhar com "No module named pgserver" no PC do usuário.
 */
export function candidatosDePython(plataforma = process.platform) {
  return plataforma === "win32"
    ? [
        ["py", ["-3"]],
        ["python", []],
        ["python3", []],
      ]
    : [
        ["python3", []],
        ["python", []],
      ];
}

// ---------------------------------------------------------------------------
// Banco local: transformar o log do PostgreSQL em algo acionável (tools/db.mjs)
// ---------------------------------------------------------------------------

/**
 * Dicas em português para os erros conhecidos do log do servidor PostgreSQL local.
 * Devolve "" quando o log não traz nenhum caso reconhecido.
 */
export function explicarLogDoServidor(linhas, porta = "55432") {
  const texto = String(linhas ?? "");
  const dicas = [];
  if (/administrative|administrador/i.test(texto)) {
    dicas.push(
      "O Lia Go está sendo executado como administrador e o PostgreSQL não roda assim. Feche esta janela e abra o LiaGo.bat com um duplo clique normal.",
    );
  }
  if (/Address already in use|endereço já está em uso/i.test(texto)) {
    dicas.push(
      `Já existe algo usando a porta ${porta} (outra instância do Lia Go ou um PostgreSQL antigo). Feche o que estiver rodando e tente de novo — ou rode com LIA_PG_PORTA=55433.`,
    );
  }
  return dicas.map((dica) => `\n→ ${dica}`).join("");
}

// ---------------------------------------------------------------------------
// Binários portáteis do PostgreSQL (baixados do PyPI: sem Docker e sem Python)
// ---------------------------------------------------------------------------
//
// Os arquivos do PyPI são imutáveis e ficam para sempre — e o pacote `pgserver` carrega dentro dele
// o PostgreSQL **compilado**: `initdb`, `pg_ctl`, `psql` e os arquivos de apoio. Baixamos o pacote,
// extraímos (é um zip comum) e usamos esses programas direto. Não precisa de Docker, não precisa de
// Python instalado, e a versão do Python da máquina deixa de importar.

/** Sufixo do arquivo de binários compatível com esta máquina (mesmo esquema dos wheels do PyPI). */
export function sufixoDeBinarios(plataforma = process.platform, arquitetura = process.arch) {
  if (plataforma === "win32") return arquitetura === "arm64" ? "win_arm64" : "win_amd64";
  if (plataforma === "darwin") return arquitetura === "arm64" ? "macosx_11_0_arm64" : "macosx_10_9_x86_64";
  if (arquitetura === "arm64" || arquitetura === "arm")
    return "manylinux_2_17_aarch64.manylinux2014_aarch64";
  return "manylinux_2_17_x86_64.manylinux2014_x86_64";
}

/**
 * Escolhe, na resposta do PyPI, o arquivo de binários desta máquina.
 * Devolve `null` quando não há binário publicado para a plataforma (ex.: Windows ARM, Linux ARM).
 */
export function escolherArquivoDeBinarios(dados, plataforma = process.platform, arquitetura = process.arch) {
  const sufixo = sufixoDeBinarios(plataforma, arquitetura);
  const arquivos = Array.isArray(dados?.urls) ? dados.urls : [];
  const candidatos = arquivos.filter(
    (arquivo) => typeof arquivo?.filename === "string" && arquivo.filename.endsWith(`${sufixo}.whl`),
  );
  const ordem = ["cp312", "cp311", "cp310", "cp39", "cp313"];
  const peso = (nome) => {
    const achado = ordem.findIndex((abi) => nome.includes(abi));
    return achado === -1 ? ordem.length : achado;
  };
  candidatos.sort((a, b) => peso(a.filename) - peso(b.filename));
  const escolhido = candidatos[0];
  if (!escolhido) return null;
  return {
    nome: escolhido.filename,
    url: escolhido.url,
    tamanho: typeof escolhido.size === "number" && escolhido.size > 0 ? escolhido.size : 0,
    versao: dados?.info?.version ?? "",
  };
}

/**
 * Programas a tentar para extrair o arquivo baixado, na ordem.
 * No Windows o `tar.exe` (que já vem no sistema desde o Windows 10) lê zip; no Linux, `unzip`.
 */
export function comandosDeExtracao(plataforma, arquivo, destino) {
  const comandos = [["tar", ["-xf", arquivo, "-C", destino]]];
  if (plataforma === "win32") {
    comandos.push([
      "powershell",
      ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${arquivo}' -DestinationPath '${destino}' -Force`],
    ]);
  } else {
    comandos.push(["unzip", ["-o", arquivo, "-d", destino]]);
    comandos.push(["python3", ["-m", "zipfile", "-e", arquivo, destino]]);
  }
  return comandos;
}

// ---------------------------------------------------------------------------
// Diagnóstico do computador (vai para reports/estado-do-computador.md e é enviado ao GitHub)
// ---------------------------------------------------------------------------

/** Monta o arquivo que conta ao responsável como está a máquina, sem precisar de print de tela. */
export function montarDiagnostico(dados) {
  const linhas = [
    "# Estado do computador (gerado automaticamente pelo LiaGo.bat)",
    "",
    `- **Quando:** ${dados.quando ?? ""}`,
    `- **Sistema:** ${dados.sistema ?? "?"} · **Node:** ${dados.node ?? "?"} · **npm:** ${dados.npm ?? "?"}`,
    `- **Python:** ${dados.python ?? "não encontrado"}`,
    `- **Docker:** ${dados.docker ?? "?"} · **Banco de dados:** ${dados.banco ?? "?"}`,
    `- **Dependências:** ${dados.dependencias ?? "?"}`,
    `- **Testes:** ${dados.testes ?? "não rodaram"}`,
    `- **Branch:** ${dados.branch ?? "?"} · **Último commit local:** ${dados.commit ?? "?"}`,
    "",
  ];
  if (dados.ocorrencias?.length) {
    linhas.push("## Avisos desta rodada", "");
    for (const aviso of dados.ocorrencias) linhas.push(`- ${aviso}`);
    linhas.push("");
  } else {
    linhas.push("## Avisos desta rodada", "", "- Nenhum: tudo correu como esperado.", "");
  }
  if (dados.detalhes?.length) {
    linhas.push("## Detalhes técnicos (últimas linhas)", "");
    for (const bloco of dados.detalhes) {
      linhas.push(`### ${bloco.titulo}`, "", "```", (bloco.texto ?? "").trim() || "(vazio)", "```", "");
    }
  }
  return `${linhas.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// Feedback de progresso: ninguém deve ficar olhando uma tela parada
// ---------------------------------------------------------------------------

/** Tamanho legível em português (12,3 MB · 480 KB · 512 B). */
export function formatarTamanho(bytes) {
  const valor = Number(bytes) || 0;
  if (valor >= 1024 * 1024) return `${(valor / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  if (valor >= 1024) return `${Math.round(valor / 1024)} KB`;
  return `${valor} B`;
}

/**
 * Uma linha de progresso do download.
 * `animado` é para o terminal de verdade (com barra); sem ele, sai só o percentual,
 * para o texto continuar legível quando a saída está sendo gravada em arquivo.
 */
export function linhaDeProgresso(recebidos, total, segundos, animado = true) {
  const velocidade = segundos > 0.5 ? `${formatarTamanho(recebidos / segundos)}/s` : "";
  if (!total || total <= 0) {
    return `  recebido ${formatarTamanho(recebidos)}${velocidade ? ` · ${velocidade}` : ""}`.trimEnd();
  }
  const pct = Math.min(100, Math.floor((recebidos / total) * 100));
  if (!animado) {
    return `  ${pct}% (${formatarTamanho(recebidos)} de ${formatarTamanho(total)})${velocidade ? ` · ${velocidade}` : ""}`;
  }
  const largura = 24;
  const cheios = Math.max(0, Math.min(largura, Math.round((pct / 100) * largura)));
  const barra = "#".repeat(cheios) + "-".repeat(largura - cheios);
  return `  [${barra}] ${String(pct).padStart(3)}% · ${formatarTamanho(recebidos)}/${formatarTamanho(total)} · ${velocidade}`.trimEnd();
}

/** "12s" / "1 min 5s" — para fechar cada etapa com algo concreto. */
export function tempoDecorrido(inicioMs, agoraMs = Date.now()) {
  const segundos = Math.max(0, Math.round((Number(agoraMs) - Number(inicioMs)) / 1000));
  if (segundos < 60) return `${segundos}s`;
  const minutos = Math.floor(segundos / 60);
  return `${minutos} min ${segundos % 60}s`;
}

/**
 * Roda um comando mostrando a saída conforme ela acontece e, quando o processo passa 15 segundos
 * sem escrever nada, avisa que continua trabalhando — ninguém precisa adivinhar se travou.
 * Devolve o mesmo formato do `rodar()` do orquestrador: { status, saida, error }.
 */
export async function rodarComSaidaAoVivo(programa, argumentos, opcoes = {}) {
  const { spawn } = await import("node:child_process");
  const inicio = Date.now();
  return await new Promise((resolve) => {
    const processo = spawn(programa, argumentos, {
      cwd: opcoes.cwd,
      env: opcoes.env ?? process.env,
      shell: opcoes.shell ?? false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let saida = "";
    let ultimaSaida = Date.now();
    const ecoar = opcoes.ecoar !== false;
    const consumir = (pedaco) => {
      const texto = pedaco.toString();
      saida += texto;
      ultimaSaida = Date.now();
      if (ecoar) process.stdout.write(texto);
    };
    processo.stdout.on("data", consumir);
    processo.stderr.on("data", consumir);
    const relogio = setInterval(() => {
      if (Date.now() - ultimaSaida >= 15000) {
        console.log(`   ⏳ ${opcoes.legenda ?? "ainda trabalhando"} — sem novidades há ${tempoDecorrido(ultimaSaida)} (total ${tempoDecorrido(inicio)}). Aguarde, não travou.`);
      }
    }, 5000);
    const finalizar = (status, erro) => {
      clearInterval(relogio);
      resolve({ status: status ?? 1, saida, error: erro ?? null });
    };
    processo.on("error", (erro) => finalizar(1, erro));
    process.on("exit", () => clearInterval(relogio));
    processo.on("exit", (codigo) => finalizar(codigo));
  });
}
