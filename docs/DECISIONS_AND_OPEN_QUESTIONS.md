# Decisões e questões em aberto — Lia Go

## Decisões confirmadas
- Nome de trabalho: Lia Go; mercado inicial Brasil; português brasileiro, BRL e Pix relevante.
- Aplicativo gratuito para usuários; arquitetura deve controlar custos operacionais e de IA.
- Identidade profissional, moderna e confiável; Lia com personalidade levemente tsundere, sem humilhação.
- Criação por conversa ou formulário, alternáveis sem perda de dados e sem perguntas repetidas.
- Roteiro é proposta até aprovação; mudanças relevantes mostram impacto e preservam versões.
- Atividades não são concluídas só porque passou o horário.
- Participantes autenticam; permissões aplicadas no servidor; organizador administra configurações, membros, cancelamento e conflitos.
- Despesa nova fica pendente; autor não confirma próprio lançamento; contestada fora do saldo oficial até resolução.
- Valores financeiros determinísticos; preservar moeda e taxa histórica.
- IA não confirma reservas/pagamentos nem altera saldos oficiais.
- Offline não confirma saldo oficial; conflitos preservados para revisão.
- Notificações: leitura, dispensa e resolução distintos; resolução automática só com evidência confiável; agrupamento não esconde urgência/ações; histórico preservado.
- Cancelamento assistido, com impactos prévios, confirmação autorizada, registros preservados e sem cancelamento automático de reservas/despesas.
- Após cancelamento, todos mantêm acesso aos registros autorizados e podem concluir pendências; novos compromissos bloqueados, exceto correções e encerramento.
- “Em andamento”: sugestão na data prevista; qualquer participante ativo pode confirmar; data sozinha não muda o estado.
- “Concluída”: qualquer participante ativo pode confirmar; pendências financeiras continuam abertas; não reabre automaticamente.
- “Pendente”: sistema sugere com motivo explícito e aguarda confirmação humana de pessoa autorizada.
- Estado da viagem e estado financeiro são independentes.
- Navegação: Visão geral, Roteiro, Gastos, Documentos; Mais para Participantes, Reservas e Configurações.
- Prioridade V1: autenticação/permissões, viagens/roteiro, reservas/documentos, orçamento/despesas/rateios/acertos, notificações essenciais e offline básico.
- Só gerar especificações finais quando houver pedido explícito; este pedido autoriza criar documentos para o agente, mantendo questões em aberto.

## Questões que podem ser resolvidas durante a implementação
- Pequenos detalhes de layout, microcopy e organização visual, desde que não alterem regras.
- Bibliotecas auxiliares e padrões reversíveis adequados ao stack existente.
- Motivos e apresentação detalhada de sugestões de “Pendente”, respeitando a regra de confirmação.
- Ordem interna de tarefas pequenas, mantendo prioridades e dependências.

## Questões que exigem análise e, quando necessário, confirmação
- Stack e hospedagem definitivos, se o repositório não tiver uma escolha clara.
- Provedor de autenticação e recuperação de conta.
- Banco de dados, backups, migrações e política de retenção.
- Fonte/frequência de câmbio, taxa manual, spread, arredondamento e offline.
- Limites de custo e fornecedor de IA; limites de uso e fallback.
- Retenção de documentos e localização; prazo exato do histórico de localização.
- Política legal de privacidade, exclusão de conta e registros financeiros compartilhados.
- Requisitos exatos de exportação PDF/planilha e acessibilidade.
- Integrações externas e respectivos custos/credenciais.
- Política detalhada de conflito financeiro e poderes de resolução quando não houver acordo.
- Quais categorias de notificação podem furar o modo silêncio.

## Regra de resolução
Quando uma questão bloquear uma fatia de trabalho:
1. Explicar a questão e opções relevantes de forma curta.
2. Indicar recomendação e impacto.
3. Pedir decisão se for material ou de alto risco.
4. Registrar a decisão neste arquivo e nos documentos afetados.
5. Retomar a implementação sem reabrir decisões confirmadas não relacionadas.
