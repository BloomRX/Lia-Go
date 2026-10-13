# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 13/10/2026, 02:15:35
- **Sistema:** linux x64 · **Node:** v22.22.3 · **npm:** 10.9.8
- **Python:** python3 3.11 · python 3.11
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 178 passaram, 0 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** 7eb5fd4 chore: rodada automatica do LiaGo.bat (2026-10-13 02:14)

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
duration_ms: 187.421502
  type: 'test'
  ...
# Subtest: organizador único: a viagem tem exatamente um organizador ativo
ok 38 - organizador único: a viagem tem exatamente um organizador ativo
  ---
  duration_ms: 215.189834
  type: 'test'
  ...
# Subtest: o organizador não pode se remover: precisa usar a ação de sair
ok 39 - o organizador não pode se remover: precisa usar a ação de sair
  ---
  duration_ms: 110.924108
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
# duration_ms 10791.19553
```

### Log do banco de dados (fim)

```
2026-10-13 02:14:27.172 UTC [11972] LOG:  checkpoint complete: wrote 995 buffers (6.1%); 1 WAL file(s) added, 0 removed, 0 recycled; write=103.349 s, sync=0.017 s, total=103.400 s; sync files=1640, longest=0.002 s, average=0.001 s; distance=7800 kB, estimate=7800 kB; lsn=0/1E2B708, redo lsn=0/1C1E6B8
2026-10-13 02:14:39.606 UTC [17577] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-13 02:14:39.606 UTC [17577] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-13 02:14:39.606 UTC [17577] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-13 02:14:50.621 UTC [17732] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-13 02:14:50.621 UTC [17732] DETAIL:  Key (viagem_id)=(e984e56d-4ae6-401e-9db1-618fb8367c1e) already exists.
2026-10-13 02:14:50.621 UTC [17732] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
2026-10-13 02:15:25.240 UTC [18667] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-13 02:15:25.240 UTC [18667] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-13 02:15:25.240 UTC [18667] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-13 02:15:35.354 UTC [18813] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-13 02:15:35.354 UTC [18813] DETAIL:  Key (viagem_id)=(8c49823d-e15d-401e-b67f-9d5e4a5a2dd9) already exists.
2026-10-13 02:15:35.354 UTC [18813] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

