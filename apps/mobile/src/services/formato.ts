/**
 * Formatação de valores para a interface.
 * O cálculo oficial é sempre do servidor; aqui só exibimos centavos já calculados.
 */
export function formatarBRL(centavos: string | bigint): string {
  const valor = typeof centavos === "bigint" ? centavos : BigInt(centavos);
  const negativo = valor < 0n;
  const absoluto = negativo ? -valor : valor;
  const texto = absoluto.toString().padStart(3, "0");
  const reais = texto.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = texto.slice(-2);
  return `${negativo ? "-" : ""}R$ ${reais},${cents}`;
}

/** "12,50" ou "12.50" ou "1234" → centavos inteiros em texto. */
export function paraCentavos(entrada: string): string {
  const limpo = entrada.trim().replace(/^r\$\s*/i, "").replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) {
    throw new Error("Informe o valor como 12,50 ou 1234,50.");
  }
  const semMilhar = limpo.replace(/\./g, "");
  const [inteira = "0", decimal = ""] = semMilhar.split(",");
  const centavos = `${(decimal + "00").slice(0, 2)}`;
  return (BigInt(inteira) * 100n + BigInt(centavos)).toString();
}

export function formatarData(iso: string | null): string {
  if (!iso) return "sem data";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function hojeIso(): string {
  const agora = new Date();
  const fuso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
  return fuso.format(agora);
}

export const ROTULO_ESTADO: Record<string, string> = {
  rascunho: "Rascunho",
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  pendente: "Pendente",
  cancelada: "Cancelada",
};

export const ROTULO_DESPESA: Record<string, string> = {
  pendente: "Aguardando confirmação",
  confirmada: "Confirmada",
  contestada: "Contestada",
  cancelada: "Cancelada",
};
