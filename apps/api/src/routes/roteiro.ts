/**
 * Roteiro: leitura do dia a dia e ações sobre a atividade.
 *
 * Os conflitos e o resumo do dia vêm do **domínio** (mesma regra testada); a tela não recalcula.
 * Nenhuma rota remarca horário: conflito é explicado e a pessoa decide (diretriz §2.5).
 * Concluir é sempre ação explícita — passar do horário não muda estado nenhum.
 */
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import {
  type ContextoAutorizacao,
  type Deslocamento,
  type NaturezaCusto,
  cancelarAtividade,
  concluirAtividade,
  corrigirAtividade,
  criarAtividade,
  podeNoRoteiro,
} from "@lia-go/domain";
import type { Config } from "../config.ts";
import { emTransacao } from "../db.ts";
import { ErroHttp } from "../errors.ts";
import { comIdempotencia, exigirAutenticacao, idempotencyKey, tratarErroDeValidacao } from "../http.ts";
import { exigirContexto, exigirPermissao, exigirVersao, type ContextoViagem } from "../authz.ts";
import { registrarAuditoria } from "../audit.ts";
import {
  carregarAtividade,
  carregarEventosDaAtividade,
  gravarEventoDaAtividade,
  listarAtividades,
  montarRoteiro,
} from "../roteiro-repo.ts";
import { novoId } from "../tokens.ts";

const CENTAVOS = /^\d+$/;
const esquemaCentavos = z.union([z.string().regex(CENTAVOS), z.number().int().min(0)]);

const esquemaDeslocamento = z.object({
  minutos: z.number().int().positive().nullable().default(null),
  km: z.number().int().min(0).nullable().default(null),
  custoCentavos: esquemaCentavos.nullable().default(null),
  alerta: z.string().trim().max(200).nullable().default(null),
});

const esquemaCriarAtividade = z.object({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD"),
  ordem: z.number().int().positive().optional(),
  titulo: z.string().trim().min(2).max(120),
  // Horário é opcional de propósito: sem ele a atividade é flexível (nunca inventamos horário).
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().default(null),
  duracaoMinutos: z.number().int().positive().nullable().default(null),
  local: z.string().trim().max(160).nullable().default(null),
  custoCentavos: esquemaCentavos.nullable().default(null),
  custoNatureza: z.enum(["estimativa", "compromisso", "gratuito"]).nullable().default(null),
  custoAVerificar: z.boolean().default(false),
  observacao: z.string().trim().max(2000).nullable().default(null),
  // Reserva da viagem que cobre esta atividade (opcional). Vincular não confirma reserva nenhuma.
  reservaId: z.string().uuid().nullable().default(null),
  deslocamento: esquemaDeslocamento.nullable().default(null),
});

const esquemaConcluir = z.object({
  observacao: z.string().trim().max(2000).nullable().default(null),
  versao: z.number().int().positive().optional(),
});

const esquemaCancelar = z.object({
  motivo: z.string().trim().min(5).max(400),
  versao: z.number().int().positive().optional(),
});

const esquemaCorrigir = z.object({
  motivo: z.string().trim().min(5).max(400),
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ordem: z.number().int().positive().optional(),
  titulo: z.string().trim().min(2).max(120).optional(),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  duracaoMinutos: z.number().int().positive().nullable().optional(),
  local: z.string().trim().max(160).nullable().optional(),
  custoCentavos: esquemaCentavos.nullable().optional(),
  custoNatureza: z.enum(["estimativa", "compromisso", "gratuito"]).nullable().optional(),
  custoAVerificar: z.boolean().optional(),
  observacao: z.string().trim().max(2000).nullable().optional(),
  reservaId: z.string().uuid().nullable().optional(),
  deslocamento: esquemaDeslocamento.nullable().optional(),
  versao: z.number().int().positive().optional(),
});

/**
 * A reserva vinculada tem de ser **desta viagem**.
 *
 * Um vínculo cruzado mostraria a evidência de outra viagem para quem não participa dela — e uma
 * reserva cancelada não pode virar "a reserva desta atividade" sem ninguém perceber.
 */
async function exigirReservaDaViagem(
  executor: pg.Pool | pg.PoolClient,
  viagemId: string,
  reservaId: string | null | undefined,
): Promise<void> {
  if (reservaId === null || reservaId === undefined) return;
  const { rows } = await executor.query<{ estado: string }>(
    "SELECT estado FROM reservas WHERE id = $1 AND viagem_id = $2",
    [reservaId, viagemId],
  );
  const reserva = rows[0];
  if (!reserva) throw new ErroHttp(400, "reserva_invalida", "Essa reserva não é desta viagem.");
  if (reserva.estado === "cancelada") {
    throw new ErroHttp(400, "reserva_cancelada", "Essa reserva foi cancelada: escolha outra ou deixe sem reserva.");
  }
}

function contextoDominio(contexto: ContextoViagem): ContextoAutorizacao {
  return contexto.contexto;
}

function paraBigInt(valor: string | number | null | undefined): bigint | null {
  if (valor === null || valor === undefined) return null;
  return typeof valor === "bigint" ? valor : BigInt(valor);
}

function paraDeslocamento(entrada: z.infer<typeof esquemaDeslocamento> | null | undefined): Deslocamento | null {
  if (!entrada) return null;
  return {
    minutos: entrada.minutos,
    km: entrada.km,
    custoCentavos: paraBigInt(entrada.custoCentavos),
    alerta: entrada.alerta,
  };
}

function deslocamentoParaColunas(deslocamento: Deslocamento | null): (string | number | null)[] {
  return [
    deslocamento?.minutos ?? null,
    deslocamento?.km ?? null,
    deslocamento?.custoCentavos === null || deslocamento?.custoCentavos === undefined ? null : deslocamento.custoCentavos.toString(),
    deslocamento?.alerta ?? null,
  ];
}

export function rotasRoteiro(app: FastifyInstance, deps: { pool: pg.Pool; config: Config }): void {
  const { pool, config } = deps;
  const http = { pool, nomeCookieSessao: config.nomeCookieSessao };

  /** Roteiro inteiro da viagem, agrupado por dia, com resumo e conflitos já resolvidos. */
  app.get("/viagens/:viagemId/roteiro", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const atividades = await listarAtividades(pool, viagemId);
    const decisaoDeCriar = podeNoRoteiro(contextoDominio(contexto), "atividade:criar");
    return {
      ...montarRoteiro(atividades),
      // O que a pessoa pode fazer aqui (a interface esconde o que não pode; o servidor decide de novo).
      permissoes: {
        criarAtividade: decisaoDeCriar.permitido,
        motivoParaNaoCriar: decisaoDeCriar.permitido ? null : decisaoDeCriar.motivo,
        papel: contexto.contexto.papel,
        estadoViagem: contexto.contexto.estadoViagem,
      },
    };
  });

  app.get("/viagens/:viagemId/atividades/:atividadeId", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, atividadeId } = request.params as { viagemId: string; atividadeId: string };
    await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const atividade = await carregarAtividade(pool, viagemId, atividadeId);
    if (!atividade) throw new ErroHttp(404, "nao_encontrado", "Atividade não encontrada nesta viagem.");
    const historico = await carregarEventosDaAtividade(pool, atividadeId);
    return { ...(await montarRoteiro([atividade])).dias[0]!, historico };
  });

  app.post("/viagens/:viagemId/atividades", async (request, reply) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "atividade:criar");

    let corpo: z.infer<typeof esquemaCriarAtividade>;
    try {
      corpo = esquemaCriarAtividade.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }

    const chave = idempotencyKey(request);
    const atividadeId = novoId();
    const respondido = await comIdempotencia(
      pool,
      { chave, usuarioId: autenticado.usuarioId, rota: `POST /viagens/${viagemId}/atividades` },
      async () =>
        emTransacao(pool, async (cliente) => {
          await exigirReservaDaViagem(cliente, viagemId, corpo.reservaId);
          // Sem ordem informada, entra no fim do dia (a sequência lógica é de quem planeja).
          const ordem =
            corpo.ordem ??
            (
              await cliente.query<{ proxima: number }>(
                "SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima FROM atividades WHERE viagem_id = $1 AND dia = $2",
                [viagemId, corpo.dia],
              )
            ).rows[0]!.proxima;
          const atividade = criarAtividade({
            id: atividadeId,
            viagemId,
            autorId: autenticado.usuarioId,
            contexto: contextoDominio(contexto),
            dia: corpo.dia,
            ordem,
            titulo: corpo.titulo,
            hora: corpo.hora,
            duracaoMinutos: corpo.duracaoMinutos,
            local: corpo.local,
            custoCentavos: paraBigInt(corpo.custoCentavos),
            custoNatureza: corpo.custoNatureza as NaturezaCusto | null,
            custoAVerificar: corpo.custoAVerificar,
            observacao: corpo.observacao,
            reservaId: corpo.reservaId,
            deslocamento: paraDeslocamento(corpo.deslocamento),
          });
          const [minutos, km, custoDeslocamento, alerta] = deslocamentoParaColunas(atividade.deslocamento);
          await cliente.query(
            `INSERT INTO atividades (id, viagem_id, autor_id, dia, ordem, titulo, hora, duracao_minutos, local,
                                     custo_centavos, custo_natureza, custo_a_verificar, estado, observacao, reserva_id,
                                     deslocamento_minutos, deslocamento_km, deslocamento_custo_centavos, deslocamento_alerta, versao)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'planejada', $13, $18, $14, $15, $16, $17, 1)`,
            [
              atividade.id,
              viagemId,
              atividade.autorId,
              atividade.dia,
              atividade.ordem,
              atividade.titulo,
              atividade.hora,
              atividade.duracaoMinutos,
              atividade.local,
              atividade.custoCentavos === null ? null : atividade.custoCentavos.toString(),
              atividade.custoNatureza,
              atividade.custoAVerificar,
              atividade.observacao,
              minutos,
              km,
              custoDeslocamento,
              alerta,
              atividade.reservaId,
            ],
          );
          await gravarEventoDaAtividade(cliente, {
            atividadeId: atividade.id,
            acao: "atividade:criar",
            autorId: autenticado.usuarioId,
            estadoNovo: atividade.estado,
          });
          await registrarAuditoria(cliente, {
            viagemId,
            atorId: autenticado.usuarioId,
            acao: "atividade:criar",
            entidade: "atividade",
            entidadeId: atividade.id,
            dados: { dia: atividade.dia, hora: atividade.hora, estado: atividade.estado },
          });
          return (await montarRoteiro([atividade])).dias[0]!;
        }),
    );
    return reply.status(201).send(respondido.resultado);
  });

  app.post("/viagens/:viagemId/atividades/:atividadeId/concluir", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, atividadeId } = request.params as { viagemId: string; atividadeId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const corpo = esquemaConcluir.parse(request.body ?? {});

    return emTransacao(pool, async (cliente) => {
      const atual = await carregarAtividade(cliente, viagemId, atividadeId, true);
      if (!atual) throw new ErroHttp(404, "nao_encontrado", "Atividade não encontrada nesta viagem.");
      exigirVersao(corpo.versao, atual.versao);
      const concluida = concluirAtividade(atual, {
        usuarioId: autenticado.usuarioId,
        contexto: contextoDominio(contexto),
        observacao: corpo.observacao,
        agora: new Date(),
      });
      await cliente.query(
        `UPDATE atividades SET estado = 'concluida', concluida_por = $2, concluida_em = now(), observacao = $3,
                               versao = versao + 1, atualizado_em = now()
          WHERE id = $1`,
        [atividadeId, autenticado.usuarioId, concluida.observacao],
      );
      await gravarEventoDaAtividade(cliente, {
        atividadeId,
        acao: "atividade:concluir",
        autorId: autenticado.usuarioId,
        estadoAnterior: atual.estado,
        estadoNovo: "concluida",
        motivo: corpo.observacao ?? null,
      });
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "atividade:concluir",
        entidade: "atividade",
        entidadeId: atividadeId,
      });
      return (await montarRoteiro([concluida])).dias[0]!;
    });
  });

  app.post("/viagens/:viagemId/atividades/:atividadeId/cancelar", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, atividadeId } = request.params as { viagemId: string; atividadeId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const corpo = esquemaCancelar.parse(request.body);

    return emTransacao(pool, async (cliente) => {
      const atual = await carregarAtividade(cliente, viagemId, atividadeId, true);
      if (!atual) throw new ErroHttp(404, "nao_encontrado", "Atividade não encontrada nesta viagem.");
      exigirVersao(corpo.versao, atual.versao);
      const cancelada = cancelarAtividade(atual, {
        usuarioId: autenticado.usuarioId,
        contexto: contextoDominio(contexto),
        motivo: corpo.motivo,
      });
      await cliente.query(`UPDATE atividades SET estado = 'cancelada', versao = versao + 1, atualizado_em = now() WHERE id = $1`, [
        atividadeId,
      ]);
      await gravarEventoDaAtividade(cliente, {
        atividadeId,
        acao: "atividade:cancelar",
        autorId: autenticado.usuarioId,
        estadoAnterior: atual.estado,
        estadoNovo: "cancelada",
        motivo: corpo.motivo,
      });
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "atividade:cancelar",
        entidade: "atividade",
        entidadeId: atividadeId,
        motivo: corpo.motivo,
      });
      return (await montarRoteiro([cancelada])).dias[0]!;
    });
  });

  app.post("/viagens/:viagemId/atividades/:atividadeId/corrigir", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, atividadeId } = request.params as { viagemId: string; atividadeId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);

    let corpo: z.infer<typeof esquemaCorrigir>;
    try {
      corpo = esquemaCorrigir.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }

    return emTransacao(pool, async (cliente) => {
      const atual = await carregarAtividade(cliente, viagemId, atividadeId, true);
      if (!atual) throw new ErroHttp(404, "nao_encontrado", "Atividade não encontrada nesta viagem.");
      exigirVersao(corpo.versao, atual.versao);

      const alteracoes: Parameters<typeof corrigirAtividade>[1]["alteracoes"] = {};
      if (corpo.titulo !== undefined) alteracoes.titulo = corpo.titulo;
      if (corpo.dia !== undefined) alteracoes.dia = corpo.dia;
      if (corpo.ordem !== undefined) alteracoes.ordem = corpo.ordem;
      if (corpo.hora !== undefined) alteracoes.hora = corpo.hora;
      if (corpo.duracaoMinutos !== undefined) alteracoes.duracaoMinutos = corpo.duracaoMinutos;
      if (corpo.local !== undefined) alteracoes.local = corpo.local;
      if (corpo.custoCentavos !== undefined) alteracoes.custoCentavos = paraBigInt(corpo.custoCentavos);
      if (corpo.custoNatureza !== undefined) alteracoes.custoNatureza = corpo.custoNatureza as NaturezaCusto | null;
      if (corpo.custoAVerificar !== undefined) alteracoes.custoAVerificar = corpo.custoAVerificar;
      if (corpo.observacao !== undefined) alteracoes.observacao = corpo.observacao;
      if (corpo.reservaId !== undefined) {
        await exigirReservaDaViagem(cliente, viagemId, corpo.reservaId);
        alteracoes.reservaId = corpo.reservaId;
      }
      if (corpo.deslocamento !== undefined) alteracoes.deslocamento = paraDeslocamento(corpo.deslocamento);

      const corrigida = corrigirAtividade(atual, {
        usuarioId: autenticado.usuarioId,
        contexto: contextoDominio(contexto),
        motivo: corpo.motivo,
        alteracoes,
      });
      const [minutos, km, custoDeslocamento, alerta] = deslocamentoParaColunas(corrigida.deslocamento);
      await cliente.query(
        `UPDATE atividades SET dia = $2, ordem = $3, titulo = $4, hora = $5, duracao_minutos = $6, local = $7,
                               custo_centavos = $8, custo_natureza = $9, custo_a_verificar = $10, observacao = $11,
                               deslocamento_minutos = $12, deslocamento_km = $13, deslocamento_custo_centavos = $14,
                               deslocamento_alerta = $15, reserva_id = $16, versao = versao + 1, atualizado_em = now()
          WHERE id = $1`,
        [
          atividadeId,
          corrigida.dia,
          corrigida.ordem,
          corrigida.titulo,
          corrigida.hora,
          corrigida.duracaoMinutos,
          corrigida.local,
          corrigida.custoCentavos === null ? null : corrigida.custoCentavos.toString(),
          corrigida.custoNatureza,
          corrigida.custoAVerificar,
          corrigida.observacao,
          minutos,
          km,
          custoDeslocamento,
          alerta,
          corrigida.reservaId,
        ],
      );
      await gravarEventoDaAtividade(cliente, {
        atividadeId,
        acao: "atividade:corrigir",
        autorId: autenticado.usuarioId,
        estadoAnterior: atual.estado,
        estadoNovo: corrigida.estado,
        motivo: corpo.motivo,
        alteracoes: {
          antes: {
            titulo: atual.titulo,
            hora: atual.hora,
            dia: atual.dia,
            custoCentavos: atual.custoCentavos === null ? null : atual.custoCentavos.toString(),
            reservaId: atual.reservaId,
          },
          depois: {
            titulo: corrigida.titulo,
            hora: corrigida.hora,
            dia: corrigida.dia,
            custoCentavos: corrigida.custoCentavos === null ? null : corrigida.custoCentavos.toString(),
          },
        },
      });
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "atividade:corrigir",
        entidade: "atividade",
        entidadeId: atividadeId,
        motivo: corpo.motivo,
      });
      return (await montarRoteiro([corrigida])).dias[0]!;
    });
  });

}
