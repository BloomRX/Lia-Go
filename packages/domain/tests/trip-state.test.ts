import test from "node:test";
import assert from "node:assert/strict";
import {
  type Ator,
  type Viagem,
  dataNoFuso,
  impactosDeCancelamento,
  sugerirEstado,
  transicoesPermitidas,
  transicionar,
} from "../src/trip-state.ts";

const organizador: Ator = { usuarioId: "u-org", papel: "organizador", estadoMembro: "ativo" };
const participante: Ator = { usuarioId: "u-part", papel: "participante", estadoMembro: "ativo" };
const removido: Ator = { usuarioId: "u-fora", papel: "participante", estadoMembro: "removido" };

function viagem(parcial: Partial<Viagem> = {}): Viagem {
  return {
    id: "v1",
    estado: "planejada",
    dataInicio: "2026-12-20",
    dataFim: "2026-12-27",
    fusoHorario: "America/Sao_Paulo",
    versao: 3,
    ...parcial,
  };
}

test("any participante ativo confirma início e fim da viagem; removido não", () => {
  const inicio = transicionar(viagem(), "em_andamento", participante, { em: "2026-12-20T12:00:00.000Z" });
  assert.equal(inicio.viagem.estado, "em_andamento");
  assert.equal(inicio.viagem.versao, 4);
  assert.equal(inicio.evento.autorId, "u-part");

  const fim = transicionar(inicio.viagem, "concluida", participante, { em: "2026-12-28T12:00:00.000Z" });
  assert.equal(fim.viagem.estado, "concluida");

  assert.throws(() => transicionar(viagem(), "em_andamento", removido), /acesso ativo/);
});

test("a data sozinha nunca muda o estado — apenas sugere", () => {
  const v = viagem();
  const sugestao = sugerirEstado(v, "2026-12-21T12:00:00.000Z");
  assert.deepEqual(sugestao?.sugestao, "em_andamento");
  assert.match(sugestao?.motivo ?? "", /confirme/i);
  assert.equal(v.estado, "planejada", "sugestão não altera a viagem");
  assert.equal(sugestao?.requerConfirmacaoHumana, true);
});

test("sugestão de conclusão aparece depois da data final, sem concluir sozinha", () => {
  const v = viagem({ estado: "em_andamento" });
  const sugestao = sugerirEstado(v, "2026-12-28T12:00:00.000Z");
  assert.equal(sugestao?.sugestao, "concluida");
  assert.match(sugestao?.motivo ?? "", /pendências financeiras continuam abertas/i);
});

test("não há sugestão em viagem concluída, cancelada ou pendente", () => {
  for (const estado of ["concluida", "cancelada", "pendente"] as const) {
    assert.equal(sugerirEstado(viagem({ estado }), "2026-12-21T12:00:00.000Z"), null);
  }
});

test("fuso da viagem é respeitado ao decidir se a data chegou", () => {
  // 2026-12-21 01:00 UTC ainda é 2026-12-20 22:00 em São Paulo.
  assert.equal(dataNoFuso("2026-12-21T01:00:00.000Z", "America/Sao_Paulo"), "2026-12-20");
  assert.equal(dataNoFuso("2026-12-21T12:00:00.000Z", "America/Sao_Paulo"), "2026-12-21");
  assert.equal(dataNoFuso("2026-12-21T01:00:00.000Z", "Asia/Tokyo"), "2026-12-21");
  const antesDaData = viagem({ dataInicio: "2026-12-21", dataFim: "2026-12-27" });
  assert.equal(sugerirEstado(antesDaData, "2026-12-21T01:00:00.000Z")?.sugestao, undefined);
});

test("transições permitidas e papéis", () => {
  assert.deepEqual(transicoesPermitidas("planejada").sort(), [
    "cancelada",
    "em_andamento",
    "pendente",
    "rascunho",
  ].sort());
  assert.deepEqual(transicoesPermitidas("concluida"), ["pendente"]);
  assert.deepEqual(transicoesPermitidas("cancelada"), []);

  assert.throws(() => transicionar(viagem(), "cancelada", participante), /organizador/);
  assert.throws(() => transicionar(viagem(), "em_andamento", { ...organizador, estadoMembro: "convidado" }), /acesso ativo/);
});

test("Pendente exige motivo explícito e é sugerido apenas por pessoas autorizadas", () => {
  assert.throws(() => transicionar(viagem({ estado: "em_andamento" }), "pendente", participante), /obrigatório informar o motivo/);
  const pendente = transicionar(viagem({ estado: "em_andamento" }), "pendente", organizador, {
    motivo: "Voo cancelado pela companhia; aguardando remarcação.",
  });
  assert.equal(pendente.viagem.estado, "pendente");
  assert.match(pendente.evento.motivo ?? "", /Voo cancelado/);
});

test("viagem concluída não reabre automaticamente e cancelada não muda de estado", () => {
  assert.throws(() => transicionar(viagem({ estado: "concluida" }), "em_andamento", organizador), /não reabre/);
  assert.throws(() => transicionar(viagem({ estado: "cancelada" }), "planejada", organizador), /cancelada não muda de estado/);
});

test("cancelamento é assistido e lista impactos conhecidos", () => {
  const confirmado = transicionar(viagem({ estado: "em_andamento" }), "cancelada", organizador, {
    motivo: "Enchente na região.",
  });
  assert.equal(confirmado.viagem.estado, "cancelada");
  assert.equal(confirmado.evento.acao, "viagem:cancelar");

  const impactos = impactosDeCancelamento({ despesasPendentes: 3, reservasRegistradas: 2 });
  assert.ok(impactos.some((texto) => /3 despesa/.test(texto)));
  assert.ok(impactos.some((texto) => /não cancela reservas externas/i.test(texto)));
  assert.ok(impactos.some((texto) => /nada é apagado/i.test(texto)));
});
