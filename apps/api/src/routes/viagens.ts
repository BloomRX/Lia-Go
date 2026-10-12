/**
 * Viagens, participantes, convites e transições de estado.
 * Toda autorização é decidida no servidor com as regras do domínio.
 */
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import {
  ROTULOS_ESTADO,
  type Ator,
  type Viagem,
  consequenciasDeSaida,
  impactosDeCancelamento,
  sugerirEstado,
  transicoesPermitidas,
  transicionar,
} from "@lia-go/domain";
import type { Config } from "../config.ts";
import { emTransacao } from "../db.ts";
import { ErroHttp, entradaInvalida } from "../errors.ts";
import { comIdempotencia, exigirAutenticacao, idempotencyKey, tratarErroDeValidacao } from "../http.ts";
import { carregarContexto, decidir, exigirContexto, exigirPermissao, exigirVersao, type ContextoViagem } from "../authz.ts";
import { registrarAuditoria } from "../audit.ts";
import { gerarToken, hashToken, novoId } from "../tokens.ts";

const esquemaCriarViagem = z.object({
  nome: z.string().trim().min(2, "informe o nome da viagem").max(120),
  destino: z.string().trim().max(160).default(""),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD").nullable().default(null),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD").nullable().default(null),
  fusoHorario: z.string().trim().min(3).max(60).default("America/Sao_Paulo"),
  moeda: z.string().regex(/^[A-Z]{3}$/, "use três letras maiúsculas, por exemplo BRL").default("BRL"),
  orcamentoCentavos: z.string().regex(/^\d+$/).nullable().default(null),
});

const esquemaAtualizarViagem = esquemaCriarViagem.partial().extend({
  versao: z.number().int().positive().optional(),
});

const esquemaTransicao = z.object({
  para: z.enum(["rascunho", "planejada", "em_andamento", "concluida", "pendente", "cancelada"]),
  motivo: z.string().trim().max(400).optional(),
  versao: z.number().int().positive().optional(),
});

const esquemaConvite = z.object({
  email: z.email("informe um e-mail válido"),
  papel: z.enum(["participante", "organizador"]).default("participante"),
});

const esquemaAceitarConvite = z.object({ token: z.string().min(20) });

function validarDatas(dataInicio: string | null, dataFim: string | null): void {
  if (dataInicio && dataFim && dataFim < dataInicio) {
    throw entradaInvalida("A data final não pode ser anterior à data de início.");
  }
}

function paraAtor(contexto: ContextoViagem): Ator {
  return {
    usuarioId: contexto.usuarioId,
    papel: contexto.contexto.papel,
    estadoMembro: contexto.contexto.estadoMembro,
  };
}

function viagemParaDominio(viagem: ContextoViagem["viagem"]): Viagem {
  return {
    id: viagem.id,
    estado: viagem.estado,
    dataInicio: viagem.data_inicio,
    dataFim: viagem.data_fim,
    fusoHorario: viagem.fuso_horario,
    versao: viagem.versao,
  };
}

export function rotasViagens(app: FastifyInstance, deps: { pool: pg.Pool; config: Config }): void {
  const { pool, config } = deps;
  const http = { pool, nomeCookieSessao: config.nomeCookieSessao };

  app.get("/viagens", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { rows } = await pool.query(
      `SELECT v.id, v.nome, v.destino,
              to_char(v.data_inicio, 'YYYY-MM-DD') AS data_inicio,
              to_char(v.data_fim, 'YYYY-MM-DD') AS data_fim,
              v.fuso_horario, v.moeda, v.estado, v.versao,
              m.papel,
              (SELECT count(*)::int FROM despesas d WHERE d.viagem_id = v.id AND d.estado IN ('pendente','contestada')) AS pendencias_financeiras
         FROM viagens v
         JOIN membros_viagem m ON m.viagem_id = v.id AND m.usuario_id = $1 AND m.estado = 'ativo'
        ORDER BY v.data_inicio NULLS LAST, v.criado_em DESC`,
      [autenticado.usuarioId],
    );
    const convites = await pool.query(
      `SELECT c.id, c.viagem_id, v.nome AS viagem_nome, c.papel, c.expira_em::text AS expira_em
         FROM convites c JOIN viagens v ON v.id = c.viagem_id
        WHERE c.email_normalizado = (SELECT email_normalizado FROM usuarios WHERE id = $1)
          AND c.estado = 'pendente' AND c.expira_em > now()`,
      [autenticado.usuarioId],
    );
    return { viagens: rows, convitesPendentes: convites.rows };
  });

  app.post("/viagens", async (request, reply) => {
    const autenticado = await exigirAutenticacao(request, http);
    let corpo: z.infer<typeof esquemaCriarViagem>;
    try {
      corpo = esquemaCriarViagem.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }
    validarDatas(corpo.dataInicio, corpo.dataFim);
    const chave = idempotencyKey(request);
    const viagemId = novoId();

    const { resultado } = await comIdempotencia(
      pool,
      { chave, usuarioId: autenticado.usuarioId, rota: "POST /viagens" },
      async () =>
        emTransacao(pool, async (cliente) => {
          await cliente.query(
            `INSERT INTO viagens (id, nome, destino, data_inicio, data_fim, fuso_horario, moeda, estado, orcamento_centavos, criado_por)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'rascunho', $8, $9)`,
            [
              viagemId,
              corpo.nome,
              corpo.destino,
              corpo.dataInicio,
              corpo.dataFim,
              corpo.fusoHorario,
              corpo.moeda,
              corpo.orcamentoCentavos,
              autenticado.usuarioId,
            ],
          );
          await cliente.query(
            `INSERT INTO membros_viagem (viagem_id, usuario_id, papel, estado) VALUES ($1, $2, 'organizador', 'ativo')`,
            [viagemId, autenticado.usuarioId],
          );
          await registrarAuditoria(cliente, {
            viagemId,
            atorId: autenticado.usuarioId,
            acao: "viagem:criar",
            entidade: "viagem",
            entidadeId: viagemId,
            dados: { nome: corpo.nome, estado: "rascunho" },
          });
          return { id: viagemId, estado: "rascunho" as const };
        }),
    );
    return reply.status(201).send(resultado);
  });

  app.get("/viagens/:viagemId", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const participantes = await pool.query(
      `SELECT m.usuario_id, u.nome, m.papel, m.estado, m.entrou_em::text AS entrou_em
         FROM membros_viagem m JOIN usuarios u ON u.id = m.usuario_id
        WHERE m.viagem_id = $1 AND m.estado IN ('ativo','convidado')
        ORDER BY m.papel DESC, m.entrou_em`,
      [viagemId],
    );
    const pendencias = await pool.query<{ despesas: number; convites: number }>(
      `SELECT
         (SELECT count(*)::int FROM despesas WHERE viagem_id = $1 AND estado IN ('pendente','contestada')) AS despesas,
         (SELECT count(*)::int FROM convites WHERE viagem_id = $1 AND estado = 'pendente') AS convites`,
      [viagemId],
    );
    const sugestao = sugerirEstado(viagemParaDominio(contexto.viagem), new Date().toISOString());
    const permissoes = {
      editar: decidir(contexto, "viagem:editar"),
      cancelar: decidir(contexto, "viagem:cancelar"),
      convidar: decidir(contexto, "viagem:convite:gerenciar"),
      registrarDespesa: decidir(contexto, "despesa:criar"),
      // Mesma lista do domínio; só o organizador pode cancelar/rascunhar.
      transicoesPermitidas: transicoesPermitidas(contexto.viagem.estado).filter((destino) => {
        if (contexto.contexto.papel === "organizador") return true;
        return destino === "em_andamento" || destino === "concluida" || destino === "pendente";
      }),
    };
    return {
      viagem: {
        ...contexto.viagem,
        rotuloEstado: ROTULOS_ESTADO[contexto.viagem.estado],
      },
      papel: contexto.contexto.papel,
      participantes: participantes.rows,
      pendencias: pendencias.rows[0] ?? { despesas: 0, convites: 0 },
      sugestao,
      permissoes,
    };
  });

  app.patch("/viagens/:viagemId", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "viagem:editar");
    let corpo: z.infer<typeof esquemaAtualizarViagem>;
    try {
      corpo = esquemaAtualizarViagem.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }
    exigirVersao(corpo.versao, contexto.viagem.versao);
    const dataInicio = corpo.dataInicio === undefined ? contexto.viagem.data_inicio : corpo.dataInicio;
    const dataFim = corpo.dataFim === undefined ? contexto.viagem.data_fim : corpo.dataFim;
    validarDatas(dataInicio, dataFim);

    return emTransacao(pool, async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE viagens
            SET nome = COALESCE($2, nome),
                destino = COALESCE($3, destino),
                data_inicio = $4,
                data_fim = $5,
                fuso_horario = COALESCE($6, fuso_horario),
                moeda = COALESCE($7, moeda),
                orcamento_centavos = $8,
                versao = versao + 1,
                atualizado_em = now()
          WHERE id = $1
          RETURNING versao`,
        [
          viagemId,
          corpo.nome ?? null,
          corpo.destino ?? null,
          dataInicio,
          dataFim,
          corpo.fusoHorario ?? null,
          corpo.moeda ?? null,
          corpo.orcamentoCentavos ?? null,
        ],
      );
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "viagem:editar",
        entidade: "viagem",
        entidadeId: viagemId,
        dados: { antes: contexto.viagem, depois: corpo },
      });
      return { id: viagemId, versao: rows[0]?.versao };
    });
  });

  app.get("/viagens/:viagemId/impactos-cancelamento", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "viagem:cancelar");
    const { rows } = await pool.query<{ despesas: number; reservas: number }>(
      `SELECT
         (SELECT count(*)::int FROM despesas WHERE viagem_id = $1 AND estado IN ('pendente','contestada')) AS despesas,
         (SELECT count(*)::int FROM movimentos WHERE viagem_id = $1 AND estado <> 'confirmado') AS reservas`,
      [viagemId],
    );
    return {
      impactos: impactosDeCancelamento({
        despesasPendentes: rows[0]?.despesas ?? 0,
        reservasRegistradas: rows[0]?.reservas ?? 0,
      }),
    };
  });

  app.post("/viagens/:viagemId/transicoes", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    let corpo: z.infer<typeof esquemaTransicao>;
    try {
      corpo = esquemaTransicao.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }
    exigirVersao(corpo.versao, contexto.viagem.versao);
    // Permissão explícita por destino: a mensagem para a pessoa é clara (403 com motivo).
    if (corpo.para === "cancelada") exigirPermissao(contexto, "viagem:cancelar");
    else if (corpo.para === "rascunho" || corpo.para === "planejada") exigirPermissao(contexto, "viagem:editar");

    const { viagem, evento } = transicionar(viagemParaDominio(contexto.viagem), corpo.para, paraAtor(contexto), {
      motivo: corpo.motivo ?? null,
      em: new Date().toISOString(),
    });

    return emTransacao(pool, async (cliente) => {
      const atualizado = await cliente.query<{ versao: number }>(
        `UPDATE viagens SET estado = $2, versao = versao + 1, atualizado_em = now()
          WHERE id = $1 AND versao = $3 RETURNING versao`,
        [viagemId, viagem.estado, contexto.viagem.versao],
      );
      if (!atualizado.rows[0]) {
        throw new ErroHttp(409, "conflito", "A viagem mudou de estado em outra sessão; recarregue antes de tentar de novo.");
      }
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: evento.acao,
        entidade: "viagem",
        entidadeId: viagemId,
        motivo: evento.motivo,
        dados: { de: evento.estadoAnterior, para: evento.estadoNovo },
      });
      return {
        id: viagemId,
        estado: viagem.estado,
        rotuloEstado: ROTULOS_ESTADO[viagem.estado],
        versao: atualizado.rows[0].versao,
        confirmadoPor: autenticado.usuarioId,
        confirmadoEm: evento.em,
      };
    });
  });

  app.get("/viagens/:viagemId/participantes", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const { rows } = await pool.query(
      `SELECT m.usuario_id, u.nome, m.papel, m.estado, m.entrou_em::text AS entrou_em
         FROM membros_viagem m JOIN usuarios u ON u.id = m.usuario_id
        WHERE m.viagem_id = $1 ORDER BY m.estado, m.papel DESC, u.nome`,
      [viagemId],
    );
    return { participantes: rows, consequenciasDeSaida: consequenciasDeSaida() };
  });

  app.post("/viagens/:viagemId/convites", async (request, reply) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "viagem:convite:gerenciar");
    const corpo = esquemaConvite.parse(request.body);
    const token = gerarToken();
    const conviteId = novoId();
    const expiraEm = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await emTransacao(pool, async (cliente) => {
      await cliente.query(
        `INSERT INTO convites (id, viagem_id, email, email_normalizado, papel, estado, token_hash, criado_por, expira_em)
         VALUES ($1, $2, $3, $4, $5, 'pendente', $6, $7, $8)`,
        [
          conviteId,
          viagemId,
          corpo.email.trim(),
          corpo.email.trim().toLowerCase(),
          corpo.papel,
          hashToken(token),
          autenticado.usuarioId,
          expiraEm,
        ],
      );
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "convite:criar",
        entidade: "convite",
        entidadeId: conviteId,
        dados: { email: corpo.email.trim().toLowerCase(), papel: corpo.papel },
      });
    });

    return reply.status(201).send({
      id: conviteId,
      email: corpo.email.trim().toLowerCase(),
      papel: corpo.papel,
      expiraEm: expiraEm.toISOString(),
      // O token é mostrado uma única vez para o organizador enviar o link.
      // Não enviamos e-mail nesta etapa (provedor de e-mail ainda não decidido).
      token,
      aviso: "Envie este link para a pessoa convidada. Ela precisa entrar com o mesmo e-mail do convite.",
    });
  });

  app.get("/viagens/:viagemId/convites", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "viagem:convite:gerenciar");
    const { rows } = await pool.query(
      `SELECT id, email, papel, estado, expira_em::text AS expira_em, criado_em::text AS criado_em
         FROM convites WHERE viagem_id = $1 ORDER BY criado_em DESC`,
      [viagemId],
    );
    return { convites: rows };
  });

  app.post("/viagens/:viagemId/convites/:conviteId/cancelar", async (request, reply) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, conviteId } = request.params as { viagemId: string; conviteId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "viagem:convite:gerenciar");
    const resultado = await pool.query(
      `UPDATE convites SET estado = 'cancelado'
        WHERE id = $1 AND viagem_id = $2 AND estado = 'pendente'`,
      [conviteId, viagemId],
    );
    if (resultado.rowCount === 0) {
      throw new ErroHttp(409, "conflito", "Este convite não está mais pendente.");
    }
    await registrarAuditoria(pool, {
      viagemId,
      atorId: autenticado.usuarioId,
      acao: "convite:cancelar",
      entidade: "convite",
      entidadeId: conviteId,
    });
    return reply.status(204).send();
  });

  app.post("/convites/aceitar", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const corpo = esquemaAceitarConvite.parse(request.body);
    return emTransacao(pool, async (cliente) => {
      const { rows } = await cliente.query<{
        id: string;
        viagem_id: string;
        email_normalizado: string;
        papel: "organizador" | "participante";
        estado: string;
        expira_em: string;
      }>(
        `SELECT id, viagem_id, email_normalizado, papel, estado, expira_em::text
           FROM convites WHERE token_hash = $1 FOR UPDATE`,
        [hashToken(corpo.token)],
      );
      const convite = rows[0];
      if (!convite) throw new ErroHttp(404, "nao_encontrado", "Convite não encontrado.");
      if (convite.estado !== "pendente") {
        throw new ErroHttp(409, "conflito", "Este convite não está mais disponível.");
      }
      if (new Date(convite.expira_em).getTime() <= Date.now()) {
        await cliente.query("UPDATE convites SET estado = 'expirado' WHERE id = $1", [convite.id]);
        throw new ErroHttp(409, "conflito", "Este convite expirou; peça um novo ao organizador.");
      }
      const usuario = await cliente.query<{ email_normalizado: string }>(
        "SELECT email_normalizado FROM usuarios WHERE id = $1",
        [autenticado.usuarioId],
      );
      if (usuario.rows[0]?.email_normalizado !== convite.email_normalizado) {
        throw new ErroHttp(403, "sem_permissao", "Este convite é para outro e-mail. Entre com a conta convidada.");
      }
      await cliente.query(
        `INSERT INTO membros_viagem (viagem_id, usuario_id, papel, estado)
         VALUES ($1, $2, $3, 'ativo')
         ON CONFLICT (viagem_id, usuario_id)
         DO UPDATE SET estado = 'ativo', papel = EXCLUDED.papel, alterado_em = now()`,
        [convite.viagem_id, autenticado.usuarioId, convite.papel],
      );
      await cliente.query("UPDATE convites SET estado = 'aceito' WHERE id = $1", [convite.id]);
      await registrarAuditoria(cliente, {
        viagemId: convite.viagem_id,
        atorId: autenticado.usuarioId,
        acao: "convite:aceitar",
        entidade: "convite",
        entidadeId: convite.id,
        dados: { papel: convite.papel },
      });
      return { viagemId: convite.viagem_id, papel: convite.papel, estadoMembro: "ativo" };
    });
  });

  app.post("/viagens/:viagemId/sair", async (request, reply) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    if (contexto.contexto.papel === "organizador") {
      const outros = await pool.query<{ total: string }>(
        `SELECT count(*)::text AS total FROM membros_viagem
          WHERE viagem_id = $1 AND usuario_id <> $2 AND estado = 'ativo'`,
        [viagemId, autenticado.usuarioId],
      );
      const sugestao = Number(outros.rows[0]?.total ?? "0") > 0
        ? "Passe a organização para outra pessoa antes de sair."
        : "Você é a única pessoa ativa: cancele a viagem em vez de sair, para preservar o histórico.";
      throw new ErroHttp(409, "conflito", sugestao);
    }
    await emTransacao(pool, async (cliente) => {
      await cliente.query(
        "UPDATE membros_viagem SET estado = 'saiu', alterado_em = now() WHERE viagem_id = $1 AND usuario_id = $2",
        [viagemId, autenticado.usuarioId],
      );
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "membro:sair",
        entidade: "membro",
        entidadeId: autenticado.usuarioId,
      });
    });
    return reply.status(204).send();
  });

  app.post("/viagens/:viagemId/participantes/:usuarioId/remover", async (request, reply) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, usuarioId } = request.params as { viagemId: string; usuarioId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "viagem:participante:remover");
    if (usuarioId === autenticado.usuarioId) {
      throw new entradaInvalida("Para sair da viagem use a ação de sair (o organizador não pode se remover).");
    }
    const alvo = await carregarContexto(pool, usuarioId, viagemId);
    if (!alvo) {
      throw new ErroHttp(404, "nao_encontrado", "Esta pessoa não participa da viagem.");
    }
    await emTransacao(pool, async (cliente) => {
      await cliente.query(
        "UPDATE membros_viagem SET estado = 'removido', alterado_em = now() WHERE viagem_id = $1 AND usuario_id = $2",
        [viagemId, usuarioId],
      );
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "membro:remover",
        entidade: "membro",
        entidadeId: usuarioId,
        dados: { papelAnterior: alvo.contexto.papel },
      });
    });
    return reply.status(204).send();
  });

}
