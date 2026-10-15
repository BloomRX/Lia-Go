/**
 * Limite de orçamento: o teto é planejamento, o gasto confirmado é oficial, e a tela precisa dos dois.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ROTULO_ESTADO_ORCAMENTO, definirLimite, situacaoDoOrcamento } from "../src/orcamento.ts";

test("limite coletivo não pertence a uma pessoa; individual precisa dizer de quem é", () => {
  const coletivo = definirLimite({ viagemId: "v1", escopo: "coletivo", centavos: 300000n, porId: "u1", em: "2026-10-15T12:00:00.000Z" });
  assert.equal(coletivo.usuarioId, null);
  assert.equal(coletivo.versao, 1);

  assert.throws(() => definirLimite({ viagemId: "v1", escopo: "coletivo", usuarioId: "u2", centavos: 100n, porId: "u1" }), /não pertence a uma pessoa/i);
  assert.throws(() => definirLimite({ viagemId: "v1", escopo: "individual", centavos: 100n, porId: "u1" }), /precisa dizer de quem/i);
  assert.throws(() => definirLimite({ viagemId: "v1", escopo: "coletivo", centavos: -1n, porId: "u1" }), /negativo/i);

  const individual = definirLimite({ viagemId: "v1", escopo: "individual", usuarioId: "u2", centavos: 50000n, porId: "u2" });
  assert.equal(individual.usuarioId, "u2");
});

test("sem limite o app diz 'sem limite' em vez de inventar um teto", () => {
  const situacao = situacaoDoOrcamento({ limiteCentavos: null, previstoCentavos: 245000n, gastoConfirmadoCentavos: 128000n });

  assert.equal(situacao.temLimite, false);
  assert.equal(situacao.estado, "sem_limite");
  assert.equal(situacao.percentualPrevisto, null, "sem limite não existe percentual");
  assert.match(situacao.resumo, /Sem limite definido/);
  assert.match(situacao.resumo, /R\$ 2\.450,00/);
  assert.equal(ROTULO_ESTADO_ORCAMENTO.sem_limite, "Sem limite");
});

test("dentro, perto e estourado: o estado sai do número, com alerta em texto", () => {
  const dentro = situacaoDoOrcamento({ limiteCentavos: 300000n, previstoCentavos: 150000n, gastoConfirmadoCentavos: 50000n });
  assert.equal(dentro.estado, "dentro");
  assert.equal(dentro.percentualPrevisto, 50);
  assert.deepEqual(dentro.alertas, []);
  assert.match(dentro.resumo, /Previsto R\$ 1\.500,00 de R\$ 3\.000,00 \(50%\)/);

  const perto = situacaoDoOrcamento({ limiteCentavos: 300000n, previstoCentavos: 245000n, gastoConfirmadoCentavos: 240000n });
  assert.equal(perto.estado, "atencao");
  assert.ok(perto.alertas.some((alerta) => /chegou a 80% do limite/.test(alerta)), "aviso em texto, não só cor");

  const estourado = situacaoDoOrcamento({ limiteCentavos: 300000n, previstoCentavos: 320000n, gastoConfirmadoCentavos: 310000n });
  assert.equal(estourado.estado, "estourado");
  assert.ok(estourado.alertas.some((alerta) => /gasto confirmado passou do limite em R\$ 100,00/.test(alerta)));
  assert.equal(estourado.restanteGastoCentavos, -10000n, "o restante negativo é a informação honesta");
});

test("previsto estourado sem gasto ainda dá para replanejar (e a tela diz isso)", () => {
  const situacao = situacaoDoOrcamento({ limiteCentavos: 100000n, previstoCentavos: 130000n, gastoConfirmadoCentavos: 20000n });

  assert.equal(situacao.estado, "estourado");
  assert.ok(situacao.alertas.some((alerta) => /ainda dá para replanejar antes de gastar/.test(alerta)));
  assert.ok(!situacao.alertas.some((alerta) => /gasto confirmado passou/.test(alerta)), "não acusa o gasto por conta do plano");
});

test("custo sem valor informado aparece como aviso: o previsto é o mínimo", () => {
  const situacao = situacaoDoOrcamento({ limiteCentavos: 300000n, previstoCentavos: 100000n, gastoConfirmadoCentavos: 0n, custosAVerificar: 2 });

  assert.ok(situacao.alertas.some((alerta) => /2 custos ainda sem valor informado/.test(alerta)));
  assert.match(situacao.resumo, /gasto confirmado R\$ 0,00/, "zero conhecido é zero explícito");
});

test("aguardando confirmação aparece separado do oficial no resumo", () => {
  const situacao = situacaoDoOrcamento({ limiteCentavos: 300000n, previstoCentavos: 100000n, gastoConfirmadoCentavos: 50000n, aguardandoCentavos: 25000n });

  assert.match(situacao.resumo, /R\$ 250,00 aguardando confirmação/);
  assert.equal(situacao.percentualGasto, 16, "o percentual oficial ignora o que não foi confirmado");
});

test("limite zero é um combinado explícito, não um erro silencioso", () => {
  const comGasto = situacaoDoOrcamento({ limiteCentavos: 0n, previstoCentavos: 0n, gastoConfirmadoCentavos: 1000n });
  assert.equal(comGasto.estado, "estourado");
  assert.ok(comGasto.alertas.some((alerta) => /limite está em zero/.test(alerta)));

  const vazio = situacaoDoOrcamento({ limiteCentavos: 0n, previstoCentavos: 0n, gastoConfirmadoCentavos: 0n });
  assert.equal(vazio.estado, "dentro");
  assert.equal(vazio.percentualGasto, 0);
});
