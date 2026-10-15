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

### Relato honesto do que a tela mostra: placar dos testes e saída dos servidores (2026-10-15, sexta rodada)
- **Contexto**: a primeira rodada completa bem-sucedida no PC do usuário (Windows, 85 s) provou que o
  travamento de ~1 h estava resolvido, mas revelou **dois defeitos de leitura de tela** — e um deles fez o
  relatório enviado ao GitHub dizer que **nenhum teste havia rodado** com 183 testes verdes.
- **Defeito 1 — placar dos testes**: a suíte roda num console de verdade no Windows, e ali o Node usa o
  formato "spec" (`ℹ pass 37`); quando a saída é capturada (nosso ambiente de testes, arquivos, canos) ele
  usa TAP (`# pass 37`). A leitura só entendia TAP ⇒ `Testes: 0 passaram`, e o relatório saiu com a tabela
  zerada. **Correção**: `lerPlacarDeTestes` entende os dois formatos (linhas `✔ …` de cada teste não contam,
  só o placar) e, quando não encontra placar nenhum, a rodada diz "não consegui ler o placar" —
  **nunca mais anuncia zero por falha de leitura** (`descreverPlacarDeTestes`, com testes).
- **Defeito 2 — saída embaralhada na etapa 7**: os dois servidores escreviam direto na tela, ao mesmo tempo;
  as linhas colaram uma na outra num bloco único e o Windows desenhou os caracteres de quebra de linha de uma
  delas como `♪◙` (0x0D/0x0A crus no console). **Correção**: a saída passa pelo Lia Go e é reimpressa
  **linha por linha**, identificada por `[api]`/`[app]`, com `\r\n` normalizado; os servidores **não recebem
  o teclado** (`stdin: "ignore"`) — ferramenta de desenvolvimento que ganha teclado de verdade troca o modo
  do console, e era disso que a tela embaralhada vinha se aproveitando (`separarLinhas`, com testes).
- **Defeito 3 — banco dizia "pronto" sem estar no ar**: quando sobra um `postmaster.pid` de uma rodada
  interrompida, o `pg_ctl` avisa “another server might be running; trying to start server anyway” e, se o
  número no arquivo pertencer a outro processo, **sai com código 0 sem subir nada**. **Correção**: a pergunta
  "o banco está no ar?" passou a ser respondida pela **porta** (`portaRespondendo`) — registro órfão é limpo
  com explicação e, depois de subir, a rodada **confirma pela porta** antes de seguir. Vale a regra geral:
  `status 0` não é prova de sucesso.
- **HMR do app no PC do usuário**: o `wss://` na porta 443 (necessário atrás do proxy HTTPS do preview)
  faz o navegador recusar o WebSocket quando se abre `http://localhost:5273` — o app abria, mas sem
  recarregamento automático. Agora é local (`ws://` na própria porta) por padrão e `LIA_HMR_WSS=1` liga o
  modo proxy. O Vite 8 já libera `localhost` e endereços IP, então o acesso pelo celular na mesma rede
  continua funcionando sem lista extra de hosts.

### Roteiro entregue de ponta a ponta + telas seguindo as diretrizes visuais (2026-10-15, sétima rodada)
- **Contexto**: chegaram `docs/UI_VISUAL_GUIDELINES.md` e a tela 7 de `docs/UX_SCREENS.md`. Em vez de
  planejar mais, a fatia do roteiro foi implementada inteira — domínio, banco, API, fila offline e telas.
- **Regras do documento que viraram código** (não ficaram só no texto): o relógio **não** conclui atividade;
  atividade flexível guarda `ordem` e **não** recebe horário inventado; custo tem natureza
  (`estimativa`/`compromisso`/`gratuito`) e o **desconhecido continua desconhecido** (nunca `R$ 0,00`);
  conflitos são **explicados** com sugestão e **nada é remarcado sozinho**; concluir/cancelar/corrigir
  exigem ação humana (motivo na correção/cancelamento); conflito aparece no resumo do dia **e** no cartão.
- **Interpretação registrada (reversível):** depois da viagem **cancelada**, `atividade:concluir`,
  `cancelar` e `corrigir` **continuam permitidas** — o princípio "não se planeja nada novo, mas registrar o
  que houve com o que já existia" já valia para despesas, e vale igual aqui. Viagem **concluída** bloqueia
  `atividade:criar`. Se o produto preferir o contrário, é uma linha em `packages/domain/src/permissions.ts`.
- **Custo x despesa:** o custo da atividade é **planejamento** (estimativa/compromisso), não lançamento; ele
  nunca entra em saldo nem substitui a despesa confirmada. Transformar atividade concluída em despesa é
  passo explícito do usuário, ainda **não** implementado.
- **Estado real das telas** documentado em `docs/UX_SCREENS.md` ("Estado real de implementação") — inclusive
  o que **não** existe (documentos, reservas, orçamento, notificações, configurações) e o fato de a **Lia
  ainda não falar no app**: nenhuma sugestão é exibida enquanto não houver IA de verdade.
- **Tokens visuais V1 aplicados**: `docs/UI_V1_DECISIONS.md` (magenta `#FF3EDC`, roxo `#A855F7`, lilás
  `#D884FE`, fundo `#0B0A12`, sucesso `#22D3A3`) virou o bloco `:root` de `apps/mobile/src/styles.css`, com
  escala de espaçamento em variáveis (`--e1`…`--e6`) e `prefers-reduced-motion` respeitado. Ícone continua
  sendo **texto/etiqueta** nesta fatia: instalar biblioteca de ícones é ajuste incremental, não bloqueio.
- **Imagens de referência**: as telas deste commit seguem os **tokens** de `apps/mobile/src/styles.css`
  (base escura, roxo/magenta, cartões arredondados, alvos ≥ 44 px, foco visível, estado **nunca só por cor**).
  Desde 2026-10-15 as referências estão versionadas em `assets/references/` (caminhos oficiais em
  `UI_VISUAL_GUIDELINES.md` §7) e confirmam esses tokens.
- **Placar da rodada**: 283 testes verdes (ferramentas 39 · domínio 83 · sincronização 48 · app 56 — 43 de unidade + 13 de interface em jsdom · API 57; o placar da décima rodada está na entrada mais recente).

### Orçamento com limite, checklist, documentos e fechamento (2026-10-15, décima rodada)

Fatia entregue de ponta a ponta — domínio, API, app e testes — sem nova pergunta ao usuário
(decisão vigente: "faz tudo de uma vez, depois lapidamos os erros que aparecerem").

- **Orçamento com limite (tela 9)** — o limite é **planejamento**, não bloqueio e não saldo: a aba
  Gastos mostra barra + estado escrito (`Sem limite` / `Dentro do limite` / `Perto do limite` /
  `Passou do limite`, atenção a partir de 80%), e o número oficial continua sendo só o confirmado.
  **Quem define o que**: o limite **coletivo** é do organizador (`orcamento:definir`); o **individual**
  é de cada pessoa (`orcamento:definir-proprio`), e o organizador pode ajustar o combinado de alguém.
  Limite **0 é um combinado explícito** ("não gastar"), não "sem limite".
- **Checklist (tela 14 — reservas e checklist)** — prazo **não conclui nada**: atraso é rótulo de leitura (`itemAtrasado`),
  conclusão grava quem/quando e reabrir exige **motivo ≥ 5 caracteres** (vai para a trilha). A ordem de
  leitura (atrasado → prazo mais próximo → sem prazo → feito) e o resumo (`3 em aberto · 1 feito ·
  1 atrasado`) são do domínio, não do JSX.
- **Documentos (tela 15)** — **privado por padrão**: só quem criou vê; compartilhar é passo separado
  (com a viagem ou com pessoas, dedup, sem si mesmo) e revogável. Remover exige motivo, é remoção
  **lógica** (registro e motivo continuam com quem organiza) e revoga o acesso de todos. O app guarda
  **link e descrição** — não guarda binário (hospedagem/custo ainda não confirmados), e a tela diz isso.
  Link só `http(s)`; a tela abre em outra aba com aviso "(abre fora do Lia Go)".
- **Quem não pode ver recebe 404, inclusive o organizador**: a rota de agir (compartilhar/revogar/remover)
  carrega o documento **com a mesma regra de visibilidade**. Sem isso, quem organiza (ou qualquer pessoa
  sem acesso) conseguia agir sobre documento privado alheio — e a mensagem de erro confirmava que ele
  existia. Defeito encontrado por teste, corrigido na API.
- **Sair da lista também no aparelho**: documento que a pessoa deixou de poder ver chega na
  sincronização como `{id, removido: true}` — só o identificador, nada de conteúdo — e a cópia local é
  apagada. O evento de compartilhar/revogar/remover guarda o acesso **antes** e **depois**; quem nunca
  viu não recebe nada.
- **Fechamento e exportação (tela 21)** — `montarFechamento` (domínio) usa **o mesmo** resumo financeiro
  do servidor (`financas.ts` → `calcularResumoFinanceiro`) e as mesmas sugestões de acerto do roteiro
  (`sugerirTransferencias`): nada de conta paralela. Só o confirmado é oficial; o que aguarda aparece
  separado e com aviso. Exporta `.txt` legível e `.csv` com ponto e vírgula e vírgula decimal; campo que
  começa com `=`, `+`, `-` ou `@` ganha apóstrofo (fórmula não executa na planilha de quem abrir).
  **No app do celular não existe download**: a tela mostra o texto para copiar e diz por quê, em vez de
  fingir que baixou (§13).
- **Fila do aparelho cresceu**: `criar_item_checklist`, `concluir_item_checklist`, `reabrir_item_checklist`
  e `criar_documento` entram na outbox como as demais escritas — valem na hora e sobem quando houver rede.
  A carga local ganhou `itensChecklist` e `documentos` (cache antigo é completado por `cargaCompleta`).
- **Referências oficiais aplicadas** (`assets/references/`): hero da viagem com a Lia na Visão geral,
  cartão **"Próximo compromisso"** (só o que ainda vai acontecer; compromisso do dia sem hora continua
  valendo; nada à frente = a tela diz que não há) e o cartão de orçamento com barra do `concept-03`.
  A imagem usada pelo app é uma cópia comprimida em `apps/mobile/public/lia-hero.jpg` (900 px, 58 KB);
  a referência original continua em `assets/references/`.
- **Placar de testes desta rodada** (tudo verde, `npm test` na raiz): ferramentas 44 · domínio 109 ·
  sincronização 48 · app 46 (unitário) + 28 (interface, jsdom) · API 86 = **361**. A suíte de interface
  agora cobre orçamento, checklist, documentos, fechamento e a Visão geral.

### Central de notificações de ponta a ponta (2026-10-15, décima primeira rodada)

- **A central é cálculo, não caixa de mensagens**: `packages/domain/src/notificacao.ts` deriva o que
  precisa de atenção **na leitura**, a partir do que já existe (pendências financeiras, convites
  recebidos e enviados, acertos a confirmar ou aguardando, checklist de hoje/atrasado, reserva sem
  valor, orçamento em atenção ou estourado, viagem em rascunho). Nada de tabela de notificações no
  servidor: sem "resolvido" inventado e sem cópia que desatualiza.
- **Ler ≠ dispensar ≠ resolver** (regra da tela 16): `lida` é "eu vi"; `dispensar` é "não me lembre
  disto agora"; **resolver só acontece quando o fato muda**. Por isso a chave carrega a revisão do
  fato (`despesa-pendente:<viagem>:<quantidade>`, `acerto-confirmar:<id>:<valor>`,
  `orcamento-estourado:<viagem>:<percentual>`): dispensar 2 pendências não esconde as 3 que vierem
  depois — o item antigo passa a aparecer no histórico de resolvidas.
- **O mesmo número nas duas telas**: Início e central usam o mesmo hook
  (`apps/mobile/src/services/use-notificacoes.ts`), que assina o sincronizador e guarda as marcas
  **por usuário** (`notificacoes:<usuarioId>`, teto de 200 marcas). Duas contagens diferentes na mesma
  tela quebrariam a confiança no aviso.
- **Marcar enquanto lê não perde a marca** (defeito encontrado pelo teste de tela, não no papel): ler as
  marcas do aparelho e clicar aconteciam na mesma respiração, e a leitura que chegava depois apagava o
  clique — o item dispensado voltava sozinho. Agora, com o aparelho já lido, a tela muda na hora e a
  gravação segue atrás; antes de ler, a marca nova é **somada** ao que já estava guardado.
- **Voltar para o app busca novidade**: ao voltar para a frente (`visibilitychange`) o app reconferia a
  rede, mas `definirOnline()` retornava cedo quando o estado não mudava — a central ficava velha até
  alguém abrir uma viagem. Esse caminho agora sincroniza de verdade, com teste de tela cobrindo. O
  teste só encontrou o defeito porque passou a mudar `navigator.onLine` de verdade: disparar só o
  evento, com a rede ainda "online", provava uma reação que não existia.
- **Nada de ação externa insinuada (§13)**: a notificação leva para a tela certa do app (despesa →
  Gastos, convite → Participantes, checklist → Mais) e o texto diz o que **não** aconteceu — convite
  enviado não é aceite, acerto a confirmar não move dinheiro, valor pendente não entra no saldo
  oficial. Prioridade aparece em **texto** ("Alta prioridade"), nunca só por cor.
- **Placar desta rodada** (tudo verde, `npm test` na raiz): ferramentas 44 · domínio 151 ·
  sincronização 48 · app 46 (unitário) + 37 (interface, jsdom) · API 86 = **412**. A suíte de interface
  ganhou 9 testes da central: contagem igual nas duas telas, ler sem resolver, dispensa que não esconde
  piora, filtros por situação/viagem/assunto/prioridade, "só o que depende de mim" e a ação levando à
  aba certa.

### Reservas e revisão de impacto (2026-10-15, nona rodada)

- **Reservas entram no app** (tela 14) com a regra que separa reserva de promessa: a reserva **nasce
  prevista** e confirmar é ação separada que **exige evidência** (localizador, código, comprovante).
  Decidido, não perguntado: sem evidência não existe "confirmada" — a interface não pode insinuar que
  o app falou com o hotel (§13). Confirmar muda a **natureza** do dinheiro (estimativa → já combinado),
  nunca o valor; cancelar exige motivo, preserva a evidência e avisa que **não** cancela no fornecedor.
- **Orçamento e revisão de impacto do roteiro** (etapas 8/9): `resumirOrcamentoDoRoteiro` mostra o
  previsto (estimativa × já combinado, "a verificar" sem somar) separado do **gasto oficial** — o
  previsto é planejamento e não entra no saldo. `revisarImpacto` mostra, **antes** de concluir ou
  cancelar uma atividade, o que muda e o que não muda (saldo oficial, despesas já registradas).
- **Cache de versão anterior não derruba tela**: ao ler do aparelho a carga é completada
  (`cargaCompleta`). Quem atualiza o app tem cache gravado pela versão antiga — e foi exatamente esse
  cache que faria a tela quebrar quando `reservas` entrou. Há teste para isso.
- **Testes de interface rodam em sequência**: dois apps em jsdom em paralelo deixavam a máquina lenta
  e um fluxo com espera de rede estourava o prazo. Teste instável mente — a suíte de UI agora roda
  `--test-concurrency=1` e ficou estável em três execuções completas seguidas.

### Defeitos de uso real + orçamento do roteiro (2026-10-15, oitava rodada)

- **Três defeitos relatados, três causas encontradas** (nenhuma era "cosmética"):
  1. **Criar viagem abria/caía na viagem cancelada anterior.** Eram três causas somadas: `viagemAtiva` era
     valor fixo durante a passada (o resultado da viagem antiga era mesclado por cima da nova); `abrirViagem`
     só limpava o cache quando havia viagem anterior (o caso "primeira viagem" não limpava); e a comparação de
     versão era feita **entre viagens diferentes**, recusando a troca (`v1 !== v2`). Correção: `trocandoDeViagem`
     zera viagem e listas ao abrir outra, o cursor é por viagem e a versão só é comparada dentro da mesma viagem.
  2. **"Sair" não fazia nada.** O plugin de armazenamento seguro é um Proxy no navegador e o `await` ficava
     pendurado para sempre. Correção: só usar o plugin quando `Platform.ehNativo() && isPluginAvailable`, teto
     de 3 s (`comTempoLimite`), tela muda **antes** da limpeza e `lia.saidaPendente`/cleanup retoma no próximo uso.
  3. **A viagem criada não chegava ao servidor.** A fila era lida no início da passada e gravada no fim: o que
     fosse criado no meio era apagado. Correção: `filaInicial` + `salvarFila()` + `juntarFilaDaPassada`.
- **Defeito que só o teste de interface pegou**: abrir o roteiro de uma viagem com atividade deixava a tela
  **em branco** (`linhasDeContexto` lia `custo.centavos` e a tela entrega a forma do domínio). Agora `custoDoCartao`
  aceita as duas formas e dado incompleto é **desconhecido**, nunca zero. É a razão de a suíte de UI ser obrigatória.
- **Avalanche de sincronizações**: cada pedido feito durante uma passada disparava uma passada nova. Abrir o app
  criava uma fila de sincronizações e a tela ficava presa em "Confirmando a viagem com o servidor…". Agora todos
  os pedidos durante uma passada esperam **a mesma** passada seguinte (in-flight + dirty flag).
- **Orçamento do roteiro é planejamento, não dinheiro oficial** (`decidido, não perguntado`): `resumirOrcamentoDoRoteiro`
  soma estimativa e compromisso **separados**, conta "a verificar" sem somar, ignora cancelada e nunca escreve
  `R$ 0,00` para desconhecido. A aba Gastos mostra "Previsto no roteiro" ao lado de "Gasto confirmado (oficial)",
  com a frase que separa os dois: o previsto não entra no saldo oficial.
- **Revisão de impacto antes de mudar** (`UI_V1_DECISIONS` §13): concluir e cancelar mostram, antes do botão, o que
  muda (valor que sai do previsto, motivo que fica no histórico) e o que **não** muda (saldo oficial, despesas já
  registradas, compromisso assumido fora do app). O bloco é gerado no domínio (`revisarImpacto`), não no JSX.

### Nunca descartar trabalho local e nunca deixar a rodada presa (2026-10-13, quinta rodada)
- **Dois defeitos encontrados em uso real, ambos corrigidos:**
  1. **A rodada ficava presa com o banco pronto.** O passo do banco rodava com a saída em "cano" (`pipe`)
     para poder mostrar o progresso. O `pg_ctl` sobe o PostgreSQL e termina, mas **o servidor continua
     rodando e herda o cano**; o Node então espera para sempre por um cano que nunca fecha. Resultado:
     ~1 hora parada logo depois de escrever o `.env`, com todo o trabalho concluído. Duas correções:
     a saída do banco é **herdada** (sem cano) e o `db.mjs` **encerra explicitamente** ao terminar.
  2. **A atualização podia descartar trabalho em andamento.** Ao devolver alterações guardadas (`stash`),
     um conflito levava a `git reset --hard` — que apaga a cópia de trabalho (o conteúdo ficava só no
     stash). Isso apagou código em edição durante o desenvolvimento. **O mecanismo foi removido**:
     agora a atualização **não guarda nem descarta nada**; ela compara os arquivos alterados localmente
     com os que chegam do GitHub e decide: avança, reaplica os commits por cima, atualiza convivendo com
     as alterações (sem colisão), refaz relatórios gerados, ou **adia com explicação** (colisão em
     arquivo de verdade). Trabalho não commitado nunca é tocado.
- **Tetos de tempo em todas as etapas longas** (banco 15 min, dependências 10 min, testes 15 min):
  nenhuma rodada pode ficar presa indefinidamente. Ao estourar, a etapa é interrompida com explicação.
- **Regra para quem for mexer no código**: programa que deixa **outro processo vivo** (servidor do banco)
  deve rodar com saída **herdada**, nunca `stdio: "pipe"`. Há teste automatizado cobrindo esse travamento.

### Atualização automática: nada de desistir em silêncio (2026-10-13, quarta rodada)
- **O que aconteceu**: a atualização usava só `git merge --ff-only`. Com qualquer commit local (os relatórios
  automáticos, por exemplo) ela recusava, avisava de leve e **continuava com a versão velha** — o usuário
  precisou rodar `git pull` na mão. Além disso, mesmo quando a atualização dava certo, o processo em execução
  **não troca o próprio código**: o resto da rodada seguia com o comportamento antigo (foi por isso que a
  rodada "voltou direto para o banco de dados", sem as etapas numeradas).
- **Correções**: `fetch → decide → avançar` quando é simples; **rebase** quando existem commits locais (o
  trabalho da pessoa é reaplicado por cima, nada é descartado); **stash + devolução** quando há arquivos
  alterados; se a devolução conflitar, o projeto fica limpo na versão nova e a alteração fica guardada com
  instruções (nunca marca de conflito no arquivo); **a rodada reinicia sozinha** quando baixa código novo.
  ⚠️ **O `stash` desta rodada foi removido na rodada seguinte** (ele podia descartar trabalho em andamento —
  ver "Nunca descartar trabalho local", abaixo): hoje vale a comparação de arquivos e o commit de segurança.
- **Conflito durante o envio**: o DevKit deixava a cópia no meio de um rebase (com marcas de conflito), o que
  quebrava a rodada seguinte. Agora a sincronização desfaz só essa parte e preserva o commit local.
- **Cópia sem branch ("HEAD solto")**: em vez de criar uma branch nova e perdida, a automação reencontra a
  branch de trabalho que corresponde ao GitHub e volta para ela.
- **Atalho para o usuário**: `LiaGo.bat atualizar` (menu, opção 10) faz só a atualização, com explicação.

### Automação de um clique (2026-10-13) — comportamento do `LiaGo.bat`
- **Duplo clique não pergunta nada**: `LiaGo.bat` (sem argumento) roda `node tools/dev.mjs tudo` e ao final
  deixa a API e o app web no ar. As opções manuais continuam existindo em `LiaGo.bat menu`.
- **A rodada sempre envia o retrato da máquina**: `reports/estado-do-computador.md` (sistema, Node, npm,
  Python, Docker, modo do banco, dependências, testes, avisos e as últimas linhas do log) vai junto no commit
  automático — é assim que o responsável acompanha sem precisar de print de tela.
- **Falha nunca é escondida**: avisos da rodada entram no diagnóstico; se o envio não terminar, o trabalho
  local fica salvo e a próxima rodada tenta de novo.
- **Nenhuma etapa pode parecer travada** (correção pedida pelo usuário): a rodada tem 7 etapas numeradas;
  a saída de `npm install`, dos testes e do banco é mostrada **ao vivo** (antes era capturada e só aparecia
  no fim — o passo do banco ficava minutos em silêncio); o download do banco tem **barra com percentual e
  velocidade** e é cancelado com explicação se ficar 30s sem avançar; passos sem saída avisam
  `⏳ ainda trabalhando` a cada 15s e terminam com o tempo gasto (`criado em 23s`).

### Rodada do duplo clique no Windows: falha tem de vir com motivo (2026-10-15)
- **O que aconteceu**: a rodada do PC (`LiaGo.bat`, 20:52) terminou **242 passaram · 8 falharam** e o
  relatório não explicava nada — os 8 arquivos de teste de interface apareciam só como `'test failed'`.
  O `node --test` faz isso quando um **arquivo inteiro não carrega**: ele conta o arquivo como um teste
  reprovado e não imprime a causa. Além disso, o relatório guardava apenas as **60 últimas linhas** da
  saída, e o corte levava junto a explicação.
- **Correção (nada de "rodar de novo para ver")**: `reports/saida-dos-testes.md` passou a guardar a saída
  **completa** da rodada (nome fixo, teto de 200 KB), o relatório lista os arquivos que **nem chegaram a
  rodar** e `tools/teste-ui.mjs` roda cada um deles **direto com `node`**, gravando o erro de verdade em
  `reports/interface-diagnostico.md`. Verificado com um arquivo quebrado de propósito: a rodada imprimiu
  `POR QUE NÃO CARREGOU` e a mensagem exata.
- **Causa provável das 8 falhas**: o bundle de teste importava a imagem do hero e o empacotador não tem o
  plugin de assets do Vite. A imagem foi para `apps/mobile/public/lia-hero.jpg` (referenciada por caminho,
  `/lia-hero.jpg`) e os plugins de imagem saíram do empacotador: agora nenhum arquivo de imagem entra no
  bundle. A próxima rodada do PC confirma — e, se a causa for outra, o motivo vem escrito.
- **Menos coisa para dar errado no bundle**: `@lia-go/domain` e `@lia-go/sync` passaram a ser empacotados
  dentro do arquivo de teste (antes o Node resolvia o workspace em tempo de execução, e ainda precisava
  tirar os tipos deles de dentro de `node_modules` — que é onde Windows e Linux podem divergir). O bundle
  agora só deixa de fora pacote de terceiros instalado (`jsdom`, `react`, `@capacitor/*`,
  `fake-indexeddb`), igual ao que os testes de unidade do app já fazem todo dia.
- **Aviso do fim da rodada**: com o **GitHub CLI** (`gh`) instalado e autenticado, o relatório é publicado
  como comentário no pull request da branch. Sem `gh`, nada falha: o relatório continua subindo no commit,
  que é por onde o responsável lê a rodada.

### Ambiente de desenvolvimento no Windows (2026-10-12, terceira rodada) — hipóteses reversíveis
- **PostgreSQL do dia a dia continua sendo o Docker Compose** (decisão confirmada). O que mudou foi a
  **ordem de tentativa** quando não há Docker rodando: binários já instalados (`PG_BIN`/pastas padrão) →
  **PostgreSQL portátil** (download único de ~12 MB do PyPI para `.pgbin/`, fora do Git) → `DATABASE_URL`
  existente. Motivo: no Windows o Docker Desktop costuma estar fechado, e sem banco os testes de integração
  eram pulados em silêncio. Nada disso substitui a decisão do Docker; é só o caminho de entrada.
- **Por que baixar do PyPI e não instalar via `pip`**: o caminho anterior dependia do Python da máquina
  (os pacotes publicados param no 3.12, e o PC do usuário tem 3.14). O pacote do PyPI é um arquivo
  imutável que carrega o PostgreSQL compilado — baixamos e usamos os programas direto, sem Python.
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
