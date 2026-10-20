/* =========================================================================
   Mini SK — 90-github.js
   Repositório no GitHub, direto do navegador (sem servidor, sem Replit):
   - Cole seu token (github.com/settings/tokens — "Fine-grained", com acesso
     "Contents: Read and write" nos repositórios; para criar repositório
     novo, "Administration: Read and write").
   - Importar um repositório (seu ou público) para um projeto.
   - Enviar (commit + push) o projeto para um repositório. Só os arquivos
     que mudaram são enviados.
   - Criar repositório novo e ligar o GitHub Pages (site grátis).
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const API = 'https://api.github.com';
  let box, token = SK.pref.get('ghToken', ''), me = null, repos = [];

  // ── Chamada à API ───────────────────────────────────────────────────────────
  async function gh(path, opts) {
    opts = opts || {};
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (opts.body) headers['Content-Type'] = 'application/json';
    let r;
    try { r = await fetch(path.startsWith('http') ? path : API + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined }); }
    catch (e) { throw new Error('Sem conexão com o GitHub (' + e.message + ')'); }
    if (r.status === 204) return null;
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(explain(r.status, data, path));
      err.status = r.status; err.data = data; throw err;
    }
    return data;
  }
  function explain(status, data, path) {
    const m = (data && data.message) || '';
    if (status === 401) return 'Token inválido ou vencido. Gere outro em github.com/settings/tokens.';
    if (status === 403 && /rate limit/i.test(m)) return 'Limite de uso do GitHub atingido. Com token o limite é bem maior; sem token, espere uma hora.';
    if (/workflow/i.test(m)) return 'O token não pode mexer em receitas do GitHub (.github/workflows). Gere um token com "Workflows: Read and write" (no token clássico: marque "workflow").';
    if (status === 403) return 'O token não tem permissão para isso (' + m + '). Dê "Contents: Read and write" ao token.';
    if (status === 404) return 'Não encontrado: o repositório não existe ou o token não tem acesso a ele.';
    if (status === 409 && /empty/i.test(m)) return 'EMPTY';
    if (status === 422) return 'O GitHub recusou: ' + m + (data.errors ? ' — ' + data.errors.map((e) => e.message || e.code).join(', ') : '');
    return 'GitHub ' + status + ': ' + (m || path);
  }

  // ── Utilidades ──────────────────────────────────────────────────────────────
  async function pool(items, n, fn, onProgress) {
    let i = 0, done = 0; const out = new Array(items.length);
    const worker = async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); done++; onProgress && onProgress(done, items.length); } };
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
    return out;
  }
  /** SHA-1 do jeito do git, para saber o que já está igual no GitHub. */
  async function gitSha(bytes) {
    if (!(window.crypto && crypto.subtle)) return null;
    const head = new TextEncoder().encode('blob ' + bytes.length + '\0');
    const all = new Uint8Array(head.length + bytes.length); all.set(head); all.set(bytes, head.length);
    const h = new Uint8Array(await crypto.subtle.digest('SHA-1', all));
    return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  function parseRepo(s) {
    s = String(s || '').trim().replace(/\.git$/, '');
    const m = s.match(/github\.com[/:]([^/]+)\/([^/#?]+)/) || s.match(/^([^/\s]+)\/([^/\s]+)$/);
    return m ? { owner: m[1], repo: m[2] } : null;
  }
  const linkKey = () => 'ghLink:' + (fs().project ? fs().project.name : '');
  const getLink = () => SK.pref.get(linkKey(), null);
  const setLink = (l) => SK.pref.set(linkKey(), l);
  function status(msg, kind) { const el = box && SK.$('#gh-status', box); if (el) { el.textContent = msg; el.className = 'gh-status ' + (kind || ''); } }

  // ── Importar ────────────────────────────────────────────────────────────────
  async function importRepo(owner, repo, branch, intoCurrent) {
    status('Lendo ' + owner + '/' + repo + '…');
    const info = await gh('/repos/' + owner + '/' + repo);
    branch = branch || info.default_branch;
    let tree;
    try { tree = await gh('/repos/' + owner + '/' + repo + '/git/trees/' + encodeURIComponent(branch) + '?recursive=1'); }
    catch (e) { if (e.message === 'EMPTY' || e.status === 409) throw new Error('Este repositório está vazio. Use "Enviar" para colocar o projeto nele.'); throw e; }
    const blobs = tree.tree.filter((t) => t.type === 'blob' && !/(^|\/)(node_modules|\.git)\//.test(t.path));
    if (blobs.length > 3000 && !(await SK.confirm('O repositório tem ' + blobs.length + ' arquivos. Importar mesmo assim? Pode demorar.', { okText: 'Importar' }))) return;
    if (tree.truncated) SK.toast('Repositório muito grande: o GitHub mandou só parte da lista', 'error');
    const files = {};
    await pool(blobs, 8, async (b) => {
      const d = await gh('/repos/' + owner + '/' + repo + '/git/blobs/' + b.sha);
      const bytes = fs().fromBase64((d.content || '').replace(/\n/g, ''));
      files[b.path] = fs().recordFromBytes(b.path, bytes);
    }, (n, t) => status('Baixando arquivos ' + n + '/' + t + '…'));
    if (intoCurrent && fs().project) {
      await SK.checkpoints.auto('Antes de puxar do GitHub ' + owner + '/' + repo);
      fs().restore({ files, folders: [] });
    } else {
      await fs().create(repo, files);
    }
    setLink({ owner, repo, branch });
    await fs().saveNow();
    status('✅ ' + blobs.length + ' arquivos importados de ' + owner + '/' + repo + ' (' + branch + ')', 'ok');
    renderLink();
  }

  // ── Enviar (commit + push) ──────────────────────────────────────────────────
  async function push(owner, repo, branch, message, opts) {
    opts = opts || {};
    if (!token) throw new Error('Cole o token primeiro.');
    status('Preparando envio…');
    const info = await gh('/repos/' + owner + '/' + repo);
    branch = branch || info.default_branch || 'main';
    let headSha = null, baseTree = null, remote = {};
    try {
      const ref = await gh('/repos/' + owner + '/' + repo + '/git/ref/heads/' + encodeURIComponent(branch));
      headSha = ref.object.sha;
      const commit = await gh('/repos/' + owner + '/' + repo + '/git/commits/' + headSha);
      baseTree = commit.tree.sha;
      const t = await gh('/repos/' + owner + '/' + repo + '/git/trees/' + baseTree + '?recursive=1');
      t.tree.forEach((x) => { if (x.type === 'blob') remote[x.path] = x.sha; });
    } catch (e) {
      if (e.status === 404 || e.status === 409 || e.message === 'EMPTY') {
        // Repositório vazio (ou ramo novo): o primeiro arquivo vai pela API de conteúdo.
        const isEmpty = e.message === 'EMPTY' || e.status === 409 || info.size === 0;
        if (isEmpty) {
          status('Repositório vazio: criando o primeiro commit…');
          await gh('/repos/' + owner + '/' + repo + '/contents/.gitkeep', { method: 'PUT', body: { message: 'Início', content: '', branch } });
          return push(owner, repo, branch, message, Object.assign({}, opts, { dropKeep: true }));
        }
        // ramo não existe: cria a partir do ramo principal
        const base = await gh('/repos/' + owner + '/' + repo + '/git/ref/heads/' + encodeURIComponent(info.default_branch));
        await gh('/repos/' + owner + '/' + repo + '/git/refs', { method: 'POST', body: { ref: 'refs/heads/' + branch, sha: base.object.sha } });
        return push(owner, repo, branch, message, opts);
      }
      throw e;
    }
    const paths = fs().list().filter((p) => opts.includeSk !== false || !p.startsWith('.sk/'));
    const entries = [];
    let up = 0, same = 0;
    await pool(paths, 6, async (p) => {
      const bytes = fs().bytesOf(p);
      const sha = await gitSha(bytes);
      if (sha && remote[p] === sha) { same++; entries.push({ path: p, mode: '100644', type: 'blob', sha }); return; }
      const rec = fs().get(p);
      const blob = rec.b64 != null
        ? await gh('/repos/' + owner + '/' + repo + '/git/blobs', { method: 'POST', body: { content: rec.b64, encoding: 'base64' } })
        : await gh('/repos/' + owner + '/' + repo + '/git/blobs', { method: 'POST', body: { content: rec.text, encoding: 'utf-8' } });
      up++;
      entries.push({ path: p, mode: /\.(sh|command)$/.test(p) ? '100755' : '100644', type: 'blob', sha: blob.sha });
    }, (n, t) => status('Enviando ' + n + '/' + t + '…'));
    // A chave de assinatura do APK é criada pelo próprio GitHub: nunca apagar.
    const keepAlways = Object.keys(remote).filter((p) => !paths.includes(p) && /\.keystore$/.test(p));
    keepAlways.forEach((p) => entries.push({ path: p, mode: '100644', type: 'blob', sha: remote[p] }));
    const removed = Object.keys(remote).filter((p) => !paths.includes(p) && !keepAlways.includes(p) && !(opts.dropKeep && p === '.gitkeep'));
    const keepRemote = opts.mirror === false ? removed.filter((p) => !(opts.dropKeep && p === '.gitkeep')) : [];
    keepRemote.forEach((p) => entries.push({ path: p, mode: '100644', type: 'blob', sha: remote[p] }));
    if (!up && !(opts.mirror !== false && removed.length)) { status('Nada mudou: o GitHub já está igual ao projeto.', 'ok'); return { up, same, removed: 0 }; }
    // Sem base_tree: a árvore enviada é o projeto inteiro (arquivos apagados aqui somem lá).
    const newTree = await gh('/repos/' + owner + '/' + repo + '/git/trees', { method: 'POST', body: { tree: entries } });
    const commit = await gh('/repos/' + owner + '/' + repo + '/git/commits', { method: 'POST', body: { message: message || 'Atualização pelo Mini SK', tree: newTree.sha, parents: headSha ? [headSha] : [] } });
    await gh('/repos/' + owner + '/' + repo + '/git/refs/heads/' + encodeURIComponent(branch), { method: 'PATCH', body: { sha: commit.sha, force: false } });
    setLink({ owner, repo, branch });
    const rem = opts.mirror === false ? 0 : removed.length;
    status('✅ Enviado: ' + up + ' arquivo(s) novos/alterados, ' + same + ' iguais' + (rem ? ', ' + rem + ' apagado(s) no GitHub' : '') + '.', 'ok');
    renderLink();
    return { up, same, removed: rem, commit: commit.html_url, sha: commit.sha };
  }

  async function createRepo(name, priv) {
    const r = await gh('/user/repos', { method: 'POST', body: { name, private: !!priv, auto_init: false, description: 'Criado pelo Mini SK' } });
    return { owner: r.owner.login, repo: r.name, branch: r.default_branch || 'main' };
  }
  async function enablePages(owner, repo, branch) {
    try { await gh('/repos/' + owner + '/' + repo + '/pages', { method: 'POST', body: { source: { branch, path: '/' } } }); }
    catch (e) { if (!(e.status === 409 || /already/i.test(e.message))) throw e; }
    return 'https://' + owner.toLowerCase() + '.github.io/' + repo + '/';
  }

  // ── Conta (o token fica salvo; o nome da conta aparece sempre) ─────────────
  async function ensureUser(force) {
    if (!token) throw new Error('Cole o token do GitHub primeiro.');
    if (me && !force) return me;
    me = await gh('/user');
    SK.pref.set('ghUser', { login: me.login, avatar: me.avatar_url, name: me.name || '' });
    return me;
  }
  const repoSlug = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^A-Za-z0-9._-]/g, '').replace(/^[-.]+|[-.]+$/g, '').slice(0, 100);
  /** "meu-app" → sua conta/meu-app ; "dono/app" ou link → como está. */
  async function resolveRepo(input) {
    const p = parseRepo(input);
    if (p) return p;
    const name = repoSlug(input);
    if (!name) throw new Error('Escreva um nome para o repositório (ex.: meu-app).');
    const u = await ensureUser();
    return { owner: u.login, repo: name };
  }
  /** Garante que o repositório existe; se for seu e não existir, cria. */
  async function ensureRepo(r, priv) {
    try { return { info: await gh('/repos/' + r.owner + '/' + r.repo), created: false }; }
    catch (e) {
      if (e.status !== 404) throw e;
      const u = await ensureUser();
      if (u.login.toLowerCase() !== r.owner.toLowerCase()) throw new Error('O repositório ' + r.owner + '/' + r.repo + ' não existe ou o token não tem acesso a ele.');
      status('Criando o repositório ' + r.repo + '…');
      await createRepo(r.repo, priv);
      return { info: await gh('/repos/' + r.owner + '/' + r.repo), created: true };
    }
  }
  /** Envia o projeto: só precisa do nome. Cria o repositório se não existir. */
  async function sendTo(input, message, opts) {
    opts = opts || {};
    const r = await resolveRepo(input);
    const { created } = await ensureRepo(r, opts.priv);
    const res = await push(r.owner, r.repo, opts.branch || '', message, opts);
    return Object.assign({ owner: r.owner, repo: r.repo, created }, res || {});
  }

  // ── Painel ──────────────────────────────────────────────────────────────────
  function build(container) {
    box = container;
    box.innerHTML =
      '<div class="gh-acc" id="gh-acc"></div>' +
      '<div class="gh-tokrow" id="gh-tokrow">' +
      '  <p class="muted small">Cole o seu token (github.com/settings/tokens → "Generate new token"). Permissões como <b>Read and write</b>: <b>Contents</b>, <b>Actions</b>, <b>Workflows</b> (para enviar as receitas de teste/APK) e <b>Administration</b> (para criar repositórios). Fica salvo só neste aparelho.</p>' +
      '  <div class="row"><input class="inp mono grow" id="gh-token" type="password" placeholder="github_pat_… ou ghp_…" autocomplete="off"><button class="btn primary" id="gh-save">Salvar</button></div>' +
      '</div>' +
      '<div class="gh-sec"><h4>⤒ Enviar este projeto</h4>' +
      '  <div class="row"><input class="inp mono grow" id="gh-name" placeholder="nome-do-repositorio" autocomplete="off"><label class="chk"><input type="checkbox" id="gh-priv"> Privado</label></div>' +
      '  <p class="muted small" style="margin:2px 0">Só o nome. Se não existir, o Mini SK cria. Pode ter quantos quiser.</p>' +
      '  <textarea class="inp" id="gh-msg" rows="2" placeholder="O que mudou? (opcional)"></textarea>' +
      '  <details><summary class="small">Opções</summary><div class="stack" style="margin-top:6px"><label class="chk"><input type="checkbox" id="gh-mirror" checked> Apagar no GitHub o que foi apagado aqui</label><label class="chk"><input type="checkbox" id="gh-sk" checked> Enviar também a pasta .sk (memória da IA)</label><input class="inp mono" id="gh-branch" placeholder="ramo (vazio = principal)"></div></details>' +
      '  <div class="row wrap"><button class="btn primary" id="gh-push">⤒ Enviar</button><button class="btn small" id="gh-pages">🌐 Publicar site (Pages)</button></div>' +
      '  <div class="gh-status" id="gh-status"></div><div id="gh-done" class="small"></div></div>' +
      '<div class="gh-sec" id="gh-acoes"></div>' +
      '<div class="gh-sec"><h4>⤓ Meus repositórios <button class="btn tiny" id="gh-reload" title="Atualizar lista">🔄</button></h4>' +
      '  <input class="inp" id="gh-filter" placeholder="Filtrar…">' +
      '  <div class="gh-list" id="gh-list"><p class="muted small">Salve o token para ver seus repositórios.</p></div></div>' +
      '<div class="gh-sec"><h4>🌐 Importar por link (público ou seu)</h4>' +
      '  <div class="row"><input class="inp mono grow" id="gh-url" placeholder="https://github.com/dono/repo ou dono/repo"><button class="btn small" id="gh-url-go">Importar</button></div></div>';
    const $ = (s) => SK.$(s, box);
    const saveTok = () => run(async () => {
      token = $('#gh-token').value.trim(); SK.pref.set('ghToken', token); me = null;
      if (!token) { renderAcc(); return; }
      status('Conferindo o token…');
      await ensureUser(true); renderAcc(); status('✅ Conectado como ' + me.login, 'ok'); loadRepos();
    });
    $('#gh-save').onclick = saveTok;
    $('#gh-token').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveTok(); });
    $('#gh-token').addEventListener('paste', () => setTimeout(saveTok, 50));
    $('#gh-acc').addEventListener('click', (e) => {
      if (e.target.closest('#gh-change')) { $('#gh-tokrow').hidden = !$('#gh-tokrow').hidden; $('#gh-token').value = ''; $('#gh-token').focus(); }
      if (e.target.closest('#gh-out')) { token = ''; me = null; SK.pref.set('ghToken', ''); SK.pref.set('ghUser', null); renderAcc(); $('#gh-list').innerHTML = '<p class="muted small">Salve o token para ver seus repositórios.</p>'; }
    });
    $('#gh-push').onclick = () => run(async () => {
      const name = $('#gh-name').value.trim() || repoSlug(fs().project.name);
      $('#gh-name').value = name;
      status('Enviando…');
      const r = await sendTo(name, $('#gh-msg').value.trim(), { priv: $('#gh-priv').checked, mirror: $('#gh-mirror').checked, includeSk: $('#gh-sk').checked, branch: $('#gh-branch').value.trim() });
      $('#gh-msg').value = '';
      $('#gh-done').innerHTML = (r.created ? '🆕 Repositório criado. ' : '') + '<a href="https://github.com/' + SK.esc(r.owner + '/' + r.repo) + '" target="_blank" rel="noopener">abrir ' + SK.esc(r.owner + '/' + r.repo) + ' ↗</a>';
      loadRepos();
      if (SK.acoes && r.sha) SK.acoes.afterPush(r);
    });
    $('#gh-pages').onclick = () => run(async () => {
      const r = await resolveRepo($('#gh-name').value.trim() || repoSlug(fs().project.name));
      const info = await gh('/repos/' + r.owner + '/' + r.repo);
      if (info.private) SK.toast('No plano grátis, o Pages só funciona em repositório público', 'error');
      const url = await enablePages(r.owner, r.repo, $('#gh-branch').value.trim() || info.default_branch);
      status('🌐 Site pedido. Em 1–2 minutos estará em: ' + url, 'ok');
      $('#gh-done').innerHTML = '<a href="' + SK.esc(url) + '" target="_blank" rel="noopener">' + SK.esc(url) + ' ↗</a>';
    });
    $('#gh-reload').onclick = () => run(loadRepos);
    $('#gh-filter').addEventListener('input', renderRepos);
    $('#gh-list').addEventListener('click', (e) => {
      const b = e.target.closest('[data-imp]'); if (!b) return;
      const full = b.closest('[data-full]').dataset.full; const [o, n] = full.split('/');
      run(async () => {
        if (b.dataset.imp === 'here') { if (!(await SK.confirm('Substituir os arquivos deste projeto pelos de ' + full + '? Um checkpoint é criado antes.', { okText: 'Puxar' }))) return; await importRepo(o, n, '', true); }
        else await importRepo(o, n, '', false);
        $('#gh-name').value = n;
      });
    });
    $('#gh-url-go').onclick = () => run(async () => { const r = parseRepo($('#gh-url').value); if (!r) throw new Error('Cole o link do repositório (https://github.com/dono/repo) ou escreva dono/repo.'); await importRepo(r.owner, r.repo, '', false); });
    if (SK.acoes) SK.acoes.mount($('#gh-acoes'));
    renderAcc(); renderLink();
    if (token) { ensureUser().then(() => { renderAcc(); loadRepos(); }).catch((e) => status('⚠ ' + e.message, 'error')); }
  }

  async function loadRepos() {
    if (!token || !box) return;
    const el = SK.$('#gh-list', box); el.innerHTML = '<p class="muted small">Carregando…</p>';
    try { repos = await gh('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator'); renderRepos(); }
    catch (e) { el.innerHTML = '<p class="msg error">' + SK.esc(e.message) + '</p>'; }
  }
  function renderRepos() {
    if (!box) return;
    const q = SK.$('#gh-filter', box).value.trim().toLowerCase();
    const list = repos.filter((r) => !q || r.full_name.toLowerCase().includes(q));
    SK.$('#gh-list', box).innerHTML = list.length ? list.map((r) => '<div class="gh-repo" data-full="' + SK.esc(r.full_name) + '"><div class="grow"><b>' + SK.esc(r.name) + '</b>' + (r.private ? ' 🔒' : '') + '<div class="muted small">' + SK.esc(r.owner.login) + ' · ' + new Date(r.updated_at).toLocaleDateString('pt-BR') + '</div></div><button class="btn tiny primary" data-imp="new" title="Abrir como projeto novo">⤓ Importar</button><button class="btn tiny" data-imp="here" title="Substituir os arquivos deste projeto">⟲ Puxar aqui</button></div>').join('') : '<p class="muted small">Nenhum repositório' + (q ? ' com esse nome' : '') + '.</p>';
  }
  function renderAcc() {
    if (!box) return;
    const saved = SK.pref.get('ghUser', null);
    const u = me ? { login: me.login, avatar: me.avatar_url, name: me.name } : (token ? saved : null);
    SK.$('#gh-acc', box).innerHTML = u
      ? '<div class="row"><img class="gh-av" src="' + SK.esc(u.avatar || '') + '" alt=""><div class="grow"><div class="small muted">Conectado como</div><b>' + SK.esc(u.login) + '</b>' + (u.name ? ' <span class="muted small">' + SK.esc(u.name) + '</span>' : '') + '</div><button class="btn tiny" id="gh-change">Trocar token</button><button class="btn tiny danger" id="gh-out">Sair</button></div>'
      : '<div class="muted small">🔑 Nenhuma conta conectada.</div>';
    SK.$('#gh-tokrow', box).hidden = !!u;
  }
  async function run(fn) {
    const btns = SK.$$('button', box); btns.forEach((b) => (b.disabled = true));
    try { await fn(); } catch (e) { status('⚠ ' + (e.message === 'EMPTY' ? 'Repositório vazio.' : e.message), 'error'); }
    finally { btns.forEach((b) => (b.disabled = false)); }
  }
  function renderLink() {
    if (!box) return;
    const l = getLink();
    SK.$('#gh-name', box).value = l ? (me && l.owner.toLowerCase() === me.login.toLowerCase() ? l.repo : l.owner + '/' + l.repo) : repoSlug(fs().project ? fs().project.name : '');
    SK.$('#gh-branch', box).value = l && l.branch ? l.branch : '';
  }
  SK.on('project-open', () => { if (box) { SK.$('#gh-done', box).innerHTML = ''; renderLink(); } });

  SK.on('cofre-aplicado', () => { const t = SK.pref.get('ghToken', ''); if (t !== token) { token = t; me = null; if (box) { renderAcc(); if (token) ensureUser().then(() => { renderAcc(); loadRepos(); }).catch(() => {}); } } });
  SK.github = { build, gh, importRepo, push, createRepo, enablePages, parseRepo, getLink, resolveRepo, ensureRepo, ensureUser, sendTo, repoSlug, get token() { return token; }, get user() { return me; } };
})(window.SK);
