/* =========================================================================
   Mini SK — 92-playground.js
   ▶️ Playground isolado, que abre ao lado (não é a primeira tela).
   Vem do CodeLens, sem servidor:
   - HTML (+ CSS + JS), React (JSX) e Python (no próprio navegador).
   - Rodar ao vivo, console embaixo e tela cheia.
   - Salvos: guardados no banco do navegador; abrir, renomear e apagar.
   - Pegar do arquivo aberto, mandar para o projeto, copiar e baixar .html.
   React e Python precisam de internet na primeira vez (baixam o motor);
   o HTML funciona sem internet.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const KEY_CUR = 'play:atual', KEY_LIST = 'play:salvos';
  const CDN = {
    react: 'https://unpkg.com/react@18/umd/react.development.js',
    reactDom: 'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
    babel: 'https://unpkg.com/@babel/standalone@7/babel.min.js',
    pyodide: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js',
  };
  const DEF = {
    html: '<div style="max-width:600px;margin:40px auto;padding:20px;font-family:sans-serif">\n  <h1>Olá!</h1>\n  <p>Escreva ou cole seu HTML aqui e veja o resultado ao vivo.</p>\n  <button onclick="alert(\'Funcionou!\')">Clique aqui</button>\n</div>',
    css: '',
    js: '// JavaScript extra\nconsole.log("Playground pronto!");',
    jsx: '// O componente App() aparece sozinho na tela\nconst { useState } = React;\n\nfunction App() {\n  const [n, setN] = useState(0);\n  return (\n    <div style={{textAlign:"center",fontFamily:"sans-serif",marginTop:40}}>\n      <h1>React</h1>\n      <div style={{fontSize:48}}>{n}</div>\n      <button onClick={() => setN(n + 1)}>+1</button>\n    </div>\n  );\n}',
    python: '# Use print() para ver o resultado\nimport math\n\ndados = [10, 25, 3, 47, 8, 15]\nprint("Maior:", max(dados))\nprint("Média:", sum(dados) / len(dados))\nprint("Raiz de 2:", round(math.sqrt(2), 6))',
  };
  const TABS = { html: ['html', 'css', 'js'], react: ['jsx'], python: ['python'] };
  const TAB_NAME = { html: 'HTML', css: 'CSS', js: 'JS', jsx: 'JSX', python: 'Python' };

  let el, S = null, tab = 'html', auto = true, timer = null, list = [];

  function fresh() { return { id: null, title: 'Sem título', mode: 'html', html: DEF.html, css: DEF.css, js: DEF.js, jsx: DEF.jsx, python: DEF.python }; }
  const saveCur = SK.debounce(() => { SK.db.put('kv', S, KEY_CUR).catch(() => {}); }, 600);

  // ── Monta a página que roda dentro do quadro ────────────────────────────────
  const SHIM = '<script>(function(){' +
    'function M(){var d={};return{getItem:function(k){return k in d?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}' +
    'try{localStorage.getItem("x")}catch(e){try{Object.defineProperty(window,"localStorage",{value:M()});Object.defineProperty(window,"sessionStorage",{value:M()})}catch(_){}}' +
    'function s(v){try{return typeof v==="object"?JSON.stringify(v):String(v)}catch(e){return String(v)}}' +
    'function p(k,a){try{parent.postMessage({skPlay:1,k:k,t:[].map.call(a,s).join(" ")},"*")}catch(e){}}' +
    '["log","info","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){p(k,arguments);o&&o.apply(console,arguments)}});' +
    'window.onerror=function(m,f,l){p("error",[m+(l?" (linha "+l+")":"")])};' +
    'window.onunhandledrejection=function(e){p("error",[e.reason&&e.reason.message||e.reason])};' +
    '})();<\/script>';
  const esc = (t) => String(t).replace(/<\/script/gi, '<\\/script');

  function prepJSX(code) {
    return code
      .replace(/^import\s+React[^;\n]*;?\s*$/gm, '')
      .replace(/^import\s+ReactDOM[^;\n]*;?\s*$/gm, '')
      .replace(/^import\s+\{[^}]*\}\s+from\s+['"]react(-dom(\/client)?)?['"];?\s*$/gm, '')
      .replace(/^export\s+default\s+function\s+(\w+)/gm, 'function $1')
      .replace(/^export\s+default\s+(\w+)\s*;?\s*$/gm, '')
      .replace(/^export\s+/gm, '');
  }

  function page(st) {
    if (st.mode === 'react') {
      return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + SHIM +
        '<script src="' + CDN.react + '"><\/script><script src="' + CDN.reactDom + '"><\/script><script src="' + CDN.babel + '"><\/script></head><body><div id="root"></div>' +
        '<script>if(!window.React||!window.Babel){document.body.innerHTML="<p style=\'font-family:sans-serif;padding:16px\'>Sem internet: o React precisa baixar o motor na primeira vez.</p>"}<\/script>' +
        '<script type="text/babel" data-presets="react">' + esc(prepJSX(st.jsx)) +
        '\n;try{const C=typeof App!=="undefined"?App:null;if(C){ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(C))}else{console.warn("Crie uma função App() para aparecer na tela.")}}catch(e){console.error(e.message)}<\/script></body></html>';
    }
    if (st.mode === 'python') {
      return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + SHIM +
        '<style>body{margin:0;background:#0f1420;color:#d8deea;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace}pre{margin:0;padding:12px;white-space:pre-wrap;word-break:break-word}.e{color:#ff8a95}.m{color:#8592ab}</style>' +
        '<script src="' + CDN.pyodide + '"><\/script></head><body><pre id="o"><span class="m">Carregando o Python… (na primeira vez demora um pouco)</span></pre>' +
        '<script>var o=document.getElementById("o");var code=' + JSON.stringify(st.python).replace(/</g, '\\u003c') + ';' +
        'function add(t,c){var s=document.createElement("span");if(c)s.className=c;s.textContent=t+"\\n";o.appendChild(s)}' +
        'if(!window.loadPyodide){o.innerHTML="";add("Sem internet: o Python precisa baixar o motor na primeira vez.","e")}else{' +
        'loadPyodide().then(async function(py){o.innerHTML="";py.setStdout({batched:function(t){add(t);console.log(t)}});py.setStderr({batched:function(t){add(t,"e");console.error(t)}});' +
        'try{await py.loadPackagesFromImports(code)}catch(e){}' +
        'try{var r=await py.runPythonAsync(code);if(r!==undefined&&r!==null)add(String(r));add("✔ terminou","m")}catch(e){add(String(e.message||e),"e");console.error(String(e.message||e).split("\\n").slice(-2).join(" "))}' +
        '}).catch(function(e){add("Não consegui carregar o Python: "+e.message,"e")})}<\/script></body></html>';
    }
    const h = st.html || '';
    if (/<html[\s>]/i.test(h)) {
      let d = h;
      d = /<head[^>]*>/i.test(d) ? d.replace(/<head([^>]*)>/i, '<head$1>' + SHIM) : d.replace(/<html([^>]*)>/i, '<html$1>' + SHIM);
      if (st.css.trim()) d = /<\/head>/i.test(d) ? d.replace(/<\/head>/i, '<style>' + st.css + '</style></head>') : d + '<style>' + st.css + '</style>';
      if (st.js.trim()) d = /<\/body>/i.test(d) ? d.replace(/<\/body>(?![\s\S]*<\/body>)/i, '<script>' + esc(st.js) + '<\/script></body>') : d + '<script>' + esc(st.js) + '<\/script>';
      return d;
    }
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + SHIM +
      '<style>' + st.css + '</style></head><body>' + h + '<script>' + esc(st.js) + '<\/script></body></html>';
  }
  // Versão para baixar ou mandar para o projeto (sem o "espião" do console)
  function cleanPage(st) { return page(st).split(SHIM).join(''); }

  function detectMode(code) {
    const c = code.trim();
    if (/^\s*<(!doctype|html|head|body|div|section|main|style|script|p|h\d|span|button|form|table)\b/i.test(c)) return 'html';
    if (/from\s+['"]react['"]|import\s+React|useState|useEffect|ReactDOM/.test(c) || /return\s*\(\s*</.test(c)) return 'react';
    if (!/[<{};]\s*$/m.test(c) && /^(def |class |import |from |print\(|for .+:\s*$|if .+:\s*$)/m.test(c)) return 'python';
    return null;
  }

  // ── Tela ────────────────────────────────────────────────────────────────────
  function build(pane) {
    el = pane;
    el.innerHTML =
      '<div class="pg-top">' +
        '<input class="inp pg-title" id="pg-title" aria-label="Nome" placeholder="Nome">' +
        '<div class="seg pg-mode" id="pg-mode" role="tablist">' +
          '<button class="seg-b" data-m="html">🌐 HTML</button><button class="seg-b" data-m="react">⚛️ React</button><button class="seg-b" data-m="python">🐍 Python</button>' +
        '</div>' +
      '</div>' +
      '<div class="pg-tabs" id="pg-tabs"></div>' +
      '<textarea class="inp pg-code" id="pg-code" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Código"></textarea>' +
      '<div class="pg-bar">' +
        '<button class="btn primary" id="pg-run">▶ Rodar</button>' +
        '<label class="chk"><input type="checkbox" id="pg-auto"> ao vivo</label>' +
        '<button class="btn" id="pg-full" title="Tela cheia">⛶</button>' +
        '<button class="btn" id="pg-save">💾 Salvar</button>' +
        '<button class="btn" id="pg-new" title="Começar do zero">＋ Novo</button>' +
      '</div>' +
      '<div class="pg-frame-wrap"><iframe id="pg-frame" title="Resultado" sandbox="allow-scripts allow-modals allow-forms allow-popups"></iframe></div>' +
      '<div class="pg-con" id="pg-con" aria-live="polite"></div>' +
      '<details class="pg-more"><summary>Mais: arquivo, projeto, baixar</summary><div class="pg-bar">' +
        '<button class="btn" id="pg-from">📥 Pegar do arquivo aberto</button>' +
        '<button class="btn" id="pg-to">📄 Mandar para o projeto</button>' +
        '<button class="btn" id="pg-import">⤒ Abrir .html/.py</button>' +
        '<button class="btn" id="pg-dl">⤓ Baixar</button>' +
        '<button class="btn" id="pg-copy">📋 Copiar</button>' +
        '<input type="file" id="pg-file" accept=".html,.htm,.jsx,.tsx,.js,.py,.txt" hidden>' +
      '</div></details>' +
      '<div class="pg-saved"><div class="pg-saved-h"><b>💾 Salvos <span class="muted small" id="pg-count"></span></b><input class="inp" id="pg-q" placeholder="Procurar…" aria-label="Procurar nos salvos"></div>' +
        '<div class="pg-bar"><button class="btn small" id="pg-many" title="Vários .html de uma vez, ou um .zip com todos">⤒ Importar vários (.html ou .zip)</button><button class="btn small" id="pg-backup" title="Baixa todos os salvos num .zip">⤓ Cópia de segurança</button></div>' +
        '<input type="file" id="pg-many-file" multiple accept=".html,.htm,.jsx,.tsx,.py,.zip,.json" hidden>' +
        '<div id="pg-list"></div></div>';

    const $ = (s) => el.querySelector(s);
    $('#pg-title').oninput = (e) => { S.title = e.target.value; saveCur(); };
    $('#pg-mode').onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) setMode(b.dataset.m); };
    $('#pg-tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; paintTabs(); } };
    const code = $('#pg-code');
    code.oninput = () => { S[tab] = code.value; saveCur(); if (auto) { clearTimeout(timer); timer = setTimeout(run, S.mode === 'html' ? 500 : 1200); } };
    code.onkeydown = (e) => {
      if (e.key === 'Tab') { e.preventDefault(); const a = code.selectionStart; code.setRangeText('  ', a, code.selectionEnd, 'end'); code.oninput(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopPropagation(); saveSnippet(); }
    };
    code.addEventListener('paste', () => {
      const before = code.value, main = TABS[S.mode][0];
      if (tab !== main) return;
      setTimeout(() => {
        const txt = code.value, m = detectMode(txt);
        if (m && m !== S.mode && txt.length > 20) {
          S[main] = before; // o modo antigo fica como estava
          setMode(m, txt);
          SK.toast('Parece ' + (m === 'react' ? 'React' : m === 'python' ? 'Python' : 'HTML') + ': mudei o modo');
        }
      });
    });
    $('#pg-auto').onchange = (e) => { auto = e.target.checked; SK.pref.set('playAuto', auto); };
    $('#pg-run').onclick = run;
    $('#pg-full').onclick = full;
    $('#pg-save').onclick = saveSnippet;
    $('#pg-new').onclick = async () => { if (!(await SK.confirm('Começar um código novo? O que está aqui some (se não salvou).', { okText: 'Começar' }))) return; S = fresh(); tab = 'html'; paintAll(); run(); saveCur(); };
    $('#pg-from').onclick = fromFile;
    $('#pg-to').onclick = toProject;
    $('#pg-import').onclick = () => $('#pg-file').click();
    $('#pg-file').onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      const t = await f.text(); loadText(t, f.name);
    };
    $('#pg-dl').onclick = () => {
      const n = slug(S.title);
      if (S.mode === 'python') SK.download(n + '.py', S.python, 'text/x-python');
      else SK.download(n + '.html', cleanPage(S), 'text/html');
    };
    $('#pg-copy').onclick = () => SK.copy(S.mode === 'python' ? S.python : S.mode === 'react' ? S.jsx : cleanPage(S)).then(() => SK.toast('Copiado'));
    $('#pg-q').oninput = renderList;
    $('#pg-many').onclick = () => $('#pg-many-file').click();
    $('#pg-many-file').onchange = async (e) => { const fl = Array.from(e.target.files || []); e.target.value = ''; if (fl.length) await importMany(fl); };
    $('#pg-backup').onclick = backup;
    $('#pg-list').onclick = onListClick;

    window.addEventListener('message', (e) => {
      const d = e.data; if (!d || !d.skPlay) return;
      const fr = $('#pg-frame'), big = document.getElementById('pg-big-frame');
      if (e.source !== (fr && fr.contentWindow) && e.source !== (big && big.contentWindow)) return;
      log(d.k, d.t);
    });

    auto = SK.pref.get('playAuto', true);
    $('#pg-auto').checked = auto;
    Promise.all([SK.db.get('kv', KEY_CUR).catch(() => null), SK.db.get('kv', KEY_LIST).catch(() => null)]).then(([cur, l]) => {
      S = Object.assign(fresh(), cur || {});
      list = Array.isArray(l) ? l : [];
      tab = TABS[S.mode][0];
      paintAll(); renderList();
    });
  }

  const slug = (t) => (String(t || 'playground').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'playground');

  function setMode(m, pasted) {
    S.mode = m; tab = TABS[m][0];
    if (pasted != null) S[tab] = pasted;
    paintAll(); saveCur(); run();
  }
  function paintTabs() {
    const tabs = TABS[S.mode];
    el.querySelector('#pg-tabs').innerHTML = tabs.length > 1 ? tabs.map((t) => '<button class="pg-tab' + (t === tab ? ' on' : '') + '" data-t="' + t + '">' + TAB_NAME[t] + '</button>').join('') : '';
    const code = el.querySelector('#pg-code');
    code.value = S[tab] || '';
    code.placeholder = tab === 'css' ? 'CSS (opcional)' : tab === 'js' ? 'JavaScript (opcional)' : 'Cole ou escreva o código aqui';
  }
  function paintAll() {
    el.querySelector('#pg-title').value = S.title || '';
    el.querySelectorAll('#pg-mode [data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === S.mode));
    paintTabs();
  }

  function clearCon() { el.querySelector('#pg-con').innerHTML = ''; }
  function log(k, t) {
    const c = el.querySelector('#pg-con');
    const d = document.createElement('div'); d.className = 'pg-l ' + k; d.textContent = (k === 'error' ? '✖ ' : k === 'warn' ? '⚠ ' : '› ') + t;
    c.appendChild(d); while (c.childNodes.length > 200) c.removeChild(c.firstChild);
    c.scrollTop = c.scrollHeight;
  }
  function run() {
    if (!S) return;
    clearTimeout(timer); clearCon();
    el.querySelector('#pg-frame').srcdoc = page(S);
    const big = document.getElementById('pg-big-frame'); if (big) big.srcdoc = page(S);
  }
  function full() {
    const w = document.createElement('div'); w.className = 'pg-big';
    w.innerHTML = '<div class="pg-big-bar"><b>' + SK.esc(S.title) + '</b><span style="flex:1"></span><button class="btn" data-x="run">▶ Rodar de novo</button><button class="btn primary" data-x="close">✕ Fechar</button></div>' +
      '<iframe id="pg-big-frame" title="Resultado em tela cheia" sandbox="allow-scripts allow-modals allow-forms allow-popups"></iframe>';
    document.body.appendChild(w);
    w.querySelector('iframe').srcdoc = page(S);
    const close = () => { w.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    w.onclick = (e) => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'close') close(); else w.querySelector('iframe').srcdoc = page(S); };
  }

  // ── Salvos ──────────────────────────────────────────────────────────────────
  async function persistList() { try { await SK.db.put('kv', list, KEY_LIST); SK.emit('play-salvos', list); } catch (e) { SK.toast('Não consegui salvar: ' + e.message, 'error'); throw e; } }
  async function saveSnippet() {
    if (!S.title || S.title === 'Sem título') {
      const n = await SK.prompt('Nome para salvar:', S.title === 'Sem título' ? '' : S.title, { okText: 'Salvar' });
      if (n == null) return; S.title = n.trim() || 'Sem título'; el.querySelector('#pg-title').value = S.title;
    }
    const now = Date.now();
    const rec = { id: S.id || SK.uid(), title: S.title, mode: S.mode, html: S.html, css: S.css, js: S.js, jsx: S.jsx, python: S.python, updated: now };
    S.id = rec.id;
    const i = list.findIndex((x) => x.id === rec.id);
    if (i >= 0) list[i] = rec; else list.unshift(rec);
    await persistList(); saveCur(); renderList();
    SK.toast('Salvo: ' + rec.title, 'ok');
  }
  // ── Importar vários e cópia de segurança ───────────────────────────────────
  const CODE_RE = /\.(html?|jsx|tsx|py)$/i;
  function recFromText(t, name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const m = ext === 'py' ? 'python' : /^(jsx|tsx)$/.test(ext) ? 'react' : 'html';
    const rec = Object.assign(fresh(), { id: SK.uid(), title: name.replace(/\.[^.]+$/, ''), mode: m, updated: Date.now() });
    if (m === 'html') { rec.html = t; rec.css = ''; rec.js = ''; } else rec[TABS[m][0]] = t;
    return rec;
  }
  const sameAs = (a, b) => a.title === b.title && a.mode === b.mode && a.html === b.html && a.jsx === b.jsx && a.python === b.python;
  async function importMany(files) {
    const found = [];
    const take = (name, bytes) => {
      if (/(^|\/)(__MACOSX|node_modules|\.git)\//.test(name)) return;
      if (/(^|\/)playground-salvos\.json$/i.test(name)) {
        try { const arr = JSON.parse(fs().decodeBytes(bytes).text); if (Array.isArray(arr)) arr.forEach((x) => x && x.title && found.push(Object.assign(fresh(), x))); } catch {}
        return;
      }
      if (!CODE_RE.test(name)) return;
      found.push(recFromText(fs().decodeBytes(bytes).text, name.replace(/^\/+/, '')));
    };
    SK.toast('Lendo…');
    for (const f of files) {
      const u8 = new Uint8Array(await f.arrayBuffer());
      if (/\.zip$/i.test(f.name) || (u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 3 && u8[3] === 4)) {
        try {
          const ents = (await SK.zip.read(u8)).filter((e) => !e.name.endsWith('/'));
          const bk = ents.find((e) => /(^|\/)playground-salvos\.json$/i.test(e.name));
          // Cópia de segurança do próprio Playground: volta exatamente como era
          const top = ents.length > 1 && ents.every((e) => e.name.includes('/') && e.name.split('/')[0] === ents[0].name.split('/')[0]) ? ents[0].name.split('/')[0].length + 1 : 0;
          if (bk) take(bk.name, bk.data); else ents.forEach((e) => take(e.name.slice(top), e.data));
        } catch (er) { SK.toast(f.name + ': ' + er.message, 'error'); }
      }
      else take(f.webkitRelativePath || f.name, u8);
    }
    let add = 0, skip = 0;
    for (const x of found) {
      if (list.some((y) => y.id === x.id || sameAs(y, x)) || found.indexOf(x) !== found.findIndex((z) => sameAs(z, x))) { skip++; continue; }
      if (!x.id) x.id = SK.uid();
      list.push(x); add++;
    }
    if (!found.length) return SK.toast('Não achei nenhum .html, .jsx, .tsx ou .py ali.', 'warn');
    await persistList(); renderList();
    SK.toast('✅ ' + add + ' código(s) guardado(s) nos Salvos' + (skip ? ' · ' + skip + ' repetido(s) ignorado(s)' : ''), 'ok');
  }
  async function backup() {
    if (!list.length) return SK.toast('Nada salvo ainda.', 'warn');
    const enc = new TextEncoder(), used = new Set(), entries = [];
    const uniq = (n) => { let k = n, i = 2; while (used.has(k)) k = n.replace(/(\.[^.]+)$/, '-' + i++ + '$1'); used.add(k); return k; };
    for (const x of list) {
      const ext = x.mode === 'python' ? '.py' : x.mode === 'react' ? '.jsx' : '.html';
      const body = x.mode === 'python' ? x.python : x.mode === 'react' ? x.jsx : cleanPage(Object.assign(fresh(), x));
      entries.push({ name: uniq('codigos/' + slug(x.title) + ext), data: enc.encode(body) });
    }
    entries.push({ name: 'playground-salvos.json', data: enc.encode(JSON.stringify(list)) });
    entries.push({ name: 'LEIA-ME.txt', data: enc.encode('Cópia de segurança dos Salvos do Playground (Mini SK).\n\nPara voltar tudo: no Playground, toque em "⤒ Importar vários" e escolha este .zip.\nA pasta "codigos" tem cada código como arquivo, para abrir em qualquer lugar.\n') });
    const zip = await SK.zip.write(entries);
    SK.download('playground-salvos-' + new Date().toISOString().slice(0, 10) + '.zip', zip, 'application/zip');
    SK.toast('⤓ Cópia de segurança com ' + list.length + ' código(s). Guarde no Drive.', 'ok');
  }

  function renderList() {
    const box = el.querySelector('#pg-list'); if (!box) return;
    const cnt = el.querySelector('#pg-count'); if (cnt) cnt.textContent = list.length ? '(' + list.length + ')' : '';
    const q = (el.querySelector('#pg-q').value || '').toLowerCase();
    const items = list.filter((x) => !q || x.title.toLowerCase().includes(q)).sort((a, b) => b.updated - a.updated);
    if (!items.length) { box.innerHTML = '<p class="muted small">' + (list.length ? 'Nada com esse nome.' : 'Nada salvo ainda. Toque em 💾 Salvar para guardar o que está no editor.') + '</p>'; return; }
    const ico = { html: '🌐', react: '⚛️', python: '🐍' };
    box.innerHTML = items.map((x) =>
      '<div class="pg-item' + (S && x.id === S.id ? ' on' : '') + '" data-id="' + x.id + '">' +
        '<button class="pg-open" data-a="open" title="Abrir">' + (ico[x.mode] || '📄') + ' <span>' + SK.esc(x.title) + '</span><small>' + new Date(x.updated).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + '</small></button>' +
        '<button class="btn small" data-a="ren" title="Renomear">✏️</button>' +
        '<button class="btn small" data-a="dup" title="Duplicar">⧉</button>' +
        '<button class="btn small" data-a="del" title="Apagar">🗑</button>' +
      '</div>').join('');
  }
  async function onListClick(e) {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const id = b.closest('[data-id]').dataset.id, x = list.find((s) => s.id === id); if (!x) return;
    if (b.dataset.a === 'open') { S = Object.assign(fresh(), JSON.parse(JSON.stringify(x))); tab = TABS[S.mode][0]; paintAll(); renderList(); run(); saveCur(); SK.toast('Aberto: ' + x.title); }
    if (b.dataset.a === 'ren') { const n = await SK.prompt('Novo nome:', x.title, { okText: 'Renomear' }); if (n == null || !n.trim()) return; x.title = n.trim(); x.updated = Date.now(); if (S.id === x.id) { S.title = x.title; el.querySelector('#pg-title').value = x.title; saveCur(); } await persistList(); renderList(); }
    if (b.dataset.a === 'dup') { const c = Object.assign({}, x, { id: SK.uid(), title: x.title + ' (cópia)', updated: Date.now() }); list.unshift(c); await persistList(); renderList(); }
    if (b.dataset.a === 'del') { if (!(await SK.confirm('Apagar "' + x.title + '" dos salvos?', { okText: 'Apagar', danger: true }))) return; list = list.filter((s) => s.id !== id); if (S.id === id) S.id = null; await persistList(); renderList(); }
  }

  // ── Projeto ─────────────────────────────────────────────────────────────────
  function loadText(t, name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const m = ext === 'py' ? 'python' : /^(jsx|tsx)$/.test(ext) ? 'react' : /^html?$/.test(ext) ? 'html' : (detectMode(t) || 'html');
    S = Object.assign(fresh(), { title: name.replace(/\.[^.]+$/, ''), mode: m });
    if (m === 'html') { S.html = t; S.css = ''; S.js = ''; } else S[TABS[m][0]] = t;
    tab = TABS[m][0]; paintAll(); run(); saveCur(); renderList();
    SK.toast('Aberto no Playground: ' + name);
  }
  function fromFile() {
    const p = SK.editor.current;
    if (!p) return SK.toast('Abra um arquivo no editor primeiro', 'warn');
    const t = fs().read(p);
    if (t == null) return SK.toast('Esse arquivo não é texto', 'warn');
    loadText(t, p.split('/').pop());
  }
  async function toProject() {
    const ext = S.mode === 'python' ? '.py' : '.html';
    const def = 'playground/' + slug(S.title) + ext;
    const p = await SK.prompt('Gravar no projeto como:', def, { okText: 'Gravar' });
    if (p == null || !p.trim()) return;
    const path = p.trim().replace(/^\/+/, '');
    if (fs().read(path) != null && !(await SK.confirm('"' + path + '" já existe. Trocar pelo do Playground?', { okText: 'Trocar' }))) return;
    if (SK.checkpoints && SK.checkpoints.auto) { try { await SK.checkpoints.auto('Antes do Playground gravar ' + path); } catch {} }
    fs().write(path, S.mode === 'python' ? S.python : cleanPage(S));
    SK.editor.open(path);
    SK.toast('Gravado: ' + path, 'ok');
  }

  // A nuvem juntou os Salvos de outro aparelho: relê a lista
  SK.on('play-reload', async () => { try { const l = await SK.db.get('kv', KEY_LIST); if (Array.isArray(l)) { list = l; if (el) renderList(); } } catch {} });

  SK.playground = { build, run, page, detectMode, get state() { return S; } };
})(window.SK);
