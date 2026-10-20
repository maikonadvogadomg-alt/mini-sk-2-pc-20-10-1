/* =========================================================================
   Mini SK — 92c-importar.js
   📥 IMPORTAR TUDO / ✂️ PICOTAR — o Picotador dentro do Mini SK 2.
   Abre memória, backup de tudo, projeto .zip e conversas do ChatGPT/Claude,
   deixa escolher só o pedaço, e TRAZ DIRETO para o Mini SK (sem baixar nada):
   - projetos do backup → viram projetos aqui (do jeito original);
   - a conversa escolhida → vira a memória da 🤖 IA do projeto aberto.
   As peças ficam em js/lib/picotador/ (as mesmas do Picotador solto).
   ========================================================================= */
(function (SK) {
  'use strict';
  const PT = window.PT; if (!PT) return;
  const fs = () => SK.fs;

  async function trazerProjetos(projs) {
    if (!projs.length) return;
    const existem = new Set((await fs().listProjects()).map((p) => p.name));
    const iguais = projs.filter((p) => existem.has(p.name));
    if (!(await SK.confirm('Trazer ' + projs.length + ' projeto(s) para o Mini SK?\n\n' + projs.map((p) => '• ' + p.name + ' (' + Object.keys(p.files || {}).length + ' arquivos)').slice(0, 12).join('\n'), { okText: 'Trazer' }))) return;
    let copia = false;
    if (iguais.length) copia = !(await SK.confirm(iguais.length + ' já existe(m) aqui com o mesmo nome:\n' + iguais.map((p) => '• ' + p.name).join('\n') + '\n\nSubstituir pelo que veio? (Cancelar = guardar como cópia, com outro nome)', { okText: 'Substituir', cancelText: 'Guardar como cópia' }));
    await fs().saveNow();
    if (SK.checkpoints && fs().project && iguais.some((p) => p.name === fs().project.name) && !copia) await SK.checkpoints.auto('Antes de importar por cima');
    const nomes = [];
    for (const p of projs) {
      const c = JSON.parse(JSON.stringify(p));
      c.files = c.files || {}; c.folders = c.folders || []; c.open = (c.open || []).filter((f) => c.files[f]); c.active = c.files[c.active] ? c.active : null;
      if (copia && existem.has(c.name)) c.name = c.name + ' (importado ' + new Date().toLocaleString('pt-BR').replace(/[/:]/g, '-') + ')';
      c.updated = Date.now();
      await SK.db.put('projects', c); nomes.push(c.name);
    }
    const atual = fs().project && fs().project.name;
    await fs().open(nomes.includes(atual) ? atual : nomes[0]);
    SK.toast('📥 ' + nomes.length + ' projeto(s) no Mini SK. Aberto: ' + (nomes.includes(atual) ? atual : nomes[0]), 'ok');
    PT.aviso('✅ Trazido para o Mini SK: ' + nomes.join(', '), 'ok');
  }

  async function porMemoria(msgs, diario, titulo) {
    if (!fs().project) { PT.aviso('Abra um projeto no Mini SK primeiro.', 'erro'); return; }
    const nome = fs().project.name;
    let atual = [];
    try { const t = fs().read('.sk/memoria.json'); const d = t ? JSON.parse(t) : []; atual = Array.isArray(d) ? d : (d.historico || []); } catch {}
    let juntar = false;
    if (atual.length) juntar = await SK.confirm('O projeto "' + nome + '" já tem ' + atual.length + ' mensagens na memória.\n\nJuntar as ' + msgs.length + ' novas no fim? (Cancelar = substituir pela que veio)', { okText: 'Juntar', cancelText: 'Substituir' });
    else if (!(await SK.confirm('Pôr ' + msgs.length + ' mensagens como memória da IA do projeto "' + nome + '"?', { okText: 'Pôr' }))) return;
    if (SK.checkpoints) await SK.checkpoints.auto('Antes de trocar a memória da IA');
    fs().write('.sk/memoria.json', JSON.stringify((juntar ? atual.concat(msgs) : msgs).slice(-2000), null, 1));
    if (diario) { const d0 = fs().read('.sk/diario.md') || ''; fs().write('.sk/diario.md', d0 && d0 !== diario ? d0 + '\n\n---\n(diário trazido de ' + (titulo || 'outro lugar') + ')\n' + diario : diario); }
    if (SK.ai && SK.ai.recarregarMemoria) SK.ai.recarregarMemoria();
    SK.toast('🧠 Memória da IA do projeto "' + nome + '": ' + (juntar ? atual.length + msgs.length : msgs.length) + ' mensagens', 'ok');
    PT.aviso('✅ Agora é a memória da 🤖 IA do projeto "' + nome + '"', 'ok');
  }

  PT.miniSK = { trazerProjetos, porMemoria };
  // baixar pelo jeito do Mini SK (no APK ele salva em Downloads pelo próprio app)
  PT.baixar = (nome, conteudo, tipo) => { SK.download(nome, conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo || 'application/octet-stream' }), tipo); PT.aviso('⬇ ' + nome, 'ok'); };

  function build(el) {
    el.innerHTML =
      '<div class="pico">' +
      '<p class="muted pequeno">Abra uma <b>memória</b>, um <b>💾 backup de tudo</b>, um <b>projeto .zip</b> ou as <b>conversas baixadas do ChatGPT / Claude</b>. Escolha só o pedaço que quer e traga <b>direto para o Mini SK</b> — ou baixe picotado.</p>' +
      '<section class="card"><label class="btn grande primario" for="arq">📂 Abrir arquivo</label>' +
      '<input type="file" id="arq" accept=".json,.zip,.md,.txt,application/json,application/zip" hidden>' +
      '<label class="linha pequeno muted"><input type="checkbox" id="modo-compartilhar"><span style="flex:1;min-width:0">📤 Compartilhar em vez de baixar (use no APK se o baixar não funcionar)</span></label>' +
      '<div id="o-que-e"></div></section>' +
      '<section class="card" id="tela-projetos" hidden></section><section class="card" id="tela-conversas" hidden></section><section class="card" id="tela-mensagens" hidden></section>' +
      '<div id="aviso" class="aviso" hidden></div></div>';
    SK.$('#arq', el).onchange = async (e) => {
      const arq = e.target.files[0]; e.target.value = ''; if (!arq) return;
      const caixa = SK.$('#o-que-e', el);
      caixa.innerHTML = '<div class="tipo">⏳ Lendo ' + SK.esc(arq.name) + '…</div>';
      ['#tela-projetos', '#tela-conversas', '#tela-mensagens'].forEach((s) => { const t = SK.$(s, el); t.hidden = true; t.innerHTML = ''; });
      try {
        const r = await PT.ler(arq);
        PT.estado = { tipo: r.tipo, backup: r.backup || null, projeto: r.projeto || null, conversas: r.conversas || [], nomeArquivo: arq.name };
        caixa.innerHTML = '<div class="tipo"><b>' + SK.esc(r.explicar) + '</b></div>';
        if (r.tipo === 'backup' || r.tipo === 'projeto') PT.mostrarProjetos();
        else if (r.conversas.length === 1) PT.abrirConversa(r.conversas[0]);
        else PT.mostrarConversas();
      } catch (er) { caixa.innerHTML = '<div class="tipo" style="background:rgba(248,113,113,.15)">⚠ ' + SK.esc(er.message) + '</div>'; }
    };
  }
  SK.importar = { build, trazerProjetos, porMemoria };
})(window.SK);
