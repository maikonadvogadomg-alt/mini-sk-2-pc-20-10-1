/* =========================================================================
   Mini SK — 96c-preparar.js
   🏗️ Preparar — o "construtor automático":
   - Quando você IMPORTA um projeto, ele analisa sozinho e abre este painel.
   - Mostra tudo que está errado em português, cada item com
     📂 Abrir (abre o arquivo no editor) e 🤖 (pergunta à IA sobre aquilo).
   - ✅ Fazer tudo: tira a Replit, conserta os caminhos "/assets",
     cria manifest + service worker + ícones (instalável), e — se o projeto
     usa npm/vite — cria os arquivos do Capacitor e a receita do GitHub
     (já corrigida: a do ConstruAPK Pro tinha 4 defeitos).
   - Erros da prévia ficam guardados e vão para a IA com um toque.
   - ⚡ Terminal do projeto: comandos certos para ESTE projeto (lidos do
     package.json), mandados direto para o Node de verdade.
   Sem limite de arquivos. Antes de mexer, sempre cria um ponto de volta (📸).
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  let box = null, ultimo = null, trabalhando = false;
  const errosPrevia = [];

  // ── Erros da prévia (o console da prévia manda para cá também) ─────────────
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.sk !== 'console' || d.level !== 'error') return;
    errosPrevia.push({ quando: new Date().toLocaleTimeString('pt-BR'), texto: String(d.text || '').slice(0, 600) });
    if (errosPrevia.length > 40) errosPrevia.shift();
    if (box && !box.closest('[hidden]')) pintarErros();
  });

  // ── Leitura do projeto ──────────────────────────────────────────────────────
  const RE_REPLIT = /replit\.dev|repl\.co\b|repl\.it\b|replit\.com\/public|@replit\/|__replit|replitDomain|REPL_ID|REPLIT_|replit-dev-banner|cartographer|runtime-error-modal/i;
  const RE_SEGREDO = [
    [/AIza[0-9A-Za-z_\-]{30,}/, 'chave do Google/Gemini'],
    [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_\-]{20,}/, 'chave de IA (OpenAI/Anthropic)'],
    [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'token do GitHub'],
    [/\bgsk_[A-Za-z0-9]{30,}/, 'chave do Groq'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chave privada'],
    [/service_role/, 'chave service_role do Supabase'],
    [/postgres(?:ql)?:\/\/[^\s'"]+:[^\s'"@]+@/, 'senha de banco de dados (Neon/Postgres)'],
  ];
  const ARQ_SECRETO = /(^|\/)(\.env(\.[\w.-]+)?|[^/]+\.(pem|key|pfx|p12|keystore|jks)|credentials\.json)$/i;
  const PULAR = /(^|\/)(node_modules|\.git|\.sk|android\/app\/build|\.cache|\.local)\//;

  const lerJSON = (p) => { try { return JSON.parse(fs().read(p) || ''); } catch { return null; } };
  const raizPkg = () => (fs().exists('package.json') ? 'package.json' : null);

  // ── Permissões: lê o código e descobre o que o app usa do celular ─────────
  function permissoes(lista) {
    const usa = new Set(), and = new Set(['INTERNET', 'ACCESS_NETWORK_STATE']);
    for (const f of lista) {
      if (!/\.(m?[jt]sx?|html?|vue|svelte)$/i.test(f)) continue;
      const t = fs().read(f); if (!t || t.length > 3e6) continue;
      if (/SpeechRecognition|getUserMedia\s*\(\s*\{[^}]*audio|MediaRecorder|expo-av|expo-audio|Audio\.Recording/.test(t)) { usa.add('🎤 microfone'); and.add('RECORD_AUDIO'); and.add('MODIFY_AUDIO_SETTINGS'); }
      if (/getUserMedia\s*\(\s*\{[^}]*video|capture=["']?(environment|user|camera)|expo-camera|BarcodeDetector/.test(t)) { usa.add('📷 câmera'); and.add('CAMERA'); }
      if (/geolocation\.(getCurrentPosition|watchPosition)|expo-location/.test(t)) { usa.add('📍 localização'); and.add('ACCESS_COARSE_LOCATION'); and.add('ACCESS_FINE_LOCATION'); }
      if (/new\s+Notification\s*\(|Notification\.requestPermission|showNotification|expo-notifications/.test(t)) { usa.add('🔔 notificações'); and.add('POST_NOTIFICATIONS'); }
      if (/navigator\.vibrate|expo-haptics/.test(t)) { usa.add('📳 vibrar'); and.add('VIBRATE'); }
    }
    return { usa: [...usa], android: [...and] };
  }

  function analisar() {
    const lista = fs().list().filter((f) => !PULAR.test(f));
    const itens = [];
    const add = (nivel, titulo, explica, extra) => itens.push(Object.assign({ nivel, titulo, explica }, extra || {}));
    const pkgPath = raizPkg();
    const pkg = pkgPath ? lerJSON(pkgPath) : null;
    const scripts = (pkg && pkg.scripts) || {};
    const deps = Object.assign({}, pkg && pkg.dependencies, pkg && pkg.devDependencies);
    const temIndex = fs().exists('index.html');
    const appJson = lerJSON('app.json');

    // 1. Que tipo de projeto é
    let tipo = 'Site HTML simples';
    if (appJson && appJson.expo) tipo = 'App Expo / React Native (vira APK pelo ☁️ EAS)';
    else if (lista.some((f) => /^artifacts\/[^/]+\/package\.json$/.test(f))) tipo = 'Projeto da Replit com vários apps (pasta artifacts/)';
    else if (deps.vite) tipo = 'Projeto Vite (precisa "montar" com npm run build)';
    else if (deps.next) tipo = 'Projeto Next.js (precisa servidor — difícil virar APK)';
    else if (pkg && (deps.express || deps.fastify || deps.hono)) tipo = 'Servidor Node (backend) — precisa ficar ligado num servidor';
    else if (pkg) tipo = 'Projeto Node/npm';
    const ehNpm = !!pkg && !(appJson && appJson.expo);
    const temBuild = !!scripts.build;

    // 2. Página inicial
    if (temIndex) add('ok', 'Tem index.html na raiz', 'É a primeira página do app.', { arquivo: 'index.html' });
    else {
      const outro = lista.find((f) => /(^|\/)index\.html?$/i.test(f));
      add('erro', 'Não tem index.html na raiz', outro ? 'Achei um em "' + outro + '". Para virar app, ele precisa estar na raiz (ou use a pasta dele como projeto).' : 'Sem index.html, não abre como site nem vira app.', { arquivo: outro });
    }

    // 3. Replit
    const comReplit = lista.filter((f) => { if (/(^|\/)(\.replit|replit\.nix|\.replitignore)$/.test(f)) return true; const r = fs().get(f); if (!r || r.text == null || r.text.length > 3e6) return false; return RE_REPLIT.test(r.text); });
    if (comReplit.length) add('erro', comReplit.length + ' arquivo(s) com coisa da Replit', 'Esses pedaços só funcionam dentro da Replit e quebram fora dela. O ✅ Fazer tudo tira.', { arquivos: comReplit });
    else add('ok', 'Nada da Replit', 'Pode rodar fora dela.');

    // 4. @workspace/ (pacotes de outra pasta do monorepo)
    const ws = lista.filter((f) => /\.(m?[jt]sx?|json)$/.test(f) && /["']@workspace\//.test(fs().read(f) || ''));
    if (ws.length) add('aviso', ws.length + ' arquivo(s) usam "@workspace/"', 'Dependem de outra pasta do projeto da Replit. Se rodar a pasta sozinha, quebra. Use o 🧬 Raio-X para juntar.', { arquivos: ws });

    // 5. Caminhos "/assets" (tela branca fora do Netlify)
    if (temIndex && !(ehNpm && temBuild) && /(\s(?:src|href)=["'])\/(?!\/)/i.test(fs().read('index.html') || '')) add('aviso', 'Caminhos começando com "/" no index', 'É o motivo de "funciona no Netlify mas fica branco pelo index / GitHub". O ✅ Fazer tudo troca por "./".', { arquivo: 'index.html' });

    // 6. Instalável
    const temManifest = lista.some((f) => /(^|\/)(manifest\.json|[^/]+\.webmanifest)$/.test(f));
    const temSW = lista.some((f) => /(^|\/)(sw|service-worker)\.js$/.test(f));
    const temIcone = lista.some((f) => /icon[^/]*192[^/]*\.png$/i.test(f));
    if (temManifest && temSW && temIcone) add('ok', 'Já é instalável (manifest, service worker, ícone)', '');
    else add('aviso', 'Falta para instalar como app: ' + [!temManifest && 'manifest', !temSW && 'service worker', !temIcone && 'ícone'].filter(Boolean).join(', '), 'O ✅ Fazer tudo cria o que faltar.');

    // 7. Segredos (NUNCA mostra o valor)
    const secretos = lista.filter((f) => ARQ_SECRETO.test(f));
    if (secretos.length) add('erro', 'Arquivo(s) de senha/chave no projeto', 'Tire antes de mandar ao GitHub ou para alguém: ' + secretos.join(', '), { arquivos: secretos, semIA: true });
    const achados = [];
    for (const f of lista) {
      const r = fs().get(f); if (!r || r.text == null || r.text.length > 3e6) continue;
      for (const [re, nome] of RE_SEGREDO) if (re.test(r.text)) { achados.push({ f, nome }); break; }
    }
    if (achados.length) add('erro', achados.length + ' arquivo(s) com chave/senha escrita no código', 'Não mostro a chave aqui. Tire do código (deixe o app pedir a chave na tela) antes de publicar: ' + achados.map((a) => a.f + ' (' + a.nome + ')').join(', '), { arquivos: achados.map((a) => a.f), semIA: true });

    // 8. npm
    if (ehNpm) {
      if (!temBuild && !temIndex) add('aviso', 'package.json sem "build"', 'Não sei como montar este projeto. Veja os comandos no ⚡ Terminal do projeto.', { arquivo: pkgPath });
      if (temBuild) add('ok', 'Tem comando de montar: npm run build', String(scripts.build).slice(0, 120), { arquivo: pkgPath });
      if (!fs().exists('package-lock.json') && !fs().exists('pnpm-lock.yaml')) add('info', 'Sem package-lock.json', 'Normal vindo da Replit. Use "npm install" (não "npm ci").', { semIA: true });
    }
    const temCap = fs().exists('capacitor.config.json') || fs().exists('capacitor.config.ts');
    if (temCap) add('ok', 'Já tem configuração do Capacitor', '', { arquivo: fs().exists('capacitor.config.json') ? 'capacitor.config.json' : 'capacitor.config.ts' });

    // 8b. O que o app usa do aparelho → permissões do Android
    const perms = permissoes(lista);
    if (perms.usa.length) add('info', 'O app usa: ' + perms.usa.join(', '), 'No APK, eu já peço essas autorizações ao Android (' + perms.android.join(', ') + ').', { semIA: true });

    // 9. Erros da prévia
    if (errosPrevia.length) add('erro', errosPrevia.length + ' erro(s) na prévia', 'Toque em 🤖 Mandar os erros para a IA, lá embaixo.');

    // Caminho para APK
    let apk;
    if (appJson && appJson.expo) apk = { via: 'eas', txt: 'Use o ☁️ EAS (projeto Expo).' };
    else if (ehNpm && temBuild) apk = { via: 'cap', txt: 'Capacitor: o GitHub monta o site (npm run build) e faz o APK.' };
    else if (temIndex) apk = { via: 'apk', txt: 'Use o 📦 APK do Mini SK (feito para HTML puro — mais simples e mais certo que o Capacitor).' };
    else apk = { via: null, txt: 'Primeiro precisa de um index.html.' };

    return { tipo, itens, pkg, scripts, ehNpm, temBuild, comReplit, temIndex, temCap, apk, perms, total: lista.length };
  }

  // ── Capacitor (corrigido) ───────────────────────────────────────────────────
  function pastaDoBuild() {
    const vc = fs().list().find((f) => /^vite\.config\.(m?[jt]s)$/.test(f));
    const t = vc ? fs().read(vc) || '' : '';
    const m = t.match(/outDir\s*:\s*(?:path\.resolve\([^,]+,\s*)?["'`]([^"'`]+)["'`]/);
    if (m) return m[1].replace(/^\.\//, '').replace(/\/$/, '');
    return 'dist';
  }
  const nomeApp = () => ((ultimo && ultimo.pkg && ultimo.pkg.name) || fs().project.name || 'Meu app').replace(/^@[^/]+\//, '');
  const idApp = (n) => 'com.app.' + (n.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '') || 'meuapp').replace(/^(\d)/, 'a$1');

  const receitaCap = (perms) => `name: APK (Capacitor)
# Feita pelo 🏗️ Preparar do Mini SK. Roda sozinha quando você manda para o GitHub,
# ou em Actions → "APK (Capacitor)" → Run workflow. O APK sai em "Artifacts".
on:
  push:
    branches: [main, master]
  workflow_dispatch:

jobs:
  apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 21
      - name: Instalar as dependências
        run: npm install --no-audit --no-fund --legacy-peer-deps
      - name: Montar o site
        run: npm run build --if-present
      - name: Criar a parte Android
        run: |
          [ -d android ] || npx cap add android
          npx cap sync android
      - name: Autorizações do Android (internet, microfone…)
        run: |
          M=android/app/src/main/AndroidManifest.xml
          for P in ${perms.join(' ')}; do
            grep -qw "android.permission.$P" $M || sed -i "s#</manifest>#    <uses-permission android:name='android.permission.$P' />\\n</manifest>#" $M
          done
          grep uses-permission $M
      - name: Fazer o APK
        run: |
          cd android
          chmod +x gradlew
          ./gradlew assembleDebug --no-daemon
      - uses: actions/upload-artifact@v4
        with:
          name: app-debug-apk
          path: android/app/build/outputs/apk/debug/*.apk
`;

  function criarCapacitor(rep) {
    const pkgP = raizPkg(); const pkg = lerJSON(pkgP);
    if (!pkg) { rep.push('⚠️ package.json com erro — não criei o Capacitor'); return; }
    const nome = nomeApp(), webDir = pastaDoBuild();
    if (!fs().exists('capacitor.config.json') && !fs().exists('capacitor.config.ts')) {
      fs().write('capacitor.config.json', JSON.stringify({ appId: idApp(nome), appName: nome, webDir, server: { androidScheme: 'https' } }, null, 2) + '\n', { silent: true });
      rep.push('✅ capacitor.config.json (pasta do site montado: ' + webDir + ')');
    } else rep.push('👍 Configuração do Capacitor já existia — mantive');
    pkg.dependencies = pkg.dependencies || {}; pkg.devDependencies = pkg.devDependencies || {};
    let mud = 0;
    if (!pkg.dependencies['@capacitor/core']) { pkg.dependencies['@capacitor/core'] = '^7.0.0'; mud++; }
    if (!pkg.dependencies['@capacitor/android']) { pkg.dependencies['@capacitor/android'] = '^7.0.0'; mud++; }
    if (!pkg.devDependencies['@capacitor/cli'] && !pkg.dependencies['@capacitor/cli']) { pkg.devDependencies['@capacitor/cli'] = '^7.0.0'; mud++; }
    if (mud) { fs().write(pkgP, JSON.stringify(pkg, null, 2) + '\n', { silent: true }); rep.push('✅ package.json: entrou o Capacitor (no projeto, não "global" — esse era um dos defeitos)'); }
    // o site montado precisa de caminhos "./" para abrir dentro do APK
    const vc = fs().list().find((f) => /^vite\.config\.(m?[jt]s)$/.test(f));
    if (vc) {
      const t = fs().read(vc) || '';
      if (!/\bbase\s*:/.test(t) && /defineConfig\(\s*\{/.test(t)) { fs().write(vc, t.replace(/defineConfig\(\s*\{/, 'defineConfig({\n  base: "./",'), { silent: true }); rep.push('✅ ' + vc + ': base "./" (sem isso o APK abre em branco)'); }
      else if (/base\s*:\s*["'`]\/["'`]/.test(t)) { fs().write(vc, t.replace(/base\s*:\s*["'`]\/["'`]/, 'base: "./"'), { silent: true }); rep.push('✅ ' + vc + ': base "/" → "./" (sem isso o APK abre em branco)'); }
    }
    const perms = permissoes(fs().list().filter((f) => !PULAR.test(f))).android;
    fs().write('.github/workflows/apk-capacitor.yml', receitaCap(perms), { silent: true });
    rep.push('✅ Autorizações do Android que o app vai pedir: ' + perms.map((x) => x.toLowerCase().replace(/_/g, ' ')).join(', '));
    rep.push('✅ Receita do GitHub: .github/workflows/apk-capacitor.yml (o APK sai em Actions → Artifacts)');
    const gi = fs().read('.gitignore') || '';
    if (!/node_modules/.test(gi)) { fs().write('.gitignore', gi + (gi && !gi.endsWith('\n') ? '\n' : '') + 'node_modules/\n' + webDir + '/\n', { silent: true }); rep.push('✅ .gitignore (não manda node_modules ao GitHub)'); }
  }

  // ── 🖥️ Desktop (.exe do Windows, com Electron) ─────────────────────────────
  const MAIN_CJS = (pasta) => `// Abre o app numa janela de computador (Electron). Gerado pelo 🏗️ Preparar do Mini SK.
// Usa o endereço app://local/ (e não file://) para os módulos, o banco do navegador
// e o service worker funcionarem igual no site.
const { app, BrowserWindow, protocol, net, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const PASTA = path.join(__dirname, '..', ${JSON.stringify(pasta)});

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

function criarJanela() {
  const w = new BrowserWindow({
    width: 1200, height: 800, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  // links de fora abrem no navegador do computador
  w.webContents.setWindowOpenHandler(({ url }) => { if (!url.startsWith('app://')) { shell.openExternal(url); return { action: 'deny' }; } return { action: 'allow' }; });
  w.loadURL('app://local/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/index.html';
    let f = path.normalize(path.join(PASTA, p));
    if (!f.startsWith(path.normalize(PASTA))) return new Response('proibido', { status: 403 });
    // app com rotas (/login, /config): volta para o index
    if (!fs.existsSync(f) && !path.extname(f)) f = path.join(PASTA, 'index.html');
    return net.fetch(pathToFileURL(f).toString());
  });
  // microfone, câmera, notificações: libera para o próprio app
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'notifications', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen', 'geolocation'].includes(perm)));
  criarJanela();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) criarJanela(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
`;
  const PRELOAD_CJS = `// Ponte segura entre a janela e o computador. A página vê window.desktop.
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('desktop', { ehDesktop: true, plataforma: process.platform });
`;
  const RECEITA_EXE = `name: Desktop (.exe)
# Feita pelo 🏗️ Preparar do Mini SK. O .exe sai em Actions → "Desktop (.exe)" → Artifacts.
on:
  workflow_dispatch:

jobs:
  exe:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Instalar as dependências
        run: npm install --no-audit --no-fund --legacy-peer-deps
      - name: Montar o site
        run: npm run build --if-present
      - name: Fazer o .exe
        run: npx electron-builder --win portable --publish never
      - uses: actions/upload-artifact@v4
        with:
          name: app-windows
          path: dist-electron/*.exe
`;
  function criarDesktop(rep, a) {
    // Já tem receita de programa feita à mão (ex.: jurídico/CodeLens com o servidor junto): não mexer.
    if (fs().get('electron/main.cjs')) { rep.push('ℹ️ O projeto já tem o programa (electron/main.cjs) — deixei como está. Use o botão do GitHub que já veio nele.'); return; }
    // Projeto com servidor (banco, IA): o .exe "só da tela" abriria sem nada funcionar.
    const pk = raizPkg() ? (lerJSON('package.json') || {}) : {};
    const deps = Object.assign({}, pk.dependencies, pk.devDependencies);
    if ((deps.express || deps.fastify || deps.hono) && fs().list().some((p) => /^(server|api-server|backend)\//.test(p))) {
      rep.push('⚠️ Este projeto tem SERVIDOR (banco, IA). Um .exe só da tela abriria sem funcionar — não criei. Ele precisa da versão com o servidor junto.');
      return;
    }
    const nome = nomeApp();
    const pasta = a.ehNpm && a.temBuild ? pastaDoBuild() : '.';
    let pkg = raizPkg() ? lerJSON('package.json') : null;
    if (raizPkg() && !pkg) { rep.push('⚠️ package.json com erro — não criei o desktop'); return; }
    const novo = !pkg;
    pkg = pkg || { name: idApp(nome).replace(/^com\.app\./, ''), version: '1.0.0', private: true };
    pkg.version = pkg.version || '1.0.0';
    pkg.description = pkg.description || nome;
    pkg.author = pkg.author || nome;
    pkg.main = 'electron/main.cjs';
    pkg.scripts = Object.assign({ desktop: 'electron .', exe: 'electron-builder --win portable --publish never' }, pkg.scripts || {});
    pkg.devDependencies = Object.assign({}, pkg.devDependencies, { electron: (pkg.devDependencies || {}).electron || '^33.2.0', 'electron-builder': (pkg.devDependencies || {})['electron-builder'] || '^25.1.8' });
    const arquivos = pasta === '.' ? ['**/*', '!android/**', '!.github/**', '!dist-electron/**', '!*.zip', '!.sk/**'] : [pasta + '/**/*', 'electron/**/*', 'package.json'];
    pkg.build = Object.assign({ appId: idApp(nome), productName: nome, directories: { output: 'dist-electron' }, files: arquivos, win: { target: 'portable' } }, pkg.build || {});
    fs().write('package.json', JSON.stringify(pkg, null, 2) + '\n', { silent: true });
    rep.push(novo ? '✅ package.json criado (para o desktop)' : '✅ package.json: entrou o Electron (desktop)');
    fs().write('electron/main.cjs', MAIN_CJS(pasta), { silent: true });
    fs().write('electron/preload.cjs', PRELOAD_CJS, { silent: true });
    rep.push('✅ electron/main.cjs (abre o app na janela) e electron/preload.cjs (ponte segura)');
    fs().write('.github/workflows/desktop-exe.yml', RECEITA_EXE, { silent: true });
    rep.push('✅ Receita do GitHub: .github/workflows/desktop-exe.yml (o .exe sai em Actions → Artifacts)');
    const gi = fs().read('.gitignore') || '';
    if (!/dist-electron/.test(gi)) fs().write('.gitignore', gi + (gi && !gi.endsWith('\n') ? '\n' : '') + (/node_modules/.test(gi) ? '' : 'node_modules/\n') + 'dist-electron/\n', { silent: true });
  }

  // ── 🧬 Receita para recriar (sem IA) ──────────────────────────────────────
  function receita() {
    if (!window.ReceitaProjeto) throw new Error('Falta js/lib/receita-core.js');
    if (!fs().project) throw new Error('Abra um projeto primeiro.');
    const arqs = fs().list().map((p) => { const r = fs().get(p); return { path: p, text: r && r.text != null ? r.text : null }; });
    return ReceitaProjeto.gerar(arqs, fs().project.name);
  }
  // ── 📋 Plano (gerador completo, sem IA) ─────────────────────────────────────
  function gerarPlano() {
    if (!window.PlanoProjeto) throw new Error('Falta js/lib/plano-core.js');
    const arqs = fs().list().map((p) => { const r = fs().get(p); return { path: p, text: r && r.text != null ? r.text : null }; });
    const d = PlanoProjeto.gerar(arqs, fs().project.name);
    fs().write('PLANO.md', d.md);
    SK.emit('fs-change', { type: 'import' });
    SK.tree && SK.tree.render && SK.tree.render();
    SK.editor.open('PLANO.md');
    return d;
  }

  // ── Tirar o resto da Replit (além do package.json/vite.config do Raio-X) ────
  function tirarReplitDoCodigo(rep) {
    let n = 0;
    for (const f of fs().list()) {
      if (PULAR.test(f)) continue;
      if (/(^|\/)(\.replit|replit\.nix|\.replitignore)$/.test(f)) { fs().remove(f); rep.push('🗑️ Apaguei ' + f + ' (só serve na Replit)'); continue; }
      if (!/\.html?$/i.test(f)) continue;
      const t = fs().read(f); if (!t) continue;
      const t2 = t.replace(/[ \t]*<script[^>]*(?:replit\.com\/public|replit-dev-banner|__replco)[^>]*>\s*<\/script>[ \t]*\n?/gi, '');
      if (t2 !== t) { fs().write(f, t2, { silent: true }); n++; }
    }
    if (n) rep.push('🧹 Tirei o "banner da Replit" de ' + n + ' página(s)');
  }

  async function fazerTudo() {
    const a = ultimo || analisar();
    const quer = (id) => { const c = SK.$('#pr-' + id, box); return !c || c.checked; };
    const rep = [];
    if (trabalhando) return; trabalhando = true;
    try {
    await SK.checkpoints.auto('Antes do 🏗️ Preparar');
    rep.push('📸 Criei um ponto de volta (se não gostar, desfaz em 📸 Voltar)');
    if (quer('replit')) {
      try { (await SK.analise.cleanReplit()).forEach((r) => rep.push(r)); } catch (e) { rep.push('⚠️ Replit: ' + e.message); }
      tirarReplitDoCodigo(rep);
    }
    if (quer('pwa') && fs().exists('index.html') && !(a.ehNpm && a.temBuild)) {
      try {
        const nome = nomeApp();
        (await SK.pwa.makeInstallable('index.html', { name: nome, short: nome.slice(0, 12), theme: '#0f172a', bg: '#0f172a', display: 'standalone', orientation: 'any', offline: true })).forEach((r) => rep.push(r));
      } catch (e) { rep.push('⚠️ Instalável: ' + e.message); }
    }
    if (quer('cap') && a.ehNpm && a.temBuild) criarCapacitor(rep);
    if (quer('exe') && SK.$('#pr-exe', box) && SK.$('#pr-exe', box).checked) criarDesktop(rep, a);
    if (quer('plano')) { try { const d = gerarPlano(); rep.push('📋 PLANO.md: ' + d.telas.length + ' tela(s), ' + d.rotas.length + ' rota(s), ' + d.faltam.length + ' endereço(s) que faltam no backend'); } catch (e) { rep.push('⚠️ Plano: ' + e.message); } }
    } finally { trabalhando = false; }
    SK.emit('fs-change', { type: 'import' });
    SK.tree && SK.tree.render && SK.tree.render();
    ultimo = analisar();
    pintar();
    const r = SK.$('#pr-rel', box);
    r.hidden = false;
    r.innerHTML = '<b>O que eu fiz:</b><ul>' + rep.map((x) => '<li>' + SK.esc(x) + '</li>').join('') + '</ul>';
    r.scrollIntoView({ behavior: 'smooth', block: 'start' });
    SK.toast('🏗️ Pronto! Veja a lista do que foi feito.');
  }

  // ── IA ──────────────────────────────────────────────────────────────────────
  function paraIA(texto, arquivo) {
    SK.app.openSide('ai');
    if (arquivo && fs().exists(arquivo)) SK.editor.open(arquivo, { noFocus: true });
    const inp = document.getElementById('ai-in');
    if (inp) { inp.value = texto; inp.dispatchEvent(new Event('input')); inp.focus(); }
    SK.toast('Escrevi o pedido na IA — confira e toque em enviar.');
  }
  function resumoParaIA() {
    const a = ultimo || analisar();
    return 'Projeto: "' + fs().project.name + '" — ' + a.tipo + ' (' + a.total + ' arquivos).\n' +
      'Problemas que o 🏗️ Preparar achou:\n' + a.itens.filter((i) => i.nivel !== 'ok' && !i.semIA).map((i) => '- ' + i.titulo + (i.arquivos ? ' [' + i.arquivos.slice(0, 15).join(', ') + ']' : i.arquivo ? ' [' + i.arquivo + ']' : '')).join('\n');
  }

  // ── Comandos do terminal para ESTE projeto ─────────────────────────────────
  function comandos(a) {
    const c = [];
    if (a.ehNpm) {
      c.push(['npm install --legacy-peer-deps', 'Baixa as peças do projeto (primeira vez)']);
      if (a.scripts.dev) c.push(['npm run dev', 'Liga o projeto para ver funcionando']);
      if (a.scripts.build) c.push(['npm run build', 'Monta o site final (pasta ' + pastaDoBuild() + ')']);
      if (a.scripts.start && !a.scripts.dev) c.push(['npm start', 'Liga o servidor']);
      if (a.scripts.test) c.push(['npm test', 'Roda os testes']);
      if (a.scripts.typecheck || (a.pkg.devDependencies || {}).typescript) c.push(['npx tsc --noEmit', 'Procura erros de tipo no código (TypeScript)']);
      if (a.temCap) c.push(['npx cap sync android', 'Copia o site montado para o Android']);
    } else if (a.temIndex) c.push(['npx -y serve -l 3000 .', 'Abre o site num servidor de teste']);
    c.push(['ls', 'Lista os arquivos']);
    return c;
  }

  // ── Tela ────────────────────────────────────────────────────────────────────
  const ICONE = { ok: '✅', aviso: '⚠️', erro: '❌', info: 'ℹ️' };
  function pintarErros() {
    const el = SK.$('#pr-erros', box); if (!el) return;
    el.innerHTML = errosPrevia.length
      ? errosPrevia.slice(-10).map((e) => '<div class="pr-err"><small>' + e.quando + '</small> ' + SK.esc(e.texto) + '</div>').join('')
      : '<small class="muted">Nenhum erro na prévia até agora. Se a prévia der erro, ele aparece aqui.</small>';
    SK.$('#pr-err-ia', box).disabled = !errosPrevia.length;
  }
  function pintar() {
    if (!box) return;
    if (!fs().project) { SK.$('#pr-lista', box).innerHTML = '<p class="muted">Abra ou importe um projeto.</p>'; return; }
    const a = ultimo || (ultimo = analisar());
    SK.$('#pr-tipo', box).innerHTML = '<b>' + SK.esc(fs().project.name) + '</b> — ' + SK.esc(a.tipo) + ' · ' + SK.fmt(a.total) + ' arquivos';
    const ordem = { erro: 0, aviso: 1, info: 2, ok: 3 };
    SK.$('#pr-lista', box).innerHTML = a.itens.slice().sort((x, y) => ordem[x.nivel] - ordem[y.nivel]).map((it, i) => {
      const arqs = it.arquivos || (it.arquivo ? [it.arquivo] : []);
      return '<div class="pr-item pr-' + it.nivel + '">' +
        '<div class="pr-t">' + ICONE[it.nivel] + ' ' + SK.esc(it.titulo) + '</div>' +
        (it.explica ? '<div class="pr-x">' + SK.esc(it.explica) + '</div>' : '') +
        (arqs.length ? '<div class="pr-arqs">' + arqs.slice(0, 30).map((f) => '<button class="pr-arq" data-abrir="' + SK.esc(f) + '">📂 ' + SK.esc(f) + '</button>').join('') + (arqs.length > 30 ? '<small> …e mais ' + (arqs.length - 30) + '</small>' : '') + '</div>' : '') +
        (it.nivel !== 'ok' && !it.semIA ? '<button class="btn small" data-ia="' + a.itens.indexOf(it) + '">🤖 Perguntar à IA</button>' : '') +
        '</div>';
    }).join('');
    SK.$('#pr-cap-l', box).hidden = !(a.ehNpm && a.temBuild);
    SK.$('#pr-pwa-l', box).hidden = a.ehNpm && a.temBuild;
    SK.$('#pr-apk', box).textContent = '📱 Para virar APK: ' + a.apk.txt;
    SK.$('#pr-apk-ir', box).hidden = !a.apk.via || a.apk.via === 'cap';
    SK.$('#pr-apk-ir', box).dataset.ir = a.apk.via === 'eas' ? 'eas' : 'apk';
    SK.$('#pr-cmds', box).innerHTML = comandos(a).map(([c, d]) => '<div class="pr-cmd"><code>' + SK.esc(c) + '</code><small>' + SK.esc(d) + '</small><button class="btn small" data-cmd="' + SK.esc(c) + '">▶</button></div>').join('');
    pintarErros();
  }

  function build(el) {
    box = el;
    el.innerHTML =
      '<div class="pr">' +
      '<p class="muted">Importou um projeto? Eu analiso sozinho, mostro o que está errado e preparo tudo para virar site, app instalável ou APK. Sem limite de arquivos.</p>' +
      '<div id="pr-tipo" class="pr-tipo"></div>' +
      '<div class="pr-acoes">' +
      '  <label><input type="checkbox" id="pr-replit" checked> 🧹 Tirar a Replit</label>' +
      '  <label id="pr-pwa-l"><input type="checkbox" id="pr-pwa" checked> 📲 Caminhos certos + instalável (manifest, service worker, ícones)</label>' +
      '  <label id="pr-cap-l"><input type="checkbox" id="pr-cap" checked> 📦 Capacitor + receita do GitHub para o APK (com as autorizações do Android)</label>' +
      '  <label><input type="checkbox" id="pr-exe"> 🖥️ Desktop: .exe para Windows (Electron: main, preload, receita)</label>' +
      '  <label><input type="checkbox" id="pr-plano" checked> 📋 Plano completo (PLANO.md: telas, rotas, o que falta no backend)</label>' +
      '  <button class="btn primary" id="pr-tudo">✅ Fazer tudo</button>' +
      '  <button class="btn" id="pr-again">🔄 Analisar de novo</button>' +
      '  <button class="btn" id="pr-plano-b">📋 Só gerar o plano</button>' +
      '  <button class="btn" id="pr-receita" title="Passo a passo com um pedido pronto por arquivo, para recriar o app com qualquer IA">🧬 Receita para recriar</button>' +
      '  <button class="btn" id="pr-esqueleto" title="Cria um projeto NOVO, modular, com um arquivo por parte (cada um já com a explicação e o pedido dentro)">🧱 Criar esqueleto modular</button>' +
      '  <button class="btn" id="pr-zip">⬇ Baixar o projeto configurado (.zip)</button>' +
      '</div>' +
      '<div id="pr-rel" class="pr-rel" hidden></div>' +
      '<h4>O que eu achei</h4><div id="pr-lista"></div>' +
      '<div class="pr-apkbox"><span id="pr-apk"></span> <button class="btn small" id="pr-apk-ir" hidden>Abrir</button></div>' +
      '<h4>⚡ Terminal deste projeto</h4>' +
      '<p class="muted">Comandos certos para ESTE projeto. O ▶ manda para o Node de verdade (precisa do lacre — veja o painel ⚡ Node).</p>' +
      '<div id="pr-cmds"></div>' +
      '<h4>🐞 Erros da prévia</h4><div id="pr-erros"></div>' +
      '<div class="pr-acoes"><button class="btn" id="pr-err-ia">🤖 Mandar os erros para a IA</button> <button class="btn" id="pr-tudo-ia">🤖 Pedir à IA um plano de conserto</button></div>' +
      '<label class="pr-auto"><input type="checkbox" id="pr-auto"> Ao importar, já fazer tudo sozinho (sem perguntar). Sempre cria um ponto de volta antes.</label>' +
      '</div>';
    const $ = (s) => SK.$(s, el);
    $('#pr-auto').checked = !!SK.pref.get('prepAuto', false);
    $('#pr-auto').onchange = (e) => SK.pref.set('prepAuto', e.target.checked);
    $('#pr-receita').onclick = () => { try { const r = receita(); fs().write('RECEITA.md', r.md); SK.emit('fs-change', { type: 'import' }); SK.editor.open('RECEITA.md'); SK.toast('🧬 RECEITA.md pronta: ' + r.modulos.length + ' partes. Na prévia, cada pedido tem 📋 Copiar.'); } catch (e) { SK.toast(e.message, 'error'); } };
    $('#pr-esqueleto').onclick = async () => {
      try {
        const r = receita(); const nome = (r.titulo || fs().project.name) + ' (modular)';
        if (!(await SK.confirm('Criar um projeto SEPARADO "' + nome + '" com ' + r.esqueleto.length + ' peças VAZIAS ("ainda em construção"), para a IA preencher depois?\n\nO seu projeto atual NÃO muda e continua aberto.', { okText: 'Criar o esqueleto à parte' }))) return;
        const atual = fs().project.name;
        await fs().create(nome, {});
        r.esqueleto.forEach((f) => fs().write(f.path, f.text, { silent: true }));
        await fs().saveNow?.();
        await fs().open(atual); // volta para o projeto de verdade: o esqueleto fica guardado à parte
        SK.toast('🧱 Esqueleto guardado à parte como "' + nome + '". Você continua no "' + atual + '". Para ver o esqueleto: toque no nome do projeto lá em cima.');
      } catch (e) { SK.toast(e.message, 'error'); }
    };
    $('#pr-plano-b').onclick = () => { try { const d = gerarPlano(); SK.toast('📋 PLANO.md pronto: ' + d.telas.length + ' telas, ' + d.rotas.length + ' rotas'); } catch (e) { SK.toast(e.message, 'error'); } };
    $('#pr-zip').onclick = async () => { try { const b = await fs().exportZip(); SK.download(SK.nomeSeguro ? SK.nomeSeguro(fs().project.name) + '-configurado.zip' : fs().project.name.replace(/[^\w.-]+/g, '_') + '-configurado.zip', b); } catch (e) { SK.toast('Erro: ' + e.message, 'error'); } };
    $('#pr-again').onclick = () => { ultimo = analisar(); pintar(); SK.toast('Analisado de novo'); };
    $('#pr-tudo').onclick = async () => { $('#pr-tudo').disabled = true; try { await fazerTudo(); } catch (e) { SK.toast('Erro: ' + e.message, 'error'); } $('#pr-tudo').disabled = false; };
    $('#pr-apk-ir').onclick = (e) => SK.app.openSide(e.target.dataset.ir);
    $('#pr-err-ia').onclick = () => paraIA('A prévia do meu projeto deu estes erros:\n' + errosPrevia.slice(-15).map((x) => '- ' + x.texto).join('\n') + '\n\nExplique em português simples o que cada um quer dizer e conserte, mandando os arquivos corrigidos inteiros.');
    $('#pr-tudo-ia').onclick = () => paraIA(resumoParaIA() + '\n\nMe dê um PLANO DE CONSERTO curto em português simples (sou advogado, não programador), um passo de cada vez, e já comece pelo passo 1.');
    el.addEventListener('click', async (e) => {
      const ab = e.target.closest('[data-abrir]');
      if (ab) { const f = ab.dataset.abrir; if (fs().exists(f)) { SK.editor.open(f); SK.tree.expandTo && SK.tree.expandTo(f); } else SK.toast('Esse arquivo não existe mais', 'error'); return; }
      const ia = e.target.closest('[data-ia]');
      if (ia) { const it = ultimo.itens[+ia.dataset.ia]; const arqs = it.arquivos || (it.arquivo ? [it.arquivo] : []); paraIA('No meu projeto, o 🏗️ Preparar achou: "' + it.titulo + '". ' + (it.explica || '') + (arqs.length ? '\nArquivos: ' + arqs.slice(0, 20).join(', ') : '') + '\n\nExplique em português simples e conserte, mandando os arquivos corrigidos inteiros.', arqs[0]); return; }
      const cm = e.target.closest('[data-cmd]');
      if (cm) { try { await SK.node.mandar(cm.dataset.cmd); } catch (er) { SK.toast('O Node não ligou: ' + er.message + ' — veja as 3 luzes no painel ⚡ Node', 'error'); } }
    });
    ultimo = fs().project ? analisar() : null;
    pintar();
  }

  // ── Ao importar: analisa sozinho e abre o painel (ou faz tudo, se pediu) ────
  const aoImportar = SK.debounce(async () => {
    if (!fs().project) return;
    ultimo = analisar();
    const problemas = ultimo.itens.filter((i) => i.nivel === 'erro' || i.nivel === 'aviso').length;
    if (SK.pref.get('prepAuto', false)) {
      SK.app.openSide('prep');
      try { await fazerTudo(); } catch (e) { SK.toast('Erro ao preparar: ' + e.message, 'error'); }
    } else if (problemas) {
      SK.app.openSide('prep');
      SK.toast('🏗️ Analisei o projeto: ' + problemas + ' coisa(s) para arrumar. Toque em ✅ Fazer tudo.');
    }
    pintar();
  }, 900);
  // só dispara numa importação DE VERDADE (zip, pasta, arquivos) — não quando outro painel grava arquivos
  const importOrig = SK.fs.importFiles;
  SK.fs.importFiles = async function () { const r = await importOrig.apply(this, arguments); if (!trabalhando) aoImportar(); return r; };
  SK.on('project-open', () => { ultimo = null; errosPrevia.length = 0; if (box) { ultimo = analisar(); pintar(); } });

  SK.preparar = { build, analisar, fazerTudo, gerarPlano, receita, permissoes, criarDesktop, get ultimo() { return ultimo; }, erros: errosPrevia };
})(window.SK);
