/* =========================================================================
   Mini SK — 81-gasto.js
   💰 Quanto a IA está gastando.
   - Depois de cada resposta: tokens de entrada (↑ o que foi enviado),
     tokens de saída (↓ o que a IA escreveu) e o custo em reais.
   - Totais de hoje e do mês, por modelo.
   - Limite do mês e aviso antes de um pedido caro.
   Os preços são por 1 milhão de tokens, em dólar (como os sites mostram).
   Dá para mudar qualquer preço e a cotação do dólar no painel.
   ========================================================================= */
(function (SK) {
  'use strict';
  const KEY = 'ai:gasto';
  // [padrão no nome do modelo, entrada US$/1M, saída US$/1M]
  const PRECOS = [
    [/claude-?opus-4-?[5-9]|opus-4\.[5-9]/, 5, 25], [/claude-?opus/, 15, 75],
    [/claude-?sonnet|claude-3-5-sonnet|claude-3-7-sonnet/, 3, 15],
    [/claude-?haiku-4|haiku-4/, 1, 5], [/claude-3-5-haiku/, 0.8, 4], [/claude-3-haiku/, 0.25, 1.25],
    [/gpt-5-nano/, 0.05, 0.4], [/gpt-5-mini/, 0.25, 2], [/gpt-5/, 1.25, 10],
    [/gpt-4\.1-nano/, 0.1, 0.4], [/gpt-4\.1-mini/, 0.4, 1.6], [/gpt-4\.1/, 2, 8],
    [/gpt-4o-mini/, 0.15, 0.6], [/gpt-4o/, 2.5, 10], [/o4-mini|o3-mini/, 1.1, 4.4], [/\bo3\b/, 2, 8],
    [/gemini-2\.5-pro|gemini-3.*pro/, 1.25, 10], [/gemini-2\.5-flash-lite|flash-lite/, 0.1, 0.4], [/gemini-2\.5-flash|gemini-3.*flash/, 0.3, 2.5],
    [/gemini-2\.0-flash/, 0.1, 0.4], [/gemini-1\.5-flash/, 0.075, 0.3],
    [/grok-3-mini|grok-.*mini/, 0.3, 0.5], [/grok/, 3, 15],
    [/deepseek-r1|deepseek-reasoner/, 0.55, 2.2], [/deepseek/, 0.27, 1.1],
    [/llama-3\.1-8b|llama3-8b|8b-instant/, 0.05, 0.08], [/llama-3\.3-70b|70b/, 0.59, 0.79],
    [/sonar-pro/, 3, 15], [/sonar/, 1, 1],
  ];
  // Provedores que, do jeito que o Mini SK usa, são grátis (dentro da cota)
  const GRATIS = { groq: 'grátis (cota do Groq)', gemini: 'grátis se estiver na cota gratuita do Google' };

  let ledger = [];
  SK.db.get('kv', KEY).then((l) => { if (Array.isArray(l)) ledger = l; SK.emit('gasto-mudou'); }).catch(() => {});
  const dolar = () => Number(SK.pref.get('dolar', 5.4)) || 5.4;
  const limiteMes = () => Number(SK.pref.get('aiLimiteMes', 0)) || 0;     // R$; 0 = sem limite
  const avisoPedido = () => Number(SK.pref.get('aiAvisoPedido', 0.5)) || 0; // R$

  /** Preço em US$ por 1M tokens: { in, out, gratis? } ou null se não souber. */
  function preco(presetId, model) {
    const m = String(model || '').toLowerCase();
    const custom = SK.pref.get('aiPrecos', {});
    for (const k in custom) if (k && m.includes(k.toLowerCase())) return { in: +custom[k][0] || 0, out: +custom[k][1] || 0 };
    if (/:free\b/.test(m)) return { in: 0, out: 0, gratis: 'grátis (modelo free)' };
    if (GRATIS[presetId]) return { in: 0, out: 0, gratis: GRATIS[presetId] };
    const name = m.replace(/^[^/]+\//, '');
    for (const [re, i, o] of PRECOS) if (re.test(name)) return { in: i, out: o };
    return null;
  }
  const brl = (usd) => usd * dolar();
  const fmt = (v) => 'R$ ' + (v < 0.01 && v > 0 ? v.toFixed(4) : v.toFixed(2)).replace('.', ',');
  const k = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',') + ' mil' : String(n);

  function custo(presetId, model, tin, tout) {
    const p = preco(presetId, model);
    if (!p) return null;
    return (tin * p.in + tout * p.out) / 1e6;
  }

  /** Registra um pedido feito. Devolve o texto curto para mostrar na resposta. */
  function registra({ preset, model, tin, tout, estimado }) {
    const usd = custo(preset, model, tin, tout);
    const p = preco(preset, model);
    ledger.push({ t: Date.now(), preset, model, tin, tout, usd, est: !!estimado });
    if (ledger.length > 3000) ledger = ledger.slice(-3000);
    SK.db.put('kv', ledger, KEY).catch(() => {});
    SK.emit('gasto-mudou');
    return (estimado ? '≈ ' : '') + '↑ ' + k(tin) + ' · ↓ ' + k(tout) + ' tokens · ' +
      (p && p.gratis ? p.gratis : usd == null ? 'preço desconhecido (ajuste em 💰)' : fmt(brl(usd))) + ' · ' + model;
  }

  function totais() {
    const now = new Date(), d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let hoje = 0, mes = 0, nHoje = 0, nMes = 0; const porModelo = {};
    for (const e of ledger) {
      const v = e.usd ? brl(e.usd) : 0;
      if (e.t >= m0) { mes += v; nMes++; const pm = porModelo[e.model] = porModelo[e.model] || { v: 0, n: 0, tin: 0, tout: 0 }; pm.v += v; pm.n++; pm.tin += e.tin; pm.tout += e.tout; }
      if (e.t >= d0) { hoje += v; nHoje++; }
    }
    return { hoje, mes, nHoje, nMes, porModelo };
  }

  /** Antes de enviar: avisa se o pedido parece caro ou se passou do limite. */
  async function antes(presetId, model, tin) {
    const usd = custo(presetId, model, tin, 2000);
    const t = totais(), lim = limiteMes();
    if (lim && t.mes >= lim) {
      if (!(await SK.confirm('💰 Você já gastou ' + fmt(t.mes) + ' este mês (seu limite é ' + fmt(lim) + '). Mandar mesmo assim?', { okText: 'Mandar' }))) return false;
    }
    if (usd != null && avisoPedido() && brl(usd) >= avisoPedido()) {
      if (!(await SK.confirm('💰 Este pedido vai mandar uns ' + k(tin) + ' tokens e deve custar perto de ' + fmt(brl(usd)) + ' (' + model + ').\n\nPara gastar menos: desmarque "Arquivo aberto" ou use um modelo mais barato.\n\nMandar?', { okText: 'Mandar' }))) return false;
    }
    return true;
  }
  /** Estimativa curta para o medidor (antes de mandar). */
  function previa(presetId, model, tin) {
    const p = preco(presetId, model);
    if (!p) return '';
    if (p.gratis) return ' · grátis';
    return ' · ≈ ' + fmt(brl((tin * p.in + 2000 * p.out) / 1e6)) + ' por pedido';
  }

  function resumoHTML() {
    const t = totais(), lim = limiteMes();
    return '💰 Hoje <b>' + fmt(t.hoje) + '</b> · Mês <b>' + fmt(t.mes) + '</b>' + (lim ? ' / ' + fmt(lim) + (t.mes >= lim ? ' ⚠' : '') : '');
  }

  async function painel() {
    const t = totais();
    const rows = Object.entries(t.porModelo).sort((a, b) => b[1].v - a[1].v);
    const ult = ledger.slice(-15).reverse();
    const w = document.createElement('div'); w.className = 'modal-wrap';
    w.innerHTML = '<div class="modal gasto-modal" role="dialog" aria-modal="true"><h3>💰 Gasto com IA</h3>' +
      '<p class="small">Hoje: <b>' + fmt(t.hoje) + '</b> (' + t.nHoje + ' pedidos) · Este mês: <b>' + fmt(t.mes) + '</b> (' + t.nMes + ' pedidos)</p>' +
      (rows.length ? '<table class="gasto-t"><tr><th>Modelo (mês)</th><th>Pedidos</th><th>↑ / ↓ tokens</th><th>Custo</th></tr>' + rows.map(([m, v]) => '<tr><td>' + SK.esc(m) + '</td><td>' + v.n + '</td><td>' + k(v.tin) + ' / ' + k(v.tout) + '</td><td>' + fmt(v.v) + '</td></tr>').join('') + '</table>' : '<p class="muted small">Nenhum pedido este mês.</p>') +
      (ult.length ? '<details><summary class="small">Últimos pedidos</summary><div class="small mono gasto-ult">' + ult.map((e) => new Date(e.t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + ' · ' + SK.esc(e.model) + ' · ↑' + k(e.tin) + ' ↓' + k(e.tout) + ' · ' + (e.usd == null ? '?' : fmt(brl(e.usd))) + (e.est ? ' (estimado)' : '')).join('<br>') + '</div></details>' : '') +
      '<div class="stack" style="margin-top:8px">' +
      '<label class="small">Limite do mês (R$, 0 = sem limite) <input class="inp" id="g-lim" type="number" min="0" step="1" value="' + limiteMes() + '"></label>' +
      '<label class="small">Avisar antes de pedido acima de (R$) <input class="inp" id="g-aviso" type="number" min="0" step="0.1" value="' + avisoPedido() + '"></label>' +
      '<label class="small">Cotação do dólar (R$) <input class="inp" id="g-dolar" type="number" min="1" step="0.01" value="' + dolar() + '"></label>' +
      '<label class="small">Preços próprios (um por linha: <code>parte-do-nome-do-modelo = entrada, saída</code> em US$ por 1 milhão)<textarea class="inp mono" id="g-precos" rows="3" placeholder="claude-haiku = 1, 5">' + SK.esc(Object.entries(SK.pref.get('aiPrecos', {})).map(([n, v]) => n + ' = ' + v[0] + ', ' + v[1]).join('\n')) + '</textarea></label>' +
      '<p class="muted small" style="margin:0">↑ entrada = o que vai na pergunta (arquivo aberto, diário, conversa). É o que mais pesa. ↓ saída = o que a IA escreve. Quando o provedor não informa os tokens, o número é estimado (≈).</p>' +
      '</div><div class="row end"><button class="btn danger" data-x="zerar">Zerar histórico</button><button class="btn" data-x="no">Fechar</button><button class="btn primary" data-x="ok">Salvar</button></div></div>';
    document.body.appendChild(w);
    w.addEventListener('click', async (e) => {
      const x = e.target.closest('[data-x]'); if (!x && e.target !== w) return;
      if (x && x.dataset.x === 'zerar') { if (!(await SK.confirm('Apagar todo o histórico de gasto?', { okText: 'Apagar', danger: true }))) return; ledger = []; await SK.db.put('kv', ledger, KEY); SK.emit('gasto-mudou'); w.remove(); return; }
      if (x && x.dataset.x === 'ok') {
        SK.pref.set('aiLimiteMes', Math.max(0, +w.querySelector('#g-lim').value || 0));
        SK.pref.set('aiAvisoPedido', Math.max(0, +w.querySelector('#g-aviso').value || 0));
        SK.pref.set('dolar', Math.max(1, +w.querySelector('#g-dolar').value || 5.4));
        const pr = {};
        w.querySelector('#g-precos').value.split('\n').forEach((l) => { const m = l.match(/^\s*([^=]+?)\s*=\s*([\d.,]+)\s*[,;]\s*([\d.,]+)/); if (m) pr[m[1]] = [parseFloat(m[2].replace(',', '.')), parseFloat(m[3].replace(',', '.'))]; });
        SK.pref.set('aiPrecos', pr);
        SK.emit('gasto-mudou'); SK.toast('💰 Salvo', 'ok');
      }
      w.remove();
    });
  }

  SK.gasto = { preco, custo, registra, totais, antes, previa, resumoHTML, painel, get ledger() { return ledger; } };
})(window.SK);
