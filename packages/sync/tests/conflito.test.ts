import test from "node:test";
import assert from "node:assert/strict";
import { classificarConflito, compararParaDecisao, ehCampoSensivel, rotuloDoCampo } from "../src/conflito.ts";

test("campo igual nos dois lados não é conflito", () => {
  const resultado = classificarConflito(
    { nome: "Praia", destino: "Ubatuba" },
    { nome: "Praia", destino: "Ubatuba" },
    ["nome"],
  );
  assert.equal(resultado.tipo, "sem_conflito");
  assert.deepEqual(resultado.camposEmConflito, []);
});

test("campos diferentes alterados em cada lado são mesclados (não são a mesma decisão)", () => {
  const resultado = classificarConflito(
    { nome: "Praia 2027", destino: "Ubatuba" },
    { nome: "Praia 2026", destino: "Paraty" },
    ["nome"],
  );
  assert.equal(resultado.tipo, "mesclavel");
  assert.equal(resultado.mesclado?.["nome"], "Praia 2027", "a alteração do aparelho é preservada");
  assert.equal(resultado.mesclado?.["destino"], "Paraty", "o resto vem do servidor");
  assert.equal(resultado.envolveDinheiro, false);
});

test("mesmo campo alterado nos dois lados sem dinheiro: segue com a versão do aparelho", () => {
  const resultado = classificarConflito({ nome: "Praia 2027" }, { nome: "Praia 2026" }, ["nome"]);
  assert.equal(resultado.tipo, "mesclavel");
  assert.deepEqual(resultado.camposEmConflito, ["nome"]);
  assert.equal(resultado.mesclado?.["nome"], "Praia 2027");
});

test("valor de despesa divergente NUNCA é resolvido sozinho", () => {
  const resultado = classificarConflito(
    { valorCentavos: "15000", descricao: "Jantar" },
    { valorCentavos: "12000", descricao: "Jantar" },
    ["valorCentavos"],
  );
  assert.equal(resultado.tipo, "decisao_humana");
  assert.equal(resultado.envolveDinheiro, true);
  assert.deepEqual(resultado.camposEmConflito, ["valorCentavos"]);
});

test("moeda, rateio, participantes e quem pagou também contam como dinheiro", () => {
  for (const campo of ["valorCentavos", "moeda", "rateio", "participantes", "pagadorId"]) {
    assert.equal(ehCampoSensivel(campo), true, `${campo} mexe em quem deve o quê`);
  }
  assert.equal(ehCampoSensivel("descricao"), false);
  assert.equal(ehCampoSensivel("nome"), false);
});

test("conflito que junta dinheiro com campo simples continua exigindo decisão", () => {
  const resultado = classificarConflito(
    { valorCentavos: "9999", descricao: "Almoço no porto" },
    { valorCentavos: "10000", descricao: "Almoço" },
    ["valorCentavos", "descricao"],
  );
  assert.equal(resultado.tipo, "decisao_humana");
  assert.deepEqual(resultado.camposEmConflito, ["valorCentavos", "descricao"]);
});

test("comparação para a tela usa português simples e marca o que é dinheiro", () => {
  const linhas = compararParaDecisao(
    { valorCentavos: "15000", descricao: "Jantar" },
    { valorCentavos: "12000", descricao: "Jantar" },
    ["valorCentavos", "descricao"],
  );
  assert.deepEqual(linhas.map((linha) => linha.rotulo), ["Valor", "Descrição"]);
  assert.equal(linhas[0]!.sensivel, true);
  assert.equal(linhas[1]!.sensivel, false);
  assert.equal(linhas[0]!.valorLocal, "15000");
  assert.equal(linhas[0]!.valorRemoto, "12000");
});

test("rótulo de campo desconhecido não inventa nome bonito, mas também não quebra", () => {
  assert.equal(rotuloDoCampo("campoNovo"), "campoNovo");
  assert.equal(rotuloDoCampo("dataInicio"), "Data de início");
});
