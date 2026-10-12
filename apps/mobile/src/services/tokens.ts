/**
 * Tokens do app nativo.
 * Na web NADA é guardado aqui: a sessão é cookie HttpOnly (inacessível a JavaScript).
 * No aparelho, o refresh token fica no armazenamento do Capacitor Preferences
 * (Keychain/Keystore quando disponível na plataforma).
 */
import { Preferences } from "@capacitor/preferences";

export interface TokensNativos {
  acesso: string;
  refresh: string;
}

const CHAVE_ACESSO = "lia.acesso";
const CHAVE_REFRESH = "lia.refresh";

export async function guardarTokens(tokens: TokensNativos): Promise<void> {
  await Preferences.set({ key: CHAVE_ACESSO, value: tokens.acesso });
  await Preferences.set({ key: CHAVE_REFRESH, value: tokens.refresh });
}

export async function lerTokens(): Promise<TokensNativos | null> {
  const acesso = await Preferences.get({ key: CHAVE_ACESSO });
  const refresh = await Preferences.get({ key: CHAVE_REFRESH });
  if (!acesso.value || !refresh.value) return null;
  return { acesso: acesso.value, refresh: refresh.value };
}

export async function limparTokens(): Promise<void> {
  await Preferences.remove({ key: CHAVE_ACESSO });
  await Preferences.remove({ key: CHAVE_REFRESH });
}
