# Backlog — Lia Go

Atualizado em 2026-10-12, alinhado à stack decidida (React + TypeScript + Capacitor) e a `docs/ARCHITECTURE.md`.
Legenda: ✅ concluído · 🔄 em andamento · ⬜ pendente.

## Fase 0 — Reconhecimento e base executável
- ✅ Identificar stack, estrutura, comandos, estado de build e testes (44 testes do DevKit executados).
- ✅ Resumir riscos, lacunas e arquitetura existente (`docs/ARCHITECTURE.md`).
- ✅ Medir viabilidade do React + TypeScript + Capacitor no ambiente e documentar requisitos (Node 22,
  Android Studio Otter 2025.2.1+, JDK 21, SDK 36; iOS exige macOS + Xcode 26).
- ✅ Definir padrão de erros da API, estados de carregamento e acessibilidade.
- ⬜ Criar monorepo (npm workspaces): `apps/mobile`, `apps/api`, `packages/domain`, `packages/contracts`.
- ⬜ Criar `.gitignore`, `devkit.json` (suítes de teste reais) e configuração de Vite validada
  (`host: true` + `allowedHosts`; sem isso o preview responde 403).
- ⬜ Criar `LiaGo.bat`: instala se faltar, roda testes, gera relatório em `reports/`, sincroniza a branch.
- ⬜ Shell/navegação mobile (barra inferior: Visão geral, Roteiro, Gastos, Documentos + Mais) com
  identidade escura roxo/magenta e estados loading/vazio/erro/offline/sem permissão.

## Fase 1 — Contas, viagens e acesso (primeira etapa)
- ⬜ `packages/domain`: dinheiro em centavos, transições de estado, papéis e validações puras + testes reais.
- ⬜ Banco PostgreSQL central com migrations versionadas (Drizzle + `pg`); nada de SQLite central.
- ⬜ API: registro, login, logout, sessão e revogação (scrypt + cookie HttpOnly + limite de tentativas).
- ⬜ API: CRUD de viagem/rascunho com autorização server-side e `version` (concorrência otimista).
- ⬜ Papéis organizador/participante; convites individuais com cancelamento; saída ≠ remoção ≠ exclusão.
- ⬜ Transições Em andamento/Concluída/Pendente/Cancelada conforme regras, com auditoria de quem confirmou.
- ⬜ App: login, lista de viagens, criação de viagem e troca de estado contra a API real.
- ⬜ Testes negativos de acesso cruzado entre viagens e participantes.

## Fase 2 — Núcleo financeiro determinístico (início já na primeira etapa)
- ⬜ Rateio: igualitário, participantes específicos, valores fixos e percentual, com soma exata de centavos.
- ⬜ Despesa pendente → confirmação por pessoa diferente do autor → contestação (fora do saldo oficial).
- ⬜ Orçamento coletivo/individual, realizado versus comprometido, alertas 75/90/100% configuráveis.
- ⬜ Moeda estrangeira com valor original, taxa, referência temporal e convertido (histórico preservado).
- ⬜ Saldos, transferências sugeridas, acertos manuais, pagamento informado × confirmado × parcial.
- ⬜ Reembolsos e correções auditáveis com motivo e revisão independente.
- ⬜ Testes abrangentes de dinheiro (limites, arredondamento, restos) e de permissões.

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
