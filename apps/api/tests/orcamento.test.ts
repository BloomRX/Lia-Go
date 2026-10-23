/**
 * Orçamento e fechamento pela API: o limite é planejamento, o oficial vem das despesas confirmadas
 * e o fechamento exporta o que o grupo confere.
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

async function cenario(estado = "planejada"): Promise<Cenario> {
  const { usuario: organizadora } = await registrarUsuario(ambiente.app, { nome: "Organizadora" });
  const viagemId = await criarViagem(ambiente.app, organizadora, { dataInicio: "2026-12-20", dataFim: "2026-12-27" });
  await ambiente.app.inject({ method: "POST", url: `/viagens/${viagemId}/transicoes`, headers: comSessao(organizadora), payload: { para: estado } });
  const participante = await adicionarParticipante(ambiente.app, organizadora, viagemId);
  return { viagemId, organizadora, participante };
}

async function definirLimite(c: Cenario, quem: UsuarioTeste, centavos: string, usuarioId?: string): Promise<number> {
  const resposta = await ambiente.app.inject({
    method: "PUT",
    url: usuarioId ? `/viagens/${c.viagemId}/orcamento/limites/${usuarioId}` : `/viagens/${c.viagemId}/orcamento/limite`,
    headers: comSessao(quem),
    payload: { centavos },
  });
  return resposta.statusCode;
}

async function criarAtividade(c: Cenario, custoCentavos: string | null): Promise<void> {
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/atividades`,
    headers: comSessao(c.organizadora),
    payload: { dia: "2026-12-20", titulo: "Passeio de barco", custoCentavos, custoNatureza: custoCentavos === null ? null : "estimativa" },
  });
}

test("sem limite, o orçamento diz que não há limite e separa planejamento do oficial", { skip: !disponivel }, async () => {
  const c = await cenario();
  await criarAtividade(c, "245000");

  const resposta = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/orcamento`, headers: comSessao(c.participante) });
  const corpo = resposta.json() as { limiteColetivo: unknown; situacao: { estado: string; resumo: string; temLimite: boolean }; planejamento: { previstoCentavos: string }; oficial: { gastoConfirmadoCentavos: string } };

  assert.equal(resposta.statusCode, 200);
  assert.equal(corpo.limiteColetivo, null);
  assert.equal(corpo.situacao.temLimite, false);
  assert.equal(corpo.situacao.estado, "sem_limite");
  assert.match(corpo.situacao.resumo, /Sem limite definido/);
  assert.equal(corpo.planejamento.previstoCentavos, "245000", "previsto vem do roteiro, não das despesas");
  assert.equal(corpo.oficial.gastoConfirmadoCentavos, "0", "planejamento não é gasto");
});

test("só quem organiza define o limite coletivo; qualquer pessoa define o próprio individual", { skip: !disponivel }, async () => {
  const c = await cenario();

  assert.equal(await definirLimite(c, c.participante, "300000"), 403, "participante não define o teto do grupo");

  assert.equal(await definirLimite(c, c.organizadora, "300000"), 200);
  assert.equal(await definirLimite(c, c.participante, "100000", c.participante.id), 200, "cada pessoa define o seu");
  assert.equal(await definirLimite(c, c.participante, "999999", c.organizadora.id), 403, "participante não define o limite de outra pessoa");
  assert.equal(await definirLimite(c, c.organizadora, "150000", c.participante.id), 200, "organizadora ajusta o combinado");

  const orcamento = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/orcamento`, headers: comSessao(c.participante) });
  const corpo = orcamento.json() as { limiteColetivo: { centavos: string }; limiteIndividualProprio: { centavos: string }; limitesIndividuais: { usuarioId: string; nome: string | null }[] };
  assert.equal(corpo.limiteColetivo.centavos, "300000");
  assert.equal(corpo.limiteIndividualProprio.centavos, "150000");
  assert.match(corpo.limitesIndividuais[0]!.nome ?? "", /^Participante/, "o limite individual aparece com nome para a tela");

  // Limite novo substitui o anterior (um coletivo por viagem), não acumula.
  assert.equal(await definirLimite(c, c.organizadora, "400000"), 200);
  const depois = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/orcamento`, headers: comSessao(c.organizadora) });
  assert.equal((depois.json() as { limiteColetivo: { centavos: string } }).limiteColetivo.centavos, "400000");
});

test("o banco recusa limite coletivo com dono e limite individual sem dono", { skip: !disponivel }, async () => {
  const c = await cenario();
  await definirLimite(c, c.organizadora, "100000");

  await assert.rejects(
    ambiente.pool.query("UPDATE limites_orcamento SET usuario_id = $1 WHERE viagem_id = $2 AND escopo = 'coletivo'", [c.organizadora.id, c.viagemId]),
    /escopo_coerente/,
  );
  await assert.rejects(
    ambiente.pool.query("INSERT INTO limites_orcamento (id, viagem_id, escopo, usuario_id, centavos, atualizado_por) VALUES (gen_random_uuid(), $1, 'individual', NULL, 100, $2)", [c.viagemId, c.organizadora.id]),
    /escopo_coerente/,
  );
});

test("o previsto soma roteiro e reservas e conta o que ainda não tem valor", { skip: !disponivel }, async () => {
  const c = await cenario();
  await criarAtividade(c, "50000");
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/reservas`,
    headers: comSessao(c.organizadora),
    payload: { tipo: "hospedagem", titulo: "Pousada", custoCentavos: "120000" },
  });
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/reservas`,
    headers: comSessao(c.organizadora),
    payload: { tipo: "transporte", titulo: "Van sem valor" },
  });

  const resposta = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/orcamento`, headers: comSessao(c.organizadora) });
  const corpo = resposta.json() as { planejamento: { previstoCentavos: string; custosAVerificar: number }; situacao: { alertas: string[] } };

  assert.equal(corpo.planejamento.previstoCentavos, "170000");
  assert.equal(corpo.planejamento.custosAVerificar, 1, "o custo sem valor é contado, nunca somado como zero");
  assert.ok(corpo.situacao.alertas.some((alerta) => /sem valor informado/.test(alerta)));
});

test("fechamento: total oficial só de confirmadas, acertos sugeridos e CSV para planilha", { skip: !disponivel }, async () => {
  const c = await cenario("em_andamento");
  const criada = await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas`,
    headers: comSessao(c.organizadora),
    payload: {
      descricao: "Jantar",
      valorCentavos: "10000",
      data: "2026-12-20",
      tipo: "compartilhada",
      pagadorId: c.organizadora.id,
      rateio: { metodo: "igualitario", participantes: [c.organizadora.id, c.participante.id] },
    },
  });
  const despesaId = (criada.json() as { despesa?: { id: string }; id?: string }).despesa?.id ?? (criada.json() as { id: string }).id;
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas/${despesaId}/confirmar`,
    headers: comSessao(c.participante),
    payload: {},
  });

  const resposta = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/fechamento`, headers: comSessao(c.participante) });
  const corpo = resposta.json() as {
    totalConfirmadoCentavos: string;
    saldos: { nome: string | null; saldoCentavos: string }[];
    acertosSugeridos: { deNome: string | null; paraNome: string | null; valorCentavos: string }[];
    csv: string;
    texto: string;
  };

  assert.equal(resposta.statusCode, 200);
  assert.equal(corpo.totalConfirmadoCentavos, "10000");
  assert.equal(corpo.acertosSugeridos.length, 1);
  assert.equal(corpo.acertosSugeridos[0]!.valorCentavos, "5000", "quem não pagou deve a metade");
  assert.match(corpo.csv, /"viagem";"data";"descricao"/);
  assert.match(corpo.texto, /Acertos sugeridos \(sugestão/);
  assert.ok(corpo.saldos.length >= 2);
});

test("despesa pendente não entra no total oficial do fechamento (e o texto avisa)", { skip: !disponivel }, async () => {
  const c = await cenario("em_andamento");
  await ambiente.app.inject({
    method: "POST",
    url: `/viagens/${c.viagemId}/despesas`,
    headers: comSessao(c.organizadora),
    payload: {
      descricao: "Almoço",
      valorCentavos: "6000",
      data: "2026-12-20",
      tipo: "compartilhada",
      pagadorId: c.organizadora.id,
      rateio: { metodo: "igualitario", participantes: [c.organizadora.id] },
    },
  });

  const resposta = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/fechamento`, headers: comSessao(c.organizadora) });
  const corpo = resposta.json() as { totalConfirmadoCentavos: string; totalAguardandoCentavos: string; alertas: string[]; despesasAbertas: number };

  assert.equal(corpo.totalConfirmadoCentavos, "0");
  assert.equal(corpo.totalAguardandoCentavos, "6000");
  assert.equal(corpo.despesasAbertas, 1);
  assert.ok(corpo.alertas.some((alerta) => /não entram no total oficial/.test(alerta)));
});

test("quem não participa não vê orçamento nem fechamento", { skip: !disponivel }, async () => {
  const c = await cenario();
  const { usuario: estranho } = await registrarUsuario(ambiente.app, { nome: "De fora" });

  const orcamento = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/orcamento`, headers: comSessao(estranho) });
  const fechamento = await ambiente.app.inject({ method: "GET", url: `/viagens/${c.viagemId}/fechamento`, headers: comSessao(estranho) });
  assert.equal(orcamento.statusCode, 404);
  assert.equal(fechamento.statusCode, 404);
});
