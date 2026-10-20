import { useEffect, useState } from "react";
// Nomes com prefixo: `Map` colidiria com o `Map` do JavaScript usado nesta tela.
import { Ellipsis as IconeMais, Home as IconeVisao, Map as IconeRoteiro, Wallet as IconeGastos } from "lucide-react";
import { Roteiro } from "./Roteiro.tsx";
import { api, ErroApi, type DespesaApi, type MovimentoApi, type SaldosApi } from "../services/api.ts";
import {
  ROTULO_DESPESA,
  ROTULO_ESTADO,
  formatarBRL,
  formatarData,
  hojeIso,
  horaDoAparelho,
  paraCentavos,
} from "../services/formato.ts";
import type { Sincronizador } from "../offline/sincronizador.ts";
import { Platform } from "../services/plataforma.ts";
import { Reservas } from "./Reservas.tsx";
import { Orcamento } from "./Orcamento.tsx";
import { Checklist } from "./Checklist.tsx";
import { Configuracoes } from "./Configuracoes.tsx";
import { Documentos } from "./Documentos.tsx";
import { Fechamento } from "./Fechamento.tsx";
import { impactosDeCancelamento, resumirOrcamentoDoRoteiro } from "@lia-go/domain";
import {
  atividadesDoDominio,
  checklistDoDominio,
  dadosDaViagemAberta,
  documentosDoDominio,
  pode,
  proximoCompromisso,
  quandoDoCompromisso,
} from "../services/viagem-local.ts";
import { comoReserva } from "../services/reserva-cache.ts";
import { formatarDiaCurto, hojeIso as hojeDoAparelho } from "../services/formato.ts";

/**
 * Imagem oficial da Lia: referência `assets/references/lia-character-hero.png`, comprimida e servida
 * de `apps/mobile/public/lia-hero.jpg`.
 *
 * Fica em `public/` de propósito: o Vite (e o Capacitor) entregam esse arquivo como está, sem passar
 * pelo empacotador. Assim a imagem não vira import de módulo — que exigia um plugin só nos testes de
 * interface e era justamente o ponto frágil entre Windows e Linux.
 */
const HERO_DA_LIA = "/lia-hero.jpg";

interface Props {
  viagemId: string;
  usuarioId: string;
  voltar: () => void;
  /** Aba em que a viagem abre (a central de notificações leva direto ao assunto da notificação). */
  abaInicial?: Aba;
  abrirNotificacoes?: () => void;
  sincronizador: Sincronizador;
  /** A atividade abre em tela própria (diretriz §2.1); quem cuida disso é o App. */
  abrirAtividade: (atividadeId: string) => void;
}

type Aba = "visao" | "roteiro" | "gastos" | "mais";

interface Participante {
  usuario_id: string;
  nome: string;
  papel: string;
  estado: string;
}

/**
 * Tela da viagem. Lê do aparelho primeiro (funciona sem sinal) e escreve pela fila:
 * o que a pessoa faz aqui vale na hora e sobe para o servidor quando houver rede.
 * Saldos sempre vêm do servidor — o app nunca calcula dinheiro oficial.
 */
export function Viagem({
  viagemId,
  usuarioId,
  voltar,
  sincronizador,
  abrirAtividade,
  abaInicial,
  abrirNotificacoes,
}: Props): React.ReactElement {
  // A aba inicial vem de fora quando a pessoa chegou aqui por uma notificação (§6).
  const [aba, setAba] = useState<Aba>(abaInicial ?? "visao");
  const [estado, setEstado] = useState(sincronizador.obter());
  const [saldos, setSaldos] = useState<SaldosApi | null>(null);
  const [saldosEm, setSaldosEm] = useState<string | null>(null);
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
  const [acerto, setAcerto] = useState({ deId: "", paraId: "", valor: "" });

  useEffect(() => sincronizador.assinar(setEstado), [sincronizador]);

  useEffect(() => {
    void sincronizador.abrirViagem(viagemId);
    return () => {
      void sincronizador.abrirViagem(null);
    };
  }, [sincronizador, viagemId]);

  useEffect(() => {
    void sincronizador.sincronizarAgora().catch(() => {
      /* sem rede: mostramos o que já está no aparelho e dizemos quando foi atualizado */
    });
  }, [sincronizador, viagemId]);

  // Saldos: sempre do servidor; guardados para mostrar a última informação conhecida sem rede.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const guardado = await sincronizador.lerSaldos(viagemId);
      if (guardado && !cancelado) {
        setSaldos(guardado.saldos);
        setSaldosEm(guardado.em);
      }
      if (!sincronizador.obter().online) return;
      try {
        const atual = await api.saldos(viagemId);
        if (cancelado) return;
        setSaldos(atual);
        setSaldosEm(new Date().toISOString());
        await sincronizador.guardarSaldos(viagemId, atual);
      } catch {
        /* mantém o último saldo conhecido */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [sincronizador, viagemId, estado.ultimaSincronizacao, estado.resumo.total]);

  // Só os dados **desta** viagem: enquanto a troca de viagem não termina, o cache pode ser o da
  // viagem anterior e mostrar isso seria mentir sobre a viagem aberta.
  const { detalhe, despesas, movimentos, reservas } = dadosDaViagemAberta(estado, viagemId);
  const itensDoChecklist = checklistDoDominio(estado, viagemId);
  const documentosDaViagem = documentosDoDominio(estado, viagemId);
  const viagem = detalhe?.viagem ?? null;
  const participantes = (detalhe?.participantes ?? []) as unknown as Participante[];
  const permissoes = detalhe?.permissoes as
    | {
        editar: { permitido: boolean; motivo?: string };
        cancelar: { permitido: boolean; motivo?: string };
        convidar: { permitido: boolean; motivo?: string };
        registrarDespesa: { permitido: boolean; motivo?: string };
        criarReserva?: { permitido?: boolean; motivo?: string };
        confirmarReserva?: { permitido?: boolean; motivo?: string };
        cancelarReserva?: { permitido?: boolean; motivo?: string };
        definirLimite?: { permitido?: boolean; motivo?: string };
        definirLimiteProprio?: { permitido?: boolean; motivo?: string };
        criarItemChecklist?: { permitido?: boolean; motivo?: string };
        concluirItemChecklist?: { permitido?: boolean; motivo?: string };
        criarDocumento?: { permitido?: boolean; motivo?: string };
        exportar?: { permitido?: boolean; motivo?: string };
        transicoesPermitidas: string[];
      }
    | undefined;
  const sugestao = detalhe?.sugestao as { sugestao: string; motivo: string } | null | undefined;
  const pendencias = detalhe?.pendencias as { despesas: number; convites: number } | undefined;

  // Orçamento do roteiro: mesmo cálculo do domínio, sobre as atividades **desta** viagem.
  const atividades = atividadesDoDominio(estado, viagemId);
  const orcamento = resumirOrcamentoDoRoteiro(atividades);
  const reservasDoDominio = reservas
    .map((item) => comoReserva(item as Record<string, unknown>))
    .filter((item): item is NonNullable<typeof item> => item !== null);
  // Destaque da Visão geral: o que vem a seguir no roteiro (referência `concept-03`).
  const proximo = proximoCompromisso(atividades, { dia: hojeDoAparelho(), hora: horaDoAparelho() });

  const nomePorId = new Map(participantes.map((pessoa) => [pessoa.usuario_id, pessoa.nome]));
  const ativos = participantes.filter((pessoa) => pessoa.estado === "ativo");
  const eu = participantes.find((pessoa) => pessoa.usuario_id === usuarioId);
  const podeRegistrar = pode(permissoes?.registrarDespesa);
  const sou = (despesa: DespesaApi) => despesa.autorId === usuarioId;
  const nome = (id: string) => nomePorId.get(id) ?? "alguém";

  if (!viagem) {
    return (
      <main className="app">
        {erro ? <div className="aviso erro" role="alert">{erro}</div> : null}
        <div className="carregando"><span className="pulso" /> Carregando a viagem…</div>
        <button onClick={voltar}>Voltar</button>
      </main>
    );
  }

  /** Toda escrita passa por aqui: enfileira e explica o que vai acontecer. */
  async function enfileirar(operacao: Parameters<Sincronizador["enfileirar"]>[0], mensagem: string): Promise<void> {
    setErro(null);
    await sincronizador.enfileirar(operacao);
    setAviso(estado.online ? mensagem : `${mensagem} Ficou guardado no aparelho e sobe quando o sinal voltar.`);
  }

  async function executarOnline(acao: () => Promise<void>, mensagem: string): Promise<void> {
    setErro(null);
    try {
      await acao();
      setAviso(mensagem);
      await sincronizador.sincronizarAgora();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Não foi possível concluir a ação.");
    }
  }

  return (
    <main className="app">
      <button className="sutil" onClick={voltar}>← Minhas viagens</button>

      <div className="linha entre" style={{ marginTop: 8 }}>
        <div>
          <h1>{viagem.nome as string}</h1>
          <p>
            {(viagem.destino as string) || "sem destino"} · {formatarData(viagem.data_inicio as string | null)} a{" "}
            {formatarData(viagem.data_fim as string | null)}
          </p>
        </div>
        <span className={`etiqueta estado-${viagem.estado as string}`}>
          {(viagem.rotuloEstado as string) ?? ROTULO_ESTADO[viagem.estado as string] ?? (viagem.estado as string)}
        </span>
      </div>

      {erro ? <div className="aviso erro" role="alert">{erro}</div> : null}
      {aviso ? <div className="aviso ok">{aviso}</div> : null}

      {sugestao && permissoes ? (
        <div className="aviso atencao">
          <strong>Sugestão:</strong> {sugestao.motivo}
          <div className="acoes">
            <button
              className="principal"
              onClick={() =>
                void enfileirar(
                  {
                    tipo: "transicao_viagem",
                    viagemId,
                    para: sugestao.sugestao,
                    versao: Number(viagem.versao),
                    descricao: `Viagem: ${ROTULO_ESTADO[sugestao.sugestao] ?? sugestao.sugestao}`,
                  },
                  `Confirmado: a viagem passa para ${ROTULO_ESTADO[sugestao.sugestao] ?? sugestao.sugestao}. Registramos quem confirmou.`,
                )
              }
            >
              Confirmar “{ROTULO_ESTADO[sugestao.sugestao] ?? sugestao.sugestao}”
            </button>
          </div>
        </div>
      ) : null}

      {aba === "visao" ? (
        <>
          <section className="hero-viagem cartao">
            <div className="hero-viagem-imagem">
              <img src={HERO_DA_LIA} alt="" aria-hidden="true" />
            </div>
            <div className="hero-viagem-texto">
              <p className="suave pequeno">Viagem ativa</p>
              <h2>{viagem.destino as string || "Sua próxima viagem"}</h2>
              <p className="suave pequeno">
                {formatarData(viagem.data_inicio as string | null)} a {formatarData(viagem.data_fim as string | null)} ·{" "}
                {ativos.length} {ativos.length === 1 ? "pessoa" : "pessoas"}
              </p>
              <span className={`etiqueta estado-${viagem.estado as string}`}>
                {(viagem.rotuloEstado as string) ?? ROTULO_ESTADO[viagem.estado as string] ?? (viagem.estado as string)}
              </span>
            </div>
          </section>

          <section className="cartao destaque" aria-labelledby="titulo-proximo">
            <h2 id="titulo-proximo">Próximo compromisso</h2>
            {proximo ? (
              <>
                <div className="linha entre">
                  <div>
                    <strong>{proximo.titulo}</strong>
                    <br />
                    <small className="suave">
                      {quandoDoCompromisso(proximo.dia, proximo.hora, hojeDoAparelho())}
                      {proximo.local ? ` · ${proximo.local}` : ""}
                    </small>
                  </div>
                  <span className="etiqueta estado-planejada">{formatarDiaCurto(proximo.dia).split(", ")[0]}</span>
                </div>
                <p className="suave pequeno">Ainda não aconteceu: nada aqui muda saldo nem confirma reserva.</p>
              </>
            ) : (
              <p className="suave pequeno">Nada marcado à frente no roteiro. Quando você adicionar algo, aparece aqui.</p>
            )}
          </section>

          <section className="cartao destaque">
            <h2>Organização</h2>
            <p>
              Você é <strong>{detalhe?.papel === "organizador" ? "organizador(a)" : "participante"}</strong>.
              {pendencias && pendencias.despesas > 0
                ? ` ${pendencias.despesas} despesa(s) aguardando confirmação.`
                : " Nenhuma pendência financeira."}
            </p>
            {permissoes && permissoes.transicoesPermitidas.length > 0 ? (
              <div className="acoes">
                {permissoes.transicoesPermitidas.map((destino) => (
                  <button
                    key={destino}
                    onClick={() => {
                      if (destino === "cancelada") {
                        void api
                          .impactosCancelamento(viagemId)
                          .then((r) => setImpactos(r.impactos))
                          .catch((falha) => {
                            if (falha instanceof ErroApi) {
                              setErro(falha.message);
                              return;
                            }
                            const despesasPendentes = despesas.filter(
                              (d) => d.estado === "pendente" || d.estado === "contestada",
                            ).length;
                            const reservasRegistradas = reservasDoDominio.filter((r) => r.estado !== "cancelada").length;
                            setImpactos([
                              ...impactosDeCancelamento({ despesasPendentes, reservasRegistradas }),
                              "Sem conexão agora: os impactos acima foram calculados com o que está guardado neste aparelho; o cancelamento entrará na fila para envio assim que houver internet.",
                            ]);
                          });
                        return;
                      }
                      void enfileirar(
                        {
                          tipo: "transicao_viagem",
                          viagemId,
                          para: destino,
                          versao: Number(viagem.versao),
                          descricao: `Viagem: ${ROTULO_ESTADO[destino] ?? destino}`,
                        },
                        `A viagem passa para ${ROTULO_ESTADO[destino] ?? destino}.`,
                      );
                    }}
                  >
                    Mover para {ROTULO_ESTADO[destino] ?? destino}
                  </button>
                ))}
              </div>
            ) : (
              <p><small className="suave">{permissoes?.editar?.motivo}</small></p>
            )}
          </section>

          {impactos ? (
            <div className="cartao">
              <h2>Antes de cancelar, veja os impactos</h2>
              <ul>
                {impactos.map((impacto) => (<li key={impacto}>{impacto}</li>))}
              </ul>
              <div className="acoes">
                <button
                  className="perigo"
                  onClick={() =>
                    void enfileirar(
                      {
                        tipo: "transicao_viagem",
                        viagemId,
                        para: "cancelada",
                        versao: Number(viagem.versao),
                        descricao: "Viagem: cancelada",
                      },
                      "Cancelamento registrado. Os registros continuam preservados e acessíveis.",
                    ).then(() => setImpactos(null))
                  }
                >
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
                <span>{pessoa.nome} {pessoa.usuario_id === usuarioId ? "(você)" : ""}</span>
                <span className="etiqueta">
                  {pessoa.papel === "organizador" ? "organizador" : "participante"}
                  {pessoa.estado !== "ativo" ? ` · ${pessoa.estado}` : ""}
                </span>
              </div>
            ))}
          </section>

          <section className="cartao">
            <h2>Convidar pessoa</h2>
            {pode(permissoes?.convidar) ? (
              <>
                <label htmlFor="email-convite">E-mail de quem vai participar</label>
                <input id="email-convite" type="email" value={conviteEmail} onChange={(e) => setConviteEmail(e.target.value)} />
                <div className="acoes">
                  <button
                    className="principal"
                    disabled={!conviteEmail.includes("@")}
                    onClick={() =>
                      void executarOnline(async () => {
                        const convite = await api.criarConvite(viagemId, conviteEmail);
                        setLinkConvite(convite.token);
                        setConviteEmail("");
                      }, "Convite criado. Envie o link: a pessoa entra com o mesmo e-mail para aceitar.")
                    }
                  >
                    Gerar convite
                  </button>
                </div>
                {linkConvite ? (
                  <div className="aviso info">
                    Link do convite (aparece só uma vez): <code>{`${location.origin}/?convite=${linkConvite}`}</code>
                    <div className="acoes">
                      <button onClick={() => void navigator.clipboard?.writeText(`${location.origin}/?convite=${linkConvite}`)}>
                        Copiar link
                      </button>
                    </div>
                  </div>
                ) : null}
                <p><small className="suave">Gerar convite precisa de internet: o token só existe no servidor.</small></p>
              </>
            ) : (
              <p><small className="suave">{permissoes?.convidar?.motivo}</small></p>
            )}
          </section>
        </>
      ) : null}

      {aba === "roteiro" ? (
        <Roteiro
          viagemId={viagemId}
          usuarioId={usuarioId}
          sincronizador={sincronizador}
          abrirAtividade={abrirAtividade}
          dataInicioViagem={(viagem.data_inicio as string | null) ?? null}
          dataFimViagem={(viagem.data_fim as string | null) ?? null}
          estadoViagem={viagem.estado as string}
        />
      ) : null}

      {aba === "gastos" ? (
        <>
          <section className="cartao destaque">
            <h2>Resumo</h2>
            <div className="linha"><span>Gasto confirmado (oficial)</span><strong>{formatarBRL(saldos?.realizado ?? "0")}</strong></div>
            <div className="linha"><span>Lançado, aguardando confirmação</span><strong>{formatarBRL(saldos?.comprometido ?? "0")}</strong></div>
            <p><small className="suave">
              {saldos?.aviso}
              {saldosEm ? ` · Última atualização do servidor: ${new Date(saldosEm).toLocaleString("pt-BR")}.` : ""}
            </small></p>
          </section>

          {/* Orçamento com limite e barra (tela 9 / decisões V1 §7 e §8), na referência concept-03. */}
          <Orcamento
            viagemId={viagemId}
            usuarioId={usuarioId}
            sincronizador={sincronizador}
            atividades={atividades}
            reservas={reservasDoDominio}
            gastoConfirmadoCentavos={saldos?.realizado ?? null}
            aguardandoCentavos={saldos?.comprometido ?? null}
            saldosEm={saldosEm}
            ehOrganizador={detalhe?.papel === "organizador"}
            permissoes={permissoes ?? {}}
          />

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
                      <button
                        className="sutil"
                        style={{ marginLeft: 8 }}
                        onClick={() =>
                          setAcerto({
                            deId: sugestaoAcerto.deId,
                            paraId: sugestaoAcerto.paraId,
                            valor: (Number(sugestaoAcerto.valorCentavos) / 100).toFixed(2).replace(".", ","),
                          })
                        }
                      >
                        Registrar acerto
                      </button>
                    </p>
                  ))}
                  <div className="aviso atencao">Sugestão apenas: nada é transferido pelo app. Combine o Pix por fora e registre o acerto.</div>
                </>
              ) : null}
            </section>
          ) : null}

          <form
            className="cartao"
            onSubmit={(evento) => {
              evento.preventDefault();
              void enfileirar(
                {
                  tipo: "criar_movimento",
                  viagemId,
                  corpo: {
                    deId: acerto.deId,
                    paraId: acerto.paraId,
                    valorCentavos: paraCentavos(acerto.valor),
                  },
                  descricao: `Acerto: ${nome(acerto.deId)} paga ${nome(acerto.paraId)}`,
                },
                "Acerto registrado. Quem recebeu precisa confirmar para valer nos saldos.",
              ).then(() => setAcerto({ deId: "", paraId: "", valor: "" }));
            }}
          >
            <h2>Registrar acerto (pagamento combinado)</h2>
            <label htmlFor="acerto-de">Quem pagou</label>
            <select id="acerto-de" value={acerto.deId} onChange={(e) => setAcerto({ ...acerto, deId: e.target.value })} required>
              <option value="">escolha…</option>
              {ativos.map((pessoa) => (
                <option key={pessoa.usuario_id} value={pessoa.usuario_id}>{pessoa.nome}</option>
              ))}
            </select>
            <label htmlFor="acerto-para">Quem recebeu</label>
            <select id="acerto-para" value={acerto.paraId} onChange={(e) => setAcerto({ ...acerto, paraId: e.target.value })} required>
              <option value="">escolha…</option>
              {ativos.map((pessoa) => (
                <option key={pessoa.usuario_id} value={pessoa.usuario_id}>{pessoa.nome}</option>
              ))}
            </select>
            <label htmlFor="acerto-valor">Valor (ex.: 87,50)</label>
            <input id="acerto-valor" inputMode="decimal" value={acerto.valor} onChange={(e) => setAcerto({ ...acerto, valor: e.target.value })} required />
            <div className="acoes">
              <button className="principal" type="submit" disabled={!acerto.deId || !acerto.paraId || acerto.deId === acerto.paraId}>
                Registrar acerto
              </button>
            </div>
            <p><small className="suave">Nada é transferido pelo app: é o registro do que vocês combinaram fora dele.</small></p>
          </form>

          {podeRegistrar ? (
            <form
              className="cartao"
              onSubmit={(evento) => {
                evento.preventDefault();
                const valorCentavos = paraCentavos(novaDespesa.valor);
                const descricao = novaDespesa.descricao;
                void enfileirar(
                  {
                    tipo: "criar_despesa",
                    viagemId,
                    corpo: {
                      tipo: novaDespesa.tipo,
                      valorCentavos,
                      data: hojeIso(),
                      descricao,
                      pagadorId: novaDespesa.pagadorId || usuarioId,
                      participantes: ativos.map((pessoa) => pessoa.usuario_id),
                    },
                    descricao: `Despesa: ${descricao} (${formatarBRL(valorCentavos)})`,
                  },
                  "Despesa registrada como pendente. Outra pessoa precisa confirmar.",
                ).then(() => setNovaDespesa({ descricao: "", valor: "", pagadorId: "", tipo: "compartilhada" }));
              }}
            >
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
                {ativos.map((pessoa) => (
                  <option key={pessoa.usuario_id} value={pessoa.usuario_id}>{pessoa.nome}{pessoa.usuario_id === usuarioId ? " (você)" : ""}</option>
                ))}
              </select>
              <div className="acoes">
                <button className="principal" type="submit">Registrar despesa</button>
              </div>
              <p><small className="suave">Funciona sem internet: fica guardada no aparelho e sobe quando o sinal voltar.</small></p>
            </form>
          ) : (
            <div className="aviso info">{permissoes?.registrarDespesa?.motivo}</div>
          )}

          <section>
            <h2>Despesas</h2>
            {despesas.length === 0 ? <div className="cartao vazio"><p>Nenhuma despesa registrada ainda.</p></div> : null}
            {despesas.map((despesa) => (
              <article className="cartao" key={despesa.id}>
                <div className="linha entre">
                  <div>
                    <h3>{despesa.descricao}</h3>
                    <p>
                      {formatarBRL(despesa.valorCentavos)} · pago por {nome(despesa.pagadorId)} · {formatarData(despesa.data)} ·{" "}
                      {despesa.tipo === "pessoal" ? "pessoal" : "compartilhada"} ·{" "}
                      {despesa.estado === "confirmada"
                        ? "no saldo oficial"
                        : despesa.estado === "contestada"
                          ? "contestada (fora do saldo oficial)"
                          : "aguardando confirmação (fora do saldo oficial)"}
                    </p>
                    <p><small className="suave">{despesa.rateio.explicacao || `Lançado por ${nome(despesa.autorId)}`}</small></p>
                  </div>
                  <span className={`etiqueta estado-${despesa.estado}`}>{ROTULO_DESPESA[despesa.estado]}</span>
                </div>

                {despesa.motivoContestacao ? <div className="aviso atencao">Contestação: {despesa.motivoContestacao}</div> : null}

                {despesa.estado !== "confirmada" ? (
                  sou(despesa) ? (
                    <p><small className="suave">Quem lançou não confirma o próprio lançamento — outra pessoa da viagem precisa confirmar.</small></p>
                  ) : (
                    <div className="acoes">
                      <button
                        onClick={() =>
                          void enfileirar(
                            { tipo: "confirmar_despesa", viagemId, despesaId: despesa.id, descricao: `Confirmar: ${despesa.descricao}` },
                            "Despesa confirmada. Ela passa a contar nos saldos oficiais.",
                          )
                        }
                      >
                        Confirmar
                      </button>
                      <button className="sutil" onClick={() => setMotivoContestacao({ id: despesa.id, texto: motivoContestacao?.texto ?? "" })}>
                        Contestar
                      </button>
                    </div>
                  )
                ) : null}

                {motivoContestacao?.id === despesa.id ? (
                  <form
                    onSubmit={(evento) => {
                      evento.preventDefault();
                      const texto = motivoContestacao.texto;
                      void enfileirar(
                        { tipo: "contestar_despesa", viagemId, despesaId: despesa.id, motivo: texto, descricao: `Contestar: ${despesa.descricao}` },
                        "Despesa contestada: segue visível e fora dos saldos oficiais até a resolução.",
                      ).then(() => setMotivoContestacao(null));
                    }}
                  >
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
                      <button className="principal" type="submit">Enviar contestação</button>
                      <button type="button" className="sutil" onClick={() => setMotivoContestacao(null)}>Cancelar</button>
                    </div>
                  </form>
                ) : null}
              </article>
            ))}
          </section>

          <section>
            <h2>Acertos registrados</h2>
            {movimentos.length === 0 ? <div className="cartao vazio"><p>Nenhum acerto registrado.</p></div> : null}
            {movimentos.map((movimento) => (
              <article className="cartao" key={movimento.id}>
                <div className="linha entre">
                  <div>
                    <h3>{movimento.de_nome} → {movimento.para_nome}</h3>
                    <p>
                      {formatarBRL(movimento.valor_centavos)} · {formatarData(movimento.criado_em.slice(0, 10))} ·{" "}
                      {movimento.estado === "confirmado" ? "no saldo oficial" : "aguardando quem recebeu (fora do saldo oficial)"}
                    </p>
                  </div>
                  <span className={`etiqueta estado-${movimento.estado === "confirmado" ? "confirmada" : "pendente"}`}>
                    {movimento.estado === "confirmado" ? "Confirmado" : "Aguardando confirmação"}
                  </span>
                </div>
                {movimento.estado !== "confirmado" ? (
                  <div className="acoes">
                    {movimento.para_id === usuarioId ? (
                      <button
                        onClick={() =>
                          void enfileirar(
                            { tipo: "confirmar_movimento", viagemId, movimentoId: movimento.id, descricao: `Confirmar recebimento de ${formatarBRL(movimento.valor_centavos)}` },
                            "Recebimento confirmado: o acerto passa a contar nos saldos.",
                          )
                        }
                      >
                        Confirmar recebimento
                      </button>
                    ) : (
                      <p><small className="suave">Só quem recebeu confirma este acerto.</small></p>
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        </>
      ) : null}

      {aba === "mais" ? (
        <>
          {abrirNotificacoes ? (
            <section className="cartao">
              <div className="linha entre">
                <h2>Notificações</h2>
                <button className="sutil" onClick={abrirNotificacoes}>Abrir</button>
              </div>
              <p className="suave pequeno">
                O que espera alguém nesta viagem: despesa para confirmar, convite sem aceite, item atrasado,
                reserva sem valor e orçamento em atenção. Ler não resolve — cada item leva ao lugar onde se resolve.
              </p>
            </section>
          ) : null}

          <section className="cartao">
            <h2>Ficha da viagem</h2>
            <div className="linha"><span>Estado</span><strong>{(viagem.rotuloEstado as string) ?? ROTULO_ESTADO[viagem.estado as string]}</strong></div>
            <div className="linha"><span>Fuso</span><span>{(viagem.fuso_horario as string) ?? "America/Sao_Paulo"}</span></div>
            <div className="linha"><span>Versão dos dados</span><span>{viagem.versao as number}</span></div>
            <p><small className="suave">
              Cada alteração relevante é registrada com autor e horário. A data da viagem nunca muda o estado sozinha.
            </small></p>
          </section>

          <section className="cartao">
            <h2>Você</h2>
            <p>{eu?.nome ?? "participante"} · {detalhe?.papel}</p>
            {eu?.papel !== "organizador" ? (
              <div className="acoes">
                <button
                  className="perigo"
                  onClick={() =>
                    void executarOnline(async () => {
                      await api.sairDaViagem(viagemId);
                      voltar();
                    }, "Você saiu da viagem. O histórico permanece com o grupo.")
                  }
                >
                  Sair da viagem
                </button>
              </div>
            ) : (
              <p><small className="suave">Organizador(a) não sai sem passar a organização para outra pessoa.</small></p>
            )}
          </section>

          <Reservas
            viagemId={viagemId}
            usuarioId={usuarioId}
            sincronizador={sincronizador}
            reservas={reservas}
            permissoes={permissoes ?? {}}
          />

          <Checklist
            viagemId={viagemId}
            usuarioId={usuarioId}
            sincronizador={sincronizador}
            itens={itensDoChecklist}
            participantes={participantes.map((pessoa) => ({ usuario_id: pessoa.usuario_id, nome: pessoa.nome, estado: pessoa.estado }))}
            permissoes={permissoes ?? {}}
          />

          <Documentos
            viagemId={viagemId}
            usuarioId={usuarioId}
            sincronizador={sincronizador}
            documentos={documentosDaViagem}
            participantes={participantes.map((pessoa) => ({ usuario_id: pessoa.usuario_id, nome: pessoa.nome, estado: pessoa.estado }))}
            ehOrganizador={detalhe?.papel === "organizador"}
            avisoDePrivacidade={null}
          />

          <Fechamento
            viagemId={viagemId}
            nomeDaViagem={String(viagem.nome ?? "viagem")}
            copiaLocal={{
              destino: viagem.destino === null || viagem.destino === undefined ? null : String(viagem.destino),
              estado: String(viagem.estado ?? "planejada"),
              despesas,
              atividades,
              reservas: reservasDoDominio,
            }}
          />

          <Configuracoes
            sincronizador={sincronizador}
            armazenamento={estado.armazenamento}
            alteracoesNaFila={estado.resumo.total}
            aoLimparDados={() => {
              setAviso("Dados locais apagados. O app vai baixar de novo quando você usar com internet.");
              voltar();
            }}
          />
        </>
      ) : null}

      {/*
        Barra inferior da referência (`assets/references/concept-02-roteiro.png`): ícone **com**
        rótulo. O ícone é decorativo (`aria-hidden`) — quem informa o destino é o texto, e o estado
        ativo continua sendo `aria-current`, não a cor. Cada alvo tem 48 px de altura.
      */}
      <nav className="barra" aria-label="Navegação principal">
        <button aria-current={aba === "visao"} onClick={() => setAba("visao")}>
          <IconeVisao size={22} aria-hidden="true" />
          <span>Visão geral</span>
        </button>
        <button aria-current={aba === "roteiro"} onClick={() => setAba("roteiro")}>
          <IconeRoteiro size={22} aria-hidden="true" />
          <span>Roteiro</span>
        </button>
        <button aria-current={aba === "gastos"} onClick={() => setAba("gastos")}>
          <IconeGastos size={22} aria-hidden="true" />
          <span>Gastos</span>
        </button>
        <button aria-current={aba === "mais"} onClick={() => setAba("mais")}>
          <IconeMais size={22} aria-hidden="true" />
          <span>Mais</span>
        </button>
      </nav>
    </main>
  );
}
