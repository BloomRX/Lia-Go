/**
 * Diferenças de plataforma isoladas aqui (regra: nada de `if Capacitor` espalhado pela interface).
 * Web = navegador; nativo = app Android/iOS rodando dentro do Capacitor.
 */
import { Capacitor } from "@capacitor/core";

export const Platform = {
  ehNativo(): boolean {
    return Capacitor.isNativePlatform();
  },
  ehWeb(): boolean {
    return Capacitor.getPlatform() === "web";
  },
  nome(): string {
    return Capacitor.getPlatform();
  },
  /**
   * O app está aberto **dentro de outra página** (painel, portal)? Nesse caso o navegador pode
   * recusar o cookie de sessão — a tela avisa e mostra o endereço para abrir em aba própria.
   * Acesso a `window.top` bloqueado também conta como embutido.
   */
  embutido(): boolean {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  },
};
