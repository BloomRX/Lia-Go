/**
 * Estados da viagem e transições.
 * Regras confirmadas: a data, sozinha, nunca muda o estado; qualquer participante
 * com acesso ativo confirma início e fim; "pendente" exige motivo explícito e
 * confirmação humana; "concluída" nunca reabre automaticamente; cancelamento é
 * assistido e não cancela reservas/despesas automaticamente.
 */
import type { Papel, EstadoMembro, EstadoViagem } from "./permissions.ts";
import { podeConfirmarEstadoDaViagem } from "./permissions.ts";
import { ErroDeDominio } from "./erros.ts";

export type { EstadoViagem } from "./permissions.ts";

export interface Viagem {
  id: string;
  estado: EstadoViagem;
  /** Data local de início no formato YYYY-MM-DD. */
  dataInicio: string | null;
  /** Data local de fim no formato YYYY-MM-DD. */
  dataFim: string | null;
  /** Fuso IANA da viagem, por exemplo America/Sao_Paulo. */
  fusoHorario: string;
  /** Versão para concorrência otimista. */
  versao: number;
}

export interface Ator {
  usuarioId: string;
  papel: Papel;
  estadoMembro: EstadoMembro;
}

export interface EventoAuditoria {
  acao: string;
  autorId: string;
  em: string;
  estadoAnterior: EstadoViagem;
  estadoNovo: EstadoViagem;
  motivo: string | null;
}

export interface ResultadoTransicao {
  viagem: Viagem;
  evento: EventoAuditoria;
}

export const ESTADOS_VIAGEM: readonly EstadoViagem[] = [
  "rascunho",
  "planejada",
  "em_andamento",
  "concluida",
  "pendente",
  "cancelada",
];

export const ROTULOS_ESTADO: Record<EstadoViagem, string> = {
  rascunho: "Rascunho",
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  pendente: "Pendente — com motivo",
  cancelada: "Cancelada",
};

interface RegraTransicao {
  de: readonly EstadoViagem[];
  para: EstadoViagem;
  papeis: readonly Papel[];
  exigeMotivo: boolean;
}

const REGRAS: readonly RegraTransicao[] = [
  { de: ["rascunho"], para: "planejada", papeis: ["organizador"], exigeMotivo: false },
  { de: ["planejada"], para: "rascunho", papeis: ["organizador"], exigeMotivo: false },
  { de: ["planejada", "pendente"], para: "em_andamento", papeis: ["organizador", "participante"], exigeMotivo: false },
  { de: ["em_andamento", "pendente"], para: "concluida", papeis: ["organizador", "participante"], exigeMotivo: false },
  {
    de: ["planejada", "em_andamento", "concluida", "pendente"],
    para: "pendente",
    papeis: ["organizador", "participante"],
    exigeMotivo: true,
  },
  {
    de: ["rascunho", "planejada", "em_andamento", "pendente"],
    para: "cancelada",
    papeis: ["organizador"],
    exigeMotivo: false,
  },
];

export function transicoesPermitidas(de: EstadoViagem): EstadoViagem[] {
  return REGRAS.filter((regra) => regra.de.includes(de)).map((regra) => regra.para);
}

/**
 * Decide a transição. `pendente` guarda o estado anterior para retomada pelo
 * organizador (a viagem pendente não perde o progresso).
 */
export function transicionar(
  viagem: Viagem,
  para: EstadoViagem,
  ator: Ator,
  opcoes: { motivo?: string | null; em?: string; estadoAnteriorDePendente?: EstadoViagem } = {},
): ResultadoTransicao {
  const em = opcoes.em ?? new Date().toISOString();
  if (ator.estadoMembro !== "ativo") {
    throw new ErroDeDominio("Apenas participantes com acesso ativo podem mudar o estado da viagem.");
  }
  if (viagem.estado === "cancelada") {
    throw new ErroDeDominio("Viagem cancelada não muda de estado; restam correções e encerramento.");
  }
  if (viagem.estado === "concluida" && para !== "pendente") {
    throw new ErroDeDominio("Viagem concluída não reabre automaticamente.");
  }

  const destino = para === "pendente" && viagem.estado === "pendente" ? "pendente" : para;
  const regra = REGRAS.find((candidata) => candidata.de.includes(viagem.estado) && candidata.para === destino);
  if (!regra) {
    throw new ErroDeDominio(`Transição não permitida: ${viagem.estado} → ${para}.`);
  }
  if (!regra.papeis.includes(ator.papel)) {
    throw new ErroDeDominio(
      ator.papel === "organizador"
        ? `Somente o organizador pode levar a viagem para ${ROTULOS_ESTADO[para]}.`
        : `Participantes não podem levar a viagem para ${ROTULOS_ESTADO[para]}; fale com o organizador.`,
    );
  }

  const motivo = opcoes.motivo?.trim() ?? "";
  if (regra.exigeMotivo && !motivo) {
    throw new ErroDeDominio("Para marcar a viagem como Pendente é obrigatório informar o motivo.");
  }

  const decisao = podeConfirmarEstadoDaViagem({
    papel: ator.papel,
    estadoMembro: ator.estadoMembro,
    estadoViagem: viagem.estado,
  });
  if (!decisao.permitido && (para === "em_andamento" || para === "concluida")) {
    throw new ErroDeDominio(decisao.motivo);
  }

  const estadoAnterior = viagem.estado;
  const proxima: Viagem = {
    ...viagem,
    estado: destino,
    versao: viagem.versao + 1,
  };
  const evento: EventoAuditoria = {
    acao: destino === "cancelada" ? "viagem:cancelar" : "viagem:transicionar",
    autorId: ator.usuarioId,
    em,
    estadoAnterior,
    estadoNovo: destino,
    motivo: motivo ? (destino === "pendente" ? motivo : `estado anterior: ${estadoAnterior} — ${motivo}`) : null,
  };
  return { viagem: proxima, evento };
}

/** Data de hoje (YYYY-MM-DD) no fuso da viagem, sem depender do relógio do aparelho. */
export function dataNoFuso(instanteIso: string, fusoHorario: string): string {
  const formatador = new Intl.DateTimeFormat("en-CA", {
    timeZone: fusoHorario,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatador.format(new Date(instanteIso));
}

export interface SugestaoEstado {
  sugestao: EstadoViagem;
  motivo: string;
  /** A sugestão nunca é aplicada sozinha. */
  requerConfirmacaoHumana: true;
}

/**
 * O sistema sugere; a pessoa confirma. Retorna null quando não há nada a sugerir.
 */
export function sugerirEstado(viagem: Viagem, agoraIso: string): SugestaoEstado | null {
  if (["concluida", "cancelada", "pendente"].includes(viagem.estado)) return null;
  const hoje = dataNoFuso(agoraIso, viagem.fusoHorario);
  if (viagem.dataInicio && viagem.dataFim) {
    if (hoje >= viagem.dataInicio && hoje <= viagem.dataFim && viagem.estado === "planejada") {
      return {
        sugestao: "em_andamento",
        motivo: `Hoje (${hoje}) está dentro das datas da viagem. A data sozinha não muda o estado: confirme para iniciar.`,
        requerConfirmacaoHumana: true,
      };
    }
    if (hoje > viagem.dataFim && viagem.estado === "em_andamento") {
      return {
        sugestao: "concluida",
        motivo: `A data final (${viagem.dataFim}) já passou. Confirme para concluir; pendências financeiras continuam abertas.`,
        requerConfirmacaoHumana: true,
      };
    }
    return null;
  }
  if (viagem.dataInicio && hoje > viagem.dataInicio && viagem.estado === "planejada") {
    return {
      sugestao: "em_andamento",
      motivo: `A data de início (${viagem.dataInicio}) já passou. Confirme para iniciar a viagem.`,
      requerConfirmacaoHumana: true,
    };
  }
  return null;
}

/** Impactos conhecidos a mostrar antes de cancelar (regra do cancelamento assistido). */
export function impactosDeCancelamento(entradas: {
  despesasPendentes: number;
  reservasRegistradas: number;
}): string[] {
  const impactos = [
    "A viagem passa para Cancelada e novos compromissos ficam bloqueados.",
    "Todos mantêm acesso aos registros autorizados e podem concluir pendências financeiras.",
  ];
  if (entradas.despesasPendentes > 0) {
    impactos.push(
      `${entradas.despesasPendentes} despesa(s) pendente(s) — nenhuma é cancelada automaticamente; reembolsos e ajustes exigem revisão.`,
    );
  }
  if (entradas.reservasRegistradas > 0) {
    impactos.push(
      `${entradas.reservasRegistradas} reserva(s) registradas — o Lia Go não cancela reservas externas; cancele você mesmo no fornecedor.`,
    );
  }
  impactos.push("O histórico é preservado; nada é apagado.");
  return impactos;
}
