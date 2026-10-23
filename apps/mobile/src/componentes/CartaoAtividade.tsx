/**
 * Cartão de atividade do roteiro — padrão "equilibrado" (diretriz §2.2).
 *
 * Mostra direto: horário (quando definido), título, estado, custo essencial e o contexto que
 * ajuda a entender o compromisso. O resto fica na tela de detalhes (§2.1).
 *
 * Regras que o componente **não** deixa escapar — todas implementadas em `services/roteiro-texto.ts`,
 * onde são testáveis sem navegador:
 *  - horário flexível não ganha horário inventado (§2.7);
 *  - custo desconhecido não aparece como R$ 0,00 (§2.4);
 *  - estado nunca é só cor: sempre tem texto (§2.3);
 *  - atividade concluída fica discreta, com etiqueta, e pode ser recolhida sem apagar nada (§2.8).
 */
import {
  avaliarTrecho,
  linhasDeContexto,
  textoDoHorario,
  tituloDoConflito,
} from "../services/roteiro-texto.ts";
import { ROTULO_ATIVIDADE } from "../services/formato.ts";
import type { AtividadeApi, ConflitoApi } from "../services/api.ts";

interface Props {
  atividade: AtividadeApi;
  /** Conflitos que envolvem esta atividade (vêm do domínio, no servidor ou no aparelho). */
  conflitos: ConflitoApi[];
  /** O deslocamento até esta atividade é mostrado **antes** dela, na linha do tempo. */
  deslocamentoDoTrecho?: AtividadeApi["deslocamento"];
  /** Reserva vinculada (título e estado), quando existe: o compromisso que sustenta a atividade. */
  reserva?: { titulo: string; estado: "prevista" | "confirmada" | "cancelada" } | null;
  aoAbrir: (atividadeId: string) => void;
}

/** Marcador da linha do tempo + trecho de deslocamento + cartão. */
export function CartaoAtividade({ atividade, conflitos, deslocamentoDoTrecho, reserva, aoAbrir }: Props): React.ReactElement {
  const contexto = linhasDeContexto({ ...atividade, reserva });
  const trecho = avaliarTrecho(deslocamentoDoTrecho);
  const temConflito = conflitos.length > 0;
  const concluida = atividade.estado === "concluida";
  const cancelada = atividade.estado === "cancelada";

  return (
    <li className={`atividade${temConflito ? " com-conflito" : ""}${concluida ? " concluida" : ""}${cancelada ? " cancelada" : ""}`}>
      <span className="marcador" aria-hidden="true" />
      <div className="atividade-corpo">
        {trecho ? <TrechoDeslocamento trecho={trecho} /> : null}

        <button className="cartao cartao-atividade" onClick={() => aoAbrir(atividade.id)} type="button">
          <div className="atividade-topo">
            <span className="atividade-hora">{textoDoHorario(atividade.hora)}</span>
            <span className={`etiqueta estado-${atividade.estado}`}>
              {ROTULO_ATIVIDADE[atividade.estado] ?? atividade.estado}
            </span>
          </div>

          <h3 className="atividade-titulo">{atividade.titulo}</h3>

          {contexto.length > 0 ? (
            <div className="atividade-contexto">
              {contexto.map((linha) => (
                <span
                  key={linha.texto}
                  className={
                    linha.tipo === "a-verificar" ? "custo-a-verificar" : linha.tipo === "custo" ? "custo" : linha.tipo === "reserva" ? "reserva-vinculada" : undefined
                  }
                >
                  {linha.texto}
                </span>
              ))}
            </div>
          ) : null}

          {temConflito ? (
            <div className="alerta-conflito" role="status">
              {conflitos.map((conflito) => (
                <p key={conflito.explicacao}>
                  <strong>{tituloDoConflito(conflito.tipo)}: </strong>
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
function TrechoDeslocamento({ trecho }: { trecho: ReturnType<typeof avaliarTrecho> }): React.ReactElement | null {
  if (!trecho) return null;
  return (
    <div className={`trecho${trecho.detalhado ? " aberto" : ""}`}>
      <span className="trecho-seta" aria-hidden="true">
        ↓
      </span>
      <span className="trecho-texto">{trecho.resumo ? `Deslocamento: ${trecho.resumo}` : "Deslocamento"}</span>
      {trecho.alerta ? <span className="trecho-alerta">{trecho.alerta}</span> : null}
    </div>
  );
}
