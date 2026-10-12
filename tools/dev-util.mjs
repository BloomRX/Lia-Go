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
 * No Windows, o Node (a partir da correção de segurança de abril/2024) **não deixa** executar
 * `.cmd`/`.bat` diretamente: o processo nem começa e o erro aparece como `EINVAL`. Como o `npm`
 * do Windows é o `npm.cmd`, é obrigatório passar por um shell. Sem isso, todo `npm install`,
 * `npm test` ou `npm run dev` falha sem explicação — foi exatamente o que aconteceu.
 */
export function montarComando(comando, args, plataforma = process.platform, ambiente = process.env) {
  const ehScriptDeShell = /\.(cmd|bat)$/i.test(comando);
  if (plataforma === "win32" && ehScriptDeShell) {
    return { comando: (ambiente.ComSpec ?? ambiente.COMSPEC ?? "cmd.exe"), args, shell: true };
  }
  return { comando, args, shell: false };
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
