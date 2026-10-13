# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 13/10/2026, 01:39:45
- **Sistema:** linux x64 · **Node:** v22.22.3 · **npm:** 10.9.8
- **Python:** python3 3.11 · python 3.11
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 174 passaram, 0 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** fd1f988 feat: rodada de um clique no LiaGo.bat (duplo clique faz tudo) e PostgreSQL portatil baixado do PyPI, sem depender do Python da maquina

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
duration_ms: 203.168941
  type: 'test'
  ...
# Subtest: organizador único: a viagem tem exatamente um organizador ativo
ok 38 - organizador único: a viagem tem exatamente um organizador ativo
  ---
  duration_ms: 200.014506
  type: 'test'
  ...
# Subtest: o organizador não pode se remover: precisa usar a ação de sair
ok 39 - o organizador não pode se remover: precisa usar a ação de sair
  ---
  duration_ms: 89.938727
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
# duration_ms 10897.075162
```

### Log do banco de dados (fim)

```
2026-10-13 01:38:46.091 UTC [9929] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
2026-10-13 01:39:04.703 UTC [10317] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-13 01:39:04.703 UTC [10317] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-13 01:39:04.703 UTC [10317] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-13 01:39:15.113 UTC [10359] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-13 01:39:15.113 UTC [10359] DETAIL:  Key (viagem_id)=(67abcfb1-e8a6-4921-ac99-3594e910f06d) already exists.
2026-10-13 01:39:15.113 UTC [10359] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
2026-10-13 01:39:34.485 UTC [11191] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-13 01:39:34.485 UTC [11191] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-13 01:39:34.485 UTC [11191] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-13 01:39:44.755 UTC [11337] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-13 01:39:44.755 UTC [11337] DETAIL:  Key (viagem_id)=(3e4e8be5-75a6-4387-96c1-b000312673e6) already exists.
2026-10-13 01:39:44.755 UTC [11337] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

