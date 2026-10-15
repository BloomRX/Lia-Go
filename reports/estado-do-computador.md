# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 15/10/2026, 15:36:09
- **Sistema:** win32 x64 · **Node:** v26.8.1 · **npm:** 11.18.0
- **Python:** py 3.14 (sem binários prontos do banco) · python 3.14 (sem binários prontos do banco) · python3 3.14 (sem binários prontos do banco)
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 222 passaram, 0 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** 6c51107 fix: aplica tokens visuais V1 e tira as regras de exibicao do roteiro do JSX (testaveis) - 222 testes

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
✔ quem perdeu acesso à viagem não recebe mudanças (265.4231ms)
✔ resposta gigante é paginada: temMais avisa o app para continuar buscando (904.1442ms)
✔ cursor inválido é recusado com mensagem clara, não com erro interno (92.2426ms)
✔ o delta devolve a despesa no mesmo formato da listagem (fonte única do dado) (97.6521ms)
✔ viagem criada por outra pessoa aparece na lista; viagem alheia não (282.6964ms)
✔ quem cria a viagem vira organizador e a viagem nasce como rascunho (539.4083ms)
✔ acesso cruzado entre viagens é negado sem revelar a existência (241.6597ms)
✔ participante registra e propõe, mas não administra nem cancela (206.266ms)
✔ convite exige o e-mail convidado e libera acesso depois de aceito (286.7375ms)
✔ convite pendente não dá acesso antes do aceite (183.7746ms)
✔ a data nunca muda o estado: só sugere, e a confirmação é registrada (96.4001ms)
✔ conflito de versão é recusado em vez de sobrescrever (94.5087ms)
✔ rascunho → pendente exige motivo e cancelamento é assistido (102.3221ms)
✔ participante sai e perde acesso, mas o histórico fica (179.644ms)
✔ organizador único: a viagem tem exatamente um organizador ativo (180.8437ms)
✔ o organizador não pode se remover: precisa usar a ação de sair (126.3663ms)
ℹ tests 49
ℹ suites 0
ℹ pass 49
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 14177.737
```

### Log do banco de dados (fim)

```
2026-10-15 17:37:31.466 GMT [15056] LOG:  shutting down
2026-10-15 17:37:31.467 GMT [15056] LOG:  checkpoint starting: shutdown immediate
2026-10-15 17:37:31.505 GMT [15056] LOG:  checkpoint complete: wrote 11 buffers (0.1%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.008 s, sync=0.005 s, total=0.040 s; sync files=11, longest=0.001 s, average=0.001 s; distance=19 kB, estimate=843 kB; lsn=0/1BB8C80, redo lsn=0/1BB8C80
2026-10-15 17:37:31.517 GMT [14164] LOG:  database system is shut down
2026-10-15 18:35:39.119 GMT [16408] LOG:  starting PostgreSQL 16.2 on x86_64-pc-mingw64, compiled by gcc.exe (x86_64-posix-seh-rev2, Built by MinGW-W64 project) 12.2.0, 64-bit
2026-10-15 18:35:39.120 GMT [16408] LOG:  listening on IPv4 address "127.0.0.1", port 55432
2026-10-15 18:35:39.161 GMT [15124] LOG:  database system was shut down at 2026-10-15 17:37:31 GMT
2026-10-15 18:35:39.190 GMT [16408] LOG:  database system is ready to accept connections
2026-10-15 18:35:55.352 GMT [228] ERROR:  duplicate key value violates unique constraint "usuarios_email_normalizado_key"
2026-10-15 18:35:55.352 GMT [228] DETAIL:  Key (email_normalizado)=(pessoa1.teste@exemplo.com) already exists.
2026-10-15 18:35:55.352 GMT [228] STATEMENT:  INSERT INTO usuarios (id, nome, email, email_normalizado, senha_hash, senha_salt, senha_algoritmo)
	         VALUES ($1, $2, $3, $4, $5, $6, $7)
2026-10-15 18:36:08.356 GMT [17116] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-15 18:36:08.356 GMT [17116] DETAIL:  Key (viagem_id)=(62012fab-104e-4bf8-b50e-ad0f6b69cc12) already exists.
2026-10-15 18:36:08.356 GMT [17116] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

