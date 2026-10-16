import test from "node:test";
import assert from "node:assert/strict";
import { cargaVazia } from "../src/carga.ts";
import { enfileirar, filaVazia } from "../src/fila.ts";
import { sincronizar } from "../src/motor.ts";
import type { ArmazenamentoSync, PortaServidor, ResultadoBusca } from "../src/motor.ts";
import type { CargaLocal, Fila, Operacao, ResultadoEnvio } from "../src/tipos.ts";

const T0 = "2026-10-12T12:00:00.000Z";

function operacaoDespesa(viagemId: string, descricao: string): Operacao {
  return { tipo: "criar_despesa", viagemId, corpo: { descricao }, descricao: `Despesa: ${descricao}` };
}

/**
 * Armazenamento de mentira: guarda tudo em memória e conta as gravações.
 *
 * `gravarFila` é **cego** de propósito: ele grava o que recebe, sem olhar o que mudou desde a
 * leitura — é assim que o armazenamento real se comporta quando alguém grava fora da seção crítica
 * (defeito de 2026-10-16, em que a viagem criada desaparecia). O caminho correto do motor passa por
 * `mutarFila`, que lê e grava sem ninguém no meio.
 */
function criarArmazem(
  inicial: { fila: Fila; carga: CargaLocal; cursor: string | null },
) {
  const estado = { ...inicial };
  const gravacoes = { fila: 0, carga: 0 };
  const armazem: ArmazenamentoSync = {
    async lerFila() {
      return estado.fila;
    },
    async gravarFila(fila) {
      await new Promise((resolver) => setTimeout(resolver, 0));
      estado.fila = fila;
      gravacoes.fila += 1;
    },
    async mutarFila(transformar) {
      // Sem `await` entre ler e gravar: é uma seção crítica de verdade, como a transação do aparelho.
      const nova = transformar(estado.fila);
      estado.fila = nova;
      gravacoes.fila += 1;
      return nova;
    },
    async lerCarga() {
      return { cursor: estado.cursor, carga: estado.carga };
    },
    async gravarCarga(cursor, carga) {
      estado.cursor = cursor;
      estado.carga = carga;
      gravacoes.carga += 1;
    },
  };
  return { armazem, estado, gravacoes };
}

interface Chamada {
  operacao: Operacao;
  idempotencia: string;
}

/** Servidor de mentira: registra as chamadas e responde o que o teste mandar. */
function criarServidor(respostas: (chamada: Chamada, indice: number) => ResultadoEnvio) {
  const chamadas: Chamada[] = [];
  const buscas: { viagens: number; mudancas: { viagemId: string; cursor: string | null }[] } = { viagens: 0, mudancas: [] };
  let cargaRemota: Partial<CargaLocal> = { viagens: [{ id: "v1", nome: "Praia" }] };
  let resultadoMudancas: ResultadoBusca = { ok: true, cursor: "seq-1", carga: { despesas: [{ id: "d1", versao: 1 }] } };

  const porta: PortaServidor = {
    async enviar(operacao, idempotencia) {
      const indice = chamadas.length;
      chamadas.push({ operacao, idempotencia });
      return respostas({ operacao, idempotencia }, indice);
    },
    async buscarViagens() {
      buscas.viagens += 1;
      return { ok: true, carga: cargaRemota };
    },
    async buscarMudancas(viagemId, cursor) {
      buscas.mudancas.push({ viagemId, cursor });
      return resultadoMudancas;
    },
  };

  return {
    porta,
    chamadas,
    buscas,
    definirCargaRemota(carga: Partial<CargaLocal>) {
      cargaRemota = carga;
    },
    definirMudancas(resultado: ResultadoBusca) {
      resultadoMudancas = resultado;
    },
  };
}

test("offline: nada é enviado, a fila fica intacta e o relatório diz por quê", async () => {
  let fila = filaVazia();
  fila = enfileirar(fila, { id: "op-0", operacao: operacaoDespesa("v1", "Hotel"), agora: T0 });
  const { armazem, estado } = criarArmazem({ fila, carga: cargaVazia(), cursor: null });
  const servidor = criarServidor(() => ({ ok: true }));

  const relatorio = await sincronizar(armazem, servidor.porta, { agora: () => T0, online: () => false });

  assert.equal(relatorio.parada, "offline");
  assert.equal(relatorio.enviados, 0);
  assert.equal(relatorio.aguardando, 1);
  assert.equal(servidor.chamadas.length, 0, "sem rede não se abre conexão");
  assert.equal(estado.fila.operacoes.length, 1, "nada é perdido quando está offline");
});

test("online com fila vazia: só busca o que mudou e guarda o cursor", async () => {
  const { armazem, estado } = criarArmazem({ fila: filaVazia(), carga: cargaVazia(), cursor: null });
  const servidor = criarServidor(() => ({ ok: true }));

  const relatorio = await sincronizar(armazem, servidor.porta, {
    agora: () => T0,
    online: () => true,
    viagemAtiva: () => "v1",
  });

  assert.equal(relatorio.parada, "fila_vazia");
  assert.equal(relatorio.buscadasMudancas, true);
  assert.equal(estado.cursor, "seq-1");
  assert.equal(estado.carga.viagens.length, 1, "a lista de viagens chegou do servidor");
  assert.equal(estado.carga.despesas[0]?.["id"], "d1", "as mudanças da viagem aberta foram aplicadas");
  assert.deepEqual(servidor.buscas.mudancas, [{ viagemId: "v1", cursor: null }]);
});

test("envia na ordem de criação e busca de novo depois para a carga refletir o servidor", async () => {
  let fila = filaVazia();
  fila = enfileirar(fila, { id: "op-0", operacao: { tipo: "criar_viagem", corpo: { nome: "Praia" }, descricao: "Viagem" }, agora: T0 });
  fila = enfileirar(fila, { id: "op-1", operacao: operacaoDespesa("v1", "Hotel"), agora: T0 });
  const { armazem, estado } = criarArmazem({ fila, carga: cargaVazia(), cursor: "seq-1" });
  const servidor = criarServidor(() => ({ ok: true, resposta: { id: "criado-1" } }));

  const relatorio = await sincronizar(armazem, servidor.porta, { agora: () => T0, online: () => true, viagemAtiva: () => "v1" });

  assert.equal(relatorio.enviados, 2);
  assert.deepEqual(servidor.chamadas.map((c) => c.operacao.tipo), ["criar_viagem", "criar_despesa"]);
  assert.equal(estado.fila.operacoes.length, 0, "fila esvaziou depois do sucesso");
  assert.equal(estado.fila.ultimoSucessoEm, T0);
  assert.equal(servidor.buscas.mudancas.length, 2, "busca antes (para saber o estado) e depois (para refletir o envio)");
  assert.equal(servidor.buscas.mudancas[1]!.cursor, "seq-1", "a segunda busca usa o cursor atualizado");
});

test("a chave de idempotência enviada é o id da operação: reenvio nunca duplica", async () => {
  let fila = filaVazia();
  fila = enfileirar(fila, { id: "op-chave-unica", operacao: operacaoDespesa("v1", "Hotel"), agora: T0 });
  const { armazem } = criarArmazem({ fila, carga: cargaVazia(), cursor: null });
  let falhar = true;
  const servidor = criarServidor(() => (falhar ? { ok: false, erro: { codigo: "rede", mensagem: "caiu" } } : { ok: true }));

  await sincronizar(armazem, servidor.porta, { agora: () => T0, online: () => true });
  falhar = false;
  await sincronizar(armazem, servidor.porta, { agora: () => "2026-10-12T12:00:05.000Z", online: () => true });

  assert.equal(servidor.chamadas.length, 2, "tentou duas vezes, como deveria");
  assert.equal(servidor.chamadas[0]!.idempotencia, "op-chave-unica");
  assert.equal(servidor.chamadas[1]!.idempotencia, "op-chave-unica", "a mesma chave: o servidor não aplica duas vezes");
});

test("falha de rede para a passada e preserva a ordem (nada fura a fila)", async () => {
  let fila = filaVazia();
  fila = enfileirar(fila, { id: "op-0", operacao: operacaoDespesa("v1", "Hotel"), agora: T0 });
  fila = enfileirar(fila, { id: "op-1", operacao: operacaoDespesa("v1", "Jantar"), agora: T0 });
  const { armazem, estado } = criarArmazem({ fila, carga: cargaVazia(), cursor: null });
  const servidor = criarServidor(() => ({ ok: false, erro: { codigo: "rede", mensagem: "sem conexão" } }));

  const relatorio = await sincronizar(armazem, servidor.porta, { agora: () => T0, online: () => true });

  assert.equal(relatorio.parada, "reenvio_agendado");
  assert.equal(servidor.chamadas.length, 1, "o Jantar não foi enviado antes do Hotel");
  assert.equal(estado.fila.operacoes[0]!.estado, "aguardando");
  assert.equal(estado.fila.operacoes[0]!.tentativas, 1);
  assert.equal(relatorio.aguardando, 2);
});

test("exceção na chamada (queda total) é tratada como problema de rede, não como sucesso", async () => {
  let fila = filaVazia();
  fila = enfileirar(fila, { id: "op-0", operacao: operacaoDespesa("v1", "Hotel"), agora: T0 });
  const { armazem, estado } = criarArmazem({ fila, carga: cargaVazia(), cursor: null });
  const porta: PortaServidor = {
    async enviar() {
      throw new TypeError("Failed to fetch");
    },
    async buscarViagens() {
      throw new TypeError("Failed to fetch");
    },
    async buscarMudancas() {
      throw new TypeError("Failed to fetch");
    },
  };

  const relatorio = await sincronizar(armazem, porta, { agora: () => T0, online: () => true });

  assert.equal(relatorio.enviados, 0);
  assert.equal(estado.fila.operacoes[0]!.estado, "aguardando");
  assert.equal(estado.fila.operacoes[0]!.erro?.codigo, "rede");
  assert.equal(estado.fila.operacoes[0]!.tentativas, 1);
});

test("regra de negócio violada não fica tentando e não trava as outras alterações", async () => {
  let fila = filaVazia();
  fila = enfileirar(fila, { id: "op-0", operacao: operacaoDespesa("v1", "Valor inválido"), agora: T0 });
  fila = enfileirar(fila, { id: "op-1", operacao: operacaoDespesa("v1", "Jantar"), agora: T0 });
  const { armazem, estado } = criarArmazem({ fila, carga: cargaVazia(), cursor: null });
  const servidor = criarServidor((chamada) =>
    chamada.idempotencia === "op-0"
      ? { ok: false, erro: { codigo: "regra_violada", mensagem: "O valor precisa ser maior que zero.", status: 400 } }
      : { ok: true },
  );

  const relatorio = await sincronizar(armazem, servidor.porta, { agora: () => T0, online: () => true });

  assert.equal(relatorio.falharam, 1);
  assert.equal(relatorio.enviados, 1, "a segunda alteração foi enviada normalmente");
  assert.deepEqual(estado.fila.operacoes.map((o) => o.id), ["op-0"]);
  assert.equal(estado.fila.operacoes[0]!.estado, "falhou");
  assert.equal(estado.fila.operacoes[0]!.erro?.mensagem, "O valor precisa ser maior que zero.");
});

test("conflito de versão para o envio e vira decisão da pessoa, sem sobrescrever nada", async () => {
  let fila = filaVazia();
  fila = enfileirar(fila, {
    id: "op-0",
    operacao: { tipo: "transicao_viagem", viagemId: "v1", para: "planejada", versao: 1, descricao: "Viagem: planejada" },
    agora: T0,
  });
  const { armazem, estado } = criarArmazem({ fila, carga: cargaVazia(), cursor: null });
  const servidor = criarServidor(() => ({
    ok: false,
    erro: { codigo: "conflito_versao", mensagem: "mudou desde a sua última atualização", status: 409, detalhes: { versaoAtual: 3 } },
  }));

  const relatorio = await sincronizar(armazem, servidor.porta, { agora: () => T0, online: () => true, viagemAtiva: () => "v1" });

  assert.equal(relatorio.conflitos, 1);
  assert.equal(estado.fila.operacoes[0]!.estado, "conflito");
  assert.equal((estado.fila.operacoes[0]!.erro?.detalhes as { versaoAtual: number }).versaoAtual, 3);
  assert.equal(relatorio.parada, "fila_vazia", "um conflito não impede o resto da sincronização");
});

test("se a busca falha, o envio ainda é tentado e o relatório não mente", async () => {
  let fila = filaVazia();
  fila = enfileirar(fila, { id: "op-0", operacao: operacaoDespesa("v1", "Hotel"), agora: T0 });
  const { armazem } = criarArmazem({ fila, carga: cargaVazia(), cursor: null });
  const servidor = criarServidor(() => ({ ok: true }));
  servidor.definirCargaRemota({});
  const porta: PortaServidor = {
    enviar: servidor.porta.enviar,
    async buscarViagens() {
      return { ok: false, erro: { codigo: "rede", mensagem: "sem rede" } };
    },
    async buscarMudancas() {
      return { ok: false, erro: { codigo: "rede", mensagem: "sem rede" } };
    },
  };

  const relatorio = await sincronizar(armazem, porta, { agora: () => T0, online: () => true, viagemAtiva: () => "v1" });

  assert.equal(relatorio.enviados, 1, "sem a busca, o envio da fila continua valendo");
  assert.equal(relatorio.buscadasMudancas, false, "e o relatório diz que não trouxe mudanças");
});


test("a passada grava a fila dentro da seção crítica do armazenamento (nunca ler-depois-gravar)", async () => {
  const { armazem, gravacoes } = criarArmazem({
    fila: enfileirar(filaVazia(), { id: "op-0", operacao: operacaoDespesa("v1", "Hotel"), agora: T0 }),
    carga: cargaVazia(),
    cursor: null,
  });
  const chamadas: { mutar: number; gravar: number } = { mutar: 0, gravar: 0 };
  const espiado: ArmazenamentoSync = {
    ...armazem,
    async gravarFila(fila) {
      chamadas.gravar += 1;
      await armazem.gravarFila(fila);
    },
    async mutarFila(transformar) {
      chamadas.mutar += 1;
      return armazem.mutarFila(transformar);
    },
  };
  const servidor = criarServidor(() => ({ ok: true }));

  await sincronizar(espiado, servidor.porta, { agora: () => T0, online: () => true });

  assert.ok(chamadas.mutar > 0, "a passada precisa transformar a fila na seção crítica");
  assert.equal(chamadas.gravar, 0, "gravar a fila fora da seção crítica é o defeito que perdia a operação nova");
  assert.ok(gravacoes.fila > 0);
});
