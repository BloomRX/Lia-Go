/**
 * Preferências guardadas neste aparelho (tela 18 — Configurações).
 *
 * Nunca guarda token nem dado sensível: apenas preferências de leitura/alerta e o endereço opcional
 * do servidor do Lia Go (necessário no APK nativo ou em rede local quando o grupo aponta para o seu
 * próprio servidor; sem isso usa `/api` relativo).
 */

export type LimiarOrcamento = 70 | 80 | 90;

export interface ConfiguracoesDoAparelho {
  /** Vazio = usar o padrão (`/api` na mesma origem). Preenchido = URL base informada pela pessoa. */
  enderecoServidor: string;
  /** Percentual a partir do qual o orçamento entra em "Perto do limite" (70%, 80% ou 90%). */
  limiarOrcamentoPercentual: LimiarOrcamento;
  /** Quando verdadeiro, a central de notificações abre filtrando apenas itens de alta prioridade. */
  notificacoesApenasAltaPrioridade: boolean;
  /** Oculta valores em R$ nos cartões da central de notificações (privacidade visual em público). */
  ocultarValoresNaCentral: boolean;
}

const CHAVE_CONFIGURACOES = "lia.configuracoes";

export const CONFIGURACOES_PADRAO: ConfiguracoesDoAparelho = {
  enderecoServidor: "",
  limiarOrcamentoPercentual: 80,
  notificacoesApenasAltaPrioridade: false,
  ocultarValoresNaCentral: false,
};

let memoria: ConfiguracoesDoAparelho = { ...CONFIGURACOES_PADRAO };
const ouvintes = new Set<(config: ConfiguracoesDoAparelho) => void>();

export function normalizarEnderecoServidor(bruto: string): string {
  const limpo = bruto.trim().replace(/\/+$/, "");
  if (!limpo) return "";
  if (/^https?:\/\//i.test(limpo) && !limpo.endsWith("/api")) {
    return `${limpo}/api`;
  }
  return limpo;
}

function validarLimiar(valor: unknown): LimiarOrcamento {
  if (valor === 70 || valor === 80 || valor === 90) return valor;
  return 80;
}

export function lerConfiguracoes(): ConfiguracoesDoAparelho {
  try {
    if (typeof localStorage !== "undefined") {
      const texto = localStorage.getItem(CHAVE_CONFIGURACOES);
      if (texto) {
        const lido = JSON.parse(texto) as Partial<ConfiguracoesDoAparelho>;
        memoria = {
          enderecoServidor: typeof lido.enderecoServidor === "string" ? normalizarEnderecoServidor(lido.enderecoServidor) : "",
          limiarOrcamentoPercentual: validarLimiar(lido.limiarOrcamentoPercentual),
          notificacoesApenasAltaPrioridade: Boolean(lido.notificacoesApenasAltaPrioridade),
          ocultarValoresNaCentral: Boolean(lido.ocultarValoresNaCentral),
        };
      }
    }
  } catch {
    // Navegador com armazenamento bloqueado: usa a cópia em memória da aba.
  }
  return memoria;
}

export function guardarConfiguracoes(parcial: Partial<ConfiguracoesDoAparelho>): ConfiguracoesDoAparelho {
  const atual = lerConfiguracoes();
  const proximo: ConfiguracoesDoAparelho = {
    enderecoServidor:
      parcial.enderecoServidor !== undefined
        ? normalizarEnderecoServidor(parcial.enderecoServidor)
        : atual.enderecoServidor,
    limiarOrcamentoPercentual:
      parcial.limiarOrcamentoPercentual !== undefined
        ? validarLimiar(parcial.limiarOrcamentoPercentual)
        : atual.limiarOrcamentoPercentual,
    notificacoesApenasAltaPrioridade:
      parcial.notificacoesApenasAltaPrioridade !== undefined
        ? Boolean(parcial.notificacoesApenasAltaPrioridade)
        : atual.notificacoesApenasAltaPrioridade,
    ocultarValoresNaCentral:
      parcial.ocultarValoresNaCentral !== undefined
        ? Boolean(parcial.ocultarValoresNaCentral)
        : atual.ocultarValoresNaCentral,
  };
  memoria = proximo;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CHAVE_CONFIGURACOES, JSON.stringify(proximo));
    }
  } catch {
    // Mantém em memória quando o armazenamento do navegador está bloqueado.
  }
  for (const ouvinte of ouvintes) ouvinte(proximo);
  return proximo;
}

export function assinarConfiguracoes(ouvinte: (config: ConfiguracoesDoAparelho) => void): () => void {
  ouvintes.add(ouvinte);
  ouvinte(lerConfiguracoes());
  return () => ouvintes.delete(ouvinte);
}

export function baseDaApi(padrao = "/api"): string {
  const custom = lerConfiguracoes().enderecoServidor;
  return custom || padrao;
}
