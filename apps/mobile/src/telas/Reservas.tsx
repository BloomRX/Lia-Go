/**
 * Reservas da viagem (tela 14 de `docs/UX_SCREENS.md`): hospedagem, transporte, passeio e "outro".
 *
 * Regras que esta tela **não** quebra (decisões V1 §13 e a disciplina de dinheiro do roteiro):
 *  - reserva nasce **prevista**; confirmar é ação separada e exige **evidência** (localizador, código,
 *    comprovante) — a tela nunca dá a entender que alguém falou com o hotel por nós;
 *  - cancelar exige motivo e diz, antes, que isso **não** cancela a reserva no fornecedor;
 *  - valor desconhecido aparece como "valor a verificar", nunca como `R$ 0,00`;
 *  - tudo entra na fila do aparelho: vale na hora e sobe quando houver rede.
 */
import { useMemo, useState } from "react";
import {
  ROTULO_ESTADO_RESERVA,
  ROTULO_TIPO_RESERVA,
  cancelarReserva as cancelarNoDominio,
  confirmarReserva as confirmarNoDominio,
  criarReserva as criarNoDominio,
  ordenarReservas,
  resumirReservas,
  revisarImpactoDaReserva,
  type Reserva,
  type TipoReserva,
} from "@lia-go/domain";
import type { Sincronizador } from "../offline/sincronizador.ts";
import { formatarBRL, paraCentavos } from "../services/formato.ts";
import { comoReserva } from "../services/reserva-cache.ts";
import { pode } from "../services/viagem-local.ts";

interface Props {
  viagemId: string;
  usuarioId: string;
  sincronizador: Sincronizador;
  /** Reservas da viagem aberta, como o aparelho guarda. */
  reservas: Record<string, unknown>[];
  permissoes: {
    criarReserva?: { permitido?: boolean; motivo?: string };
    confirmarReserva?: { permitido?: boolean; motivo?: string };
    cancelarReserva?: { permitido?: boolean; motivo?: string };
  };
}

function quando(inicio: string | null, fim: string | null): string {
  if (inicio === null) return "Ainda sem data";
  const formatar = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  return fim === null ? formatar(inicio) : `${formatar(inicio)} → ${formatar(fim)}`;
}

export function Reservas({ viagemId, usuarioId, sincronizador, reservas, permissoes }: Props): React.ReactElement {
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoReserva>("hospedagem");
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [inicio, setInicio] = useState("");
  const [custo, setCusto] = useState("");
  const [acao, setAcao] = useState<{ reservaId: string; tipo: "confirmar" | "cancelar" } | null>(null);
  const [textoDaAcao, setTextoDaAcao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const lista = useMemo(
    () => ordenarReservas(reservas.map((item) => comoReserva(item)).filter((item): item is Reserva => item !== null)),
    [reservas],
  );
  const resumo = useMemo(() => resumirReservas(lista), [lista]);
  const podeCriar = pode(permissoes.criarReserva);

  async function enfileirar(operacao: Parameters<Sincronizador["enfileirar"]>[0], mensagem: string): Promise<void> {
    setErro(null);
    await sincronizador.enfileirar(operacao);
    setAviso(mensagem);
  }

  async function criar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault();
    setErro(null);
    // A validação é a do domínio: as mesmas mensagens que o servidor daria, sem esperar a rede.
    let reserva: Reserva;
    try {
      reserva = criarNoDominio({
        id: crypto.randomUUID(),
        viagemId,
        autorId: usuarioId,
        tipo,
        titulo,
        local: local || null,
        inicio: inicio === "" ? null : new Date(inicio).toISOString(),
        custoCentavos: custo.trim() === "" ? null : BigInt(paraCentavos(custo)),
      });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível registrar a reserva.");
      return;
    }

    await enfileirar(
      {
        tipo: "criar_reserva",
        viagemId,
        corpo: {
          tipo: reserva.tipo,
          titulo: reserva.titulo,
          local: reserva.local,
          inicio: reserva.inicio,
          fim: null,
          custoCentavos: reserva.custoCentavos === null ? null : reserva.custoCentavos.toString(),
        },
        descricao: `Reserva: ${reserva.titulo}`,
      },
      `${reserva.titulo} entrou como prevista. Confirmar é um passo separado, com evidência.`,
    );
    setTitulo("");
    setLocal("");
    setInicio("");
    setCusto("");
    setFormularioAberto(false);
  }

  async function executarAcao(reserva: Reserva): Promise<void> {
    setErro(null);
    try {
      if (acao?.tipo === "confirmar") {
        const confirmada = confirmarNoDominio(reserva, { porId: usuarioId, confirmacao: textoDaAcao });
        await enfileirar(
          {
            tipo: "confirmar_reserva",
            viagemId,
            reservaId: reserva.id,
            confirmacao: confirmada.confirmacao as string,
            versao: reserva.versao,
            descricao: `Reserva confirmada: ${reserva.titulo}`,
          },
          `${reserva.titulo} ficou confirmada com a evidência registrada.`,
        );
      } else if (acao?.tipo === "cancelar") {
        const cancelada = cancelarNoDominio(reserva, { porId: usuarioId, motivo: textoDaAcao });
        await enfileirar(
          {
            tipo: "cancelar_reserva",
            viagemId,
            reservaId: reserva.id,
            motivo: cancelada.motivoCancelamento as string,
            versao: reserva.versao,
            descricao: `Reserva cancelada: ${reserva.titulo}`,
          },
          `${reserva.titulo} saiu do previsto. O motivo ficou no histórico.`,
        );
      }
      setAcao(null);
      setTextoDaAcao("");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível concluir a ação.");
    }
  }

  return (
    <>
      {erro ? <div className="aviso erro" role="alert">{erro}</div> : null}
      {aviso ? <div className="aviso ok" role="status">{aviso}</div> : null}

      <section className="cartao">
        <div className="linha entre">
          <h2>Reservas</h2>
          {podeCriar ? (
            <button className="principal compacto" onClick={() => setFormularioAberto((aberto) => !aberto)}>
              {formularioAberto ? "Fechar" : "Nova reserva"}
            </button>
          ) : null}
        </div>

        {lista.length === 0 ? (
          <p className="suave pequeno">Nenhuma reserva registrada. Hospedagem, transporte e passeios ficam aqui, com o valor que já foi combinado separado do que ainda é estimativa.</p>
        ) : (
          <>
            <div className="linha"><span>Previsto em reservas</span><strong>{formatarBRL(resumo.previstoCentavos)}</strong></div>
            {resumo.compromissoCentavos > 0n ? (
              <div className="linha"><span>· já combinado</span><span>{formatarBRL(resumo.compromissoCentavos)}</span></div>
            ) : null}
            {resumo.estimativaCentavos > 0n ? (
              <div className="linha"><span>· estimativa</span><span>{formatarBRL(resumo.estimativaCentavos)}</span></div>
            ) : null}
            <p><small className="suave">{resumo.resumo}{resumo.semCustoInformado > 0 ? ` · ${resumo.semCustoInformado} sem valor informado` : ""}</small></p>
          </>
        )}

        {formularioAberto ? (
          <form onSubmit={criar}>
            <div className="duas-colunas">
              <div>
                <label htmlFor="reserva-tipo">Tipo</label>
                <select id="reserva-tipo" value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoReserva)}>
                  {(Object.keys(ROTULO_TIPO_RESERVA) as TipoReserva[]).map((chave) => (
                    <option key={chave} value={chave}>{ROTULO_TIPO_RESERVA[chave]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reserva-titulo">Nome</label>
                <input id="reserva-titulo" value={titulo} onChange={(evento) => setTitulo(evento.target.value)} placeholder="Pousada da Serra" required minLength={2} />
              </div>
            </div>
            <div className="duas-colunas">
              <div>
                <label htmlFor="reserva-local">Onde</label>
                <input id="reserva-local" value={local} onChange={(evento) => setLocal(evento.target.value)} placeholder="Rua das Flores, 120" />
              </div>
              <div>
                <label htmlFor="reserva-inicio">Quando</label>
                <input id="reserva-inicio" type="datetime-local" value={inicio} onChange={(evento) => setInicio(evento.target.value)} />
              </div>
            </div>
            <label htmlFor="reserva-custo">Valor combinado ou estimado (deixe vazio se ainda não sabe)</label>
            <input id="reserva-custo" value={custo} onChange={(evento) => setCusto(evento.target.value)} placeholder="1200,00" inputMode="decimal" />
            <div className="acoes">
              <button className="principal" type="submit">Salvar reserva</button>
              <button className="sutil" type="button" onClick={() => setFormularioAberto(false)}>Cancelar</button>
            </div>
            <p className="suave pequeno">A reserva entra como <strong>prevista</strong>. Confirmar (com localizador ou comprovante) é um passo separado — o app não confirma nada sozinho.</p>
          </form>
        ) : null}
      </section>

      {lista.map((reserva) => (
        <section className="cartao" key={reserva.id}>
          <div className="linha entre">
            <h3>{reserva.titulo}</h3>
            <span className={`etiqueta estado-${reserva.estado}`}>{ROTULO_ESTADO_RESERVA[reserva.estado]}</span>
          </div>
          <div className="linha"><span>{ROTULO_TIPO_RESERVA[reserva.tipo]}</span><span className="suave">{quando(reserva.inicio, reserva.fim)}</span></div>
          {reserva.local ? <div className="linha"><span className="suave">{reserva.local}</span></div> : null}
          <div className="linha">
            <span>Valor</span>
            {reserva.custoCentavos === null ? (
              <span className="custo-a-verificar">{reserva.custoAVerificar ? "Valor a verificar" : "Sem valor informado"}</span>
            ) : (
              <strong>{formatarBRL(reserva.custoCentavos)}</strong>
            )}
          </div>
          {reserva.confirmacao ? (
            <p><small className="suave">Confirmação: “{reserva.confirmacao}”{reserva.confirmadaEm ? ` · ${new Date(reserva.confirmadaEm).toLocaleString("pt-BR")}` : ""}</small></p>
          ) : null}
          {reserva.motivoCancelamento ? <p><small className="suave">Motivo do cancelamento: {reserva.motivoCancelamento}</small></p> : null}

          {reserva.estado !== "cancelada" ? (
            <div className="acoes">
              {pode(permissoes.confirmarReserva) && reserva.estado === "prevista" ? (
                <button className="sutil" onClick={() => { setAcao({ reservaId: reserva.id, tipo: "confirmar" }); setTextoDaAcao(""); }}>
                  Confirmar reserva
                </button>
              ) : null}
              {pode(permissoes.cancelarReserva) ? (
                <button className="perigo" onClick={() => { setAcao({ reservaId: reserva.id, tipo: "cancelar" }); setTextoDaAcao(""); }}>
                  Cancelar reserva
                </button>
              ) : null}
            </div>
          ) : null}

          {acao?.reservaId === reserva.id ? (
            <div className="impacto">
              <h3>Antes de continuar: o que isso muda</h3>
              <ul>
                {revisarImpactoDaReserva(reserva, acao.tipo).itens.map((item) => (<li key={item}>{item}</li>))}
              </ul>
              {revisarImpactoDaReserva(reserva, acao.tipo).atencao.length > 0 ? (
                <>
                  <h4>Atenção</h4>
                  <ul className="impacto-atencao">
                    {revisarImpactoDaReserva(reserva, acao.tipo).atencao.map((item) => (<li key={item}>{item}</li>))}
                  </ul>
                </>
              ) : null}
              <label htmlFor={`reserva-acao-${reserva.id}`}>
                {acao.tipo === "confirmar" ? "Evidência da confirmação (código, localizador ou comprovante)" : "Motivo do cancelamento"}
              </label>
              <input
                id={`reserva-acao-${reserva.id}`}
                value={textoDaAcao}
                onChange={(evento) => setTextoDaAcao(evento.target.value)}
                placeholder={acao.tipo === "confirmar" ? "Localizador ABC123" : "Pousada fechou para reforma"}
              />
              <div className="acoes">
                <button className={acao.tipo === "confirmar" ? "principal" : "perigo"} onClick={() => void executarAcao(reserva)}>
                  {acao.tipo === "confirmar" ? "Registrar confirmação" : "Registrar cancelamento"}
                </button>
                <button className="sutil" onClick={() => setAcao(null)}>Voltar</button>
              </div>
            </div>
          ) : null}
        </section>
      ))}
    </>
  );
}
