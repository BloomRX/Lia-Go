/**
 * Roteiro (itinerário da viagem): regras puras, sem I/O.
 *
 * Diretrizes confirmadas pelo responsável (`docs/UI_VISUAL_GUIDELINES.md`, §2) que este arquivo
 * garante — não são detalhes de tela, são regras de negócio:
 *
 *  1. **O relógio nunca conclui uma atividade.** Passar do horário só muda o que a tela mostra
 *     (`situacaoPorHorario`); o estado só muda por ação de uma pessoa.
 *  2. **Horário flexível não recebe horário inventado.** A atividade continua na sequência lógica
 *     definida por quem planejou (`ordem`), marcada como flexível.
 *  3. **Custo desconhecido nunca vira `R$ 0,00`.** São três coisas diferentes: desconhecido
 *     (omitido), "a verificar" (sinalizado) e gratuito (zero explícito).
 *  4. **Conflito é explicado, nunca resolvido sozinho.** O Lia Go não move horários nem reservas:
 *     mostra o conflito no resumo do dia e nas atividades envolvidas, com o que fazer.
 *  5. **O roteiro não mexe em dinheiro oficial.** Nada aqui altera saldos ou despesas.
 */
import { ErroDeDominio } from "./erros.ts";
import type { ContextoAutorizacao } from "./permissions.ts";
import { decidirAutorizacao } from "./permissions.ts";

export type EstadoAtividade = "planejada" | "concluida" | "cancelada";

/**
 * Natureza do valor informado:
 *  - `estimativa`  → previsão de gasto (ainda pode mudar);
 *  - `compromisso` → valor assumido (reserva/pagamento já combinado);
 *  - `gratuito`    → de graça, com zero explícito (diferente de "não sei").
 */
export type NaturezaCusto = "estimativa" | "compromisso" | "gratuito";

export interface Deslocamento {
  /** Tempo previsto de deslocamento até esta atividade (a partir da anterior). */
  minutos: number | null;
  km: number | null;
  /** Custo do trecho (transporte, pedágio). Null quando não se sabe. */
  custoCentavos: bigint | null;
  /** Texto curto sobre risco material: "pode perder a reserva se atrasar". */
  alerta: string | null;
}

export interface Atividade {
  id: string;
  viagemId: string;
  autorId: string;
  /** Dia do roteiro (`AAAA-MM-DD`). */
  dia: string;
  /** Sequência lógica dentro do dia, definida por quem planejou (nunca ordenada por horário). */
  ordem: number;
  titulo: string;
  /** "HH:MM" quando o horário é definido; `null` quando é flexível. */
  hora: string | null;
  duracaoMinutos: number | null;
  local: string | null;
  /** Custo em centavos: `null` = desconhecido (nunca exibido como zero); `0n` = gratuito. */
  custoCentavos: bigint | null;
  custoNatureza: NaturezaCusto | null;
  /** O autor marcou "custo a verificar": relevante para o orçamento. */
  custoAVerificar: boolean;
  estado: EstadoAtividade;
  concluidaPor: string | null;
  concluidaEm: string | null;
  observacao: string | null;
  deslocamento: Deslocamento | null;
  versao: number;
}

/** Como o horário se apresenta agora. É só exibição: **não** é estado da atividade. */
export type SituacaoPorHorario = "sem_horario" | "futura" | "em_curso" | "passou" | "encerrada";

export type TipoConflito = "sobreposicao" | "deslocamento_insuficiente";

export interface Conflito {
  tipo: TipoConflito;
  /** Atividades envolvidas (as duas, na ordem do roteiro). */
  atividadeIds: string[];
  /** Explicação em português simples, pronta para a tela. */
  explicacao: string;
  /** O que a pessoa pode fazer. O Lia Go nunca resolve sozinho. */
  sugestao: string;
}

export interface ResumoDia {
  total: number;
  concluidas: number;
  canceladas: number;
  planejadas: number;
  comHorarioDefinido: number;
  flexiveis: number;
  /** Soma **apenas** dos custos conhecidos (nunca trata desconhecido como zero). */
  custoConhecidoCentavos: bigint;
  temEstimativa: boolean;
  temCompromisso: boolean;
  temGratuito: boolean;
  /** Há atividade marcada "a verificar" — o planejamento de orçamento está incompleto. */
  temCustoAVerificar: boolean;
  conflitos: number;
}

const MINUTO_EM_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Valida e normaliza o horário ("HH:MM"), aceitando `null` como flexível. */
export function normalizarHora(hora: string | null | undefined): string | null {
  if (hora === null || hora === undefined || hora === "") return null;
  const limpo = hora.trim();
  if (!MINUTO_EM_HORA.test(limpo)) throw new ErroDeDominio("Use o horário no formato HH:MM (ex.: 09:30) ou deixe flexível.");
  return limpo;
}

function minutosDaHora(hora: string): number {
  const [h, m] = hora.split(":");
  return Number(h) * 60 + Number(m);
}

/** Fim previsto (minutos do dia). Sem duração, consideramos que a atividade ocupa o instante. */
function fimPrevisto(atividade: Atividade): number {
  const inicio = minutosDaHora(atividade.hora!);
  return inicio + (atividade.duracaoMinutos ?? 0);
}

/**
 * Atividades na **sequência lógica** do dia (`ordem`), nunca ordenadas por horário:
 * quem planejou decide onde a atividade sem horário entra (diretriz §2.7).
 */
export function ordenarAtividades(atividades: Atividade[]): Atividade[] {
  return [...atividades].sort((a, b) => (a.ordem === b.ordem ? a.titulo.localeCompare(b.titulo) : a.ordem - b.ordem));
}

/** Agrupa por dia, em ordem crescente de data, cada dia já ordenado pela sequência lógica. */
export function agruparPorDia(atividades: Atividade[]): { dia: string; atividades: Atividade[] }[] {
  const porDia = new Map<string, Atividade[]>();
  for (const atividade of atividades) {
    const lista = porDia.get(atividade.dia) ?? [];
    lista.push(atividade);
    porDia.set(atividade.dia, lista);
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, lista]) => ({ dia, atividades: ordenarAtividades(lista) }));
}

/**
 * Situação pelo relógio — **apenas para exibição**. Nenhum caminho deste arquivo muda o estado
 * de uma atividade por causa do horário (diretriz §2.3).
 */
export function situacaoPorHorario(atividade: Atividade, agora: Date): SituacaoPorHorario {
  if (atividade.estado === "concluida" || atividade.estado === "cancelada") return "encerrada";
  if (!atividade.hora) return "sem_horario";
  const inicio = minutosDaHora(atividade.hora);
  const fim = fimPrevisto(atividade);
  const agoraMinutos = agora.getHours() * 60 + agora.getMinutes();
  if (agoraMinutos < inicio) return "futura";
  if (agoraMinutos <= fim) return "em_curso";
  return "passou";
}

/**
 * Conflitos do dia: sobreposição de horários e deslocamento que não cabe no intervalo.
 *
 * Só entram atividades com horário definido e ainda planejadas — flexível não conflita por
 * horário, e concluída/cancelada é histórico. O Lia Go **explica** o conflito; nunca remarca.
 */
export function conflitosDoDia(atividades: Atividade[]): Conflito[] {
  const comHorario = ordenarAtividades(atividades).filter(
    (atividade) => atividade.estado === "planejada" && atividade.hora !== null,
  );
  const conflitos: Conflito[] = [];
  for (let i = 0; i < comHorario.length; i += 1) {
    const primeira = comHorario[i]!;
    const segunda = comHorario[i + 1];
    if (!segunda) break;

    const fimA = fimPrevisto(primeira);
    const inicioB = minutosDaHora(segunda.hora!);
    const titulos = `"${primeira.titulo}" e "${segunda.titulo}"`;

    if (inicioB < fimA) {
      conflitos.push({
        tipo: "sobreposicao",
        atividadeIds: [primeira.id, segunda.id],
        explicacao: `${titulos} ocupam o mesmo horário.`,
        sugestao: "Ajuste o horário ou a duração de uma delas — o Lia Go não muda o roteiro sozinho.",
      });
      continue;
    }

    const minutosDeDeslocamento = segunda.deslocamento?.minutos ?? 0;
    const intervalo = inicioB - fimA;
    if (minutosDeDeslocamento > 0 && intervalo < minutosDeDeslocamento) {
      conflitos.push({
        tipo: "deslocamento_insuficiente",
        atividadeIds: [primeira.id, segunda.id],
        explicacao: `O trecho até "${segunda.titulo}" leva cerca de ${minutosDeDeslocamento} min, mas sobraram ${intervalo} min depois de "${primeira.titulo}".`,
        sugestao: "Antecipe a segunda atividade, encurte a primeira ou revise o tempo de deslocamento.",
      });
    }
  }
  return conflitos;
}

/** Resumo do dia, adaptável na tela: os números nunca escondem conflito nem custo a verificar. */
export function resumirDia(atividades: Atividade[]): ResumoDia {
  const resumo: ResumoDia = {
    total: 0,
    concluidas: 0,
    canceladas: 0,
    planejadas: 0,
    comHorarioDefinido: 0,
    flexiveis: 0,
    custoConhecidoCentavos: 0n,
    temEstimativa: false,
    temCompromisso: false,
    temGratuito: false,
    temCustoAVerificar: false,
    conflitos: conflitosDoDia(atividades).length,
  };
  for (const atividade of atividades) {
    resumo.total += 1;
    if (atividade.estado === "concluida") resumo.concluidas += 1;
    else if (atividade.estado === "cancelada") resumo.canceladas += 1;
    else resumo.planejadas += 1;

    if (atividade.hora) resumo.comHorarioDefinido += 1;
    else resumo.flexiveis += 1;

    if (atividade.custoAVerificar) resumo.temCustoAVerificar = true;
    if (atividade.custoCentavos !== null) {
      resumo.custoConhecidoCentavos += atividade.custoCentavos;
      if (atividade.custoNatureza === "estimativa") resumo.temEstimativa = true;
      if (atividade.custoNatureza === "compromisso") resumo.temCompromisso = true;
      if (atividade.custoNatureza === "gratuito") resumo.temGratuito = true;
    }
  }
  return resumo;
}

/**
 * O que mostrar como custo no cartão. Três situações que **não** podem ser confundidas:
 * desconhecido (nada), "a verificar" (sinalizado) e gratuito (zero explícito).
 */
export function custoParaMostrar(atividade: Atividade): { centavos: bigint | null; rotulo: string | null } {
  if (atividade.custoCentavos === null) {
    return atividade.custoAVerificar ? { centavos: null, rotulo: "Custo a verificar" } : { centavos: null, rotulo: null };
  }
  if (atividade.custoNatureza === "gratuito") return { centavos: 0n, rotulo: "Sem custo" };
  const prefixo = atividade.custoNatureza === "compromisso" ? "Compromisso" : "Estimativa";
  return { centavos: atividade.custoCentavos, rotulo: prefixo };
}

/** Próxima sequência livre no dia (para a tela não precisar calcular). */
export function proximaOrdem(atividades: Atividade[], dia: string): number {
  const doDia = atividades.filter((atividade) => atividade.dia === dia);
  return doDia.reduce((maior, atividade) => Math.max(maior, atividade.ordem), 0) + 1;
}

/** Ações do roteiro, na mesma tabela de autorização das demais (servidor é a autoridade). */
export type AcaoRoteiro = "atividade:criar" | "atividade:corrigir" | "atividade:concluir" | "atividade:cancelar";

export function podeNoRoteiro(contexto: ContextoAutorizacao, acao: AcaoRoteiro) {
  return decidirAutorizacao(contexto, acao);
}

/**
 * Conclusão de atividade: qualquer participante ativo pode registrar (mesmo princípio já
 * confirmado para início/fim de viagem), mas **a hora nunca conclui sozinha**.
 */
export function concluirAtividade(
  atividade: Atividade,
  dados: { usuarioId: string; contexto: ContextoAutorizacao; observacao?: string | null; agora: Date },
): Atividade {
  const decisao = podeNoRoteiro(dados.contexto, "atividade:concluir");
  if (!decisao.permitido) throw new ErroDeDominio(decisao.motivo);
  if (atividade.estado === "concluida") throw new ErroDeDominio("Esta atividade já está concluída.");
  if (atividade.estado === "cancelada") throw new ErroDeDominio("Atividade cancelada não pode ser concluída.");
  return {
    ...atividade,
    estado: "concluida",
    concluidaPor: dados.usuarioId,
    concluidaEm: dados.agora.toISOString(),
    observacao: dados.observacao?.trim() ? dados.observacao.trim() : atividade.observacao,
    versao: atividade.versao + 1,
  };
}

/** Cancelamento: exige motivo (o porquê fica no histórico). */
export function cancelarAtividade(
  atividade: Atividade,
  dados: { usuarioId: string; contexto: ContextoAutorizacao; motivo: string },
): Atividade {
  const decisao = podeNoRoteiro(dados.contexto, "atividade:cancelar");
  if (!decisao.permitido) throw new ErroDeDominio(decisao.motivo);
  if (atividade.estado === "cancelada") throw new ErroDeDominio("Esta atividade já está cancelada.");
  if (!dados.motivo || dados.motivo.trim().length < 5) throw new ErroDeDominio("Explique o motivo do cancelamento (mínimo 5 caracteres).");
  if (atividade.estado === "concluida") throw new ErroDeDominio("Atividade concluída não é cancelada: registre uma correção, se necessário.");
  return { ...atividade, estado: "cancelada", observacao: atividade.observacao, versao: atividade.versao + 1 };
}

/** Correção: exige motivo e mantém o histórico (nunca sobrescreve em silêncio). */
export function corrigirAtividade(
  atividade: Atividade,
  dados: {
    usuarioId: string;
    contexto: ContextoAutorizacao;
    motivo: string;
    alteracoes: Partial<
      Pick<
        Atividade,
        | "titulo"
        | "dia"
        | "ordem"
        | "hora"
        | "duracaoMinutos"
        | "local"
        | "custoCentavos"
        | "custoNatureza"
        | "custoAVerificar"
        | "observacao"
        | "deslocamento"
      >
    >;
  },
): Atividade {
  const decisao = podeNoRoteiro(dados.contexto, "atividade:corrigir");
  if (!decisao.permitido) throw new ErroDeDominio(decisao.motivo);
  if (!dados.motivo || dados.motivo.trim().length < 5) throw new ErroDeDominio("Explique o motivo da correção (mínimo 5 caracteres).");
  if (atividade.estado === "cancelada") throw new ErroDeDominio("Atividade cancelada não é corrigida.");
  const atualizada: Atividade = { ...atividade, ...dados.alteracoes, versao: atividade.versao + 1 };
  if (atualizada.hora) atualizada.hora = normalizarHora(atualizada.hora);
  if (atualizada.custoCentavos === null) atualizada.custoNatureza = null;
  validarAtividade(atualizada);
  return atualizada;
}

/** Regras de consistência que valem na criação e na correção (as mesmas no banco). */
export function validarAtividade(atividade: Atividade): void {
  if (atividade.titulo.trim().length < 2) throw new ErroDeDominio("Dê um nome à atividade (mínimo 2 caracteres).");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(atividade.dia)) throw new ErroDeDominio("Informe o dia como AAAA-MM-DD.");
  if (atividade.duracaoMinutos !== null && (!Number.isInteger(atividade.duracaoMinutos) || atividade.duracaoMinutos <= 0)) {
    throw new ErroDeDominio("A duração precisa ser um número de minutos maior que zero.");
  }
  if (atividade.hora !== null) normalizarHora(atividade.hora);
  if (atividade.custoCentavos !== null && atividade.custoCentavos < 0n) throw new ErroDeDominio("O custo não pode ser negativo.");
  if (atividade.custoCentavos === null && atividade.custoNatureza !== null) {
    throw new ErroDeDominio("Sem valor informado não há natureza de custo: use \"custo a verificar\" quando for o caso.");
  }
  if (atividade.custoNatureza === "gratuito" && atividade.custoCentavos !== 0n) {
    throw new ErroDeDominio("Atividade gratuita precisa ter custo zero explícito.");
  }
  if ((atividade.custoNatureza === "estimativa" || atividade.custoNatureza === "compromisso") && (atividade.custoCentavos ?? 0n) <= 0n) {
    throw new ErroDeDominio("Informe o valor para classificar o custo como estimativa ou compromisso.");
  }
}

/** Cria uma atividade nova, já validada (nasce `planejada`). */
export function criarAtividade(entrada: {
  id: string;
  viagemId: string;
  autorId: string;
  contexto: ContextoAutorizacao;
  dia: string;
  ordem: number;
  titulo: string;
  hora?: string | null;
  duracaoMinutos?: number | null;
  local?: string | null;
  custoCentavos?: bigint | null;
  custoNatureza?: NaturezaCusto | null;
  custoAVerificar?: boolean;
  observacao?: string | null;
  deslocamento?: Deslocamento | null;
}): Atividade {
  const decisao = podeNoRoteiro(entrada.contexto, "atividade:criar");
  if (!decisao.permitido) throw new ErroDeDominio(decisao.motivo);
  const atividade: Atividade = {
    id: entrada.id,
    viagemId: entrada.viagemId,
    autorId: entrada.autorId,
    dia: entrada.dia,
    ordem: entrada.ordem,
    titulo: entrada.titulo.trim(),
    hora: normalizarHora(entrada.hora ?? null),
    duracaoMinutos: entrada.duracaoMinutos ?? null,
    local: entrada.local?.trim() || null,
    custoCentavos: entrada.custoCentavos ?? null,
    custoNatureza: entrada.custoNatureza ?? null,
    custoAVerificar: entrada.custoAVerificar ?? false,
    estado: "planejada",
    concluidaPor: null,
    concluidaEm: null,
    observacao: entrada.observacao?.trim() || null,
    deslocamento: entrada.deslocamento ?? null,
    versao: 1,
  };
  validarAtividade(atividade);
  return atividade;
}
