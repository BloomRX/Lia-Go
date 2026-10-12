import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api, ErroApi } from "../services/api.ts";
import { ROTULO_ESTADO, formatarData } from "../services/formato.ts";
/** Início: viagens próximas, pendências e convites pendentes (nada de tela demonstrativa). */
export function Inicio({ abrirViagem, aceitarConvite }) {
    const [viagens, setViagens] = useState(null);
    const [convites, setConvites] = useState([]);
    const [erro, setErro] = useState(null);
    const [criando, setCriando] = useState(false);
    const [nome, setNome] = useState("");
    const [destino, setDestino] = useState("");
    const [inicio, setInicio] = useState("");
    const [fim, setFim] = useState("");
    const [token, setToken] = useState("");
    async function carregar() {
        setErro(null);
        try {
            const dados = await api.listarViagens();
            setViagens(dados.viagens);
            setConvites(dados.convitesPendentes);
        }
        catch (falha) {
            setErro(falha instanceof ErroApi ? falha.message : "Falha ao carregar suas viagens.");
            setViagens([]);
        }
    }
    useEffect(() => {
        void carregar();
    }, []);
    async function criar(evento) {
        evento.preventDefault();
        setErro(null);
        try {
            const criada = await api.criarViagem({
                nome,
                destino,
                dataInicio: inicio || null,
                dataFim: fim || null,
            });
            setCriando(false);
            setNome("");
            setDestino("");
            setInicio("");
            setFim("");
            abrirViagem(criada.id);
        }
        catch (falha) {
            setErro(falha instanceof ErroApi ? falha.message : "Não foi possível criar a viagem.");
        }
    }
    if (viagens === null) {
        return (_jsx("main", { className: "app", children: _jsxs("div", { className: "carregando", children: [_jsx("span", { className: "pulso" }), " Carregando suas viagens\u2026"] }) }));
    }
    return (_jsxs("main", { className: "app", children: [_jsxs("div", { className: "marca", children: [_jsx("span", { className: "marca-ponto", "aria-hidden": "true" }), _jsx("h1", { children: "Lia Go" })] }), erro ? _jsx("div", { className: "aviso erro", role: "alert", children: erro }) : null, convites.length > 0 ? (_jsxs("section", { children: [_jsx("h2", { children: "Convites pendentes" }), convites.map((convite) => (_jsx("div", { className: "cartao", children: _jsx("div", { className: "linha", children: _jsxs("div", { children: [_jsx("h3", { children: convite.viagem_nome }), _jsx("p", { children: "Voc\u00EA foi convidada(o). Entre e aceite para ver o roteiro e os gastos." })] }) }) }, convite.id))), _jsxs("div", { className: "cartao", children: [_jsx("label", { htmlFor: "token-convite", children: "Cole o link/token do convite" }), _jsx("input", { id: "token-convite", value: token, onChange: (e) => setToken(e.target.value), placeholder: "token recebido do organizador" }), _jsx("div", { className: "acoes", children: _jsx("button", { className: "principal", onClick: () => aceitarConvite(token.trim()), disabled: token.trim().length < 10, children: "Aceitar convite" }) })] })] })) : null, _jsxs("section", { children: [_jsxs("div", { className: "linha", children: [_jsx("h2", { children: "Suas viagens" }), _jsx("button", { onClick: () => setCriando(!criando), children: criando ? "Cancelar" : "Criar viagem" })] }), criando ? (_jsxs("form", { className: "cartao destaque", onSubmit: criar, children: [_jsx("label", { htmlFor: "nome-viagem", children: "Nome da viagem" }), _jsx("input", { id: "nome-viagem", value: nome, onChange: (e) => setNome(e.target.value), required: true, minLength: 2 }), _jsx("label", { htmlFor: "destino", children: "Destino" }), _jsx("input", { id: "destino", value: destino, onChange: (e) => setDestino(e.target.value) }), _jsx("label", { htmlFor: "inicio", children: "In\u00EDcio (opcional)" }), _jsx("input", { id: "inicio", type: "date", value: inicio, onChange: (e) => setInicio(e.target.value) }), _jsx("label", { htmlFor: "fim", children: "Fim (opcional)" }), _jsx("input", { id: "fim", type: "date", value: fim, onChange: (e) => setFim(e.target.value) }), _jsx("div", { className: "acoes", children: _jsx("button", { className: "principal", type: "submit", children: "Salvar rascunho" }) })] })) : null, viagens.length === 0 && !criando ? (_jsxs("div", { className: "cartao vazio", children: [_jsx("p", { children: "Voc\u00EA ainda n\u00E3o tem viagens." }), _jsx("button", { className: "principal", onClick: () => setCriando(true), children: "Criar viagem" })] })) : null, viagens.map((viagem) => (_jsx("button", { className: "cartao", style: { width: "100%", textAlign: "left", display: "block" }, onClick: () => abrirViagem(viagem.id), children: _jsxs("div", { className: "linha entre", children: [_jsxs("div", { children: [_jsx("h3", { children: viagem.nome }), _jsxs("p", { children: [viagem.destino || "sem destino definido", " \u00B7 ", formatarData(viagem.data_inicio), " a ", formatarData(viagem.data_fim)] }), _jsx("p", { children: _jsxs("small", { className: "suave", children: [viagem.papel === "organizador" ? "Organizador(a)" : "Participante", viagem.pendencias_financeiras > 0 ? ` · ${viagem.pendencias_financeiras} pendência(s) financeira(s)` : ""] }) })] }), _jsx("span", { className: `etiqueta estado-${viagem.estado}`, children: ROTULO_ESTADO[viagem.estado] ?? viagem.estado })] }) }, viagem.id)))] })] }));
}
