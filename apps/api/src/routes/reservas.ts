/**
 * Reservas: hospedagem, transporte, passeio e "outro".
 *
 * Regras que a rota garante (e que o domínio testa):
 *  - reserva **nasce prevista**: não existe rota que crie já confirmada — confirmar é ação separada;
 *  - confirmar exige **evidência** (código, localizador, comprovante) e registra quem e quando;
 *  - cancelar exige **motivo** e não apaga a evidência que já existia;
 *  - custo desconhecido é `null`: nunca `0` (nada de "R$ 0,00" na tela).
 */
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { ROTULO_ESTADO_RESERVA, ROTULO_TIPO_RESERVA, TIPOS_DE_RESERVA, cancelarReserva, confirmarReserva, criarReserva } from "@lia-go/domain";
import type { Config } from "../config.ts";
import { emTransacao } from "../db.ts";
import { ErroHttp } from "../errors.ts";
import { comIdempotencia, exigirAutenticacao, idempotencyKey, tratarErroDeValidacao } from "../http.ts";
import { exigirContexto, exigirPermissao, exigirVersao } from "../authz.ts";
import { registrarAuditoria } from "../audit.ts";
import { carregarEventosDaReserva, carregarReserva, gravarEventoDaReserva, listarReservas, reservaParaJson } from "../reserva-repo.ts";
import { novoId } from "../tokens.ts";

const CENTAVOS = /^\d+$/;
const esquemaCentavos = z.union([z.string().regex(CENTAVOS), z.number().int().min(0)]);

const esquemaCriarReserva = z.object({
  tipo: z.enum(["hospedagem", "transporte", "passeio", "outro"]),
  titulo: z.string().trim().min(2).max(120),
  local: z.string().trim().max(200).nullable().default(null),
  // Sem data/hora é estado válido: "ainda não sei quando" existe e não se preenche com chute.
  inicio: z.string().datetime({ offset: true }).nullable().default(null),
  fim: z.string().datetime({ offset: true }).nullable().default(null),
  custoCentavos: esquemaCentavos.nullable().default(null),
});

const esquemaConfirmar = z.object({
  confirmacao: z.string().trim().min(3).max(200),
  versao: z.number().int().positive().optional(),
});

const esquemaCancelar = z.object({
  motivo: z.string().trim().min(5).max(400),
  versao: z.number().int().positive().optional(),
});

export function rotasReservas(app: FastifyInstance, deps: { pool: pg.Pool; config: Config }): void {
  const { pool, config } = deps;
  const http = { pool, nomeCookieSessao: config.nomeCookieSessao };

  app.get("/viagens/:viagemId/reservas", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    await exigirContexto(pool, autenticado.usuarioId, viagemId);

    const reservas = await listarReservas(pool, viagemId);
    return {
      reservas: reservas.map(reservaParaJson),
      tipos: TIPOS_DE_RESERVA.map((tipo) => ({ tipo, rotulo: ROTULO_TIPO_RESERVA[tipo] })),
      rotulos: ROTULO_ESTADO_RESERVA,
    };
  });

  app.get("/viagens/:viagemId/reservas/:reservaId", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, reservaId } = request.params as { viagemId: string; reservaId: string };
    await exigirContexto(pool, autenticado.usuarioId, viagemId);

    const reserva = await carregarReserva(pool, viagemId, reservaId);
    if (!reserva) throw new ErroHttp(404, "nao_encontrada", "Reserva não encontrada nesta viagem.");
    return { reserva: reservaParaJson(reserva), historico: await carregarEventosDaReserva(pool, reservaId) };
  });

  app.post("/viagens/:viagemId/reservas", async (request, reply) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "reserva:criar");

    let corpo: z.infer<typeof esquemaCriarReserva>;
    try {
      corpo = esquemaCriarReserva.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }

    const chave = idempotencyKey(request);
    const reservaId = novoId();
    const respondido = await comIdempotencia(
      pool,
      { chave, usuarioId: autenticado.usuarioId, rota: `POST /viagens/${viagemId}/reservas` },
      async () =>
        emTransacao(pool, async (cliente) => {
          const reserva = criarReserva({
            id: reservaId,
            viagemId,
            autorId: autenticado.usuarioId,
            tipo: corpo.tipo,
            titulo: corpo.titulo,
            local: corpo.local,
            inicio: corpo.inicio,
            fim: corpo.fim,
            custoCentavos: corpo.custoCentavos === null ? null : BigInt(corpo.custoCentavos),
          });
          await cliente.query(
            `INSERT INTO reservas (id, viagem_id, autor_id, tipo, titulo, local, inicio, fim, custo_centavos,
                                   custo_a_verificar, estado, versao)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'prevista', 1)`,
            [
              reserva.id,
              viagemId,
              reserva.autorId,
              reserva.tipo,
              reserva.titulo,
              reserva.local,
              reserva.inicio,
              reserva.fim,
              reserva.custoCentavos === null ? null : reserva.custoCentavos.toString(),
              reserva.custoAVerificar,
            ],
          );
          await gravarEventoDaReserva(cliente, {
            reservaId: reserva.id,
            acao: "reserva:criar",
            autorId: autenticado.usuarioId,
            estadoNovo: reserva.estado,
          });
          await registrarAuditoria(cliente, {
            viagemId,
            atorId: autenticado.usuarioId,
            acao: "reserva:criar",
            entidade: "reserva",
            entidadeId: reserva.id,
            dados: { tipo: reserva.tipo, temCusto: reserva.custoCentavos !== null, inicio: reserva.inicio },
          });
          return reservaParaJson(reserva);
        }),
    );
    return reply.status(201).send({ reserva: respondido.resultado });
  });

  app.post("/viagens/:viagemId/reservas/:reservaId/confirmar", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, reservaId } = request.params as { viagemId: string; reservaId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "reserva:confirmar");
    let corpo: z.infer<typeof esquemaConfirmar>;
    try {
      corpo = esquemaConfirmar.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }

    return emTransacao(pool, async (cliente) => {
      const atual = await carregarReserva(cliente, viagemId, reservaId, true);
      if (!atual) throw new ErroHttp(404, "nao_encontrada", "Reserva não encontrada nesta viagem.");
      exigirVersao(corpo.versao, atual.versao);

      const confirmada = confirmarReserva(atual, {
        porId: autenticado.usuarioId,
        confirmacao: corpo.confirmacao,
        em: new Date().toISOString(),
      });
      await cliente.query(
        `UPDATE reservas SET estado = 'confirmada', confirmacao = $2, confirmada_por = $3, confirmada_em = now(),
                             custo_a_verificar = $4, versao = versao + 1, atualizado_em = now()
          WHERE id = $1`,
        [reservaId, confirmada.confirmacao, confirmada.confirmadaPor, confirmada.custoAVerificar],
      );
      await gravarEventoDaReserva(cliente, {
        reservaId,
        acao: "reserva:confirmar",
        autorId: autenticado.usuarioId,
        estadoAnterior: atual.estado,
        estadoNovo: "confirmada",
        motivo: confirmada.confirmacao,
      });
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "reserva:confirmar",
        entidade: "reserva",
        entidadeId: reservaId,
      });
      return { reserva: reservaParaJson({ ...confirmada, versao: atual.versao + 1 }) };
    });
  });

  app.post("/viagens/:viagemId/reservas/:reservaId/cancelar", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, reservaId } = request.params as { viagemId: string; reservaId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "reserva:cancelar");
    let corpo: z.infer<typeof esquemaCancelar>;
    try {
      corpo = esquemaCancelar.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }

    return emTransacao(pool, async (cliente) => {
      const atual = await carregarReserva(cliente, viagemId, reservaId, true);
      if (!atual) throw new ErroHttp(404, "nao_encontrada", "Reserva não encontrada nesta viagem.");
      exigirVersao(corpo.versao, atual.versao);

      const cancelada = cancelarReserva(atual, { porId: autenticado.usuarioId, motivo: corpo.motivo });
      await cliente.query(`UPDATE reservas SET estado = 'cancelada', motivo_cancelamento = $2, versao = versao + 1, atualizado_em = now() WHERE id = $1`, [
        reservaId,
        cancelada.motivoCancelamento,
      ]);
      await gravarEventoDaReserva(cliente, {
        reservaId,
        acao: "reserva:cancelar",
        autorId: autenticado.usuarioId,
        estadoAnterior: atual.estado,
        estadoNovo: "cancelada",
        motivo: cancelada.motivoCancelamento,
      });
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "reserva:cancelar",
        entidade: "reserva",
        entidadeId: reservaId,
        motivo: cancelada.motivoCancelamento,
      });
      return { reserva: reservaParaJson({ ...cancelada, versao: atual.versao + 1 }) };
    });
  });
}
