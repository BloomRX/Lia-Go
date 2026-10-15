/**
 * Tela de detalhes da atividade em jsdom: a revisão de impacto aparece **antes** do botão que muda
 * (decisões V1 §13) e o dinheiro oficial não é calculado na tela.
 *
 * O teste roda o app inteiro (App.tsx) com servidor falso e IndexedDB de verdade.
 */
import { botaoCom, clicar, digitar, elemento, escolher, esperarPor, esperarAtualizacoes, raizDoDocumento, textoDaTela } from "./ambiente.ts";
import { criarServidorFalso } from "./servidor-falso.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/App.tsx";
import { CHAVE_CARGA, criarArmazenamentoIndexedDB } from "../../src/offline/armazenamento.ts";

/** Reserva da viagem (o mesmo objeto que o servidor devolve, em camelCase). */
function reserva(parcial: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "r1",
    viagemId: "v1",
    autorId: "u1",
    tipo: "hospedagem",
    titulo: "Pousada da serra",
    local: "Centro",
    inicio: "2026-11-20T14:00:00-03:00",
    fim: null,
    custoCentavos: "90000",
    custoAVerificar: false,
    confirmacao: null,
    confirmadaPor: null,
    confirmadaEm: null,
    estado: "prevista",
    motivoCancelamento: null,
    versao: 1,
    ...parcial,
  };
}

const VIAGEM = {
  id: "v1",
  nome: "Serra",
  destino: "Campos do Jordão",
  estado: "planejada" as const,
  versao: 1,
  papel: "organizador" as const,
  atividades: [
    {
      id: "a1",
      viagemId: "v1",
      dia: "2026-11-20",
      ordem: 1,
      titulo: "Passeio de trem",
      hora: "09:00",
      duracaoMinutos: 90,
      local: "Estação",
      custo: { centavos: "12000", natureza: "compromisso", aVerificar: false },
      estado: "planejada",
      observacao: null,
      deslocamento: null,
      versao: 1,
    },
  ],
};

let raizMontada: ReturnType<typeof createRoot> | null = null;

function montar(): void {
  // Cada teste monta o app do zero e usa um ponto novo, para a tela de um teste não vazar no outro.
  raizMontada?.unmount();
  raizMontada = null;
  const antiga = raizDoDocumento.getElementById("raiz");
  antiga?.remove();
  const nova = raizDoDocumento.createElement("div");
  nova.id = "raiz";
  raizDoDocumento.body.append(nova);
  raizMontada = createRoot(nova);
  raizMontada.render(createElement(App));
}

/**
 * Limpa o aparelho **depois** que a sincronização do teste anterior terminou.
 *
 * Sem essa espera a limpeza acontecia com uma passada ainda em voo: ela terminava depois, gravava a
 * carga antiga e o teste seguinte via os dados do outro (foi assim que a reserva de um teste apareceu
 * no lugar da reserva do seguinte). Limpar duas vezes é barato e fecha a janela.
 */
async function limparAparelho(): Promise<void> {
  await esperarAtualizacoes(4);
  await criarArmazenamentoIndexedDB("lia-go").limpar();
  await esperarAtualizacoes(2);
  await criarArmazenamentoIndexedDB("lia-go").limpar();
  await esperarAtualizacoes(1);
}

async function abrirViagem(viagem: typeof VIAGEM = VIAGEM): Promise<void> {
  await limparAparelho();
  const servidor = criarServidorFalso([viagem]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes("Serra"), "a viagem aparecer");
  clicar(botaoCom("Serra"));
  await esperarPor(() => textoDaTela().includes("Roteiro"), "a viagem abrir");
  clicar(botaoCom("Roteiro"));
  // A aba Roteiro pode estar vazia (o teste pode criar a primeira atividade): o sinal de que ela
  // abriu é o próprio roteiro, não uma atividade específica.
  await esperarPor(
    () => textoDaTela().includes("Nova atividade") || textoDaTela().includes("Passeio de trem"),
    "a aba Roteiro abrir",
  );
}

async function abrirAtividade(viagem: typeof VIAGEM = VIAGEM): Promise<void> {
  await abrirViagem(viagem);
  clicar(botaoCom("Passeio de trem"));
  await esperarPor(() => textoDaTela().includes("Antes de continuar"), "os detalhes da atividade abrirem");
}

/** Viagem com a atividade vinculada a uma reserva (e observação registrada). */
function viagemComAtividade(parcialAtividade: Record<string, unknown>, reservas: Record<string, unknown>[]): typeof VIAGEM {
  return {
    ...VIAGEM,
    reservas,
    atividades: [{ ...VIAGEM.atividades[0]!, ...parcialAtividade }],
  } as typeof VIAGEM;
}

test("concluir mostra a revisão de impacto antes do botão e diz que o saldo oficial não muda aqui", async () => {
  await abrirAtividade();

  const tela = textoDaTela();
  assert.match(tela, /Antes de continuar: o que isso muda/);
  assert.match(tela, /quem concluiu/, "diz quem fica registrado");
  assert.match(tela, /planejado não é gasto/);
  assert.match(tela, /saldo oficial não se altera aqui/, "nada de insinuar pagamento/confirmação");
  assert.match(tela, /Marcar como concluída/, "o botão continua ali, só depois da revisão");
  // A revisão vem antes do botão na tela (é "antes de continuar", não um aviso depois do estrago).
  assert.ok(tela.indexOf("Antes de continuar") < tela.indexOf("Marcar como concluída"));
});

test("cancelar mostra quanto sai do previsto e que o histórico e as despesas ficam", async () => {
  await abrirAtividade();

  clicar(botaoCom("Cancelar atividade"));
  await esperarAtualizacoes(2);

  const tela = textoDaTela();
  assert.match(tela, /R\$ 120,00 deixam de ser contados/, "o valor que sai do previsto aparece");
  assert.match(tela, /não pode ser apagado/, "o motivo fica no histórico");
  assert.match(tela, /despesas já registradas continuam iguais/);
  assert.match(tela, /compromisso assumido fora do app/, "não finge que desfez um compromisso");
});

test("sem digitar o motivo, cancelar avisa o que falta e não muda nada", async () => {
  await abrirAtividade();

  clicar(botaoCom("Cancelar atividade"));
  await esperarAtualizacoes(2);

  assert.match(textoDaTela(), /Explique o motivo do cancelamento/);
  assert.ok(botaoCom("Cancelar atividade"), "a atividade continua planejada: nenhum cancelamento silencioso");
});

// ---------------------------------------------------------------------------
// Reserva vinculada e observações (diretriz §2.1: a ficha guarda o que não é horário)
// ---------------------------------------------------------------------------

test("atividade vinculada mostra a reserva e avisa que prevista não é confirmada", async () => {
  await abrirAtividade(
    viagemComAtividade({ reservaId: "r1", observacao: "Levar água e bota" }, [reserva()]),
  );

  const tela = textoDaTela();
  assert.match(tela, /Reserva/);
  assert.match(tela, /Hospedagem: Pousada da serra/);
  assert.match(tela, /Prevista/);
  assert.match(tela, /ainda está prevista/);
  assert.match(tela, /O Lia Go não confirma reserva por conta própria/, "nada de insinuar reserva confirmada (§13)");
  assert.match(tela, /Levar água e bota/, "a observação aparece na ficha");
});

test("reserva confirmada mostra a evidência que existe — sem inventar localizador", async () => {
  await abrirAtividade(
    viagemComAtividade({ reservaId: "r1" }, [
      reserva({ estado: "confirmada", confirmacao: "LOC-88231", confirmadaEm: "2026-11-01T10:00:00Z", confirmadaPor: "u1" }),
    ]),
  );

  const tela = textoDaTela();
  assert.match(tela, /Evidência da confirmação: LOC-88231/);
  assert.match(tela, /Confirmada/);
});

test("atividade aponta para reserva que ainda não está no aparelho: a tela diz isso, não inventa", async () => {
  await abrirAtividade(viagemComAtividade({ reservaId: "r9" }, [reserva()]));

  assert.match(textoDaTela(), /aponta para uma reserva que ainda não está neste aparelho/);
});

test("corrigir a observação pela ficha: vale na hora e sobe com o motivo", async () => {
  await abrirAtividade(viagemComAtividade({ reservaId: "r1", observacao: "Levar água" }, [reserva()]));

  clicar(botaoCom("Corrigir dados"));
  await esperarAtualizacoes(2);
  const campo = elemento<HTMLTextAreaElement>("#ajuste-observacao");
  assert.ok(campo, "o campo de observações precisa existir na correção");
  assert.equal(campo.value, "Levar água", "o formulário abre com o que existe hoje");
  await digitar(campo, "Levar água e protetor solar");
  await digitar(elemento<HTMLInputElement>("#ajuste-motivo")!, "Combinamos de levar protetor");

  clicar(botaoCom("Salvar correção"));
  await esperarPor(() => textoDaTela().includes("Levar água e protetor solar"), "a observação nova aparecer", 5000);
  assert.match(textoDaTela(), /Hospedagem: Pousada da serra/, "a reserva vinculada continua vinculada");
});

test("criar atividade com observação e reserva: o cartão do roteiro já diz que a reserva é prevista", async () => {
  const viagem = { ...VIAGEM, reservas: [reserva()], atividades: [] } as typeof VIAGEM;
  await abrirViagem(viagem);
  assert.match(textoDaTela(), /Nenhuma atividade ainda/);

  clicar(botaoCom("Nova atividade"));
  await esperarPor(() => textoDaTela().includes("O que vai acontecer"), "o formulário abrir");
  await digitar(elemento<HTMLInputElement>("#atividade-titulo")!, "Check-in na pousada");
  await digitar(elemento<HTMLTextAreaElement>("#atividade-observacao")!, "Chegar antes das 18h");
  const seletor = elemento<HTMLSelectElement>("#atividade-reserva");
  assert.ok(seletor, "o formulário precisa oferecer a reserva da viagem");
  await escolher(seletor, "r1");
  assert.match(textoDaTela(), /Vincular não confirma a reserva/);

  clicar(botaoCom("Guardar atividade"));
  await esperarPor(() => textoDaTela().includes("Check-in na pousada"), "a atividade aparecer no roteiro", 5000);
  assert.match(textoDaTela(), /Reserva prevista: Pousada da serra/, "a atividade vinculada mostra a reserva no cartão");

  clicar(botaoCom("Check-in na pousada"));
  await esperarPor(() => textoDaTela().includes("Quando e onde"), "a ficha da atividade abrir", 5000);
  assert.match(textoDaTela(), /Chegar antes das 18h/, "a observação foi guardada de verdade");
  assert.match(textoDaTela(), /Hospedagem: Pousada da serra/);
});
