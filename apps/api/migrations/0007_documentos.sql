-- 0007_documentos.sql — documentos da viagem (passagem, reserva, seguro, identidade, ingresso).
--
-- Privacidade garantida no banco, não só na tela:
--  * nasce **privado**: estado 'ativo' com visibilidade 'privado' e nenhum acesso concedido;
--  * "compartilhado com a viagem" ou com pessoas específicas (`compartilhado_com uuid[]`);
--  * remover é **remoção lógica** com motivo (>= 5) e revoga todo acesso;
--  * nesta fatia o Lia Go guarda o **link** e a descrição — o arquivo binário continua onde a pessoa
--    colocou. Subir arquivo de verdade depende de decisão de hospedagem/custo (ARCHITECTURE §11).

CREATE TABLE IF NOT EXISTS documentos (
  id                uuid PRIMARY KEY,
  viagem_id         uuid NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  autor_id          uuid NOT NULL REFERENCES usuarios(id),
  tipo              text NOT NULL CHECK (tipo IN ('passagem', 'reserva', 'seguro', 'identidade', 'ingresso', 'outro')),
  nome              text NOT NULL CHECK (length(trim(nome)) >= 2),
  descricao         text,
  link              text CHECK (link IS NULL OR link ~* '^https?://'),
  visibilidade      text NOT NULL DEFAULT 'privado' CHECK (visibilidade IN ('privado', 'viagem')),
  compartilhado_com uuid[] NOT NULL DEFAULT '{}',
  estado            text NOT NULL DEFAULT 'ativo' CHECK (estado IN ('ativo', 'removido')),
  removido_por      uuid REFERENCES usuarios(id),
  removido_em       timestamptz,
  motivo_remocao    text CHECK (motivo_remocao IS NULL OR length(trim(motivo_remocao)) >= 5),
  versao            integer NOT NULL DEFAULT 1,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT remocao_coerente CHECK (
    (estado = 'removido' AND removido_por IS NOT NULL AND removido_em IS NOT NULL AND motivo_remocao IS NOT NULL)
    OR (estado = 'ativo' AND removido_por IS NULL AND removido_em IS NULL AND motivo_remocao IS NULL)
  ),
  -- Removido não fica compartilhado com ninguém (o acesso sai junto com a remoção).
  CONSTRAINT removido_sem_acesso CHECK (estado <> 'removido' OR compartilhado_com = '{}')
);

CREATE INDEX IF NOT EXISTS documentos_por_viagem ON documentos (viagem_id, estado, tipo);

CREATE TABLE IF NOT EXISTS documento_eventos (
  id              bigserial PRIMARY KEY,
  documento_id    uuid NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  acao            text NOT NULL,
  autor_id        uuid NOT NULL REFERENCES usuarios(id),
  em              timestamptz NOT NULL DEFAULT now(),
  motivo          text,
  alteracoes      jsonb
);

CREATE INDEX IF NOT EXISTS documento_eventos_por_documento ON documento_eventos (documento_id, id);
