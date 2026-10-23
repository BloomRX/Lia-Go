import test from "node:test";
import assert from "node:assert/strict";
import { type ContextoAutorizacao, decidirAutorizacao, pode, podeConfirmarDespesa, podeConfirmarEstadoDaViagem } from "../src/permissions.ts";

const org: ContextoAutorizacao = { papel: "organizador", estadoMembro: "ativo", estadoViagem: "planejada" };
const part: ContextoAutorizacao = { papel: "participante", estadoMembro: "ativo", estadoViagem: "planejada" };

test("participante registra despesas e propõe; administração é do organizador", () => {
  assert.equal(pode(part, "despesa:criar"), true);
  assert.equal(pode(part, "despesa:confirmar"), true);
  assert.equal(pode(part, "viagem:editar"), false);
  assert.equal(pode(part, "viagem:cancelar"), false);
  assert.equal(pode(part, "viagem:participante:remover"), false);
  assert.equal(pode(part, "viagem:convite:gerenciar"), false);
  assert.equal(pode(org, "viagem:convite:gerenciar"), true);
});

test("motivo é sempre explicado para a interface", () => {
  const decisao = decidirAutorizacao(part, "viagem:cancelar");
  assert.equal(decisao.permitido, false);
  assert.match(decisao.motivo, /Somente o organizador/);
});

test("convite pendente, quem saiu e quem foi removido não têm acesso", () => {
  for (const estadoMembro of ["convidado", "saiu", "removido"] as const) {
    const contexto: ContextoAutorizacao = { papel: "participante", estadoMembro, estadoViagem: "planejada" };
    assert.equal(pode(contexto, "despesa:criar"), false);
    assert.match(decidirAutorizacao(contexto, "despesa:criar").motivo, /não participa desta viagem/);
  }
});

test("viagem cancelada bloqueia novos compromissos e libera correções", () => {
  const cancelada: ContextoAutorizacao = { papel: "organizador", estadoMembro: "ativo", estadoViagem: "cancelada" };
  assert.equal(pode(cancelada, "despesa:criar"), false);
  assert.match(decidirAutorizacao(cancelada, "despesa:criar").motivo, /restam correções e encerramento/);
  assert.equal(pode(cancelada, "despesa:corrigir"), true);
  assert.equal(pode(cancelada, "despesa:confirmar"), true);
  assert.equal(pode(cancelada, "viagem:relatorio:ampliado"), true);
  assert.equal(pode(cancelada, "viagem:editar"), false);
});

test("viagem concluída bloqueia lançamentos novos e mantém acertos", () => {
  const concluida: ContextoAutorizacao = { papel: "participante", estadoMembro: "ativo", estadoViagem: "concluida" };
  assert.equal(pode(concluida, "despesa:criar"), false);
  assert.equal(pode(concluida, "despesa:confirmar"), true);
  assert.equal(pode(concluida, "despesa:corrigir"), true);
});

test("quem lançou não confirma o próprio lançamento", () => {
  const decisao = podeConfirmarDespesa(part, "autor-1", "autor-1");
  assert.equal(decisao.permitido, false);
  assert.match(decisao.motivo, /não pode confirmá-la/);
  assert.equal(podeConfirmarDespesa(part, "autor-1", "outra-pessoa").permitido, true);
});

test("início e conclusão podem ser confirmados por qualquer participante ativo", () => {
  assert.equal(podeConfirmarEstadoDaViagem(part).permitido, true);
  assert.equal(podeConfirmarEstadoDaViagem({ ...part, estadoMembro: "saiu" }).permitido, false);
  assert.equal(podeConfirmarEstadoDaViagem({ ...part, estadoViagem: "cancelada" }).permitido, false);
  assert.equal(podeConfirmarEstadoDaViagem({ ...part, estadoViagem: "concluida" }).permitido, false);
});
