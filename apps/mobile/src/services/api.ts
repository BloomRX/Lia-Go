/**
 * Conversa com a API.
 *
 * Regra de plataforma (decisão confirmada de sessão híbrida):
 * - WEB: cookie HttpOnly, enviado com `credentials: "include"`, via proxy /api do Vite.
 * - APP NATIVO: access token curto no cabeçalho Authorization e refresh token em
 *   armazenamento seguro do aparelho (Preferences). Nada de token em localStorage na web.
 * - NAVEGADOR QUE RECUSA O COOKIE (app embutido em outra página): fallback explícito por token,
 *   guardado em `sessionStorage` (morre com a aba) — ver `sessao-embutida.ts`.
 */
import { Platform } from "./plataforma.ts";
import { guardarTokens, lerTokens, limparTokens } from "./tokens.ts";
import {
  guardarSessaoEmbutida,
  lerSessaoEmbutida,
  limparSessaoEmbutida,
  temSessaoEmbutida,
} from "./sessao-embutida.ts";

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

// No navegador/app sempre é a própria origem (`/api`) — o Vite faz o proxy para a API local,
// então nunca existe "localhost" no código que roda no navegador. Em testes (Node) cai no /api.
const BASE = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? "/api";

interface OpcoesRequisicao {
  metodo?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  corpo?: unknown;
  idempotencia?: string;
  /** Não tenta renovar token automaticamente (usado no próprio login/renovação). */
  semRenovacao?: boolean;
}

async function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}, tentativa = 0): Promise<T> {
  const cabecalhos: Record<string, string> = {};
  if (opcoes.corpo !== undefined) cabecalhos["content-type"] = "application/json";
  if (opcoes.idempotencia) cabecalhos["idempotency-key"] = opcoes.idempotencia;

  const autorizacao = await tokenDeAcesso();
  if (autorizacao) {
    cabecalhos.authorization = `Bearer ${autorizacao}`;
    cabecalhos["x-lia-sessao"] = autorizacao;
  }

  // Alguns proxies de pré-visualização (ex.: `*.arena.site`) removem tanto `Cookie` quanto
  // `Authorization` ao encaminhar para o sandbox. No modo de sessão embutida, enviamos o token
  // também em `x-lia-sessao` e no parâmetro `_sessao` da chamada `/api` (sempre sobre HTTPS/local).
  const url =
    autorizacao && !Platform.ehNativo() && temSessaoEmbutida()
      ? `${BASE}${caminho}${caminho.includes("?") ? "&" : "?"}_sessao=${encodeURIComponent(autorizacao)}`
      : `${BASE}${caminho}`;

  const resposta = await fetch(url, {
    method: opcoes.metodo ?? "GET",
    headers: cabecalhos,
    credentials: "include",
    ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
  });

  if (resposta.status === 401 && podeRenovar() && !opcoes.semRenovacao && tentativa === 0) {
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

/** Token do app nativo (Keychain/Keystore) ou, no fallback, o da aba (sessionStorage). */
async function tokenDeAcesso(): Promise<string | null> {
  if (Platform.ehNativo()) return (await lerTokens())?.acesso ?? null;
  return lerSessaoEmbutida()?.acesso ?? null;
}

/** Só tenta renovar quem tem refresh guardado — nativo ou a aba com sessão de fallback. */
function podeRenovar(): boolean {
  return Platform.ehNativo() || temSessaoEmbutida();
}

async function renovarToken(): Promise<boolean> {
  const tokens = Platform.ehNativo() ? await lerTokens() : lerSessaoEmbutida();
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
    const novos = { acesso: dados.acesso.token, refresh: dados.refresh.token };
    if (Platform.ehNativo()) await guardarTokens(novos);
    else guardarSessaoEmbutida(novos);
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

/** Resposta da sincronização incremental (ver apps/api/src/routes/sincronizacao.ts). */
export interface MudancasApi {
  cursor: string;
  temMais: boolean;
  mudancas: number;
  viagem: DetalheViagem["viagem"];
  papel: string;
  participantes: Participante[];
  pendencias: { despesas: number; convites: number };
  sugestao: DetalheViagem["sugestao"];
  permissoes: DetalheViagem["permissoes"];
  despesas: DespesaApi[];
  movimentos: MovimentoApi[];
  convites: Record<string, unknown>[];
  atividades: AtividadeApi[];
  reservas: ReservaApi[];
  itensChecklist: ItemChecklistApi[];
  documentos: DocumentoApi[];
}

/** Reserva como o servidor devolve (custo em centavos, string; `null` = desconhecido). */
export interface ReservaApi {
  id: string;
  viagemId: string;
  autorId: string;
  tipo: "hospedagem" | "transporte" | "passeio" | "outro";
  titulo: string;
  local: string | null;
  inicio: string | null;
  fim: string | null;
  custoCentavos: string | null;
  custoAVerificar: boolean;
  confirmacao: string | null;
  confirmadaPor: string | null;
  confirmadaEm: string | null;
  estado: "prevista" | "confirmada" | "cancelada";
  motivoCancelamento: string | null;
  versao: number;
}

/** Atividade do roteiro, como o servidor devolve (custo em centavos, sem float). */
export interface AtividadeApi {
  id: string;
  viagemId: string;
  autorId: string;
  dia: string;
  ordem: number;
  titulo: string;
  hora: string | null;
  duracaoMinutos: number | null;
  local: string | null;
  custo: { centavos: string | null; natureza: "estimativa" | "compromisso" | "gratuito" | null; aVerificar: boolean };
  estado: "planejada" | "concluida" | "cancelada";
  concluidaPor: string | null;
  concluidaEm: string | null;
  observacao: string | null;
  /** Reserva da viagem que cobre esta atividade (tela 7). `null` = nenhuma. */
  reservaId: string | null;
  deslocamento: { minutos: number | null; km: number | null; custoCentavos: string | null; alerta: string | null } | null;
  versao: number;
}

export interface ConflitoApi {
  tipo: "sobreposicao" | "deslocamento_insuficiente";
  atividadeIds: string[];
  explicacao: string;
  sugestao: string;
}

export interface DiaRoteiroApi {
  dia: string;
  atividades: AtividadeApi[];
  resumo: {
    total: number;
    concluidas: number;
    canceladas: number;
    planejadas: number;
    comHorarioDefinido: number;
    flexiveis: number;
    custoConhecidoCentavos: string;
    temEstimativa: boolean;
    temCompromisso: boolean;
    temGratuito: boolean;
    temCustoAVerificar: boolean;
    conflitos: number;
  };
  conflitos: ConflitoApi[];
}

export interface RoteiroApi {
  dias: DiaRoteiroApi[];
  permissoes: { criarAtividade: boolean; motivoParaNaoCriar: string | null; papel: string; estadoViagem: string };
}

export interface MovimentoApi {
  id: string;
  de_id: string;
  para_id: string;
  valor_centavos: string;
  estado: string;
  despesa_id: string | null;
  criado_em: string;
  confirmado_em: string | null;
  de_nome: string;
  para_nome: string;
}

export interface SaldosApi {
  realizado: string;
  comprometido: string;
  haDivergencia: boolean;
  saldos: { participanteId: string; nome: string | null; pago: string; parteDevida: string; saldo: string }[];
  transferenciasSugeridas: { deId: string; deNome: string | null; paraId: string; paraNome: string | null; valorCentavos: string }[];
  aviso: string;
}

/** Orçamento da viagem (tela 9): limite é planejamento, o oficial vem das despesas confirmadas. */
export interface OrcamentoApi {
  limiteColetivo: { id: string; centavos: string; atualizadoEm: string; versao: number } | null;
  limiteIndividualProprio: { id: string; centavos: string; versao: number } | null;
  limitesIndividuais: { id: string; usuarioId: string | null; nome: string | null; centavos: string }[];
  situacao: {
    temLimite: boolean;
    limiteCentavos: string | null;
    previstoCentavos: string;
    gastoConfirmadoCentavos: string;
    aguardandoCentavos: string;
    restantePrevistoCentavos: string | null;
    restanteGastoCentavos: string | null;
    percentualPrevisto: number | null;
    percentualGasto: number | null;
    estado: "sem_limite" | "dentro" | "atencao" | "estourado";
    alertas: string[];
    resumo: string;
  };
  planejamento: { previstoCentavos: string; custosAVerificar: number };
  oficial: { gastoConfirmadoCentavos: string; aguardandoCentavos: string };
  rotulos: Record<string, string>;
}

/** Item do checklist da viagem (tela 15). */
export interface ItemChecklistApi {
  id: string;
  viagemId: string;
  autorId: string;
  titulo: string;
  categoria: "documento" | "reserva" | "compras" | "saude" | "outro";
  categoriaRotulo: string;
  responsavelId: string | null;
  prazo: string | null;
  estado: "aberto" | "feito";
  feitoPor: string | null;
  feitoEm: string | null;
  observacao: string | null;
  motivoReabertura: string | null;
  versao: number;
}

/** Documento da viagem (tela 16): o app guarda link/descrição — o arquivo fica onde a pessoa o colocou. */
export interface DocumentoApi {
  id: string;
  viagemId: string;
  autorId: string;
  tipo: "passagem" | "reserva" | "seguro" | "identidade" | "ingresso" | "outro";
  tipoRotulo: string;
  nome: string;
  descricao: string | null;
  link: string | null;
  visibilidade: "privado" | "viagem";
  compartilhadoCom: string[];
  estado: "ativo" | "removido";
  removidoPor: string | null;
  removidoEm: string | null;
  motivoRemocao: string | null;
  versao: number;
}

/** Fechamento da viagem (tela 21): o que o grupo confere e exporta no fim. */
export interface FechamentoApi {
  viagem: { id: string; nome: string; destino: string | null; moeda: string; estado: string };
  geradoEm: string;
  linhas: {
    despesaId: string;
    data: string;
    descricao: string;
    tipo: string;
    estado: string;
    valorCentavos: string;
    moeda: string;
    pagadorId: string;
    pagadorNome: string | null;
    partes: { participanteId: string; nome: string | null; valorCentavos: string }[];
  }[];
  totalConfirmadoCentavos: string;
  totalAguardandoCentavos: string;
  despesasAbertas: number;
  saldos: { participanteId: string; nome: string | null; pagoCentavos: string; parteCentavos: string; saldoCentavos: string }[];
  acertosSugeridos: { deId: string; deNome: string | null; paraId: string; paraNome: string | null; valorCentavos: string }[];
  previstoCentavos: string;
  previstoRoteiroCentavos: string;
  previstoReservasCentavos: string;
  limiteCentavos: string | null;
  alertas: string[];
  /** Texto legível e CSV já prontos no servidor: a tela não remonta exportação. */
  texto: string;
  csv: string;
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

  /**
   * Última saída quando o navegador **não guarda** o cookie de sessão (app embutido): o servidor
   * emite os mesmos tokens do app nativo e eles ficam em `sessionStorage`, só nesta aba.
   * O cookie continua sendo o caminho normal.
   */
  async entrarPorToken(email: string, senha: string): Promise<Usuario> {
    const resposta = await requisitar<{
      usuario: Usuario;
      acesso: { token: string };
      refresh: { token: string };
    }>("/auth/login", {
      metodo: "POST",
      corpo: { email, senha, cliente: "nativo", dispositivo: "navegador-embutido" },
      semRenovacao: true,
    });
    guardarSessaoEmbutida({ acesso: resposta.acesso.token, refresh: resposta.refresh.token });
    return resposta.usuario;
  },

  async sair(): Promise<void> {
    try {
      await requisitar<void>("/auth/logout", { metodo: "POST", semRenovacao: true });
    } finally {
      limparSessaoEmbutida();
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

  async criarViagem(
    dados: {
      nome: string;
      destino: string;
      dataInicio: string | null;
      dataFim: string | null;
    },
    /**
     * Chave de idempotência. Quando a escrita vem da fila offline, é o id da operação:
     * reenviar depois de uma queda de rede nunca cria duas viagens.
     */
    idempotencia: string = crypto.randomUUID(),
  ): Promise<{ id: string }> {
    return requisitar("/viagens", {
      metodo: "POST",
      corpo: { ...dados, fusoHorario: "America/Sao_Paulo", moeda: "BRL" },
      idempotencia,
    });
  },

  async detalheViagem(viagemId: string): Promise<DetalheViagem> {
    return requisitar(`/viagens/${viagemId}`);
  },

  async transicionar(
    viagemId: string,
    para: string,
    motivo?: string,
    versao?: number,
  ): Promise<{ estado: string; rotuloEstado: string }> {
    return requisitar(`/viagens/${viagemId}/transicoes`, {
      metodo: "POST",
      corpo: versao === undefined ? { para, motivo } : { para, motivo, versao },
    });
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
    idempotencia: string = crypto.randomUUID(),
  ): Promise<DespesaApi> {
    return requisitar(`/viagens/${viagemId}/despesas`, {
      metodo: "POST",
      corpo: { ...dados, moeda: "BRL" },
      idempotencia,
    });
  },

  async confirmarDespesa(viagemId: string, despesaId: string): Promise<DespesaApi> {
    return requisitar(`/viagens/${viagemId}/despesas/${despesaId}/confirmar`, { metodo: "POST" });
  },

  async contestarDespesa(viagemId: string, despesaId: string, motivo: string): Promise<DespesaApi> {
    return requisitar(`/viagens/${viagemId}/despesas/${despesaId}/contestar`, { metodo: "POST", corpo: { motivo } });
  },

  async roteiro(viagemId: string): Promise<RoteiroApi> {
    return requisitar(`/viagens/${viagemId}/roteiro`);
  },

  /** Detalhe de uma atividade (inclui o histórico, quando há rede). */
  async detalheAtividade(viagemId: string, atividadeId: string): Promise<DiaRoteiroApi & { historico: unknown[] }> {
    return requisitar(`/viagens/${viagemId}/atividades/${atividadeId}`);
  },

  async criarAtividade(
    viagemId: string,
    dados: {
      dia: string;
      titulo: string;
      hora: string | null;
      duracaoMinutos: number | null;
      local: string | null;
      custoCentavos: string | null;
      custoNatureza: "estimativa" | "compromisso" | "gratuito" | null;
      custoAVerificar: boolean;
      observacao: string | null;
      reservaId: string | null;
      deslocamento: { minutos: number | null; km: number | null; custoCentavos: string | null; alerta: string | null } | null;
    },
    idempotencia: string = crypto.randomUUID(),
  ): Promise<DiaRoteiroApi> {
    return requisitar(`/viagens/${viagemId}/atividades`, { metodo: "POST", corpo: dados, idempotencia });
  },

  async concluirAtividade(
    viagemId: string,
    atividadeId: string,
    dados: { observacao?: string | null; versao?: number } = {},
  ): Promise<DiaRoteiroApi> {
    return requisitar(`/viagens/${viagemId}/atividades/${atividadeId}/concluir`, {
      metodo: "POST",
      corpo: { observacao: dados.observacao ?? null, ...(dados.versao === undefined ? {} : { versao: dados.versao }) },
    });
  },

  async cancelarAtividade(
    viagemId: string,
    atividadeId: string,
    dados: { motivo: string; versao?: number },
  ): Promise<DiaRoteiroApi> {
    return requisitar(`/viagens/${viagemId}/atividades/${atividadeId}/cancelar`, {
      metodo: "POST",
      corpo: { motivo: dados.motivo, ...(dados.versao === undefined ? {} : { versao: dados.versao }) },
    });
  },

  async corrigirAtividade(
    viagemId: string,
    atividadeId: string,
    dados: Record<string, unknown> & { motivo: string },
  ): Promise<DiaRoteiroApi> {
    return requisitar(`/viagens/${viagemId}/atividades/${atividadeId}/corrigir`, { metodo: "POST", corpo: dados });
  },

  async sairDaViagem(viagemId: string): Promise<void> {
    await requisitar(`/viagens/${viagemId}/sair`, { metodo: "POST" });
  },

  async saldos(viagemId: string): Promise<SaldosApi> {
    return requisitar(`/viagens/${viagemId}/saldos`);
  },

  /** Sincronização incremental: só o que mudou desde o cursor (sequência de auditoria). */
  async reservas(viagemId: string): Promise<{ reservas: ReservaApi[]; tipos: { tipo: ReservaApi["tipo"]; rotulo: string }[] }> {
    return requisitar(`/viagens/${viagemId}/reservas`);
  },

  async detalheReserva(viagemId: string, reservaId: string): Promise<{ reserva: ReservaApi; historico: { acao: string; autorId: string; em: string; motivo: string | null }[] }> {
    return requisitar(`/viagens/${viagemId}/reservas/${reservaId}`);
  },

  async criarReserva(
    viagemId: string,
    corpo: { tipo: ReservaApi["tipo"]; titulo: string; local?: string | null; inicio?: string | null; fim?: string | null; custoCentavos?: string | null },
    idempotencia?: string,
  ): Promise<{ reserva: ReservaApi }> {
    return requisitar(`/viagens/${viagemId}/reservas`, {
      metodo: "POST",
      corpo,
      ...(idempotencia === undefined ? {} : { idempotencia }),
    });
  },

  async confirmarReserva(viagemId: string, reservaId: string, confirmacao: string, versao?: number): Promise<{ reserva: ReservaApi }> {
    return requisitar(`/viagens/${viagemId}/reservas/${reservaId}/confirmar`, {
      metodo: "POST",
      corpo: versao === undefined ? { confirmacao } : { confirmacao, versao },
    });
  },

  async cancelarReserva(viagemId: string, reservaId: string, motivo: string, versao?: number): Promise<{ reserva: ReservaApi }> {
    return requisitar(`/viagens/${viagemId}/reservas/${reservaId}/cancelar`, {
      metodo: "POST",
      corpo: versao === undefined ? { motivo } : { motivo, versao },
    });
  },

  async orcamento(viagemId: string): Promise<OrcamentoApi> {
    return requisitar<OrcamentoApi>(`/viagens/${viagemId}/orcamento`);
  },

  async definirLimiteColetivo(viagemId: string, centavos: string): Promise<{ limite: { centavos: string } }> {
    return requisitar(`/viagens/${viagemId}/orcamento/limite`, { metodo: "PUT", corpo: { centavos } });
  },

  async definirLimiteIndividual(viagemId: string, usuarioId: string, centavos: string): Promise<{ limite: { centavos: string } }> {
    return requisitar(`/viagens/${viagemId}/orcamento/limites/${usuarioId}`, { metodo: "PUT", corpo: { centavos } });
  },

  async fechamento(viagemId: string): Promise<FechamentoApi> {
    return requisitar<FechamentoApi>(`/viagens/${viagemId}/fechamento`);
  },

  async checklist(viagemId: string): Promise<{ itens: ItemChecklistApi[]; categorias: { categoria: string; rotulo: string }[]; permissoes: Record<string, boolean> }> {
    return requisitar(`/viagens/${viagemId}/checklist`);
  },

  async criarItemChecklist(
    viagemId: string,
    corpo: { titulo: string; categoria?: string; responsavelId?: string | null; prazo?: string | null; observacao?: string | null },
    idempotencia: string,
  ): Promise<{ item: ItemChecklistApi }> {
    return requisitar(`/viagens/${viagemId}/checklist`, { metodo: "POST", corpo, idempotencia });
  },

  async concluirItemChecklist(viagemId: string, itemId: string, versao?: number): Promise<{ item: ItemChecklistApi }> {
    return requisitar(`/viagens/${viagemId}/checklist/${itemId}/concluir`, { metodo: "POST", corpo: versao === undefined ? {} : { versao } });
  },

  async reabrirItemChecklist(viagemId: string, itemId: string, motivo: string, versao?: number): Promise<{ item: ItemChecklistApi }> {
    return requisitar(`/viagens/${viagemId}/checklist/${itemId}/reabrir`, {
      metodo: "POST",
      corpo: versao === undefined ? { motivo } : { motivo, versao },
    });
  },

  async documentos(viagemId: string): Promise<{ documentos: DocumentoApi[]; tipos: { tipo: string; rotulo: string }[]; avisoDePrivacidade: string }> {
    return requisitar(`/viagens/${viagemId}/documentos`);
  },

  async criarDocumento(
    viagemId: string,
    corpo: { tipo: string; nome: string; descricao?: string | null; link?: string | null },
    idempotencia: string,
  ): Promise<{ documento: DocumentoApi }> {
    return requisitar(`/viagens/${viagemId}/documentos`, { metodo: "POST", corpo, idempotencia });
  },

  async impactoDocumento(viagemId: string, documentoId: string, acao: "compartilhar" | "remover"): Promise<{ impacto: { itens: string[]; atencao: string[] } }> {
    return requisitar(`/viagens/${viagemId}/documentos/${documentoId}/impacto?acao=${acao}`);
  },

  async compartilharDocumento(viagemId: string, documentoId: string, com: "viagem" | string[], versao?: number): Promise<{ documento: DocumentoApi }> {
    return requisitar(`/viagens/${viagemId}/documentos/${documentoId}/compartilhar`, {
      metodo: "POST",
      corpo: versao === undefined ? { com } : { com, versao },
    });
  },

  async revogarDocumento(viagemId: string, documentoId: string, com: "viagem" | string[], versao?: number): Promise<{ documento: DocumentoApi }> {
    return requisitar(`/viagens/${viagemId}/documentos/${documentoId}/revogar`, {
      metodo: "POST",
      corpo: versao === undefined ? { com } : { com, versao },
    });
  },

  async removerDocumento(viagemId: string, documentoId: string, motivo: string, versao?: number): Promise<{ documento: DocumentoApi }> {
    return requisitar(`/viagens/${viagemId}/documentos/${documentoId}/remover`, {
      metodo: "POST",
      corpo: versao === undefined ? { motivo } : { motivo, versao },
    });
  },

  async mudancas(viagemId: string, cursor: string | null): Promise<MudancasApi> {
    const desde = cursor ?? "0";
    return requisitar(`/viagens/${viagemId}/mudancas?desde=${encodeURIComponent(desde)}`);
  },

  async listarMovimentos(viagemId: string): Promise<{ movimentos: MovimentoApi[] }> {
    return requisitar(`/viagens/${viagemId}/movimentos`);
  },

  /** Acerto entre duas pessoas. Nada é transferido de verdade: é registro do que combinaram. */
  async criarMovimento(
    viagemId: string,
    dados: { deId: string; paraId: string; valorCentavos: string; despesaId?: string | null },
    idempotencia: string = crypto.randomUUID(),
  ): Promise<MovimentoApi> {
    return requisitar(`/viagens/${viagemId}/movimentos`, {
      metodo: "POST",
      corpo: { ...dados, despesaId: dados.despesaId ?? null },
      idempotencia,
    });
  },

  async confirmarMovimento(viagemId: string, movimentoId: string): Promise<MovimentoApi> {
    return requisitar(`/viagens/${viagemId}/movimentos/${movimentoId}/confirmar`, { metodo: "POST" });
  },

  async contestarMovimento(viagemId: string, movimentoId: string, motivo: string): Promise<MovimentoApi> {
    return requisitar(`/viagens/${viagemId}/movimentos/${movimentoId}/contestar`, {
      metodo: "POST",
      corpo: { motivo },
    });
  },
};
