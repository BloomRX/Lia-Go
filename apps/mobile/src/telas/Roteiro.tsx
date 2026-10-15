/**
 * Roteiro da viagem: linha do tempo por dia, com resumo adaptável e conflitos explicados.
 *
 * Funciona **offline primeiro**: lê as atividades do aparelho (carga local) e calcula dias, resumo
 * e conflitos com as mesmas regras do servidor (`@lia-go/domain`). Criar atividade entra na fila e
 * sobe quando houver rede — o mesmo caminho com ou sem sinal.
 *
 * O que este arquivo não faz de propósito (diretriz §2):
 *  - não move horário nem resolve conflito;
 *  - não inventa horário para atividade flexível;
 *  - não conclui nada pelo relógio;
 *  - não mostra custo desconhecido como zero.
 */
import { useMemo, useState } from "react";
import { agruparPorDia, conflitosDoDia, resumirDia, type Atividade } from "@lia-go/domain";
import { api, ErroApi, type AtividadeApi, type ConflitoApi } from "../services/api.ts";
import { formatarDiaCurto, formatarDiaLongo, hojeIso, paraCentavos, ROTULO_ESTADO } from "../services/formato.ts";
import { linhasDoResumoDoDia } from "../services/roteiro-texto.ts";
import { CartaoAtividade } from "../componentes/CartaoAtividade.tsx";
import type { Sincronizador } from "../offline/sincronizador.ts";

interface Props {
  viagemId: string;
  usuarioId: string;
  sincronizador: Sincronizador;
  abrirAtividade: (atividadeId: string) => void;
  dataInicioViagem: string | null;
  dataFimViagem: string | null;
  estadoViagem: string;
}

/** Tipagem local do que o aparelho guarda (mesmo objeto que o servidor devolve). */
function comoAtividade(item: Record<string, unknown>): Atividade | null {
  if (typeof item["id"] !== "string" || typeof item["dia"] !== "string") return null;
  const custo = (item["custo"] ?? {}) as { centavos?: string | null; natureza?: Atividade["custoNatureza"] };
  return {
    id: item["id"] as string,
    viagemId: String(item["viagemId"] ?? ""),
    autorId: String(item["autorId"] ?? ""),
    dia: item["dia"] as string,
    ordem: Number(item["ordem"] ?? 1),
    titulo: String(item["titulo"] ?? ""),
    hora: (item["hora"] as string | null) ?? null,
    duracaoMinutos: (item["duracaoMinutos"] as number | null) ?? null,
    local: (item["local"] as string | null) ?? null,
    custoCentavos: custo.centavos ? BigInt(custo.centavos) : null,
    custoNatureza: custo.natureza ?? null,
    custoAVerificar: Boolean((item["custo"] as { aVerificar?: boolean })?.aVerificar),
    estado: (item["estado"] as Atividade["estado"]) ?? "planejada",
    concluidaPor: (item["concluidaPor"] as string | null) ?? null,
    concluidaEm: (item["concluidaEm"] as string | null) ?? null,
    observacao: (item["observacao"] as string | null) ?? null,
    deslocamento: (item["deslocamento"] as Atividade["deslocamento"]) ?? null,
    versao: Number(item["versao"] ?? 1),
  };
}

export function Roteiro({
  viagemId,
  usuarioId,
  sincronizador,
  abrirAtividade,
  dataInicioViagem,
  dataFimViagem,
  estadoViagem,
}: Props): React.ReactElement {
  const [estado, setEstado] = useState(sincronizador.obter());
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);
  const [recolherConcluidas, setRecolherConcluidas] = useState(false);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [nova, setNova] = useState({
    titulo: "",
    dia: dataInicioViagem ?? hojeIso(),
    hora: "",
    flexivel: false,
    duracao: "",
    local: "",
    custo: "",
    natureza: "estimativa" as "estimativa" | "compromisso" | "gratuito",
    aVerificar: false,
    deslocamentoMinutos: "",
    deslocamentoAlerta: "",
  });

  // O roteiro é assinatura do sincronizador: qualquer mudança (minha ou de outra pessoa) redesenha.
  useMemo(() => sincronizador.assinar(setEstado), [sincronizador]);

  const atividades = useMemo(
    () =>
      estado.carga.atividades
        .map(comoAtividade)
        .filter((atividade): atividade is Atividade => atividade !== null),
    [estado.carga.atividades],
  );

  const dias = useMemo(() => agruparPorDia(atividades), [atividades]);
  const diaAtual = diaEscolhido && dias.some((dia) => dia.dia === diaEscolhido) ? diaEscolhido : (dias[0]?.dia ?? nova.dia);
  const diaAberto = dias.find((dia) => dia.dia === diaAtual) ?? null;
  const conflitosPorAtividade = useMemo(() => {
    const mapa = new Map<string, ConflitoApi[]>();
    if (!diaAberto) return mapa;
    for (const conflito of conflitosDoDia(diaAberto.atividades) as unknown as ConflitoApi[]) {
      for (const id of conflito.atividadeIds) {
        mapa.set(id, [...(mapa.get(id) ?? []), conflito]);
      }
    }
    return mapa;
  }, [diaAberto]);

  const resumo = diaAberto ? resumirDia(diaAberto.atividades) : null;
  const criarBloqueada = estadoViagem === "cancelada" || estadoViagem === "concluida";

  async function enviarAtividade(evento: React.FormEvent): Promise<void> {
    evento.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const custoCentavos =
        nova.natureza === "gratuito" ? "0" : nova.custo.trim() ? paraCentavos(nova.custo) : null;
      const operacao = {
        tipo: "criar_atividade" as const,
        viagemId,
        corpo: {
          dia: nova.dia,
          titulo: nova.titulo,
          // Sem horário informado a atividade é flexível — nunca preenchemos "um horário provável".
          hora: nova.flexivel || !nova.hora.trim() ? null : nova.hora.trim(),
          duracaoMinutos: nova.duracao.trim() ? Number(nova.duracao) : null,
          local: nova.local.trim() || null,
          custoCentavos,
          custoNatureza: custoCentavos === null ? null : nova.natureza,
          custoAVerificar: nova.aVerificar,
          observacao: null,
          deslocamento: nova.deslocamentoMinutos.trim()
            ? { minutos: Number(nova.deslocamentoMinutos), km: null, custoCentavos: null, alerta: nova.deslocamentoAlerta.trim() || null }
            : null,
        },
        descricao: `Atividade: ${nova.titulo}`,
      };
      await sincronizador.enfileirar(operacao);
      setFormularioAberto(false);
      setDiaEscolhido(nova.dia);
      setNova({ ...nova, titulo: "", hora: "", duracao: "", local: "", custo: "", aVerificar: false, deslocamentoMinutos: "", deslocamentoAlerta: "" });
      setAviso(
        estado.online
          ? "Atividade guardada. Ela aparece na linha do tempo assim que o servidor confirmar."
          : "Atividade guardada no aparelho. Ela sobe para o servidor quando houver sinal.",
      );
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Não foi possível guardar a atividade.");
    } finally {
      setOcupado(false);
    }
  }

  const visiveis = diaAberto
    ? recolherConcluidas
      ? diaAberto.atividades.filter((atividade) => atividade.estado !== "concluida")
      : diaAberto.atividades
    : [];

  return (
    <section>
      <div className="linha entre">
        <h2>Roteiro</h2>
        {!criarBloqueada ? (
          <button className="principal compacto" onClick={() => setFormularioAberto((aberto) => !aberto)}>
            {formularioAberto ? "Fechar" : "Nova atividade"}
          </button>
        ) : (
          <span className="suave pequeno">{estadoViagem === "cancelada" ? "Viagem cancelada" : "Viagem concluída"}</span>
        )}
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

      {formularioAberto ? (
        <form className="cartao" onSubmit={enviarAtividade}>
          <h3>Nova atividade</h3>
          <label htmlFor="atividade-titulo">O que vai acontecer</label>
          <input
            id="atividade-titulo"
            value={nova.titulo}
            onChange={(evento) => setNova({ ...nova, titulo: evento.target.value })}
            required
            minLength={2}
            maxLength={120}
            placeholder="Visitar o mirante"
          />

          <div className="duas-colunas">
            <div>
              <label htmlFor="atividade-dia">Dia</label>
              <input
                id="atividade-dia"
                type="date"
                value={nova.dia}
                onChange={(evento) => setNova({ ...nova, dia: evento.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="atividade-hora">Horário (opcional)</label>
              <input
                id="atividade-hora"
                type="time"
                value={nova.hora}
                onChange={(evento) => setNova({ ...nova, hora: evento.target.value })}
                disabled={nova.flexivel}
              />
            </div>
          </div>

          <label className="caixa-marcacao">
            <input
              type="checkbox"
              checked={nova.flexivel}
              onChange={(evento) => setNova({ ...nova, flexivel: evento.target.checked, hora: evento.target.checked ? "" : nova.hora })}
            />
            Horário flexível (fica na ordem do dia, sem horário fixo)
          </label>

          <div className="duas-colunas">
            <div>
              <label htmlFor="atividade-duracao">Duração (min)</label>
              <input
                id="atividade-duracao"
                type="number"
                min={1}
                inputMode="numeric"
                value={nova.duracao}
                onChange={(evento) => setNova({ ...nova, duracao: evento.target.value })}
              />
            </div>
            <div>
              <label htmlFor="atividade-local">Local</label>
              <input
                id="atividade-local"
                value={nova.local}
                onChange={(evento) => setNova({ ...nova, local: evento.target.value })}
                placeholder="Praça central"
              />
            </div>
          </div>

          <div className="duas-colunas">
            <div>
              <label htmlFor="atividade-custo">Custo (opcional)</label>
              <input
                id="atividade-custo"
                value={nova.custo}
                onChange={(evento) => setNova({ ...nova, custo: evento.target.value })}
                placeholder="120,00"
                disabled={nova.natureza === "gratuito"}
              />
            </div>
            <div>
              <label htmlFor="atividade-natureza">Esse valor é</label>
              <select
                id="atividade-natureza"
                value={nova.natureza}
                onChange={(evento) => setNova({ ...nova, natureza: evento.target.value as typeof nova.natureza })}
              >
                <option value="estimativa">Estimativa</option>
                <option value="compromisso">Compromisso (já combinado)</option>
                <option value="gratuito">Sem custo (gratuito)</option>
              </select>
            </div>
          </div>

          <label className="caixa-marcacao">
            <input
              type="checkbox"
              checked={nova.aVerificar}
              onChange={(evento) => setNova({ ...nova, aVerificar: evento.target.checked })}
            />
            Ainda preciso verificar o custo
          </label>

          <div className="duas-colunas">
            <div>
              <label htmlFor="atividade-deslocamento">Deslocamento até aqui (min)</label>
              <input
                id="atividade-deslocamento"
                type="number"
                min={1}
                inputMode="numeric"
                value={nova.deslocamentoMinutos}
                onChange={(evento) => setNova({ ...nova, deslocamentoMinutos: evento.target.value })}
              />
            </div>
            <div>
              <label htmlFor="atividade-alerta">Alerta do trecho (opcional)</label>
              <input
                id="atividade-alerta"
                value={nova.deslocamentoAlerta}
                onChange={(evento) => setNova({ ...nova, deslocamentoAlerta: evento.target.value })}
                placeholder="Embarque não espera"
              />
            </div>
          </div>

          <div className="acoes">
            <button className="principal" type="submit" disabled={ocupado}>
              {ocupado ? "Guardando…" : "Guardar atividade"}
            </button>
            <button className="sutil" type="button" onClick={() => setFormularioAberto(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {dias.length === 0 ? (
        <div className="cartao vazio">
          <p>Nenhuma atividade ainda.</p>
          <p className="suave pequeno">
            Monte o roteiro aos poucos: cada atividade pode nascer só com o nome e o dia, e o resto você completa depois.
          </p>
        </div>
      ) : null}

      {/* Seleção de dia com `aria-pressed` (e não `role="tab"`): são botões de escolha, sem painel
          associado nem teclas de seta — a semântica declarada precisa ser a real. */}
      {dias.length > 1 ? (
        <div className="dias" role="group" aria-label="Dias do roteiro">
          {dias.map(({ dia, atividades: doDia }) => {
            const resumoDoDia = resumirDia(doDia);
            const conflitos = resumoDoDia.conflitos > 0 ? `, ${resumoDoDia.conflitos} conflito(s)` : "";
            return (
              <button
                key={dia}
                aria-pressed={dia === diaAtual}
                aria-label={`${formatarDiaLongo(dia)}: ${resumoDoDia.total} atividade(s)${conflitos}`}
                className={`dia-chip${dia === diaAtual ? " ativo" : ""}${resumoDoDia.conflitos > 0 ? " com-conflito" : ""}`}
                onClick={() => setDiaEscolhido(dia)}
                type="button"
              >
                <span aria-hidden="true">{formatarDiaCurto(dia)}</span>
                <small aria-hidden="true">
                  {resumoDoDia.total} {resumoDoDia.total === 1 ? "atividade" : "atividades"}
                  {resumoDoDia.conflitos > 0 ? ` · ${resumoDoDia.conflitos} conflito(s)` : ""}
                </small>
              </button>
            );
          })}
        </div>
      ) : null}

      {diaAberto && resumo ? (
        <>
          <div className="linha entre">
            <h3 className="dia-titulo">{formatarDiaLongo(diaAberto.dia)}</h3>
            {resumo.concluidas > 0 ? (
              <button className="sutil pequeno" onClick={() => setRecolherConcluidas((valor) => !valor)}>
                {recolherConcluidas ? "Mostrar concluídas" : "Recolher concluídas"}
              </button>
            ) : null}
          </div>

          {/* Resumo adaptável (§2.9): compacto no dia normal, expandido quando há o que decidir. */}
          <div className={`resumo-dia${resumo.conflitos > 0 || resumo.temCustoAVerificar ? " expandido" : ""}`}>
            {linhasDoResumoDoDia({
              total: resumo.total,
              concluidas: resumo.concluidas,
              flexiveis: resumo.flexiveis,
              custoConhecidoCentavos: resumo.custoConhecidoCentavos,
              temCustoAVerificar: resumo.temCustoAVerificar,
              conflitos: resumo.conflitos,
            }).map((linha) => (
              <span key={linha.texto} className={linha.tipo === "atencao" ? "conflito-aviso" : undefined}>
                {linha.texto}
              </span>
            ))}
          </div>

          {resumo.conflitos > 0 ? (
            <div className="aviso atencao" role="status">
              <strong>Conflitos neste dia.</strong> O Lia Go não muda horários sozinho — abra as atividades destacadas e ajuste.
            </div>
          ) : null}

          <ol className="linha-tempo">
            {visiveis.map((atividade, indice) => (
              <CartaoAtividade
                key={atividade.id}
                atividade={atividade as unknown as AtividadeApi}
                conflitos={conflitosPorAtividade.get(atividade.id) ?? []}
                deslocamentoDoTrecho={indice === 0 ? null : ((atividade.deslocamento as AtividadeApi["deslocamento"]) ?? null)}
                aoAbrir={abrirAtividade}
              />
            ))}
          </ol>

          {visiveis.length === 0 && recolherConcluidas ? (
            <p className="suave pequeno">Todas as atividades deste dia estão recolhidas (nada foi apagado).</p>
          ) : null}
        </>
      ) : null}

      {usuarioId && estadoViagem === "rascunho" ? (
        <p className="suave pequeno">
          Esta viagem ainda é um rascunho ({ROTULO_ESTADO["rascunho"]}). O roteiro pode ser montado já, mas as despesas começam
          quando a viagem virar <strong>planejada</strong>.
        </p>
      ) : null}
    </section>
  );
}
