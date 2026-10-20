/* =========================================================================
   Mini SK — 86c-termux.js
   📱 Termux — liga o Mini SK ao Termux do seu celular (terminal Linux de
   verdade). Funciona no PWA e no APK do Mini SK. Não precisa de lacre.

   Por que o da Replit "parecia conectar mas não funcionava":
   1. o ttyd (o programa do Termux que abre a porta) só entende o "idioma" dele:
      pede o protocolo "tty", uma mensagem de entrada e um sinal na frente de cada
      tecla ("0" = digitou, "1" = mudou o tamanho). O de lá mandava texto puro;
   2. o endereço certo termina em /ws (ws://127.0.0.1:7681/ws);
   3. o ttyd novo abre só para OLHAR — precisa ligar com -W para aceitar digitação;
   4. no APK, o Android bloqueava ws:// — o 📦 APK do Mini SK agora libera só
      para o próprio celular (127.0.0.1 / localhost).
   ========================================================================= */
(function (SK) {
  'use strict';
  const XTERM = 'https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0';
  const FIT = 'https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.js';
  const PADRAO = 'ws://127.0.0.1:' + ((window.miniskPC && window.miniskPC.portas && window.miniskPC.portas.terminal) || 7681) + '/ws';
  const CMD_INSTALAR = 'pkg install -y ttyd';
  const CMD_LIGAR = 'ttyd -W -i 127.0.0.1 -p 7681 bash';
  const enc = new TextEncoder(), dec = new TextDecoder();
  const PC = window.miniskPC || null; // dentro do Mini SK para PC: o terminal e a ponte já vêm ligados pelo programa
  let box = null, ws = null, term = null, fit = null, simples = false, abriu = false, saindo = false, tentativas = 0;

  const $ = (s) => SK.$(s, box);
  function status(t, tipo) { const el = $('#tx-status'); if (!el) return; el.textContent = t; el.className = 'tx-status ' + (tipo || ''); }
  function carregarScript(src) { return new Promise((ok, erro) => { if (document.querySelector('script[src="' + src + '"]')) { const t = setInterval(() => { if (window.Terminal) { clearInterval(t); ok(); } }, 100); setTimeout(() => { clearInterval(t); window.Terminal ? ok() : erro(new Error('sem internet')); }, 8000); return; } const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error('sem internet')); document.head.appendChild(s); }); }
  function carregarCss(href) { if (document.querySelector('link[href="' + href + '"]')) return; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }

  // ── tela: xterm (bonito) ou modo simples (sem internet para baixar o xterm) ──
  async function prepararTela() {
    if (term || simples) return;
    try {
      carregarCss(XTERM + '/css/xterm.css');
      if (!window.Terminal) await carregarScript(XTERM + '/lib/xterm.js');
      if (!window.FitAddon) await carregarScript(FIT);
      term = new window.Terminal({ fontSize: SK.pref.get('termFonte', PC ? 16 : 13), cursorBlink: true, convertEol: false, theme: PC ? { background: '#0b0f17' } : { background: '#07110d', foreground: '#d7f5e3' } });
      fit = new window.FitAddon.FitAddon(); term.loadAddon(fit);
      term.open($('#tx-term'));
      try { fit.fit(); } catch {}
      term.onData((d) => enviar(d));
      // se o quadro mudar de tamanho (abrir painel, tela cheia, girar o celular), o terminal se ajusta
      try { let lw = 0, lh = 0, t = 0; new ResizeObserver((ents) => { const r = ents[0].contentRect; if (Math.abs(r.width - lw) < 4 && Math.abs(r.height - lh) < 4) return; lw = r.width; lh = r.height; clearTimeout(t); t = setTimeout(() => { try { fit.fit(); tamanho(); } catch {} }, 200); }).observe($('#tx-term')); } catch {}
      window.addEventListener('resize', () => { try { fit.fit(); tamanho(); } catch {} });
    } catch (e) {
      simples = true;
      $('#tx-term').innerHTML = '<pre id="tx-pre" class="tx-pre"></pre><div class="tx-linha"><input id="tx-in" class="input" placeholder="Digite o comando e toque em ⏎" autocapitalize="off" autocorrect="off" spellcheck="false"><button class="btn small" id="tx-ok">⏎</button></div>';
      $('#tx-pre').style.fontSize = SK.pref.get('termFonte', PC ? 16 : 13) + 'px';
      const ir = () => { const i = $('#tx-in'); enviar(i.value + '\r'); i.value = ''; };
      $('#tx-ok').onclick = ir;
      $('#tx-in').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); ir(); } });
    }
  }
  function escreverTela(bytes) {
    try { vigiarServidor(bytes); } catch {}
    if (term) { term.write(bytes); return; }
    const pre = $('#tx-pre'); if (!pre) return;
    // modo simples: tira as cores/comandos de tela (ANSI)
    pre.textContent += dec.decode(bytes).replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]|\x1b\][^\x07]*\x07|\x1b[()][A-Z0-9]|\r(?!\n)/g, '');
    if (pre.textContent.length > 60000) pre.textContent = pre.textContent.slice(-40000);
    pre.scrollTop = pre.scrollHeight;
  }

  // ── conversa no "idioma" do ttyd ────────────────────────────────────────────
  function enviar(texto) { if (ws && ws.readyState === 1) ws.send(enc.encode('0' + texto)); }
  function tamanho() { if (ws && ws.readyState === 1 && term) ws.send(enc.encode('1' + JSON.stringify({ columns: term.cols, rows: term.rows }))); }

  async function conectar() {
    const url = PC ? PADRAO : (($('#tx-url') && $('#tx-url').value) || PADRAO).trim();
    if (!PC) SK.pref.set('termuxUrl', url);
    if (!/^wss?:\/\//.test(url)) return status('O endereço precisa começar com ws://', 'erro');
    await prepararTela();
    desconectar(true);
    abriu = false; saindo = false;
    status('Chamando o Termux…');
    try { ws = new WebSocket(url, ['tty']); } catch (e) { return status('Endereço inválido: ' + e.message, 'erro'); }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => {
      abriu = true; tentativas = 0;
      ws.send(enc.encode(JSON.stringify({ AuthToken: '', columns: term ? term.cols : 80, rows: term ? term.rows : 24 })));
      status(PC ? '✅ Terminal ligado' : '✅ Ligado no Termux. Pode digitar.', 'ok');
      if (PC && SK.pastaViva && SK.pastaViva.pronto) setTimeout(() => irParaPasta(false), 400);
      $('#tx-con').hidden = true; $('#tx-des').hidden = false;
      if (term) term.focus(); else $('#tx-in') && $('#tx-in').focus();
    };
    ws.onmessage = (ev) => {
      const d = typeof ev.data === 'string' ? enc.encode(ev.data) : new Uint8Array(ev.data);
      if (!d.length) return;
      const cmd = String.fromCharCode(d[0]);
      if (cmd === '0') escreverTela(d.subarray(1));
      // '1' = título da janela, '2' = preferências: não precisamos
    };
    ws.onclose = (ev) => {
      $('#tx-con').hidden = false; $('#tx-des').hidden = true;
      if (!abriu && PC) status('❌ O terminal do programa não respondeu. Toque em 🔌 Religar; se não der, feche e abra o Mini SK.', 'erro');
      else if (!abriu) status('❌ O Termux não respondeu. Confira: o Termux está aberto? Rodou o comando 2 (com -W)? Se o navegador perguntar sobre "dispositivos da rede local", toque em Permitir.', 'erro');
      else if (!saindo && ev.code !== 1000 && tentativas < 4) { tentativas++; status('A conexão caiu. Religando sozinho (' + tentativas + '/4)…', 'erro'); setTimeout(() => { if (!ws) conectar().catch(() => {}); }, 2000); }
      else status(saindo || ev.code === 1000 ? 'Desligado.' : 'A conexão caiu (o Android pode ter fechado o Termux). Abra o Termux e toque em ▶ Ligar tudo de novo.', saindo || ev.code === 1000 ? '' : 'erro');
      ws = null;
    };
    ws.onerror = () => {};
  }
  function desconectar(quieto) { saindo = true; if (ws) { try { ws.close(1000); } catch {} ws = null; } if (!quieto) status('Desligado.'); }

  async function copiar(t) { try { await navigator.clipboard.writeText(t); SK.toast('Copiado. Cole no Termux.'); } catch { SK.prompt('Copie este comando:', t); } }

  // ── no PC: tela limpa, igual VS Code (terminal + pasta viva), sem Termux/ponte ──
  function buildPC(el) {
    box = el;
    // igual ao painel ⚡ Node: comandos prontos em cima, teclas, terminal, servidor no ar com 👁 Ver aqui, GitHub
    el.innerHTML =
      '<div class="tx tx-pc">' +
      '<p class="muted small">Terminal <b>de verdade do seu computador</b> (igual ao ⚡ Node, só que sem limites). Já abre <b>dentro da pasta do projeto</b>: <code>npm install</code>, <code>npm run dev</code>, <code>node</code>, <code>python</code>, <code>git</code>…</p>' +
      '<div class="pc-topo"><div class="pc-pasta"><span class="muted small">📁 Pasta do projeto</span><code id="pc-caminho">' + SK.esc(SK.pastaViva ? SK.pastaViva.pasta : PC.pasta) + '</code></div>' +
      '<button class="btn small" id="pc-abrir" title="Abrir a pasta no Explorador do Windows">📂 Abrir no Windows</button></div>' +
      '<div id="pc-viva" class="pc-viva">Ligando…</div>' +
      '<div id="tx-status" class="gh-status">Ligando o terminal…</div>' +
      '<div id="tx-term" class="tx-term"></div>' +
      '<div class="row wrap" style="margin-top:6px"><button class="btn small" data-t="\x03">Ctrl+C</button><button class="btn small" data-t="\t">Tab</button><button class="btn small" data-t="\x1b[A">↑</button><button class="btn small" data-t="\x1b[B">↓</button><button class="btn small" data-t="\x1b">Esc</button>' +
      '<span class="cresce"></span><button class="btn small" id="tx-cd" title="Voltar para a pasta do projeto">↩ Pasta do projeto</button><button class="btn small" id="tx-cheio">⛶ Tela cheia</button><button class="btn small" id="tx-limpar">🧽 Limpar</button><button class="btn small" id="tx-menos">A−</button><button class="btn small" id="tx-mais">A+</button><button class="btn small" id="tx-con" hidden>🔌 Religar</button><button class="btn small" id="tx-des" hidden>Desligar</button></div>' +
      '<div class="row wrap" style="margin-top:6px"><button class="btn small primary" id="tx-gh">🐙 Enviar ao GitHub</button></div>' +
      '<div id="tx-atalhos"></div>' +
      '<div id="tx-srv" hidden style="margin:6px 0"></div>' +
      '<details class="tx-ajuda"><summary class="small">Como funciona</summary><ul>' +
      '<li>Este é o <b>terminal do seu computador</b>. Ele já abre <b>dentro da pasta do projeto</b>.</li>' +
      '<li>A <b>pasta viva</b> deixa a árvore ☰ e a pasta <b>sempre iguais</b>: o que você muda no editor vai para a pasta; o que o terminal cria, muda ou apaga aparece na árvore em 2 segundos. Não precisa mandar nem trazer nada.</li>' +
      '<li>Quando o terminal liga um servidor (<code>npm run dev</code>), aparece <b>🌐 Servidor no ar → 👁 Ver aqui</b>.</li>' +
      '<li>Arraste a <b>borda esquerda</b> deste painel para deixar mais largo.</li>' +
      '<li>As pastas <code>node_modules</code> e <code>.git</code> ficam só na pasta (não entram na árvore, são enormes).</li>' +
      '</ul></details>' +
      '</div>';
    SK.atalhos.montar($('#tx-atalhos'), (c) => { if (!mandar(c, true)) status('O terminal ainda está ligando…', 'erro'); }, { extra: [] });
    $('#pc-abrir').onclick = () => { if (SK.pastaViva) SK.pastaViva.abrirNoWindows(); };
    $('#tx-gh').onclick = () => SK.app.openSide('gh');
    $('#tx-cd').onclick = () => irParaPasta(true);
    $('#tx-con').onclick = () => conectar().catch((e) => status('Erro: ' + e.message, 'erro'));
    $('#tx-des').onclick = () => desconectar();
    $('#tx-cheio').onclick = () => { const on = document.body.classList.toggle('tx-cheio'); $('#tx-cheio').textContent = on ? '✕ Sair da tela cheia' : '⛶ Tela cheia'; setTimeout(() => { try { fit.fit(); tamanho(); term.focus(); } catch {} }, 150); };
    const letra = (d) => { const n = Math.max(9, Math.min(28, SK.pref.get('termFonte', 16) + d)); SK.pref.set('termFonte', n); if (term) { term.options.fontSize = n; try { fit.fit(); tamanho(); } catch {} } const pre = $('#tx-pre'); if (pre) pre.style.fontSize = n + 'px'; };
    $('#tx-menos').onclick = () => letra(-1); $('#tx-mais').onclick = () => letra(1);
    $('#tx-limpar').onclick = () => { if (term) term.clear(); else if ($('#tx-pre')) $('#tx-pre').textContent = ''; };
    el.addEventListener('click', (e) => { const t = e.target.closest('[data-t]'); if (t) { enviar(t.dataset.t); if (term) term.focus(); } });
    setTimeout(() => { if (!(ws && ws.readyState === 1)) conectar().catch(() => {}); }, 300);
  }
  function irParaPasta(mostrar) {
    if (!(ws && ws.readyState === 1) || !SK.pastaViva || !SK.fs.project) return;
    enviar('cd ' + JSON.stringify(SK.pastaViva.pasta) + '\r');
    if (mostrar && term) term.focus();
  }
  if (PC) {
    SK.on('pasta-viva', (e) => { const el = box && box.querySelector('#pc-viva'); if (el) { el.textContent = e.texto; el.className = 'pc-viva ' + e.tipo; } const c = box && box.querySelector('#pc-caminho'); if (c) c.textContent = e.pasta; });
    SK.on('pasta-viva-pronta', () => irParaPasta(false));
  }

  function build(el) {
    if (PC) return buildPC(el);
    box = el;
    el.innerHTML =
      '<div class="tx">' +
      '<p class="muted">Liga o Mini SK ao <b>Termux</b> do seu celular — um Linux de verdade. Funciona no PWA e no APK. Serve para coisas básicas: <code>ls</code>, <code>git</code>, <code>python</code>, <code>node</code> (se instalado no Termux).</p>' +
      (PC ? '<p><b>💻 Terminal do computador.</b> Já vem ligado pelo programa. Os projetos que você manda ficam em <code>' + SK.esc(PC.pasta) + '</code>.</p><ol class="tx-passos" hidden>' : '<ol class="tx-passos">') +
      '<li>No Termux, <b>só da primeira vez</b>:<div class="tx-cmd"><code>' + CMD_INSTALAR + '</code><button class="btn small" data-copiar="1">Copiar</button></div></li>' +
      '<li>No Termux, <b>toda vez</b> (e deixe o Termux aberto):<div class="tx-cmd"><code>' + CMD_LIGAR + '</code><button class="btn small" data-copiar="2">Copiar</button></div><small class="muted">O <b>-W</b> deixa digitar. O <b>-i 127.0.0.1</b> faz só o seu celular enxergar (ninguém do Wi-Fi entra).</small></li>' +
      '<li>Volte aqui e toque em <b>▶ Ligar tudo</b> (conecta, liga a ponte, manda o projeto e liga a árvore).</li>' +
      '</ol>' +
      '<div class="tx-linha"><input id="tx-url" class="input" aria-label="Endereço do Termux" spellcheck="false" autocapitalize="off"><button class="btn primary" id="tx-tudo" title="Conecta, liga a ponte, manda o projeto e liga a árvore — igual ao ▶ Ligar o Node">▶ Ligar tudo</button><button class="btn small" id="tx-con">🔌 Só conectar</button><button class="btn" id="tx-des" hidden>Desligar</button></div>' +
      '<div id="tx-status" class="tx-status">Desligado.</div>' +
      '<div id="tx-srv" hidden style="margin:6px 0"></div>' +
      '<div class="row wrap"><button class="btn small" id="tx-cheio" title="Terminal grande, ocupando a tela toda">⛶ Tela cheia</button><button class="btn small" id="tx-limpar" title="Limpar a tela do terminal">🧽 Limpar tela</button><button class="btn small" id="tx-menos" title="Letra menor">A−</button><button class="btn small" id="tx-mais" title="Letra maior">A+</button></div>' +
      '<div id="tx-term" class="tx-term"></div>' +
      '<div class="tx-teclas"><button class="btn small" data-t="\x03">Ctrl+C</button><button class="btn small" data-t="\t">Tab</button><button class="btn small" data-t="\x1b[A">↑</button><button class="btn small" data-t="\x1b[B">↓</button><button class="btn small" data-t="\x1b">Esc</button><button class="btn small" data-t="\x04">Ctrl+D</button></div>' +
      '<div id="tx-atalhos"></div>' +
      '<div class="tx-ponte"><b>⇅ Arquivos entre a árvore e o Termux</b>' +
      '<p class="small muted">O que o Termux cria (ex.: a pasta <code>dist</code> depois do build) volta para a árvore ☰. Os arquivos ficam no Termux em <code>~/minisk/NOME-DO-PROJETO</code>.</p>' +
      '<div class="row wrap"><button class="btn small" id="tx-p-ligar">🧩 Ligar a ponte</button><button class="btn small" id="tx-p-mandar">⬆ Mandar o projeto para o Termux</button><button class="btn small primary" id="tx-p-trazer">⬇ Trazer do Termux para a árvore</button></div>' +
      '<div id="tx-p-status" class="small muted"></div>' +
      '<label class="row" style="gap:6px;margin-top:6px"><input type="checkbox" id="tx-vivo-on"> <b>🔗 Árvore ligada</b> <span class="small muted">(igual ao ⚡ Node: muda sozinho nos dois lados)</span></label>' +
      '<div id="tx-vivo" class="small muted"></div>' +
      '<div class="row wrap" style="margin-top:6px"><button class="btn small" id="tx-gh">🐙 Enviar ao GitHub</button><button class="btn small" data-cmd="termux-setup-storage" title="Deixa o Termux ver as pastas do celular (Downloads…). O Android pergunta: toque em Permitir.">📂 Termux ver as pastas do celular</button><button class="btn small" id="tx-copiar-cel" title="Guarda uma cópia do projeto numa pasta de verdade do celular: Armazenamento interno/MiniSK">💾 Guardar cópia na pasta do celular</button><button class="btn small" data-cmd="termux-wake-lock" title="Pede ao Android para não fechar o Termux">🔋 Não deixar o Android fechar</button></div></div>' +
      '<div class="tx-ponte"><b>👁 Visualizar o que o terminal ligou</b>' +
      '<p class="small muted">Depois do <code>npm run dev</code> (ou <code>node server.cjs</code>, <code>python servir.py</code>…), escolha a <b>porta</b> que o Termux mostrou e veja aqui.</p>' +
      '<div class="tx-linha"><input id="tx-porta" class="input" style="max-width:110px" inputmode="numeric" aria-label="Porta"><button class="btn primary" id="tx-ver">👁 Visualizar</button><button class="btn small" id="tx-ver-fora">↗ Abrir fora</button></div>' +
      '<div class="row wrap">' + [5173, 5000, 3000, 8080, 4173, 7745].map((p) => '<button class="btn small" data-porta="' + p + '">' + p + '</button>').join('') + '</div>' +
      '<div id="tx-ver-caixa" hidden style="margin-top:8px;border:1px solid var(--line,#333);border-radius:10px;overflow:hidden;background:#fff"><iframe id="tx-ver-quadro" title="O que o terminal ligou" style="width:100%;height:60vh;border:0;display:block"></iframe></div></div>' +
      '<details class="tx-ajuda"><summary>Não conectou?</summary><ul>' +
      '<li>O Termux precisa estar <b>aberto</b> com o comando 2 rodando (aparece "Listening on port: 7681").</li>' +
      '<li>Se o Android fechar o Termux, rode no Termux: <code>termux-wake-lock</code>.</li>' +
      '<li>No <b>APK</b>: gere o APK de novo pelo 📦 APK (o novo já libera a conexão com o próprio celular).</li>' +
      '<li>No <b>PWA/Chrome</b>: se aparecer pedido de acesso a "dispositivos da rede local", toque em Permitir.</li>' +
      '<li>Se você ligou o ttyd com senha (<code>-c</code>), ligue sem senha — o <code>-i 127.0.0.1</code> já protege.</li>' +
      '</ul></details>' +
      '</div>';
    $('#tx-url').value = SK.pref.get('termuxUrl', PADRAO);
    $('#tx-porta').value = SK.pref.get('termuxPortaVer', 5173);
    const enderecoVer = () => { const p = parseInt($('#tx-porta').value, 10); if (!(p > 0 && p < 65536)) { SK.toast('Porta inválida', 'error'); return null; } SK.pref.set('termuxPortaVer', p); return 'http://127.0.0.1:' + p + '/'; };
    $('#tx-ver').onclick = () => { const u = enderecoVer(); if (!u) return; $('#tx-ver-caixa').hidden = false; $('#tx-ver-quadro').src = u + '?t=' + Date.now(); };
    $('#tx-ver-fora').onclick = () => { const u = enderecoVer(); if (u) window.open(u, '_blank'); };
    SK.atalhos.montar($('#tx-atalhos'), (c) => { if (!mandar(c, true)) status('Conecte primeiro (🔌 Conectar).', 'erro'); }, { extra: [{ r: '📁 ir para a pasta do projeto', c: 'cd ~/minisk/' + "'" + '__P__' + "'", d: 'Entra na pasta deste projeto no Termux' }].concat(PC ? [] : [{ r: '🦙 Ligar o Ollama para a IA', c: 'pkill -f "ollama serve"; OLLAMA_ORIGINS="*" nohup ollama serve > ~/ollama.log 2>&1 & sleep 2; echo "✅ Ollama ligado. Agora: 🤖 IA → ⚙️ Chaves → Ollama → 🧪 Testar"', d: 'Liga o Ollama do celular de um jeito que a 🤖 IA do Mini SK consegue usar' }]) });
    const pst = (t, k) => { const el = $('#tx-p-status'); el.textContent = t; el.style.color = k === 'erro' ? 'var(--danger, #e66)' : k === 'ok' ? 'var(--ok, #4c9)' : ''; };
    const rodarP = (fn) => fn().catch((e) => pst('⚠ ' + e.message, 'erro'));
    $('#tx-p-ligar').onclick = () => rodarP(async () => { pst('Instalando e ligando a ponte no Termux… (na 1ª vez pode instalar o Node: demora uns minutos)'); await ligarPonte(); pst('✅ Ponte ligada. Agora: ⬆ Mandar o projeto.', 'ok'); });
    $('#tx-p-mandar').onclick = () => rodarP(async () => { pst('Mandando…'); const r = await mandarProjeto(); pst('✅ ' + r.n + ' arquivo(s) no Termux em ' + r.pasta + (r.pulados && r.pulados.length ? ' · pulados: ' + r.pulados.length : '') + '. Já entrei na pasta: pode rodar os comandos.', 'ok'); });
    $('#tx-p-trazer').onclick = () => rodarP(async () => { pst('Trazendo…'); const r = await trazer(true); pst('✅ Trazidos: ' + r.novos + ' novo(s), ' + r.mudou + ' mudado(s)' + (r.cortou ? ' (parte ficou de fora: grande demais)' : '') + '. Tem ponto de volta em 📸.', 'ok'); });
    $('#tx-con').onclick = () => conectar().catch((e) => status('Erro: ' + e.message, 'erro'));
    $('#tx-tudo').onclick = () => { const b = $('#tx-tudo'); b.disabled = true; ligarTudo((t) => pst(t)).then(() => { pst('✅ Tudo ligado: terminal, ponte e árvore. Já entrei na pasta do projeto.', 'ok'); enviar(' termux-wake-lock 2>/dev/null; clear\r'); }).catch((e) => pst('⚠ ' + e.message, 'erro')).finally(() => { b.disabled = false; }); };
    $('#tx-vivo-on').onchange = (e) => { if (!e.target.checked) return ligarArvore(false); rodarP(async () => { if (!(await ping(2))) await ligarPonte(); await mandarProjeto(); ligarArvore(true); }).then(() => { if (!vivo) e.target.checked = false; }); };
    $('#tx-gh').onclick = () => SK.app.openSide('gh');
    // pasta de verdade no celular (como o "C:" do computador): Armazenamento interno/MiniSK/NOME — sem node_modules
    $('#tx-copiar-cel').onclick = () => { if (!mandar("if [ -d ~/storage/shared ]; then mkdir -p ~/storage/shared/MiniSK && tar -C ~/minisk --exclude=node_modules --exclude=.git -cf - '__P__' | tar -C ~/storage/shared/MiniSK -xf - && echo '✅ Cópia guardada em: Armazenamento interno > MiniSK > __P__'; else echo '⚠ Primeiro toque em 📂 Termux ver as pastas do celular e aperte Permitir.'; fi", true)) status('Conecte primeiro (▶ Ligar tudo).', 'erro'); };
    $('#tx-des').onclick = () => desconectar();
    $('#tx-cheio').onclick = () => { const on = document.body.classList.toggle('tx-cheio'); $('#tx-cheio').textContent = on ? '✕ Sair da tela cheia' : '⛶ Tela cheia'; setTimeout(() => { try { fit.fit(); tamanho(); term.focus(); } catch {} }, 150); };
    const letra = (d) => { const n = Math.max(9, Math.min(28, SK.pref.get('termFonte', PC ? 16 : 13) + d)); SK.pref.set('termFonte', n); if (term) { term.options.fontSize = n; try { fit.fit(); tamanho(); } catch {} } const pre = $('#tx-pre'); if (pre) pre.style.fontSize = n + 'px'; SK.toast('Letra do terminal: ' + n); };
    $('#tx-menos').onclick = () => letra(-1); $('#tx-mais').onclick = () => letra(1);
    $('#tx-limpar').onclick = () => { if (term) term.clear(); else if ($('#tx-pre')) $('#tx-pre').textContent = ''; };
    el.addEventListener('click', (e) => {
      const c = e.target.closest('[data-copiar]'); if (c) copiar(c.dataset.copiar === '1' ? CMD_INSTALAR : CMD_LIGAR);
      const t = e.target.closest('[data-t]'); if (t) { enviar(t.dataset.t); if (term) term.focus(); }
      const cm = e.target.closest('[data-cmd]'); if (cm && !mandar(cm.dataset.cmd, true)) status('Conecte primeiro (▶ Ligar tudo).', 'erro');
      const pt = e.target.closest('[data-porta]'); if (pt) { $('#tx-porta').value = pt.dataset.porta; $('#tx-ver').click(); }
    });
  }

  // ── comandos prontos e ponte de arquivos ────────────────────────────────────
  const nomeProj = () => String((SK.fs.project && SK.fs.project.name) || 'projeto').replace(/[^\w.\- ]+/g, '_').replace(/^\.+/, '').slice(0, 60) || 'projeto';
  function mandar(cmd, semAbrir) {
    if (!semAbrir) SK.app.openSide('termux');
    if (!(ws && ws.readyState === 1)) return false;
    enviar(String(cmd).replace(/__P__/g, nomeProj()) + '\r'); if (term) term.focus(); return true;
  }
  const PONTE_JS = "// Ponte de arquivos do Mini SK — roda no Termux. Leva o projeto da árvore para\n// ~/minisk/NOME e traz de volta o que o terminal criou (dist, arquivos novos…).\n// Só o próprio celular enxerga (127.0.0.1) e só quem tem o código entra.\nconst http = require('http'), fs = require('fs'), path = require('path'), os = require('os');\nconst CODIGO = process.argv[2] || '', PORTA = Number(process.argv[3] || 7682);\nconst BASE = path.join(os.homedir(), 'minisk');\nconst PULAR = /(^|\\/)(node_modules|\\.git|\\.sk|\\.gradle|\\.cache)(\\/|$)/;\nfs.mkdirSync(BASE, { recursive: true });\nconst nomeProj = (n) => String(n || 'projeto').replace(/[^\\w.\\- ]+/g, '_').replace(/^\\.+/, '').slice(0, 60) || 'projeto';\nfunction dentro(proj, rel) {\n  const raiz = path.resolve(BASE, nomeProj(proj));\n  const p = path.resolve(raiz, String(rel || ''));\n  if (p !== raiz && !p.startsWith(raiz + path.sep)) throw new Error('caminho inválido: ' + rel);\n  return { raiz, p };\n}\nfunction responder(res, cod, obj) { res.writeHead(cod, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }\nfunction corpo(req) {\n  return new Promise((ok, erro) => {\n    const partes = []; let n = 0;\n    req.on('data', (c) => { n += c.length; if (n > 80e6) { erro(new Error('grande demais')); req.destroy(); } else partes.push(c); });\n    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}')); } catch (e) { erro(e); } });\n    req.on('error', erro);\n  });\n}\nhttp.createServer(async (req, res) => {\n  res.setHeader('Access-Control-Allow-Origin', '*');\n  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');\n  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Codigo');\n  res.setHeader('Access-Control-Allow-Private-Network', 'true');\n  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }\n  if (!CODIGO || req.headers['x-codigo'] !== CODIGO) return responder(res, 403, { erro: 'código errado' });\n  const u = new URL(req.url, 'http://x');\n  try {\n    if (u.pathname === '/ping') return responder(res, 200, { ok: true, pasta: BASE, versao: 2, agora: Date.now() });\n    if (u.pathname === '/enviar' && req.method === 'POST') {\n      const b = await corpo(req); let n = 0; const pulados = [];\n      for (const a of b.arquivos || []) {\n        try {\n          if (PULAR.test(a.p)) continue;\n          const { p } = dentro(b.projeto, a.p);\n          fs.mkdirSync(path.dirname(p), { recursive: true });\n          fs.writeFileSync(p, a.b64 != null ? Buffer.from(a.b64, 'base64') : String(a.t || ''));\n          n++;\n        } catch (e) { pulados.push(a.p + ': ' + e.message); }\n      }\n      return responder(res, 200, { ok: true, n, pulados, pasta: dentro(b.projeto, '').raiz, agora: Date.now() + 1 });\n    }\n    if (u.pathname === '/apagar' && req.method === 'POST') {\n      const b = await corpo(req); let n = 0;\n      for (const c of b.caminhos || []) { try { const { p, raiz } = dentro(b.projeto, c); if (p !== raiz) { fs.rmSync(p, { recursive: true, force: true }); n++; } } catch (e) {} }\n      return responder(res, 200, { ok: true, n, agora: Date.now() + 1 });\n    }\n    if (u.pathname === '/listar') {\n      const { raiz } = dentro(u.searchParams.get('projeto'), '');\n      const desde = Number(u.searchParams.get('desde') || 0);\n      const lista = []; let total = 0, cortou = false;\n      const andar = (d) => {\n        let itens = []; try { itens = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }\n        for (const e of itens) {\n          const f = path.join(d, e.name), rel = path.relative(raiz, f).split(path.sep).join('/');\n          if (PULAR.test(rel)) continue;\n          if (e.isDirectory()) { andar(f); continue; }\n          if (!e.isFile()) continue;\n          const st = fs.statSync(f);\n          if (st.mtimeMs <= desde || st.size > 5e6) continue;\n          if (total + st.size > 30e6) { cortou = true; continue; }\n          total += st.size;\n          lista.push({ p: rel, b64: fs.readFileSync(f).toString('base64') });\n        }\n      };\n      const agora = Date.now();\n      andar(raiz);\n      return responder(res, 200, { ok: true, agora, arquivos: lista, cortou });\n    }\n    responder(res, 404, { erro: 'não existe' });\n  } catch (e) { responder(res, 500, { erro: e.message }); }\n}).listen(PORTA, '127.0.0.1', () => console.log('Ponte do Mini SK ligada na porta ' + PORTA + ' · pasta ' + BASE));\n";
  const PONTE = 'http://127.0.0.1:' + ((PC && PC.portas && PC.portas.ponte) || 7682);
  function codigo() { if (PC) return PC.codigo; let c = SK.pref.get('termuxPonteCodigo', ''); if (!c) { const a = new Uint8Array(12); crypto.getRandomValues(a); c = Array.from(a, (x) => x.toString(16).padStart(2, '0')).join(''); SK.pref.set('termuxPonteCodigo', c); } return c; }
  async function chamar(caminho, corpo) {
    let r;
    try { r = await fetch(PONTE + caminho, { method: corpo ? 'POST' : 'GET', headers: Object.assign({ 'X-Codigo': codigo() }, corpo ? { 'Content-Type': 'application/json' } : {}), body: corpo ? JSON.stringify(corpo) : undefined }); }
    catch (e) { throw new Error('A ponte não respondeu. Toque em 🧩 Ligar a ponte (com o Termux conectado).'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro === 'código errado' ? 'A ponte foi ligada por outro aparelho/navegador. Toque em 🧩 Ligar a ponte de novo.' : (j.erro || 'erro ' + r.status));
    return j;
  }
  // a ponte nova (versão 2) também apaga; se a velha estiver ligada, troca sozinha
  async function ping(versao) { try { const j = await chamar('/ping'); return !versao || (j.versao || 1) >= versao; } catch { return false; } }
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  async function ligarPonte() {
    if (PC) { if (await ping()) return true; throw new Error('A ponte do programa não respondeu. Feche o Mini SK e abra de novo.'); }
    if (!(ws && ws.readyState === 1)) throw new Error('Conecte o Termux primeiro (🔌 Conectar).');
    const b64 = btoa(unescape(encodeURIComponent(PONTE_JS)));
    // Antes ia tudo numa linha gigante (7 mil letras) — e o Termux derrubava a conexão.
    // Agora vai em pedacinhos de 900 letras, um de cada vez.
    enviar(' rm -f ~/.ponte-minisk.b64\r'); await espera(250);
    for (let i = 0; i < b64.length; i += 900) {
      if (!(ws && ws.readyState === 1)) throw new Error('A conexão com o Termux caiu no meio. Toque em ▶ Ligar tudo de novo.');
      enviar(" printf %s '" + b64.slice(i, i + 900) + "' >> ~/.ponte-minisk.b64\r"); await espera(250);
    }
    enviar(" clear; command -v node >/dev/null || pkg install -y nodejs-lts; base64 -d ~/.ponte-minisk.b64 > ~/ponte-minisk.js && { pkill -f 'node .*ponte-minisk'; nohup node ~/ponte-minisk.js " + codigo() + " 7682 > ~/ponte-minisk.log 2>&1 & } ; sleep 1; clear; echo '✅ Ponte do Mini SK ligada (se der erro: cat ~/ponte-minisk.log)'\r");
    const fim = Date.now() + 240000;
    while (Date.now() < fim) { if (await ping(2)) return true; await espera(2000); }
    throw new Error('A ponte não ligou. No Termux, rode: cat ~/ponte-minisk.log  e mande um print.');
  }
  const PULAR = /(^|\/)(node_modules|\.git|\.sk)(\/|$)/;
  async function mandarProjeto() {
    if (!SK.fs.project) throw new Error('Abra um projeto primeiro.');
    if (!(await ping(2))) await ligarPonte();
    const projeto = nomeProj();
    let lote = [], tam = 0, n = 0, pulados = [], pasta = '', agora = 0;
    const enviarLote = async () => { if (!lote.length) return; const r = await chamar('/enviar', { projeto, arquivos: lote }); n += r.n; pulados = pulados.concat(r.pulados || []); pasta = r.pasta; agora = r.agora; lote = []; tam = 0; };
    for (const p of SK.fs.list()) {
      if (PULAR.test(p)) continue;
      const rec = SK.fs.get(p); if (!rec) continue;
      const item = rec.b64 != null ? { p, b64: rec.b64 } : { p, t: rec.text || '' };
      lote.push(item); tam += (item.b64 || item.t).length;
      if (tam > 3e6) await enviarLote();
    }
    await enviarLote();
    SK.pref.set('termuxSync:' + projeto, agora || Date.now());
    if (ws && ws.readyState === 1 && pasta) enviar('cd ' + JSON.stringify(pasta) + '\r');
    return { n, pulados, pasta };
  }
  // tudo = true: confere todos os arquivos (o botão ⬇); senão, só o que mudou desde a última vez (a árvore ligada)
  let aplicando = false;
  async function trazer(tudo) {
    if (!SK.fs.project) throw new Error('Abra um projeto primeiro.');
    const projeto = nomeProj();
    const desde = tudo === true ? 0 : SK.pref.get('termuxSync:' + projeto, 0);
    const r = await chamar('/listar?projeto=' + encodeURIComponent(projeto) + '&desde=' + desde);
    if (projeto !== nomeProj()) return { novos: 0, mudou: 0 }; // trocou de projeto no meio
    const mudar = [];
    for (const a of r.arquivos) {
      if (PULAR.test(a.p)) continue;
      const rec = SK.fs.recordFromBytes(a.p, SK.fs.fromBase64(a.b64));
      const antes = SK.fs.exists(a.p) ? SK.fs.get(a.p) : null;
      if (antes && ((rec.text != null && antes.text === rec.text) || (rec.b64 != null && antes.b64 === rec.b64))) continue;
      mudar.push({ a, rec, antes });
    }
    // só guarda o ponto de volta 📸 quando vai MUDAR um arquivo que você já tinha
    if (SK.checkpoints && mudar.some((m) => m.antes)) await SK.checkpoints.auto('Antes de receber mudanças do Termux');
    let novos = 0, mudou = 0;
    aplicando = true;
    try {
      for (const { a, rec, antes } of mudar) {
        if (rec.text != null) SK.fs.write(a.p, rec.text, { silent: true }); else SK.fs.writeRecord(a.p, rec);
        antes ? mudou++ : novos++;
      }
      SK.pref.set('termuxSync:' + projeto, Math.max(r.agora, SK.pref.get('termuxSync:' + projeto, 0)));
      if (mudar.length) SK.emit('fs-change', { type: 'import', doTermux: true });
    } finally { aplicando = false; }
    return { novos, mudou, cortou: r.cortou };
  }

  // ── 🔗 Árvore ligada (igual ao ⚡ Node): o que você muda vai sozinho; o que o terminal cria volta sozinho ──
  let vivo = false, relogio = 0, fila = new Map(), tFila = 0, puxandoAgora = false, errosSeguidos = 0;
  function vst(t, k) { const el = box && box.querySelector('#tx-vivo'); if (!el) return; el.textContent = t; el.style.color = k === 'erro' ? 'var(--danger, #e66)' : k === 'ok' ? 'var(--ok, #4c9)' : ''; }
  function ligarArvore(on) {
    vivo = !!on; clearInterval(relogio);
    const c = box && box.querySelector('#tx-vivo-on'); if (c) c.checked = vivo;
    if (vivo) { errosSeguidos = 0; relogio = setInterval(puxar, 3000); vst('🔗 Árvore ligada ao Termux: o que você muda vai sozinho; o que o terminal cria aparece na árvore em 3 segundos.', 'ok'); }
    else vst('Árvore desligada do Termux (use ⬆ Mandar e ⬇ Trazer).');
  }
  async function puxar() {
    if (!vivo || puxandoAgora || !SK.fs.project || document.hidden) return;
    puxandoAgora = true;
    try {
      const r = await trazer(false); errosSeguidos = 0;
      if (r.novos + r.mudou) { vst('🔗 Do Termux para a árvore: ' + r.novos + ' novo(s), ' + r.mudou + ' mudado(s) — ' + new Date().toLocaleTimeString('pt-BR'), 'ok'); SK.toast('📱 Termux → árvore: ' + (r.novos + r.mudou) + ' arquivo(s)'); }
    } catch (e) { if (++errosSeguidos === 3) vst('⚠ A ponte parou de responder (o Android pode ter fechado o Termux). Toque em ▶ Ligar tudo.', 'erro'); }
    finally { puxandoAgora = false; }
  }
  async function esvaziarFila() {
    if (!vivo || !fila.size || !SK.fs.project) return;
    const itens = Array.from(fila.entries()); fila.clear();
    const projeto = nomeProj(), gravar = [], apagar = [];
    for (const [p, o] of itens) {
      if (o === 'apagar') { apagar.push(p); continue; }
      const lista = SK.fs.exists(p) ? [p] : SK.fs.list().filter((x) => x.startsWith(p + '/')); // pasta renomeada: manda o que tem dentro
      for (const q of lista) { if (PULAR.test(q)) continue; const rec = SK.fs.get(q); if (rec) gravar.push(rec.b64 != null ? { p: q, b64: rec.b64 } : { p: q, t: rec.text || '' }); }
    }
    try {
      let agora = 0;
      if (apagar.length) agora = (await chamar('/apagar', { projeto, caminhos: apagar })).agora;
      if (gravar.length) agora = (await chamar('/enviar', { projeto, arquivos: gravar })).agora;
      if (agora) SK.pref.set('termuxSync:' + projeto, Math.max(agora, SK.pref.get('termuxSync:' + projeto, 0)));
      vst('🔗 Da árvore para o Termux: ' + (gravar.length ? gravar.length + ' arquivo(s)' : '') + (apagar.length ? (gravar.length ? ', ' : '') + apagar.length + ' apagado(s)' : '') + ' — ' + new Date().toLocaleTimeString('pt-BR'), 'ok');
    } catch (e) { for (const [p, o] of itens) if (!fila.has(p)) fila.set(p, o); vst('⚠ Não consegui mandar para o Termux: ' + e.message, 'erro'); }
  }
  if (!PC) {
    SK.on('fs-change', (ev) => {
      if (!vivo || aplicando || !ev || ev.doTermux) return;
      if (ev.type === 'import' || ev.type === 'restore') { mandarProjeto().then(() => vst('🔗 Projeto inteiro mandado de novo para o Termux.', 'ok')).catch((e) => vst('⚠ ' + e.message, 'erro')); return; }
      const p = ev.path; if (!p || PULAR.test(p) || ev.type === 'mkdir') return;
      if (ev.type === 'remove') fila.set(p, 'apagar');
      else { if (ev.type === 'rename' && ev.from) fila.set(ev.from, 'apagar'); fila.set(p, 'gravar'); }
      clearTimeout(tFila); tFila = setTimeout(esvaziarFila, 700);
    });
    SK.on('project-open', () => { if (vivo && ws && ws.readyState === 1) mandarProjeto().then(() => vst('🔗 Projeto novo mandado para o Termux e já entrei na pasta dele.', 'ok')).catch((e) => vst('⚠ ' + e.message, 'erro')); });
  }

  // ── ▶ Ligar tudo (um toque, igual ao ▶ Ligar o Node) ──
  async function esperarAberto(ms) { const fim = Date.now() + ms; while (Date.now() < fim) { if (ws && ws.readyState === 1) return true; if (!ws) return false; await espera(150); } return !!(ws && ws.readyState === 1); }
  async function ligarTudo(passo) {
    passo = passo || (() => {});
    if (!(ws && ws.readyState === 1)) { passo('1/3 Conectando no Termux…'); await conectar(); if (!(await esperarAberto(8000))) throw new Error('O Termux não respondeu. Abra o Termux e rode o comando 2 (ttyd…).'); await espera(500); }
    passo('2/3 Ligando a ponte de arquivos… (na 1ª vez pode instalar o Node: demora uns minutos)');
    if (!(await ping(2))) await ligarPonte();
    if (SK.fs.project) { passo('3/3 Mandando o projeto…'); await mandarProjeto(); }
    ligarArvore(true);
    return true;
  }

  // ── 🌐 servidor no ar: quando o terminal escreve "localhost:5173", aparece o botão Ver aqui (igual ao Node) ──
  let rabo = '', portasVistas = new Set();
  const decS = new TextDecoder();
  function vigiarServidor(bytes) {
    rabo = (rabo + decS.decode(bytes, { stream: true }).replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, '')).slice(-600);
    const re = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::\]):(\d{2,5})/g; let m;
    while ((m = re.exec(rabo))) {
      const porta = +m[1];
      if (porta === 7681 || porta === 7682 || porta === 11434 || portasVistas.has(porta)) continue;
      portasVistas.add(porta); mostrarServidor(porta);
    }
  }
  function mostrarServidor(porta) {
    const el = box && box.querySelector('#tx-srv'); if (!el) return;
    el.hidden = false;
    const u = 'http://127.0.0.1:' + porta + '/';
    el.innerHTML = '<div class="row wrap"><b>🌐 Servidor no ar (porta ' + porta + ')</b><button class="btn small primary" id="tx-srv-ver">👁 Ver aqui</button><button class="btn small" id="tx-srv-fora">↗ Abrir em outra aba</button></div><iframe id="tx-srv-quadro" hidden title="O que o terminal ligou" style="width:100%;height:55vh;border:1px solid var(--line2,#333);border-radius:8px;background:#fff;margin-top:6px"></iframe>';
    el.querySelector('#tx-srv-ver').onclick = () => { const f = el.querySelector('#tx-srv-quadro'); f.hidden = !f.hidden; if (!f.hidden) f.src = u + '?t=' + Date.now(); };
    el.querySelector('#tx-srv-fora').onclick = () => window.open(u, '_blank');
    SK.toast('🌐 O terminal ligou um servidor na porta ' + porta);
  }

  if (PC) { const b = document.querySelector('[data-open="termux"]'); if (b) { b.innerHTML = '💻<span class="lbl">Terminal PC</span>'; b.title = 'Terminal do computador'; } }
  SK.termux = { build, conectar, desconectar, mandar, ligarPonte, mandarProjeto, trazer, ligarTudo, ligarArvore, get ligado() { return !!(ws && ws.readyState === 1); } };
})(window.SK);
