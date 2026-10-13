# AGENTS.md — Instruções permanentes para o agente do Lia Go

## Missão
Implementar o Lia Go de forma incremental, segura, testável e fiel às decisões documentadas. O produto é gratuito para os usuários; não presumir orçamento para APIs pagas ilimitadas.

## Leitura obrigatória
Antes de codificar, leia `PLANEJAMENTO_MESTRE.md` e todos os documentos em `docs/` relevantes à tarefa.
Para qualquer trabalho de arquitetura, stack, API, banco ou sincronização, leia também `docs/ARCHITECTURE.md`.
Se o repositório já tiver arquitetura, convenções ou código, inspecione-os antes de propor mudanças.

## Stack (decidida — não substituir sem autorização)
- Cliente: **React + TypeScript + Capacitor**, uma base de código para app mobile e web.
  **Celular é a plataforma principal**; web é complementar.
- Monorepo com npm workspaces: `apps/mobile`, `apps/api`, `packages/domain` (regras puras, sem I/O e sem UI),
  `packages/contracts` (schemas compartilhados).
- Servidor é a **única autoridade**: recálculo, autorização e gravação acontecem nele. O app usa o domínio
  só para prévia/otimista e offline; resultado do cliente nunca é verdade oficial.
- Banco central compartilhado: **PostgreSQL no servidor**. **SQLite local nunca é o banco central** —
  no dispositivo é apenas cache offline não oficial.
- Autenticação: e-mail + senha próprios (scrypt) com sessão em cookie HttpOnly.
- Ambiente da primeira etapa: **somente máquina local** (sem exposição pública e sem custo).
- Build Android/iOS **não** roda no ambiente Arena (sem JDK/Android SDK/Xcode): código, testes e build web
  rodam no Arena; build nativo roda na máquina Windows (Android) ou macOS (iOS).

## Hierarquia das decisões
1. Regras explícitas em `docs/BUSINESS_RULES.md` e decisões confirmadas em `docs/DECISIONS_AND_OPEN_QUESTIONS.md`.
2. `PLANEJAMENTO_MESTRE.md`.
3. `docs/ARCHITECTURE.md` (arquitetura e stack decididas; substituir a stack exige autorização).
4. Decisões técnicas já adotadas no repositório.
5. Hipóteses reversíveis documentadas pelo agente.

Não contradiga decisões confirmadas para simplificar a implementação. Se houver conflito entre documentos, não escolha silenciosamente: identifique-o, proponha correção e aguarde quando o conflito afetar comportamento do produto.

## Processo obrigatório
1. Inspecione a base existente e informe o estado real do projeto.
2. Defina um plano pequeno e verificável para a tarefa atual.
3. Implemente uma fatia funcional de ponta a ponta; evite grandes mudanças sem testes.
4. Execute testes, verificações estáticas e build disponíveis (ver comandos abaixo).
5. Corrija regressões antes de seguir.
6. Atualize documentação, decisões, backlog e instruções de execução quando necessário.
7. Ao terminar, informe arquivos alterados, comportamento entregue, testes executados, limitações e próximo passo.

## Comandos de verificação
- `npm test` roda a suíte completa: ferramentas (23) + domínio (54) + sincronização (38) + app (13) + API (39). Sem banco, os testes de API são pulados com aviso.
- `npm run typecheck` confere os tipos dos quatro pacotes e é pré-requisito da automação antes de sincronizar.
- `npm run test:sync` cobre fila de envio, conflito e cursor; `npm run test:app` cobre o armazenamento do aparelho e o sincronizador.
- `npm run test:domain` / `npm run test:api` rodam cada parte isoladamente.
- `node --test` roda testes de TypeScript sem build (é o que os pacotes usam por baixo).
- `node tools/dev.mjs testes` roda tudo e grava relatório em `reports/`.
- `LiaGo.bat` (opção 1) faz banco + migrações + testes + relatório + sincronização em um duplo clique.
- `python tools/project_cli.py validate --full` roda as suítes reconhecidas localmente, sem instalar nada.
- `LiaGo.bat` automatiza instalação, testes, relatório em `reports/` e sincronização da branch de trabalho.
- Vite em desenvolvimento **exige** `server.host: true` e `server.allowedHosts` com o host do preview;
  sem isso o preview responde HTTP 403 (evidência em `docs/ARCHITECTURE.md` §2).

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
- HTTPS obrigatório antes de qualquer dado real de terceiros; em rede local, usar **apenas dados sintéticos**.
- Operações financeiras devem ser auditáveis e determinísticas; IA não calcula saldos oficiais nem confirma fatos externos.
- Preservar histórico de alterações relevantes; não apagar ou sobrescrever silenciosamente.
- Não criar pagamentos, transferências, reservas, cancelamentos externos ou despesas automaticamente sem autorização e integração real.
- Não usar dados reais em testes; criar fixtures sintéticas.
- Considerar concorrência, funcionamento offline, sincronização e verificação de permissões no servidor.
- Não registrar no app dados sensíveis em armazenamento local sem proteção (documentos e localização).

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
