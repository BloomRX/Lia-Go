import { useEffect, useRef, useState } from "react";
import { Entrar } from "./telas/Entrar.tsx";
import { Inicio } from "./telas/Inicio.tsx";
import { Viagem } from "./telas/Viagem.tsx";
import { api, ErroApi, type Usuario } from "./services/api.ts";
import { Sincronizador, type EstadoSincronizacao } from "./offline/sincronizador.ts";
import { BarraSincronizacao } from "./componentes/BarraSincronizacao.tsx";

type Tela = { nome: "inicio" } | { nome: "viagem"; viagemId: string };

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
    const aoVoltarParaApp = () => {
      if (document.visibilityState === "visible") sincronizador.definirOnline(navigator.onLine !== false);
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

  async function sair(): Promise<void> {
    await api.sair().catch(() => undefined);
    // Dado de viagem não fica no aparelho depois de sair da conta.
    await sincronizador?.limparDadosLocais();
    setUsuario(null);
    setTela({ nome: "inicio" });
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

  if (!usuario) {
    return (
      <Entrar
        aoEntrar={() => {
          void api.sessao().then((sessao) => {
            setUsuario(sessao);
            void sincronizador.sincronizarAgora().catch(() => undefined);
          });
        }}
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
          sincronizador={sincronizador}
        />
      ) : (
        <Viagem
          viagemId={tela.viagemId}
          usuarioId={usuario.id}
          voltar={() => setTela({ nome: "inicio" })}
          sincronizador={sincronizador}
        />
      )}
    </>
  );
}
