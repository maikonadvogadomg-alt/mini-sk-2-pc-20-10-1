/* =========================================================================
   Mini SK — 04-conta.js
   SEM login, SEM nuvem, SEM banco de dados. Tudo fica só neste aparelho.
   Este arquivo só existe para os outros módulos continuarem funcionando:
   ele diz "não há nuvem" e limpa qualquer ligação antiga com o Supabase.
   ========================================================================= */
(function (SK) {
  'use strict';
  // Limpa ligações antigas (Supabase, sessão, conexões de banco). Projetos NÃO são tocados.
  ['nuvemCfg', 'sessao', 'sessaoLocal', 'nuvemAuto', 'nuvemUltimo', 'bancos', 'bancoAtual'].forEach((k) => {
    try { localStorage.removeItem('minisk2:' + k); } catch {}
  });
  try { Object.keys(localStorage).filter((k) => k.indexOf('minisk:bancoSQL:') === 0).forEach((k) => localStorage.removeItem(k)); } catch {}
  if (/semnuvem/.test(location.hash)) { try { history.replaceState(null, '', location.href.split('#')[0]); } catch {} }

  const nada = () => Promise.reject(new Error('Sem nuvem: tudo fica só neste aparelho.'));
  SK.conta = {
    cfg: () => ({ url: '', anon: '', ok: false, desligada: true, pedirLogin: false, fromFile: false }),
    setCfg() {}, semNuvem() {}, showGate() {}, logout() {}, login: nada, signup: nada, recover: nada, setPassword: nada, call: nada,
    diagnostico: async () => 'Sem nuvem.',
    get user() { return null; }, get logado() { return false; }, get offline() { return false; },
  };
  SK.nuvem = { pronto: false, get: nada, set: nada, list: nada, del: nada };
})(window.SK);
