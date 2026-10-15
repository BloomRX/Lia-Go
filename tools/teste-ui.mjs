#!/usr/bin/env node
/**
 * Roda os testes de interface (jsdom) sem precisar de navegador.
 *
 * O motivo de existir: `.tsx` tem JSX, e o Node só entende TypeScript puro. Aqui o teste é
 * empacotado (rolldown, o mesmo do Vite) num arquivo `.mjs` e só então o `node --test` roda.
 *
 * Os arquivos rodam **um por vez** (`--test-concurrency=1`): cada teste monta o app inteiro em
 * jsdom, e dois em paralelo deixavam a máquina lenta o bastante para um fluxo com espera de rede
 * estourar o prazo (teste instável é teste que mente). Sequencial custa poucos segundos e o
 * resultado reflete o que a pessoa vê.
 *
 * Nada de imagem/asset aqui dentro: imagem é import de módulo e o rolldown (sem o plugin de assets
 * do Vite) não sabe ler `.jpg`/`.png`. As imagens do app ficam em `apps/mobile/public/` e são
 * servidas como arquivo — o empacotador nunca precisa entendê-las.
 *
 * **Quando um arquivo não carrega**, o `node --test` só diz "test failed", sem o motivo (foi o que
 * aconteceu na rodada do Windows em 2026-10-15: 8 arquivos falhando e nenhuma pista no relatório).
 * Por isso existe `explicarFalhas`: ele roda o arquivo com `node` puro, mostra o erro de verdade e
 * grava tudo em `reports/interface-diagnostico.md`, para quem for corrigir ler sem adivinhar.
 */
import { rolldown } from "rolldown";
import { arquivosQueFalharam } from "./dev-util.mjs";
import { mkdir, rm, readdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pastaTestes = path.join(raiz, "apps/mobile/tests/ui");
const pastaSaida = path.join(raiz, "apps/mobile/.ui-testes");
const diagnostico = path.join(raiz, "reports", "interface-diagnostico.md");

async function empacotar(entrada, saida) {
  const pacote = await rolldown({
    input: entrada,
    // Pacotes de terceiros ficam de fora: o Node resolve do node_modules na hora de rodar.
    external: (id) => !id.startsWith(".") && !path.isAbsolute(id),
    resolve: { extensions: [".ts", ".tsx", ".js", ".mjs", ".json"] },
  });
  const { output } = await pacote.generate({ format: "esm", codeSplitting: false });
  const codigo = output.find((parte) => parte.type === "chunk")?.code ?? "";
  await writeFile(saida, codigo, "utf8");
}

/**
 * Uma passada com duas saídas ao mesmo tempo: o texto que o `node --test` escreve aparece na tela
 * (a pessoa vê igual a antes) e fica guardado para montar o diagnóstico quando algo falhar.
 */
function rodarAoVivo(comando, argumentos) {
  return new Promise((resolver) => {
    const processo = spawn(comando, argumentos, { cwd: raiz, stdio: ["ignore", "pipe", "pipe"] });
    let saida = "";
    const acumular = (destino) => (pedaco) => {
      const texto = pedaco.toString();
      saida += texto;
      destino.write(texto);
    };
    processo.stdout?.on("data", acumular(process.stdout));
    processo.stderr?.on("data", acumular(process.stderr));
    processo.on("exit", (codigo) => resolver({ codigo: codigo ?? 0, saida }));
  });
}

/**
 * Explica cada arquivo que falhou rodando-o direto com `node`.
 *
 * Rodar direto (sem o runner de testes) faz o erro de carregamento aparecer com a mensagem e a
 * pilha de verdade — que é o que falta quando o `node --test` só reporta o arquivo inteiro.
 */
async function explicarFalhas(nomes, arquivos) {
  const explicacoes = [];
  for (const nome of nomes.slice(0, 3)) {
    const caminho = path.join(pastaSaida, nome);
    if (!arquivos.includes(caminho)) continue;
    const { saida } = await rodarAoVivo(process.execPath, [caminho]);
    const linhas = saida.split(/\r?\n/).filter((linha) => linha.trim() !== "");
    // O que interessa: a mensagem de erro e as primeiras linhas da pilha (o resto é TAP de teste).
    const relevantes = linhas.filter((linha) => /error|erro|cannot|não|not found|unexpected|undefined|invalid/i.test(linha)).slice(0, 12);
    explicacoes.push({ nome, linhas: (relevantes.length > 0 ? relevantes : linhas.slice(0, 12)).join("\n") });
  }
  return explicacoes;
}

async function gravarDiagnostico(explicacoes, placar) {
  await mkdir(path.dirname(diagnostico), { recursive: true });
  const conteudo = [
    "# Testes de interface: por que falharam (gerado automaticamente)",
    "",
    `- **Quando:** ${new Date().toISOString()} (local ${new Date().toLocaleString("pt-BR")})`,
    `- **Node:** ${process.version} · **Sistema:** ${process.platform} ${process.arch}`,
    `- **Placar:** ${placar}`,
    "",
    "Cada bloco abaixo é o arquivo de teste rodado **direto** com `node` (sem o runner): é onde o erro",
    "de carregamento aparece com a mensagem de verdade.",
    "",
    ...explicacoes.flatMap((explicacao) => [`## ${explicacao.nome}`, "", "```", explicacao.linhas, "```", ""]),
  ].join("\n");
  await writeFile(diagnostico, conteudo, "utf8");
  return diagnostico;
}

const filtro = process.argv[2];
// Arquivos de depuração (`_*.test.tsx`) só rodam quando pedidos de propósito: nunca fazem parte da suíte.
const incluirDebug = process.env.LIA_TESTE_UI_DEBUG === "1";
const arquivos = (await readdir(pastaTestes)).filter(
  (nome) => nome.endsWith(".test.tsx") && (incluirDebug || !nome.startsWith("_")) && (filtro === undefined || nome.includes(filtro)),
);
if (arquivos.length === 0) {
  console.log("Nenhum teste de interface encontrado.");
  process.exit(0);
}

await rm(pastaSaida, { recursive: true, force: true });
await mkdir(pastaSaida, { recursive: true });

const gerados = [];
for (const arquivo of arquivos) {
  const destino = path.join(pastaSaida, arquivo.replace(/\.tsx$/, ".mjs"));
  await empacotar(path.join(pastaTestes, arquivo), destino);
  gerados.push(destino);
}

const { codigo, saida } = await rodarAoVivo(process.execPath, ["--test", "--test-concurrency=1", ...gerados]);
if (codigo === 0) process.exit(0);

// Falhou: separa "teste que falhou" de "arquivo que nem carregou" e explica o segundo caso.
const placar = [...saida.matchAll(/^\s*(?:#|ℹ️?)\s*(pass|fail)\s+(\d+)\b/gm)].map((m) => `${m[1]} ${m[2]}`);
const nomes = arquivosQueFalharam(saida);
const explicacoes = await explicarFalhas(nomes, gerados);
if (explicacoes.length > 0) {
  console.log("\n==================== POR QUE NÃO CARREGOU ====================");
  for (const explicacao of explicacoes) {
    console.log(`\n${explicacao.nome}:\n${explicacao.linhas}`);
  }
  const caminho = await gravarDiagnostico(explicacoes, placar.join(" · "));
  console.log(`\nDetalhes em ${path.relative(raiz, caminho)} (vai junto no relatório da rodada).`);
  console.log("==============================================================");
}
process.exit(codigo);
