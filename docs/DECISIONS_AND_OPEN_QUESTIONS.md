# Decisões e questões em aberto — Lia Go

Atualizado em 2026-10-13. Este arquivo registra apenas **decisões confirmadas** e **questões ainda abertas**.
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
- **Consolidação de documentos:** `PLANEJAMENTO_MESTRE.md` é a única fonte do planejamento mestre;
  `Lia_Go_Planejamento_Completo_e_Continuidade.md` deixou de ser cópia idêntica e virou apontador.
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

### Ambiente de desenvolvimento no Windows (2026-10-12, terceira rodada) — hipóteses reversíveis
- **PostgreSQL do dia a dia continua sendo o Docker Compose** (decisão confirmada). O que mudou foi a
  **ordem de tentativa** quando não há Docker rodando: binários já instalados (`PG_BIN`) → **PostgreSQL
  embutido** (pacote Python `pgserver`, instalado na conta do usuário, sem administrador) → `DATABASE_URL`
  existente. Motivo: no Windows o Docker Desktop costuma estar fechado, e sem banco os testes de integração
  eram pulados em silêncio. Nada disso substitui a decisão do Docker; é só o caminho de entrada.
- **Nunca fingir sucesso:** comando que termina com código 0 mas não fez o trabalho (o Windows abrindo um
  prompt de comando no lugar do `npm`, ou `npm test` sem nenhum teste) passa a **falhar com explicação**.
  Relatórios marcam explicitamente "nenhum teste rodou".
- **Detalhe técnico que causou a falha no PC do usuário:** no Windows, `.cmd`/`.bat` não roda direto pelo
  Node (correção de segurança de abr/2024), mas **também não pode** ser chamado com um `cmd.exe` extra na
  linha — o `npm.cmd` usa `%~dp0` para achar o próprio caminho e o `cmd.exe` sobra abre um prompt interativo.
  A chamada correta é uma **linha única** executada por `cmd.exe /d /s /c "npm.cmd <argumentos>"`.

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
Funciona **ler e escrever**: criar viagem, lançar/confirmar/contestar despesa, registrar e confirmar
acerto e trocar o estado da viagem entram na fila e sobem depois. Continuam exigindo internet (o servidor
é quem decide): login/cadastro, aceitar convite (o token só existe no servidor), gerar convite,
ver saldos atualizados e sair da viagem.

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
