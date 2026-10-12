/**
 * Detalhe da viagem: a fonte única do que a tela da viagem recebe.
 *
 * É usado pelo `GET /viagens/:id` e pelo `GET /viagens/:id/mudancas` (sincronização
 * incremental). Ficar em um lugar só evita que os dois caminhos mostrem dados diferentes.
 */
import type pg from "pg";
import { ROTULOS_ESTADO, sugerirEstado, transicoesPermitidas, type Viagem } from "@lia-go/domain";
import { decidir, type ContextoViagem } from "./authz.ts";

export interface DetalheViagem {
  viagem: Record<string, unknown> & { id: string; versao: number; estado: string };
  papel: string;
  participantes: Record<string, unknown>[];
  pendencias: { despesas: number; convites: number };
  sugestao: unknown;
  permissoes: {
    editar: unknown;
    cancelar: unknown;
    convidar: unknown;
    registrarDespesa: unknown;
    transicoesPermitidas: string[];
  };
}

/** Participantes com todos os estados: quem saiu continua no histórico e não some da tela. */
export async function carregarParticipantes(
  pool: pg.Pool,
  viagemId: string,
): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT m.usuario_id, u.nome, m.papel, m.estado, m.entrou_em::text AS entrou_em
       FROM membros_viagem m JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.viagem_id = $1
      ORDER BY m.estado, m.papel DESC, u.nome`,
    [viagemId],
  );
  return rows as Record<string, unknown>[];
}

export async function carregarDetalheViagem(
  pool: pg.Pool,
  contexto: ContextoViagem,
): Promise<DetalheViagem> {
  const viagemId = contexto.viagem.id;
  const participantes = await carregarParticipantes(pool, viagemId);
  const pendencias = await pool.query<{ despesas: number; convites: number }>(
    `SELECT
       (SELECT count(*)::int FROM despesas WHERE viagem_id = $1 AND estado IN ('pendente','contestada')) AS despesas,
       (SELECT count(*)::int FROM convites WHERE viagem_id = $1 AND estado = 'pendente') AS convites`,
    [viagemId],
  );

  // O cliente é o mesmo que pediu: sugestão e permissões também são calculadas no servidor.
  const sugestao = sugerirEstado(viagemDominio(contexto), new Date().toISOString());
  const permissoes = {
    editar: decidir(contexto, "viagem:editar"),
    cancelar: decidir(contexto, "viagem:cancelar"),
    convidar: decidir(contexto, "viagem:convite:gerenciar"),
    registrarDespesa: decidir(contexto, "despesa:criar"),
    transicoesPermitidas: transicoesPermitidas(contexto.viagem.estado).filter((destino) => {
      if (contexto.contexto.papel === "organizador") return true;
      return destino === "em_andamento" || destino === "concluida" || destino === "pendente";
    }),
  };

  return {
    viagem: { ...contexto.viagem, rotuloEstado: ROTULOS_ESTADO[contexto.viagem.estado] },
    papel: contexto.contexto.papel,
    participantes,
    pendencias: pendencias.rows[0] ?? { despesas: 0, convites: 0 },
    sugestao,
    permissoes,
  };
}

function viagemDominio(contexto: ContextoViagem): Viagem {
  const viagem = contexto.viagem;
  return {
    id: viagem.id,
    estado: viagem.estado,
    dataInicio: viagem.data_inicio,
    dataFim: viagem.data_fim,
    fusoHorario: viagem.fuso_horario,
    versao: viagem.versao,
  };
}
