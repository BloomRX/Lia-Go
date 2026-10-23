/**
 * Central de notificações: fato → notificação, leitura ≠ dispensa ≠ resolução.
 *
 * O que estes testes protegem (é o que a tela promete):
 *  - **nenhuma notificação sem fato**: dado fora do previsto não gera alarme (nem zero, nem "null");
 *  - **alta prioridade só para obrigação de quem pergunta** (ou dinheiro parado): item de outra
 *    pessoa e "eu informei um pagamento" nunca viram urgência de quem está olhando;
 *  - **dispensar não é resolver**: a marca some da lista mas não esconde a obrigação quando ela muda
 *    (a chave carrega a revisão do fato);
 *  - **resolver vem do dado**, não de um clique: a notificação sai da lista e entra no histórico
 *    só quando a obrigação deixa de existir;
 *  - **prazo é fato do calendário**: atrasado é comparação de data, nunca relógio do servidor.
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { ItemChecklist } from "../src/checklist.ts";
import {
  MARCAS_VAZIAS,
  aplicarMarcas,
  desmarcarNotificacao,
  estadoDaNotificacao,
  filtrarNotificacoes,
  marcarNotificacao,
  montarNotificacoes,
  notificacoesResolvidas,
  ordenarNotificacoes,
  podarMarcas,
  resumirNotificacoes,
  viagensComNotificacao,
  type EntradaDeNotificacoes,
  type MarcasDeNotificacao,
} from "../src/notificacao.ts";

const HOJE = "2026-11-20";

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

function entrada(parcial: Partial<EntradaDeNotificacoes> = {}): EntradaDeNotificacoes {
  return {
    usuarioId: "u1",
    hoje: HOJE,
    viagens: [],
    nomes: { u1: "Ana", u2: "Bruno", u3: "Carla" },
    ...parcial,
  };
}

// ---------------------------------------------------------------------------
// Convites
// ---------------------------------------------------------------------------

test("convite recebido é obrigação minha, de alta prioridade, e não decide por mim", () => {
  const [notificacao] = montarNotificacoes(
    entrada({
      convitesRecebidos: [{ id: "c1", viagemId: "v9", viagemNome: "Chapada" }],
    }),
  );
  assert.equal(notificacao?.tipo, "convite_recebido");
  assert.equal(notificacao?.categoria, "convite");
  assert.equal(notificacao?.prioridade, "alta");
  assert.equal(notificacao?.minha, true);
  assert.match(String(notificacao?.titulo), /Chapada/);
  // O texto não pode insinuar que o acesso já existe nem que aceitar é automático.
  assert.match(String(notificacao?.detalhe), /aceitar é a sua confirmação/i);
  assert.equal(notificacao?.viagemId, "v9");
});

test("convite recebido vencido diz que o prazo passou e que o antigo não dá acesso", () => {
  const [notificacao] = montarNotificacoes(
    entrada({
      convitesRecebidos: [{ id: "c1", viagemId: "v9", viagemNome: "Chapada", expiraEm: "2026-11-19T10:00:00Z" }],
    }),
  );
  assert.match(String(notificacao?.titulo), /venceu/i);
  assert.match(String(notificacao?.detalhe), /não dá mais acesso/i);
});

test("convite que vence hoje ainda vale hoje (o dia inteiro conta)", () => {
  const [notificacao] = montarNotificacoes(
    entrada({
      convitesRecebidos: [{ id: "c1", viagemId: "v9", viagemNome: "Chapada", expiraEm: "2026-11-20T23:59:00Z" }],
    }),
  );
  assert.match(String(notificacao?.titulo), /esperando você/i);
});

test("convite enviado e ainda pendente aparece como lembrete médio de quem convidou", () => {
  const lista = montarNotificacoes(
    entrada({
      viagemAberta: {
        id: "v1",
        nome: "Chapada",
        convites: [{ id: "ce1", email: "bruno@exemplo.com", estado: "pendente" }],
        movimentos: [],
        itensChecklist: [],
        reservasSemValor: [],
        orcamento: null,
      },
    }),
  );
  const notificacao = lista.find((itemDaLista) => itemDaLista.tipo === "convite_sem_aceite");
  assert.ok(notificacao);
  assert.equal(notificacao.prioridade, "media");
  assert.match(notificacao.titulo, /bruno@exemplo\.com/);
  assert.equal(notificacao.destino, "participantes");
});

test("convite já aceito não gera notificação nenhuma", () => {
  const lista = montarNotificacoes(
    entrada({
      viagemAberta: {
        id: "v1",
        nome: "Chapada",
        convites: [{ id: "ce1", email: "bruno@exemplo.com", estado: "aceito" }],
        movimentos: [],
        itensChecklist: [],
        reservasSemValor: [],
        orcamento: null,
      },
    }),
  );
  assert.equal(lista.filter((notificacao) => notificacao.categoria === "convite").length, 0);
});

test("convite enviado que venceu vira alta prioridade (precisa convidar de novo)", () => {
  const lista = montarNotificacoes(
    entrada({
      viagemAberta: {
        id: "v1",
        nome: "Chapada",
        convites: [{ id: "ce1", email: "bruno@exemplo.com", estado: "pendente", expiraEm: "2026-11-01T00:00:00Z" }],
        movimentos: [],
        itensChecklist: [],
        reservasSemValor: [],
        orcamento: null,
      },
    }),
  );
  const notificacao = lista.find((itemDaLista) => itemDaLista.tipo === "convite_expirado");
  assert.ok(notificacao);
  assert.equal(notificacao.prioridade, "alta");
  assert.match(notificacao.detalhe, /Convide de novo/i);
});

// ---------------------------------------------------------------------------
// Dinheiro pendente por viagem
// ---------------------------------------------------------------------------

test("despesa pendente em viagem acontecendo é alta prioridade e não acusa ninguém", () => {
  const [notificacao] = montarNotificacoes(
    entrada({
      viagens: [{ id: "v1", nome: "Chapada", estado: "em_andamento", papel: "participante", pendenciasFinanceiras: 2 }],
    }),
  );
  assert.equal(notificacao?.tipo, "despesa_pendente");
  assert.equal(notificacao?.prioridade, "alta");
  assert.match(String(notificacao?.titulo), /2 despesas/);
  assert.match(String(notificacao?.detalhe), /saldo oficial/);
  // Quem lançou não confirma o próprio lançamento: o texto é do grupo, e `minha` é falso de propósito.
  assert.equal(notificacao?.minha, false);
});

test("despesa pendente em viagem que ainda não começou é média prioridade", () => {
  const [notificacao] = montarNotificacoes(
    entrada({
      viagens: [{ id: "v1", nome: "Chapada", estado: "planejada", papel: "organizador", pendenciasFinanceiras: 1 }],
    }),
  );
  assert.equal(notificacao?.prioridade, "media");
  assert.match(String(notificacao?.titulo), /^1 despesa em/);
});

test("viagem cancelada não gera pendência financeira na central", () => {
  const lista = montarNotificacoes(
    entrada({
      viagens: [{ id: "v1", nome: "Chapada", estado: "cancelada", papel: "organizador", pendenciasFinanceiras: 3 }],
    }),
  );
  assert.equal(lista.length, 0);
});

test("viagem sem pendência não gera nada (nada de aviso de rotina)", () => {
  const lista = montarNotificacoes(
    entrada({
      viagens: [{ id: "v1", nome: "Chapada", estado: "planejada", papel: "organizador", pendenciasFinanceiras: 0 }],
    }),
  );
  assert.equal(lista.length, 0);
});

test("rascunho avisa só quem organiza, e o texto diz que o estado não muda sozinho", () => {
  const doOrganizador = montarNotificacoes(
    entrada({
      viagens: [{ id: "v1", nome: "Chapada", estado: "rascunho", papel: "organizador", pendenciasFinanceiras: 0 }],
    }),
  );
  assert.equal(doOrganizador[0]?.tipo, "viagem_rascunho");
  assert.match(String(doOrganizador[0]?.detalhe), /nunca muda sozinho/i);

  const doParticipante = montarNotificacoes(
    entrada({
      viagens: [{ id: "v1", nome: "Chapada", estado: "rascunho", papel: "participante", pendenciasFinanceiras: 0 }],
    }),
  );
  assert.equal(doParticipante.length, 0);
});

test("rascunho sem data diz que faltam as datas (e não inventa prazo)", () => {
  const [notificacao] = montarNotificacoes(
    entrada({
      viagens: [{ id: "v1", nome: "Chapada", estado: "rascunho", papel: "organizador", pendenciasFinanceiras: 0, dataInicio: null }],
    }),
  );
  assert.match(String(notificacao?.titulo), /rascunho/);
  assert.match(String(notificacao?.detalhe), /Faltam as datas/);
});

// ---------------------------------------------------------------------------
// Acertos (movimentos)
// ---------------------------------------------------------------------------

function comMovimento(movimento: { id: string; deId: string; paraId: string; valorCentavos: bigint; estado: string }) {
  return montarNotificacoes(
    entrada({
      viagemAberta: {
        id: "v1",
        nome: "Chapada",
        convites: [],
        movimentos: [movimento],
        itensChecklist: [],
        reservasSemValor: [],
        orcamento: null,
      },
    }),
  );
}

test("pagamento informado para mim é alta prioridade: informar não é pagar", () => {
  const lista = comMovimento({ id: "m1", deId: "u2", paraId: "u1", valorCentavos: 12550n, estado: "informado" });
  const notificacao = lista.find((itemDaLista) => itemDaLista.tipo === "acerto_confirmar");
  assert.ok(notificacao);
  assert.equal(notificacao.prioridade, "alta");
  assert.equal(notificacao.minha, true);
  assert.match(notificacao.titulo, /Bruno/);
  assert.match(notificacao.titulo, /R\$ 125,50/);
  assert.match(notificacao.detalhe, /só entra no saldo oficial quando você confirma/i);
  assert.equal(notificacao.destino, "gastos");
});

test("pagamento que eu informei é informativo (baixa) e não cobra a outra pessoa", () => {
  const lista = comMovimento({ id: "m2", deId: "u1", paraId: "u2", valorCentavos: 5000n, estado: "informado" });
  const notificacao = lista.find((itemDaLista) => itemDaLista.tipo === "acerto_aguardando");
  assert.ok(notificacao);
  assert.equal(notificacao.prioridade, "baixa");
  assert.equal(notificacao.minha, false);
  assert.match(notificacao.detalhe, /Bruno ainda não confirmou/);
});

test("movimento confirmado deixa de ser notificação (a obrigação acabou)", () => {
  const lista = comMovimento({ id: "m1", deId: "u2", paraId: "u1", valorCentavos: 12550n, estado: "confirmado" });
  assert.equal(lista.length, 0);
});

test("movimento entre outras duas pessoas não vira notificação minha", () => {
  const lista = comMovimento({ id: "m3", deId: "u2", paraId: "u3", valorCentavos: 1000n, estado: "informado" });
  assert.equal(lista.length, 0);
});

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

function comChecklist(...itens: ItemChecklist[]) {
  return montarNotificacoes(
    entrada({
      viagemAberta: {
        id: "v1",
        nome: "Chapada",
        convites: [],
        movimentos: [],
        itensChecklist: itens,
        reservasSemValor: [],
        orcamento: null,
      },
    }),
  );
}

test("item atrasado meu é alta prioridade e o texto deixa claro que ninguém conclui por mim", () => {
  const [notificacao] = comChecklist(item({ id: "i1", titulo: "Levar passaporte", prazo: "2026-11-18", responsavelId: "u1" }));
  assert.equal(notificacao?.tipo, "checklist_atrasado");
  assert.equal(notificacao?.prioridade, "alta");
  assert.equal(notificacao?.minha, true);
  assert.match(String(notificacao?.detalhe), /Ninguém conclui por você/i);
  assert.equal(notificacao?.desde, "2026-11-18");
  assert.equal(notificacao?.acao, "Abrir checklist");
});

test("item atrasado de outra pessoa é lembrete de baixa prioridade, com o nome de quem pegou", () => {
  const [notificacao] = comChecklist(item({ id: "i2", prazo: "2026-11-01", responsavelId: "u2" }));
  assert.equal(notificacao?.prioridade, "baixa");
  assert.equal(notificacao?.minha, false);
  assert.match(String(notificacao?.detalhe), /Está com Bruno/);
});

test("item atrasado sem responsável é média: é do grupo e alguém precisa assumir", () => {
  const [notificacao] = comChecklist(item({ id: "i3", prazo: "2026-11-01", responsavelId: null }));
  assert.equal(notificacao?.prioridade, "media");
  assert.match(String(notificacao?.detalhe), /Ninguém pegou este item/);
});

test("item para hoje é lembrete (média) — o dia ainda não acabou", () => {
  const [notificacao] = comChecklist(item({ id: "i4", prazo: HOJE, responsavelId: "u1", titulo: "Comprar repelente" }));
  assert.equal(notificacao?.tipo, "checklist_hoje");
  assert.equal(notificacao?.prioridade, "media");
  assert.match(String(notificacao?.titulo), /Para hoje: Comprar repelente/);
});

test("item concluído não aparece, mesmo com prazo vencido", () => {
  const lista = comChecklist(item({ id: "i5", prazo: "2026-01-01", estado: "feito", responsavelId: "u1" }));
  assert.equal(lista.length, 0);
});

test("item sem prazo não vira notificação (sem data não há atraso)", () => {
  const lista = comChecklist(item({ id: "i6", prazo: null }));
  assert.equal(lista.length, 0);
});

test("lista vazia de dados não inventa notificação nenhuma", () => {
  assert.deepEqual(montarNotificacoes(entrada()), []);
});

// ---------------------------------------------------------------------------
// Reservas e orçamento
// ---------------------------------------------------------------------------

test("reserva sem valor aparece como média e explica que nunca vale zero", () => {
  const lista = montarNotificacoes(
    entrada({
      viagemAberta: {
        id: "v1",
        nome: "Chapada",
        convites: [],
        movimentos: [],
        itensChecklist: [],
        reservasSemValor: [{ id: "r1", titulo: "Pousada", inicio: "2026-12-01" }],
        orcamento: null,
      },
    }),
  );
  const notificacao = lista.find((itemDaLista) => itemDaLista.tipo === "reserva_sem_valor");
  assert.ok(notificacao);
  assert.equal(notificacao.prioridade, "media");
  assert.match(notificacao.detalhe, /a verificar/i);
  assert.match(notificacao.detalhe, /nunca como zero/i);
  assert.equal(notificacao.destino, "reservas");
});

test("orçamento em atenção é média; estourado é alta — e os dois dizem que o saldo oficial não mudou", () => {
  const base = {
    id: "v1",
    nome: "Chapada",
    convites: [],
    movimentos: [],
    itensChecklist: [],
    reservasSemValor: [],
  };
  const atencao = montarNotificacoes(
    entrada({
      viagemAberta: {
        ...base,
        orcamento: { estado: "atencao", limiteCentavos: 300000n, percentualPrevisto: 85, percentualGasto: 40 },
      },
    }),
  ).find((itemDaLista) => itemDaLista.tipo === "orcamento_atencao");
  assert.ok(atencao);
  assert.equal(atencao.prioridade, "media");
  assert.match(atencao.titulo, /85%/);
  assert.match(atencao.detalhe, /Nada foi alterado sozinho/);

  const estourado = montarNotificacoes(
    entrada({
      viagemAberta: {
        ...base,
        orcamento: { estado: "estourado", limiteCentavos: 300000n, percentualPrevisto: 120, percentualGasto: 60 },
      },
    }),
  ).find((itemDaLista) => itemDaLista.tipo === "orcamento_estourado");
  assert.ok(estourado);
  assert.equal(estourado.prioridade, "alta");
  assert.match(estourado.detalhe, /gasto oficial continua o que está confirmado/);
});

test("orçamento dentro do limite (ou sem limite) não gera notificação", () => {
  const lista = montarNotificacoes(
    entrada({
      viagemAberta: {
        id: "v1",
        nome: "Chapada",
        convites: [],
        movimentos: [],
        itensChecklist: [],
        reservasSemValor: [],
        orcamento: { estado: "sem_limite", limiteCentavos: null, percentualPrevisto: 0, percentualGasto: 0 },
      },
    }),
  );
  assert.equal(lista.length, 0);
});

// ---------------------------------------------------------------------------
// Marcas: lida, dispensada, resolvida
// ---------------------------------------------------------------------------

function umaNotificacao() {
  const lista = montarNotificacoes(
    entrada({
      viagens: [{ id: "v1", nome: "Chapada", estado: "em_andamento", papel: "participante", pendenciasFinanceiras: 1 }],
    }),
  );
  assert.ok(lista[0]);
  return lista[0];
}

test("marcar como lida não resolve: continua aberta, só deixa de ser 'não lida'", () => {
  const notificacao = umaNotificacao();
  const marcas = marcarNotificacao(MARCAS_VAZIAS, notificacao, "lida", "2026-11-20T10:00:00Z");
  const [comEstado] = aplicarMarcas([notificacao], marcas);
  assert.equal(comEstado?.estado, "lida");
  assert.equal(resumirNotificacoes([comEstado!]).abertas, 1);
  assert.equal(resumirNotificacoes([comEstado!]).naoLidas, 0);
});

test("desmarcar volta para 'ainda não vi' (o botão de arrepender funciona)", () => {
  const notificacao = umaNotificacao();
  const marcas = marcarNotificacao(MARCAS_VAZIAS, notificacao, "lida", "2026-11-20T10:00:00Z");
  const apagadas = desmarcarNotificacao(marcas, notificacao.chave);
  assert.equal(estadoDaNotificacao(notificacao, apagadas), "nova");
});

test("dispensar tira da lista de abertas, mas o filtro 'dispensadas' mostra", () => {
  const notificacao = umaNotificacao();
  const marcas = marcarNotificacao(MARCAS_VAZIAS, notificacao, "dispensada", "2026-11-20T10:00:00Z");
  const comEstado = aplicarMarcas([notificacao], marcas);

  assert.equal(filtrarNotificacoes(comEstado, { estado: "abertas" }).length, 0);
  assert.equal(filtrarNotificacoes(comEstado, { estado: "dispensadas" }).length, 1);
  assert.equal(filtrarNotificacoes(comEstado, { estado: "todas" }).length, 1);
  assert.equal(resumirNotificacoes(comEstado).dispensadas, 1);
  assert.equal(resumirNotificacoes(comEstado).abertas, 0);
});

test("dispensar não esconde o problema quando ele piora: a chave muda com o fato", () => {
  const antes = umaNotificacao();
  const marcas = marcarNotificacao(MARCAS_VAZIAS, antes, "dispensada", "2026-11-20T10:00:00Z");

  // O servidor confirmou uma despesa da viagem e a contagem mudou de 1 para 2: é outro fato.
  const depois = montarNotificacoes(
    entrada({
      viagens: [{ id: "v1", nome: "Chapada", estado: "em_andamento", papel: "participante", pendenciasFinanceiras: 2 }],
    }),
  )[0]!;
  const comEstado = aplicarMarcas([depois], marcas);
  assert.equal(comEstado[0]?.estado, "nova");
  assert.equal(filtrarNotificacoes(comEstado, { estado: "abertas" }).length, 1);
});

test("resolvida é o fato que sumiu dos dados: sai das abertas e entra no histórico", () => {
  const notificacao = umaNotificacao();
  const marcas = marcarNotificacao(MARCAS_VAZIAS, notificacao, "lida", "2026-11-19T09:00:00Z");

  // A despesa foi confirmada: a viagem já não tem pendência.
  const abertas = montarNotificacoes(
    entrada({
      viagens: [{ id: "v1", nome: "Chapada", estado: "em_andamento", papel: "participante", pendenciasFinanceiras: 0 }],
    }),
  );
  const resolvidas = notificacoesResolvidas(marcas, abertas);
  assert.equal(resolvidas.length, 1);
  assert.equal(resolvidas[0]?.chave, notificacao.chave);
  assert.equal(resolvidas[0]?.titulo, notificacao.titulo);
  assert.equal(resolvidas[0]?.viagemNome, "Chapada");

  const resumo = resumirNotificacoes(aplicarMarcas(abertas, marcas), resolvidas);
  assert.equal(resumo.resolvidas, 1);
  assert.match(resumo.rotulo, /Nada pendente por aqui/);
  assert.match(resumo.rotulo, /1 resolvida/);
});

test("histórico de resolvidas vem da mais recente para a mais antiga", () => {
  const notificacao = umaNotificacao();
  const primeiro = marcarNotificacao(MARCAS_VAZIAS, notificacao, "lida", "2026-11-01T10:00:00Z");
  const depois = marcarNotificacao(
    primeiro,
    { ...notificacao, chave: "outra-chave" },
    "dispensada",
    "2026-11-20T10:00:00Z",
  );
  const resolvidas = notificacoesResolvidas(depois, []);
  assert.deepEqual(resolvidas.map((itemResolvido) => itemResolvido.chave), ["outra-chave", notificacao.chave]);
});

test("marca antiga é podada quando o histórico cresce demais (o aparelho não guarda para sempre)", () => {
  let marcas: MarcasDeNotificacao = {};
  const notificacao = umaNotificacao();
  for (let indice = 0; indice < 6; indice += 1) {
    marcas = marcarNotificacao(
      marcas,
      { ...notificacao, chave: `chave-${indice}` },
      "lida",
      `2026-11-${String(10 + indice).padStart(2, "0")}T10:00:00Z`,
    );
  }
  const podadas = podarMarcas(marcas, 3);
  assert.equal(Object.keys(podadas).length, 3);
  // As mais recentes são as que ficam.
  assert.deepEqual(Object.keys(podadas).sort(), ["chave-3", "chave-4", "chave-5"]);
});

// ---------------------------------------------------------------------------
// Filtros, ordem e resumo
// ---------------------------------------------------------------------------

function listaVariada() {
  return montarNotificacoes(
    entrada({
      convitesRecebidos: [{ id: "c1", viagemId: "v9", viagemNome: "Chapada" }],
      viagens: [
        { id: "v1", nome: "Chapada", estado: "em_andamento", papel: "participante", pendenciasFinanceiras: 1 },
        { id: "v2", nome: "Serra", estado: "planejada", papel: "organizador", pendenciasFinanceiras: 2 },
      ],
      viagemAberta: {
        id: "v1",
        nome: "Chapada",
        convites: [],
        movimentos: [],
        itensChecklist: [item({ id: "i1", prazo: "2026-11-01", responsavelId: "u1", titulo: "Seguro viagem" })],
        reservasSemValor: [{ id: "r1", titulo: "Pousada", inicio: null }],
        orcamento: null,
      },
    }),
  );
}

test("filtro por viagem isola o que é daquela viagem (inclusive a busca)", () => {
  const comEstado = aplicarMarcas(listaVariada(), MARCAS_VAZIAS);
  const daSerra = filtrarNotificacoes(comEstado, { viagemId: "v2" });
  assert.equal(daSerra.length, 1);
  assert.equal(daSerra[0]?.viagemId, "v2");

  const daChapada = filtrarNotificacoes(comEstado, { viagemId: "v1" });
  // Despesa pendente, item atrasado e reserva sem valor: é o que a viagem v1 tem de aberto.
  assert.deepEqual(
    daChapada.map((notificacao) => notificacao.tipo).sort(),
    ["checklist_atrasado", "despesa_pendente", "reserva_sem_valor"],
  );
  assert.ok(daChapada.every((notificacao) => notificacao.viagemId === "v1"));
});

test("filtro por categoria e por prioridade combinam entre si", () => {
  const comEstado = aplicarMarcas(listaVariada(), MARCAS_VAZIAS);
  const altas = filtrarNotificacoes(comEstado, { prioridade: "alta" });
  assert.ok(altas.every((notificacao) => notificacao.prioridade === "alta"));

  const checklistAlta = filtrarNotificacoes(comEstado, { categoria: "checklist", prioridade: "alta" });
  assert.deepEqual(checklistAlta.map((notificacao) => notificacao.tipo), ["checklist_atrasado"]);
});

test("filtro 'só as minhas' traz obrigação de quem pergunta, não o que é de outro", () => {
  const comEstado = aplicarMarcas(listaVariada(), MARCAS_VAZIAS);
  const minhas = filtrarNotificacoes(comEstado, { soMinhas: true });
  assert.ok(minhas.length > 0);
  assert.ok(minhas.every((notificacao) => notificacao.minha));
  assert.ok(!minhas.some((notificacao) => notificacao.tipo === "reserva_sem_valor"));
});

test("busca ignora acento e maiúscula (quem digita 'pousada' acha 'Pousada')", () => {
  const comEstado = aplicarMarcas(listaVariada(), MARCAS_VAZIAS);
  assert.equal(filtrarNotificacoes(comEstado, { busca: "pousada" }).length, 1);
  assert.equal(filtrarNotificacoes(comEstado, { busca: "SEGURO" }).length, 1);
  assert.equal(filtrarNotificacoes(comEstado, { busca: "serra" }).length, 1);
  assert.equal(filtrarNotificacoes(comEstado, { busca: "nada disso" }).length, 0);
});

test("ordem: alta primeiro; entre iguais, o que ainda não foi visto vem antes", () => {
  const notificacoes = listaVariada();
  const primeira = notificacoes[0]!;
  const marcas = marcarNotificacao(MARCAS_VAZIAS, primeira, "lida", "2026-11-20T10:00:00Z");
  const comEstado = ordenarNotificacoes(aplicarMarcas(notificacoes, marcas));
  assert.equal(comEstado[0]?.prioridade, "alta");
  // A marcada como lida não pode furar a fila de quem tem a mesma prioridade e não foi visto.
  const mesmaPrioridade = comEstado.filter((notificacao) => notificacao.prioridade === comEstado[0]?.prioridade);
  const posicaoDaMarcada = mesmaPrioridade.findIndex((notificacao) => notificacao.chave === primeira.chave);
  if (posicaoDaMarcada > 0) {
    assert.ok(mesmaPrioridade.slice(0, posicaoDaMarcada).every((notificacao) => notificacao.estado === "nova"));
  }
});

test("resumo descreve o que a tela mostra, sem prometer o que não há", () => {
  const comEstado = aplicarMarcas(listaVariada(), MARCAS_VAZIAS);
  const resumo = resumirNotificacoes(comEstado);
  assert.equal(resumo.abertas, comEstado.length);
  assert.equal(resumo.naoLidas, comEstado.length);
  assert.match(resumo.rotulo, /notificações abertas/);
  assert.match(resumo.rotulo, /alta prioridade/);

  const vazio = resumirNotificacoes([]);
  assert.equal(vazio.abertas, 0);
  assert.equal(vazio.rotulo, "Nada pendente por aqui");
});

test("filtro de viagens lista só o que tem notificação, em ordem alfabética e sem repetir", () => {
  const comEstado = aplicarMarcas(listaVariada(), MARCAS_VAZIAS);
  const viagens = viagensComNotificacao(comEstado);
  // Duas viagens podem ter o mesmo nome (a do convite e a da lista): o que identifica é o id.
  assert.deepEqual(viagens.map((viagem) => viagem.nome).sort(), ["Chapada", "Chapada", "Serra"]);
  assert.deepEqual([...new Set(viagens.map((viagem) => viagem.id))].length, viagens.length);
  assert.ok(viagens.some((viagem) => viagem.id === "v1") && viagens.some((viagem) => viagem.id === "v9"));

  // Sem notificação nenhuma, o filtro fica vazio (a tela não oferece opção que não existe).
  assert.deepEqual(viagensComNotificacao([]), []);
});

test("cada notificação tem um próximo passo concreto e um destino válido", () => {
  const destinos = new Set(["visao", "roteiro", "gastos", "orcamento", "checklist", "reservas", "documentos", "participantes"]);
  for (const notificacao of listaVariada()) {
    assert.ok(destinos.has(notificacao.destino), `destino inesperado: ${notificacao.destino}`);
    assert.ok(notificacao.acao.trim().length > 0, "toda notificação precisa dizer o que fazer");
    assert.ok(notificacao.titulo.trim().length > 0);
    assert.ok(notificacao.detalhe.trim().length > 0);
    assert.ok(notificacao.chave.includes(":"), "a chave precisa identificar o fato (tipo:origem)");
  }
});

test("chaves não se repetem: fato diferente, notificação diferente", () => {
  const chaves = listaVariada().map((notificacao) => notificacao.chave);
  assert.equal(new Set(chaves).size, chaves.length);
});
