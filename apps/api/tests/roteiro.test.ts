/**
 * Roteiro pela API: as regras confirmadas valem no servidor (não só na tela).
 * Cada teste corresponde a uma diretriz de `docs/UI_VISUAL_GUIDELINES.md` §2.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import {
  adicionarParticipante,
  comSessao,
  criarViagem,
  prepararAmbiente,
  registrarUsuario,
  temBanco,
  type AmbienteTeste,
  type UsuarioTeste,
} from "./helpers.ts";

const disponivel = temBanco();
let ambiente: AmbienteTeste;

before(async () => {
  if (disponivel) ambiente = await prepararAmbiente();
});
after(async () => {
  if (ambiente) await ambiente.encerrar();
});

interface Cenario {
  viagemId: string;
  organizadora: UsuarioTeste;
  participante: UsuarioTeste;
}

async function cenario(): Promise<Cenario> {
  const { usuario: organizadora } = await registrarUsuario(ambiente.app, { nome: "Organizadora" });
  const viagemId = await criarViagem(ambiente.app, organizadora, { dataInicio: "2026-12-20", dataFim: "2026-12-27" });
  for (const para of ["planejada", "em_andamento"]) {
    await ambiente.app.inject({
      method: "POST",
      url: `/viagens/${viagemId}/transicoes`,
      headers: comSessao(organizadora),
      payload: { para },
    });
  }
  const participante = await adicionarParticipante(ambiente.app, organizadora, viagemId);
  return { viagemId, organizadora, participante };
}

async function criarAtividade(
  c: Cenario,
  autor: UsuarioTeste,
  dados: Record<string, unknown> = {},
): Promise<{ status: number; id: string; corpo: Record<string, unknown> }> {
  const resposta = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades`,
    headers: comSessao(autor),
    payload: {
      dia: "2026-12-20",
      titulo: "Café da manhã",
      hora: "09:00",
      ...dados,
    },
  });
  const corpo = resposta.json() as { atividades?: { id: string }[] };
  return { status: resposta.statusCode, id: corpo.atividades?.[0]?.id ?? "", corpo: corpo as Record<string, unknown> };
}

/** Cria uma reserva na viagem do cenário e devolve o id (para vincular à atividade). */
async function criarReserva(c: Cenario, autor: UsuarioTeste, dados: Record<string, unknown> = {}): Promise<string> {
  const resposta = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/reservas`,
    headers: comSessao(autor),
    payload: { tipo: "hospedagem", titulo: "Pousada da serra", ...dados },
  });
  return (resposta.json() as { reserva?: { id: string } }).reserva?.id ?? "";
}

async function corrigirAtividade(
  c: Cenario,
  autor: UsuarioTeste,
  atividadeId: string,
  dados: Record<string, unknown>,
): Promise<{ status: number; mensagem: string | null }> {
  const resposta = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades/${atividadeId}/corrigir`,
    headers: comSessao(autor),
    payload: { motivo: "Ajuste combinado com o grupo", ...dados },
  });
  const corpo = resposta.json() as { mensagem?: string };
  return { status: resposta.statusCode, mensagem: corpo.mensagem ?? null };
}

test("atividade nasce planejada, flexível quando não tem horário, e o roteiro volta por dia", { skip: !disponivel }, async () => {
  const c = await cenario();
  const comHorario = await criarAtividade(c, c.organizadora, { titulo: "Museu", hora: "10:00", duracaoMinutos: 90 });
  assert.equal(comHorario.status, 201);
  const flexivel = await criarAtividade(c, c.organizadora, { titulo: "Visitar o mirante", hora: null, ordem: 2 });
  assert.equal(flexivel.status, 201);

  const roteiro = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${c.viagemId}/roteiro`,
    headers: comSessao(c.participante),
  });
  const corpo = roteiro.json() as {
    dias: { dia: string; atividades: { titulo: string; hora: string | null; estado: string }[]; resumo: { total: number; flexiveis: number } }[];
    permissoes: { criarAtividade: boolean };
  };
  assert.equal(roteiro.statusCode, 200);
  assert.equal(corpo.dias.length, 1);
  assert.deepEqual(
    corpo.dias[0]!.atividades.map((atividade) => atividade.titulo),
    ["Museu", "Visitar o mirante"],
    "a ordem é a sequência lógica definida por quem planeja",
  );
  assert.equal(corpo.dias[0]!.atividades[1]!.hora, null, "horário flexível continua sem horário");
  assert.equal(corpo.dias[0]!.atividades[0]!.estado, "planejada");
  assert.equal(corpo.dias[0]!.resumo.flexiveis, 1);
  assert.equal(corpo.permissoes.criarAtividade, true);
});

test("custo: desconhecido não vira zero, 'a verificar' é sinalizado e gratuidade é explícita", { skip: !disponivel }, async () => {
  const c = await cenario();
  await criarAtividade(c, c.organizadora, { titulo: "Passeio de barco", hora: "11:00", custoCentavos: "12000", custoNatureza: "estimativa" });
  await criarAtividade(c, c.organizadora, { titulo: "Almoço", hora: "13:00", ordem: 2, custoAVerificar: true });
  await criarAtividade(c, c.organizadora, { titulo: "Praça pública", hora: "15:00", ordem: 3, custoCentavos: "0", custoNatureza: "gratuito" });

  const roteiro = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/roteiro`, headers: comSessao(c.organizadora) });
  const dia = (roteiro.json() as { dias: { atividades: { titulo: string; custo: { centavos: string | null; natureza: string | null; aVerificar: boolean } }[]; resumo: Record<string, unknown> }[] }).dias[0]!;
  const porTitulo = new Map(dia.atividades.map((atividade) => [atividade.titulo, atividade]));
  assert.deepEqual(porTitulo.get("Almoço")!.custo, { centavos: null, natureza: null, aVerificar: true });
  assert.deepEqual(porTitulo.get("Praça pública")!.custo, { centavos: "0", natureza: "gratuito", aVerificar: false });
  assert.equal(porTitulo.get("Passeio de barco")!.custo.centavos, "12000");
  // O resumo soma só o conhecido: 120,00 + 0,00 (nunca o "a verificar" como zero escondido).
  assert.equal(dia.resumo["custoConhecidoCentavos"], "12000");
  assert.equal(dia.resumo["temCustoAVerificar"], true);
  assert.equal(dia.resumo["temGratuito"], true);

  // O banco recusa combinações mentirosas (defesa em profundidade).
  const invalida = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades`,
    headers: comSessao(c.organizadora),
    payload: { dia: "2026-12-20", titulo: "Jantar", custoCentavos: "0", custoNatureza: "estimativa" },
  });
  assert.equal(invalida.statusCode, 400);
});

test("conflito aparece no resumo do dia e nas duas atividades, e ninguém remarca sozinho", { skip: !disponivel }, async () => {
  const c = await cenario();
  const primeira = await criarAtividade(c, c.organizadora, { titulo: "Museu", hora: "10:00", duracaoMinutos: 120 });
  await criarAtividade(c, c.organizadora, { titulo: "Almoço", hora: "11:00", ordem: 2, duracaoMinutos: 60 });

  const roteiro = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/roteiro`, headers: comSessao(c.participante) });
  const dia = (roteiro.json() as { dias: { conflitos: { tipo: string; atividadeIds: string[]; explicacao: string; sugestao: string }[] }[] }).dias[0]!;
  assert.equal(dia.conflitos.length, 1);
  assert.equal(dia.conflitos[0]!.tipo, "sobreposicao");
  assert.equal(dia.conflitos[0]!.atividadeIds.length, 2);
  assert.match(dia.conflitos[0]!.explicacao, /mesmo horário/);
  // A atividade não foi movida por causa do conflito: o horário dela continua o que a pessoa definiu.
  const detalhe = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${c.viagemId}/atividades/${primeira.id}`,
    headers: comSessao(c.organizadora),
  });
  assert.equal((detalhe.json() as { atividades: { hora: string }[] }).atividades[0]!.hora, "10:00");
});

test("deslocamento que não cabe vira conflito explicado (risco de perder o compromisso)", { skip: !disponivel }, async () => {
  const c = await cenario();
  await criarAtividade(c, c.organizadora, { titulo: "Saída do hotel", hora: "09:00", duracaoMinutos: 30 });
  await criarAtividade(c, c.organizadora, {
    titulo: "Passeio de barco",
    hora: "10:00",
    ordem: 2,
    deslocamento: { minutos: 50, km: 22, custoCentavos: "8000", alerta: "Embarque não espera" },
  });
  const roteiro = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/roteiro`, headers: comSessao(c.organizadora) });
  const dia = (roteiro.json() as { dias: { conflitos: { tipo: string; explicacao: string }[] }[] }).dias[0]!;
  assert.equal(dia.conflitos[0]!.tipo, "deslocamento_insuficiente");
  assert.match(dia.conflitos[0]!.explicacao, /50 min/);
});

test("concluir é ação explícita: registra quem concluiu e quando; passar do horário não conclui", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criada = await criarAtividade(c, c.organizadora, { titulo: "Café da manhã", hora: "07:00" });

  // O horário já passou há muito tempo (dia 20/12 e a viagem é de dezembro): nada muda sozinho.
  const antes = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${c.viagemId}/atividades/${criada.id}`,
    headers: comSessao(c.organizadora),
  });
  assert.equal((antes.json() as { atividades: { estado: string }[] }).atividades[0]!.estado, "planejada");

  const concluida = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades/${criada.id}/concluir`,
    headers: comSessao(c.participante),
    payload: { observacao: "Tomamos café na padaria da esquina", versao: 1 },
  });
  assert.equal(concluida.statusCode, 200);
  const atividade = (concluida.json() as { atividades: { estado: string; concluidaPor: string; concluidaEm: string; observacao: string }[] }).atividades[0]!;
  assert.equal(atividade.estado, "concluida");
  assert.equal(atividade.concluidaPor, c.participante.id, "quem concluiu fica registrado");
  assert.ok(atividade.concluidaEm, "quando concluiu fica registrado");
  assert.match(atividade.observacao, /padaria/);

  const denovo = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades/${criada.id}/concluir`,
    headers: comSessao(c.participante),
    payload: {},
  });
  assert.equal(denovo.statusCode, 400);
  assert.match((denovo.json() as { mensagem: string }).mensagem, /já está concluída/);

  // Versão divergente é conflito, nunca sobrescrita silenciosa.
  const outro = await criarAtividade(c, c.organizadora, { titulo: "Jantar", hora: "20:00", ordem: 2 });
  const conflito = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades/${outro.id}/concluir`,
    headers: comSessao(c.organizadora),
    payload: { versao: 99 },
  });
  assert.equal(conflito.statusCode, 409);
});

test("cancelar e corrigir exigem motivo, versionam e ficam no histórico", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criada = await criarAtividade(c, c.organizadora, { titulo: "Trilha", hora: "08:00" });

  const semMotivo = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades/${criada.id}/cancelar`,
    headers: comSessao(c.organizadora),
    payload: { motivo: "abc" },
  });
  assert.equal(semMotivo.statusCode, 400, "motivo curto demais é recusado");

  const cancelada = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades/${criada.id}/cancelar`,
    headers: comSessao(c.organizadora),
    payload: { motivo: "chuva forte na região", versao: 1 },
  });
  assert.equal(cancelada.statusCode, 200);
  assert.equal((cancelada.json() as { atividades: { estado: string }[] }).atividades[0]!.estado, "cancelada");

  const outra = await criarAtividade(c, c.organizadora, { titulo: "Almoço", hora: "12:00", ordem: 2 });
  const corrigida = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades/${outra.id}/corrigir`,
    headers: comSessao(c.participante),
    payload: { motivo: "o restaurante abre 11h30", hora: "11:30", custoCentavos: "9000", custoNatureza: "estimativa" },
  });
  assert.equal(corrigida.statusCode, 200);
  const depois = (corrigida.json() as { atividades: { hora: string; versao: number; custo: { centavos: string } }[] }).atividades[0]!;
  assert.equal(depois.hora, "11:30");
  assert.equal(depois.versao, 2);
  assert.equal(depois.custo.centavos, "9000");

  const detalhe = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${c.viagemId}/atividades/${outra.id}`,
    headers: comSessao(c.organizadora),
  });
  const historico = (detalhe.json() as { historico: { acao: string; motivo: string | null }[] }).historico;
  assert.deepEqual(historico.map((evento) => evento.acao), ["atividade:criar", "atividade:corrigir"]);
  assert.match(historico[1]!.motivo ?? "", /11h30/);
});

test("quem não participa não vê nem escreve no roteiro", { skip: !disponivel }, async () => {
  const c = await cenario();
  const { usuario: estranho } = await registrarUsuario(ambiente.app, { nome: "Estranho" });
  const leitura = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/roteiro`, headers: comSessao(estranho) });
  assert.equal(leitura.statusCode, 404, "nem revela que a viagem existe");

  const escrita = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades`,
    headers: comSessao(estranho),
    payload: { dia: "2026-12-20", titulo: "Invasão", hora: null },
  });
  assert.equal(escrita.statusCode, 404);
});

test("viagem cancelada bloqueia atividade nova e libera correção do que já existe", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criada = await criarAtividade(c, c.organizadora, { titulo: "Passeio", hora: "10:00" });
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/transicoes`,
    headers: comSessao(c.organizadora),
    payload: { para: "cancelada", motivo: "imprevisto com o grupo" },
  });

  const nova = await criarAtividade(c, c.organizadora, { titulo: "Outro passeio", hora: "11:00" });
  // 403 com o motivo em português: a autorização vem do domínio (mesma tabela usada pela tela).
  assert.equal(nova.status, 403);

  const correcao = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades/${criada.id}/corrigir`,
    headers: comSessao(c.organizadora),
    payload: { motivo: "registro do que estava combinado", local: "Ponto de encontro" },
  });
  assert.equal(correcao.statusCode, 200, "correção continua permitida depois do cancelamento");
});

test("roteiro entra na sincronização incremental (funciona offline)", { skip: !disponivel }, async () => {
  const c = await cenario();
  await criarAtividade(c, c.organizadora, { titulo: "Museu", hora: "10:00" });

  const primeira = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${c.viagemId}/mudancas?desde=0`,
    headers: comSessao(c.participante),
  });
  const corpo = primeira.json() as { cursor: string; atividades: { titulo: string }[] };
  assert.equal(corpo.atividades.length, 1);
  assert.equal(corpo.atividades[0]!.titulo, "Museu");

  const semNovidade = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${c.viagemId}/mudancas?desde=${corpo.cursor}`,
    headers: comSessao(c.participante),
  });
  assert.deepEqual((semNovidade.json() as { atividades: unknown[] }).atividades, [], "sem nada novo, nada é reprocessado");

  const criadaDepois = await criarAtividade(c, c.organizadora, { titulo: "Jantar", hora: "20:00", ordem: 2 });
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades/${criadaDepois.id}/concluir`,
    headers: comSessao(c.participante),
    payload: {},
  });
  const depois = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${c.viagemId}/mudancas?desde=${corpo.cursor}`,
    headers: comSessao(c.participante),
  });
  const atividades = (depois.json() as { atividades: { titulo: string; estado: string; versao: number }[] }).atividades;
  const jantar = atividades.find((atividade) => atividade.titulo === "Jantar");
  assert.ok(jantar, "a atividade criada depois aparece no delta");
  assert.equal(jantar!.estado, "concluida", "e vem com o estado mais recente");
  assert.equal(jantar!.versao, 2);
});

test("reenvio com a mesma chave de idempotência não cria duas atividades", { skip: !disponivel }, async () => {
  const c = await cenario();
  const chave = "atividade-reenvio-1";
  const primeira = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades`,
    headers: { ...comSessao(c.organizadora), "idempotency-key": chave },
    payload: { dia: "2026-12-21", titulo: "Passeio de barco", hora: "09:00" },
  });
  const segunda = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades`,
    headers: { ...comSessao(c.organizadora), "idempotency-key": chave },
    payload: { dia: "2026-12-21", titulo: "Passeio de barco", hora: "09:00" },
  });
  assert.equal(primeira.statusCode, 201);
  const idPrimeira = (primeira.json() as { atividades: { id: string }[] }).atividades[0]!.id;
  const idSegunda = (segunda.json() as { atividades: { id: string }[] }).atividades[0]!.id;
  assert.equal(idPrimeira, idSegunda, "o reenvio devolve a mesma atividade");

  const roteiro = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/roteiro`, headers: comSessao(c.organizadora) });
  const total = (roteiro.json() as { dias: { atividades: unknown[] }[] }).dias.flatMap((dia) => dia.atividades).length;
  assert.equal(total, 1, "nada foi duplicado");
});

// ---------------------------------------------------------------------------
// Observações e reserva vinculada (tela 7: a ficha guarda o que não é horário)
// ---------------------------------------------------------------------------

test("atividade guarda observação e nasce sem reserva quando ninguém vinculou", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criada = await criarAtividade(c, c.organizadora, {
    titulo: "Trilha curta",
    observacao: "  Precisa de bota e água  ",
  });
  assert.equal(criada.status, 201);
  const atividade = (criada.corpo.atividades as { observacao: string | null; reservaId: string | null }[])[0]!;
  assert.equal(atividade.observacao, "Precisa de bota e água");
  assert.equal(atividade.reservaId, null);
});

test("vincular a atividade à reserva da viagem: o vínculo volta no roteiro, no detalhe e na sincronização", { skip: !disponivel }, async () => {
  const c = await cenario();
  const reservaId = await criarReserva(c, c.organizadora);
  assert.ok(reservaId);
  const criada = await criarAtividade(c, c.organizadora, { titulo: "Check-in na pousada", reservaId });
  assert.equal(criada.status, 201);
  assert.equal((criada.corpo.atividades as { reservaId: string | null }[])[0]!.reservaId, reservaId);

  const roteiro = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/roteiro`, headers: comSessao(c.participante) });
  const doRoteiro = (roteiro.json() as { dias: { atividades: { id: string; reservaId: string | null }[] }[] }).dias[0]!.atividades[0]!;
  assert.equal(doRoteiro.reservaId, reservaId);

  const detalhe = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${c.viagemId}/atividades/${criada.id}`,
    headers: comSessao(c.participante),
  });
  assert.equal((detalhe.json() as { atividades: { reservaId: string | null }[] }).atividades[0]!.reservaId, reservaId);

  // A sincronização é o caminho que o aparelho usa: o vínculo precisa viajar junto.
  const mudancas = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${c.viagemId}/mudancas?desde=0`,
    headers: comSessao(c.participante),
  });
  const atividades = (mudancas.json() as { atividades: { id: string; reservaId: string | null }[] }).atividades;
  assert.equal(atividades.find((atividade) => atividade.id === criada.id)?.reservaId, reservaId);
});

test("reserva de outra viagem é recusada e a atividade não é criada com vínculo cruzado", { skip: !disponivel }, async () => {
  const c = await cenario();
  // Outra viagem, do mesmo organizador, com a sua própria reserva.
  const outraViagem = await criarViagem(ambiente.app, c.organizadora, { dataInicio: "2027-01-10", dataFim: "2027-01-15" });
  const reservaDeOutra = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${outraViagem}/reservas`,
    headers: comSessao(c.organizadora),
    payload: { tipo: "transporte", titulo: "Passagem da outra viagem" },
  });
  const reservaId = (reservaDeOutra.json() as { reserva: { id: string } }).reserva.id;

  const criada = await criarAtividade(c, c.organizadora, { titulo: "Tentativa", reservaId });
  assert.equal(criada.status, 400, "vínculo com reserva de outra viagem não pode passar");
  assert.match(JSON.stringify(criada.corpo), /desta viagem/);

  const roteiro = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/roteiro`, headers: comSessao(c.organizadora) });
  assert.equal((roteiro.json() as { dias: unknown[] }).dias.length, 0, "nada foi gravado");
});

test("reserva cancelada não vira vínculo de atividade", { skip: !disponivel }, async () => {
  const c = await cenario();
  const reservaId = await criarReserva(c, c.organizadora);
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/reservas/${reservaId}/cancelar`,
    headers: comSessao(c.organizadora),
    payload: { motivo: "O hotel não tinha mais vaga" },
  });

  const criada = await criarAtividade(c, c.organizadora, { titulo: "Check-in", reservaId });
  assert.equal(criada.status, 400);
  assert.match(JSON.stringify(criada.corpo), /cancelada/);
});

test("corrigir vincula e desvincula a reserva com motivo, sem mexer na reserva em si", { skip: !disponivel }, async () => {
  const c = await cenario();
  const reservaId = await criarReserva(c, c.organizadora, { custoCentavos: "90000" });
  const criada = await criarAtividade(c, c.organizadora, { titulo: "Passeio de trem" });

  const vinculado = await corrigirAtividade(c, c.organizadora, criada.id, { reservaId });
  assert.equal(vinculado.status, 200);
  const comVinculo = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${c.viagemId}/atividades/${criada.id}`,
    headers: comSessao(c.organizadora),
  });
  assert.equal((comVinculo.json() as { atividades: { reservaId: string | null }[] }).atividades[0]!.reservaId, reservaId);

  // A reserva continua prevista: vincular não confirma, nem muda valor ou natureza do dinheiro.
  const reservas = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/reservas`, headers: comSessao(c.organizadora) });
  const reserva = (reservas.json() as { reservas: { id: string; estado: string; custoCentavos: string | null }[] }).reservas.find((item) => item.id === reservaId)!;
  assert.equal(reserva.estado, "prevista");
  assert.equal(reserva.custoCentavos, "90000");

  const desvinculado = await corrigirAtividade(c, c.organizadora, criada.id, { reservaId: null, versao: 2 });
  assert.equal(desvinculado.status, 200);
  const semVinculo = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${c.viagemId}/atividades/${criada.id}`,
    headers: comSessao(c.organizadora),
  });
  assert.equal((semVinculo.json() as { atividades: { reservaId: string | null }[] }).atividades[0]!.reservaId, null);

  // A reserva continua existindo: o vínculo era da atividade, não da reserva.
  const depois = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/reservas/${reservaId}`, headers: comSessao(c.organizadora) });
  assert.equal((depois.json() as { reserva: { id: string } }).reserva.id, reservaId);
});

test("corrigir a observação não apaga a reserva vinculada", { skip: !disponivel }, async () => {
  const c = await cenario();
  const reservaId = await criarReserva(c, c.organizadora);
  const criada = await criarAtividade(c, c.organizadora, { titulo: "Trilha", reservaId, observacao: "levar água" });

  const corrigido = await corrigirAtividade(c, c.organizadora, criada.id, { observacao: "levar água e protetor solar" });
  assert.equal(corrigido.status, 200);
  const detalhe = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${c.viagemId}/atividades/${criada.id}`,
    headers: comSessao(c.organizadora),
  });
  const atividade = (detalhe.json() as { atividades: { observacao: string | null; reservaId: string | null }[] }).atividades[0]!;
  assert.equal(atividade.observacao, "levar água e protetor solar");
  assert.equal(atividade.reservaId, reservaId, "quem mexeu na observação não pediu para desvincular");
});
