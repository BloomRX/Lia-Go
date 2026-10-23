# Lia Go — Planejamento mestre e continuidade
**Versão:** 1.8 — stack técnica decidida (React + TypeScript + Capacitor); ver `ARCHITECTURE.md`  
**Idioma:** português brasileiro  
**Estado:** planejamento suficiente para iniciar implementação por etapas; não representa especificação final fechada.

## 1. Produto e identidade
- Nome de trabalho: **Lia Go**.
- Mercado inicial: Brasil; BRL e Pix são relevantes.
- O aplicativo é gratuito para usuários. Custos de infraestrutura e IA precisam ser sustentáveis; não presumir APIs pagas ilimitadas.
- Identidade profissional, moderna e confiável, com tom amigável e descontraído.
- Lia pode ser levemente tsundere (durona/provocadora, mas prestativa), nunca humilhante ou intrusiva.
- Direção visual de referência: interface escura, roxo/magenta, brilho moderado e cartões arredondados; adaptar para mobile e acessibilidade.

## 2. Princípios
- Uma hipótese não é um fato confirmado.
- IA sugere; pessoas autorizadas confirmam decisões relevantes.
- Cálculos financeiros são determinísticos, auditáveis e independentes de IA.
- Preservar histórico e distinguir estimado, provisório, confirmado, contestado e a verificar.
- Permissões validadas no servidor.
- Nenhuma alteração destrutiva ou compromisso externo sem autorização explícita.
- Criar progressivamente; decisões de baixo risco podem ser resolvidas durante a implementação, com registro.

## 3. Conta, papéis e acesso
- Todos os participantes precisam de conta, inclusive convidados.
- E-mail e provedores externos são opções; seleção final depende da viabilidade técnica e de segurança.
- Evitar contas duplicadas e verificar métodos ao vincular/desvincular.
- Papéis principais: organizador e participante.
- Convites individuais ou por link; o convidado autentica antes de acessar a viagem.
- Convites pendentes podem ser cancelados pelo organizador.
- Todos podem registrar despesas e propor alterações. Organizador administra configurações, participantes, cancelamento e conflitos.
- Visibilidade por necessidade: orçamento coletivo, despesas compartilhadas e acertos relevantes são visíveis aos envolvidos; cada pessoa vê seus dados individuais; organizador tem visão ampliada para administração/conflitos, sem alterações silenciosas.
- Sair, ser removido e excluir conta são ações distintas. Quem sai/é removido perde acesso e não cria novos lançamentos, mas histórico e pendências são preservados. Novos gastos não devem incluir automaticamente a pessoa; compromissos futuros exigem revisão.
- Segurança de sessão e revogação de acesso devem ser previstas.

## 4. Criação de viagem e roteiro
- Criar por conversa livre ou formulário guiado, alternáveis sem perda de dados e sem perguntas duplicadas.
- Salvar rascunho quando viável.
- Dados: destino(s), datas/flexibilidade, origem quando necessária, viajantes, orçamento opcional, moedas, preferências/restrições/acessibilidade, reservas já compradas, horários fixos e atividades imperdíveis.
- Perguntar apenas o essencial; detalhes secundários podem ser sugeridos e editados.
- Quando houver dados suficientes, produzir roteiro progressivo; pessoa revisa antes de aprovar.
- Propostas não confirmam reservas.
- Estimativa de custo total como faixa baixa/alta, composição e incertezas. Sem orçamento conhecido, oferecer faixas econômica/intermediária/confortável quando existirem dados adequados.
- Roteiro em timeline vertical por dia, com horários, duração, deslocamentos, custos e alertas.
- Distinguir sugestão, atividade aprovada, reserva confirmada, item a verificar, pausa e deslocamento.
- Manter versões anteriores do roteiro. Mudanças mostram impactos e exigem confirmação.
- Atividades: planejada, em andamento, concluída, pulada ou cancelada; atualização manual. Não inferir conclusão só porque passou o horário.
- Imprevistos geram proposta; roteiro vigente muda somente após confirmação.
- Preferências coletivas, consenso antes de votação e organizador resolve impasses conforme permissões.
- Ramificações de roteiro são possíveis; não presumir que o grupo se reencontra ou chega junto.
- Transporte em tempo real apenas com integração disponível; caso contrário, indicar atualização/limitação e permitir abrir app externo.
- Comparar transporte conforme economia, rapidez, conforto e acessibilidade, respeitando restrições individuais.
- Chegada pode ser confirmada manualmente. Localização temporária é opcional, com consentimento, prazo e público autorizado. Histórico de localização exige consentimento separado; apenas a pessoa que autorizou acessa seu próprio histórico. Retenção exata ainda pendente.

## 5. Estados da viagem
Estados definidos:
1. Rascunho
2. Planejada
3. Em andamento
4. Concluída
5. Pendente — sempre com motivo explícito
6. Cancelada

O estado geral da viagem é independente do estado financeiro.

### Transições confirmadas
- **Em andamento:** na data prevista, o sistema sugere a mudança; qualquer participante com acesso ativo pode confirmar. A data, por si só, não altera o estado. Registrar quem confirmou e quando.
- **Concluída:** após a viagem, qualquer participante com acesso ativo pode confirmar que terminou. A data final não conclui automaticamente. Pendências financeiras permanecem abertas. Conclusão não confirma pagamentos nem reabre automaticamente a viagem.
- **Pendente:** o sistema identifica possível situação, explica o motivo e aguarda confirmação humana de pessoa autorizada. Não muda silenciosamente.
- **Cancelada:** fluxo assistido, ver seção seguinte.

### Cancelamento
- Antes de confirmar, mostrar impactos conhecidos em passagens, hospedagens, reservas, despesas, reembolsos e acertos.
- Exigir confirmação de pessoa autorizada.
- Depois de autorizado, marcar viagem como Cancelada, preservar registros e destacar pendências restantes.
- Não cancelar reservas nem despesas automaticamente.
- Reembolsos e ajustes seguem revisão e confirmação.
- Após cancelamento, todos mantêm acesso aos registros para os quais já têm autorização e podem concluir pendências financeiras.
- Novos compromissos de viagem ficam bloqueados; permitir correções e ações de encerramento. Não ampliar permissões automaticamente.

## 6. Orçamentos, despesas e rateios
- Orçamento coletivo e individual; definição operacional proposta: coletivo = limite total da viagem, individual = limite por participante.
- Despesa compartilhada conta uma vez no coletivo e é distribuída nos limites individuais conforme rateio.
- Separar gastos realizados e compromissos futuros.
- Alertas sugeridos em 75%, 90% e 100%, configuráveis; não bloquear despesas reais.
- Registro: valor, moeda, pagador, data e descrição obrigatórios; categoria, participantes, observações e comprovante opcionais.
- Lia sugere pessoal/compartilhada e participantes; pessoa revisa e confirma.
- Despesa pessoal não cria obrigação para outras pessoas.
- Despesa nova fica pendente antes de alterar saldos oficiais. O autor não confirma o próprio lançamento; outra pessoa autorizada confirma. Conflitos vão ao organizador. Contestada permanece visível, mas fora dos saldos oficiais.
- Correção confirmada exige motivo, novos dados, revisão por outra pessoa e histórico preservado.
- Rateio: métodos igualitário, participantes específicos, valores fixos ou percentuais; pessoa revisa a sugestão.
- Distribuir centavos de modo transparente, garantindo soma exata.
- Valores em moeda estrangeira preservam valor original, moeda, taxa, referência temporal e convertido. Atualizações não reescrevem histórico.
- Conversão provisória é permitida quando o valor final não é conhecido, com revisão posterior e histórico.
- Reembolsos são movimentos separados ligados à despesa; seguem rateio original e registram quem recebeu.
- Saldo pessoa = total pago − parte que lhe cabe.
- Sugerir transferências minimizando pagamentos quando possível.
- Distinguir despesa, saldo/dívida, transferência sugerida, pagamento informado e pagamento confirmado.
- Destinatário confirma recebimento. Pagamento parcial mantém saldo restante. Contestação permanece até decisão do organizador. Histórico preservado.
- Pix integrado é futuro, não requisito da V1; acertos manuais podem existir.

## 7. Moedas e câmbio
- Conversão disponível desde a V1; moedas de referência e local são visíveis e selecionáveis.
- Preservar valor original, moeda, taxa, data/referência e valor convertido.
- Nova taxa não reescreve registros históricos.
- Fonte de câmbio, frequência, modo offline, spread/taxas, taxa manual e regra de arredondamento ainda precisam ser definidos antes da implementação final desse módulo.

## 8. Reservas, documentos e offline
- Reservas na V1: registro manual assistido; integrações futuras apenas se viáveis. IA não confirma reservas.
- Centralizar passagens, hospedagem, requisitos, ingressos, documentos, alimentação/transporte, links e checklist.
- Documentos privados por padrão; compartilhar individualmente com destinatários escolhidos e revogar quando possível. Dados sensíveis privados.
- Offline: roteiro sincronizado, endereços e detalhes de reserva carregados; documentos locais protegidos.
- Despesas/notas offline ficam locais e aguardam sincronização; não alteram saldos oficiais até sincronizar e passar pela confirmação.
- Mudanças compatíveis sincronizam; conflitos incompatíveis são preservados para revisão.
- Nunca descartar silenciosamente nem resolver conflitos só pelo relógio do dispositivo.
- Revalidar permissões durante sincronização e mostrar última sincronização.

## 9. Notificações
- Canais: dentro do app e push relevante; categorias, antecedência e silêncio configuráveis.
- Exceções prioritárias configuráveis, mas apenas categorias autorizadas podem furar silêncio.
- Repetição padrão apenas em mudanças relevantes; lembretes periódicos opcionais.
- Resumo inteligente de avisos não vistos e histórico completo.
- Central única com filtros por viagem, categoria, prioridade e estado.
- Leitura, dispensa e resolução são estados diferentes.
- Avisos informativos podem ser dispensados ao ler; pendências importantes exigem resolução ou ação explícita para dispensar.
- Avisos pessoais podem ser dispensados pela pessoa; pendências compartilhadas exigem pessoa autorizada pelo assunto.
- Resolver automaticamente somente com evidência confiável; solicitar confirmação humana em caso de dúvida, conflito ou ação externa.
- Pagamento informado não é pagamento confirmado. Reserva não é confirmada/cancelada sem evidência adequada.
- Agrupar atualizações do mesmo problema; eventos distintos permanecem separados. Destacar mudanças importantes e preservar histórico. Agrupamento nunca oculta urgência, mudança de estado ou ação exigida.
- Detalhes adaptativos conforme urgência, estado ou histórico, mantendo histórico completo e ações autorizadas acessíveis.
- Alertas de atraso contextuais; estimativas identificadas como estimativas. Falta de conexão não prova atraso. Não usar histórico privado.
- Destinatários limitados aos envolvidos e autorizados.
- Notificações sensíveis não exibem detalhes na tela bloqueada por padrão.

## 10. Navegação e telas
- Início: novos usuários veem “Criar viagem”; usuários existentes veem viagens próximas, pendências e histórico. Offline sinaliza dados desatualizados.
- Dashboard da viagem: destino, datas, status, orçamento, próximo compromisso, alertas e pendências.
- Barra inferior: Visão geral, Roteiro, Gastos, Documentos; “Mais” reúne Participantes, Reservas e Configurações.
- Preservar formulários e contexto ao navegar.
- Fechamento: previsto versus realizado, gastos, compromissos, saldos, pagamentos, moedas/câmbio histórico e pendências.
- Exportação PDF/planilha proposta; cada participante exporta apenas dados autorizados, organizador tem relatório ampliado para conflitos.
- Viagem concluída permanece concluída após correções, pagamentos e reembolsos; não reabrir automaticamente.

## 11. Priorização inicial
V1 proposta:
1. Estrutura do app, autenticação e permissões.
2. Criar/editar viagem, participantes e convites.
3. Roteiro e estados.
4. Reservas/documentos e checklist.
5. Orçamentos, moedas e despesas.
6. Rateios, saldos e acertos manuais.
7. Histórico, notificações essenciais e offline básico.
8. Fechamento e exportação conforme capacidade.

V1.x: refinamentos de UX e automações de baixo risco.
V2: integrações automáticas com reservas/Pix e automações adicionais, somente após avaliar viabilidade, segurança, custos e necessidade.

## 12. Diretriz de implementação
Começar com um esqueleto executável e uma fatia vertical simples. Registrar decisões técnicas e manter testes automatizados para cálculos, permissões e transições de estado.

A inspeção do repositório e do ambiente já foi feita: na versão 1.8 não existe mais a pendência "escolher stack". A stack está decidida (§13), a viabilidade foi medida e registrada em `ARCHITECTURE.md`, e a implementação segue por fatias verticais testáveis.

## 13. Stack e arquitetura técnica (decidida em 2026-10-12)
- **Cliente:** React + TypeScript + **Capacitor**; uma base de código para app mobile e web.
  **Celular é a plataforma principal**; web é complementar.
- **Regras de negócio independentes da interface:** pacote de domínio próprio, sem I/O e sem UI,
  usado pelo servidor (autoridade) e pelo app (prévia/offline). O resultado do app nunca é verdade oficial.
- **Banco central compartilhado:** PostgreSQL no servidor. **SQLite local nunca é o banco central**;
  no dispositivo existe apenas cache offline não oficial.
- **Autenticação:** conta obrigatória para todos os participantes; e-mail e senha próprios com sessão
  em cookie HttpOnly (detalhes e decisão pendente sobre o app nativo em `ARCHITECTURE.md` §6 e §11).
- **Substituição da stack exige autorização** da pessoa responsável.
- Detalhes, medidas de viabilidade, riscos e decisões pendentes: `docs/ARCHITECTURE.md` (documento único
  de arquitetura). O backlog reflete esta stack em `docs/IMPLEMENTATION_BACKLOG.md`.
