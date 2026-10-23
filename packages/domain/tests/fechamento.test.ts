/**
 * Fechamento: só o confirmado é oficial, acerto é sugestão e o CSV não vira fórmula na planilha.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { montarFechamento, campoCsv } from "../src/fechamento.ts";
import { criarAtividade } from "../src/roteiro.ts";
import { criarReserva } from "../src/reserva.ts";
import type { Despesa } from "../src/expense.ts";
import type { ContextoAutorizacao } from "../src/permissions.ts";

const CONTEXTO: ContextoAutorizacao = { papel: "organizador", estadoMembro: "ativo", estadoViagem: "em_andamento" };

function despesa(parcial: Partial<Despesa> & { id: string; valorCentavos: bigint; pagadorId: string; partes: { participanteId: string; valor: bigint }[] }): Despesa {
  return {
    id: parcial.id,
    viagemId: "v1",
    autorId: parcial.pagadorId,
    pagadorId: parcial.pagadorId,
    tipo: parcial.tipo ?? "outro",
    estado: parcial.estado ?? "confirmada",
    valorCentavos: parcial.valorCentavos,
    moeda: "BRL",
    data: parcial.data ?? "2026-11-20",
    descricao: parcial.descricao ?? "Jantar",
    rateio: {
      partes: parcial.partes.map((parte) => ({ participanteId: parte.participanteId, valor: parte.valor, ajusteResto: 0 })),
      total: parcial.valorCentavos,
      explicacao: "igualitário",
      ajusteTotal: 0n,
    },
    versao: 1,
    motivoContestacao: null,
    historico: [],
  } as unknown as Despesa;
}

const PARTICIPANTES = [
  { id: "u1", nome: "Ana" },
  { id: "u2", nome: "Bruno" },
];

function entradaExtra() {
  const atividades = [
    criarAtividade({ id: "a1", viagemId: "v1", autorId: "u1", contexto: CONTEXTO, dia: "2026-11-20", ordem: 1, titulo: "Passeio", custoCentavos: 15000n, custoNatureza: "estimativa" }),
    criarAtividade({ id: "a2", viagemId: "v1", autorId: "u1", contexto: CONTEXTO, dia: "2026-11-21", ordem: 1, titulo: "Trilha", custoAVerificar: true }),
  ];
  const reservas = [
    criarReserva({ id: "r1", viagemId: "v1", autorId: "u1", tipo: "hospedagem", titulo: "Pousada", custoCentavos: 120000n }),
    criarReserva({ id: "r2", viagemId: "v1", autorId: "u1", tipo: "transporte", titulo: "Van" }),
  ];
  return { atividades, reservas };
}

test("só despesa confirmada entra no total oficial; o resto aparece separado, com aviso", () => {
  const despesas = [
    despesa({ id: "d1", valorCentavos: 10000n, pagadorId: "u1", partes: [{ participanteId: "u1", valor: 5000n }, { participanteId: "u2", valor: 5000n }] }),
    despesa({ id: "d2", valorCentavos: 6000n, pagadorId: "u2", estado: "pendente", partes: [{ participanteId: "u1", valor: 3000n }, { participanteId: "u2", valor: 3000n }] }),
  ];

  const fechamento = montarFechamento({ viagem: { id: "v1", nome: "Recife", destino: "Porto de Galinhas", moeda: "BRL", estado: "em_andamento" }, despesas, participantes: PARTICIPANTES }, "2026-11-25T12:00:00.000Z");

  assert.equal(fechamento.totalConfirmadoCentavos, 10000n);
  assert.equal(fechamento.totalAguardandoCentavos, 6000n);
  assert.equal(fechamento.despesasAbertas, 1);
  assert.ok(fechamento.alertas.some((alerta) => /R\$ 60,00 lançados que ainda não entram no total oficial/.test(alerta)));
  assert.match(fechamento.texto, /Aguardando confirmação \(fora do oficial\): R\$ 60,00/);
});

test("saldos e acertos sugeridos: quem pagou recebe, quem deve paga, e é sugestão", () => {
  const despesas = [
    despesa({ id: "d1", valorCentavos: 10000n, pagadorId: "u1", partes: [{ participanteId: "u1", valor: 5000n }, { participanteId: "u2", valor: 5000n }] }),
  ];

  const fechamento = montarFechamento({ viagem: { id: "v1", nome: "Recife", destino: null, moeda: "BRL", estado: "em_andamento" }, despesas, participantes: PARTICIPANTES });

  const ana = fechamento.saldos.find((saldo) => saldo.participanteId === "u1")!;
  assert.equal(ana.nome, "Ana");
  assert.equal(ana.saldoCentavos, 5000n, "pagou 100 e devia 50");
  assert.deepEqual(fechamento.acertosSugeridos.map((acerto) => [acerto.deNome, acerto.paraNome, acerto.valorCentavos]), [["Bruno", "Ana", 5000n]]);
  assert.match(fechamento.texto, /Acertos sugeridos \(sugestão — ninguém pagou nada até alguém registrar\)/);
});

test("o previsto (roteiro + reservas) sai do total oficial e é rotulado como planejamento", () => {
  const { atividades, reservas } = entradaExtra();

  const fechamento = montarFechamento({
    viagem: { id: "v1", nome: "Recife", destino: null, moeda: "BRL", estado: "planejada" },
    despesas: [],
    participantes: PARTICIPANTES,
    atividades,
    reservas,
  });

  assert.equal(fechamento.previstoRoteiroCentavos, 15000n, "só o custo conhecido do roteiro");
  assert.equal(fechamento.previstoReservasCentavos, 120000n, "reserva sem valor não entra");
  assert.equal(fechamento.previstoCentavos, 135000n);
  assert.equal(fechamento.totalConfirmadoCentavos, 0n, "planejamento não vira gasto");
  assert.match(fechamento.texto, /Planejamento \(não entra nas contas oficiais\)/);
});

test("limite combinado aparece no fechamento e o estouro é avisado", () => {
  const despesas = [despesa({ id: "d1", valorCentavos: 300000n, pagadorId: "u1", partes: [{ participanteId: "u1", valor: 150000n }, { participanteId: "u2", valor: 150000n }] })];

  const fechamento = montarFechamento({ viagem: { id: "v1", nome: "Recife", destino: null, moeda: "BRL", estado: "em_andamento" }, despesas, participantes: PARTICIPANTES, limiteCentavos: 250000n });

  assert.equal(fechamento.limiteCentavos, 250000n);
  assert.ok(fechamento.alertas.some((alerta) => /passou do limite combinado em R\$ 500,00/.test(alerta)));
});

test("CSV: separador de planilha pt-BR, valores com vírgula e guarda contra fórmula", () => {
  const despesas = [
    despesa({ id: "d1", descricao: "=SOMA(A1:A9)", valorCentavos: 123456n, pagadorId: "u1", data: "2026-11-20", partes: [{ participanteId: "u2", valor: 123456n }] }),
  ];

  const fechamento = montarFechamento({ viagem: { id: "v1", nome: "Recife", destino: null, moeda: "BRL", estado: "em_andamento" }, despesas, participantes: PARTICIPANTES });
  const linhas = fechamento.csv.split("\n");

  assert.match(linhas[0]!, /^"viagem";"data";"descricao"/, "cabeçalho em português, separado por ponto e vírgula");
  assert.ok(fechamento.csv.includes("'=SOMA(A1:A9)"), "campo que começa com = recebe apóstrofo: não vira fórmula");
  assert.ok(fechamento.csv.includes("1.234,56"), "valor no formato da planilha brasileira");
  assert.ok(fechamento.csv.includes('"saldo por pessoa"'));
  assert.ok(fechamento.csv.includes('"acertos sugeridos"'));
  assert.ok(fechamento.csv.includes('"Bruno";"Ana";"1.234,56"'), "o acerto sugerido vai com nome de quem paga e de quem recebe");
});

test("campoCsv: aspas, quebra de linha e perigo de fórmula", () => {
  assert.equal(campoCsv('Almoço "do grupo"'), '"Almoço ""do grupo"""');
  assert.equal(campoCsv("linha1\nlinha2"), '"linha1 linha2"', "quebra de linha não pode quebrar o CSV");
  assert.equal(campoCsv("@injetado"), '"\'@injetado"');
  assert.equal(campoCsv("+55 11 99999"), '"\'' + '+55 11 99999"');
});
