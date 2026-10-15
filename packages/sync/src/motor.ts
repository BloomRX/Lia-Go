/**
 * Motor de sincronização: uma passada = buscar o que mudou no servidor + enviar o que está na
 * fila do aparelho, nesta ordem.
 *
 * O motor não conhece HTTP, banco nem interface: recebe o armazenamento e uma "porta" para o
 * servidor. Assim ele é testado sem rede e a interface só precisa olhar o relatório.
 */
import {
  classificarErro,
  juntarFilaDaPassada,
  marcarEnviada,
  marcarEnviando,
  marcarFalha,
  proximaOperacao,
  recuperarInterrompidas,
  resumoFila,
} from "./fila.ts";
import { mesclarCarga } from "./carga.ts";
import type {
  CargaLocal,
  ErroEnvio,
  Fila,
  Operacao,
  RelatorioSincronizacao,
  ResultadoEnvio,
} from "./tipos.ts";

export interface ArmazenamentoSync {
  lerFila(): Promise<Fila>;
  gravarFila(fila: Fila): Promise<void>;
  lerCarga(): Promise<{ cursor: string | null; carga: CargaLocal }>;
  gravarCarga(cursor: string | null, carga: CargaLocal): Promise<void>;
}

export interface ResultadoBusca {
  ok: boolean;
  cursor?: string | null;
  carga?: Partial<CargaLocal>;
  erro?: ErroEnvio;
}

export interface PortaServidor {
  /** Envia uma operação. A mesma `idempotencia` nunca aplica duas vezes (o servidor garante). */
  enviar(operacao: Operacao, idempotencia: string): Promise<ResultadoEnvio>;
  /** Retrato das viagens da conta (usado no início de cada passada). */
  buscarViagens(): Promise<ResultadoBusca>;
  /** Mudanças de uma viagem desde o cursor. */
  buscarMudancas(viagemId: string, cursor: string | null): Promise<ResultadoBusca>;
}

export interface OpcoesMotor {
  agora(): string;
  online(): boolean;
  /**
   * Viagem aberta na tela, quando existe: é dela que buscamos as mudanças.
   *
   * É uma **função** de propósito. A pessoa pode abrir outra viagem no meio de uma passada; o motor
   * então percebe a troca e descarta o resultado que já não pertence à tela — sem isso, a viagem
   * antiga reaparecia por cima da nova (defeito relatado em 2026-10-15).
   */
  viagemAtiva?: () => string | null;
}

export async function sincronizar(
  armazem: ArmazenamentoSync,
  servidor: PortaServidor,
  opcoes: OpcoesMotor,
): Promise<RelatorioSincronizacao> {
  const agora = opcoes.agora();
  const filaInicial = recuperarInterrompidas(await armazem.lerFila(), agora);
  let fila = filaInicial;

  /**
   * Toda gravação da fila passa por aqui: o que entrou no aparelho **durante** a passada é
   * preservado (era o defeito que fazia a viagem recém-criada desaparecer, em 2026-10-15).
   */
  const salvarFila = async (): Promise<void> => {
    const doAparelho = await armazem.lerFila();
    fila = juntarFilaDaPassada(doAparelho, { antes: filaInicial, depois: fila });
    await armazem.gravarFila(fila);
  };
  const relatorio: RelatorioSincronizacao = {
    enviados: 0,
    falharam: 0,
    conflitos: 0,
    aguardando: resumoFila(fila).aguardando,
    cursor: null,
    buscadasMudancas: false,
    atualizadoEm: agora,
    parada: "nada_a_fazer",
  };

  if (!opcoes.online()) {
    await salvarFila();
    relatorio.parada = "offline";
    relatorio.aguardando = resumoFila(fila).aguardando;
    return relatorio;
  }

  // 1. Trazer o que mudou no servidor (por último, para já incluir o efeito dos nossos envios).
  const viagemDaPassada = opcoes.viagemAtiva?.() ?? null;
  const trocouDeViagem = (): boolean => (opcoes.viagemAtiva?.() ?? null) !== viagemDaPassada;

  const buscarNoServidor = async (): Promise<void> => {
    const lista = await servidor.buscarViagens();
    let { cursor, carga } = await armazem.lerCarga();
    if (lista.ok && lista.carga) carga = mesclarCarga(carga, lista.carga, { viagemAtiva: opcoes.viagemAtiva?.() ?? null });
    // A lista de viagens não define cursor de mudanças: só um cursor de verdade o substitui.
    if (lista.ok && typeof lista.cursor === "string") cursor = lista.cursor;

    if (viagemDaPassada) {
      // O cursor é **por viagem**: usar o de outra viagem devolveria mudanças de menos.
      const cursorDaViagem = viagemDaPassada === (opcoes.viagemAtiva?.() ?? null) ? cursor : null;
      const mudancas = await servidor.buscarMudancas(viagemDaPassada, cursorDaViagem);
      if (trocouDeViagem()) {
        // A pessoa abriu outra viagem enquanto buscávamos: este resultado é de outro contexto.
        relatorio.parada = "trocou_de_viagem";
        return;
      }
      if (mudancas.ok && mudancas.carga) {
        carga = mesclarCarga(carga, mudancas.carga, { viagemAtiva: opcoes.viagemAtiva?.() ?? null });
        cursor = mudancas.cursor ?? cursor;
        relatorio.buscadasMudancas = true;
      }
    } else if (lista.ok) {
      relatorio.buscadasMudancas = true;
    }
    relatorio.cursor = cursor;
    await armazem.gravarCarga(cursor, carga);
  };

  try {
    await buscarNoServidor();
  } catch {
    // Rede caiu no meio da busca: seguimos para a fila, que decide por conta própria.
    relatorio.parada = "erro_de_rede_na_busca";
  }

  // 2. Enviar a fila, na ordem de criação.
  relatorio.parada = relatorio.parada === "erro_de_rede_na_busca" ? "erro_de_rede_na_busca" : "fila_vazia";
  for (;;) {
    const pendente = proximaOperacao(fila, agora);
    if (!pendente) break;

    fila = marcarEnviando(fila, pendente.id);
    await salvarFila();

    let resultado: ResultadoEnvio;
    try {
      resultado = await servidor.enviar(pendente.operacao, pendente.id);
    } catch (causa) {
      resultado = { ok: false, erro: { codigo: "rede", mensagem: mensagemDaCausa(causa) } };
    }

    if (resultado.ok) {
      fila = marcarEnviada(fila, pendente.id, agora);
      relatorio.enviados += 1;
    } else {
      const erro = resultado.erro ?? { codigo: "desconhecido", mensagem: "Falha desconhecida ao enviar." };
      fila = marcarFalha(fila, pendente.id, erro, agora);
      const destino = classificarErro(erro).destino;
      if (destino === "conflito") relatorio.conflitos += 1;
      else if (destino === "permanente") relatorio.falharam += 1;
      if (destino === "reenviar") {
        // Preserva a ordem: nada atrás de uma operação pendente de rede é enviado antes dela.
        relatorio.parada = "reenvio_agendado";
        break;
      }
    }
    await salvarFila();
  }

  await salvarFila();
  relatorio.aguardando = resumoFila(fila).aguardando;

  // 3. Se algo foi enviado, buscar de novo: a carga local passa a refletir o servidor.
  if (relatorio.enviados > 0) {
    try {
      await buscarNoServidor();
    } catch {
      /* a próxima passada resolve */
    }
  }

  relatorio.atualizadoEm = opcoes.agora();
  return relatorio;
}

function mensagemDaCausa(causa: unknown): string {
  if (causa instanceof Error) return causa.message;
  return "Sem conexão com o servidor.";
}
