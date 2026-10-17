/**
 * Sessão por token **no navegador**, usada só quando o cookie HttpOnly não pôde ser guardado.
 *
 * Por que existe (defeito real de 2026-10-17): quando o app é aberto dentro de outra página (painel
 * embutido), o navegador pode recusar o cookie de sessão — mesmo com `SameSite=None; Secure;
 * Partitioned`. Sem isso, o login era aceito e a sessão se perdia no pedido seguinte.
 *
 * Regras de segurança (não afrouxar):
 * - **`sessionStorage`, nunca `localStorage`**: o token mora na aba, morre ao fechar e não é
 *   compartilhado com outras abas nem com outros sites.
 * - Só entra em uso depois de o cookie falhar; o caminho normal continua sendo cookie HttpOnly,
 *   que o JavaScript não consegue ler.
 * - O token de acesso é curto e o refresh é rotativo; sair encerra a sessão no servidor e apaga
 *   tudo daqui.
 * - Nenhum token é gravado em log ou em mensagem de erro.
 */

const CHAVE = "lia.sessao.embutida";

export interface TokensDaAba {
  acesso: string;
  refresh: string;
}

/** `sessionStorage` pode não existir (SSR/teste) ou estar bloqueado (modo privado). */
function armazem(): Storage | null {
  try {
    const s = globalThis.sessionStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

export function lerSessaoEmbutida(): TokensDaAba | null {
  const bruto = armazem()?.getItem(CHAVE);
  if (!bruto) return null;
  try {
    const dados = JSON.parse(bruto) as Partial<TokensDaAba>;
    if (typeof dados.acesso !== "string" || typeof dados.refresh !== "string") return null;
    return { acesso: dados.acesso, refresh: dados.refresh };
  } catch {
    return null;
  }
}

export function guardarSessaoEmbutida(tokens: TokensDaAba): void {
  armazem()?.setItem(CHAVE, JSON.stringify(tokens));
}

export function limparSessaoEmbutida(): void {
  armazem()?.removeItem(CHAVE);
}

/** Há sessão por token nesta aba? (usado para decidir se vale tentar renovar). */
export function temSessaoEmbutida(): boolean {
  return lerSessaoEmbutida() !== null;
}
