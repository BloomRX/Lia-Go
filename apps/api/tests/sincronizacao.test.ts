import test, { after, before } from "node:test";
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
  type UsuarioTeste,
} from "./helpers.ts";
import { LIMITE_MUDANCAS } from "../src/routes/sincronizacao.ts";

const disponivel = temBanco();
let ambiente: AmbienteTeste;

before(async () => {
  if (disponivel) ambiente = await prepararAmbiente();
});

after(async () => {
  if (ambiente) await ambiente.encerrar();
});

/** Cria uma despesa como o app faz: com chave de idempotência. */
async function criarDespesa(
  app: AmbienteTeste["app"],
  usuario: UsuarioTeste,
  viagemId: string,
  descricao: string,
  valorCentavos: number,
  chave: string,
) {
  return app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/despesas`,
    headers: { ...comSessao(usuario), "idempotency-key": chave },
    payload: {
      tipo: "compartilhada",
      valorCentavos,
      data: "2027-01-11",
      descricao,
      pagadorId: usuario.id,
      participantes: [usuario.id],
    },
  });
}

test("a primeira sincronização traz tudo e devolve um cursor de sequência", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizador } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizador);

  const resposta = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${viagemId}/mudancas?desde=0`,
    headers: comSessao(organizador),
  });
  assert.equal(resposta.statusCode, 200);
  const corpo = resposta.json();
  assert.match(corpo.cursor, /^\d+$/, "o cursor é a sequência da auditoria, nunca um horário");
  assert.ok(Number(corpo.cursor) > 0);
  assert.equal(corpo.viagem.id, viagemId);
  assert.equal(corpo.viagem.rotuloEstado, "Rascunho");
  assert.equal(corpo.papel, "organizador");
  assert.ok(corpo.permissoes.editar);
  assert.equal(corpo.participantes.length, 1, "a lista de participantes vem completa");
  assert.equal(corpo.temMais, false);
});

test("sem nada novo, o app não recebe despesas para reprocessar", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizador } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizador);
  await criarDespesa(ambiente.app, organizador, viagemId, "Almoço", 8000, "sd-1");
  await criarDespesa(ambiente.app, organizador, viagemId, "Café", 1500, "sd-2");

  const primeira = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${viagemId}/mudancas?desde=0`,
    headers: comSessao(organizador),
  });
  const corpo = primeira.json();
  assert.equal(corpo.despesas.length, 2, "as duas despesas criadas aparecem uma vez");

  const segunda = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${viagemId}/mudancas?desde=${corpo.cursor}`,
    headers: comSessao(organizador),
  });
  const depois = segunda.json();
  assert.equal(depois.despesas.length, 0, "sem mudanças, nada é reenviado (economia de rede no celular)");
  assert.equal(depois.movimentos.length, 0);
  assert.equal(depois.cursor, corpo.cursor, "o cursor não anda quando não há mudanças");
  assert.equal(depois.viagem.id, viagemId, "o retrato da viagem continua vindo completo");
});

test("só o que mudou volta, e o cursor avança exatamente até a última mudança", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizador } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizador);
  await criarDespesa(ambiente.app, organizador, viagemId, "Primeira", 1000, "sd-a");

  const base = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${viagemId}/mudancas?desde=0`,
    headers: comSessao(organizador),
  });
  const cursorBase = base.json().cursor as string;

  await criarDespesa(ambiente.app, organizador, viagemId, "Segunda", 2000, "sd-b");

  const delta = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${viagemId}/mudancas?desde=${cursorBase}`,
    headers: comSessao(organizador),
  });
  const corpo = delta.json();
  assert.equal(corpo.despesas.length, 1, "só a despesa criada depois do cursor");
  assert.equal(corpo.despesas[0].descricao, "Segunda");
  assert.ok(Number(corpo.cursor) > Number(cursorBase));

  const repetida = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${viagemId}/mudancas?desde=${corpo.cursor}`,
    headers: comSessao(organizador),
  });
  assert.equal(repetida.json().despesas.length, 0, "o mesmo delta não volta duas vezes");
});

test("confirmação de outra pessoa e aceite de convite aparecem no delta", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizador } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizador);
  const participante = await adicionarParticipante(ambiente.app, organizador, viagemId);
  const criada = await criarDespesa(ambiente.app, organizador, viagemId, "Passeio", 30000, "sd-c");
  const despesaId = criada.json().id as string;

  const base = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${viagemId}/mudancas?desde=0`,
    headers: comSessao(participante),
  });
  const cursorBase = base.json().cursor as string;

  // A confirmação é feita por quem NÃO lançou a despesa (regra do domínio).
  const confirmacao = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/despesas/${despesaId}/confirmar`,
    headers: comSessao(participante),
  });
  assert.equal(confirmacao.statusCode, 200);

  const delta = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${viagemId}/mudancas?desde=${cursorBase}`,
    headers: comSessao(organizador),
  });
  const corpo = delta.json();
  assert.equal(corpo.despesas.length, 1, "a despesa confirmada volta como mudança");
  assert.equal(corpo.despesas[0].estado, "confirmada");
  assert.equal(corpo.participantes.length, 2, "os participantes vêm sempre completos, mesmo sem marca de 'membro'");
});

test("quem perdeu acesso à viagem não recebe mudanças", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizador } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizador);
  const participante = await adicionarParticipante(ambiente.app, organizador, viagemId);
  await ambiente.app.inject({ method: "POST", url: `/viagens/${viagemId}/sair`, headers: comSessao(participante) });

  const resposta = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${viagemId}/mudancas?desde=0`,
    headers: comSessao(participante),
  });
  assert.equal(resposta.statusCode, 403, "quem saiu recebe 403 explicativo");

  const { usuario: estranho } = await registrarUsuario(ambiente.app);
  const semVinculo = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${viagemId}/mudancas?desde=0`,
    headers: comSessao(estranho),
  });
  assert.equal(semVinculo.statusCode, 404, "quem nunca participou nem descobre que a viagem existe");
});

test("resposta gigante é paginada: temMais avisa o app para continuar buscando", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizador } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizador);

  // Um pouco mais que o limite de mudanças por resposta.
  const quantidade = LIMITE_MUDANCAS + 3;
  for (let i = 0; i < quantidade; i += 1) {
    const resposta = await criarDespesa(ambiente.app, organizador, viagemId, `Despesa ${i}`, 100 + i, `sd-pagina-${i}`);
    assert.equal(resposta.statusCode, 201, `despesa ${i} criada`);
  }

  let cursor = "0";
  let recebidas = 0;
  let paginas = 0;
  for (;;) {
    const resposta = await ambiente.app.inject({
      method: "GET",
      url: `/viagens/${viagemId}/mudancas?desde=${cursor}`,
      headers: comSessao(organizador),
    });
    const corpo = resposta.json();
    recebidas += corpo.despesas.length;
    cursor = corpo.cursor;
    paginas += 1;
    if (!corpo.temMais) break;
    assert.ok(paginas < 20, "a paginação precisa terminar");
  }
  assert.ok(paginas >= 2, "com mais mudanças que o limite, o servidor pagina");
  assert.ok(recebidas >= quantidade, `todas as despesas chegam (recebidas: ${recebidas})`);
});

test("cursor inválido é recusado com mensagem clara, não com erro interno", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizador } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizador);

  const resposta = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${viagemId}/mudancas?desde=ontem`,
    headers: comSessao(organizador),
  });
  assert.equal(resposta.statusCode, 400);
  assert.equal(resposta.json().erro, "entrada_invalida");
});

test("o delta devolve a despesa no mesmo formato da listagem (fonte única do dado)", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizador } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizador);
  await criarDespesa(ambiente.app, organizador, viagemId, "Jantar", 12000, "sd-formato");

  const lista = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${viagemId}/despesas`,
    headers: comSessao(organizador),
  });
  const delta = await ambiente.app.inject({
    method: "GET",
    url: `/viagens/${viagemId}/mudancas?desde=0`,
    headers: comSessao(organizador),
  });

  const daLista = lista.json().despesas[0];
  const doDelta = delta.json().despesas[0];
  assert.deepEqual(
    Object.keys(doDelta).sort(),
    Object.keys(daLista).sort(),
    "o app guarda o mesmo objeto nos dois caminhos: nada de formato divergente",
  );
  assert.deepEqual(doDelta.rateio, daLista.rateio);
  assert.equal(doDelta.valorCentavos, daLista.valorCentavos);
});

test("viagem criada por outra pessoa aparece na lista; viagem alheia não", { skip: !disponivel && "sem banco de teste" }, async () => {
  const { usuario: organizador } = await registrarUsuario(ambiente.app);
  const viagemId = await criarViagem(ambiente.app, organizador);
  const participante = await adicionarParticipante(ambiente.app, organizador, viagemId);

  const doParticipante = await ambiente.app.inject({ method: "GET", url: "/viagens", headers: comSessao(participante) });
  assert.equal(doParticipante.json().viagens.length, 1);
  assert.equal(doParticipante.json().viagens[0].id, viagemId);

  const { usuario: estranho } = await registrarUsuario(ambiente.app, { email: proximoEmail("sozinho") });
  const doEstranho = await ambiente.app.inject({ method: "GET", url: "/viagens", headers: comSessao(estranho) });
  assert.deepEqual(doEstranho.json().viagens, [], "ninguém vê viagem de outra conta");
});
