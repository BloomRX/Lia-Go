# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 13/10/2026, 03:59:56
- **Sistema:** linux x64 · **Node:** v22.22.3 · **npm:** 10.9.8
- **Python:** python3 3.11 · python 3.11
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 180 passaram, 0 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** 40d58cf fix: corrige travamento de ~1h (saida do banco herdada + encerramento explicito), tetos de tempo nas etapas longas e atualizacao que nunca descarta trabalho local

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
duration_ms: 175.862473
  type: 'test'
  ...
# Subtest: organizador único: a viagem tem exatamente um organizador ativo
ok 38 - organizador único: a viagem tem exatamente um organizador ativo
  ---
  duration_ms: 178.903294
  type: 'test'
  ...
# Subtest: o organizador não pode se remover: precisa usar a ação de sair
ok 39 - o organizador não pode se remover: precisa usar a ação de sair
  ---
  duration_ms: 94.233861
  type: 'test'
  ...
1..39
# tests 39
# suites 0
# pass 39
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9897.972374
```

### Log do banco de dados (fim)

```
2026-10-13 03:58:56.481 UTC [5907] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
2026-10-13 03:59:12.259 UTC [6305] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-13 03:59:12.259 UTC [6305] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-13 03:59:12.259 UTC [6305] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-13 03:59:21.315 UTC [6346] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-13 03:59:21.315 UTC [6346] DETAIL:  Key (viagem_id)=(3b56b648-4f54-4427-929f-768c64849e09) already exists.
2026-10-13 03:59:21.315 UTC [6346] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
2026-10-13 03:59:47.165 UTC [7159] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-13 03:59:47.165 UTC [7159] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-13 03:59:47.165 UTC [7159] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-13 03:59:56.426 UTC [7291] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-13 03:59:56.426 UTC [7291] DETAIL:  Key (viagem_id)=(8ae7ea4b-3682-4e88-96b9-e1b412f8d09b) already exists.
2026-10-13 03:59:56.426 UTC [7291] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

