/* Mini SK para PC — abre o Mini SK numa janela própria e liga, por dentro:
   - o 💻 Terminal do computador (cmd do Windows), no lugar do Termux;
   - a ⇅ ponte de arquivos (Mandar / Trazer) numa pasta de verdade:
     Documentos\Mini-SK\NOME-DO-PROJETO
   - e libera o Ollama (IA grátis no seu PC) sem configurar nada. */
const { app, BrowserWindow, shell, session, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const crypto = require('crypto');

const SO_TESTAR = process.env.TESTE_SAIR === '1';
if (!SO_TESTAR && !app.requestSingleInstanceLock()) { app.quit(); return; }

let PKG = {}; try { PKG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')); } catch {}
const NOME = (PKG.build && PKG.build.productName) || 'Mini SK';
const CASA = process.env.DADOS_EM || path.join(app.getPath('documents'), PKG.pastaDoPrograma || 'Mini-SK');  // Mini SK 2: pasta própria (Documentos\Mini-SK-2)
fs.mkdirSync(CASA, { recursive: true });
const REGISTRO = path.join(CASA, 'registro.txt');
const log = (...a) => { try { fs.appendFileSync(REGISTRO, new Date().toLocaleString('pt-BR') + ' ' + a.map((x) => (x instanceof Error ? x.stack : String(x))).join(' ') + '\n'); } catch {} console.log(...a); };
process.on('uncaughtException', (e) => log('ERRO:', e));

const APP = path.join(__dirname, '..', 'app');
const CODIGO = crypto.randomBytes(16).toString('hex');
// portas: 7680/7681/7682 no Mini SK normal. Um "app NOVO" (📦 → 🆕) ganha outras, guardadas no package.json,
// para rodar AO LADO do outro sem misturar os projetos.
const PORTA_APP = Number(PKG.portaDoPrograma) || 7680, PORTA_TERMINAL = PORTA_APP + 1, PORTA_PONTE = PORTA_APP + 2;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8' };

function portaOcupada(p) { return new Promise((ok) => { const s = net.createServer(); s.once('error', () => ok(true)); s.listen(p, '127.0.0.1', () => s.close(() => ok(false))); }); }

function servirApp() {
  return new Promise((ok) => {
    const srv = http.createServer((req, res) => {
      let u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (u === '/' || u === '') u = '/index.html';
      const f = path.join(APP, path.normalize(u).replace(/^([/\\])+/, ''));
      if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('não existe'); }
      const h = { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' };
      res.writeHead(200, h); fs.createReadStream(f).pipe(res);
    });
    // porta FIXA: os projetos ficam guardados "por endereço"; se a porta mudasse, eles sumiriam
    srv.once('error', (e) => { log('ERRO ao abrir a porta ' + PORTA_APP + ':', e); dialog.showErrorBox(NOME, 'A porta ' + PORTA_APP + ' está ocupada por outro programa. Feche-o e abra o Mini SK de novo.'); app.exit(1); });
    srv.listen(PORTA_APP, '127.0.0.1', () => ok(PORTA_APP));
  });
}

async function ligarTudo() {
  const porta = await servirApp();
  const origem = 'http://127.0.0.1:' + porta;
  log('Mini SK em ' + origem + ' · pasta ' + CASA);
  if (await portaOcupada(PORTA_PONTE)) log('⚠ A porta ' + PORTA_PONTE + ' (ponte) está ocupada — outro Mini SK aberto?');
  else { process.env.PONTE_CODIGO = CODIGO; process.env.PONTE_PORTA = String(PORTA_PONTE); process.env.PONTE_BASE = CASA; require('./ponte.cjs'); }
  if (await portaOcupada(PORTA_TERMINAL)) log('⚠ A porta ' + PORTA_TERMINAL + ' (terminal) está ocupada — feche o outro programa que usa ela.');
  else require('./terminal.cjs')({ porta: PORTA_TERMINAL, base: CASA, origem });
  return origem;
}

function pedir(url, headers) { return new Promise((ok) => { const q = http.get(url, { headers }, (r) => { r.resume(); ok(r.statusCode); }); q.on('error', () => ok(0)); q.setTimeout(4000, () => q.destroy()); }); }

// 🦙 Ollama: se estiver instalado e desligado, liga escondido (sem janela preta)
function ollamaLigado() { return new Promise((ok) => { const q = http.get('http://127.0.0.1:11434/api/version', (r) => { r.resume(); ok(r.statusCode === 200); }); q.on('error', () => ok(false)); q.setTimeout(2500, () => { q.destroy(); ok(false); }); }); }
async function ligarOllama() {
  if (await ollamaLigado()) return 'já estava ligado';
  const tentativas = [['ollama', ['serve']]];
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) tentativas.push([path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe'), ['serve']]);
  for (const [cmd, args] of tentativas) {
    try { const p = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }); p.on('error', () => {}); p.unref(); } catch { continue; }
    for (let i = 0; i < 8; i++) { await new Promise((r) => setTimeout(r, 1000)); if (await ollamaLigado()) { log('Ollama ligado pelo Mini SK'); return 'liguei'; } }
  }
  return 'não achei o Ollama instalado';
}
ipcMain.handle('ligar-ollama', () => ligarOllama());
// 📂 abrir a pasta do projeto no Explorador do Windows (só dentro de Documentos\Mini-SK)
ipcMain.handle('abrir-pasta', (_e, p) => { const alvo = path.resolve(String(p || CASA)); if (alvo !== CASA && !alvo.startsWith(CASA + path.sep)) return 'fora'; fs.mkdirSync(alvo, { recursive: true }); return shell.openPath(alvo); });
ipcMain.handle('desligar-ollama', () => new Promise((ok) => {
  const cmds = process.platform === 'win32' ? [['taskkill', ['/f', '/im', 'ollama.exe']], ['taskkill', ['/f', '/im', 'ollama app.exe']]] : [['pkill', ['-f', 'ollama']]];
  let n = 0; for (const [c, a] of cmds) { try { const p = spawn(c, a, { windowsHide: true, stdio: 'ignore' }); p.on('error', () => {}); p.on('close', () => { if (++n === cmds.length) ok('ok'); }); } catch { if (++n === cmds.length) ok('ok'); } }
}));

let janela = null;
app.whenReady().then(async () => {
  const origem = await ligarTudo();
  if (SO_TESTAR) {
    await new Promise((r) => setTimeout(r, 800));
    const a = await pedir(origem + '/index.html');
    const b = await pedir('http://127.0.0.1:' + PORTA_PONTE + '/ping', { 'X-Codigo': CODIGO });
    log('TESTE: tela=' + a + ' ponte=' + b);
    app.exit(a === 200 && b === 200 ? 0 : 1);
    return;
  }
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(['media', 'clipboard-read', 'clipboard-sanitized-write', 'notifications', 'fullscreen'].includes(perm)));
  janela = new BrowserWindow({
    width: 1360, height: 900, title: NOME, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, spellcheck: true, additionalArguments: ['--minisk-codigo=' + CODIGO, '--minisk-pasta=' + CASA, '--minisk-portas=' + PORTA_APP + ',' + PORTA_TERMINAL + ',' + PORTA_PONTE] },
  });
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(origem) || url.startsWith('blob:') || url === 'about:blank') return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } };
    shell.openExternal(url); return { action: 'deny' };
  });
  janela.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(origem)) { e.preventDefault(); shell.openExternal(url); } });
  janela.loadURL(origem + '/index.html');
  ligarOllama().catch(() => {}); // se tiver Ollama no PC, já deixa ligado
});
app.on('second-instance', () => { if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); } });
app.on('window-all-closed', () => app.quit());
