/**
 * Testes de interface com o app de verdade rodando em jsdom.
 *
 * Estes dois casos são **defeitos relatados em uso real** (2026-10-15): abrir uma viagem nova mostrava
 * a viagem antiga, e o botão "Sair" não fazia nada. O teste roda o app inteiro (App.tsx), com servidor
 * falso e IndexedDB de verdade (fake-indexeddb), então uma regressão aqui quebra o teste antes de chegar
 * na mão de quem usa.
 */
import { botaoCom, clicar, digitar, elemento, elementos, esperarPor, esperarAtualizacoes, raizDoDocumento, textoDaTela } from "./ambiente.ts";
import { criarServidorFalso } from "./servidor-falso.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/App.tsx";
import { Entrar } from "../../src/telas/Entrar.tsx";
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

function montar(conteudo: React.ReactElement = createElement(App)): void {
  // Cada teste monta o app do zero: desmonta o anterior e usa um ponto novo, para a tela de um
  // teste não vazar para o outro (o texto lido é o que está de fato na tela).
  raizMontada?.unmount();
  raizDoDocumento.getElementById("raiz")?.remove();
  const conteiner = raizDoDocumento.createElement("div");
  conteiner.id = "raiz";
  raizDoDocumento.body.append(conteiner);
  raizMontada = createRoot(conteiner);
  raizMontada.render(conteudo);
}

/**
 * Aparelho limpo: sem dado de viagem, sem fila e sem marca de saída pendente de outro teste.
 * Usa o próprio adaptador do app (limpar o conteúdo, não apagar o banco — apagar com uma conexão
 * aberta pode ficar esperando para sempre, e aí o teste trava).
 */
async function limparAparelho(): Promise<void> {
  await criarArmazenamentoIndexedDB("lia-go").limpar();
  (globalThis as { localStorage?: Storage }).localStorage?.clear();
  // A sessão de fallback (navegador que recusa o cookie) mora na aba: precisa sumir entre testes.
  (globalThis as { sessionStorage?: Storage }).sessionStorage?.clear();
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


test("rede instável: a viagem criada abre sozinha quando a confirmação chega (sem mentir no meio)", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([ANTIGA]);
  // O servidor só aceita criar viagem depois de 5 s: mais que os 4 s que o app espera na frente da
  // pessoa. É o caso real de "o Wi-Fi está ruim" — `navigator.onLine` continua `true`, então nada
  // avisa o app; ele tem que continuar tentando sozinho.
  const limite = Date.now() + 5000;
  const fetchReal = servidor.fetch;
  (globalThis as Record<string, unknown>).fetch = (entrada: string | URL | Request, init?: RequestInit) => {
    const criandoViagem = String(entrada).includes("/viagens") && (init?.method ?? "GET") === "POST";
    if (criandoViagem && Date.now() < limite) return Promise.reject(new TypeError("Failed to fetch"));
    return fetchReal(entrada, init);
  };

  montar();
  await esperarPor(() => textoDaTela().includes("Criar viagem"), "a tela inicial aparecer");
  clicar(botaoCom("Criar viagem"));
  await esperarPor(() => Boolean(raizDoDocumento.querySelector("#nome-viagem")), "o formulário de nova viagem abrir");
  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#nome-viagem")!, "Chapada");
  clicar(botaoCom("Salvar rascunho"));

  // Primeiro a tela diz a verdade: está guardada no aparelho, ainda não no servidor.
  await esperarPor(
    () => textoDaTela().includes("ficou guardada neste aparelho"),
    "o aviso honesto aparecer enquanto o servidor não responde",
    6000,
  );
  // E depois, sozinha, abre a viagem quando o servidor confirma — sem a pessoa tocar em nada.
  await esperarPor(
    () => textoDaTela().includes("Chapada") && !textoDaTela().includes("Suas viagens"),
    "a viagem abrir quando a confirmação chegar",
    20000,
  );
  assert.ok(servidor.viagens.some((viagem) => viagem.nome === "Chapada"), "a viagem chegou ao servidor");
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

  // O app espera o servidor confirmar, avisa a verdade se demorar e **continua tentando** até 60 s;
  // aqui o prazo é folgado de propósito: máquina lenta não pode virar teste vermelho (a rodada do
  // usuário em 2026-10-16 estourou os 8 s que existiam antes, com o app ainda esperando).
  await esperarPor(() => textoDaTela().includes("Chapada") && !textoDaTela().includes("Suas viagens"), "a viagem criada abrir", 20000);
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
  await esperarPor(() => textoDaTela().includes("Orçamento da viagem"), "a aba de gastos abrir");

  const tela = textoDaTela();
  assert.match(tela, /Previsto \(estimativas \+ combinado\)R\$ 185,00/, `o previsto junta combinado e estimativa: ${tela.slice(0, 500)}`);
  assert.match(tela, /já combinadoR\$ 150,00/);
  assert.match(tela, /estimativaR\$ 35,00/);
  assert.match(tela, /1 custo ainda sem valor informado/, "custo sem valor é sinalizado, nunca somado como zero");
  assert.match(tela, /Enquanto houver custo a verificar, o previsto é o valor mínimo/);
  assert.match(tela, /não entram no saldo oficial/, "o previsto nunca se confunde com o saldo oficial");
  assert.match(tela, /Gasto confirmado \(oficial\)/);
});

// ---------------------------------------------------------------------------
// Identidade visual (referências oficiais em `assets/references/`)
// ---------------------------------------------------------------------------

test("a marca é o pino oficial com o nome escrito — desenho não substitui texto", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([ANTIGA]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes("Criar viagem"), "a tela inicial aparecer");

  const marca = elemento(".marca")!;
  assert.ok(marca, "a marca precisa estar na tela inicial");
  const simbolo = marca.querySelector("svg.marca-simbolo");
  assert.ok(simbolo, "o pino da marca é desenhado no app");
  assert.equal(simbolo!.getAttribute("aria-hidden"), "true", "o desenho é decorativo; o nome é o texto");
  assert.ok(simbolo!.querySelector("path.marca-pino"), "o pino tem o traçado da referência");
  assert.ok(simbolo!.querySelector("circle.marca-furo"), "o pino tem o furo da referência");
  assert.match(marca.querySelector("h1")?.textContent ?? "", /Lia Go/, "o nome continua legível para leitor de tela");
});

test("a barra inferior tem ícone **e** rótulo, e diz qual aba está ativa por texto", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([ANTIGA]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes("Praia antiga"), "a lista de viagens aparecer");
  clicar(botaoCom("Praia antiga"));
  await esperarPor(() => textoDaTela().includes("← Minhas viagens"), "a viagem abrir");

  const itens = elementos(".barra button");
  assert.deepEqual(itens.map((item) => (item.textContent ?? "").trim()), ["Visão geral", "Roteiro", "Gastos", "Mais"]);
  for (const item of itens) {
    assert.ok(item.querySelector("svg"), `"${item.textContent}" precisa de ícone (referência da barra inferior)`);
    assert.equal(item.querySelector("svg")?.getAttribute("aria-hidden"), "true", "o ícone é decorativo: o rótulo é o texto");
  }
  assert.equal(itens[0]!.getAttribute("aria-current"), "true", "a aba ativa é anunciada, não só pintada");
  assert.equal(itens[1]!.getAttribute("aria-current"), "false");
});

// ---------------------------------------------------------------------------
// Entrar: o "clico em Entrar e nada acontece" (2026-10-17)
// ---------------------------------------------------------------------------

test("login que o navegador não consegue guardar explica o motivo — nunca fica mudo", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([ANTIGA]);
  // Servidor aceita a senha, mas o navegador não guarda a sessão (app dentro de outra página/iframe:
  // o cookie SameSite=Lax não volta na chamada seguinte). Antes disso a tela simplesmente não mudava.
  servidor.logado = false;
  servidor.guardaSessao = false;
  servidor.aceitaToken = false;
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => Boolean(raizDoDocumento.querySelector("#email")), "a tela de entrada aparecer");
  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#email")!, "demo@lia.go");
  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#senha")!, "lia-go-demo-2026");
  clicar(botaoCom("Entrar", raizDoDocumento.querySelector("form")!));

  await esperarPor(
    () => textoDaTela().includes("não guardou a sessão"),
    "a tela explicar que o navegador não guardou a sessão (em vez de não fazer nada)",
    4000,
  );
  const tela = textoDaTela();
  assert.match(tela, /servidor aceitou seu e-mail e senha/i, "deixa claro que a credencial está certa");
  assert.match(tela, /aba própria/i, "diz o que fazer para resolver");
  assert.ok(servidor.chamadas.some((c) => c.caminho === "/api/auth/login"), "o login chegou ao servidor");
});

test("login normal: entra e mostra as viagens", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([ANTIGA]);
  servidor.logado = false;
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => Boolean(raizDoDocumento.querySelector("#email")), "a tela de entrada aparecer");
  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#email")!, "demo@lia.go");
  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#senha")!, "lia-go-demo-2026");
  clicar(botaoCom("Entrar", raizDoDocumento.querySelector("form")!));

  await esperarPor(() => textoDaTela().includes("Praia antiga"), "a lista de viagens aparecer depois do login", 5000);
  assert.match(textoDaTela(), /Conectado como Ana/);
});

test("app dentro de outra página oferece o link para abrir em aba própria", async () => {
  await limparAparelho();
  // O DOM de teste sempre parece ser a janela do topo; a tela recebe o aviso por prop, do mesmo
  // jeito que o app informa quando detecta o painel embutido.
  montar(createElement(Entrar, { aoEntrar: async () => undefined, embutido: true }));
  await esperarPor(() => Boolean(raizDoDocumento.querySelector("#email")), "a tela de entrada aparecer");
  const link = raizDoDocumento.querySelector<HTMLAnchorElement>("a.aba-propria");
  assert.ok(link, "existe um caminho de saída quando o login não pega dentro de outra página");
  assert.match(link.textContent ?? "", /aba própria/i);
  assert.equal(link.target, "_blank");
  assert.equal(link.getAttribute("rel"), "noreferrer");
  assert.match(textoDaTela(), /bloqueiam o cookie de sessão/i, "explica por que pode falhar");

  // O link pode ser barrado pelo iframe do painel: o endereço também precisa estar na tela,
  // legível e copiável, porque é a saída que funciona em qualquer navegador.
  const campo = raizDoDocumento.querySelector<HTMLInputElement>(".endereco-app input");
  assert.ok(campo, "o endereço do app aparece para copiar");
  assert.equal(campo.readOnly, true);
  assert.match(campo.value, /^https?:\/\//, "é o endereço completo, não um texto qualquer");
  assert.equal(link.href, campo.value, "o link e o endereço apontam para o mesmo lugar");

  // Sem área de transferência disponível (caso do iframe), o app seleciona o endereço e avisa.
  clicar(botaoCom("Copiar", raizDoDocumento));
  await esperarPor(
    () => textoDaTela().includes("use Ctrl+C"),
    "avisar para copiar manualmente quando o navegador não deixa copiar",
  );
  assert.equal(campo.selectionStart, 0, "o endereço fica selecionado para o usuário copiar");
  assert.equal(campo.selectionEnd, campo.value.length);
});

test("fora de outra página, o aviso de aba própria não aparece", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([ANTIGA]);
  servidor.logado = false;
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;
  montar();
  await esperarPor(() => Boolean(raizDoDocumento.querySelector("#email")), "a tela de entrada aparecer");
  assert.equal(raizDoDocumento.querySelector("a.aba-propria"), null);
});

test("navegador que recusa o cookie: entra pela sessão da aba e mostra as viagens", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([ANTIGA]);
  servidor.logado = false;
  servidor.guardaSessao = false; // o cookie de sessão nunca volta (app embutido em outra página)
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => Boolean(raizDoDocumento.querySelector("#email")), "a tela de entrada aparecer");
  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#email")!, "demo@lia.go");
  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#senha")!, "lia-go-demo-2026");
  clicar(botaoCom("Entrar", raizDoDocumento.querySelector("form")!));

  await esperarPor(
    () => textoDaTela().includes("Praia antiga"),
    "entrar mesmo sem cookie, pela sessão da própria aba",
    5000,
  );
  assert.match(textoDaTela(), /Conectado como Ana/);
  const guardado = (globalThis as { sessionStorage?: Storage }).sessionStorage?.getItem("lia.sessao.embutida");
  assert.ok(guardado, "a sessão de fallback fica em sessionStorage");
  assert.equal((globalThis as { localStorage?: Storage }).localStorage?.getItem("lia.sessao.embutida"), null,
    "nunca em localStorage (não sobrevive à aba nem vaza para outras)");

  // Na aba Mais → Este aparelho, a tela diz a verdade sobre onde a sessão ficou (§13).
  clicar(botaoCom("Praia antiga", raizDoDocumento));
  await esperarPor(() => Boolean(botaoCom("Mais", raizDoDocumento)), "a viagem abrir");
  clicar(botaoCom("Mais", raizDoDocumento));
  await esperarPor(
    () => textoDaTela().includes("sessão desta aba (sessionStorage)"),
    "Este aparelho informar que a sessão ficou na aba (sessionStorage)",
  );

  // Sair também apaga a sessão da aba: ninguém fica logado depois de sair.
  clicar(botaoCom("Sair", raizDoDocumento));
  await esperarPor(
    () => Boolean(raizDoDocumento.querySelector("#email")),
    "voltar para a tela de entrada depois de sair",
    5000,
  );
  assert.equal((globalThis as { sessionStorage?: Storage }).sessionStorage?.getItem("lia.sessao.embutida"), null);
});
