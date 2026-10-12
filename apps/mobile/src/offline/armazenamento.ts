/**
 * Armazenamento local do aparelho, atrás de uma interface única.
 *
 * O mesmo código de sincronização roda em três lugares:
 *  - **web** (navegador): IndexedDB;
 *  - **app nativo** (Capacitor): armazenamento do próprio app (Preferences);
 *  - **testes**: memória.
 *
 * Nada de dado sensível aqui: a fila de envio e a cópia local do que a pessoa já pode ver.
 * Token de sessão fica em armazenamento seguro (`services/tokens.ts`), nunca neste arquivo.
 * A interface é o ponto de troca para o próximo passo nativo (banco SQLite criptografado).
 */
import type { ArmazenamentoSync } from "@lia-go/sync";
import { cargaVazia, filaVazia, mesclarCarga } from "@lia-go/sync";
import type { CargaLocal, Fila } from "@lia-go/sync";

export interface ArmazenamentoLocal {
  /** Nome legível do que está sendo usado (aparece no diagnóstico da tela "Mais"). */
  nome: string;
  ler<T>(chave: string): Promise<T | null>;
  gravar(chave: string, valor: unknown): Promise<void>;
  remover(chave: string): Promise<void>;
  /** Apaga tudo o que o app guardou neste aparelho. */
  limpar(): Promise<void>;
}

export const CHAVE_FILA = "fila";
export const CHAVE_CARGA = "carga";
export const CHAVE_CURSOR = "cursor";
export const CHAVE_VIAGEM_ATIVA = "viagemAtiva";

/** Adaptador em memória: usado nos testes e como último recurso quando não há armazenamento. */
export function criarArmazenamentoMemoria(inicial: Record<string, unknown> = {}): ArmazenamentoLocal {
  const dados = new Map<string, unknown>(Object.entries(inicial));
  return {
    nome: "memória",
    async ler<T>(chave: string) {
      return (dados.get(chave) as T | undefined) ?? null;
    },
    async gravar(chave: string, valor: unknown) {
      dados.set(chave, valor);
    },
    async remover(chave: string) {
      dados.delete(chave);
    },
    async limpar() {
      dados.clear();
    },
  };
}

const NOME_BANCO_PADRAO = "lia-go";
const NOME_DEPOSITO = "local";

/** Adaptador IndexedDB (web), sem dependências externas. */
export function criarArmazenamentoIndexedDB(nomeBanco = NOME_BANCO_PADRAO): ArmazenamentoLocal {
  let promessaBanco: Promise<IDBDatabase> | null = null;

  function abrir(): Promise<IDBDatabase> {
    if (promessaBanco) return promessaBanco;
    promessaBanco = new Promise<IDBDatabase>((resolver, rejeitar) => {
      const fabrica = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
      if (!fabrica) {
        rejeitar(new Error("Este navegador não oferece IndexedDB."));
        return;
      }
      const pedido = fabrica.open(nomeBanco, 1);
      pedido.onupgradeneeded = () => {
        const banco = pedido.result;
        if (!banco.objectStoreNames.contains(NOME_DEPOSITO)) banco.createObjectStore(NOME_DEPOSITO);
      };
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => rejeitar(pedido.error ?? new Error("Falha ao abrir o banco local."));
    });
    return promessaBanco;
  }

  async function comDeposito<T>(modo: IDBTransactionMode, acao: (deposito: IDBObjectStore) => IDBRequest): Promise<T> {
    const banco = await abrir();
    return new Promise<T>((resolver, rejeitar) => {
      const transacao = banco.transaction(NOME_DEPOSITO, modo);
      const pedido = acao(transacao.objectStore(NOME_DEPOSITO));
      pedido.onsuccess = () => resolver(pedido.result as T);
      pedido.onerror = () => rejeitar(pedido.error ?? new Error("Falha ao acessar o banco local."));
    });
  }

  return {
    nome: "IndexedDB (web)",
    async ler<T>(chave: string) {
      const valor = await comDeposito<T | undefined>("readonly", (deposito) => deposito.get(chave));
      return valor ?? null;
    },
    async gravar(chave: string, valor: unknown) {
      // O valor precisa ser clonável; JSON garante isso e evita guardar objeto vivo da tela.
      await comDeposito("readwrite", (deposito) => deposito.put(JSON.parse(JSON.stringify(valor)), chave));
    },
    async remover(chave: string) {
      await comDeposito("readwrite", (deposito) => deposito.delete(chave));
    },
    async limpar() {
      await comDeposito("readwrite", (deposito) => deposito.clear());
    },
  };
}

/**
 * Adaptador nativo (Capacitor Preferences). O import é dinâmico de propósito: na web o pacote
 * nativo nem é carregado, e os testes rodam sem ele.
 */
export function criarArmazenamentoNativo(): ArmazenamentoLocal {
  type Preferences = {
    get(opcoes: { key: string }): Promise<{ value: string | null }>;
    set(opcoes: { key: string; value: string }): Promise<void>;
    remove(opcoes: { key: string }): Promise<void>;
    keys(): Promise<{ keys: string[] }>;
  };
  let promessa: Promise<Preferences> | null = null;

  function carregar(): Promise<Preferences> {
    promessa ??= import("@capacitor/preferences").then((modulo) => modulo.Preferences as Preferences);
    return promessa;
  }

  return {
    nome: "armazenamento do app (nativo)",
    async ler<T>(chave: string) {
      const { value } = await (await carregar()).get({ key: chave });
      if (value === null) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return null; // dado corrompido não derruba o app: é como se não existisse
      }
    },
    async gravar(chave: string, valor: unknown) {
      await (await carregar()).set({ key: chave, value: JSON.stringify(valor) });
    },
    async remover(chave: string) {
      await (await carregar()).remove({ key: chave });
    },
    async limpar() {
      const preferencias = await carregar();
      const { keys } = await preferencias.keys();
      await Promise.all(keys.map((key) => preferencias.remove({ key })));
    },
  };
}

/**
 * Escolhe o armazenamento certo para onde o app está rodando.
 * `ehNativo` vem de fora para este módulo continuar testável sem Capacitor.
 */
export function escolherArmazenamento(ehNativo: boolean): ArmazenamentoLocal {
  if (ehNativo) return criarArmazenamentoNativo();
  const temIndexedDB = typeof (globalThis as { indexedDB?: unknown }).indexedDB !== "undefined";
  return temIndexedDB ? criarArmazenamentoIndexedDB() : criarArmazenamentoMemoria();
}

/**
 * Liga o armazenamento genérico ao contrato que o motor de sincronização espera.
 * O que está no disco é tratado como não confiável: JSON estragado vira "fila vazia",
 * nunca um app que não abre.
 */
export function criarArmazenamentoDeSync(armazem: ArmazenamentoLocal): ArmazenamentoSync {
  return {
    async lerFila(): Promise<Fila> {
      const bruto = await armazem.ler<Fila>(CHAVE_FILA);
      if (!bruto || !Array.isArray(bruto.operacoes)) return filaVazia();
      return { ...filaVazia(), ...bruto };
    },
    async gravarFila(fila) {
      await armazem.gravar(CHAVE_FILA, fila);
    },
    async lerCarga(): Promise<{ cursor: string | null; carga: CargaLocal }> {
      const [cargaBruta, cursor] = await Promise.all([
        armazem.ler<CargaLocal>(CHAVE_CARGA),
        armazem.ler<string>(CHAVE_CURSOR),
      ]);
      return { cursor: typeof cursor === "string" ? cursor : null, carga: mesclarCarga(cargaVazia(), cargaBruta ?? {}) };
    },
    async gravarCarga(cursor, carga) {
      await armazem.gravar(CHAVE_CARGA, carga);
      if (cursor === null) await armazem.remover(CHAVE_CURSOR);
      else await armazem.gravar(CHAVE_CURSOR, cursor);
    },
  };
}
