/**
 * Documentos da viagem (tela 16).
 *
 * A regra de privacidade é do domínio (`podeVerDocumento`) e vale **no servidor**: a rota nunca
 * devolve documento que a pessoa não pode ver — inclusive a lista já sai filtrada. Organizador vê o
 * que foi removido (com o motivo), porque remoção aqui é lógica: nada some sem explicação.
 */
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import {
  ROTULO_TIPO_DOCUMENTO,
  TIPOS_DE_DOCUMENTO,
  compartilharDocumento,
  criarDocumento,
  podeVerDocumento,
  removerDocumento,
  revisarImpactoDoDocumento,
  revogarAcesso,
  type Documento,
  type TipoDocumento,
} from "@lia-go/domain";
import type { Config } from "../config.ts";
import { emTransacao } from "../db.ts";
import { ErroHttp } from "../errors.ts";
import { comIdempotencia, exigirAutenticacao, idempotencyKey, tratarErroDeValidacao } from "../http.ts";
import { exigirContexto, exigirPermissao, exigirVersao, participantesAtivos } from "../authz.ts";
import { registrarAuditoria } from "../audit.ts";
import { carregarDocumento, documentoParaJson, gravarEventoDoDocumento, listarDocumentos } from "../planejamento-repo.ts";
import { novoId } from "../tokens.ts";

const esquemaCriarDocumento = z.object({
  tipo: z.enum(["passagem", "reserva", "seguro", "identidade", "ingresso", "outro"]),
  nome: z.string().trim().min(2).max(160),
  descricao: z.string().trim().max(1000).nullable().default(null),
  link: z.string().trim().max(500).nullable().default(null),
});

const esquemaCompartilhar = z.object({
  com: z.union([z.literal("viagem"), z.array(z.uuid()).min(1)]),
  versao: z.number().int().positive().optional(),
});

const esquemaRevogar = z.object({
  com: z.union([z.literal("viagem"), z.array(z.uuid()).min(1)]),
  versao: z.number().int().positive().optional(),
});

const esquemaRemover = z.object({ motivo: z.string().trim().min(5).max(400), versao: z.number().int().positive().optional() });

export function rotasDocumentos(app: FastifyInstance, deps: { pool: pg.Pool; config: Config }): void {
  const { pool, config } = deps;
  const http = { pool, nomeCookieSessao: config.nomeCookieSessao };

  const NAO_ENCONTRADO = "Documento não encontrado nesta viagem.";

  /**
   * Documento que a pessoa **não pode ver** é tratado como inexistente (404): assim a rota nunca
   * confirma, nem por mensagem de erro, que existe um documento privado de outra pessoa.
   */
  function exigirVisibilidade(documento: Documento, usuarioId: string, ehOrganizador: boolean): void {
    if (!podeVerDocumento(documento, usuarioId, { ehOrganizador })) throw new ErroHttp(404, "nao_encontrado", NAO_ENCONTRADO);
  }

  /** Dentro de uma transação: carrega o documento e aplica a mesma regra acima. */
  async function carregarDocumentoVisivel(
    cliente: pg.Pool | pg.PoolClient,
    viagemId: string,
    documentoId: string,
    usuarioId: string,
    ehOrganizador: boolean,
  ): Promise<Documento> {
    const documento = await carregarDocumento(cliente, viagemId, documentoId, true);
    if (!documento) throw new ErroHttp(404, "nao_encontrado", NAO_ENCONTRADO);
    exigirVisibilidade(documento, usuarioId, ehOrganizador);
    return documento;
  }

  async function exigirDocumentoVisivel(viagemId: string, documentoId: string, usuarioId: string, bloquear = false): Promise<{ documento: Documento; ehOrganizador: boolean }> {
    const contexto = await exigirContexto(pool, usuarioId, viagemId);
    const documento = await carregarDocumento(pool, viagemId, documentoId, bloquear);
    if (!documento) throw new ErroHttp(404, "nao_encontrado", NAO_ENCONTRADO);
    const ehOrganizador = contexto.contexto.papel === "organizador";
    exigirVisibilidade(documento, usuarioId, ehOrganizador);
    return { documento, ehOrganizador };
  }

  app.get("/viagens/:viagemId/documentos", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    const ehOrganizador = contexto.contexto.papel === "organizador";
    const documentos = await listarDocumentos(pool, viagemId);
    return {
      documentos: documentos
        .filter((documento) => podeVerDocumento(documento, autenticado.usuarioId, { ehOrganizador }))
        .map(documentoParaJson),
      tipos: TIPOS_DE_DOCUMENTO.map((tipo) => ({ tipo, rotulo: ROTULO_TIPO_DOCUMENTO[tipo] })),
      // A tela explica a privacidade com o mesmo texto em qualquer lugar do app.
      avisoDePrivacidade:
        "Documento começa privado: só quem criou vê. Compartilhar é um passo separado e pode ser revogado. O Lia Go guarda o link e a descrição — o arquivo continua onde você o colocou.",
    };
  });

  app.post("/viagens/:viagemId/documentos", async (request, reply) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId } = request.params as { viagemId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "documento:criar");

    let corpo: z.infer<typeof esquemaCriarDocumento>;
    try {
      corpo = esquemaCriarDocumento.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }

    const chave = idempotencyKey(request);
    const documentoId = novoId();
    const respondido = await comIdempotencia(
      pool,
      { chave, usuarioId: autenticado.usuarioId, rota: `POST /viagens/${viagemId}/documentos` },
      async () =>
        emTransacao(pool, async (cliente) => {
          const documento = criarDocumento({
            id: documentoId,
            viagemId,
            autorId: autenticado.usuarioId,
            tipo: corpo.tipo as TipoDocumento,
            nome: corpo.nome,
            descricao: corpo.descricao,
            link: corpo.link,
          });
          await cliente.query(
            `INSERT INTO documentos (id, viagem_id, autor_id, tipo, nome, descricao, link, visibilidade, compartilhado_com, estado, versao)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'privado', '{}', 'ativo', 1)`,
            [documento.id, viagemId, documento.autorId, documento.tipo, documento.nome, documento.descricao, documento.link],
          );
          await gravarEventoDoDocumento(cliente, { documentoId: documento.id, acao: "documento:criar", autorId: autenticado.usuarioId });
          await registrarAuditoria(cliente, {
            viagemId,
            atorId: autenticado.usuarioId,
            acao: "documento:criar",
            entidade: "documento",
            entidadeId: documento.id,
            dados: { tipo: documento.tipo, temLink: documento.link !== null },
          });
          return documentoParaJson(documento);
        }),
    );
    return reply.status(201).send({ documento: respondido.resultado });
  });

  app.get("/viagens/:viagemId/documentos/:documentoId/impacto", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, documentoId } = request.params as { viagemId: string; documentoId: string };
    const { documento } = await exigirDocumentoVisivel(viagemId, documentoId, autenticado.usuarioId);
    const ativos = await participantesAtivos(pool, viagemId);
    const acao = (request.query as { acao?: string }).acao === "remover" ? "remover" : "compartilhar";
    return { impacto: revisarImpactoDoDocumento(documento, acao, { participantesAtivos: ativos.length }) };
  });

  app.post("/viagens/:viagemId/documentos/:documentoId/compartilhar", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, documentoId } = request.params as { viagemId: string; documentoId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "documento:compartilhar");
    let corpo: z.infer<typeof esquemaCompartilhar>;
    try {
      corpo = esquemaCompartilhar.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }
    const ativos = await participantesAtivos(pool, viagemId);
    if (corpo.com !== "viagem") {
      const fora = corpo.com.filter((id) => !ativos.includes(id));
      if (fora.length > 0) throw new ErroHttp(400, "entrada_invalida", "Só quem participa da viagem com acesso ativo pode receber o documento.");
    }

    return emTransacao(pool, async (cliente) => {
      const atual = await carregarDocumentoVisivel(cliente, viagemId, documentoId, autenticado.usuarioId, contexto.contexto.papel === "organizador");
      if (atual.autorId !== autenticado.usuarioId && contexto.contexto.papel !== "organizador") {
        throw new ErroHttp(403, "sem_permissao", "Só quem criou o documento (ou quem organiza a viagem) compartilha o acesso.");
      }
      exigirVersao(corpo.versao, atual.versao);
      const compartilhado = compartilharDocumento(atual, { porId: autenticado.usuarioId, com: corpo.com });
      await cliente.query("UPDATE documentos SET visibilidade = $2, compartilhado_com = $3, versao = versao + 1, atualizado_em = now() WHERE id = $1", [
        documentoId,
        compartilhado.visibilidade,
        compartilhado.compartilhadoCom,
      ]);
      await gravarEventoDoDocumento(cliente, {
        documentoId,
        acao: "documento:compartilhar",
        autorId: autenticado.usuarioId,
        // `antes`/`depois` ficam no evento: é assim que quem perdeu acesso é avisado na sincronização.
        alteracoes: {
          antes: { visibilidade: atual.visibilidade, com: atual.compartilhadoCom },
          depois: { visibilidade: compartilhado.visibilidade, com: compartilhado.compartilhadoCom },
        },
      });
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "documento:compartilhar",
        entidade: "documento",
        entidadeId: documentoId,
        dados: { visibilidade: compartilhado.visibilidade, quantidade: compartilhado.compartilhadoCom.length },
      });
      return { documento: documentoParaJson({ ...compartilhado, versao: atual.versao + 1 }) };
    });
  });

  app.post("/viagens/:viagemId/documentos/:documentoId/revogar", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, documentoId } = request.params as { viagemId: string; documentoId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "documento:compartilhar");
    const corpo = esquemaRevogar.parse(request.body);

    return emTransacao(pool, async (cliente) => {
      const atual = await carregarDocumentoVisivel(cliente, viagemId, documentoId, autenticado.usuarioId, contexto.contexto.papel === "organizador");
      if (atual.autorId !== autenticado.usuarioId && contexto.contexto.papel !== "organizador") {
        throw new ErroHttp(403, "sem_permissao", "Só quem criou o documento (ou quem organiza a viagem) revoga o acesso.");
      }
      exigirVersao(corpo.versao, atual.versao);
      const revogado = revogarAcesso(atual, { com: corpo.com });
      await cliente.query("UPDATE documentos SET visibilidade = $2, compartilhado_com = $3, versao = versao + 1, atualizado_em = now() WHERE id = $1", [
        documentoId,
        revogado.visibilidade,
        revogado.compartilhadoCom,
      ]);
      await gravarEventoDoDocumento(cliente, {
        documentoId,
        acao: "documento:revogar",
        autorId: autenticado.usuarioId,
        alteracoes: {
          antes: { visibilidade: atual.visibilidade, com: atual.compartilhadoCom },
          depois: { visibilidade: revogado.visibilidade, com: revogado.compartilhadoCom },
        },
      });
      await registrarAuditoria(cliente, { viagemId, atorId: autenticado.usuarioId, acao: "documento:revogar", entidade: "documento", entidadeId: documentoId });
      return { documento: documentoParaJson({ ...revogado, versao: atual.versao + 1 }) };
    });
  });

  app.post("/viagens/:viagemId/documentos/:documentoId/remover", async (request) => {
    const autenticado = await exigirAutenticacao(request, http);
    const { viagemId, documentoId } = request.params as { viagemId: string; documentoId: string };
    const contexto = await exigirContexto(pool, autenticado.usuarioId, viagemId);
    exigirPermissao(contexto, "documento:remover");
    let corpo: z.infer<typeof esquemaRemover>;
    try {
      corpo = esquemaRemover.parse(request.body);
    } catch (erro) {
      if (erro instanceof z.ZodError) throw tratarErroDeValidacao(erro);
      throw erro;
    }

    return emTransacao(pool, async (cliente) => {
      const atual = await carregarDocumentoVisivel(cliente, viagemId, documentoId, autenticado.usuarioId, contexto.contexto.papel === "organizador");
      if (atual.autorId !== autenticado.usuarioId && contexto.contexto.papel !== "organizador") {
        throw new ErroHttp(403, "sem_permissao", "Só quem criou o documento (ou quem organiza a viagem) remove o documento.");
      }
      exigirVersao(corpo.versao, atual.versao);
      const removido = removerDocumento(atual, { porId: autenticado.usuarioId, motivo: corpo.motivo });
      await cliente.query(
        `UPDATE documentos SET estado = 'removido', removido_por = $2, removido_em = now(), motivo_remocao = $3,
                               visibilidade = 'privado', compartilhado_com = '{}', versao = versao + 1, atualizado_em = now()
          WHERE id = $1`,
        [documentoId, autenticado.usuarioId, removido.motivoRemocao],
      );
      await gravarEventoDoDocumento(cliente, {
        documentoId,
        acao: "documento:remover",
        autorId: autenticado.usuarioId,
        motivo: removido.motivoRemocao,
        alteracoes: {
          antes: { visibilidade: atual.visibilidade, com: atual.compartilhadoCom },
          depois: { visibilidade: "privado", com: [] },
        },
      });
      await registrarAuditoria(cliente, {
        viagemId,
        atorId: autenticado.usuarioId,
        acao: "documento:remover",
        entidade: "documento",
        entidadeId: documentoId,
        motivo: removido.motivoRemocao,
      });
      return { documento: documentoParaJson({ ...removido, versao: atual.versao + 1 }) };
    });
  });
}
