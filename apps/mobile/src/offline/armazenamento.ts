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
  /**
   * Lê, transforma e grava **sem ninguém no meio** — a operação de fila é uma só.
   *
   * Existe por um defeito real (corrigido em 2026-10-16): quem cria uma viagem grava na fila
   * enquanto uma passada de sincronização está no meio. A passada lia a fila, a criação entrava
   * nesse intervalo, e a gravação do fim apagava a viagem recém-criada — sem erro nenhum na tela.
   * Com a leitura e a gravação dentro da mesma transação, o que entra durante a passada é
   * preservado ou descartado por quem sabe (nunca perdido por acidente).
   */
  mutar<T>(chave: string, transformar: (atual: T | null) => T): Promise<T>;
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
    async mutar<T>(chave: string, transformar: (atual: T | null) => T) {
      // Sem await no meio: nada pode entrar entre a leitura e a gravação.
      const novo = transformar((dados.get(chave) as T | undefined) ?? null);
      dados.set(chave, novo);
      return novo;
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
    async mutar<T>(chave: string, transformar: (atual: T | null) => T) {
      const banco = await abrir();
      return new Promise<T>((resolver, rejeitar) => {
        // Leitura e gravação na **mesma** transação: o IndexedDB serializa transações sobre este
        // depósito, então uma fila gravada aqui não pode ser sobrescrita por uma leitura velha.
        const transacao = banco.transaction(NOME_DEPOSITO, "readwrite");
        const deposito = transacao.objectStore(NOME_DEPOSITO);
        let novo: T;
        const leitura = deposito.get(chave);
        leitura.onsuccess = () => {
          try {
            novo = transformar((leitura.result as T | undefined) ?? null);
            deposito.put(JSON.parse(JSON.stringify(novo)), chave);
          } catch (falha) {
            transacao.abort();
            rejeitar(falha instanceof Error ? falha : new Error("Falha ao transformar o dado local."));
          }
        };
        leitura.onerror = () => rejeitar(leitura.error ?? new Error("Falha ao ler o banco local."));
        transacao.oncomplete = () => resolver(novo);
        transacao.onabort = () => rejeitar(transacao.error ?? new Error("Falha ao gravar no banco local."));
        transacao.onerror = () => rejeitar(transacao.error ?? new Error("Falha ao gravar no banco local."));
      });
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
  /** Fila de uma posição: serializa as transformações da mesma chave neste adaptador. */
  let filaDeMudanca: Promise<void> = Promise.resolve();

  function carregar(): Promise<Preferences> {
    promessa ??= import("@capacitor/preferences").then((modulo) => modulo.Preferences as Preferences);
    return promessa;
  }

  async function lerChave<T>(chave: string): Promise<T | null> {
    const { value } = await (await carregar()).get({ key: chave });
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null; // dado corrompido não derruba o app: é como se não existisse
    }
  }

  return {
    nome: "armazenamento do app (nativo)",
    ler: lerChave,
    async gravar(chave: string, valor: unknown) {
      await (await carregar()).set({ key: chave, value: JSON.stringify(valor) });
    },
    async mutar<T>(chave: string, transformar: (atual: T | null) => T) {
      // O armazenamento nativo não oferece transação: a vez é garantida aqui dentro, para duas
      // transformações da mesma chave não se atropelarem (é o mesmo cuidado da transação do IndexedDB).
      const anterior = filaDeMudanca;
      let liberar: () => void = () => undefined;
      filaDeMudanca = new Promise<void>((resolver) => { liberar = resolver; });
      await anterior;
      try {
        const atual = await lerChave<T>(chave);
        const novo = transformar(atual);
        await (await carregar()).set({ key: chave, value: JSON.stringify(novo) });
        return novo;
      } finally {
        liberar();
      }
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
export interface OpcoesArmazenamentoSync {
  /**
   * Diz se ainda vale gravar. Serve para o caso de alguém sair da conta **durante** uma
   * sincronização: a passada em andamento não pode ressuscitar dado de viagem no aparelho depois
   * da limpeza. Sem isso, "apagar os dados deste aparelho" seria só uma promessa.
   */
  aceitarEscrita?: () => boolean;
}

/** Fila do disco é tratada como não confiável: JSON estragado vira "fila vazia". */
function normalizarFila(bruta: Fila | null): Fila {
  if (!bruta || !Array.isArray(bruta.operacoes)) return filaVazia();
  return { ...filaVazia(), ...bruta };
}

export function criarArmazenamentoDeSync(
  armazem: ArmazenamentoLocal,
  opcoes: OpcoesArmazenamentoSync = {},
): ArmazenamentoSync {
  const podeGravar = opcoes.aceitarEscrita ?? (() => true);

  async function lerFila(): Promise<Fila> {
    return normalizarFila(await armazem.ler<Fila>(CHAVE_FILA));
  }

  return {
    lerFila,
    async gravarFila(fila) {
      if (!podeGravar()) return;
      await armazem.gravar(CHAVE_FILA, fila);
    },
    async mutarFila(transformar) {
      // Sem `podeGravar` não se grava nada (a pessoa saiu da conta): devolvemos o que a fila seria.
      if (!podeGravar()) return transformar(await lerFila());
      return armazem.mutar<Fila>(CHAVE_FILA, (bruta) => transformar(normalizarFila(bruta)));
    },
    async lerCarga(): Promise<{ cursor: string | null; carga: CargaLocal }> {
      const [cargaBruta, cursor] = await Promise.all([
        armazem.ler<CargaLocal>(CHAVE_CARGA),
        armazem.ler<string>(CHAVE_CURSOR),
      ]);
      return { cursor: typeof cursor === "string" ? cursor : null, carga: mesclarCarga(cargaVazia(), cargaBruta ?? {}) };
    },
    async gravarCarga(cursor, carga) {
      if (!podeGravar()) return;
      await armazem.gravar(CHAVE_CARGA, carga);
      if (cursor === null) await armazem.remover(CHAVE_CURSOR);
      else await armazem.gravar(CHAVE_CURSOR, cursor);
    },
  };
}
