import { useState } from "react";
import { api, ErroApi } from "../services/api.ts";

// Dicas de autofill do navegador (ajudam o gerenciador de senhas; não guardam nada).
const DICA_CONTA_NOVA = "new-password";
const DICA_CONTA_EXISTENTE = "current-password";

interface Props {
  aoEntrar: (nome: string) => void;
}

/** Boas-vindas + entrada/criação de conta. Métodos: e-mail e senha (decisão confirmada). */
export function Entrar({ aoEntrar }: Props): React.ReactElement {
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
      const usuario = modo === "entrar" ? await api.entrar(email, senha) : await api.registrar(nome, email, senha);
      aoEntrar(usuario.nome);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Não foi possível conectar. Verifique sua rede.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="app">
      <div className="marca">
        <span className="marca-ponto" aria-hidden="true" />
        <h1>Lia Go</h1>
      </div>
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

      <div className="aviso info">
        Sua senha é protegida com scrypt e a sessão fica em cookie seguro na web. Não guardamos dados de cartão e não
        fazemos pagamentos: os acertos são apenas sugeridos.
      </div>
    </main>
  );
}
