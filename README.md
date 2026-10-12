# Lia Go

Aplicativo gratuito para organizar viagens em grupo: roteiro, reservas e documentos, orçamento,
despesas compartilhadas, rateios e acertos — com a assistente Lia.
Celular é a plataforma principal; a versão web é complementar.

## Estado atual (2026-10-12)

| Área | Situação |
|---|---|
| Planejamento de produto e regras | ✅ completo em `docs/` |
| Decisão de stack | ✅ React + TypeScript + Capacitor; PostgreSQL central (`docs/ARCHITECTURE.md`) |
| Domínio (dinheiro, rateio, estados, permissões, despesas, saldos, convites) | ✅ **54 testes** |
| API (auth, viagens, convites, transições, despesas, saldos, acertos) | ✅ **39 testes** com PostgreSQL real |
| App (React + Vite + Capacitor: login, viagens, gastos, acertos) | ✅ telas funcionais contra a API real |
| Sincronização offline (fila de envio, cache local, conflito com decisão humana) | ✅ **38 + 13 testes** (`npm run test:sync`, `npm run test:app`) |
| Automação de execução | ✅ `LiaGo.bat` (um duplo clique: banco, testes, relatório, sincronização, reinstalar dependências e diagnóstico de falhas) |
| Roteiro / reservas / documentos | ⬜ próximas fatias |
| Ferramentas de git seguro (DevKit) | ✅ funcionando, 44 testes passando |

## Ordem de leitura
1. `docs/AGENTS.md` — instruções obrigatórias de trabalho (fonte única; a raiz apenas aponta para ela).
2. `docs/PLANEJAMENTO_MESTRE.md` — visão geral e decisões consolidadas (única fonte do planejamento).
3. `docs/ARCHITECTURE.md` — arquitetura, viabilidade medida, riscos e decisões pendentes.
4. `docs/PRODUCT_OVERVIEW.md` — proposta de produto e escopo.
5. `docs/BUSINESS_RULES.md` — regras de negócio.
6. `docs/UX_SCREENS.md` — navegação e comportamento das telas.
7. `docs/TECHNICAL_GUIDELINES.md` — princípios técnicos e segurança.
8. `docs/IMPLEMENTATION_BACKLOG.md` — ordem de implementação.
9. `docs/DECISIONS_AND_OPEN_QUESTIONS.md` — decisões confirmadas e pendências.
10. `tools/README.md` — DevKit: git seguro, validação e PR.

## Como rodar
```text
Windows (duplo clique):  LiaGo.bat          → opção 1 faz tudo (banco, testes, relatório, sync)
Terminal (qualquer SO):  npm install && npm run db:up && npm run migrate && npm test
Desenvolvimento:         LiaGo.bat (opção 3) → API em :3000 e app web em :5273
```
Guia completo com requisitos, celular na mesma rede, Android e problemas comuns: **`docs/DEV_SETUP.md`**.
- `DevKit.bat` / `python tools/project_cli.py <comando>`: git seguro (validar, sincronizar, PR).
- Nenhum segredo é versionado; configuração por variável de ambiente (`.env` fica fora do Git).

## Como usar (documentação)
- Trate `PLANEJAMENTO_MESTRE.md` e os documentos de regras como fonte de verdade.
- Não invente decisões de produto silenciosamente.
- Dúvidas pequenas e reversíveis: escolha a solução mais simples, documente a hipótese e prossiga.
- Decisões de alto impacto (segurança, privacidade, pagamentos, custos recorrentes, arquitetura,
  exclusão de dados, permissões ou escopo): pare e peça confirmação.
- Atualize a documentação junto com cada implementação relevante.
