# Backlog — Lia Go

Atualizado em **2026-10-19** (entrega das Fatias A, B, C e D da V1 — telas 7, 8, 9, 11, 13, 17 e 18 completas), alinhado à stack decidida (React + TypeScript + Capacitor) e a `docs/ARCHITECTURE.md`.
Legenda: ✅ concluído · 🔄 em andamento · ⬜ pendente.

## Fase 0 — Reconhecimento e base executável
- ✅ Identificar stack, estrutura, comandos, estado de build e testes (44 testes do DevKit executados).
- ✅ Resumir riscos, lacunas e arquitetura existente (`docs/ARCHITECTURE.md`).
- ✅ Medir viabilidade do React + TypeScript + Capacitor no ambiente e documentar requisitos (Node 22,
  Android Studio Otter 2025.2.1+, JDK 21, SDK 36; iOS exige macOS + Xcode 26).
- ✅ Definir padrão de erros da API, estados de carregamento e acessibilidade.
- ✅ Monorepo (npm workspaces) com `apps/mobile`, `apps/api` e `packages/domain` em uso de verdade
  (`packages/contracts` foi postergado: os tipos de entrada/saída vivem em `apps/api/src` e no app por ora).
- ✅ `.gitignore`, `devkit.json` (suítes reais) e Vite validado com `host: true` + `allowedHosts`.
- ✅ `LiaGo.bat` + `tools/dev.mjs`: sobe banco, migra, testa, gera relatório em `reports/` e sincroniza.
- ✅ Barra com Visão geral, Roteiro, Gastos e Mais; identidade escura roxo/magenta, referências oficiais
  aplicadas (hero da viagem com a Lia, próximo compromisso em destaque, orçamento com barra) e estados
  carregando/vazio/erro/sem permissão. Documentos e checklist vivem na aba Mais por ora.
- 🔄 Placar de testes da rodada: ferramentas 53 · domínio 158 · sincronização 49 · app 53 + 54 (jsdom) · API 94 = **461**.

## Fase 1 — Contas, viagens e acesso (primeira etapa)
- ✅ `packages/domain` com **157 testes** cobrindo dinheiro, rateio, estados, papéis, despesas, saldos,
  convites, roteiro, reservas, orçamento, checklist, documentos, fechamento e a central de notificações.
- ✅ PostgreSQL central com migrações versionadas (`0001`–`0008`) e SQL explícito via `pg`.
- ✅ Registro/login/logout/sessão/revogação, scrypt, cookie HttpOnly, tokens nativos e limite de tentativas.
- ✅ Criar/editar/consultar viagem com autorização no servidor e concorrência otimista (409 em conflito).
- ✅ Papéis, convites com cancelamento, aceite por e-mail, saída e remoção com histórico preservado.
- ✅ Transições com motivo obrigatório em Pendente, sugestão sem aplicação automática e auditoria.
- ✅ App com login/cadastro, lista, criação, troca de estado, convites e gastos contra a API real.
- ✅ Testes negativos: acesso cruzado, convite de outra pessoa, membro que saiu, rateio com não-membro.

## Fase 2 — Núcleo financeiro determinístico (início já na primeira etapa)
- ✅ Rateio igualitário (com seleção de quem participa), por valores fixos e percentual (bps) na API, no domínio e na interface (tela 11), com soma exata e prévia do centavo de resto.
- ✅ Ciclo completo implementado e testado, inclusive correção com motivo e histórico antes/depois.
- ✅ Orçamento coletivo/individual com limite (planejamento, nunca saldo oficial), barra com estado em
  texto e limiar de atenção configurável (`70%`, `80%`, `90%` na tela 18); o previsto continua separado do gasto confirmado.
- ✅ Moeda estrangeira (`USD`, `EUR`, `GBP`, `ARS`) na tela 13 com valor original, taxa histórica inteira determinística (escala 10.000, sem float), data de cotação e valor convertido em `BRL` preservando o histórico.
- ✅ Saldos, transferências sugeridas e acertos (informado → confirmado por quem recebeu) na tela e na API.
  Pagamento parcial e reembolso ligado à despesa ficam para a próxima fatia.
- ⬜ Reembolsos e correções auditáveis com motivo e revisão independente.
- 🔄 158 testes de domínio + 94 de API + 107 do app cobrem limites, restos, permissões, orçamento, checklist, documentos,
  fechamento, notificações, rateio e câmbio.

## Fase 3 — Roteiro, reservas e documentos
- ✅ Roteiro por dia (timeline), atividades com estados manuais e versões anteriores.
- ✅ Revisão de impacto antes de concluir/cancelar atividade, antes de compartilhar/remover documento e
  **antes de substituir o roteiro vigente do dia** (tela 8: diferenças, conflitos de horário e impacto no orçamento previsto).
- ✅ Reservas manuais assistidas, checklist (prazo não conclui; reabertura com motivo) e documentos privados
  por padrão com compartilhamento revogável, remoção lógica com motivo e limpeza da cópia local de quem
  perdeu acesso.
- ✅ **Corrigido (2026-10-16, rodada do PC da tarde)**: dependência nova não era instalada. A
  conferência usava uma lista fixa de pacotes; `lucide-react` entrou na fatia de identidade visual,
  a lista não o conhecia, o `npm install` foi pulado e o site abriu com "Failed to resolve import"
  (9 falhas de interface e o typecheck vermelho). Agora a conferência lê **todos** os `package.json`
  (raiz e workspaces) e o `package-lock.json`, mostra **o que** falta e a rodada ainda pergunta
  "o app abriu?" percorrendo os módulos como o navegador faria — em vez de confiar na porta aberta.
- ✅ **Corrigido (2026-10-16, rodada do PC)**: criar viagem podia perder a operação — a passada de
  sincronização lia a fila, a criação entrava nesse intervalo e a gravação do fim apagava a operação
  nova. A viagem nunca chegava ao servidor e a tela ainda dizia "Tudo sincronizado". Agora toda
  transformação da fila acontece numa **seção crítica** do armazenamento (`mutar`/`mutarFila`, uma
  transação no IndexedDB), e a criação continua tentando sozinha enquanto a pessoa está na tela —
  abrindo a viagem quando o servidor confirma, que é o que o aviso promete.
- ✅ **Corrigido (2026-10-16)**: o teste do "próximo compromisso" fazia a conta de "amanhã" em UTC e
  falhava depois das 21h (horário de São Paulo). Agora app e teste usam a mesma função
  (`amanhaIso`), no fuso das viagens.
- ✅ A ficha da atividade guarda o que **não é horário**: observações (também usadas para acessibilidade),
  o vínculo com a reserva da viagem (mostrando a evidência que já existe quando confirmada) e o **vínculo com
  documento da viagem** (tela 7), respeitando a privacidade `404` (quem não tem acesso ou perdeu acesso não
  descobre a existência de documento privado pelo vínculo).
- ✅ **Identidade visual das referências (2026-10-16)**: marca oficial (pino em SVG no app + imagem
  oficial como ícone/favicon), barra inferior com ícone **e** rótulo (Lucide), etiquetas com ponto +
  palavra, glow como acento e cartões com profundidade discreta. Nenhuma identidade paralela e nenhum
  dado novo na tela.
- ⬜ Seletor lateral da web e a aba **Documentos** própria na barra inferior (cinco destinos exigem
  teste em tela pequena) — pedidos pelas referências, adiados de propósito.
- ⬜ Criação por conversa/formulário alternáveis (sem perguntas repetidas) — depende da camada de IA.

## Fase 4 — Offline, notificações e fechamento
- ✅ Cache offline + fila de envio (outbox) com idempotência e resolução explícita de conflitos.
  Ids de operação usam `crypto.randomUUID()` (UUIDv4); trocar para UUIDv7 (ordenável por tempo) é uma
  melhoria pequena e localizada, sem impacto no servidor.
- ✅ Central de notificações (tela 16) com filtros de situação, viagem, assunto, prioridade, busca e
  "só o que depende de mim": **leitura ≠ dispensa ≠ resolução**. A central é derivada dos dados que já
  existem (nada de tabela de notificações no servidor); a chave carrega a revisão do fato, então dispensar
  2 pendências não esconde as 3 que vierem depois; Início e central mostram o mesmo número (mesmo hook);
  cada item abre a tela certa do app e o texto diz o que **não** aconteceu (§13).
- ✅ Fechamento (previsto × realizado) com números do servidor, acertos sugeridos e exportação `.txt`/`.csv`
  (`viagem:exportar`); no celular sem download, o texto aparece para copiar.

## Fase 5 — Preparação para uso real
- ⬜ HTTPS, hospedagem do banco/API, backup e restauração testados.
- ⬜ Política de privacidade/retenção (LGPD), exclusão de conta e limites de custo de IA.
- ⬜ Acessibilidade, desempenho, testes de segurança e de falha.
- ⬜ Build/assinatura Android (Windows) e iOS (macOS), decisão sobre publicação nas lojas.
- ⬜ Revisar pendências antes de declarar versão utilizável.

## Fora do caminho crítico da V1
- Integração direta de Pix.
- Integrações automáticas de reservas.
- Automações avançadas que dependam de serviços pagos ou dados não confiáveis.
