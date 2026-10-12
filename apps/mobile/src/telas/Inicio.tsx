import { useEffect, useState } from "react";
import { api, ErroApi, type ViagemResumo } from "../services/api.ts";
import { ROTULO_ESTADO, formatarData } from "../services/formato.ts";

interface Props {
  abrirViagem: (id: string) => void;
  aceitarConvite: (token: string) => void;
}

/** Início: viagens próximas, pendências e convites pendentes (nada de tela demonstrativa). */
export function Inicio({ abrirViagem, aceitarConvite }: Props): React.ReactElement {
  const [viagens, setViagens] = useState<ViagemResumo[] | null>(null);
  const [convites, setConvites] = useState<{ id: string; viagem_nome: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [destino, setDestino] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [token, setToken] = useState("");

  async function carregar(): Promise<void> {
    setErro(null);
    try {
      const dados = await api.listarViagens();
      setViagens(dados.viagens);
      setConvites(dados.convitesPendentes);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Falha ao carregar suas viagens.");
      setViagens([]);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function criar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault();
    setErro(null);
    try {
      const criada = await api.criarViagem({
        nome,
        destino,
        dataInicio: inicio || null,
        dataFim: fim || null,
      });
      setCriando(false);
      setNome("");
      setDestino("");
      setInicio("");
      setFim("");
      abrirViagem(criada.id);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Não foi possível criar a viagem.");
    }
  }

  if (viagens === null) {
    return (
      <main className="app">
        <div className="carregando"><span className="pulso" /> Carregando suas viagens…</div>
      </main>
    );
  }

  return (
    <main className="app">
      <div className="marca">
        <span className="marca-ponto" aria-hidden="true" />
        <h1>Lia Go</h1>
      </div>

      {erro ? <div className="aviso erro" role="alert">{erro}</div> : null}

      {convites.length > 0 ? (
        <section>
          <h2>Convites pendentes</h2>
          {convites.map((convite) => (
            <div className="cartao" key={convite.id}>
              <div className="linha">
                <div>
                  <h3>{convite.viagem_nome}</h3>
                  <p>Você foi convidada(o). Entre e aceite para ver o roteiro e os gastos.</p>
                </div>
              </div>
            </div>
          ))}
          <div className="cartao">
            <label htmlFor="token-convite">Cole o link/token do convite</label>
            <input id="token-convite" value={token} onChange={(e) => setToken(e.target.value)} placeholder="token recebido do organizador" />
            <div className="acoes">
              <button className="principal" onClick={() => aceitarConvite(token.trim())} disabled={token.trim().length < 10}>
                Aceitar convite
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <div className="linha">
          <h2>Suas viagens</h2>
          <button onClick={() => setCriando(!criando)}>{criando ? "Cancelar" : "Criar viagem"}</button>
        </div>

        {criando ? (
          <form className="cartao destaque" onSubmit={criar}>
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
          </form>
        ) : null}

        {viagens.length === 0 && !criando ? (
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
