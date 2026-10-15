/**
 * Documentos pela API (tela 16): privado por padrão, compartilhar é passo separado e revogável,
 * remover é lógico (registro e motivo continuam) e nunca vaza por lista nem por sincronização.
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

interface DocumentoJson {
  id: string;
  nome: string;
  tipo: string;
  visibilidade: string;
  compartilhadoCom: string[];
  estado: string;
  autorId: string;
  motivoRemocao: string | null;
  versao: number;
}

async function criar(c: Cenario, autor: UsuarioTeste, dados: Record<string, unknown> = {}): Promise<DocumentoJson> {
  const resposta = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos`,
    headers: comSessao(autor),
    payload: { tipo: "passagem", nome: "Voo GRU–LIS", link: "https://cia.example.com/pedido/123", ...dados },
  });
  assert.equal(resposta.statusCode, 201, resposta.body);
  return (resposta.json() as { documento: DocumentoJson }).documento;
}

async function listar(c: Cenario, quem: UsuarioTeste): Promise<DocumentoJson[]> {
  const resposta = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/documentos`, headers: comSessao(quem) });
  assert.equal(resposta.statusCode, 200);
  return (resposta.json() as { documentos: DocumentoJson[] }).documentos;
}

test("documento nasce privado: só quem criou vê, nem o organizador vê", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.participante);

  assert.equal(criado.visibilidade, "privado");
  assert.deepEqual(criado.compartilhadoCom, []);

  assert.deepEqual((await listar(c, c.participante)).map((d) => d.id), [criado.id]);
  assert.deepEqual(await listar(c, c.organizadora), [], "organizador não vê documento privado de outra pessoa");
});

test("a lista explica a privacidade com o mesmo texto da tela", { skip: !disponivel }, async () => {
  const c = await cenario();
  const resposta = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/documentos`, headers: comSessao(c.organizadora) });
  const corpo = resposta.json() as { avisoDePrivacidade: string; tipos: { tipo: string; rotulo: string }[] };

  assert.match(corpo.avisoDePrivacidade, /começa privado/);
  assert.match(corpo.avisoDePrivacidade, /o arquivo continua onde você o colocou/, "não guardamos binário: a tela precisa dizer isso");
  assert.ok(corpo.tipos.some((t) => t.tipo === "passagem"));
});

test("link precisa ser http(s); sem link o documento ainda vale", { skip: !disponivel }, async () => {
  const c = await cenario();
  const semLink = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos`,
    headers: comSessao(c.organizadora),
    payload: { tipo: "seguro", nome: "Seguro viagem" },
  });
  assert.equal(semLink.statusCode, 201);

  const javascript = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos`,
    headers: comSessao(c.organizadora),
    payload: { tipo: "seguro", nome: "Ataque", link: "javascript:alert(1)" },
  });
  assert.equal(javascript.statusCode, 400, "link que não é http(s) é recusado");
});

test("compartilhar é passo separado: com a viagem ou com pessoas, e chega na sincronização", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.participante);

  const comPessoa = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos/${criado.id}/compartilhar`,
    headers: comSessao(c.participante),
    payload: { com: [c.organizadora.id] },
  });
  const documento = (comPessoa.json() as { documento: DocumentoJson }).documento;
  assert.equal(comPessoa.statusCode, 200);
  assert.equal(documento.visibilidade, "privado", "compartilhar com pessoas não vira \"a viagem toda\": continua privado, com lista de acesso");
  assert.deepEqual(documento.compartilhadoCom, [c.organizadora.id]);
  assert.equal(documento.versao, 2);

  assert.deepEqual((await listar(c, c.organizadora)).map((d) => d.id), [criado.id], "quem recebeu passa a ver");
  const outro = await adicionarParticipante(ambiente.app, c.organizadora, c.viagemId);
  assert.deepEqual(await listar(c, outro), [], "quem não recebeu continua sem ver");

  const comViagem = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos/${criado.id}/compartilhar`,
    headers: comSessao(c.participante),
    payload: { com: "viagem" },
  });
  assert.equal((comViagem.json() as { documento: DocumentoJson }).documento.visibilidade, "viagem");
  assert.equal((await listar(c, outro)).length, 1, "compartilhado com a viagem, todo mundo com acesso vê");

  const mudancas = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/mudancas?desde=0`, headers: comSessao(outro) });
  const corpo = mudancas.json() as { documentos: DocumentoJson[] };
  assert.deepEqual(corpo.documentos.map((d) => d.id), [criado.id], "a sincronização também respeita a privacidade");
});

test("revogar acesso tira da lista de quem perdeu o acesso", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.participante);
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos/${criado.id}/compartilhar`,
    headers: comSessao(c.participante),
    payload: { com: [c.organizadora.id] },
  });
  assert.equal((await listar(c, c.organizadora)).length, 1);

  const revogado = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos/${criado.id}/revogar`,
    headers: comSessao(c.participante),
    payload: { com: [c.organizadora.id] },
  });
  const documento = (revogado.json() as { documento: DocumentoJson }).documento;
  assert.equal(revogado.statusCode, 200);
  assert.equal(documento.visibilidade, "privado");
  assert.deepEqual(await listar(c, c.organizadora), []);
  assert.equal((await listar(c, c.participante)).length, 1, "quem criou continua vendo");
});

test("quem não pode ver não age — nem o organizador em documento privado alheio", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.participante);

  const outro = await adicionarParticipante(ambiente.app, c.organizadora, c.viagemId);
  for (const acao of ["compartilhar", "revogar", "remover"]) {
    const resposta = await ambiente.app.inject({
      method: "POST",
      url: `/viagens/${c.viagemId}/documentos/${criado.id}/${acao}`,
      headers: comSessao(outro),
      payload: acao === "remover" ? { motivo: "Não é meu, não mexo" } : { com: "viagem" },
    });
    assert.equal(resposta.statusCode, 404, `sem acesso ao documento, a ação "${acao}" responde como se ele não existisse`);
  }

  const organizadora = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos/${criado.id}/compartilhar`,
    headers: comSessao(c.organizadora),
    payload: { com: "viagem" },
  });
  assert.equal(organizadora.statusCode, 404, "nem quem organiza adivinha o conteúdo do que é privado de outra pessoa");
});

test("documento compartilhado com a viagem pode ser cuidado por quem organiza", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.participante);
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos/${criado.id}/compartilhar`,
    headers: comSessao(c.participante),
    payload: { com: "viagem" },
  });

  // Agora o organizador vê o documento — e pode tirá-lo da viagem se ele não deveria estar ali.
  const revogado = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos/${criado.id}/revogar`,
    headers: comSessao(c.organizadora),
    payload: { com: "viagem" },
  });
  assert.equal(revogado.statusCode, 200, "a exceção de organizador vale para o que já estava visível na viagem");
  assert.deepEqual(await listar(c, c.organizadora), []);
  assert.equal((await listar(c, c.participante)).length, 1, "e o documento continua de quem criou");
});

test("remover exige motivo, vira remoção lógica e sai da lista de todo mundo menos do organizador", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.participante);
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos/${criado.id}/compartilhar`,
    headers: comSessao(c.participante),
    payload: { com: "viagem" },
  });

  const semMotivo = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos/${criado.id}/remover`,
    headers: comSessao(c.participante),
    payload: { motivo: "nao" },
  });
  assert.equal(semMotivo.statusCode, 400);

  const removido = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos/${criado.id}/remover`,
    headers: comSessao(c.participante),
    payload: { motivo: "Passagem cancelada e reembolsada" },
  });
  const documento = (removido.json() as { documento: DocumentoJson }).documento;
  assert.equal(removido.statusCode, 200);
  assert.equal(documento.estado, "removido");
  assert.equal(documento.motivoRemocao, "Passagem cancelada e reembolsada");
  assert.equal(documento.visibilidade, "privado");
  assert.deepEqual(documento.compartilhadoCom, []);

  assert.deepEqual(await listar(c, c.participante), [], "para quem criou, o documento sai da lista ativa");
  const doOrganizador = await listar(c, c.organizadora);
  assert.deepEqual(doOrganizador.map((d) => d.id), [criado.id], "o organizador vê o registro removido, com motivo");
  assert.equal(doOrganizador[0]!.motivoRemocao, "Passagem cancelada e recompensada".replace("recompensada", "reembolsada"));

  const eventos = await ambiente.pool.query<{ acao: string; motivo: string | null }>(
    "SELECT acao, motivo FROM documento_eventos WHERE documento_id = $1 ORDER BY id",
    [criado.id],
  );
  assert.deepEqual(eventos.rows.map((linha) => linha.acao), ["documento:criar", "documento:compartilhar", "documento:remover"]);
  assert.equal(eventos.rows[2]!.motivo, "Passagem cancelada e reembolsada");

  const linhas = await ambiente.pool.query("SELECT removido_por, removido_em FROM documentos WHERE id = $1", [criado.id]);
  assert.equal((linhas.rows[0] as { removido_por: string }).removido_por, c.participante.id, "nada é apagado em definitivo");
  assert.ok((linhas.rows[0] as { removido_em: Date }).removido_em);
});

test("impacto é mostrado antes de compartilhar ou remover", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.participante);

  const compartilhar = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/documentos/${criado.id}/impacto?acao=compartilhar`, headers: comSessao(c.participante) });
  const remover = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/documentos/${criado.id}/impacto?acao=remover`, headers: comSessao(c.participante) });

  const impactoCompartilhar = (compartilhar.json() as { impacto: { itens: string[]; atencao: string[] } }).impacto;
  const impactoRemover = (remover.json() as { impacto: { itens: string[]; atencao: string[] } }).impacto;
  assert.equal(compartilhar.statusCode, 200);
  assert.ok(impactoCompartilhar.itens.some((item) => /passam a ver este documento/.test(item)), "mostra quem passa a ver");
  assert.ok(impactoCompartilhar.itens.some((item) => /não copia o arquivo/.test(item)), "e diz que o arquivo não é copiado para cá");
  assert.ok(impactoRemover.itens.some((item) => /Nada é apagado em definitivo/.test(item)));
  assert.equal(impactoRemover.atencao.length, 0, "sem acesso compartilhado, nada extra a avisar");
});

test("conflito de versão protege quem está com a lista antiga na tela", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.participante);
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos/${criado.id}/compartilhar`,
    headers: comSessao(c.participante),
    payload: { com: "viagem" },
  });

  const desatualizado = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos/${criado.id}/revogar`,
    headers: comSessao(c.participante),
    payload: { com: "viagem", versao: 1 },
  });
  assert.equal(desatualizado.statusCode, 409);
});

test("viagem cancelada não aceita documento novo, mas remover o que existia continua valendo", { skip: !disponivel }, async () => {
  const c = await cenario();
  const criado = await criar(c, c.participante);
  await ambiente.app.inject({ method: "POST", url: `/viagens/${c.viagemId}/transicoes`, headers: comSessao(c.organizadora), payload: { para: "cancelada", motivo: "Imprevisto" } });

  const novo = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos`,
    headers: comSessao(c.participante),
    payload: { tipo: "outro", nome: "Documento depois do fim" },
  });
  assert.equal(novo.statusCode, 403);

  const remover = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos/${criado.id}/remover`,
    headers: comSessao(c.participante),
    payload: { motivo: "Viagem cancelada, sem uso" },
  });
  assert.equal(remover.statusCode, 200);
});

test("quem não participa da viagem não vê nem cria documento", { skip: !disponivel }, async () => {
  const c = await cenario();
  const { usuario: estranho } = await registrarUsuario(ambiente.app, { nome: "De fora" });

  const listar = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/documentos`, headers: comSessao(estranho) });
  const criar = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/documentos`,
    headers: comSessao(estranho),
    payload: { tipo: "outro", nome: "Intruso" },
  });
  assert.equal(listar.statusCode, 404);
  assert.equal(criar.statusCode, 404);
});
