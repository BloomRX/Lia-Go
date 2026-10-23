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
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/transicoes`,
    headers: comSessao(organizadora),
    payload: { para: "planejada" },
  });
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${viagemId}/transicoes`,
    headers: comSessao(organizadora),
    payload: { para: "em_andamento" },
  });
  const participante = await adicionarParticipante(ambiente.app, organizadora, viagemId);
  return { viagemId, organizadora, participante };
}

async function criarDespesa(
  c: Cenario,
  autor: UsuarioTeste,
  dados: Record<string, unknown> = {},
): Promise<{ id: string; corpo: Record<string, unknown> }> {
  const resposta = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas`,
    headers: comSessao(autor),
    payload: {
      tipo: "compartilhada",
      valorCentavos: "10000",
      moeda: "BRL",
      data: "2026-12-21",
      descricao: "Jantar do grupo",
      pagadorId: autor.id,
      participantes: [c.organizadora.id, c.participante.id],
      ...dados,
    },
  });
  return { id: (resposta.json() as { id?: string }).id ?? "", corpo: resposta.json() as Record<string, unknown> };
}

test("despesa nasce pendente, com rateio exato e sem entrar no saldo oficial", { skip: !disponivel && "sem banco de teste" }, async () => {
  const c = await cenario();
  const resposta = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas`,
    headers: comSessao(c.organizadora),
    payload: {
      tipo: "compartilhada",
      valorCentavos: "10000",
      moeda: "BRL",
      data: "2026-12-21",
      descricao: "Hospedagem",
      pagadorId: c.organizadora.id,
      participantes: [c.organizadora.id, c.participante.id],
    },
  });
  assert.equal(resposta.statusCode, 201);
  const corpo = resposta.json();
  assert.equal(corpo.estado, "pendente");
  const partes = corpo.rateio.partes as { participanteId: string; valorCentavos: string }[];
  assert.deepEqual(partes.map((parte) => parte.valorCentavos), ["5000", "5000"]);
  assert.equal(partes.length, 2);

  const saldos = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/saldos`, headers: comSessao(c.organizadora) });
  assert.equal(saldos.json().realizado, "0", "pendente não entra no realizado");
  assert.equal(saldos.json().comprometido, "10000");
  assert.deepEqual(saldos.json().transferenciasSugeridas, []);
});

test("divisão de centavos ímpar entre 3 pessoas soma exatamente o total", { skip: !disponivel && "sem banco de teste" }, async () => {
  const c = await cenario();
  const terceira = await adicionarParticipante(ambiente.app, c.organizadora, c.viagemId);
  const resposta = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas`,
    headers: comSessao(c.organizadora),
    payload: {
      tipo: "compartilhada",
      valorCentavos: "10000",
      moeda: "BRL",
      data: "2026-12-21",
      descricao: "Almoço",
      pagadorId: c.organizadora.id,
      participantes: [c.organizadora.id, c.participante.id, terceira.id],
    },
  });
  assert.equal(resposta.statusCode, 201);
  const partes = resposta.json().rateio.partes as { valorCentavos: string; ajusteResto: number }[];
  const soma = partes.reduce((total, parte) => total + BigInt(parte.valorCentavos), 0n);
  assert.equal(soma, 10000n, "a soma das partes é exatamente o total");
  assert.equal(partes.filter((parte) => parte.ajusteResto === 1).length, 1, "um participante recebe o centavo restante");
});

test("quem lançou não confirma o próprio lançamento (regra garantida no servidor)", { skip: !disponivel && "sem banco de teste" }, async () => {
  const c = await cenario();
  const { id } = await criarDespesa(c, c.organizadora);
  const porSi = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas/${id}/confirmar`,
    headers: comSessao(c.organizadora),
  });
  assert.equal(porSi.statusCode, 400);
  assert.match(porSi.json().mensagem, /não pode confirmá-la/);

  const porOutro = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas/${id}/confirmar`,
    headers: comSessao(c.participante),
  });
  assert.equal(porOutro.statusCode, 200);
  assert.equal(porOutro.json().estado, "confirmada");
  assert.equal(porOutro.json().historico.length, 2);
});

test("saldo oficial e sugestão de acerto só com despesa confirmada", { skip: !disponivel && "sem banco de teste" }, async () => {
  const c = await cenario();
  const { id } = await criarDespesa(c, c.organizadora, { pagadorId: c.participante.id, valorCentavos: "30000" });
  // Quem lançou foi a organizadora; a confirmação precisa vir de outra pessoa.
  const confirmacao = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas/${id}/confirmar`,
    headers: comSessao(c.participante),
  });
  assert.equal(confirmacao.statusCode, 200);
  const saldos = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/saldos`, headers: comSessao(c.organizadora) });
  const corpo = saldos.json();
  assert.equal(corpo.realizado, "30000");
  const porPessoa = new Map<string, string>(corpo.saldos.map((saldo: { participanteId: string; saldo: string }) => [saldo.participanteId, saldo.saldo]));
  assert.equal(porPessoa.get(c.participante.id), "15000", "quem pagou tem a receber");
  assert.equal(porPessoa.get(c.organizadora.id), "-15000");
  assert.deepEqual(corpo.transferenciasSugeridas, [
    {
      deId: c.organizadora.id,
      deNome: "Organizadora",
      paraId: c.participante.id,
      paraNome: "Participante Teste",
      valorCentavos: "15000",
    },
  ]);
  assert.match(corpo.aviso, /sugestões/);
});

test("contestação mantém a despesa visível e fora do saldo oficial até resolver", { skip: !disponivel && "sem banco de teste" }, async () => {
  const c = await cenario();
  const { id } = await criarDespesa(c, c.organizadora);
  const contestarSemMotivo = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas/${id}/contestar`,
    headers: comSessao(c.participante),
    payload: { motivo: "oi" },
  });
  assert.equal(contestarSemMotivo.statusCode, 400);

  const contestada = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas/${id}/contestar`,
    headers: comSessao(c.participante),
    payload: { motivo: "O valor do jantar foi 80,00 e não 100,00" },
  });
  assert.equal(contestada.statusCode, 200);
  assert.equal(contestada.json().estado, "contestada");

  const lista = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/despesas`, headers: comSessao(c.organizadora) });
  assert.equal(lista.json().despesas.length, 1, "contestada continua visível");
  const saldos = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/saldos`, headers: comSessao(c.organizadora) });
  assert.equal(saldos.json().realizado, "0");
  assert.equal(saldos.json().comprometido, "10000");
});

test("correção exige motivo, volta para pendente e preserva o histórico antes/depois", { skip: !disponivel && "sem banco de teste" }, async () => {
  const c = await cenario();
  const { id } = await criarDespesa(c, c.organizadora);
  const confirmada = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas/${id}/confirmar`,
    headers: comSessao(c.participante),
  });
  assert.equal(confirmada.statusCode, 200);
  const semMotivo = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas/${id}/corrigir`,
    headers: comSessao(c.organizadora),
    payload: { valorCentavos: "8000", motivo: "oi" },
  });
  assert.equal(semMotivo.statusCode, 400);

  const corrigida = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas/${id}/corrigir`,
    headers: comSessao(c.organizadora),
    payload: { valorCentavos: "8000", motivo: "Valor certo é 80,00: o garçom dividiu a conta" },
  });
  assert.equal(corrigida.statusCode, 200);
  assert.equal(corrigida.json().estado, "pendente", "volta a exigir revisão independente");
  assert.equal(corrigida.json().valorCentavos, "8000");
  const historico = corrigida.json().historico as { acao: string; alteracoes?: Record<string, unknown> }[];
  const ultimo = historico.at(-1);
  assert.equal(ultimo?.acao, "despesa:corrigir");
  assert.equal((ultimo?.alteracoes?.valorCentavos as { de: string; para: string }).de, "10000");
  assert.equal((ultimo?.alteracoes?.valorCentavos as { de: string; para: string }).para, "8000");

  const saldos = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/saldos`, headers: comSessao(c.organizadora) });
  assert.equal(saldos.json().realizado, "0", "correção tira do saldo oficial até nova confirmação");
});

test("participante que saiu não pode mais lançar despesa", { skip: !disponivel && "sem banco de teste" }, async () => {
  const c = await cenario();
  await ambiente.app.inject({ method: "POST", url: `/viagens/${c.viagemId}/sair`, headers: comSessao(c.participante) });
  const resposta = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas`,
    headers: comSessao(c.participante),
    payload: {
      tipo: "compartilhada",
      valorCentavos: "1000",
      moeda: "BRL",
      data: "2026-12-21",
      descricao: "Tentativa após sair",
      pagadorId: c.participante.id,
    },
  });
  assert.ok([403, 404].includes(resposta.statusCode), `esperava bloqueio, veio ${resposta.statusCode}`);
});

test("viagem cancelada bloqueia despesa nova e mantém correção possível", { skip: !disponivel && "sem banco de teste" }, async () => {
  const c = await cenario();
  const { id } = await criarDespesa(c, c.organizadora);
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/transicoes`,
    headers: comSessao(c.organizadora),
    payload: { para: "cancelada" },
  });
  const nova = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas`,
    headers: comSessao(c.organizadora),
    payload: {
      tipo: "compartilhada",
      valorCentavos: "5000",
      moeda: "BRL",
      data: "2026-12-21",
      descricao: "Nova após cancelar",
      pagadorId: c.organizadora.id,
    },
  });
  assert.equal(nova.statusCode, 403);
  assert.match(nova.json().mensagem, /cancelada/i);

  const correcao = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas/${id}/corrigir`,
    headers: comSessao(c.organizadora),
    payload: { descricao: "Jantar (valor ajustado)", motivo: "Ajuste após cancelamento para fechar as contas" },
  });
  assert.equal(correcao.statusCode, 200, "correções continuam permitidas depois do cancelamento");
});

test("rateio percentual e por valores são validados no servidor", { skip: !disponivel && "sem banco de teste" }, async () => {
  const c = await cenario();
  const percentual = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas`,
    headers: comSessao(c.organizadora),
    payload: {
      tipo: "compartilhada",
      valorCentavos: "10000",
      moeda: "BRL",
      data: "2026-12-21",
      descricao: "Passagens",
      pagadorId: c.organizadora.id,
      rateio: {
        metodo: "percentual",
        partes: [
          { participanteId: c.organizadora.id, bps: 5000 },
          { participanteId: c.participante.id, bps: 5000 },
        ],
      },
    },
  });
  assert.equal(percentual.statusCode, 201);

  const percentualErrado = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas`,
    headers: comSessao(c.organizadora),
    payload: {
      tipo: "compartilhada",
      valorCentavos: "10000",
      moeda: "BRL",
      data: "2026-12-21",
      descricao: "Errado",
      pagadorId: c.organizadora.id,
      rateio: {
        metodo: "percentual",
        partes: [
          { participanteId: c.organizadora.id, bps: 5000 },
          { participanteId: c.participante.id, bps: 4000 },
        ],
      },
    },
  });
  assert.equal(percentualErrado.statusCode, 400);
  assert.match(percentualErrado.json().mensagem, /100%/);

  const pessoaDeFora = await registrarUsuario(ambiente.app);
  const comEstranho = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas`,
    headers: comSessao(c.organizadora),
    payload: {
      tipo: "compartilhada",
      valorCentavos: "10000",
      moeda: "BRL",
      data: "2026-12-21",
      descricao: "Com quem não participa",
      pagadorId: c.organizadora.id,
      participantes: [c.organizadora.id, pessoaDeFora.usuario.id],
    },
  });
  assert.equal(comEstranho.statusCode, 400, "não dá para dividir com quem não é membro ativo");
});

test("acerto: informado não altera saldo; recebedor confirma e zera", { skip: !disponivel && "sem banco de teste" }, async () => {
  const c = await cenario();
  const { id } = await criarDespesa(c, c.organizadora, { pagadorId: c.participante.id, valorCentavos: "30000" });
  const confirmacao = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas/${id}/confirmar`,
    headers: comSessao(c.participante),
  });
  assert.equal(confirmacao.statusCode, 200);

  const informado = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/movimentos`,
    headers: comSessao(c.organizadora),
    payload: { deId: c.organizadora.id, paraId: c.participante.id, valorCentavos: "15000" },
  });
  assert.equal(informado.statusCode, 201);
  const movimentoId = informado.json().id as string;
  assert.match(informado.json().aviso, /informado/i);

  const saldoAntes = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/saldos`, headers: comSessao(c.organizadora) });
  const saldoDaOrganizadora = saldoAntes.json().saldos.find((s: { participanteId: string }) => s.participanteId === c.organizadora.id);
  assert.equal(saldoDaOrganizadora.saldo, "-15000", "informado sem confirmação não muda o saldo");

  const porQuemPagou = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/movimentos/${movimentoId}/confirmar`,
    headers: comSessao(c.organizadora),
  });
  assert.equal(porQuemPagou.statusCode, 403, "só quem recebeu confirma o recebimento");

  const porQuemRecebeu = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/movimentos/${movimentoId}/confirmar`,
    headers: comSessao(c.participante),
  });
  assert.equal(porQuemRecebeu.statusCode, 200);

  const saldoDepois = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/saldos`, headers: comSessao(c.organizadora) });
  assert.equal(saldoDepois.json().haDivergencia, false, "com o acerto confirmado, todos zeram");
  assert.deepEqual(saldoDepois.json().transferenciasSugeridas, []);
});

test("chave de idempotência evita lançamento duplicado em reenvio de rede", { skip: !disponivel && "sem banco de teste" }, async () => {
  const c = await cenario();
  const payload = {
    tipo: "compartilhada",
    valorCentavos: "10000",
    moeda: "BRL",
    data: "2026-12-21",
    descricao: "Táxi",
    pagadorId: c.organizadora.id,
    participantes: [c.organizadora.id, c.participante.id],
  };
  const primeira = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas`,
    headers: { ...comSessao(c.organizadora), "idempotency-key": "chave-teste-123" },
    payload,
  });
  const segunda = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas`,
    headers: { ...comSessao(c.organizadora), "idempotency-key": "chave-teste-123" },
    payload,
  });
  assert.equal(primeira.statusCode, 201);
  assert.equal(segunda.statusCode, 201);
  assert.equal(segunda.json().id, primeira.json().id, "mesma chave devolve o mesmo lançamento");

  const lista = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/despesas`, headers: comSessao(c.organizadora) });
  assert.equal(lista.json().despesas.length, 1, "não duplicou no banco");

  const outraChave = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas`,
    headers: { ...comSessao(c.organizadora), "idempotency-key": "chave-teste-456" },
    payload,
  });
  assert.notEqual(outraChave.json().id, primeira.json().id, "chave diferente é operação nova");
});

test("autorização negativa: estranho não vê despesas nem saldos de viagem alheia", { skip: !disponivel && "sem banco de teste" }, async () => {
  const c = await cenario();
  await criarDespesa(c, c.organizadora);
  const { usuario: estranho } = await registrarUsuario(ambiente.app);
  for (const url of [`/viagens/${c.viagemId}/despesas`, `/viagens/${c.viagemId}/saldos`, `/viagens/${c.viagemId}/movimentos`]) {
    const resposta = await ambiente.app.inject({ method: "GET", url, headers: comSessao(estranho) });
    assert.equal(resposta.statusCode, 404, `${url} não pode vazar dados`);
  }
});
