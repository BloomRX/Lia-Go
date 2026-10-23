/**
 * Documentos da viagem (tela 15).
 *
 * Regras que esta tela respeita (decisões V1 §13 e `packages/domain/src/documento.ts`):
 *  - documento **nasce privado**: só quem criou vê, e ninguém — nem quem organiza — vê o conteúdo
 *    antes de um compartilhamento explícito (o servidor responde 404 para quem não pode ver);
 *  - compartilhar e remover são passos separados, com **revisão de impacto antes**;
 *  - remover exige motivo e a tela diz que nada é apagado em definitivo;
 *  - o app guarda **link e descrição**; o arquivo continua onde a pessoa o colocou — a tela nunca
 *    dá a entender que o Lia Go copiou, enviou ou guardou o arquivo.
 */
import { useMemo, useState } from "react";
import {
  ROTULO_TIPO_DOCUMENTO,
  TIPOS_DE_DOCUMENTO,
  podeVerDocumento,
  resumirDocumentos,
  type Documento,
  type TipoDocumento,
} from "@lia-go/domain";
import { api, ErroApi } from "../services/api.ts";
import type { Sincronizador } from "../offline/sincronizador.ts";

interface Props {
  viagemId: string;
  usuarioId: string;
  sincronizador: Sincronizador;
  documentos: Documento[];
  participantes: { usuario_id: string; nome: string; estado: string }[];
  ehOrganizador: boolean;
  avisoDePrivacidade: string | null;
}

/** Chave de idempotência da criação (reenvio nunca duplica o documento). */
function idDeOperacao(): string {
  const gerador = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return gerador?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function Documentos({ viagemId, usuarioId, sincronizador, documentos, participantes, ehOrganizador, avisoDePrivacidade }: Props): React.ReactElement {
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoDocumento>("passagem");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [link, setLink] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [acao, setAcao] = useState<{ documento: Documento; tipo: "compartilhar" | "remover" } | null>(null);
  const [impacto, setImpacto] = useState<{ itens: string[]; atencao: string[] } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [escolhidos, setEscolhidos] = useState<string[]>([]);

  const lista = useMemo(
    () =>
      documentos
        .filter((documento) => podeVerDocumento(documento, usuarioId, { ehOrganizador }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [documentos, usuarioId, ehOrganizador],
  );
  const resumo = useMemo(() => resumirDocumentos(documentos), [documentos]);
  const pessoas = useMemo(() => participantes.filter((pessoa) => pessoa.estado === "ativo" && pessoa.usuario_id !== usuarioId), [participantes, usuarioId]);

  function nomeDe(usuarioId: string): string {
    return participantes.find((pessoa) => pessoa.usuario_id === usuarioId)?.nome ?? "participante";
  }

  async function recarregar(): Promise<void> {
    await sincronizador.sincronizarAgora();
  }

  async function criar(): Promise<void> {
    setErro(null);
    setAviso(null);
    try {
      await api.criarDocumento(
        viagemId,
        { tipo, nome, descricao: descricao.trim() === "" ? null : descricao, link: link.trim() === "" ? null : link },
        idDeOperacao(),
      );
      setAviso("Documento guardado como privado. Só você vê até compartilhar.");
      setNome("");
      setDescricao("");
      setLink("");
      setTipo("passagem");
      setFormularioAberto(false);
      await recarregar();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Não foi possível salvar o documento agora.");
    }
  }

  async function abrirAcao(documento: Documento, tipoDaAcao: "compartilhar" | "remover"): Promise<void> {
    setErro(null);
    setAviso(null);
    setAcao({ documento, tipo: tipoDaAcao });
    setImpacto(null);
    setMotivo("");
    setEscolhidos([]);
    try {
      const resposta = await api.impactoDocumento(viagemId, documento.id, tipoDaAcao);
      setImpacto(resposta.impacto);
    } catch {
      setImpacto(null);
    }
  }

  async function confirmarAcao(): Promise<void> {
    if (!acao) return;
    setErro(null);
    try {
      if (acao.tipo === "compartilhar") {
        const com = escolhidos.length === 0 ? "viagem" : escolhidos;
        await api.compartilharDocumento(viagemId, acao.documento.id, com, acao.documento.versao);
        setAviso(
          com === "viagem"
            ? "Compartilhado com a viagem: todo mundo com acesso ativo vê o link e a descrição."
            : `Compartilhado com ${escolhidos.map(nomeDe).join(", ")}. Dá para revogar quando quiser.`,
        );
      } else {
        await api.removerDocumento(viagemId, acao.documento.id, motivo, acao.documento.versao);
        setAviso("Documento removido da lista. O registro e o motivo continuam guardados com quem organiza.");
      }
      setAcao(null);
      await recarregar();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Não foi possível concluir a ação agora.");
    }
  }

  async function revogar(documento: Documento): Promise<void> {
    setErro(null);
    try {
      await api.revogarDocumento(viagemId, documento.id, "viagem", documento.versao);
      setAviso("Acesso revogado: o documento voltou a ser só seu.");
      await recarregar();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Não foi possível revogar o acesso agora.");
    }
  }

  return (
    <section className="cartao" aria-labelledby="titulo-documentos">
      <div className="linha entre">
        <h2 id="titulo-documentos">Documentos</h2>
        <button className="sutil" onClick={() => setFormularioAberto((aberto) => !aberto)}>
          {formularioAberto ? "Fechar" : "Novo documento"}
        </button>
      </div>
      <p className="suave pequeno">
        {avisoDePrivacidade ??
          "Documento começa privado: só quem criou vê. Compartilhar é um passo separado e pode ser revogado."}
      </p>
      <p className="suave pequeno">{resumo.resumo}</p>

      {formularioAberto ? (
        <>
          <label htmlFor="documento-tipo">Tipo</label>
          <select id="documento-tipo" value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoDocumento)}>
            {TIPOS_DE_DOCUMENTO.map((valor) => (
              <option key={valor} value={valor}>
                {ROTULO_TIPO_DOCUMENTO[valor]}
              </option>
            ))}
          </select>
          <label htmlFor="documento-nome">Nome</label>
          <input id="documento-nome" value={nome} onChange={(evento) => setNome(evento.target.value)} placeholder="Ex.: Voo GRU–LIS" />
          <label htmlFor="documento-descricao">Descrição (opcional)</label>
          <input
            id="documento-descricao"
            value={descricao}
            onChange={(evento) => setDescricao(evento.target.value)}
            placeholder="Ex.: localizador ABC123, saída 22h"
          />
          <label htmlFor="documento-link">Link (opcional)</label>
          <input
            id="documento-link"
            value={link}
            onChange={(evento) => setLink(evento.target.value)}
            placeholder="https://…"
            inputMode="url"
          />
          <p className="suave pequeno">
            O Lia Go guarda o link e a descrição — o arquivo continua onde você o colocou. Nada de binário é copiado
            para cá.
          </p>
          <div className="acoes">
            <button className="principal" disabled={nome.trim().length < 2} onClick={() => void criar()}>
              Salvar como privado
            </button>
          </div>
        </>
      ) : null}

      {lista.length === 0 ? (
        <p>Nenhum documento ainda. Passagens, seguros e ingressos ficam aqui — privados até você compartilhar.</p>
      ) : (
        <ul className="lista-documentos">
          {lista.map((documento) => {
            const removido = documento.estado === "removido";
            const soVisualizacao = documento.autorId !== usuarioId && !ehOrganizador;
            const compartilhado = documento.visibilidade === "viagem" || documento.compartilhadoCom.length > 0;
            return (
              <li key={documento.id} className={removido ? "item-removido" : undefined}>
                <div className="linha entre">
                  <span>
                    <strong>{documento.nome}</strong>
                    <br />
                    <small className="suave">
                      {ROTULO_TIPO_DOCUMENTO[documento.tipo]} · {nomeDe(documento.autorId)}
                      {documento.descricao ? ` · ${documento.descricao}` : ""}
                    </small>
                  </span>
                  <span className={`etiqueta ${removido ? "estado-cancelada" : compartilhado ? "estado-em_andamento" : "estado-rascunho"}`}>
                    {removido ? "Removido" : compartilhado ? "Compartilhado" : "Só você"}
                  </span>
                </div>

                {documento.link ? (
                  <p>
                    {/* Link abre em nova aba: a pessoa sai do app por conta própria, com aviso claro. */}
                    <a href={documento.link} target="_blank" rel="noreferrer noopener">
                      Abrir link
                    </a>{" "}
                    <small className="suave">(abre fora do Lia Go)</small>
                  </p>
                ) : (
                  <p className="suave pequeno">Sem link: só a descrição.</p>
                )}

                {removido ? (
                  <p className="suave pequeno">Removido: {documento.motivoRemocao}</p>
                ) : soVisualizacao ? (
                  <p className="suave pequeno">Compartilhado com você — só quem criou muda isto.</p>
                ) : (
                  <div className="acoes">
                    {documento.autorId === usuarioId || ehOrganizador ? (
                      <>
                        {!compartilhado ? (
                          <button className="sutil" onClick={() => void abrirAcao(documento, "compartilhar")}>
                            Compartilhar
                          </button>
                        ) : (
                          <button className="sutil" onClick={() => void revogar(documento)}>
                            Revogar acesso
                          </button>
                        )}
                        <button className="perigo" onClick={() => void abrirAcao(documento, "remover")}>
                          Remover
                        </button>
                      </>
                    ) : null}
                  </div>
                )}

                {acao?.documento.id === documento.id ? (
                  <div className="cartao impacto">
                    <h3>{acao.tipo === "compartilhar" ? "Antes de compartilhar" : "Antes de remover"}</h3>
                    {impacto ? (
                      <>
                        <ul>
                          {impacto.itens.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                        {impacto.atencao.length > 0 ? (
                          <div className="aviso atencao">
                            {impacto.atencao.map((item) => (
                              <p key={item}>{item}</p>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="suave pequeno">Não foi possível carregar os detalhes agora — sem rede, esta ação espera.</p>
                    )}

                    {acao.tipo === "compartilhar" ? (
                      <>
                        <label htmlFor={`documento-pessoas-${documento.id}`}>Com quem (deixe vazio para a viagem toda)</label>
                        <select
                          id={`documento-pessoas-${documento.id}`}
                          multiple
                          value={escolhidos}
                          onChange={(evento) => setEscolhidos(Array.from(evento.target.selectedOptions).map((opcao) => opcao.value))}
                        >
                          {pessoas.map((pessoa) => (
                            <option key={pessoa.usuario_id} value={pessoa.usuario_id}>
                              {pessoa.nome}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <>
                        <label htmlFor={`documento-motivo-${documento.id}`}>Motivo da remoção (mínimo 5 caracteres)</label>
                        <input
                          id={`documento-motivo-${documento.id}`}
                          value={motivo}
                          onChange={(evento) => setMotivo(evento.target.value)}
                          placeholder="Ex.: passagem cancelada e reembolsada"
                        />
                      </>
                    )}

                    <div className="acoes">
                      <button
                        className={acao.tipo === "remover" ? "perigo" : "principal"}
                        disabled={acao.tipo === "remover" && motivo.trim().length < 5}
                        onClick={() => void confirmarAcao()}
                      >
                        {acao.tipo === "compartilhar" ? "Confirmar compartilhamento" : "Confirmar remoção"}
                      </button>
                      <button className="sutil" onClick={() => setAcao(null)}>
                        Voltar atrás
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {aviso ? <div className="aviso ok">{aviso}</div> : null}
      {erro ? <div className="aviso erro">{erro}</div> : null}
    </section>
  );
}
