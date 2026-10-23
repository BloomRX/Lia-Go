/**
 * Checklist da viagem (tela 15): o que cada um precisa resolver antes/durante a viagem.
 *
 * Regras que este arquivo garante:
 *  - **o prazo não conclui nada**: passar da data marca "atrasado", e atrasado é fato do calendário,
 *    não prova de que a pessoa fez (ou deixou de fazer) — quem conclui é alguém, explicitamente;
 *  - item concluído guarda **quem** e **quando**; reabrir exige **motivo** (nada volta atrás em silêncio);
 *  - item sem responsável é permitido ("alguém do grupo"), mas a tela deixa claro que ninguém pegou;
 *  - o resumo é adaptativo: com prazo, atraso e responsável, ele diz o que interessa naquele dia.
 */
import { ErroDeDominio } from "./erros.ts";

export type CategoriaChecklist = "documento" | "reserva" | "compras" | "saude" | "outro";
export type EstadoItemChecklist = "aberto" | "feito";

export const CATEGORIAS_CHECKLIST: readonly CategoriaChecklist[] = ["documento", "reserva", "compras", "saude", "outro"];

export const ROTULO_CATEGORIA_CHECKLIST: Record<CategoriaChecklist, string> = {
  documento: "Documento",
  reserva: "Reserva",
  compras: "Compras",
  saude: "Saúde",
  outro: "Outro",
};

export interface ItemChecklist {
  id: string;
  viagemId: string;
  autorId: string;
  titulo: string;
  categoria: CategoriaChecklist;
  /** Quem ficou de resolver. `null` = ainda é de todo mundo (e isso aparece na tela). */
  responsavelId: string | null;
  /** Data-limite (YYYY-MM-DD). `null` = sem prazo, não é "prazo hoje". */
  prazo: string | null;
  estado: EstadoItemChecklist;
  feitoPor: string | null;
  feitoEm: string | null;
  observacao: string | null;
  motivoReabertura: string | null;
  versao: number;
}

export interface EntradaDeItem {
  id: string;
  viagemId: string;
  autorId: string;
  titulo: string;
  categoria?: CategoriaChecklist;
  responsavelId?: string | null;
  prazo?: string | null;
  observacao?: string | null;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function limpar(texto: string | null | undefined): string | null {
  const valor = (texto ?? "").trim();
  return valor.length === 0 ? null : valor;
}

export function criarItemChecklist(entrada: EntradaDeItem): ItemChecklist {
  const titulo = limpar(entrada.titulo);
  if (titulo === null || titulo.length < 2) throw new ErroDeDominio("Escreva o que precisa ser feito (pelo menos 2 caracteres).");
  const categoria = entrada.categoria ?? "outro";
  if (!CATEGORIAS_CHECKLIST.includes(categoria)) throw new ErroDeDominio("Categoria de item desconhecida.");
  const prazo = limpar(entrada.prazo);
  if (prazo !== null && !DATA_ISO.test(prazo)) throw new ErroDeDominio("Use a data no formato AAAA-MM-DD.");

  return {
    id: entrada.id,
    viagemId: entrada.viagemId,
    autorId: entrada.autorId,
    titulo,
    categoria,
    responsavelId: entrada.responsavelId ?? null,
    prazo,
    estado: "aberto",
    feitoPor: null,
    feitoEm: null,
    observacao: limpar(entrada.observacao),
    motivoReabertura: null,
    versao: 1,
  };
}

export function concluirItem(item: ItemChecklist, entrada: { porId: string; em?: string }): ItemChecklist {
  if (item.estado === "feito") throw new ErroDeDominio("Este item já está concluído.");
  return {
    ...item,
    estado: "feito",
    feitoPor: entrada.porId,
    feitoEm: entrada.em ?? new Date().toISOString(),
    motivoReabertura: null,
    versao: item.versao + 1,
  };
}

export function reabrirItem(item: ItemChecklist, entrada: { porId: string; motivo: string; em?: string }): ItemChecklist {
  if (item.estado === "aberto") throw new ErroDeDominio("Este item já está em aberto.");
  const motivo = limpar(entrada.motivo);
  if (motivo === null || motivo.length < 5) throw new ErroDeDominio("Explique por que o item voltou a ficar em aberto (mínimo 5 caracteres).");
  return {
    ...item,
    estado: "aberto",
    feitoPor: null,
    feitoEm: null,
    motivoReabertura: motivo,
    versao: item.versao + 1,
  };
}

/** Item em aberto cujo prazo já passou. `hoje` no formato AAAA-MM-DD (comparação de texto basta). */
export function itemAtrasado(item: ItemChecklist, hoje: string): boolean {
  return item.estado === "aberto" && item.prazo !== null && item.prazo < hoje;
}

/** Prazo é hoje (diferente de atrasado: a pessoa ainda tem o dia). */
export function itemParaHoje(item: ItemChecklist, hoje: string): boolean {
  return item.estado === "aberto" && item.prazo === hoje;
}

export interface ResumoDoChecklist {
  total: number;
  abertos: number;
  feitos: number;
  atrasados: number;
  paraHoje: number;
  /** Itens em aberto sem responsável: é o que costuma travar viagem em grupo. */
  semResponsavel: number;
  resumo: string;
}

export function resumirChecklist(itens: readonly ItemChecklist[], hoje: string): ResumoDoChecklist {
  let abertos = 0;
  let feitos = 0;
  let atrasados = 0;
  let paraHoje = 0;
  let semResponsavel = 0;

  for (const item of itens) {
    if (item.estado === "feito") {
      feitos += 1;
      continue;
    }
    abertos += 1;
    if (itemAtrasado(item, hoje)) atrasados += 1;
    if (itemParaHoje(item, hoje)) paraHoje += 1;
    if (item.responsavelId === null) semResponsavel += 1;
  }

  const partes: string[] = [];
  if (abertos === 0 && feitos === 0) return { total: 0, abertos: 0, feitos: 0, atrasados: 0, paraHoje: 0, semResponsavel: 0, resumo: "Nenhum item no checklist." };
  partes.push(abertos === 1 ? "1 em aberto" : `${abertos} em aberto`);
  if (feitos > 0) partes.push(feitos === 1 ? "1 feito" : `${feitos} feitos`);
  if (atrasados > 0) partes.push(atrasados === 1 ? "1 atrasado" : `${atrasados} atrasados`);
  if (paraHoje > 0) partes.push(paraHoje === 1 ? "1 para hoje" : `${paraHoje} para hoje`);
  if (semResponsavel > 0) partes.push(semResponsavel === 1 ? "1 sem responsável" : `${semResponsavel} sem responsável`);
  return { total: abertos + feitos, abertos, feitos, atrasados, paraHoje, semResponsavel, resumo: partes.join(" · ") };
}

/** Ordem de leitura: atrasados primeiro, depois prazo mais próximo, sem prazo no fim, feitos por último. */
export function ordenarChecklist(itens: readonly ItemChecklist[], hoje: string): ItemChecklist[] {
  const peso = (item: ItemChecklist): number => {
    if (item.estado === "feito") return 3;
    if (itemAtrasado(item, hoje)) return 0;
    if (item.prazo !== null) return 1;
    return 2;
  };
  return [...itens].sort((a, b) => {
    const porPeso = peso(a) - peso(b);
    if (porPeso !== 0) return porPeso;
    const prazoA = a.prazo ?? "9999-12-31";
    const prazoB = b.prazo ?? "9999-12-31";
    if (prazoA !== prazoB) return prazoA < prazoB ? -1 : 1;
    return a.titulo.localeCompare(b.titulo, "pt-BR");
  });
}
