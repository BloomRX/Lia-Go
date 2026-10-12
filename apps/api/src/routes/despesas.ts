/**
 * Despesas, saldos e acertos.
 * O rateio e os saldos são calculados pelo domínio, no servidor: a interface nunca
 * define saldo oficial e a IA não participa deste cálculo.
 */
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import {
  type Despesa,
  type ContextoAutorizacao,
  type Movimento,
  calcularResumoFinanceiro,
  confirmarDespesa,
  contestarDespesa,
  corrigirDespesa,
  criarDespesa,
  sugerirTransferencias,
} from "@lia-go/domain";
import type { Config } from "../config.ts";
import { emTransacao, paraCentavos } from "../db.ts";
import { ErroHttp, entradaInvalida } from "../errors.ts";
import { centavosDoCorpo, comIdempotencia, exigirAutenticacao, idempotencyKey, tratarErroDeValidacao } from "../http.ts";
import { exigirContexto, exigirPermissao, exigirVersao, participantesAtivos, type ContextoViagem } from "../authz.ts";
import { registrarAuditoria } from "../audit.ts";
import { carregarDespesa, despesaParaJson, gravarEvento, gravarPartes, rateioParaJson } from "../repo.ts";
import { novoId } from "../tokens.ts";

const esquemaParteValor = z.object({ participanteId: z.uuid(), valorCentavos: z.string().regex(/^\d+$/) });
const esquemaPartePercentual = z.object({ participanteId: z.uuid(), bps: z.number().int().min(0).max(10_000) });

const esquemaRateio = z.discriminatedUnion("metodo", [
  z.object({ metodo: z.literal("igualitario"), participantes: z.array(z.uuid()).min(1) }),
  z.object({ metodo: z.literal("valores"), partes: z.array(esquemaParteValor).min(1) }),
  z.object({ metodo: z.literal("percentual"), partes: z.array(esquemaPartePercentual).min(1) }),
]);

const esquemaCriarDespesa = z.object({
  tipo: z.enum(["pessoal", "compartilhada"]),
  valorCentavos: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]),
  moeda: z.string().regex(/^[A-Z]{3}$/).default("BRL"),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD"),
  descricao: z.string().trim().min(2).max(200),
  pagadorId: z.uuid(),
  participantes: z.array(z.uuid()).default([]),
  rateio: esquemaRateio.optional(),
});

const esquemaContestar = z.object({ motivo: z.string().trim().min(5).max(400) });

const esquemaCorrigir = z.object({
  motivo: z.string().trim().min(5).max(400),
  valorCentavos: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]).optional(),
  moeda: z.string().regex(/^[A-Z]{3}$/).optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  descricao: z.string().trim().min(2).max(200).optional(),
  pagadorId: z.uuid().optional(),
  tipo: z.enum(["pessoal", "compartilhada"]).optional(),
  participantes: z.array(z.uuid()).optional(),
  rateio: esquemaRateio.optional(),
  versao: z.number().int().positive().optional(),
});

const esquemaMovimento = z.object({
  deId: z.uuid(),
  paraId: z.uuid(),
  valorCentavos: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]),
  despesaId: z.uuid().nullable().default(null),
});

function contextoDominio(contexto: ContextoViagem): ContextoAutorizacao {
  return contexto.contexto;
}

function paraDominioRateio(entrada: z.infer<typeof esquemaRateio> | undefined): Parameters<typeof criarDespesa>[0]["rateio"] {
  if (!entrada) return undefined;
  if (entrada.metodo === "igualitario") return { metodo: "igualitario", participantes: entrada.participantes };
  if (entrada.metodo === "valores") {
    return { metodo: "valores", partes: entrada.partes.map((parte) => ({ participanteId: parte.participanteId, valor: BigInt(parte.valorCentavos) })) };
  }
  return { metodo: "percentual", partes: entrada.partes.map((parte) => ({ participanteId: parte.participanteId, bps: parte.bps })) };
}

function movimentoParaDominio(linha: {
  id: string;
  viagem_id: string;
  de_id: string;
  para_id: string;
  valor_centavos: string;
  estado: Movimento["estado"];
  despesa_id: string | null;
}): Movimento {
  return {
    id: linha.id,
    viagemId: linha.viagem_id,
    deId: linha.de_id,
    paraId: linha.para_id,
    valorCentavos: paraCentavos(linha.valor_centavos),
    estado: linha.estado,
    despesaId: linha.despesa_id,
  };
}

export function rotasDespesas(app: FastifyInstance, deps: { pool: pg.Pool; config: Config }): void {
  const { pool, config } = deps;
  const http = { pool, nomeCookieSessao: config.nomeCookieSessao };

  app.get("/viagens/:viagemId/despesas", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const { rows } = await pool.query<{ id: string }>("SELECT id FROM despesas WHERE viagem_id = $1 ORDER BY data DESC, criado_em DESC", [
      viagemId,
    ]);
    const despesas: Record<string, unknown>[] = [];
    for (const linha of rows) {
      const carregada = await carregarDespesa(pool, viagemId, linha.id);
      if (carregada) despesas.push(despesaParaJson(carregada.despesa));
    }
    return { despesas };
  });

  app.post("/viagens/:viagemId/despesas", async (request, reply) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "despesa:criar");

    let corpo: z.infer<typeof esquemaCriarDespesa>;
    try {
      corpo = esquemaCriarDespesa.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }

    // Quem participa do rateio precisa ser membro ativo da viagem (autorização no servidor).
    const ativos = new Set(await participantesAtivos(pool, viagemId));
    const envolvidos = new Set<string>([
      ...(corpo.rateio && corpo.rateio.metodo !== "igualitario"
        ? corpo.rateio.partes.map((parte) => parte.participanteId)
        : []),
      ...(corpo.rateio && corpo.rateio.metodo === "igualitario" ? corpo.rateio.participantes : []),
      ...corpo.participantes,
      corpo.pagadorId,
    ]);
    for (const pessoa of envolvidos) {
      if (!ativos.has(pessoa)) {
        throw entradaInvalida("Todas as pessoas do rateio precisam ser participantes ativos da viagem.");
      }
    }

    const chave = idempotencyKey(request);
    const despesaId = novoId();
    const respondido = await comIdempotencia(
      pool,
      { chave, usuarioId: autenticado.usuarioId, rota: `POST /viagens/${viagemId}/despesas` },
      async () =>
        emTransacao(pool, async (cliente) => {
          const despesa = criarDespesa({
            id: despesaId,
            viagemId,
            autorId: autenticado.usuarioId,
            pagadorId: corpo.pagadorId,
            tipo: corpo.tipo,
            valorCentavos: centavosDoCorpo(corpo.valorCentavos, "valorCentavos"),
            moeda: corpo.moeda,
            data: corpo.data,
            descricao: corpo.descricao,
            participantes: corpo.participantes.length > 0 ? corpo.participantes : [...ativos],
            ...(paraDominioRateio(corpo.rateio) ? { rateio: paraDominioRateio(corpo.rateio) } : {}),
          });
          await cliente.query(
            `INSERT INTO despesas (id, viagem_id, autor_id, pagador_id, tipo, estado, valor_centavos, moeda, data, descricao, versao)
             VALUES ($1, $2, $3, $4, $5, 'pendente', $6, $7, $8, $9, 1)`,
            [
              despesa.id,
              viagemId,
              despesa.autorId,
              despesa.pagadorId,
              despesa.tipo,
              despesa.valorCentavos.toString(),
              despesa.moeda,
              despesa.data,
              despesa.descricao,
            ],
          );
          await gravarPartes(cliente, despesa.id, despesa.rateio);
          await gravarEvento(cliente, despesa.id, despesa.historico[0]!);
          await registrarAuditoria(cliente, {
            viagemId,
            atorId: autenticado.usuarioId,
            acao: "despesa:criar",
            entidade: "despesa",
            entidadeId: despesa.id,
            dados: { valorCentavos: despesa.valorCentavos.toString(), tipo: despesa.tipo, estado: despesa.estado },
          });
          return despesaParaJson(despesa);
        }),
    );
    return reply.status(201).send(respondido.resultado);
  });

  app.get("/viagens/:viagemId/despesas/:despesaId", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, despesaId } = request.params as { viagemId: string; despesaId: string };
    await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const carregada = await carregarDespesa(pool, viagemId, despesaId);
    if (!carregada) throw new ErroHttp(404, "nao_encontrado", "Despesa não encontrada nesta viagem.");
    return despesaParaJson(carregada.despesa);
  });

  app.post("/viagens/:viagemId/despesas/:despesaId/confirmar", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, despesaId } = request.params as { viagemId: string; despesaId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);

    return emTransacao(pool, async (cliente) => {
      const carregada = await carregarDespesa(cliente, viagemId, despesaId, true);
      if (!carregada) throw new ErroHttp(404, "nao_encontrado", "Despesa não encontrada nesta viagem.");
      const confirmada = confirmarDespesa(carregada.despesa, {
        usuarioId: autenticado.usuarioId,
        contexto: contextoDominio(contexto),
      });
      await cliente.query(
        `UPDATE despesas SET estado = $2, motivo_contestacao = NULL, confirmado_por = $3, confirmado_em = now(),
                             versao = versao + 1, atualizado_em = now()
          WHERE id = $1`,
        [despesaId, confirmada.estado, autenticado.usuarioId],
      );
      await gravarEvento(cliente, despesaId, confirmada.historico.at(-1)!);
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "despesa:confirmar",
        entidade: "despesa",
        entidadeId: despesaId,
        motivo: null,
      });
      return despesaParaJson(confirmada);
    });
  });

  app.post("/viagens/:viagemId/despesas/:despesaId/contestar", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, despesaId } = request.params as { viagemId: string; despesaId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const corpo = esquemaContestar.parse(request.body);
    exigirPermissao(contexto, "despesa:contestar");

    return emTransacao(pool, async (cliente) => {
      const carregada = await carregarDespesa(cliente, viagemId, despesaId, true);
      if (!carregada) throw new ErroHttp(404, "nao_encontrado", "Despesa não encontrada nesta viagem.");
      const contestada = contestarDespesa(
        carregada.despesa,
        { usuarioId: autenticado.usuarioId, contexto: contextoDominio(contexto) },
        corpo.motivo,
      );
      await cliente.query(
        `UPDATE despesas SET estado = $2, motivo_contestacao = $3, versao = versao + 1, atualizado_em = now() WHERE id = $1`,
        [despesaId, contestada.estado, contestada.motivoContestacao],
      );
      await gravarEvento(cliente, despesaId, contestada.historico.at(-1)!);
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "despesa:contestar",
        entidade: "despesa",
        entidadeId: despesaId,
        motivo: contestada.motivoContestacao,
      });
      return despesaParaJson(contestada);
    });
  });

  app.post("/viagens/:viagemId/despesas/:despesaId/corrigir", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, despesaId } = request.params as { viagemId: string; despesaId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "despesa:corrigir");
    let corpo: z.infer<typeof esquemaCorrigir>;
    try {
      corpo = esquemaCorrigir.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }

    return emTransacao(pool, async (cliente) => {
      const carregada = await carregarDespesa(cliente, viagemId, despesaId, true);
      if (!carregada) throw new ErroHttp(404, "nao_encontrado", "Despesa não encontrada nesta viagem.");
      exigirVersao(corpo.versao, carregada.despesa.versao);

      const rateio = paraDominioRateio(corpo.rateio);
      const corrigida = corrigirDespesa(
        carregada.despesa,
        { usuarioId: autenticado.usuarioId, contexto: contextoDominio(contexto) },
        {
          ...(corpo.valorCentavos !== undefined ? { valorCentavos: centavosDoCorpo(corpo.valorCentavos, "valorCentavos") } : {}),
          ...(corpo.moeda !== undefined ? { moeda: corpo.moeda } : {}),
          ...(corpo.data !== undefined ? { data: corpo.data } : {}),
          ...(corpo.descricao !== undefined ? { descricao: corpo.descricao } : {}),
          ...(corpo.pagadorId !== undefined ? { pagadorId: corpo.pagadorId } : {}),
          ...(corpo.tipo !== undefined ? { tipo: corpo.tipo } : {}),
          ...(corpo.participantes !== undefined ? { participantes: corpo.participantes } : {}),
          ...(rateio ? { rateio } : {}),
        },
        corpo.motivo,
      );

      await cliente.query(
        `UPDATE despesas SET valor_centavos = $2, moeda = $3, data = $4, descricao = $5, pagador_id = $6, tipo = $7,
                             estado = 'pendente', motivo_contestacao = NULL, confirmado_por = NULL, confirmado_em = NULL,
                             versao = versao + 1, atualizado_em = now()
          WHERE id = $1`,
        [
          despesaId,
          corrigida.valorCentavos.toString(),
          corrigida.moeda,
          corrigida.data,
          corrigida.descricao,
          corrigida.pagadorId,
          corrigida.tipo,
        ],
      );
      await gravarPartes(cliente, despesaId, corrigida.rateio);
      await gravarEvento(cliente, despesaId, corrigida.historico.at(-1)!);
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "despesa:corrigir",
        entidade: "despesa",
        entidadeId: despesaId,
        motivo: corpo.motivo,
        dados: corrigida.historico.at(-1)?.alteracoes,
      });
      return despesaParaJson(corrigida);
    });
  });

  app.get("/viagens/:viagemId/saldos", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const { rows: ids } = await pool.query<{ id: string }>("SELECT id FROM despesas WHERE viagem_id = $1", [viagemId]);
    const despesas: Despesa[] = [];
    for (const linha of ids) {
      const carregada = await carregarDespesa(pool, viagemId, linha.id);
      if (carregada) despesas.push(carregada.despesa);
    }
    const { rows: movimentosRows } = await pool.query<{
      id: string;
      viagem_id: string;
      de_id: string;
      para_id: string;
      valor_centavos: string;
      estado: Movimento["estado"];
      despesa_id: string | null;
    }>(
      `SELECT id, viagem_id, de_id, para_id, valor_centavos::text AS valor_centavos, estado, despesa_id
         FROM movimentos WHERE viagem_id = $1 ORDER BY criado_em`,
      [viagemId],
    );
    const movimentos = movimentosRows.map(movimentoParaDominio);
    const resumo = calcularResumoFinanceiro(despesas, movimentos);
    const sugestoes = sugerirTransferencias(resumo.saldos);
    const nomes = await pool.query<{ usuario_id: string; nome: string }>(
      "SELECT usuario_id, nome FROM membros_viagem m JOIN usuarios u ON u.id = m.usuario_id WHERE m.viagem_id = $1",
      [viagemId],
    );
    const nomePorId = new Map(nomes.rows.map((linha) => [linha.usuario_id, linha.nome]));
    const { rows: eventos } = await pool.query<{
      id: string;
      despesa_id: string;
      acao: string;
      autor_id: string;
      em: string;
      motivo: string | null;
      alteracoes: Record<string, { de: unknown; para: unknown }> | null;
    }>(
      `SELECT e.id::text AS id, e.despesa_id, e.acao, e.autor_id, e.em::text AS em, e.motivo, e.alteracoes
         FROM despesa_eventos e JOIN despesas d ON d.id = e.despesa_id
        WHERE d.viagem_id = $1 ORDER BY e.id DESC LIMIT 50`,
      [viagemId],
    );
    return {
      realizado: resumo.realizado.toString(),
      comprometido: resumo.comprometido.toString(),
      haDivergencia: resumo.haDivergencia,
      saldos: resumo.saldos.map((saldo) => ({
        participanteId: saldo.participanteId,
        nome: nomePorId.get(saldo.participanteId) ?? null,
        pago: saldo.pago.toString(),
        parteDevida: saldo.parteDevida.toString(),
        saldo: saldo.saldo.toString(),
      })),
      transferenciasSugeridas: sugestoes.map((sugestao) => ({
        deId: sugestao.deId,
        deNome: nomePorId.get(sugestao.deId) ?? null,
        paraId: sugestao.paraId,
        paraNome: nomePorId.get(sugestao.paraId) ?? null,
        valorCentavos: sugestao.valorCentavos.toString(),
      })),
      aviso: "Transferências são sugestões; nada é executado automaticamente e pagamento informado não é pagamento confirmado.",
      historicoRecente: eventos,
    };
  });

  app.post("/viagens/:viagemId/movimentos", async (request, reply) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "despesa:criar");
    let corpo: z.infer<typeof esquemaMovimento>;
    try {
      corpo = esquemaMovimento.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }
    if (corpo.deId === corpo.paraId) throw entradaInvalida("Quem paga e quem recebe precisam ser pessoas diferentes.");
    const ativos = new Set(await participantesAtivos(pool, viagemId));
    if (!ativos.has(corpo.deId) || !ativos.has(corpo.paraId)) {
      throw entradaInvalida("As pessoas do acerto precisam ser participantes ativos da viagem.");
    }
    const valor = centavosDoCorpo(corpo.valorCentavos, "valorCentavos");
    const movimentoId = novoId();
    await emTransacao(pool, async (cliente) => {
      await cliente.query(
        `INSERT INTO movimentos (id, viagem_id, de_id, para_id, valor_centavos, estado, despesa_id, criado_por)
         VALUES ($1, $2, $3, $4, $5, 'informado', $6, $7)`,
        [movimentoId, viagemId, corpo.deId, corpo.paraId, valor.toString(), corpo.despesaId, autenticado.usuarioId],
      );
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "movimento:informar",
        entidade: "movimento",
        entidadeId: movimentoId,
        dados: { de: corpo.deId, para: corpo.paraId, valorCentavos: valor.toString() },
      });
    });
    return reply.status(201).send({
      id: movimentoId,
      estado: "informado",
      aviso: "Pagamento informado; o saldo só muda quando quem recebeu confirmar.",
    });
  });

  app.post("/viagens/:viagemId/movimentos/:movimentoId/confirmar", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, movimentoId } = request.params as { viagemId: string; movimentoId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    return emTransacao(pool, async (cliente) => {
      const { rows } = await cliente.query<{ para_id: string; estado: string }>(
        "SELECT para_id, estado FROM movimentos WHERE id = $1 AND viagem_id = $2 FOR UPDATE",
        [movimentoId, viagemId],
      );
      const movimento = rows[0];
      if (!movimento) throw new ErroHttp(404, "nao_encontrado", "Acerto não encontrado nesta viagem.");
      if (movimento.para_id !== autenticado.usuarioId) {
        throw new ErroHttp(403, "sem_permissao", "Somente quem recebeu pode confirmar o recebimento.");
      }
      if (movimento.estado === "confirmado") throw new ErroHttp(409, "conflito", "Este acerto já foi confirmado.");
      await cliente.query(
        "UPDATE movimentos SET estado = 'confirmado', confirmado_por = $2, confirmado_em = now() WHERE id = $1",
        [movimentoId, autenticado.usuarioId],
      );
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "movimento:confirmar",
        entidade: "movimento",
        entidadeId: movimentoId,
      });
      void contexto;
      return { id: movimentoId, estado: "confirmado" };
    });
  });

  app.post("/viagens/:viagemId/movimentos/:movimentoId/contestar", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, movimentoId } = request.params as { viagemId: string; movimentoId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const corpo = esquemaContestar.parse(request.body);
    return emTransacao(pool, async (cliente) => {
      const { rows } = await cliente.query<{ para_id: string; de_id: string; estado: string }>(
        "SELECT para_id, de_id, estado FROM movimentos WHERE id = $1 AND viagem_id = $2 FOR UPDATE",
        [movimentoId, viagemId],
      );
      const movimento = rows[0];
      if (!movimento) throw new ErroHttp(404, "nao_encontrado", "Acerto não encontrado nesta viagem.");
      if (movimento.para_id !== autenticado.usuarioId && movimento.de_id !== autenticado.usuarioId) {
        throw new ErroHttp(403, "sem_permissao", "Só quem pagou ou quem recebeu pode contestar este acerto.");
      }
      if (movimento.estado === "contestado") throw new ErroHttp(409, "conflito", "Este acerto já está contestado.");
      await cliente.query("UPDATE movimentos SET estado = 'contestado' WHERE id = $1", [movimentoId]);
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "movimento:contestar",
        entidade: "movimento",
        entidadeId: movimentoId,
        motivo: corpo.motivo,
      });
      void contexto;
      return { id: movimentoId, estado: "contestado", motivo: corpo.motivo };
    });
  });

  app.get("/viagens/:viagemId/movimentos", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const { rows } = await pool.query(
      `SELECT m.id, m.de_id, m.para_id, m.valor_centavos::text AS valor_centavos, m.estado, m.despesa_id, m.criado_em::text AS criado_em,
              m.confirmado_em::text AS confirmado_em,
              (SELECT nome FROM usuarios WHERE id = m.de_id) AS de_nome,
              (SELECT nome FROM usuarios WHERE id = m.para_id) AS para_nome
         FROM movimentos m WHERE m.viagem_id = $1 ORDER BY m.criado_em DESC`,
      [viagemId],
    );
    return { movimentos: rows };
  });

  void rateioParaJson;
}
