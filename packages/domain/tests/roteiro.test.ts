/**
 * Roteiro: as regras confirmadas pelo responsável em `docs/UI_VISUAL_GUIDELINES.md` §2.
 * Cada teste aqui corresponde a uma dessas regras (e a um jeito de errar que já custaria caro).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  agruparPorDia,
  cancelarAtividade,
  concluirAtividade,
  conflitosDoDia,
  corrigirAtividade,
  criarAtividade,
  custoParaMostrar,
  normalizarHora,
  ordenarAtividades,
  proximaOrdem,
  resumirDia,
  resumirOrcamentoDoRoteiro,
  revisarImpacto,
  situacaoPorHorario,
  type Atividade,
} from "../src/roteiro.ts";
import type { ContextoAutorizacao } from "../src/permissions.ts";

const CONTEXTO: ContextoAutorizacao = { papel: "participante", estadoMembro: "ativo", estadoViagem: "planejada" };

function atividade(parcial: Partial<Atividade> = {}): Atividade {
  return {
    id: parcial.id ?? "a1",
    viagemId: "v1",
    autorId: "u1",
    dia: parcial.dia ?? "2026-11-20",
    ordem: parcial.ordem ?? 1,
    titulo: parcial.titulo ?? "Café da manhã",
    hora: parcial.hora === undefined ? "09:00" : parcial.hora,
    duracaoMinutos: parcial.duracaoMinutos ?? null,
    local: parcial.local ?? null,
    custoCentavos: parcial.custoCentavos ?? null,
    custoNatureza: parcial.custoNatureza ?? null,
    custoAVerificar: parcial.custoAVerificar ?? false,
    estado: parcial.estado ?? "planejada",
    concluidaPor: parcial.concluidaPor ?? null,
    concluidaEm: parcial.concluidaEm ?? null,
    observacao: parcial.observacao ?? null,
    deslocamento: parcial.deslocamento ?? null,
    versao: parcial.versao ?? 1,
  };
}

test("o relógio nunca conclui uma atividade: só muda o que a tela mostra", () => {
  const almoco = atividade({ hora: "12:30", duracaoMinutos: 60 });
  // 15h: o horário já passou, e mesmo assim o estado continua 'planejada'.
  const depois = situacaoPorHorario(almoco, new Date("2026-11-20T15:00:00"));
  assert.equal(depois, "passou");
  assert.equal(almoco.estado, "planejada", "passar do horário não pode concluir nada");

  assert.equal(situacaoPorHorario(almoco, new Date("2026-11-20T11:00:00")), "futura");
  assert.equal(situacaoPorHorario(almoco, new Date("2026-11-20T12:45:00")), "em_curso");
  assert.equal(situacaoPorHorario(atividade({ hora: null }), new Date("2026-11-20T12:45:00")), "sem_horario");
  assert.equal(situacaoPorHorario(atividade({ estado: "concluida" }), new Date("2026-11-20T09:30:00")), "encerrada");
});

test("atividade sem horário fica na sequência lógica: nada de horário inventado", () => {
  const atividades = [
    atividade({ id: "almoço", ordem: 2, titulo: "Almoço reservado", hora: "12:30" }),
    atividade({ id: "mirante", ordem: 3, titulo: "Visitar o mirante", hora: null }),
    atividade({ id: "café", ordem: 1, titulo: "Café da manhã", hora: "09:00" }),
  ];
  assert.deepEqual(ordenarAtividades(atividades).map((item) => item.id), ["café", "almoço", "mirante"]);
  assert.equal(atividades.find((item) => item.id === "mirante")?.hora, null, "flexível continua sem horário");
  assert.equal(normalizarHora(null), null);
  assert.throws(() => normalizarHora("25:00"), /HH:MM/);
  assert.throws(() => normalizarHora("9h"), /HH:MM/);
});

test("custo desconhecido nunca vira R$ 0,00 (desconhecido, a verificar e gratuito são coisas diferentes)", () => {
  const semInformacao = custoParaMostrar(atividade({ custoCentavos: null }));
  assert.deepEqual(semInformacao, { centavos: null, rotulo: null }, "custo desconhecido não aparece e não inventa zero");

  const aVerificar = custoParaMostrar(atividade({ custoCentavos: null, custoAVerificar: true }));
  assert.equal(aVerificar.centavos, null);
  assert.equal(aVerificar.rotulo, "Custo a verificar");

  const gratuito = custoParaMostrar(atividade({ custoCentavos: 0n, custoNatureza: "gratuito" }));
  assert.equal(gratuito.centavos, 0n);
  assert.equal(gratuito.rotulo, "Sem custo");

  assert.equal(custoParaMostrar(atividade({ custoCentavos: 12_000n, custoNatureza: "estimativa" })).rotulo, "Estimativa");
  assert.equal(custoParaMostrar(atividade({ custoCentavos: 45_000n, custoNatureza: "compromisso" })).rotulo, "Compromisso");

  // As regras de consistência, no mesmo lugar em que o banco as repete.
  assert.throws(() => criarAtividade({ id: "x", viagemId: "v1", autorId: "u1", contexto: CONTEXTO, dia: "2026-11-20", ordem: 1, titulo: "Passeio", custoCentavos: 0n, custoNatureza: "estimativa" }), /Informe o valor/);
  assert.throws(() => criarAtividade({ id: "x", viagemId: "v1", autorId: "u1", contexto: CONTEXTO, dia: "2026-11-20", ordem: 1, titulo: "Passeio", custoCentavos: null, custoNatureza: "estimativa" }), /natureza de custo/);
  assert.throws(() => criarAtividade({ id: "x", viagemId: "v1", autorId: "u1", contexto: CONTEXTO, dia: "2026-11-20", ordem: 1, titulo: "Passeio", custoCentavos: 5_000n, custoNatureza: "gratuito" }), /gratuita/);
});

test("conflito de horário é explicado nos dois níveis e nunca resolvido sozinho", () => {
  const atividades = [
    atividade({ id: "museu", ordem: 1, titulo: "Museu", hora: "10:00", duracaoMinutos: 90 }),
    atividade({ id: "almoço", ordem: 2, titulo: "Almoço", hora: "11:00", duracaoMinutos: 60 }),
  ];
  const conflitos = conflitosDoDia(atividades);
  assert.equal(conflitos.length, 1);
  assert.equal(conflitos[0]!.tipo, "sobreposicao");
  assert.deepEqual(conflitos[0]!.atividadeIds, ["museu", "almoço"], "as duas atividades ficam destacadas");
  assert.match(conflitos[0]!.explicacao, /Museu.*Almoço/);
  assert.match(conflitos[0]!.sugestao, /não muda o roteiro sozinho/);
  assert.equal(resumirDia(atividades).conflitos, 1, "o resumo do dia também avisa");

  // Atividade flexível não entra em conflito de horário (ela não tem horário).
  const comFlexivel = [atividades[0]!, atividade({ id: "mirante", ordem: 2, hora: null })];
  assert.deepEqual(conflitosDoDia(comFlexivel), []);

  // Concluída e cancelada são histórico: não conflitam mais.
  assert.deepEqual(conflitosDoDia([atividades[0]!, { ...atividades[1]!, estado: "concluida" }]), []);
});

test("deslocamento que não cabe no intervalo vira conflito, e o trecho longo aparece", () => {
  const atividades = [
    atividade({ id: "hotel", ordem: 1, titulo: "Saída do hotel", hora: "09:00", duracaoMinutos: 30 }),
    atividade({
      id: "passeio",
      ordem: 2,
      titulo: "Passeio de barco",
      hora: "10:00",
      deslocamento: { minutos: 50, km: 22, custoCentavos: 8_000n, alerta: "Embarque não espera" },
    }),
  ];
  const conflitos = conflitosDoDia(atividades);
  assert.equal(conflitos.length, 1);
  assert.equal(conflitos[0]!.tipo, "deslocamento_insuficiente");
  assert.match(conflitos[0]!.explicacao, /50 min.*30 min|sobraram 30 min/);

  // Com tempo suficiente, nenhum conflito.
  const folgado = [atividades[0]!, { ...atividades[1]!, hora: "10:30" }];
  assert.deepEqual(conflitosDoDia(folgado), []);
});

test("resumo do dia soma só o custo conhecido e sinaliza o que falta verificar", () => {
  const resumo = resumirDia([
    atividade({ id: "a", custoCentavos: 10_000n, custoNatureza: "estimativa" }),
    atividade({ id: "b", hora: "14:00", custoCentavos: 25_000n, custoNatureza: "compromisso" }),
    atividade({ id: "c", hora: null, custoAVerificar: true }),
    atividade({ id: "d", hora: "18:00", estado: "concluida" }),
    atividade({ id: "e", hora: "19:00", estado: "cancelada" }),
  ]);
  assert.equal(resumo.total, 5);
  assert.equal(resumo.concluidas, 1);
  assert.equal(resumo.canceladas, 1);
  assert.equal(resumo.planejadas, 3);
  assert.equal(resumo.comHorarioDefinido, 4);
  assert.equal(resumo.flexiveis, 1);
  assert.equal(resumo.custoConhecidoCentavos, 35_000n, "a atividade 'a verificar' não entra como zero");
  assert.equal(resumo.temEstimativa, true);
  assert.equal(resumo.temCompromisso, true);
  assert.equal(resumo.temCustoAVerificar, true);
});

test("concluir é ação explícita, registrada com autor e hora", () => {
  const agora = new Date("2026-11-20T13:05:00Z");
  const concluida = concluirAtividade(atividade({ id: "passeio" }), { usuarioId: "u2", contexto: CONTEXTO, agora, observacao: "  Chegamos e o barco partiu  " });
  assert.equal(concluida.estado, "concluida");
  assert.equal(concluida.concluidaPor, "u2");
  assert.equal(concluida.concluidaEm, agora.toISOString());
  assert.equal(concluida.observacao, "Chegamos e o barco partiu", "a evidência fica registrada");
  assert.equal(concluida.versao, 2);

  assert.throws(() => concluirAtividade(concluida, { usuarioId: "u2", contexto: CONTEXTO, agora }), /já está concluída/);
  assert.throws(() => concluirAtividade(atividade({ estado: "cancelada" }), { usuarioId: "u2", contexto: CONTEXTO, agora }), /cancelada/);
});

test("cancelar e corrigir exigem motivo; quem saiu não faz nada no roteiro", () => {
  const cancelada = cancelarAtividade(atividade({ id: "a" }), { usuarioId: "u1", contexto: CONTEXTO, motivo: "choveu demais" });
  assert.equal(cancelada.estado, "cancelada");
  assert.throws(() => cancelarAtividade(atividade({ id: "a" }), { usuarioId: "u1", contexto: CONTEXTO, motivo: "  chu  " }), /mínimo 5/);
  assert.throws(() => cancelarAtividade(atividade({ id: "a", estado: "concluida" }), { usuarioId: "u1", contexto: CONTEXTO, motivo: "engano" }), /não é cancelada/);

  const corrigida = corrigirAtividade(atividade({ id: "a", hora: "09:00" }), {
    usuarioId: "u1",
    contexto: CONTEXTO,
    motivo: "o café abre às 8h",
    alteracoes: { hora: "08:00", titulo: "Café da manhã cedo" },
  });
  assert.equal(corrigida.hora, "08:00");
  assert.equal(corrigida.versao, 2, "correção gera versão nova (concorrência otimista)");
  assert.throws(() => corrigirAtividade(atividade({ id: "a" }), { usuarioId: "u1", contexto: CONTEXTO, motivo: "ajuste", alteracoes: { hora: "8h" } }), /HH:MM/);

  const semAcesso: ContextoAutorizacao = { papel: "participante", estadoMembro: "saiu", estadoViagem: "planejada" };
  assert.throws(() => criarAtividade({ id: "x", viagemId: "v1", autorId: "u1", contexto: semAcesso, dia: "2026-11-20", ordem: 1, titulo: "Passeio" }), /não participa/);
  const viagemCancelada: ContextoAutorizacao = { papel: "organizador", estadoMembro: "ativo", estadoViagem: "cancelada" };
  assert.throws(() => criarAtividade({ id: "x", viagemId: "v1", autorId: "u1", contexto: viagemCancelada, dia: "2026-11-20", ordem: 1, titulo: "Passeio" }), /cancelada/);
});

test("dias e sequência: agrupa por dia, mantém a ordem e sugere a próxima posição", () => {
  const atividades = [
    atividade({ id: "d2b", dia: "2026-11-21", ordem: 2 }),
    atividade({ id: "d1a", dia: "2026-11-20", ordem: 1 }),
    atividade({ id: "d2a", dia: "2026-11-21", ordem: 1 }),
  ];
  const dias = agruparPorDia(atividades);
  assert.deepEqual(dias.map((item) => item.dia), ["2026-11-20", "2026-11-21"]);
  assert.deepEqual(dias[1]!.atividades.map((item) => item.id), ["d2a", "d2b"]);
  assert.equal(proximaOrdem(atividades, "2026-11-20"), 2);
  assert.equal(proximaOrdem(atividades, "2026-11-22"), 1);
});

/**
 * Orçamento do roteiro: planejamento, **nunca** saldo oficial (decisões visuais V1 §7).
 * O que não pode acontecer: custo desconhecido virar zero, gratuito entrar na soma e cancelada
 * continuar contando.
 */
test("orçamento soma estimativas e compromissos, separados, e ignora cancelada", () => {
  const atividades = [
    atividade({ id: "a1", custoCentavos: 3500n, custoNatureza: "estimativa", estado: "planejada" }),
    atividade({ id: "a2", custoCentavos: 12000n, custoNatureza: "compromisso", estado: "planejada" }),
    atividade({ id: "a3", custoCentavos: 9900n, custoNatureza: "estimativa", estado: "cancelada" }),
  ];

  const orcamento = resumirOrcamentoDoRoteiro(atividades);

  assert.equal(orcamento.estimativaCentavos, 3500n);
  assert.equal(orcamento.compromissoCentavos, 12000n);
  assert.equal(orcamento.previstoCentavos, 15500n, "o previsto junta as duas naturezas, mas elas continuam separadas acima");
  assert.match(orcamento.resumo, /previsto R\$ 155,00/);
});

test("orçamento não trata desconhecido como zero nem gratuito como gasto", () => {
  const atividades = [
    atividade({ id: "a1", custoCentavos: null, custoNatureza: null, custoAVerificar: true }),
    atividade({ id: "a2", custoCentavos: null, custoNatureza: null, custoAVerificar: false }),
    atividade({ id: "a3", custoCentavos: 0n, custoNatureza: "gratuito" }),
  ];

  const orcamento = resumirOrcamentoDoRoteiro(atividades);

  assert.equal(orcamento.previstoCentavos, 0n);
  assert.equal(orcamento.aVerificar, 1, "o que precisa ser verificado é contado, não somado");
  assert.equal(orcamento.semCustoInformado, 1);
  assert.equal(orcamento.gratuitas, 1);
  assert.match(orcamento.resumo, /1 custo a verificar/);
  assert.ok(!orcamento.resumo.includes("R$ 0,00"), "desconhecido nunca aparece como zero");
});

test("roteiro sem custo nenhum diz isso em vez de mostrar zero", () => {
  const orcamento = resumirOrcamentoDoRoteiro([atividade({ custoCentavos: null, custoNatureza: null, custoAVerificar: false })]);

  assert.equal(orcamento.previstoCentavos, 0n);
  assert.match(orcamento.resumo, /Nenhum custo previsto/);
});

test("concluir mostra o impacto antes: previsto não muda e o saldo oficial não é calculado na tela", () => {
  const impacto = revisarImpacto(atividade({ id: "a1", custoCentavos: 3500n, custoNatureza: "estimativa" }), "concluir");

  assert.equal(impacto.efeitoNoPrevistoCentavos, 0n, "planejado não é gasto: concluir não mexe no previsto");
  assert.ok(impacto.itens.some((item) => /quem concluiu/.test(item)), "diz quem fica registrado");
  assert.ok(impacto.itens.some((item) => /saldo oficial/.test(item)), "deixa claro que dinheiro oficial não muda aqui");
  assert.deepEqual(impacto.atencao, []);
});

test("concluir avisa o que continua indefinido: custo a verificar e atividade sem horário", () => {
  const impacto = revisarImpacto(
    atividade({ id: "a1", hora: null, custoCentavos: null, custoNatureza: null, custoAVerificar: true }),
    "concluir",
  );

  assert.equal(impacto.atencao.length, 2);
  assert.ok(impacto.atencao.some((item) => /a verificar/.test(item)));
  assert.ok(impacto.atencao.some((item) => /Sem horário/.test(item)));
});

test("cancelar diz exatamente quanto sai do previsto e que o histórico não some", () => {
  const impacto = revisarImpacto(atividade({ id: "a1", custoCentavos: 12000n, custoNatureza: "estimativa" }), "cancelar");

  assert.equal(impacto.efeitoNoPrevistoCentavos, -12000n);
  assert.ok(impacto.itens.some((item) => item.includes("R$ 120,00")), "o valor aparece na revisão");
  assert.ok(impacto.itens.some((item) => /não pode ser apagado/.test(item)));
  assert.ok(impacto.itens.some((item) => /saldo oficial/.test(item)));
});

test("cancelar custo desconhecido não inventa número nem some com o que faltava verificar", () => {
  const desconhecido = revisarImpacto(atividade({ id: "a1", custoCentavos: null, custoNatureza: null, custoAVerificar: true }), "cancelar");
  assert.equal(desconhecido.efeitoNoPrevistoCentavos, 0n);
  assert.ok(desconhecido.itens.some((item) => /Custo desconhecido/.test(item)));
  assert.ok(desconhecido.atencao.some((item) => /a verificar/.test(item)));

  const combinado = revisarImpacto(atividade({ id: "a2", custoCentavos: 9000n, custoNatureza: "compromisso" }), "cancelar");
  assert.ok(combinado.atencao.some((item) => /compromisso assumido fora do app/.test(item)), "não finge que desfez um compromisso");
});
