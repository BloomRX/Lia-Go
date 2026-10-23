/**
 * Reservas na tela (aba "Mais"), rodando o app inteiro em jsdom.
 *
 * O que este teste protege (decisões V1 §13):
 *  - reserva criada entra como **prevista** e vai para a fila do aparelho (funciona sem rede);
 *  - confirmar exige **evidência** — sem texto, a tela avisa e nada muda;
 *  - a revisão de impacto aparece **antes** do botão de confirmar/cancelar;
 *  - valor desconhecido aparece como "Valor a verificar", nunca como R$ 0,00.
 */
import { botaoCom, clicar, digitar, esperarPor, esperarAtualizacoes, raizDoDocumento, textoDaTela } from "./ambiente.ts";
import { criarServidorFalso, type ViagemFalsa } from "./servidor-falso.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/App.tsx";
import { criarArmazenamentoIndexedDB } from "../../src/offline/armazenamento.ts";

const VIAGEM: ViagemFalsa = {
  id: "v1",
  nome: "Serra",
  destino: "Campos do Jordão",
  estado: "planejada",
  versao: 1,
  papel: "organizador",
  atividades: [],
  reservas: [
    {
      id: "r1",
      viagemId: "v1",
      autorId: "u1",
      tipo: "hospedagem",
      titulo: "Pousada da Serra",
      local: "Rua das Flores, 120",
      inicio: "2026-11-20T14:00:00-03:00",
      fim: null,
      custoCentavos: "120000",
      custoAVerificar: false,
      confirmacao: null,
      confirmadaPor: null,
      confirmadaEm: null,
      estado: "prevista",
      motivoCancelamento: null,
      versao: 1,
    },
    {
      id: "r2",
      viagemId: "v1",
      autorId: "u1",
      tipo: "transporte",
      titulo: "Van do aeroporto",
      local: null,
      inicio: null,
      fim: null,
      custoCentavos: null,
      custoAVerificar: true,
      confirmacao: null,
      confirmadaPor: null,
      confirmadaEm: null,
      estado: "prevista",
      motivoCancelamento: null,
      versao: 1,
    },
  ],
};

let raizMontada: ReturnType<typeof createRoot> | null = null;

function montar(): void {
  // Cada teste monta o app do zero e usa um ponto novo, para a tela de um teste não vazar no outro.
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

async function limparAparelho(): Promise<void> {
  await criarArmazenamentoIndexedDB("lia-go").limpar();
  await esperarAtualizacoes(1);
}

/** Abre a viagem e a área "Mais", onde as reservas moram. */
async function abrirReservas(): Promise<{ servidor: ReturnType<typeof criarServidorFalso> }> {
  await limparAparelho();
  const servidor = criarServidorFalso([VIAGEM]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes("Serra"), "a viagem aparecer");
  clicar(botaoCom("Serra"));
  await esperarPor(() => textoDaTela().includes("← Minhas viagens"), "a viagem abrir");
  clicar(botaoCom("Mais"));
  await esperarPor(() => textoDaTela().includes("Reservas"), "a área Mais abrir");
  return { servidor };
}

test("reserva aparece com o valor previsto e o desconhecido como 'Valor a verificar'", async () => {
  await abrirReservas();
  await esperarPor(() => textoDaTela().includes("Pousada da Serra"), "as reservas carregarem");

  const tela = textoDaTela();
  assert.match(tela, /Pousada da Serra/);
  assert.match(tela, /Van do aeroporto/);
  assert.match(tela, /Valor a verificar/, "custo desconhecido nunca aparece como R$ 0,00");
  assert.ok(!tela.includes("R$ 0,00"), `nada de zero para valor desconhecido: ${tela.slice(0, 400)}`);
  assert.match(tela, /Previsto em reservas/);
  assert.match(tela, /R\$ 1\.200,00/, "o valor conhecido aparece no previsto");
  assert.match(tela, /1 prevista · 1 prevista|2 previstas/, "o resumo conta as reservas");
});

test("confirmar sem evidência avisa e não muda nada; com evidência, registra quem confirmou", async () => {
  const { servidor } = await abrirReservas();
  await esperarPor(() => textoDaTela().includes("Pousada da Serra"), "as reservas carregarem");

  clicar(botaoCom("Confirmar reserva"));
  await esperarAtualizacoes(2);
  assert.match(textoDaTela(), /Antes de continuar: o que isso muda/, "a revisão de impacto vem antes");
  assert.match(textoDaTela(), /já combinado/, "explica que o valor passa a ser combinado");

  clicar(botaoCom("Registrar confirmação"));
  await esperarAtualizacoes(2);
  assert.match(textoDaTela(), /evidência da confirmação/i, "sem evidência, a tela explica o que falta");
  assert.equal(
    servidor.chamadas.filter((chamada) => chamada.metodo === "POST" && chamada.caminho.endsWith("/confirmar")).length,
    0,
    "nada foi enviado ao servidor sem evidência",
  );

  const campo = raizDoDocumento.querySelector<HTMLInputElement>("#reserva-acao-r1");
  assert.ok(campo, "o campo da evidência precisa estar na tela");
  await digitar(campo, "Localizador ABC123");
  clicar(botaoCom("Registrar confirmação"));
  await esperarPor(() => textoDaTela().includes("Confirmada"), "a reserva ficar confirmada");
  assert.match(textoDaTela(), /Localizador ABC123/, "a evidência aparece na reserva");
});

test("cancelar mostra que o app não cancela no fornecedor e exige motivo", async () => {
  await abrirReservas();
  await esperarPor(() => textoDaTela().includes("Pousada da Serra"), "as reservas carregarem");

  clicar(botaoCom("Cancelar reserva"));
  await esperarAtualizacoes(2);

  const tela = textoDaTela();
  assert.match(tela, /não cancela a reserva no fornecedor/, "a tela não finge ter falado com o hotel");
  assert.match(tela, /R\$ 1\.200,00 deixam de ser contados/, "diz quanto sai do previsto");

  clicar(botaoCom("Registrar cancelamento"));
  await esperarAtualizacoes(2);
  assert.match(textoDaTela(), /motivo do cancelamento \(mínimo 5 caracteres\)/i, "motivo curto é recusado com explicação");
});

test("criar reserva entra como prevista, com o valor combinado separado da estimativa", async () => {
  const { servidor } = await abrirReservas();
  await esperarPor(() => textoDaTela().includes("Pousada da Serra"), "as reservas carregarem");

  clicar(botaoCom("Nova reserva"));
  await esperarPor(() => Boolean(raizDoDocumento.querySelector("#reserva-titulo")), "o formulário abrir");

  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#reserva-titulo")!, "Passeio de barco");
  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#reserva-custo")!, "350,00");
  clicar(botaoCom("Salvar reserva"));

  await esperarPor(() => textoDaTela().includes("Passeio de barco"), "a reserva nova aparecer");
  assert.match(textoDaTela(), /entrou como prevista/, "o aviso deixa claro que não foi confirmada");
  await esperarPor(
    () => servidor.chamadas.some((chamada) => chamada.metodo === "POST" && chamada.caminho.endsWith("/reservas")),
    "a reserva chegar ao servidor",
  );
  await esperarPor(() => textoDaTela().includes("R$ 350,00"), "o valor da reserva nova aparecer");
});

test("revisão de substituição do dia no roteiro (tela 8) mostra diferenças e impacto antes de aplicar", async () => {
  await limparAparelho();
  const servidor = criarServidorFalso([
    {
      id: "v1",
      nome: "Serra",
      destino: "Campos do Jordão",
      estado: "planejada",
      versao: 1,
      papel: "organizador",
      atividades: [
        {
          id: "a1",
          viagemId: "v1",
          autorId: "u1",
          dia: "2026-12-20",
          ordem: 1,
          titulo: "Trilha na mata",
          hora: "09:00",
          duracaoMinutos: 90,
          local: null,
          custo: { centavos: "5000", natureza: "estimativa", aVerificar: false },
          estado: "planejada",
          concluidaPor: null,
          concluidaEm: null,
          observacao: null,
          reservaId: null,
          deslocamento: null,
          versao: 1,
        },
      ],
    },
  ]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;
  montar();
  await esperarPor(() => Boolean(botaoCom("Serra")), "a viagem aparecer");
  clicar(botaoCom("Serra"));
  await esperarPor(() => Boolean(botaoCom("Roteiro")), "as abas aparecerem");
  clicar(botaoCom("Roteiro"));
  await esperarPor(() => textoDaTela().includes("Trilha na mata"), "a atividade do dia carregar");

  clicar(botaoCom("Substituir dia"));
  await esperarPor(() => Boolean(raizDoDocumento.querySelector("#proposta-roteiro-dia")), "abrir revisão de substituição");
  await digitar(
    raizDoDocumento.querySelector<HTMLTextAreaElement>("#proposta-roteiro-dia")!,
    "10:00 | Visita ao museu coberto | 120 | 90,00",
  );
  await esperarPor(
    () => textoDaTela().includes("Aumenta o previsto do dia em R$ 40,00"),
    "mostrar prévia do impacto no previsto do dia",
  );
  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#motivo-substituicao-dia")!, "Chuva forte pela manhã");
  clicar(botaoCom("Confirmar substituição do dia"));
  await esperarPor(() => textoDaTela().includes("Visita ao museu coberto"), "aplicar o novo plano do dia");
});

