/**
 * Central de notificações (tela 16): o que precisa de alguém, dito sem alarme falso.
 *
 * Três regras que este arquivo garante:
 *
 *  1. **toda notificação nasce de um fato**, não de um relógio de engajamento: cada uma aponta para
 *     um dado real (despesa esperando confirmação, convite sem aceite, item atrasado, orçamento em
 *     atenção). Não existe "você não abre o app há três dias";
 *  2. **leitura ≠ dispensa ≠ resolução**: ler é "eu vi" (continua aberta), dispensar é escolha da
 *     pessoa (some da lista, mas **volta se o fato mudar** — a chave carrega a revisão do dado), e
 *     resolver é a obrigação deixar de existir nos dados. Resolver **não se marca na mão**: acontece
 *     quando a despesa é confirmada, o convite é aceito, o item é concluído. Nada de botão que finge
 *     que o mundo mudou (§13);
 *  3. **prioridade alta é obrigação de quem pergunta** (ou dinheiro parado): o que depende de outra
 *     pessoa é informativo, e o texto diz de quem depende.
 *
 * Quem confirma o quê: quem lançou uma despesa **não** pode confirmá-la (revisão independente, ver
 * `podeConfirmarDespesa`), então a pendência de uma viagem é fato do grupo — o texto não acusa ninguém.
 */
import type { Centavos } from "./money.ts";
import { formatarBRL } from "./money.ts";
import type { EstadoDoOrcamento } from "./orcamento.ts";
import type { EstadoViagem } from "./trip-state.ts";
import type { ItemChecklist } from "./checklist.ts";
import { itemAtrasado, itemParaHoje } from "./checklist.ts";

export type TipoNotificacao =
  | "despesa_pendente"
  | "acerto_confirmar"
  | "acerto_aguardando"
  | "convite_recebido"
  | "convite_sem_aceite"
  | "convite_expirado"
  | "checklist_atrasado"
  | "checklist_hoje"
  | "reserva_sem_valor"
  | "orcamento_atencao"
  | "orcamento_estourado"
  | "viagem_rascunho";

export type CategoriaNotificacao = "dinheiro" | "acerto" | "convite" | "checklist" | "reserva" | "orcamento" | "viagem";

export const CATEGORIAS_NOTIFICACAO: readonly CategoriaNotificacao[] = [
  "dinheiro",
  "acerto",
  "convite",
  "checklist",
  "reserva",
  "orcamento",
  "viagem",
];

export const ROTULO_CATEGORIA_NOTIFICACAO: Record<CategoriaNotificacao, string> = {
  dinheiro: "Dinheiro",
  acerto: "Acertos",
  convite: "Convites",
  checklist: "Checklist",
  reserva: "Reservas",
  orcamento: "Orçamento",
  viagem: "Viagem",
};

export type PrioridadeNotificacao = "alta" | "media" | "baixa";

export const PRIORIDADES_NOTIFICACAO: readonly PrioridadeNotificacao[] = ["alta", "media", "baixa"];

export const ROTULO_PRIORIDADE_NOTIFICACAO: Record<PrioridadeNotificacao, string> = {
  alta: "Alta prioridade",
  media: "Média prioridade",
  baixa: "Baixa prioridade",
};

/** Para onde a pessoa vai quando toca na notificação — sempre dentro do app, nunca ação externa. */
export type DestinoNotificacao =
  | "visao"
  | "roteiro"
  | "gastos"
  | "orcamento"
  | "checklist"
  | "reservas"
  | "documentos"
  | "participantes";

export interface Notificacao {
  /**
   * Chave estável: a mesma obrigação tem sempre a mesma chave, e a chave **muda quando o fato muda**
   * (revisão do dado). É o que impede que uma dispensa esconda para sempre um problema que piorou.
   */
  chave: string;
  tipo: TipoNotificacao;
  categoria: CategoriaNotificacao;
  prioridade: PrioridadeNotificacao;
  /** O que aconteceu, em uma linha. */
  titulo: string;
  /** Por que isso importa e de quem depende, sem culpar ninguém. */
  detalhe: string;
  viagemId: string | null;
  viagemNome: string | null;
  /** Quando o fato começou (prazo, data da reserva), quando o dado sabe disso. Nunca inventado. */
  desde: string | null;
  /** O próximo passo concreto: rótulo do botão + para onde ele leva. */
  acao: string;
  destino: DestinoNotificacao;
  /** É obrigação de quem está perguntando? (Alta prioridade só existe aqui ou em dinheiro parado.) */
  minha: boolean;
}

/** Viagem como a lista do aparelho traz: é dela que sai a pendência financeira de todas as viagens. */
export interface ViagemParaNotificar {
  id: string;
  nome: string;
  estado: EstadoViagem;
  papel: "organizador" | "participante";
  /** Quantas despesas estão pendentes/contestadas (contagem do servidor). */
  pendenciasFinanceiras: number;
  dataInicio?: string | null;
}

export interface ConviteParaNotificar {
  id: string;
  /** E-mail do convidado (convite enviado) — o texto mostra para quem foi. */
  email?: string | null;
  estado: string;
  expiraEm?: string | null;
}

export interface MovimentoParaNotificar {
  id: string;
  deId: string;
  paraId: string;
  valorCentavos: Centavos;
  estado: string;
}

export interface OrcamentoParaNotificar {
  estado: EstadoDoOrcamento;
  limiteCentavos: Centavos | null;
  /** Percentuais são `null` quando não há limite definido (sem limite não há porcentagem). */
  percentualPrevisto: number | null;
  percentualGasto: number | null;
}

export interface ViagemAbertaParaNotificar {
  id: string;
  nome: string;
  /** Convites que **eu** (organizador) enviei e ainda estão pendentes. */
  convites: readonly ConviteParaNotificar[];
  movimentos: readonly MovimentoParaNotificar[];
  itensChecklist: readonly ItemChecklist[];
  /** Reservas sem valor informado: o orçamento fica incompleto e isso precisa aparecer. */
  reservasSemValor: readonly { id: string; titulo: string; inicio?: string | null }[];
  orcamento: OrcamentoParaNotificar | null;
}

export interface EntradaDeNotificacoes {
  usuarioId: string;
  /** Hoje no formato AAAA-MM-DD (o prazo é fato do calendário, não do relógio do servidor). */
  hoje: string;
  viagens: readonly ViagemParaNotificar[];
  /** Convites que eu recebi e ainda não aceitei. */
  convitesRecebidos?: readonly { id: string; viagemId: string; viagemNome: string; expiraEm?: string | null }[];
  /** Nomes de quem participa, para o texto falar de gente: `usuarioId` → nome. */
  nomes?: Readonly<Record<string, string>>;
  /** Dados da viagem aberta no aparelho: o resto das obrigações vive aqui. */
  viagemAberta?: ViagemAbertaParaNotificar | null;
}

function nomeDe(nomes: Readonly<Record<string, string>> | undefined, id: string | null | undefined, reserva: string): string {
  if (!id) return reserva;
  return nomes?.[id] ?? reserva;
}

function plural(quantidade: number, singular: string, multiplo: string): string {
  return quantidade === 1 ? singular : multiplo;
}

/**
 * Prioridade de um item do checklist. Regra: **alta** só quando o item é de quem pergunta e o prazo
 * já passou (é obrigação minha, com data vencida). Sem responsável é média: é do grupo, e alguém
 * precisa assumir. Item de outra pessoa é lembrete, nunca cobrança.
 */
function prioridadeDoChecklist(opcoes: { atrasado: boolean; meu: boolean; semDono: boolean }): PrioridadeNotificacao {
  if (opcoes.meu) return opcoes.atrasado ? "alta" : "media";
  if (opcoes.semDono) return "media";
  return "baixa";
}

/** Data ISO do prazo no formato curto que a interface usa (DD/MM), sem inventar fuso. */
function dataCurta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}` : null;
}

/**
 * Monta a lista de notificações **abertas** a partir do que os dados dizem.
 *
 * A ordem de saída não importa: quem ordena é `ordenarNotificacoes` (e a tela reordena por filtro).
 */
export function montarNotificacoes(entrada: EntradaDeNotificacoes): Notificacao[] {
  const { usuarioId, hoje, nomes } = entrada;
  const lista: Notificacao[] = [];

  // 1. Convites que chegaram para mim: esperam ação minha. Ninguém aceita por mim.
  for (const convite of entrada.convitesRecebidos ?? []) {
    const venceu = convite.expiraEm !== null && convite.expiraEm !== undefined && convite.expiraEm.slice(0, 10) < hoje;
    lista.push({
      chave: `convite-recebido:${convite.id}`,
      tipo: "convite_recebido",
      categoria: "convite",
      prioridade: "alta",
      titulo: venceu ? `O convite para "${convite.viagemNome}" venceu` : `Convite para "${convite.viagemNome}" esperando você`,
      detalhe: venceu
        ? "O prazo do convite passou. Peça um novo convite a quem organiza — o antigo não dá mais acesso."
        : "Ninguém entra por você: aceitar é a sua confirmação, e você continua podendo recusar.",
      viagemId: convite.viagemId,
      viagemNome: convite.viagemNome,
      desde: null,
      acao: "Ver convites",
      destino: "participantes",
      minha: true,
    });
  }

  // 2. Viagens: dinheiro parado esperando revisão de outra pessoa, e rascunho sem planejamento.
  for (const viagem of entrada.viagens) {
    if (viagem.pendenciasFinanceiras > 0 && viagem.estado !== "cancelada") {
      const acontecendo = viagem.estado === "em_andamento" || viagem.estado === "concluida";
      lista.push({
        chave: `despesa-pendente:${viagem.id}:${viagem.pendenciasFinanceiras}`,
        tipo: "despesa_pendente",
        categoria: "dinheiro",
        prioridade: acontecendo ? "alta" : "media",
        titulo: `${viagem.pendenciasFinanceiras} ${plural(viagem.pendenciasFinanceiras, "despesa", "despesas")} em "${viagem.nome}" esperando confirmação`,
        detalhe: acontecendo
          ? "Enquanto ninguém revisa, esse valor não entra no saldo oficial — e a viagem já está acontecendo (ou terminou)."
          : "Quem lançou não pode confirmar o próprio lançamento: outra pessoa precisa revisar.",
        viagemId: viagem.id,
        viagemNome: viagem.nome,
        desde: null,
        acao: "Ver despesas",
        destino: "gastos",
        minha: false,
      });
    }

    if (viagem.estado === "rascunho" && viagem.papel === "organizador") {
      lista.push({
        chave: `viagem-rascunho:${viagem.id}`,
        tipo: "viagem_rascunho",
        categoria: "viagem",
        prioridade: "baixa",
        titulo: `"${viagem.nome}" ainda é rascunho`,
        detalhe: viagem.dataInicio
          ? "Confira as datas e marque como planejada quando elas estiverem certas — o estado da viagem nunca muda sozinho."
          : "Faltam as datas: sem elas, o convite e o roteiro ficam sem referência. O estado nunca muda sozinho.",
        viagemId: viagem.id,
        viagemNome: viagem.nome,
        desde: null,
        acao: "Abrir viagem",
        destino: "visao",
        minha: true,
      });
    }
  }

  const aberta = entrada.viagemAberta;
  if (!aberta) return ordenarNotificacoes(lista);

  // 3. Acertos: pagamento informado precisa de confirmação de quem recebeu.
  for (const movimento of aberta.movimentos) {
    if (movimento.estado !== "informado") continue;
    const valor = formatarBRL(movimento.valorCentavos);
    const recebedorSouEu = movimento.paraId === usuarioId;
    const pagueiSouEu = movimento.deId === usuarioId;
    if (recebedorSouEu) {
      lista.push({
        chave: `acerto-confirmar:${movimento.id}:${movimento.valorCentavos.toString()}`,
        tipo: "acerto_confirmar",
        categoria: "acerto",
        prioridade: "alta",
        titulo: `${nomeDe(nomes, movimento.deId, "Alguém")} informou um pagamento de ${valor}`,
        detalhe: "Informar não é pagar: o valor só entra no saldo oficial quando você confirma que recebeu.",
        viagemId: aberta.id,
        viagemNome: aberta.nome,
        desde: null,
        acao: "Conferir acertos",
        destino: "gastos",
        minha: true,
      });
    } else if (pagueiSouEu) {
      lista.push({
        chave: `acerto-aguardando:${movimento.id}:${movimento.valorCentavos.toString()}`,
        tipo: "acerto_aguardando",
        categoria: "acerto",
        prioridade: "baixa",
        titulo: `Seu pagamento de ${valor} aguarda confirmação`,
        detalhe: `${nomeDe(nomes, movimento.paraId, "A outra pessoa")} ainda não confirmou. O valor está registrado, fora do saldo oficial.`,
        viagemId: aberta.id,
        viagemNome: aberta.nome,
        desde: null,
        acao: "Ver acertos",
        destino: "gastos",
        minha: false,
      });
    }
  }

  // 4. Convites que eu enviei: o grupo não fecha enquanto a pessoa não aceitar.
  for (const convite of aberta.convites) {
    if (convite.estado !== "pendente") continue;
    const venceu = convite.expiraEm !== null && convite.expiraEm !== undefined && convite.expiraEm.slice(0, 10) < hoje;
    const quem = convite.email ?? "convidado";
    lista.push({
      chave: `convite-enviado:${convite.id}`,
      tipo: venceu ? "convite_expirado" : "convite_sem_aceite",
      categoria: "convite",
      prioridade: venceu ? "alta" : "media",
      titulo: venceu ? `O convite de ${quem} venceu` : `${quem} ainda não aceitou o convite`,
      detalhe: venceu
        ? "O prazo passou e o convite não dá mais acesso. Convide de novo quando quiser."
        : "O acesso só começa depois do aceite dela — até lá, a viagem não aparece para essa pessoa.",
      viagemId: aberta.id,
      viagemNome: aberta.nome,
      desde: null,
      acao: "Ver participantes",
      destino: "participantes",
      minha: true,
    });
  }

  // 5. Checklist: atrasado e para hoje. O prazo não conclui nada, então isto é lembrete — não prova.
  for (const item of aberta.itensChecklist) {
    const atrasado = itemAtrasado(item, hoje);
    const paraHoje = itemParaHoje(item, hoje);
    if (!atrasado && !paraHoje) continue;

    const meu = item.responsavelId === usuarioId;
    const semDono = item.responsavelId === null;
    const dono = item.responsavelId === null ? null : nomeDe(nomes, item.responsavelId, "um participante");
    const prazo = dataCurta(item.prazo);
    lista.push({
      chave: `checklist-${atrasado ? "atrasado" : "hoje"}:${item.id}:${item.versao}`,
      tipo: atrasado ? "checklist_atrasado" : "checklist_hoje",
      categoria: "checklist",
      prioridade: prioridadeDoChecklist({ atrasado, meu, semDono }),
      titulo: atrasado ? `Atrasado: ${item.titulo}` : `Para hoje: ${item.titulo}`,
      detalhe: meu
        ? atrasado
          ? `O prazo era ${prazo} e passou. Ninguém conclui por você: marque como feito quando resolver.`
          : `O prazo é hoje${prazo ? ` (${prazo})` : ""}. Se não for mais fazer sentido, dá para mudar o prazo.`
        : semDono
          ? `Ninguém pegou este item${prazo ? ` e o prazo é ${prazo}` : ""}. Quem fizer, assume.`
          : `Está com ${dono}${prazo ? ` (prazo ${prazo})` : ""}. Isto é um lembrete, não uma ordem.`,
      viagemId: aberta.id,
      viagemNome: aberta.nome,
      desde: item.prazo,
      acao: "Abrir checklist",
      destino: "checklist",
      minha: meu,
    });
  }

  // 6. Reservas sem valor: o orçamento fica menor do que a conta real, e alguém precisa olhar.
  for (const reserva of aberta.reservasSemValor) {
    const quando = dataCurta(reserva.inicio);
    lista.push({
      chave: `reserva-sem-valor:${reserva.id}`,
      tipo: "reserva_sem_valor",
      categoria: "reserva",
      prioridade: "media",
      titulo: `"${reserva.titulo}" está sem valor`,
      detalhe: `Enquanto ninguém informa o valor, o orçamento conta esta reserva como "a verificar"${quando ? ` (${quando})` : ""} — nunca como zero.`,
      viagemId: aberta.id,
      viagemNome: aberta.nome,
      desde: reserva.inicio ?? null,
      acao: "Abrir reservas",
      destino: "reservas",
      minha: false,
    });
  }

  // 7. Orçamento: atenção e estouro são fatos do planejamento, não do saldo oficial.
  const orcamento = aberta.orcamento;
  if (orcamento && (orcamento.estado === "atencao" || orcamento.estado === "estourado")) {
    const percentual = Math.max(orcamento.percentualPrevisto ?? 0, orcamento.percentualGasto ?? 0);
    const estourou = orcamento.estado === "estourado";
    lista.push({
      chave: `orcamento-${orcamento.estado}:${aberta.id}:${percentual}`,
      tipo: estourou ? "orcamento_estourado" : "orcamento_atencao",
      categoria: "orcamento",
      prioridade: estourou ? "alta" : "media",
      titulo: estourou
        ? `O orçamento de "${aberta.nome}" passou do limite (${percentual}%)`
        : `O orçamento de "${aberta.nome}" chegou a ${percentual}% do limite`,
      detalhe: estourou
        ? "Limite é planejamento: o gasto oficial continua o que está confirmado. Vale revisar o que já está combinado."
        : "Passou da marca de atenção. Nada foi alterado sozinho — revise o roteiro e as reservas quando puder.",
      viagemId: aberta.id,
      viagemNome: aberta.nome,
      desde: null,
      acao: "Ver orçamento",
      destino: "orcamento",
      minha: false,
    });
  }

  return ordenarNotificacoes(lista);
}

// ---------------------------------------------------------------------------
// Estado por aparelho: lida / dispensada (nunca "resolvida" — isso vem do fato)
// ---------------------------------------------------------------------------

export type MarcaNotificacao = "lida" | "dispensada";

export interface MarcaDeNotificacao {
  chave: string;
  estado: MarcaNotificacao;
  /** Quando a pessoa marcou (a tela usa para o histórico). */
  em: string;
  /** Cópia do essencial: serve para o histórico mostrar o que era, mesmo depois que a notificação sumiu. */
  titulo: string;
  viagemId: string | null;
  viagemNome: string | null;
  categoria: CategoriaNotificacao;
  prioridade: PrioridadeNotificacao;
}

export type MarcasDeNotificacao = Record<string, MarcaDeNotificacao>;

export const MARCAS_VAZIAS: MarcasDeNotificacao = {};

export type EstadoComputado = "nova" | "lida" | "dispensada";

export interface NotificacaoComEstado extends Notificacao {
  estado: EstadoComputado;
}

/** Notificação que existia e **deixou de existir**: a obrigação foi resolvida nos dados reais. */
export interface NotificacaoResolvida {
  chave: string;
  titulo: string;
  viagemId: string | null;
  viagemNome: string | null;
  categoria: CategoriaNotificacao;
  prioridade: PrioridadeNotificacao;
  /** Quando a pessoa tinha visto por último (a data da marca) — é a melhor data honesta que temos. */
  em: string;
}

export function estadoDaNotificacao(notificacao: Pick<Notificacao, "chave">, marcas: MarcasDeNotificacao): EstadoComputado {
  return marcas[notificacao.chave]?.estado ?? "nova";
}

export function aplicarMarcas(
  notificacoes: readonly Notificacao[],
  marcas: MarcasDeNotificacao,
): NotificacaoComEstado[] {
  return notificacoes.map((notificacao) => ({ ...notificacao, estado: estadoDaNotificacao(notificacao, marcas) }));
}

/** Guarda a marca da pessoa. Marcar de novo atualiza (ler uma dispensada não a traz de volta). */
export function marcarNotificacao(
  marcas: MarcasDeNotificacao,
  notificacao: Notificacao,
  estado: MarcaNotificacao,
  em: string,
): MarcasDeNotificacao {
  return {
    ...marcas,
    [notificacao.chave]: {
      chave: notificacao.chave,
      estado,
      em,
      titulo: notificacao.titulo,
      viagemId: notificacao.viagemId,
      viagemNome: notificacao.viagemNome,
      categoria: notificacao.categoria,
      prioridade: notificacao.prioridade,
    },
  };
}

/** Volta a notificação para "ainda não vi" (o botão "marcar como não lida"). */
export function desmarcarNotificacao(marcas: MarcasDeNotificacao, chave: string): MarcasDeNotificacao {
  if (!(chave in marcas)) return marcas;
  const copia = { ...marcas };
  delete copia[chave];
  return copia;
}

/**
 * Marcas cujo fato não existe mais **não** são lixo: são o histórico do que foi resolvido de verdade.
 * Ordenado da marca mais recente para a mais antiga.
 */
export function notificacoesResolvidas(
  marcas: MarcasDeNotificacao,
  abertas: readonly Notificacao[],
): NotificacaoResolvida[] {
  const chavesAbertas = new Set(abertas.map((notificacao) => notificacao.chave));
  return Object.values(marcas)
    .filter((marca) => !chavesAbertas.has(marca.chave))
    .sort((a, b) => (a.em < b.em ? 1 : a.em > b.em ? -1 : 0))
    .map((marca) => ({
      chave: marca.chave,
      titulo: marca.titulo,
      viagemId: marca.viagemId,
      viagemNome: marca.viagemNome,
      categoria: marca.categoria,
      prioridade: marca.prioridade,
      em: marca.em,
    }));
}

/** Teto de marcas guardadas: o histórico não pode crescer para sempre no aparelho. */
export function podarMarcas(marcas: MarcasDeNotificacao, maximo = 200): MarcasDeNotificacao {
  const todas = Object.values(marcas);
  if (todas.length <= maximo) return marcas;
  const manter = todas
    .sort((a, b) => (a.em < b.em ? 1 : a.em > b.em ? -1 : 0))
    .slice(0, maximo)
    .map((marca) => marca.chave);
  const conjunto = new Set(manter);
  return Object.fromEntries(todas.filter((marca) => conjunto.has(marca.chave)).map((marca) => [marca.chave, marca]));
}

// ---------------------------------------------------------------------------
// Filtros, ordem e resumo
// ---------------------------------------------------------------------------

export type FiltroDeEstado = "abertas" | "nao_lidas" | "dispensadas" | "todas";

export const FILTROS_DE_ESTADO: readonly { valor: FiltroDeEstado; rotulo: string }[] = [
  { valor: "abertas", rotulo: "Abertas" },
  { valor: "nao_lidas", rotulo: "Não lidas" },
  { valor: "dispensadas", rotulo: "Dispensadas" },
  { valor: "todas", rotulo: "Todas" },
];

export interface FiltrosDeNotificacao {
  viagemId?: string | null;
  categoria?: CategoriaNotificacao | null;
  prioridade?: PrioridadeNotificacao | null;
  estado?: FiltroDeEstado;
  /** Mostra apenas o que é obrigação de quem está vendo. */
  soMinhas?: boolean;
  /** Busca livre em título, detalhe e nome da viagem (sem acento é com quem chama). */
  busca?: string;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function filtrarNotificacoes(
  notificacoes: readonly NotificacaoComEstado[],
  filtros: FiltrosDeNotificacao = {},
): NotificacaoComEstado[] {
  const estado = filtros.estado ?? "abertas";
  const busca = filtros.busca ? normalizar(filtros.busca.trim()) : "";

  return notificacoes.filter((notificacao) => {
    if (filtros.viagemId && notificacao.viagemId !== filtros.viagemId) return false;
    if (filtros.categoria && notificacao.categoria !== filtros.categoria) return false;
    if (filtros.prioridade && notificacao.prioridade !== filtros.prioridade) return false;
    if (filtros.soMinhas && !notificacao.minha) return false;

    // Estado: "abertas" inclui as lidas (ler não resolve nada); "dispensadas" é o que a pessoa
    // tirou da frente de propósito.
    if (estado === "abertas" && notificacao.estado === "dispensada") return false;
    if (estado === "nao_lidas" && notificacao.estado !== "nova") return false;
    if (estado === "dispensadas" && notificacao.estado !== "dispensada") return false;

    if (busca) {
      const alvo = normalizar(`${notificacao.titulo} ${notificacao.detalhe} ${notificacao.viagemNome ?? ""}`);
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });
}

const PESO_PRIORIDADE: Record<PrioridadeNotificacao, number> = { alta: 0, media: 1, baixa: 2 };

/**
 * Ordem de leitura: o que exige alguém primeiro (alta), depois média, depois baixa; dentro do mesmo
 * peso, o que ainda não foi visto vem antes do que já foi lido.
 */
export function ordenarNotificacoes<T extends Notificacao | NotificacaoComEstado>(notificacoes: readonly T[]): T[] {
  const estadoDe = (notificacao: T): number => {
    const estado = (notificacao as NotificacaoComEstado).estado;
    if (estado === "nova") return 0;
    if (estado === "lida") return 1;
    return 2;
  };
  return [...notificacoes].sort((a, b) => {
    const porPrioridade = PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade];
    if (porPrioridade !== 0) return porPrioridade;
    const porEstado = estadoDe(a) - estadoDe(b);
    if (porEstado !== 0) return porEstado;
    return a.titulo.localeCompare(b.titulo, "pt-BR");
  });
}

export interface ResumoDeNotificacoes {
  /** Abertas por prioridade (lidas incluídas: ler não resolve). */
  alta: number;
  media: number;
  baixa: number;
  abertas: number;
  naoLidas: number;
  dispensadas: number;
  resolvidas: number;
  rotulo: string;
}

export function resumirNotificacoes(
  abertas: readonly NotificacaoComEstado[],
  resolvidas: readonly NotificacaoResolvida[] = [],
): ResumoDeNotificacoes {
  let alta = 0;
  let media = 0;
  let baixa = 0;
  let naoLidas = 0;
  let dispensadas = 0;
  let visiveis = 0;

  for (const notificacao of abertas) {
    if (notificacao.estado === "dispensada") {
      dispensadas += 1;
      continue;
    }
    visiveis += 1;
    if (notificacao.estado === "nova") naoLidas += 1;
    if (notificacao.prioridade === "alta") alta += 1;
    else if (notificacao.prioridade === "media") media += 1;
    else baixa += 1;
  }

  const partes: string[] = [];
  if (visiveis === 0) partes.push("Nada pendente por aqui");
  else {
    partes.push(visiveis === 1 ? "1 notificação aberta" : `${visiveis} notificações abertas`);
    if (naoLidas > 0) partes.push(naoLidas === 1 ? "1 não lida" : `${naoLidas} não lidas`);
    if (alta > 0) partes.push(alta === 1 ? "1 de alta prioridade" : `${alta} de alta prioridade`);
  }
  if (dispensadas > 0) partes.push(dispensadas === 1 ? "1 dispensada" : `${dispensadas} dispensadas`);
  if (resolvidas.length > 0) partes.push(resolvidas.length === 1 ? "1 resolvida" : `${resolvidas.length} resolvidas`);

  return { alta, media, baixa, abertas: visiveis, naoLidas, dispensadas, resolvidas: resolvidas.length, rotulo: partes.join(" · ") };
}

/** Quais viagens aparecem no filtro: só as que têm notificação (evita lista de opções sem sentido). */
export function viagensComNotificacao(
  abertas: readonly NotificacaoComEstado[],
  resolvidas: readonly NotificacaoResolvida[] = [],
): { id: string; nome: string }[] {
  const porId = new Map<string, string>();
  for (const notificacao of [...abertas, ...resolvidas]) {
    if (notificacao.viagemId && notificacao.viagemNome) porId.set(notificacao.viagemId, notificacao.viagemNome);
  }
  return [...porId].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
