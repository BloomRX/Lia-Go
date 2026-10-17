import { useEffect, useRef, useState } from "react";
import { Entrar } from "./telas/Entrar.tsx";
import { Inicio } from "./telas/Inicio.tsx";
import { Notificacoes, type AbaDaViagem } from "./telas/Notificacoes.tsx";
import { Viagem } from "./telas/Viagem.tsx";
import { Atividade } from "./telas/Atividade.tsx";
import { api, ErroApi, type Usuario } from "./services/api.ts";
import { Sincronizador, type EstadoSincronizacao } from "./offline/sincronizador.ts";
import { limparSaidaPendente, marcarSaidaPendente, saidaPendente } from "./services/sessao-local.ts";
import { BarraSincronizacao } from "./componentes/BarraSincronizacao.tsx";

type Tela =
  | { nome: "inicio" }
  // A central de notificações é uma tela própria (tela 16): aberta do Início ou de dentro de uma
  // viagem, e sempre sabendo para onde voltar.
  | { nome: "notificacoes"; viagemId: string | null }
  | { nome: "viagem"; viagemId: string; aba?: AbaDaViagem; voltarPara?: "inicio" | "notificacoes" }
  // A atividade abre em tela própria (diretriz §2.1), e o roteiro continua atrás dela.
  | { nome: "atividade"; viagemId: string; atividadeId: string };

/**
 * O app inteiro trabalha sobre o sincronizador: a tela lê do aparelho e escreve na fila,
 * então usar com ou sem internet é o mesmo caminho de código.
 */
export function App(): React.ReactElement {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [tela, setTela] = useState<Tela>({ nome: "inicio" });
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [sincronizador, setSincronizador] = useState<Sincronizador | null>(null);
  const [estado, setEstado] = useState<EstadoSincronizacao | null>(null);
  const recarregarAoVoltar = useRef(false);

  // Um sincronizador por sessão: ele carrega a fila e o cache que ficaram no aparelho.
  useEffect(() => {
    let vivo = true;
    void Sincronizador.criar().then((criado) => {
      if (!vivo) return;
      setSincronizador(criado);
      setEstado(criado.obter());
    });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!sincronizador) return;
    const cancelar = sincronizador.assinar(setEstado);

    // Rede voltou/caiu: a barra diz a verdade e o envio recomeça sozinho.
    const aoMudarRede = () => sincronizador.definirOnline(navigator.onLine !== false);
    /**
     * O app voltou para a frente (a pessoa trocou de aplicativo, desbloqueou o telefone, mudou de
     * aba e voltou): além de reconferir a rede, **buscamos o que mudou no servidor**.
     *
     * Sem isso, a central de notificações só via novidade quando alguém abria uma viagem — e o
     * número mostrado na tela inicial ficava velho justamente na hora em que a pessoa olha para ele.
     */
    const aoVoltarParaApp = () => {
      if (document.visibilityState !== "visible") return;
      sincronizador.definirOnline(navigator.onLine !== false);
      void sincronizador.sincronizarAgora().catch(() => {
        /* sem rede agora: a barra já explica o que está guardado no aparelho */
      });
    };
    window.addEventListener("online", aoMudarRede);
    window.addEventListener("offline", aoMudarRede);
    document.addEventListener("visibilitychange", aoVoltarParaApp);
    return () => {
      cancelar();
      window.removeEventListener("online", aoMudarRede);
      window.removeEventListener("offline", aoMudarRede);
      document.removeEventListener("visibilitychange", aoVoltarParaApp);
    };
  }, [sincronizador]);

  useEffect(() => {
    void (async () => {
      try {
        // Se da última vez alguém pediu para sair e o servidor não confirmou, tentamos de novo
        // **antes** de perguntar pela sessão: a página não pode voltar conectada sozinha.
        if (saidaPendente()) {
          await api.sair().then(limparSaidaPendente).catch(() => undefined);
          if (saidaPendente()) {
            setMensagem("Encerramos a sessão neste aparelho, mas o servidor não confirmou. Vamos tentar de novo na próxima vez que você abrir.");
            return;
          }
        }
        const sessao = await api.sessao();
        setUsuario(sessao);
      } catch (erro) {
        setMensagem(erro instanceof ErroApi && erro.status !== 401 ? erro.message : null);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  // Link de convite: `?convite=TOKEN` no endereço.
  useEffect(() => {
    if (!usuario || !sincronizador) return;
    const token = new URLSearchParams(location.search).get("convite");
    if (!token) return;
    history.replaceState(null, "", location.pathname);
    void (async () => {
      try {
        const resultado = await api.aceitarConvite(token);
        await sincronizador.sincronizarAgora();
        setMensagem("Convite aceito! Você já aparece na viagem.");
        setTela({ nome: "viagem", viagemId: resultado.viagemId });
      } catch (erro) {
        setMensagem(erro instanceof ErroApi ? erro.message : "Não foi possível aceitar o convite.");
      }
    })();
  }, [usuario, sincronizador]);

  // A fila guardada no aparelho só pode ser enviada quando há sessão: sem login, ninguém escreve.
  useEffect(() => {
    if (!usuario || !sincronizador) return;
    if (recarregarAoVoltar.current) return;
    recarregarAoVoltar.current = true;
    void sincronizador.sincronizarAgora().catch(() => {
      /* sem rede agora; a barra mostra o que está guardado */
    });
  }, [usuario, sincronizador]);

  /**
   * Sair da conta. Regras (defeito relatado em 2026-10-15, botão que não fazia nada):
   *  1. pedir para sair é **sempre** atendido — a tela muda antes de qualquer limpeza;
   *  2. nenhuma limpeza pode travar a saída: cada uma tem seu próprio tratamento de erro;
   *  3. o que falhar é dito na tela, com o que a pessoa precisa saber (a sessão pode continuar
   *     válida no servidor e ser encerrada na próxima abertura).
   */
  async function sair(): Promise<void> {
    marcarSaidaPendente();
    setUsuario(null);
    setTela({ nome: "inicio" });
    setMensagem(null);

    const problemas: string[] = [];
    await api
      .sair()
      .then(limparSaidaPendente)
      .catch(() => problemas.push("o servidor não confirmou a saída"));
    // Dado de viagem não fica no aparelho depois de sair da conta.
    await Promise.resolve(sincronizador?.limparDadosLocais()).catch(() =>
      problemas.push("os dados guardados neste aparelho não foram apagados"),
    );

    if (problemas.length > 0) {
      setMensagem(`Você saiu neste aparelho, mas ${problemas.join(" e ")}. Vamos tentar de novo quando você abrir o app.`);
    }
  }

  async function aceitarConvite(token: string): Promise<void> {
    if (!sincronizador) return;
    try {
      const resultado = await api.aceitarConvite(token);
      await sincronizador.sincronizarAgora();
      setMensagem("Convite aceito! Você já aparece na viagem.");
      setTela({ nome: "viagem", viagemId: resultado.viagemId });
    } catch (erro) {
      setMensagem(erro instanceof ErroApi ? erro.message : "Não foi possível aceitar o convite.");
    }
  }

  if (carregando || !sincronizador || !estado) {
    return (
      <main className="app">
        <div className="carregando"><span className="pulso" /> Verificando sua sessão…</div>
      </main>
    );
  }

  /**
   * Depois de o servidor aceitar e-mail e senha, confirma que o **navegador guardou a sessão**.
   *
   * Antes daqui esta função descartava o usuário recém-logado, pedia `/auth/sessao` e, se a resposta
   * fosse `null` (cookie não guardado), chamava `setUsuario(null)` — a tela simplesmente continuava
   * igual, sem mensagem nenhuma. Foi o "clico em Entrar e nada acontece" de 2026-10-17 (o app estava
   * dentro do painel de demonstração, que é um iframe: ali o cookie `SameSite=Lax` não volta).
   * Agora: usa o usuário que já veio, verifica a sessão e, se ela não pegou, explica o motivo.
   */
  async function entrar(): Promise<void> {
    const sessao = await api.sessao().catch((erro) => {
      if (erro instanceof ErroApi && erro.status === 401) return null;
      throw erro;
    });
    if (!sessao) {
      throw new ErroApi(
        401,
        "sessao_nao_guardada",
        "O servidor aceitou seu e-mail e senha, mas o navegador não guardou a sessão. " +
          "Isso acontece quando o app abre dentro de outra página (um painel embutido). " +
          "Abra o endereço do app em uma aba própria e entre de novo.",
      );
    }
    setUsuario(sessao);
    void sincronizador?.sincronizarAgora().catch(() => undefined);
  }

  if (!usuario) {
    return (
      <Entrar
        aoEntrar={entrar}
      />
    );
  }

  return (
    <>
      <div className="topo">
        <div className="topo-linha">
          <small className="suave">Conectado como {usuario.nome}</small>
          <button className="sutil" onClick={() => void sair()}>Sair</button>
        </div>
        <BarraSincronizacao
          estado={estado}
          aoSincronizar={() => void sincronizador.sincronizarAgora().catch(() => undefined)}
          aoRetentar={(id) => void sincronizador.retentar(id)}
          aoDescartar={(id) => void sincronizador.descartar(id)}
          aoResolverConflito={(id, escolha) => void sincronizador.resolverConflito(id, escolha)}
        />
      </div>

      {mensagem ? (
        <div className="app" style={{ paddingBottom: 0 }}>
          <div className="aviso info" role="status">
            {mensagem}
            <button className="sutil" style={{ marginLeft: 8 }} onClick={() => setMensagem(null)}>ok</button>
          </div>
        </div>
      ) : null}

      {tela.nome === "inicio" ? (
        <Inicio
          abrirViagem={(viagemId) => setTela({ nome: "viagem", viagemId })}
          aceitarConvite={(token) => void aceitarConvite(token)}
          usuarioId={usuario.id}
          abrirNotificacoes={() => setTela({ nome: "notificacoes", viagemId: null })}
          sincronizador={sincronizador}
        />
      ) : tela.nome === "notificacoes" ? (
        <Notificacoes
          usuarioId={usuario.id}
          sincronizador={sincronizador}
          viagemIdInicial={tela.viagemId}
          voltar={() => setTela({ nome: "inicio" })}
          abrirViagem={(viagemId, aba) => setTela({ nome: "viagem", viagemId, aba, voltarPara: "notificacoes" })}
        />
      ) : tela.nome === "viagem" ? (
        <Viagem
          viagemId={tela.viagemId}
          usuarioId={usuario.id}
          abaInicial={tela.aba}
          voltar={() => setTela(tela.voltarPara === "notificacoes" ? { nome: "notificacoes", viagemId: null } : { nome: "inicio" })}
          abrirNotificacoes={() => setTela({ nome: "notificacoes", viagemId: tela.viagemId })}
          sincronizador={sincronizador}
          abrirAtividade={(atividadeId) => setTela({ nome: "atividade", viagemId: tela.viagemId, atividadeId })}
        />
      ) : (
        <Atividade
          viagemId={tela.viagemId}
          atividadeId={tela.atividadeId}
          sincronizador={sincronizador}
          voltar={() => setTela({ nome: "viagem", viagemId: tela.viagemId })}
        />
      )}
    </>
  );
}
