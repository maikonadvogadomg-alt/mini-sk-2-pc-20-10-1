/* =========================================================================
   Mini SK — 70-search.js
   Buscar (e trocar) em todos os arquivos do projeto. Cada resultado mostra
   arquivo e linha com o trecho DESTACADO; tocar abre o arquivo já com o
   trecho selecionado. "Trocar tudo" cria um checkpoint antes.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  let box, results = [];

  function build(container) {
    box = container;
    box.innerHTML =
      '<div class="stack">' +
      '<input class="inp" id="s-q" type="search" placeholder="Procurar no projeto (ex.: replit, fetch, minhaFuncao)" spellcheck="false" autocomplete="off">' +
      '<input class="inp" id="s-r" type="text" placeholder="Trocar por… (opcional)" spellcheck="false" autocomplete="off">' +
      '<div class="row wrap">' +
      '<label class="chk"><input type="checkbox" id="s-case"> Maiúsc./minúsc.</label>' +
      '<label class="chk"><input type="checkbox" id="s-word"> Palavra inteira</label>' +
      '<label class="chk"><input type="checkbox" id="s-re"> Expressão regular</label>' +
      '</div>' +
      '<input class="inp" id="s-inc" type="text" placeholder="Só nestes arquivos (ex.: *.js, src/)" spellcheck="false">' +
      '<div class="row wrap"><button class="btn primary" id="s-go">Procurar</button><button class="btn" id="s-rep" disabled>Trocar tudo</button><span class="muted" id="s-sum"></span></div>' +
      '</div><div class="s-res" id="s-res"></div>';
    const run = SK.debounce(search, 250);
    SK.$('#s-q', box).addEventListener('input', run);
    ['#s-case', '#s-word', '#s-re', '#s-inc'].forEach((s) => SK.$(s, box).addEventListener('input', run));
    SK.$('#s-go', box).onclick = search;
    SK.$('#s-q', box).addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
    SK.$('#s-rep', box).onclick = replaceAll;
    SK.$('#s-res', box).addEventListener('click', (e) => {
      const r = e.target.closest('[data-i]'); if (!r) return;
      const hit = results[+r.dataset.i];
      SK.editor.reveal(hit.path, hit.line, hit.col, hit.len);
      SK.emit('picked-result');
    });
  }

  function makeRegex() {
    const q = SK.$('#s-q', box).value;
    if (!q) return null;
    const cs = SK.$('#s-case', box).checked, word = SK.$('#s-word', box).checked, isRe = SK.$('#s-re', box).checked;
    let src = isRe ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (word) src = '\\b' + src + '\\b';
    try { return new RegExp(src, 'g' + (cs ? '' : 'i')); } catch (e) { SK.$('#s-sum', box).textContent = 'Expressão inválida: ' + e.message; return null; }
  }
  function includeFilter() {
    const v = SK.$('#s-inc', box).value.trim();
    if (!v) return () => true;
    const parts = v.split(',').map((s) => s.trim()).filter(Boolean).map((g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§').replace(/\*/g, '[^/]*').replace(/§/g, '.*').replace(/\?/g, '.') + (g.endsWith('/') ? '' : '$'), 'i'));
    return (p) => parts.some((re) => re.test(p) || re.test(fs().baseName(p)));
  }

  function search() {
    const re = makeRegex();
    const res = SK.$('#s-res', box);
    results = [];
    if (!re) { res.innerHTML = ''; SK.$('#s-sum', box).textContent = ''; SK.$('#s-rep', box).disabled = true; return; }
    const inc = includeFilter();
    let files = 0;
    const groups = [];
    for (const path of fs().list()) {
      if (!inc(path)) continue;
      const text = fs().read(path);
      if (text == null) continue;
      const lines = text.split('\n');
      const hits = [];
      lines.forEach((ln, i) => {
        re.lastIndex = 0; let m;
        while ((m = re.exec(ln)) && hits.length < 500) {
          hits.push({ path, line: i + 1, col: m.index + 1, len: m[0].length, text: ln });
          if (!m[0].length) re.lastIndex++;
        }
      });
      if (hits.length) { files++; groups.push([path, hits]); }
    }
    let html = '';
    for (const [path, hits] of groups) {
      html += '<div class="s-file"><div class="s-path">' + SK.esc(path) + ' <span class="muted">(' + hits.length + ')</span></div>';
      for (const h of hits) {
        const i = results.push(h) - 1;
        const s = Math.max(0, h.col - 1 - 40);
        const pre = h.text.slice(s, h.col - 1), mid = h.text.slice(h.col - 1, h.col - 1 + h.len), post = h.text.slice(h.col - 1 + h.len, h.col - 1 + h.len + 80);
        html += '<button class="s-hit" data-i="' + i + '"><span class="s-ln">' + h.line + '</span><code>' + (s > 0 ? '…' : '') + SK.esc(pre) + '<mark>' + SK.esc(mid) + '</mark>' + SK.esc(post) + '</code></button>';
      }
      html += '</div>';
    }
    res.innerHTML = html || '<p class="muted">Nada encontrado.</p>';
    SK.$('#s-sum', box).textContent = results.length ? SK.fmt(results.length) + ' resultado(s) em ' + files + ' arquivo(s)' : '';
    SK.$('#s-rep', box).disabled = !results.length;
  }

  async function replaceAll() {
    const re = makeRegex(); if (!re) return;
    const rep = SK.$('#s-r', box).value;
    const n = results.length;
    const ok = await SK.confirm('Trocar ' + n + ' ocorrência(s) por "' + rep + '"? Um checkpoint será criado antes, para você poder voltar.', { title: 'Trocar tudo', okText: 'Trocar' });
    if (!ok) return;
    await SK.checkpoints.auto('Antes de trocar "' + SK.$('#s-q', box).value + '"');
    const inc = includeFilter();
    let changed = 0;
    for (const path of fs().list()) {
      if (!inc(path)) continue;
      const text = fs().read(path); if (text == null) continue;
      re.lastIndex = 0;
      const nt = text.replace(re, rep);
      if (nt !== text) { fs().write(path, nt); changed++; }
    }
    SK.toast('Trocado em ' + changed + ' arquivo(s)');
    search();
  }

  SK.search = {
    build, search,
    focus(term) { const q = SK.$('#s-q', box); if (term) { q.value = term; search(); } setTimeout(() => q.focus(), 50); },
  };
})(window.SK);
