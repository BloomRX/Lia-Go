# Lia Go — Decisões visuais V1 e handoff para implementação

**Estado:** aprovado para implementação da UI V1.
**Plataforma prioritária:** celular.
**Stack:** React + TypeScript + Capacitor, com reaproveitamento para web.
**Fonte visual principal:** `docs/UI_VISUAL_GUIDELINES.md` + concepts/referências da marca Lia.

Este documento fecha, de forma deliberadamente simples, as decisões visuais que não precisam bloquear o agente. Valores abaixo são tokens iniciais e podem ser refinados por acessibilidade/usabilidade sem mudar a linguagem visual.

## 1. Direção de marca

- Base escura, roxo e magenta como assinatura.
- Magenta principal inicial: `#FF3EDC`.
- Roxo de apoio inicial: `#A855F7`.
- Lilás de apoio inicial: `#D884FE`.
- Fundo neutro inicial: `#0B0A12`.
- Sucesso/confirmado inicial: `#22D3A3`.
- Atenção/pendente: âmbar/laranja acessível, sem competir com o magenta.
- Erro/conflito: vermelho/rosa acessível, sempre acompanhado de texto/ícone.
- Glow é acento, não textura permanente.
- Lia é parte da identidade e aparece em pontos de acolhimento/contexto, mas nunca deve encobrir dados, valores ou ações.

## 2. Tipografia

- Preferir a pilha de fontes do sistema para V1, evitando dependência externa desnecessária.
- Hierarquia mínima: título de tela, título de seção, título de cartão, corpo, metadado/legenda.
- Nunca usar fonte cursiva/decorativa para dados funcionais.
- Textos de estado, custo e ação devem continuar legíveis com fonte ampliada.

## 3. Espaçamento e forma

- Usar escala baseada em múltiplos de 4 px; priorizar 8 px como unidade de composição.
- Cards: raio médio/grande e borda sutil; não transformar cada elemento em um painel luminoso.
- Área de toque alvo: pelo menos ~44 px; quando houver dúvida, preferir 48 px.
- Separação visual deve vir primeiro de espaçamento/hierarquia; usar linhas e glow apenas como apoio.

## 4. Ícones

- Usar uma biblioteca de ícones lineares consistente, preferencialmente Lucide ou equivalente já disponível no projeto.
- Ícones devem complementar o texto, nunca substituir rótulos importantes.
- Não misturar estilos de ícone entre módulos.

## 5. Estados e semântica visual

Estados relevantes combinam **marcador + texto + ícone quando necessário**. Cor isolada nunca é suficiente.

- Planejada: destaque discreto de planejamento.
- Confirmada: indicador de confirmação.
- Pendente/a verificar: atenção clara e acionável.
- Em andamento: destaque de progresso.
- Concluída: tratamento suavizado + etiqueta `Concluída`.
- Cancelada: aparência claramente desativada, mantendo histórico.
- Conflito: destaque de atenção com explicação e ação.

O estado da viagem, o estado da atividade, o estado da reserva e o estado financeiro continuam independentes; a UI não deve criar um único "status universal".

## 6. Roteiro V1

Implementar primeiro o fluxo que já está suficientemente definido (✅ = no app, com teste):

1. seleção/navegação de dia; ✅
2. resumo diário adaptativo; ✅
3. timeline vertical; ✅
4. `ActivityCard` equilibrado; ✅
5. marcador de estado na timeline + etiqueta no cartão; ✅
6. `TravelSegment` compacto, expandindo por distância/atraso/custo/risco; ✅
7. atividade flexível na sequência sem horário artificial; ✅
8. atividade concluída suavizada e recolhível sem apagar histórico; ✅
9. conflito no resumo e nos cartões afetados; ✅
10. abertura de detalhes em **tela própria**; ✅
11. ações autorizadas e revisão de impacto antes de mudanças relevantes. 🟡 (concluir e cancelar
    revisam o impacto; a prévia para **substituir o roteiro vigente** ainda falta)

Depois da lista: **orçamento do roteiro** (item 8 de `UX_SCREENS.md`) entrou como planejamento separado
do dinheiro oficial — `resumirOrcamentoDoRoteiro`, mostrado na aba Gastos (`§7` e `§8` acima).

O cartão deve mostrar apenas horário, título, estado, custo essencial e contexto relevante. A tela de detalhes concentra o restante.

## 7. Custos no roteiro

- Mostrar custo no cartão somente quando houver informação útil.
- Desconhecido fica omitido por padrão.
- Se for relevante ao orçamento, mostrar que o custo precisa ser verificado.
- Nunca usar `R$ 0,00` para representar desconhecido.
- Diferenciar `estimativa`, `compromisso futuro` e `gasto registrado`.
- Não alterar saldo oficial a partir de estimativa do roteiro.

## 8. Resumo financeiro e Gastos

Para V1, usar composição simples e adaptativa:

- resumo de totais no topo;
- lista de despesas abaixo;
- destaque contextual para pendências, reembolsos e acertos;
- ações de confirmar/contestar/pagar/receber somente quando autorizadas;
- valores com moeda e natureza explícitas;
- histórico preservado em correções e contestações.

Evitar dashboards excessivamente densos ou gráficos decorativos antes de existir uma necessidade real de leitura.

## 9. Responsividade

### Celular

- uma coluna;
- timeline vertical;
- navegação inferior;
- ações primárias acessíveis com uma mão;
- tela própria para detalhes;
- respeitar safe areas e teclado.

### Tablet/web

- mesmos componentes e regras;
- aproveitar largura com colunas/painel lateral quando isso reduzir navegação;
- não criar uma segunda lógica de negócio nem uma versão visual incompatível;
- layout responde à largura disponível.

Breakpoints exatos podem ser escolhidos pelo agente com base no conteúdo real e em testes, sem bloquear a implementação.

## 10. Acessibilidade V1

- contraste adequado para texto e estados;
- foco visível e ordem lógica;
- teclado funcional na web;
- labels acessíveis para controles;
- áreas de toque confortáveis;
- suporte a fonte ampliada sem corte;
- `prefers-reduced-motion`/equivalente respeitado;
- nenhuma informação crítica transmitida somente por cor, glow ou imagem.

## 11. Animação

Manter simples:

- transições curtas para navegação e mudança de estado;
- feedback imediato para ações;
- evitar animações contínuas decorativas;
- reduzir ou remover movimento quando o sistema solicitar redução de movimento.

## 12. Mapas, reservas e documentos

Sem criar uma linguagem visual nova para cada módulo:

- **Mapas:** usar componente de mapa isolado atrás de uma camada de abstração de provedor; controles e informações importantes permanecem em UI própria.
- **Reservas:** ✅ cartões compactos com tipo, estado, data/hora, valor (ou "valor a verificar") e ação principal; confirmar pede a **evidência** e mostra o impacto antes (`telas/Reservas.tsx`).
- **Documentos:** lista/cartões simples com tipo, nome, privacidade/compartilhamento e estado; privado por padrão.

## 13. Regra de segurança para implementação

A interface pode sugerir, pré-visualizar e organizar. Não pode, por aparência, insinuar que uma ação externa aconteceu quando não há evidência.

- Não confirmar reserva automaticamente.
- Não confirmar pagamento automaticamente.
- Não alterar saldo oficial por cálculo visual.
- Não mudar permissões no cliente.
- Não apagar histórico para simplificar a tela.
- Mudanças relevantes mostram impacto antes da substituição.

## 14. Regra para o agente

Estas decisões são suficientes para **parar de perguntar decisões cosméticas e avançar a implementação da UI V1**. O agente deve escolher detalhes menores de forma pragmática, registrar somente decisões que alterem arquitetura/negócio e continuar usando `UI_VISUAL_GUIDELINES.md` como referência.

Não esperar novos concepts para iniciar os componentes básicos. Ajustes visuais posteriores devem ser incrementais e não exigir reescrever a arquitetura.

## 15. Referências visuais

As referências fornecidas pelo planejamento devem orientar a identidade Lia Go: composição mobile-first, dark UI, magenta/roxo, glow moderado, cards arredondados, timeline, presença da Lia e continuidade de marca.

**Atualização (2026-10-15):** as referências foram versionadas pelo responsável em `assets/references/`
(commits `c53c11c` e `be91721`) — caminhos oficiais registrados em `UI_VISUAL_GUIDELINES.md` §7.
A implementação seguiu sem bloquear: os tokens já estavam corretos e as referências guiaram a décima
rodada — hero da viagem com a Lia, orçamento com barra/limite, "próximo compromisso" em destaque,
checklist, documentos privados por padrão e fechamento com exportação. Falta apenas a navegação lateral
da web e a aba Documentos própria na barra inferior (hoje na aba Mais).
