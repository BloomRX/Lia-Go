# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 13/10/2026, 02:14:50
- **Sistema:** linux x64 · **Node:** v22.22.3 · **npm:** 10.9.8
- **Python:** python3 3.11 · python 3.11
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 178 passaram, 0 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** 95f8b38 fix: atualizacao automatica robusta (rebase com commits locais, stash de arquivos alterados, reinicio da rodada, recuperacao de HEAD solto e limpeza de conflito de sincronizacao)

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
duration_ms: 212.308022
  type: 'test'
  ...
# Subtest: organizador único: a viagem tem exatamente um organizador ativo
ok 38 - organizador único: a viagem tem exatamente um organizador ativo
  ---
  duration_ms: 201.939574
  type: 'test'
  ...
# Subtest: o organizador não pode se remover: precisa usar a ação de sair
ok 39 - o organizador não pode se remover: precisa usar a ação de sair
  ---
  duration_ms: 103.617246
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
# duration_ms 11790.650547
```

### Log do banco de dados (fim)

```
2026-10-13 02:14:08.434 UTC [16714] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-13 02:14:08.434 UTC [16714] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-13 02:14:08.434 UTC [16714] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-13 02:14:19.591 UTC [16756] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-13 02:14:19.591 UTC [16756] DETAIL:  Key (viagem_id)=(33c25029-d1f8-4716-915c-b75a0b3e706d) already exists.
2026-10-13 02:14:19.591 UTC [16756] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
2026-10-13 02:14:27.172 UTC [11972] LOG:  checkpoint complete: wrote 995 buffers (6.1%); 1 WAL file(s) added, 0 removed, 0 recycled; write=103.349 s, sync=0.017 s, total=103.400 s; sync files=1640, longest=0.002 s, average=0.001 s; distance=7800 kB, estimate=7800 kB; lsn=0/1E2B708, redo lsn=0/1C1E6B8
2026-10-13 02:14:39.606 UTC [17577] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-13 02:14:39.606 UTC [17577] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-13 02:14:39.606 UTC [17577] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-13 02:14:50.621 UTC [17732] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-13 02:14:50.621 UTC [17732] DETAIL:  Key (viagem_id)=(e984e56d-4ae6-401e-9db1-618fb8367c1e) already exists.
2026-10-13 02:14:50.621 UTC [17732] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

