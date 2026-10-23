/**
 * Sincronização incremental: o app pergunta "o que mudou desde o cursor X?".
 *
 * O cursor é a **sequência** da trilha de auditoria (`auditoria.id`), não um horário:
 * relógio de celular adiantado ou atrasado nunca faz o app perder uma mudança.
 *
 * O que volta completo (são pequenos e mudam por vários caminhos): a viagem (com permissões
 * calculadas para quem perguntou) e a lista de participantes — aceitar um convite, por exemplo,
 * muda participante sem gerar linha de "membro" na auditoria.
 * O que volta só quando mudou: despesas, acertos, convites e atividades do roteiro.
 */
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import type { Config } from "../config.ts";
import { entradaInvalida } from "../errors.ts";
import { exigirAutenticacao } from "../http.ts";
import { exigirContexto } from "../authz.ts";
import { carregarDetalheViagem } from "../detalhe.ts";
import { carregarDespesa, despesaParaJson } from "../repo.ts";
import { documentoParaJson, itemParaJson, listarDocumentos, listarItens } from "../planejamento-repo.ts";
import { listarReservas, reservaParaJson } from "../reserva-repo.ts";
import { podeVerDocumento } from "@lia-go/domain";
import { atividadeParaJson, listarAtividades } from "../roteiro-repo.ts";

/** Quantas mudanças cabem em uma resposta. Paginação evita resposta gigante depois de dias offline. */
export const LIMITE_MUDANCAS = 200;

const esquemaConsulta = z.object({
  desde: z
    .string()
    .regex(/^\d+$/, "use o cursor devolvido pela resposta anterior")
    .optional(),
});

export function rotasSincronizacao(app: FastifyInstance, deps: { pool: pg.Pool; config: Config }): void {
  const { pool, config } = deps;
  const http = { pool, nomeCookieSessao: config.nomeCookieSessao };

  app.get("/viagens/:viagemId/mudancas", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    // Mesma regra de acesso das outras rotas: sem vínculo ativo, nem revela que a viagem existe.
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const desde = lerCursor(request.query, esquemaConsulta);

    // Uma linha a mais que o limite só para saber se ainda há mudanças depois.
    const { rows: marcas } = await pool.query<{ id: string; entidade: string; entidade_id: string }>(
      `SELECT id::text AS id, entidade, entidade_id
         FROM auditoria
        WHERE viagem_id = $1 AND id > $2
        ORDER BY id
        LIMIT $3`,
      [viagemId, desde, LIMITE_MUDANCAS + 1],
    );
    const temMais = marcas.length > LIMITE_MUDANCAS;
    const usadas = temMais ? marcas.slice(0, LIMITE_MUDANCAS) : marcas;
    const cursor = usadas.length > 0 ? usadas[usadas.length - 1]!.id : desde;

    const idsPorEntidade = agruparIds(usadas);
    const detalhe = await carregarDetalheViagem(pool, contexto);
    const despesas = await carregarDespesasMudadas(pool, viagemId, idsPorEntidade.get("despesa") ?? []);
    const movimentos = await carregarMovimentosMudados(pool, viagemId, idsPorEntidade.get("movimento") ?? []);
    const convites = await carregarConvitesMudados(pool, viagemId, idsPorEntidade.get("convite") ?? []);
    // Roteiro: só as atividades que mudaram (primeira sincronização traz tudo, porque a criação
    // de cada uma deixa marca na auditoria).
    const atividades = (await listarAtividades(pool, viagemId, idsPorEntidade.get("atividade") ?? [])).map((atividade) =>
      atividadeParaJson(atividade),
    );
    const reservas = (await listarReservas(pool, viagemId, idsPorEntidade.get("reserva") ?? [])).map((reserva) =>
      reservaParaJson(reserva),
    );
    const itensChecklist = (await listarItens(pool, viagemId, idsPorEntidade.get("checklist") ?? [])).map((item) => itemParaJson(item));
    // Documento só vai para quem pode vê-lo: o cursor não pode virar caminho para vazar documento privado.
    const ehOrganizador = contexto.contexto.papel === "organizador";
    const documentosMudados = await listarDocumentos(pool, viagemId, idsPorEntidade.get("documento") ?? []);
    const documentos = documentosMudados
      .filter((documento) => podeVerDocumento(documento, autenticado.usuarioId, { ehOrganizador }))
      .map((documento) => documentoParaJson(documento));
    // Quem **deixou** de poder ver não pode continuar com o documento guardado no aparelho: vai um
    // aviso de remoção (só o id) para o app apagar a cópia local. Nada mais é revelado — nem se o
    // documento existe, nem o que ele contém.
    const perderamAcesso = documentosMudados.filter((documento) => !podeVerDocumento(documento, autenticado.usuarioId, { ehOrganizador }));
    if (perderamAcesso.length > 0) {
      const apagar = await documentosQuePrecisamSairDoAparelho(pool, perderamAcesso.map((documento) => documento.id), autenticado.usuarioId);
      for (const id of apagar) documentos.push({ id, removido: true });
    }

    return {
      cursor,
      temMais,
      mudancas: usadas.length,
      // Sempre completos (pequenos): a tela da viagem nunca fica desatualizada por um caminho esquecido.
      viagem: detalhe.viagem,
      papel: detalhe.papel,
      participantes: detalhe.participantes,
      pendencias: detalhe.pendencias,
      sugestao: detalhe.sugestao,
      permissoes: detalhe.permissoes,
      // Sob demanda, apenas o que mudou desde o cursor.
      despesas,
      movimentos,
      convites,
      atividades,
      reservas,
      itensChecklist,
      documentos,
    };
  });
}

function lerCursor(consulta: unknown, esquema: typeof esquemaConsulta): string {
  const analisado = esquema.safeParse(consulta ?? {});
  if (!analisado.success) throw entradaInvalida("Cursor inválido: use o valor devolvido pela resposta anterior.");
  return analisado.data.desde ?? "0";
}

function agruparIds(marcas: { entidade: string; entidade_id: string }[]): Map<string, string[]> {
  const porEntidade = new Map<string, Set<string>>();
  for (const marca of marcas) {
    const conjunto = porEntidade.get(marca.entidade) ?? new Set<string>();
    conjunto.add(marca.entidade_id);
    porEntidade.set(marca.entidade, conjunto);
  }
  return new Map([...porEntidade].map(([entidade, ids]) => [entidade, [...ids]]));
}

/** Despesas mudadas, com o mesmo formato da listagem (rateio e histórico incluídos). */
async function carregarDespesasMudadas(
  pool: pg.Pool,
  viagemId: string,
  ids: string[],
): Promise<Record<string, unknown>[]> {
  const despesas: Record<string, unknown>[] = [];
  for (const id of ids) {
    const carregada = await carregarDespesa(pool, viagemId, id);
    if (carregada) despesas.push(despesaParaJson(carregada.despesa));
  }
  return despesas;
}

interface LinhaMovimento {
  id: string;
  estado: string;
  [coluna: string]: unknown;
}

async function carregarMovimentosMudados(
  pool: pg.Pool,
  viagemId: string,
  ids: string[],
): Promise<LinhaMovimento[]> {
  if (ids.length === 0) return [];
  const { rows } = await pool.query<LinhaMovimento>(
    `SELECT m.id, m.de_id, m.para_id, m.valor_centavos::text AS valor_centavos, m.estado,
            m.despesa_id, m.criado_em::text AS criado_em, m.confirmado_em::text AS confirmado_em,
            (SELECT nome FROM usuarios WHERE id = m.de_id) AS de_nome,
            (SELECT nome FROM usuarios WHERE id = m.para_id) AS para_nome
       FROM movimentos m
      WHERE m.viagem_id = $1 AND m.id = ANY($2::uuid[])
      ORDER BY m.criado_em DESC`,
    [viagemId, ids],
  );
  return rows;
}

async function carregarConvitesMudados(
  pool: pg.Pool,
  viagemId: string,
  ids: string[],
): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT id, email, papel, estado, expira_em::text AS expira_em, criado_em::text AS criado_em
       FROM convites
      WHERE viagem_id = $1 AND id = ANY($2::uuid[])
      ORDER BY criado_em DESC`,
    [viagemId, ids],
  );
  return rows as Record<string, unknown>[];
}

/**
 * Documentos que a pessoa via antes e deixou de ver (revogação, remoção ou virada para privado).
 *
 * A decisão sai do evento mais recente de cada documento, que guarda o acesso **antes** e **depois**:
 * se a pessoa estava no acesso de antes, o aparelho dela precisa saber que aquilo saiu da lista —
 * senão uma cópia já baixada continuaria visível depois de o acesso ser revogado.
 */
async function documentosQuePrecisamSairDoAparelho(pool: pg.Pool, documentoIds: string[], usuarioId: string): Promise<string[]> {
  if (documentoIds.length === 0) return [];
  const { rows } = await pool.query<{ documento_id: string; antes: { visibilidade?: string; com?: string[] } | null }>(
    `SELECT DISTINCT ON (documento_id) documento_id, alteracoes -> 'antes' AS antes
       FROM documento_eventos
      WHERE documento_id = ANY($1::uuid[])
      ORDER BY documento_id, id DESC`,
    [documentoIds],
  );
  return rows
    .filter((linha) => {
      const antes = linha.antes;
      if (!antes) return false;
      if (antes.visibilidade === "viagem") return true;
      return Array.isArray(antes.com) && antes.com.includes(usuarioId);
    })
    .map((linha) => linha.documento_id);
}
