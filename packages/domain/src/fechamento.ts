/**
 * Fechamento da viagem (tela 21): o retrato final das contas, para conferir e exportar.
 *
 * Regras de dinheiro que este arquivo garante (as mesmas do resto do domínio):
 *  - só despesa **confirmada** entra no total oficial; pendente e contestada aparecem **separadas**,
 *    com aviso — nunca somadas no número que todo mundo vai acertar;
 *  - acerto sugerido é **sugestão**, escrito com essa palavra: o app não registra pagamento sozinho;
 *  - o previsto do roteiro/reservas aparece como planejamento, fora do oficial;
 *  - CSV para planilha e com **guarda contra fórmula** (campo que começa com `=`, `+`, `-`, `@` recebe
 *    apóstrofo, senão uma descrição maliciosa vira fórmula na planilha de quem abrir).
 */
import { calcularResumoFinanceiro, sugerirTransferencias, type Movimento, type SaldoParticipante } from "./balances.ts";
import type { Despesa } from "./expense.ts";
import { formatarBRL, formatarValorSimples, type Centavos } from "./money.ts";
import { ROTULO_ESTADO_RESERVA, type Reserva } from "./reserva.ts";
import { resumirOrcamentoDoRoteiro, type Atividade } from "./roteiro.ts";

export interface ParticipanteDoFechamento {
  id: string;
  nome: string | null;
}

export interface EntradaDeFechamento {
  viagem: { id: string; nome: string; destino: string | null; moeda: string; estado: string };
  despesas: readonly Despesa[];
  movimentos?: readonly Movimento[];
  participantes: readonly ParticipanteDoFechamento[];
  atividades?: readonly Atividade[];
  reservas?: readonly Reserva[];
  limiteCentavos?: Centavos | null;
}

export interface LinhaDoFechamento {
  despesaId: string;
  data: string;
  descricao: string;
  tipo: string;
  estado: string;
  valorCentavos: Centavos;
  moeda: string;
  pagadorId: string;
  pagadorNome: string | null;
  /** Quanto cada pessoa deve por esta despesa (só faz sentido no oficial, mas fica visível sempre). */
  partes: { participanteId: string; nome: string | null; valorCentavos: Centavos }[];
}

export interface Fechamento {
  viagem: EntradaDeFechamento["viagem"];
  geradoEm: string;
  linhas: LinhaDoFechamento[];
  totalConfirmadoCentavos: Centavos;
  totalAguardandoCentavos: Centavos;
  /** Quantas despesas ainda dependem de confirmação/contestação resolvida. */
  despesasAbertas: number;
  saldos: { participanteId: string; nome: string | null; pagoCentavos: Centavos; parteCentavos: Centavos; saldoCentavos: Centavos }[];
  acertosSugeridos: { deId: string; deNome: string | null; paraId: string; paraNome: string | null; valorCentavos: Centavos }[];
  /** Planejamento (não entra nas contas oficiais): roteiro + reservas. */
  previstoCentavos: Centavos;
  previstoRoteiroCentavos: Centavos;
  previstoReservasCentavos: Centavos;
  limiteCentavos: Centavos | null;
  alertas: string[];
  texto: string;
  csv: string;
}

function nomeDe(participantes: readonly ParticipanteDoFechamento[], id: string): string | null {
  return participantes.find((pessoa) => pessoa.id === id)?.nome ?? null;
}

/** Campo de CSV que não pode virar fórmula na planilha de quem abrir. */
export function campoCsv(valor: string | null | undefined): string {
  const texto = (valor ?? "").replace(/\r?\n/g, " ").trim();
  const perigoso = /^[=+\-@\t\r]/.test(texto);
  const escapado = texto.replace(/"/g, '""');
  return `"${perigoso ? "'" : ""}${escapado}"`;
}

export function montarFechamento(entrada: EntradaDeFechamento, agora = new Date().toISOString()): Fechamento {
  const despesas = entrada.despesas;
  const movimentos = entrada.movimentos ?? [];
  const participantes = entrada.participantes;
  const resumo = calcularResumoFinanceiro(despesas, movimentos);

  const linhas: LinhaDoFechamento[] = [...despesas]
    .sort((a, b) => (a.data === b.data ? a.descricao.localeCompare(b.descricao, "pt-BR") : a.data.localeCompare(b.data)))
    .map((despesa) => ({
      despesaId: despesa.id,
      data: despesa.data,
      descricao: despesa.descricao,
      tipo: despesa.tipo,
      estado: despesa.estado,
      valorCentavos: despesa.valorCentavos,
      moeda: despesa.moeda,
      pagadorId: despesa.pagadorId,
      pagadorNome: nomeDe(participantes, despesa.pagadorId),
      partes: despesa.rateio.partes.map((parte) => ({
        participanteId: parte.participanteId,
        nome: nomeDe(participantes, parte.participanteId),
        valorCentavos: parte.valor,
      })),
    }));

  const orcamentoDoRoteiro = resumirOrcamentoDoRoteiro(entrada.atividades ?? []);
  const previstoReservas = (entrada.reservas ?? []).reduce((total, reserva) => {
    if (reserva.estado === "cancelada" || reserva.custoCentavos === null) return total;
    return total + reserva.custoCentavos;
  }, 0n);
  const previstoCentavos = orcamentoDoRoteiro.previstoCentavos + previstoReservas;

  // Acertos sugeridos com a função que o servidor usa (nada de reimplementar aqui): só traduzimos
  // os ids para nomes, porque é assim que a tela e o CSV mostram.
  const acertos = sugerirTransferencias(resumo.saldos).map((sugestao) => ({
    deId: sugestao.deId,
    deNome: nomeDe(participantes, sugestao.deId),
    paraId: sugestao.paraId,
    paraNome: nomeDe(participantes, sugestao.paraId),
    valorCentavos: sugestao.valorCentavos,
  }));

  const alertas: string[] = [];
  if (resumo.comprometido > 0n) {
    alertas.push(
      `Há ${formatarBRL(resumo.comprometido)} lançados que ainda não entram no total oficial (pendentes ou contestados). O fechamento não está completo enquanto isso não for resolvido.`,
    );
  }
  if (resumo.haDivergencia) {
    alertas.push("As despesas importadas em moeda estrangeira têm divergência de conversão: confira antes de dividir.");
  }
  if (entrada.limiteCentavos != null && resumo.realizado > entrada.limiteCentavos) {
    alertas.push(`O gasto confirmado passou do limite combinado em ${formatarBRL(resumo.realizado - entrada.limiteCentavos)}.`);
  }

  const texto = montarTexto({
    viagem: entrada.viagem,
    geradoEm: agora,
    resumo,
    participantes,
    acertos,
    previstoCentavos,
    previstoRoteiroCentavos: orcamentoDoRoteiro.previstoCentavos,
    previstoReservas,
    limiteCentavos: entrada.limiteCentavos ?? null,
    alertas,
    despesas,
  });

  return {
    viagem: entrada.viagem,
    geradoEm: agora,
    linhas,
    totalConfirmadoCentavos: resumo.realizado,
    totalAguardandoCentavos: resumo.comprometido,
    despesasAbertas: despesas.filter((despesa) => despesa.estado === "pendente" || despesa.estado === "contestada").length,
    saldos: resumo.saldos.map((saldo) => ({
      participanteId: saldo.participanteId,
      nome: nomeDe(participantes, saldo.participanteId),
      pagoCentavos: saldo.pago,
      parteCentavos: saldo.parteDevida,
      saldoCentavos: saldo.saldo,
    })),
    acertosSugeridos: acertos,
    previstoCentavos,
    previstoRoteiroCentavos: orcamentoDoRoteiro.previstoCentavos,
    previstoReservasCentavos: previstoReservas,
    limiteCentavos: entrada.limiteCentavos ?? null,
    alertas,
    texto,
    csv: montarCsv(entrada.viagem, linhas, resumo.saldos.map((saldo) => ({ nome: nomeDe(participantes, saldo.participanteId) ?? saldo.participanteId, pago: saldo.pago, parte: saldo.parteDevida, saldo: saldo.saldo })), acertos),
  };
}

function montarTexto(dados: {
  viagem: EntradaDeFechamento["viagem"];
  geradoEm: string;
  resumo: ReturnType<typeof calcularResumoFinanceiro>;
  participantes: readonly ParticipanteDoFechamento[];
  acertos: Fechamento["acertosSugeridos"];
  previstoCentavos: Centavos;
  previstoRoteiroCentavos: Centavos;
  previstoReservas: Centavos;
  limiteCentavos: Centavos | null;
  alertas: string[];
  despesas: readonly Despesa[];
}): string {
  const linhas: string[] = [];
  linhas.push(`Fechamento — ${dados.viagem.nome}${dados.viagem.destino ? ` (${dados.viagem.destino})` : ""}`);
  linhas.push(`Gerado em ${new Date(dados.geradoEm).toLocaleString("pt-BR")} · estado da viagem: ${dados.viagem.estado}`);
  linhas.push("");
  linhas.push("Contas oficiais (só despesas confirmadas)");
  linhas.push(`  Gasto confirmado: ${formatarBRL(dados.resumo.realizado)}`);
  linhas.push(`  Aguardando confirmação (fora do oficial): ${formatarBRL(dados.resumo.comprometido)}`);
  linhas.push(`  Limite combinado: ${dados.limiteCentavos === null ? "sem limite definido" : formatarBRL(dados.limiteCentavos)}`);
  linhas.push("");
  linhas.push("Saldos por pessoa");
  for (const saldo of dados.resumo.saldos) {
    const nome = dados.participantes.find((pessoa) => pessoa.id === saldo.participanteId)?.nome ?? saldo.participanteId;
    const situacao = saldo.saldo > 0n ? `recebe ${formatarBRL(saldo.saldo)}` : saldo.saldo < 0n ? `deve ${formatarBRL(-saldo.saldo)}` : "em dia";
    linhas.push(`  ${nome}: pagou ${formatarBRL(saldo.pago)} · parte ${formatarBRL(saldo.parteDevida)} · ${situacao}`);
  }
  linhas.push("");
  linhas.push("Acertos sugeridos (sugestão — ninguém pagou nada até alguém registrar)");
  if (dados.acertos.length === 0) {
    linhas.push("  Nada a acertar.");
  } else {
    for (const acerto of dados.acertos) {
      linhas.push(`  ${acerto.deNome ?? acerto.deId} → ${acerto.paraNome ?? acerto.paraId}: ${formatarBRL(acerto.valorCentavos)}`);
    }
  }
  linhas.push("");
  linhas.push("Planejamento (não entra nas contas oficiais)");
  linhas.push(`  Previsto no roteiro: ${formatarBRL(dados.previstoRoteiroCentavos)}`);
  linhas.push(`  Previsto em reservas: ${formatarBRL(dados.previstoReservas)}`);
  linhas.push(`  Previsto total: ${formatarBRL(dados.previstoCentavos)}`);
  if (dados.alertas.length > 0) {
    linhas.push("");
    linhas.push("Atenção");
    for (const alerta of dados.alertas) linhas.push(`  • ${alerta}`);
  }
  linhas.push("");
  linhas.push(`Despesas registradas: ${dados.despesas.length}`);
  return linhas.join("\n");
}

function montarCsv(
  viagem: EntradaDeFechamento["viagem"],
  linhas: readonly LinhaDoFechamento[],
  saldos: readonly { nome: string; pago: Centavos; parte: Centavos; saldo: Centavos }[],
  acertos: Fechamento["acertosSugeridos"],
): string {
  const cabecalho = ["viagem", "data", "descricao", "tipo", "estado", "valor", "moeda", "pagador", "participantes"];
  const registros = [cabecalho.map(campoCsv).join(";")];
  for (const linha of linhas) {
    const pessoas = linha.partes
      .map((parte) => `${parte.nome ?? parte.participanteId} (${formatarValorSimples(parte.valorCentavos)})`)
      .join(" | ");
    registros.push(
      [
        campoCsv(viagem.nome),
        campoCsv(linha.data),
        campoCsv(linha.descricao),
        campoCsv(linha.tipo),
        campoCsv(linha.estado),
        campoCsv(formatarValorSimples(linha.valorCentavos)),
        campoCsv(linha.moeda),
        campoCsv(linha.pagadorNome ?? linha.pagadorId),
        campoCsv(pessoas),
      ].join(";"),
    );
  }
  registros.push("");
  registros.push(["", "saldo por pessoa", "pagou", "parte", "situacao"].map(campoCsv).join(";"));
  for (const saldo of saldos) {
    const situacao = saldo.saldo > 0n ? `recebe ${formatarValorSimples(saldo.saldo)}` : saldo.saldo < 0n ? `deve ${formatarValorSimples(-saldo.saldo)}` : "em dia";
    registros.push(["", campoCsv(saldo.nome), campoCsv(formatarValorSimples(saldo.pago)), campoCsv(formatarValorSimples(saldo.parte)), campoCsv(situacao)].join(";"));
  }
  registros.push("");
  registros.push(["", "acertos sugeridos", "de", "para", "valor"].map(campoCsv).join(";"));
  if (acertos.length === 0) registros.push(["", campoCsv("nada a acertar")].join(";"));
  for (const acerto of acertos) {
    registros.push(["", campoCsv("transferencia sugerida"), campoCsv(acerto.deNome ?? acerto.deId), campoCsv(acerto.paraNome ?? acerto.paraId), campoCsv(formatarValorSimples(acerto.valorCentavos))].join(";"));
  }
  return registros.join("\n");
}
