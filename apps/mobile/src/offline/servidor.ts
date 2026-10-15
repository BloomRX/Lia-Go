/**
 * Liga o motor de sincronização (pacote @lia-go/sync, que não conhece HTTP) ao cliente da API.
 *
 * Cada operação da fila vira a chamada de API correspondente, sempre com a **mesma chave de
 * idempotência** (o id da operação) — é isso que torna o reenvio seguro.
 */
import type { ErroEnvio, Operacao, PortaServidor, ResultadoBusca, ResultadoEnvio } from "@lia-go/sync";
import { api, ErroApi, type MudancasApi } from "../services/api.ts";

export function criarPortaServidor(): PortaServidor {
  return {
    async enviar(operacao: Operacao, idempotencia: string): Promise<ResultadoEnvio> {
      try {
        const resposta = await enviarOperacao(operacao, idempotencia);
        return { ok: true, resposta };
      } catch (causa) {
        return { ok: false, erro: traduzirErro(causa) };
      }
    },

    async buscarViagens(): Promise<ResultadoBusca> {
      try {
        const { viagens, convitesPendentes } = await api.listarViagens();
        return {
          ok: true,
          carga: {
            viagens: viagens as unknown as Record<string, unknown>[],
            convitesParaMim: convitesPendentes as unknown as Record<string, unknown>[],
          },
        };
      } catch (causa) {
        return { ok: false, erro: traduzirErro(causa) };
      }
    },

    async buscarMudancas(viagemId: string, cursor: string | null): Promise<ResultadoBusca> {
      try {
        const mudancas = await api.mudancas(viagemId, cursor);
        return { ok: true, cursor: mudancas.cursor, carga: extrairCarga(mudancas) };
      } catch (causa) {
        return { ok: false, erro: traduzirErro(causa) };
      }
    },
  };
}

async function enviarOperacao(operacao: Operacao, idempotencia: string): Promise<unknown> {
  switch (operacao.tipo) {
    case "criar_viagem":
      return api.criarViagem(operacao.corpo as { nome: string; destino: string; dataInicio: string | null; dataFim: string | null }, idempotencia);
    case "transicao_viagem":
      return api.transicionar(operacao.viagemId, operacao.para, undefined, operacao.versao);
    case "criar_despesa":
      return api.criarDespesa(operacao.viagemId, operacao.corpo as Parameters<typeof api.criarDespesa>[1], idempotencia);
    case "confirmar_despesa":
      return api.confirmarDespesa(operacao.viagemId, operacao.despesaId);
    case "contestar_despesa":
      return api.contestarDespesa(operacao.viagemId, operacao.despesaId, operacao.motivo);
    case "criar_movimento":
      return api.criarMovimento(operacao.viagemId, operacao.corpo as Parameters<typeof api.criarMovimento>[1], idempotencia);
    case "confirmar_movimento":
      return api.confirmarMovimento(operacao.viagemId, operacao.movimentoId);
    case "contestar_movimento":
      return api.contestarMovimento(operacao.viagemId, operacao.movimentoId, operacao.motivo);
    case "criar_atividade":
      return api.criarAtividade(operacao.viagemId, operacao.corpo as Parameters<typeof api.criarAtividade>[1], idempotencia);
    case "concluir_atividade":
      return api.concluirAtividade(operacao.viagemId, operacao.atividadeId, {
        observacao: operacao.observacao ?? null,
        ...(operacao.versao === undefined ? {} : { versao: operacao.versao }),
      });
    case "cancelar_atividade":
      return api.cancelarAtividade(operacao.viagemId, operacao.atividadeId, {
        motivo: operacao.motivo,
        ...(operacao.versao === undefined ? {} : { versao: operacao.versao }),
      });
    case "criar_reserva":
      return api.criarReserva(operacao.viagemId, operacao.corpo as Parameters<typeof api.criarReserva>[1], idempotencia);
    case "confirmar_reserva":
      return api.confirmarReserva(operacao.viagemId, operacao.reservaId, operacao.confirmacao, operacao.versao);
    case "cancelar_reserva":
      return api.cancelarReserva(operacao.viagemId, operacao.reservaId, operacao.motivo, operacao.versao);
    case "corrigir_atividade":
      return api.corrigirAtividade(operacao.viagemId, operacao.atividadeId, operacao.corpo as { motivo: string });
    case "criar_item_checklist":
      return api.criarItemChecklist(operacao.viagemId, operacao.corpo as Parameters<typeof api.criarItemChecklist>[1], idempotencia);
    case "concluir_item_checklist":
      return api.concluirItemChecklist(operacao.viagemId, operacao.itemId, operacao.versao);
    case "reabrir_item_checklist":
      return api.reabrirItemChecklist(operacao.viagemId, operacao.itemId, operacao.motivo, operacao.versao);
    case "criar_documento":
      return api.criarDocumento(operacao.viagemId, operacao.corpo as Parameters<typeof api.criarDocumento>[1], idempotencia);
  }
}

/**
 * A carga que o motor guarda vem direto da resposta da API, sem tradução de formato:
 * é o mesmo objeto que a tela desenha, então nada se perde no caminho.
 */
export function extrairCarga(mudancas: MudancasApi): Record<string, unknown> {
  return {
    viagem: {
      viagem: mudancas.viagem as unknown as Record<string, unknown>,
      papel: mudancas.papel,
      participantes: mudancas.participantes as unknown as Record<string, unknown>[],
      pendencias: mudancas.pendencias,
      sugestao: mudancas.sugestao,
      permissoes: mudancas.permissoes,
    },
    despesas: mudancas.despesas as unknown as Record<string, unknown>[],
    movimentos: mudancas.movimentos as unknown as Record<string, unknown>[],
    convites: mudancas.convites,
    atividades: (mudancas.atividades ?? []) as unknown as Record<string, unknown>[],
    reservas: (mudancas.reservas ?? []) as unknown as Record<string, unknown>[],
    itensChecklist: (mudancas.itensChecklist ?? []) as unknown as Record<string, unknown>[],
    // O aviso de remoção (`{id, removido: true}`) chega junto: é o que faz o documento sair do aparelho.
    documentos: (mudancas.documentos ?? []) as unknown as Record<string, unknown>[],
  };
}

/**
 * Traduz o erro para o que a fila precisa saber: código, status e detalhes.
 * Sem resposta (rede caiu) o status fica ausente de propósito — a fila trata como temporário.
 */
export function traduzirErro(causa: unknown): ErroEnvio {
  if (causa instanceof ErroApi) {
    return {
      codigo: causa.codigo,
      mensagem: causa.message,
      status: causa.status,
      ...(causa.detalhes === undefined ? {} : { detalhes: causa.detalhes }),
    };
  }
  if (causa instanceof TypeError) {
    return { codigo: "rede", mensagem: "Sem conexão com o servidor. Vamos tentar de novo automaticamente." };
  }
  const mensagem = causa instanceof Error ? causa.message : "Falha inesperada ao enviar.";
  return { codigo: "desconhecido", mensagem, status: 500 };
}
