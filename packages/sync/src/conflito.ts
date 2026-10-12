/**
 * Conflitos entre a alteração feita no aparelho e o que está no servidor.
 *
 * Prática de mercado adotada aqui (ver docs/DECISIONS_AND_OPEN_QUESTIONS.md):
 *  - campo que só um dos lados mudou: mescla sem incomodar ninguém;
 *  - campos diferentes alterados: mescla (não são a mesma decisão);
 *  - mesmo campo alterado nos dois lados: **decisão humana**, mostrando "sua versão" e
 *    "versão do servidor" em linguagem simples;
 *  - **dinheiro nunca é mesclado automaticamente**, nem quando o valor é "parecido":
 *    valor, moeda e rateio sempre exigem confirmação explícita da pessoa.
 */

/** Campos que nunca podem ser resolvidos sozinhos: mexem em dinheiro ou em quem paga/recebe. */
export const CAMPOS_SENSIVEIS = [
  "valorCentavos",
  "moeda",
  "rateio",
  "participantes",
  "pagadorId",
  "deId",
  "paraId",
] as const;

export interface ResultadoConflito {
  tipo: "sem_conflito" | "mesclavel" | "decisao_humana";
  /** Campos em que os dois lados discordam. */
  camposEmConflito: string[];
  /** Campos mescláveis (cada lado mudou um campo diferente). */
  camposMesclados: string[];
  /** Resultado da mescla, quando `mesclavel`. */
  mesclado?: Record<string, unknown>;
  /** True quando o desacordo envolve dinheiro: exige decisão explícita, sem exceção. */
  envolveDinheiro: boolean;
}

export function ehCampoSensivel(campo: string): boolean {
  return (CAMPOS_SENSIVEIS as readonly string[]).includes(campo);
}

/**
 * Compara a alteração local com o estado atual do servidor.
 * `alteradosLocal` são os campos que a pessoa mudou no aparelho.
 */
export function classificarConflito(
  local: Record<string, unknown>,
  remoto: Record<string, unknown>,
  alteradosLocal: string[],
): ResultadoConflito {
  const camposEmConflito: string[] = [];
  const camposMesclados: string[] = [];
  const mesclado: Record<string, unknown> = { ...remoto };

  for (const campo of alteradosLocal) {
    const valorLocal = local[campo];
    const valorRemoto = remoto[campo];
    if (iguais(valorLocal, valorRemoto)) {
      mesclado[campo] = valorLocal;
      camposMesclados.push(campo);
      continue;
    }
    camposEmConflito.push(campo);
    mesclado[campo] = valorLocal;
  }

  const envolveDinheiro = camposEmConflito.some(ehCampoSensivel);
  if (camposEmConflito.length === 0) {
    return { tipo: "sem_conflito", camposEmConflito, camposMesclados, mesclado, envolveDinheiro: false };
  }
  if (envolveDinheiro) {
    return { tipo: "decisao_humana", camposEmConflito, camposMesclados, mesclado, envolveDinheiro: true };
  }
  // Sem dinheiro envolvido e sem campos repetidos: nada impede seguir com a versão do aparelho.
  return { tipo: "mesclavel", camposEmConflito, camposMesclados, mesclado, envolveDinheiro: false };
}

/** Rótulos em português para a tela de conflito (nada de nome de campo técnico para a pessoa). */
const ROTULOS: Record<string, string> = {
  nome: "Nome",
  destino: "Destino",
  dataInicio: "Data de início",
  dataFim: "Data de volta",
  descricao: "Descrição",
  valorCentavos: "Valor",
  data: "Data",
  tipo: "Tipo",
  pagadorId: "Quem pagou",
  participantes: "Quem participa",
  rateio: "Como dividir",
  estado: "Situação",
  motivo: "Motivo",
  moeda: "Moeda",
};

export function rotuloDoCampo(campo: string): string {
  return ROTULOS[campo] ?? campo;
}

export interface ComparacaoDeCampo {
  campo: string;
  rotulo: string;
  valorLocal: unknown;
  valorRemoto: unknown;
  sensivel: boolean;
}

/** Monta o que a tela de conflito mostra, sem termos técnicos. */
export function compararParaDecisao(
  local: Record<string, unknown>,
  remoto: Record<string, unknown>,
  campos: string[],
): ComparacaoDeCampo[] {
  return campos.map((campo) => ({
    campo,
    rotulo: rotuloDoCampo(campo),
    valorLocal: local[campo],
    valorRemoto: remoto[campo],
    sensivel: ehCampoSensivel(campo),
  }));
}

function iguais(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, indice) => iguais(item, b[indice]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const chavesA = Object.keys(a as object).sort();
    const chavesB = Object.keys(b as object).sort();
    if (chavesA.length !== chavesB.length || chavesA.some((chave, i) => chave !== chavesB[i])) return false;
    return chavesA.every((chave) =>
      iguais((a as Record<string, unknown>)[chave], (b as Record<string, unknown>)[chave]),
    );
  }
  return false;
}
