/**
 * Fechamento e exportação (tela 21).
 *
 * O que esta tela **não** faz (decisões V1 §13):
 *  - não recalcula nada no cliente: totais, saldos e acertos são o que o servidor somou;
 *  - não diz que ninguém pagou nada: "acertos sugeridos" é sugestão, e a tela diz isso com todas as letras;
 *  - no app nativo não finge que baixou arquivo: mostra o texto para copiar e explica o porquê.
 */
import { useState } from "react";
import { api, ErroApi, type FechamentoApi } from "../services/api.ts";
import { formatarBRL, formatarData } from "../services/formato.ts";
import { exportarArquivo, nomeDoArquivo } from "../services/exportacao.ts";
import { Platform } from "../services/plataforma.ts";

interface Props {
  viagemId: string;
  /** Nome da viagem, só para compor o nome do arquivo. */
  nomeDaViagem: string;
}

export function Fechamento({ viagemId, nomeDaViagem }: Props): React.ReactElement {
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

  return (
    <section className="cartao" aria-labelledby="titulo-fechamento">
      <h2 id="titulo-fechamento">Fechamento da viagem</h2>
      <p className="suave pequeno">
        Para conferir juntos no fim da viagem: o que foi confirmado, quem deve quem e o que dá para exportar.
        Quem soma é o servidor — a tela só mostra.
      </p>

      {!dados ? (
        <div className="acoes">
          <button className="principal" disabled={carregando} onClick={() => void carregar()}>
            {carregando ? "Montando o fechamento…" : "Ver fechamento"}
          </button>
          <small className="suave">Precisa de conexão: é o servidor que fecha as contas.</small>
        </div>
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
