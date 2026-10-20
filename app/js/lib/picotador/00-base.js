/* Picotador — 00-base.js: peças comuns (tela, avisos, baixar, tamanhos). */
(function () {
  'use strict';
  const PT = window.PT = { estado: {} };
  PT.$ = (s, el) => (el || document).querySelector(s);
  PT.$$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  PT.esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  PT.kb = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1).replace('.', ',') + ' KB' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
  PT.hoje = () => new Date().toISOString().slice(0, 10);
  PT.nomeSeguro = (t) => String(t || 'sem-nome').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'sem-nome';
  let tAviso = 0;
  PT.aviso = (t, tipo) => {
    const el = PT.$('#aviso'); el.textContent = t; el.className = 'aviso ' + (tipo || ''); el.hidden = false;
    clearTimeout(tAviso); tAviso = setTimeout(() => { el.hidden = true; }, tipo === 'erro' ? 7000 : 3500);
  };
  // baixa um arquivo; se o navegador deixar, oferece também "compartilhar" (bom no celular)
  PT.baixar = async (nome, conteudo, tipo) => {
    const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    PT.aviso('⬇ Baixado: ' + nome + ' (' + PT.kb(blob.size) + ')', 'ok');
  };
  PT.compartilhar = async (nome, conteudo, tipo) => {
    const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo || 'application/octet-stream' });
    const f = new File([blob], nome, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: nome }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    PT.baixar(nome, blob);
  };
  PT.podeCompartilhar = () => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.txt', { type: 'text/plain' })] })); } catch { return false; } };
  // botões "Baixar" + "Compartilhar" para um resultado
  // padrão: baixar. Se marcar "📤 Compartilhar" lá em cima (bom no APK), abre o compartilhar do Android.
  PT.saida = (nome, conteudo, tipo) => { const c = document.getElementById('modo-compartilhar'); if (c && c.checked) PT.compartilhar(nome, conteudo, tipo); else PT.baixar(nome, conteudo, tipo); };
})();
