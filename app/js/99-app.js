/* =========================================================================
   Mini SK — 99-app.js
   Junta tudo: barra de cima, gavetas (Arquivos à esquerda; IA, Busca,
   Checkpoints, GitHub e Projetos à direita), atalhos de teclado,
   celular x computador e o primeiro projeto de exemplo.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const SIDES = {
    ai: { title: '🤖 IA', build: (el) => SK.ai.build(el) },
    search: { title: '🔍 Buscar', build: (el) => SK.search.build(el) },
    term: { title: '⌨️ Terminal', build: (el) => SK.terminal.build(el) },
    links: { title: '🔗 Meus Links', build: (el) => SK.links.build(el) },
    play: { title: '▶️ Playground', build: (el) => SK.playground.build(el) },
    cp: { title: '📸 Checkpoints', build: (el) => SK.checkpoints.build(el) },
    gh: { title: '🐙 GitHub', build: (el) => SK.github.build(el) },
    ft: { title: '✂️ Fatiador — dividir em blocos', build: (el) => SK.fatiador.build(el) },
    api: { title: '🧪 Testar a API do projeto', build: (el) => SK.api.build(el) },
    termux: { title: window.miniskPC ? '💻 Terminal do computador' : '📱 Termux (Linux do celular)', build: (el) => SK.termux.build(el) },
    prep: { title: '🏗️ Preparar o projeto', build: (el) => SK.preparar.build(el) },
    apk: { title: '📦 APK — app Android de verdade', build: (el) => SK.apk.build(el) },
    node: { title: '⚡ Node de verdade (WebContainer)', build: (el) => SK.node.build(el) },
    eas: { title: '☁️ EAS — APK de app Expo pela nuvem do Expo', build: (el) => SK.eas.build(el) },
    rx: { title: '🧬 Raio-X do projeto', build: (el) => SK.analise.build(el) },
    inv: { title: '📚 Inventário dos códigos', build: (el) => SK.inventario.build(el) },
    pwa: { title: '📱 PWA — ícones, instalar, Hub', build: (el) => SK.pwa.build(el) },
    cfg: { title: '⚙️ Configuração', build: (el) => SK.config.build(el) },
    imp: { title: '📥 Importar tudo / ✂️ Picotar', build: (el) => SK.importar.build(el) },
    proj: { title: '🗂 Projetos', build: (el) => buildProjects(el) },
  };
  let side = null;
  const mobile = () => window.matchMedia('(max-width: 820px)').matches;

  // ── Gavetas ─────────────────────────────────────────────────────────────────
  function setTree(open) {
    document.body.classList.toggle('tree-open', open);
    if (!mobile()) SK.pref.set('treeOpen', open);
    if (open && mobile()) closeSide();
    SK.$('#btn-tree').classList.toggle('on', open);
  }
  function openSide(name) {
    if (!SIDES[name]) return;
    side = name;
    document.body.classList.add('side-open');
    document.body.dataset.lado = name; // o 💻 terminal no PC abre largo
    SK.$$('#side .side-pane').forEach((p) => (p.hidden = p.dataset.side !== name));
    SK.$('#side-title').textContent = SIDES[name].title;
    SK.$$('[data-open]').forEach((b) => b.classList.toggle('on', b.dataset.open === name));
    if (mobile()) setTree(false);
    SK.pref.set('side', name);
    if (name === 'proj') renderProjects();
    if (name === 'cp') SK.checkpoints.render();
    if (name === 'ft') SK.fatiador.fill();
    if (name === 'pwa') SK.$('#side [data-side="pwa"] .seg-b.on')?.click();
  }
  function closeSide() {
    side = null;
    document.body.classList.remove('side-open');
    SK.$$('[data-open]').forEach((b) => b.classList.remove('on'));
    SK.pref.set('side', null);
  }
  function toggleSide(name) { side === name && document.body.classList.contains('side-open') ? closeSide() : openSide(name); }

  // ── Projetos ────────────────────────────────────────────────────────────────
  const STARTER = {
    'index.html': '<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Meu projeto</title>\n  <link rel="stylesheet" href="css/estilo.css">\n</head>\n<body>\n  <main>\n    <h1>Olá! 👋</h1>\n    <p>Edite os arquivos na árvore e veja o resultado aqui embaixo, ao vivo.</p>\n    <button id="btn">Clique aqui</button>\n    <p id="saida"></p>\n  </main>\n  <script src="js/app.js"></script>\n</body>\n</html>\n',
    'css/estilo.css': 'body {\n  font-family: system-ui, sans-serif;\n  background: #f6f7fb;\n  color: #1d2433;\n  margin: 0;\n}\nmain {\n  max-width: 640px;\n  margin: 40px auto;\n  padding: 0 16px;\n}\nbutton {\n  padding: 10px 16px;\n  border: 0;\n  border-radius: 8px;\n  background: #3b6cf6;\n  color: #fff;\n  font-size: 16px;\n}\n',
    'js/app.js': "// Cada módulo cuida de uma coisa só.\nconst btn = document.getElementById('btn');\nconst saida = document.getElementById('saida');\nlet cliques = 0;\n\nbtn.addEventListener('click', () => {\n  cliques++;\n  saida.textContent = 'Você clicou ' + cliques + ' vez(es).';\n  console.log('clique', cliques);\n});\n",
    '.sk/diario.md': '# Diário do projeto\n\nO que é este projeto, o que já funciona e o que falta. A IA lê e atualiza este arquivo para não se perder.\n\n## Objetivo\n- \n\n## Já funciona\n- \n\n## Falta fazer\n- \n',
  };
  function starterFiles() {
    const files = {};
    for (const p in STARTER) files[p] = { text: STARTER[p], enc: 'UTF-8', size: new TextEncoder().encode(STARTER[p]).length };
    return files;
  }

  let projBox;
  // ── Backup de tudo (projetos + links + playground + chaves opcionais) ──────
  const PREFS_CHAVES = ['aiKeys', 'aiActive', 'ghToken', 'ghUser', 'apiBase', 'minhasChaves'];
  function kvTudo() {
    return new Promise((ok, erro) => {
      const r = indexedDB.open('mini-sk-2');
      r.onerror = () => erro(r.error);
      r.onsuccess = () => {
        const out = {}; const tx = r.result.transaction('kv'); const c = tx.objectStore('kv').openCursor();
        c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } };
        tx.oncomplete = () => ok(out); tx.onerror = () => erro(tx.error);
      };
    });
  }
  async function backupTudo(paraDrive) {
    await fs().saveNow();
    const projetos = await SK.db.all('projects');
    const kv = await kvTudo().catch(() => ({}));
    const comChaves = await SK.confirm('Levar também as chaves de IA, o token do GitHub e “Minhas chaves” no backup?\n\nSe sim, NÃO mande esse arquivo para ninguém.', { okText: 'Levar as chaves', cancelText: 'Sem as chaves' });
    const prefs = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!k || k.indexOf('minisk2:') !== 0) continue;
      const nome = k.slice('minisk2:'.length);
      if (!comChaves && PREFS_CHAVES.includes(nome)) continue;
      prefs[nome] = localStorage.getItem(k);
    }
    const dados = { app: 'mini-sk', versao: 1, data: new Date().toISOString(), comChaves: !!comChaves, projetos, kv, prefs };
    const txt = JSON.stringify(dados);
    const nomeBk = 'mini-sk-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    if (paraDrive) { await SK.compartilhar(nomeBk, txt, 'application/json'); return; }
    SK.download(nomeBk, txt, 'application/json');
    SK.toast('💾 Backup: ' + projetos.length + ' projeto(s), ' + SK.bytes(txt.length), 'ok');
  }
  async function restaurarTudo(file) {
    const d = JSON.parse(await file.text());
    if (!d || d.app !== 'mini-sk' || !Array.isArray(d.projetos)) throw new Error('não é um backup do Mini SK');
    const existentes = new Set((await fs().listProjects()).map((p) => p.name));
    const iguais = d.projetos.filter((p) => existentes.has(p.name)).length;
    const msg = 'Restaurar ' + d.projetos.length + ' projeto(s) de ' + new Date(d.data).toLocaleString('pt-BR') + '?' +
      (iguais ? '\n\n' + iguais + ' já existe(m) aqui com o mesmo nome: a versão do backup substitui a daqui.' : '') +
      '\n\nOs projetos daqui que não estão no backup continuam como estão.';
    if (!(await SK.confirm(msg, { okText: 'Restaurar' }))) return;
    await fs().saveNow();
    for (const p of d.projetos) await SK.db.put('projects', p);
    for (const [k, v] of Object.entries(d.kv || {})) await SK.db.put('kv', v, k);
    for (const [k, v] of Object.entries(d.prefs || {})) { try { localStorage.setItem('minisk2:' + k, v); } catch {} }
    SK.toast('✅ Restaurado. Recarregando…', 'ok');
    setTimeout(() => location.reload(), 900);
  }

  function buildProjects(el) {
    projBox = el;
    el.innerHTML =
      '<div class="stack">' +
      '<div class="row wrap"><button class="btn primary" id="pj-new">＋ Projeto novo</button><button class="btn" id="pj-blank">＋ Vazio</button><button class="btn" id="pj-zip">🗜 Abrir .zip como projeto</button></div>' +
      '<input type="file" id="pj-zip-in" accept=".zip,.tar,.gz,.tgz,.taz,application/zip,application/gzip,application/x-tar" hidden>' +
      '<div id="pj-list" class="pj-list"></div>' +
      '<hr><h4>Editor</h4>' +
      '<div class="row wrap"><button class="btn small" id="pj-zoom-out">A−</button><button class="btn small" id="pj-zoom-in">A+</button><button class="btn small" id="pj-wrap">↩ Quebra de linha</button><button class="btn small" id="pj-goto">Ir para linha</button></div>' +
      '<hr><h4>🔗 Ponte com outros apps</h4><p class="muted small">Manda o projeto aberto para o Cirurgião (achar problemas, corrigir) e recebe de volta só o que ele corrigiu.</p>' +
      '<div class="row wrap"><button class="btn small primary" id="pj-cir">🩺 Mandar para o Cirurgião</button><button class="btn small" id="pj-cir-end">Endereço do Cirurgião</button></div>' +
      '<hr><h4>💾 Backup de tudo</h4><p class="muted small">Um arquivo só com <b>todos os projetos</b>, os Links, o Playground e (se quiser) as chaves. Serve para guardar uma cópia e para passar tudo do PWA para o APK, ou de um aparelho para outro.</p>' +
      '<div class="row wrap"><button class="btn small primary" id="pj-bk">⤓ Baixar backup de tudo</button><button class="btn small" id="pj-rs">⤒ Restaurar backup</button></div>' +
      '<h4>📤 Mandar para o Drive</h4><p class="muted small">Abre o "Compartilhar" do celular: escolha <b>Drive</b> (ou WhatsApp, e-mail). Sem cadastro no Google.</p>' +
      '<div class="row wrap"><button class="btn small primary" id="pj-drive-proj">📤 Projeto aberto (.zip)</button><button class="btn small" id="pj-drive-bk">📤 Backup de tudo (.json)</button></div>' +
      '<input type="file" id="pj-rs-in" accept=".json,application/json" hidden>' +
      '<hr><h4>Espaço</h4><p class="muted small" id="pj-space">…</p>' +
      '<p class="muted small">Tudo fica guardado <b>neste navegador</b>, neste aparelho. Para levar para outro lugar: baixe o .zip (⤓ na árvore) ou envie ao GitHub. Limpar os dados do navegador apaga os projetos.</p>' +
      '<hr><h4>Atalhos</h4><p class="muted small">Ctrl+S salvar · Ctrl+B arquivos · Ctrl+Shift+F buscar · Ctrl+J IA · Ctrl+G ir para linha · Ctrl+Enter (na IA) enviar · Alt+P preview maior/menor</p>' +
      '</div>';
    const $ = (s) => SK.$(s, el);
    $('#pj-new').onclick = async () => { const n = await SK.prompt('Nome do projeto novo:', 'Projeto ' + new Date().toLocaleDateString('pt-BR').replace(/\//g, '-'), { okText: 'Criar' }); if (n) { await fs().create(n, starterFiles()); SK.editor.open('index.html'); renderProjects(); } };
    $('#pj-blank').onclick = async () => { const n = await SK.prompt('Nome do projeto vazio:', 'Projeto vazio', { okText: 'Criar' }); if (n) { await fs().create(n, {}); renderProjects(); setTree(true); } };
    $('#pj-cir').onclick = () => SK.ponte.mandarCirurgiao();
    $('#pj-cir-end').onclick = () => SK.ponte.endereco(true);
    $('#pj-bk').onclick = () => backupTudo().catch((er) => SK.toast('Erro no backup: ' + er.message, 'error'));
    $('#pj-drive-bk').onclick = () => backupTudo(true).catch((er) => SK.toast('Erro no backup: ' + er.message, 'error'));
    $('#pj-drive-proj').onclick = async () => {
      if (!fs().project) return SK.toast('Abra um projeto primeiro', 'error');
      try { await fs().saveNow(); await SK.compartilhar(fs().project.name.replace(/[\\/:*?"<>|]/g, '_') + '.zip', await fs().exportZip(), 'application/zip'); }
      catch (er) { SK.toast('Erro: ' + er.message, 'error'); }
    };
    $('#pj-rs').onclick = () => $('#pj-rs-in').click();
    $('#pj-rs-in').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await restaurarTudo(f).catch((er) => SK.toast('Backup inválido: ' + er.message, 'error')); };
    $('#pj-zip').onclick = () => $('#pj-zip-in').click();
    $('#pj-zip-in').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      await fs().create(SK.zip.nomeSemExt(f.name), {});
      const r = await fs().importFiles([f], '');
      await fs().saveNow();
      SK.toast(r.count + ' arquivos importados · ' + Object.entries(r.encs).map(([k, v]) => k + ': ' + v).join(', '));
      e.target.value = ''; renderProjects(); setTree(true);
    };
    $('#pj-list').onclick = async (e) => {
      const b = e.target.closest('[data-pj]'); if (!b) return;
      const name = b.closest('[data-name]').dataset.name;
      const act = b.dataset.pj;
      if (act === 'open') { await fs().open(name); renderProjects(); if (mobile()) closeSide(); }
      if (act === 'rename') { if (name !== fs().project.name) await fs().open(name); const n = await SK.prompt('Novo nome do projeto:', name, { okText: 'Renomear' }); if (n) await fs().renameProject(n); renderProjects(); }
      if (act === 'del') {
        if (!(await SK.confirm('Apagar o projeto "' + name + '" e todos os checkpoints dele? Isso não tem volta. (Baixe o .zip antes se tiver dúvida.)', { danger: true, okText: 'Apagar para sempre' }))) return;
        const wasOpen = fs().project && fs().project.name === name;
        await fs().deleteProject(name);
        if (wasOpen) { const rest = await fs().listProjects(); rest.length ? await fs().open(rest[0].name) : await fs().create('Meu projeto', starterFiles()); }
        renderProjects();
      }
    };
    $('#pj-zoom-out').onclick = () => SK.editor.zoom(-1);
    $('#pj-zoom-in').onclick = () => SK.editor.zoom(1);
    $('#pj-wrap').onclick = () => SK.editor.toggleWrap();
    $('#pj-goto').onclick = () => SK.editor.goToLine();
    renderProjects();
  }
  async function renderProjects() {
    if (!projBox) return;
    const all = await fs().listProjects();
    const cur = fs().project && fs().project.name;
    SK.$('#pj-list', projBox).innerHTML = all.map((p) =>
      '<div class="pj' + (p.name === cur ? ' on' : '') + '" data-name="' + SK.esc(p.name) + '">' +
      '<div><b>' + SK.esc(p.name) + '</b>' + (p.name === cur ? ' <span class="pill">aberto</span>' : '') + '<div class="muted small">' + p.files + ' arquivos · ' + (p.updated ? new Date(p.updated).toLocaleString('pt-BR') : '') + '</div></div>' +
      '<div class="row tight">' + (p.name === cur ? '' : '<button class="btn tiny primary" data-pj="open">Abrir</button>') +
      '<button class="btn tiny" data-pj="rename">Renomear</button><button class="btn tiny danger" data-pj="del">Apagar</button></div></div>').join('') || '<p class="muted">Nenhum projeto.</p>';
    const est = await SK.storageInfo();
    if (est && est.quota) SK.$('#pj-space', projBox).textContent = 'Usando ' + SK.bytes(est.usage || 0) + ' de ' + SK.bytes(est.quota) + ' disponíveis neste navegador.';
  }

  // ── Indicador de salvo ──────────────────────────────────────────────────────
  let saveState;
  function setSave(state) {
    const el = SK.$('#save-ind'); if (!el) return;
    saveState = state;
    el.textContent = state === 'dirty' ? '● salvando' : '✓ salvo';
    el.classList.toggle('dirty', state === 'dirty');
  }

  // ── Atalhos ─────────────────────────────────────────────────────────────────
  function keys(e) {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 's') { e.preventDefault(); fs().saveNow().then(() => SK.toast('✓ Salvo neste navegador')); return; }
    if (mod && k === 'b') { e.preventDefault(); setTree(!document.body.classList.contains('tree-open')); return; }
    if (mod && e.shiftKey && k === 'f') { e.preventDefault(); openSide('search'); SK.search.focus(SK.editor.selection()); return; }
    if (mod && k === 'j') { e.preventDefault(); toggleSide('ai'); return; }
    if (e.altKey && k === 'p') { e.preventDefault(); SK.$('[data-p="max"]').click(); return; }
    if (k === 'escape' && !SK.$('.modal-wrap') && !SK.$('.popup')) { if (mobile() && document.body.classList.contains('side-open')) closeSide(); else if (mobile() && document.body.classList.contains('tree-open')) setTree(false); }
  }

  // ── Início ──────────────────────────────────────────────────────────────────
  async function init() {
    // Monta os painéis da direita
    const sideBody = SK.$('#side-body');
    for (const name in SIDES) {
      const pane = document.createElement('div');
      pane.className = 'side-pane'; pane.dataset.side = name; pane.hidden = true;
      sideBody.appendChild(pane);
      try { SIDES[name].build(pane); } catch (e) { pane.innerHTML = '<p class="msg error">Erro ao montar este painel: ' + SK.esc(e.message) + '</p>'; console.error(e); }
    }
    SK.editor.build(); SK.tree.build(); SK.preview.build();

    SK.$('#btn-tree').onclick = () => setTree(!document.body.classList.contains('tree-open'));
    SK.$('#side-close').onclick = closeSide;
    SK.$('#backdrop').onclick = () => { closeSide(); setTree(false); };
    SK.$$('[data-open]').forEach((b) => (b.onclick = () => toggleSide(b.dataset.open)));
    SK.$('#proj-name').onclick = () => openSide('proj');
    document.addEventListener('keydown', keys);

    SK.on('project-open', (P) => { SK.$('#proj-name').textContent = P.name; document.title = P.name + ' · Mini SK 2'; renderProjects(); });
    SK.on('fs-change', () => setSave('dirty'));
    SK.on('saved', () => setSave('ok'));
    SK.on('tree-picked', () => { if (mobile()) setTree(false); });
    SK.on('picked-result', () => { if (mobile()) closeSide(); });
    window.addEventListener('beforeunload', () => { fs().saveNow(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') fs().saveNow(); });
    window.addEventListener('pagehide', () => { fs().saveNow(); });
    window.addEventListener('app-pausa', () => { fs().saveNow(); });

    // Abre o último projeto (ou cria o de exemplo)
    // 💾 pede ao navegador/Android para NÃO apagar os projetos quando falta espaço; se recusar, pede de novo no 1º toque
    SK.persistStorage().then((ok) => { if (!ok) document.addEventListener('click', function pedir() { document.removeEventListener('click', pedir, true); SK.persistStorage(); }, true); });
    let list = [];
    try { list = await fs().listProjects(); } catch (e) { SK.toast('O navegador bloqueou o armazenamento (modo anônimo?). Os projetos não serão guardados.', 'error'); }
    const last = SK.pref.get('lastProject', null);
    if (last && list.some((p) => p.name === last)) await fs().open(last);
    else if (list.length) await fs().open(list[0].name);
    else { await fs().create('Meu primeiro projeto', starterFiles()); SK.editor.open('index.html', { noFocus: true }); }

    setTree(mobile() ? false : SK.pref.get('treeOpen', true));
    const s = SK.pref.get('side', null);
    if (s && !mobile()) openSide(s);
    setSave('ok');
    document.body.classList.add('ready');
  }

  SK.app = { openSide, closeSide, toggleSide, setTree, starterFiles };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  // Avisa quando abre uma versão nova (para saber que atualizou de verdade)
  try {
    const antes = SK.pref.get('versaoVista', '');
    if (antes !== SK.version) { setTimeout(() => SK.toast('✅ Mini SK atualizado — versão ' + SK.versaoTexto, 'ok'), 1200); SK.pref.set('versaoVista', SK.version); }
  } catch (e) {}

  // Versão nova publicada no Netlify: quando ela assume, recarrega uma vez sozinho
  // (antes ficava mostrando a antiga e parecia que "nada mudou").
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      let recarregou = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (recarregou) return; recarregou = true;
        // trava contra "pisca-pisca": recarrega no máximo 1 vez a cada 5 minutos
        let ult = 0; try { ult = +sessionStorage.getItem('minisk:recarga') || 0; } catch {}
        if (Date.now() - ult < 300000) return;
        try { sessionStorage.setItem('minisk:recarga', String(Date.now())); } catch {}
        SK.toast && SK.toast('Versão nova do Mini SK — recarregando…'); setTimeout(() => location.reload(), 600);
      });
    }
  } catch {}
})(window.SK);
