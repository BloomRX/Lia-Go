/**
 * Checklist na aba "Mais" (tela 15).
 *
 * O que este teste protege:
 *  - item novo entra pelo aparelho (fila) e aparece na hora, mesmo sem rede;
 *  - atraso é **rótulo de leitura**: prazo no passado não conclui nada;
 *  - concluir registra quem marcou; reabrir exige motivo (e a tela diz isso antes de salvar).
 */
import { botaoCom, clicar, digitar, esperarPor, esperarAtualizacoes, raizDoDocumento, textoDaTela } from "./ambiente.ts";
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

/** Botão pelo texto exato: "Reabrir" e "Reabrir item" são botões diferentes na mesma tela. */
function botaoExato(texto: string): HTMLButtonElement | null {
  return (
    (Array.from(raizDoDocumento.querySelectorAll("button")).find(
      (botao) => (botao.textContent ?? "").trim() === texto,
    ) as HTMLButtonElement) ?? null
  );
}

async function abrirMais(viagem: ViagemFalsa): Promise<{ servidor: ReturnType<typeof criarServidorFalso> }> {
  await criarArmazenamentoIndexedDB("lia-go").limpar();
  await esperarAtualizacoes(1);
  const servidor = criarServidorFalso([viagem]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes(viagem.nome), "a viagem aparecer");
  clicar(botaoCom(viagem.nome));
  await esperarPor(() => textoDaTela().includes("← Minhas viagens"), "a viagem abrir");
  clicar(botaoCom("Mais"));
  await esperarPor(() => textoDaTela().includes("Checklist"), "a área Mais abrir");
  return { servidor };
}

const VIAGEM_COM_ITEM: ViagemFalsa = {
  id: "v1",
  nome: "Serra",
  destino: "Campos do Jordão",
  estado: "planejada",
  versao: 1,
  papel: "organizador",
  checklist: [
    {
      id: "c1",
      viagemId: "v1",
      autorId: "u1",
      titulo: "Levar o passaporte",
      categoria: "documento",
      categoriaRotulo: "Documento",
      responsavelId: "u1",
      prazo: "2020-01-01",
      estado: "aberto",
      feitoPor: null,
      feitoEm: null,
      observacao: null,
      motivoReabertura: null,
      versao: 1,
    },
  ],
};

test("item atrasado aparece como atrasado e continua em aberto (o prazo não conclui nada)", async () => {
  await abrirMais(VIAGEM_COM_ITEM);
  await esperarPor(() => textoDaTela().includes("Levar o passaporte"), "o item chegar do servidor");

  const tela = textoDaTela();
  assert.match(tela, /Atrasado/, "o item atrasado é rotulado como atrasado");
  assert.match(tela, /1 em aberto · 1 atrasado/, "o resumo conta o atraso");
  assert.match(tela, /prazo 01\/01\/2020/, "a data aparece para dar contexto ao rótulo");
  assert.match(tela, /Marcar como feito/, "o item segue esperando uma pessoa");
});

test("concluir registra quem marcou e reabrir exige motivo", async () => {
  await abrirMais(VIAGEM_COM_ITEM);
  await esperarPor(() => textoDaTela().includes("Levar o passaporte"), "o item chegar do servidor");

  clicar(botaoCom("Marcar como feito"));
  await esperarPor(
    () => Boolean(botaoCom("Reabrir item")),
    "o item virar feito (o botão de reabrir só existe depois da conclusão)",
  );
  assert.match(textoDaTela(), /Concluído por Ana/, "quem concluiu fica registrado na tela");

  clicar(botaoCom("Reabrir item"));
  await esperarPor(() => Boolean(raizDoDocumento.querySelector("#checklist-reabrir-c1")), "o motivo ser pedido");
  assert.match(textoDaTela(), /Motivo da reabertura \(mínimo 5 caracteres\)/);

  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#checklist-reabrir-c1")!, "ops");
  clicar(botaoExato("Reabrir"));
  await esperarPor(() => textoDaTela().includes("mínimo 5 caracteres"), "o domínio recusar motivo curto");

  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#checklist-reabrir-c1")!, "O passaporte venceu");
  clicar(botaoExato("Reabrir"));
  await esperarPor(() => textoDaTela().includes("reaberto com o motivo registrado"), "a reabertura acontecer");
});

test("item criado sem rede fica na fila do aparelho e aparece na hora", async () => {
  const { servidor } = await abrirMais({
    id: "v1",
    nome: "Serra",
    destino: "Campos do Jordão",
    estado: "planejada",
    versao: 1,
    papel: "organizador",
  });
  await esperarPor(() => textoDaTela().includes("Nenhum item no checklist"), "o checklist vazio aparecer");

  clicar(botaoCom("Novo item"));
  await esperarPor(() => Boolean(raizDoDocumento.querySelector("#checklist-titulo")), "o formulário abrir");
  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#checklist-titulo")!, "Comprar protetor solar");
  clicar(botaoCom("Adicionar item"));

  await esperarPor(() => textoDaTela().includes("Comprar protetor solar"), "o item novo aparecer na tela");
  await esperarPor(
    () => servidor.chamadas.some((chamada) => chamada.metodo === "POST" && chamada.caminho.endsWith("/checklist")),
    "o item subir para o servidor",
  );
});
