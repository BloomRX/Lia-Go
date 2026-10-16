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

/** Hora local do aparelho no formato HH:MM (mesma lógica do dia: quem lê é a pessoa). */
export function horaDoAparelho(agora = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(agora);
}

/**
 * "Hoje" no fuso das viagens (São Paulo), não no fuso do aparelho nem em UTC.
 *
 * O fuso fica fixo de propósito: quem lê o roteiro está no destino, e a viagem acontece no horário
 * do destino. Sem isso, um aparelho configurado em outro fuso veria "hoje" virar no meio do dia.
 * Também é o que faz a regra valer igual em qualquer máquina que rode os testes.
 */
export function hojeIso(agora = new Date()): string {
  const fuso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
  return fuso.format(agora);
}

/**
 * Dia seguinte a um dia ISO ("2026-10-15" → "2026-10-16"), sem passar pelo fuso do aparelho.
 *
 * Meio-dia UTC evita a armadilha clássica: somar um dia a "2026-10-15T00:00Z" num fuso a oeste
 * ainda é dia 15, e o rótulo "amanhã" apontaria para o dia errado. Uma função só, usada pelo
 * app e pelos testes — se a regra mudar, muda nos dois.
 */
export function diaSeguinte(dia: string): string {
  const [ano, mes, dataDia] = dia.split("-").map(Number);
  return new Date(Date.UTC(ano!, (mes ?? 1) - 1, (dataDia ?? 1) + 1, 12)).toISOString().slice(0, 10);
}

/** "Amanhã" no fuso das viagens, pronto para comparar com o dia de uma atividade. */
export function amanhaIso(agora = new Date()): string {
  return diaSeguinte(hojeIso(agora));
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

/** "2026-12-20" → "sáb, 20/12" (sem depender do fuso do aparelho). */
export function formatarDiaCurto(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  const data = new Date(Date.UTC(ano!, (mes ?? 1) - 1, dia ?? 1, 12));
  const semana = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(data).replace(".", "");
  return `${semana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

/** "2026-12-20" → "domingo, 20 de dezembro" (título do dia no roteiro). */
export function formatarDiaLongo(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  const data = new Date(Date.UTC(ano!, (mes ?? 1) - 1, dia ?? 1, 12));
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(data);
}

/** Duração em minutos → "1h30" ou "45 min" (nunca "0h"). */
export function formatarDuracao(minutos: number | null): string | null {
  if (!minutos || minutos <= 0) return null;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}

export const ROTULO_ATIVIDADE: Record<string, string> = {
  planejada: "Planejada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

/**
 * Como o custo aparece no cartão. Três situações distintas:
 * desconhecido (nada), a verificar (sinalizado) e gratuito (zero explícito) — nunca confundidas.
 */
export function descreverCusto(custo: {
  centavos: bigint | null;
  rotulo: string | null;
  natureza: "estimativa" | "compromisso" | "gratuito" | null;
}): { valor: string | null; rotulo: string | null } {
  if (custo.centavos === null) return { valor: null, rotulo: custo.rotulo };
  if (custo.natureza === "gratuito") return { valor: formatarBRL(0n), rotulo: "Sem custo" };
  return { valor: formatarBRL(custo.centavos), rotulo: custo.rotulo };
}

/** Trecho de deslocamento em uma linha (compacto). */
export function descreverDeslocamento(deslocamento: {
  minutos: number | null;
  km: number | null;
  custoCentavos: string | null;
  alerta: string | null;
}): string {
  const partes: string[] = [];
  if (deslocamento.minutos) partes.push(`${deslocamento.minutos} min`);
  if (deslocamento.km) partes.push(`${deslocamento.km} km`);
  if (deslocamento.custoCentavos) partes.push(formatarBRL(deslocamento.custoCentavos));
  return partes.join(" · ");
}
