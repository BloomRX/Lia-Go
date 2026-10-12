# Backlog — Lia Go

Atualizado em 2026-10-12, alinhado à stack decidida (React + TypeScript + Capacitor) e a `docs/ARCHITECTURE.md`.
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
- 🔄 Barra inferior com Visão geral, Gastos e Mais, identidade escura roxo/magenta e estados
  carregando/vazio/erro/sem permissão implementados; Roteiro e Documentos entram nas próximas fatias.

## Fase 1 — Contas, viagens e acesso (primeira etapa)
- ✅ `packages/domain` com 54 testes cobrindo dinheiro, rateio, estados, papéis, despesas, saldos e convites.
- ✅ PostgreSQL central com migrações versionadas (`0001_init.sql`) e SQL explícito via `pg`.
- ✅ Registro/login/logout/sessão/revogação, scrypt, cookie HttpOnly, tokens nativos e limite de tentativas.
- ✅ Criar/editar/consultar viagem com autorização no servidor e concorrência otimista (409 em conflito).
- ✅ Papéis, convites com cancelamento, aceite por e-mail, saída e remoção com histórico preservado.
- ✅ Transições com motivo obrigatório em Pendente, sugestão sem aplicação automática e auditoria.
- ✅ App com login/cadastro, lista, criação, troca de estado, convites e gastos contra a API real.
- ✅ Testes negativos: acesso cruzado, convite de outra pessoa, membro que saiu, rateio com não-membro.

## Fase 2 — Núcleo financeiro determinístico (início já na primeira etapa)
- ✅ Rateio igualitário, por valores e percentual (bps), com soma exata e explicação do centavo.
- ✅ Ciclo completo implementado e testado, inclusive correção com motivo e histórico antes/depois.
- ⬜ Orçamento coletivo/individual, realizado versus comprometido, alertas 75/90/100% configuráveis.
- ⬜ Moeda estrangeira com valor original, taxa, referência temporal e convertido (histórico preservado).
- 🔄 Saldos e transferências sugeridas prontos; acerto informado → confirmado pelo recebedor pronto.
  Pagamento parcial e reembolso ligado à despesa ficam para a próxima fatia.
- ⬜ Reembolsos e correções auditáveis com motivo e revisão independente.
- 🔄 54 testes de domínio + 29 de integração cobrem limites, restos e permissões; câmbio entra com o módulo de moedas.

## Fase 3 — Roteiro, reservas e documentos
- ⬜ Roteiro por dia (timeline), atividades com estados manuais e versões anteriores.
- ⬜ Revisão de impacto antes de substituir o roteiro vigente.
- ⬜ Reservas manuais assistidas, checklist e documentos privados com compartilhamento revogável.
- ⬜ Criação por conversa/formulário alternáveis (sem perguntas repetidas) — depende da camada de IA.

## Fase 4 — Offline, notificações e fechamento
- ⬜ Cache offline + outbox com idempotência (UUIDv7) e resolução explícita de conflitos.
- ⬜ Central de notificações com filtros, leitura ≠ dispensa ≠ resolução.
- ⬜ Fechamento (previsto × realizado), exportação conforme permissões e resumo pós-viagem.

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
