/* =========================================================================
   Mini SK — 86g-largura.js
   ↔ Arraste a borda esquerda do painel (🤖 IA, 💻 Terminal…) para deixar
   mais largo ou mais estreito. Fica guardado. No PC, o 💻 Terminal já abre
   largo (antes ficava espremido em 400px e não dava para ler).
   ========================================================================= */
(function (SK) {
  'use strict';
  const PC = !!window.miniskPC;
  if (PC) document.body.classList.add('no-pc');
  function aplicar() {
    const lado = document.body.dataset.lado;
    const chave = lado === 'termux' && PC ? 'larguraTerminal' : 'larguraPainel';
    const w = SK.pref.get(chave, 0);
    const el = document.getElementById('side'); if (!el) return;
    el.style.width = w && window.innerWidth > 820 ? w + 'px' : '';
  }
  function ligar() {
    const side = document.getElementById('side'); if (!side || document.getElementById('side-alca')) return;
    const alca = document.createElement('div'); alca.id = 'side-alca'; alca.title = 'Arraste para mudar a largura · 2 toques: volta ao normal';
    side.appendChild(alca);
    let x0 = 0, w0 = 0;
    const mover = (e) => { const w = Math.max(280, Math.min(window.innerWidth - 240, w0 + (x0 - e.clientX))); side.style.width = w + 'px'; };
    const soltar = () => {
      alca.classList.remove('arrastando'); window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar);
      const chave = document.body.dataset.lado === 'termux' && PC ? 'larguraTerminal' : 'larguraPainel';
      SK.pref.set(chave, parseInt(side.style.width, 10) || 0);
      window.dispatchEvent(new Event('resize')); // o terminal se ajusta à largura nova
    };
    alca.addEventListener('pointerdown', (e) => { e.preventDefault(); x0 = e.clientX; w0 = side.getBoundingClientRect().width; alca.classList.add('arrastando'); window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar); });
    alca.addEventListener('dblclick', () => { const chave = document.body.dataset.lado === 'termux' && PC ? 'larguraTerminal' : 'larguraPainel'; SK.pref.set(chave, 0); side.style.width = ''; window.dispatchEvent(new Event('resize')); });
    new MutationObserver(aplicar).observe(document.body, { attributes: true, attributeFilter: ['data-lado'] });
    aplicar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();
})(window.SK);
