/**
 * Conversa com a API.
 *
 * Regra de plataforma (decisão confirmada de sessão híbrida):
 * - WEB: cookie HttpOnly, enviado com `credentials: "include"`, via proxy /api do Vite.
 * - APP NATIVO: access token curto no cabeçalho Authorization e refresh token em
 *   armazenamento seguro do aparelho (Preferences). Nada de token em localStorage na web.
 */
import { Platform } from "./plataforma.ts";
import { guardarTokens, lerTokens, limparTokens } from "./tokens.ts";
export class ErroApi extends Error {
    status;
    codigo;
    detalhes;
    constructor(status, codigo, mensagem, detalhes) {
        super(mensagem);
        this.status = status;
        this.codigo = codigo;
        this.detalhes = detalhes;
    }
}
const BASE = import.meta.env.VITE_API_URL ?? "/api";
async function requisitar(caminho, opcoes = {}, tentativa = 0) {
    const cabecalhos = {};
    if (opcoes.corpo !== undefined)
        cabecalhos["content-type"] = "application/json";
    if (opcoes.idempotencia)
        cabecalhos["idempotency-key"] = opcoes.idempotencia;
    if (Platform.ehNativo()) {
        const tokens = await lerTokens();
        if (tokens?.acesso)
            cabecalhos.authorization = `Bearer ${tokens.acesso}`;
    }
    const resposta = await fetch(`${BASE}${caminho}`, {
        method: opcoes.metodo ?? "GET",
        headers: cabecalhos,
        credentials: "include",
        ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
    });
    if (resposta.status === 401 && Platform.ehNativo() && !opcoes.semRenovacao && tentativa === 0) {
        const renovado = await renovarToken();
        if (renovado)
            return requisitar(caminho, opcoes, tentativa + 1);
    }
    if (resposta.status === 204)
        return undefined;
    const texto = await resposta.text();
    const dados = texto ? JSON.parse(texto) : {};
    if (!resposta.ok) {
        throw new ErroApi(resposta.status, String(dados.erro ?? "erro"), String(dados.mensagem ?? "Não foi possível concluir a operação."), dados.detalhes);
    }
    return dados;
}
async function renovarToken() {
    const tokens = await lerTokens();
    if (!tokens?.refresh)
        return false;
    try {
        const resposta = await fetch(`${BASE}/auth/token/renovar`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ refreshToken: tokens.refresh }),
        });
        if (!resposta.ok) {
            await limparTokens();
            return false;
        }
        const dados = (await resposta.json());
        await guardarTokens({ acesso: dados.acesso.token, refresh: dados.refresh.token });
        return true;
    }
    catch {
        await limparTokens();
        return false;
    }
}
export const api = {
    async registrar(nome, email, senha) {
        const resposta = await requisitar("/auth/registro", {
            metodo: "POST",
            corpo: { nome, email, senha },
            semRenovacao: true,
        });
        return resposta.usuario;
    },
    async entrar(email, senha) {
        if (Platform.ehNativo()) {
            const resposta = await requisitar("/auth/login", { metodo: "POST", corpo: { email, senha, cliente: "nativo", dispositivo: Platform.nome() }, semRenovacao: true });
            await guardarTokens({ acesso: resposta.acesso.token, refresh: resposta.refresh.token });
            return resposta.usuario;
        }
        const resposta = await requisitar("/auth/login", {
            metodo: "POST",
            corpo: { email, senha, cliente: "web" },
            semRenovacao: true,
        });
        return resposta.usuario;
    },
    async sair() {
        try {
            await requisitar("/auth/logout", { metodo: "POST", semRenovacao: true });
        }
        finally {
            await limparTokens();
        }
    },
    async sessao() {
        try {
            const resposta = await requisitar("/auth/sessao");
            return resposta.usuario;
        }
        catch (erro) {
            if (erro instanceof ErroApi && erro.status === 401)
                return null;
            throw erro;
        }
    },
    async listarViagens() {
        return requisitar("/viagens");
    },
    async criarViagem(dados) {
        return requisitar("/viagens", {
            metodo: "POST",
            corpo: { ...dados, fusoHorario: "America/Sao_Paulo", moeda: "BRL" },
            idempotencia: crypto.randomUUID(),
        });
    },
    async detalheViagem(viagemId) {
        return requisitar(`/viagens/${viagemId}`);
    },
    async transicionar(viagemId, para, motivo) {
        return requisitar(`/viagens/${viagemId}/transicoes`, { metodo: "POST", corpo: { para, motivo } });
    },
    async impactosCancelamento(viagemId) {
        return requisitar(`/viagens/${viagemId}/impactos-cancelamento`);
    },
    async criarConvite(viagemId, email) {
        return requisitar(`/viagens/${viagemId}/convites`, { metodo: "POST", corpo: { email } });
    },
    async aceitarConvite(token) {
        return requisitar("/convites/aceitar", { metodo: "POST", corpo: { token } });
    },
    async listarDespesas(viagemId) {
        return requisitar(`/viagens/${viagemId}/despesas`);
    },
    async criarDespesa(viagemId, dados) {
        return requisitar(`/viagens/${viagemId}/despesas`, {
            metodo: "POST",
            corpo: { ...dados, moeda: "BRL" },
            idempotencia: crypto.randomUUID(),
        });
    },
    async confirmarDespesa(viagemId, despesaId) {
        return requisitar(`/viagens/${viagemId}/despesas/${despesaId}/confirmar`, { metodo: "POST" });
    },
    async contestarDespesa(viagemId, despesaId, motivo) {
        return requisitar(`/viagens/${viagemId}/despesas/${despesaId}/contestar`, { metodo: "POST", corpo: { motivo } });
    },
    async saldos(viagemId) {
        return requisitar(`/viagens/${viagemId}/saldos`);
    },
};
