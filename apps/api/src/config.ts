/**
 * Configuração por variável de ambiente. Nenhum segredo é escrito no repositório.
 * Em desenvolvimento local o banco sobe por `npm run db:up` (Docker).
 */
export interface Config {
  databaseUrl: string;
  porta: number;
  host: string;
  /** Cookies exigem Secure quando o acesso é HTTPS (produção/HTTPS local). */
  cookieSeguro: boolean;
  nomeCookieSessao: string;
  sessaoWebHoras: number;
  tokenAcessoMinutos: number;
  refreshTokenDias: number;
  confiarProxy: boolean;
  producao: boolean;
}

export function carregarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const producao = env.NODE_ENV === "production";
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL não configurada. Rode `npm run db:up` (ou exporte DATABASE_URL) antes de iniciar a API.",
    );
  }
  if (producao && !databaseUrl.includes("sslmode=") && !databaseUrl.includes("ssl=")) {
    console.warn("Aviso: produção sem SSL explícito na DATABASE_URL. Verifique a configuração do provedor.");
  }
  return {
    databaseUrl,
    porta: Number(env.PORT ?? 3000),
    host: env.HOST ?? "0.0.0.0",
    cookieSeguro: producao || env.COOKIE_SEGURO === "true",
    nomeCookieSessao: "lia_sessao",
    sessaoWebHoras: Number(env.SESSAO_WEB_HORAS ?? 24 * 14),
    tokenAcessoMinutos: Number(env.TOKEN_ACESSO_MINUTOS ?? 30),
    refreshTokenDias: Number(env.REFRESH_TOKEN_DIAS ?? 60),
    confiarProxy: env.CONFIAR_PROXY === "true",
    producao,
  };
}
