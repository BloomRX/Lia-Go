import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { cargaVazia, enfileirar, filaVazia } from "@lia-go/sync";
import {
  CHAVE_CARGA,
  CHAVE_CURSOR,
  CHAVE_FILA,
  criarArmazenamentoDeSync,
  criarArmazenamentoIndexedDB,
  criarArmazenamentoMemoria,
  escolherArmazenamento,
} from "../src/offline/armazenamento.ts";

test("IndexedDB real (simulado em memória) grava, lê e apaga", async () => {
  const armazem = criarArmazenamentoIndexedDB("lia-go-teste-1");
  assert.equal(await armazem.ler("nada"), null);
  await armazem.gravar("chave", { valor: 7, lista: [1, 2] });
  assert.deepEqual(await armazem.ler("chave"), { valor: 7, lista: [1, 2] });
  await armazem.remover("chave");
  assert.equal(await armazem.ler("chave"), null);
});

test("a fila volta do aparelho exatamente como foi guardada (fechar o app não perde nada)", async () => {
  const armazem = criarArmazenamentoIndexedDB("lia-go-teste-2");
  const sync = criarArmazenamentoDeSync(armazem);
  const fila = enfileirar(filaVazia(), {
    id: "op-1",
    agora: "2026-10-12T12:00:00.000Z",
    operacao: { tipo: "criar_despesa", viagemId: "v1", corpo: { descricao: "Hotel" }, descricao: "Despesa: Hotel" },
  });
  await sync.gravarFila(fila);

  // Outro objeto lendo o mesmo armazenamento = app reaberto.
  const depois = await criarArmazenamentoDeSync(armazem).lerFila();
  assert.equal(depois.operacoes.length, 1);
  assert.equal(depois.operacoes[0]!.id, "op-1");
  assert.equal(depois.operacoes[0]!.estado, "aguardando");
  assert.equal(depois.operacoes[0]!.operacao.tipo, "criar_despesa");
});

test("carga e cursor sobrevivem ao reinício e o cursor aceita nulo", async () => {
  const armazem = criarArmazenamentoMemoria();
  const sync = criarArmazenamentoDeSync(armazem);
  assert.deepEqual(await sync.lerCarga(), { cursor: null, carga: cargaVazia() });

  await sync.gravarCarga("42", { ...cargaVazia(), viagens: [{ id: "v1" }] });
  const lido = await sync.lerCarga();
  assert.equal(lido.cursor, "42");
  assert.equal(lido.carga.viagens.length, 1);

  await sync.gravarCarga(null, cargaVazia());
  assert.equal((await sync.lerCarga()).cursor, null, "gravar sem cursor limpa o cursor antigo");
});

test("dado estragado no aparelho não derruba o app: vira fila vazia", async () => {
  const armazem = criarArmazenamentoMemoria({ [CHAVE_FILA]: { operacoes: "isso não é lista" } });
  const sync = criarArmazenamentoDeSync(armazem);
  assert.deepEqual(await sync.lerFila(), filaVazia());

  const comLixo = criarArmazenamentoDeSync(criarArmazenamentoMemoria({ [CHAVE_CARGA]: "texto solto" }));
  assert.deepEqual((await comLixo.lerCarga()).carga, cargaVazia());
});

test("limpar apaga tudo do aparelho (usado ao sair da conta)", async () => {
  const armazem = criarArmazenamentoIndexedDB("lia-go-teste-3");
  const sync = criarArmazenamentoDeSync(armazem);
  await sync.gravarFila(enfileirar(filaVazia(), {
    id: "op-9",
    agora: "2026-10-12T12:00:00.000Z",
    operacao: { tipo: "criar_viagem", corpo: { nome: "Praia" }, descricao: "Viagem: Praia" },
  }));
  await sync.gravarCarga("10", { ...cargaVazia(), viagens: [{ id: "v1" }] });
  await armazem.gravar(CHAVE_CURSOR, "10");

  await armazem.limpar();

  const depois = await sync.lerCarga();
  assert.deepEqual(depois, { cursor: null, carga: cargaVazia() });
  assert.equal((await sync.lerFila()).operacoes.length, 0);
});

test("escolha do armazenamento: nativo usa o do app; navegador usa IndexedDB; sem nenhum, memória", () => {
  assert.match(escolherArmazenamento(true).nome, /nativo/);
  assert.match(escolherArmazenamento(false).nome, /IndexedDB/);
});
