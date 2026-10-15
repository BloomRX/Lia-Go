/**
 * Detalhes da atividade — **tela própria**, como a diretriz §2.1 exige: o cartão da linha do tempo
 * fica resumido e o conteúdo completo mora aqui (horário e duração, local e deslocamento, custo e
 * natureza do valor, observações e histórico).
 *
 * As ações (concluir, cancelar, corrigir) passam pela fila do aparelho: valem na hora e sobem
 * quando houver rede. Todas exigem motivo/ação explícita — nada acontece pelo relógio.
 */
import { useEffect, useMemo, useState } from "react";
import { api, ErroApi, type AtividadeApi } from "../services/api.ts";
import {
  descreverDeslocamento,
  formatarBRL,
  formatarData,
  formatarDiaLongo,
  formatarDuracao,
  paraCentavos,
  ROTULO_ATIVIDADE,
} from "../services/formato.ts";
import type { Sincronizador } from "../offline/sincronizador.ts";
import { revisarImpacto, type Atividade as AtividadeDominio } from "@lia-go/domain";
import { atividadeDoDominio } from "../services/viagem-local.ts";

interface Props {
  viagemId: string;
  atividadeId: string;
  sincronizador: Sincronizador;
  voltar: () => void;
}

interface EventoHistorico {
  acao: string;
  autorId: string;
  em: string;
  motivo: string | null;
}

const ROTULO_HISTORICO: Record<string, string> = {
  "atividade:criar": "Atividade criada",
  "atividade:concluir": "Concluída",
  "atividade:cancelar": "Cancelada",
  "atividade:corrigir": "Corrigida",
};

/** Revisão de impacto (decisões V1 §13): o que muda aparece **antes** do botão que muda. */
function ImpactoDaAcao({ atividade, acao }: { atividade: AtividadeDominio; acao: "concluir" | "cancelar" }): React.ReactElement {
  const impacto = revisarImpacto(atividade, acao);
  return (
    <div className="impacto">
      <h3>Antes de continuar: o que isso muda</h3>
      <ul>
        {impacto.itens.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {impacto.atencao.length > 0 ? (
        <>
          <h4>Atenção</h4>
          <ul className="impacto-atencao">
            {impacto.atencao.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function Atividade({ viagemId, atividadeId, sincronizador, voltar }: Props): React.ReactElement {
  const [estado, setEstado] = useState(sincronizador.obter());
  const [historico, setHistorico] = useState<EventoHistorico[] | null>(null);
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [corrigindo, setCorrigindo] = useState(false);
  const [ajustes, setAjustes] = useState({ titulo: "", hora: "", duracao: "", local: "", custo: "", natureza: "estimativa" as "estimativa" | "compromisso" | "gratuito" });
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => sincronizador.assinar(setEstado), [sincronizador]);

  const brutaDoCache = useMemo(
    () => estado.carga.atividades.find((item) => item["id"] === atividadeId) ?? null,
    [estado.carga.atividades, atividadeId],
  );

  const atividade = useMemo(() => {
    const bruta = brutaDoCache;
    if (!bruta) return null;
    const custo = (bruta["custo"] ?? {}) as { centavos?: string | null; natureza?: string | null; aVerificar?: boolean };
    return {
      id: String(bruta["id"]),
      dia: String(bruta["dia"]),
      titulo: String(bruta["titulo"]),
      hora: (bruta["hora"] as string | null) ?? null,
      duracaoMinutos: (bruta["duracaoMinutos"] as number | null) ?? null,
      local: (bruta["local"] as string | null) ?? null,
      estado: String(bruta["estado"]),
      observacao: (bruta["observacao"] as string | null) ?? null,
      concluidaEm: (bruta["concluidaEm"] as string | null) ?? null,
      versao: Number(bruta["versao"] ?? 1),
      custo,
      deslocamento: (bruta["deslocamento"] as AtividadeApi["deslocamento"]) ?? null,
    };
  }, [brutaDoCache]);

  // Mesma forma que o domínio usa (e que a fila envia), para a revisão de impacto não divergir da tela.
  const atividadeDominio = useMemo(
    () => (brutaDoCache ? atividadeDoDominio({ ...brutaDoCache, viagemId }) : null),
    [brutaDoCache, viagemId],
  );

  // Histórico completo vem do servidor quando há rede; offline, a tela continua útil sem ele.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const detalhe = (await api.detalheAtividade(viagemId, atividadeId)) as { historico?: EventoHistorico[] };
        if (vivo && Array.isArray(detalhe.historico)) setHistorico(detalhe.historico);
      } catch {
        /* sem rede: o essencial já está no aparelho */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [viagemId, atividadeId]);

  async function concluir(): Promise<void> {
    if (!atividade) return;
    setErro(null);
    await sincronizador.enfileirar({
      tipo: "concluir_atividade",
      viagemId,
      atividadeId,
      observacao: observacao.trim() || undefined,
      versao: atividade.versao,
      descricao: `Concluir: ${atividade.titulo}`,
    });
    setAviso("Conclusão registrada. Ela sobe para o grupo quando houver rede.");
    setObservacao("");
  }

  async function cancelar(): Promise<void> {
    if (!atividade) return;
    setErro(null);
    if (motivo.trim().length < 5) {
      setErro("Explique o motivo do cancelamento (mínimo 5 caracteres).");
      return;
    }
    await sincronizador.enfileirar({
      tipo: "cancelar_atividade",
      viagemId,
      atividadeId,
      motivo: motivo.trim(),
      versao: atividade.versao,
      descricao: `Cancelar: ${atividade.titulo}`,
    });
    setAviso("Cancelamento registrado com o motivo.");
    setMotivo("");
  }

  async function corrigir(evento: React.FormEvent): Promise<void> {
    evento.preventDefault();
    if (!atividade) return;
    setErro(null);
    if (motivo.trim().length < 5) {
      setErro("Explique o motivo da correção (mínimo 5 caracteres).");
      return;
    }
    try {
      const custoCentavos = ajustes.custo.trim() ? (ajustes.natureza === "gratuito" ? "0" : paraCentavos(ajustes.custo)) : null;
      await sincronizador.enfileirar({
        tipo: "corrigir_atividade",
        viagemId,
        atividadeId,
        corpo: {
          motivo: motivo.trim(),
          ...(ajustes.titulo.trim() ? { titulo: ajustes.titulo.trim() } : {}),
          ...(ajustes.hora.trim() ? { hora: ajustes.hora.trim() } : {}),
          ...(ajustes.duracao.trim() ? { duracaoMinutos: Number(ajustes.duracao) } : {}),
          ...(ajustes.local.trim() ? { local: ajustes.local.trim() } : {}),
          custoCentavos,
          custoNatureza: custoCentavos === null ? null : ajustes.natureza,
          versao: atividade.versao,
        },
        descricao: `Corrigir: ${atividade.titulo}`,
      });
      setCorrigindo(false);
      setMotivo("");
      setAviso("Correção registrada com motivo e histórico.");
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Não foi possível guardar a correção.");
    }
  }

  if (!atividade) {
    return (
      <main className="app">
        <button className="sutil" onClick={voltar}>
          ← Voltar ao roteiro
        </button>
        <div className="cartao vazio">
          <p>Atividade não encontrada neste aparelho.</p>
          <p className="suave pequeno">Se ela acabou de ser criada em outro celular, sincronize para receber.</p>
        </div>
      </main>
    );
  }

  const duracao = formatarDuracao(atividade.duracaoMinutos);
  // O custo conhecido é `string` (centavos) ou `null` (desconhecido). Este alias deixa a leitura clara.
  const centavos: string | null = atividade.custo.centavos ?? null;
  const trecho = atividade.deslocamento ? descreverDeslocamento(atividade.deslocamento) : "";
  const planejada = atividade.estado === "planejada";

  return (
    <main className="app">
      <button className="sutil" onClick={voltar}>
        ← Voltar ao roteiro
      </button>

      <div className="linha entre">
        <h1>{atividade.titulo}</h1>
        <span className={`etiqueta estado-${atividade.estado}`}>{ROTULO_ATIVIDADE[atividade.estado] ?? atividade.estado}</span>
      </div>

      {aviso ? (
        <div className="aviso info" role="status">
          {aviso}
          <button className="sutil" style={{ marginLeft: 8 }} onClick={() => setAviso(null)}>
            ok
          </button>
        </div>
      ) : null}
      {erro ? <div className="aviso erro" role="alert">{erro}</div> : null}

      <section className="cartao">
        <h2>Quando e onde</h2>
        <div className="ficha">
          <div>
            <span className="rotulo">Dia</span>
            <span>
              {formatarDiaLongo(atividade.dia)} <span className="suave pequeno">({formatarData(atividade.dia)})</span>
            </span>
          </div>
          <div>
            <span className="rotulo">Horário</span>
            <span>{atividade.hora ? atividade.hora : "Flexível — sem horário fixo"}</span>
          </div>
          {duracao ? (
            <div>
              <span className="rotulo">Duração</span>
              <span>{duracao}</span>
            </div>
          ) : null}
          {atividade.local ? (
            <div>
              <span className="rotulo">Local</span>
              <span>{atividade.local}</span>
            </div>
          ) : null}
          {atividade.deslocamento && (trecho || atividade.deslocamento.alerta) ? (
            <div>
              <span className="rotulo">Deslocamento até aqui</span>
              <span>
                {trecho || "sem tempo informado"}
                {atividade.deslocamento.alerta ? <em className="trecho-alerta"> · {atividade.deslocamento.alerta}</em> : null}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="cartao">
        <h2>Custo</h2>
        {centavos === null ? (
          atividade.custo.aVerificar ? (
            <p className="custo-a-verificar">Custo a verificar — o valor ainda não foi confirmado.</p>
          ) : (
            <p className="suave pequeno">Nenhum custo informado (não é o mesmo que custo zero).</p>
          )
        ) : atividade.custo.natureza === "gratuito" ? (
          <p>Sem custo ({formatarBRL(0n)}).</p>
        ) : (
          <p>
            {formatarBRL(BigInt(centavos))}{" "}
            <span className="suave pequeno">
              ({atividade.custo.natureza === "compromisso" ? "valor já combinado" : "estimativa"})
            </span>
          </p>
        )}
        <p className="suave pequeno">
          O roteiro não altera saldos oficiais: isto é planejamento. O gasto de verdade entra em Despesas.
        </p>
      </section>

      {atividade.observacao ? (
        <section className="cartao">
          <h2>Observações</h2>
          <p>{atividade.observacao}</p>
        </section>
      ) : null}

      {planejada ? (
        <section className="cartao">
          <h2>O que aconteceu?</h2>
          <label htmlFor="conclusao-observacao">Observação da conclusão (opcional)</label>
          <input
            id="conclusao-observacao"
            value={observacao}
            onChange={(evento) => setObservacao(evento.target.value)}
            placeholder="Chegamos 10 min atrasados"
          />
          {atividadeDominio ? <ImpactoDaAcao atividade={atividadeDominio} acao="concluir" /> : null}
          <div className="acoes">
            <button className="principal" onClick={() => void concluir()}>
              Marcar como concluída
            </button>
          </div>
          <p className="suave pequeno">
            O Lia Go nunca conclui pelo horário: o registro é sempre uma ação de alguém (aqui, você).
          </p>
        </section>
      ) : null}

      {atividade.estado === "concluida" ? (
        <p className="suave pequeno">
          Concluída em {atividade.concluidaEm ? new Date(atividade.concluidaEm).toLocaleString("pt-BR") : "—"}.
        </p>
      ) : null}

      {planejada ? (
        <section className="cartao">
          <h2>Ajustar ou cancelar</h2>
          {corrigindo ? (
            <form onSubmit={corrigir}>
              <div className="duas-colunas">
                <div>
                  <label htmlFor="ajuste-titulo">Título</label>
                  <input id="ajuste-titulo" value={ajustes.titulo} onChange={(evento) => setAjustes({ ...ajustes, titulo: evento.target.value })} placeholder={atividade.titulo} />
                </div>
                <div>
                  <label htmlFor="ajuste-hora">Horário</label>
                  <input id="ajuste-hora" type="time" value={ajustes.hora} onChange={(evento) => setAjustes({ ...ajustes, hora: evento.target.value })} />
                </div>
              </div>
              <div className="duas-colunas">
                <div>
                  <label htmlFor="ajuste-duracao">Duração (min)</label>
                  <input id="ajuste-duracao" type="number" min={1} value={ajustes.duracao} onChange={(evento) => setAjustes({ ...ajustes, duracao: evento.target.value })} />
                </div>
                <div>
                  <label htmlFor="ajuste-local">Local</label>
                  <input id="ajuste-local" value={ajustes.local} onChange={(evento) => setAjustes({ ...ajustes, local: evento.target.value })} placeholder={atividade.local ?? ""} />
                </div>
              </div>
              <div className="duas-colunas">
                <div>
                  <label htmlFor="ajuste-custo">Custo</label>
                  <input id="ajuste-custo" value={ajustes.custo} onChange={(evento) => setAjustes({ ...ajustes, custo: evento.target.value })} placeholder="120,00" disabled={ajustes.natureza === "gratuito"} />
                </div>
                <div>
                  <label htmlFor="ajuste-natureza">Natureza</label>
                  <select id="ajuste-natureza" value={ajustes.natureza} onChange={(evento) => setAjustes({ ...ajustes, natureza: evento.target.value as typeof ajustes.natureza })}>
                    <option value="estimativa">Estimativa</option>
                    <option value="compromisso">Compromisso</option>
                    <option value="gratuito">Sem custo</option>
                  </select>
                </div>
              </div>
              <label htmlFor="ajuste-motivo">Motivo da correção</label>
              <input id="ajuste-motivo" value={motivo} onChange={(evento) => setMotivo(evento.target.value)} placeholder="O restaurante abre 11h30" required minLength={5} />
              <div className="acoes">
                <button className="principal" type="submit">
                  Salvar correção
                </button>
                <button className="sutil" type="button" onClick={() => setCorrigindo(false)}>
                  Voltar
                </button>
              </div>
              <p className="suave pequeno">A correção guarda o antes e o depois: nada é apagado em silêncio.</p>
            </form>
          ) : (
            <>
              <button className="sutil" onClick={() => setCorrigindo(true)}>
                Corrigir dados
              </button>
              <label htmlFor="cancelar-motivo">Motivo do cancelamento</label>
              <input
                id="cancelar-motivo"
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                placeholder="Chuva forte; vamos remarcar"
              />
              {atividadeDominio ? <ImpactoDaAcao atividade={atividadeDominio} acao="cancelar" /> : null}
              <div className="acoes">
                <button className="perigo" onClick={() => void cancelar()}>
                  Cancelar atividade
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {historico && historico.length > 0 ? (
        <section className="cartao">
          <h2>Histórico</h2>
          <ol className="historico">
            {historico.map((evento, indice) => (
              <li key={`${evento.acao}-${indice}`}>
                <strong>{ROTULO_HISTORICO[evento.acao] ?? evento.acao}</strong>
                <span className="suave pequeno"> · {new Date(evento.em).toLocaleString("pt-BR")}</span>
                {evento.motivo ? <p className="suave pequeno">“{evento.motivo}”</p> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="suave pequeno">Estado atual: {ROTULO_ATIVIDADE[atividade.estado] ?? atividade.estado}.</p>
    </main>
  );
}
