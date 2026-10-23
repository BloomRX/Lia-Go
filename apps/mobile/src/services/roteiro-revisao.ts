/**
 * Revisão de mudanças do roteiro (tela 8) e vínculo de documento na atividade (tela 7).
 *
 * Regras que este módulo garante:
 *  - **Privacidade `404` nos documentos vinculados**: um documento privado nunca vaza sua existência
 *    para quem não tem acesso. O vínculo só resolve contra `documentosVisiveis` (já filtrados pelo
 *    servidor para o usuário atual) e apenas quando `estado === "ativo"`. Se o acesso for revogado
 *    ou a outra pessoa não tiver permissão, o vínculo retorna `null` em silêncio.
 *  - **Revisão antes de substituir o roteiro vigente (tela 8)**: antes de aplicar um novo plano para
 *    o dia, calcula diferenças (o que sai e o que entra), conflitos de horário (`conflitosDoDia`) e
 *    impacto no orçamento previsto (`resumirOrcamentoDoRoteiro`), avisando sobre compromissos e
 *    reservas vinculadas.
 */
import {
  conflitosDoDia,
  resumirOrcamentoDoRoteiro,
  type Atividade,
  type Documento,
  type NaturezaCusto,
} from "@lia-go/domain";
import { formatarBRL, paraCentavos } from "./formato.ts";

export type ConflitoDeHorario = ReturnType<typeof conflitosDoDia>[number];

const CHAVE_VINCULOS_DOCUMENTO = "lia.vinculos.atividade-documento.v1";
let memoriaVinculos: Record<string, string> = {};

function lerMapaDeVinculos(): Record<string, string> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const bruto = window.localStorage.getItem(CHAVE_VINCULOS_DOCUMENTO);
      if (bruto) {
        const lido = JSON.parse(bruto) as Record<string, string>;
        if (lido && typeof lido === "object") {
          memoriaVinculos = { ...lido };
        }
      }
    }
  } catch {
    // Segue com o mapa em memória.
  }
  return memoriaVinculos;
}

function salvarMapaDeVinculos(mapa: Record<string, string>): void {
  memoriaVinculos = { ...mapa };
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(CHAVE_VINCULOS_DOCUMENTO, JSON.stringify(memoriaVinculos));
    }
  } catch {
    // Ignora bloqueio de storage.
  }
}

export function vincularDocumentoNaAtividade(
  viagemId: string,
  atividadeId: string,
  documentoId: string | null,
): void {
  const chave = `${viagemId}:${atividadeId}`;
  const atual = { ...lerMapaDeVinculos() };
  if (!documentoId) {
    delete atual[chave];
  } else {
    atual[chave] = documentoId;
  }
  salvarMapaDeVinculos(atual);
}

/**
 * Devolve o documento vinculado à atividade **somente** se ele estiver entre os documentos visíveis
 * para a pessoa logada e ativo. Assim, quem não tem acesso (ou perdeu acesso após revogação) não
 * descobre nem que havia um documento privado ali.
 */
export function documentoVinculadoDaAtividade(
  viagemId: string,
  atividadeId: string,
  documentosVisiveis: readonly Documento[],
): Documento | null {
  const chave = `${viagemId}:${atividadeId}`;
  const docId = lerMapaDeVinculos()[chave];
  if (!docId) return null;
  return documentosVisiveis.find((doc) => doc.id === docId && doc.estado === "ativo") ?? null;
}

export interface PropostaAtividadeDia {
  titulo: string;
  hora: string | null;
  duracaoMinutos: number | null;
  custoCentavos: bigint | null;
  custoNatureza: NaturezaCusto | null;
}

/**
 * Analisa linhas no formato:
 *   `HH:MM | Título | Duração min | Valor R$`
 * ou `Flexível | Título` (campos após o título são opcionais).
 */
export function analisarPropostaDeDia(texto: string): PropostaAtividadeDia[] {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (linhas.length === 0) {
    throw new Error("Informe pelo menos uma atividade para revisar a substituição do dia.");
  }

  return linhas.map((linha, indice) => {
    const partes = linha.split("|").map((p) => p.trim());
    let hora: string | null = null;
    let titulo = "";
    let duracaoTexto = "";
    let valorTexto = "";

    if (partes.length === 1) {
      titulo = partes[0] ?? "";
    } else {
      const primeira = partes[0] ?? "";
      if (/^\d{2}:\d{2}$/.test(primeira)) {
        hora = primeira;
        titulo = partes[1] ?? "";
        duracaoTexto = partes[2] ?? "";
        valorTexto = partes[3] ?? "";
      } else if (/^flex[ií]vel$/i.test(primeira) || primeira === "-") {
        hora = null;
        titulo = partes[1] ?? "";
        duracaoTexto = partes[2] ?? "";
        valorTexto = partes[3] ?? "";
      } else {
        titulo = primeira;
        duracaoTexto = partes[1] ?? "";
        valorTexto = partes[2] ?? "";
      }
    }

    if (titulo.trim().length < 2) {
      throw new Error(`Linha ${indice + 1}: informe um título com pelo menos 2 caracteres.`);
    }

    const duracaoLimpa = duracaoTexto.replace(/\s*min(utos?)?$/i, "").trim();
    const duracaoMinutos = duracaoLimpa ? Number(duracaoLimpa) : null;
    if (duracaoMinutos !== null && (!Number.isInteger(duracaoMinutos) || duracaoMinutos <= 0)) {
      throw new Error(`Linha ${indice + 1}: duração inválida ("${duracaoTexto}"). Use minutos inteiros > 0.`);
    }

    const valorLimpo = valorTexto.replace(/^R\$\s*/i, "").trim();
    let custoCentavos: bigint | null = null;
    let custoNatureza: NaturezaCusto | null = null;
    if (valorLimpo) {
      if (/^(0([,.]00)?|gratuito|sem custo)$/i.test(valorLimpo)) {
        custoCentavos = 0n;
        custoNatureza = "gratuito";
      } else {
        custoCentavos = BigInt(paraCentavos(valorLimpo));
        custoNatureza = "estimativa";
      }
    }

    return {
      titulo: titulo.trim(),
      hora,
      duracaoMinutos,
      custoCentavos,
      custoNatureza,
    };
  });
}

export interface RevisaoSubstituicaoDia {
  dia: string;
  aCancelar: Atividade[];
  preservadasConcluidas: Atividade[];
  propostas: Atividade[];
  conflitosPropostos: ConflitoDeHorario[];
  previstoAntesCentavos: bigint;
  previstoDepoisCentavos: bigint;
  diferencaPrevistoCentavos: bigint;
  resumoDiferencaOrcamento: string;
  avisos: string[];
}

export function revisarSubstituicaoDoDia(entrada: {
  viagemId: string;
  usuarioId: string;
  dia: string;
  atuaisDoDia: readonly Atividade[];
  propostas: readonly PropostaAtividadeDia[];
}): RevisaoSubstituicaoDia {
  const aCancelar = entrada.atuaisDoDia.filter((a) => a.estado === "planejada");
  const preservadasConcluidas = entrada.atuaisDoDia.filter((a) => a.estado === "concluida");

  const propostas: Atividade[] = entrada.propostas.map((p, idx) => ({
    id: `proposta-${idx + 1}`,
    viagemId: entrada.viagemId,
    autorId: entrada.usuarioId,
    dia: entrada.dia,
    ordem: preservadasConcluidas.length + idx + 1,
    titulo: p.titulo,
    hora: p.hora,
    duracaoMinutos: p.duracaoMinutos,
    local: null,
    custoCentavos: p.custoCentavos,
    custoNatureza: p.custoNatureza,
    custoAVerificar: false,
    estado: "planejada",
    concluidaPor: null,
    concluidaEm: null,
    observacao: null,
    reservaId: null,
    deslocamento: null,
    versao: 1,
  }));

  const antes = resumirOrcamentoDoRoteiro(entrada.atuaisDoDia);
  const depois = resumirOrcamentoDoRoteiro([...preservadasConcluidas, ...propostas]);
  const diferenca = depois.previstoCentavos - antes.previstoCentavos;

  let resumoDiferencaOrcamento = `Previsto do dia mantém ${formatarBRL(depois.previstoCentavos)}.`;
  if (diferenca > 0n) {
    resumoDiferencaOrcamento = `Aumenta o previsto do dia em ${formatarBRL(diferenca)} (de ${formatarBRL(antes.previstoCentavos)} para ${formatarBRL(depois.previstoCentavos)}).`;
  } else if (diferenca < 0n) {
    resumoDiferencaOrcamento = `Reduz o previsto do dia em ${formatarBRL(-diferenca)} (de ${formatarBRL(antes.previstoCentavos)} para ${formatarBRL(depois.previstoCentavos)}).`;
  }

  const conflitosPropostos = conflitosDoDia([...preservadasConcluidas, ...propostas]);

  const avisos: string[] = [];
  if (preservadasConcluidas.length > 0) {
    avisos.push(
      `${preservadasConcluidas.length} atividade(s) já concluída(s) neste dia não serão apagadas nem canceladas (histórico preservado).`,
    );
  }
  const comReserva = aCancelar.filter((a) => a.reservaId !== null);
  if (comReserva.length > 0) {
    avisos.push(
      `${comReserva.length} atividade(s) substituída(s) têm reserva vinculada: substituir o roteiro não cancela a reserva fora do app.`,
    );
  }
  const comCompromisso = aCancelar.filter((a) => a.custoNatureza === "compromisso");
  if (comCompromisso.length > 0) {
    avisos.push(
      `${comCompromisso.length} atividade(s) substituída(s) tinham valor marcado como compromisso já combinado.`,
    );
  }
  if (conflitosPropostos.length > 0) {
    avisos.push(
      `O novo plano contém ${conflitosPropostos.length} conflito(s) de horário — revise antes de confirmar ou ajuste os horários depois.`,
    );
  }

  return {
    dia: entrada.dia,
    aCancelar,
    preservadasConcluidas,
    propostas,
    conflitosPropostos,
    previstoAntesCentavos: antes.previstoCentavos,
    previstoDepoisCentavos: depois.previstoCentavos,
    diferencaPrevistoCentavos: diferenca,
    resumoDiferencaOrcamento,
    avisos,
  };
}
