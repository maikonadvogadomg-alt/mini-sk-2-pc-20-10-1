/* =========================================================================
   Mini SK — 93-conversa.js
   🧩 Desembaralhar conversa: lê uma conversa copiada do app de IA (Monica,
   ChatGPT, Claude…) onde o código veio SEM marcação (sem ```), separa o
   que é texto e o que é código, e recupera cada arquivo:
   - páginas HTML inteiras (<!DOCTYPE … </html>);
   - pedaços (CSS, JS, JSON, .bat, comandos) — o nome vem do título que a
     IA escreveu antes ("PARTE 2: ESTILOS (styles.js)") ou do comentário
     do topo ("// MÓDULO: PROJETOS");
   - versões: o mesmo arquivo repetido vira v1, v2, v3… e a ÚLTIMA fica
     marcada como "mais recente".
   ========================================================================= */
(function (SK) {
  'use strict';
  const SPEAKER = /^(Monica|Haiku[\w .,-]*|Claude[\w .,-]*|Gemini[\w .,-]*|GPT[\w .,-]*|ChatGPT[\w .,-]*|Grok[\w .,-]*|DeepSeek[\w .,-]*|Sonnet[\w .,-]*|Opus[\w .,-]*|Llama[\w .,-]*|Mistral[\w .,-]*|Qwen[\w .,-]*|Copilot[\w .,-]*|Perplexity[\w .,-]*)$/i;
  const DATE = /^\d{1,2} de [a-zç]+ de \d{4}( às \d{1,2}:\d{2})?$/i;
  const COPY = /^\s*(Copiar|Copy|Copy code|Copiar código|Copiado!?)\s*[​-‏﻿]*\s*$/i;

  function codeScore(l) {
    const t = l.trim(); if (!t) return 0;
    if (COPY.test(t) || SPEAKER.test(t) || DATE.test(t)) return -5;
    let s = 0;
    if (/^<\/?[a-zA-Z!][^>]*>?/.test(t)) s += 3;
    if (/[;{}]\s*$/.test(t)) s += 3;
    if (/^[})\]][;,)]*$/.test(t)) s += 3;
    if (/=>|===|!==|\(\)|\bconst |\blet |\bvar |\bfunction\b|\breturn\b|\bawait\b|\bimport\b|\bexport\b|document\.|window\.|console\.|this\./.test(t)) s += 2;
    if (/^[.#:@*]?[a-z][\w-]*(\s*[,>+~ ][^{]*)?\s*\{/.test(t)) s += 2;
    if (/^[a-z-]+\s*:\s*[^;]+;\s*$/.test(t)) s += 2;
    if (/^(\/\/|\/\*|\*|<!--|#!|@echo|REM |set |if |for |echo |npm |npx |git |cd |mkdir |pnpm |pip |python )/i.test(t)) s += 2;
    if (/^\s{2,}\S/.test(l)) s += 1;
    const words = t.split(/\s+/).length;
    if (words >= 7 && /[a-záéíóúâêôãõç]{3,}\s+[a-záéíóúâêôãõç]{3,}\s+[a-záéíóúâêôãõç]{3,}/i.test(t) && !/[;{}=<>]/.test(t)) s -= 4;
    if (/^(PARTE|Parte|Passo|Etapa|Opção|Observação|Nota|Pronto|Agora|Para |Se |Isso|Este|Esta|O que|Como|Por que|Substitua|Cole|Copie|Crie|Adicione|✅|❌|⚠|🚀|📌|💡|👉|🔧|📁|•|- [A-Z])/.test(t) && !/[;{}]$/.test(t)) s -= 3;
    if (/[.!?:]$/.test(t) && words >= 5 && !/[;{}]/.test(t)) s -= 2;
    if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 /()-]{2,}:\s*$/.test(t)) s -= 4;          // "ESTRUTURA:", "COMO USAR:"
    if (/[├└│┌┐┘┬┴┼]──|^[│|]\s/.test(t)) s -= 4;                                      // desenho de árvore de pastas
    if (/^(#{1,6}\s|\d+[.)]\s+[A-ZÁÉÍÓÚa-z])/.test(t) && !/[;{}=]/.test(t)) s -= 3; // títulos e listas numeradas
    return s;
  }
  function sniff(code) {
    const t = code.trim();
    if (/^<!doctype html|^<html[\s>]/i.test(t)) return 'html';
    if (/^@echo|^REM\s|\r?\n(set |goto |pause\b)/im.test(t)) return 'bat';
    if (/^(\{|\[)[\s\S]*(\}|\])$/.test(t)) { try { JSON.parse(t); return 'json'; } catch {} }
    if (/^<(style|script|div|section|header|main|nav|body|head|link|meta|button|form|template)\b/i.test(t)) return 'html';
    if (/^(name:|on:|jobs:)/m.test(t) && /^\s+(runs-on|steps):/m.test(t)) return 'yml';
    const lines = t.split('\n');
    const cmdish = lines.filter((l) => /^\s*(npm|npx|pnpm|git|cd|mkdir|pip|python|node|curl|pkg|chmod|rm|cp|mv)\s/.test(l)).length;
    if (cmdish >= Math.max(1, lines.length * 0.6)) return 'sh';
    const cssish = (t.match(/^[^{}\n;]+\{[^}]*\}/gm) || []).length + (t.match(/^\s*[a-z-]+\s*:\s*[^;]+;\s*$/gm) || []).length;
    const jsish = (t.match(/\b(const|let|var|function|=>|return|document\.|addEventListener|async|await)\b/g) || []).length;
    if (cssish > jsish * 2 && !/\bfunction\b|=>/.test(t)) return 'css';
    if (/^\s*(import|export)\s.+from\s/m.test(t) && /<[A-Z]\w*[\s/>]/.test(t)) return 'tsx';
    if (/:\s*(string|number|boolean|any)\b|interface\s+\w+\s*\{/.test(t)) return 'ts';
    if (/^\s*(def |class |import |from \w+ import)/m.test(t) && !/[;{]\s*$/m.test(t)) return 'py';
    return 'js';
  }
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

  function parse(text) {
    text = String(text || '').replace(/\r\n?/g, '\n');
    const L = text.split('\n');
    const raw = []; let cur = null, gap = 0, inDoc = false, speaker = '', date = '';
    const startBlock = (i, doc) => { cur = { a: i, lines: [], doc: !!doc, speaker, date }; };
    for (let i = 0; i < L.length; i++) {
      const l = L[i], t = l.trim();
      if (!inDoc) { if (SPEAKER.test(t)) speaker = t; else if (DATE.test(t)) date = t; }
      const docStart = /^<!doctype html/i.test(t) || (!cur && /^<html[\s>]/i.test(t));
      if (docStart && !inDoc) { if (cur && cur.lines.length) raw.push(cur); startBlock(i, true); inDoc = true; }
      if (inDoc) { cur.lines.push(l); if (/<\/html>\s*$/i.test(t)) { raw.push(cur); cur = null; inDoc = false; } continue; }
      const sc = codeScore(l);
      if (sc >= 2 || (cur && (t === '' || sc >= 0) && gap < 3)) {
        if (!cur) { if (sc < 2) continue; startBlock(i); }
        cur.lines.push(l); gap = t === '' ? gap + 1 : (sc >= 1 ? 0 : gap + 1);
      } else if (cur) { raw.push(cur); cur = null; gap = 0; }
    }
    if (cur) raw.push(cur);
    const items = [];
    for (const b of raw) {
      while (b.lines.length && !b.lines[b.lines.length - 1].trim()) b.lines.pop();
      while (b.lines.length && !b.lines[0].trim()) { b.lines.shift(); b.a++; }
      if (b.lines.length < 3) continue;
      const code = b.lines.join('\n');
      // título dado pela IA logo antes do bloco (ignora "Copiar")
      let label = '';
      for (let k = b.a - 1, seen = 0; k >= 0 && seen < 6; k--) { const t = L[k].trim(); if (!t || COPY.test(t) || /^(\/\/|\/\*|\*|<!--)/.test(t)) continue; seen++; if (codeScore(L[k]) < 1 && t.length < 160) { label = t; break; } }
      const lang = b.doc ? 'html' : sniff(code);
      const title = b.doc ? ((/<title>([^<]*)<\/title>/i.exec(code) || [])[1] || '').trim() : '';
      const fileInLabel = (/\(([\w./-]+\.[a-z0-9]{1,6})\)/i.exec(label) || /\b([\w-]+(?:\/[\w.-]+)*\.(?:html?|css|m?js|jsx|tsx?|json|bat|sh|yml|ya?ml|py|md))\b/i.exec(label) || [])[1];
      const headComment = (/^\s*(?:\/\/|\/\*|<!--|#|REM)\s*[═=─\-*\s]*\n?\s*(?:\/\/|\/\*|<!--|#|REM)?\s*([^\n═=─*]{4,80})/i.exec(code) || [])[1];
      const fileInCode = (/^\s*(?:\/\/|\/\*|<!--|#)\s*(?:arquivo|file|filepath)\s*:\s*([^\s*>]+)/im.exec(code) || [])[1];
      const ext = { html: 'html', css: 'css', js: 'js', ts: 'ts', tsx: 'tsx', json: 'json', bat: 'bat', sh: 'sh', yml: 'yml', py: 'py' }[lang] || 'txt';
      let path = fileInCode || fileInLabel;
      if (!path) {
        const base = slug(title) || slug(String(label).replace(/^PARTE\s*\d+\s*:?\s*/i, '').replace(/\(.*?\)/g, '')) || slug(headComment) || 'trecho';
        path = base + '.' + ext;
      }
      path = path.replace(/^\.?\//, '');
      items.push({ a: b.a, b: b.a + b.lines.length, lines: b.lines.length, code, lang, doc: b.doc, title, label, path, speaker: b.speaker, date: b.date, size: code.length });
    }
    // Cada "PARTE 1…" começa uma nova MONTAGEM (uma tentativa da IA de montar o projeto em partes).
    let m = 0, inSeq = false;
    items.forEach((it) => {
      const parte = /^PARTE\s*(\d+)/i.exec(it.label || '');
      if (parte && +parte[1] === 1) { m++; inSeq = true; }
      else if (!parte && it.doc) inSeq = false;
      it.folder = parte && inSeq ? 'montagem-' + m : it.doc ? 'paginas' : 'trechos';
    });
    // numa montagem com uma página só e sem index.html, a página vira index.html (para abrir pelo index)
    const byFolder = new Map(); items.forEach((it) => { if (!byFolder.has(it.folder)) byFolder.set(it.folder, []); byFolder.get(it.folder).push(it); });
    byFolder.forEach((list, f) => {
      if (!/^montagem-/.test(f)) return;
      const htmls = list.filter((it) => it.doc && /\.html$/.test(it.path));
      if (htmls.length === 1 && !list.some((it) => /(^|\/)index\.html$/.test(it.path))) htmls[0].path = 'index.html';
    });
    // versões: o mesmo arquivo na mesma pasta (ou a mesma página pelo título) = v1, v2…
    const groups = new Map();
    items.forEach((it) => { const key = it.folder + '|' + (it.folder === 'paginas' && it.title ? 'title:' + it.title.toLowerCase() : it.path.toLowerCase()); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(it); });
    groups.forEach((list) => {
      const latestPath = list[list.length - 1].path;
      list.forEach((it, k) => {
        it.version = k + 1; it.versions = list.length; it.latest = k === list.length - 1;
        it.outPath = it.folder + '/' + (list.length > 1 && !it.latest ? latestPath.replace(/(\.[a-z0-9]+)$/i, '.v' + (k + 1) + '$1') : latestPath);
      });
    });
    // nomes repetidos que sobraram: -2, -3…
    const seen = new Map();
    items.forEach((it) => { const n = (seen.get(it.outPath) || 0) + 1; seen.set(it.outPath, n); if (n > 1) it.outPath = it.outPath.replace(/(\.[a-z0-9]+)$/i, '-' + n + '$1'); });
    return { items, lines: L.length, speakers: [...new Set(items.map((i) => i.speaker).filter(Boolean))] };
  }
  function indexMD(r, origem) {
    const L = ['# Códigos recuperados da conversa' + (origem ? ' "' + origem + '"' : ''), '', r.items.length + ' blocos de código · ' + r.items.filter((i) => i.doc).length + ' páginas HTML inteiras', '', '| # | Arquivo | Tipo | Linhas | Versão | Quem escreveu | Onde estava (linha) | Título dado pela IA |', '|---|---|---|---|---|---|---|---|'];
    r.items.forEach((it, k) => L.push('| ' + (k + 1) + ' | ' + it.outPath + ' | ' + it.lang + ' | ' + it.lines + ' | ' + (it.versions > 1 ? 'v' + it.version + '/' + it.versions + (it.latest ? ' (mais recente)' : '') : '—') + ' | ' + (it.speaker || '?') + (it.date ? ' · ' + it.date : '') + ' | ' + (it.a + 1) + ' | ' + String(it.label || it.title || '').replace(/\|/g, '/').slice(0, 80) + ' |'));
    return L.join('\n') + '\n';
  }
  function toTXT(r, list, dir) {
    return (list || r.items).map((it) => '===== ARQUIVO: ' + (dir ? dir + '/' : '') + it.outPath + ' =====\n' + it.code + '\n===== FIM: ' + it.outPath + ' =====\n').join('\n');
  }
  SK.conversa = { parse, indexMD, toTXT, sniff };
})(window.SK);
