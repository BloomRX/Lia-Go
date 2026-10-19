# Padrão da marca Lia — apps mobile e web

Contrapartida do `PADRAO-WINDOWS.md`. Mesmas perguntas, respostas diferentes, porque
celular e navegador não têm pasta compartilhada, nem registro, nem junction.

Escrito em 18/10/2026. **Isto é plano, não código.** Nada aqui foi executado.

---

# 1. Dependências

A regra em camadas do desktop vale igual, só muda o gerenciador:

> 1. **Núcleo de regra de negócio: sem dependência de framework.** Um pacote próprio
>    (`packages/domain` ou equivalente) com as regras e seus testes, que roda em Node puro.
> 2. **Aplicativo e API: dependência permitida**, com `package-lock.json` versionado e
>    registro no `THIRD_PARTY_NOTICES.md`.
> 3. **Usuário final nunca instala nada além do app.** Nem Node, nem runtime, nem
>    ferramenta. Loja ou navegador, e acabou.
> 4. **Versão do Node fixada** no `engines` do `package.json`, para a build ser igual em
>    toda máquina.

O Lia Go já cumpre os quatro: `packages/domain` separado e testado, workspaces,
`"node": ">=22.12.0"`. É o molde.

**Por que a camada 1 importa aqui também:** regra de negócio presa a framework morre junto
com o framework. Domínio em Node puro sobrevive a troca de React, de Capacitor e de banco.

---

# 2. Entrega: duas saídas da mesma base

| | Web | App de loja |
|---|---|---|
| Como chega | URL | Google Play, App Store |
| Custo pra publicar | hospedagem | **conta de desenvolvedor paga** — Apple cobra por ano, Google cobra uma vez |
| Correção urgente | sobe e pronto | espera revisão humana |
| Quem desinstala | o usuário fecha a aba | o sistema, com diálogo que não é seu |
| Atualização | automática | o usuário decide (ou a loja) |

**Regra:** a web é a versão de referência. O app de loja é a mesma base dentro de um
invólucro. Se um recurso só existe no app, ele precisa de justificativa escrita — senão
você mantém dois produtos achando que mantém um.

## 2.1 Três cuidados de loja

1. **Invólucro web é aceito, "site embrulhado" não.** As lojas reprovam app que é só um
   navegador apontando pra um site. O que salva é capacidade nativa real: funcionamento
   offline, notificação local, câmera, arquivo. Tenha e mostre.
2. **Separe a marca na listagem.** Descrever na loja que o app se conecta a uma
   "companheira virtual" muda a categoria aos olhos de quem revisa, especialmente na
   Apple. A conexão com a Waifu é um recurso **dentro** do app, não a proposta de valor
   na página da loja.
3. **iOS exige macOS.** Build, assinatura e simulador rodam em máquina da Apple. Não tem
   contorno. Decida cedo: comprar um Mac, alugar um na nuvem, ou lançar só Android e web
   primeiro — **e escrever isso no README** em vez de deixar implícito.

---

# 3. Onde cada coisa é salva

No desktop você escolhe a pasta. No celular **o sistema escolhe**, e ele apaga o que
achar que é descartável. Então a classificação não é organização — é sobrevivência do dado.

## 3.1 A tabela

| Tipo de dado | Android | iOS | Web |
|---|---|---|---|
| **Trabalho do usuário** (roteiro, despesa, nota) | armazenamento interno do app | `Documents/` | IndexedDB com persistência pedida |
| **Cache, miniatura, resposta de API** | diretório de cache | `Library/Caches/` | Cache Storage |
| **Temporário de uma sessão** | diretório temporário | `tmp/` | memória |
| **Config pequena** (preferência, último estado) | Preferences do Capacitor | idem | `localStorage` |
| **Token e segredo** | armazenamento seguro do sistema | Keychain | **nunca no navegador** — ver 3.4 |

## 3.2 As três regras que evitam perda de dado

**(a) Cache é apagado sem avisar.** Android deixa o usuário limpar pelo sistema; iOS apaga
`Library/Caches/` sob pressão de espaço. Se o roteiro da viagem estiver lá, ele some no
aeroporto. **Nada que o usuário criou pode morar em cache.**

**(b) No iOS, arquivo grande e regenerável em `Documents/` é motivo de reprovação.**
A pasta vai pro backup do iCloud, e a Apple cobra que só dado gerado pelo usuário fique
ali. Mapa baixado, imagem em cache e banco reconstruível vão pra `Library/Caches/`.

**(c) Na web, o navegador pode despejar o seu banco.** IndexedDB é removível sob pressão
de armazenamento. Peça persistência explícita (`navigator.storage.persist()`), **e trate
"não" como resposta possível** — avisando o usuário que a versão web não guarda para
sempre e oferecendo exportação.

## 3.3 Exportar é obrigatório, não é extra

No desktop o usuário abre a pasta e copia. No celular ele não tem pasta. Então:

> **Todo app mobile da marca exporta os dados do usuário em formato aberto, por uma ação
> visível, sem conta e sem internet.**

É o que substitui a regra nº 3 da marca ("o trabalho dele é dele"). Sem isso, o dado fica
refém do app — exatamente o que o contrato proíbe. O Lia Go já tem
`services/exportacao.ts`; é esse o caminho.

## 3.4 Segredo

- **Token da sessão:** armazenamento seguro do sistema (Keychain no iOS, equivalente no
  Android). Nunca em `localStorage`, nunca em arquivo de config.
- **Chave de provedor de IA:** no celular, **não embarque e não guarde a sua**. Cota
  gratuita é por usuário. Se o app precisa de modelo, ou o usuário cola a chave dele (e
  ela vai pro armazenamento seguro), ou a chamada passa pelo seu servidor — e aí o custo
  é seu, com todas as consequências da seção 7.1 do guia do Lia Go.
- **Na web não existe lugar seguro no cliente.** Qualquer chave no navegador é pública.
  Se precisa de segredo, ele fica no servidor.

## 3.5 Modelo de IA no celular: quase sempre a resposta é "no servidor"

No Windows existe `%LOCALAPPDATA%\Lia\Modelos\`, uma pasta compartilhada por todos os apps
da marca. **No celular isso não existe.** Cada app vive numa caixa fechada: não há pasta
comum, não há junction, e um app não enxerga o arquivo do outro.

Então das três opções do desktop, sobram duas e meia:

| Modo | Dá no celular? | Observação |
|---|---|---|
| **No aparelho** | tecnicamente sim, na prática raro | o modelo conta no tamanho do app ou é baixado só por ele. Sem compartilhar com os outros apps da Lia |
| **Servidor do usuário** (PC dele, Colab, túnel) | **sim, e é o caminho natural** | é um endereço que ele digita — o mesmo padrão do AllTalk |
| **Serviço online** | sim | chave **dele**, no armazenamento seguro do sistema. Nunca a sua embarcada (ver 3.4) |

Três avisos que valem dinheiro e reprovação de loja:

- **Modelo baixado é arquivo grande e regenerável.** No iOS ele **não** pode ficar em
  `Documents/` — vai pro backup do iCloud e é motivo de reprovação (regra (b) da 3.2).
  Vai pra `Library/Caches/`, aceitando que o sistema pode apagar.
- **Apagável significa apagado.** Se o sistema limpar o cache, o app precisa voltar à tela
  de escolha sem drama — nunca a uma tela de erro.
- **O endereço do servidor expira.** Colab e túnel caem sozinhos. Queda é estado normal:
  avisa em uma frase, oferece outro modo, e o resto do app continua funcionando — que é a
  regra do offline do Lia Go.

Para o Lia Go especificamente, a resposta prática hoje é **serviço online ou servidor**,
nunca modelo no aparelho: o app precisa caber na loja e funcionar num celular de entrada.

---

# 4. Descoberta entre apps: no celular, é apresentação

No desktop, um app novo **descobre** o anterior lendo um bilhete em lugar fixo. No celular
isso não existe — cada app vive numa caixa fechada e não lê o dado do outro. Por design,
e a favor do usuário.

| Caminho | O que é | Veredito |
|---|---|---|
| **Link profundo** (`liago://`) | um app abre o outro passando um pedido | **o mais simples.** Já funciona no Capacitor |
| **Folha de compartilhar** | o usuário manda o dado de um pro outro | **zero acoplamento**, usa o que o sistema já tem |
| **Conta** | os dois entram na mesma conta e se acham pelo servidor | só se já houver servidor |
| **Rede local** | se acham no mesmo wi-fi | serve pra falar com um app de desktop |
| Pasta compartilhada, registro, junction | — | **não existem** |

A regra da marca vira:

> **No desktop os apps se descobrem. No celular eles se apresentam.**
> O usuário autoriza uma vez, e o pareamento fica guardado.

Nunca presuma que o outro app está instalado. Tentar abrir um link profundo que ninguém
atende tem que degradar em silêncio, não em erro.

---

# 5. A conexão com a Lia Waifu

No celular isso é **problema de rede**, não de pasta: a Waifu roda no PC e o telefone está
em outro lugar.

| Nível | Como | Custo | Quando |
|---|---|---|---|
| **0. Nada** | o app não fala com a Waifu | zero | **V1, sempre** |
| **1. Mesma rede** | acha o PC no wi-fi, pareia com código | zero | V2 |
| **2. Rede privada** (Tailscale/WireGuard) | de qualquer lugar, sem abrir porta | o usuário instala | V3 |
| **3. Relay na nuvem** | você hospeda o intermediário | **conta mensal sua, que cresce com o sucesso** | só com plano de custo |

Precedente real: o Mr. Mak Workspace (MIT) faz o nível 2 — celular acompanha agentes que
rodam no computador, por Tailscale. Está entregue.

**O contrato das seis cláusulas não muda** (está no `GUIA-APP-NOVO.md` §6.1): ausência é
normal; ponte declarada por verbos curtos; **conversa não é autorização**; a cadeia
inteira aparece no pedido; dado atravessa por categoria com opt-in e revogação; ponte
caída, os dois continuam.

---

# 6. O que a sessão faz e o que é seu

Depende de onde o agente roda. Uma sessão na nuvem só tem o repositório; um agente no seu
terminal (Claude Code, Cursor, Cline) tem a máquina inteira. **Mas a fronteira do mobile
não se move:** build nativa, emulador, assinatura e loja exigem Android SDK/JDK, e o iOS
exige macOS — nenhum agente contorna isso.

| Quem | O quê |
|---|---|
| o agente, em qualquer cenário | domínio, app, API, testes, migrações, documentação |
| o agente, **se** rodar na sua máquina | subir a versão web, rodar a suíte, olhar o resultado |
| **você**, sempre | build nativa, emulador, assinatura, envio pra loja, teste em aparelho |

A sessão **não pode afirmar** que o app funciona no Android ou no iOS. O máximo honesto é
*"testes verdes; build nativa não executada"*.

O Lia Go já registra isso no próprio `capacitor.config.ts`: *"o Android só é gerado na
máquina do desenvolvedor, porque exige Android SDK/JDK"*.

## 6.1 `visual-qa` nas três plataformas

| Alvo | Como sai o print | Funciona? |
|---|---|---|
| **Web** | screenshot da página | **o caso mais fácil que existe** |
| **Android** | emulador + `adb exec-out screencap` | **sim, no Windows**, com o SDK instalado |
| **iOS** | simulador | **exige macOS** |

Como a base é a mesma, o `visual-qa` na web pega a maioria esmagadora dos defeitos visuais
antes de qualquer empacotamento. É a ideia de usar HTML como camada barata de iteração —
aqui ela não é truque, é a arquitetura.

---

# 7. Resumo em uma tela

| Pergunta | Resposta |
|---|---|
| Regra de dependência | Três camadas. Domínio sem framework, app livre, **usuário não instala nada** |
| Web ou app? | **Web é a referência**, o app é a mesma base embrulhada |
| Onde salvo o trabalho do usuário? | Interno do app (Android) · `Documents/` (iOS) · IndexedDB com persistência pedida (web) |
| Onde salvo cache? | Pasta de cache. **Nunca** o que o usuário criou — o sistema apaga |
| Como o usuário leva os dados embora? | **Exportação obrigatória**, formato aberto, sem conta e sem internet |
| Onde guardo token? | Armazenamento seguro do sistema. **Nunca** `localStorage` |
| Posso embarcar minha chave de IA? | **Não.** Nem no app, nem na web |
| Um app novo acha os anteriores? | Não lê o dado deles. **Pareamento**: link profundo, compartilhar ou conta |
| Falar com a Waifu? | Rede, não pasta. V1 sem conexão; depois mesma rede; depois Tailscale |
| Quem faz a build nativa? | **Você.** A sessão só entrega código |

---

## O que não foi verificado

- **Nada foi executado.** Sem build, sem emulador, sem aparelho.
- **Caminhos e nomes exatos de diretório** variam por versão de Android, de iOS e do
  Capacitor. Confirme na versão que você usar — aqui o que importa é a **classificação**
  (trabalho do usuário × cache × temporário), que é estável.
- **As regras de loja mudam.** Confirme valores de conta de desenvolvedor e diretrizes
  direto na Apple e no Google antes de planejar orçamento ou prazo.
- **O escrutínio da Apple sobre app de companhia** é tendência observada, não regra
  publicada. Trate como risco a mitigar, não como fato.
- **A persistência de IndexedDB** depende de navegador, de espaço livre e de o usuário ter
  adicionado o site à tela inicial. Teste o caminho de despejo de propósito, em vez de
  supor que não acontece.
