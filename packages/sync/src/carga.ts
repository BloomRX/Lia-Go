/**
 * Carga local: o que a interface mostra quando não há rede.
 *
 * Regra de ouro: o servidor sempre vence em dado já confirmado (versão maior), e uma
 * resposta atrasada nunca rebaixa um dado mais novo que já está no aparelho.
 */
import type { CargaLocal, CargaRemota, DetalheViagemLocal } from "./tipos.ts";

export function cargaVazia(): CargaLocal {
  return { viagens: [], viagem: null, despesas: [], movimentos: [], convites: [], convitesParaMim: [], atividades: [], reservas: [], itensChecklist: [], documentos: [] };
}

/**
 * Carga lida do aparelho, **completa**: cache escrito por uma versão anterior do app pode não ter
 * as listas que existem hoje (foi assim que `reservas` entrou). Sem isso, a tela quebra com
 * "cannot read properties of undefined" para quem já usava o app — o aparelho de quem atualiza é
 * justamente quem tem cache antigo.
 */
export function cargaCompleta(carga: Partial<CargaLocal> | null | undefined): CargaLocal {
  return { ...cargaVazia(), ...(carga ?? {}) };
}

/** Listas que sabemos mesclar. A chave é o campo `id`; o desempate é `versao` quando existe. */
const LISTAS = ["despesas", "movimentos", "convites", "atividades", "reservas", "itensChecklist", "documentos"] as const;

export interface OpcoesMesclagem {
  /**
   * Viagem aberta no aparelho. Serve para **não deixar** uma resposta atrasada de outra viagem
   * contaminar a que está na tela (o defeito relatado em 2026-10-15: ao abrir uma viagem nova, a
   * tela continuava mostrando os dados da anterior).
   */
  viagemAtiva?: string | null;
}

export function mesclarCarga(atual: CargaLocal, delta: CargaRemota, opcoes: OpcoesMesclagem = {}): CargaLocal {
  const resultado: CargaLocal = { ...atual };

  // Listas que o servidor manda completas: são o retrato da conta naquele instante.
  if (delta.viagens) resultado.viagens = delta.viagens;
  if (delta.convitesParaMim) resultado.convitesParaMim = delta.convitesParaMim;

  const viagemAtiva = opcoes.viagemAtiva ?? null;
  const donoDoDelta = delta.viagem?.viagem?.id ?? null;
  // Chegou o detalhe de uma viagem que não é a aberta (resposta de uma passada anterior): ignora
  // tudo o que é daquela viagem, sem tocar no que está na tela.
  const deOutraViagem = donoDoDelta !== null && viagemAtiva !== null && donoDoDelta !== viagemAtiva;
  if (deOutraViagem) return resultado;

  // Troca de viagem aberta: o que era da viagem anterior **não** serve de base para a nova — as
  // listas da viagem começam vazias e são preenchidas com o que vier.
  const trocandoDeViagem =
    donoDoDelta !== null && viagemAtiva !== null && donoDoDelta === viagemAtiva && atual.viagem?.viagem?.id !== viagemAtiva;
  if (trocandoDeViagem) {
    resultado.viagem = null;
    for (const nome of LISTAS) resultado[nome] = [];
  }

  for (const nome of LISTAS) {
    const enviados = delta[nome];
    if (enviados) resultado[nome] = mesclarLista(resultado[nome], enviados);
  }

  if (delta.viagem) {
    const mesmaViagem = atual.viagem == null || atual.viagem.viagem?.id === donoDoDelta;
    const ehATrocaDaViagemAberta = viagemAtiva !== null && donoDoDelta === viagemAtiva;

    if (ehATrocaDaViagemAberta && !mesmaViagem) {
      // Viagem diferente da guardada, e é a que está aberta: entra (a versão de outra viagem não
      // diz nada sobre esta, então não há o que comparar).
      resultado.viagem = delta.viagem;
    } else if (mesmaViagem) {
      // Mesma viagem: a resposta atrasada não rebaixa dado mais novo que já está no aparelho.
      const versaoAtual = versaoDe(atual.viagem?.viagem ?? null);
      const versaoNova = versaoDe(delta.viagem.viagem ?? null);
      if (versaoAtual === null || versaoNova === null || versaoNova >= versaoAtual) {
        resultado.viagem = delta.viagem;
      }
    }
  }

  return resultado;
}

/**
 * O aparelho guarda **uma viagem por vez**: a aberta. Ao trocar de viagem, o que era da outra é
 * descartado (o servidor continua sendo a verdade — nada se perde lá). A lista de viagens da conta
 * e os convites pendentes **não** são tocados: não pertencem a nenhuma viagem.
 */
export function trocarViagemAberta(carga: CargaLocal): CargaLocal {
  return { ...carga, viagem: null, despesas: [], movimentos: [], convites: [], atividades: [], reservas: [], itensChecklist: [], documentos: [] };
}

/** Junta itens por `id`: entram os novos, atualizam-se os mais antigos, saem os marcados como removidos. */
export function mesclarLista(
  atual: Record<string, unknown>[],
  enviados: Record<string, unknown>[],
): Record<string, unknown>[] {
  const porId = new Map<string, Record<string, unknown>>();
  const ordem: string[] = [];
  for (const item of atual) {
    const id = chaveDe(item);
    if (id === null) continue;
    porId.set(id, item);
    ordem.push(id);
  }
  for (const item of enviados) {
    const id = chaveDe(item);
    if (id === null) continue;
    if (item["removido"] === true) {
      porId.delete(id);
      continue;
    }
    const existente = porId.get(id);
    if (!existente) {
      porId.set(id, item);
      ordem.push(id);
      continue;
    }
    const versaoExistente = versaoDe(existente);
    const versaoEnviada = versaoDe(item);
    if (versaoExistente !== null && versaoEnviada !== null && versaoEnviada < versaoExistente) continue;
    porId.set(id, item);
  }
  return ordem.map((id) => porId.get(id)).filter((item): item is Record<string, unknown> => item !== undefined);
}

/** Remove da carga o que o servidor marcou como removido. */
export function removerDaCarga(
  carga: CargaLocal,
  lista: "despesas" | "movimentos" | "convites" | "atividades" | "reservas" | "itensChecklist" | "documentos",
  id: string,
): CargaLocal {
  return { ...carga, [lista]: carga[lista].filter((item) => item["id"] !== id) };
}

export function buscarPorId(
  lista: Record<string, unknown>[],
  id: string,
): Record<string, unknown> | undefined {
  return lista.find((item) => item["id"] === id);
}

export function contarItens(carga: CargaLocal): number {
  return (
    carga.viagens.length +
    (carga.viagem ? 1 : 0) +
    carga.despesas.length +
    carga.movimentos.length +
    carga.convites.length +
    carga.convitesParaMim.length +
    carga.atividades.length +
    carga.reservas.length +
    carga.itensChecklist.length +
    carga.documentos.length
  );
}

/** Viagem aberta, tipada, sem `any` espalhado pela interface. */
export function detalheDaViagem(carga: CargaLocal): DetalheViagemLocal | null {
  return carga.viagem;
}

function chaveDe(item: Record<string, unknown>): string | null {
  const id = item["id"];
  return typeof id === "string" ? id : null;
}

function versaoDe(item: Record<string, unknown> | null): number | null {
  if (!item) return null;
  const versao = item["versao"];
  if (typeof versao === "number" && Number.isFinite(versao)) return versao;
  if (typeof versao === "string" && /^\d+$/.test(versao)) return Number(versao);
  return null;
}
