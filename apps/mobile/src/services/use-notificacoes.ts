/**
 * Estado da central de notificações, em um lugar só.
 *
 * A tela da central e o aviso da tela inicial precisam da **mesma** resposta ("quantas estão
 * abertas?"): se cada uma montasse a sua, o número do Início discordaria do número da central — e
 * aí a pessoa deixa de confiar nos dois. Aqui:
 *  - as marcas (lida/dispensada) são lidas do aparelho e gravadas a cada mudança;
 *  - a lista é derivada do que o aparelho tem (o domínio decide o que vira notificação);
 *  - falha ao ler/gravar marca **não** esconde notificação: a lista continua, com aviso na tela.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MARCAS_VAZIAS,
  aplicarMarcas,
  desmarcarNotificacao,
  marcarNotificacao,
  montarNotificacoes,
  notificacoesResolvidas,
  ordenarNotificacoes,
  resumirNotificacoes,
  viagensComNotificacao,
  type MarcasDeNotificacao,
  type Notificacao,
  type NotificacaoComEstado,
  type NotificacaoResolvida,
  type OrcamentoParaNotificar,
  type ResumoDeNotificacoes,
} from "@lia-go/domain";
import { hojeIso } from "./formato.ts";
import { entradaDeNotificacoes } from "./notificacoes-locais.ts";
import type { EstadoSincronizacao, Sincronizador } from "../offline/sincronizador.ts";

export interface UsoDeNotificacoes {
  estado: EstadoSincronizacao;
  marcas: MarcasDeNotificacao;
  /** O que está aberto agora, com o estado de leitura de cada um. */
  comEstado: NotificacaoComEstado[];
  /** Histórico: obrigações que deixaram de existir nos dados. */
  resolvidas: NotificacaoResolvida[];
  resumo: ResumoDeNotificacoes;
  viagens: { id: string; nome: string }[];
  erro: string | null;
  marcar: (notificacao: Notificacao, marca: "lida" | "dispensada") => void;
  desmarcar: (chave: string) => void;
  marcarTodasComoLidas: () => void;
}

export function useNotificacoes(opcoes: {
  sincronizador: Sincronizador;
  usuarioId: string;
  /** Situação do orçamento da viagem aberta, quando quem chama já a tem do servidor. */
  orcamento?: OrcamentoParaNotificar | null;
}): UsoDeNotificacoes {
  const { sincronizador, usuarioId, orcamento = null } = opcoes;
  const [estado, setEstado] = useState<EstadoSincronizacao>(sincronizador.obter());
  const [marcas, setMarcas] = useState<MarcasDeNotificacao>(MARCAS_VAZIAS);
  const [erro, setErro] = useState<string | null>(null);
  /**
   * As marcas que já foram lidas do aparelho (a "verdade" local) e a fila de gravação.
   *
   * Isso existe por causa de uma corrida de verdade: ler o que está guardado e marcar algo podem
   * acontecer na mesma respiração, e a leitura que chega depois apagava o que a pessoa acabou de
   * marcar (o item dispensado voltava sozinho). Além disso, marcar antes da leitura terminar não
   * pode **sobrescrever** o que já estava guardado: a marca nova é somada ao que já havia.
   */
  const marcasRef = useRef<MarcasDeNotificacao>(MARCAS_VAZIAS);
  const carregadoRef = useRef(false);
  const filaRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => sincronizador.assinar(setEstado), [sincronizador]);

  useEffect(() => {
    let vivo = true;
    carregadoRef.current = false;
    void sincronizador
      .lerMarcasDeNotificacao(usuarioId)
      .then((lidas) => {
        // Se alguém já marcou enquanto a leitura vinha, o que está na tela é mais novo: não rebaixa.
        if (!vivo || carregadoRef.current) return;
        marcasRef.current = lidas;
        carregadoRef.current = true;
        setMarcas(lidas);
      })
      .catch(() => {
        if (vivo) setErro("Não consegui ler o que você já viu neste aparelho; tudo aparece como não lido.");
      });
    return () => {
      vivo = false;
    };
  }, [sincronizador, usuarioId]);

  const hoje = hojeIso();
  const entrada = useMemo(
    () => entradaDeNotificacoes({ estado, usuarioId, hoje, orcamento }),
    [estado, usuarioId, hoje, orcamento],
  );
  const notificacoes = useMemo(() => montarNotificacoes(entrada), [entrada]);
  const comEstado = useMemo(() => ordenarNotificacoes(aplicarMarcas(notificacoes, marcas)), [notificacoes, marcas]);
  const resolvidas = useMemo(() => notificacoesResolvidas(marcas, notificacoes), [marcas, notificacoes]);
  const resumo = useMemo(() => resumirNotificacoes(comEstado, resolvidas), [comEstado, resolvidas]);
  const viagens = useMemo(() => viagensComNotificacao(comEstado, resolvidas), [comEstado, resolvidas]);

  /**
   * Aplica uma mudança nas marcas.
   *
   * - com o aparelho já lido (o caso comum), a tela muda **na hora** e a gravação segue em segundo
   *   plano: quem clica vê o efeito do clique, não o tempo do disco;
   * - antes da leitura terminar, a mudança espera na fila e é **somada** ao que estiver guardado —
   *   assim marcar cedo não apaga marca antiga.
   */
  const aplicar = useCallback(
    (mutacao: (atuais: MarcasDeNotificacao) => MarcasDeNotificacao) => {
      const publicar = (novas: MarcasDeNotificacao): Promise<void> => {
        marcasRef.current = novas;
        carregadoRef.current = true;
        setMarcas(novas);
        return sincronizador.gravarMarcasDeNotificacao(usuarioId, novas).catch(() => {
          setErro("A marca não ficou guardada neste aparelho: ela vale só enquanto o app estiver aberto.");
        });
      };

      if (carregadoRef.current) {
        void publicar(mutacao(marcasRef.current));
        return;
      }

      filaRef.current = filaRef.current
        .then(() => sincronizador.lerMarcasDeNotificacao(usuarioId).catch(() => marcasRef.current))
        .then((base) => publicar(mutacao(base)))
        .then(() => undefined);
    },
    [sincronizador, usuarioId],
  );

  const marcar = useCallback(
    (notificacao: Notificacao, marca: "lida" | "dispensada") => {
      aplicar((atuais) => marcarNotificacao(atuais, notificacao, marca, new Date().toISOString()));
    },
    [aplicar],
  );

  const desmarcar = useCallback(
    (chave: string) => {
      aplicar((atuais) => desmarcarNotificacao(atuais, chave));
    },
    [aplicar],
  );

  const marcarTodasComoLidas = useCallback(() => {
    const agora = new Date().toISOString();
    const aMarcar = comEstado.filter((notificacao) => notificacao.estado === "nova");
    aplicar((atuais) => {
      let novas = atuais;
      for (const notificacao of aMarcar) novas = marcarNotificacao(novas, notificacao, "lida", agora);
      return novas;
    });
  }, [aplicar, comEstado]);

  return { estado, marcas, comEstado, resolvidas, resumo, viagens, erro, marcar, desmarcar, marcarTodasComoLidas };
}
