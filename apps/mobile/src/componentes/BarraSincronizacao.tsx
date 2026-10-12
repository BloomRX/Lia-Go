/**
 * Barra de sincronização: a pessoa sempre sabe onde o dado dela está.
 *
 * A regra vem da pesquisa de mercado registrada em docs/DECISIONS_AND_OPEN_QUESTIONS.md:
 * mostrar `aguardando envio → enviando → sincronizado` e **nunca** fingir sucesso. Fila com
 * problema aparece com o motivo e um botão para resolver.
 */
import { useState } from "react";
import { compararParaDecisao, type OperacaoPendente } from "@lia-go/sync";
import type { EstadoSincronizacao } from "../offline/sincronizador.ts";
import { formatarData } from "../services/formato.ts";

interface Props {
  estado: EstadoSincronizacao;
  aoSincronizar: () => void;
  aoRetentar: (id: string) => void;
  aoDescartar: (id: string) => void;
  aoResolverConflito: (id: string, escolha: "minha" | "servidor") => void;
}

export function BarraSincronizacao({ estado, aoSincronizar, aoRetentar, aoDescartar, aoResolverConflito }: Props): React.ReactElement {
  const [aberto, setAberto] = useState(false);
  const { resumo, online, sincronizando, ultimaSincronizacao } = estado;
  const temProblema = resumo.falhou > 0 || resumo.conflito > 0;

  const classe = temProblema ? "aviso atencao" : resumo.estado === "sincronizado" ? "aviso ok" : "aviso info";

  return (
    <div className={`barra-sincro ${classe}`} role="status" aria-live="polite">
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="ponto" data-estado={temProblema ? "problema" : resumo.estado} aria-hidden="true" />
        <strong>{online ? resumo.rotulo : "Sem conexão — trabalhando no aparelho"}</strong>
        {!online && resumo.total > 0 ? <span className="suave">({resumo.total} para enviar quando o sinal voltar)</span> : null}
        {online && resumo.estado === "sincronizado" && ultimaSincronizacao ? (
          <span className="suave">às {horaCurta(ultimaSincronizacao)}</span>
        ) : null}
        <span style={{ flex: 1 }} />
        {resumo.total > 0 ? (
          <button className="sutil" onClick={() => setAberto((valor) => !valor)}>
            {aberto ? "Ocultar" : "Ver alterações"}
          </button>
        ) : null}
        {online && resumo.estado !== "sincronizado" && !sincronizando ? (
          <button className="sutil" onClick={aoSincronizar}>
            Enviar agora
          </button>
        ) : null}
        {sincronizando ? <span className="suave">enviando…</span> : null}
      </div>

      {estado.erroUltimaPassada ? <p className="suave" style={{ margin: "6px 0 0" }}>{estado.erroUltimaPassada}</p> : null}

      {aberto ? (
        <ul className="lista-fila">
          {estado.fila.operacoes.map((item) => (
            <li key={item.id}>{renderizarItem(item, estado, { aoRetentar, aoDescartar, aoResolverConflito })}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function renderizarItem(
  item: OperacaoPendente,
  estado: EstadoSincronizacao,
  acoes: {
    aoRetentar: (id: string) => void;
    aoDescartar: (id: string) => void;
    aoResolverConflito: (id: string, escolha: "minha" | "servidor") => void;
  },
): React.ReactElement {
  const etiqueta =
    item.estado === "aguardando"
      ? onlineTexto(estado.online)
      : item.estado === "enviando"
        ? "enviando…"
        : item.estado === "conflito"
          ? "precisa da sua decisão"
          : "não pôde ser enviada";

  return (
    <div className="item-fila">
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <strong>{item.operacao.descricao}</strong>
        <span className="suave">{etiqueta}</span>
        <span style={{ flex: 1 }} />
        {item.estado === "falhou" || item.estado === "conflito" ? (
          <>
            <button className="sutil" onClick={() => acoes.aoRetentar(item.id)}>
              Tentar novamente
            </button>
            <button className="sutil" onClick={() => acoes.aoDescartar(item.id)}>
              Descartar
            </button>
          </>
        ) : null}
      </div>

      {item.erro ? <p className="suave" style={{ margin: "4px 0 0" }}>{item.erro.mensagem}</p> : null}

      {item.estado === "conflito" ? (
        <EscolhaDeConflito item={item} estado={estado} aoResolverConflito={acoes.aoResolverConflito} />
      ) : null}
    </div>
  );
}

/**
 * Conflito: mostramos as duas versões lado a lado, em português, e deixamos a pessoa decidir.
 * Dinheiro nunca é resolvido pelo app (regra do domínio e prática de mercado).
 */
function EscolhaDeConflito({
  item,
  estado,
  aoResolverConflito,
}: {
  item: OperacaoPendente;
  estado: EstadoSincronizacao;
  aoResolverConflito: (id: string, escolha: "minha" | "servidor") => void;
}): React.ReactElement {
  const local = extrairCorpo(item);
  const remoto = encontrarNoServidor(item, estado) ?? {};
  const alterados = Object.keys(local);
  const comparacoes = compararParaDecisao(local, remoto, alterados);

  return (
    <div className="conflito">
      <p style={{ margin: "6px 0" }}>
        Alguém alterou este item antes de você. Nada foi sobrescrito — escolha o que vale:
      </p>
      <table className="tabela-conflito">
        <thead>
          <tr>
            <th>Campo</th>
            <th>No seu aparelho</th>
            <th>No servidor</th>
          </tr>
        </thead>
        <tbody>
          {comparacoes.map((linha) => (
            <tr key={linha.campo}>
              <td>{linha.rotulo}</td>
              <td>{valorLegivel(linha.campo, linha.valorLocal)}</td>
              <td>{valorLegivel(linha.campo, linha.valorRemoto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => aoResolverConflito(item.id, "minha")}>Manter o que fiz</button>
        <button className="sutil" onClick={() => aoResolverConflito(item.id, "servidor")}>
          Usar a versão do servidor
        </button>
      </div>
    </div>
  );
}

function extrairCorpo(item: OperacaoPendente): Record<string, unknown> {
  const operacao = item.operacao;
  if (operacao.tipo === "criar_despesa" || operacao.tipo === "criar_viagem" || operacao.tipo === "criar_movimento") {
    return operacao.corpo;
  }
  if (operacao.tipo === "transicao_viagem") return { estado: operacao.para };
  if (operacao.tipo === "contestar_despesa" || operacao.tipo === "contestar_movimento") return { motivo: operacao.motivo };
  return {};
}

/** Última informação conhecida do item, só para a comparação ficar lado a lado. */
function encontrarNoServidor(item: OperacaoPendente, estado: EstadoSincronizacao): Record<string, unknown> | null {
  const { operacao } = item;
  if (operacao.tipo === "transicao_viagem") return estado.carga.viagem?.viagem ?? null;
  if (operacao.tipo === "confirmar_despesa" || operacao.tipo === "contestar_despesa") {
    return estado.carga.despesas.find((despesa) => despesa["id"] === operacao.despesaId) ?? null;
  }
  if (operacao.tipo === "criar_despesa") {
    // A despesa ainda não existe no servidor: a comparação mostra só a versão do aparelho.
    return null;
  }
  return null;
}

function valorLegivel(campo: string, valor: unknown): string {
  if (valor === undefined || valor === null) return "—";
  if (campo === "valorCentavos" && typeof valor === "string") {
    const centavos = Number(valor);
    return Number.isFinite(centavos) ? (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : valor;
  }
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return formatarData(valor);
  if (Array.isArray(valor)) return `${valor.length} pessoa(s)`;
  if (typeof valor === "object") return "rateio detalhado";
  return String(valor);
}

function horaCurta(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "" : data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function onlineTexto(online: boolean): string {
  return online ? "aguardando envio" : "guardada no aparelho";
}
