/**
 * Convites — regras confirmadas:
 * - convidado precisa autenticar antes de acessar a viagem;
 * - convite pode ser cancelado pelo organizador;
 * - aceitar convite é ação explícita da pessoa convidada;
 * - convidado não vira organizador e o convite não dá acesso a outra viagem.
 */
import { type Papel, type EstadoMembro } from "./permissions.ts";
import { ErroDeDominio } from "./erros.ts";

export type EstadoConvite = "pendente" | "aceito" | "recusado" | "cancelado" | "expirado";

export interface Convite {
  id: string;
  viagemId: string;
  emailConvidado: string;
  papel: Papel;
  estado: EstadoConvite;
  criadoPorId: string;
  criadoEm: string;
  expiraEm: string | null;
}

export interface ResultadoConvite {
  convite: Convite;
  estadoMembro: EstadoMembro;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function criarConvite(entrada: {
  id: string;
  viagemId: string;
  emailConvidado: string;
  criadoPorId: string;
  papel?: Papel;
  agoraIso?: string;
  validadeDias?: number;
}): Convite {
  const email = normalizarEmail(entrada.emailConvidado);
  if (!EMAIL.test(email)) throw new ErroDeDominio("Informe um e-mail válido para o convite.");
  const agora = entrada.agoraIso ?? new Date().toISOString();
  const validadeDias = entrada.validadeDias ?? 14;
  const expira = new Date(new Date(agora).getTime() + validadeDias * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: entrada.id,
    viagemId: entrada.viagemId,
    emailConvidado: email,
    papel: entrada.papel ?? "participante",
    estado: "pendente",
    criadoPorId: entrada.criadoPorId,
    criadoEm: agora,
    expiraEm: expira,
  };
}

export function conviteExpirado(convite: Convite, agoraIso: string): boolean {
  if (!convite.expiraEm) return false;
  return new Date(convite.expiraEm).getTime() <= new Date(agoraIso).getTime();
}

export function estadoEfetivo(convite: Convite, agoraIso: string): EstadoConvite {
  if (convite.estado === "pendente" && conviteExpirado(convite, agoraIso)) return "expirado";
  return convite.estado;
}

export function cancelarConvite(
  convite: Convite,
  autor: { usuarioId: string; papel: Papel },
  agoraIso?: string,
): Convite {
  if (autor.papel !== "organizador") throw new ErroDeDominio("Somente o organizador pode cancelar convites.");
  const estado = estadoEfetivo(convite, agoraIso ?? new Date().toISOString());
  if (estado !== "pendente") {
    throw new ErroDeDominio(`Convite ${estado} não pode ser cancelado.`);
  }
  return { ...convite, estado: "cancelado" };
}

/**
 * Aceite do convite. O e-mail autenticado precisa ser o mesmo do convite:
 * evita que um link vazado dê acesso a outra pessoa.
 */
export function aceitarConvite(
  convite: Convite,
  pessoa: { usuarioId: string; emailAutenticado: string },
  agoraIso?: string,
): ResultadoConvite {
  const agora = agoraIso ?? new Date().toISOString();
  const estado = estadoEfetivo(convite, agora);
  if (estado === "expirado") throw new ErroDeDominio("Este convite expirou; peça um novo ao organizador.");
  if (estado === "cancelado") throw new ErroDeDominio("Este convite foi cancelado pelo organizador.");
  if (estado !== "pendente") throw new ErroDeDominio(`Convite já está ${estado}.`);
  if (normalizarEmail(pessoa.emailAutenticado) !== convite.emailConvidado) {
    throw new ErroDeDominio("Este convite é para outro e-mail. Entre com a conta convidada.");
  }
  return { convite: { ...convite, estado: "aceito" }, estadoMembro: "ativo" };
}

/**
 * Situação da pessoa na viagem depois de sair ou ser removida:
 * perde acesso e não cria novos lançamentos, mas o histórico e as pendências ficam.
 */
export function consequenciasDeSaida(): string[] {
  return [
    "Acesso à viagem é encerrado e novos lançamentos ficam bloqueados.",
    "Despesas, partes de rateio e pendências continuam registradas e visíveis para quem tem acesso.",
    "Novos gastos não incluem automaticamente quem saiu; compromissos futuros exigem revisão.",
  ];
}
