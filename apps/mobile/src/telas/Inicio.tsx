import { useEffect, useRef, useState } from "react";
import { api, ErroApi, type ViagemResumo } from "../services/api.ts";
import { ROTULO_ESTADO, formatarData } from "../services/formato.ts";
import { useNotificacoes } from "../services/use-notificacoes.ts";
import type { Sincronizador } from "../offline/sincronizador.ts";

interface Props {
  abrirViagem: (id: string) => void;
  aceitarConvite: (token: string) => void;
  /** Necessário para a central de notificações (as marcas de leitura são por pessoa). */
  usuarioId: string;
  abrirNotificacoes: () => void;
  sincronizador: Sincronizador;
}

/**
 * Início: lista lida do **aparelho** (funciona sem sinal) e renovada pelo sincronizador.
 * Criar viagem também funciona offline: a viagem entra na fila e sobe quando houver rede.
 */
export function Inicio({ abrirViagem, aceitarConvite, usuarioId, abrirNotificacoes, sincronizador }: Props): React.ReactElement {
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

  // Mesmo cálculo da central (o domínio decide o que é notificação): o número aqui é o mesmo lá.
  const notificacoes = useNotificacoes({ sincronizador, usuarioId });

  useEffect(() => {
    void sincronizador.sincronizarAgora().catch(() => {
      /* sem rede não é erro para quem está no meio de uma viagem: o cache continua na tela */
    });
  }, [sincronizador]);

  /**
   * Enquanto esta tela estiver na frente, as tentativas de criação ainda podem terminar.
   *
   * Sem isso, o navegador não avisaria o app: `navigator.onLine` continua `true` quando *o servidor*
   * é que não responde, então nada disparava uma nova sincronização e a viagem criada só aparecia
   * quando a pessoa saísse e voltasse ao app. Foi o que a rodada de teste do usuário mostrou
   * (2026-10-16): o aviso prometia "abre assim que o servidor confirmar" e ninguém mais olhava.
   */
  const vivoRef = useRef(true);
  useEffect(() => () => { vivoRef.current = false; }, []);

  const viagens = estado.carga.viagens as unknown as ViagemResumo[];
  const convites = estado.carga.convitesParaMim as unknown as { id: string; viagem_nome: string }[];

  async function criar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault();
    setErro(null);
    setAviso(null);

    const nomeCriado = nome.trim();
    // O que já existia antes: depois do envio, a viagem nova é a que **não** estava aqui e tem o
    // nome que a pessoa acabou de digitar (a lista pode ter chegado vazia, então o nome é o que
    // identifica a viagem sem risco de abrir a errada).
    const antes = new Set(idsDasViagens());
    const operacao = {
      tipo: "criar_viagem" as const,
      corpo: { nome: nomeCriado, destino, dataInicio: inicio || null, dataFim: fim || null },
      descricao: `Viagem: ${nomeCriado}`,
    };

    try {
      await sincronizador.enfileirar(operacao);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível guardar a viagem neste aparelho.");
      return;
    }

    setCriando(false);
    setNome("");
    setDestino("");
    setInicio("");
    setFim("");

    if (!sincronizador.obter().online) {
      setAviso("Viagem guardada no aparelho. Ela vai para o servidor quando o sinal voltar.");
      return;
    }

    // O envio da fila já tenta sozinho; esperamos a confirmação para poder **abrir** a viagem criada.
    setAviso("Confirmando a viagem com o servidor…");
    await sincronizador.sincronizarAgora().catch(() => undefined);
    const nova = await esperarViagemCriada(nomeCriado, antes);
    setAviso(null);
    if (nova) {
      // Criar e cair dentro da viagem é o que a pessoa espera: o rascunho precisa dos próximos passos.
      abrirViagem(nova.id);
      return;
    }
    setAviso("A viagem ficou guardada neste aparelho. Ela abre assim que o servidor confirmar — o estado aparece na barra de sincronização acima.");
    void vigiarViagemCriada(nomeCriado, antes);
  }

  /**
   * Continua tentando depois do primeiro aviso e **abre a viagem** quando o servidor confirmar.
   *
   * É o que o aviso promete. Para quando a pessoa sai desta tela (a viagem aberta já é outra decisão
   * dela) e para sozinho depois de um minuto — aí a fila fica esperando o próximo evento de rede, e
   * a tela "Ver alterações" continua sendo o caminho manual.
   */
  async function vigiarViagemCriada(nome: string, antes: Set<string>): Promise<void> {
    const tentativas = 24;
    for (let tentativa = 0; tentativa < tentativas && vivoRef.current; tentativa += 1) {
      await new Promise((resolver) => setTimeout(resolver, 2500));
      if (!vivoRef.current) return;

      const nova = viagensDoAparelho().filter((viagem) => !antes.has(viagem.id) && viagem.nome === nome).pop();
      if (nova) {
        abrirViagem(nova.id);
        return;
      }
      if (sincronizador.obter().online) void sincronizador.sincronizarAgora().catch(() => undefined);
    }
  }

  /**
   * Procura a viagem recém-criada no que o servidor confirmou: mesma identificação (nome digitado)
   * e que **não** existia antes. Espera um pouco porque o servidor pode levar alguns instantes —
   * e, se não vier, a tela diz a verdade em vez de abrir a viagem errada.
   */
  async function esperarViagemCriada(nome: string, antes: Set<string>, limiteMs = 4000): Promise<ViagemResumo | undefined> {
    const inicio = Date.now();
    for (;;) {
      const novas = viagensDoAparelho().filter((viagem) => !antes.has(viagem.id) && viagem.nome === nome);
      if (novas.length > 0) return novas[novas.length - 1];
      if (Date.now() - inicio >= limiteMs) return undefined;
      await new Promise((resolver) => setTimeout(resolver, 100));
    }
  }

  function viagensDoAparelho(): ViagemResumo[] {
    return sincronizador.obter().carga.viagens as unknown as ViagemResumo[];
  }

  function idsDasViagens(): string[] {
    return viagensDoAparelho().map((viagem) => viagem.id);
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

      {/*
        Aviso para a central de notificações (tela 16). Fica aqui, antes das viagens, porque é onde a
        pessoa começa: o número é calculado pelo mesmo domínio que a central usa, então os dois nunca
        discordam (se discordassem, ninguém confiaria nos dois).
      */}
      <button className="cartao botao-central" onClick={abrirNotificacoes}>
        <span>
          <strong>Notificações</strong>
          <br />
          <small className="suave">{notificacoes.resumo.rotulo}</small>
        </span>
        {notificacoes.resumo.abertas > 0 ? (
          <span className="etiqueta estado-pendente">{notificacoes.resumo.abertas}</span>
        ) : null}
      </button>

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
