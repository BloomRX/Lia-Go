import test from "node:test";
import assert from "node:assert/strict";
import {
  descreverCusto,
  descreverDeslocamento,
  formatarBRL,
  formatarDiaCurto,
  formatarDiaLongo,
  formatarDuracao,
  ROTULO_ATIVIDADE,
} from "../src/services/formato.ts";

/**
 * As regras abaixo vêm de `docs/UI_VISUAL_GUIDELINES.md` §2 (custos contextuais) e são testadas aqui
 * porque é fácil quebrá-las mexendo na tela: **desconhecido, a verificar e gratuito são três coisas
 * diferentes** e nenhuma delas pode virar `R$ 0,00` por acidente.
 */

test("custo desconhecido não vira número: fica omitido (e nunca R$ 0,00)", () => {
  const semCusto = descreverCusto({ centavos: null, rotulo: null, natureza: null });
  assert.equal(semCusto.valor, null);
  assert.equal(semCusto.rotulo, null);

  const aVerificar = descreverCusto({ centavos: null, rotulo: "a verificar", natureza: null });
  assert.equal(aVerificar.valor, null, "custo a verificar não tem valor");
  assert.equal(aVerificar.rotulo, "a verificar", "mas é sinalizado");
});

test("custo gratuito é zero explícito, com rótulo que explica o zero", () => {
  const gratuito = descreverCusto({ centavos: 0n, rotulo: null, natureza: "gratuito" });
  assert.equal(gratuito.valor, formatarBRL(0n));
  assert.equal(gratuito.rotulo, "Sem custo");
});

test("estimativa e compromisso aparecem com o valor, sem inventar rótulo", () => {
  const estimativa = descreverCusto({ centavos: 3500n, rotulo: "estimativa", natureza: "estimativa" });
  assert.equal(estimativa.valor, "R$ 35,00");
  assert.equal(estimativa.rotulo, "estimativa");

  const combinado = descreverCusto({ centavos: 12000n, rotulo: "valor já combinado", natureza: "compromisso" });
  assert.equal(combinado.valor, "R$ 120,00");
  assert.equal(combinado.rotulo, "valor já combinado");
});

test("deslocamento é compacto: só mostra o que foi informado", () => {
  assert.equal(
    descreverDeslocamento({ minutos: 45, km: 12, custoCentavos: "6000", alerta: null }),
    "45 min · 12 km · R$ 60,00",
  );
  assert.equal(descreverDeslocamento({ minutos: 20, km: null, custoCentavos: null, alerta: null }), "20 min");
  assert.equal(descreverDeslocamento({ minutos: null, km: null, custoCentavos: null, alerta: null }), "");
});

test("duração não inventa zero: sem duração não há texto", () => {
  assert.equal(formatarDuracao(null), null);
  assert.equal(formatarDuracao(0), null);
  assert.equal(formatarDuracao(45), "45 min");
  assert.equal(formatarDuracao(60), "1h");
  assert.equal(formatarDuracao(90), "1h30");
});

test("dia do roteiro é legível em pt-BR e não escorrega de dia por fuso", () => {
  // 2026-12-20 é domingo; o horário fixo ao meio-dia UTC evita o dia anterior em fusos negativos.
  assert.match(formatarDiaCurto("2026-12-20"), /^dom, 20\/12$/);
  assert.match(formatarDiaLongo("2026-12-20"), /^domingo, 20 de dezembro/);
});

test("estado da atividade tem rótulo textual (nunca só a cor do marcador)", () => {
  assert.equal(ROTULO_ATIVIDADE.planejada, "Planejada");
  assert.equal(ROTULO_ATIVIDADE.concluida, "Concluída");
  assert.equal(ROTULO_ATIVIDADE.cancelada, "Cancelada");
});
