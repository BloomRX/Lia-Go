# Como rodar o Lia Go — guia único de execução

> Para o dia a dia no Windows: **dê dois cliques em `LiaGo.bat`** e escolha a opção 1.
> Ela sobe o banco, roda os testes, grava um relatório em `reports/` e sincroniza a branch.
> O mesmo menu existe em qualquer sistema com `node tools/dev.mjs <comando>`.

## 1. O que você precisa instalar (uma vez)

| Item | Versão mínima | Para quê | Obrigatório? |
|---|---|---|---|
| Node.js | **22.12+** (LTS) | rodar API, app e testes | sim |
| Docker Desktop | atual | PostgreSQL local (`npm run db:up`) | sim para os testes de API |
| Python 3.10+ | — | já necessário para o DevKit (git seguro) | sim (você já usa) |
| Android Studio + JDK 21 | Otter 2025.2.1+ | gerar o app Android | só quando for gerar o app |
| Android SDK 36 (minSdk 24) | — | build Android | só quando for gerar o app |

Sem Docker o projeto continua funcionando: ele usa binários locais do PostgreSQL quando existirem
(`LIA_DB_MODO=binarios` ou `PG_BIN=...`). Nesse caso, use **apenas dados sintéticos**.

## 2. Comandos do dia a dia

### Via `LiaGo.bat` (Windows, duplo clique)
| Opção | O que faz |
|---|---|
| 1 | **Tudo**: banco + testes + relatório + sincronização com o GitHub (recomendado) |
| 2 | Só testes e relatório |
| 3 | Desenvolvimento: sobe banco, API (`:3000`) e app web (`:5273`) |
| 4 | Sobe o banco e aplica migrações |
| 5 | Prepara a build Android (exige Android Studio + JDK 21) |
| 6 | Sincroniza com o GitHub (valida, commit, rebase, push da branch de trabalho) |
| 9 | Reinstala as dependências (`node_modules`) — usar quando algo estiver estranho |
| 7 | Lista os relatórios gerados |
| 8 | Diagnóstico do ambiente (DevKit) |

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

## 3. Testando no celular (mesma rede Wi-Fi)

1. Rode a opção 3 do `LiaGo.bat` (ou `npm run dev:web`).
2. O Vite mostra um endereço **Network**, por exemplo `http://192.168.0.10:5273/`.
3. Abra esse endereço no navegador do celular. Use apenas **dados sintéticos** nesse modo:
   a rede local não tem HTTPS e o projeto proíbe dados reais fora de HTTPS.

## 4. Gerando o app Android

```bash
LiaGo.bat android           # ou: npm run build:web && cd apps/mobile && npx cap add android
cd apps\mobile && npx cap open android
```
- O Capacitor exige Node 22+, Android Studio Otter (2025.2.1+), JDK 21 e SDK 36.
- iOS exige macOS + Xcode 26 (não é possível no Windows).
- A pasta `apps/mobile/android` **não é versionada** (é gerada): cada máquina gera a sua.
- Antes de qualquer dado real no celular, a API precisa estar em **HTTPS**.

## 4.1 Testando o modo offline (o coração desta fatia)

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

## 5. Testes

- Domínio (regras puras, sem banco): `npm run test:domain` — 54 testes.
- Sincronização (fila, conflito, cursor, motor): `npm run test:sync` — 38 testes.
- App (armazenamento local e sincronizador, com IndexedDB simulado): `npm run test:app` — 13 testes.
- API (integração com PostgreSQL real): `npm run test:api` — 39 testes.
- Ferramentas de automação (diagnóstico de falhas, comando do npm no Windows): `npm run test:tools` — 21 testes.
- Tipos dos quatro pacotes: `npm run typecheck` (sem erro é pré-requisito para sincronizar).
- Sem banco, os testes de API são **pulados com aviso** (nunca falsos positivos).
- A automação (`LiaGo.bat`, opções 1 e 2) roda **`npm run typecheck` antes dos testes**: erro de tipo
  aborta a sincronização — nada é enviado com o projeto em estado inconsistente.
- Relatórios de execução: `reports/relatorio-*.md` (segredos são ocultados). Os **20 mais recentes ficam
  versionados**, então o resultado da sua execução aparece no GitHub depois do envio — é o "voltar" do
  `LiaGo.bat`. Relatórios antigos são apagados automaticamente para o repositório não inchar.

## 6. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `DATABASE_URL não configurada` | banco não subiu | `npm run db:up` (abra o Docker Desktop antes) |
| Testes de API pulados | sem banco | `npm run db:up` e rode de novo |
| Preview responde **HTTP 403** | host não autorizado no Vite | já tratado em `apps/mobile/vite.config.ts` (`allowedHosts`); se usar outro host, adicione ali |
| `Muitas tentativas` (429) no login | limite de tentativas ativo | espere 15 minutos |
| Porta ocupada | API/app já rodando | feche a outra janela ou mude `PORT`/`port` |
| `npm install` falhou | rede, proxy, antivírus, pasta pela metade… | as últimas linhas da tela mostram a **causa real** e o que fazer; se a pasta `node_modules` ficou pela metade, a automação apaga e reinstala sozinha. Para forçar: `LiaGo.bat` **opção 9** (ou `node tools/dev.mjs instalar`) |
| Quero mandar o erro para alguém analisar | — | a falha do npm grava `reports/npm-install-<data>.log` **com o log interno do npm dentro** (é lá que o motivo real aparece) |
| `EACCES`/permissão no Docker | Docker não iniciado | abra o Docker Desktop |

## 7. O que **não** é feito pelo app (por regra do projeto)

- Não executa pagamentos, Pix, reservas nem cancelamentos externos.
- Não confirma despesa pelo próprio autor do lançamento.
- Não conclui viagem nem muda estado pela data: sempre exige confirmação humana.
- Não resolve conflito de sincronização sozinho nem “adivinha” quem está certo.
