# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 15/10/2026, 17:52:46
- **Sistema:** win32 x64 · **Node:** v26.8.1 · **npm:** 11.18.0
- **Python:** py 3.14 (sem binários prontos do banco) · python 3.14 (sem binários prontos do banco) · python3 3.14 (sem binários prontos do banco)
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 242 passaram, 8 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** 7e756a6 docs: décima rodada — orçamento, checklist, documentos, fechamento e referências aplicadas

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
✖ J:\Lia-Go\apps\mobile\.ui-testes\orcamento.test.mjs (57.298ms)
  'test failed'

test at apps\mobile\.ui-testes\reservas.test.mjs:1:1
✖ J:\Lia-Go\apps\mobile\.ui-testes\reservas.test.mjs (57.3098ms)
  'test failed'

test at apps\mobile\.ui-testes\viagens.test.mjs:1:1
✖ J:\Lia-Go\apps\mobile\.ui-testes\viagens.test.mjs (60.0335ms)
  'test failed'
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
2026-10-15 18:38:16.495 GMT [12292] ERROR:  canceling statement due to user request
2026-10-15 18:38:16.495 GMT [16408] LOG:  received fast shutdown request
2026-10-15 18:38:16.496 GMT [16408] LOG:  aborting any active transactions
2026-10-15 18:38:16.498 GMT [2432] FATAL:  terminating connection due to administrator command
2026-10-15 18:38:16.498 GMT [16708] FATAL:  terminating connection due to administrator command
2026-10-15 18:38:16.500 GMT [16708] LOG:  could not send data to client: unrecognized winsock error 10054
2026-10-15 18:38:16.500 GMT [16408] LOG:  background worker "logical replication launcher" (PID 12292) exited with exit code 1
2026-10-15 18:38:16.507 GMT [18116] LOG:  shutting down
2026-10-15 18:38:16.508 GMT [18116] LOG:  checkpoint starting: shutdown immediate
2026-10-15 18:38:16.693 GMT [18116] LOG:  checkpoint complete: wrote 137 buffers (0.8%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.039 s, sync=0.088 s, total=0.187 s; sync files=427, longest=0.002 s, average=0.001 s; distance=1592 kB, estimate=1592 kB; lsn=0/1D46E10, redo lsn=0/1D46E10
2026-10-15 18:38:16.777 GMT [16408] LOG:  database system is shut down
2026-10-15 20:52:27.385 GMT [15160] LOG:  starting PostgreSQL 16.2 on x86_64-pc-mingw64, compiled by gcc.exe (x86_64-posix-seh-rev2, Built by MinGW-W64 project) 12.2.0, 64-bit
2026-10-15 20:52:27.386 GMT [15160] LOG:  listening on IPv4 address "127.0.0.1", port 55432
2026-10-15 20:52:27.421 GMT [14200] LOG:  database system was shut down at 2026-10-15 18:38:16 GMT
2026-10-15 20:52:27.505 GMT [15160] LOG:  database system is ready to accept connections
```

