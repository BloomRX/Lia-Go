# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 15/10/2026, 14:12:33
- **Sistema:** linux x64 · **Node:** v22.22.3 · **npm:** 10.9.8
- **Python:** python3 3.11 · python 3.11
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 183 passaram, 0 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** 6ccd305 chore: guarda o trabalho local antes de atualizar (LiaGo.bat)

## Avisos desta rodada

- A atualização foi adiada por conflito real no mesmo trecho de um arquivo. O trabalho local foi guardado em commit e a cópia ficou limpa.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
duration_ms: 153.373378
  type: 'test'
  ...
# Subtest: organizador único: a viagem tem exatamente um organizador ativo
ok 38 - organizador único: a viagem tem exatamente um organizador ativo
  ---
  duration_ms: 187.01814
  type: 'test'
  ...
# Subtest: o organizador não pode se remover: precisa usar a ação de sair
ok 39 - o organizador não pode se remover: precisa usar a ação de sair
  ---
  duration_ms: 82.552727
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
# duration_ms 9905.459551
```

### Log do banco de dados (fim)

```
2026-10-15 14:10:37.807 UTC [1970] LOG:  database system is ready to accept connections
2026-10-15 14:10:56.144 UTC [2304] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-15 14:10:56.144 UTC [2304] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-15 14:10:56.144 UTC [2304] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-15 14:11:05.511 UTC [2345] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-15 14:11:05.511 UTC [2345] DETAIL:  Key (viagem_id)=(88d4baa5-2098-4580-8918-5ea98b198532) already exists.
2026-10-15 14:11:05.511 UTC [2345] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
2026-10-15 14:12:23.941 UTC [3050] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-15 14:12:23.941 UTC [3050] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-15 14:12:23.941 UTC [3050] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-15 14:12:33.218 UTC [3184] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-15 14:12:33.218 UTC [3184] DETAIL:  Key (viagem_id)=(27c14ef8-a8d2-490a-95d0-e2ea80bce7fc) already exists.
2026-10-15 14:12:33.218 UTC [3184] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

