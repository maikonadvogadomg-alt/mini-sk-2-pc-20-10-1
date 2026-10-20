/* =========================================================================
   Mini SK — 60-preview.js
   Preview ao vivo, sempre na parte de baixo (pode aumentar, diminuir ou
   esconder arrastando a barrinha). Monta a página com TODOS os arquivos do
   projeto: CSS, JS, imagens, módulos (import/export) e até fetch('dados.json').
   Mostra o console (erros e console.log) logo abaixo.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  let panel, frame, consoleEl, sel, autoBtn;
  let urls = [];
  let pinned = '';            // arquivo HTML fixado pelo usuário (vazio = automático)
  let auto = SK.pref.get('pvAuto', true);
  let size = SK.pref.get('pvSize', 'normal'); // min | normal | max
  let errors = 0;

  function build() {
    panel = SK.$('#preview-panel');
    panel.innerHTML =
      '<div class="pv-grip" title="Arraste para aumentar ou diminuir" aria-label="Redimensionar preview" role="separator"></div>' +
      '<div class="pv-head">' +
      '  <b class="pv-title">Preview</b>' +
      '  <select class="pv-sel" aria-label="Qual página mostrar"></select>' +
      '  <span class="pv-err" hidden></span>' +
      '  <div class="row tight pv-tools">' +
      '    <button class="icon-btn" data-p="auto" title="Atualizar sozinho enquanto digita">⚡</button>' +
      '    <button class="icon-btn" data-p="reload" title="Atualizar agora">⟳</button>' +
      '    <button class="icon-btn" data-p="console" title="Console (erros e logs)">▤</button>' +
      '    <button class="icon-btn" data-p="tab" title="Abrir em nova aba">↗</button>' +
      '    <button class="icon-btn" data-p="min" title="Diminuir">▁</button>' +
      '    <button class="icon-btn" data-p="max" title="Aumentar">▔</button>' +
      '  </div>' +
      '</div>' +
      '<div class="pv-body">' +
      '  <iframe class="pv-frame" title="Preview" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe>' +
      '  <div class="pv-console" hidden><div class="pv-console-head"><b>Console</b><button class="btn tiny" data-p="clear">Limpar</button></div><div class="pv-log"></div></div>' +
      '</div>';
    frame = SK.$('.pv-frame', panel); consoleEl = SK.$('.pv-console', panel); sel = SK.$('.pv-sel', panel); autoBtn = SK.$('[data-p="auto"]', panel);
    panel.addEventListener('click', onClick);
    sel.addEventListener('change', () => { pinned = sel.value; refresh(); });
    window.addEventListener('message', onMessage);
    setupGrip();
    applySize();
    autoBtn.classList.toggle('on', auto);
  }

  function onClick(e) {
    const b = e.target.closest('[data-p]'); if (!b) return;
    const p = b.dataset.p;
    if (p === 'reload') refresh();
    if (p === 'auto') { auto = !auto; SK.pref.set('pvAuto', auto); autoBtn.classList.toggle('on', auto); SK.toast(auto ? 'Preview ao vivo ligado' : 'Preview ao vivo desligado (use ⟳)'); if (auto) refresh(); }
    if (p === 'console') consoleEl.hidden = !consoleEl.hidden;
    if (p === 'clear') { SK.$('.pv-log', panel).innerHTML = ''; errors = 0; showErr(); }
    if (p === 'tab') openTab();
    if (p === 'min') { size = size === 'min' ? 'normal' : 'min'; applySize(); }
    if (p === 'max') { size = size === 'max' ? 'normal' : 'max'; applySize(); }
  }

  function applySize() {
    SK.pref.set('pvSize', size);
    document.body.dataset.pv = size;
    const h = SK.pref.get('pvHeight', 0);
    if (h && size === 'normal') document.documentElement.style.setProperty('--pv-h', h + 'px');
    else document.documentElement.style.removeProperty('--pv-h');
    if (size !== 'min') refresh();
  }

  function setupGrip() {
    const grip = SK.$('.pv-grip', panel);
    let startY = 0, startH = 0, dragging = false;
    grip.addEventListener('pointerdown', (e) => {
      dragging = true; startY = e.clientY; startH = panel.getBoundingClientRect().height;
      grip.setPointerCapture(e.pointerId); document.body.classList.add('dragging');
      if (size !== 'normal') { size = 'normal'; document.body.dataset.pv = 'normal'; }
    });
    grip.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const main = SK.$('#main').getBoundingClientRect().height;
      const h = Math.max(36, Math.min(main - 60, startH + (startY - e.clientY)));
      document.documentElement.style.setProperty('--pv-h', h + 'px');
    });
    const end = () => {
      if (!dragging) return;
      dragging = false; document.body.classList.remove('dragging');
      const h = panel.getBoundingClientRect().height;
      if (h < 60) { size = 'min'; SK.pref.set('pvHeight', 0); } else SK.pref.set('pvHeight', Math.round(h));
      applySize();
    };
    grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
    grip.addEventListener('dblclick', () => { size = size === 'max' ? 'normal' : 'max'; applySize(); });
  }

  // ── Qual página mostrar ─────────────────────────────────────────────────────
  function htmlFiles() { return fs().list().filter((f) => /\.html?$/i.test(f)); }
  function pickTarget() {
    if (pinned && fs().exists(pinned)) return pinned;
    const cur = SK.editor.current;
    const htmls = htmlFiles();
    if (cur && /\.(html?|md|markdown|svg|tsx|jsx)$/i.test(cur)) return cur;
    if (cur) { // procura um index.html na pasta do arquivo aberto, subindo
      let d = fs().dirName(cur);
      for (;;) { const c = (d ? d + '/' : '') + 'index.html'; if (fs().exists(c)) return c; if (!d) break; d = fs().dirName(d); }
      if (/\.(m?js|jsx?)$/i.test(cur) && !htmls.length) return cur;
    }
    return htmls.find((f) => /(^|\/)index\.html?$/i.test(f)) || htmls[0] || cur || '';
  }
  function fillSelect(target) {
    const htmls = fs().list().filter((f) => /\.(html?|tsx|jsx|md)$/i.test(f) && !/(^|\/)(node_modules|\.sk)\//.test(f)).sort((a, b) => (/\.html?$/i.test(b) - /\.html?$/i.test(a)) || a.localeCompare(b));
    sel.innerHTML = '<option value="">Automático' + (target ? ' (' + SK.esc(target) + ')' : '') + '</option>' + htmls.map((h) => '<option value="' + SK.esc(h) + '"' + (h === pinned ? ' selected' : '') + '>' + SK.esc(h) + '</option>').join('');
  }

  // ── Montar a página ─────────────────────────────────────────────────────────
  const isExternal = (u) => !u || /^(?:[a-z][\w+.-]*:|\/\/|#|data:|blob:|mailto:|tel:|javascript:)/i.test(u);
  function resolve(fromDir, ref) {
    const clean = ref.split('#')[0].split('?')[0];
    const p = clean.startsWith('/') ? fs().norm(clean) : fs().norm((fromDir ? fromDir + '/' : '') + clean);
    return p;
  }
  function revokeAll() { urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; }
  // Aberto direto do arquivo (file://) — e no APK, que quase sempre abre assim
  // (file:///android_asset, content://…) — o navegador não deixa o preview carregar
  // endereços blob:. Nesse caso cada arquivo vira um endereço data: e a PÁGINA entra
  // direto no quadro (srcdoc), que funciona em qualquer lugar.
  const DATA_MODE = !/^https?:$/.test(location.protocol);
  function mk(content, mime) {
    if (DATA_MODE) {
      const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
      return 'data:' + mime + (typeof content === 'string' ? ';charset=utf-8' : '') + ';base64,' + fs().toBase64(bytes);
    }
    const u = URL.createObjectURL(new Blob([content], { type: mime })); urls.push(u); return u;
  }
  function mkPage(html) { const u = URL.createObjectURL(new Blob([html], { type: 'text/html' })); urls.push(u); return u; }

  let cache;
  function fileURL(path, asModule) {
    const key = path + (asModule ? '#m' : '');
    if (cache.has(key)) return cache.get(key);
    const rec = fs().get(path); if (!rec) return null;
    const t = fs().typeOf(path);
    let url;
    cache.set(key, 'about:blank'); // evita laço infinito em import circular
    if (rec.b64 != null) url = mk(fs().bytesOf(path), t.mime);
    else if (t.ext === 'css') url = mk(rewriteCss(rec.text, fs().dirName(path)), 'text/css');
    else if (asModule || /\.(mjs)$/i.test(path)) url = mk(rewriteModule(rec.text, fs().dirName(path)), 'text/javascript');
    else if (t.lang === 'js') url = mk(rec.text, 'text/javascript');
    else url = mk(rec.text, t.mime === 'application/octet-stream' ? 'text/plain' : t.mime);
    cache.set(key, url);
    return url;
  }
  function rewriteCss(css, dir) {
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) => {
      if (isExternal(u)) return m;
      const p = resolve(dir, u); const url = fs().exists(p) ? fileURL(p) : null;
      return url ? 'url("' + url + '")' : m;
    }).replace(/@import\s+(['"])([^'"]+)\1/g, (m, q, u) => {
      if (isExternal(u)) return m;
      const p = resolve(dir, u); const url = fs().exists(p) ? fileURL(p) : null;
      return url ? '@import "' + url + '"' : m;
    });
  }
  function rewriteModule(js, dir) {
    const fix = (spec) => {
      if (!/^\.{0,2}\//.test(spec)) return null;
      let p = resolve(dir, spec);
      if (!fs().exists(p)) { for (const e of ['.js', '.mjs', '/index.js']) if (fs().exists(p + e)) { p = p + e; break; } }
      return fs().exists(p) ? fileURL(p, /\.(m?js|jsx?|ts)$/i.test(p)) : null;
    };
    return js
      .replace(/(\bimport\s+(?:[\w*{}\s,$]+\s+from\s+)?|\bexport\s+[\w*{}\s,$]+\s+from\s+)(['"])([^'"\n]+)\2/g, (m, a, q, spec) => { const u = fix(spec); return u ? a + q + u + q : m; })
      .replace(/\bimport\(\s*(['"])([^'"\n]+)\1\s*\)/g, (m, q, spec) => { const u = fix(spec); return u ? 'import(' + q + u + q + ')' : m; });
  }

  function consoleShim(map, baseDir) {
    return '<script>(function(){var P=parent,M=' + JSON.stringify(map) + ',B=' + JSON.stringify(baseDir) + ';' +
      // No preview aberto do arquivo (file://) o navegador bloqueia localStorage: damos um "de mentira" na memória
      'function MS(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}' +
      '["localStorage","sessionStorage"].forEach(function(n){try{window[n].getItem("x")}catch(e){try{Object.defineProperty(window,n,{value:MS(),configurable:true})}catch(_){}}});' +
      'function S(v){try{if(v instanceof Error)return v.stack||String(v);if(typeof v==="object")return JSON.stringify(v,null,1).slice(0,2000);return String(v)}catch(e){return String(v)}}' +
      '["log","info","warn","error","debug"].forEach(function(l){var o=console[l];console[l]=function(){try{P.postMessage({sk:"console",level:l,text:[].map.call(arguments,S).join(" ")},"*")}catch(e){}o&&o.apply(console,arguments)}});' +
      'addEventListener("error",function(e){P.postMessage({sk:"console",level:"error",text:(e.message||"Erro")+(e.lineno?" (linha "+e.lineno+")":"")},"*")});' +
      'addEventListener("unhandledrejection",function(e){P.postMessage({sk:"console",level:"error",text:"Promise rejeitada: "+S(e.reason)},"*")});' +
      'function R(u){if(typeof u!=="string"||/^(?:[a-z][\\w+.-]*:|\\/\\/)/i.test(u))return u;var p=(u.charAt(0)==="/"?u:(B?B+"/":"")+u).split("?")[0].split("#")[0].split("/"),o=[];p.forEach(function(s){if(!s||s===".")return;if(s==="..")o.pop();else o.push(s)});var k=o.join("/");return M[k]||u}' +
      'var F=window.fetch;window.fetch=function(u,i){return F.call(this,typeof u==="string"?R(u):u,i)};' +
      'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(!a||e.defaultPrevented||a.target==="_blank")return;var h=a.getAttribute("href");if(!h||h.charAt(0)==="#"||/^(?:[a-z][\\w+.-]*:|\\/\\/)/i.test(h))return;e.preventDefault();var p=(h.charAt(0)==="/"?h:(B?B+"/":"")+h).split("?")[0].split("#")[0].split("/"),o=[];p.forEach(function(s){if(!s||s===".")return;if(s==="..")o.pop();else o.push(s)});P.postMessage({sk:"nav",path:o.join("/")},"*")});' +
      'var X=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){arguments[1]=R(u);return X.apply(this,arguments)};' +
      '})();<\/script>';
  }

  function buildHtml(path) {
    const src = fs().read(path) || '';
    const dir = fs().dirName(path);
    const doc = new DOMParser().parseFromString(src, 'text/html');
    const attrFix = (el, attr, asModule) => {
      const v = el.getAttribute(attr); if (isExternal(v)) return;
      const p = resolve(dir, v); if (!fs().exists(p)) return;
      el.setAttribute(attr, fileURL(p, asModule));
    };
    doc.querySelectorAll('script[src]').forEach((s) => attrFix(s, 'src', s.type === 'module'));
    doc.querySelectorAll('script[type="module"]:not([src])').forEach((s) => { s.textContent = rewriteModule(s.textContent, dir); });
    doc.querySelectorAll('link[href]').forEach((l) => attrFix(l, 'href'));
    doc.querySelectorAll('img[src],source[src],video[src],audio[src],iframe[src],embed[src],track[src],input[src]').forEach((e) => attrFix(e, 'src'));
    doc.querySelectorAll('[poster]').forEach((e) => attrFix(e, 'poster'));
    doc.querySelectorAll('img[srcset],source[srcset]').forEach((e) => {
      e.setAttribute('srcset', e.getAttribute('srcset').split(',').map((part) => { const [u, d] = part.trim().split(/\s+/); if (isExternal(u)) return part; const p = resolve(dir, u); return fs().exists(p) ? fileURL(p) + (d ? ' ' + d : '') : part; }).join(', '));
    });
    doc.querySelectorAll('style').forEach((s) => { s.textContent = rewriteCss(s.textContent, dir); });
    doc.querySelectorAll('[style]').forEach((e) => e.setAttribute('style', rewriteCss(e.getAttribute('style'), dir)));
    // mapa para fetch('dados.json') funcionar
    const map = {};
    const all = fs().list();
    all.forEach((f) => {
      const dataLike = /\.(json|txt|csv|md|xml|svg|png|jpe?g|gif|webp|html?|wasm)$/i.test(f);
      if ((all.length > 400 || DATA_MODE) && !dataLike) return;
      const r = fs().get(f); if (r && (r.size || 0) < (DATA_MODE ? 6e5 : 3e6)) { try { map[f] = fileURL(f); } catch {} }
    });
    const html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    return html.replace(/<head([^>]*)>/i, (m) => m + consoleShim(map, dir));
  }

  // 📄 Markdown (ex.: PLANO.md): cada bloco de código ganha 📋 Copiar e ▶ Terminal,
  // tabelas viram tabela de verdade e dá para baixar como página HTML.
  function markdown(md, sozinho) {
    const esc = SK.esc;
    const blocos = [];
    md = String(md).replace(/\r\n?/g, '\n').replace(/^(\s*)```([\w+-]*)[^\n]*\n([\s\S]*?)^\s*```\s*$/gm, (m, ind, l, c) => { blocos.push({ l: l.toLowerCase(), c: c.replace(/\n$/, '') }); return '\n\u0000B' + (blocos.length - 1) + '\u0000\n'; });
    const inline = (t) => esc(t)
      .replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const linhas = md.split('\n'); const out = []; let i = 0;
    const celulas = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    while (i < linhas.length) {
      const l = linhas[i];
      let m;
      if ((m = l.match(/^\u0000B(\d+)\u0000$/))) {
        const b = blocos[+m[1]];
        const shell = /^(sh|bash|shell|zsh|console|cmd|powershell|ps1|bat)?$/.test(b.l) && b.c.split('\n').length <= 40;
        out.push('<div class="bloco"><div class="bloco-bar"><span>' + esc(b.l || 'código') + '</span><button data-copiar="' + m[1] + '">📋 Copiar</button>' + (shell ? '<button data-rodar="' + m[1] + '" class="so-app">▶ Terminal</button>' : '') + '</div><pre><code>' + esc(b.c) + '</code></pre></div>');
        i++; continue;
      }
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < linhas.length && /^\s*\|?\s*:?-{2,}/.test(linhas[i + 1])) {
        const cab = celulas(l); i += 2; const corpo = [];
        while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) corpo.push(celulas(linhas[i++]));
        out.push('<div class="tab"><table><thead><tr>' + cab.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' + corpo.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
        continue;
      }
      if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { out.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>'); i++; continue; }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (/^\s*>/.test(l)) { const q = []; while (i < linhas.length && /^\s*>/.test(linhas[i])) q.push(linhas[i++].replace(/^\s*>\s?/, '')); out.push('<blockquote>' + q.map(inline).join('<br>') + '</blockquote>'); continue; }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
        const ord = /^\s*\d/.test(l); const itens = [];
        while (i < linhas.length && /^\s*([-*+]|\d+[.)])\s+/.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, '').replace(/^\[ \]\s*/, '☐ ').replace(/^\[x\]\s*/i, '☑ '));
        out.push((ord ? '<ol>' : '<ul>') + itens.map((t) => '<li>' + inline(t) + '</li>').join('') + (ord ? '</ol>' : '</ul>')); continue;
      }
      if (!l.trim()) { i++; continue; }
      const par = []; while (i < linhas.length && linhas[i].trim() && !/^(#{1,6}\s|\s*\||\s*>|\s*([-*+]|\d+[.)])\s+|\u0000B)/.test(linhas[i])) par.push(linhas[i++]);
      if (!par.length) { out.push('<p>' + inline(l) + '</p>'); i++; continue; }
      out.push('<p>' + par.map(inline).join('<br>') + '</p>');
    }
    const css = 'body{font:16px/1.6 system-ui,sans-serif;max-width:860px;margin:0 auto;padding:12px 16px 40px;color:#1f2230;background:#fffdf8}h1,h2,h3{line-height:1.25}h2{border-bottom:1px solid #e3ddc8;padding-bottom:4px}code{background:#f1ede0;padding:1px 5px;border-radius:4px;font:14px ui-monospace,Consolas,monospace}.bloco{border:1px solid #d9d2bb;border-radius:8px;margin:10px 0;overflow:hidden}.bloco-bar{display:flex;gap:6px;align-items:center;background:#efe9d6;padding:5px 8px;font:600 12px ui-monospace,monospace;color:#6b6450}.bloco-bar span{flex:1}.bloco-bar button,.topo button{font:600 13px system-ui,sans-serif;border:1px solid #8a7b45;background:#fff;color:#4a4020;border-radius:6px;padding:5px 9px;cursor:pointer}.bloco pre{margin:0;padding:10px;overflow-x:auto;background:#fbf9f2}.bloco pre code{background:none;padding:0;white-space:pre}.tab{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px;margin:8px 0}th,td{border-bottom:1px solid #e3ddc8;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f6f2e4}blockquote{margin:8px 0;padding:6px 12px;border-left:4px solid #c9b77a;background:#faf6e8}.topo{position:sticky;top:0;background:#fffdf8;padding:8px 0;display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid #eee;margin-bottom:8px;z-index:2}a{color:#7a6526}';
    const dados = JSON.stringify(blocos.map((b) => b.c)).replace(/</g, '\\u003c');
    const js = 'var B=' + dados + ';var EMB=window.parent!==window;' +
      'if(!EMB)document.querySelectorAll(".so-app").forEach(function(b){b.remove()});' +
      'function marca(b,t){var a=b.textContent;b.textContent=t;setTimeout(function(){b.textContent=a},1400)}' +
      'function copiar(t,b){if(EMB){parent.postMessage({sk:"md",acao:"copiar",texto:t},"*");marca(b,"✔ Copiado");return}' +
      'navigator.clipboard.writeText(t).then(function(){marca(b,"✔ Copiado")},function(){var r=document.createRange();r.selectNodeContents(b.closest(".bloco").querySelector("pre"));var s=getSelection();s.removeAllRanges();s.addRange(r);marca(b,"Selecionado")})}' +
      'document.addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;' +
      'if(b.dataset.copiar!=null)copiar(B[+b.dataset.copiar],b);' +
      'if(b.dataset.rodar!=null){parent.postMessage({sk:"md",acao:"rodar",texto:B[+b.dataset.rodar]},"*");marca(b,"✔ Mandado")}' +
      'if(b.id==="md-baixar")parent.postMessage({sk:"md",acao:"baixar"},"*");' +
      'if(b.id==="md-todos"){var t=B.join("\\n\\n");copiar(t,b)}});';
    const topo = '<div class="topo">' + (sozinho ? '' : '<button id="md-baixar" class="so-app">⬇ Baixar como página HTML</button>') + (blocos.length ? '<button id="md-todos">📋 Copiar todos os blocos (' + blocos.length + ')</button>' : '') + '</div>';
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(sozinho || 'Markdown') + '</title><style>' + css + '</style></head><body>' + topo + out.join('\n') + '<script>' + js + '<\/script></body></html>';
  }
  let mdAtual = '';

  let lastUrl = '';
  function refresh() {
    if (!panel || !fs().project || size === 'min') return;
    const target = pickTarget();
    fillSelect(target);
    revokeAll(); cache = new Map();
    let html;
    if (target && /\.(tsx|jsx)$/i.test(target) && SK.tsx) { componente(target); return; }
    if (!target) html = '<!DOCTYPE html><html><body style="font:14px system-ui;color:#777;padding:16px">Crie ou abra um arquivo .html para ver o preview aqui.</body></html>';
    else if (/\.(md|markdown)$/i.test(target)) { mdAtual = target; html = markdown(fs().read(target) || ''); }
    else if (/\.svg$/i.test(target)) html = '<!DOCTYPE html><html><body style="margin:0;display:grid;place-items:center;min-height:100vh">' + (fs().read(target) || '') + '</body></html>';
    else if (/\.(m?js|jsx?)$/i.test(target)) html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font:14px system-ui;padding:12px"><p style="color:#777">Rodando ' + SK.esc(target) + ' — veja o console ▤</p><script src="' + SK.esc(target) + '"><\/script></body></html>';
    else html = null;
    try {
      if (html && /\.(m?js|jsx?)$/i.test(target)) { const tmpDir = fs().dirName(target); html = html.replace('src="' + SK.esc(target) + '"', 'src="' + fileURL(target) + '"'); html = html.replace('<head>', '<head>' + consoleShim({}, tmpDir)); }
      if (!html) html = buildHtml(target);
    } catch (e) { html = '<pre style="color:#c00;padding:12px">Erro ao montar o preview: ' + SK.esc(e.message) + '</pre>'; }
    errors = 0; showErr();
    lastUrl = mkPage(html);
    if (DATA_MODE) { frame.removeAttribute('src'); frame.srcdoc = html; }
    else { frame.removeAttribute('srcdoc'); frame.src = lastUrl; }
    SK.$('.pv-title', panel).textContent = 'Preview';
  }
  // ⚛️ um componente .tsx/.jsx sozinho (ver 61-tsx.js)
  let vez = 0;
  function mostrar(html) {
    lastUrl = mkPage(html);
    if (DATA_MODE) { frame.removeAttribute('src'); frame.srcdoc = html; }
    else { frame.removeAttribute('srcdoc'); frame.src = lastUrl; }
  }
  function componente(target) {
    const minha = ++vez;
    errors = 0; showErr();
    SK.$('.pv-title', panel).textContent = '⚛️ Componente';
    if (!window.Babel) mostrar('<!DOCTYPE html><html><body style="font:14px system-ui;color:#777;padding:16px">⏳ Baixando o tradutor de TSX (só na primeira vez)…</body></html>');
    SK.tsx.montar(target, { mk, shim: consoleShim({}, fs().dirName(target)), arquivo: (p) => fileURL(p) })
      .then((html) => { if (minha === vez) mostrar(html); })
      .catch((e) => { if (minha === vez) mostrar('<!DOCTYPE html><html><body style="font:14px/1.5 system-ui;padding:16px;color:#7a1a12;background:#fdecea;white-space:pre-wrap">❌ ' + SK.esc(e.message) + '</body></html>'); });
  }
  const refreshSoon = SK.debounce(() => { if (auto) refresh(); }, 650);

  function openTab() {
    if (!lastUrl) refresh();
    const w = window.open(lastUrl, '_blank');
    if (!w) SK.toast('O navegador bloqueou a nova aba', 'error');
  }

  function onMessage(e) {
    const d = e.data;
    if (!d || e.source !== frame.contentWindow) return;
    if (d.sk === 'nav') {
      // link para outra página do projeto: o preview vai para ela
      let p = String(d.path || '').replace(/\/$/, '');
      if (!fs().exists(p) && fs().exists((p ? p + '/' : '') + 'index.html')) p = (p ? p + '/' : '') + 'index.html';
      if (fs().exists(p)) { pinned = p; refresh(); SK.toast('Preview: ' + p); }
      else SK.toast('Página não existe no projeto: ' + d.path, 'error');
      return;
    }
    if (d.sk === 'md') {
      if (d.acao === 'copiar') { (navigator.clipboard ? navigator.clipboard.writeText(d.texto) : Promise.reject()).then(() => SK.toast('Copiado.'), () => SK.prompt('Copie:', d.texto)); return; }
      if (d.acao === 'rodar') {
        const cmd = String(d.texto || '').split('\n').filter((l) => l.trim() && !/^\s*#/.test(l)).join(' && ');
        if (SK.termux && SK.termux.ligado) { SK.termux.mandar(cmd); SK.toast('Mandado para o 📱 Termux.'); }
        else if (SK.node && SK.node.ligado) { SK.node.mandar(cmd); SK.toast('Mandado para o ⚡ Node.'); }
        else { (navigator.clipboard ? navigator.clipboard.writeText(cmd) : Promise.reject()).catch(() => {}); SK.toast('Nenhum terminal ligado: copiei o comando. Abra o ⚡ Node ou o 📱 Termux e cole.'); }
        return;
      }
      if (d.acao === 'baixar' && mdAtual) { const nome = fs().baseName(mdAtual).replace(/\.(md|markdown)$/i, ''); SK.download(nome + '.html', markdown(fs().read(mdAtual) || '', nome), 'text/html;charset=utf-8'); SK.toast('Baixado: ' + nome + '.html'); }
      return;
    }
    if (d.sk !== 'console') return;
    const log = SK.$('.pv-log', panel);
    const line = document.createElement('div');
    line.className = 'log-' + d.level;
    line.textContent = d.text;
    log.appendChild(line);
    while (log.childElementCount > 400) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
    if (d.level === 'error') { errors++; showErr(); }
  }
  function showErr() {
    const el = SK.$('.pv-err', panel);
    el.hidden = !errors;
    el.textContent = errors + ' erro' + (errors > 1 ? 's' : '');
    el.onclick = () => { consoleEl.hidden = false; };
  }

  SK.on('edit', refreshSoon);
  SK.on('fs-change', (c) => { if (!c.silent) refreshSoon(); });
  SK.on('file-open', (p) => { if (!pinned && auto) refreshSoon(); });
  SK.on('project-open', () => { pinned = ''; setTimeout(refresh, 50); });

  SK.preview = {
    build, refresh,
    show(path) { if (/\.html?$/i.test(path)) pinned = path; if (size === 'min') { size = 'normal'; applySize(); } refresh(); },
    get logText() { return SK.$$('.pv-log div', panel).map((d) => d.textContent).join('\n'); },
  };
})(window.SK);
