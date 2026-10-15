/**
 * Carga local: o que a interface mostra quando não há rede.
 *
 * Regra de ouro: o servidor sempre vence em dado já confirmado (versão maior), e uma
 * resposta atrasada nunca rebaixa um dado mais novo que já está no aparelho.
 */
import type { CargaLocal, CargaRemota, DetalheViagemLocal } from "./tipos.ts";

export function cargaVazia(): CargaLocal {
  return { viagens: [], viagem: null, despesas: [], movimentos: [], convites: [], convitesParaMim: [], atividades: [] };
}

/** Listas que sabemos mesclar. A chave é o campo `id`; o desempate é `versao` quando existe. */
const LISTAS = ["despesas", "movimentos", "convites", "atividades"] as const;

export function mesclarCarga(atual: CargaLocal, delta: CargaRemota): CargaLocal {
  const resultado: CargaLocal = { ...atual };

  // Listas que o servidor manda completas: são o retrato da conta naquele instante.
  if (delta.viagens) resultado.viagens = delta.viagens;
  if (delta.convitesParaMim) resultado.convitesParaMim = delta.convitesParaMim;

  for (const nome of LISTAS) {
    const enviados = delta[nome];
    if (enviados) resultado[nome] = mesclarLista(atual[nome], enviados);
  }

  if (delta.viagem) {
    const versaoAtual = versaoDe(atual.viagem?.viagem ?? null);
    const versaoNova = versaoDe(delta.viagem.viagem ?? null);
    const mesmoId = atual.viagem == null || atual.viagem.viagem?.id === delta.viagem.viagem?.id;
    if (mesmoId && (versaoAtual === null || versaoNova === null || versaoNova >= versaoAtual)) {
      resultado.viagem = delta.viagem;
    }
  }

  return resultado;
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
export function removerDaCarga(carga: CargaLocal, lista: "despesas" | "movimentos" | "convites" | "atividades", id: string): CargaLocal {
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
    carga.atividades.length
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
