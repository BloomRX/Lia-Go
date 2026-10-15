/**
 * Marca local de "saída pendente".
 *
 * Por que existe: quando alguém toca em **Sair** e o servidor não responde (rede caiu), a sessão
 * continua válida no cookie. Se a página for recarregada, o app entraria de novo sozinho — numa
 * situação de aparelho compartilhado isso é exatamente o que a pessoa pediu para evitar.
 *
 * Então: a intenção de sair fica anotada **fora** dos dados de viagem (que são apagados no logout) e,
 * na próxima abertura, o app tenta encerrar a sessão de novo antes de mostrar qualquer coisa.
 * Esta marca não é segredo nem credencial: é só um lembrete.
 */
const CHAVE = "lia.saidaPendente";

function armazem(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // navegador com armazenamento bloqueado: seguimos sem a marca
  }
}

export function marcarSaidaPendente(): void {
  try {
    armazem()?.setItem(CHAVE, new Date().toISOString());
  } catch {
    /* sem armazenamento, a marca é simplesmente ignorada */
  }
}

export function limparSaidaPendente(): void {
  try {
    armazem()?.removeItem(CHAVE);
  } catch {
    /* idem */
  }
}

export function saidaPendente(): boolean {
  try {
    return armazem()?.getItem(CHAVE) !== null;
  } catch {
    return false;
  }
}
