/**
 * Configurações deste aparelho (tela 18).
 *
 * Reúne em um único lugar:
 *  1. Preferências de alerta do orçamento (limiar de atenção: 70%, 80% ou 90%);
 *  2. Preferências de notificações e privacidade visual (abrir só alta prioridade, ocultar valores em R$);
 *  3. Endereço do servidor (`URL da API`) configurável + botão "Testar conexão" (essencial para o
 *     APK do celular apontar para o servidor na rede local ou Tailscale, sem `localhost` fixo);
 *  4. Estado de armazenamento local, fila offline, sessão e limpeza dos dados deste aparelho.
 */
import { useEffect, useState } from "react";
import { api } from "../services/api.ts";
import {
  assinarConfiguracoes,
  guardarConfiguracoes,
  lerConfiguracoes,
  type ConfiguracoesDoAparelho,
  type LimiarOrcamento,
} from "../services/configuracoes.ts";
import { Platform } from "../services/plataforma.ts";
import { temSessaoEmbutida } from "../services/sessao-embutida.ts";
import { rotuloDeArmazenamento } from "../services/tokens.ts";
import type { Sincronizador } from "../offline/sincronizador.ts";

interface Props {
  sincronizador: Sincronizador;
  armazenamento: string;
  alteracoesNaFila: number;
  aoLimparDados: () => void;
}

const OPCOES_LIMIAR: readonly LimiarOrcamento[] = [70, 80, 90];

export function Configuracoes({
  sincronizador,
  armazenamento,
  alteracoesNaFila,
  aoLimparDados,
}: Props): React.ReactElement {
  const [config, setConfig] = useState<ConfiguracoesDoAparelho>(() => lerConfiguracoes());
  const [enderecoDigitado, setEnderecoDigitado] = useState<string>(() => lerConfiguracoes().enderecoServidor);
  const [testando, setTestando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    return assinarConfiguracoes((nova) => {
      setConfig(nova);
    });
  }, []);

  function mudarLimiar(limiar: LimiarOrcamento): void {
    setErro(null);
    guardarConfiguracoes({ limiarOrcamentoPercentual: limiar });
    setAviso(`Alerta do orçamento ajustado para ${limiar}% do limite.`);
  }

  function alternarAltaPrioridade(ativo: boolean): void {
    setErro(null);
    guardarConfiguracoes({ notificacoesApenasAltaPrioridade: ativo });
    setAviso(
      ativo
        ? "A central de notificações abrirá filtrando apenas alta prioridade."
        : "A central de notificações voltará a mostrar todas as prioridades ao abrir.",
    );
  }

  function alternarOcultarValores(ativo: boolean): void {
    setErro(null);
    guardarConfiguracoes({ ocultarValoresNaCentral: ativo });
    setAviso(
      ativo
        ? "Valores em R$ ocultados nos cartões da central de notificações."
        : "Valores em R$ visíveis novamente na central de notificações.",
    );
  }

  async function testarServidor(): Promise<void> {
    setErro(null);
    setAviso(null);
    setTestando(true);
    try {
      const resultado = await api.testarConexao(enderecoDigitado);
      if (resultado.ok) {
        setAviso(resultado.mensagem);
      } else {
        setErro(resultado.mensagem);
      }
    } finally {
      setTestando(false);
    }
  }

  function salvarServidor(): void {
    setErro(null);
    const salvo = guardarConfiguracoes({ enderecoServidor: enderecoDigitado });
    setEnderecoDigitado(salvo.enderecoServidor);
    setAviso(
      salvo.enderecoServidor
        ? `Endereço do servidor salvo: ${salvo.enderecoServidor}.`
        : "Endereço do servidor restaurado para o padrão (/api).",
    );
  }

  return (
    <section className="cartao" aria-labelledby="titulo-configuracoes">
      <h2 id="titulo-configuracoes">Configurações e este aparelho</h2>
      <p className="suave pequeno">
        Preferências de alerta, privacidade de tela, endereço do servidor e dados guardados neste aparelho.
      </p>

      <h3 style={{ marginTop: 12 }}>Alerta de orçamento</h3>
      <label htmlFor="config-limiar-orcamento">Avisar "Perto do limite" a partir de</label>
      <select
        id="config-limiar-orcamento"
        value={String(config.limiarOrcamentoPercentual)}
        onChange={(evento) => mudarLimiar(Number(evento.target.value) as LimiarOrcamento)}
      >
        {OPCOES_LIMIAR.map((valor) => (
          <option key={valor} value={String(valor)}>
            {valor}% do limite{valor === 80 ? " (padrão)" : ""}
          </option>
        ))}
      </select>

      <h3 style={{ marginTop: 12 }}>Notificações e privacidade</h3>
      <label className="linha" style={{ justifyContent: "flex-start", gap: 8, cursor: "pointer" }}>
        <input
          id="config-notificacoes-alta"
          type="checkbox"
          checked={config.notificacoesApenasAltaPrioridade}
          onChange={(evento) => alternarAltaPrioridade(evento.target.checked)}
        />
        <span>Abrir a central mostrando só alta prioridade</span>
      </label>
      <label className="linha" style={{ justifyContent: "flex-start", gap: 8, cursor: "pointer" }}>
        <input
          id="config-ocultar-valores"
          type="checkbox"
          checked={config.ocultarValoresNaCentral}
          onChange={(evento) => alternarOcultarValores(evento.target.checked)}
        />
        <span>Ocultar valores em R$ nos cartões da central de notificações</span>
      </label>

      <h3 style={{ marginTop: 12 }}>Servidor do Lia Go</h3>
      <label htmlFor="config-endereco-servidor">
        Endereço do servidor (vazio = padrão <code>/api</code>; no celular use o IP da sua rede ou Tailscale)
      </label>
      <input
        id="config-endereco-servidor"
        type="url"
        value={enderecoDigitado}
        onChange={(evento) => setEnderecoDigitado(evento.target.value)}
        placeholder="Ex.: http://192.168.1.10:3000/api"
      />
      <div className="acoes">
        <button type="button" className="sutil" disabled={testando} onClick={() => void testarServidor()}>
          {testando ? "Testando…" : "Testar conexão"}
        </button>
        <button type="button" className="principal" onClick={salvarServidor}>
          Salvar servidor
        </button>
        {config.enderecoServidor ? (
          <button
            type="button"
            className="sutil"
            onClick={() => {
              setEnderecoDigitado("");
              guardarConfiguracoes({ enderecoServidor: "" });
              setAviso("Endereço do servidor restaurado para o padrão (/api).");
            }}
          >
            Usar padrão (/api)
          </button>
        ) : null}
      </div>

      <h3 style={{ marginTop: 12 }}>Este aparelho</h3>
      <div className="linha">
        <span>Dados guardados para uso sem internet</span>
        <span>{armazenamento}</span>
      </div>
      <div className="linha">
        <span>Alterações na fila</span>
        <span>{alteracoesNaFila}</span>
      </div>
      <div className="linha">
        <span>Sua sessão fica em</span>
        <span>
          {Platform.ehWeb()
            ? temSessaoEmbutida()
              ? "sessão desta aba (sessionStorage)"
              : "cookie HttpOnly do navegador"
            : rotuloDeArmazenamento()}
        </span>
      </div>
      <p>
        <small className="suave">
          Guardamos apenas o que você já pode ver nesta viagem, para o app funcionar sem sinal. Os saldos oficiais
          são sempre calculados no servidor.
        </small>
      </p>
      <div className="acoes">
        <button
          className="sutil"
          onClick={() => {
            void sincronizador.limparDadosLocais().then(() => {
              aoLimparDados();
            });
          }}
        >
          Apagar dados deste aparelho
        </button>
      </div>

      {aviso ? <div className="aviso ok">{aviso}</div> : null}
      {erro ? <div className="aviso erro">{erro}</div> : null}
    </section>
  );
}
