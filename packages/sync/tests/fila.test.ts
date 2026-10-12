import test from "node:test";
import assert from "node:assert/strict";
import {
  classificarErro,
  descartar,
  enfileirar,
  esperaDeReenvio,
  filaVazia,
  marcarEnviada,
  marcarEnviando,
  marcarFalha,
  proximaOperacao,
  recuperarInterrompidas,
  resumoFila,
  retentar,
} from "../src/fila.ts";
import type { Fila, Operacao } from "../src/tipos.ts";

const T0 = "2026-10-12T12:00:00.000Z";
const depois = (segundos: number) => new Date(new Date(T0).getTime() + segundos * 1000).toISOString();

function opCriarViagem(nome: string): Operacao {
  return { tipo: "criar_viagem", corpo: { nome }, descricao: `Viagem: ${nome}` };
}

function filaCom(quantidade: number): Fila {
  let fila = filaVazia();
  for (let i = 0; i < quantidade; i += 1) {
    fila = enfileirar(fila, { id: `op-${i}`, operacao: opCriarViagem(`V${i}`), agora: T0 });
  }
  return fila;
}

test("enfileirar preserva a ordem de criação e não duplica o mesmo id", () => {
  let fila = filaCom(2);
  assert.deepEqual(fila.operacoes.map((o) => o.id), ["op-0", "op-1"]);
  fila = enfileirar(fila, { id: "op-0", operacao: opCriarViagem("repetida"), agora: depois(5) });
  assert.equal(fila.operacoes.length, 2, "o mesmo id não entra duas vezes (seria enviado duas vezes)");
});

test("a próxima operação é a mais antiga; nada atrás de uma espera é enviado antes dela", () => {
  let fila = filaCom(2);
  assert.equal(proximaOperacao(fila, T0)?.id, "op-0");

  fila = marcarFalha(fila, "op-0", { codigo: "rede", mensagem: "sem rede" }, T0);
  assert.equal(proximaOperacao(fila, T0)?.id, undefined, "op-0 espera a vez: op-1 não fura a fila");
  assert.equal(proximaOperacao(fila, depois(3))?.id, "op-0", "passada a espera, ela volta a ser a primeira");
});

test("operação que precisa de decisão humana não bloqueia o resto da fila", () => {
  let fila = filaCom(3);
  fila = marcarFalha(fila, "op-0", { codigo: "regra_violada", mensagem: "não pode", status: 400 }, T0);
  assert.equal(proximaOperacao(fila, T0)?.id, "op-1", "a fila segue; o problema fica visível para a pessoa");
});

test("espera de reenvio cresce e tem teto (2s, 4s, 8s… máximo 5 min)", () => {
  assert.equal(esperaDeReenvio(0), 0);
  assert.equal(esperaDeReenvio(1), 2_000);
  assert.equal(esperaDeReenvio(2), 4_000);
  assert.equal(esperaDeReenvio(3), 8_000);
  assert.equal(esperaDeReenvio(20), 5 * 60_000, "nunca espera mais que o teto");
});

test("erro de rede volta para a fila com espera crescente e guarda o motivo", () => {
  let fila = filaCom(1);
  fila = marcarFalha(fila, "op-0", { codigo: "rede", mensagem: "sem conexão" }, T0);
  const item = fila.operacoes[0]!;
  assert.equal(item.estado, "aguardando");
  assert.equal(item.tentativas, 1);
  assert.equal(item.proximaTentativaEm, depois(2));
  assert.equal(item.erro?.mensagem, "sem conexão");

  fila = marcarFalha(fila, "op-0", { codigo: "rede", mensagem: "sem conexão" }, depois(2));
  assert.equal(fila.operacoes[0]!.proximaTentativaEm, depois(6), "a espera dobra a cada tentativa");
});

test("erro permanente para de tentar e aparece para a pessoa resolver", () => {
  const casos = [
    { codigo: "regra_violada", mensagem: "rateio inválido", status: 400 },
    { codigo: "sem_permissao", mensagem: "não é seu", status: 403 },
    { codigo: "nao_encontrado", mensagem: "não existe", status: 404 },
    { codigo: "conflito", mensagem: "já confirmado", status: 409 },
  ];
  for (const erro of casos) {
    let fila = filaCom(1);
    fila = marcarFalha(fila, "op-0", erro, T0);
    assert.equal(fila.operacoes[0]!.estado, "falhou", `${erro.codigo} não deve continuar tentando`);
    assert.equal(proximaOperacao(fila, depois(600)), undefined, "não volta sozinha para a fila");
  }
});

test("conflito de versão vira estado 'conflito' com os dados para a pessoa decidir", () => {
  let fila = filaCom(1);
  fila = marcarFalha(
    fila,
    "op-0",
    { codigo: "conflito_versao", mensagem: "mudou desde a sua última atualização", status: 409, detalhes: { versaoAtual: 4 } },
    T0,
  );
  const item = fila.operacoes[0]!;
  assert.equal(item.estado, "conflito");
  assert.equal((item.erro?.detalhes as { versaoAtual: number }).versaoAtual, 4);
});

test("erros temporários do servidor continuam tentando (401, 429 e 5xx)", () => {
  for (const status of [401, 408, 425, 429, 500, 503]) {
    let fila = filaCom(1);
    fila = marcarFalha(fila, "op-0", { codigo: "temporario", mensagem: "tente depois", status }, T0);
    assert.equal(fila.operacoes[0]!.estado, "aguardando", `status ${status} deve ser temporário`);
  }
  assert.equal(classificarErro({ codigo: "conflito_versao", mensagem: "", status: 409 }).destino, "conflito");
  assert.equal(classificarErro({ codigo: "regra_violada", mensagem: "", status: 400 }).destino, "permanente");
  assert.equal(classificarErro({ codigo: "rede", mensagem: "" }).destino, "reenviar");
});

test("sucesso tira a operação da fila e marca o 'tudo sincronizado' quando esvazia", () => {
  let fila = filaCom(2);
  fila = marcarEnviada(fila, "op-0", depois(1));
  assert.equal(fila.operacoes.length, 1);
  assert.equal(fila.ultimoSucessoEm, undefined, "ainda há pendência: não é 'tudo sincronizado'");
  fila = marcarEnviada(fila, "op-1", depois(2));
  assert.equal(fila.operacoes.length, 0);
  assert.equal(fila.ultimoSucessoEm, depois(2));
});

test("app fechado no meio do envio: 'enviando' volta para a fila em vez de ficar preso", () => {
  let fila = filaCom(1);
  fila = marcarEnviando(fila, "op-0");
  assert.equal(fila.operacoes[0]!.estado, "enviando");
  fila = recuperarInterrompidas(fila, depois(30));
  assert.equal(fila.operacoes[0]!.estado, "aguardando");
  assert.equal(proximaOperacao(fila, depois(30))?.id, "op-0", "reenvia com a mesma chave: o servidor não duplica");
});

test("retentar volta a operação para a fila; descartar remove de vez", () => {
  let fila = filaCom(1);
  fila = marcarFalha(fila, "op-0", { codigo: "regra_violada", mensagem: "x", status: 400 }, T0);
  fila = retentar(fila, "op-0", depois(10));
  assert.equal(fila.operacoes[0]!.estado, "aguardando");
  assert.equal(fila.operacoes[0]!.tentativas, 0);
  assert.equal(fila.operacoes[0]!.proximaTentativaEm, depois(10));
  fila = descartar(fila, "op-0");
  assert.equal(fila.operacoes.length, 0);
});

test("retentar mantém o erro de conflito guardado (a tela precisa das duas versões)", () => {
  let fila = filaCom(1);
  fila = marcarFalha(fila, "op-0", { codigo: "conflito_versao", mensagem: "mudou", status: 409, detalhes: { versaoAtual: 2 } }, T0);
  fila = retentar(fila, "op-0", depois(5));
  assert.equal(fila.operacoes[0]!.estado, "aguardando");
  assert.equal(fila.operacoes[0]!.erro?.codigo, "conflito_versao", "sem o erro, a tela não saberia qual versão usar");
});

test("resumo da fila fala a língua da pessoa e prioriza o que precisa de decisão", () => {
  let fila = filaCom(2);
  assert.deepEqual(
    { estado: resumoFila(fila).estado, rotulo: resumoFila(fila).rotulo },
    { estado: "pendente", rotulo: "2 alterações aguardando envio" },
  );

  fila = marcarEnviando(fila, "op-0");
  assert.equal(resumoFila(fila).estado, "enviando");
  assert.equal(resumoFila(fila).rotulo, "Enviando…");

  fila = marcarFalha(fila, "op-0", { codigo: "rede", mensagem: "x" }, T0);
  const comProblema = resumoFila(filaCom(1));
  assert.equal(comProblema.estado, "pendente");

  let comConflito = filaCom(1);
  comConflito = marcarFalha(comConflito, "op-0", { codigo: "conflito_versao", mensagem: "x", status: 409 }, T0);
  const resumo = resumoFila(comConflito);
  assert.equal(resumo.estado, "com_problema");
  assert.equal(resumo.rotulo, "1 alteração precisa da sua decisão");

  const sincronizado = resumoFila(filaVazia());
  assert.equal(sincronizado.estado, "sincronizado");
  assert.equal(sincronizado.rotulo, "Tudo sincronizado");
});
