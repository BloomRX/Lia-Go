/**
 * Cartão de atividade do roteiro — padrão "equilibrado" (diretriz §2.2).
 *
 * Mostra direto: horário (quando definido), título, estado, custo essencial e o contexto que
 * ajuda a entender o compromisso. O resto fica na tela de detalhes (§2.1).
 *
 * Regras que o componente **não** deixa escapar:
 *  - horário flexível não ganha horário inventado (§2.7);
 *  - custo desconhecido não aparece como R$ 0,00 (§2.4);
 *  - estado nunca é só cor: sempre tem texto (§2.3);
 *  - atividade concluída fica discreta, com etiqueta, e pode ser recolhida sem apagar nada (§2.8).
 */
import { descreverCusto, descreverDeslocamento, formatarDuracao, ROTULO_ATIVIDADE } from "../services/formato.ts";
import type { AtividadeApi, ConflitoApi } from "../services/api.ts";

interface Props {
  atividade: AtividadeApi;
  /** Conflitos que envolvem esta atividade (vêm do domínio, no servidor ou no aparelho). */
  conflitos: ConflitoApi[];
  /** O deslocamento até esta atividade é mostrado **antes** dela, na linha do tempo. */
  deslocamentoDoTrecho?: AtividadeApi["deslocamento"];
  aoAbrir: (atividadeId: string) => void;
}

/** Marcador da linha do tempo + trecho de deslocamento + cartão. */
export function CartaoAtividade({ atividade, conflitos, deslocamentoDoTrecho, aoAbrir }: Props): React.ReactElement {
  const custo = descreverCusto({
    centavos: atividade.custo.centavos === null ? null : BigInt(atividade.custo.centavos),
    rotulo: atividade.custo.centavos === null ? (atividade.custo.aVerificar ? "Custo a verificar" : null) : null,
    natureza: atividade.custo.natureza,
  });
  const duracao = formatarDuracao(atividade.duracaoMinutos);
  const temConflito = conflitos.length > 0;
  const concluida = atividade.estado === "concluida";
  const cancelada = atividade.estado === "cancelada";

  return (
    <li className={`atividade${temConflito ? " com-conflito" : ""}${concluida ? " concluida" : ""}${cancelada ? " cancelada" : ""}`}>
      <span className="marcador" aria-hidden="true" />
      <div className="atividade-corpo">
        {deslocamentoDoTrecho && (deslocamentoDoTrecho.minutos || deslocamentoDoTrecho.km || deslocamentoDoTrecho.alerta) ? (
          <TrechoDeslocamento deslocamento={deslocamentoDoTrecho} />
        ) : null}

        <button className="cartao cartao-atividade" onClick={() => aoAbrir(atividade.id)} type="button">
          <div className="atividade-topo">
            <span className="atividade-hora">
              {atividade.hora ? atividade.hora : "Horário flexível"}
            </span>
            <span className={`etiqueta estado-${atividade.estado}`}>{ROTULO_ATIVIDADE[atividade.estado] ?? atividade.estado}</span>
          </div>

          <h3 className="atividade-titulo">{atividade.titulo}</h3>

          <div className="atividade-contexto">
            {atividade.local ? <span>{atividade.local}</span> : null}
            {duracao ? <span>{duracao}</span> : null}
            {custo.rotulo === "Custo a verificar" ? <span className="custo-a-verificar">{custo.rotulo}</span> : null}
            {custo.valor ? (
              <span className="custo">
                {custo.rotulo ? `${custo.rotulo}: ` : ""}
                {custo.valor}
              </span>
            ) : null}
          </div>

          {temConflito ? (
            <div className="alerta-conflito" role="status">
              {conflitos.map((conflito) => (
                <p key={conflito.explicacao}>
                  <strong>{conflito.tipo === "sobreposicao" ? "Conflito de horário: " : "Deslocamento apertado: "}</strong>
                  {conflito.explicacao}
                </p>
              ))}
            </div>
          ) : null}
        </button>
      </div>
    </li>
  );
}

/**
 * Trecho entre atividades: compacto por padrão; abre quando o trecho é longo, tem custo ou risco
 * (§2.6). Compacto nunca é oculto: o alerta aparece mesmo na forma curta.
 */
function TrechoDeslocamento({ deslocamento }: { deslocamento: NonNullable<AtividadeApi["deslocamento"]> }): React.ReactElement {
  const detalhado = Boolean(deslocamento.alerta) || (deslocamento.minutos ?? 0) >= 30 || Boolean(deslocamento.custoCentavos);
  const resumo = descreverDeslocamento(deslocamento);
  return (
    <div className={`trecho${detalhado ? " aberto" : ""}`}>
      <span className="trecho-seta" aria-hidden="true">
        ↓
      </span>
      <span className="trecho-texto">{resumo ? `Deslocamento: ${resumo}` : "Deslocamento"}</span>
      {deslocamento.alerta ? <span className="trecho-alerta">{deslocamento.alerta}</span> : null}
    </div>
  );
}
