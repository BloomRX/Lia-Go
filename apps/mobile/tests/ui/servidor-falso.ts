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
  checklist?: Record<string, unknown>[];
  documentos?: Record<string, unknown>[];
  /** Limite combinado da viagem (centavos), quando existe. */
  limiteColetivoCentavos?: string | null;
  /** Gasto confirmado/official que o servidor devolve em `/saldos`. */
  realizado?: string;
  comprometido?: string;
  /** Despesas pendentes/contestadas: é o número que a central de notificações usa. */
  pendenciasFinanceiras?: number;
  /** Acertos registrados (pagamento informado/confirmado). */
  movimentos?: Record<string, unknown>[];
  /** Convites que o organizador enviou (a central avisa os que não foram aceitos). */
  convites?: Record<string, unknown>[];
}

export interface ServidorFalso {
  fetch: typeof fetch;
  viagens: ViagemFalsa[];
  chamadas: { metodo: string; caminho: string }[];
  encerrado: boolean;
  /**
   * `false` simula o navegador que **não guarda a sessão** — o caso do app rodando dentro de outra
   * página (iframe): o cookie `SameSite=Lax` não volta, então `/auth/sessao` responde 401 depois de
   * um login que deu certo. Foi o "clico em Entrar e nada acontece" de 2026-10-17.
   */
  guardaSessao: boolean;
  /** Sessão já aberta no servidor (o app pergunta em `/auth/sessao` ao abrir). */
  logado: boolean;
  /**
   * `false` simula o servidor que não aceita sessão por token. O caminho normal (`true`) é o que
   * permite o app entrar quando o navegador recusa o cookie: login com `cliente: "nativo"` devolve
   * tokens e `/auth/sessao` aceita `Authorization: Bearer`.
   */
  aceitaToken: boolean;
}

const PARTICIPANTE = { usuario_id: "u1", nome: "Ana", papel: "organizador", estado: "ativo" };

export function criarServidorFalso(
  viagens: ViagemFalsa[],
  usuarioId = "u1",
  /** Convites que **eu** recebi e ainda não aceitei (vêm da lista de viagens). */
  convitesPendentes: Record<string, unknown>[] = [],
): ServidorFalso {
  const estado: ServidorFalso = {
    viagens,
    chamadas: [],
    encerrado: false,
    guardaSessao: true,
    logado: true,
    aceitaToken: true,
    fetch: () => Promise.reject(new Error("não pronto")),
  };

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
      pendencias_financeiras: viagem.pendenciasFinanceiras ?? 0,
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
    const params = new URLSearchParams(url.search);
    const tokenQuery = params.get("_sessao");
    params.delete("_sessao");
    const buscaLimpa = params.toString() ? `?${params.toString()}` : "";
    estado.chamadas.push({ metodo, caminho: caminho + buscaLimpa });
    const cabecalhos = new Headers(init?.headers);
    const corpo = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    const portadorDeToken =
      cabecalhos.get("authorization") === "Bearer token-de-acesso" ||
      cabecalhos.get("x-lia-sessao") === "token-de-acesso" ||
      tokenQuery === "token-de-acesso";
    const USUARIO = { id: usuarioId, nome: "Ana", email: "ana@exemplo.com" };

    if (caminho.endsWith("/saude")) {
      return json({ ok: true, servico: "lia-go-api", versao: "0.1.0" });
    }

    if (caminho === "/api/auth/sessao") {
      // Token só vale se o servidor aceitar e o cookie não tiver vindo (é o caso embutido).
      if (estado.aceitaToken && portadorDeToken) return json({ usuario: USUARIO });
      if (!estado.logado || !estado.guardaSessao) {
        return json({ erro: "nao_autenticado", mensagem: "Entre para continuar." }, 401);
      }
      return json({ usuario: USUARIO });
    }
    if (caminho === "/api/auth/login" && metodo === "POST") {
      // O servidor aceita as credenciais; o **navegador** é que pode não guardar o cookie
      // (`guardaSessao: false`), e é isso que o app precisa detectar em vez de ficar mudo.
      estado.logado = true;
      if (corpo.cliente === "nativo" && estado.aceitaToken) {
        return json({
          usuario: USUARIO,
          acesso: { token: "token-de-acesso", expiraEm: "2027-01-01T00:00:00.000Z" },
          refresh: { token: "token-de-refresh", expiraEm: "2027-03-01T00:00:00.000Z" },
        });
      }
      return json({ usuario: USUARIO });
    }
    if (caminho === "/api/auth/registro" && metodo === "POST") {
      estado.logado = true;
      return json({ usuario: USUARIO }, 201);
    }
    if (caminho === "/api/auth/logout") {
      estado.encerrado = true;
      return new Response(null, { status: 204 });
    }

    if (caminho === "/api/viagens" && metodo === "GET") {
      return json({ viagens: estado.viagens.map(resumo), convitesPendentes });
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
          // Permissões novas (orçamento, checklist, documentos e exportação), como o servidor manda:
          // a interface não decide permissão sozinha, ela mostra o que o servidor autorizou.
          definirLimite: { permitido: viagem.papel === "organizador", motivo: "ok" },
          definirLimiteProprio: { permitido: true, motivo: "ok" },
          criarItemChecklist: { permitido: viagem.estado !== "cancelada", motivo: "ok" },
          concluirItemChecklist: { permitido: true, motivo: "ok" },
          criarDocumento: { permitido: viagem.estado !== "cancelada", motivo: "ok" },
          exportar: { permitido: true, motivo: "ok" },
          transicoesPermitidas: [],
        },
        despesas: viagem.despesas ?? [],
        movimentos: viagem.movimentos ?? [],
        convites: viagem.convites ?? [],
        atividades: viagem.atividades ?? [],
        reservas: viagem.reservas ?? [],
        itensChecklist: viagem.checklist ?? [],
        documentos: viagem.documentos ?? [],
      });
    }

    if (caminho.endsWith("/saldos")) {
      return json({
        realizado: viagem.realizado ?? "0",
        comprometido: viagem.comprometido ?? "0",
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

    if (caminho.endsWith("/orcamento") && metodo === "GET") {
      const limite = viagem.limiteColetivoCentavos ?? null;
      const previsto = (viagem.atividades ?? []).reduce((soma, atividade) => {
        const custo = (atividade["custo"] ?? {}) as { centavos?: string | null };
        return soma + BigInt(custo.centavos ?? "0");
      }, 0n);
      const gasto = BigInt(viagem.realizado ?? "0");
      const percentual = limite === null || BigInt(limite) === 0n ? null : Number((previsto * 100n) / BigInt(limite));
      return json({
        limiteColetivo: limite === null ? null : { id: "l1", centavos: limite, atualizadoEm: new Date().toISOString(), versao: 1 },
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
          percentualGasto: limite === null ? null : Number((gasto * 100n) / BigInt(limite)),
          estado: limite === null ? "sem_limite" : percentual === null ? "dentro" : percentual > 100 ? "estourado" : percentual >= 80 ? "atencao" : "dentro",
          alertas: [],
          resumo: limite === null ? "Sem limite definido." : `Previsto de ${limite}.`,
        },
        planejamento: { previstoCentavos: previsto.toString(), custosAVerificar: 0 },
        oficial: { gastoConfirmadoCentavos: gasto.toString(), aguardandoCentavos: viagem.comprometido ?? "0" },
        rotulos: { sem_limite: "Sem limite", dentro: "Dentro do limite", atencao: "Perto do limite", estourado: "Passou do limite" },
      });
    }

    if (caminho.endsWith("/orcamento/limite") && metodo === "PUT") {
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { centavos?: string };
      viagem.limiteColetivoCentavos = corpo.centavos ?? null;
      return json({ limite: { id: "l1", centavos: corpo.centavos ?? "0", atualizadoEm: new Date().toISOString(), versao: 1 } });
    }

    if (caminho.endsWith("/checklist") && metodo === "GET") {
      return json({
        itens: viagem.checklist ?? [],
        categorias: [
          { categoria: "documento", rotulo: "Documento" },
          { categoria: "reserva", rotulo: "Reserva" },
          { categoria: "compras", rotulo: "Compras" },
          { categoria: "saude", rotulo: "Saúde" },
          { categoria: "outro", rotulo: "Outro" },
        ],
        permissoes: { criar: true, concluir: true },
      });
    }

    if (caminho.endsWith("/checklist") && metodo === "POST") {
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { titulo?: string; categoria?: string; prazo?: string | null; responsavelId?: string | null };
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
        versao: 1,
      };
      viagem.checklist = [...(viagem.checklist ?? []), novo];
      return json({ item: novo }, 201);
    }

    if (caminho.includes("/checklist/") && caminho.endsWith("/concluir")) {
      const id = caminho.split("/").at(-2);
      const item = (viagem.checklist ?? []).find((candidato) => candidato["id"] === id);
      if (!item) return json({ erro: "nao_encontrado", mensagem: "Item não encontrado." }, 404);
      item["estado"] = "feito";
      item["feitoPor"] = usuarioId;
      item["feitoEm"] = new Date().toISOString();
      item["versao"] = Number(item["versao"] ?? 1) + 1;
      return json({ item });
    }

    if (caminho.includes("/checklist/") && caminho.endsWith("/reabrir")) {
      const id = caminho.split("/").at(-2);
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { motivo?: string };
      const item = (viagem.checklist ?? []).find((candidato) => candidato["id"] === id);
      if (!item) return json({ erro: "nao_encontrado", mensagem: "Item não encontrado." }, 404);
      item["estado"] = "aberto";
      item["feitoPor"] = null;
      item["feitoEm"] = null;
      item["motivoReabertura"] = corpo.motivo ?? null;
      item["versao"] = Number(item["versao"] ?? 1) + 1;
      return json({ item });
    }

    if (caminho.endsWith("/documentos") && metodo === "GET") {
      return json({
        documentos: viagem.documentos ?? [],
        tipos: [{ tipo: "passagem", rotulo: "Passagem" }, { tipo: "seguro", rotulo: "Seguro" }, { tipo: "outro", rotulo: "Outro" }],
        avisoDePrivacidade:
          "Documento começa privado: só quem criou vê. Compartilhar é um passo separado e pode ser revogado. O Lia Go guarda o link e a descrição — o arquivo continua onde você o colocou.",
      });
    }

    if (caminho.endsWith("/documentos") && metodo === "POST") {
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { tipo?: string; nome?: string; descricao?: string | null; link?: string | null };
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
        versao: 1,
      };
      viagem.documentos = [...(viagem.documentos ?? []), novo];
      return json({ documento: novo }, 201);
    }

    if (caminho.includes("/documentos/") && caminho.endsWith("/impacto")) {
      const acao = url.searchParams.get("acao") ?? "compartilhar";
      return json({
        impacto: {
          itens: acao === "remover"
            ? [
                "O documento sai da lista de todo mundo e o acesso é revogado.",
                "Nada é apagado em definitivo: o registro e o motivo continuam guardados.",
              ]
            : [
                "Todas as 2 pessoas com acesso ativo passam a ver este documento.",
                "O documento guarda o link e a descrição; o arquivo continua onde você o colocou (o Lia Go não copia o arquivo).",
              ],
          atencao: acao === "remover" ? [] : ["Documento de identidade: compartilhe só com quem precisa."],
        },
      });
    }

    if (caminho.includes("/documentos/") && (caminho.endsWith("/compartilhar") || caminho.endsWith("/revogar"))) {
      const id = caminho.split("/").at(-2);
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { com?: string | string[] };
      const documento = (viagem.documentos ?? []).find((candidato) => candidato["id"] === id);
      if (!documento) return json({ erro: "nao_encontrado", mensagem: "Documento não encontrado." }, 404);
      if (caminho.endsWith("/compartilhar") && corpo.com === "viagem") {
        documento["visibilidade"] = "viagem";
        documento["compartilhadoCom"] = [];
      } else if (caminho.endsWith("/revogar")) {
        documento["visibilidade"] = "privado";
        documento["compartilhadoCom"] = [];
      } else {
        documento["compartilhadoCom"] = Array.isArray(corpo.com) ? corpo.com : [];
      }
      documento["versao"] = Number(documento["versao"] ?? 1) + 1;
      return json({ documento });
    }

    if (caminho.includes("/documentos/") && caminho.endsWith("/remover")) {
      const id = caminho.split("/").at(-2);
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { motivo?: string };
      const documento = (viagem.documentos ?? []).find((candidato) => candidato["id"] === id);
      if (!documento) return json({ erro: "nao_encontrado", mensagem: "Documento não encontrado." }, 404);
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
        viagem: { id: viagem.id, nome: viagem.nome, destino: viagem.destino, moeda: "BRL", estado: viagem.estado },
        geradoEm: new Date().toISOString(),
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
          partes: [
            { participanteId: usuarioId, nome: "Ana", valorCentavos: conta.toString() },
            { participanteId: "u2", nome: "Bruno", valorCentavos: conta.toString() },
          ],
        })),
        totalConfirmadoCentavos: total.toString(),
        totalAguardandoCentavos: "0",
        despesasAbertas: 0,
        saldos: [
          { participanteId: usuarioId, nome: "Ana", pagoCentavos: total.toString(), parteCentavos: conta.toString(), saldoCentavos: (total - conta).toString() },
          { participanteId: "u2", nome: "Bruno", pagoCentavos: "0", parteCentavos: conta.toString(), saldoCentavos: (-conta).toString() },
        ],
        acertosSugeridos: [{ deId: "u2", deNome: "Bruno", paraId: usuarioId, paraNome: "Ana", valorCentavos: conta.toString() }],
        previstoCentavos: "0",
        previstoRoteiroCentavos: "0",
        previstoReservasCentavos: "0",
        limiteCentavos: null,
        alertas: [],
        texto: `Lia Go — fechamento de ${viagem.nome}\nConfirmado: R$ ${total.toString()}\nAcertos sugeridos (sugestão — ninguém pagou nada até alguém registrar).\n`,
        csv: '"viagem";"data";"descricao";"valor"\n' + confirmadas.map((despesa) => `"${viagem.nome}";"${despesa["data"]}";"${despesa["descricao"]}";"${despesa["valorCentavos"]}"`).join("\n"),
      });
    }

    if (caminho.endsWith("/atividades") && metodo === "POST") {
      // A atividade criada fica na viagem: é o que o `/mudancas` devolve em seguida (o mesmo caminho
      // do servidor de verdade) — sem guardar aqui, o teste não veria nada na tela depois de criar.
      const corpo = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      const atividade = {
        id: `a${(viagem.atividades ?? []).length + 1}`,
        viagemId: viagem.id,
        autorId: usuarioId,
        dia: typeof corpo.dia === "string" ? corpo.dia : "2026-12-20",
        ordem: (viagem.atividades ?? []).length + 1,
        titulo: typeof corpo.titulo === "string" ? corpo.titulo : "Sem título",
        hora: (corpo.hora as string | null) ?? null,
        duracaoMinutos: (corpo.duracaoMinutos as number | null) ?? null,
        local: (corpo.local as string | null) ?? null,
        custo: {
          centavos: (corpo.custoCentavos as string | null) ?? null,
          natureza: (corpo.custoNatureza as string | null) ?? null,
          aVerificar: corpo.custoAVerificar === true,
        },
        estado: "planejada",
        concluidaPor: null,
        concluidaEm: null,
        observacao: (corpo.observacao as string | null) ?? null,
        reservaId: (corpo.reservaId as string | null) ?? null,
        deslocamento: corpo.deslocamento ?? null,
        versao: 1,
      };
      viagem.atividades = [...(viagem.atividades ?? []), atividade];
      viagem.versao += 1;
      return json({ dia: atividade.dia, atividades: [atividade], resumo: {}, conflitos: [] }, 201);
    }

    if (caminho.includes("/atividades/") && caminho.endsWith("/corrigir")) {
      const id = caminho.split("/").at(-2);
      const corpo = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      const atividade = (viagem.atividades ?? []).find((item) => item["id"] === id);
      if (!atividade) return json({ erro: "nao_encontrada", mensagem: "Atividade não encontrada." }, 404);
      if (typeof corpo.titulo === "string" && corpo.titulo.trim() !== "") atividade["titulo"] = corpo.titulo;
      if (corpo.hora !== undefined && corpo.hora !== null) atividade["hora"] = corpo.hora;
      if (typeof corpo.duracaoMinutos === "number") atividade["duracaoMinutos"] = corpo.duracaoMinutos;
      if (typeof corpo.local === "string" && corpo.local.trim() !== "") atividade["local"] = corpo.local;
      if (corpo.observacao !== undefined) atividade["observacao"] = corpo.observacao;
      if (corpo.reservaId !== undefined) atividade["reservaId"] = corpo.reservaId;
      if (corpo.custoCentavos !== undefined) {
        atividade["custo"] = {
          centavos: corpo.custoCentavos,
          natureza: (corpo.custoNatureza as string | null) ?? null,
          aVerificar: false,
        };
      }
      atividade["versao"] = Number(atividade["versao"] ?? 1) + 1;
      viagem.versao += 1;
      return json({ dia: atividade["dia"], atividades: [atividade], resumo: {}, conflitos: [] });
    }

    return json({ erro: "nao_implementado", mensagem: `A rota ${metodo} ${caminho} não existe no servidor falso.` }, 404);
  }) as typeof fetch;

  return estado;
}
