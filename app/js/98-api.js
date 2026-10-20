/* =========================================================================
   Mini SK — 98-api.js
   🧪 Testador da API do próprio projeto (o servidor rodando no seu PC,
   ex.: http://localhost:8080 ou o EXE leve em 127.0.0.1:18633).
   - Acha sozinho as ROTAS do servidor no código (Express, Fastify, Hono,
     Flask/FastAPI, Next.js, OpenAPI) e as CHAMADAS que a tela faz (fetch,
     axios). Marca as chamadas cuja rota não existe no servidor — é assim
     que se descobre "onde quebrou".
   - Envia um pedido (GET/POST/PUT/PATCH/DELETE) e mostra status, tempo e
     resposta. "Testar todas as GET" testa uma por uma (✅/❌).
   Baseado no testador do Projeto Lab.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  let box, A = null;
  const T = { base: SK.pref.get('apiBase', 'http://localhost:8080'), method: 'GET', path: '/api/health', body: '', resp: '' };

  function lineOf(t, idx) { let n = 1; for (let i = 0; i < idx; i++) if (t.charCodeAt(i) === 10) n++; return n; }
  function analyze() {
    const res = { routes: [], calls: [], mounts: [''] };
    const mounts = new Set(['']);
    const files = fs().list().filter((p) => /\.(m?[jt]sx?|cjs|py)$/.test(p) && !/(^|\/)(node_modules|dist|build|dist-[\w-]+)\//.test(p));
    for (const p of files) {
      const t = fs().read(p); if (!t || t.length > 2e6) continue;
      let m;
      const reUse = /\.use\(\s*['"`](\/[^'"`]*)['"`]\s*,/g;
      while ((m = reUse.exec(t))) mounts.add(m[1].replace(/\/$/, ''));
      const reRoute = /\b(\w+)\.(get|post|put|patch|delete|all)\(\s*['"`](\/[^'"`]*)['"`]/g;
      while ((m = reRoute.exec(t))) {
        if (/^(axios|api|http|client|fetch|request|superagent|ky|\$|map|params|headers|searchParams|localStorage|sessionStorage|cache|store|query|formData|url)$/i.test(m[1]) && !/server|route|api\//i.test(p)) continue;
        res.routes.push({ method: m[2].toUpperCase(), path: m[3], file: p, line: lineOf(t, m.index), src: 'código' });
      }
      const rePy = /@\w+\.(get|post|put|patch|delete|route)\(\s*['"]([^'"]+)['"]/g;
      while ((m = rePy.exec(t))) res.routes.push({ method: m[1] === 'route' ? 'ANY' : m[1].toUpperCase(), path: m[2], file: p, line: lineOf(t, m.index), src: 'Python' });
      if (!/server|backend/i.test(p) || /client|frontend|web\//.test(p)) {
        const reCall = /\b(?:fetch|axios(?:\.(?:get|post|put|patch|delete))?|ky(?:\.\w+)?|\$fetch)\(\s*[`'"]((?:\$\{[^}]*\})?\/[^`'"\s]*)[`'"]/g;
        while ((m = reCall.exec(t))) res.calls.push({ path: m[1].replace(/^\$\{[^}]*\}/, ''), raw: m[1], file: p, line: lineOf(t, m.index) });
        const reApi = /[`'"](\/api\/[\w\-/:.${}]*)[`'"]/g;
        while ((m = reApi.exec(t))) if (!res.calls.some((c) => c.file === p && c.raw === m[1])) res.calls.push({ path: m[1], raw: m[1], file: p, line: lineOf(t, m.index) });
      }
    }
    for (const p of files) {
      const m = p.match(/(?:^|\/)(?:src\/)?(?:app|pages)\/(api\/.*?)(?:\/route)?\.(?:[jt]sx?)$/);
      if (m) res.routes.push({ method: 'ANY', path: '/' + m[1].replace(/\/index$/, '').replace(/\[([^\]]+)\]/g, ':$1'), file: p, line: 0, src: 'Next.js' });
    }
    for (const p of fs().list().filter((x) => /openapi\.(ya?ml|json)$/.test(x))) {
      const t = fs().read(p) || ''; let inPaths = false, cur = null; let m; const re = /^(\S.*|  (\/[^:]*):\s*|    (get|post|put|patch|delete):)\s*$/gm;
      while ((m = re.exec(t))) {
        if (/^paths:/.test(m[1])) { inPaths = true; continue; }
        if (/^\S/.test(m[1])) { inPaths = false; continue; }
        if (!inPaths) continue;
        if (m[2]) cur = m[2]; else if (m[3] && cur) res.routes.push({ method: m[3].toUpperCase(), path: cur, file: p, line: lineOf(t, m.index), src: 'OpenAPI' });
      }
    }
    res.mounts = [...mounts];
    const toRe = (r) => new RegExp('^' + r.replace(/[.+?^$|()\\]/g, '\\$&').replace(/\/:[\w]+|\/\{[\w]+\}|\/\[[\w.]+\]/g, '/[^/]+').replace(/\*/g, '.*') + '/?$');
    const routeRes = [];
    for (const r of res.routes) for (const mt of res.mounts) { try { routeRes.push(toRe((r.src === 'OpenAPI' ? '/api' : mt) + r.path)); if (r.src === 'OpenAPI' || r.src === 'Next.js') routeRes.push(toRe(r.path)); } catch {} }
    for (const c of res.calls) { const pth = c.path.replace(/\$\{[^}]*\}/g, 'X').split('?')[0]; c.ok = routeRes.some((re) => re.test(pth)); }
    return res;
  }
  const fullPath = (r) => (!r.path.startsWith('/api') && A.mounts.includes('/api') && r.src !== 'Next.js') ? '/api' + r.path : r.path;

  async function req(method, url, body) {
    const t0 = performance.now();
    const init = { method, headers: {} };
    if (body && method !== 'GET') { init.body = body; init.headers['Content-Type'] = 'application/json'; }
    const r = await fetch(url, init);
    const txt = await r.text(); let pretty = txt;
    try { pretty = JSON.stringify(JSON.parse(txt), null, 2); } catch {}
    return { status: r.status, ok: r.ok, ms: Math.round(performance.now() - t0), body: pretty, type: r.headers.get('content-type') || '' };
  }
  function save() {
    const $ = (s) => SK.$(s, box);
    T.base = $('#api-base').value.trim().replace(/\/+$/, ''); T.method = $('#api-m').value; T.path = $('#api-path').value.trim(); T.body = $('#api-body').value;
    SK.pref.set('apiBase', T.base);
  }
  function show(text) { T.resp = text; SK.$('#api-resp', box).textContent = text; }
  async function send() {
    save(); show('⏳ …');
    try {
      if (T.body.trim() && T.method !== 'GET') { try { JSON.parse(T.body); } catch (e) { show('⚠ O corpo não é um JSON válido: ' + e.message); return; } }
      const r = await req(T.method, T.base + T.path, T.body.trim());
      show((r.ok ? '✅' : '❌') + ' HTTP ' + r.status + ' · ' + r.ms + ' ms · ' + r.type + '\n\n' + r.body);
    } catch (e) { show('❌ ' + e.message + '\n\n' + hint()); }
  }
  function hint() {
    return 'Não conectou em ' + T.base + '. Causas comuns:\n• o servidor não está ligado (ou a porta é outra);\n• o servidor não libera CORS para este endereço (normal se o Mini SK está aberto de outro lugar);\n• no celular, "localhost" é o próprio celular — use o IP do PC (ex.: http://192.168.0.10:8080).';
  }
  async function allGet() {
    save();
    const gets = [...new Set(A.routes.filter((r) => (r.method === 'GET' || r.method === 'ALL' || r.method === 'ANY') && !/[:{[*]/.test(r.path)).map(fullPath))];
    if (!gets.length) { SK.toast('Nenhuma rota GET sem parâmetros', 'error'); return; }
    let out = '', ok = 0;
    for (const p of gets) {
      show(out + '⏳ ' + p + '…');
      try { const r = await req('GET', T.base + p); if (r.ok) ok++; out += (r.ok ? '✅ ' : '❌ ') + r.status + '  ' + String(r.ms).padStart(4) + ' ms  GET ' + p + '\n'; }
      catch (e) { out += '❌ erro        GET ' + p + ' — ' + e.message + '\n'; }
    }
    show(out + '\n' + ok + ' de ' + gets.length + ' responderam OK.' + (ok ? '' : '\n\n' + hint()));
  }

  function build(container) {
    box = container;
    box.innerHTML =
      '<p class="muted small">Teste o <b>servidor do projeto</b> rodando no seu PC. Primeiro toque em <b>Procurar rotas</b>: o Mini SK lê o código e lista o que o servidor oferece e o que a tela chama.</p>' +
      '<div class="row"><input class="inp mono grow" id="api-base" placeholder="http://localhost:8080"><button class="btn small" id="api-scan">🔎 Procurar rotas</button></div>' +
      '<div class="row"><select class="inp" id="api-m">' + ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => '<option>' + m + '</option>').join('') + '</select><input class="inp mono grow" id="api-path" placeholder="/api/health"></div>' +
      '<textarea class="inp mono" id="api-body" rows="3" placeholder=\'Corpo JSON (para POST/PUT), ex.: {"nome":"teste"}\'></textarea>' +
      '<div class="row wrap"><button class="btn primary" id="api-send">▶ Enviar</button><button class="btn" id="api-all">▶ Testar todas as GET</button><button class="btn small" id="api-ai">🤖 Perguntar à IA</button></div>' +
      '<pre class="api-resp" id="api-resp">A resposta aparece aqui.</pre>' +
      '<div id="api-lists"></div>';
    const $ = (s) => SK.$(s, box);
    $('#api-base').value = T.base; $('#api-m').value = T.method; $('#api-path').value = T.path; $('#api-body').value = T.body;
    $('#api-scan').onclick = scan;
    $('#api-send').onclick = send;
    $('#api-all').onclick = () => { if (!A) scan(); allGet(); };
    $('#api-path').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    $('#api-ai').onclick = () => {
      save();
      const bad = A ? A.calls.filter((c) => !c.ok && A.routes.length) : [];
      SK.app.openSide('ai');
      const inp = SK.$('#ai-in');
      if (inp) { inp.value = 'Testei a API do projeto. Explique em português simples o que a resposta quer dizer e o que corrigir.\n\nPedido: ' + T.method + ' ' + T.base + T.path + (T.body ? '\nCorpo: ' + T.body : '') + '\n\nResposta:\n' + (T.resp || '(nenhuma)').slice(0, 4000) + (bad.length ? '\n\nChamadas da tela sem rota no servidor:\n' + bad.map((c) => c.raw + ' (' + c.file + ':' + c.line + ')').join('\n') : ''); inp.focus(); }
    };
    $('#api-lists').addEventListener('click', (e) => {
      const u = e.target.closest('[data-use]'); if (u) { const r = A.routes[+u.dataset.use]; $('#api-m').value = r.method === 'ANY' || r.method === 'ALL' ? 'GET' : r.method; $('#api-path').value = fullPath(r); save(); return; }
      const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); SK.editor.reveal(g.dataset.go, +g.dataset.line || 1); SK.emit('picked-result'); }
    });
  }
  function scan() {
    if (!fs().project) return;
    A = analyze();
    const routes = A.routes.map((r, i) => Object.assign({ i }, r)).sort((a, b) => a.path.localeCompare(b.path));
    const loc = (f, l) => '<a href="#" data-go="' + SK.esc(f) + '" data-line="' + (l || 1) + '">' + SK.esc(f) + (l ? ':' + l : '') + '</a>';
    const badCalls = A.calls.filter((c) => !c.ok);
    SK.$('#api-lists', box).innerHTML =
      '<h4>🛣️ Rotas do servidor <span class="pill">' + routes.length + '</span>' + (A.mounts.filter(Boolean).length ? ' <span class="muted small">prefixos: ' + A.mounts.filter(Boolean).map(SK.esc).join(', ') + '</span>' : '') + '</h4>' +
      (routes.length ? '<div class="api-list">' + routes.map((r) => '<div class="api-row"><span class="pill">' + r.method + '</span><code>' + SK.esc(fullPath(r)) + '</code><span class="muted small">' + loc(r.file, r.line) + '</span><button class="btn tiny" data-use="' + r.i + '">usar</button></div>').join('') + '</div>' : '<p class="muted small">Nenhuma rota de servidor reconhecida (Express, Fastify, Hono, Flask, FastAPI, Next.js, OpenAPI).</p>') +
      '<h4>📞 Chamadas que a tela faz <span class="pill">' + A.calls.length + '</span>' + (routes.length && badCalls.length ? ' <span class="pill bad">' + badCalls.length + ' sem rota</span>' : '') + '</h4>' +
      (A.calls.length ? '<div class="api-list">' + A.calls.map((c) => '<div class="api-row"><code>' + SK.esc(c.raw) + '</code>' + (!routes.length ? '<span class="muted small">?</span>' : c.ok ? '<span class="pill ok">rota existe</span>' : '<span class="pill bad">rota não achada</span>') + '<span class="muted small">' + loc(c.file, c.line) + '</span></div>').join('') + '</div>' : '<p class="muted small">Nenhuma chamada fetch/axios com caminho fixo encontrada.</p>') +
      (routes.length && badCalls.length ? '<p class="small warn-box">"Rota não achada" = a tela chama um endereço que o servidor não tem (rota apagada, renomeada ou com prefixo diferente). É um dos jeitos mais comuns de "quebrar" depois que uma IA mexe no projeto.</p>' : '');
    SK.toast(routes.length + ' rotas e ' + A.calls.length + ' chamadas encontradas');
  }
  SK.on('project-open', () => { A = null; if (box) SK.$('#api-lists', box).innerHTML = ''; });

  SK.api = { build, analyze, scan };
})(window.SK);
