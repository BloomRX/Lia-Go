# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 15/10/2026, 18:18:55
- **Sistema:** win32 x64 · **Node:** v26.8.1 · **npm:** 11.18.0
- **Python:** py 3.14 (sem binários prontos do banco) · python 3.14 (sem binários prontos do banco) · python3 3.14 (sem binários prontos do banco)
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 361 passaram, 0 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** b98ec95 fix(ui): empacotar o código do projeto no bundle de teste

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
✔ quem perdeu acesso à viagem não recebe mudanças (301.6759ms)
✔ resposta gigante é paginada: temMais avisa o app para continuar buscando (998.8687ms)
✔ cursor inválido é recusado com mensagem clara, não com erro interno (96.025ms)
✔ o delta devolve a despesa no mesmo formato da listagem (fonte única do dado) (96.1238ms)
✔ viagem criada por outra pessoa aparece na lista; viagem alheia não (285.5501ms)
✔ quem cria a viagem vira organizador e a viagem nasce como rascunho (529.0785ms)
✔ acesso cruzado entre viagens é negado sem revelar a existência (203.3378ms)
✔ participante registra e propõe, mas não administra nem cancela (206.6997ms)
✔ convite exige o e-mail convidado e libera acesso depois de aceito (285.4031ms)
✔ convite pendente não dá acesso antes do aceite (194.806ms)
✔ a data nunca muda o estado: só sugere, e a confirmação é registrada (106.1682ms)
✔ conflito de versão é recusado em vez de sobrescrever (99.8304ms)
✔ rascunho → pendente exige motivo e cancelamento é assistido (110.2475ms)
✔ participante sai e perde acesso, mas o histórico fica (228.8732ms)
✔ organizador único: a viagem tem exatamente um organizador ativo (181.5956ms)
✔ o organizador não pode se remover: precisa usar a ação de sair (125.8256ms)
ℹ tests 86
ℹ suites 0
ℹ pass 86
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 26975.8915
```

### Log do banco de dados (fim)

```
2026-10-15 21:18:31.367 GMT [16968] ERROR:  new row for relation "itens_checklist" violates check constraint "itens_checklist_motivo_reabertura_check"
2026-10-15 21:18:31.367 GMT [16968] DETAIL:  Failing row contains (e099ea96-353f-44c2-865d-2da4987cc547, c144fb3c-805e-4fcb-8ca0-2b2f1144ac10, c4ffa97c-005d-46a7-90c1-1e6055ec4c80, Levar o passaporte, outro, null, null, aberto, null, null, null, curt, 1, 2026-10-15 21:18:31.33555+00, 2026-10-15 21:18:31.33555+00).
2026-10-15 21:18:31.367 GMT [16968] STATEMENT:  UPDATE itens_checklist SET motivo_reabertura = 'curt' WHERE id = $1
2026-10-15 21:18:40.845 GMT [16400] ERROR:  new row for relation "limites_orcamento" violates check constraint "escopo_coerente"
2026-10-15 21:18:40.845 GMT [16400] DETAIL:  Failing row contains (8a4c807c-c157-4f9d-8c68-80d00755237b, 7aa500ba-2078-4676-94c1-ccecb3fa418a, coletivo, b2eb124e-f80b-40e8-819f-55d04576cf6d, 100000, b2eb124e-f80b-40e8-819f-55d04576cf6d, 2026-10-15 21:18:40.843208+00, 1).
2026-10-15 21:18:40.845 GMT [16400] STATEMENT:  UPDATE limites_orcamento SET usuario_id = $1 WHERE viagem_id = $2 AND escopo = 'coletivo'
2026-10-15 21:18:40.867 GMT [15928] ERROR:  new row for relation "limites_orcamento" violates check constraint "escopo_coerente"
2026-10-15 21:18:40.867 GMT [15928] DETAIL:  Failing row contains (c4b67a4f-07bb-4b06-81aa-dfb5c7cbe641, 7aa500ba-2078-4676-94c1-ccecb3fa418a, individual, null, 100, b2eb124e-f80b-40e8-819f-55d04576cf6d, 2026-10-15 21:18:40.865889+00, 1).
2026-10-15 21:18:40.867 GMT [15928] STATEMENT:  INSERT INTO limites_orcamento (id, viagem_id, escopo, usuario_id, centavos, atualizado_por) VALUES (gen_random_uuid(), $1, 'individual', NULL, 100, $2)
2026-10-15 21:18:43.630 GMT [18876] ERROR:  new row for relation "reservas" violates check constraint "cancelamento_coerente"
2026-10-15 21:18:43.630 GMT [18876] DETAIL:  Failing row contains (dd89f9bd-adb7-4ac4-b835-00a203dbe9ba, 8ff84833-f11c-4e23-833b-ab4a75ad2d30, 7405871b-b46b-4e8f-9eb5-5c0aac5cdb3c, hospedagem, Pousada da Serra, null, null, null, 90000, f, Pago no balcão, 7405871b-b46b-4e8f-9eb5-5c0aac5cdb3c, 2026-10-15 21:18:43.6201+00, cancelada, null, 3, 2026-10-15 21:18:43.616674+00, 2026-10-15 21:18:43.626876+00).
2026-10-15 21:18:43.630 GMT [18876] STATEMENT:  UPDATE reservas SET estado = 'cancelada', motivo_cancelamento = NULL WHERE id = $1
2026-10-15 21:18:53.441 GMT [13948] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-15 21:18:53.441 GMT [13948] DETAIL:  Key (viagem_id)=(c293affd-4c42-4a67-ba7d-73c574ab22e7) already exists.
2026-10-15 21:18:53.441 GMT [13948] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

