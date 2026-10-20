/* =========================================================================
   Mini SK — 86b-node.js
   ⚡ Node DE VERDADE (WebContainer — a mesma peça do SK V3 e do StackBlitz).
   - npm install, node, npm run dev… rodam de verdade, dentro do navegador.
   - Os arquivos do projeto (a árvore ☰) entram no Node; o que você edita no
     Mini SK vai sozinho para o Node; "⬇ Trazer do Node" traz de volta o que
     o Node criou (pacotes e pastas node_modules ficam de fora).
   - "🐙 Enviar ao GitHub" manda o projeto para o repositório (seu backup).

   Para ligar, o navegador exige 3 coisas (é regra do navegador, não do Mini SK):
     1. o Mini SK aberto como SITE (https — GitHub Pages, Netlify — ou localhost)
        ou instalado como app (PWA) a partir de um site;
     2. o 🔒 lacre ligado (o painel liga e recarrega a página uma vez);
     3. Chrome ou Edge (no celular, o Chrome).
   No APK e abrindo o arquivo solto, não liga.
   Uso pessoal é gratuito; uso comercial do WebContainer exige licença da StackBlitz.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const XTERM = 'https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0';
  const FIT = 'https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.js';
  const WC = 'https://cdn.jsdelivr.net/npm/@webcontainer/api@1/+esm';
  const IGNORAR = /(^|\/)(node_modules|\.git|\.sk)(\/|$)/;
  let box = null, wc = null, term = null, fit = null, shell = null, escrever = null, montado = false, sincronizando = false;

  // ── Lacre (service worker) ──────────────────────────────────────────────────
  const ehSite = () => /^https?:$/.test(location.protocol);
  const lacreLigado = () => SK.pref.get('lacre', false);
  async function registrarSW() {
    if (!ehSite() || !('serviceWorker' in navigator)) return;
    try { const reg = await navigator.serviceWorker.register('sw.js' + (lacreLigado() ? '?lacre=1' : '')); reg.update && reg.update().catch(() => {}); } catch (e) { console.warn('sw', e); }
  }
  async function ligarLacre(ligar) {
    SK.pref.set('lacre', !!ligar);
    await registrarSW();
    status(ligar ? 'Lacre ligado. Recarregando a página…' : 'Lacre desligado. Recarregando…');
    setTimeout(() => location.reload(), 700);
  }

  // ── Carregar as peças ──────────────────────────────────────────────────────
  function carregarScript(src) { return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error('Não consegui baixar ' + src.split('/').slice(4, 6).join('/') + ' (precisa de internet)')); document.head.appendChild(s); }); }
  function carregarCss(href) { if (document.querySelector('link[href="' + href + '"]')) return; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }

  // ── Árvore do projeto → formato do Node ─────────────────────────────────────
  function arvore() {
    const raiz = {};
    for (const p of fs().list()) {
      if (IGNORAR.test(p)) continue;
      const partes = p.split('/');
      let no = raiz;
      for (let i = 0; i < partes.length - 1; i++) { no[partes[i]] = no[partes[i]] || { directory: {} }; no = no[partes[i]].directory; }
      const rec = fs().get(p);
      no[partes[partes.length - 1]] = { file: { contents: rec && rec.text != null ? rec.text : (fs().bytesOf(p) || new Uint8Array(0)) } };
    }
    return raiz;
  }

  // ── Ligar ────────────────────────────────────────────────────────────────────
  async function ligar() {
    if (!fs().project) throw new Error('Abra um projeto primeiro.');
    if (!window.crossOriginIsolated) throw new Error('Falta o lacre. Toque em "🔒 Ligar o lacre" (a página recarrega uma vez).');
    status('Baixando o terminal…');
    carregarCss(XTERM + '/css/xterm.css');
    if (!window.Terminal) await carregarScript(XTERM + '/lib/xterm.js');
    if (!window.FitAddon) await carregarScript(FIT);
    status('Ligando o Node (a primeira vez demora um pouco)…');
    if (!wc) {
      let mod;
      try { mod = await import(WC); } catch (e) { throw new Error('Não consegui baixar o WebContainer (precisa de internet): ' + e.message); }
      wc = await mod.WebContainer.boot();
      wc.on('server-ready', (porta, url) => mostrarServidor(porta, url));
      wc.on('error', (e) => status('⚠ ' + (e && e.message || e), 'error'));
    }
    if (!montado) { status('Colocando os arquivos do projeto no Node…'); await wc.mount(arvore()); montado = true; }
    if (!term) {
      term = new window.Terminal({ convertEol: true, fontSize: 13, cursorBlink: true, theme: { background: '#0b0f17' } });
      fit = new window.FitAddon.FitAddon();
      term.loadAddon(fit);
      term.open(SK.$('#node-term', box));
      fit.fit();
      window.addEventListener('resize', () => { try { fit.fit(); shell && shell.resize({ cols: term.cols, rows: term.rows }); } catch {} });
    }
    if (!shell) {
      shell = await wc.spawn('jsh', { terminal: { cols: term.cols, rows: term.rows } });
      shell.output.pipeTo(new WritableStream({ write: (d) => term.write(d) }));
      escrever = shell.input.getWriter();
      term.onData((d) => escrever.write(d));
      shell.exit.then(() => { shell = null; escrever = null; term.write('\r\n[o terminal fechou — toque em ▶ Ligar de novo]\r\n'); });
    }
    status('✅ Node ligado. Digite os comandos aqui embaixo (ex.: npm install, npm run dev).', 'ok');
    SK.$('#node-ligado', box).hidden = false;
    term.focus();
  }

  function mostrarServidor(porta, url) {
    const el = SK.$('#node-srv', box);
    el.innerHTML = '<div class="row wrap"><b>🌐 Servidor no ar (porta ' + porta + ')</b><a class="btn small" href="' + SK.esc(url) + '" target="_blank" rel="noopener">Abrir em outra aba ↗</a><button class="btn small" id="node-ver">👁 Ver aqui</button></div><iframe id="node-prev" hidden allow="cross-origin-isolated" style="width:100%;height:55vh;border:1px solid var(--line2);border-radius:8px;background:#fff"></iframe>';
    SK.$('#node-ver', el).onclick = () => { const f = SK.$('#node-prev', el); f.hidden = !f.hidden; if (!f.hidden && !f.src) f.src = url; };
  }

  // ── Sincronia: Mini SK → Node (automático) ──────────────────────────────────
  SK.on('fs-change', async (ev) => {
    if (!wc || !montado || sincronizando || !ev) return;
    try {
      const p = ev.path;
      if (ev.type === 'import' || ev.type === 'restore') { await wc.mount(arvore()); return; }
      if (!p || IGNORAR.test(p)) return;
      if (ev.type === 'remove') { await wc.fs.rm(p, { recursive: true, force: true }).catch(() => {}); return; }
      if (ev.type === 'mkdir') { await wc.fs.mkdir(p, { recursive: true }).catch(() => {}); return; }
      if (ev.type === 'rename' && ev.from) await wc.fs.rm(ev.from, { recursive: true, force: true }).catch(() => {});
      if (!fs().exists(p)) return;
      const pasta = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
      if (pasta) await wc.fs.mkdir(pasta, { recursive: true }).catch(() => {});
      const rec = fs().get(p);
      await wc.fs.writeFile(p, rec.text != null ? rec.text : fs().bytesOf(p));
    } catch (e) { console.warn('[node sync]', e); }
  });

  // ── Sincronia: Node → Mini SK (quando você pedir) ───────────────────────────
  async function trazer() {
    if (!wc) throw new Error('Ligue o Node primeiro.');
    await SK.checkpoints.auto('Antes de trazer arquivos do Node');
    const dec = new TextDecoder('utf-8', { fatal: true });
    let novos = 0, mudou = 0;
    sincronizando = true;
    try {
      const andar = async (dir) => {
        for (const e of await wc.fs.readdir(dir || '.', { withFileTypes: true })) {
          const p = (dir ? dir + '/' : '') + e.name;
          if (IGNORAR.test(p)) continue;
          if (e.isDirectory()) { await andar(p); continue; }
          const bytes = await wc.fs.readFile(p);
          if (bytes.length > 5 * 1024 * 1024) continue;
          let texto = null; try { texto = dec.decode(bytes); } catch {}
          const antes = fs().exists(p) ? fs().get(p) : null;
          if (texto != null) {
            if (antes && antes.text === texto) continue;
            fs().write(p, texto, { silent: true });
          } else {
            fs().writeRecord(p, { b64: fs().toBase64(bytes), enc: 'binário', size: bytes.length });
          }
          antes ? mudou++ : novos++;
        }
      };
      await andar('');
    } finally { sincronizando = false; }
    SK.emit('fs-change', { type: 'import' });
    return { novos, mudou };
  }

  // ── Painel ──────────────────────────────────────────────────────────────────
  function status(m, k) { const el = box && SK.$('#node-status', box); if (el) { el.textContent = m; el.className = 'gh-status ' + (k || ''); } }
  function teclas(seq) { if (escrever) { escrever.write(seq); term && term.focus(); } }
  function build(container) {
    box = container;
    const iso = !!window.crossOriginIsolated;
    box.innerHTML =
      '<p class="muted small">Node <b>de verdade</b> (WebContainer, o mesmo do SK V3). Roda <code>npm install</code>, <code>node</code>, <code>npm run dev</code> com os arquivos da árvore ☰.</p>' +
      '<div class="stack small">' +
        '<div>' + (ehSite() ? '✅' : '❌') + ' Aberto como site (https ou localhost)' + (ehSite() ? '' : ' — abra o Mini SK pelo GitHub Pages ou Netlify (ou instale como app a partir de lá). Pelo arquivo solto e no APK não liga.') + '</div>' +
        '<div>' + (iso ? '✅ Lacre ligado' : (lacreLigado() ? '⏳ Lacre marcado, falta recarregar a página' : '❌ Lacre desligado')) + '</div>' +
        '<div>' + (/Chrome|Edg/.test(navigator.userAgent) ? '✅' : '⚠️') + ' Navegador: ' + (/Edg/.test(navigator.userAgent) ? 'Edge' : /Chrome/.test(navigator.userAgent) ? 'Chrome' : 'outro (use Chrome ou Edge)') + '</div>' +
      '</div>' +
      '<div class="row wrap" style="margin-top:6px">' +
        (iso ? '' : '<button class="btn" id="node-lacre"' + (ehSite() ? '' : ' disabled') + '>🔒 Ligar o lacre</button>') +
        '<button class="btn primary" id="node-ligar"' + (iso ? '' : ' disabled') + '>▶ Ligar o Node</button>' +
        (lacreLigado() ? '<button class="btn small" id="node-deslacre">Desligar o lacre</button>' : '') +
      '</div>' +
      '<div class="gh-status" id="node-status"></div>' +
      '<div id="node-term" style="height:46vh;min-height:220px;background:#0b0f17;border-radius:8px;padding:4px;overflow:hidden"></div>' +
      '<div id="node-ligado" hidden class="stack">' +
        '<div class="row wrap"><button class="btn small" data-k="ctrlc">Ctrl+C</button><button class="btn small" data-k="tab">Tab</button><button class="btn small" data-k="cima">↑</button><button class="btn small" data-k="baixo">↓</button><button class="btn small" data-k="esc">Esc</button>' +
        '</div>' +
        '<div class="row wrap"><button class="btn small" id="node-trazer">⬇ Trazer do Node para o projeto</button><button class="btn small" id="node-remontar">⬆ Mandar o projeto de novo</button><button class="btn small primary" id="node-gh">🐙 Enviar ao GitHub</button></div>' +
        '<div id="node-atalhos"></div>' +
        '<div id="node-srv"></div>' +
      '</div>' +
      '<details><summary class="small">Como deixar sempre pronto no celular</summary><div class="small muted stack" style="margin-top:6px">' +
        '<div>1. Publique o Mini SK no GitHub Pages (🐙 GitHub → Publicar site) ou no Netlify.</div>' +
        '<div>2. Abra esse endereço no Chrome → menu ⋮ → <b>Instalar app</b>.</div>' +
        '<div>3. No app instalado: ⚡ Node → 🔒 Ligar o lacre (só da primeira vez) → ▶ Ligar o Node.</div>' +
        '<div>O Node pesa: quando terminar, Ctrl+C no servidor ou feche o app.</div></div></details>';
    const $ = (s) => SK.$(s, box);
    const rodar = async (fn) => { try { await fn(); } catch (e) { status('⚠ ' + e.message, 'error'); } };
    if ($('#node-lacre')) $('#node-lacre').onclick = () => rodar(() => ligarLacre(true));
    if ($('#node-deslacre')) $('#node-deslacre').onclick = () => rodar(() => ligarLacre(false));
    $('#node-ligar').onclick = () => rodar(ligar);
    const TECLAS = { ctrlc: '\x03', tab: '\t', cima: '\x1b[A', baixo: '\x1b[B', esc: '\x1b' };
    box.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => teclas(TECLAS[b.dataset.k])));
    box.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => teclas(b.dataset.c + '\r')));
    $('#node-trazer').onclick = () => rodar(async () => { const r = await trazer(); status('⬇ Trazidos: ' + r.novos + ' arquivo(s) novo(s), ' + r.mudou + ' mudado(s). Tem ponto de volta em 📸.', 'ok'); });
    $('#node-remontar').onclick = () => rodar(async () => { if (!wc) throw new Error('Ligue o Node primeiro.'); await wc.mount(arvore()); status('⬆ Projeto mandado de novo para o Node.', 'ok'); });
    $('#node-gh').onclick = () => SK.app.openSide('gh');
    SK.atalhos.montar($('#node-atalhos'), (c) => { if (escrever) teclas(c + '\r'); else status('Ligue o Node primeiro (▶ Ligar o Node).', 'error'); });
    if (term) { $('#node-term').replaceWith(term.element.parentElement); }
  }
  SK.on('project-open', () => { montado = false; if (wc) wc.mount(arvore()).then(() => { montado = true; }).catch(() => {}); });

  registrarSW();
  // manda um comando pronto para o terminal (usado pelo 🏗️ Preparar)
  async function mandar(cmd) {
    SK.app.openSide('node');
    if (!shell) { await ligar(); }
    if (escrever) { escrever.write(cmd + '\r'); return true; }
    return false;
  }
  SK.node = { build, ligar, trazer, ligarLacre, arvore, mandar, get ligado() { return !!shell; } };
})(window.SK);
