/**
 * Aplica as migrações versionadas. Seguro rodar várias vezes (idempotente).
 */
import { carregarConfig } from "./config.ts";
import { aplicarMigracoes, criarPool } from "./db.ts";

async function principal(): Promise<void> {
  const config = carregarConfig();
  const pool = criarPool(config.databaseUrl);
  try {
    const aplicadas = await aplicarMigracoes(pool);
    console.log(
      aplicadas.length === 0
        ? "Banco já estava atualizado; nenhuma migração aplicada."
        : `Migrações aplicadas: ${aplicadas.join(", ")}`,
    );
  } finally {
    await pool.end();
  }
}

principal().catch((erro: unknown) => {
  console.error(`Falha ao migrar: ${erro instanceof Error ? erro.message : String(erro)}`);
  process.exit(1);
});
