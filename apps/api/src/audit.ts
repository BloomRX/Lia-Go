/**
 * Trilha de auditoria: quem fez o quê, quando, com motivo e dados antes/depois.
 * Nunca registra senha, token ou dado pessoal além do identificador do autor.
 */
/** Aceita tanto o pool quanto um cliente dentro de transação. */
export interface ExecutorSql {
  query(texto: string, valores?: unknown[]): Promise<unknown>;
}

export interface RegistroAuditoria {
  viagemId: string | null;
  atorId: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  motivo?: string | null;
  dados?: unknown;
}

export async function registrarAuditoria(cliente: ExecutorSql, registro: RegistroAuditoria): Promise<void> {
  await cliente.query(
    `INSERT INTO auditoria (viagem_id, ator_id, acao, entidade, entidade_id, motivo, dados)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      registro.viagemId,
      registro.atorId,
      registro.acao,
      registro.entidade,
      registro.entidadeId,
      registro.motivo ?? null,
      registro.dados === undefined ? null : JSON.stringify(registro.dados),
    ],
  );
}
