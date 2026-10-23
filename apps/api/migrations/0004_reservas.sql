-- 0004_reservas.sql — reservas da viagem (hospedagem, transporte, passeio, outro).
--
-- Defesa em profundidade (mesmo princípio das despesas e do roteiro): as regras confirmadas em
-- docs/UI_V1_DECISIONS.md §13 também valem no banco:
--  * uma reserva **nasce prevista**: confirmada exige evidência, autor e hora (CHECK);
--  * cancelada exige motivo — nada some em silêncio;
--  * custo desconhecido é NULL (nunca 0), e 0 só existe como valor informado.

CREATE TABLE IF NOT EXISTS reservas (
  id                 uuid PRIMARY KEY,
  viagem_id          uuid NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  autor_id           uuid NOT NULL REFERENCES usuarios(id),
  tipo               text NOT NULL CHECK (tipo IN ('hospedagem', 'transporte', 'passeio', 'outro')),
  titulo             text NOT NULL CHECK (length(trim(titulo)) >= 2),
  local              text,
  inicio             timestamptz,
  fim                timestamptz,
  -- NULL = valor desconhecido (omitido na tela; nunca exibido como R$ 0,00).
  custo_centavos     bigint CHECK (custo_centavos IS NULL OR custo_centavos >= 0),
  custo_a_verificar  boolean NOT NULL DEFAULT false,
  -- Evidência da confirmação: localizador, código, "pago no balcão".
  confirmacao        text,
  confirmada_por     uuid REFERENCES usuarios(id),
  confirmada_em      timestamptz,
  estado             text NOT NULL DEFAULT 'prevista' CHECK (estado IN ('prevista', 'confirmada', 'cancelada')),
  motivo_cancelamento text CHECK (motivo_cancelamento IS NULL OR length(trim(motivo_cancelamento)) >= 5),
  versao             integer NOT NULL DEFAULT 1,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  atualizado_em      timestamptz NOT NULL DEFAULT now(),
  -- Confirmada sempre tem evidência, autor e hora; prevista nunca tem.
  CONSTRAINT confirmacao_coerente CHECK (
    (estado = 'confirmada' AND confirmacao IS NOT NULL AND length(trim(confirmacao)) >= 3 AND confirmada_por IS NOT NULL AND confirmada_em IS NOT NULL)
    OR (estado <> 'confirmada' AND (confirmada_por IS NULL) = (confirmada_em IS NULL))
  ),
  -- Cancelada sempre tem motivo; não cancelada nunca tem.
  CONSTRAINT cancelamento_coerente CHECK (
    (estado = 'cancelada' AND motivo_cancelamento IS NOT NULL)
    OR (estado <> 'cancelada' AND motivo_cancelamento IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS reservas_por_viagem ON reservas (viagem_id, inicio);

CREATE TABLE IF NOT EXISTS reserva_eventos (
  id              bigserial PRIMARY KEY,
  reserva_id      uuid NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  acao            text NOT NULL,
  autor_id        uuid NOT NULL REFERENCES usuarios(id),
  em              timestamptz NOT NULL DEFAULT now(),
  estado_anterior text,
  estado_novo     text,
  motivo          text,
  alteracoes      jsonb
);

CREATE INDEX IF NOT EXISTS reserva_eventos_por_reserva ON reserva_eventos (reserva_id, id);
