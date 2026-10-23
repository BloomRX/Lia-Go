-- 0006_checklist.sql — checklist da viagem (o que cada um precisa resolver).
--
-- Defesa em profundidade: o prazo **não** conclui nada no banco também.
--  * feito exige quem e quando; aberto nunca tem os dois (CHECK);
--  * reabertura exige motivo (>= 5);
--  * nada é apagado: o histórico fica em `checklist_eventos`.

CREATE TABLE IF NOT EXISTS itens_checklist (
  id                uuid PRIMARY KEY,
  viagem_id         uuid NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  autor_id          uuid NOT NULL REFERENCES usuarios(id),
  titulo            text NOT NULL CHECK (length(trim(titulo)) >= 2),
  categoria         text NOT NULL DEFAULT 'outro' CHECK (categoria IN ('documento', 'reserva', 'compras', 'saude', 'outro')),
  responsavel_id    uuid REFERENCES usuarios(id),
  prazo             date,
  estado            text NOT NULL DEFAULT 'aberto' CHECK (estado IN ('aberto', 'feito')),
  feito_por         uuid REFERENCES usuarios(id),
  feito_em          timestamptz,
  observacao        text,
  motivo_reabertura text CHECK (motivo_reabertura IS NULL OR length(trim(motivo_reabertura)) >= 5),
  versao            integer NOT NULL DEFAULT 1,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conclusao_coerente CHECK (
    (estado = 'feito' AND feito_por IS NOT NULL AND feito_em IS NOT NULL)
    OR (estado = 'aberto' AND feito_por IS NULL AND feito_em IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS itens_checklist_por_viagem ON itens_checklist (viagem_id, prazo NULLS LAST, titulo);

CREATE TABLE IF NOT EXISTS checklist_eventos (
  id              bigserial PRIMARY KEY,
  item_id         uuid NOT NULL REFERENCES itens_checklist(id) ON DELETE CASCADE,
  acao            text NOT NULL,
  autor_id        uuid NOT NULL REFERENCES usuarios(id),
  em              timestamptz NOT NULL DEFAULT now(),
  estado_anterior text,
  estado_novo     text,
  motivo          text,
  alteracoes      jsonb
);

CREATE INDEX IF NOT EXISTS checklist_eventos_por_item ON checklist_eventos (item_id, id);
