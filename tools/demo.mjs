#!/usr/bin/env node
/**
 * Conta e viagem de demonstração — para olhar a interface sem cadastrar nada.
 *
 * Existe porque o ambiente de demonstração (o sandbox do agente) **não guarda** o banco local nem as
 * dependências: quando o ambiente reinicia, o PostgreSQL volta vazio e a conta criada à mão deixa de
 * existir — foi exatamente o que aconteceu em 2026-10-16, e o login passou a responder "E-mail ou
 * senha incorretos" para quem só queria ver a tela.
 *
 * Uso (com a API no ar):
 *   node tools/demo.mjs                 # cria/recria a conta e a viagem de exemplo
 *   LIA_DEMO_API=http://127.0.0.1:3000  # endereço da API (padrão: este)
 *
 * É **idempotente**: se a conta já existe, entra; se a viagem de exemplo já está lá, não duplica.
 * Nada aqui toca os dados de outra conta, e o script só fala com a API pública — as mesmas rotas
 * que o app usa — em vez de escrever no banco por fora.
 */
import { randomUUID } from "node:crypto";

const API = process.env.LIA_DEMO_API ?? "http://127.0.0.1:3000";
const EMAIL = process.env.LIA_DEMO_EMAIL ?? "demo@lia.go";
const SENHA = process.env.LIA_DEMO_SENHA ?? "lia-go-demo-2026";
const NOME = "Ana Demonstração";
const VIAGEM = { nome: "Serra com os amigos", destino: "Campos do Jordão", dataInicio: "2026-11-20", dataFim: "2026-11-22" };

/** Cookie de sessão da API (o mesmo que o navegador guarda). */
let cookie = "";

async function pedir(caminho, opcoes = {}) {
  const resposta = await fetch(`${API}${caminho}`, {
    ...opcoes,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(opcoes.headers ?? {}) },
  });
  const guardado = resposta.headers.getSetCookie?.() ?? [];
  if (guardado.length > 0) cookie = guardado.map((linha) => linha.split(";")[0]).join("; ");
  const texto = await resposta.text();
  const corpo = texto ? JSON.parse(texto) : {};
  if (!resposta.ok) throw new Error(`${opcoes.method ?? "GET"} ${caminho} → ${resposta.status} ${corpo.mensagem ?? texto}`);
  return corpo;
}

async function garantirConta() {
  try {
    await pedir("/auth/login", { method: "POST", body: JSON.stringify({ email: EMAIL, senha: SENHA }) });
    console.log(`Conta já existia: ${EMAIL}`);
    return;
  } catch (falha) {
    if (!/401|400/.test(falha.message)) throw falha;
  }
  await pedir("/auth/registro", { method: "POST", body: JSON.stringify({ nome: NOME, email: EMAIL, senha: SENHA }) });
  console.log(`Conta criada: ${EMAIL} / ${SENHA}`);
}

async function garantirViagem() {
  const lista = await pedir("/viagens");
  const existente = (lista.viagens ?? []).find((viagem) => viagem.nome === VIAGEM.nome);
  if (existente) {
    console.log(`Viagem de exemplo já existia: ${VIAGEM.nome} (${existente.id})`);
    return existente.id;
  }

  const criada = await pedir("/viagens", { method: "POST", body: JSON.stringify(VIAGEM) });
  const viagemId = criada.id;
  console.log(`Viagem criada: ${VIAGEM.nome} (${viagemId})`);

  const atividades = [
    { titulo: "Check-in na pousada", dia: "2026-11-20", hora: "15:00", local: "Centro", duracaoMinutos: 30, idempotencia: randomUUID() },
    { titulo: "Passeio de trem", dia: "2026-11-21", hora: "09:00", local: "Estação", duracaoMinutos: 120, custoCentavos: "12000", natureza: "compromisso", observacao: "Levar água e bota", idempotencia: randomUUID() },
    { titulo: "Jantar no centro", dia: "2026-11-21", local: "Rua das Flores", custoCentavos: "8000", natureza: "estimativa", idempotencia: randomUUID() },
    { titulo: "Trilha do mirante", dia: "2026-11-22", hora: "08:30", duracaoMinutos: 180, idempotencia: randomUUID() },
  ];
  for (const atividade of atividades) {
    await pedir(`/viagens/${viagemId}/atividades`, { method: "POST", body: JSON.stringify(atividade) });
  }
  console.log(`Atividades criadas: ${atividades.length}`);

  await pedir(`/viagens/${viagemId}/reservas`, {
    method: "POST",
    body: JSON.stringify({
      tipo: "hospedagem",
      titulo: "Pousada da serra",
      local: "Centro",
      inicio: "2026-11-20T15:00:00-03:00",
      custoCentavos: "90000",
      estado: "prevista",
      idempotencia: randomUUID(),
    }),
  });
  console.log("Reserva prevista criada: Pousada da serra");
  return viagemId;
}

try {
  console.log(`Preparando a demonstração em ${API}…`);
  await garantirConta();
  await garantirViagem();
  console.log("\nPronto. Entre com:");
  console.log(`  e-mail: ${EMAIL}`);
  console.log(`  senha:  ${SENHA}`);
} catch (falha) {
  console.error(`\nNão foi possível preparar a demonstração: ${falha.message}`);
  console.error("A API está no ar? (npm run dev:api) O banco foi migrado? (npm run migrate)");
  process.exit(1);
}
