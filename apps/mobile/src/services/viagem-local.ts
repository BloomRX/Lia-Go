/**
 * O que a tela pode mostrar da viagem aberta.
 *
 * O aparelho guarda **uma viagem por vez** (a aberta). Enquanto a troca de viagem não termina, o
 * cache ainda pode ser o da viagem anterior — e mostrar esses dados seria mentir sobre a viagem que
 * está na tela. Foi exatamente o defeito relatado em 2026-10-15: "criei outra viagem e ele volta para
 * a primeira cancelada".
 *
 * Aqui a regra fica em um lugar só (e testável): se o detalhe guardado não é o da viagem pedida,
 * a tela recebe vazio e mostra "carregando" — nunca dado de outra viagem.
 */
import type { EstadoSincronizacao } from "../offline/sincronizador.ts";
import type { AtividadeApi, DespesaApi, DocumentoApi, ItemChecklistApi, MovimentoApi } from "./api.ts";
import type { DetalheViagemLocal } from "@lia-go/sync";
import type { Atividade, Documento, ItemChecklist } from "@lia-go/domain";

export interface DadosDaViagemAberta {
  detalhe: DetalheViagemLocal | null;
  despesas: DespesaApi[];
  movimentos: MovimentoApi[];
  atividades: AtividadeApi[];
  /** Reservas da viagem aberta (já filtradas: nada de reserva de outra viagem). */
  reservas: Record<string, unknown>[];
  /** Checklist da viagem aberta (tela 15). */
  itensChecklist: Record<string, unknown>[];
  /** Documentos que **eu** posso ver (o servidor já filtrou; o aparelho nunca recebe o que é privado de outra pessoa). */
  documentos: Record<string, unknown>[];
}

export function dadosDaViagemAberta(estado: EstadoSincronizacao, viagemId: string): DadosDaViagemAberta {
  const detalhe = estado.carga.viagem;
  const donoDoCache = detalhe?.viagem?.id ?? null;

  if (donoDoCache !== viagemId) {
    return { detalhe: null, despesas: [], movimentos: [], atividades: [], reservas: [], itensChecklist: [], documentos: [] };
  }

  const atividades = (estado.carga.atividades as unknown as AtividadeApi[]).filter(
    // Atividade carrega a própria viagem: mesmo com cache misturado, uma atividade de outra viagem
    // não entra nesta tela.
    (atividade) => atividade.viagemId === undefined || atividade.viagemId === viagemId,
  );

  const reservas = ((estado.carga.reservas ?? []) as unknown as { viagemId?: string }[]).filter(
    // Mesma defesa da atividade: reserva de outra viagem não entra nesta tela.
    (reserva) => reserva.viagemId === undefined || reserva.viagemId === viagemId,
  ) as unknown as Record<string, unknown>[];

  const itensChecklist = ((estado.carga.itensChecklist ?? []) as unknown as { viagemId?: string }[]).filter(
    (item) => item.viagemId === undefined || item.viagemId === viagemId,
  ) as unknown as Record<string, unknown>[];

  const documentos = ((estado.carga.documentos ?? []) as unknown as { viagemId?: string }[]).filter(
    // Defesa em profundidade: mesmo que algo escape da filtragem do servidor, um documento que não é
    // desta viagem não entra na tela.
    (documento) => documento.viagemId === undefined || documento.viagemId === viagemId,
  ) as unknown as Record<string, unknown>[];

  return {
    detalhe,
    despesas: estado.carga.despesas as unknown as DespesaApi[],
    movimentos: estado.carga.movimentos as unknown as MovimentoApi[],
    atividades,
    reservas,
    itensChecklist,
    documentos,
  };
}

/** Permissão que pode vir ausente de um cache antigo: nunca derruba a tela por isso. */
export function pode(permissao: { permitido?: boolean } | undefined | null): boolean {
  return permissao?.permitido === true;
}

/**
 * Atividade como o domínio entende (o aparelho guarda o mesmo objeto que o servidor devolve).
 * Devolve `null` para item inválido: dado estragado no cache não derruba a tela.
 */
export function atividadeDoDominio(item: Record<string, unknown>): Atividade | null {
  if (typeof item["id"] !== "string" || typeof item["dia"] !== "string") return null;
  const custo = (item["custo"] ?? {}) as { centavos?: string | null; natureza?: Atividade["custoNatureza"]; aVerificar?: boolean };
  return {
    id: item["id"],
    viagemId: String(item["viagemId"] ?? ""),
    autorId: String(item["autorId"] ?? ""),
    dia: item["dia"],
    ordem: Number(item["ordem"] ?? 1),
    titulo: String(item["titulo"] ?? ""),
    hora: (item["hora"] as string | null) ?? null,
    duracaoMinutos: (item["duracaoMinutos"] as number | null) ?? null,
    local: (item["local"] as string | null) ?? null,
    custoCentavos: custo.centavos ? BigInt(custo.centavos) : null,
    custoNatureza: custo.natureza ?? null,
    custoAVerificar: Boolean(custo.aVerificar),
    estado: (item["estado"] as Atividade["estado"]) ?? "planejada",
    concluidaPor: (item["concluidaPor"] as string | null) ?? null,
    concluidaEm: (item["concluidaEm"] as string | null) ?? null,
    observacao: (item["observacao"] as string | null) ?? null,
    deslocamento: (item["deslocamento"] as Atividade["deslocamento"]) ?? null,
    versao: Number(item["versao"] ?? 1),
  };
}

/** Atividades da viagem, prontas para as funções do domínio (roteiro e orçamento). */
export function atividadesDoDominio(estado: EstadoSincronizacao, viagemId: string): Atividade[] {
  return dadosDaViagemAberta(estado, viagemId)
    .atividades.map((item) => atividadeDoDominio(item as unknown as Record<string, unknown>))
    .filter((atividade): atividade is Atividade => atividade !== null);
}

/**
 * Item do checklist como o domínio entende. `null` para item estragado no cache: dado ruim do
 * aparelho não derruba a tela (mesma regra de `atividadeDoDominio`).
 */
export function itemChecklistDoDominio(item: Record<string, unknown>): ItemChecklist | null {
  if (typeof item["id"] !== "string" || typeof item["titulo"] !== "string") return null;
  return {
    id: item["id"],
    viagemId: String(item["viagemId"] ?? ""),
    autorId: String(item["autorId"] ?? ""),
    titulo: item["titulo"],
    categoria: (item["categoria"] as ItemChecklist["categoria"]) ?? "outro",
    responsavelId: (item["responsavelId"] as string | null) ?? null,
    prazo: (item["prazo"] as string | null) ?? null,
    estado: (item["estado"] as ItemChecklist["estado"]) ?? "aberto",
    feitoPor: (item["feitoPor"] as string | null) ?? null,
    feitoEm: (item["feitoEm"] as string | null) ?? null,
    observacao: (item["observacao"] as string | null) ?? null,
    motivoReabertura: (item["motivoReabertura"] as string | null) ?? null,
    versao: Number(item["versao"] ?? 1),
  };
}

/** Checklist da viagem aberta, pronto para as funções do domínio (resumo e ordem). */
export function checklistDoDominio(estado: EstadoSincronizacao, viagemId: string): ItemChecklist[] {
  return dadosDaViagemAberta(estado, viagemId)
    .itensChecklist.map((item) => itemChecklistDoDominio(item))
    .filter((item): item is ItemChecklist => item !== null);
}

/** Documento como o domínio entende (a visibilidade é decidida no servidor; aqui só leitura). */
export function documentoDoDominio(item: Record<string, unknown>): Documento | null {
  if (typeof item["id"] !== "string" || typeof item["nome"] !== "string") return null;
  return {
    id: item["id"],
    viagemId: String(item["viagemId"] ?? ""),
    autorId: String(item["autorId"] ?? ""),
    tipo: (item["tipo"] as Documento["tipo"]) ?? "outro",
    nome: item["nome"],
    descricao: (item["descricao"] as string | null) ?? null,
    link: (item["link"] as string | null) ?? null,
    visibilidade: (item["visibilidade"] as Documento["visibilidade"]) ?? "privado",
    compartilhadoCom: Array.isArray(item["compartilhadoCom"]) ? (item["compartilhadoCom"] as string[]) : [],
    estado: (item["estado"] as Documento["estado"]) ?? "ativo",
    removidoPor: (item["removidoPor"] as string | null) ?? null,
    removidoEm: (item["removidoEm"] as string | null) ?? null,
    motivoRemocao: (item["motivoRemocao"] as string | null) ?? null,
    versao: Number(item["versao"] ?? 1),
  };
}

export function documentosDoDominio(estado: EstadoSincronizacao, viagemId: string): Documento[] {
  return dadosDaViagemAberta(estado, viagemId)
    .documentos.map((item) => documentoDoDominio(item))
    .filter((documento): documento is Documento => documento !== null);
}

/** Nome de quem participa, para a tela mostrar gente em vez de identificador. */
export function nomePorId(participantes: { usuario_id?: string; nome?: string }[], usuarioId: string | null): string {
  if (usuarioId === null) return "sem responsável";
  return participantes.find((pessoa) => pessoa.usuario_id === usuarioId)?.nome ?? "participante";
}

/**
 * Próximo compromisso do roteiro (destaque da Visão geral, referência `concept-03`).
 *
 * Regras: só o que ainda **vale** (planejada), só a partir de agora, e sem hora o compromisso vale
 * pelo dia inteiro — por isso ele fica no fim do próprio dia, não no começo. Devolve `null` quando
 * não há nada à frente: a tela então não inventa um "próximo" que não existe.
 */
export function proximoCompromisso(
  atividades: readonly Atividade[],
  agora: { dia: string; hora: string },
): Atividade | null {
  const candidatas = atividades
    .filter((atividade) => atividade.estado === "planejada")
    .filter((atividade) => {
      if (atividade.dia > agora.dia) return true;
      if (atividade.dia < agora.dia) return false;
      // Mesmo dia: com hora, precisa ser depois de agora; sem hora, ainda é o compromisso de hoje.
      return atividade.hora === null || atividade.hora >= agora.hora;
    })
    .sort((a, b) => {
      if (a.dia !== b.dia) return a.dia < b.dia ? -1 : 1;
      const horaA = a.hora ?? "99:99";
      const horaB = b.hora ?? "99:99";
      if (horaA !== horaB) return horaA < horaB ? -1 : 1;
      return a.ordem - b.ordem;
    });
  return candidatas[0] ?? null;
}

/** Rótulo humano do "quando" do próximo compromisso (hoje, amanhã ou o dia). */
export function quandoDoCompromisso(dia: string, hora: string | null, hoje: string): string {
  const [ano, mes, dataDia] = hoje.split("-").map(Number);
  const amanha = new Date(Date.UTC(ano!, (mes ?? 1) - 1, (dataDia ?? 1) + 1, 12)).toISOString().slice(0, 10);
  const quando = dia === hoje ? "hoje" : dia === amanha ? "amanhã" : dia.split("-").reverse().join("/");
  return hora === null ? `${quando}, sem hora marcada` : `${quando} às ${hora}`;
}
