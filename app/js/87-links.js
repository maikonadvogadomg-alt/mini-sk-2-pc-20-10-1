/* =========================================================================
   Mini SK — 87-links.js
   🔗 Meus Links: guarda os endereços dos seus PWAs e sites num lugar só
   (eles não somem como os "instalados" que o celular apaga).
   - Colar um ou vários links de uma vez; nome e ícone automáticos.
   - Pastas (categorias), busca, abrir, copiar, editar, apagar.
   - ☁️ Vai junto para a sua conta (se a nuvem estiver ligada).
   - 📲 Gera uma PÁGINA própria com todos os links, para instalar como app.
   - 💬 Colar conversa (ex.: exportada do chat da Monica/Claude) e mandar
     para o ✂️ Fatiador ou para o 🧩 Desembaralhar.
   Os links abrem no navegador (fora do Mini SK): a maioria dos sites não
   deixa abrir "dentro" de outro site — é aquela trava (CORS/quadro).
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const KEY = 'links';
  let box, list = [], filtro = '';

  const salvarLocal = () => SK.db.put('kv', list, KEY).catch(() => {});
  const subir = SK.debounce(async () => { if (SK.nuvem && SK.nuvem.pronto) { try { await SK.nuvem.set('links', list); } catch {} } }, 3000);
  function salvar() { salvarLocal(); subir(); render(); }

  async function carregar() {
    list = (await SK.db.get('kv', KEY).catch(() => null)) || [];
    if (box) render();
  }
  async function sincNuvem() {
    if (!(SK.nuvem && SK.nuvem.pronto)) return;
    try {
      const r = await SK.nuvem.get('links');
      const remoto = (r && Array.isArray(r.valor)) ? r.valor : [];
      const map = new Map();
      for (const x of [...remoto, ...list]) { const y = map.get(x.id); if (!y || (x.atual || 0) >= (y.atual || 0)) map.set(x.id, x); }
      list = [...map.values()];
      await salvarLocal(); await SK.nuvem.set('links', list);
      render();
    } catch {}
  }
  SK.on('conta-entrou', (i) => { if (!(i && i.offline)) setTimeout(sincNuvem, 1500); });

  // ── Ler links de um texto colado ────────────────────────────────────────────
  const ICONES = [[/jurid|direito|peti|processo|advoc|tribunal|stf|stj|tj|oab/i, '⚖️'], [/calc|conta|financ|juros/i, '🧮'], [/github/i, '🐙'], [/netlify|vercel|pages\.dev|github\.io/i, '🌐'], [/ia|ai|chat|claude|gpt|gemini|grok/i, '🤖'], [/pdf|doc/i, '📄'], [/play|jogo|game/i, '🎮'], [/foto|img|imagem|icon/i, '🖼️']];
  const icone = (t) => { for (const [re, e] of ICONES) if (re.test(t)) return e; return '🔗'; };
  function nomeDe(u) {
    try {
      const x = new URL(u);
      const parts = x.pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s).replace(/\.html?$/i, ''));
      let n = parts.filter((s) => s !== 'index').pop() || x.hostname.replace(/^www\./, '').split('.')[0];
      if (/github\.io$/.test(x.hostname) && parts[0]) n = parts[parts.length - 1] === 'index' ? parts[0] : (parts.slice(-1)[0] || parts[0]);
      return n.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 60);
    } catch { return u.slice(0, 40); }
  }
  function extrair(texto) {
    const out = [], vistos = new Set();
    const linhas = String(texto || '').split(/\r?\n/);
    for (const l of linhas) {
      const re = /https?:\/\/[^\s<>"'`)\]]+/g; let m, fim = 0;
      while ((m = re.exec(l))) {
        const url = m[0].replace(/[.,;:!?]+$/, '');
        if (vistos.has(url)) continue; vistos.add(url);
        let antes = l.slice(fim, m.index).replace(/[-–—:|•*#>\s]+$/g, '').replace(/^[-–—*#>\s\d.)]+/, '').replace(/^(e|ou|and|,)\s+/i, '').trim();
        fim = m.index + m[0].length;
        const limpo = /^(e|ou|and|y|,|;|\|)$/i.test(antes) ? '' : antes;
        const nome = limpo && limpo.length <= 60 ? limpo : nomeDe(url);
        out.push({ url, nome });
      }
    }
    return out;
  }

  // ── Tela ────────────────────────────────────────────────────────────────────
  function build(el) {
    box = el;
    box.innerHTML =
      '<div class="lk-add"><textarea class="inp" id="lk-in" rows="2" placeholder="Cole aqui um ou vários links (pode ser um texto inteiro: eu acho os links)"></textarea>' +
      '<div class="row wrap"><input class="inp grow" id="lk-cat" list="lk-cats" placeholder="Pasta (opcional): ex. Jurídico"><datalist id="lk-cats"></datalist><button class="btn primary" id="lk-go">＋ Guardar</button></div></div>' +
      '<input class="inp" id="lk-q" placeholder="🔍 Procurar nos links…">' +
      '<div id="lk-list"></div>' +
      '<details class="gh-sec"><summary><b>📲 Página dos links e cópia de segurança</b></summary><div class="stack" style="margin-top:6px">' +
        '<p class="muted small" style="margin:0">Gera um <b>index.html</b> só com os seus links (busca e ícones). Instale ele como app pelo 📱 PWA, ou publique no GitHub Pages: assim a lista fica num lugar que não some.</p>' +
        '<div class="row wrap"><button class="btn small primary" id="lk-page">📲 Criar página no projeto</button><button class="btn small" id="lk-dlpage">⤓ Baixar a página</button></div>' +
        '<div class="row wrap"><button class="btn small" id="lk-export">⤓ Cópia de segurança (.json)</button><button class="btn small" id="lk-import">⤒ Voltar cópia</button><input type="file" id="lk-file" accept=".json,.txt,.html,.htm,.md" hidden></div>' +
      '</div></details>' +
      '<details class="gh-sec"><summary><b>💬 Colar conversa (Monica, Claude, ChatGPT…)</b></summary><div class="stack" style="margin-top:6px">' +
        '<p class="muted small" style="margin:0">Exporte ou copie a conversa no app e cole aqui. Ela vira um arquivo em <code>conversas/</code> e vai para onde você escolher.</p>' +
        '<textarea class="inp mono" id="lk-conv" rows="5" placeholder="Cole a conversa inteira aqui"></textarea>' +
        '<div class="row wrap"><button class="btn small primary" id="lk-ft">✂️ Mandar para o Fatiador</button><button class="btn small" id="lk-cv">🧩 Desembaralhar (código sem marcação)</button><button class="btn small" id="lk-cvlinks">🔗 Só pegar os links dela</button></div>' +
      '</div></details>';
    const $ = (s) => box.querySelector(s);
    $('#lk-go').onclick = adicionar;
    $('#lk-in').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); adicionar(); } });
    $('#lk-q').oninput = (e) => { filtro = e.target.value.trim().toLowerCase(); render(); };
    $('#lk-list').addEventListener('click', onListClick);
    $('#lk-page').onclick = () => criarPagina(true);
    $('#lk-dlpage').onclick = () => criarPagina(false);
    $('#lk-export').onclick = () => SK.download('meus-links-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(list, null, 2), 'application/json');
    $('#lk-import').onclick = () => $('#lk-file').click();
    $('#lk-file').onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      const t = await f.text(); let novos = [];
      try { const j = JSON.parse(t); if (Array.isArray(j)) novos = j.filter((x) => x && x.url); } catch { novos = extrair(t).map((x) => ({ url: x.url, nome: x.nome })); }
      const n = juntar(novos); SK.toast('🔗 ' + n + ' link(s) novos guardados', 'ok');
    };
    $('#lk-ft').onclick = () => conversa('ft');
    $('#lk-cv').onclick = () => conversa('cv');
    $('#lk-cvlinks').onclick = () => { const t = $('#lk-conv').value; const n = juntar(extrair(t).map((x) => ({ url: x.url, nome: x.nome }))); SK.toast(n ? '🔗 ' + n + ' link(s) guardados' : 'Não achei links novos nessa conversa', n ? 'ok' : 'warn'); };
    carregar();
  }

  function juntar(novos, cat) {
    let n = 0;
    for (const x of novos) {
      if (list.some((y) => y.url === x.url)) continue;
      list.unshift({ id: x.id || SK.uid(), url: x.url, nome: x.nome || nomeDe(x.url), icone: x.icone || icone((x.nome || '') + ' ' + x.url), cat: x.cat || cat || '', atual: Date.now() });
      n++;
    }
    if (n) salvar();
    return n;
  }
  function adicionar() {
    const t = box.querySelector('#lk-in').value, cat = box.querySelector('#lk-cat').value.trim();
    const achados = extrair(t);
    if (!achados.length) return SK.toast('Não achei nenhum link (precisa começar com http:// ou https://)', 'warn');
    const n = juntar(achados, cat);
    box.querySelector('#lk-in').value = '';
    SK.toast(n ? '🔗 ' + n + ' link(s) guardados' + (achados.length > n ? ' · ' + (achados.length - n) + ' já existiam' : '') : 'Esses links já estavam guardados', n ? 'ok' : 'warn');
  }

  function render() {
    if (!box) return;
    const el = box.querySelector('#lk-list');
    const cats = [...new Set(list.map((x) => x.cat || ''))].sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || a.localeCompare(b));
    box.querySelector('#lk-cats').innerHTML = cats.filter(Boolean).map((c) => '<option value="' + SK.esc(c) + '">').join('');
    const vis = list.filter((x) => !filtro || (x.nome + ' ' + x.url + ' ' + (x.cat || '')).toLowerCase().includes(filtro));
    if (!list.length) { el.innerHTML = '<p class="muted small">Nenhum link ainda. Cole o endereço de um PWA ou site lá em cima.</p>'; return; }
    if (!vis.length) { el.innerHTML = '<p class="muted small">Nada com esse nome.</p>'; return; }
    el.innerHTML = '<p class="muted small" style="margin:0">' + list.length + ' link(s)</p>' + cats.map((c) => {
      const its = vis.filter((x) => (x.cat || '') === c); if (!its.length) return '';
      return '<div class="lk-cat">' + (c ? '📁 ' + SK.esc(c) : (cats.length > 1 ? 'Sem pasta' : '')) + '</div>' + its.map((x) =>
        '<div class="lk-it" data-id="' + x.id + '"><a class="lk-open" href="' + SK.esc(x.url) + '" target="_blank" rel="noopener"><span class="lk-ic">' + SK.esc(x.icone || '🔗') + '</span><span class="lk-tx"><b>' + SK.esc(x.nome) + '</b><small>' + SK.esc(x.url.replace(/^https?:\/\//, '')) + '</small></span></a>' +
        '<button class="btn tiny" data-a="copy" title="Copiar o link">📋</button><button class="btn tiny" data-a="edit" title="Editar">✏️</button><button class="btn tiny" data-a="del" title="Apagar">🗑</button></div>').join('');
    }).join('');
  }
  async function onListClick(e) {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const id = b.closest('[data-id]').dataset.id, x = list.find((y) => y.id === id); if (!x) return;
    if (b.dataset.a === 'copy') { await SK.copy(x.url); SK.toast('Copiado'); }
    if (b.dataset.a === 'del') { if (!(await SK.confirm('Apagar "' + x.nome + '"?', { okText: 'Apagar', danger: true }))) return; list = list.filter((y) => y.id !== id); salvar(); }
    if (b.dataset.a === 'edit') {
      const nome = await SK.prompt('Nome:', x.nome, { okText: 'Próximo' }); if (nome == null) return;
      const url = await SK.prompt('Link:', x.url, { okText: 'Próximo' }); if (url == null) return;
      const cat = await SK.prompt('Pasta (vazio = sem pasta):', x.cat || '', { okText: 'Próximo' }); if (cat == null) return;
      const ic = await SK.prompt('Ícone (um emoji):', x.icone || '🔗', { okText: 'Salvar' }); if (ic == null) return;
      Object.assign(x, { nome: nome.trim() || x.nome, url: url.trim() || x.url, cat: cat.trim(), icone: ic.trim() || '🔗', atual: Date.now() });
      salvar();
    }
  }

  // ── Página própria com os links ─────────────────────────────────────────────
  function paginaHTML() {
    const dados = JSON.stringify(list.map(({ nome, url, icone: ic, cat }) => ({ n: nome, u: url, i: ic || '🔗', c: cat || '' }))).replace(/</g, '\\u003c');
    return '<!DOCTYPE html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0f1420"><title>Meus Links</title>\n' +
      '<style>:root{--bg:#0f1420;--bg2:#151b2b;--line:#263048;--tx:#d8deea;--mut:#8592ab;--acc:#4f8cff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.4 system-ui,sans-serif;padding:16px;padding-top:max(16px,env(safe-area-inset-top))}h1{font-size:20px;margin:0 0 10px}input{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--line);background:var(--bg2);color:var(--tx);font-size:16px;margin-bottom:12px}.c{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin:14px 0 6px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}a{display:flex;gap:10px;align-items:center;background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:10px;color:var(--tx);text-decoration:none;min-width:0}a:active{border-color:var(--acc)}.i{font-size:24px}.t{min-width:0}.t b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.t small{display:block;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}.v{color:var(--mut);text-align:center;padding:20px}</style></head>\n' +
      '<body><h1>🔗 Meus Links</h1><input id="q" placeholder="🔍 Procurar…" autocomplete="off"><div id="l"></div>\n' +
      '<script>const L=' + dados + ';const e=s=>String(s).replace(/[&<>"\']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\'":"&#39;"}[c]));' +
      'function r(){const q=document.getElementById("q").value.toLowerCase();const v=L.filter(x=>!q||(x.n+" "+x.u+" "+x.c).toLowerCase().includes(q));const cs=[...new Set(v.map(x=>x.c))];' +
      'document.getElementById("l").innerHTML=v.length?cs.map(c=>(c?\'<div class="c">\'+e(c)+"</div>":"")+\'<div class="g">\'+v.filter(x=>x.c===c).map(x=>\'<a href="\'+e(x.u)+\'" target="_blank" rel="noopener"><span class="i">\'+e(x.i)+\'</span><span class="t"><b>\'+e(x.n)+"</b><small>"+e(x.u.replace(/^https?:\\/\\//,""))+"</small></span></a>").join("")+"</div>").join(""):\'<p class="v">Nada encontrado.</p>\'}' +
      'document.getElementById("q").oninput=r;r();<\/script></body></html>\n';
  }
  async function criarPagina(noProjeto) {
    if (!list.length) return SK.toast('Guarde alguns links primeiro', 'warn');
    const html = paginaHTML();
    if (!noProjeto) return SK.download('meus-links.html', html, 'text/html');
    if (!fs().project) return SK.toast('Abra um projeto primeiro', 'warn');
    const p = 'meus-links/index.html';
    if (fs().exists(p) && !(await SK.confirm('Atualizar "' + p + '" com a lista de agora?', { okText: 'Atualizar' }))) return;
    fs().write(p, html);
    SK.tree && SK.tree.expandTo && SK.tree.expandTo(p);
    SK.editor.open(p);
    SK.toast('📲 Página criada em ' + p + '. Para instalar como app: 📱 PWA → Instalável.', 'ok');
  }

  // ── Conversa colada ─────────────────────────────────────────────────────────
  async function conversa(destino) {
    const t = box.querySelector('#lk-conv').value;
    if (!t.trim()) return SK.toast('Cole a conversa primeiro', 'warn');
    if (!fs().project) return SK.toast('Abra um projeto primeiro', 'warn');
    if (destino === 'ft') {
      const d = new Date(), pad = (n) => String(n).padStart(2, '0');
      const p = 'conversas/' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.md';
      fs().write(p, t);
      SK.app.openSide('ft');
      setTimeout(() => {
        try { SK.fatiador.fill(); const sel = SK.$('#ft-file'); if (sel) { sel.value = p; const go = SK.$('#ft-go'); if (go) go.click(); } } catch {}
      }, 60);
      SK.toast('✂️ Guardada em ' + p + ' e aberta no Fatiador', 'ok');
    } else {
      SK.app.openSide('rx');
      setTimeout(() => {
        const tab = SK.$('[data-rt="mont"]'); if (tab) tab.click();
        const ta = SK.$('#rx-txt'); if (ta) { ta.value = t; ta.dispatchEvent(new Event('input')); }
        const btn = SK.$('#rx-conv'); if (btn) btn.click();
      }, 60);
    }
  }

  SK.links = { build, extrair, juntar, paginaHTML, get list() { return list; } };
})(window.SK);
