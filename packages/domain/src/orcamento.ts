/**
 * Limite de orçamento da viagem (tela 9) — coletivo e individual.
 *
 * Decisões que este arquivo garante:
 *  - o limite é **planejamento**, não dinheiro oficial: quem manda no saldo continua sendo o servidor
 *    (`calcularResumoFinanceiro`). A barra da tela nunca substitui o saldo;
 *  - o previsto do roteiro/reservas é comparado **separado** do gasto confirmado — quem lê precisa
 *    saber o que já saiu do bolso e o que ainda é plano;
 *  - alerta é **texto**, nunca só cor (diretriz de acessibilidade);
 *  - sem limite definido o app diz isso ("sem limite"), em vez de fingir um teto que ninguém combinou.
 */
import { ErroDeDominio } from "./erros.ts";
import { formatarBRL, type Centavos } from "./money.ts";

export type EscopoDeLimite = "coletivo" | "individual";

/** A partir daqui a tela avisa que o limite está perto (percentual, inteiro). */
export const LIMITE_DE_ATENCAO_PERCENTUAL = 80n;

export interface LimiteDeOrcamento {
  viagemId: string;
  escopo: EscopoDeLimite;
  /** Preenchido só no individual: o limite é daquela pessoa. */
  usuarioId: string | null;
  centavos: Centavos;
  atualizadoPor: string;
  atualizadoEm: string;
  versao: number;
}

export interface EntradaDeLimite {
  viagemId: string;
  escopo: EscopoDeLimite;
  usuarioId?: string | null;
  centavos: Centavos;
  porId: string;
  em?: string;
  versao?: number;
}

export function definirLimite(entrada: EntradaDeLimite): LimiteDeOrcamento {
  if (entrada.centavos < 0n) throw new ErroDeDominio("O limite não pode ser negativo.");
  if (entrada.escopo === "coletivo" && (entrada.usuarioId ?? null) !== null) {
    throw new ErroDeDominio("Limite coletivo não pertence a uma pessoa.");
  }
  if (entrada.escopo === "individual" && !entrada.usuarioId) {
    throw new ErroDeDominio("Limite individual precisa dizer de quem é.");
  }
  return {
    viagemId: entrada.viagemId,
    escopo: entrada.escopo,
    usuarioId: entrada.escopo === "individual" ? (entrada.usuarioId as string) : null,
    centavos: entrada.centavos,
    atualizadoPor: entrada.porId,
    atualizadoEm: entrada.em ?? new Date().toISOString(),
    versao: entrada.versao ?? 1,
  };
}

export type EstadoDoOrcamento = "sem_limite" | "dentro" | "atencao" | "estourado";

export interface SituacaoDoOrcamento {
  temLimite: boolean;
  limiteCentavos: Centavos | null;
  /** Planejamento: roteiro + reservas com valor conhecido. */
  previstoCentavos: Centavos;
  /** Oficial: despesas confirmadas (o que o servidor considera gasto). */
  gastoConfirmadoCentavos: Centavos;
  /** Visível, mas fora do oficial: lançado e aguardando confirmação. */
  aguardandoCentavos: Centavos;
  restantePrevistoCentavos: Centavos | null;
  restanteGastoCentavos: Centavos | null;
  percentualPrevisto: number | null;
  percentualGasto: number | null;
  estado: EstadoDoOrcamento;
  /** Frases prontas para a tela (nunca só cor ou só ícone). */
  alertas: string[];
  resumo: string;
}

export interface EntradaDeSituacao {
  limiteCentavos: Centavos | null;
  previstoCentavos: Centavos;
  gastoConfirmadoCentavos: Centavos;
  aguardandoCentavos?: Centavos;
  /** Custos sem valor informado (roteiro/reservas): o previsto é o mínimo, não a verdade. */
  custosAVerificar?: number;
}

function percentual(valor: Centavos, limite: Centavos): number | null {
  if (limite <= 0n) return null;
  return Number((valor * 100n) / limite);
}

export function situacaoDoOrcamento(entrada: EntradaDeSituacao): SituacaoDoOrcamento {
  const limite = entrada.limiteCentavos;
  const previsto = entrada.previstoCentavos;
  const gasto = entrada.gastoConfirmadoCentavos;
  const aguardando = entrada.aguardandoCentavos ?? 0n;
  const aVerificar = entrada.custosAVerificar ?? 0;

  const alertas: string[] = [];
  const base: SituacaoDoOrcamento = {
    temLimite: limite !== null,
    limiteCentavos: limite,
    previstoCentavos: previsto,
    gastoConfirmadoCentavos: gasto,
    aguardandoCentavos: aguardando,
    restantePrevistoCentavos: null,
    restanteGastoCentavos: null,
    percentualPrevisto: null,
    percentualGasto: null,
    estado: "sem_limite",
    alertas,
    resumo: "",
  };

  if (aVerificar > 0) {
    alertas.push(
      aVerificar === 1
        ? "1 custo ainda sem valor informado: o previsto é o mínimo, não o total."
        : `${aVerificar} custos ainda sem valor informado: o previsto é o mínimo, não o total.`,
    );
  }

  if (limite === null) {
    return {
      ...base,
      resumo: previsto > 0n ? `Sem limite definido. Previsto: ${formatarBRL(previsto)}.` : "Sem limite definido e nada previsto ainda.",
    };
  }

  const percentualPrevisto = percentual(previsto, limite);
  const percentualGasto = percentual(gasto, limite);
  const restantePrevisto = limite - previsto;
  const restanteGasto = limite - gasto;

  if (limite === 0n) {
    if (previsto > 0n || gasto > 0n) {
      alertas.push("O limite está em zero: qualquer valor previsto ou gasto passa do combinado.");
      return {
        ...base,
        restantePrevistoCentavos: restantePrevisto,
        restanteGastoCentavos: restanteGasto,
        estado: "estourado",
        resumo: `Limite ${formatarBRL(0n)}. Previsto ${formatarBRL(previsto)} · gasto confirmado ${formatarBRL(gasto)}.`,
      };
    }
    return {
      ...base,
      restantePrevistoCentavos: 0n,
      restanteGastoCentavos: 0n,
      percentualPrevisto: 0,
      percentualGasto: 0,
      estado: "dentro",
      resumo: `Limite ${formatarBRL(0n)} e nada previsto nem gasto.`,
    };
  }

  const estourouGasto = gasto > limite;
  const estourouPrevisto = previsto > limite;
  const gastoPerto = percentualGasto !== null && BigInt(percentualGasto) >= LIMITE_DE_ATENCAO_PERCENTUAL;
  const previstoPerto = percentualPrevisto !== null && BigInt(percentualPrevisto) >= LIMITE_DE_ATENCAO_PERCENTUAL;

  if (estourouGasto) {
    alertas.push(`O gasto confirmado passou do limite em ${formatarBRL(gasto - limite)}.`);
  }
  if (estourouPrevisto && !estourouGasto) {
    alertas.push(`O previsto passou do limite em ${formatarBRL(previsto - limite)} — ainda dá para replanejar antes de gastar.`);
  }
  if (!estourouGasto && gastoPerto) {
    alertas.push(`O gasto confirmado chegou a ${percentualGasto}% do limite.`);
  }
  if (!estourouPrevisto && previstoPerto) {
    alertas.push(`O previsto chegou a ${percentualPrevisto}% do limite.`);
  }

  const estado: EstadoDoOrcamento = estourouGasto || estourouPrevisto ? "estourado" : gastoPerto || previstoPerto ? "atencao" : "dentro";
  const partes = [`Previsto ${formatarBRL(previsto)} de ${formatarBRL(limite)}`];
  if (percentualPrevisto !== null) partes[0] += ` (${percentualPrevisto}%)`;
  partes.push(`gasto confirmado ${formatarBRL(gasto)}`);
  if (aguardando > 0n) partes.push(`${formatarBRL(aguardando)} aguardando confirmação`);

  return {
    ...base,
    restantePrevistoCentavos: restantePrevisto,
    restanteGastoCentavos: restanteGasto,
    percentualPrevisto,
    percentualGasto,
    estado,
    resumo: `${partes.join(" · ")}.`,
  };
}

/** Texto curto do estado, para etiqueta. Nunca é a única informação: vem com o número ao lado. */
export const ROTULO_ESTADO_ORCAMENTO: Record<EstadoDoOrcamento, string> = {
  sem_limite: "Sem limite",
  dentro: "Dentro do limite",
  atencao: "Perto do limite",
  estourado: "Passou do limite",
};
