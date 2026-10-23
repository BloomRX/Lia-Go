/**
 * Entrada da API em desenvolvimento/produção.
 * Nada é publicado em nome de ninguém: apenas expõe o servidor HTTP.
 */
import { carregarConfig } from "./config.ts";
import { aplicarMigracoes, criarPool } from "./db.ts";
import { construirServidor } from "./server.ts";

async function principal(): Promise<void> {
  const config = carregarConfig();
  const pool = criarPool(config.databaseUrl);

  const aplicadas = await aplicarMigracoes(pool);
  if (aplicadas.length > 0) console.log(`Migrações aplicadas: ${aplicadas.join(", ")}`);

  const app = await construirServidor({ pool, config });
  await app.listen({ port: config.porta, host: config.host });
  console.log(`Lia Go API ouvindo em http://${config.host}:${config.porta}`);
  console.log("Endpoints de verificação: GET /saude · POST /auth/registro · POST /auth/login");

  const encerrar = async (): Promise<void> => {
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);
}

principal().catch((erro: unknown) => {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  console.error(`Não foi possível iniciar a API: ${mensagem}`);
  process.exit(1);
});
