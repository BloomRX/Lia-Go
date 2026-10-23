# Padrões operacionais do repositório — Lia Go

Este arquivo registra os comandos estreitos do dia a dia e as regras de revisão para agentes e subagentes (`explore`, `reviewer`, `visual-qa`, `test-runner`).

## 1. Qual suíte rodar em cada caso (`test-runner`)

O `devkit.json` declara `full_tests` (`npm test` + `npm run typecheck`). No dia a dia, use a **suíte estreita** correspondente ao que foi tocado; rode a suíte completa apenas no portão antes de publicar:

| O que mudou | Comando estreito |
|---|---|
| `packages/domain` | `npm run test:domain` |
| `packages/sync` | `npm run test:sync` |
| `apps/api` | `npm run test:api` |
| `apps/mobile` (lógica / offline / serviços) | `npm run test:app` |
| `apps/mobile` (tela / componentes / UI) | `npm run test:ui` |
| `tools/` ou scripts da raiz | `npm run test:tools` |
| **Antes de publicar (portão)** | `npm test` e `npm run typecheck` |

## 2. Regra de revisão de dinheiro (`reviewer` = ALTO)

Mudança em `packages/domain` que toque dinheiro — **`money.ts`, `expense.ts`, `split.ts`, `balances.ts`, `orcamento.ts` ou `fechamento.ts`** — **nunca é aplicada sem revisão humana**, mesmo com teste verde.

- O subagente `reviewer` marca qualquer alteração nesses arquivos como **ALTO** por padrão.
- Valores oficiais são sempre inteiros em centavos (`bigint`), percentuais em *basis points* (`10_000 = 100%`), a soma das partes fecha exatamente com o total e despesas de moedas diferentes nunca são somadas sem conversão explícita.

## 3. Regra de sobrevivência offline

1. Toda função central lê e escreve offline — roteiro, checklist, despesa, reserva, documento, orçamento, prévia de impacto e fechamento/exportação. Sincronizar é bônus, nunca pré-requisito.
2. Quando a camada de IA entrar, ela é a primeira coisa a cair sem sinal — e o app nunca cai junto. Qualquer tela precisa funcionar integralmente sem modelo disponível.

## 4. Provedor de IA e rede

1. Aceitar um **endereço configurável**, com teste de conexão e listagem dos modelos que aquele endereço anuncia — nunca um fornecedor fixo.
2. `localhost` nunca fixo no código executável do app (no celular ele não existe).
3. Nunca embarcar chave do desenvolvedor no app ou no repositório.

## 5. Divisão git × máquina

- **Sessão (por git):** `packages/`, `apps/api/`, `apps/mobile/src/`, testes, migrações, documentação.
- **Máquina do desenvolvedor:** `npm run cap:add:android`, build nativa, emulador, assinatura, lojas e teste em aparelho.
- Afirmação máxima honesta sem rodar no aparelho: *"testes verdes; build nativa não executada"*.
