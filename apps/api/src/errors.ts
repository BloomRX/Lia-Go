/**
 * Erros da API. Mensagens de negócio (vindas do domínio) são seguras e explicativas.
 * Nada de stack trace, SQL, nome de tabela ou dado pessoal na resposta.
 */
export class ErroHttp extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly detalhes?: unknown;

  constructor(status: number, codigo: string, mensagem: string, detalhes?: unknown) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

export const naoAutenticado = (): ErroHttp =>
  new ErroHttp(401, "nao_autenticado", "Entre na sua conta para continuar.");

export const semPermissao = (motivo: string): ErroHttp => new ErroHttp(403, "sem_permissao", motivo);

/** Viagem inexistente ou sem acesso respondem igual: não revelamos a existência de dados alheios. */
export const naoEncontrado = (): ErroHttp =>
  new ErroHttp(404, "nao_encontrado", "Não encontramos este recurso com a sua conta.");

export const conflito = (mensagem: string, detalhes?: unknown): ErroHttp =>
  new ErroHttp(409, "conflito", mensagem, detalhes);

/**
 * Conflito de versão é diferente de "esta operação não se aplica mais": aqui a alteração é
 * legítima, só chegou sobre uma versão antiga. O app mostra as duas versões e deixa a pessoa
 * decidir (nunca sobrescreve). Por isso o código próprio `conflito_versao`.
 */
export const conflitoDeVersao = (mensagem: string, versaoAtual: number): ErroHttp =>
  new ErroHttp(409, "conflito_versao", mensagem, { versaoAtual });

export const entradaInvalida = (mensagem: string): ErroHttp => new ErroHttp(400, "entrada_invalida", mensagem);

export const limiteExcedido = (mensagem: string): ErroHttp => new ErroHttp(429, "limite_excedido", mensagem);

export function mensagemSeguraDeErro(erro: unknown): string {
  if (erro instanceof ErroHttp) return erro.message;
  if (erro instanceof Error) {
    // Mensagens de validação do domínio são escritas para a pessoa usuária; nunca
    // incluem SQL, caminho de arquivo ou dado de outra conta.
    const texto = erro.message;
    const suspeito = /SELECT |INSERT |UPDATE |DELETE |\.sql|node_modules|\/home\/|password|senha_hash/i.test(texto);
    return suspeito ? "Não foi possível concluir a operação." : texto;
  }
  return "Não foi possível concluir a operação.";
}
