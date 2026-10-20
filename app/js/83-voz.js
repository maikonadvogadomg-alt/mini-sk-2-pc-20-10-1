/* =========================================================================
   Mini SK — 83-voz.js
   🗣️ Voz e modo conversa (igual ao jurídico):
   - Voz: Francisca (neural) quando existe no aparelho, velocidade 1,15, tom 0,95.
     No PC, pelo navegador Edge, aparece "Microsoft Francisca Online (Natural)".
     No celular (Chrome) usa a melhor voz em português do Google.
   - Modo conversa: ouve você; quando você para de falar por 3 segundos,
     manda para a IA; lê a resposta em voz alta; volta a ouvir sozinho.
     Se você voltar a falar enquanto ela fala, ela PARA e escuta (igual ao jurídico).
     Toque em ⏹ para parar a qualquer momento.
   ========================================================================= */
(function (SK) {
  'use strict';
  const PADRAO = { nome: 'Francisca', velocidade: 1.15, tom: 0.95, pausa: 3, interromper: true };
  let cfg = Object.assign({}, PADRAO, SK.pref.get('voz', {}));
  const salvar = () => SK.pref.set('voz', cfg);
  const temFala = 'speechSynthesis' in window;
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;

  // ── Vozes ───────────────────────────────────────────────────────────────────
  let vozes = [];
  function carregarVozes() { if (temFala) vozes = speechSynthesis.getVoices().filter((v) => /^pt/i.test(v.lang)); return vozes; }
  if (temFala) { carregarVozes(); speechSynthesis.onvoiceschanged = () => { carregarVozes(); SK.emit('voz-lista'); }; }
  function melhorVoz() {
    const vs = vozes.length ? vozes : carregarVozes();
    const br = vs.filter((v) => /pt[-_]BR/i.test(v.lang));
    const lista = br.length ? br : vs;
    const nome = (cfg.nome || '').toLowerCase();
    return lista.find((v) => nome && v.name.toLowerCase().includes(nome) && /natural|online|neural/i.test(v.name)) ||
      lista.find((v) => nome && v.name.toLowerCase().includes(nome)) ||
      lista.find((v) => /natural|online|neural/i.test(v.name)) ||
      lista.find((v) => /google/i.test(v.name)) || lista[0] || null;
  }

  // ── Falar (em pedaços: o Chrome corta falas longas) ─────────────────────────
  function limpar(t) {
    return String(t || '')
      .replace(/```[\s\S]*?```/g, ' (tem um código na tela) ')
      .replace(/`([^`]+)`/g, '$1').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*#_>|~]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function pedacos(t, max = 220) {
    const out = []; let cur = '';
    for (const f of t.match(/[^.!?;:]+[.!?;:]*\s*/g) || [t]) {
      if ((cur + f).length > max && cur) { out.push(cur.trim()); cur = ''; }
      if (f.length > max) { for (let i = 0; i < f.length; i += max) out.push(f.slice(i, i + max)); continue; }
      cur += f;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  let falando = false, cancelarFala = false, falandoAgora = '';
  async function falar(texto) {
    if (!temFala) return;
    parar();
    cancelarFala = false; falando = true; SK.emit('voz-estado', 'falando');
    const v = melhorVoz();
    for (const p of pedacos(limpar(texto))) {
      if (cancelarFala) break;
      await new Promise((ok) => {
        falandoAgora = p;
        const u = new SpeechSynthesisUtterance(p);
        u.lang = (v && v.lang) || 'pt-BR'; if (v) u.voice = v;
        u.rate = +cfg.velocidade || 1.15; u.pitch = +cfg.tom || 0.95;
        u.onend = ok; u.onerror = ok;
        try { speechSynthesis.speak(u); } catch { ok(); return; }
        // trava conhecida do Chrome: às vezes não chama onend
        const guarda = setInterval(() => { if (!speechSynthesis.speaking && !speechSynthesis.pending) { clearInterval(guarda); ok(); } }, 400);
      });
    }
    falando = false; SK.emit('voz-estado', 'parado');
  }
  function parar() { cancelarFala = true; if (temFala) speechSynthesis.cancel(); falando = false; }

  // ── Modo conversa ───────────────────────────────────────────────────────────
  let conversa = false, rec = null, timer = null, texto = '', aoEnviar = null, aguardando = false, recAtivo = false;
  function estado(e) { SK.emit('voz-estado', e); }
  function ouvir() {
    if (!conversa || !Rec || aguardando) return;
    if (falando && cfg.interromper === false) return;
    texto = '';
    try { rec && rec.abort(); } catch {}
    rec = new Rec(); rec.lang = 'pt-BR'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = (ev) => {
      let fin = '', parcial = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) fin += r[0].transcript; else parcial += r[0].transcript; }
      if (falando) {
        // Ela está falando: é você interrompendo, ou é o microfone ouvindo a própria voz dela (eco)?
        if (ehEco((fin + ' ' + parcial).trim())) return;
        parar(); estado('ouvindo');              // você falou: ela para e escuta
      }
      if (fin) texto += (texto ? ' ' : '') + fin.trim();
      SK.emit('voz-ouvindo', (texto + ' ' + parcial).trim());
      clearTimeout(timer);
      timer = setTimeout(enviarFala, Math.max(1, +cfg.pausa || 3) * 1000);   // ⏱ pausa de silêncio
    };
    rec.onerror = (ev) => { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { SK.toast('Permita o microfone para o Mini SK (cadeado na barra de endereço)', 'error'); desligar(); } };
    rec.onend = () => { recAtivo = false; if (conversa && !aguardando && (!falando || cfg.interromper !== false)) setTimeout(ouvir, 250); };  // o navegador para sozinho de vez em quando: religa
    try { rec.start(); recAtivo = true; if (!falando) estado('ouvindo'); } catch {}
  }
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  // Eco = o que o microfone ouviu são, na maior parte, palavras do que ela está falando agora
  function ehEco(ouvido) {
    const o = norm(ouvido);
    if (o.length < 2) return true;                 // um "é", "ah": não interrompe
    const dela = new Set(norm(falandoAgora));
    const iguais = o.filter((w) => dela.has(w)).length;
    return iguais / o.length >= 0.6;
  }
  function enviarFala() {
    clearTimeout(timer);
    const t = texto.trim(); if (!t || !conversa) return;
    aguardando = true; texto = '';
    try { rec && rec.abort(); } catch {}
    estado('pensando');
    if (aoEnviar) aoEnviar(t);
  }
  // A IA respondeu: fala e volta a ouvir
  SK.on('ai-resposta', async (resp) => {
    if (!conversa) return;
    aguardando = false;
    const fala = falar(resp);
    if (cfg.interromper !== false) setTimeout(ouvir, 300);   // escuta enquanto fala (para poder interromper)
    await fala;
    if (conversa && !aguardando && !recAtivo) ouvir();   // se você já estava falando, não apaga o que disse
  });
  SK.on('ai-falhou', () => { if (conversa) { aguardando = false; ouvir(); } });
  function ligar(enviar) {
    if (!Rec) { SK.toast('Este navegador não tem reconhecimento de voz. Use o Chrome (celular) ou o Edge (PC).', 'error'); return false; }
    aoEnviar = enviar; conversa = true; aguardando = false;
    ouvir(); return true;
  }
  function desligar() {
    conversa = false; aguardando = false; clearTimeout(timer);
    try { rec && rec.abort(); } catch {}
    parar(); estado('desligado');
  }

  // ── Ajustes (montados dentro do painel da IA) ───────────────────────────────
  function ajustesHTML() {
    carregarVozes();
    const atual = melhorVoz();
    return '<div class="stack small">' +
      '<label>Voz <select class="inp tiny" id="voz-nome">' +
        ['Francisca', 'Antonio', 'Thalita', 'Francisco'].concat(vozes.map((v) => v.name)).filter((x, i, a) => a.indexOf(x) === i)
          .map((n) => '<option' + (n === cfg.nome ? ' selected' : '') + '>' + SK.esc(n) + '</option>').join('') + '</select></label>' +
      '<div class="muted">Usando: <b>' + SK.esc(atual ? atual.name : 'voz padrão') + '</b>' + (atual && /natural|online|neural/i.test(atual.name) ? ' (neural ✅)' : ' — a neural Francisca aparece no navegador Edge do PC') + '</div>' +
      '<label>Velocidade <input class="inp tiny" type="number" step="0.05" min="0.5" max="2" id="voz-vel" value="' + cfg.velocidade + '"></label>' +
      '<label>Tom <input class="inp tiny" type="number" step="0.05" min="0.5" max="2" id="voz-tom" value="' + cfg.tom + '"></label>' +
      '<label>Pausa para enviar (segundos) <input class="inp tiny" type="number" step="0.5" min="1" max="10" id="voz-pausa" value="' + cfg.pausa + '"></label>' +
      '<label class="chk"><input type="checkbox" id="voz-interromper"' + (cfg.interromper !== false ? ' checked' : '') + '> Parar de falar quando eu falar (se ela se interromper sozinha, use fone de ouvido ou desmarque)</label>' +
      '<button class="btn tiny" id="voz-teste">▶ Testar a voz</button></div>';
  }
  function ligarAjustes(el) {
    const on = (id, fn) => { const x = SK.$(id, el); if (x) x.onchange = fn; };
    on('#voz-nome', (e) => { cfg.nome = e.target.value; salvar(); SK.emit('voz-lista'); });
    on('#voz-vel', (e) => { cfg.velocidade = +e.target.value || 1.15; salvar(); });
    on('#voz-tom', (e) => { cfg.tom = +e.target.value || 0.95; salvar(); });
    on('#voz-pausa', (e) => { cfg.pausa = +e.target.value || 3; salvar(); });
    on('#voz-interromper', (e) => { cfg.interromper = e.target.checked; salvar(); });
    const t = SK.$('#voz-teste', el); if (t) t.onclick = () => falar('Olá! Esta é a voz do Mini SK, com velocidade ' + String(cfg.velocidade).replace('.', ',') + ' e tom ' + String(cfg.tom).replace('.', ',') + '.');
  }

  SK.voz = { falar, parar, ligar, desligar, get conversa() { return conversa; }, get falando() { return falando; }, ajustesHTML, ligarAjustes, melhorVoz, cfg: () => cfg };
})(window.SK);
