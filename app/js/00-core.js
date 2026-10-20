/* =========================================================================
   Mini SK — 00-core.js
   Base de tudo: atalhos, eventos, avisos, janelas de confirmação e o
   banco de dados do navegador (IndexedDB), onde os projetos ficam salvos.
   ========================================================================= */
window.SK = window.SK || {};
(function (SK) {
  'use strict';

  SK.version = '2026.10.20-sk2';
  SK.versaoTexto = 'Mini SK 2 · 20/10 — abre .tar, 📱 Termux igual ao Node, 💻 terminal largo no PC';
  SK.$ = (s, r) => (r || document).querySelector(s);
  SK.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  SK.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  SK.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  SK.fmt = (n) => Number(n || 0).toLocaleString('pt-BR');
  SK.bytes = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
  SK.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // ── Eventos entre módulos (cada módulo conversa pelos eventos, não direto) ──
  const listeners = {};
  SK.on = (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); return () => { listeners[name] = listeners[name].filter((f) => f !== fn); }; };
  SK.emit = (name, data) => { (listeners[name] || []).slice().forEach((fn) => { try { fn(data); } catch (e) { console.error('[evento ' + name + ']', e); } }); };

  // ── Aviso rápido na parte de baixo ──────────────────────────────────────────
  let toastTimer;
  SK.toast = (msg, kind) => {
    let el = SK.$('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg;
    el.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, kind === 'error' ? 6000 : 3200);
  };

  // ── Janela própria (confirm/prompt do navegador falham em alguns celulares) ──
  function modal({ title, message, input, value, okText, cancelText, danger }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal-wrap';
      wrap.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true">' +
        (title ? '<h3>' + SK.esc(title) + '</h3>' : '') +
        (message ? '<p>' + SK.esc(message) + '</p>' : '') +
        (input ? '<input class="inp" type="text" spellcheck="false" autocomplete="off">' : '') +
        '<div class="row end"><button class="btn" data-x="no">' + SK.esc(cancelText || 'Cancelar') + '</button>' +
        '<button class="btn ' + (danger ? 'danger' : 'primary') + '" data-x="ok">' + SK.esc(okText || 'OK') + '</button></div></div>';
      document.body.appendChild(wrap);
      const inp = SK.$('input', wrap);
      if (inp) { inp.value = value || ''; setTimeout(() => { inp.focus(); const dot = inp.value.lastIndexOf('.'); inp.setSelectionRange(0, dot > 0 ? dot : inp.value.length); }, 30); }
      else setTimeout(() => SK.$('[data-x="ok"]', wrap).focus(), 30);
      const done = (ok) => { wrap.remove(); resolve(input ? (ok ? inp.value : null) : ok); };
      wrap.addEventListener('click', (e) => { const x = e.target.closest('[data-x]'); if (x) done(x.dataset.x === 'ok'); else if (e.target === wrap) done(false); });
      wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(false); if (e.key === 'Enter' && (input || e.target.tagName !== 'BUTTON')) { e.preventDefault(); done(true); } });
    });
  }
  SK.confirm = (message, opts) => modal(Object.assign({ message, okText: 'Confirmar' }, opts || {}));
  SK.prompt = (message, value, opts) => modal(Object.assign({ message, input: true, value }, opts || {}));

  // ── Baixar arquivo ──────────────────────────────────────────────────────────
  SK.download = (name, data, mime) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
    // Dentro do APK (WebView) o navegador não baixa sozinho: o app Android salva em Downloads.
    if (window.AndroidBridge && window.AndroidBridge.salvar) {
      const r = new FileReader();
      r.onload = () => { const res = window.AndroidBridge.salvar(name, String(r.result).split(',')[1] || '', blob.type || ''); if (res !== 'ok') SK.toast('Não consegui salvar: ' + res, 'error'); };
      r.readAsDataURL(blob);
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };
  // ── Mandar para o Drive / WhatsApp / e-mail (o "Compartilhar" do celular) ──
  // Abre a lista do aparelho e você escolhe o Drive. Sem cadastro no Google.
  // Onde não existe (PC antigo, APK sem ponte): baixa o arquivo.
  SK.compartilhar = async (name, data, mime) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    try {
      const file = new File([blob], name, { type: blob.type || mime || 'application/octet-stream' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return 'compartilhado'; }
    } catch (e) { if (e && e.name === 'AbortError') return 'cancelado'; }
    SK.download(name, blob, mime);
    SK.toast('Este aparelho não abriu o "Compartilhar": o arquivo foi baixado. Mande para o Drive pelo app do Drive (＋ → Enviar).');
    return 'baixado';
  };
  SK.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); SK.toast('Copiado'); }
    catch { const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); SK.toast('Copiado'); } catch { SK.toast('Não consegui copiar', 'error'); } ta.remove(); }
  };

  // ── Configurações pequenas (localStorage) ───────────────────────────────────
  SK.pref = {
    get(k, def) { try { const v = localStorage.getItem('minisk2:' + k); return v == null ? def : JSON.parse(v); } catch { return def; } },
    set(k, v) { try { localStorage.setItem('minisk2:' + k, JSON.stringify(v)); } catch {} },
  };

  // ── Banco do navegador (IndexedDB): aguenta projetos grandes ────────────────
  const DB_NAME = 'mini-sk-2', DB_VER = 1; // Mini SK 2: projetos separados do Mini SK original
  let dbPromise = null;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'name' });
        if (!db.objectStoreNames.contains('checkpoints')) {
          const s = db.createObjectStore('checkpoints', { keyPath: 'id' });
          s.createIndex('project', 'project');
        }
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  function tx(store, mode, fn) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      fn(t.objectStore(store));
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Não consegui salvar (o espaço do navegador pode estar cheio)'));
    }));
  }
  const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  SK.db = {
    get: (store, key) => openDB().then((db) => reqP(db.transaction(store).objectStore(store).get(key))),
    all: (store) => openDB().then((db) => reqP(db.transaction(store).objectStore(store).getAll())),
    allByIndex: (store, index, value) => openDB().then((db) => reqP(db.transaction(store).objectStore(store).index(index).getAll(value))),
    put: (store, value, key) => tx(store, 'readwrite', (s) => { key === undefined ? s.put(value) : s.put(value, key); }),
    del: (store, key) => tx(store, 'readwrite', (s) => { s.delete(key); }),
  };
  SK.storageInfo = async () => {
    try { const e = await navigator.storage.estimate(); return e; } catch { return null; }
  };
  // Pede ao navegador para não apagar os dados quando faltar espaço
  SK.persistStorage = async () => { try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch {} return false; };
})(window.SK);
