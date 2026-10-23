/**
 * Acesso ao PostgreSQL (banco central compartilhado).
 * SQL explícito e migrações versionadas: nada de SQLite central, nada de ORM mágico.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export type Banco = pg.Pool;
export type Cliente = pg.PoolClient;

export interface Consulta {
  texto: string;
  valores?: unknown[];
}

export function criarPool(databaseUrl: string): pg.Pool {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 10_000,
    // BIGINT volta como string para não perder precisão: convertemos com BigInt().
    types: {
      getTypeParser: (id: number, formato?: unknown) => {
        const analisador = pg.types.getTypeParser(id, formato as never);
        return analisador;
      },
    },
  });
  return pool;
}

export async function emTransacao<T>(pool: pg.Pool, trabalho: (cliente: pg.PoolClient) => Promise<T>): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const resultado = await trabalho(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (erro) {
    try {
      await cliente.query("ROLLBACK");
    } catch {
      // Se o rollback falhar, o erro original é o relevante para quem chamou.
    }
    throw erro;
  } finally {
    cliente.release();
  }
}

const DIR_MIGRACOES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export async function aplicarMigracoes(pool: pg.Pool): Promise<string[]> {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS migracoes_aplicadas (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())",
  );
  const arquivos = (await readdir(DIR_MIGRACOES)).filter((nome) => nome.endsWith(".sql")).sort();
  const aplicadas: string[] = [];
  for (const arquivo of arquivos) {
    const { rows } = await pool.query<{ nome: string }>("SELECT nome FROM migracoes_aplicadas WHERE nome = $1", [arquivo]);
    if (rows.length > 0) continue;
    const sql = await readFile(path.join(DIR_MIGRACOES, arquivo), "utf8");
    await emTransacao(pool, async (cliente) => {
      await cliente.query(sql);
      await cliente.query("INSERT INTO migracoes_aplicadas (nome) VALUES ($1)", [arquivo]);
    });
    aplicadas.push(arquivo);
  }
  return aplicadas;
}

/** BIGINT do Postgres chega como string; convertemos sempre para bigint em centavos. */
export function paraCentavos(valor: string | number | bigint | null): bigint {
  if (valor === null) throw new Error("Valor monetário ausente no banco.");
  return BigInt(typeof valor === "string" ? valor : Math.trunc(Number(valor)));
}

export function paraCentavosOuNulo(valor: string | number | bigint | null): bigint | null {
  return valor === null ? null : paraCentavos(valor);
}
