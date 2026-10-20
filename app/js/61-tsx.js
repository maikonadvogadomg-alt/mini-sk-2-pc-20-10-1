/* =========================================================================
   Mini SK — 61-tsx.js
   ⚛️ Prévia de UM componente .tsx / .jsx (do jeito dos sites de "playground"):
   - traduz o TSX para JavaScript (Babel, baixado uma vez da internet);
   - segue os imports do próprio projeto (./x, ../x, @/x) e traduz também;
   - peças de fora (lucide-react, framer-motion…) vêm do esm.sh;
   - react-native vira react-native-web (dá para ver telas do Expo, em parte);
   - Tailwind já vem ligado, para as classes aparecerem com cor;
   - mostra o componente "export default" (ou o primeiro com letra maiúscula).
   Não roda o projeto inteiro: é para ver UM pedaço. Se o pedaço depende de um
   "Provider" (contexto) de fora, o erro aparece explicado.
   SK.tsx.montar(caminho, { mk, shim }) → Promise<html>
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const BABEL = 'https://cdn.jsdelivr.net/npm/@babel/standalone@7.26.4/babel.min.js';
  const REACT = '18.3.1';
  const EXT = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
  let babelP = null;

  function carregarBabel() {
    if (window.Babel) return Promise.resolve(window.Babel);
    if (babelP) return babelP;
    babelP = new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = BABEL; s.async = true;
      s.onload = () => (window.Babel ? ok(window.Babel) : falha(new Error('O tradutor de TSX não carregou')));
      s.onerror = () => { babelP = null; falha(new Error('Sem internet para baixar o tradutor de TSX (só precisa da primeira vez).')); };
      document.head.appendChild(s);
    });
    return babelP;
  }

  // acha o arquivo do projeto que um import aponta
  function acharArquivo(deDir, spec) {
    const tentar = (base) => { for (const e of EXT) { const p = fs().norm(base + e); if (p && fs().exists(p)) return p; } return null; };
    if (spec.startsWith('.') || spec.startsWith('/')) return tentar(spec.startsWith('/') ? spec : (deDir ? deDir + '/' : '') + spec);
    const m = spec.match(/^[@~#]\/(.*)$/);  // @/components/x , ~/x , #/x
    if (m) {
      const resto = m[1];
      for (const raiz of ['src', 'client/src', 'app', '.', 'frontend/src', 'web/src']) { const r = tentar((raiz === '.' ? '' : raiz + '/') + resto); if (r) return r; }
      const fim = '/' + resto; // último recurso: qualquer pasta que termine assim
      const achado = fs().list().find((f) => !/node_modules\//.test(f) && EXT.some((e) => e && f.endsWith(fim + e)));
      return achado || null;
    }
    return null;
  }
  const deFora = (spec) => {
    if (spec === 'react-native') return 'https://esm.sh/react-native-web@0.19.13?external=react,react-dom';
    return 'https://esm.sh/' + spec + (spec.startsWith('react') && /^react(-dom)?(\/|$)/.test(spec) ? '' : '?external=react,react-dom');
  };

  async function montar(entrada, ajuda) {
    const Babel = await carregarBabel();
    const feitos = new Map();     // caminho → url
    const emAndamento = new Set();
    const avisos = [];

    function urlDe(caminho) {
      if (feitos.has(caminho)) return feitos.get(caminho);
      if (emAndamento.has(caminho)) { avisos.push('Importação circular em ' + caminho + ' (pode faltar algo).'); return ajuda.mk('export {};', 'text/javascript'); }
      emAndamento.add(caminho);
      let url;
      const r = fs().get(caminho);
      if (/\.css$/i.test(caminho)) url = ajuda.mk('const s=document.createElement("style");s.textContent=' + JSON.stringify(fs().read(caminho) || '') + ';document.head.appendChild(s);export default {};', 'text/javascript');
      else if (/\.json$/i.test(caminho)) url = ajuda.mk('export default ' + (fs().read(caminho) || 'null') + ';', 'text/javascript');
      else if (/\.(png|jpe?g|gif|webp|svg|ico|avif|mp3|wav|mp4|woff2?)$/i.test(caminho)) url = ajuda.mk('export default ' + JSON.stringify(ajuda.arquivo(caminho)) + ';', 'text/javascript');
      else {
        const dir = fs().dirName(caminho);
        let codigo;
        try {
          codigo = Babel.transform(fs().read(caminho) || '', {
            filename: caminho,
            presets: [['typescript', { isTSX: !/\.ts$/i.test(caminho), allExtensions: true, onlyRemoveTypeImports: false }], ['react', { runtime: 'automatic' }]],
            sourceType: 'module', retainLines: true,
          }).code;
        } catch (e) { emAndamento.delete(caminho); throw new Error('Erro de escrita em ' + caminho + ': ' + e.message.split('\n')[0]); }
        // troca cada import pelo endereço certo
        codigo = codigo.replace(/(\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|\bexport\s*(?:\*|\{[^}]*\})\s*from\s*|\bimport\s*\(\s*)(["'])([^"']+)\2/g, (todo, antes, q, spec) => {
          if (/^(https?:|data:|blob:)/.test(spec)) return todo;
          if (/^react(-dom)?(\/|$)/.test(spec)) return todo; // fica com o mapa (um React só)
          const local = acharArquivo(dir, spec);
          if (local) return antes + q + urlDe(local) + q;
          if (/^[./]/.test(spec)) { avisos.push('Não achei "' + spec + '" (pedido por ' + caminho + ').'); return antes + q + ajuda.mk('export default {};', 'text/javascript') + q; }
          if (/^[@~#]\//.test(spec)) { avisos.push('Não achei "' + spec + '" (pedido por ' + caminho + ').'); return antes + q + ajuda.mk('export default {};', 'text/javascript') + q; }
          return antes + q + deFora(spec) + q;
        });
        url = ajuda.mk(codigo, 'text/javascript');
      }
      emAndamento.delete(caminho);
      feitos.set(caminho, url);
      return url;
    }

    const principal = urlDe(entrada);
    // CSS do projeto que costuma ser global (index.css, globals.css)
    const globais = fs().list().filter((f) => /(^|\/)(index|globals?|app|main|styles?)\.css$/i.test(f) && !/node_modules\//.test(f)).slice(0, 3);
    const css = globais.map((f) => '<style>/* ' + f + ' */\n' + (fs().read(f) || '').replace(/^@tailwind[^;]*;|^@import[^;]*;|^@apply[^;]*;/gm, '') + '</style>').join('\n');
    const mapa = { imports: {
      react: 'https://esm.sh/react@' + REACT, 'react/': 'https://esm.sh/react@' + REACT + '/',
      'react-dom': 'https://esm.sh/react-dom@' + REACT, 'react-dom/': 'https://esm.sh/react-dom@' + REACT + '/',
    } };
    const nome = fs().baseName(entrada);
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      ajuda.shim +
      '<script type="importmap">' + JSON.stringify(mapa) + '<\/script>' +
      '<script src="https://cdn.tailwindcss.com/3.4.17"><\/script>' +
      css +
      '<style>body{margin:0;font-family:system-ui,sans-serif}#sk-aviso{font:13px/1.4 system-ui;padding:8px 12px;background:#fff7e0;color:#5a4300;border-bottom:1px solid #f0d58a}#sk-erro{font:14px/1.5 system-ui;padding:12px;margin:12px;border-radius:8px;background:#fdecea;color:#7a1a12;white-space:pre-wrap}</style>' +
      '</head><body>' +
      (avisos.length ? '<div id="sk-aviso">⚠️ ' + avisos.map((a) => SK.esc(a)).join('<br>⚠️ ') + '</div>' : '') +
      '<div id="root"></div><div id="app"></div>' +
      '<script type="module">\n' +
      'import React from "react";\nimport { createRoot } from "react-dom/client";\n' +
      'const mostrarErro = (e) => { const d = document.createElement("div"); d.id = "sk-erro"; let t = String(e && e.message || e);' +
      ' if (/must be used within|Provider|useContext|Cannot read properties of (null|undefined)/i.test(t)) t += "\\n\\n💡 Este pedaço depende de outro que fica por fora (um Provider/contexto). Abra o App.tsx ou o main.tsx para ver tudo junto.";' +
      ' d.textContent = "❌ " + t; document.body.appendChild(d); console.error(t); };\n' +
      'class Guarda extends React.Component { constructor(p){super(p);this.state={e:null}} static getDerivedStateFromError(e){return{e}} componentDidCatch(e){mostrarErro(e)} render(){return this.state.e?null:this.props.children} }\n' +
      'try {\n' +
      '  const M = await import(' + JSON.stringify(principal) + ');\n' +
      '  const nomes = Object.keys(M);\n' +
      '  const C = typeof M.default === "function" || (M.default && M.default.$$typeof) ? M.default : nomes.map((k) => M[k]).find((v) => typeof v === "function" && /^[A-Z]/.test(v.name || ""));\n' +
      '  const raiz = document.getElementById("root");\n' +
      '  if (C) { if (!raiz.hasChildNodes()) createRoot(raiz).render(React.createElement(Guarda, null, React.createElement(C))); }\n' +
      '  else if (!raiz.hasChildNodes() && !document.getElementById("app").hasChildNodes()) { raiz.innerHTML = "<p style=\\"padding:12px;color:#555\\">' + SK.esc(nome) + ' rodou, mas não exporta nenhum componente para mostrar.</p>"; }\n' +
      '} catch (e) { mostrarErro(e); }\n' +
      '<\/script></body></html>';
  }

  SK.tsx = { montar, carregarBabel, acharArquivo };
})(window.SK);
