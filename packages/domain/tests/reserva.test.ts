/**
 * Reservas: as regras que impedem a tela de mentir (decisões V1 §13 e a disciplina de dinheiro
 * já usada no roteiro). Cada teste corresponde a um jeito de errar que já custaria caro numa viagem.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  cancelarReserva,
  confirmarReserva,
  criarReserva,
  naturezaDaReserva,
  ordenarReservas,
  resumirReservas,
  revisarImpactoDaReserva,
  type Reserva,
} from "../src/reserva.ts";

function reserva(parcial: Partial<Reserva> = {}): Reserva {
  return {
    id: parcial.id ?? "r1",
    viagemId: "v1",
    autorId: "u1",
    tipo: parcial.tipo ?? "hospedagem",
    titulo: parcial.titulo ?? "Pousada da Serra",
    local: parcial.local ?? null,
    inicio: parcial.inicio === undefined ? "2026-11-20T14:00:00-03:00" : parcial.inicio,
    fim: parcial.fim ?? null,
    custoCentavos: parcial.custoCentavos === undefined ? 120000n : parcial.custoCentavos,
    custoAVerificar: parcial.custoAVerificar ?? false,
    confirmacao: parcial.confirmacao ?? null,
    confirmadaPor: parcial.confirmadaPor ?? null,
    confirmadaEm: parcial.confirmadaEm ?? null,
    estado: parcial.estado ?? "prevista",
    motivoCancelamento: parcial.motivoCancelamento ?? null,
    versao: parcial.versao ?? 1,
  };
}

test("reserva nasce prevista e sem confirmação: confirmar é ato separado, com evidência", () => {
  const criada = criarReserva({ id: "r1", viagemId: "v1", autorId: "u1", tipo: "hospedagem", titulo: "  Pousada da Serra  ", custoCentavos: 120000n });

  assert.equal(criada.estado, "prevista");
  assert.equal(criada.titulo, "Pousada da Serra", "título é aparado");
  assert.equal(criada.confirmacao, null, "ninguém nasce confirmado");
  assert.equal(criada.confirmadaPor, null);
  assert.equal(criada.versao, 1);
});

test("custo desconhecido é null (nunca zero) e fica marcado para verificar", () => {
  const criada = criarReserva({ id: "r1", viagemId: "v1", autorId: "u1", tipo: "transporte", titulo: "Van do aeroporto" });

  assert.equal(criada.custoCentavos, null);
  assert.equal(criada.custoAVerificar, true, "sem valor informado não é \"de graça\"");
  assert.equal(naturezaDaReserva(criada), null, "desconhecido não tem natureza de dinheiro");
});

test("confirmar exige evidência e registra quem confirmou e quando", () => {
  const prevista = reserva();

  assert.throws(() => confirmarReserva(prevista, { porId: "u1", confirmacao: "  " }), /evidência/i);

  const confirmada = confirmarReserva(prevista, { porId: "u1", confirmacao: "Localizador ABC123", em: "2026-10-15T12:00:00.000Z" });
  assert.equal(confirmada.estado, "confirmada");
  assert.equal(confirmada.confirmacao, "Localizador ABC123");
  assert.equal(confirmada.confirmadaPor, "u1");
  assert.equal(confirmada.versao, 2);
});

test("o valor não muda ao confirmar: muda a natureza (estimativa → já combinado)", () => {
  const prevista = reserva({ custoCentavos: 120000n });
  assert.equal(naturezaDaReserva(prevista), "estimativa");

  const confirmada = confirmarReserva(prevista, { porId: "u1", confirmacao: "pago no balcão" });
  assert.equal(confirmada.custoCentavos, 120000n, "confirmar não reescreve o valor");
  assert.equal(naturezaDaReserva(confirmada), "compromisso");
});

test("reserva gratuita continua zero explícito, e não \"a verificar\"", () => {
  const gratuita = reserva({ custoCentavos: 0n });
  assert.equal(naturezaDaReserva(gratuita), "gratuito");
});

test("cancelar exige motivo, preserva a evidência e não volta atrás", () => {
  const confirmada = confirmarReserva(reserva(), { porId: "u1", confirmacao: "Localizador ABC123" });

  assert.throws(() => cancelarReserva(confirmada, { porId: "u1", motivo: "nada" }), /motivo/i);

  const cancelada = cancelarReserva(confirmada, { porId: "u1", motivo: "Pousada fechou para reforma" });
  assert.equal(cancelada.estado, "cancelada");
  assert.equal(cancelada.motivoCancelamento, "Pousada fechou para reforma");
  assert.equal(cancelada.confirmacao, "Localizador ABC123", "nada é apagado do histórico");
  assert.equal(naturezaDaReserva(cancelada), null, "cancelada sai da conta do orçamento");
  assert.throws(() => cancelarReserva(cancelada, { porId: "u1", motivo: "de novo, com motivo" }), /já está cancelada/i);
  assert.throws(() => confirmarReserva(cancelada, { porId: "u1", confirmacao: "tentando de novo" }), /cancelada não volta atrás/i);
});

test("ordem de leitura: com data primeiro, sem data depois, cancelada por último", () => {
  const ordenadas = ordenarReservas([
    reserva({ id: "r-cancelada", estado: "cancelada", inicio: "2026-11-01T10:00:00-03:00" }),
    reserva({ id: "r-sem-data", inicio: null }),
    reserva({ id: "r-depois", inicio: "2026-11-25T10:00:00-03:00" }),
    reserva({ id: "r-antes", inicio: "2026-11-10T10:00:00-03:00" }),
  ]);

  assert.deepEqual(ordenadas.map((item) => item.id), ["r-antes", "r-depois", "r-sem-data", "r-cancelada"]);
});

test("resumo separa previsto de já combinado e ignora cancelada", () => {
  const resumo = resumirReservas([
    reserva({ id: "r1", estado: "prevista", custoCentavos: 50000n }),
    reserva({ id: "r2", estado: "confirmada", custoCentavos: 120000n, confirmacao: "ABC" }),
    reserva({ id: "r3", estado: "cancelada", custoCentavos: 99900n }),
    reserva({ id: "r4", estado: "prevista", custoCentavos: null }),
  ]);

  assert.equal(resumo.previstas, 2);
  assert.equal(resumo.confirmadas, 1);
  assert.equal(resumo.canceladas, 1);
  assert.equal(resumo.estimativaCentavos, 50000n);
  assert.equal(resumo.compromissoCentavos, 120000n);
  assert.equal(resumo.previstoCentavos, 170000n);
  assert.equal(resumo.semCustoInformado, 1, "sem valor informado é contado, não somado como zero");
  assert.ok(!resumo.resumo.includes("R$ 0,00"));
  assert.equal(resumo.resumo, "1 confirmada · 2 previstas · 1 cancelada");
});

test("resumo sem reserva nenhuma diz isso em vez de mostrar números vazios", () => {
  const resumo = resumirReservas([]);
  assert.equal(resumo.resumo, "Nenhuma reserva registrada.");
  assert.equal(resumo.proxima, null);
  assert.equal(resumo.previstoCentavos, 0n);
});

test("confirmar mostra o impacto: natureza muda, saldo oficial não", () => {
  const impacto = revisarImpactoDaReserva(reserva({ custoCentavos: 120000n }), "confirmar");

  assert.equal(impacto.efeitoNoPrevistoCentavos, 0n, "confirmar não muda o total previsto, muda o que já é combinado");
  assert.ok(impacto.itens.some((item) => item.includes("R$ 1.200,00")));
  assert.ok(impacto.itens.some((item) => /saldo oficial não muda/.test(item)));
  assert.ok(impacto.itens.some((item) => /evidência/.test(item)));
});

test("cancelar avisa que não cancela no fornecedor e diz quanto sai do previsto", () => {
  const confirmada = confirmarReserva(reserva({ custoCentavos: 90000n }), { porId: "u1", confirmacao: "ABC123" });
  const impacto = revisarImpactoDaReserva(confirmada, "cancelar");

  assert.equal(impacto.efeitoNoPrevistoCentavos, -90000n);
  assert.ok(impacto.atencao.some((item) => /não cancela a reserva no fornecedor/.test(item)), "não finge que falou com o hotel");
  assert.ok(impacto.itens.some((item) => /evidência da confirmação continua/.test(item)));
});

test("custo desconhecido não vira número no impacto de nenhuma das ações", () => {
  const semValor = reserva({ custoCentavos: null, custoAVerificar: true });
  const confirmar = revisarImpactoDaReserva(semValor, "confirmar");
  const cancelar = revisarImpactoDaReserva(semValor, "cancelar");

  assert.equal(confirmar.efeitoNoPrevistoCentavos, 0n);
  assert.equal(cancelar.efeitoNoPrevistoCentavos, 0n);
  assert.ok(confirmar.atencao.some((item) => /falta verificar/.test(item)));
  assert.ok(cancelar.itens.some((item) => /Custo desconhecido/.test(item)));
  const textos = [...confirmar.itens, ...confirmar.atencao, ...cancelar.itens, ...cancelar.atencao].join(" ");
  assert.ok(!textos.includes("R$ 0,00"), "desconhecido não aparece como zero em nenhum dos dois impactos");
});

test("campos inválidos são recusados com mensagem de gente", () => {
  assert.throws(() => criarReserva({ id: "r1", viagemId: "v1", autorId: "u1", tipo: "hospedagem", titulo: "a" }), /nome à reserva/i);
  assert.throws(() => criarReserva({ id: "r1", viagemId: "v1", autorId: "u1", tipo: "hospedagem", titulo: "Pousada", custoCentavos: -1n }), /negativo/i);
  assert.throws(
    () => criarReserva({ id: "r1", viagemId: "v1", autorId: "u1", tipo: "hospedagem", titulo: "Pousada", inicio: "2026-11-20T10:00:00-03:00", fim: "2026-11-19T10:00:00-03:00" }),
    /antes do início/i,
  );
});
