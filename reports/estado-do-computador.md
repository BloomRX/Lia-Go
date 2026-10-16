# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 15/10/2026, 22:33:14
- **Sistema:** win32 x64 · **Node:** v26.8.1 · **npm:** 11.18.0
- **Python:** py 3.14 (sem binários prontos do banco) · python 3.14 (sem binários prontos do banco) · python3 3.14 (sem binários prontos do banco)
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 434 passaram, 0 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** fdc49fd fix(sync): a fila não perde mais a operação criada durante uma passada

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
✔ quem perdeu acesso à viagem não recebe mudanças (276.2364ms)
✔ resposta gigante é paginada: temMais avisa o app para continuar buscando (961.4447ms)
✔ cursor inválido é recusado com mensagem clara, não com erro interno (91.5464ms)
✔ o delta devolve a despesa no mesmo formato da listagem (fonte única do dado) (98.2386ms)
✔ viagem criada por outra pessoa aparece na lista; viagem alheia não (269.9936ms)
✔ quem cria a viagem vira organizador e a viagem nasce como rascunho (499.7122ms)
✔ acesso cruzado entre viagens é negado sem revelar a existência (188.6045ms)
✔ participante registra e propõe, mas não administra nem cancela (200.1243ms)
✔ convite exige o e-mail convidado e libera acesso depois de aceito (283.1104ms)
✔ convite pendente não dá acesso antes do aceite (198.2558ms)
✔ a data nunca muda o estado: só sugere, e a confirmação é registrada (105.1785ms)
✔ conflito de versão é recusado em vez de sobrescrever (94.1533ms)
✔ rascunho → pendente exige motivo e cancelamento é assistido (117.6217ms)
✔ participante sai e perde acesso, mas o histórico fica (189.3867ms)
✔ organizador único: a viagem tem exatamente um organizador ativo (187.6516ms)
✔ o organizador não pode se remover: precisa usar a ação de sair (129.52ms)
ℹ tests 92
ℹ suites 0
ℹ pass 92
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 29668.8054
```

### Log do banco de dados (fim)

```
2026-10-16 01:32:48.848 GMT [11720] ERROR:  new row for relation "itens_checklist" violates check constraint "itens_checklist_motivo_reabertura_check"
2026-10-16 01:32:48.848 GMT [11720] DETAIL:  Failing row contains (f7eac8c2-7f01-44fd-9f08-3f1a744cf587, 2fd018f2-c9ed-4365-9fc0-2d9d3e119833, 56d967a5-dab4-4d3a-bd95-95cb030a6176, Levar o passaporte, outro, null, null, aberto, null, null, null, curt, 1, 2026-10-16 01:32:48.818956+00, 2026-10-16 01:32:48.818956+00).
2026-10-16 01:32:48.848 GMT [11720] STATEMENT:  UPDATE itens_checklist SET motivo_reabertura = 'curt' WHERE id = $1
2026-10-16 01:32:59.602 GMT [3248] ERROR:  new row for relation "limites_orcamento" violates check constraint "escopo_coerente"
2026-10-16 01:32:59.602 GMT [3248] DETAIL:  Failing row contains (6d775e9c-9b0b-40db-8ed1-d41d07b72f61, d2cafa9e-1113-45c2-bad2-6b5de2c07c85, coletivo, 83a7b9e7-5830-4acf-8e2f-01c64931ee0d, 100000, 83a7b9e7-5830-4acf-8e2f-01c64931ee0d, 2026-10-16 01:32:59.600176+00, 1).
2026-10-16 01:32:59.602 GMT [3248] STATEMENT:  UPDATE limites_orcamento SET usuario_id = $1 WHERE viagem_id = $2 AND escopo = 'coletivo'
2026-10-16 01:32:59.626 GMT [16536] ERROR:  new row for relation "limites_orcamento" violates check constraint "escopo_coerente"
2026-10-16 01:32:59.626 GMT [16536] DETAIL:  Failing row contains (50ce0b6f-9632-406a-9ae2-26c8fdb173a2, d2cafa9e-1113-45c2-bad2-6b5de2c07c85, individual, null, 100, 83a7b9e7-5830-4acf-8e2f-01c64931ee0d, 2026-10-16 01:32:59.625032+00, 1).
2026-10-16 01:32:59.626 GMT [16536] STATEMENT:  INSERT INTO limites_orcamento (id, viagem_id, escopo, usuario_id, centavos, atualizado_por) VALUES (gen_random_uuid(), $1, 'individual', NULL, 100, $2)
2026-10-16 01:33:02.536 GMT [2268] ERROR:  new row for relation "reservas" violates check constraint "cancelamento_coerente"
2026-10-16 01:33:02.536 GMT [2268] DETAIL:  Failing row contains (2c90928e-35e3-432f-a865-564117e8fe4a, a11b6341-1732-486d-9cdc-7a88e434a878, d9d44f28-1642-4901-84c6-c54c259793b1, hospedagem, Pousada da Serra, null, null, null, 90000, f, Pago no balcão, d9d44f28-1642-4901-84c6-c54c259793b1, 2026-10-16 01:33:02.529214+00, cancelada, null, 3, 2026-10-16 01:33:02.526564+00, 2026-10-16 01:33:02.534921+00).
2026-10-16 01:33:02.536 GMT [2268] STATEMENT:  UPDATE reservas SET estado = 'cancelada', motivo_cancelamento = NULL WHERE id = $1
2026-10-16 01:33:13.429 GMT [8820] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-16 01:33:13.429 GMT [8820] DETAIL:  Key (viagem_id)=(cfabf932-5952-4996-92fc-b0d45ee0749f) already exists.
2026-10-16 01:33:13.429 GMT [8820] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

