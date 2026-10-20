/* =========================================================================
   expo-core.js — ☁️ Consertar um projeto EXPO para gerar APK pelo EAS
   Usado pelo Caça-Bug (Diagnóstico) e pelo Mini SK (painel ☁️ EAS).
   Junta o que os geradores antigos faziam separado (app.json, eas.json,
   autorizações, receita do GitHub) + limpeza da Replit, numa passada só.
   ExpoConserto.ler(arquivos)              → dados atuais (para preencher o formulário)
   ExpoConserto.consertar(arquivos, cfg)   → { arquivos, apagados, relato, avisos }
     arquivos = { caminho: texto }  (só os de texto que importam; o resto fica igual)
     cfg = { nome, slug, owner, projectId, pacote, versao }
   O TOKEN do Expo nunca entra aqui: ele vai só no cofre do GitHub (EXPO_TOKEN).
   ========================================================================= */
(function (g) {
  'use strict';
  const SDK = { 50: ['0.73', '18.2'], 51: ['0.74', '18.2'], 52: ['0.76', '18.3'], 53: ['0.79', '19.0'], 54: ['0.81', '19.1'] };
  const RECEITA = `# Receita do Caça-Bug / Mini SK: compila o APK na nuvem do Expo.
# O token do Expo NÃO fica aqui: ele vai trancado em Settings → Secrets → Actions → EXPO_TOKEN.
name: "☁️ APK pelo EAS"

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  eas:
    runs-on: ubuntu-latest
    steps:
      - name: "1. Baixar o projeto"
        uses: actions/checkout@v4

      - name: "2. Conferir o token do Expo"
        run: |
          if [ -z "\${{ secrets.EXPO_TOKEN }}" ]; then echo "::error::Falta o EXPO_TOKEN em Settings → Secrets → Actions."; exit 1; fi

      - name: "3. Node 20"
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: "4. Instalar as dependências"
        run: |
          if [ -f package-lock.json ]; then npm ci || npm install --legacy-peer-deps; else npm install --legacy-peer-deps; fi

      - name: "4b. Acertar as versões para o Expo do projeto (oficial: expo install --fix)"
        run: npx expo install --fix -- --legacy-peer-deps || echo "Não deu para acertar sozinho; seguindo assim mesmo."

      - name: "5. Programa oficial do Expo (eas-cli)"
        run: npm install -g eas-cli@latest

      - name: "6. Mostrar a configuração"
        run: |
          node -e "const e=require('./app.json').expo||{};console.log('App:',e.name,'| slug:',e.slug,'| dono:',e.owner,'| pacote:',(e.android||{}).package,'| projectId:',((e.extra||{}).eas||{}).projectId)"

      - name: "7. Mandar compilar no Expo (perfil preview = APK)"
        run: eas build --platform android --profile preview --non-interactive --no-wait
        env:
          EXPO_TOKEN: \${{ secrets.EXPO_TOKEN }}
          EAS_NO_VCS: "1"

      - name: "8. Onde baixar"
        run: |
          node -e "const e=require('./app.json').expo||{};const u='https://expo.dev/accounts/'+e.owner+'/projects/'+e.slug+'/builds';console.log('APK em uns 10-15 minutos:',u);require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## APK em uns 10-15 minutos\\n'+u+'\\n')"
`;
  const APAGAR = /(^|\/)(\.replit|\.replit-artifact\/.*|replit\.nix|\.replitignore|\.local\/.*|\.cache\/.*|\.upm\/.*|\.config\/.*replit.*|credentials\.json|\.env(?!\.(?:example|sample|template))(\.[\w.-]+)?|[^/]+\.(keystore|jks|pem|p12|pfx|key))$/i;
  const SEGREDO = /(^|\/)(credentials\.json|\.env(?!\.(?:example|sample|template))(\.[\w.-]+)?|[^/]+\.(keystore|jks|pem|p12|pfx|key))$/i;
  const json = (t) => { try { return JSON.parse(t); } catch { return null; } };
  const raizDe = (arqs) => { const a = Object.keys(arqs).find((p) => /(^|\/)app\.json$/.test(p) && !/node_modules\//.test(p) && p.split('/').length <= 3); return a ? a.replace(/app\.json$/, '') : ''; };
  const slugDe = (s) => String(s || 'meu-app').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'meu-app';

  function ler(arqs) {
    const r = raizDe(arqs);
    const app = json(arqs[r + 'app.json'] || '') || {};
    const e = app.expo || {}, a = e.android || {};
    const pkg = json(arqs[r + 'package.json'] || '') || {};
    const d = Object.assign({}, pkg.dependencies, pkg.devDependencies);
    return { raiz: r, ehExpo: !!(app.expo || d.expo), nome: e.name || '', slug: e.slug || '', owner: e.owner || '', projectId: ((e.extra || {}).eas || {}).projectId || '', pacote: a.package || '', versao: e.version || '1.0.0', sdk: d.expo || '' };
  }

  function permissoes(arqs) {
    const P = new Set(), usa = new Set();
    const tudo = Object.entries(arqs).filter(([p]) => /\.(m?[jt]sx?)$/.test(p) && !/node_modules\//.test(p)).map(([, t]) => t || '').join('\n');
    const pkg = Object.entries(arqs).filter(([p]) => /(^|\/)package\.json$/.test(p) && !/node_modules\//.test(p)).map(([, t]) => t).join('\n');
    const tem = (re) => re.test(tudo) || re.test(pkg);
    if (tem(/expo-av|expo-audio|expo-speech-recognition|@react-native-voice|Audio\.Recording|useAudioRecorder|getUserMedia/)) { P.add('RECORD_AUDIO'); P.add('MODIFY_AUDIO_SETTINGS'); usa.add('🎤 microfone'); }
    if (tem(/expo-camera|expo-image-picker|launchCameraAsync|expo-barcode-scanner/)) { P.add('CAMERA'); usa.add('📷 câmera'); }
    if (tem(/expo-location|geolocation/)) { P.add('ACCESS_COARSE_LOCATION'); P.add('ACCESS_FINE_LOCATION'); usa.add('📍 localização'); }
    if (tem(/expo-notifications/)) { P.add('POST_NOTIFICATIONS'); usa.add('🔔 notificações'); }
    if (tem(/expo-haptics|Vibration\.vibrate/)) { P.add('VIBRATE'); usa.add('📳 vibrar'); }
    if (tem(/expo-media-library|expo-file-system|expo-document-picker/)) usa.add('📁 arquivos');
    return { android: [...P], usa: [...usa] };
  }

  function consertar(arqs, cfg) {
    const r = raizDe(arqs);
    const out = {}, apagados = [], relato = [], avisos = [];
    // ── 1. arquivos da Replit e segredos: saem do zip
    for (const p of Object.keys(arqs)) {
      if (!p.startsWith(r) || /node_modules\//.test(p)) continue;
      const rel = p.slice(r.length);
      if (APAGAR.test(rel)) { apagados.push(p); if (SEGREDO.test(rel)) avisos.push('🔐 Tirei do zip um arquivo SECRETO: ' + rel + ' (ele nunca deve ir para o GitHub nem para ninguém).'); }
    }
    if (apagados.length) relato.push('🗑️ Tirei ' + apagados.length + ' arquivo(s) da Replit/secretos: ' + apagados.map((p) => p.slice(r.length)).slice(0, 8).join(', ') + (apagados.length > 8 ? '…' : ''));

    // ── 2. app.json
    const app = json(arqs[r + 'app.json'] || '') || {};
    const e = app.expo = app.expo || {};
    const nome = cfg.nome || e.name || 'Meu App';
    e.name = nome;
    e.slug = slugDe(cfg.slug || e.slug || nome);
    if (cfg.owner) e.owner = cfg.owner.trim(); else if (!e.owner) avisos.push('❗ Falta a conta do Expo (owner). Sem ela o EAS não sabe de quem é o projeto.');
    e.version = cfg.versao || e.version || '1.0.0';
    e.android = e.android || {};
    if (cfg.pacote) e.android.package = cfg.pacote.trim();
    if (!e.android.package) { e.android.package = 'com.' + slugDe(e.owner || 'maikon').replace(/-/g, '') + '.' + e.slug.replace(/-/g, ''); relato.push('📦 Criei o nome do pacote: ' + e.android.package); }
    if (!Number.isInteger(e.android.versionCode)) e.android.versionCode = 1;
    e.extra = e.extra || {};
    if (cfg.projectId) e.extra.eas = Object.assign({}, e.extra.eas, { projectId: cfg.projectId.trim() });
    const pid = (e.extra.eas || {}).projectId;
    if (!/^[0-9a-f-]{36}$/i.test(pid || '')) avisos.push('❗ Falta o projectId da SUA conta (expo.dev → Projects → Create project com o slug "' + e.slug + '" → copie o ID). Sem ele o EAS recusa.');
    // updates apontando para outro projeto
    if (e.updates && e.updates.url && pid && !e.updates.url.includes(pid)) { e.updates.url = 'https://u.expo.dev/' + pid; relato.push('🔁 updates.url agora aponta para o SEU projeto'); }
    // imagens que não existem = build para
    const existe = (p) => Object.prototype.hasOwnProperty.call(arqs, r + String(p).replace(/^\.\//, ''));
    const tirarImg = (obj, k, nomeK) => { if (obj && obj[k] && !existe(obj[k])) { relato.push('🖼️ Tirei "' + nomeK + '" (' + obj[k] + ' não existe no projeto — isso parava a compilação)'); delete obj[k]; } };
    tirarImg(e, 'icon', 'icon'); tirarImg(e.splash, 'image', 'splash.image'); tirarImg(e.android.adaptiveIcon, 'foregroundImage', 'adaptiveIcon');
    tirarImg(e.web, 'favicon', 'web.favicon');
    // plugins da Replit
    if (Array.isArray(e.plugins)) { const n0 = e.plugins.length; e.plugins = e.plugins.filter((pl) => !/replit/i.test(JSON.stringify(pl))); if (e.plugins.length !== n0) relato.push('🧹 Tirei plugin(s) da Replit do app.json'); }
    // autorizações
    const pm = permissoes(arqs);
    const atuais = new Set((e.android.permissions || []).map((x) => String(x).replace(/^android\.permission\./, '')));
    const novas = pm.android.filter((x) => !atuais.has(x));
    if (novas.length) { e.android.permissions = [...atuais, ...novas]; relato.push('🔓 Autorizações do Android: ' + novas.join(', ') + ' (o app usa: ' + pm.usa.join(', ') + ')'); }
    out[r + 'app.json'] = JSON.stringify(app, null, 2) + '\n';
    relato.push('✅ app.json: nome "' + e.name + '", slug "' + e.slug + '", conta "' + (e.owner || '?') + '", pacote ' + e.android.package + ', versão ' + e.version);

    // ── 3. eas.json
    const eas = json(arqs[r + 'eas.json'] || '') || {};
    eas.cli = Object.assign({ version: '>= 14.0.0', appVersionSource: 'local' }, eas.cli);
    eas.build = eas.build || {};
    eas.build.preview = Object.assign({ distribution: 'internal' }, eas.build.preview);
    eas.build.preview.android = Object.assign({}, eas.build.preview.android, { buildType: 'apk' });
    if (!eas.build.production) eas.build.production = { android: { buildType: 'app-bundle' } };
    const limpa = (o) => { if (o && typeof o === 'object') { if (o.credentialsSource === 'local') { delete o.credentialsSource; relato.push('🔑 eas.json: tirei a assinatura LOCAL (credentials.json) — na nuvem a assinatura fica no Expo'); } Object.values(o).forEach(limpa); } };
    limpa(eas.build);
    for (const [perfil, b] of Object.entries(eas.build)) for (const [k, v] of Object.entries((b && b.env) || {})) if (/replit/i.test(String(v))) avisos.push('⚠️ eas.json (' + perfil + '): ' + k + ' = ' + v + ' — o app fala com um servidor da REPLIT. O APK sai, mas essa parte para quando a Replit desligar.');
    out[r + 'eas.json'] = JSON.stringify(eas, null, 2) + '\n';
    relato.push('✅ eas.json: perfil "preview" gera APK');

    // ── 4. package.json
    const pkg = json(arqs[r + 'package.json'] || '');
    if (pkg) {
      let mud = [];
      for (const k of ['dependencies', 'devDependencies', 'peerDependencies']) for (const n of Object.keys(pkg[k] || {})) {
        if (/^@replit\//.test(n)) { delete pkg[k][n]; mud.push('tirei ' + n); }
        else if (/^(catalog:|workspace:)/.test(pkg[k][n])) avisos.push('❗ package.json: "' + n + '": "' + pkg[k][n] + '" só existe dentro da Replit. Troque por um número de versão (o 🧬 Raio-X do Mini SK resolve).');
      }
      const S = pkg.scripts || {};
      const fixos = { start: 'expo start', dev: 'expo start', android: 'expo run:android', ios: 'expo run:ios', web: 'expo start --web' };
      for (const [k, v] of Object.entries(S)) if (/pnpm|REPL|\$PORT|EXPO_TOKEN=|--localhost/.test(v)) { S[k] = fixos[k] || String(v).replace(/EXPO_TOKEN=\s*/g, '').replace(/pnpm exec /g, 'npx ').replace(/pnpm /g, 'npm run ').replace(/\s*--port \$PORT/g, '').replace(/\s*--localhost/g, ''); mud.push('script "' + k + '"'); }
      const temPnpmLock = Object.keys(arqs).some((p) => p === r + 'pnpm-lock.yaml');
      if (/^pnpm@/.test(pkg.packageManager || '') && !temPnpmLock) { delete pkg.packageManager; mud.push('tirei "packageManager: pnpm" (o projeto usa npm)'); }
      if (!pkg.name) pkg.name = e.slug;
      if (mud.length) relato.push('📦 package.json: ' + mud.join(', '));
      out[r + 'package.json'] = JSON.stringify(pkg, null, 2) + '\n';
      const d = Object.assign({}, pkg.dependencies, pkg.devDependencies);
      const sdk = +(String(d.expo || '').match(/\d+/) || [0])[0], par = SDK[sdk];
      const base = (v) => (String(v || '').match(/(\d+)\.(\d+)/) || []).slice(1, 3).join('.');
      if (par && (base(d['react-native']) !== par[0] || base(d.react) !== par[1])) avisos.push('⚠️ Expo ' + sdk + ' pede React Native ' + par[0] + ' e React ' + par[1] + ' (está ' + (base(d['react-native']) || '?') + ' / ' + (base(d.react) || '?') + '). A receita tenta acertar sozinha.');
      else if (par) relato.push('✅ Versões combinam (Expo ' + sdk + ')');
    } else avisos.push('❗ Sem package.json válido.');

    // ── 5. receita do GitHub + .gitignore
    out[r + '.github/workflows/eas-build.yml'] = RECEITA;
    const outras = Object.keys(arqs).filter((p) => p.startsWith(r + '.github/workflows/') && /\.ya?ml$/.test(p) && p !== r + '.github/workflows/eas-build.yml').map((p) => p.slice((r + '.github/workflows/').length));
    if (outras.length) avisos.push('ℹ️ O projeto já tinha outras receitas no GitHub (' + outras.join(', ') + '). Deixei como estavam; para o APK pelo EAS use a "☁️ APK pelo EAS".');
    relato.push('✅ Receita do GitHub: .github/workflows/eas-build.yml (Actions → "☁️ APK pelo EAS" → Run workflow)');
    const gi = arqs[r + '.gitignore'] || '';
    const precisa = ['node_modules/', '.env', '*.keystore', '*.jks', 'credentials.json', '.expo/'].filter((x) => !gi.includes(x));
    if (precisa.length) out[r + '.gitignore'] = gi + (gi && !gi.endsWith('\n') ? '\n' : '') + precisa.join('\n') + '\n';

    // ── 6. código que ainda chama a Replit
    const comReplit = Object.entries(arqs).filter(([p, t]) => p.startsWith(r) && /\.(m?[jt]sx?)$/.test(p) && !/node_modules\//.test(p) && /replit\.(app|dev|co)|repl\.co/i.test(t || '')).map(([p]) => p.slice(r.length));
    if (comReplit.length) avisos.push('⚠️ Código que ainda chama endereço da Replit: ' + comReplit.slice(0, 6).join(', ') + (comReplit.length > 6 ? '…' : '') + '. Funciona enquanto a Replit estiver ligada.');

    return { arquivos: out, apagados, relato, avisos, slug: e.slug, owner: e.owner, projectId: pid, pacote: e.android.package };
  }

  g.ExpoConserto = { ler, consertar, permissoes, slugDe, RECEITA };
})(typeof window !== 'undefined' ? window : globalThis);
