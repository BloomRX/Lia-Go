/**
 * Sincronizador do aparelho: o único lugar que a interface usa para ler e escrever dados.
 *
 * A interface nunca fala direto com a API: ela pede ao sincronizador, que decide se envia agora
 * ou põe na fila. Assim o app funciona igual com e sem rede, e a fila continua verdadeira quando
 * o sinal volta — inclusive depois de fechar e reabrir o app.
 */
import {
  cargaVazia,
  descartar,
  enfileirar,
  filaVazia,
  mesclarCarga,
  resumoFila,
  retentar,
  sincronizar as passarSincronizacao,
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

export class Sincronizador {
  private readonly armazemLocal: ArmazenamentoLocal;
  private readonly armazem;
  private readonly porta: PortaServidor;
  private estado: EstadoSincronizacao;
  private ouvintes = new Set<Ouvinte>();
  private passadaEmAndamento: Promise<RelatorioSincronizacao> | null = null;

  private constructor(armazemLocal: ArmazenamentoLocal, porta: PortaServidor) {
    this.armazemLocal = armazemLocal;
    this.porta = porta;
    this.armazem = criarArmazenamentoDeSync(armazemLocal);
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
      carga: (await this.armazem.lerCarga()).carga,
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

  /** Chamado quando a pessoa abre uma viagem: é dela que buscamos as mudanças. */
  async abrirViagem(viagemId: string | null): Promise<void> {
    if (this.estado.viagemAtiva === viagemId) return;
    await this.armazemLocal.gravar(CHAVE_VIAGEM_ATIVA, viagemId);
    this.publicar({ viagemAtiva: viagemId });
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

  /** Uma passada por vez: duas em paralelo confundiriam a ordem da fila. */
  sincronizarAgora(): Promise<RelatorioSincronizacao> {
    if (this.passadaEmAndamento) return this.passadaEmAndamento;
    this.publicar({ sincronizando: true });
    this.passadaEmAndamento = this.executarPassada().finally(() => {
      this.passadaEmAndamento = null;
      this.publicar({ sincronizando: false });
    });
    return this.passadaEmAndamento;
  }

  private async executarPassada(): Promise<RelatorioSincronizacao> {
    try {
      const relatorio = await passarSincronizacao(this.armazem, this.porta, {
        agora: () => new Date().toISOString(),
        online: () => this.estado.online,
        viagemAtiva: this.estado.viagemAtiva,
      });
      const { fila, carga } = await this.armazem.lerFila().then(async (filaLida) => ({
        fila: filaLida,
        carga: (await this.armazem.lerCarga()).carga,
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

  /** Mostra na tela, sem esperar rede, o que já está guardado no aparelho. */
  carregarCarga(carga: Partial<CargaLocal>): void {
    this.publicar({ carga: mesclarCarga(this.estado.carga, carga) });
  }

  /**
   * Apaga tudo o que este app guardou no aparelho (fila incluída). Usado ao sair da conta e pelo
   * botão "limpar dados deste aparelho": aparelho perdido não deve continuar com dado de viagem.
   */
  async limparDadosLocais(): Promise<void> {
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
