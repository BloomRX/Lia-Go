/**
 * Mapeamento entre banco e domínio. SQL explícito, tipos explícitos.
 * Nada de cálculo de dinheiro aqui: rateio e saldos vêm de @lia-go/domain.
 */
import type pg from "pg";
import type { Despesa, EventoDespesa, ResultadoRateio } from "@lia-go/domain";
import { paraCentavos } from "./db.ts";

export type EstadoDespesaLinha = Despesa["estado"];

export interface LinhaDespesa {
  id: string;
  viagem_id: string;
  autor_id: string;
  pagador_id: string;
  tipo: Despesa["tipo"];
  estado: EstadoDespesaLinha;
  valor_centavos: string;
  moeda: string;
  data: string;
  descricao: string;
  motivo_contestacao: string | null;
  versao: number;
}

export interface LinhaParte {
  participante_id: string;
  valor_centavos: string;
  ajuste_resto: number;
}

export interface LinhaEvento {
  acao: EventoDespesa["acao"];
  autor_id: string;
  em: string;
  estado_anterior: EstadoDespesaLinha | null;
  estado_novo: EstadoDespesaLinha | null;
  motivo: string | null;
  alteracoes: Record<string, { de: unknown; para: unknown }> | null;
}

export function mapearDespesa(linha: LinhaDespesa, partes: LinhaParte[], eventos: LinhaEvento[]): Despesa {
  const total = paraCentavos(linha.valor_centavos);
  const rateio: ResultadoRateio = {
    partes: partes.map((parte) => ({
      participanteId: parte.participante_id,
      valor: paraCentavos(parte.valor_centavos),
      ajusteResto: parte.ajuste_resto,
    })),
    total,
    explicacao: "",
    ajusteTotal: total,
  };
  return {
    id: linha.id,
    viagemId: linha.viagem_id,
    autorId: linha.autor_id,
    pagadorId: linha.pagador_id,
    tipo: linha.tipo,
    estado: linha.estado,
    valorCentavos: total,
    moeda: linha.moeda,
    data: linha.data,
    descricao: linha.descricao,
    rateio,
    versao: linha.versao,
    motivoContestacao: linha.motivo_contestacao,
    historico: eventos.map((evento) => ({
      acao: evento.acao,
      autorId: evento.autor_id,
      em: evento.em,
      estadoAnterior: evento.estado_anterior ?? "pendente",
      estadoNovo: evento.estado_novo ?? "pendente",
      motivo: evento.motivo,
      ...(evento.alteracoes ? { alteracoes: evento.alteracoes } : {}),
    })),
  };
}

export async function carregarDespesa(
  executor: pg.Pool | pg.PoolClient,
  viagemId: string,
  despesaId: string,
  paraAtualizar = false,
): Promise<{ despesa: Despesa; linha: LinhaDespesa } | null> {
  const sql = `SELECT id, viagem_id, autor_id, pagador_id, tipo, estado, valor_centavos::text AS valor_centavos,
                      moeda, to_char(data, 'YYYY-MM-DD') AS data, descricao, motivo_contestacao, versao
                 FROM despesas WHERE id = $1 AND viagem_id = $2${paraAtualizar ? " FOR UPDATE" : ""}`;
  const { rows } = await executor.query<LinhaDespesa>(sql, [despesaId, viagemId]);
  const linha = rows[0];
  if (!linha) return null;
  const partes = await executor.query<LinhaParte>(
    `SELECT participante_id, valor_centavos::text AS valor_centavos, ajuste_resto
       FROM despesas_partes WHERE despesa_id = $1
      ORDER BY valor_centavos DESC, participante_id`,
    [despesaId],
  );
  const eventos = await executor.query<LinhaEvento>(
    `SELECT acao, autor_id, em::text AS em, estado_anterior, estado_novo, motivo, alteracoes
       FROM despesa_eventos WHERE despesa_id = $1 ORDER BY id`,
    [despesaId],
  );
  return { despesa: mapearDespesa(linha, partes.rows, eventos.rows), linha };
}

export function rateioParaJson(rateio: ResultadoRateio): {
  partes: { participanteId: string; valorCentavos: string; ajusteResto: number }[];
  totalCentavos: string;
  explicacao: string;
} {
  return {
    partes: rateio.partes.map((parte) => ({
      participanteId: parte.participanteId,
      valorCentavos: parte.valor.toString(),
      ajusteResto: parte.ajusteResto,
    })),
    totalCentavos: rateio.total.toString(),
    explicacao: rateio.explicacao,
  };
}

export function despesaParaJson(despesa: Despesa): Record<string, unknown> {
  return {
    id: despesa.id,
    viagemId: despesa.viagemId,
    autorId: despesa.autorId,
    pagadorId: despesa.pagadorId,
    tipo: despesa.tipo,
    estado: despesa.estado,
    valorCentavos: despesa.valorCentavos.toString(),
    moeda: despesa.moeda,
    data: despesa.data,
    descricao: despesa.descricao,
    motivoContestacao: despesa.motivoContestacao,
    versao: despesa.versao,
    rateio: rateioParaJson(despesa.rateio),
    historico: despesa.historico,
  };
}

/** Grava as partes do rateio (soma já validada pelo domínio). */
export async function gravarPartes(
  cliente: pg.PoolClient,
  despesaId: string,
  rateio: ResultadoRateio,
): Promise<void> {
  await cliente.query("DELETE FROM despesas_partes WHERE despesa_id = $1", [despesaId]);
  for (const parte of rateio.partes) {
    await cliente.query(
      `INSERT INTO despesas_partes (despesa_id, participante_id, valor_centavos, ajuste_resto)
       VALUES ($1, $2, $3, $4)`,
      [despesaId, parte.participanteId, parte.valor.toString(), parte.ajusteResto],
    );
  }
}

export async function gravarEvento(
  cliente: pg.PoolClient,
  despesaId: string,
  evento: EventoDespesa,
): Promise<void> {
  await cliente.query(
    `INSERT INTO despesa_eventos (despesa_id, acao, autor_id, em, estado_anterior, estado_novo, motivo, alteracoes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      despesaId,
      evento.acao,
      evento.autorId,
      evento.em,
      evento.estadoAnterior,
      evento.estadoNovo,
      evento.motivo,
      evento.alteracoes ? JSON.stringify(evento.alteracoes) : null,
    ],
  );
}
