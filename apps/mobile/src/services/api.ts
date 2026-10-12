/**
 * Conversa com a API.
 *
 * Regra de plataforma (decisão confirmada de sessão híbrida):
 * - WEB: cookie HttpOnly, enviado com `credentials: "include"`, via proxy /api do Vite.
 * - APP NATIVO: access token curto no cabeçalho Authorization e refresh token em
 *   armazenamento seguro do aparelho (Preferences). Nada de token em localStorage na web.
 */
import { Platform } from "./plataforma.ts";
import { guardarTokens, lerTokens, limparTokens } from "./tokens.ts";

export class ErroApi extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly detalhes?: unknown;
  constructor(status: number, codigo: string, mensagem: string, detalhes?: unknown) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

const BASE = import.meta.env.VITE_API_URL ?? "/api";

interface OpcoesRequisicao {
  metodo?: "GET" | "POST" | "PATCH" | "DELETE";
  corpo?: unknown;
  idempotencia?: string;
  /** Não tenta renovar token automaticamente (usado no próprio login/renovação). */
  semRenovacao?: boolean;
}

async function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}, tentativa = 0): Promise<T> {
  const cabecalhos: Record<string, string> = {};
  if (opcoes.corpo !== undefined) cabecalhos["content-type"] = "application/json";
  if (opcoes.idempotencia) cabecalhos["idempotency-key"] = opcoes.idempotencia;

  if (Platform.ehNativo()) {
    const tokens = await lerTokens();
    if (tokens?.acesso) cabecalhos.authorization = `Bearer ${tokens.acesso}`;
  }

  const resposta = await fetch(`${BASE}${caminho}`, {
    method: opcoes.metodo ?? "GET",
    headers: cabecalhos,
    credentials: "include",
    ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
  });

  if (resposta.status === 401 && Platform.ehNativo() && !opcoes.semRenovacao && tentativa === 0) {
    const renovado = await renovarToken();
    if (renovado) return requisitar<T>(caminho, opcoes, tentativa + 1);
  }

  if (resposta.status === 204) return undefined as T;
  const texto = await resposta.text();
  const dados = texto ? (JSON.parse(texto) as Record<string, unknown>) : {};
  if (!resposta.ok) {
    throw new ErroApi(
      resposta.status,
      String(dados.erro ?? "erro"),
      String(dados.mensagem ?? "Não foi possível concluir a operação."),
      dados.detalhes,
    );
  }
  return dados as T;
}

async function renovarToken(): Promise<boolean> {
  const tokens = await lerTokens();
  if (!tokens?.refresh) return false;
  try {
    const resposta = await fetch(`${BASE}/auth/token/renovar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refresh }),
    });
    if (!resposta.ok) {
      await limparTokens();
      return false;
    }
    const dados = (await resposta.json()) as { acesso: { token: string }; refresh: { token: string } };
    await guardarTokens({ acesso: dados.acesso.token, refresh: dados.refresh.token });
    return true;
  } catch {
    await limparTokens();
    return false;
  }
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
}

export interface Participante {
  usuario_id: string;
  nome: string;
  papel: "organizador" | "participante";
  estado: "ativo" | "convidado" | "saiu" | "removido";
}

export interface ViagemResumo {
  id: string;
  nome: string;
  destino: string;
  data_inicio: string | null;
  data_fim: string | null;
  estado: "rascunho" | "planejada" | "em_andamento" | "concluida" | "pendente" | "cancelada";
  versao: number;
  papel: "organizador" | "participante";
  pendencias_financeiras: number;
}

export interface Permissao {
  permitido: boolean;
  motivo: string;
}

export interface DetalheViagem {
  viagem: ViagemResumo & { rotuloEstado: string };
  papel: "organizador" | "participante";
  participantes: Participante[];
  pendencias: { despesas: number; convites: number };
  sugestao: { sugestao: string; motivo: string } | null;
  permissoes: {
    editar: Permissao;
    cancelar: Permissao;
    convidar: Permissao;
    registrarDespesa: Permissao;
    transicoesPermitidas: string[];
  };
}

export interface DespesaApi {
  id: string;
  autorId: string;
  pagadorId: string;
  tipo: "pessoal" | "compartilhada";
  estado: "pendente" | "confirmada" | "contestada" | "cancelada";
  valorCentavos: string;
  moeda: string;
  data: string;
  descricao: string;
  motivoContestacao: string | null;
  versao: number;
  rateio: { partes: { participanteId: string; valorCentavos: string; ajusteResto: number }[]; explicacao: string };
  historico: { acao: string; autorId: string; em: string; motivo: string | null }[];
}

export interface SaldosApi {
  realizado: string;
  comprometido: string;
  haDivergencia: boolean;
  saldos: { participanteId: string; nome: string | null; pago: string; parteDevida: string; saldo: string }[];
  transferenciasSugeridas: { deId: string; deNome: string | null; paraId: string; paraNome: string | null; valorCentavos: string }[];
  aviso: string;
}

export const api = {
  async registrar(nome: string, email: string, senha: string): Promise<Usuario> {
    const resposta = await requisitar<{ usuario: Usuario }>("/auth/registro", {
      metodo: "POST",
      corpo: { nome, email, senha },
      semRenovacao: true,
    });
    return resposta.usuario;
  },

  async entrar(email: string, senha: string): Promise<Usuario> {
    if (Platform.ehNativo()) {
      const resposta = await requisitar<{ usuario: Usuario; acesso: { token: string }; refresh: { token: string } }>(
        "/auth/login",
        { metodo: "POST", corpo: { email, senha, cliente: "nativo", dispositivo: Platform.nome() }, semRenovacao: true },
      );
      await guardarTokens({ acesso: resposta.acesso.token, refresh: resposta.refresh.token });
      return resposta.usuario;
    }
    const resposta = await requisitar<{ usuario: Usuario }>("/auth/login", {
      metodo: "POST",
      corpo: { email, senha, cliente: "web" },
      semRenovacao: true,
    });
    return resposta.usuario;
  },

  async sair(): Promise<void> {
    try {
      await requisitar<void>("/auth/logout", { metodo: "POST", semRenovacao: true });
    } finally {
      await limparTokens();
    }
  },

  async sessao(): Promise<Usuario | null> {
    try {
      const resposta = await requisitar<{ usuario: Usuario }>("/auth/sessao");
      return resposta.usuario;
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 401) return null;
      throw erro;
    }
  },

  async listarViagens(): Promise<{ viagens: ViagemResumo[]; convitesPendentes: { id: string; viagem_nome: string }[] }> {
    return requisitar("/viagens");
  },

  async criarViagem(dados: {
    nome: string;
    destino: string;
    dataInicio: string | null;
    dataFim: string | null;
  }): Promise<{ id: string }> {
    return requisitar("/viagens", {
      metodo: "POST",
      corpo: { ...dados, fusoHorario: "America/Sao_Paulo", moeda: "BRL" },
      idempotencia: crypto.randomUUID(),
    });
  },

  async detalheViagem(viagemId: string): Promise<DetalheViagem> {
    return requisitar(`/viagens/${viagemId}`);
  },

  async transicionar(viagemId: string, para: string, motivo?: string): Promise<{ estado: string; rotuloEstado: string }> {
    return requisitar(`/viagens/${viagemId}/transicoes`, { metodo: "POST", corpo: { para, motivo } });
  },

  async impactosCancelamento(viagemId: string): Promise<{ impactos: string[] }> {
    return requisitar(`/viagens/${viagemId}/impactos-cancelamento`);
  },

  async criarConvite(viagemId: string, email: string): Promise<{ token: string; aviso: string }> {
    return requisitar(`/viagens/${viagemId}/convites`, { metodo: "POST", corpo: { email } });
  },

  async aceitarConvite(token: string): Promise<{ viagemId: string }> {
    return requisitar("/convites/aceitar", { metodo: "POST", corpo: { token } });
  },

  async listarDespesas(viagemId: string): Promise<{ despesas: DespesaApi[] }> {
    return requisitar(`/viagens/${viagemId}/despesas`);
  },

  async criarDespesa(
    viagemId: string,
    dados: {
      tipo: "pessoal" | "compartilhada";
      valorCentavos: string;
      data: string;
      descricao: string;
      pagadorId: string;
      participantes: string[];
    },
  ): Promise<DespesaApi> {
    return requisitar(`/viagens/${viagemId}/despesas`, {
      metodo: "POST",
      corpo: { ...dados, moeda: "BRL" },
      idempotencia: crypto.randomUUID(),
    });
  },

  async confirmarDespesa(viagemId: string, despesaId: string): Promise<DespesaApi> {
    return requisitar(`/viagens/${viagemId}/despesas/${despesaId}/confirmar`, { metodo: "POST" });
  },

  async contestarDespesa(viagemId: string, despesaId: string, motivo: string): Promise<DespesaApi> {
    return requisitar(`/viagens/${viagemId}/despesas/${despesaId}/contestar`, { metodo: "POST", corpo: { motivo } });
  },

  async saldos(viagemId: string): Promise<SaldosApi> {
    return requisitar(`/viagens/${viagemId}/saldos`);
  },
};
