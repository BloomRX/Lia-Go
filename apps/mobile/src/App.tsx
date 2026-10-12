import { useEffect, useState } from "react";
import { Entrar } from "./telas/Entrar.tsx";
import { Inicio } from "./telas/Inicio.tsx";
import { Viagem } from "./telas/Viagem.tsx";
import { api, ErroApi, type Usuario } from "./services/api.ts";

type Tela = { nome: "inicio" } | { nome: "viagem"; viagemId: string };

/** Navegação simples por estado (uma tela por vez) — suficiente para a primeira fatia. */
export function App(): React.ReactElement {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [tela, setTela] = useState<Tela>({ nome: "inicio" });
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const sessao = await api.sessao();
        setUsuario(sessao);
      } catch (erro) {
        setMensagem(erro instanceof ErroApi ? erro.message : "Não foi possível verificar a sessão.");
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  async function aceitarConvite(token: string): Promise<void> {
    try {
      const resultado = await api.aceitarConvite(token);
      setMensagem("Convite aceito! Você já aparece na viagem.");
      setTela({ nome: "viagem", viagemId: resultado.viagemId });
    } catch (erro) {
      setMensagem(erro instanceof ErroApi ? erro.message : "Não foi possível aceitar o convite.");
    }
  }

  function sair(): void {
    void api.sair().finally(() => {
      setUsuario(null);
      setTela({ nome: "inicio" });
    });
  }

  if (carregando) {
    return (
      <main className="app">
        <div className="carregando"><span className="pulso" /> Verificando sua sessão…</div>
      </main>
    );
  }

  if (!usuario) return <Entrar aoEntrar={() => void api.sessao().then(setUsuario)} />;

  return (
    <>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <small className="suave">Conectado como {usuario.nome}</small>
        <button className="sutil" onClick={sair}>Sair</button>
      </div>
      {mensagem ? (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
          <div className="aviso info">{mensagem}</div>
        </div>
      ) : null}

      {tela.nome === "inicio" ? (
        <Inicio abrirViagem={(viagemId) => setTela({ nome: "viagem", viagemId })} aceitarConvite={(token) => void aceitarConvite(token)} />
      ) : (
        <Viagem viagemId={tela.viagemId} usuarioId={usuario.id} voltar={() => setTela({ nome: "inicio" })} />
      )}
    </>
  );
}
