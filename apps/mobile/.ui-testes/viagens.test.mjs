import { JSDOM } from "jsdom";
import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { CATEGORIAS_CHECKLIST, ROTULO_CATEGORIA_CHECKLIST, ROTULO_ESTADO_ORCAMENTO, ROTULO_ESTADO_RESERVA, ROTULO_TIPO_DOCUMENTO, ROTULO_TIPO_RESERVA, TIPOS_DE_DOCUMENTO, agruparPorDia, cancelarReserva, concluirItem, confirmarReserva, conflitosDoDia, criarItemChecklist, criarReserva, itemAtrasado, itemParaHoje, ordenarChecklist, ordenarReservas, podeVerDocumento, reabrirItem, resumirChecklist, resumirDia, resumirDocumentos, resumirOrcamentoDoRoteiro, resumirReservas, revisarImpacto, revisarImpactoDaReserva, situacaoDoOrcamento } from "@lia-go/domain";
import { cargaCompleta, cargaVazia, compararParaDecisao, descartar, enfileirar, filaVazia, mesclarCarga, resumoFila, retentar, sincronizar, trocarViagemAberta } from "@lia-go/sync";
//#region tests/ui/ambiente.ts
/**
* Ambiente de navegador para os testes de interface (jsdom), sem baixar navegador de verdade.
*
* Este módulo precisa ser o **primeiro** import de qualquer teste de UI: ele cria `window`,
* `document`, `indexedDB` (fake-indexeddb) e um `fetch` que fala com a API real do teste.
* Como o bundle é um arquivo só, a ordem dos `import` é a ordem de execução.
*/
const janela = new JSDOM("<!doctype html><html><body><div id=\"raiz\"></div></body></html>", {
	url: "http://localhost:5273/",
	pretendToBeVisual: true
}).window;
/** `navigator`/`location` são getters no Node moderno: definir precisa de defineProperty. */
function definirGlobal(nome, valor) {
	Object.defineProperty(globalThis, nome, {
		value: valor,
		configurable: true,
		writable: true
	});
}
for (const nome of [
	"window",
	"document",
	"navigator",
	"location",
	"history",
	"HTMLElement",
	"HTMLInputElement",
	"Element",
	"Node",
	"Event",
	"MouseEvent",
	"CustomEvent",
	"getComputedStyle",
	"requestAnimationFrame",
	"localStorage"
]) definirGlobal(nome, janela[nome]);
definirGlobal("IS_REACT_ACT_ENVIRONMENT", false);
const raizDoDocumento = janela.document;
/**
* Promessa rejeitada sem tratamento é o defeito que fez o botão "Sair" parecer morto:
* a tela não muda e ninguém vê o erro. Aqui ela vira uma mensagem legível no teste.
*/
process.on("unhandledRejection", (motivo) => {
	const erro = motivo instanceof Error ? motivo : new Error(String(motivo));
	console.error("PROMESSA NÃO TRATADA:", erro.message, "\n", erro.stack);
});
/** Espera o React terminar de aplicar o efeito de um clique/estado. */
async function esperarAtualizacoes(voltas = 6) {
	for (let i = 0; i < voltas; i += 1) await new Promise((resolver) => setTimeout(resolver, 0));
}
/** Texto visível da tela, sem espaços repetidos (é o que a pessoa lê). */
function textoDaTela() {
	return (raizDoDocumento.body.textContent ?? "").replace(/\s+/g, " ").trim();
}
/** Espera até o texto da tela satisfazer a condição — evita depender de número de voltas. */
async function esperarPor(condicao, descricao = "a tela mudar", limiteMs = 3e3) {
	const inicio = Date.now();
	while (Date.now() - inicio < limiteMs) {
		if (condicao()) return;
		await new Promise((resolver) => setTimeout(resolver, 5));
	}
	throw new Error(`Tempo esgotado esperando ${descricao}. Tela atual: ${textoDaTela().slice(0, 300)}`);
}
/** Clica como uma pessoa clica: evento de verdade, subindo pelo DOM. */
function clicar(elemento) {
	if (!elemento) throw new Error("Não encontrei o elemento para clicar.");
	elemento.dispatchEvent(new globalThis.MouseEvent("click", {
		bubbles: true,
		cancelable: true
	}));
}
/**
* Digita num campo de texto.
*
* Detalhe do ambiente: o React 19 não entrega eventos nativos de digitação (`input`/`change`) no
* jsdom — só `click`. Então escrevemos o valor no campo (como o navegador faz) e chamamos o
* manipulador `onChange` do próprio React, que é exatamente o caminho que o app seguiria num
* navegador de verdade: mesmo manipulador, mesmo estado, mesmo envio.
*/
async function digitar(campo, texto) {
	(Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set)?.call(campo, texto);
	const chave = Object.keys(campo).find((nome) => nome.startsWith("__reactProps$"));
	const props = chave ? campo[chave] : void 0;
	if (props?.onChange) props.onChange({
		target: campo,
		currentTarget: campo,
		type: "change"
	});
	else campo.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
	await esperarAtualizacoes(2);
}
/** Procura um botão pelo texto exato (ou um trecho dele). */
function botaoCom(texto, raiz = raizDoDocumento) {
	return Array.from(raiz.querySelectorAll("button")).find((botao) => (botao.textContent ?? "").trim().includes(texto)) ?? null;
}
//#endregion
//#region tests/ui/servidor-falso.ts
const PARTICIPANTE = {
	usuario_id: "u1",
	nome: "Ana",
	papel: "organizador",
	estado: "ativo"
};
function criarServidorFalso(viagens, usuarioId = "u1") {
	const estado = {
		viagens,
		chamadas: [],
		encerrado: false,
		fetch: () => Promise.reject(/* @__PURE__ */ new Error("não pronto"))
	};
	function resumo(viagem) {
		return {
			id: viagem.id,
			nome: viagem.nome,
			destino: viagem.destino,
			data_inicio: null,
			data_fim: null,
			fuso_horario: "America/Sao_Paulo",
			moeda: "BRL",
			estado: viagem.estado,
			versao: viagem.versao,
			papel: viagem.papel,
			pendencias_financeiras: 0
		};
	}
	function json(corpo, status = 200) {
		return new Response(JSON.stringify(corpo), {
			status,
			headers: { "content-type": "application/json" }
		});
	}
	function encontrar(caminho) {
		const id = caminho.split("/")[3];
		return estado.viagens.find((viagem) => viagem.id === id);
	}
	estado.fetch = (async (entrada, init) => {
		const url = new URL(String(entrada), "http://localhost:5273");
		const caminho = url.pathname;
		const metodo = init?.method ?? "GET";
		estado.chamadas.push({
			metodo,
			caminho: caminho + url.search
		});
		if (caminho === "/api/auth/sessao") return json({ usuario: {
			id: usuarioId,
			nome: "Ana",
			email: "ana@exemplo.com"
		} });
		if (caminho === "/api/auth/logout") {
			estado.encerrado = true;
			return new Response(null, { status: 204 });
		}
		if (caminho === "/api/viagens" && metodo === "GET") return json({
			viagens: estado.viagens.map(resumo),
			convitesPendentes: []
		});
		if (caminho === "/api/viagens" && metodo === "POST") {
			const corpo = JSON.parse(String(init?.body ?? "{}"));
			const nova = {
				id: `v${estado.viagens.length + 1}`,
				nome: corpo.nome ?? "sem nome",
				destino: corpo.destino ?? "",
				estado: "rascunho",
				versao: 1,
				papel: "organizador"
			};
			estado.viagens.push(nova);
			return json({
				id: nova.id,
				estado: "rascunho"
			});
		}
		const viagem = encontrar(caminho);
		if (!viagem) return json({
			erro: "nao_encontrada",
			mensagem: "Viagem não encontrada."
		}, 404);
		if (caminho.endsWith("/mudancas")) return json({
			cursor: String(Number(url.searchParams.get("desde") ?? "0") + 1),
			temMais: false,
			mudancas: 1,
			viagem: resumo(viagem),
			papel: viagem.papel,
			participantes: [PARTICIPANTE],
			pendencias: {
				despesas: 0,
				convites: 0
			},
			sugestao: null,
			permissoes: {
				editar: {
					permitido: true,
					motivo: "ok"
				},
				cancelar: {
					permitido: true,
					motivo: "ok"
				},
				convidar: {
					permitido: true,
					motivo: "ok"
				},
				registrarDespesa: {
					permitido: viagem.estado !== "cancelada",
					motivo: "ok"
				},
				criarReserva: {
					permitido: viagem.estado === "rascunho" || viagem.estado === "planejada" || viagem.estado === "em_andamento",
					motivo: "ok"
				},
				confirmarReserva: {
					permitido: true,
					motivo: "ok"
				},
				cancelarReserva: {
					permitido: viagem.estado !== "cancelada",
					motivo: "ok"
				},
				definirLimite: {
					permitido: viagem.papel === "organizador",
					motivo: "ok"
				},
				definirLimiteProprio: {
					permitido: true,
					motivo: "ok"
				},
				criarItemChecklist: {
					permitido: viagem.estado !== "cancelada",
					motivo: "ok"
				},
				concluirItemChecklist: {
					permitido: true,
					motivo: "ok"
				},
				criarDocumento: {
					permitido: viagem.estado !== "cancelada",
					motivo: "ok"
				},
				exportar: {
					permitido: true,
					motivo: "ok"
				},
				transicoesPermitidas: []
			},
			despesas: viagem.despesas ?? [],
			movimentos: [],
			convites: [],
			atividades: viagem.atividades ?? [],
			reservas: viagem.reservas ?? [],
			itensChecklist: viagem.checklist ?? [],
			documentos: viagem.documentos ?? []
		});
		if (caminho.endsWith("/saldos")) return json({
			realizado: viagem.realizado ?? "0",
			comprometido: viagem.comprometido ?? "0",
			haDivergencia: false,
			saldos: [],
			transferenciasSugeridas: [],
			aviso: "Nada registrado ainda."
		});
		if (caminho.endsWith("/roteiro")) return json({
			dias: [],
			permissoes: {
				criarAtividade: viagem.estado === "planejada",
				motivoParaNaoCriar: null,
				papel: viagem.papel,
				estadoViagem: viagem.estado
			}
		});
		if (caminho.endsWith("/transicoes")) {
			const corpo = JSON.parse(String(init?.body ?? "{}"));
			if (corpo.para) {
				viagem.estado = corpo.para;
				viagem.versao += 1;
			}
			return json({
				estado: viagem.estado,
				rotuloEstado: viagem.estado
			});
		}
		if (caminho.endsWith("/reservas") && metodo === "POST") {
			const corpo = JSON.parse(String(init?.body ?? "{}"));
			const nova = {
				id: `r${(viagem.reservas ?? []).length + 1}`,
				viagemId: viagem.id,
				autorId: usuarioId,
				tipo: corpo.tipo ?? "outro",
				titulo: corpo.titulo ?? "sem nome",
				local: null,
				inicio: null,
				fim: null,
				custoCentavos: corpo.custoCentavos ?? null,
				custoAVerificar: (corpo.custoCentavos ?? null) === null,
				confirmacao: null,
				confirmadaPor: null,
				confirmadaEm: null,
				estado: "prevista",
				motivoCancelamento: null,
				versao: 1
			};
			viagem.reservas = [...viagem.reservas ?? [], nova];
			return json({ reserva: nova }, 201);
		}
		if (caminho.includes("/reservas/") && caminho.endsWith("/confirmar")) {
			const id = caminho.split("/").at(-2);
			const corpo = JSON.parse(String(init?.body ?? "{}"));
			const reserva = (viagem.reservas ?? []).find((item) => item["id"] === id);
			if (!reserva) return json({
				erro: "nao_encontrada",
				mensagem: "Reserva não encontrada."
			}, 404);
			reserva["estado"] = "confirmada";
			reserva["confirmacao"] = corpo.confirmacao ?? null;
			reserva["confirmadaPor"] = usuarioId;
			reserva["confirmadaEm"] = (/* @__PURE__ */ new Date()).toISOString();
			reserva["versao"] = Number(reserva["versao"] ?? 1) + 1;
			return json({ reserva });
		}
		if (caminho.includes("/reservas/") && caminho.endsWith("/cancelar")) {
			const id = caminho.split("/").at(-2);
			const corpo = JSON.parse(String(init?.body ?? "{}"));
			const reserva = (viagem.reservas ?? []).find((item) => item["id"] === id);
			if (!reserva) return json({
				erro: "nao_encontrada",
				mensagem: "Reserva não encontrada."
			}, 404);
			reserva["estado"] = "cancelada";
			reserva["motivoCancelamento"] = corpo.motivo ?? null;
			reserva["versao"] = Number(reserva["versao"] ?? 1) + 1;
			return json({ reserva });
		}
		if (caminho.endsWith("/orcamento") && metodo === "GET") {
			const limite = viagem.limiteColetivoCentavos ?? null;
			const previsto = (viagem.atividades ?? []).reduce((soma, atividade) => {
				const custo = atividade["custo"] ?? {};
				return soma + BigInt(custo.centavos ?? "0");
			}, 0n);
			const gasto = BigInt(viagem.realizado ?? "0");
			const percentual = limite === null || BigInt(limite) === 0n ? null : Number(previsto * 100n / BigInt(limite));
			return json({
				limiteColetivo: limite === null ? null : {
					id: "l1",
					centavos: limite,
					atualizadoEm: (/* @__PURE__ */ new Date()).toISOString(),
					versao: 1
				},
				limiteIndividualProprio: null,
				limitesIndividuais: [],
				situacao: {
					temLimite: limite !== null,
					limiteCentavos: limite,
					previstoCentavos: previsto.toString(),
					gastoConfirmadoCentavos: gasto.toString(),
					aguardandoCentavos: viagem.comprometido ?? "0",
					restantePrevistoCentavos: limite === null ? null : (BigInt(limite) - previsto).toString(),
					restanteGastoCentavos: limite === null ? null : (BigInt(limite) - gasto).toString(),
					percentualPrevisto: percentual,
					percentualGasto: limite === null ? null : Number(gasto * 100n / BigInt(limite)),
					estado: limite === null ? "sem_limite" : percentual === null ? "dentro" : percentual > 100 ? "estourado" : percentual >= 80 ? "atencao" : "dentro",
					alertas: [],
					resumo: limite === null ? "Sem limite definido." : `Previsto de ${limite}.`
				},
				planejamento: {
					previstoCentavos: previsto.toString(),
					custosAVerificar: 0
				},
				oficial: {
					gastoConfirmadoCentavos: gasto.toString(),
					aguardandoCentavos: viagem.comprometido ?? "0"
				},
				rotulos: {
					sem_limite: "Sem limite",
					dentro: "Dentro do limite",
					atencao: "Perto do limite",
					estourado: "Passou do limite"
				}
			});
		}
		if (caminho.endsWith("/orcamento/limite") && metodo === "PUT") {
			const corpo = JSON.parse(String(init?.body ?? "{}"));
			viagem.limiteColetivoCentavos = corpo.centavos ?? null;
			return json({ limite: {
				id: "l1",
				centavos: corpo.centavos ?? "0",
				atualizadoEm: (/* @__PURE__ */ new Date()).toISOString(),
				versao: 1
			} });
		}
		if (caminho.endsWith("/checklist") && metodo === "GET") return json({
			itens: viagem.checklist ?? [],
			categorias: [
				{
					categoria: "documento",
					rotulo: "Documento"
				},
				{
					categoria: "reserva",
					rotulo: "Reserva"
				},
				{
					categoria: "compras",
					rotulo: "Compras"
				},
				{
					categoria: "saude",
					rotulo: "Saúde"
				},
				{
					categoria: "outro",
					rotulo: "Outro"
				}
			],
			permissoes: {
				criar: true,
				concluir: true
			}
		});
		if (caminho.endsWith("/checklist") && metodo === "POST") {
			const corpo = JSON.parse(String(init?.body ?? "{}"));
			const novo = {
				id: `c${(viagem.checklist ?? []).length + 1}`,
				viagemId: viagem.id,
				autorId: usuarioId,
				titulo: corpo.titulo ?? "sem título",
				categoria: corpo.categoria ?? "outro",
				categoriaRotulo: "Outro",
				responsavelId: corpo.responsavelId ?? null,
				prazo: corpo.prazo ?? null,
				estado: "aberto",
				feitoPor: null,
				feitoEm: null,
				observacao: null,
				motivoReabertura: null,
				versao: 1
			};
			viagem.checklist = [...viagem.checklist ?? [], novo];
			return json({ item: novo }, 201);
		}
		if (caminho.includes("/checklist/") && caminho.endsWith("/concluir")) {
			const id = caminho.split("/").at(-2);
			const item = (viagem.checklist ?? []).find((candidato) => candidato["id"] === id);
			if (!item) return json({
				erro: "nao_encontrado",
				mensagem: "Item não encontrado."
			}, 404);
			item["estado"] = "feito";
			item["feitoPor"] = usuarioId;
			item["feitoEm"] = (/* @__PURE__ */ new Date()).toISOString();
			item["versao"] = Number(item["versao"] ?? 1) + 1;
			return json({ item });
		}
		if (caminho.includes("/checklist/") && caminho.endsWith("/reabrir")) {
			const id = caminho.split("/").at(-2);
			const corpo = JSON.parse(String(init?.body ?? "{}"));
			const item = (viagem.checklist ?? []).find((candidato) => candidato["id"] === id);
			if (!item) return json({
				erro: "nao_encontrado",
				mensagem: "Item não encontrado."
			}, 404);
			item["estado"] = "aberto";
			item["feitoPor"] = null;
			item["feitoEm"] = null;
			item["motivoReabertura"] = corpo.motivo ?? null;
			item["versao"] = Number(item["versao"] ?? 1) + 1;
			return json({ item });
		}
		if (caminho.endsWith("/documentos") && metodo === "GET") return json({
			documentos: viagem.documentos ?? [],
			tipos: [
				{
					tipo: "passagem",
					rotulo: "Passagem"
				},
				{
					tipo: "seguro",
					rotulo: "Seguro"
				},
				{
					tipo: "outro",
					rotulo: "Outro"
				}
			],
			avisoDePrivacidade: "Documento começa privado: só quem criou vê. Compartilhar é um passo separado e pode ser revogado. O Lia Go guarda o link e a descrição — o arquivo continua onde você o colocou."
		});
		if (caminho.endsWith("/documentos") && metodo === "POST") {
			const corpo = JSON.parse(String(init?.body ?? "{}"));
			const novo = {
				id: `d${(viagem.documentos ?? []).length + 1}`,
				viagemId: viagem.id,
				autorId: usuarioId,
				tipo: corpo.tipo ?? "outro",
				tipoRotulo: "Outro",
				nome: corpo.nome ?? "sem nome",
				descricao: corpo.descricao ?? null,
				link: corpo.link ?? null,
				visibilidade: "privado",
				compartilhadoCom: [],
				estado: "ativo",
				removidoPor: null,
				removidoEm: null,
				motivoRemocao: null,
				versao: 1
			};
			viagem.documentos = [...viagem.documentos ?? [], novo];
			return json({ documento: novo }, 201);
		}
		if (caminho.includes("/documentos/") && caminho.endsWith("/impacto")) {
			const acao = url.searchParams.get("acao") ?? "compartilhar";
			return json({ impacto: {
				itens: acao === "remover" ? ["O documento sai da lista de todo mundo e o acesso é revogado.", "Nada é apagado em definitivo: o registro e o motivo continuam guardados."] : ["Todas as 2 pessoas com acesso ativo passam a ver este documento.", "O documento guarda o link e a descrição; o arquivo continua onde você o colocou (o Lia Go não copia o arquivo)."],
				atencao: acao === "remover" ? [] : ["Documento de identidade: compartilhe só com quem precisa."]
			} });
		}
		if (caminho.includes("/documentos/") && (caminho.endsWith("/compartilhar") || caminho.endsWith("/revogar"))) {
			const id = caminho.split("/").at(-2);
			const corpo = JSON.parse(String(init?.body ?? "{}"));
			const documento = (viagem.documentos ?? []).find((candidato) => candidato["id"] === id);
			if (!documento) return json({
				erro: "nao_encontrado",
				mensagem: "Documento não encontrado."
			}, 404);
			if (caminho.endsWith("/compartilhar") && corpo.com === "viagem") {
				documento["visibilidade"] = "viagem";
				documento["compartilhadoCom"] = [];
			} else if (caminho.endsWith("/revogar")) {
				documento["visibilidade"] = "privado";
				documento["compartilhadoCom"] = [];
			} else documento["compartilhadoCom"] = Array.isArray(corpo.com) ? corpo.com : [];
			documento["versao"] = Number(documento["versao"] ?? 1) + 1;
			return json({ documento });
		}
		if (caminho.includes("/documentos/") && caminho.endsWith("/remover")) {
			const id = caminho.split("/").at(-2);
			const corpo = JSON.parse(String(init?.body ?? "{}"));
			const documento = (viagem.documentos ?? []).find((candidato) => candidato["id"] === id);
			if (!documento) return json({
				erro: "nao_encontrado",
				mensagem: "Documento não encontrado."
			}, 404);
			documento["estado"] = "removido";
			documento["motivoRemocao"] = corpo.motivo ?? null;
			documento["visibilidade"] = "privado";
			documento["compartilhadoCom"] = [];
			documento["versao"] = Number(documento["versao"] ?? 1) + 1;
			return json({ documento });
		}
		if (caminho.endsWith("/fechamento") && metodo === "GET") {
			const confirmadas = (viagem.despesas ?? []).filter((despesa) => despesa["estado"] === "confirmada");
			const total = confirmadas.reduce((soma, despesa) => soma + BigInt(String(despesa["valorCentavos"] ?? "0")), 0n);
			const conta = total / 2n;
			return json({
				viagem: {
					id: viagem.id,
					nome: viagem.nome,
					destino: viagem.destino,
					moeda: "BRL",
					estado: viagem.estado
				},
				geradoEm: (/* @__PURE__ */ new Date()).toISOString(),
				linhas: confirmadas.map((despesa) => ({
					despesaId: despesa["id"],
					data: despesa["data"],
					descricao: despesa["descricao"],
					tipo: despesa["tipo"],
					estado: "confirmada",
					valorCentavos: despesa["valorCentavos"],
					moeda: "BRL",
					pagadorId: usuarioId,
					pagadorNome: "Ana",
					partes: [{
						participanteId: usuarioId,
						nome: "Ana",
						valorCentavos: conta.toString()
					}, {
						participanteId: "u2",
						nome: "Bruno",
						valorCentavos: conta.toString()
					}]
				})),
				totalConfirmadoCentavos: total.toString(),
				totalAguardandoCentavos: "0",
				despesasAbertas: 0,
				saldos: [{
					participanteId: usuarioId,
					nome: "Ana",
					pagoCentavos: total.toString(),
					parteCentavos: conta.toString(),
					saldoCentavos: (total - conta).toString()
				}, {
					participanteId: "u2",
					nome: "Bruno",
					pagoCentavos: "0",
					parteCentavos: conta.toString(),
					saldoCentavos: (-conta).toString()
				}],
				acertosSugeridos: [{
					deId: "u2",
					deNome: "Bruno",
					paraId: usuarioId,
					paraNome: "Ana",
					valorCentavos: conta.toString()
				}],
				previstoCentavos: "0",
				previstoRoteiroCentavos: "0",
				previstoReservasCentavos: "0",
				limiteCentavos: null,
				alertas: [],
				texto: `Lia Go — fechamento de ${viagem.nome}\nConfirmado: R$ ${total.toString()}\nAcertos sugeridos (sugestão — ninguém pagou nada até alguém registrar).\n`,
				csv: "\"viagem\";\"data\";\"descricao\";\"valor\"\n" + confirmadas.map((despesa) => `"${viagem.nome}";"${despesa["data"]}";"${despesa["descricao"]}";"${despesa["valorCentavos"]}"`).join("\n")
			});
		}
		if (caminho.endsWith("/atividades") && metodo === "POST") return json({
			dia: "2026-12-20",
			atividades: [],
			resumo: {},
			conflitos: []
		});
		return json({
			erro: "nao_implementado",
			mensagem: `A rota ${metodo} ${caminho} não existe no servidor falso.`
		}, 404);
	});
	return estado;
}
//#endregion
//#region src/services/plataforma.ts
/**
* Diferenças de plataforma isoladas aqui (regra: nada de `if Capacitor` espalhado pela interface).
* Web = navegador; nativo = app Android/iOS rodando dentro do Capacitor.
*/
const Platform = {
	ehNativo() {
		return Capacitor.isNativePlatform();
	},
	ehWeb() {
		return Capacitor.getPlatform() === "web";
	},
	nome() {
		return Capacitor.getPlatform();
	}
};
//#endregion
//#region src/services/tokens.ts
/**
* Tokens do app nativo.
*
* - **Web:** nada é guardado aqui. A sessão é cookie HttpOnly (JavaScript não consegue ler).
* - **App nativo:** os tokens vão para o armazenamento seguro do sistema — Android Keystore
*   (criptografia por hardware) e iOS Keychain. Se o armazenamento seguro não estiver
*   disponível naquele aparelho, caímos para o armazenamento do próprio app e **avisamos**
*   (`modoDeArmazenamento()`), em vez de fingir que está seguro.
*
* Prática de mercado seguida (ver docs/DECISIONS_AND_OPEN_QUESTIONS.md): token de sessão
* nunca fica em armazenamento comum quando existe Keychain/Keystore.
*/
const CHAVE_ACESSO = "lia.acesso";
const CHAVE_REFRESH = "lia.refresh";
let pluginSeguro = null;
let ultimoModo = "indisponivel";
/**
* Teto de tempo para qualquer chamada ao armazenamento do sistema.
*
* Motivo (defeito real de 2026-10-15): no navegador, o plugin nativo não existe, mas o objeto
* devolvido pelo Capacitor **parece** ter todos os métodos (é um Proxy). `await` nele não resolve
* nem rejeita — fica pendurado para sempre. Foi assim que o botão "Sair" ficou sem fazer nada:
* a limpeza dos tokens nunca terminava. Aqui, promessa que não responde a tempo é tratada como
* indisponível, e o app segue.
*/
function comTempoLimite(promessa, ms = 3e3) {
	promessa.catch(() => void 0);
	return Promise.race([promessa, new Promise((_, rejeitar) => setTimeout(() => rejeitar(/* @__PURE__ */ new Error("armazenamento seguro não respondeu a tempo")), ms))]);
}
/**
* O plugin de armazenamento seguro só é usado no app nativo **e** quando ele está de fato instalado
* (`isPluginAvailable`). No navegador não existe Keychain/Keystore: a sessão web é cookie HttpOnly,
* então aqui não há nada para guardar — e nenhuma chamada a plugin nativo deve acontecer.
*/
function armazenamentoSeguroDisponivel() {
	return Platform.ehNativo() && Capacitor.isPluginAvailable("SecureStorage");
}
function carregarSeguro() {
	if (!armazenamentoSeguroDisponivel()) return Promise.resolve(null);
	pluginSeguro ??= import("@aparajita/capacitor-secure-storage").then((modulo) => {
		const candidato = modulo.SecureStorage;
		return candidato && typeof candidato.get === "function" ? candidato : null;
	}).catch(() => null);
	return pluginSeguro;
}
async function comArmazenamentoComum() {
	return import("@capacitor/preferences");
}
async function guardarTokens(tokens) {
	const seguro = await carregarSeguro();
	if (seguro) try {
		await comTempoLimite(seguro.set(CHAVE_ACESSO, tokens.acesso));
		await comTempoLimite(seguro.set(CHAVE_REFRESH, tokens.refresh));
		ultimoModo = "seguro";
		return;
	} catch {}
	const { Preferences } = await comArmazenamentoComum();
	await Preferences.set({
		key: CHAVE_ACESSO,
		value: tokens.acesso
	});
	await Preferences.set({
		key: CHAVE_REFRESH,
		value: tokens.refresh
	});
	ultimoModo = "comum";
}
async function lerTokens() {
	const seguro = await carregarSeguro();
	if (seguro) try {
		const acesso = await comTempoLimite(seguro.get(CHAVE_ACESSO));
		const refresh = await comTempoLimite(seguro.get(CHAVE_REFRESH));
		if (acesso && refresh) {
			ultimoModo = "seguro";
			return {
				acesso,
				refresh
			};
		}
	} catch {}
	const { Preferences } = await comArmazenamentoComum();
	const acesso = await Preferences.get({ key: CHAVE_ACESSO });
	const refresh = await Preferences.get({ key: CHAVE_REFRESH });
	if (!acesso.value || !refresh.value) return null;
	ultimoModo = seguro ? "seguro" : "comum";
	return {
		acesso: acesso.value,
		refresh: refresh.value
	};
}
async function limparTokens() {
	const seguro = await carregarSeguro();
	if (seguro) {
		await comTempoLimite(seguro.remove(CHAVE_ACESSO)).catch(() => void 0);
		await comTempoLimite(seguro.remove(CHAVE_REFRESH)).catch(() => void 0);
	}
	const { Preferences } = await comArmazenamentoComum();
	await Preferences.remove({ key: CHAVE_ACESSO });
	await Preferences.remove({ key: CHAVE_REFRESH });
}
function rotuloDeArmazenamento() {
	switch (ultimoModo) {
		case "seguro": return "armazenamento seguro do aparelho (Keychain/Keystore)";
		case "comum": return "armazenamento do app (este aparelho não ofereceu o armazenamento seguro)";
		default: return "nenhum (sessão pelo cookie do navegador)";
	}
}
//#endregion
//#region src/services/api.ts
/**
* Conversa com a API.
*
* Regra de plataforma (decisão confirmada de sessão híbrida):
* - WEB: cookie HttpOnly, enviado com `credentials: "include"`, via proxy /api do Vite.
* - APP NATIVO: access token curto no cabeçalho Authorization e refresh token em
*   armazenamento seguro do aparelho (Preferences). Nada de token em localStorage na web.
*/
var ErroApi = class extends Error {
	status;
	codigo;
	detalhes;
	constructor(status, codigo, mensagem, detalhes) {
		super(mensagem);
		this.status = status;
		this.codigo = codigo;
		this.detalhes = detalhes;
	}
};
const BASE = import.meta.env?.VITE_API_URL ?? "/api";
async function requisitar(caminho, opcoes = {}, tentativa = 0) {
	const cabecalhos = {};
	if (opcoes.corpo !== void 0) cabecalhos["content-type"] = "application/json";
	if (opcoes.idempotencia) cabecalhos["idempotency-key"] = opcoes.idempotencia;
	if (Platform.ehNativo()) {
		const tokens = await lerTokens();
		if (tokens?.acesso) cabecalhos.authorization = `Bearer ${tokens.acesso}`;
	}
	const resposta = await fetch(`${BASE}${caminho}`, {
		method: opcoes.metodo ?? "GET",
		headers: cabecalhos,
		credentials: "include",
		...opcoes.corpo === void 0 ? {} : { body: JSON.stringify(opcoes.corpo) }
	});
	if (resposta.status === 401 && Platform.ehNativo() && !opcoes.semRenovacao && tentativa === 0) {
		if (await renovarToken()) return requisitar(caminho, opcoes, tentativa + 1);
	}
	if (resposta.status === 204) return void 0;
	const texto = await resposta.text();
	const dados = texto ? JSON.parse(texto) : {};
	if (!resposta.ok) throw new ErroApi(resposta.status, String(dados.erro ?? "erro"), String(dados.mensagem ?? "Não foi possível concluir a operação."), dados.detalhes);
	return dados;
}
async function renovarToken() {
	const tokens = await lerTokens();
	if (!tokens?.refresh) return false;
	try {
		const resposta = await fetch(`${BASE}/auth/token/renovar`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ refreshToken: tokens.refresh })
		});
		if (!resposta.ok) {
			await limparTokens();
			return false;
		}
		const dados = await resposta.json();
		await guardarTokens({
			acesso: dados.acesso.token,
			refresh: dados.refresh.token
		});
		return true;
	} catch {
		await limparTokens();
		return false;
	}
}
const api = {
	async registrar(nome, email, senha) {
		return (await requisitar("/auth/registro", {
			metodo: "POST",
			corpo: {
				nome,
				email,
				senha
			},
			semRenovacao: true
		})).usuario;
	},
	async entrar(email, senha) {
		if (Platform.ehNativo()) {
			const resposta = await requisitar("/auth/login", {
				metodo: "POST",
				corpo: {
					email,
					senha,
					cliente: "nativo",
					dispositivo: Platform.nome()
				},
				semRenovacao: true
			});
			await guardarTokens({
				acesso: resposta.acesso.token,
				refresh: resposta.refresh.token
			});
			return resposta.usuario;
		}
		return (await requisitar("/auth/login", {
			metodo: "POST",
			corpo: {
				email,
				senha,
				cliente: "web"
			},
			semRenovacao: true
		})).usuario;
	},
	async sair() {
		try {
			await requisitar("/auth/logout", {
				metodo: "POST",
				semRenovacao: true
			});
		} finally {
			await limparTokens();
		}
	},
	async sessao() {
		try {
			return (await requisitar("/auth/sessao")).usuario;
		} catch (erro) {
			if (erro instanceof ErroApi && erro.status === 401) return null;
			throw erro;
		}
	},
	async listarViagens() {
		return requisitar("/viagens");
	},
	async criarViagem(dados, idempotencia = crypto.randomUUID()) {
		return requisitar("/viagens", {
			metodo: "POST",
			corpo: {
				...dados,
				fusoHorario: "America/Sao_Paulo",
				moeda: "BRL"
			},
			idempotencia
		});
	},
	async detalheViagem(viagemId) {
		return requisitar(`/viagens/${viagemId}`);
	},
	async transicionar(viagemId, para, motivo, versao) {
		return requisitar(`/viagens/${viagemId}/transicoes`, {
			metodo: "POST",
			corpo: versao === void 0 ? {
				para,
				motivo
			} : {
				para,
				motivo,
				versao
			}
		});
	},
	async impactosCancelamento(viagemId) {
		return requisitar(`/viagens/${viagemId}/impactos-cancelamento`);
	},
	async criarConvite(viagemId, email) {
		return requisitar(`/viagens/${viagemId}/convites`, {
			metodo: "POST",
			corpo: { email }
		});
	},
	async aceitarConvite(token) {
		return requisitar("/convites/aceitar", {
			metodo: "POST",
			corpo: { token }
		});
	},
	async listarDespesas(viagemId) {
		return requisitar(`/viagens/${viagemId}/despesas`);
	},
	async criarDespesa(viagemId, dados, idempotencia = crypto.randomUUID()) {
		return requisitar(`/viagens/${viagemId}/despesas`, {
			metodo: "POST",
			corpo: {
				...dados,
				moeda: "BRL"
			},
			idempotencia
		});
	},
	async confirmarDespesa(viagemId, despesaId) {
		return requisitar(`/viagens/${viagemId}/despesas/${despesaId}/confirmar`, { metodo: "POST" });
	},
	async contestarDespesa(viagemId, despesaId, motivo) {
		return requisitar(`/viagens/${viagemId}/despesas/${despesaId}/contestar`, {
			metodo: "POST",
			corpo: { motivo }
		});
	},
	async roteiro(viagemId) {
		return requisitar(`/viagens/${viagemId}/roteiro`);
	},
	/** Detalhe de uma atividade (inclui o histórico, quando há rede). */
	async detalheAtividade(viagemId, atividadeId) {
		return requisitar(`/viagens/${viagemId}/atividades/${atividadeId}`);
	},
	async criarAtividade(viagemId, dados, idempotencia = crypto.randomUUID()) {
		return requisitar(`/viagens/${viagemId}/atividades`, {
			metodo: "POST",
			corpo: dados,
			idempotencia
		});
	},
	async concluirAtividade(viagemId, atividadeId, dados = {}) {
		return requisitar(`/viagens/${viagemId}/atividades/${atividadeId}/concluir`, {
			metodo: "POST",
			corpo: {
				observacao: dados.observacao ?? null,
				...dados.versao === void 0 ? {} : { versao: dados.versao }
			}
		});
	},
	async cancelarAtividade(viagemId, atividadeId, dados) {
		return requisitar(`/viagens/${viagemId}/atividades/${atividadeId}/cancelar`, {
			metodo: "POST",
			corpo: {
				motivo: dados.motivo,
				...dados.versao === void 0 ? {} : { versao: dados.versao }
			}
		});
	},
	async corrigirAtividade(viagemId, atividadeId, dados) {
		return requisitar(`/viagens/${viagemId}/atividades/${atividadeId}/corrigir`, {
			metodo: "POST",
			corpo: dados
		});
	},
	async sairDaViagem(viagemId) {
		await requisitar(`/viagens/${viagemId}/sair`, { metodo: "POST" });
	},
	async saldos(viagemId) {
		return requisitar(`/viagens/${viagemId}/saldos`);
	},
	/** Sincronização incremental: só o que mudou desde o cursor (sequência de auditoria). */
	async reservas(viagemId) {
		return requisitar(`/viagens/${viagemId}/reservas`);
	},
	async detalheReserva(viagemId, reservaId) {
		return requisitar(`/viagens/${viagemId}/reservas/${reservaId}`);
	},
	async criarReserva(viagemId, corpo, idempotencia) {
		return requisitar(`/viagens/${viagemId}/reservas`, {
			metodo: "POST",
			corpo,
			...idempotencia === void 0 ? {} : { idempotencia }
		});
	},
	async confirmarReserva(viagemId, reservaId, confirmacao, versao) {
		return requisitar(`/viagens/${viagemId}/reservas/${reservaId}/confirmar`, {
			metodo: "POST",
			corpo: versao === void 0 ? { confirmacao } : {
				confirmacao,
				versao
			}
		});
	},
	async cancelarReserva(viagemId, reservaId, motivo, versao) {
		return requisitar(`/viagens/${viagemId}/reservas/${reservaId}/cancelar`, {
			metodo: "POST",
			corpo: versao === void 0 ? { motivo } : {
				motivo,
				versao
			}
		});
	},
	async orcamento(viagemId) {
		return requisitar(`/viagens/${viagemId}/orcamento`);
	},
	async definirLimiteColetivo(viagemId, centavos) {
		return requisitar(`/viagens/${viagemId}/orcamento/limite`, {
			metodo: "PUT",
			corpo: { centavos }
		});
	},
	async definirLimiteIndividual(viagemId, usuarioId, centavos) {
		return requisitar(`/viagens/${viagemId}/orcamento/limites/${usuarioId}`, {
			metodo: "PUT",
			corpo: { centavos }
		});
	},
	async fechamento(viagemId) {
		return requisitar(`/viagens/${viagemId}/fechamento`);
	},
	async checklist(viagemId) {
		return requisitar(`/viagens/${viagemId}/checklist`);
	},
	async criarItemChecklist(viagemId, corpo, idempotencia) {
		return requisitar(`/viagens/${viagemId}/checklist`, {
			metodo: "POST",
			corpo,
			idempotencia
		});
	},
	async concluirItemChecklist(viagemId, itemId, versao) {
		return requisitar(`/viagens/${viagemId}/checklist/${itemId}/concluir`, {
			metodo: "POST",
			corpo: versao === void 0 ? {} : { versao }
		});
	},
	async reabrirItemChecklist(viagemId, itemId, motivo, versao) {
		return requisitar(`/viagens/${viagemId}/checklist/${itemId}/reabrir`, {
			metodo: "POST",
			corpo: versao === void 0 ? { motivo } : {
				motivo,
				versao
			}
		});
	},
	async documentos(viagemId) {
		return requisitar(`/viagens/${viagemId}/documentos`);
	},
	async criarDocumento(viagemId, corpo, idempotencia) {
		return requisitar(`/viagens/${viagemId}/documentos`, {
			metodo: "POST",
			corpo,
			idempotencia
		});
	},
	async impactoDocumento(viagemId, documentoId, acao) {
		return requisitar(`/viagens/${viagemId}/documentos/${documentoId}/impacto?acao=${acao}`);
	},
	async compartilharDocumento(viagemId, documentoId, com, versao) {
		return requisitar(`/viagens/${viagemId}/documentos/${documentoId}/compartilhar`, {
			metodo: "POST",
			corpo: versao === void 0 ? { com } : {
				com,
				versao
			}
		});
	},
	async revogarDocumento(viagemId, documentoId, com, versao) {
		return requisitar(`/viagens/${viagemId}/documentos/${documentoId}/revogar`, {
			metodo: "POST",
			corpo: versao === void 0 ? { com } : {
				com,
				versao
			}
		});
	},
	async removerDocumento(viagemId, documentoId, motivo, versao) {
		return requisitar(`/viagens/${viagemId}/documentos/${documentoId}/remover`, {
			metodo: "POST",
			corpo: versao === void 0 ? { motivo } : {
				motivo,
				versao
			}
		});
	},
	async mudancas(viagemId, cursor) {
		return requisitar(`/viagens/${viagemId}/mudancas?desde=${encodeURIComponent(cursor ?? "0")}`);
	},
	async listarMovimentos(viagemId) {
		return requisitar(`/viagens/${viagemId}/movimentos`);
	},
	/** Acerto entre duas pessoas. Nada é transferido de verdade: é registro do que combinaram. */
	async criarMovimento(viagemId, dados, idempotencia = crypto.randomUUID()) {
		return requisitar(`/viagens/${viagemId}/movimentos`, {
			metodo: "POST",
			corpo: {
				...dados,
				despesaId: dados.despesaId ?? null
			},
			idempotencia
		});
	},
	async confirmarMovimento(viagemId, movimentoId) {
		return requisitar(`/viagens/${viagemId}/movimentos/${movimentoId}/confirmar`, { metodo: "POST" });
	},
	async contestarMovimento(viagemId, movimentoId, motivo) {
		return requisitar(`/viagens/${viagemId}/movimentos/${movimentoId}/contestar`, {
			metodo: "POST",
			corpo: { motivo }
		});
	}
};
//#endregion
//#region src/telas/Entrar.tsx
const DICA_CONTA_NOVA = "new-password";
const DICA_CONTA_EXISTENTE = "current-password";
/** Boas-vindas + entrada/criação de conta. Métodos: e-mail e senha (decisão confirmada). */
function Entrar({ aoEntrar }) {
	const [modo, setModo] = useState("entrar");
	const [nome, setNome] = useState("");
	const [email, setEmail] = useState("");
	const [senha, setSenha] = useState("");
	const [erro, setErro] = useState(null);
	const [ocupado, setOcupado] = useState(false);
	async function enviar(evento) {
		evento.preventDefault();
		setErro(null);
		setOcupado(true);
		try {
			aoEntrar((modo === "entrar" ? await api.entrar(email, senha) : await api.registrar(nome, email, senha)).nome);
		} catch (falha) {
			setErro(falha instanceof ErroApi ? falha.message : "Não foi possível conectar. Verifique sua rede.");
		} finally {
			setOcupado(false);
		}
	}
	return /* @__PURE__ */ jsxs("main", {
		className: "app",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "marca",
				children: [/* @__PURE__ */ jsx("span", {
					className: "marca-ponto",
					"aria-hidden": "true"
				}), /* @__PURE__ */ jsx("h1", { children: "Lia Go" })]
			}),
			/* @__PURE__ */ jsx("p", { children: "Viagens em grupo sem briga de dinheiro: roteiro, gastos compartilhados e acertos — com a Lia ajudando." }),
			/* @__PURE__ */ jsxs("form", {
				className: "cartao",
				onSubmit: enviar,
				children: [
					/* @__PURE__ */ jsx("h2", { children: modo === "entrar" ? "Entrar" : "Criar conta" }),
					erro ? /* @__PURE__ */ jsx("div", {
						className: "aviso erro",
						role: "alert",
						children: erro
					}) : null,
					modo === "criar" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("label", {
						htmlFor: "nome",
						children: "Seu nome"
					}), /* @__PURE__ */ jsx("input", {
						id: "nome",
						value: nome,
						onChange: (e) => setNome(e.target.value),
						required: true,
						minLength: 2,
						autoComplete: "name"
					})] }) : null,
					/* @__PURE__ */ jsx("label", {
						htmlFor: "email",
						children: "E-mail"
					}),
					/* @__PURE__ */ jsx("input", {
						id: "email",
						type: "email",
						value: email,
						onChange: (e) => setEmail(e.target.value),
						required: true,
						autoComplete: "email"
					}),
					/* @__PURE__ */ jsxs("label", {
						htmlFor: "senha",
						children: ["Senha ", modo === "criar" ? "(mínimo 10 caracteres)" : ""]
					}),
					/* @__PURE__ */ jsx("input", {
						id: "senha",
						type: "password",
						value: senha,
						onChange: (e) => setSenha(e.target.value),
						required: true,
						minLength: modo === "criar" ? 10 : 1,
						autoComplete: modo === "criar" ? DICA_CONTA_NOVA : DICA_CONTA_EXISTENTE
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "acoes",
						children: [/* @__PURE__ */ jsx("button", {
							className: "principal",
							type: "submit",
							disabled: ocupado,
							children: ocupado ? "Enviando…" : modo === "entrar" ? "Entrar" : "Criar conta"
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							className: "sutil",
							onClick: () => {
								setModo(modo === "entrar" ? "criar" : "entrar");
								setErro(null);
							},
							children: modo === "entrar" ? "Criar conta" : "Já tenho conta"
						})]
					})
				]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "aviso info",
				children: "Sua senha é protegida com scrypt e a sessão fica em cookie seguro na web. Não guardamos dados de cartão e não fazemos pagamentos: os acertos são apenas sugeridos."
			})
		]
	});
}
//#endregion
//#region src/services/formato.ts
/**
* Formatação de valores para a interface.
* O cálculo oficial é sempre do servidor; aqui só exibimos centavos já calculados.
*/
function formatarBRL(centavos) {
	const valor = typeof centavos === "bigint" ? centavos : BigInt(centavos);
	const negativo = valor < 0n;
	const texto = (negativo ? -valor : valor).toString().padStart(3, "0");
	const reais = texto.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
	const cents = texto.slice(-2);
	return `${negativo ? "-" : ""}R$ ${reais},${cents}`;
}
/** "12,50" ou "12.50" ou "1234" → centavos inteiros em texto. */
function paraCentavos(entrada) {
	const limpo = entrada.trim().replace(/^r\$\s*/i, "").replace(/\s/g, "");
	if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) throw new Error("Informe o valor como 12,50 ou 1234,50.");
	const [inteira = "0", decimal = ""] = limpo.replace(/\./g, "").split(",");
	const centavos = `${(decimal + "00").slice(0, 2)}`;
	return (BigInt(inteira) * 100n + BigInt(centavos)).toString();
}
function formatarData(iso) {
	if (!iso) return "sem data";
	const [ano, mes, dia] = iso.slice(0, 10).split("-");
	return `${dia}/${mes}/${ano}`;
}
/** Hora local do aparelho no formato HH:MM (mesma lógica do dia: quem lê é a pessoa). */
function horaDoAparelho(agora = /* @__PURE__ */ new Date()) {
	return new Intl.DateTimeFormat("pt-BR", {
		timeZone: "America/Sao_Paulo",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false
	}).format(agora);
}
function hojeIso() {
	const agora = /* @__PURE__ */ new Date();
	return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}
const ROTULO_ESTADO = {
	rascunho: "Rascunho",
	planejada: "Planejada",
	em_andamento: "Em andamento",
	concluida: "Concluída",
	pendente: "Pendente",
	cancelada: "Cancelada"
};
const ROTULO_DESPESA = {
	pendente: "Aguardando confirmação",
	confirmada: "Confirmada",
	contestada: "Contestada",
	cancelada: "Cancelada"
};
/** "2026-12-20" → "sáb, 20/12" (sem depender do fuso do aparelho). */
function formatarDiaCurto(iso) {
	const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
	const data = new Date(Date.UTC(ano, (mes ?? 1) - 1, dia ?? 1, 12));
	return `${new Intl.DateTimeFormat("pt-BR", {
		weekday: "short",
		timeZone: "UTC"
	}).format(data).replace(".", "")}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}
/** "2026-12-20" → "domingo, 20 de dezembro" (título do dia no roteiro). */
function formatarDiaLongo(iso) {
	const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
	const data = new Date(Date.UTC(ano, (mes ?? 1) - 1, dia ?? 1, 12));
	return new Intl.DateTimeFormat("pt-BR", {
		weekday: "long",
		day: "numeric",
		month: "long",
		timeZone: "UTC"
	}).format(data);
}
/** Duração em minutos → "1h30" ou "45 min" (nunca "0h"). */
function formatarDuracao(minutos) {
	if (!minutos || minutos <= 0) return null;
	const horas = Math.floor(minutos / 60);
	const resto = minutos % 60;
	if (horas === 0) return `${resto} min`;
	return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}
const ROTULO_ATIVIDADE = {
	planejada: "Planejada",
	concluida: "Concluída",
	cancelada: "Cancelada"
};
/**
* Como o custo aparece no cartão. Três situações distintas:
* desconhecido (nada), a verificar (sinalizado) e gratuito (zero explícito) — nunca confundidas.
*/
function descreverCusto(custo) {
	if (custo.centavos === null) return {
		valor: null,
		rotulo: custo.rotulo
	};
	if (custo.natureza === "gratuito") return {
		valor: formatarBRL(0n),
		rotulo: "Sem custo"
	};
	return {
		valor: formatarBRL(custo.centavos),
		rotulo: custo.rotulo
	};
}
/** Trecho de deslocamento em uma linha (compacto). */
function descreverDeslocamento(deslocamento) {
	const partes = [];
	if (deslocamento.minutos) partes.push(`${deslocamento.minutos} min`);
	if (deslocamento.km) partes.push(`${deslocamento.km} km`);
	if (deslocamento.custoCentavos) partes.push(formatarBRL(deslocamento.custoCentavos));
	return partes.join(" · ");
}
//#endregion
//#region src/telas/Inicio.tsx
/**
* Início: lista lida do **aparelho** (funciona sem sinal) e renovada pelo sincronizador.
* Criar viagem também funciona offline: a viagem entra na fila e sobe quando houver rede.
*/
function Inicio({ abrirViagem, aceitarConvite, sincronizador }) {
	const [estado, setEstado] = useState(sincronizador.obter());
	const [erro, setErro] = useState(null);
	const [aviso, setAviso] = useState(null);
	const [criando, setCriando] = useState(false);
	const [nome, setNome] = useState("");
	const [destino, setDestino] = useState("");
	const [inicio, setInicio] = useState("");
	const [fim, setFim] = useState("");
	const [token, setToken] = useState("");
	useEffect(() => sincronizador.assinar(setEstado), [sincronizador]);
	useEffect(() => {
		sincronizador.sincronizarAgora().catch(() => {});
	}, [sincronizador]);
	const viagens = estado.carga.viagens;
	const convites = estado.carga.convitesParaMim;
	async function criar(evento) {
		evento.preventDefault();
		setErro(null);
		setAviso(null);
		const nomeCriado = nome.trim();
		const antes = new Set(idsDasViagens());
		const operacao = {
			tipo: "criar_viagem",
			corpo: {
				nome: nomeCriado,
				destino,
				dataInicio: inicio || null,
				dataFim: fim || null
			},
			descricao: `Viagem: ${nomeCriado}`
		};
		try {
			await sincronizador.enfileirar(operacao);
		} catch (falha) {
			setErro(falha instanceof Error ? falha.message : "Não foi possível guardar a viagem neste aparelho.");
			return;
		}
		setCriando(false);
		setNome("");
		setDestino("");
		setInicio("");
		setFim("");
		if (!sincronizador.obter().online) {
			setAviso("Viagem guardada no aparelho. Ela vai para o servidor quando o sinal voltar.");
			return;
		}
		setAviso("Confirmando a viagem com o servidor…");
		await sincronizador.sincronizarAgora().catch(() => void 0);
		const nova = await esperarViagemCriada(nomeCriado, antes);
		setAviso(null);
		if (nova) {
			abrirViagem(nova.id);
			return;
		}
		setAviso("A viagem ficou guardada neste aparelho. Ela abre assim que o servidor confirmar — o estado aparece na barra de sincronização acima.");
	}
	/**
	* Procura a viagem recém-criada no que o servidor confirmou: mesma identificação (nome digitado)
	* e que **não** existia antes. Espera um pouco porque o servidor pode levar alguns instantes —
	* e, se não vier, a tela diz a verdade em vez de abrir a viagem errada.
	*/
	async function esperarViagemCriada(nome, antes, limiteMs = 4e3) {
		const inicio = Date.now();
		for (;;) {
			const novas = viagensDoAparelho().filter((viagem) => !antes.has(viagem.id) && viagem.nome === nome);
			if (novas.length > 0) return novas[novas.length - 1];
			if (Date.now() - inicio >= limiteMs) return void 0;
			await new Promise((resolver) => setTimeout(resolver, 100));
		}
	}
	function viagensDoAparelho() {
		return sincronizador.obter().carga.viagens;
	}
	function idsDasViagens() {
		return viagensDoAparelho().map((viagem) => viagem.id);
	}
	async function aceitar() {
		setErro(null);
		try {
			await api.aceitarConvite(token.trim());
			await sincronizador.sincronizarAgora();
			setToken("");
			setAviso("Convite aceito! A viagem já aparece na sua lista.");
		} catch (falha) {
			setErro(falha instanceof ErroApi ? falha.message : "Não foi possível aceitar o convite.");
		}
	}
	const primeiraCarga = viagens.length === 0 && estado.sincronizando && estado.ultimaSincronizacao === null;
	return /* @__PURE__ */ jsxs("main", {
		className: "app",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "marca",
				children: [/* @__PURE__ */ jsx("span", {
					className: "marca-ponto",
					"aria-hidden": "true"
				}), /* @__PURE__ */ jsx("h1", { children: "Lia Go" })]
			}),
			erro ? /* @__PURE__ */ jsx("div", {
				className: "aviso erro",
				role: "alert",
				children: erro
			}) : null,
			aviso ? /* @__PURE__ */ jsx("div", {
				className: "aviso ok",
				children: aviso
			}) : null,
			convites.length > 0 ? /* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h2", { children: "Convites pendentes" }), convites.map((convite) => /* @__PURE__ */ jsx("div", {
				className: "cartao",
				children: /* @__PURE__ */ jsx("div", {
					className: "linha",
					children: /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", { children: convite.viagem_nome }), /* @__PURE__ */ jsx("p", { children: "Você foi convidada(o). Cole o token abaixo para aceitar." })] })
				})
			}, convite.id))] }) : null,
			/* @__PURE__ */ jsxs("section", { children: [
				/* @__PURE__ */ jsxs("div", {
					className: "linha",
					children: [/* @__PURE__ */ jsx("h2", { children: "Suas viagens" }), /* @__PURE__ */ jsx("button", {
						onClick: () => setCriando(!criando),
						children: criando ? "Cancelar" : "Criar viagem"
					})]
				}),
				criando ? /* @__PURE__ */ jsxs("form", {
					className: "cartao destaque",
					onSubmit: (evento) => void criar(evento),
					children: [
						/* @__PURE__ */ jsx("label", {
							htmlFor: "nome-viagem",
							children: "Nome da viagem"
						}),
						/* @__PURE__ */ jsx("input", {
							id: "nome-viagem",
							value: nome,
							onChange: (e) => setNome(e.target.value),
							required: true,
							minLength: 2
						}),
						/* @__PURE__ */ jsx("label", {
							htmlFor: "destino",
							children: "Destino"
						}),
						/* @__PURE__ */ jsx("input", {
							id: "destino",
							value: destino,
							onChange: (e) => setDestino(e.target.value)
						}),
						/* @__PURE__ */ jsx("label", {
							htmlFor: "inicio",
							children: "Início (opcional)"
						}),
						/* @__PURE__ */ jsx("input", {
							id: "inicio",
							type: "date",
							value: inicio,
							onChange: (e) => setInicio(e.target.value)
						}),
						/* @__PURE__ */ jsx("label", {
							htmlFor: "fim",
							children: "Fim (opcional)"
						}),
						/* @__PURE__ */ jsx("input", {
							id: "fim",
							type: "date",
							value: fim,
							onChange: (e) => setFim(e.target.value)
						}),
						/* @__PURE__ */ jsx("div", {
							className: "acoes",
							children: /* @__PURE__ */ jsx("button", {
								className: "principal",
								type: "submit",
								children: "Salvar rascunho"
							})
						}),
						/* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("small", {
							className: "suave",
							children: "Sem internet também funciona: a viagem fica guardada no aparelho e sobe sozinha quando houver sinal."
						}) })
					]
				}) : null,
				/* @__PURE__ */ jsxs("div", {
					className: "cartao",
					children: [
						/* @__PURE__ */ jsx("label", {
							htmlFor: "token-convite",
							children: "Recebeu um convite? Cole o link/token"
						}),
						/* @__PURE__ */ jsx("input", {
							id: "token-convite",
							value: token,
							onChange: (e) => setToken(e.target.value),
							placeholder: "token recebido do organizador"
						}),
						/* @__PURE__ */ jsx("div", {
							className: "acoes",
							children: /* @__PURE__ */ jsx("button", {
								className: "principal",
								onClick: () => void aceitar(),
								disabled: token.trim().length < 10,
								children: "Aceitar convite"
							})
						}),
						/* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("small", {
							className: "suave",
							children: "Aceitar convite precisa de internet (é o servidor que confirma o seu acesso)."
						}) })
					]
				}),
				primeiraCarga ? /* @__PURE__ */ jsxs("div", {
					className: "carregando",
					children: [/* @__PURE__ */ jsx("span", { className: "pulso" }), " Buscando suas viagens…"]
				}) : null,
				viagens.length === 0 && !criando && !primeiraCarga ? /* @__PURE__ */ jsxs("div", {
					className: "cartao vazio",
					children: [/* @__PURE__ */ jsx("p", { children: "Você ainda não tem viagens." }), /* @__PURE__ */ jsx("button", {
						className: "principal",
						onClick: () => setCriando(true),
						children: "Criar viagem"
					})]
				}) : null,
				viagens.map((viagem) => /* @__PURE__ */ jsx("button", {
					className: "cartao",
					style: {
						width: "100%",
						textAlign: "left",
						display: "block"
					},
					onClick: () => abrirViagem(viagem.id),
					children: /* @__PURE__ */ jsxs("div", {
						className: "linha entre",
						children: [/* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsx("h3", { children: viagem.nome }),
							/* @__PURE__ */ jsxs("p", { children: [
								viagem.destino || "sem destino definido",
								" · ",
								formatarData(viagem.data_inicio),
								" a ",
								formatarData(viagem.data_fim)
							] }),
							/* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsxs("small", {
								className: "suave",
								children: [viagem.papel === "organizador" ? "Organizador(a)" : "Participante", viagem.pendencias_financeiras > 0 ? ` · ${viagem.pendencias_financeiras} pendência(s) financeira(s)` : ""]
							}) })
						] }), /* @__PURE__ */ jsx("span", {
							className: `etiqueta estado-${viagem.estado}`,
							children: ROTULO_ESTADO[viagem.estado] ?? viagem.estado
						})]
					})
				}, viagem.id))
			] })
		]
	});
}
//#endregion
//#region src/services/roteiro-texto.ts
/**
* Texto que o roteiro mostra — em funções puras, fora do JSX.
*
* Motivo: as regras de exibição do roteiro são **regras de negócio de interface**
* (`docs/UI_VISUAL_GUIDELINES.md` §2 e `docs/UI_V1_DECISIONS.md` §7) e precisam de teste como qualquer
* outra. Dentro do componente `.tsx` elas não podem ser testadas sem navegador; aqui são só dados.
*
* As três que não podem quebrar:
*  1. horário flexível **não** ganha horário inventado;
*  2. custo desconhecido fica **omitido** (nunca `R$ 0,00`), e "a verificar" é sinalizado;
*  3. "sem custo" é um zero **explícito**, com rótulo que explica o zero.
*/
/** Horário do cartão: a hora real ou a declaração honesta de que ela não existe. */
function textoDoHorario(hora) {
	return hora ? hora : "Horário flexível";
}
function linhasDeContexto(atividade) {
	const linhas = [];
	const custoBruto = custoDoCartao(atividade);
	if (atividade.local) linhas.push({
		texto: atividade.local,
		tipo: "local"
	});
	const duracao = formatarDuracao(atividade.duracaoMinutos);
	if (duracao) linhas.push({
		texto: duracao,
		tipo: "duracao"
	});
	const custo = descreverCusto({
		centavos: custoBruto.centavos,
		rotulo: rotuloDoCusto(custoBruto),
		natureza: custoBruto.natureza
	});
	if (custo.rotulo === "Custo a verificar") linhas.push({
		texto: custo.rotulo,
		tipo: "a-verificar"
	});
	if (custo.valor) {
		const texto = custo.rotulo && custo.rotulo !== "Custo a verificar" ? `${custo.rotulo}: ${custo.valor}` : custo.valor;
		linhas.push({
			texto,
			tipo: "custo"
		});
	}
	return linhas;
}
/**
* Custo do cartão em `bigint`, aceitando as duas formas que circulam no app: a do servidor
* (`custo.centavos`, string) e a do domínio (`custoCentavos`). Faltando tudo, é **desconhecido** —
* nunca zero — e a tela não quebra por dado incompleto.
*/
function custoDoCartao(atividade) {
	if (atividade.custo) return {
		centavos: atividade.custo.centavos === null || atividade.custo.centavos === void 0 ? null : BigInt(atividade.custo.centavos),
		natureza: atividade.custo.natureza ?? null,
		aVerificar: Boolean(atividade.custo.aVerificar)
	};
	return {
		centavos: atividade.custoCentavos ?? null,
		natureza: atividade.custoNatureza ?? null,
		aVerificar: Boolean(atividade.custoAVerificar)
	};
}
/** Rótulo de natureza do custo, quando o valor existe. Desconhecido não recebe rótulo nenhum. */
function rotuloDoCusto(custo) {
	if (custo.centavos === null) return custo.aVerificar ? "Custo a verificar" : null;
	if (custo.natureza === "compromisso") return "valor já combinado";
	if (custo.natureza === "gratuito") return "Sem custo";
	return "estimativa";
}
/** Manchete do conflito: o que aconteceu, em duas palavras, antes da explicação. */
function tituloDoConflito(tipo) {
	return tipo === "sobreposicao" ? "Conflito de horário" : "Deslocamento apertado";
}
function avaliarTrecho(deslocamento) {
	if (!deslocamento) return null;
	if (!Boolean(deslocamento.minutos || deslocamento.km || deslocamento.custoCentavos || deslocamento.alerta)) return null;
	return {
		resumo: descreverDeslocamento(deslocamento),
		detalhado: Boolean(deslocamento.alerta) || (deslocamento.minutos ?? 0) >= 30 || Boolean(deslocamento.custoCentavos),
		alerta: deslocamento.alerta
	};
}
/** Texto do resumo adaptativo do dia (o que precisa de atenção aparece primeiro). */
function linhasDoResumoDoDia(resumo) {
	const linhas = [];
	const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;
	linhas.push({
		texto: plural(resumo.total, "atividade", "atividades"),
		tipo: "normal"
	});
	if (resumo.flexiveis > 0) linhas.push({
		texto: `${resumo.flexiveis} sem horário fixo`,
		tipo: "normal"
	});
	if (resumo.concluidas > 0) linhas.push({
		texto: `${resumo.concluidas} concluída(s)`,
		tipo: "normal"
	});
	if (resumo.custoConhecidoCentavos > 0n) linhas.push({
		texto: `Previsto: ${formatarBRL(resumo.custoConhecidoCentavos)}`,
		tipo: "normal"
	});
	if (resumo.temCustoAVerificar) linhas.push({
		texto: "Custo a verificar",
		tipo: "atencao"
	});
	if (resumo.conflitos > 0) linhas.push({
		texto: `${resumo.conflitos} conflito(s) de horário para resolver`,
		tipo: "atencao"
	});
	return linhas;
}
//#endregion
//#region src/services/viagem-local.ts
function dadosDaViagemAberta(estado, viagemId) {
	const detalhe = estado.carga.viagem;
	if ((detalhe?.viagem?.id ?? null) !== viagemId) return {
		detalhe: null,
		despesas: [],
		movimentos: [],
		atividades: [],
		reservas: [],
		itensChecklist: [],
		documentos: []
	};
	const atividades = estado.carga.atividades.filter((atividade) => atividade.viagemId === void 0 || atividade.viagemId === viagemId);
	const reservas = (estado.carga.reservas ?? []).filter((reserva) => reserva.viagemId === void 0 || reserva.viagemId === viagemId);
	const itensChecklist = (estado.carga.itensChecklist ?? []).filter((item) => item.viagemId === void 0 || item.viagemId === viagemId);
	const documentos = (estado.carga.documentos ?? []).filter((documento) => documento.viagemId === void 0 || documento.viagemId === viagemId);
	return {
		detalhe,
		despesas: estado.carga.despesas,
		movimentos: estado.carga.movimentos,
		atividades,
		reservas,
		itensChecklist,
		documentos
	};
}
/** Permissão que pode vir ausente de um cache antigo: nunca derruba a tela por isso. */
function pode(permissao) {
	return permissao?.permitido === true;
}
/**
* Atividade como o domínio entende (o aparelho guarda o mesmo objeto que o servidor devolve).
* Devolve `null` para item inválido: dado estragado no cache não derruba a tela.
*/
function atividadeDoDominio(item) {
	if (typeof item["id"] !== "string" || typeof item["dia"] !== "string") return null;
	const custo = item["custo"] ?? {};
	return {
		id: item["id"],
		viagemId: String(item["viagemId"] ?? ""),
		autorId: String(item["autorId"] ?? ""),
		dia: item["dia"],
		ordem: Number(item["ordem"] ?? 1),
		titulo: String(item["titulo"] ?? ""),
		hora: item["hora"] ?? null,
		duracaoMinutos: item["duracaoMinutos"] ?? null,
		local: item["local"] ?? null,
		custoCentavos: custo.centavos ? BigInt(custo.centavos) : null,
		custoNatureza: custo.natureza ?? null,
		custoAVerificar: Boolean(custo.aVerificar),
		estado: item["estado"] ?? "planejada",
		concluidaPor: item["concluidaPor"] ?? null,
		concluidaEm: item["concluidaEm"] ?? null,
		observacao: item["observacao"] ?? null,
		deslocamento: item["deslocamento"] ?? null,
		versao: Number(item["versao"] ?? 1)
	};
}
/** Atividades da viagem, prontas para as funções do domínio (roteiro e orçamento). */
function atividadesDoDominio(estado, viagemId) {
	return dadosDaViagemAberta(estado, viagemId).atividades.map((item) => atividadeDoDominio(item)).filter((atividade) => atividade !== null);
}
/**
* Item do checklist como o domínio entende. `null` para item estragado no cache: dado ruim do
* aparelho não derruba a tela (mesma regra de `atividadeDoDominio`).
*/
function itemChecklistDoDominio(item) {
	if (typeof item["id"] !== "string" || typeof item["titulo"] !== "string") return null;
	return {
		id: item["id"],
		viagemId: String(item["viagemId"] ?? ""),
		autorId: String(item["autorId"] ?? ""),
		titulo: item["titulo"],
		categoria: item["categoria"] ?? "outro",
		responsavelId: item["responsavelId"] ?? null,
		prazo: item["prazo"] ?? null,
		estado: item["estado"] ?? "aberto",
		feitoPor: item["feitoPor"] ?? null,
		feitoEm: item["feitoEm"] ?? null,
		observacao: item["observacao"] ?? null,
		motivoReabertura: item["motivoReabertura"] ?? null,
		versao: Number(item["versao"] ?? 1)
	};
}
/** Checklist da viagem aberta, pronto para as funções do domínio (resumo e ordem). */
function checklistDoDominio(estado, viagemId) {
	return dadosDaViagemAberta(estado, viagemId).itensChecklist.map((item) => itemChecklistDoDominio(item)).filter((item) => item !== null);
}
/** Documento como o domínio entende (a visibilidade é decidida no servidor; aqui só leitura). */
function documentoDoDominio(item) {
	if (typeof item["id"] !== "string" || typeof item["nome"] !== "string") return null;
	return {
		id: item["id"],
		viagemId: String(item["viagemId"] ?? ""),
		autorId: String(item["autorId"] ?? ""),
		tipo: item["tipo"] ?? "outro",
		nome: item["nome"],
		descricao: item["descricao"] ?? null,
		link: item["link"] ?? null,
		visibilidade: item["visibilidade"] ?? "privado",
		compartilhadoCom: Array.isArray(item["compartilhadoCom"]) ? item["compartilhadoCom"] : [],
		estado: item["estado"] ?? "ativo",
		removidoPor: item["removidoPor"] ?? null,
		removidoEm: item["removidoEm"] ?? null,
		motivoRemocao: item["motivoRemocao"] ?? null,
		versao: Number(item["versao"] ?? 1)
	};
}
function documentosDoDominio(estado, viagemId) {
	return dadosDaViagemAberta(estado, viagemId).documentos.map((item) => documentoDoDominio(item)).filter((documento) => documento !== null);
}
/**
* Próximo compromisso do roteiro (destaque da Visão geral, referência `concept-03`).
*
* Regras: só o que ainda **vale** (planejada), só a partir de agora, e sem hora o compromisso vale
* pelo dia inteiro — por isso ele fica no fim do próprio dia, não no começo. Devolve `null` quando
* não há nada à frente: a tela então não inventa um "próximo" que não existe.
*/
function proximoCompromisso(atividades, agora) {
	return atividades.filter((atividade) => atividade.estado === "planejada").filter((atividade) => {
		if (atividade.dia > agora.dia) return true;
		if (atividade.dia < agora.dia) return false;
		return atividade.hora === null || atividade.hora >= agora.hora;
	}).sort((a, b) => {
		if (a.dia !== b.dia) return a.dia < b.dia ? -1 : 1;
		const horaA = a.hora ?? "99:99";
		const horaB = b.hora ?? "99:99";
		if (horaA !== horaB) return horaA < horaB ? -1 : 1;
		return a.ordem - b.ordem;
	})[0] ?? null;
}
/** Rótulo humano do "quando" do próximo compromisso (hoje, amanhã ou o dia). */
function quandoDoCompromisso(dia, hora, hoje) {
	const [ano, mes, dataDia] = hoje.split("-").map(Number);
	const amanha = new Date(Date.UTC(ano, (mes ?? 1) - 1, (dataDia ?? 1) + 1, 12)).toISOString().slice(0, 10);
	const quando = dia === hoje ? "hoje" : dia === amanha ? "amanhã" : dia.split("-").reverse().join("/");
	return hora === null ? `${quando}, sem hora marcada` : `${quando} às ${hora}`;
}
//#endregion
//#region src/componentes/CartaoAtividade.tsx
/**
* Cartão de atividade do roteiro — padrão "equilibrado" (diretriz §2.2).
*
* Mostra direto: horário (quando definido), título, estado, custo essencial e o contexto que
* ajuda a entender o compromisso. O resto fica na tela de detalhes (§2.1).
*
* Regras que o componente **não** deixa escapar — todas implementadas em `services/roteiro-texto.ts`,
* onde são testáveis sem navegador:
*  - horário flexível não ganha horário inventado (§2.7);
*  - custo desconhecido não aparece como R$ 0,00 (§2.4);
*  - estado nunca é só cor: sempre tem texto (§2.3);
*  - atividade concluída fica discreta, com etiqueta, e pode ser recolhida sem apagar nada (§2.8).
*/
/** Marcador da linha do tempo + trecho de deslocamento + cartão. */
function CartaoAtividade({ atividade, conflitos, deslocamentoDoTrecho, aoAbrir }) {
	const contexto = linhasDeContexto(atividade);
	const trecho = avaliarTrecho(deslocamentoDoTrecho);
	const temConflito = conflitos.length > 0;
	const concluida = atividade.estado === "concluida";
	const cancelada = atividade.estado === "cancelada";
	return /* @__PURE__ */ jsxs("li", {
		className: `atividade${temConflito ? " com-conflito" : ""}${concluida ? " concluida" : ""}${cancelada ? " cancelada" : ""}`,
		children: [/* @__PURE__ */ jsx("span", {
			className: "marcador",
			"aria-hidden": "true"
		}), /* @__PURE__ */ jsxs("div", {
			className: "atividade-corpo",
			children: [trecho ? /* @__PURE__ */ jsx(TrechoDeslocamento, { trecho }) : null, /* @__PURE__ */ jsxs("button", {
				className: "cartao cartao-atividade",
				onClick: () => aoAbrir(atividade.id),
				type: "button",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "atividade-topo",
						children: [/* @__PURE__ */ jsx("span", {
							className: "atividade-hora",
							children: textoDoHorario(atividade.hora)
						}), /* @__PURE__ */ jsx("span", {
							className: `etiqueta estado-${atividade.estado}`,
							children: ROTULO_ATIVIDADE[atividade.estado] ?? atividade.estado
						})]
					}),
					/* @__PURE__ */ jsx("h3", {
						className: "atividade-titulo",
						children: atividade.titulo
					}),
					contexto.length > 0 ? /* @__PURE__ */ jsx("div", {
						className: "atividade-contexto",
						children: contexto.map((linha) => /* @__PURE__ */ jsx("span", {
							className: linha.tipo === "a-verificar" ? "custo-a-verificar" : linha.tipo === "custo" ? "custo" : void 0,
							children: linha.texto
						}, linha.texto))
					}) : null,
					temConflito ? /* @__PURE__ */ jsx("div", {
						className: "alerta-conflito",
						role: "status",
						children: conflitos.map((conflito) => /* @__PURE__ */ jsxs("p", { children: [/* @__PURE__ */ jsxs("strong", { children: [tituloDoConflito(conflito.tipo), ": "] }), conflito.explicacao] }, conflito.explicacao))
					}) : null
				]
			})]
		})]
	});
}
/**
* Trecho entre atividades: compacto por padrão; abre quando o trecho é longo, tem custo ou risco
* (§2.6). Compacto nunca é oculto: o alerta aparece mesmo na forma curta.
*/
function TrechoDeslocamento({ trecho }) {
	if (!trecho) return null;
	return /* @__PURE__ */ jsxs("div", {
		className: `trecho${trecho.detalhado ? " aberto" : ""}`,
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "trecho-seta",
				"aria-hidden": "true",
				children: "↓"
			}),
			/* @__PURE__ */ jsx("span", {
				className: "trecho-texto",
				children: trecho.resumo ? `Deslocamento: ${trecho.resumo}` : "Deslocamento"
			}),
			trecho.alerta ? /* @__PURE__ */ jsx("span", {
				className: "trecho-alerta",
				children: trecho.alerta
			}) : null
		]
	});
}
//#endregion
//#region src/telas/Roteiro.tsx
/**
* Roteiro da viagem: linha do tempo por dia, com resumo adaptável e conflitos explicados.
*
* Funciona **offline primeiro**: lê as atividades do aparelho (carga local) e calcula dias, resumo
* e conflitos com as mesmas regras do servidor (`@lia-go/domain`). Criar atividade entra na fila e
* sobe quando houver rede — o mesmo caminho com ou sem sinal.
*
* O que este arquivo não faz de propósito (diretriz §2):
*  - não move horário nem resolve conflito;
*  - não inventa horário para atividade flexível;
*  - não conclui nada pelo relógio;
*  - não mostra custo desconhecido como zero.
*/
function Roteiro({ viagemId, usuarioId, sincronizador, abrirAtividade, dataInicioViagem, dataFimViagem, estadoViagem }) {
	const [estado, setEstado] = useState(sincronizador.obter());
	const [diaEscolhido, setDiaEscolhido] = useState(null);
	const [recolherConcluidas, setRecolherConcluidas] = useState(false);
	const [formularioAberto, setFormularioAberto] = useState(false);
	const [erro, setErro] = useState(null);
	const [aviso, setAviso] = useState(null);
	const [ocupado, setOcupado] = useState(false);
	const [nova, setNova] = useState({
		titulo: "",
		dia: dataInicioViagem ?? hojeIso(),
		hora: "",
		flexivel: false,
		duracao: "",
		local: "",
		custo: "",
		natureza: "estimativa",
		aVerificar: false,
		deslocamentoMinutos: "",
		deslocamentoAlerta: ""
	});
	useMemo(() => sincronizador.assinar(setEstado), [sincronizador]);
	const atividades = useMemo(() => atividadesDoDominio(estado, viagemId), [estado, viagemId]);
	const dias = useMemo(() => agruparPorDia(atividades), [atividades]);
	const diaAtual = diaEscolhido && dias.some((dia) => dia.dia === diaEscolhido) ? diaEscolhido : dias[0]?.dia ?? nova.dia;
	const diaAberto = dias.find((dia) => dia.dia === diaAtual) ?? null;
	const conflitosPorAtividade = useMemo(() => {
		const mapa = /* @__PURE__ */ new Map();
		if (!diaAberto) return mapa;
		for (const conflito of conflitosDoDia(diaAberto.atividades)) for (const id of conflito.atividadeIds) mapa.set(id, [...mapa.get(id) ?? [], conflito]);
		return mapa;
	}, [diaAberto]);
	const resumo = diaAberto ? resumirDia(diaAberto.atividades) : null;
	const criarBloqueada = estadoViagem === "cancelada" || estadoViagem === "concluida";
	async function enviarAtividade(evento) {
		evento.preventDefault();
		setErro(null);
		setOcupado(true);
		try {
			const custoCentavos = nova.natureza === "gratuito" ? "0" : nova.custo.trim() ? paraCentavos(nova.custo) : null;
			const operacao = {
				tipo: "criar_atividade",
				viagemId,
				corpo: {
					dia: nova.dia,
					titulo: nova.titulo,
					hora: nova.flexivel || !nova.hora.trim() ? null : nova.hora.trim(),
					duracaoMinutos: nova.duracao.trim() ? Number(nova.duracao) : null,
					local: nova.local.trim() || null,
					custoCentavos,
					custoNatureza: custoCentavos === null ? null : nova.natureza,
					custoAVerificar: nova.aVerificar,
					observacao: null,
					deslocamento: nova.deslocamentoMinutos.trim() ? {
						minutos: Number(nova.deslocamentoMinutos),
						km: null,
						custoCentavos: null,
						alerta: nova.deslocamentoAlerta.trim() || null
					} : null
				},
				descricao: `Atividade: ${nova.titulo}`
			};
			await sincronizador.enfileirar(operacao);
			setFormularioAberto(false);
			setDiaEscolhido(nova.dia);
			setNova({
				...nova,
				titulo: "",
				hora: "",
				duracao: "",
				local: "",
				custo: "",
				aVerificar: false,
				deslocamentoMinutos: "",
				deslocamentoAlerta: ""
			});
			setAviso(estado.online ? "Atividade guardada. Ela aparece na linha do tempo assim que o servidor confirmar." : "Atividade guardada no aparelho. Ela sobe para o servidor quando houver sinal.");
		} catch (falha) {
			setErro(falha instanceof ErroApi ? falha.message : "Não foi possível guardar a atividade.");
		} finally {
			setOcupado(false);
		}
	}
	const visiveis = diaAberto ? recolherConcluidas ? diaAberto.atividades.filter((atividade) => atividade.estado !== "concluida") : diaAberto.atividades : [];
	return /* @__PURE__ */ jsxs("section", { children: [
		/* @__PURE__ */ jsxs("div", {
			className: "linha entre",
			children: [/* @__PURE__ */ jsx("h2", { children: "Roteiro" }), !criarBloqueada ? /* @__PURE__ */ jsx("button", {
				className: "principal compacto",
				onClick: () => setFormularioAberto((aberto) => !aberto),
				children: formularioAberto ? "Fechar" : "Nova atividade"
			}) : /* @__PURE__ */ jsx("span", {
				className: "suave pequeno",
				children: estadoViagem === "cancelada" ? "Viagem cancelada" : "Viagem concluída"
			})]
		}),
		aviso ? /* @__PURE__ */ jsxs("div", {
			className: "aviso info",
			role: "status",
			children: [aviso, /* @__PURE__ */ jsx("button", {
				className: "sutil",
				style: { marginLeft: 8 },
				onClick: () => setAviso(null),
				children: "ok"
			})]
		}) : null,
		erro ? /* @__PURE__ */ jsx("div", {
			className: "aviso erro",
			role: "alert",
			children: erro
		}) : null,
		formularioAberto ? /* @__PURE__ */ jsxs("form", {
			className: "cartao",
			onSubmit: enviarAtividade,
			children: [
				/* @__PURE__ */ jsx("h3", { children: "Nova atividade" }),
				/* @__PURE__ */ jsx("label", {
					htmlFor: "atividade-titulo",
					children: "O que vai acontecer"
				}),
				/* @__PURE__ */ jsx("input", {
					id: "atividade-titulo",
					value: nova.titulo,
					onChange: (evento) => setNova({
						...nova,
						titulo: evento.target.value
					}),
					required: true,
					minLength: 2,
					maxLength: 120,
					placeholder: "Visitar o mirante"
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "duas-colunas",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						htmlFor: "atividade-dia",
						children: "Dia"
					}), /* @__PURE__ */ jsx("input", {
						id: "atividade-dia",
						type: "date",
						value: nova.dia,
						onChange: (evento) => setNova({
							...nova,
							dia: evento.target.value
						}),
						required: true
					})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						htmlFor: "atividade-hora",
						children: "Horário (opcional)"
					}), /* @__PURE__ */ jsx("input", {
						id: "atividade-hora",
						type: "time",
						value: nova.hora,
						onChange: (evento) => setNova({
							...nova,
							hora: evento.target.value
						}),
						disabled: nova.flexivel
					})] })]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "caixa-marcacao",
					children: [/* @__PURE__ */ jsx("input", {
						type: "checkbox",
						checked: nova.flexivel,
						onChange: (evento) => setNova({
							...nova,
							flexivel: evento.target.checked,
							hora: evento.target.checked ? "" : nova.hora
						})
					}), "Horário flexível (fica na ordem do dia, sem horário fixo)"]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "duas-colunas",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						htmlFor: "atividade-duracao",
						children: "Duração (min)"
					}), /* @__PURE__ */ jsx("input", {
						id: "atividade-duracao",
						type: "number",
						min: 1,
						inputMode: "numeric",
						value: nova.duracao,
						onChange: (evento) => setNova({
							...nova,
							duracao: evento.target.value
						})
					})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						htmlFor: "atividade-local",
						children: "Local"
					}), /* @__PURE__ */ jsx("input", {
						id: "atividade-local",
						value: nova.local,
						onChange: (evento) => setNova({
							...nova,
							local: evento.target.value
						}),
						placeholder: "Praça central"
					})] })]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "duas-colunas",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						htmlFor: "atividade-custo",
						children: "Custo (opcional)"
					}), /* @__PURE__ */ jsx("input", {
						id: "atividade-custo",
						value: nova.custo,
						onChange: (evento) => setNova({
							...nova,
							custo: evento.target.value
						}),
						placeholder: "120,00",
						disabled: nova.natureza === "gratuito"
					})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						htmlFor: "atividade-natureza",
						children: "Esse valor é"
					}), /* @__PURE__ */ jsxs("select", {
						id: "atividade-natureza",
						value: nova.natureza,
						onChange: (evento) => setNova({
							...nova,
							natureza: evento.target.value
						}),
						children: [
							/* @__PURE__ */ jsx("option", {
								value: "estimativa",
								children: "Estimativa"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "compromisso",
								children: "Compromisso (já combinado)"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "gratuito",
								children: "Sem custo (gratuito)"
							})
						]
					})] })]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "caixa-marcacao",
					children: [/* @__PURE__ */ jsx("input", {
						type: "checkbox",
						checked: nova.aVerificar,
						onChange: (evento) => setNova({
							...nova,
							aVerificar: evento.target.checked
						})
					}), "Ainda preciso verificar o custo"]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "duas-colunas",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						htmlFor: "atividade-deslocamento",
						children: "Deslocamento até aqui (min)"
					}), /* @__PURE__ */ jsx("input", {
						id: "atividade-deslocamento",
						type: "number",
						min: 1,
						inputMode: "numeric",
						value: nova.deslocamentoMinutos,
						onChange: (evento) => setNova({
							...nova,
							deslocamentoMinutos: evento.target.value
						})
					})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
						htmlFor: "atividade-alerta",
						children: "Alerta do trecho (opcional)"
					}), /* @__PURE__ */ jsx("input", {
						id: "atividade-alerta",
						value: nova.deslocamentoAlerta,
						onChange: (evento) => setNova({
							...nova,
							deslocamentoAlerta: evento.target.value
						}),
						placeholder: "Embarque não espera"
					})] })]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "acoes",
					children: [/* @__PURE__ */ jsx("button", {
						className: "principal",
						type: "submit",
						disabled: ocupado,
						children: ocupado ? "Guardando…" : "Guardar atividade"
					}), /* @__PURE__ */ jsx("button", {
						className: "sutil",
						type: "button",
						onClick: () => setFormularioAberto(false),
						children: "Cancelar"
					})]
				})
			]
		}) : null,
		dias.length === 0 ? /* @__PURE__ */ jsxs("div", {
			className: "cartao vazio",
			children: [/* @__PURE__ */ jsx("p", { children: "Nenhuma atividade ainda." }), /* @__PURE__ */ jsx("p", {
				className: "suave pequeno",
				children: "Monte o roteiro aos poucos: cada atividade pode nascer só com o nome e o dia, e o resto você completa depois."
			})]
		}) : null,
		dias.length > 1 ? /* @__PURE__ */ jsx("div", {
			className: "dias",
			role: "group",
			"aria-label": "Dias do roteiro",
			children: dias.map(({ dia, atividades: doDia }) => {
				const resumoDoDia = resumirDia(doDia);
				const conflitos = resumoDoDia.conflitos > 0 ? `, ${resumoDoDia.conflitos} conflito(s)` : "";
				return /* @__PURE__ */ jsxs("button", {
					"aria-pressed": dia === diaAtual,
					"aria-label": `${formatarDiaLongo(dia)}: ${resumoDoDia.total} atividade(s)${conflitos}`,
					className: `dia-chip${dia === diaAtual ? " ativo" : ""}${resumoDoDia.conflitos > 0 ? " com-conflito" : ""}`,
					onClick: () => setDiaEscolhido(dia),
					type: "button",
					children: [/* @__PURE__ */ jsx("span", {
						"aria-hidden": "true",
						children: formatarDiaCurto(dia)
					}), /* @__PURE__ */ jsxs("small", {
						"aria-hidden": "true",
						children: [
							resumoDoDia.total,
							" ",
							resumoDoDia.total === 1 ? "atividade" : "atividades",
							resumoDoDia.conflitos > 0 ? ` · ${resumoDoDia.conflitos} conflito(s)` : ""
						]
					})]
				}, dia);
			})
		}) : null,
		diaAberto && resumo ? /* @__PURE__ */ jsxs(Fragment, { children: [
			/* @__PURE__ */ jsxs("div", {
				className: "linha entre",
				children: [/* @__PURE__ */ jsx("h3", {
					className: "dia-titulo",
					children: formatarDiaLongo(diaAberto.dia)
				}), resumo.concluidas > 0 ? /* @__PURE__ */ jsx("button", {
					className: "sutil pequeno",
					onClick: () => setRecolherConcluidas((valor) => !valor),
					children: recolherConcluidas ? "Mostrar concluídas" : "Recolher concluídas"
				}) : null]
			}),
			/* @__PURE__ */ jsx("div", {
				className: `resumo-dia${resumo.conflitos > 0 || resumo.temCustoAVerificar ? " expandido" : ""}`,
				children: linhasDoResumoDoDia({
					total: resumo.total,
					concluidas: resumo.concluidas,
					flexiveis: resumo.flexiveis,
					custoConhecidoCentavos: resumo.custoConhecidoCentavos,
					temCustoAVerificar: resumo.temCustoAVerificar,
					conflitos: resumo.conflitos
				}).map((linha) => /* @__PURE__ */ jsx("span", {
					className: linha.tipo === "atencao" ? "conflito-aviso" : void 0,
					children: linha.texto
				}, linha.texto))
			}),
			resumo.conflitos > 0 ? /* @__PURE__ */ jsxs("div", {
				className: "aviso atencao",
				role: "status",
				children: [/* @__PURE__ */ jsx("strong", { children: "Conflitos neste dia." }), " O Lia Go não muda horários sozinho — abra as atividades destacadas e ajuste."]
			}) : null,
			/* @__PURE__ */ jsx("ol", {
				className: "linha-tempo",
				children: visiveis.map((atividade, indice) => /* @__PURE__ */ jsx(CartaoAtividade, {
					atividade,
					conflitos: conflitosPorAtividade.get(atividade.id) ?? [],
					deslocamentoDoTrecho: indice === 0 ? null : atividade.deslocamento ?? null,
					aoAbrir: abrirAtividade
				}, atividade.id))
			}),
			visiveis.length === 0 && recolherConcluidas ? /* @__PURE__ */ jsx("p", {
				className: "suave pequeno",
				children: "Todas as atividades deste dia estão recolhidas (nada foi apagado)."
			}) : null
		] }) : null,
		usuarioId && estadoViagem === "rascunho" ? /* @__PURE__ */ jsxs("p", {
			className: "suave pequeno",
			children: [
				"Esta viagem ainda é um rascunho (",
				ROTULO_ESTADO["rascunho"],
				"). O roteiro pode ser montado já, mas as despesas começam quando a viagem virar ",
				/* @__PURE__ */ jsx("strong", { children: "planejada" }),
				"."
			]
		}) : null
	] });
}
//#endregion
//#region src/services/reserva-cache.ts
/** Objeto do aparelho → reserva do domínio (mesma forma que o servidor devolve). */
function comoReserva(item) {
	if (typeof item["id"] !== "string" || typeof item["titulo"] !== "string") return null;
	const custo = item["custoCentavos"];
	return {
		id: item["id"],
		viagemId: String(item["viagemId"] ?? ""),
		autorId: String(item["autorId"] ?? ""),
		tipo: item["tipo"] ?? "outro",
		titulo: item["titulo"],
		local: item["local"] ?? null,
		inicio: item["inicio"] ?? null,
		fim: item["fim"] ?? null,
		custoCentavos: typeof custo === "string" && custo.length > 0 ? BigInt(custo) : null,
		custoAVerificar: Boolean(item["custoAVerificar"]),
		confirmacao: item["confirmacao"] ?? null,
		confirmadaPor: item["confirmadaPor"] ?? null,
		confirmadaEm: item["confirmadaEm"] ?? null,
		estado: item["estado"] ?? "prevista",
		motivoCancelamento: item["motivoCancelamento"] ?? null,
		versao: Number(item["versao"] ?? 1)
	};
}
//#endregion
//#region src/telas/Reservas.tsx
/**
* Reservas da viagem (tela 14 de `docs/UX_SCREENS.md`): hospedagem, transporte, passeio e "outro".
*
* Regras que esta tela **não** quebra (decisões V1 §13 e a disciplina de dinheiro do roteiro):
*  - reserva nasce **prevista**; confirmar é ação separada e exige **evidência** (localizador, código,
*    comprovante) — a tela nunca dá a entender que alguém falou com o hotel por nós;
*  - cancelar exige motivo e diz, antes, que isso **não** cancela a reserva no fornecedor;
*  - valor desconhecido aparece como "valor a verificar", nunca como `R$ 0,00`;
*  - tudo entra na fila do aparelho: vale na hora e sobe quando houver rede.
*/
function quando(inicio, fim) {
	if (inicio === null) return "Ainda sem data";
	const formatar = (iso) => new Date(iso).toLocaleString("pt-BR", {
		dateStyle: "short",
		timeStyle: "short"
	});
	return fim === null ? formatar(inicio) : `${formatar(inicio)} → ${formatar(fim)}`;
}
function Reservas({ viagemId, usuarioId, sincronizador, reservas, permissoes }) {
	const [formularioAberto, setFormularioAberto] = useState(false);
	const [tipo, setTipo] = useState("hospedagem");
	const [titulo, setTitulo] = useState("");
	const [local, setLocal] = useState("");
	const [inicio, setInicio] = useState("");
	const [custo, setCusto] = useState("");
	const [acao, setAcao] = useState(null);
	const [textoDaAcao, setTextoDaAcao] = useState("");
	const [erro, setErro] = useState(null);
	const [aviso, setAviso] = useState(null);
	const lista = useMemo(() => ordenarReservas(reservas.map((item) => comoReserva(item)).filter((item) => item !== null)), [reservas]);
	const resumo = useMemo(() => resumirReservas(lista), [lista]);
	const podeCriar = pode(permissoes.criarReserva);
	async function enfileirar(operacao, mensagem) {
		setErro(null);
		await sincronizador.enfileirar(operacao);
		setAviso(mensagem);
	}
	async function criar(evento) {
		evento.preventDefault();
		setErro(null);
		let reserva;
		try {
			reserva = criarReserva({
				id: crypto.randomUUID(),
				viagemId,
				autorId: usuarioId,
				tipo,
				titulo,
				local: local || null,
				inicio: inicio === "" ? null : new Date(inicio).toISOString(),
				custoCentavos: custo.trim() === "" ? null : BigInt(paraCentavos(custo))
			});
		} catch (falha) {
			setErro(falha instanceof Error ? falha.message : "Não foi possível registrar a reserva.");
			return;
		}
		await enfileirar({
			tipo: "criar_reserva",
			viagemId,
			corpo: {
				tipo: reserva.tipo,
				titulo: reserva.titulo,
				local: reserva.local,
				inicio: reserva.inicio,
				fim: null,
				custoCentavos: reserva.custoCentavos === null ? null : reserva.custoCentavos.toString()
			},
			descricao: `Reserva: ${reserva.titulo}`
		}, `${reserva.titulo} entrou como prevista. Confirmar é um passo separado, com evidência.`);
		setTitulo("");
		setLocal("");
		setInicio("");
		setCusto("");
		setFormularioAberto(false);
	}
	async function executarAcao(reserva) {
		setErro(null);
		try {
			if (acao?.tipo === "confirmar") {
				const confirmada = confirmarReserva(reserva, {
					porId: usuarioId,
					confirmacao: textoDaAcao
				});
				await enfileirar({
					tipo: "confirmar_reserva",
					viagemId,
					reservaId: reserva.id,
					confirmacao: confirmada.confirmacao,
					versao: reserva.versao,
					descricao: `Reserva confirmada: ${reserva.titulo}`
				}, `${reserva.titulo} ficou confirmada com a evidência registrada.`);
			} else if (acao?.tipo === "cancelar") {
				const cancelada = cancelarReserva(reserva, {
					porId: usuarioId,
					motivo: textoDaAcao
				});
				await enfileirar({
					tipo: "cancelar_reserva",
					viagemId,
					reservaId: reserva.id,
					motivo: cancelada.motivoCancelamento,
					versao: reserva.versao,
					descricao: `Reserva cancelada: ${reserva.titulo}`
				}, `${reserva.titulo} saiu do previsto. O motivo ficou no histórico.`);
			}
			setAcao(null);
			setTextoDaAcao("");
		} catch (falha) {
			setErro(falha instanceof Error ? falha.message : "Não foi possível concluir a ação.");
		}
	}
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		erro ? /* @__PURE__ */ jsx("div", {
			className: "aviso erro",
			role: "alert",
			children: erro
		}) : null,
		aviso ? /* @__PURE__ */ jsx("div", {
			className: "aviso ok",
			role: "status",
			children: aviso
		}) : null,
		/* @__PURE__ */ jsxs("section", {
			className: "cartao",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "linha entre",
					children: [/* @__PURE__ */ jsx("h2", { children: "Reservas" }), podeCriar ? /* @__PURE__ */ jsx("button", {
						className: "principal compacto",
						onClick: () => setFormularioAberto((aberto) => !aberto),
						children: formularioAberto ? "Fechar" : "Nova reserva"
					}) : null]
				}),
				lista.length === 0 ? /* @__PURE__ */ jsx("p", {
					className: "suave pequeno",
					children: "Nenhuma reserva registrada. Hospedagem, transporte e passeios ficam aqui, com o valor que já foi combinado separado do que ainda é estimativa."
				}) : /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsxs("div", {
						className: "linha",
						children: [/* @__PURE__ */ jsx("span", { children: "Previsto em reservas" }), /* @__PURE__ */ jsx("strong", { children: formatarBRL(resumo.previstoCentavos) })]
					}),
					resumo.compromissoCentavos > 0n ? /* @__PURE__ */ jsxs("div", {
						className: "linha",
						children: [/* @__PURE__ */ jsx("span", { children: "· já combinado" }), /* @__PURE__ */ jsx("span", { children: formatarBRL(resumo.compromissoCentavos) })]
					}) : null,
					resumo.estimativaCentavos > 0n ? /* @__PURE__ */ jsxs("div", {
						className: "linha",
						children: [/* @__PURE__ */ jsx("span", { children: "· estimativa" }), /* @__PURE__ */ jsx("span", { children: formatarBRL(resumo.estimativaCentavos) })]
					}) : null,
					/* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsxs("small", {
						className: "suave",
						children: [resumo.resumo, resumo.semCustoInformado > 0 ? ` · ${resumo.semCustoInformado} sem valor informado` : ""]
					}) })
				] }),
				formularioAberto ? /* @__PURE__ */ jsxs("form", {
					onSubmit: criar,
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "duas-colunas",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "reserva-tipo",
								children: "Tipo"
							}), /* @__PURE__ */ jsx("select", {
								id: "reserva-tipo",
								value: tipo,
								onChange: (evento) => setTipo(evento.target.value),
								children: Object.keys(ROTULO_TIPO_RESERVA).map((chave) => /* @__PURE__ */ jsx("option", {
									value: chave,
									children: ROTULO_TIPO_RESERVA[chave]
								}, chave))
							})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "reserva-titulo",
								children: "Nome"
							}), /* @__PURE__ */ jsx("input", {
								id: "reserva-titulo",
								value: titulo,
								onChange: (evento) => setTitulo(evento.target.value),
								placeholder: "Pousada da Serra",
								required: true,
								minLength: 2
							})] })]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "duas-colunas",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "reserva-local",
								children: "Onde"
							}), /* @__PURE__ */ jsx("input", {
								id: "reserva-local",
								value: local,
								onChange: (evento) => setLocal(evento.target.value),
								placeholder: "Rua das Flores, 120"
							})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "reserva-inicio",
								children: "Quando"
							}), /* @__PURE__ */ jsx("input", {
								id: "reserva-inicio",
								type: "datetime-local",
								value: inicio,
								onChange: (evento) => setInicio(evento.target.value)
							})] })]
						}),
						/* @__PURE__ */ jsx("label", {
							htmlFor: "reserva-custo",
							children: "Valor combinado ou estimado (deixe vazio se ainda não sabe)"
						}),
						/* @__PURE__ */ jsx("input", {
							id: "reserva-custo",
							value: custo,
							onChange: (evento) => setCusto(evento.target.value),
							placeholder: "1200,00",
							inputMode: "decimal"
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "acoes",
							children: [/* @__PURE__ */ jsx("button", {
								className: "principal",
								type: "submit",
								children: "Salvar reserva"
							}), /* @__PURE__ */ jsx("button", {
								className: "sutil",
								type: "button",
								onClick: () => setFormularioAberto(false),
								children: "Cancelar"
							})]
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "suave pequeno",
							children: [
								"A reserva entra como ",
								/* @__PURE__ */ jsx("strong", { children: "prevista" }),
								". Confirmar (com localizador ou comprovante) é um passo separado — o app não confirma nada sozinho."
							]
						})
					]
				}) : null
			]
		}),
		lista.map((reserva) => /* @__PURE__ */ jsxs("section", {
			className: "cartao",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "linha entre",
					children: [/* @__PURE__ */ jsx("h3", { children: reserva.titulo }), /* @__PURE__ */ jsx("span", {
						className: `etiqueta estado-${reserva.estado}`,
						children: ROTULO_ESTADO_RESERVA[reserva.estado]
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "linha",
					children: [/* @__PURE__ */ jsx("span", { children: ROTULO_TIPO_RESERVA[reserva.tipo] }), /* @__PURE__ */ jsx("span", {
						className: "suave",
						children: quando(reserva.inicio, reserva.fim)
					})]
				}),
				reserva.local ? /* @__PURE__ */ jsx("div", {
					className: "linha",
					children: /* @__PURE__ */ jsx("span", {
						className: "suave",
						children: reserva.local
					})
				}) : null,
				/* @__PURE__ */ jsxs("div", {
					className: "linha",
					children: [/* @__PURE__ */ jsx("span", { children: "Valor" }), reserva.custoCentavos === null ? /* @__PURE__ */ jsx("span", {
						className: "custo-a-verificar",
						children: reserva.custoAVerificar ? "Valor a verificar" : "Sem valor informado"
					}) : /* @__PURE__ */ jsx("strong", { children: formatarBRL(reserva.custoCentavos) })]
				}),
				reserva.confirmacao ? /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsxs("small", {
					className: "suave",
					children: [
						"Confirmação: “",
						reserva.confirmacao,
						"”",
						reserva.confirmadaEm ? ` · ${new Date(reserva.confirmadaEm).toLocaleString("pt-BR")}` : ""
					]
				}) }) : null,
				reserva.motivoCancelamento ? /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsxs("small", {
					className: "suave",
					children: ["Motivo do cancelamento: ", reserva.motivoCancelamento]
				}) }) : null,
				reserva.estado !== "cancelada" ? /* @__PURE__ */ jsxs("div", {
					className: "acoes",
					children: [pode(permissoes.confirmarReserva) && reserva.estado === "prevista" ? /* @__PURE__ */ jsx("button", {
						className: "sutil",
						onClick: () => {
							setAcao({
								reservaId: reserva.id,
								tipo: "confirmar"
							});
							setTextoDaAcao("");
						},
						children: "Confirmar reserva"
					}) : null, pode(permissoes.cancelarReserva) ? /* @__PURE__ */ jsx("button", {
						className: "perigo",
						onClick: () => {
							setAcao({
								reservaId: reserva.id,
								tipo: "cancelar"
							});
							setTextoDaAcao("");
						},
						children: "Cancelar reserva"
					}) : null]
				}) : null,
				acao?.reservaId === reserva.id ? /* @__PURE__ */ jsxs("div", {
					className: "impacto",
					children: [
						/* @__PURE__ */ jsx("h3", { children: "Antes de continuar: o que isso muda" }),
						/* @__PURE__ */ jsx("ul", { children: revisarImpactoDaReserva(reserva, acao.tipo).itens.map((item) => /* @__PURE__ */ jsx("li", { children: item }, item)) }),
						revisarImpactoDaReserva(reserva, acao.tipo).atencao.length > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("h4", { children: "Atenção" }), /* @__PURE__ */ jsx("ul", {
							className: "impacto-atencao",
							children: revisarImpactoDaReserva(reserva, acao.tipo).atencao.map((item) => /* @__PURE__ */ jsx("li", { children: item }, item))
						})] }) : null,
						/* @__PURE__ */ jsx("label", {
							htmlFor: `reserva-acao-${reserva.id}`,
							children: acao.tipo === "confirmar" ? "Evidência da confirmação (código, localizador ou comprovante)" : "Motivo do cancelamento"
						}),
						/* @__PURE__ */ jsx("input", {
							id: `reserva-acao-${reserva.id}`,
							value: textoDaAcao,
							onChange: (evento) => setTextoDaAcao(evento.target.value),
							placeholder: acao.tipo === "confirmar" ? "Localizador ABC123" : "Pousada fechou para reforma"
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "acoes",
							children: [/* @__PURE__ */ jsx("button", {
								className: acao.tipo === "confirmar" ? "principal" : "perigo",
								onClick: () => void executarAcao(reserva),
								children: acao.tipo === "confirmar" ? "Registrar confirmação" : "Registrar cancelamento"
							}), /* @__PURE__ */ jsx("button", {
								className: "sutil",
								onClick: () => setAcao(null),
								children: "Voltar"
							})]
						})
					]
				}) : null
			]
		}, reserva.id))
	] });
}
//#endregion
//#region src/telas/Orcamento.tsx
/**
* Orçamento da viagem (tela 9 / decisões V1 §7 e §8): limite com barra, na aba Gastos.
*
* Regras que a tela **não** quebra:
*  - o limite é **planejamento**; o gasto oficial continua sendo só o confirmado no servidor;
*  - o previsto aparece como "mínimo" enquanto houver custo a verificar;
*  - sem conexão, o aparelho mostra o **previsto** (que ele calcula do roteiro e das reservas) e diz
*    com todas as letras que o número oficial precisa do servidor — nunca inventa saldo;
*  - definir limite coletivo é do organizador; o individual é de cada pessoa (§13: permissão não se
*    decide no cliente — aqui só se mostra o que o servidor permitiu).
*/
function Orcamento({ viagemId, usuarioId, sincronizador, atividades, reservas, gastoConfirmadoCentavos, aguardandoCentavos, saldosEm, ehOrganizador, permissoes }) {
	const [doServidor, setDoServidor] = useState(null);
	/** Por que o número do servidor não chegou: a tela explica o caso certo, sem culpar a rede à toa. */
	const [motivoSemServidor, setMotivoSemServidor] = useState(null);
	const [erro, setErro] = useState(null);
	const [aviso, setAviso] = useState(null);
	const [coletivo, setColetivo] = useState("");
	const [individual, setIndividual] = useState("");
	const [editando, setEditando] = useState(false);
	const [enviando, setEnviando] = useState(false);
	useEffect(() => {
		let vivo = true;
		sincronizador.sincronizarAgora().finally(async () => {
			try {
				const resposta = await api.orcamento(viagemId);
				if (!vivo) return;
				setDoServidor(resposta);
				setMotivoSemServidor(null);
			} catch (falha) {
				if (!vivo) return;
				setMotivoSemServidor(falha instanceof ErroApi ? "sem_resposta" : "sem_rede");
			}
		});
		return () => {
			vivo = false;
		};
	}, [viagemId, sincronizador]);
	/**
	* Previsto calculado no aparelho (roteiro + reservas) — o mesmo cálculo que o servidor faz.
	* A separação entre "já combinado" e "estimativa" vem daqui também: é o que impede o número de
	* parecer mais firme do que é (decisão V1 §8).
	*/
	const previstoLocal = useMemo(() => {
		const roteiro = resumirOrcamentoDoRoteiro(atividades);
		const deReservas = resumirReservas(reservas);
		return {
			previstoCentavos: roteiro.previstoCentavos + deReservas.previstoCentavos,
			custosAVerificar: roteiro.aVerificar + deReservas.semCustoInformado,
			compromissoCentavos: roteiro.compromissoCentavos + deReservas.compromissoCentavos,
			estimativaCentavos: roteiro.estimativaCentavos + deReservas.estimativaCentavos,
			deReservasCentavos: deReservas.previstoCentavos,
			semCustoInformadoReservas: deReservas.semCustoInformado
		};
	}, [atividades, reservas]);
	const situacao = useMemo(() => {
		if (doServidor) return {
			temLimite: doServidor.situacao.temLimite,
			limiteCentavos: doServidor.situacao.limiteCentavos === null ? null : BigInt(doServidor.situacao.limiteCentavos),
			previstoCentavos: BigInt(doServidor.situacao.previstoCentavos),
			gastoConfirmadoCentavos: BigInt(doServidor.situacao.gastoConfirmadoCentavos),
			aguardandoCentavos: BigInt(doServidor.situacao.aguardandoCentavos),
			restantePrevistoCentavos: doServidor.situacao.restantePrevistoCentavos === null ? null : BigInt(doServidor.situacao.restantePrevistoCentavos),
			restanteGastoCentavos: doServidor.situacao.restanteGastoCentavos === null ? null : BigInt(doServidor.situacao.restanteGastoCentavos),
			percentualPrevisto: doServidor.situacao.percentualPrevisto,
			percentualGasto: doServidor.situacao.percentualGasto,
			estado: doServidor.situacao.estado,
			alertas: doServidor.situacao.alertas,
			resumo: doServidor.situacao.resumo
		};
		return situacaoDoOrcamento({
			limiteCentavos: null,
			previstoCentavos: previstoLocal.previstoCentavos,
			gastoConfirmadoCentavos: gastoConfirmadoCentavos === null ? 0n : BigInt(gastoConfirmadoCentavos),
			aguardandoCentavos: aguardandoCentavos === null ? 0n : BigInt(aguardandoCentavos),
			custosAVerificar: previstoLocal.custosAVerificar
		});
	}, [
		doServidor,
		previstoLocal,
		gastoConfirmadoCentavos,
		aguardandoCentavos
	]);
	const comServidor = doServidor !== null;
	const custosAVerificar = doServidor?.planejamento.custosAVerificar ?? previstoLocal.custosAVerificar;
	const semLimite = !situacao.temLimite;
	const percentual = situacao.percentualPrevisto ?? 0;
	const largura = Math.min(100, Math.max(0, percentual));
	const restante = situacao.restantePrevistoCentavos;
	async function definir(escopo) {
		const texto = escopo === "coletivo" ? coletivo : individual;
		setErro(null);
		setAviso(null);
		let centavos;
		try {
			centavos = paraCentavos(texto);
		} catch (falha) {
			setErro(falha instanceof Error ? falha.message : "Valor inválido.");
			return;
		}
		setEnviando(true);
		try {
			if (escopo === "coletivo") {
				const resposta = await api.definirLimiteColetivo(viagemId, centavos);
				setAviso(`Limite da viagem: ${formatarBRL(resposta.limite.centavos)}. Vale como planejamento do grupo.`);
				setColetivo("");
			} else {
				const resposta = await api.definirLimiteIndividual(viagemId, usuarioId, centavos);
				setAviso(`Seu limite nesta viagem: ${formatarBRL(resposta.limite.centavos)}.`);
				setIndividual("");
			}
			const atualizado = await api.orcamento(viagemId);
			setDoServidor(atualizado);
			setEditando(false);
		} catch (falha) {
			setErro(falha instanceof ErroApi ? falha.message : "Não foi possível salvar o limite agora.");
		} finally {
			setEnviando(false);
		}
	}
	const podeColetivo = ehOrganizador && pode(permissoes.definirLimite);
	const podeIndividual = pode(permissoes.definirLimiteProprio);
	return /* @__PURE__ */ jsxs("section", {
		className: "cartao",
		"aria-labelledby": "titulo-orcamento",
		children: [
			/* @__PURE__ */ jsx("h2", {
				id: "titulo-orcamento",
				children: "Orçamento da viagem"
			}),
			semLimite ? /* @__PURE__ */ jsxs("p", { children: [
				"Nenhum limite definido. Você pode combinar um teto — ele serve de ",
				/* @__PURE__ */ jsx("strong", { children: "planejamento" }),
				", não bloqueia nada."
			] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("div", {
					className: "linha entre",
					children: [/* @__PURE__ */ jsxs("span", { children: [
						formatarBRL(situacao.previstoCentavos),
						" de ",
						/* @__PURE__ */ jsx("strong", { children: formatarBRL(situacao.limiteCentavos ?? 0n) })
					] }), /* @__PURE__ */ jsx("span", {
						className: `etiqueta estado-orcamento-${situacao.estado}`,
						children: ROTULO_ESTADO_ORCAMENTO[situacao.estado]
					})]
				}),
				/* @__PURE__ */ jsx("div", {
					className: `barra-orcamento preenchimento-${situacao.estado}`,
					role: "progressbar",
					"aria-valuemin": 0,
					"aria-valuemax": 100,
					"aria-valuenow": largura,
					"aria-label": `Orçamento previsto: ${largura}% do limite`,
					children: /* @__PURE__ */ jsx("div", {
						className: "preenchimento",
						style: { width: `${largura}%` }
					})
				}),
				/* @__PURE__ */ jsxs("p", {
					className: "suave pequeno",
					children: [
						percentual,
						"% do limite em planejamento.",
						situacao.estado === "estourado" ? " O previsto passou do combinado — combine mais ou reveja o roteiro." : restante !== null && restante > 0n ? ` Ainda cabem ${formatarBRL(restante)} de planejamento.` : ""
					]
				})
			] }),
			/* @__PURE__ */ jsxs("div", {
				className: "linha",
				children: [/* @__PURE__ */ jsx("span", { children: "Gasto confirmado (oficial)" }), /* @__PURE__ */ jsx("strong", { children: formatarBRL(situacao.gastoConfirmadoCentavos) })]
			}),
			situacao.limiteCentavos !== null && situacao.gastoConfirmadoCentavos > 0n ? /* @__PURE__ */ jsxs("p", {
				className: "suave pequeno",
				children: [
					"Do gasto confirmado, ",
					formatarBRL(situacao.gastoConfirmadoCentavos),
					" de ",
					formatarBRL(situacao.limiteCentavos),
					" —",
					" ",
					situacao.percentualGasto ?? 0,
					"% do teto."
				]
			}) : null,
			situacao.aguardandoCentavos > 0n ? /* @__PURE__ */ jsxs("p", {
				className: "suave pequeno",
				children: ["Aguardando confirmação (fora do oficial): ", formatarBRL(situacao.aguardandoCentavos)]
			}) : null,
			!comServidor ? /* @__PURE__ */ jsx("div", {
				className: "aviso atencao",
				children: motivoSemServidor === "sem_resposta" ? "O servidor não devolveu o orçamento desta viagem agora: abaixo está o previsto calculado no aparelho. O gasto oficial e o limite combinado aparecem quando o servidor responder." : "Sem conexão agora: o previsto vem do que está no aparelho. O gasto confirmado e o limite combinado precisam do servidor para aparecer atualizados."
			}) : null,
			/* @__PURE__ */ jsx("h3", {
				style: { marginTop: 12 },
				children: "Previsto (planejamento)"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "linha",
				children: [/* @__PURE__ */ jsx("span", { children: "Previsto (estimativas + combinado)" }), /* @__PURE__ */ jsx("strong", { children: formatarBRL(previstoLocal.previstoCentavos) })]
			}),
			previstoLocal.compromissoCentavos > 0n ? /* @__PURE__ */ jsxs("div", {
				className: "linha",
				children: [/* @__PURE__ */ jsx("span", { children: "· já combinado" }), /* @__PURE__ */ jsx("span", { children: formatarBRL(previstoLocal.compromissoCentavos) })]
			}) : null,
			previstoLocal.estimativaCentavos > 0n ? /* @__PURE__ */ jsxs("div", {
				className: "linha",
				children: [/* @__PURE__ */ jsx("span", { children: "· estimativa" }), /* @__PURE__ */ jsx("span", { children: formatarBRL(previstoLocal.estimativaCentavos) })]
			}) : null,
			previstoLocal.deReservasCentavos > 0n ? /* @__PURE__ */ jsxs("div", {
				className: "linha",
				children: [/* @__PURE__ */ jsx("span", { children: "· reservas" }), /* @__PURE__ */ jsx("span", { children: formatarBRL(previstoLocal.deReservasCentavos) })]
			}) : null,
			situacao.alertas.length > 0 ? /* @__PURE__ */ jsx("ul", {
				className: "lista-alertas custo-a-verificar",
				children: situacao.alertas.map((alerta) => /* @__PURE__ */ jsx("li", { children: alerta }, alerta))
			}) : null,
			/* @__PURE__ */ jsxs("p", {
				className: "suave pequeno",
				children: [
					"O previsto e o limite são ",
					/* @__PURE__ */ jsx("strong", { children: "planejamento" }),
					": não entram no saldo oficial e não substituem a despesa registrada. Gastar de verdade é o que aparece em \"Gasto confirmado\", confirmado no servidor.",
					custosAVerificar > 0 ? " Enquanto houver custo a verificar, o previsto é o valor mínimo." : "",
					comServidor && saldosEm ? ` Números do servidor de ${new Date(saldosEm).toLocaleString("pt-BR")}.` : ""
				]
			}),
			editando ? /* @__PURE__ */ jsxs(Fragment, { children: [podeColetivo ? /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsx("label", {
					htmlFor: "orcamento-coletivo",
					children: "Limite da viagem (ex.: 3.000,00)"
				}),
				/* @__PURE__ */ jsx("input", {
					id: "orcamento-coletivo",
					inputMode: "decimal",
					value: coletivo,
					onChange: (evento) => setColetivo(evento.target.value),
					placeholder: "3000,00"
				}),
				/* @__PURE__ */ jsx("div", {
					className: "acoes",
					children: /* @__PURE__ */ jsx("button", {
						className: "principal",
						disabled: enviando || coletivo.trim() === "",
						onClick: () => void definir("coletivo"),
						children: "Salvar limite do grupo"
					})
				})
			] }) : /* @__PURE__ */ jsx("p", {
				className: "suave pequeno",
				children: "Só quem organiza define o limite do grupo."
			}), podeIndividual ? /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsx("label", {
					htmlFor: "orcamento-individual",
					children: "Meu limite individual (opcional)"
				}),
				/* @__PURE__ */ jsx("input", {
					id: "orcamento-individual",
					inputMode: "decimal",
					value: individual,
					onChange: (evento) => setIndividual(evento.target.value),
					placeholder: "800,00"
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "acoes",
					children: [/* @__PURE__ */ jsx("button", {
						className: "sutil",
						disabled: enviando || individual.trim() === "",
						onClick: () => void definir("individual"),
						children: "Salvar meu limite"
					}), /* @__PURE__ */ jsx("button", {
						className: "sutil",
						onClick: () => setEditando(false),
						children: "Fechar"
					})]
				})
			] }) : /* @__PURE__ */ jsx("p", {
				className: "suave pequeno",
				children: permissoes.definirLimiteProprio?.motivo ?? "Seu limite individual não está disponível agora."
			})] }) : /* @__PURE__ */ jsx("div", {
				className: "acoes",
				children: /* @__PURE__ */ jsx("button", {
					className: "sutil",
					onClick: () => setEditando(true),
					children: semLimite ? "Definir limite" : "Ajustar limite"
				})
			}),
			doServidor && doServidor.limitesIndividuais.length > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("h3", {
				style: { marginTop: 12 },
				children: "Limites individuais"
			}), doServidor.limitesIndividuais.map((limite) => /* @__PURE__ */ jsxs("div", {
				className: "linha",
				children: [/* @__PURE__ */ jsx("span", { children: limite.usuarioId === usuarioId ? `${limite.nome ?? "você"} (você)` : limite.nome ?? "participante" }), /* @__PURE__ */ jsx("span", { children: formatarBRL(limite.centavos) })]
			}, limite.id))] }) : null,
			aviso ? /* @__PURE__ */ jsx("div", {
				className: "aviso ok",
				children: aviso
			}) : null,
			erro ? /* @__PURE__ */ jsx("div", {
				className: "aviso erro",
				children: erro
			}) : null
		]
	});
}
//#endregion
//#region src/telas/Checklist.tsx
/**
* Checklist da viagem (tela 15).
*
* Regras que esta tela respeita (`packages/domain/src/checklist.ts`):
*  - **prazo não conclui nada**: atraso é rótulo de leitura, quem conclui é uma pessoa;
*  - concluir registra quem e quando; reabrir exige motivo (é o que explica o item voltar);
*  - item novo entra na **fila do aparelho**: vale na hora e sobe quando houver rede;
*  - a ordem de leitura é do domínio (atrasado → prazo mais próximo → sem prazo → feito).
*/
/** Id local para validação no domínio (o servidor gera o definitivo quando o item sobe). */
function idLocal() {
	return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function Checklist({ viagemId, usuarioId, sincronizador, itens, participantes, permissoes }) {
	const [formularioAberto, setFormularioAberto] = useState(false);
	const [titulo, setTitulo] = useState("");
	const [categoria, setCategoria] = useState("outro");
	const [responsavelId, setResponsavelId] = useState("");
	const [prazo, setPrazo] = useState("");
	const [erro, setErro] = useState(null);
	const [aviso, setAviso] = useState(null);
	const [reabrindo, setReabrindo] = useState(null);
	const hoje = hojeIso();
	const lista = useMemo(() => ordenarChecklist(itens, hoje), [itens, hoje]);
	const resumo = useMemo(() => resumirChecklist(itens, hoje), [itens, hoje]);
	const podeCriar = permissoes.criarItemChecklist?.permitido !== false;
	const podeConcluir = permissoes.concluirItemChecklist?.permitido !== false;
	const pessoas = useMemo(() => participantes.filter((pessoa) => pessoa.estado === "ativo"), [participantes]);
	function nomeDe(usuarioId) {
		if (usuarioId === null) return "sem responsável";
		return pessoas.find((pessoa) => pessoa.usuario_id === usuarioId)?.nome ?? "participante";
	}
	async function enfileirar(operacao, mensagem) {
		setErro(null);
		await sincronizador.enfileirar(operacao);
		setAviso(sincronizador.obter().online ? mensagem : `${mensagem} Ficou guardado no aparelho e sobe quando o sinal voltar.`);
	}
	async function criar() {
		setErro(null);
		setAviso(null);
		let entrada;
		try {
			entrada = criarItemChecklist({
				id: idLocal(),
				viagemId,
				autorId: usuarioId,
				titulo,
				categoria,
				responsavelId: responsavelId === "" ? null : responsavelId,
				prazo: prazo === "" ? null : prazo
			});
		} catch (falha) {
			setErro(falha instanceof Error ? falha.message : "Não foi possível criar o item.");
			return;
		}
		await enfileirar({
			tipo: "criar_item_checklist",
			viagemId,
			corpo: {
				titulo: entrada.titulo,
				categoria: entrada.categoria,
				responsavelId: entrada.responsavelId,
				prazo: entrada.prazo
			},
			descricao: `Checklist: ${entrada.titulo}`
		}, "Item adicionado ao checklist.");
		setTitulo("");
		setCategoria("outro");
		setResponsavelId("");
		setPrazo("");
		setFormularioAberto(false);
	}
	async function concluir(item) {
		setErro(null);
		try {
			concluirItem(item, { porId: usuarioId });
		} catch (falha) {
			setErro(falha instanceof Error ? falha.message : "Não foi possível concluir o item.");
			return;
		}
		await enfileirar({
			tipo: "concluir_item_checklist",
			viagemId,
			itemId: item.id,
			versao: item.versao,
			descricao: `Checklist: ${item.titulo} concluído`
		}, "Item concluído. Fica registrado quem marcou e quando.");
	}
	async function reabrir() {
		if (!reabrindo) return;
		const item = itens.find((candidato) => candidato.id === reabrindo.itemId);
		if (!item) return;
		setErro(null);
		try {
			reabrirItem(item, {
				porId: usuarioId,
				motivo: reabrindo.motivo
			});
		} catch (falha) {
			setErro(falha instanceof Error ? falha.message : "Informe o motivo da reabertura.");
			return;
		}
		await enfileirar({
			tipo: "reabrir_item_checklist",
			viagemId,
			itemId: item.id,
			motivo: reabrindo.motivo.trim(),
			versao: item.versao,
			descricao: `Checklist: ${item.titulo} reaberto`
		}, "Item reaberto com o motivo registrado.");
		setReabrindo(null);
	}
	return /* @__PURE__ */ jsxs("section", {
		className: "cartao",
		"aria-labelledby": "titulo-checklist",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "linha entre",
				children: [/* @__PURE__ */ jsx("h2", {
					id: "titulo-checklist",
					children: "Checklist"
				}), podeCriar ? /* @__PURE__ */ jsx("button", {
					className: "sutil",
					onClick: () => setFormularioAberto((aberto) => !aberto),
					children: formularioAberto ? "Fechar" : "Novo item"
				}) : null]
			}),
			/* @__PURE__ */ jsx("p", {
				className: "suave pequeno",
				children: resumo.resumo
			}),
			formularioAberto ? /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsx("label", {
					htmlFor: "checklist-titulo",
					children: "O que precisa acontecer"
				}),
				/* @__PURE__ */ jsx("input", {
					id: "checklist-titulo",
					value: titulo,
					onChange: (evento) => setTitulo(evento.target.value),
					placeholder: "Ex.: levar o passaporte"
				}),
				/* @__PURE__ */ jsx("label", {
					htmlFor: "checklist-categoria",
					children: "Categoria"
				}),
				/* @__PURE__ */ jsx("select", {
					id: "checklist-categoria",
					value: categoria,
					onChange: (evento) => setCategoria(evento.target.value),
					children: CATEGORIAS_CHECKLIST.map((valor) => /* @__PURE__ */ jsx("option", {
						value: valor,
						children: ROTULO_CATEGORIA_CHECKLIST[valor]
					}, valor))
				}),
				/* @__PURE__ */ jsx("label", {
					htmlFor: "checklist-responsavel",
					children: "Quem cuida disso (opcional)"
				}),
				/* @__PURE__ */ jsxs("select", {
					id: "checklist-responsavel",
					value: responsavelId,
					onChange: (evento) => setResponsavelId(evento.target.value),
					children: [/* @__PURE__ */ jsx("option", {
						value: "",
						children: "sem responsável"
					}), pessoas.map((pessoa) => /* @__PURE__ */ jsx("option", {
						value: pessoa.usuario_id,
						children: pessoa.nome
					}, pessoa.usuario_id))]
				}),
				/* @__PURE__ */ jsx("label", {
					htmlFor: "checklist-prazo",
					children: "Prazo (opcional)"
				}),
				/* @__PURE__ */ jsx("input", {
					id: "checklist-prazo",
					type: "date",
					value: prazo,
					onChange: (evento) => setPrazo(evento.target.value)
				}),
				/* @__PURE__ */ jsx("p", {
					className: "suave pequeno",
					children: "O prazo é só um aviso de leitura: quando a data passa, o item continua em aberto — quem conclui é uma pessoa, não o calendário."
				}),
				/* @__PURE__ */ jsx("div", {
					className: "acoes",
					children: /* @__PURE__ */ jsx("button", {
						className: "principal",
						disabled: titulo.trim().length < 3,
						onClick: () => void criar(),
						children: "Adicionar item"
					})
				})
			] }) : null,
			lista.length === 0 ? /* @__PURE__ */ jsx("p", { children: "Nada no checklist ainda. O que não pode ser esquecido entra aqui." }) : /* @__PURE__ */ jsx("ul", {
				className: "lista-checklist",
				children: lista.map((item) => {
					const feito = item.estado === "feito";
					const atrasado = itemAtrasado(item, hoje);
					const paraHoje = itemParaHoje(item, hoje);
					return /* @__PURE__ */ jsxs("li", {
						className: feito ? "item-feito" : atrasado ? "item-atrasado" : void 0,
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "linha entre",
								children: [/* @__PURE__ */ jsxs("span", { children: [
									/* @__PURE__ */ jsx("strong", { children: item.titulo }),
									/* @__PURE__ */ jsx("br", {}),
									/* @__PURE__ */ jsxs("small", {
										className: "suave",
										children: [
											ROTULO_CATEGORIA_CHECKLIST[item.categoria],
											" · ",
											nomeDe(item.responsavelId),
											item.prazo !== null ? ` · prazo ${item.prazo.split("-").reverse().join("/")}` : " · sem prazo",
											atrasado ? " · atrasado" : paraHoje ? " · para hoje" : ""
										]
									})
								] }), /* @__PURE__ */ jsx("span", {
									className: `etiqueta ${feito ? "estado-concluida" : atrasado ? "estado-pendente" : "estado-planejada"}`,
									children: feito ? "Feito" : atrasado ? "Atrasado" : "Em aberto"
								})]
							}),
							feito ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("p", {
								className: "suave pequeno",
								children: [
									"Concluído por ",
									nomeDe(item.feitoPor),
									item.feitoEm ? ` em ${new Date(item.feitoEm).toLocaleString("pt-BR")}` : "",
									"."
								]
							}), /* @__PURE__ */ jsx("button", {
								className: "sutil",
								onClick: () => setReabrindo({
									itemId: item.id,
									motivo: ""
								}),
								children: "Reabrir item"
							})] }) : podeConcluir ? /* @__PURE__ */ jsx("div", {
								className: "acoes",
								children: /* @__PURE__ */ jsx("button", {
									className: "principal compacto",
									onClick: () => void concluir(item),
									children: "Marcar como feito"
								})
							}) : /* @__PURE__ */ jsx("p", {
								className: "suave pequeno",
								children: permissoes.concluirItemChecklist?.motivo
							}),
							reabrindo?.itemId === item.id ? /* @__PURE__ */ jsxs(Fragment, { children: [
								/* @__PURE__ */ jsx("label", {
									htmlFor: `checklist-reabrir-${item.id}`,
									children: "Motivo da reabertura (mínimo 5 caracteres)"
								}),
								/* @__PURE__ */ jsx("input", {
									id: `checklist-reabrir-${item.id}`,
									value: reabrindo.motivo,
									onChange: (evento) => setReabrindo({
										itemId: item.id,
										motivo: evento.target.value
									})
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "acoes",
									children: [/* @__PURE__ */ jsx("button", {
										className: "principal compacto",
										onClick: () => void reabrir(),
										children: "Reabrir"
									}), /* @__PURE__ */ jsx("button", {
										className: "sutil",
										onClick: () => setReabrindo(null),
										children: "Cancelar"
									})]
								})
							] }) : null
						]
					}, item.id);
				})
			}),
			!podeCriar ? /* @__PURE__ */ jsx("p", {
				className: "suave pequeno",
				children: permissoes.criarItemChecklist?.motivo
			}) : null,
			aviso ? /* @__PURE__ */ jsx("div", {
				className: "aviso ok",
				children: aviso
			}) : null,
			erro ? /* @__PURE__ */ jsx("div", {
				className: "aviso erro",
				children: erro
			}) : null
		]
	});
}
//#endregion
//#region src/telas/Documentos.tsx
/**
* Documentos da viagem (tela 16).
*
* Regras que esta tela respeita (decisões V1 §13 e `packages/domain/src/documento.ts`):
*  - documento **nasce privado**: só quem criou vê, e ninguém — nem quem organiza — vê o conteúdo
*    antes de um compartilhamento explícito (o servidor responde 404 para quem não pode ver);
*  - compartilhar e remover são passos separados, com **revisão de impacto antes**;
*  - remover exige motivo e a tela diz que nada é apagado em definitivo;
*  - o app guarda **link e descrição**; o arquivo continua onde a pessoa o colocou — a tela nunca
*    dá a entender que o Lia Go copiou, enviou ou guardou o arquivo.
*/
/** Chave de idempotência da criação (reenvio nunca duplica o documento). */
function idDeOperacao() {
	return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function Documentos({ viagemId, usuarioId, sincronizador, documentos, participantes, ehOrganizador, avisoDePrivacidade }) {
	const [formularioAberto, setFormularioAberto] = useState(false);
	const [tipo, setTipo] = useState("passagem");
	const [nome, setNome] = useState("");
	const [descricao, setDescricao] = useState("");
	const [link, setLink] = useState("");
	const [erro, setErro] = useState(null);
	const [aviso, setAviso] = useState(null);
	const [acao, setAcao] = useState(null);
	const [impacto, setImpacto] = useState(null);
	const [motivo, setMotivo] = useState("");
	const [escolhidos, setEscolhidos] = useState([]);
	const lista = useMemo(() => documentos.filter((documento) => podeVerDocumento(documento, usuarioId, { ehOrganizador })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [
		documentos,
		usuarioId,
		ehOrganizador
	]);
	const resumo = useMemo(() => resumirDocumentos(documentos), [documentos]);
	const pessoas = useMemo(() => participantes.filter((pessoa) => pessoa.estado === "ativo" && pessoa.usuario_id !== usuarioId), [participantes, usuarioId]);
	function nomeDe(usuarioId) {
		return participantes.find((pessoa) => pessoa.usuario_id === usuarioId)?.nome ?? "participante";
	}
	async function recarregar() {
		await sincronizador.sincronizarAgora();
	}
	async function criar() {
		setErro(null);
		setAviso(null);
		try {
			await api.criarDocumento(viagemId, {
				tipo,
				nome,
				descricao: descricao.trim() === "" ? null : descricao,
				link: link.trim() === "" ? null : link
			}, idDeOperacao());
			setAviso("Documento guardado como privado. Só você vê até compartilhar.");
			setNome("");
			setDescricao("");
			setLink("");
			setTipo("passagem");
			setFormularioAberto(false);
			await recarregar();
		} catch (falha) {
			setErro(falha instanceof ErroApi ? falha.message : "Não foi possível salvar o documento agora.");
		}
	}
	async function abrirAcao(documento, tipoDaAcao) {
		setErro(null);
		setAviso(null);
		setAcao({
			documento,
			tipo: tipoDaAcao
		});
		setImpacto(null);
		setMotivo("");
		setEscolhidos([]);
		try {
			const resposta = await api.impactoDocumento(viagemId, documento.id, tipoDaAcao);
			setImpacto(resposta.impacto);
		} catch {
			setImpacto(null);
		}
	}
	async function confirmarAcao() {
		if (!acao) return;
		setErro(null);
		try {
			if (acao.tipo === "compartilhar") {
				const com = escolhidos.length === 0 ? "viagem" : escolhidos;
				await api.compartilharDocumento(viagemId, acao.documento.id, com, acao.documento.versao);
				setAviso(com === "viagem" ? "Compartilhado com a viagem: todo mundo com acesso ativo vê o link e a descrição." : `Compartilhado com ${escolhidos.map(nomeDe).join(", ")}. Dá para revogar quando quiser.`);
			} else {
				await api.removerDocumento(viagemId, acao.documento.id, motivo, acao.documento.versao);
				setAviso("Documento removido da lista. O registro e o motivo continuam guardados com quem organiza.");
			}
			setAcao(null);
			await recarregar();
		} catch (falha) {
			setErro(falha instanceof ErroApi ? falha.message : "Não foi possível concluir a ação agora.");
		}
	}
	async function revogar(documento) {
		setErro(null);
		try {
			await api.revogarDocumento(viagemId, documento.id, "viagem", documento.versao);
			setAviso("Acesso revogado: o documento voltou a ser só seu.");
			await recarregar();
		} catch (falha) {
			setErro(falha instanceof ErroApi ? falha.message : "Não foi possível revogar o acesso agora.");
		}
	}
	return /* @__PURE__ */ jsxs("section", {
		className: "cartao",
		"aria-labelledby": "titulo-documentos",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "linha entre",
				children: [/* @__PURE__ */ jsx("h2", {
					id: "titulo-documentos",
					children: "Documentos"
				}), /* @__PURE__ */ jsx("button", {
					className: "sutil",
					onClick: () => setFormularioAberto((aberto) => !aberto),
					children: formularioAberto ? "Fechar" : "Novo documento"
				})]
			}),
			/* @__PURE__ */ jsx("p", {
				className: "suave pequeno",
				children: avisoDePrivacidade ?? "Documento começa privado: só quem criou vê. Compartilhar é um passo separado e pode ser revogado."
			}),
			/* @__PURE__ */ jsx("p", {
				className: "suave pequeno",
				children: resumo.resumo
			}),
			formularioAberto ? /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsx("label", {
					htmlFor: "documento-tipo",
					children: "Tipo"
				}),
				/* @__PURE__ */ jsx("select", {
					id: "documento-tipo",
					value: tipo,
					onChange: (evento) => setTipo(evento.target.value),
					children: TIPOS_DE_DOCUMENTO.map((valor) => /* @__PURE__ */ jsx("option", {
						value: valor,
						children: ROTULO_TIPO_DOCUMENTO[valor]
					}, valor))
				}),
				/* @__PURE__ */ jsx("label", {
					htmlFor: "documento-nome",
					children: "Nome"
				}),
				/* @__PURE__ */ jsx("input", {
					id: "documento-nome",
					value: nome,
					onChange: (evento) => setNome(evento.target.value),
					placeholder: "Ex.: Voo GRU–LIS"
				}),
				/* @__PURE__ */ jsx("label", {
					htmlFor: "documento-descricao",
					children: "Descrição (opcional)"
				}),
				/* @__PURE__ */ jsx("input", {
					id: "documento-descricao",
					value: descricao,
					onChange: (evento) => setDescricao(evento.target.value),
					placeholder: "Ex.: localizador ABC123, saída 22h"
				}),
				/* @__PURE__ */ jsx("label", {
					htmlFor: "documento-link",
					children: "Link (opcional)"
				}),
				/* @__PURE__ */ jsx("input", {
					id: "documento-link",
					value: link,
					onChange: (evento) => setLink(evento.target.value),
					placeholder: "https://…",
					inputMode: "url"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "suave pequeno",
					children: "O Lia Go guarda o link e a descrição — o arquivo continua onde você o colocou. Nada de binário é copiado para cá."
				}),
				/* @__PURE__ */ jsx("div", {
					className: "acoes",
					children: /* @__PURE__ */ jsx("button", {
						className: "principal",
						disabled: nome.trim().length < 2,
						onClick: () => void criar(),
						children: "Salvar como privado"
					})
				})
			] }) : null,
			lista.length === 0 ? /* @__PURE__ */ jsx("p", { children: "Nenhum documento ainda. Passagens, seguros e ingressos ficam aqui — privados até você compartilhar." }) : /* @__PURE__ */ jsx("ul", {
				className: "lista-documentos",
				children: lista.map((documento) => {
					const removido = documento.estado === "removido";
					const soVisualizacao = documento.autorId !== usuarioId && !ehOrganizador;
					const compartilhado = documento.visibilidade === "viagem" || documento.compartilhadoCom.length > 0;
					return /* @__PURE__ */ jsxs("li", {
						className: removido ? "item-removido" : void 0,
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "linha entre",
								children: [/* @__PURE__ */ jsxs("span", { children: [
									/* @__PURE__ */ jsx("strong", { children: documento.nome }),
									/* @__PURE__ */ jsx("br", {}),
									/* @__PURE__ */ jsxs("small", {
										className: "suave",
										children: [
											ROTULO_TIPO_DOCUMENTO[documento.tipo],
											" · ",
											nomeDe(documento.autorId),
											documento.descricao ? ` · ${documento.descricao}` : ""
										]
									})
								] }), /* @__PURE__ */ jsx("span", {
									className: `etiqueta ${removido ? "estado-cancelada" : compartilhado ? "estado-em_andamento" : "estado-rascunho"}`,
									children: removido ? "Removido" : compartilhado ? "Compartilhado" : "Só você"
								})]
							}),
							documento.link ? /* @__PURE__ */ jsxs("p", { children: [
								/* @__PURE__ */ jsx("a", {
									href: documento.link,
									target: "_blank",
									rel: "noreferrer noopener",
									children: "Abrir link"
								}),
								" ",
								/* @__PURE__ */ jsx("small", {
									className: "suave",
									children: "(abre fora do Lia Go)"
								})
							] }) : /* @__PURE__ */ jsx("p", {
								className: "suave pequeno",
								children: "Sem link: só a descrição."
							}),
							removido ? /* @__PURE__ */ jsxs("p", {
								className: "suave pequeno",
								children: ["Removido: ", documento.motivoRemocao]
							}) : soVisualizacao ? /* @__PURE__ */ jsx("p", {
								className: "suave pequeno",
								children: "Compartilhado com você — só quem criou muda isto."
							}) : /* @__PURE__ */ jsx("div", {
								className: "acoes",
								children: documento.autorId === usuarioId || ehOrganizador ? /* @__PURE__ */ jsxs(Fragment, { children: [!compartilhado ? /* @__PURE__ */ jsx("button", {
									className: "sutil",
									onClick: () => void abrirAcao(documento, "compartilhar"),
									children: "Compartilhar"
								}) : /* @__PURE__ */ jsx("button", {
									className: "sutil",
									onClick: () => void revogar(documento),
									children: "Revogar acesso"
								}), /* @__PURE__ */ jsx("button", {
									className: "perigo",
									onClick: () => void abrirAcao(documento, "remover"),
									children: "Remover"
								})] }) : null
							}),
							acao?.documento.id === documento.id ? /* @__PURE__ */ jsxs("div", {
								className: "cartao impacto",
								children: [
									/* @__PURE__ */ jsx("h3", { children: acao.tipo === "compartilhar" ? "Antes de compartilhar" : "Antes de remover" }),
									impacto ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("ul", { children: impacto.itens.map((item) => /* @__PURE__ */ jsx("li", { children: item }, item)) }), impacto.atencao.length > 0 ? /* @__PURE__ */ jsx("div", {
										className: "aviso atencao",
										children: impacto.atencao.map((item) => /* @__PURE__ */ jsx("p", { children: item }, item))
									}) : null] }) : /* @__PURE__ */ jsx("p", {
										className: "suave pequeno",
										children: "Não foi possível carregar os detalhes agora — sem rede, esta ação espera."
									}),
									acao.tipo === "compartilhar" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("label", {
										htmlFor: `documento-pessoas-${documento.id}`,
										children: "Com quem (deixe vazio para a viagem toda)"
									}), /* @__PURE__ */ jsx("select", {
										id: `documento-pessoas-${documento.id}`,
										multiple: true,
										value: escolhidos,
										onChange: (evento) => setEscolhidos(Array.from(evento.target.selectedOptions).map((opcao) => opcao.value)),
										children: pessoas.map((pessoa) => /* @__PURE__ */ jsx("option", {
											value: pessoa.usuario_id,
											children: pessoa.nome
										}, pessoa.usuario_id))
									})] }) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("label", {
										htmlFor: `documento-motivo-${documento.id}`,
										children: "Motivo da remoção (mínimo 5 caracteres)"
									}), /* @__PURE__ */ jsx("input", {
										id: `documento-motivo-${documento.id}`,
										value: motivo,
										onChange: (evento) => setMotivo(evento.target.value),
										placeholder: "Ex.: passagem cancelada e reembolsada"
									})] }),
									/* @__PURE__ */ jsxs("div", {
										className: "acoes",
										children: [/* @__PURE__ */ jsx("button", {
											className: acao.tipo === "remover" ? "perigo" : "principal",
											disabled: acao.tipo === "remover" && motivo.trim().length < 5,
											onClick: () => void confirmarAcao(),
											children: acao.tipo === "compartilhar" ? "Confirmar compartilhamento" : "Confirmar remoção"
										}), /* @__PURE__ */ jsx("button", {
											className: "sutil",
											onClick: () => setAcao(null),
											children: "Voltar atrás"
										})]
									})
								]
							}) : null
						]
					}, documento.id);
				})
			}),
			aviso ? /* @__PURE__ */ jsx("div", {
				className: "aviso ok",
				children: aviso
			}) : null,
			erro ? /* @__PURE__ */ jsx("div", {
				className: "aviso erro",
				children: erro
			}) : null
		]
	});
}
//#endregion
//#region src/services/exportacao.ts
/**
* Exportação de arquivo (tela 21 — fechamento).
*
* Duas realidades diferentes, uma função só:
*  - **web**: navegador baixa o arquivo de verdade (`<a download>` + Blob);
*  - **app nativo (Capacitor)**: não existe download de navegador. Em vez de fingir que baixou,
*    devolvemos o texto para a tela mostrar em um campo que a pessoa copia e envia como quiser
*    (ver decisão V1 §13: a interface não insinua ação externa que não aconteceu).
*/
function nomeDoArquivo(base, extensao, agora = /* @__PURE__ */ new Date()) {
	return `${base.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "viagem"}-${agora.toISOString().slice(0, 10)}.${extensao}`;
}
/**
* Entrega o conteúdo à pessoa. Nunca lança por causa de API ausente: se o navegador não deixar
* baixar, o resultado é `copiar` e a tela mostra o texto — a informação nunca se perde.
*/
function exportarArquivo(nome, conteudo, tipoMime) {
	if (Platform.ehNativo() || typeof document === "undefined" || typeof URL.createObjectURL !== "function") return {
		tipo: "copiar",
		nome,
		conteudo
	};
	try {
		const blob = new Blob([conteudo], { type: `${tipoMime};charset=utf-8` });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = nome;
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1e4);
		return {
			tipo: "baixado",
			nome
		};
	} catch {
		return {
			tipo: "copiar",
			nome,
			conteudo
		};
	}
}
//#endregion
//#region src/telas/Fechamento.tsx
/**
* Fechamento e exportação (tela 21).
*
* O que esta tela **não** faz (decisões V1 §13):
*  - não recalcula nada no cliente: totais, saldos e acertos são o que o servidor somou;
*  - não diz que ninguém pagou nada: "acertos sugeridos" é sugestão, e a tela diz isso com todas as letras;
*  - no app nativo não finge que baixou arquivo: mostra o texto para copiar e explica o porquê.
*/
function Fechamento({ viagemId, nomeDaViagem }) {
	const [dados, setDados] = useState(null);
	const [carregando, setCarregando] = useState(false);
	const [erro, setErro] = useState(null);
	const [aviso, setAviso] = useState(null);
	const [paraCopiar, setParaCopiar] = useState(null);
	async function carregar() {
		setErro(null);
		setCarregando(true);
		try {
			setDados(await api.fechamento(viagemId));
		} catch (falha) {
			setErro(falha instanceof ErroApi ? falha.message : "Não foi possível montar o fechamento agora. Ele é calculado no servidor — tente de novo com internet.");
		} finally {
			setCarregando(false);
		}
	}
	function exportar(extensao) {
		if (!dados) return;
		const nome = nomeDoArquivo(`lia-go-${nomeDaViagem}`, extensao);
		const resultado = exportarArquivo(nome, extensao === "csv" ? dados.csv : dados.texto, extensao === "csv" ? "text/csv" : "text/plain");
		if (resultado.tipo === "baixado") {
			setAviso(`Arquivo ${nome} gerado no navegador.`);
			setParaCopiar(null);
		} else {
			setParaCopiar({
				nome: resultado.nome,
				conteudo: resultado.conteudo
			});
			setAviso("Neste aparelho não existe download de arquivo: copie o texto abaixo e envie como quiser.");
		}
	}
	return /* @__PURE__ */ jsxs("section", {
		className: "cartao",
		"aria-labelledby": "titulo-fechamento",
		children: [
			/* @__PURE__ */ jsx("h2", {
				id: "titulo-fechamento",
				children: "Fechamento da viagem"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "suave pequeno",
				children: "Para conferir juntos no fim da viagem: o que foi confirmado, quem deve quem e o que dá para exportar. Quem soma é o servidor — a tela só mostra."
			}),
			!dados ? /* @__PURE__ */ jsxs("div", {
				className: "acoes",
				children: [/* @__PURE__ */ jsx("button", {
					className: "principal",
					disabled: carregando,
					onClick: () => void carregar(),
					children: carregando ? "Montando o fechamento…" : "Ver fechamento"
				}), /* @__PURE__ */ jsx("small", {
					className: "suave",
					children: "Precisa de conexão: é o servidor que fecha as contas."
				})]
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("div", {
					className: "linha entre",
					children: [/* @__PURE__ */ jsx("span", { children: dados.viagem.nome }), /* @__PURE__ */ jsx("span", {
						className: "suave pequeno",
						children: dados.viagem.destino ?? "sem destino"
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "linha",
					children: [/* @__PURE__ */ jsx("span", { children: "Gasto confirmado (oficial)" }), /* @__PURE__ */ jsx("strong", { children: formatarBRL(dados.totalConfirmadoCentavos) })]
				}),
				BigInt(dados.totalAguardandoCentavos) > 0n ? /* @__PURE__ */ jsxs("div", {
					className: "linha",
					children: [/* @__PURE__ */ jsx("span", { children: "Aguardando confirmação" }), /* @__PURE__ */ jsx("span", { children: formatarBRL(dados.totalAguardandoCentavos) })]
				}) : null,
				/* @__PURE__ */ jsxs("div", {
					className: "linha",
					children: [/* @__PURE__ */ jsx("span", { children: "Previsto (planejamento)" }), /* @__PURE__ */ jsx("span", { children: formatarBRL(dados.previstoCentavos) })]
				}),
				dados.limiteCentavos !== null ? /* @__PURE__ */ jsxs("div", {
					className: "linha",
					children: [/* @__PURE__ */ jsx("span", { children: "Limite combinado" }), /* @__PURE__ */ jsx("span", { children: formatarBRL(dados.limiteCentavos) })]
				}) : null,
				/* @__PURE__ */ jsxs("p", {
					className: "suave pequeno",
					children: [
						dados.linhas.filter((linha) => linha.estado === "confirmada").length,
						" despesa(s) confirmada(s)",
						dados.despesasAbertas > 0 ? ` · ${dados.despesasAbertas} ainda em aberto` : "",
						"."
					]
				}),
				dados.alertas.length > 0 ? /* @__PURE__ */ jsx("ul", {
					className: "lista-alertas",
					children: dados.alertas.map((alerta) => /* @__PURE__ */ jsx("li", { children: alerta }, alerta))
				}) : null,
				/* @__PURE__ */ jsx("h3", {
					style: { marginTop: 12 },
					children: "Saldo por pessoa"
				}),
				dados.saldos.length === 0 ? /* @__PURE__ */ jsx("p", {
					className: "suave pequeno",
					children: "Sem despesas confirmadas: ninguém deve nada."
				}) : dados.saldos.map((saldo) => /* @__PURE__ */ jsxs("div", {
					className: "linha",
					children: [/* @__PURE__ */ jsx("span", { children: saldo.nome ?? "participante" }), /* @__PURE__ */ jsxs("span", {
						className: BigInt(saldo.saldoCentavos) >= 0n ? "saldo-positivo" : "saldo-negativo",
						children: [BigInt(saldo.saldoCentavos) > 0n ? "recebe " : BigInt(saldo.saldoCentavos) < 0n ? "deve " : "em dia ", formatarBRL(BigInt(saldo.saldoCentavos) < 0n ? -BigInt(saldo.saldoCentavos) : saldo.saldoCentavos)]
					})]
				}, saldo.participanteId)),
				dados.acertosSugeridos.length > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsx("h3", {
						style: { marginTop: 12 },
						children: "Acertos sugeridos"
					}),
					dados.acertosSugeridos.map((acerto) => /* @__PURE__ */ jsxs("p", { children: [
						acerto.deNome ?? "participante",
						" → ",
						acerto.paraNome ?? "participante",
						":",
						" ",
						/* @__PURE__ */ jsx("strong", { children: formatarBRL(acerto.valorCentavos) })
					] }, `${acerto.deId}-${acerto.paraId}-${acerto.valorCentavos}`)),
					/* @__PURE__ */ jsx("div", {
						className: "aviso atencao",
						children: "Sugestão de quem paga quem, calculada pelo servidor. Ninguém pagou nada até alguém registrar o acerto na aba Gastos e quem recebeu confirmar."
					})
				] }) : /* @__PURE__ */ jsx("p", {
					className: "suave pequeno",
					children: "Nada a acertar: as contas estão fechadas."
				}),
				/* @__PURE__ */ jsx("h3", {
					style: { marginTop: 12 },
					children: "Exportar"
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "acoes",
					children: [
						/* @__PURE__ */ jsx("button", {
							className: "principal",
							onClick: () => exportar("txt"),
							children: "Baixar resumo (.txt)"
						}),
						/* @__PURE__ */ jsx("button", {
							className: "sutil",
							onClick: () => exportar("csv"),
							children: "Baixar planilha (.csv)"
						}),
						/* @__PURE__ */ jsx("button", {
							className: "sutil",
							disabled: carregando,
							onClick: () => void carregar(),
							children: "Atualizar"
						})
					]
				}),
				/* @__PURE__ */ jsxs("p", {
					className: "suave pequeno",
					children: ["O CSV abre no Excel, no Google Planilhas ou no Numbers: separador ponto e vírgula e valores com vírgula decimal. Campos que começam com =, +, - ou @ ganham apóstrofo para não virarem fórmula na sua planilha.", Platform.ehNativo() ? " No app do celular o arquivo não é baixado: o texto aparece para copiar." : ""]
				}),
				paraCopiar ? /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsx("label", {
						htmlFor: "fechamento-texto",
						children: paraCopiar.nome
					}),
					/* @__PURE__ */ jsx("textarea", {
						id: "fechamento-texto",
						readOnly: true,
						rows: 10,
						value: paraCopiar.conteudo
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "acoes",
						children: [/* @__PURE__ */ jsx("button", {
							className: "sutil",
							onClick: () => void navigator.clipboard?.writeText(paraCopiar.conteudo).then(() => setAviso("Texto copiado.")).catch(() => setAviso("Selecione o texto acima e copie.")),
							children: "Copiar texto"
						}), /* @__PURE__ */ jsx("button", {
							className: "sutil",
							onClick: () => setParaCopiar(null),
							children: "Fechar"
						})]
					})
				] }) : null,
				/* @__PURE__ */ jsxs("p", {
					className: "suave pequeno",
					children: [
						"Gerado ",
						new Date(dados.geradoEm).toLocaleString("pt-BR"),
						" · exportar não muda nada nos registros."
					]
				})
			] }),
			aviso ? /* @__PURE__ */ jsx("div", {
				className: "aviso ok",
				children: aviso
			}) : null,
			erro ? /* @__PURE__ */ jsx("div", {
				className: "aviso erro",
				children: erro
			}) : null
		]
	});
}
//#endregion
//#region ../assets/lia-hero.jpg
var lia_hero_default = "../assets/lia-hero.jpg";
//#endregion
//#region src/telas/Viagem.tsx
/** Imagem oficial da Lia (referência `assets/references/lia-character-hero.png`, comprimida). */
/**
* Tela da viagem. Lê do aparelho primeiro (funciona sem sinal) e escreve pela fila:
* o que a pessoa faz aqui vale na hora e sobe para o servidor quando houver rede.
* Saldos sempre vêm do servidor — o app nunca calcula dinheiro oficial.
*/
function Viagem({ viagemId, usuarioId, voltar, sincronizador, abrirAtividade }) {
	const [aba, setAba] = useState("visao");
	const [estado, setEstado] = useState(sincronizador.obter());
	const [saldos, setSaldos] = useState(null);
	const [saldosEm, setSaldosEm] = useState(null);
	const [erro, setErro] = useState(null);
	const [aviso, setAviso] = useState(null);
	const [impactos, setImpactos] = useState(null);
	const [conviteEmail, setConviteEmail] = useState("");
	const [linkConvite, setLinkConvite] = useState(null);
	const [novaDespesa, setNovaDespesa] = useState({
		descricao: "",
		valor: "",
		pagadorId: "",
		tipo: "compartilhada"
	});
	const [motivoContestacao, setMotivoContestacao] = useState(null);
	const [acerto, setAcerto] = useState({
		deId: "",
		paraId: "",
		valor: ""
	});
	useEffect(() => sincronizador.assinar(setEstado), [sincronizador]);
	useEffect(() => {
		sincronizador.abrirViagem(viagemId);
		return () => {
			sincronizador.abrirViagem(null);
		};
	}, [sincronizador, viagemId]);
	useEffect(() => {
		sincronizador.sincronizarAgora().catch(() => {});
	}, [sincronizador, viagemId]);
	useEffect(() => {
		let cancelado = false;
		(async () => {
			const guardado = await sincronizador.lerSaldos(viagemId);
			if (guardado && !cancelado) {
				setSaldos(guardado.saldos);
				setSaldosEm(guardado.em);
			}
			if (!sincronizador.obter().online) return;
			try {
				const atual = await api.saldos(viagemId);
				if (cancelado) return;
				setSaldos(atual);
				setSaldosEm((/* @__PURE__ */ new Date()).toISOString());
				await sincronizador.guardarSaldos(viagemId, atual);
			} catch {}
		})();
		return () => {
			cancelado = true;
		};
	}, [
		sincronizador,
		viagemId,
		estado.ultimaSincronizacao,
		estado.resumo.total
	]);
	const { detalhe, despesas, movimentos, reservas } = dadosDaViagemAberta(estado, viagemId);
	const itensDoChecklist = checklistDoDominio(estado, viagemId);
	const documentosDaViagem = documentosDoDominio(estado, viagemId);
	const viagem = detalhe?.viagem ?? null;
	const participantes = detalhe?.participantes ?? [];
	const permissoes = detalhe?.permissoes;
	const sugestao = detalhe?.sugestao;
	const pendencias = detalhe?.pendencias;
	const atividades = atividadesDoDominio(estado, viagemId);
	resumirOrcamentoDoRoteiro(atividades);
	const reservasDoDominio = reservas.map((item) => comoReserva(item)).filter((item) => item !== null);
	const proximo = proximoCompromisso(atividades, {
		dia: hojeIso(),
		hora: horaDoAparelho()
	});
	const nomePorId = new Map(participantes.map((pessoa) => [pessoa.usuario_id, pessoa.nome]));
	const ativos = participantes.filter((pessoa) => pessoa.estado === "ativo");
	const eu = participantes.find((pessoa) => pessoa.usuario_id === usuarioId);
	const podeRegistrar = pode(permissoes?.registrarDespesa);
	const sou = (despesa) => despesa.autorId === usuarioId;
	const nome = (id) => nomePorId.get(id) ?? "alguém";
	if (!viagem) return /* @__PURE__ */ jsxs("main", {
		className: "app",
		children: [
			erro ? /* @__PURE__ */ jsx("div", {
				className: "aviso erro",
				role: "alert",
				children: erro
			}) : null,
			/* @__PURE__ */ jsxs("div", {
				className: "carregando",
				children: [/* @__PURE__ */ jsx("span", { className: "pulso" }), " Carregando a viagem…"]
			}),
			/* @__PURE__ */ jsx("button", {
				onClick: voltar,
				children: "Voltar"
			})
		]
	});
	/** Toda escrita passa por aqui: enfileira e explica o que vai acontecer. */
	async function enfileirar(operacao, mensagem) {
		setErro(null);
		await sincronizador.enfileirar(operacao);
		setAviso(estado.online ? mensagem : `${mensagem} Ficou guardado no aparelho e sobe quando o sinal voltar.`);
	}
	async function executarOnline(acao, mensagem) {
		setErro(null);
		try {
			await acao();
			setAviso(mensagem);
			await sincronizador.sincronizarAgora();
		} catch (falha) {
			setErro(falha instanceof ErroApi ? falha.message : "Não foi possível concluir a ação.");
		}
	}
	return /* @__PURE__ */ jsxs("main", {
		className: "app",
		children: [
			/* @__PURE__ */ jsx("button", {
				className: "sutil",
				onClick: voltar,
				children: "← Minhas viagens"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "linha entre",
				style: { marginTop: 8 },
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", { children: viagem.nome }), /* @__PURE__ */ jsxs("p", { children: [
					viagem.destino || "sem destino",
					" · ",
					formatarData(viagem.data_inicio),
					" a",
					" ",
					formatarData(viagem.data_fim)
				] })] }), /* @__PURE__ */ jsx("span", {
					className: `etiqueta estado-${viagem.estado}`,
					children: viagem.rotuloEstado ?? ROTULO_ESTADO[viagem.estado] ?? viagem.estado
				})]
			}),
			erro ? /* @__PURE__ */ jsx("div", {
				className: "aviso erro",
				role: "alert",
				children: erro
			}) : null,
			aviso ? /* @__PURE__ */ jsx("div", {
				className: "aviso ok",
				children: aviso
			}) : null,
			sugestao && permissoes ? /* @__PURE__ */ jsxs("div", {
				className: "aviso atencao",
				children: [
					/* @__PURE__ */ jsx("strong", { children: "Sugestão:" }),
					" ",
					sugestao.motivo,
					/* @__PURE__ */ jsx("div", {
						className: "acoes",
						children: /* @__PURE__ */ jsxs("button", {
							className: "principal",
							onClick: () => void enfileirar({
								tipo: "transicao_viagem",
								viagemId,
								para: sugestao.sugestao,
								versao: Number(viagem.versao),
								descricao: `Viagem: ${ROTULO_ESTADO[sugestao.sugestao] ?? sugestao.sugestao}`
							}, `Confirmado: a viagem passa para ${ROTULO_ESTADO[sugestao.sugestao] ?? sugestao.sugestao}. Registramos quem confirmou.`),
							children: [
								"Confirmar “",
								ROTULO_ESTADO[sugestao.sugestao] ?? sugestao.sugestao,
								"”"
							]
						})
					})
				]
			}) : null,
			aba === "visao" ? /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("section", {
					className: "hero-viagem cartao",
					children: [/* @__PURE__ */ jsx("div", {
						className: "hero-viagem-imagem",
						children: /* @__PURE__ */ jsx("img", {
							src: lia_hero_default,
							alt: "",
							"aria-hidden": "true"
						})
					}), /* @__PURE__ */ jsxs("div", {
						className: "hero-viagem-texto",
						children: [
							/* @__PURE__ */ jsx("p", {
								className: "suave pequeno",
								children: "Viagem ativa"
							}),
							/* @__PURE__ */ jsx("h2", { children: viagem.destino || "Sua próxima viagem" }),
							/* @__PURE__ */ jsxs("p", {
								className: "suave pequeno",
								children: [
									formatarData(viagem.data_inicio),
									" a ",
									formatarData(viagem.data_fim),
									" ·",
									" ",
									ativos.length,
									" ",
									ativos.length === 1 ? "pessoa" : "pessoas"
								]
							}),
							/* @__PURE__ */ jsx("span", {
								className: `etiqueta estado-${viagem.estado}`,
								children: viagem.rotuloEstado ?? ROTULO_ESTADO[viagem.estado] ?? viagem.estado
							})
						]
					})]
				}),
				/* @__PURE__ */ jsxs("section", {
					className: "cartao destaque",
					"aria-labelledby": "titulo-proximo",
					children: [/* @__PURE__ */ jsx("h2", {
						id: "titulo-proximo",
						children: "Próximo compromisso"
					}), proximo ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("div", {
						className: "linha entre",
						children: [/* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsx("strong", { children: proximo.titulo }),
							/* @__PURE__ */ jsx("br", {}),
							/* @__PURE__ */ jsxs("small", {
								className: "suave",
								children: [quandoDoCompromisso(proximo.dia, proximo.hora, hojeIso()), proximo.local ? ` · ${proximo.local}` : ""]
							})
						] }), /* @__PURE__ */ jsx("span", {
							className: "etiqueta estado-planejada",
							children: formatarDiaCurto(proximo.dia).split(", ")[0]
						})]
					}), /* @__PURE__ */ jsx("p", {
						className: "suave pequeno",
						children: "Ainda não aconteceu: nada aqui muda saldo nem confirma reserva."
					})] }) : /* @__PURE__ */ jsx("p", {
						className: "suave pequeno",
						children: "Nada marcado à frente no roteiro. Quando você adicionar algo, aparece aqui."
					})]
				}),
				/* @__PURE__ */ jsxs("section", {
					className: "cartao destaque",
					children: [
						/* @__PURE__ */ jsx("h2", { children: "Organização" }),
						/* @__PURE__ */ jsxs("p", { children: [
							"Você é ",
							/* @__PURE__ */ jsx("strong", { children: detalhe?.papel === "organizador" ? "organizador(a)" : "participante" }),
							".",
							pendencias && pendencias.despesas > 0 ? ` ${pendencias.despesas} despesa(s) aguardando confirmação.` : " Nenhuma pendência financeira."
						] }),
						permissoes && permissoes.transicoesPermitidas.length > 0 ? /* @__PURE__ */ jsx("div", {
							className: "acoes",
							children: permissoes.transicoesPermitidas.map((destino) => /* @__PURE__ */ jsxs("button", {
								onClick: () => {
									if (destino === "cancelada") {
										api.impactosCancelamento(viagemId).then((r) => setImpactos(r.impactos)).catch(() => setErro("Não foi possível ver os impactos."));
										return;
									}
									enfileirar({
										tipo: "transicao_viagem",
										viagemId,
										para: destino,
										versao: Number(viagem.versao),
										descricao: `Viagem: ${ROTULO_ESTADO[destino] ?? destino}`
									}, `A viagem passa para ${ROTULO_ESTADO[destino] ?? destino}.`);
								},
								children: ["Mover para ", ROTULO_ESTADO[destino] ?? destino]
							}, destino))
						}) : /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("small", {
							className: "suave",
							children: permissoes?.editar?.motivo
						}) })
					]
				}),
				impactos ? /* @__PURE__ */ jsxs("div", {
					className: "cartao",
					children: [
						/* @__PURE__ */ jsx("h2", { children: "Antes de cancelar, veja os impactos" }),
						/* @__PURE__ */ jsx("ul", { children: impactos.map((impacto) => /* @__PURE__ */ jsx("li", { children: impacto }, impacto)) }),
						/* @__PURE__ */ jsxs("div", {
							className: "acoes",
							children: [/* @__PURE__ */ jsx("button", {
								className: "perigo",
								onClick: () => void enfileirar({
									tipo: "transicao_viagem",
									viagemId,
									para: "cancelada",
									versao: Number(viagem.versao),
									descricao: "Viagem: cancelada"
								}, "Cancelamento registrado. Os registros continuam preservados e acessíveis.").then(() => setImpactos(null)),
								children: "Confirmar cancelamento"
							}), /* @__PURE__ */ jsx("button", {
								className: "sutil",
								onClick: () => setImpactos(null),
								children: "Voltar atrás"
							})]
						})
					]
				}) : null,
				/* @__PURE__ */ jsxs("section", {
					className: "cartao",
					children: [/* @__PURE__ */ jsx("h2", { children: "Participantes" }), participantes.map((pessoa) => /* @__PURE__ */ jsxs("div", {
						className: "linha",
						style: { marginBottom: 6 },
						children: [/* @__PURE__ */ jsxs("span", { children: [
							pessoa.nome,
							" ",
							pessoa.usuario_id === usuarioId ? "(você)" : ""
						] }), /* @__PURE__ */ jsxs("span", {
							className: "etiqueta",
							children: [pessoa.papel === "organizador" ? "organizador" : "participante", pessoa.estado !== "ativo" ? ` · ${pessoa.estado}` : ""]
						})]
					}, pessoa.usuario_id))]
				}),
				/* @__PURE__ */ jsxs("section", {
					className: "cartao",
					children: [/* @__PURE__ */ jsx("h2", { children: "Convidar pessoa" }), pode(permissoes?.convidar) ? /* @__PURE__ */ jsxs(Fragment, { children: [
						/* @__PURE__ */ jsx("label", {
							htmlFor: "email-convite",
							children: "E-mail de quem vai participar"
						}),
						/* @__PURE__ */ jsx("input", {
							id: "email-convite",
							type: "email",
							value: conviteEmail,
							onChange: (e) => setConviteEmail(e.target.value)
						}),
						/* @__PURE__ */ jsx("div", {
							className: "acoes",
							children: /* @__PURE__ */ jsx("button", {
								className: "principal",
								disabled: !conviteEmail.includes("@"),
								onClick: () => void executarOnline(async () => {
									const convite = await api.criarConvite(viagemId, conviteEmail);
									setLinkConvite(convite.token);
									setConviteEmail("");
								}, "Convite criado. Envie o link: a pessoa entra com o mesmo e-mail para aceitar."),
								children: "Gerar convite"
							})
						}),
						linkConvite ? /* @__PURE__ */ jsxs("div", {
							className: "aviso info",
							children: [
								"Link do convite (aparece só uma vez): ",
								/* @__PURE__ */ jsx("code", { children: `${location.origin}/?convite=${linkConvite}` }),
								/* @__PURE__ */ jsx("div", {
									className: "acoes",
									children: /* @__PURE__ */ jsx("button", {
										onClick: () => void navigator.clipboard?.writeText(`${location.origin}/?convite=${linkConvite}`),
										children: "Copiar link"
									})
								})
							]
						}) : null,
						/* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("small", {
							className: "suave",
							children: "Gerar convite precisa de internet: o token só existe no servidor."
						}) })
					] }) : /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("small", {
						className: "suave",
						children: permissoes?.convidar?.motivo
					}) })]
				})
			] }) : null,
			aba === "roteiro" ? /* @__PURE__ */ jsx(Roteiro, {
				viagemId,
				usuarioId,
				sincronizador,
				abrirAtividade,
				dataInicioViagem: viagem.data_inicio ?? null,
				dataFimViagem: viagem.data_fim ?? null,
				estadoViagem: viagem.estado
			}) : null,
			aba === "gastos" ? /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("section", {
					className: "cartao destaque",
					children: [
						/* @__PURE__ */ jsx("h2", { children: "Resumo" }),
						/* @__PURE__ */ jsxs("div", {
							className: "linha",
							children: [/* @__PURE__ */ jsx("span", { children: "Gasto confirmado (oficial)" }), /* @__PURE__ */ jsx("strong", { children: formatarBRL(saldos?.realizado ?? "0") })]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "linha",
							children: [/* @__PURE__ */ jsx("span", { children: "Lançado, aguardando confirmação" }), /* @__PURE__ */ jsx("strong", { children: formatarBRL(saldos?.comprometido ?? "0") })]
						}),
						/* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsxs("small", {
							className: "suave",
							children: [saldos?.aviso, saldosEm ? ` · Última atualização do servidor: ${new Date(saldosEm).toLocaleString("pt-BR")}.` : ""]
						}) })
					]
				}),
				/* @__PURE__ */ jsx(Orcamento, {
					viagemId,
					usuarioId,
					sincronizador,
					atividades,
					reservas: reservasDoDominio,
					gastoConfirmadoCentavos: saldos?.realizado ?? null,
					aguardandoCentavos: saldos?.comprometido ?? null,
					saldosEm,
					ehOrganizador: detalhe?.papel === "organizador",
					permissoes: permissoes ?? {}
				}),
				saldos && saldos.saldos.length > 0 ? /* @__PURE__ */ jsxs("section", {
					className: "cartao",
					children: [
						/* @__PURE__ */ jsx("h2", { children: "Saldos" }),
						saldos.saldos.map((saldo) => /* @__PURE__ */ jsxs("div", {
							className: "linha",
							children: [/* @__PURE__ */ jsx("span", { children: saldo.nome ?? "Participante" }), /* @__PURE__ */ jsxs("span", {
								className: BigInt(saldo.saldo) >= 0n ? "saldo-positivo" : "saldo-negativo",
								children: [BigInt(saldo.saldo) > 0n ? "recebe " : BigInt(saldo.saldo) < 0n ? "deve " : "em dia ", formatarBRL(BigInt(saldo.saldo) < 0n ? -BigInt(saldo.saldo) : saldo.saldo)]
							})]
						}, saldo.participanteId)),
						saldos.transferenciasSugeridas.length > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsx("h3", {
								style: { marginTop: 12 },
								children: "Acertos sugeridos"
							}),
							saldos.transferenciasSugeridas.map((sugestaoAcerto) => /* @__PURE__ */ jsxs("p", { children: [
								sugestaoAcerto.deNome,
								" → ",
								sugestaoAcerto.paraNome,
								": ",
								/* @__PURE__ */ jsx("strong", { children: formatarBRL(sugestaoAcerto.valorCentavos) }),
								/* @__PURE__ */ jsx("button", {
									className: "sutil",
									style: { marginLeft: 8 },
									onClick: () => setAcerto({
										deId: sugestaoAcerto.deId,
										paraId: sugestaoAcerto.paraId,
										valor: (Number(sugestaoAcerto.valorCentavos) / 100).toFixed(2).replace(".", ",")
									}),
									children: "Registrar acerto"
								})
							] }, `${sugestaoAcerto.deId}-${sugestaoAcerto.paraId}-${sugestaoAcerto.valorCentavos}`)),
							/* @__PURE__ */ jsx("div", {
								className: "aviso atencao",
								children: "Sugestão apenas: nada é transferido pelo app. Combine o Pix por fora e registre o acerto."
							})
						] }) : null
					]
				}) : null,
				/* @__PURE__ */ jsxs("form", {
					className: "cartao",
					onSubmit: (evento) => {
						evento.preventDefault();
						enfileirar({
							tipo: "criar_movimento",
							viagemId,
							corpo: {
								deId: acerto.deId,
								paraId: acerto.paraId,
								valorCentavos: paraCentavos(acerto.valor)
							},
							descricao: `Acerto: ${nome(acerto.deId)} paga ${nome(acerto.paraId)}`
						}, "Acerto registrado. Quem recebeu precisa confirmar para valer nos saldos.").then(() => setAcerto({
							deId: "",
							paraId: "",
							valor: ""
						}));
					},
					children: [
						/* @__PURE__ */ jsx("h2", { children: "Registrar acerto (pagamento combinado)" }),
						/* @__PURE__ */ jsx("label", {
							htmlFor: "acerto-de",
							children: "Quem pagou"
						}),
						/* @__PURE__ */ jsxs("select", {
							id: "acerto-de",
							value: acerto.deId,
							onChange: (e) => setAcerto({
								...acerto,
								deId: e.target.value
							}),
							required: true,
							children: [/* @__PURE__ */ jsx("option", {
								value: "",
								children: "escolha…"
							}), ativos.map((pessoa) => /* @__PURE__ */ jsx("option", {
								value: pessoa.usuario_id,
								children: pessoa.nome
							}, pessoa.usuario_id))]
						}),
						/* @__PURE__ */ jsx("label", {
							htmlFor: "acerto-para",
							children: "Quem recebeu"
						}),
						/* @__PURE__ */ jsxs("select", {
							id: "acerto-para",
							value: acerto.paraId,
							onChange: (e) => setAcerto({
								...acerto,
								paraId: e.target.value
							}),
							required: true,
							children: [/* @__PURE__ */ jsx("option", {
								value: "",
								children: "escolha…"
							}), ativos.map((pessoa) => /* @__PURE__ */ jsx("option", {
								value: pessoa.usuario_id,
								children: pessoa.nome
							}, pessoa.usuario_id))]
						}),
						/* @__PURE__ */ jsx("label", {
							htmlFor: "acerto-valor",
							children: "Valor (ex.: 87,50)"
						}),
						/* @__PURE__ */ jsx("input", {
							id: "acerto-valor",
							inputMode: "decimal",
							value: acerto.valor,
							onChange: (e) => setAcerto({
								...acerto,
								valor: e.target.value
							}),
							required: true
						}),
						/* @__PURE__ */ jsx("div", {
							className: "acoes",
							children: /* @__PURE__ */ jsx("button", {
								className: "principal",
								type: "submit",
								disabled: !acerto.deId || !acerto.paraId || acerto.deId === acerto.paraId,
								children: "Registrar acerto"
							})
						}),
						/* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("small", {
							className: "suave",
							children: "Nada é transferido pelo app: é o registro do que vocês combinaram fora dele."
						}) })
					]
				}),
				podeRegistrar ? /* @__PURE__ */ jsxs("form", {
					className: "cartao",
					onSubmit: (evento) => {
						evento.preventDefault();
						const valorCentavos = paraCentavos(novaDespesa.valor);
						const descricao = novaDespesa.descricao;
						enfileirar({
							tipo: "criar_despesa",
							viagemId,
							corpo: {
								tipo: novaDespesa.tipo,
								valorCentavos,
								data: hojeIso(),
								descricao,
								pagadorId: novaDespesa.pagadorId || usuarioId,
								participantes: ativos.map((pessoa) => pessoa.usuario_id)
							},
							descricao: `Despesa: ${descricao} (${formatarBRL(valorCentavos)})`
						}, "Despesa registrada como pendente. Outra pessoa precisa confirmar.").then(() => setNovaDespesa({
							descricao: "",
							valor: "",
							pagadorId: "",
							tipo: "compartilhada"
						}));
					},
					children: [
						/* @__PURE__ */ jsx("h2", { children: "Nova despesa" }),
						/* @__PURE__ */ jsx("label", {
							htmlFor: "descricao",
							children: "Descrição"
						}),
						/* @__PURE__ */ jsx("input", {
							id: "descricao",
							value: novaDespesa.descricao,
							onChange: (e) => setNovaDespesa({
								...novaDespesa,
								descricao: e.target.value
							}),
							required: true,
							minLength: 2
						}),
						/* @__PURE__ */ jsx("label", {
							htmlFor: "valor",
							children: "Valor (ex.: 87,50)"
						}),
						/* @__PURE__ */ jsx("input", {
							id: "valor",
							inputMode: "decimal",
							value: novaDespesa.valor,
							onChange: (e) => setNovaDespesa({
								...novaDespesa,
								valor: e.target.value
							}),
							required: true
						}),
						/* @__PURE__ */ jsx("label", {
							htmlFor: "tipo",
							children: "Tipo"
						}),
						/* @__PURE__ */ jsxs("select", {
							id: "tipo",
							value: novaDespesa.tipo,
							onChange: (e) => setNovaDespesa({
								...novaDespesa,
								tipo: e.target.value
							}),
							children: [/* @__PURE__ */ jsx("option", {
								value: "compartilhada",
								children: "Compartilhada (divide entre o grupo)"
							}), /* @__PURE__ */ jsx("option", {
								value: "pessoal",
								children: "Pessoal (só minha)"
							})]
						}),
						/* @__PURE__ */ jsx("label", {
							htmlFor: "pagador",
							children: "Quem pagou"
						}),
						/* @__PURE__ */ jsx("select", {
							id: "pagador",
							value: novaDespesa.pagadorId || usuarioId,
							onChange: (e) => setNovaDespesa({
								...novaDespesa,
								pagadorId: e.target.value
							}),
							children: ativos.map((pessoa) => /* @__PURE__ */ jsxs("option", {
								value: pessoa.usuario_id,
								children: [pessoa.nome, pessoa.usuario_id === usuarioId ? " (você)" : ""]
							}, pessoa.usuario_id))
						}),
						/* @__PURE__ */ jsx("div", {
							className: "acoes",
							children: /* @__PURE__ */ jsx("button", {
								className: "principal",
								type: "submit",
								children: "Registrar despesa"
							})
						}),
						/* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("small", {
							className: "suave",
							children: "Funciona sem internet: fica guardada no aparelho e sobe quando o sinal voltar."
						}) })
					]
				}) : /* @__PURE__ */ jsx("div", {
					className: "aviso info",
					children: permissoes?.registrarDespesa?.motivo
				}),
				/* @__PURE__ */ jsxs("section", { children: [
					/* @__PURE__ */ jsx("h2", { children: "Despesas" }),
					despesas.length === 0 ? /* @__PURE__ */ jsx("div", {
						className: "cartao vazio",
						children: /* @__PURE__ */ jsx("p", { children: "Nenhuma despesa registrada ainda." })
					}) : null,
					despesas.map((despesa) => /* @__PURE__ */ jsxs("article", {
						className: "cartao",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "linha entre",
								children: [/* @__PURE__ */ jsxs("div", { children: [
									/* @__PURE__ */ jsx("h3", { children: despesa.descricao }),
									/* @__PURE__ */ jsxs("p", { children: [
										formatarBRL(despesa.valorCentavos),
										" · pago por ",
										nome(despesa.pagadorId),
										" · ",
										formatarData(despesa.data),
										" ·",
										" ",
										despesa.tipo === "pessoal" ? "pessoal" : "compartilhada"
									] }),
									/* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("small", {
										className: "suave",
										children: despesa.rateio.explicacao || `Lançado por ${nome(despesa.autorId)}`
									}) })
								] }), /* @__PURE__ */ jsx("span", {
									className: `etiqueta estado-${despesa.estado}`,
									children: ROTULO_DESPESA[despesa.estado]
								})]
							}),
							despesa.motivoContestacao ? /* @__PURE__ */ jsxs("div", {
								className: "aviso atencao",
								children: ["Contestação: ", despesa.motivoContestacao]
							}) : null,
							despesa.estado !== "confirmada" ? /* @__PURE__ */ jsxs("div", {
								className: "acoes",
								children: [/* @__PURE__ */ jsx("button", {
									disabled: sou(despesa),
									title: sou(despesa) ? "Quem lançou não confirma o próprio lançamento" : "Confirmar esta despesa",
									onClick: () => void enfileirar({
										tipo: "confirmar_despesa",
										viagemId,
										despesaId: despesa.id,
										descricao: `Confirmar: ${despesa.descricao}`
									}, "Despesa confirmada. Ela passa a contar nos saldos oficiais."),
									children: "Confirmar"
								}), !sou(despesa) ? /* @__PURE__ */ jsx("button", {
									className: "sutil",
									onClick: () => setMotivoContestacao({
										id: despesa.id,
										texto: motivoContestacao?.texto ?? ""
									}),
									children: "Contestar"
								}) : null]
							}) : null,
							motivoContestacao?.id === despesa.id ? /* @__PURE__ */ jsxs("form", {
								onSubmit: (evento) => {
									evento.preventDefault();
									const texto = motivoContestacao.texto;
									enfileirar({
										tipo: "contestar_despesa",
										viagemId,
										despesaId: despesa.id,
										motivo: texto,
										descricao: `Contestar: ${despesa.descricao}`
									}, "Despesa contestada: segue visível e fora dos saldos oficiais até a resolução.").then(() => setMotivoContestacao(null));
								},
								children: [
									/* @__PURE__ */ jsx("label", {
										htmlFor: "motivo",
										children: "Motivo da contestação"
									}),
									/* @__PURE__ */ jsx("textarea", {
										id: "motivo",
										value: motivoContestacao.texto,
										onChange: (e) => setMotivoContestacao({
											id: despesa.id,
											texto: e.target.value
										}),
										rows: 3,
										required: true,
										minLength: 5
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "acoes",
										children: [/* @__PURE__ */ jsx("button", {
											className: "principal",
											type: "submit",
											children: "Enviar contestação"
										}), /* @__PURE__ */ jsx("button", {
											type: "button",
											className: "sutil",
											onClick: () => setMotivoContestacao(null),
											children: "Cancelar"
										})]
									})
								]
							}) : null
						]
					}, despesa.id))
				] }),
				/* @__PURE__ */ jsxs("section", { children: [
					/* @__PURE__ */ jsx("h2", { children: "Acertos registrados" }),
					movimentos.length === 0 ? /* @__PURE__ */ jsx("div", {
						className: "cartao vazio",
						children: /* @__PURE__ */ jsx("p", { children: "Nenhum acerto registrado." })
					}) : null,
					movimentos.map((movimento) => /* @__PURE__ */ jsxs("article", {
						className: "cartao",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "linha entre",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("h3", { children: [
								movimento.de_nome,
								" → ",
								movimento.para_nome
							] }), /* @__PURE__ */ jsxs("p", { children: [
								formatarBRL(movimento.valor_centavos),
								" · ",
								formatarData(movimento.criado_em.slice(0, 10))
							] })] }), /* @__PURE__ */ jsx("span", {
								className: "etiqueta",
								children: movimento.estado
							})]
						}), movimento.estado !== "confirmado" ? /* @__PURE__ */ jsx("div", {
							className: "acoes",
							children: movimento.para_id === usuarioId ? /* @__PURE__ */ jsx("button", {
								onClick: () => void enfileirar({
									tipo: "confirmar_movimento",
									viagemId,
									movimentoId: movimento.id,
									descricao: `Confirmar recebimento de ${formatarBRL(movimento.valor_centavos)}`
								}, "Recebimento confirmado: o acerto passa a contar nos saldos."),
								children: "Confirmar recebimento"
							}) : /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("small", {
								className: "suave",
								children: "Só quem recebeu confirma este acerto."
							}) })
						}) : null]
					}, movimento.id))
				] })
			] }) : null,
			aba === "mais" ? /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("section", {
					className: "cartao",
					children: [
						/* @__PURE__ */ jsx("h2", { children: "Ficha da viagem" }),
						/* @__PURE__ */ jsxs("div", {
							className: "linha",
							children: [/* @__PURE__ */ jsx("span", { children: "Estado" }), /* @__PURE__ */ jsx("strong", { children: viagem.rotuloEstado ?? ROTULO_ESTADO[viagem.estado] })]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "linha",
							children: [/* @__PURE__ */ jsx("span", { children: "Fuso" }), /* @__PURE__ */ jsx("span", { children: viagem.fuso_horario ?? "America/Sao_Paulo" })]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "linha",
							children: [/* @__PURE__ */ jsx("span", { children: "Versão dos dados" }), /* @__PURE__ */ jsx("span", { children: viagem.versao })]
						}),
						/* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("small", {
							className: "suave",
							children: "Cada alteração relevante é registrada com autor e horário. A data da viagem nunca muda o estado sozinha."
						}) })
					]
				}),
				/* @__PURE__ */ jsxs("section", {
					className: "cartao",
					children: [
						/* @__PURE__ */ jsx("h2", { children: "Você" }),
						/* @__PURE__ */ jsxs("p", { children: [
							eu?.nome ?? "participante",
							" · ",
							detalhe?.papel
						] }),
						eu?.papel !== "organizador" ? /* @__PURE__ */ jsx("div", {
							className: "acoes",
							children: /* @__PURE__ */ jsx("button", {
								className: "perigo",
								onClick: () => void executarOnline(async () => {
									await api.sairDaViagem(viagemId);
									voltar();
								}, "Você saiu da viagem. O histórico permanece com o grupo."),
								children: "Sair da viagem"
							})
						}) : /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("small", {
							className: "suave",
							children: "Organizador(a) não sai sem passar a organização para outra pessoa."
						}) })
					]
				}),
				/* @__PURE__ */ jsx(Reservas, {
					viagemId,
					usuarioId,
					sincronizador,
					reservas,
					permissoes: permissoes ?? {}
				}),
				/* @__PURE__ */ jsx(Checklist, {
					viagemId,
					usuarioId,
					sincronizador,
					itens: itensDoChecklist,
					participantes: participantes.map((pessoa) => ({
						usuario_id: pessoa.usuario_id,
						nome: pessoa.nome,
						estado: pessoa.estado
					})),
					permissoes: permissoes ?? {}
				}),
				/* @__PURE__ */ jsx(Documentos, {
					viagemId,
					usuarioId,
					sincronizador,
					documentos: documentosDaViagem,
					participantes: participantes.map((pessoa) => ({
						usuario_id: pessoa.usuario_id,
						nome: pessoa.nome,
						estado: pessoa.estado
					})),
					ehOrganizador: detalhe?.papel === "organizador",
					avisoDePrivacidade: null
				}),
				/* @__PURE__ */ jsx(Fechamento, {
					viagemId,
					nomeDaViagem: String(viagem.nome ?? "viagem")
				}),
				/* @__PURE__ */ jsxs("section", {
					className: "cartao",
					children: [
						/* @__PURE__ */ jsx("h2", { children: "Este aparelho" }),
						/* @__PURE__ */ jsxs("div", {
							className: "linha",
							children: [/* @__PURE__ */ jsx("span", { children: "Dados guardados para uso sem internet" }), /* @__PURE__ */ jsx("span", { children: estado.armazenamento })]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "linha",
							children: [/* @__PURE__ */ jsx("span", { children: "Alterações na fila" }), /* @__PURE__ */ jsx("span", { children: estado.resumo.total })]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "linha",
							children: [/* @__PURE__ */ jsx("span", { children: "Sua sessão fica em" }), /* @__PURE__ */ jsx("span", { children: Platform.ehWeb() ? "cookie HttpOnly do navegador" : rotuloDeArmazenamento() })]
						}),
						/* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("small", {
							className: "suave",
							children: "Guardamos apenas o que você já pode ver nesta viagem, para o app funcionar sem sinal. Os saldos oficiais são sempre calculados no servidor."
						}) }),
						/* @__PURE__ */ jsx("div", {
							className: "acoes",
							children: /* @__PURE__ */ jsx("button", {
								className: "sutil",
								onClick: () => {
									sincronizador.limparDadosLocais().then(() => {
										setAviso("Dados locais apagados. O app vai baixar de novo quando você usar com internet.");
										voltar();
									});
								},
								children: "Apagar dados deste aparelho"
							})
						})
					]
				})
			] }) : null,
			/* @__PURE__ */ jsxs("nav", {
				className: "barra",
				"aria-label": "Navegação principal",
				children: [
					/* @__PURE__ */ jsx("button", {
						"aria-current": aba === "visao",
						onClick: () => setAba("visao"),
						children: "Visão geral"
					}),
					/* @__PURE__ */ jsx("button", {
						"aria-current": aba === "roteiro",
						onClick: () => setAba("roteiro"),
						children: "Roteiro"
					}),
					/* @__PURE__ */ jsx("button", {
						"aria-current": aba === "gastos",
						onClick: () => setAba("gastos"),
						children: "Gastos"
					}),
					/* @__PURE__ */ jsx("button", {
						"aria-current": aba === "mais",
						onClick: () => setAba("mais"),
						children: "Mais"
					})
				]
			})
		]
	});
}
//#endregion
//#region src/telas/Atividade.tsx
/**
* Detalhes da atividade — **tela própria**, como a diretriz §2.1 exige: o cartão da linha do tempo
* fica resumido e o conteúdo completo mora aqui (horário e duração, local e deslocamento, custo e
* natureza do valor, observações e histórico).
*
* As ações (concluir, cancelar, corrigir) passam pela fila do aparelho: valem na hora e sobem
* quando houver rede. Todas exigem motivo/ação explícita — nada acontece pelo relógio.
*/
const ROTULO_HISTORICO = {
	"atividade:criar": "Atividade criada",
	"atividade:concluir": "Concluída",
	"atividade:cancelar": "Cancelada",
	"atividade:corrigir": "Corrigida"
};
/** Revisão de impacto (decisões V1 §13): o que muda aparece **antes** do botão que muda. */
function ImpactoDaAcao({ atividade, acao }) {
	const impacto = revisarImpacto(atividade, acao);
	return /* @__PURE__ */ jsxs("div", {
		className: "impacto",
		children: [
			/* @__PURE__ */ jsx("h3", { children: "Antes de continuar: o que isso muda" }),
			/* @__PURE__ */ jsx("ul", { children: impacto.itens.map((item) => /* @__PURE__ */ jsx("li", { children: item }, item)) }),
			impacto.atencao.length > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("h4", { children: "Atenção" }), /* @__PURE__ */ jsx("ul", {
				className: "impacto-atencao",
				children: impacto.atencao.map((item) => /* @__PURE__ */ jsx("li", { children: item }, item))
			})] }) : null
		]
	});
}
function Atividade({ viagemId, atividadeId, sincronizador, voltar }) {
	const [estado, setEstado] = useState(sincronizador.obter());
	const [historico, setHistorico] = useState(null);
	const [motivo, setMotivo] = useState("");
	const [observacao, setObservacao] = useState("");
	const [corrigindo, setCorrigindo] = useState(false);
	const [ajustes, setAjustes] = useState({
		titulo: "",
		hora: "",
		duracao: "",
		local: "",
		custo: "",
		natureza: "estimativa"
	});
	const [erro, setErro] = useState(null);
	const [aviso, setAviso] = useState(null);
	useEffect(() => sincronizador.assinar(setEstado), [sincronizador]);
	const brutaDoCache = useMemo(() => estado.carga.atividades.find((item) => item["id"] === atividadeId) ?? null, [estado.carga.atividades, atividadeId]);
	const atividade = useMemo(() => {
		const bruta = brutaDoCache;
		if (!bruta) return null;
		const custo = bruta["custo"] ?? {};
		return {
			id: String(bruta["id"]),
			dia: String(bruta["dia"]),
			titulo: String(bruta["titulo"]),
			hora: bruta["hora"] ?? null,
			duracaoMinutos: bruta["duracaoMinutos"] ?? null,
			local: bruta["local"] ?? null,
			estado: String(bruta["estado"]),
			observacao: bruta["observacao"] ?? null,
			concluidaEm: bruta["concluidaEm"] ?? null,
			versao: Number(bruta["versao"] ?? 1),
			custo,
			deslocamento: bruta["deslocamento"] ?? null
		};
	}, [brutaDoCache]);
	const atividadeDominio = useMemo(() => brutaDoCache ? atividadeDoDominio({
		...brutaDoCache,
		viagemId
	}) : null, [brutaDoCache, viagemId]);
	useEffect(() => {
		let vivo = true;
		(async () => {
			try {
				const detalhe = await api.detalheAtividade(viagemId, atividadeId);
				if (vivo && Array.isArray(detalhe.historico)) setHistorico(detalhe.historico);
			} catch {}
		})();
		return () => {
			vivo = false;
		};
	}, [viagemId, atividadeId]);
	async function concluir() {
		if (!atividade) return;
		setErro(null);
		await sincronizador.enfileirar({
			tipo: "concluir_atividade",
			viagemId,
			atividadeId,
			observacao: observacao.trim() || void 0,
			versao: atividade.versao,
			descricao: `Concluir: ${atividade.titulo}`
		});
		setAviso("Conclusão registrada. Ela sobe para o grupo quando houver rede.");
		setObservacao("");
	}
	async function cancelar() {
		if (!atividade) return;
		setErro(null);
		if (motivo.trim().length < 5) {
			setErro("Explique o motivo do cancelamento (mínimo 5 caracteres).");
			return;
		}
		await sincronizador.enfileirar({
			tipo: "cancelar_atividade",
			viagemId,
			atividadeId,
			motivo: motivo.trim(),
			versao: atividade.versao,
			descricao: `Cancelar: ${atividade.titulo}`
		});
		setAviso("Cancelamento registrado com o motivo.");
		setMotivo("");
	}
	async function corrigir(evento) {
		evento.preventDefault();
		if (!atividade) return;
		setErro(null);
		if (motivo.trim().length < 5) {
			setErro("Explique o motivo da correção (mínimo 5 caracteres).");
			return;
		}
		try {
			const custoCentavos = ajustes.custo.trim() ? ajustes.natureza === "gratuito" ? "0" : paraCentavos(ajustes.custo) : null;
			await sincronizador.enfileirar({
				tipo: "corrigir_atividade",
				viagemId,
				atividadeId,
				corpo: {
					motivo: motivo.trim(),
					...ajustes.titulo.trim() ? { titulo: ajustes.titulo.trim() } : {},
					...ajustes.hora.trim() ? { hora: ajustes.hora.trim() } : {},
					...ajustes.duracao.trim() ? { duracaoMinutos: Number(ajustes.duracao) } : {},
					...ajustes.local.trim() ? { local: ajustes.local.trim() } : {},
					custoCentavos,
					custoNatureza: custoCentavos === null ? null : ajustes.natureza,
					versao: atividade.versao
				},
				descricao: `Corrigir: ${atividade.titulo}`
			});
			setCorrigindo(false);
			setMotivo("");
			setAviso("Correção registrada com motivo e histórico.");
		} catch (falha) {
			setErro(falha instanceof ErroApi ? falha.message : "Não foi possível guardar a correção.");
		}
	}
	if (!atividade) return /* @__PURE__ */ jsxs("main", {
		className: "app",
		children: [/* @__PURE__ */ jsx("button", {
			className: "sutil",
			onClick: voltar,
			children: "← Voltar ao roteiro"
		}), /* @__PURE__ */ jsxs("div", {
			className: "cartao vazio",
			children: [/* @__PURE__ */ jsx("p", { children: "Atividade não encontrada neste aparelho." }), /* @__PURE__ */ jsx("p", {
				className: "suave pequeno",
				children: "Se ela acabou de ser criada em outro celular, sincronize para receber."
			})]
		})]
	});
	const duracao = formatarDuracao(atividade.duracaoMinutos);
	const centavos = atividade.custo.centavos ?? null;
	const trecho = atividade.deslocamento ? descreverDeslocamento(atividade.deslocamento) : "";
	const planejada = atividade.estado === "planejada";
	return /* @__PURE__ */ jsxs("main", {
		className: "app",
		children: [
			/* @__PURE__ */ jsx("button", {
				className: "sutil",
				onClick: voltar,
				children: "← Voltar ao roteiro"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "linha entre",
				children: [/* @__PURE__ */ jsx("h1", { children: atividade.titulo }), /* @__PURE__ */ jsx("span", {
					className: `etiqueta estado-${atividade.estado}`,
					children: ROTULO_ATIVIDADE[atividade.estado] ?? atividade.estado
				})]
			}),
			aviso ? /* @__PURE__ */ jsxs("div", {
				className: "aviso info",
				role: "status",
				children: [aviso, /* @__PURE__ */ jsx("button", {
					className: "sutil",
					style: { marginLeft: 8 },
					onClick: () => setAviso(null),
					children: "ok"
				})]
			}) : null,
			erro ? /* @__PURE__ */ jsx("div", {
				className: "aviso erro",
				role: "alert",
				children: erro
			}) : null,
			/* @__PURE__ */ jsxs("section", {
				className: "cartao",
				children: [/* @__PURE__ */ jsx("h2", { children: "Quando e onde" }), /* @__PURE__ */ jsxs("div", {
					className: "ficha",
					children: [
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", {
							className: "rotulo",
							children: "Dia"
						}), /* @__PURE__ */ jsxs("span", { children: [
							formatarDiaLongo(atividade.dia),
							" ",
							/* @__PURE__ */ jsxs("span", {
								className: "suave pequeno",
								children: [
									"(",
									formatarData(atividade.dia),
									")"
								]
							})
						] })] }),
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", {
							className: "rotulo",
							children: "Horário"
						}), /* @__PURE__ */ jsx("span", { children: atividade.hora ? atividade.hora : "Flexível — sem horário fixo" })] }),
						duracao ? /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", {
							className: "rotulo",
							children: "Duração"
						}), /* @__PURE__ */ jsx("span", { children: duracao })] }) : null,
						atividade.local ? /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", {
							className: "rotulo",
							children: "Local"
						}), /* @__PURE__ */ jsx("span", { children: atividade.local })] }) : null,
						atividade.deslocamento && (trecho || atividade.deslocamento.alerta) ? /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", {
							className: "rotulo",
							children: "Deslocamento até aqui"
						}), /* @__PURE__ */ jsxs("span", { children: [trecho || "sem tempo informado", atividade.deslocamento.alerta ? /* @__PURE__ */ jsxs("em", {
							className: "trecho-alerta",
							children: [" · ", atividade.deslocamento.alerta]
						}) : null] })] }) : null
					]
				})]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "cartao",
				children: [
					/* @__PURE__ */ jsx("h2", { children: "Custo" }),
					centavos === null ? atividade.custo.aVerificar ? /* @__PURE__ */ jsx("p", {
						className: "custo-a-verificar",
						children: "Custo a verificar — o valor ainda não foi confirmado."
					}) : /* @__PURE__ */ jsx("p", {
						className: "suave pequeno",
						children: "Nenhum custo informado (não é o mesmo que custo zero)."
					}) : atividade.custo.natureza === "gratuito" ? /* @__PURE__ */ jsxs("p", { children: [
						"Sem custo (",
						formatarBRL(0n),
						")."
					] }) : /* @__PURE__ */ jsxs("p", { children: [
						formatarBRL(BigInt(centavos)),
						" ",
						/* @__PURE__ */ jsxs("span", {
							className: "suave pequeno",
							children: [
								"(",
								atividade.custo.natureza === "compromisso" ? "valor já combinado" : "estimativa",
								")"
							]
						})
					] }),
					/* @__PURE__ */ jsx("p", {
						className: "suave pequeno",
						children: "O roteiro não altera saldos oficiais: isto é planejamento. O gasto de verdade entra em Despesas."
					})
				]
			}),
			atividade.observacao ? /* @__PURE__ */ jsxs("section", {
				className: "cartao",
				children: [/* @__PURE__ */ jsx("h2", { children: "Observações" }), /* @__PURE__ */ jsx("p", { children: atividade.observacao })]
			}) : null,
			planejada ? /* @__PURE__ */ jsxs("section", {
				className: "cartao",
				children: [
					/* @__PURE__ */ jsx("h2", { children: "O que aconteceu?" }),
					/* @__PURE__ */ jsx("label", {
						htmlFor: "conclusao-observacao",
						children: "Observação da conclusão (opcional)"
					}),
					/* @__PURE__ */ jsx("input", {
						id: "conclusao-observacao",
						value: observacao,
						onChange: (evento) => setObservacao(evento.target.value),
						placeholder: "Chegamos 10 min atrasados"
					}),
					atividadeDominio ? /* @__PURE__ */ jsx(ImpactoDaAcao, {
						atividade: atividadeDominio,
						acao: "concluir"
					}) : null,
					/* @__PURE__ */ jsx("div", {
						className: "acoes",
						children: /* @__PURE__ */ jsx("button", {
							className: "principal",
							onClick: () => void concluir(),
							children: "Marcar como concluída"
						})
					}),
					/* @__PURE__ */ jsx("p", {
						className: "suave pequeno",
						children: "O Lia Go nunca conclui pelo horário: o registro é sempre uma ação de alguém (aqui, você)."
					})
				]
			}) : null,
			atividade.estado === "concluida" ? /* @__PURE__ */ jsxs("p", {
				className: "suave pequeno",
				children: [
					"Concluída em ",
					atividade.concluidaEm ? new Date(atividade.concluidaEm).toLocaleString("pt-BR") : "—",
					"."
				]
			}) : null,
			planejada ? /* @__PURE__ */ jsxs("section", {
				className: "cartao",
				children: [/* @__PURE__ */ jsx("h2", { children: "Ajustar ou cancelar" }), corrigindo ? /* @__PURE__ */ jsxs("form", {
					onSubmit: corrigir,
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "duas-colunas",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "ajuste-titulo",
								children: "Título"
							}), /* @__PURE__ */ jsx("input", {
								id: "ajuste-titulo",
								value: ajustes.titulo,
								onChange: (evento) => setAjustes({
									...ajustes,
									titulo: evento.target.value
								}),
								placeholder: atividade.titulo
							})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "ajuste-hora",
								children: "Horário"
							}), /* @__PURE__ */ jsx("input", {
								id: "ajuste-hora",
								type: "time",
								value: ajustes.hora,
								onChange: (evento) => setAjustes({
									...ajustes,
									hora: evento.target.value
								})
							})] })]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "duas-colunas",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "ajuste-duracao",
								children: "Duração (min)"
							}), /* @__PURE__ */ jsx("input", {
								id: "ajuste-duracao",
								type: "number",
								min: 1,
								value: ajustes.duracao,
								onChange: (evento) => setAjustes({
									...ajustes,
									duracao: evento.target.value
								})
							})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "ajuste-local",
								children: "Local"
							}), /* @__PURE__ */ jsx("input", {
								id: "ajuste-local",
								value: ajustes.local,
								onChange: (evento) => setAjustes({
									...ajustes,
									local: evento.target.value
								}),
								placeholder: atividade.local ?? ""
							})] })]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "duas-colunas",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "ajuste-custo",
								children: "Custo"
							}), /* @__PURE__ */ jsx("input", {
								id: "ajuste-custo",
								value: ajustes.custo,
								onChange: (evento) => setAjustes({
									...ajustes,
									custo: evento.target.value
								}),
								placeholder: "120,00",
								disabled: ajustes.natureza === "gratuito"
							})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
								htmlFor: "ajuste-natureza",
								children: "Natureza"
							}), /* @__PURE__ */ jsxs("select", {
								id: "ajuste-natureza",
								value: ajustes.natureza,
								onChange: (evento) => setAjustes({
									...ajustes,
									natureza: evento.target.value
								}),
								children: [
									/* @__PURE__ */ jsx("option", {
										value: "estimativa",
										children: "Estimativa"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "compromisso",
										children: "Compromisso"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "gratuito",
										children: "Sem custo"
									})
								]
							})] })]
						}),
						/* @__PURE__ */ jsx("label", {
							htmlFor: "ajuste-motivo",
							children: "Motivo da correção"
						}),
						/* @__PURE__ */ jsx("input", {
							id: "ajuste-motivo",
							value: motivo,
							onChange: (evento) => setMotivo(evento.target.value),
							placeholder: "O restaurante abre 11h30",
							required: true,
							minLength: 5
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "acoes",
							children: [/* @__PURE__ */ jsx("button", {
								className: "principal",
								type: "submit",
								children: "Salvar correção"
							}), /* @__PURE__ */ jsx("button", {
								className: "sutil",
								type: "button",
								onClick: () => setCorrigindo(false),
								children: "Voltar"
							})]
						}),
						/* @__PURE__ */ jsx("p", {
							className: "suave pequeno",
							children: "A correção guarda o antes e o depois: nada é apagado em silêncio."
						})
					]
				}) : /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsx("button", {
						className: "sutil",
						onClick: () => setCorrigindo(true),
						children: "Corrigir dados"
					}),
					/* @__PURE__ */ jsx("label", {
						htmlFor: "cancelar-motivo",
						children: "Motivo do cancelamento"
					}),
					/* @__PURE__ */ jsx("input", {
						id: "cancelar-motivo",
						value: motivo,
						onChange: (evento) => setMotivo(evento.target.value),
						placeholder: "Chuva forte; vamos remarcar"
					}),
					atividadeDominio ? /* @__PURE__ */ jsx(ImpactoDaAcao, {
						atividade: atividadeDominio,
						acao: "cancelar"
					}) : null,
					/* @__PURE__ */ jsx("div", {
						className: "acoes",
						children: /* @__PURE__ */ jsx("button", {
							className: "perigo",
							onClick: () => void cancelar(),
							children: "Cancelar atividade"
						})
					})
				] })]
			}) : null,
			historico && historico.length > 0 ? /* @__PURE__ */ jsxs("section", {
				className: "cartao",
				children: [/* @__PURE__ */ jsx("h2", { children: "Histórico" }), /* @__PURE__ */ jsx("ol", {
					className: "historico",
					children: historico.map((evento, indice) => /* @__PURE__ */ jsxs("li", { children: [
						/* @__PURE__ */ jsx("strong", { children: ROTULO_HISTORICO[evento.acao] ?? evento.acao }),
						/* @__PURE__ */ jsxs("span", {
							className: "suave pequeno",
							children: [" · ", new Date(evento.em).toLocaleString("pt-BR")]
						}),
						evento.motivo ? /* @__PURE__ */ jsxs("p", {
							className: "suave pequeno",
							children: [
								"“",
								evento.motivo,
								"”"
							]
						}) : null
					] }, `${evento.acao}-${indice}`))
				})]
			}) : null,
			/* @__PURE__ */ jsxs("p", {
				className: "suave pequeno",
				children: [
					"Estado atual: ",
					ROTULO_ATIVIDADE[atividade.estado] ?? atividade.estado,
					"."
				]
			})
		]
	});
}
//#endregion
//#region src/offline/armazenamento.ts
const CHAVE_FILA = "fila";
const CHAVE_CARGA = "carga";
const CHAVE_CURSOR = "cursor";
const CHAVE_VIAGEM_ATIVA = "viagemAtiva";
/** Adaptador em memória: usado nos testes e como último recurso quando não há armazenamento. */
function criarArmazenamentoMemoria(inicial = {}) {
	const dados = new Map(Object.entries(inicial));
	return {
		nome: "memória",
		async ler(chave) {
			return dados.get(chave) ?? null;
		},
		async gravar(chave, valor) {
			dados.set(chave, valor);
		},
		async remover(chave) {
			dados.delete(chave);
		},
		async limpar() {
			dados.clear();
		}
	};
}
const NOME_BANCO_PADRAO = "lia-go";
const NOME_DEPOSITO = "local";
/** Adaptador IndexedDB (web), sem dependências externas. */
function criarArmazenamentoIndexedDB(nomeBanco = NOME_BANCO_PADRAO) {
	let promessaBanco = null;
	function abrir() {
		if (promessaBanco) return promessaBanco;
		promessaBanco = new Promise((resolver, rejeitar) => {
			const fabrica = globalThis.indexedDB;
			if (!fabrica) {
				rejeitar(/* @__PURE__ */ new Error("Este navegador não oferece IndexedDB."));
				return;
			}
			const pedido = fabrica.open(nomeBanco, 1);
			pedido.onupgradeneeded = () => {
				const banco = pedido.result;
				if (!banco.objectStoreNames.contains(NOME_DEPOSITO)) banco.createObjectStore(NOME_DEPOSITO);
			};
			pedido.onsuccess = () => resolver(pedido.result);
			pedido.onerror = () => rejeitar(pedido.error ?? /* @__PURE__ */ new Error("Falha ao abrir o banco local."));
		});
		return promessaBanco;
	}
	async function comDeposito(modo, acao) {
		const banco = await abrir();
		return new Promise((resolver, rejeitar) => {
			const pedido = acao(banco.transaction(NOME_DEPOSITO, modo).objectStore(NOME_DEPOSITO));
			pedido.onsuccess = () => resolver(pedido.result);
			pedido.onerror = () => rejeitar(pedido.error ?? /* @__PURE__ */ new Error("Falha ao acessar o banco local."));
		});
	}
	return {
		nome: "IndexedDB (web)",
		async ler(chave) {
			return await comDeposito("readonly", (deposito) => deposito.get(chave)) ?? null;
		},
		async gravar(chave, valor) {
			await comDeposito("readwrite", (deposito) => deposito.put(JSON.parse(JSON.stringify(valor)), chave));
		},
		async remover(chave) {
			await comDeposito("readwrite", (deposito) => deposito.delete(chave));
		},
		async limpar() {
			await comDeposito("readwrite", (deposito) => deposito.clear());
		}
	};
}
/**
* Adaptador nativo (Capacitor Preferences). O import é dinâmico de propósito: na web o pacote
* nativo nem é carregado, e os testes rodam sem ele.
*/
function criarArmazenamentoNativo() {
	let promessa = null;
	function carregar() {
		promessa ??= import("@capacitor/preferences").then((modulo) => modulo.Preferences);
		return promessa;
	}
	return {
		nome: "armazenamento do app (nativo)",
		async ler(chave) {
			const { value } = await (await carregar()).get({ key: chave });
			if (value === null) return null;
			try {
				return JSON.parse(value);
			} catch {
				return null;
			}
		},
		async gravar(chave, valor) {
			await (await carregar()).set({
				key: chave,
				value: JSON.stringify(valor)
			});
		},
		async remover(chave) {
			await (await carregar()).remove({ key: chave });
		},
		async limpar() {
			const preferencias = await carregar();
			const { keys } = await preferencias.keys();
			await Promise.all(keys.map((key) => preferencias.remove({ key })));
		}
	};
}
/**
* Escolhe o armazenamento certo para onde o app está rodando.
* `ehNativo` vem de fora para este módulo continuar testável sem Capacitor.
*/
function escolherArmazenamento(ehNativo) {
	if (ehNativo) return criarArmazenamentoNativo();
	return typeof globalThis.indexedDB !== "undefined" ? criarArmazenamentoIndexedDB() : criarArmazenamentoMemoria();
}
function criarArmazenamentoDeSync(armazem, opcoes = {}) {
	const podeGravar = opcoes.aceitarEscrita ?? (() => true);
	return {
		async lerFila() {
			const bruto = await armazem.ler(CHAVE_FILA);
			if (!bruto || !Array.isArray(bruto.operacoes)) return filaVazia();
			return {
				...filaVazia(),
				...bruto
			};
		},
		async gravarFila(fila) {
			if (!podeGravar()) return;
			await armazem.gravar(CHAVE_FILA, fila);
		},
		async lerCarga() {
			const [cargaBruta, cursor] = await Promise.all([armazem.ler(CHAVE_CARGA), armazem.ler(CHAVE_CURSOR)]);
			return {
				cursor: typeof cursor === "string" ? cursor : null,
				carga: mesclarCarga(cargaVazia(), cargaBruta ?? {})
			};
		},
		async gravarCarga(cursor, carga) {
			if (!podeGravar()) return;
			await armazem.gravar(CHAVE_CARGA, carga);
			if (cursor === null) await armazem.remover(CHAVE_CURSOR);
			else await armazem.gravar(CHAVE_CURSOR, cursor);
		}
	};
}
//#endregion
//#region src/offline/servidor.ts
function criarPortaServidor() {
	return {
		async enviar(operacao, idempotencia) {
			try {
				return {
					ok: true,
					resposta: await enviarOperacao(operacao, idempotencia)
				};
			} catch (causa) {
				return {
					ok: false,
					erro: traduzirErro(causa)
				};
			}
		},
		async buscarViagens() {
			try {
				const { viagens, convitesPendentes } = await api.listarViagens();
				return {
					ok: true,
					carga: {
						viagens,
						convitesParaMim: convitesPendentes
					}
				};
			} catch (causa) {
				return {
					ok: false,
					erro: traduzirErro(causa)
				};
			}
		},
		async buscarMudancas(viagemId, cursor) {
			try {
				const mudancas = await api.mudancas(viagemId, cursor);
				return {
					ok: true,
					cursor: mudancas.cursor,
					carga: extrairCarga(mudancas)
				};
			} catch (causa) {
				return {
					ok: false,
					erro: traduzirErro(causa)
				};
			}
		}
	};
}
async function enviarOperacao(operacao, idempotencia) {
	switch (operacao.tipo) {
		case "criar_viagem": return api.criarViagem(operacao.corpo, idempotencia);
		case "transicao_viagem": return api.transicionar(operacao.viagemId, operacao.para, void 0, operacao.versao);
		case "criar_despesa": return api.criarDespesa(operacao.viagemId, operacao.corpo, idempotencia);
		case "confirmar_despesa": return api.confirmarDespesa(operacao.viagemId, operacao.despesaId);
		case "contestar_despesa": return api.contestarDespesa(operacao.viagemId, operacao.despesaId, operacao.motivo);
		case "criar_movimento": return api.criarMovimento(operacao.viagemId, operacao.corpo, idempotencia);
		case "confirmar_movimento": return api.confirmarMovimento(operacao.viagemId, operacao.movimentoId);
		case "contestar_movimento": return api.contestarMovimento(operacao.viagemId, operacao.movimentoId, operacao.motivo);
		case "criar_atividade": return api.criarAtividade(operacao.viagemId, operacao.corpo, idempotencia);
		case "concluir_atividade": return api.concluirAtividade(operacao.viagemId, operacao.atividadeId, {
			observacao: operacao.observacao ?? null,
			...operacao.versao === void 0 ? {} : { versao: operacao.versao }
		});
		case "cancelar_atividade": return api.cancelarAtividade(operacao.viagemId, operacao.atividadeId, {
			motivo: operacao.motivo,
			...operacao.versao === void 0 ? {} : { versao: operacao.versao }
		});
		case "criar_reserva": return api.criarReserva(operacao.viagemId, operacao.corpo, idempotencia);
		case "confirmar_reserva": return api.confirmarReserva(operacao.viagemId, operacao.reservaId, operacao.confirmacao, operacao.versao);
		case "cancelar_reserva": return api.cancelarReserva(operacao.viagemId, operacao.reservaId, operacao.motivo, operacao.versao);
		case "corrigir_atividade": return api.corrigirAtividade(operacao.viagemId, operacao.atividadeId, operacao.corpo);
		case "criar_item_checklist": return api.criarItemChecklist(operacao.viagemId, operacao.corpo, idempotencia);
		case "concluir_item_checklist": return api.concluirItemChecklist(operacao.viagemId, operacao.itemId, operacao.versao);
		case "reabrir_item_checklist": return api.reabrirItemChecklist(operacao.viagemId, operacao.itemId, operacao.motivo, operacao.versao);
		case "criar_documento": return api.criarDocumento(operacao.viagemId, operacao.corpo, idempotencia);
	}
}
/**
* A carga que o motor guarda vem direto da resposta da API, sem tradução de formato:
* é o mesmo objeto que a tela desenha, então nada se perde no caminho.
*/
function extrairCarga(mudancas) {
	return {
		viagem: {
			viagem: mudancas.viagem,
			papel: mudancas.papel,
			participantes: mudancas.participantes,
			pendencias: mudancas.pendencias,
			sugestao: mudancas.sugestao,
			permissoes: mudancas.permissoes
		},
		despesas: mudancas.despesas,
		movimentos: mudancas.movimentos,
		convites: mudancas.convites,
		atividades: mudancas.atividades ?? [],
		reservas: mudancas.reservas ?? [],
		itensChecklist: mudancas.itensChecklist ?? [],
		documentos: mudancas.documentos ?? []
	};
}
/**
* Traduz o erro para o que a fila precisa saber: código, status e detalhes.
* Sem resposta (rede caiu) o status fica ausente de propósito — a fila trata como temporário.
*/
function traduzirErro(causa) {
	if (causa instanceof ErroApi) return {
		codigo: causa.codigo,
		mensagem: causa.message,
		status: causa.status,
		...causa.detalhes === void 0 ? {} : { detalhes: causa.detalhes }
	};
	if (causa instanceof TypeError) return {
		codigo: "rede",
		mensagem: "Sem conexão com o servidor. Vamos tentar de novo automaticamente."
	};
	return {
		codigo: "desconhecido",
		mensagem: causa instanceof Error ? causa.message : "Falha inesperada ao enviar.",
		status: 500
	};
}
//#endregion
//#region src/offline/sincronizador.ts
/**
* Sincronizador do aparelho: o único lugar que a interface usa para ler e escrever dados.
*
* A interface nunca fala direto com a API: ela pede ao sincronizador, que decide se envia agora
* ou põe na fila. Assim o app funciona igual com e sem rede, e a fila continua verdadeira quando
* o sinal volta — inclusive depois de fechar e reabrir o app.
*/
const CHAVE_SALDOS = "saldos";
var Sincronizador = class Sincronizador {
	armazemLocal;
	armazem;
	porta;
	estado;
	ouvintes = /* @__PURE__ */ new Set();
	passadaEmAndamento = null;
	/** Quem pediu sincronizar durante uma passada espera **uma** passada seguinte, não uma cada. */
	pedidoPendente = null;
	proximaPassada = null;
	/** Depois de sair da conta o sincronizador para de escrever: nada volta para o aparelho. */
	desligado = false;
	constructor(armazemLocal, porta) {
		this.armazemLocal = armazemLocal;
		this.porta = porta;
		this.armazem = criarArmazenamentoDeSync(armazemLocal, { aceitarEscrita: () => !this.desligado });
		this.estado = {
			resumo: resumoFila(filaVazia()),
			carga: cargaVazia(),
			fila: filaVazia(),
			viagemAtiva: null,
			online: estaOnline(),
			sincronizando: false,
			ultimaSincronizacao: null,
			armazenamento: armazemLocal.nome,
			erroUltimaPassada: null
		};
	}
	static async criar(armazemLocal = escolherArmazenamento(Platform.ehNativo()), porta = criarPortaServidor()) {
		const sincronizador = new Sincronizador(armazemLocal, porta);
		await sincronizador.carregarDoAparelho();
		return sincronizador;
	}
	async carregarDoAparelho() {
		const { fila, carga } = await this.armazem.lerFila().then(async (filaLida) => ({
			fila: filaLida,
			carga: cargaCompleta((await this.armazem.lerCarga()).carga)
		}));
		const viagemAtiva = await this.armazemLocal.ler(CHAVE_VIAGEM_ATIVA);
		this.publicar({
			fila,
			carga,
			viagemAtiva: typeof viagemAtiva === "string" ? viagemAtiva : null,
			resumo: resumoFila(fila)
		});
	}
	assinar(ouvinte) {
		this.ouvintes.add(ouvinte);
		ouvinte(this.estado);
		return () => this.ouvintes.delete(ouvinte);
	}
	obter() {
		return this.estado;
	}
	/** Chamado quando o navegador/app percebe que a rede voltou ou caiu. */
	definirOnline(online) {
		if (this.estado.online === online) return;
		this.publicar({ online });
		if (online) this.sincronizarAgora();
	}
	/**
	* Chamado quando a pessoa abre uma viagem: é dela que buscamos as mudanças.
	*
	* O aparelho guarda **uma viagem por vez**. Ao abrir outra, o que era da anterior sai da carga
	* (inclusive o cursor, que é por viagem) — sem isso, a tela de uma viagem nova mostrava os dados
	* da viagem antiga (defeito relatado em 2026-10-15). Fechar a viagem (`null`) **não** apaga nada:
	* o que já está baixado continua útil, e o cursor continua válido se a mesma viagem voltar.
	*/
	async abrirViagem(viagemId) {
		if (this.estado.viagemAtiva === viagemId) return;
		await this.armazemLocal.gravar(CHAVE_VIAGEM_ATIVA, viagemId);
		const cacheDeOutra = this.estado.carga.viagem !== null && this.estado.carga.viagem.viagem.id !== viagemId;
		if (viagemId !== null && cacheDeOutra) {
			const carga = trocarViagemAberta(this.estado.carga);
			await this.armazem.gravarCarga(null, carga);
			this.publicar({
				viagemAtiva: viagemId,
				carga
			});
		} else this.publicar({ viagemAtiva: viagemId });
		this.sincronizarAgora().catch(() => void 0);
	}
	/**
	* Enfileira uma escrita. Ela vale imediatamente na tela e vai para o servidor assim que houver
	* rede — o que garante o uso na estrada, sem sinal.
	*/
	async enfileirar(operacao) {
		const id = crypto.randomUUID();
		const agora = (/* @__PURE__ */ new Date()).toISOString();
		const fila = enfileirar(this.estado.fila, {
			id,
			operacao,
			agora
		});
		await this.armazem.gravarFila(fila);
		this.publicar({
			fila,
			resumo: resumoFila(fila)
		});
		this.sincronizarAgora();
		return id;
	}
	async descartar(id) {
		const fila = descartar(this.estado.fila, id);
		await this.armazem.gravarFila(fila);
		this.publicar({
			fila,
			resumo: resumoFila(fila)
		});
	}
	async retentar(id) {
		const fila = retentar(this.estado.fila, id, (/* @__PURE__ */ new Date()).toISOString());
		await this.armazem.gravarFila(fila);
		this.publicar({
			fila,
			resumo: resumoFila(fila)
		});
		this.sincronizarAgora();
	}
	/**
	* Uma passada por vez: duas em paralelo confundiriam a ordem da fila.
	*
	* Pedidos que chegam **durante** uma passada (ex.: acabei de criar uma viagem) não viram uma
	* passada cada um: todos esperam **a mesma** passada seguinte. Sem isso, abrir o app disparava uma
	* avalanche de sincronizações (uma por pedido) e a tela ficava presa em "Confirmando a viagem com o
	* servidor…" — defeito relatado em uso real (2026-10-15).
	*/
	sincronizarAgora() {
		if (this.passadaEmAndamento) {
			if (!this.proximaPassada) this.proximaPassada = new Promise((resolver, rejeitar) => {
				this.pedidoPendente = {
					resolver,
					rejeitar
				};
			});
			return this.proximaPassada;
		}
		this.publicar({ sincronizando: true });
		const passada = this.executarPassada().finally(() => {
			if (this.passadaEmAndamento === passada) this.passadaEmAndamento = null;
			this.publicar({ sincronizando: false });
			this.atenderPedidoPendente();
		});
		this.passadaEmAndamento = passada;
		return passada;
	}
	/** Chama **uma** passada para todos os pedidos feitos durante a anterior. */
	atenderPedidoPendente() {
		const pedido = this.pedidoPendente;
		if (!pedido) return;
		this.pedidoPendente = null;
		this.proximaPassada = null;
		this.sincronizarAgora().then(pedido.resolver, pedido.rejeitar);
	}
	async executarPassada() {
		if (this.desligado) return relatorioVazio();
		try {
			const relatorio = await sincronizar(this.armazem, this.porta, {
				agora: () => (/* @__PURE__ */ new Date()).toISOString(),
				online: () => this.estado.online,
				viagemAtiva: () => this.estado.viagemAtiva
			});
			const { fila, carga } = await this.armazem.lerFila().then(async (filaLida) => ({
				fila: filaLida,
				carga: cargaCompleta((await this.armazem.lerCarga()).carga)
			}));
			const ultimaSincronizacao = fila.operacoes.length === 0 ? fila.ultimoSucessoEm ?? null : this.estado.ultimaSincronizacao;
			this.publicar({
				fila,
				carga,
				resumo: resumoFila(fila),
				ultimaSincronizacao,
				erroUltimaPassada: relatorio.parada === "erro_de_rede_na_busca" ? "Não conseguimos falar com o servidor agora." : null
			});
			return relatorio;
		} catch (causa) {
			const mensagem = causa instanceof Error ? causa.message : "Falha na sincronização.";
			this.publicar({ erroUltimaPassada: mensagem });
			throw causa;
		}
	}
	/**
	* Conflito de versão: o item mudou no servidor enquanto a alteração esperava na fila.
	* - "servidor": a alteração do aparelho é abandonada (nada é sobrescrito);
	* - "minha": a alteração é reaplicada sobre a versão atual do servidor, com **nova** chave de
	*   idempotência. Se a regra de negócio recusar (por exemplo, a transição deixou de ser válida),
	*   a fila mostra o motivo — nunca sobrescrevemos em silêncio.
	*/
	async resolverConflito(id, escolha) {
		const item = this.estado.fila.operacoes.find((operacao) => operacao.id === id);
		if (!item) return;
		if (escolha === "servidor") {
			await this.descartar(id);
			this.publicar({ erroUltimaPassada: "Alteração descartada: a versão do servidor foi mantida." });
			return;
		}
		const versaoAtual = versaoDoErro(item.erro?.detalhes);
		if (item.operacao.tipo === "transicao_viagem" && versaoAtual !== null) {
			await this.descartar(id);
			await this.enfileirar({
				...item.operacao,
				versao: versaoAtual
			});
			this.publicar({ erroUltimaPassada: null });
			return;
		}
		this.publicar({ erroUltimaPassada: "Não dá para reaplicar esta alteração automaticamente. Use a versão do servidor ou faça a alteração de novo." });
	}
	/** Saldos são calculados no servidor: o aparelho guarda apenas a última informação conhecida. */
	async guardarSaldos(viagemId, saldos) {
		await this.armazemLocal.gravar(`${CHAVE_SALDOS}:${viagemId}`, {
			saldos,
			em: (/* @__PURE__ */ new Date()).toISOString()
		});
	}
	async lerSaldos(viagemId) {
		return this.armazemLocal.ler(`${CHAVE_SALDOS}:${viagemId}`);
	}
	/** Mostra na tela, sem esperar rede, o que já está guardado no aparelho. */
	carregarCarga(carga) {
		this.publicar({ carga: mesclarCarga(this.estado.carga, carga) });
	}
	/**
	* Apaga tudo o que este app guardou no aparelho (fila incluída). Usado ao sair da conta e pelo
	* botão "limpar dados deste aparelho": aparelho perdido não deve continuar com dado de viagem.
	*/
	async limparDadosLocais() {
		this.desligado = true;
		await this.armazemLocal.limpar();
		this.publicar({
			fila: filaVazia(),
			carga: cargaVazia(),
			resumo: resumoFila(filaVazia()),
			viagemAtiva: null,
			ultimaSincronizacao: null
		});
	}
	publicar(mudanca) {
		this.estado = {
			...this.estado,
			...mudanca
		};
		for (const ouvinte of this.ouvintes) ouvinte(this.estado);
	}
};
/** Relatório de uma passada que não fez nada (usado depois de sair da conta). */
function relatorioVazio() {
	return {
		enviados: 0,
		falharam: 0,
		conflitos: 0,
		aguardando: 0,
		cursor: null,
		buscadasMudancas: false,
		atualizadoEm: (/* @__PURE__ */ new Date()).toISOString(),
		parada: "nada_a_fazer"
	};
}
/** A versão que o servidor informou no conflito (`detalhes.versaoAtual`). */
function versaoDoErro(detalhes) {
	if (detalhes && typeof detalhes === "object" && "versaoAtual" in detalhes) {
		const versao = detalhes.versaoAtual;
		if (typeof versao === "number" && Number.isInteger(versao)) return versao;
	}
	return null;
}
function estaOnline() {
	if (typeof navigator === "undefined") return true;
	return navigator.onLine !== false;
}
//#endregion
//#region src/services/sessao-local.ts
/**
* Marca local de "saída pendente".
*
* Por que existe: quando alguém toca em **Sair** e o servidor não responde (rede caiu), a sessão
* continua válida no cookie. Se a página for recarregada, o app entraria de novo sozinho — numa
* situação de aparelho compartilhado isso é exatamente o que a pessoa pediu para evitar.
*
* Então: a intenção de sair fica anotada **fora** dos dados de viagem (que são apagados no logout) e,
* na próxima abertura, o app tenta encerrar a sessão de novo antes de mostrar qualquer coisa.
* Esta marca não é segredo nem credencial: é só um lembrete.
*/
const CHAVE = "lia.saidaPendente";
function armazem() {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}
function marcarSaidaPendente() {
	try {
		armazem()?.setItem(CHAVE, (/* @__PURE__ */ new Date()).toISOString());
	} catch {}
}
function limparSaidaPendente() {
	try {
		armazem()?.removeItem(CHAVE);
	} catch {}
}
function saidaPendente() {
	try {
		return armazem()?.getItem(CHAVE) !== null;
	} catch {
		return false;
	}
}
//#endregion
//#region src/componentes/BarraSincronizacao.tsx
/**
* Barra de sincronização: a pessoa sempre sabe onde o dado dela está.
*
* A regra vem da pesquisa de mercado registrada em docs/DECISIONS_AND_OPEN_QUESTIONS.md:
* mostrar `aguardando envio → enviando → sincronizado` e **nunca** fingir sucesso. Fila com
* problema aparece com o motivo e um botão para resolver.
*/
function BarraSincronizacao({ estado, aoSincronizar, aoRetentar, aoDescartar, aoResolverConflito }) {
	const [aberto, setAberto] = useState(false);
	const { resumo, online, sincronizando, ultimaSincronizacao } = estado;
	const temProblema = resumo.falhou > 0 || resumo.conflito > 0;
	const classe = temProblema ? "aviso atencao" : resumo.estado === "sincronizado" ? "aviso ok" : "aviso info";
	return /* @__PURE__ */ jsxs("div", {
		className: `barra-sincro ${classe}`,
		role: "status",
		"aria-live": "polite",
		children: [
			/* @__PURE__ */ jsxs("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8,
					flexWrap: "wrap"
				},
				children: [
					/* @__PURE__ */ jsx("span", {
						className: "ponto",
						"data-estado": temProblema ? "problema" : resumo.estado,
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ jsx("strong", { children: online ? resumo.rotulo : "Sem conexão — trabalhando no aparelho" }),
					!online && resumo.total > 0 ? /* @__PURE__ */ jsxs("span", {
						className: "suave",
						children: [
							"(",
							resumo.total,
							" para enviar quando o sinal voltar)"
						]
					}) : null,
					online && resumo.estado === "sincronizado" && ultimaSincronizacao ? /* @__PURE__ */ jsxs("span", {
						className: "suave",
						children: ["às ", horaCurta(ultimaSincronizacao)]
					}) : null,
					/* @__PURE__ */ jsx("span", { style: { flex: 1 } }),
					resumo.total > 0 ? /* @__PURE__ */ jsx("button", {
						className: "sutil",
						onClick: () => setAberto((valor) => !valor),
						children: aberto ? "Ocultar" : "Ver alterações"
					}) : null,
					online && resumo.estado !== "sincronizado" && !sincronizando ? /* @__PURE__ */ jsx("button", {
						className: "sutil",
						onClick: aoSincronizar,
						children: "Enviar agora"
					}) : null,
					sincronizando ? /* @__PURE__ */ jsx("span", {
						className: "suave",
						children: "enviando…"
					}) : null
				]
			}),
			estado.erroUltimaPassada ? /* @__PURE__ */ jsx("p", {
				className: "suave",
				style: { margin: "6px 0 0" },
				children: estado.erroUltimaPassada
			}) : null,
			aberto ? /* @__PURE__ */ jsx("ul", {
				className: "lista-fila",
				children: estado.fila.operacoes.map((item) => /* @__PURE__ */ jsx("li", { children: renderizarItem(item, estado, {
					aoRetentar,
					aoDescartar,
					aoResolverConflito
				}) }, item.id))
			}) : null
		]
	});
}
function renderizarItem(item, estado, acoes) {
	const etiqueta = item.estado === "aguardando" ? onlineTexto(estado.online) : item.estado === "enviando" ? "enviando…" : item.estado === "conflito" ? "precisa da sua decisão" : "não pôde ser enviada";
	return /* @__PURE__ */ jsxs("div", {
		className: "item-fila",
		children: [
			/* @__PURE__ */ jsxs("div", {
				style: {
					display: "flex",
					gap: 8,
					alignItems: "baseline",
					flexWrap: "wrap"
				},
				children: [
					/* @__PURE__ */ jsx("strong", { children: item.operacao.descricao }),
					/* @__PURE__ */ jsx("span", {
						className: "suave",
						children: etiqueta
					}),
					/* @__PURE__ */ jsx("span", { style: { flex: 1 } }),
					item.estado === "falhou" || item.estado === "conflito" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("button", {
						className: "sutil",
						onClick: () => acoes.aoRetentar(item.id),
						children: "Tentar novamente"
					}), /* @__PURE__ */ jsx("button", {
						className: "sutil",
						onClick: () => acoes.aoDescartar(item.id),
						children: "Descartar"
					})] }) : null
				]
			}),
			item.erro ? /* @__PURE__ */ jsx("p", {
				className: "suave",
				style: { margin: "4px 0 0" },
				children: item.erro.mensagem
			}) : null,
			item.estado === "conflito" ? /* @__PURE__ */ jsx(EscolhaDeConflito, {
				item,
				estado,
				aoResolverConflito: acoes.aoResolverConflito
			}) : null
		]
	});
}
/**
* Conflito: mostramos as duas versões lado a lado, em português, e deixamos a pessoa decidir.
* Dinheiro nunca é resolvido pelo app (regra do domínio e prática de mercado).
*/
function EscolhaDeConflito({ item, estado, aoResolverConflito }) {
	const local = extrairCorpo(item);
	const remoto = encontrarNoServidor(item, estado) ?? {};
	const alterados = Object.keys(local);
	const comparacoes = compararParaDecisao(local, remoto, alterados);
	return /* @__PURE__ */ jsxs("div", {
		className: "conflito",
		children: [
			/* @__PURE__ */ jsx("p", {
				style: { margin: "6px 0" },
				children: "Alguém alterou este item antes de você. Nada foi sobrescrito — escolha o que vale:"
			}),
			/* @__PURE__ */ jsxs("table", {
				className: "tabela-conflito",
				children: [/* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
					/* @__PURE__ */ jsx("th", { children: "Campo" }),
					/* @__PURE__ */ jsx("th", { children: "No seu aparelho" }),
					/* @__PURE__ */ jsx("th", { children: "No servidor" })
				] }) }), /* @__PURE__ */ jsx("tbody", { children: comparacoes.map((linha) => /* @__PURE__ */ jsxs("tr", { children: [
					/* @__PURE__ */ jsx("td", { children: linha.rotulo }),
					/* @__PURE__ */ jsx("td", { children: valorLegivel(linha.campo, linha.valorLocal) }),
					/* @__PURE__ */ jsx("td", { children: valorLegivel(linha.campo, linha.valorRemoto) })
				] }, linha.campo)) })]
			}),
			/* @__PURE__ */ jsxs("div", {
				style: {
					display: "flex",
					gap: 8,
					flexWrap: "wrap"
				},
				children: [/* @__PURE__ */ jsx("button", {
					onClick: () => aoResolverConflito(item.id, "minha"),
					children: "Manter o que fiz"
				}), /* @__PURE__ */ jsx("button", {
					className: "sutil",
					onClick: () => aoResolverConflito(item.id, "servidor"),
					children: "Usar a versão do servidor"
				})]
			})
		]
	});
}
function extrairCorpo(item) {
	const operacao = item.operacao;
	if (operacao.tipo === "criar_despesa" || operacao.tipo === "criar_viagem" || operacao.tipo === "criar_movimento") return operacao.corpo;
	if (operacao.tipo === "transicao_viagem") return { estado: operacao.para };
	if (operacao.tipo === "contestar_despesa" || operacao.tipo === "contestar_movimento") return { motivo: operacao.motivo };
	return {};
}
/** Última informação conhecida do item, só para a comparação ficar lado a lado. */
function encontrarNoServidor(item, estado) {
	const { operacao } = item;
	if (operacao.tipo === "transicao_viagem") return estado.carga.viagem?.viagem ?? null;
	if (operacao.tipo === "confirmar_despesa" || operacao.tipo === "contestar_despesa") return estado.carga.despesas.find((despesa) => despesa["id"] === operacao.despesaId) ?? null;
	if (operacao.tipo === "criar_despesa") return null;
	return null;
}
function valorLegivel(campo, valor) {
	if (valor === void 0 || valor === null) return "—";
	if (campo === "valorCentavos" && typeof valor === "string") {
		const centavos = Number(valor);
		return Number.isFinite(centavos) ? (centavos / 100).toLocaleString("pt-BR", {
			style: "currency",
			currency: "BRL"
		}) : valor;
	}
	if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return formatarData(valor);
	if (Array.isArray(valor)) return `${valor.length} pessoa(s)`;
	if (typeof valor === "object") return "rateio detalhado";
	return String(valor);
}
function horaCurta(iso) {
	const data = new Date(iso);
	return Number.isNaN(data.getTime()) ? "" : data.toLocaleTimeString("pt-BR", {
		hour: "2-digit",
		minute: "2-digit"
	});
}
function onlineTexto(online) {
	return online ? "aguardando envio" : "guardada no aparelho";
}
//#endregion
//#region src/App.tsx
/**
* O app inteiro trabalha sobre o sincronizador: a tela lê do aparelho e escreve na fila,
* então usar com ou sem internet é o mesmo caminho de código.
*/
function App() {
	const [usuario, setUsuario] = useState(null);
	const [carregando, setCarregando] = useState(true);
	const [tela, setTela] = useState({ nome: "inicio" });
	const [mensagem, setMensagem] = useState(null);
	const [sincronizador, setSincronizador] = useState(null);
	const [estado, setEstado] = useState(null);
	const recarregarAoVoltar = useRef(false);
	useEffect(() => {
		let vivo = true;
		Sincronizador.criar().then((criado) => {
			if (!vivo) return;
			setSincronizador(criado);
			setEstado(criado.obter());
		});
		return () => {
			vivo = false;
		};
	}, []);
	useEffect(() => {
		if (!sincronizador) return;
		const cancelar = sincronizador.assinar(setEstado);
		const aoMudarRede = () => sincronizador.definirOnline(navigator.onLine !== false);
		const aoVoltarParaApp = () => {
			if (document.visibilityState === "visible") sincronizador.definirOnline(navigator.onLine !== false);
		};
		window.addEventListener("online", aoMudarRede);
		window.addEventListener("offline", aoMudarRede);
		document.addEventListener("visibilitychange", aoVoltarParaApp);
		return () => {
			cancelar();
			window.removeEventListener("online", aoMudarRede);
			window.removeEventListener("offline", aoMudarRede);
			document.removeEventListener("visibilitychange", aoVoltarParaApp);
		};
	}, [sincronizador]);
	useEffect(() => {
		(async () => {
			try {
				if (saidaPendente()) {
					await api.sair().then(limparSaidaPendente).catch(() => void 0);
					if (saidaPendente()) {
						setMensagem("Encerramos a sessão neste aparelho, mas o servidor não confirmou. Vamos tentar de novo na próxima vez que você abrir.");
						return;
					}
				}
				const sessao = await api.sessao();
				setUsuario(sessao);
			} catch (erro) {
				setMensagem(erro instanceof ErroApi && erro.status !== 401 ? erro.message : null);
			} finally {
				setCarregando(false);
			}
		})();
	}, []);
	useEffect(() => {
		if (!usuario || !sincronizador) return;
		const token = new URLSearchParams(location.search).get("convite");
		if (!token) return;
		history.replaceState(null, "", location.pathname);
		(async () => {
			try {
				const resultado = await api.aceitarConvite(token);
				await sincronizador.sincronizarAgora();
				setMensagem("Convite aceito! Você já aparece na viagem.");
				setTela({
					nome: "viagem",
					viagemId: resultado.viagemId
				});
			} catch (erro) {
				setMensagem(erro instanceof ErroApi ? erro.message : "Não foi possível aceitar o convite.");
			}
		})();
	}, [usuario, sincronizador]);
	useEffect(() => {
		if (!usuario || !sincronizador) return;
		if (recarregarAoVoltar.current) return;
		recarregarAoVoltar.current = true;
		sincronizador.sincronizarAgora().catch(() => {});
	}, [usuario, sincronizador]);
	/**
	* Sair da conta. Regras (defeito relatado em 2026-10-15, botão que não fazia nada):
	*  1. pedir para sair é **sempre** atendido — a tela muda antes de qualquer limpeza;
	*  2. nenhuma limpeza pode travar a saída: cada uma tem seu próprio tratamento de erro;
	*  3. o que falhar é dito na tela, com o que a pessoa precisa saber (a sessão pode continuar
	*     válida no servidor e ser encerrada na próxima abertura).
	*/
	async function sair() {
		marcarSaidaPendente();
		setUsuario(null);
		setTela({ nome: "inicio" });
		setMensagem(null);
		const problemas = [];
		await api.sair().then(limparSaidaPendente).catch(() => problemas.push("o servidor não confirmou a saída"));
		await Promise.resolve(sincronizador?.limparDadosLocais()).catch(() => problemas.push("os dados guardados neste aparelho não foram apagados"));
		if (problemas.length > 0) setMensagem(`Você saiu neste aparelho, mas ${problemas.join(" e ")}. Vamos tentar de novo quando você abrir o app.`);
	}
	async function aceitarConvite(token) {
		if (!sincronizador) return;
		try {
			const resultado = await api.aceitarConvite(token);
			await sincronizador.sincronizarAgora();
			setMensagem("Convite aceito! Você já aparece na viagem.");
			setTela({
				nome: "viagem",
				viagemId: resultado.viagemId
			});
		} catch (erro) {
			setMensagem(erro instanceof ErroApi ? erro.message : "Não foi possível aceitar o convite.");
		}
	}
	if (carregando || !sincronizador || !estado) return /* @__PURE__ */ jsx("main", {
		className: "app",
		children: /* @__PURE__ */ jsxs("div", {
			className: "carregando",
			children: [/* @__PURE__ */ jsx("span", { className: "pulso" }), " Verificando sua sessão…"]
		})
	});
	if (!usuario) return /* @__PURE__ */ jsx(Entrar, { aoEntrar: () => {
		api.sessao().then((sessao) => {
			setUsuario(sessao);
			sincronizador.sincronizarAgora().catch(() => void 0);
		});
	} });
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsxs("div", {
			className: "topo",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "topo-linha",
				children: [/* @__PURE__ */ jsxs("small", {
					className: "suave",
					children: ["Conectado como ", usuario.nome]
				}), /* @__PURE__ */ jsx("button", {
					className: "sutil",
					onClick: () => void sair(),
					children: "Sair"
				})]
			}), /* @__PURE__ */ jsx(BarraSincronizacao, {
				estado,
				aoSincronizar: () => void sincronizador.sincronizarAgora().catch(() => void 0),
				aoRetentar: (id) => void sincronizador.retentar(id),
				aoDescartar: (id) => void sincronizador.descartar(id),
				aoResolverConflito: (id, escolha) => void sincronizador.resolverConflito(id, escolha)
			})]
		}),
		mensagem ? /* @__PURE__ */ jsx("div", {
			className: "app",
			style: { paddingBottom: 0 },
			children: /* @__PURE__ */ jsxs("div", {
				className: "aviso info",
				role: "status",
				children: [mensagem, /* @__PURE__ */ jsx("button", {
					className: "sutil",
					style: { marginLeft: 8 },
					onClick: () => setMensagem(null),
					children: "ok"
				})]
			})
		}) : null,
		tela.nome === "inicio" ? /* @__PURE__ */ jsx(Inicio, {
			abrirViagem: (viagemId) => setTela({
				nome: "viagem",
				viagemId
			}),
			aceitarConvite: (token) => void aceitarConvite(token),
			sincronizador
		}) : tela.nome === "viagem" ? /* @__PURE__ */ jsx(Viagem, {
			viagemId: tela.viagemId,
			usuarioId: usuario.id,
			voltar: () => setTela({ nome: "inicio" }),
			sincronizador,
			abrirAtividade: (atividadeId) => setTela({
				nome: "atividade",
				viagemId: tela.viagemId,
				atividadeId
			})
		}) : /* @__PURE__ */ jsx(Atividade, {
			viagemId: tela.viagemId,
			atividadeId: tela.atividadeId,
			sincronizador,
			voltar: () => setTela({
				nome: "viagem",
				viagemId: tela.viagemId
			})
		})
	] });
}
//#endregion
//#region tests/ui/viagens.test.tsx
/**
* Testes de interface com o app de verdade rodando em jsdom.
*
* Estes dois casos são **defeitos relatados em uso real** (2026-10-15): abrir uma viagem nova mostrava
* a viagem antiga, e o botão "Sair" não fazia nada. O teste roda o app inteiro (App.tsx), com servidor
* falso e IndexedDB de verdade (fake-indexeddb), então uma regressão aqui quebra o teste antes de chegar
* na mão de quem usa.
*/
const ANTIGA = {
	id: "v1",
	nome: "Praia antiga",
	destino: "Ubatuba",
	estado: "cancelada",
	versao: 5,
	papel: "organizador",
	atividades: [{
		id: "a1",
		viagemId: "v1",
		dia: "2026-10-10",
		ordem: 1,
		titulo: "Atividade da viagem antiga",
		hora: null,
		duracaoMinutos: null,
		local: null,
		custo: {
			centavos: null,
			natureza: null,
			aVerificar: false
		},
		estado: "planejada",
		deslocamento: null,
		versao: 1
	}]
};
const NOVA = {
	id: "v2",
	nome: "Serra nova",
	destino: "Campos do Jordão",
	estado: "rascunho",
	versao: 1,
	papel: "organizador",
	atividades: []
};
/** Antes de abrir o app: o aparelho já tem a viagem antiga guardada (foi a última aberta). */
async function aparelhoComViagemAntiga() {
	const armazem = criarArmazenamentoIndexedDB("lia-go");
	await armazem.gravar(CHAVE_CARGA, {
		viagens: [],
		viagem: {
			viagem: {
				...ANTIGA,
				rotuloEstado: "Cancelada"
			},
			papel: "organizador",
			participantes: [],
			pendencias: {
				despesas: 0,
				convites: 0
			},
			sugestao: null,
			permissoes: {}
		},
		despesas: [],
		movimentos: [],
		convites: [],
		convitesParaMim: [],
		atividades: ANTIGA.atividades
	});
	await armazem.gravar("viagemAtiva", ANTIGA.id);
}
let raizMontada = null;
function montar() {
	raizMontada?.unmount();
	raizDoDocumento.getElementById("raiz")?.remove();
	const conteiner = raizDoDocumento.createElement("div");
	conteiner.id = "raiz";
	raizDoDocumento.body.append(conteiner);
	raizMontada = createRoot(conteiner);
	raizMontada.render(createElement(App));
}
/**
* Aparelho limpo: sem dado de viagem, sem fila e sem marca de saída pendente de outro teste.
* Usa o próprio adaptador do app (limpar o conteúdo, não apagar o banco — apagar com uma conexão
* aberta pode ficar esperando para sempre, e aí o teste trava).
*/
async function limparAparelho() {
	await criarArmazenamentoIndexedDB("lia-go").limpar();
	globalThis.localStorage?.clear();
}
test("abrir a viagem nova mostra a viagem nova, não a que estava aberta antes", async () => {
	await limparAparelho();
	await aparelhoComViagemAntiga();
	const servidor = criarServidorFalso([ANTIGA, NOVA]);
	globalThis.fetch = servidor.fetch;
	montar();
	await esperarPor(() => textoDaTela().includes("Praia antiga") && textoDaTela().includes("Serra nova"), "a lista de viagens aparecer");
	assert.match(textoDaTela(), /Serra nova/);
	clicar(botaoCom("Serra nova"));
	await esperarPor(() => textoDaTela().includes("Serra nova") && !textoDaTela().includes("Suas viagens"), "a viagem nova abrir");
	const tela = textoDaTela();
	assert.ok(!tela.includes("Praia antiga"), `a viagem antiga não pode aparecer depois de abrir a nova. Tela: ${tela.slice(0, 400)}`);
	assert.match(tela, /Serra nova/);
});
test("depois de abrir a viagem nova, o roteiro dela não mostra atividade da viagem antiga", async () => {
	await limparAparelho();
	await aparelhoComViagemAntiga();
	const servidor = criarServidorFalso([ANTIGA, NOVA]);
	globalThis.fetch = servidor.fetch;
	montar();
	await esperarPor(() => textoDaTela().includes("Praia antiga"), "a lista de viagens aparecer");
	clicar(botaoCom("Serra nova"));
	await esperarPor(() => textoDaTela().includes("Serra nova") && !textoDaTela().includes("Suas viagens"), "a viagem nova abrir");
	clicar(botaoCom("Roteiro"));
	await esperarPor(() => textoDaTela().includes("Nenhuma atividade") || textoDaTela().includes("Atividade da viagem antiga"), "o roteiro abrir");
	assert.ok(!textoDaTela().includes("Atividade da viagem antiga"), `atividade de outra viagem vazou para o roteiro: ${textoDaTela().slice(0, 400)}`);
});
test("o botão Sair encerra a sessão na tela e apaga o que estava guardado no aparelho", async () => {
	await limparAparelho();
	await aparelhoComViagemAntiga();
	const servidor = criarServidorFalso([ANTIGA, NOVA]);
	globalThis.fetch = servidor.fetch;
	montar();
	await esperarPor(() => textoDaTela().includes("Praia antiga"), "a lista de viagens aparecer");
	clicar(botaoCom("Sair"));
	await esperarPor(() => textoDaTela().includes("Entrar"), "voltar para a tela de entrada", 4e3);
	assert.ok(servidor.encerrado, "o servidor precisa ter recebido o aviso de saída");
	const armazem = criarArmazenamentoIndexedDB("lia-go");
	assert.equal(await armazem.ler(CHAVE_CARGA), null, "dado de viagem não pode continuar no aparelho depois de sair");
	assert.equal(await armazem.ler("viagemAtiva"), null);
});
test("Sair funciona mesmo se o servidor não responder (ninguém fica preso dentro do app)", async () => {
	await limparAparelho();
	await aparelhoComViagemAntiga();
	const fetchReal = criarServidorFalso([ANTIGA, NOVA]).fetch;
	globalThis.fetch = (entrada, init) => String(entrada).includes("/auth/logout") ? Promise.reject(/* @__PURE__ */ new TypeError("Failed to fetch")) : fetchReal(entrada, init);
	montar();
	await esperarPor(() => textoDaTela().includes("Praia antiga"), "a lista de viagens aparecer");
	clicar(botaoCom("Sair"));
	await esperarPor(() => textoDaTela().includes("Entrar"), "voltar para a tela de entrada mesmo sem servidor", 4e3);
	await esperarAtualizacoes(2);
});
test("criar viagem já abre a viagem criada (rascunho precisa dos próximos passos)", async () => {
	await limparAparelho();
	const servidor = criarServidorFalso([ANTIGA]);
	globalThis.fetch = servidor.fetch;
	montar();
	await esperarPor(() => textoDaTela().includes("Criar viagem"), "a tela inicial aparecer");
	clicar(botaoCom("Criar viagem"));
	await esperarPor(() => Boolean(raizDoDocumento.querySelector("#nome-viagem")), "o formulário de nova viagem abrir");
	const campoNome = raizDoDocumento.querySelector("#nome-viagem");
	assert.ok(campoNome, "o formulário de nova viagem precisa aparecer");
	await digitar(campoNome, "Chapada");
	clicar(botaoCom("Salvar rascunho"));
	await esperarPor(() => textoDaTela().includes("Chapada") && !textoDaTela().includes("Suas viagens"), "a viagem criada abrir", 8e3);
	assert.match(textoDaTela(), /Chapada/);
	assert.ok(servidor.viagens.some((viagem) => viagem.nome === "Chapada"), "a viagem chegou ao servidor");
});
test("aba Gastos mostra o previsto do roteiro separado do dinheiro oficial", async () => {
	await limparAparelho();
	const servidor = criarServidorFalso([{
		id: "v9",
		nome: "Chapada",
		destino: "Chapada dos Veadeiros",
		estado: "planejada",
		versao: 2,
		papel: "organizador",
		atividades: [
			{
				id: "a1",
				viagemId: "v9",
				dia: "2026-11-20",
				ordem: 1,
				titulo: "Passeio",
				custo: {
					centavos: "15000",
					natureza: "compromisso",
					aVerificar: false
				},
				estado: "planejada",
				versao: 1
			},
			{
				id: "a2",
				viagemId: "v9",
				dia: "2026-11-20",
				ordem: 2,
				titulo: "Almoço",
				custo: {
					centavos: "3500",
					natureza: "estimativa",
					aVerificar: false
				},
				estado: "planejada",
				versao: 1
			},
			{
				id: "a3",
				viagemId: "v9",
				dia: "2026-11-21",
				ordem: 1,
				titulo: "Trilha",
				custo: {
					centavos: null,
					natureza: null,
					aVerificar: true
				},
				estado: "planejada",
				versao: 1
			}
		]
	}]);
	globalThis.fetch = servidor.fetch;
	montar();
	await esperarPor(() => textoDaTela().includes("Chapada"), "a viagem aparecer");
	clicar(botaoCom("Chapada"));
	await esperarPor(() => textoDaTela().includes("← Minhas viagens"), "a viagem abrir");
	clicar(botaoCom("Gastos"));
	await esperarPor(() => textoDaTela().includes("Orçamento da viagem"), "a aba de gastos abrir");
	const tela = textoDaTela();
	assert.match(tela, /Previsto \(estimativas \+ combinado\)R\$ 185,00/, `o previsto junta combinado e estimativa: ${tela.slice(0, 500)}`);
	assert.match(tela, /já combinadoR\$ 150,00/);
	assert.match(tela, /estimativaR\$ 35,00/);
	assert.match(tela, /1 custo ainda sem valor informado/, "custo sem valor é sinalizado, nunca somado como zero");
	assert.match(tela, /Enquanto houver custo a verificar, o previsto é o valor mínimo/);
	assert.match(tela, /não entram no saldo oficial/, "o previsto nunca se confunde com o saldo oficial");
	assert.match(tela, /Gasto confirmado \(oficial\)/);
});
//#endregion
