-- 0001_init.sql — esquema inicial do Lia Go.
-- Regras de negócio em nível de banco (defesa em profundidade):
--  * dinheiro em BIGINT (centavos inteiros), nunca ponto flutuante;
--  * despesa nasce 'pendente' e quem confirma nunca é o autor (CHECK);
--  * a viagem tem no máximo um organizador ativo (índice único parcial);
--  * nada é apagado silenciosamente: histórico e auditoria em tabelas próprias.

CREATE TABLE IF NOT EXISTS usuarios (
  id            uuid PRIMARY KEY,
  nome          text NOT NULL CHECK (length(trim(nome)) >= 2),
  email         text NOT NULL,
  email_normalizado text NOT NULL UNIQUE,
  senha_hash    text NOT NULL,
  senha_salt    text NOT NULL,
  senha_algoritmo text NOT NULL DEFAULT 'scrypt-v1',
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Sessões da web (cookie HttpOnly) e tokens de acesso curtos do app nativo.
CREATE TABLE IF NOT EXISTS sessoes (
  id            uuid PRIMARY KEY,
  usuario_id    uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  expira_em     timestamptz NOT NULL,
  revogada_em   timestamptz,
  ultimo_uso_em timestamptz,
  origem        text NOT NULL DEFAULT 'web' CHECK (origem IN ('web', 'nativo')),
  dispositivo   text
);

-- Refresh tokens do app nativo (rotativos).
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          uuid PRIMARY KEY,
  usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  expira_em   timestamptz NOT NULL,
  revogado_em timestamptz,
  substituido_por uuid
);

-- Tentativas de login: guarda apenas hashes (minimização de dados pessoais).
CREATE TABLE IF NOT EXISTS tentativas_login (
  id            bigserial PRIMARY KEY,
  email_hash    text NOT NULL,
  origem_hash   text NOT NULL,
  sucesso       boolean NOT NULL,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS viagens (
  id             uuid PRIMARY KEY,
  nome           text NOT NULL CHECK (length(trim(nome)) >= 2),
  destino        text NOT NULL DEFAULT '',
  data_inicio    date,
  data_fim       date,
  fuso_horario   text NOT NULL DEFAULT 'America/Sao_Paulo',
  moeda          char(3) NOT NULL DEFAULT 'BRL',
  estado         text NOT NULL DEFAULT 'rascunho'
                 CHECK (estado IN ('rascunho','planejada','em_andamento','concluida','pendente','cancelada')),
  orcamento_centavos bigint CHECK (orcamento_centavos IS NULL OR orcamento_centavos >= 0),
  versao         integer NOT NULL DEFAULT 1,
  criado_por     uuid NOT NULL REFERENCES usuarios(id),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim IS NULL OR data_inicio IS NULL OR data_fim >= data_inicio)
);

CREATE TABLE IF NOT EXISTS membros_viagem (
  viagem_id  uuid NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  papel      text NOT NULL CHECK (papel IN ('organizador','participante')),
  estado     text NOT NULL CHECK (estado IN ('ativo','convidado','saiu','removido')),
  entrou_em  timestamptz NOT NULL DEFAULT now(),
  alterado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (viagem_id, usuario_id)
);

-- Uma viagem tem no máximo um organizador ativo.
CREATE UNIQUE INDEX IF NOT EXISTS um_organizador_ativo_por_viagem
  ON membros_viagem (viagem_id) WHERE papel = 'organizador' AND estado = 'ativo';

CREATE TABLE IF NOT EXISTS convites (
  id         uuid PRIMARY KEY,
  viagem_id  uuid NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  email      text NOT NULL,
  email_normalizado text NOT NULL,
  papel      text NOT NULL DEFAULT 'participante' CHECK (papel IN ('participante','organizador')),
  estado     text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','aceito','recusado','cancelado','expirado')),
  token_hash text NOT NULL UNIQUE,
  criado_por uuid NOT NULL REFERENCES usuarios(id),
  criado_em  timestamptz NOT NULL DEFAULT now(),
  expira_em  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS convites_pendentes_por_email
  ON convites (email_normalizado) WHERE estado = 'pendente';

CREATE TABLE IF NOT EXISTS despesas (
  id             uuid PRIMARY KEY,
  viagem_id      uuid NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  autor_id       uuid NOT NULL REFERENCES usuarios(id),
  pagador_id     uuid NOT NULL REFERENCES usuarios(id),
  tipo           text NOT NULL CHECK (tipo IN ('pessoal','compartilhada')),
  estado         text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','confirmada','contestada','cancelada')),
  valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
  moeda          char(3) NOT NULL DEFAULT 'BRL',
  data           date NOT NULL,
  descricao      text NOT NULL CHECK (length(trim(descricao)) >= 2),
  motivo_contestacao text,
  confirmado_por uuid REFERENCES usuarios(id),
  confirmado_em  timestamptz,
  versao         integer NOT NULL DEFAULT 1,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  -- Regra confirmada, garantida pelo banco: o autor não confirma o próprio lançamento.
  CONSTRAINT autor_nao_confirma_proprio_lancamento CHECK (confirmado_por IS NULL OR confirmado_por <> autor_id)
);

CREATE INDEX IF NOT EXISTS despesas_por_viagem ON despesas (viagem_id, data DESC);
CREATE INDEX IF NOT EXISTS despesas_pendentes ON despesas (viagem_id) WHERE estado = 'pendente';

CREATE TABLE IF NOT EXISTS despesas_partes (
  despesa_id      uuid NOT NULL REFERENCES despesas(id) ON DELETE CASCADE,
  participante_id uuid NOT NULL REFERENCES usuarios(id),
  valor_centavos  bigint NOT NULL CHECK (valor_centavos >= 0),
  ajuste_resto    smallint NOT NULL DEFAULT 0 CHECK (ajuste_resto IN (0, 1)),
  PRIMARY KEY (despesa_id, participante_id)
);

CREATE TABLE IF NOT EXISTS despesa_eventos (
  id              bigserial PRIMARY KEY,
  despesa_id      uuid NOT NULL REFERENCES despesas(id) ON DELETE CASCADE,
  acao            text NOT NULL,
  autor_id        uuid NOT NULL REFERENCES usuarios(id),
  em              timestamptz NOT NULL DEFAULT now(),
  estado_anterior text,
  estado_novo     text,
  motivo          text,
  alteracoes      jsonb
);

CREATE TABLE IF NOT EXISTS movimentos (
  id             uuid PRIMARY KEY,
  viagem_id      uuid NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  de_id          uuid NOT NULL REFERENCES usuarios(id),
  para_id        uuid NOT NULL REFERENCES usuarios(id),
  valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
  estado         text NOT NULL DEFAULT 'informado' CHECK (estado IN ('informado','confirmado','contestado')),
  despesa_id     uuid REFERENCES despesas(id),
  confirmado_por uuid REFERENCES usuarios(id),
  confirmado_em  timestamptz,
  criado_por     uuid NOT NULL REFERENCES usuarios(id),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  CHECK (de_id <> para_id)
);

-- Auditoria genérica: quem fez o quê, quando, com motivo e dados do antes/depois.
CREATE TABLE IF NOT EXISTS auditoria (
  id          bigserial PRIMARY KEY,
  viagem_id   uuid REFERENCES viagens(id) ON DELETE CASCADE,
  ator_id     uuid NOT NULL REFERENCES usuarios(id),
  acao        text NOT NULL,
  entidade    text NOT NULL,
  entidade_id text NOT NULL,
  em          timestamptz NOT NULL DEFAULT now(),
  motivo      text,
  dados       jsonb
);

CREATE INDEX IF NOT EXISTS auditoria_por_viagem ON auditoria (viagem_id, em DESC);

-- Idempotência: a mesma chave nunca aplica a mesma escrita duas vezes
-- (necessário para a fila offline e para reenvios de rede).
CREATE TABLE IF NOT EXISTS idempotencia (
  chave      text PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  rota       text NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  resposta   jsonb
);
