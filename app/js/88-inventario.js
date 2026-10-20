/* =========================================================================
   Mini SK — 88-inventario.js
   📚 Inventário dos seus códigos: joga vários .html/.js (ou .zip com eles)
   e ele diz, de cada um, O QUE FAZ e O QUE USA — para saber o que dá para
   aproveitar, o que está repetido e qual versão é a mais completa.
   - Lê sem IA (direto do código): título, tamanho, linhas, botões e
     títulos da tela, bibliotecas, e recursos (IA, voz, PDF, Word, ZIP,
     OCR, GitHub, Banco Central, DJEN/CNJ, banco online, salvar no aparelho…).
   - Junta as VERSÕES do mesmo código (ex.: juridico-v2, juridico 3 (1))
     e marca a mais completa.
   - Avisa chave/senha escrita dentro do código e marca da Replit.
   - Manual do inventário (.md) para baixar/copiar e "🤖 Pedir à IA" para
     recomendar o que juntar num app só.
   Os arquivos de fora NÃO entram no projeto: só são lidos.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  let itens = [], box = null, filtro = '';

  // ── O que procurar dentro do código ──────────────────────────────────────────
  const RECURSOS = [
    ['🤖 IA', /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis|api\.groq\.com|openrouter\.ai|api\.perplexity|api\.deepseek|api\.x\.ai|api\.mistral|localhost:11434|\/v1\/chat\/completions/i],
    ['🔊 Fala (TTS)', /speechSynthesis|SpeechSynthesisUtterance|\/api\/tts|edge-tts|text-to-speech/i],
    ['🎤 Ditado', /SpeechRecognition|webkitSpeechRecognition/],
    ['📄 PDF', /jspdf|jsPDF|pdf\.js|pdfjsLib|pdf-lib|html2pdf|window\.print\(/],
    ['📝 Word', /\bdocx\b|mammoth|\.docx|application\/vnd\.openxmlformats-officedocument\.wordprocessingml/],
    ['🗜 ZIP', /JSZip|jszip|CompressionStream|DecompressionStream|\.zip['"`]/],
    ['🔎 OCR', /tesseract/i],
    ['🐙 GitHub', /api\.github\.com/],
    ['🏦 Banco Central', /api\.bcb\.gov\.br|bcdata\.sgs/],
    ['⚖️ DJEN/CNJ/tribunal', /comunicaapi|pje\.jus\.br|datajud|api-publica\.datajud|jus\.br/i],
    ['🧮 Cálculo judicial', /corre[çc][ãa]o monet|juros (de )?mora|tabela.{0,20}tjmg|honor[áa]rios/i],
    ['🌐 Pesquisa na internet', /r\.jina\.ai|tavily|serpapi|duckduckgo|bing\.microsoft|googleapis\.com\/customsearch|brave\.com\/res/i],
    ['☁️ Banco online', /supabase|neon\.tech|firebase|firestore|mongodb|planetscale/i],
    ['💾 Salva no aparelho', /localStorage|indexedDB|IndexedDB/],
    ['📂 Abre arquivos', /type=["']file["']|FileReader|showOpenFilePicker/],
    ['📷 Câmera', /getUserMedia/],
    ['📲 Instalável (PWA)', /serviceWorker|manifest\.json|rel=["']manifest["']/],
    ['🗺 Gráficos', /chart\.js|Chart\(|echarts|d3\.|recharts/i],
  ];
  const LIBS = [['jsPDF', /jspdf/i], ['pdf.js', /pdf\.js|pdfjs/i], ['JSZip', /jszip/i], ['Tesseract', /tesseract/i], ['marked', /marked(\.min)?\.js/i], ['mammoth', /mammoth/i], ['docx', /\/docx[@/]/i], ['Chart.js', /chart(\.umd)?(\.min)?\.js/i], ['React', /react(-dom)?(\.production)?(\.min)?\.js|unpkg\.com\/react/i], ['Vue', /vue(\.global)?(\.prod)?\.js/i], ['Tailwind', /tailwindcss/i], ['Bootstrap', /bootstrap/i], ['highlight.js', /highlight(\.min)?\.js|highlightjs/i], ['Monaco', /monaco-editor/i], ['CodeMirror', /codemirror/i], ['Supabase', /supabase-js|@supabase/i], ['Firebase', /firebase/i], ['Font Awesome', /font-?awesome/i]];
  const CHAVE = /\b(?:sk-(?:ant-|or-)?[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|AQ\.[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xai-[A-Za-z0-9]{20,}|pplx-[A-Za-z0-9]{20,})\b|postgres(?:ql)?:\/\/[^\s'"`:]+:[^\s'"`@]{6,}@(?!host\b)(?!ep-x)/;

  function texto(u8) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch { return new TextDecoder('windows-1252').decode(u8); }
  }
  const limpaTag = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  function familia(nome, titulo) {
    // o título da tela é o melhor sinal de que é o mesmo programa; sem título, usa o nome do arquivo
    const t = (titulo || '').toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\bv?\d+([._]\d+)*\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (t.length >= 4) return t;
    return nome.toLowerCase().replace(/^.*\//, '').replace(/\.(html?|js|mjs|jsx|tsx?)$/, '')
      .replace(/\(\d+\)|\bv?\d+([._]\d+)*\b|[-_ .]*(final|novo|nova|copia|cópia|copy|corrigido|fix|ok|top|bom)\b/gi, '')
      .replace(/[^a-zà-ú]+/g, ' ').trim() || nome;
  }

  function analisar(nome, t, origem) {
    const ehHtml = /\.html?$/i.test(nome) || /<html|<!doctype/i.test(t.slice(0, 500));
    const linhas = t.split('\n').length;
    const titulo = limpaTag((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(t) || [])[1] || '') || ((/^\s*(?:\/\/|\/\*+|\*)\s*(.{5,80})/m.exec(t) || [])[1] || '').trim();
    const recursos = RECURSOS.filter(([, re]) => re.test(t)).map(([n]) => n);
    const libs = LIBS.filter(([, re]) => re.test(t)).map(([n]) => n);
    const botoes = [], titulos = [];
    if (ehHtml) {
      let m; const rb = /<button\b[^>]*>([\s\S]*?)<\/button>/gi;
      while ((m = rb.exec(t)) && botoes.length < 40) { const x = limpaTag(m[1]); if (x && x.length <= 40 && !botoes.includes(x)) botoes.push(x); }
      const rh = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi;
      while ((m = rh.exec(t)) && titulos.length < 12) { const x = limpaTag(m[1]); if (x && x.length <= 70 && !titulos.includes(x)) titulos.push(x); }
    }
    const funcoes = []; { const rf = /(?:function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>))/g; let m; while ((m = rf.exec(t)) && funcoes.length < 400) funcoes.push(m[1] || m[2]); }
    const dominios = [...new Set((t.match(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map((u) => u.replace(/^https?:\/\//i, '').toLowerCase()))].filter((d) => !/w3\.org|schema\.org|googleapis\.com\/css|fonts\.g/.test(d)).slice(0, 25);
    const avisos = [];
    if (CHAVE.test(t)) avisos.push('🔑 Tem chave ou senha ESCRITA no código — troque a chave e tire do arquivo antes de publicar.');
    if (/replit/i.test(t)) avisos.push('🚨 Tem marca da Replit (pode parar fora de lá).');
    if (ehHtml && /<script[^>]+src=["'](?!https?:)[^"']+["']/i.test(t)) avisos.push('📎 Depende de arquivos .js separados (precisa deles junto).');
    return { nome, origem, tam: t.length, linhas, titulo, recursos, libs, botoes, titulos, funcoes: funcoes.length, nomesFuncoes: funcoes.slice(0, 30), dominios, avisos, familia: familia(nome, titulo) };
  }

  async function lerArquivos(lista) {
    const novos = [];
    for (const f of lista) {
      const u8 = new Uint8Array(await f.arrayBuffer());
      if (/\.zip$/i.test(f.name) || (u8[0] === 0x50 && u8[1] === 0x4b)) {
        try { for (const e of await SK.zip.read(u8)) if (/\.(html?|js|mjs|jsx|tsx?)$/i.test(e.name) && !/node_modules\//.test(e.name) && e.data.length) novos.push(analisar(e.name, texto(e.data), f.name)); }
        catch (er) { SK.toast('Não consegui abrir ' + f.name + ': ' + er.message, 'error'); }
      } else if (/\.(html?|js|mjs|jsx|tsx?|txt)$/i.test(f.name)) novos.push(analisar(f.name, texto(u8), 'aparelho'));
    }
    return novos;
  }
  function doProjeto() {
    if (!fs().project) { SK.toast('Abra um projeto primeiro', 'error'); return []; }
    return fs().list().filter((p) => /\.(html?|js|mjs|jsx|tsx?)$/i.test(p) && !p.startsWith('.sk/') && !/node_modules\//.test(p))
      .map((p) => { const t = fs().read(p); return t == null ? null : analisar(p, t, 'projeto ' + fs().project.name); }).filter(Boolean);
  }
  function completude(i) { return i.recursos.length * 3 + Math.min(20, i.botoes.length) + Math.min(30, i.funcoes / 5) + Math.log10(i.tam + 10); }
  function grupos() {
    const g = new Map(); itens.forEach((i) => { const k = i.familia; if (!g.has(k)) g.set(k, []); g.get(k).push(i); });
    g.forEach((l) => { l.sort((a, b) => completude(b) - completude(a)); l.forEach((i, n) => { i.melhor = l.length > 1 && n === 0; i.versoes = l.length; }); });
    return g;
  }
  function oQueFaz(i) {
    const partes = [];
    if (i.titulo) partes.push('"' + i.titulo + '"');
    if (i.titulos.length) partes.push('telas/seções: ' + i.titulos.slice(0, 5).join(' · '));
    if (i.botoes.length) partes.push('botões: ' + i.botoes.slice(0, 10).join(' · '));
    return partes.join(' — ') || '(sem títulos nem botões: provavelmente é só lógica, um módulo .js)';
  }

  // ── Tela ────────────────────────────────────────────────────────────────────
  function render() {
    if (!box) return;
    const g = grupos(), lista = SK.$('#inv-lista', box), resumo = SK.$('#inv-resumo', box);
    const todosRec = [...new Set(itens.flatMap((i) => i.recursos))];
    SK.$('#inv-filtros', box).innerHTML = itens.length ? '<button class="btn tiny' + (!filtro ? ' primary' : '') + '" data-f="">Todos</button>' + todosRec.map((r) => '<button class="btn tiny' + (filtro === r ? ' primary' : '') + '" data-f="' + SK.esc(r) + '">' + SK.esc(r) + ' (' + itens.filter((i) => i.recursos.includes(r)).length + ')</button>').join('') : '';
    const repetidos = [...g.values()].filter((l) => l.length > 1).length;
    resumo.textContent = itens.length ? itens.length + ' código(s) · ' + g.size + ' grupo(s)' + (repetidos ? ' · ' + repetidos + ' com várias versões' : '') + ' · ' + itens.filter((i) => i.avisos.some((a) => a.startsWith('🔑'))).length + ' com chave exposta' : 'Nada analisado ainda.';
    const vis = itens.filter((i) => !filtro || i.recursos.includes(filtro)).sort((a, b) => a.familia.localeCompare(b.familia) || completude(b) - completude(a));
    lista.innerHTML = vis.map((i, n) => '<div class="inv-card' + (i.melhor ? ' melhor' : '') + '">' +
      '<div class="row" style="justify-content:space-between;gap:6px;flex-wrap:wrap"><b style="overflow-wrap:anywhere">' + SK.esc(i.nome) + '</b><span class="muted small">' + SK.bytes(i.tam) + ' · ' + SK.fmt(i.linhas) + ' linhas · ' + i.funcoes + ' funções</span></div>' +
      (i.versoes > 1 ? '<div class="small">' + (i.melhor ? '⭐ <b>Mais completa</b> de ' + i.versoes + ' versões parecidas' : '↳ Outra versão de "' + SK.esc(i.familia) + '" (' + i.versoes + ' no total)') + '</div>' : '') +
      '<div class="small">' + SK.esc(oQueFaz(i)) + '</div>' +
      (i.recursos.length ? '<div class="small"><b>Usa:</b> ' + SK.esc(i.recursos.join(' · ')) + '</div>' : '') +
      (i.libs.length ? '<div class="small muted">Bibliotecas: ' + SK.esc(i.libs.join(', ')) + '</div>' : '') +
      i.avisos.map((a) => '<div class="small" style="color:var(--warn,#d97706)">' + SK.esc(a) + '</div>').join('') +
      '<div class="muted small">Origem: ' + SK.esc(i.origem) + '</div></div>').join('') || '<p class="muted small">Escolha arquivos ou analise o projeto aberto.</p>';
  }
  function manualMD() {
    const g = grupos();
    let m = '# 📚 Inventário dos códigos\nGerado em ' + new Date().toLocaleString('pt-BR') + ' pelo Mini SK — ' + itens.length + ' código(s), ' + g.size + ' grupo(s).\n\n';
    const rec = [...new Set(itens.flatMap((i) => i.recursos))];
    m += '## Quem faz o quê\n' + rec.map((r) => '- **' + r + '**: ' + itens.filter((i) => i.recursos.includes(r)).map((i) => i.nome + (i.melhor ? ' ⭐' : '')).join(', ')).join('\n') + '\n\n';
    m += '## Cada código\n';
    [...g.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([fam, l]) => {
      m += '\n### ' + fam + (l.length > 1 ? ' (' + l.length + ' versões)' : '') + '\n';
      l.forEach((i) => {
        m += '\n**' + i.nome + '**' + (i.melhor ? ' ⭐ mais completa' : '') + ' — ' + SK.bytes(i.tam) + ', ' + i.linhas + ' linhas, ' + i.funcoes + ' funções\n';
        m += '- O que faz: ' + oQueFaz(i) + '\n';
        if (i.recursos.length) m += '- Usa: ' + i.recursos.join(', ') + '\n';
        if (i.libs.length) m += '- Bibliotecas: ' + i.libs.join(', ') + '\n';
        if (i.dominios.length) m += '- Fala com: ' + i.dominios.join(', ') + '\n';
        if (i.nomesFuncoes.length) m += '- Algumas funções: ' + i.nomesFuncoes.slice(0, 15).join(', ') + '\n';
        i.avisos.forEach((a) => { m += '- ' + a + '\n'; });
      });
    });
    return m;
  }
  function pedirIA() {
    if (!itens.length) return SK.toast('Analise algum código primeiro', 'error');
    const curto = itens.map((i) => '- ' + i.nome + (i.melhor ? ' ⭐' : '') + ' | ' + SK.bytes(i.tam) + ' | ' + oQueFaz(i).slice(0, 200) + ' | usa: ' + (i.recursos.join(', ') || '—')).join('\n');
    SK.ui && SK.ui.openSide ? SK.ui.openSide('ai') : SK.$('[data-open="ai"]')?.click();
    setTimeout(() => {
      const inp = SK.$('#ai-in'); if (!inp) return;
      inp.value = 'Este é o inventário dos meus códigos (feito pelo Mini SK, sem abrir cada um). Me diga, em português simples:\n1. Quais fazem a mesma coisa (posso ficar só com um).\n2. Qual versão de cada grupo vale guardar (⭐ é a que parece mais completa).\n3. O que dá para juntar num app só, por assunto (jurídico, código, APK…).\n4. O que eu não devo usar (chave exposta, marca da Replit).\nNão invente o que não está na lista.\n\n' + curto;
      inp.dispatchEvent(new Event('input')); inp.focus();
      SK.toast('🤖 Pedido pronto no painel da IA — confira e toque em Enviar');
    }, 250);
  }

  function build(el) {
    box = el;
    el.innerHTML = '<div class="stack">' +
      '<p class="muted small">Joga vários códigos (.html, .js ou um .zip com eles) e eu digo o que cada um faz, o que usa, quais são versões do mesmo e qual é a mais completa. Os arquivos <b>não</b> entram no projeto, só são lidos.</p>' +
      '<div class="row wrap"><button class="btn primary" id="inv-esc">📂 Escolher códigos</button><input type="file" id="inv-in" multiple accept=".html,.htm,.js,.mjs,.jsx,.ts,.tsx,.zip,.txt" hidden>' +
      '<button class="btn" id="inv-proj">🗂 Analisar o projeto aberto</button><button class="btn small" id="inv-limpar">Limpar</button></div>' +
      '<p class="small" id="inv-resumo"></p><div class="row wrap" id="inv-filtros"></div>' +
      '<div class="row wrap"><button class="btn small" id="inv-md">⤓ Manual do inventário (.md)</button><button class="btn small" id="inv-copiar">📋 Copiar manual</button><button class="btn small" id="inv-ia">🤖 Pedir à IA o que juntar</button></div>' +
      '<div id="inv-lista" class="stack"></div></div>';
    const $ = (s) => SK.$(s, el);
    $('#inv-esc').onclick = () => $('#inv-in').click();
    $('#inv-in').onchange = async (e) => { const fl = [...e.target.files]; e.target.value = ''; if (!fl.length) return; SK.toast('Lendo ' + fl.length + ' arquivo(s)…'); itens = itens.concat(await lerArquivos(fl)); render(); };
    $('#inv-proj').onclick = () => { const n = doProjeto(); if (n.length) { itens = itens.filter((i) => !i.origem.startsWith('projeto ')).concat(n); render(); } };
    $('#inv-limpar').onclick = () => { itens = []; filtro = ''; render(); };
    $('#inv-filtros').onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; filtro = b.dataset.f; render(); };
    $('#inv-md').onclick = () => { if (!itens.length) return SK.toast('Analise algum código primeiro', 'error'); SK.download('inventario-codigos-' + new Date().toISOString().slice(0, 10) + '.md', manualMD(), 'text/markdown;charset=utf-8'); };
    $('#inv-copiar').onclick = () => { if (!itens.length) return SK.toast('Analise algum código primeiro', 'error'); SK.copy(manualMD()); };
    $('#inv-ia').onclick = pedirIA;
    render();
  }

  SK.inventario = { build, analisar, manualMD, get itens() { return itens; } };
})(window.SK);
