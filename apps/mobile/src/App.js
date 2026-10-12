import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Entrar } from "./telas/Entrar.tsx";
import { Inicio } from "./telas/Inicio.tsx";
import { Viagem } from "./telas/Viagem.tsx";
import { api, ErroApi } from "./services/api.ts";
/** Navegação simples por estado (uma tela por vez) — suficiente para a primeira fatia. */
export function App() {
    const [usuario, setUsuario] = useState(null);
    const [carregando, setCarregando] = useState(true);
    const [tela, setTela] = useState({ nome: "inicio" });
    const [mensagem, setMensagem] = useState(null);
    useEffect(() => {
        void (async () => {
            try {
                const sessao = await api.sessao();
                setUsuario(sessao);
            }
            catch (erro) {
                setMensagem(erro instanceof ErroApi ? erro.message : "Não foi possível verificar a sessão.");
            }
            finally {
                setCarregando(false);
            }
        })();
    }, []);
    async function aceitarConvite(token) {
        try {
            const resultado = await api.aceitarConvite(token);
            setMensagem("Convite aceito! Você já aparece na viagem.");
            setTela({ nome: "viagem", viagemId: resultado.viagemId });
        }
        catch (erro) {
            setMensagem(erro instanceof ErroApi ? erro.message : "Não foi possível aceitar o convite.");
        }
    }
    function sair() {
        void api.sair().finally(() => {
            setUsuario(null);
            setTela({ nome: "inicio" });
        });
    }
    if (carregando) {
        return (_jsx("main", { className: "app", children: _jsxs("div", { className: "carregando", children: [_jsx("span", { className: "pulso" }), " Verificando sua sess\u00E3o\u2026"] }) }));
    }
    if (!usuario)
        return _jsx(Entrar, { aoEntrar: () => void api.sessao().then(setUsuario) });
    return (_jsxs(_Fragment, { children: [_jsxs("div", { style: { maxWidth: 720, margin: "0 auto", padding: "16px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("small", { className: "suave", children: ["Conectado como ", usuario.nome] }), _jsx("button", { className: "sutil", onClick: sair, children: "Sair" })] }), mensagem ? (_jsx("div", { style: { maxWidth: 720, margin: "0 auto", padding: "0 16px" }, children: _jsx("div", { className: "aviso info", children: mensagem }) })) : null, tela.nome === "inicio" ? (_jsx(Inicio, { abrirViagem: (viagemId) => setTela({ nome: "viagem", viagemId }), aceitarConvite: (token) => void aceitarConvite(token) })) : (_jsx(Viagem, { viagemId: tela.viagemId, usuarioId: usuario.id, voltar: () => setTela({ nome: "inicio" }) }))] }));
}
