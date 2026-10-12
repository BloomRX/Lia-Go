-- Sincronização incremental: o cursor é a sequência de auditoria (auditoria.id).
-- O índice por (viagem_id, id) torna a busca "o que mudou desde o cursor" direta.
CREATE INDEX IF NOT EXISTS auditoria_por_viagem_sequencia ON auditoria (viagem_id, id);
