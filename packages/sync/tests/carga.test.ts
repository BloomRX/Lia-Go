import test from "node:test";
import assert from "node:assert/strict";
import {
  buscarPorId,
  cargaCompleta,
  cargaVazia,
  contarItens,
  detalheDaViagem,
  mesclarCarga,
  mesclarLista,
  removerDaCarga,
  trocarViagemAberta,
} from "../src/carga.ts";

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

test("roteiro: atividades do dia entram na carga local (offline) e a mais nova vence", () => {
  const atual = {
    ...cargaVazia(),
    atividades: [{ id: "a1", titulo: "Museu", versao: 1, estado: "planejada" }],
  };
  const resultado = mesclarCarga(atual, {
    // A atividade mudou no servidor (outra pessoa concluiu) e uma nova foi criada.
    atividades: [
      { id: "a1", titulo: "Museu", versao: 2, estado: "concluida" },
      { id: "a2", titulo: "Almoço", versao: 1, estado: "planejada" },
    ],
  });
  assert.deepEqual(resultado.atividades.map((item) => item["id"]), ["a1", "a2"]);
  assert.equal(resultado.atividades[0]!["estado"], "concluida");
  assert.equal(resultado.atividades[0]!["versao"], 2);

  // Resposta atrasada não rebaixa o que já está no aparelho.
  const atrasada = mesclarCarga(resultado, { atividades: [{ id: "a1", titulo: "Museu", versao: 1, estado: "planejada" }] });
  assert.equal(atrasada.atividades[0]!["estado"], "concluida", "o aparelho nunca volta para um estado antigo");

  assert.equal(contarItens(resultado), 2, "as duas atividades entram na contagem da carga");
});

test("roteiro: atividade cancelada sai da carga quando o servidor marca como removida", () => {
  const atual = { ...cargaVazia(), atividades: [{ id: "a1", titulo: "Trilha", versao: 2 }] };
  const resultado = mesclarCarga(atual, { atividades: [{ id: "a1", removido: true }] });
  assert.deepEqual(resultado.atividades, []);
  assert.deepEqual(removerDaCarga(resultado, "atividades", "a1").atividades, []);
});

/**
 * Defeitos reais de 2026-10-15 (relatados em uso): "criei outra viagem e ele volta para a primeira
 * cancelada". Estes testes travam as duas regras que evitam isso.
 */

test("trocar a viagem aberta descarta o que era da viagem anterior (menos a lista da conta)", () => {
  const antes = {
    ...cargaVazia(),
    viagens: [{ id: "v1" }, { id: "v2" }],
    convitesParaMim: [{ id: "c1" }],
    viagem: { viagem: { id: "v1", versao: 3 } },
    despesas: [{ id: "d1" }],
    movimentos: [{ id: "m1" }],
    atividades: [{ id: "a1" }],
    convites: [{ id: "cv1" }],
  };

  const depois = trocarViagemAberta(antes);

  assert.equal(depois.viagem, null, "nenhum detalhe de viagem fica na tela");
  assert.deepEqual(depois.despesas, []);
  assert.deepEqual(depois.movimentos, []);
  assert.deepEqual(depois.atividades, []);
  assert.deepEqual(depois.convites, []);
  assert.deepEqual(depois.viagens, antes.viagens, "a lista da conta continua");
  assert.deepEqual(depois.convitesParaMim, antes.convitesParaMim);
});

test("detalhe da viagem nova entra mesmo sendo de outra viagem; o da antiga não volta por atraso", () => {
  const atual = {
    ...cargaVazia(),
    viagem: { viagem: { id: "v1", versao: 5 } },
    atividades: [{ id: "a1", viagemId: "v1" }],
  };

  // A viagem aberta é a v2: o detalhe dela substitui o da v1.
  const trocando = mesclarCarga(atual, { viagem: { viagem: { id: "v2", versao: 1 } } }, { viagemAtiva: "v2" });
  assert.equal(trocando.viagem?.viagem.id, "v2");

  // Resposta atrasada da v1 chegando com a v2 aberta: nada é tocado.
  const atrasada = mesclarCarga(trocando, { viagem: { viagem: { id: "v1", versao: 9 } } }, { viagemAtiva: "v2" });
  assert.equal(atrasada.viagem?.viagem.id, "v2", "a viagem atrasada não sobrepõe a viagem aberta");

  // E as listas da viagem v1 que vieram junto também não entram.
  const contaminada = mesclarCarga(
    trocando,
    { viagem: { viagem: { id: "v1", versao: 9 } }, atividades: [{ id: "a1", viagemId: "v1" }], despesas: [{ id: "d1" }] },
    { viagemAtiva: "v2" },
  );
  assert.deepEqual(contaminada.atividades, [], "atividade de outra viagem não aparece");
  assert.deepEqual(contaminada.despesas, []);
});

test("cargaCompleta: cache gravado por versão anterior (sem as listas de hoje) não derruba a tela", () => {
  const antiga = { viagens: [{ id: "v1" }], viagem: null } as unknown as Parameters<typeof cargaCompleta>[0];

  const completa = cargaCompleta(antiga);

  assert.deepEqual(completa.reservas, [], "lista que ainda não existia no cache entra vazia");
  assert.deepEqual(completa.atividades, []);
  assert.deepEqual(completa.viagens, [{ id: "v1" }], "o que já estava guardado continua");
});

test("cargaCompleta de nada continua sendo a carga vazia (primeira abertura)", () => {
  assert.deepEqual(cargaCompleta(null), cargaVazia());
  assert.deepEqual(cargaCompleta(undefined), cargaVazia());
});
