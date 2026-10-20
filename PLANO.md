# Plano do projeto: Mini-SK-2-PC-20-10 (1)

_Gerado pelo Mini SK em 20/10/2026, 16:24:56_

## Resumo

- Arquivos: **115** (2.5 MB)
- Tipo: projeto Node com 1 package.json
- Arquivos por tipo: JavaScript 55, PNG 31, JSON 5, SVG 4, Markdown 4, GRADLE 3, YAML 2, XML 2, ICO 2, HTML 2, Git 1, Java 1, PROPERTIES 1, CSS 1, Texto 1
- Dependências diferentes: **3** (1 obrigatórias, 2 só para montar)
- Restos da Replit: **3 arquivo(s)**

## 📦 mini-sk-2-pc — `package.json`

- Arquivo principal: `electron/main.cjs`

**Comandos (scripts):**

| Comando | O que faz | Executa |
|---|---|---|
| `programa` | — | `electron .` |
| `exe` | — | `electron-builder --win nsis portable --x64 --publish never` |

**Dependências (o app precisa) — 1:**

| Pacote | Versão | Pra que serve | Tipo |
|---|---|---|---|
| `ws` | ^8.18.0 | Conexão em tempo real (WebSocket) | 🗄 Servidor |

**Dependências de montagem (dev) — 2:**

| Pacote | Versão | Pra que serve | Tipo |
|---|---|---|---|
| `electron` | 33.2.1 | Executável de computador (janela própria) | 💻 EXE |
| `electron-builder` | 25.1.8 | Gera o .exe do Electron | 💻 EXE |

## ⛔ Restos da Replit (tirar ou trocar)

- app/js/96c-preparar.js — 2 menção(ões)
- app/js/97-analise.js — 6 menção(ões)
- app/js/lib/plano-core.js — 2 menção(ões)

## Arquivos importantes (7) — mandar estes para a IA

- `.github/workflows/apk.yml`
- `.github/workflows/programa-exe.yml`
- `app/manifest.json`
- `electron/main.cjs`
- `electron/preload.cjs`
- `manifest.json`
- `package.json`

## Estrutura completa (115 arquivos)

```
├── .github/
│   └── workflows/
│       ├── apk.yml
│       └── programa-exe.yml
├── .sk/
│   └── hub.json
├── android/
│   ├── app/
│   │   ├── src/
│   │   │   └── main/
│   │   │       ├── assets/
│   │   │       │   └── __ponte.js
│   │   │       ├── java/
│   │   │       │   └── app/
│   │   │       │       └── minisk/
│   │   │       │           └── shell/
│   │   │       │               └── MainActivity.java
│   │   │       ├── res/
│   │   │       │   ├── mipmap-xxxhdpi/
│   │   │       │   │   └── ic_launcher.png
│   │   │       │   └── xml/
│   │   │       │       └── rede.xml
│   │   │       └── AndroidManifest.xml
│   │   └── build.gradle
│   ├── build.gradle
│   ├── gradle.properties
│   └── settings.gradle
├── app/
│   ├── css/
│   │   └── app.css
│   ├── icons/
│   │   ├── apple-touch-icon.png
│   │   ├── icon-128.png
│   │   ├── icon-144.png
│   │   ├── icon-152.png
│   │   ├── icon-16.png
│   │   ├── icon-180.png
│   │   ├── icon-192.png
│   │   ├── icon-32.png
│   │   ├── icon-384.png
│   │   ├── icon-48.png
│   │   ├── icon-512.png
│   │   ├── icon-72.png
│   │   ├── icon-96.png
│   │   ├── icon.svg
│   │   ├── maskable-192.png
│   │   ├── maskable-512.png
│   │   └── maskable.svg
│   ├── js/
│   │   ├── lib/
│   │   │   ├── picotador/
│   │   │   │   ├── 00-base.js
│   │   │   │   ├── 10-ler.js
│   │   │   │   ├── 20-projetos.js
│   │   │   │   └── 30-mensagens.js
│   │   │   ├── expo-core.js
│   │   │   ├── jszip.min.js
│   │   │   ├── nacl-fast.min.js
│   │   │   ├── plano-core.js
│   │   │   ├── ponte-termux.cjs.txt
│   │   │   ├── receita-core.js
│   │   │   └── selar.js
│   │   ├── 00-core.js
│   │   ├── 04-conta.js
│   │   ├── 10-fs.js
│   │   ├── 20-zip.js
│   │   ├── 30-highlight.js
│   │   ├── 40-editor.js
│   │   ├── 50-tree.js
│   │   ├── 60-preview.js
│   │   ├── 61-tsx.js
│   │   ├── 70-search.js
│   │   ├── 80-ai.js
│   │   ├── 81-gasto.js
│   │   ├── 83-voz.js
│   │   ├── 84-ponte.js
│   │   ├── 85-checkpoints.js
│   │   ├── 86-terminal.js
│   │   ├── 86b-node.js
│   │   ├── 86c-termux.js
│   │   ├── 86e-atalhos.js
│   │   ├── 86f-pasta-viva.js
│   │   ├── 86g-largura.js
│   │   ├── 87-links.js
│   │   ├── 88-inventario.js
│   │   ├── 89-config.js
│   │   ├── 90-github.js
│   │   ├── 91-acoes.js
│   │   ├── 92-playground.js
│   │   ├── 92c-importar.js
│   │   ├── 93-conversa.js
│   │   ├── 94-fatiador.js
│   │   ├── 95-pwa.js
│   │   ├── 96-apk.js
│   │   ├── 96b-eas.js
│   │   ├── 96c-preparar.js
│   │   ├── 97-analise.js
│   │   ├── 98-api.js
│   │   └── 99-app.js
│   ├── favicon.ico
│   ├── index.html
│   ├── LEIA-ME.md
│   ├── manifest.json
│   ├── service-worker.js
│   └── sw.js
├── electron/
│   ├── main.cjs
│   ├── ponte.cjs
│   ├── preload.cjs
│   └── terminal.cjs
├── icons/
│   ├── apple-touch-icon.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-152.png
│   ├── icon-16.png
│   ├── icon-180.png
│   ├── icon-192.png
│   ├── icon-32.png
│   ├── icon-384.png
│   ├── icon-48.png
│   ├── icon-512.png
│   ├── icon-72.png
│   ├── icon-96.png
│   ├── icon.svg
│   ├── maskable-192.png
│   ├── maskable-512.png
│   └── maskable.svg
├── .gitignore
├── apk.config.json
├── favicon.ico
├── index.html
├── LEIA-ME.md
├── manifest.json
├── package.json
├── PLANO.md
├── RECEITA.md
└── service-worker.js
```
