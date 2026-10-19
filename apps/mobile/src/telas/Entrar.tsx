import { useRef, useState } from "react";
import { Marca } from "../componentes/Marca.tsx";
import { ErroApi } from "../services/api.ts";
import { Platform } from "../services/plataforma.ts";

// Dicas de autofill do navegador (ajudam o gerenciador de senhas; não guardam nada).
const DICA_CONTA_NOVA = "new-password";
const DICA_CONTA_EXISTENTE = "current-password";

/** O que a tela entrega para o app: entrar ou criar conta, com as credenciais digitadas. */
export interface Credenciais {
  modo: "entrar" | "criar";
  nome: string;
  email: string;
  senha: string;
}

interface Props {
  /**
   * Entra de fato (faz o login, confirma a sessão e devolve o usuário à tela). Devolve uma promessa
   * porque o app precisa **verificar** que o navegador guardou a sessão antes de sair desta tela — e, se
   * não guardou, dizer o motivo em vez de deixar a tela parada (defeito de 2026-10-17: "clico em Entrar
   * e nada acontece").
   */
  aoEntrar: (credenciais: Credenciais) => Promise<void>;
  /**
   * Já sabemos que o app está dentro de outra página? Por padrão é detectado aqui; o app pode
   * informar o valor (e os testes também, já que o DOM de teste sempre parece ser a janela do topo).
   */
  embutido?: boolean;
}

/**
 * Aviso de página embutida. O link "abrir em aba própria" pode ser barrado quando o painel abre o app
 * num iframe restrito (sem permissão de abrir janela) — então o **endereço** também aparece, legível e
 * copiável, que é a saída que funciona em qualquer navegador.
 */
export function AvisoAbaPropria({ url }: { url: string }): React.ReactElement {
  const campo = useRef<HTMLInputElement>(null);
  const [copiado, setCopiado] = useState<"nao" | "sim" | "manual">("nao");

  async function copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado("sim");
    } catch {
      // Sem permissão de área de transferência (comum dentro de iframe): deixa o endereço
      // selecionado para o usuário copiar no teclado, em vez de não fazer nada.
      campo.current?.focus();
      campo.current?.select();
      setCopiado("manual");
    }
  }

  return (
    <div className="aviso atencao">
      <p>
        Este app está aberto dentro de outra página, e alguns navegadores bloqueiam o cookie de sessão nesse
        caso. Abra o endereço abaixo em uma aba do navegador e entre de novo:
      </p>
      <div className="endereco-app">
        <input
          ref={campo}
          readOnly
          value={url}
          aria-label="Endereço do app"
          onFocus={(evento) => evento.currentTarget.select()}
        />
        <button type="button" className="compacto" onClick={() => void copiar()}>
          {copiado === "sim" ? "Copiado" : "Copiar"}
        </button>
      </div>
      {copiado === "manual" ? (
        <p role="status" className="dica-copia">
          O navegador não deixou copiar sozinho: o endereço já está selecionado — use Ctrl+C.
        </p>
      ) : null}
      <a className="aba-propria" href={url} target="_blank" rel="noreferrer">
        Abrir o app em uma aba própria
      </a>
    </div>
  );
}

/** Boas-vindas + entrada/criação de conta. Métodos: e-mail e senha (decisão confirmada). */
export function Entrar({ aoEntrar, embutido = false }: Props): React.ReactElement {
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // A saída em aba própria só aparece quando pedida explicitamente (testes/incorporador) ou
  // se a sessão realmente falhar (nem cookie nem sessionStorage funcionarem). Mostrar antes de
  // tentar entrar induzia a abrir a URL do painel em aba avulsa, onde o proxy devolve 403/Unavailable.
  const [mostrarSaidaAba, setMostrarSaidaAba] = useState(embutido);

  async function enviar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      // O servidor aceitar as credenciais não basta: `aoEntrar` faz o login, confirma que a sessão
      // ficou (cookie ou, no caso embutido, token da aba) e lança erro — mostrado aqui — quando não ficou.
      await aoEntrar({ modo, nome, email, senha });
    } catch (falha) {
      if (falha instanceof ErroApi && falha.codigo === "sessao_nao_guardada" && Platform.embutido()) {
        setMostrarSaidaAba(true);
      }
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

      {mostrarSaidaAba ? <AvisoAbaPropria url={window.location.href} /> : null}

      <div className="aviso info">
        Sua senha é protegida com scrypt e a sessão fica em cookie seguro na web. Não guardamos dados de cartão e não
        fazemos pagamentos: os acertos são apenas sugeridos.
      </div>
    </main>
  );
}
