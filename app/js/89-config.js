/* =========================================================================
   Mini SK — 89-config.js
   ⚙️ Configuração: 🔑 Cofre de chaves (IA, GitHub e "Minhas chaves").
   Tudo guardado SÓ neste aparelho. Sem login, sem nuvem.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const COFRE_PREFS = ['aiKeys', 'aiActive', 'ghToken', 'ghUser', 'apiBase', 'expoToken'];
  const MAX_PROJ = 15 * 1024 * 1024;
  let box = null, applying = false;

  const SQL = `-- Mini SK: rode no Supabase (menu SQL Editor → New query → Run).
-- Pode rodar quantas vezes quiser: não duplica nada e não apaga nada.
-- Não mexe em nenhuma outra tabela que você já tenha.
create table if not exists public.minisk_dados (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave text not null,
  valor jsonb,
  atualizado timestamptz not null default now(),
  primary key (user_id, chave)
);
alter table public.minisk_dados enable row level security;
drop policy if exists "minisk: dono ve" on public.minisk_dados;
drop policy if exists "minisk: dono cria" on public.minisk_dados;
drop policy if exists "minisk: dono muda" on public.minisk_dados;
drop policy if exists "minisk: dono apaga" on public.minisk_dados;
create policy "minisk: dono ve" on public.minisk_dados for select using (auth.uid() = user_id);
create policy "minisk: dono cria" on public.minisk_dados for insert with check (auth.uid() = user_id);
create policy "minisk: dono muda" on public.minisk_dados for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "minisk: dono apaga" on public.minisk_dados for delete using (auth.uid() = user_id);
grant select, insert, update, delete on public.minisk_dados to authenticated;
-- avisa o Supabase para "enxergar" a tabela na hora (sem isso pode demorar):
notify pgrst, 'reload schema';
`;

  // ── Cofre de chaves ─────────────────────────────────────────────────────────
  const extras = () => SK.pref.get('minhasChaves', []);
  function cofreLocal() {
    const o = { extras: extras() };
    COFRE_PREFS.forEach((k) => { const v = SK.pref.get(k, undefined); if (v !== undefined && v !== null && v !== '') o[k] = v; });
    return o;
  }
  function aplicaCofre(o) {
    if (!o) return;
    applying = true;
    try {
      COFRE_PREFS.forEach((k) => { if (o[k] !== undefined) SK.pref.set(k, o[k]); });
      if (Array.isArray(o.extras)) SK.pref.set('minhasChaves', o.extras);
    } finally { applying = false; }
    SK.emit('cofre-aplicado');
  }
  const enviaCofre = SK.debounce(async () => {
    if (!SK.nuvem.pronto) return;
    try { await SK.nuvem.set('cofre', cofreLocal()); setStatus('🔑 Chaves guardadas na conta.', 'ok'); } catch (e) { setStatus('⚠ ' + e.message, 'error'); }
  }, 1500);

  // Toda vez que uma chave muda aqui, vai para a conta também
  const origSet = SK.pref.set;
  SK.pref.set = function (k, v) {
    origSet.call(SK.pref, k, v);
    if (!applying && (COFRE_PREFS.includes(k) || k === 'minhasChaves')) enviaCofre();
  };
  SK.on('conta-apagar-chaves', () => { applying = true; try { COFRE_PREFS.concat('minhasChaves').forEach((k) => { try { localStorage.removeItem('minisk2:' + k); } catch {} }); } finally { applying = false; } });

  // ── Backup na nuvem ─────────────────────────────────────────────────────────
  const auto = () => SK.pref.get('nuvemAuto', true);
  async function enviaProjeto(P, quiet) {
    P = P || fs().project; if (!P || !SK.nuvem.pronto) return;
    const json = JSON.stringify(P);
    if (json.length > MAX_PROJ) { if (!quiet) setStatus('⚠ "' + P.name + '" é grande demais para a nuvem (' + SK.bytes(json.length) + '). Use o GitHub para ele.', 'error'); return; }
    await SK.nuvem.set('projeto:' + P.name, P);
    SK.pref.set('nuvemUltimo', Date.now());
    if (!quiet) setStatus('☁️ "' + P.name + '" guardado na nuvem.', 'ok');
    renderBackup();
  }
  const enviaAuto = SK.debounce(() => { if (auto()) enviaProjeto(null, true).catch(() => {}); }, 30000);
  SK.on('saved', enviaAuto);

  async function sincPlayground() {
    if (!SK.nuvem.pronto) return;
    const local = (await SK.db.get('kv', 'play:salvos').catch(() => null)) || [];
    const remoto = ((await SK.nuvem.get('playground')) || {}).valor || [];
    const map = new Map();
    for (const x of [...remoto, ...local]) { const y = map.get(x.id); if (!y || (x.updated || 0) >= (y.updated || 0)) map.set(x.id, x); }
    const junto = [...map.values()];
    await SK.db.put('kv', junto, 'play:salvos');
    await SK.nuvem.set('playground', junto);
    SK.emit('play-reload');
    return junto.length;
  }
  const enviaPlayground = SK.debounce(async (list) => { if (SK.nuvem.pronto && auto()) { try { await SK.nuvem.set('playground', list); } catch {} } }, 5000);
  SK.on('play-salvos', enviaPlayground);

  // Ao entrar: traz as chaves, junta os Salvos e manda o projeto aberto
  SK.on('conta-entrou', async (info) => {
    renderAll();
    if (info && info.offline) return;
    try {
      const c = await SK.nuvem.get('cofre');
      if (c && c.valor) aplicaCofre(c.valor);
      else await SK.nuvem.set('cofre', cofreLocal());
      const n = await sincPlayground();
      setStatus('✅ Conectado. Chaves e ' + (n || 0) + ' Salvo(s) do Playground em dia.', 'ok');
      if (auto()) enviaProjeto(null, true).catch(() => {});
    } catch (e) { setStatus('⚠ ' + e.message, 'error'); }
    renderAll();
  });
  SK.on('conta-saiu', renderAll);
  SK.on('conta-cfg', renderAll);

  // ── Painel ──────────────────────────────────────────────────────────────────
  function setStatus(t, kind) { const el = box && box.querySelector('#cf-status'); if (el) { el.textContent = t || ''; el.className = 'gh-status ' + (kind || ''); } }
  function build(el) {
    box = el;
    box.innerHTML =
      '<div class="gh-status" id="cf-status"></div>' +
      '<div class="gh-sec" id="cf-cofre"></div>' +
      '<p class="muted small">Tudo fica só neste aparelho (sem login e sem nuvem). Para guardar uma cópia dos projetos: 🐙 GitHub, ou ⤓ baixar o projeto em .zip.</p>';
    box.addEventListener('click', onClick);
    box.addEventListener('change', onChange);
    renderAll();
  }
  function renderAll() { if (!box) return; renderCofre(); }

  function renderConta() {
    const el = box.querySelector('#cf-conta'), c = SK.conta.cfg(), u = SK.conta.user;
    if (!c.ok) { el.innerHTML = '<h4>👤 Conta</h4><p class="muted small">Sem conta: tudo fica só neste aparelho. Para ter <b>senha na entrada</b>, chaves guardadas e backup na nuvem, faça a <b>ligação com a nuvem</b> lá embaixo (uma vez só).</p>'; return; }
    if (!SK.conta.logado) { el.innerHTML = '<h4>👤 Conta</h4><p class="muted small">Você não entrou.</p><button class="btn primary" data-c="entrar">Entrar</button>'; return; }
    el.innerHTML = '<h4>👤 Conta</h4>' +
      '<div class="small">Entrou como <b>' + SK.esc((u && u.email) || '…') + '</b>' + (SK.conta.offline ? ' <span class="pill warn">sem internet</span>' : '') + '</div>' +
      '<label class="chk"><input type="checkbox" id="cf-pedir"' + (c.pedirLogin ? ' checked' : '') + '> Pedir a senha toda vez que abrir</label>' +
      '<div class="row wrap"><button class="btn small" data-c="senha">🔑 Trocar senha</button><button class="btn small" data-c="sair">Sair</button><button class="btn small danger" data-c="sair-apagar" title="Sai e apaga as chaves deste aparelho (elas continuam na sua conta)">Sair e apagar chaves daqui</button></div>';
  }

  function renderCofre() {
    const el = box.querySelector('#cf-cofre');
    const aiKeys = SK.pref.get('aiKeys', []);
    const nAi = Array.isArray(aiKeys) ? aiKeys.length : Object.keys(aiKeys || {}).length;
    const gh = !!SK.pref.get('ghToken', '');
    const list = extras();
    el.innerHTML = '<h4>🔑 Cofre de chaves</h4>' +
      '<p class="muted small" style="margin:0">' + (SK.nuvem.pronto ? 'Guardado <b>na sua conta</b>: entrou em outro aparelho, já está lá.' : 'Guardado neste aparelho' + (SK.conta.cfg().ok ? ' (entre na conta para guardar na nuvem também).' : '.')) + '</p>' +
      '<div class="small">🤖 IA: <b>' + nAi + '</b> chave(s) · 🐙 GitHub: <b>' + (gh ? 'salvo' : '—') + '</b></div>' +
      '<b class="small">Minhas chaves e links</b>' +
      (list.length ? list.map((x, i) =>
        '<div class="gh-repo" data-i="' + i + '"><div class="grow" style="min-width:0"><b>' + SK.esc(x.nome) + '</b><div class="muted small mono cf-val">' + mask(x.valor) + '</div></div>' +
        '<button class="btn tiny" data-c="ver" title="Mostrar">👁</button><button class="btn tiny" data-c="copiar" title="Copiar">📋</button><button class="btn tiny" data-c="editar" title="Editar">✏️</button><button class="btn tiny" data-c="apagar" title="Apagar">🗑</button></div>').join('')
        : '<p class="muted small" style="margin:0">Nada ainda. Ex.: "Link do Neon", "DataJud", "Senha do PDPJ".</p>') +
      '<button class="btn small" data-c="nova">＋ Guardar chave ou link</button>';
  }
  const mask = (v) => { v = String(v || ''); return SK.esc(v.length <= 8 ? '••••••' : v.slice(0, 4) + '••••••' + v.slice(-3)); };

  async function renderBackup() {
    if (!box) return;
    const el = box.querySelector('#cf-backup');
    if (!SK.conta.cfg().ok) { el.innerHTML = ''; return; }
    const last = SK.pref.get('nuvemUltimo', 0);
    el.innerHTML = '<h4>☁️ Backup na nuvem <button class="btn tiny" data-c="recarregar" title="Atualizar">🔄</button></h4>' +
      '<label class="chk"><input type="checkbox" id="cf-auto"' + (auto() ? ' checked' : '') + '> Guardar sozinho (o projeto aberto e os Salvos do Playground)</label>' +
      '<div class="row wrap"><button class="btn small primary" data-c="enviar">☁️ Guardar este projeto agora</button><button class="btn small" data-c="play">▶️ Sincronizar Playground</button></div>' +
      '<p class="muted small" style="margin:0">' + (last ? 'Último envio: ' + new Date(last).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Ainda nada enviado.') + '</p>' +
      '<b class="small">Projetos na nuvem</b><div id="cf-lista" class="stack"><p class="muted small">' + (SK.nuvem.pronto ? 'Carregando…' : 'Entre na conta para ver.') + '</p></div>';
    if (!SK.nuvem.pronto) return;
    try {
      const rows = await SK.nuvem.list('projeto:');
      const lista = el.querySelector('#cf-lista'); if (!lista) return;
      lista.innerHTML = rows.length ? rows.map((r) => {
        const nome = r.chave.slice(8);
        return '<div class="gh-repo" data-p="' + SK.esc(nome) + '"><div class="grow"><b>' + SK.esc(nome) + '</b><div class="muted small">' + new Date(r.atualizado).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + '</div></div>' +
          '<button class="btn tiny primary" data-c="baixar">⤓ Abrir</button><button class="btn tiny" data-c="tirar" title="Apagar da nuvem">🗑</button></div>';
      }).join('') : '<p class="muted small">Nenhum projeto na nuvem ainda.</p>';
    } catch (e) { const l = el.querySelector('#cf-lista'); if (l) l.innerHTML = '<p class="msg error">' + SK.esc(e.message) + '</p>'; }
  }

  function renderNuvem() {
    const el = box.querySelector('#cf-nuvem'), c = SK.conta.cfg();
    el.innerHTML =
      '<p class="muted small" style="margin:0">Uma vez só. Pegue no Supabase em <b>Project Settings → API</b> (ou "Data API"): o <b>Project URL</b> e a chave <b>Publishable key</b> (sb_publishable_…) ou <b>anon public</b> (eyJ…) — NUNCA a “secret” nem a “service_role”. Essa chave é pública de propósito: sozinha ela não abre nada, quem protege é o login.</p>' +
      '<input class="inp mono" id="cf-url" placeholder="https://xxxx.supabase.co" value="' + SK.esc(c.url) + '" autocomplete="off">' +
      '<input class="inp mono" id="cf-anon" type="password" placeholder="Publishable key (sb_publishable_…) ou anon public (eyJ…)" value="' + SK.esc(c.anon) + '" autocomplete="off">' +
      '<div class="row wrap"><button class="btn small primary" data-c="salvar-cfg">Salvar e testar</button><button class="btn small" data-c="sql">📋 Copiar o SQL (rodar 1 vez)</button><button class="btn small" data-c="configjs" title="Para o Mini SK publicado (GitHub Pages) já vir ligado">⤓ config.js</button>' + (c.desligada ? '<button class="btn small primary" data-c="religar">☁️ Religar a nuvem</button>' : '') + (c.ok ? '<button class="btn small danger" data-c="desligar">Desligar a nuvem</button>' : '') + '</div>' +
      '<details><summary class="small">Passo a passo</summary><ol class="small" style="padding-left:18px;margin:6px 0">' +
        '<li>No Supabase: <b>SQL Editor</b> → <b>New query</b> → cole o SQL (botão acima) → <b>Run</b>. Ele cria só a tabela <code>minisk_dados</code>, sem mexer nas outras.</li>' +
        '<li>Em <b>Authentication → URL Configuration</b>, coloque o endereço do seu Mini SK em <b>Site URL</b> (ex.: <code>https://seu-usuario.github.io/mini-sk/</code>). É para onde o link de "Esqueci a senha" volta.</li>' +
        '<li>Cole aqui o URL e a chave anon e toque em <b>Salvar e testar</b>.</li>' +
        '<li>Para o Mini SK publicado já vir ligado em qualquer aparelho, baixe o <b>config.js</b> e troque o arquivo de mesmo nome na pasta do Mini SK.</li></ol></details>';
  }

  async function onChange(e) {
    if (e.target.id === 'cf-pedir') SK.conta.setCfg({ pedirLogin: e.target.checked });
    if (e.target.id === 'cf-auto') { SK.pref.set('nuvemAuto', e.target.checked); if (e.target.checked) enviaProjeto().catch((er) => setStatus('⚠ ' + er.message, 'error')); }
  }
  async function onClick(e) {
    const b = e.target.closest('[data-c]'); if (!b) return;
    const c = b.dataset.c;
    const row = b.closest('[data-i]'), i = row ? Number(row.dataset.i) : -1;
    const prow = b.closest('[data-p]'), pnome = prow ? prow.dataset.p : null;
    try {
      if (c === 'entrar') SK.conta.showGate('login');
      if (c === 'sair') { if (await SK.confirm('Sair da conta? Seus projetos continuam neste aparelho.', { okText: 'Sair' })) SK.conta.logout(false); }
      if (c === 'sair-apagar') { if (await SK.confirm('Sair e apagar as chaves DESTE aparelho? Elas continuam guardadas na sua conta e voltam quando você entrar.', { okText: 'Sair e apagar', danger: true })) SK.conta.logout(true); }
      if (c === 'senha') {
        const p1 = await SK.prompt('Senha nova (mínimo 6 caracteres):', '', { okText: 'Continuar' }); if (!p1) return;
        const p2 = await SK.prompt('Repita a senha nova:', '', { okText: 'Trocar' }); if (p2 == null) return;
        if (p1 !== p2) return SK.toast('As senhas não são iguais', 'error');
        await SK.conta.setPassword(p1); SK.toast('🔑 Senha trocada', 'ok');
      }
      if (c === 'nova' || c === 'editar') {
        const cur = i >= 0 ? extras()[i] : { nome: '', valor: '' };
        const nome = await SK.prompt('Nome (ex.: Link do Neon):', cur.nome, { okText: 'Próximo' }); if (nome == null || !nome.trim()) return;
        const valor = await SK.prompt('A chave ou o link:', cur.valor, { okText: 'Guardar' }); if (valor == null) return;
        const l = extras(); const item = { nome: nome.trim(), valor: valor.trim() };
        if (i >= 0) l[i] = item; else l.push(item);
        SK.pref.set('minhasChaves', l); renderCofre(); SK.toast('🔑 Guardado', 'ok');
      }
      if (c === 'ver' && i >= 0) { const v = row.querySelector('.cf-val'); v.textContent = v.dataset.on ? '' : extras()[i].valor; if (v.dataset.on) v.innerHTML = mask(extras()[i].valor); v.dataset.on = v.dataset.on ? '' : '1'; }
      if (c === 'copiar' && i >= 0) { await SK.copy(extras()[i].valor); SK.toast('Copiado'); }
      if (c === 'apagar' && i >= 0) { if (!(await SK.confirm('Apagar "' + extras()[i].nome + '"?', { okText: 'Apagar', danger: true }))) return; const l = extras(); l.splice(i, 1); SK.pref.set('minhasChaves', l); renderCofre(); }
      if (c === 'enviar') await enviaProjeto();
      if (c === 'play') { const n = await sincPlayground(); setStatus('▶️ Playground em dia: ' + n + ' Salvo(s).', 'ok'); }
      if (c === 'recarregar') renderBackup();
      if (c === 'baixar' && pnome) {
        const r = await SK.nuvem.get('projeto:' + pnome); if (!r || !r.valor) throw new Error('Não achei esse projeto na nuvem.');
        const existe = await SK.db.get('projects', pnome);
        if (existe && !(await SK.confirm('"' + pnome + '" já existe neste aparelho. Trocar pelo da nuvem? (um checkpoint é criado antes)', { okText: 'Trocar' }))) return;
        if (existe && fs().project && fs().project.name === pnome) { try { await SK.checkpoints.auto('Antes de trazer da nuvem'); } catch {} }
        const P = Object.assign({}, r.valor, { name: pnome, updated: Date.now() });
        await SK.db.put('projects', P);
        await fs().open(pnome);
        SK.toast('⤓ "' + pnome + '" aberto (veio da nuvem)', 'ok');
      }
      if (c === 'tirar' && pnome) { if (!(await SK.confirm('Apagar "' + pnome + '" da NUVEM? (neste aparelho não muda nada)', { okText: 'Apagar da nuvem', danger: true }))) return; await SK.nuvem.del('projeto:' + pnome); renderBackup(); }
      if (c === 'sql') { await SK.copy(SQL); SK.toast('SQL copiado. Cole no Supabase → SQL Editor → Run.', 'ok'); }
      if (c === 'configjs') {
        const cf = SK.conta.cfg();
        SK.download('config.js', '/* Mini SK — ligação com a nuvem (Supabase).\n   A chave "anon" é pública de propósito: quem protege os dados é o login.\n   NUNCA coloque aqui a chave "service_role". */\nwindow.SK_CONFIG = {\n  supabaseUrl: ' + JSON.stringify(cf.url) + ',\n  supabaseAnonKey: ' + JSON.stringify(cf.anon) + ',\n};\n', 'text/javascript');
      }
      if (c === 'desligar') { if (!(await SK.confirm('Desligar a nuvem neste aparelho? A tela de entrada some e tudo fica só aqui. Nada é apagado na nuvem.', { okText: 'Desligar', danger: true }))) return; SK.conta.setCfg({ desligada: true }); SK.conta.logout(false); location.reload(); }
      if (c === 'religar') { SK.conta.setCfg({ desligada: false }); location.reload(); }
      if (c === 'salvar-cfg') {
        const url = box.querySelector('#cf-url').value.trim().replace(/\/+$/, ''), anon = box.querySelector('#cf-anon').value.trim();
        if (/service_role/.test(atobSafe(anon)) || /^sb_secret_/.test(anon)) throw new Error('Essa é a chave SECRETA do Supabase — o navegador recusa ela. Use a “Publishable key” (começa com sb_publishable_) ou a “anon public” (começa com eyJ).');
        if (!/^https:\/\/[^/]+$/.test(url)) throw new Error('O endereço deve ser assim: https://xxxx.supabase.co');
        SK.conta.setCfg({ url, anon, desligada: false });
        setStatus('Testando…');
        await SK.conta.call('/auth/v1/settings', { auth: false });
        setStatus('✅ Ligação OK. Agora entre ou crie sua conta.', 'ok');
        SK.conta.showGate(SK.conta.logado ? 'login' : 'signup');
      }
    } catch (er) { setStatus('⚠ ' + er.message, 'error'); }
  }
  function atobSafe(jwt) { try { return atob(String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')); } catch { return ''; } }

  SK.config = { build, SQL, sincPlayground, enviaProjeto };
})(window.SK);
