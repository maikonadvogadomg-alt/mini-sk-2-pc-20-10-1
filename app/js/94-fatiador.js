/* =========================================================================
   Mini SK — 94-fatiador.js
   ✂️ Fatiador: pega um arquivo grande (JS, TS, TSX, HTML, CSS, Python, MD)
   e divide em BLOCOS de lógica (imports, funções, componentes, classes,
   tipos, estilos, scripts…), com um ÍNDICE.
   - Cada bloco: nome, tipo, linhas, e de quais outros blocos ele depende
     ("usa") — para dividir sem quebrar.
   - Exporta: MD (índice + blocos), TXT com marcadores ===== ARQUIVO =====
     (o ⤵ Montar do Raio-X recria os módulos), e uma página HTML onde cada
     bloco tem o seu botão Copiar.
   - Cria os módulos no projeto (pasta nome-modulos/) e CONFERE: juntando
     os módulos na ordem dá o arquivo original, letra por letra.
   - Junta de volta (🔗) uma pasta de módulos num arquivo só.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  let box, cur = null; // { name, text, lang, blocks }

  // ── Leitura do código (sabe pular textos, comentários e regex) ─────────────
  /** Para cada linha: profundidade de { ( [ no começo da linha e se começa "dentro" de algo. */
  function lineStates(text, lang) {
    const n = text.length; const st = [{ d: 0, inside: false }];
    let d = 0; const stack = []; let mode = 'code'; let prevSig = '';
    const isPy = lang === 'py', isCss = lang === 'css';
    for (let i = 0; i < n; i++) {
      const c = text[i], nx = text[i + 1];
      if (c === '\n') {
        if (mode === 'lc') mode = 'code';
        if ((mode === 'sq' || mode === 'dq') && !isPy) mode = 'code';
        st.push({ d, inside: mode !== 'code' || stack.length > 0 });
        continue;
      }
      if (mode === 'lc') continue;
      if (mode === 'bc') { if (c === '*' && nx === '/') { mode = 'code'; i++; } continue; }
      if (mode === 'sq' || mode === 'dq') { if (c === '\\') { i++; continue; } if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"')) mode = 'code'; continue; }
      if (mode === 'tq') { if (c === '\\') { i++; continue; } if (text.startsWith(stack[stack.length - 1].q, i)) { i += 2; stack.pop(); mode = 'code'; } continue; }
      if (mode === 're') { if (c === '\\') { i++; continue; } if (c === '[') mode = 'rec'; else if (c === '/') mode = 'code'; continue; }
      if (mode === 'rec') { if (c === '\\') { i++; continue; } if (c === ']') mode = 're'; continue; }
      if (mode === 'tpl') {
        if (c === '\\') { i++; continue; }
        if (c === '`') { stack.pop(); mode = stack.length && stack[stack.length - 1].t === 'tpl' ? 'tpl' : 'code'; continue; }
        if (c === '$' && nx === '{') { stack.push({ t: 'expr', d }); mode = 'code'; i++; continue; }
        continue;
      }
      // code
      if (c === ' ' || c === '\t' || c === '\r') continue;
      if (isPy && c === '#') { mode = 'lc'; continue; }
      if (!isPy && c === '/' && nx === '/' && !isCss) { mode = 'lc'; continue; }
      if (!isPy && c === '/' && nx === '*') { mode = 'bc'; i++; continue; }
      if (isPy && (text.startsWith('"""', i) || text.startsWith("'''", i))) { stack.push({ t: 'tq', q: text.substr(i, 3) }); mode = 'tq'; i += 2; continue; }
      if (c === "'") { mode = 'sq'; prevSig = c; continue; }
      if (c === '"') { mode = 'dq'; prevSig = c; continue; }
      if (c === '`' && !isPy && !isCss) { stack.push({ t: 'tpl' }); mode = 'tpl'; prevSig = c; continue; }
      if (c === '/' && !isPy && !isCss) {
        const before = text.slice(Math.max(0, i - 12), i).trimEnd();
        const tsBang = prevSig === '!' && /[\w$)\]]!\s*$/.test(before); // x! / y  (TypeScript)
        if (!tsBang && (!prevSig || /[(,=:[!&|?{;+\-*%~^]$/.test(prevSig) || (prevSig === '>' && /=>\s*$/.test(before)) || /\b(return|typeof|case|else|in|of|void|delete|throw)$/.test(before))) { mode = 're'; continue; }
      }
      if (c === '}' && stack.length && stack[stack.length - 1].t === 'expr' && d === stack[stack.length - 1].d) { stack.pop(); mode = 'tpl'; prevSig = c; continue; }
      if (c === '{' || c === '(' || c === '[') d++;
      else if (c === '}' || c === ')' || c === ']') d = Math.max(0, d - 1);
      prevSig = c;
    }
    return st;
  }

  // ── Divisores por tipo (todos devolvem faixas de linhas que cobrem TUDO) ──
  const JS_START = /^(export\s+(default\s+)?)?(declare\s+)?(abstract\s+)?(async\s+)?(function\*?[\s(]|class\s|const\s|let\s|var\s|interface\s|type\s+[\w$]+|enum\s|namespace\s)/;
  const JS_OTHER = /^(return\s*\(?\s*$|return\s*\(?\s*<|import[\s{*'"]|export\s*(\{|\*)|export\s+default\b|module\.exports|exports\.|['"]use strict['"]|(?!(if|for|while|switch|catch|return|else|do|try|await|typeof|new|super|throw|yield|delete|void)\b)[A-Za-z_$][\w$]*(\.[\w$]+)*\s*\(|\(\s*(async\s*)?(function|\(|[\w$]+\s*=>)|;?\(function|!function)/;
  function nameOfJs(line, isTsx) {
    const t = line.trim(); let m;
    if (/^import\b/.test(t)) return ['imports', 'imports'];
    if (/^return\b/.test(t)) return ['tela (o que aparece — JSX)', 'tela'];
    if ((m = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s*([\w$]*)/.exec(t))) { const nm = m[1] || 'default'; return [nm, /^[A-Z]/.test(nm) && isTsx ? 'componente' : 'função']; }
    if ((m = /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([\w$]+)/.exec(t))) return [m[1], 'classe'];
    if ((m = /^(?:export\s+)?(?:declare\s+)?(?:interface|type|enum)\s+([\w$]+)/.exec(t))) return [m[1], 'tipo'];
    if ((m = /^(?:export\s+)?(?:declare\s+)?(?:const|let|var)\s+(?:\{([^}]*)\}|\[([^\]]*)\]|([\w$]+))/.exec(t))) {
      const nm = (m[3] || (m[1] || m[2] || '').split(',').map((x) => x.split(':').pop().trim()).filter(Boolean).slice(0, 3).join(', ')) || '?';
      const isFn = /=\s*(async\s*)?(\([^)]*\)|[\w$]+)\s*(:\s*[^=]+)?=>|=\s*(async\s+)?function/.test(t) || /=\s*(React\.)?(memo|forwardRef|lazy)\(/.test(t);
      return [nm, isFn ? (/^[A-Z]/.test(nm) && isTsx ? 'componente' : 'função') : 'constante'];
    }
    if (/^export\s+default\b/.test(t)) return ['export default', 'exportação'];
    if (/^export\s*\{|^module\.exports|^exports\./.test(t)) return ['exportações', 'exportação'];
    if (/^['"]use strict['"]/.test(t)) return ['use strict', 'outro'];
    if ((m = /^([A-Za-z_$][\w$.]*)\s*\(/.exec(t))) return [m[1] + '(…)', 'chamada'];
    if (/^;?\(|^!function/.test(t)) return ['função imediata (IIFE)', 'código'];
    return [t.slice(0, 40), 'código'];
  }
  function splitByStarts(lines, starts, nameFn) {
    const set = [...new Set(starts)].sort((a, b) => a - b);
    if (!set.length || set[0] !== 0) set.unshift(0);
    const blocks = [];
    set.forEach((s, k) => {
      const e = k + 1 < set.length ? set[k + 1] : lines.length;
      if (e > s) blocks.push({ a: s, b: e });
    });
    blocks.forEach((bl) => { const first = lines.slice(bl.a, bl.b).find((l) => l.trim() && !/^\s*(\/\/|\/\*|\*|#|<!--)/.test(l)) || lines[bl.a] || ''; const [nm, kind] = nameFn(first, bl, lines[bl.a] || ''); bl.name = nm; bl.kind = kind; });
    return blocks;
  }
  /** Volta o começo do bloco para incluir os comentários logo acima dele. */
  function pullComments(lines, starts, states, base, commentRe) {
    return starts.map((s) => {
      let k = s;
      while (k > 0 && states[k - 1].d === base && !states[k - 1].inside && commentRe.test(lines[k - 1]) && !starts.includes(k - 1)) k--;
      return k;
    });
  }
  function splitJs(text, lang, forceBase) {
    const lines = text.split('\n');
    const isTsx = /tsx|jsx/.test(lang);
    const states = lineStates(text, 'js');
    const tryBase = (base) => {
      const starts = [];
      lines.forEach((l, i) => {
        const s = states[i]; if (s.inside || s.d !== base) return;
        const t = l.trim(); if (!t) return;
        if (JS_START.test(t) || JS_OTHER.test(t)) starts.push(i);
      });
      return pullComments(lines, starts, states, base, /^\s*(\/\/|\/\*|\*|\*\/)/);
    };
    let starts = forceBase ? [0].concat(tryBase(forceBase)) : tryBase(0);
    // arquivo todo dentro de um "invólucro" (ex.: (function (SK) { … })(…)): divide por dentro
    if (!forceBase && starts.length < 4 && lines.length > 60) {
      for (const base of [1, 2, 3]) {
        const inner = tryBase(base);
        const decls = inner.filter((i) => JS_START.test((lines.slice(i).find((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l)) || '').trim())).length;
        if (decls >= 3) { starts = [0].concat(inner); break; }
      }
    }
    let blocks = splitByStarts(lines, starts, (first) => nameOfJs(first, isTsx));
    // junta imports seguidos (e "use strict") num bloco só; e linhas curtas seguidas (ex.: vários useState) num grupo
    const merged = [];
    for (const b of blocks) {
      const last = merged[merged.length - 1];
      if (last && last.kind === 'imports' && (b.kind === 'imports' || !lines.slice(b.a, b.b).join('').trim())) { last.b = b.b; continue; }
      const short = (x) => x.b - x.a <= 2 && /constante|chamada/.test(x.kind);
      if (last && short(b) && (short(last) || last.grupo)) { if (!last.grupo) { last.grupo = [last.name]; last.kind = 'grupo'; } last.grupo.push(b.name); last.name = last.grupo.slice(0, 4).join(', ') + (last.grupo.length > 4 ? ' … (+' + (last.grupo.length - 4) + ')' : ''); last.b = b.b; continue; }
      merged.push(b);
    }
    return merged;
  }
  function splitCss(text) {
    const lines = text.split('\n'); const states = lineStates(text, 'css');
    const starts = []; let since = 0;
    lines.forEach((l, i) => {
      const s = states[i]; if (s.inside || s.d !== 0) return; const t = l.trim(); if (!t) return;
      if (/^\/\*/.test(t) && (i === 0 || !lines[i - 1].trim() || /^\/\*.*(=|─|—|-{3}|\*{3})/.test(t))) { starts.push(i); since = i; return; }
      if (/^@(media|keyframes|font-face|supports|layer|container)\b|^:root\b/.test(t)) { starts.push(i); since = i; return; }
      if (i - since > 40 && /[{,]\s*$/.test(t)) { starts.push(i); since = i; }
    });
    return splitByStarts(lines, starts, (first, bl, head) => {
      const h = head.trim(); const hm = /^\/\*+\s*[=─—\-*]*\s*(.*?)\s*[=─—\-*]*\s*(\*\/)?$/.exec(h);
      if (/^\/\*/.test(h) && hm && hm[1]) return [hm[1].slice(0, 50), 'seção'];
      const t = first.trim(); const m = /^\/\*+\s*[=─—\-*]*\s*(.*?)\s*[=─—\-*]*\s*\*\/$/.exec(t);
      if (m && m[1]) return [m[1].slice(0, 50), 'seção'];
      if (/^@/.test(t)) return [t.replace(/\s*\{.*$/, '').slice(0, 50), 'regra @'];
      return [t.replace(/\s*\{.*$/, '').slice(0, 50), 'estilos'];
    });
  }
  function splitPy(text) {
    const lines = text.split('\n'); const states = lineStates(text, 'py');
    const starts = [];
    lines.forEach((l, i) => {
      if (states[i].inside || states[i].d !== 0) return;
      if (/^(def |async def |class |@|if __name__)/.test(l)) { if (/^@/.test(l) && i > 0 && /^@/.test(lines[i - 1])) return; starts.push(i); }
      else if (/^(import |from )/.test(l) && !(i > 0 && /^(import |from )/.test(lines[i - 1]))) starts.push(i);
    });
    const st2 = pullComments(lines, starts, states, 0, /^#/);
    return splitByStarts(lines, st2, (first) => {
      let m; const t = first.trim();
      if (/^(import|from) /.test(t)) return ['imports', 'imports'];
      if ((m = /^(?:async\s+)?def\s+(\w+)/.exec(t))) return [m[1], 'função'];
      if ((m = /^class\s+(\w+)/.exec(t))) return [m[1], 'classe'];
      if (/^@/.test(t)) { const nx = (/(?:def|class)\s+(\w+)/.exec(lines.slice(lines.indexOf(first)).join('\n')) || [])[1]; return [nx || t, 'função']; }
      if (/^if __name__/.test(t)) return ['principal (__main__)', 'código'];
      return [t.slice(0, 40), 'código'];
    });
  }
  function splitMd(text) {
    const lines = text.split('\n'); const starts = []; let inFence = false;
    lines.forEach((l, i) => { if (/^\s*(```|~~~)/.test(l)) inFence = !inFence; if (!inFence && /^#{1,3}\s/.test(l)) starts.push(i); });
    return splitByStarts(lines, starts, (first) => [first.replace(/^#+\s*/, '').slice(0, 60) || '(início)', 'seção']);
  }
  function splitPlain(text) {
    const lines = text.split('\n'); const starts = []; let since = 0;
    lines.forEach((l, i) => { if (i - since >= 80 && !l.trim()) { starts.push(i + 1); since = i; } });
    return splitByStarts(lines, starts.filter((s) => s < lines.length), (first) => [first.trim().slice(0, 40) || '(trecho)', 'trecho']);
  }
  function splitHtml(text) {
    const lines = text.split('\n'); const out = [];
    let i = 0; let seg = { a: 0, kind: 'html' };
    const push = (b, kind, name) => { if (b > seg.a) out.push({ a: seg.a, b, kind: seg.kind, name: seg.name }); seg = { a: b, kind, name }; };
    let sc = 0, stc = 0;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (/^<style\b/i.test(t) && !/<\/style>/i.test(t)) {
        push(i, 'html'); stc++;
        let j = i + 1; while (j < lines.length && !/<\/style>/i.test(lines[j])) j++;
        out.push({ a: i, b: i + 1, kind: 'tag', name: '<style> ' + stc });
        const inner = lines.slice(i + 1, j).join('\n');
        if (j > i + 1) splitCss(inner).forEach((bl) => out.push({ a: i + 1 + bl.a, b: i + 1 + bl.b, kind: bl.kind, name: 'CSS › ' + bl.name, lang: 'css' }));
        seg = { a: j, kind: 'html' }; i = j; continue;
      }
      if (/^<script\b/i.test(t) && !/<\/script>/i.test(t)) {
        push(i, 'html'); sc++;
        let j = i + 1; while (j < lines.length && !/<\/script>/i.test(lines[j])) j++;
        const isMod = /type=["']?module/i.test(t);
        out.push({ a: i, b: i + 1, kind: 'tag', name: '<script> ' + sc + (isMod ? ' (módulo)' : '') });
        const inner = lines.slice(i + 1, j).join('\n');
        if (j > i + 1) splitJs(inner, 'js').forEach((bl) => out.push({ a: i + 1 + bl.a, b: i + 1 + bl.b, kind: bl.kind, name: 'JS › ' + bl.name, lang: 'js' }));
        seg = { a: j, kind: 'html' }; i = j; continue;
      }
      if (/^<head\b/i.test(t)) push(i, 'html', 'cabeçalho (head)');
      else if (/^<body\b/i.test(t)) push(i, 'html', 'corpo (body)');
      else if (/^<!--/.test(t) && i > seg.a) push(i, 'html', t.replace(/^<!--\s*|\s*-->.*$/g, '').slice(0, 50));
      i++;
    }
    push(lines.length, 'html');
    return out.filter((b) => b.b > b.a).map((b) => Object.assign(b, { name: b.name || (lines[b.a] || '').trim().slice(0, 40) || 'html', lang: b.lang || 'html' }));
  }
  function langOf(name, text) {
    const e = (name.split('.').pop() || '').toLowerCase();
    if (/^(tsx|jsx)$/.test(e)) return e; if (/^(ts|mts|cts)$/.test(e)) return 'ts'; if (/^(js|mjs|cjs)$/.test(e)) return 'js';
    if (/^(html?|vue|svelte)$/.test(e)) return 'html'; if (/^(css|scss|less)$/.test(e)) return 'css'; if (e === 'py') return 'py'; if (/^(md|markdown)$/.test(e)) return 'md';
    if (/^\s*<(!doctype|html|head|body|div)/i.test(text)) return 'html';
    if (/^\s*(import|export|const|function|let|var)\b/m.test(text)) return 'js';
    return 'txt';
  }
  function slice(name, text) {
    text = text.replace(/\r\n/g, '\n');
    const lang = langOf(name, text);
    let blocks;
    if (lang === 'html') blocks = splitHtml(text);
    else if (/^(js|ts|tsx|jsx)$/.test(lang)) blocks = splitJs(text, lang);
    else if (lang === 'css') blocks = splitCss(text);
    else if (lang === 'py') blocks = splitPy(text);
    else if (lang === 'md') blocks = splitMd(text);
    else blocks = splitPlain(text);
    const lines = text.split('\n');
    // dependências entre blocos (JS/TS)
    const named = blocks.filter((b) => /função|componente|classe|constante|tipo/.test(b.kind));
    blocks.forEach((b, k) => {
      b.n = k + 1; b.text = lines.slice(b.a, b.b).join('\n'); b.lang = b.lang || lang;
      b.uses = [];
    });
    named.forEach((dep) => {
      const ids = dep.name.split(/,\s*/).filter((x) => /^[A-Za-z_$][\w$]*$/.test(x));
      if (!ids.length) return;
      const re = new RegExp('(^|[^\\w$.])(' + ids.map((x) => x.replace(/\$/g, '\\$')).join('|') + ')(?![\\w$])');
      blocks.forEach((b) => { if (b !== dep && b.kind !== 'tag' && re.test(b.text.replace(/\/\/.*$/gm, ''))) b.uses.push(dep.n); });
    });
    blocks.forEach((b) => { b.usedBy = blocks.filter((o) => o.uses.includes(b.n)).map((o) => o.n); });
    return { name, text, lang, lines: lines.length, blocks };
  }
  const rejoin = (blocks) => blocks.map((b) => b.text).join('\n');

  // ── Exportações ─────────────────────────────────────────────────────────────
  const fence = (l) => ({ js: 'js', ts: 'ts', tsx: 'tsx', jsx: 'jsx', html: 'html', css: 'css', py: 'python', md: 'md' }[l] || '');
  const slug = (s) => String(s || 'bloco').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'bloco';
  const extFor = (b, fileLang) => ({ js: 'js', ts: 'ts', tsx: 'tsx', jsx: 'jsx', html: 'html', css: 'css', py: 'py', md: 'md' }[b.lang || fileLang] || 'txt');
  const pad = (n, w) => String(n).padStart(w, '0');
  function modPath(r, b) { const w = String(r.blocks.length).length; return baseName(r.name) + '-modulos/' + pad(b.n, Math.max(2, w)) + '-' + slug(b.name) + '.' + extFor(b, r.lang); }
  const baseName = (p) => p.split('/').pop().replace(/\.[^.]+$/, '') || 'arquivo';
  function indexMD(r) {
    const L = ['# Índice de `' + r.name + '`', '', r.lines + ' linhas · ' + r.blocks.length + ' blocos · gerado pelo Mini SK', '', '| Nº | Nome | Tipo | Linhas | Usa | Usado por |', '|---|---|---|---|---|---|'];
    r.blocks.forEach((b) => L.push('| ' + b.n + ' | ' + b.name.replace(/\|/g, '\\|') + ' | ' + b.kind + ' | ' + (b.a + 1) + '–' + b.b + ' | ' + (b.uses.join(', ') || '—') + ' | ' + (b.usedBy.join(', ') || '—') + ' |'));
    return L.join('\n') + '\n';
  }
  function toMD(r) {
    return indexMD(r) + '\n' + r.blocks.map((b) => '## ' + b.n + '. ' + b.name + '  \n_' + b.kind + ' · linhas ' + (b.a + 1) + '–' + b.b + (b.uses.length ? ' · usa ' + b.uses.join(', ') : '') + '_\n\n```' + fence(b.lang) + '\n' + b.text + '\n```\n').join('\n');
  }
  function toTXT(r) {
    return '# Módulos de "' + r.name + '" — use o ⤵ Montar do Raio-X para recriar os arquivos.\n# Juntando os arquivos na ordem (01, 02, 03…) volta o original.\n\n' +
      r.blocks.map((b) => '===== ARQUIVO: ' + modPath(r, b) + ' =====\n' + b.text + '\n===== FIM: ' + modPath(r, b) + ' =====\n').join('\n');
  }
  function toHTML(r) {
    const esc = SK.esc;
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blocos de ' + esc(r.name) + '</title><style>' +
      ':root{color-scheme:dark}body{margin:0;background:#0f1420;color:#d8deea;font:14px/1.5 system-ui,sans-serif}header{position:sticky;top:0;background:#151b2b;padding:10px 14px;border-bottom:1px solid #263048;z-index:2}h1{font-size:16px;margin:0 0 6px}input{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #34405e;background:#0b0f18;color:inherit}' +
      'nav{padding:8px 14px;columns:2 260px;font-size:13px}nav a{color:#8fb8ff;text-decoration:none;display:block;break-inside:avoid}section{margin:12px 14px;border:1px solid #263048;border-radius:10px;overflow:hidden}.h{display:flex;gap:8px;align-items:center;background:#1b2337;padding:6px 10px;flex-wrap:wrap}.h b{flex:1}.k{font-size:11px;color:#8592ab}' +
      'button{background:#2f6be0;color:#fff;border:0;border-radius:7px;padding:6px 12px;font:inherit;cursor:pointer}pre{margin:0;padding:10px;overflow:auto;max-height:60vh;font:12px/1.45 ui-monospace,Consolas,monospace;background:#0b0f18;white-space:pre}</style></head><body>' +
      '<header><h1>✂️ ' + esc(r.name) + ' — ' + r.blocks.length + ' blocos</h1><input id="q" placeholder="Procurar bloco…"></header><nav>' + r.blocks.map((b) => '<a href="#b' + b.n + '">' + b.n + '. ' + esc(b.name) + ' <span class="k">' + esc(b.kind) + '</span></a>').join('') + '</nav>' +
      r.blocks.map((b) => '<section id="b' + b.n + '" data-s="' + esc((b.name + ' ' + b.kind).toLowerCase()) + '"><div class="h"><b>' + b.n + '. ' + esc(b.name) + '</b><span class="k">' + esc(b.kind) + ' · linhas ' + (b.a + 1) + '–' + b.b + (b.uses.length ? ' · usa ' + b.uses.join(', ') : '') + '</span><button onclick="cp(this)">Copiar</button></div><pre>' + esc(b.text) + '</pre></section>').join('') +
      '<script>function cp(b){var t=b.closest("section").querySelector("pre").textContent;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){b.textContent="Copiado ✓";setTimeout(function(){b.textContent="Copiar"},1500)}).catch(function(){var a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove();b.textContent="Copiado ✓"})}' +
      'document.getElementById("q").oninput=function(){var q=this.value.toLowerCase();document.querySelectorAll("section").forEach(function(s){s.hidden=q&&s.dataset.s.indexOf(q)<0})};<\/script></body></html>';
  }

  // ── Interface ───────────────────────────────────────────────────────────────
  function build(container) {
    box = container;
    box.innerHTML =
      '<p class="muted small">Divide um arquivo grande em <b>blocos de lógica</b> com índice, sem perder nada: juntando os blocos na ordem, volta o original.</p>' +
      '<div class="row"><select class="inp grow" id="ft-file"></select><button class="btn primary" id="ft-go">✂️ Fatiar</button></div>' +
      '<details><summary class="small">Ou colar um código</summary><div class="stack" style="margin-top:6px"><input class="inp mono" id="ft-pname" placeholder="nome (ex.: App.tsx, app.js, pagina.html)" value="colado.js"><textarea class="inp mono" id="ft-paste" rows="6" placeholder="Cole aqui o código…"></textarea><button class="btn small" id="ft-go2">✂️ Fatiar o colado</button></div></details>' +
      '<div id="ft-out"></div>';
    const $ = (s) => SK.$(s, box);
    $('#ft-go').onclick = () => { const p = $('#ft-file').value; if (!p) return; run(p, fs().read(p) || ''); };
    $('#ft-go2').onclick = () => { const t = $('#ft-paste').value; if (!t.trim()) return SK.toast('Cole um código primeiro', 'error'); run($('#ft-pname').value.trim() || 'colado.js', t); };
    $('#ft-out').addEventListener('click', onClick);
    fill();
  }
  function fill() {
    if (!box || !fs().project) return;
    const files = fs().list().filter((p) => fs().read(p) != null && !/(^|\/)(node_modules|dist)\//.test(p) && /\.(m?[jt]sx?|cjs|html?|css|scss|py|md|vue|svelte|txt)$/i.test(p))
      .map((p) => [p, (fs().get(p).size || 0)]).sort((a, b) => b[1] - a[1]);
    const curSel = SK.$('#ft-file', box).value || SK.editor.current;
    SK.$('#ft-file', box).innerHTML = files.length ? files.map(([p, s]) => '<option value="' + SK.esc(p) + '"' + (p === curSel ? ' selected' : '') + '>' + SK.esc(p) + ' · ' + SK.bytes(s) + '</option>').join('') : '<option value="">(sem arquivos de código)</option>';
  }
  function run(name, text) {
    cur = slice(name, text);
    cur.fromProject = fs().exists(name);
    const ok = rejoin(cur.blocks) === cur.text;
    const r = cur;
    const kinds = {}; r.blocks.forEach((b) => (kinds[b.kind] = (kinds[b.kind] || 0) + 1));
    SK.$('#ft-out', box).innerHTML =
      '<div class="ft-sum"><b>' + SK.esc(r.name) + '</b> · ' + SK.fmt(r.lines) + ' linhas · <b>' + r.blocks.length + ' blocos</b><div class="small muted">' + Object.entries(kinds).map(([k, v]) => v + ' ' + k).join(' · ') + '</div>' +
      '<div class="small ' + (ok ? 'ok-txt' : 'bad-txt') + '">' + (ok ? '✅ Conferido: juntando os blocos dá o arquivo original, letra por letra.' : '⚠ Os blocos não reconstroem o original — não crie módulos; avise o Maikon-dev 🙂') + '</div></div>' +
      '<div class="row wrap"><button class="btn small" data-ft="md">⤓ MD</button><button class="btn small" data-ft="txt">⤓ TXT (módulos)</button><button class="btn small" data-ft="html">⤓ HTML (copiar blocos)</button><button class="btn small" data-ft="idx">📋 Copiar índice</button></div>' +
      '<div class="row wrap"><button class="btn small primary" data-ft="mods"' + (ok ? '' : ' disabled') + '>✂️ Criar módulos no projeto</button><button class="btn small" data-ft="join">🔗 Juntar uma pasta de módulos</button><button class="btn small" data-ft="ai">🤖 IA: como modularizar sem quebrar</button></div>' +
      '<div class="ft-list">' + r.blocks.map((b) => '<div class="ft-b" data-n="' + b.n + '"><div class="row"><span class="ft-n">' + b.n + '</span><b class="grow">' + SK.esc(b.name) + '</b><span class="pill">' + SK.esc(b.kind) + '</span></div>' +
        '<div class="muted small">linhas ' + (b.a + 1) + '–' + b.b + ' · ' + (b.b - b.a) + ' linha(s)' + (b.uses.length ? ' · <span title="Este bloco usa coisas definidas nestes blocos">usa ' + b.uses.join(', ') + '</span>' : '') + (b.usedBy.length ? ' · usado por ' + b.usedBy.join(', ') : '') + '</div>' +
        '<div class="row tight"><button class="btn tiny" data-ft="see">Ver</button><button class="btn tiny" data-ft="copy">Copiar</button>' + ((b.b - b.a > 120 && /^(js|ts|tsx|jsx)$/.test(b.lang)) ? '<button class="btn tiny" data-ft="inner">✂️ por dentro</button>' : '') + '</div><div class="ft-inner"></div></div>').join('') + '</div>';
  }
  async function onClick(e) {
    const b = e.target.closest('[data-ft]'); if (!b || !cur) return;
    const act = b.dataset.ft; const r = cur; const base = baseName(r.name);
    const card = b.closest('[data-n]'); const blk = card ? r.blocks[+card.dataset.n - 1] : null;
    if (act === 'see' && blk) {
      if (r.fromProject) { SK.editor.reveal(r.name, blk.a + 1, 1, 0); SK.emit('picked-result'); }
      else SK.confirm(blk.text.slice(0, 4000) + (blk.text.length > 4000 ? '\n…' : ''), { title: blk.n + '. ' + blk.name, okText: 'Fechar' });
    }
    if (act === 'copy' && blk) SK.copy(blk.text);
    if (act === 'inner' && blk) {
      const el = SK.$('.ft-inner', card);
      if (el.innerHTML) { el.innerHTML = ''; return; }
      const inner = splitJs(blk.text, blk.lang, 1).filter((x) => x.b > x.a);
      const blines = blk.text.split('\n');
      el.innerHTML = '<div class="muted small">Dentro de "' + SK.esc(blk.name) + '": ' + inner.length + ' partes</div>' + inner.map((x) => '<div class="ft-sub" data-a="' + (blk.a + x.a) + '" data-b="' + (blk.a + x.b) + '"><span class="grow">' + SK.esc(x.name) + ' <span class="muted small">' + x.kind + ' · ' + (blk.a + x.a + 1) + '–' + (blk.a + x.b) + '</span></span><button class="btn tiny" data-ft="subsee">Ver</button><button class="btn tiny" data-ft="subcopy">Copiar</button></div>').join('');
      el._lines = blines; el._base = blk.a;
    }
    if (act === 'subsee' || act === 'subcopy') {
      const row = b.closest('[data-a]'); const a = +row.dataset.a, z = +row.dataset.b;
      const txt = r.text.split('\n').slice(a, z).join('\n');
      if (act === 'subcopy') SK.copy(txt);
      else if (r.fromProject) { SK.editor.reveal(r.name, a + 1, 1, 0); SK.emit('picked-result'); }
      else SK.confirm(txt.slice(0, 4000), { title: 'Parte', okText: 'Fechar' });
    }
    if (act === 'md') SK.download(base + '-blocos.md', toMD(r), 'text/markdown;charset=utf-8');
    if (act === 'txt') SK.download(base + '-modulos.txt', toTXT(r));
    if (act === 'html') SK.download(base + '-blocos.html', toHTML(r), 'text/html;charset=utf-8');
    if (act === 'idx') SK.copy(indexMD(r));
    if (act === 'mods') {
      const dir = (fs().dirName(r.name) ? fs().dirName(r.name) + '/' : '') + base + '-modulos';
      if (!(await SK.confirm('Criar ' + r.blocks.length + ' arquivos em "' + dir + '/"? O arquivo original NÃO é apagado nem alterado.', { okText: 'Criar módulos' }))) return;
      await SK.checkpoints.auto('Antes de fatiar ' + r.name);
      const pre = fs().dirName(r.name) ? fs().dirName(r.name) + '/' : '';
      r.blocks.forEach((bl) => fs().write(pre + modPath(r, bl), bl.text, { silent: true }));
      fs().write(dir + '/_indice.md', indexMD(r) + '\n> Para juntar de volta: ✂️ Fatiador → 🔗 Juntar uma pasta de módulos → "' + dir + '".\n> ' + (/^(js|ts|tsx|jsx)$/.test(r.lang) ? 'Atenção: estes pedaços são cortes do MESMO arquivo. Para usar como módulos separados de verdade, cada um precisa importar o que "usa" (veja a coluna Usa). Peça à IA: "transforme estes blocos em módulos com import/export".' : ''), { silent: true });
      SK.emit('fs-change', { type: 'import' });
      const back = r.blocks.map((bl) => fs().read(pre + modPath(r, bl))).join('\n');
      SK.toast(back === r.text ? '✅ ' + r.blocks.length + ' módulos criados — conferido, nada se perdeu' : '⚠ Módulos criados, mas a conferência falhou', back === r.text ? undefined : 'error');
    }
    if (act === 'join') {
      const dirs = [...new Set(fs().list().filter((p) => /-modulos\/\d+-[^/]+$/.test(p)).map((p) => fs().dirName(p)))];
      if (!dirs.length) return SK.toast('Nenhuma pasta "...-modulos" no projeto', 'error');
      const dir = await SK.prompt('Qual pasta juntar?\n' + dirs.join('\n'), dirs[0], { okText: 'Juntar' }); if (!dir) return;
      const parts = fs().list().filter((p) => fs().dirName(p) === dir && /\/\d+-[^/]+$/.test(p)).sort((a, b) => parseInt(a.split('/').pop(), 10) - parseInt(b.split('/').pop(), 10));
      if (!parts.length) return SK.toast('Pasta sem módulos numerados', 'error');
      const ext = parts[0].split('.').pop(); const origName = dir.replace(/-modulos$/, '');
      const out = parts.map((p) => fs().read(p) || '').join('\n');
      const target = origName + '.juntado.' + (fs().list().find((p) => p.startsWith(origName + '.')) || '').split('.').pop() || ext;
      fs().write(target, out);
      const orig = fs().list().find((p) => p.replace(/\.[^.]+$/, '') === origName && !p.includes('.juntado.'));
      SK.toast('🔗 ' + parts.length + ' módulos juntados em ' + target + (orig ? (fs().read(orig) === out ? ' — idêntico ao original ✅' : ' — diferente do original (você editou algum módulo)') : ''));
      SK.editor.open(target);
    }
    if (act === 'ai') {
      SK.app.openSide('ai');
      const inp = SK.$('#ai-in');
      if (inp) { inp.value = 'Quero transformar o arquivo "' + r.name + '" em módulos separados SEM QUEBRAR nada. Abaixo está o índice dos blocos (com quem usa quem). Proponha a divisão em arquivos (um por assunto, poucos e coerentes), diga o que cada um precisa importar/exportar e mande os arquivos completos com filepath, um por vez se for grande.\n\n' + indexMD(r); inp.focus(); }
    }
  }
  SK.on('project-open', () => { cur = null; if (box) { SK.$('#ft-out', box).innerHTML = ''; fill(); } });
  SK.on('fs-change', SK.debounce(() => { if (box) fill(); }, 600));

  SK.fatiador = { build, fill, slice, rejoin, toMD, toTXT, toHTML, indexMD };
})(window.SK);
