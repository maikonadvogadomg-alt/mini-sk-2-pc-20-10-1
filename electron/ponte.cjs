// Ponte de arquivos do Mini SK — no PC, o próprio programa liga (no celular, roda no Termux). Leva o projeto da árvore para
// ~/minisk/NOME e traz de volta o que o terminal criou (dist, arquivos novos…).
// Só o próprio celular enxerga (127.0.0.1) e só quem tem o código entra.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const CODIGO = process.env.PONTE_CODIGO || process.argv[2] || '', PORTA = Number(process.env.PONTE_PORTA || process.argv[3] || 7682);
const BASE = process.env.PONTE_BASE || path.join(os.homedir(), 'minisk');
const PULAR = /(^|\/)(node_modules|\.git|\.sk|\.gradle|\.cache)(\/|$)/;
fs.mkdirSync(BASE, { recursive: true });
const nomeProj = (n) => String(n || 'projeto').replace(/[^\w.\- ]+/g, '_').replace(/^\.+/, '').slice(0, 60) || 'projeto';
function dentro(proj, rel) {
  const raiz = path.resolve(BASE, nomeProj(proj));
  const p = path.resolve(raiz, String(rel || ''));
  if (p !== raiz && !p.startsWith(raiz + path.sep)) throw new Error('caminho inválido: ' + rel);
  return { raiz, p };
}
function responder(res, cod, obj) { res.writeHead(cod, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
function corpo(req) {
  return new Promise((ok, erro) => {
    const partes = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > 80e6) { erro(new Error('grande demais')); req.destroy(); } else partes.push(c); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}')); } catch (e) { erro(e); } });
    req.on('error', erro);
  });
}
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Codigo');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (!CODIGO || req.headers['x-codigo'] !== CODIGO) return responder(res, 403, { erro: 'código errado' });
  const u = new URL(req.url, 'http://x');
  try {
    if (u.pathname === '/ping') return responder(res, 200, { ok: true, pasta: BASE, versao: 1, agora: Date.now() });
    if (u.pathname === '/enviar' && req.method === 'POST') {
      const b = await corpo(req); let n = 0; const pulados = [];
      for (const a of b.arquivos || []) {
        try {
          if (PULAR.test(a.p)) continue;
          const { p } = dentro(b.projeto, a.p);
          if (a.pasta) { fs.mkdirSync(p, { recursive: true }); n++; continue; }
          fs.mkdirSync(path.dirname(p), { recursive: true });
          fs.writeFileSync(p, a.b64 != null ? Buffer.from(a.b64, 'base64') : String(a.t || ''));
          n++;
        } catch (e) { pulados.push(a.p + ': ' + e.message); }
      }
      return responder(res, 200, { ok: true, n, pulados, pasta: dentro(b.projeto, '').raiz, agora: Date.now() + 1 });
    }
    if (u.pathname === '/listar') {
      const { raiz } = dentro(u.searchParams.get('projeto'), '');
      const desde = Number(u.searchParams.get('desde') || 0);
      const lista = [], todos = []; let total = 0, cortou = false;
      const andar = (d) => {
        let itens = []; try { itens = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const e of itens) {
          const f = path.join(d, e.name), rel = path.relative(raiz, f).split(path.sep).join('/');
          if (PULAR.test(rel)) continue;
          if (e.isDirectory()) { andar(f); continue; }
          if (!e.isFile()) continue;
          const st = fs.statSync(f);
          todos.push(rel);
          if (st.mtimeMs <= desde || st.size > 5e6) continue;
          if (total + st.size > 30e6) { cortou = true; continue; }
          total += st.size;
          lista.push({ p: rel, b64: fs.readFileSync(f).toString('base64') });
        }
      };
      const agora = Date.now();
      andar(raiz);
      return responder(res, 200, { ok: true, agora, arquivos: lista, todos, cortou });
    }
    // apagar na pasta o que foi apagado na árvore (só dentro da pasta do projeto)
    if (u.pathname === '/apagar' && req.method === 'POST') {
      const b = await corpo(req); let n = 0;
      for (const rel of b.caminhos || []) { try { const { raiz, p } = dentro(b.projeto, rel); if (p === raiz) continue; if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); n++; } } catch (e) {} }
      return responder(res, 200, { ok: true, n, agora: Date.now() + 1 });
    }
    responder(res, 404, { erro: 'não existe' });
  } catch (e) { responder(res, 500, { erro: e.message }); }
}).listen(PORTA, '127.0.0.1', () => console.log('Ponte do Mini SK ligada na porta ' + PORTA + ' · pasta ' + BASE));
