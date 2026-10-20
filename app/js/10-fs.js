/* =========================================================================
   Mini SK — 10-fs.js
   Projetos e arquivos. Cada projeto fica salvo no navegador (IndexedDB).
   - Reconhece o tipo do arquivo pela extensão (HTML, CSS, JS, JSON, Python…)
   - Reconhece a codificação (UTF-8, UTF-8 com BOM, UTF-16, Windows-1252/Latin-1)
     para acentos não virarem "Ã§Ã£o".
   - Pastas dentro de pastas, renomear, duplicar, mover, apagar.
   ========================================================================= */
(function (SK) {
  'use strict';

  // ── Tipos de arquivo ────────────────────────────────────────────────────────
  const TYPES = {
    html: ['html', 'HTML'], htm: ['html', 'HTML'], xhtml: ['html', 'HTML'], vue: ['html', 'Vue'], svelte: ['html', 'Svelte'],
    css: ['css', 'CSS'], scss: ['css', 'SCSS'], sass: ['css', 'Sass'], less: ['css', 'Less'],
    js: ['js', 'JavaScript'], mjs: ['js', 'JavaScript'], cjs: ['js', 'JavaScript'], jsx: ['js', 'JSX'],
    ts: ['js', 'TypeScript'], tsx: ['js', 'TSX'], mts: ['js', 'TypeScript'],
    json: ['json', 'JSON'], jsonc: ['json', 'JSON'], webmanifest: ['json', 'Manifest'], map: ['json', 'Source map'],
    py: ['py', 'Python'], md: ['md', 'Markdown'], markdown: ['md', 'Markdown'], txt: ['text', 'Texto'],
    xml: ['html', 'XML'], svg: ['html', 'SVG'], yml: ['yaml', 'YAML'], yaml: ['yaml', 'YAML'], toml: ['yaml', 'TOML'], ini: ['yaml', 'INI'],
    sh: ['sh', 'Shell'], bat: ['sh', 'Batch'], cmd: ['sh', 'Batch'], ps1: ['sh', 'PowerShell'],
    sql: ['sql', 'SQL'], php: ['js', 'PHP'], java: ['js', 'Java'], kt: ['js', 'Kotlin'], c: ['js', 'C'], h: ['js', 'C'], cpp: ['js', 'C++'], cs: ['js', 'C#'], go: ['js', 'Go'], rs: ['js', 'Rust'], rb: ['py', 'Ruby'], swift: ['js', 'Swift'],
    env: ['yaml', '.env'], gitignore: ['sh', 'Git'], csv: ['text', 'CSV'], log: ['text', 'Log'],
  };
  const BINARY_EXT = new Set('png jpg jpeg gif webp ico bmp avif tif tiff mp3 wav ogg m4a mp4 webm mov pdf zip gz rar 7z apk aab exe dll so woff woff2 ttf otf eot wasm db sqlite docx xlsx pptx doc xls jar class keystore jks'.split(' '));
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', wasm: 'application/wasm', json: 'application/json', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', html: 'text/html', htm: 'text/html', txt: 'text/plain', md: 'text/markdown', xml: 'application/xml' };

  const extOf = (p) => { const b = p.split('/').pop().toLowerCase(); if (b.startsWith('.') && !b.slice(1).includes('.')) return b.slice(1); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i + 1) : ''; };
  const baseName = (p) => p.split('/').pop();
  const dirName = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
  const norm = (p) => String(p || '').replace(/\\/g, '/').split('/').filter((s) => s && s !== '.').reduce((a, s) => { if (s === '..') a.pop(); else a.push(s); return a; }, []).join('/');

  function typeOf(path) {
    const e = extOf(path);
    const t = TYPES[e] || (baseName(path).toLowerCase().startsWith('.env') ? TYPES.env : null);
    return { ext: e, lang: t ? t[0] : 'text', label: t ? t[1] : (e ? e.toUpperCase() : 'Texto'), binary: BINARY_EXT.has(e), mime: MIME[e] || 'application/octet-stream' };
  }

  // ── Codificação: transforma bytes em texto sem estragar os acentos ──────────
  function decodeBytes(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return { text: new TextDecoder('utf-8').decode(u8.subarray(3)), encoding: 'UTF-8 com BOM' };
    if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(u8.subarray(2)), encoding: 'UTF-16 LE' };
    if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(u8.subarray(2)), encoding: 'UTF-16 BE' };
    try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(u8), encoding: 'UTF-8' }; }
    catch { return { text: new TextDecoder('windows-1252').decode(u8), encoding: 'Windows-1252 (Latin-1)' }; }
  }
  function looksBinary(u8) {
    const n = Math.min(u8.length, 8000);
    let zeros = 0;
    for (let i = 0; i < n; i++) if (u8[i] === 0) zeros++;
    return zeros > 0 && !(u8[0] === 0xff && u8[1] === 0xfe) && !(u8[0] === 0xfe && u8[1] === 0xff);
  }
  function toBase64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromBase64(b64) { const s = atob(b64); const u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; }

  /** Cria o registro de um arquivo a partir de bytes (decide se é texto ou binário). */
  function recordFromBytes(path, bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const t = typeOf(path);
    if (t.binary || looksBinary(u8)) return { b64: toBase64(u8), enc: 'binário', size: u8.length };
    const d = decodeBytes(u8);
    return { text: d.text, enc: d.encoding, size: u8.length };
  }

  // ── Projeto atual ───────────────────────────────────────────────────────────
  let P = null;           // projeto aberto
  let dirty = false;

  const saveNow = async () => {
    if (!P || !dirty) return;
    dirty = false;
    P.updated = Date.now();
    try { await SK.db.put('projects', P); SK.emit('saved', P.name); }
    catch (e) { dirty = true; SK.toast('Não consegui salvar no navegador: ' + e.message, 'error'); }
  };
  const saveSoon = SK.debounce(saveNow, 700);
  function touch(what) { dirty = true; saveSoon(); SK.emit('fs-change', what || {}); }

  const fs = {
    typeOf, extOf, baseName, dirName, norm, decodeBytes, recordFromBytes, toBase64, fromBase64,
    get project() { return P; },
    saveNow,

    async listProjects() {
      const all = await SK.db.all('projects');
      return all.map((p) => ({ name: p.name, updated: p.updated, files: Object.keys(p.files || {}).length })).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    },
    async open(name) {
      await saveNow();
      let p = await SK.db.get('projects', name);
      if (!p) p = { name, files: {}, folders: [], open: [], active: null, updated: Date.now() };
      p.files = p.files || {}; p.folders = p.folders || []; p.open = (p.open || []).filter((f) => p.files[f]);
      P = p;
      SK.pref.set('lastProject', name);
      SK.emit('project-open', P);
      return P;
    },
    async create(name, files) {
      name = String(name || '').trim() || 'Novo projeto';
      const existing = await SK.db.get('projects', name);
      if (existing) name = name + ' ' + new Date().toLocaleString('pt-BR').replace(/[/:]/g, '-');
      P = { name, files: files || {}, folders: [], open: [], active: null, updated: Date.now() };
      dirty = true; await saveNow();
      SK.pref.set('lastProject', name);
      SK.emit('project-open', P);
      return P;
    },
    async renameProject(newName) {
      newName = String(newName || '').trim();
      if (!P || !newName || newName === P.name) return;
      if (await SK.db.get('projects', newName)) { SK.toast('Já existe um projeto com esse nome', 'error'); return; }
      const old = P.name;
      P.name = newName; dirty = true; await saveNow();
      await SK.db.del('projects', old);
      SK.pref.set('lastProject', newName);
      SK.emit('project-open', P);
    },
    async deleteProject(name) {
      await SK.db.del('projects', name);
      const cps = await SK.db.allByIndex('checkpoints', 'project', name);
      for (const c of cps) await SK.db.del('checkpoints', c.id);
      if (P && P.name === name) P = null;
    },

    // ── Arquivos ──
    list() { return P ? Object.keys(P.files).sort((a, b) => a.localeCompare(b, 'pt', { numeric: true })) : []; },
    exists(path) { return !!(P && P.files[norm(path)]); },
    isFolder(path) { path = norm(path); return !!P && (P.folders.includes(path) || Object.keys(P.files).some((f) => f.startsWith(path + '/'))); },
    get(path) { return P ? P.files[norm(path)] : undefined; },
    read(path) { const r = fs.get(path); return r ? (r.text != null ? r.text : null) : undefined; },
    write(path, text, opts) {
      path = norm(path);
      if (!path) throw new Error('Nome de arquivo vazio');
      const cur = P.files[path];
      const isNew = !cur;
      P.files[path] = { text: String(text), enc: (cur && cur.enc && cur.enc !== 'binário') ? cur.enc : 'UTF-8', size: new Blob([String(text)]).size };
      ensureParents(path);
      touch({ path, type: isNew ? 'create' : 'edit', silent: opts && opts.silent });
      return path;
    },
    writeRecord(path, rec) { path = norm(path); P.files[path] = rec; ensureParents(path); touch({ path, type: 'create' }); return path; },
    mkdir(path) {
      path = norm(path);
      if (!path) return;
      if (!P.folders.includes(path)) P.folders.push(path);
      ensureParents(path + '/x');
      touch({ path, type: 'mkdir' });
    },
    remove(path) {
      path = norm(path);
      let n = 0;
      for (const f of Object.keys(P.files)) if (f === path || f.startsWith(path + '/')) { delete P.files[f]; n++; }
      P.folders = P.folders.filter((d) => d !== path && !d.startsWith(path + '/'));
      P.open = P.open.filter((f) => P.files[f]);
      if (P.active && !P.files[P.active]) P.active = P.open[0] || null;
      touch({ path, type: 'remove' });
      return n;
    },
    rename(oldPath, newPath) {
      oldPath = norm(oldPath); newPath = norm(newPath);
      if (!newPath || oldPath === newPath) return oldPath;
      if (fs.exists(newPath) || (fs.isFolder(newPath) && fs.isFolder(oldPath))) throw new Error('Já existe "' + newPath + '"');
      const moves = [];
      for (const f of Object.keys(P.files)) {
        if (f === oldPath) moves.push([f, newPath]);
        else if (f.startsWith(oldPath + '/')) moves.push([f, newPath + f.slice(oldPath.length)]);
      }
      for (const [a, b] of moves) { P.files[b] = P.files[a]; delete P.files[a]; }
      P.folders = P.folders.map((d) => (d === oldPath ? newPath : d.startsWith(oldPath + '/') ? newPath + d.slice(oldPath.length) : d));
      P.open = P.open.map((f) => (f === oldPath ? newPath : f.startsWith(oldPath + '/') ? newPath + f.slice(oldPath.length) : f));
      if (P.active === oldPath) P.active = newPath;
      else if (P.active && P.active.startsWith(oldPath + '/')) P.active = newPath + P.active.slice(oldPath.length);
      ensureParents(newPath + (fs.isFolder(newPath) ? '/x' : ''));
      touch({ path: newPath, from: oldPath, type: 'rename' });
      return newPath;
    },
    duplicate(path) {
      path = norm(path);
      const isDir = !P.files[path];
      const ext = isDir ? '' : extOf(path);
      const stem = ext ? path.slice(0, -(ext.length + 1)) : path;
      let i = 1, target;
      do { target = stem + (i === 1 ? ' (cópia)' : ' (cópia ' + i + ')') + (ext ? '.' + ext : ''); i++; } while (fs.exists(target) || fs.isFolder(target));
      if (isDir) {
        for (const f of Object.keys(P.files)) if (f.startsWith(path + '/')) P.files[target + f.slice(path.length)] = JSON.parse(JSON.stringify(P.files[f]));
        P.folders.push(target);
      } else P.files[target] = JSON.parse(JSON.stringify(P.files[path]));
      ensureParents(target + '/x');
      touch({ path: target, type: 'create' });
      return target;
    },
    /** Árvore para desenhar: { name, path, dir, children } */
    tree() {
      const root = { name: P ? P.name : '', path: '', dir: true, children: [] };
      if (!P) return root;
      const dirs = new Map([['', root]]);
      const getDir = (p) => {
        if (dirs.has(p)) return dirs.get(p);
        const node = { name: baseName(p), path: p, dir: true, children: [] };
        dirs.set(p, node);
        getDir(dirName(p)).children.push(node);
        return node;
      };
      P.folders.forEach((d) => getDir(d));
      fs.list().forEach((f) => getDir(dirName(f)).children.push({ name: baseName(f), path: f, dir: false }));
      const sort = (n) => { n.children.sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, 'pt', { numeric: true })); n.children.forEach((c) => c.dir && sort(c)); };
      sort(root);
      return root;
    },
    /** Uma cópia simples de todos os arquivos (para checkpoint, exportar, GitHub). */
    snapshot() { return JSON.parse(JSON.stringify({ files: P.files, folders: P.folders })); },
    restore(snap) {
      P.files = JSON.parse(JSON.stringify(snap.files || {}));
      P.folders = JSON.parse(JSON.stringify(snap.folders || []));
      P.open = P.open.filter((f) => P.files[f]);
      if (P.active && !P.files[P.active]) P.active = P.open[0] || null;
      touch({ type: 'restore' });
    },
    bytesOf(path) {
      const r = fs.get(path);
      if (!r) return null;
      return r.b64 != null ? fromBase64(r.b64) : new TextEncoder().encode(r.text);
    },
    blobOf(path) { const b = fs.bytesOf(path); return b ? new Blob([b], { type: typeOf(path).mime }) : null; },
    setOpen(list, active) { P.open = list; P.active = active; dirty = true; saveSoon(); },
    totalSize() { return P ? Object.values(P.files).reduce((s, r) => s + (r.size || 0), 0) : 0; },
  };

  function ensureParents(path) {
    let d = dirName(path);
    while (d) { if (!P.folders.includes(d)) P.folders.push(d); d = dirName(d); }
  }

  // ── Importar arquivos (do celular/PC, pastas e .zip) ────────────────────────
  fs.importFiles = async (fileList, intoDir, opts) => {
    const files = Array.from(fileList || []);
    let count = 0, encs = {};
    for (const f of files) {
      const rel = norm((intoDir ? intoDir + '/' : '') + (f.webkitRelativePath || f.name));
      const buf = new Uint8Array(await f.arrayBuffer());
      if (SK.zip.ehCompactado(f.name) && !(opts && opts.zipAsFile)) {
        const entries = await SK.zip.readAny(buf, f.name);
        const names = entries.map((e) => e.name);
        const cut = commonRoot(names);
        const base = norm((intoDir ? intoDir + '/' : '') + (opts && opts.zipIntoFolder ? SK.zip.nomeSemExt(f.name) : ''));
        for (const e of entries) {
          const rel2 = e.name.slice(cut);
          if (!rel2 || /(^|\/)(__MACOSX|node_modules|\.git)\//.test(rel2) || /(^|\/)\.DS_Store$/.test(rel2)) continue;
          const rec = recordFromBytes(rel2, e.data);
          encs[rec.enc] = (encs[rec.enc] || 0) + 1;
          P.files[norm((base ? base + '/' : '') + rel2)] = rec; count++;
          ensureParents(norm((base ? base + '/' : '') + rel2));
        }
      } else {
        if (/(^|\/)(node_modules|\.git)\//.test(rel)) continue;
        const rec = recordFromBytes(rel, buf);
        encs[rec.enc] = (encs[rec.enc] || 0) + 1;
        P.files[rel] = rec; ensureParents(rel); count++;
      }
    }
    touch({ type: 'import' });
    return { count, encs };
  };
  function commonRoot(names) {
    if (names.length < 2) return 0;
    const first = names[0].split('/')[0];
    return first && names.every((n) => n.startsWith(first + '/')) ? first.length + 1 : 0;
  }

  /** Exporta o projeto como .zip */
  fs.exportZip = async () => {
    const entries = fs.list().map((p) => ({ name: p, data: fs.bytesOf(p) }));
    P.folders.filter((d) => !entries.some((e) => e.name.startsWith(d + '/'))).forEach((d) => entries.push({ name: d + '/', data: new Uint8Array(0) }));
    return SK.zip.write(entries);
  };

  SK.fs = fs;
})(window.SK);
