# Lia Go — Diretrizes visuais e componentes

**Estado:** planejamento visual em andamento; não é uma especificação final fechada.
**Plataforma prioritária:** celular (React + TypeScript + Capacitor). Web é complementar e reaproveita a mesma base.

## 1. Identidade visual de referência

As imagens de conceito fornecidas durante o planejamento são referências da direção visual do Lia Go e devem preservar a continuidade da marca Lia:

- interface predominantemente escura;
- roxo e magenta como assinatura visual;
- brilho/glow usado com moderação, principalmente em destaque e ação;
- cartões arredondados, com bordas e profundidade discretas;
- ícones lineares/minimalistas;
- Lia presente como identidade e companhia, mas sem competir com dados, ações ou informações financeiras;
- aparência profissional, moderna e confiável, sem transformar o produto em uma interface puramente decorativa.

Os conceitos não são mockups pixel-perfect nem devem ser copiados literalmente. Eles definem linguagem, hierarquia e atmosfera. Medidas, tokens e componentes definitivos serão consolidados durante a implementação e os testes de acessibilidade.

## 2. Regras confirmadas do roteiro

### 2.1 Abertura de detalhes

Detalhes de uma atividade abrem em **tela própria**. O cartão do roteiro não deve virar uma ficha completa nem depender de bottom sheet para o conteúdo principal.

A tela própria deve poder acomodar, conforme a atividade:

- informações completas;
- horário e duração;
- local e deslocamento relacionado;
- custos e natureza do valor;
- reserva/compromisso e evidências disponíveis;
- acessibilidade e observações;
- documentos e links;
- histórico e ações autorizadas.

### 2.2 Cartão de atividade

Padrão **equilibrado**. O cartão mostra diretamente:

1. horário, quando definido;
2. título da atividade;
3. estado relevante;
4. custo essencial, quando houver informação útil;
5. informação contextual quando realmente ajudar a entender o compromisso.

O cartão deve continuar escaneável em uma tela pequena. Informação secundária deve ficar na tela de detalhes.

### 2.3 Estados

Apresentação **híbrida**:

- marcador visual na linha do tempo;
- etiqueta textual no cartão.

Cor nunca deve ser o único indicador. Estado precisa continuar compreensível por texto e, quando apropriado, ícone.

A passagem do horário não conclui uma atividade automaticamente. A conclusão depende de ação/evidência permitida pelas regras do produto.

### 2.4 Custos

Apresentação **contextual**:

- custo conhecido e útil pode aparecer diretamente no cartão;
- custo desconhecido fica omitido por padrão;
- quando a ausência do custo for relevante para planejamento do orçamento, mostrar indicação para verificação;
- nunca representar custo desconhecido como `R$ 0,00`.

O roteiro deve distinguir visualmente e semanticamente:

- estimativa;
- compromisso futuro;
- gasto efetivamente registrado.

O roteiro não substitui o módulo financeiro e não altera saldos oficiais.

### 2.5 Conflitos de horário

Um conflito aparece em **dois níveis**:

- resumo do dia: aviso geral indicando que existe conflito;
- atividades envolvidas: destaque nos cartões afetados.

O conflito deve explicar o problema e oferecer ação para análise/resolução. O Lia Go não deve mover horários ou alterar reservas silenciosamente.

### 2.6 Deslocamentos

Apresentação **compacta por padrão** entre atividades.

Ampliar o trecho quando houver:

- distância longa;
- atraso relevante;
- custo de transporte;
- risco de perder uma atividade/reserva;
- outra condição que altere materialmente o planejamento.

Compacto não significa oculto: riscos e urgências permanecem visíveis.

### 2.7 Atividades flexíveis

Atividades sem horário exato permanecem na **sequência lógica do dia**, mas recebem indicação visual de horário flexível.

Não inventar horário apenas para encaixar a atividade na timeline.

Exemplos conceituais:

```text
09:00  Café da manhã
       Horário definido

       Visitar o mirante
       Horário flexível

12:30  Almoço reservado
       Horário definido
```

### 2.8 Atividades concluídas

Apresentação **híbrida**:

- marcação discreta na timeline;
- etiqueta `Concluída` no cartão;
- possibilidade de recolher atividades concluídas para reduzir ruído visual.

Recolher é apenas uma preferência de visualização. Nunca apagar histórico nem alterar a ordem original do roteiro.

### 2.9 Resumo diário

Resumo **adaptativo**:

- compacto quando o dia está normal;
- expande indicadores relevantes quando necessário;
- destaca conflitos e pendências importantes;
- não substitui alertas urgentes por números genéricos;
- pode mudar de densidade conforme o contexto sem mudar o significado dos dados.

## 3. Anatomia conceitual

```text
TripHeader
├── destino
├── datas
├── estado da viagem
└── participantes

DaySummary
├── progresso
├── indicadores relevantes
├── conflitos
└── pendências

ItineraryTimeline
├── TimelineMarker
├── ActivityCard
├── TravelSegment
├── FlexibleActivity
└── ScheduleConflict
```

A nomenclatura acima é conceitual. Não obriga nomes de arquivos ou componentes, mas orienta a separação de responsabilidades.

## 4. Princípios de acessibilidade

- Não depender somente de cor para estados, conflitos ou custos.
- Garantir contraste suficiente entre texto, fundo, bordas e estados.
- Suportar aumento de fonte sem cortar conteúdo ou tornar ações inacessíveis.
- Usar áreas de toque confortáveis no celular.
- Preservar foco e ordem lógica para teclado na web.
- Não usar glow, animação ou imagem da Lia como único meio de transmitir uma informação.
- Reduzir efeitos visuais quando preferências do sistema ou contexto indicarem movimento reduzido.
- Estados de carregando, vazio, erro, offline/desatualizado, conflito, sucesso e sem permissão devem ser planejados para cada tela aplicável.

## 5. Responsividade

### Celular — prioridade

- Uma coluna.
- Timeline vertical.
- Cartões equilibrados e escaneáveis.
- Ações principais acessíveis com uma mão.
- Área segura do sistema respeitada.
- Detalhes em tela própria.
- Navegação inferior conforme `UX_SCREENS.md`.

### Tablet / web — complementar

- Reaproveitar os mesmos componentes e regras.
- Usar largura disponível para melhorar leitura, não para criar outro produto.
- Quando houver espaço suficiente, detalhes podem aparecer em composição lateral sem alterar a navegação conceitual.
- Layout deve se adaptar à largura disponível, e não depender de um dispositivo específico.

## 6. React + TypeScript + Capacitor

A UI deve ser construída com componentes reutilizáveis entre mobile e web.

Separar:

- apresentação visual;
- estado da tela;
- regras de domínio;
- autorização;
- sincronização/offline;
- integração nativa do Capacitor.

Regras financeiras, permissões e transições não podem ser duplicadas apenas para atender a uma aparência visual.

A interface pode fazer prévias/otimismo offline, mas o servidor continua sendo a autoridade para resultado oficial.

## 7. Referências visuais recebidas

Nesta etapa foram fornecidas referências do próprio conceito do Lia Go e da identidade visual da Lia, incluindo:

- conceito de visão geral mobile/web;
- conceito de roteiro com timeline, dias e tela de detalhes;
- conceito de visão geral com paleta e elementos visuais;
- referência de personagem Lia em ambiente escuro/magenta;
- referência de assinatura/logo Lia;
- variação da assinatura visual.

As imagens originais desta conversa ainda precisam ser versionadas como assets binários do repositório por um fluxo que suporte upload de arquivos. **Não inventar URLs ou caminhos para esses arquivos.** Quando forem adicionadas, preferir uma pasta como `docs/ui-references/` e registrar neste documento quais são as referências oficiais.

## 8. O que ainda não está decidido

Este documento não fecha:

- valores finais dos tokens de cor;
- tipografia definitiva;
- escala exata de espaçamento;
- breakpoints finais;
- biblioteca de ícones;
- regras finais de animação;
- densidade de telas financeiras;
- aparência final de mapas, documentos e reservas.

Esses pontos podem ser definidos incrementalmente, sem contrariar as decisões acima.
