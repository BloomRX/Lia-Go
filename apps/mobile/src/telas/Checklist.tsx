/**
 * Checklist da viagem (tela 15).
 *
 * Regras que esta tela respeita (`packages/domain/src/checklist.ts`):
 *  - **prazo não conclui nada**: atraso é rótulo de leitura, quem conclui é uma pessoa;
 *  - concluir registra quem e quando; reabrir exige motivo (é o que explica o item voltar);
 *  - item novo entra na **fila do aparelho**: vale na hora e sobe quando houver rede;
 *  - a ordem de leitura é do domínio (atrasado → prazo mais próximo → sem prazo → feito).
 */
import { useMemo, useState } from "react";
import {
  CATEGORIAS_CHECKLIST,
  ROTULO_CATEGORIA_CHECKLIST,
  concluirItem,
  criarItemChecklist,
  itemAtrasado,
  itemParaHoje,
  ordenarChecklist,
  reabrirItem,
  resumirChecklist,
  type CategoriaChecklist,
  type ItemChecklist,
} from "@lia-go/domain";
import type { Sincronizador } from "../offline/sincronizador.ts";
import { hojeIso } from "../services/formato.ts";

/** Id local para validação no domínio (o servidor gera o definitivo quando o item sobe). */
function idLocal(): string {
  const gerador = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return gerador?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface Props {
  viagemId: string;
  usuarioId: string;
  sincronizador: Sincronizador;
  itens: ItemChecklist[];
  participantes: { usuario_id: string; nome: string; estado: string }[];
  permissoes: {
    criarItemChecklist?: { permitido?: boolean; motivo?: string };
    concluirItemChecklist?: { permitido?: boolean; motivo?: string };
  };
}

export function Checklist({ viagemId, usuarioId, sincronizador, itens, participantes, permissoes }: Props): React.ReactElement {
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState<CategoriaChecklist>("outro");
  const [responsavelId, setResponsavelId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [reabrindo, setReabrindo] = useState<{ itemId: string; motivo: string } | null>(null);

  const hoje = hojeIso();
  const lista = useMemo(() => ordenarChecklist(itens, hoje), [itens, hoje]);
  const resumo = useMemo(() => resumirChecklist(itens, hoje), [itens, hoje]);
  const podeCriar = permissoes.criarItemChecklist?.permitido !== false;
  const podeConcluir = permissoes.concluirItemChecklist?.permitido !== false;

  const pessoas = useMemo(
    () => participantes.filter((pessoa) => pessoa.estado === "ativo"),
    [participantes],
  );

  function nomeDe(usuarioId: string | null): string {
    if (usuarioId === null) return "sem responsável";
    return pessoas.find((pessoa) => pessoa.usuario_id === usuarioId)?.nome ?? "participante";
  }

  async function enfileirar(operacao: Parameters<Sincronizador["enfileirar"]>[0], mensagem: string): Promise<void> {
    setErro(null);
    await sincronizador.enfileirar(operacao);
    setAviso(sincronizador.obter().online ? mensagem : `${mensagem} Ficou guardado no aparelho e sobe quando o sinal voltar.`);
  }

  async function criar(): Promise<void> {
    setErro(null);
    setAviso(null);
    let entrada: ItemChecklist;
    try {
      // A validação é do domínio: as mesmas regras que o servidor aplica, com a mesma mensagem.
      entrada = criarItemChecklist({
        // Id local só para validar no domínio; o servidor gera o id de verdade quando o item subir.
        id: idLocal(),
        viagemId,
        autorId: usuarioId,
        titulo,
        categoria,
        responsavelId: responsavelId === "" ? null : responsavelId,
        prazo: prazo === "" ? null : prazo,
      });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível criar o item.");
      return;
    }
    await enfileirar(
      {
        tipo: "criar_item_checklist",
        viagemId,
        corpo: {
          titulo: entrada.titulo,
          categoria: entrada.categoria,
          responsavelId: entrada.responsavelId,
          prazo: entrada.prazo,
        },
        descricao: `Checklist: ${entrada.titulo}`,
      },
      "Item adicionado ao checklist.",
    );
    setTitulo("");
    setCategoria("outro");
    setResponsavelId("");
    setPrazo("");
    setFormularioAberto(false);
  }

  async function concluir(item: ItemChecklist): Promise<void> {
    setErro(null);
    try {
      // Mesma regra do servidor antes de enfileirar (item já feito não conclui de novo).
      concluirItem(item, { porId: usuarioId });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível concluir o item.");
      return;
    }
    await enfileirar(
      {
        tipo: "concluir_item_checklist",
        viagemId,
        itemId: item.id,
        versao: item.versao,
        descricao: `Checklist: ${item.titulo} concluído`,
      },
      "Item concluído. Fica registrado quem marcou e quando.",
    );
  }

  async function reabrir(): Promise<void> {
    if (!reabrindo) return;
    const item = itens.find((candidato) => candidato.id === reabrindo.itemId);
    if (!item) return;
    setErro(null);
    try {
      reabrirItem(item, { porId: usuarioId, motivo: reabrindo.motivo });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Informe o motivo da reabertura.");
      return;
    }
    await enfileirar(
      {
        tipo: "reabrir_item_checklist",
        viagemId,
        itemId: item.id,
        motivo: reabrindo.motivo.trim(),
        versao: item.versao,
        descricao: `Checklist: ${item.titulo} reaberto`,
      },
      "Item reaberto com o motivo registrado.",
    );
    setReabrindo(null);
  }

  return (
    <section className="cartao" aria-labelledby="titulo-checklist">
      <div className="linha entre">
        <h2 id="titulo-checklist">Checklist</h2>
        {podeCriar ? (
          <button className="sutil" onClick={() => setFormularioAberto((aberto) => !aberto)}>
            {formularioAberto ? "Fechar" : "Novo item"}
          </button>
        ) : null}
      </div>
      <p className="suave pequeno">{resumo.resumo}</p>

      {formularioAberto ? (
        <>
          <label htmlFor="checklist-titulo">O que precisa acontecer</label>
          <input
            id="checklist-titulo"
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            placeholder="Ex.: levar o passaporte"
          />
          <label htmlFor="checklist-categoria">Categoria</label>
          <select id="checklist-categoria" value={categoria} onChange={(evento) => setCategoria(evento.target.value as CategoriaChecklist)}>
            {CATEGORIAS_CHECKLIST.map((valor) => (
              <option key={valor} value={valor}>
                {ROTULO_CATEGORIA_CHECKLIST[valor]}
              </option>
            ))}
          </select>
          <label htmlFor="checklist-responsavel">Quem cuida disso (opcional)</label>
          <select id="checklist-responsavel" value={responsavelId} onChange={(evento) => setResponsavelId(evento.target.value)}>
            <option value="">sem responsável</option>
            {pessoas.map((pessoa) => (
              <option key={pessoa.usuario_id} value={pessoa.usuario_id}>
                {pessoa.nome}
              </option>
            ))}
          </select>
          <label htmlFor="checklist-prazo">Prazo (opcional)</label>
          <input id="checklist-prazo" type="date" value={prazo} onChange={(evento) => setPrazo(evento.target.value)} />
          <p className="suave pequeno">
            O prazo é só um aviso de leitura: quando a data passa, o item continua em aberto — quem conclui é uma
            pessoa, não o calendário.
          </p>
          <div className="acoes">
            <button className="principal" disabled={titulo.trim().length < 3} onClick={() => void criar()}>
              Adicionar item
            </button>
          </div>
        </>
      ) : null}

      {lista.length === 0 ? (
        <p>Nada no checklist ainda. O que não pode ser esquecido entra aqui.</p>
      ) : (
        <ul className="lista-checklist">
          {lista.map((item) => {
            const feito = item.estado === "feito";
            const atrasado = itemAtrasado(item, hoje);
            const paraHoje = itemParaHoje(item, hoje);
            return (
              <li key={item.id} className={feito ? "item-feito" : atrasado ? "item-atrasado" : undefined}>
                <div className="linha entre">
                  <span>
                    <strong>{item.titulo}</strong>
                    <br />
                    <small className="suave">
                      {ROTULO_CATEGORIA_CHECKLIST[item.categoria]} · {nomeDe(item.responsavelId)}
                      {item.prazo !== null ? ` · prazo ${item.prazo.split("-").reverse().join("/")}` : " · sem prazo"}
                      {atrasado ? " · atrasado" : paraHoje ? " · para hoje" : ""}
                    </small>
                  </span>
                  <span className={`etiqueta ${feito ? "estado-concluida" : atrasado ? "estado-pendente" : "estado-planejada"}`}>
                    {feito ? "Feito" : atrasado ? "Atrasado" : "Em aberto"}
                  </span>
                </div>
                {feito ? (
                  <>
                    <p className="suave pequeno">
                      Concluído por {nomeDe(item.feitoPor)}
                      {item.feitoEm ? ` em ${new Date(item.feitoEm).toLocaleString("pt-BR")}` : ""}.
                    </p>
                    <button className="sutil" onClick={() => setReabrindo({ itemId: item.id, motivo: "" })}>
                      Reabrir item
                    </button>
                  </>
                ) : podeConcluir ? (
                  <div className="acoes">
                    <button className="principal compacto" onClick={() => void concluir(item)}>
                      Marcar como feito
                    </button>
                  </div>
                ) : (
                  <p className="suave pequeno">{permissoes.concluirItemChecklist?.motivo}</p>
                )}

                {reabrindo?.itemId === item.id ? (
                  <>
                    <label htmlFor={`checklist-reabrir-${item.id}`}>Motivo da reabertura (mínimo 5 caracteres)</label>
                    <input
                      id={`checklist-reabrir-${item.id}`}
                      value={reabrindo.motivo}
                      onChange={(evento) => setReabrindo({ itemId: item.id, motivo: evento.target.value })}
                    />
                    <div className="acoes">
                      <button className="principal compacto" onClick={() => void reabrir()}>
                        Reabrir
                      </button>
                      <button className="sutil" onClick={() => setReabrindo(null)}>
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {!podeCriar ? <p className="suave pequeno">{permissoes.criarItemChecklist?.motivo}</p> : null}
      {aviso ? <div className="aviso ok">{aviso}</div> : null}
      {erro ? <div className="aviso erro">{erro}</div> : null}
    </section>
  );
}
