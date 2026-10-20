/* =========================================================================
   Mini SK — 80-ai.js
   IA para ajudar a escrever código.
   - Chaves: cole qualquer chave, o provedor é reconhecido sozinho
     (Groq gsk_, Gemini AIza, OpenAI sk-, Claude sk-ant-, OpenRouter sk-or-, xAI xai-).
   - "Buscar modelos": pega a lista ATUAL do provedor (nomes mudam com o tempo).
   - Memória por projeto: a conversa fica em .sk/memoria.json e as decisões em
     .sk/diario.md (a IA lê os dois a cada pergunta e não "esquece").
   - Controle de tokens: mostra quanto contexto vai junto e corta o mais antigo
     quando passa do limite que você escolheu.
   - Código que a IA devolve com "filepath:" vira botão "Aplicar no arquivo".
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const MEM = '.sk/memoria.json', DIARY = '.sk/diario.md';

  // ── Provedores ──────────────────────────────────────────────────────────────
  const PRESETS = [
    { id: 'groq', label: 'Groq (grátis)', prefix: 'gsk_', kind: 'openai', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', site: 'https://console.groq.com/keys' },
    { id: 'gemini', label: 'Google Gemini (tem grátis)', prefix: ['AIza', 'AQ.'], kind: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash', site: 'https://aistudio.google.com/apikey' },
    { id: 'openrouter', label: 'OpenRouter', prefix: 'sk-or-', kind: 'openai', base: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', site: 'https://openrouter.ai/keys' },
    { id: 'anthropic', label: 'Anthropic (Claude)', prefix: 'sk-ant-', kind: 'anthropic', base: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-5', site: 'https://console.anthropic.com/settings/keys' },
    { id: 'xai', label: 'xAI (Grok)', prefix: 'xai-', kind: 'openai', base: 'https://api.x.ai/v1', model: 'grok-3-mini', site: 'https://console.x.ai' },
    { id: 'perplexity', label: 'Perplexity', prefix: 'pplx-', kind: 'openai', base: 'https://api.perplexity.ai', model: 'sonar', site: 'https://www.perplexity.ai/settings/api' },
    { id: 'openai', label: 'OpenAI (GPT)', prefix: 'sk-', kind: 'openai', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', site: 'https://platform.openai.com/api-keys' },
    { id: 'monica', label: 'Monica (saldo de API, separado da assinatura)', prefix: '', kind: 'openai', base: 'https://openapi.monica.im/v1', model: 'claude-haiku-4-5', site: 'https://platform.monica.im' },
    { id: 'ollama', label: 'Ollama (no seu PC, grátis — sem chave)', prefix: '', kind: 'openai', base: 'http://127.0.0.1:11434/v1', model: 'llama3.2', site: 'https://ollama.com/download', semChave: true },
    { id: 'custom', label: 'Outro (compatível com OpenAI)', prefix: '', kind: 'openai', base: '', model: '', site: '' },
  ];
  const detect = (key) => { const k = String(key || '').trim(); return PRESETS.find((p) => [].concat(p.prefix || []).some((x) => x && k.startsWith(x))) || null; };

  let keys = SK.pref.get('aiKeys', []);         // [{id, preset, key, model, base}]
  let activeKey = SK.pref.get('aiActive', null);
  let ctxLimit = SK.pref.get('aiCtx', 24000);   // tokens de contexto enviados
  let freeMode = SK.pref.get('aiFree', false);  // chat livre (sem projeto)
  let speak = SK.pref.get('aiSpeak', false);
  let history = [];                              // [{role, content}]
  let busy = null;                               // AbortController
  let box, logEl, inputEl, meterEl;

  const saveKeys = () => { SK.pref.set('aiKeys', keys); SK.pref.set('aiActive', activeKey); };
  const current = () => keys.find((k) => k.id === activeKey) || keys[0] || null;
  let revezar = SK.pref.get('aiRevezar', true);
  let lastUsage = null; // tokens que o provedor informou no último pedido
  /** Provedor e modelo da chave escolhida (para o 💰 gasto). */
  function curInfo() {
    const k = current(); if (!k) return { preset: '', model: '' };
    const preset = PRESETS.find((p) => p.id === k.preset) || detect(k.key) || PRESETS[PRESETS.length - 1];
    return { preset: preset.id, model: k.model || preset.model || '' };
  }
  const tok = (s) => Math.ceil((s || '').length / 4);

  // ── Ajuste automático quando o modelo recusa um parâmetro ───────────────────
  function adjust(body, errText) {
    const t = (errText || '').toLowerCase();
    const p = JSON.parse(JSON.stringify(body));
    let changed = false;
    if (t.includes('max_completion_tokens') && 'max_tokens' in p) { p.max_completion_tokens = p.max_tokens; delete p.max_tokens; changed = true; }
    else if (/max_tokens|max_completion_tokens|output tokens|too large|exceeds|maximum/.test(t)) {
      const n = (t.match(/(?:at most|maximum(?: value)?(?: is| of| allowed)?:?|<=|less than or equal to|>)\s*(\d{3,6})/) || [])[1];
      for (const k of ['max_tokens', 'max_completion_tokens']) if (k in p) { if (n) p[k] = Number(n); else if (k === 'max_tokens' && p.system !== undefined) p[k] = 8192; else delete p[k]; changed = true; }
    }
    if (t.includes('temperature') && 'temperature' in p) { delete p.temperature; changed = true; }
    return changed ? p : null;
  }
  async function aiFetch(url, init) {
    let cur = init;
    for (let i = 0; i < 3; i++) {
      const r = await fetch(url, cur);
      if (r.ok || (r.status !== 400 && r.status !== 422)) return r;
      const txt = await r.clone().text().catch(() => '');
      let body; try { body = JSON.parse(cur.body); } catch { return r; }
      const fixed = adjust(body, txt);
      if (!fixed) return r;
      cur = Object.assign({}, cur, { body: JSON.stringify(fixed) });
    }
    return fetch(url, cur);
  }
  async function errorText(r) {
    const t = await r.text().catch(() => '');
    let m = t.slice(0, 400);
    try { const j = JSON.parse(t); m = (j.error && (j.error.message || j.error)) || j.message || m; } catch {}
    const hint = r.status === 401 || r.status === 403 ? ' — confira a chave.' : r.status === 404 ? ' — modelo não existe: toque em "Buscar modelos".' : r.status === 429 ? ' — limite de uso do provedor; espere um pouco.' : '';
    return 'Erro ' + r.status + ': ' + m + hint;
  }

  // Gemini: a chave pode ser AIza… (antiga) ou AQ.… (nova). O Google aceita a chave de 3 jeitos;
  // tentamos um por um e guardamos o que funcionou nesta chave.
  async function gFetch(k, url, init) {
    init = init || {};
    const modes = ['header', 'query', 'bearer'];
    if (k.gAuth && modes.includes(k.gAuth)) { modes.splice(modes.indexOf(k.gAuth), 1); modes.unshift(k.gAuth); }
    let lastErr;
    for (const m of modes) {
      const h = Object.assign({}, init.headers || {}); let u = url;
      if (m === 'header') h['x-goog-api-key'] = k.key.trim();
      else if (m === 'query') u += (u.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(k.key.trim());
      else h.Authorization = 'Bearer ' + k.key.trim();
      let r;
      try { r = await fetch(u, Object.assign({}, init, { headers: h })); } catch (e) { if (e.name === 'AbortError') throw e; lastErr = e; continue; }
      if (r.ok) { if (k.gAuth !== m) { k.gAuth = m; saveKeys(); } return r; }
      const txt = await r.clone().text().catch(() => '');
      lastErr = new Error(await errorText(r));
      if (!(r.status === 401 || r.status === 403 || /api[ _-]?key|auth|credential|permission|unauthenticated/i.test(txt))) throw lastErr;
    }
    throw new Error((lastErr && lastErr.message ? lastErr.message : 'falha') + ' — confira a chave do Gemini (AIza… ou AQ.…).');
  }
  function geminiBody(messages, system) {
    const merged = [];
    messages.forEach((m) => { const role = m.role === 'assistant' ? 'model' : 'user'; const last = merged[merged.length - 1]; if (last && last.role === role) last.parts[0].text += '\n\n' + m.content; else merged.push({ role, parts: [{ text: m.content }] }); });
    if (merged.length && merged[0].role !== 'user') merged.unshift({ role: 'user', parts: [{ text: '(continuação)' }] });
    return { contents: merged, systemInstruction: { parts: [{ text: system || '' }] }, generationConfig: { temperature: 0.4, maxOutputTokens: 16384 } };
  }

  async function listModels(k) {
    const preset = PRESETS.find((p) => p.id === k.preset) || detect(k.key) || PRESETS[PRESETS.length - 1];
    let names = [];
    if (preset.kind === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': k.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } });
      if (!r.ok) throw new Error(await errorText(r));
      names = ((await r.json()).data || []).map((m) => m.id);
    } else if (preset.kind === 'gemini') {
      const r = await gFetch(k, 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000');
      names = ((await r.json()).models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''));
    } else {
      const base = (k.base || preset.base).replace(/\/+$/, '');
      const r = await fetch(base + '/models', { headers: { Authorization: 'Bearer ' + (k.key || 'sem-chave') } });
      if (!r.ok) throw new Error(await errorText(r));
      const d = await r.json();
      names = (d.data || d.models || []).map((m) => m.id || m.name).filter(Boolean);
      if (preset.id === 'openai') names = names.filter((n) => /^(gpt-|o\d|chatgpt)/.test(n) && !/(audio|realtime|transcribe|tts|image|embedding|moderation|search)/.test(n));
    }
    // OpenRouter: os modelos grátis (":free") vêm primeiro
    return [...new Set(names)].sort((a, b) => (/:free$/.test(b) - /:free$/.test(a)) || a.localeCompare(b));
  }

  /** Envia a conversa. onText recebe o texto completo até agora (streaming). */
  async function chat(messages, system, onText, signal, kForcada) {
    const k = kForcada || current();
    if (!k || (!k.key && !(PRESETS.find((p) => p.id === k.preset) || {}).semChave)) throw new Error('Nenhuma chave de IA. Toque em ⚙️ Chaves e cole uma (Groq e Gemini têm opção grátis).');
    const preset = PRESETS.find((p) => p.id === k.preset) || detect(k.key) || PRESETS[PRESETS.length - 1];
    const model = k.model || preset.model;
    lastUsage = null;
    const U = { in: 0, out: 0, seen: false };
    const finish = (t) => { if (U.seen) lastUsage = { in: U.in, out: U.out }; return t; };
    if (preset.kind === 'anthropic') {
      const r = await aiFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'x-api-key': k.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model, max_tokens: 16000, system, messages, stream: true }),
      });
      if (!r.ok) throw new Error(await errorText(r));
      return finish(await readSSE(r, (j) => (j.type === 'content_block_delta' && j.delta && j.delta.text) || '', onText, (j) => {
        const u = (j.message && j.message.usage) || j.usage;
        if (u) { U.seen = true; if (u.input_tokens != null) U.in = u.input_tokens + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0); if (u.output_tokens != null) U.out = u.output_tokens; }
      }));
    }
    if (preset.kind === 'gemini') {
      const r = await gFetch(k, 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':streamGenerateContent?alt=sse', {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody(messages, system)),
      });
      return finish(await readSSE(r, (j) => ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).filter((x) => x.text && !x.thought).map((x) => x.text).join(''), onText, (j) => {
        const u = j.usageMetadata; if (u && u.promptTokenCount != null) { U.seen = true; U.in = u.promptTokenCount; U.out = (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0); }
      }));
    }
    const base = (k.base || preset.base).replace(/\/+$/, '');
    if (!base) throw new Error('Informe a URL base da API nesta chave.');
    const r = await aiFetch(base + '/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (k.key || 'sem-chave') },
      body: JSON.stringify(Object.assign({ model, messages: [{ role: 'system', content: system }].concat(messages), stream: true, max_tokens: 16384, temperature: 0.4 },
        ['openai', 'openrouter', 'groq', 'xai'].includes(preset.id) ? { stream_options: { include_usage: true } } : {})),
    });
    if (!r.ok) throw new Error(await errorText(r));
    return finish(await readSSE(r, (j) => (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) || '', onText, (j) => {
      const u = j.usage || (j.x_groq && j.x_groq.usage);
      if (u && u.prompt_tokens != null) { U.seen = true; U.in = u.prompt_tokens; U.out = u.completion_tokens || 0; }
    }));
  }
  async function readSSE(r, pick, onText, onJson) {
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = '', full = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith('data:')) continue;
        const data = l.slice(5).trim();
        if (data === '[DONE]') continue;
        try { const j = JSON.parse(data); if (onJson) { try { onJson(j); } catch {} } const piece = pick(j); if (piece) { full += piece; onText(full); } } catch {}
      }
    }
    return full;
  }

  // ── Contexto e memória ──────────────────────────────────────────────────────
  // Ficha do ambiente: vai em TODA pergunta, para a IA saber onde está sem o usuário explicar.
  function fichaAmbiente() {
    return 'ONDE VOCÊ ESTÁ (não precisa repetir isso para o usuário):\n' +
      '- Você está dentro do MINI SK, um editor de código que roda inteiro no NAVEGADOR (celular ou PC), feito em HTML + JS puro, sem servidor.\n' +
      '- O usuário é advogado, usa quase só o celular, tem dificuldade nas mãos (prefere voz) e não é programador. Explique simples e um passo de cada vez.\n' +
      '- Os projetos ficam salvos SÓ neste aparelho (IndexedDB do navegador). Não há banco de dados, nem login, nem nuvem. Backup = 💾 Backup de tudo (JSON) ou enviar ao GitHub.\n' +
      '- O que o Mini SK TEM (diga qual botão usar quando ajudar): ☰ Arquivos (criar, renomear, mover, importar arquivos/pasta/.zip); editor com cores; ' +
      'Preview ao vivo embaixo (junta HTML, CSS, JS, imagens, módulos e fetch de .json do projeto; mostra o console com erros); 🔎 Busca e troca em todos os arquivos; ' +
      '📸 Checkpoints (pontos de volta, automáticos antes de mudanças grandes); ⌨️ Terminal LEVE (ls, cd, cat, grep, find, mkdir, rm, mv, cp, zip, run/node para JS simples, npm search/info/install via CDN) — NÃO é um terminal de verdade; ' +
      '🐙 GitHub (importar repositório, enviar só o que mudou, criar repositório, GitHub Pages, ver Actions e o erro de cada passo); ▶️ Playground (HTML, React, Python no navegador); ' +
      '🧬 Raio-X (analisa package.json, dependências, marcas da Replit, gera plano e "pacote para a IA"); ✂️ Fatiador (divide arquivo grande em módulos e confere); 🧩 Desembaralhar conversa de IA em arquivos; ' +
      '📱 PWA (ícones, manifest, service worker, Hub de links); 📦 APK (cria projeto Android + receita do GitHub Actions e acompanha o build); 🧪 Testador de API (para servidor rodando no PC); ' +
      '🔗 Ponte com o Cirurgião (manda o projeto para análise e recebe os arquivos corrigidos); 🔗 Meus Links; 🗣️ voz e modo conversa; 💰 controle de gasto; 🔁 revezar chaves grátis.\n' +
      '- O que o Mini SK NÃO faz: não roda Node/Express/servidor de verdade, não roda npm install de verdade, não compila TypeScript/React de projeto grande (Vite/Next), não acessa o disco do PC fora do que foi importado, ' +
      'e a internet só funciona para sites que permitem (CORS). Para essas coisas, diga ao usuário para usar o CodeLens no PC (tem terminal de verdade) ou o GitHub Actions.\n' +
      '- Você NÃO tem acesso direto aos arquivos fora do contexto. Se precisar ver um arquivo do projeto que não veio, escreva numa linha sozinha: LER: caminho/do/arquivo  (um por linha). Aparece um botão e o usuário manda com um toque. Não invente o conteúdo de arquivo que você não viu.\n';
  }
  function resumoProjeto() {
    const lista = fs().list().filter((f) => !f.startsWith('.sk/'));
    const out = ['RESUMO AUTOMÁTICO DO PROJETO:', '- ' + lista.length + ' arquivos.'];
    const pk = lista.filter((f) => /(^|\/)package\.json$/.test(f) && !/node_modules/.test(f)).slice(0, 6);
    pk.forEach((f) => {
      try {
        const j = JSON.parse(fs().read(f) || '{}'), deps = Object.keys(Object.assign({}, j.dependencies, j.devDependencies));
        out.push('- ' + f + ': nome "' + (j.name || '') + '"; comandos: ' + (Object.keys(j.scripts || {}).join(', ') || 'nenhum') + '; ' + deps.length + ' pacotes' + (deps.length ? ' (' + deps.slice(0, 30).join(', ') + (deps.length > 30 ? '…' : '') + ')' : '') + '.');
      } catch { out.push('- ' + f + ': (package.json com erro de escrita)'); }
    });
    const tem = (re) => lista.some((f) => re.test(f));
    const sinais = [];
    if (tem(/(^|\/)index\.html$/)) sinais.push('tem index.html');
    if (tem(/\.tsx?$/)) sinais.push('usa TypeScript');
    if (tem(/\.(jsx|tsx)$/)) sinais.push('usa React');
    if (tem(/(^|\/)vite\.config\./)) sinais.push('Vite');
    if (tem(/(^|\/)app\.json$/) && tem(/(^|\/)eas\.json$/)) sinais.push('Expo/EAS (app de celular)');
    if (tem(/capacitor\.config/)) sinais.push('Capacitor');
    if (tem(/(^|\/)\.replit$|replit\.nix|pnpm-workspace\.yaml/)) sinais.push('veio da Replit (monorepo)');
    if (tem(/(^|\/)server\/|(^|\/)api-server\//)) sinais.push('tem parte de servidor (não roda aqui; só no PC)');
    if (sinais.length) out.push('- Sinais: ' + sinais.join('; ') + '.');
    return out.join('\n');
  }
  function systemPrompt() {
    const base = 'Você é a assistente de programação do Mini SK. Responda SEMPRE em português do Brasil, de forma simples (o usuário não é programador).\n\n' +
      'REGRAS DE CONVERSA (obrigatórias):\n' +
      '- Nunca diga "vou fazer", "já volto", "aguarde" ou "estou trabalhando nisso": você não continua trabalhando depois de responder. Faça AGORA, nesta resposta, ou diga claramente que não dá e por quê.\n' +
      '- Ao terminar, SEMPRE dê retorno: diga em uma ou duas frases o que você fez (e em quais arquivos) e o que falta.\n' +
      '- Se faltar informação, pergunte UMA coisa objetiva no fim.\n' +
      '- Quando ele pedir um plano, faça o plano primeiro e espere a ordem dele para construir.\n' +
      '- Puxe assunto no fim quando fizer sentido: sugira o próximo passo em uma frase.\n' +
      '- Comandos de terminal (npm install, npm run build…) vão num bloco ```bash: ele tem o botão ▶ Terminal, que roda no terminal ligado (PC, Termux ou Node). Para criar/alterar arquivos, use blocos com filepath: (viram "Aplicar").\n\n' + fichaAmbiente();
    if (freeMode || !fs().project) return base + '\nEste é o chat livre (nenhum projeto aberto).';
    const P = fs().project;
    return base + '\n\nREGRAS PARA CÓDIGO:\n' +
      '1. Para criar ou alterar um arquivo, mande o ARQUIVO INTEIRO num bloco assim:\n```html filepath:caminho/arquivo.html\n...código completo...\n```\n' +
      '2. Nunca escreva explicações dentro do bloco de código. Explicação fica fora do bloco.\n' +
      '3. Prefira arquivos pequenos e separados (um assunto por arquivo, até uns 300 linhas). Se um arquivo ficar grande, divida em módulos.\n' +
      '4. Não use Replit, nem serviços pagos escondidos. O projeto precisa abrir pelo index.html.\n' +
      '5. Depois de uma tarefa importante, atualize ' + DIARY + ' (num bloco filepath) com: o que foi feito, decisões, o que falta. Esse diário é a sua memória.\n\n' +
      resumoProjeto() + '\n\nPROJETO: ' + P.name + '\nARQUIVOS:\n' + fs().list().filter((f) => !f.startsWith('.sk/')).slice(0, 400).join('\n');
  }
  function contextBlock() {
    if (freeMode || !fs().project) return '';
    const parts = [];
    const diary = fs().read(DIARY);
    if (diary && SK.$('#ai-c-diary', box).checked) parts.push('DIÁRIO DO PROJETO (' + DIARY + '):\n' + diary.slice(-6000));
    const cur = SK.editor.current;
    if (cur && SK.$('#ai-c-file', box).checked) {
      const t = fs().read(cur);
      if (t != null) parts.push('ARQUIVO ABERTO: ' + cur + '\n```\n' + t.slice(0, 60000) + (t.length > 60000 ? '\n…(cortado: arquivo grande)' : '') + '\n```');
    }
    const sel = SK.editor.selection();
    if (sel && SK.$('#ai-c-sel', box).checked) parts.push('TRECHO SELECIONADO:\n```\n' + sel.slice(0, 20000) + '\n```');
    if (SK.$('#ai-c-log', box).checked && SK.preview) { const log = SK.preview.logText; if (log) parts.push('CONSOLE DO PREVIEW (erros e logs):\n' + log.slice(-4000)); }
    return parts.join('\n\n');
  }
  /** Monta as mensagens respeitando o limite de tokens (corta as mais antigas). */
  function buildMessages(userText) {
    const sys = systemPrompt();
    const ctx = contextBlock();
    const last = { role: 'user', content: (ctx ? ctx + '\n\n---\nPEDIDO:\n' : '') + userText };
    let budget = ctxLimit - tok(sys) - tok(last.content);
    const kept = [];
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i]; const c = tok(m.content);
      if (budget - c < 0) break;
      budget -= c; kept.unshift({ role: m.role, content: m.content });
    }
    return { sys, messages: kept.concat([last]), dropped: history.length - kept.length, total: ctxLimit - budget };
  }
  function updateMeter() {
    if (!meterEl) return;
    const { total, dropped } = buildMessages(inputEl ? inputEl.value : '');
    const pct = Math.min(100, Math.round(total / ctxLimit * 100));
    const ci = curInfo();
    meterEl.innerHTML = '<span class="bar"><i style="width:' + pct + '%"></i></span> ≈ ' + SK.fmt(total) + ' / ' + SK.fmt(ctxLimit) + ' tokens' + (SK.gasto ? SK.esc(SK.gasto.previa(ci.preset, ci.model, total)) : '') + (dropped ? ' · ' + dropped + ' mensagens antigas ficam de fora' : '');
  }

  function loadMemory() {
    history = [];
    if (freeMode || !fs().project) { history = SK.pref.get('aiFreeHistory', []); return; }
    try { const t = fs().read(MEM); if (t) history = JSON.parse(t); } catch { history = []; }
  }
  function saveMemory() {
    const keep = history.slice(-200);
    if (freeMode || !fs().project) { SK.pref.set('aiFreeHistory', keep.slice(-60)); return; }
    fs().write(MEM, JSON.stringify(keep, null, 1), { silent: true });
  }

  // ── A IA pediu arquivo(s) com "LER: caminho": manda com um toque ─────────────
  function acharArquivo(c) {
    const lista = fs().list(), limpo = c.replace(/^\.?\/+/, '');
    return lista.find((f) => f === limpo) || lista.find((f) => f.endsWith('/' + limpo)) || lista.find((f) => f.toLowerCase() === limpo.toLowerCase()) || null;
  }
  function mandarArquivos(caminhos) {
    if (!fs().project) { SK.toast('Abra o projeto primeiro', 'error'); return; }
    const partes = [], faltam = [];
    caminhos.forEach((c) => { const f = acharArquivo(c); const t = f && fs().read(f); if (t == null) faltam.push(c); else partes.push('ARQUIVO PEDIDO: ' + f + '\n```\n' + t.slice(0, 80000) + (t.length > 80000 ? '\n…(cortado: arquivo muito grande)' : '') + '\n```'); });
    if (!partes.length) { SK.toast('Não achei ' + faltam.join(', ') + ' no projeto', 'error'); return; }
    inputEl.value = partes.join('\n\n') + (faltam.length ? '\n\n(Não existem no projeto: ' + faltam.join(', ') + ')' : '') + '\n\nAí estão os arquivos que você pediu. Continue a tarefa.';
    send();
  }

  // ── Memória em arquivo: baixar e trazer de volta (nunca repetir explicação) ──
  function exportarMemoria() {
    const P = fs().project;
    const dados = { app: 'minisk-memoria', versao: 1, projeto: P && !freeMode ? P.name : '(chat livre)', criado: new Date().toISOString(), historico: history, diario: P && !freeMode ? (fs().read(DIARY) || '') : '' };
    SK.download('memoria-' + (dados.projeto || 'chat').replace(/[^\w.-]+/g, '-') + '-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(dados, null, 1), 'application/json');
    SK.toast('💾 Memória baixada (' + history.length + ' mensagens' + (dados.diario ? ' + diário' : '') + ')', 'ok');
  }
  async function importarMemoria(arq) {
    let d; try { d = JSON.parse(await arq.text()); } catch { SK.toast('Arquivo de memória inválido', 'error'); return; }
    const hist = Array.isArray(d) ? d : d.historico;
    if (!Array.isArray(hist) || !hist.every((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')) { SK.toast('Esse arquivo não é uma memória do Mini SK', 'error'); return; }
    const juntar = history.length && await SK.confirm('Já existe conversa aqui (' + history.length + ' mensagens). Juntar a memória trazida no fim? (Cancelar = substituir)', { okText: 'Juntar' });
    history = juntar ? history.concat(hist) : hist.slice();
    saveMemory();
    if (d.diario && fs().project && !freeMode) {
      const atual = fs().read(DIARY) || '';
      fs().write(DIARY, atual && atual !== d.diario ? atual + '\n\n---\n(diário trazido de ' + (d.projeto || 'outro lugar') + ')\n' + d.diario : d.diario);
    }
    renderLog(); SK.toast('📥 Memória trazida: ' + hist.length + ' mensagens', 'ok');
  }

  // ── Mostrar mensagens ───────────────────────────────────────────────────────
  function mdLite(text) {
    const blocks = [];
    let html = text.replace(/```([^\n`]*)\n([\s\S]*?)(?:```|$)/g, (m, info, code) => {
      const fp = (/filepath:\s*([^\s`]+)/.exec(info) || [])[1] || (/^\s*(?:\/\/|#|<!--)\s*(?:arquivo|file|filepath):\s*([^\s>]+)/i.exec(code) || [])[1] || '';
      const lang = (info.trim().split(/\s+/)[0] || '').replace(/^filepath:.*/, '');
      blocks.push({ fp, lang, code: code.replace(/\n$/, '') });
      return '\u0000B' + (blocks.length - 1) + '\u0000';
    });
    html = SK.esc(html)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/^#{1,4} (.*)$/gm, '<b class="h">$1</b>').replace(/^\s*[-*] (.*)$/gm, '• $1')
      .replace(/\n/g, '<br>');
    html = html.replace(/(^|<br>)\s*(?:<b>)?LER:(?:<\/b>)?\s*(?:<code>)?([^\s<]+?)(?:<\/code>)?(?=<br>|$)/g, (m, ini, cam) =>
      ini + '<button class="btn tiny primary" data-ler="' + cam.replace(/"/g, '') + '">📎 Mandar ' + cam + ' para a IA</button>');
    html = html.replace(/\u0000B(\d+)\u0000/g, (m, i) => {
      const b = blocks[+i];
      const t = fs().typeOf(b.fp || ('x.' + (b.lang || 'txt')));
      return '<div class="cb" data-b="' + i + '"><div class="cb-head"><span>' + SK.esc(b.fp || b.lang || 'código') + '</span><span class="row tight">' +
        '<button class="btn tiny" data-cb="copy">Copiar</button>' +
        (b.fp ? '<button class="btn tiny primary" data-cb="apply">Aplicar em ' + SK.esc(fs().baseName(b.fp)) + '</button>' : '<button class="btn tiny" data-cb="save">Salvar como…</button>') +
        (!b.fp && (/^(bash|sh|shell|zsh|console|terminal|cmd|bat|powershell|ps1)$/i.test(b.lang || '') || (!b.lang && /^\s*(npm|npx|pnpm|yarn|node|git|cd|ls|dir|mkdir|python3?|pip|pkg)\b/.test(b.code))) ? '<button class="btn tiny primary" data-cb="run" title="Manda para o terminal que estiver ligado">▶ Terminal</button>' : '') +
        '</span></div><pre class="cb-code"><code>' + SK.highlight(b.code, t.lang) + '</code></pre></div>';
    });
    return { html, blocks };
  }
  function renderLog() {
    logEl.innerHTML = '';
    if (!history.length) logEl.innerHTML = '<div class="ai-hello muted">' + (freeMode ? 'Chat livre: pergunte o que quiser.' : 'Peça para criar, explicar ou consertar código deste projeto. Ela enxerga o arquivo aberto, a lista de arquivos e o diário do projeto.') + '</div>';
    history.forEach((m) => addMsg(m.role, m.content));
    logEl.scrollTop = logEl.scrollHeight;
    updateMeter();
  }
  function addMsg(role, content) {
    const el = document.createElement('div');
    el.className = 'msg ' + role;
    if (role === 'assistant') {
      const r = mdLite(content);
      el.innerHTML = r.html;
      el._blocks = r.blocks;
      if (r.blocks.filter((b) => b.fp).length > 1) {
        const all = document.createElement('button');
        all.className = 'btn small primary'; all.textContent = 'Aplicar todos os ' + r.blocks.filter((b) => b.fp).length + ' arquivos';
        all.onclick = () => applyBlocks(r.blocks.filter((b) => b.fp));
        el.appendChild(all);
      }
    } else el.textContent = content.length > 1500 ? content.slice(0, 1500) + ' …' : content;
    logEl.appendChild(el);
    return el;
  }
  // ▶ Terminal: manda os comandos para o terminal que estiver ligado (💻 PC / 📱 Termux / ⚡ Node)
  function rodarNoTerminal(codigo) {
    const linhas = String(codigo).split('\n').map((l) => l.replace(/^\s*\$\s?/, '')).filter((l) => l.trim() && !/^\s*(#|\/\/|REM\b)/i.test(l));
    if (!linhas.length) return;
    const cmd = linhas.join(' && ');
    if (SK.termux && SK.termux.ligado) { SK.termux.mandar(cmd); SK.toast('▶ Mandado para o ' + (window.miniskPC ? '💻 Terminal PC' : '📱 Termux') + '. Depois: ⬇ Trazer, para ver os arquivos na árvore.'); return; }
    if (SK.node && SK.node.ligado) { SK.node.mandar(cmd); SK.toast('▶ Mandado para o ⚡ Node.'); return; }
    if (window.miniskPC && SK.termux) { SK.app.openSide('termux'); setTimeout(() => SK.termux.mandar(cmd), 1500); return; }
    SK.copy(cmd); SK.toast('Nenhum terminal ligado: copiei o comando. Abra o ⚡ Node ou o 📱 Termux e cole.', 'error');
  }
  async function applyBlocks(blocks) {
    await SK.checkpoints.auto('Antes da IA alterar ' + blocks.map((b) => b.fp).join(', '));
    blocks.forEach((b) => fs().write(b.fp, b.code + '\n'));
    SK.tree.expandTo(blocks[0].fp);
    SK.editor.open(blocks[0].fp);
    SK.toast(blocks.length === 1 ? 'Aplicado em ' + blocks[0].fp : blocks.length + ' arquivos aplicados');
  }

  // ── Enviar ──────────────────────────────────────────────────────────────────
  async function send() {
    const text = inputEl.value.trim();
    if (!text || busy) return;
    const { sys, messages, total: tin } = buildMessages(text);
    const ci = curInfo();
    if (SK.gasto && current() && !(await SK.gasto.antes(ci.preset, ci.model, tin))) return;
    history.push({ role: 'user', content: text });
    if (logEl.querySelector('.ai-hello')) logEl.innerHTML = '';
    addMsg('user', text);
    inputEl.value = ''; updateMeter();
    const out = addMsg('assistant', '…');
    out.classList.add('typing');
    if (current() && current().preset === 'ollama') out.innerHTML = '<span class="muted">⏳ O Ollama está pensando no seu computador… A 1ª resposta demora (ele carrega o modelo na memória: 1 a 3 minutos, ou mais em PC fraco). Não feche o Ollama.</span>';
    busy = new AbortController();
    setBusy(true);
    let full = '';
    try {
      // 🔁 Revezar: se a IA escolhida bater o limite (comum nas grátis), tenta a próxima chave sozinho
      const fila = [current()].concat(revezar ? keys.filter((x) => x && (x.key || x.preset === 'ollama') && x !== current()) : []).filter(Boolean);
      let ultimoErro = null;
      for (let t = 0; t < fila.length; t++) {
        try {
          full = await chat(messages, sys, (tx) => { full = tx; out.innerHTML = mdLite(tx).html; logEl.scrollTop = logEl.scrollHeight; }, busy.signal, fila[t]);
          if (t > 0) { const nomeK = (PRESETS.find((x) => x.id === fila[t].preset) || {}).label || 'outra chave'; const av = document.createElement('div'); av.className = 'muted small'; av.textContent = '🔁 A IA anterior bateu o limite — respondeu: ' + nomeK.replace(/ \(.*\)/, ''); out.before(av); }
          ultimoErro = null; break;
        } catch (er) {
          ultimoErro = er;
          if (er.name === 'AbortError' || full || t === fila.length - 1 || !/429|limit|quota|exhaust|rate|overload|503|502|500|Failed to fetch|NetworkError|tempo|unavailable/i.test(er.message || '')) throw er;
          const nomeK = (PRESETS.find((x) => x.id === fila[t + 1].preset) || {}).label || 'próxima chave';
          out.innerHTML = '<span class="muted">⚠ Limite ou falha nesta IA — tentando ' + SK.esc(nomeK.replace(/ \(.*\)/, '')) + '…</span>';
        }
      }
      if (ultimoErro) throw ultimoErro;
      if (!full) full = '(sem resposta)';
      history.push({ role: 'assistant', content: full });
      saveMemory();
      out.remove(); const msgEl = addMsg('assistant', full);
      costLine(msgEl, ci, tin, full, false);
      if (((full.match(/```/g) || []).length % 2) === 1) continueBtn(msgEl, 'A resposta parece ter parado no meio de um código.');
      SK.emit('ai-resposta', full);
      if (speak && SK.voz && !SK.voz.conversa) SK.voz.falar(full);
    } catch (e) {
      out.classList.remove('typing');
      if (e.name === 'AbortError') { if (full) { history.push({ role: 'assistant', content: full + '\n\n(interrompido)' }); saveMemory(); costLine(out, ci, tin, full, true); continueBtn(out, 'Interrompido.'); } out.insertAdjacentHTML('beforeend', '<div class="muted">(interrompido)</div>'); }
      else { SK.emit('ai-falhou'); history.pop(); out.className = 'msg error'; out.textContent = '⚠ ' + (e.message || e) + (/Failed to fetch|NetworkError/i.test(e.message) ? (current() && current().preset === 'ollama' ? ' — o Ollama não respondeu. Ele está aberto no computador? (No site pelo navegador ele costuma bloquear: use o Mini SK para PC.)' : ' — sem internet, ou o provedor não aceita chamadas direto do navegador.') : ''); }
    }
    busy = null; setBusy(false);
    logEl.scrollTop = logEl.scrollHeight;
    updateMeter();
  }
  /** 💰 linha de gasto embaixo da resposta */
  function costLine(el, ci, tin, full, partial) {
    if (!SK.gasto || !el) return;
    const u = lastUsage;
    const t = SK.gasto.registra({ preset: ci.preset, model: ci.model, tin: u ? u.in : tin, tout: u ? u.out : tok(full), estimado: !u || partial });
    const d = document.createElement('div'); d.className = 'ai-cost muted small'; d.textContent = t; el.appendChild(d);
  }
  /** ▶ Continuar de onde parou (quando a resposta foi cortada) */
  function continueBtn(el, why) {
    const b = document.createElement('button'); b.className = 'btn small';
    b.textContent = '▶ Continuar de onde parou'; b.title = why;
    b.onclick = () => { b.remove(); inputEl.value = 'Continue exatamente de onde parou, sem repetir nada do que já escreveu. Se estava no meio de um arquivo, mande o arquivo inteiro de novo num bloco filepath.'; send(); };
    el.appendChild(b);
  }
  function setBusy(on) {
    SK.$('#ai-send', box).hidden = on; SK.$('#ai-stop', box).hidden = !on;
  }

  // ── Interface ───────────────────────────────────────────────────────────────
  function build(container) {
    box = container;
    box.innerHTML =
      '<div class="ai-top row wrap">' +
      '<select class="inp" id="ai-key" aria-label="Qual chave usar"></select>' +
      '<button class="btn small" id="ai-keys-btn">⚙️ Chaves</button>' +
      '<label class="chk"><input type="checkbox" id="ai-free"> Chat livre</label>' +
      '<label class="chk"><input type="checkbox" id="ai-speak"> 🔊 Falar</label>' +
      '<label class="chk" title="Se a IA bater o limite do dia (comum nas grátis), passa sozinho para a próxima chave da lista"><input type="checkbox" id="ai-revezar"> 🔁 Revezar grátis</label>' +
      '<button class="btn small" id="ai-plano" title="Monta um pedido para a IA criar um plano de conserto do projeto aberto">📋 Plano de conserto</button>' +
      '</div>' +
      '<div class="ai-keys" id="ai-keys" hidden></div>' +
      '<div class="ai-log" id="ai-log" aria-live="polite"></div>' +
      '<div class="ai-ctx row wrap" id="ai-ctx">' +
      '<label class="chk"><input type="checkbox" id="ai-c-file" checked> Arquivo aberto</label>' +
      '<label class="chk"><input type="checkbox" id="ai-c-sel" checked> Trecho selecionado</label>' +
      '<label class="chk"><input type="checkbox" id="ai-c-diary" checked> Diário</label>' +
      '<label class="chk"><input type="checkbox" id="ai-c-log"> Erros do preview</label>' +
      '</div>' +
      '<div class="ai-meter muted" id="ai-meter"></div>' +
      '<button class="ai-gasto" id="ai-gasto" title="Ver gasto, limite do mês e preços"></button>' +
      '<div class="ai-voz-status muted small" id="ai-voz-status" hidden></div>' +
      '<details class="ai-voz-aj"><summary class="small muted">🎚️ Voz (Francisca · 1,15 · tom 0,95 · pausa 3 s)</summary><div id="ai-voz-aj"></div></details>' +
      '<div class="ai-input">' +
      '<textarea class="inp" id="ai-in" rows="3" placeholder="Ex.: crie uma página de login em arquivos separados (html, css, js)"></textarea>' +
      '<div class="row wrap">' +
      '<button class="btn primary" id="ai-send">Enviar</button><button class="btn danger" id="ai-stop" hidden>Parar</button>' +
      '<button class="btn small" id="ai-mic" title="Ditar">🎤</button>' +
      '<button class="btn small" id="ai-conversa" title="Modo conversa: fale, pare 3 segundos, ele responde em voz alta e volta a ouvir">🗣️ Conversa</button>' +
      '<label class="chk muted">Limite <select class="inp tiny" id="ai-limit">' + [8000, 16000, 24000, 32000, 64000, 128000, 200000].map((n) => '<option value="' + n + '"' + (n === ctxLimit ? ' selected' : '') + '>' + SK.fmt(n) + '</option>').join('') + '</select> tokens</label>' +
      '<button class="btn small" id="ai-clear" title="Apagar a conversa deste projeto">Limpar conversa</button>' +
      '<button class="btn small" id="ai-mem-out" title="Baixar a conversa e o diário num arquivo .json (para trazer de volta depois, em qualquer aparelho)">⬇ Memória</button>' +
      '<button class="btn small" id="ai-mem-in" title="Trazer uma memória (.json) baixada antes">⬆ Memória</button><input type="file" id="ai-mem-file" accept=".json,application/json" hidden>' +
      '<button class="btn small" id="ai-mem-pico" title="Escolher só um pedaço da conversa, dividir, trazer conversa do ChatGPT/Claude">✂️ Picotar</button>' +
      '</div></div>';
    logEl = SK.$('#ai-log', box); inputEl = SK.$('#ai-in', box); meterEl = SK.$('#ai-meter', box);
    const gEl = SK.$('#ai-gasto', box);
    const renderGasto = () => { if (SK.gasto) gEl.innerHTML = SK.gasto.resumoHTML(); else gEl.hidden = true; };
    gEl.onclick = () => SK.gasto && SK.gasto.painel();
    SK.on('gasto-mudou', () => { renderGasto(); updateMeter(); }); renderGasto();
    SK.$('#ai-free', box).checked = freeMode; SK.$('#ai-speak', box).checked = speak;
    SK.$('#ai-send', box).onclick = send;
    SK.$('#ai-stop', box).onclick = () => busy && busy.abort();
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
    inputEl.addEventListener('input', SK.debounce(updateMeter, 300));
    SK.$('#ai-ctx', box).addEventListener('change', updateMeter);
    SK.$('#ai-limit', box).onchange = (e) => { ctxLimit = +e.target.value; SK.pref.set('aiCtx', ctxLimit); updateMeter(); };
    SK.$('#ai-free', box).onchange = (e) => { freeMode = e.target.checked; SK.pref.set('aiFree', freeMode); SK.$('#ai-ctx', box).hidden = freeMode; loadMemory(); renderLog(); };
    SK.$('#ai-speak', box).onchange = (e) => { speak = e.target.checked; SK.pref.set('aiSpeak', speak); if (!speak && 'speechSynthesis' in window) speechSynthesis.cancel(); };
    SK.$('#ai-key', box).onchange = (e) => { activeKey = e.target.value; saveKeys(); };
    SK.$('#ai-revezar', box).checked = revezar;
    SK.$('#ai-revezar', box).onchange = (e) => { revezar = e.target.checked; SK.pref.set('aiRevezar', revezar); };
    SK.$('#ai-plano', box).onclick = () => {
      inputEl.value = 'Quero consertar este projeto, um passo de cada vez. Olhe os arquivos que estão no contexto e me entregue um PLANO DE CONSERTO em português simples (sou advogado, não programador):\n' +
        '1. O que o projeto faz (em 3 linhas).\n2. Lista dos problemas que você encontrar, do mais grave para o menos grave, com o ARQUIVO e a LINHA de cada um.\n' +
        '3. Para cada problema: o que ele causa na tela e como consertar.\n4. A ordem certa de conserto, em passos pequenos que eu consiga testar um por um.\n' +
        '5. O que está faltando no projeto (arquivos, bibliotecas, configurações).\nNÃO mande código ainda — só o plano. Depois eu peço o conserto de cada passo.';
      inputEl.focus(); SK.toast('📋 Pedido de plano pronto — confira e toque em Enviar');
    };
    SK.$('#ai-keys-btn', box).onclick = () => { const k = SK.$('#ai-keys', box); k.hidden = !k.hidden; if (!k.hidden) renderKeys(); };
    SK.$('#ai-clear', box).onclick = async () => { if (await SK.confirm('Apagar a conversa guardada' + (freeMode ? ' do chat livre' : ' deste projeto') + '? O diário (.sk/diario.md) continua.', { danger: true, okText: 'Apagar' })) { history = []; saveMemory(); renderLog(); } };
    SK.$('#ai-mic', box).onclick = dictate;
    SK.$('#ai-mem-out', box).onclick = exportarMemoria;
    SK.$('#ai-mem-in', box).onclick = () => SK.$('#ai-mem-file', box).click();
    SK.$('#ai-mem-pico', box).onclick = () => SK.app.openSide('imp');
    SK.$('#ai-mem-file', box).onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importarMemoria(f); };
    // 🗣️ Modo conversa
    const vozSt = SK.$('#ai-voz-status', box), vozBtn = SK.$('#ai-conversa', box), vozAj = SK.$('#ai-voz-aj', box);
    const montarAj = () => { if (SK.voz) { vozAj.innerHTML = SK.voz.ajustesHTML(); SK.voz.ligarAjustes(vozAj); } };
    montarAj(); SK.on('voz-lista', montarAj);
    vozBtn.onclick = () => {
      if (!SK.voz) return;
      if (SK.voz.conversa) { SK.voz.desligar(); return; }
      if (SK.voz.ligar((t) => { inputEl.value = t; send(); })) SK.toast('🗣️ Pode falar. Quando parar ' + SK.voz.cfg().pausa + ' segundos, eu mando.');
    };
    const ROT = { ouvindo: '🎙️ Ouvindo… (pare de falar para enviar)', pensando: '🤖 Pensando…', falando: '🔊 Falando… (toque em ⏹ Parar conversa para interromper)', parado: '', desligado: '' };
    SK.on('voz-estado', (e) => {
      const ativa = SK.voz && SK.voz.conversa;
      vozBtn.textContent = ativa ? '⏹ Parar conversa' : '🗣️ Conversa';
      vozBtn.classList.toggle('danger', !!ativa);
      vozSt.hidden = !ativa || !ROT[e]; vozSt.textContent = ROT[e] || '';
    });
    SK.on('voz-ouvindo', (t) => { if (SK.voz && SK.voz.conversa) { vozSt.hidden = false; vozSt.textContent = '🎙️ ' + (t || 'Ouvindo…'); } });
    logEl.addEventListener('click', onCodeBtn);
    SK.$('#ai-ctx', box).hidden = freeMode;
    renderKeySelect();
  }
  function onCodeBtn(e) {
    const lb = e.target.closest('[data-ler]');
    if (lb) { mandarArquivos([lb.dataset.ler]); return; }
    const b = e.target.closest('[data-cb]'); if (!b) return;
    const msg = b.closest('.msg'); const i = +b.closest('.cb').dataset.b; const blk = msg._blocks && msg._blocks[i];
    if (!blk) return;
    if (b.dataset.cb === 'copy') SK.copy(blk.code);
    if (b.dataset.cb === 'apply') applyBlocks([blk]);
    if (b.dataset.cb === 'run') rodarNoTerminal(blk.code);
    if (b.dataset.cb === 'save') SK.prompt('Salvar em qual arquivo?', 'novo.' + (blk.lang || 'txt'), { okText: 'Salvar' }).then((p) => { if (p) applyBlocks([{ fp: p, code: blk.code }]); });
  }
  function dictate() {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { SK.toast('Este navegador não tem ditado por voz', 'error'); return; }
    const r = new R(); r.lang = 'pt-BR'; r.interimResults = false;
    r.onresult = (ev) => { inputEl.value += (inputEl.value ? ' ' : '') + ev.results[0][0].transcript; updateMeter(); };
    r.onerror = (ev) => SK.toast('Ditado: ' + ev.error, 'error');
    r.start(); SK.toast('Fale agora…');
  }

  function renderKeySelect() {
    const s = SK.$('#ai-key', box);
    if (!keys.length) { s.innerHTML = '<option value="">Sem chave — toque em ⚙️ Chaves</option>'; return; }
    if (!keys.find((k) => k.id === activeKey)) activeKey = keys[0].id;
    s.innerHTML = keys.map((k) => { const p = PRESETS.find((x) => x.id === k.preset) || {}; return '<option value="' + k.id + '"' + (k.id === activeKey ? ' selected' : '') + '>' + SK.esc((p.label || 'Chave').replace(/ \(.*\)/, '') + ' · ' + (k.model || p.model || '?')) + '</option>'; }).join('');
  }
  function renderKeys() {
    const el = SK.$('#ai-keys', box);
    el.innerHTML = '<p class="muted small">As chaves ficam só neste aparelho (no navegador). Groq e Gemini têm opção grátis.</p>' +
      keys.map((k) => {
        const p = PRESETS.find((x) => x.id === k.preset) || PRESETS[PRESETS.length - 1];
        return '<div class="key-card" data-k="' + k.id + '">' +
          '<div class="row wrap"><select class="inp" data-f="preset">' + PRESETS.map((x) => '<option value="' + x.id + '"' + (x.id === k.preset ? ' selected' : '') + '>' + SK.esc(x.label) + '</option>').join('') + '</select>' +
          '<button class="btn tiny danger" data-f="del">Remover</button></div>' +
          '<input class="inp mono" type="password" data-f="key" placeholder="Cole a chave aqui" value="' + SK.esc(k.key) + '">' +
          (p.id === 'custom' ? '<input class="inp mono" data-f="base" placeholder="URL base, ex.: https://api.exemplo.com/v1" value="' + SK.esc(k.base || '') + '">' : '') +
          '<div class="row"><input class="inp mono grow" data-f="model" list="ml-' + k.id + '" placeholder="Modelo (' + SK.esc(p.model || 'nome do modelo') + ')" value="' + SK.esc(k.model || '') + '"><datalist id="ml-' + k.id + '">' + (k.models || []).map((m) => '<option value="' + SK.esc(m) + '">').join('') + '</datalist>' +
          '<button class="btn tiny" data-f="models">🔄 Buscar modelos</button>' + (p.id === 'ollama' ? '<button class="btn tiny primary" data-f="ollama-teste">🧪 Testar o Ollama</button>' + (window.miniskPC && window.miniskPC.desligarOllama ? '<button class="btn tiny" data-f="ollama-ligar">▶ Ligar</button><button class="btn tiny danger" data-f="ollama-desligar">⏹ Desligar</button>' : '') + '<button class="btn tiny" data-f="ollama-catalogo">📚 Escolher modelo (lista pronta)</button>' : '<button class="btn tiny" data-f="test">Testar</button>') + '</div>' +
          '<div class="muted small" data-f="msg">' + (p.site ? 'Pegar chave: ' + SK.esc(p.site) : '') + '</div></div>';
      }).join('') +
      '<button class="btn small primary" id="ai-add-key">＋ Adicionar chave</button>';
    SK.$('#ai-add-key', el).onclick = () => { const id = SK.uid(); keys.push({ id, preset: 'groq', key: '', model: '' }); activeKey = activeKey || id; saveKeys(); renderKeys(); renderKeySelect(); };
    el.oninput = el.onchange = (e) => {
      const card = e.target.closest('[data-k]'); if (!card) return;
      const k = keys.find((x) => x.id === card.dataset.k); const f = e.target.dataset.f;
      if (f === 'key') { k.key = e.target.value.trim(); const d = detect(k.key); if (d && d.id !== k.preset) { k.preset = d.id; k.model = ''; saveKeys(); renderKeys(); renderKeySelect(); return; } }
      if (f === 'preset' && e.type === 'change') { k.preset = e.target.value; k.model = ''; saveKeys(); renderKeys(); renderKeySelect(); return; }
      if (f === 'model') k.model = e.target.value.trim();
      if (f === 'base') k.base = e.target.value.trim();
      saveKeys(); if (f === 'model') renderKeySelect();
    };
    el.onclick = async (e) => {
      const b = e.target.closest('button[data-f]'); if (!b) return;
      const card = b.closest('[data-k]'); const k = keys.find((x) => x.id === card.dataset.k); const msg = SK.$('[data-f="msg"]', card);
      if (b.dataset.f === 'del') { keys = keys.filter((x) => x !== k); if (activeKey === k.id) activeKey = keys[0] ? keys[0].id : null; saveKeys(); renderKeys(); renderKeySelect(); return; }
      if (b.dataset.f === 'models') {
        msg.textContent = 'Buscando…';
        try { k.models = await listModels(k); saveKeys(); const prev = k.model; renderKeys(); const m2 = SK.$('[data-k="' + k.id + '"] [data-f="msg"]', el); m2.textContent = k.models.length + ' modelos disponíveis na sua chave. Toque no campo Modelo para escolher.' + (prev && !k.models.includes(prev) ? ' Atenção: "' + prev + '" não está na lista.' : ''); }
        catch (err) { msg.textContent = '⚠ ' + err.message; }
      }
      if (b.dataset.f === 'ollama-teste') { testarOllama(k, msg); return; }
      if (b.dataset.f === 'ollama-catalogo') { catalogoOllama(k, msg); return; }
      if (b.dataset.f === 'ollama-desligar') { msg.textContent = 'Desligando o Ollama…'; try { await window.miniskPC.desligarOllama(); } catch {} await new Promise((ok) => setTimeout(ok, 1500)); let on = false; try { on = (await fetch('http://127.0.0.1:11434/api/version', { signal: AbortSignal.timeout(2500) })).ok; } catch {} msg.innerHTML = on ? '⚠ Ainda ligado. Feche a lhama 🦙 perto do relógio (botão direito → Quit).' : '🔴 <b>Ollama desligado.</b> Para ligar de novo: ▶ Ligar (ou 🧪 Testar, que liga sozinho).'; return; }
      if (b.dataset.f === 'ollama-ligar') { msg.textContent = 'Ligando o Ollama…'; let r = ''; try { r = await window.miniskPC.ligarOllama(); } catch (er) { r = er.message; } msg.innerHTML = /liguei|já estava/.test(r) ? '🟢 <b>Ollama ligado</b> (' + SK.esc(r) + '). Agora: 🧪 Testar o Ollama.' : '❌ ' + SK.esc(r) + '. Instale em ollama.com/download.'; return; }
      if (b.dataset.f === 'test') {
        msg.textContent = 'Testando…';
        const keep = activeKey; activeKey = k.id;
        try { const t = await chat([{ role: 'user', content: 'Responda só: OK' }], 'Responda apenas OK.', () => {}); msg.textContent = '✅ Funcionando: "' + t.slice(0, 40) + '"'; }
        catch (err) { msg.textContent = '⚠ ' + err.message; }
        activeKey = keep;
      }
    };
  }

  // 📚 Modelos do Ollama já explicados em português: baixar, usar e apagar com um toque (sem pesquisar na internet)
  const CATALOGO_OLLAMA = [
    { n: 'phi4-mini', alias: ['phi4-mini:3.8b'], t: '2,5 GB', d: 'Da Microsoft. Fala português bem. O melhor para começar.', pt: '⭐⭐⭐' },
    { n: 'qwen2.5:3b', t: '1,9 GB', d: 'Muito bom em português e rápido. Ótimo para PC comum.', pt: '⭐⭐⭐' },
    { n: 'gemma3:4b', t: '3,3 GB', d: 'Do Google. Bom em português; precisa de PC com 8 GB de memória.', pt: '⭐⭐⭐' },
    { n: 'gemma3:1b', t: '0,8 GB', d: 'Bem leve. Para PC fraco (ou celular). Respostas mais simples.', pt: '⭐⭐' },
    { n: 'qwen2.5-coder:3b', t: '1,9 GB', d: 'Especial para CÓDIGO (programar). Explica em português razoável.', pt: '⭐⭐' },
    { n: 'llama3.2:3b', alias: ['llama3.2'], t: '2,0 GB', d: 'Da Meta. Tende a responder em INGLÊS — não recomendado para você.', pt: '⭐' },
  ];
  async function catalogoOllama(k, msg) {
    const B = 'http://127.0.0.1:11434';
    let tem = [];
    try { tem = ((await (await fetch(B + '/api/tags', { signal: AbortSignal.timeout(4000) })).json()).models || []).map((m) => m.name.replace(/:latest$/, '')); }
    catch { msg.innerHTML = '❌ O Ollama está desligado. Toque em 🧪 Testar o Ollama (ele liga) e depois volte aqui.'; return; }
    const pinta = () => {
      msg.innerHTML = '<div class="stack" style="gap:6px;margin-top:6px">' + CATALOGO_OLLAMA.map((m) => {
        const nomeReal = [m.n].concat(m.alias || []).find((x) => tem.includes(x));
        const baixado = !!nomeReal;
        return '<div style="border:1px solid var(--line);border-radius:8px;padding:8px"><b class="mono">' + m.n + '</b> · ' + m.t + ' · português ' + m.pt +
          ([m.n].concat(m.alias || []).includes(k.model) ? ' · <b>✅ em uso</b>' : '') + '<div class="small">' + m.d + '</div><div class="row wrap" style="margin-top:4px">' +
          (baixado ? '<button class="btn tiny primary" data-ol="usar" data-m="' + nomeReal + '">Usar este</button><button class="btn tiny danger" data-ol="apagar" data-m="' + nomeReal + '">🗑 Apagar</button>'
                   : '<button class="btn tiny" data-ol="baixar" data-m="' + m.n + '">⬇ Baixar (' + m.t + ')</button>') + '</div><div class="small muted" data-pr="' + m.n + '"></div></div>';
      }).join('') + '<div class="small muted">Já baixados: ' + (tem.length ? tem.map(SK.esc).join(', ') : 'nenhum') + '</div></div>';
    };
    pinta();
    msg.onclick = async (e) => {
      const b = e.target.closest('[data-ol]'); if (!b) return; e.stopPropagation();
      const m = b.dataset.m, pr = msg.querySelector('[data-pr="' + m + '"]');
      if (b.dataset.ol === 'usar') { k.model = m; k.models = tem; saveKeys(); activeKey = k.id; renderKeySelect(); pinta(); SK.toast('Agora a IA usa ' + m + '. Toque em 🧪 Testar o Ollama para conferir.'); return; }
      if (b.dataset.ol === 'apagar') { if (!(await SK.confirm('Apagar o modelo ' + m + ' do computador? (libera ' + (CATALOGO_OLLAMA.find((x) => x.n === m) || {}).t + ')'))) return; try { await fetch(B + '/api/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m }) }); } catch {} tem = tem.filter((x) => x !== m); if (k.model === m) { k.model = ''; saveKeys(); } pinta(); SK.toast('Apagado: ' + m); return; }
      if (b.dataset.ol === 'baixar') {
        b.disabled = true; pr.textContent = 'Começando…';
        try {
          const r = await fetch(B + '/api/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m, stream: true }) });
          const leitor = r.body.getReader(); const dec = new TextDecoder(); let resto = '';
          for (;;) {
            const { value, done } = await leitor.read(); if (done) break;
            resto += dec.decode(value, { stream: true }); const ls = resto.split('\n'); resto = ls.pop();
            for (const l of ls) { if (!l.trim()) continue; let j = {}; try { j = JSON.parse(l); } catch { continue; } if (j.error) throw new Error(j.error); pr.textContent = j.total ? 'Baixando… ' + Math.round((j.completed || 0) * 100 / j.total) + '% de ' + (j.total / 1e9).toFixed(1) + ' GB' : (j.status === 'success' ? 'Pronto!' : 'Preparando…'); }
          }
          tem.push(m); k.model = m; k.models = tem; saveKeys(); activeKey = k.id; renderKeySelect(); pinta(); SK.toast('✅ ' + m + ' baixado e escolhido. Toque em 🧪 Testar o Ollama.');
        } catch (er) { pr.textContent = '❌ ' + er.message + ' (sem internet? pouco espaço no disco?)'; b.disabled = false; }
      }
    };
  }
  // 🧪 Teste do Ollama passo a passo: ligado? tem modelo? responde? (e quanto tempo levou)
  async function testarOllama(k, msg) {
    const B = 'http://127.0.0.1:11434';
    const linhas = []; const mostra = (t) => { msg.innerHTML = linhas.concat(t ? [t] : []).map((x) => '<div>' + x + '</div>').join(''); };
    const ping = async () => { try { const r = await fetch(B + '/api/version', { signal: AbortSignal.timeout(4000) }); return r.ok ? (await r.json()).version || 'ok' : null; } catch { return null; } };
    mostra('1/3 · Procurando o Ollama no computador…');
    let v = await ping();
    if (!v && window.miniskPC && window.miniskPC.ligarOllama) {
      mostra('1/3 · O Ollama estava desligado — ligando ele para você…');
      try { await window.miniskPC.ligarOllama(); } catch {}
      for (let i = 0; i < 10 && !v; i++) { await new Promise((ok) => setTimeout(ok, 1500)); v = await ping(); }
    }
    if (!v) { linhas.push('❌ <b>O Ollama está desligado</b> (ou não está instalado). Abra <b>Ollama</b> no menu Iniciar do Windows (aparece a lhama 🦙 perto do relógio) e teste de novo.' + (window.miniskPC ? '' : '<br><b>No celular (Termux):</b> ligue o Ollama deixando o Mini SK conversar com ele: no 📱 Termux toque em <b>🦙 Ligar o Ollama para a IA</b> (ou digite <code>OLLAMA_ORIGINS="*" ollama serve &gt; /dev/null 2&gt;&amp;1 &amp;</code>) e teste de novo.')); return mostra(); }
    linhas.push('✅ 1/3 · Ollama ligado (versão ' + SK.esc(v) + ')');
    let nomes = [];
    try { const r = await fetch(B + '/api/tags'); nomes = ((await r.json()).models || []).map((m) => m.name); } catch {}
    if (!nomes.length) { linhas.push('❌ 2/3 · Nenhum modelo baixado. No terminal: <code>ollama pull phi4-mini</code> (o da Microsoft, fala português).'); return mostra(); }
    linhas.push('✅ 2/3 · ' + nomes.length + ' modelo(s): ' + nomes.map(SK.esc).join(', '));
    let modelo = k.model && nomes.includes(k.model) ? k.model : (nomes.find((n) => /phi4|phi3/.test(n)) || nomes.find((n) => /qwen/.test(n)) || nomes.find((n) => /gemma/.test(n)) || nomes[0]);
    if (k.model !== modelo) { k.model = modelo; k.models = nomes; saveKeys(); renderKeySelect(); linhas.push('ℹ Escolhi o modelo <b>' + SK.esc(modelo) + '</b> para você.'); }
    const t0 = Date.now(); const rel = setInterval(() => mostra('⏳ 3/3 · Perguntando ao ' + SK.esc(modelo) + '… ' + Math.round((Date.now() - t0) / 1000) + ' s (a 1ª vez demora: ele carrega na memória)'), 1000);
    try {
      const r = await fetch(B + '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelo, prompt: 'Responda em português do Brasil, em uma frase curta: você está funcionando?', stream: false }) });
      const d = await r.json();
      clearInterval(rel);
      if (!r.ok || d.error) throw new Error(d.error || ('erro ' + r.status));
      linhas.push('✅ 3/3 · Respondeu em ' + Math.round((Date.now() - t0) / 1000) + ' s: <i>"' + SK.esc(String(d.response || '').trim().slice(0, 160)) + '"</i>');
      linhas.push('<b>Tudo certo.</b> Pode usar a IA com o Ollama.');
    } catch (e) { clearInterval(rel); linhas.push('❌ 3/3 · Não respondeu: ' + SK.esc(e.message)); }
    mostra();
  }

  SK.on('project-open', () => { if (box) { loadMemory(); renderLog(); } });
  // Chaves vieram da conta (☁️ cofre): recarrega a lista
  SK.on('cofre-aplicado', () => { keys = SK.pref.get('aiKeys', []); activeKey = SK.pref.get('aiActive', null); if (box) { renderKeys(); renderKeySelect(); updateMeter(); } });
  SK.on('file-open', () => updateMeter());
  SK.on('ai-analyze', (path) => {
    SK.app.openSide('ai');
    freeMode = false; SK.$('#ai-free', box).checked = false; SK.$('#ai-ctx', box).hidden = false;
    if (fs().exists(path)) { SK.editor.open(path, { noFocus: true }); inputEl.value = 'Analise o arquivo "' + path + '": explique o que ele faz em linguagem simples, aponte erros e o que melhorar.'; }
    else inputEl.value = 'Analise a pasta "' + path + '" (arquivos: ' + fs().list().filter((f) => f.startsWith(path + '/')).slice(0, 60).join(', ') + '). Explique a estrutura e aponte problemas.';
    updateMeter(); inputEl.focus();
  });

  SK.ai = { build, chat, listModels, send, get history() { return history; }, render: renderLog, detect, PRESETS, recarregarMemoria: () => { loadMemory(); if (box) renderLog(); } };
})(window.SK);
