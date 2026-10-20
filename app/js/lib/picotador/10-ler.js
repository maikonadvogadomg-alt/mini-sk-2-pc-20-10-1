/* Picotador — 10-ler.js: descobre o que é o arquivo e transforma tudo num formato só.
   Conversa = { titulo, data, origem, mensagens: [{ role: 'user'|'assistant', content }], diario }
   Projeto  = { name, files: { caminho: { text } | { b64 } }, folders: [] , ...resto do Mini SK } */
(function (PT) {
  'use strict';
  const ehMsg = (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';

  // ChatGPT: cada conversa tem um "mapa" de mensagens; seguimos do fim até o começo
  function doChatGPT(c) {
    const mapa = c.mapping || {}; let no = c.current_node; const ida = [];
    if (!no || !mapa[no]) { const folhas = Object.keys(mapa).filter((k) => !(mapa[k].children || []).length); no = folhas[folhas.length - 1]; }
    const vistos = new Set();
    while (no && mapa[no] && !vistos.has(no)) {
      vistos.add(no);
      const m = mapa[no].message;
      if (m && m.author && (m.author.role === 'user' || m.author.role === 'assistant') && m.content) {
        let t = '';
        if (Array.isArray(m.content.parts)) t = m.content.parts.map((p) => typeof p === 'string' ? p : (p && p.text) || '').filter(Boolean).join('\n');
        else if (typeof m.content.text === 'string') t = m.content.text;
        if (t.trim()) ida.push({ role: m.author.role, content: t, quando: m.create_time ? new Date(m.create_time * 1000).toISOString() : undefined });
      }
      no = mapa[no].parent;
    }
    return { titulo: c.title || 'Conversa do ChatGPT', data: c.create_time ? new Date(c.create_time * 1000).toISOString() : '', origem: 'ChatGPT', mensagens: ida.reverse() };
  }
  // Claude: lista "chat_messages" com sender human/assistant
  function doClaude(c) {
    const msgs = (c.chat_messages || []).map((m) => {
      let t = typeof m.text === 'string' && m.text.trim() ? m.text : '';
      if (!t && Array.isArray(m.content)) t = m.content.map((p) => (p && p.type === 'text' && p.text) || '').filter(Boolean).join('\n');
      return { role: m.sender === 'human' ? 'user' : 'assistant', content: t, quando: m.created_at };
    }).filter((m) => m.content.trim());
    return { titulo: c.name || 'Conversa do Claude', data: c.created_at || '', origem: 'Claude', mensagens: msgs };
  }
  // o .md que este Picotador mesmo gera volta a ser conversa
  function doMarkdown(texto, nome) {
    const partes = texto.split(/^### (👤 Você|🤖 IA)[^\n]*\n/m);
    const msgs = [];
    for (let i = 1; i < partes.length; i += 2) msgs.push({ role: partes[i].startsWith('👤') ? 'user' : 'assistant', content: partes[i + 1].replace(/\n---\n*$/, '').trim() });
    if (!msgs.length) return null;
    const t = (/^# (.+)$/m.exec(texto) || [])[1];
    return { titulo: t || nome, data: '', origem: 'texto do Picotador', mensagens: msgs };
  }
  function deJSON(d, nome) {
    if (d && d.app === 'minisk-memoria' && Array.isArray(d.historico)) return { tipo: 'conversas', conversas: [{ titulo: d.projeto || nome, data: d.criado || '', origem: 'memória do Mini SK', mensagens: d.historico.filter(ehMsg), diario: d.diario || '' }], explicar: '🧠 Memória do Mini SK — projeto "' + (d.projeto || '?') + '"' };
    if (d && d.app === 'mini-sk' && Array.isArray(d.projetos)) return { tipo: 'backup', backup: d, explicar: '💾 Backup de tudo do Mini SK — ' + d.projetos.length + ' projeto(s), de ' + (d.data ? new Date(d.data).toLocaleString('pt-BR') : '?') };
    if (Array.isArray(d) && d.length && d.every(ehMsg)) return { tipo: 'conversas', conversas: [{ titulo: nome, data: '', origem: 'memória (lista de mensagens)', mensagens: d }], explicar: '🧠 Memória (só as mensagens) — ' + d.length + ' mensagens' };
    if (Array.isArray(d) && d.some((c) => c && c.mapping)) return { tipo: 'conversas', conversas: d.filter((c) => c && c.mapping).map(doChatGPT), explicar: '💬 Conversas do ChatGPT — ' + d.length };
    if (Array.isArray(d) && d.some((c) => c && Array.isArray(c.chat_messages))) return { tipo: 'conversas', conversas: d.filter((c) => c && Array.isArray(c.chat_messages)).map(doClaude), explicar: '💬 Conversas do Claude — ' + d.length };
    if (d && d.mapping) return { tipo: 'conversas', conversas: [doChatGPT(d)], explicar: '💬 Uma conversa do ChatGPT' };
    if (d && Array.isArray(d.chat_messages)) return { tipo: 'conversas', conversas: [doClaude(d)], explicar: '💬 Uma conversa do Claude' };
    if (d && Array.isArray(d.messages) && d.messages.every(ehMsg)) return { tipo: 'conversas', conversas: [{ titulo: d.title || nome, data: '', origem: 'conversa', mensagens: d.messages }], explicar: '💬 Conversa — ' + d.messages.length + ' mensagens' };
    return null;
  }
  async function deZip(buf, nome) {
    const z = await JSZip.loadAsync(buf);
    const conv = Object.keys(z.files).find((k) => /(^|\/)conversations\.json$/.test(k));
    if (conv) { const r = deJSON(JSON.parse(await z.file(conv).async('string')), nome); if (r) { r.explicar += ' (de dentro do .zip)'; return r; } }
    // senão: é um projeto. Tira a pasta de cima se tudo estiver dentro de uma só.
    const nomes = Object.keys(z.files).filter((k) => !z.files[k].dir && !/(^|\/)__MACOSX\//.test(k));
    const topo = nomes.length && nomes.every((k) => k.includes('/') && k.split('/')[0] === nomes[0].split('/')[0]) ? nomes[0].split('/')[0] + '/' : '';
    const files = {};
    for (const k of nomes) {
      const rel = k.slice(topo.length); if (!rel) continue;
      const u8 = await z.file(k).async('uint8array');
      let texto = null;
      if (!/\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|otf|mp3|mp4|wav|apk|exe|wasm)$/i.test(rel)) { try { texto = new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch {} }
      files[rel] = texto != null ? { text: texto } : { b64: await z.file(k).async('base64'), enc: 'binário', size: u8.length };
    }
    const proj = { name: (topo.replace(/\/$/, '') || nome.replace(/\.zip$/i, '')), files, folders: [], updated: Date.now() };
    const temMem = !!files['.sk/memoria.json'];
    return { tipo: 'projeto', projeto: proj, explicar: '🗜 Projeto em .zip — ' + Object.keys(files).length + ' arquivos' + (temMem ? ' · tem memória da IA (.sk/memoria.json)' : ' · sem memória da IA (.sk)') };
  }
  PT.ler = async (arq) => {
    const nome = arq.name || 'arquivo';
    if (/\.zip$/i.test(nome)) return deZip(await arq.arrayBuffer(), nome);
    const texto = await arq.text();
    if (/\.(md|txt)$/i.test(nome)) { const c = doMarkdown(texto, nome); if (c) return { tipo: 'conversas', conversas: [c], explicar: '📄 Conversa em texto (feita por este Picotador)' }; throw new Error('Esse texto não tem as marcas "### 👤 Você / ### 🤖 IA". Só consigo ler o .md que o Picotador mesmo gera.'); }
    let d; try { d = JSON.parse(texto); } catch { throw new Error('Esse arquivo não é JSON nem .zip. Abra uma memória, um backup ou uma conversa baixada.'); }
    const r = deJSON(d, nome.replace(/\.json$/i, ''));
    if (!r) throw new Error('Não reconheci esse JSON. Ele não parece memória, backup ou conversa.');
    return r;
  };
  // memória de dentro de um projeto (.sk/memoria.json + .sk/diario.md)
  PT.memoriaDoProjeto = (p) => {
    let hist = [];
    try { const t = p.files['.sk/memoria.json'] && p.files['.sk/memoria.json'].text; const d = t ? JSON.parse(t) : []; hist = (Array.isArray(d) ? d : d.historico || []).filter(ehMsg); } catch {}
    const diario = (p.files['.sk/diario.md'] && p.files['.sk/diario.md'].text) || '';
    return { titulo: p.name, data: p.updated ? new Date(p.updated).toISOString() : '', origem: 'memória do projeto', mensagens: hist, diario };
  };
  PT.tamanhoProjeto = (p) => Object.values(p.files || {}).reduce((s, r) => s + ((r.text || r.b64 || '').length), 0);
})(window.PT);
