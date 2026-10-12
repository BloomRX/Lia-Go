# Diretrizes técnicas — Lia Go

Restrições e critérios técnicos. A **stack está decidida** (React + TypeScript + Capacitor) e a
viabilidade foi medida — detalhes e evidências em `ARCHITECTURE.md`.

## Stack
- **Monorepo com npm workspaces**, TypeScript em todo o projeto (implementado).
- `apps/mobile` — React + TypeScript + Vite + Capacitor (uma base de código para app e web).
- `apps/api` — servidor HTTP (Fastify) com validação por schema (zod, compartilhado em `packages/contracts`).
- `packages/domain` — regras de negócio puras, **sem I/O e sem UI**, importadas pelo servidor e pelo app.
- Banco **PostgreSQL** central com migrações SQL versionadas; acesso a dados em SQL explícito
  com o driver `pg` (sem ORM, por auditabilidade — decisão registrada em `DECISIONS_AND_OPEN_QUESTIONS.md`).
- Testes de domínio/API com `node --test` (TypeScript nativo do Node 22, sem build); interface com Vitest.

### Regra de autoridade (não negociável)
O app pode calcular prévias para a interface e para o modo offline, mas **o servidor é a única autoridade**:
recalcula, revalida permissões e grava. Nenhum resultado vindo do cliente (nem de IA) altera saldo oficial
ou confirma fatos externos. Não duplicar regra de negócio na interface: importar do domínio.

## Arquitetura e domínio
- Separar interface, regras de domínio, persistência e integrações externas.
- Centralizar transições de estado e cálculos em serviços testáveis.
- Aplicar autorização no servidor para cada operação (testes negativos entre viagens e participantes).
- Modelos explícitos para viagens, membros/convites, atividades, reservas, documentos, despesas,
  parcelas de rateio, movimentos de reembolso, saldos/acertos, notificações e trilha de auditoria.
- Migrations versionadas e estratégia de backup/restauração adequada ao ambiente escolhido.
- O banco central é PostgreSQL no servidor. **SQLite local não é banco central**; no dispositivo é
  apenas cache offline, revalidado ao sincronizar.

## Dinheiro e câmbio
- Valores em **centavos inteiros** (`bigint` no domínio, `BIGINT` no Postgres), nunca float binário.
- Documentar escala, moeda, arredondamento e alocação de centavos (método do resto garante soma exata).
- Preservar dados de origem e taxa histórica; atualização de taxa não reescreve registros.
- Cálculos reproduzíveis, cobertos por testes de casos-limite (0, 1 centavo, restos grandes, percentuais).
- Separar valores provisórios dos confirmados.

## Concorrência e sincronização
- Não resolver conflito apenas por timestamp do dispositivo.
- Toda entidade sincronizável carrega `version`; escrita com version divergente = conflito preservado.
- Revalidar permissões no momento da sincronização.
- Operações offline ficam pendentes em fila (**outbox**) até validação e confirmação.
- Idempotência obrigatória (`Idempotency-Key` por operação, IDs gerados no cliente em UUIDv7).
- Mostrar ao usuário o último sync e o estado desatualizado; conflito aparece como item “a revisar”.

## Segurança e privacidade
- Princípio do menor privilégio, validação de entrada no servidor, proteção de sessão, limitação de
  tentativas de login e gestão segura de segredos (variáveis de ambiente; `.env` fora do Git).
- Senhas com **scrypt** (`node:crypto`), salt por usuário e parâmetros versionados no banco.
- Sessão em cookie **HttpOnly** (`Secure`+`SameSite` conforme o canal); nenhum token em armazenamento
  acessível a JavaScript na web.
- HTTPS obrigatório antes de qualquer dado real; em rede local usar **apenas dados sintéticos**.
- Documentos e localização privados por padrão; consentimento separado para localização ao vivo e histórico.
- Minimizar dados pessoais em logs, analytics e push; nunca logar valores financeiros sensíveis nem tokens.
- Exportação respeita as mesmas permissões da interface.
- Implementar exclusão/retensão conforme política a definir; não apagar registros financeiros compartilhados silenciosamente.
- Testes negativos de autorização entre viagens e participantes.

## Interface e plataforma
- Uma base de código (React + TS); diferenças de plataforma isoladas em serviços/adaptadores
  (`services/`), nunca espalhadas por componentes.
- Direção visual: base escura com roxo/magenta, brilho moderado, cartões arredondados, contraste e
  acessibilidade; alvos de toque e área segura do celular respeitados.
- Estados de interface obrigatórios por tela: carregando, vazio, erro, offline/desatualizado, conflito,
  sucesso e sem permissão.
- Configuração de desenvolvimento obrigatória no Vite (já aplicada em `apps/mobile/vite.config.ts`):
  `server.host: true`, `server.allowedHosts` com o host do preview e proxy `/api` para a API local —
  sem isso o preview responde HTTP 403 (medido em `ARCHITECTURE.md` §2).
- A interface nunca calcula saldo oficial: ela exibe o que a API devolve. O pacote de domínio é usado
  para prévia e para mensagens, nunca como fonte de verdade no cliente.

## Ferramentas de desenvolvimento
- `DevKit.bat` (existente): git seguro, validação e PR.
- `LiaGo.bat` (implementado): sobe o banco, aplica migrações, roda testes, gera relatório em `reports/`
  e sincroniza a branch de trabalho. Nunca instala nada silenciosamente nem publica em branch protegida;
  a senha do banco aparece sempre oculta nos relatórios.
- Guia de execução completo (Windows, Docker, Android e problemas comuns): `docs/DEV_SETUP.md`.
- Antes de rodar no Windows: Node ≥ 22.12. Para build Android: Android Studio (Otter 2025.2.1+),
  JDK 21 e Android SDK 36. **Arena não compila Android** (sem SDK); o build nativo é local.

## IA e integrações
- IA retorna propostas estruturadas sujeitas a validação; nunca escreve diretamente saldos oficiais.
- Tratar saída do modelo como conteúdo não confiável.
- Ter limites, monitoramento de custo, timeout, fallback e possibilidade de desligar a integração.
- Não alegar status em tempo real sem fonte atualizada.
- Integrações externas devem expor estado de conexão, falha e última atualização.
- Não confirmar reservas, pagamentos ou cancelamentos sem confirmação/evidência da integração real.

## Qualidade
- Testes unitários para regras e cálculos; integração para autorização/persistência; interface para fluxos críticos.
- Cobrir estados: loading, vazio, erro, offline, conflito, sucesso e não autorizado.
- Usar dados sintéticos em desenvolvimento e testes.
- Documentar como configurar, executar, testar e compilar.
