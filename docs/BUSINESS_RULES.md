# Regras de negócio — Lia Go

## Viagem
- Estados: Rascunho, Planejada, Em andamento, Concluída, Pendente (com motivo) e Cancelada.
- Data prevista nunca comprova sozinha que a viagem começou ou terminou.
- Qualquer participante com acesso ativo pode confirmar Em andamento e Concluída.
- Pendente é sugerido pelo sistema com motivo explícito; uma pessoa autorizada confirma.
- Estado da viagem e estado financeiro são independentes.
- Cancelamento é assistido: mostrar impactos antes da confirmação, preservar registros, bloquear novos compromissos e não cancelar despesas/reservas automaticamente.
- Após cancelamento, os participantes mantêm acesso aos registros autorizados e podem concluir pendências; novas ações de viagem ficam bloqueadas, exceto correções e encerramento.

## Papéis e permissões
- Organizador administra configurações, participantes, cancelamento e conflitos.
- Participantes registram despesas e propõem alterações.
- Ações financeiras sensíveis respeitam autorização e revisão por outra pessoa quando definido.
- Acesso deve ser verificado no servidor em toda leitura/escrita relevante.
- Sair, remoção e exclusão de conta são ações distintas; preservar histórico e pendências.

## Despesas
- Campos obrigatórios: valor, moeda, pagador, data e descrição.
- Novo lançamento é pendente e não altera saldo oficial até confirmação.
- Autor não confirma o próprio lançamento.
- Contestada fica visível e fora do saldo oficial até resolução.
- Correção confirmada exige motivo, revisão independente e histórico.
- Despesa pessoal não cria obrigação para outras pessoas.
- Despesa compartilhada é contada uma vez no orçamento coletivo e distribuída nos individuais conforme rateio.

## Rateio e saldos
- Métodos: igualitário, participantes específicos, valores ou percentuais.
- Soma de parcelas deve corresponder exatamente ao total; explicar distribuição de centavos.
- Saldo por pessoa = total pago − parcela que lhe cabe.
- Transferências são sugestões; não são pagamentos executados.
- Pagamento informado não equivale a confirmado.
- Destinatário confirma recebimento; pagamento parcial mantém saldo restante.
- Reembolsos são movimentos separados ligados à despesa e preservam o rateio original.

## Moeda
- Preservar moeda/valor original, taxa e referência temporal, e valor convertido.
- Atualização cambial nunca altera retroativamente registros.
- Cálculos oficiais são determinísticos e auditáveis; IA não é fonte de saldo.

## Reservas, documentos e notificações
- Registro manual assistido de reserva na V1; IA não confirma reserva.
- Documentos privados por padrão.
- Notificações distinguem leitura, dispensa e resolução.
- Só evidência confiável permite resolução automática; dúvidas exigem confirmação.
- Agrupamento não pode ocultar urgência, mudança de estado ou ação exigida.
- Offline não pode confirmar saldos oficiais nem contornar permissões.

## Histórico e auditoria
Registrar autor, instante, ação, valores anteriores/novos quando relevante, motivo para correções e resultado da confirmação. Não sobrescrever ou excluir silenciosamente registros financeiros relevantes.
