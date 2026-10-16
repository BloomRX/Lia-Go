# Saída dos testes (rodada mais recente)
- **Quando:** 2026-10-16T00:46:40.149Z (local 15/10/2026, 21:46:40)
- **Node:** v26.8.1 · **npm:** 11.18.0 · **Sistema:** win32 x64
- **Placar:** 335 passaram · 2 falharam · 0 pulados · **Código de saída:** 1
- **Tipos:** sem erro
- **Arquivos de teste que não carregaram:** nenhum
## Erros destacados
```
✖ a Visão geral traz o hero com a Lia e o próximo compromisso que ainda vai acontecer (105.8598ms)
✔ sem nada à frente, a tela diz que não há compromisso (nada inventado) (22.9607ms)
✔ o aviso da tela inicial conta o mesmo que a central (e abre a central) (97.9851ms)
✔ prioridade é texto, não cor: o item de urgência diz 'Alta prioridade' (29.0155ms)
✔ ler não resolve: marcar como lida tira de 'não lidas' e o item continua aberto (42.2885ms)
✔ dispensar tira da lista de abertas e o filtro 'Dispensadas' traz de volta (41.6874ms)
✔ dispensar não esconde problema que piora: 2 pendências viram 3 e a notificação volta (57.6652ms)
✔ ao voltar para o app, a central mostra o que mudou no servidor (28.867ms)
```
```
✖ criar viagem já abre a viagem criada (rascunho precisa dos próximos passos) (8022.4029ms)
✔ aba Gastos mostra o previsto do roteiro separado do dinheiro oficial (43.1103ms)
ℹ tests 42
ℹ suites 0
ℹ pass 40
ℹ fail 2
ℹ cancelled 0
ℹ skipped 0
```
```
✖ failing tests:

test at apps\mobile\.ui-testes\inicio.test.mjs:8826:1
✖ a Visão geral traz o hero com a Lia e o próximo compromisso que ainda vai acontecer (105.8598ms)
  AssertionError [ERR_ASSERTION]: o compromisso é o de amanhã, com hora
      at TestContext.<anonymous> (file:///J:/Lia-Go/apps/mobile/.ui-testes/inicio.test.mjs:8886:9)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
```
```
✖ a Visão geral traz o hero com a Lia e o próximo compromisso que ainda vai acontecer (105.8598ms)
  AssertionError [ERR_ASSERTION]: o compromisso é o de amanhã, com hora
      at TestContext.<anonymous> (file:///J:/Lia-Go/apps/mobile/.ui-testes/inicio.test.mjs:8886:9)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 'Conectado como AnaSairTudo sincronizado← Minhas viagensSerraCampos do Jordão · sem data a sem dataPlanejadaViagem ativaCampos do Jordãosem data a sem data · 1 pessoaPlanejadaPróximo compromissoPasseio de barco17/10/2026 às 10:00 · Ilha do MantimentosábAinda não aconteceu: nada aqui muda saldo nem confirma reserva.OrganizaçãoVocê é organizador(a). Nenhuma pendência financeira.okParticipantesAna (você)organizadorConvidar pessoaE-mail de quem vai participarGerar conviteGerar convite precisa de internet: o token só existe no servidor.Visão geralRoteiroGastosMais',
```
```
✖ criar viagem já abre a viagem criada (rascunho precisa dos próximos passos) (8022.4029ms)
  Error: Tempo esgotado esperando a viagem criada abrir. Tela atual: Conectado como AnaSairTudo sincronizadoLia GoA viagem ficou guardada neste aparelho. Ela abre assim que o servidor confirmar — o estado aparece na barra de sincronização acima.NotificaçõesNada pendente por aquiSuas viagensCriar viagemRecebeu um convite? Cole o link/tokenAceitar conviteAceitar convit
      at esperarPor (file:///J:/Lia-Go/apps/mobile/.ui-testes/viagens.test.mjs:72:8)
      at async TestContext.<anonymous> (file:///J:/Lia-Go/apps/mobile/.ui-testes/viagens.test.mjs:8967:2)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7)
npm error Lifecycle script `test:ui` failed with error:
npm error code 1
```
```
  Error: Tempo esgotado esperando a viagem criada abrir. Tela atual: Conectado como AnaSairTudo sincronizadoLia GoA viagem ficou guardada neste aparelho. Ela abre assim que o servidor confirmar — o estado aparece na barra de sincronização acima.NotificaçõesNada pendente por aquiSuas viagensCriar viagemRecebeu um convite? Cole o link/tokenAceitar conviteAceitar convit
      at esperarPor (file:///J:/Lia-Go/apps/mobile/.ui-testes/viagens.test.mjs:72:8)
      at async TestContext.<anonymous> (file:///J:/Lia-Go/apps/mobile/.ui-testes/viagens.test.mjs:8967:2)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7)
npm error Lifecycle script `test:ui` failed with error:
npm error code 1
npm error path J:\Lia-Go\apps\mobile
```
## Saída completa
```

> lia-go@0.1.0 test
> npm run test:tools && npm run test:domain && npm run test:sync && npm run test:app && npm run test:api


> lia-go@0.1.0 test:tools
> node --test "tools/test_dev.mjs"

✔ Windows: npm (`.cmd`) vira UMA linha executada pelo cmd.exe — sem `cmd.exe` sobrando na linha (2.9298ms)
✔ Windows: caminho com espaço vira aspas (Program Files) (0.1699ms)
✔ prompt no lugar do programa é reconhecido como 'não rodou nada' (0.2089ms)
✔ Windows: programas .exe continuam sem shell (git, node, docker) (0.1436ms)
✔ Linux/macOS: nada de shell, mesmo com nome terminando em .cmd (0.1265ms)
✔ erro de spawn vira explicação em português, não um código solto (0.1837ms)
✔ rede instável vale tentar de novo; DNS/registro errado NÃO (seria perda de tempo) (0.7404ms)
✔ sintoma 'Exit handler never called' (npm se perdendo) explica e manda tentar de novo (0.124ms)
✔ quando a tela não explica, o log interno do npm entra em cena (caso real medido) (0.4787ms)
✔ quando a tela já explica, o log não é usado (não confunde a pessoa) (0.227ms)
✔ linhas relevantes são resumidas e sem repetição (0.1628ms)
✔ o caminho do log interno do npm é encontrado na saída (é onde mora o motivo real) (0.1881ms)
✔ Windows: o caminho do log com \ também é reconhecido (0.0828ms)
✔ proxy com senha é reconhecido separadamente da rede comum (0.097ms)
✔ caso real: o pacote @fastify/proxy-addr no log NÃO é problema de proxy (0.0899ms)
✔ números soltos no log (tamanhos, códigos, portas) não viram causa falsa (0.0864ms)
✔ antivírus/arquivo preso (EPERM) explica fechar janelas (0.0784ms)
✔ cada causa conhecida tem dica acionável (0.1268ms)
✔ falha não reconhecida ainda dá orientação útil (e não mente sobre a causa) (0.0854ms)
✔ múltiplas causas específicas na mesma saída são todas reportadas (0.1169ms)
✔ resumo da saída mostra o fim e nunca engole a mensagem de erro (0.1832ms)
✔ URL do banco é exibida sem senha (nunca vaza em relatório) (0.176ms)
✔ leitura do .env ignora comentários e linhas vazias (0.2496ms)
✔ Windows procura o Python como `py -3`/`python` — `python3` não existe lá (0.2118ms)
✔ janela de Python para o banco embutido (3.9–3.12) — fora dela o pip não teria binário para baixar (0.2506ms)
✔ log do PostgreSQL vira dica acionável (administrador, porta ocupada) (0.4022ms)
✔ escolhe o arquivo de binários certo por sistema (e avisa quando não existe) (0.4079ms)
✔ avisa quando a plataforma não tem binário publicado (Windows/Linux ARM) (0.1638ms)
✔ extração do arquivo baixado tenta os programas certos em cada sistema (0.2145ms)
✔ diagnóstico do computador diz o essencial em português (0.2604ms)
✔ progresso do download é legível: barra, percentual, tamanho e velocidade (0.373ms)
✔ tamanhos e tempos em português (0.2161ms)
✔ atualização: escolhe a referência e nunca decide mexer no que é da pessoa (0.3514ms)
✔ conflito pela metade é reconhecido (foi o que quebrou a rodada seguinte) (0.1812ms)
✔ limites de tempo são explicados em linguagem simples (0.1508ms)
✔ a rodada NÃO fica presa quando sobra um processo vivo (o caso do PostgreSQL) (82.0285ms)
✔ o placar dos testes é lido no console do Windows (ℹ) e no arquivo (TAP #) — nunca mais '0 passaram' (0.7793ms)
✔ saída de servidor é repassada linha por linha (nunca cola uma linha na outra) (0.2157ms)
✔ as funções principais do orquestrador continuam existindo (nenhuma remoção acidental) (2.7513ms)
✔ arquivo de teste que não carregou é reconhecido nos dois formatos do Node (0.4341ms)
✔ teste comum que falhou NÃO é confundido com arquivo que não carregou (0.088ms)
✔ o relatório leva o erro com contexto, não só o placar (0.3955ms)
✔ erro de TypeScript também entra no relatório como falha (0.0887ms)
✔ saída sem falha não inventa bloco de erro (relatório verde fica limpo) (0.1021ms)
ℹ tests 44
ℹ suites 0
ℹ pass 44
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 179.2082

> lia-go@0.1.0 test:domain
> npm run test --workspace @lia-go/domain


> @lia-go/domain@0.1.0 test
> node --test "tests/*.test.ts"

✔ saldo = total pago − parte que lhe cabe (somente confirmadas) (4.8775ms)
✔ despesa pendente e contestada ficam em comprometido, fora do saldo oficial (0.8582ms)
✔ despesa pessoal não gera dívida entre participantes (0.419ms)
✔ transferências confirmadas quitam o saldo; informadas e contestadas não (0.6169ms)
✔ sugestão de transferências minimiza o número de pagamentos e fecha exatamente (1.6483ms)
✔ saldo zerado não sugere transferências (0.3179ms)
✔ item nasce aberto, sem prazo inventado e com validações de gente (3.3419ms)
✔ o prazo não conclui nada: passou da data, o item continua aberto e só fica marcado como atrasado (0.5406ms)
✔ concluir registra quem e quando; concluir de novo é recusado (0.5397ms)
✔ reabrir exige motivo e deixa rastro de por que voltou (1.9373ms)
✔ resumo adaptativo: só fala do que existe (aberto, feito, atrasado, hoje, sem responsável) (0.5575ms)
✔ ordem de leitura: atrasado primeiro, depois prazo mais próximo, sem prazo e feitos no fim (3.7639ms)
✔ documento nasce privado e só quem criou vê (2.603ms)
✔ link estranho é recusado (nada de caminho disfarçado) (1.0772ms)
✔ compartilhar com a viagem dá acesso a todos; com pessoas, só a elas (11.2583ms)
✔ revogar tira o acesso sem apagar a história (0.853ms)
✔ remover exige motivo, revoga o acesso e mantém o registro para quem administra (0.6405ms)
✔ resumo conta o que existe: só seus, compartilhados e removidos (0.6834ms)
✔ impacto antes de compartilhar e de remover diz o que acontece de verdade (0.5752ms)
✔ despesa nova nasce pendente e não entra no saldo oficial (4.8478ms)
✔ campos obrigatórios são validados (1.0829ms)
✔ confirmação exige outra pessoa e move a despesa para o saldo oficial (0.615ms)
✔ não é possível confirmar duas vezes nem confirmar cancelada (0.4422ms)
✔ contestação exige motivo, vem de outra pessoa e tira a despesa do saldo oficial (0.5479ms)
✔ correção exige motivo, preserva histórico e volta para pendente (1.18ms)
✔ despesa pessoal não cria obrigação para outras pessoas (0.4088ms)
✔ rateio da despesa compartilhada pode ser percentual ou por valores (1.8309ms)
✔ despesa de valor quebrado em 3 pessoas soma exatamente o total (0.3947ms)
✔ histórico preservado em sequência completa: criar → confirmar → contestar → corrigir → confirmar (0.5487ms)
✔ só despesa confirmada entra no total oficial; o resto aparece separado, com aviso (84.1205ms)
✔ saldos e acertos sugeridos: quem pagou recebe, quem deve paga, e é sugestão (1.4631ms)
✔ o previsto (roteiro + reservas) sai do total oficial e é rotulado como planejamento (0.9055ms)
✔ limite combinado aparece no fechamento e o estouro é avisado (0.4787ms)
✔ CSV: separador de planilha pt-BR, valores com vírgula e guarda contra fórmula (0.5498ms)
✔ campoCsv: aspas, quebra de linha e perigo de fórmula (0.1781ms)
✔ convite normaliza e-mail e expira em 14 dias por padrão (1.8494ms)
✔ convite expirado não pode ser aceito (0.4923ms)
✔ só o dono do e-mail convidado aceita o convite (0.7898ms)
✔ organizador cancela convite pendente; participante não (2.6825ms)
✔ consequências de sair/remover preservam histórico e pendências (0.8412ms)
✔ centavos recusa número fracionário (nunca float como dinheiro) (3.3511ms)
✔ analisarValorMonetario entende formatos brasileiros (0.8472ms)
✔ analisarValorMonetario rejeita entrada inválida (2.0452ms)
✔ formatarBRL formata centavos em pt-BR (1.179ms)
✔ alocarProporcional garante soma exata em divisão quebrada (2.341ms)
✔ alocarProporcional é determinístico e soma exata em casos-limite (0.7996ms)
✔ com pesos iguais a diferença entre partes é de no máximo 1 centavo (0.3713ms)
✔ alocarProporcional trata total negativo (estorno) preservando a soma (0.2808ms)
✔ alocarProporcional rejeita pesos inválidos (0.4532ms)
✔ convite recebido é obrigação minha, de alta prioridade, e não decide por mim (3.4214ms)
✔ convite recebido vencido diz que o prazo passou e que o antigo não dá acesso (0.4688ms)
✔ convite que vence hoje ainda vale hoje (o dia inteiro conta) (0.2605ms)
✔ convite enviado e ainda pendente aparece como lembrete médio de quem convidou (0.4383ms)
✔ convite já aceito não gera notificação nenhuma (0.2906ms)
✔ convite enviado que venceu vira alta prioridade (precisa convidar de novo) (0.3467ms)
✔ despesa pendente em viagem acontecendo é alta prioridade e não acusa ninguém (0.3415ms)
✔ despesa pendente em viagem que ainda não começou é média prioridade (0.2945ms)
✔ viagem cancelada não gera pendência financeira na central (0.2599ms)
✔ viagem sem pendência não gera nada (nada de aviso de rotina) (0.4744ms)
✔ rascunho avisa só quem organiza, e o texto diz que o estado não muda sozinho (0.4787ms)
✔ rascunho sem data diz que faltam as datas (e não inventa prazo) (0.2525ms)
✔ pagamento informado para mim é alta prioridade: informar não é pagar (0.67ms)
✔ pagamento que eu informei é informativo (baixa) e não cobra a outra pessoa (0.2162ms)
✔ movimento confirmado deixa de ser notificação (a obrigação acabou) (0.1302ms)
✔ movimento entre outras duas pessoas não vira notificação minha (0.1209ms)
✔ item atrasado meu é alta prioridade e o texto deixa claro que ninguém conclui por mim (0.4354ms)
✔ item atrasado de outra pessoa é lembrete de baixa prioridade, com o nome de quem pegou (0.1795ms)
✔ item atrasado sem responsável é média: é do grupo e alguém precisa assumir (0.1577ms)
✔ item para hoje é lembrete (média) — o dia ainda não acabou (0.2132ms)
✔ item concluído não aparece, mesmo com prazo vencido (0.1285ms)
✔ item sem prazo não vira notificação (sem data não há atraso) (0.1513ms)
✔ lista vazia de dados não inventa notificação nenhuma (1.1903ms)
✔ reserva sem valor aparece como média e explica que nunca vale zero (0.3513ms)
✔ orçamento em atenção é média; estourado é alta — e os dois dizem que o saldo oficial não mudou (0.3448ms)
✔ orçamento dentro do limite (ou sem limite) não gera notificação (0.1383ms)
✔ marcar como lida não resolve: continua aberta, só deixa de ser 'não lida' (0.5538ms)
✔ desmarcar volta para 'ainda não vi' (o botão de arrepender funciona) (0.2785ms)
✔ dispensar tira da lista de abertas, mas o filtro 'dispensadas' mostra (0.3844ms)
✔ dispensar não esconde o problema quando ele piora: a chave muda com o fato (0.1942ms)
✔ resolvida é o fato que sumiu dos dados: sai das abertas e entra no histórico (0.3844ms)
✔ histórico de resolvidas vem da mais recente para a mais antiga (0.5276ms)
✔ marca antiga é podada quando o histórico cresce demais (o aparelho não guarda para sempre) (0.7902ms)
✔ filtro por viagem isola o que é daquela viagem (inclusive a busca) (15.7192ms)
✔ filtro por categoria e por prioridade combinam entre si (0.6186ms)
✔ filtro 'só as minhas' traz obrigação de quem pergunta, não o que é de outro (0.3349ms)
✔ busca ignora acento e maiúscula (quem digita 'pousada' acha 'Pousada') (1.1345ms)
✔ ordem: alta primeiro; entre iguais, o que ainda não foi visto vem antes (0.575ms)
✔ resumo descreve o que a tela mostra, sem prometer o que não há (0.551ms)
✔ filtro de viagens lista só o que tem notificação, em ordem alfabética e sem repetir (0.8477ms)
✔ cada notificação tem um próximo passo concreto e um destino válido (0.2812ms)
✔ chaves não se repetem: fato diferente, notificação diferente (0.2166ms)
✔ limite coletivo não pertence a uma pessoa; individual precisa dizer de quem é (3.675ms)
✔ sem limite o app diz 'sem limite' em vez de inventar um teto (0.8721ms)
✔ dentro, perto e estourado: o estado sai do número, com alerta em texto (4.1641ms)
✔ previsto estourado sem gasto ainda dá para replanejar (e a tela diz isso) (0.6602ms)
✔ custo sem valor informado aparece como aviso: o previsto é o mínimo (0.4303ms)
✔ aguardando confirmação aparece separado do oficial no resumo (0.1957ms)
✔ limite zero é um combinado explícito, não um erro silencioso (0.2924ms)
✔ participante registra despesas e propõe; administração é do organizador (2.9699ms)
✔ motivo é sempre explicado para a interface (0.506ms)
✔ convite pendente, quem saiu e quem foi removido não têm acesso (0.2618ms)
✔ viagem cancelada bloqueia novos compromissos e libera correções (0.2585ms)
✔ viagem concluída bloqueia lançamentos novos e mantém acertos (0.2255ms)
✔ quem lançou não confirma o próprio lançamento (0.3345ms)
✔ início e conclusão podem ser confirmados por qualquer participante ativo (0.2335ms)
✔ reserva nasce prevista e sem confirmação: confirmar é ato separado, com evidência (5.0902ms)
✔ custo desconhecido é null (nunca zero) e fica marcado para verificar (0.3995ms)
✔ confirmar exige evidência e registra quem confirmou e quando (1.0604ms)
✔ o valor não muda ao confirmar: muda a natureza (estimativa → já combinado) (2.5463ms)
✔ reserva gratuita continua zero explícito, e não "a verificar" (0.3212ms)
✔ cancelar exige motivo, preserva a evidência e não volta atrás (0.5137ms)
✔ ordem de leitura: com data primeiro, sem data depois, cancelada por último (1.2225ms)
✔ resumo separa previsto de já combinado e ignora cancelada (12.8573ms)
✔ resumo sem reserva nenhuma diz isso em vez de mostrar números vazios (0.3425ms)
✔ confirmar mostra o impacto: natureza muda, saldo oficial não (0.8ms)
✔ cancelar avisa que não cancela no fornecedor e diz quanto sai do previsto (0.3477ms)
✔ custo desconhecido não vira número no impacto de nenhuma das ações (0.2847ms)
✔ campos inválidos são recusados com mensagem de gente (0.5575ms)
✔ o relógio nunca conclui uma atividade: só muda o que a tela mostra (1.9841ms)
✔ atividade sem horário fica na sequência lógica: nada de horário inventado (0.9618ms)
✔ custo desconhecido nunca vira R$ 0,00 (desconhecido, a verificar e gratuito são coisas diferentes) (0.9104ms)
✔ conflito de horário é explicado nos dois níveis e nunca resolvido sozinho (0.6701ms)
✔ deslocamento que não cabe no intervalo vira conflito, e o trecho longo aparece (0.2477ms)
✔ resumo do dia soma só o custo conhecido e sinaliza o que falta verificar (7.1818ms)
✔ concluir é ação explícita, registrada com autor e hora (0.6998ms)
✔ cancelar e corrigir exigem motivo; quem saiu não faz nada no roteiro (0.5301ms)
✔ dias e sequência: agrupa por dia, mantém a ordem e sugere a próxima posição (0.4167ms)
✔ orçamento soma estimativas e compromissos, separados, e ignora cancelada (0.4531ms)
✔ orçamento não trata desconhecido como zero nem gratuito como gasto (0.2548ms)
✔ roteiro sem custo nenhum diz isso em vez de mostrar zero (0.119ms)
✔ concluir mostra o impacto antes: previsto não muda e o saldo oficial não é calculado na tela (0.265ms)
✔ concluir avisa o que continua indefinido: custo a verificar e atividade sem horário (0.1727ms)
✔ cancelar diz exatamente quanto sai do previsto e que o histórico não some (0.146ms)
✔ cancelar custo desconhecido não inventa número nem some com o que faltava verificar (0.1569ms)
✔ atividade nasce sem reserva e sem observação; o que não foi dito fica nulo (0.0886ms)
✔ criar com observação e reserva guarda os dois — e a observação é aparada (0.1001ms)
✔ observação em branco não vira texto: é o mesmo que não ter dito nada (0.0968ms)
✔ corrigir vincula e desvincula reserva, guardando o motivo e subindo a versão (0.1189ms)
✔ corrigir só a observação não mexe na reserva (e vice-versa) (0.1096ms)
✔ vincular reserva não confirma nada e não muda o custo da atividade (0.111ms)
✔ rateio igualitário divide e explica quem recebeu o centavo (2.0419ms)
✔ rateio igualitário de 1 centavo entre 3 pessoas soma exatamente 1 centavo (0.8106ms)
✔ rateio percentual respeita os percentuais e fecha a conta (0.2476ms)
✔ rateio percentual exige soma de 100% (10.000 bps) (0.4481ms)
✔ rateio por valores fixos precisa conferir com o total (0.1973ms)
✔ rateio rejeita participantes duplicados, vazios e negativos (0.2233ms)
✔ validarSomaExata confere totais (0.128ms)
✔ rateio igualitário de valores grandes mantém soma exata e diferença de 1 centavo (0.3638ms)
✔ any participante ativo confirma início e fim da viagem; removido não (3.3365ms)
✔ a data sozinha nunca muda o estado — apenas sugere (14.6519ms)
✔ sugestão de conclusão aparece depois da data final, sem concluir sozinha (0.3389ms)
✔ não há sugestão em viagem concluída, cancelada ou pendente (0.1606ms)
✔ fuso da viagem é respeitado ao decidir se a data chegou (0.7537ms)
✔ transições permitidas e papéis (0.5568ms)
✔ Pendente exige motivo explícito e é sugerido apenas por pessoas autorizadas (0.1784ms)
✔ viagem concluída não reabre automaticamente e cancelada não muda de estado (0.155ms)
✔ cancelamento é assistido e lista impactos conhecidos (0.4201ms)
ℹ tests 157
ℹ suites 0
ℹ pass 157
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 518.8769

> lia-go@0.1.0 test:sync
> npm run test --workspace @lia-go/sync


> @lia-go/sync@0.1.0 test
> node --test "tests/*.test.ts"

✔ mesclar carga junta listas por id e mantém a lista de viagens vinda do servidor (2.2491ms)
✔ resposta atrasada nunca rebaixa dado mais novo que já está no aparelho (0.1889ms)
✔ item marcado como removido sai da carga local (0.1286ms)
✔ a viagem aberta só é trocada se for a mesma e por versão igual ou maior (0.2002ms)
✔ sem versão (convites) o servidor sempre atualiza (0.1679ms)
✔ remover da carga e contar itens funcionam para a interface (0.2107ms)
✔ convites que recebi e convites da viagem são listas separadas (0.158ms)
✔ lista sem id é ignorada em vez de virar lixo na interface (0.1538ms)
✔ roteiro: atividades do dia entram na carga local (offline) e a mais nova vence (0.2249ms)
✔ roteiro: atividade cancelada sai da carga quando o servidor marca como removida (0.205ms)
✔ trocar a viagem aberta descarta o que era da viagem anterior (menos a lista da conta) (0.1827ms)
✔ detalhe da viagem nova entra mesmo sendo de outra viagem; o da antiga não volta por atraso (0.1527ms)
✔ cargaCompleta: cache gravado por versão anterior (sem as listas de hoje) não derruba a tela (0.158ms)
✔ cargaCompleta de nada continua sendo a carga vazia (primeira abertura) (0.0955ms)
✔ campo igual nos dois lados não é conflito (1.3848ms)
✔ campos diferentes alterados em cada lado são mesclados (não são a mesma decisão) (0.156ms)
✔ mesmo campo alterado nos dois lados sem dinheiro: segue com a versão do aparelho (0.2036ms)
✔ valor de despesa divergente NUNCA é resolvido sozinho (0.18ms)
✔ moeda, rateio, participantes e quem pagou também contam como dinheiro (0.1489ms)
✔ conflito que junta dinheiro com campo simples continua exigindo decisão (0.1282ms)
✔ comparação para a tela usa português simples e marca o que é dinheiro (0.1728ms)
✔ rótulo de campo desconhecido não inventa nome bonito, mas também não quebra (0.0977ms)
✔ enfileirar preserva a ordem de criação e não duplica o mesmo id (4.7919ms)
✔ a próxima operação é a mais antiga; nada atrás de uma espera é enviado antes dela (0.8174ms)
✔ operação que precisa de decisão humana não bloqueia o resto da fila (0.1962ms)
✔ espera de reenvio cresce e tem teto (2s, 4s, 8s… máximo 5 min) (0.1241ms)
✔ erro de rede volta para a fila com espera crescente e guarda o motivo (0.2339ms)
✔ erro permanente para de tentar e aparece para a pessoa resolver (0.1999ms)
✔ conflito de versão vira estado 'conflito' com os dados para a pessoa decidir (0.1524ms)
✔ erros temporários do servidor continuam tentando (401, 429 e 5xx) (0.1954ms)
✔ sucesso tira a operação da fila e marca o 'tudo sincronizado' quando esvazia (0.2194ms)
✔ app fechado no meio do envio: 'enviando' volta para a fila em vez de ficar preso (0.245ms)
✔ retentar volta a operação para a fila; descartar remove de vez (0.3158ms)
✔ retentar mantém o erro de conflito guardado (a tela precisa das duas versões) (0.1875ms)
✔ resumo da fila fala a língua da pessoa e prioriza o que precisa de decisão (0.514ms)
✔ roteiro na fila: criar e concluir atividade funcionam offline e preservam a ordem (0.1316ms)
✔ operação criada durante a passada não é perdida pela gravação do fim (0.16ms)
✔ estado mais novo da passada vale, mas o que chegou depois é preservado na ordem (0.1505ms)
✔ operação que falhou na passada mantém o erro registrado no aparelho (0.1357ms)
✔ offline: nada é enviado, a fila fica intacta e o relatório diz por quê (1.8816ms)
✔ online com fila vazia: só busca o que mudou e guarda o cursor (1.1451ms)
✔ envia na ordem de criação e busca de novo depois para a carga refletir o servidor (0.752ms)
✔ a chave de idempotência enviada é o id da operação: reenvio nunca duplica (2.3639ms)
✔ falha de rede para a passada e preserva a ordem (nada fura a fila) (0.3649ms)
✔ exceção na chamada (queda total) é tratada como problema de rede, não como sucesso (0.34ms)
✔ regra de negócio violada não fica tentando e não trava as outras alterações (0.4822ms)
✔ conflito de versão para o envio e vira decisão da pessoa, sem sobrescrever nada (0.2934ms)
✔ se a busca falha, o envio ainda é tentado e o relatório não mente (0.3022ms)
ℹ tests 48
ℹ suites 0
ℹ pass 48
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 185.5507

> lia-go@0.1.0 test:app
> npm run test --workspace @lia-go/mobile


> @lia-go/mobile@0.1.0 test
> node --test "tests/*.test.ts" && npm run test:ui

✔ IndexedDB real (simulado em memória) grava, lê e apaga (10.133ms)
✔ a fila volta do aparelho exatamente como foi guardada (fechar o app não perde nada) (1.635ms)
✔ carga e cursor sobrevivem ao reinício e o cursor aceita nulo (1.1046ms)
✔ dado estragado no aparelho não derruba o app: vira fila vazia (0.3164ms)
✔ limpar apaga tudo do aparelho (usado ao sair da conta) (2.42ms)
✔ escolha do armazenamento: nativo usa o do app; navegador usa IndexedDB; sem nenhum, memória (0.3018ms)
✔ custo desconhecido não vira número: fica omitido (e nunca R$ 0,00) (1.6334ms)
✔ custo gratuito é zero explícito, com rótulo que explica o zero (0.4036ms)
✔ estimativa e compromisso aparecem com o valor, sem inventar rótulo (0.2208ms)
✔ deslocamento é compacto: só mostra o que foi informado (0.299ms)
✔ duração não inventa zero: sem duração não há texto (0.2367ms)
✔ dia do roteiro é legível em pt-BR e não escorrega de dia por fuso (19.3499ms)
✔ estado da atividade tem rótulo textual (nunca só a cor do marcador) (0.209ms)
✔ atividade sem horário diz que é flexível — nunca inventa uma hora (0.9296ms)
✔ cartão mostra só o contexto que existe: local e duração ausentes não aparecem (1.3987ms)
✔ custo desconhecido fica omitido; a verificar aparece sinalizado (nunca R$ 0,00) (0.3096ms)
✔ custo conhecido aparece com a natureza ao lado, na linha do valor (0.3037ms)
✔ gratuito é zero explícito e rotulado — diferente de desconhecido (0.1702ms)
✔ sem custo informado não recebe rótulo nenhum (0.1019ms)
✔ conflito tem manchete própria, explicando o tipo (0.1025ms)
✔ trecho de deslocamento: compacto por padrão, aberto quando é longo, caro ou arriscado (0.3171ms)
✔ resumo do dia: atenção só para o que exige decisão, e o previsto só quando existe (0.4005ms)
✔ resumo do dia com uma atividade não usa plural torto (0.2777ms)
✔ cartão aceita a atividade na forma do servidor e na forma do domínio (a tela não fica em branco) (0.2484ms)
✔ atividade sem campo de custo nenhum não vira R$ 0,00 nem derruba o cartão (0.2315ms)
✔ custoDoCartao: forma do servidor, forma do domínio e nada — sem inventar zero (0.2314ms)
✔ offline: a despesa fica na fila com o texto certo e a fila sobrevive ao reinício (12.6046ms)
✔ a rede voltou: a fila é enviada e o cache passa a refletir o servidor (6.1456ms)
✔ cada reenvio usa a MESMA chave de idempotência (o servidor nunca aplica duas vezes) (2103.5461ms)
✔ conflito de versão: a pessoa escolhe, e 'manter o que fiz' reaplica sobre a versão atual (6.1261ms)
✔ conflito: 'usar a versão do servidor' descarta a alteração do aparelho (3.75ms)
✔ regra de negócio recusada para de tentar, mas não trava as outras alterações (2.7584ms)
✔ limpar dados deste aparelho apaga fila e cache, e a tela reflete na hora (2.9517ms)
✔ cinco pedidos durante uma passada viram uma passada seguinte, não cinco (1.3578ms)
✔ reserva criada offline sobe quando a rede volta e entra no cache como as outras entidades (1.8405ms)
✔ checklist do aparelho só entra na viagem aberta e item estragado é ignorado (2.0333ms)
✔ cache da viagem antiga não aparece na viagem nova (0.2074ms)
✔ viagem aberta entrega o detalhe e só as atividades dela (0.3215ms)
✔ permissão ausente ou incompleta nunca libera ação (0.1835ms)
✔ atividade vinda do servidor vira a forma do domínio (dinheiro em centavos, nada de float) (0.2472ms)
✔ atividade estragada no cache é ignorada, não derruba a tela (0.129ms)
✔ atividadesDoDominio pega só as atividades da viagem aberta (0.188ms)
✔ reserva de outra viagem não entra na tela (e a viagem aberta entrega as reservas dela) (0.1497ms)
✔ cache antigo, sem a lista de reservas, continua abrindo a viagem (quem atualiza tem cache velho) (0.3735ms)
✔ o próximo compromisso ignora o que passou e o que não vale mais (0.9048ms)
✔ o 'quando' do compromisso fala hoje, amanhã ou a data (1.7964ms)
ℹ tests 46
ℹ suites 0
ℹ pass 46
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3081.5023

> @lia-go/mobile@0.1.0 test:ui
> node ../../tools/teste-ui.mjs

✔ concluir mostra a revisão de impacto antes do botão e diz que o saldo oficial não muda aqui (136.937ms)
✔ cancelar mostra quanto sai do previsto e que o histórico e as despesas ficam (44.8137ms)
✔ sem digitar o motivo, cancelar avisa o que falta e não muda nada (45.0356ms)
✔ atividade vinculada mostra a reserva e avisa que prevista não é confirmada (40.4369ms)
✔ reserva confirmada mostra a evidência que existe — sem inventar localizador (46.0295ms)
✔ atividade aponta para reserva que ainda não está no aparelho: a tela diz isso, não inventa (44.6326ms)
✔ corrigir a observação pela ficha: vale na hora e sobe com o motivo (83.1489ms)
✔ criar atividade com observação e reserva: o cartão do roteiro já diz que a reserva é prevista (83.5294ms)
✔ item atrasado aparece como atrasado e continua em aberto (o prazo não conclui nada) (120.4938ms)
✔ concluir registra quem marcou e reabrir exige motivo (70.7511ms)
✔ item criado sem rede fica na fila do aparelho e aparece na hora (62.482ms)
✔ documento novo nasce privado e a tela explica a privacidade (126.8457ms)
✔ compartilhar mostra o impacto antes e não promete cópia do arquivo (38.6637ms)
✔ remover exige motivo e diz que o registro continua guardado (43.5177ms)
✔ o fechamento traz os números do servidor, com o acerto como sugestão (122.1807ms)
Not implemented: navigation to another Document
Not implemented: navigation to another Document
✔ exportar gera o arquivo no navegador e não muda nada nos registros (49.3718ms)
✔ sem servidor, a tela diz que o fechamento precisa dele (nada de conta velha) (29.999ms)
✖ a Visão geral traz o hero com a Lia e o próximo compromisso que ainda vai acontecer (105.8598ms)
✔ sem nada à frente, a tela diz que não há compromisso (nada inventado) (22.9607ms)
✔ o aviso da tela inicial conta o mesmo que a central (e abre a central) (97.9851ms)
✔ prioridade é texto, não cor: o item de urgência diz 'Alta prioridade' (29.0155ms)
✔ ler não resolve: marcar como lida tira de 'não lidas' e o item continua aberto (42.2885ms)
✔ dispensar tira da lista de abertas e o filtro 'Dispensadas' traz de volta (41.6874ms)
✔ dispensar não esconde problema que piora: 2 pendências viram 3 e a notificação volta (57.6652ms)
✔ ao voltar para o app, a central mostra o que mudou no servidor (28.867ms)
✔ o item leva para a viagem na aba certa (despesa pendente abre Gastos) (35.9776ms)
✔ 'só o que depende de mim' deixa de fora o que é do grupo (29.1048ms)
✔ a central diz o que alcança e como voltar (nada de tela sem saída) (22.9165ms)
✔ com limite, a barra aparece e o previsto se compara ao combinado em texto (118.55ms)
✔ no limite de atenção a tela avisa; passando dele, diz que passou (70.8669ms)
✔ sem limite, a tela explica que o teto é planejamento e oferece definir (51.9139ms)
✔ participante não define o limite do grupo: a tela diz de quem é a ação (39.9271ms)
✔ reserva aparece com o valor previsto e o desconhecido como 'Valor a verificar' (106.6836ms)
✔ confirmar sem evidência avisa e não muda nada; com evidência, registra quem confirmou (57.1288ms)
✔ cancelar mostra que o app não cancela no fornecedor e exige motivo (41.9277ms)
✔ criar reserva entra como prevista, com o valor combinado separado da estimativa (67.1106ms)
✔ abrir a viagem nova mostra a viagem nova, não a que estava aberta antes (131.2792ms)
✔ depois de abrir a viagem nova, o roteiro dela não mostra atividade da viagem antiga (35.2368ms)
✔ o botão Sair encerra a sessão na tela e apaga o que estava guardado no aparelho (37.7726ms)
✔ Sair funciona mesmo se o servidor não responder (ninguém fica preso dentro do app) (23.367ms)
✖ criar viagem já abre a viagem criada (rascunho precisa dos próximos passos) (8022.4029ms)
✔ aba Gastos mostra o previsto do roteiro separado do dinheiro oficial (43.1103ms)
ℹ tests 42
ℹ suites 0
ℹ pass 40
ℹ fail 2
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 47528.6462

✖ failing tests:

test at apps\mobile\.ui-testes\inicio.test.mjs:8826:1
✖ a Visão geral traz o hero com a Lia e o próximo compromisso que ainda vai acontecer (105.8598ms)
  AssertionError [ERR_ASSERTION]: o compromisso é o de amanhã, com hora
      at TestContext.<anonymous> (file:///J:/Lia-Go/apps/mobile/.ui-testes/inicio.test.mjs:8886:9)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 'Conectado como AnaSairTudo sincronizado← Minhas viagensSerraCampos do Jordão · sem data a sem dataPlanejadaViagem ativaCampos do Jordãosem data a sem data · 1 pessoaPlanejadaPróximo compromissoPasseio de barco17/10/2026 às 10:00 · Ilha do MantimentosábAinda não aconteceu: nada aqui muda saldo nem confirma reserva.OrganizaçãoVocê é organizador(a). Nenhuma pendência financeira.okParticipantesAna (você)organizadorConvidar pessoaE-mail de quem vai participarGerar conviteGerar convite precisa de internet: o token só existe no servidor.Visão geralRoteiroGastosMais',
    expected: /amanhã às 10:00/,
    operator: 'match',
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