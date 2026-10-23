/**
 * Checklist e documentos: leitura/escrita para as rotas **e** para a sincronização.
 *
 * Mesmo princípio de `roteiro-repo.ts`/`reserva-repo.ts`: existe um único lugar que transforma linha
 * do banco em JSON para o app, senão a rota e o `/mudancas` divergem com o tempo.
 */
import type pg from "pg";
import {
  ROTULO_CATEGORIA_CHECKLIST,
  ROTULO_TIPO_DOCUMENTO,
  type CategoriaChecklist,
  type Documento,
  type ItemChecklist,
  type TipoDocumento,
} from "@lia-go/domain";

/* ---------------------------------- Checklist ---------------------------------- */

interface LinhaItem {
  id: string;
  viagem_id: string;
  autor_id: string;
  titulo: string;
  categoria: CategoriaChecklist;
  responsavel_id: string | null;
  prazo: string | null;
  estado: ItemChecklist["estado"];
  feito_por: string | null;
  feito_em: Date | null;
  observacao: string | null;
  motivo_reabertura: string | null;
  versao: number;
}

const COLUNAS_ITEM = `id, viagem_id, autor_id, titulo, categoria, responsavel_id,
                       to_char(prazo, 'YYYY-MM-DD') AS prazo, estado, feito_por, feito_em,
                       observacao, motivo_reabertura, versao`;

export function mapearItem(linha: LinhaItem): ItemChecklist {
  return {
    id: linha.id,
    viagemId: linha.viagem_id,
    autorId: linha.autor_id,
    titulo: linha.titulo,
    categoria: linha.categoria,
    responsavelId: linha.responsavel_id,
    prazo: linha.prazo,
    estado: linha.estado,
    feitoPor: linha.feito_por,
    feitoEm: linha.feito_em ? linha.feito_em.toISOString() : null,
    observacao: linha.observacao,
    motivoReabertura: linha.motivo_reabertura,
    versao: linha.versao,
  };
}

export function itemParaJson(item: ItemChecklist): Record<string, unknown> {
  return {
    id: item.id,
    viagemId: item.viagemId,
    autorId: item.autorId,
    titulo: item.titulo,
    categoria: item.categoria,
    categoriaRotulo: ROTULO_CATEGORIA_CHECKLIST[item.categoria],
    responsavelId: item.responsavelId,
    prazo: item.prazo,
    estado: item.estado,
    feitoPor: item.feitoPor,
    feitoEm: item.feitoEm,
    observacao: item.observacao,
    motivoReabertura: item.motivoReabertura,
    versao: item.versao,
  };
}

export async function carregarItem(
  executor: pg.Pool | pg.PoolClient,
  viagemId: string,
  itemId: string,
  bloquear = false,
): Promise<ItemChecklist | null> {
  const { rows } = await executor.query<LinhaItem>(
    `SELECT ${COLUNAS_ITEM} FROM itens_checklist WHERE id = $1 AND viagem_id = $2${bloquear ? " FOR UPDATE" : ""}`,
    [itemId, viagemId],
  );
  return rows[0] ? mapearItem(rows[0]) : null;
}

export async function listarItens(
  executor: pg.Pool | pg.PoolClient,
  viagemId: string,
  ids?: string[],
): Promise<ItemChecklist[]> {
  if (ids && ids.length === 0) return [];
  const { rows } = await executor.query<LinhaItem>(
    `SELECT ${COLUNAS_ITEM} FROM itens_checklist WHERE viagem_id = $1${ids ? " AND id = ANY($2::uuid[])" : ""}
      ORDER BY prazo NULLS LAST, titulo`,
    ids ? [viagemId, ids] : [viagemId],
  );
  return rows.map(mapearItem);
}

export async function gravarEventoDoItem(
  executor: pg.Pool | pg.PoolClient,
  registro: {
    itemId: string;
    acao: string;
    autorId: string;
    estadoAnterior?: string | null;
    estadoNovo?: string | null;
    motivo?: string | null;
    alteracoes?: Record<string, unknown> | null;
  },
): Promise<void> {
  await executor.query(
    `INSERT INTO checklist_eventos (item_id, acao, autor_id, estado_anterior, estado_novo, motivo, alteracoes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      registro.itemId,
      registro.acao,
      registro.autorId,
      registro.estadoAnterior ?? null,
      registro.estadoNovo ?? null,
      registro.motivo ?? null,
      registro.alteracoes ? JSON.stringify(registro.alteracoes) : null,
    ],
  );
}

/* ---------------------------------- Documentos ---------------------------------- */

interface LinhaDocumento {
  id: string;
  viagem_id: string;
  autor_id: string;
  tipo: TipoDocumento;
  nome: string;
  descricao: string | null;
  link: string | null;
  visibilidade: Documento["visibilidade"];
  compartilhado_com: string[] | null;
  estado: Documento["estado"];
  removido_por: string | null;
  removido_em: Date | null;
  motivo_remocao: string | null;
  versao: number;
}

const COLUNAS_DOCUMENTO = `id, viagem_id, autor_id, tipo, nome, descricao, link, visibilidade,
                           compartilhado_com, estado, removido_por, removido_em, motivo_remocao, versao`;

export function mapearDocumento(linha: LinhaDocumento): Documento {
  return {
    id: linha.id,
    viagemId: linha.viagem_id,
    autorId: linha.autor_id,
    tipo: linha.tipo,
    nome: linha.nome,
    descricao: linha.descricao,
    link: linha.link,
    visibilidade: linha.visibilidade,
    compartilhadoCom: linha.compartilhado_com ?? [],
    estado: linha.estado,
    removidoPor: linha.removido_por,
    removidoEm: linha.removido_em ? linha.removido_em.toISOString() : null,
    motivoRemocao: linha.motivo_remocao,
    versao: linha.versao,
  };
}

export function documentoParaJson(documento: Documento): Record<string, unknown> {
  return {
    id: documento.id,
    viagemId: documento.viagemId,
    autorId: documento.autorId,
    tipo: documento.tipo,
    tipoRotulo: ROTULO_TIPO_DOCUMENTO[documento.tipo],
    nome: documento.nome,
    descricao: documento.descricao,
    link: documento.link,
    visibilidade: documento.visibilidade,
    compartilhadoCom: documento.compartilhadoCom,
    estado: documento.estado,
    removidoPor: documento.removidoPor,
    removidoEm: documento.removidoEm,
    motivoRemocao: documento.motivoRemocao,
    versao: documento.versao,
  };
}

export async function carregarDocumento(
  executor: pg.Pool | pg.PoolClient,
  viagemId: string,
  documentoId: string,
  bloquear = false,
): Promise<Documento | null> {
  const { rows } = await executor.query<LinhaDocumento>(
    `SELECT ${COLUNAS_DOCUMENTO} FROM documentos WHERE id = $1 AND viagem_id = $2${bloquear ? " FOR UPDATE" : ""}`,
    [documentoId, viagemId],
  );
  return rows[0] ? mapearDocumento(rows[0]) : null;
}

export async function listarDocumentos(
  executor: pg.Pool | pg.PoolClient,
  viagemId: string,
  ids?: string[],
): Promise<Documento[]> {
  if (ids && ids.length === 0) return [];
  const { rows } = await executor.query<LinhaDocumento>(
    `SELECT ${COLUNAS_DOCUMENTO} FROM documentos WHERE viagem_id = $1${ids ? " AND id = ANY($2::uuid[])" : ""}
      ORDER BY estado, tipo, nome`,
    ids ? [viagemId, ids] : [viagemId],
  );
  return rows.map(mapearDocumento);
}

export async function gravarEventoDoDocumento(
  executor: pg.Pool | pg.PoolClient,
  registro: {
    documentoId: string;
    acao: string;
    autorId: string;
    motivo?: string | null;
    alteracoes?: Record<string, unknown> | null;
  },
): Promise<void> {
  await executor.query(
    `INSERT INTO documento_eventos (documento_id, acao, autor_id, motivo, alteracoes) VALUES ($1, $2, $3, $4, $5)`,
    [
      registro.documentoId,
      registro.acao,
      registro.autorId,
      registro.motivo ?? null,
      registro.alteracoes ? JSON.stringify(registro.alteracoes) : null,
    ],
  );
}
