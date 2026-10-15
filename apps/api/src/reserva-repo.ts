/**
 * Leitura e escrita de reservas.
 *
 * Mesmo princípio de `roteiro-repo.ts`: a **sincronização** também precisa carregar reserva mudada,
 * então existe um único lugar que transforma linha do banco em JSON para o app.
 */
import type pg from "pg";
import type { Reserva, TipoReserva } from "@lia-go/domain";

interface LinhaReserva {
  id: string;
  viagem_id: string;
  autor_id: string;
  tipo: TipoReserva;
  titulo: string;
  local: string | null;
  inicio: Date | null;
  fim: Date | null;
  custo_centavos: string | null;
  custo_a_verificar: boolean;
  confirmacao: string | null;
  confirmada_por: string | null;
  confirmada_em: Date | null;
  estado: Reserva["estado"];
  motivo_cancelamento: string | null;
  versao: number;
}

const COLUNAS = `id, viagem_id, autor_id, tipo, titulo, local, inicio, fim,
                 custo_centavos::text AS custo_centavos, custo_a_verificar,
                 confirmacao, confirmada_por, confirmada_em, estado, motivo_cancelamento, versao`;

/** Linha do banco → objeto de domínio (dinheiro como `bigint`, nunca número solto). */
export function mapearReserva(linha: LinhaReserva): Reserva {
  return {
    id: linha.id,
    viagemId: linha.viagem_id,
    autorId: linha.autor_id,
    tipo: linha.tipo,
    titulo: linha.titulo,
    local: linha.local,
    inicio: linha.inicio ? linha.inicio.toISOString() : null,
    fim: linha.fim ? linha.fim.toISOString() : null,
    custoCentavos: linha.custo_centavos === null ? null : BigInt(linha.custo_centavos),
    custoAVerificar: linha.custo_a_verificar,
    confirmacao: linha.confirmacao,
    confirmadaPor: linha.confirmada_por,
    confirmadaEm: linha.confirmada_em ? linha.confirmada_em.toISOString() : null,
    estado: linha.estado,
    motivoCancelamento: linha.motivo_cancelamento,
    versao: linha.versao,
  };
}

/** Formato que o app recebe (o mesmo em toda rota que devolve reserva). */
export function reservaParaJson(reserva: Reserva): Record<string, unknown> {
  return {
    id: reserva.id,
    viagemId: reserva.viagemId,
    autorId: reserva.autorId,
    tipo: reserva.tipo,
    titulo: reserva.titulo,
    local: reserva.local,
    inicio: reserva.inicio,
    fim: reserva.fim,
    custoCentavos: reserva.custoCentavos === null ? null : reserva.custoCentavos.toString(),
    custoAVerificar: reserva.custoAVerificar,
    confirmacao: reserva.confirmacao,
    confirmadaPor: reserva.confirmadaPor,
    confirmadaEm: reserva.confirmadaEm,
    estado: reserva.estado,
    motivoCancelamento: reserva.motivoCancelamento,
    versao: reserva.versao,
  };
}

export async function carregarReserva(
  executor: pg.Pool | pg.PoolClient,
  viagemId: string,
  reservaId: string,
  bloquear = false,
): Promise<Reserva | null> {
  const { rows } = await executor.query<LinhaReserva>(
    `SELECT ${COLUNAS} FROM reservas WHERE id = $1 AND viagem_id = $2${bloquear ? " FOR UPDATE" : ""}`,
    [reservaId, viagemId],
  );
  const linha = rows[0];
  return linha ? mapearReserva(linha) : null;
}

export async function listarReservas(
  executor: pg.Pool | pg.PoolClient,
  viagemId: string,
  ids?: string[],
): Promise<Reserva[]> {
  if (ids && ids.length === 0) return [];
  const { rows } = await executor.query<LinhaReserva>(
    `SELECT ${COLUNAS} FROM reservas WHERE viagem_id = $1${ids ? " AND id = ANY($2::uuid[])" : ""} ORDER BY inicio NULLS LAST, titulo`,
    ids ? [viagemId, ids] : [viagemId],
  );
  return rows.map(mapearReserva);
}

/** Histórico da reserva (quem mudou o quê, quando e por quê). */
export async function carregarEventosDaReserva(
  executor: pg.Pool | pg.PoolClient,
  reservaId: string,
): Promise<{ acao: string; autorId: string; em: string; motivo: string | null }[]> {
  const { rows } = await executor.query<{ acao: string; autor_id: string; em: Date; motivo: string | null }>(
    "SELECT acao, autor_id, em, motivo FROM reserva_eventos WHERE reserva_id = $1 ORDER BY id",
    [reservaId],
  );
  return rows.map((linha) => ({ acao: linha.acao, autorId: linha.autor_id, em: linha.em.toISOString(), motivo: linha.motivo }));
}

export async function gravarEventoDaReserva(
  executor: pg.Pool | pg.PoolClient,
  registro: {
    reservaId: string;
    acao: string;
    autorId: string;
    estadoAnterior?: string | null;
    estadoNovo?: string | null;
    motivo?: string | null;
    alteracoes?: Record<string, unknown> | null;
  },
): Promise<void> {
  await executor.query(
    `INSERT INTO reserva_eventos (reserva_id, acao, autor_id, estado_anterior, estado_novo, motivo, alteracoes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      registro.reservaId,
      registro.acao,
      registro.autorId,
      registro.estadoAnterior ?? null,
      registro.estadoNovo ?? null,
      registro.motivo ?? null,
      registro.alteracoes ? JSON.stringify(registro.alteracoes) : null,
    ],
  );
}
