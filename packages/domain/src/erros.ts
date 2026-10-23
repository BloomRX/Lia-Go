/**
 * Erro de regra de negócio.
 * As mensagens são escritas para a pessoa usuária final, sem detalhe técnico.
 * A API converte este erro em resposta 400 (nunca 500): é regra violada, não falha de sistema.
 */
export class ErroDeDominio extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeDominio";
  }
}
