import { ErroDeDominio } from "./erros.ts";
/**
 * Dinheiro — regra não negociável do Lia Go:
 * valores oficiais são inteiros em centavos (bigint). Nunca float.
 *
 * Hipótese reversível documentada (DECISIONS_AND_OPEN_QUESTIONS.md):
 * - separador decimal: vírgula é sempre decimal; ponto é decimal quando aparecer
 *   com 1 ou 2 dígitos depois ("12.50" = 12 reais e 50 centavos) e separador de
 *   milhar quando aparecer sozinho com exatamente 3 dígitos depois ("1.234" =
 *   mil duzentos e trinta e quatro reais), que é como pt-BR escreve milhares;
 * - quando os dois separadores aparecem, o último é o decimal ("1.234,56");
 * - valores negativos são permitidos apenas onde a regra de negócio exige (estorno/reembolso).
 */

export type Centavos = bigint;

const APENAS_INTEIRO = /^-?\d+$/;

/** Converte para centavos validando que é inteiro (sem casas decimais implícitas). */
export function centavos(valor: bigint | number | string): Centavos {
  if (typeof valor === "bigint") return valor;
  if (typeof valor === "number") {
    if (!Number.isInteger(valor)) {
      throw new ErroDeDominio(`Valor monetário não inteiro: ${valor}. Use centavos inteiros.`);
    }
    if (!Number.isSafeInteger(valor)) {
      throw new ErroDeDominio(`Valor monetário fora do intervalo seguro: ${valor}.`);
    }
    return BigInt(valor);
  }
  if (!APENAS_INTEIRO.test(valor.trim())) {
    throw new ErroDeDominio(`Valor em centavos inválido: ${valor}. Use apenas dígitos.`);
  }
  return BigInt(valor.trim());
}

export function somar(...valores: Centavos[]): Centavos {
  return valores.reduce<Centavos>((total, valor) => total + valor, 0n);
}

export function subtrair(a: Centavos, b: Centavos): Centavos {
  return a - b;
}

export function absoluto(valor: Centavos): Centavos {
  return valor < 0n ? -valor : valor;
}

export function ehZero(valor: Centavos): boolean {
  return valor === 0n;
}

/**
 * Analisa texto de valor digitado por pessoa no Brasil.
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234,56", "12" (= R$ 12,00).
 * Rejeita texto sem dígitos, mais de uma vírgula decimal e valores com mais de 2 casas.
 */
export function analisarValorMonetario(texto: string): Centavos {
  const limpo = texto.trim().replace(/^(r\$|R\$)\s*/i, "").replace(/\s/g, "");
  if (!limpo || !/\d/.test(limpo)) {
    throw new ErroDeDominio("Informe um valor monetário, por exemplo 12,50.");
  }
  if (!/^-?[\d.,]+$/.test(limpo)) {
    throw new ErroDeDominio(`Valor monetário inválido: ${texto}.`);
  }
  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  let inteiro: string;
  let decimal: string;
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    const corte = Math.max(ultimaVirgula, ultimoPonto);
    inteiro = limpo.slice(0, corte);
    decimal = limpo.slice(corte + 1);
  } else if (ultimaVirgula >= 0) {
    inteiro = limpo.slice(0, ultimaVirgula);
    decimal = limpo.slice(ultimaVirgula + 1);
  } else if (ultimoPonto >= 0) {
    const digitosAposPonto = limpo.slice(ultimoPonto + 1);
    // "1.234" em pt-BR é milhar; "12.50" é decimal. Ambiguidade resolvida aqui e documentada.
    if (/^\d{3}$/.test(digitosAposPonto)) {
      inteiro = limpo;
      decimal = "";
    } else {
      inteiro = limpo.slice(0, ultimoPonto);
      decimal = digitosAposPonto;
    }
  } else {
    inteiro = limpo;
    decimal = "";
  }
  const sinal = inteiro.startsWith("-") ? -1n : 1n;
  const parteInteira = inteiro.replace("-", "");
  // Valida o agrupamento: separador de milhar só pode separar grupos de 3 dígitos
  // (evita aceitar coisas como "12,3.4").
  const grupos = parteInteira.split(/[.,]/);
  if (grupos.length > 1) {
    const separador = parteInteira.includes(".") ? "." : ",";
    if (parteInteira.includes(".") && parteInteira.includes(",")) {
      throw new ErroDeDominio(`Valor monetário inválido: ${texto}.`);
    }
    if (grupos.some((grupo, indice) => (indice === 0 ? grupo.length < 1 : grupo.length !== 3))) {
      throw new ErroDeDominio(`Valor monetário inválido: ${texto}.`);
    }
    void separador;
  }
  const digitosInteiros = parteInteira.replace(/[.]/g, "").replace(/,/g, "");
  const digitosDecimais = decimal.replace(/[.,]/g, "");
  if (digitosDecimais.length > 2) {
    throw new ErroDeDominio(`Valor com mais de duas casas decimais: ${texto}.`);
  }
  if (!digitosInteiros && !digitosDecimais) {
    throw new ErroDeDominio(`Valor monetário inválido: ${texto}.`);
  }
  const reais = BigInt(digitosInteiros || "0");
  const centavosDecimais = BigInt((digitosDecimais + "00").slice(0, 2));
  return sinal * (reais * 100n + centavosDecimais);
}

/** Formata em pt-BR: 123456n → "R$ 1.234,56". */
export function formatarBRL(valor: Centavos): string {
  const negativo = valor < 0n;
  const texto = absoluto(valor).toString().padStart(3, "0");
  const centavosTexto = texto.slice(-2);
  const reaisTexto = texto.slice(0, -2);
  const comSeparador = reaisTexto.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "-" : ""}R$ ${comSeparador},${centavosTexto}`;
}

/** Formata sem símbolo de moeda: 123456n → "1.234,56" (para campos de formulário). */
export function formatarValorSimples(valor: Centavos): string {
  return formatarBRL(valor).replace(/^-?R\$ /, "");
}

/**
 * Aloca `total` entre pesos inteiros, distribuindo o resto de forma transparente.
 * Garantia: a soma do resultado é exatamente igual ao total.
 * Empate no resto é resolvido pela ordem recebida (determinístico e explicável).
 */
export function alocarProporcional(
  total: Centavos,
  pesos: readonly bigint[],
): { valores: Centavos[]; ajustes: number[] } {
  if (pesos.length === 0) throw new ErroDeDominio("Informe ao menos um participante para o rateio.");
  if (pesos.some((peso) => peso < 0n)) throw new ErroDeDominio("Pesos de rateio não podem ser negativos.");
  const somaPesos = pesos.reduce<bigint>((total_, peso) => total_ + peso, 0n);
  if (somaPesos === 0n) throw new ErroDeDominio("A soma dos pesos do rateio não pode ser zero.");

  const sinal = total < 0n ? -1n : 1n;
  const magnitude = absoluto(total);
  const bases: Centavos[] = [];
  const restos: { indice: number; resto: bigint }[] = [];
  for (let indice = 0; indice < pesos.length; indice += 1) {
    const peso = pesos[indice] ?? 0n;
    const produto = magnitude * peso;
    bases.push(produto / somaPesos);
    restos.push({ indice, resto: produto % somaPesos });
  }
  const distribuido = bases.reduce<bigint>((soma, parte) => soma + parte, 0n);
  let sobra = magnitude - distribuido;
  const ordem = [...restos].sort((a, b) => (b.resto === a.resto ? a.indice - b.indice : b.resto > a.resto ? 1 : -1));
  const ajustes = new Array<number>(pesos.length).fill(0);
  for (const item of ordem) {
    if (sobra <= 0n) break;
    bases[item.indice] = (bases[item.indice] ?? 0n) + 1n;
    ajustes[item.indice] = 1;
    sobra -= 1n;
  }
  if (sobra !== 0n) throw new ErroDeDominio("Falha interna ao distribuir centavos; soma não fechou.");
  return { valores: bases.map((parte) => sinal * parte), ajustes };
}
