/**
 * Visão geral com as referências oficiais aplicadas (`assets/references/concept-03`):
 * hero com a Lia, "Próximo compromisso" em destaque e o aviso de que nada disso confirma nada.
 *
 * O que este teste protege:
 *  - a imagem da Lia aparece (import de asset pelo bundle, não um caminho quebrado);
 *  - o próximo compromisso é o que **ainda vai acontecer** — passado e cancelado ficam de fora;
 *  - quando não há nada à frente, a tela diz isso em vez de inventar um compromisso.
 */
import { botaoCom, clicar, esperarAtualizacoes, esperarPor, raizDoDocumento, textoDaTela } from "./ambiente.ts";
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
  raizMontada = null;
  const antiga = raizDoDocumento.getElementById("raiz");
  antiga?.remove();
  const nova = raizDoDocumento.createElement("div");
  nova.id = "raiz";
  raizDoDocumento.body.append(nova);
  raizMontada = createRoot(nova);
  raizMontada.render(createElement(App));
}

/** Data de amanhã (o "próximo" compromisso depende do dia de hoje, como na vida real). */
function amanha(): string {
  const agora = new Date();
  agora.setUTCDate(agora.getUTCDate() + 1);
  return agora.toISOString().slice(0, 10);
}

async function abrirViagem(viagem: ViagemFalsa): Promise<void> {
  await criarArmazenamentoIndexedDB("lia-go").limpar();
  await esperarAtualizacoes(1);
  const servidor = criarServidorFalso([viagem]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes(viagem.nome), "a viagem aparecer");
  clicar(botaoCom(viagem.nome));
  await esperarPor(() => textoDaTela().includes("Viagem ativa"), "a Visão geral abrir");
}

test("a Visão geral traz o hero com a Lia e o próximo compromisso que ainda vai acontecer", async () => {
  await abrirViagem({
    id: "v1",
    nome: "Serra",
    destino: "Campos do Jordão",
    estado: "planejada",
    versao: 1,
    papel: "organizador",
    atividades: [
      { id: "a1", viagemId: "v1", dia: "2020-01-01", ordem: 1, titulo: "Passeio antigo", hora: "09:00", custo: { centavos: null, natureza: null, aVerificar: false }, estado: "planejada", versao: 1 },
      { id: "a2", viagemId: "v1", dia: amanha(), ordem: 1, titulo: "Passeio de barco", hora: "10:00", local: "Ilha do Mantimento", custo: { centavos: "15000", natureza: "compromisso", aVerificar: false }, estado: "planejada", versao: 1 },
      { id: "a3", viagemId: "v1", dia: amanha(), ordem: 2, titulo: "Jantar cancelado", hora: "20:00", custo: { centavos: null, natureza: null, aVerificar: false }, estado: "cancelada", versao: 1 },
    ],
  });
  await esperarPor(() => textoDaTela().includes("Passeio de barco"), "o próximo compromisso aparecer");

  const tela = textoDaTela();
  assert.match(tela, /Viagem ativa/);
  assert.match(tela, /amanhã às 10:00/, "o compromisso é o de amanhã, com hora");
  assert.match(tela, /Ilha do Mantimento/, "o local aparece junto");
  assert.ok(!tela.includes("Passeio antigo"), "compromisso do passado não vira 'próximo'");
  assert.ok(!tela.includes("Jantar cancelado"), "compromisso cancelado não vira 'próximo'");
  assert.match(tela, /Ainda não aconteceu: nada aqui muda saldo nem confirma reserva/, "a tela não insinua ação que não houve");

  const imagem = raizDoDocumento.querySelector<HTMLImageElement>(".hero-viagem-imagem img");
  assert.ok(imagem, "o hero com a Lia precisa estar na Visão geral");
  assert.ok((imagem.getAttribute("src") ?? "").length > 0, "a imagem precisa resolver para um endereço de verdade");
  assert.equal(imagem.getAttribute("alt"), "", "imagem decorativa: quem usa leitor de tela não precisa dela");
});

test("sem nada à frente, a tela diz que não há compromisso (nada inventado)", async () => {
  await abrirViagem({
    id: "v1",
    nome: "Serra",
    destino: "Campos do Jordão",
    estado: "planejada",
    versao: 1,
    papel: "organizador",
    atividades: [
      { id: "a1", viagemId: "v1", dia: "2020-01-01", ordem: 1, titulo: "Passeio antigo", hora: "09:00", custo: { centavos: null, natureza: null, aVerificar: false }, estado: "planejada", versao: 1 },
    ],
  });
  await esperarPor(() => textoDaTela().includes("Próximo compromisso"), "o cartão do próximo compromisso aparecer");
  assert.match(textoDaTela(), /Nada marcado à frente no roteiro/);
});
