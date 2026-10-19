/**
 * Orçamento com limite e barra na aba Gastos (tela 9 / referência `concept-03`).
 *
 * O que este teste protege:
 *  - com limite combinado, a tela mostra a barra e o estado em **texto** (nunca só cor);
 *  - perto do limite e estourado falam a verdade do domínio (80% e acima de 100%);
 *  - o previsto continua separado do gasto oficial;
 *  - só quem organiza define o limite do grupo — a tela não oferece o que o servidor negaria.
 */
import { botaoCom, clicar, digitar, esperarPor, esperarAtualizacoes, raizDoDocumento, textoDaTela } from "./ambiente.ts";
import { criarServidorFalso, type ViagemFalsa } from "./servidor-falso.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/App.tsx";
import { criarArmazenamentoIndexedDB } from "../../src/offline/armazenamento.ts";

const ATIVIDADES = [
  { id: "a1", viagemId: "v1", dia: "2026-11-20", ordem: 1, titulo: "Passeio", custo: { centavos: "240000", natureza: "compromisso", aVerificar: false }, estado: "planejada", versao: 1 },
  { id: "a2", viagemId: "v1", dia: "2026-11-20", ordem: 2, titulo: "Almoço", custo: { centavos: "60000", natureza: "estimativa", aVerificar: false }, estado: "planejada", versao: 1 },
];

let raizMontada: ReturnType<typeof createRoot> | null = null;

function montar(): void {
  raizMontada?.unmount();
  raizMontada = null;
  const antiga = raizDoDocumento.getElementById("raiz");
  antiga?.remove();
  const nova = raizDoDocumento.createElement("div");
  nova.id = "raiz";
  raizDoDocumento.body.append(nova);
  raizMontada = createRoot(nova);
  raizMontada.render(createElement(App));
}

async function abrirGastos(viagem: ViagemFalsa): Promise<{ servidor: ReturnType<typeof criarServidorFalso> }> {
  await criarArmazenamentoIndexedDB("lia-go").limpar();
  await esperarAtualizacoes(1);
  const servidor = criarServidorFalso([viagem]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes(viagem.nome), "a viagem aparecer");
  clicar(botaoCom(viagem.nome));
  await esperarPor(() => textoDaTela().includes("← Minhas viagens"), "a viagem abrir");
  clicar(botaoCom("Gastos"));
  await esperarPor(() => textoDaTela().includes("Orçamento da viagem"), "a aba de gastos abrir");
  return { servidor };
}

test("com limite, a barra aparece e o previsto se compara ao combinado em texto", async () => {
  await abrirGastos({
    id: "v1",
    nome: "Serra",
    destino: "Campos do Jordão",
    estado: "planejada",
    versao: 1,
    papel: "organizador",
    atividades: ATIVIDADES,
    limiteColetivoCentavos: "400000",
    realizado: "0",
    comprometido: "0",
  });
  await esperarPor(() => textoDaTela().includes("Dentro do limite"), "a situação do orçamento chegar");

  const tela = textoDaTela();
  assert.match(tela, /R\$ 3\.000,00 de R\$ 4\.000,00/, "mostra o previsto sobre o limite");
  assert.match(tela, /75% do limite em planejamento/, "a porcentagem aparece em texto, não só na barra");
  assert.match(tela, /Dentro do limite/, "o estado vem do domínio, escrito");
  assert.match(tela, /Ainda cabem R\$ 1\.000,00 de planejamento/);
  const barra = raizDoDocumento.querySelector('[role="progressbar"]');
  assert.ok(barra, "a barra do orçamento precisa existir");
  assert.equal(barra.getAttribute("aria-valuenow"), "75", "a barra é legível por leitor de tela");
});

test("no limite de atenção a tela avisa; passando dele, diz que passou", async () => {
  await abrirGastos({
    id: "v1",
    nome: "Serra",
    destino: "Campos do Jordão",
    estado: "planejada",
    versao: 1,
    papel: "organizador",
    atividades: ATIVIDADES,
    limiteColetivoCentavos: "350000",
    realizado: "0",
    comprometido: "0",
  });
  await esperarPor(() => textoDaTela().includes("Perto do limite"), "o aviso de atenção aparecer");
  assert.match(textoDaTela(), /85% do limite em planejamento/, "85% é a conta inteira do domínio (85,7% arredonda para baixo): a tela não infla o número");

  await abrirGastos({
    id: "v1",
    nome: "Serra",
    destino: "Campos do Jordão",
    estado: "planejada",
    versao: 1,
    papel: "organizador",
    atividades: ATIVIDADES,
    limiteColetivoCentavos: "200000",
    realizado: "0",
    comprometido: "0",
  });
  await esperarPor(() => textoDaTela().includes("Passou do limite"), "o estado estourado aparecer");
  assert.match(textoDaTela(), /passou do combinado/, "a tela diz o que fazer, não só que estourou");
});

test("sem limite, a tela explica que o teto é planejamento e oferece definir", async () => {
  await abrirGastos({
    id: "v1",
    nome: "Serra",
    destino: "Campos do Jordão",
    estado: "planejada",
    versao: 1,
    papel: "organizador",
    atividades: ATIVIDADES,
  });
  await esperarPor(() => textoDaTela().includes("Nenhum limite definido"), "o estado sem limite aparecer");

  const tela = textoDaTela();
  assert.match(tela, /Nenhum limite definido/);
  assert.match(tela, /não bloqueia nada/, "limite é combinado, não bloqueio");
  assert.match(tela, /não entram no saldo oficial/, "o previsto não se confunde com o gasto oficial");

  clicar(botaoCom("Definir limite"));
  await esperarPor(() => Boolean(raizDoDocumento.querySelector("#orcamento-coletivo")), "o formulário do limite abrir");
  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#orcamento-coletivo")!, "5000,00");
  clicar(botaoCom("Salvar limite do grupo"));
  await esperarPor(() => textoDaTela().includes("Limite da viagem: R$ 5.000,00"), "o limite novo ser confirmado na tela");
  assert.match(textoDaTela(), /Vale como planejamento do grupo/, "a tela deixa claro o que o limite vale");
});

test("participante não define o limite do grupo: a tela diz de quem é a ação", async () => {
  await abrirGastos({
    id: "v1",
    nome: "Serra",
    destino: "Campos do Jordão",
    estado: "planejada",
    versao: 1,
    papel: "participante",
    atividades: ATIVIDADES,
    limiteColetivoCentavos: "400000",
  });
  await esperarPor(() => Boolean(botaoCom("Ajustar limite")), "o botão de ajustar o limite aparecer");
  clicar(botaoCom("Ajustar limite"));
  await esperarPor(() => textoDaTela().includes("Só quem organiza define o limite do grupo"), "a explicação aparecer");
  assert.ok(!raizDoDocumento.querySelector("#orcamento-coletivo"), "nem mostramos o campo que o servidor negaria");
});

test("despesas mostram natureza explícita (no saldo oficial × fora) e só oferecem Confirmar quando autorizado", async () => {
  await abrirGastos({
    id: "v1",
    nome: "Serra",
    destino: "Campos do Jordão",
    estado: "planejada",
    versao: 1,
    papel: "organizador",
    atividades: ATIVIDADES,
    despesas: [
      {
        id: "d-minha",
        descricao: "Táxi da rodoviária",
        valorCentavos: "4500",
        moeda: "BRL",
        data: "2026-11-20",
        tipo: "compartilhada",
        estado: "pendente",
        pagadorId: "u1",
        autorId: "u1",
        rateio: { metodo: "igualitario", explicacao: "R$ 22,50 por pessoa", cotas: [] },
      },
      {
        id: "d-oficial",
        descricao: "Jantar de sexta",
        valorCentavos: "12000",
        moeda: "BRL",
        data: "2026-11-20",
        tipo: "compartilhada",
        estado: "confirmada",
        pagadorId: "u1",
        autorId: "u1",
        rateio: { metodo: "igualitario", explicacao: "R$ 60,00 por pessoa", cotas: [] },
      },
    ],
  });

  await esperarPor(() => textoDaTela().includes("Táxi da rodoviária"), "as despesas aparecerem");
  const tela = textoDaTela();
  assert.match(tela, /aguardando confirmação \(fora do saldo oficial\)/, "despesa pendente diz que está fora do saldo oficial");
  assert.match(tela, /no saldo oficial/, "despesa confirmada diz que já conta no saldo oficial");
  assert.match(tela, /Quem lançou não confirma o próprio lançamento/, "explica em texto na tela quem pode confirmar e por quê");
  assert.equal(botaoCom("Confirmar"), null, "não mostra botão Confirmar para quem lançou a própria despesa (§8)");
});

