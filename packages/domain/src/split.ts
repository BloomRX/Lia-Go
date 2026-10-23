/**
 * Rateio de despesas — métodos definidos nas regras de negócio.
 * Toda divisão usa inteiros (centavos/basis points) e a soma das partes é
 * exatamente igual ao total, com explicação transparente de quem recebeu o resto.
 */
import { type Centavos, absoluto, alocarProporcional, somar } from "./money.ts";
import { ErroDeDominio } from "./erros.ts";

export type IdParticipante = string;

/** Basis points: 10.000 bps = 100%. Evita float em percentuais. */
export type BasisPoints = number;

export type Rateio =
  | { metodo: "igualitario"; participantes: readonly IdParticipante[] }
  | { metodo: "valores"; partes: readonly { participanteId: IdParticipante; valor: Centavos }[] }
  | { metodo: "percentual"; partes: readonly { participanteId: IdParticipante; bps: BasisPoints }[] };

export interface ParteCalculada {
  participanteId: IdParticipante;
  valor: Centavos;
  /** Centavos extras recebidos na distribuição do resto (0 ou 1). */
  ajusteResto: number;
}

export interface ResultadoRateio {
  partes: ParteCalculada[];
  total: Centavos;
  /** Texto pronto para a interface explicar a distribuição dos centavos. */
  explicacao: string;
  ajusteTotal: Centavos;
}

export const BPS_TOTAL = 10_000;

function validarDuplicados(ids: readonly IdParticipante[]): void {
  const vistos = new Set<IdParticipante>();
  for (const id of ids) {
    if (!id) throw new ErroDeDominio("Participante sem identificação no rateio.");
    if (vistos.has(id)) throw new ErroDeDominio(`Participante repetido no rateio: ${id}.`);
    vistos.add(id);
  }
}

export function calcularRateio(total: Centavos, rateio: Rateio): ResultadoRateio {
  if (total < 0n) throw new ErroDeDominio("O total da despesa não pode ser negativo.");

  if (rateio.metodo === "igualitario") {
    const participantes = rateio.participantes;
    if (participantes.length === 0) throw new ErroDeDominio("Informe ao menos um participante no rateio igualitário.");
    validarDuplicados(participantes);
    const { valores, ajustes } = alocarProporcional(total, participantes.map(() => 1n));
    const partes = participantes.map((participanteId, indice) => ({
      participanteId,
      valor: valores[indice] ?? 0n,
      ajusteResto: ajustes[indice] ?? 0,
    }));
    const receberamResto = partes.filter((parte) => parte.ajusteResto > 0).map((parte) => parte.participanteId);
    const explicacao =
      receberamResto.length === 0
        ? "Divisão igualitária sem sobra de centavos."
        : `Divisão igualitária: ${receberamResto.length} participante(s) recebeu(ram) o centavo restante (${receberamResto.join(", ")}).`;
    return { partes, total, explicacao, ajusteTotal: total };
  }

  if (rateio.metodo === "valores") {
    const partes = rateio.partes;
    if (partes.length === 0) throw new ErroDeDominio("Informe ao menos uma parte no rateio por valores.");
    validarDuplicados(partes.map((parte) => parte.participanteId));
    if (partes.some((parte) => parte.valor < 0n)) throw new ErroDeDominio("Parte do rateio não pode ser negativa.");
    const soma = somar(...partes.map((parte) => parte.valor));
    if (soma !== total) {
      throw new ErroDeDominio(`A soma das partes (${soma}) deve ser exatamente igual ao total (${total}).`);
    }
    return {
      partes: partes.map((parte) => ({ participanteId: parte.participanteId, valor: parte.valor, ajusteResto: 0 })),
      total,
      explicacao: "Rateio por valores fixos informados; a soma confere com o total.",
      ajusteTotal: total,
    };
  }

  const partes = rateio.partes;
  if (partes.length === 0) throw new ErroDeDominio("Informe ao menos uma parte no rateio percentual.");
  validarDuplicados(partes.map((parte) => parte.participanteId));
  if (partes.some((parte) => !Number.isInteger(parte.bps) || parte.bps < 0)) {
    throw new ErroDeDominio("Percentuais devem ser inteiros em basis points (10.000 = 100%).");
  }
  const somaBps = partes.reduce((soma, parte) => soma + parte.bps, 0);
  if (somaBps !== BPS_TOTAL) {
    throw new ErroDeDominio(`Os percentuais devem somar 100% (10.000 bps); soma atual: ${somaBps} bps.`);
  }
  const { valores, ajustes } = alocarProporcional(total, partes.map((parte) => BigInt(parte.bps)));
  const calculadas = partes.map((parte, indice) => ({
    participanteId: parte.participanteId,
    valor: valores[indice] ?? 0n,
    ajusteResto: ajustes[indice] ?? 0,
  }));
  const receberamResto = calculadas.filter((parte) => parte.ajusteResto > 0).map((parte) => parte.participanteId);
  return {
    partes: calculadas,
    total,
    explicacao:
      receberamResto.length === 0
        ? "Rateio percentual sem sobra de centavos."
        : `Rateio percentual: o centavo da sobra ficou com ${receberamResto.join(", ")}.`,
    ajusteTotal: total,
  };
}

export function validarSomaExata(partes: readonly { valor: Centavos }[], total: Centavos): boolean {
  return somar(...partes.map((parte) => absoluto(parte.valor))) === absoluto(total);
}
