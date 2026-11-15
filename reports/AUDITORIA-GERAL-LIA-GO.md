# Auditoria geral — Lia Go

**Quando:** 2026-10-21 · **Ambiente:** sandbox Linux x64 (Arena) · **Node:** v22.22.3 · **npm:** 10.9.8
**Branch:** `arena/f1ac5ed6-lia-go` (base `03de30a`) · **Executor:** agente Principal do Lia Go
**Método:** leitura integral da documentação obrigatória, inspeção do código, suítes executadas nesta sessão, servidor real no ar e fluxo de ponta a ponta pela API pública. Nenhum número deste relatório vem de documento — todos vêm de execução ou de leitura de código com arquivo:linha citado.

---

## 1. Estado real do produto

O Lia Go é um aplicativo **real e funcional** de organização de viagens em grupo (não há tela demonstrativa): monorepo TypeScript com `packages/domain` (regras puras, 15 módulos), `packages/sync` (motor offline sem HTTP, 6 módulos), `apps/api` (Fastify 5 + PostgreSQL, SQL explícito, migrações `0001`–`0008`, 9 arquivos de rota) e `apps/mobile` (React 19 + Vite 8 + Capacitor 8, 13 telas). 130 arquivos `.ts`/`.tsx` de produto.

As **21 telas V1** mapeadas em `docs/UX_SCREENS.md` existem e têm estado funcional (Fatias A–D, 2026-10-19). A criação de viagem por conversa (tela 3, alternativa ao formulário) não existe — depende da camada de IA, que ainda não entrou (por decisão: nada de IA na V1 antes do provedor configurável).

O produto continua **independente de outros produtos Lia**: nenhuma integração com Lia Waifu, nenhuma dependência de produto externo para funcionar (verificado: nenhum import ou chamada fora do monorepo além de npm/PostgreSQL).

## 2. Funcionalidades implementadas e validadas nesta auditoria

| Área | Estado | Evidência |
|---|---|---|
| Autenticação (scrypt com parâmetros versionados, cookie HttpOnly + `Partitioned` no iframe, access/refresh com rotação e `FOR UPDATE`, limite de tentativas em 2 camadas com e-mail/IP hasheados) | ✅ | `apps/api/src/password.ts`, `routes/auth.ts:202-244`, `http.ts:122-166`; testes `auth.test.ts` |
| Autorização central no servidor (404 sem vínculo, 403 quem saiu; decisão vinda do domínio) | ✅ | `apps/api/src/authz.ts` + `routes/documentos.ts:62` |
| Dinheiro (centavos inteiros `bigint`, maior resto com soma exata, moedas misturadas rejeitadas) | ✅ | `packages/domain/src/money.ts:19-45` |
| Ciclo financeiro: despesa `pendente` fora do saldo oficial → confirmação por outra pessoa → saldo oficial | ✅ **validado em runtime** (ver §6) | `routes/despesas.ts`, fluxo 17/17 PASS |
| Viagens, convites (token mostrado uma vez), participação, saída/remoção com histórico | ✅ | `routes/viagens.ts`, testes de autorização cruzada |
| Roteiro, reservas (confirmar exige evidência), checklist (prazo não conclui), documentos (privados por padrão, 404 inclusive para organizador), orçamento com limite (planejamento), fechamento/exportação `.txt`/`.csv` com blindagem de fórmula | ✅ | testes dedicados por camada (ver §7) |
| Sincronização offline: outbox com `Idempotency-Key`, seção crítica (`mutarFila`), conflito nunca last-write-wins (`409 conflito_versao`), recuperação de operações interrompidas | ✅ | `packages/sync/src/{motor,fila,conflito,carga}.ts` |
| UI: alvos ≥44 px (botões 48 px), `focus-visible` 3 px, `prefers-reduced-motion`, `safe-area-inset`, barra com ícone **e** rótulo, `aria-current` | ✅ | `apps/mobile/src/styles.css:97,133,284,323` |
| Mobile: tokens nativos em `SecureStorage` (nunca `localStorage` na web), cache em IndexedDB/Preferences, base `VITE_API_URL ?? "/api"` sem `localhost` embutido | ✅ | `services/tokens.ts:63-98`, `offline/armazenamento.ts`, `services/api.ts:34-38` |
| Automação Windows (`LiaGo.bat` 7 etapas, `tools/dev.mjs` com placar em 2 formatos, porta-responde em vez de status) | ✅ (código + testes; rodada completa é no PC) | `LiaGo.bat`, `tools/dev.mjs`, `test_dev.mjs` 53 testes |
| DevKit (`project_cli.py`): git seguro, bloqueio de segredos/pesos/`.env` | ✅ 2 suítes Python OK nesta sessão | `tools/test_project_cli.py` (23 testes), `tools/test_creation.py` |
| Regra da marca (nenhum fornecedor/gateway de IA em código ou interface; `"serviço de IA"`; sem porta/`localhost` fixos no app) | ✅ varredura 2026-10-21: **0 ocorrências** em `apps/` e `packages/` | varredura registrada no relatório da sessão; regra gravada em `AGENTS.md` §4 (commit `5fa9ccf`) |

## 3. Funcionalidades parcialmente implementadas

1. **Acertos:** informado → confirmado existe; **pagamento parcial e reembolso ligado à despesa não existem** (declarado no backlog, Fase 2).
2. **Criação de viagem:** só formulário; conversa/formulário alternáveis exigem a camada de IA (não iniciada).
3. **Navegação:** Documentos/Reservas/Checklist/Fechamento vivem na aba Mais; seletor lateral da web e aba Documentos própria foram adiados de propósito (exigem teste em tela pequena com 5 destinos).
4. **Ids de operação offline:** UUIDv4; UUIDv7 (ordenável) é melhoria declarada e localizada.
5. **Runtime nativo:** código e build web prontos; `apps/mobile/android` é gerado na máquina do usuário. Afirmação máxima honesta: *"testes verdes; build nativa não executada"*.

## 4. Funcionalidades ausentes (por decisão ou ainda não alcançadas)

- **Camada de IA / Lia Waifu** (rascunhos de despesa/roteiro; provedor configurável com "Testar conexão" + "Listar modelos") — regras já gravadas em `AGENTS.md` §4 e `memory-bank/padroes.md` §4; nenhum código de cliente de IA existe.
- **HTTPS, hospedagem do servidor/banco, backup/restauração testados** — bloqueiam uso com dados reais (decisão humana aberta, ver §10).
- **E-mail transacional** (verificação de conta, recuperação de senha) — hoje quem perde a senha perde a conta (não há fluxo de recuperação).
- **Integração Pix, cancelamento automático de reservas, publicação nas lojas** — não objetivos da V1 (`PRODUCT_OVERVIEW.md`).
- **Política LGPD formal** (retenção, exclusão de conta, relatório de impactos) — documentos privados e minimização já no código; o texto legal não existe.

## 5. Problemas encontrados com evidências

### Corrigidos nesta auditoria

1. **[API] Id malformado (não-UUID) no caminho devolvia HTTP 500 `erro_interno`** em vez de 400 — o erro `22P02` do PostgreSQL (`invalid input syntax for type uuid`) não era classificado. Reproduzido: `GET /viagens/:id/despesas/nao-e-uuid` → **500**; id bem-formado inexistente → 404 (correto). **Correção:** classificação de `22P02` como `400 entrada_invalida` no handler central (`apps/api/src/server.ts`), sem ecoar o erro do banco; **teste novo** em `tests/viagens.test.ts` (API 94 → 95). Sem impacto em domínio/dinheiro.
2. **[Dependências] 2 vulnerabilidades no `npm audit` (fastify 5.12.2-5.12.5 validação de header; fast-uri)** — já registradas como aceitas em `DECISIONS_AND_OPEN_QUESTIONS.md` com reavaliação a cada versão. **`npm audit fix` aplicado nesta sessão: 0 vulnerabilidades** (10 pacotes atualizados dentro do semver; portão completo re-executado verde).
3. **[Documentação] Inconsistências objetivas corrigidas** (baixo risco):
   - `README.md`: placar 445/109/86/49+49/45 → real (462/158/95/49+53/54); "Estado atual (2026-10-15)" → 2026-10-21; "Ordem de leitura" dizia que `docs/AGENTS.md` era fonte única com "a raiz apenas aponta para ela" — **contrariava a decisão de 2026-10-20** (núcleo literal na raiz); numeração duplicada (10/11/10) corrigida.
   - `docs/AGENTS.md` e `docs/TECHNICAL_GUIDELINES.md`: citavam `packages/contracts` como existente (foi postergado — os tipos vivem em `apps/api/src`) e "interface com Vitest" (a interface usa `node --test` + jsdom, `tools/teste-ui.mjs`).
   - `docs/AGENTS.md`: placar 445 desatualizado → 462.
   - `docs/ARCHITECTURE.md`: §7 (95/53/54) e "Próxima fatia" que ainda listava tela 18 e substituição de roteiro como pendências (entregues nas Fatias A–D); cabeçalho atualizado com o estado da V1 e desta auditoria.

### Abertos (sem correção nesta auditoria — exigem decisão ou fatia própria)

4. **[Interface] Placeholder de servidor com porta fixa e menção a "Tailscale"**: `telas/Configuracoes.tsx:149,155` e `telas/Entrar.tsx:168,175` usam `placeholder="Ex.: http://192.168.1.10:3000/api"` e citam "Tailscale" no texto de ajuda. Não viola a regra do `AGENTS.md` §4 (não é fornecedor de IA nem porta fixa em código executável — é texto de exemplo), mas a lista foi entregue ao responsável em 2026-10-21 **aguardando decisão** de trocar o exemplo por algo sem porta (p. ex. "Ex.: https://meu-servidor.exemplo/api").
5. **[Documentação] Menções a ferramentas/ecossistema em docs de referência** (`docs/GLOSSARIO.md`, `docs/GUIA-LIA-GO.md`, `docs/PADRAO-MOBILE-WEB.md`, `docs/LEIA-ME-SESSAO.md`, `tools/README.md`/`tools/project_cli.py` detector de segredos): fora do código do produto e da interface; a lista foi entregue ao responsável (2026-10-21) e nenhuma alteração foi autorizada até agora.
6. **[Produto] Sem recuperação de conta** (§4 acima) — risco real para o primeiro grupo de usuários.
7. **[Observabilidade] A API loga erros ≥500** (tipo + mensagem técnica, sem dados sensíveis — `server.ts:52-54`), mas não há métricas/alertas; ficará importante na Fase 5.

## 6. Nova linha de base de testes (executada nesta sessão, 2026-10-21)

| Suíte | Resultado |
|---|---|
| `test:tools` | **53 pass, 0 fail** |
| `test:domain` | **158 pass, 0 fail** |
| `test:sync` | **49 pass, 0 fail** |
| `test:app` | **53 pass, 0 fail** |
| `test:ui` (jsdom, 1 arquivo por vez) | **54 pass, 0 fail** |
| `test:api` (PostgreSQL real) | **95 pass, 0 fail** |
| **Total** | **462 pass · 0 fail · 0 skipped** |
| `npm run typecheck` | ✅ exit 0 (3 workspaces) |
| `npm run build:web` | ✅ 1,07 s — `index.js` 437,89 kB (127,35 kB gzip) |
| `npm audit` (produção) | ✅ **0 vulnerabilidades** (após `npm audit fix`; antes: 1 moderada + 1 baixa) |
| DevKit Python (`test_project_cli.py`, `test_creation.py`) | ✅ OK (23 testes na suíte de fluxos Git) |

**Validação de runtime (servidor real, API em `127.0.0.1:3000`, app web em `0.0.0.0:5273`, banco portátil em `127.0.0.1:55432`):**
fluxo de ponta a ponta só pela API pública com 3 contas sintéticas — **17/17 PASS**: registro + login (cookie e modo nativo com access/refresh), criação de viagem, convite aceito, despesa compartilhada de R$ 100,00 com rateio igualitário **nasce `pendente` e o saldo oficial fica `realizado: 0 / comprometido: 10000`**; o autor **não** confirma o próprio lançamento (400); outra pessoa confirma e o saldo oficial passa a `realizado: 10000` (A `+5000`, B `−5000`); terceiro sem vínculo recebe **404** em viagem e despesas; sem sessão **401**; renovação de token **200**. Conta de demonstração recriada após os testes (`tools/demo.mjs`: `demo@lia.go` / `lia-go-demo-2026`).

**Limitação honesta:** não há navegador real no sandbox — a interface foi validada pelos 54 testes em jsdom + HTTP 200 do app (`/` → `<title>Lia Go</title>`, hero 200, proxy `/api` → 401 sem sessão, correto). A última validação em navegador Chromium real (390×844 e 1280×800) foi registrada em `UI_V1_DECISIONS.md` §19 (2026-10-18, PC do responsável). **Android/iOS: build nativa não executada** (regra permanente).

## 7. Dívidas técnicas

| Dívida | Onde | Impacto |
|---|---|---|
| Ids de operação offline em UUIDv4 (UUIDv7 seria ordenável) | `apps/mobile/src/offline` | baixo |
| Rota `GET /viagens/:id/despesas` carrega despesa por despesa em loop (N+1) | `routes/despesas.ts:96-103` | baixo hoje; cresce com o histórico |
| Sem PDF na exportação (`.txt`/`.csv` só) | `services/exportacao.ts` | médio (expectativa do usuário) |
| `packages/contracts` postergado: contratos duplicados entre API e app são corrigidos à mão | API `zod` × app | médio no longo prazo |
| Sem testes de carga/concorrência de sincronização (2 aparelhos simultâneos) | — | médio |
| Placar do `docs/AGENTS.md` exige atualização manual a cada fatia | `docs/AGENTS.md:54` | baixo (hoje correto) |

## 8. Riscos de segurança e privacidade

**Bom (verificado em código):** senhas scrypt com parâmetros versionados; tokens com hash SHA-256 no banco; rotação de refresh com revogação; cookies `HttpOnly` + `SameSite` (e `Partitioned` só no iframe com `Secure`); limite de tentativas com **e-mail/IP hasheados** (minimização); autorização em toda rota com testes negativos; documentos privados por padrão com 404; auditoria (`audit.ts`) sem dados pessoais; trilha de login com higiene de 30 dias; tokens nunca em `localStorage`; log de erro sem valores sensíveis; `.env` fora do Git; detector de segredos no DevKit.

**Riscos a tratar (por prioridade):**
1. **HTTP puro em produção** — hoje o ambiente é local; dados reais de terceiros exigem HTTPS antes de qualquer publicação (regra do projeto). *Bloqueia o APK com dados reais.*
2. **Sem recuperação de conta** (e-mail transacional) — perda de acesso permanente.
3. **Sem backup/restauração testados** do PostgreSQL — perda de dados se o servidor sumir.
4. **`SameSite=none` existe para o modo embutido** — corretamente impedido sem `Secure` (`config.ts:64-66`); manter a disciplina de só ligar sob HTTPS.
5. **LGPD:** política de retenção/exclusão formal inexistente; exclusão de conta não implementada (só saída/remoção de viagem).

## 9. Pendências de arquitetura e produto

**Resolvidas pelo agente (sem bloqueio):** detalhes de layout/microcopy; bibliotecas auxiliares reversíveis; UUIDv7; ordem interna de tarefas pequenas.

**Decisão humana aberta (não bloqueiam fatias técnicas, bloqueiam uso real):**
1. **Quem hospeda e quem paga** servidor + PostgreSQL (4 opções em `DECISIONS_AND_OPEN_QUESTIONS.md`; a opção 3 — endereço configurável por grupo — **já é suportada pelo app** via tela 18 e `VITE_API_URL ?? "/api"`).
2. **E-mail transacional** (recuperação de conta) e provedor/custos.
3. **Fonte de câmbio** (frequência, spread, modo offline) — hoje a taxa é manual e determinística (decisão V1 ok).
4. **Política LGPD** (retenção, exclusão, relatórios).
5. **Publicação:** APK direto vs lojas (US$ 25) / iOS (US$ 99/ano + macOS).
6. **Limites de custo e provedor de IA** antes de qualquer integração (regras do `AGENTS.md` §4 já gravadas).
7. **Lia Waifu:** escada V1 (nada) → V2 (pareamento por código) → V3 (rede privada) → relay pago; nada implementado, nada a fazer agora.

## 10. Dependências e bloqueios

- **Bloqueio de ambiente (permanente):** build Android/iOS só na máquina do responsável (JDK 21, SDK 36, Android Studio Otter; iOS exige macOS + Xcode 26).
- **Bloqueio de uso real:** HTTPS + hospedagem + backup + LGPD (decisões acima). Nada disso bloqueia desenvolvimento: dados sintéticos, servidor local.
- **Bloqueio de IA:** definição de custos/provedor; o design já aceita endereço + chave sem marca (regra gravada).
- **Divergência `main` × arena** (ver §11) precisa de integração para não duplicar correção de docs.

## 11. Situação GitHub (PR #1)

- **`main`** tem exatamente **1 commit próprio** (`b2fbe96`, "docs: align Lia Go with shared brand standards", aplicado direto na `main`): altera só `AGENTS.md` (+6 linhas, seção 0), `README.md` (+5) e cria `docs/BRAND-STANDARDS.md` (94 linhas). O mesmo conteúdo já entrou na arena via `03de30a`.
- **`arena/f1ac5ed6-lia-go`** tem **91 commits** que não estão em `main` (todo o desenvolvimento).
- **PR #1** (`arena/f1ac5ed6-lia-go` → `main`): **OPEN, 100 arquivos, 28 comentários, estado `DIRTY`/CONFLICTING**.
- **Conflito real: apenas `AGENTS.md` (add/add)** — `README.md` auto-mergeia; `docs/BRAND-STANDARDS.md` é idêntico dos dois lados. `git merge-tree` confirma: única entrada em conflito é `AGENTS.md`.
- **Estratégia segura recomendada:** *merge de `main` para dentro da arena* resolvendo `AGENTS.md` como **união** (a versão da arena é um superconjunto: contém a mesma seção 0 + núcleo de regras + regra de serviço de IA). Não fazer rebase de 91 commits; não usar `push --force` em nenhum momento. Depois do merge, a PR #1 fica verde e pode ser mesclada por decisão do responsável (a PR **não** foi mesclada/fechada nesta auditoria, conforme instrução).
- **Anomalia menor:** o commit `b2fbe96`/`03de30a` carrega data de **30/10/2026** (futuro em relação a hoje) — relógio adiantado na máquina de origem; sem impacto funcional, mas pode confundir ordenação de histórico.

## 12. Priorização

- **P0 (nada explode hoje; manter):** linha de base verde 462; banco de demonstração ativo; `AGENTS.md` da raiz como núcleo literal; regra da marca sem fornecedor/porta (já gravada em `5fa9ccf`).
- **P1 (próxima fatia funcional):** reembolsos + pagamento parcial com revisão independente e histórico (Fecha 2 do backlog); integração `main` → arena resolvendo `AGENTS.md` (união).
- **P2:** seletor lateral da web + aba Documentos própria (5 destinos, teste em tela estreita); UUIDv7; decisão do placeholder de servidor (item 5 do §5); PDF na exportação.
- **P3 (pré-uso real):** HTTPS + hospedagem + backup; recuperação de conta (e-mail); LGPD; observabilidade; camada de IA com provedor configurável; build Android assinada no Windows.

## 13. Plano de execução recomendado

1. **Esta sessão já entregou:** correção do 500 → 400 com teste; `npm audit fix` (0 vulnerabilidades); docs sincronizadas com a realidade; relatório de auditoria; demo recriada; API + app no ar.
2. **Próxima sessão (Principal):** Fatia "Acertos completos" — reembolso ligado à despesa e pagamento parcial (domínio → API → tela Gastos → sync), mantendo `reviewer` ALTO por tocar `packages/domain` (dinheiro).
3. **Próxima sessão (Codex ou Principal):** merge de `main` na arena com resolução de união em `AGENTS.md`; depois o responsável decide o momento de mesclar a PR #1.
4. **Fatia seguinte:** navegação web lateral + aba Documentos (interface), com os 54 testes de UI ampliados.
5. **Sessões especializadas que se justificam:** (a) **Hospedagem/HTTPS** (pesquisa de custo + plano de backup — decide o responsável); (b) **Recuperação de conta/e-mail** (integração externa, custo); (c) **Camada de IA** (provedor configurável, custos, rascunhos — grande e isolada); (d) **QA visual em aparelho real** (quando o APK existir no Windows).

## 14. Afirmar apenas o que foi medido

`"testes verdes; build nativa não executada"` — continua sendo a afirmação máxima honesta sobre Android/iOS. Nada neste relatório declara o produto pronto para dados reais: HTTPS, hospedagem, backup, LGPD e recuperação de conta continuam em aberto.
