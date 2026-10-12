import test from "node:test";
import assert from "node:assert/strict";
import { aceitarConvite, cancelarConvite, consequenciasDeSaida, conviteExpirado, criarConvite, estadoEfetivo, normalizarEmail } from "../src/invite.ts";

const convite = criarConvite({
  id: "c1",
  viagemId: "v1",
  emailConvidado: "  Bruno@Exemplo.com ",
  criadoPorId: "org-1",
  agoraIso: "2026-10-01T12:00:00.000Z",
  validadeDias: 14,
});

test("convite normaliza e-mail e expira em 14 dias por padrão", () => {
  assert.equal(convite.emailConvidado, "bruno@exemplo.com");
  assert.equal(convite.estado, "pendente");
  assert.equal(convite.papel, "participante");
  assert.equal(convite.expiraEm, "2026-10-15T12:00:00.000Z");
  assert.equal(normalizarEmail(" A@B.CO "), "a@b.co");
  assert.throws(() => criarConvite({ id: "c2", viagemId: "v1", emailConvidado: "sem-arroba", criadoPorId: "org-1" }), /e-mail válido/);
});

test("convite expirado não pode ser aceito", () => {
  assert.equal(conviteExpirado(convite, "2026-10-20T12:00:00.000Z"), true);
  assert.equal(estadoEfetivo(convite, "2026-10-20T12:00:00.000Z"), "expirado");
  assert.throws(
    () => aceitarConvite(convite, { usuarioId: "u1", emailAutenticado: "bruno@exemplo.com" }, "2026-10-20T12:00:00.000Z"),
    /expirou/,
  );
});

test("só o dono do e-mail convidado aceita o convite", () => {
  assert.throws(
    () => aceitarConvite(convite, { usuarioId: "u2", emailAutenticado: "outra@exemplo.com" }, "2026-10-02T12:00:00.000Z"),
    /outro e-mail/,
  );
  const aceito = aceitarConvite(convite, { usuarioId: "u1", emailAutenticado: "BRUNO@exemplo.com" }, "2026-10-02T12:00:00.000Z");
  assert.equal(aceito.convite.estado, "aceito");
  assert.equal(aceito.estadoMembro, "ativo");
  assert.throws(() => aceitarConvite(aceito.convite, { usuarioId: "u1", emailAutenticado: "bruno@exemplo.com" }, "2026-10-03T12:00:00.000Z"), /já está aceito/);
});

test("organizador cancela convite pendente; participante não", () => {
  assert.throws(
    () => cancelarConvite(convite, { usuarioId: "u1", papel: "participante" }, "2026-10-02T12:00:00.000Z"),
    /Somente o organizador/,
  );
  const cancelado = cancelarConvite(convite, { usuarioId: "org-1", papel: "organizador" }, "2026-10-02T12:00:00.000Z");
  assert.equal(cancelado.estado, "cancelado");
  assert.throws(() => cancelarConvite(cancelado, { usuarioId: "org-1", papel: "organizador" }, "2026-10-02T12:00:00.000Z"), /não pode ser cancelado/);
  assert.throws(
    () => cancelarConvite(convite, { usuarioId: "org-1", papel: "organizador" }, "2026-10-20T12:00:00.000Z"),
    /expirado não pode ser cancelado/,
  );
});

test("consequências de sair/remover preservam histórico e pendências", () => {
  const consequencias = consequenciasDeSaida();
  assert.ok(consequencias.some((texto) => /novos lançamentos ficam bloqueados/i.test(texto)));
  assert.ok(consequencias.some((texto) => /continuam registradas/i.test(texto)));
  assert.ok(consequencias.some((texto) => /exigem revisão/i.test(texto)));
});
