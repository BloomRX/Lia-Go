# Saída dos testes (rodada mais recente)
- **Quando:** 2026-10-16T14:07:44.030Z (local 16/10/2026, 11:07:44)
- **Node:** v26.8.1 · **npm:** 11.18.0 · **Sistema:** win32 x64
- **Placar:** 391 passaram · 9 falharam · 0 pulados · **Código de saída:** 1
- **Suítes com falha:** interface (jsdom)
- **Tipos:** COM ERRO
- **Arquivos de teste que não carregaram:** atividade.test.mjs, checklist.test.mjs, documentos.test.mjs, fechamento.test.mjs, inicio.test.mjs, notificacoes.test.mjs, orcamento.test.mjs, reservas.test.mjs, viagens.test.mjs
## Erros destacados
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\atividade.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
```
```
✖ J:\Lia-Go\apps\mobile\.ui-testes\atividade.test.mjs (319.0785ms)
node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\checklist.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
```
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\checklist.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
```
```
✖ J:\Lia-Go\apps\mobile\.ui-testes\checklist.test.mjs (106.0487ms)
node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\documentos.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
```
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\documentos.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
```
```
✖ J:\Lia-Go\apps\mobile\.ui-testes\documentos.test.mjs (108.4201ms)
node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\fechamento.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
```
## Saída completa
```

> lia-go@0.1.0 test:tools
> node --test "tools/test_dev.mjs"

✔ Windows: npm (`.cmd`) vira UMA linha executada pelo cmd.exe — sem `cmd.exe` sobrando na linha (2.992ms)
✔ Windows: caminho com espaço vira aspas (Program Files) (0.1551ms)
✔ prompt no lugar do programa é reconhecido como 'não rodou nada' (0.1891ms)
✔ Windows: programas .exe continuam sem shell (git, node, docker) (0.1384ms)
✔ Linux/macOS: nada de shell, mesmo com nome terminando em .cmd (0.1302ms)
✔ erro de spawn vira explicação em português, não um código solto (0.1752ms)
✔ rede instável vale tentar de novo; DNS/registro errado NÃO (seria perda de tempo) (0.6962ms)
✔ sintoma 'Exit handler never called' (npm se perdendo) explica e manda tentar de novo (0.1194ms)
✔ quando a tela não explica, o log interno do npm entra em cena (caso real medido) (0.4453ms)
✔ quando a tela já explica, o log não é usado (não confunde a pessoa) (0.1865ms)
✔ linhas relevantes são resumidas e sem repetição (0.1498ms)
✔ o caminho do log interno do npm é encontrado na saída (é onde mora o motivo real) (0.1847ms)
✔ Windows: o caminho do log com \ também é reconhecido (0.0796ms)
✔ proxy com senha é reconhecido separadamente da rede comum (0.0904ms)
✔ caso real: o pacote @fastify/proxy-addr no log NÃO é problema de proxy (0.0891ms)
✔ números soltos no log (tamanhos, códigos, portas) não viram causa falsa (0.0844ms)
✔ antivírus/arquivo preso (EPERM) explica fechar janelas (0.0836ms)
✔ cada causa conhecida tem dica acionável (0.1261ms)
✔ falha não reconhecida ainda dá orientação útil (e não mente sobre a causa) (0.0769ms)
✔ múltiplas causas específicas na mesma saída são todas reportadas (0.119ms)
✔ resumo da saída mostra o fim e nunca engole a mensagem de erro (0.1641ms)
✔ URL do banco é exibida sem senha (nunca vaza em relatório) (0.1308ms)
✔ leitura do .env ignora comentários e linhas vazias (0.1545ms)
✔ Windows procura o Python como `py -3`/`python` — `python3` não existe lá (0.1188ms)
✔ janela de Python para o banco embutido (3.9–3.12) — fora dela o pip não teria binário para baixar (0.1265ms)
✔ log do PostgreSQL vira dica acionável (administrador, porta ocupada) (0.2115ms)
✔ escolhe o arquivo de binários certo por sistema (e avisa quando não existe) (0.2322ms)
✔ avisa quando a plataforma não tem binário publicado (Windows/Linux ARM) (0.0774ms)
✔ extração do arquivo baixado tenta os programas certos em cada sistema (0.1426ms)
✔ diagnóstico do computador diz o essencial em português (0.1707ms)
✔ progresso do download é legível: barra, percentual, tamanho e velocidade (0.2121ms)
✔ tamanhos e tempos em português (0.1279ms)
✔ atualização: escolhe a referência e nunca decide mexer no que é da pessoa (0.2568ms)
✔ conflito pela metade é reconhecido (foi o que quebrou a rodada seguinte) (0.1518ms)
✔ limites de tempo são explicados em linguagem simples (0.1171ms)
✔ a rodada NÃO fica presa quando sobra um processo vivo (o caso do PostgreSQL) (76.4091ms)
✔ o placar dos testes é lido no console do Windows (ℹ) e no arquivo (TAP #) — nunca mais '0 passaram' (0.7413ms)
✔ saída de servidor é repassada linha por linha (nunca cola uma linha na outra) (0.2008ms)
✔ as funções principais do orquestrador continuam existindo (nenhuma remoção acidental) (2.7687ms)
✔ arquivo de teste que não carregou é reconhecido nos dois formatos do Node (0.445ms)
✔ teste comum que falhou NÃO é confundido com arquivo que não carregou (0.0902ms)
✔ o relatório leva o erro com contexto, não só o placar (0.3907ms)
✔ erro de TypeScript também entra no relatório como falha (0.0918ms)
✔ saída sem falha não inventa bloco de erro (relatório verde fica limpo) (0.0998ms)
ℹ tests 44
ℹ suites 0
ℹ pass 44
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 167.531


> lia-go@0.1.0 test:domain
> npm run test --workspace @lia-go/domain


> @lia-go/domain@0.1.0 test
> node --test "tests/*.test.ts"

✔ saldo = total pago − parte que lhe cabe (somente confirmadas) (5.1474ms)
✔ despesa pendente e contestada ficam em comprometido, fora do saldo oficial (1.0325ms)
✔ despesa pessoal não gera dívida entre participantes (0.345ms)
✔ transferências confirmadas quitam o saldo; informadas e contestadas não (0.4039ms)
✔ sugestão de transferências minimiza o número de pagamentos e fecha exatamente (2.0836ms)
✔ saldo zerado não sugere transferências (0.5198ms)
✔ item nasce aberto, sem prazo inventado e com validações de gente (3.6677ms)
✔ o prazo não conclui nada: passou da data, o item continua aberto e só fica marcado como atrasado (0.3523ms)
✔ concluir registra quem e quando; concluir de novo é recusado (0.3152ms)
✔ reabrir exige motivo e deixa rastro de por que voltou (2.3195ms)
✔ resumo adaptativo: só fala do que existe (aberto, feito, atrasado, hoje, sem responsável) (1.9985ms)
✔ ordem de leitura: atrasado primeiro, depois prazo mais próximo, sem prazo e feitos no fim (2.1462ms)
✔ documento nasce privado e só quem criou vê (2.6681ms)
✔ link estranho é recusado (nada de caminho disfarçado) (1.2364ms)
✔ compartilhar com a viagem dá acesso a todos; com pessoas, só a elas (0.6615ms)
✔ revogar tira o acesso sem apagar a história (2.4359ms)
✔ remover exige motivo, revoga o acesso e mantém o registro para quem administra (0.4881ms)
✔ resumo conta o que existe: só seus, compartilhados e removidos (0.5661ms)
✔ impacto antes de compartilhar e de remover diz o que acontece de verdade (0.5532ms)
✔ despesa nova nasce pendente e não entra no saldo oficial (5.5287ms)
✔ campos obrigatórios são validados (1.3796ms)
✔ confirmação exige outra pessoa e move a despesa para o saldo oficial (0.8238ms)
✔ não é possível confirmar duas vezes nem confirmar cancelada (0.5106ms)
✔ contestação exige motivo, vem de outra pessoa e tira a despesa do saldo oficial (0.6834ms)
✔ correção exige motivo, preserva histórico e volta para pendente (1.1988ms)
✔ despesa pessoal não cria obrigação para outras pessoas (0.3552ms)
✔ rateio da despesa compartilhada pode ser percentual ou por valores (7.7876ms)
✔ despesa de valor quebrado em 3 pessoas soma exatamente o total (1.5171ms)
✔ histórico preservado em sequência completa: criar → confirmar → contestar → corrigir → confirmar (1.1058ms)
✔ só despesa confirmada entra no total oficial; o resto aparece separado, com aviso (92.424ms)
✔ saldos e acertos sugeridos: quem pagou recebe, quem deve paga, e é sugestão (2.801ms)
✔ o previsto (roteiro + reservas) sai do total oficial e é rotulado como planejamento (1.1222ms)
✔ limite combinado aparece no fechamento e o estouro é avisado (0.7342ms)
✔ CSV: separador de planilha pt-BR, valores com vírgula e guarda contra fórmula (0.6441ms)
✔ campoCsv: aspas, quebra de linha e perigo de fórmula (0.2278ms)
✔ convite normaliza e-mail e expira em 14 dias por padrão (1.8561ms)
✔ convite expirado não pode ser aceito (8.4601ms)
✔ só o dono do e-mail convidado aceita o convite (10.6686ms)
✔ organizador cancela convite pendente; participante não (0.5354ms)
✔ consequências de sair/remover preservam histórico e pendências (0.7542ms)
✔ centavos recusa número fracionário (nunca float como dinheiro) (3.2664ms)
✔ analisarValorMonetario entende formatos brasileiros (1.3131ms)
✔ analisarValorMonetario rejeita entrada inválida (0.4222ms)
✔ formatarBRL formata centavos em pt-BR (0.402ms)
✔ alocarProporcional garante soma exata em divisão quebrada (4.2426ms)
✔ alocarProporcional é determinístico e soma exata em casos-limite (0.8903ms)
✔ com pesos iguais a diferença entre partes é de no máximo 1 centavo (0.4186ms)
✔ alocarProporcional trata total negativo (estorno) preservando a soma (0.2636ms)
✔ alocarProporcional rejeita pesos inválidos (0.4155ms)
✔ convite recebido é obrigação minha, de alta prioridade, e não decide por mim (3.1449ms)
✔ convite recebido vencido diz que o prazo passou e que o antigo não dá acesso (0.521ms)
✔ convite que vence hoje ainda vale hoje (o dia inteiro conta) (0.2476ms)
✔ convite enviado e ainda pendente aparece como lembrete médio de quem convidou (0.3969ms)
✔ convite já aceito não gera notificação nenhuma (0.2519ms)
✔ convite enviado que venceu vira alta prioridade (precisa convidar de novo) (0.2831ms)
✔ despesa pendente em viagem acontecendo é alta prioridade e não acusa ninguém (0.3409ms)
✔ despesa pendente em viagem que ainda não começou é média prioridade (0.3019ms)
✔ viagem cancelada não gera pendência financeira na central (0.2013ms)
✔ viagem sem pendência não gera nada (nada de aviso de rotina) (0.2857ms)
✔ rascunho avisa só quem organiza, e o texto diz que o estado não muda sozinho (0.5671ms)
✔ rascunho sem data diz que faltam as datas (e não inventa prazo) (0.2725ms)
✔ pagamento informado para mim é alta prioridade: informar não é pagar (0.5893ms)
✔ pagamento que eu informei é informativo (baixa) e não cobra a outra pessoa (0.198ms)
✔ movimento confirmado deixa de ser notificação (a obrigação acabou) (0.1402ms)
✔ movimento entre outras duas pessoas não vira notificação minha (0.1129ms)
✔ item atrasado meu é alta prioridade e o texto deixa claro que ninguém conclui por mim (0.3981ms)
✔ item atrasado de outra pessoa é lembrete de baixa prioridade, com o nome de quem pegou (0.1928ms)
✔ item atrasado sem responsável é média: é do grupo e alguém precisa assumir (0.1711ms)
✔ item para hoje é lembrete (média) — o dia ainda não acabou (0.1762ms)
✔ item concluído não aparece, mesmo com prazo vencido (0.1315ms)
✔ item sem prazo não vira notificação (sem data não há atraso) (0.1529ms)
✔ lista vazia de dados não inventa notificação nenhuma (1.0102ms)
✔ reserva sem valor aparece como média e explica que nunca vale zero (0.3681ms)
✔ orçamento em atenção é média; estourado é alta — e os dois dizem que o saldo oficial não mudou (0.289ms)
✔ orçamento dentro do limite (ou sem limite) não gera notificação (0.1282ms)
✔ marcar como lida não resolve: continua aberta, só deixa de ser 'não lida' (0.4994ms)
✔ desmarcar volta para 'ainda não vi' (o botão de arrepender funciona) (0.247ms)
✔ dispensar tira da lista de abertas, mas o filtro 'dispensadas' mostra (0.2964ms)
✔ dispensar não esconde o problema quando ele piora: a chave muda com o fato (0.1817ms)
✔ resolvida é o fato que sumiu dos dados: sai das abertas e entra no histórico (0.3114ms)
✔ histórico de resolvidas vem da mais recente para a mais antiga (0.4195ms)
✔ marca antiga é podada quando o histórico cresce demais (o aparelho não guarda para sempre) (0.4968ms)
✔ filtro por viagem isola o que é daquela viagem (inclusive a busca) (13.6025ms)
✔ filtro por categoria e por prioridade combinam entre si (0.5143ms)
✔ filtro 'só as minhas' traz obrigação de quem pergunta, não o que é de outro (0.67ms)
✔ busca ignora acento e maiúscula (quem digita 'pousada' acha 'Pousada') (0.6953ms)
✔ ordem: alta primeiro; entre iguais, o que ainda não foi visto vem antes (0.2451ms)
✔ resumo descreve o que a tela mostra, sem prometer o que não há (0.2911ms)
✔ filtro de viagens lista só o que tem notificação, em ordem alfabética e sem repetir (0.5342ms)
✔ cada notificação tem um próximo passo concreto e um destino válido (0.2311ms)
✔ chaves não se repetem: fato diferente, notificação diferente (0.1968ms)
✔ limite coletivo não pertence a uma pessoa; individual precisa dizer de quem é (3.7323ms)
✔ sem limite o app diz 'sem limite' em vez de inventar um teto (3.033ms)
✔ dentro, perto e estourado: o estado sai do número, com alerta em texto (1.664ms)
✔ previsto estourado sem gasto ainda dá para replanejar (e a tela diz isso) (0.3386ms)
✔ custo sem valor informado aparece como aviso: o previsto é o mínimo (0.2981ms)
✔ aguardando confirmação aparece separado do oficial no resumo (0.2589ms)
✔ limite zero é um combinado explícito, não um erro silencioso (0.2995ms)
✔ participante registra despesas e propõe; administração é do organizador (1.2263ms)
✔ motivo é sempre explicado para a interface (0.334ms)
✔ convite pendente, quem saiu e quem foi removido não têm acesso (0.2439ms)
✔ viagem cancelada bloqueia novos compromissos e libera correções (0.1854ms)
✔ viagem concluída bloqueia lançamentos novos e mantém acertos (0.1832ms)
✔ quem lançou não confirma o próprio lançamento (0.2049ms)
✔ início e conclusão podem ser confirmados por qualquer participante ativo (0.1857ms)
✔ reserva nasce prevista e sem confirmação: confirmar é ato separado, com evidência (2.3477ms)
✔ custo desconhecido é null (nunca zero) e fica marcado para verificar (0.26ms)
✔ confirmar exige evidência e registra quem confirmou e quando (0.7605ms)
✔ o valor não muda ao confirmar: muda a natureza (estimativa → já combinado) (2.0867ms)
✔ reserva gratuita continua zero explícito, e não "a verificar" (0.2458ms)
✔ cancelar exige motivo, preserva a evidência e não volta atrás (0.5233ms)
✔ ordem de leitura: com data primeiro, sem data depois, cancelada por último (1.3507ms)
✔ resumo separa previsto de já combinado e ignora cancelada (15.4481ms)
✔ resumo sem reserva nenhuma diz isso em vez de mostrar números vazios (0.3588ms)
✔ confirmar mostra o impacto: natureza muda, saldo oficial não (1.2487ms)
✔ cancelar avisa que não cancela no fornecedor e diz quanto sai do previsto (0.6286ms)
✔ custo desconhecido não vira número no impacto de nenhuma das ações (0.5212ms)
✔ campos inválidos são recusados com mensagem de gente (2.2533ms)
✔ o relógio nunca conclui uma atividade: só muda o que a tela mostra (2.1215ms)
✔ atividade sem horário fica na sequência lógica: nada de horário inventado (1.0075ms)
✔ custo desconhecido nunca vira R$ 0,00 (desconhecido, a verificar e gratuito são coisas diferentes) (0.6186ms)
✔ conflito de horário é explicado nos dois níveis e nunca resolvido sozinho (0.566ms)
✔ deslocamento que não cabe no intervalo vira conflito, e o trecho longo aparece (0.2431ms)
✔ resumo do dia soma só o custo conhecido e sinaliza o que falta verificar (7.0142ms)
✔ concluir é ação explícita, registrada com autor e hora (0.4587ms)
✔ cancelar e corrigir exigem motivo; quem saiu não faz nada no roteiro (0.4064ms)
✔ dias e sequência: agrupa por dia, mantém a ordem e sugere a próxima posição (0.3646ms)
✔ orçamento soma estimativas e compromissos, separados, e ignora cancelada (0.4472ms)
✔ orçamento não trata desconhecido como zero nem gratuito como gasto (0.2435ms)
✔ roteiro sem custo nenhum diz isso em vez de mostrar zero (0.1203ms)
✔ concluir mostra o impacto antes: previsto não muda e o saldo oficial não é calculado na tela (0.2387ms)
✔ concluir avisa o que continua indefinido: custo a verificar e atividade sem horário (0.1308ms)
✔ cancelar diz exatamente quanto sai do previsto e que o histórico não some (0.1457ms)
✔ cancelar custo desconhecido não inventa número nem some com o que faltava verificar (0.1495ms)
✔ atividade nasce sem reserva e sem observação; o que não foi dito fica nulo (0.0853ms)
✔ criar com observação e reserva guarda os dois — e a observação é aparada (0.0974ms)
✔ observação em branco não vira texto: é o mesmo que não ter dito nada (0.0938ms)
✔ corrigir vincula e desvincula reserva, guardando o motivo e subindo a versão (0.1136ms)
✔ corrigir só a observação não mexe na reserva (e vice-versa) (0.1074ms)
✔ vincular reserva não confirma nada e não muda o custo da atividade (0.1032ms)
✔ rateio igualitário divide e explica quem recebeu o centavo (1.8036ms)
✔ rateio igualitário de 1 centavo entre 3 pessoas soma exatamente 1 centavo (0.1782ms)
✔ rateio percentual respeita os percentuais e fecha a conta (0.2675ms)
✔ rateio percentual exige soma de 100% (10.000 bps) (0.4434ms)
✔ rateio por valores fixos precisa conferir com o total (0.213ms)
✔ rateio rejeita participantes duplicados, vazios e negativos (0.2397ms)
✔ validarSomaExata confere totais (0.1304ms)
✔ rateio igualitário de valores grandes mantém soma exata e diferença de 1 centavo (0.2101ms)
✔ any participante ativo confirma início e fim da viagem; removido não (3.604ms)
✔ a data sozinha nunca muda o estado — apenas sugere (15.6701ms)
✔ sugestão de conclusão aparece depois da data final, sem concluir sozinha (0.3195ms)
✔ não há sugestão em viagem concluída, cancelada ou pendente (0.1412ms)
✔ fuso da viagem é respeitado ao decidir se a data chegou (0.7558ms)
✔ transições permitidas e papéis (0.5438ms)
✔ Pendente exige motivo explícito e é sugerido apenas por pessoas autorizadas (0.1649ms)
✔ viagem concluída não reabre automaticamente e cancelada não muda de estado (0.1518ms)
✔ cancelamento é assistido e lista impactos conhecidos (0.3869ms)
ℹ tests 157
ℹ suites 0
ℹ pass 157
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 499.4598


> lia-go@0.1.0 test:sync
> npm run test --workspace @lia-go/sync


> @lia-go/sync@0.1.0 test
> node --test "tests/*.test.ts"

✔ mesclar carga junta listas por id e mantém a lista de viagens vinda do servidor (1.6661ms)
✔ resposta atrasada nunca rebaixa dado mais novo que já está no aparelho (0.1866ms)
✔ item marcado como removido sai da carga local (0.1326ms)
✔ a viagem aberta só é trocada se for a mesma e por versão igual ou maior (1.2221ms)
✔ sem versão (convites) o servidor sempre atualiza (0.1821ms)
✔ remover da carga e contar itens funcionam para a interface (0.3695ms)
✔ convites que recebi e convites da viagem são listas separadas (0.1834ms)
✔ lista sem id é ignorada em vez de virar lixo na interface (0.19ms)
✔ roteiro: atividades do dia entram na carga local (offline) e a mais nova vence (0.2607ms)
✔ roteiro: atividade cancelada sai da carga quando o servidor marca como removida (0.21ms)
✔ trocar a viagem aberta descarta o que era da viagem anterior (menos a lista da conta) (0.1909ms)
✔ detalhe da viagem nova entra mesmo sendo de outra viagem; o da antiga não volta por atraso (0.1552ms)
✔ cargaCompleta: cache gravado por versão anterior (sem as listas de hoje) não derruba a tela (0.1905ms)
✔ cargaCompleta de nada continua sendo a carga vazia (primeira abertura) (0.1738ms)
✔ campo igual nos dois lados não é conflito (1.3973ms)
✔ campos diferentes alterados em cada lado são mesclados (não são a mesma decisão) (0.1697ms)
✔ mesmo campo alterado nos dois lados sem dinheiro: segue com a versão do aparelho (0.2428ms)
✔ valor de despesa divergente NUNCA é resolvido sozinho (0.1978ms)
✔ moeda, rateio, participantes e quem pagou também contam como dinheiro (0.1963ms)
✔ conflito que junta dinheiro com campo simples continua exigindo decisão (0.16ms)
✔ comparação para a tela usa português simples e marca o que é dinheiro (0.1782ms)
✔ rótulo de campo desconhecido não inventa nome bonito, mas também não quebra (0.0999ms)
✔ enfileirar preserva a ordem de criação e não duplica o mesmo id (5.9778ms)
✔ a próxima operação é a mais antiga; nada atrás de uma espera é enviado antes dela (0.545ms)
✔ operação que precisa de decisão humana não bloqueia o resto da fila (0.2517ms)
✔ espera de reenvio cresce e tem teto (2s, 4s, 8s… máximo 5 min) (0.1535ms)
✔ erro de rede volta para a fila com espera crescente e guarda o motivo (0.2244ms)
✔ erro permanente para de tentar e aparece para a pessoa resolver (0.2366ms)
✔ conflito de versão vira estado 'conflito' com os dados para a pessoa decidir (0.1979ms)
✔ erros temporários do servidor continuam tentando (401, 429 e 5xx) (0.2386ms)
✔ sucesso tira a operação da fila e marca o 'tudo sincronizado' quando esvazia (0.2331ms)
✔ app fechado no meio do envio: 'enviando' volta para a fila em vez de ficar preso (0.4202ms)
✔ retentar volta a operação para a fila; descartar remove de vez (0.3757ms)
✔ retentar mantém o erro de conflito guardado (a tela precisa das duas versões) (0.2286ms)
✔ resumo da fila fala a língua da pessoa e prioriza o que precisa de decisão (0.5696ms)
✔ roteiro na fila: criar e concluir atividade funcionam offline e preservam a ordem (0.2189ms)
✔ operação criada durante a passada não é perdida pela gravação do fim (0.4092ms)
✔ estado mais novo da passada vale, mas o que chegou depois é preservado na ordem (0.1982ms)
✔ operação que falhou na passada mantém o erro registrado no aparelho (0.1822ms)
✔ offline: nada é enviado, a fila fica intacta e o relatório diz por quê (1.5932ms)
✔ online com fila vazia: só busca o que mudou e guarda o cursor (1.7728ms)
✔ envia na ordem de criação e busca de novo depois para a carga refletir o servidor (0.6416ms)
✔ a chave de idempotência enviada é o id da operação: reenvio nunca duplica (2.1443ms)
✔ falha de rede para a passada e preserva a ordem (nada fura a fila) (0.4136ms)
✔ exceção na chamada (queda total) é tratada como problema de rede, não como sucesso (0.4137ms)
✔ regra de negócio violada não fica tentando e não trava as outras alterações (0.4895ms)
✔ conflito de versão para o envio e vira decisão da pessoa, sem sobrescrever nada (0.3818ms)
✔ se a busca falha, o envio ainda é tentado e o relatório não mente (0.4741ms)
✔ a passada grava a fila dentro da seção crítica do armazenamento (nunca ler-depois-gravar) (0.708ms)
ℹ tests 49
ℹ suites 0
ℹ pass 49
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 177.7719


> lia-go@0.1.0 test:app
> npm run test --workspace @lia-go/mobile


> @lia-go/mobile@0.1.0 test
> node --test "tests/*.test.ts"

✔ IndexedDB real (simulado em memória) grava, lê e apaga (11.0771ms)
✔ a fila volta do aparelho exatamente como foi guardada (fechar o app não perde nada) (1.3848ms)
✔ carga e cursor sobrevivem ao reinício e o cursor aceita nulo (0.789ms)
✔ dado estragado no aparelho não derruba o app: vira fila vazia (0.2408ms)
✔ limpar apaga tudo do aparelho (usado ao sair da conta) (2.4952ms)
✔ escolha do armazenamento: nativo usa o do app; navegador usa IndexedDB; sem nenhum, memória (0.3568ms)
✔ mutar é atômico: duas transformações ao mesmo tempo não se atropelam (1.4569ms)
✔ transformar a fila acontece dentro da seção crítica do armazenamento (0.3186ms)
✔ a passada preserva o que entrou durante ela e descarta o que ela mesma enviou (1.3746ms)
✔ custo desconhecido não vira número: fica omitido (e nunca R$ 0,00) (1.1141ms)
✔ custo gratuito é zero explícito, com rótulo que explica o zero (0.2645ms)
✔ estimativa e compromisso aparecem com o valor, sem inventar rótulo (0.1421ms)
✔ deslocamento é compacto: só mostra o que foi informado (0.1644ms)
✔ duração não inventa zero: sem duração não há texto (0.1515ms)
✔ dia do roteiro é legível em pt-BR e não escorrega de dia por fuso (14.7024ms)
✔ estado da atividade tem rótulo textual (nunca só a cor do marcador) (0.15ms)
✔ atividade sem horário diz que é flexível — nunca inventa uma hora (2.115ms)
✔ cartão mostra só o contexto que existe: local e duração ausentes não aparecem (0.8446ms)
✔ custo desconhecido fica omitido; a verificar aparece sinalizado (nunca R$ 0,00) (0.3538ms)
✔ custo conhecido aparece com a natureza ao lado, na linha do valor (0.6344ms)
✔ gratuito é zero explícito e rotulado — diferente de desconhecido (0.2163ms)
✔ sem custo informado não recebe rótulo nenhum (0.1301ms)
✔ conflito tem manchete própria, explicando o tipo (0.1318ms)
✔ trecho de deslocamento: compacto por padrão, aberto quando é longo, caro ou arriscado (0.4432ms)
✔ resumo do dia: atenção só para o que exige decisão, e o previsto só quando existe (0.3351ms)
✔ resumo do dia com uma atividade não usa plural torto (0.2241ms)
✔ cartão aceita a atividade na forma do servidor e na forma do domínio (a tela não fica em branco) (0.2226ms)
✔ atividade sem campo de custo nenhum não vira R$ 0,00 nem derruba o cartão (0.1639ms)
✔ custoDoCartao: forma do servidor, forma do domínio e nada — sem inventar zero (0.19ms)
✔ offline: a despesa fica na fila com o texto certo e a fila sobrevive ao reinício (11.5873ms)
✔ a rede voltou: a fila é enviada e o cache passa a refletir o servidor (6.1711ms)
✔ cada reenvio usa a MESMA chave de idempotência (o servidor nunca aplica duas vezes) (2105.2808ms)
✔ conflito de versão: a pessoa escolhe, e 'manter o que fiz' reaplica sobre a versão atual (5.9507ms)
✔ conflito: 'usar a versão do servidor' descarta a alteração do aparelho (3.7482ms)
✔ regra de negócio recusada para de tentar, mas não trava as outras alterações (2.5345ms)
✔ limpar dados deste aparelho apaga fila e cache, e a tela reflete na hora (2.1755ms)
✔ cinco pedidos durante uma passada viram uma passada seguinte, não cinco (1.3739ms)
✔ reserva criada offline sobe quando a rede volta e entra no cache como as outras entidades (1.7985ms)
✔ checklist do aparelho só entra na viagem aberta e item estragado é ignorado (3.1533ms)
✔ cache da viagem antiga não aparece na viagem nova (0.163ms)
✔ viagem aberta entrega o detalhe e só as atividades dela (0.1685ms)
✔ permissão ausente ou incompleta nunca libera ação (0.1399ms)
✔ atividade vinda do servidor vira a forma do domínio (dinheiro em centavos, nada de float) (0.2179ms)
✔ atividade estragada no cache é ignorada, não derruba a tela (0.1237ms)
✔ atividadesDoDominio pega só as atividades da viagem aberta (0.1622ms)
✔ reserva de outra viagem não entra na tela (e a viagem aberta entrega as reservas dela) (0.144ms)
✔ cache antigo, sem a lista de reservas, continua abrindo a viagem (quem atualiza tem cache velho) (0.2172ms)
✔ o próximo compromisso ignora o que passou e o que não vale mais (0.3515ms)
✔ o 'quando' do compromisso fala hoje, amanhã ou a data (0.9834ms)
ℹ tests 49
ℹ suites 0
ℹ pass 49
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3047.8833


> lia-go@0.1.0 test:ui
> node tools/teste-ui.mjs

node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\atividade.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.8.1
✖ J:\Lia-Go\apps\mobile\.ui-testes\atividade.test.mjs (319.0785ms)
node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\checklist.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.8.1
✖ J:\Lia-Go\apps\mobile\.ui-testes\checklist.test.mjs (106.0487ms)
node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\documentos.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.8.1
✖ J:\Lia-Go\apps\mobile\.ui-testes\documentos.test.mjs (108.4201ms)
node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\fechamento.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.8.1
✖ J:\Lia-Go\apps\mobile\.ui-testes\fechamento.test.mjs (107.5918ms)
node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\inicio.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.8.1
✖ J:\Lia-Go\apps\mobile\.ui-testes\inicio.test.mjs (107.7371ms)
node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\notificacoes.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.8.1
✖ J:\Lia-Go\apps\mobile\.ui-testes\notificacoes.test.mjs (107.2095ms)
node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\orcamento.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.8.1
✖ J:\Lia-Go\apps\mobile\.ui-testes\orcamento.test.mjs (105.242ms)
node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\reservas.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.8.1
✖ J:\Lia-Go\apps\mobile\.ui-testes\reservas.test.mjs (105.2483ms)
node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\viagens.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.8.1
✖ J:\Lia-Go\apps\mobile\.ui-testes\viagens.test.mjs (106.1514ms)
ℹ tests 9
ℹ suites 0
ℹ pass 0
ℹ fail 9
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1186.7307

✖ failing tests:

test at apps\mobile\.ui-testes\atividade.test.mjs:1:1
✖ J:\Lia-Go\apps\mobile\.ui-testes\atividade.test.mjs (319.0785ms)
  'test failed'

test at apps\mobile\.ui-testes\checklist.test.mjs:1:1
✖ J:\Lia-Go\apps\mobile\.ui-testes\checklist.test.mjs (106.0487ms)
  'test failed'

test at apps\mobile\.ui-testes\documentos.test.mjs:1:1
✖ J:\Lia-Go\apps\mobile\.ui-testes\documentos.test.mjs (108.4201ms)
  'test failed'

test at apps\mobile\.ui-testes\fechamento.test.mjs:1:1
✖ J:\Lia-Go\apps\mobile\.ui-testes\fechamento.test.mjs (107.5918ms)
  'test failed'

test at apps\mobile\.ui-testes\inicio.test.mjs:1:1
✖ J:\Lia-Go\apps\mobile\.ui-testes\inicio.test.mjs (107.7371ms)
  'test failed'

test at apps\mobile\.ui-testes\notificacoes.test.mjs:1:1
✖ J:\Lia-Go\apps\mobile\.ui-testes\notificacoes.test.mjs (107.2095ms)
  'test failed'

test at apps\mobile\.ui-testes\orcamento.test.mjs:1:1
✖ J:\Lia-Go\apps\mobile\.ui-testes\orcamento.test.mjs (105.242ms)
  'test failed'

test at apps\mobile\.ui-testes\reservas.test.mjs:1:1
✖ J:\Lia-Go\apps\mobile\.ui-testes\reservas.test.mjs (105.2483ms)
  'test failed'

test at apps\mobile\.ui-testes\viagens.test.mjs:1:1
✖ J:\Lia-Go\apps\mobile\.ui-testes\viagens.test.mjs (106.1514ms)
  'test failed'
node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\atividade.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.8.1
node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\checklist.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.8.1
node:internal/modules/package_json_reader:331
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\documentos.test.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.8.1

==================== POR QUE NÃO CARREGOU ====================

atividade.test.mjs:
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\atividade.test.mjs

checklist.test.mjs:
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\checklist.test.mjs

documentos.test.mjs:
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'lucide-react' imported from J:\Lia-Go\apps\mobile\.ui-testes\documentos.test.mjs

Detalhes em reports\interface-diagnostico.md (vai junto no relatório da rodada).
==============================================================


> lia-go@0.1.0 test:api
> npm run test --workspace @lia-go/api


> @lia-go/api@0.1.0 test
> node --env-file-if-exists=../../.env --test --test-concurrency=1 "tests/*.test.ts"

✔ registro cria conta, valida senha e não deixa e-mail duplicado (2452.044ms)
✔ login responde igual para senha errada e e-mail inexistente (194.7849ms)
✔ limite de tentativas bloqueia força bruta com 429 (903.4142ms)
✔ sessão web funciona por cookie e é encerrada no logout (89.1251ms)
✔ app nativo recebe access e refresh token; refresh é rotativo (171.5991ms)
✔ revogar sessões encerra tudo de uma vez (168.0121ms)
✔ saúde da API responde e exige banco de verdade (0.6684ms)
✔ item nasce aberto, com responsável e prazo opcionais (535.1706ms)
✔ responsável precisa participar da viagem (261.934ms)
✔ prazo vencido continua aberto: quem conclui é uma pessoa, não o calendário (179.5736ms)
✔ concluir registra quem e quando; reabrir exige motivo e fica no histórico (195.8946ms)
✔ o banco recusa item feito sem autor e reabertura com motivo curto (205.5323ms)
✔ conflito de versão impede conclusão em cima de mudança que a pessoa não viu (223.628ms)
✔ a sincronização devolve item criado e concluído pelo cursor (217.9837ms)
✔ viagem cancelada não recebe item novo, mas fechar o que existia continua valendo (181.3776ms)
✔ despesa nasce pendente, com rateio exato e sem entrar no saldo oficial (545.2087ms)
✔ divisão de centavos ímpar entre 3 pessoas soma exatamente o total (266.1695ms)
✔ quem lançou não confirma o próprio lançamento (regra garantida no servidor) (185.9657ms)
✔ saldo oficial e sugestão de acerto só com despesa confirmada (181.4269ms)
✔ contestação mantém a despesa visível e fora do saldo oficial até resolver (185.3724ms)
✔ correção exige motivo, volta para pendente e preserva o histórico antes/depois (187.7046ms)
✔ participante que saiu não pode mais lançar despesa (175.2445ms)
✔ viagem cancelada bloqueia despesa nova e mantém correção possível (180.5175ms)
✔ rateio percentual e por valores são validados no servidor (259.8381ms)
✔ acerto: informado não altera saldo; recebedor confirma e zera (186.5782ms)
✔ chave de idempotência evita lançamento duplicado em reenvio de rede (182.1999ms)
✔ autorização negativa: estranho não vê despesas nem saldos de viagem alheia (259.6232ms)
✔ documento nasce privado: só quem criou vê, nem o organizador vê (531.0158ms)
✔ a lista explica a privacidade com o mesmo texto da tela (177.2813ms)
✔ link precisa ser http(s); sem link o documento ainda vale (175.8393ms)
✔ compartilhar é passo separado: com a viagem ou com pessoas, e chega na sincronização (288.3919ms)
✔ revogar acesso tira da lista de quem perdeu o acesso (180.982ms)
✔ quem não pode ver não age — nem o organizador em documento privado alheio (277.2693ms)
✔ documento compartilhado com a viagem pode ser cuidado por quem organiza (181.5366ms)
✔ remover exige motivo, vira remoção lógica e sai da lista de todo mundo menos do organizador (181.9703ms)
✔ quem perdeu o acesso recebe aviso para apagar a cópia guardada no aparelho (183.7644ms)
✔ o aviso de apagar não revela documento que a pessoa nunca viu (259.3305ms)
✔ impacto é mostrado antes de compartilhar ou remover (176.1854ms)
✔ conflito de versão protege quem está com a lista antiga na tela (176.3516ms)
✔ viagem cancelada não aceita documento novo, mas remover o que existia continua valendo (176.2915ms)
✔ quem não participa da viagem não vê nem cria documento (254.6236ms)
✔ sem limite, o orçamento diz que não há limite e separa planejamento do oficial (558.1573ms)
✔ só quem organiza define o limite coletivo; qualquer pessoa define o próprio individual (196.552ms)
✔ o banco recusa limite coletivo com dono e limite individual sem dono (195.0896ms)
✔ o previsto soma roteiro e reservas e conta o que ainda não tem valor (234.7753ms)
✔ fechamento: total oficial só de confirmadas, acertos sugeridos e CSV para planilha (193.3666ms)
✔ despesa pendente não entra no total oficial do fechamento (e o texto avisa) (178.6137ms)
✔ quem não participa não vê orçamento nem fechamento (256.5743ms)
✔ reserva nasce prevista, com valor tratado como estimativa e sem confirmação (535.2846ms)
✔ sem valor informado, o custo é desconhecido (null) e fica marcado para verificar (178.6875ms)
✔ confirmar exige evidência e registra quem confirmou, com histórico (180.5638ms)
✔ confirmar de novo com versão antiga é conflito, não sobrescrita silenciosa (183.446ms)
✔ cancelar exige motivo, preserva a evidência e o banco recusa cancelamento sem motivo (179.0755ms)
✔ viagem cancelada não recebe reserva nova, mas registrar o que houve com a existente continua valendo (214.2246ms)
✔ a sincronização devolve reserva criada e confirmada pelo cursor (197.8954ms)
✔ quem não participa não vê reserva nenhuma (257.8931ms)
✔ atividade nasce planejada, flexível quando não tem horário, e o roteiro volta por dia (540.0383ms)
✔ custo: desconhecido não vira zero, 'a verificar' é sinalizado e gratuidade é explícita (186.7833ms)
✔ conflito aparece no resumo do dia e nas duas atividades, e ninguém remarca sozinho (182.6202ms)
✔ deslocamento que não cabe vira conflito explicado (risco de perder o compromisso) (180.4289ms)
✔ concluir é ação explícita: registra quem concluiu e quando; passar do horário não conclui (185.39ms)
✔ cancelar e corrigir exigem motivo, versionam e ficam no histórico (191.0269ms)
✔ quem não participa não vê nem escreve no roteiro (257.7826ms)
✔ viagem cancelada bloqueia atividade nova e libera correção do que já existe (178.9942ms)
✔ roteiro entra na sincronização incremental (funciona offline) (271.3753ms)
✔ reenvio com a mesma chave de idempotência não cria duas atividades (179.7782ms)
✔ atividade guarda observação e nasce sem reserva quando ninguém vinculou (176.1497ms)
✔ vincular a atividade à reserva da viagem: o vínculo volta no roteiro, no detalhe e na sincronização (186.2534ms)
✔ reserva de outra viagem é recusada e a atividade não é criada com vínculo cruzado (177.5378ms)
✔ reserva cancelada não vira vínculo de atividade (177.6745ms)
✔ corrigir vincula e desvincula a reserva com motivo, sem mexer na reserva em si (187.529ms)
✔ corrigir a observação não apaga a reserva vinculada (178.9103ms)
✔ a primeira sincronização traz tudo e devolve um cursor de sequência (462.246ms)
✔ sem nada novo, o app não recebe despesas para reprocessar (108.1825ms)
✔ só o que mudou volta, e o cursor avança exatamente até a última mudança (100.7574ms)
✔ confirmação de outra pessoa e aceite de convite aparecem no delta (185.9751ms)
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