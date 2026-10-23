# Arquitetura e análise de viabilidade — Lia Go

**Estado:** primeira fatia e **sincronização offline** implementadas e testadas (2026-10-12). Decisões de §11 respondidas pelo responsável:
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

## 4. Arquitetura implementada

Monorepo com **npm workspaces**, uma única linguagem (TypeScript) e regras de domínio compartilhadas:

```
Lia-Go/
├─ apps/
│  ├─ api/          # servidor: Fastify 5 + PostgreSQL (pg + SQL versionado) + auth + sync
│  └─ mobile/       # React 19 + TS + Vite 8 + Capacitor 8 (web e app no MESMO código)
├─ packages/
│  ├─ domain/       # regras puras: dinheiro, rateio, estados, roteiro, orçamento, fechamento — SEM I/O e SEM UI
│  └─ sync/         # motor offline local-first: fila outbox, conflito, carga e idempotência — SEM HTTP
├─ tools/           # automação de desenvolvimento, testes e DevKit
├─ docs/            # fonte de verdade
└─ LiaGo.bat        # automação de um clique no Windows
```

### Regra de ouro do domínio compartilhado

`packages/domain` é usado pelos **dois lados**, mas **o servidor é a única autoridade**:
- no servidor: valida, autoriza e grava em PostgreSQL;
- no app: calcula prévia/otimista para a interface e para o modo offline;
- o resultado do app **nunca** é aceito como verdade — o servidor recalcula e pode rejeitar.

| Camada | Escolha implementada | Motivo |
|---|---|---|
| HTTP | **Fastify 5** | leve, tipado, testes com `inject()` sem abrir porta |
| Banco central | **PostgreSQL** (`pg` + migrações SQL `0001`–`0008`) | transações reais para dinheiro; SQL explícito e auditável sem ORM |
| Senhas e sessão | `node:crypto` **scrypt** + cookie `HttpOnly` na web / tokens no app | sem dependência nativa; fallback em `sessionStorage`/headers quando embutido em iframe |
| Testes | `node --test` (domínio, sync, API, app e UI em jsdom) | ver `memory-bank/padroes.md` |

## 5. Dinheiro e segurança (não negociáveis)

- Valores em **centavos inteiros** (`bigint`/`BIGINT` no Postgres); **nunca** float na verdade oficial.
- Rateio pelo método do maior resto garantindo **soma exata** igual ao total; `calcularResumoFinanceiro` rejeita somar despesas de moedas diferentes sem conversão explícita.
- Mudanças em `packages/domain` que toquem `money`, `expense`, `split`, `balances`, `orcamento` ou `fechamento` exigem revisão humana obrigatória (`ALTO` para o `reviewer`).
- Autorização em **toda** leitura/escrita no servidor, com testes negativos entre viagens (404 para quem nunca teve vínculo; 403 para quem saiu/foi removido).
- HTTPS obrigatório antes de qualquer dado real de terceiros; em rede local, apenas dados sintéticos.

## 6. Riscos e mitigações

| # | Risco | Gravidade | Mitigação |
|---|---|---|---|
| 1 | Perda de tempo com stack nativa (Android/iOS) | alta | build nativo no Windows apenas quando a fatia web/testes estão verdes |
| 2 | iOS exige macOS + US$ 99/ano | alta (custo) | decidir antes de qualquer trabalho de iOS |
| 3 | Banco central + hospedagem com custo recorrente | alta (custo) | decisão aberta em `DECISIONS_AND_OPEN_QUESTIONS.md` (4 opções) |
| 4 | LGPD/retenção (documentos, localização) | alta | documentos privados por padrão; definir política antes de dados reais |
| 5 | Dependência de serviço de IA pago | média | V1 sem cliente de IA; 3 regras de provedor registradas |

## 7. O que está implementado e verificado com testes

| Área | Estado real | Evidência |
|---|---|---|
| Monorepo npm workspaces | ✅ | `package.json`, `tsconfig.base.json` |
| Domínio (dinheiro, rateio, estados, permissões, despesas, saldos, convites, roteiro, orçamento, revisão de impacto, reservas, checklist, documentos, fechamento, notificações) | ✅ **158 testes** | `npm run test:domain` |
| API Fastify + PostgreSQL + SQL versionado (migrações `0001`–`0008`) | ✅ **94 testes** | `npm run test:api` (banco real) |
| Autenticação (scrypt, cookie HttpOnly na web, access/refresh no app, limite de tentativas) | ✅ | `apps/api/src/routes/auth.ts` |
| Viagens, participantes, convites, transições com autorização no servidor e auditoria | ✅ | `apps/api/src/routes/viagens.ts` |
| Despesas (pendente → confirmação por outra pessoa → contestação), rateio com soma exata, saldos e acertos | ✅ | `apps/api/src/routes/despesas.ts` |
| App web/mobile (React + Vite + Capacitor) com login, viagens, gastos e acertos reais | ✅ | `apps/mobile/` |
| Automação de um clique (`LiaGo.bat`) com banco, testes, relatório e sincronização | ✅ | `LiaGo.bat`, `tools/dev.mjs` |
| Android (SDK/JDK) | ⬜ | gera-se na máquina do responsável (`LiaGo.bat android`) |
| Sincronização offline (fila de envio, cache local, conflito com decisão humana) | ✅ **49 testes** no pacote + 49 no app | `npm run test:sync`, `npm run test:app` |
| Sincronização incremental por cursor de sequência (`GET /viagens/:id/mudancas`) | ✅ 9 testes de API | `apps/api/src/routes/sincronizacao.ts` |
| Roteiro (atividades por dia, custo estimativa/compromisso/gratuito, conflitos explicados, concluir/cancelar/corrigir com motivo) | ✅ **21 testes** (9 domínio + 10 API + 2 sync) | `packages/domain/src/roteiro.ts`, `apps/api/src/routes/roteiro.ts`, `apps/mobile/src/telas/Roteiro.tsx` |
| Acertos registrados (informado → confirmado por quem recebeu) | ✅ | `POST /viagens/:id/movimentos` + tela Gastos |
| Interface de verdade em jsdom (app inteiro: trocar de viagem, "Sair", criar viagem (inclusive com rede instável), revisão de impacto, reserva vinculada e observações da atividade, reservas, orçamento com limite, checklist, documentos, fechamento, central de notificações, Visão geral com o hero, marca e barra inferior) | ✅ **45 testes** | `npm run test:ui` (`tools/teste-ui.mjs`) |
| Orçamento do roteiro (planejamento × dinheiro oficial) | ✅ `resumirOrcamentoDoRoteiro` + aba Gastos | `packages/domain/src/roteiro.ts` |
| Revisão de impacto antes de concluir/cancelar | ✅ `revisarImpacto` + bloco "Antes de continuar" | `telas/Atividade.tsx` |
| Reservas (hospedagem, transporte, passeio, outro) | ✅ **13 testes** de domínio + **8** de API + 4 de interface | `packages/domain/src/reserva.ts`, `apps/api/src/routes/reservas.ts`, `telas/Reservas.tsx` |
| Orçamento com limite coletivo/individual e barra (planejamento; nunca muda o saldo oficial) | ✅ **7 testes** de domínio + **7** de API + 4 de interface | `packages/domain/src/orcamento.ts`, `apps/api/src/routes/orcamento.ts`, `telas/Orcamento.tsx` |
| Checklist (prazo não conclui; reabrir com motivo) | ✅ **6 testes** de domínio + **8** de API + 3 de interface | `packages/domain/src/checklist.ts`, `apps/api/src/routes/checklist.ts`, `telas/Checklist.tsx` |
| Documentos privados por padrão (compartilhar, revogar, remover com motivo, lavagem da cópia local de quem perdeu acesso) | ✅ **7 testes** de domínio + **14** de API + 3 de interface | `packages/domain/src/documento.ts`, `apps/api/src/routes/documentos.ts`, `telas/Documentos.tsx` |
| Fechamento/exportação (números do servidor, acertos sugeridos, `.txt`/`.csv`) | ✅ **6 testes** de domínio + **2** de API + 3 de interface | `packages/domain/src/fechamento.ts`, `apps/api/src/routes/orcamento.ts`, `telas/Fechamento.tsx` |
| Referências visuais oficiais aplicadas (hero com a Lia, próximo compromisso, cartões do `concept-03`) | ✅ 2 testes de interface | `apps/mobile/public/lia-hero.jpg`, `telas/Viagem.tsx`, `styles.css` |
| Reserva vinculada à atividade (uma reserva por atividade, recusa de vínculo cruzado/cancelado) e observações da atividade | ✅ **6 testes** de domínio + **6** de API + 5 de interface | `apps/api/migrations/0008_atividade_reserva.sql`, `packages/domain/src/roteiro.ts`, `telas/Roteiro.tsx`, `telas/Atividade.tsx` |
| Marca e ícones: pino oficial em SVG no app, imagem oficial como favicon/ícone, Lucide na barra inferior (ícone **com** rótulo) | `componentes/Marca.tsx`, `styles.css`, `index.html` | Identidade paralela (o antigo ponto colorido) e ícone-no-lugar-de-texto: quem informa o destino é a palavra, e o estado ativo continua em `aria-current` |
| Central de notificações (tela 16): derivada dos dados, filtros, ler ≠ dispensar ≠ resolver, mesmo número no Início | ✅ **42 testes** de domínio + 9 de interface | `packages/domain/src/notificacao.ts`, `apps/mobile/src/services/use-notificacoes.ts`, `telas/Notificacoes.tsx` |

**Cuidado medido em execução:** uma instalação parcial de dependências (pasta `node_modules` existente
mas incompleta) fazia os testes falharem com `Cannot find package 'pg'`. A automação agora confere
pacote por pacote antes de pular o `npm install`.

**Decisão de implementação registrada (reversível):** o acesso a dados usa **SQL explícito + migrações
versionadas com o driver `pg`**, em vez de ORM. Motivo: menos dependências, queries auditáveis e nenhum
mapeamento implícito sobre dinheiro. Drizzle continua sendo uma opção caso a produtividade exija, sem
impacto no domínio (as regras ficam em `packages/domain`).

### Offline: como funciona (implementado)

O princípio: **o aparelho é a verdade imediata; o servidor é a verdade compartilhada.** Usar o app com
ou sem internet passa pelo mesmo caminho de código (`packages/sync` + `apps/mobile/src/offline/`).

| Peça | O que faz |
|---|---|
| Fila de envio (`packages/sync/src/fila.ts`) | toda escrita entra na fila antes de sair; `aguardando → enviando → sincronizado / falhou / conflito` |
| Idempotência | a chave enviada é o **id da operação**: reenviar depois de queda de rede nunca aplica duas vezes (o servidor já garante) |
| Ordem causal | a fila é enviada na ordem de criação; uma alteração que espera o relógio bloqueia as seguintes, mas o que precisa de decisão humana **não** trava o resto |
| Recuo exponencial | 2s, 4s, 8s… até 5 min; erro de rede volta para a fila, erro de regra de negócio para de tentar e aparece para a pessoa |
| Cursor de mudanças | `auditoria.id` (sequência), nunca horário: relógio de celular errado não faz ninguém perder dado. Resposta paginada (`temMais`) |
| Cursor por viagem | ao abrir outra viagem o cursor **e** a carga da anterior saem (`trocarViagemAberta`); a versão só é comparada dentro da mesma viagem |
| Uma passada por vez, sem avalanche | pedidos feitos durante uma passada esperam **a mesma** passada seguinte (`sincronizarAgora`, coalescência); antes, cada pedido criava uma passada e a tela ficava presa em "Confirmando a viagem com o servidor…" |
| Nada criado durante a passada é perdido | a fila é relida no fim e o que apareceu no meio é preservado (`juntarFilaDaPassada`) |
| Conflito | `409 conflito_versao` com `detalhes.versaoAtual`; a tela mostra as duas versões e a pessoa escolhe. **Dinheiro nunca é resolvido sozinho** |
| Cache local | IndexedDB (web) ou armazenamento do app (nativo), atrás de `ArmazenamentoLocal` — uma interface, três implementações (a terceira é memória, para testes) |
| Cache de versão anterior | ao ler do aparelho, a carga é completada com as listas que existem hoje (`cargaCompleta`): quem atualiza o app tem cache velho, e cache velho não pode derrubar tela |
| Saldos | sempre calculados no servidor; o aparelho guarda a última informação conhecida e mostra quando ela é de |

Arquivos: `packages/sync/src/{tipos,fila,conflito,carga,motor}.ts`,
`apps/mobile/src/offline/{armazenamento,servidor,sincronizador}.ts`,
`apps/mobile/src/componentes/BarraSincronizacao.tsx`.

**Onde o cofre fica (decisão registrada).** Tokens de sessão: cookie HttpOnly na web; Android Keystore /
iOS Keychain no app nativo, com aviso honesto quando o aparelho não oferece armazenamento seguro.
Dados de viagem em cache: arquivos internos do app (no iOS já são cifrados pela proteção de dados do
sistema). **Próximo passo nativo:** banco local criptografado (SQLCipher com chave no Keystore) — troca
de **um arquivo** (`apps/mobile/src/offline/armazenamento.ts`), motivo e contexto em
`DECISIONS_AND_OPEN_QUESTIONS.md`.

### Roteiro: por que a estrutura é essa (implementado)

O roteiro não é uma lista de compromissos com horário obrigatório — é o **plano do dia**, que pode ser
reorganizado pela vida real. As decisões abaixo vêm de `docs/UI_VISUAL_GUIDELINES.md` §2 e estão no
código, não só no documento:

| Regra de negócio | Onde vive | Por que assim |
|---|---|---|
| Atividade pode ser **flexível** (`hora: null` + `ordem`) | `packages/domain/src/roteiro.ts` | Não inventamos horário para preencher tela; a ordem preserva a intenção |
| O relógio **não** conclui atividade | `concluirAtividade` exige autor e ação explícita | Passar do horário não prova que aconteceu — quem sabe é a pessoa |
| Custo tem **natureza**: `estimativa`, `compromisso`, `gratuito`, ou **desconhecido** | `custoParaMostrar` + CHECKs na migração `0003` | Desconhecido ≠ zero ≠ gratuito; o resumo mostra `custoConhecidoCentavos` e sinaliza `temCustoAVerificar` |
| Conflito é **explicado**, nunca resolvido sozinho | `conflitosDoDia` (sobreposição, deslocamento insuficiente) | O app sugere o ajuste e espera a decisão; remarcar sozinho quebra a confiança |
| Concluir/cancelar/corrigir exigem **motivo** (≥5 caracteres na correção/cancelamento) | rota + domínio | Histórico serve para aprender, não para apagar |
| A atividade pode apontar para a **reserva** que a cobre, e a ficha mostra a evidência que já existe | `atividades.reserva_id` (migração `0008`), `exigirReservaDaViagem` na rota | Vínculo cruzado mostraria evidência de outra viagem; reserva cancelada não sustenta compromisso — as duas coisas são recusadas com motivo |
| Anexar reserva **não** confirma reserva nem muda a natureza do dinheiro | `vinculada` (domínio) e teste de API "sem mexer na reserva em si" | Confirmar exige evidência (decisões V1 §13); o vínculo é só um ponteiro para o que já existe |
| Observação da atividade é texto livre (também usada para acessibilidade) | `atividade.observacao`, campo no formulário e na correção | Um segundo campo livre para acessibilidade seria o mesmo dado com dois lugares para divergir |
| Toda transformação da fila acontece numa **seção crítica** do armazenamento (`mutar`/`mutarFila`) | `ArmazenamentoSync.mutarFila`, `ArmazenamentoLocal.mutar` (uma transação no IndexedDB) | Ler e gravar separados perdiam a operação que entrasse no intervalo: a viagem criada durante uma passada desaparecia sem erro na tela (defeito de 2026-10-16) |
| Antes de concluir/cancelar, a tela mostra o **impacto conhecido** | `revisarImpacto` + bloco "Antes de continuar" | `UI_V1_DECISIONS` §13: a interface não pode insinuar que algo externo aconteceu nem mudar dinheiro oficial por conta própria |
| Depois do cancelamento da viagem, **registrar o que houve com o que já existia** continua permitido | `PERMITIDAS_APOS_CANCELAMENTO` (`atividade:concluir/cancelar/corrigir`) | Viagem cancelada não recebe plano novo, mas o passado aconteceu — mesma lógica das despesas |
| Viagem concluída bloqueia `atividade:criar` | `packages/domain/src/permissions.ts` | Não se planeja o que já terminou |

**Texto da tela separado do JSX.** As regras de exibição do roteiro (horário flexível, custo
desconhecido × a verificar × sem custo, trecho compacto × aberto, manchete do conflito, resumo do dia)
vivem em `apps/mobile/src/services/roteiro-texto.ts` — funções puras, testadas sem navegador. Motivo
prático: regra de dinheiro dentro de `.tsx` não tem teste; fora, tem 10.

Rotas: `GET /viagens/:id/roteiro`, `GET /viagens/:id/atividades/:atividadeId`,
`POST /viagens/:id/atividades`, `POST /viagens/:id/atividades/:atividadeId/{concluir,cancelar,corrigir}`.
Atividades também entram no fluxo offline (`atividades` em `packages/sync/src/carga.ts`) — a mesma fila,
o mesmo cursor, a mesma idempotência das despesas.

### Reservas: por que a estrutura é essa (implementado)

Uma reserva **nasce prevista** e só passa a confirmada com **evidência** (localizador, código,
comprovante) — `docs/UI_V1_DECISIONS.md` §13 diz "não confirmar reserva automaticamente" e a interface
não pode dar a entender que o app falou com o hotel. O que muda ao confirmar é a **natureza** do
dinheiro (estimativa → compromisso), nunca o valor; cancelar exige motivo, preserva a evidência e a
tela avisa que **não** cancela no fornecedor. Valor desconhecido é `null` (nada de `R$ 0,00`).

| Regra | Onde vive |
|---|---|
| Nasce prevista; confirmar é ação separada com evidência (≥3 caracteres) | `criarReserva` / `confirmarReserva` |
| Cancelar exige motivo (≥5) e não apaga a confirmação do histórico | `cancelarReserva` |
| Confirmada = compromisso; prevista = estimativa; `null` = desconhecido; `0` = gratuito | `naturezaDaReserva` |
| Resumo separa estimativa de combinado e ignora cancelada | `resumirReservas` |
| Confirmar/cancelar mostram impacto antes (e "não cancela no fornecedor") | `revisarImpactoDaReserva` |
| Banco recusa confirmada sem evidência/autor/hora e cancelada sem motivo | migração `0004_reservas.sql` (CHECKs) |

Rotas: `GET /viagens/:id/reservas`, `GET /viagens/:id/reservas/:reservaId` (com histórico),
`POST /viagens/:id/reservas`, `POST .../{confirmar,cancelar}`. Reservas entram no `/mudancas` pelo
cursor (mesmo caminho offline do roteiro) e passam pela fila do aparelho.

### Central de notificações: por que a estrutura é essa (implementado)

A central **não é uma caixa de mensagens**: não existe tabela de notificações no servidor nem cópia
guardada. O que existe é um cálculo (`packages/domain/src/notificacao.ts`) sobre o que já está no
aparelho — pendências financeiras, convites, acertos, checklist, reservas, orçamento e viagens em
rascunho. Assim a lista nunca "desatualiza sozinha": se o fato mudou, a lista mudou.

| Regra de negócio | Onde vive | Por que assim |
|---|---|---|
| **Leitura ≠ dispensa ≠ resolução** (tela 16) | `estadoDaNotificacao`, `marcarNotificacao`, `notificacoesResolvidas` | Ler é "eu vi"; dispensar é "não me lembre agora"; resolver só acontece quando o **fato** muda — o app não deixa ninguém "marcar como resolvido" um problema que continua |
| Dispensar não esconde piora | chave com a revisão do fato (`despesa-pendente:<viagem>:<quantidade>`, `acerto-confirmar:<id>:<valor>`, `orcamento-estourado:<viagem>:<percentual>`) | Quem dispensou 2 despesas pendentes precisa saber das 3 de agora; a antiga passa para o histórico de resolvidas |
| Um número só para a pessoa | `apps/mobile/src/services/use-notificacoes.ts` (usado pelo Início e pela central) + marcas por usuário (`notificacoes:<usuarioId>`) | Duas contagens diferentes na mesma tela quebram a confiança no aviso |
| Prioridade em **texto**, nunca só cor | `PRIORIDADES_NOTIFICACAO` + etiqueta "Alta prioridade" | `UI_VISUAL_GUIDELINES` §10 |
| Nada de ação externa insinuada (§13) | `DestinoNotificacao` → tela do app; textos dizem o que **não** aconteceu | Convite enviado não é aceite; acerto a confirmar não move dinheiro; valor pendente não entra no saldo oficial |
| Notificação de dinheiro só com dado do servidor | `pendenciasFinanceiras` do resumo da viagem | Notificação de saldo não pode nascer de conta feita no cliente |
| Marca gravada enquanto se lê não se perde | fila de gravação do hook (soma ao que já estava guardado antes da leitura terminar) | Defeito encontrado pelo teste de tela: a leitura atrasada apagava o clique e o item dispensado voltava |
| Voltar para o app busca novidade | `apps/mobile/src/App.tsx` (`visibilitychange` → `sincronizarAgora`) | Sem isso a central ficava velha justamente quando a pessoa olha para ela |

Rotas: nenhuma nova — a central lê o que o sincronizador já mantém (`GET /viagens`, `GET /viagens/:id/mudancas`).

### Próxima fatia (proposta)
1. **Configurações** (tela 18) — a única tela V1 que falta por completo; inclui preferências de
   notificação e o limiar de atenção do orçamento configurável (hoje fixo em 80%).
2. **Substituir o roteiro vigente com revisão de impacto** (prévia de diferenças e versões anteriores) — o impacto de concluir/cancelar já existe.
3. Navegação lateral da web e aba **Documentos** própria na barra inferior do celular (hoje na aba Mais).
4. App Android assinado para o grupo testar (dados sintéticos até haver HTTPS).
