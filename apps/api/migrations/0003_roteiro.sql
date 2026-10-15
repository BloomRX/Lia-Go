-- 0003_roteiro.sql — roteiro da viagem (atividades por dia).
--
-- Regras confirmadas em docs/UI_VISUAL_GUIDELINES.md §2, garantidas também no banco
-- (defesa em profundidade, como nas despesas):
--  * o relógio não conclui nada: concluir exige autor e hora registrados (CHECK);
--  * custo desconhecido não é zero: `NULL` = desconhecido, `0` só com natureza 'gratuito';
--  * nada é apagado em silêncio: o histórico fica em `atividade_eventos`.

CREATE TABLE IF NOT EXISTS atividades (
  id                 uuid PRIMARY KEY,
  viagem_id          uuid NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  autor_id           uuid NOT NULL REFERENCES usuarios(id),
  dia                date NOT NULL,
  ordem              integer NOT NULL CHECK (ordem > 0),
  titulo             text NOT NULL CHECK (length(trim(titulo)) >= 2),
  -- NULL = horário flexível. Nunca preencher com horário "provável".
  hora               time,
  duracao_minutos    integer CHECK (duracao_minutos IS NULL OR duracao_minutos > 0),
  local              text,
  -- NULL = custo desconhecido (omitido na tela; nunca exibido como R$ 0,00).
  custo_centavos     bigint CHECK (custo_centavos IS NULL OR custo_centavos >= 0),
  custo_natureza     text CHECK (custo_natureza IN ('estimativa', 'compromisso', 'gratuito')),
  custo_a_verificar  boolean NOT NULL DEFAULT false,
  estado             text NOT NULL DEFAULT 'planejada' CHECK (estado IN ('planejada', 'concluida', 'cancelada')),
  concluida_por      uuid REFERENCES usuarios(id),
  concluida_em       timestamptz,
  observacao         text,
  -- Deslocamento até esta atividade (a partir da anterior): trecho longo, atraso ou risco.
  deslocamento_minutos       integer CHECK (deslocamento_minutos IS NULL OR deslocamento_minutos > 0),
  deslocamento_km            integer CHECK (deslocamento_km IS NULL OR deslocamento_km >= 0),
  deslocamento_custo_centavos bigint CHECK (deslocamento_custo_centavos IS NULL OR deslocamento_custo_centavos >= 0),
  deslocamento_alerta        text,
  versao             integer NOT NULL DEFAULT 1,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  atualizado_em      timestamptz NOT NULL DEFAULT now(),
  -- Três significados que não podem ser confundidos: desconhecido, classificado e gratuito.
  CONSTRAINT custo_com_natureza_coerente CHECK (
    (custo_centavos IS NULL AND custo_natureza IS NULL)
    OR (custo_natureza = 'gratuito' AND custo_centavos = 0)
    OR (custo_natureza IN ('estimativa', 'compromisso') AND custo_centavos > 0)
  ),
  -- Concluída sempre tem quem concluiu e quando; planejada/cancelada nunca têm.
  CONSTRAINT conclusao_coerente CHECK (
    (estado = 'concluida' AND concluida_por IS NOT NULL AND concluida_em IS NOT NULL)
    OR (estado <> 'concluida' AND concluida_por IS NULL AND concluida_em IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS atividades_por_viagem ON atividades (viagem_id, dia, ordem);

CREATE TABLE IF NOT EXISTS atividade_eventos (
  id              bigserial PRIMARY KEY,
  atividade_id    uuid NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
  acao            text NOT NULL,
  autor_id        uuid NOT NULL REFERENCES usuarios(id),
  em              timestamptz NOT NULL DEFAULT now(),
  estado_anterior text,
  estado_novo     text,
  motivo          text,
  alteracoes      jsonb
);

CREATE INDEX IF NOT EXISTS atividade_eventos_por_atividade ON atividade_eventos (atividade_id, id);
