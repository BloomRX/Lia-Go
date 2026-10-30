# Lia Go — Regras Permanentes do Agente

## 0. Padrão comum da marca
- Consulte `docs/BRAND-STANDARDS.md` para nome, linguagem, identidade, licenças, privacidade e distinção entre produtos.
- O padrão comum não substitui este contrato de negócio nem o design system específico do Lia Go.

## 1. Stack e autoridade (não substituir sem autorização)
- Monorepo TypeScript (`npm workspaces`):
  - `packages/domain` — regras puras e determinísticas (**sem I/O e sem UI**).
  - `packages/sync` — motor offline local-first (`outbox`, cursor, conflito, carga; **sem HTTP**).
  - `apps/api` — Fastify + PostgreSQL (`pg`, SQL explícito, migrações `0001`–`0008`).
  - `apps/mobile` — React + TS + Vite + Capacitor (**celular principal**, web complementar).
- **Servidor é a única autoridade** sobre saldos oficiais, permissões e dados compartilhados. O app usa `@lia-go/domain` só para prévia e offline; **SQLite/IndexedDB local nunca é banco central**.

## 2. Dinheiro e revisão humana (`ALTO`)
- Dinheiro sempre em **centavos inteiros** (`bigint` no domínio, `BIGINT` no Postgres), nunca float.
- Rateio pelo maior resto com **soma exata**; `calcularResumoFinanceiro` rejeita misturar moedas sem conversão explícita.
- Despesa nasce `pendente`; autor **não** confirma o próprio lançamento; `pendente`/`contestada` e limites de orçamento não entram no saldo oficial.
- **Revisão obrigatória:** tocar `money`, `expense`, `split`, `balances`, `orcamento` ou `fechamento` em `packages/domain` é sempre nível **`ALTO`** no `reviewer` e exige revisão humana.

## 3. Offline e honestidade da UI
- **Sobrevivência offline:** viagem, roteiro, reservas, checklist, documentos, despesas, acertos, limite de orçamento, prévia de cancelamento e exportação local (`.txt`/`.csv`) funcionam sem rede via `outbox` (`Idempotency-Key` + `versao`). Queda de servidor ou IA não derruba o app.
- **Conflito financeiro nunca é *last-write-wins*:** divergência (`409 conflito_versao` ou valor) exige decisão humana.
- **A UI não mente (`docs/UI_V1_DECISIONS.md` §13):** não insinuar ação externa não feita (pagamento, reserva no fornecedor, e-mail); separar `previsto` de `gasto confirmado`; custo desconhecido nunca vira `R$ 0,00`; relógio não conclui atividade/checklist; nada crítico só por cor; toque ≥ 44 px (preferir 48 px).

## 4. Segurança, privacidade e IA
- Autorização no servidor em toda leitura/escrita (`404` sem vínculo; `403` para quem saiu/foi removido). Documentos privados por padrão.
- Zero segredos ou chaves pagas do autor no cliente/repositório. **Dados sintéticos** até existir HTTPS.
- **IA e Lia Waifu ("conversa não é autorização"):** IA só sugere rascunhos; nunca cria despesa confirmada, nunca confirma/contesta gasto ou acerto, nunca muda limite e nunca cancela viagem.
- **Serviço de IA e servidor (sem marca e sem porta/localhost fixos):** nome de fornecedor de IA ou de gateway e porta fixa **não entram no código nem na interface**. O app guarda apenas **endereço + chave** (com "Testar conexão" + "Listar modelos") e na interface escreve-se sempre **"serviço de IA"**, nunca a marca. No mobile (Capacitor), endereço de servidor nunca pode ser `localhost` embutido (o aparelho não alcança a própria máquina; padrão `VITE_API_URL ?? "/api"` + endereço editável).

## 5. Verificação, build nativa e decisões
- Suíte estreita primeiro, portão no fim: `test:domain` · `test:sync` · `test:api` · `test:app` · `test:ui` · `test:tools` → `npm test && npm run typecheck` (Windows: `LiaGo.bat`).
- **Git × máquina:** versionar só o que vale em Windows e Linux (`.agents/skills/` no git, `.claude/` no `.gitignore`).
- **Build nativa:** Android/iOS rodam na máquina do usuário. Sem SDK local, declarar apenas `"testes verdes; build nativa não executada"`.
- **Decisões:** resolver detalhes pequenos/cosméticos pela opção mais simples; pedir confirmação em segurança, privacidade, custos, hospedagem, arquitetura ou escopo.
- **Detalhes:** `docs/AGENTS.md`, `docs/BUSINESS_RULES.md`, `docs/DECISIONS_AND_OPEN_QUESTIONS.md`, `docs/ARCHITECTURE.md`, `docs/UI_V1_DECISIONS.md` e `memory-bank/padroes.md`.
