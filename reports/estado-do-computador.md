# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 13/10/2026, 03:49:57
- **Sistema:** linux x64 · **Node:** v22.22.3 · **npm:** 10.9.8
- **Python:** python3 3.11 · python 3.11
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 178 passaram, 0 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** 820b56d chore: rodada automatica do LiaGo.bat (2026-10-13 02:16)

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
duration_ms: 166.712597
  type: 'test'
  ...
# Subtest: organizador único: a viagem tem exatamente um organizador ativo
ok 38 - organizador único: a viagem tem exatamente um organizador ativo
  ---
  duration_ms: 162.555839
  type: 'test'
  ...
# Subtest: o organizador não pode se remover: precisa usar a ação de sair
ok 39 - o organizador não pode se remover: precisa usar a ação de sair
  ---
  duration_ms: 93.549859
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
# duration_ms 9462.224899
```

### Log do banco de dados (fim)

```
2026-10-13 03:48:29.537 UTC [1699] LOG:  starting PostgreSQL 16.2 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 10.2.1 20210130 (Red Hat 10.2.1-11), 64-bit
2026-10-13 03:48:29.537 UTC [1699] LOG:  listening on IPv4 address "127.0.0.1", port 55432
2026-10-13 03:48:29.538 UTC [1699] LOG:  listening on Unix socket "/home/user/Lia-Go/.pgdata/.s.PGSQL.55432"
2026-10-13 03:48:29.539 UTC [1702] LOG:  database system was shut down at 2026-10-13 03:48:29 UTC
2026-10-13 03:48:29.541 UTC [1699] LOG:  database system is ready to accept connections
2026-10-13 03:49:48.724 UTC [2572] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-13 03:49:48.724 UTC [2572] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-13 03:49:48.724 UTC [2572] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-13 03:49:57.543 UTC [2613] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-13 03:49:57.543 UTC [2613] DETAIL:  Key (viagem_id)=(e0cee4bb-e0b1-43cb-b030-83b88a594a62) already exists.
2026-10-13 03:49:57.543 UTC [2613] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

