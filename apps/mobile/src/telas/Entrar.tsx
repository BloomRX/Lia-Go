import { useState } from "react";
import { Marca } from "../componentes/Marca.tsx";
import { api, ErroApi } from "../services/api.ts";

// Dicas de autofill do navegador (ajudam o gerenciador de senhas; não guardam nada).
const DICA_CONTA_NOVA = "new-password";
const DICA_CONTA_EXISTENTE = "current-password";

interface Props {
  /**
   * Entra de fato (confirma a sessão). Devolve uma promessa porque o app precisa **verificar** que o
   * navegador guardou a sessão antes de sair desta tela — e, se não guardou, dizer o motivo em vez de
   * deixar a tela parada (defeito relatado em 2026-10-17: "clico em Entrar e nada acontece").
   */
  aoEntrar: () => Promise<void>;
  /**
   * Já sabemos que o app está dentro de outra página? Por padrão é detectado aqui; o app pode
   * informar o valor (e os testes também, já que o DOM de teste sempre parece ser a janela do topo).
   */
  embutido?: boolean;
}

/**
 * O app está aberto **dentro de outra página** (painel de pré-visualização, portal)?
 * Nesse caso alguns navegadores bloqueiam o cookie de sessão, e a saída é abrir em aba própria.
 * Se o acesso a `window.top` for bloqueado, também estamos embutidos.
 */
export function estaEmbutido(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Boas-vindas + entrada/criação de conta. Métodos: e-mail e senha (decisão confirmada). */
export function Entrar({ aoEntrar, embutido = estaEmbutido() }: Props): React.ReactElement {
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      // O servidor aceitar as credenciais não basta: `aoEntrar` confirma que a sessão ficou no
      // navegador e lança erro (mostrado aqui) quando não ficou.
      if (modo === "entrar") await api.entrar(email, senha);
      else await api.registrar(nome, email, senha);
      await aoEntrar();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Não foi possível conectar. Verifique sua rede.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="app">
      <Marca legenda="Viagens melhores. Despesas sob controle." />
      <p>Viagens em grupo sem briga de dinheiro: roteiro, gastos compartilhados e acertos — com a Lia ajudando.</p>

      <form className="cartao" onSubmit={enviar}>
        <h2>{modo === "entrar" ? "Entrar" : "Criar conta"}</h2>
        {erro ? <div className="aviso erro" role="alert">{erro}</div> : null}

        {modo === "criar" ? (
          <>
            <label htmlFor="nome">Seu nome</label>
            <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} autoComplete="name" />
          </>
        ) : null}

        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />

        <label htmlFor="senha">Senha {modo === "criar" ? "(mínimo 10 caracteres)" : ""}</label>
        <input
          id="senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          minLength={modo === "criar" ? 10 : 1}
          autoComplete={modo === "criar" ? DICA_CONTA_NOVA : DICA_CONTA_EXISTENTE}
        />

        <div className="acoes">
          <button className="principal" type="submit" disabled={ocupado}>
            {ocupado ? "Enviando…" : modo === "entrar" ? "Entrar" : "Criar conta"}
          </button>
          <button type="button" className="sutil" onClick={() => { setModo(modo === "entrar" ? "criar" : "entrar"); setErro(null); }}>
            {modo === "entrar" ? "Criar conta" : "Já tenho conta"}
          </button>
        </div>
      </form>

      {embutido ? (
        <div className="aviso atencao">
          <p>
            Este app está aberto dentro de outra página. Alguns navegadores bloqueiam o cookie de sessão nesse
            caso — se o login não entrar, use o link abaixo.
          </p>
          <a className="aba-propria" href={window.location.href} target="_blank" rel="noreferrer">
            Abrir o app em uma aba própria
          </a>
        </div>
      ) : null}

      <div className="aviso info">
        Sua senha é protegida com scrypt e a sessão fica em cookie seguro na web. Não guardamos dados de cartão e não
        fazemos pagamentos: os acertos são apenas sugeridos.
      </div>
    </main>
  );
}
