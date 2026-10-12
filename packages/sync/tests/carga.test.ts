import test from "node:test";
import assert from "node:assert/strict";
import { buscarPorId, cargaVazia, contarItens, detalheDaViagem, mesclarCarga, mesclarLista, removerDaCarga } from "../src/carga.ts";

/** Detalhe da viagem como a tela recebe: viagem + participantes + permissões. */
const viagem = (versao: number, extra: Record<string, unknown> = {}) => ({
  viagem: { id: "v1", nome: "Praia", versao, ...extra },
  papel: "organizador",
  participantes: [{ usuario_id: "u1", nome: "Ana", estado: "ativo" }],
  permissoes: { editar: { permitido: true } },
});

test("mesclar carga junta listas por id e mantém a lista de viagens vinda do servidor", () => {
  const atual = {
    ...cargaVazia(),
    viagens: [{ id: "v1", nome: "Praia" }],
    despesas: [{ id: "d1", descricao: "Hotel", versao: 1 }],
  };
  const resultado = mesclarCarga(atual, {
    viagens: [{ id: "v1", nome: "Praia" }, { id: "v2", nome: "Serra" }],
    despesas: [{ id: "d2", descricao: "Jantar", versao: 1 }],
  });
  assert.equal(resultado.viagens.length, 2);
  assert.deepEqual(resultado.despesas.map((d) => d["id"]), ["d1", "d2"]);
});

test("resposta atrasada nunca rebaixa dado mais novo que já está no aparelho", () => {
  const atual = { ...cargaVazia(), despesas: [{ id: "d1", descricao: "Hotel", versao: 5 }] };
  const resultado = mesclarCarga(atual, { despesas: [{ id: "d1", descricao: "Hotel", versao: 3 }] });
  assert.equal(resultado.despesas[0]!["versao"], 5, "a versão mais nova permanece");
});

test("item marcado como removido sai da carga local", () => {
  const lista = mesclarLista([{ id: "d1", versao: 1 }, { id: "d2", versao: 1 }], [{ id: "d1", removido: true }]);
  assert.deepEqual(lista.map((item) => item["id"]), ["d2"]);
});

test("a viagem aberta só é trocada se for a mesma e por versão igual ou maior", () => {
  const atual = { ...cargaVazia(), viagem: viagem(4) };
  const atualizada = mesclarCarga(atual, { viagem: viagem(4, { nome: "Praia atualizada" }) });
  assert.equal(atualizada.viagem?.viagem["nome"], "Praia atualizada");
  assert.equal(mesclarCarga(atual, { viagem: viagem(2) }).viagem?.viagem["versao"], 4, "versão antiga é ignorada");
  const outra = { viagem: { id: "v9", versao: 1 } };
  assert.equal(mesclarCarga(atual, { viagem: outra }).viagem?.viagem["id"], "v1", "outra viagem não substitui a aberta");
});

test("sem versão (convites) o servidor sempre atualiza", () => {
  const atual = { ...cargaVazia(), convites: [{ id: "c1", estado: "pendente" }] };
  const resultado = mesclarCarga(atual, { convites: [{ id: "c1", estado: "aceito" }] });
  assert.equal(resultado.convites[0]!["estado"], "aceito");
});

test("remover da carga e contar itens funcionam para a interface", () => {
  const carga = {
    ...cargaVazia(),
    viagens: [{ id: "v1" }],
    viagem: viagem(1),
    despesas: [{ id: "d1" }],
    movimentos: [{ id: "m1" }],
  };
  assert.equal(contarItens(carga), 4);
  assert.equal(buscarPorId(carga.despesas, "d1")?.["id"], "d1");
  assert.equal(buscarPorId(carga.despesas, "inexistente"), undefined);
  const semDespesas = removerDaCarga(carga, "despesas", "d1");
  assert.equal(semDespesas.despesas.length, 0);
  assert.equal(contarItens(semDespesas), 3);
  assert.equal(detalheDaViagem(carga)?.papel, "organizador");
  assert.equal(detalheDaViagem(cargaVazia()), null);
});

test("convites que recebi e convites da viagem são listas separadas", () => {
  const resultado = mesclarCarga(cargaVazia(), {
    convitesParaMim: [{ id: "c1", viagem_nome: "Praia" }],
    convites: [{ id: "c2", email: "alguem@exemplo.com", estado: "pendente" }],
  });
  assert.deepEqual(resultado.convitesParaMim.map((c) => c["id"]), ["c1"]);
  assert.deepEqual(resultado.convites.map((c) => c["id"]), ["c2"], "não se misturam na mesma tela");
});

test("lista sem id é ignorada em vez de virar lixo na interface", () => {
  const lista = mesclarLista([{ id: "d1" }], [{ descricao: "sem id" }, { id: "d2" }]);
  assert.deepEqual(lista.map((item) => item["id"]), ["d1", "d2"]);
});
