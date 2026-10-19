/**
 * Central de notificações (tela 16 de `docs/UX_SCREENS.md`).
 *
 * O que a tela promete (e o domínio garante em `notificacao.ts`):
 *  - cada item aponta para um **fato** e leva para o lugar onde ele se resolve;
 *  - **ler** é "eu vi" (o item continua aberto), **dispensar** tira da frente e volta se o fato
 *    mudar, e **resolver** não tem botão: acontece quando o dado deixa de ter a obrigação. A tela
 *    nunca diz que algo foi resolvido porque alguém clicou;
 *  - prioridade aparece **em texto**, nunca só por cor (§10);
 *  - nada de ação externa: todo botão leva para uma tela do próprio app.
 *
 * Alcance: a central mostra o que o aparelho tem — lista de viagens, convites recebidos e os dados
 * da **viagem aberta** (checklist, reservas, acertos e orçamento dela). Isso está escrito na tela,
 * para ninguém achar que ela viu o que não viu.
 */
import { useEffect, useMemo, useState } from "react";
import {
  CATEGORIAS_NOTIFICACAO,
  FILTROS_DE_ESTADO,
  PRIORIDADES_NOTIFICACAO,
  ROTULO_CATEGORIA_NOTIFICACAO,
  ROTULO_PRIORIDADE_NOTIFICACAO,
  filtrarNotificacoes,
  type CategoriaNotificacao,
  type DestinoNotificacao,
  type FiltroDeEstado,
  type FiltrosDeNotificacao,
  type Notificacao,
  type NotificacaoComEstado,
  type OrcamentoParaNotificar,
  type PrioridadeNotificacao,
} from "@lia-go/domain";
import { api } from "../services/api.ts";
import { alcanceDaCentral } from "../services/notificacoes-locais.ts";
import { useNotificacoes } from "../services/use-notificacoes.ts";
import type { Sincronizador } from "../offline/sincronizador.ts";

/** Aba da viagem que abre cada destino da notificação (§6: as abas são as mesmas do app). */
export type AbaDaViagem = "visao" | "roteiro" | "gastos" | "mais";

export function abaDoDestino(destino: DestinoNotificacao): AbaDaViagem {
  switch (destino) {
    case "roteiro":
      return "roteiro";
    case "gastos":
    case "orcamento":
      return "gastos";
    case "checklist":
    case "reservas":
    case "documentos":
    case "participantes":
      return "mais";
    default:
      return "visao";
  }
}

/** Filtro de estado da tela: os quatro do domínio mais o histórico de resolvidas. */
type FiltroDaTela = FiltroDeEstado | "resolvidas";

const FILTROS_DA_TELA: readonly { valor: FiltroDaTela; rotulo: string }[] = [
  ...FILTROS_DE_ESTADO,
  { valor: "resolvidas", rotulo: "Resolvidas" },
];

interface Props {
  usuarioId: string;
  sincronizador: Sincronizador;
  /** Aberta a partir de uma viagem: começa filtrada por ela. */
  viagemIdInicial?: string | null;
  /** Leva para a viagem, já na aba certa para o que a notificação pede. */
  abrirViagem: (viagemId: string, aba: AbaDaViagem) => void;
  voltar: () => void;
}

export function Notificacoes({ usuarioId, sincronizador, viagemIdInicial = null, abrirViagem, voltar }: Props): React.ReactElement {
  const [orcamento, setOrcamento] = useState<OrcamentoParaNotificar | null>(null);
  const [filtros, setFiltros] = useState<FiltrosDeNotificacao>({ viagemId: viagemIdInicial });
  const [filtroEstado, setFiltroEstado] = useState<FiltroDaTela>("abertas");

  // A viagem aberta pode mudar enquanto a central está na tela (a pessoa abre outra viagem).
  const [viagemAbertaId, setViagemAbertaId] = useState(sincronizador.obter().viagemAtiva);
  useEffect(
    () => sincronizador.assinar((atual) => setViagemAbertaId(atual.viagemAtiva)),
    [sincronizador],
  );

  /**
   * Orçamento: o limite e o gasto oficial são do servidor. Sem resposta, a central fica **sem** o
   * aviso de orçamento em vez de inventar um limite (nunca mostrar número que não temos).
   */
  useEffect(() => {
    let vivo = true;
    if (!viagemAbertaId) {
      setOrcamento(null);
      return () => {
        vivo = false;
      };
    }
    void api
      .orcamento(viagemAbertaId)
      .then((resposta) => {
        if (!vivo) return;
        setOrcamento({
          estado: resposta.situacao.estado,
          limiteCentavos: resposta.situacao.limiteCentavos === null ? null : BigInt(resposta.situacao.limiteCentavos),
          percentualPrevisto: resposta.situacao.percentualPrevisto,
          percentualGasto: resposta.situacao.percentualGasto,
        });
      })
      .catch(() => {
        if (vivo) setOrcamento(null);
      });
    return () => {
      vivo = false;
    };
  }, [viagemAbertaId]);

  const { estado, comEstado, resolvidas, resumo, viagens, erro, marcar, desmarcar, marcarTodasComoLidas } =
    useNotificacoes({ sincronizador, usuarioId, orcamento });

  const visiveis = useMemo(() => {
    if (filtroEstado === "resolvidas") return [];
    return filtrarNotificacoes(comEstado, { ...filtros, estado: filtroEstado });
  }, [comEstado, filtros, filtroEstado]);

  const historico = useMemo(() => {
    if (filtroEstado !== "resolvidas") return [];
    const busca = (filtros.busca ?? "").trim().toLowerCase();
    return resolvidas.filter((item) => {
      if (filtros.viagemId && item.viagemId !== filtros.viagemId) return false;
      if (filtros.categoria && item.categoria !== filtros.categoria) return false;
      if (filtros.prioridade && item.prioridade !== filtros.prioridade) return false;
      if (busca && !`${item.titulo} ${item.viagemNome ?? ""}`.toLowerCase().includes(busca)) return false;
      return true;
    });
  }, [filtroEstado, filtros, resolvidas]);

  function limparFiltros(): void {
    setFiltros({ viagemId: viagemIdInicial });
    setFiltroEstado("abertas");
  }

  const temFiltroAtivo =
    Boolean(filtros.viagemId) ||
    Boolean(filtros.categoria) ||
    Boolean(filtros.prioridade) ||
    filtros.soMinhas === true ||
    Boolean(filtros.busca) ||
    filtroEstado !== "abertas";

  const minhas = comEstado.filter((notificacao) => notificacao.estado === "nova").length;

  return (
    <main className="app">
      <section className="cartao" aria-labelledby="titulo-notificacoes">
      <div className="linha entre">
        <h2 id="titulo-notificacoes">Notificações</h2>
        <button className="sutil" onClick={voltar}>Voltar</button>
      </div>
      <p className="suave pequeno" role="status">{resumo.rotulo}</p>

      {erro ? <div className="aviso erro" role="alert">{erro}</div> : null}

      <div className="filtros">
        <div>
          <label htmlFor="filtro-estado">Situação</label>
          <select
            id="filtro-estado"
            value={filtroEstado}
            onChange={(evento) => setFiltroEstado(evento.target.value as FiltroDaTela)}
          >
            {FILTROS_DA_TELA.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>
            ))}
          </select>
        </div>

        {viagens.length > 1 ? (
          <div>
            <label htmlFor="filtro-viagem">Viagem</label>
            <select
              id="filtro-viagem"
              value={filtros.viagemId ?? ""}
              onChange={(evento) => setFiltros((atual) => ({ ...atual, viagemId: evento.target.value === "" ? null : evento.target.value }))}
            >
              <option value="">todas as viagens</option>
              {viagens.map((viagem) => (
                <option key={viagem.id} value={viagem.id}>{viagem.nome}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor="filtro-categoria">Assunto</label>
          <select
            id="filtro-categoria"
            value={filtros.categoria ?? ""}
            onChange={(evento) =>
              setFiltros((atual) => ({ ...atual, categoria: (evento.target.value || null) as CategoriaNotificacao | null }))
            }
          >
            <option value="">todos os assuntos</option>
            {CATEGORIAS_NOTIFICACAO.map((categoria) => (
              <option key={categoria} value={categoria}>{ROTULO_CATEGORIA_NOTIFICACAO[categoria]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filtro-prioridade">Prioridade</label>
          <select
            id="filtro-prioridade"
            value={filtros.prioridade ?? ""}
            onChange={(evento) =>
              setFiltros((atual) => ({ ...atual, prioridade: (evento.target.value || null) as PrioridadeNotificacao | null }))
            }
          >
            <option value="">todas as prioridades</option>
            {PRIORIDADES_NOTIFICACAO.map((prioridade) => (
              <option key={prioridade} value={prioridade}>{ROTULO_PRIORIDADE_NOTIFICACAO[prioridade]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filtro-busca">Buscar</label>
          <input
            id="filtro-busca"
            type="search"
            value={filtros.busca ?? ""}
            placeholder="palavra da notificação"
            onChange={(evento) => setFiltros((atual) => ({ ...atual, busca: evento.target.value }))}
          />
        </div>
      </div>

      <label className="linha filtro-minhas">
        <input
          type="checkbox"
          checked={filtros.soMinhas === true}
          onChange={(evento) => setFiltros((atual) => ({ ...atual, soMinhas: evento.target.checked }))}
        />
        <span>só o que depende de mim</span>
      </label>

      <div className="acoes">
        <button className="sutil" onClick={marcarTodasComoLidas} disabled={minhas === 0}>
          Marcar todas como lidas{minhas > 0 ? ` (${minhas})` : ""}
        </button>
        <button className="sutil" onClick={limparFiltros} disabled={!temFiltroAtivo}>Limpar filtros</button>
      </div>

      {filtroEstado === "resolvidas" ? (
        historico.length === 0 ? (
          <p className="vazio">
            Nada resolvido por aqui ainda. Quando a obrigação deixar de existir nos dados — despesa confirmada,
            convite aceito, item concluído —, ela sai da lista e o registro fica aqui.
          </p>
        ) : (
          <ul className="lista-notificacoes">
            {historico.map((item) => (
              <li key={item.chave} className="item-resolvida">
                <div className="linha entre">
                  <span>
                    <strong>{item.titulo}</strong>
                    <br />
                    <small className="suave">
                      Resolvida nos dados · {ROTULO_CATEGORIA_NOTIFICACAO[item.categoria]}
                      {item.viagemNome ? ` · ${item.viagemNome}` : ""}
                    </small>
                  </span>
                  <span className="etiqueta estado-concluida">Resolvida</span>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : visiveis.length === 0 ? (
        <p className="vazio">
          {temFiltroAtivo
            ? "Nada com esse filtro. Limpe os filtros para ver tudo o que está aberto."
            : "Nada pendente por aqui. A central só mostra o que precisa de alguém — nada de aviso de rotina."}
        </p>
      ) : (
        <ul className="lista-notificacoes">
          {visiveis.map((notificacao) => (
            <CartaoDeNotificacao
              key={notificacao.chave}
              notificacao={notificacao}
              aoAbrir={() => {
                if (!notificacao.viagemId) return;
                abrirViagem(notificacao.viagemId, abaDoDestino(notificacao.destino));
              }}
              aoMarcarLida={() => marcar(notificacao, "lida")}
              aoMarcarNaoLida={() => desmarcar(notificacao.chave)}
              aoDispensar={() => marcar(notificacao, "dispensada")}
            />
          ))}
        </ul>
      )}

      <p className="suave pequeno">{alcanceDaCentral(estado)}</p>
      </section>
    </main>
  );
}

interface PropsCartao {
  notificacao: NotificacaoComEstado;
  aoAbrir: () => void;
  aoMarcarLida: () => void;
  aoMarcarNaoLida: () => void;
  aoDispensar: () => void;
}

function CartaoDeNotificacao({ notificacao, aoAbrir, aoMarcarLida, aoMarcarNaoLida, aoDispensar }: PropsCartao): React.ReactElement {
  const dispensada = notificacao.estado === "dispensada";
  const naoLida = notificacao.estado === "nova";
  const classes = [
    notificacao.prioridade === "alta" ? "prioridade-alta" : "",
    dispensada ? "item-dispensada" : "",
  ].filter(Boolean).join(" ");

  return (
    <li className={classes || undefined}>
      <div className="linha entre">
        <span>
          <strong>{notificacao.titulo}</strong>
          <br />
          <small className="suave">
            {ROTULO_CATEGORIA_NOTIFICACAO[notificacao.categoria]}
            {notificacao.viagemNome ? ` · ${notificacao.viagemNome}` : ""}
            {notificacao.desde ? ` · desde ${notificacao.desde.split("-").reverse().join("/")}` : ""}
            {naoLida ? " · não lida" : notificacao.estado === "lida" ? " · lida" : ""}
          </small>
        </span>
        <span className={`etiqueta prioridade-${notificacao.prioridade}`}>{ROTULO_PRIORIDADE_NOTIFICACAO[notificacao.prioridade]}</span>
      </div>

      <p>{notificacao.detalhe}</p>

      <div className="acoes">
        {notificacao.viagemId ? (
          <button className="principal" onClick={aoAbrir}>{notificacao.acao}</button>
        ) : null}
        {/* Dispensada tem um botão só: "trazer de volta" já é o contrário de dispensar. */}
        {dispensada ? (
          <button className="sutil" onClick={aoMarcarNaoLida}>Trazer de volta</button>
        ) : (
          <>
            {naoLida ? (
              <button className="sutil" onClick={aoMarcarLida}>Marcar como lida</button>
            ) : (
              <button className="sutil" onClick={aoMarcarNaoLida}>Marcar como não lida</button>
            )}
            <button className="sutil" onClick={aoDispensar}>Dispensar</button>
          </>
        )}
      </div>
    </li>
  );
}
