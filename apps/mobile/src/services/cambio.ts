/**
 * Conversão determinística de moeda estrangeira (tela 13) e montagem/prévia de rateio (tela 11)
 * para o formulário de despesas na interface.
 *
 * Regras invioláveis:
 *  - nenhuma conta usa ponto flutuante (`number` com decimal) para dinheiro: a taxa de câmbio é
 *    lida em décimos de milésimo (`bigint`, escala 10.000) e arredondada meio-para-cima em inteiros;
 *  - o valor original, a moeda, a taxa e a data de referência ficam registrados na descrição da
 *    despesa para auditoria e histórico;
 *  - o rateio na tela usa `calcularRateio` de `@lia-go/domain`, nunca uma conta paralela.
 */
import { calcularRateio, formatarValorSimples, type Rateio } from "@lia-go/domain";
import { formatarBRL, formatarData, paraCentavos } from "./formato.ts";

export const MOEDAS_SUPORTADAS = [
  { codigo: "BRL", rotulo: "BRL — Real brasileiro (R$)" },
  { codigo: "USD", rotulo: "USD — Dólar americano (US$)" },
  { codigo: "EUR", rotulo: "EUR — Euro (€)" },
  { codigo: "GBP", rotulo: "GBP — Libra esterlina (£)" },
  { codigo: "ARS", rotulo: "ARS — Peso argentino ($)" },
] as const;

export type CodigoMoeda = (typeof MOEDAS_SUPORTADAS)[number]["codigo"];
export type MetodoRateioTela = "igualitario" | "valores" | "percentual";

const ESCALA_TAXA = 10_000n;

/**
 * Converte texto de taxa (ex.: "5,45" ou "5.4525") para inteiro em escala 10.000 (`54500n`).
 * Aceita até 4 casas decimais sem usar float.
 */
export function analisarTaxaDeCambio(texto: string): { taxaEscalada: bigint; taxaFormatada: string } {
  const limpo = texto.trim().replace(/\s/g, "");
  if (!limpo || !/^\d+([.,]\d{1,4})?$/.test(limpo)) {
    throw new Error("Informe a taxa de câmbio com até 4 casas decimais (ex.: 5,45).");
  }
  const normalizado = limpo.replace(".", ",");
  const [inteira = "0", decimal = ""] = normalizado.split(",");
  const decimalPreenchido = (decimal + "0000").slice(0, 4);
  const taxaEscalada = BigInt(inteira) * ESCALA_TAXA + BigInt(decimalPreenchido);
  if (taxaEscalada <= 0n) {
    throw new Error("A taxa de câmbio deve ser maior que zero.");
  }
  const casasVisiveis = Math.max(2, decimal.replace(/0+$/, "").length);
  const taxaFormatada = `${BigInt(inteira).toString()},${decimalPreenchido.slice(0, casasVisiveis)}`;
  return { taxaEscalada, taxaFormatada };
}

export interface ResultadoConversaoMoeda {
  centavosBRL: string;
  sufixoDescricao: string;
  resumoConversao: string | null;
}

export function converterMoedaParaBRL(entrada: {
  valorTexto: string;
  moeda: string;
  taxaTexto: string;
  dataCotacao: string;
}): ResultadoConversaoMoeda {
  const centavosOriginais = BigInt(paraCentavos(entrada.valorTexto));
  if (centavosOriginais <= 0n) {
    throw new Error("O valor da despesa deve ser maior que zero.");
  }
  const moeda = entrada.moeda.trim().toUpperCase() || "BRL";
  if (moeda === "BRL") {
    return {
      centavosBRL: centavosOriginais.toString(),
      sufixoDescricao: "",
      resumoConversao: null,
    };
  }
  const { taxaEscalada, taxaFormatada } = analisarTaxaDeCambio(entrada.taxaTexto);
  const data = /^\d{4}-\d{2}-\d{2}$/.test(entrada.dataCotacao) ? entrada.dataCotacao : "hoje";
  const convertidos = (centavosOriginais * taxaEscalada + ESCALA_TAXA / 2n) / ESCALA_TAXA;
  if (convertidos <= 0n) {
    throw new Error("O valor convertido em reais deve ser de pelo menos R$ 0,01.");
  }
  const valorOriginalFormatado = formatarValorSimples(centavosOriginais);
  return {
    centavosBRL: convertidos.toString(),
    sufixoDescricao: ` [Original: ${moeda} ${valorOriginalFormatado} · taxa ${taxaFormatada} em ${data}]`,
    resumoConversao: `${moeda} ${valorOriginalFormatado} × ${taxaFormatada} (cotação de ${
      data === "hoje" ? "hoje" : formatarData(data)
    }) = ${formatarBRL(convertidos)} no saldo da viagem`,
  };
}

export interface PreviaRateioTela {
  rateioApi:
    | { metodo: "igualitario"; participantes: string[] }
    | { metodo: "valores"; partes: { participanteId: string; valorCentavos: string }[] }
    | { metodo: "percentual"; partes: { participanteId: string; bps: number }[] };
  participantesIds: string[];
  explicacao: string;
  linhas: {
    participanteId: string;
    nome: string;
    valorFormatado: string;
    recebeuCentavoExtra: boolean;
  }[];
}

/** Converte percentual digitado (ex.: "33,33" ou "50") para basis points inteiros (100% = 10.000 bps). */
export function analisarPercentualBps(texto: string): number {
  const limpo = texto.trim().replace(/%/g, "").replace(/\s/g, "");
  if (!limpo) return 0;
  if (!/^\d+([.,]\d{1,2})?$/.test(limpo)) {
    throw new Error(`Percentual inválido: ${texto}. Use até 2 casas decimais (ex.: 50 ou 33,33).`);
  }
  const [inteira = "0", decimal = ""] = limpo.replace(".", ",").split(",");
  const decimalPreenchido = (decimal + "00").slice(0, 2);
  return Number(inteira) * 100 + Number(decimalPreenchido);
}

export function construirRateioDaTela(entrada: {
  totalCentavos: bigint;
  metodo: MetodoRateioTela;
  ativos: readonly { usuario_id: string; nome: string }[];
  selecionados: readonly string[];
  valoresPorPessoa: Record<string, string>;
  percentuaisPorPessoa: Record<string, string>;
}): PreviaRateioTela {
  const mapaNomes = new Map(entrada.ativos.map((pessoa) => [pessoa.usuario_id, pessoa.nome]));
  let rateioDominio: Rateio;
  let rateioApi: PreviaRateioTela["rateioApi"];
  let participantesIds: string[];

  if (entrada.metodo === "igualitario") {
    participantesIds = entrada.ativos
      .map((pessoa) => pessoa.usuario_id)
      .filter((id) => entrada.selecionados.includes(id));
    rateioDominio = { metodo: "igualitario", participantes: participantesIds };
    rateioApi = { metodo: "igualitario", participantes: participantesIds };
  } else if (entrada.metodo === "valores") {
    const partesDominio: { participanteId: string; valor: bigint }[] = [];
    const partesApi: { participanteId: string; valorCentavos: string }[] = [];
    for (const pessoa of entrada.ativos) {
      const bruto = (entrada.valoresPorPessoa[pessoa.usuario_id] ?? "").trim();
      if (!bruto) continue;
      const centavos = BigInt(paraCentavos(bruto));
      if (centavos <= 0n) continue;
      partesDominio.push({ participanteId: pessoa.usuario_id, valor: centavos });
      partesApi.push({ participanteId: pessoa.usuario_id, valorCentavos: centavos.toString() });
    }
    participantesIds = partesApi.map((parte) => parte.participanteId);
    rateioDominio = { metodo: "valores", partes: partesDominio };
    rateioApi = { metodo: "valores", partes: partesApi };
  } else {
    const partesDominio: { participanteId: string; bps: number }[] = [];
    const partesApi: { participanteId: string; bps: number }[] = [];
    for (const pessoa of entrada.ativos) {
      const bruto = (entrada.percentuaisPorPessoa[pessoa.usuario_id] ?? "").trim();
      if (!bruto) continue;
      const bps = analisarPercentualBps(bruto);
      if (bps <= 0) continue;
      partesDominio.push({ participanteId: pessoa.usuario_id, bps });
      partesApi.push({ participanteId: pessoa.usuario_id, bps });
    }
    participantesIds = partesApi.map((parte) => parte.participanteId);
    rateioDominio = { metodo: "percentual", partes: partesDominio };
    rateioApi = { metodo: "percentual", partes: partesApi };
  }

  const resultado = calcularRateio(entrada.totalCentavos, rateioDominio);
  return {
    rateioApi,
    participantesIds,
    explicacao: resultado.explicacao,
    linhas: resultado.partes.map((parte) => ({
      participanteId: parte.participanteId,
      nome: mapaNomes.get(parte.participanteId) ?? parte.participanteId,
      valorFormatado: formatarBRL(parte.valor),
      recebeuCentavoExtra: parte.ajusteResto > 0,
    })),
  };
}
