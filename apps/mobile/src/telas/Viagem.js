import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { api, ErroApi } from "../services/api.ts";
import { ROTULO_DESPESA, ROTULO_ESTADO, formatarBRL, formatarData, hojeIso, paraCentavos } from "../services/formato.ts";
/** Dashboard da viagem: estado, participantes, gastos e acertos — tudo vindo da API real. */
export function Viagem({ viagemId, usuarioId, voltar }) {
    const [aba, setAba] = useState("visao");
    const [detalhe, setDetalhe] = useState(null);
    const [despesas, setDespesas] = useState([]);
    const [saldos, setSaldos] = useState(null);
    const [erro, setErro] = useState(null);
    const [aviso, setAviso] = useState(null);
    const [impactos, setImpactos] = useState(null);
    const [conviteEmail, setConviteEmail] = useState("");
    const [linkConvite, setLinkConvite] = useState(null);
    const [novaDespesa, setNovaDespesa] = useState({
        descricao: "",
        valor: "",
        pagadorId: "",
        tipo: "compartilhada",
    });
    const [motivoContestacao, setMotivoContestacao] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const recarregar = useCallback(async () => {
        setErro(null);
        try {
            const [d, s] = await Promise.all([api.detalheViagem(viagemId), api.saldos(viagemId)]);
            setDetalhe(d);
            setSaldos(s);
            if (d.permissoes.registrarDespesa.permitido || d.participantes.length > 0) {
                const lista = await api.listarDespesas(viagemId);
                setDespesas(lista.despesas);
            }
        }
        catch (falha) {
            setErro(falha instanceof ErroApi ? falha.message : "Não foi possível carregar a viagem.");
        }
    }, [viagemId]);
    useEffect(() => {
        void recarregar();
    }, [recarregar]);
    async function executar(acao) {
        setOcupado(true);
        setErro(null);
        try {
            await acao();
            await recarregar();
        }
        catch (falha) {
            setErro(falha instanceof ErroApi ? falha.message : "Não foi possível concluir a ação.");
        }
        finally {
            setOcupado(false);
        }
    }
    if (!detalhe) {
        return (_jsxs("main", { className: "app", children: [erro ? _jsx("div", { className: "aviso erro", role: "alert", children: erro }) : null, _jsxs("div", { className: "carregando", children: [_jsx("span", { className: "pulso" }), " Carregando a viagem\u2026"] }), _jsx("button", { onClick: voltar, children: "Voltar" })] }));
    }
    const { viagem, permissoes, participantes, sugestao, pendencias } = detalhe;
    const nomePorId = new Map(participantes.map((p) => [p.usuario_id, p.nome]));
    const podeRegistrar = permissoes.registrarDespesa.permitido;
    const eu = participantes.find((p) => p.usuario_id === usuarioId);
    return (_jsxs("main", { className: "app", children: [_jsx("button", { className: "sutil", onClick: voltar, children: "\u2190 Minhas viagens" }), _jsxs("div", { className: "linha entre", style: { marginTop: 8 }, children: [_jsxs("div", { children: [_jsx("h1", { children: viagem.nome }), _jsxs("p", { children: [viagem.destino || "sem destino", " \u00B7 ", formatarData(viagem.data_inicio), " a ", formatarData(viagem.data_fim)] })] }), _jsx("span", { className: `etiqueta estado-${viagem.estado}`, children: viagem.rotuloEstado ?? ROTULO_ESTADO[viagem.estado] })] }), erro ? _jsx("div", { className: "aviso erro", role: "alert", children: erro }) : null, aviso ? _jsx("div", { className: "aviso ok", children: aviso }) : null, sugestao ? (_jsxs("div", { className: "aviso atencao", children: [_jsx("strong", { children: "Sugest\u00E3o:" }), " ", sugestao.motivo, _jsx("div", { className: "acoes", children: _jsxs("button", { className: "principal", disabled: ocupado, onClick: () => executar(async () => {
                                const resultado = await api.transicionar(viagemId, sugestao.sugestao);
                                setAviso(`Viagem agora está: ${resultado.rotuloEstado}. Registramos quem confirmou.`);
                            }), children: ["Confirmar \u201C", ROTULO_ESTADO[sugestao.sugestao] ?? sugestao.sugestao, "\u201D"] }) })] })) : null, aba === "visao" ? (_jsxs(_Fragment, { children: [_jsxs("section", { className: "cartao destaque", children: [_jsx("h2", { children: "Organiza\u00E7\u00E3o" }), _jsxs("p", { children: ["Voc\u00EA \u00E9 ", _jsx("strong", { children: detalhe.papel === "organizador" ? "organizador(a)" : "participante" }), ".", pendencias.despesas > 0 ? ` ${pendencias.despesas} despesa(s) aguardando confirmação.` : " Nenhuma pendência financeira."] }), permissoes.transicoesPermitidas.length > 0 ? (_jsx("div", { className: "acoes", children: permissoes.transicoesPermitidas.map((estado) => (_jsxs("button", { disabled: ocupado, onClick: () => {
                                        if (estado === "cancelada") {
                                            void api.impactosCancelamento(viagemId).then((r) => setImpactos(r.impactos)).catch(() => setErro("Não foi possível ver os impactos."));
                                            return;
                                        }
                                        void executar(async () => {
                                            const resultado = await api.transicionar(viagemId, estado);
                                            setAviso(`Viagem agora está: ${resultado.rotuloEstado}.`);
                                        });
                                    }, children: ["Mover para ", ROTULO_ESTADO[estado] ?? estado] }, estado))) })) : (_jsx("p", { children: _jsx("small", { className: "suave", children: permissoes.editar.motivo }) }))] }), impactos ? (_jsxs("div", { className: "cartao", children: [_jsx("h2", { children: "Antes de cancelar, veja os impactos" }), _jsx("ul", { children: impactos.map((impacto) => (_jsx("li", { children: impacto }, impacto))) }), _jsxs("div", { className: "acoes", children: [_jsx("button", { className: "perigo", disabled: ocupado, onClick: () => void executar(async () => {
                                            await api.transicionar(viagemId, "cancelada");
                                            setImpactos(null);
                                            setAviso("Viagem cancelada. Registros preservados e pendências continuam acessíveis.");
                                        }), children: "Confirmar cancelamento" }), _jsx("button", { className: "sutil", onClick: () => setImpactos(null), children: "Voltar atr\u00E1s" })] })] })) : null, _jsxs("section", { className: "cartao", children: [_jsx("h2", { children: "Participantes" }), participantes.map((pessoa) => (_jsxs("div", { className: "linha", style: { marginBottom: 6 }, children: [_jsxs("span", { children: [pessoa.nome, " ", pessoa.usuario_id === usuarioId ? "(você)" : ""] }), _jsxs("span", { className: "etiqueta", children: [pessoa.papel === "organizador" ? "organizador" : "participante", pessoa.estado !== "ativo" ? ` · ${pessoa.estado}` : ""] })] }, pessoa.usuario_id)))] }), _jsxs("section", { className: "cartao", children: [_jsx("h2", { children: "Convidar pessoa" }), permissoes.convidar.permitido ? (_jsxs(_Fragment, { children: [_jsx("label", { htmlFor: "email-convite", children: "E-mail de quem vai participar" }), _jsx("input", { id: "email-convite", type: "email", value: conviteEmail, onChange: (e) => setConviteEmail(e.target.value) }), _jsx("div", { className: "acoes", children: _jsx("button", { className: "principal", disabled: ocupado || !conviteEmail.includes("@"), onClick: () => void executar(async () => {
                                                const convite = await api.criarConvite(viagemId, conviteEmail);
                                                setLinkConvite(convite.token);
                                                setConviteEmail("");
                                                setAviso("Convite criado. Envie o link para a pessoa: ela entra com o mesmo e-mail para aceitar.");
                                            }), children: "Gerar convite" }) }), linkConvite ? (_jsxs("div", { className: "aviso info", children: ["Link do convite (aparece s\u00F3 uma vez): ", _jsx("code", { children: `${location.origin}/?convite=${linkConvite}` }), _jsx("div", { className: "acoes", children: _jsx("button", { onClick: () => void navigator.clipboard?.writeText(`${location.origin}/?convite=${linkConvite}`), children: "Copiar link" }) })] })) : null] })) : (_jsx("p", { children: _jsx("small", { className: "suave", children: permissoes.convidar.motivo }) }))] })] })) : null, aba === "gastos" ? (_jsxs(_Fragment, { children: [_jsxs("section", { className: "cartao destaque", children: [_jsx("h2", { children: "Resumo" }), _jsxs("div", { className: "linha", children: [_jsx("span", { children: "Confirmado (oficial)" }), _jsx("strong", { children: formatarBRL(saldos?.realizado ?? "0") })] }), _jsxs("div", { className: "linha", children: [_jsx("span", { children: "Aguardando confirma\u00E7\u00E3o" }), _jsx("strong", { children: formatarBRL(saldos?.comprometido ?? "0") })] }), _jsx("p", { children: _jsx("small", { className: "suave", children: saldos?.aviso }) })] }), saldos && saldos.saldos.length > 0 ? (_jsxs("section", { className: "cartao", children: [_jsx("h2", { children: "Saldos" }), saldos.saldos.map((saldo) => (_jsxs("div", { className: "linha", children: [_jsx("span", { children: saldo.nome ?? "Participante" }), _jsxs("span", { className: BigInt(saldo.saldo) >= 0n ? "saldo-positivo" : "saldo-negativo", children: [BigInt(saldo.saldo) > 0n ? "recebe " : BigInt(saldo.saldo) < 0n ? "deve " : "em dia ", formatarBRL(BigInt(saldo.saldo) < 0n ? -BigInt(saldo.saldo) : saldo.saldo)] })] }, saldo.participanteId))), saldos.transferenciasSugeridas.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("h3", { style: { marginTop: 12 }, children: "Acertos sugeridos" }), saldos.transferenciasSugeridas.map((sugestaoAcerto) => (_jsxs("p", { children: [sugestaoAcerto.deNome, " \u2192 ", sugestaoAcerto.paraNome, ": ", _jsx("strong", { children: formatarBRL(sugestaoAcerto.valorCentavos) })] }, `${sugestaoAcerto.deId}-${sugestaoAcerto.paraId}-${sugestaoAcerto.valorCentavos}`))), _jsx("div", { className: "aviso atencao", children: "Sugest\u00E3o apenas: nada \u00E9 transferido pelo app. Combine o Pix por fora e registre o acerto." })] })) : null] })) : null, podeRegistrar ? (_jsxs("form", { className: "cartao", onSubmit: (evento) => {
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
                        }, children: [_jsx("h2", { children: "Nova despesa" }), _jsx("label", { htmlFor: "descricao", children: "Descri\u00E7\u00E3o" }), _jsx("input", { id: "descricao", value: novaDespesa.descricao, onChange: (e) => setNovaDespesa({ ...novaDespesa, descricao: e.target.value }), required: true, minLength: 2 }), _jsx("label", { htmlFor: "valor", children: "Valor (ex.: 87,50)" }), _jsx("input", { id: "valor", inputMode: "decimal", value: novaDespesa.valor, onChange: (e) => setNovaDespesa({ ...novaDespesa, valor: e.target.value }), required: true }), _jsx("label", { htmlFor: "tipo", children: "Tipo" }), _jsxs("select", { id: "tipo", value: novaDespesa.tipo, onChange: (e) => setNovaDespesa({ ...novaDespesa, tipo: e.target.value }), children: [_jsx("option", { value: "compartilhada", children: "Compartilhada (divide entre o grupo)" }), _jsx("option", { value: "pessoal", children: "Pessoal (s\u00F3 minha)" })] }), _jsx("label", { htmlFor: "pagador", children: "Quem pagou" }), _jsx("select", { id: "pagador", value: novaDespesa.pagadorId || usuarioId, onChange: (e) => setNovaDespesa({ ...novaDespesa, pagadorId: e.target.value }), children: participantes.filter((p) => p.estado === "ativo").map((p) => (_jsxs("option", { value: p.usuario_id, children: [p.nome, p.usuario_id === usuarioId ? " (você)" : ""] }, p.usuario_id))) }), _jsx("div", { className: "acoes", children: _jsx("button", { className: "principal", type: "submit", disabled: ocupado, children: "Registrar despesa" }) })] })) : (_jsx("div", { className: "aviso info", children: permissoes.registrarDespesa.motivo })), _jsxs("section", { children: [_jsx("h2", { children: "Despesas" }), despesas.length === 0 ? _jsx("div", { className: "cartao vazio", children: _jsx("p", { children: "Nenhuma despesa registrada ainda." }) }) : null, despesas.map((despesa) => {
                                const sou = despesa.autorId === usuarioId;
                                return (_jsxs("article", { className: "cartao", children: [_jsxs("div", { className: "linha entre", children: [_jsxs("div", { children: [_jsx("h3", { children: despesa.descricao }), _jsxs("p", { children: [formatarBRL(despesa.valorCentavos), " \u00B7 pago por ", nomePorId.get(despesa.pagadorId) ?? "alguém", " \u00B7", " ", formatarData(despesa.data), " \u00B7 ", despesa.tipo === "pessoal" ? "pessoal" : "compartilhada"] }), _jsx("p", { children: _jsx("small", { className: "suave", children: despesa.rateio.explicacao || `Lançado por ${nomePorId.get(despesa.autorId) ?? "alguém"}` }) })] }), _jsx("span", { className: `etiqueta estado-${despesa.estado}`, children: ROTULO_DESPESA[despesa.estado] })] }), despesa.motivoContestacao ? _jsxs("div", { className: "aviso atencao", children: ["Contesta\u00E7\u00E3o: ", despesa.motivoContestacao] }) : null, despesa.estado !== "confirmada" ? (_jsxs("div", { className: "acoes", children: [_jsx("button", { disabled: ocupado || sou, title: sou ? "Quem lançou não confirma o próprio lançamento" : "Confirmar esta despesa", onClick: () => void executar(async () => {
                                                        await api.confirmarDespesa(viagemId, despesa.id);
                                                        setAviso("Despesa confirmada e incluída nos saldos oficiais.");
                                                    }), children: "Confirmar" }), !sou ? (_jsx("button", { className: "sutil", disabled: ocupado, onClick: () => setMotivoContestacao({ id: despesa.id, texto: motivoContestacao?.texto ?? "" }), children: "Contestar" })) : null] })) : null, motivoContestacao?.id === despesa.id ? (_jsxs("form", { onSubmit: (evento) => {
                                                evento.preventDefault();
                                                void executar(async () => {
                                                    await api.contestarDespesa(viagemId, despesa.id, motivoContestacao.texto);
                                                    setMotivoContestacao(null);
                                                    setAviso("Despesa contestada: segue visível e fora dos saldos oficiais até a resolução.");
                                                });
                                            }, children: [_jsx("label", { htmlFor: "motivo", children: "Motivo da contesta\u00E7\u00E3o" }), _jsx("textarea", { id: "motivo", value: motivoContestacao.texto, onChange: (e) => setMotivoContestacao({ id: despesa.id, texto: e.target.value }), rows: 3, required: true, minLength: 5 }), _jsxs("div", { className: "acoes", children: [_jsx("button", { className: "principal", type: "submit", disabled: ocupado, children: "Enviar contesta\u00E7\u00E3o" }), _jsx("button", { type: "button", className: "sutil", onClick: () => setMotivoContestacao(null), children: "Cancelar" })] })] })) : null] }, despesa.id));
                            })] })] })) : null, aba === "mais" ? (_jsxs(_Fragment, { children: [_jsxs("section", { className: "cartao", children: [_jsx("h2", { children: "Ficha da viagem" }), _jsxs("div", { className: "linha", children: [_jsx("span", { children: "Estado" }), _jsx("strong", { children: viagem.rotuloEstado ?? ROTULO_ESTADO[viagem.estado] })] }), _jsxs("div", { className: "linha", children: [_jsx("span", { children: "Fuso" }), _jsx("span", { children: viagem.fuso_horario ?? "America/Sao_Paulo" })] }), _jsxs("div", { className: "linha", children: [_jsx("span", { children: "Vers\u00E3o dos dados" }), _jsx("span", { children: viagem.versao })] }), _jsx("p", { children: _jsx("small", { className: "suave", children: "Cada altera\u00E7\u00E3o relevante \u00E9 registrada com autor e hor\u00E1rio. A data da viagem nunca muda o estado sozinha." }) })] }), _jsxs("section", { className: "cartao", children: [_jsx("h2", { children: "Voc\u00EA" }), _jsxs("p", { children: [eu?.nome ?? "participante", " \u00B7 ", detalhe.papel] }), eu?.papel !== "organizador" ? (_jsx("div", { className: "acoes", children: _jsx("button", { className: "perigo", disabled: ocupado, onClick: () => void executar(async () => {
                                        await fetch("/api/viagens/" + viagemId + "/sair", { method: "POST", credentials: "include" });
                                        setAviso("Você saiu da viagem. O histórico permanece com o grupo.");
                                        voltar();
                                    }), children: "Sair da viagem" }) })) : (_jsx("p", { children: _jsx("small", { className: "suave", children: "Organizador(a) n\u00E3o sai sem passar a organiza\u00E7\u00E3o para outra pessoa." }) }))] })] })) : null, _jsxs("nav", { className: "barra", "aria-label": "Navega\u00E7\u00E3o principal", children: [_jsx("button", { "aria-current": aba === "visao", onClick: () => setAba("visao"), children: "Vis\u00E3o geral" }), _jsx("button", { "aria-current": aba === "gastos", onClick: () => setAba("gastos"), children: "Gastos" }), _jsx("button", { "aria-current": aba === "mais", onClick: () => setAba("mais"), children: "Mais" })] })] }));
}
