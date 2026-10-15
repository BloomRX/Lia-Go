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
 */
import { rolldown } from "rolldown";
import { mkdir, rm, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pastaTestes = path.join(raiz, "apps/mobile/tests/ui");
const pastaSaida = path.join(raiz, "apps/mobile/.ui-testes");

/**
 * Imagens entram no bundle como uma string (o caminho do arquivo).
 *
 * O jsdom não desenha imagem nenhuma, então o teste só precisa que o `import` exista — mas o
 * rolldown, sem o plugin de assets do Vite, não sabe ler `.jpg`/`.png` e o bundle inteiro falhava
 * com "stream did not contain valid UTF-8". Aqui a imagem vira um módulo que exporta o caminho.
 */
const imagens = [".jpg", ".jpeg", ".png", ".svg", ".webp", ".gif"];
const pluginDeImagem = {
  name: "imagem-como-string",
  resolveId(origem) {
    const [caminho] = origem.split("?");
    return imagens.includes(path.extname(caminho).toLowerCase()) ? { id: caminho, external: false } : null;
  },
  load(id) {
    return imagens.includes(path.extname(id).toLowerCase()) ? `export default ${JSON.stringify(id)};` : null;
  },
};

async function empacotar(entrada, saida) {
  const pacote = await rolldown({
    input: entrada,
    plugins: [pluginDeImagem],
    // Pacotes de terceiros ficam de fora: o Node resolve do node_modules na hora de rodar.
    external: (id) => !id.startsWith(".") && !path.isAbsolute(id),
    resolve: { extensions: [".ts", ".tsx", ".js", ".mjs", ".json"] },
  });
  const { output } = await pacote.generate({ format: "esm", codeSplitting: false });
  const codigo = output.find((parte) => parte.type === "chunk")?.code ?? "";
  await import("node:fs/promises").then((fs) => fs.writeFile(saida, codigo, "utf8"));
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

const processo = spawn(process.execPath, ["--test", "--test-concurrency=1", ...gerados], { stdio: "inherit", cwd: raiz });
processo.on("exit", (codigo) => process.exit(codigo ?? 0));
