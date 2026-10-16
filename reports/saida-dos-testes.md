# Saída dos testes (rodada mais recente)
- **Quando:** 2026-10-16T01:40:31.487Z (local 16/10/2026, 01:40:31)
- **Node:** v22.22.3 · **npm:** 10.9.8 · **Sistema:** linux x64
- **Placar:** 436 passaram · 0 falharam · 0 pulados · **Código de saída:** 0
- **Tipos:** sem erro
- **Arquivos de teste que não carregaram:** nenhum
## Saída completa
```

> lia-go@0.1.0 test:tools
> node --test "tools/test_dev.mjs"

TAP version 13
# Subtest: Windows: npm (`.cmd`) vira UMA linha executada pelo cmd.exe — sem `cmd.exe` sobrando na linha
ok 1 - Windows: npm (`.cmd`) vira UMA linha executada pelo cmd.exe — sem `cmd.exe` sobrando na linha
  ---
  duration_ms: 1.952341
  type: 'test'
  ...
# Subtest: Windows: caminho com espaço vira aspas (Program Files)
ok 2 - Windows: caminho com espaço vira aspas (Program Files)
  ---
  duration_ms: 0.300782
  type: 'test'
  ...
# Subtest: prompt no lugar do programa é reconhecido como 'não rodou nada'
ok 3 - prompt no lugar do programa é reconhecido como 'não rodou nada'
  ---
  duration_ms: 1.384035
  type: 'test'
  ...
# Subtest: Windows: programas .exe continuam sem shell (git, node, docker)
ok 4 - Windows: programas .exe continuam sem shell (git, node, docker)
  ---
  duration_ms: 0.159023
  type: 'test'
  ...
# Subtest: Linux/macOS: nada de shell, mesmo com nome terminando em .cmd
ok 5 - Linux/macOS: nada de shell, mesmo com nome terminando em .cmd
  ---
  duration_ms: 0.185482
  type: 'test'
  ...
# Subtest: erro de spawn vira explicação em português, não um código solto
ok 6 - erro de spawn vira explicação em português, não um código solto
  ---
  duration_ms: 0.235312
  type: 'test'
  ...
# Subtest: rede instável vale tentar de novo; DNS/registro errado NÃO (seria perda de tempo)
ok 7 - rede instável vale tentar de novo; DNS/registro errado NÃO (seria perda de tempo)
  ---
  duration_ms: 1.413213
  type: 'test'
  ...
# Subtest: sintoma 'Exit handler never called' (npm se perdendo) explica e manda tentar de novo
ok 8 - sintoma 'Exit handler never called' (npm se perdendo) explica e manda tentar de novo
  ---
  duration_ms: 0.135324
  type: 'test'
  ...
# Subtest: quando a tela não explica, o log interno do npm entra em cena (caso real medido)
ok 9 - quando a tela não explica, o log interno do npm entra em cena (caso real medido)
  ---
  duration_ms: 0.863514
  type: 'test'
  ...
# Subtest: quando a tela já explica, o log não é usado (não confunde a pessoa)
ok 10 - quando a tela já explica, o log não é usado (não confunde a pessoa)
  ---
  duration_ms: 0.394012
  type: 'test'
  ...
# Subtest: linhas relevantes são resumidas e sem repetição
ok 11 - linhas relevantes são resumidas e sem repetição
  ---
  duration_ms: 0.231981
  type: 'test'
  ...
# Subtest: o caminho do log interno do npm é encontrado na saída (é onde mora o motivo real)
ok 12 - o caminho do log interno do npm é encontrado na saída (é onde mora o motivo real)
  ---
  duration_ms: 0.212134
  type: 'test'
  ...
# Subtest: Windows: o caminho do log com \\ também é reconhecido
ok 13 - Windows: o caminho do log com \\ também é reconhecido
  ---
  duration_ms: 0.088302
  type: 'test'
  ...
# Subtest: proxy com senha é reconhecido separadamente da rede comum
ok 14 - proxy com senha é reconhecido separadamente da rede comum
  ---
  duration_ms: 0.109031
  type: 'test'
  ...
# Subtest: caso real: o pacote @fastify/proxy-addr no log NÃO é problema de proxy
ok 15 - caso real: o pacote @fastify/proxy-addr no log NÃO é problema de proxy
  ---
  duration_ms: 0.100153
  type: 'test'
  ...
# Subtest: números soltos no log (tamanhos, códigos, portas) não viram causa falsa
ok 16 - números soltos no log (tamanhos, códigos, portas) não viram causa falsa
  ---
  duration_ms: 0.116739
  type: 'test'
  ...
# Subtest: antivírus/arquivo preso (EPERM) explica fechar janelas
ok 17 - antivírus/arquivo preso (EPERM) explica fechar janelas
  ---
  duration_ms: 0.14683
  type: 'test'
  ...
# Subtest: cada causa conhecida tem dica acionável
ok 18 - cada causa conhecida tem dica acionável
  ---
  duration_ms: 0.146464
  type: 'test'
  ...
# Subtest: falha não reconhecida ainda dá orientação útil (e não mente sobre a causa)
ok 19 - falha não reconhecida ainda dá orientação útil (e não mente sobre a causa)
  ---
  duration_ms: 0.147645
  type: 'test'
  ...
# Subtest: múltiplas causas específicas na mesma saída são todas reportadas
ok 20 - múltiplas causas específicas na mesma saída são todas reportadas
  ---
  duration_ms: 0.184556
  type: 'test'
  ...
# Subtest: resumo da saída mostra o fim e nunca engole a mensagem de erro
ok 21 - resumo da saída mostra o fim e nunca engole a mensagem de erro
  ---
  duration_ms: 0.248913
  type: 'test'
  ...
# Subtest: URL do banco é exibida sem senha (nunca vaza em relatório)
ok 22 - URL do banco é exibida sem senha (nunca vaza em relatório)
  ---
  duration_ms: 0.170038
  type: 'test'
  ...
# Subtest: leitura do .env ignora comentários e linhas vazias
ok 23 - leitura do .env ignora comentários e linhas vazias
  ---
  duration_ms: 0.193882
  type: 'test'
  ...
# Subtest: Windows procura o Python como `py -3`/`python` — `python3` não existe lá
ok 24 - Windows procura o Python como `py -3`/`python` — `python3` não existe lá
  ---
  duration_ms: 0.152652
  type: 'test'
  ...
# Subtest: janela de Python para o banco embutido (3.9–3.12) — fora dela o pip não teria binário para baixar
ok 25 - janela de Python para o banco embutido (3.9–3.12) — fora dela o pip não teria binário para baixar
  ---
  duration_ms: 0.151602
  type: 'test'
  ...
# Subtest: log do PostgreSQL vira dica acionável (administrador, porta ocupada)
ok 26 - log do PostgreSQL vira dica acionável (administrador, porta ocupada)
  ---
  duration_ms: 0.375429
  type: 'test'
  ...
# Subtest: escolhe o arquivo de binários certo por sistema (e avisa quando não existe)
ok 27 - escolhe o arquivo de binários certo por sistema (e avisa quando não existe)
  ---
  duration_ms: 0.284489
  type: 'test'
  ...
# Subtest: avisa quando a plataforma não tem binário publicado (Windows/Linux ARM)
ok 28 - avisa quando a plataforma não tem binário publicado (Windows/Linux ARM)
  ---
  duration_ms: 0.09135
  type: 'test'
  ...
# Subtest: extração do arquivo baixado tenta os programas certos em cada sistema
ok 29 - extração do arquivo baixado tenta os programas certos em cada sistema
  ---
  duration_ms: 0.172233
  type: 'test'
  ...
# Subtest: diagnóstico do computador diz o essencial em português
ok 30 - diagnóstico do computador diz o essencial em português
  ---
  duration_ms: 0.235717
  type: 'test'
  ...
# Subtest: progresso do download é legível: barra, percentual, tamanho e velocidade
ok 31 - progresso do download é legível: barra, percentual, tamanho e velocidade
  ---
  duration_ms: 0.254517
  type: 'test'
  ...
# Subtest: tamanhos e tempos em português
ok 32 - tamanhos e tempos em português
  ---
  duration_ms: 0.194135
  type: 'test'
  ...
# Subtest: atualização: escolhe a referência e nunca decide mexer no que é da pessoa
ok 33 - atualização: escolhe a referência e nunca decide mexer no que é da pessoa
  ---
  duration_ms: 0.324478
  type: 'test'
  ...
# Subtest: conflito pela metade é reconhecido (foi o que quebrou a rodada seguinte)
ok 34 - conflito pela metade é reconhecido (foi o que quebrou a rodada seguinte)
  ---
  duration_ms: 0.284747
  type: 'test'
  ...
# Subtest: limites de tempo são explicados em linguagem simples
ok 35 - limites de tempo são explicados em linguagem simples
  ---
  duration_ms: 0.11478
  type: 'test'
  ...
# Subtest: a rodada NÃO fica presa quando sobra um processo vivo (o caso do PostgreSQL)
ok 36 - a rodada NÃO fica presa quando sobra um processo vivo (o caso do PostgreSQL)
  ---
  duration_ms: 54.249463
  type: 'test'
  ...
# Subtest: o placar dos testes é lido no console do Windows (ℹ) e no arquivo (TAP \#) — nunca mais '0 passaram'
ok 37 - o placar dos testes é lido no console do Windows (ℹ) e no arquivo (TAP \#) — nunca mais '0 passaram'
  ---
  duration_ms: 0.772964
  type: 'test'
  ...
# Subtest: saída de servidor é repassada linha por linha (nunca cola uma linha na outra)
ok 38 - saída de servidor é repassada linha por linha (nunca cola uma linha na outra)
  ---
  duration_ms: 1.239395
  type: 'test'
  ...
# Subtest: as funções principais do orquestrador continuam existindo (nenhuma remoção acidental)
ok 39 - as funções principais do orquestrador continuam existindo (nenhuma remoção acidental)
  ---
  duration_ms: 2.588947
  type: 'test'
  ...
# Subtest: arquivo de teste que não carregou é reconhecido nos dois formatos do Node
ok 40 - arquivo de teste que não carregou é reconhecido nos dois formatos do Node
  ---
  duration_ms: 0.716096
  type: 'test'
  ...
# Subtest: teste comum que falhou NÃO é confundido com arquivo que não carregou
ok 41 - teste comum que falhou NÃO é confundido com arquivo que não carregou
  ---
  duration_ms: 0.114573
  type: 'test'
  ...
# Subtest: o relatório leva o erro com contexto, não só o placar
ok 42 - o relatório leva o erro com contexto, não só o placar
  ---
  duration_ms: 0.432072
  type: 'test'
  ...
# Subtest: erro de TypeScript também entra no relatório como falha
ok 43 - erro de TypeScript também entra no relatório como falha
  ---
  duration_ms: 0.107775
  type: 'test'
  ...
# Subtest: saída sem falha não inventa bloco de erro (relatório verde fica limpo)
ok 44 - saída sem falha não inventa bloco de erro (relatório verde fica limpo)
  ---
  duration_ms: 0.112691
  type: 'test'
  ...
1..44
# tests 44
# suites 0
# pass 44
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 153.29576


> lia-go@0.1.0 test:domain
> npm run test --workspace @lia-go/domain


> @lia-go/domain@0.1.0 test
> node --test "tests/*.test.ts"

TAP version 13
# Subtest: saldo = total pago − parte que lhe cabe (somente confirmadas)
ok 1 - saldo = total pago − parte que lhe cabe (somente confirmadas)
  ---
  duration_ms: 4.422972
  type: 'test'
  ...
# Subtest: despesa pendente e contestada ficam em comprometido, fora do saldo oficial
ok 2 - despesa pendente e contestada ficam em comprometido, fora do saldo oficial
  ---
  duration_ms: 0.753729
  type: 'test'
  ...
# Subtest: despesa pessoal não gera dívida entre participantes
ok 3 - despesa pessoal não gera dívida entre participantes
  ---
  duration_ms: 0.355008
  type: 'test'
  ...
# Subtest: transferências confirmadas quitam o saldo; informadas e contestadas não
ok 4 - transferências confirmadas quitam o saldo; informadas e contestadas não
  ---
  duration_ms: 0.463814
  type: 'test'
  ...
# Subtest: sugestão de transferências minimiza o número de pagamentos e fecha exatamente
ok 5 - sugestão de transferências minimiza o número de pagamentos e fecha exatamente
  ---
  duration_ms: 1.387292
  type: 'test'
  ...
# Subtest: saldo zerado não sugere transferências
ok 6 - saldo zerado não sugere transferências
  ---
  duration_ms: 0.355699
  type: 'test'
  ...
# Subtest: item nasce aberto, sem prazo inventado e com validações de gente
ok 7 - item nasce aberto, sem prazo inventado e com validações de gente
  ---
  duration_ms: 1.425611
  type: 'test'
  ...
# Subtest: o prazo não conclui nada: passou da data, o item continua aberto e só fica marcado como atrasado
ok 8 - o prazo não conclui nada: passou da data, o item continua aberto e só fica marcado como atrasado
  ---
  duration_ms: 0.221081
  type: 'test'
  ...
# Subtest: concluir registra quem e quando; concluir de novo é recusado
ok 9 - concluir registra quem e quando; concluir de novo é recusado
  ---
  duration_ms: 0.263956
  type: 'test'
  ...
# Subtest: reabrir exige motivo e deixa rastro de por que voltou
ok 10 - reabrir exige motivo e deixa rastro de por que voltou
  ---
  duration_ms: 0.542157
  type: 'test'
  ...
# Subtest: resumo adaptativo: só fala do que existe (aberto, feito, atrasado, hoje, sem responsável)
ok 11 - resumo adaptativo: só fala do que existe (aberto, feito, atrasado, hoje, sem responsável)
  ---
  duration_ms: 0.264089
  type: 'test'
  ...
# Subtest: ordem de leitura: atrasado primeiro, depois prazo mais próximo, sem prazo e feitos no fim
ok 12 - ordem de leitura: atrasado primeiro, depois prazo mais próximo, sem prazo e feitos no fim
  ---
  duration_ms: 0.749871
  type: 'test'
  ...
# Subtest: documento nasce privado e só quem criou vê
ok 13 - documento nasce privado e só quem criou vê
  ---
  duration_ms: 1.516008
  type: 'test'
  ...
# Subtest: link estranho é recusado (nada de caminho disfarçado)
ok 14 - link estranho é recusado (nada de caminho disfarçado)
  ---
  duration_ms: 0.581501
  type: 'test'
  ...
# Subtest: compartilhar com a viagem dá acesso a todos; com pessoas, só a elas
ok 15 - compartilhar com a viagem dá acesso a todos; com pessoas, só a elas
  ---
  duration_ms: 0.456486
  type: 'test'
  ...
# Subtest: revogar tira o acesso sem apagar a história
ok 16 - revogar tira o acesso sem apagar a história
  ---
  duration_ms: 0.395903
  type: 'test'
  ...
# Subtest: remover exige motivo, revoga o acesso e mantém o registro para quem administra
ok 17 - remover exige motivo, revoga o acesso e mantém o registro para quem administra
  ---
  duration_ms: 0.340286
  type: 'test'
  ...
# Subtest: resumo conta o que existe: só seus, compartilhados e removidos
ok 18 - resumo conta o que existe: só seus, compartilhados e removidos
  ---
  duration_ms: 0.344081
  type: 'test'
  ...
# Subtest: impacto antes de compartilhar e de remover diz o que acontece de verdade
ok 19 - impacto antes de compartilhar e de remover diz o que acontece de verdade
  ---
  duration_ms: 0.381464
  type: 'test'
  ...
# Subtest: despesa nova nasce pendente e não entra no saldo oficial
ok 20 - despesa nova nasce pendente e não entra no saldo oficial
  ---
  duration_ms: 1.998955
  type: 'test'
  ...
# Subtest: campos obrigatórios são validados
ok 21 - campos obrigatórios são validados
  ---
  duration_ms: 0.65682
  type: 'test'
  ...
# Subtest: confirmação exige outra pessoa e move a despesa para o saldo oficial
ok 22 - confirmação exige outra pessoa e move a despesa para o saldo oficial
  ---
  duration_ms: 1.482268
  type: 'test'
  ...
# Subtest: não é possível confirmar duas vezes nem confirmar cancelada
ok 23 - não é possível confirmar duas vezes nem confirmar cancelada
  ---
  duration_ms: 0.356059
  type: 'test'
  ...
# Subtest: contestação exige motivo, vem de outra pessoa e tira a despesa do saldo oficial
ok 24 - contestação exige motivo, vem de outra pessoa e tira a despesa do saldo oficial
  ---
  duration_ms: 0.468911
  type: 'test'
  ...
# Subtest: correção exige motivo, preserva histórico e volta para pendente
ok 25 - correção exige motivo, preserva histórico e volta para pendente
  ---
  duration_ms: 0.702554
  type: 'test'
  ...
# Subtest: despesa pessoal não cria obrigação para outras pessoas
ok 26 - despesa pessoal não cria obrigação para outras pessoas
  ---
  duration_ms: 0.25919
  type: 'test'
  ...
# Subtest: rateio da despesa compartilhada pode ser percentual ou por valores
ok 27 - rateio da despesa compartilhada pode ser percentual ou por valores
  ---
  duration_ms: 0.88623
  type: 'test'
  ...
# Subtest: despesa de valor quebrado em 3 pessoas soma exatamente o total
ok 28 - despesa de valor quebrado em 3 pessoas soma exatamente o total
  ---
  duration_ms: 0.371376
  type: 'test'
  ...
# Subtest: histórico preservado em sequência completa: criar → confirmar → contestar → corrigir → confirmar
ok 29 - histórico preservado em sequência completa: criar → confirmar → contestar → corrigir → confirmar
  ---
  duration_ms: 0.583082
  type: 'test'
  ...
# Subtest: só despesa confirmada entra no total oficial; o resto aparece separado, com aviso
ok 30 - só despesa confirmada entra no total oficial; o resto aparece separado, com aviso
  ---
  duration_ms: 16.467784
  type: 'test'
  ...
# Subtest: saldos e acertos sugeridos: quem pagou recebe, quem deve paga, e é sugestão
ok 31 - saldos e acertos sugeridos: quem pagou recebe, quem deve paga, e é sugestão
  ---
  duration_ms: 1.245868
  type: 'test'
  ...
# Subtest: o previsto (roteiro + reservas) sai do total oficial e é rotulado como planejamento
ok 32 - o previsto (roteiro + reservas) sai do total oficial e é rotulado como planejamento
  ---
  duration_ms: 0.669836
  type: 'test'
  ...
# Subtest: limite combinado aparece no fechamento e o estouro é avisado
ok 33 - limite combinado aparece no fechamento e o estouro é avisado
  ---
  duration_ms: 0.443443
  type: 'test'
  ...
# Subtest: CSV: separador de planilha pt-BR, valores com vírgula e guarda contra fórmula
ok 34 - CSV: separador de planilha pt-BR, valores com vírgula e guarda contra fórmula
  ---
  duration_ms: 0.442649
  type: 'test'
  ...
# Subtest: campoCsv: aspas, quebra de linha e perigo de fórmula
ok 35 - campoCsv: aspas, quebra de linha e perigo de fórmula
  ---
  duration_ms: 0.1204
  type: 'test'
  ...
# Subtest: convite normaliza e-mail e expira em 14 dias por padrão
ok 36 - convite normaliza e-mail e expira em 14 dias por padrão
  ---
  duration_ms: 1.185454
  type: 'test'
  ...
# Subtest: convite expirado não pode ser aceito
ok 37 - convite expirado não pode ser aceito
  ---
  duration_ms: 0.258788
  type: 'test'
  ...
# Subtest: só o dono do e-mail convidado aceita o convite
ok 38 - só o dono do e-mail convidado aceita o convite
  ---
  duration_ms: 0.247835
  type: 'test'
  ...
# Subtest: organizador cancela convite pendente; participante não
ok 39 - organizador cancela convite pendente; participante não
  ---
  duration_ms: 0.24116
  type: 'test'
  ...
# Subtest: consequências de sair/remover preservam histórico e pendências
ok 40 - consequências de sair/remover preservam histórico e pendências
  ---
  duration_ms: 0.386919
  type: 'test'
  ...
# Subtest: centavos recusa número fracionário (nunca float como dinheiro)
ok 41 - centavos recusa número fracionário (nunca float como dinheiro)
  ---
  duration_ms: 1.357456
  type: 'test'
  ...
# Subtest: analisarValorMonetario entende formatos brasileiros
ok 42 - analisarValorMonetario entende formatos brasileiros
  ---
  duration_ms: 0.704305
  type: 'test'
  ...
# Subtest: analisarValorMonetario rejeita entrada inválida
ok 43 - analisarValorMonetario rejeita entrada inválida
  ---
  duration_ms: 0.255537
  type: 'test'
  ...
# Subtest: formatarBRL formata centavos em pt-BR
ok 44 - formatarBRL formata centavos em pt-BR
  ---
  duration_ms: 0.287297
  type: 'test'
  ...
# Subtest: alocarProporcional garante soma exata em divisão quebrada
ok 45 - alocarProporcional garante soma exata em divisão quebrada
  ---
  duration_ms: 0.83891
  type: 'test'
  ...
# Subtest: alocarProporcional é determinístico e soma exata em casos-limite
ok 46 - alocarProporcional é determinístico e soma exata em casos-limite
  ---
  duration_ms: 0.617059
  type: 'test'
  ...
# Subtest: com pesos iguais a diferença entre partes é de no máximo 1 centavo
ok 47 - com pesos iguais a diferença entre partes é de no máximo 1 centavo
  ---
  duration_ms: 0.244198
  type: 'test'
  ...
# Subtest: alocarProporcional trata total negativo (estorno) preservando a soma
ok 48 - alocarProporcional trata total negativo (estorno) preservando a soma
  ---
  duration_ms: 0.186038
  type: 'test'
  ...
# Subtest: alocarProporcional rejeita pesos inválidos
ok 49 - alocarProporcional rejeita pesos inválidos
  ---
  duration_ms: 0.368524
  type: 'test'
  ...
# Subtest: convite recebido é obrigação minha, de alta prioridade, e não decide por mim
ok 50 - convite recebido é obrigação minha, de alta prioridade, e não decide por mim
  ---
  duration_ms: 1.900984
  type: 'test'
  ...
# Subtest: convite recebido vencido diz que o prazo passou e que o antigo não dá acesso
ok 51 - convite recebido vencido diz que o prazo passou e que o antigo não dá acesso
  ---
  duration_ms: 0.290115
  type: 'test'
  ...
# Subtest: convite que vence hoje ainda vale hoje (o dia inteiro conta)
ok 52 - convite que vence hoje ainda vale hoje (o dia inteiro conta)
  ---
  duration_ms: 0.172292
  type: 'test'
  ...
# Subtest: convite enviado e ainda pendente aparece como lembrete médio de quem convidou
ok 53 - convite enviado e ainda pendente aparece como lembrete médio de quem convidou
  ---
  duration_ms: 0.218003
  type: 'test'
  ...
# Subtest: convite já aceito não gera notificação nenhuma
ok 54 - convite já aceito não gera notificação nenhuma
  ---
  duration_ms: 0.135702
  type: 'test'
  ...
# Subtest: convite enviado que venceu vira alta prioridade (precisa convidar de novo)
ok 55 - convite enviado que venceu vira alta prioridade (precisa convidar de novo)
  ---
  duration_ms: 0.245064
  type: 'test'
  ...
# Subtest: despesa pendente em viagem acontecendo é alta prioridade e não acusa ninguém
ok 56 - despesa pendente em viagem acontecendo é alta prioridade e não acusa ninguém
  ---
  duration_ms: 0.213405
  type: 'test'
  ...
# Subtest: despesa pendente em viagem que ainda não começou é média prioridade
ok 57 - despesa pendente em viagem que ainda não começou é média prioridade
  ---
  duration_ms: 0.152817
  type: 'test'
  ...
# Subtest: viagem cancelada não gera pendência financeira na central
ok 58 - viagem cancelada não gera pendência financeira na central
  ---
  duration_ms: 0.275843
  type: 'test'
  ...
# Subtest: viagem sem pendência não gera nada (nada de aviso de rotina)
ok 59 - viagem sem pendência não gera nada (nada de aviso de rotina)
  ---
  duration_ms: 0.365233
  type: 'test'
  ...
# Subtest: rascunho avisa só quem organiza, e o texto diz que o estado não muda sozinho
ok 60 - rascunho avisa só quem organiza, e o texto diz que o estado não muda sozinho
  ---
  duration_ms: 0.236739
  type: 'test'
  ...
# Subtest: rascunho sem data diz que faltam as datas (e não inventa prazo)
ok 61 - rascunho sem data diz que faltam as datas (e não inventa prazo)
  ---
  duration_ms: 0.145551
  type: 'test'
  ...
# Subtest: pagamento informado para mim é alta prioridade: informar não é pagar
ok 62 - pagamento informado para mim é alta prioridade: informar não é pagar
  ---
  duration_ms: 0.399565
  type: 'test'
  ...
# Subtest: pagamento que eu informei é informativo (baixa) e não cobra a outra pessoa
ok 63 - pagamento que eu informei é informativo (baixa) e não cobra a outra pessoa
  ---
  duration_ms: 0.29581
  type: 'test'
  ...
# Subtest: movimento confirmado deixa de ser notificação (a obrigação acabou)
ok 64 - movimento confirmado deixa de ser notificação (a obrigação acabou)
  ---
  duration_ms: 0.115045
  type: 'test'
  ...
# Subtest: movimento entre outras duas pessoas não vira notificação minha
ok 65 - movimento entre outras duas pessoas não vira notificação minha
  ---
  duration_ms: 0.089938
  type: 'test'
  ...
# Subtest: item atrasado meu é alta prioridade e o texto deixa claro que ninguém conclui por mim
ok 66 - item atrasado meu é alta prioridade e o texto deixa claro que ninguém conclui por mim
  ---
  duration_ms: 0.352092
  type: 'test'
  ...
# Subtest: item atrasado de outra pessoa é lembrete de baixa prioridade, com o nome de quem pegou
ok 67 - item atrasado de outra pessoa é lembrete de baixa prioridade, com o nome de quem pegou
  ---
  duration_ms: 0.139759
  type: 'test'
  ...
# Subtest: item atrasado sem responsável é média: é do grupo e alguém precisa assumir
ok 68 - item atrasado sem responsável é média: é do grupo e alguém precisa assumir
  ---
  duration_ms: 0.106865
  type: 'test'
  ...
# Subtest: item para hoje é lembrete (média) — o dia ainda não acabou
ok 69 - item para hoje é lembrete (média) — o dia ainda não acabou
  ---
  duration_ms: 0.113539
  type: 'test'
  ...
# Subtest: item concluído não aparece, mesmo com prazo vencido
ok 70 - item concluído não aparece, mesmo com prazo vencido
  ---
  duration_ms: 0.142003
  type: 'test'
  ...
# Subtest: item sem prazo não vira notificação (sem data não há atraso)
ok 71 - item sem prazo não vira notificação (sem data não há atraso)
  ---
  duration_ms: 0.092872
  type: 'test'
  ...
# Subtest: lista vazia de dados não inventa notificação nenhuma
ok 72 - lista vazia de dados não inventa notificação nenhuma
  ---
  duration_ms: 0.594244
  type: 'test'
  ...
# Subtest: reserva sem valor aparece como média e explica que nunca vale zero
ok 73 - reserva sem valor aparece como média e explica que nunca vale zero
  ---
  duration_ms: 0.197706
  type: 'test'
  ...
# Subtest: orçamento em atenção é média; estourado é alta — e os dois dizem que o saldo oficial não mudou
ok 74 - orçamento em atenção é média; estourado é alta — e os dois dizem que o saldo oficial não mudou
  ---
  duration_ms: 0.183815
  type: 'test'
  ...
# Subtest: orçamento dentro do limite (ou sem limite) não gera notificação
ok 75 - orçamento dentro do limite (ou sem limite) não gera notificação
  ---
  duration_ms: 0.13595
  type: 'test'
  ...
# Subtest: marcar como lida não resolve: continua aberta, só deixa de ser 'não lida'
ok 76 - marcar como lida não resolve: continua aberta, só deixa de ser 'não lida'
  ---
  duration_ms: 0.357903
  type: 'test'
  ...
# Subtest: desmarcar volta para 'ainda não vi' (o botão de arrepender funciona)
ok 77 - desmarcar volta para 'ainda não vi' (o botão de arrepender funciona)
  ---
  duration_ms: 0.126648
  type: 'test'
  ...
# Subtest: dispensar tira da lista de abertas, mas o filtro 'dispensadas' mostra
ok 78 - dispensar tira da lista de abertas, mas o filtro 'dispensadas' mostra
  ---
  duration_ms: 0.198655
  type: 'test'
  ...
# Subtest: dispensar não esconde o problema quando ele piora: a chave muda com o fato
ok 79 - dispensar não esconde o problema quando ele piora: a chave muda com o fato
  ---
  duration_ms: 0.111163
  type: 'test'
  ...
# Subtest: resolvida é o fato que sumiu dos dados: sai das abertas e entra no histórico
ok 80 - resolvida é o fato que sumiu dos dados: sai das abertas e entra no histórico
  ---
  duration_ms: 0.245023
  type: 'test'
  ...
# Subtest: histórico de resolvidas vem da mais recente para a mais antiga
ok 81 - histórico de resolvidas vem da mais recente para a mais antiga
  ---
  duration_ms: 0.237627
  type: 'test'
  ...
# Subtest: marca antiga é podada quando o histórico cresce demais (o aparelho não guarda para sempre)
ok 82 - marca antiga é podada quando o histórico cresce demais (o aparelho não guarda para sempre)
  ---
  duration_ms: 0.238717
  type: 'test'
  ...
# Subtest: filtro por viagem isola o que é daquela viagem (inclusive a busca)
ok 83 - filtro por viagem isola o que é daquela viagem (inclusive a busca)
  ---
  duration_ms: 7.14928
  type: 'test'
  ...
# Subtest: filtro por categoria e por prioridade combinam entre si
ok 84 - filtro por categoria e por prioridade combinam entre si
  ---
  duration_ms: 0.327501
  type: 'test'
  ...
# Subtest: filtro 'só as minhas' traz obrigação de quem pergunta, não o que é de outro
ok 85 - filtro 'só as minhas' traz obrigação de quem pergunta, não o que é de outro
  ---
  duration_ms: 0.223137
  type: 'test'
  ...
# Subtest: busca ignora acento e maiúscula (quem digita 'pousada' acha 'Pousada')
ok 86 - busca ignora acento e maiúscula (quem digita 'pousada' acha 'Pousada')
  ---
  duration_ms: 0.301625
  type: 'test'
  ...
# Subtest: ordem: alta primeiro; entre iguais, o que ainda não foi visto vem antes
ok 87 - ordem: alta primeiro; entre iguais, o que ainda não foi visto vem antes
  ---
  duration_ms: 0.236666
  type: 'test'
  ...
# Subtest: resumo descreve o que a tela mostra, sem prometer o que não há
ok 88 - resumo descreve o que a tela mostra, sem prometer o que não há
  ---
  duration_ms: 0.234543
  type: 'test'
  ...
# Subtest: filtro de viagens lista só o que tem notificação, em ordem alfabética e sem repetir
ok 89 - filtro de viagens lista só o que tem notificação, em ordem alfabética e sem repetir
  ---
  duration_ms: 0.26202
  type: 'test'
  ...
# Subtest: cada notificação tem um próximo passo concreto e um destino válido
ok 90 - cada notificação tem um próximo passo concreto e um destino válido
  ---
  duration_ms: 0.24213
  type: 'test'
  ...
# Subtest: chaves não se repetem: fato diferente, notificação diferente
ok 91 - chaves não se repetem: fato diferente, notificação diferente
  ---
  duration_ms: 0.170974
  type: 'test'
  ...
# Subtest: limite coletivo não pertence a uma pessoa; individual precisa dizer de quem é
ok 92 - limite coletivo não pertence a uma pessoa; individual precisa dizer de quem é
  ---
  duration_ms: 1.572863
  type: 'test'
  ...
# Subtest: sem limite o app diz 'sem limite' em vez de inventar um teto
ok 93 - sem limite o app diz 'sem limite' em vez de inventar um teto
  ---
  duration_ms: 0.493123
  type: 'test'
  ...
# Subtest: dentro, perto e estourado: o estado sai do número, com alerta em texto
ok 94 - dentro, perto e estourado: o estado sai do número, com alerta em texto
  ---
  duration_ms: 0.887514
  type: 'test'
  ...
# Subtest: previsto estourado sem gasto ainda dá para replanejar (e a tela diz isso)
ok 95 - previsto estourado sem gasto ainda dá para replanejar (e a tela diz isso)
  ---
  duration_ms: 0.225194
  type: 'test'
  ...
# Subtest: custo sem valor informado aparece como aviso: o previsto é o mínimo
ok 96 - custo sem valor informado aparece como aviso: o previsto é o mínimo
  ---
  duration_ms: 0.232093
  type: 'test'
  ...
# Subtest: aguardando confirmação aparece separado do oficial no resumo
ok 97 - aguardando confirmação aparece separado do oficial no resumo
  ---
  duration_ms: 0.155484
  type: 'test'
  ...
# Subtest: limite zero é um combinado explícito, não um erro silencioso
ok 98 - limite zero é um combinado explícito, não um erro silencioso
  ---
  duration_ms: 0.16854
  type: 'test'
  ...
# Subtest: participante registra despesas e propõe; administração é do organizador
ok 99 - participante registra despesas e propõe; administração é do organizador
  ---
  duration_ms: 0.884653
  type: 'test'
  ...
# Subtest: motivo é sempre explicado para a interface
ok 100 - motivo é sempre explicado para a interface
  ---
  duration_ms: 0.250269
  type: 'test'
  ...
# Subtest: convite pendente, quem saiu e quem foi removido não têm acesso
ok 101 - convite pendente, quem saiu e quem foi removido não têm acesso
  ---
  duration_ms: 0.206285
  type: 'test'
  ...
# Subtest: viagem cancelada bloqueia novos compromissos e libera correções
ok 102 - viagem cancelada bloqueia novos compromissos e libera correções
  ---
  duration_ms: 0.141534
  type: 'test'
  ...
# Subtest: viagem concluída bloqueia lançamentos novos e mantém acertos
ok 103 - viagem concluída bloqueia lançamentos novos e mantém acertos
  ---
  duration_ms: 0.124372
  type: 'test'
  ...
# Subtest: quem lançou não confirma o próprio lançamento
ok 104 - quem lançou não confirma o próprio lançamento
  ---
  duration_ms: 0.189496
  type: 'test'
  ...
# Subtest: início e conclusão podem ser confirmados por qualquer participante ativo
ok 105 - início e conclusão podem ser confirmados por qualquer participante ativo
  ---
  duration_ms: 0.199306
  type: 'test'
  ...
# Subtest: reserva nasce prevista e sem confirmação: confirmar é ato separado, com evidência
ok 106 - reserva nasce prevista e sem confirmação: confirmar é ato separado, com evidência
  ---
  duration_ms: 1.21731
  type: 'test'
  ...
# Subtest: custo desconhecido é null (nunca zero) e fica marcado para verificar
ok 107 - custo desconhecido é null (nunca zero) e fica marcado para verificar
  ---
  duration_ms: 0.218265
  type: 'test'
  ...
# Subtest: confirmar exige evidência e registra quem confirmou e quando
ok 108 - confirmar exige evidência e registra quem confirmou e quando
  ---
  duration_ms: 0.552646
  type: 'test'
  ...
# Subtest: o valor não muda ao confirmar: muda a natureza (estimativa → já combinado)
ok 109 - o valor não muda ao confirmar: muda a natureza (estimativa → já combinado)
  ---
  duration_ms: 0.382656
  type: 'test'
  ...
# Subtest: reserva gratuita continua zero explícito, e não "a verificar"
ok 110 - reserva gratuita continua zero explícito, e não "a verificar"
  ---
  duration_ms: 0.270115
  type: 'test'
  ...
# Subtest: cancelar exige motivo, preserva a evidência e não volta atrás
ok 111 - cancelar exige motivo, preserva a evidência e não volta atrás
  ---
  duration_ms: 0.35189
  type: 'test'
  ...
# Subtest: ordem de leitura: com data primeiro, sem data depois, cancelada por último
ok 112 - ordem de leitura: com data primeiro, sem data depois, cancelada por último
  ---
  duration_ms: 0.853837
  type: 'test'
  ...
# Subtest: resumo separa previsto de já combinado e ignora cancelada
ok 113 - resumo separa previsto de já combinado e ignora cancelada
  ---
  duration_ms: 8.6925
  type: 'test'
  ...
# Subtest: resumo sem reserva nenhuma diz isso em vez de mostrar números vazios
ok 114 - resumo sem reserva nenhuma diz isso em vez de mostrar números vazios
  ---
  duration_ms: 0.386415
  type: 'test'
  ...
# Subtest: confirmar mostra o impacto: natureza muda, saldo oficial não
ok 115 - confirmar mostra o impacto: natureza muda, saldo oficial não
  ---
  duration_ms: 0.684528
  type: 'test'
  ...
# Subtest: cancelar avisa que não cancela no fornecedor e diz quanto sai do previsto
ok 116 - cancelar avisa que não cancela no fornecedor e diz quanto sai do previsto
  ---
  duration_ms: 0.240734
  type: 'test'
  ...
# Subtest: custo desconhecido não vira número no impacto de nenhuma das ações
ok 117 - custo desconhecido não vira número no impacto de nenhuma das ações
  ---
  duration_ms: 0.225301
  type: 'test'
  ...
# Subtest: campos inválidos são recusados com mensagem de gente
ok 118 - campos inválidos são recusados com mensagem de gente
  ---
  duration_ms: 0.324883
  type: 'test'
  ...
# Subtest: o relógio nunca conclui uma atividade: só muda o que a tela mostra
ok 119 - o relógio nunca conclui uma atividade: só muda o que a tela mostra
  ---
  duration_ms: 3.124101
  type: 'test'
  ...
# Subtest: atividade sem horário fica na sequência lógica: nada de horário inventado
ok 120 - atividade sem horário fica na sequência lógica: nada de horário inventado
  ---
  duration_ms: 1.226016
  type: 'test'
  ...
# Subtest: custo desconhecido nunca vira R$ 0,00 (desconhecido, a verificar e gratuito são coisas diferentes)
ok 121 - custo desconhecido nunca vira R$ 0,00 (desconhecido, a verificar e gratuito são coisas diferentes)
  ---
  duration_ms: 0.812297
  type: 'test'
  ...
# Subtest: conflito de horário é explicado nos dois níveis e nunca resolvido sozinho
ok 122 - conflito de horário é explicado nos dois níveis e nunca resolvido sozinho
  ---
  duration_ms: 0.559607
  type: 'test'
  ...
# Subtest: deslocamento que não cabe no intervalo vira conflito, e o trecho longo aparece
ok 123 - deslocamento que não cabe no intervalo vira conflito, e o trecho longo aparece
  ---
  duration_ms: 0.316246
  type: 'test'
  ...
# Subtest: resumo do dia soma só o custo conhecido e sinaliza o que falta verificar
ok 124 - resumo do dia soma só o custo conhecido e sinaliza o que falta verificar
  ---
  duration_ms: 7.440416
  type: 'test'
  ...
# Subtest: concluir é ação explícita, registrada com autor e hora
ok 125 - concluir é ação explícita, registrada com autor e hora
  ---
  duration_ms: 0.52363
  type: 'test'
  ...
# Subtest: cancelar e corrigir exigem motivo; quem saiu não faz nada no roteiro
ok 126 - cancelar e corrigir exigem motivo; quem saiu não faz nada no roteiro
  ---
  duration_ms: 0.61646
  type: 'test'
  ...
# Subtest: dias e sequência: agrupa por dia, mantém a ordem e sugere a próxima posição
ok 127 - dias e sequência: agrupa por dia, mantém a ordem e sugere a próxima posição
  ---
  duration_ms: 0.571067
  type: 'test'
  ...
# Subtest: orçamento soma estimativas e compromissos, separados, e ignora cancelada
ok 128 - orçamento soma estimativas e compromissos, separados, e ignora cancelada
  ---
  duration_ms: 0.626607
  type: 'test'
  ...
# Subtest: orçamento não trata desconhecido como zero nem gratuito como gasto
ok 129 - orçamento não trata desconhecido como zero nem gratuito como gasto
  ---
  duration_ms: 0.394421
  type: 'test'
  ...
# Subtest: roteiro sem custo nenhum diz isso em vez de mostrar zero
ok 130 - roteiro sem custo nenhum diz isso em vez de mostrar zero
  ---
  duration_ms: 0.14632
  type: 'test'
  ...
# Subtest: concluir mostra o impacto antes: previsto não muda e o saldo oficial não é calculado na tela
ok 131 - concluir mostra o impacto antes: previsto não muda e o saldo oficial não é calculado na tela
  ---
  duration_ms: 0.269951
  type: 'test'
  ...
# Subtest: concluir avisa o que continua indefinido: custo a verificar e atividade sem horário
ok 132 - concluir avisa o que continua indefinido: custo a verificar e atividade sem horário
  ---
  duration_ms: 0.218129
  type: 'test'
  ...
# Subtest: cancelar diz exatamente quanto sai do previsto e que o histórico não some
ok 133 - cancelar diz exatamente quanto sai do previsto e que o histórico não some
  ---
  duration_ms: 0.210706
  type: 'test'
  ...
# Subtest: cancelar custo desconhecido não inventa número nem some com o que faltava verificar
ok 134 - cancelar custo desconhecido não inventa número nem some com o que faltava verificar
  ---
  duration_ms: 0.226255
  type: 'test'
  ...
# Subtest: atividade nasce sem reserva e sem observação; o que não foi dito fica nulo
ok 135 - atividade nasce sem reserva e sem observação; o que não foi dito fica nulo
  ---
  duration_ms: 0.133052
  type: 'test'
  ...
# Subtest: criar com observação e reserva guarda os dois — e a observação é aparada
ok 136 - criar com observação e reserva guarda os dois — e a observação é aparada
  ---
  duration_ms: 0.14743
  type: 'test'
  ...
# Subtest: observação em branco não vira texto: é o mesmo que não ter dito nada
ok 137 - observação em branco não vira texto: é o mesmo que não ter dito nada
  ---
  duration_ms: 0.176425
  type: 'test'
  ...
# Subtest: corrigir vincula e desvincula reserva, guardando o motivo e subindo a versão
ok 138 - corrigir vincula e desvincula reserva, guardando o motivo e subindo a versão
  ---
  duration_ms: 0.229325
  type: 'test'
  ...
# Subtest: corrigir só a observação não mexe na reserva (e vice-versa)
ok 139 - corrigir só a observação não mexe na reserva (e vice-versa)
  ---
  duration_ms: 0.239409
  type: 'test'
  ...
# Subtest: vincular reserva não confirma nada e não muda o custo da atividade
ok 140 - vincular reserva não confirma nada e não muda o custo da atividade
  ---
  duration_ms: 0.182226
  type: 'test'
  ...
# Subtest: rateio igualitário divide e explica quem recebeu o centavo
ok 141 - rateio igualitário divide e explica quem recebeu o centavo
  ---
  duration_ms: 2.539179
  type: 'test'
  ...
# Subtest: rateio igualitário de 1 centavo entre 3 pessoas soma exatamente 1 centavo
ok 142 - rateio igualitário de 1 centavo entre 3 pessoas soma exatamente 1 centavo
  ---
  duration_ms: 0.278386
  type: 'test'
  ...
# Subtest: rateio percentual respeita os percentuais e fecha a conta
ok 143 - rateio percentual respeita os percentuais e fecha a conta
  ---
  duration_ms: 0.436772
  type: 'test'
  ...
# Subtest: rateio percentual exige soma de 100% (10.000 bps)
ok 144 - rateio percentual exige soma de 100% (10.000 bps)
  ---
  duration_ms: 0.630872
  type: 'test'
  ...
# Subtest: rateio por valores fixos precisa conferir com o total
ok 145 - rateio por valores fixos precisa conferir com o total
  ---
  duration_ms: 0.281371
  type: 'test'
  ...
# Subtest: rateio rejeita participantes duplicados, vazios e negativos
ok 146 - rateio rejeita participantes duplicados, vazios e negativos
  ---
  duration_ms: 0.415398
  type: 'test'
  ...
# Subtest: validarSomaExata confere totais
ok 147 - validarSomaExata confere totais
  ---
  duration_ms: 0.195359
  type: 'test'
  ...
# Subtest: rateio igualitário de valores grandes mantém soma exata e diferença de 1 centavo
ok 148 - rateio igualitário de valores grandes mantém soma exata e diferença de 1 centavo
  ---
  duration_ms: 0.438776
  type: 'test'
  ...
# Subtest: any participante ativo confirma início e fim da viagem; removido não
ok 149 - any participante ativo confirma início e fim da viagem; removido não
  ---
  duration_ms: 2.230746
  type: 'test'
  ...
# Subtest: a data sozinha nunca muda o estado — apenas sugere
ok 150 - a data sozinha nunca muda o estado — apenas sugere
  ---
  duration_ms: 14.502967
  type: 'test'
  ...
# Subtest: sugestão de conclusão aparece depois da data final, sem concluir sozinha
ok 151 - sugestão de conclusão aparece depois da data final, sem concluir sozinha
  ---
  duration_ms: 0.445868
  type: 'test'
  ...
# Subtest: não há sugestão em viagem concluída, cancelada ou pendente
ok 152 - não há sugestão em viagem concluída, cancelada ou pendente
  ---
  duration_ms: 0.166501
  type: 'test'
  ...
# Subtest: fuso da viagem é respeitado ao decidir se a data chegou
ok 153 - fuso da viagem é respeitado ao decidir se a data chegou
  ---
  duration_ms: 0.610692
  type: 'test'
  ...
# Subtest: transições permitidas e papéis
ok 154 - transições permitidas e papéis
  ---
  duration_ms: 0.642363
  type: 'test'
  ...
# Subtest: Pendente exige motivo explícito e é sugerido apenas por pessoas autorizadas
ok 155 - Pendente exige motivo explícito e é sugerido apenas por pessoas autorizadas
  ---
  duration_ms: 0.296032
  type: 'test'
  ...
# Subtest: viagem concluída não reabre automaticamente e cancelada não muda de estado
ok 156 - viagem concluída não reabre automaticamente e cancelada não muda de estado
  ---
  duration_ms: 0.23249
  type: 'test'
  ...
# Subtest: cancelamento é assistido e lista impactos conhecidos
ok 157 - cancelamento é assistido e lista impactos conhecidos
  ---
  duration_ms: 0.654709
  type: 'test'
  ...
1..157
# tests 157
# suites 0
# pass 157
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1903.754911


> lia-go@0.1.0 test:sync
> npm run test --workspace @lia-go/sync


> @lia-go/sync@0.1.0 test
> node --test "tests/*.test.ts"

TAP version 13
# Subtest: mesclar carga junta listas por id e mantém a lista de viagens vinda do servidor
ok 1 - mesclar carga junta listas por id e mantém a lista de viagens vinda do servidor
  ---
  duration_ms: 1.757513
  type: 'test'
  ...
# Subtest: resposta atrasada nunca rebaixa dado mais novo que já está no aparelho
ok 2 - resposta atrasada nunca rebaixa dado mais novo que já está no aparelho
  ---
  duration_ms: 0.190437
  type: 'test'
  ...
# Subtest: item marcado como removido sai da carga local
ok 3 - item marcado como removido sai da carga local
  ---
  duration_ms: 0.17393
  type: 'test'
  ...
# Subtest: a viagem aberta só é trocada se for a mesma e por versão igual ou maior
ok 4 - a viagem aberta só é trocada se for a mesma e por versão igual ou maior
  ---
  duration_ms: 0.273538
  type: 'test'
  ...
# Subtest: sem versão (convites) o servidor sempre atualiza
ok 5 - sem versão (convites) o servidor sempre atualiza
  ---
  duration_ms: 0.156401
  type: 'test'
  ...
# Subtest: remover da carga e contar itens funcionam para a interface
ok 6 - remover da carga e contar itens funcionam para a interface
  ---
  duration_ms: 0.261366
  type: 'test'
  ...
# Subtest: convites que recebi e convites da viagem são listas separadas
ok 7 - convites que recebi e convites da viagem são listas separadas
  ---
  duration_ms: 0.233131
  type: 'test'
  ...
# Subtest: lista sem id é ignorada em vez de virar lixo na interface
ok 8 - lista sem id é ignorada em vez de virar lixo na interface
  ---
  duration_ms: 0.198021
  type: 'test'
  ...
# Subtest: roteiro: atividades do dia entram na carga local (offline) e a mais nova vence
ok 9 - roteiro: atividades do dia entram na carga local (offline) e a mais nova vence
  ---
  duration_ms: 0.443364
  type: 'test'
  ...
# Subtest: roteiro: atividade cancelada sai da carga quando o servidor marca como removida
ok 10 - roteiro: atividade cancelada sai da carga quando o servidor marca como removida
  ---
  duration_ms: 0.416358
  type: 'test'
  ...
# Subtest: trocar a viagem aberta descarta o que era da viagem anterior (menos a lista da conta)
ok 11 - trocar a viagem aberta descarta o que era da viagem anterior (menos a lista da conta)
  ---
  duration_ms: 0.265497
  type: 'test'
  ...
# Subtest: detalhe da viagem nova entra mesmo sendo de outra viagem; o da antiga não volta por atraso
ok 12 - detalhe da viagem nova entra mesmo sendo de outra viagem; o da antiga não volta por atraso
  ---
  duration_ms: 0.220749
  type: 'test'
  ...
# Subtest: cargaCompleta: cache gravado por versão anterior (sem as listas de hoje) não derruba a tela
ok 13 - cargaCompleta: cache gravado por versão anterior (sem as listas de hoje) não derruba a tela
  ---
  duration_ms: 0.137717
  type: 'test'
  ...
# Subtest: cargaCompleta de nada continua sendo a carga vazia (primeira abertura)
ok 14 - cargaCompleta de nada continua sendo a carga vazia (primeira abertura)
  ---
  duration_ms: 1.010893
  type: 'test'
  ...
# Subtest: campo igual nos dois lados não é conflito
ok 15 - campo igual nos dois lados não é conflito
  ---
  duration_ms: 1.457591
  type: 'test'
  ...
# Subtest: campos diferentes alterados em cada lado são mesclados (não são a mesma decisão)
ok 16 - campos diferentes alterados em cada lado são mesclados (não são a mesma decisão)
  ---
  duration_ms: 0.182453
  type: 'test'
  ...
# Subtest: mesmo campo alterado nos dois lados sem dinheiro: segue com a versão do aparelho
ok 17 - mesmo campo alterado nos dois lados sem dinheiro: segue com a versão do aparelho
  ---
  duration_ms: 0.233283
  type: 'test'
  ...
# Subtest: valor de despesa divergente NUNCA é resolvido sozinho
ok 18 - valor de despesa divergente NUNCA é resolvido sozinho
  ---
  duration_ms: 0.261422
  type: 'test'
  ...
# Subtest: moeda, rateio, participantes e quem pagou também contam como dinheiro
ok 19 - moeda, rateio, participantes e quem pagou também contam como dinheiro
  ---
  duration_ms: 0.221239
  type: 'test'
  ...
# Subtest: conflito que junta dinheiro com campo simples continua exigindo decisão
ok 20 - conflito que junta dinheiro com campo simples continua exigindo decisão
  ---
  duration_ms: 0.154412
  type: 'test'
  ...
# Subtest: comparação para a tela usa português simples e marca o que é dinheiro
ok 21 - comparação para a tela usa português simples e marca o que é dinheiro
  ---
  duration_ms: 0.18428
  type: 'test'
  ...
# Subtest: rótulo de campo desconhecido não inventa nome bonito, mas também não quebra
ok 22 - rótulo de campo desconhecido não inventa nome bonito, mas também não quebra
  ---
  duration_ms: 0.148697
  type: 'test'
  ...
# Subtest: enfileirar preserva a ordem de criação e não duplica o mesmo id
ok 23 - enfileirar preserva a ordem de criação e não duplica o mesmo id
  ---
  duration_ms: 2.000289
  type: 'test'
  ...
# Subtest: a próxima operação é a mais antiga; nada atrás de uma espera é enviado antes dela
ok 24 - a próxima operação é a mais antiga; nada atrás de uma espera é enviado antes dela
  ---
  duration_ms: 0.342836
  type: 'test'
  ...
# Subtest: operação que precisa de decisão humana não bloqueia o resto da fila
ok 25 - operação que precisa de decisão humana não bloqueia o resto da fila
  ---
  duration_ms: 0.156776
  type: 'test'
  ...
# Subtest: espera de reenvio cresce e tem teto (2s, 4s, 8s… máximo 5 min)
ok 26 - espera de reenvio cresce e tem teto (2s, 4s, 8s… máximo 5 min)
  ---
  duration_ms: 0.138685
  type: 'test'
  ...
# Subtest: erro de rede volta para a fila com espera crescente e guarda o motivo
ok 27 - erro de rede volta para a fila com espera crescente e guarda o motivo
  ---
  duration_ms: 0.242173
  type: 'test'
  ...
# Subtest: erro permanente para de tentar e aparece para a pessoa resolver
ok 28 - erro permanente para de tentar e aparece para a pessoa resolver
  ---
  duration_ms: 0.261332
  type: 'test'
  ...
# Subtest: conflito de versão vira estado 'conflito' com os dados para a pessoa decidir
ok 29 - conflito de versão vira estado 'conflito' com os dados para a pessoa decidir
  ---
  duration_ms: 0.136707
  type: 'test'
  ...
# Subtest: erros temporários do servidor continuam tentando (401, 429 e 5xx)
ok 30 - erros temporários do servidor continuam tentando (401, 429 e 5xx)
  ---
  duration_ms: 0.26256
  type: 'test'
  ...
# Subtest: sucesso tira a operação da fila e marca o 'tudo sincronizado' quando esvazia
ok 31 - sucesso tira a operação da fila e marca o 'tudo sincronizado' quando esvazia
  ---
  duration_ms: 0.411435
  type: 'test'
  ...
# Subtest: app fechado no meio do envio: 'enviando' volta para a fila em vez de ficar preso
ok 32 - app fechado no meio do envio: 'enviando' volta para a fila em vez de ficar preso
  ---
  duration_ms: 1.547296
  type: 'test'
  ...
# Subtest: retentar volta a operação para a fila; descartar remove de vez
ok 33 - retentar volta a operação para a fila; descartar remove de vez
  ---
  duration_ms: 0.324073
  type: 'test'
  ...
# Subtest: retentar mantém o erro de conflito guardado (a tela precisa das duas versões)
ok 34 - retentar mantém o erro de conflito guardado (a tela precisa das duas versões)
  ---
  duration_ms: 0.16979
  type: 'test'
  ...
# Subtest: resumo da fila fala a língua da pessoa e prioriza o que precisa de decisão
ok 35 - resumo da fila fala a língua da pessoa e prioriza o que precisa de decisão
  ---
  duration_ms: 0.314473
  type: 'test'
  ...
# Subtest: roteiro na fila: criar e concluir atividade funcionam offline e preservam a ordem
ok 36 - roteiro na fila: criar e concluir atividade funcionam offline e preservam a ordem
  ---
  duration_ms: 0.139977
  type: 'test'
  ...
# Subtest: operação criada durante a passada não é perdida pela gravação do fim
ok 37 - operação criada durante a passada não é perdida pela gravação do fim
  ---
  duration_ms: 0.172243
  type: 'test'
  ...
# Subtest: estado mais novo da passada vale, mas o que chegou depois é preservado na ordem
ok 38 - estado mais novo da passada vale, mas o que chegou depois é preservado na ordem
  ---
  duration_ms: 0.135597
  type: 'test'
  ...
# Subtest: operação que falhou na passada mantém o erro registrado no aparelho
ok 39 - operação que falhou na passada mantém o erro registrado no aparelho
  ---
  duration_ms: 0.146581
  type: 'test'
  ...
# Subtest: offline: nada é enviado, a fila fica intacta e o relatório diz por quê
ok 40 - offline: nada é enviado, a fila fica intacta e o relatório diz por quê
  ---
  duration_ms: 1.808405
  type: 'test'
  ...
# Subtest: online com fila vazia: só busca o que mudou e guarda o cursor
ok 41 - online com fila vazia: só busca o que mudou e guarda o cursor
  ---
  duration_ms: 1.3367
  type: 'test'
  ...
# Subtest: envia na ordem de criação e busca de novo depois para a carga refletir o servidor
ok 42 - envia na ordem de criação e busca de novo depois para a carga refletir o servidor
  ---
  duration_ms: 3.587171
  type: 'test'
  ...
# Subtest: a chave de idempotência enviada é o id da operação: reenvio nunca duplica
ok 43 - a chave de idempotência enviada é o id da operação: reenvio nunca duplica
  ---
  duration_ms: 1.349872
  type: 'test'
  ...
# Subtest: falha de rede para a passada e preserva a ordem (nada fura a fila)
ok 44 - falha de rede para a passada e preserva a ordem (nada fura a fila)
  ---
  duration_ms: 0.544745
  type: 'test'
  ...
# Subtest: exceção na chamada (queda total) é tratada como problema de rede, não como sucesso
ok 45 - exceção na chamada (queda total) é tratada como problema de rede, não como sucesso
  ---
  duration_ms: 0.54161
  type: 'test'
  ...
# Subtest: regra de negócio violada não fica tentando e não trava as outras alterações
ok 46 - regra de negócio violada não fica tentando e não trava as outras alterações
  ---
  duration_ms: 0.985182
  type: 'test'
  ...
# Subtest: conflito de versão para o envio e vira decisão da pessoa, sem sobrescrever nada
ok 47 - conflito de versão para o envio e vira decisão da pessoa, sem sobrescrever nada
  ---
  duration_ms: 0.585215
  type: 'test'
  ...
# Subtest: se a busca falha, o envio ainda é tentado e o relatório não mente
ok 48 - se a busca falha, o envio ainda é tentado e o relatório não mente
  ---
  duration_ms: 0.969254
  type: 'test'
  ...
# Subtest: a passada grava a fila dentro da seção crítica do armazenamento (nunca ler-depois-gravar)
ok 49 - a passada grava a fila dentro da seção crítica do armazenamento (nunca ler-depois-gravar)
  ---
  duration_ms: 1.072092
  type: 'test'
  ...
1..49
# tests 49
# suites 0
# pass 49
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 486.513818


> lia-go@0.1.0 test:app
> npm run test --workspace @lia-go/mobile


> @lia-go/mobile@0.1.0 test
> node --test "tests/*.test.ts"

TAP version 13
# Subtest: IndexedDB real (simulado em memória) grava, lê e apaga
ok 1 - IndexedDB real (simulado em memória) grava, lê e apaga
  ---
  duration_ms: 13.267646
  type: 'test'
  ...
# Subtest: a fila volta do aparelho exatamente como foi guardada (fechar o app não perde nada)
ok 2 - a fila volta do aparelho exatamente como foi guardada (fechar o app não perde nada)
  ---
  duration_ms: 3.198097
  type: 'test'
  ...
# Subtest: carga e cursor sobrevivem ao reinício e o cursor aceita nulo
ok 3 - carga e cursor sobrevivem ao reinício e o cursor aceita nulo
  ---
  duration_ms: 0.942372
  type: 'test'
  ...
# Subtest: dado estragado no aparelho não derruba o app: vira fila vazia
ok 4 - dado estragado no aparelho não derruba o app: vira fila vazia
  ---
  duration_ms: 0.283422
  type: 'test'
  ...
# Subtest: limpar apaga tudo do aparelho (usado ao sair da conta)
ok 5 - limpar apaga tudo do aparelho (usado ao sair da conta)
  ---
  duration_ms: 5.595211
  type: 'test'
  ...
# Subtest: escolha do armazenamento: nativo usa o do app; navegador usa IndexedDB; sem nenhum, memória
ok 6 - escolha do armazenamento: nativo usa o do app; navegador usa IndexedDB; sem nenhum, memória
  ---
  duration_ms: 0.383608
  type: 'test'
  ...
# Subtest: mutar é atômico: duas transformações ao mesmo tempo não se atropelam
ok 7 - mutar é atômico: duas transformações ao mesmo tempo não se atropelam
  ---
  duration_ms: 3.225297
  type: 'test'
  ...
# Subtest: transformar a fila acontece dentro da seção crítica do armazenamento
ok 8 - transformar a fila acontece dentro da seção crítica do armazenamento
  ---
  duration_ms: 0.346822
  type: 'test'
  ...
# Subtest: a passada preserva o que entrou durante ela e descarta o que ela mesma enviou
ok 9 - a passada preserva o que entrou durante ela e descarta o que ela mesma enviou
  ---
  duration_ms: 3.851752
  type: 'test'
  ...
# Subtest: custo desconhecido não vira número: fica omitido (e nunca R$ 0,00)
ok 10 - custo desconhecido não vira número: fica omitido (e nunca R$ 0,00)
  ---
  duration_ms: 0.980015
  type: 'test'
  ...
# Subtest: custo gratuito é zero explícito, com rótulo que explica o zero
ok 11 - custo gratuito é zero explícito, com rótulo que explica o zero
  ---
  duration_ms: 0.46825
  type: 'test'
  ...
# Subtest: estimativa e compromisso aparecem com o valor, sem inventar rótulo
ok 12 - estimativa e compromisso aparecem com o valor, sem inventar rótulo
  ---
  duration_ms: 0.216553
  type: 'test'
  ...
# Subtest: deslocamento é compacto: só mostra o que foi informado
ok 13 - deslocamento é compacto: só mostra o que foi informado
  ---
  duration_ms: 0.337199
  type: 'test'
  ...
# Subtest: duração não inventa zero: sem duração não há texto
ok 14 - duração não inventa zero: sem duração não há texto
  ---
  duration_ms: 0.265413
  type: 'test'
  ...
# Subtest: dia do roteiro é legível em pt-BR e não escorrega de dia por fuso
ok 15 - dia do roteiro é legível em pt-BR e não escorrega de dia por fuso
  ---
  duration_ms: 17.809632
  type: 'test'
  ...
# Subtest: estado da atividade tem rótulo textual (nunca só a cor do marcador)
ok 16 - estado da atividade tem rótulo textual (nunca só a cor do marcador)
  ---
  duration_ms: 0.256316
  type: 'test'
  ...
# Subtest: atividade sem horário diz que é flexível — nunca inventa uma hora
ok 17 - atividade sem horário diz que é flexível — nunca inventa uma hora
  ---
  duration_ms: 1.067634
  type: 'test'
  ...
# Subtest: cartão mostra só o contexto que existe: local e duração ausentes não aparecem
ok 18 - cartão mostra só o contexto que existe: local e duração ausentes não aparecem
  ---
  duration_ms: 0.737869
  type: 'test'
  ...
# Subtest: custo desconhecido fica omitido; a verificar aparece sinalizado (nunca R$ 0,00)
ok 19 - custo desconhecido fica omitido; a verificar aparece sinalizado (nunca R$ 0,00)
  ---
  duration_ms: 0.29572
  type: 'test'
  ...
# Subtest: custo conhecido aparece com a natureza ao lado, na linha do valor
ok 20 - custo conhecido aparece com a natureza ao lado, na linha do valor
  ---
  duration_ms: 0.44735
  type: 'test'
  ...
# Subtest: gratuito é zero explícito e rotulado — diferente de desconhecido
ok 21 - gratuito é zero explícito e rotulado — diferente de desconhecido
  ---
  duration_ms: 0.177492
  type: 'test'
  ...
# Subtest: sem custo informado não recebe rótulo nenhum
ok 22 - sem custo informado não recebe rótulo nenhum
  ---
  duration_ms: 0.117872
  type: 'test'
  ...
# Subtest: conflito tem manchete própria, explicando o tipo
ok 23 - conflito tem manchete própria, explicando o tipo
  ---
  duration_ms: 0.168473
  type: 'test'
  ...
# Subtest: trecho de deslocamento: compacto por padrão, aberto quando é longo, caro ou arriscado
ok 24 - trecho de deslocamento: compacto por padrão, aberto quando é longo, caro ou arriscado
  ---
  duration_ms: 0.212048
  type: 'test'
  ...
# Subtest: resumo do dia: atenção só para o que exige decisão, e o previsto só quando existe
ok 25 - resumo do dia: atenção só para o que exige decisão, e o previsto só quando existe
  ---
  duration_ms: 0.453284
  type: 'test'
  ...
# Subtest: resumo do dia com uma atividade não usa plural torto
ok 26 - resumo do dia com uma atividade não usa plural torto
  ---
  duration_ms: 0.372702
  type: 'test'
  ...
# Subtest: cartão aceita a atividade na forma do servidor e na forma do domínio (a tela não fica em branco)
ok 27 - cartão aceita a atividade na forma do servidor e na forma do domínio (a tela não fica em branco)
  ---
  duration_ms: 0.297858
  type: 'test'
  ...
# Subtest: atividade sem campo de custo nenhum não vira R$ 0,00 nem derruba o cartão
ok 28 - atividade sem campo de custo nenhum não vira R$ 0,00 nem derruba o cartão
  ---
  duration_ms: 0.196271
  type: 'test'
  ...
# Subtest: custoDoCartao: forma do servidor, forma do domínio e nada — sem inventar zero
ok 29 - custoDoCartao: forma do servidor, forma do domínio e nada — sem inventar zero
  ---
  duration_ms: 0.174572
  type: 'test'
  ...
# Subtest: offline: a despesa fica na fila com o texto certo e a fila sobrevive ao reinício
ok 30 - offline: a despesa fica na fila com o texto certo e a fila sobrevive ao reinício
  ---
  duration_ms: 16.954436
  type: 'test'
  ...
# Subtest: a rede voltou: a fila é enviada e o cache passa a refletir o servidor
ok 31 - a rede voltou: a fila é enviada e o cache passa a refletir o servidor
  ---
  duration_ms: 13.494801
  type: 'test'
  ...
# Subtest: cada reenvio usa a MESMA chave de idempotência (o servidor nunca aplica duas vezes)
ok 32 - cada reenvio usa a MESMA chave de idempotência (o servidor nunca aplica duas vezes)
  ---
  duration_ms: 2109.899092
  type: 'test'
  ...
# Subtest: conflito de versão: a pessoa escolhe, e 'manter o que fiz' reaplica sobre a versão atual
ok 33 - conflito de versão: a pessoa escolhe, e 'manter o que fiz' reaplica sobre a versão atual
  ---
  duration_ms: 11.433143
  type: 'test'
  ...
# Subtest: conflito: 'usar a versão do servidor' descarta a alteração do aparelho
ok 34 - conflito: 'usar a versão do servidor' descarta a alteração do aparelho
  ---
  duration_ms: 8.466466
  type: 'test'
  ...
# Subtest: regra de negócio recusada para de tentar, mas não trava as outras alterações
ok 35 - regra de negócio recusada para de tentar, mas não trava as outras alterações
  ---
  duration_ms: 7.032505
  type: 'test'
  ...
# Subtest: limpar dados deste aparelho apaga fila e cache, e a tela reflete na hora
ok 36 - limpar dados deste aparelho apaga fila e cache, e a tela reflete na hora
  ---
  duration_ms: 13.877444
  type: 'test'
  ...
# Subtest: cinco pedidos durante uma passada viram uma passada seguinte, não cinco
ok 37 - cinco pedidos durante uma passada viram uma passada seguinte, não cinco
  ---
  duration_ms: 7.805269
  type: 'test'
  ...
# Subtest: reserva criada offline sobe quando a rede volta e entra no cache como as outras entidades
ok 38 - reserva criada offline sobe quando a rede volta e entra no cache como as outras entidades
  ---
  duration_ms: 7.681719
  type: 'test'
  ...
# Subtest: checklist do aparelho só entra na viagem aberta e item estragado é ignorado
ok 39 - checklist do aparelho só entra na viagem aberta e item estragado é ignorado
  ---
  duration_ms: 3.219277
  type: 'test'
  ...
# Subtest: cache da viagem antiga não aparece na viagem nova
ok 40 - cache da viagem antiga não aparece na viagem nova
  ---
  duration_ms: 0.380239
  type: 'test'
  ...
# Subtest: viagem aberta entrega o detalhe e só as atividades dela
ok 41 - viagem aberta entrega o detalhe e só as atividades dela
  ---
  duration_ms: 0.42594
  type: 'test'
  ...
# Subtest: permissão ausente ou incompleta nunca libera ação
ok 42 - permissão ausente ou incompleta nunca libera ação
  ---
  duration_ms: 0.213087
  type: 'test'
  ...
# Subtest: atividade vinda do servidor vira a forma do domínio (dinheiro em centavos, nada de float)
ok 43 - atividade vinda do servidor vira a forma do domínio (dinheiro em centavos, nada de float)
  ---
  duration_ms: 0.520693
  type: 'test'
  ...
# Subtest: atividade estragada no cache é ignorada, não derruba a tela
ok 44 - atividade estragada no cache é ignorada, não derruba a tela
  ---
  duration_ms: 0.226742
  type: 'test'
  ...
# Subtest: atividadesDoDominio pega só as atividades da viagem aberta
ok 45 - atividadesDoDominio pega só as atividades da viagem aberta
  ---
  duration_ms: 0.432301
  type: 'test'
  ...
# Subtest: reserva de outra viagem não entra na tela (e a viagem aberta entrega as reservas dela)
ok 46 - reserva de outra viagem não entra na tela (e a viagem aberta entrega as reservas dela)
  ---
  duration_ms: 0.277813
  type: 'test'
  ...
# Subtest: cache antigo, sem a lista de reservas, continua abrindo a viagem (quem atualiza tem cache velho)
ok 47 - cache antigo, sem a lista de reservas, continua abrindo a viagem (quem atualiza tem cache velho)
  ---
  duration_ms: 0.702565
  type: 'test'
  ...
# Subtest: o próximo compromisso ignora o que passou e o que não vale mais
ok 48 - o próximo compromisso ignora o que passou e o que não vale mais
  ---
  duration_ms: 2.220464
  type: 'test'
  ...
# Subtest: o 'quando' do compromisso fala hoje, amanhã ou a data
ok 49 - o 'quando' do compromisso fala hoje, amanhã ou a data
  ---
  duration_ms: 0.684057
  type: 'test'
  ...
1..49
# tests 49
# suites 0
# pass 49
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2976.612713


> lia-go@0.1.0 test:ui
> node tools/teste-ui.mjs

TAP version 13
# Subtest: concluir mostra a revisão de impacto antes do botão e diz que o saldo oficial não muda aqui
ok 1 - concluir mostra a revisão de impacto antes do botão e diz que o saldo oficial não muda aqui
  ---
  duration_ms: 179.368407
  type: 'test'
  ...
# Subtest: cancelar mostra quanto sai do previsto e que o histórico e as despesas ficam
ok 2 - cancelar mostra quanto sai do previsto e que o histórico e as despesas ficam
  ---
  duration_ms: 86.499182
  type: 'test'
  ...
# Subtest: sem digitar o motivo, cancelar avisa o que falta e não muda nada
ok 3 - sem digitar o motivo, cancelar avisa o que falta e não muda nada
  ---
  duration_ms: 99.860356
  type: 'test'
  ...
# Subtest: atividade vinculada mostra a reserva e avisa que prevista não é confirmada
ok 4 - atividade vinculada mostra a reserva e avisa que prevista não é confirmada
  ---
  duration_ms: 88.85031
  type: 'test'
  ...
# Subtest: reserva confirmada mostra a evidência que existe — sem inventar localizador
ok 5 - reserva confirmada mostra a evidência que existe — sem inventar localizador
  ---
  duration_ms: 89.238513
  type: 'test'
  ...
# Subtest: atividade aponta para reserva que ainda não está no aparelho: a tela diz isso, não inventa
ok 6 - atividade aponta para reserva que ainda não está no aparelho: a tela diz isso, não inventa
  ---
  duration_ms: 77.237746
  type: 'test'
  ...
# Subtest: corrigir a observação pela ficha: vale na hora e sobe com o motivo
ok 7 - corrigir a observação pela ficha: vale na hora e sobe com o motivo
  ---
  duration_ms: 118.103161
  type: 'test'
  ...
# Subtest: criar atividade com observação e reserva: o cartão do roteiro já diz que a reserva é prevista
ok 8 - criar atividade com observação e reserva: o cartão do roteiro já diz que a reserva é prevista
  ---
  duration_ms: 94.954334
  type: 'test'
  ...
# Subtest: item atrasado aparece como atrasado e continua em aberto (o prazo não conclui nada)
ok 9 - item atrasado aparece como atrasado e continua em aberto (o prazo não conclui nada)
  ---
  duration_ms: 177.901559
  type: 'test'
  ...
# Subtest: concluir registra quem marcou e reabrir exige motivo
ok 10 - concluir registra quem marcou e reabrir exige motivo
  ---
  duration_ms: 102.849768
  type: 'test'
  ...
# Subtest: item criado sem rede fica na fila do aparelho e aparece na hora
ok 11 - item criado sem rede fica na fila do aparelho e aparece na hora
  ---
  duration_ms: 96.06514
  type: 'test'
  ...
# Subtest: documento novo nasce privado e a tela explica a privacidade
ok 12 - documento novo nasce privado e a tela explica a privacidade
  ---
  duration_ms: 212.734387
  type: 'test'
  ...
# Subtest: compartilhar mostra o impacto antes e não promete cópia do arquivo
ok 13 - compartilhar mostra o impacto antes e não promete cópia do arquivo
  ---
  duration_ms: 61.135139
  type: 'test'
  ...
# Subtest: remover exige motivo e diz que o registro continua guardado
ok 14 - remover exige motivo e diz que o registro continua guardado
  ---
  duration_ms: 68.069547
  type: 'test'
  ...
# Subtest: o fechamento traz os números do servidor, com o acerto como sugestão
ok 15 - o fechamento traz os números do servidor, com o acerto como sugestão
  ---
  duration_ms: 184.356176
  type: 'test'
  ...
# Not implemented: navigation to another Document
# Not implemented: navigation to another Document
# Subtest: exportar gera o arquivo no navegador e não muda nada nos registros
ok 16 - exportar gera o arquivo no navegador e não muda nada nos registros
  ---
  duration_ms: 67.959238
  type: 'test'
  ...
# Subtest: sem servidor, a tela diz que o fechamento precisa dele (nada de conta velha)
ok 17 - sem servidor, a tela diz que o fechamento precisa dele (nada de conta velha)
  ---
  duration_ms: 48.008459
  type: 'test'
  ...
# Subtest: a Visão geral traz o hero com a Lia e o próximo compromisso que ainda vai acontecer
ok 18 - a Visão geral traz o hero com a Lia e o próximo compromisso que ainda vai acontecer
  ---
  duration_ms: 158.78766
  type: 'test'
  ...
# Subtest: sem nada à frente, a tela diz que não há compromisso (nada inventado)
ok 19 - sem nada à frente, a tela diz que não há compromisso (nada inventado)
  ---
  duration_ms: 90.606546
  type: 'test'
  ...
# Subtest: o aviso da tela inicial conta o mesmo que a central (e abre a central)
ok 20 - o aviso da tela inicial conta o mesmo que a central (e abre a central)
  ---
  duration_ms: 143.03815
  type: 'test'
  ...
# Subtest: prioridade é texto, não cor: o item de urgência diz 'Alta prioridade'
ok 21 - prioridade é texto, não cor: o item de urgência diz 'Alta prioridade'
  ---
  duration_ms: 34.628842
  type: 'test'
  ...
# Subtest: ler não resolve: marcar como lida tira de 'não lidas' e o item continua aberto
ok 22 - ler não resolve: marcar como lida tira de 'não lidas' e o item continua aberto
  ---
  duration_ms: 92.63183
  type: 'test'
  ...
# Subtest: dispensar tira da lista de abertas e o filtro 'Dispensadas' traz de volta
ok 23 - dispensar tira da lista de abertas e o filtro 'Dispensadas' traz de volta
  ---
  duration_ms: 50.32123
  type: 'test'
  ...
# Subtest: dispensar não esconde problema que piora: 2 pendências viram 3 e a notificação volta
ok 24 - dispensar não esconde problema que piora: 2 pendências viram 3 e a notificação volta
  ---
  duration_ms: 58.175143
  type: 'test'
  ...
# Subtest: ao voltar para o app, a central mostra o que mudou no servidor
ok 25 - ao voltar para o app, a central mostra o que mudou no servidor
  ---
  duration_ms: 59.46676
  type: 'test'
  ...
# Subtest: o item leva para a viagem na aba certa (despesa pendente abre Gastos)
ok 26 - o item leva para a viagem na aba certa (despesa pendente abre Gastos)
  ---
  duration_ms: 61.46857
  type: 'test'
  ...
# Subtest: 'só o que depende de mim' deixa de fora o que é do grupo
ok 27 - 'só o que depende de mim' deixa de fora o que é do grupo
  ---
  duration_ms: 45.605274
  type: 'test'
  ...
# Subtest: a central diz o que alcança e como voltar (nada de tela sem saída)
ok 28 - a central diz o que alcança e como voltar (nada de tela sem saída)
  ---
  duration_ms: 36.624016
  type: 'test'
  ...
# Subtest: com limite, a barra aparece e o previsto se compara ao combinado em texto
ok 29 - com limite, a barra aparece e o previsto se compara ao combinado em texto
  ---
  duration_ms: 185.114979
  type: 'test'
  ...
# Subtest: no limite de atenção a tela avisa; passando dele, diz que passou
ok 30 - no limite de atenção a tela avisa; passando dele, diz que passou
  ---
  duration_ms: 131.521474
  type: 'test'
  ...
# Subtest: sem limite, a tela explica que o teto é planejamento e oferece definir
ok 31 - sem limite, a tela explica que o teto é planejamento e oferece definir
  ---
  duration_ms: 78.555184
  type: 'test'
  ...
# Subtest: participante não define o limite do grupo: a tela diz de quem é a ação
ok 32 - participante não define o limite do grupo: a tela diz de quem é a ação
  ---
  duration_ms: 79.023898
  type: 'test'
  ...
# Subtest: reserva aparece com o valor previsto e o desconhecido como 'Valor a verificar'
ok 33 - reserva aparece com o valor previsto e o desconhecido como 'Valor a verificar'
  ---
  duration_ms: 188.758933
  type: 'test'
  ...
# Subtest: confirmar sem evidência avisa e não muda nada; com evidência, registra quem confirmou
ok 34 - confirmar sem evidência avisa e não muda nada; com evidência, registra quem confirmou
  ---
  duration_ms: 165.549076
  type: 'test'
  ...
# Subtest: cancelar mostra que o app não cancela no fornecedor e exige motivo
ok 35 - cancelar mostra que o app não cancela no fornecedor e exige motivo
  ---
  duration_ms: 76.819064
  type: 'test'
  ...
# Subtest: criar reserva entra como prevista, com o valor combinado separado da estimativa
ok 36 - criar reserva entra como prevista, com o valor combinado separado da estimativa
  ---
  duration_ms: 122.009811
  type: 'test'
  ...
# Subtest: abrir a viagem nova mostra a viagem nova, não a que estava aberta antes
ok 37 - abrir a viagem nova mostra a viagem nova, não a que estava aberta antes
  ---
  duration_ms: 151.269867
  type: 'test'
  ...
# Subtest: depois de abrir a viagem nova, o roteiro dela não mostra atividade da viagem antiga
ok 38 - depois de abrir a viagem nova, o roteiro dela não mostra atividade da viagem antiga
  ---
  duration_ms: 44.388137
  type: 'test'
  ...
# Subtest: o botão Sair encerra a sessão na tela e apaga o que estava guardado no aparelho
ok 39 - o botão Sair encerra a sessão na tela e apaga o que estava guardado no aparelho
  ---
  duration_ms: 25.920557
  type: 'test'
  ...
# Subtest: Sair funciona mesmo se o servidor não responder (ninguém fica preso dentro do app)
ok 40 - Sair funciona mesmo se o servidor não responder (ninguém fica preso dentro do app)
  ---
  duration_ms: 27.43236
  type: 'test'
  ...
# Subtest: rede instável: a viagem criada abre sozinha quando a confirmação chega (sem mentir no meio)
ok 41 - rede instável: a viagem criada abre sozinha quando a confirmação chega (sem mentir no meio)
  ---
  duration_ms: 9059.947413
  type: 'test'
  ...
# Subtest: criar viagem já abre a viagem criada (rascunho precisa dos próximos passos)
ok 42 - criar viagem já abre a viagem criada (rascunho precisa dos próximos passos)
  ---
  duration_ms: 50.854052
  type: 'test'
  ...
# Subtest: aba Gastos mostra o previsto do roteiro separado do dinheiro oficial
ok 43 - aba Gastos mostra o previsto do roteiro separado do dinheiro oficial
  ---
  duration_ms: 70.37313
  type: 'test'
  ...
# Subtest: a marca é o pino oficial com o nome escrito — desenho não substitui texto
ok 44 - a marca é o pino oficial com o nome escrito — desenho não substitui texto
  ---
  duration_ms: 18.584946
  type: 'test'
  ...
# Subtest: a barra inferior tem ícone **e** rótulo, e diz qual aba está ativa por texto
ok 45 - a barra inferior tem ícone **e** rótulo, e diz qual aba está ativa por texto
  ---
  duration_ms: 54.679666
  type: 'test'
  ...
1..45
# tests 45
# suites 0
# pass 45
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 31010.251032


> lia-go@0.1.0 test:api
> npm run test --workspace @lia-go/api


> @lia-go/api@0.1.0 test
> node --env-file-if-exists=../../.env --test --test-concurrency=1 "tests/*.test.ts"

TAP version 13
# Subtest: registro cria conta, valida senha e não deixa e-mail duplicado
ok 1 - registro cria conta, valida senha e não deixa e-mail duplicado
  ---
  duration_ms: 363.694936
  type: 'test'
  ...
# Subtest: login responde igual para senha errada e e-mail inexistente
ok 2 - login responde igual para senha errada e e-mail inexistente
  ---
  duration_ms: 215.215613
  type: 'test'
  ...
# Subtest: limite de tentativas bloqueia força bruta com 429
ok 3 - limite de tentativas bloqueia força bruta com 429
  ---
  duration_ms: 1092.419163
  type: 'test'
  ...
# Subtest: sessão web funciona por cookie e é encerrada no logout
ok 4 - sessão web funciona por cookie e é encerrada no logout
  ---
  duration_ms: 101.875574
  type: 'test'
  ...
# Subtest: app nativo recebe access e refresh token; refresh é rotativo
ok 5 - app nativo recebe access e refresh token; refresh é rotativo
  ---
  duration_ms: 231.929134
  type: 'test'
  ...
# Subtest: revogar sessões encerra tudo de uma vez
ok 6 - revogar sessões encerra tudo de uma vez
  ---
  duration_ms: 199.735373
  type: 'test'
  ...
# Subtest: saúde da API responde e exige banco de verdade
ok 7 - saúde da API responde e exige banco de verdade
  ---
  duration_ms: 1.475888
  type: 'test'
  ...
# Subtest: item nasce aberto, com responsável e prazo opcionais
ok 8 - item nasce aberto, com responsável e prazo opcionais
  ---
  duration_ms: 407.680269
  type: 'test'
  ...
# Subtest: responsável precisa participar da viagem
ok 9 - responsável precisa participar da viagem
  ---
  duration_ms: 305.3924
  type: 'test'
  ...
# Subtest: prazo vencido continua aberto: quem conclui é uma pessoa, não o calendário
ok 10 - prazo vencido continua aberto: quem conclui é uma pessoa, não o calendário
  ---
  duration_ms: 218.145176
  type: 'test'
  ...
# Subtest: concluir registra quem e quando; reabrir exige motivo e fica no histórico
ok 11 - concluir registra quem e quando; reabrir exige motivo e fica no histórico
  ---
  duration_ms: 236.856212
  type: 'test'
  ...
# Subtest: o banco recusa item feito sem autor e reabertura com motivo curto
ok 12 - o banco recusa item feito sem autor e reabertura com motivo curto
  ---
  duration_ms: 221.910684
  type: 'test'
  ...
# Subtest: conflito de versão impede conclusão em cima de mudança que a pessoa não viu
ok 13 - conflito de versão impede conclusão em cima de mudança que a pessoa não viu
  ---
  duration_ms: 246.129873
  type: 'test'
  ...
# Subtest: a sincronização devolve item criado e concluído pelo cursor
ok 14 - a sincronização devolve item criado e concluído pelo cursor
  ---
  duration_ms: 265.58658
  type: 'test'
  ...
# Subtest: viagem cancelada não recebe item novo, mas fechar o que existia continua valendo
ok 15 - viagem cancelada não recebe item novo, mas fechar o que existia continua valendo
  ---
  duration_ms: 244.331883
  type: 'test'
  ...
# Subtest: despesa nasce pendente, com rateio exato e sem entrar no saldo oficial
ok 16 - despesa nasce pendente, com rateio exato e sem entrar no saldo oficial
  ---
  duration_ms: 481.324015
  type: 'test'
  ...
# Subtest: divisão de centavos ímpar entre 3 pessoas soma exatamente o total
ok 17 - divisão de centavos ímpar entre 3 pessoas soma exatamente o total
  ---
  duration_ms: 361.945077
  type: 'test'
  ...
# Subtest: quem lançou não confirma o próprio lançamento (regra garantida no servidor)
ok 18 - quem lançou não confirma o próprio lançamento (regra garantida no servidor)
  ---
  duration_ms: 230.881176
  type: 'test'
  ...
# Subtest: saldo oficial e sugestão de acerto só com despesa confirmada
ok 19 - saldo oficial e sugestão de acerto só com despesa confirmada
  ---
  duration_ms: 258.733633
  type: 'test'
  ...
# Subtest: contestação mantém a despesa visível e fora do saldo oficial até resolver
ok 20 - contestação mantém a despesa visível e fora do saldo oficial até resolver
  ---
  duration_ms: 292.716678
  type: 'test'
  ...
# Subtest: correção exige motivo, volta para pendente e preserva o histórico antes/depois
ok 21 - correção exige motivo, volta para pendente e preserva o histórico antes/depois
  ---
  duration_ms: 259.210987
  type: 'test'
  ...
# Subtest: participante que saiu não pode mais lançar despesa
ok 22 - participante que saiu não pode mais lançar despesa
  ---
  duration_ms: 228.656088
  type: 'test'
  ...
# Subtest: viagem cancelada bloqueia despesa nova e mantém correção possível
ok 23 - viagem cancelada bloqueia despesa nova e mantém correção possível
  ---
  duration_ms: 251.126761
  type: 'test'
  ...
# Subtest: rateio percentual e por valores são validados no servidor
ok 24 - rateio percentual e por valores são validados no servidor
  ---
  duration_ms: 375.865816
  type: 'test'
  ...
# Subtest: acerto: informado não altera saldo; recebedor confirma e zera
ok 25 - acerto: informado não altera saldo; recebedor confirma e zera
  ---
  duration_ms: 252.946657
  type: 'test'
  ...
# Subtest: chave de idempotência evita lançamento duplicado em reenvio de rede
ok 26 - chave de idempotência evita lançamento duplicado em reenvio de rede
  ---
  duration_ms: 247.572252
  type: 'test'
  ...
# Subtest: autorização negativa: estranho não vê despesas nem saldos de viagem alheia
ok 27 - autorização negativa: estranho não vê despesas nem saldos de viagem alheia
  ---
  duration_ms: 361.658565
  type: 'test'
  ...
# Subtest: documento nasce privado: só quem criou vê, nem o organizador vê
ok 28 - documento nasce privado: só quem criou vê, nem o organizador vê
  ---
  duration_ms: 435.885552
  type: 'test'
  ...
# Subtest: a lista explica a privacidade com o mesmo texto da tela
ok 29 - a lista explica a privacidade com o mesmo texto da tela
  ---
  duration_ms: 238.469684
  type: 'test'
  ...
# Subtest: link precisa ser http(s); sem link o documento ainda vale
ok 30 - link precisa ser http(s); sem link o documento ainda vale
  ---
  duration_ms: 261.098403
  type: 'test'
  ...
# Subtest: compartilhar é passo separado: com a viagem ou com pessoas, e chega na sincronização
ok 31 - compartilhar é passo separado: com a viagem ou com pessoas, e chega na sincronização
  ---
  duration_ms: 384.846908
  type: 'test'
  ...
# Subtest: revogar acesso tira da lista de quem perdeu o acesso
ok 32 - revogar acesso tira da lista de quem perdeu o acesso
  ---
  duration_ms: 235.391093
  type: 'test'
  ...
# Subtest: quem não pode ver não age — nem o organizador em documento privado alheio
ok 33 - quem não pode ver não age — nem o organizador em documento privado alheio
  ---
  duration_ms: 362.014151
  type: 'test'
  ...
# Subtest: documento compartilhado com a viagem pode ser cuidado por quem organiza
ok 34 - documento compartilhado com a viagem pode ser cuidado por quem organiza
  ---
  duration_ms: 222.780628
  type: 'test'
  ...
# Subtest: remover exige motivo, vira remoção lógica e sai da lista de todo mundo menos do organizador
ok 35 - remover exige motivo, vira remoção lógica e sai da lista de todo mundo menos do organizador
  ---
  duration_ms: 220.769768
  type: 'test'
  ...
# Subtest: quem perdeu o acesso recebe aviso para apagar a cópia guardada no aparelho
ok 36 - quem perdeu o acesso recebe aviso para apagar a cópia guardada no aparelho
  ---
  duration_ms: 242.58526
  type: 'test'
  ...
# Subtest: o aviso de apagar não revela documento que a pessoa nunca viu
ok 37 - o aviso de apagar não revela documento que a pessoa nunca viu
  ---
  duration_ms: 337.988172
  type: 'test'
  ...
# Subtest: impacto é mostrado antes de compartilhar ou remover
ok 38 - impacto é mostrado antes de compartilhar ou remover
  ---
  duration_ms: 210.076857
  type: 'test'
  ...
# Subtest: conflito de versão protege quem está com a lista antiga na tela
ok 39 - conflito de versão protege quem está com a lista antiga na tela
  ---
  duration_ms: 254.883264
  type: 'test'
  ...
# Subtest: viagem cancelada não aceita documento novo, mas remover o que existia continua valendo
ok 40 - viagem cancelada não aceita documento novo, mas remover o que existia continua valendo
  ---
  duration_ms: 241.423338
  type: 'test'
  ...
# Subtest: quem não participa da viagem não vê nem cria documento
ok 41 - quem não participa da viagem não vê nem cria documento
  ---
  duration_ms: 307.340072
  type: 'test'
  ...
# Subtest: sem limite, o orçamento diz que não há limite e separa planejamento do oficial
ok 42 - sem limite, o orçamento diz que não há limite e separa planejamento do oficial
  ---
  duration_ms: 401.566557
  type: 'test'
  ...
# Subtest: só quem organiza define o limite coletivo; qualquer pessoa define o próprio individual
ok 43 - só quem organiza define o limite coletivo; qualquer pessoa define o próprio individual
  ---
  duration_ms: 267.691538
  type: 'test'
  ...
# Subtest: o banco recusa limite coletivo com dono e limite individual sem dono
ok 44 - o banco recusa limite coletivo com dono e limite individual sem dono
  ---
  duration_ms: 238.517249
  type: 'test'
  ...
# Subtest: o previsto soma roteiro e reservas e conta o que ainda não tem valor
ok 45 - o previsto soma roteiro e reservas e conta o que ainda não tem valor
  ---
  duration_ms: 309.701491
  type: 'test'
  ...
# Subtest: fechamento: total oficial só de confirmadas, acertos sugeridos e CSV para planilha
ok 46 - fechamento: total oficial só de confirmadas, acertos sugeridos e CSV para planilha
  ---
  duration_ms: 263.766211
  type: 'test'
  ...
# Subtest: despesa pendente não entra no total oficial do fechamento (e o texto avisa)
ok 47 - despesa pendente não entra no total oficial do fechamento (e o texto avisa)
  ---
  duration_ms: 249.590332
  type: 'test'
  ...
# Subtest: quem não participa não vê orçamento nem fechamento
ok 48 - quem não participa não vê orçamento nem fechamento
  ---
  duration_ms: 345.234151
  type: 'test'
  ...
# Subtest: reserva nasce prevista, com valor tratado como estimativa e sem confirmação
ok 49 - reserva nasce prevista, com valor tratado como estimativa e sem confirmação
  ---
  duration_ms: 412.20073
  type: 'test'
  ...
# Subtest: sem valor informado, o custo é desconhecido (null) e fica marcado para verificar
ok 50 - sem valor informado, o custo é desconhecido (null) e fica marcado para verificar
  ---
  duration_ms: 227.034848
  type: 'test'
  ...
# Subtest: confirmar exige evidência e registra quem confirmou, com histórico
ok 51 - confirmar exige evidência e registra quem confirmou, com histórico
  ---
  duration_ms: 232.799419
  type: 'test'
  ...
# Subtest: confirmar de novo com versão antiga é conflito, não sobrescrita silenciosa
ok 52 - confirmar de novo com versão antiga é conflito, não sobrescrita silenciosa
  ---
  duration_ms: 249.039326
  type: 'test'
  ...
# Subtest: cancelar exige motivo, preserva a evidência e o banco recusa cancelamento sem motivo
ok 53 - cancelar exige motivo, preserva a evidência e o banco recusa cancelamento sem motivo
  ---
  duration_ms: 216.123477
  type: 'test'
  ...
# Subtest: viagem cancelada não recebe reserva nova, mas registrar o que houve com a existente continua valendo
ok 54 - viagem cancelada não recebe reserva nova, mas registrar o que houve com a existente continua valendo
  ---
  duration_ms: 243.010296
  type: 'test'
  ...
# Subtest: a sincronização devolve reserva criada e confirmada pelo cursor
ok 55 - a sincronização devolve reserva criada e confirmada pelo cursor
  ---
  duration_ms: 247.060669
  type: 'test'
  ...
# Subtest: quem não participa não vê reserva nenhuma
ok 56 - quem não participa não vê reserva nenhuma
  ---
  duration_ms: 303.614241
  type: 'test'
  ...
# Subtest: atividade nasce planejada, flexível quando não tem horário, e o roteiro volta por dia
ok 57 - atividade nasce planejada, flexível quando não tem horário, e o roteiro volta por dia
  ---
  duration_ms: 453.685747
  type: 'test'
  ...
# Subtest: custo: desconhecido não vira zero, 'a verificar' é sinalizado e gratuidade é explícita
ok 58 - custo: desconhecido não vira zero, 'a verificar' é sinalizado e gratuidade é explícita
  ---
  duration_ms: 271.92558
  type: 'test'
  ...
# Subtest: conflito aparece no resumo do dia e nas duas atividades, e ninguém remarca sozinho
ok 59 - conflito aparece no resumo do dia e nas duas atividades, e ninguém remarca sozinho
  ---
  duration_ms: 262.418137
  type: 'test'
  ...
# Subtest: deslocamento que não cabe vira conflito explicado (risco de perder o compromisso)
ok 60 - deslocamento que não cabe vira conflito explicado (risco de perder o compromisso)
  ---
  duration_ms: 213.467181
  type: 'test'
  ...
# Subtest: concluir é ação explícita: registra quem concluiu e quando; passar do horário não conclui
ok 61 - concluir é ação explícita: registra quem concluiu e quando; passar do horário não conclui
  ---
  duration_ms: 235.465312
  type: 'test'
  ...
# Subtest: cancelar e corrigir exigem motivo, versionam e ficam no histórico
ok 62 - cancelar e corrigir exigem motivo, versionam e ficam no histórico
  ---
  duration_ms: 250.283772
  type: 'test'
  ...
# Subtest: quem não participa não vê nem escreve no roteiro
ok 63 - quem não participa não vê nem escreve no roteiro
  ---
  duration_ms: 300.590056
  type: 'test'
  ...
# Subtest: viagem cancelada bloqueia atividade nova e libera correção do que já existe
ok 64 - viagem cancelada bloqueia atividade nova e libera correção do que já existe
  ---
  duration_ms: 245.056893
  type: 'test'
  ...
# Subtest: roteiro entra na sincronização incremental (funciona offline)
ok 65 - roteiro entra na sincronização incremental (funciona offline)
  ---
  duration_ms: 249.320905
  type: 'test'
  ...
# Subtest: reenvio com a mesma chave de idempotência não cria duas atividades
ok 66 - reenvio com a mesma chave de idempotência não cria duas atividades
  ---
  duration_ms: 217.748759
  type: 'test'
  ...
# Subtest: atividade guarda observação e nasce sem reserva quando ninguém vinculou
ok 67 - atividade guarda observação e nasce sem reserva quando ninguém vinculou
  ---
  duration_ms: 219.606124
  type: 'test'
  ...
# Subtest: vincular a atividade à reserva da viagem: o vínculo volta no roteiro, no detalhe e na sincronização
ok 68 - vincular a atividade à reserva da viagem: o vínculo volta no roteiro, no detalhe e na sincronização
  ---
  duration_ms: 231.036847
  type: 'test'
  ...
# Subtest: reserva de outra viagem é recusada e a atividade não é criada com vínculo cruzado
ok 69 - reserva de outra viagem é recusada e a atividade não é criada com vínculo cruzado
  ---
  duration_ms: 217.320693
  type: 'test'
  ...
# Subtest: reserva cancelada não vira vínculo de atividade
ok 70 - reserva cancelada não vira vínculo de atividade
  ---
  duration_ms: 229.179215
  type: 'test'
  ...
# Subtest: corrigir vincula e desvincula a reserva com motivo, sem mexer na reserva em si
ok 71 - corrigir vincula e desvincula a reserva com motivo, sem mexer na reserva em si
  ---
  duration_ms: 230.230617
  type: 'test'
  ...
# Subtest: corrigir a observação não apaga a reserva vinculada
ok 72 - corrigir a observação não apaga a reserva vinculada
  ---
  duration_ms: 228.753534
  type: 'test'
  ...
# Subtest: a primeira sincronização traz tudo e devolve um cursor de sequência
ok 73 - a primeira sincronização traz tudo e devolve um cursor de sequência
  ---
  duration_ms: 299.477475
  type: 'test'
  ...
# Subtest: sem nada novo, o app não recebe despesas para reprocessar
ok 74 - sem nada novo, o app não recebe despesas para reprocessar
  ---
  duration_ms: 137.57736
  type: 'test'
  ...
# Subtest: só o que mudou volta, e o cursor avança exatamente até a última mudança
ok 75 - só o que mudou volta, e o cursor avança exatamente até a última mudança
  ---
  duration_ms: 131.009824
  type: 'test'
  ...
# Subtest: confirmação de outra pessoa e aceite de convite aparecem no delta
ok 76 - confirmação de outra pessoa e aceite de convite aparecem no delta
  ---
  duration_ms: 235.990303
  type: 'test'
  ...
# Subtest: quem perdeu acesso à viagem não recebe mudanças
ok 77 - quem perdeu acesso à viagem não recebe mudanças
  ---
  duration_ms: 332.066908
  type: 'test'
  ...
# Subtest: resposta gigante é paginada: temMais avisa o app para continuar buscando
ok 78 - resposta gigante é paginada: temMais avisa o app para continuar buscando
  ---
  duration_ms: 1349.850817
  type: 'test'
  ...
# Subtest: cursor inválido é recusado com mensagem clara, não com erro interno
ok 79 - cursor inválido é recusado com mensagem clara, não com erro interno
  ---
  duration_ms: 98.613375
  type: 'test'
  ...
# Subtest: o delta devolve a despesa no mesmo formato da listagem (fonte única do dado)
ok 80 - o delta devolve a despesa no mesmo formato da listagem (fonte única do dado)
  ---
  duration_ms: 109.58052
  type: 'test'
  ...
# Subtest: viagem criada por outra pessoa aparece na lista; viagem alheia não
ok 81 - viagem criada por outra pessoa aparece na lista; viagem alheia não
  ---
  duration_ms: 300.119121
  type: 'test'
  ...
# Subtest: quem cria a viagem vira organizador e a viagem nasce como rascunho
ok 82 - quem cria a viagem vira organizador e a viagem nasce como rascunho
  ---
  duration_ms: 311.885938
  type: 'test'
  ...
# Subtest: acesso cruzado entre viagens é negado sem revelar a existência
ok 83 - acesso cruzado entre viagens é negado sem revelar a existência
  ---
  duration_ms: 220.11625
  type: 'test'
  ...
# Subtest: participante registra e propõe, mas não administra nem cancela
ok 84 - participante registra e propõe, mas não administra nem cancela
  ---
  duration_ms: 224.33359
  type: 'test'
  ...
# Subtest: convite exige o e-mail convidado e libera acesso depois de aceito
ok 85 - convite exige o e-mail convidado e libera acesso depois de aceito
  ---
  duration_ms: 306.672088
  type: 'test'
  ...
# Subtest: convite pendente não dá acesso antes do aceite
ok 86 - convite pendente não dá acesso antes do aceite
  ---
  duration_ms: 217.424895
  type: 'test'
  ...
# Subtest: a data nunca muda o estado: só sugere, e a confirmação é registrada
ok 87 - a data nunca muda o estado: só sugere, e a confirmação é registrada
  ---
  duration_ms: 110.045923
  type: 'test'
  ...
# Subtest: conflito de versão é recusado em vez de sobrescrever
ok 88 - conflito de versão é recusado em vez de sobrescrever
  ---
  duration_ms: 122.399062
  type: 'test'
  ...
# Subtest: rascunho → pendente exige motivo e cancelamento é assistido
ok 89 - rascunho → pendente exige motivo e cancelamento é assistido
  ---
  duration_ms: 116.584613
  type: 'test'
  ...
# Subtest: participante sai e perde acesso, mas o histórico fica
ok 90 - participante sai e perde acesso, mas o histórico fica
  ---
  duration_ms: 220.374108
  type: 'test'
  ...
# Subtest: organizador único: a viagem tem exatamente um organizador ativo
ok 91 - organizador único: a viagem tem exatamente um organizador ativo
  ---
  duration_ms: 207.788583
  type: 'test'
  ...
# Subtest: o organizador não pode se remover: precisa usar a ação de sair
ok 92 - o organizador não pode se remover: precisa usar a ação de sair
  ---
  duration_ms: 108.830858
  type: 'test'
  ...
1..92
# tests 92
# suites 0
# pass 92
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 28866.234798

```