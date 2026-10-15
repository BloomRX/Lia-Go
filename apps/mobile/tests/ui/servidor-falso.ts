/**
 * Servidor falso para os testes de interface: responde as rotas que o app usa, em memória.
 *
 * Não é um mock de mentira: as formas das respostas são as mesmas de `apps/mobile/src/services/api.ts`,
 * então o caminho exercitado é o de verdade (fila → porta do servidor → carga local → tela).
 */
export interface ViagemFalsa {
  id: string;
  nome: string;
  destino: string;
  estado: "rascunho" | "planejada" | "em_andamento" | "concluida" | "pendente" | "cancelada";
  versao: number;
  papel: "organizador" | "participante";
  atividades?: Record<string, unknown>[];
  reservas?: Record<string, unknown>[];
  despesas?: Record<string, unknown>[];
}

export interface ServidorFalso {
  fetch: typeof fetch;
  viagens: ViagemFalsa[];
  chamadas: { metodo: string; caminho: string }[];
  encerrado: boolean;
}

const PARTICIPANTE = { usuario_id: "u1", nome: "Ana", papel: "organizador", estado: "ativo" };

export function criarServidorFalso(viagens: ViagemFalsa[], usuarioId = "u1"): ServidorFalso {
  const estado: ServidorFalso = { viagens, chamadas: [], encerrado: false, fetch: () => Promise.reject(new Error("não pronto")) };

  function resumo(viagem: ViagemFalsa) {
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
      pendencias_financeiras: 0,
    };
  }

  function json(corpo: unknown, status = 200): Response {
    return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
  }

  function encontrar(caminho: string): ViagemFalsa | undefined {
    const id = caminho.split("/")[3];
    return estado.viagens.find((viagem) => viagem.id === id);
  }

  estado.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(entrada), "http://localhost:5273");
    const caminho = url.pathname;
    const metodo = init?.method ?? "GET";
    estado.chamadas.push({ metodo, caminho: caminho + url.search });

    if (caminho === "/api/auth/sessao") return json({ usuario: { id: usuarioId, nome: "Ana", email: "ana@exemplo.com" } });
    if (caminho === "/api/auth/logout") {
      estado.encerrado = true;
      return new Response(null, { status: 204 });
    }

    if (caminho === "/api/viagens" && metodo === "GET") {
      return json({ viagens: estado.viagens.map(resumo), convitesPendentes: [] });
    }

    if (caminho === "/api/viagens" && metodo === "POST") {
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { nome?: string; destino?: string };
      const nova: ViagemFalsa = {
        id: `v${estado.viagens.length + 1}`,
        nome: corpo.nome ?? "sem nome",
        destino: corpo.destino ?? "",
        estado: "rascunho",
        versao: 1,
        papel: "organizador",
      };
      estado.viagens.push(nova);
      return json({ id: nova.id, estado: "rascunho" });
    }

    const viagem = encontrar(caminho);
    if (!viagem) return json({ erro: "nao_encontrada", mensagem: "Viagem não encontrada." }, 404);

    if (caminho.endsWith("/mudancas")) {
      return json({
        cursor: String(Number(url.searchParams.get("desde") ?? "0") + 1),
        temMais: false,
        mudancas: 1,
        viagem: resumo(viagem),
        papel: viagem.papel,
        participantes: [PARTICIPANTE],
        pendencias: { despesas: 0, convites: 0 },
        sugestao: null,
        permissoes: {
          editar: { permitido: true, motivo: "ok" },
          cancelar: { permitido: true, motivo: "ok" },
          convidar: { permitido: true, motivo: "ok" },
          registrarDespesa: { permitido: viagem.estado !== "cancelada", motivo: "ok" },
          criarReserva: { permitido: viagem.estado === "rascunho" || viagem.estado === "planejada" || viagem.estado === "em_andamento", motivo: "ok" },
          confirmarReserva: { permitido: true, motivo: "ok" },
          cancelarReserva: { permitido: viagem.estado !== "cancelada", motivo: "ok" },
          transicoesPermitidas: [],
        },
        despesas: viagem.despesas ?? [],
        movimentos: [],
        convites: [],
        atividades: viagem.atividades ?? [],
        reservas: viagem.reservas ?? [],
      });
    }

    if (caminho.endsWith("/saldos")) {
      return json({
        realizado: "0",
        comprometido: "0",
        haDivergencia: false,
        saldos: [],
        transferenciasSugeridas: [],
        aviso: "Nada registrado ainda.",
      });
    }

    if (caminho.endsWith("/roteiro")) {
      return json({
        dias: [],
        permissoes: { criarAtividade: viagem.estado === "planejada", motivoParaNaoCriar: null, papel: viagem.papel, estadoViagem: viagem.estado },
      });
    }

    if (caminho.endsWith("/transicoes")) {
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { para?: ViagemFalsa["estado"] };
      if (corpo.para) {
        viagem.estado = corpo.para;
        viagem.versao += 1;
      }
      return json({ estado: viagem.estado, rotuloEstado: viagem.estado });
    }

    if (caminho.endsWith("/reservas") && metodo === "POST") {
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { titulo?: string; tipo?: string; custoCentavos?: string | null };
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
        versao: 1,
      };
      viagem.reservas = [...(viagem.reservas ?? []), nova];
      return json({ reserva: nova }, 201);
    }

    if (caminho.includes("/reservas/") && caminho.endsWith("/confirmar")) {
      const id = caminho.split("/").at(-2);
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { confirmacao?: string; versao?: number };
      const reserva = (viagem.reservas ?? []).find((item) => item["id"] === id);
      if (!reserva) return json({ erro: "nao_encontrada", mensagem: "Reserva não encontrada." }, 404);
      reserva["estado"] = "confirmada";
      reserva["confirmacao"] = corpo.confirmacao ?? null;
      reserva["confirmadaPor"] = usuarioId;
      reserva["confirmadaEm"] = new Date().toISOString();
      reserva["versao"] = Number(reserva["versao"] ?? 1) + 1;
      return json({ reserva });
    }

    if (caminho.includes("/reservas/") && caminho.endsWith("/cancelar")) {
      const id = caminho.split("/").at(-2);
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { motivo?: string };
      const reserva = (viagem.reservas ?? []).find((item) => item["id"] === id);
      if (!reserva) return json({ erro: "nao_encontrada", mensagem: "Reserva não encontrada." }, 404);
      reserva["estado"] = "cancelada";
      reserva["motivoCancelamento"] = corpo.motivo ?? null;
      reserva["versao"] = Number(reserva["versao"] ?? 1) + 1;
      return json({ reserva });
    }

    if (caminho.endsWith("/atividades") && metodo === "POST") {
      return json({ dia: "2026-12-20", atividades: [], resumo: {}, conflitos: [] });
    }

    return json({ erro: "nao_implementado", mensagem: `A rota ${metodo} ${caminho} não existe no servidor falso.` }, 404);
  }) as typeof fetch;

  return estado;
}
