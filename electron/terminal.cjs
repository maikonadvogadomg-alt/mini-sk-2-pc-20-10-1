/* Terminal do computador para o Mini SK — fala o mesmo "idioma" do ttyd
   (o do Termux), então o painel 📱/💻 do Mini SK funciona sem mudar nada.
   Cada linha que você digita roda como um comando (cmd no Windows).
   Ctrl+C para o comando que está rodando. "cd" muda de pasta. */
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const WIN = process.platform === 'win32';

module.exports = function iniciarTerminal({ porta, base, origem }) {
  const wss = new WebSocketServer({
    host: '127.0.0.1', port: porta, path: '/ws',
    handleProtocols: (ps) => (ps.has('tty') ? 'tty' : false),
    // só a janela do próprio Mini SK pode usar (nenhum site de fora entra)
    verifyClient: (info) => !origem || info.origin === origem,
  });
  wss.on('connection', (ws) => {
    let cwd = base, buf = '', hist = [], hi = 0, proc = null, pronto = false, linhaProc = '';
    const mandar = (t) => { if (ws.readyState === 1) ws.send(Buffer.concat([Buffer.from('0'), Buffer.from(String(t).replace(/\r?\n/g, '\r\n'), 'utf8')])); };
    // prompt curto: dentro da pasta do Mini SK mostra só o nome do projeto (o caminho todo ocupava 4 linhas)
    const curto = () => { const rel = path.relative(base, cwd); return (!rel || (!rel.startsWith('..') && !path.isAbsolute(rel))) ? '📁 ' + (rel || 'Mini-SK') : cwd; };
    const prompt = () => mandar('\r\n\x1b[32m' + curto() + '\x1b[0m> ');
    const trocarLinha = (nova) => { mandar('\b \b'.repeat(buf.length)); buf = nova; mandar(buf); };
    function parar() {
      if (!proc) return;
      try { if (WIN) spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true }); else process.kill(-proc.pid, 'SIGINT'); } catch { try { proc.kill(); } catch {} }
    }
    function expandir(alvo) {
      alvo = alvo.trim().replace(/^\/d\s+/i, '').replace(/^["']|["']$/g, '').replace(/["']/g, '');
      if (!alvo) return os.homedir();
      if (/^~\/minisk(\/|$)/.test(alvo)) alvo = path.join(base, alvo.replace(/^~\/minisk\/?/, ''));
      else if (/^~(\/|$)/.test(alvo)) alvo = path.join(os.homedir(), alvo.slice(2));
      return path.resolve(cwd, alvo);
    }
    function rodar(linha) {
      linha = linha.trim();
      if (!linha) return prompt();
      hist.push(linha); hi = hist.length;
      const cd = linha.match(/^cd(?:\s+(.*))?$/i);
      if (cd) {
        const alvo = expandir(cd[1] || '');
        if (fs.existsSync(alvo) && fs.statSync(alvo).isDirectory()) cwd = alvo; else mandar('\r\nPasta não existe: ' + alvo);
        return prompt();
      }
      if (/^(cls|clear)$/i.test(linha)) { mandar('\x1b[2J\x1b[H'); return prompt(); }
      const cmd = WIN ? 'chcp 65001>nul & ' + linha : linha;
      try {
        proc = spawn(cmd, { cwd, shell: WIN ? true : '/bin/bash', windowsHide: true, detached: !WIN, env: Object.assign({}, process.env, { FORCE_COLOR: '1', npm_config_color: 'always' }) });
      } catch (e) { mandar('\r\n' + e.message); proc = null; return prompt(); }
      proc.stdout.on('data', (d) => mandar(d.toString('utf8')));
      proc.stderr.on('data', (d) => mandar(d.toString('utf8')));
      proc.on('error', (e) => mandar('\r\n' + e.message));
      proc.on('close', (code) => { proc = null; linhaProc = ''; if (code) mandar('\r\n\x1b[33m[terminou com código ' + code + ']\x1b[0m'); prompt(); });
    }
    function tecla(t) {
      if (proc) { // um comando está rodando: o que você digita vai para ele
        for (const ch of t) {
          if (ch === '\x03') { mandar('^C'); parar(); }
          else if (ch === '\r') { mandar('\r\n'); try { proc.stdin.write(linhaProc + '\n'); } catch {} linhaProc = ''; }
          else if (ch === '\x7f' || ch === '\b') { if (linhaProc) { linhaProc = linhaProc.slice(0, -1); mandar('\b \b'); } }
          else if (ch >= ' ') { linhaProc += ch; mandar(ch); }
        }
        return;
      }
      if (t === '\x1b[A') { if (hi > 0) { hi--; trocarLinha(hist[hi]); } return; }
      if (t === '\x1b[B') { if (hi < hist.length) { hi++; trocarLinha(hist[hi] || ''); } return; }
      if (t.startsWith('\x1b')) return;
      for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if (ch === '\r' || ch === '\n') { mandar('\r\n'); const l = buf; buf = ''; rodar(l); if (proc) { tecla(t.slice(i + 1)); return; } }
        else if (ch === '\x7f' || ch === '\b') { if (buf) { buf = buf.slice(0, -1); mandar('\b \b'); } }
        else if (ch === '\x03') { mandar('^C'); buf = ''; prompt(); }
        else if (ch === '\t') { /* sem completar */ }
        else if (ch >= ' ') { buf += ch; mandar(ch); }
      }
    }
    ws.on('message', (data) => {
      const b = Buffer.from(data);
      if (!pronto) { pronto = true; if (b[0] === 0x7b) { mandar('\x1b[36m💻 Terminal do computador (' + (WIN ? 'Windows' : process.platform) + ')\x1b[0m\r\nDigite um comando e Enter. Ctrl+C para parar. Pasta inicial: ' + base); prompt(); return; } }
      const tipo = String.fromCharCode(b[0]);
      if (tipo === '0') tecla(b.subarray(1).toString('utf8'));
    });
    ws.on('close', parar);
  });
  return wss;
};
