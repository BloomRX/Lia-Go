import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import type { PortaServidor } from "@lia-go/sync";
import { criarArmazenamentoIndexedDB } from "../src/offline/armazenamento.ts";
import { Sincronizador } from "../src/offline/sincronizador.ts";
import type { ResultadoBusca } from "@lia-go/sync";

/**
 * Sincronizador do app contra um servidor de mentira: valida o caminho que a pessoa usa
 * (criar despesa sem sinal, ver a fila, enviar quando a rede volta) sem depender de rede.
 */
function servidorFalso(opcoes: { falharTudo?: boolean; conflito?: boolean } = {}) {
  const recebidas: { tipo: string; idempotencia: string }[] = [];
  let falhasRestantes = opcoes.falharTudo ? 99 : 0;
  const detalhe = {
    viagem: { id: "v1", nome: "Praia", estado: "planejada", versao: 2, rotuloEstado: "Planejada" },
    papel: "organizador",
    participantes: [{ usuario_id: "u1", nome: "Ana", papel: "organizador", estado: "ativo" }],
    pendencias: { despesas: 1, convites: 0 },
    sugestao: null,
    permissoes: { editar: { permitido: true }, cancelar: { permitido: true }, convidar: { permitido: true }, registrarDespesa: { permitido: true }, transicoesPermitidas: ["em_andamento"] },
  };

  const porta: PortaServidor = {
    async enviar(operacao, idempotencia) {
      recebidas.push({ tipo: operacao.tipo, idempotencia });
      if (opcoes.conflito) {
        return { ok: false, erro: { codigo: "conflito_versao", mensagem: "mudou desde a sua última atualização", status: 409, detalhes: { versaoAtual: 5 } } };
      }
      if (falhasRestantes > 0) {
        falhasRestantes -= 1;
        return { ok: false, erro: { codigo: "rede", mensagem: "sem conexão" } };
      }
      return { ok: true, resposta: { id: "d-nova" } };
    },
    async buscarViagens(): Promise<ResultadoBusca> {
      return { ok: true, carga: { viagens: [{ id: "v1", nome: "Praia", estado: "planejada" }], convitesParaMim: [] } };
    },
    async buscarMudancas(): Promise<ResultadoBusca> {
      return { ok: true, cursor: "30", carga: { viagem: detalhe, despesas: [{ id: "d1", descricao: "Almoço", estado: "pendente", versao: 1 }] } };
    },
  };

  return { porta, recebidas, liberarFalhas: () => { falhasRestantes = 0; } };
}

function operacaoDespesa() {
  return {
    tipo: "criar_despesa" as const,
    viagemId: "v1",
    corpo: { descricao: "Jantar", valorCentavos: "5000" },
    descricao: "Despesa: Jantar (R$ 50,00)",
  };
}

test("offline: a despesa fica na fila com o texto certo e a fila sobrevive ao reinício", async () => {
  const { porta, recebidas } = servidorFalso();
  const armazem = criarArmazenamentoIndexedDB("sync-teste-1");
  const sincronizador = await Sincronizador.criar(armazem, porta);
  sincronizador.definirOnline(false);

  await sincronizador.enfileirar(operacaoDespesa());

  assert.equal(recebidas.length, 0, "sem rede não se abre conexão");
  assert.equal(sincronizador.obter().resumo.total, 1);
  assert.equal(sincronizador.obter().resumo.rotulo, "1 alteração aguardando envio");
  assert.equal(sincronizador.obter().fila.operacoes[0]!.operacao.descricao, "Despesa: Jantar (R$ 50,00)");

  // App reaberto: a fila continua lá.
  const reaberto = await Sincronizador.criar(armazem, porta);
  assert.equal(reaberto.obter().fila.operacoes.length, 1, "fechar o app não perde o trabalho da pessoa");
});

test("a rede voltou: a fila é enviada e o cache passa a refletir o servidor", async () => {
  const { porta, recebidas } = servidorFalso();
  const sincronizador = await Sincronizador.criar(criarArmazenamentoIndexedDB("sync-teste-2"), porta);
  sincronizador.definirOnline(false);
  await sincronizador.enfileirar(operacaoDespesa());

  sincronizador.definirOnline(true);
  await sincronizador.sincronizarAgora();

  assert.equal(recebidas.length, 1);
  assert.equal(recebidas[0]!.tipo, "criar_despesa");
  assert.equal(sincronizador.obter().fila.operacoes.length, 0);
  assert.equal(sincronizador.obter().resumo.rotulo, "Tudo sincronizado");
  assert.equal(sincronizador.obter().ultimaSincronizacao !== null, true);

  await sincronizador.abrirViagem("v1");
  await sincronizador.sincronizarAgora();
  assert.equal(sincronizador.obter().carga.viagem?.viagem["id"], "v1", "a viagem aberta fica no aparelho");
  assert.equal(sincronizador.obter().carga.despesas.length, 1, "as despesas do servidor entram no cache");
});

test("cada reenvio usa a MESMA chave de idempotência (o servidor nunca aplica duas vezes)", async () => {
  const { porta, recebidas, liberarFalhas } = servidorFalso({ falharTudo: true });
  // Um servidor que falha uma vez e depois aceita.
  const sincronizador = await Sincronizador.criar(criarArmazenamentoIndexedDB("sync-teste-3"), porta);
  await sincronizador.enfileirar(operacaoDespesa());
  await sincronizador.sincronizarAgora();
  assert.equal(sincronizador.obter().resumo.aguardando, 1, "falha de rede mantém a alteração na fila");

  liberarFalhas();
  await new Promise((resolve) => setTimeout(resolve, 2_100)); // espera do reenvio
  await sincronizador.sincronizarAgora();

  assert.equal(recebidas.length, 2, "tentou duas vezes");
  assert.equal(recebidas[0]!.idempotencia, recebidas[1]!.idempotencia, "mesma chave nas duas tentativas");
  assert.equal(sincronizador.obter().fila.operacoes.length, 0);
});

test("conflito de versão: a pessoa escolhe, e 'manter o que fiz' reaplica sobre a versão atual", async () => {
  const { porta, recebidas } = servidorFalso({ conflito: true });
  const armazem = criarArmazenamentoIndexedDB("sync-teste-4");
  const sincronizador = await Sincronizador.criar(armazem, porta);
  await sincronizador.enfileirar({
    tipo: "transicao_viagem",
    viagemId: "v1",
    para: "em_andamento",
    versao: 2,
    descricao: "Viagem: Em andamento",
  });

  await sincronizador.sincronizarAgora();
  const conflito = sincronizador.obter().fila.operacoes[0]!;
  assert.equal(conflito.estado, "conflito");
  assert.equal(sincronizador.obter().resumo.rotulo, "1 alteração precisa da sua decisão");
  assert.deepEqual(conflito.erro?.detalhes, { versaoAtual: 5 });

  await sincronizador.resolverConflito(conflito.id, "minha");
  // Enfileirar dispara o envio em segundo plano; aqui esperamos a passada para o teste ser determinístico.
  await sincronizador.sincronizarAgora();
  const reaplicada = sincronizador.obter().fila.operacoes[0]!;
  assert.equal(reaplicada.operacao.tipo, "transicao_viagem");
  assert.equal((reaplicada.operacao as { versao: number }).versao, 5, "usa a versão que o servidor informou");
  assert.notEqual(reaplicada.id, conflito.id, "chave nova: a tentativa antiga não se mistura com a nova");
  assert.ok(recebidas.length >= 2);
});

test("conflito: 'usar a versão do servidor' descarta a alteração do aparelho", async () => {
  const { porta } = servidorFalso({ conflito: true });
  const sincronizador = await Sincronizador.criar(criarArmazenamentoIndexedDB("sync-teste-5"), porta);
  await sincronizador.enfileirar({ tipo: "transicao_viagem", viagemId: "v1", para: "concluida", versao: 2, descricao: "Viagem: Concluída" });
  await sincronizador.sincronizarAgora();

  await sincronizador.resolverConflito(sincronizador.obter().fila.operacoes[0]!.id, "servidor");

  assert.equal(sincronizador.obter().fila.operacoes.length, 0, "nada foi sobrescrito no servidor");
  assert.match(sincronizador.obter().erroUltimaPassada ?? "", /versão do servidor/i);
});

test("regra de negócio recusada para de tentar, mas não trava as outras alterações", async () => {
  const porta: PortaServidor = {
    async enviar(operacao) {
      if (operacao.tipo === "criar_despesa" && (operacao.corpo as { descricao: string }).descricao === "Errada") {
        return { ok: false, erro: { codigo: "regra_violada", mensagem: "O valor precisa ser maior que zero.", status: 400 } };
      }
      return { ok: true, resposta: {} };
    },
    async buscarViagens() {
      return { ok: true, carga: { viagens: [], convitesParaMim: [] } };
    },
    async buscarMudancas() {
      return { ok: true, cursor: "1", carga: {} };
    },
  };
  const sincronizador = await Sincronizador.criar(criarArmazenamentoIndexedDB("sync-teste-6"), porta);
  await sincronizador.enfileirar({ tipo: "criar_despesa", viagemId: "v1", corpo: { descricao: "Errada" }, descricao: "Despesa: Errada" });
  await sincronizador.enfileirar({ tipo: "criar_despesa", viagemId: "v1", corpo: { descricao: "Certa" }, descricao: "Despesa: Certa" });

  await sincronizador.sincronizarAgora();

  const estado = sincronizador.obter();
  assert.equal(estado.fila.operacoes.length, 1);
  assert.equal(estado.fila.operacoes[0]!.estado, "falhou");
  assert.equal(estado.fila.operacoes[0]!.erro?.mensagem, "O valor precisa ser maior que zero.");
  assert.equal(estado.resumo.falhou, 1);
  assert.equal(estado.resumo.rotulo, "1 alteração não pôde ser enviada");

  await sincronizador.descartar(estado.fila.operacoes[0]!.id);
  assert.equal(sincronizador.obter().resumo.rotulo, "Tudo sincronizado");
});

test("limpar dados deste aparelho apaga fila e cache, e a tela reflete na hora", async () => {
  const { porta } = servidorFalso();
  const armazem = criarArmazenamentoIndexedDB("sync-teste-7");
  const sincronizador = await Sincronizador.criar(armazem, porta);
  await sincronizador.enfileirar(operacaoDespesa());
  await sincronizador.abrirViagem("v1");
  await sincronizador.sincronizarAgora();

  await sincronizador.limparDadosLocais();

  const estado = sincronizador.obter();
  assert.equal(estado.fila.operacoes.length, 0);
  assert.equal(estado.carga.viagens.length, 0);
  assert.equal(estado.carga.viagem, null);
  assert.equal(estado.viagemAtiva, null);

  const reaberto = await Sincronizador.criar(armazem, porta);
  assert.equal(reaberto.obter().fila.operacoes.length, 0, "não sobra nada no aparelho");
});

test("cinco pedidos durante uma passada viram uma passada seguinte, não cinco", async () => {
  // A passada 1 fica presa de propósito (o servidor "demora") para os pedidos caírem no meio dela.
  let liberarBusca: () => void = () => undefined;
  const presa = new Promise<void>((resolver) => {
    liberarBusca = resolver;
  });
  let buscaViagens = 0;
  const porta: PortaServidor = {
    async enviar() {
      return { ok: true, resposta: { id: "x" } };
    },
    async buscarViagens(): Promise<ResultadoBusca> {
      buscaViagens += 1;
      if (buscaViagens === 1) await presa;
      return { ok: true, carga: { viagens: [{ id: "v1", nome: "Praia", estado: "planejada" }], convitesParaMim: [] } };
    },
    async buscarMudancas(): Promise<ResultadoBusca> {
      return { ok: true, cursor: "1", carga: { viagem: null } };
    },
  };

  const sincronizador = await Sincronizador.criar(criarArmazenamentoIndexedDB("sync-teste-coalescencia"), porta);
  const primeira = sincronizador.sincronizarAgora();
  const esperas = [sincronizador.sincronizarAgora(), sincronizador.sincronizarAgora(), sincronizador.sincronizarAgora(), sincronizador.sincronizarAgora(), sincronizador.sincronizarAgora()];

  assert.ok(esperas.every((pedido) => pedido === esperas[0]), "todos os pedidos durante a passada esperam a mesma passada seguinte");

  liberarBusca();
  await Promise.all([primeira, ...esperas]);

  assert.equal(buscaViagens, 2, `duas passadas no total (a presa + a que atendeu todos os pedidos). Foram ${buscaViagens}`);
});
