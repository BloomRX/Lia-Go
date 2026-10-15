/**
 * Fila de envio (padrão "outbox"): toda escrita entra na fila antes de ser enviada.
 *
 * Regras que não podem ser quebradas:
 *  - a mesma chave de idempotência nunca aplica a operação duas vezes no servidor;
 *  - a ordem de criação é preservada ao enviar (criar a viagem antes da despesa dela);
 *  - falha de rede não perde nada: volta para a fila com espera crescente;
 *  - falha que não se resolve sozinha (regra de negócio violada, sem permissão) para de
 *    tentar e aparece para a pessoa resolver — nunca fica tentando em silêncio;
 *  - conflito de versão não é sobrescrito: vira uma decisão humana.
 */
import type {
  ErroEnvio,
  EstadoGeralFila,
  Fila,
  Operacao,
  OperacaoPendente,
  ResumoFila,
} from "./tipos.ts";

export const ESPERA_BASE_MS = 2_000;
export const ESPERA_MAXIMA_MS = 5 * 60_000;

/** Espera crescente e limitada: 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 300s, 300s… */
export function esperaDeReenvio(tentativas: number): number {
  if (tentativas < 1) return 0;
  return Math.min(ESPERA_BASE_MS * 2 ** (tentativas - 1), ESPERA_MAXIMA_MS);
}

export interface ClassificacaoErro {
  /** `conflito` = precisa de decisão humana agora; `permanente` = não adianta tentar de novo. */
  destino: "reenviar" | "permanente" | "conflito";
}

/**
 * Decide o que fazer com um erro de envio. A ordem importa: conflito de versão vem primeiro
 * porque é o único caso em que a alteração continua válida e precisa de decisão.
 */
export function classificarErro(erro: ErroEnvio): ClassificacaoErro {
  if (erro.codigo === "conflito_versao") return { destino: "conflito" };
  // Sem status HTTP: rede caiu, DNS falhou, tempo esgotado. Sempre vale tentar depois.
  if (erro.status === undefined) return { destino: "reenviar" };
  // 401 (sessão a renovar), 408/425/429 (tente mais tarde) e 5xx (servidor) são temporários.
  if ([401, 408, 425, 429].includes(erro.status) || erro.status >= 500) return { destino: "reenviar" };
  return { destino: "permanente" };
}

export function filaVazia(): Fila {
  return { operacoes: [] };
}

export interface NovaOperacao {
  id: string;
  operacao: Operacao;
  agora: string;
}

/** Adiciona ao fim da fila preservando a ordem causal. Reenfileirar o mesmo id não duplica. */
export function enfileirar(fila: Fila, nova: NovaOperacao): Fila {
  if (fila.operacoes.some((item) => item.id === nova.id)) return fila;
  const pendente: OperacaoPendente = {
    id: nova.id,
    operacao: nova.operacao,
    estado: "aguardando",
    criadaEm: nova.agora,
    tentativas: 0,
    proximaTentativaEm: nova.agora,
  };
  return { ...fila, operacoes: [...fila.operacoes, pendente] };
}

/**
 * Próxima operação a enviar, respeitando a ordem de criação:
 *  - quem espera decisão humana (`falhou`/`conflito`) não bloqueia o resto da fila;
 *  - quem está só esperando o relógio bloqueia quem veio depois (ordem causal);
 *  - nada é enviado em paralelo: uma operação por vez.
 */
export function proximaOperacao(fila: Fila, agora: string): OperacaoPendente | undefined {
  for (const item of fila.operacoes) {
    if (item.estado === "falhou" || item.estado === "conflito") continue;
    if (item.estado === "enviando") return undefined;
    return item.proximaTentativaEm <= agora ? item : undefined;
  }
  return undefined;
}

/** Existe algo aguardando que só depende do relógio (usado para saber se vale abrir a rede). */
export function temOperacaoAguardando(fila: Fila): boolean {
  return fila.operacoes.some((item) => item.estado === "aguardando");
}

export function marcarEnviando(fila: Fila, id: string): Fila {
  return atualizar(fila, id, (item) => ({ ...item, estado: "enviando" }));
}

/** Sucesso: a operação sai da fila (o servidor já confirmou com a chave de idempotência). */
export function marcarEnviada(fila: Fila, id: string, agora: string): Fila {
  const operacoes = fila.operacoes.filter((item) => item.id !== id);
  // Só registra o instante do sucesso quando não sobra nada: é o "tudo sincronizado" da interface.
  const ultimoSucessoEm = operacoes.length === 0 ? agora : fila.ultimoSucessoEm;
  return ultimoSucessoEm === undefined ? { operacoes } : { operacoes, ultimoSucessoEm };
}

export function marcarFalha(fila: Fila, id: string, erro: ErroEnvio, agora: string): Fila {
  const classificacao = classificarErro(erro);
  return atualizar(fila, id, (item) => {
    const tentativas = item.tentativas + 1;
    if (classificacao.destino === "conflito") {
      return { ...item, estado: "conflito", tentativas, erro };
    }
    if (classificacao.destino === "permanente") {
      return { ...item, estado: "falhou", tentativas, erro };
    }
    return {
      ...item,
      estado: "aguardando",
      tentativas,
      erro,
      proximaTentativaEm: somarMs(agora, esperaDeReenvio(tentativas)),
    };
  });
}

/**
 * Junta a fila que está no aparelho com o resultado de uma passada de sincronização.
 *
 * Por que existe (**defeito real de 2026-10-15**): a passada lê a fila no começo e grava no fim. Se,
 * no meio dela, a pessoa criar uma viagem (que entra na fila), a gravação do fim apagava essa
 * operação — a viagem criada simplesmente desaparecia, sem erro nenhum na tela.
 *
 * Regras:
 *  - operação que existe nas duas: vale o estado da passada (foi ela que tentou enviar);
 *  - operação que só existe no aparelho: foi criada **durante** a passada e é preservada;
 *  - operação que sumiu na passada e já existia no começo dela: foi enviada/descartada, some;
 *  - a ordem do aparelho é mantida (a ordem causal de quem chegou por último é a dele).
 */
export function juntarFilaDaPassada(doAparelho: Fila, passada: { antes: Fila; depois: Fila }): Fila {
  const jaExistiaNoComeco = new Set(passada.antes.operacoes.map((item) => item.id));
  const estadoDaPassada = new Map(passada.depois.operacoes.map((item) => [item.id, item]));

  const operacoes: OperacaoPendente[] = [];
  for (const item of doAparelho.operacoes) {
    const daPassada = estadoDaPassada.get(item.id);
    if (daPassada) {
      operacoes.push(daPassada);
      continue;
    }
    if (jaExistiaNoComeco.has(item.id)) continue; // a passada enviou (ou descartou): sai da fila
    operacoes.push(item); // entrou na fila durante a passada: nunca se perde
  }

  const ultimoSucessoEm = passada.depois.ultimoSucessoEm ?? doAparelho.ultimoSucessoEm;
  return ultimoSucessoEm === undefined ? { operacoes } : { operacoes, ultimoSucessoEm };
}

/** Descarta uma operação que não faz mais sentido (a pessoa decidiu abandonar). */
export function descartar(fila: Fila, id: string): Fila {
  return { ...fila, operacoes: fila.operacoes.filter((item) => item.id !== id) };
}

/** Recoloca na fila para tentar de novo agora (botão "tentar novamente"). */
export function retentar(fila: Fila, id: string, agora: string): Fila {
  return atualizar(fila, id, (item) => {
    // Em conflito o erro fica guardado: a interface precisa dele para mostrar as duas versões.
    if (item.erro && classificarErro(item.erro).destino === "conflito") {
      return { ...item, estado: "aguardando", tentativas: 0, proximaTentativaEm: agora };
    }
    const { erro: _descartado, ...resto } = item;
    return { ...resto, estado: "aguardando", tentativas: 0, proximaTentativaEm: agora };
  });
}

/** Volta ao estado "aguardando" o que ficou preso em "enviando" (app fechado no meio do envio). */
export function recuperarInterrompidas(fila: Fila, agora: string): Fila {
  return {
    ...fila,
    operacoes: fila.operacoes.map((item) =>
      item.estado === "enviando" ? { ...item, estado: "aguardando", proximaTentativaEm: agora } : item,
    ),
  };
}

export function operacoesComProblema(fila: Fila): OperacaoPendente[] {
  return fila.operacoes.filter((item) => item.estado === "falhou" || item.estado === "conflito");
}

export function resumoFila(fila: Fila): ResumoFila {
  const contar = (estado: OperacaoPendente["estado"]) => fila.operacoes.filter((i) => i.estado === estado).length;
  const aguardando = contar("aguardando");
  const enviando = contar("enviando");
  const falhou = contar("falhou");
  const conflito = contar("conflito");
  const total = fila.operacoes.length;

  let estado: EstadoGeralFila = "sincronizado";
  if (conflito > 0 || falhou > 0) estado = "com_problema";
  else if (enviando > 0) estado = "enviando";
  else if (aguardando > 0) estado = "pendente";

  return {
    estado,
    total,
    aguardando,
    enviando,
    falhou,
    conflito,
    rotulo: rotuloDoResumo({ estado, total, aguardando, enviando, falhou, conflito }),
  };
}

function rotuloDoResumo(r: Omit<ResumoFila, "rotulo">): string {
  if (r.estado === "sincronizado") return "Tudo sincronizado";
  if (r.conflito > 0) return r.conflito === 1 ? "1 alteração precisa da sua decisão" : `${r.conflito} alterações precisam da sua decisão`;
  if (r.falhou > 0) return r.falhou === 1 ? "1 alteração não pôde ser enviada" : `${r.falhou} alterações não puderam ser enviadas`;
  if (r.enviando > 0) return "Enviando…";
  return r.total === 1 ? "1 alteração aguardando envio" : `${r.total} alterações aguardando envio`;
}

function atualizar(fila: Fila, id: string, mudar: (item: OperacaoPendente) => OperacaoPendente): Fila {
  return { ...fila, operacoes: fila.operacoes.map((item) => (item.id === id ? mudar(item) : item)) };
}

export function somarMs(instante: string, ms: number): string {
  return new Date(new Date(instante).getTime() + ms).toISOString();
}
