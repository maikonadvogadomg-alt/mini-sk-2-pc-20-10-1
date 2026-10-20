/* =========================================================================
   Mini SK — 86-terminal.js
   ⌨️ Terminal leve, ligado à ÁRVORE do projeto. Funciona no celular, sem
   internet e sem instalar nada. Criou uma pasta aqui, ela aparece em ☰.
   Comandos: ls, cd, pwd, tree, cat, head, tail, wc, mkdir, touch, rm, mv, cp,
   echo (> e >>), grep, find, du, open, run/node (roda JS do projeto),
   npm search / info / install / uninstall / ls / init, cdn, zip, clear.
   Antes de apagar ou mover, tira um 📸 checkpoint.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  let box, out, inp, cwd = '', hist = SK.pref.get('termHist', []), hIdx = -1;

  // ── Caminhos ────────────────────────────────────────────────────────────────
  function resolve(p) {
    p = String(p == null ? '' : p).trim();
    if (!p || p === '~') return '';
    const parts = (p.startsWith('/') || p.startsWith('~/') ? p.replace(/^~\//, '/') : (cwd ? cwd + '/' : '') + p).split('/');
    const outp = [];
    for (const s of parts) { if (!s || s === '.') continue; if (s === '..') outp.pop(); else outp.push(s); }
    return outp.join('/');
  }
  const isDir = (p) => p === '' || fs().isFolder(p);
  const isFile = (p) => p !== '' && fs().exists(p);
  function children(dir) {
    const pre = dir ? dir + '/' : '';
    const dirs = new Set(), files = [];
    for (const f of fs().list()) if (f.startsWith(pre)) { const rest = f.slice(pre.length); const i = rest.indexOf('/'); if (i < 0) files.push(rest); else dirs.add(rest.slice(0, i)); }
    for (const d of (fs().project.folders || [])) if (d.startsWith(pre)) { const rest = d.slice(pre.length); if (rest) dirs.add(rest.split('/')[0]); }
    return { dirs: [...dirs].sort(), files: files.sort() };
  }
  const allUnder = (p) => fs().list().filter((f) => p === '' || f === p || f.startsWith(p + '/'));
  const base = (p) => p.split('/').pop();
  const join = (a, b) => (a ? a + '/' : '') + b;

  // ── Saída ───────────────────────────────────────────────────────────────────
  function print(text, cls) {
    const d = document.createElement('div');
    d.className = 'tl' + (cls ? ' ' + cls : '');
    d.textContent = text;
    out.appendChild(d);
    while (out.childNodes.length > 1500) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
    return d;
  }
  const err = (t) => print(t, 'err'), ok = (t) => print(t, 'ok'), dim = (t) => print(t, 'dim');
  function printHTML(html) { const d = document.createElement('div'); d.className = 'tl'; d.innerHTML = html; out.appendChild(d); out.scrollTop = out.scrollHeight; return d; }
  const promptText = () => (fs().project ? fs().project.name : '') + ':/' + cwd + ' $';

  // ── Palavras do comando (respeita "aspas") ─────────────────────────────────
  function words(line) {
    const w = []; let cur = '', q = null, has = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === q) q = null; else if (c === '\\' && line[i + 1] === q) { cur += q; i++; } else cur += c; continue; }
      if (c === '"' || c === "'") { q = c; has = true; continue; }
      if (/\s/.test(c)) { if (cur || has) { w.push(cur); cur = ''; has = false; } continue; }
      if (c === '>') { if (cur || has) { w.push(cur); cur = ''; has = false; } if (line[i + 1] === '>') { w.push('>>'); i++; } else w.push('>'); continue; }
      cur += c;
    }
    if (cur || has) w.push(cur);
    return w;
  }
  const flags = (args) => { const f = new Set(), rest = []; for (const a of args) { if (/^-[a-zA-Z]+$/.test(a)) [...a.slice(1)].forEach((c) => f.add(c)); else rest.push(a); } return { f, rest }; };

  async function checkpoint(why) { try { await SK.checkpoints.auto(why); } catch {} }

  // ── Comandos ────────────────────────────────────────────────────────────────
  const HELP = [
    ['ls [pasta]', 'lista o que tem na pasta (-a mostra ocultos)'],
    ['cd pasta', 'entra na pasta (cd .. volta, cd sozinho vai para o início)'],
    ['pwd · tree [pasta]', 'onde estou · desenho da árvore'],
    ['cat · head · tail · wc', 'mostra o arquivo (inteiro, começo, fim, contagem)'],
    ['mkdir [-p] pasta', 'cria pasta (aparece na árvore)'],
    ['touch arquivo', 'cria arquivo vazio'],
    ['rm [-r] alvo', 'apaga (tira 📸 checkpoint antes)'],
    ['mv origem destino', 'move ou renomeia'],
    ['cp [-r] origem destino', 'copia'],
    ['echo texto > arq', 'escreve no arquivo (>> acrescenta no fim)'],
    ['grep [-i] palavra [pasta]', 'procura texto nos arquivos'],
    ['find [pasta] -name *.html', 'acha arquivos pelo nome'],
    ['du [pasta] · open arq', 'tamanho · abre no editor'],
    ['run arq.js (ou node)', 'roda JavaScript do projeto aqui (sem internet)'],
    ['npm search termo', 'procura bibliotecas (como na Replit)'],
    ['npm info nome · npm ls', 'detalhes da biblioteca · lista as do projeto'],
    ['npm install nome [-D]', 'coloca no package.json'],
    ['npm uninstall nome · npm init', 'tira do package.json · cria package.json'],
    ['cdn nome', 'linha <script> para usar a biblioteca direto no HTML'],
    ['zip · clear · history', 'baixa o projeto · limpa a tela · comandos usados'],
  ];
  const C = {
    help() { print('Comandos do terminal do Mini SK:', 'ok'); HELP.forEach(([c, d]) => printHTML('<span class="tc">' + SK.esc(c) + '</span> <span class="dim">— ' + SK.esc(d) + '</span>')); dim('Dica: ↑ e ↓ repetem comandos; Tab completa nomes. Aspas para nomes com espaço: cd "minha pasta"'); },
    ajuda() { C.help(); },
    clear() { out.innerHTML = ''; }, limpar() { out.innerHTML = ''; }, cls() { out.innerHTML = ''; },
    pwd() { print('/' + cwd); },
    history() { hist.slice(-50).forEach((h, i) => dim(String(i + 1).padStart(3) + '  ' + h)); },
    ls(args) {
      const { f, rest } = flags(args);
      const targets = rest.length ? rest : [''];
      for (const t of targets) {
        const p = resolve(t);
        if (isFile(p)) { print(base(p)); continue; }
        if (!isDir(p)) { err('ls: não existe: ' + t); continue; }
        if (rest.length > 1) print(t + ':', 'dim');
        const { dirs, files } = children(p);
        const show = (n) => f.has('a') || !n.startsWith('.');
        const items = dirs.filter(show).map((d) => '<span class="tdir" data-cd="' + SK.esc(join(p, d)) + '">' + SK.esc(d) + '/</span>')
          .concat(files.filter(show).map((x) => '<span class="tfile" data-tf="' + SK.esc(join(p, x)) + '">' + SK.esc(x) + '</span>'));
        if (!items.length) dim('(vazia)'); else printHTML(items.join('  '));
      }
    },
    cd(args) {
      const p = resolve(args[0] || '');
      if (!isDir(p)) return err('cd: pasta não existe: ' + (args[0] || ''));
      cwd = p; updatePrompt();
    },
    tree(args) {
      const root = resolve(args[0] || '');
      if (!isDir(root)) return err('tree: pasta não existe');
      let nd = 0, nf = 0;
      const walk = (dir, pre) => {
        const { dirs, files } = children(dir);
        const all = dirs.map((d) => [d, true]).concat(files.map((x) => [x, false]));
        all.forEach(([n, d], i) => {
          const last = i === all.length - 1;
          print(pre + (last ? '└── ' : '├── ') + n + (d ? '/' : ''), d ? 'dir' : '');
          if (d) { nd++; if (nd < 400) walk(join(dir, n), pre + (last ? '    ' : '│   ')); } else nf++;
        });
      };
      print(root ? root + '/' : (fs().project.name + '/'), 'dir'); walk(root, '');
      dim(nd + ' pasta(s), ' + nf + ' arquivo(s)');
    },
    cat(args) {
      if (!args.length) return err('cat: diga o arquivo');
      for (const a of args) { const p = resolve(a); const t = fs().read(p); if (t === undefined) err('cat: não existe: ' + a); else if (t === null) err('cat: é binário (imagem, zip…): ' + a); else { if (t.length > 200000) dim('(arquivo grande: mostrando os primeiros 200 mil caracteres)'); print(t.slice(0, 200000)); } }
    },
    head(args) { const { rest } = flags(args.filter((a) => !/^\d+$/.test(a))); const n = +(args.find((a) => /^\d+$/.test(a)) || 10); const t = fs().read(resolve(rest[0])); if (t == null) return err('head: arquivo não existe ou é binário'); print(t.split('\n').slice(0, n).join('\n')); },
    tail(args) { const { rest } = flags(args.filter((a) => !/^\d+$/.test(a))); const n = +(args.find((a) => /^\d+$/.test(a)) || 10); const t = fs().read(resolve(rest[0])); if (t == null) return err('tail: arquivo não existe ou é binário'); print(t.split('\n').slice(-n).join('\n')); },
    wc(args) { for (const a of args) { const t = fs().read(resolve(a)); if (t == null) { err('wc: ' + a + ': não existe ou é binário'); continue; } print(t.split('\n').length + ' linhas  ' + (t.match(/\S+/g) || []).length + ' palavras  ' + t.length + ' caracteres  ' + a); } },
    mkdir(args) {
      const { rest } = flags(args);
      if (!rest.length) return err('mkdir: diga o nome da pasta');
      for (const a of rest) { const p = resolve(a); if (isFile(p)) { err('mkdir: já existe um arquivo com esse nome: ' + a); continue; } fs().mkdir(p); ok('📁 ' + p + '/'); }
    },
    touch(args) {
      if (!args.length) return err('touch: diga o nome do arquivo');
      for (const a of args) { const p = resolve(a); if (isDir(p) && p) { err('touch: é uma pasta: ' + a); continue; } if (!isFile(p)) { fs().write(p, ''); ok('📄 ' + p); } }
    },
    async rm(args) {
      const { f, rest } = flags(args);
      if (!rest.length) return err('rm: diga o que apagar');
      const alvos = rest.map((a) => [a, resolve(a)]);
      for (const [a, p] of alvos) { if (!p) return err('rm: não dá para apagar o projeto inteiro por aqui'); if (!isFile(p) && !isDir(p)) return err('rm: não existe: ' + a); if (isDir(p) && !isFile(p) && !(f.has('r') || f.has('R'))) return err('rm: "' + a + '" é pasta; use rm -r ' + a); }
      await checkpoint('Antes do terminal: rm ' + rest.join(' '));
      for (const [, p] of alvos) { const n = fs().remove(p); ok('🗑 ' + p + (n > 1 ? ' (' + n + ' arquivos)' : '')); }
      if (cwd && !isDir(cwd)) { cwd = ''; updatePrompt(); }
    },
    async mv(args) {
      if (args.length !== 2) return err('mv: use  mv origem destino');
      const a = resolve(args[0]); let b = resolve(args[1]);
      if (!a || (!isFile(a) && !isDir(a))) return err('mv: não existe: ' + args[0]);
      if (b === '' || (isDir(b) && !isFile(b))) b = join(b, base(a));
      await checkpoint('Antes do terminal: mv ' + args.join(' '));
      try { fs().rename(a, b); ok(a + ' → ' + b); } catch (e) { err('mv: ' + e.message); }
    },
    cp(args) {
      const { f, rest } = flags(args);
      if (rest.length !== 2) return err('cp: use  cp origem destino  (pasta: cp -r)');
      const a = resolve(rest[0]); let b = resolve(rest[1]);
      if (isFile(a)) { if (b === '' || (isDir(b) && !isFile(b))) b = join(b, base(a)); fs().writeRecord(b, JSON.parse(JSON.stringify(fs().get(a)))); return ok(a + ' → ' + b); }
      if (!isDir(a) || !a) return err('cp: não existe: ' + rest[0]);
      if (!(f.has('r') || f.has('R'))) return err('cp: "' + rest[0] + '" é pasta; use cp -r');
      if (isDir(b) && b !== '' && fs().isFolder(b)) b = join(b, base(a));
      let n = 0; for (const x of allUnder(a)) { fs().writeRecord(b + x.slice(a.length), JSON.parse(JSON.stringify(fs().get(x)))); n++; }
      fs().mkdir(b); ok(a + '/ → ' + b + '/ (' + n + ' arquivos)');
    },
    echo(args) {
      const i = args.findIndex((x) => x === '>' || x === '>>');
      if (i < 0) return print(args.join(' '));
      const text = args.slice(0, i).join(' ').replace(/\\n/g, '\n'), dest = args[i + 1];
      if (!dest) return err('echo: falta o arquivo depois de ' + args[i]);
      const p = resolve(dest), prev = fs().read(p);
      if (prev === null) return err('echo: o arquivo é binário');
      fs().write(p, args[i] === '>>' && prev ? prev + (prev.endsWith('\n') ? '' : '\n') + text + '\n' : text + '\n');
      ok((args[i] === '>>' ? '＋ ' : '✎ ') + p);
    },
    grep(args) {
      const { f, rest } = flags(args);
      if (!rest.length) return err('grep: diga o que procurar');
      const pat = rest[0], where = resolve(rest[1] || '');
      let re; try { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), f.has('i') ? 'i' : ''); } catch { return err('grep: padrão inválido'); }
      let hits = 0;
      for (const p of (isFile(where) ? [where] : allUnder(where))) {
        const t = fs().read(p); if (t == null) continue;
        t.split('\n').forEach((l, n) => { if (re.test(l) && hits < 300) { hits++; printHTML('<span class="tfile" data-tf="' + SK.esc(p) + '" data-line="' + (n + 1) + '">' + SK.esc(p) + ':' + (n + 1) + '</span> <span class="dim">' + SK.esc(l.trim().slice(0, 200)) + '</span>'); } });
      }
      if (!hits) dim('(nada encontrado)'); else if (hits >= 300) dim('(parou em 300 resultados)');
    },
    find(args) {
      let where = '', name = null;
      for (let i = 0; i < args.length; i++) { if (args[i] === '-name' || args[i] === '-iname') name = args[++i]; else where = args[i]; }
      const root = resolve(where);
      const re = name ? new RegExp('^' + name.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i') : null;
      const list = allUnder(root).filter((p) => !re || re.test(base(p)));
      list.slice(0, 500).forEach((p) => printHTML('<span class="tfile" data-tf="' + SK.esc(p) + '">' + SK.esc(p) + '</span>'));
      if (!list.length) dim('(nada encontrado)'); else dim(list.length + ' arquivo(s)');
    },
    du(args) {
      const root = resolve(args[0] || '');
      const sizes = {}; let total = 0;
      for (const p of allUnder(root)) { const r = fs().get(p); const s = r ? (r.size || (r.text ? r.text.length : 0) || (r.b64 ? r.b64.length * 0.75 : 0)) : 0; total += s; const rest = root ? p.slice(root.length + 1) : p; const top = rest.includes('/') ? rest.split('/')[0] + '/' : rest; sizes[top] = (sizes[top] || 0) + s; }
      Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([n, s]) => print(SK.bytes(Math.round(s)).padStart(10) + '  ' + n));
      ok(SK.bytes(Math.round(total)).padStart(10) + '  total');
    },
    open(args) { const p = resolve(args[0]); if (!isFile(p)) return err('open: arquivo não existe'); SK.tree && SK.tree.expandTo && SK.tree.expandTo(p); SK.editor.open(p); ok('aberto: ' + p); },
    run(args) { return runJS(args); }, node(args) { return runJS(args); },
    zip() { return fs().exportZip().then((z) => { SK.download((fs().project.name || 'projeto') + '.zip', z, 'application/zip'); ok('⤓ baixando o .zip do projeto'); }); },
    async cdn(args) {
      if (!args[0]) return err('cdn: diga a biblioteca (ex.: cdn chart.js)');
      const name = args[0];
      let v = '';
      try { v = (await npmJSON('/' + encName(name) + '/latest')).version; } catch {}
      const url = 'https://cdn.jsdelivr.net/npm/' + name + (v ? '@' + v : '');
      print('<script src="' + url + '"></script>', 'ok');
      dim('Cole no <head> do seu HTML. (Nem toda biblioteca funciona assim; as feitas para navegador funcionam.)');
      printHTML('<button class="btn tiny" data-copy="' + SK.esc('<script src="' + url + '"></script>') + '">📋 Copiar</button>');
    },
    async npm(args) {
      const sub = args[0], rest = args.slice(1);
      if (!sub || sub === 'help') { dim('npm search termo · npm info nome · npm install nome [-D] · npm uninstall nome · npm ls · npm init'); return; }
      if (sub === 'search' || sub === 's' || sub === 'find') return npmSearch(rest.join(' '));
      if (sub === 'info' || sub === 'view' || sub === 'show') return npmInfo(rest[0]);
      if (sub === 'ls' || sub === 'list') return npmLs();
      if (sub === 'init') return npmInit();
      if (sub === 'install' || sub === 'i' || sub === 'add') return npmInstall(rest);
      if (sub === 'uninstall' || sub === 'remove' || sub === 'rm' || sub === 'un') return npmUninstall(rest);
      if (sub === 'run' || sub === 'start' || sub === 'test') { err('npm ' + sub + ': precisa de Node de verdade (PC ou Termux). Aqui no celular, use "run arquivo.js" para JavaScript simples.'); dim('Em breve: 🔗 ponte com o Termux/PC para rodar npm de verdade daqui.'); return; }
      err('npm: comando não conhecido: ' + sub);
    },
  };

  // ── npm ─────────────────────────────────────────────────────────────────────
  const encName = (n) => n.startsWith('@') ? '@' + encodeURIComponent(n.slice(1)) : encodeURIComponent(n);
  async function npmJSON(path) {
    const r = await fetch('https://registry.npmjs.org' + path);
    if (r.status === 404) throw new Error('não encontrada');
    if (!r.ok) throw new Error('registro do npm respondeu ' + r.status);
    return r.json();
  }
  async function npmSearch(q) {
    if (!q) return err('npm search: diga o que procurar (ex.: npm search pdf)');
    dim('procurando "' + q + '"…');
    let items = [];
    try {
      const d = await npmJSON('/-/v1/search?size=15&text=' + encodeURIComponent(q));
      items = (d.objects || []).map((o) => ({ name: o.package.name, version: o.package.version, desc: o.package.description || '', dl: o.downloads && o.downloads.weekly }));
    } catch (e) {
      try { const r = await fetch('https://api.npms.io/v2/search?size=15&q=' + encodeURIComponent(q)); const d = await r.json(); items = (d.results || []).map((o) => ({ name: o.package.name, version: o.package.version, desc: o.package.description || '' })); }
      catch { return err('Sem conexão com o npm (' + e.message + ').'); }
    }
    if (!items.length) return dim('(nada encontrado)');
    items.forEach((it) => printHTML('<span class="tc">' + SK.esc(it.name) + '</span><span class="dim">@' + SK.esc(it.version) + (it.dl ? ' · ' + SK.fmt(it.dl) + '/semana' : '') + '</span> ' +
      '<button class="btn tiny" data-run="npm install ' + SK.esc(it.name) + '">＋ instalar</button> <button class="btn tiny" data-run="npm info ' + SK.esc(it.name) + '">ℹ</button><br><span class="dim">' + SK.esc(it.desc.slice(0, 160)) + '</span>'));
    dim('As descrições vêm em inglês. Toque em "＋ instalar" para colocar no package.json, ou peça à 🤖 IA para explicar.');
  }
  async function npmInfo(name) {
    if (!name) return err('npm info: diga o nome');
    try {
      const d = await npmJSON('/' + encName(name) + '/latest');
      ok(d.name + '@' + d.version);
      if (d.description) print(d.description);
      if (d.license) dim('licença: ' + d.license);
      if (d.homepage) printHTML('<a href="' + SK.esc(d.homepage) + '" target="_blank" rel="noopener">' + SK.esc(d.homepage) + '</a>');
      const deps = Object.keys(d.dependencies || {}); dim('depende de ' + deps.length + ' outra(s)' + (deps.length ? ': ' + deps.slice(0, 12).join(', ') + (deps.length > 12 ? '…' : '') : ''));
      printHTML('<button class="btn tiny" data-run="npm install ' + SK.esc(d.name) + '">＋ instalar</button> <button class="btn tiny" data-run="cdn ' + SK.esc(d.name) + '">🌐 usar via CDN</button>');
    } catch (e) { err('npm info: ' + name + ': ' + e.message); }
  }
  function pkgPath() {
    let d = cwd;
    for (;;) { const p = join(d, 'package.json'); if (isFile(p)) return p; if (!d) return null; d = d.includes('/') ? d.slice(0, d.lastIndexOf('/')) : ''; }
  }
  function readPkg(p) { try { return JSON.parse(fs().read(p) || '{}'); } catch (e) { throw new Error(p + ' está com erro: ' + e.message); } }
  function writePkg(p, o) { fs().write(p, JSON.stringify(o, null, 2) + '\n'); }
  function npmInit() {
    const p = join(cwd, 'package.json');
    if (isFile(p)) return dim('já existe: ' + p);
    writePkg(p, { name: (fs().project.name || 'projeto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'projeto', version: '1.0.0', private: true, type: 'module', scripts: {}, dependencies: {} });
    ok('📄 ' + p + ' criado');
  }
  async function npmInstall(args) {
    const { f, rest } = flags(args);
    if (!rest.length) { const p = pkgPath(); if (!p) return err('npm install: não há package.json (use npm init)'); dim('Aqui no celular o npm não baixa os arquivos (node_modules). Eles são instalados de verdade no GitHub (📦 APK / Actions) ou no PC/Termux.'); return npmLs(); }
    let p = pkgPath(); if (!p) { npmInit(); p = join(cwd, 'package.json'); }
    const pkg = readPkg(p);
    const field = f.has('D') ? 'devDependencies' : 'dependencies';
    for (const spec of rest) {
      const m = spec.match(/^(@?[^@]+)(?:@(.+))?$/); if (!m) { err('nome inválido: ' + spec); continue; }
      const name = m[1]; let ver = m[2];
      try {
        const d = await npmJSON('/' + encName(name) + '/' + (ver ? encodeURIComponent(ver) : 'latest'));
        ver = '^' + d.version;
      } catch (e) { if (!ver) { err('npm install: ' + name + ': ' + e.message); continue; } }
      pkg[field] = pkg[field] || {}; pkg[field][name] = ver;
      const other = field === 'dependencies' ? 'devDependencies' : 'dependencies'; if (pkg[other] && pkg[other][name]) delete pkg[other][name];
      ok('＋ ' + name + '@' + ver + (field === 'devDependencies' ? ' (só para montar)' : ''));
    }
    pkg[field] = Object.fromEntries(Object.entries(pkg[field] || {}).sort(([a], [b]) => a.localeCompare(b)));
    writePkg(p, pkg);
    dim('Anotado em ' + p + '. Os arquivos da biblioteca são baixados quando o projeto é montado (GitHub, PC ou Termux). Para usar direto no HTML: cdn nome');
  }
  function npmUninstall(args) {
    const p = pkgPath(); if (!p) return err('npm uninstall: não há package.json');
    const pkg = readPkg(p); let n = 0;
    for (const name of args) for (const fld of ['dependencies', 'devDependencies']) if (pkg[fld] && pkg[fld][name]) { delete pkg[fld][name]; n++; ok('－ ' + name); }
    if (!n) return dim('(nada para tirar)');
    writePkg(p, pkg);
  }
  function npmLs() {
    const p = pkgPath(); if (!p) return err('npm ls: não há package.json (use npm init)');
    const pkg = readPkg(p);
    ok((pkg.name || '(sem nome)') + '@' + (pkg.version || '?') + '  (' + p + ')');
    for (const [fld, lbl] of [['dependencies', ''], ['devDependencies', ' (só para montar)']]) Object.entries(pkg[fld] || {}).forEach(([n, v]) => print('├── ' + n + '@' + v + lbl));
    if (pkg.scripts && Object.keys(pkg.scripts).length) { dim('scripts:'); Object.entries(pkg.scripts).forEach(([n, v]) => dim('  ' + n + ': ' + v)); }
  }

  // ── run: JavaScript num "trabalhador" separado (não trava a tela) ──────────
  function runJS(args) {
    const p = resolve(args[0]);
    const code = fs().read(p);
    if (code == null) return err('run: arquivo não existe (ou é binário): ' + (args[0] || ''));
    if (/\brequire\(|^\s*import\s/m.test(code)) dim('Aviso: este arquivo usa require/import de bibliotecas. Aqui só roda JavaScript puro; o resto precisa do Node de verdade (PC/Termux).');
    dim('▶ rodando ' + p + ' …');
    const shim = 'const __s=(v)=>{try{return typeof v==="object"?JSON.stringify(v,null,2):String(v)}catch(e){return String(v)}};' +
      '["log","info","warn","error"].forEach(k=>{console[k]=(...a)=>postMessage({k,t:a.map(__s).join(" ")})});' +
      'self.process={argv:["node",' + JSON.stringify(p) + '].concat(' + JSON.stringify(args.slice(1)) + '),env:{},exit:(c)=>{postMessage({done:1,code:c||0});close()}};' +
      'self.onerror=(m,f,l)=>{postMessage({k:"error",t:String(m)+(l?" (linha "+(l-2)+")":"")});};\n';
    const url = URL.createObjectURL(new Blob([shim + code + '\n;postMessage({done:1,code:0});'], { type: 'text/javascript' }));
    const w = new Worker(url);
    const t0 = Date.now();
    const timer = setTimeout(() => { w.terminate(); err('⏹ parado: passou de 15 segundos (laço infinito?)'); }, 15000);
    w.onmessage = (e) => { const d = e.data; if (d.done) { clearTimeout(timer); w.terminate(); URL.revokeObjectURL(url); dim('✔ terminou em ' + (Date.now() - t0) + ' ms' + (d.code ? ' (código ' + d.code + ')' : '')); return; } print(d.t, d.k === 'error' ? 'err' : d.k === 'warn' ? 'warn' : ''); };
    w.onerror = (e) => { e.preventDefault(); clearTimeout(timer); err('✖ ' + e.message + (e.lineno ? ' (linha ' + (e.lineno - 2) + ')' : '')); w.terminate(); URL.revokeObjectURL(url); };
  }

  // ── Executar uma linha ──────────────────────────────────────────────────────
  async function exec(line) {
    line = line.trim(); if (!line) return;
    printHTML('<span class="tp">' + SK.esc(promptText()) + '</span> ' + SK.esc(line));
    if (hist[hist.length - 1] !== line) { hist.push(line); if (hist.length > 200) hist = hist.slice(-200); SK.pref.set('termHist', hist); }
    hIdx = -1;
    if (!fs().project) return err('Nenhum projeto aberto.');
    // vários comandos com &&
    for (const part of line.split(/\s*&&\s*/)) {
      const w = words(part); if (!w.length) continue;
      const cmd = w[0].toLowerCase(), fn = C[cmd];
      if (!fn) { err('comando não conhecido: ' + w[0] + '  (digite ajuda)'); if (/^(git|python3?|pip|yarn|pnpm|npx|bun|deno)$/.test(cmd)) dim('Esse precisa de um computador de verdade. Em breve: 🔗 ponte com o Termux/PC.'); return; }
      try { await fn(w.slice(1)); } catch (e) { err(cmd + ': ' + (e.message || e)); return; }
    }
  }

  // ── Completar com Tab ───────────────────────────────────────────────────────
  function complete() {
    const v = inp.value, m = v.match(/(^|\s)("?)([^\s"]*)$/);
    if (!m) return;
    const frag = m[3], dirPart = frag.includes('/') ? frag.slice(0, frag.lastIndexOf('/') + 1) : '', namePart = frag.slice(dirPart.length);
    const dir = resolve(dirPart || '.');
    if (!isDir(dir)) return;
    const { dirs, files } = children(dir);
    const opts = dirs.map((d) => d + '/').concat(files).filter((n) => n.startsWith(namePart));
    if (!opts.length) return;
    if (opts.length === 1) { inp.value = v.slice(0, v.length - frag.length) + dirPart + opts[0]; return; }
    let pre = opts[0]; for (const o of opts) while (!o.startsWith(pre)) pre = pre.slice(0, -1);
    if (pre.length > namePart.length) inp.value = v.slice(0, v.length - frag.length) + dirPart + pre;
    else dim(opts.join('  '));
  }

  function updatePrompt() { const el = box && box.querySelector('#tm-prompt'); if (el) el.textContent = promptText(); }

  function build(el) {
    box = el;
    box.classList.add('tm-pane');
    box.innerHTML =
      '<div class="tm-quick">' + ['ls', 'tree', 'cd ..', 'npm search ', 'npm ls', 'ajuda', 'clear'].map((c) => '<button class="btn tiny" data-q="' + c + '">' + c.trim() + '</button>').join('') + '</div>' +
      '<div class="tm-out" id="tm-out" aria-live="polite"></div>' +
      '<form class="tm-in" id="tm-form"><span class="tp" id="tm-prompt"></span><input id="tm-inp" class="inp mono" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="Comando"><button class="btn small primary" type="submit">↵</button></form>';
    out = box.querySelector('#tm-out'); inp = box.querySelector('#tm-inp');
    box.querySelector('#tm-form').onsubmit = (e) => { e.preventDefault(); const v = inp.value; inp.value = ''; exec(v).then(updatePrompt); };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); if (!hist.length) return; hIdx = hIdx < 0 ? hist.length - 1 : Math.max(0, hIdx - 1); inp.value = hist[hIdx]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hIdx < 0) return; hIdx++; if (hIdx >= hist.length) { hIdx = -1; inp.value = ''; } else inp.value = hist[hIdx]; }
      else if (e.key === 'Tab') { e.preventDefault(); complete(); }
      else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
    });
    box.addEventListener('click', (e) => {
      const q = e.target.closest('[data-q]'); if (q) { const c = q.dataset.q; if (c.endsWith(' ')) { inp.value = c; inp.focus(); } else exec(c).then(updatePrompt); return; }
      const r = e.target.closest('[data-run]'); if (r) { exec(r.dataset.run).then(updatePrompt); return; }
      const cp = e.target.closest('[data-copy]'); if (cp) { SK.copy(cp.dataset.copy).then(() => SK.toast('Copiado')); return; }
      const d = e.target.closest('[data-cd]'); if (d) { exec('cd "' + d.dataset.cd.replace(/"/g, '') + '"').then(() => { updatePrompt(); exec('ls'); }); return; }
      const f = e.target.closest('[data-tf]'); if (f && f.closest('.tm-out')) { const p = f.dataset.tf; SK.tree && SK.tree.expandTo && SK.tree.expandTo(p); SK.editor.open(p); if (f.dataset.line && SK.editor.reveal) { try { SK.editor.reveal(+f.dataset.line); } catch {} } }
    });
    print('⌨️ Terminal do Mini SK — mexe direto na árvore do projeto.', 'ok');
    dim('Digite ajuda para ver os comandos. Ex.: mkdir paginas · ls · npm search pdf');
    updatePrompt();
  }

  SK.on('project-open', () => { cwd = ''; updatePrompt(); });
  SK.on('fs-change', (c) => { if (cwd && fs().project && !isDir(cwd)) { cwd = ''; updatePrompt(); } });
  SK.terminal = { build, exec, resolve, words, get cwd() { return cwd; } };
})(window.SK);
