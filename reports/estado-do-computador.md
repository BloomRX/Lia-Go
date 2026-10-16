# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 15/10/2026, 21:46:40
- **Sistema:** win32 x64 · **Node:** v26.8.1 · **npm:** 11.18.0
- **Python:** py 3.14 (sem binários prontos do banco) · python 3.14 (sem binários prontos do banco) · python3 3.14 (sem binários prontos do banco)
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 335 passaram, 2 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** dae2947 feat(roteiro): reserva vinculada, observações da atividade e evidência na ficha

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
diff: 'simple'
  }

test at apps\mobile\.ui-testes\viagens.test.mjs:8955:1
✖ criar viagem já abre a viagem criada (rascunho precisa dos próximos passos) (8022.4029ms)
  Error: Tempo esgotado esperando a viagem criada abrir. Tela atual: Conectado como AnaSairTudo sincronizadoLia GoA viagem ficou guardada neste aparelho. Ela abre assim que o servidor confirmar — o estado aparece na barra de sincronização acima.NotificaçõesNada pendente por aquiSuas viagensCriar viagemRecebeu um convite? Cole o link/tokenAceitar conviteAceitar convit
      at esperarPor (file:///J:/Lia-Go/apps/mobile/.ui-testes/viagens.test.mjs:72:8)
      at async TestContext.<anonymous> (file:///J:/Lia-Go/apps/mobile/.ui-testes/viagens.test.mjs:8967:2)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7)
npm error Lifecycle script `test:ui` failed with error:
npm error code 1
npm error path J:\Lia-Go\apps\mobile
npm error workspace @lia-go/mobile@0.1.0
npm error location J:\Lia-Go\apps\mobile
npm error command failed
npm error command C:\WINDOWS\system32\cmd.exe /d /s /c node ../../tools/teste-ui.mjs
npm error Lifecycle script `test` failed with error:
npm error code 1
npm error path J:\Lia-Go\apps\mobile
npm error workspace @lia-go/mobile@0.1.0
npm error location J:\Lia-Go\apps\mobile
npm error command failed
npm error command C:\WINDOWS\system32\cmd.exe /d /s /c node --test "tests/*.test.ts" && npm run test:ui
```

### Log do banco de dados (fim)

```
2026-10-15 21:18:53.441 GMT [13948] DETAIL:  Key (viagem_id)=(c293affd-4c42-4a67-ba7d-73c574ab22e7) already exists.
2026-10-15 21:18:53.441 GMT [13948] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
2026-10-15 21:20:31.959 GMT [15172] ERROR:  canceling statement due to user request
2026-10-15 21:20:31.959 GMT [14844] LOG:  received fast shutdown request
2026-10-15 21:20:31.961 GMT [14844] LOG:  aborting any active transactions
2026-10-15 21:20:31.961 GMT [19432] FATAL:  terminating connection due to administrator command
2026-10-15 21:20:31.965 GMT [14844] LOG:  background worker "logical replication launcher" (PID 15172) exited with exit code 1
2026-10-15 21:20:31.969 GMT [8632] LOG:  shutting down
2026-10-15 21:20:31.970 GMT [8632] LOG:  checkpoint starting: shutdown immediate
2026-10-15 21:20:32.330 GMT [8632] LOG:  checkpoint complete: wrote 131 buffers (0.8%); 0 WAL file(s) added, 0 removed, 1 recycled; write=0.027 s, sync=0.178 s, total=0.361 s; sync files=1042, longest=0.001 s, average=0.001 s; distance=2228 kB, estimate=2228 kB; lsn=0/20284C0, redo lsn=0/20284C0
2026-10-15 21:20:32.427 GMT [14844] LOG:  database system is shut down
2026-10-16 00:45:32.760 GMT [2384] LOG:  starting PostgreSQL 16.2 on x86_64-pc-mingw64, compiled by gcc.exe (x86_64-posix-seh-rev2, Built by MinGW-W64 project) 12.2.0, 64-bit
2026-10-16 00:45:32.761 GMT [2384] LOG:  listening on IPv4 address "127.0.0.1", port 55432
2026-10-16 00:45:32.827 GMT [360] LOG:  database system was shut down at 2026-10-15 21:20:32 GMT
2026-10-16 00:45:32.860 GMT [2384] LOG:  database system is ready to accept connections
```

