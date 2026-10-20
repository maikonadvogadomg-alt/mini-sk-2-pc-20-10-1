/* =========================================================================
   plano-core.js — 📋 Gerador de PLANO do projeto (sem IA, sem internet)
   Usado pelo Mini SK (🏗️ Preparar) e pelo Caça-Bug (Diagnóstico).
   Ideia do gerador de plano do DevMobile, mas completo:
   - telas/páginas (React Router, wouter, Expo Router, Next, páginas .html)
   - rotas do BACKEND (Express, Hono, Fastify, router.*)
   - chamadas que o APP faz (fetch, axios, apiRequest, useQuery)
   - CRUZAMENTO: o que o app pede e o backend não tem (é o que falta recriar)
   - tabelas do banco (Drizzle, Prisma, Mongoose, Supabase)
   - variáveis de ambiente usadas (só o NOME, nunca o valor)
   - serviços de fora (domínios), IA usada, comandos do package.json
   - roteiro para recriar fora da Replit
   PlanoProjeto.gerar(arquivos, nome) → { md, dados }
     arquivos = [{ path, text }]   (text null/undefined = binário)
   ========================================================================= */
(function (g) {
  'use strict';
  const PULAR = /(^|\/)(node_modules|\.git|\.sk|dist|build|\.next|\.expo|android|ios|\.cache|\.local|coverage)\//;
  const CODIGO = /\.(m?[jt]sx?|cjs|cts|mts|vue|svelte|py)$/i;
  const LING = { ts: 'TypeScript', tsx: 'TypeScript (React)', js: 'JavaScript', jsx: 'JavaScript (React)', mjs: 'JavaScript', cjs: 'JavaScript', html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'CSS', json: 'JSON', md: 'Markdown', py: 'Python', sql: 'SQL', sh: 'Shell', bat: 'Batch (Windows)', yml: 'YAML', yaml: 'YAML', svg: 'Imagem SVG', png: 'Imagem', jpg: 'Imagem', jpeg: 'Imagem', webp: 'Imagem', ico: 'Ícone' };
  const ext = (p) => { const b = p.split('/').pop(); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i + 1).toLowerCase() : ''; };
  const uniq = (a) => [...new Set(a)];
  // /api/users/${id} , /api/users/:id , /api/users/[id]  →  /api/users/:p
  const normRota = (r) => String(r).split('?')[0].replace(/\$\{[^}]*\}/g, ':p').replace(/\[[^\]]+\]/g, ':p').replace(/:[A-Za-z_]\w*\??/g, ':p').replace(/\/+$/, '') || '/';

  function arvore(paths) {
    const raiz = {};
    for (const p of paths) { let n = raiz; for (const parte of p.split('/')) n = n[parte] = n[parte] || {}; }
    const linhas = [];
    const andar = (n, pre, nivel) => {
      const nomes = Object.keys(n).sort((a, b) => (Object.keys(n[b]).length > 0) - (Object.keys(n[a]).length > 0) || a.localeCompare(b));
      nomes.forEach((nome, i) => {
        const ult = i === nomes.length - 1, pasta = Object.keys(n[nome]).length > 0;
        if (nivel > 5 && pasta) { linhas.push(pre + (ult ? '└─ ' : '├─ ') + '📁 ' + nome + '/ …'); return; }
        linhas.push(pre + (ult ? '└─ ' : '├─ ') + (pasta ? '📁 ' + nome + '/' : nome));
        if (pasta) andar(n[nome], pre + (ult ? '   ' : '│  '), nivel + 1);
      });
    };
    andar(raiz, '', 0);
    return linhas.length > 400 ? linhas.slice(0, 400).concat(['… (' + (linhas.length - 400) + ' linhas a mais)']) : linhas;
  }

  function gerar(arquivos, nome) {
    const todos = arquivos.filter((a) => !PULAR.test(a.path));
    const txt = todos.filter((a) => a.text != null && a.text.length < 3e6);
    const cod = txt.filter((a) => CODIGO.test(a.path));
    const d = { nome: nome || 'Projeto', arquivos: todos.length, linhas: 0, linguagens: {}, entradas: [], apps: [], telas: [], rotas: [], chamadas: [], faltam: [], semUso: [], tabelas: [], env: [], dominios: [], ia: [], scripts: [], deps: [], replit: [], sugestoes: [] };

    for (const a of txt) d.linhas += a.text.split('\n').length;
    for (const a of todos) { const l = LING[ext(a.path)] || 'Outros'; d.linguagens[l] = (d.linguagens[l] || 0) + 1; }

    // apps dentro (monorepo da Replit) e package.json
    const pkgs = txt.filter((a) => /(^|\/)package\.json$/.test(a.path)).map((a) => { try { return { path: a.path, j: JSON.parse(a.text) }; } catch { return { path: a.path, j: {} }; } });
    for (const p of pkgs) {
      const dir = p.path.replace(/\/?package\.json$/, '') || '.';
      if (dir !== '.') d.apps.push(dir + (p.j.name ? ' (' + p.j.name + ')' : ''));
      for (const [k, v] of Object.entries(p.j.scripts || {})) d.scripts.push({ onde: dir, nome: k, cmd: v });
      for (const k of Object.keys(Object.assign({}, p.j.dependencies))) d.deps.push(k);
    }
    d.deps = uniq(d.deps).sort();

    // pontos de entrada
    const ENTRADA = /(^|\/)(index\.html|main\.(t|j)sx?|index\.(t|j)sx?|app\.(t|j)sx?|server\.(t|j)s|App\.(t|j)sx)$/;
    d.entradas = todos.map((a) => a.path).filter((p) => ENTRADA.test(p) && p.split('/').length <= 4).slice(0, 30);

    for (const a of cod) {
      const t = a.text, f = a.path;
      let m;
      // ── telas (frontend)
      const reTela = [/<Route\b[^>]*\bpath\s*=\s*\{?\s*["'`]([^"'`]+)["'`]/g, /\{\s*path\s*:\s*["'`](\/[^"'`]*)["'`]\s*,\s*(?:element|component|Component|lazy|loader)/g];
      for (const re of reTela) while ((m = re.exec(t))) d.telas.push({ rota: m[1], arquivo: f });
      // ── rotas do backend
      const reBack = /\b(app|router|server|api|fastify|route|routes|hono|r)\s*\.\s*(get|post|put|patch|delete|all|use)\s*\(\s*["'`](\/[^"'`]*)["'`]/gi;
      while ((m = reBack.exec(t))) { if (m[2].toLowerCase() === 'use' && !/\/api/.test(m[3])) continue; d.rotas.push({ metodo: m[2].toUpperCase() === 'USE' ? 'USE' : m[2].toUpperCase(), rota: m[3], arquivo: f }); }
      // ── chamadas do app
      const reCham = [
        [/\bfetch\s*\(\s*[`"']((?:\$\{[^}]+\})?\/[^`"']*)[`"']\s*(?:,\s*\{[^}]*?method\s*:\s*["'`](\w+))?/g, 1, 2],
        [/\baxios\s*\.\s*(get|post|put|patch|delete)\s*\(\s*[`"']((?:\$\{[^}]+\})?\/[^`"']*)[`"']/g, 2, 1],
        [/\bapiRequest\s*\(\s*["'`](\w+)["'`]\s*,\s*[`"']([^`"']+)[`"']/g, 2, 1],
        [/queryKey\s*:\s*\[\s*[`"'](\/api[^`"']*)[`"']/g, 1, 0],
      ];
      for (const [re, iR, iM] of reCham) while ((m = re.exec(t))) { const rota = m[iR].replace(/^\$\{[^}]+\}/, ''); if (rota.startsWith('/')) d.chamadas.push({ metodo: (iM && m[iM] ? m[iM] : 'GET').toUpperCase(), rota, arquivo: f }); }
      // ── banco
      const reTab = [/\b(?:pgTable|sqliteTable|mysqlTable)\s*\(\s*["'`]([\w-]+)["'`]/g, /\bmongoose\.model\s*\(\s*["'`](\w+)["'`]/g, /\.from\s*\(\s*["'`]([\w-]+)["'`]\s*\)\s*\.(?:select|insert|update|delete|upsert)/g];
      for (const re of reTab) while ((m = re.exec(t))) d.tabelas.push({ tabela: m[1], arquivo: f });
      // ── variáveis de ambiente (só o nome)
      const reEnv = /\b(?:process\.env|import\.meta\.env)\s*(?:\.\s*([A-Z_][A-Z0-9_]*)|\[\s*["'`]([A-Z_][A-Z0-9_]*)["'`]\s*\])/g;
      while ((m = reEnv.exec(t))) d.env.push(m[1] || m[2]);
      // ── domínios de fora
      const reDom = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?::\d+)?/gi;
      while ((m = reDom.exec(t))) { const h = m[1].toLowerCase(); if (!/^(www\.w3\.org|localhost|127\.0\.0\.1|example\.com|schemas?\.|reactjs\.org|github\.com\/[^/]+$)/.test(h)) d.dominios.push(h); }
      if (/replit|REPL_ID|REPLIT_/i.test(t)) d.replit.push(f);
    }
    for (const a of txt.filter((x) => /prisma$/.test(x.path))) { let m; const re = /^model\s+(\w+)/gm; while ((m = re.exec(a.text))) d.tabelas.push({ tabela: m[1], arquivo: a.path }); }
    // telas do Expo Router / Next (pelas pastas)
    for (const a of todos) {
      let m;
      if ((m = a.path.match(/(?:^|\/)app\/(.+)\.(t|j)sx$/)) && !/(^|\/)(api|components|lib|utils|hooks)\//.test(m[1]) && !/_layout$|\+html$|\+not-found$/.test(m[1])) d.telas.push({ rota: '/' + m[1].replace(/\(.*?\)\/?/g, '').replace(/(^|\/)index$/, '').replace(/\/$/, ''), arquivo: a.path });
      else if ((m = a.path.match(/(?:^|\/)pages\/(.+)\.(t|j)sx$/)) && !/^_|^api\//.test(m[1])) d.telas.push({ rota: '/' + m[1].replace(/(^|\/)index$/, ''), arquivo: a.path });
      else if (/\.html?$/i.test(a.path) && !/(^|\/)404\.html$/.test(a.path)) d.telas.push({ rota: a.path, arquivo: a.path });
    }
    // IA usada
    const IA = { openai: 'OpenAI (ChatGPT)', '@anthropic-ai/sdk': 'Anthropic (Claude)', '@google/genai': 'Google Gemini', '@google/generative-ai': 'Google Gemini', groq: 'Groq', 'groq-sdk': 'Groq', ollama: 'Ollama' };
    d.ia = uniq(d.deps.filter((k) => IA[k]).map((k) => IA[k]).concat(uniq(d.dominios).filter((h) => /generativelanguage|openai\.com|anthropic\.com|groq\.com|openrouter/.test(h)).map((h) => h)));

    // limpeza
    const chave = (x) => x.metodo + ' ' + x.rota + ' ' + x.arquivo;
    const dedup = (arr, k) => { const s = new Set(); return arr.filter((x) => { const c = k(x); if (s.has(c)) return false; s.add(c); return true; }); };
    d.telas = dedup(d.telas, (x) => x.rota + x.arquivo);
    d.rotas = dedup(d.rotas, chave);
    d.chamadas = dedup(d.chamadas, (x) => x.metodo + ' ' + normRota(x.rota));
    d.tabelas = dedup(d.tabelas, (x) => x.tabela);
    d.env = uniq(d.env).sort();
    d.dominios = uniq(d.dominios).sort();

    // cruzamento: o que o app pede × o que o backend tem
    const temRota = (c) => { const n = normRota(c.rota); return d.rotas.some((r) => (r.metodo === c.metodo || r.metodo === 'ALL' || r.metodo === 'USE' || c.metodo === 'GET' && r.metodo === 'GET') && (normRota(r.rota) === n || n.endsWith(normRota(r.rota)) && normRota(r.rota).length > 4 || (r.metodo === 'USE' && n.startsWith(normRota(r.rota) + '/')))); };
    d.faltam = d.chamadas.filter((c) => /^\/(api|auth)\b/.test(c.rota) && !/\$\{/.test(c.rota.replace(/^\/(api|auth)/, '').slice(0, 3)) && !temRota(c)).map((c) => Object.assign({}, c, { rota: c.rota.split('?')[0] }));
    d.semUso = d.rotas.filter((r) => r.metodo !== 'USE' && !d.chamadas.some((c) => normRota(c.rota) === normRota(r.rota) || normRota(c.rota).endsWith(normRota(r.rota))));

    // sugestões
    const tem = (re) => todos.some((a) => re.test(a.path));
    if (d.replit.length) d.sugestoes.push('🧹 Tirar a Replit de ' + d.replit.length + ' arquivo(s) (🏗️ Preparar → Fazer tudo)');
    if (d.faltam.length) d.sugestoes.push('🔌 O app chama ' + d.faltam.length + ' endereço(s) que o backend deste projeto NÃO tem — veja "O que falta no backend"');
    if (d.rotas.length && !d.faltam.length) d.sugestoes.push('🖥️ O projeto tem backend próprio: para funcionar fora da Replit ele precisa ficar ligado num servidor (Render, Railway, Vercel) ou virar funções');
    if (d.env.length) d.sugestoes.push('🔐 Criar um .env.example com: ' + d.env.slice(0, 12).join(', ') + (d.env.length > 12 ? '…' : '') + ' (os valores você coloca no servidor, nunca no código)');
    if (d.tabelas.length) d.sugestoes.push('🗄️ Precisa de banco de dados (' + d.tabelas.length + ' tabela(s)) — Neon ou Supabase servem, grátis');
    if (!tem(/(^|\/)readme\.md$/i)) d.sugestoes.push('📝 Criar um README.md explicando como rodar');
    if (!tem(/(^|\/)\.gitignore$/)) d.sugestoes.push('🚫 Criar .gitignore (não mandar node_modules ao GitHub)');
    if (!tem(/(^|\/)index\.html$/)) d.sugestoes.push('🏠 Sem index.html na raiz: não abre como site direto');
    if (!d.sugestoes.length) d.sugestoes.push('✅ Nada urgente');

    d.md = markdown(d, arvore(todos.map((a) => a.path)));
    return d;
  }

  function markdown(d, arv) {
    const L = [];
    const tab = (cab, linhas) => linhas.length ? ['| ' + cab.join(' | ') + ' |', '|' + cab.map(() => '---').join('|') + '|'].concat(linhas.map((l) => '| ' + l.map((x) => String(x).replace(/\|/g, '\\|')).join(' | ') + ' |')).join('\n') : '_Nenhum encontrado._';
    L.push('# 📋 Plano do projeto: ' + d.nome, '', '_Gerado em ' + new Date().toLocaleString('pt-BR') + ' — sem IA, lendo os arquivos._', '');
    L.push('## 📊 Visão geral', tab(['Item', 'Valor'], [['Arquivos', d.arquivos], ['Linhas', d.linhas.toLocaleString('pt-BR')], ['Telas/páginas', d.telas.length], ['Rotas do backend', d.rotas.length], ['Chamadas do app', d.chamadas.length], ['Tabelas do banco', d.tabelas.length], ['Variáveis de ambiente', d.env.length]]), '');
    L.push('**Linguagens:** ' + Object.entries(d.linguagens).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' (' + v + ')').join(', '), '');
    if (d.apps.length) L.push('## 🧩 Apps dentro deste projeto', d.apps.map((a) => '- ' + a).join('\n'), '');
    L.push('## 💡 O que fazer (em ordem)', d.sugestoes.map((s, i) => (i + 1) + '. ' + s).join('\n'), '');
    L.push('## 🚀 Por onde começa', d.entradas.length ? d.entradas.map((e) => '- `' + e + '`').join('\n') : '_Nenhum ponto de entrada claro._', '');
    if (d.scripts.length) L.push('## ⌨️ Comandos (package.json)', tab(['Pasta', 'Comando', 'O que roda'], d.scripts.map((s) => [s.onde, '`npm run ' + s.nome + '`', '`' + String(s.cmd).slice(0, 90) + '`'])), '');
    L.push('## 📱 Telas e páginas', tab(['Endereço', 'Arquivo'], d.telas.slice(0, 200).map((t) => ['`' + t.rota + '`', t.arquivo])), '');
    L.push('## 🖥️ Rotas do backend', tab(['Método', 'Rota', 'Arquivo'], d.rotas.slice(0, 300).map((r) => [r.metodo, '`' + r.rota + '`', r.arquivo])), '');
    L.push('## 📡 O que o app pede ao servidor', tab(['Método', 'Endereço', 'Onde'], d.chamadas.slice(0, 300).map((c) => [c.metodo, '`' + c.rota + '`', c.arquivo])), '');
    L.push('## 🔌 O que falta no backend', d.faltam.length ? 'O app chama estes endereços, mas **nenhuma rota deste projeto responde**. Ou o backend ficou na Replit, ou está em outro projeto. Para recriar, cada linha vira uma rota:\n\n' + tab(['Método', 'Endereço', 'Quem chama'], d.faltam.map((c) => [c.metodo, '`' + c.rota + '`', c.arquivo])) : '✅ Tudo que o app chama tem rota no projeto (ou o app não usa servidor).', '');
    if (d.semUso.length) L.push('## 💤 Rotas que o app não usa', d.semUso.slice(0, 60).map((r) => '- ' + r.metodo + ' `' + r.rota + '` — ' + r.arquivo).join('\n'), '');
    L.push('## 🗄️ Banco de dados', d.tabelas.length ? d.tabelas.map((t) => '- **' + t.tabela + '** — ' + t.arquivo).join('\n') : '_Nenhuma tabela encontrada._', '');
    L.push('## 🔐 Variáveis de ambiente (configurar no servidor)', d.env.length ? d.env.map((e) => '- `' + e + '`').join('\n') + '\n\n_Só os nomes. Os valores (chaves, senhas) nunca vão no código nem no GitHub._' : '_Nenhuma._', '');
    if (d.ia.length) L.push('## 🤖 IA usada', d.ia.map((x) => '- ' + x).join('\n'), '');
    if (d.dominios.length) L.push('## 🌐 Serviços de fora que ele acessa', d.dominios.slice(0, 80).map((x) => '- ' + x).join('\n'), '');
    if (d.deps.length) L.push('## 📦 Peças principais (dependências)', d.deps.slice(0, 120).map((x) => '`' + x + '`').join(' · '), '');
    if (d.replit.length) L.push('## 🧹 Arquivos com coisa da Replit', d.replit.map((x) => '- ' + x).join('\n'), '');
    L.push('## 🔁 Roteiro para recriar fora da Replit',
      ['Importar o projeto no Mini SK e tocar em 🏗️ Preparar → ✅ Fazer tudo (tira a Replit, cria os arquivos que faltam).',
        d.rotas.length || d.faltam.length ? 'Backend: escolher onde ele vai ficar ligado (Render/Railway grátis) — ou pedir à IA para transformar as rotas em funções do Netlify/Vercel, usando a tabela "O que falta no backend".' : 'Não tem backend: o site sozinho basta (Netlify ou GitHub Pages).',
        d.tabelas.length ? 'Banco: criar no Neon ou Supabase e colocar o endereço na variável de ambiente do servidor.' : null,
        d.env.length ? 'Variáveis: cadastrar ' + d.env.length + ' variável(is) no servidor (lista acima).' : null,
        'Testar a prévia; se der erro, 🤖 Mandar os erros para a IA.',
        'App: 📲 Instalável (PWA), 📦 APK ou 🖥️ Desktop (.exe) pelo 🏗️ Preparar.'].filter(Boolean).map((s, i) => (i + 1) + '. ' + s).join('\n'), '');
    L.push('## 🌳 Árvore de arquivos', '```', arv.join('\n'), '```', '');
    return L.join('\n');
  }

  g.PlanoProjeto = { gerar, normRota };
})(typeof window !== 'undefined' ? window : globalThis);
