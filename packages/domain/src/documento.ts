/**
 * Documentos da viagem (tela 16) — passagens, reservas, seguros, identidade, ingressos.
 *
 * Decisões que este arquivo garante:
 *  - **privado por padrão**: documento nasce visível só para quem criou. Compartilhar é ato explícito;
 *  - compartilhar registra **quem** compartilhou e **com quem**, e revogar remove o acesso sem apagar
 *    a história (o evento fica, o acesso não);
 *  - remover documento exige **motivo** e é remoção lógica: nada é apagado em silêncio (o arquivo
 *    continua recuperável por quem administra a viagem);
 *  - **esta fatia não guarda arquivo binário**: o documento aponta para onde o arquivo está (link) e
 *    descreve o que é. Subir arquivo de verdade depende de decisão de hospedagem/custo, que é
 *    justamente o que ainda não foi confirmado (`docs/ARCHITECTURE.md` §11) — inventar um bucket
 *    agora seria decidir custo e privacidade pela pessoa.
 */
import { ErroDeDominio } from "./erros.ts";

export type TipoDocumento = "passagem" | "reserva" | "seguro" | "identidade" | "ingresso" | "outro";
export type VisibilidadeDocumento = "privado" | "viagem";
export type EstadoDocumento = "ativo" | "removido";

export const TIPOS_DE_DOCUMENTO: readonly TipoDocumento[] = ["passagem", "reserva", "seguro", "identidade", "ingresso", "outro"];

export const ROTULO_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  passagem: "Passagem",
  reserva: "Reserva",
  seguro: "Seguro",
  identidade: "Identidade",
  ingresso: "Ingresso",
  outro: "Outro",
};

export interface Documento {
  id: string;
  viagemId: string;
  autorId: string;
  tipo: TipoDocumento;
  nome: string;
  descricao: string | null;
  /** Onde o arquivo está (link do provedor, pasta compartilhada...). Não é o arquivo em si. */
  link: string | null;
  visibilidade: VisibilidadeDocumento;
  /** Pessoas com acesso além do autor, quando a visibilidade é "privado". */
  compartilhadoCom: string[];
  estado: EstadoDocumento;
  removidoPor: string | null;
  removidoEm: string | null;
  motivoRemocao: string | null;
  versao: number;
}

export interface EntradaDeDocumento {
  id: string;
  viagemId: string;
  autorId: string;
  tipo: TipoDocumento;
  nome: string;
  descricao?: string | null;
  link?: string | null;
}

function limpar(texto: string | null | undefined): string | null {
  const valor = (texto ?? "").trim();
  return valor.length === 0 ? null : valor;
}

export function criarDocumento(entrada: EntradaDeDocumento): Documento {
  const nome = limpar(entrada.nome);
  if (nome === null || nome.length < 2) throw new ErroDeDominio("Dê um nome ao documento (pelo menos 2 caracteres).");
  if (!TIPOS_DE_DOCUMENTO.includes(entrada.tipo)) throw new ErroDeDominio("Tipo de documento desconhecido.");
  const link = limpar(entrada.link);
  if (link !== null && !/^https?:\/\//i.test(link)) {
    throw new ErroDeDominio("O link precisa começar com http:// ou https:// (assim ninguém esconde um caminho estranho).");
  }

  return {
    id: entrada.id,
    viagemId: entrada.viagemId,
    autorId: entrada.autorId,
    tipo: entrada.tipo,
    nome,
    descricao: limpar(entrada.descricao),
    link,
    // Regra da casa: nada nasce compartilhado.
    visibilidade: "privado",
    compartilhadoCom: [],
    estado: "ativo",
    removidoPor: null,
    removidoEm: null,
    motivoRemocao: null,
    versao: 1,
  };
}

export interface EntradaDeCompartilhamento {
  porId: string;
  /** `"viagem"` = todas as pessoas com acesso ativo; ou a lista de pessoas escolhidas. */
  com: "viagem" | string[];
}

export function compartilharDocumento(documento: Documento, entrada: EntradaDeCompartilhamento): Documento {
  if (documento.estado === "removido") throw new ErroDeDominio("Documento removido não volta a ser compartilhado.");
  if (entrada.com !== "viagem") {
    const pessoas = [...new Set(entrada.com)].filter((id) => id !== documento.autorId);
    if (pessoas.length === 0) throw new ErroDeDominio("Escolha com quem compartilhar (só quem criou já vê).");
    return {
      ...documento,
      visibilidade: "privado",
      compartilhadoCom: [...new Set([...documento.compartilhadoCom, ...pessoas])],
      versao: documento.versao + 1,
    };
  }
  return { ...documento, visibilidade: "viagem", compartilhadoCom: [], versao: documento.versao + 1 };
}

export function revogarAcesso(documento: Documento, entrada: { com: "viagem" | string[] }): Documento {
  if (documento.estado === "removido") throw new ErroDeDominio("Documento removido não tem acesso para revogar.");
  if (entrada.com === "viagem") {
    if (documento.visibilidade === "privado" && documento.compartilhadoCom.length === 0) {
      throw new ErroDeDominio("Este documento já está visível só para quem criou.");
    }
    return { ...documento, visibilidade: "privado", compartilhadoCom: [], versao: documento.versao + 1 };
  }
  const restante = documento.compartilhadoCom.filter((id) => !entrada.com.includes(id));
  if (restante.length === documento.compartilhadoCom.length) throw new ErroDeDominio("Essas pessoas não tinham acesso a este documento.");
  return { ...documento, compartilhadoCom: restante, versao: documento.versao + 1 };
}

export function removerDocumento(documento: Documento, entrada: { porId: string; motivo: string; em?: string }): Documento {
  if (documento.estado === "removido") throw new ErroDeDominio("Este documento já foi removido.");
  const motivo = limpar(entrada.motivo);
  if (motivo === null || motivo.length < 5) throw new ErroDeDominio("Explique o motivo da remoção (mínimo 5 caracteres).");
  return {
    ...documento,
    estado: "removido",
    removidoPor: entrada.porId,
    removidoEm: entrada.em ?? new Date().toISOString(),
    motivoRemocao: motivo,
    // Remover tira o acesso de todo mundo: o que sai da lista não precisa ser lembrado.
    visibilidade: "privado",
    compartilhadoCom: [],
    versao: documento.versao + 1,
  };
}

/**
 * Quem pode ver o documento. A autoridade é o servidor (roteiro/despesas seguem a mesma regra):
 * aqui é a mesma função que o servidor usa, para a tela nunca mostrar o que o servidor negaria.
 */
export function podeVerDocumento(
  documento: Documento,
  usuarioId: string,
  opcoes: { ehOrganizador?: boolean } = {},
): boolean {
  if (documento.estado === "removido") {
    // Quem administra a viagem consegue ver o que foi removido (com o motivo) — histórico não some.
    return opcoes.ehOrganizador === true;
  }
  if (documento.autorId === usuarioId) return true;
  if (documento.visibilidade === "viagem") return true;
  return documento.compartilhadoCom.includes(usuarioId);
}

export interface ResumoDeDocumentos {
  total: number;
  ativos: number;
  privados: number;
  compartilhados: number;
  removidos: number;
  porTipo: { tipo: TipoDocumento; rotulo: string; quantidade: number }[];
  resumo: string;
}

export function resumirDocumentos(documentos: readonly Documento[]): ResumoDeDocumentos {
  let ativos = 0;
  let privados = 0;
  let compartilhados = 0;
  let removidos = 0;
  const contagem = new Map<TipoDocumento, number>();

  for (const documento of documentos) {
    if (documento.estado === "removido") {
      removidos += 1;
      continue;
    }
    ativos += 1;
    const visivelParaAlguem = documento.visibilidade === "viagem" || documento.compartilhadoCom.length > 0;
    if (visivelParaAlguem) compartilhados += 1;
    else privados += 1;
    contagem.set(documento.tipo, (contagem.get(documento.tipo) ?? 0) + 1);
  }

  const porTipo = [...contagem.entries()]
    .map(([tipo, quantidade]) => ({ tipo, rotulo: ROTULO_TIPO_DOCUMENTO[tipo], quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.rotulo.localeCompare(b.rotulo, "pt-BR"));

  const partes: string[] = [];
  if (ativos === 0 && removidos === 0) return { total: 0, ativos: 0, privados: 0, compartilhados: 0, removidos: 0, porTipo: [], resumo: "Nenhum documento guardado." };
  partes.push(ativos === 1 ? "1 documento" : `${ativos} documentos`);
  if (privados > 0) partes.push(privados === 1 ? "1 só seu" : `${privados} só seus`);
  if (compartilhados > 0) partes.push(compartilhados === 1 ? "1 compartilhado" : `${compartilhados} compartilhados`);
  if (removidos > 0) partes.push(removidos === 1 ? "1 removido" : `${removidos} removidos`);
  return { total: ativos + removidos, ativos, privados, compartilhados, removidos, porTipo, resumo: partes.join(" · ") };
}

/** Impacto conhecido antes de compartilhar ou remover (decisões V1 §13). */
export function revisarImpactoDoDocumento(
  documento: Documento,
  acao: "compartilhar" | "remover",
  contexto: { participantesAtivos: number },
): { itens: string[]; atencao: string[] } {
  if (acao === "compartilhar") {
    return {
      itens: [
        `Todas as ${contexto.participantesAtivos} pessoas com acesso ativo passam a ver este documento.`,
        "O documento guarda o link e a descrição; o arquivo continua onde você o colocou (o Lia Go não copia o arquivo).",
        "O compartilhamento fica registrado com seu nome e a hora, e pode ser revogado depois.",
      ],
      atencao: [
        ...(documento.tipo === "identidade" ? ["Documento de identidade: compartilhe só com quem precisa, e revogue quando a viagem acabar."] : []),
        ...(documento.link === null ? ["Sem link: quem receber vai ver só a descrição."] : []),
      ],
    };
  }
  return {
    itens: [
      "O documento sai da lista de todo mundo e o acesso é revogado.",
      "O motivo fica no histórico e quem administra a viagem ainda consegue ver o registro.",
      "Nada é apagado em definitivo: o registro e o motivo continuam guardados.",
    ],
    atencao: documento.compartilhadoCom.length > 0 || documento.visibilidade === "viagem"
      ? ["Isto estava compartilhado com outras pessoas: elas perdem o acesso imediatamente."]
      : [],
  };
}
