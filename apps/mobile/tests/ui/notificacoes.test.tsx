/**
 * Central de notificações rodando no app de verdade (jsdom + IndexedDB de verdade).
 *
 * O que estes testes protegem (são as promessas da tela):
 *  - o aviso da tela inicial e a central mostram **o mesmo número** (senão ninguém confia nos dois);
 *  - **ler não resolve**: marcar como lida tira de "não lidas" e o item continua aberto;
 *  - **dispensar não esconde problema que cresce**: a viagem com 2 despesas pendentes dispensada volta
 *    a aparecer quando o servidor diz que agora são 3, e a antiga vira histórico de resolvida;
 *  - prioridade aparece em **texto** ("Alta prioridade"), nunca só por cor (§10);
 *  - o botão leva para a viagem **na aba certa** (despesa → Gastos), sem ação externa nenhuma;
 *  - a central diz o que ela alcança: não finge ter visto o que não viu.
 */
import {
  botaoCom,
  clicar,
  elemento,
  escolher,
  esperarAtualizacoes,
  esperarPor,
  raizDoDocumento,
  simularRede,
  simularVoltaAoApp,
  textoDaTela,
} from "./ambiente.ts";
import { criarServidorFalso, type ViagemFalsa } from "./servidor-falso.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/App.tsx";
import { criarArmazenamentoIndexedDB } from "../../src/offline/armazenamento.ts";

let raizMontada: ReturnType<typeof createRoot> | null = null;

function montar(): void {
  raizMontada?.unmount();
  raizDoDocumento.getElementById("raiz")?.remove();
  const conteiner = raizDoDocumento.createElement("div");
  conteiner.id = "raiz";
  raizDoDocumento.body.append(conteiner);
  raizMontada = createRoot(conteiner);
  raizMontada.render(createElement(App));
}

async function limparAparelho(): Promise<void> {
  await criarArmazenamentoIndexedDB("lia-go").limpar();
  (globalThis as { localStorage?: Storage }).localStorage?.clear();
}

const SERRA: ViagemFalsa = {
  id: "v1",
  nome: "Serra",
  destino: "Campos do Jordão",
  estado: "em_andamento",
  versao: 3,
  papel: "organizador",
  pendenciasFinanceiras: 2,
  atividades: [],
};

/** Convite que chegou para mim, de outra viagem, ainda pendente. */
const CONVITES_PARA_MIM = [
  { id: "c1", viagem_id: "v9", viagem_nome: "Chapada", papel: "participante", expira_em: "2030-01-01T00:00:00Z" },
];

async function abrirCentral(servidor: ReturnType<typeof criarServidorFalso>): Promise<void> {
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;
  montar();
  await esperarPor(() => textoDaTela().includes("Serra"), "a lista de viagens aparecer");
  clicar(botaoCom("Notificações"));
  await esperarPor(() => textoDaTela().includes("Situação") && textoDaTela().includes("Assunto"), "a central abrir");
}

test("o aviso da tela inicial conta o mesmo que a central (e abre a central)", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([SERRA], "u1", CONVITES_PARA_MIM);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes("Serra"), "a lista de viagens aparecer");

  // 2 abertas: a pendência financeira da viagem em andamento e o convite que chegou para mim.
  await esperarPor(() => /2 notificações abertas/.test(textoDaTela()), "o aviso de notificações aparecer");
  assert.match(textoDaTela(), /2 não lidas/);

  clicar(botaoCom("Notificações"));
  await esperarPor(() => textoDaTela().includes("Situação"), "a central abrir");
  assert.match(textoDaTela(), /2 notificações abertas/);
  assert.match(textoDaTela(), /2 despesas em "Serra" esperando confirmação/);
  assert.match(textoDaTela(), /Convite para "Chapada" esperando você/);
});

test("prioridade é texto, não cor: o item de urgência diz 'Alta prioridade'", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([SERRA], "u1", CONVITES_PARA_MIM);
  await abrirCentral(servidor);

  const etiquetas = Array.from(raizDoDocumento.querySelectorAll(".lista-notificacoes .etiqueta")).map((etiqueta) =>
    (etiqueta.textContent ?? "").trim(),
  );
  assert.equal(etiquetas.length, 2);
  assert.ok(etiquetas.every((texto) => texto === "Alta prioridade"), `etiquetas inesperadas: ${etiquetas.join(", ")}`);
  // A viagem está acontecendo: o texto diz que o valor está fora do saldo oficial (e não cobra ninguém).
  assert.match(textoDaTela(), /não entra no saldo oficial/);
});

test("ler não resolve: marcar como lida tira de 'não lidas' e o item continua aberto", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([SERRA], "u1", CONVITES_PARA_MIM);
  await abrirCentral(servidor);

  assert.match(textoDaTela(), /2 não lidas/);
  clicar(botaoCom("Marcar como lida"));
  await esperarPor(() => textoDaTela().includes("1 não lida"), "o resumo contar a lida");

  // Continua aberto: ler é "eu vi", não "está resolvido".
  assert.match(textoDaTela(), /2 notificações abertas/);

  const selecao = elemento<HTMLSelectElement>("#filtro-estado");
  assert.ok(selecao, "o filtro de situação precisa existir");
  await escolher(selecao, "nao_lidas");
  await esperarAtualizacoes(3);
  const itens = raizDoDocumento.querySelectorAll(".lista-notificacoes > li");
  assert.equal(itens.length, 1, `só a não lida deveria aparecer. Tela: ${textoDaTela().slice(0, 300)}`);
});

test("dispensar tira da lista de abertas e o filtro 'Dispensadas' traz de volta", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([SERRA], "u1", CONVITES_PARA_MIM);
  await abrirCentral(servidor);

  clicar(botaoCom("Dispensar"));
  await esperarPor(() => textoDaTela().includes("1 dispensada"), "a dispensa ser registrada");

  const selecao = elemento<HTMLSelectElement>("#filtro-estado");
  await escolher(selecao!, "dispensadas");
  await esperarAtualizacoes(3);
  assert.equal(raizDoDocumento.querySelectorAll(".lista-notificacoes > li").length, 1);
  const dispensado = raizDoDocumento.querySelector(".lista-notificacoes > li");
  assert.ok((dispensado?.className ?? "").includes("item-dispensada"));
  assert.ok(botaoCom("Trazer de volta"), "a dispensada precisa poder voltar");
});

test("dispensar não esconde problema que piora: 2 pendências viram 3 e a notificação volta", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([SERRA], "u1", []);
  await abrirCentral(servidor);

  assert.match(textoDaTela(), /2 despesas em "Serra" esperando confirmação/);
  clicar(botaoCom("Dispensar"));
  await esperarPor(() => textoDaTela().includes("Nada pendente por aqui"), "a dispensa ser registrada");

  // O servidor confirma uma despesa e entra outra: agora são 3 pendências (fato novo, chave nova).
  SERRA.pendenciasFinanceiras = 3;
  SERRA.versao = 4;
  await simularRede(false);
  await simularRede(true);

  await esperarPor(() => textoDaTela().includes("3 despesas em \"Serra\""), "a notificação nova aparecer", 5000);

  // A antiga (2 pendências) sai da lista e fica registrada como resolvida nos dados.
  const selecao = elemento<HTMLSelectElement>("#filtro-estado");
  await escolher(selecao!, "resolvidas");
  await esperarAtualizacoes(3);
  assert.match(textoDaTela(), /Resolvida nos dados/);
  assert.match(textoDaTela(), /2 despesas em "Serra" esperando confirmação/);

  SERRA.pendenciasFinanceiras = 2;
  SERRA.versao = 3;
});

test("ao voltar para o app, a central mostra o que mudou no servidor", async () => {
  await limparAparelho();
  const viagem: ViagemFalsa = { ...SERRA, pendenciasFinanceiras: 2, versao: 3 };
  const servidor = criarServidorFalso([viagem], "u1", []);
  await abrirCentral(servidor);
  assert.match(textoDaTela(), /2 despesas em "Serra" esperando confirmação/);

  // Alguém confirmou uma despesa enquanto a pessoa estava em outro aplicativo.
  viagem.pendenciasFinanceiras = 1;
  viagem.versao = 4;
  await simularVoltaAoApp();

  await esperarPor(() => textoDaTela().includes("1 despesa em \"Serra\""), "a central buscar a mudança ao voltar", 5000);
});

test("o item leva para a viagem na aba certa (despesa pendente abre Gastos)", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([SERRA], "u1", CONVITES_PARA_MIM);
  await abrirCentral(servidor);

  clicar(botaoCom("Ver despesas"));
  await esperarPor(() => textoDaTela().includes("Gasto confirmado (oficial)"), "a viagem abrir na aba Gastos", 5000);
  const abaAtual = Array.from(raizDoDocumento.querySelectorAll(".barra button")).find(
    (botao) => botao.getAttribute("aria-current") === "true",
  );
  assert.equal((abaAtual?.textContent ?? "").trim(), "Gastos", `aba aberta: ${abaAtual?.textContent}`);
  // Nenhuma insinuação de ação externa: o que a notificação abriu foi uma tela do próprio app.
  assert.match(textoDaTela(), /Serra/);
});

test("'só o que depende de mim' deixa de fora o que é do grupo", async () => {
  await limparAparelho();
  const despesa = {
    id: "d1",
    viagemId: "v1",
    autorId: "u1",
    descricao: "Hospedagem",
    valorCentavos: "10000",
    tipo: "compartilhada",
    rateio: { metodo: "igualitario", participantes: ["u1"] },
    estado: "pendente",
    versao: 1,
  };
  const viagem: ViagemFalsa = { ...SERRA, despesas: [despesa] };
  const servidor = criarServidorFalso([viagem], "u1", CONVITES_PARA_MIM);
  await abrirCentral(servidor);

  const caixa = raizDoDocumento.querySelector<HTMLInputElement>(".filtro-minhas input");
  assert.ok(caixa, "o filtro 'só o que depende de mim' precisa existir");
  caixa.click();
  await esperarAtualizacoes(3);

  const itens = raizDoDocumento.querySelectorAll(".lista-notificacoes > li");
  assert.equal(itens.length, 1, `só o convite depende de mim. Tela: ${textoDaTela().slice(0, 300)}`);
  assert.match(textoDaTela(), /Convite para "Chapada" esperando você/);
});

test("a central diz o que alcança e como voltar (nada de tela sem saída)", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([SERRA], "u1", []);
  await abrirCentral(servidor);

  // Sem viagem aberta, a central diz exatamente o que ela alcança (não finge ter visto o resto).
  assert.match(textoDaTela(), /Esta central olha a sua lista de viagens e os convites/);
  assert.match(textoDaTela(), /Abra uma viagem para ela incluir checklist, reservas, acertos e orçamento/);

  clicar(botaoCom("Voltar"));
  await esperarPor(() => textoDaTela().includes("Suas viagens"), "voltar para a tela inicial");
  assert.ok(!textoDaTela().includes("Situação"), "a central precisa fechar ao voltar");
});
