import test from "node:test";
import assert from "node:assert/strict";
import {
  avaliarTrecho,
  custoDoCartao,
  linhasDeContexto,
  linhasDoResumoDoDia,
  rotuloDoCusto,
  textoDoHorario,
  tituloDoConflito,
} from "../src/services/roteiro-texto.ts";

/**
 * Regras de exibição do roteiro (`docs/UI_VISUAL_GUIDELINES.md` §2 e `docs/UI_V1_DECISIONS.md` §7).
 * São regras de negócio da interface: se elas quebrarem, a tela passa a mentir sobre dinheiro ou
 * horário — por isso ficam em funções puras e têm teste.
 */

const semCusto = { centavos: null, natureza: null, aVerificar: false };

test("atividade sem horário diz que é flexível — nunca inventa uma hora", () => {
  assert.equal(textoDoHorario("09:30"), "09:30");
  assert.equal(textoDoHorario(null), "Horário flexível");
});

test("cartão mostra só o contexto que existe: local e duração ausentes não aparecem", () => {
  const linhas = linhasDeContexto({ local: null, duracaoMinutos: null, custo: semCusto });
  assert.deepEqual(linhas, [], "nada informado, nada exibido");
});

test("custo desconhecido fica omitido; a verificar aparece sinalizado (nunca R$ 0,00)", () => {
  const desconhecido = linhasDeContexto({ local: null, duracaoMinutos: null, custo: semCusto });
  assert.equal(desconhecido.length, 0);

  const aVerificar = linhasDeContexto({
    local: null,
    duracaoMinutos: null,
    custo: { centavos: null, natureza: null, aVerificar: true },
  });
  assert.deepEqual(aVerificar, [{ texto: "Custo a verificar", tipo: "a-verificar" }]);
  assert.ok(!aVerificar.some((l) => l.texto.includes("0,00")), "desconhecido jamais vira zero");
});

test("custo conhecido aparece com a natureza ao lado, na linha do valor", () => {
  const estimativa = linhasDeContexto({
    local: "Pousada",
    duracaoMinutos: 90,
    custo: { centavos: "3500", natureza: "estimativa", aVerificar: false },
  });
  assert.deepEqual(estimativa, [
    { texto: "Pousada", tipo: "local" },
    { texto: "1h30", tipo: "duracao" },
    { texto: "estimativa: R$ 35,00", tipo: "custo" },
  ]);

  const combinado = linhasDeContexto({
    local: null,
    duracaoMinutos: null,
    custo: { centavos: "12000", natureza: "compromisso", aVerificar: false },
  });
  assert.deepEqual(combinado, [{ texto: "valor já combinado: R$ 120,00", tipo: "custo" }]);
});

test("gratuito é zero explícito e rotulado — diferente de desconhecido", () => {
  assert.equal(rotuloDoCusto({ centavos: "0", natureza: "gratuito", aVerificar: false }), "Sem custo");
  const gratuito = linhasDeContexto({
    local: null,
    duracaoMinutos: null,
    custo: { centavos: "0", natureza: "gratuito", aVerificar: false },
  });
  assert.deepEqual(gratuito, [{ texto: "Sem custo: R$ 0,00", tipo: "custo" }]);
});

test("sem custo informado não recebe rótulo nenhum", () => {
  assert.equal(rotuloDoCusto(semCusto), null, "desconhecido não é gratuito nem estimativa");
});

test("conflito tem manchete própria, explicando o tipo", () => {
  assert.equal(tituloDoConflito("sobreposicao"), "Conflito de horário");
  assert.equal(tituloDoConflito("deslocamento_insuficiente"), "Deslocamento apertado");
});

test("trecho de deslocamento: compacto por padrão, aberto quando é longo, caro ou arriscado", () => {
  assert.equal(avaliarTrecho(null), null);
  assert.equal(avaliarTrecho({ minutos: null, km: null, custoCentavos: null, alerta: null }), null, "sem informação, sem trecho");

  const curto = avaliarTrecho({ minutos: 10, km: 2, custoCentavos: null, alerta: null });
  assert.equal(curto?.detalhado, false, "trecho curto fica compacto");
  assert.equal(curto?.resumo, "10 min · 2 km");

  assert.equal(avaliarTrecho({ minutos: 45, km: null, custoCentavos: null, alerta: null })?.detalhado, true, "45 min já é relevante");
  assert.equal(avaliarTrecho({ minutos: 10, km: null, custoCentavos: "6000", alerta: null })?.detalhado, true, "custo abre o trecho");

  const comRisco = avaliarTrecho({ minutos: 10, km: 2, custoCentavos: null, alerta: "Trilha fecha com chuva" });
  assert.equal(comRisco?.detalhado, true);
  assert.equal(comRisco?.alerta, "Trilha fecha com chuva", "o alerta acompanha o trecho mesmo quando compacto");
});

test("resumo do dia: atenção só para o que exige decisão, e o previsto só quando existe", () => {
  const calmo = linhasDoResumoDoDia({
    total: 2,
    concluidas: 1,
    flexiveis: 1,
    custoConhecidoCentavos: 0n,
    temCustoAVerificar: false,
    conflitos: 0,
  });
  assert.deepEqual(calmo, [
    { texto: "2 atividades", tipo: "normal" },
    { texto: "1 sem horário fixo", tipo: "normal" },
    { texto: "1 concluída(s)", tipo: "normal" },
  ]);

  const tenso = linhasDoResumoDoDia({
    total: 3,
    concluidas: 0,
    flexiveis: 1,
    custoConhecidoCentavos: 1234567n,
    temCustoAVerificar: true,
    conflitos: 1,
  });
  assert.deepEqual(tenso, [
    { texto: "3 atividades", tipo: "normal" },
    { texto: "1 sem horário fixo", tipo: "normal" },
    { texto: "Previsto: R$ 12.345,67", tipo: "normal" },
    { texto: "Custo a verificar", tipo: "atencao" },
    { texto: "1 conflito(s) de horário para resolver", tipo: "atencao" },
  ]);
  assert.equal(tenso[0]!.tipo, "normal", "a contagem do dia não é alarme");
});

test("resumo do dia com uma atividade não usa plural torto", () => {
  const um = linhasDoResumoDoDia({
    total: 1,
    concluidas: 0,
    flexiveis: 0,
    custoConhecidoCentavos: 0n,
    temCustoAVerificar: false,
    conflitos: 0,
  });
  assert.deepEqual(um, [{ texto: "1 atividade", tipo: "normal" }]);
});

test("cartão aceita a atividade na forma do servidor e na forma do domínio (a tela não fica em branco)", () => {
  const doServidor = linhasDeContexto({ local: "Estação", duracaoMinutos: 90, custo: { centavos: "12000", natureza: "compromisso", aVerificar: false } });
  const doDominio = linhasDeContexto({ local: "Estação", duracaoMinutos: 90, custoCentavos: 12000n, custoNatureza: "compromisso", custoAVerificar: false });

  assert.deepEqual(doDominio, doServidor);
  assert.ok(doServidor.some((linha) => linha.texto === "valor já combinado: R$ 120,00"));
});

test("atividade sem campo de custo nenhum não vira R$ 0,00 nem derruba o cartão", () => {
  const linhas = linhasDeContexto({ local: null, duracaoMinutos: null, custo: undefined });

  assert.deepEqual(linhas, [], "desconhecido fica omitido");
  const verificando = linhasDeContexto({ local: null, duracaoMinutos: null, custoAVerificar: true });
  assert.deepEqual(verificando, [{ texto: "Custo a verificar", tipo: "a-verificar" }]);
});

test("custoDoCartao: forma do servidor, forma do domínio e nada — sem inventar zero", () => {
  assert.deepEqual(custoDoCartao({ custo: { centavos: "350", natureza: "estimativa", aVerificar: false } }), { centavos: 350n, natureza: "estimativa", aVerificar: false });
  assert.deepEqual(custoDoCartao({ custoCentavos: null, custoNatureza: null, custoAVerificar: true }), { centavos: null, natureza: null, aVerificar: true });
  assert.deepEqual(custoDoCartao({}), { centavos: null, natureza: null, aVerificar: false });
});
