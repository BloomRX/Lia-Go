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
};
