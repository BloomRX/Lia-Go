-- 0005_orcamento.sql — limite de orçamento da viagem (coletivo e individual).
--
-- O limite é **planejamento**: ele não entra no saldo oficial (que continua calculado das despesas
-- confirmadas). O que o banco garante aqui:
--  * limite coletivo não pertence a uma pessoa e é único por viagem;
--  * limite individual pertence a exatamente uma pessoa (único por pessoa na viagem);
--  * valor nunca negativo.

CREATE TABLE IF NOT EXISTS limites_orcamento (
  id              uuid PRIMARY KEY,
  viagem_id       uuid NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  escopo          text NOT NULL CHECK (escopo IN ('coletivo', 'individual')),
  usuario_id      uuid REFERENCES usuarios(id),
  centavos        bigint NOT NULL CHECK (centavos >= 0),
  atualizado_por  uuid NOT NULL REFERENCES usuarios(id),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  versao          integer NOT NULL DEFAULT 1,
  CONSTRAINT escopo_coerente CHECK (
    (escopo = 'coletivo' AND usuario_id IS NULL)
    OR (escopo = 'individual' AND usuario_id IS NOT NULL)
  )
);

-- Um limite coletivo por viagem e um individual por pessoa.
CREATE UNIQUE INDEX IF NOT EXISTS limites_coletivo_unico ON limites_orcamento (viagem_id) WHERE escopo = 'coletivo';
CREATE UNIQUE INDEX IF NOT EXISTS limites_individual_unico ON limites_orcamento (viagem_id, usuario_id) WHERE escopo = 'individual';
