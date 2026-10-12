# Arquitetura e análise de viabilidade — Lia Go

**Estado:** primeira fatia **implementada e testada** (2026-10-12). Decisões de §11 respondidas pelo responsável:
Docker/PostgreSQL local, sessão híbrida (cookie na web + tokens no app), SQLite nativo/IndexedDB no aparelho
e fatia aprovada. O que já roda de verdade está descrito em §12.1.
**Base:** decisão confirmada de stack (React + TypeScript + Capacitor) + documentos de regras.
**Data da análise:** 2026-10-12 — medições feitas no ambiente real de execução (Arena), não estimadas.

---

## 1. Decisão confirmada pelo responsável

- Cliente: **React + TypeScript + Capacitor**, priorizando reaproveitamento entre app mobile e versão web.
- **Celular é a plataforma principal**; web é complementar.
- Esta stack **não deve ser substituída sem autorização**.
- O domínio (regras de negócio) deve ficar **independente da interface**.
- **SQLite local nunca é o banco central compartilhado entre usuários.**

## 2. Verificação de viabilidade (medida, não presumida)

| Item verificado | Resultado real | Impacto |
|---|---|---|
| Node.js no ambiente | **v22.22.3** (LTS atendida) | ✅ Capacitor 8 exige Node ≥ 22 |
| npm | **10.9.8**; acesso ao registry funciona | ✅ instalação possível |
| `npm create vite` (react-ts) + `npm install` | OK, 0 vulnerabilidades | ✅ |
| `npm run build` (Vite 8.3.4 / React 19.3 / TS 6) | OK em **164 ms**, bundle inicial 222 kB (**69 kB gzip**) | ✅ viável para 3G/4G |
| Vite dev com `--host 0.0.0.0` + host do preview do Arena | **HTTP 403 — bloqueado** (proteção contra DNS rebinding do Vite) | ❌ precisa configuração obrigatória |
| Mesmo dev server com `server.allowedHosts: ['.e2b.app']` | **HTTP 200** no host do preview; host desconhecido segue **403** | ✅ correção validada |
| Capacitor CLI 8.5.3 + `cap add android` | projeto nativo gerado (`gradlew`, `gradlew.bat`, `variables.gradle`), `cap doctor` limpo | ✅ |
| Build nativo Android/iOS **dentro do Arena** | **impossível**: sem JDK 21, sem Android SDK, sem Xcode | ⚠️ build nativo acontece na máquina do responsável |
| `node a.ts` (TypeScript sem compilar) | funciona (type stripping nativo do Node 22) | ✅ domínio testável sem build |
| `node --test a.test.ts` | funciona (1 pass) | ✅ testes do domínio sem framework extra |
| Versões de bibliotecas propostas | fastify 5.12.5 · drizzle-orm 0.45.4 · pg 8.23.1 · zod 4.6.6 · dexie 4.4.6 · @capacitor-community/sqlite 8.1.1 | ✅ todas disponíveis |
| Prisma | última é **8.0.0-rc** (release candidate) | ⚠️ evita-se depender de RC |

### Consequências diretas

1. **Configuração obrigatória do Vite** (sem ela o preview quebra com 403):
   ```ts
   server: { host: true, allowedHosts: ['.e2b.app'], hmr: { protocol: 'wss', clientPort: 443 } }
   ```
   A verificação do WebSocket de HMR atrás do proxy será feita na primeira fatia com app real.
2. **O ambiente Arena serve para**: código, testes automatizados, build web e preview no navegador.
   **A máquina Windows serve para**: build/execução Android (e futuramente iOS via macOS).
3. **`node --test` + TypeScript nativo** permite testar as regras de negócio sem `ts-node`, `jest` ou `vitest`,
   mantendo o `.bat` rápido e resistente a falha de instalação.

## 3. Requisitos de toolchain (Android/iOS)

| Alvo | Requisito | Onde roda |
|---|---|---|
| Web | Node ≥ 22.12, npm | Arena e Windows |
| Android | Node ≥ 22, **Android Studio Otter 2025.2.1+**, **JDK 21**, Android SDK **36** (minSdk 24, AGP 8.13, Gradle 8.14.3) | **Windows** (Arena não tem SDK) |
| iOS | **macOS + Xcode 26+** (obrigatório) | só macOS — indisponível no Windows |
| Publicação | Apple Developer Program (~US$ 99/ano), Google Play (~US$ 25 único) | decisão futura de custo |
| Distribuição sem loja | possível no Android (APK direto) | Windows |

**Risco conhecido:** quando o app Android consultar a API em HTTP dentro da rede local (`192.168.x.x`),
o WebView exige atenção a *mixed content*. Em desenvolvimento a solução é origem `http` no Capacitor;
**dados reais exigem HTTPS** (ver §10).

## 4. Arquitetura proposta

Monorepo com **npm workspaces**, uma única linguagem (TypeScript) e regras de domínio compartilhadas:

```
Lia-Go/
├─ apps/
│  ├─ api/          # servidor: HTTP + Postgres + autenticação + autorização + sync
│  └─ mobile/       # React + TS + Vite + Capacitor (web e app no MESMO código)
├─ packages/
│  ├─ domain/       # regras puras: dinheiro, rateio, estados, validações — SEM I/O e SEM UI
│  └─ contracts/    # tipos/schemas (zod) de entrada e saída da API
├─ tools/           # DevKit existente (git seguro + validação)
├─ docs/            # fonte de verdade
└─ LiaGo.bat        # automação de desenvolvimento (a criar junto da 1ª fatia)
```

### Regra de ouro do domínio compartilhado

`packages/domain` é usado pelos **dois lados**, mas **o servidor é a única autoridade**:

- no servidor: valida, autoriza e grava;
- no app: calcula prévia/otimista para a interface e para o modo offline;
- o resultado do app **nunca** é aceito como verdade — o servidor recalcula e pode rejeitar.

Isso preserva as regras já confirmadas: IA não calcula saldo, permissão é validada no servidor,
e offline não confirma saldo oficial.

### Backend proposto

| Camada | Escolha proposta | Motivo |
|---|---|---|
| HTTP | **Fastify 5** | leve, tipado, validação por schema, testes com `inject()` sem abrir porta |
| Validação | **zod 4** (compartilhado em `contracts`) | mesma validação no app e no servidor, sem duplicar regra |
| Banco | **PostgreSQL** (driver `pg`) | transações e concorrência reais para dinheiro; **não** SQLite central |
| Acesso a dados | **Drizzle ORM** + migrations SQL versionadas | SQL explícito e auditável, sem engine binária surpresa; Prisma está em RC |
| Senhas | `node:crypto` **scrypt** (stdlib) | sem dependência nativa; parâmetros versionados no banco |
| Testes | `node --test` (domínio/API) + Vitest (UI) | domínio testável sem build |

*Alternativa rejeitada por ora:* NestJS + Prisma — mais estrutura pronta, porém mais peso, mais abstração e
dependência de RC; nada impede migrar depois, pois o domínio é independente.

### Banco central (regra explícita atendida)

- Banco **central compartilhado = PostgreSQL no servidor**, único lugar onde saldos oficiais existem.
- No dispositivo existe apenas **cache offline** (SQLite nativo / IndexedDB) que: nunca é fonte oficial,
  guarda operações pendentes em fila e é revalidado ao sincronizar.
- SQLite **não** substitui o banco central em nenhum cenário multiusuário.

## 5. API HTTP proposta (esboço)

```
POST   /auth/register            POST /auth/login        POST /auth/logout
GET    /auth/session             POST /auth/revoke-all   # encerrar todas as sessões

GET    /trips                    POST /trips             # criar (vira rascunho)
GET    /trips/:id                PATCH /trips/:id        # com version (concorrência otimista)
POST   /trips/:id/transition     # Em andamento/Concluída/Pendente/Cancelada (regras + auditoria)
GET    /trips/:id/members        POST /trips/:id/invites  POST /trips/:id/invites/:iid/cancel

GET    /trips/:id/changes?since=<cursor>                 # pull de mudanças para offline
POST   /trips/:id/sync                                   # push do outbox (idempotente)
```

- Toda escrita carrega `Idempotency-Key` (evita duplicação ao sincronizar).
- Toda alteração devolve `version` novo; `version` divergente = conflito **preservado para revisão**
  (nunca resolvido pelo relógio do dispositivo).
- Erros padronizados: `400` entrada inválida · `401` sem sessão · `403` sem permissão · `404` inexistente
  ou sem acesso · `409` conflito de versão/idempotência · `429` limite de tentativas.
- Respostas nunca incluem dados de outras viagens nem detalhes internos em mensagem de erro.

## 6. Autenticação (decisão: e-mail + senha)

- Senha com **scrypt** + salt por usuário; parâmetros e versão do algoritmo gravados na linha do usuário
  (permite endurecer depois sem invalidar contas).
- Sessão em **cookie HttpOnly** (`Secure` em HTTPS, `SameSite=Lax` na web); na web não há token em JS.
- Registro/login com **limite de tentativas** e mensagens genéricas (não revelar se o e-mail existe).
- Recuperação de senha e verificação de e-mail **não** entram nesta etapa (sem provedor de e-mail).
- No app nativo, a mesma mecânica depende de `CapacitorCookies` (ponte nativa) **ou** de token de acesso
  curto + refresh em armazenamento seguro. É uma das decisões pendentes de §12.

## 7. Offline e sincronização (estratégia)

- IDs gerados no cliente em **UUIDv7** (ordenação aproximada, sem depender do relógio para conflito).
- Fila local (**outbox**) com estado por operação: `pendente → enviada → aplicada | rejeitada | conflito`.
- Sincronização = *pull* incremental por cursor + *push* em lote do outbox.
- Regras atendidas: sem descarte silencioso, revalidação de permissões no servidor durante o sync,
  última sincronização visível, conflito vira item **“a revisar”** na interface.
- Sensíveis (documentos, localização) **não** entram no cache offline em claro.

## 8. Dinheiro (não negociável)

- Valores em **centavos inteiros** (`bigint`/`BIGINT` no Postgres); **nunca** float na verdade oficial.
- Rateio: métodos igualitário, participantes específicos, valores fixos e percentual; distribuição de
  centavos pelo método do resto, garantindo **soma exata** igual ao total.
- Moeda estrangeira preserva valor original, moeda, taxa, referência temporal e valor convertido.
- Tudo coberto por testes de limite (0, 1 centavo, resto grande, percentuais que não fecham).

## 9. Riscos

| # | Risco | Gravidade | Mitigação |
|---|---|---|---|
| 1 | Perda de tempo com stack nativa (Android/iOS) | alta | build nativo só quando houver fatia web funcionando; Android primeiro |
| 2 | iOS exige macOS + US$ 99/ano | alta (custo) | decidir antes de qualquer trabalho de iOS |
| 3 | Banco central + hospedagem com custo recorrente | alta (custo) | free tier/PC local até haver uso real; decidir antes de expor na internet |
| 4 | Offline/sync é o módulo mais complexo | alta | implementar depois do núcleo financeiro web; testar conflito e idempotência |
| 5 | Divergência de comportamento web × app (WebView) | média | uma base de código, revisão de segurança antes de dados reais |
| 6 | Migração para Postgres paga/limites de free tier | média | migrations versionadas e backup testado desde o início |
| 7 | Complexidade do monorepo para manutenção | média | workspaces simples, sem Turborepo/Nx nesta fase |
| 8 | HMR/preview no Arena | baixa | configuração validada nesta análise (403 → 200) |
| 9 | LGPD/retenção (documentos, localização) | alta | definir política antes de guardar dados reais de terceiros |
| 10 | Dependência de serviço de IA pago | média | IA entra **depois**, com limite de custo e fallback local |

## 10. Segurança e privacidade (regras que a implementação deve cumprir)

- Autorização em **toda** leitura/escrita, no servidor; testes negativos entre viagens (usuário A nunca vê B).
- HTTPS obrigatório antes de qualquer dado real de terceiros; em rede local, apenas dados sintéticos.
- Nenhum segredo no cliente ou no repositório; configuração por variável de ambiente (`.env` fora do Git —
  o DevKit já bloqueia).
- Logs sem PII, sem valores financeiros sensíveis e sem tokens; notificação de tela bloqueada sem detalhes.
- Trilha de auditoria para toda alteração financeira (autor, instante, antes/depois, motivo).
- Exclusão de conta ≠ exclusão de registros financeiros compartilhados (preservar histórico e pendências).

## 11. Decisões que ainda precisam de confirmação

Bloqueiam a próxima fatia: banco/ambiente de desenvolvimento, transporte de sessão no app nativo,
armazenamento offline e confirmação da primeira fatia. Registradas em
`DECISIONS_AND_OPEN_QUESTIONS.md`.

Podem esperar (não bloqueiam a primeira fatia): hospedagem definitiva, provedor de e-mail transacional,
observabilidade, publicação nas lojas (custos Apple/Google), fonte de câmbio, política de retenção,
provedor de IA e limites de custo, exportação PDF/planilha.

## 12. Próxima fatia (após aprovação)

1. Monorepo + `devkit.json` + `.gitignore` + configuração de Vite validada.
2. `packages/domain` com dinheiro, rateio (soma exata) e transições de estado + testes reais.
3. `apps/api` com autenticação, viagens, papéis/convites, autorização server-side e auditoria.
4. `apps/mobile` com login, lista/criação de viagem e troca de estado (dados reais da API).
5. `LiaGo.bat`: instala se faltar, roda testes, grava relatório em `reports/`, faz commit/rebase/push da
   branch de trabalho e abre PR quando pedido — tudo em um duplo clique.

## 12.1 O que já está implementado (verificado com testes)

| Área | Estado real | Evidência |
|---|---|---|
| Monorepo npm workspaces | ✅ | `package.json`, `tsconfig.base.json` |
| Domínio (dinheiro, rateio, estados, permissões, despesas, saldos, convites) | ✅ **54 testes** | `npm run test:domain` |
| API Fastify + PostgreSQL + SQL versionado | ✅ **29 testes** | `npm run test:api` (banco real) |
| Autenticação (scrypt, cookie HttpOnly na web, access/refresh no app, limite de tentativas) | ✅ | `apps/api/src/routes/auth.ts` |
| Viagens, participantes, convites, transições com autorização no servidor e auditoria | ✅ | `apps/api/src/routes/viagens.ts` |
| Despesas (pendente → confirmação por outra pessoa → contestação), rateio com soma exata, saldos e acertos | ✅ | `apps/api/src/routes/despesas.ts` |
| App web/mobile (React + Vite + Capacitor) com login, viagens, gastos e acertos reais | ✅ | `apps/mobile/` |
| Automação de um clique (`LiaGo.bat`) com banco, testes, relatório e sincronização | ✅ | `LiaGo.bat`, `tools/dev.mjs` |
| Android (SDK/JDK) | ⬜ | gera-se na máquina do responsável (`LiaGo.bat android`) |
| Offline com fila local (SQLite nativo) | ⬜ | próxima fatia; servidor já é idempotente e versionado |

**Decisão de implementação registrada (reversível):** o acesso a dados usa **SQL explícito + migrações
versionadas com o driver `pg`**, em vez de ORM. Motivo: menos dependências, queries auditáveis e nenhum
mapeamento implícito sobre dinheiro. Drizzle continua sendo uma opção caso a produtividade exija, sem
impacto no domínio (as regras ficam em `packages/domain`).

### Próxima fatia (proposta)
1. **Offline de verdade**: cache local (SQLite nativo/IndexedDB atrás de uma interface), fila de operações
   e sincronização por cursor (`/viagens/:id/changes` + push idempotente) — o servidor já está preparado.
2. Reservas manuais, checklist e documentos privados com compartilhamento revogável.
3. Roteiro por dia com revisão de impacto e versões anteriores.
4. App Android assinado para o grupo testar (dados sintéticos até haver HTTPS).
