/**
 * Saldos e acertos — cálculo determinístico (nunca IA, nunca estimativa silenciosa).
 * Regras: saldo por pessoa = total que pagou − parte que lhe cabe; somente despesas
 * confirmadas contam; pagamento informado não é confirmado; transferências são
 * sugestões, nunca execuções.
 */
import { type Centavos, absoluto, somar } from "./money.ts";
import { type Despesa, entraNoSaldoOficial } from "./expense.ts";
import { ErroDeDominio } from "./erros.ts";

export type EstadoMovimento = "informado" | "confirmado" | "contestado";

export interface Movimento {
  id: string;
  viagemId: string;
  deId: string;
  paraId: string;
  valorCentavos: Centavos;
  estado: EstadoMovimento;
  /** Despesa relacionada, quando for reembolso de um lançamento específico. */
  despesaId?: string | null;
}

export interface SaldoParticipante {
  participanteId: string;
  pago: Centavos;
  parteDevida: Centavos;
  /** pago − parteDevida (+/− movimento confirmado). Positivo: tem a receber. */
  saldo: Centavos;
  recebidoConfirmado: Centavos;
  enviadoConfirmado: Centavos;
}

export interface ResumoFinanceiro {
  saldos: SaldoParticipante[];
  /** Total confirmado (oficial). */
  realizado: Centavos;
  /** Total pendente/contestado — visível, mas fora do saldo oficial. */
  comprometido: Centavos;
  haDivergencia: boolean;
}

export function calcularResumoFinanceiro(
  despesas: readonly Despesa[],
  movimentos: readonly Movimento[] = [],
): ResumoFinanceiro {
  const saldos = new Map<string, SaldoParticipante>();
  const obter = (participanteId: string): SaldoParticipante => {
    const atual = saldos.get(participanteId);
    if (atual) return atual;
    const novo: SaldoParticipante = {
      participanteId,
      pago: 0n,
      parteDevida: 0n,
      saldo: 0n,
      recebidoConfirmado: 0n,
      enviadoConfirmado: 0n,
    };
    saldos.set(participanteId, novo);
    return novo;
  };

  let realizado = 0n;
  let comprometido = 0n;
  let moedaBase: string | null = null;

  for (const despesa of despesas) {
    if (despesa.estado === "cancelada") continue;
    if (moedaBase === null) {
      moedaBase = despesa.moeda;
    } else if (despesa.moeda !== moedaBase) {
      throw new ErroDeDominio(
        `Não é possível somar despesas de moedas diferentes (${moedaBase} e ${despesa.moeda}) sem conversão explícita.`,
      );
    }
    if (!entraNoSaldoOficial(despesa)) {
      comprometido += despesa.valorCentavos;
      continue;
    }
    realizado += despesa.valorCentavos;
    obter(despesa.pagadorId).pago += despesa.valorCentavos;
    for (const parte of despesa.rateio.partes) {
      obter(parte.participanteId).parteDevida += parte.valor;
    }
  }

  for (const movimento of movimentos) {
    if (movimento.estado === "contestado") continue;
    if (movimento.estado !== "confirmado") continue;
    const de = obter(movimento.deId);
    const para = obter(movimento.paraId);
    de.enviadoConfirmado += movimento.valorCentavos;
    para.recebidoConfirmado += movimento.valorCentavos;
  }

  const lista = [...saldos.values()].map((saldo) => ({
    ...saldo,
    // Quem já pagou o que devia fica neutro; transferência confirmada quita o saldo.
    saldo: saldo.pago + saldo.enviadoConfirmado - saldo.parteDevida - saldo.recebidoConfirmado,
  }));

  return {
    saldos: lista,
    realizado,
    comprometido,
    haDivergencia: lista.some((saldo) => saldo.saldo !== 0n),
  };
}

export interface TransferenciaSugerida {
  deId: string;
  paraId: string;
  valorCentavos: Centavos;
}

/**
 * Sugere transferências minimizando a quantidade de pagamentos.
 * Sugestão apenas: nada é executado, nem Pix, nem reserva.
 */
export function sugerirTransferencias(saldos: readonly SaldoParticipante[]): TransferenciaSugerida[] {
  const credores = saldos
    .filter((saldo) => saldo.saldo > 0n)
    .map((saldo) => ({ id: saldo.participanteId, valor: saldo.saldo }))
    .sort((a, b) => (b.valor === a.valor ? a.id.localeCompare(b.id) : b.valor > a.valor ? 1 : -1));
  const devedores = saldos
    .filter((saldo) => saldo.saldo < 0n)
    .map((saldo) => ({ id: saldo.participanteId, valor: absoluto(saldo.saldo) }))
    .sort((a, b) => (b.valor === a.valor ? a.id.localeCompare(b.id) : b.valor > a.valor ? 1 : -1));

  const transferencias: TransferenciaSugerida[] = [];
  let indiceCredor = 0;
  let indiceDevedor = 0;
  while (indiceCredor < credores.length && indiceDevedor < devedores.length) {
    const credor = credores[indiceCredor];
    const devedor = devedores[indiceDevedor];
    if (!credor || !devedor) break;
    const valor = credor.valor < devedor.valor ? credor.valor : devedor.valor;
    if (valor > 0n) {
      transferencias.push({ deId: devedor.id, paraId: credor.id, valorCentavos: valor });
      credor.valor -= valor;
      devedor.valor -= valor;
    }
    if (credor.valor === 0n) indiceCredor += 1;
    if (devedor.valor === 0n) indiceDevedor += 1;
  }

  const somaDevedores = somar(...devedores.map((devedor) => devedor.valor));
  const somaCredores = somar(...credores.map((credor) => credor.valor));
  if (somaDevedores !== 0n || somaCredores !== 0n) {
    throw new ErroDeDominio("Saldos inconsistentes: a soma das dívidas deve ser igual à soma dos créditos.");
  }
  return transferencias;
}
