/**
 * Liga o aparelho à central de notificações: transforma o que está no cache (formato do servidor)
 * no que o domínio entende, sem inventar dado que não existe.
 *
 * Regras que este arquivo garante:
 *  - **só entra o que o aparelho realmente tem**: convite, viagem da lista e os dados da viagem
 *    aberta (que é a única que está baixada). A tela diz isso em texto, para ninguém achar que a
 *    central viu o que não viu;
 *  - **nada de dado de outra viagem**: usa `dadosDaViagemAberta`, que já devolve vazio quando o
 *    cache é de outra viagem (o defeito de 2026-10-15 não volta por aqui);
 *  - **cache estragado não derruba a tela**: item inválido é ignorado, não vira notificação torta.
 */
import type { EntradaDeNotificacoes, EstadoViagem, OrcamentoParaNotificar } from "@lia-go/domain";
import { comoReserva } from "./reserva-cache.ts";
import { checklistDoDominio, dadosDaViagemAberta } from "./viagem-local.ts";
import type { EstadoSincronizacao } from "../offline/sincronizador.ts";

export interface FontesDeNotificacao {
  estado: EstadoSincronizacao;
  usuarioId: string;
  /** Hoje no formato AAAA-MM-DD, do relógio do aparelho (o prazo é fato do calendário). */
  hoje: string;
  /** Situação do orçamento da viagem aberta, quando quem chamou já calculou (servidor ou aparelho). */
  orcamento?: OrcamentoParaNotificar | null;
}

/** Objeto do servidor → viagem da central. `null` quando o registro está estragado. */
function viagemDoCache(item: Record<string, unknown>): EntradaDeNotificacoes["viagens"][number] | null {
  if (typeof item["id"] !== "string" || typeof item["nome"] !== "string") return null;
  const pendencias = Number(item["pendencias_financeiras"] ?? 0);
  return {
    id: item["id"],
    nome: item["nome"],
    estado: (item["estado"] as EstadoViagem) ?? "planejada",
    papel: item["papel"] === "organizador" ? "organizador" : "participante",
    pendenciasFinanceiras: Number.isFinite(pendencias) ? pendencias : 0,
    dataInicio: (item["data_inicio"] as string | null) ?? null,
  };
}

export function entradaDeNotificacoes({ estado, usuarioId, hoje, orcamento = null }: FontesDeNotificacao): EntradaDeNotificacoes {
  const viagens = (estado.carga.viagens as unknown as Record<string, unknown>[])
    .map(viagemDoCache)
    .filter((viagem): viagem is NonNullable<ReturnType<typeof viagemDoCache>> => viagem !== null);

  const convitesRecebidos = (estado.carga.convitesParaMim as unknown as Record<string, unknown>[])
    .map((convite) => {
      const id = convite["id"];
      const viagemNome = convite["viagem_nome"];
      if (typeof id !== "string" || typeof viagemNome !== "string") return null;
      return {
        id,
        viagemId: String(convite["viagem_id"] ?? ""),
        viagemNome,
        expiraEm: (convite["expira_em"] as string | null) ?? null,
      };
    })
    .filter((convite): convite is NonNullable<typeof convite> => convite !== null);

  // A viagem aberta é a única com dados no aparelho: é dela que vêm checklist, reservas e acertos.
  const viagemAbertaId = estado.viagemAtiva;
  const dados = viagemAbertaId ? dadosDaViagemAberta(estado, viagemAbertaId) : null;
  const detalhe = dados?.detalhe ?? null;
  const daViagem = detalhe?.viagem.id === viagemAbertaId ? detalhe : null;

  const nomes: Record<string, string> = {};
  for (const pessoa of (daViagem?.participantes ?? []) as unknown as { usuario_id?: string; nome?: string }[]) {
    if (typeof pessoa.usuario_id === "string" && typeof pessoa.nome === "string") nomes[pessoa.usuario_id] = pessoa.nome;
  }

  const convites = ((estado.carga.convites ?? []) as unknown as Record<string, unknown>[])
    .map((convite) => {
      if (typeof convite["id"] !== "string") return null;
      return {
        id: convite["id"],
        email: (convite["email"] as string | null) ?? null,
        estado: String(convite["estado"] ?? "pendente"),
        expiraEm: (convite["expira_em"] as string | null) ?? null,
      };
    })
    .filter((convite): convite is NonNullable<typeof convite> => convite !== null);

  const movimentos = (dados?.movimentos ?? []).map((movimento) => {
    const valor = movimento.valor_centavos;
    return {
      id: movimento.id,
      deId: movimento.de_id,
      paraId: movimento.para_id,
      // Valor inválido no cache vira zero em vez de derrubar a lista; o texto mostra o número que veio.
      valorCentavos: typeof valor === "string" && /^-?\d+$/.test(valor) ? BigInt(valor) : 0n,
      estado: movimento.estado,
    };
  });

  // Reserva prevista sem valor informado: o orçamento fica menor do que a conta real.
  const reservasSemValor = (dados?.reservas ?? [])
    .map((item) => comoReserva(item as Record<string, unknown>))
    .filter((reserva) => reserva !== null && reserva.estado === "prevista" && reserva.custoCentavos === null)
    .map((reserva) => ({ id: reserva!.id, titulo: reserva!.titulo, inicio: reserva!.inicio }));

  return {
    usuarioId,
    hoje,
    viagens: viagens.map((viagem) => ({
      id: viagem.id,
      nome: viagem.nome,
      estado: viagem.estado,
      papel: viagem.papel,
      pendenciasFinanceiras: viagem.pendenciasFinanceiras,
      dataInicio: viagem.dataInicio,
    })),
    convitesRecebidos,
    nomes,
    viagemAberta:
      viagemAbertaId && daViagem
        ? {
            id: viagemAbertaId,
            nome: String(daViagem.viagem.nome ?? viagens.find((viagem) => viagem.id === viagemAbertaId)?.nome ?? "viagem"),
            convites,
            movimentos,
            itensChecklist: checklistDoDominio(estado, viagemAbertaId),
            reservasSemValor,
            orcamento,
          }
        : null,
  };
}

/** Texto curto para a tela dizer o que a central alcança agora (e o que depende de abrir a viagem). */
export function alcanceDaCentral(estado: EstadoSincronizacao): string {
  const viagemAbertaId = estado.viagemAtiva;
  const aberta = viagemAbertaId ? dadosDaViagemAberta(estado, viagemAbertaId).detalhe : null;
  const nome = aberta ? String(aberta.viagem.nome ?? "") : "";
  if (!nome) {
    return "Esta central olha a sua lista de viagens e os convites. Abra uma viagem para ela incluir checklist, reservas, acertos e orçamento dela.";
  }
  return `Esta central olha a sua lista de viagens, os convites e os dados de "${nome}" que já estão neste aparelho. As outras viagens entram checklist, reservas, acertos e orçamento quando você abrir cada uma.`;
}
