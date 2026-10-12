import { useCallback, useEffect, useState } from "react";
import { api, ErroApi, type DetalheViagem, type DespesaApi, type SaldosApi } from "../services/api.ts";
import { ROTULO_DESPESA, ROTULO_ESTADO, formatarBRL, formatarData, hojeIso, paraCentavos } from "../services/formato.ts";

interface Props {
  viagemId: string;
  usuarioId: string;
  voltar: () => void;
}

type Aba = "visao" | "gastos" | "mais";

/** Dashboard da viagem: estado, participantes, gastos e acertos — tudo vindo da API real. */
export function Viagem({ viagemId, usuarioId, voltar }: Props): React.ReactElement {
  const [aba, setAba] = useState<Aba>("visao");
  const [detalhe, setDetalhe] = useState<DetalheViagem | null>(null);
  const [despesas, setDespesas] = useState<DespesaApi[]>([]);
  const [saldos, setSaldos] = useState<SaldosApi | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [impactos, setImpactos] = useState<string[] | null>(null);
  const [conviteEmail, setConviteEmail] = useState("");
  const [linkConvite, setLinkConvite] = useState<string | null>(null);
  const [novaDespesa, setNovaDespesa] = useState({
    descricao: "",
    valor: "",
    pagadorId: "",
    tipo: "compartilhada" as "pessoal" | "compartilhada",
  });
  const [motivoContestacao, setMotivoContestacao] = useState<{ id: string; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async (): Promise<void> => {
    setErro(null);
    try {
      const [d, s] = await Promise.all([api.detalheViagem(viagemId), api.saldos(viagemId)]);
      setDetalhe(d);
      setSaldos(s);
      if (d.permissoes.registrarDespesa.permitido || d.participantes.length > 0) {
        const lista = await api.listarDespesas(viagemId);
        setDespesas(lista.despesas);
      }
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Não foi possível carregar a viagem.");
    }
  }, [viagemId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  async function executar(acao: () => Promise<void>): Promise<void> {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      await recarregar();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Não foi possível concluir a ação.");
    } finally {
      setOcupado(false);
    }
  }

  if (!detalhe) {
    return (
      <main className="app">
        {erro ? <div className="aviso erro" role="alert">{erro}</div> : null}
        <div className="carregando"><span className="pulso" /> Carregando a viagem…</div>
        <button onClick={voltar}>Voltar</button>
      </main>
    );
  }

  const { viagem, permissoes, participantes, sugestao, pendencias } = detalhe;
  const nomePorId = new Map(participantes.map((p) => [p.usuario_id, p.nome]));
  const podeRegistrar = permissoes.registrarDespesa.permitido;
  const eu = participantes.find((p) => p.usuario_id === usuarioId);

  return (
    <main className="app">
      <button className="sutil" onClick={voltar}>← Minhas viagens</button>

      <div className="linha entre" style={{ marginTop: 8 }}>
        <div>
          <h1>{viagem.nome}</h1>
          <p>{viagem.destino || "sem destino"} · {formatarData(viagem.data_inicio)} a {formatarData(viagem.data_fim)}</p>
        </div>
        <span className={`etiqueta estado-${viagem.estado}`}>{viagem.rotuloEstado ?? ROTULO_ESTADO[viagem.estado]}</span>
      </div>

      {erro ? <div className="aviso erro" role="alert">{erro}</div> : null}
      {aviso ? <div className="aviso ok">{aviso}</div> : null}

      {sugestao ? (
        <div className="aviso atencao">
          <strong>Sugestão:</strong> {sugestao.motivo}
          <div className="acoes">
            <button
              className="principal"
              disabled={ocupado}
              onClick={() => executar(async () => {
                const resultado = await api.transicionar(viagemId, sugestao.sugestao);
                setAviso(`Viagem agora está: ${resultado.rotuloEstado}. Registramos quem confirmou.`);
              })}
            >
              Confirmar “{ROTULO_ESTADO[sugestao.sugestao] ?? sugestao.sugestao}”
            </button>
          </div>
        </div>
      ) : null}

      {aba === "visao" ? (
        <>
          <section className="cartao destaque">
            <h2>Organização</h2>
            <p>
              Você é <strong>{detalhe.papel === "organizador" ? "organizador(a)" : "participante"}</strong>.
              {pendencias.despesas > 0 ? ` ${pendencias.despesas} despesa(s) aguardando confirmação.` : " Nenhuma pendência financeira."}
            </p>
            {permissoes.transicoesPermitidas.length > 0 ? (
              <div className="acoes">
                {permissoes.transicoesPermitidas.map((estado) => (
                  <button
                    key={estado}
                    disabled={ocupado}
                    onClick={() => {
                      if (estado === "cancelada") {
                        void api.impactosCancelamento(viagemId).then((r) => setImpactos(r.impactos)).catch(() => setErro("Não foi possível ver os impactos."));
                        return;
                      }
                      void executar(async () => {
                        const resultado = await api.transicionar(viagemId, estado);
                        setAviso(`Viagem agora está: ${resultado.rotuloEstado}.`);
                      });
                    }}
                  >
                    Mover para {ROTULO_ESTADO[estado] ?? estado}
                  </button>
                ))}
              </div>
            ) : (
              <p><small className="suave">{permissoes.editar.motivo}</small></p>
            )}
          </section>

          {impactos ? (
            <div className="cartao">
              <h2>Antes de cancelar, veja os impactos</h2>
              <ul>
                {impactos.map((impacto) => (<li key={impacto}>{impacto}</li>))}
              </ul>
              <div className="acoes">
                <button className="perigo" disabled={ocupado} onClick={() => void executar(async () => {
                  await api.transicionar(viagemId, "cancelada");
                  setImpactos(null);
                  setAviso("Viagem cancelada. Registros preservados e pendências continuam acessíveis.");
                })}>
                  Confirmar cancelamento
                </button>
                <button className="sutil" onClick={() => setImpactos(null)}>Voltar atrás</button>
              </div>
            </div>
          ) : null}

          <section className="cartao">
            <h2>Participantes</h2>
            {participantes.map((pessoa) => (
              <div className="linha" key={pessoa.usuario_id} style={{ marginBottom: 6 }}>
                <span>
                  {pessoa.nome} {pessoa.usuario_id === usuarioId ? "(você)" : ""}
                </span>
                <span className="etiqueta">
                  {pessoa.papel === "organizador" ? "organizador" : "participante"}
                  {pessoa.estado !== "ativo" ? ` · ${pessoa.estado}` : ""}
                </span>
              </div>
            ))}
          </section>

          <section className="cartao">
            <h2>Convidar pessoa</h2>
            {permissoes.convidar.permitido ? (
              <>
                <label htmlFor="email-convite">E-mail de quem vai participar</label>
                <input id="email-convite" type="email" value={conviteEmail} onChange={(e) => setConviteEmail(e.target.value)} />
                <div className="acoes">
                  <button className="principal" disabled={ocupado || !conviteEmail.includes("@")} onClick={() => void executar(async () => {
                    const convite = await api.criarConvite(viagemId, conviteEmail);
                    setLinkConvite(convite.token);
                    setConviteEmail("");
                    setAviso("Convite criado. Envie o link para a pessoa: ela entra com o mesmo e-mail para aceitar.");
                  })}>
                    Gerar convite
                  </button>
                </div>
                {linkConvite ? (
                  <div className="aviso info">
                    Link do convite (aparece só uma vez): <code>{`${location.origin}/?convite=${linkConvite}`}</code>
                    <div className="acoes">
                      <button onClick={() => void navigator.clipboard?.writeText(`${location.origin}/?convite=${linkConvite}`)}>Copiar link</button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p><small className="suave">{permissoes.convidar.motivo}</small></p>
            )}
          </section>
        </>
      ) : null}

      {aba === "gastos" ? (
        <>
          <section className="cartao destaque">
            <h2>Resumo</h2>
            <div className="linha"><span>Confirmado (oficial)</span><strong>{formatarBRL(saldos?.realizado ?? "0")}</strong></div>
            <div className="linha"><span>Aguardando confirmação</span><strong>{formatarBRL(saldos?.comprometido ?? "0")}</strong></div>
            <p><small className="suave">{saldos?.aviso}</small></p>
          </section>

          {saldos && saldos.saldos.length > 0 ? (
            <section className="cartao">
              <h2>Saldos</h2>
              {saldos.saldos.map((saldo) => (
                <div className="linha" key={saldo.participanteId}>
                  <span>{saldo.nome ?? "Participante"}</span>
                  <span className={BigInt(saldo.saldo) >= 0n ? "saldo-positivo" : "saldo-negativo"}>
                    {BigInt(saldo.saldo) > 0n ? "recebe " : BigInt(saldo.saldo) < 0n ? "deve " : "em dia "}
                    {formatarBRL(BigInt(saldo.saldo) < 0n ? -BigInt(saldo.saldo) : saldo.saldo)}
                  </span>
                </div>
              ))}
              {saldos.transferenciasSugeridas.length > 0 ? (
                <>
                  <h3 style={{ marginTop: 12 }}>Acertos sugeridos</h3>
                  {saldos.transferenciasSugeridas.map((sugestaoAcerto) => (
                    <p key={`${sugestaoAcerto.deId}-${sugestaoAcerto.paraId}-${sugestaoAcerto.valorCentavos}`}>
                      {sugestaoAcerto.deNome} → {sugestaoAcerto.paraNome}: <strong>{formatarBRL(sugestaoAcerto.valorCentavos)}</strong>
                    </p>
                  ))}
                  <div className="aviso atencao">Sugestão apenas: nada é transferido pelo app. Combine o Pix por fora e registre o acerto.</div>
                </>
              ) : null}
            </section>
          ) : null}

          {podeRegistrar ? (
            <form className="cartao" onSubmit={(evento) => {
              evento.preventDefault();
              void executar(async () => {
                const valorCentavos = paraCentavos(novaDespesa.valor);
                const criada = await api.criarDespesa(viagemId, {
                  tipo: novaDespesa.tipo,
                  valorCentavos,
                  data: hojeIso(),
                  descricao: novaDespesa.descricao,
                  pagadorId: novaDespesa.pagadorId || usuarioId,
                  participantes: participantes.filter((p) => p.estado === "ativo").map((p) => p.usuario_id),
                });
                setNovaDespesa({ descricao: "", valor: "", pagadorId: "", tipo: "compartilhada" });
                setAviso(`Despesa de ${formatarBRL(criada.valorCentavos)} registrada como pendente. Outra pessoa precisa confirmar.`);
              });
            }}>
              <h2>Nova despesa</h2>
              <label htmlFor="descricao">Descrição</label>
              <input id="descricao" value={novaDespesa.descricao} onChange={(e) => setNovaDespesa({ ...novaDespesa, descricao: e.target.value })} required minLength={2} />
              <label htmlFor="valor">Valor (ex.: 87,50)</label>
              <input id="valor" inputMode="decimal" value={novaDespesa.valor} onChange={(e) => setNovaDespesa({ ...novaDespesa, valor: e.target.value })} required />
              <label htmlFor="tipo">Tipo</label>
              <select id="tipo" value={novaDespesa.tipo} onChange={(e) => setNovaDespesa({ ...novaDespesa, tipo: e.target.value as "pessoal" | "compartilhada" })}>
                <option value="compartilhada">Compartilhada (divide entre o grupo)</option>
                <option value="pessoal">Pessoal (só minha)</option>
              </select>
              <label htmlFor="pagador">Quem pagou</label>
              <select id="pagador" value={novaDespesa.pagadorId || usuarioId} onChange={(e) => setNovaDespesa({ ...novaDespesa, pagadorId: e.target.value })}>
                {participantes.filter((p) => p.estado === "ativo").map((p) => (
                  <option key={p.usuario_id} value={p.usuario_id}>{p.nome}{p.usuario_id === usuarioId ? " (você)" : ""}</option>
                ))}
              </select>
              <div className="acoes">
                <button className="principal" type="submit" disabled={ocupado}>Registrar despesa</button>
              </div>
            </form>
          ) : (
            <div className="aviso info">{permissoes.registrarDespesa.motivo}</div>
          )}

          <section>
            <h2>Despesas</h2>
            {despesas.length === 0 ? <div className="cartao vazio"><p>Nenhuma despesa registrada ainda.</p></div> : null}
            {despesas.map((despesa) => {
              const sou = despesa.autorId === usuarioId;
              return (
                <article className="cartao" key={despesa.id}>
                  <div className="linha entre">
                    <div>
                      <h3>{despesa.descricao}</h3>
                      <p>
                        {formatarBRL(despesa.valorCentavos)} · pago por {nomePorId.get(despesa.pagadorId) ?? "alguém"} ·{" "}
                        {formatarData(despesa.data)} · {despesa.tipo === "pessoal" ? "pessoal" : "compartilhada"}
                      </p>
                      <p><small className="suave">{despesa.rateio.explicacao || `Lançado por ${nomePorId.get(despesa.autorId) ?? "alguém"}`}</small></p>
                    </div>
                    <span className={`etiqueta estado-${despesa.estado}`}>{ROTULO_DESPESA[despesa.estado]}</span>
                  </div>

                  {despesa.motivoContestacao ? <div className="aviso atencao">Contestação: {despesa.motivoContestacao}</div> : null}

                  {despesa.estado !== "confirmada" ? (
                    <div className="acoes">
                      <button
                        disabled={ocupado || sou}
                        title={sou ? "Quem lançou não confirma o próprio lançamento" : "Confirmar esta despesa"}
                        onClick={() => void executar(async () => {
                          await api.confirmarDespesa(viagemId, despesa.id);
                          setAviso("Despesa confirmada e incluída nos saldos oficiais.");
                        })}
                      >
                        Confirmar
                      </button>
                      {!sou ? (
                        <button
                          className="sutil"
                          disabled={ocupado}
                          onClick={() => setMotivoContestacao({ id: despesa.id, texto: motivoContestacao?.texto ?? "" })}
                        >
                          Contestar
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {motivoContestacao?.id === despesa.id ? (
                    <form onSubmit={(evento) => {
                      evento.preventDefault();
                      void executar(async () => {
                        await api.contestarDespesa(viagemId, despesa.id, motivoContestacao.texto);
                        setMotivoContestacao(null);
                        setAviso("Despesa contestada: segue visível e fora dos saldos oficiais até a resolução.");
                      });
                    }}>
                      <label htmlFor="motivo">Motivo da contestação</label>
                      <textarea
                        id="motivo"
                        value={motivoContestacao.texto}
                        onChange={(e) => setMotivoContestacao({ id: despesa.id, texto: e.target.value })}
                        rows={3}
                        required
                        minLength={5}
                      />
                      <div className="acoes">
                        <button className="principal" type="submit" disabled={ocupado}>Enviar contestação</button>
                        <button type="button" className="sutil" onClick={() => setMotivoContestacao(null)}>Cancelar</button>
                      </div>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </section>
        </>
      ) : null}

      {aba === "mais" ? (
        <>
          <section className="cartao">
            <h2>Ficha da viagem</h2>
            <div className="linha"><span>Estado</span><strong>{viagem.rotuloEstado ?? ROTULO_ESTADO[viagem.estado]}</strong></div>
            <div className="linha"><span>Fuso</span><span>{(viagem as unknown as { fuso_horario?: string }).fuso_horario ?? "America/Sao_Paulo"}</span></div>
            <div className="linha"><span>Versão dos dados</span><span>{viagem.versao}</span></div>
            <p><small className="suave">
              Cada alteração relevante é registrada com autor e horário. A data da viagem nunca muda o estado sozinha.
            </small></p>
          </section>

          <section className="cartao">
            <h2>Você</h2>
            <p>{eu?.nome ?? "participante"} · {detalhe.papel}</p>
            {eu?.papel !== "organizador" ? (
              <div className="acoes">
                <button
                  className="perigo"
                  disabled={ocupado}
                  onClick={() => void executar(async () => {
                    await fetch("/api/viagens/" + viagemId + "/sair", { method: "POST", credentials: "include" });
                    setAviso("Você saiu da viagem. O histórico permanece com o grupo.");
                    voltar();
                  })}
                >
                  Sair da viagem
                </button>
              </div>
            ) : (
              <p><small className="suave">Organizador(a) não sai sem passar a organização para outra pessoa.</small></p>
            )}
          </section>
        </>
      ) : null}

      <nav className="barra" aria-label="Navegação principal">
        <button aria-current={aba === "visao"} onClick={() => setAba("visao")}>Visão geral</button>
        <button aria-current={aba === "gastos"} onClick={() => setAba("gastos")}>Gastos</button>
        <button aria-current={aba === "mais"} onClick={() => setAba("mais")}>Mais</button>
      </nav>
    </main>
  );
}
