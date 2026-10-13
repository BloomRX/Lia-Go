# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 13/10/2026, 04:01:24
- **Sistema:** linux x64 · **Node:** v22.22.3 · **npm:** 10.9.8
- **Python:** python3 3.11 · python 3.11
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 181 passaram, 0 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** dbf4182 fix: restaura enviarParaOGitHub (removida por engano) e adiciona teste de integridade das funcoes do orquestrador

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
duration_ms: 180.923774
  type: 'test'
  ...
# Subtest: organizador único: a viagem tem exatamente um organizador ativo
ok 38 - organizador único: a viagem tem exatamente um organizador ativo
  ---
  duration_ms: 167.162728
  type: 'test'
  ...
# Subtest: o organizador não pode se remover: precisa usar a ação de sair
ok 39 - o organizador não pode se remover: precisa usar a ação de sair
  ---
  duration_ms: 98.510437
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
# duration_ms 9711.819686
```

### Log do banco de dados (fim)

```
2026-10-13 04:00:29.249 UTC [7784] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
2026-10-13 04:00:42.466 UTC [8180] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-13 04:00:42.466 UTC [8180] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-13 04:00:42.466 UTC [8180] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-13 04:00:51.666 UTC [8221] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-13 04:00:51.666 UTC [8221] DETAIL:  Key (viagem_id)=(cd73fcf7-94b8-46eb-ab01-f2a1b55586a4) already exists.
2026-10-13 04:00:51.666 UTC [8221] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
2026-10-13 04:01:15.513 UTC [8984] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-13 04:01:15.513 UTC [8984] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-13 04:01:15.513 UTC [8984] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-13 04:01:24.602 UTC [9117] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-13 04:01:24.602 UTC [9117] DETAIL:  Key (viagem_id)=(d1c014b9-59c6-4dce-8b08-4b1494718c73) already exists.
2026-10-13 04:01:24.602 UTC [9117] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

