# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 15/10/2026, 09:58:33
- **Sistema:** win32 x64 · **Node:** v26.8.1 · **npm:** 11.18.0
- **Python:** py 3.14 (sem binários prontos do banco) · python 3.14 (sem binários prontos do banco) · python3 3.14 (sem binários prontos do banco)
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** nenhum teste rodou (ver avisos)
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** 278a1af chore: rodada automatica do LiaGo.bat (2026-10-13 04:01)

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
✔ quem perdeu acesso à viagem não recebe mudanças (285.2125ms)
✔ resposta gigante é paginada: temMais avisa o app para continuar buscando (961.1557ms)
✔ cursor inválido é recusado com mensagem clara, não com erro interno (91.3903ms)
✔ o delta devolve a despesa no mesmo formato da listagem (fonte única do dado) (98.8366ms)
✔ viagem criada por outra pessoa aparece na lista; viagem alheia não (271.5561ms)
✔ quem cria a viagem vira organizador e a viagem nasce como rascunho (421.8037ms)
✔ acesso cruzado entre viagens é negado sem revelar a existência (188.3225ms)
✔ participante registra e propõe, mas não administra nem cancela (195.104ms)
✔ convite exige o e-mail convidado e libera acesso depois de aceito (275.7835ms)
✔ convite pendente não dá acesso antes do aceite (184.7442ms)
✔ a data nunca muda o estado: só sugere, e a confirmação é registrada (100.3874ms)
✔ conflito de versão é recusado em vez de sobrescrever (95.1676ms)
✔ rascunho → pendente exige motivo e cancelamento é assistido (105.9861ms)
✔ participante sai e perde acesso, mas o histórico fica (184.4835ms)
✔ organizador único: a viagem tem exatamente um organizador ativo (182.7851ms)
✔ o organizador não pode se remover: precisa usar a ação de sair (136.5197ms)
ℹ tests 39
ℹ suites 0
ℹ pass 39
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 16974.0634
```

### Log do banco de dados (fim)

```
2026-10-15 12:57:57.728 GMT [14868] LOG:  syncing data directory (fsync), elapsed time: 32.31 s, current path: .
2026-10-15 12:57:57.731 GMT [14868] LOG:  database system was not properly shut down; automatic recovery in progress
2026-10-15 12:57:57.735 GMT [14868] LOG:  redo starts at 0/18B3168
2026-10-15 12:57:57.735 GMT [14868] LOG:  invalid record length at 0/18B31A0: expected at least 24, got 0
2026-10-15 12:57:57.735 GMT [14868] LOG:  redo done at 0/18B3168 system usage: CPU: user: 0.00 s, system: 0.00 s, elapsed: 0.00 s
2026-10-15 12:57:57.744 GMT [364] LOG:  checkpoint starting: end-of-recovery immediate wait
2026-10-15 12:57:57.774 GMT [364] LOG:  checkpoint complete: wrote 3 buffers (0.0%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.003 s, sync=0.002 s, total=0.031 s; sync files=2, longest=0.001 s, average=0.001 s; distance=0 kB, estimate=0 kB; lsn=0/18B31A0, redo lsn=0/18B31A0
2026-10-15 12:57:57.820 GMT [4844] LOG:  database system is ready to accept connections
2026-10-15 12:58:21.998 GMT [11704] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-15 12:58:21.998 GMT [11704] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-15 12:58:21.998 GMT [11704] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-15 12:58:32.862 GMT [496] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-15 12:58:32.862 GMT [496] DETAIL:  Key (viagem_id)=(16c9fb08-c9e9-4732-9e88-9ee6f8a1f6f6) already exists.
2026-10-15 12:58:32.862 GMT [496] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

