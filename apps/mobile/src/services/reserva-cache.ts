/**
 * Reserva do aparelho → reserva do domínio.
 *
 * Fica fora da tela porque o **orçamento** também precisa dela (a aba Gastos soma o previsto das
 * reservas): a conversão tem de ser a mesma nos dois lugares, senão a conta diverge da tela.
 */
import type { Reserva, TipoReserva } from "@lia-go/domain";

/** Objeto do aparelho → reserva do domínio (mesma forma que o servidor devolve). */
export function comoReserva(item: Record<string, unknown>): Reserva | null {
  if (typeof item["id"] !== "string" || typeof item["titulo"] !== "string") return null;
  const custo = item["custoCentavos"];
  return {
    id: item["id"],
    viagemId: String(item["viagemId"] ?? ""),
    autorId: String(item["autorId"] ?? ""),
    tipo: (item["tipo"] as TipoReserva) ?? "outro",
    titulo: item["titulo"],
    local: (item["local"] as string | null) ?? null,
    inicio: (item["inicio"] as string | null) ?? null,
    fim: (item["fim"] as string | null) ?? null,
    custoCentavos: typeof custo === "string" && custo.length > 0 ? BigInt(custo) : null,
    custoAVerificar: Boolean(item["custoAVerificar"]),
    confirmacao: (item["confirmacao"] as string | null) ?? null,
    confirmadaPor: (item["confirmadaPor"] as string | null) ?? null,
    confirmadaEm: (item["confirmadaEm"] as string | null) ?? null,
    estado: (item["estado"] as Reserva["estado"]) ?? "prevista",
    motivoCancelamento: (item["motivoCancelamento"] as string | null) ?? null,
    versao: Number(item["versao"] ?? 1),
  };
}
