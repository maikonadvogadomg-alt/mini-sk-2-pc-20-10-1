/* =========================================================================
   Mini SK — 97-analise.js
   🧬 Raio-X do projeto (feito para projetos da Replit — monorepo):
   - Acha TODOS os package.json (não só o primeiro), entende workspaces do
     pnpm, versões "catalog:" e pacotes internos "workspace:*".
   - Explica cada dependência em português (pra que serve, se é obrigatória
     ou só para montar, se é coisa da Replit).
   - Gera o PLANO completo em Markdown (sem cortar nada): baixar ou copiar.
   - package.json unificado (sugestão), estrutura de pastas em .bat.
   - 📦 Pacote para a IA: junta os arquivos importantes num .txt com
     marcadores "===== ARQUIVO: caminho =====" (em partes, se for grande).
   - ⤵ Montar a partir de texto: cola/importa um .txt/.md com esses
     marcadores (ou blocos ```lang filepath:...```) e os arquivos são criados.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  let box, last = null;

  // ── Dicionário de dependências (português) ──────────────────────────────────
  // [descrição, tipo]  tipos: tela, servidor, banco, ia, build, tipos, teste, estilo, mobile, desktop, replit, util
  const DIC = {
    react: ['Biblioteca que monta as telas do app', 'tela'], 'react-dom': ['Coloca as telas do React no navegador', 'tela'],
    vue: ['Biblioteca para montar telas (alternativa ao React)', 'tela'], svelte: ['Biblioteca para montar telas', 'tela'],
    vite: ['Monta (builda) o app e roda o modo de teste rápido', 'build'], '@vitejs/plugin-react': ['Faz o Vite entender React', 'build'],
    typescript: ['JavaScript com tipos — só para montar, não vai pro app final', 'build'], tsx: ['Roda arquivos TypeScript direto (servidor em modo teste)', 'build'],
    esbuild: ['Empacotador rápido: junta o servidor num arquivo só', 'build'], 'esbuild-plugin-pino': ['Faz o esbuild funcionar com o Pino (log)', 'build'],
    tailwindcss: ['Estilos prontos por classes (cores, espaços, tamanhos)', 'estilo'], '@tailwindcss/vite': ['Liga o Tailwind no Vite', 'estilo'], '@tailwindcss/typography': ['Estilo bonito para textos longos', 'estilo'],
    postcss: ['Processa o CSS (usado pelo Tailwind)', 'estilo'], autoprefixer: ['Ajusta o CSS para navegadores antigos', 'estilo'],
    'tailwind-merge': ['Junta classes do Tailwind sem conflito', 'estilo'], clsx: ['Monta listas de classes CSS', 'estilo'], 'class-variance-authority': ['Variações de botões/estilos (shadcn/ui)', 'estilo'], 'tw-animate-css': ['Animações prontas para Tailwind', 'estilo'], 'tailwindcss-animate': ['Animações prontas para Tailwind', 'estilo'],
    'lucide-react': ['Ícones (desenhos dos botões)', 'tela'], 'react-icons': ['Ícones', 'tela'], 'framer-motion': ['Animações nas telas', 'tela'], motion: ['Animações nas telas', 'tela'],
    wouter: ['Troca de páginas dentro do app (rotas) — leve', 'tela'], 'react-router-dom': ['Troca de páginas dentro do app (rotas)', 'tela'], 'react-router': ['Troca de páginas dentro do app (rotas)', 'tela'],
    '@tanstack/react-query': ['Busca e guarda dados do servidor nas telas', 'tela'], 'react-hook-form': ['Formulários (campos, validação)', 'tela'], '@hookform/resolvers': ['Liga o formulário às regras do Zod', 'tela'],
    zod: ['Confere se os dados estão no formato certo', 'util'], 'drizzle-zod': ['Gera as regras do Zod a partir do banco', 'banco'],
    'date-fns': ['Datas (formatar, somar dias, prazos)', 'util'], dayjs: ['Datas', 'util'], nanoid: ['Gera códigos únicos (ids)', 'util'], uuid: ['Gera códigos únicos (ids)', 'util'],
    sonner: ['Avisos que aparecem no canto da tela', 'tela'], 'cmdk': ['Caixa de comandos/busca rápida', 'tela'], vaul: ['Gaveta que sobe de baixo (celular)', 'tela'], 'embla-carousel-react': ['Carrossel de imagens/cartões', 'tela'], recharts: ['Gráficos', 'tela'], 'input-otp': ['Campo de código (tipo SMS)', 'tela'], 'react-day-picker': ['Calendário para escolher datas', 'tela'], 'react-resizable-panels': ['Painéis que mudam de tamanho', 'tela'], 'next-themes': ['Tema claro/escuro', 'tela'],
    '@monaco-editor/react': ['Editor de código do VS Code dentro do app', 'tela'], 'monaco-editor': ['Editor de código do VS Code', 'tela'], '@codemirror/view': ['Editor de código', 'tela'], codemirror: ['Editor de código', 'tela'],
    'xterm': ['Terminal na tela', 'tela'], '@xterm/xterm': ['Terminal na tela', 'tela'], '@xterm/addon-fit': ['Ajusta o terminal ao tamanho', 'tela'], '@webcontainer/api': ['Roda Node dentro do navegador (terminal sem servidor)', 'tela'],
    'react-markdown': ['Mostra texto Markdown formatado', 'tela'], marked: ['Converte Markdown em HTML', 'util'], 'remark-gfm': ['Tabelas e listas no Markdown', 'tela'], 'highlight.js': ['Cores em código', 'tela'], prismjs: ['Cores em código', 'tela'], dompurify: ['Limpa HTML perigoso', 'util'],
    jszip: ['Cria e lê arquivos .zip', 'util'], 'file-saver': ['Baixar arquivos', 'util'], 'pdfjs-dist': ['Lê PDFs', 'util'], 'pdf-parse': ['Lê texto de PDFs (no servidor)', 'servidor'], jspdf: ['Cria PDFs', 'util'], docx: ['Cria arquivos Word (.docx)', 'util'], mammoth: ['Lê arquivos Word (.docx)', 'util'], 'tesseract.js': ['Lê texto de imagens (OCR)', 'util'], xlsx: ['Planilhas Excel', 'util'], papaparse: ['Lê CSV', 'util'],
    express: ['Servidor (recebe os pedidos das telas: salvar, IA, banco)', 'servidor'], '@types/express': ['Tipos do Express (só para montar)', 'tipos'], cors: ['Deixa a tela falar com o servidor de outro endereço', 'servidor'], 'cookie-parser': ['Lê cookies (login)', 'servidor'], 'express-session': ['Sessão de login', 'servidor'], 'connect-pg-simple': ['Guarda as sessões de login no Postgres', 'servidor'], multer: ['Recebe arquivos enviados (upload)', 'servidor'], 'express-rate-limit': ['Limita pedidos (proteção)', 'servidor'], helmet: ['Proteções de segurança no servidor', 'servidor'], compression: ['Deixa as respostas menores', 'servidor'], ws: ['Conexão em tempo real (WebSocket)', 'servidor'], 'socket.io': ['Conexão em tempo real', 'servidor'], dotenv: ['Lê o arquivo .env (chaves e senhas)', 'servidor'],
    passport: ['Login', 'servidor'], 'passport-local': ['Login com usuário e senha', 'servidor'], bcrypt: ['Embaralha senhas com segurança', 'servidor'], bcryptjs: ['Embaralha senhas com segurança', 'servidor'], jsonwebtoken: ['Token de login (JWT)', 'servidor'], jose: ['Token de login (JWT)', 'servidor'],
    pino: ['Escreve o log do servidor', 'servidor'], 'pino-pretty': ['Deixa o log legível', 'servidor'], 'pino-http': ['Log de cada pedido ao servidor', 'servidor'], morgan: ['Log de cada pedido ao servidor', 'servidor'],
    'drizzle-orm': ['Conversa com o banco de dados (Postgres)', 'banco'], 'drizzle-kit': ['Cria/atualiza as tabelas do banco', 'banco'], pg: ['Conexão com Postgres', 'banco'], postgres: ['Conexão com Postgres', 'banco'], '@neondatabase/serverless': ['Conexão com o banco Neon', 'banco'], '@supabase/supabase-js': ['Supabase (banco, login, arquivos)', 'banco'], 'better-sqlite3': ['Banco SQLite num arquivo', 'banco'], mongoose: ['Banco MongoDB', 'banco'], prisma: ['Conversa com o banco (Prisma)', 'banco'], '@prisma/client': ['Conversa com o banco (Prisma)', 'banco'], idb: ['Banco do navegador (IndexedDB)', 'banco'], dexie: ['Banco do navegador (IndexedDB)', 'banco'], localforage: ['Guarda dados no navegador', 'banco'],
    openai: ['IA da OpenAI (ChatGPT) — também serve p/ Groq, OpenRouter', 'ia'], '@anthropic-ai/sdk': ['IA Claude', 'ia'], '@google/genai': ['IA Gemini', 'ia'], '@google/generative-ai': ['IA Gemini (versão antiga)', 'ia'], 'groq-sdk': ['IA Groq', 'ia'], ai: ['Kit de IA da Vercel', 'ia'], '@ai-sdk/openai': ['Kit de IA: OpenAI', 'ia'], langchain: ['Ferramentas para IA', 'ia'], 'gpt-tokenizer': ['Conta tokens', 'ia'], 'tiktoken': ['Conta tokens', 'ia'],
    '@capacitor/core': ['Transforma o app em APK (Android)', 'mobile'], '@capacitor/cli': ['Comandos do Capacitor (só para montar)', 'mobile'], '@capacitor/android': ['Projeto Android do Capacitor', 'mobile'], expo: ['App de celular com Expo (EAS)', 'mobile'], 'react-native': ['App de celular nativo', 'mobile'], 'eas-cli': ['Envia o build para a EAS', 'mobile'],
    electron: ['Executável de computador (janela própria)', 'desktop'], 'electron-builder': ['Gera o .exe do Electron', 'desktop'], '@electron/packager': ['Empacota o Electron', 'desktop'], pkg: ['Gera um .exe pequeno com Node (abre no navegador)', 'desktop'], '@yao-pkg/pkg': ['Gera um .exe pequeno com Node (continuação do pkg)', 'desktop'],
    'vite-plugin-pwa': ['Gera o service worker e o manifest (PWA) — o "workbox"', 'build'], 'workbox-window': ['Atualização do service worker', 'tela'],
    eslint: ['Procura erros de escrita no código', 'teste'], prettier: ['Arruma a formatação do código', 'teste'], vitest: ['Testes automáticos', 'teste'], jest: ['Testes automáticos', 'teste'], '@playwright/test': ['Testes no navegador', 'teste'],
    concurrently: ['Liga servidor e tela ao mesmo tempo', 'build'], 'cross-env': ['Variáveis de ambiente em qualquer sistema', 'build'], nodemon: ['Reinicia o servidor quando o código muda', 'build'], rimraf: ['Apaga pastas (limpeza)', 'build'],
    axios: ['Faz pedidos à internet/servidor', 'util'], 'node-fetch': ['Faz pedidos à internet (servidor)', 'servidor'], cheerio: ['Lê páginas da internet (raspagem)', 'servidor'], puppeteer: ['Controla um navegador (raspagem/PDF)', 'servidor'], sharp: ['Mexe em imagens (servidor)', 'servidor'], nodemailer: ['Envia e-mails', 'servidor'], stripe: ['Pagamentos', 'servidor'],
  };
  const PAD = [
    [/^@types\//, ['Tipos para o TypeScript — só para montar, pode ignorar', 'tipos']],
    [/^@radix-ui\//, ['Peça de interface pronta (botão, menu, janela) usada pelo shadcn/ui', 'tela']],
    [/^@replit\//, ['COISA DA REPLIT — só funciona lá. Pode tirar', 'replit']],
    [/^@tanstack\//, ['Ferramentas de dados/tabelas para as telas', 'tela']],
    [/^@capacitor\//, ['Plugin do Capacitor (APK)', 'mobile']],
    [/^@expo\/|^expo-/, ['Peça do Expo (APK)', 'mobile']],
    [/^@codemirror\//, ['Peça do editor de código CodeMirror', 'tela']],
    [/^@fontsource\//, ['Fonte (tipo de letra) baixada junto', 'estilo']],
    [/^@workspace\/|^@repo\//, ['Pacote INTERNO deste projeto (outra pasta do monorepo)', 'interno']],
    [/^eslint-|^@eslint\/|^@typescript-eslint\//, ['Regras de verificação de código', 'teste']],
    [/^vite-plugin|^@vitejs\//, ['Plugin do Vite (montagem)', 'build']],
    [/^workbox-/, ['Peça do Workbox (service worker)', 'build']],
    [/^@opentelemetry\/|^@sentry\//, ['Monitoramento de erros', 'servidor']],
  ];
  const TIPO = { tela: '🖥 Tela', servidor: '🗄 Servidor', banco: '🛢 Banco', ia: '🤖 IA', build: '🔧 Montagem', tipos: '📐 Tipos', teste: '🧪 Teste', estilo: '🎨 Estilo', mobile: '📱 APK', desktop: '💻 EXE', replit: '⛔ Replit', util: '🧰 Utilidade', interno: '🔗 Interno', '?': '❔' };
  function explain(name) {
    if (DIC[name]) return DIC[name];
    for (const [re, v] of PAD) if (re.test(name)) return v;
    return ['(sem descrição — toque no nome para ver no npm)', '?'];
  }
  const SCRIPTS = [
    [/^dev$/, 'Liga o app em modo de teste (atualiza sozinho)'], [/^build/, 'Gera a versão final (pasta dist)'], [/^start$/, 'Liga a versão final'], [/^preview$/, 'Mostra a versão final para conferir'],
    [/typecheck|tsc/, 'Confere os tipos do TypeScript (não muda nada)'], [/^lint/, 'Procura erros de escrita'], [/^test/, 'Roda os testes'], [/db:push|migrate/, 'Cria/atualiza as tabelas no banco'], [/^format/, 'Arruma a formatação'], [/cap|android/, 'Monta o APK com Capacitor'], [/electron|dist|pack/, 'Monta o executável'], [/^serve/, 'Liga um servidor simples'],
  ];
  const scriptHelp = (n) => (SCRIPTS.find(([re]) => re.test(n)) || [0, ''])[1];

  // ── Análise ─────────────────────────────────────────────────────────────────
  function parseCatalog(yaml) {
    const cat = {}; let inCat = false;
    (yaml || '').split('\n').forEach((ln) => {
      if (/^catalog:\s*$/.test(ln)) { inCat = true; return; }
      if (inCat && /^\S/.test(ln)) inCat = false;
      if (inCat) { const m = /^\s+['"]?([^'":]+)['"]?\s*:\s*['"]?([^'"#\s]+)/.exec(ln); if (m) cat[m[1].trim()] = m[2]; }
    });
    return cat;
  }
  function analyze() {
    const files = fs().list();
    const pkgs = [];
    for (const f of files.filter((x) => /(^|\/)package\.json$/.test(x) && !/(^|\/)node_modules\//.test(x))) {
      let j; try { j = JSON.parse(fs().read(f) || '{}'); } catch (e) { pkgs.push({ path: f, erro: e.message }); continue; }
      pkgs.push({ path: f, dir: fs().dirName(f) || '.', name: j.name || '(sem nome)', version: j.version || '', private: j.private, type: j.type, main: j.main, scripts: j.scripts || {}, deps: j.dependencies || {}, dev: j.devDependencies || {}, peer: j.peerDependencies || {}, workspaces: j.workspaces });
    }
    pkgs.sort((a, b) => (a.path.split('/').length - b.path.split('/').length) || a.path.localeCompare(b.path));
    const wsYaml = files.find((x) => /(^|\/)pnpm-workspace\.yaml$/.test(x));
    const catalog = wsYaml ? parseCatalog(fs().read(wsYaml)) : {};
    const names = new Set(pkgs.map((p) => p.name));
    const all = new Map();   // nome -> {versões, usado em, dev?}
    for (const p of pkgs) {
      for (const [kind, obj] of [['dep', p.deps], ['dev', p.dev]]) {
        for (const [n, v0] of Object.entries(obj || {})) {
          const internal = /^workspace:/.test(v0) || names.has(n);
          const v = /^catalog:/.test(v0) ? (catalog[n] || v0) : v0;
          const e = all.get(n) || { name: n, versions: new Set(), where: [], dev: true, internal: false };
          e.versions.add(v); e.where.push(p.path); if (kind === 'dep') e.dev = false; if (internal) e.internal = true;
          all.set(n, e);
        }
      }
    }
    const deps = [...all.values()].map((e) => { const [d, t] = e.internal ? ['Pacote INTERNO deste projeto (outra pasta do monorepo)', 'interno'] : explain(e.name); return Object.assign(e, { desc: d, tipo: t, versions: [...e.versions] }); }).sort((a, b) => a.name.localeCompare(b.name));
    // ── Quem é usado de verdade? Procura import/require no código e nos comandos ──
    const used = new Map(); // pacote -> Set(arquivos)
    const addUse = (spec, f) => {
      if (!spec || /^[./#~]|^@\//.test(spec) || /^(node|bun):/.test(spec)) return;
      const parts = spec.split('/'); const name = spec[0] === '@' ? parts.slice(0, 2).join('/') : parts[0];
      if (!used.has(name)) used.set(name, new Set()); used.get(name).add(f);
    };
    for (const f of files) {
      if (!/\.(m?[jt]sx?|cjs|cts|mts|vue|svelte|astro|css|scss|html?)$/i.test(f) || /(^|\/)(node_modules|dist|build|dist-[\w-]+)\//.test(f)) continue;
      const t = fs().read(f); if (!t || t.length > 3e6) continue;
      const re = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|@import\s+(?:url\()?|@plugin\s+|@config\s+)(['"])([^'"\n]+)\1/g; let m;
      while ((m = re.exec(t))) addUse(m[2], f);
      const r2 = /\bimport\s+(['"])([^'"\n]+)\1/g; while ((m = r2.exec(t))) addUse(m[2], f);
    }
    const BIN = { vite: 'vite', tsc: 'typescript', tsx: 'tsx', esbuild: 'esbuild', 'drizzle-kit': 'drizzle-kit', 'electron-builder': 'electron-builder', electron: 'electron', cap: '@capacitor/cli', eslint: 'eslint', prettier: 'prettier', vitest: 'vitest', jest: 'jest', concurrently: 'concurrently', 'cross-env': 'cross-env', nodemon: 'nodemon', rimraf: 'rimraf', pkg: 'pkg', 'eas': 'eas-cli', tailwindcss: 'tailwindcss', postcss: 'postcss' };
    const inScripts = new Set();
    pkgs.forEach((p) => Object.values(p.scripts || {}).forEach((cmd) => String(cmd).split(/[\s&|;]+/).forEach((w) => { if (BIN[w]) inScripts.add(BIN[w]); })));
    deps.forEach((d) => {
      const base = d.name.replace(/^@types\//, '').replace(/^([^_]+)__(.+)$/, '@$1/$2');
      const set = used.get(d.name) || (d.name.startsWith('@types/') ? used.get(base) : null);
      d.uso = set ? set.size : 0;
      d.usoArquivos = set ? [...set] : [];
      d.noComando = inScripts.has(d.name);
      d.usada = d.uso > 0 || d.noComando || d.internal || d.tipo === 'tipos' && d.name === '@types/node' || /^(typescript|@vitejs\/plugin-react|@tailwindcss\/vite|autoprefixer|tailwindcss|postcss)$/.test(d.name) && (used.has('vite') || inScripts.has('vite'));
    });
    // restos da Replit
    const replit = [];
    for (const f of files) {
      if (/(^|\/)(\.replit|replit\.nix|replit\.md|\.replitignore)$/.test(f) || /^\.local\/|(^|\/)\.config\/replit/.test(f)) { replit.push(f + ' (arquivo da Replit)'); continue; }
      const t = fs().read(f); if (!t || t.length > 2e6 || /\.(lock|lockb)$|lock\.yaml$/.test(f)) continue;
      const hits = (t.match(/@replit\/|REPL_ID|REPLIT_|AI_INTEGRATIONS_|\.replit\.(app|dev)|replit_integrations/g) || []).length;
      if (hits) replit.push(f + ' — ' + hits + ' menção(ões)');
    }
    const important = files.filter((f) => /(^|\/)(package\.json|pnpm-workspace\.yaml|tsconfig[^/]*\.json|vite\.config\.[mc]?[jt]s|capacitor\.config\.[jt]s(on)?|app\.json|eas\.json|electron[^/]*\.[mc]?js|main\.[mc]?js|preload\.[mc]?js|server\.[mc]?[jt]s|index\.[mc]?ts|build\.[mc]?[jt]s|drizzle\.config\.[jt]s|tailwind\.config\.[jt]s|postcss\.config\.[mc]?js|components\.json|manifest\.json|\.env\.example|_redirects|netlify\.toml|vercel\.json|\.replit|replit\.nix|Dockerfile)$/i.test(f) || /^\.github\/workflows\//.test(f) || /(^|\/)src\/(App|main)\.[jt]sx?$/.test(f) || /(^|\/)(routes?|api)\/[^/]+\.[jt]s$/.test(f))
      .filter((f) => !/(^|\/)node_modules\//.test(f) && !/(^|\/)(dist|build)\/assets\//.test(f));
    const byType = {}; files.forEach((f) => { const l = fs().typeOf(f).label; byType[l] = (byType[l] || 0) + 1; });
    last = { pkgs, deps, catalog, wsYaml, replit, important, files, byType, monorepo: pkgs.length > 1 || !!wsYaml, at: new Date() };
    return last;
  }

  // ── Plano em Markdown (completo, sem cortar) ────────────────────────────────
  function treeText(files) {
    const root = {};
    files.forEach((f) => { let n = root; f.split('/').forEach((s, i, a) => { n[s] = n[s] || (i === a.length - 1 ? null : {}); if (n[s]) n = n[s]; }); });
    const out = [];
    const walk = (n, pre) => {
      const keys = Object.keys(n).sort((a, b) => ((n[b] !== null) - (n[a] !== null)) || a.localeCompare(b));
      keys.forEach((k, i) => { const lastK = i === keys.length - 1; out.push(pre + (lastK ? '└── ' : '├── ') + k + (n[k] ? '/' : '')); if (n[k]) walk(n[k], pre + (lastK ? '    ' : '│   ')); });
    };
    walk(root, '');
    return out.join('\n');
  }
  function planMD(a) {
    const P = fs().project;
    const L = [];
    L.push('# Plano do projeto: ' + P.name, '', '_Gerado pelo Mini SK em ' + a.at.toLocaleString('pt-BR') + '_', '');
    L.push('## Resumo', '', '- Arquivos: **' + a.files.length + '** (' + SK.bytes(fs().totalSize()) + ')', '- Tipo: ' + (a.monorepo ? '**monorepo** (vários projetos dentro de um) — ' + a.pkgs.length + ' package.json' : (a.pkgs.length ? 'projeto Node com 1 package.json' : 'site simples (sem package.json)')));
    L.push('- Arquivos por tipo: ' + Object.entries(a.byType).sort((x, y) => y[1] - x[1]).map(([k, v]) => k + ' ' + v).join(', '));
    L.push('- Dependências diferentes: **' + a.deps.length + '** (' + a.deps.filter((d) => !d.dev).length + ' obrigatórias, ' + a.deps.filter((d) => d.dev).length + ' só para montar)');
    L.push('- Restos da Replit: ' + (a.replit.length ? '**' + a.replit.length + ' arquivo(s)**' : 'nenhum'), '');
    for (const p of a.pkgs) {
      L.push('## 📦 ' + (p.erro ? p.path + ' (ERRO: ' + p.erro + ')' : p.name + ' — `' + p.path + '`'), '');
      if (p.erro) continue;
      if (p.workspaces) L.push('- Workspaces: ' + JSON.stringify(p.workspaces));
      if (p.main) L.push('- Arquivo principal: `' + p.main + '`');
      const sc = Object.entries(p.scripts);
      if (sc.length) { L.push('', '**Comandos (scripts):**', '', '| Comando | O que faz | Executa |', '|---|---|---|'); sc.forEach(([k, v]) => L.push('| `' + k + '` | ' + (scriptHelp(k) || '—') + ' | `' + String(v).replace(/\|/g, '\\|') + '` |')); }
      for (const [title, obj] of [['Dependências (o app precisa)', p.deps], ['Dependências de montagem (dev)', p.dev]]) {
        const ent = Object.entries(obj); if (!ent.length) continue;
        L.push('', '**' + title + ' — ' + ent.length + ':**', '', '| Pacote | Versão | Pra que serve | Tipo |', '|---|---|---|---|');
        ent.forEach(([n, v]) => { const d = a.deps.find((x) => x.name === n); L.push('| `' + n + '` | ' + (/^catalog:/.test(v) ? (a.catalog[n] || v) + ' (catalog)' : v) + ' | ' + d.desc + ' | ' + TIPO[d.tipo] + ' |'); });
      }
      L.push('');
    }
    if (a.wsYaml) { L.push('## pnpm-workspace.yaml', '', '```yaml', fs().read(a.wsYaml) || '', '```', ''); }
    if (a.replit.length) { L.push('## ⛔ Restos da Replit (tirar ou trocar)', ''); a.replit.forEach((r) => L.push('- ' + r)); L.push(''); }
    L.push('## Arquivos importantes (' + a.important.length + ') — mandar estes para a IA', ''); a.important.forEach((f) => L.push('- `' + f + '`')); L.push('');
    L.push('## Estrutura completa (' + a.files.length + ' arquivos)', '', '```', treeText(a.files), '```', '');
    return L.join('\n');
  }
  function unifiedPkg(a, enxuto) {
    const deps = {}, dev = {};
    a.deps.filter((d) => !d.internal && d.tipo !== 'replit' && (!enxuto || d.usada)).forEach((d) => { const v = d.versions.find((x) => !/^(catalog|workspace):/.test(x)) || 'latest'; (d.dev ? dev : deps)[d.name] = v; });
    const root = a.pkgs.find((p) => !p.erro) || {};
    return JSON.stringify({ name: (root.name || fs().project.name).replace(/^@[^/]+\//, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-'), version: '1.0.0', private: true, type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' }, dependencies: sortObj(deps), devDependencies: sortObj(dev) }, null, 2) + '\n';
  }
  const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  function batText(a) {
    const dirs = [...new Set(a.files.map((f) => fs().dirName(f)).filter(Boolean).flatMap((d) => d.split('/').map((_, i, arr) => arr.slice(0, i + 1).join('/'))))].sort();
    const name = fs().project.name.replace(/[\\/:*?"<>|]/g, '_');
    return '@echo off\r\nchcp 65001 >nul\r\nREM Cria as pastas do projeto "' + name + '" (vazias) — gerado pelo Mini SK\r\nset "RAIZ=%~dp0' + name + '"\r\nmkdir "%RAIZ%" 2>nul\r\n' +
      dirs.map((d) => 'mkdir "%RAIZ%\\' + d.replace(/\//g, '\\') + '" 2>nul').join('\r\n') + '\r\necho Pronto: ' + dirs.length + ' pastas criadas em "%RAIZ%"\r\npause\r\n';
  }
  /** Pacote para a IA: arquivos importantes (ou todos os de texto) com marcadores, em partes. */
  function aiPack(a, mode, maxPart) {
    const list = mode === 'todos' ? a.files.filter((f) => fs().read(f) != null && !/(^|\/)(node_modules|dist|build)\//.test(f) && !/lock|\.map$/.test(f)) : a.important;
    const head = '# Pacote do projeto "' + fs().project.name + '" para a IA\n# ' + list.length + ' arquivos. Cada um começa com ===== ARQUIVO: caminho =====\n\n## Estrutura\n' + treeText(a.files) + '\n\n';
    const parts = []; let cur = head;
    for (const f of list) {
      const t = fs().read(f); if (t == null) continue;
      const chunk = '===== ARQUIVO: ' + f + ' =====\n' + t + (t.endsWith('\n') ? '' : '\n') + '===== FIM: ' + f + ' =====\n\n';
      if (cur.length + chunk.length > maxPart && cur.length > head.length) { parts.push(cur); cur = '# (continuação)\n\n'; }
      cur += chunk;
    }
    parts.push(cur);
    return parts;
  }
  /** Lê texto com marcadores e devolve [{path, text}] */
  function parseMarked(text) {
    const out = [];
    const re = /^=====\s*ARQUIVO:\s*(.+?)\s*=====\s*$/gm; let m; const marks = [];
    while ((m = re.exec(text))) marks.push({ path: m[1], start: m.index + m[0].length + 1, at: m.index });
    marks.forEach((mk, i) => {
      let body = text.slice(mk.start, i + 1 < marks.length ? marks[i + 1].at : text.length);
      const end = body.search(/^=====\s*FIM:.*=====\s*$/m); if (end >= 0) body = body.slice(0, end);
      out.push({ path: mk.path, text: body.replace(/\n{1,2}$/, '\n') });
    });
    if (out.length) return out;
    // blocos ```lang filepath:caminho ou com comentário "arquivo: caminho" na 1ª linha
    const cb = /```([^\n`]*)\n([\s\S]*?)```/g;
    while ((m = cb.exec(text))) {
      const info = m[1]; let code = m[2];
      let p = (/(?:filepath|arquivo|file)\s*[:=]\s*([^\s`]+)/i.exec(info) || [])[1];
      if (!p) { const fl = /^\s*(?:\/\/|#|<!--|\/\*)\s*(?:arquivo|file|filepath)\s*:\s*([^\s*>]+)/i.exec(code); if (fl) p = fl[1]; }
      if (!p) { const before = text.slice(Math.max(0, m.index - 160), m.index); const h = /(?:^|\n)\s*(?:#+\s*|\*\*|`)?([\w./-]+\.[a-z0-9]{1,6})(?:`|\*\*)?:?\s*$/i.exec(before); if (h) p = h[1]; }
      if (p) out.push({ path: p.replace(/^\.?\//, ''), text: code });
    }
    return out;
  }


  // ── 🧹 Tirar a Replit ───────────────────────────────────────────────────────
  function cleanViteConfig(t) {
    let n = 0; const rep = (re, by) => { const t2 = t.replace(re, by); if (t2 !== t) { n++; t = t2; } };
    rep(/^\s*import\s+[^;\n]*from\s+['"]@replit\/[^'"]+['"];?[ \t]*\n/gm, '');
    rep(/^\s*runtimeErrorOverlay\(\),?[ \t]*\n/gm, '');
    rep(/^[ \t]*\.\.\.\(\s*process\.env\.NODE_ENV\s*!==\s*["']production["']\s*&&\s*process\.env\.REPL_ID\s*!==\s*undefined[\s\S]*?:\s*\[\]\s*\),?[ \t]*\n/gm, '');
    rep(/^[ \t]*if\s*\(\s*!rawPort\s*\)\s*\{[\s\S]*?\n[ \t]*\}[ \t]*\n/gm, '');
    rep(/^[ \t]*if\s*\(\s*Number\.isNaN\(port\)[\s\S]*?\n[ \t]*\}[ \t]*\n/gm, '');
    rep(/^[ \t]*if\s*\(\s*!basePath\s*\)\s*\{[\s\S]*?\n[ \t]*\}[ \t]*\n/gm, '');
    rep(/const\s+port\s*=\s*Number\(rawPort\);/g, 'const port = rawPort ? Number(rawPort) : 5173;');
    rep(/const\s+basePath\s*=\s*process\.env\.BASE_PATH;/g, 'const basePath = process.env.BASE_PATH ?? "./";');
    rep(/base:\s*process\.env\.BASE_PATH\s*,/g, 'base: process.env.BASE_PATH ?? "./",');
    rep(/process\.env\.BASE_PATH\s*\?\?\s*["']\/["']/g, 'process.env.BASE_PATH ?? "./"');
    if (n) t = t.replace(/\n{3,}/g, '\n\n');
    return { text: t, n };
  }
  async function cleanReplit() {
    const a = analyze();
    const rep = [];
    await SK.checkpoints.auto('Antes de tirar a Replit');
    for (const p of a.pkgs) {
      if (p.erro) continue;
      let j; try { j = JSON.parse(fs().read(p.path)); } catch { continue; }
      let removed = [], resolved = 0;
      for (const k of ['dependencies', 'devDependencies', 'peerDependencies']) {
        if (!j[k]) continue;
        for (const n of Object.keys(j[k])) {
          if (/^@replit\//.test(n)) { delete j[k][n]; removed.push(n); continue; }
          if (/^catalog:/.test(j[k][n]) && a.catalog[n]) { j[k][n] = a.catalog[n]; resolved++; }
        }
      }
      if (j.scripts && j.scripts.preinstall && /pnpm|only-allow|npm_config_user_agent/.test(j.scripts.preinstall)) { delete j.scripts.preinstall; rep.push('🔓 ' + p.path + ': tirei a trava que proibia "npm install"'); }
      if (removed.length || resolved) {
        fs().write(p.path, JSON.stringify(j, null, 2) + '\n', { silent: true });
        rep.push('📦 ' + p.path + ': ' + (removed.length ? 'tirei ' + removed.join(', ') : '') + (removed.length && resolved ? ' · ' : '') + (resolved ? 'troquei ' + resolved + ' "catalog:" pela versão escrita' : ''));
      }
    }
    for (const f of a.files.filter((x) => /(^|\/)vite\.config[^/]*\.[mc]?[jt]s$/.test(x))) {
      const r = cleanViteConfig(fs().read(f) || '');
      if (r.n) { fs().write(f, r.text, { silent: true }); rep.push('⚙️ ' + f + ': tirei os plugins da Replit e a exigência de PORT/BASE_PATH (' + r.n + ' ajuste(s))'); }
    }
    if (a.wsYaml) {
      const y = fs().read(a.wsYaml) || '';
      const y2 = y.replace(/^[ \t]+['"]?@replit\/[^\n]*\n/gm, '');
      if (y2 !== y) { fs().write(a.wsYaml, y2, { silent: true }); rep.push('🗂 ' + a.wsYaml + ': tirei os @replit do catálogo'); }
    }
    for (const f of a.files.filter((x) => /(^|\/)(\.replit|replit\.nix|\.replitignore)$/.test(x))) { fs().remove(f); rep.push('🗑 Apaguei ' + f + ' (arquivo da Replit)'); }
    const still = a.deps.filter((d) => d.internal).map((d) => d.name);
    if (still.length) rep.push('ℹ️ Continuam ligados por "workspace:*" (pastas lib/ do monorepo): ' + still.join(', ') + '. Isso funciona com pnpm; para virar projeto único, é o passo "desmontar monorepo".');
    SK.emit('fs-change', { type: 'import' });
    return rep.length ? rep : ['✅ Nada da Replit encontrado para tirar.'];
  }


  // ── 🧩 Conversa sem marcação ────────────────────────────────────────────────
  let conv = null, convName = '';
  function convParse() {
    const txt = SK.$('#rx-txt', box).value;
    if (!txt.trim()) return SK.toast('Cole a conversa ou abra o .md/.txt primeiro', 'error');
    conv = SK.conversa.parse(txt);
    conv.items.forEach((it) => { it.on = it.latest || /^montagem-/.test(it.outPath); });
    const el = SK.$('#rx-conv-out', box);
    if (!conv.items.length) { el.innerHTML = '<p class="muted">Não achei código nessa conversa.</p>'; return; }
    const folders = {}; conv.items.forEach((it, k) => { const f = it.outPath.split('/')[0]; (folders[f] = folders[f] || []).push(k); });
    const desc = (f) => /^montagem-/.test(f) ? '🧱 ' + f + ' — uma tentativa da IA montada em partes ("PARTE 1, 2, 3…"), já na estrutura de pastas que ela pediu' : f === 'paginas' ? '📄 páginas HTML inteiras (abrem sozinhas)' : '🧩 trechos soltos (pedaços para colar dentro de outro arquivo)';
    el.innerHTML = '<div class="ft-sum"><b>' + conv.items.length + ' códigos recuperados</b> de ' + SK.fmt(conv.lines) + ' linhas · ' + conv.items.filter((i) => i.doc).length + ' páginas inteiras · ' + Object.keys(folders).filter((f) => /^montagem-/.test(f)).length + ' montagens' + (conv.speakers.length ? '<div class="small muted">Escrito por: ' + SK.esc(conv.speakers.join(', ')) + '</div>' : '') + '<div class="small muted" id="rx-conv-sum"></div></div>' +
      '<div class="row wrap"><button class="btn primary" data-cv="make">⤵ Criar os marcados</button><button class="btn small" data-cv="all">Marcar todos</button><button class="btn small" data-cv="latest">Só os mais recentes</button><button class="btn small" data-cv="txt">⤓ TXT com marcadores</button><button class="btn small" data-cv="idx">⤓ Índice .md</button></div>' +
      Object.entries(folders).map(([f, ks]) => '<details class="cv-f"' + (/^montagem-|paginas/.test(f) ? ' open' : '') + '><summary><b>' + SK.esc(f) + '/</b> <span class="muted small">' + ks.length + ' arquivo(s) — ' + SK.esc(desc(f)) + '</span></summary>' +
        ks.map((k) => { const it = conv.items[k]; return '<div class="cv-it" data-ci="' + k + '"><input type="checkbox" data-f="on"' + (it.on ? ' checked' : '') + '><div class="grow"><input class="inp mono small" data-f="path" value="' + SK.esc(it.outPath) + '"><div class="muted small">' + it.lang + ' · ' + it.lines + ' linhas' + (it.versions > 1 ? ' · <b>v' + it.version + ' de ' + it.versions + (it.latest ? ' (mais recente)' : ' (antiga)') + '</b>' : '') + (it.speaker ? ' · ' + SK.esc(it.speaker) : '') + ' · linha ' + (it.a + 1) + (it.label ? '<br>“' + SK.esc(it.label.slice(0, 110)) + '”' : '') + '</div></div><button class="btn tiny" data-cv="see">Ver</button></div>'; }).join('') + '</details>').join('');
    convSum();
  }
  function convSum() { const el = SK.$('#rx-conv-sum', box); if (el && conv) el.textContent = conv.items.filter((i) => i.on).length + ' marcados para criar'; }
  async function convClick(e) {
    const b = e.target.closest('[data-cv]'); if (!b || !conv) return;
    const act = b.dataset.cv;
    if (act === 'see') { const it = conv.items[+b.closest('[data-ci]').dataset.ci]; SK.confirm(it.code.slice(0, 5000) + (it.code.length > 5000 ? '\n…(' + it.lines + ' linhas)' : ''), { title: it.outPath, okText: 'Fechar' }); return; }
    if (act === 'all' || act === 'latest') { conv.items.forEach((it) => { it.on = act === 'all' ? true : it.latest; }); SK.$$('[data-ci]', box).forEach((r) => { SK.$('[data-f="on"]', r).checked = conv.items[+r.dataset.ci].on; }); convSum(); return; }
    const chosen = conv.items.filter((it) => it.on);
    const dir = 'conversa-' + new Date().toISOString().slice(0, 10);
    if (act === 'txt') { SK.download(dir + '.txt', SK.conversa.toTXT(conv, chosen, dir)); return; }
    if (act === 'idx') { SK.download(dir + '-indice.md', SK.conversa.indexMD(conv, convName), 'text/markdown;charset=utf-8'); return; }
    if (act === 'make') {
      if (!chosen.length) return SK.toast('Marque pelo menos um', 'error');
      if (!(await SK.confirm('Criar ' + chosen.length + ' arquivo(s) na pasta "' + dir + '/"?', { okText: 'Criar' }))) return;
      await SK.checkpoints.auto('Antes de desembaralhar a conversa');
      chosen.forEach((it) => fs().write(dir + '/' + it.outPath, it.code + '\n', { silent: true }));
      fs().write(dir + '/_indice.md', SK.conversa.indexMD(conv, convName), { silent: true });
      SK.emit('fs-change', { type: 'import' });
      SK.toast('✅ ' + chosen.length + ' arquivos criados em ' + dir + '/');
      const firstIdx = chosen.find((it) => /^montagem-\d+\/index\.html$/.test(it.outPath)) || chosen.find((it) => it.doc);
      if (firstIdx) SK.editor.open(dir + '/' + firstIdx.outPath, { noFocus: true });
    }
  }

  // ── Interface ───────────────────────────────────────────────────────────────
  function build(container) {
    box = container;
    box.innerHTML =
      '<div class="seg"><button class="seg-b on" data-rt="res">Resumo</button><button class="seg-b" data-rt="dep">Dependências</button><button class="seg-b" data-rt="plan">Plano</button><button class="seg-b" data-rt="mont">⤵ Montar</button></div>' +
      '<div class="row wrap"><button class="btn primary" id="rx-go">🧬 Analisar projeto</button><button class="btn" id="rx-clean">🧹 Tirar a Replit</button><span class="muted small" id="rx-when"></span></div><div id="rx-clean-out" class="pw-rep"></div>' +
      '<div data-rp="res" class="stack" id="rx-res"><p class="muted small">Toque em <b>Analisar projeto</b>. Funciona com projetos da Replit (vários package.json), sem cortar nada.</p></div>' +
      '<div data-rp="dep" class="stack" hidden><div class="row wrap"><input class="inp grow" id="rx-q" placeholder="Filtrar (ex.: replit, banco, react)"><select class="inp" id="rx-u"><option value="">Usadas e não usadas</option><option value="sim">Só as usadas</option><option value="nao">⚠ Só as que não achei uso</option></select><select class="inp" id="rx-t"><option value="">Todos os tipos</option>' + Object.entries(TIPO).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('') + '</select></div><div id="rx-deps" class="rx-deps"></div></div>' +
      '<div data-rp="plan" class="stack" hidden>' +
      '  <div class="row wrap"><button class="btn small primary" data-dl="md">⤓ Plano .md</button><button class="btn small" data-dl="copy">Copiar plano</button><button class="btn small primary" data-dl="save">📥 Pôr o plano no projeto</button></div>' +
      '  <div class="row wrap"><button class="btn small" data-dl="pkg">⤓ package.json unificado</button><button class="btn small" data-dl="pkgmin">⤓ package.json enxuto (só as usadas)</button><button class="btn small primary" data-dl="pkgmin-in">📥 Pôr o enxuto no projeto</button><button class="btn small" data-dl="pkg-in">📥 Pôr o unificado no projeto</button><button class="btn small" data-dl="bat">⤓ Pastas vazias (.bat)</button></div>' +
      '  <div class="row wrap"><button class="btn small" data-dl="ia">📦 Pacote para a IA (importantes)</button><button class="btn small" data-dl="iaall">📦 Pacote com TODOS os textos</button><button class="btn small" data-dl="ia-in">📥 Pacote no projeto (.sk/)</button></div>' +
      '  <p class="muted small">O pacote junta os arquivos num .txt com <code>===== ARQUIVO: caminho =====</code>. Se passar de ~400 KB, vem em partes (parte-1, parte-2…). É só anexar aqui no chat.</p>' +
      '  <pre class="rx-plan" id="rx-plan"></pre></div>' +
      '<div data-rp="mont" class="stack" hidden>' +
      '  <p class="muted small">Cole aqui (ou importe) um texto/MD com arquivos marcados — <code>===== ARQUIVO: pasta/nome.js =====</code> ou blocos <code>```js filepath:pasta/nome.js</code>. Os arquivos são criados no projeto (com checkpoint antes).</p>' +
      '  <textarea class="inp mono" id="rx-txt" rows="8" placeholder="===== ARQUIVO: index.html =====&#10;&lt;!doctype html&gt;…"></textarea>' +
      '  <div class="row wrap"><button class="btn" id="rx-file">📄 Abrir .txt/.md</button><input type="file" id="rx-file-in" accept=".txt,.md,.markdown,text/*" multiple hidden><button class="btn" id="rx-prev">Ver o que vai criar</button><button class="btn primary" id="rx-mk">⤵ Criar arquivos</button></div>' +
      '  <div class="row wrap"><button class="btn" id="rx-conv">🧩 Conversa sem marcação</button><span class="muted small">código colado do app de IA, sem ```</span></div>' +
      '  <div id="rx-mk-out" class="pw-rep"></div><div id="rx-conv-out"></div></div>';
    const $ = (s) => SK.$(s, box);
    box.addEventListener('click', (e) => {
      const t = e.target.closest('[data-rt]'); if (t) { SK.$$('[data-rt]', box).forEach((b) => b.classList.toggle('on', b === t)); SK.$$('[data-rp]', box).forEach((p) => (p.hidden = p.dataset.rp !== t.dataset.rt)); }
      const d = e.target.closest('[data-dl]'); if (d) download(d.dataset.dl);
      const o = e.target.closest('[data-open-file]'); if (o) SK.editor.open(o.dataset.openFile);
    });
    $('#rx-go').onclick = run;
    $('#rx-clean').onclick = async () => {
      if (!(await SK.confirm('Tirar tudo da Replit deste projeto? Tira os 3 plugins (@replit/…), troca "catalog:" pelas versões, tira a trava do pnpm e a exigência de PORT/BASE_PATH no vite.config, apaga .replit e replit.nix. Um checkpoint é criado antes (dá para voltar).', { okText: 'Tirar a Replit' }))) return;
      const rep = await cleanReplit();
      SK.$('#rx-clean-out', box).innerHTML = rep.map((x) => '<div class="small">' + SK.esc(x) + '</div>').join('');
      run();
    };
    $('#rx-q').addEventListener('input', SK.debounce(renderDeps, 200)); $('#rx-t').onchange = renderDeps; $('#rx-u').onchange = renderDeps;
    $('#rx-file').onclick = () => $('#rx-file-in').click();
    $('#rx-file-in').onchange = async (e) => { convName = e.target.files[0] ? e.target.files[0].name : ''; let t = ''; for (const f of e.target.files) t += (t ? '\n' : '') + fs().decodeBytes(new Uint8Array(await f.arrayBuffer())).text; $('#rx-txt').value = t; e.target.value = ''; preview(); };
    $('#rx-prev').onclick = preview;
    $('#rx-conv').onclick = () => convParse();
    $('#rx-conv-out').addEventListener('click', convClick);
    $('#rx-conv-out').addEventListener('change', (e) => { const r = e.target.closest('[data-ci]'); if (!r || !conv) return; const it = conv.items[+r.dataset.ci]; if (e.target.dataset.f === 'on') it.on = e.target.checked; if (e.target.dataset.f === 'path') it.outPath = e.target.value.trim() || it.outPath; convSum(); });
    $('#rx-mk').onclick = async () => {
      const list = parseMarked($('#rx-txt').value);
      if (!list.length) return SK.toast('Não achei arquivos marcados no texto', 'error');
      const exist = list.filter((x) => fs().exists(x.path)).length;
      if (!(await SK.confirm('Criar ' + list.length + ' arquivo(s)' + (exist ? ' (' + exist + ' já existem e serão substituídos)' : '') + '? Um checkpoint é criado antes.', { okText: 'Criar' }))) return;
      await SK.checkpoints.auto('Antes de montar a partir de texto');
      list.forEach((x) => fs().write(x.path, x.text, { silent: true }));
      SK.emit('fs-change', { type: 'import' });
      $('#rx-mk-out').innerHTML = '✅ ' + list.length + ' arquivo(s) criados:' + list.map((x) => '<div><a href="#" data-open-file="' + SK.esc(fs().norm(x.path)) + '">' + SK.esc(x.path) + '</a> <span class="muted small">' + SK.fmt(x.text.split('\n').length) + ' linhas</span></div>').join('');
    };
  }
  function preview() {
    const list = parseMarked(SK.$('#rx-txt', box).value);
    SK.$('#rx-mk-out', box).innerHTML = list.length ? list.length + ' arquivo(s) encontrados:' + list.map((x) => '<div>' + (fs().exists(x.path) ? '♻️ ' : '➕ ') + SK.esc(x.path) + ' <span class="muted small">' + SK.fmt(x.text.split('\n').length) + ' linhas</span></div>').join('') : '<span class="muted">Nenhum arquivo marcado encontrado. Se é uma conversa copiada do app de IA, toque em 🧩 Conversa sem marcação.</span>';
  }
  function run() {
    if (!fs().project) return;
    const a = analyze();
    SK.$('#rx-when', box).textContent = 'analisado às ' + a.at.toLocaleTimeString('pt-BR');
    const n = (t) => a.deps.filter((d) => d.tipo === t).length;
    SK.$('#rx-res', box).innerHTML =
      '<div class="rx-cards">' +
      card(a.files.length, 'arquivos') + card(a.pkgs.length, 'package.json') + card(a.deps.length, 'dependências') + card(a.replit.length, 'com Replit', a.replit.length ? 'bad' : 'ok') + '</div>' +
      (a.files.filter((f) => /\.(m?[jt]sx?)$/.test(f)).length < 40 ? '<p class="small warn-box">⚠ Este projeto tem poucos arquivos de código (' + a.files.filter((f) => /\.(m?[jt]sx?)$/.test(f)).length + '). Se você importou só o "pacote para a IA", muitas dependências vão aparecer como "não achei uso" só porque os arquivos que usam não vieram. Para essa conta valer, importe o projeto inteiro (.zip).</p>' : '') +
      '<p class="small">✔ <b>' + a.deps.filter((d) => d.usada).length + '</b> dependências usadas no código · ⚠ <b>' + a.deps.filter((d) => !d.usada && d.tipo !== 'replit').length + '</b> sem uso encontrado (veja em Dependências → "Só as que não achei uso")</p>' +
      '<p>' + (a.monorepo ? '🧩 <b>Monorepo</b>: vários projetos dentro de um (padrão da Replit). Li <b>todos</b> os package.json:' : a.pkgs.length ? 'Projeto com 1 package.json:' : '🌐 Site simples (sem package.json) — não precisa instalar nada.') + '</p>' +
      a.pkgs.map((p) => '<div class="rx-pkg"><b>' + SK.esc(p.name || p.path) + '</b> <span class="muted small">' + SK.esc(p.path) + '</span>' + (p.erro ? '<div class="msg error">' + SK.esc(p.erro) + '</div>' : '<div class="muted small">' + Object.keys(p.deps).length + ' dependências · ' + Object.keys(p.dev).length + ' de montagem · comandos: ' + (Object.keys(p.scripts).map((k) => '<code>' + SK.esc(k) + '</code>').join(' ') || '—') + '</div>') + '</div>').join('') +
      '<p class="small">Por tipo: ' + Object.entries(TIPO).filter(([k]) => n(k)).map(([k, v]) => v + ' ' + n(k)).join(' · ') + '</p>' +
      (a.replit.length ? '<details open><summary><b>⛔ Restos da Replit (' + a.replit.length + ')</b></summary>' + a.replit.map((r) => '<div class="small mono">' + SK.esc(r) + '</div>').join('') + '</details>' : '<p>✅ Nenhum resto da Replit encontrado.</p>') +
      '<details><summary><b>⭐ Arquivos importantes (' + a.important.length + ')</b> — os que eu preciso ver</summary>' + a.important.map((f) => '<div class="small"><a href="#" data-open-file="' + SK.esc(f) + '">' + SK.esc(f) + '</a></div>').join('') + '</details>';
    renderDeps();
    SK.$('#rx-plan', box).textContent = planMD(a);
  }
  const card = (n, l, cls) => '<div class="rx-card ' + (cls || '') + '"><b>' + SK.fmt(n) + '</b><span>' + l + '</span></div>';
  function renderDeps() {
    if (!last) return;
    const q = SK.$('#rx-q', box).value.trim().toLowerCase(), t = SK.$('#rx-t', box).value, u = SK.$('#rx-u', box).value;
    const list = last.deps.filter((d) => (!t || d.tipo === t) && (!u || (u === 'sim') === !!d.usada) && (!q || (d.name + ' ' + d.desc + ' ' + TIPO[d.tipo]).toLowerCase().includes(q)));
    SK.$('#rx-deps', box).innerHTML = '<div class="muted small">' + list.length + ' de ' + last.deps.length + '</div>' + list.map((d) =>
      '<div class="rx-dep k-' + d.tipo + '"><div class="row"><a class="mono" href="https://www.npmjs.com/package/' + encodeURIComponent(d.name).replace('%40', '@').replace('%2F', '/') + '" target="_blank" rel="noopener"><b>' + SK.esc(d.name) + '</b></a><span class="pill">' + TIPO[d.tipo] + '</span>' + (d.dev ? '<span class="pill">só montagem</span>' : '<span class="pill ok">obrigatória</span>') + (d.tipo === 'replit' ? '<span class="pill bad">pode tirar</span>' : d.usada ? '<span class="pill ok" title="' + SK.esc(d.usoArquivos.slice(0, 30).join('\n')) + '">✔ usada' + (d.uso ? ' em ' + d.uso + ' arquivo(s)' : d.noComando ? ' nos comandos' : '') + '</span>' : '<span class="pill warn">⚠ não achei uso</span>') + '</div>' +
      '<div class="small">' + SK.esc(d.desc) + '</div><div class="muted small">' + SK.esc(d.versions.join(', ')) + ' · em: ' + SK.esc(d.where.join(', ')) + '</div></div>').join('');
  }
  async function download(kind) {
    if (!last) run();
    const a = last, name = fs().project.name.replace(/[\\/:*?"<>|]/g, '_');
    if (kind === 'md') SK.download('plano-' + name + '.md', planMD(a), 'text/markdown;charset=utf-8');
    if (kind === 'copy') SK.copy(planMD(a));
    if (kind === 'save') { fs().write('PLANO.md', planMD(a)); SK.tree && SK.tree.expandTo && SK.tree.expandTo('PLANO.md'); SK.editor.open('PLANO.md'); SK.toast('📥 PLANO.md está no projeto (abra a prévia: cada comando tem ▶ e 📋).'); }
    if (kind === 'pkg-in' || kind === 'pkgmin-in') {
      await SK.checkpoints.auto('Antes de trocar o package.json pelo do Raio-X');
      if (fs().exists('package.json')) fs().write('package.antigo.json', fs().read('package.json'));
      fs().write('package.json', unifiedPkg(a, kind === 'pkgmin-in'));
      SK.editor.open('package.json');
      SK.toast('📥 package.json ' + (kind === 'pkgmin-in' ? 'enxuto' : 'unificado') + ' colocado no projeto (o antigo ficou em package.antigo.json; tem ponto de volta em 📸).');
    }
    if (kind === 'ia-in') { const parts = aiPack(a, 'importantes', 400000); parts.forEach((p, i) => fs().write('.sk/pacote-ia' + (parts.length > 1 ? '-parte-' + (i + 1) : '') + '.txt', p)); SK.toast('📥 Pacote para a IA salvo em .sk/ (' + parts.length + ' parte(s)).'); }
    if (kind === 'pkg') SK.download('package.unificado.json', unifiedPkg(a), 'application/json');
    if (kind === 'pkgmin') SK.download('package.enxuto.json', unifiedPkg(a, true), 'application/json');
    if (kind === 'bat') SK.download('criar-pastas-' + name + '.bat', batText(a), 'application/octet-stream');
    if (kind === 'ia' || kind === 'iaall') {
      const parts = aiPack(a, kind === 'iaall' ? 'todos' : 'importantes', 400000);
      if (parts.length === 1) SK.download('pacote-ia-' + name + '.txt', parts[0]);
      else { const zip = await SK.zip.write(parts.map((p, i) => ({ name: 'pacote-ia-' + name + '-parte-' + (i + 1) + '.txt', data: new TextEncoder().encode(p) }))); SK.download('pacote-ia-' + name + '.zip', zip); SK.toast(parts.length + ' partes no .zip'); }
    }
  }
  SK.on('project-open', () => { last = null; if (box) { SK.$('#rx-res', box).innerHTML = '<p class="muted small">Toque em <b>Analisar projeto</b>.</p>'; SK.$('#rx-deps', box).innerHTML = ''; SK.$('#rx-plan', box).textContent = ''; SK.$('#rx-when', box).textContent = ''; } });

  SK.analise = { build, analyze, planMD, parseMarked, aiPack, explain, cleanReplit, cleanViteConfig };
})(window.SK);
