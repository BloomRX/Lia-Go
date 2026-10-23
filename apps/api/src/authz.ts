/**
 * Autorização no servidor. Toda leitura/escrita relevante passa por aqui.
 * A decisão de negócio vem do domínio (mesma tabela usada pela interface).
 */
import type pg from "pg";
import { type Acao, type ContextoAutorizacao, type DecisaoAutorizacao, decidirAutorizacao } from "@lia-go/domain";
import { ErroHttp, naoEncontrado, semPermissao, conflitoDeVersao } from "./errors.ts";

export interface LinhaViagem {
  id: string;
  nome: string;
  destino: string;
  data_inicio: string | null;
  data_fim: string | null;
  fuso_horario: string;
  moeda: string;
  estado: ContextoAutorizacao["estadoViagem"];
  orcamento_centavos: string | null;
  versao: number;
  criado_por: string;
}

export interface ContextoViagem {
  viagem: LinhaViagem;
  usuarioId: string;
  contexto: ContextoAutorizacao;
}

const SQL_VIAGEM_COM_MEMBRO = `
  SELECT v.id, v.nome, v.destino,
         to_char(v.data_inicio, 'YYYY-MM-DD') AS data_inicio,
         to_char(v.data_fim, 'YYYY-MM-DD') AS data_fim,
         v.fuso_horario, v.moeda, v.estado,
         v.orcamento_centavos::text AS orcamento_centavos,
         v.versao, v.criado_por,
         m.papel, m.estado AS estado_membro
    FROM viagens v
    JOIN membros_viagem m ON m.viagem_id = v.id AND m.usuario_id = $2
   WHERE v.id = $1`;

/** Carrega a viagem somente se o usuário tiver vínculo; sem vínculo, nem revela que existe. */
export async function carregarContexto(
  pool: pg.Pool,
  usuarioId: string,
  viagemId: string,
): Promise<ContextoViagem | null> {
  const { rows } = await pool.query<LinhaViagem & { papel: ContextoAutorizacao["papel"]; estado_membro: ContextoAutorizacao["estadoMembro"] }>(
    SQL_VIAGEM_COM_MEMBRO,
    [viagemId, usuarioId],
  );
  const linha = rows[0];
  if (!linha) return null;
  return {
    viagem: linha,
    usuarioId,
    contexto: { papel: linha.papel, estadoMembro: linha.estado_membro, estadoViagem: linha.estado },
  };
}

/**
 * Exige vínculo ATIVO. Quem saiu, foi removido ou ainda não aceitou o convite
 * perde acesso a dados da viagem (o histórico fica, o acesso não).
 */
export async function exigirContexto(pool: pg.Pool, usuarioId: string, viagemId: string): Promise<ContextoViagem> {
  const contexto = await carregarContexto(pool, usuarioId, viagemId);
  if (!contexto) throw naoEncontrado();
  if (contexto.contexto.estadoMembro !== "ativo") {
    throw new ErroHttp(403, "sem_acesso", "Seu acesso a esta viagem não está ativo. Fale com o organizador.");
  }
  return contexto;
}

export function decidir(contexto: ContextoViagem, acao: Acao): DecisaoAutorizacao {
  return decidirAutorizacao(contexto.contexto, acao);
}

/** Autoriza ou lança 403 com o motivo (o motivo é exibido na interface). */
export function exigirPermissao(contexto: ContextoViagem, acao: Acao): void {
  const decisao = decidir(contexto, acao);
  if (!decisao.permitido) {
    if (contexto.contexto.estadoMembro !== "ativo") throw naoEncontrado();
    throw semPermissao(decisao.motivo);
  }
}

/** Concorrência otimista: versão divergente é conflito, nunca sobrescrita silenciosa. */
export function exigirVersao(versaoEnviada: number | undefined, versaoAtual: number): void {
  if (versaoEnviada === undefined) return;
  if (versaoEnviada !== versaoAtual) {
    throw conflitoDeVersao("Este registro mudou desde a sua última atualização; revise antes de salvar.", versaoAtual);
  }
}

/** Somente participantes ativos contam para rateio e saldos. */
export async function participantesAtivos(pool: pg.Pool, viagemId: string): Promise<string[]> {
  const { rows } = await pool.query<{ usuario_id: string }>(
    "SELECT usuario_id FROM membros_viagem WHERE viagem_id = $1 AND estado = 'ativo' ORDER BY entrou_em",
    [viagemId],
  );
  return rows.map((linha) => linha.usuario_id);
}
