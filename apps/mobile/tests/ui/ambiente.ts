/**
 * Ambiente de navegador para os testes de interface (jsdom), sem baixar navegador de verdade.
 *
 * Este módulo precisa ser o **primeiro** import de qualquer teste de UI: ele cria `window`,
 * `document`, `indexedDB` (fake-indexeddb) e um `fetch` que fala com a API real do teste.
 * Como o bundle é um arquivo só, a ordem dos `import` é a ordem de execução.
 */
import { JSDOM } from "jsdom";
import "fake-indexeddb/auto";

const dom = new JSDOM("<!doctype html><html><body><div id=\"raiz\"></div></body></html>", {
  url: "http://localhost:5273/",
  pretendToBeVisual: true,
});

const janela = dom.window as unknown as Record<string, unknown>;

/** `navigator`/`location` são getters no Node moderno: definir precisa de defineProperty. */
function definirGlobal(nome: string, valor: unknown): void {
  Object.defineProperty(globalThis, nome, { value: valor, configurable: true, writable: true });
}

for (const nome of [
  "window",
  "document",
  "navigator",
  "location",
  "history",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "CustomEvent",
  "getComputedStyle",
  "requestAnimationFrame",
  "localStorage",
] as const) {
  definirGlobal(nome, janela[nome]);
}
// Os testes não usam `act()`: esperamos a tela mudar de verdade (`esperarPor`), que é o que a
// pessoa vê. Com esta flag desligada o React não enche o log de avisos de act.
definirGlobal("IS_REACT_ACT_ENVIRONMENT", false);

export const raizDoDocumento = janela.document as Document;

/**
 * Promessa rejeitada sem tratamento é o defeito que fez o botão "Sair" parecer morto:
 * a tela não muda e ninguém vê o erro. Aqui ela vira uma mensagem legível no teste.
 */
process.on("unhandledRejection", (motivo) => {
  const erro = motivo instanceof Error ? motivo : new Error(String(motivo));
  console.error("PROMESSA NÃO TRATADA:", erro.message, "\n", erro.stack);
});

/** Espera o React terminar de aplicar o efeito de um clique/estado. */
export async function esperarAtualizacoes(voltas = 6): Promise<void> {
  for (let i = 0; i < voltas; i += 1) {
    await new Promise((resolver) => setTimeout(resolver, 0));
  }
}

/** Texto visível da tela, sem espaços repetidos (é o que a pessoa lê). */
export function textoDaTela(): string {
  return (raizDoDocumento.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Espera até o texto da tela satisfazer a condição — evita depender de número de voltas. */
export async function esperarPor(condicao: () => boolean, descricao = "a tela mudar", limiteMs = 3000): Promise<void> {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    if (condicao()) return;
    await new Promise((resolver) => setTimeout(resolver, 5));
  }
  throw new Error(`Tempo esgotado esperando ${descricao}. Tela atual: ${textoDaTela().slice(0, 300)}`);
}

/**
 * Simula a rede cair e voltar, como o navegador faz.
 *
 * Um evento sozinho não basta: o app pergunta `navigator.onLine`. Trocar só o evento (deixando o
 * `onLine` em `true`) fazia o teste "provar" que o app reage à rede quando ele não reagiu — foi
 * assim que descobrimos que voltar para o app não buscava novidade nenhuma.
 */
export async function simularRede(online: boolean): Promise<void> {
  Object.defineProperty(janela.navigator, "onLine", { value: online, configurable: true });
  (globalThis as unknown as { window: Window }).window.dispatchEvent(
    new (globalThis as { Event: typeof Event }).Event(online ? "online" : "offline"),
  );
  await esperarAtualizacoes(4);
}

/** Simula a pessoa voltando para o app (o app volta para a frente). */
export async function simularVoltaAoApp(): Promise<void> {
  raizDoDocumento.dispatchEvent(new (globalThis as { Event: typeof Event }).Event("visibilitychange", { bubbles: true }));
  await esperarAtualizacoes(4);
}

/** Clica como uma pessoa clica: evento de verdade, subindo pelo DOM. */
export function clicar(elemento: Element | null): void {
  if (!elemento) throw new Error("Não encontrei o elemento para clicar.");
  elemento.dispatchEvent(new (globalThis as { MouseEvent: typeof MouseEvent }).MouseEvent("click", { bubbles: true, cancelable: true }));
}

/**
 * Escreve um valor num campo de formulário e avisa o React.
 *
 * Detalhe do ambiente: o React 19 não entrega eventos nativos de digitação (`input`/`change`) no
 * jsdom — só `click`. Então escrevemos o valor no campo (como o navegador faz) e chamamos o
 * manipulador `onChange` do próprio React, que é exatamente o caminho que o app seguiria num
 * navegador de verdade: mesmo manipulador, mesmo estado, mesmo envio.
 */
async function escreverValor(campo: HTMLElement, valor: string, eventoNativo: "input" | "change"): Promise<void> {
  const definidor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(campo) as object, "value")?.set;
  definidor?.call(campo, valor);

  const chave = Object.keys(campo).find((nome) => nome.startsWith("__reactProps$"));
  const props = chave ? (campo as unknown as Record<string, { onChange?: (evento: unknown) => void }>)[chave] : undefined;
  if (props?.onChange) {
    props.onChange({ target: campo, currentTarget: campo, type: eventoNativo });
  } else {
    campo.dispatchEvent(new (globalThis as { Event: typeof Event }).Event(eventoNativo, { bubbles: true }));
  }
  // Deixa o React aplicar o novo estado: quem digita e clica em seguida não clica com o valor antigo.
  await esperarAtualizacoes(2);
}

/** Digita num campo de texto. */
export async function digitar(campo: HTMLInputElement, texto: string): Promise<void> {
  await escreverValor(campo, texto, "input");
}

/** Escolhe uma opção num `select` (os filtros da central de notificações, por exemplo). */
export async function escolher(campo: HTMLSelectElement, valor: string): Promise<void> {
  await escreverValor(campo, valor, "change");
}

/** Procura um botão pelo texto exato (ou um trecho dele). */
export function botaoCom(texto: string, raiz: ParentNode = raizDoDocumento): HTMLButtonElement | null {
  const botoes = Array.from(raiz.querySelectorAll("button"));
  return (botoes.find((botao) => (botao.textContent ?? "").trim().includes(texto)) as HTMLButtonElement) ?? null;
}

/** Procura um elemento pelo seletor CSS (último recurso, quando não há texto estável para buscar). */
export function elemento<T extends Element = Element>(seletor: string, raiz: ParentNode = raizDoDocumento): T | null {
  return raiz.querySelector<T>(seletor);
}

/** Elementos pelo seletor, na ordem do documento. */
export function elementos<T extends Element = Element>(seletor: string, raiz: ParentNode = raizDoDocumento): T[] {
  return Array.from(raiz.querySelectorAll<T>(seletor));
}
