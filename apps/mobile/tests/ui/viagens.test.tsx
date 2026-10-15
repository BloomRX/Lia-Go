/**
 * Testes de interface com o app de verdade rodando em jsdom.
 *
 * Estes dois casos são **defeitos relatados em uso real** (2026-10-15): abrir uma viagem nova mostrava
 * a viagem antiga, e o botão "Sair" não fazia nada. O teste roda o app inteiro (App.tsx), com servidor
 * falso e IndexedDB de verdade (fake-indexeddb), então uma regressão aqui quebra o teste antes de chegar
 * na mão de quem usa.
 */
import { botaoCom, clicar, digitar, esperarPor, esperarAtualizacoes, raizDoDocumento, textoDaTela } from "./ambiente.ts";
import { criarServidorFalso } from "./servidor-falso.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/App.tsx";
import { CHAVE_CARGA, criarArmazenamentoIndexedDB } from "../../src/offline/armazenamento.ts";

const ANTIGA = {
  id: "v1",
  nome: "Praia antiga",
  destino: "Ubatuba",
  estado: "cancelada" as const,
  versao: 5,
  papel: "organizador" as const,
  atividades: [{ id: "a1", viagemId: "v1", dia: "2026-10-10", ordem: 1, titulo: "Atividade da viagem antiga", hora: null, duracaoMinutos: null, local: null, custo: { centavos: null, natureza: null, aVerificar: false }, estado: "planejada", deslocamento: null, versao: 1 }],
};
const NOVA = { id: "v2", nome: "Serra nova", destino: "Campos do Jordão", estado: "rascunho" as const, versao: 1, papel: "organizador" as const, atividades: [] };

/** Antes de abrir o app: o aparelho já tem a viagem antiga guardada (foi a última aberta). */
async function aparelhoComViagemAntiga(): Promise<void> {
  const armazem = criarArmazenamentoIndexedDB("lia-go");
  await armazem.gravar(CHAVE_CARGA, { viagens: [], viagem: { viagem: { ...ANTIGA, rotuloEstado: "Cancelada" }, papel: "organizador", participantes: [], pendencias: { despesas: 0, convites: 0 }, sugestao: null, permissoes: {} }, despesas: [], movimentos: [], convites: [], convitesParaMim: [], atividades: ANTIGA.atividades });
  await armazem.gravar("viagemAtiva", ANTIGA.id);
}

let raizMontada: ReturnType<typeof createRoot> | null = null;

function montar(): void {
  // Cada teste monta o app do zero: desmonta o anterior e usa um ponto novo, para a tela de um
  // teste não vazar para o outro (o texto lido é o que está de fato na tela).
  raizMontada?.unmount();
  raizDoDocumento.getElementById("raiz")?.remove();
  const conteiner = raizDoDocumento.createElement("div");
  conteiner.id = "raiz";
  raizDoDocumento.body.append(conteiner);
  raizMontada = createRoot(conteiner);
  raizMontada.render(createElement(App));
}

/**
 * Aparelho limpo: sem dado de viagem, sem fila e sem marca de saída pendente de outro teste.
 * Usa o próprio adaptador do app (limpar o conteúdo, não apagar o banco — apagar com uma conexão
 * aberta pode ficar esperando para sempre, e aí o teste trava).
 */
async function limparAparelho(): Promise<void> {
  await criarArmazenamentoIndexedDB("lia-go").limpar();
  (globalThis as { localStorage?: Storage }).localStorage?.clear();
}

test("abrir a viagem nova mostra a viagem nova, não a que estava aberta antes", async () => {
  await limparAparelho();
  await aparelhoComViagemAntiga();
  const servidor = criarServidorFalso([ANTIGA, NOVA]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes("Praia antiga") && textoDaTela().includes("Serra nova"), "a lista de viagens aparecer");
  assert.match(textoDaTela(), /Serra nova/);

  clicar(botaoCom("Serra nova"));
  await esperarPor(() => textoDaTela().includes("Serra nova") && !textoDaTela().includes("Suas viagens"), "a viagem nova abrir");

  const tela = textoDaTela();
  assert.ok(!tela.includes("Praia antiga"), `a viagem antiga não pode aparecer depois de abrir a nova. Tela: ${tela.slice(0, 400)}`);
  assert.match(tela, /Serra nova/);
});

test("depois de abrir a viagem nova, o roteiro dela não mostra atividade da viagem antiga", async () => {
  await limparAparelho();
  await aparelhoComViagemAntiga();
  const servidor = criarServidorFalso([ANTIGA, NOVA]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes("Praia antiga"), "a lista de viagens aparecer");
  clicar(botaoCom("Serra nova"));
  await esperarPor(() => textoDaTela().includes("Serra nova") && !textoDaTela().includes("Suas viagens"), "a viagem nova abrir");

  clicar(botaoCom("Roteiro"));
  await esperarPor(() => textoDaTela().includes("Nenhuma atividade") || textoDaTela().includes("Atividade da viagem antiga"), "o roteiro abrir");
  assert.ok(
    !textoDaTela().includes("Atividade da viagem antiga"),
    `atividade de outra viagem vazou para o roteiro: ${textoDaTela().slice(0, 400)}`,
  );
});

test("o botão Sair encerra a sessão na tela e apaga o que estava guardado no aparelho", async () => {
  await limparAparelho();
  await aparelhoComViagemAntiga();
  const servidor = criarServidorFalso([ANTIGA, NOVA]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes("Praia antiga"), "a lista de viagens aparecer");

  clicar(botaoCom("Sair"));
  await esperarPor(() => textoDaTela().includes("Entrar"), "voltar para a tela de entrada", 4000);

  assert.ok(servidor.encerrado, "o servidor precisa ter recebido o aviso de saída");
  const armazem = criarArmazenamentoIndexedDB("lia-go");
  assert.equal(await armazem.ler(CHAVE_CARGA), null, "dado de viagem não pode continuar no aparelho depois de sair");
  assert.equal(await armazem.ler("viagemAtiva"), null);
});

test("Sair funciona mesmo se o servidor não responder (ninguém fica preso dentro do app)", async () => {
  await limparAparelho();
  await aparelhoComViagemAntiga();
  const servidor = criarServidorFalso([ANTIGA, NOVA]);
  const fetchReal = servidor.fetch;
  (globalThis as Record<string, unknown>).fetch = (entrada: string | URL | Request, init?: RequestInit) =>
    String(entrada).includes("/auth/logout") ? Promise.reject(new TypeError("Failed to fetch")) : fetchReal(entrada, init);

  montar();
  await esperarPor(() => textoDaTela().includes("Praia antiga"), "a lista de viagens aparecer");
  clicar(botaoCom("Sair"));
  await esperarPor(() => textoDaTela().includes("Entrar"), "voltar para a tela de entrada mesmo sem servidor", 4000);
  await esperarAtualizacoes(2);
});


test("criar viagem já abre a viagem criada (rascunho precisa dos próximos passos)", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([ANTIGA]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes("Criar viagem"), "a tela inicial aparecer");
  clicar(botaoCom("Criar viagem"));

  await esperarPor(() => Boolean(raizDoDocumento.querySelector("#nome-viagem")), "o formulário de nova viagem abrir");
  const campoNome = raizDoDocumento.querySelector<HTMLInputElement>("#nome-viagem");
  assert.ok(campoNome, "o formulário de nova viagem precisa aparecer");
  await digitar(campoNome, "Chapada");
  clicar(botaoCom("Salvar rascunho"));

  await esperarPor(() => textoDaTela().includes("Chapada") && !textoDaTela().includes("Suas viagens"), "a viagem criada abrir", 4000);
  assert.match(textoDaTela(), /Chapada/);
  assert.ok(servidor.viagens.some((viagem) => viagem.nome === "Chapada"), "a viagem chegou ao servidor");
});


test("aba Gastos mostra o previsto do roteiro separado do dinheiro oficial", async () => {
  await limparAparelho();
  const comRoteiro = {
    id: "v9",
    nome: "Chapada",
    destino: "Chapada dos Veadeiros",
    estado: "planejada" as const,
    versao: 2,
    papel: "organizador" as const,
    atividades: [
      { id: "a1", viagemId: "v9", dia: "2026-11-20", ordem: 1, titulo: "Passeio", custo: { centavos: "15000", natureza: "compromisso", aVerificar: false }, estado: "planejada", versao: 1 },
      { id: "a2", viagemId: "v9", dia: "2026-11-20", ordem: 2, titulo: "Almoço", custo: { centavos: "3500", natureza: "estimativa", aVerificar: false }, estado: "planejada", versao: 1 },
      { id: "a3", viagemId: "v9", dia: "2026-11-21", ordem: 1, titulo: "Trilha", custo: { centavos: null, natureza: null, aVerificar: true }, estado: "planejada", versao: 1 },
    ],
  };
  const servidor = criarServidorFalso([comRoteiro]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes("Chapada"), "a viagem aparecer");
  clicar(botaoCom("Chapada"));
  await esperarPor(() => textoDaTela().includes("← Minhas viagens"), "a viagem abrir");
  clicar(botaoCom("Gastos"));
  await esperarPor(() => textoDaTela().includes("Previsto no roteiro"), "a aba de gastos abrir");

  const tela = textoDaTela();
  assert.match(tela, /Previsto \(estimativas \+ combinado\)R\$ 185,00/, `o previsto junta combinado e estimativa: ${tela.slice(0, 500)}`);
  assert.match(tela, /já combinadoR\$ 150,00/);
  assert.match(tela, /estimativaR\$ 35,00/);
  assert.match(tela, /1 atividade com custo a verificar/);
  assert.match(tela, /não entra no saldo oficial/, "o previsto nunca se confunde com o saldo oficial");
  assert.match(tela, /Gasto confirmado \(oficial\)/);
});
