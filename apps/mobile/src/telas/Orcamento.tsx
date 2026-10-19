/**
 * Orçamento da viagem (tela 9 / decisões V1 §7 e §8): limite com barra, na aba Gastos.
 *
 * Regras que a tela **não** quebra:
 *  - o limite é **planejamento**; o gasto oficial continua sendo só o confirmado no servidor;
 *  - o previsto aparece como "mínimo" enquanto houver custo a verificar;
 *  - sem conexão, o aparelho mostra o **previsto** (que ele calcula do roteiro e das reservas) e diz
 *    com todas as letras que o número oficial precisa do servidor — nunca inventa saldo;
 *  - definir limite coletivo é do organizador; o individual é de cada pessoa (§13: permissão não se
 *    decide no cliente — aqui só se mostra o que o servidor permitiu).
 */
import { useEffect, useMemo, useState } from "react";
import {
  ROTULO_ESTADO_ORCAMENTO,
  resumirOrcamentoDoRoteiro,
  resumirReservas,
  situacaoDoOrcamento,
  type Atividade,
  type Reserva,
  type SituacaoDoOrcamento,
} from "@lia-go/domain";
import { api, ErroApi, type OrcamentoApi } from "../services/api.ts";
import { formatarBRL, paraCentavos } from "../services/formato.ts";
import type { Sincronizador } from "../offline/sincronizador.ts";
import { pode } from "../services/viagem-local.ts";

interface Props {
  viagemId: string;
  usuarioId: string;
  sincronizador: Sincronizador;
  /** Atividades e reservas do aparelho: base do previsto quando não há rede. */
  atividades: readonly Atividade[];
  reservas: readonly Reserva[];
  /** Saldos oficiais já vindos do servidor (fonte do "gasto confirmado"). */
  gastoConfirmadoCentavos: string | null;
  aguardandoCentavos: string | null;
  saldosEm: string | null;
  ehOrganizador: boolean;
  permissoes: {
    definirLimite?: { permitido?: boolean; motivo?: string };
    definirLimiteProprio?: { permitido?: boolean; motivo?: string };
  };
}

export function Orcamento({
  viagemId,
  usuarioId,
  sincronizador,
  atividades,
  reservas,
  gastoConfirmadoCentavos,
  aguardandoCentavos,
  saldosEm,
  ehOrganizador,
  permissoes,
}: Props): React.ReactElement {
  const [doServidor, setDoServidor] = useState<OrcamentoApi | null>(null);
  const [limiteColetivoLocal, setLimiteColetivoLocal] = useState<string | null>(null);
  /** Por que o número do servidor não chegou: a tela explica o caso certo, sem culpar a rede à toa. */
  const [motivoSemServidor, setMotivoSemServidor] = useState<"sem_rede" | "sem_resposta" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [coletivo, setColetivo] = useState("");
  const [individual, setIndividual] = useState("");
  const [editando, setEditando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void sincronizador.sincronizarAgora().finally(async () => {
      try {
        const resposta = await api.orcamento(viagemId);
        if (!vivo) return;
        setDoServidor(resposta);
        setLimiteColetivoLocal(resposta.limiteColetivo?.centavos ?? null);
        setMotivoSemServidor(null);
        await sincronizador.guardarOrcamento(viagemId, resposta);
      } catch (falha) {
        // Sem rede o orçamento continua útil com o previsto e o último limite conhecido no aparelho.
        if (!vivo) return;
        const salvo = await sincronizador.lerOrcamento(viagemId);
        if (!vivo) return;
        if (salvo?.orcamento.limiteColetivo?.centavos) {
          setLimiteColetivoLocal(salvo.orcamento.limiteColetivo.centavos);
        }
        setMotivoSemServidor(falha instanceof ErroApi ? "sem_resposta" : "sem_rede");
      }
    });
    return () => {
      vivo = false;
    };
  }, [viagemId, sincronizador]);

  /**
   * Previsto calculado no aparelho (roteiro + reservas) — o mesmo cálculo que o servidor faz.
   * A separação entre "já combinado" e "estimativa" vem daqui também: é o que impede o número de
   * parecer mais firme do que é (decisão V1 §8).
   */
  const previstoLocal = useMemo(() => {
    const roteiro = resumirOrcamentoDoRoteiro(atividades);
    const deReservas = resumirReservas(reservas);
    return {
      previstoCentavos: roteiro.previstoCentavos + deReservas.previstoCentavos,
      custosAVerificar: roteiro.aVerificar + deReservas.semCustoInformado,
      compromissoCentavos: roteiro.compromissoCentavos + deReservas.compromissoCentavos,
      estimativaCentavos: roteiro.estimativaCentavos + deReservas.estimativaCentavos,
      deReservasCentavos: deReservas.previstoCentavos,
      semCustoInformadoReservas: deReservas.semCustoInformado,
    };
  }, [atividades, reservas]);

  const situacao: SituacaoDoOrcamento = useMemo(() => {
    if (doServidor && limiteColetivoLocal === (doServidor.limiteColetivo?.centavos ?? null)) {
      return {
        temLimite: doServidor.situacao.temLimite,
        limiteCentavos: doServidor.situacao.limiteCentavos === null ? null : BigInt(doServidor.situacao.limiteCentavos),
        previstoCentavos: BigInt(doServidor.situacao.previstoCentavos),
        gastoConfirmadoCentavos: BigInt(doServidor.situacao.gastoConfirmadoCentavos),
        aguardandoCentavos: BigInt(doServidor.situacao.aguardandoCentavos),
        restantePrevistoCentavos:
          doServidor.situacao.restantePrevistoCentavos === null ? null : BigInt(doServidor.situacao.restantePrevistoCentavos),
        restanteGastoCentavos:
          doServidor.situacao.restanteGastoCentavos === null ? null : BigInt(doServidor.situacao.restanteGastoCentavos),
        percentualPrevisto: doServidor.situacao.percentualPrevisto,
        percentualGasto: doServidor.situacao.percentualGasto,
        estado: doServidor.situacao.estado,
        alertas: doServidor.situacao.alertas,
        resumo: doServidor.situacao.resumo,
      };
    }
    // Sem rede (ou com limite ajustado neste aparelho enquanto espera conexão): recalcula a situação
    // pelo domínio com o previsto local e o último gasto conhecido.
    const gasto = doServidor ? BigInt(doServidor.situacao.gastoConfirmadoCentavos) : gastoConfirmadoCentavos === null ? 0n : BigInt(gastoConfirmadoCentavos);
    const aguardando = doServidor ? BigInt(doServidor.situacao.aguardandoCentavos) : aguardandoCentavos === null ? 0n : BigInt(aguardandoCentavos);
    return situacaoDoOrcamento({
      limiteCentavos: limiteColetivoLocal === null ? null : BigInt(limiteColetivoLocal),
      previstoCentavos: previstoLocal.previstoCentavos,
      gastoConfirmadoCentavos: gasto,
      aguardandoCentavos: aguardando,
      custosAVerificar: previstoLocal.custosAVerificar,
    });
  }, [doServidor, limiteColetivoLocal, previstoLocal, gastoConfirmadoCentavos, aguardandoCentavos]);

  const comServidor = doServidor !== null;
  // Custo sem valor informado: vem do servidor quando há rede; senão do que o aparelho calculou.
  const custosAVerificar = doServidor?.planejamento.custosAVerificar ?? previstoLocal.custosAVerificar;
  const semLimite = !situacao.temLimite;
  const percentual = situacao.percentualPrevisto ?? 0;
  const largura = Math.min(100, Math.max(0, percentual));
  const restante = situacao.restantePrevistoCentavos;

  async function definir(escopo: "coletivo" | "individual"): Promise<void> {
    const texto = escopo === "coletivo" ? coletivo : individual;
    setErro(null);
    setAviso(null);
    let centavos: string;
    try {
      centavos = paraCentavos(texto);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Valor inválido.");
      return;
    }
    setEnviando(true);
    try {
      let textoAviso: string;
      if (escopo === "coletivo") {
        const resposta = await api.definirLimiteColetivo(viagemId, centavos);
        textoAviso = `Limite da viagem: ${formatarBRL(resposta.limite.centavos)}. Vale como planejamento do grupo.`;
        setLimiteColetivoLocal(resposta.limite.centavos);
        setColetivo("");
      } else {
        const resposta = await api.definirLimiteIndividual(viagemId, usuarioId, centavos);
        textoAviso = `Seu limite nesta viagem: ${formatarBRL(resposta.limite.centavos)}.`;
        setIndividual("");
      }
      const atualizado = await api.orcamento(viagemId);
      setDoServidor(atualizado);
      setLimiteColetivoLocal(atualizado.limiteColetivo?.centavos ?? null);
      setEditando(false);
      setAviso(textoAviso);
      void sincronizador.guardarOrcamento(viagemId, atualizado);
    } catch (falha) {
      if (falha instanceof ErroApi) {
        setErro(falha.message);
      } else {
        await sincronizador.enfileirar({
          tipo: "definir_limite_orcamento",
          viagemId,
          escopo,
          ...(escopo === "individual" ? { usuarioId } : {}),
          centavos,
          descricao:
            escopo === "coletivo"
              ? `Definir limite da viagem: ${formatarBRL(centavos)}`
              : `Definir meu limite individual: ${formatarBRL(centavos)}`,
        });
        if (escopo === "coletivo") {
          setLimiteColetivoLocal(centavos);
          setColetivo("");
          setAviso(
            `Limite da viagem: ${formatarBRL(centavos)}. Vale como planejamento do grupo (guardado neste aparelho; será enviado quando houver conexão).`,
          );
        } else {
          setIndividual("");
          setAviso(`Seu limite nesta viagem: ${formatarBRL(centavos)} (guardado neste aparelho; será enviado quando houver conexão).`);
        }
        setEditando(false);
      }
    } finally {
      setEnviando(false);
    }
  }

  const podeColetivo = ehOrganizador && pode(permissoes.definirLimite);
  const podeIndividual = pode(permissoes.definirLimiteProprio);

  return (
    <section className="cartao" aria-labelledby="titulo-orcamento">
      <h2 id="titulo-orcamento">Orçamento da viagem</h2>

      {semLimite ? (
        <p>
          Nenhum limite definido. Você pode combinar um teto — ele serve de <strong>planejamento</strong>, não
          bloqueia nada.
        </p>
      ) : (
        <>
          <div className="linha entre">
            <span>
              {formatarBRL(situacao.previstoCentavos)} de <strong>{formatarBRL(situacao.limiteCentavos ?? 0n)}</strong>
            </span>
            <span className={`etiqueta estado-orcamento-${situacao.estado}`}>{ROTULO_ESTADO_ORCAMENTO[situacao.estado]}</span>
          </div>
          <div
            className={`barra-orcamento preenchimento-${situacao.estado}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={largura}
            aria-label={`Orçamento previsto: ${largura}% do limite`}
          >
            <div className="preenchimento" style={{ width: `${largura}%` }} />
          </div>
          <p className="suave pequeno">
            {percentual}% do limite em planejamento.
            {situacao.estado === "estourado"
              ? " O previsto passou do combinado — combine mais ou reveja o roteiro."
              : restante !== null && restante > 0n
                ? ` Ainda cabem ${formatarBRL(restante)} de planejamento.`
                : ""}
          </p>
        </>
      )}

      <div className="linha"><span>Gasto confirmado (oficial)</span><strong>{formatarBRL(situacao.gastoConfirmadoCentavos)}</strong></div>
      {situacao.limiteCentavos !== null && situacao.gastoConfirmadoCentavos > 0n ? (
        <p className="suave pequeno">
          Do gasto confirmado, {formatarBRL(situacao.gastoConfirmadoCentavos)} de {formatarBRL(situacao.limiteCentavos)} —
          {" "}{situacao.percentualGasto ?? 0}% do teto.
        </p>
      ) : null}
      {situacao.aguardandoCentavos > 0n ? (
        <p className="suave pequeno">Aguardando confirmação (fora do oficial): {formatarBRL(situacao.aguardandoCentavos)}</p>
      ) : null}

      {!comServidor ? (
        <div className="aviso atencao">
          {motivoSemServidor === "sem_resposta"
            ? "O servidor não devolveu o orçamento desta viagem agora: abaixo está o previsto calculado no aparelho. O gasto oficial e o limite combinado aparecem quando o servidor responder."
            : "Sem conexão agora: o previsto vem do que está no aparelho. O gasto confirmado e o limite combinado precisam do servidor para aparecer atualizados."}
        </div>
      ) : null}

      <h3 style={{ marginTop: 12 }}>Previsto (planejamento)</h3>
      <div className="linha">
        <span>Previsto (estimativas + combinado)</span>
        <strong>{formatarBRL(previstoLocal.previstoCentavos)}</strong>
      </div>
      {previstoLocal.compromissoCentavos > 0n ? (
        <div className="linha"><span>· já combinado</span><span>{formatarBRL(previstoLocal.compromissoCentavos)}</span></div>
      ) : null}
      {previstoLocal.estimativaCentavos > 0n ? (
        <div className="linha"><span>· estimativa</span><span>{formatarBRL(previstoLocal.estimativaCentavos)}</span></div>
      ) : null}
      {previstoLocal.deReservasCentavos > 0n ? (
        <div className="linha"><span>· reservas</span><span>{formatarBRL(previstoLocal.deReservasCentavos)}</span></div>
      ) : null}

      {situacao.alertas.length > 0 ? (
        <ul className="lista-alertas custo-a-verificar">
          {situacao.alertas.map((alerta) => (
            <li key={alerta}>{alerta}</li>
          ))}
        </ul>
      ) : null}

      <p className="suave pequeno">
        O previsto e o limite são <strong>planejamento</strong>: não entram no saldo oficial e não substituem a despesa
        registrada. Gastar de verdade é o que aparece em "Gasto confirmado", confirmado no servidor.
        {custosAVerificar > 0 ? " Enquanto houver custo a verificar, o previsto é o valor mínimo." : ""}
        {comServidor && saldosEm ? ` Números do servidor de ${new Date(saldosEm).toLocaleString("pt-BR")}.` : ""}
      </p>

      {editando ? (
        <>
          {podeColetivo ? (
            <>
              <label htmlFor="orcamento-coletivo">Limite da viagem (ex.: 3.000,00)</label>
              <input
                id="orcamento-coletivo"
                inputMode="decimal"
                value={coletivo}
                onChange={(evento) => setColetivo(evento.target.value)}
                placeholder="3000,00"
              />
              <div className="acoes">
                <button className="principal" disabled={enviando || coletivo.trim() === ""} onClick={() => void definir("coletivo")}>
                  Salvar limite do grupo
                </button>
              </div>
            </>
          ) : (
            <p className="suave pequeno">Só quem organiza define o limite do grupo.</p>
          )}

          {podeIndividual ? (
            <>
              <label htmlFor="orcamento-individual">Meu limite individual (opcional)</label>
              <input
                id="orcamento-individual"
                inputMode="decimal"
                value={individual}
                onChange={(evento) => setIndividual(evento.target.value)}
                placeholder="800,00"
              />
              <div className="acoes">
                <button className="sutil" disabled={enviando || individual.trim() === ""} onClick={() => void definir("individual")}>
                  Salvar meu limite
                </button>
                <button className="sutil" onClick={() => setEditando(false)}>
                  Fechar
                </button>
              </div>
            </>
          ) : (
            <p className="suave pequeno">{permissoes.definirLimiteProprio?.motivo ?? "Seu limite individual não está disponível agora."}</p>
          )}
        </>
      ) : (
        <div className="acoes">
          <button className="sutil" onClick={() => setEditando(true)}>
            {semLimite ? "Definir limite" : "Ajustar limite"}
          </button>
        </div>
      )}

      {doServidor && doServidor.limitesIndividuais.length > 0 ? (
        <>
          <h3 style={{ marginTop: 12 }}>Limites individuais</h3>
          {doServidor.limitesIndividuais.map((limite) => (
            <div className="linha" key={limite.id}>
              <span>{limite.usuarioId === usuarioId ? `${limite.nome ?? "você"} (você)` : limite.nome ?? "participante"}</span>
              <span>{formatarBRL(limite.centavos)}</span>
            </div>
          ))}
        </>
      ) : null}

      {aviso ? <div className="aviso ok">{aviso}</div> : null}
      {erro ? <div className="aviso erro">{erro}</div> : null}
    </section>
  );
}
