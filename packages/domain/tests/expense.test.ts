import test from "node:test";
import assert from "node:assert/strict";
import { type Despesa, type NovaDespesa, confirmarDespesa, contestarDespesa, corrigirDespesa, criarDespesa, entraNoSaldoOficial, resumoEstado } from "../src/expense.ts";
import type { ContextoAutorizacao } from "../src/permissions.ts";
import { somar } from "../src/money.ts";

const contextoParticipante: ContextoAutorizacao = { papel: "participante", estadoMembro: "ativo", estadoViagem: "em_andamento" };

const base: NovaDespesa = {
  id: "d1",
  viagemId: "v1",
  autorId: "ana",
  pagadorId: "ana",
  tipo: "compartilhada",
  valorCentavos: 10000n,
  moeda: "BRL",
  data: "2026-12-21",
  descricao: "Hospedagem",
  participantes: ["ana", "bruno", "carla"],
};

test("despesa nova nasce pendente e não entra no saldo oficial", () => {
  const despesa = criarDespesa(base);
  assert.equal(despesa.estado, "pendente");
  assert.equal(entraNoSaldoOficial(despesa), false);
  assert.equal(somar(...despesa.rateio.partes.map((parte) => parte.valor)), 10000n);
  assert.match(resumoEstado(despesa), /não entra nos saldos oficiais/);
});

test("campos obrigatórios são validados", () => {
  assert.throws(() => criarDespesa({ ...base, valorCentavos: 0n }), /maior que zero/);
  assert.throws(() => criarDespesa({ ...base, moeda: "reais" }), /três letras/);
  assert.throws(() => criarDespesa({ ...base, data: "21/12/2026" }), /AAAA-MM-DD/);
  assert.throws(() => criarDespesa({ ...base, descricao: " " }), /Descreva a despesa/);
  assert.throws(() => criarDespesa({ ...base, pagadorId: "" }), /quem pagou/);
});

test("confirmação exige outra pessoa e move a despesa para o saldo oficial", () => {
  const despesa = criarDespesa(base);
  assert.throws(
    () => confirmarDespesa(despesa, { usuarioId: "ana", contexto: contextoParticipante }),
    /não pode confirmá-la/,
  );
  const confirmada = confirmarDespesa(despesa, { usuarioId: "bruno", contexto: contextoParticipante });
  assert.equal(confirmada.estado, "confirmada");
  assert.equal(entraNoSaldoOficial(confirmada), true);
  assert.equal(confirmada.versao, 2);
  assert.equal(confirmada.historico.length, 2);
  assert.equal(confirmada.historico[1]?.autorId, "bruno");
});

test("não é possível confirmar duas vezes nem confirmar cancelada", () => {
  const despesa = criarDespesa(base);
  const confirmada = confirmarDespesa(despesa, { usuarioId: "bruno", contexto: contextoParticipante });
  assert.throws(() => confirmarDespesa(confirmada, { usuarioId: "carla", contexto: contextoParticipante }), /já está confirmada/);
  assert.throws(
    () => confirmarDespesa({ ...despesa, estado: "cancelada" }, { usuarioId: "bruno", contexto: contextoParticipante }),
    /cancelada não pode ser confirmada/,
  );
});

test("contestação exige motivo, vem de outra pessoa e tira a despesa do saldo oficial", () => {
  const despesa = confirmarDespesa(criarDespesa(base), { usuarioId: "bruno", contexto: contextoParticipante });
  assert.throws(() => contestarDespesa(despesa, { usuarioId: "carla", contexto: contextoParticipante }, "oi"), /mínimo 5/);
  assert.throws(() => contestarDespesa(despesa, { usuarioId: "ana", contexto: contextoParticipante }, "Valor incorreto"), /use a correção/);
  const contestada = contestarDespesa(despesa, { usuarioId: "carla", contexto: contextoParticipante }, "Valor incorreto: paguei metade.");
  assert.equal(contestada.estado, "contestada");
  assert.equal(entraNoSaldoOficial(contestada), false);
  assert.match(resumoEstado(contestada), /fora dos saldos oficiais até a resolução/);
});

test("correção exige motivo, preserva histórico e volta para pendente", () => {
  const despesa = confirmarDespesa(criarDespesa(base), { usuarioId: "bruno", contexto: contextoParticipante });
  assert.throws(() => corrigirDespesa(despesa, { usuarioId: "ana", contexto: contextoParticipante }, { valorCentavos: 20000n }, "oi"), /mínimo 5/);
  assert.throws(
    () => corrigirDespesa(despesa, { usuarioId: "carla", contexto: contextoParticipante }, { valorCentavos: 20000n }, "Valor errado"),
    /Somente quem lançou a despesa ou o organizador/,
  );
  assert.throws(
    () => corrigirDespesa(despesa, { usuarioId: "ana", contexto: contextoParticipante }, {}, "Ajustando o valor"),
    /Nenhum dado foi alterado/,
  );
  const corrigida = corrigirDespesa(
    despesa,
    { usuarioId: "ana", contexto: contextoParticipante },
    { valorCentavos: 20000n },
    "Valor digitado errado: era 200,00 e não 100,00",
  );
  assert.equal(corrigida.estado, "pendente");
  assert.equal(entraNoSaldoOficial(corrigida), false);
  const evento = corrigida.historico.at(-1);
  assert.equal(evento?.acao, "despesa:corrigir");
  assert.equal(evento?.alteracoes?.valorCentavos?.de, "10000");
  assert.equal(evento?.alteracoes?.valorCentavos?.para, "20000");
  assert.equal(somar(...corrigida.rateio.partes.map((parte) => parte.valor)), 20000n);
  assert.equal(despesa.valorCentavos, 10000n, "o registro anterior não é sobrescrito");
});

test("despesa pessoal não cria obrigação para outras pessoas", () => {
  const pessoal = criarDespesa({ ...base, tipo: "pessoal", participantes: ["ana", "bruno"] });
  assert.equal(pessoal.rateio.partes.length, 1);
  assert.equal(pessoal.rateio.partes[0]?.participanteId, "ana");
  assert.equal(pessoal.rateio.partes[0]?.valor, 10000n);
});

test("rateio da despesa compartilhada pode ser percentual ou por valores", () => {
  const porPercentual = criarDespesa({
    ...base,
    rateio: {
      metodo: "percentual",
      partes: [
        { participanteId: "ana", bps: 5000 },
        { participanteId: "bruno", bps: 5000 },
      ],
    },
  });
  assert.deepEqual(porPercentual.rateio.partes.map((parte) => parte.valor), [5000n, 5000n]);

  assert.throws(
    () =>
      criarDespesa({
        ...base,
        rateio: { metodo: "valores", partes: [{ participanteId: "ana", valor: 9999n }] },
      }),
    /exatamente igual ao total/,
  );
});

test("despesa de valor quebrado em 3 pessoas soma exatamente o total", () => {
  const despesa = criarDespesa({ ...base, valorCentavos: 10000n, participantes: ["ana", "bruno", "carla"] });
  assert.deepEqual(despesa.rateio.partes.map((parte) => parte.valor), [3334n, 3333n, 3333n]);
  assert.equal(somar(...despesa.rateio.partes.map((parte) => parte.valor)), despesa.valorCentavos);
});

test("histórico preservado em sequência completa: criar → confirmar → contestar → corrigir → confirmar", () => {
  let despesa: Despesa = criarDespesa(base);
  despesa = confirmarDespesa(despesa, { usuarioId: "bruno", contexto: contextoParticipante });
  despesa = contestarDespesa(despesa, { usuarioId: "carla", contexto: contextoParticipante }, "Achei caro; revisar valor");
  despesa = corrigirDespesa(despesa, { usuarioId: "ana", contexto: contextoParticipante }, { valorCentavos: 8000n }, "Valor certo é 80,00");
  despesa = confirmarDespesa(despesa, { usuarioId: "bruno", contexto: contextoParticipante });
  assert.equal(despesa.estado, "confirmada");
  assert.deepEqual(
    despesa.historico.map((evento) => evento.acao),
    ["despesa:criar", "despesa:confirmar", "despesa:contestar", "despesa:corrigir", "despesa:confirmar"],
  );
  assert.equal(entraNoSaldoOficial(despesa), true);
});
