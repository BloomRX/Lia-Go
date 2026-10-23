import test from "node:test";
import assert from "node:assert/strict";
import {
  alocarProporcional,
  analisarValorMonetario,
  centavos,
  formatarBRL,
  formatarValorSimples,
  somar,
} from "../src/money.ts";

test("centavos recusa número fracionário (nunca float como dinheiro)", () => {
  assert.throws(() => centavos(12.5), /não inteiro/);
  assert.equal(centavos(1250), 1250n);
  assert.equal(centavos("1250"), 1250n);
  assert.equal(centavos(1250n), 1250n);
  assert.throws(() => centavos("12,50"), /apenas dígitos/);
});

test("analisarValorMonetario entende formatos brasileiros", () => {
  assert.equal(analisarValorMonetario("12,50"), 1250n);
  assert.equal(analisarValorMonetario("1.234,56"), 123456n);
  assert.equal(analisarValorMonetario("1234.56"), 123456n);
  assert.equal(analisarValorMonetario("R$ 1.234,56"), 123456n);
  assert.equal(analisarValorMonetario("12"), 1200n);
  assert.equal(analisarValorMonetario(" 0,05 "), 5n);
  assert.equal(analisarValorMonetario("12.50"), 1250n, "ponto com 2 dígitos é decimal");
  assert.equal(analisarValorMonetario("1.234"), 123400n, "ponto com 3 dígitos é milhar em pt-BR");
  assert.equal(analisarValorMonetario("1.234.567"), 123456700n);
});

test("analisarValorMonetario rejeita entrada inválida", () => {
  assert.throws(() => analisarValorMonetario("abc"), /Informe um valor/);
  assert.throws(() => analisarValorMonetario("12,345"), /duas casas decimais/);
  assert.throws(() => analisarValorMonetario("12,3.4"), /inválido/);
  assert.throws(() => analisarValorMonetario(""), /Informe um valor/);
});

test("formatarBRL formata centavos em pt-BR", () => {
  assert.equal(formatarBRL(0n), "R$ 0,00");
  assert.equal(formatarBRL(5n), "R$ 0,05");
  assert.equal(formatarBRL(123456n), "R$ 1.234,56");
  assert.equal(formatarBRL(100000000n), "R$ 1.000.000,00");
  assert.equal(formatarBRL(-2500n), "-R$ 25,00");
  assert.equal(formatarValorSimples(123456n), "1.234,56");
});

test("alocarProporcional garante soma exata em divisão quebrada", () => {
  const { valores, ajustes } = alocarProporcional(1000n, [1n, 1n, 1n]);
  assert.deepEqual(valores, [334n, 333n, 333n]);
  assert.deepEqual(ajustes, [1, 0, 0]);
  assert.equal(somar(...valores), 1000n);
});

test("alocarProporcional é determinístico e soma exata em casos-limite", () => {
  const casos: [bigint, bigint[]][] = [
    [0n, [1n, 1n]],
    [1n, [1n, 1n, 1n]],
    [2n, [1n, 1n, 1n]],
    [999999n, [7n, 11n, 13n]],
    [100n, [3n, 3n, 3n, 1n]],
    [12345n, [2500n, 2500n, 2500n, 2500n]],
  ];
  for (const [total, pesos] of casos) {
    const primeira = alocarProporcional(total, pesos);
    const segunda = alocarProporcional(total, pesos);
    assert.deepEqual(primeira.valores, segunda.valores, `determinismo em ${total}`);
    assert.equal(somar(...primeira.valores), total, `soma exata em ${total}`);
    assert.ok(primeira.valores.every((valor) => valor >= 0n), "sem valores negativos");

    // Cada parte difere do valor proporcional exato por menos de 1 centavo.
    const somaPesos = pesos.reduce((soma, peso) => soma + peso, 0n);
    for (let indice = 0; indice < pesos.length; indice += 1) {
      const peso = pesos[indice] ?? 0n;
      const parte = primeira.valores[indice] ?? 0n;
      const exatoEscalado = total * peso; // comparar em escala: parte*somaPesos vs total*peso
      const diferenca = parte * somaPesos - exatoEscalado;
      assert.ok(
        diferenca > -somaPesos && diferenca < somaPesos,
        `parte ${indice} de ${total} ficou fora do intervalo de 1 centavo (diferença ${diferenca}/${somaPesos})`,
      );
    }
  }
});

test("com pesos iguais a diferença entre partes é de no máximo 1 centavo", () => {
  for (const [total, quantidade] of [
    [1000n, 3],
    [1n, 3],
    [2n, 3],
    [12345n, 4],
    [123456789123n, 7],
  ] as [bigint, number][]) {
    const { valores } = alocarProporcional(total, new Array<bigint>(quantidade).fill(1n));
    const maior = valores.reduce((a, b) => (a > b ? a : b));
    const menor = valores.reduce((a, b) => (a < b ? a : b));
    assert.equal(maior - menor <= 1n, true, `total ${total} entre ${quantidade} pessoas`);
    assert.equal(somar(...valores), total);
  }
});

test("alocarProporcional trata total negativo (estorno) preservando a soma", () => {
  const { valores } = alocarProporcional(-1000n, [1n, 1n, 1n]);
  assert.equal(somar(...valores), -1000n);
  assert.ok(valores.every((valor) => valor <= 0n));
});

test("alocarProporcional rejeita pesos inválidos", () => {
  assert.throws(() => alocarProporcional(100n, []), /ao menos um participante/);
  assert.throws(() => alocarProporcional(100n, [0n, 0n]), /não pode ser zero/);
  assert.throws(() => alocarProporcional(100n, [1n, -1n]), /não podem ser negativos/);
});
