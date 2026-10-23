-- 0008_atividade_reserva.sql — a atividade pode apontar para a reserva que a cobre.
--
-- Por que uma coluna e não uma tabela de ligação: uma atividade tem **uma** reserva que a cobre
-- (a passagem, a hospedagem, o passeio comprado) e a relação é simples de ler e de auditar. Se um dia
-- a mesma reserva cobrir várias atividades, a mudança continua sendo aditiva.
--
-- Regra que este vínculo **não** muda (docs/UI_V1_DECISIONS.md §13): vincular não confirma reserva
-- nenhuma. Confirmar continua sendo ação separada, com evidência, em `reservas.estado`.
--
-- A mesma-viagem é validada na rota (rota + domínio); aqui a integridade referencial garante que a
-- reserva existe, e `ON DELETE SET NULL` evita que apagar uma reserva derrube o roteiro.

ALTER TABLE atividades
  ADD COLUMN IF NOT EXISTS reserva_id uuid REFERENCES reservas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS atividades_por_reserva ON atividades (reserva_id) WHERE reserva_id IS NOT NULL;
