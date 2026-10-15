/**
 * Documentos: privado por padrão, compartilhar é ato explícito e nada some em silêncio.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  compartilharDocumento,
  criarDocumento,
  podeVerDocumento,
  removerDocumento,
  resumirDocumentos,
  revisarImpactoDoDocumento,
  revogarAcesso,
  type Documento,
} from "../src/documento.ts";

function documento(parcial: Partial<Documento> = {}): Documento {
  return {
    id: parcial.id ?? "d1",
    viagemId: "v1",
    autorId: parcial.autorId ?? "u1",
    tipo: parcial.tipo ?? "passagem",
    nome: parcial.nome ?? "Passagem SP → Recife",
    descricao: parcial.descricao ?? null,
    link: parcial.link === undefined ? "https://cia.com/localizador/ABC" : parcial.link,
    visibilidade: parcial.visibilidade ?? "privado",
    compartilhadoCom: parcial.compartilhadoCom ?? [],
    estado: parcial.estado ?? "ativo",
    removidoPor: parcial.removidoPor ?? null,
    removidoEm: parcial.removidoEm ?? null,
    motivoRemocao: parcial.motivoRemocao ?? null,
    versao: parcial.versao ?? 1,
  };
}

test("documento nasce privado e só quem criou vê", () => {
  const criado = criarDocumento({ id: "d1", viagemId: "v1", autorId: "u1", tipo: "passagem", nome: "  Passagem SP → Recife  ", link: "https://cia.com/ABC" });

  assert.equal(criado.visibilidade, "privado");
  assert.deepEqual(criado.compartilhadoCom, []);
  assert.equal(criado.nome, "Passagem SP → Recife");
  assert.equal(podeVerDocumento(criado, "u1"), true);
  assert.equal(podeVerDocumento(criado, "u2"), false, "ninguém entra sem ser convidado");
});

test("link estranho é recusado (nada de caminho disfarçado)", () => {
  assert.throws(() => criarDocumento({ id: "d1", viagemId: "v1", autorId: "u1", tipo: "outro", nome: "Arquivo", link: "javascript:alert(1)" }), /http:\/\/ ou https:\/\//i);
  assert.throws(() => criarDocumento({ id: "d1", viagemId: "v1", autorId: "u1", tipo: "outro", nome: "x" }), /pelo menos 2/i);

  const semLink = criarDocumento({ id: "d1", viagemId: "v1", autorId: "u1", tipo: "identidade", nome: "RG" });
  assert.equal(semLink.link, null, "sem link é válido: o documento pode ser só um lembrete");
});

test("compartilhar com a viagem dá acesso a todos; com pessoas, só a elas", () => {
  const criado = documento();

  const comTodos = compartilharDocumento(criado, { porId: "u1", com: "viagem" });
  assert.equal(comTodos.visibilidade, "viagem");
  assert.equal(podeVerDocumento(comTodos, "u9"), true, "todas as pessoas ativas da viagem");
  assert.equal(comTodos.versao, 2);

  const comPessoas = compartilharDocumento(criado, { porId: "u1", com: ["u2", "u2", "u3"] });
  assert.deepEqual(comPessoas.compartilhadoCom, ["u2", "u3"], "sem repetição");
  assert.equal(podeVerDocumento(comPessoas, "u2"), true);
  assert.equal(podeVerDocumento(comPessoas, "u4"), false);
  assert.throws(() => compartilharDocumento(criado, { porId: "u1", com: ["u1"] }), /com quem compartilhar/i, "compartilhar só consigo mesmo não é compartilhar");
});

test("revogar tira o acesso sem apagar a história", () => {
  const comPessoas = compartilharDocumento(documento(), { porId: "u1", com: ["u2", "u3"] });

  const revogado = revogarAcesso(comPessoas, { com: ["u2"] });
  assert.deepEqual(revogado.compartilhadoCom, ["u3"]);
  assert.equal(revogado.versao, 3);
  assert.throws(() => revogarAcesso(revogado, { com: ["u2"] }), /não tinham acesso/i);

  const soEu = revogarAcesso(revogado, { com: "viagem" });
  assert.deepEqual(soEu.compartilhadoCom, []);
  assert.equal(soEu.visibilidade, "privado");
  assert.throws(() => revogarAcesso(soEu, { com: "viagem" }), /já está visível só para quem criou/i);
});

test("remover exige motivo, revoga o acesso e mantém o registro para quem administra", () => {
  const compartilhado = compartilharDocumento(documento(), { porId: "u1", com: "viagem" });

  assert.throws(() => removerDocumento(compartilhado, { porId: "u1", motivo: "ok" }), /mínimo 5/i);

  const removido = removerDocumento(compartilhado, { porId: "u1", motivo: "Passagem trocada por outra data", em: "2026-11-10T12:00:00.000Z" });
  assert.equal(removido.estado, "removido");
  assert.equal(removido.motivoRemocao, "Passagem trocada por outra data");
  assert.deepEqual(removido.compartilhadoCom, [], "quem tinha acesso perde na hora");
  assert.equal(podeVerDocumento(removido, "u2"), false);
  assert.equal(podeVerDocumento(removido, "u1"), false, "quem removeu também não vê na lista normal");
  assert.equal(podeVerDocumento(removido, "u9", { ehOrganizador: true }), true, "quem administra vê o que foi removido e o motivo");
  assert.throws(() => removerDocumento(removido, { porId: "u1", motivo: "de novo, com motivo" }), /já foi removido/i);
});

test("resumo conta o que existe: só seus, compartilhados e removidos", () => {
  const resumo = resumirDocumentos([
    documento({ id: "d1" }),
    documento({ id: "d2", visibilidade: "viagem" }),
    documento({ id: "d3", compartilhadoCom: ["u2"], tipo: "seguro" }),
    documento({ id: "d4", estado: "removido", motivoRemocao: "trocado" }),
  ]);

  assert.equal(resumo.ativos, 3);
  assert.equal(resumo.privados, 1);
  assert.equal(resumo.compartilhados, 2);
  assert.equal(resumo.removidos, 1);
  assert.equal(resumo.resumo, "3 documentos · 1 só seu · 2 compartilhados · 1 removido");
  assert.deepEqual(resumo.porTipo[0], { tipo: "passagem", rotulo: "Passagem", quantidade: 2 });
  assert.equal(resumirDocumentos([]).resumo, "Nenhum documento guardado.");
});

test("impacto antes de compartilhar e de remover diz o que acontece de verdade", () => {
  const compartilhar = revisarImpactoDoDocumento(documento(), "compartilhar", { participantesAtivos: 4 });
  assert.ok(compartilhar.itens.some((item) => /4 pessoas com acesso ativo/.test(item)));
  assert.ok(compartilhar.itens.some((item) => /não copia o arquivo/.test(item)), "não finge que o arquivo foi enviado");

  const identidade = revisarImpactoDoDocumento(documento({ tipo: "identidade" }), "compartilhar", { participantesAtivos: 4 });
  assert.ok(identidade.atencao.some((item) => /Documento de identidade/.test(item)));

  const compartilhado = compartilharDocumento(documento(), { porId: "u1", com: "viagem" });
  const remover = revisarImpactoDoDocumento(compartilhado, "remover", { participantesAtivos: 4 });
  assert.ok(remover.atencao.some((item) => /perdem o acesso imediatamente/.test(item)));
  assert.ok(remover.itens.some((item) => /Nada é apagado em definitivo/.test(item)));
});
