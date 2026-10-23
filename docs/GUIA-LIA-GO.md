# Guia — mobile e web (Lia Go)

Resposta à pergunta: *"os guias cobrem criar um ambiente mobile e a conexão opcional com a
Waifu?"*

Escrito em 18/10/2026, lendo `BloomRX/Lia-Go`, branch `arena/f1ac5ed6-lia-go`
(`f15de67cc0`).

---

# 1. Resposta curta

**Cobrem mais ou menos 70%. E a parte que falta é justamente a que eu escrevi com mais
detalhe.**

| Parte dos guias | Vale no Lia Go? |
|---|---|
| Como a sessão trabalha — subagents, skills, memória, 9Router, divisão git/máquina | **100%. Igual.** |
| Contrato da marca, licença, README honesto, `CLAUDE.md` curto | **100%.** |
| Provedor/modelo: endereço configurável, nunca embutir, nunca embarcar chave | **100%.** |
| Conexão opcional com a Waifu — as seis cláusulas | **O contrato vale. O mecanismo é outro.** |
| **Padrão de pastas `C:\Users\<nome>\Lia\`, junction, registro, `lia.json`** | **Quase nada. Celular não tem isso.** |
| Instalação por usuário, `.exe`, desinstalador | **Não. É loja de aplicativo.** |
| `visual-qa` | **Vale, com um buraco sério no iOS.** |

E tem três coisas que o Lia Go precisa e **nenhum** dos outros apps precisa. Seção 7.

---

# 2. O que eu encontrei no repositório

Antes de apontar buraco, o que já está certo — e é bastante:

- **Monorepo npm workspaces**, Node ≥ 22.12, TypeScript.
- **`packages/domain`** — regra de negócio pura e separada do app: `money`, `expense`,
  `split`, `balances`, `orcamento`, `roteiro`, `reserva`, `checklist`, `documento`,
  `notificacao`, `permissions`, `trip-state`, `fechamento`. **Cada um com teste.**
- **`packages/sync`** — motor de sincronização próprio: `fila`, `conflito`, `carga`,
  `motor`, com testes. Offline não é promessa, já é código.
- **`apps/mobile`** — React + Vite + **Capacitor**, com `src/offline/` (armazenamento,
  servidor, sincronizador), notificações locais e detecção de plataforma.
- **`apps/api`** — Node/TS com migrações SQL numeradas, `auth`, `authz`, `audit`.
- **Testes de UI** com servidor falso (`tests/ui/servidor-falso.ts`, 25 KB).
- `docs/PRODUCT_OVERVIEW.md` com "Princípios de confiança" e **"Não objetivos da V1"** —
  a mesma honestidade dos outros repositórios.
- `docs/ARCHITECTURE.md` §8 chama-se **"Dinheiro (não negociável)"**. Ótimo sinal.

## 2.1 E uma coisa que o Lia Go já faz certo e o Lia-Project não

O `AGENTS.md` da raiz do Lia Go tem **456 bytes**. Ele diz, em três linhas, que as regras
estão em `docs/AGENTS.md` e que o arquivo da raiz **não contém regras próprias**.

É exatamente o padrão que eu recomendei para o Lia-Project — que hoje carrega 58 KB na
raiz, recarregados a cada mensagem. **O seu repositório mais novo já nasceu com o
conserto.** Vale copiar a solução de volta para o mais antigo.

## 2.2 E uma confirmação do que eu tinha deduzido

Comentário dentro de `apps/mobile/capacitor.config.ts`:

> *"O Android só é gerado na máquina do desenvolvedor (`npm run cap:add:android`), porque
> exige Android SDK/JDK e não roda no Arena."*

É a divisão git/máquina da seção 3 do `03-GUIA-APP-NOVO.md`, descoberta na prática por
quem estava lá. A sessão produz o código; **a build nativa é sua**. Nenhum guia muda isso
— só precisa estar escrito para não virar surpresa.

---

# 3. O que não carrega: o padrão de pastas

As seções 3, 4 e 5 do `00-PADRAO-DA-MARCA.md` são **desktop Windows puro**. No celular
praticamente nada delas existe:

| Mecanismo do padrão | No celular |
|---|---|
| `C:\Users\<nome>\Lia\` visível | **não existe.** Cada app vive numa caixa fechada |
| Junction | **não existe** |
| Registro `HKCU\Software\Lia` | **não existe** |
| `%APPDATA%\Lia\lia.json` lido por outro app | **não existe.** Um app não lê o dado do outro |
| Instalação por usuário sem admin | vira **loja**, com revisão e assinatura |
| Desinstalador que pergunta | o sistema desinstala; você não controla o diálogo |

No Android o armazenamento é com escopo; no iOS é mais fechado ainda. **Essa separação é
proposital e é a favor do usuário** — mas significa que "achar onde o outro app da Lia
está" simplesmente não é a mesma operação.

## 3.1 O que substitui a descoberta: pareamento

No desktop, um app novo **descobre** o anterior lendo um bilhete em lugar fixo. No celular,
o equivalente honesto é:

| Caminho | O que é | Vale a pena? |
|---|---|---|
| **Link profundo** (`liago://`) | um app abre o outro passando um pedido | sim, é o mais simples e já funciona no Capacitor |
| **Compartilhar do sistema** | o usuário manda dado de um pro outro pela folha de compartilhamento | sim, zero acoplamento |
| **Conta** | os dois entram na mesma conta e se acham pelo servidor | só se já existir servidor — e aqui existe |
| **Rede local** | se acham no mesmo wi-fi | serve pra falar com a Waifu no PC, ver seção 6 |
| Pasta compartilhada | — | **não existe** |

Para a marca, a regra vira: **no desktop os apps se descobrem; no celular eles se
apresentam.** O usuário autoriza uma vez, e o pareamento fica guardado.

---

# 4. A bancada: o que muda e o que não muda

## 4.1 Não muda nada

Claude Code, os quatro ajudantes, skills em `.agents/skills/` com junction para
`.claude/skills/`, memória, 9Router atrás, permissões com `deny`. **Tudo igual.** O fluxo
de trabalho é agnóstico de stack — é a mesma bancada para Godot, para Vue, para React
Native ou para Capacitor.

## 4.2 `test-runner`: fixe o comando, porque são seis suítes

O `package.json` tem `test:tools`, `test:domain`, `test:sync`, `test:app`, `test:ui`,
`test:api` e um `test` que roda os seis em sequência. Rodar tudo em toda verificação é
caro e lento.

Em `memory-bank/padroes.md`:

```
Mexeu em packages/domain      -> npm run test:domain
Mexeu em packages/sync        -> npm run test:sync
Mexeu em apps/api             -> npm run test:api
Mexeu em apps/mobile (lógica) -> npm run test:app
Mexeu em tela                 -> npm run test:ui
Antes de publicar             -> npm test  e  npm run typecheck
```

O `devkit.json` já declara `full_tests` com `npm test` + `npm run typecheck`. O
`test-runner` deve usar a suíte **estreita** no dia a dia e a completa só no portão.

## 4.3 `visual-qa`: o melhor caso e o pior caso, no mesmo projeto

| Alvo | Como sai o print | Funciona? |
|---|---|---|
| **Web** | screenshot da página | **o caso mais fácil que existe.** Sem engine, sem emulador |
| **Android** | emulador + `adb exec-out screencap` | **funciona no Windows**, com Android SDK instalado |
| **iOS** | simulador | **exige macOS.** Não tem jeito no Windows |

O iOS é um buraco real e não adianta contornar com criatividade: ferramenta de build da
Apple roda em máquina da Apple. As saídas são ter um Mac, alugar um Mac na nuvem, ou
aceitar que o iOS só é validado mais tarde — **e dizer isso no README em vez de deixar
implícito**.

A boa notícia é que, como a base é a mesma (Capacitor serve a mesma web), o `visual-qa` na
versão web pega a enorme maioria dos defeitos visuais antes de qualquer empacotamento. É
a ideia do Stefan — HTML como camada barata de iteração — e aqui ela não é truque, é a
arquitetura do projeto.

## 4.4 Divisão git/máquina, agora com nomes

| Quem | O quê |
|---|---|
| a sessão, por git | `packages/`, `apps/api`, `apps/mobile/src`, testes, migrações, docs |
| **você**, na sua máquina | `npm run cap:add:android`, build nativa, emulador, assinatura, envio pra loja, qualquer teste em aparelho |

A sessão **não pode** afirmar que o app funciona no Android ou no iOS. O máximo honesto é
*"testes verdes; build nativa não executada"*.

---

# 5. Loja, não instalador

| | Desktop | Celular |
|---|---|---|
| Entrega | `.exe` que você assina e publica | loja, com revisão humana |
| Custo | zero | **conta de desenvolvedor custa dinheiro** — Apple cobra anualmente, Google cobra uma vez |
| Correção urgente | sobe novo `.exe` | espera a revisão |
| Controle do desinstalador | seu | do sistema |

Dois pontos específicos:

**(a) App em Capacitor é aceito**, mas as lojas reprovam "site embrulhado" sem valor
nativo. Vocês já têm notificações locais e offline real, que é exatamente o que elas
procuram. Vale manter isso visível na descrição.

**(b) Cuidado com a ligação de marca na listagem.** O Lia Go é um app de viagem — risco
baixo. Mas descrever na loja que ele se conecta a uma "companheira virtual" muda a
categoria aos olhos de quem revisa, especialmente na Apple. **Separe as listagens.** A
conexão com a Waifu é um recurso opcional dentro do app, não a proposta de valor na
página da loja.

---

# 6. A conexão com a Waifu: aqui é rede, não pasta

No desktop a pergunta era *"em que pasta o outro app está?"*. No celular a pergunta é
**"em que máquina ele está, e como eu chego lá?"** — porque a Waifu roda no PC e o celular
está em outro lugar.

## 6.1 A escada, do barato ao caro

| Nível | Como | Custo | Quando |
|---|---|---|---|
| **0. Nada** | o Lia Go não fala com a Waifu | zero | **V1** |
| **1. Mesma rede** | celular acha o PC no wi-fi de casa, pareamento com código | zero | V2 |
| **2. Rede privada** (Tailscale/WireGuard) | funciona de qualquer lugar, sem abrir porta | zero pro seu bolso; exige instalação do usuário | V3 |
| **3. Relay na nuvem** | você hospeda o intermediário | **conta mensal sua, pra sempre** | só com plano de custo |

**Precedente verificado:** o Mr. Mak Workspace (MIT, v0.5.1) faz exatamente o nível 2 —
celular acompanha os agentes que rodam no computador, conectado por **Tailscale**. Está
entregue e funcionando. Não é teoria.

**Recomendação:** V1 sem conexão nenhuma. O Lia Go precisa ser um bom app de viagem antes
de ser um app conectado — e a cláusula 1 do contrato da marca já exige que ele funcione
sozinho. Nível 3 só com conta paga planejada; num app grátis, relay é a despesa que
cresce com o sucesso.

## 6.2 O contrato continua valendo, igual

As seis cláusulas do `03-GUIA-APP-NOVO.md` §6.1 não mudam no celular:

1. ausência é normal; 2. ponte declarada por verbos curtos; 3. **conversa não é
autorização**; 4. a cadeia inteira aparece no pedido; 5. dado atravessa por categoria,
com opt-in e revogação; 6. ponte caída, os dois continuam.

A cláusula 3 fica **mais** importante aqui, porque o Lia Go mexe com **dinheiro de outras
pessoas**. *"Lia, registra aí o que eu gastei"* não pode virar um lançamento confirmado
sem o usuário ver e aceitar. O seu `PRODUCT_OVERVIEW.md` já diz: *"IA recomenda; usuários
autorizados decidem"*. É a mesma regra — só precisa valer também quando o pedido vem da
Waifu em vez de vir da tela.

---

# 7. Três coisas que o Lia Go tem e os outros não

## 7.1 Ele precisa de servidor — e isso contradiz "baixei e abri"

Viagem em grupo, convite, permissão aplicada no servidor, rateio entre participantes: isso
**exige** um servidor. Tem `infra/docker-compose.yml` e `apps/api` no repositório.

A Waifu e o Studio rodam inteiros na máquina do usuário. O Lia Go, não. Isso traz uma
pergunta que nenhum outro app da marca tem:

> **Quem hospeda, e quem paga?**

Não vou fingir que existe resposta óbvia. As opções reais:

| Opção | Consequência |
|---|---|
| Você hospeda de graça | conta mensal sua, que **cresce com o sucesso** |
| Modo solo 100% local, grupo exige servidor | o app grátis funciona sozinho; grupo vira recurso pago ou auto-hospedado |
| Auto-hospedagem | o `docker-compose` já existe; público pequeno, mas custo zero |
| Conta paga | sai do "gratuito" |

**Isto é decisão de produto, não técnica, e é bom decidir antes de a base de usuários
existir.** Vale virar uma entrada no `DECISIONS_AND_OPEN_QUESTIONS.md` se ainda não for.

## 7.2 Offline não é recurso, é sobrevivência

Avião. Roaming caro. País estrangeiro sem chip. Metrô. Bateria no fim e modo economia.

**O app de viagem é usado exatamente onde não há internet.** Vocês já trataram isso a
sério — `packages/sync` com fila, conflito e motor próprios, mais `apps/mobile/src/offline/`.
Está no lugar certo.

Duas regras que eu acrescentaria, se já não estiverem escritas:

1. **Toda função central lê e escreve offline.** Roteiro, checklist, despesa, documento.
   Sincronizar é bônus, nunca pré-requisito.
2. **A IA é a primeira coisa a cair sem sinal — e o app não pode cair junto.** Se a Lia
   deixar de responder, o roteiro ainda abre e a despesa ainda é lançada. Qualquer tela
   que só funcione com modelo disponível é uma tela que falha na viagem.

## 7.3 Dinheiro de verdade muda a régua do agente

Os outros dois apps mexem com arquivo. Este mexe com **dinheiro de outras pessoas**, e
erro de rateio vira briga entre amigos.

Vocês já marcaram `ARCHITECTURE.md` §8 como "não negociável" e separaram `packages/domain`
com `money`, `split` e `balances` testados. Isso é o certo.

A regra de agente que eu acrescentaria:

> **Mudança em `packages/domain` que toque dinheiro — `money`, `expense`, `split`,
> `balances`, `orcamento`, `fechamento` — nunca é aplicada sem revisão humana, mesmo com
> teste verde.** O `reviewer` marca como ALTO por padrão nesses arquivos.

Arredondamento, moeda e divisão com resto são as três fontes clássicas de erro silencioso
em rateio. Teste verde não prova que a conta está certa — prova que ela está igual ao que
alguém escreveu no teste.

---

# 8. O que fazer com os guias

| Documento | No Lia Go |
|---|---|
| `00-PADRAO-DA-MARCA.md` §1 (dependências) | **vale**, adaptado: aqui é Node/npm, não pip |
| `00` §2 (dois caminhos de entrega) | **vale em espírito**: web e app nativo da mesma base |
| `00` §3, §4, §5 (pastas, `Lia\`, descoberta) | **não vale.** Substituído pela seção 3 deste guia |
| `00` §6 (divisão git/máquina) | **vale, e já foi confirmado** no `capacitor.config.ts` |
| `03-GUIA-APP-NOVO.md` §1, §2, §3, §5, §6, §7, §8 | **valem** |
| `03` §4 (pastas e instalação) | **não vale.** Ver seção 3 e 5 daqui |

**Nenhum guia precisa ser reescrito.** Este documento é o apêndice mobile deles.

---

## O que não foi verificado

- **Nada foi executado.** Nenhuma build, nenhum teste, nenhum emulador.
- Li: a árvore completa, `AGENTS.md` da raiz, `package.json`, `devkit.json`,
  `capacitor.config.ts`, `PRODUCT_OVERVIEW.md` e os títulos de `ARCHITECTURE.md` e
  `docs/AGENTS.md`. **Não li** o `DECISIONS_AND_OPEN_QUESTIONS.md` (39 KB), o
  `ARCHITECTURE.md` inteiro (30 KB) nem o código dos pacotes.
- Por isso: **parte do que eu sugiro nas seções 7.1 a 7.3 pode já estar decidido** nesses
  documentos. Confira antes de tratar como novidade.
- **Custos e regras de loja mudam.** Confirme os valores atuais de conta de
  desenvolvedor direto na Apple e no Google antes de planejar orçamento.
- **O comportamento de revisão da Apple** sobre apps de companhia é tendência observada,
  não regra publicada. Trate como risco a mitigar, não como fato.
- **Tailscale no Mr. Mak** está no README deles; eu não rodei.
