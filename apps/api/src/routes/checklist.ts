/**
 * Checklist da viagem (tela 15).
 *
 * A rota não decide nada sozinha: criação, conclusão e reabertura passam pelo domínio, com as mesmas
 * mensagens que o app dá offline. O prazo **não** conclui item — a rota nem olha para o relógio para
 * isso; atraso é rótulo calculado na leitura (`itemAtrasado`), nunca mudança de estado.
 */
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { CATEGORIAS_CHECKLIST, concluirItem, criarItemChecklist, reabrirItem, type CategoriaChecklist } from "@lia-go/domain";
import type { Config } from "../config.ts";
import { emTransacao } from "../db.ts";
import { ErroHttp } from "../errors.ts";
import { comIdempotencia, exigirAutenticacao, idempotencyKey, tratarErroDeValidacao } from "../http.ts";
import { exigirContexto, exigirPermissao, exigirVersao, participantesAtivos } from "../authz.ts";
import { registrarAuditoria } from "../audit.ts";
import { carregarItem, gravarEventoDoItem, itemParaJson, listarItens } from "../planejamento-repo.ts";
import { novoId } from "../tokens.ts";

const esquemaCriarItem = z.object({
  titulo: z.string().trim().min(2).max(160),
  categoria: z.enum(["documento", "reserva", "compras", "saude", "outro"]).default("outro"),
  responsavelId: z.uuid().nullable().default(null),
  // Sem prazo é um estado válido: não inventamos data para preencher tela.
  prazo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD")
    .nullable()
    .default(null),
  observacao: z.string().trim().max(500).nullable().default(null),
});

const esquemaConcluir = z.object({ versao: z.number().int().positive().optional() });
const esquemaReabrir = z.object({ motivo: z.string().trim().min(5).max(400), versao: z.number().int().positive().optional() });

export function rotasChecklist(app: FastifyInstance, deps: { pool: pg.Pool; config: Config }): void {
  const { pool, config } = deps;
  const http = { pool, nomeCookieSessao: config.nomeCookieSessao };

  app.get("/viagens/:viagemId/checklist", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const itens = await listarItens(pool, viagemId);
    return { itens: itens.map(itemParaJson), categorias: CATEGORIAS_CHECKLIST };
  });

  app.post("/viagens/:viagemId/checklist", async (request, reply) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "checklist:criar");

    let corpo: z.infer<typeof esquemaCriarItem>;
    try {
      corpo = esquemaCriarItem.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }
    if (corpo.responsavelId !== null) {
      const ativos = await participantesAtivos(pool, viagemId);
      if (!ativos.includes(corpo.responsavelId)) {
        throw new ErroHttp(400, "entrada_invalida", "Só quem participa da viagem pode ficar responsável por um item.");
      }
    }

    const chave = idempotencyKey(request);
    const itemId = novoId();
    const respondido = await comIdempotencia(
      pool,
      { chave, usuarioId: autenticado.usuarioId, rota: `POST /viagens/${viagemId}/checklist` },
      async () =>
        emTransacao(pool, async (cliente) => {
          const item = criarItemChecklist({
            id: itemId,
            viagemId,
            autorId: autenticado.usuarioId,
            titulo: corpo.titulo,
            categoria: corpo.categoria as CategoriaChecklist,
            responsavelId: corpo.responsavelId,
            prazo: corpo.prazo,
            observacao: corpo.observacao,
          });
          await cliente.query(
            `INSERT INTO itens_checklist (id, viagem_id, autor_id, titulo, categoria, responsavel_id, prazo, estado, observacao, versao)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'aberto', $8, 1)`,
            [item.id, viagemId, item.autorId, item.titulo, item.categoria, item.responsavelId, item.prazo, item.observacao],
          );
          await gravarEventoDoItem(cliente, {
            itemId: item.id,
            acao: "checklist:criar",
            autorId: autenticado.usuarioId,
            estadoNovo: "aberto",
          });
          await registrarAuditoria(cliente, {
            viagemId,
            atorId: autenticado.usuarioId,
            acao: "checklist:criar",
            entidade: "checklist",
            entidadeId: item.id,
            dados: { categoria: item.categoria, prazo: item.prazo, temResponsavel: item.responsavelId !== null },
          });
          return itemParaJson(item);
        }),
    );
    return reply.status(201).send({ item: respondido.resultado });
  });

  app.post("/viagens/:viagemId/checklist/:itemId/concluir", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, itemId } = request.params as { viagemId: string; itemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "checklist:concluir");
    const corpo = esquemaConcluir.parse(request.body ?? {});

    return emTransacao(pool, async (cliente) => {
      const atual = await carregarItem(cliente, viagemId, itemId, true);
      if (!atual) throw new ErroHttp(404, "nao_encontrado", "Item não encontrado nesta viagem.");
      exigirVersao(corpo.versao, atual.versao);
      const feito = concluirItem(atual, { porId: autenticado.usuarioId, em: new Date().toISOString() });
      await cliente.query("UPDATE itens_checklist SET estado = 'feito', feito_por = $2, feito_em = now(), versao = versao + 1, atualizado_em = now() WHERE id = $1", [
        itemId,
        autenticado.usuarioId,
      ]);
      await gravarEventoDoItem(cliente, {
        itemId,
        acao: "checklist:concluir",
        autorId: autenticado.usuarioId,
        estadoAnterior: "aberto",
        estadoNovo: "feito",
      });
      await registrarAuditoria(cliente, { viagemId, atorId: autenticado.usuarioId, acao: "checklist:concluir", entidade: "checklist", entidadeId: itemId });
      return { item: itemParaJson({ ...feito, versao: atual.versao + 1 }) };
    });
  });

  app.post("/viagens/:viagemId/checklist/:itemId/reabrir", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, itemId } = request.params as { viagemId: string; itemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "checklist:concluir");
    let corpo: z.infer<typeof esquemaReabrir>;
    try {
      corpo = esquemaReabrir.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }

    return emTransacao(pool, async (cliente) => {
      const atual = await carregarItem(cliente, viagemId, itemId, true);
      if (!atual) throw new ErroHttp(404, "nao_encontrado", "Item não encontrado nesta viagem.");
      exigirVersao(corpo.versao, atual.versao);
      const reaberto = reabrirItem(atual, { porId: autenticado.usuarioId, motivo: corpo.motivo });
      await cliente.query(
        "UPDATE itens_checklist SET estado = 'aberto', feito_por = NULL, feito_em = NULL, motivo_reabertura = $2, versao = versao + 1, atualizado_em = now() WHERE id = $1",
        [itemId, reaberto.motivoReabertura],
      );
      await gravarEventoDoItem(cliente, {
        itemId,
        acao: "checklist:reabrir",
        autorId: autenticado.usuarioId,
        estadoAnterior: "feito",
        estadoNovo: "aberto",
        motivo: reaberto.motivoReabertura,
      });
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "checklist:reabrir",
        entidade: "checklist",
        entidadeId: itemId,
        motivo: reaberto.motivoReabertura,
      });
      return { item: itemParaJson({ ...reaberto, versao: atual.versao + 1 }) };
    });
  });
}
