/**
 * Tela de detalhes da atividade em jsdom: a revisão de impacto aparece **antes** do botão que muda
 * (decisões V1 §13) e o dinheiro oficial não é calculado na tela.
 *
 * O teste roda o app inteiro (App.tsx) com servidor falso e IndexedDB de verdade.
 */
import { botaoCom, clicar, esperarPor, esperarAtualizacoes, raizDoDocumento, textoDaTela } from "./ambiente.ts";
import { criarServidorFalso } from "./servidor-falso.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/App.tsx";
import { CHAVE_CARGA, criarArmazenamentoIndexedDB } from "../../src/offline/armazenamento.ts";

const VIAGEM = {
  id: "v1",
  nome: "Serra",
  destino: "Campos do Jordão",
  estado: "planejada" as const,
  versao: 1,
  papel: "organizador" as const,
  atividades: [
    {
      id: "a1",
      viagemId: "v1",
      dia: "2026-11-20",
      ordem: 1,
      titulo: "Passeio de trem",
      hora: "09:00",
      duracaoMinutos: 90,
      local: "Estação",
      custo: { centavos: "12000", natureza: "compromisso", aVerificar: false },
      estado: "planejada",
      observacao: null,
      deslocamento: null,
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

async function abrirAtividade(): Promise<void> {
  await limparAparelho();
  const servidor = criarServidorFalso([VIAGEM]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes("Serra"), "a viagem aparecer");
  clicar(botaoCom("Serra"));
  await esperarPor(() => textoDaTela().includes("Roteiro"), "a viagem abrir");
  clicar(botaoCom("Roteiro"));
  await esperarPor(() => textoDaTela().includes("Passeio de trem"), "a linha do tempo carregar");
  clicar(botaoCom("Passeio de trem"));
  await esperarPor(() => textoDaTela().includes("Antes de continuar"), "os detalhes da atividade abrirem");
}

test("concluir mostra a revisão de impacto antes do botão e diz que o saldo oficial não muda aqui", async () => {
  await abrirAtividade();

  const tela = textoDaTela();
  assert.match(tela, /Antes de continuar: o que isso muda/);
  assert.match(tela, /quem concluiu/, "diz quem fica registrado");
  assert.match(tela, /planejado não é gasto/);
  assert.match(tela, /saldo oficial não se altera aqui/, "nada de insinuar pagamento/confirmação");
  assert.match(tela, /Marcar como concluída/, "o botão continua ali, só depois da revisão");
  // A revisão vem antes do botão na tela (é "antes de continuar", não um aviso depois do estrago).
  assert.ok(tela.indexOf("Antes de continuar") < tela.indexOf("Marcar como concluída"));
});

test("cancelar mostra quanto sai do previsto e que o histórico e as despesas ficam", async () => {
  await abrirAtividade();

  clicar(botaoCom("Cancelar atividade"));
  await esperarAtualizacoes(2);

  const tela = textoDaTela();
  assert.match(tela, /R\$ 120,00 deixam de ser contados/, "o valor que sai do previsto aparece");
  assert.match(tela, /não pode ser apagado/, "o motivo fica no histórico");
  assert.match(tela, /despesas já registradas continuam iguais/);
  assert.match(tela, /compromisso assumido fora do app/, "não finge que desfez um compromisso");
});

test("sem digitar o motivo, cancelar avisa o que falta e não muda nada", async () => {
  await abrirAtividade();

  clicar(botaoCom("Cancelar atividade"));
  await esperarAtualizacoes(2);

  assert.match(textoDaTela(), /Explique o motivo do cancelamento/);
  assert.ok(botaoCom("Cancelar atividade"), "a atividade continua planejada: nenhum cancelamento silencioso");
});
