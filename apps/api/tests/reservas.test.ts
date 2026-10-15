/**
 * Reservas pela API: as regras que impedem a tela de mentir valem no servidor.
 * Cada teste corresponde a uma decisão confirmada (`docs/UI_V1_DECISIONS.md` §13 e a disciplina de
 * dinheiro do roteiro: desconhecido ≠ zero).
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { adicionarParticipante, comSessao, criarViagem, prepararAmbiente, registrarUsuario, temBanco, type AmbienteTeste, type UsuarioTeste } from "./helpers.ts";

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
  await ambiente.app.inject({ method: "POST", url: `/viagens/${viagemId}/transicoes`, headers: comSessao(organizadora), payload: { para: "planejada" } });
  const participante = await adicionarParticipante(ambiente.app, organizadora, viagemId);
  return { viagemId, organizadora, participante };
}

interface ReservaJson {
  id: string;
  tipo: string;
  titulo: string;
  estado: string;
  custoCentavos: string | null;
  custoAVerificar: boolean;
  confirmacao: string | null;
  confirmadaPor: string | null;
  motivoCancelamento: string | null;
  versao: number;
}

async function criar(
  c: Cenario,
  autor: UsuarioTeste,
  dados: Record<string, unknown> = {},
): Promise<{ status: number; reserva: ReservaJson }> {
  const resposta = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/reservas`,
    headers: comSessao(autor),
    payload: { tipo: "hospedagem", titulo: "Pousada da Serra", ...dados },
  });
  const corpo = resposta.json() as { reserva?: ReservaJson };
  return { status: resposta.statusCode, reserva: corpo.reserva as ReservaJson };
}

test("reserva nasce prevista, com valor tratado como estimativa e sem confirmação", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criada = await criar(c, c.organizadora, { custoCentavos: "120000", inicio: "2026-12-20T14:00:00-03:00" });

  assert.equal(criada.status, 201);
  assert.equal(criada.reserva.estado, "prevista");
  assert.equal(criada.reserva.confirmacao, null, "nada chega confirmado sozinho");
  assert.equal(criada.reserva.confirmadaPor, null);
  assert.equal(criada.reserva.custoCentavos, "120000");
  assert.equal(criada.reserva.custoAVerificar, false);

  const lista = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/reservas`, headers: comSessao(c.participante) });
  assert.equal(lista.statusCode, 200);
  const corpo = lista.json() as { reservas: ReservaJson[]; tipos: { tipo: string }[] };
  assert.equal(corpo.reservas.length, 1);
  assert.equal(corpo.tipos.length, 4, "os quatro tipos ficam disponíveis para a tela");
});

test("sem valor informado, o custo é desconhecido (null) e fica marcado para verificar", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criada = await criar(c, c.organizadora, { tipo: "transporte", titulo: "Van do aeroporto" });

  assert.equal(criada.reserva.custoCentavos, null, "desconhecido nunca vira zero");
  assert.equal(criada.reserva.custoAVerificar, true);

  const tela = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/reservas`, headers: comSessao(c.organizadora) });
  assert.ok(!JSON.stringify(tela.json()).includes('"custoCentavos":"0"'), "nenhum lugar mostra zero para valor desconhecido");
});

test("confirmar exige evidência e registra quem confirmou, com histórico", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criada = await criar(c, c.organizadora);

  const semEvidencia = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/reservas/${criada.reserva.id}/confirmar`,
    headers: comSessao(c.participante),
    payload: { confirmacao: "ab" },
  });
  assert.equal(semEvidencia.statusCode, 400, "confirmar sem evidência é recusado");

  const confirmada = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/reservas/${criada.reserva.id}/confirmar`,
    headers: comSessao(c.participante),
    payload: { confirmacao: "Localizador ABC123" },
  });
  assert.equal(confirmada.statusCode, 200);
  const reserva = (confirmada.json() as { reserva: ReservaJson }).reserva;
  assert.equal(reserva.estado, "confirmada");
  assert.equal(reserva.confirmacao, "Localizador ABC123");
  assert.equal(reserva.confirmadaPor, c.participante.id, "quem confirmou fica registrado");
  assert.equal(reserva.versao, 2);

  const detalhe = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${c.viagemId}/reservas/${criada.reserva.id}`,
    headers: comSessao(c.organizadora),
  });
  const historico = (detalhe.json() as { historico: { acao: string }[] }).historico;
  assert.deepEqual(historico.map((evento) => evento.acao), ["reserva:criar", "reserva:confirmar"]);
});

test("confirmar de novo com versão antiga é conflito, não sobrescrita silenciosa", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criada = await criar(c, c.organizadora);
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/reservas/${criada.reserva.id}/confirmar`,
    headers: comSessao(c.organizadora),
    payload: { confirmacao: "ABC123", versao: 1 },
  });

  const repetida = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/reservas/${criada.reserva.id}/confirmar`,
    headers: comSessao(c.organizadora),
    payload: { confirmacao: "OUTRO", versao: 1 },
  });
  assert.equal(repetida.statusCode, 409, "a versão antiga não passa por cima");
});

test("cancelar exige motivo, preserva a evidência e o banco recusa cancelamento sem motivo", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criada = await criar(c, c.organizadora, { custoCentavos: "90000" });
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/reservas/${criada.reserva.id}/confirmar`,
    headers: comSessao(c.organizadora),
    payload: { confirmacao: "Pago no balcão" },
  });

  const semMotivo = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/reservas/${criada.reserva.id}/cancelar`,
    headers: comSessao(c.organizadora),
    payload: { motivo: "nada" },
  });
  assert.equal(semMotivo.statusCode, 400);

  const cancelada = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/reservas/${criada.reserva.id}/cancelar`,
    headers: comSessao(c.organizadora),
    payload: { motivo: "Pousada fechou para reforma" },
  });
  assert.equal(cancelada.statusCode, 200);
  const reserva = (cancelada.json() as { reserva: ReservaJson }).reserva;
  assert.equal(reserva.estado, "cancelada");
  assert.equal(reserva.motivoCancelamento, "Pousada fechou para reforma");
  assert.equal(reserva.confirmacao, "Pago no balcão", "a evidência continua no histórico");

  // Defesa em profundidade: o banco não aceita cancelada sem motivo, mesmo por SQL direto.
  await assert.rejects(
    ambiente.pool.query("UPDATE reservas SET estado = 'cancelada', motivo_cancelamento = NULL WHERE id = $1", [criada.reserva.id]),
    /cancelamento_coerente/,
  );
});

test("viagem cancelada não recebe reserva nova, mas registrar o que houve com a existente continua valendo", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criada = await criar(c, c.organizadora);
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/transicoes`,
    headers: comSessao(c.organizadora),
    payload: { para: "cancelada", motivo: "Todos desistiram" },
  });

  const nova = await criar(c, c.organizadora, { titulo: "Reserva depois do fim" });
  assert.equal(nova.status, 403, "não se planeja reserva em viagem cancelada");

  const confirmarExistente = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/reservas/${criada.reserva.id}/confirmar`,
    headers: comSessao(c.organizadora),
    payload: { confirmacao: "Cancelada com o hotel" },
  });
  assert.equal(confirmarExistente.statusCode, 200, "registro do que aconteceu segue permitido");
});

test("a sincronização devolve reserva criada e confirmada pelo cursor", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criada = await criar(c, c.organizadora, { custoCentavos: "45000", inicio: "2026-12-21T09:00:00-03:00" });

  const primeira = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/mudancas?desde=0`, headers: comSessao(c.participante) });
  const corpoPrimeira = primeira.json() as { cursor: string; reservas: ReservaJson[] };
  assert.equal(corpoPrimeira.reservas.length, 1, "primeira sincronização traz a reserva inteira");
  assert.equal(corpoPrimeira.reservas[0]!.titulo, "Pousada da Serra");

  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/reservas/${criada.reserva.id}/confirmar`,
    headers: comSessao(c.organizadora),
    payload: { confirmacao: "Localizador ABC123" },
  });

  const segunda = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${c.viagemId}/mudancas?desde=${corpoPrimeira.cursor}`,
    headers: comSessao(c.participante),
  });
  const corpoSegunda = segunda.json() as { reservas: ReservaJson[] };
  assert.equal(corpoSegunda.reservas.length, 1, "só a reserva que mudou volta");
  assert.equal(corpoSegunda.reservas[0]!.estado, "confirmada");
  assert.equal(corpoSegunda.reservas[0]!.confirmacao, "Localizador ABC123");
});

test("quem não participa não vê reserva nenhuma", { skip: !disponivel }, async () => {
  const c = await cenario();
  await criar(c, c.organizadora);
  const { usuario: estranho } = await registrarUsuario(ambiente.app, { nome: "De fora" });

  const resposta = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/reservas`, headers: comSessao(estranho) });
  assert.equal(resposta.statusCode, 404, "sem vínculo ativo, nem revela que a viagem existe");
});
