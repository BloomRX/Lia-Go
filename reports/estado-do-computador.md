# Estado do computador (gerado automaticamente pelo LiaGo.bat)

- **Quando:** 16/10/2026, 17:24:05
- **Sistema:** win32 x64 · **Node:** v26.8.1 · **npm:** 11.18.0
- **Python:** py 3.14 (sem binários prontos do banco) · python 3.14 (sem binários prontos do banco) · python3 3.14 (sem binários prontos do banco)
- **Docker:** indisponível · **Banco de dados:** portátil em .pgbin (PostgreSQL do próprio projeto)
- **Dependências:** instaladas e conferidas
- **Testes:** 445 passaram, 0 falharam, 0 pulados
- **Branch:** arena/f1ac5ed6-lia-go · **Último commit local:** 3388191 fix(ferramentas): instalar dependência nova e conferir se o app abre

## Avisos desta rodada

- Nenhum: tudo correu como esperado.

## Detalhes técnicos (últimas linhas)

### Últimas linhas dos testes

```
✔ quem perdeu acesso à viagem não recebe mudanças (271.8584ms)
✔ resposta gigante é paginada: temMais avisa o app para continuar buscando (879.1747ms)
✔ cursor inválido é recusado com mensagem clara, não com erro interno (88.7212ms)
✔ o delta devolve a despesa no mesmo formato da listagem (fonte única do dado) (94.7894ms)
✔ viagem criada por outra pessoa aparece na lista; viagem alheia não (262.444ms)
✔ quem cria a viagem vira organizador e a viagem nasce como rascunho (461.9124ms)
✔ acesso cruzado entre viagens é negado sem revelar a existência (184.2372ms)
✔ participante registra e propõe, mas não administra nem cancela (192.016ms)
✔ convite exige o e-mail convidado e libera acesso depois de aceito (268.2515ms)
✔ convite pendente não dá acesso antes do aceite (176.4032ms)
✔ a data nunca muda o estado: só sugere, e a confirmação é registrada (96.654ms)
✔ conflito de versão é recusado em vez de sobrescrever (92.1325ms)
✔ rascunho → pendente exige motivo e cancelamento é assistido (96.4072ms)
✔ participante sai e perde acesso, mas o histórico fica (182.5581ms)
✔ organizador único: a viagem tem exatamente um organizador ativo (198.8435ms)
✔ o organizador não pode se remover: precisa usar a ação de sair (125.9218ms)
ℹ tests 92
ℹ suites 0
ℹ pass 92
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 27179.238
```

### Log do banco de dados (fim)

```
2026-10-16 20:23:50.912 GMT [81992] ERROR:  new row for relation "limites_orcamento" violates check constraint "escopo_coerente"
2026-10-16 20:23:50.912 GMT [81992] DETAIL:  Failing row contains (43562bd2-dc2c-416c-a3dc-3cd3334451d0, d54429d7-432d-43ee-969f-cc266562f858, individual, null, 100, 2fefcefb-d272-4340-91b4-e182bfc3cc3a, 2026-10-16 20:23:50.910743+00, 1).
2026-10-16 20:23:50.912 GMT [81992] STATEMENT:  INSERT INTO limites_orcamento (id, viagem_id, escopo, usuario_id, centavos, atualizado_por) VALUES (gen_random_uuid(), $1, 'individual', NULL, 100, $2)
2026-10-16 20:23:53.606 GMT [86076] ERROR:  new row for relation "reservas" violates check constraint "cancelamento_coerente"
2026-10-16 20:23:53.606 GMT [86076] DETAIL:  Failing row contains (5d0e935d-e53b-4107-94f1-07a3901e8c59, 4a4acfd4-7de4-440a-bb73-9f7193a0e015, 6b2656b7-7cd5-41ae-b399-a337a200af38, hospedagem, Pousada da Serra, null, null, null, 90000, f, Pago no balcão, 6b2656b7-7cd5-41ae-b399-a337a200af38, 2026-10-16 20:23:53.601422+00, cancelada, null, 3, 2026-10-16 20:23:53.599551+00, 2026-10-16 20:23:53.604992+00).
2026-10-16 20:23:53.606 GMT [86076] STATEMENT:  UPDATE reservas SET estado = 'cancelada', motivo_cancelamento = NULL WHERE id = $1
2026-10-16 20:23:54.921 GMT [83448] LOG:  skipping vacuum of "convites" --- lock not available
2026-10-16 20:23:54.921 GMT [83448] LOG:  skipping analyze of "membros_viagem" --- lock not available
2026-10-16 20:23:54.921 GMT [83448] LOG:  skipping vacuum of "viagens" --- lock not available
2026-10-16 20:23:54.921 GMT [83448] LOG:  skipping analyze of "tentativas_login" --- lock not available
2026-10-16 20:23:54.921 GMT [83448] LOG:  skipping vacuum of "sessoes" --- lock not available
2026-10-16 20:23:54.921 GMT [83448] LOG:  skipping analyze of "usuarios" --- lock not available
2026-10-16 20:24:03.920 GMT [81852] ERROR:  duplicate key value violates unique constraint "um_organizador_ativo_por_viagem"
2026-10-16 20:24:03.920 GMT [81852] DETAIL:  Key (viagem_id)=(3c4d3b24-031f-4bc6-9949-fe1d0e794209) already exists.
2026-10-16 20:24:03.920 GMT [81852] STATEMENT:  UPDATE membros_viagem SET papel = 'organizador' WHERE viagem_id = $1 AND usuario_id = $2
```

