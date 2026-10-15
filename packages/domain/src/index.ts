/**
 * @lia-go/domain — regras de negócio do Lia Go.
 * Puro: sem rede, sem banco, sem interface. Usado pelo servidor (autoridade)
 * e pelo app (apenas prévia/offline); a decisão final é sempre do servidor.
 */
export * from "./erros.ts";
export * from "./money.ts";
export * from "./split.ts";
export * from "./permissions.ts";
export * from "./trip-state.ts";
export * from "./expense.ts";
export * from "./balances.ts";
export * from "./invite.ts";
export * from "./roteiro.ts";
export * from "./reserva.ts";
