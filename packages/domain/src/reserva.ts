/**
 * Reservas da viagem (hospedagem, transporte, passeio, outro).
 *
 * Regras que vieram das decisões já confirmadas e que este arquivo garante:
 *  - uma reserva **nasce prevista**: confirmar é uma ação separada (`confirmarReserva`) e exige
 *    **evidência** (código, localizador, comprovante) — `docs/UI_V1_DECISIONS.md` §13, "não confirmar
 *    reserva automaticamente; não insinuar que uma ação externa aconteceu";
 *  - confirmar **muda a natureza do dinheiro**, não o valor: o previsto da reserva deixa de ser
 *    estimativa e passa a ser **compromisso** (o mesmo vocabulário do roteiro);
 *  - custo desconhecido é `null`: nunca `0`, nunca "R$ 0,00" na tela;
 *  - cancelar não apaga nada: motivo e evidência continuam no histórico.
 */
import { ErroDeDominio } from "./erros.ts";
import type { NaturezaCusto } from "./roteiro.ts";

export type TipoReserva = "hospedagem" | "transporte" | "passeio" | "outro";
export type EstadoReserva = "prevista" | "confirmada" | "cancelada";

export const TIPOS_DE_RESERVA: readonly TipoReserva[] = ["hospedagem", "transporte", "passeio", "outro"];

export const ROTULO_TIPO_RESERVA: Record<TipoReserva, string> = {
  hospedagem: "Hospedagem",
  transporte: "Transporte",
  passeio: "Passeio",
  outro: "Outro",
};

export const ROTULO_ESTADO_RESERVA: Record<EstadoReserva, string> = {
  prevista: "Prevista",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
};

export interface Reserva {
  id: string;
  viagemId: string;
  autorId: string;
  tipo: TipoReserva;
  titulo: string;
  /** Onde é: endereço, aeroporto, nome do hotel. `null` = ainda não definido. */
  local: string | null;
  /** Início em ISO com hora (`2026-11-20T14:00:00-03:00`). `null` = ainda sem data/hora. */
  inicio: string | null;
  fim: string | null;
  /** `null` = valor desconhecido. Não é zero e não é gratuito. */
  custoCentavos: bigint | null;
  /** Alguém já disse que o valor precisa ser conferido antes de contar no orçamento. */
  custoAVerificar: boolean;
  /** Evidência da confirmação (código, localizador, "pago no balcão"). Só existe quando confirmada. */
  confirmacao: string | null;
  confirmadaPor: string | null;
  confirmadaEm: string | null;
  estado: EstadoReserva;
  motivoCancelamento: string | null;
  versao: number;
}

export interface EntradaNovaReserva {
  id: string;
  viagemId: string;
  autorId: string;
  tipo: TipoReserva;
  titulo: string;
  local?: string | null;
  inicio?: string | null;
  fim?: string | null;
  custoCentavos?: bigint | null;
}

function limpar(texto: string | null | undefined): string | null {
  const valor = (texto ?? "").trim();
  return valor.length === 0 ? null : valor;
}

/**
 * Cria a reserva como **prevista**. Se alguém tentar criar já confirmada, o erro explica o porquê:
 * confirmação é um ato separado e precisa de evidência — nada de "chegou confirmada sozinha".
 */
export function criarReserva(entrada: EntradaNovaReserva): Reserva {
  const titulo = limpar(entrada.titulo);
  if (titulo === null || titulo.length < 2) {
    throw new ErroDeDominio("Dê um nome à reserva (pelo menos 2 caracteres).");
  }
  if (!TIPOS_DE_RESERVA.includes(entrada.tipo)) {
    throw new ErroDeDominio("Tipo de reserva desconhecido.");
  }
  const custo = entrada.custoCentavos ?? null;
  if (custo !== null && custo < 0n) {
    throw new ErroDeDominio("Valor da reserva não pode ser negativo.");
  }
  const inicio = limpar(entrada.inicio);
  const fim = limpar(entrada.fim);
  if (inicio !== null && fim !== null && new Date(fim).getTime() < new Date(inicio).getTime()) {
    throw new ErroDeDominio("O fim da reserva não pode ser antes do início.");
  }

  return {
    id: entrada.id,
    viagemId: entrada.viagemId,
    autorId: entrada.autorId,
    tipo: entrada.tipo,
    titulo,
    local: limpar(entrada.local),
    inicio,
    fim,
    custoCentavos: custo,
    custoAVerificar: custo === null,
    confirmacao: null,
    confirmadaPor: null,
    confirmadaEm: null,
    estado: "prevista",
    motivoCancelamento: null,
    versao: 1,
  };
}

export interface EntradaConfirmacao {
  porId: string;
  /** Evidência: é o que separa "eu reservvi" de "a reserva está confirmada". */
  confirmacao: string;
  em?: string;
}

export function confirmarReserva(reserva: Reserva, entrada: EntradaConfirmacao): Reserva {
  if (reserva.estado === "cancelada") {
    throw new ErroDeDominio("Reserva cancelada não volta atrás; crie uma reserva nova se mudou de ideia.");
  }
  if (reserva.estado === "confirmada") {
    throw new ErroDeDominio("Esta reserva já está confirmada.");
  }
  const confirmacao = limpar(entrada.confirmacao);
  if (confirmacao === null || confirmacao.length < 3) {
    throw new ErroDeDominio("Escreva a evidência da confirmação (código da reserva, localizador ou comprovante).");
  }

  return {
    ...reserva,
    confirmacao,
    confirmadaPor: entrada.porId,
    confirmadaEm: entrada.em ?? new Date().toISOString(),
    estado: "confirmada",
    // O valor passa a ser tratado como combinado — sem mexer no número.
    custoAVerificar: reserva.custoCentavos === null,
    versao: reserva.versao + 1,
  };
}

export interface EntradaCancelamento {
  porId: string;
  motivo: string;
  em?: string;
}

export function cancelarReserva(reserva: Reserva, entrada: EntradaCancelamento): Reserva {
  if (reserva.estado === "cancelada") {
    throw new ErroDeDominio("Esta reserva já está cancelada.");
  }
  const motivo = limpar(entrada.motivo);
  if (motivo === null || motivo.length < 5) {
    throw new ErroDeDominio("Explique o motivo do cancelamento (mínimo 5 caracteres).");
  }

  return {
    ...reserva,
    estado: "cancelada",
    motivoCancelamento: motivo,
    // Nada é apagado: a evidência da confirmação (se existia) continua registrada.
    versao: reserva.versao + 1,
  };
}

/**
 * Natureza do dinheiro desta reserva, no vocabulário do roteiro.
 *
 * Prevista = **estimativa**; confirmada = **compromisso** (já combinado com alguém); valor
 * desconhecido continua desconhecido (`null`), e zero continua sendo zero explícito.
 */
export function naturezaDaReserva(reserva: Reserva): NaturezaCusto | null {
  if (reserva.estado === "cancelada") return null;
  if (reserva.custoCentavos === null) return null;
  if (reserva.custoCentavos === 0n) return "gratuito";
  return reserva.estado === "confirmada" ? "compromisso" : "estimativa";
}

/** Ordem de leitura: quem tem data vem primeiro (mais próximo), sem data depois, canceladas por último. */
export function ordenarReservas(reservas: readonly Reserva[]): Reserva[] {
  const peso = (reserva: Reserva): number => (reserva.estado === "cancelada" ? 2 : reserva.inicio === null ? 1 : 0);
  return [...reservas].sort((a, b) => {
    const porPeso = peso(a) - peso(b);
    if (porPeso !== 0) return porPeso;
    const dataA = a.inicio ?? "";
    const dataB = b.inicio ?? "";
    if (dataA !== dataB) return dataA < dataB ? -1 : 1;
    return a.titulo.localeCompare(b.titulo, "pt-BR");
  });
}

export interface ResumoDeReservas {
  total: number;
  previstas: number;
  confirmadas: number;
  canceladas: number;
  /** Soma das reservas **previstas** com valor conhecido (o que ainda pode mudar). */
  estimativaCentavos: bigint;
  /** Soma das reservas **confirmadas** com valor conhecido (o que já foi combinado). */
  compromissoCentavos: bigint;
  previstoCentavos: bigint;
  /** Quantas reservas ainda não têm valor nenhum informado. */
  semCustoInformado: number;
  gratuitas: number;
  /** Próxima reserva pela data (a que a pessoa quer ver no topo). */
  proxima: Reserva | null;
  resumo: string;
}

/**
 * Resumo das reservas para a tela.
 *
 * Mesma disciplina do orçamento do roteiro: valor desconhecido **não** vira zero, cancelada sai da
 * conta e estimativa e compromisso aparecem separados (o total é a soma dos dois, mas quem lê sabe
 * o que já foi combinado).
 */
export function resumirReservas(reservas: readonly Reserva[]): ResumoDeReservas {
  const resumo: ResumoDeReservas = {
    total: reservas.length,
    previstas: 0,
    confirmadas: 0,
    canceladas: 0,
    estimativaCentavos: 0n,
    compromissoCentavos: 0n,
    previstoCentavos: 0n,
    semCustoInformado: 0,
    gratuitas: 0,
    proxima: null,
    resumo: "",
  };

  for (const reserva of reservas) {
    if (reserva.estado === "cancelada") {
      resumo.canceladas += 1;
      continue;
    }
    if (reserva.estado === "confirmada") resumo.confirmadas += 1;
    else resumo.previstas += 1;

    const natureza = naturezaDaReserva(reserva);
    if (natureza === null) resumo.semCustoInformado += 1;
    else if (natureza === "gratuito") resumo.gratuitas += 1;
    else if (natureza === "compromisso") resumo.compromissoCentavos += reserva.custoCentavos as bigint;
    else resumo.estimativaCentavos += reserva.custoCentavos as bigint;
  }

  resumo.previstoCentavos = resumo.estimativaCentavos + resumo.compromissoCentavos;
  resumo.proxima = ordenarReservas(reservas.filter((reserva) => reserva.estado !== "cancelada"))[0] ?? null;

  const partes: string[] = [];
  if (resumo.confirmadas > 0) partes.push(resumo.confirmadas === 1 ? "1 confirmada" : `${resumo.confirmadas} confirmadas`);
  if (resumo.previstas > 0) partes.push(resumo.previstas === 1 ? "1 prevista" : `${resumo.previstas} previstas`);
  if (resumo.canceladas > 0) partes.push(resumo.canceladas === 1 ? "1 cancelada" : `${resumo.canceladas} canceladas`);
  resumo.resumo = partes.length === 0 ? "Nenhuma reserva registrada." : partes.join(" · ");
  return resumo;
}

export type AcaoNaReserva = "confirmar" | "cancelar";

export interface ImpactoDaReserva {
  acao: AcaoNaReserva;
  /** Quanto o valor passa a contar como combinado (confirmar) ou sai da conta (cancelar). */
  efeitoNoPrevistoCentavos: bigint;
  itens: string[];
  atencao: string[];
}

/**
 * O que muda **antes** de confirmar ou cancelar uma reserva — mesma regra de §13 usada nas
 * atividades: a tela mostra o impacto conhecido e nunca dá a entender que algo externo mudou.
 */
export function revisarImpactoDaReserva(reserva: Reserva, acao: AcaoNaReserva): ImpactoDaReserva {
  const valor = reserva.custoCentavos;
  const conhecido = valor !== null && valor > 0n;

  if (acao === "confirmar") {
    return {
      acao,
      efeitoNoPrevistoCentavos: 0n,
      itens: [
        conhecido
          ? `O valor desta reserva passa a contar como já combinado: ${formatarReais(valor as bigint)}.`
          : "O valor continua desconhecido: confirmar não inventa número.",
        "A evidência que você escrever fica registrada com seu nome e a hora.",
        "O saldo oficial não muda aqui: despesa é registro separado, confirmado no servidor.",
      ],
      atencao:
        valor === null
          ? ["Sem valor informado, o orçamento continua dizendo que falta verificar esta reserva."]
          : [],
    };
  }

  return {
    acao,
    efeitoNoPrevistoCentavos: conhecido ? -(valor as bigint) : 0n,
    itens: [
      conhecido
        ? `Sai do previsto: ${formatarReais(valor as bigint)} deixam de ser contados.`
        : "Custo desconhecido: não havia valor no previsto para sair.",
      "O motivo fica registrado no histórico e não pode ser apagado.",
      reserva.confirmacao
        ? "A evidência da confirmação continua no histórico desta reserva."
        : "Esta reserva ainda não tinha sido confirmada.",
      "O saldo oficial e as despesas já registradas continuam iguais.",
    ],
    atencao: [
      ...(reserva.estado === "confirmada"
        ? ["Isto estava confirmado com evidência: cancelar aqui não cancela a reserva no fornecedor."]
        : []),
      ...(reserva.custoAVerificar && valor === null
        ? ["O valor nunca foi informado: cancelar não confirma nada sobre o custo."]
        : []),
    ],
  };
}

/** Dinheiro em reais para texto de tela, em centavos inteiros. */
function formatarReais(centavos: bigint): string {
  const absoluto = centavos < 0n ? -centavos : centavos;
  const texto = absoluto.toString().padStart(3, "0");
  const reais = texto.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${reais},${texto.slice(-2)}`;
}
