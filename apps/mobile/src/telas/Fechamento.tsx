/**
 * Fechamento e exportação (tela 21).
 *
 * O que esta tela **não** faz (decisões V1 §13):
 *  - não recalcula nada no cliente: totais, saldos e acertos são o que o servidor somou;
 *  - não diz que ninguém pagou nada: "acertos sugeridos" é sugestão, e a tela diz isso com todas as letras;
 *  - no app nativo não finge que baixou arquivo: mostra o texto para copiar e explica o porquê.
 */
import { useState } from "react";
import { campoCsv, type Atividade, type Reserva } from "@lia-go/domain";
import { api, ErroApi, type DespesaApi, type FechamentoApi } from "../services/api.ts";
import { formatarBRL } from "../services/formato.ts";
import { exportarArquivo, nomeDoArquivo } from "../services/exportacao.ts";
import { Platform } from "../services/plataforma.ts";

export interface CopiaLocalFechamento {
  destino: string | null;
  estado: string;
  despesas: readonly DespesaApi[];
  atividades: readonly Atividade[];
  reservas: readonly Reserva[];
}

interface Props {
  viagemId: string;
  /** Nome da viagem, só para compor o nome do arquivo. */
  nomeDaViagem: string;
  /** Dados já guardados neste aparelho para exportar mesmo sem internet. */
  copiaLocal?: CopiaLocalFechamento;
}

export function Fechamento({ viagemId, nomeDaViagem, copiaLocal }: Props): React.ReactElement {
  const [dados, setDados] = useState<FechamentoApi | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [paraCopiar, setParaCopiar] = useState<{ nome: string; conteudo: string } | null>(null);

  async function carregar(): Promise<void> {
    setErro(null);
    setCarregando(true);
    try {
      setDados(await api.fechamento(viagemId));
    } catch (falha) {
      setErro(
        falha instanceof ErroApi
          ? falha.message
          : "Não foi possível montar o fechamento agora. Ele é calculado no servidor — tente de novo com internet.",
      );
    } finally {
      setCarregando(false);
    }
  }

  function exportar(extensao: "txt" | "csv"): void {
    if (!dados) return;
    const nome = nomeDoArquivo(`lia-go-${nomeDaViagem}`, extensao);
    const conteudo = extensao === "csv" ? dados.csv : dados.texto;
    const resultado = exportarArquivo(nome, conteudo, extensao === "csv" ? "text/csv" : "text/plain");
    if (resultado.tipo === "baixado") {
      setAviso(`Arquivo ${nome} gerado no navegador.`);
      setParaCopiar(null);
    } else {
      setParaCopiar({ nome: resultado.nome, conteudo: resultado.conteudo });
      setAviso("Neste aparelho não existe download de arquivo: copie o texto abaixo e envie como quiser.");
    }
  }

  function exportarCopiaDoAparelho(extensao: "txt" | "csv"): void {
    if (!copiaLocal) return;
    const nome = nomeDoArquivo(`lia-go-${nomeDaViagem}-aparelho`, extensao);
    const conteudo =
      extensao === "csv"
        ? montarCsvDoAparelho(nomeDaViagem, copiaLocal)
        : montarTextoDoAparelho(nomeDaViagem, copiaLocal);
    const resultado = exportarArquivo(nome, conteudo, extensao === "csv" ? "text/csv" : "text/plain");
    if (resultado.tipo === "baixado") {
      setAviso(`Arquivo ${nome} gerado no navegador (cópia guardada neste aparelho).`);
      setParaCopiar(null);
    } else {
      setParaCopiar({ nome: resultado.nome, conteudo: resultado.conteudo });
      setAviso("Neste aparelho não existe download de arquivo: copie o texto abaixo e envie como quiser.");
    }
  }

  return (
    <section className="cartao" aria-labelledby="titulo-fechamento">
      <h2 id="titulo-fechamento">Fechamento da viagem</h2>
      <p className="suave pequeno">
        Para conferir juntos no fim da viagem: o que foi confirmado, quem deve quem e o que dá para exportar.
        Quem soma é o servidor — a tela só mostra.
      </p>

      {!dados ? (
        <>
          <div className="acoes">
            <button className="principal" disabled={carregando} onClick={() => void carregar()}>
              {carregando ? "Montando o fechamento…" : "Ver fechamento"}
            </button>
            <small className="suave">Precisa de conexão: é o servidor que fecha as contas.</small>
          </div>
          {copiaLocal ? (
            <div style={{ marginTop: 12 }}>
              <p className="suave pequeno">
                Mesmo sem internet, você pode exportar agora a cópia guardada neste aparelho (roteiro, reservas e
                despesas lançadas — sem confirmação atual do servidor):
              </p>
              <div className="acoes">
                <button className="sutil" onClick={() => exportarCopiaDoAparelho("txt")}>
                  Baixar cópia deste aparelho (.txt)
                </button>
                <button className="sutil" onClick={() => exportarCopiaDoAparelho("csv")}>
                  Baixar cópia deste aparelho (.csv)
                </button>
              </div>
            </div>
          ) : null}
          {paraCopiar ? (
            <>
              <label htmlFor="fechamento-texto">{paraCopiar.nome}</label>
              <textarea id="fechamento-texto" readOnly rows={10} value={paraCopiar.conteudo} />
              <div className="acoes">
                <button className="sutil" onClick={() => void navigator.clipboard?.writeText(paraCopiar.conteudo).then(() => setAviso("Texto copiado.")).catch(() => setAviso("Selecione o texto acima e copie."))}>
                  Copiar texto
                </button>
                <button className="sutil" onClick={() => setParaCopiar(null)}>
                  Fechar
                </button>
              </div>
            </>
          ) : null}
        </>
      ) : (
        <>
          <div className="linha entre">
            <span>{dados.viagem.nome}</span>
            <span className="suave pequeno">{dados.viagem.destino ?? "sem destino"}</span>
          </div>

          <div className="linha"><span>Gasto confirmado (oficial)</span><strong>{formatarBRL(dados.totalConfirmadoCentavos)}</strong></div>
          {BigInt(dados.totalAguardandoCentavos) > 0n ? (
            <div className="linha"><span>Aguardando confirmação</span><span>{formatarBRL(dados.totalAguardandoCentavos)}</span></div>
          ) : null}
          <div className="linha"><span>Previsto (planejamento)</span><span>{formatarBRL(dados.previstoCentavos)}</span></div>
          {dados.limiteCentavos !== null ? (
            <div className="linha"><span>Limite combinado</span><span>{formatarBRL(dados.limiteCentavos)}</span></div>
          ) : null}
          <p className="suave pequeno">
            {dados.linhas.filter((linha) => linha.estado === "confirmada").length} despesa(s) confirmada(s)
            {dados.despesasAbertas > 0 ? ` · ${dados.despesasAbertas} ainda em aberto` : ""}.
          </p>

          {dados.alertas.length > 0 ? (
            <ul className="lista-alertas">
              {dados.alertas.map((alerta) => (
                <li key={alerta}>{alerta}</li>
              ))}
            </ul>
          ) : null}

          <h3 style={{ marginTop: 12 }}>Saldo por pessoa</h3>
          {dados.saldos.length === 0 ? (
            <p className="suave pequeno">Sem despesas confirmadas: ninguém deve nada.</p>
          ) : (
            dados.saldos.map((saldo) => (
              <div className="linha" key={saldo.participanteId}>
                <span>{saldo.nome ?? "participante"}</span>
                <span className={BigInt(saldo.saldoCentavos) >= 0n ? "saldo-positivo" : "saldo-negativo"}>
                  {BigInt(saldo.saldoCentavos) > 0n ? "recebe " : BigInt(saldo.saldoCentavos) < 0n ? "deve " : "em dia "}
                  {formatarBRL(BigInt(saldo.saldoCentavos) < 0n ? -BigInt(saldo.saldoCentavos) : saldo.saldoCentavos)}
                </span>
              </div>
            ))
          )}

          {dados.acertosSugeridos.length > 0 ? (
            <>
              <h3 style={{ marginTop: 12 }}>Acertos sugeridos</h3>
              {dados.acertosSugeridos.map((acerto) => (
                <p key={`${acerto.deId}-${acerto.paraId}-${acerto.valorCentavos}`}>
                  {acerto.deNome ?? "participante"} → {acerto.paraNome ?? "participante"}:{" "}
                  <strong>{formatarBRL(acerto.valorCentavos)}</strong>
                </p>
              ))}
              <div className="aviso atencao">
                Sugestão de quem paga quem, calculada pelo servidor. Ninguém pagou nada até alguém registrar o acerto
                na aba Gastos e quem recebeu confirmar.
              </div>
            </>
          ) : (
            <p className="suave pequeno">Nada a acertar: as contas estão fechadas.</p>
          )}

          <h3 style={{ marginTop: 12 }}>Exportar</h3>
          <div className="acoes">
            <button className="principal" onClick={() => exportar("txt")}>
              Baixar resumo (.txt)
            </button>
            <button className="sutil" onClick={() => exportar("csv")}>
              Baixar planilha (.csv)
            </button>
            <button className="sutil" disabled={carregando} onClick={() => void carregar()}>
              Atualizar
            </button>
          </div>
          <p className="suave pequeno">
            O CSV abre no Excel, no Google Planilhas ou no Numbers: separador ponto e vírgula e valores com vírgula
            decimal. Campos que começam com =, +, - ou @ ganham apóstrofo para não virarem fórmula na sua planilha.
            {Platform.ehNativo() ? " No app do celular o arquivo não é baixado: o texto aparece para copiar." : ""}
          </p>

          {paraCopiar ? (
            <>
              <label htmlFor="fechamento-texto">{paraCopiar.nome}</label>
              <textarea id="fechamento-texto" readOnly rows={10} value={paraCopiar.conteudo} />
              <div className="acoes">
                <button className="sutil" onClick={() => void navigator.clipboard?.writeText(paraCopiar.conteudo).then(() => setAviso("Texto copiado.")).catch(() => setAviso("Selecione o texto acima e copie."))}>
                  Copiar texto
                </button>
                <button className="sutil" onClick={() => setParaCopiar(null)}>
                  Fechar
                </button>
              </div>
            </>
          ) : null}

          <p className="suave pequeno">
            Gerado {new Date(dados.geradoEm).toLocaleString("pt-BR")} · exportar não muda nada nos registros.
          </p>
        </>
      )}

      {aviso ? <div className="aviso ok">{aviso}</div> : null}
      {erro ? <div className="aviso erro">{erro}</div> : null}
    </section>
  );
}

function montarTextoDoAparelho(nomeDaViagem: string, copia: CopiaLocalFechamento): string {
  const linhas: string[] = [
    `Lia Go — cópia guardada neste aparelho de ${nomeDaViagem}${copia.destino ? ` (${copia.destino})` : ""}`,
    "ATENÇÃO: este arquivo foi gerado sem consultar o servidor. Ele mostra o que está guardado neste aparelho e não substitui o fechamento oficial.",
    `Estado conhecido no aparelho: ${copia.estado}`,
    "",
    `Atividades no roteiro (${copia.atividades.length}):`,
  ];
  if (copia.atividades.length === 0) {
    linhas.push("  (nenhuma atividade)");
  } else {
    for (const a of copia.atividades) {
      linhas.push(`  - ${a.dia}${a.hora ? ` ${a.hora}` : ""} · ${a.titulo} (${a.estado})`);
    }
  }
  linhas.push("");
  linhas.push(`Reservas (${copia.reservas.length}):`);
  if (copia.reservas.length === 0) {
    linhas.push("  (nenhuma reserva)");
  } else {
    for (const r of copia.reservas) {
      linhas.push(`  - ${r.titulo} · ${r.tipo} (${r.estado})`);
    }
  }
  linhas.push("");
  linhas.push(`Despesas conhecidas neste aparelho (${copia.despesas.length}):`);
  if (copia.despesas.length === 0) {
    linhas.push("  (nenhuma despesa)");
  } else {
    for (const d of copia.despesas) {
      linhas.push(`  - ${d.data} · ${d.descricao} · ${d.tipo} (${d.estado})`);
    }
  }
  return linhas.join("\n");
}

function montarCsvDoAparelho(nomeDaViagem: string, copia: CopiaLocalFechamento): string {
  const cabecalho = ["viagem", "origem", "data", "descricao", "tipo", "estado", "valor_centavos"];
  const registros = [cabecalho.map(campoCsv).join(";")];
  for (const d of copia.despesas) {
    registros.push(
      [
        campoCsv(nomeDaViagem),
        campoCsv("copia_deste_aparelho_sem_servidor"),
        campoCsv(d.data),
        campoCsv(d.descricao),
        campoCsv(d.tipo),
        campoCsv(d.estado),
        campoCsv(String(d.valorCentavos)),
      ].join(";"),
    );
  }
  return registros.join("\n");
}

