# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 16/10/2026, 11:07:44
- **Sistema:** win32 x64 · **Node:** v26.8.1 · **npm:** 11.18.0
- **Python:** py 3.14 (sem binários prontos do banco) · python 3.14 (sem binários prontos do banco) · python3 3.14 (sem binários prontos do banco)
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 391 passaram, 9 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** 383f79f feat(ui): identidade visual das referências oficiais

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
✔ quem perdeu acesso à viagem não recebe mudanças (256.4552ms)
✔ resposta gigante é paginada: temMais avisa o app para continuar buscando (800.6627ms)
✔ cursor inválido é recusado com mensagem clara, não com erro interno (84.7703ms)
✔ o delta devolve a despesa no mesmo formato da listagem (fonte única do dado) (90.4161ms)
✔ viagem criada por outra pessoa aparece na lista; viagem alheia não (254.779ms)
✔ quem cria a viagem vira organizador e a viagem nasce como rascunho (446.2065ms)
✔ acesso cruzado entre viagens é negado sem revelar a existência (177.8127ms)
✔ participante registra e propõe, mas não administra nem cancela (183.0516ms)
✔ convite exige o e-mail convidado e libera acesso depois de aceito (258.7386ms)
✔ convite pendente não dá acesso antes do aceite (171.2642ms)
✔ a data nunca muda o estado: só sugere, e a confirmação é registrada (92.2094ms)
✔ conflito de versão é recusado em vez de sobrescrever (88.0492ms)
✔ rascunho → pendente exige motivo e cancelamento é assistido (94.2789ms)
✔ participante sai e perde acesso, mas o histórico fica (173.3635ms)
✔ organizador único: a viagem tem exatamente um organizador ativo (172.7605ms)
✔ o organizador não pode se remover: precisa usar a ação de sair (114.5935ms)
ℹ tests 92
ℹ suites 0
ℹ pass 92
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 30623.3025
```

### Log do banco de dados (fim)

```
2026-10-16 14:07:22.410 GMT [82220] ERROR:  new row for relation "itens_checklist" violates check constraint "itens_checklist_motivo_reabertura_check"
2026-10-16 14:07:22.410 GMT [82220] DETAIL:  Failing row contains (4c7f7296-e891-48f9-95b8-0a056aef1c92, fa849d7d-2be2-40aa-b0d5-25cdb186061f, dc609e8c-790d-45c5-bb76-d5eeedae064c, Levar o passaporte, outro, null, null, aberto, null, null, null, curt, 1, 2026-10-16 14:07:22.384794+00, 2026-10-16 14:07:22.384794+00).
2026-10-16 14:07:22.410 GMT [82220] STATEMENT:  UPDATE itens_checklist SET motivo_reabertura = 'curt' WHERE id = $1
2026-10-16 14:07:31.290 GMT [81232] ERROR:  new row for relation "limites_orcamento" violates check constraint "escopo_coerente"
2026-10-16 14:07:31.290 GMT [81232] DETAIL:  Failing row contains (a2d82dfc-b9e8-42ce-80b5-773358a2404e, 7bb5ff69-863c-49c9-afc6-d740d359846e, coletivo, 0a8818c9-44ba-4591-8ed3-abc136b85668, 100000, 0a8818c9-44ba-4591-8ed3-abc136b85668, 2026-10-16 14:07:31.288545+00, 1).
2026-10-16 14:07:31.290 GMT [81232] STATEMENT:  UPDATE limites_orcamento SET usuario_id = $1 WHERE viagem_id = $2 AND escopo = 'coletivo'
2026-10-16 14:07:31.308 GMT [81948] ERROR:  new row for relation "limites_orcamento" violates check constraint "escopo_coerente"
2026-10-16 14:07:31.308 GMT [81948] DETAIL:  Failing row contains (3158f3c5-0f4a-439f-a8d5-075ee42cdbbb, 7bb5ff69-863c-49c9-afc6-d740d359846e, individual, null, 100, 0a8818c9-44ba-4591-8ed3-abc136b85668, 2026-10-16 14:07:31.307244+00, 1).
2026-10-16 14:07:31.308 GMT [81948] STATEMENT:  INSERT INTO limites_orcamento (id, viagem_id, escopo, usuario_id, centavos, atualizado_por) VALUES (gen_random_uuid(), $1, 'individual', NULL, 100, $2)
2026-10-16 14:07:33.861 GMT [82128] ERROR:  new row for relation "reservas" violates check constraint "cancelamento_coerente"
2026-10-16 14:07:33.861 GMT [82128] DETAIL:  Failing row contains (c69a7f26-92d0-42ad-a122-dc602ae75241, 5bd1cc70-7851-4396-a507-8901fef94881, f0dc69e7-17ca-4185-907e-daf477480290, hospedagem, Pousada da Serra, null, null, null, 90000, f, Pago no balcão, f0dc69e7-17ca-4185-907e-daf477480290, 2026-10-16 14:07:33.855913+00, cancelada, null, 3, 2026-10-16 14:07:33.854159+00, 2026-10-16 14:07:33.859363+00).
2026-10-16 14:07:33.861 GMT [82128] STATEMENT:  UPDATE reservas SET estado = 'cancelada', motivo_cancelamento = NULL WHERE id = $1
2026-10-16 14:07:43.475 GMT [16764] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-16 14:07:43.475 GMT [16764] DETAIL:  Key (viagem_id)=(a946467d-c371-4ef8-9651-8bd46a9f9a12) already exists.
2026-10-16 14:07:43.475 GMT [16764] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

