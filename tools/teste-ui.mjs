#!/usr/bin/env node
/**
 * Roda os testes de interface (jsdom) sem precisar de navegador.
 *
 * O motivo de existir: `.tsx` tem JSX, e o Node só entende TypeScript puro. Aqui o teste é
 * empacotado (rolldown, o mesmo do Vite) num arquivo `.mjs` e só então o `node --test` roda.
 */
import { rolldown } from "rolldown";
import { mkdir, rm, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pastaTestes = path.join(raiz, "apps/mobile/tests/ui");
const pastaSaida = path.join(raiz, "apps/mobile/.ui-testes");

async function empacotar(entrada, saida) {
  const pacote = await rolldown({
    input: entrada,
    // Pacotes de terceiros ficam de fora: o Node resolve do node_modules na hora de rodar.
    external: (id) => !id.startsWith(".") && !path.isAbsolute(id),
    resolve: { extensions: [".ts", ".tsx", ".js", ".mjs", ".json"] },
  });
  const { output } = await pacote.generate({ format: "esm", codeSplitting: false });
  const codigo = output.find((parte) => parte.type === "chunk")?.code ?? "";
  await import("node:fs/promises").then((fs) => fs.writeFile(saida, codigo, "utf8"));
}

const filtro = process.argv[2];
const arquivos = (await readdir(pastaTestes)).filter(
  (nome) => nome.endsWith(".test.tsx") && !nome.startsWith("_") && (filtro === undefined || nome.includes(filtro)),
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

const processo = spawn(process.execPath, ["--test", ...gerados], { stdio: "inherit", cwd: raiz });
processo.on("exit", (codigo) => process.exit(codigo ?? 0));
