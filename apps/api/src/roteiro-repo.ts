/**
 * Leitura e escrita de atividades do roteiro.
 *
 * Fica separado das rotas porque a **sincronização** também precisa carregar atividade mudada —
 * assim existe um único lugar que sabe transformar linha do banco em JSON para o app
 * (mesmo princípio de `repo.ts` para despesas).
 */
import type pg from "pg";
import { conflitosDoDia, resumirDia, type Atividade, type Deslocamento, type NaturezaCusto } from "@lia-go/domain";

interface LinhaAtividade {
  id: string;
  viagem_id: string;
  autor_id: string;
  dia: string;
  ordem: number;
  titulo: string;
  hora: string | null;
  duracao_minutos: number | null;
  local: string | null;
  custo_centavos: string | null;
  custo_natureza: NaturezaCusto | null;
  custo_a_verificar: boolean;
  estado: Atividade["estado"];
  concluida_por: string | null;
  concluida_em: Date | null;
  observacao: string | null;
  reserva_id: string | null;
  deslocamento_minutos: number | null;
  deslocamento_km: number | null;
  deslocamento_custo_centavos: string | null;
  deslocamento_alerta: string | null;
  versao: number;
}

const COLUNAS = `id, viagem_id, autor_id, to_char(dia, 'YYYY-MM-DD') AS dia, ordem, titulo,
                 to_char(hora, 'HH24:MI') AS hora, duracao_minutos, local,
                 custo_centavos::text AS custo_centavos, custo_natureza, custo_a_verificar,
                 estado, concluida_por, concluida_em, observacao, reserva_id,
                 deslocamento_minutos, deslocamento_km,
                 deslocamento_custo_centavos::text AS deslocamento_custo_centavos, deslocamento_alerta, versao`;

/** Linha do banco → objeto de domínio (dinheiro como `bigint`, nunca número solto). */
export function mapearAtividade(linha: LinhaAtividade): Atividade {
  const deslocamento: Deslocamento | null =
    linha.deslocamento_minutos === null &&
    linha.deslocamento_km === null &&
    linha.deslocamento_custo_centavos === null &&
    linha.deslocamento_alerta === null
      ? null
      : {
          minutos: linha.deslocamento_minutos,
          km: linha.deslocamento_km,
          custoCentavos: linha.deslocamento_custo_centavos === null ? null : BigInt(linha.deslocamento_custo_centavos),
          alerta: linha.deslocamento_alerta,
        };
  return {
    id: linha.id,
    viagemId: linha.viagem_id,
    autorId: linha.autor_id,
    dia: linha.dia,
    ordem: linha.ordem,
    titulo: linha.titulo,
    hora: linha.hora,
    duracaoMinutos: linha.duracao_minutos,
    local: linha.local,
    custoCentavos: linha.custo_centavos === null ? null : BigInt(linha.custo_centavos),
    custoNatureza: linha.custo_natureza,
    custoAVerificar: linha.custo_a_verificar,
    estado: linha.estado,
    concluidaPor: linha.concluida_por,
    concluidaEm: linha.concluida_em ? linha.concluida_em.toISOString() : null,
    observacao: linha.observacao,
    reservaId: linha.reserva_id,
    deslocamento,
    versao: linha.versao,
  };
}

/** Formato que o app recebe (o mesmo em toda rota que devolve atividade). */
export function atividadeParaJson(atividade: Atividade): Record<string, unknown> {
  return {
    id: atividade.id,
    viagemId: atividade.viagemId,
    autorId: atividade.autorId,
    dia: atividade.dia,
    ordem: atividade.ordem,
    titulo: atividade.titulo,
    hora: atividade.hora,
    duracaoMinutos: atividade.duracaoMinutos,
    local: atividade.local,
    custo: {
      centavos: atividade.custoCentavos === null ? null : atividade.custoCentavos.toString(),
      natureza: atividade.custoNatureza,
      aVerificar: atividade.custoAVerificar,
    },
    estado: atividade.estado,
    concluidaPor: atividade.concluidaPor,
    concluidaEm: atividade.concluidaEm,
    observacao: atividade.observacao,
    // A atividade aponta para a reserva que a cobre; a tela busca os dados dela (e a evidência) na lista.
    reservaId: atividade.reservaId,
    deslocamento: atividade.deslocamento
      ? {
          minutos: atividade.deslocamento.minutos,
          km: atividade.deslocamento.km,
          custoCentavos: atividade.deslocamento.custoCentavos === null ? null : atividade.deslocamento.custoCentavos.toString(),
          alerta: atividade.deslocamento.alerta,
        }
      : null,
    versao: atividade.versao,
  };
}

export async function carregarAtividade(
  executor: pg.Pool | pg.PoolClient,
  viagemId: string,
  atividadeId: string,
  bloquear = false,
): Promise<Atividade | null> {
  const { rows } = await executor.query<LinhaAtividade>(
    `SELECT ${COLUNAS} FROM atividades WHERE id = $1 AND viagem_id = $2${bloquear ? " FOR UPDATE" : ""}`,
    [atividadeId, viagemId],
  );
  const linha = rows[0];
  return linha ? mapearAtividade(linha) : null;
}

export async function listarAtividades(
  executor: pg.Pool | pg.PoolClient,
  viagemId: string,
  ids?: string[],
): Promise<Atividade[]> {
  if (ids && ids.length === 0) return [];
  const { rows } = await executor.query<LinhaAtividade>(
    `SELECT ${COLUNAS} FROM atividades WHERE viagem_id = $1${ids ? " AND id = ANY($2::uuid[])" : ""} ORDER BY dia, ordem`,
    ids ? [viagemId, ids] : [viagemId],
  );
  return rows.map(mapearAtividade);
}

/**
 * O roteiro como o app desenha: dia a dia, com o resumo e os conflitos calculados pelo **domínio**
 * (a mesma regra que os testes cobrem; a tela nunca recalcula nada).
 */
export function montarRoteiro(atividades: Atividade[]): {
  dias: {
    dia: string;
    atividades: Record<string, unknown>[];
    resumo: Record<string, unknown>;
    conflitos: { tipo: string; atividadeIds: string[]; explicacao: string; sugestao: string }[];
  }[];
} {
  const porDia = new Map<string, Atividade[]>();
  for (const atividade of atividades) {
    const lista = porDia.get(atividade.dia) ?? [];
    lista.push(atividade);
    porDia.set(atividade.dia, lista);
  }
  const dias = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, lista]) => {
      const ordenadas = [...lista].sort((a, b) => a.ordem - b.ordem);
      const resumo = resumirDia(ordenadas);
      return {
        dia,
        atividades: ordenadas.map((atividade) => atividadeParaJson(atividade) as unknown as Record<string, unknown>),
        resumo: { ...resumo, custoConhecidoCentavos: resumo.custoConhecidoCentavos.toString() },
        conflitos: conflitosDoDia(ordenadas),
      };
    });
  return { dias };
}

/** Histórico da atividade (quem mudou o quê, quando e por quê). */
export async function carregarEventosDaAtividade(
  executor: pg.Pool | pg.PoolClient,
  atividadeId: string,
): Promise<{ acao: string; autorId: string; em: string; motivo: string | null }[]> {
  const { rows } = await executor.query<{ acao: string; autor_id: string; em: Date; motivo: string | null }>(
    "SELECT acao, autor_id, em, motivo FROM atividade_eventos WHERE atividade_id = $1 ORDER BY id",
    [atividadeId],
  );
  return rows.map((linha) => ({ acao: linha.acao, autorId: linha.autor_id, em: linha.em.toISOString(), motivo: linha.motivo }));
}

export async function gravarEventoDaAtividade(
  executor: pg.Pool | pg.PoolClient,
  registro: {
    atividadeId: string;
    acao: string;
    autorId: string;
    estadoAnterior?: string | null;
    estadoNovo?: string | null;
    motivo?: string | null;
    alteracoes?: Record<string, unknown> | null;
  },
): Promise<void> {
  await executor.query(
    `INSERT INTO atividade_eventos (atividade_id, acao, autor_id, estado_anterior, estado_novo, motivo, alteracoes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      registro.atividadeId,
      registro.acao,
      registro.autorId,
      registro.estadoAnterior ?? null,
      registro.estadoNovo ?? null,
      registro.motivo ?? null,
      registro.alteracoes ? JSON.stringify(registro.alteracoes) : null,
    ],
  );
}
