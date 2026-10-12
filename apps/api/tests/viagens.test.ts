import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import {
  adicionarParticipante,
  comSessao,
  criarViagem,
  prepararAmbiente,
  proximoEmail,
  registrarUsuario,
  temBanco,
  type AmbienteTeste,
} from "./helpers.ts";

const disponivel = temBanco();
let ambiente: AmbienteTeste;

before(async () => {
  if (disponivel) ambiente = await prepararAmbiente();
});
after(async () => {
  if (ambiente) await ambiente.encerrar();
});

test("quem cria a viagem vira organizador e a viagem nasce como rascunho", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, usuario);
  const detalhe = await ambiente.app.inject({ method: "GET", url: `/viagens/${viagemId}`, headers: comSessao(usuario) });
  assert.equal(detalhe.statusCode, 200);
  const corpo = detalhe.json();
  assert.equal(corpo.viagem.estado, "rascunho");
  assert.equal(corpo.papel, "organizador");
  assert.equal(corpo.permissoes.cancelar.permitido, true);
  assert.equal(corpo.permissoes.editar.permitido, true);
});

test("acesso cruzado entre viagens é negado sem revelar a existência", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: dona } = await registrarUsuario(ambiente.app);
  const { usuario: estranho } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, dona);

  const leitura = await ambiente.app.inject({ method: "GET", url: `/viagens/${viagemId}`, headers: comSessao(estranho) });
  assert.equal(leitura.statusCode, 404, "sem vínculo, a viagem nem aparece");

  const transicao = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/transicoes`,
    headers: comSessao(estranho),
    payload: { para: "planejada" },
  });
  assert.equal(transicao.statusCode, 404);

  const edicao = await ambiente.app.inject({
    method: "PATCH",
    url: `/viagens/${viagemId}`,
    headers: comSessao(estranho),
    payload: { nome: "Invadida" },
  });
  assert.equal(edicao.statusCode, 404);

  const lista = await ambiente.app.inject({ method: "GET", url: "/viagens", headers: comSessao(estranho) });
  assert.equal(lista.statusCode, 200);
  assert.deepEqual(lista.json().viagens, [], "a viagem de outra pessoa não aparece na lista");
});

test("participante registra e propõe, mas não administra nem cancela", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizadora } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizadora);
  const participante = await adicionarParticipante(ambiente.app, organizadora, viagemId);

  const detalhe = await ambiente.app.inject({ method: "GET", url: `/viagens/${viagemId}`, headers: comSessao(participante) });
  const corpo = detalhe.json();
  assert.equal(corpo.papel, "participante");
  assert.equal(corpo.permissoes.editar.permitido, false);
  assert.match(corpo.permissoes.editar.motivo, /Somente o organizador/);
  assert.equal(corpo.permissoes.registrarDespesa.permitido, true);
  assert.deepEqual(corpo.permissoes.transicoesPermitidas, [], "em rascunho só o organizador age");

  const planejada = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/transicoes`,
    headers: comSessao(organizadora),
    payload: { para: "planejada" },
  });
  assert.equal(planejada.statusCode, 200);
  const depoisDePlanejar = await ambiente.app.inject({ method: "GET", url: `/viagens/${viagemId}`, headers: comSessao(participante) });
  assert.ok(
    depoisDePlanejar.json().permissoes.transicoesPermitidas.includes("em_andamento"),
    "depois de planejada, o participante pode confirmar o início",
  );

  const convidar = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/convites`,
    headers: comSessao(participante),
    payload: { email: proximoEmail("novo") },
  });
  assert.equal(convidar.statusCode, 403);

  const cancelar = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/transicoes`,
    headers: comSessao(participante),
    payload: { para: "cancelada" },
  });
  assert.equal(cancelar.statusCode, 403);
  assert.match(cancelar.json().mensagem, /organizador/i);
});

test("convite exige o e-mail convidado e libera acesso depois de aceito", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizadora } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizadora);
  const { usuario: convidada } = await registrarUsuario(ambiente.app);
  const { usuario: outra } = await registrarUsuario(ambiente.app);

  const criado = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/convites`,
    headers: comSessao(organizadora),
    payload: { email: convidada.email },
  });
  assert.equal(criado.statusCode, 201);
  const { token } = criado.json() as { token: string };
  assert.ok(token);

  const errado = await ambiente.app.inject({
    method: "POST",
    url: "/convites/aceitar",
    headers: comSessao(outra),
    payload: { token },
  });
  assert.equal(errado.statusCode, 403, "link vazado não dá acesso a outra conta");

  const aceite = await ambiente.app.inject({
    method: "POST",
    url: "/convites/aceitar",
    headers: comSessao(convidada),
    payload: { token },
  });
  assert.equal(aceite.statusCode, 200);
  assert.equal(aceite.json().estadoMembro, "ativo");

  const acesso = await ambiente.app.inject({ method: "GET", url: `/viagens/${viagemId}`, headers: comSessao(convidada) });
  assert.equal(acesso.statusCode, 200);

  const repetir = await ambiente.app.inject({
    method: "POST",
    url: "/convites/aceitar",
    headers: comSessao(convidada),
    payload: { token },
  });
  assert.equal(repetir.statusCode, 409, "convite não é aceito duas vezes");
});

test("convite pendente não dá acesso antes do aceite", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizadora } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizadora);
  const { usuario: convidada } = await registrarUsuario(ambiente.app);
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/convites`,
    headers: comSessao(organizadora),
    payload: { email: convidada.email },
  });
  const antes = await ambiente.app.inject({ method: "GET", url: `/viagens/${viagemId}`, headers: comSessao(convidada) });
  assert.equal(antes.statusCode, 404, "convite pendente ainda não é acesso");
  const lista = await ambiente.app.inject({ method: "GET", url: "/viagens", headers: comSessao(convidada) });
  assert.equal(lista.json().convitesPendentes.length, 1, "a pessoa vê o convite pendente na lista dela");
});

test("a data nunca muda o estado: só sugere, e a confirmação é registrada", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizadora } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizadora, {
    dataInicio: "2020-01-01",
    dataFim: "2035-12-31",
  });
  const detalhe = await ambiente.app.inject({ method: "GET", url: `/viagens/${viagemId}`, headers: comSessao(organizadora) });
  const sugestao = detalhe.json().sugestao;
  assert.equal(detalhe.json().viagem.estado, "rascunho", "a data sozinha não altera nada");
  assert.equal(sugestao, null, "sem 'planejada' ainda não há sugestão de início");

  const planejada = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/transicoes`,
    headers: comSessao(organizadora),
    payload: { para: "planejada" },
  });
  assert.equal(planejada.statusCode, 200);

  const depois = await ambiente.app.inject({ method: "GET", url: `/viagens/${viagemId}`, headers: comSessao(organizadora) });
  assert.equal(depois.json().sugestao.sugestao, "em_andamento");
  assert.equal(depois.json().viagem.estado, "planejada", "sugestão não aplica sozinha");

  const inicio = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/transicoes`,
    headers: comSessao(organizadora),
    payload: { para: "em_andamento" },
  });
  assert.equal(inicio.statusCode, 200);
  assert.equal(inicio.json().estado, "em_andamento");
  assert.equal(inicio.json().confirmadoPor.length > 0, true, "registra quem confirmou");

  // Cada transição confirmada fica registrada com quem confirmou e para qual estado.
  const auditoria = await ambiente.pool.query<{ ator_id: string; para: string }>(
    `SELECT ator_id, dados->>'para' AS para FROM auditoria
      WHERE viagem_id = $1 AND acao = 'viagem:transicionar' ORDER BY id`,
    [viagemId],
  );
  assert.equal(auditoria.rows.length, 2);
  assert.equal(auditoria.rows[0]?.para, "planejada");
  assert.equal(auditoria.rows[1]?.para, "em_andamento");
  assert.equal(auditoria.rows[1]?.ator_id, organizadora.id);
});

test("conflito de versão é recusado em vez de sobrescrever", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, usuario);
  const primeira = await ambiente.app.inject({
    method: "PATCH",
    url: `/viagens/${viagemId}`,
    headers: comSessao(usuario),
    payload: { nome: "Nome novo", versao: 1 },
  });
  assert.equal(primeira.statusCode, 200);
  const segunda = await ambiente.app.inject({
    method: "PATCH",
    url: `/viagens/${viagemId}`,
    headers: comSessao(usuario),
    payload: { nome: "Nome de uma sessão antiga", versao: 1 },
  });
  assert.equal(segunda.statusCode, 409);
  assert.equal(segunda.json().detalhes.versaoAtual, 2);
});

test("rascunho → pendente exige motivo e cancelamento é assistido", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizadora } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizadora);

  const semMotivo = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/transicoes`,
    headers: comSessao(organizadora),
    payload: { para: "pendente" },
  });
  assert.equal(semMotivo.statusCode, 400, "rascunho não vai para pendente sem passar por planejada");

  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/transicoes`,
    headers: comSessao(organizadora),
    payload: { para: "planejada" },
  });
  const pendente = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/transicoes`,
    headers: comSessao(organizadora),
    payload: { para: "pendente" },
  });
  assert.equal(pendente.statusCode, 400);
  assert.match(pendente.json().mensagem, /motivo/i);

  const comMotivo = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/transicoes`,
    headers: comSessao(organizadora),
    payload: { para: "pendente", motivo: "Greve no aeroporto; aguardando remarcação." },
  });
  assert.equal(comMotivo.statusCode, 200);

  const impactos = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${viagemId}/impactos-cancelamento`,
    headers: comSessao(organizadora),
  });
  assert.equal(impactos.statusCode, 200);
  assert.ok(impactos.json().impactos.some((texto: string) => /nada é apagado/i.test(texto)));

  const cancelada = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/transicoes`,
    headers: comSessao(organizadora),
    payload: { para: "cancelada" },
  });
  assert.equal(cancelada.statusCode, 200);

  const editar = await ambiente.app.inject({
    method: "PATCH",
    url: `/viagens/${viagemId}`,
    headers: comSessao(organizadora),
    payload: { nome: "Depois de cancelar" },
  });
  assert.equal(editar.statusCode, 403, "viagem cancelada bloqueia novos compromissos");
  assert.match(editar.json().mensagem, /cancelada/i);
});

test("participante sai e perde acesso, mas o histórico fica", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizadora } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizadora);
  const participante = await adicionarParticipante(ambiente.app, organizadora, viagemId);

  const sair = await ambiente.app.inject({ method: "POST", url: `/viagens/${viagemId}/sair`, headers: comSessao(participante) });
  assert.equal(sair.statusCode, 204);
  // Quem já participou recebe 403 explicativo (sabe que a viagem existe);
  // quem nunca teve vínculo recebe 404, para não revelar dados alheios.
  const depois = await ambiente.app.inject({ method: "GET", url: `/viagens/${viagemId}`, headers: comSessao(participante) });
  assert.equal(depois.statusCode, 403);
  assert.match(depois.json().mensagem, /acesso/i);

  const membro = await ambiente.pool.query<{ estado: string }>(
    "SELECT estado FROM membros_viagem WHERE viagem_id = $1 AND usuario_id = $2",
    [viagemId, participante.id],
  );
  assert.equal(membro.rows[0]?.estado, "saiu", "o vínculo é preservado como histórico");
});

test("organizador único: a viagem tem exatamente um organizador ativo", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizadora } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizadora);
  const participante = await adicionarParticipante(ambiente.app, organizadora, viagemId);
  await assert.rejects(
    () =>
      ambiente.pool.query("UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2", [
        viagemId,
        participante.id,
      ]),
    /um_organizador_ativo_por_viagem/,
    "o banco impede dois organizadores ativos",
  );
});
