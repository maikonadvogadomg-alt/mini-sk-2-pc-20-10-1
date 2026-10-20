/* =========================================================================
   Mini SK — 91-acoes.js
   ⚙️ Execuções no GitHub (Actions) — dentro do painel 🐙 GitHub.
   Antes o Mini SK só ENVIAVA. Agora ele também mostra o que o GitHub
   faz com o que foi enviado:
   - Depois de "Enviar", acompanha sozinho as execuções daquele envio
     (teste, APK, site…), passo a passo: ⏳ ✅ ❌.
   - Lista as "receitas" (workflows) do repositório: ▶ Rodar agora e
     🗑 Tirar (apaga a receita no GitHub e no projeto).
   - Se falhar: mostra o passo que falhou, o trecho do registro e o botão
     "🤖 Explicar com a IA".
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const gh = (...a) => SK.github.gh(...a);
  let box = null, repo = null, timer = null;
  const ICON = { success: '✅', failure: '❌', cancelled: '⛔', skipped: '⏭', in_progress: '⏳', queued: '🕒', waiting: '🕒', requested: '🕒', pending: '🕒', neutral: '➖', timed_out: '⌛', action_required: '✋', startup_failure: '❌' };
  const ic = (x) => ICON[x.conclusion] || ICON[x.status] || '•';
  const esc = SK.esc;

  function stop() { if (timer) { clearTimeout(timer); timer = null; } }
  function status(msg, kind) { const el = box && SK.$('#ac-status', box); if (el) { el.textContent = msg || ''; el.className = 'gh-status ' + (kind || ''); } }
  const base = () => '/repos/' + repo.owner + '/' + repo.repo;

  function mount(el) {
    box = el;
    box.innerHTML =
      '<h4>⚙️ Execuções no GitHub <button class="btn tiny" id="ac-load" title="Atualizar">🔄</button></h4>' +
      '<p class="muted small" style="margin:0">O que o GitHub faz depois do envio: testes, APK, site. Depois de ⤒ Enviar, acompanho sozinho.</p>' +
      '<div class="gh-status" id="ac-status"></div>' +
      '<div id="ac-live"></div>' +
      '<details id="ac-wf-box"><summary class="small">Receitas (workflows) deste repositório</summary><div id="ac-wf" class="stack" style="margin-top:6px"></div></details>' +
      '<details id="ac-runs-box"><summary class="small">Últimas execuções</summary><div id="ac-runs" class="stack" style="margin-top:6px"></div></details>' +
      '<div id="ac-detail"></div>';
    SK.$('#ac-load', box).onclick = () => load();
    box.addEventListener('click', onClick);
  }

  async function pickRepo() {
    const name = (SK.$('#gh-name') && SK.$('#gh-name').value.trim()) || SK.github.repoSlug(fs().project.name);
    repo = await SK.github.resolveRepo(name);
    return repo;
  }

  async function load() {
    stop();
    try {
      if (!SK.github.token) { status('Salve o token do GitHub primeiro.', 'error'); return; }
      await pickRepo();
      status('Lendo ' + repo.owner + '/' + repo.repo + '…');
      const [wf, runs] = await Promise.all([gh(base() + '/actions/workflows?per_page=50'), gh(base() + '/actions/runs?per_page=8')]);
      renderWorkflows(wf.workflows || [], runs.workflow_runs || []);
      renderRuns(runs.workflow_runs || []);
      SK.$('#ac-wf-box', box).open = true;
      status(wf.total_count ? '' : 'Este repositório não tem nenhuma receita (workflow). Sem receita, o GitHub só guarda os arquivos.', wf.total_count ? '' : 'error');
    } catch (e) { status('⚠ ' + e.message, 'error'); }
  }

  function renderWorkflows(list, runs) {
    const el = SK.$('#ac-wf', box);
    if (!list.length) { el.innerHTML = '<p class="muted small">Nenhuma receita em <code>.github/workflows/</code>.</p>'; return; }
    el.innerHTML = list.map((w) => {
      const last = runs.find((r) => r.workflow_id === w.id);
      const local = fs().exists(w.path);
      return '<div class="gh-repo" data-wf="' + w.id + '" data-path="' + esc(w.path) + '">' +
        '<div class="grow"><b>' + (last ? ic(last) + ' ' : '') + esc(w.name) + '</b>' +
        '<div class="muted small">' + esc(w.path) + (local ? '' : ' · <i>não está neste projeto</i>') + (w.state !== 'active' ? ' · desativada' : '') + '</div></div>' +
        '<button class="btn tiny primary" data-ac="run" title="Rodar agora">▶</button>' +
        '<button class="btn tiny" data-ac="del" title="Tirar esta receita">🗑</button></div>';
    }).join('');
  }
  function renderRuns(runs) {
    const el = SK.$('#ac-runs', box);
    el.innerHTML = runs.length ? runs.map((r) =>
      '<button class="gh-repo ac-run" data-run="' + r.id + '"><span class="grow" style="text-align:left">' + ic(r) + ' <b>' + esc(r.name) + '</b> nº ' + r.run_number +
      '<span class="muted small" style="display:block">' + esc(r.event) + ' · ' + new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + ' · ' + esc((r.head_commit && r.head_commit.message || '').split('\n')[0].slice(0, 60)) + '</span></span></button>').join('')
      : '<p class="muted small">Nenhuma execução ainda.</p>';
  }

  async function onClick(e) {
    const runB = e.target.closest('[data-run]');
    if (runB) { stop(); try { const r = await gh(base() + '/actions/runs/' + runB.dataset.run); await detail(r, SK.$('#ac-detail', box)); } catch (er) { status('⚠ ' + er.message, 'error'); } return; }
    const b = e.target.closest('[data-ac]'); if (!b) return;
    const row = b.closest('[data-wf]'); const id = row.dataset.wf, path = row.dataset.path;
    if (b.dataset.ac === 'run') {
      try {
        const info = await gh(base());
        status('Pedindo para rodar…');
        await gh(base() + '/actions/workflows/' + id + '/dispatches', { method: 'POST', body: { ref: info.default_branch } });
        status('▶ Pedido. Acompanhando…', 'ok');
        follow({ since: Date.now() - 5000, workflowId: Number(id) });
      } catch (er) {
        if (er.status === 422) status('Essa receita não aceita "rodar agora" (falta "workflow_dispatch" nela). Ela roda sozinha quando você envia (push).', 'error');
        else status('⚠ ' + er.message, 'error');
      }
    }
    if (b.dataset.ac === 'del') {
      if (!(await SK.confirm('Tirar a receita "' + path + '"?\nEla é apagada no GitHub' + (fs().exists(path) ? ' e neste projeto' : '') + '. O resto não muda.', { okText: 'Tirar', danger: true }))) return;
      try {
        status('Apagando ' + path + '…');
        const f = await gh(base() + '/contents/' + path.split('/').map(encodeURIComponent).join('/'));
        await gh(base() + '/contents/' + path.split('/').map(encodeURIComponent).join('/'), { method: 'DELETE', body: { message: 'Tirar a receita ' + path + ' (Mini SK)', sha: f.sha } });
        if (fs().exists(path)) { await SK.checkpoints.auto('Antes de tirar ' + path); fs().remove(path); }
        await load();
        status('🗑 Receita tirada: ' + path + '. Ela não roda mais.', 'ok');
      } catch (er) { status('⚠ ' + (er.status === 404 || er.status === 403 ? er.message + ' Para mexer em receitas, o token precisa de "Workflows: Read and write".' : er.message), 'error'); }
    }
  }

  /** Acompanha as execuções de um envio (sha) ou de um "rodar agora". */
  function follow(opt) {
    stop();
    const started = Date.now();
    const live = SK.$('#ac-live', box);
    const tick = async () => {
      try {
        const d = await gh(base() + '/actions/runs?per_page=20' + (opt.sha ? '&head_sha=' + opt.sha : ''));
        let runs = d.workflow_runs || [];
        if (opt.workflowId) runs = runs.filter((r) => r.workflow_id === opt.workflowId && new Date(r.created_at).getTime() >= opt.since);
        if (!runs.length) {
          if (Date.now() - started > 60000) {
            live.innerHTML = '';
            status(opt.sha ? 'Enviado, mas o GitHub não rodou nada. Este repositório não tem receita que rode no envio (ou o token não tem "Workflows").' : 'O GitHub ainda não começou. Toque em 🔄 daqui a pouco.', 'error');
            return;
          }
          status('Esperando o GitHub começar…'); timer = setTimeout(tick, 4000); return;
        }
        live.innerHTML = '';
        for (const r of runs) { const div = document.createElement('div'); div.className = 'ac-box'; live.appendChild(div); await detail(r, div, true); }
        const pending = runs.some((r) => r.status !== 'completed');
        const failed = runs.filter((r) => r.conclusion && r.conclusion !== 'success' && r.conclusion !== 'skipped');
        if (pending && Date.now() - started < 45 * 60000) { status('⏳ O GitHub está trabalhando… (atualiza sozinho)'); timer = setTimeout(tick, 8000); }
        else if (pending) status('Demorando muito. Toque em 🔄 para ver de novo.', 'error');
        else if (failed.length) status('❌ ' + failed.length + ' execução(ões) falharam. O motivo está abaixo.', 'error');
        else status('✅ Tudo certo no GitHub!', 'ok');
      } catch (e) { status('⚠ ' + e.message, 'error'); }
    };
    tick();
  }

  async function detail(run, out, compact) {
    const jobs = (await gh(base() + '/actions/runs/' + run.id + '/jobs')).jobs || [];
    const mins = Math.max(0, Math.round(((run.status === 'completed' ? new Date(run.updated_at) : new Date()) - new Date(run.run_started_at || run.created_at)) / 60000));
    let html = '<div class="row wrap"><b>' + ic(run) + ' ' + esc(run.name) + ' nº ' + run.run_number + '</b><span class="muted small">' + mins + ' min</span><a class="small" href="' + esc(run.html_url) + '" target="_blank" rel="noopener">abrir no GitHub ↗</a></div>';
    for (const job of jobs) {
      html += '<div class="apk-steps"><div><b>' + ic(job) + ' ' + esc(job.name) + '</b></div>' +
        (job.steps || []).filter((s) => !compact || s.status !== 'completed' || s.conclusion !== 'skipped').map((s) => '<div class="apk-step ' + (s.conclusion || s.status) + '">' + ic(s) + ' ' + esc(s.name) + '</div>').join('') + '</div>';
    }
    out.innerHTML = html;
    if (run.status !== 'completed') return;
    if (run.conclusion === 'success') { await downloads(run, out); return; }
    for (const job of jobs.filter((j) => j.conclusion === 'failure')) {
      const fail = (job.steps || []).find((s) => s.conclusion === 'failure');
      let text = 'Receita: ' + run.name + '\nParte: ' + job.name + '\nPasso que falhou: ' + (fail ? fail.name : '(não identificado)') + '\n';
      try {
        const ann = await gh(base() + '/check-runs/' + job.id + '/annotations');
        if (ann.length) text += '\nMensagens do GitHub:\n' + ann.map((a) => '- ' + a.message).join('\n') + '\n';
      } catch {}
      try {
        const res = await fetch('https://api.github.com' + base() + '/actions/jobs/' + job.id + '/logs', { headers: { Authorization: 'Bearer ' + SK.github.token } });
        if (res.ok) {
          const lines = (await res.text()).replace(/^\S+Z /gm, '').split('\n');
          text += '\nTrecho do registro (log):\n' + logExcerpt(lines, fail && fail.name);
        }
      } catch { text += '\n(O registro completo está no link "abrir no GitHub".)'; }
      const pre = document.createElement('pre'); pre.className = 'apk-err'; pre.textContent = text; out.appendChild(pre);
      const row = document.createElement('div'); row.className = 'row wrap';
      row.innerHTML = '<button class="btn small primary">🤖 Explicar com a IA</button><button class="btn small">Copiar erro</button>';
      row.children[0].onclick = () => {
        SK.app.openSide('ai');
        const inp = SK.$('#ai-in');
        if (inp) { inp.value = 'Uma execução no GitHub Actions falhou. Explique em português simples o motivo e o que mudar (se for um arquivo do projeto, mande o arquivo corrigido com filepath).\n\n' + text.slice(0, 7000); inp.focus(); }
      };
      row.children[1].onclick = () => SK.copy(text).then(() => SK.toast('Copiado'));
      out.appendChild(row);
    }
  }


  /** Pega o pedaço do registro que importa: o passo que falhou e o último "##[error]". */
  function logExcerpt(lines, stepName) {
    const clean = lines.map((l) => l.replace(/\x1b\[[0-9;]*m/g, ''));
    let end = -1;
    for (let i = clean.length - 1; i >= 0; i--) if (/##\[error\]/.test(clean[i])) { end = i; break; }
    if (end < 0) end = clean.length - 1;
    let start = -1;
    for (let i = end; i >= 0; i--) if (clean[i].startsWith('##[group]Run ')) { start = i; break; }
    if (start < 0 || end - start > 120) start = Math.max(0, end - 80);
    let piece = clean.slice(start, end + 3).filter((l) => !/^##\[(end)?group\]/.test(l) || /Run /.test(l));
    // Registro do próprio app (passo "Mostrar o registro…"), se houver
    const k = clean.findIndex((l) => /##\[group\]Run (cat servidor\.log|Get-Content app\.log)/.test(l));
    if (k >= 0) piece = piece.concat(['', '— Registro do app —'], clean.slice(k + 1, k + 60).filter((l) => !/^##\[/.test(l)));
    return piece.join('\n').slice(-9000);
  }

  /** Quando dá certo: mostra o que dá para BAIXAR (Releases e Artifacts) daquela execução. */
  async function downloads(run, out) {
    const items = [];
    try {
      const rels = await gh(base() + '/releases?per_page=15');
      const t0 = new Date(run.run_started_at || run.created_at).getTime() - 60000;
      const t1 = new Date(run.updated_at).getTime() + 120000;
      for (const rel of rels) {
        const t = new Date(rel.created_at).getTime();
        if (t < t0 || t > t1) continue;
        for (const a of rel.assets || []) items.push('<a class="btn primary" href="' + esc(a.browser_download_url) + '" target="_blank" rel="noopener">⤓ Baixar ' + esc(a.name) + ' (' + SK.bytes(a.size) + ')</a>');
      }
    } catch {}
    try {
      const arts = (await gh(base() + '/actions/runs/' + run.id + '/artifacts')).artifacts || [];
      for (const a of arts) if (!a.expired) items.push('<a class="btn small" href="https://github.com/' + esc(repo.owner + '/' + repo.repo) + '/actions/runs/' + run.id + '/artifacts/' + a.id + '" target="_blank" rel="noopener">📦 ' + esc(a.name) + ' (' + SK.bytes(a.size_in_bytes) + ') — Artifacts</a>');
    } catch {}
    const div = document.createElement('div'); div.className = 'stack';
    div.innerHTML = items.length
      ? '<b class="small">Para baixar:</b>' + items.join('') + '<p class="muted small">O "⤓ Baixar" funciona direto. O "📦 Artifacts" pede que você esteja logado no GitHub e vem dentro de outro .zip.</p>'
      : '<p class="muted small">✅ Deu certo. Esta receita não gera arquivo para baixar: ela é um <b>teste</b> (verde = funciona).</p>';
    out.appendChild(div);
  }

  /** Chamado pelo GitHub depois de um envio. */
  async function afterPush(r) {
    if (!box || !r || !r.sha) return;
    repo = { owner: r.owner, repo: r.repo };
    SK.$('#ac-detail', box).innerHTML = '';
    follow({ sha: r.sha });
  }

  SK.on('project-open', () => { stop(); if (box) { SK.$('#ac-live', box).innerHTML = ''; SK.$('#ac-detail', box).innerHTML = ''; status(''); } });
  SK.acoes = { mount, load, afterPush, follow };
})(window.SK);
