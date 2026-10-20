/* Picotador — 30-mensagens.js: escolher a conversa, marcar só o pedaço que quer,
   dividir em partes e baixar como memória do Mini SK, texto (.md) ou os códigos (.zip). */
(function (PT) {
  'use strict';
  const EXT = { js: 'js', javascript: 'js', jsx: 'jsx', ts: 'ts', typescript: 'ts', tsx: 'tsx', html: 'html', css: 'css', json: 'json', py: 'py', python: 'py', sh: 'sh', bash: 'sh', md: 'md', markdown: 'md', yml: 'yml', yaml: 'yml', bat: 'bat', sql: 'sql', xml: 'xml', java: 'java', kt: 'kt', php: 'php' };
  const tokens = (n) => Math.round(n / 4);

  // ── lista de conversas (exportação do ChatGPT/Claude tem muitas) ──
  PT.mostrarConversas = () => {
    const el = PT.$('#tela-conversas'); el.hidden = false;
    const cs = PT.estado.conversas;
    el.innerHTML = '<h2>💬 ' + cs.length + ' conversa(s)</h2><p class="muted pequeno">Toque numa conversa para abrir e picotar.</p>' +
      '<input type="search" id="cv-busca" placeholder="🔎 Procurar pelo título…" style="width:100%">' +
      '<div class="lista" id="cv-lista" style="margin-top:8px"></div>';
    const pintar = () => {
      const q = PT.$('#cv-busca', el).value.trim().toLowerCase();
      PT.$('#cv-lista', el).innerHTML = cs.map((c, i) => ({ c, i })).filter(({ c }) => !q || c.titulo.toLowerCase().includes(q)).slice(0, 500).map(({ c, i }) =>
        '<button class="item btn" data-c="' + i + '" style="text-align:left;justify-content:flex-start"><div class="corpo"><div class="num">' + PT.esc(c.titulo) + '</div><div class="topo"><span class="chip">' + c.mensagens.length + ' mensagens</span><span class="chip">' + PT.kb(c.mensagens.reduce((s, m) => s + m.content.length, 0)) + '</span>' + (c.data ? '<span>' + new Date(c.data).toLocaleDateString('pt-BR') + '</span>' : '') + '</div></div></button>').join('');
    };
    PT.$('#cv-busca', el).oninput = pintar; pintar();
    el.onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) PT.abrirConversa(cs[+b.dataset.c]); };
  };

  // ── códigos que estão dentro da conversa → arquivos de volta ──
  PT.codigos = (mensagens) => {
    const arqs = new Map(); let n = 0;
    mensagens.forEach((m, im) => {
      const re = /```([^\n`]*)\n([\s\S]*?)```/g; let r;
      while ((r = re.exec(m.content))) {
        const info = r[1].trim(), cod = r[2];
        let nome = (/(?:filepath|arquivo|file)\s*[:=]\s*([^\s`]+)/i.exec(info) || [])[1] ||
          (/^\s*(?:\/\/|#|<!-{2}|\/\*|REM)\s*(?:arquivo|file|filepath)\s*:\s*([^\s*>]+)/im.exec(cod.split('\n')[0]) || [])[1] ||
          (/^[\w./-]+\.\w{1,6}$/.test(info) ? info : '');
        if (!nome) { n++; const lang = info.split(/\s+/)[0].toLowerCase(); nome = 'sem-nome/bloco-' + String(n).padStart(3, '0') + '-msg' + (im + 1) + '.' + (EXT[lang] || 'txt'); }
        arqs.set(nome.replace(/^\.?\/+/, ''), cod); // o mesmo arquivo de novo: fica a versão mais nova
      }
    });
    return arqs;
  };
  const paraMD = (titulo, mensagens, diario) => '# ' + titulo + '\n\n' + (diario ? '## 📔 Diário do projeto\n\n' + diario + '\n\n---\n\n' : '') +
    mensagens.map((m) => '### ' + (m.role === 'user' ? '👤 Você' : '🤖 IA') + '\n' + m.content + '\n\n---\n').join('\n');
  const paraMemoria = (titulo, mensagens, diario) => JSON.stringify({ app: 'minisk-memoria', versao: 1, projeto: titulo, criado: new Date().toISOString(), historico: mensagens.map((m) => ({ role: m.role, content: m.content })), diario: diario || '' }, null, 1);

  // ── uma conversa: marcar, cortar, dividir ──
  PT.abrirConversa = (conversa, deProjeto) => {
    const E = PT.estado; E.atual = { conversa, deProjeto: deProjeto || null };
    const el = PT.$('#tela-mensagens'); el.hidden = false;
    const ms = conversa.mensagens, marc = new Set(ms.map((_, i) => i));
    el.innerHTML =
      '<h2>✂️ ' + PT.esc(conversa.titulo) + '</h2>' +
      '<p class="muted pequeno">' + PT.esc(conversa.origem) + ' · ' + ms.length + ' mensagens · ' + PT.kb(ms.reduce((s, m) => s + m.content.length, 0)) + '. Todas começam marcadas: desmarque o que <b>não</b> quer levar, ou marque só um trecho.</p>' +
      (conversa.diario ? '<details><summary>📔 Diário do projeto (' + PT.kb(conversa.diario.length) + ')</summary><div class="diario">' + PT.esc(conversa.diario) + '</div></details><label class="linha"><input type="checkbox" id="ms-diario" checked> Levar o diário junto</label>' : '') +
      '<div class="linha"><button class="btn peq" data-a="todas">☑ Todas</button><button class="btn peq" data-a="nenhuma">☐ Nenhuma</button><button class="btn peq" data-a="inverter">⇄ Inverter</button></div>' +
      '<div class="linha">Da nº <input type="number" id="ms-de" min="1" max="' + ms.length + '" value="1"> até a nº <input type="number" id="ms-ate" min="1" max="' + ms.length + '" value="' + ms.length + '"><button class="btn peq" data-a="trecho">✓ Só esse trecho</button></div>' +
      '<div class="linha">As últimas <input type="number" id="ms-ult" min="1" value="' + Math.min(40, ms.length) + '"><button class="btn peq" data-a="ultimas">✓ Só as últimas</button></div>' +
      '<div class="linha"><input type="search" id="ms-q" placeholder="palavra (ex.: playground, login…)" style="flex:1;min-width:160px"><button class="btn peq" data-a="falam">🔎 Só as que falam disso</button></div>' +
      '<div class="lista" id="ms-lista"></div>' +
      '<div class="resumo"><div class="muted pequeno" id="ms-resumo"></div>' +
      '<div class="linha"><button class="btn primario" data-a="memoria">🧠 Memória para o Mini SK (.json)</button><button class="btn" data-a="md">📄 Texto (.md)</button><button class="btn" data-a="codigos">🧩 Códigos da conversa (.zip)</button></div>' +
      '<div class="linha">✂️ Dividir as marcadas em partes de <input type="number" id="ms-parte" min="2" value="40"> mensagens <button class="btn peq" data-a="dividir">Dividir</button></div>' +
      (PT.miniSK ? '<div class="linha"><button class="btn primario" data-a="sk-memoria" title="A conversa marcada vira a memória da 🤖 IA do projeto que está aberto no Mini SK">📥 Pôr como memória do projeto aberto</button>' + (deProjeto ? '<button class="btn" data-a="sk-devolver">📥 Trazer o projeto com a memória cortada</button>' : '') + '</div>' : '') +
      (deProjeto ? '<div class="linha"><button class="btn" data-a="devolver" title="Gera o projeto de volta com a memória só com as marcadas">💾 Pôr a memória cortada de volta no projeto</button></div>' : '') +
      '<div id="ms-partes"></div></div>';
    const lista = PT.$('#ms-lista', el);
    lista.innerHTML = ms.map((m, i) => '<div class="item marcado" data-i="' + i + '"><input type="checkbox" checked aria-label="Mensagem ' + (i + 1) + '"><div class="corpo"><div class="topo"><span class="num">nº ' + (i + 1) + '</span><span class="chip">' + (m.role === 'user' ? '👤 Você' : '🤖 IA') + '</span><span>' + PT.kb(m.content.length) + '</span>' + (/```/.test(m.content) ? '<span class="chip">🧩 tem código</span>' : '') + '</div><div class="previa">' + PT.esc(m.content.slice(0, 1200)) + (m.content.length > 1200 ? '…' : '') + '</div></div></div>').join('');
    const itens = PT.$$('.item', lista);
    const pintar = () => {
      itens.forEach((it, i) => { const on = marc.has(i); it.classList.toggle('marcado', on); it.firstChild.checked = on; });
      const sel = [...marc].sort((a, b) => a - b), tam = sel.reduce((s, i) => s + ms[i].content.length, 0);
      PT.$('#ms-resumo', el).textContent = sel.length + ' de ' + ms.length + ' marcadas · ' + PT.kb(tam) + ' · cerca de ' + tokens(tam).toLocaleString('pt-BR') + ' tokens' + (sel.length ? ' · da nº ' + (sel[0] + 1) + ' à nº ' + (sel[sel.length - 1] + 1) : '');
    };
    pintar();
    lista.onclick = (e) => {
      const it = e.target.closest('.item'); if (!it) return;
      const i = +it.dataset.i;
      if (e.target.matches('input')) { e.target.checked ? marc.add(i) : marc.delete(i); pintar(); return; }
      it.classList.toggle('aberto'); // tocar no texto abre a mensagem inteira
      const pv = PT.$('.previa', it); if (it.classList.contains('aberto')) pv.textContent = ms[i].content; else pv.textContent = ms[i].content.slice(0, 1200) + (ms[i].content.length > 1200 ? '…' : '');
    };
    const escolhidas = () => [...marc].sort((a, b) => a - b).map((i) => ms[i]);
    const diario = () => { const c = PT.$('#ms-diario', el); return conversa.diario && (!c || c.checked) ? conversa.diario : ''; };
    const base = PT.nomeSeguro(conversa.titulo);
    el.onclick = async (e) => {
      const b = e.target.closest('button[data-a]'); if (!b || b.closest('#ms-lista')) return;
      const a = b.dataset.a, num = (id) => Math.max(1, Math.min(ms.length, parseInt(PT.$(id, el).value, 10) || 1));
      try {
        if (a === 'todas') ms.forEach((_, i) => marc.add(i));
        else if (a === 'nenhuma') marc.clear();
        else if (a === 'inverter') ms.forEach((_, i) => marc.has(i) ? marc.delete(i) : marc.add(i));
        else if (a === 'trecho') { const de = num('#ms-de'), ate = Math.max(de, num('#ms-ate')); marc.clear(); for (let i = de - 1; i < ate; i++) marc.add(i); }
        else if (a === 'ultimas') { const n = Math.max(1, parseInt(PT.$('#ms-ult', el).value, 10) || 1); marc.clear(); for (let i = Math.max(0, ms.length - n); i < ms.length; i++) marc.add(i); }
        else if (a === 'falam') { const q = PT.$('#ms-q', el).value.trim().toLowerCase(); if (!q) return PT.aviso('Escreva a palavra primeiro.', 'erro'); marc.clear(); ms.forEach((m, i) => { if (m.content.toLowerCase().includes(q)) marc.add(i); }); PT.aviso(marc.size + ' mensagem(ns) falam de "' + q + '"'); }
        else {
          const sel = escolhidas(); if (!sel.length) return PT.aviso('Nenhuma mensagem marcada.', 'erro');
          if (a === 'memoria') PT.saida('memoria-' + base + '-' + sel.length + 'msg-' + PT.hoje() + '.json', paraMemoria(conversa.titulo, sel, diario()), 'application/json');
          else if (a === 'md') PT.saida(base + '-' + sel.length + 'msg.md', paraMD(conversa.titulo, sel, diario()), 'text/markdown');
          else if (a === 'codigos') {
            const arqs = PT.codigos(sel); if (!arqs.size) return PT.aviso('Não achei blocos de código (```) nas mensagens marcadas.', 'erro');
            const z = new JSZip(); for (const [n, c] of arqs) z.file(n, c);
            z.file('LEIA-ME-CODIGOS.md', '# Códigos tirados da conversa "' + conversa.titulo + '"\n\n' + arqs.size + ' arquivo(s). Quando o mesmo arquivo aparece mais de uma vez, ficou a versão MAIS NOVA.\nOs blocos sem nome de arquivo estão em sem-nome/ (o número da mensagem está no nome).\n\n' + [...arqs.keys()].map((k) => '- ' + k).join('\n') + '\n');
            PT.saida(base + '-codigos.zip', await z.generateAsync({ type: 'blob', compression: 'DEFLATE' }), 'application/zip');
          }
          else if (a === 'dividir') {
            const n = Math.max(2, parseInt(PT.$('#ms-parte', el).value, 10) || 40), partes = [];
            for (let i = 0; i < sel.length; i += n) partes.push(sel.slice(i, i + n));
            const caixa = PT.$('#ms-partes', el);
            caixa.innerHTML = '<p class="muted pequeno">' + partes.length + ' parte(s). Cada uma abre no Mini SK em 🤖 IA → 📥 Trazer memória.' + (diario() ? ' O diário vai só na 1ª parte.' : '') + '</p><div class="linha">' +
              partes.map((p, k) => '<button class="btn peq" data-parte="' + k + '">🧠 Parte ' + (k + 1) + ' (' + p.length + ')</button>').join('') + '</div>' +
              '<div class="linha"><button class="btn peq" data-partes-md>📄 Todas as partes em texto (.zip)</button></div>';
            caixa.onclick = async (ev) => {
              ev.stopPropagation();
              const pb = ev.target.closest('[data-parte]');
              if (pb) { const k = +pb.dataset.parte; PT.saida('memoria-' + base + '-parte-' + String(k + 1).padStart(2, '0') + '-de-' + partes.length + '.json', paraMemoria(conversa.titulo + ' (parte ' + (k + 1) + '/' + partes.length + ')', partes[k], k === 0 ? diario() : ''), 'application/json'); return; }
              if (ev.target.closest('[data-partes-md]')) { const z = new JSZip(); partes.forEach((p, k) => z.file(base + '-parte-' + String(k + 1).padStart(2, '0') + '.md', paraMD(conversa.titulo + ' (parte ' + (k + 1) + '/' + partes.length + ')', p, k === 0 ? diario() : ''))); PT.saida(base + '-partes.zip', await z.generateAsync({ type: 'blob', compression: 'DEFLATE' }), 'application/zip'); }
            };
            caixa.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          else if (a === 'sk-memoria') await PT.miniSK.porMemoria(sel.map((m) => ({ role: m.role, content: m.content })), diario(), conversa.titulo);
          else if (a === 'sk-devolver') await PT.miniSK.trazerProjetos([PT.projetoComMemoria(deProjeto.indice, sel.map((m) => ({ role: m.role, content: m.content })), conversa.diario ? diario() : null)]);
          else if (a === 'devolver') await PT.devolverMemoria(deProjeto.indice, sel.map((m) => ({ role: m.role, content: m.content })), conversa.diario ? diario() : null);
          return;
        }
        pintar();
      } catch (er) { PT.aviso('Erro: ' + er.message, 'erro'); }
    };
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
})(window.PT);
