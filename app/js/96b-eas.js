/* =========================================================================
   Mini SK — 96b-eas.js
   ☁️ EAS: gera o APK de um app EXPO pela nuvem do Expo, do jeito oficial.
   (Para HTML puro, use o 📦 APK — é mais simples e não gasta build do Expo.)

   Como funciona (os "dois tokens"):
   - token do GitHub (o mesmo do painel 🐙) → envia o projeto, guarda o token
     do Expo trancado no repositório (Secrets) e manda o GitHub rodar a receita;
   - token do Expo → fica guardado só neste aparelho e, trancado, no repositório.
   A receita (.github/workflows/eas-build.yml) roda o programa OFICIAL do Expo
   (eas build). É a mesma ideia do workflow que o Replit fez no DevMobile.

   Antes de gastar build, o painel confere o app.json e o eas.json:
   dono (owner), slug, projectId, pacote, imagens que faltam, versões do
   Expo/React que não combinam, "catalog:" do Replit e arquivos secretos.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const WF = '.github/workflows/eas-build.yml';
  let box, polling = null;

  // Versões que precisam andar juntas (Expo SDK → React Native / React)
  const SDK = {
    50: { rn: '0.73', react: '18.2' }, 51: { rn: '0.74', react: '18.2' }, 52: { rn: '0.76', react: '18.3' },
    53: { rn: '0.79', react: '19.0' }, 54: { rn: '0.81', react: '19.1' },
  };
  const versaoBase = (v) => { const m = /(\d+)\.(\d+)/.exec(String(v || '')); return m ? m[1] + '.' + m[2] : ''; };
  const majorExpo = (v) => { const m = /(\d+)/.exec(String(v || '')); return m ? +m[1] : 0; };

  const RECEITA = `# Receita do Mini SK (painel ☁️ EAS): compila o APK na nuvem do Expo.
# O token do Expo NÃO fica aqui: ele vai trancado em Settings → Secrets → EXPO_TOKEN.
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
          if [ -z "\${{ secrets.EXPO_TOKEN }}" ]; then echo "::error::Falta o EXPO_TOKEN em Settings → Secrets → Actions. Use o painel ☁️ EAS do Mini SK."; exit 1; fi

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

  // ── Ler e conferir o projeto ────────────────────────────────────────────────
  function lerJson(p) { const t = fs().read(p); if (t == null) return { falta: true }; try { return { j: JSON.parse(t) }; } catch (e) { return { erro: e.message }; } }
  function conferir() {
    const R = { itens: [], ok: true, cfg: {} };
    const add = (bom, texto, grave) => { R.itens.push({ bom, texto, aviso: grave === false }); if (!bom && grave !== false) R.ok = false; };
    const app = lerJson('app.json'), eas = lerJson('eas.json'), pkg = lerJson('package.json');
    if (app.falta) { add(false, 'Falta o app.json. Este painel é para app EXPO. Para HTML, use o 📦 APK.'); return R; }
    if (app.erro) { add(false, 'O app.json está com erro de escrita: ' + app.erro); return R; }
    const e = (app.j && app.j.expo) || {};
    const a = e.android || {};
    R.cfg = { nome: e.name || '', slug: e.slug || '', owner: e.owner || '', projectId: ((e.extra || {}).eas || {}).projectId || '', pacote: a.package || '', versao: e.version || '1.0.0' };
    add(!!e.name, 'Nome do app: ' + (e.name || 'FALTA'));
    add(/^[a-z0-9-]+$/.test(e.slug || ''), 'Slug (nome curto, sem espaço/acento): ' + (e.slug || 'FALTA'));
    add(!!e.owner, 'Dono (conta do Expo): ' + (e.owner || 'FALTA'));
    add(/^[0-9a-f-]{36}$/i.test(R.cfg.projectId), 'projectId: ' + (R.cfg.projectId || 'FALTA (crie o projeto em expo.dev e copie o ID)'));
    add(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(a.package || ''), 'Pacote Android: ' + (a.package || 'FALTA (ex.: com.maikon.meuapp)'));
    // imagens que o app.json pede
    const imgs = [e.icon, (e.splash || {}).image, (a.adaptiveIcon || {}).foregroundImage].filter(Boolean);
    const faltam = imgs.filter((p) => !fs().exists(String(p).replace(/^\.\//, '')));
    add(!faltam.length, faltam.length ? 'Imagens que o app.json pede e NÃO estão no projeto: ' + faltam.join(', ') + ' (a compilação para)' : 'Imagens do app: ok');
    // eas.json
    if (eas.falta) add(false, 'Falta o eas.json (o botão "Corrigir" cria).');
    else if (eas.erro) add(false, 'O eas.json está com erro de escrita: ' + eas.erro);
    else {
      const pv = ((eas.j.build || {}).preview || {});
      add(((pv.android || {}).buildType) === 'apk', 'eas.json → perfil "preview" gera APK: ' + (((pv.android || {}).buildType) || 'não'));
      const local = JSON.stringify(eas.j).includes('"credentialsSource":"local"');
      add(!local, local ? 'eas.json usa a assinatura LOCAL (credentials.json). Na nuvem ela não existe: troque para a do Expo ou a compilação para.' : 'Assinatura: guardada no Expo');
    }
    // versões
    if (!pkg.falta && pkg.j) {
      const d = Object.assign({}, pkg.j.dependencies, pkg.j.devDependencies);
      const sdk = majorExpo(d.expo), par = SDK[sdk];
      if (!d.expo) add(false, 'O package.json não tem o "expo".');
      else if (par) {
        const rn = versaoBase(d['react-native']), re = versaoBase(d.react);
        const bate = rn === par.rn && re === par.react;
        add(bate, bate ? 'Versões combinam (Expo ' + sdk + ', React Native ' + rn + ', React ' + re + ')' : '⚠ Versões não combinam: Expo ' + sdk + ' pede React Native ' + par.rn + ' e React ' + par.react + ', mas está React Native ' + (rn || '?') + ' e React ' + (re || '?') + '. A receita tenta acertar sozinha (expo install --fix); se falhar, é isso.', false);
      }
      add(!/"catalog:/.test(fs().read('package.json')), 'package.json sem "catalog:" do Replit', true);
    }
    // segredos que não podem subir
    const segredos = fs().list().filter((p) => /(^|\/)(credentials\.json|\.env(\..*)?|[^/]*\.(keystore|jks|pem|p12|pfx|key))$/i.test(p));
    add(!segredos.length, segredos.length ? 'Arquivos SECRETOS no projeto (não podem ir para o GitHub): ' + segredos.join(', ') + '. Tire do projeto antes de enviar.' : 'Nenhum arquivo secreto no projeto');
    R.segredos = segredos;
    return R;
  }

  async function corrigir(v) {
    await SK.checkpoints.auto('Antes de corrigir app.json/eas.json (☁️ EAS)');
    if (!window.ExpoConserto) throw new Error('Falta js/lib/expo-core.js');
    // monta o mapa {caminho: texto} do projeto (binários entram vazios, só para saber que existem)
    const A = {};
    for (const p of fs().list()) { const r = fs().get(p); A[p] = r && r.text != null && r.text.length < 3e6 ? r.text : ''; }
    const r = ExpoConserto.consertar(A, v);
    for (const [p, t] of Object.entries(r.arquivos)) fs().write(p, t, { silent: true });
    for (const p of r.apagados) fs().remove(p);
    SK.emit('fs-change', { type: 'import' });
    return r;
  }

  // ── Expo: testar se responde daqui ──────────────────────────────────────────
  async function testarExpo(token) {
    try {
      const r = await fetch('https://api.expo.dev/graphql', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{ meActor { __typename ... on User { username } ... on Robot { firstName } accounts { name } } }' }) });
      const j = await r.json().catch(() => ({}));
      if (j.errors && j.errors.length) return { ok: false, msg: 'O Expo respondeu, mas recusou o token: ' + j.errors[0].message };
      const m = j.data && j.data.meActor;
      if (!m) return { ok: false, msg: 'O Expo respondeu sem dados (HTTP ' + r.status + ').' };
      return { ok: true, msg: 'O Expo respondeu daqui ✅ Conta: ' + (m.username || m.firstName || '?') + (m.accounts ? ' · contas: ' + m.accounts.map((x) => x.name).join(', ') : '') };
    } catch (e) {
      return { ok: false, msg: 'O navegador não deixou esta página falar direto com o Expo (bloqueio de segurança do navegador). Normal — por isso o envio vai pelo GitHub, que fala com o Expo do jeito oficial.' };
    }
  }

  // ── GitHub: enviar, trancar o token, mandar rodar, acompanhar ───────────────
  const gh = (p, o) => SK.github.gh(p, o);
  async function repoOf() {
    const v = SK.$('#eas-repo', box).value.trim();
    const l = SK.github.getLink();
    if (!v && l) return l;
    return SK.github.resolveRepo(v || SK.github.repoSlug(fs().project.name));
  }
  async function guardarSegredo(r, expoToken) {
    const chave = await gh('/repos/' + r.owner + '/' + r.repo + '/actions/secrets/public-key');
    const selado = SK.selar(expoToken, chave.key);
    await gh('/repos/' + r.owner + '/' + r.repo + '/actions/secrets/EXPO_TOKEN', { method: 'PUT', body: { encrypted_value: selado, key_id: chave.key_id } });
  }
  async function enviarEGerar() {
    if (!SK.github.token) throw new Error('Cole o token do GitHub no painel 🐙 GitHub primeiro.');
    const expoToken = SK.pref.get('expoToken', '');
    if (!expoToken) throw new Error('Cole e salve o token do Expo aqui em cima primeiro.');
    const C = conferir();
    if (C.segredos && C.segredos.length) throw new Error('Tire do projeto os arquivos secretos antes: ' + C.segredos.join(', '));
    if (!C.ok && !(await SK.confirm('A conferência achou problemas (❌). A compilação provavelmente vai FALHAR e gastar 1 build. Enviar mesmo assim?', { okText: 'Enviar mesmo assim', danger: true }))) return;
    if (!(await SK.confirm('Isso usa 1 build grátis do mês do Expo. Enviar e mandar compilar?', { okText: 'Compilar' }))) return;
    const REC = window.ExpoConserto ? window.ExpoConserto.RECEITA : RECEITA;
    if (fs().read(WF) !== REC) { fs().write(WF, REC, { silent: true }); SK.emit('fs-change', { type: 'import' }); }
    const r = await repoOf();
    const ens = await SK.github.ensureRepo(r, true);
    SK.$('#eas-repo', box).value = r.repo;
    status((ens.created ? 'Repositório criado (privado). ' : '') + 'Enviando o projeto…');
    await SK.github.push(r.owner, r.repo, r.branch || '', 'APK pelo EAS (Mini SK)', { mirror: true, includeSk: false });
    status('Guardando o token do Expo trancado no repositório (Secrets)…');
    try { await guardarSegredo(r, expoToken); }
    catch (e) { throw new Error('O GitHub não deixou guardar o token do Expo (' + e.message + '). O token do GitHub precisa da permissão "Secrets: Read and write" (no token clássico: "repo").'); }
    const info = await gh('/repos/' + r.owner + '/' + r.repo);
    const antes = await ultimo(r);
    status('Pedindo ao GitHub para rodar a receita…');
    for (let t = 1; ; t++) {
      try { await gh('/repos/' + r.owner + '/' + r.repo + '/actions/workflows/eas-build.yml/dispatches', { method: 'POST', body: { ref: r.branch || info.default_branch } }); break; }
      catch (e) {
        if ((e.status === 404 || e.status === 422) && t < 5) { status('Esperando o GitHub reconhecer a receita… (' + t + ')'); await new Promise((ok) => setTimeout(ok, 4000)); continue; }
        throw new Error('O GitHub não deixou rodar (' + e.message + '). O token precisa de "Actions: Read and write" e "Workflows".');
      }
    }
    acompanhar(r, antes ? antes.id : 0);
  }
  async function ultimo(r) { try { const d = await gh('/repos/' + r.owner + '/' + r.repo + '/actions/workflows/eas-build.yml/runs?per_page=1'); return d.workflow_runs[0] || null; } catch { return null; } }
  function parar() { if (polling) { clearTimeout(polling); polling = null; } }
  function acompanhar(r, depoisDe) {
    parar();
    const t0 = Date.now();
    const tick = async () => {
      try {
        const run = await ultimo(r);
        if (!run || run.id === depoisDe) { if (Date.now() - t0 > 90000) { status('O GitHub ainda não começou. Confira a aba Actions do repositório.', 'error'); return; } status('Esperando o GitHub começar…'); polling = setTimeout(tick, 4000); return; }
        const jobs = await gh('/repos/' + r.owner + '/' + r.repo + '/actions/runs/' + run.id + '/jobs');
        const job = jobs.jobs[0];
        const ic = { success: '✅', failure: '❌', cancelled: '⛔', skipped: '⏭', in_progress: '⏳', queued: '🕒' };
        SK.$('#eas-run', box).innerHTML = '<div class="row wrap"><b>Execução nº ' + run.run_number + '</b><a class="small" href="' + SK.esc(run.html_url) + '" target="_blank" rel="noopener">abrir no GitHub ↗</a></div>' +
          (job && job.steps ? '<div class="apk-steps">' + job.steps.map((s) => '<div class="apk-step ' + (s.conclusion || s.status) + '">' + (ic[s.conclusion] || ic[s.status] || '•') + ' ' + SK.esc(s.name) + '</div>').join('') + '</div>' : '');
        if (run.status !== 'completed') { status('⏳ O GitHub está preparando e mandando para o Expo…'); polling = setTimeout(tick, 8000); return; }
        const C = conferir().cfg;
        if (run.conclusion === 'success') {
          const url = 'https://expo.dev/accounts/' + encodeURIComponent(C.owner) + '/projects/' + encodeURIComponent(C.slug) + '/builds';
          status('✅ Enviado para o Expo! O APK fica pronto em uns 10–15 minutos.', 'ok');
          SK.$('#eas-run', box).innerHTML += '<div class="apk-ok"><a class="btn primary" href="' + SK.esc(url) + '" target="_blank" rel="noopener">⤓ Abrir as builds no Expo</a><p class="muted small">Lá, quando terminar, aparece o botão de baixar o .apk.</p></div>';
        } else {
          status('❌ Parou no GitHub. Toque em "abrir no GitHub" e veja o passo vermelho, ou mande o print para a IA.', 'error');
        }
      } catch (e) { status('⚠ ' + e.message, 'error'); }
    };
    tick();
  }

  // ── Painel ──────────────────────────────────────────────────────────────────
  function status(m, k) { const el = SK.$('#eas-status', box); if (el) { el.textContent = m; el.className = 'gh-status ' + (k || ''); } }
  function build(container) {
    box = container;
    box.innerHTML =
      '<p class="muted small">Para app <b>Expo</b> (tem app.json). Compila na nuvem do Expo pelo caminho oficial. Para <b>HTML</b>, use o 📦 APK (não gasta build do Expo).</p>' +
      '<label class="small muted">Token do Expo (expo.dev → Account settings → Access tokens) — fica só neste aparelho</label>' +
      '<div class="row"><input class="inp grow" id="eas-token" type="password" autocomplete="off" placeholder="cole o token do Expo"><button class="btn small" id="eas-salvar">Salvar</button></div>' +
      '<div class="row wrap"><button class="btn small" id="eas-testar">🔍 Testar se o Expo responde daqui</button><span class="muted small" id="eas-teste"></span></div>' +
      '<h4 style="margin:10px 0 4px">Conferência do projeto</h4><div id="eas-conf" class="stack"></div>' +
      '<details id="eas-ajuste"><summary class="small">🔧 Ajustar app.json / eas.json</summary><div class="stack" style="margin-top:6px">' +
      '<input class="inp" id="eas-nome" placeholder="Nome do app"><input class="inp mono" id="eas-slug" placeholder="slug (ex.: assistente-juridico)">' +
      '<input class="inp mono" id="eas-owner" placeholder="dono = nome da conta do Expo"><input class="inp mono" id="eas-pid" placeholder="projectId (expo.dev → projeto → ID)">' +
      '<input class="inp mono" id="eas-pac" placeholder="pacote Android (ex.: com.maikon.meuapp)"><input class="inp" id="eas-ver" placeholder="versão (ex.: 1.0.0)">' +
      '<button class="btn" id="eas-corrigir">🔧 Consertar tudo: tirar a Replit, app.json, eas.json, package.json, autorizações e receita</button><div id="eas-feito" class="stack"></div></div></details>' +
      '<div class="row" style="margin-top:8px"><input class="inp mono grow" id="eas-repo" placeholder="repositório (ex.: meu-app) — cria privado se não existir"></div>' +
      '<div class="row wrap"><button class="btn primary" id="eas-ir">☁️ Enviar e compilar no EAS</button><button class="btn small" id="eas-ver-ultimo">Ver último</button></div>' +
      '<div class="gh-status" id="eas-status"></div><div id="eas-run" class="stack"></div>' +
      '<details><summary class="small">Permissões do token do GitHub</summary><p class="small muted">Token clássico: marque <b>repo</b> e <b>workflow</b>. Token novo (fine-grained): <b>Contents</b>, <b>Actions</b>, <b>Secrets</b> e <b>Workflows</b> em "Read and write".</p></details>';
    const $ = (s) => SK.$(s, box);
    $('#eas-token').value = SK.pref.get('expoToken', '') ? '••••••••' : '';
    $('#eas-salvar').onclick = () => { const v = $('#eas-token').value.trim(); if (!v || /^•+$/.test(v)) { SK.toast('Cole o token do Expo.', 'error'); return; } SK.pref.set('expoToken', v); $('#eas-token').value = '••••••••'; SK.toast('Token do Expo salvo neste aparelho.'); };
    $('#eas-testar').onclick = async () => { const t = SK.pref.get('expoToken', ''); if (!t) { SK.toast('Salve o token do Expo primeiro.', 'error'); return; } $('#eas-teste').textContent = '⏳'; const r = await testarExpo(t); $('#eas-teste').textContent = r.msg; };
    $('#eas-corrigir').onclick = async () => {
      try {
        const r = await corrigir({ nome: $('#eas-nome').value.trim(), slug: $('#eas-slug').value.trim(), owner: $('#eas-owner').value.trim(), projectId: $('#eas-pid').value.trim(), pacote: $('#eas-pac').value.trim().toLowerCase(), versao: $('#eas-ver').value.trim() });
        fill();
        $('#eas-feito').innerHTML = r.relato.map((x) => '<div class="small">' + SK.esc(x) + '</div>').join('') + r.avisos.map((x) => '<div class="small" style="color:var(--warn,#f59e0b)">' + SK.esc(x) + '</div>').join('');
        SK.toast('Projeto acertado para o EAS (tem ponto de volta em 📸).');
      }
      catch (e) { status('⚠ ' + e.message, 'error'); }
    };
    const rodar = async (fn) => { const bs = SK.$$('button', box); bs.forEach((b) => (b.disabled = true)); try { await fn(); } catch (e) { status('⚠ ' + e.message, 'error'); } finally { bs.forEach((b) => (b.disabled = false)); } };
    $('#eas-ir').onclick = () => rodar(enviarEGerar);
    $('#eas-ver-ultimo').onclick = () => rodar(async () => { const r = await repoOf(); const u = await ultimo(r); if (!u) { status('Nenhuma execução da receita ☁️ nesse repositório.'); return; } acompanhar(r, -1); });
    fill();
  }
  function fill() {
    if (!box || !fs().project) return;
    const C = conferir(), $ = (s) => SK.$(s, box);
    $('#eas-conf').innerHTML = C.itens.map((i) => '<div class="small">' + (i.bom ? '✅ ' : i.aviso ? '' : '❌ ') + SK.esc(i.texto) + '</div>').join('');
    $('#eas-nome').value = C.cfg.nome || ''; $('#eas-slug').value = C.cfg.slug || ''; $('#eas-owner').value = C.cfg.owner || '';
    $('#eas-pid').value = C.cfg.projectId || ''; $('#eas-pac').value = C.cfg.pacote || ''; $('#eas-ver').value = C.cfg.versao || '';
    const l = SK.github.getLink(); $('#eas-repo').value = l ? l.repo : '';
  }
  SK.on('project-open', () => { parar(); if (box) { fill(); SK.$('#eas-run', box).innerHTML = ''; status(''); } });
  SK.on('fs-change', () => { if (box) fill(); });

  SK.eas = { build, conferir, corrigir, RECEITA, testarExpo };
})(window.SK);
