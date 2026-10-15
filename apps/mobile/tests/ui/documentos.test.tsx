/**
 * Documentos na aba "Mais" (tela 16).
 *
 * O que este teste protege (decisões V1 §13):
 *  - documento novo entra como **privado** e a tela diz isso;
 *  - compartilhar é passo separado, com a **revisão de impacto antes** do botão que muda;
 *  - remover exige motivo e a tela avisa que nada é apagado em definitivo;
 *  - a tela nunca diz que o arquivo foi copiado para o app: o link continua sendo o link.
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
  await esperarPor(() => textoDaTela().includes("Documentos"), "a área Mais abrir");
  return { servidor };
}

const VIAGEM_SEM_DOCUMENTO: ViagemFalsa = {
  id: "v1",
  nome: "Serra",
  destino: "Campos do Jordão",
  estado: "planejada",
  versao: 1,
  papel: "organizador",
};

test("documento novo nasce privado e a tela explica a privacidade", async () => {
  await abrirMais(VIAGEM_SEM_DOCUMENTO);
  await esperarPor(() => textoDaTela().includes("Nenhum documento guardado"), "a lista vazia aparecer");
  assert.match(textoDaTela(), /começa privado/, "a tela diz, sem rodeio, quem vê");

  clicar(botaoCom("Novo documento"));
  await esperarPor(() => Boolean(raizDoDocumento.querySelector("#documento-nome")), "o formulário abrir");
  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#documento-nome")!, "Voo GRU–LIS");
  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#documento-descricao")!, "Localizador ABC123");
  clicar(botaoCom("Salvar como privado"));

  // Espera o documento **na lista** (o aviso "Só você vê até compartilhar" aparece antes da sincronização).
  await esperarPor(() => textoDaTela().includes("Voo GRU–LIS"), "o documento novo aparecer na lista");
  const tela = textoDaTela();
  assert.match(tela, /Só você/, "privado de verdade: a etiqueta diz quem vê");
  assert.match(tela, /Localizador ABC123/);
  assert.match(tela, /guardado como privado|Documento guardado como privado/, "o aviso confirma o que foi feito");
});

test("compartilhar mostra o impacto antes e não promete cópia do arquivo", async () => {
  await abrirMais({
    id: "v1",
    nome: "Serra",
    destino: "Campos do Jordão",
    estado: "planejada",
    versao: 1,
    papel: "organizador",
    documentos: [
      {
        id: "d1",
        viagemId: "v1",
        autorId: "u1",
        tipo: "passagem",
        tipoRotulo: "Passagem",
        nome: "Voo GRU–LIS",
        descricao: "Localizador ABC123",
        link: "https://cia.example.com/pedido/123",
        visibilidade: "privado",
        compartilhadoCom: [],
        estado: "ativo",
        removidoPor: null,
        removidoEm: null,
        motivoRemocao: null,
        versao: 1,
      },
    ],
  });
  await esperarPor(() => textoDaTela().includes("Voo GRU–LIS"), "o documento chegar do servidor");
  assert.match(textoDaTela(), /Só você/, "privado de verdade na lista");

  clicar(botaoCom("Compartilhar"));
  await esperarPor(() => textoDaTela().includes("Antes de compartilhar"), "a revisão de impacto aparecer");
  const tela = textoDaTela();
  assert.match(tela, /passam a ver este documento/);
  assert.match(tela, /o arquivo continua onde você o colocou/, "a tela não insinua que o app guardou o arquivo");
  assert.match(tela, /não copia o arquivo/);

  clicar(botaoCom("Confirmar compartilhamento"));
  await esperarPor(() => textoDaTela().includes("Compartilhado"), "o documento ficar compartilhado");
  assert.match(textoDaTela(), /todo mundo com acesso ativo vê/, "explica quem passa a ver");
});

test("remover exige motivo e diz que o registro continua guardado", async () => {
  await abrirMais({
    id: "v1",
    nome: "Serra",
    destino: "Campos do Jordão",
    estado: "planejada",
    versao: 1,
    papel: "organizador",
    documentos: [
      {
        id: "d1",
        viagemId: "v1",
        autorId: "u1",
        tipo: "seguro",
        tipoRotulo: "Seguro",
        nome: "Seguro viagem",
        descricao: null,
        link: null,
        visibilidade: "viagem",
        compartilhadoCom: [],
        estado: "ativo",
        removidoPor: null,
        removidoEm: null,
        motivoRemocao: null,
        versao: 2,
      },
    ],
  });
  await esperarPor(() => textoDaTela().includes("Seguro viagem"), "o documento chegar do servidor");

  clicar(botaoCom("Remover"));
  await esperarPor(() => textoDaTela().includes("Antes de remover"), "a revisão de impacto aparecer");
  assert.match(textoDaTela(), /Nada é apagado em definitivo/);

  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#documento-motivo-d1")!, "nao");
  clicar(botaoCom("Confirmar remoção"));
  await esperarPor(() => textoDaTela().includes("mínimo 5 caracteres"), "o domínio recusar motivo curto");

  await digitar(raizDoDocumento.querySelector<HTMLInputElement>("#documento-motivo-d1")!, "Seguro vencido e trocado");
  clicar(botaoCom("Confirmar remoção"));
  await esperarPor(() => textoDaTela().includes("removido da lista"), "a remoção acontecer");
  assert.match(textoDaTela(), /continuam guardados com quem organiza/, "a tela não finge apagar o histórico");
});
