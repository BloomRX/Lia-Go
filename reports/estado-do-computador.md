# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 15/10/2026, 14:21:07
- **Sistema:** win32 x64 · **Node:** v26.8.1 · **npm:** 11.18.0
- **Python:** py 3.14 (sem binários prontos do banco) · python 3.14 (sem binários prontos do banco) · python3 3.14 (sem binários prontos do banco)
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 183 passaram, 0 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** e804d22 chore: rodada automatica do LiaGo.bat (2026-10-15 14:12)

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
✔ quem perdeu acesso à viagem não recebe mudanças (264.6975ms)
✔ resposta gigante é paginada: temMais avisa o app para continuar buscando (938.8703ms)
✔ cursor inválido é recusado com mensagem clara, não com erro interno (91.933ms)
✔ o delta devolve a despesa no mesmo formato da listagem (fonte única do dado) (95.5098ms)
✔ viagem criada por outra pessoa aparece na lista; viagem alheia não (262.0385ms)
✔ quem cria a viagem vira organizador e a viagem nasce como rascunho (385.7758ms)
✔ acesso cruzado entre viagens é negado sem revelar a existência (178.1397ms)
✔ participante registra e propõe, mas não administra nem cancela (189.0378ms)
✔ convite exige o e-mail convidado e libera acesso depois de aceito (263.0294ms)
✔ convite pendente não dá acesso antes do aceite (177.5824ms)
✔ a data nunca muda o estado: só sugere, e a confirmação é registrada (94.5743ms)
✔ conflito de versão é recusado em vez de sobrescrever (91.2365ms)
✔ rascunho → pendente exige motivo e cancelamento é assistido (98.6799ms)
✔ participante sai e perde acesso, mas o histórico fica (177.1341ms)
✔ organizador único: a viagem tem exatamente um organizador ativo (178.1437ms)
✔ o organizador não pode se remover: precisa usar a ação de sair (124.7473ms)
ℹ tests 39
ℹ suites 0
ℹ pass 39
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 15859.7022
```

### Log do banco de dados (fim)

```
2026-10-15 17:20:33.366 GMT [7652] LOG:  syncing data directory (fsync), elapsed time: 32.71 s, current path: .
2026-10-15 17:20:33.368 GMT [7652] LOG:  database system was not properly shut down; automatic recovery in progress
2026-10-15 17:20:33.375 GMT [7652] LOG:  redo starts at 0/1A86F68
2026-10-15 17:20:33.375 GMT [7652] LOG:  invalid record length at 0/1A87050: expected at least 24, got 0
2026-10-15 17:20:33.375 GMT [7652] LOG:  redo done at 0/1A87018 system usage: CPU: user: 0.00 s, system: 0.00 s, elapsed: 0.00 s
2026-10-15 17:20:33.384 GMT [15056] LOG:  checkpoint starting: end-of-recovery immediate wait
2026-10-15 17:20:33.394 GMT [15056] LOG:  checkpoint complete: wrote 3 buffers (0.0%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.003 s, sync=0.002 s, total=0.012 s; sync files=2, longest=0.001 s, average=0.001 s; distance=0 kB, estimate=0 kB; lsn=0/1A87050, redo lsn=0/1A87050
2026-10-15 17:20:33.441 GMT [14164] LOG:  database system is ready to accept connections
2026-10-15 17:20:56.204 GMT [17724] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-15 17:20:56.204 GMT [17724] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-15 17:20:56.204 GMT [17724] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-15 17:21:06.080 GMT [17868] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-15 17:21:06.080 GMT [17868] DETAIL:  Key (viagem_id)=(43f445b5-cfd8-437c-9488-3624c43ee71d) already exists.
2026-10-15 17:21:06.080 GMT [17868] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

