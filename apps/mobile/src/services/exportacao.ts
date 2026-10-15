/**
 * Exportação de arquivo (tela 21 — fechamento).
 *
 * Duas realidades diferentes, uma função só:
 *  - **web**: navegador baixa o arquivo de verdade (`<a download>` + Blob);
 *  - **app nativo (Capacitor)**: não existe download de navegador. Em vez de fingir que baixou,
 *    devolvemos o texto para a tela mostrar em um campo que a pessoa copia e envia como quiser
 *    (ver decisão V1 §13: a interface não insinua ação externa que não aconteceu).
 */
import { Platform } from "./plataforma.ts";

export type ResultadoDaExportacao = { tipo: "baixado"; nome: string } | { tipo: "copiar"; nome: string; conteudo: string };

export function nomeDoArquivo(base: string, extensao: "txt" | "csv", agora = new Date()): string {
  const limpo = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "viagem";
  const data = agora.toISOString().slice(0, 10);
  return `${limpo}-${data}.${extensao}`;
}

/**
 * Entrega o conteúdo à pessoa. Nunca lança por causa de API ausente: se o navegador não deixar
 * baixar, o resultado é `copiar` e a tela mostra o texto — a informação nunca se perde.
 */
export function exportarArquivo(nome: string, conteudo: string, tipoMime: string): ResultadoDaExportacao {
  if (Platform.ehNativo() || typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    return { tipo: "copiar", nome, conteudo };
  }
  try {
    const blob = new Blob([conteudo], { type: `${tipoMime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    document.body.append(link);
    link.click();
    link.remove();
    // Sem `revokeObjectURL` imediato: alguns navegadores cancelam o download em andamento.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { tipo: "baixado", nome };
  } catch {
    return { tipo: "copiar", nome, conteudo };
  }
}
