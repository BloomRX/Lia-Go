# Como rodar o Lia Go — guia único de execução

> Para o dia a dia no Windows: **dê dois cliques em `LiaGo.bat`. Só isso.** Nenhuma escolha no meio do
> caminho: ele baixa a versão nova do GitHub, instala o que falta, sobe o banco, roda os testes, grava o
> relatório (`reports/relatorio-*.md`) e o diagnóstico do computador (`reports/estado-do-computador.md`),
> envia tudo para o GitHub e deixa o app no ar (`http://localhost:3000` e `http://localhost:5273`).
> A rodada é dividida em **7 etapas numeradas** (`[3/7] Banco de dados`), o download do banco mostra
> **barra de progresso com velocidade** e, quando um passo fica quieto por 15 segundos, aparece
> `⏳ ainda trabalhando` — ou seja, nunca é preciso adivinhar se travou.
> Na última etapa, cada linha da API e do app web vem identificada (`[api]` / `[app]`) e a tela termina com
> um **resumo da rodada** (banco, testes, relatório, envio e tempo total). No Windows, o **navegador abre
> sozinho** no endereço do app (desliga com `LIA_ABRIR_NAVEGADOR=0`).
> As opções manuais ficam em `LiaGo.bat menu`; o mesmo conjunto existe em qualquer sistema com
> `node tools/dev.mjs <comando>`.

## 1. Primeiros passos dentro do app

A primeira tela é a entrada do próprio Lia Go — **não existe serviço externo nem conta em nuvem**: tudo roda
no seu computador (banco local, dados sintéticos). Para começar:

1. **Criar conta** (botão abaixo de "Entrar"): nome, um e-mail qualquer (nada é enviado — ainda não há
   provedor de e-mail) e uma senha com **pelo menos 10 caracteres**. Você entra direto, já conectado.
2. **Criar viagem**: nome e destino ("Viagem de teste", "Ubatuba") e "Salvar rascunho". Abra a viagem e use
   "Planejada" para tirá-la do rascunho — é quando ela passa a aceitar despesas.
3. **Convidar pessoa** (dentro da viagem): informe o e-mail de quem vai participar. O convite aparece **uma
   vez**, com um token: quem receber cria a própria conta com **aquele mesmo e-mail** e cola o token em
   "Recebeu um convite? Cole o link/token".
4. **Nova despesa**: descrição, valor (ex.: `87,50`), compartilhada ou pessoal, e quem pagou. Despesa nova
   nasce **pendente** e só entra no saldo depois que **outra pessoa** confirma (quem lançou não confirma o
   próprio lançamento).
5. **Saldos e acertos**: a viagem mostra o saldo oficial e os acertos sugeridos. Nada é transferido de
   verdade: o Lia Go só sugere, o pagamento acontece fora do app.
6. **Roteiro**: aba **Roteiro** → "+ Adicionar". O título é o único campo obrigatório. Deixe **"Horário a
   definir"** marcado (ou desmarque para escolher hora) — a atividade fica na sequência sem horário
   inventado. Marque "Custo ainda a verificar" para exercitar o caso de custo desconhecido (a tela mostra
   *a verificar*, nunca `R$ 0,00`). Ao salvar, o item entra na timeline do dia.
7. **Detalhes da atividade**: toque no item da timeline (ou em "+ Adicionar" → salvar e tocar). Ali ficam
   dia, horário, duração, local, deslocamento e custo com a natureza (**estimativa**, **valor já
   combinado** ou **sem custo**). É nesta tela que se **conclui** (com observação), **cancela** e
   **corrige** (pedindo motivo) — o relógio sozinho nunca conclui nada.
8. **Ver o conflito**: crie duas atividades no mesmo dia com horários que se sobrepõem. O dia ganha o
   marcador **⚠ conflito** e o resumo do dia explica quem bate com quem, sugerindo o ajuste — o Lia Go
   **não** remarca por conta própria.

> Esqueceu a senha? Como os dados são sintéticos, basta criar outra conta com outro e-mail — a recuperação
> automática depende do provedor de e-mail, que ainda é uma decisão pendente.

## 2. O que você precisa instalar (uma vez)

| Item | Versão mínima | Para quê | Obrigatório? |
|---|---|---|---|
| Node.js | **22.12+** (LTS) | rodar API, app e testes | sim |
| Docker Desktop | atual | PostgreSQL local em contêiner (`npm run db:up`) | recomendado (padrão para quem já usa) |
| Python 3.10+ | — | apenas o DevKit (git seguro, sincronização) | recomendado |
| Android Studio + JDK 21 | Otter 2025.2.1+ | gerar o app Android | só quando for gerar o app |
| Android SDK 36 (minSdk 24) | — | build Android | só quando for gerar o app |

**Sem Docker o projeto continua funcionando.** O Lia Go sobe o banco nesta ordem:

1. **Docker**, se estiver disponível (o padrão do dia a dia);
2. binários do PostgreSQL **já instalados** na máquina (`PG_BIN=...` ou pastas padrão);
3. **PostgreSQL portátil**: baixa uma única vez (~12 MB, em `.pgbin/`, fora do Git) os binários prontos
   publicados no PyPI, extrai e usa — **sem Docker, sem administrador e sem depender do Python instalado**;
4. `DATABASE_URL`/`TEST_DATABASE_URL` de um banco existente.

O passo 3 é o que faz o duplo clique funcionar em qualquer Windows: não importa qual Python (ou nenhum) a
máquina tenha. Os binários ficam em `.pgbin/`, são removíveis a qualquer momento e não entram no Git.
Todos esses modos servem **apenas para desenvolvimento/testes com dados sintéticos** — a decisão de usar
Docker Compose no dia a dia continua valendo.

## 3. Comandos do dia a dia

### Via `LiaGo.bat` (Windows)

**Duplo clique, sem argumento:** rodada completa automática (`node tools/dev.mjs tudo`) — atualiza do GitHub,
instala dependências, sobe o banco, roda testes e tipos, grava relatório + diagnóstico, envia ao GitHub e sobe
API e app web. Para as opções abaixo: `LiaGo.bat menu`.

| Opção | O que faz |
|---|---|
| 1 | **Rodada completa** (o mesmo do duplo clique) |
| 2 | Só testes e relatório |
| 3 | Desenvolvimento: sobe banco, API (`:3000`) e app web (`:5273`) |
| 4 | Sobe o banco e aplica migrações |
| 5 | Prepara a build Android (exige Android Studio + JDK 21) |
| 6 | Sincroniza com o GitHub (valida, commit, rebase, push da branch de trabalho) |
| 7 | Lista os relatórios gerados |
| 8 | Diagnóstico do ambiente (DevKit) |
| 9 | Reinstala as dependências (`node_modules`) — usar quando algo estiver estranho |
| 10 | Atualizar do GitHub, sem rodar testes |

> As opções 1, 2, 3 e 4 sobem o banco sozinhas pelo caminho mais simples disponível (ver §2). A **primeira**
> execução é a mais demorada: instala as dependências e baixa os binários do banco (uma vez só).
>
> Nenhuma etapa pode travar sem avisar: cada passo longo tem **teto de tempo** (banco 15 min, dependências
> 10 min, testes 15 min — ajustáveis por `LIA_LIMITE_BANCO_MS`, `LIA_LIMITE_INSTALL_MS`, `LIA_LIMITE_TESTES_MS`)
> e avisa "⏳ ainda trabalhando" a cada 15 segundos.

### Via terminal (qualquer sistema)
```bash
npm install            # dependências (o .bat faz sozinho)
npm run db:up          # PostgreSQL local (Docker) + escreve o .env
npm run migrate        # aplica as migrações versionadas
npm test               # domínio + API (a API precisa do banco para não pular)
npm run dev:api        # API em http://localhost:3000
npm run dev:web        # app web em http://localhost:5273
npm run typecheck      # checagem de tipos em todos os pacotes
npm run db:down        # para o banco (não apaga dados)
node tools/dev.mjs testes      # suíte completa + relatório em reports/
```

## 4. Testando no celular (mesma rede Wi-Fi)

1. Rode a opção 3 do `LiaGo.bat` (ou `npm run dev:web`).
2. O Vite mostra um endereço **Network**, por exemplo `http://192.168.0.10:5273/`.
3. Abra esse endereço no navegador do celular. Use apenas **dados sintéticos** nesse modo:
   a rede local não tem HTTPS e o projeto proíbe dados reais fora de HTTPS.

## 5. Gerando o app Android

```bash
LiaGo.bat android           # ou: npm run build:web && cd apps/mobile && npx cap add android
cd apps\mobile && npx cap open android
```
- O Capacitor exige Node 22+, Android Studio Otter (2025.2.1+), JDK 21 e SDK 36.
- iOS exige macOS + Xcode 26 (não é possível no Windows).
- A pasta `apps/mobile/android` **não é versionada** (é gerada): cada máquina gera a sua.
- Antes de qualquer dado real no celular, a API precisa estar em **HTTPS**.

## 5.1 Testando o modo offline (o coração desta fatia)

1. Abra o app (`LiaGo.bat` opção 3) e entre na sua conta.
2. No navegador, abra o DevTools (`F12`) → aba **Network** → marque **Offline**
   (no celular, ative o **modo avião**).
3. Faça coisas: **crie uma viagem**, **lance uma despesa**, **confirme/conteste** uma despesa.
   - A barra no topo diz *"Sem conexão — trabalhando no aparelho (N para enviar quando o sinal voltar)"*.
   - Clique em **Ver alterações**: cada item aparece com o texto do que vai ser enviado.
4. Desligue o modo Offline (ou o modo avião) e não faça nada: a fila sobe sozinha.
   - A barra passa por *"Enviando…"* e termina em *"Tudo sincronizado às HH:MM"*.
5. **Feche e reabra o app no meio do processo** (com a fila ainda cheia): nada se perde — a fila fica
   guardada no aparelho.
6. **Conflito (importante):** em duas janelas/sessões diferentes, mude a mesma coisa (por exemplo, duas
   pessoas movendo o estado da viagem). A segunda tentativa recebe `conflito_versao` e a barra mostra
   *"1 alteração precisa da sua decisão"*, com **"No seu aparelho" x "No servidor"** lado a lado e os botões
   *Manter o que fiz* / *Usar a versão do servidor*. Um valor de despesa **nunca** é resolvido sozinho.
7. **Limpar o aparelho:** aba *Mais* → **Apagar dados deste aparelho**. A fila e o cache somem (útil antes
   de emprestar o celular).

O que **não** funciona sem internet (de propósito, porque quem decide é o servidor): entrar/cadastrar,
aceitar convite, gerar convite, ver saldos atualizados e sair da viagem. Nesses casos a tela avisa.

## 6. Testes

- Domínio (regras puras, sem banco): `npm run test:domain` — 109 testes.
- Sincronização (fila, conflito, cursor, motor): `npm run test:sync` — 48 testes.
- App (armazenamento local e sincronizador): `npm run test:app` — 49 testes de unidade.
- Interface de verdade em jsdom: `npm run test:ui` — 45 testes (monta o app inteiro, inclusive com rede instável).
- Ferramentas da rodada (conferência de dependências e "o app abriu?"): `npm run test:tools` — 53 testes.

---

## Demonstração (conta e viagem de exemplo)

Para olhar a interface sem cadastrar nada, com a API no ar:

```bash
node tools/demo.mjs
```

Cria (ou reaproveita) a conta **demo@lia.go** / **lia-go-demo-2026** com uma viagem de exemplo, quatro
atividades e uma reserva prevista. É idempotente e fala só com a API pública — as mesmas rotas que o
app usa.

⚠️ **Rodar depois dos testes**: a suíte de API limpa o banco (é assim que ela garante isolamento), então
um seed feito antes de `npm test` ou de `node tools/dev.mjs testes` desaparece. Existe porque o ambiente de demonstração não guarda o banco local nem as dependências: quando
ele reinicia, o PostgreSQL volta vazio e a conta criada à mão deixa de existir (foi o que fez o login
responder "E-mail ou senha incorretos" em 2026-10-16).

- API (integração com PostgreSQL real): `npm run test:api` — 86 testes.
- Ferramentas de automação (diagnóstico de falhas, comando do npm no Windows): `npm run test:tools` — 44 testes.
- Tipos dos quatro pacotes: `npm run typecheck` (sem erro é pré-requisito para sincronizar).
- Sem banco, os testes de API são **pulados com aviso** (nunca falsos positivos).
- A automação (`LiaGo.bat`, opções 1 e 2) roda **`npm run typecheck` antes dos testes**: erro de tipo
  aborta a sincronização — nada é enviado com o projeto em estado inconsistente.
- Relatórios de execução: `reports/relatorio-*.md` (segredos são ocultados). Os **20 mais recentes ficam
  versionados**, então o resultado da sua execução aparece no GitHub depois do envio — é o "voltar" do
  `LiaGo.bat`. Relatórios antigos são apagados automaticamente para o repositório não inchar.
- **Quando algo falha, o motivo vem junto** (dois arquivos de nome fixo, sempre sobrescritos):
  `reports/saida-dos-testes.md` guarda a saída **completa** da rodada e `reports/interface-diagnostico.md`
  explica por que um teste de interface não carregou (o `node --test` sozinho só diz "test failed").
  Basta ler esses dois para corrigir sem adivinhar.
- Com o **GitHub CLI (`gh`) instalado e autenticado**, a rodada ainda publica o relatório como comentário
  no pull request da branch — é o aviso de que a rodada terminou. Sem `gh`, nada quebra: o relatório sobe
  no commit, como sempre.

## 7. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `DATABASE_URL não configurada` | banco não subiu | `npm run db:up` (com Docker, abra o Docker Desktop antes; sem Docker, instale o Python 3 e o Lia Go instala o banco embutido) |
| Testes de API pulados | sem banco | `npm run db:up` e rode de novo |
| Banco não sobe e não uso Docker | o download do banco portátil falhou (internet, proxy, antivírus) | a mensagem mostra a causa; rode de novo (o download é retomado do zero, sem sujeira) ou `node tools/db.mjs instalar`. Alternativas: Docker Desktop, `PG_BIN` ou `DATABASE_URL` |
| `Não consegui extrair` ao baixar o banco | falta um extrator no sistema | no Windows o próprio sistema (tar/PowerShell) faz isso; se aparecer, instale o 7-Zip e rode de novo |
| Preview responde **HTTP 403** | host não autorizado no Vite | já tratado em `apps/mobile/vite.config.ts` (`allowedHosts`); se usar outro host, adicione ali |
| `Muitas tentativas` (429) no login | limite de tentativas ativo | espere 15 minutos |
| Porta ocupada | API/app já rodando | feche a outra janela ou mude `PORT`/`port` |
| `npm install` falhou | rede, proxy, antivírus, pasta pela metade… | as últimas linhas da tela mostram a **causa real** e o que fazer; se a pasta `node_modules` ficou pela metade, a automação apaga e reinstala sozinha. Para forçar: `LiaGo.bat` **opção 9** (ou `node tools/dev.mjs instalar`) |
| Teve que rodar `git pull` na mão | a versão antiga só sabia avançar quando a cópia estava exatamente igual ao GitHub; com qualquer commit seu (relatórios, por exemplo) ela desistia e seguia com a versão velha | já corrigido: agora ela reaplica os seus commits por cima da versão nova, **nunca descarta** arquivos alterados e **reinicia a rodada** para usar o que baixou. Para só atualizar: `LiaGo.bat atualizar` (ou menu, opção 10) |
| **O resumo diz "Testes: 0 passaram" mas a tela mostrou centenas passando** | era um defeito nosso: a leitura do placar só entendia o formato que sai quando a saída é capturada (`# pass 37`), e no console do Windows o Node usa outro (`ℹ pass 37`) | já corrigido: a leitura entende os dois formatos e, se não achar placar nenhum, diz "não consegui ler o placar" em vez de "0 passaram" (nunca anunciar zero por falha de leitura) |
| **A saída do app saiu embaralhada** (tudo numa linha só, com `♪◙` no lugar das quebras) | era um defeito nosso: os dois servidores escreviam direto na tela ao mesmo tempo e o console do Windows desenhou os caracteres de quebra de linha de um deles | já corrigido: cada linha passa pelo Lia Go antes de aparecer, vem identificada (`[api]`/`[app]`) e os servidores não recebem mais o teclado |
| `pg_ctl: another server might be running` | sobrou um registro (`postmaster.pid`) de uma rodada interrompida | já tratado: o Lia Go limpa esse registro quando a porta do banco **não** responde e, depois de subir, confirma pela porta que o banco está mesmo no ar |
| **A rodada ficou parada muito tempo (quase 1h) logo depois de subir o banco** | era um defeito nosso: a saída do passo do banco passava por um "cano" que o processo do PostgreSQL herdava, e o Node ficava esperando para sempre — mesmo com o banco pronto | corrigido: o passo do banco herda a tela (sem cano) e o script encerra por conta própria depois de terminar. Se acontecer de novo, feche a janela e rode de novo; o banco que já subiu continua no ar |
| **A atualização foi adiada** ("alterações não commitadas em arquivo que o GitHub também mudou") | proteção: o Lia Go **não** mexe no seu trabalho | resolva de um dos dois jeitos e rode de novo: `git add -A && git commit -m "meu trabalho"` **ou** `git checkout -- <arquivo>` (descartar só aquele arquivo) |
| A rodada parece parada | alguma etapa demorada está em curso | cada etapa é numerada (`[3/7]`) e as longas mostram progresso; o `⏳ ainda trabalhando` aparece a cada 15 segundos de silêncio |
| Download do banco muito lento ou interrompido | internet/proxy/antivírus | a barra mostra a velocidade; se ficar **30 segundos sem avançar**, o Lia Go cancela e explica — rode de novo (o download recomeça do zero, nada fica pela metade) |
| No Windows aparece `Microsoft Windows [versão …]` e nada acontece | o Windows abriu um prompt de comando no lugar do programa (chamada antiga de `.cmd`, bug corrigido) | atualize o projeto (opção 6) e rode de novo; se repetir, envie o texto da tela |
| Quero mandar o erro para alguém analisar | — | a falha do npm grava `reports/npm-install-<data>.log` **com o log interno do npm dentro** (é lá que o motivo real aparece) |
| `EACCES`/permissão no Docker | Docker não iniciado | abra o Docker Desktop |

## 8. O que **não** é feito pelo app (por regra do projeto)

- Não executa pagamentos, Pix, reservas nem cancelamentos externos.
- Não confirma despesa pelo próprio autor do lançamento.
- Não conclui viagem nem muda estado pela data: sempre exige confirmação humana.
- Não resolve conflito de sincronização sozinho nem “adivinha” quem está certo.
