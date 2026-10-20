/* =========================================================================
   Mini SK — 85-checkpoints.js
   Pontos de volta. Uma "foto" de todos os arquivos do projeto.
   - Manual: você cria quando quiser (botão 📸 ou Ctrl+S duas vezes).
   - Automático: antes de apagar, importar, trocar tudo, aplicar código da IA,
     importar do GitHub e antes de voltar a um checkpoint.
   Guardados no navegador (IndexedDB). Os automáticos mais antigos são
   apagados quando passam de 40; os manuais nunca são apagados sozinhos.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const MAX_AUTO = 40;
  let box;

  function sizeOf(snap) { return Object.values(snap.files).reduce((s, r) => s + (r.size || 0), 0); }

  async function create(label, kind) {
    const P = fs().project; if (!P) return null;
    await fs().saveNow();
    const snap = fs().snapshot();
    const cp = {
      id: P.name + '|' + Date.now() + '|' + SK.uid(),
      project: P.name, label: label || 'Checkpoint', kind: kind || 'manual',
      at: Date.now(), count: Object.keys(snap.files).length, size: sizeOf(snap), snap,
    };
    try { await SK.db.put('checkpoints', cp); }
    catch (e) { SK.toast('Não consegui criar o checkpoint: ' + e.message, 'error'); return null; }
    if (kind === 'auto') prune(P.name);
    SK.emit('checkpoints-change');
    return cp;
  }
  async function prune(project) {
    const all = (await list(project)).filter((c) => c.kind === 'auto');
    for (const c of all.slice(MAX_AUTO)) await SK.db.del('checkpoints', c.id);
  }
  async function list(project) {
    project = project || (fs().project && fs().project.name);
    if (!project) return [];
    const all = await SK.db.allByIndex('checkpoints', 'project', project);
    return all.sort((a, b) => b.at - a.at);
  }
  async function restore(id) {
    const cp = await SK.db.get('checkpoints', id); if (!cp) return false;
    await create('Antes de voltar para "' + cp.label + '"', 'auto');
    fs().restore(cp.snap);
    await fs().saveNow();
    SK.toast('Projeto voltou para: ' + cp.label);
    SK.emit('checkpoints-change');
    return true;
  }
  async function remove(id) { await SK.db.del('checkpoints', id); SK.emit('checkpoints-change'); }

  /** Diferença entre o checkpoint e o projeto atual. */
  function diff(cp) {
    const now = fs().project.files, then = cp.snap.files;
    const added = [], removed = [], changed = [];
    for (const p in now) { if (!then[p]) added.push(p); else if ((now[p].text ?? now[p].b64) !== (then[p].text ?? then[p].b64)) changed.push(p); }
    for (const p in then) if (!now[p]) removed.push(p);
    return { added, removed, changed };
  }

  // ── Painel ──────────────────────────────────────────────────────────────────
  function build(container) {
    box = container;
    box.innerHTML =
      '<div class="stack">' +
      '<div class="row"><input class="inp grow" id="cp-name" placeholder="Nome do checkpoint (ex.: login funcionando)"><button class="btn primary" id="cp-new">📸 Criar</button></div>' +
      '<p class="muted small">Checkpoint é uma foto do projeto inteiro. Se algo quebrar, toque em <b>Voltar</b>. Antes de voltar, o Mini SK tira outra foto — então nada se perde.</p>' +
      '</div><div class="cp-list" id="cp-list"></div>';
    SK.$('#cp-new', box).onclick = async () => {
      const inp = SK.$('#cp-name', box);
      const cp = await create(inp.value.trim() || 'Checkpoint ' + new Date().toLocaleString('pt-BR'), 'manual');
      if (cp) { inp.value = ''; SK.toast('📸 Checkpoint criado'); }
    };
    SK.$('#cp-name', box).addEventListener('keydown', (e) => { if (e.key === 'Enter') SK.$('#cp-new', box).click(); });
    SK.$('#cp-list', box).addEventListener('click', onClick);
    render();
  }
  async function render() {
    if (!box) return;
    const el = SK.$('#cp-list', box);
    const all = await list();
    if (!all.length) { el.innerHTML = '<p class="muted">Nenhum checkpoint ainda.</p>'; return; }
    el.innerHTML = all.map((c) =>
      '<div class="cp" data-id="' + SK.esc(c.id) + '">' +
      '<div class="cp-top"><b>' + SK.esc(c.label) + '</b>' + (c.kind === 'auto' ? ' <span class="pill">auto</span>' : '') + '</div>' +
      '<div class="muted small">' + new Date(c.at).toLocaleString('pt-BR') + ' · ' + c.count + ' arquivos · ' + SK.bytes(c.size) + '</div>' +
      '<div class="row wrap"><button class="btn tiny primary" data-c="restore">↶ Voltar</button><button class="btn tiny" data-c="diff">O que mudou?</button><button class="btn tiny" data-c="zip">⤓ .zip</button><button class="btn tiny danger" data-c="del">Apagar</button></div>' +
      '<div class="cp-diff" hidden></div></div>').join('');
  }
  async function onClick(e) {
    const b = e.target.closest('[data-c]'); if (!b) return;
    const card = b.closest('.cp'); const id = card.dataset.id;
    const cp = await SK.db.get('checkpoints', id); if (!cp) return render();
    const act = b.dataset.c;
    if (act === 'restore') {
      if (await SK.confirm('Voltar o projeto para "' + cp.label + '"? (Uma foto do estado atual será guardada antes.)', { title: 'Voltar checkpoint', okText: 'Voltar' })) await restore(id);
    }
    if (act === 'del') { if (await SK.confirm('Apagar o checkpoint "' + cp.label + '"?', { danger: true, okText: 'Apagar' })) await remove(id); }
    if (act === 'zip') {
      const entries = Object.keys(cp.snap.files).map((p) => { const r = cp.snap.files[p]; return { name: p, data: r.b64 != null ? fs().fromBase64(r.b64) : new TextEncoder().encode(r.text) }; });
      SK.download(cp.project + ' - ' + cp.label.replace(/[\\/:*?"<>|]/g, '_') + '.zip', await SK.zip.write(entries));
    }
    if (act === 'diff') {
      const d = diff(cp); const el = SK.$('.cp-diff', card);
      const sec = (t, arr, cls) => arr.length ? '<div class="' + cls + '"><b>' + t + ' (' + arr.length + ')</b><br>' + arr.map(SK.esc).join('<br>') + '</div>' : '';
      el.innerHTML = (sec('Criados depois', d.added, 'd-add') + sec('Alterados depois', d.changed, 'd-chg') + sec('Apagados depois', d.removed, 'd-del')) || '<span class="muted">Igual ao projeto atual.</span>';
      el.hidden = !el.hidden;
    }
  }

  SK.on('checkpoints-change', render);
  SK.on('project-open', render);

  SK.checkpoints = {
    build, create, list, restore, remove, diff, render,
    auto: (label) => create(label, 'auto'),
  };
})(window.SK);
