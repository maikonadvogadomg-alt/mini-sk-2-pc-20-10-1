/* =========================================================================
   receita-core.js — 🧬 Receita para recriar um projeto (sem IA).
   Lê os arquivos, descobre o que cada um faz e monta:
   - RECEITA.md: visão geral, estrutura modular proposta, ordem de montagem
     e UM PEDIDO PRONTO POR ARQUIVO (para colar em qualquer IA, até as pequenas);
   - o esqueleto modular (index + 00-core + um módulo por parte + 99-app),
     cada arquivo já com a explicação e o pedido dentro.
   Uso: ReceitaProjeto.gerar(arquivos [{path,text}], nome) → { md, esqueleto:[{path,text}], modulos }
   ========================================================================= */
(function (G) {
  'use strict';
  const PULAR = /(^|\/)(node_modules|\.git|dist|build|\.next|\.cache|\.sk|android|ios|\.replit-artifact|attached_assets)(\/|$)|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.replit|replit\.nix)$/i;
  const CODIGO = /\.(m?[jt]sx?|cjs|vue|svelte|py|html?|css|scss|sql)$/i;
  const slug = (s) => String(s || 'parte').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'parte';
  const base = (p) => p.split('/').pop();
  const semExt = (p) => base(p).replace(/\.[^.]+$/, '');
  const uniq = (a) => Array.from(new Set(a));

  function papel(p, t) {
    if (/\.(css|scss)$/i.test(p)) return 'estilo';
    if (/\.sql$/i.test(p) || /(schema|model|migration|db)\b/i.test(p)) return 'dados';
    if (/(^|\/)(server|api|api-server|backend|routes?)\//i.test(p) || /\b(app|router)\.(get|post|put|delete|patch)\(/.test(t)) return 'servidor';
    if (/\.html?$/i.test(p) || /(^|\/)(pages?|screens?|views?|components?)\//i.test(p) || /return\s*\(\s*</.test(t)) return 'tela';
    return 'logica';
  }
  function descricao(p, t) {
    if (/\.html?$/i.test(p)) {
      const ti = (t.match(/<title[^>]*>([^<]{2,120})/i) || [])[1]; const h1 = (t.match(/<h1[^>]*>([\s\S]{2,120}?)<\/h1>/i) || [])[1];
      return [ti, h1 && h1.replace(/<[^>]+>/g, '').trim()].filter(Boolean).join(' — ');
    }
    const bloco = t.match(/^\s*\/\*+([\s\S]{10,900}?)\*\//);
    if (bloco) return bloco[1].split('\n').map((l) => l.replace(/^\s*\*?\s?/, '').trim()).filter((l) => l && !/^=+$/.test(l)).slice(0, 4).join(' ');
    const linhas = []; for (const l of t.split('\n').slice(0, 12)) { const m = l.match(/^\s*(\/\/|#)\s?(.*)$/); if (m) { if (m[2].trim() && !/^[=\-]+$/.test(m[2])) linhas.push(m[2].trim()); } else if (l.trim()) break; }
    return linhas.slice(0, 3).join(' ');
  }
  function itens(t) {
    const out = [];
    const re = /(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>|class\s+([A-Z][\w$]*)|def\s+([a-z_]\w*)\s*\(/g;
    let m; while ((m = re.exec(t)) && out.length < 40) out.push(m[1] || m[2] || m[3] || m[4]);
    return uniq(out).filter((n) => n.length > 2).slice(0, 18);
  }
  function usa(p, t, todos) {
    const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
    const refs = [];
    const re = /(?:import[^'"]*from\s*|import\s*\(\s*|require\(\s*|<script[^>]+src=|<link[^>]+href=)['"]([^'"]+)['"]/g;
    let m; while ((m = re.exec(t))) refs.push({ r: m[1], html: /^<(script|link)/.test(m[0]) });
    const out = [];
    for (const { r: r0, html } of refs) {
      let r = r0;
      if (/^(https?:|\/\/|data:|mailto:|#)/.test(r)) continue;
      if (html && !/^[.\/]/.test(r)) r = './' + r; // <script src="js/a.js"> é arquivo, não biblioteca
      if (!/^[.\/@~]/.test(r) || (/^@(?!\/)/.test(r))) { out.push('📦 ' + r.split('/').slice(0, r.startsWith('@') ? 2 : 1).join('/')); continue; }
      let alvo = r.replace(/^@\//, 'src/').replace(/^~\//, '');
      if (alvo.startsWith('.')) { const partes = (dir ? dir.split('/') : []); for (const s of alvo.split('/')) { if (s === '..') partes.pop(); else if (s !== '.') partes.push(s); } alvo = partes.join('/'); }
      alvo = alvo.replace(/^\//, '');
      const achou = todos.find((x) => x === alvo || x.replace(/\.[^./]+$/, '') === alvo || x === alvo + '/index.ts' || x === alvo + '/index.tsx' || x === alvo + '/index.js');
      out.push(achou || alvo);
    }
    return uniq(out);
  }
  function rotasDe(t) { const out = []; const re = /\b(?:app|router)\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)/g; let m; while ((m = re.exec(t))) out.push(m[1].toUpperCase() + ' ' + m[2]); return uniq(out).slice(0, 30); }
  function chamadasDe(t) { const out = []; const re = /fetch\(\s*[`'"]([^`'"]+)/g; let m; while ((m = re.exec(t))) out.push(m[1]); return uniq(out).slice(0, 20); }

  // ordem: quem é usado vem antes de quem usa (dependências primeiro)
  function ordenar(mods) {
    const porPath = new Map(mods.map((m) => [m.path, m])); const feito = new Set(); const out = [];
    const PESO = { dados: 0, logica: 1, servidor: 2, tela: 3, estilo: 4 };
    const visita = (m, pilha) => { if (feito.has(m.path) || pilha.has(m.path)) return; pilha.add(m.path); m.usa.filter((u) => porPath.has(u)).forEach((u) => visita(porPath.get(u), pilha)); feito.add(m.path); out.push(m); };
    mods.slice().sort((a, b) => PESO[a.papel] - PESO[b.papel] || a.path.localeCompare(b.path)).forEach((m) => visita(m, new Set()));
    return out;
  }

  function gerar(arquivos, nome) {
    nome = nome || 'Projeto';
    const todos = arquivos.filter((a) => !PULAR.test(a.path));
    const paths = todos.map((a) => a.path);
    const cod = todos.filter((a) => a.text != null && CODIGO.test(a.path) && a.text.length < 2e6 && !/\.(min)\.js$/.test(a.path));
    let mods = cod.filter((a) => !/(^|\/)(sw|service-?worker|workbox[^/]*)\.js$/i.test(a.path)).map((a) => ({ path: a.path, papel: papel(a.path, a.text), desc: descricao(a.path, a.text).replace(/[.\s]+$/, ''), itens: itens(a.text), usa: usa(a.path, a.text, paths), rotas: rotasDe(a.text), chamadas: chamadasDe(a.text), linhas: a.text.split('\n').length }));
    mods = ordenar(mods);
    const pacotes = uniq(mods.flatMap((m) => m.usa.filter((u) => u.startsWith('📦 ')).map((u) => u.replace('📦 ', '')))).sort();
    const temServidor = mods.some((m) => m.papel === 'servidor' && m.rotas.length);
    // nome do módulo novo (numerado, na ordem de montagem)
    let n = 10;
    // o que já é "locomotiva" ou "último vagão" no original vira o 00-core / 99-app do esqueleto
    mods.forEach((m) => { if (/^(\d+-)?(core|app|main|init|inicializacao)$/i.test(semExt(m.path)) && m.papel !== 'tela') m.base = true; });
    const novos = mods.filter((m) => m.papel !== 'estilo' && !m.base).map((m) => { const limpo = semExt(m.path).replace(/^\d+[-_]/, ''); const nm = 'js/' + String(n).padStart(2, '0') + '-' + slug(limpo === 'index' ? m.path.split('/').slice(-2, -1)[0] || 'inicio' : limpo) + '.js'; n = Math.min(98, n + (n < 90 ? 5 : 1)); return Object.assign(m, { novo: nm }); });
    const titulo = (todos.find((a) => /(^|\/)index\.html?$/i.test(a.path) && a.text) || {}).text;
    const tituloApp = (titulo && (titulo.match(/<title[^>]*>([^<]{2,80})/i) || [])[1]) || nome;

    const L = [];
    L.push('# 🧬 Receita para recriar: ' + tituloApp, '', '_Gerada sem IA, lendo ' + todos.length + ' arquivo(s). Serve para remontar este app como HTML modular — com qualquer IA, um arquivo por vez._', '');
    L.push('## 1. O que é', '', '- **Nome:** ' + tituloApp, '- **Partes de código:** ' + mods.length + ' (' + ['tela', 'logica', 'servidor', 'dados', 'estilo'].map((p) => mods.filter((m) => m.papel === p).length + ' ' + p).join(', ') + ')',
      '- **Tem servidor (rotas /api):** ' + (temServidor ? 'sim — veja o passo do servidor' : 'não — dá para ser só HTML'), '- **Peças de fora (bibliotecas):** ' + (pacotes.length ? pacotes.slice(0, 30).join(', ') + (pacotes.length > 30 ? '…' : '') : 'nenhuma'), '');
    L.push('## 2. Estrutura modular proposta', '', '```', 'index.html            ← a página; chama os módulos NA ORDEM', 'css/app.css           ← o visual', 'js/00-core.js         ← a "locomotiva": cria window.APP (registrar, guardar, avisar)');
    novos.forEach((m) => L.push(m.novo.padEnd(22) + '← ' + (m.desc || m.papel).slice(0, 70) + ' (era ' + m.path + ')'));
    L.push('js/99-app.js          ← o último: monta a tela com o que embarcou', '```', '');
    L.push('## 3. As partes, uma por uma', '');
    L.push('| # | Era | Vira | Tipo | O que faz | Usa |', '|---|---|---|---|---|---|');
    mods.forEach((m, i) => L.push('| ' + (i + 1) + ' | `' + m.path + '` | ' + (m.novo ? '`' + m.novo + '`' : 'css/app.css') + ' | ' + m.papel + ' | ' + (m.desc || (m.itens.slice(0, 4).join(', ') || '—')).replace(/\|/g, '/').slice(0, 90) + ' | ' + (m.usa.filter((u) => !u.startsWith('📦')).map(base).slice(0, 4).join(', ') || '—') + ' |'));
    L.push('');
    L.push('## 4. Montar passo a passo (cada bloco é um pedido pronto: 📋 Copiar → colar na IA)', '');
    L.push('### Passo 0 — combinar as regras com a IA', '', '```text',
      'Vamos recriar o app "' + tituloApp + '" como HTML MODULAR, que abre pelo index.html, sem servidor e sem nada da Replit.',
      'Regras: (1) index.html chama os arquivos js/ na ordem, antes do </body>; (2) js/00-core.js cria window.APP com APP.registrar(modulo), APP.guardar(chave, valor) em IndexedDB/localStorage e APP.avisar(texto); (3) cada arquivo js/NN-nome.js cuida de UM assunto, começa com (function (APP) { e termina com })(window.APP); (4) js/99-app.js vem por último e monta a tela com os módulos registrados; (5) textos em português do Brasil.',
      'Vou pedir UM arquivo por vez. Responda só com o arquivo completo, sem cortar nada. Primeiro: crie index.html, css/app.css e js/00-core.js.', '```', '');
    let passo = 1;
    for (const m of novos) {
      const deps = m.usa.filter((u) => !u.startsWith('📦')).map((u) => (novos.find((x) => x.path === u) || {}).novo).filter(Boolean);
      const libs = m.usa.filter((u) => u.startsWith('📦')).map((u) => u.replace('📦 ', ''));
      L.push('### Passo ' + passo++ + ' — `' + m.novo + '` (era `' + m.path + '`, ' + m.linhas + ' linhas)', '', '```text');
      L.push(...['Crie ' + m.novo + '. ' + (m.desc ? 'Ele faz: ' + m.desc + '.' : 'Ele é uma parte de ' + m.papel + ' do app.'),
        m.itens.length ? 'No app original ele tinha estas funções/partes: ' + m.itens.join(', ') + '.' : '',
        deps.length ? 'Ele usa o que já foi criado em: ' + deps.join(', ') + ' (pelo APP).' : '',
        libs.length ? 'O original usava as bibliotecas ' + libs.join(', ') + ': em HTML puro, use a versão de CDN (ou faça sem ela, se for simples).' : '',
        m.rotas.length ? 'No original isto era SERVIDOR com as rotas ' + m.rotas.join(', ') + '. Em HTML, troque por funções que guardam no aparelho (APP.guardar) ou que chamam a IA direto.' : '',
        m.chamadas.length ? 'Ele chamava estes endereços: ' + m.chamadas.join(', ') + '. Em HTML, ligue cada um à função equivalente do módulo certo.' : '',
        'Registre com APP.registrar({ nome, icone, abrir }). Devolva só o arquivo completo.'].filter(Boolean), '```', '');
    }
    L.push('### Passo ' + passo++ + ' — `js/99-app.js` e conferir', '', '```text', 'Crie js/99-app.js: ele olha APP.modulos e monta o menu/abas com um botão para cada módulo. Depois, me mande o index.html atualizado com todos os <script src="js/…"> na ordem certa: ' + ['js/00-core.js'].concat(novos.map((m) => m.novo), ['js/99-app.js']).join(', ') + '.', '```', '');
    L.push('## 5. Conferir no final', '', '- [ ] Abrir o index.html na prévia: aparece a tela sem erro (▤ console vazio)?', '- [ ] Cada botão abre a sua parte?', '- [ ] Fechar e abrir de novo: os dados continuam?', '- [ ] Nada com "replit", "REPL_", "@workspace" no código (🏗️ Preparar confere).', '- [ ] 📱 PWA → deixar instalável; 📦 APK ou 🖥️ .exe.', '');

    // esqueleto
    const esq = [];
    const scripts = ['js/00-core.js'].concat(novos.map((m) => m.novo), ['js/99-app.js']);
    esq.push({ path: 'index.html', text: '<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>' + tituloApp + '</title>\n  <link rel="stylesheet" href="css/app.css">\n</head>\n<body>\n  <header><h1>' + tituloApp + '</h1></header>\n  <nav id="menu"></nav>\n  <main id="tela"></main>\n  <div id="aviso"></div>\n\n  <!-- os módulos, NA ORDEM (00 primeiro, 99 por último) -->\n' + scripts.map((s) => '  <script src="' + s + '"></script>').join('\n') + '\n</body>\n</html>\n' });
    esq.push({ path: 'css/app.css', text: 'body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#f4f5f7;color:#1d2330}\nheader{padding:12px 16px;background:#1d2a3a;color:#fff}header h1{margin:0;font-size:20px}\n#menu{display:flex;gap:6px;flex-wrap:wrap;padding:10px}#menu button{padding:8px 12px;border:1px solid #ccd;border-radius:8px;background:#fff;cursor:pointer}\n#tela{padding:12px 16px}#aviso{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:8px 14px;border-radius:8px;display:none}\n' });
    esq.push({ path: 'js/00-core.js', text: '// js/00-core.js — A LOCOMOTIVA: cria o caixa comum APP (vem primeiro)\nwindow.APP = {\n  modulos: [],\n  registrar(m) { this.modulos.push(m); },\n  guardar(chave, valor) { try { localStorage.setItem("app:" + chave, JSON.stringify(valor)); } catch (e) {} },\n  ler(chave, padrao) { try { const v = localStorage.getItem("app:" + chave); return v == null ? padrao : JSON.parse(v); } catch (e) { return padrao; } },\n  avisar(t) { const a = document.getElementById("aviso"); a.textContent = t; a.style.display = "block"; clearTimeout(this._t); this._t = setTimeout(() => (a.style.display = "none"), 3000); },\n};\n' });
    for (const m of novos) {
      const pedido = L.join('\n').split('### ').find((b) => b.includes('`' + m.novo + '`')) || '';
      esq.push({ path: m.novo, text: '/* ' + m.novo + ' — ' + (m.desc || m.papel) + '\n   (era ' + m.path + ')\n   A FAZER: peça este arquivo à IA com o pedido abaixo (está também na RECEITA.md).\n\n' + pedido.replace(/```(text)?/g, '').replace(/\*\//g, '* /').trim().split('\n').map((l) => '   ' + l).join('\n') + '\n*/\n(function (APP) {\n  APP.registrar({\n    nome: ' + JSON.stringify(semExt(m.path)) + ',\n    icone: "🧩",\n    abrir(tela) { tela.innerHTML = "<p>' + semExt(m.path).replace(/"/g, '') + ': ainda em construção.</p>"; },\n  });\n})(window.APP);\n' });
    }
    esq.push({ path: 'js/99-app.js', text: '// js/99-app.js — O ÚLTIMO: monta o menu com os módulos que embarcaram\n(function (APP) {\n  const menu = document.getElementById("menu"), tela = document.getElementById("tela");\n  APP.modulos.forEach((m) => { const b = document.createElement("button"); b.textContent = (m.icone || "🧩") + " " + m.nome; b.onclick = () => m.abrir(tela); menu.appendChild(b); });\n  if (APP.modulos[0]) APP.modulos[0].abrir(tela);\n})(window.APP);\n' });
    const md = L.filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n');
    esq.push({ path: 'RECEITA.md', text: md });
    return { md, esqueleto: esq, modulos: mods, titulo: tituloApp };
  }
  G.ReceitaProjeto = { gerar };
})(typeof window !== 'undefined' ? window : globalThis);
