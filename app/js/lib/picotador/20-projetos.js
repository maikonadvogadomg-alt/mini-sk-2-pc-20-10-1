/* Picotador — 20-projetos.js: backup de tudo / projeto .zip → escolher projetos, refazer o .zip original,
   separar um backup por projeto e abrir a memória (.sk) de cada um para picotar. */
(function (PT) {
  'use strict';
  const nMem = (p) => { try { const t = p.files['.sk/memoria.json'] && p.files['.sk/memoria.json'].text; const d = t ? JSON.parse(t) : []; return (Array.isArray(d) ? d : d.historico || []).length; } catch { return 0; } };

  // refaz o projeto do jeito original (as pastas e arquivos como eram)
  PT.projetoZip = async (p, semSk) => {
    const z = new JSZip();
    for (const [c, r] of Object.entries(p.files || {})) {
      if (semSk && c.startsWith('.sk/')) continue;
      if (r.b64 != null) z.file(c, r.b64, { base64: true }); else z.file(c, r.text || '');
    }
    for (const d of p.folders || []) if (!Object.keys(p.files || {}).some((c) => c.startsWith(d + '/'))) z.folder(d);
    return z.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  };
  PT.backupCom = (projetos) => {
    const b = PT.estado.backup || {};
    return JSON.stringify({ app: 'mini-sk', versao: b.versao || 1, data: new Date().toISOString(), comChaves: false, projetos, kv: {}, prefs: {}, picotado: true });
  };

  PT.mostrarProjetos = () => {
    const el = PT.$('#tela-projetos'); el.hidden = false;
    const E = PT.estado;
    const lista = E.backup ? E.backup.projetos : [E.projeto];
    const varios = !!E.backup;
    const marc = E.marcProj = E.marcProj || new Set();
    el.innerHTML =
      '<h2>' + (varios ? '💾 Projetos do backup' : '🗜 O projeto') + '</h2>' +
      (varios ? '<p class="muted pequeno">Marque os projetos que quer levar. Toque em 🧠 para abrir a memória da IA daquele projeto e picotar.</p>' +
        '<div class="linha"><button class="btn peq" data-acao="todos">☑ Todos</button><button class="btn peq" data-acao="nenhum">☐ Nenhum</button></div>' : '') +
      '<div class="lista">' + lista.map((p, i) => {
        const n = Object.keys(p.files || {}).length, m = nMem(p);
        return '<div class="item' + (marc.has(i) ? ' marcado' : '') + '">' + (varios ? '<input type="checkbox" data-p="' + i + '"' + (marc.has(i) ? ' checked' : '') + ' aria-label="Marcar ' + PT.esc(p.name) + '">' : '') +
          '<div class="corpo"><div class="num">' + PT.esc(p.name) + '</div><div class="topo"><span class="chip">' + n + ' arquivo(s)</span><span class="chip">' + PT.kb(PT.tamanhoProjeto(p)) + '</span><span class="chip">' + (m ? '🧠 ' + m + ' mensagens' : 'sem memória') + '</span>' +
          (p.updated ? '<span>' + new Date(p.updated).toLocaleDateString('pt-BR') + '</span>' : '') + '</div>' +
          '<div class="linha"><button class="btn peq" data-zip="' + i + '">🗜 Refazer o .zip</button>' + (m || (p.files && p.files['.sk/diario.md']) ? '<button class="btn peq" data-mem="' + i + '">🧠 Memória (' + m + ')</button>' : '') + '<button class="btn peq" data-zip-sem="' + i + '" title="O projeto sem a pasta .sk (mais leve)">🗜 .zip sem a memória</button>' + (varios ? '<button class="btn peq" data-bk1="' + i + '">💾 Backup só deste</button>' : '') + (PT.miniSK ? '<button class="btn peq primario" data-sk1="' + i + '">📥 Trazer para o Mini SK</button>' : '') + '</div></div></div>';
      }).join('') + '</div>' +
      (varios ? '<div class="resumo"><div class="muted pequeno" id="pj-resumo"></div><div class="linha"><button class="btn primario" data-acao="bk-marcados">💾 Backup só com os marcados (.json)</button><button class="btn" data-acao="zip-marcados">🗜 Marcados num .zip só</button>' + (PT.miniSK ? '<button class="btn primario" data-acao="sk-marcados">📥 Trazer os marcados para o Mini SK</button>' : '') + '</div>' +
        '<p class="muted pequeno">O "backup só com os marcados" abre no Mini SK em <b>💾 Restaurar backup</b>: traz só esses projetos e não mexe nos outros.</p></div>' : '');
    const resumo = () => { const r = PT.$('#pj-resumo', el); if (!r) return; const sel = [...marc].map((i) => lista[i]); r.textContent = sel.length ? sel.length + ' marcado(s) · ' + PT.kb(sel.reduce((s, p) => s + PT.tamanhoProjeto(p), 0)) : 'Nenhum marcado'; };
    resumo();
    el.onchange = (e) => { const c = e.target.closest('[data-p]'); if (!c) return; const i = +c.dataset.p; c.checked ? marc.add(i) : marc.delete(i); c.closest('.item').classList.toggle('marcado', c.checked); resumo(); };
    el.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      try {
        if (b.dataset.zip != null) { const p = lista[+b.dataset.zip]; PT.saida(PT.nomeSeguro(p.name) + '.zip', await PT.projetoZip(p, false), 'application/zip'); }
        else if (b.dataset.zipSem != null) { const p = lista[+b.dataset.zipSem]; PT.saida(PT.nomeSeguro(p.name) + '-sem-memoria.zip', await PT.projetoZip(p, true), 'application/zip'); }
        else if (b.dataset.bk1 != null) { const p = lista[+b.dataset.bk1]; PT.saida('mini-sk-backup-' + PT.nomeSeguro(p.name) + '-' + PT.hoje() + '.json', PT.backupCom([p]), 'application/json'); }
        else if (b.dataset.sk1 != null) await PT.miniSK.trazerProjetos([lista[+b.dataset.sk1]]);
        else if (b.dataset.acao === 'sk-marcados') { if (!marc.size) return PT.aviso('Marque pelo menos um projeto.', 'erro'); await PT.miniSK.trazerProjetos([...marc].sort((a, b) => a - b).map((i) => lista[i])); }
        else if (b.dataset.mem != null) { const i = +b.dataset.mem; PT.abrirConversa(PT.memoriaDoProjeto(lista[i]), { indice: i }); }
        else if (b.dataset.acao === 'todos') { lista.forEach((_, i) => marc.add(i)); PT.mostrarProjetos(); }
        else if (b.dataset.acao === 'nenhum') { marc.clear(); PT.mostrarProjetos(); }
        else if (b.dataset.acao === 'bk-marcados') { if (!marc.size) return PT.aviso('Marque pelo menos um projeto.', 'erro'); PT.saida('mini-sk-backup-' + marc.size + '-projetos-' + PT.hoje() + '.json', PT.backupCom([...marc].sort((a, b) => a - b).map((i) => lista[i])), 'application/json'); }
        else if (b.dataset.acao === 'zip-marcados') {
          if (!marc.size) return PT.aviso('Marque pelo menos um projeto.', 'erro');
          const z = new JSZip();
          for (const i of marc) { const p = lista[i]; const pasta = z.folder(PT.nomeSeguro(p.name)); for (const [c, r] of Object.entries(p.files || {})) { if (r.b64 != null) pasta.file(c, r.b64, { base64: true }); else pasta.file(c, r.text || ''); } }
          PT.saida('projetos-' + PT.hoje() + '.zip', await z.generateAsync({ type: 'blob', compression: 'DEFLATE' }), 'application/zip');
        }
      } catch (er) { PT.aviso('Erro: ' + er.message, 'erro'); }
    };
  };

  // devolve a memória picotada para dentro do projeto (gera backup ou .zip novo)
  PT.projetoComMemoria = (indice, mensagens, diario) => {
    const E = PT.estado;
    const orig = E.backup ? E.backup.projetos[indice] : E.projeto;
    const p = JSON.parse(JSON.stringify(orig));
    p.files['.sk/memoria.json'] = { text: JSON.stringify(mensagens, null, 1), enc: 'utf-8' };
    if (diario != null) p.files['.sk/diario.md'] = { text: diario, enc: 'utf-8' };
    p.updated = Date.now();
    return p;
  };
  PT.devolverMemoria = async (indice, mensagens, diario) => {
    const E = PT.estado, p = PT.projetoComMemoria(indice, mensagens, diario);
    if (E.backup) PT.saida('mini-sk-backup-' + PT.nomeSeguro(p.name) + '-memoria-cortada-' + PT.hoje() + '.json', PT.backupCom([p]), 'application/json');
    else PT.saida(PT.nomeSeguro(p.name) + '-memoria-cortada.zip', await PT.projetoZip(p, false), 'application/zip');
  };
})(window.PT);
