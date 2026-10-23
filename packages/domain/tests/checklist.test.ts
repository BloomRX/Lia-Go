/**
 * Checklist: o prazo marca "atrasado" e **nada mais** — quem conclui é uma pessoa.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  concluirItem,
  criarItemChecklist,
  itemAtrasado,
  itemParaHoje,
  ordenarChecklist,
  reabrirItem,
  resumirChecklist,
  type ItemChecklist,
} from "../src/checklist.ts";

function item(parcial: Partial<ItemChecklist> = {}): ItemChecklist {
  return {
    id: parcial.id ?? "i1",
    viagemId: "v1",
    autorId: "u1",
    titulo: parcial.titulo ?? "Levar passaporte",
    categoria: parcial.categoria ?? "documento",
    responsavelId: parcial.responsavelId === undefined ? "u1" : parcial.responsavelId,
    prazo: parcial.prazo === undefined ? "2026-11-18" : parcial.prazo,
    estado: parcial.estado ?? "aberto",
    feitoPor: parcial.feitoPor ?? null,
    feitoEm: parcial.feitoEm ?? null,
    observacao: parcial.observacao ?? null,
    motivoReabertura: parcial.motivoReabertura ?? null,
    versao: parcial.versao ?? 1,
  };
}

test("item nasce aberto, sem prazo inventado e com validações de gente", () => {
  const criado = criarItemChecklist({ id: "i1", viagemId: "v1", autorId: "u1", titulo: "  Reservar o carro  " });
  assert.equal(criado.estado, "aberto");
  assert.equal(criado.titulo, "Reservar o carro");
  assert.equal(criado.prazo, null, "sem prazo é sem prazo (não é 'hoje')");
  assert.equal(criado.responsavelId, null, "sem responsável é um estado válido e visível");

  assert.throws(() => criarItemChecklist({ id: "i1", viagemId: "v1", autorId: "u1", titulo: "x" }), /pelo menos 2/i);
  assert.throws(() => criarItemChecklist({ id: "i1", viagemId: "v1", autorId: "u1", titulo: "Levar o mapa", prazo: "18/11/2026" }), /AAAA-MM-DD/i);
});

test("o prazo não conclui nada: passou da data, o item continua aberto e só fica marcado como atrasado", () => {
  const atrasado = item({ prazo: "2026-11-10" });

  assert.equal(itemAtrasado(atrasado, "2026-11-18"), true);
  assert.equal(atrasado.estado, "aberto", "o calendário não decide por ninguém");
  assert.equal(itemAtrasado(atrasado, "2026-11-10"), false, "no dia do prazo ainda não está atrasado");
  assert.equal(itemParaHoje(atrasado, "2026-11-10"), true);
  assert.equal(itemAtrasado(item({ estado: "feito", prazo: "2026-11-10" }), "2026-11-18"), false, "feito nunca aparece atrasado");
  assert.equal(itemAtrasado(item({ prazo: null }), "2026-11-18"), false);
});

test("concluir registra quem e quando; concluir de novo é recusado", () => {
  const feito = concluirItem(item(), { porId: "u2", em: "2026-11-15T10:00:00.000Z" });

  assert.equal(feito.estado, "feito");
  assert.equal(feito.feitoPor, "u2");
  assert.equal(feito.feitoEm, "2026-11-15T10:00:00.000Z");
  assert.equal(feito.versao, 2);
  assert.throws(() => concluirItem(feito, { porId: "u1" }), /já está concluído/i);
});

test("reabrir exige motivo e deixa rastro de por que voltou", () => {
  const feito = concluirItem(item(), { porId: "u2" });

  assert.throws(() => reabrirItem(feito, { porId: "u1", motivo: "ops" }), /mínimo 5/i);

  const reaberto = reabrirItem(feito, { porId: "u1", motivo: "O passaporte venceu em outubro" });
  assert.equal(reaberto.estado, "aberto");
  assert.equal(reaberto.motivoReabertura, "O passaporte venceu em outubro");
  assert.equal(reaberto.feitoPor, null, "quem concluiu sai do estado atual, mas o histórico do servidor guarda o evento");
  assert.throws(() => reabrirItem(reaberto, { porId: "u1", motivo: "de novo, com motivo" }), /já está em aberto/i);
});

test("resumo adaptativo: só fala do que existe (aberto, feito, atrasado, hoje, sem responsável)", () => {
  const itens = [
    item({ id: "i1", prazo: "2026-11-10" }), // atrasado
    item({ id: "i2", prazo: "2026-11-18" }), // para hoje
    item({ id: "i3", prazo: null, responsavelId: null }), // sem prazo e sem responsável
    item({ id: "i4", estado: "feito", feitoPor: "u1", feitoEm: "2026-11-01T10:00:00.000Z" }),
  ];

  const resumo = resumirChecklist(itens, "2026-11-18");

  assert.equal(resumo.abertos, 3);
  assert.equal(resumo.feitos, 1);
  assert.equal(resumo.atrasados, 1);
  assert.equal(resumo.paraHoje, 1);
  assert.equal(resumo.semResponsavel, 1);
  assert.equal(resumo.resumo, "3 em aberto · 1 feito · 1 atrasado · 1 para hoje · 1 sem responsável");

  const vazio = resumirChecklist([], "2026-11-18");
  assert.equal(vazio.resumo, "Nenhum item no checklist.");
  assert.equal(vazio.total, 0);
});

test("ordem de leitura: atrasado primeiro, depois prazo mais próximo, sem prazo e feitos no fim", () => {
  const ordenados = ordenarChecklist(
    [
      item({ id: "feito", estado: "feito", prazo: "2026-11-01" }),
      item({ id: "sem-prazo", prazo: null }),
      item({ id: "depois", prazo: "2026-11-25" }),
      item({ id: "atrasado", prazo: "2026-11-05" }),
      item({ id: "proximo", prazo: "2026-11-19" }),
    ],
    "2026-11-18",
  );

  assert.deepEqual(ordenados.map((item) => item.id), ["atrasado", "proximo", "depois", "sem-prazo", "feito"]);
});
