# Mini SK — editor modular ao vivo

Abra o **index.html**: no computador, com dois cliques; no celular, pelo navegador ou hospedado de graça (GitHub Pages ou Netlify).
Ele não usa Replit nem servidor. Também não depende de nenhuma biblioteca de fora: são só HTML, CSS e JavaScript.

## O que tem

| Botão | Para quê |
|---|---|
| ☰ | Árvore de arquivos. Cria arquivo ou pasta (＋📄 ＋📁). Importa arquivos, uma pasta inteira ou um .zip (⤒). Baixa o projeto em .zip (⤓). |
| ⋯ ao lado de cada arquivo (ou segurar o dedo) | Abrir, ver no preview, renomear, duplicar, mover, baixar, copiar o caminho, **analisar com a IA** e apagar. |
| Preview (embaixo) | Mostra o resultado ao vivo enquanto você digita (⚡). Para mudar o tamanho, arraste a barrinha ou use ▁ ▔. O botão ▤ abre o console de erros. Funciona com CSS, JS, imagens, módulos (`import`) e `fetch('dados.json')`. |
| 🔍 Buscar | Procura em todos os arquivos e destaca o que achou em amarelo. Tocar num resultado abre o arquivo no ponto certo. Também troca tudo de uma vez. |
| 🤖 IA | Aceita chave do Groq, Gemini (a antiga `AIza…` e a nova `AQ.…`), OpenRouter, Claude, OpenAI, xAI e outras. Quando o código vem com o nome do arquivo, o botão **Aplicar** grava direto nele. Tem 🎤 ditado e 🔊 voz. |
| ⌨️ Terminal | Terminal **ligado à árvore**: o que você cria aqui aparece em ☰ na hora. Funciona no celular, sem internet.<br>• `ls`, `cd`, `pwd`, `tree`, `cat`, `head`, `tail`, `wc`, `mkdir`, `touch`, `rm`, `mv`, `cp`, `echo texto > arquivo`, `grep`, `find`, `du`, `open`, `zip`.<br>• **`npm search pdf`** procura bibliotecas (como na Replit), com botão **＋ instalar**. Também tem `npm info`, `npm install`, `npm uninstall`, `npm ls` e `npm init`. Aqui o npm anota no `package.json`; os arquivos de verdade são baixados ao montar (GitHub, PC ou Termux).<br>• **`cdn nome`** dá a linha `<script>` para usar a biblioteca direto no HTML.<br>• **`run arquivo.js`** roda JavaScript do projeto ali mesmo.<br>• ↑ ↓ repetem comandos; Tab completa nomes; `&&` junta comandos. Antes de `rm` e `mv`, ele tira um 📸 checkpoint. |
| 🔗 Links | **Meus Links:** guarda os endereços dos seus PWAs e sites, que não somem.<br>• Cole **um ou vários links**, até um texto inteiro: ele acha os links e dá nome e ícone sozinho. Tem pastas, busca, 📋 copiar, ✏️ editar e 🗑 apagar.<br>• **📲 Criar página no projeto** gera `meus-links/index.html`, só com os seus links, para instalar como app pelo 📱 PWA ou publicar no GitHub Pages.<br>• **💬 Colar conversa** (Monica, Claude, ChatGPT…): manda para o **✂️ Fatiador**, para o **🧩 Desembaralhar** ou só pega os links dela. |
| ▶️ Play | **Playground ao lado**, separado do projeto (não é a primeira tela).<br>• **HTML** (com abas CSS e JS), **React** e **Python**. O Python roda no próprio navegador, sem servidor.<br>• **Ao vivo** ou no ▶ Rodar. O console aparece embaixo e o ⛶ abre em tela cheia.<br>• Se você colar um código React ou Python, ele troca o modo sozinho.<br>• **💾 Salvos:** ficam guardados no aparelho, com procurar, abrir, renomear, duplicar e apagar.<br>• **⤒ Importar vários:** escolha vários .html de uma vez, ou um .zip com todos os seus códigos. Cada um vira um Salvo, e os repetidos são ignorados.<br>• **⤓ Cópia de segurança:** baixa todos os Salvos num .zip para guardar no Drive. Para voltar tudo, é só importar esse .zip.<br>• **Mais:** pegar o arquivo aberto, gravar no projeto (tira foto antes), abrir .html/.py, baixar e copiar.<br>React e Python precisam de internet na primeira vez para baixar o motor; HTML funciona sem internet. |
| 📸 Voltar | Checkpoints, que são fotos do projeto inteiro. Antes de apagar, importar, trocar tudo ou aplicar código da IA, ele tira uma foto sozinho. Na lista, você pode voltar, ver o que mudou ou baixar o .zip. |
| 🐙 GitHub | Cole o token uma vez: ele fica salvo e o painel mostra sempre **"Conectado como …"**.<br>• **Enviar:** escreva só o nome do repositório. Se não existir, ele cria.<br>• **Meus repositórios:** a lista aparece sozinha, com **Importar** ou **Puxar aqui**.<br>• **Importar por link** e **Publicar site (Pages)**.<br>• **⚙️ Execuções:** depois de enviar, ele acompanha sozinho o que o GitHub faz (teste, APK, site), passo a passo. Se falhar, mostra o motivo e tem **🤖 Explicar com a IA**. Também lista as receitas (workflows) do repositório, com **▶ Rodar** e **🗑 Tirar**.<br>O token precisa de **Workflows: Read and write** para enviar receitas. |
| ✂️ Fatiar | Divide um arquivo grande (JS, TS, TSX, HTML, CSS, Python, MD) em **blocos com índice**: imports, funções, componentes, tipos, estilos.<br>• Cada bloco mostra as linhas e **quem usa quem**.<br>• **✂️ por dentro** abre os blocos gigantes, como um componente de 3.000 linhas.<br>• Exporta em **MD**, **TXT** (o ⤵ Montar recria) e **HTML** com Copiar em cada bloco.<br>• **Criar módulos** e **🔗 Juntar** sempre **conferem**: juntando dá o original, letra por letra. |
| 🧪 API | Testa o **servidor do projeto** rodando no seu PC (ex.: `http://localhost:8080`).<br>• **Procurar rotas:** lê o código e lista as rotas do servidor e as chamadas que a tela faz. Marca **"rota não achada"** quando a tela chama algo que o servidor não tem, que é o jeito de achar onde quebrou.<br>• **Enviar** (GET/POST/…) mostra o status, o tempo e a resposta.<br>• **Testar todas as GET** testa uma por uma (✅/❌).<br>• **🤖 Perguntar à IA** manda o resultado para a IA explicar. |
| 📦 APK | Gera um **APK de verdade**: o HTML vai **dentro** do app e funciona sem internet. Não é a "casca" TWA.<br>1. **Preparar arquivos** cria `apk.config.json`, a pasta `android/` e `.github/workflows/apk.yml`.<br>2. **Enviar e gerar** envia ao GitHub e manda montar.<br>3. O painel acompanha cada passo (✅ ❌ ⏳). Se der certo, mostra o botão de baixar; se der erro, mostra o motivo e o botão **🤖 Explicar com a IA**.<br>A chave de assinatura fica guardada, então o APK novo instala por cima do antigo.<br>**Novo:** dentro do APK, **baixar/salvar funciona em qualquer HTML** (vai para Downloads), o **microfone e a câmera** pedem permissão, e **imprimir** avisa que não dá. Projetos que você já preparou antes: aperte **Preparar arquivos** de novo para receber isso.<br>**Novo — 🔒 Terminal real (lacre):** marque só se o app usa o terminal WebContainer/StackBlitz (o que dava "ausência de política COEP" no APK). O próprio APK passa a pôr o lacre que o sw.js punha no navegador. ⚠️ Pode bloquear imagens/scripts de outros sites que não permitem; e o navegador interno do Android pode não aceitar o terminal mesmo com o lacre — só testando.<br>Não funciona dentro de APK: ditado por voz do navegador e programas que precisam de servidor (localhost, /api). |
| ☁️ EAS | APK de app **Expo** (tem app.json) pela nuvem do Expo, do jeito **oficial** — a mesma receita que o Replit fez no DevMobile, só que arrumada.<br>**Os dois tokens:** o do GitHub (o do painel 🐙) e o do **Expo** (expo.dev → Access tokens), que fica só no aparelho e vai **trancado** para o repositório (Settings → Secrets → EXPO_TOKEN).<br>Antes de gastar build, ele **confere**: dono, slug, projectId, pacote, imagens que faltam, versões do Expo/React que não combinam, `catalog:` do Replit e arquivos secretos (keystore, credentials.json, .env) — esses ele **não deixa** subir.<br>**🔧 Corrigir** arruma o app.json/eas.json e cria a receita. **☁️ Enviar e compilar** envia, tranca o token, manda rodar e acompanha; no fim mostra o link das builds no Expo.<br>Para **HTML**, continue no 📦 APK (não gasta build do Expo). |
| 🧬 Raio-X | Lê **todos** os package.json, inclusive dos projetos da Replit com vários projetos dentro (monorepo).<br>• Explica cada dependência em português: para que serve, se é obrigatória ou só para montar, se é coisa da Replit.<br>• Gera o **plano completo** (baixar .md, copiar ou salvar), o package.json unificado e as pastas vazias em .bat.<br>• **📦 Pacote para a IA:** junta os arquivos importantes num .txt para mandar no chat.<br>• **⤵ Montar:** cola um texto com `===== ARQUIVO: caminho =====` e ele cria os arquivos.<br>• **🧩 Conversa sem marcação:** para conversas copiadas do app de IA em que o código veio sem ```. Ele separa o texto do código e recupera cada arquivo:<br>&nbsp;&nbsp;– páginas inteiras;<br>&nbsp;&nbsp;– "montagens" (PARTE 1, 2, 3…) já na estrutura de pastas certa;<br>&nbsp;&nbsp;– trechos soltos;<br>&nbsp;&nbsp;– versões (v1, v2…), com a mais recente marcada. |
| 📱 PWA | **🎨 Ícone:** o seu Gerador de Ícones PRO, agora com a versão *maskable* (que o Android recorta sem cortar o desenho), SVG, favicon.ico e apple-touch-icon. Grava em `icons/` ou baixa em .zip.<br>**📲 Instalável:** escolha a página. Ele cria o que faltar (ícones, manifest e service worker com a lista de arquivos feita sozinha) e arruma o `<head>` sem duplicar nada.<br>**🧭 Hub:** acha todas as páginas .html do projeto, sem você digitar endereço, e **gera o index do Hub já montado**, com a lista gravada dentro. Instalou uma vez, está tudo lá, em qualquer celular. |
| ⚙️ Config | **🔑 Cofre de chaves:** as chaves de IA, o token do GitHub e "Minhas chaves e links", guardados só neste aparelho. Cada chave tem 👁 ver, 📋 copiar e ✏️ editar. |
| 🗂 Projetos | Vários projetos: abrir um .zip como projeto novo, renomear e apagar. Também mostra o espaço usado e os atalhos. |

## Cérebro da IA (para ela não se perder)
Cada projeto tem uma pasta `.sk/` com dois arquivos:
- `.sk/diario.md` é o resumo do projeto: o objetivo, o que já funciona e o que falta. A IA lê esse arquivo em toda mensagem e o atualiza quando termina algo.
- `.sk/memoria.json` guarda a conversa daquele projeto.

**💰 Gasto:** embaixo de cada resposta aparece ↑ tokens enviados · ↓ tokens recebidos · custo em reais. Na linha 💰 do painel ficam o total de hoje e do mês; tocando nela você define o **limite do mês**, o **aviso antes de pedido caro**, a cotação do dólar e preços próprios. Groq e Gemini (cota grátis) aparecem como grátis. Se a resposta parar no meio, aparece **▶ Continuar de onde parou**.

O medidor de tokens mostra quanto está sendo enviado. Quando passa do limite escolhido, as mensagens antigas ficam de fora, mas o diário continua sendo enviado.

## Codificação e tipos
Ao importar, ele reconhece UTF-8, UTF-16 e Windows-1252 (o "Latin-1" de arquivos antigos do Windows), para os acentos não virem lixo. Arquivos binários, como imagens, PDF e APK, são guardados intactos. A barra de baixo do editor mostra o tipo do arquivo (HTML, JS, Java, JSON…), a codificação e o tamanho.

## Onde ficam os arquivos
Os projetos ficam **no navegador deste aparelho** (IndexedDB) e continuam lá quando você fecha.
Para não perder nada:
- baixe o .zip (⤓) de vez em quando, **ou**
- envie para o GitHub (🐙).

Limpar os dados do navegador apaga os projetos.

## Links entre páginas no preview
Se uma página tem link para outra do projeto (ex.: `<a href="peticao/index.html">`), clicar no preview abre essa outra página ali mesmo.

## Atalhos (no computador)
| Atalho | Faz |
|---|---|
| Ctrl+S | Salvar |
| Ctrl+B | Abrir ou fechar os arquivos |
| Ctrl+Shift+F | Buscar |
| Ctrl+J | IA |
| Ctrl+G | Ir para uma linha |
| Ctrl+Enter | Enviar para a IA |
| Alt+P | Aumentar ou diminuir o preview |

## Módulos (pasta `js/`)
Cada arquivo faz uma coisa. Eles conversam por eventos (`SK.on` / `SK.emit`), então dá para trocar um módulo sem quebrar os outros.

| Arquivo | Cuida de |
|---|---|
| 00-core.js | base, avisos, janelas, banco do navegador |
| 04-conta.js | sem login e sem nuvem (limpa ligações antigas) |
| 10-fs.js | arquivos, pastas, projetos, codificação, importar e exportar |
| 20-zip.js | ler e criar .zip (sem biblioteca) |
| 30-highlight.js | cores do código |
| 40-editor.js | editor e abas |
| 50-tree.js | árvore de arquivos |
| 60-preview.js | preview ao vivo e console |
| 70-search.js | buscar e trocar |
| 80-ai.js | IA, chaves, memória, tokens |
| 81-gasto.js | 💰 gasto da IA: tokens, custo, limite do mês |
| 85-checkpoints.js | checkpoints |
| 86-terminal.js | ⌨️ terminal ligado à árvore, npm search |
| 87-links.js | 🔗 Meus Links, página dos links, colar conversa |
| 89-config.js | ⚙️ Configuração: conta, cofre de chaves, backup |
| 90-github.js | GitHub |
| 91-acoes.js | Execuções no GitHub (Actions): acompanhar, rodar, tirar receita |
| 92-playground.js | Playground (HTML, React, Python) e salvos |
| 93-conversa.js | Desembaralhar conversa (código sem marcação) |
| 94-fatiador.js | Fatiador: blocos, índice, módulos, juntar |
| 95-pwa.js | ícones, instalar como app, Hub |
| 96-apk.js | APK Android pelo GitHub (projeto Android em Java + receita) |
| 97-analise.js | Raio-X: dependências, plano, pacote para IA, montar de texto |
| 98-api.js | Testar a API do projeto (rotas, chamadas, pedidos) |
| 99-app.js | junta tudo e monta a tela |

## Próximos passos planejados
- 🔗 Ponte com o Termux/PC para rodar Node de verdade.


## Sem login e sem nuvem
O Mini SK abre direto, sem senha, e guarda tudo só neste aparelho (projetos, chaves, links, Playground).
Para ter uma cópia em outro lugar: 🐙 GitHub, ou baixar o projeto em .zip.

## 💾 Backup de tudo e APK
- 🗂 Projetos → **💾 Backup de tudo**: um arquivo .json com todos os projetos, Links, Playground e (se quiser) as chaves. **⤒ Restaurar** traz tudo de volta — é assim que se passa do PWA para o APK (cada um guarda as coisas num lugar separado).
- APK gerado pelo 📦: o **preview abre dentro do app** (antes ele era mandado para o navegador e não abria) e o app **salva antes de ir para o fundo**. Não mude o "nome do pacote" depois de instalar, senão o Android trata como outro app (com a memória vazia).


## Novidades de 08/10/2026 — a IA sabe onde está
- **Ficha do ambiente automática:** em toda pergunta (também no chat livre) a IA recebe, sem você explicar, o que é o Mini SK, o que ele tem (cada ferramenta e o botão), o que ele NÃO faz (servidor, npm de verdade…) e um **resumo do projeto aberto** (package.json, comandos, pacotes, se é React/Vite/Expo/Capacitor, se veio da Replit). Custa ~900 tokens por pergunta.
- **A IA pede arquivo:** se ela precisar ver um arquivo que não veio, escreve `LER: caminho` e aparece o botão **📎 Mandar … para a IA** — um toque e ele vai.
- **⬇ Memória / ⬆ Memória** (no painel da IA): baixa a conversa + o diário do projeto num `.json` e traz de volta depois, em qualquer aparelho. Assim nunca precisa repetir a história.
- **📚 Inventário (botão novo na barra):** escolha vários códigos (.html, .js ou um .zip com eles) e ele diz o que cada um faz (título, telas, botões), o que usa (IA, voz, PDF, Word, ZIP, GitHub, Banco Central, DJEN…), junta as **versões do mesmo programa** e marca a ⭐ mais completa, e avisa chave exposta e marca da Replit. Baixa ou copia o **manual do inventário** e tem **🤖 Pedir à IA o que juntar**. Os arquivos só são lidos, não entram no projeto.
- **📤 Mandar para o Drive** (em 🗂 Projetos): abre o "Compartilhar" do celular — escolha Drive, WhatsApp ou e-mail. Manda o projeto aberto (.zip) ou o backup de tudo (.json). Sem cadastro no Google.
- **Preview no APK:** quando o Mini SK abre como arquivo (o que acontece no APK: file:///android_asset, content://…), o Android não deixava o preview carregar a página (endereço blob:). Agora, fora de um site (http/https), a página entra direto no quadro do preview (srcdoc) e os arquivos dela viram endereços data:. Gere o APK de novo com esta versão para valer.

## 🗣️ Voz e conversa (no painel 🤖 IA)
- **Voz natural, grátis:** no **PC, pelo Edge**, aparece a **"Microsoft Francisca Online (Natural)"** — é a voz neural do seu jurídico (velocidade 1,15, tom 0,95). No **celular, pelo Chrome**, usa a voz do Google do aparelho.
  - Para a voz do Google ficar boa no celular: Configurações → Acessibilidade → **Saída de texto para fala** → Mecanismo: **Google** → ⚙️ → **Instalar dados de voz** → Português (Brasil) → escolha uma voz de **alta qualidade**.
- **Modo conversa:** ela ouve; quando você para de falar por **3 segundos**, manda para a IA; lê a resposta; volta a ouvir sozinha, até você desligar.
- **Novo:** se você **voltar a falar enquanto ela fala, ela para e escuta** (e não se confunde com o eco da própria voz). Se ela se interromper sozinha, use fone de ouvido ou desmarque "Parar de falar quando eu falar" nos ajustes da voz.
- **Novo:** regra fixa para a IA — **nunca** dizer "vou fazer / aguarde" e ficar parada: ela faz na hora ou diz que não dá, e **sempre dá retorno** do que fez.
- ⚠️ **Dentro de APK** a conversa por voz **não funciona** (o Android não tem o reconhecimento de voz do navegador ali, e a voz vira a de robô). Para conversar, abra o Mini SK **no Chrome ou no Edge** (como site, ou instalado como app pelo menu ⋮ → "Instalar app").

## ⚡ Node de verdade (09/10/2026)
Botão **⚡ Node** na barra de cima. É o mesmo motor do SK V3 (WebContainer): roda `npm install`, `node`, `npm run dev` com os arquivos da árvore, num terminal de verdade.

**Para funcionar, as 3 luzes do painel precisam ficar verdes:**
1. **Aberto como site** (https ou localhost) — Netlify, GitHub Pages ou instalado como PWA a partir de um deles. Pelo index (arquivo) **não** liga.
2. **Lacre ligado** — toque em **🔒 Ligar o lacre** uma vez; a página recarrega sozinha. O lacre fica no `sw.js` (o Mini SK mesmo coloca os cabeçalhos COOP/COEP, não precisa configurar o Netlify).
3. **Chrome ou Edge**.

Depois: **▶ Ligar o Node** → terminal aparece. Quando um servidor sobe (`npm run dev`), aparece o link e a prévia embaixo.
- O que você edita no Mini SK vai sozinho para o Node.
- **⬇ Trazer**: copia para a árvore o que o Node criou/mudou (até 5 MB por arquivo; pula node_modules).
- **🐙 Enviar ao GitHub**: abre o painel do GitHub para mandar o backup ao repositório.
- Use como **PWA** (instalar pelo menu do Chrome). No APK o Node não liga — o WebView do Android não deixa.

**Conferido aqui:** o lacre ativa (crossOriginIsolated = verdadeiro depois de recarregar) e o painel abre com as 3 luzes verdes. **Não deu para ligar o Node aqui** (este computador não alcança a StackBlitz) — o primeiro teste real é no seu celular.

## 🏗️ Preparar — o construtor automático (09/10/2026)
É o que o "ConstruAPK Pro" tentava fazer, mas **dentro do projeto** e sem limite de arquivos.
- **Ao importar** um .zip/pasta, ele analisa sozinho e abre o painel 🏗️ com o que está errado.
- Cada problema tem **📂** (abre o arquivo no editor) e **🤖 Perguntar à IA**.
- **✅ Fazer tudo**: tira a Replit (package.json, vite.config, .replit, banner), conserta os caminhos "/", cria manifest + service worker + ícones. Em projeto **Vite/npm**: cria `capacitor.config.json`, coloca o Capacitor no package.json, `base: "./"` no vite.config e a receita `.github/workflows/apk-capacitor.yml` (o APK sai em Actions → Artifacts).
- **⚡ Terminal deste projeto**: os comandos certos lidos do package.json; o ▶ manda direto para o ⚡ Node.
- **🐞 Erros da prévia**: ficam guardados; um toque manda tudo para a IA.
- Acha **chave/senha no código** (não mostra o valor) — tire antes de publicar.
- Opção "Ao importar, já fazer tudo sozinho". Sempre cria um ponto de volta (📸) antes.
- Site HTML simples → o APK continua pelo 📦 APK (mais certo que o Capacitor para HTML puro).

Os 4 defeitos do ConstruAPK que foram corrigidos aqui: (1) linha `if: secrets...` que faz o GitHub recusar a receita; (2) Capacitor instalado "global" em vez de no projeto; (3) exigia `npm ci`/build mesmo sem lock/build; (4) guardava a pasta inteira em vez do .apk.

**Conferido aqui:** um projeto falso da Replit (Vite) e um HTML simples — análise, Fazer tudo, arquivos criados, receita válida. **A receita do Capacitor ainda não rodou no GitHub de verdade.**

## 📲 Conserto da instalação (09/10/2026)
Os manifest que o Mini SK gerava tinham o mesmo "id" (./) para todos os apps. No GitHub Pages (vários apps no mesmo endereço) o Chrome achava que era o mesmo app e não instalava o segundo. Agora cada app ganha um id próprio (ex.: ./app-caca-bug). Se um app já gerado não instala, refaça o 📲 Instalável dele.

## 📦 APK: prévia e páginas em branco (09/10/2026)
Defeito achado: dentro do APK, o service worker do app (sw.js) não sabia buscar os arquivos que vão DENTRO do APK. Da 2ª vez que abria, ele tentava buscar na internet um endereço que não existe → prévia/página em branco. Agora o APK entrega esses arquivos também para o service worker.
O 🔒 lacre do APK passou de "require-corp" para "credentialless" (igual ao sw.js): não bloqueia mais scripts/imagens de outros sites na prévia.
O Node (WebContainer) continua não ligando no APK — isso é limite do Android, não defeito. Para o Node, use o PWA.
**Precisa gerar o APK de novo** pelo 📦 APK para pegar o conserto. Ainda não testado num celular.

## 🏗️ Preparar ganhou (09/10/2026, tarde)
- **📋 Plano completo** (PLANO.md, sem IA): telas, rotas do backend, o que o app pede ao servidor e **o que falta no backend** (o que ficou na Replit e precisa ser recriado), tabelas do banco, variáveis de ambiente (só os nomes), IA usada, serviços de fora, roteiro para sair da Replit, árvore. Ideia do gerador de plano do DevMobile, bem mais completo. Arquivo: `js/lib/plano-core.js` (o mesmo do Caça-Bug).
- **Autorizações do Android sozinhas**: ele lê o código e descobre se o app usa microfone, câmera, localização, notificações, vibrar — e a receita do Capacitor coloca essas autorizações no Android.
- **🖥️ Desktop (.exe)**: cria `electron/main.cjs`, `electron/preload.cjs`, acerta o package.json e a receita `.github/workflows/desktop-exe.yml` (o .exe sai em Actions → Artifacts). Funciona com HTML simples e com Vite.
- **⬇ Baixar o projeto configurado (.zip)**.
Conferido aqui com um projeto falso da Replit: arquivos criados, receitas válidas, passo das autorizações simulado. **O .exe e o APK do Capacitor ainda não foram montados no GitHub de verdade.**

## ⚛️ Prévia de um pedaço TSX/JSX (09/10/2026)
Abra um arquivo **.tsx** ou **.jsx** e a prévia mostra **só aquele componente** funcionando, como nos sites de playground:
- traduz o TypeScript/JSX sozinho (o tradutor é baixado da internet na primeira vez);
- segue os imports do projeto (`./`, `../`, `@/`), inclusive arquivos .css e .json;
- peças de fora (lucide-react, framer-motion…) vêm da internet (esm.sh); `react-native` vira react-native-web (telas do Expo aparecem em parte);
- Tailwind já vem ligado;
- se o pedaço depende de um "Provider" (contexto) de fora, aparece o erro explicado.
Não roda o projeto inteiro — é para ver um pedaço. Arquivo: `js/61-tsx.js`.
Conferido aqui com cópias locais do React e de um tradutor (este computador não alcança a internet): tipos, `@/`, CSS, pacote de fora, botão com contador e o erro de Provider. **No celular, o primeiro teste baixa o tradutor (precisa de internet).**

## 📱 Termux (09/10/2026)
Botão **📱 Termux**: liga o Mini SK ao Termux do celular (Linux de verdade). Funciona no **PWA e no APK** — é o terminal que sobra quando o ⚡ Node não liga (no APK).
1. No Termux, uma vez: `pkg install -y ttyd`
2. No Termux, toda vez: `ttyd -W -i 127.0.0.1 -p 7681 bash` (deixe aberto)
3. No Mini SK: 📱 Termux → Conectar (endereço `ws://127.0.0.1:7681/ws`).
Por que o da Replit "conectava mas não funcionava": falava texto puro (o ttyd tem idioma próprio), o endereço não tinha `/ws`, o ttyd novo precisa do `-W` para aceitar digitação, e o APK bloqueava `ws://`. Os quatro estão resolvidos aqui. O 📦 APK agora libera conversa só com o próprio celular (127.0.0.1/localhost) — **gere o APK de novo**.
Sem internet para baixar o terminal bonito (xterm), entra um modo simples (linha de comando + ⏎).
Conferido aqui com um "ttyd de mentira" que fala o mesmo idioma e roda um bash de verdade: conectou, rodou comando, Ctrl+C, desligar e o aviso de "não respondeu". **Ainda não testado com o Termux de verdade.**

## ☁️ EAS: consertar tudo de uma vez (09/10/2026)
O botão do painel ☁️ EAS agora usa a mesma peça do Caça-Bug (`js/lib/expo-core.js`): tira a Replit e os secretos, acerta app.json/eas.json/package.json, coloca as autorizações do Android e a receita — e mostra a lista do que fez e do que ainda depende da Replit.

## Novidades 14/10 (tarde)
- **⚡ Comandos prontos** no ⚡ Node e no 📱 Termux: npm install, reinstalar, ls, versões, git status e um botão "▶ npm run …" para cada comando do package.json do projeto. Também dá para escrever um comando e tocar ⏎.
- **⇅ Ponte do Termux** (painel 📱 Termux): 🧩 Ligar a ponte (com o Termux conectado) → ⬆ Mandar o projeto para o Termux (fica em ~/minisk/NOME) → rode os comandos → ⬇ Trazer do Termux para a árvore (o que o terminal criou, como a pasta dist, aparece na árvore ☰).
- **Markdown com botões** (ex.: PLANO.md): na prévia, cada bloco de código tem 📋 Copiar e ▶ Terminal; tabelas aparecem como tabela; ⬇ Baixar como página HTML.

## Novidades 16/10
- **🏗️ Preparar → 🧬 Receita para recriar**: lê o projeto e cria a RECEITA.md — estrutura modular proposta, a ordem de montagem e um pedido pronto por arquivo (na prévia, cada pedido tem 📋 Copiar). Serve para recriar o app com qualquer IA, um arquivo por vez.
- **🏗️ Preparar → 🧱 Criar esqueleto modular**: cria um projeto NOVO, modular (index + 00-core + um módulo por parte + 99-app), que já abre; cada arquivo traz a explicação e o pedido dentro.
