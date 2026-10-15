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

**As referências agora estão versionadas** (commits `c53c11c` e `be91721`) em `assets/references/` — estes são os caminhos oficiais, e nenhum outro deve ser inventado:

| Arquivo | O que é |
|---|---|
| `assets/references/concept-01-visao-geral.png` | visão geral (mobile + web) com paleta, cartões e barra inferior |
| `assets/references/concept-02-roteiro.png` | roteiro com timeline, dias e detalhes |
| `assets/references/concept-03-tela-inicial.png` | tela inicial com hero da viagem, orçamento com barra e pendências |
| `assets/references/lia-character-hero.png` | personagem Lia (hero) |
| `assets/references/lia-logo-icon.png` | ícone do app |
| `assets/references/lia-signature.png` | assinatura/logo Lia Go |

O que as referências **confirmam** do que já está no app: fundo escuro, roxo/magenta, cartões
arredondados, etiqueta de estado, timeline por dia, resumo financeiro no topo da viagem, barra
inferior com quatro destinos e pendências do grupo em lista.

O que as referências pediam e **já foi implementado** (2026-10-15, décima rodada): **hero da viagem com
a Lia** na Visão geral, **orçamento com barra e limite** (coletivo do organizador, individual de cada
pessoa, atenção a partir de 80%, estado sempre em texto), **"próximo compromisso" em destaque** (só o
que ainda vai acontecer) e as telas de **checklist**, **documentos** (privados por padrão) e
**fechamento/exportação** na aba Mais. A imagem do hero é uma cópia comprimida em
`apps/mobile/src/assets/lia-hero.jpg` (900 px, 58 KB) — a referência original continua aqui em
`assets/references/`.

O que as referências **pedem e ainda não existe**: a barra de navegação da web com seletor lateral
(Início, Viagens, Despesas, Participantes, Documentos, Configurações), a aba **Documentos** própria na
barra inferior do celular (hoje ela vive na aba Mais; cinco destinos exigem teste em tela pequena) e os
gráficos do painel web (pizza por categoria, linha do tempo). Nada disso muda arquitetura.

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

### 8.1 O que já foi resolvido na implementação (hipóteses reversíveis)

Os tokens de marca foram **fechados** em `docs/UI_V1_DECISIONS.md` §1 e já estão aplicados em
`apps/mobile/src/styles.css` (bloco `:root`): magenta `#FF3EDC`, roxo `#A855F7`, lilás `#D884FE`,
fundo `#0B0A12`, sucesso `#22D3A3`, âmbar de atenção. Fundo de cartão, borda e texto suave são derivados
do fundo neutro — mexer na identidade é mexer nessas linhas, e nada mais.

| Ponto em aberto | O que está valendo agora | Trocar depois exige mexer em… |
|---|---|---|
| Tokens de cor | **valores aprovados** em `UI_V1_DECISIONS.md` §1, como variáveis CSS (`--roxo`, `--magenta`, `--lilas`, `--bom`, `--atencao`, `--fundo`, `--fundo-cartao`, `--borda`, `--texto-suave`) | `styles.css` (bloco `:root`) |
| Tipografia | pilha do sistema, já herdada; hierarquia por tamanho/peso (§2 das decisões) | `styles.css` |
| Espaçamento | escala em variáveis (`--e1` 4 px, `--e2` 8 px, `--e3` 12 px, `--e4` 16 px, `--e6` 24 px), composição em 8 px (§3) | `styles.css` |
| Breakpoints | um só: **480 px** (colunas do roteiro empilham no celular; celular é uma coluna, web/tablet aproveita largura) | `styles.css` |
| Ícones | **texto/etiqueta** por enquanto: nenhuma biblioteca de ícones foi instalada nesta fatia — preferir uma só (Lucide ou equivalente) quando o visual for refinado, nunca misturar estilos | componentes das telas |
| Animação | nenhuma além do pulso já existente; transições curtas, e `prefers-reduced-motion` desliga animação e transição (§11) | `styles.css` |
| Densidade financeira | custo em linha dentro do contexto do cartão; ficha com rótulo + valor | `CartaoAtividade.tsx`, `Atividade.tsx` |
| Mapas | fora desta fatia (deslocamento é texto: minutos, km e alerta) | próxima fatia |
| Acessibilidade | alvos ≥ 44 px, foco visível (`:focus-visible` com 3 px), rótulos em todos os campos, seleção de dia com `aria-pressed` + `aria-label` (sem `role="tab"` sem painel), **estado nunca só por cor** | `styles.css`, telas |

O item de **estado nunca só por cor** merece destaque porque é o mais fácil de quebrar sem perceber: o
marcador da timeline é decorativo; quem informa o estado é a etiqueta (`planejada`, `concluída`,
`cancelada`) e o texto do conflito (`⚠ conflito` + explicação).
