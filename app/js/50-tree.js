/* =========================================================================
   Mini SK — 50-tree.js
   Árvore de arquivos: pastas dentro de pastas, criar, renomear, duplicar,
   mover (arrastando ou digitando o caminho), apagar, baixar, analisar com IA.
   Importa arquivos soltos, pasta inteira ou .zip.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  let panel, list, menu;
  let expanded = new Set(SK.pref.get('expanded', []));
  let selectedDir = '';

  const ICON = { html: '◇', css: '#', js: 'ƒ', json: '{}', py: 'py', md: 'M', text: '≡', yaml: '⚙', sh: '$', sql: '⛁' };

  function build() {
    panel = SK.$('#tree-panel');
    panel.innerHTML =
      '<div class="panel-head"><b id="proj-title">Arquivos</b>' +
      '<div class="row tight">' +
      '<button class="icon-btn" data-t="new-file" title="Novo arquivo" aria-label="Novo arquivo">＋📄</button>' +
      '<button class="icon-btn" data-t="new-dir" title="Nova pasta" aria-label="Nova pasta">＋📁</button>' +
      '<button class="icon-btn" data-t="import" title="Importar arquivos, pasta ou .zip" aria-label="Importar">⤒</button>' +
      '<button class="icon-btn" data-t="export" title="Baixar projeto em .zip" aria-label="Baixar .zip">⤓</button>' +
      '<button class="icon-btn" data-t="collapse" title="Recolher pastas" aria-label="Recolher pastas">⊟</button>' +
      '</div></div>' +
      '<div class="tree" id="tree" role="tree"></div>' +
      '<div class="tree-foot muted" id="tree-foot"></div>' +
      '<input type="file" id="in-files" multiple hidden>' +
      '<input type="file" id="in-dir" webkitdirectory multiple hidden>' +
      '<input type="file" id="in-zip" accept=".zip,.tar,.gz,.tgz,.taz,application/zip,application/gzip,application/x-tar" hidden>';
    list = SK.$('#tree');
    panel.addEventListener('click', onClick);
    list.addEventListener('contextmenu', (e) => { const r = e.target.closest('.node'); if (r) { e.preventDefault(); openMenu(r, e.clientX, e.clientY); } });
    // segurar o dedo = menu (celular)
    let pressT;
    list.addEventListener('touchstart', (e) => { const r = e.target.closest('.node'); if (!r) return; pressT = setTimeout(() => { const t = e.touches[0]; openMenu(r, t.clientX, t.clientY); }, 550); }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach((ev) => list.addEventListener(ev, () => clearTimeout(pressT), { passive: true }));

    SK.$('#in-files').onchange = (e) => doImport(e.target.files, false);
    SK.$('#in-dir').onchange = (e) => doImport(e.target.files, false);
    SK.$('#in-zip').onchange = (e) => doImport(e.target.files, false);

    // arrastar do computador para a árvore
    panel.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); panel.classList.add('drop'); } });
    panel.addEventListener('dragleave', (e) => { if (e.target === panel) panel.classList.remove('drop'); });
    panel.addEventListener('drop', (e) => {
      panel.classList.remove('drop');
      if (e.dataTransfer.files.length) { e.preventDefault(); const r = e.target.closest('.node.dir'); doImport(e.dataTransfer.files, false, r ? r.dataset.path : selectedDir); return; }
    });
    // arrastar dentro da árvore (mover)
    list.addEventListener('dragstart', (e) => { const r = e.target.closest('.node'); if (r) e.dataTransfer.setData('text/x-sk-path', r.dataset.path); });
    list.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/x-sk-path')) { e.preventDefault(); } });
    list.addEventListener('drop', (e) => {
      const from = e.dataTransfer.getData('text/x-sk-path'); if (!from) return;
      e.preventDefault();
      const r = e.target.closest('.node');
      const toDir = r ? (r.classList.contains('dir') ? r.dataset.path : fs().dirName(r.dataset.path)) : '';
      move(from, (toDir ? toDir + '/' : '') + fs().baseName(from));
    });
  }

  function render() {
    const P = fs().project;
    if (!P) { list.innerHTML = ''; return; }
    SK.$('#proj-title').textContent = P.name;
    const cur = SK.editor.current;
    const rows = [];
    const walk = (node, depth) => {
      for (const c of node.children) {
        const open = expanded.has(c.path);
        const t = c.dir ? null : fs().typeOf(c.path);
        const isSel = c.dir ? c.path === selectedDir : c.path === cur;
        rows.push('<div class="node ' + (c.dir ? 'dir' : 'file') + (isSel ? ' sel' : '') + '" role="treeitem" draggable="true" data-path="' + SK.esc(c.path) + '" style="--d:' + depth + '"' + (c.dir ? ' aria-expanded="' + open + '"' : '') + '>' +
          '<span class="tw">' + (c.dir ? (open ? '▾' : '▸') : '') + '</span>' +
          '<span class="ic ' + (c.dir ? 'ic-dir' : 'l-' + t.lang) + '">' + (c.dir ? (open ? '📂' : '📁') : (t.binary ? '▣' : (ICON[t.lang] || '≡'))) + '</span>' +
          '<span class="nm">' + SK.esc(c.name) + '</span>' +
          '<button class="more" data-more aria-label="Ações de ' + SK.esc(c.name) + '">⋯</button></div>');
        if (c.dir && open) walk(c, depth + 1);
      }
    };
    const tree = fs().tree();
    walk(tree, 0);
    list.innerHTML = rows.join('') || '<div class="empty-tree"><p>Projeto vazio.</p><p>Use <b>＋📄</b> para criar um arquivo ou <b>⤒</b> para importar arquivos, uma pasta ou um .zip.</p></div>';
    const n = fs().list().length;
    SK.$('#tree-foot').textContent = SK.fmt(n) + ' arquivo' + (n === 1 ? '' : 's') + ' · ' + SK.bytes(fs().totalSize());
  }

  function targetDir() {
    if (selectedDir && fs().isFolder(selectedDir)) return selectedDir;
    const cur = SK.editor.current;
    return cur ? fs().dirName(cur) : '';
  }

  async function onClick(e) {
    const tool = e.target.closest('[data-t]');
    if (tool) { e.stopPropagation(); return toolbar(tool.dataset.t, tool); }
    const row = e.target.closest('.node');
    if (!row) { selectedDir = ''; render(); return; }
    if (e.target.closest('[data-more]')) { const b = e.target.getBoundingClientRect(); openMenu(row, b.left, b.bottom); return; }
    const path = row.dataset.path;
    if (row.classList.contains('dir')) {
      expanded.has(path) ? expanded.delete(path) : expanded.add(path);
      selectedDir = path;
      SK.pref.set('expanded', [...expanded]);
      render();
    } else {
      selectedDir = fs().dirName(path);
      SK.editor.open(path);
      SK.emit('tree-picked', path);
    }
  }

  async function toolbar(t, btn) {
    if (t === 'new-file') return newFile(targetDir());
    if (t === 'new-dir') return newDir(targetDir());
    if (t === 'collapse') { expanded.clear(); SK.pref.set('expanded', []); render(); return; }
    if (t === 'export') return exportZip();
    if (t === 'import') {
      const b = btn.getBoundingClientRect();
      popup(b.left, b.bottom, [
        ['📄 Arquivos soltos', () => SK.$('#in-files').click()],
        ['📁 Uma pasta inteira', () => SK.$('#in-dir').click()],
        ['🗜 Um .zip ou .tar.gz do Replit (descompacta)', () => SK.$('#in-zip').click()],
      ]);
    }
  }

  async function newFile(dir) {
    const name = await SK.prompt('Nome do novo arquivo' + (dir ? ' (dentro de "' + dir + '")' : '') + '.\nPode usar pastas: css/estilo.css', 'novo.html', { title: 'Novo arquivo', okText: 'Criar' });
    if (!name) return;
    const path = fs().norm((dir ? dir + '/' : '') + name);
    if (fs().exists(path)) { SK.toast('Já existe "' + path + '"', 'error'); return; }
    fs().write(path, starter(path));
    expandTo(path);
    SK.editor.open(path);
  }
  async function newDir(dir) {
    const name = await SK.prompt('Nome da nova pasta' + (dir ? ' (dentro de "' + dir + '")' : ''), 'pasta', { title: 'Nova pasta', okText: 'Criar' });
    if (!name) return;
    const path = fs().norm((dir ? dir + '/' : '') + name);
    fs().mkdir(path);
    expandTo(path + '/x'); expanded.add(path); selectedDir = path; render();
  }
  function starter(path) {
    const e = fs().extOf(path);
    if (e === 'html' || e === 'htm') return '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Novo</title>\n</head>\n<body>\n  \n</body>\n</html>\n';
    return '';
  }
  function expandTo(path) { let d = fs().dirName(path); while (d) { expanded.add(d); d = fs().dirName(d); } SK.pref.set('expanded', [...expanded]); }

  async function rename(path) {
    const name = await SK.prompt('Novo nome:', fs().baseName(path), { title: 'Renomear', okText: 'Renomear' });
    if (!name || name === fs().baseName(path)) return;
    try { const np = fs().rename(path, (fs().dirName(path) ? fs().dirName(path) + '/' : '') + name); if (expanded.has(path)) { expanded.delete(path); expanded.add(np); } render(); }
    catch (e) { SK.toast(e.message, 'error'); }
  }
  async function moveAsk(path) {
    const to = await SK.prompt('Mover para (caminho completo, com o nome no final):', path, { title: 'Mover', okText: 'Mover' });
    if (to) move(path, to);
  }
  function move(from, to) {
    to = fs().norm(to);
    if (!to || to === from || to.startsWith(from + '/')) return;
    try { fs().rename(from, to); expandTo(to); render(); SK.toast('Movido para ' + to); }
    catch (e) { SK.toast(e.message, 'error'); }
  }
  async function remove(path) {
    const isDir = fs().isFolder(path) && !fs().exists(path);
    const ok = await SK.confirm(isDir ? 'Apagar a pasta "' + path + '" e tudo dentro dela?' : 'Apagar "' + path + '"?', { title: 'Apagar', okText: 'Apagar', danger: true });
    if (!ok) return;
    await SK.checkpoints?.auto('Antes de apagar ' + path);
    fs().remove(path);
    render();
    SK.toast('Apagado. Para desfazer, use 🕑 Checkpoints.');
  }
  async function downloadNode(path) {
    if (fs().exists(path)) { SK.download(fs().baseName(path), fs().blobOf(path)); return; }
    const entries = fs().list().filter((f) => f.startsWith(path + '/')).map((f) => ({ name: f.slice(path.length + 1), data: fs().bytesOf(f) }));
    SK.download(fs().baseName(path) + '.zip', await SK.zip.write(entries));
  }

  function openMenu(row, x, y) {
    const path = row.dataset.path;
    const isDir = row.classList.contains('dir');
    const items = [];
    if (isDir) {
      items.push(['📄 Novo arquivo aqui', () => newFile(path)], ['📁 Nova pasta aqui', () => newDir(path)], ['⤒ Importar para esta pasta', () => { selectedDir = path; SK.$('#in-files').click(); }]);
    } else {
      items.push(['📂 Abrir', () => SK.editor.open(path)], ['👁 Ver no preview', () => SK.preview?.show(path)]);
    }
    items.push(['✏️ Renomear', () => rename(path)], ['📑 Duplicar', () => { const t = fs().duplicate(path); expandTo(t); render(); }], ['↪ Mover para…', () => moveAsk(path)],
      ['⤓ Baixar', () => downloadNode(path)], ['📋 Copiar caminho', () => SK.copy(path)],
      ['🤖 Analisar com a IA', () => SK.emit('ai-analyze', path)], ['🗑 Apagar', () => remove(path), 'danger']);
    popup(x, y, items);
  }

  function popup(x, y, items) {
    closePopup();
    menu = document.createElement('div');
    menu.className = 'popup';
    menu.innerHTML = items.map((it, i) => '<button class="pop-item' + (it[2] ? ' ' + it[2] : '') + '" data-i="' + i + '">' + SK.esc(it[0]) + '</button>').join('');
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
    menu.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { closePopup(); items[+b.dataset.i][1](); } });
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  }
  function outside(e) { if (menu && !menu.contains(e.target)) closePopup(); }
  function closePopup() { if (menu) { menu.remove(); menu = null; document.removeEventListener('pointerdown', outside, true); } }

  async function doImport(files, _x, dir) {
    if (!files || !files.length) return;
    if (!fs().project) await fs().create('Projeto importado');
    SK.toast('Importando…');
    try {
      await SK.checkpoints?.auto('Antes de importar');
      const { count, encs } = await fs().importFiles(files, dir != null ? dir : selectedDir);
      const encTxt = Object.entries(encs).map(([k, v]) => v + ' ' + k).join(', ');
      SK.toast(SK.fmt(count) + ' arquivo(s) importado(s)' + (encTxt ? ' — ' + encTxt : ''));
      render();
      const idx = fs().list().find((f) => /(^|\/)index\.html?$/i.test(f));
      if (idx && !SK.editor.current) { expandTo(idx); SK.editor.open(idx, { noFocus: true }); }
    } catch (e) { SK.toast('Erro ao importar: ' + e.message, 'error'); }
    SK.$$('#in-files,#in-dir,#in-zip').forEach((i) => (i.value = ''));
  }
  async function exportZip() {
    const P = fs().project; if (!P) return;
    const blob = await fs().exportZip();
    SK.download(P.name.replace(/[\\/:*?"<>|]+/g, '_') + '.zip', blob);
  }

  SK.on('fs-change', (c) => { if (!c.silent || c.type !== 'edit') render(); });
  SK.on('file-open', (p) => { expandTo(p); render(); });
  SK.on('project-open', () => { selectedDir = ''; render(); });

  SK.tree = { build, render, newFile, newDir, exportZip, importFiles: doImport, popup, expandTo };
})(window.SK);
