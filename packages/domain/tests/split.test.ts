import test from "node:test";
import assert from "node:assert/strict";
import { BPS_TOTAL, calcularRateio, validarSomaExata } from "../src/split.ts";
import { somar } from "../src/money.ts";

test("rateio igualitário divide e explica quem recebeu o centavo", () => {
  const resultado = calcularRateio(1000n, { metodo: "igualitario", participantes: ["ana", "bruno", "carla"] });
  assert.deepEqual(
    resultado.partes.map((parte) => parte.valor),
    [334n, 333n, 333n],
  );
  assert.equal(somar(...resultado.partes.map((parte) => parte.valor)), 1000n);
  assert.match(resultado.explicacao, /ana/);
  assert.equal(resultado.ajusteTotal, 1000n);
});

test("rateio igualitário de 1 centavo entre 3 pessoas soma exatamente 1 centavo", () => {
  const resultado = calcularRateio(1n, { metodo: "igualitario", participantes: ["a", "b", "c"] });
  assert.equal(somar(...resultado.partes.map((parte) => parte.valor)), 1n);
  assert.deepEqual(
    resultado.partes.map((parte) => parte.valor),
    [1n, 0n, 0n],
  );
});

test("rateio percentual respeita os percentuais e fecha a conta", () => {
  // 9999 centavos em 50/30/20: as frações maiores (carla .8, bruno .7) recebem os
  // dois centavos que sobram — método do maior resto, determinístico e explicado.
  const resultado = calcularRateio(9999n, {
    metodo: "percentual",
    partes: [
      { participanteId: "ana", bps: 5000 },
      { participanteId: "bruno", bps: 3000 },
      { participanteId: "carla", bps: 2000 },
    ],
  });
  assert.equal(somar(...resultado.partes.map((parte) => parte.valor)), 9999n);
  assert.deepEqual(
    resultado.partes.map((parte) => parte.valor),
    [4999n, 3000n, 2000n],
  );
  assert.match(resultado.explicacao, /carla/);
  assert.match(resultado.explicacao, /bruno/);
});

test("rateio percentual exige soma de 100% (10.000 bps)", () => {
  assert.throws(
    () =>
      calcularRateio(100n, {
        metodo: "percentual",
        partes: [
          { participanteId: "ana", bps: 5000 },
          { participanteId: "bruno", bps: 4000 },
        ],
      }),
    /devem somar 100%/,
  );
  assert.throws(
    () =>
      calcularRateio(100n, {
        metodo: "percentual",
        partes: [{ participanteId: "ana", bps: 33.3 }],
      }),
    /inteiros em basis points/,
  );
  assert.equal(BPS_TOTAL, 10000);
});

test("rateio por valores fixos precisa conferir com o total", () => {
  const ok = calcularRateio(5000n, {
    metodo: "valores",
    partes: [
      { participanteId: "ana", valor: 2000n },
      { participanteId: "bruno", valor: 3000n },
    ],
  });
  assert.equal(somar(...ok.partes.map((parte) => parte.valor)), 5000n);
  assert.throws(
    () =>
      calcularRateio(5000n, {
        metodo: "valores",
        partes: [
          { participanteId: "ana", valor: 2000n },
          { participanteId: "bruno", valor: 2500n },
        ],
      }),
    /deve ser exatamente igual ao total/,
  );
});

test("rateio rejeita participantes duplicados, vazios e negativos", () => {
  assert.throws(() => calcularRateio(100n, { metodo: "igualitario", participantes: [] }), /ao menos um participante/);
  assert.throws(() => calcularRateio(100n, { metodo: "igualitario", participantes: ["a", "a"] }), /repetido/);
  assert.throws(() => calcularRateio(100n, { metodo: "igualitario", participantes: [""] }), /sem identificação/);
  assert.throws(
    () =>
      calcularRateio(100n, {
        metodo: "valores",
        partes: [
          { participanteId: "a", valor: 101n },
          { participanteId: "b", valor: -1n },
        ],
      }),
    /não pode ser negativa/,
  );
  assert.throws(() => calcularRateio(-100n, { metodo: "igualitario", participantes: ["a"] }), /não pode ser negativo/);
});

test("validarSomaExata confere totais", () => {
  assert.equal(validarSomaExata([{ valor: 600n }, { valor: 400n }], 1000n), true);
  assert.equal(validarSomaExata([{ valor: 600n }, { valor: 300n }], 1000n), false);
});

test("rateio igualitário de valores grandes mantém soma exata e diferença de 1 centavo", () => {
  const total = 123456789123n;
  const participantes = Array.from({ length: 7 }, (_, indice) => `p${indice}`);
  const resultado = calcularRateio(total, { metodo: "igualitario", participantes });
  assert.equal(somar(...resultado.partes.map((parte) => parte.valor)), total);
  const valores = resultado.partes.map((parte) => parte.valor);
  const maior = valores.reduce((a, b) => (a > b ? a : b));
  const menor = valores.reduce((a, b) => (a < b ? a : b));
  assert.equal(maior - menor, 1n);
});
