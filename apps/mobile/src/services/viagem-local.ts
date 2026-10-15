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
import type { AtividadeApi, DespesaApi, MovimentoApi } from "./api.ts";
import type { DetalheViagemLocal } from "@lia-go/sync";
import type { Atividade } from "@lia-go/domain";

export interface DadosDaViagemAberta {
  detalhe: DetalheViagemLocal | null;
  despesas: DespesaApi[];
  movimentos: MovimentoApi[];
  atividades: AtividadeApi[];
  /** Reservas da viagem aberta (já filtradas: nada de reserva de outra viagem). */
  reservas: Record<string, unknown>[];
}

export function dadosDaViagemAberta(estado: EstadoSincronizacao, viagemId: string): DadosDaViagemAberta {
  const detalhe = estado.carga.viagem;
  const donoDoCache = detalhe?.viagem?.id ?? null;

  if (donoDoCache !== viagemId) {
    return { detalhe: null, despesas: [], movimentos: [], atividades: [], reservas: [] };
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

  return {
    detalhe,
    despesas: estado.carga.despesas as unknown as DespesaApi[],
    movimentos: estado.carga.movimentos as unknown as MovimentoApi[],
    atividades,
    reservas,
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
