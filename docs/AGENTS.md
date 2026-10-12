# AGENTS.md — Instruções permanentes para o agente do Lia Go

## Missão
Implementar o Lia Go de forma incremental, segura, testável e fiel às decisões documentadas. O produto é gratuito para os usuários; não presumir orçamento para APIs pagas ilimitadas.

## Leitura obrigatória
Antes de codificar, leia `PLANEJAMENTO_MESTRE.md` e todos os documentos em `docs/` relevantes à tarefa. Se o repositório já tiver arquitetura, convenções ou código, inspecione-os antes de propor mudanças.

## Hierarquia das decisões
1. Regras explícitas em `docs/BUSINESS_RULES.md` e decisões confirmadas em `docs/DECISIONS_AND_OPEN_QUESTIONS.md`.
2. `PLANEJAMENTO_MESTRE.md`.
3. Decisões técnicas já adotadas no repositório.
4. Hipóteses reversíveis documentadas pelo agente.

Não contradiga decisões confirmadas para simplificar a implementação. Se houver conflito entre documentos, não escolha silenciosamente: identifique-o, proponha correção e aguarde quando o conflito afetar comportamento do produto.

## Processo obrigatório
1. Inspecione a base existente e informe o estado real do projeto.
2. Defina um plano pequeno e verificável para a tarefa atual.
3. Implemente uma fatia funcional de ponta a ponta; evite grandes mudanças sem testes.
4. Execute testes, verificações estáticas e build disponíveis.
5. Corrija regressões antes de seguir.
6. Atualize documentação, decisões, backlog e instruções de execução quando necessário.
7. Ao terminar, informe arquivos alterados, comportamento entregue, testes executados, limitações e próximo passo.

## Decisões pendentes
- Não bloqueie o projeto por detalhes que ainda não são necessários.
- Para escolhas pequenas, reversíveis e de baixo risco, use a alternativa mais simples e consistente; registre como hipótese, não como decisão do usuário.
- Peça confirmação antes de definir autenticação/provedores definitivos, serviços externos pagos, arquitetura irreversível, retenção de dados sensíveis, políticas legais, integrações financeiras, compartilhamento de localização, exclusão permanente, ou qualquer mudança material de escopo.
- Nunca afirme que uma integração funciona sem implementá-la e testá-la.

## Segurança e dados
- Autorização sempre no servidor, não apenas na interface.
- Validar entradas no servidor e aplicar princípio do menor privilégio.
- Não expor documentos, dados pessoais, dados financeiros ou segredos em logs, notificações de tela bloqueada ou mensagens de erro.
- Não colocar segredos no cliente nem no repositório.
- Operações financeiras devem ser auditáveis e determinísticas; IA não calcula saldos oficiais nem confirma fatos externos.
- Preservar histórico de alterações relevantes; não apagar ou sobrescrever silenciosamente.
- Não criar pagamentos, transferências, reservas, cancelamentos externos ou despesas automaticamente sem autorização e integração real.
- Não usar dados reais em testes; criar fixtures sintéticas.
- Considerar concorrência, funcionamento offline, sincronização e verificação de permissões no servidor.

## IA
- A IA pode sugerir roteiros, categorias, rateios, textos e próximos passos.
- A IA não pode confirmar reservas, pagamentos, reembolsos, chegada, conclusão de atividade ou outros fatos externos sem evidência confiável.
- Apresentar claramente estimativas, hipóteses, itens a verificar e informação desatualizada.
- Não permitir que saída do modelo contorne validação, autorização ou regras determinísticas.
- Não pressupor API de IA gratuita ou ilimitada; definir limites, fallback e controle de custos antes de integrar um fornecedor.

## UX e identidade
- Idioma inicial: português brasileiro; moeda de referência configurável, Brasil e BRL como mercado inicial, Pix relevante.
- Identidade profissional, moderna e confiável; interface predominantemente escura com roxo/magenta e cartões arredondados conforme referências existentes, adaptada para mobile e acessibilidade.
- Lia pode ter personalidade levemente tsundere — provocadora de forma leve, mas prestativa — sem humilhar, constranger ou atrapalhar tarefas.
- Não sacrificar legibilidade, acessibilidade, velocidade ou clareza financeira por efeitos visuais.

## Qualidade
- Testar regras de cálculo, permissões, estados e sincronização.
- Cobrir casos de erro, loading, vazio, offline, conflito e sucesso.
- Usar valores monetários decimais exatos (centavos/unidades mínimas), nunca ponto flutuante binário como fonte oficial de dinheiro.
- Datas e horários devem ter fuso explícito quando relevante.
- Nenhuma ação destrutiva ou irreversível sem confirmação e explicação dos impactos.
