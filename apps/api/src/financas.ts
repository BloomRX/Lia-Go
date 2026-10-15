/**
 * Resumo financeiro da viagem, em um lugar só.
 *
 * Existia dentro da rota de saldos; o orçamento e o fechamento precisam exatamente do mesmo número
 * (o oficial é o das despesas **confirmadas**), então a conta ficou aqui — uma fonte, três telas.
 */
import type pg from "pg";
import { calcularResumoFinanceiro, type Despesa, type Movimento, type ResumoFinanceiro } from "@lia-go/domain";
import { carregarDespesa } from "./repo.ts";

export interface FinanceiroDaViagem {
  despesas: Despesa[];
  movimentos: Movimento[];
  resumo: ResumoFinanceiro;
  nomePorId: Map<string, string>;
}

function movimentoParaDominio(linha: {
  id: string;
  viagem_id: string;
  de_id: string;
  para_id: string;
  valor_centavos: string;
  estado: Movimento["estado"];
  despesa_id: string | null;
}): Movimento {
  return {
    id: linha.id,
    viagemId: linha.viagem_id,
    deId: linha.de_id,
    paraId: linha.para_id,
    valorCentavos: BigInt(linha.valor_centavos),
    estado: linha.estado,
    despesaId: linha.despesa_id,
  };
}

export async function carregarFinanceiroDaViagem(
  executor: pg.Pool | pg.PoolClient,
  viagemId: string,
): Promise<FinanceiroDaViagem> {
  const { rows: ids } = await executor.query<{ id: string }>("SELECT id FROM despesas WHERE viagem_id = $1", [viagemId]);
  const despesas: Despesa[] = [];
  for (const linha of ids) {
    const carregada = await carregarDespesa(executor, viagemId, linha.id);
    if (carregada) despesas.push(carregada.despesa);
  }

  const { rows: movimentosRows } = await executor.query<{
    id: string;
    viagem_id: string;
    de_id: string;
    para_id: string;
    valor_centavos: string;
    estado: Movimento["estado"];
    despesa_id: string | null;
  }>(
    `SELECT id, viagem_id, de_id, para_id, valor_centavos::text AS valor_centavos, estado, despesa_id
       FROM movimentos WHERE viagem_id = $1 ORDER BY criado_em`,
    [viagemId],
  );
  const movimentos = movimentosRows.map(movimentoParaDominio);

  const { rows: nomes } = await executor.query<{ usuario_id: string; nome: string }>(
    "SELECT usuario_id, nome FROM membros_viagem m JOIN usuarios u ON u.id = m.usuario_id WHERE m.viagem_id = $1",
    [viagemId],
  );

  return {
    despesas,
    movimentos,
    resumo: calcularResumoFinanceiro(despesas, movimentos),
    nomePorId: new Map(nomes.map((linha) => [linha.usuario_id, linha.nome])),
  };
}

export { movimentoParaDominio };
