/* =========================================================================
   Mini SK — 84-ponte.js
   🔗 Ponte com os outros apps (cada um continua separado, sem bagunça):
   - 🩺 Mandar o projeto aberto para o Cirurgião (detectar problemas, corrigir).
   - ↩️ Receber de volta só os arquivos que o Cirurgião corrigiu
     (um checkpoint 📸 é criado antes, para poder voltar atrás).
   Funciona com os apps em endereços diferentes: a conversa é por mensagem
   entre as duas abas (postMessage), nada passa pela internet.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const PREF = 'ponteCirurgiao';
  let janela = null, origemAlvo = '*', enviado = false;

  async function endereco(trocar) {
    let u = SK.pref.get(PREF, '');
    if (!u || trocar) {
      u = await SK.prompt('Endereço do Cirurgião (onde ele está publicado ou o arquivo aberto).\nEx.: https://seu-usuario.github.io/cirurgiao/', u || '', { okText: 'Guardar' });
      if (!u) return '';
      u = u.trim(); SK.pref.set(PREF, u);
    }
    return u;
  }
  function arquivosDoProjeto() {
    const P = fs().project; if (!P) return [];
    return Object.entries(P.files || {}).map(([caminho, r]) => ({
      caminho: caminho.replace(/^\/+/, ''),
      dados: r && r.b64 != null ? fs().fromBase64(r.b64) : new TextEncoder().encode((r && r.text) || ''),
    }));
  }
  async function mandarCirurgiao() {
    const P = fs().project; if (!P) return SK.toast('Abra um projeto primeiro', 'error');
    await fs().saveNow();
    const u = await endereco(false); if (!u) return;
    try { origemAlvo = /^https?:/i.test(u) ? new URL(u).origin : '*'; } catch { origemAlvo = '*'; }
    enviado = false;
    janela = window.open(u.split('#')[0] + '#ponte-minisk', '_blank');
    if (!janela) return SK.toast('O navegador bloqueou a nova aba. Permita "pop-ups" para o Mini SK e tente de novo.', 'error');
    SK.toast('🩺 Abrindo o Cirurgião… o projeto vai sozinho quando ele terminar de carregar.');
  }
  window.addEventListener('message', async (e) => {
    const d = e.data;
    if (!d || d.app !== 'cirurgiao' || !janela || e.source !== janela) return;
    if (origemAlvo !== '*' && e.origin !== origemAlvo && e.origin !== 'null') return;
    if (d.tipo === 'pronto' && !enviado) {
      enviado = true;
      const P = fs().project, arqs = arquivosDoProjeto();
      janela.postMessage({ app: 'minisk', tipo: 'projeto', nome: P.name, arquivos: arqs }, '*');
      SK.toast('🩺 ' + arqs.length + ' arquivo(s) enviados ao Cirurgião.', 'ok');
    }
    if (d.tipo === 'devolver' && Array.isArray(d.arquivos)) {
      const lista = d.arquivos.filter((x) => x && typeof x.caminho === 'string' && typeof x.texto === 'string' && !/\.\.(\/|$)/.test(x.caminho));
      if (!lista.length) return SK.toast('O Cirurgião não mandou nenhum arquivo corrigido.');
      const ok = await SK.confirm('O Cirurgião devolveu ' + lista.length + ' arquivo(s) corrigido(s):\n\n' + lista.map((x) => '• ' + x.caminho).join('\n') + '\n\nAplicar no projeto "' + fs().project.name + '"? (um 📸 checkpoint é criado antes)', { okText: 'Aplicar' });
      if (!ok) return;
      try { await SK.checkpoints.auto('Antes das correções do Cirurgião'); } catch {}
      lista.forEach((x) => fs().write(x.caminho, x.texto));
      await fs().saveNow();
      SK.toast('↩️ ' + lista.length + ' arquivo(s) corrigidos aplicados.', 'ok');
      try { janela.postMessage({ app: 'minisk', tipo: 'recebido', n: lista.length }, '*'); } catch {}
      try { window.focus(); } catch {}
    }
  });

  SK.ponte = { mandarCirurgiao, endereco };
})(window.SK);
