import { ErroDeDominio } from "./erros.ts";
/**
 * Papéis, ações e autorização — a mesma tabela usada pelo servidor (autoridade)
 * e pela interface (para mostrar ou esconder ações e explicar o motivo).
 * A decisão final é sempre do servidor; aqui não há I/O.
 */

export type Papel = "organizador" | "participante";
export type EstadoMembro = "ativo" | "convidado" | "saiu" | "removido";
export type EstadoViagem = "rascunho" | "planejada" | "em_andamento" | "concluida" | "pendente" | "cancelada";

export type Acao =
  | "viagem:editar"
  | "viagem:transicionar"
  | "viagem:cancelar"
  | "viagem:participante:adicionar"
  | "viagem:participante:remover"
  | "viagem:convite:gerenciar"
  | "viagem:relatorio:ampliado"
  | "despesa:criar"
  | "despesa:confirmar"
  | "despesa:contestar"
  | "despesa:corrigir"
  | "atividade:criar"
  | "atividade:corrigir"
  | "atividade:concluir"
  | "atividade:cancelar"
  | "reserva:criar"
  | "reserva:confirmar"
  | "reserva:cancelar";

export interface ContextoAutorizacao {
  papel: Papel;
  estadoMembro: EstadoMembro;
  estadoViagem: EstadoViagem;
}

export interface DecisaoAutorizacao {
  permitido: boolean;
  /** Motivo legível para a interface (nunca inclui dados sensíveis). */
  motivo: string;
}

const NEGADO_SEM_ACESSO: DecisaoAutorizacao = {
  permitido: false,
  motivo: "Você não participa desta viagem com acesso ativo.",
};

/** Ações permitidas apenas na administração da viagem. */
const SOMENTE_ORGANIZADOR: ReadonlySet<Acao> = new Set<Acao>([
  "viagem:editar",
  "viagem:cancelar",
  "viagem:participante:adicionar",
  "viagem:participante:remover",
  "viagem:convite:gerenciar",
  "viagem:relatorio:ampliado",
]);

/**
 * Depois de cancelada, só correções e encerramento são permitidos.
 * No roteiro vale o mesmo princípio das despesas: não se **planeja** nada novo, mas registrar o que
 * aconteceu com o que já existia (concluir, cancelar a atividade, corrigir) continua valendo.
 */
const PERMITIDAS_APOS_CANCELAMENTO: ReadonlySet<Acao> = new Set<Acao>([
  "viagem:relatorio:ampliado",
  "despesa:corrigir",
  "despesa:confirmar",
  "despesa:contestar",
  "atividade:corrigir",
  "atividade:concluir",
  "atividade:cancelar",
  // Reserva confirmada/cancelada depois do cancelamento da viagem é registro do que houve com o
  // que já existia (mesma lógica das despesas) — o que não vale é **planejar** reserva nova.
  "reserva:confirmar",
  "reserva:cancelar",
]);

/**
 * Depois de a viagem ser concluída não se planeja mais nada novo (mesma regra de `despesa:criar`),
 * mas concluir/cancelar uma atividade que já existia continua valendo — é registro do que houve.
 */
const BLOQUEADAS_APOS_CONCLUSAO: ReadonlySet<Acao> = new Set<Acao>(["despesa:criar", "viagem:editar", "atividade:criar", "reserva:criar"]);

export function decidirAutorizacao(contexto: ContextoAutorizacao, acao: Acao): DecisaoAutorizacao {
  if (contexto.estadoMembro !== "ativo") return NEGADO_SEM_ACESSO;

  if (contexto.estadoViagem === "cancelada" && !PERMITIDAS_APOS_CANCELAMENTO.has(acao)) {
    return {
      permitido: false,
      motivo: "A viagem está cancelada: novos compromissos ficam bloqueados; restam correções e encerramento.",
    };
  }

  if (contexto.estadoViagem === "concluida" && BLOQUEADAS_APOS_CONCLUSAO.has(acao)) {
    return {
      permitido: false,
      motivo: "Viagem concluída: correções e acertos continuam permitidos, novos lançamentos não.",
    };
  }

  if (SOMENTE_ORGANIZADOR.has(acao)) {
    return contexto.papel === "organizador"
      ? { permitido: true, motivo: "Ação administrativa do organizador." }
      : { permitido: false, motivo: "Somente o organizador pode executar esta ação." };
  }

  return { permitido: true, motivo: "Participante com acesso ativo." };
}

export function pode(contexto: ContextoAutorizacao, acao: Acao): boolean {
  return decidirAutorizacao(contexto, acao).permitido;
}

/** Qualquer participante com acesso ativo confirma início/fim da viagem (regra confirmada). */
export function podeConfirmarEstadoDaViagem(contexto: ContextoAutorizacao): DecisaoAutorizacao {
  if (contexto.estadoMembro !== "ativo") return NEGADO_SEM_ACESSO;
  if (contexto.estadoViagem === "cancelada") {
    return { permitido: false, motivo: "Viagem cancelada não muda de estado." };
  }
  if (contexto.estadoViagem === "concluida") {
    return { permitido: false, motivo: "Viagem concluída não reabre automaticamente." };
  }
  return { permitido: true, motivo: "Qualquer participante com acesso ativo pode confirmar." };
}

/** Quem pode confirmar um lançamento: pessoa diferente do autor (regra confirmada). */
export function podeConfirmarDespesa(
  contexto: ContextoAutorizacao,
  autorId: string,
  revisorId: string,
): DecisaoAutorizacao {
  const base = decidirAutorizacao(contexto, "despesa:confirmar");
  if (!base.permitido) return base;
  if (autorId === revisorId) {
    return { permitido: false, motivo: "Quem lançou a despesa não pode confirmá-la; outra pessoa precisa revisar." };
  }
  return { permitido: true, motivo: "Revisão independente do lançamento." };
}
