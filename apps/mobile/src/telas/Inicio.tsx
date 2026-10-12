import { useEffect, useState } from "react";
import { api, ErroApi, type ViagemResumo } from "../services/api.ts";
import { ROTULO_ESTADO, formatarData } from "../services/formato.ts";
import type { Sincronizador } from "../offline/sincronizador.ts";

interface Props {
  abrirViagem: (id: string) => void;
  aceitarConvite: (token: string) => void;
  sincronizador: Sincronizador;
}

/**
 * Início: lista lida do **aparelho** (funciona sem sinal) e renovada pelo sincronizador.
 * Criar viagem também funciona offline: a viagem entra na fila e sobe quando houver rede.
 */
export function Inicio({ abrirViagem, aceitarConvite, sincronizador }: Props): React.ReactElement {
  const [estado, setEstado] = useState(sincronizador.obter());
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [destino, setDestino] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => sincronizador.assinar(setEstado), [sincronizador]);

  useEffect(() => {
    void sincronizador.sincronizarAgora().catch(() => {
      /* sem rede não é erro para quem está no meio de uma viagem: o cache continua na tela */
    });
  }, [sincronizador]);

  const viagens = estado.carga.viagens as unknown as ViagemResumo[];
  const convites = estado.carga.convitesParaMim as unknown as { id: string; viagem_nome: string }[];

  async function criar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault();
    setErro(null);
    const operacao = {
      tipo: "criar_viagem" as const,
      corpo: { nome, destino, dataInicio: inicio || null, dataFim: fim || null },
      descricao: `Viagem: ${nome}`,
    };
    await sincronizador.enfileirar(operacao);
    setCriando(false);
    setNome("");
    setDestino("");
    setInicio("");
    setFim("");
    setAviso(
      estado.online
        ? "Viagem criada. Ela aparece na lista assim que o servidor confirmar."
        : "Viagem guardada no aparelho. Ela vai para o servidor quando o sinal voltar.",
    );
  }

  async function aceitar(): Promise<void> {
    setErro(null);
    try {
      await api.aceitarConvite(token.trim());
      await sincronizador.sincronizarAgora();
      setToken("");
      setAviso("Convite aceito! A viagem já aparece na sua lista.");
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Não foi possível aceitar o convite.");
    }
  }

  // A lista só "carrega" na primeira vez: depois disso o aparelho sempre tem o que mostrar.
  const primeiraCarga = viagens.length === 0 && estado.sincronizando && estado.ultimaSincronizacao === null;

  return (
    <main className="app">
      <div className="marca">
        <span className="marca-ponto" aria-hidden="true" />
        <h1>Lia Go</h1>
      </div>

      {erro ? <div className="aviso erro" role="alert">{erro}</div> : null}
      {aviso ? <div className="aviso ok">{aviso}</div> : null}

      {convites.length > 0 ? (
        <section>
          <h2>Convites pendentes</h2>
          {convites.map((convite) => (
            <div className="cartao" key={convite.id}>
              <div className="linha">
                <div>
                  <h3>{convite.viagem_nome}</h3>
                  <p>Você foi convidada(o). Cole o token abaixo para aceitar.</p>
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section>
        <div className="linha">
          <h2>Suas viagens</h2>
          <button onClick={() => setCriando(!criando)}>{criando ? "Cancelar" : "Criar viagem"}</button>
        </div>

        {criando ? (
          <form className="cartao destaque" onSubmit={(evento) => void criar(evento)}>
            <label htmlFor="nome-viagem">Nome da viagem</label>
            <input id="nome-viagem" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
            <label htmlFor="destino">Destino</label>
            <input id="destino" value={destino} onChange={(e) => setDestino(e.target.value)} />
            <label htmlFor="inicio">Início (opcional)</label>
            <input id="inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            <label htmlFor="fim">Fim (opcional)</label>
            <input id="fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            <div className="acoes">
              <button className="principal" type="submit">Salvar rascunho</button>
            </div>
            <p><small className="suave">
              Sem internet também funciona: a viagem fica guardada no aparelho e sobe sozinha quando houver sinal.
            </small></p>
          </form>
        ) : null}

        <div className="cartao">
          <label htmlFor="token-convite">Recebeu um convite? Cole o link/token</label>
          <input id="token-convite" value={token} onChange={(e) => setToken(e.target.value)} placeholder="token recebido do organizador" />
          <div className="acoes">
            <button className="principal" onClick={() => void aceitar()} disabled={token.trim().length < 10}>
              Aceitar convite
            </button>
          </div>
          <p><small className="suave">Aceitar convite precisa de internet (é o servidor que confirma o seu acesso).</small></p>
        </div>

        {primeiraCarga ? (
          <div className="carregando"><span className="pulso" /> Buscando suas viagens…</div>
        ) : null}

        {viagens.length === 0 && !criando && !primeiraCarga ? (
          <div className="cartao vazio">
            <p>Você ainda não tem viagens.</p>
            <button className="principal" onClick={() => setCriando(true)}>Criar viagem</button>
          </div>
        ) : null}

        {viagens.map((viagem) => (
          <button
            key={viagem.id}
            className="cartao"
            style={{ width: "100%", textAlign: "left", display: "block" }}
            onClick={() => abrirViagem(viagem.id)}
          >
            <div className="linha entre">
              <div>
                <h3>{viagem.nome}</h3>
                <p>
                  {viagem.destino || "sem destino definido"} · {formatarData(viagem.data_inicio)} a {formatarData(viagem.data_fim)}
                </p>
                <p>
                  <small className="suave">
                    {viagem.papel === "organizador" ? "Organizador(a)" : "Participante"}
                    {viagem.pendencias_financeiras > 0 ? ` · ${viagem.pendencias_financeiras} pendência(s) financeira(s)` : ""}
                  </small>
                </p>
              </div>
              <span className={`etiqueta estado-${viagem.estado}`}>{ROTULO_ESTADO[viagem.estado] ?? viagem.estado}</span>
            </div>
          </button>
        ))}
      </section>
    </main>
  );
}
