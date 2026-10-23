/**
 * Checklist pela API: o prazo não conclui, concluir registra quem e quando, reabrir exige motivo.
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
  const viagemId = await criarViagem(ambiente.app, organizadora);
  await ambiente.app.inject({ method: "POST", url: `/viagens/${viagemId}/transicoes`, headers: comSessao(organizadora), payload: { para: "planejada" } });
  const participante = await adicionarParticipante(ambiente.app, organizadora, viagemId);
  return { viagemId, organizadora, participante };
}

interface ItemJson {
  id: string;
  titulo: string;
  estado: string;
  categoria: string;
  responsavelId: string | null;
  prazo: string | null;
  feitoPor: string | null;
  feitoEm: string | null;
  motivoReabertura: string | null;
  versao: number;
}

async function criar(c: Cenario, autor: UsuarioTeste, dados: Record<string, unknown> = {}): Promise<{ status: number; item: ItemJson }> {
  const resposta = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/checklist`,
    headers: comSessao(autor),
    payload: { titulo: "Levar o passaporte", ...dados },
  });
  return { status: resposta.statusCode, item: (resposta.json() as { item: ItemJson }).item };
}

test("item nasce aberto, com responsável e prazo opcionais", { skip: !disponivel }, async () => {
  const c = await cenario();
  const comPrazo = await criar(c, c.organizadora, { prazo: "2026-12-01", categoria: "documento", responsavelId: c.participante.id });
  const semPrazo = await criar(c, c.organizadora, { titulo: "Comprar protetor solar" });

  assert.equal(comPrazo.status, 201);
  assert.equal(comPrazo.item.prazo, "2026-12-01");
  assert.equal(comPrazo.item.categoria, "documento");
  assert.equal(comPrazo.item.responsavelId, c.participante.id);
  assert.equal(comPrazo.item.estado, "aberto");
  assert.equal(semPrazo.item.prazo, null, "sem prazo é sem prazo: não inventamos data");
  assert.equal(semPrazo.item.responsavelId, null);

  const lista = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/checklist`, headers: comSessao(c.participante) });
  assert.equal((lista.json() as { itens: ItemJson[] }).itens.length, 2, "todo mundo da viagem vê o checklist");
});

test("responsável precisa participar da viagem", { skip: !disponivel }, async () => {
  const c = await cenario();
  const { usuario: estranho } = await registrarUsuario(ambiente.app, { nome: "De fora" });
  const resposta = await criar(c, c.organizadora, { responsavelId: estranho.id });
  assert.equal(resposta.status, 400);
});

test("prazo vencido continua aberto: quem conclui é uma pessoa, não o calendário", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.organizadora, { prazo: "2020-01-01" });

  const lista = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/checklist`, headers: comSessao(c.organizadora) });
  const item = (lista.json() as { itens: ItemJson[] }).itens[0]!;
  assert.equal(item.estado, "aberto", "data no passado não conclui nada");
  assert.equal(item.feitoPor, null);
  assert.equal(criado.item.id, item.id);
});

test("concluir registra quem e quando; reabrir exige motivo e fica no histórico", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.organizadora);

  const feito = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/checklist/${criado.item.id}/concluir`,
    headers: comSessao(c.participante),
    payload: {},
  });
  const itemFeito = (feito.json() as { item: ItemJson }).item;
  assert.equal(feito.statusCode, 200);
  assert.equal(itemFeito.estado, "feito");
  assert.equal(itemFeito.feitoPor, c.participante.id, "quem concluiu fica registrado");
  assert.ok(itemFeito.feitoEm, "e quando também");

  const semMotivo = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/checklist/${criado.item.id}/reabrir`,
    headers: comSessao(c.organizadora),
    payload: { motivo: "ops" },
  });
  assert.equal(semMotivo.statusCode, 400);

  const reaberto = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/checklist/${criado.item.id}/reabrir`,
    headers: comSessao(c.organizadora),
    payload: { motivo: "O passaporte venceu em outubro" },
  });
  const itemReaberto = (reaberto.json() as { item: ItemJson }).item;
  assert.equal(itemReaberto.estado, "aberto");
  assert.equal(itemReaberto.motivoReabertura, "O passaporte venceu em outubro");
  assert.equal(itemReaberto.feitoPor, null);

  const eventos = await ambiente.pool.query<{ acao: string; motivo: string | null }>(
    "SELECT acao, motivo FROM checklist_eventos WHERE item_id = $1 ORDER BY id",
    [criado.item.id],
  );
  assert.deepEqual(eventos.rows.map((linha) => linha.acao), ["checklist:criar", "checklist:concluir", "checklist:reabrir"]);
  assert.equal(eventos.rows[2]!.motivo, "O passaporte venceu em outubro", "o motivo da reabertura fica na trilha");
});

test("o banco recusa item feito sem autor e reabertura com motivo curto", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.organizadora);

  await assert.rejects(
    ambiente.pool.query("UPDATE itens_checklist SET estado = 'feito' WHERE id = $1", [criado.item.id]),
    /conclusao_coerente/,
  );
  await assert.rejects(
    ambiente.pool.query("UPDATE itens_checklist SET motivo_reabertura = 'curt' WHERE id = $1", [criado.item.id]),
    /motivo_reabertura/,
  );
});

test("conflito de versão impede conclusão em cima de mudança que a pessoa não viu", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.organizadora);
  await ambiente.app.inject({ method: "POST", url: `/viagens/${c.viagemId}/checklist/${criado.item.id}/concluir`, headers: comSessao(c.organizadora), payload: {} });

  const repetida = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/checklist/${criado.item.id}/concluir`,
    headers: comSessao(c.participante),
    payload: { versao: 1 },
  });
  assert.equal(repetida.statusCode, 409);
});

test("a sincronização devolve item criado e concluído pelo cursor", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.organizadora, { prazo: "2026-12-01" });

  const primeira = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/mudancas?desde=0`, headers: comSessao(c.participante) });
  const corpoPrimeira = primeira.json() as { cursor: string; itensChecklist: ItemJson[] };
  assert.equal(corpoPrimeira.itensChecklist.length, 1);
  assert.equal(corpoPrimeira.itensChecklist[0]!.titulo, "Levar o passaporte");

  await ambiente.app.inject({ method: "POST", url: `/viagens/${c.viagemId}/checklist/${criado.item.id}/concluir`, headers: comSessao(c.participante), payload: {} });

  const segunda = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/mudancas?desde=${corpoPrimeira.cursor}`, headers: comSessao(c.organizadora) });
  const corpoSegunda = segunda.json() as { itensChecklist: ItemJson[] };
  assert.equal(corpoSegunda.itensChecklist.length, 1, "só o item que mudou volta");
  assert.equal(corpoSegunda.itensChecklist[0]!.estado, "feito");
});

test("viagem cancelada não recebe item novo, mas fechar o que existia continua valendo", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.organizadora);
  await ambiente.app.inject({ method: "POST", url: `/viagens/${c.viagemId}/transicoes`, headers: comSessao(c.organizadora), payload: { para: "cancelada", motivo: "Todos desistiram" } });

  const novo = await criar(c, c.organizadora, { titulo: "Item depois do fim" });
  assert.equal(novo.status, 403, "não se planeja item novo em viagem cancelada");

  const concluir = await ambiente.app.inject({ method: "POST", url: `/viagens/${c.viagemId}/checklist/${criado.item.id}/concluir`, headers: comSessao(c.organizadora), payload: {} });
  assert.equal(concluir.statusCode, 200, "fechar pendência do que já existia continua valendo");
});
