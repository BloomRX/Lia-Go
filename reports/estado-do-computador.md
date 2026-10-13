# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 13/10/2026, 02:05:39
- **Sistema:** linux x64 · **Node:** v22.22.3 · **npm:** 10.9.8
- **Python:** python3 3.11 · python 3.11
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 176 passaram, 0 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** aea9c72 chore: rodada automatica do LiaGo.bat (2026-10-13 01:39)

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
duration_ms: 204.569485
  type: 'test'
  ...
# Subtest: organizador único: a viagem tem exatamente um organizador ativo
ok 38 - organizador único: a viagem tem exatamente um organizador ativo
  ---
  duration_ms: 200.422406
  type: 'test'
  ...
# Subtest: o organizador não pode se remover: precisa usar a ação de sair
ok 39 - o organizador não pode se remover: precisa usar a ação de sair
  ---
  duration_ms: 108.605511
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
# duration_ms 10607.429859
```

### Log do banco de dados (fim)

```
2026-10-13 02:05:10.763 UTC [11971] LOG:  starting PostgreSQL 16.2 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 10.2.1 20210130 (Red Hat 10.2.1-11), 64-bit
2026-10-13 02:05:10.763 UTC [11971] LOG:  listening on IPv4 address "127.0.0.1", port 55432
2026-10-13 02:05:10.774 UTC [11971] LOG:  listening on Unix socket "/home/user/Lia-Go/.pgdata/.s.PGSQL.55432"
2026-10-13 02:05:10.776 UTC [11974] LOG:  database system was shut down at 2026-10-13 02:05:10 UTC
2026-10-13 02:05:10.778 UTC [11971] LOG:  database system is ready to accept connections
2026-10-13 02:05:29.348 UTC [12554] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-13 02:05:29.348 UTC [12554] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-13 02:05:29.348 UTC [12554] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-13 02:05:39.231 UTC [12700] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-13 02:05:39.231 UTC [12700] DETAIL:  Key (viagem_id)=(613ad36d-10fd-4703-b30e-bdc6adccda76) already exists.
2026-10-13 02:05:39.231 UTC [12700] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

