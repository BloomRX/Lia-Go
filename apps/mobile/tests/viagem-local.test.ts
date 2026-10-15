import test from "node:test";
import assert from "node:assert/strict";
import { atividadeDoDominio, atividadesDoDominio, dadosDaViagemAberta, pode } from "../src/services/viagem-local.ts";
import type { EstadoSincronizacao } from "../src/offline/sincronizador.ts";

/**
 * Regra que impede a tela de mostrar dado de outra viagem (defeito relatado em 2026-10-15:
 * "criei outra viagem e ele volta para a primeira cancelada").
 */
function estadoCom(viagemId: string | null, extras: Partial<EstadoSincronizacao["carga"]> = {}): EstadoSincronizacao {
  return {
    resumo: { estado: "sincronizado", total: 0, aguardando: 0, enviando: 0, falhou: 0, conflito: 0, rotulo: "Tudo sincronizado" },
    fila: { operacoes: [] },
    carga: {
      viagens: [],
      viagem: viagemId ? { viagem: { id: viagemId, versao: 1 } } : null,
      despesas: [],
      movimentos: [],
      convites: [],
      convitesParaMim: [],
      atividades: [],
      ...extras,
    },
    viagemAtiva: viagemId,
    online: true,
    sincronizando: false,
    ultimaSincronizacao: null,
    armazenamento: "memória",
    erroUltimaPassada: null,
  };
}

test("cache da viagem antiga não aparece na viagem nova", () => {
  const estado = estadoCom("v1", {
    despesas: [{ id: "d1" }],
    movimentos: [{ id: "m1" }],
    atividades: [{ id: "a1", viagemId: "v1" }],
  });

  const daNova = dadosDaViagemAberta(estado, "v2");

  assert.equal(daNova.detalhe, null, "sem detalhe: a tela mostra que está carregando");
  assert.deepEqual(daNova.despesas, []);
  assert.deepEqual(daNova.movimentos, []);
  assert.deepEqual(daNova.atividades, []);
});

test("viagem aberta entrega o detalhe e só as atividades dela", () => {
  const estado = estadoCom("v2", {
    despesas: [{ id: "d1" }],
    atividades: [
      { id: "a1", viagemId: "v1" },
      { id: "a2", viagemId: "v2" },
      { id: "a3" },
    ],
  });

  const dados = dadosDaViagemAberta(estado, "v2");

  assert.equal(dados.detalhe?.viagem.id, "v2");
  assert.deepEqual(dados.despesas.map((item) => item.id), ["d1"]);
  assert.deepEqual(dados.atividades.map((item) => item.id), ["a2", "a3"], "atividade de outra viagem fica fora (a sem viagemId entra: cache antigo)");
});

test("permissão ausente ou incompleta nunca libera ação", () => {
  assert.equal(pode(undefined), false);
  assert.equal(pode(null), false);
  assert.equal(pode({}), false, "cache antigo sem o campo não autoriza nada");
  assert.equal(pode({ permitido: false }), false);
  assert.equal(pode({ permitido: true }), true);
});

test("atividade vinda do servidor vira a forma do domínio (dinheiro em centavos, nada de float)", () => {
  const atividade = atividadeDoDominio({
    id: "a1",
    viagemId: "v1",
    dia: "2026-11-20",
    ordem: 3,
    titulo: "Passeio",
    hora: null,
    custo: { centavos: "15000", natureza: "compromisso", aVerificar: false },
    estado: "planejada",
    version: 1,
  });

  assert.equal(atividade?.custoCentavos, 15000n);
  assert.equal(atividade?.custoNatureza, "compromisso");
  assert.equal(atividade?.hora, null, "flexível continua sem horário");
  assert.equal(atividade?.estado, "planejada");
});

test("atividade estragada no cache é ignorada, não derruba a tela", () => {
  assert.equal(atividadeDoDominio({ id: "a1" }), null, "sem dia não é atividade");
  assert.equal(atividadeDoDominio({ dia: "2026-11-20" }), null, "sem id não é atividade");
  assert.equal(atividadeDoDominio({ id: "a1", dia: "2026-11-20" })?.custoCentavos, null, "sem custo é desconhecido, nunca zero");
});

test("atividadesDoDominio pega só as atividades da viagem aberta", () => {
  const estado = estadoCom("v1", {
    atividades: [
      { id: "a1", viagemId: "v1", dia: "2026-11-20", ordem: 1, titulo: "Da viagem aberta" },
      { id: "a2", viagemId: "v2", dia: "2026-11-20", ordem: 1, titulo: "De outra viagem" },
    ],
  });

  const atividades = atividadesDoDominio(estado, "v1");

  assert.deepEqual(atividades.map((item) => item.id), ["a1"]);
});

test("reserva de outra viagem não entra na tela (e a viagem aberta entrega as reservas dela)", () => {
  const estado = estadoCom("v1", {
    reservas: [
      { id: "r1", viagemId: "v1", titulo: "Pousada daqui" },
      { id: "r2", viagemId: "v2", titulo: "Pousada de outra viagem" },
    ],
  });

  assert.deepEqual(dadosDaViagemAberta(estado, "v1").reservas.map((item) => item["id"]), ["r1"]);
});

test("cache antigo, sem a lista de reservas, continua abrindo a viagem (quem atualiza tem cache velho)", () => {
  const estado = estadoCom("v1", {});
  // Simula exatamente o cache gravado por uma versão anterior do app.
  delete (estado.carga as unknown as Record<string, unknown>)["reservas"];

  const dados = dadosDaViagemAberta(estado, "v1");

  assert.deepEqual(dados.reservas, [], "sem a lista, a tela mostra vazio — e não quebra");
});
