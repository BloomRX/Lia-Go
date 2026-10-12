/**
 * Tokens do app nativo.
 *
 * - **Web:** nada é guardado aqui. A sessão é cookie HttpOnly (JavaScript não consegue ler).
 * - **App nativo:** os tokens vão para o armazenamento seguro do sistema — Android Keystore
 *   (criptografia por hardware) e iOS Keychain. Se o armazenamento seguro não estiver
 *   disponível naquele aparelho, caímos para o armazenamento do próprio app e **avisamos**
 *   (`modoDeArmazenamento()`), em vez de fingir que está seguro.
 *
 * Prática de mercado seguida (ver docs/DECISIONS_AND_OPEN_QUESTIONS.md): token de sessão
 * nunca fica em armazenamento comum quando existe Keychain/Keystore.
 */
const CHAVE_ACESSO = "lia.acesso";
const CHAVE_REFRESH = "lia.refresh";

export interface TokensNativos {
  acesso: string;
  refresh: string;
}

type ModoArmazenamento = "seguro" | "comum" | "indisponivel";

/** Plugin de armazenamento seguro (Keychain/Keystore). Carregado só no app nativo. */
interface ArmazenamentoSeguro {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

let pluginSeguro: Promise<ArmazenamentoSeguro | null> | null = null;
let ultimoModo: ModoArmazenamento = "indisponivel";

function carregarSeguro(): Promise<ArmazenamentoSeguro | null> {
  pluginSeguro ??= import("@aparajita/capacitor-secure-storage")
    .then((modulo) => {
      const candidato = modulo.SecureStorage as unknown as ArmazenamentoSeguro | undefined;
      return candidato && typeof candidato.get === "function" ? candidato : null;
    })
    .catch(() => null);
  return pluginSeguro;
}

async function comArmazenamentoComum(): Promise<typeof import("@capacitor/preferences")> {
  return import("@capacitor/preferences");
}

export async function guardarTokens(tokens: TokensNativos): Promise<void> {
  const seguro = await carregarSeguro();
  if (seguro) {
    try {
      await seguro.set(CHAVE_ACESSO, tokens.acesso);
      await seguro.set(CHAVE_REFRESH, tokens.refresh);
      ultimoModo = "seguro";
      return;
    } catch {
      /* segue para o armazenamento comum e reporta o modo real */
    }
  }
  const { Preferences } = await comArmazenamentoComum();
  await Preferences.set({ key: CHAVE_ACESSO, value: tokens.acesso });
  await Preferences.set({ key: CHAVE_REFRESH, value: tokens.refresh });
  ultimoModo = "comum";
}

export async function lerTokens(): Promise<TokensNativos | null> {
  const seguro = await carregarSeguro();
  if (seguro) {
    try {
      const acesso = await seguro.get(CHAVE_ACESSO);
      const refresh = await seguro.get(CHAVE_REFRESH);
      if (acesso && refresh) {
        ultimoModo = "seguro";
        return { acesso, refresh };
      }
    } catch {
      /* cai para o armazenamento comum */
    }
  }
  const { Preferences } = await comArmazenamentoComum();
  const acesso = await Preferences.get({ key: CHAVE_ACESSO });
  const refresh = await Preferences.get({ key: CHAVE_REFRESH });
  if (!acesso.value || !refresh.value) return null;
  ultimoModo = seguro ? "seguro" : "comum";
  return { acesso: acesso.value, refresh: refresh.value };
}

export async function limparTokens(): Promise<void> {
  const seguro = await carregarSeguro();
  if (seguro) {
    await seguro.remove(CHAVE_ACESSO).catch(() => undefined);
    await seguro.remove(CHAVE_REFRESH).catch(() => undefined);
  }
  const { Preferences } = await comArmazenamentoComum();
  await Preferences.remove({ key: CHAVE_ACESSO });
  await Preferences.remove({ key: CHAVE_REFRESH });
}

/** O que a tela mostra sobre onde os tokens estão guardados neste aparelho. */
export function modoDeArmazenamento(): ModoArmazenamento {
  return ultimoModo;
}

export function rotuloDeArmazenamento(): string {
  switch (ultimoModo) {
    case "seguro":
      return "armazenamento seguro do aparelho (Keychain/Keystore)";
    case "comum":
      return "armazenamento do app (este aparelho não ofereceu o armazenamento seguro)";
    default:
      return "nenhum (sessão pelo cookie do navegador)";
  }
}
