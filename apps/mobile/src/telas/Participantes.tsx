/**
 * Participantes, convites e permissões (telas 4 e 17).
 *
 * Regras que esta seção garante:
 *  - o servidor decide quem pode convidar, cancelar convite ou remover participante;
 *  - remover participante ou sair da viagem mostra antes as consequências (despesas e partes de
 *    rateio anteriores continuam registradas para não distorcer os saldos do grupo);
 *  - quem é organizador único não sai deixando a viagem órfã (cancela a viagem em vez disso).
 */
import { useState } from "react";
import { consequenciasDeSaida } from "@lia-go/domain";
import { api, ErroApi } from "../services/api.ts";
import type { Sincronizador } from "../offline/sincronizador.ts";

export interface ParticipanteItem {
  usuario_id: string;
  nome: string;
  papel: string;
  estado: string;
}

export interface ConviteItem {
  id: string;
  email: string;
  papel?: string;
  estado?: string;
}

interface Props {
  viagemId: string;
  usuarioId: string;
  ehOrganizador: boolean;
  participantes: readonly ParticipanteItem[];
  convites: readonly ConviteItem[];
  sincronizador: Sincronizador;
  aoSairDaViagem: () => void;
}

export function Participantes({
  viagemId,
  usuarioId,
  ehOrganizador,
  participantes,
  convites,
  sincronizador,
  aoSairDaViagem,
}: Props): React.ReactElement {
  const [confirmandoRemover, setConfirmandoRemover] = useState<ParticipanteItem | null>(null);
  const [confirmandoSair, setConfirmandoSair] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const convitesPendentes = convites.filter((c) => !c.estado || c.estado === "pendente");

  async function cancelarConvite(conviteId: string, email: string): Promise<void> {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      await api.cancelarConvite(viagemId, conviteId);
      await sincronizador.sincronizarAgora();
      setAviso(`Convite para ${email} cancelado.`);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Precisa de conexão para cancelar o convite no servidor.");
    } finally {
      setOcupado(false);
    }
  }

  async function remover(pessoa: ParticipanteItem): Promise<void> {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      await api.removerParticipante(viagemId, pessoa.usuario_id);
      setConfirmandoRemover(null);
      await sincronizador.sincronizarAgora();
      setAviso(`${pessoa.nome} foi removido(a) da viagem. Os registros financeiros anteriores continuam preservados.`);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Precisa de conexão para remover participante no servidor.");
    } finally {
      setOcupado(false);
    }
  }

  async function sair(): Promise<void> {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      await api.sairDaViagem(viagemId);
      setConfirmandoSair(false);
      aoSairDaViagem();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Precisa de conexão para sair da viagem.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="cartao" aria-labelledby="titulo-participantes-gestao">
      <h2 id="titulo-participantes-gestao">Participantes e permissões</h2>
      <p className="suave pequeno">
        Quem organiza gerencia convites, membros, limite do grupo e cancelamento. Todos os participantes ativos podem
        lançar gastos, confirmar lançamentos de outras pessoas e editar o roteiro.
      </p>

      {participantes.map((pessoa) => {
        const souEu = pessoa.usuario_id === usuarioId;
        const podeRemover = ehOrganizador && !souEu && pessoa.estado === "ativo";
        return (
          <div className="linha entre" key={pessoa.usuario_id} style={{ marginBottom: 8 }}>
            <span>
              {pessoa.nome} {souEu ? "(você)" : ""}
            </span>
            <div className="acoes" style={{ marginTop: 0 }}>
              <span className="etiqueta">
                {pessoa.papel === "organizador" ? "organizador" : "participante"}
                {pessoa.estado !== "ativo" ? ` · ${pessoa.estado}` : ""}
              </span>
              {podeRemover ? (
                <button
                  type="button"
                  className="sutil compacto"
                  disabled={ocupado}
                  onClick={() => setConfirmandoRemover(pessoa)}
                >
                  Remover
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      {confirmandoRemover ? (
        <div className="aviso atencao" style={{ marginTop: 8 }}>
          <p>
            <strong>Remover {confirmandoRemover.nome} da viagem?</strong>
          </p>
          <ul>
            {consequenciasDeSaida().map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="acoes">
            <button
              type="button"
              className="perigo"
              disabled={ocupado}
              onClick={() => void remover(confirmandoRemover)}
            >
              Confirmar remoção
            </button>
            <button type="button" className="sutil" onClick={() => setConfirmandoRemover(null)}>
              Voltar
            </button>
          </div>
        </div>
      ) : null}

      {ehOrganizador && convitesPendentes.length > 0 ? (
        <>
          <h3 style={{ marginTop: 12 }}>Convites pendentes</h3>
          {convitesPendentes.map((convite) => (
            <div className="linha entre" key={convite.id} style={{ marginBottom: 6 }}>
              <span>{convite.email}</span>
              <button
                type="button"
                className="sutil compacto"
                disabled={ocupado}
                onClick={() => void cancelarConvite(convite.id, convite.email)}
              >
                Cancelar convite
              </button>
            </div>
          ))}
        </>
      ) : null}

      {!ehOrganizador ? (
        <div style={{ marginTop: 12 }}>
          {!confirmandoSair ? (
            <div className="acoes">
              <button type="button" className="sutil" onClick={() => setConfirmandoSair(true)}>
                Sair desta viagem
              </button>
            </div>
          ) : (
            <div className="aviso atencao">
              <p>
                <strong>Sair desta viagem?</strong>
              </p>
              <ul>
                {consequenciasDeSaida().map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="acoes">
                <button type="button" className="perigo" disabled={ocupado} onClick={() => void sair()}>
                  Confirmar saída
                </button>
                <button type="button" className="sutil" onClick={() => setConfirmandoSair(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {aviso ? <div className="aviso ok">{aviso}</div> : null}
      {erro ? <div className="aviso erro">{erro}</div> : null}
    </section>
  );
}
