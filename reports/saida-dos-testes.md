# Saída dos testes (rodada mais recente)
- **Quando:** 2026-10-15T21:18:54.093Z (local 15/10/2026, 18:18:54)
- **Node:** v26.8.1 · **npm:** 11.18.0 · **Sistema:** win32 x64
- **Placar:** 361 passaram · 0 falharam · 0 pulados · **Código de saída:** 0
- **Tipos:** sem erro
- **Arquivos de teste que não carregaram:** nenhum
## Saída completa
```

> lia-go@0.1.0 test
> npm run test:tools && npm run test:domain && npm run test:sync && npm run test:app && npm run test:api


> lia-go@0.1.0 test:tools
> node --test "tools/test_dev.mjs"

✔ Windows: npm (`.cmd`) vira UMA linha executada pelo cmd.exe — sem `cmd.exe` sobrando na linha (3.1803ms)
✔ Windows: caminho com espaço vira aspas (Program Files) (0.1591ms)
✔ prompt no lugar do programa é reconhecido como 'não rodou nada' (0.1938ms)
✔ Windows: programas .exe continuam sem shell (git, node, docker) (0.1412ms)
✔ Linux/macOS: nada de shell, mesmo com nome terminando em .cmd (0.4028ms)
✔ erro de spawn vira explicação em português, não um código solto (0.1605ms)
✔ rede instável vale tentar de novo; DNS/registro errado NÃO (seria perda de tempo) (0.6904ms)
✔ sintoma 'Exit handler never called' (npm se perdendo) explica e manda tentar de novo (0.1233ms)
✔ quando a tela não explica, o log interno do npm entra em cena (caso real medido) (0.467ms)
✔ quando a tela já explica, o log não é usado (não confunde a pessoa) (0.2637ms)
✔ linhas relevantes são resumidas e sem repetição (0.1771ms)
✔ o caminho do log interno do npm é encontrado na saída (é onde mora o motivo real) (0.1683ms)
✔ Windows: o caminho do log com \ também é reconhecido (0.0797ms)
✔ proxy com senha é reconhecido separadamente da rede comum (0.0928ms)
✔ caso real: o pacote @fastify/proxy-addr no log NÃO é problema de proxy (0.0878ms)
✔ números soltos no log (tamanhos, códigos, portas) não viram causa falsa (0.0857ms)
✔ antivírus/arquivo preso (EPERM) explica fechar janelas (0.0783ms)
✔ cada causa conhecida tem dica acionável (0.1388ms)
✔ falha não reconhecida ainda dá orientação útil (e não mente sobre a causa) (0.079ms)
✔ múltiplas causas específicas na mesma saída são todas reportadas (0.1222ms)
✔ resumo da saída mostra o fim e nunca engole a mensagem de erro (0.172ms)
✔ URL do banco é exibida sem senha (nunca vaza em relatório) (0.1485ms)
✔ leitura do .env ignora comentários e linhas vazias (0.1594ms)
✔ Windows procura o Python como `py -3`/`python` — `python3` não existe lá (0.1324ms)
✔ janela de Python para o banco embutido (3.9–3.12) — fora dela o pip não teria binário para baixar (0.1346ms)
✔ log do PostgreSQL vira dica acionável (administrador, porta ocupada) (0.6686ms)
✔ escolhe o arquivo de binários certo por sistema (e avisa quando não existe) (0.2756ms)
✔ avisa quando a plataforma não tem binário publicado (Windows/Linux ARM) (0.0847ms)
✔ extração do arquivo baixado tenta os programas certos em cada sistema (0.1629ms)
✔ diagnóstico do computador diz o essencial em português (0.1754ms)
✔ progresso do download é legível: barra, percentual, tamanho e velocidade (0.4259ms)
✔ tamanhos e tempos em português (0.1478ms)
✔ atualização: escolhe a referência e nunca decide mexer no que é da pessoa (0.272ms)
✔ conflito pela metade é reconhecido (foi o que quebrou a rodada seguinte) (0.1579ms)
✔ limites de tempo são explicados em linguagem simples (0.1061ms)
✔ a rodada NÃO fica presa quando sobra um processo vivo (o caso do PostgreSQL) (88.8808ms)
✔ o placar dos testes é lido no console do Windows (ℹ) e no arquivo (TAP #) — nunca mais '0 passaram' (0.9917ms)
✔ saída de servidor é repassada linha por linha (nunca cola uma linha na outra) (0.2266ms)
✔ as funções principais do orquestrador continuam existindo (nenhuma remoção acidental) (3.227ms)
✔ arquivo de teste que não carregou é reconhecido nos dois formatos do Node (0.489ms)
✔ teste comum que falhou NÃO é confundido com arquivo que não carregou (0.1012ms)
✔ o relatório leva o erro com contexto, não só o placar (0.4204ms)
✔ erro de TypeScript também entra no relatório como falha (0.0953ms)
✔ saída sem falha não inventa bloco de erro (relatório verde fica limpo) (0.1199ms)
ℹ tests 44
ℹ suites 0
ℹ pass 44
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 190.6359

> lia-go@0.1.0 test:domain
> npm run test --workspace @lia-go/domain


> @lia-go/domain@0.1.0 test
> node --test "tests/*.test.ts"

✔ saldo = total pago − parte que lhe cabe (somente confirmadas) (6.8039ms)
✔ despesa pendente e contestada ficam em comprometido, fora do saldo oficial (0.8671ms)
✔ despesa pessoal não gera dívida entre participantes (0.3813ms)
✔ transferências confirmadas quitam o saldo; informadas e contestadas não (0.3801ms)
✔ sugestão de transferências minimiza o número de pagamentos e fecha exatamente (1.5091ms)
✔ saldo zerado não sugere transferências (0.2873ms)
✔ item nasce aberto, sem prazo inventado e com validações de gente (2.2125ms)
✔ o prazo não conclui nada: passou da data, o item continua aberto e só fica marcado como atrasado (0.42ms)
✔ concluir registra quem e quando; concluir de novo é recusado (0.7474ms)
✔ reabrir exige motivo e deixa rastro de por que voltou (1.7129ms)
✔ resumo adaptativo: só fala do que existe (aberto, feito, atrasado, hoje, sem responsável) (0.3847ms)
✔ ordem de leitura: atrasado primeiro, depois prazo mais próximo, sem prazo e feitos no fim (2.6337ms)
✔ documento nasce privado e só quem criou vê (2.4358ms)
✔ link estranho é recusado (nada de caminho disfarçado) (1.0752ms)
✔ compartilhar com a viagem dá acesso a todos; com pessoas, só a elas (0.7042ms)
✔ revogar tira o acesso sem apagar a história (2.1157ms)
✔ remover exige motivo, revoga o acesso e mantém o registro para quem administra (2.643ms)
✔ resumo conta o que existe: só seus, compartilhados e removidos (0.8111ms)
✔ impacto antes de compartilhar e de remover diz o que acontece de verdade (0.9772ms)
✔ despesa nova nasce pendente e não entra no saldo oficial (4.502ms)
✔ campos obrigatórios são validados (0.9115ms)
✔ confirmação exige outra pessoa e move a despesa para o saldo oficial (0.6836ms)
✔ não é possível confirmar duas vezes nem confirmar cancelada (0.4065ms)
✔ contestação exige motivo, vem de outra pessoa e tira a despesa do saldo oficial (19.4608ms)
✔ correção exige motivo, preserva histórico e volta para pendente (22.1136ms)
✔ despesa pessoal não cria obrigação para outras pessoas (0.4684ms)
✔ rateio da despesa compartilhada pode ser percentual ou por valores (4.2315ms)
✔ despesa de valor quebrado em 3 pessoas soma exatamente o total (1.3764ms)
✔ histórico preservado em sequência completa: criar → confirmar → contestar → corrigir → confirmar (0.7377ms)
✔ só despesa confirmada entra no total oficial; o resto aparece separado, com aviso (105.615ms)
✔ saldos e acertos sugeridos: quem pagou recebe, quem deve paga, e é sugestão (1.7239ms)
✔ o previsto (roteiro + reservas) sai do total oficial e é rotulado como planejamento (1.1264ms)
✔ limite combinado aparece no fechamento e o estouro é avisado (0.5785ms)
✔ CSV: separador de planilha pt-BR, valores com vírgula e guarda contra fórmula (0.5278ms)
✔ campoCsv: aspas, quebra de linha e perigo de fórmula (0.1898ms)
✔ convite normaliza e-mail e expira em 14 dias por padrão (2.9688ms)
✔ convite expirado não pode ser aceito (0.4667ms)
✔ só o dono do e-mail convidado aceita o convite (0.3272ms)
✔ organizador cancela convite pendente; participante não (0.3286ms)
✔ consequências de sair/remover preservam histórico e pendências (2.4261ms)
✔ centavos recusa número fracionário (nunca float como dinheiro) (3.6984ms)
✔ analisarValorMonetario entende formatos brasileiros (0.8607ms)
✔ analisarValorMonetario rejeita entrada inválida (1.9881ms)
✔ formatarBRL formata centavos em pt-BR (0.8446ms)
✔ alocarProporcional garante soma exata em divisão quebrada (1.9389ms)
✔ alocarProporcional é determinístico e soma exata em casos-limite (0.8956ms)
✔ com pesos iguais a diferença entre partes é de no máximo 1 centavo (0.4117ms)
✔ alocarProporcional trata total negativo (estorno) preservando a soma (0.3086ms)
✔ alocarProporcional rejeita pesos inválidos (0.6601ms)
✔ limite coletivo não pertence a uma pessoa; individual precisa dizer de quem é (4.7516ms)
✔ sem limite o app diz 'sem limite' em vez de inventar um teto (2.5203ms)
✔ dentro, perto e estourado: o estado sai do número, com alerta em texto (1.5737ms)
✔ previsto estourado sem gasto ainda dá para replanejar (e a tela diz isso) (0.3329ms)
✔ custo sem valor informado aparece como aviso: o previsto é o mínimo (0.3013ms)
✔ aguardando confirmação aparece separado do oficial no resumo (0.228ms)
✔ limite zero é um combinado explícito, não um erro silencioso (0.2651ms)
✔ participante registra despesas e propõe; administração é do organizador (1.6864ms)
✔ motivo é sempre explicado para a interface (0.4189ms)
✔ convite pendente, quem saiu e quem foi removido não têm acesso (0.2548ms)
✔ viagem cancelada bloqueia novos compromissos e libera correções (0.6006ms)
✔ viagem concluída bloqueia lançamentos novos e mantém acertos (0.2447ms)
✔ quem lançou não confirma o próprio lançamento (0.2626ms)
✔ início e conclusão podem ser confirmados por qualquer participante ativo (0.2675ms)
✔ reserva nasce prevista e sem confirmação: confirmar é ato separado, com evidência (3.9116ms)
✔ custo desconhecido é null (nunca zero) e fica marcado para verificar (0.4225ms)
✔ confirmar exige evidência e registra quem confirmou e quando (1.0258ms)
✔ o valor não muda ao confirmar: muda a natureza (estimativa → já combinado) (2.0301ms)
✔ reserva gratuita continua zero explícito, e não "a verificar" (0.3498ms)
✔ cancelar exige motivo, preserva a evidência e não volta atrás (0.6715ms)
✔ ordem de leitura: com data primeiro, sem data depois, cancelada por último (2.067ms)
✔ resumo separa previsto de já combinado e ignora cancelada (13.9988ms)
✔ resumo sem reserva nenhuma diz isso em vez de mostrar números vazios (0.5806ms)
✔ confirmar mostra o impacto: natureza muda, saldo oficial não (0.8322ms)
✔ cancelar avisa que não cancela no fornecedor e diz quanto sai do previsto (0.4301ms)
✔ custo desconhecido não vira número no impacto de nenhuma das ações (0.3751ms)
✔ campos inválidos são recusados com mensagem de gente (0.7095ms)
✔ o relógio nunca conclui uma atividade: só muda o que a tela mostra (3.7633ms)
✔ atividade sem horário fica na sequência lógica: nada de horário inventado (2.1916ms)
✔ custo desconhecido nunca vira R$ 0,00 (desconhecido, a verificar e gratuito são coisas diferentes) (0.9391ms)
✔ conflito de horário é explicado nos dois níveis e nunca resolvido sozinho (0.8276ms)
✔ deslocamento que não cabe no intervalo vira conflito, e o trecho longo aparece (0.4684ms)
✔ resumo do dia soma só o custo conhecido e sinaliza o que falta verificar (13.6665ms)
✔ concluir é ação explícita, registrada com autor e hora (2.2659ms)
✔ cancelar e corrigir exigem motivo; quem saiu não faz nada no roteiro (4.9235ms)
✔ dias e sequência: agrupa por dia, mantém a ordem e sugere a próxima posição (2.102ms)
✔ orçamento soma estimativas e compromissos, separados, e ignora cancelada (1.2521ms)
✔ orçamento não trata desconhecido como zero nem gratuito como gasto (0.4887ms)
✔ roteiro sem custo nenhum diz isso em vez de mostrar zero (0.2852ms)
✔ concluir mostra o impacto antes: previsto não muda e o saldo oficial não é calculado na tela (1.7785ms)
✔ concluir avisa o que continua indefinido: custo a verificar e atividade sem horário (0.4191ms)
✔ cancelar diz exatamente quanto sai do previsto e que o histórico não some (0.4087ms)
✔ cancelar custo desconhecido não inventa número nem some com o que faltava verificar (1.8062ms)
✔ rateio igualitário divide e explica quem recebeu o centavo (7.4476ms)
✔ rateio igualitário de 1 centavo entre 3 pessoas soma exatamente 1 centavo (1.3044ms)
✔ rateio percentual respeita os percentuais e fecha a conta (0.2744ms)
✔ rateio percentual exige soma de 100% (10.000 bps) (0.4615ms)
✔ rateio por valores fixos precisa conferir com o total (0.2407ms)
✔ rateio rejeita participantes duplicados, vazios e negativos (0.233ms)
✔ validarSomaExata confere totais (0.1305ms)
✔ rateio igualitário de valores grandes mantém soma exata e diferença de 1 centavo (0.2279ms)
✔ any participante ativo confirma início e fim da viagem; removido não (2.5636ms)
✔ a data sozinha nunca muda o estado — apenas sugere (15.6824ms)
✔ sugestão de conclusão aparece depois da data final, sem concluir sozinha (0.3617ms)
✔ não há sugestão em viagem concluída, cancelada ou pendente (0.155ms)
✔ fuso da viagem é respeitado ao decidir se a data chegou (1.1268ms)
✔ transições permitidas e papéis (0.6103ms)
✔ Pendente exige motivo explícito e é sugerido apenas por pessoas autorizadas (0.1682ms)
✔ viagem concluída não reabre automaticamente e cancelada não muda de estado (0.1641ms)
✔ cancelamento é assistido e lista impactos conhecidos (0.4116ms)
ℹ tests 109
ℹ suites 0
ℹ pass 109
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 594.848

> lia-go@0.1.0 test:sync
> npm run test --workspace @lia-go/sync


> @lia-go/sync@0.1.0 test
> node --test "tests/*.test.ts"

✔ mesclar carga junta listas por id e mantém a lista de viagens vinda do servidor (2.6586ms)
✔ resposta atrasada nunca rebaixa dado mais novo que já está no aparelho (0.2874ms)
✔ item marcado como removido sai da carga local (0.1434ms)
✔ a viagem aberta só é trocada se for a mesma e por versão igual ou maior (0.1966ms)
✔ sem versão (convites) o servidor sempre atualiza (1.0288ms)
✔ remover da carga e contar itens funcionam para a interface (0.2226ms)
✔ convites que recebi e convites da viagem são listas separadas (0.1627ms)
✔ lista sem id é ignorada em vez de virar lixo na interface (0.165ms)
✔ roteiro: atividades do dia entram na carga local (offline) e a mais nova vence (0.391ms)
✔ roteiro: atividade cancelada sai da carga quando o servidor marca como removida (0.3031ms)
✔ trocar a viagem aberta descarta o que era da viagem anterior (menos a lista da conta) (0.3409ms)
✔ detalhe da viagem nova entra mesmo sendo de outra viagem; o da antiga não volta por atraso (0.2574ms)
✔ cargaCompleta: cache gravado por versão anterior (sem as listas de hoje) não derruba a tela (0.1874ms)
✔ cargaCompleta de nada continua sendo a carga vazia (primeira abertura) (0.111ms)
✔ campo igual nos dois lados não é conflito (1.8492ms)
✔ campos diferentes alterados em cada lado são mesclados (não são a mesma decisão) (0.272ms)
✔ mesmo campo alterado nos dois lados sem dinheiro: segue com a versão do aparelho (0.3374ms)
✔ valor de despesa divergente NUNCA é resolvido sozinho (0.3365ms)
✔ moeda, rateio, participantes e quem pagou também contam como dinheiro (0.2798ms)
✔ conflito que junta dinheiro com campo simples continua exigindo decisão (0.1929ms)
✔ comparação para a tela usa português simples e marca o que é dinheiro (0.2813ms)
✔ rótulo de campo desconhecido não inventa nome bonito, mas também não quebra (0.1523ms)
✔ enfileirar preserva a ordem de criação e não duplica o mesmo id (5.6502ms)
✔ a próxima operação é a mais antiga; nada atrás de uma espera é enviado antes dela (0.6826ms)
✔ operação que precisa de decisão humana não bloqueia o resto da fila (0.2522ms)
✔ espera de reenvio cresce e tem teto (2s, 4s, 8s… máximo 5 min) (0.1593ms)
✔ erro de rede volta para a fila com espera crescente e guarda o motivo (0.2777ms)
✔ erro permanente para de tentar e aparece para a pessoa resolver (0.4481ms)
✔ conflito de versão vira estado 'conflito' com os dados para a pessoa decidir (0.2859ms)
✔ erros temporários do servidor continuam tentando (401, 429 e 5xx) (0.3831ms)
✔ sucesso tira a operação da fila e marca o 'tudo sincronizado' quando esvazia (0.4006ms)
✔ app fechado no meio do envio: 'enviando' volta para a fila em vez de ficar preso (0.5517ms)
✔ retentar volta a operação para a fila; descartar remove de vez (0.4098ms)
✔ retentar mantém o erro de conflito guardado (a tela precisa das duas versões) (0.2395ms)
✔ resumo da fila fala a língua da pessoa e prioriza o que precisa de decisão (1.4969ms)
✔ roteiro na fila: criar e concluir atividade funcionam offline e preservam a ordem (0.2369ms)
✔ operação criada durante a passada não é perdida pela gravação do fim (0.3463ms)
✔ estado mais novo da passada vale, mas o que chegou depois é preservado na ordem (0.2434ms)
✔ operação que falhou na passada mantém o erro registrado no aparelho (0.1995ms)
✔ offline: nada é enviado, a fila fica intacta e o relatório diz por quê (2.5412ms)
✔ online com fila vazia: só busca o que mudou e guarda o cursor (1.5061ms)
✔ envia na ordem de criação e busca de novo depois para a carga refletir o servidor (0.9118ms)
✔ a chave de idempotência enviada é o id da operação: reenvio nunca duplica (3.0156ms)
✔ falha de rede para a passada e preserva a ordem (nada fura a fila) (0.689ms)
✔ exceção na chamada (queda total) é tratada como problema de rede, não como sucesso (0.7627ms)
✔ regra de negócio violada não fica tentando e não trava as outras alterações (1.0096ms)
✔ conflito de versão para o envio e vira decisão da pessoa, sem sobrescrever nada (0.3431ms)
✔ se a busca falha, o envio ainda é tentado e o relatório não mente (0.3312ms)
ℹ tests 48
ℹ suites 0
ℹ pass 48
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 200.1974

> lia-go@0.1.0 test:app
> npm run test --workspace @lia-go/mobile


> @lia-go/mobile@0.1.0 test
> node --test "tests/*.test.ts" && npm run test:ui

✔ IndexedDB real (simulado em memória) grava, lê e apaga (10.2587ms)
✔ a fila volta do aparelho exatamente como foi guardada (fechar o app não perde nada) (2.1351ms)
✔ carga e cursor sobrevivem ao reinício e o cursor aceita nulo (1.5803ms)
✔ dado estragado no aparelho não derruba o app: vira fila vazia (0.4044ms)
✔ limpar apaga tudo do aparelho (usado ao sair da conta) (3.8602ms)
✔ escolha do armazenamento: nativo usa o do app; navegador usa IndexedDB; sem nenhum, memória (0.5477ms)
✔ custo desconhecido não vira número: fica omitido (e nunca R$ 0,00) (1.5465ms)
✔ custo gratuito é zero explícito, com rótulo que explica o zero (0.3964ms)
✔ estimativa e compromisso aparecem com o valor, sem inventar rótulo (0.2173ms)
✔ deslocamento é compacto: só mostra o que foi informado (0.2886ms)
✔ duração não inventa zero: sem duração não há texto (0.2752ms)
✔ dia do roteiro é legível em pt-BR e não escorrega de dia por fuso (25.7482ms)
✔ estado da atividade tem rótulo textual (nunca só a cor do marcador) (0.2043ms)
✔ atividade sem horário diz que é flexível — nunca inventa uma hora (1.0214ms)
✔ cartão mostra só o contexto que existe: local e duração ausentes não aparecem (0.7598ms)
✔ custo desconhecido fica omitido; a verificar aparece sinalizado (nunca R$ 0,00) (1.122ms)
✔ custo conhecido aparece com a natureza ao lado, na linha do valor (0.3505ms)
✔ gratuito é zero explícito e rotulado — diferente de desconhecido (0.1606ms)
✔ sem custo informado não recebe rótulo nenhum (0.1111ms)
✔ conflito tem manchete própria, explicando o tipo (0.1101ms)
✔ trecho de deslocamento: compacto por padrão, aberto quando é longo, caro ou arriscado (0.2289ms)
✔ resumo do dia: atenção só para o que exige decisão, e o previsto só quando existe (0.248ms)
✔ resumo do dia com uma atividade não usa plural torto (0.1926ms)
✔ cartão aceita a atividade na forma do servidor e na forma do domínio (a tela não fica em branco) (0.1771ms)
✔ atividade sem campo de custo nenhum não vira R$ 0,00 nem derruba o cartão (0.1281ms)
✔ custoDoCartao: forma do servidor, forma do domínio e nada — sem inventar zero (0.1467ms)
✔ offline: a despesa fica na fila com o texto certo e a fila sobrevive ao reinício (12.9825ms)
✔ a rede voltou: a fila é enviada e o cache passa a refletir o servidor (8.1016ms)
✔ cada reenvio usa a MESMA chave de idempotência (o servidor nunca aplica duas vezes) (2107.7052ms)
✔ conflito de versão: a pessoa escolhe, e 'manter o que fiz' reaplica sobre a versão atual (4.212ms)
✔ conflito: 'usar a versão do servidor' descarta a alteração do aparelho (2.3991ms)
✔ regra de negócio recusada para de tentar, mas não trava as outras alterações (4.6228ms)
✔ limpar dados deste aparelho apaga fila e cache, e a tela reflete na hora (5.1961ms)
✔ cinco pedidos durante uma passada viram uma passada seguinte, não cinco (1.5449ms)
✔ reserva criada offline sobe quando a rede volta e entra no cache como as outras entidades (2.1235ms)
✔ checklist do aparelho só entra na viagem aberta e item estragado é ignorado (1.9662ms)
✔ cache da viagem antiga não aparece na viagem nova (0.2554ms)
✔ viagem aberta entrega o detalhe e só as atividades dela (0.2369ms)
✔ permissão ausente ou incompleta nunca libera ação (1.2982ms)
✔ atividade vinda do servidor vira a forma do domínio (dinheiro em centavos, nada de float) (0.3725ms)
✔ atividade estragada no cache é ignorada, não derruba a tela (0.1812ms)
✔ atividadesDoDominio pega só as atividades da viagem aberta (0.2529ms)
✔ reserva de outra viagem não entra na tela (e a viagem aberta entrega as reservas dela) (0.1922ms)
✔ cache antigo, sem a lista de reservas, continua abrindo a viagem (quem atualiza tem cache velho) (0.2375ms)
✔ o próximo compromisso ignora o que passou e o que não vale mais (0.4653ms)
✔ o 'quando' do compromisso fala hoje, amanhã ou a data (2.0666ms)
ℹ tests 46
ℹ suites 0
ℹ pass 46
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2456.2053

> @lia-go/mobile@0.1.0 test:ui
> node ../../tools/teste-ui.mjs

✔ concluir mostra a revisão de impacto antes do botão e diz que o saldo oficial não muda aqui (143.5668ms)
✔ cancelar mostra quanto sai do previsto e que o histórico e as despesas ficam (33.4902ms)
✔ sem digitar o motivo, cancelar avisa o que falta e não muda nada (30.9522ms)
✔ item atrasado aparece como atrasado e continua em aberto (o prazo não conclui nada) (127.3033ms)
✔ concluir registra quem marcou e reabrir exige motivo (80.0528ms)
✔ item criado sem rede fica na fila do aparelho e aparece na hora (72.3464ms)
✔ documento novo nasce privado e a tela explica a privacidade (140.8534ms)
✔ compartilhar mostra o impacto antes e não promete cópia do arquivo (40.9671ms)
✔ remover exige motivo e diz que o registro continua guardado (63.3994ms)
✔ o fechamento traz os números do servidor, com o acerto como sugestão (112.8679ms)
Not implemented: navigation to another Document
Not implemented: navigation to another Document
✔ exportar gera o arquivo no navegador e não muda nada nos registros (50.7846ms)
✔ sem servidor, a tela diz que o fechamento precisa dele (nada de conta velha) (33.7885ms)
✔ a Visão geral traz o hero com a Lia e o próximo compromisso que ainda vai acontecer (107.9024ms)
✔ sem nada à frente, a tela diz que não há compromisso (nada inventado) (21.7783ms)
✔ com limite, a barra aparece e o previsto se compara ao combinado em texto (127.5079ms)
✔ no limite de atenção a tela avisa; passando dele, diz que passou (82.6658ms)
✔ sem limite, a tela explica que o teto é planejamento e oferece definir (60.4709ms)
✔ participante não define o limite do grupo: a tela diz de quem é a ação (39.7517ms)
✔ reserva aparece com o valor previsto e o desconhecido como 'Valor a verificar' (121.3823ms)
✔ confirmar sem evidência avisa e não muda nada; com evidência, registra quem confirmou (56.7435ms)
✔ cancelar mostra que o app não cancela no fornecedor e exige motivo (54.2393ms)
✔ criar reserva entra como prevista, com o valor combinado separado da estimativa (63.2413ms)
✔ abrir a viagem nova mostra a viagem nova, não a que estava aberta antes (108.2693ms)
✔ depois de abrir a viagem nova, o roteiro dela não mostra atividade da viagem antiga (25.1327ms)
✔ o botão Sair encerra a sessão na tela e apaga o que estava guardado no aparelho (34.548ms)
✔ Sair funciona mesmo se o servidor não responder (ninguém fica preso dentro do app) (24.7057ms)
✔ criar viagem já abre a viagem criada (rascunho precisa dos próximos passos) (39.016ms)
✔ aba Gastos mostra o previsto do roteiro separado do dinheiro oficial (43.4146ms)
ℹ tests 28
ℹ suites 0
ℹ pass 28
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 21591.0695

> lia-go@0.1.0 test:api
> npm run test --workspace @lia-go/api


> @lia-go/api@0.1.0 test
> node --env-file-if-exists=../../.env --test --test-concurrency=1 "tests/*.test.ts"

✔ registro cria conta, valida senha e não deixa e-mail duplicado (681.6946ms)
✔ login responde igual para senha errada e e-mail inexistente (205.3825ms)
✔ limite de tentativas bloqueia força bruta com 429 (928.8365ms)
✔ sessão web funciona por cookie e é encerrada no logout (91.0296ms)
✔ app nativo recebe access e refresh token; refresh é rotativo (181.3037ms)
✔ revogar sessões encerra tudo de uma vez (176.9852ms)
✔ saúde da API responde e exige banco de verdade (0.8435ms)
✔ item nasce aberto, com responsável e prazo opcionais (582.2062ms)
✔ responsável precisa participar da viagem (271.9696ms)
✔ prazo vencido continua aberto: quem conclui é uma pessoa, não o calendário (187.9949ms)
✔ concluir registra quem e quando; reabrir exige motivo e fica no histórico (196.8648ms)
✔ o banco recusa item feito sem autor e reabertura com motivo curto (228.6332ms)
✔ conflito de versão impede conclusão em cima de mudança que a pessoa não viu (252.7728ms)
✔ a sincronização devolve item criado e concluído pelo cursor (229.5817ms)
✔ viagem cancelada não recebe item novo, mas fechar o que existia continua valendo (187.8434ms)
✔ despesa nasce pendente, com rateio exato e sem entrar no saldo oficial (587.5229ms)
✔ divisão de centavos ímpar entre 3 pessoas soma exatamente o total (286.0328ms)
✔ quem lançou não confirma o próprio lançamento (regra garantida no servidor) (194.948ms)
✔ saldo oficial e sugestão de acerto só com despesa confirmada (188.8996ms)
✔ contestação mantém a despesa visível e fora do saldo oficial até resolver (198.9439ms)
✔ correção exige motivo, volta para pendente e preserva o histórico antes/depois (206.0927ms)
✔ participante que saiu não pode mais lançar despesa (180.3193ms)
✔ viagem cancelada bloqueia despesa nova e mantém correção possível (187.0445ms)
✔ rateio percentual e por valores são validados no servidor (276.1133ms)
✔ acerto: informado não altera saldo; recebedor confirma e zera (193.1148ms)
✔ chave de idempotência evita lançamento duplicado em reenvio de rede (190.8522ms)
✔ autorização negativa: estranho não vê despesas nem saldos de viagem alheia (277.1428ms)
✔ documento nasce privado: só quem criou vê, nem o organizador vê (591.2385ms)
✔ a lista explica a privacidade com o mesmo texto da tela (185.2428ms)
✔ link precisa ser http(s); sem link o documento ainda vale (190.4242ms)
✔ compartilhar é passo separado: com a viagem ou com pessoas, e chega na sincronização (312.056ms)
✔ revogar acesso tira da lista de quem perdeu o acesso (194.3211ms)
✔ quem não pode ver não age — nem o organizador em documento privado alheio (279.1261ms)
✔ documento compartilhado com a viagem pode ser cuidado por quem organiza (188.7718ms)
✔ remover exige motivo, vira remoção lógica e sai da lista de todo mundo menos do organizador (185.7742ms)
✔ quem perdeu o acesso recebe aviso para apagar a cópia guardada no aparelho (191.7501ms)
✔ o aviso de apagar não revela documento que a pessoa nunca viu (270.8186ms)
✔ impacto é mostrado antes de compartilhar ou remover (184.5823ms)
✔ conflito de versão protege quem está com a lista antiga na tela (189.8234ms)
✔ viagem cancelada não aceita documento novo, mas remover o que existia continua valendo (189.9064ms)
✔ quem não participa da viagem não vê nem cria documento (273.66ms)
✔ sem limite, o orçamento diz que não há limite e separa planejamento do oficial (583.4443ms)
✔ só quem organiza define o limite coletivo; qualquer pessoa define o próprio individual (207.181ms)
✔ o banco recusa limite coletivo com dono e limite individual sem dono (208.9123ms)
✔ o previsto soma roteiro e reservas e conta o que ainda não tem valor (263.9538ms)
✔ fechamento: total oficial só de confirmadas, acertos sugeridos e CSV para planilha (205.6092ms)
✔ despesa pendente não entra no total oficial do fechamento (e o texto avisa) (191.8599ms)
✔ quem não participa não vê orçamento nem fechamento (270.2076ms)
✔ reserva nasce prevista, com valor tratado como estimativa e sem confirmação (573.0479ms)
✔ sem valor informado, o custo é desconhecido (null) e fica marcado para verificar (194.6709ms)
✔ confirmar exige evidência e registra quem confirmou, com histórico (195.5147ms)
✔ confirmar de novo com versão antiga é conflito, não sobrescrita silenciosa (185.692ms)
✔ cancelar exige motivo, preserva a evidência e o banco recusa cancelamento sem motivo (210.2436ms)
✔ viagem cancelada não recebe reserva nova, mas registrar o que houve com a existente continua valendo (274.8445ms)
✔ a sincronização devolve reserva criada e confirmada pelo cursor (220.0988ms)
✔ quem não participa não vê reserva nenhuma (276.9743ms)
✔ atividade nasce planejada, flexível quando não tem horário, e o roteiro volta por dia (623.6658ms)
✔ custo: desconhecido não vira zero, 'a verificar' é sinalizado e gratuidade é explícita (220.4783ms)
✔ conflito aparece no resumo do dia e nas duas atividades, e ninguém remarca sozinho (209.7275ms)
✔ deslocamento que não cabe vira conflito explicado (risco de perder o compromisso) (217.1523ms)
✔ concluir é ação explícita: registra quem concluiu e quando; passar do horário não conclui (235.9792ms)
✔ cancelar e corrigir exigem motivo, versionam e ficam no histórico (249.4693ms)
✔ quem não participa não vê nem escreve no roteiro (307.4441ms)
✔ viagem cancelada bloqueia atividade nova e libera correção do que já existe (200.9682ms)
✔ roteiro entra na sincronização incremental (funciona offline) (225.683ms)
✔ reenvio com a mesma chave de idempotência não cria duas atividades (202.1416ms)
✔ a primeira sincronização traz tudo e devolve um cursor de sequência (493.5241ms)
✔ sem nada novo, o app não recebe despesas para reprocessar (128.0536ms)
✔ só o que mudou volta, e o cursor avança exatamente até a última mudança (118.3492ms)
✔ confirmação de outra pessoa e aceite de convite aparecem no delta (209.1319ms)
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