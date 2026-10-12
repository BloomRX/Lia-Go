import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { api, ErroApi } from "../services/api.ts";
// Dicas de autofill do navegador (ajudam o gerenciador de senhas; não guardam nada).
const DICA_CONTA_NOVA = "new-password";
const DICA_CONTA_EXISTENTE = "current-password";
/** Boas-vindas + entrada/criação de conta. Métodos: e-mail e senha (decisão confirmada). */
export function Entrar({ aoEntrar }) {
    const [modo, setModo] = useState("entrar");
    const [nome, setNome] = useState("");
    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const [erro, setErro] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    async function enviar(evento) {
        evento.preventDefault();
        setErro(null);
        setOcupado(true);
        try {
            const usuario = modo === "entrar" ? await api.entrar(email, senha) : await api.registrar(nome, email, senha);
            aoEntrar(usuario.nome);
        }
        catch (falha) {
            setErro(falha instanceof ErroApi ? falha.message : "Não foi possível conectar. Verifique sua rede.");
        }
        finally {
            setOcupado(false);
        }
    }
    return (_jsxs("main", { className: "app", children: [_jsxs("div", { className: "marca", children: [_jsx("span", { className: "marca-ponto", "aria-hidden": "true" }), _jsx("h1", { children: "Lia Go" })] }), _jsx("p", { children: "Viagens em grupo sem briga de dinheiro: roteiro, gastos compartilhados e acertos \u2014 com a Lia ajudando." }), _jsxs("form", { className: "cartao", onSubmit: enviar, children: [_jsx("h2", { children: modo === "entrar" ? "Entrar" : "Criar conta" }), erro ? _jsx("div", { className: "aviso erro", role: "alert", children: erro }) : null, modo === "criar" ? (_jsxs(_Fragment, { children: [_jsx("label", { htmlFor: "nome", children: "Seu nome" }), _jsx("input", { id: "nome", value: nome, onChange: (e) => setNome(e.target.value), required: true, minLength: 2, autoComplete: "name" })] })) : null, _jsx("label", { htmlFor: "email", children: "E-mail" }), _jsx("input", { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true, autoComplete: "email" }), _jsxs("label", { htmlFor: "senha", children: ["Senha ", modo === "criar" ? "(mínimo 10 caracteres)" : ""] }), _jsx("input", { id: "senha", type: "password", value: senha, onChange: (e) => setSenha(e.target.value), required: true, minLength: modo === "criar" ? 10 : 1, autoComplete: modo === "criar" ? DICA_CONTA_NOVA : DICA_CONTA_EXISTENTE }), _jsxs("div", { className: "acoes", children: [_jsx("button", { className: "principal", type: "submit", disabled: ocupado, children: ocupado ? "Enviando…" : modo === "entrar" ? "Entrar" : "Criar conta" }), _jsx("button", { type: "button", className: "sutil", onClick: () => { setModo(modo === "entrar" ? "criar" : "entrar"); setErro(null); }, children: modo === "entrar" ? "Criar conta" : "Já tenho conta" })] })] }), _jsx("div", { className: "aviso info", children: "Sua senha \u00E9 protegida com scrypt e a sess\u00E3o fica em cookie seguro na web. N\u00E3o guardamos dados de cart\u00E3o e n\u00E3o fazemos pagamentos: os acertos s\u00E3o apenas sugeridos." })] }));
}
