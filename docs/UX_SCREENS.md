# Mapa de telas e comportamentos — Lia Go

**Plataforma principal: celular** (app Capacitor); a versão web é complementar e reaproveita a mesma base
de código (React + TypeScript). Layout, alvos de toque e área segura devem ser desenhados primeiro para
telas pequenas.

## Navegação principal
Barra inferior pretendida: **Visão geral**, **Roteiro**, **Gastos**, **Documentos**. Área **Mais**: Participantes, Reservas e Configurações.
**Estado em 2026-10-15 (décima rodada):** a barra tem Visão geral, Roteiro, Gastos e **Mais**; na aba Mais já vivem **Participantes**, **Reservas**, **Checklist**, **Documentos** e **Fechamento/exportação**, além de "Este aparelho" (dados locais e sessão). Documentos ganha aba própria quando a barra inferior tiver cinco itens (celular pequeno pede teste antes).

## Telas V1
1. **Boas-vindas / autenticação** — entrar, criar conta, recuperação; métodos finais a definir após inspeção técnica.
2. **Início** — novo usuário: Criar viagem. Usuário existente: viagens próximas, pendências, histórico e estado de sincronização.
3. **Criar viagem** — conversa e formulário guiado alternáveis sem perder conteúdo; perguntar só o essencial; salvar rascunho.
4. **Convites e participantes** — papéis, estado do convite, acesso, remoção/saída claramente distintos.
5. **Dashboard da viagem** — destino, datas, estado, orçamento, próximo compromisso, alertas e pendências.
6. **Roteiro** — timeline vertical por dia; horários, duração, deslocamentos, custos e alertas; distinguir proposta, aprovada, confirmada e a verificar.
7. **Detalhes da atividade** — tela própria para informações completas da atividade; o cartão do roteiro permanece resumido.
8. **Revisão de mudanças** — mostrar diferenças, conflitos e impactos antes de substituir roteiro vigente.
9. **Orçamento** — limite coletivo/individual, realizado versus comprometido, alertas configuráveis. ✅ implementada (limite é planejamento; barra + estado em texto; atenção a partir de 80%; limite coletivo do organizador, individual de cada pessoa).
10. **Nova despesa / detalhe** — campos obrigatórios, participantes e tipo de gasto, comprovante opcional, estado de confirmação e histórico.
11. **Rateio** — método, participantes, valores, parcelas e soma exata; revisão humana.
12. **Saldos e acertos** — quem deve a quem, sugestão de transferências, pagamento informado/confirmado/parcial/contestado.
13. **Moedas** — valores originais e convertidos, taxa e referência temporal, identificação de estimativas.
14. **Reservas e checklist** — registros manuais, links, prazos e documentos associados; não afirmar confirmação sem evidência. ✅ implementada (reservas na aba Mais; checklist na aba Mais, com prazo que não conclui nada e reabertura com motivo).
15. **Documentos** — privados por padrão, compartilhamento individual, destinatários e revogação. ✅ implementada (privado por padrão; compartilhar/revogar; remover exige motivo e é remoção lógica; o app guarda link e descrição, não o arquivo).
16. **Central de notificações** — filtros por viagem, categoria, prioridade e estado; histórico completo.
17. **Participantes e permissões** — acesso, convites, saída/remoção e funções administrativas.
18. **Configurações** — preferências, notificações, moedas, privacidade e sessão.
19. **Cancelar viagem** — prévia de impactos conhecidos e confirmação explícita; após cancelar, lista de pendências restantes.
20. **Concluir viagem** — confirmação por qualquer participante ativo; resumo previsto versus realizado e pendências financeiras claramente separadas.
21. **Fechamento / exportação** — resumo de despesas, saldos, moedas, pagamentos e pendências; exportar somente dados autorizados. ✅ implementada (números do servidor, acertos como sugestão, `.txt` e `.csv`; no celular sem download, o texto aparece para copiar).

## Padrão visual do roteiro — decisões confirmadas

As decisões detalhadas e o padrão de componentes estão em [`UI_VISUAL_GUIDELINES.md`](UI_VISUAL_GUIDELINES.md). Resumo:

- **Detalhes:** atividade abre em **tela própria**.
- **Cartões:** padrão **equilibrado**, mostrando horário, estado, custo essencial e contexto quando relevante.
- **Estados:** apresentação **híbrida**, com marcador na timeline e etiqueta textual no cartão.
- **Custos:** apresentação **contextual**; custo desconhecido fica omitido por padrão e só é sinalizado quando relevante ao planejamento do orçamento. Nunca tratar desconhecido como zero.
- **Conflitos:** aparecem no **resumo do dia** e nas **atividades envolvidas**, com explicação e ação para resolver.
- **Deslocamentos:** compactos por padrão; detalhes ampliados quando distância, atraso, custo ou risco forem relevantes.
- **Atividades flexíveis:** permanecem na sequência lógica, com indicação visual de flexibilidade e sem horário artificial.
- **Concluídas:** marcação discreta na timeline + etiqueta no cartão; podem ser recolhidas sem apagar histórico ou mudar a ordem.
- **Resumo diário:** adaptativo; compacto por padrão, expandindo indicadores relevantes e destacando conflitos/pendências importantes.

## Estado real de implementação (2026-10-15)

Isto é o que **existe no app hoje**, não o que está planejado — conferido rodando o app
(`npm run dev:app` + `npm run dev:api`), não por leitura de código.

| # | Tela | Estado | Onde |
|---|---|---|---|
| 1 | Boas-vindas / autenticação | ✅ entrar e criar conta (senha ≥ 10) | `telas/Entrar.tsx` |
| 2 | Início | ✅ viagens, pendências, estado de sincronização | `telas/Inicio.tsx` |
| 3 | Criar viagem | ✅ formulário único; rascunho e transição para *planejada* | `telas/Viagem.tsx` (aba Visão) |
| 4 | Convites e participantes | ✅ convite com token mostrado uma vez; participação por token | `telas/Viagem.tsx` |
| 5 | Dashboard da viagem | ✅ destino, datas, estado, saldos e pendências | `telas/Viagem.tsx` (aba Visão) |
| 6 | Roteiro | ✅ timeline por dia, dias com conflito, resumo adaptativo, concluídas recolhíveis, criar atividade | `telas/Roteiro.tsx` |
| 7 | Detalhes da atividade | ✅ ficha, custo com natureza, concluir/cancelar/corrigir com motivo, histórico, **revisão de impacto antes de concluir/cancelar** | `telas/Atividade.tsx` |
| 8 | Revisão de mudanças | 🟡 impacto conhecido antes de concluir/cancelar/abrir outra viagem; falta a prévia para **substituir o roteiro vigente** | `telas/Atividade.tsx`, `packages/domain/src/roteiro.ts` (`revisarImpacto`) |
| 9 | Orçamento | 🟡 previsto do roteiro (estimativa × já combinado × a verificar) na aba Gastos, separado do saldo oficial; falta limite coletivo/individual e alertas | `telas/Viagem.tsx`, `resumirOrcamentoDoRoteiro` |
| 10–11 | Nova despesa / rateio | ✅ despesa com rateio igualitário, soma exata | `telas/Viagem.tsx` (aba Gastos) |
| 12 | Saldos e acertos | ✅ saldo oficial do servidor + acertos sugeridos | `telas/Viagem.tsx` (aba Gastos) |
| 13 | Moedas | ⬜ (BRL hoje; estrutura de dinheiro já é por moeda) | — |
| 14 | Reservas | ✅ criar (prevista), confirmar com evidência, cancelar com motivo, valor desconhecido como "a verificar" | `telas/Reservas.tsx` (aba **Mais**), `packages/domain/src/reserva.ts` |
| 15–16 | Checklist / documentos | ⬜ (próxima fatia) | — |
| 16 | Central de notificações | ⬜ | — |
| 17 | Participantes e permissões | 🟡 papéis e convite existem; tela administrativa não | `telas/Viagem.tsx` |
| 18 | Configurações | ⬜ (sessão em "sair") | — |
| 19 | Cancelar viagem | ✅ prévia de impactos (`impactos-cancelamento`) + confirmação explícita na tela da viagem | `telas/Viagem.tsx`, `packages/domain/src/trip-state.ts` |
| 20 | Concluir viagem | ✅ transições com permissão por destino (bloqueia criar atividade/reserva depois de concluída) | `telas/Viagem.tsx`, `packages/domain/src/trip-state.ts` |
| 21 | Fechamento / exportação | ⬜ | — |

**Fora das telas:** a **Lia** (a assistente) ainda não fala no app. As sugestões descritas em
`UI_VISUAL_GUIDELINES.md` têm lugar reservado na interface, mas nenhuma é exibida — não há texto gerado
apresentado como conselho enquanto não existir IA de verdade por trás.

## Estados de interface obrigatórios
Para cada tela aplicável: carregando, vazio, erro, offline/desatualizado, conflito, sucesso e sem permissão.
- Exibir claramente quem pode agir e por quê.
- Não apresentar botão para ação não autorizada.
- Ocultar detalhes sensíveis em notificações de tela bloqueada por padrão.
- Preservar formulário/contexto ao navegar.
- Confirmar ações destrutivas e mostrar impactos conhecidos.
- Em sugestão da Lia, distinguir “sugestão” de ação já aplicada.

## Direção visual
Profissional, moderna e confiável; base escura com roxo/magenta, efeitos luminosos moderados e cartões arredondados, adaptada para mobile, contraste e acessibilidade. A personalidade da Lia não deve competir com dados e ações.

Referências de conceito fornecidas no planejamento devem ser tratadas como direção visual, não como especificação pixel-perfect. A identidade deve permanecer consistente entre mobile e web, com o celular como prioridade.
