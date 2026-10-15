/**
 * Tipos da sincronização local-first.
 *
 * Princípios (ver docs/DECISIONS_AND_OPEN_QUESTIONS.md):
 *  1. O aparelho é a verdade imediata; o servidor é a verdade compartilhada.
 *  2. Nada é aplicado no servidor sem chave de idempotência (reenvio nunca duplica).
 *  3. Dinheiro nunca é resolvido sozinho: conflito de valor exige decisão humana.
 */

/** Operações que podem ser enfileiradas no aparelho. */
export type Operacao =
  | { tipo: "criar_viagem"; corpo: Record<string, unknown>; descricao: string }
  | { tipo: "transicao_viagem"; viagemId: string; para: string; versao: number; descricao: string }
  | { tipo: "criar_despesa"; viagemId: string; corpo: Record<string, unknown>; descricao: string }
  | { tipo: "confirmar_despesa"; viagemId: string; despesaId: string; descricao: string }
  | { tipo: "contestar_despesa"; viagemId: string; despesaId: string; motivo: string; descricao: string }
  | { tipo: "criar_movimento"; viagemId: string; corpo: Record<string, unknown>; descricao: string }
  | { tipo: "confirmar_movimento"; viagemId: string; movimentoId: string; descricao: string }
  | { tipo: "contestar_movimento"; viagemId: string; movimentoId: string; motivo: string; descricao: string }
  | { tipo: "criar_atividade"; viagemId: string; corpo: Record<string, unknown>; descricao: string }
  | { tipo: "concluir_atividade"; viagemId: string; atividadeId: string; observacao?: string; versao?: number; descricao: string }
  | { tipo: "cancelar_atividade"; viagemId: string; atividadeId: string; motivo: string; versao?: number; descricao: string }
  | { tipo: "corrigir_atividade"; viagemId: string; atividadeId: string; corpo: Record<string, unknown>; descricao: string }
  | { tipo: "criar_reserva"; viagemId: string; corpo: Record<string, unknown>; descricao: string }
  | { tipo: "confirmar_reserva"; viagemId: string; reservaId: string; confirmacao: string; versao?: number; descricao: string }
  | { tipo: "cancelar_reserva"; viagemId: string; reservaId: string; motivo: string; versao?: number; descricao: string }
  | { tipo: "criar_item_checklist"; viagemId: string; corpo: Record<string, unknown>; descricao: string }
  | { tipo: "concluir_item_checklist"; viagemId: string; itemId: string; versao?: number; descricao: string }
  | { tipo: "reabrir_item_checklist"; viagemId: string; itemId: string; motivo: string; versao?: number; descricao: string }
  | { tipo: "criar_documento"; viagemId: string; corpo: Record<string, unknown>; descricao: string };

export type TipoOperacao = Operacao["tipo"];

/**
 * Estados de uma operação na fila. É exatamente o que a interface mostra ao usuário:
 * aguardando → enviando → enviada (sai da fila) | falhou | conflito.
 */
export type EstadoOperacao = "aguardando" | "enviando" | "falhou" | "conflito";

/** Erro vindo do servidor (ou da rede) ao tentar enviar uma operação. */
export interface ErroEnvio {
  /** Código da API (`rede`, `regra_violada`, `sem_acesso`, `conflito`, `erro_interno`…). */
  codigo: string;
  mensagem: string;
  /** Status HTTP quando houve resposta; ausente quando a rede falhou. */
  status?: number;
  /** Dados úteis para a decisão do usuário em caso de conflito (versão atual, valores). */
  detalhes?: unknown;
}

export interface OperacaoPendente {
  /** Identificador da operação no aparelho. É também a chave de idempotência enviada à API. */
  id: string;
  operacao: Operacao;
  estado: EstadoOperacao;
  /** Fila em ordem de criação: o aparelho preserva a ordem causal ao enviar. */
  criadaEm: string;
  tentativas: number;
  /** Só faz sentido enquanto o estado é `aguardando`. */
  proximaTentativaEm: string;
  erro?: ErroEnvio;
}

/** A fila inteira. Imutável: cada função devolve uma fila nova. */
export interface Fila {
  operacoes: OperacaoPendente[];
  /** Última vez em que a fila ficou vazia após um envio bem-sucedido. */
  ultimoSucessoEm?: string;
}

export type EstadoGeralFila = "sincronizado" | "pendente" | "enviando" | "com_problema";

export interface ResumoFila {
  estado: EstadoGeralFila;
  total: number;
  aguardando: number;
  enviando: number;
  falhou: number;
  conflito: number;
  /** Texto pronto para a interface, em linguagem simples. */
  rotulo: string;
}

/**
 * Detalhe da viagem como a tela recebe: a viagem, quem participa, permissões de quem perguntou,
 * pendências e a sugestão de estado. É um objeto só (com a versão da viagem) para não existir
 * a tela com a viagem de um jeito e a lista de participantes de outro.
 */
export interface DetalheViagemLocal {
  viagem: Record<string, unknown> & { id: string; versao: number };
  papel?: string;
  participantes?: Record<string, unknown>[];
  pendencias?: unknown;
  sugestao?: unknown;
  permissoes?: unknown;
}

/** Carga local: exatamente o que a interface desenha, vinda do servidor ou do cache. */
export interface CargaLocal {
  /** Lista da tela inicial (todas as viagens da conta). */
  viagens: Record<string, unknown>[];
  /** Viagem aberta na tela, com participantes e permissões. */
  viagem: DetalheViagemLocal | null;
  despesas: Record<string, unknown>[];
  movimentos: Record<string, unknown>[];
  /** Roteiro da viagem aberta (atividades por dia). */
  atividades: Record<string, unknown>[];
  /** Reservas da viagem aberta (hospedagem, transporte, passeio, outro). */
  reservas: Record<string, unknown>[];
  /** Checklist da viagem aberta (tela 15). */
  itensChecklist: Record<string, unknown>[];
  /**
   * Documentos da viagem aberta (tela 16). O servidor só manda o que **eu** posso ver: documento
   * privado de outra pessoa nunca chega ao aparelho (nem para o organizador).
   */
  documentos: Record<string, unknown>[];
  /** Convites da viagem aberta (quem o organizador convidou). */
  convites: Record<string, unknown>[];
  /** Convites que **eu** recebi e ainda não aceitei — vêm da lista de viagens. */
  convitesParaMim: Record<string, unknown>[];
}

export interface CargaRemota extends Partial<CargaLocal> {
  viagemId?: string;
}

export interface ResultadoEnvio {
  ok: boolean;
  /** Corpo devolvido pela API quando deu certo (a entidade criada, por exemplo). */
  resposta?: unknown;
  erro?: ErroEnvio;
}

export interface RelatorioSincronizacao {
  enviados: number;
  falharam: number;
  conflitos: number;
  aguardando: number;
  cursor: string | null;
  buscadasMudancas: boolean;
  atualizadoEm: string;
  /** Por que a passada parou: útil para explicar ao usuário e para os testes. */
  parada: "fila_vazia" | "offline" | "reenvio_agendado" | "erro_de_rede_na_busca" | "nada_a_fazer" | "trocou_de_viagem";
}
