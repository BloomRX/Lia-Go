/**
 * Sincronizador do aparelho: o único lugar que a interface usa para ler e escrever dados.
 *
 * A interface nunca fala direto com a API: ela pede ao sincronizador, que decide se envia agora
 * ou põe na fila. Assim o app funciona igual com e sem rede, e a fila continua verdadeira quando
 * o sinal volta — inclusive depois de fechar e reabrir o app.
 */
import {
  cargaCompleta,
  cargaVazia,
  descartar,
  enfileirar,
  filaVazia,
  mesclarCarga,
  resumoFila,
  retentar,
  sincronizar as passarSincronizacao,
  trocarViagemAberta,
  type CargaLocal,
  type Fila,
  type Operacao,
  type PortaServidor,
  type RelatorioSincronizacao,
  type ResumoFila,
} from "@lia-go/sync";
import {
  CHAVE_VIAGEM_ATIVA,
  criarArmazenamentoDeSync,
  escolherArmazenamento,
  type ArmazenamentoLocal,
} from "./armazenamento.ts";
import { criarPortaServidor } from "./servidor.ts";
import { MARCAS_VAZIAS, podarMarcas, type MarcasDeNotificacao } from "@lia-go/domain";
import { Platform } from "../services/plataforma.ts";
import type { SaldosApi } from "../services/api.ts";

export interface EstadoSincronizacao {
  resumo: ResumoFila;
  carga: CargaLocal;
  fila: Fila;
  viagemAtiva: string | null;
  online: boolean;
  sincronizando: boolean;
  /** Instante do último "tudo sincronizado" — a interface mostra isso para dar confiança. */
  ultimaSincronizacao: string | null;
  armazenamento: string;
  erroUltimaPassada: string | null;
}

type Ouvinte = (estado: EstadoSincronizacao) => void;

const CHAVE_SALDOS = "saldos";
const CHAVE_NOTIFICACOES = "notificacoes";

export class Sincronizador {
  private readonly armazemLocal: ArmazenamentoLocal;
  private readonly armazem: ReturnType<typeof criarArmazenamentoDeSync>;
  private readonly porta: PortaServidor;
  private estado: EstadoSincronizacao;
  private ouvintes = new Set<Ouvinte>();
  private passadaEmAndamento: Promise<RelatorioSincronizacao> | null = null;
  /** Quem pediu sincronizar durante uma passada espera **uma** passada seguinte, não uma cada. */
  private pedidoPendente: { resolver: (relatorio: RelatorioSincronizacao) => void; rejeitar: (causa: unknown) => void } | null = null;
  private proximaPassada: Promise<RelatorioSincronizacao> | null = null;
  /** Depois de sair da conta o sincronizador para de escrever: nada volta para o aparelho. */
  private desligado = false;

  private constructor(armazemLocal: ArmazenamentoLocal, porta: PortaServidor) {
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
      erroUltimaPassada: null,
    };
  }

  static async criar(
    armazemLocal: ArmazenamentoLocal = escolherArmazenamento(Platform.ehNativo()),
    porta: PortaServidor = criarPortaServidor(),
  ): Promise<Sincronizador> {
    const sincronizador = new Sincronizador(armazemLocal, porta);
    await sincronizador.carregarDoAparelho();
    return sincronizador;
  }

  private async carregarDoAparelho(): Promise<void> {
    const { fila, carga } = await this.armazem.lerFila().then(async (filaLida) => ({
      fila: filaLida,
      carga: cargaCompleta((await this.armazem.lerCarga()).carga),
    }));
    const viagemAtiva = await this.armazemLocal.ler<string>(CHAVE_VIAGEM_ATIVA);
    this.publicar({
      fila,
      carga,
      viagemAtiva: typeof viagemAtiva === "string" ? viagemAtiva : null,
      resumo: resumoFila(fila),
    });
  }

  assinar(ouvinte: Ouvinte): () => void {
    this.ouvintes.add(ouvinte);
    ouvinte(this.estado);
    return () => this.ouvintes.delete(ouvinte);
  }

  obter(): EstadoSincronizacao {
    return this.estado;
  }

  /** Chamado quando o navegador/app percebe que a rede voltou ou caiu. */
  definirOnline(online: boolean): void {
    if (this.estado.online === online) return;
    this.publicar({ online });
    if (online) void this.sincronizarAgora();
  }

  /**
   * Chamado quando a pessoa abre uma viagem: é dela que buscamos as mudanças.
   *
   * O aparelho guarda **uma viagem por vez**. Ao abrir outra, o que era da anterior sai da carga
   * (inclusive o cursor, que é por viagem) — sem isso, a tela de uma viagem nova mostrava os dados
   * da viagem antiga (defeito relatado em 2026-10-15). Fechar a viagem (`null`) **não** apaga nada:
   * o que já está baixado continua útil, e o cursor continua válido se a mesma viagem voltar.
   */
  async abrirViagem(viagemId: string | null): Promise<void> {
    const anterior = this.estado.viagemAtiva;
    if (anterior === viagemId) return;
    await this.armazemLocal.gravar(CHAVE_VIAGEM_ATIVA, viagemId);

    // O cache guarda uma viagem por vez: se o que está guardado é de **outra** viagem, sai agora —
    // é isso que impede a tela de abrir mostrando dados da viagem anterior.
    const cacheDeOutra = this.estado.carga.viagem !== null && this.estado.carga.viagem.viagem.id !== viagemId;
    if (viagemId !== null && cacheDeOutra) {
      const carga = trocarViagemAberta(this.estado.carga);
      await this.armazem.gravarCarga(null, carga);
      this.publicar({ viagemAtiva: viagemId, carga });
    } else {
      this.publicar({ viagemAtiva: viagemId });
    }
    void this.sincronizarAgora().catch(() => undefined);
  }

  /**
   * Enfileira uma escrita. Ela vale imediatamente na tela e vai para o servidor assim que houver
   * rede — o que garante o uso na estrada, sem sinal.
   */
  async enfileirar(operacao: Operacao): Promise<string> {
    const id = crypto.randomUUID();
    const agora = new Date().toISOString();
    const fila = enfileirar(this.estado.fila, { id, operacao, agora });
    await this.armazem.gravarFila(fila);
    this.publicar({ fila, resumo: resumoFila(fila) });
    void this.sincronizarAgora();
    return id;
  }

  async descartar(id: string): Promise<void> {
    const fila = descartar(this.estado.fila, id);
    await this.armazem.gravarFila(fila);
    this.publicar({ fila, resumo: resumoFila(fila) });
  }

  async retentar(id: string): Promise<void> {
    const fila = retentar(this.estado.fila, id, new Date().toISOString());
    await this.armazem.gravarFila(fila);
    this.publicar({ fila, resumo: resumoFila(fila) });
    void this.sincronizarAgora();
  }

  /**
   * Uma passada por vez: duas em paralelo confundiriam a ordem da fila.
   *
   * Pedidos que chegam **durante** uma passada (ex.: acabei de criar uma viagem) não viram uma
   * passada cada um: todos esperam **a mesma** passada seguinte. Sem isso, abrir o app disparava uma
   * avalanche de sincronizações (uma por pedido) e a tela ficava presa em "Confirmando a viagem com o
   * servidor…" — defeito relatado em uso real (2026-10-15).
   */
  sincronizarAgora(): Promise<RelatorioSincronizacao> {
    if (this.passadaEmAndamento) {
      if (!this.proximaPassada) {
        this.proximaPassada = new Promise<RelatorioSincronizacao>((resolver, rejeitar) => {
          this.pedidoPendente = { resolver, rejeitar };
        });
      }
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
  private atenderPedidoPendente(): void {
    const pedido = this.pedidoPendente;
    if (!pedido) return;
    this.pedidoPendente = null;
    this.proximaPassada = null;
    void this.sincronizarAgora().then(pedido.resolver, pedido.rejeitar);
  }

  private async executarPassada(): Promise<RelatorioSincronizacao> {
    if (this.desligado) return relatorioVazio();
    try {
      const relatorio = await passarSincronizacao(this.armazem, this.porta, {
        agora: () => new Date().toISOString(),
        online: () => this.estado.online,
        // Função, não valor: a viagem aberta pode mudar no meio da passada.
        viagemAtiva: () => this.estado.viagemAtiva,
      });
      const { fila, carga } = await this.armazem.lerFila().then(async (filaLida) => ({
        fila: filaLida,
        carga: cargaCompleta((await this.armazem.lerCarga()).carga),
      }));
      const ultimaSincronizacao = fila.operacoes.length === 0 ? (fila.ultimoSucessoEm ?? null) : this.estado.ultimaSincronizacao;
      this.publicar({
        fila,
        carga,
        resumo: resumoFila(fila),
        ultimaSincronizacao,
        erroUltimaPassada: relatorio.parada === "erro_de_rede_na_busca" ? "Não conseguimos falar com o servidor agora." : null,
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
  async resolverConflito(id: string, escolha: "minha" | "servidor"): Promise<void> {
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
      await this.enfileirar({ ...item.operacao, versao: versaoAtual });
      this.publicar({ erroUltimaPassada: null });
      return;
    }

    this.publicar({
      erroUltimaPassada:
        "Não dá para reaplicar esta alteração automaticamente. Use a versão do servidor ou faça a alteração de novo.",
    });
  }

  /** Saldos são calculados no servidor: o aparelho guarda apenas a última informação conhecida. */
  async guardarSaldos(viagemId: string, saldos: SaldosApi): Promise<void> {
    await this.armazemLocal.gravar(`${CHAVE_SALDOS}:${viagemId}`, { saldos, em: new Date().toISOString() });
  }

  async lerSaldos(viagemId: string): Promise<{ saldos: SaldosApi; em: string } | null> {
    return this.armazemLocal.ler<{ saldos: SaldosApi; em: string }>(`${CHAVE_SALDOS}:${viagemId}`);
  }

  /**
   * Marcas da central de notificações (**lida** ou **dispensada**) de uma pessoa deste aparelho.
   *
   * Ficam no aparelho e separadas por pessoa (`notificacoes:<usuarioId>`): são estado de leitura, não
   * dado da viagem. Ninguém precisa saber, no servidor, o que já foi aberto na tela — e a chave por
   * pessoa evita que duas contas no mesmo aparelho herdem a leitura uma da outra.
   */
  async lerMarcasDeNotificacao(usuarioId: string): Promise<MarcasDeNotificacao> {
    const bruto = await this.armazemLocal.ler<MarcasDeNotificacao>(`${CHAVE_NOTIFICACOES}:${usuarioId}`);
    return bruto && typeof bruto === "object" ? podarMarcas(bruto) : MARCAS_VAZIAS;
  }

  async gravarMarcasDeNotificacao(usuarioId: string, marcas: MarcasDeNotificacao): Promise<void> {
    await this.armazemLocal.gravar(`${CHAVE_NOTIFICACOES}:${usuarioId}`, podarMarcas(marcas));
  }

  /** Mostra na tela, sem esperar rede, o que já está guardado no aparelho. */
  carregarCarga(carga: Partial<CargaLocal>): void {
    this.publicar({ carga: mesclarCarga(this.estado.carga, carga) });
  }

  /**
   * Apaga tudo o que este app guardou no aparelho (fila incluída). Usado ao sair da conta e pelo
   * botão "limpar dados deste aparelho": aparelho perdido não deve continuar com dado de viagem.
   */
  async limparDadosLocais(): Promise<void> {
    this.desligado = true;
    await this.armazemLocal.limpar();
    this.publicar({
      fila: filaVazia(),
      carga: cargaVazia(),
      resumo: resumoFila(filaVazia()),
      viagemAtiva: null,
      ultimaSincronizacao: null,
    });
  }

  private publicar(mudanca: Partial<EstadoSincronizacao>): void {
    this.estado = { ...this.estado, ...mudanca };
    for (const ouvinte of this.ouvintes) ouvinte(this.estado);
  }
}

/** Relatório de uma passada que não fez nada (usado depois de sair da conta). */
function relatorioVazio(): RelatorioSincronizacao {
  return {
    enviados: 0,
    falharam: 0,
    conflitos: 0,
    aguardando: 0,
    cursor: null,
    buscadasMudancas: false,
    atualizadoEm: new Date().toISOString(),
    parada: "nada_a_fazer",
  };
}

/** A versão que o servidor informou no conflito (`detalhes.versaoAtual`). */
function versaoDoErro(detalhes: unknown): number | null {
  if (detalhes && typeof detalhes === "object" && "versaoAtual" in detalhes) {
    const versao = (detalhes as { versaoAtual: unknown }).versaoAtual;
    if (typeof versao === "number" && Number.isInteger(versao)) return versao;
  }
  return null;
}

function estaOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}
