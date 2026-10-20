/* =========================================================================
   Mini SK — 30-highlight.js
   Cores do código (realce de sintaxe) para HTML, CSS, JavaScript/TypeScript,
   JSON, Python, Markdown, SQL, YAML/.env e Shell. Sem biblioteca externa.
   ========================================================================= */
(function (SK) {
  'use strict';
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const span = (cls, text) => '<span class="t-' + cls + '">' + esc(text) + '</span>';

  const JS_KW = 'await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|get|if|import|in|instanceof|interface|let|new|of|return|set|static|super|switch|this|throw|try|type|typeof|var|void|while|with|yield|async|enum|implements|private|protected|public|readonly|as|declare|namespace|abstract';
  const PY_KW = 'and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|self|print';
  const SQL_KW = 'select|from|where|insert|into|values|update|set|delete|create|table|drop|alter|add|primary|key|foreign|references|not|null|default|unique|index|join|left|right|inner|outer|on|group|by|order|having|limit|offset|and|or|as|distinct|count|sum|avg|min|max|serial|integer|int|varchar|text|boolean|timestamp|date|decimal|returning|if|exists|cascade|union|all|case|when|then|else|end|like|in|is|true|false';

  const RULES = {
    js: [
      ['com', /\/\/[^\n]*/y], ['com', /\/\*[\s\S]*?(?:\*\/|$)/y],
      ['str', /`(?:\\[\s\S]|[^\\`])*`?/y], ['str', /"(?:\\.|[^\\"\n])*"?/y], ['str', /'(?:\\.|[^\\'\n])*'?/y],
      ['num', /\b(?:0x[\da-f]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?n?)\b/iy],
      ['kw', new RegExp('\\b(?:' + JS_KW + ')\\b', 'y')], ['lit', /\b(?:true|false|null|undefined|NaN|Infinity)\b/y],
      ['fn', /[A-Za-z_$][\w$]*(?=\s*\()/y], ['tag', /<\/?[A-Z][\w.]*/y], ['id', /[A-Za-z_$][\w$]*/y],
    ],
    css: [
      ['com', /\/\*[\s\S]*?(?:\*\/|$)/y], ['str', /"(?:\\.|[^\\"\n])*"?|'(?:\\.|[^\\'\n])*'?/y],
      ['kw', /@[\w-]+/y], ['num', /#[\da-f]{3,8}\b/iy], ['num', /-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg|fr|ch|vmin|vmax)?\b/y],
      ['attr', /[\w-]+(?=\s*:(?!:))/y], ['fn', /[\w-]+(?=\()/y], ['tag', /[.#]?[\w-]+/y],
    ],
    json: [
      ['attr', /"(?:\\.|[^\\"\n])*"(?=\s*:)/y], ['str', /"(?:\\.|[^\\"\n])*"?/y],
      ['num', /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/iy], ['lit', /\b(?:true|false|null)\b/y], ['com', /\/\/[^\n]*/y],
    ],
    py: [
      ['com', /#[^\n]*/y], ['str', /(?:[rbfu]{0,2})(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^\\"\n])*"?|'(?:\\.|[^\\'\n])*'?)/iy],
      ['kw', /@[\w.]+/y], ['num', /\b\d[\d_]*(?:\.\d+)?\b/y], ['kw', new RegExp('\\b(?:' + PY_KW + ')\\b', 'y')],
      ['lit', /\b(?:True|False|None)\b/y], ['fn', /[A-Za-z_]\w*(?=\s*\()/y], ['id', /[A-Za-z_]\w*/y],
    ],
    sql: [
      ['com', /--[^\n]*/y], ['com', /\/\*[\s\S]*?(?:\*\/|$)/y], ['str', /'(?:''|[^'])*'?/y],
      ['num', /\b\d+(?:\.\d+)?\b/y], ['kw', new RegExp('\\b(?:' + SQL_KW + ')\\b', 'iy')], ['id', /[A-Za-z_]\w*/y],
    ],
    yaml: [
      ['com', /#[^\n]*/y], ['attr', /^[ \t-]*[\w.\-"']+(?=\s*[:=])/my], ['str', /"(?:\\.|[^\\"\n])*"?|'(?:''|[^'\n])*'?/y],
      ['num', /\b\d+(?:\.\d+)?\b/y], ['lit', /\b(?:true|false|null|yes|no|on|off)\b/iy],
    ],
    sh: [
      ['com', /(?:^|(?<=\s))(?:#|rem\b|::)[^\n]*/imy], ['str', /"(?:\\.|[^\\"])*"?|'[^']*'?/y], ['kw', /\$\{?[\w@#?*]+\}?|%[\w]+%/y],
      ['fn', /\b(?:npm|npx|node|git|cd|ls|mkdir|echo|cp|mv|rm|python3?|pip3?|curl|set|export|if|then|fi|for|do|done|copy|del|type)\b/y], ['num', /\b\d+\b/y],
    ],
    md: [
      ['kw', /^#{1,6} [^\n]*/my], ['str', /```[\s\S]*?(?:```|$)/y], ['str', /`[^`\n]+`/y], ['lit', /\*\*[^*\n]+\*\*|__[^_\n]+__/y],
      ['fn', /\[[^\]\n]*\]\([^)\n]*\)/y], ['com', /^>[^\n]*/my], ['attr', /^\s*(?:[-*+]|\d+\.)\s/my],
    ],
  };

  function lex(code, lang) {
    const rules = RULES[lang];
    if (!rules) return esc(code);
    let out = '', plain = '', i = 0;
    const n = code.length;
    while (i < n) {
      let matched = false;
      for (const [cls, re] of rules) {
        re.lastIndex = i;
        const m = re.exec(code);
        if (m && m.index === i && m[0].length) {
          if (plain) { out += esc(plain); plain = ''; }
          out += cls === 'id' ? esc(m[0]) : span(cls, m[0]);
          i += m[0].length; matched = true; break;
        }
      }
      if (!matched) {
        // avança até o próximo caractere "interessante" para ficar rápido
        const c = code[i];
        plain += c; i++;
        if (/\s/.test(c)) while (i < n && /[ \t]/.test(code[i])) plain += code[i++];
      }
    }
    return out + esc(plain);
  }

  function html(code) {
    let out = '', i = 0;
    const n = code.length;
    const re = /<!--[\s\S]*?(?:-->|$)|<!doctype[^>]*>|<\/?[a-zA-Z][\w:-]*|>/giy;
    let plain = '';
    while (i < n) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (!m || m.index !== i) { plain += code[i++]; continue; }
      if (plain) { out += esc(plain); plain = ''; }
      const t = m[0];
      if (t.startsWith('<!--')) { out += span('com', t); i += t.length; continue; }
      if (/^<!doctype/i.test(t)) { out += span('kw', t); i += t.length; continue; }
      if (t === '>') { out += span('tag', t); i += 1; continue; }
      // abriu uma tag: destaca nome e atributos até o ">"
      out += span('tag', t); i += t.length;
      const tagName = t.replace(/^<\/?/, '').toLowerCase();
      const isClose = t.startsWith('</');
      let attrs = '';
      while (i < n && code[i] !== '>') {
        const am = /\s+|[\w:@.\-]+|=|"[^"]*"?|'[^']*'?|\/|[^\s>]/y; am.lastIndex = i;
        const a = am.exec(code); if (!a) break;
        const tok = a[0];
        if (/^["']/.test(tok)) attrs += span('str', tok);
        else if (/^[\w:@.\-]+$/.test(tok)) attrs += span('attr', tok);
        else attrs += esc(tok);
        i += tok.length;
      }
      out += attrs;
      if (i < n && code[i] === '>') { out += span('tag', '>'); i++; }
      if (!isClose && (tagName === 'script' || tagName === 'style')) {
        const end = code.toLowerCase().indexOf('</' + tagName, i);
        const inner = code.slice(i, end < 0 ? n : end);
        out += lex(inner, tagName === 'script' ? 'js' : 'css');
        i += inner.length;
      }
    }
    return out + esc(plain);
  }

  SK.highlight = function (code, lang) {
    if (code.length > 400000) return esc(code); // arquivo enorme: sem cores para não travar
    if (lang === 'html') return html(code);
    return lex(code, lang);
  };
})(window.SK);
