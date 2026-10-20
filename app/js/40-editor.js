/* =========================================================================
   Mini SK — 40-editor.js
   O editor de código: abas, cores, números de linha, Tab/Enter inteligentes,
   ir para linha, selecionar um trecho (usado pela busca e pela IA).
   Imagens abrem como imagem; outros binários mostram tamanho e "Baixar".
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  let root, tabsEl, wrapEl, gutter, hl, ta, viewer, statusEl;
  let current = null;           // caminho aberto
  let wrap = SK.pref.get('wrap', false);
  let fontSize = SK.pref.get('fontSize', 13);

  function build() {
    root = SK.$('#editor-area');
    root.innerHTML =
      '<div id="tabs" class="tabs" role="tablist"></div>' +
      '<div class="ed" id="ed">' +
      '  <div class="ed-gutter" aria-hidden="true"><div class="ed-gutter-in"></div></div>' +
      '  <div class="ed-body">' +
      '    <pre class="ed-hl" aria-hidden="true"><code></code></pre>' +
      '    <textarea class="ed-ta" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Código"></textarea>' +
      '  </div>' +
      '  <div class="ed-viewer" hidden></div>' +
      '  <div class="ed-empty"><p><b>Nenhum arquivo aberto.</b></p><p>Abra um arquivo na árvore (☰ Arquivos) ou crie um novo.</p></div>' +
      '</div>' +
      '<div class="statusbar" id="statusbar"></div>';
    tabsEl = SK.$('#tabs'); wrapEl = SK.$('#ed'); gutter = SK.$('.ed-gutter-in'); hl = SK.$('.ed-hl code');
    ta = SK.$('.ed-ta'); viewer = SK.$('.ed-viewer'); statusEl = SK.$('#statusbar');
    applyPrefs();

    ta.addEventListener('input', onInput);
    ta.addEventListener('scroll', syncScroll);
    ta.addEventListener('keydown', onKey);
    ['click', 'keyup', 'select'].forEach((ev) => ta.addEventListener(ev, updateStatus));
    tabsEl.addEventListener('click', (e) => {
      const x = e.target.closest('[data-close]');
      if (x) { e.stopPropagation(); close(x.dataset.close); return; }
      const t = e.target.closest('[data-path]');
      if (t) open(t.dataset.path);
    });
    tabsEl.addEventListener('auxclick', (e) => { const t = e.target.closest('[data-path]'); if (t && e.button === 1) close(t.dataset.path); });
  }

  function applyPrefs() {
    wrapEl.classList.toggle('wrap', wrap);
    ta.setAttribute('wrap', wrap ? 'soft' : 'off');
    wrapEl.style.setProperty('--ed-font', fontSize + 'px');
  }

  // ── Desenhar ────────────────────────────────────────────────────────────────
  let hlPending = false;
  function paint() {
    if (!current) return;
    const text = ta.value;
    const lang = fs().typeOf(current).lang;
    hl.innerHTML = SK.highlight(text, lang) + '\n';
    const lines = text.split('\n').length;
    if (gutter.childElementCount !== lines) {
      let h = '';
      for (let i = 1; i <= lines; i++) h += '<div>' + i + '</div>';
      gutter.innerHTML = h;
    }
    syncScroll();
  }
  function paintSoon() {
    if (ta.value.length < 60000) { paint(); return; }
    if (hlPending) return;
    hlPending = true;
    setTimeout(() => { hlPending = false; paint(); }, 120);
  }
  function syncScroll() {
    const x = ta.scrollLeft, y = ta.scrollTop;
    hl.parentElement.style.transform = 'translate(' + -x + 'px,' + -y + 'px)';
    gutter.style.transform = 'translateY(' + -y + 'px)';
  }

  function renderTabs() {
    const P = fs().project;
    if (!P) { tabsEl.innerHTML = ''; return; }
    tabsEl.innerHTML = P.open.map((p) => {
      const t = fs().typeOf(p);
      return '<div class="tab' + (p === current ? ' on' : '') + '" data-path="' + SK.esc(p) + '" role="tab" aria-selected="' + (p === current) + '" title="' + SK.esc(p) + '">' +
        '<span class="dot l-' + t.lang + '"></span><span class="tab-name">' + SK.esc(fs().baseName(p)) + '</span>' +
        '<button class="tab-x" data-close="' + SK.esc(p) + '" aria-label="Fechar ' + SK.esc(fs().baseName(p)) + '">×</button></div>';
    }).join('');
    const on = SK.$('.tab.on', tabsEl);
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function updateStatus() {
    if (!current) { statusEl.innerHTML = ''; return; }
    const r = fs().get(current);
    const t = fs().typeOf(current);
    let pos = '';
    if (!viewer.hidden) pos = '';
    else {
      const before = ta.value.slice(0, ta.selectionStart);
      const ln = before.split('\n').length, col = ta.selectionStart - before.lastIndexOf('\n');
      const sel = ta.selectionEnd - ta.selectionStart;
      pos = 'Linha ' + ln + ', Col ' + col + (sel ? ' (' + sel + ' selecionados)' : '') + ' · ' + SK.fmt(ta.value.split('\n').length) + ' linhas';
    }
    statusEl.innerHTML = '<span>' + SK.esc(pos) + '</span><span>' + SK.esc(t.label) + '</span><span>' + SK.esc(r ? r.enc || 'UTF-8' : '') + '</span><span>' + SK.bytes(r ? r.size || 0 : 0) + '</span>';
  }

  // ── Abrir / fechar ──────────────────────────────────────────────────────────
  function open(path, opts) {
    const P = fs().project;
    if (!P || !fs().exists(path)) return;
    if (!P.open.includes(path)) P.open.push(path);
    current = path;
    fs().setOpen(P.open, path);
    const rec = fs().get(path);
    const t = fs().typeOf(path);
    SK.$('.ed-empty', wrapEl).hidden = true;
    if (rec.b64 != null) {
      SK.$('.ed-body', wrapEl).hidden = true; SK.$('.ed-gutter', wrapEl).hidden = true;
      viewer.hidden = false;
      const isImg = /^image\//.test(t.mime);
      viewer.innerHTML = '<div class="viewer-in">' +
        (isImg ? '<img alt="' + SK.esc(path) + '" src="data:' + t.mime + ';base64,' + rec.b64 + '">' : '<p class="muted">Arquivo binário (' + SK.esc(t.ext.toUpperCase() || '?') + ') — não dá para editar como texto.</p>') +
        '<p class="muted">' + SK.esc(path) + ' · ' + SK.bytes(rec.size || 0) + '</p><button class="btn" data-act="dl">Baixar</button></div>';
      SK.$('[data-act="dl"]', viewer).onclick = () => SK.download(fs().baseName(path), fs().blobOf(path));
    } else {
      viewer.hidden = true;
      SK.$('.ed-body', wrapEl).hidden = false; SK.$('.ed-gutter', wrapEl).hidden = wrap;
      if (ta.value !== rec.text || ta.dataset.path !== path) { ta.value = rec.text; ta.dataset.path = path; ta.scrollTop = 0; ta.scrollLeft = 0; }
      paint();
      if (!(opts && opts.noFocus) && window.matchMedia('(min-width: 900px)').matches) ta.focus({ preventScroll: true });
    }
    renderTabs(); updateStatus();
    SK.emit('file-open', path);
  }
  function close(path) {
    const P = fs().project;
    if (!P) return;
    const i = P.open.indexOf(path);
    if (i < 0) return;
    P.open.splice(i, 1);
    if (current === path) {
      current = P.open[Math.min(i, P.open.length - 1)] || null;
      if (current) open(current, { noFocus: true }); else showEmpty();
    }
    fs().setOpen(P.open, current);
    renderTabs();
  }
  function showEmpty() {
    current = null; ta.value = ''; ta.dataset.path = ''; hl.innerHTML = ''; gutter.innerHTML = '';
    SK.$('.ed-body', wrapEl).hidden = true; SK.$('.ed-gutter', wrapEl).hidden = true; viewer.hidden = true;
    SK.$('.ed-empty', wrapEl).hidden = false;
    renderTabs(); updateStatus();
  }

  // ── Digitação ───────────────────────────────────────────────────────────────
  function onInput() {
    if (!current) return;
    fs().write(current, ta.value, { silent: true });
    paintSoon(); updateStatus();
    SK.emit('edit', current);
  }
  function insertText(text) {
    ta.focus();
    if (!document.execCommand || !document.execCommand('insertText', false, text)) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      onInput();
    }
  }
  function onKey(e) {
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      if (s !== en && ta.value.slice(s, en).includes('\n')) {
        // indentar/desindentar várias linhas
        const start = ta.value.lastIndexOf('\n', s - 1) + 1;
        const block = ta.value.slice(start, en);
        const changed = e.shiftKey ? block.replace(/^( {1,2}|\t)/gm, '') : block.replace(/^/gm, '  ');
        ta.setSelectionRange(start, en); insertText(changed); ta.setSelectionRange(start, start + changed.length);
      } else if (e.shiftKey) {
        const start = ta.value.lastIndexOf('\n', s - 1) + 1;
        if (ta.value.slice(start, start + 2) === '  ') { ta.setSelectionRange(start, start + 2); insertText(''); ta.setSelectionRange(s - 2, s - 2); }
      } else insertText('  ');
      return;
    }
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      const s = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
      const indent = /^[ \t]*/.exec(ta.value.slice(lineStart, s))[0];
      const prev = ta.value[s - 1], next = ta.value[s];
      e.preventDefault();
      if ((prev === '{' && next === '}') || (prev === '(' && next === ')') || (prev === '[' && next === ']') || (prev === '>' && next === '<' && /<\w[^>]*>$/.test(ta.value.slice(lineStart, s)))) {
        insertText('\n' + indent + '  \n' + indent);
        ta.setSelectionRange(s + indent.length + 3, s + indent.length + 3);
      } else insertText('\n' + indent + (/[{([]$/.test(ta.value.slice(lineStart, s).trimEnd()) ? '  ' : ''));
      return;
    }
    const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
    if (pairs[e.key] && !e.ctrlKey && !e.metaKey && ta.selectionStart !== ta.selectionEnd) {
      e.preventDefault();
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      insertText(e.key + sel + pairs[e.key]);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); goToLinePrompt(); }
  }

  async function goToLinePrompt() {
    const v = await SK.prompt('Ir para a linha:', '');
    const n = parseInt(v, 10);
    if (n > 0) reveal(current, n);
  }

  /** Abre o arquivo e seleciona (linha, coluna, tamanho) — usado pela busca e pela IA. */
  function reveal(path, line, col, len) {
    open(path, { noFocus: true });
    if (!viewer.hidden) return;
    const lines = ta.value.split('\n');
    let pos = 0;
    for (let i = 0; i < Math.min(line - 1, lines.length); i++) pos += lines[i].length + 1;
    const start = pos + Math.max(0, (col || 1) - 1);
    const end = start + (len || (col ? 0 : (lines[line - 1] || '').length));
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(start, end);
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    ta.scrollTop = Math.max(0, (line - 4) * lh);
    syncScroll(); updateStatus();
    // pisca a linha
    wrapEl.style.setProperty('--flash-top', ((line - 1) * lh - ta.scrollTop + 8) + 'px');
    wrapEl.classList.remove('flash'); void wrapEl.offsetWidth; wrapEl.classList.add('flash');
  }

  // ── Reações a mudanças nos arquivos ─────────────────────────────────────────
  SK.on('fs-change', (c) => {
    const P = fs().project;
    if (!P) return;
    if (c.type === 'rename' && current && (current === c.from || current.startsWith(c.from + '/'))) current = P.active;
    if (current && !fs().exists(current)) { current = P.open[0] || null; current ? open(current, { noFocus: true }) : showEmpty(); return; }
    if (current && !c.silent && (c.type === 'edit' || c.type === 'restore' || c.type === 'import' || c.type === 'create') && (!c.path || c.path === current)) {
      const rec = fs().get(current);
      if (rec && rec.text != null && rec.text !== ta.value) { const s = ta.selectionStart; ta.value = rec.text; ta.setSelectionRange(Math.min(s, ta.value.length), Math.min(s, ta.value.length)); paint(); }
    }
    renderTabs(); updateStatus();
  });
  SK.on('project-open', (P) => {
    current = null;
    if (P.active && fs().exists(P.active)) open(P.active, { noFocus: true }); else if (P.open[0]) open(P.open[0], { noFocus: true }); else showEmpty();
    renderTabs();
  });

  SK.editor = {
    build, open, close, reveal, insertText,
    get current() { return current; },
    get textarea() { return ta; },
    selection() { return current && viewer.hidden ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : ''; },
    toggleWrap() { wrap = !wrap; SK.pref.set('wrap', wrap); applyPrefs(); if (current) open(current, { noFocus: true }); SK.toast(wrap ? 'Quebra de linha ligada' : 'Quebra de linha desligada'); },
    zoom(d) { fontSize = Math.max(10, Math.min(24, fontSize + d)); SK.pref.set('fontSize', fontSize); applyPrefs(); paint(); },
    goToLine: goToLinePrompt,
    refresh: paint,
  };
})(window.SK);
