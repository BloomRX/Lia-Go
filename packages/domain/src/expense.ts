/**
 * Ciclo de vida de despesas — regras confirmadas:
 * - despesa nova nasce PENDENTE e não altera saldo oficial;
 * - quem lançou não confirma o próprio lançamento;
 * - contestada fica visível e fora dos saldos oficiais até resolução;
 * - correção confirmada exige motivo, dados novos e nova revisão independente;
 * - despesa pessoal não cria obrigação para outras pessoas.
 */
import { type Centavos, centavos as toCentavos, somar } from "./money.ts";
import { type Rateio, type ResultadoRateio, calcularRateio } from "./split.ts";
import { type ContextoAutorizacao, podeConfirmarDespesa } from "./permissions.ts";
import { ErroDeDominio } from "./erros.ts";

export type EstadoDespesa = "pendente" | "confirmada" | "contestada" | "cancelada";
export type TipoDespesa = "pessoal" | "compartilhada";

export interface Despesa {
  id: string;
  viagemId: string;
  autorId: string;
  pagadorId: string;
  tipo: TipoDespesa;
  estado: EstadoDespesa;
  valorCentavos: Centavos;
  moeda: string;
  /** Data do gasto (YYYY-MM-DD), independente de quando foi digitada. */
  data: string;
  descricao: string;
  rateio: ResultadoRateio;
  versao: number;
  motivoContestacao: string | null;
  historico: EventoDespesa[];
}

export interface EventoDespesa {
  acao:
    | "despesa:criar"
    | "despesa:confirmar"
    | "despesa:contestar"
    | "despesa:corrigir"
    | "despesa:cancelar";
  autorId: string;
  em: string;
  estadoAnterior: EstadoDespesa;
  estadoNovo: EstadoDespesa;
  motivo: string | null;
  /** Campos alterados em correções (antes → depois), sem perder o original. */
  alteracoes?: Record<string, { de: unknown; para: unknown }>;
}

export interface NovaDespesa {
  id: string;
  viagemId: string;
  autorId: string;
  pagadorId: string;
  tipo: TipoDespesa;
  valorCentavos: Centavos | number | string;
  moeda: string;
  data: string;
  descricao: string;
  participantes: readonly string[];
  rateio?: Rateio;
}

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function criarDespesa(entrada: NovaDespesa): Despesa {
  const valor = toCentavos(entrada.valorCentavos as bigint);
  if (valor <= 0n) throw new ErroDeDominio("O valor da despesa deve ser maior que zero.");
  if (!entrada.moeda || !/^[A-Z]{3}$/.test(entrada.moeda)) {
    throw new ErroDeDominio("Informe a moeda no formato de três letras (por exemplo BRL).");
  }
  if (!FORMATO_DATA.test(entrada.data)) {
    throw new ErroDeDominio("Informe a data da despesa no formato AAAA-MM-DD.");
  }
  const descricao = entrada.descricao.trim();
  if (descricao.length < 2) throw new ErroDeDominio("Descreva a despesa (mínimo 2 caracteres).");
  if (!entrada.pagadorId) throw new ErroDeDominio("Informe quem pagou a despesa.");

  let rateio: ResultadoRateio;
  if (entrada.tipo === "pessoal") {
    // Despesa pessoal: a parte inteira é de quem pagou; ninguém mais deve nada.
    rateio = calcularRateio(valor, {
      metodo: "valores",
      partes: [{ participanteId: entrada.pagadorId, valor }],
    });
  } else {
    rateio = calcularRateio(
      valor,
      entrada.rateio ?? { metodo: "igualitario", participantes: entrada.participantes },
    );
  }
  const soma = somar(...rateio.partes.map((parte) => parte.valor));
  if (soma !== valor) throw new ErroDeDominio("Falha de integridade no rateio: a soma não confere com o valor.");

  return {
    id: entrada.id,
    viagemId: entrada.viagemId,
    autorId: entrada.autorId,
    pagadorId: entrada.pagadorId,
    tipo: entrada.tipo,
    estado: "pendente",
    valorCentavos: valor,
    moeda: entrada.moeda,
    data: entrada.data,
    descricao,
    rateio,
    versao: 1,
    motivoContestacao: null,
    historico: [
      {
        acao: "despesa:criar",
        autorId: entrada.autorId,
        em: new Date().toISOString(),
        estadoAnterior: "pendente",
        estadoNovo: "pendente",
        motivo: null,
      },
    ],
  };
}

export function confirmarDespesa(
  despesa: Despesa,
  revisor: { usuarioId: string; contexto: ContextoAutorizacao },
  opcoes: { em?: string } = {},
): Despesa {
  if (despesa.estado === "confirmada") throw new ErroDeDominio("Esta despesa já está confirmada.");
  if (despesa.estado === "cancelada") throw new ErroDeDominio("Despesa cancelada não pode ser confirmada.");
  const decisao = podeConfirmarDespesa(revisor.contexto, despesa.autorId, revisor.usuarioId);
  if (!decisao.permitido) throw new ErroDeDominio(decisao.motivo);
  return {
    ...despesa,
    estado: "confirmada",
    versao: despesa.versao + 1,
    motivoContestacao: null,
    historico: [
      ...despesa.historico,
      {
        acao: "despesa:confirmar",
        autorId: revisor.usuarioId,
        em: opcoes.em ?? new Date().toISOString(),
        estadoAnterior: despesa.estado,
        estadoNovo: "confirmada",
        motivo: null,
      },
    ],
  };
}

export function contestarDespesa(
  despesa: Despesa,
  contestante: { usuarioId: string; contexto: ContextoAutorizacao },
  motivo: string,
  opcoes: { em?: string } = {},
): Despesa {
  if (despesa.estado === "cancelada") throw new ErroDeDominio("Despesa cancelada não pode ser contestada.");
  const texto = motivo.trim();
  if (texto.length < 5) throw new ErroDeDominio("Explique o motivo da contestação (mínimo 5 caracteres).");
  if (contestante.usuarioId === despesa.autorId) {
    throw new ErroDeDominio("Para corrigir seu próprio lançamento use a correção; contestação é de outra pessoa.");
  }
  return {
    ...despesa,
    estado: "contestada",
    versao: despesa.versao + 1,
    motivoContestacao: texto,
    historico: [
      ...despesa.historico,
      {
        acao: "despesa:contestar",
        autorId: contestante.usuarioId,
        em: opcoes.em ?? new Date().toISOString(),
        estadoAnterior: despesa.estado,
        estadoNovo: "contestada",
        motivo: texto,
      },
    ],
  };
}

export interface CorrecaoDespesa {
  valorCentavos?: Centavos | number | string;
  moeda?: string;
  data?: string;
  descricao?: string;
  pagadorId?: string;
  tipo?: TipoDespesa;
  participantes?: readonly string[];
  rateio?: Rateio;
}

/**
 * Correção: exige motivo, altera dados, volta para PENDENTE e mantém o histórico
 * (antes → depois) para auditoria.
 */
export function corrigirDespesa(
  despesa: Despesa,
  corretor: { usuarioId: string; contexto: ContextoAutorizacao },
  correcao: CorrecaoDespesa,
  motivo: string,
  opcoes: { em?: string } = {},
): Despesa {
  const texto = motivo.trim();
  if (texto.length < 5) throw new ErroDeDominio("Toda correção exige motivo (mínimo 5 caracteres).");
  if (corretor.usuarioId !== despesa.autorId && corretor.contexto.papel !== "organizador") {
    throw new ErroDeDominio("Somente quem lançou a despesa ou o organizador pode corrigi-la.");
  }
  const valor = correcao.valorCentavos === undefined ? despesa.valorCentavos : toCentavos(correcao.valorCentavos as bigint);
  const pagadorId = correcao.pagadorId ?? despesa.pagadorId;
  const tipo = correcao.tipo ?? despesa.tipo;
  const participantes = correcao.participantes ?? despesa.rateio.partes.map((parte) => parte.participanteId);
  const rateio =
    tipo === "pessoal"
      ? calcularRateio(valor, { metodo: "valores", partes: [{ participanteId: pagadorId, valor }] })
      : calcularRateio(valor, correcao.rateio ?? { metodo: "igualitario", participantes });

  const alteracoes: Record<string, { de: unknown; para: unknown }> = {};
  const comparar = (campo: string, antes: unknown, depois: unknown): void => {
    if (JSON.stringify(antes) !== JSON.stringify(depois)) alteracoes[campo] = { de: antes, para: depois };
  };
  comparar("valorCentavos", despesa.valorCentavos.toString(), valor.toString());
  comparar("moeda", despesa.moeda, correcao.moeda ?? despesa.moeda);
  comparar("data", despesa.data, correcao.data ?? despesa.data);
  comparar("descricao", despesa.descricao, (correcao.descricao ?? despesa.descricao).trim());
  comparar("pagadorId", despesa.pagadorId, pagadorId);
  comparar("tipo", despesa.tipo, tipo);
  comparar(
    "rateio",
    despesa.rateio.partes.map((parte) => `${parte.participanteId}:${parte.valor}`),
    rateio.partes.map((parte) => `${parte.participanteId}:${parte.valor}`),
  );
  if (Object.keys(alteracoes).length === 0) {
    throw new ErroDeDominio("Nenhum dado foi alterado nesta correção.");
  }

  return {
    ...despesa,
    valorCentavos: valor,
    moeda: correcao.moeda ?? despesa.moeda,
    data: correcao.data ?? despesa.data,
    descricao: (correcao.descricao ?? despesa.descricao).trim(),
    pagadorId,
    tipo,
    rateio,
    // volta para pendente: outra pessoa precisa revisar de novo
    estado: "pendente",
    versao: despesa.versao + 1,
    motivoContestacao: null,
    historico: [
      ...despesa.historico,
      {
        acao: "despesa:corrigir",
        autorId: corretor.usuarioId,
        em: opcoes.em ?? new Date().toISOString(),
        estadoAnterior: despesa.estado,
        estadoNovo: "pendente",
        motivo: texto,
        alteracoes,
      },
    ],
  };
}

/** Somente despesas confirmadas entram nos saldos oficiais. */
export function entraNoSaldoOficial(despesa: Despesa): boolean {
  return despesa.estado === "confirmada";
}

export function resumoEstado(despesa: Despesa): string {
  switch (despesa.estado) {
    case "pendente":
      return "Aguardando confirmação de outra pessoa — ainda não entra nos saldos oficiais.";
    case "confirmada":
      return "Confirmada — esta despesa entra nos saldos oficiais.";
    case "contestada":
      return `Contestada: ${despesa.motivoContestacao ?? "sem motivo registrado"} — visível, fora dos saldos oficiais até a resolução.`;
    case "cancelada":
      return "Cancelada — permanece no histórico.";
  }
}
