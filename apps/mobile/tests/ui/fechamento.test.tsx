/**
 * Fechamento e exportação na aba "Mais" (tela 21).
 *
 * O que este teste protege (decisões V1 §13):
 *  - os números vêm do servidor: a tela não soma dinheiro oficial por conta própria;
 *  - "acertos sugeridos" aparece como **sugestão** — a tela não dá a entender que alguém pagou;
 *  - exportar gera o arquivo no navegador e não muda nenhum registro;
 *  - sem conexão, a tela explica que o fechamento é do servidor, em vez de mostrar conta velha.
 */
import { botaoCom, clicar, esperarPor, esperarAtualizacoes, raizDoDocumento, textoDaTela } from "./ambiente.ts";
import { criarServidorFalso, type ViagemFalsa } from "./servidor-falso.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/App.tsx";
import { criarArmazenamentoIndexedDB } from "../../src/offline/armazenamento.ts";

let raizMontada: ReturnType<typeof createRoot> | null = null;

function montar(): void {
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

async function abrirMais(viagem: ViagemFalsa): Promise<{ servidor: ReturnType<typeof criarServidorFalso> }> {
  await criarArmazenamentoIndexedDB("lia-go").limpar();
  await esperarAtualizacoes(1);
  const servidor = criarServidorFalso([viagem]);
  (globalThis as Record<string, unknown>).fetch = servidor.fetch;

  montar();
  await esperarPor(() => textoDaTela().includes(viagem.nome), "a viagem aparecer");
  clicar(botaoCom(viagem.nome));
  await esperarPor(() => textoDaTela().includes("← Minhas viagens"), "a viagem abrir");
  clicar(botaoCom("Mais"));
  await esperarPor(() => textoDaTela().includes("Fechamento da viagem"), "a área Mais abrir");
  return { servidor };
}

const VIAGEM_COM_DESPESA: ViagemFalsa = {
  id: "v1",
  nome: "Serra",
  destino: "Campos do Jordão",
  estado: "em_andamento",
  versao: 1,
  papel: "organizador",
  despesas: [
    {
      id: "dp1",
      viagemId: "v1",
      descricao: "Jantar",
      valorCentavos: "20000",
      data: "2026-11-20",
      tipo: "compartilhada",
      estado: "confirmada",
      autorId: "u1",
    },
  ],
};

test("o fechamento traz os números do servidor, com o acerto como sugestão", async () => {
  await abrirMais(VIAGEM_COM_DESPESA);
  await esperarPor(() => Boolean(botaoCom("Ver fechamento")), "o botão de montar o fechamento aparecer");

  clicar(botaoCom("Ver fechamento"));
  await esperarPor(() => textoDaTela().includes("Saldo por pessoa"), "o fechamento carregar");

  const tela = textoDaTela();
  assert.match(tela, /Gasto confirmado \(oficial\)R\$ 200,00/, "o total é o que o servidor somou");
  assert.match(tela, /recebe R\$ 100,00/, "quem pagou a mais recebe");
  assert.match(tela, /deve R\$ 100,00/, "quem não pagou deve a parte");
  assert.match(tela, /Bruno → Ana: R\$ 100,00/, "o acerto vem do servidor, com nome de gente");
  assert.match(tela, /Ninguém pagou nada até alguém registrar o acerto/, "sugestão não é pagamento");
  assert.match(tela, /Quem soma é o servidor/, "a tela não finge calcular dinheiro");
});

test("exportar gera o arquivo no navegador e não muda nada nos registros", async () => {
  const { servidor } = await abrirMais(VIAGEM_COM_DESPESA);
  await esperarPor(() => Boolean(botaoCom("Ver fechamento")), "o botão de montar o fechamento aparecer");
  clicar(botaoCom("Ver fechamento"));
  await esperarPor(() => textoDaTela().includes("Exportar"), "a área de exportação aparecer");

  // O jsdom não baixa arquivo: aqui capturamos o Blob gerado, que é exatamente o conteúdo entregue
  // ao navegador de verdade (é o mesmo caminho do `<a download>`).
  const gerados: { blob: Blob; nome: string }[] = [];
  const url = URL as unknown as { createObjectURL?: (blob: Blob) => string; revokeObjectURL?: (endereco: string) => void };
  const original = url.createObjectURL;
  url.createObjectURL = (blob: Blob) => {
    gerados.push({ blob, nome: `blob:teste-${gerados.length}` });
    return `blob:teste-${gerados.length - 1}`;
  };
  url.revokeObjectURL = () => undefined;

  try {
    const chamadasAntes = servidor.chamadas.filter((chamada) => chamada.metodo !== "GET").length;

    clicar(botaoCom("Baixar resumo (.txt)"));
    await esperarPor(() => gerados.length === 1, "o arquivo de texto ser gerado");
    assert.match(textoDaTela(), /Arquivo lia-go-serra-\d{4}-\d{2}-\d{2}\.txt gerado no navegador/, "a tela confirma o que aconteceu");
    const texto = await gerados[0]!.blob.text();
    assert.ok(texto.includes("fechamento de Serra"), `o texto identifica a viagem: ${texto.slice(0, 80)}`);
    assert.ok(texto.includes("Acertos sugeridos (sugestão"), "e mantém o aviso de que é sugestão");

    clicar(botaoCom("Baixar planilha (.csv)"));
    await esperarPor(() => gerados.length === 2, "o arquivo de planilha ser gerado");
    const csv = await gerados[1]!.blob.text();
    assert.ok(csv.startsWith('"viagem";"data";"descricao"'), `o CSV vem com cabeçalho de planilha: ${csv.slice(0, 80)}`);
    assert.ok(csv.includes("Jantar"), "e com as despesas confirmadas");

    const chamadasDepois = servidor.chamadas.filter((chamada) => chamada.metodo !== "GET").length;
    assert.equal(chamadasDepois, chamadasAntes, "exportar é leitura: nada sobe para o servidor");

    // Sem download disponível (app do celular), a tela mostra o texto — nunca finge ter baixado.
    url.createObjectURL = undefined;
    clicar(botaoCom("Baixar resumo (.txt)"));
    await esperarPor(() => Boolean(raizDoDocumento.querySelector("#fechamento-texto")), "o texto aparecer para copiar");
    assert.match(textoDaTela(), /não existe download de arquivo/);
    assert.ok(
      raizDoDocumento.querySelector<HTMLTextAreaElement>("#fechamento-texto")?.value.includes("fechamento de Serra"),
      "o conteúdo continua completo no campo de copiar",
    );
  } finally {
    url.createObjectURL = original;
  }
});

test("sem servidor, a tela diz que o fechamento precisa dele (nada de conta velha) e permite exportar a cópia deste aparelho", async () => {
  await abrirMais(VIAGEM_COM_DESPESA);
  await esperarPor(() => Boolean(botaoCom("Ver fechamento")), "o botão de montar o fechamento aparecer");

  const gerados: { blob: Blob; nome: string }[] = [];
  const url = URL as unknown as { createObjectURL?: (blob: Blob) => string; revokeObjectURL?: (endereco: string) => void };
  const original = url.createObjectURL;
  url.createObjectURL = (blob: Blob) => {
    gerados.push({ blob, nome: `blob:local-${gerados.length}` });
    return `blob:local-${gerados.length - 1}`;
  };
  url.revokeObjectURL = () => undefined;

  try {
    (globalThis as Record<string, unknown>).fetch = () => Promise.reject(new Error("sem rede"));
    clicar(botaoCom("Ver fechamento"));
    await esperarPor(() => textoDaTela().includes("Não foi possível montar o fechamento"), "o aviso de falha aparecer");
    assert.match(textoDaTela(), /é calculado no servidor/, "explica por que não dá sem conexão");
    assert.ok(!textoDaTela().includes("R$ 200,00"), "não mostra número oficial velho como se fosse atual");

    clicar(botaoCom("Baixar cópia deste aparelho (.txt)"));
    await esperarPor(() => gerados.length === 1, "a cópia local em .txt ser gerada sem rede");
    const txtLocal = await gerados[0]!.blob.text();
    assert.match(txtLocal, /cópia guardada neste aparelho de Serra/, "identifica a cópia local");
    assert.match(txtLocal, /não substitui o fechamento oficial/, "deixa claro que não veio do servidor");

    clicar(botaoCom("Baixar cópia deste aparelho (.csv)"));
    await esperarPor(() => gerados.length === 2, "a cópia local em .csv ser gerada sem rede");
    const csvLocal = await gerados[1]!.blob.text();
    assert.match(csvLocal, /copia_deste_aparelho_sem_servidor/, "marca a origem local no CSV");
    assert.match(csvLocal, /Jantar/, "inclui as despesas guardadas no aparelho");
  } finally {
    url.createObjectURL = original;
  }
});

