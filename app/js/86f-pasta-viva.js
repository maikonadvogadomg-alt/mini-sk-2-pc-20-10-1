/* =========================================================================
   Mini SK — 86f-pasta-viva.js   (SÓ no Mini SK para PC)
   📁 PASTA VIVA: igual ao VS Code. Cada projeto é uma pasta de verdade no
   computador (Documentos\Mini-SK\NOME-DO-PROJETO) e fica SEMPRE igual à árvore:
   - você mexe na árvore/editor  → vai sozinho para a pasta;
   - o terminal cria/muda/apaga  → aparece sozinho na árvore (a cada 2 s).
   Sem "ponte", sem botão de mandar/trazer. O terminal já abre dentro da pasta.
   ========================================================================= */
(function (SK) {
  'use strict';
  const PC = window.miniskPC;
  if (!PC) return;                       // no celular nada muda (lá é o Termux)
  const API = 'http://127.0.0.1:' + ((PC.portas && PC.portas.ponte) || 7682);
  const SEP = PC.so === 'win32' ? '\\' : '/';
  const PULAR = /(^|\/)(node_modules|\.git|\.sk|\.gradle|\.cache)(\/|$)/;
  let projeto = null, desde = 0, aplicando = false, pronto = false, ocupado = false;
  let conhecidos = new Set();            // o que existia na pasta na última olhada
  const enviado = new Map();             // caminho → "assinatura" do que mandamos (para não voltar o eco)
  const fila = new Set(), apagar = new Set();
  let tFila = 0, tPoll = 0, ultimoErro = '';

  const nomeProj = () => String((SK.fs.project && SK.fs.project.name) || 'projeto').replace(/[^\w.\- ]+/g, '_').replace(/^\.+/, '').slice(0, 60) || 'projeto';
  const pasta = () => PC.pasta + SEP + nomeProj();
  function assin(s) { s = String(s || ''); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; }
  const assinRec = (rec) => rec ? (rec.b64 != null ? 'b' + assin(rec.b64) : 't' + assin(rec.text)) : '';
  function estado(texto, tipo) { SK.emit('pasta-viva', { texto, tipo: tipo || '', pasta: pasta() }); }

  async function chamar(caminho, corpo) {
    const r = await fetch(API + caminho, { method: corpo ? 'POST' : 'GET', headers: Object.assign({ 'X-Codigo': PC.codigo }, corpo ? { 'Content-Type': 'application/json' } : {}), body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  }
  function item(p) {
    const rec = SK.fs.get(p); if (!rec) return null;
    const it = rec.b64 != null ? { p, b64: rec.b64 } : { p, t: rec.text || '' };
    enviado.set(p, assinRec(rec));
    return it;
  }
  async function mandar(caminhos) {
    let lote = [], tam = 0;
    const ir = async () => { if (!lote.length) return; await chamar('/enviar', { projeto, arquivos: lote }); lote = []; tam = 0; };
    for (const p of caminhos) {
      if (PULAR.test(p)) continue;
      const it = item(p); if (!it) continue;
      lote.push(it); tam += (it.b64 || it.t).length;
      if (tam > 3e6) await ir();
    }
    await ir();
  }

  // ── 1) ao abrir um projeto: traz o que mudou na pasta e manda o resto ─────────
  async function iniciar() {
    if (!SK.fs.project) return;
    pronto = false; projeto = nomeProj(); enviado.clear(); fila.clear(); apagar.clear();
    desde = SK.pref.get('pastaViva:' + projeto, 0);
    estado('Ligando a pasta…');
    try {
      await olhar(true);                               // o que o terminal fez enquanto o Mini SK estava fechado
      await mandar(SK.fs.list());                      // garante a pasta igual à árvore
      for (const d of (SK.fs.project.folders || [])) if (!PULAR.test(d)) await chamar('/enviar', { projeto, arquivos: [{ p: d, pasta: true }] }).catch(() => {});
      const r = await chamar('/listar?projeto=' + encodeURIComponent(projeto) + '&desde=' + Date.now());
      conhecidos = new Set(r.todos || []); desde = r.agora; SK.pref.set('pastaViva:' + projeto, desde);
      pronto = true; ultimoErro = '';
      estado('🔄 Pasta viva ligada: árvore ⇄ ' + pasta(), 'ok');
      SK.emit('pasta-viva-pronta', { pasta: pasta() });
    } catch (e) { estado('⚠ A pasta não respondeu (' + e.message + '). Feche e abra o Mini SK.', 'erro'); }
  }

  // ── 2) da pasta para a árvore (a cada 2 segundos) ────────────────────────────
  async function olhar(primeira) {
    if (!projeto || ocupado) return;
    ocupado = true;
    try {
      const r = await chamar('/listar?projeto=' + encodeURIComponent(projeto) + '&desde=' + desde);
      let novos = 0, mudou = 0, sumiu = 0;
      aplicando = true;
      try {
        for (const a of r.arquivos || []) {
          if (PULAR.test(a.p) || fila.has(a.p)) continue;
          const rec = SK.fs.recordFromBytes(a.p, SK.fs.fromBase64(a.b64));
          const ass = assinRec(rec);
          if (enviado.get(a.p) === ass) continue;          // é o eco do que nós mesmos mandamos
          const antes = SK.fs.exists(a.p) ? SK.fs.get(a.p) : null;
          if (antes && assinRec(antes) === ass) { enviado.set(a.p, ass); continue; }
          if (!primeira && !novos && !mudou && SK.checkpoints && antes) await SK.checkpoints.auto('Antes de receber mudanças da pasta');
          if (rec.text != null) SK.fs.write(a.p, rec.text, { silent: true }); else SK.fs.writeRecord(a.p, rec);
          enviado.set(a.p, ass); antes ? mudou++ : novos++;
        }
        // apagado na pasta (pelo terminal) → apaga na árvore. Só o que JÁ estava na pasta antes.
        if (!primeira && r.todos) {
          const agora = new Set(r.todos);
          for (const p of conhecidos) if (!PULAR.test(p) && !agora.has(p) && !fila.has(p) && SK.fs.exists(p)) /* .sk (diário da IA) e node_modules nunca vão para a pasta: não podem ser apagados por isso */ { SK.fs.remove(p); enviado.delete(p); sumiu++; }
          conhecidos = agora;
        }
      } finally { aplicando = false; }
      desde = r.agora; SK.pref.set('pastaViva:' + projeto, desde);
      if (novos || mudou || sumiu) {
        SK.emit('fs-change', { type: 'import' });
        estado('🔄 Da pasta: ' + [novos && novos + ' novo(s)', mudou && mudou + ' mudado(s)', sumiu && sumiu + ' apagado(s)'].filter(Boolean).join(', ') + ' · ' + new Date().toLocaleTimeString('pt-BR'), 'ok');
      }
      if (ultimoErro) { ultimoErro = ''; estado('🔄 Pasta viva ligada: árvore ⇄ ' + pasta(), 'ok'); }
    } catch (e) {
      if (ultimoErro !== e.message) { ultimoErro = e.message; estado('⚠ Pasta sem resposta: ' + e.message, 'erro'); }
    } finally { ocupado = false; }
  }

  // ── 3) da árvore para a pasta (logo depois de você mexer) ────────────────────
  SK.on('fs-change', (c) => {
    if (!pronto || aplicando || !c) return;
    if (c.type === 'import' || !c.path) { for (const p of SK.fs.list()) { if (PULAR.test(p)) continue; const rec = SK.fs.get(p); if (enviado.get(p) !== assinRec(rec)) fila.add(p); } }
    else if (c.type === 'remove') { apagar.add(c.path); for (const p of [...fila]) if (p === c.path || p.startsWith(c.path + '/')) fila.delete(p); }
    else if (c.type === 'rename') { apagar.add(c.from); for (const p of SK.fs.list()) if (p === c.path || p.startsWith(c.path + '/')) fila.add(p); }
    else if (c.type === 'mkdir') { chamar('/enviar', { projeto, arquivos: [{ p: c.path, pasta: true }] }).catch(() => {}); return; }
    else if (!PULAR.test(c.path)) fila.add(c.path);
    clearTimeout(tFila); tFila = setTimeout(esvaziar, 600);
  });
  async function esvaziar() {
    if (!pronto) return;
    const mandarJa = [...fila]; fila.clear();
    const apagarJa = [...apagar]; apagar.clear();
    try {
      if (apagarJa.length) { await chamar('/apagar', { projeto, caminhos: apagarJa }); apagarJa.forEach((p) => { for (const k of [...conhecidos]) if (k === p || k.startsWith(p + '/')) conhecidos.delete(k); }); }
      if (mandarJa.length) { await mandar(mandarJa); mandarJa.forEach((p) => { if (!PULAR.test(p)) conhecidos.add(p); }); }
      if (mandarJa.length || apagarJa.length) estado('💾 Na pasta: ' + (mandarJa.length ? mandarJa.length + ' salvo(s)' : '') + (apagarJa.length ? (mandarJa.length ? ', ' : '') + apagarJa.length + ' apagado(s)' : '') + ' · ' + new Date().toLocaleTimeString('pt-BR'), 'ok');
    } catch (e) { mandarJa.forEach((p) => fila.add(p)); apagarJa.forEach((p) => apagar.add(p)); estado('⚠ Não consegui gravar na pasta: ' + e.message, 'erro'); clearTimeout(tFila); tFila = setTimeout(esvaziar, 3000); }
  }

  SK.on('project-open', () => { pronto = false; setTimeout(iniciar, 200); });
  clearInterval(tPoll);
  tPoll = setInterval(() => { if (pronto && !document.hidden) olhar(false); }, 2000);
  window.addEventListener('focus', () => { if (pronto) olhar(false); });
  if (SK.fs.project) setTimeout(iniciar, 400);

  SK.pastaViva = { get pasta() { return pasta(); }, get pronto() { return pronto; }, abrirNoWindows: () => PC.abrirPasta && PC.abrirPasta(pasta()), atualizar: () => olhar(false), reiniciar: iniciar };
})(window.SK);
