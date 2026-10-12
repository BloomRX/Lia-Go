import test from "node:test";
import assert from "node:assert/strict";
import { type Movimento, calcularResumoFinanceiro, sugerirTransferencias } from "../src/balances.ts";
import { type Despesa, confirmarDespesa, contestarDespesa, criarDespesa } from "../src/expense.ts";
import type { ContextoAutorizacao } from "../src/permissions.ts";

const contexto: ContextoAutorizacao = { papel: "participante", estadoMembro: "ativo", estadoViagem: "em_andamento" };

function despesaConfirmada(id: string, pagador: string, valor: bigint, participantes: string[]): Despesa {
  const criada = criarDespesa({
    id,
    viagemId: "v1",
    autorId: participantes[0] ?? pagador,
    pagadorId: pagador,
    tipo: "compartilhada",
    valorCentavos: valor,
    moeda: "BRL",
    data: "2026-12-21",
    descricao: `Despesa ${id}`,
    participantes,
  });
  return confirmarDespesa(criada, { usuarioId: "revisor", contexto });
}

test("saldo = total pago − parte que lhe cabe (somente confirmadas)", () => {
  const despesas = [despesaConfirmada("d1", "ana", 30000n, ["ana", "bruno", "carla"])];
  const resumo = calcularResumoFinanceiro(despesas);
  const ana = resumo.saldos.find((saldo) => saldo.participanteId === "ana");
  const bruno = resumo.saldos.find((saldo) => saldo.participanteId === "bruno");
  assert.equal(ana?.pago, 30000n);
  assert.equal(ana?.parteDevida, 10000n);
  assert.equal(ana?.saldo, 20000n);
  assert.equal(bruno?.saldo, -10000n);
  assert.equal(resumo.realizado, 30000n);
  assert.equal(resumo.comprometido, 0n);
});

test("despesa pendente e contestada ficam em comprometido, fora do saldo oficial", () => {
  const pendente = criarDespesa({
    id: "d2",
    viagemId: "v1",
    autorId: "ana",
    pagadorId: "bruno",
    tipo: "compartilhada",
    valorCentavos: 5000n,
    moeda: "BRL",
    data: "2026-12-22",
    descricao: "Transporte",
    participantes: ["ana", "bruno"],
  });
  const contestada = contestarDespesa(
    confirmarDespesa(criarDespesa({
      id: "d3",
      viagemId: "v1",
      autorId: "ana",
      pagadorId: "carla",
      tipo: "compartilhada",
      valorCentavos: 2000n,
      moeda: "BRL",
      data: "2026-12-22",
      descricao: "Café",
      participantes: ["ana", "carla"],
    }), { usuarioId: "bruno", contexto }),
    { usuarioId: "bruno", contexto },
    "Valor divergente na nota",
  );
  const resumo = calcularResumoFinanceiro([despesaConfirmada("d1", "ana", 30000n, ["ana", "bruno", "carla"]), pendente, contestada]);
  assert.equal(resumo.realizado, 30000n);
  assert.equal(resumo.comprometido, 7000n);
  assert.equal(resumo.saldos.find((saldo) => saldo.participanteId === "carla")?.saldo, -10000n);
});

test("despesa pessoal não gera dívida entre participantes", () => {
  const pessoal = confirmarDespesa(
    criarDespesa({
      id: "d4",
      viagemId: "v1",
      autorId: "ana",
      pagadorId: "ana",
      tipo: "pessoal",
      valorCentavos: 9999n,
      moeda: "BRL",
      data: "2026-12-23",
      descricao: "Lembrança",
      participantes: ["ana", "bruno"],
    }),
    { usuarioId: "bruno", contexto },
  );
  const resumo = calcularResumoFinanceiro([pessoal]);
  assert.equal(resumo.saldos.length, 1);
  assert.equal(resumo.saldos[0]?.participanteId, "ana");
  assert.equal(resumo.saldos[0]?.saldo, 0n);
  assert.equal(resumo.haDivergencia, false);
});

test("transferências confirmadas quitam o saldo; informadas e contestadas não", () => {
  const despesas = [despesaConfirmada("d1", "ana", 30000n, ["ana", "bruno", "carla"])];
  const informado: Movimento = { id: "m1", viagemId: "v1", deId: "bruno", paraId: "ana", valorCentavos: 10000n, estado: "informado" };
  const contestado: Movimento = { id: "m2", viagemId: "v1", deId: "carla", paraId: "ana", valorCentavos: 10000n, estado: "contestado" };
  const semConfirmacao = calcularResumoFinanceiro(despesas, [informado, contestado]);
  assert.equal(semConfirmacao.saldos.find((saldo) => saldo.participanteId === "bruno")?.saldo, -10000n);

  const confirmado: Movimento = { ...informado, estado: "confirmado" };
  const comConfirmacao = calcularResumoFinanceiro(despesas, [confirmado]);
  assert.equal(comConfirmacao.saldos.find((saldo) => saldo.participanteId === "bruno")?.saldo, 0n);
  assert.equal(comConfirmacao.haDivergencia, true, "carla ainda deve");
});

test("sugestão de transferências minimiza o número de pagamentos e fecha exatamente", () => {
  const despesas = [
    despesaConfirmada("d1", "ana", 30000n, ["ana", "bruno", "carla"]),
    despesaConfirmada("d2", "bruno", 15000n, ["ana", "bruno", "carla"]),
  ];
  // ana pagou 300,00 e devia 150,00 → recebe 150,00; bruno pagou 150,00 e devia 150,00 → zero;
  // carla não pagou nada e deve 150,00.
  const resumo = calcularResumoFinanceiro(despesas);
  assert.equal(resumo.saldos.find((saldo) => saldo.participanteId === "bruno")?.saldo, 0n);
  const transferencias = sugerirTransferencias(resumo.saldos);
  assert.deepEqual(
    transferencias.map((transferencia) => [transferencia.deId, transferencia.paraId, transferencia.valorCentavos]),
    [["carla", "ana", 15000n]],
  );
  const totalSugerido = transferencias.reduce((soma, transferencia) => soma + transferencia.valorCentavos, 0n);
  const credito = resumo.saldos.filter((saldo) => saldo.saldo > 0n).reduce((soma, saldo) => soma + saldo.saldo, 0n);
  assert.equal(totalSugerido, credito);
});

test("saldo zerado não sugere transferências", () => {
  const despesas = [despesaConfirmada("d1", "ana", 10000n, ["ana", "bruno"])];
  const movimentos: Movimento[] = [{ id: "m1", viagemId: "v1", deId: "bruno", paraId: "ana", valorCentavos: 5000n, estado: "confirmado" }];
  const resumo = calcularResumoFinanceiro(despesas, movimentos);
  assert.deepEqual(sugerirTransferencias(resumo.saldos), []);
  assert.equal(resumo.haDivergencia, false);
});
