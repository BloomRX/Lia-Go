/**
 * Orçamento da viagem (tela 9) e fechamento/exportação (tela 21).
 *
 * O orçamento junta três verdades diferentes e **não** as mistura:
 *  - previsto (planejamento): roteiro + reservas com valor conhecido;
 *  - gasto confirmado (oficial): despesas confirmadas, calculadas pelo domínio em `financas.ts`;
 *  - aguardando confirmação: lançado, visível, fora do oficial.
 * A situação (percentual, alertas) vem de `situacaoDoOrcamento` — a tela não faz conta.
 */
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { ROTULO_ESTADO_ORCAMENTO, definirLimite, montarFechamento, resumirOrcamentoDoRoteiro, resumirReservas, situacaoDoOrcamento } from "@lia-go/domain";
import type { Config } from "../config.ts";
import { emTransacao } from "../db.ts";
import { ErroHttp } from "../errors.ts";
import { exigirAutenticacao, tratarErroDeValidacao } from "../http.ts";
import { exigirContexto, exigirPermissao, participantesAtivos, type ContextoViagem } from "../authz.ts";
import { registrarAuditoria } from "../audit.ts";
import { carregarFinanceiroDaViagem } from "../financas.ts";
import { listarAtividades } from "../roteiro-repo.ts";
import { listarReservas } from "../reserva-repo.ts";
import { novoId } from "../tokens.ts";

const esquemaLimite = z.object({
  centavos: z.union([z.string().regex(/^\d+$/), z.number().int().min(0)]),
});

interface LinhaLimite {
  id: string;
  escopo: "coletivo" | "individual";
  usuario_id: string | null;
  centavos: string;
  atualizado_por: string;
  atualizado_em: Date;
  versao: number;
}

function limiteParaJson(linha: LinhaLimite): Record<string, unknown> {
  return {
    id: linha.id,
    escopo: linha.escopo,
    usuarioId: linha.usuario_id,
    centavos: linha.centavos,
    atualizadoPor: linha.atualizado_por,
    atualizadoEm: linha.atualizado_em.toISOString(),
    versao: linha.versao,
  };
}

/** O que a viagem tem previsto (planejamento): roteiro + reservas, com o que falta verificar. */
async function previstoDaViagem(pool: pg.Pool, viagemId: string): Promise<{ previstoCentavos: bigint; custosAVerificar: number }> {
  const atividades = await listarAtividades(pool, viagemId);
  const reservas = await listarReservas(pool, viagemId);
  const roteiro = resumirOrcamentoDoRoteiro(atividades);
  const deReservas = resumirReservas(reservas);
  return {
    previstoCentavos: roteiro.previstoCentavos + deReservas.previstoCentavos,
    // Roteiro conta "a verificar" explícito; reserva sem valor informado também é desconhecido.
    custosAVerificar: roteiro.aVerificar + deReservas.semCustoInformado,
  };
}

export function rotasOrcamento(app: FastifyInstance, deps: { pool: pg.Pool; config: Config }): void {
  const { pool, config } = deps;
  const http = { pool, nomeCookieSessao: config.nomeCookieSessao };

  app.get("/viagens/:viagemId/orcamento", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    await exigirContexto(pool, autenticado.usuarioId, viagemId);

    const { rows: limites } = await pool.query<LinhaLimite>(
      "SELECT id, escopo, usuario_id, centavos::text AS centavos, atualizado_por, atualizado_em, versao FROM limites_orcamento WHERE viagem_id = $1",
      [viagemId],
    );
    const coletivo = limites.find((linha) => linha.escopo === "coletivo") ?? null;
    const individuais = limites.filter((linha) => linha.escopo === "individual");

    const { previstoCentavos, custosAVerificar } = await previstoDaViagem(pool, viagemId);
    const financeiro = await carregarFinanceiroDaViagem(pool, viagemId);
    const meuIndividual = individuais.find((linha) => linha.usuario_id === autenticado.usuarioId) ?? null;

    return {
      // O limite **coletivo** é o teto da viagem; o individual responde pela parte da pessoa.
      limiteColetivo: coletivo ? limiteParaJson(coletivo) : null,
      limiteIndividualProprio: meuIndividual ? limiteParaJson(meuIndividual) : null,
      limitesIndividuais: individuais.map((linha) => ({ ...limiteParaJson(linha), nome: financeiro.nomePorId.get(linha.usuario_id ?? "") ?? null })),
      situacao: serializarSituacao(situacaoDoOrcamento({
        limiteCentavos: coletivo ? BigInt(coletivo.centavos) : null,
        previstoCentavos,
        gastoConfirmadoCentavos: financeiro.resumo.realizado,
        aguardandoCentavos: financeiro.resumo.comprometido,
        custosAVerificar,
      })),
      planejamento: {
        previstoCentavos: previstoCentavos.toString(),
        custosAVerificar,
      },
      oficial: {
        gastoConfirmadoCentavos: financeiro.resumo.realizado.toString(),
        aguardandoCentavos: financeiro.resumo.comprometido.toString(),
      },
      rotulos: ROTULO_ESTADO_ORCAMENTO,
    };
  });

  app.put("/viagens/:viagemId/orcamento/limite", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "orcamento:definir");
    return gravarLimite(contexto, null, request.body, autenticado.usuarioId, "coletivo");
  });

  app.put("/viagens/:viagemId/orcamento/limites/:usuarioId", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, usuarioId } = request.params as { viagemId: string; usuarioId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    // Cada pessoa define o próprio limite; o organizador define o de qualquer uma (combinado do grupo).
    if (usuarioId !== autenticado.usuarioId) exigirPermissao(contexto, "orcamento:definir");
    else exigirPermissao(contexto, "orcamento:definir-proprio");
    const ativos = await participantesAtivos(pool, viagemId);
    if (!ativos.includes(usuarioId)) throw new ErroHttp(400, "entrada_invalida", "Só quem participa da viagem pode ter limite individual.");
    return gravarLimite(contexto, usuarioId, request.body, autenticado.usuarioId, "individual");
  });

  async function gravarLimite(
    contexto: ContextoViagem,
    usuarioId: string | null,
    corpo: unknown,
    autorId: string,
    escopo: "coletivo" | "individual",
  ): Promise<Record<string, unknown>> {
    let dados: z.infer<typeof esquemaLimite>;
    try {
      dados = esquemaLimite.parse(corpo);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }
    const centavos = BigInt(dados.centavos);
    // A validação é do domínio (mesma mensagem que a tela dá offline).
    definirLimite({ viagemId: contexto.viagem.id, escopo, usuarioId, centavos, porId: autorId });

    return emTransacao(pool, async (cliente) => {
      const existente = await cliente.query<{ id: string; versao: number }>(
        escopo === "coletivo"
          ? "SELECT id, versao FROM limites_orcamento WHERE viagem_id = $1 AND escopo = 'coletivo' FOR UPDATE"
          : "SELECT id, versao FROM limites_orcamento WHERE viagem_id = $1 AND escopo = 'individual' AND usuario_id = $2 FOR UPDATE",
        escopo === "coletivo" ? [contexto.viagem.id] : [contexto.viagem.id, usuarioId],
      );
      const atual = existente.rows[0];
      const id = atual?.id ?? novoId();
      if (atual) {
        await cliente.query("UPDATE limites_orcamento SET centavos = $2, atualizado_por = $3, atualizado_em = now(), versao = versao + 1 WHERE id = $1", [
          id,
          centavos.toString(),
          autorId,
        ]);
      } else {
        await cliente.query(
          `INSERT INTO limites_orcamento (id, viagem_id, escopo, usuario_id, centavos, atualizado_por, versao)
           VALUES ($1, $2, $3, $4, $5, $6, 1)`,
          [id, contexto.viagem.id, escopo, usuarioId, centavos.toString(), autorId],
        );
      }
      await registrarAuditoria(cliente, {
        viagemId: contexto.viagem.id,
        atorId: autorId,
        acao: `orcamento:limite:${escopo}`,
        entidade: "viagem",
        entidadeId: contexto.viagem.id,
        dados: { centavos: centavos.toString(), usuarioId },
      });
      const { rows } = await cliente.query<LinhaLimite>(
        "SELECT id, escopo, usuario_id, centavos::text AS centavos, atualizado_por, atualizado_em, versao FROM limites_orcamento WHERE id = $1",
        [id],
      );
      return { limite: limiteParaJson(rows[0]!) };
    });
  }

  /**
   * Fechamento/exportação (tela 21): as contas do jeito que o grupo confere e exporta.
   * Nada aqui muda dado: é leitura somada pelo domínio.
   */
  app.get("/viagens/:viagemId/fechamento", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "viagem:exportar");

    const financeiro = await carregarFinanceiroDaViagem(pool, viagemId);
    const atividades = await listarAtividades(pool, viagemId);
    const reservas = await listarReservas(pool, viagemId);
    const { rows: limiteColetivo } = await pool.query<{ centavos: string }>(
      "SELECT centavos::text AS centavos FROM limites_orcamento WHERE viagem_id = $1 AND escopo = 'coletivo'",
      [viagemId],
    );

    const participantes = [...financeiro.nomePorId.entries()].map(([id, nome]) => ({ id, nome }));
    const fechamento = montarFechamento({
      viagem: {
        id: viagemId,
        nome: contexto.viagem.nome,
        destino: contexto.viagem.destino ?? null,
        moeda: contexto.viagem.moeda,
        estado: contexto.viagem.estado,
      },
      despesas: financeiro.despesas,
      movimentos: financeiro.movimentos,
      participantes,
      atividades,
      reservas,
      limiteCentavos: limiteColetivo[0] ? BigInt(limiteColetivo[0].centavos) : null,
    });

    return serializarFechamento(fechamento);
  });
}

/** O app não lê `bigint` direto do JSON: o dinheiro sai como string de centavos. */
export function serializarSituacao(situacao: ReturnType<typeof situacaoDoOrcamento>): Record<string, unknown> {
  return {
    ...situacao,
    limiteCentavos: situacao.limiteCentavos === null ? null : situacao.limiteCentavos.toString(),
    previstoCentavos: situacao.previstoCentavos.toString(),
    gastoConfirmadoCentavos: situacao.gastoConfirmadoCentavos.toString(),
    aguardandoCentavos: situacao.aguardandoCentavos.toString(),
    restantePrevistoCentavos: situacao.restantePrevistoCentavos === null ? null : situacao.restantePrevistoCentavos.toString(),
    restanteGastoCentavos: situacao.restanteGastoCentavos === null ? null : situacao.restanteGastoCentavos.toString(),
  };
}

export function serializarFechamento(fechamento: ReturnType<typeof montarFechamento>): Record<string, unknown> {
  return {
    ...fechamento,
    totalConfirmadoCentavos: fechamento.totalConfirmadoCentavos.toString(),
    totalAguardandoCentavos: fechamento.totalAguardandoCentavos.toString(),
    previstoCentavos: fechamento.previstoCentavos.toString(),
    previstoRoteiroCentavos: fechamento.previstoRoteiroCentavos.toString(),
    previstoReservasCentavos: fechamento.previstoReservasCentavos.toString(),
    limiteCentavos: fechamento.limiteCentavos === null ? null : fechamento.limiteCentavos.toString(),
    linhas: fechamento.linhas.map((linha) => ({
      ...linha,
      valorCentavos: linha.valorCentavos.toString(),
      partes: linha.partes.map((parte) => ({ ...parte, valorCentavos: parte.valorCentavos.toString() })),
    })),
    saldos: fechamento.saldos.map((saldo) => ({
      ...saldo,
      pagoCentavos: saldo.pagoCentavos.toString(),
      parteCentavos: saldo.parteCentavos.toString(),
      saldoCentavos: saldo.saldoCentavos.toString(),
    })),
    acertosSugeridos: fechamento.acertosSugeridos.map((acerto) => ({ ...acerto, valorCentavos: acerto.valorCentavos.toString() })),
  };
}
