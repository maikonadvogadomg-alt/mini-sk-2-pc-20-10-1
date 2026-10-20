/* =========================================================================
   Mini SK — 86e-atalhos.js
   ⚡ Comandos prontos para os terminais (⚡ Node e 📱 Termux): um toque e o
   comando vai. Lê o package.json do projeto e cria um botão para cada
   "npm run …" que existe nele. Usado por 86b-node.js e 86c-termux.js.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const WIN = !!(window.miniskPC && window.miniskPC.so === 'win32');
  const FIXOS = WIN ? [
    { r: '📦 npm install', c: 'npm install', d: 'Baixa as peças do projeto' },
    { r: '🧹 reinstalar', c: 'rmdir /s /q node_modules & del /q package-lock.json & npm install', d: 'Apaga as peças e baixa de novo' },
    { r: '📂 dir', c: 'dir', d: 'Lista os arquivos da pasta' },
    { r: '🔢 versões', c: 'node -v && npm -v', d: 'Mostra se o Node e o npm estão instalados' },
    { r: '🌿 git status', c: 'git status', d: 'O que mudou desde o último commit' },
  ] : [
    { r: '📦 npm install', c: 'npm install', d: 'Baixa as peças do projeto (1ª vez, ou quando der "Cannot find module")' },
    { r: '🧹 reinstalar', c: 'rm -rf node_modules package-lock.json && npm install', d: 'Apaga as peças e baixa de novo (quando o install dá erro estranho)' },
    { r: '📂 ls', c: 'ls -la', d: 'Lista os arquivos da pasta' },
    { r: '🔢 versões', c: 'node -v && npm -v', d: 'Mostra se o Node e o npm estão instalados' },
    { r: '🌿 git status', c: 'git status', d: 'O que mudou desde o último commit' },
  ];

  function pacotes() {
    const out = [];
    if (!fs().project) return out;
    for (const p of fs().list().filter((x) => /(^|\/)package\.json$/.test(x) && !/node_modules\//.test(x)).slice(0, 6)) {
      let j = null; try { j = JSON.parse(fs().read(p) || '{}'); } catch { continue; }
      const dir = p.replace(/\/?package\.json$/, '');
      for (const nome of Object.keys(j.scripts || {})) out.push({ dir, nome, cmd: j.scripts[nome] });
    }
    return out;
  }

  // container: onde desenhar · enviar(cmd): manda para o terminal · opts.cd: prefixo de pasta (Termux)
  function montar(container, enviar, opts) {
    opts = opts || {};
    const pintar = () => {
      const scripts = pacotes();
      const ordem = ['dev', 'start', 'build', 'preview', 'test', 'lint', 'typecheck'];
      scripts.sort((a, b) => (a.dir.length - b.dir.length) || ((ordem.indexOf(a.nome) + 1 || 99) - (ordem.indexOf(b.nome) + 1 || 99)));
      const pre = (dir) => (dir ? 'cd ' + JSON.stringify(dir) + ' && ' : '');
      container.innerHTML =
        '<details class="atalhos" open><summary class="small"><b>⚡ Comandos prontos</b> <span class="muted">(um toque e vai)</span></summary>' +
        '<div class="row wrap" style="margin-top:6px">' +
        (opts.extra || []).map((x, i) => '<button class="btn small" data-x="' + i + '" title="' + SK.esc(x.d || x.c) + '">' + SK.esc(x.r) + '</button>').join('') +
        FIXOS.map((x, i) => '<button class="btn small" data-f="' + i + '" title="' + SK.esc(x.d) + '">' + SK.esc(x.r) + '</button>').join('') +
        '</div>' +
        (scripts.length ? '<div class="small muted" style="margin-top:6px">Do package.json deste projeto:</div><div class="row wrap">' +
          scripts.map((s, i) => '<button class="btn small" data-s="' + i + '" title="' + SK.esc(s.cmd) + '">▶ ' + SK.esc((s.dir ? s.dir + ': ' : '') + 'npm run ' + s.nome) + '</button>').join('') + '</div>'
          : '<div class="small muted" style="margin-top:6px">Este projeto não tem package.json com "scripts" — os botões de npm run aparecem quando tiver.</div>') +
        '<div class="row" style="margin-top:6px"><input class="input" data-livre placeholder="Ou escreva um comando…" autocapitalize="off" autocorrect="off" spellcheck="false" style="flex:1;min-width:0"><button class="btn small primary" data-ir>⏎</button><button class="btn small" data-atualizar title="Ler o package.json de novo">↻</button></div>' +
        '</details>';
      container.onclick = (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-atualizar')) return pintar();
        if (b.hasAttribute('data-ir')) { const i = container.querySelector('[data-livre]'); if (i.value.trim()) { enviar(i.value.trim()); i.value = ''; } return; }
        if (b.dataset.x != null) return enviar(opts.extra[+b.dataset.x].c);
        if (b.dataset.f != null) return enviar(FIXOS[+b.dataset.f].c);
        if (b.dataset.s != null) { const s = scripts[+b.dataset.s]; return enviar(pre(s.dir) + 'npm run ' + s.nome); }
      };
      const livre = container.querySelector('[data-livre]');
      livre.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); container.querySelector('[data-ir]').click(); } });
    };
    pintar();
    SK.on('project-open', pintar);
    let t = 0;
    SK.on('fs-change', (e) => { if (!e || e.type === 'import' || /(^|\/)package\.json$/.test(e.path || '')) { clearTimeout(t); t = setTimeout(pintar, 400); } });
    return { pintar };
  }

  SK.atalhos = { montar };
})(window.SK);
