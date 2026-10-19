# Decisões e questões em aberto — Lia Go

Atualizado em 2026-10-15. Este arquivo registra apenas **decisões confirmadas** e **questões ainda abertas**.
Arquitetura técnica detalhada, medidas de viabilidade e riscos ficam em `ARCHITECTURE.md`.

## Decisões confirmadas

### Produto e regras
- Nome de trabalho: Lia Go; mercado inicial Brasil; português brasileiro, BRL e Pix relevante.
- Aplicativo gratuito para usuários; arquitetura deve controlar custos operacionais e de IA.
- Identidade profissional, moderna e confiável; Lia com personalidade levemente tsundere, sem humilhação.
- Criação por conversa ou formulário, alternáveis sem perda de dados e sem perguntas repetidas.
- Roteiro é proposta até aprovação; mudanças relevantes mostram impacto e preservam versões.
- Atividades não são concluídas só porque passou o horário.
- Participantes autenticam; permissões aplicadas no servidor; organizador administra configurações, membros, cancelamento e conflitos.
- Despesa nova fica pendente; autor não confirma próprio lançamento; contestada fora do saldo oficial até resolução.
- Valores financeiros determinísticos; preservar moeda e taxa histórica.
- IA não confirma reservas/pagamentos nem altera saldos oficiais.
- Offline não confirma saldo oficial; conflitos preservados para revisão.
- Notificações: leitura, dispensa e resolução distintos; resolução automática só com evidência confiável; agrupamento não esconde urgência/ações; histórico preservado.
- Cancelamento assistido, com impactos prévios, confirmação autorizada, registros preservados e sem cancelamento automático de reservas/despesas.
- Após cancelamento, todos mantêm acesso aos registros autorizados e podem concluir pendências; novos compromissos bloqueados, exceto correções e encerramento.
- “Em andamento”: sugestão na data prevista; qualquer participante ativo pode confirmar; data sozinha não muda o estado.
- “Concluída”: qualquer participante ativo pode confirmar; pendências financeiras continuam abertas; não reabre automaticamente.
- “Pendente”: sistema sugere com motivo explícito e aguarda confirmação humana de pessoa autorizada.
- Estado da viagem e estado financeiro são independentes.
- Navegação: Visão geral, Roteiro, Gastos, Documentos; Mais para Participantes, Reservas e Configurações.
- Prioridade V1: autenticação/permissões, viagens/roteiro, reservas/documentos, orçamento/despesas/rateios/acertos, notificações essenciais e offline básico.
- Só gerar especificações finais quando houver pedido explícito; este pedido autoriza criar documentos para o agente, mantendo questões em aberto.

### Stack e arquitetura (2026-10-12)
- **Cliente: React + TypeScript + Capacitor**, com uma única base de código para mobile e web.
  **Celular é a plataforma principal**; web é complementar. Substituição da stack exige autorização.
- **Regras de negócio independentes da interface**: pacote de domínio puro (sem I/O, sem UI), usado pelo
  servidor como autoridade e pelo app apenas para prévia/offline.
- **SQLite local nunca é o banco central compartilhado.** O banco central é PostgreSQL no servidor;
  no dispositivo há somente cache offline não oficial.
- **Autenticação: e-mail + senha próprios, sessão em cookie HttpOnly** (sem provedor externo, sem custo,
  sem depender de e-mail nesta etapa).
- **Ambiente da primeira etapa: apenas a máquina local (localhost)**, sem exposição pública e sem custo.
- **Escopo da primeira etapa: base executável + contas + viagens + papéis/convites + autorização no servidor
  + transições de estado + início de finanças (despesa pendente/confirmada e rateio determinístico com soma exata).**
- Ferramentas/versões verificadas no ambiente: Node 22, Vite 8, React 19, Capacitor 8.5.3 (ver `ARCHITECTURE.md` §2).
- **Consolidação de documentos:** `PLANEJAMENTO_MESTRE.md` é a única fonte do planejamento mestre (a antiga cópia duplicada `Lia_Go_Planejamento_Completo_e_Continuidade.md` foi removida).
- **Consolidação de instruções:** `docs/AGENTS.md` é a fonte das instruções permanentes; o `AGENTS.md`
  da raiz apenas aponta para ela.

### Implementação (2026-10-12) — hipóteses reversíveis registradas
- **Interpretação de valor digitado em pt-BR:** vírgula é sempre decimal; ponto com 1–2 dígitos depois é
  decimal (`12.50` → R$ 12,50) e ponto sozinho com exatamente 3 dígitos é milhar (`1.234` → R$ 1.234,00).
  Valores são sempre convertidos para centavos inteiros; nada de float em dinheiro.
- **Distribuição de centavos:** método do maior resto, com empate resolvido pela ordem dos participantes;
  a interface explica quem recebeu o centavo extra.
- **Conflito de estado:** transições e edições usam `versao`; versão divergente devolve **409** com a versão
  atual, nunca sobrescreve.
- **Privacidade de acesso:** quem nunca teve vínculo recebe **404** (não revela existência); quem saiu ou foi
  removido recebe **403** explicativo.
- **Limite de tentativas em duas camadas:** por conta (10 em 15 min) e por origem/IP (50 em 15 min) para não
  bloquear uma rede compartilhada inteira; sucesso limpa as falhas daquela conta.
- **Convite sem e-mail nesta etapa:** o organizador recebe o token uma única vez e envia o link; o aceite
  exige sessão com o mesmo e-mail convidado. Quando houver provedor de e-mail (decisão pendente), o envio
  passa a ser automático.
- **Acesso a dados com SQL explícito + migrações versionadas (`pg`)**, sem ORM, pela auditabilidade.
- **App nativo do Capacitor não é versionado** (`apps/mobile/android` é gerado localmente).
- **Navegação por estado no app** (sem roteador) nesta fatia; pode virar roteador depois sem mudar telas.

### Regras de domínio, interface e automação consolidadas das entregas V1 (2026-10-13 a 2026-10-19)
- **Roteiro e atividades (telas 6–8):** atividade flexível guarda `ordem` sem horário inventado; o relógio não conclui atividade; custo tem natureza (`estimativa`, `compromisso`, `gratuito`) e valor desconhecido nunca vira `R$ 0,00`; conflitos são explicados no resumo do dia e no cartão, sem remarcar sozinho; concluir/cancelar/corrigir exigem motivo e mostram antes `revisarImpacto`. Após a viagem ser **cancelada**, `atividade:concluir`, `cancelar` e `corrigir` continuam permitidas ("não se planeja nada novo, mas registra-se o que houve com o que já existia"); viagem **concluída** bloqueia `atividade:criar`. Custo de atividade é planejamento e nunca entra no saldo oficial.
- **Orçamento com limite (tela 9):** o limite é planejamento (`Sem limite` / `Dentro do limite` / `Perto do limite` a partir de 80% / `Passou do limite`), nunca bloqueio nem saldo oficial. Limite coletivo é do organizador (`orcamento:definir`) e individual é de cada pessoa (`orcamento:definir-proprio`); **limite `0` é um combinado explícito ("não gastar"), não "sem limite"**.
- **Reservas (tela 14):** nasce `prevista`; confirmar é ação separada que **exige evidência** (localizador/código/comprovante ≥ 3 caracteres) e muda a natureza de `estimativa` para `compromisso` sem alterar o valor; cancelar exige motivo (≥ 5 caracteres), preserva a evidência no histórico e avisa que não cancela no fornecedor. Atividade pode vincular uma reserva da mesma viagem (não cancelada), sem confirmar a reserva automaticamente.
- **Checklist (tela 14):** prazo não conclui nada (`itemAtrasado` é rótulo de leitura); conclusão grava quem/quando; reabrir exige **motivo ≥ 5 caracteres**. Ordem de leitura (`atrasado → prazo mais próximo → sem prazo → feito`) e resumo vêm do domínio.
- **Documentos (tela 15):** privados por padrão; compartilhamento separado (com a viagem ou pessoas, sem duplicar nem incluir a si mesmo) e revogável; remoção lógica exige motivo e revoga acesso. **Quem não pode ver recebe 404, inclusive o organizador.** Quando alguém perde acesso, a sincronização envia `{id, removido: true}` (só o ID) para apagar a cópia local. Guarda apenas link `http(s)` e descrição (sem binário nesta fase).
- **Fechamento e exportação (tela 21):** usa `calcularResumoFinanceiro` e `sugerirTransferencias` (acertos como sugestão, nunca pagamento efetuado). Exporta `.txt` e `.csv` (`;` e vírgula decimal; campo começando com `=`, `+`, `-` ou `@` ganha apóstrofo contra injeção de fórmula). No celular sem download mostra o texto para copiar; sem internet permite exportar a cópia guardada no aparelho marcando que não veio do servidor.
- **Central de notificações (tela 16):** derivada por cálculo em leitura (`packages/domain/src/notificacao.ts`), sem tabela no servidor. `lida` ≠ `dispensada` ≠ `resolvida`; a chave inclui a revisão do fato (`despesa-pendente:<viagem>:<qtd>`, `acerto-confirmar:<id>:<valor>`, `orcamento-estourado:<viagem>:<percentual>`) para que qualquer piora reabra o aviso. Início e central usam o mesmo hook (`use-notificacoes.ts`), com marcas por usuário (`notificacoes:<usuarioId>`, teto de 200) e ressincronização em `visibilitychange`.
- **Sincronização, cache e assets:** `abrirViagem` guarda uma viagem por vez no cache detalhado e o cursor é por viagem (`trocarViagemAberta`); pedidos feitos durante uma passada aguardam a mesma passada seguinte; toda mutação da fila passa por seção crítica (`mutarFila`) e `cargaCompleta` preenche campos novos em caches antigos. A imagem oficial do hero é servida de `apps/mobile/public/lia-hero.jpg` (`/lia-hero.jpg`); testes de UI rodam em sequência (`--test-concurrency=1`) empacotando `@lia-go/domain` e `@lia-go/sync`.
- **Automação no Windows (`LiaGo.bat` / `tools/`):** chamada de `.cmd` em linha única via `cmd.exe /d /s /c "npm.cmd <args>"`; processos que deixam servidor vivo (`db.mjs` / `pg_ctl`) usam `stdio: "inherit"` (nunca `pipe`) e confirmam disponibilidade pela porta TCP (`portaRespondendo`); `lerPlacarDeTestes` lê tanto TAP (`# pass`) quanto spec (`ℹ pass`) e nunca anuncia zero por falha de leitura; saída dos servidores na etapa 7 é prefixada linha a linha (`[api]`/`[app]`) com `stdin: "ignore"`; `LIA_HMR_WSS=1` só no proxy HTTPS; atualização nunca usa `git reset --hard` nem `stash` destrutivo; PostgreSQL tenta Docker → binário local → PostgreSQL portátil do PyPI (`.pgbin/`, fora do Git) → `DATABASE_URL`; `reports/` mantém apenas os 3 relatórios `relatorio-*.md` mais recentes além dos arquivos de diagnóstico fixos (`estado-do-computador.md`, `saida-dos-testes.md`, `interface-diagnostico.md`).

### Dependências: 3 avisos moderados do `npm audit` (aceitos, reavaliar a cada versão)
`@capacitor/cli` → `xcode` → `uuid` (GHSA-w5hq-g745-h8pq). É **ferramenta de desenvolvimento**
(só é usada para ler/escrever o projeto iOS; não roda no app, nem na API, nem no build Android que
o grupo usaria). `npm audit fix --force` resolveria **rebaixando** o `@capacitor/cli` para 8.4.3 —
mudança de versão que quebra a compatibilidade com o Capacitor 8. Por isso:
**não rodar `npm audit fix --force`**; atualizar apenas quando o Capacitor publicar a correção.
Revisão: `npm audit` antes de cada release.

### Offline e privacidade no aparelho (2026-10-12, segunda rodada)

**Pesquisa de mercado feita antes de decidir** (fontes consultadas nesta data):
OWASP MASTG (armazenamento de chaves no Android), documentação e discussões sobre a depreciação de
`EncryptedSharedPreferences`/`EncryptedFile` e a recomendação atual (DataStore + Tink/Keystore, ou
SQLCipher para bancos), Apple sobre classes de proteção de dados do iOS, e guias de arquitetura
offline-first (padrão "outbox", estados queued/syncing/synced/failed, conflito explícito em vez de
last-write-wins para dinheiro).

**O que ficou decidido:**

1. **Tokens de sessão:** cookie HttpOnly na web (JavaScript não lê); no app nativo, armazenamento seguro
   do sistema (Android Keystore / iOS Keychain). Se o aparelho não oferecer armazenamento seguro,
   o app usa o armazenamento comum **e diz isso na tela** ("Mais → Este aparelho") — nunca finge.
   Motivo: a recomendação de mercado é unânime em não guardar token em armazenamento comum.
   **Exceção decidida em 2026-10-17:** quando o navegador **recusa o cookie** (app aberto dentro de
   outra página, mesmo com `SameSite=None; Secure; Partitioned`), o app faz uma segunda tentativa pelo
   caminho do app nativo e guarda os tokens em **`sessionStorage`** — só aquela aba, morre ao fechar,
   nunca `localStorage`. Sem isso a pré-visualização embutida era inutilizável; a alternativa seria
   não haver sessão nenhuma. O caminho normal segue cookie `HttpOnly` e o fallback só é acionado
   depois de a verificação de sessão falhar.
2. **Dados de viagem em cache:** arquivos internos do app (não há "cartão SD" no caminho). No iOS já são
   cifrados pela proteção de dados do sistema (classe padrão para apps de terceiros). No Android, o
   armazenamento é privado do app; em aparelho com root, um banco local cifrado é a proteção correta —
   por isso o **próximo passo nativo** é SQLCipher com a chave no Keystore. A troca acontece em um arquivo
   (`apps/mobile/src/offline/armazenamento.ts`), sem tocar em telas nem no motor de sincronização.
   Enquanto isso: o cache guarda apenas o que a pessoa já pode ver, o botão "Apagar dados deste aparelho"
   limpa tudo, e sair da conta também limpa.
3. **Conflito nunca é "last-write-wins" para dinheiro.** Mesmo campo alterado nos dois lados → decisão
   humana, com "no seu aparelho" e "no servidor" lado a lado em português simples. Campos diferentes
   alterados em cada lado são mesclados. Valores, moeda, rateio, participantes e quem pagou **sempre**
   exigem decisão explícita.
4. **Cursor de sincronização é sequência, não horário** (`auditoria.id`): relógio de celular adiantado ou
   atrasado não faz ninguém perder mudança. Resposta paginada com `temMais`.
5. **Estado de envio visível, sempre** (`aguardando → enviando → sincronizado / falhou / conflito`):
   falha silenciosa e sucesso falso são os dois erros clássicos de app offline e estão proibidos aqui.
6. **Saldos são só do servidor.** Sem rede, a tela mostra a última informação conhecida **com a hora**;
   o app nunca calcula saldo oficial no aparelho.
7. **Escrita que não se resolve sozinha para de tentar** e aparece para a pessoa resolver (regra de
   negócio violada, sem permissão). Erro de rede volta para a fila com espera crescente (2s → 5 min).
8. **`conflito_versao` é um código próprio** (409), separado de "esta operação não se aplica mais":
   só o primeiro pede decisão de versão, o segundo é falha definitiva com mensagem clara.
9. **Ordem de uso escolhida pelo responsável:** offline primeiro; **hospedagem/HTTPS só quando o app
   estiver mais completo** (dados reais continuam proibidos até lá).

### Interpretação de "o app funciona sem sinal"
Funciona **ler e escrever**: criar viagem, editar roteiro/reservas/checklist/documentos, lançar/confirmar/contestar
despesa, registrar e confirmar acerto, definir/ajustar limite de orçamento, consultar prévia local de impactos e
cancelar viagem assistida entram na fila e sobem depois; além disso, é sempre possível exportar a cópia guardada
no aparelho (`.txt` e `.csv`) sem internet. Continuam exigindo internet (o servidor é quem decide entre pessoas):
login/cadastro inicial, aceitar convite (o token só existe no servidor), gerar convite, ver saldos/fechamento
oficiais confirmados pelo servidor e sair da viagem.

### Decisões de governança, offline, IA e integração com a Lia Waifu (2026-10-19)

1. **Revisão obrigatória de cálculos financeiros (`ALTO`):** mudanças em `packages/domain` que toquem `money`,
   `expense`, `split`, `balances`, `orcamento` ou `fechamento` **nunca** são aplicadas sem revisão humana —
   são sempre classificadas como nível `ALTO` para o `reviewer`. `calcularResumoFinanceiro` rejeita somar
   despesas de moedas diferentes sem conversão explícita (`ErroDeDominio`).
2. **Duas regras de sobrevivência offline:** (a) todas as funções centrais da viagem leem e escrevem sem
   internet; (b) se qualquer provedor de IA ou o servidor cair, o app não para.
3. **Três regras de provedor de IA:** a V1 não possui cliente de IA nem chama LLM externo; quando qualquer
   integração entrar, obrigatoriamente terá (a) endereço configurável com "Testar conexão" e "Listar modelos",
   (b) `localhost` nunca fixo no código e (c) zero chave de API do autor embarcada no app ou repositório.
4. **Contrato em escada para conexão futura com a Lia Waifu:**
   - **V1 (atual):** nenhuma integração de rede; cada projeto roda independente.
   - **V2 (mesma rede local):** descoberta/endereço informado pelo usuário na LAN + pareamento explícito por
     código curto temporário exibido na Lia Waifu e digitado no Lia Go.
   - **V3 (fora de casa sem nuvem paga):** comunicação pela rede privada do próprio usuário (ex.: Tailscale /
     WireGuard), mantendo o mesmo protocolo da V2 sem servidor central pago.
   - **Relay na nuvem:** somente se e quando houver plano explícito de custo, autenticação mútua e revogação.
   - **6 cláusulas invioláveis ("conversa não é autorização"):**
     1. Transporte HTTP JSON autenticado por token de pareamento exclusivo, revogável a qualquer momento em
        `Mais → Este aparelho`.
     2. Escopo por viagem: a Lia Waifu só enxerga viagens que o usuário autorizou explicitamente no pareamento.
     3. Leitura permitida: resumo da viagem, próximos compromissos do roteiro, pendências do checklist e totais
        já calculados.
     4. Escrita permitida (sempre como proposta/rascunho): sugerir atividade no roteiro (`planejada`), sugerir
        item de checklist ou rascunho de nota.
     5. **Proibição financeira e destrutiva:** a Lia Waifu **nunca** cria despesa confirmada, **nunca** confirma
        nem contesta despesa ou acerto, **nunca** altera limite de orçamento e **nunca** transiciona nem cancela
        viagem. No máximo propõe um rascunho pendente que exige toque humano explícito na tela do Lia Go.
     6. Independência: se a Lia Waifu estiver desligada ou inacessível, o Lia Go funciona 100% igual.

## Questões que podem ser resolvidas durante a implementação
- Pequenos detalhes de layout, microcopy e organização visual, desde que não alterem regras.
- Bibliotecas auxiliares e padrões reversíveis adequados à stack decidida.
- Motivos e apresentação detalhada de sugestões de “Pendente”, respeitando a regra de confirmação.
- Ordem interna de tarefas pequenas, mantendo prioridades e dependências.
- Nomos de arquivos, nomes de tabelas/colunas e organização interna dos pacotes.
- Estratégia de teste unitário de componentes de interface (Vitest + Testing Library ou similar).

## Questões que exigem análise e, quando necessário, confirmação
**Bloqueiam a próxima fatia (respondidas em `ARCHITECTURE.md` §11):**
- Banco/ambiente de desenvolvimento: PostgreSQL local via Docker, binário portátil ou nuvem (custo/dados).
- Transporte de sessão no app nativo: mesmo cookie via `CapacitorCookies` ou token + armazenamento seguro.
- Armazenamento offline no dispositivo: SQLite nativo, IndexedDB ou online-first nesta fase.
- Confirmação da primeira fatia proposta em `ARCHITECTURE.md` §12.

**Decisão humana aberta e prioritária antes de uso fora da máquina de desenvolvimento — Quem hospeda e quem paga o servidor do Lia Go (`apps/api` + PostgreSQL):**
Hoje o Lia Go tem um servidor central real (`apps/api` + PostgreSQL) que guarda contas, viagens compartilhadas,
convites, permissões, fila de sincronização e cálculo oficial de saldos. Antes de publicar um APK ou abrir para
grupos reais, é preciso escolher **um** dos 4 caminhos abaixo:
1. **Servidor próprio na máquina de quem organiza (auto-hospedado / LAN / Tailscale):** custo zero de nuvem;
   o grupo depende de a máquina do organizador estar ligada para sincronizar mudanças entre aparelhos.
2. **Servidor hospedado pelo autor do projeto:** experiência imediata para qualquer grupo, mas gera custo
   mensal recorrente de servidor + banco PostgreSQL + backups + responsabilidade direta por dados de terceiros
   (LGPD), exigindo teto rígido de gasto.
3. **Endereço do servidor configurável no app (cada grupo aponta para o seu):** o app permanece gratuito e sem
   custo central para o autor; **exige** campo "Endereço do servidor" na tela de entrada/configuração (já que no
   APK nativo do Capacitor o caminho relativo `/api` não aponta para um servidor externo sem URL base).
4. **Modo 100% local para viagem individual (sem conta e sem servidor):** permite planejar viagem sozinho e
   exportar `.txt`/`.csv` direto após instalar o APK sem criar conta nem configurar servidor, pedindo servidor
   apenas quando a pessoa quiser compartilhar a viagem com outros participantes.

**Não bloqueiam a primeira fatia:**
- Hospedagem definitiva da API e do banco; política de backup e restauração.
- Provedor de e-mail transacional (verificação de conta e recuperação de senha).
- Retenção de documentos e localização; prazo exato do histórico de localização.
- Política legal de privacidade, exclusão de conta e registros financeiros compartilhados (LGPD).
- Fonte/frequência de câmbio, taxa manual, spread, arredondamento e modo offline.
- Limites de custo e fornecedor de IA; limites de uso e fallback.
- Requisitos exatos de exportação PDF/planilha e acessibilidade.
- Integrações externas, credenciais e respectivos custos.
- Política detalhada de conflito financeiro e poderes de resolução quando não houver acordo.
- Quais categorias de notificação podem furar o modo silêncio.
- Publicação nas lojas: Android (US$ 25 único) e iOS (US$ 99/ano + macOS obrigatório).
- Observabilidade, monitoramento de erros e métricas de custo.

## Regra de resolução
Quando uma questão bloquear uma fatia de trabalho:
1. Explicar a questão e as opções relevantes de forma curta.
2. Indicar recomendação e impacto.
3. Pedir decisão se for material ou de alto risco.
4. Registrar a decisão neste arquivo e nos documentos afetados.
5. Retomar a implementação sem reabrir decisões confirmadas não relacionadas.
