/**
 * Texto que o roteiro mostra — em funções puras, fora do JSX.
 *
 * Motivo: as regras de exibição do roteiro são **regras de negócio de interface**
 * (`docs/UI_VISUAL_GUIDELINES.md` §2 e `docs/UI_V1_DECISIONS.md` §7) e precisam de teste como qualquer
 * outra. Dentro do componente `.tsx` elas não podem ser testadas sem navegador; aqui são só dados.
 *
 * As três que não podem quebrar:
 *  1. horário flexível **não** ganha horário inventado;
 *  2. custo desconhecido fica **omitido** (nunca `R$ 0,00`), e "a verificar" é sinalizado;
 *  3. "sem custo" é um zero **explícito**, com rótulo que explica o zero.
 */
import { descreverCusto, descreverDeslocamento, formatarBRL, formatarDuracao } from "./formato.ts";

export interface CustoNaApi {
  centavos: string | null;
  natureza: "estimativa" | "compromisso" | "gratuito" | null;
  aVerificar: boolean;
}

export interface DeslocamentoNaApi {
  minutos: number | null;
  km: number | null;
  custoCentavos: string | null;
  alerta: string | null;
}

/** Horário do cartão: a hora real ou a declaração honesta de que ela não existe. */
export function textoDoHorario(hora: string | null): string {
  return hora ? hora : "Horário flexível";
}

/** Linhas de contexto do cartão: só o que ajuda a decidir, na ordem de leitura. */
export interface LinhaDeContexto {
  texto: string;
  /** `a-verificar` e `custo` têm tratamento visual próprio (atenção / valor). */
  tipo: "local" | "duracao" | "a-verificar" | "custo";
}

export function linhasDeContexto(atividade: {
  local: string | null;
  duracaoMinutos: number | null;
  custo: CustoNaApi;
}): LinhaDeContexto[] {
  const linhas: LinhaDeContexto[] = [];

  if (atividade.local) linhas.push({ texto: atividade.local, tipo: "local" });

  const duracao = formatarDuracao(atividade.duracaoMinutos);
  if (duracao) linhas.push({ texto: duracao, tipo: "duracao" });

  const custo = descreverCusto({
    centavos: atividade.custo.centavos === null ? null : BigInt(atividade.custo.centavos),
    rotulo: rotuloDoCusto(atividade.custo),
    natureza: atividade.custo.natureza,
  });

  if (custo.rotulo === "Custo a verificar") linhas.push({ texto: custo.rotulo, tipo: "a-verificar" });
  if (custo.valor) {
    const texto = custo.rotulo && custo.rotulo !== "Custo a verificar" ? `${custo.rotulo}: ${custo.valor}` : custo.valor;
    linhas.push({ texto, tipo: "custo" });
  }

  return linhas;
}

/** Rótulo de natureza do custo, quando o valor existe. Desconhecido não recebe rótulo nenhum. */
export function rotuloDoCusto(custo: CustoNaApi): string | null {
  if (custo.centavos === null) return custo.aVerificar ? "Custo a verificar" : null;
  if (custo.natureza === "compromisso") return "valor já combinado";
  if (custo.natureza === "gratuito") return "Sem custo";
  return "estimativa";
}

/** Manchete do conflito: o que aconteceu, em duas palavras, antes da explicação. */
export function tituloDoConflito(tipo: "sobreposicao" | "deslocamento_insuficiente"): string {
  return tipo === "sobreposicao" ? "Conflito de horário" : "Deslocamento apertado";
}

export interface Trecho {
  /** Uma linha: "45 min · 12 km · R$ 60,00". Vazio quando nada foi informado. */
  resumo: string;
  /** Abre quando distância, atraso, custo ou risco tornam o trecho relevante (§2.6). */
  detalhado: boolean;
  /** Alerta é mostrado **mesmo** na forma compacta — risco não se esconde. */
  alerta: string | null;
}

export function avaliarTrecho(deslocamento: DeslocamentoNaApi | null | undefined): Trecho | null {
  if (!deslocamento) return null;
  const temAlgo = Boolean(deslocamento.minutos || deslocamento.km || deslocamento.custoCentavos || deslocamento.alerta);
  if (!temAlgo) return null;

  return {
    resumo: descreverDeslocamento(deslocamento),
    detalhado: Boolean(deslocamento.alerta) || (deslocamento.minutos ?? 0) >= 30 || Boolean(deslocamento.custoCentavos),
    alerta: deslocamento.alerta,
  };
}

/** Texto do resumo adaptativo do dia (o que precisa de atenção aparece primeiro). */
export function linhasDoResumoDoDia(resumo: {
  total: number;
  concluidas: number;
  flexiveis: number;
  custoConhecidoCentavos: bigint;
  temCustoAVerificar: boolean;
  conflitos: number;
}): { texto: string; tipo: "normal" | "atencao" }[] {
  const linhas: { texto: string; tipo: "normal" | "atencao" }[] = [];
  const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

  linhas.push({ texto: plural(resumo.total, "atividade", "atividades"), tipo: "normal" });
  if (resumo.flexiveis > 0) linhas.push({ texto: `${resumo.flexiveis} sem horário fixo`, tipo: "normal" });
  if (resumo.concluidas > 0) linhas.push({ texto: `${resumo.concluidas} concluída(s)`, tipo: "normal" });
  if (resumo.custoConhecidoCentavos > 0n) {
    linhas.push({ texto: `Previsto: ${formatarBRL(resumo.custoConhecidoCentavos)}`, tipo: "normal" });
  }
  if (resumo.temCustoAVerificar) linhas.push({ texto: "Custo a verificar", tipo: "atencao" });
  if (resumo.conflitos > 0) {
    linhas.push({ texto: `${resumo.conflitos} conflito(s) de horário para resolver`, tipo: "atencao" });
  }
  return linhas;
}
