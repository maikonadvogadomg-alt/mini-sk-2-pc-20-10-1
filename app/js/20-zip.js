/* =========================================================================
   Mini SK — 20-zip.js
   Lê e cria arquivos .zip SEM biblioteca externa (funciona offline).
   Usa o descompactador que já vem no navegador (DecompressionStream).
   ========================================================================= */
(function (SK) {
  'use strict';

  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

  async function streamThrough(u8, stream) {
    const res = new Response(new Blob([u8]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }
  const canInflate = typeof DecompressionStream !== 'undefined';
  const canDeflate = typeof CompressionStream !== 'undefined';

  /** Lê um .zip → [{ name, data: Uint8Array }] */
  async function read(buffer) {
    const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    // Procura o "fim do diretório central" (EOCD), lendo de trás para frente
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Arquivo .zip inválido ou corrompido');
    let count = dv.getUint16(eocd + 10, true);
    let cdOffset = dv.getUint32(eocd + 16, true);
    // ZIP64 (arquivos muito grandes)
    if (cdOffset === 0xffffffff || count === 0xffff) {
      const loc = eocd - 20;
      if (loc >= 0 && dv.getUint32(loc, true) === 0x07064b50) {
        const z64 = Number(dv.getBigUint64(loc + 8, true));
        count = Number(dv.getBigUint64(z64 + 32, true));
        cdOffset = Number(dv.getBigUint64(z64 + 48, true));
      }
    }
    const out = [];
    let p = cdOffset;
    const utf8 = new TextDecoder('utf-8'), cp437 = new TextDecoder('windows-1252');
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const flags = dv.getUint16(p + 8, true);
      const method = dv.getUint16(p + 10, true);
      let compSize = dv.getUint32(p + 20, true);
      let size = dv.getUint32(p + 24, true);
      const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
      let localOff = dv.getUint32(p + 42, true);
      const nameBytes = u8.subarray(p + 46, p + 46 + nameLen);
      let name;
      if (flags & 0x800) name = utf8.decode(nameBytes);
      else { try { name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes); } catch { name = cp437.decode(nameBytes); } }
      name = name.replace(/\\/g, '/');
      // extra ZIP64
      let e = p + 46 + nameLen; const eEnd = e + extraLen;
      while (e + 4 <= eEnd) {
        const id = dv.getUint16(e, true), len = dv.getUint16(e + 2, true);
        if (id === 0x0001) { let q = e + 4; if (size === 0xffffffff) { size = Number(dv.getBigUint64(q, true)); q += 8; } if (compSize === 0xffffffff) { compSize = Number(dv.getBigUint64(q, true)); q += 8; } if (localOff === 0xffffffff) { localOff = Number(dv.getBigUint64(q, true)); } }
        e += 4 + len;
      }
      p += 46 + nameLen + extraLen + commentLen;
      if (name.endsWith('/')) continue; // pasta
      const lNameLen = dv.getUint16(localOff + 26, true), lExtraLen = dv.getUint16(localOff + 28, true);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const comp = u8.subarray(start, start + compSize);
      let data;
      if (method === 0) data = comp.slice();
      else if (method === 8) {
        if (!canInflate) throw new Error('Este navegador não sabe descompactar .zip (atualize o Chrome/Edge/Safari)');
        data = await streamThrough(comp, new DecompressionStream('deflate-raw'));
      } else { console.warn('[zip] método não suportado', method, name); continue; }
      out.push({ name, data });
    }
    return out;
  }

  /** Cria um .zip a partir de [{ name, data: Uint8Array|string }] → Blob */
  async function write(entries) {
    const enc = new TextEncoder();
    const chunks = [], central = [];
    let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const ent of entries) {
      const nameBytes = enc.encode(ent.name);
      const raw = typeof ent.data === 'string' ? enc.encode(ent.data) : (ent.data || new Uint8Array(0));
      const crc = crc32(raw);
      let method = 0, body = raw;
      if (canDeflate && raw.length > 64 && !ent.name.endsWith('/')) {
        const def = await streamThrough(raw, new CompressionStream('deflate-raw'));
        if (def.length < raw.length) { method = 8; body = def; }
      }
      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x800, true); lv.setUint16(8, method, true);
      lv.setUint16(10, dosTime, true); lv.setUint16(12, dosDate, true); lv.setUint32(14, crc, true);
      lv.setUint32(18, body.length, true); lv.setUint32(22, raw.length, true); lv.setUint16(26, nameBytes.length, true); lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      const cd = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true); cv.setUint16(10, method, true);
      cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true); cv.setUint32(16, crc, true);
      cv.setUint32(20, body.length, true); cv.setUint32(24, raw.length, true); cv.setUint16(28, nameBytes.length, true);
      cv.setUint32(38, ent.name.endsWith('/') ? 0x10 : 0, true); cv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);
      chunks.push(local, body); central.push(cd);
      offset += local.length + body.length;
    }
    const cdSize = central.reduce((s, c) => s + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, central.length, true); ev.setUint16(10, central.length, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, end], { type: 'application/zip' });
  }

  // ── .tar, .tar.gz, .tgz, .taz (o que o Replit baixa) ──────────────────────
  const ehCompactado = (nome) => /\.(zip|tar|tgz|taz|gz)$/i.test(nome);
  const nomeSemExt = (nome) => nome.replace(/\.(tar\.gz|tgz|taz|tar|gz|zip)$/i, '');
  async function lerTar(u8) {
    // .gz por fora? (começa com 1f 8b) → descompacta com o próprio navegador
    if (u8[0] === 0x1f && u8[1] === 0x8b) {
      if (!canInflate) throw new Error('Este navegador não abre .tar.gz');
      u8 = await streamThrough(u8, new DecompressionStream('gzip'));
    }
    const out = []; const dec = new TextDecoder('utf-8');
    const str = (a, b) => { const s = u8.subarray(a, b); const z = s.indexOf(0); return dec.decode(z >= 0 ? s.subarray(0, z) : s); };
    let p = 0, nomeLongo = null, paxNome = null;
    while (p + 512 <= u8.length) {
      if (u8[p] === 0 && u8[p + 1] === 0) break;                                  // fim
      let nome = str(p, p + 100);
      const tam = parseInt(str(p + 124, p + 136).trim() || '0', 8) || 0;
      const tipo = String.fromCharCode(u8[p + 156] || 48);
      const prefixo = str(p + 345, p + 500);
      if (prefixo && str(p + 257, p + 262) === 'ustar') nome = prefixo + '/' + nome;
      const ini = p + 512, fim = ini + tam;
      if (tipo === 'L') nomeLongo = str(ini, fim);                                 // nome comprido (GNU)
      else if (tipo === 'x') { const m = /\d+ path=([^\n]*)\n/.exec(dec.decode(u8.subarray(ini, fim))); paxNome = m ? m[1] : null; }
      else if (tipo === '0' || tipo === '\0' || tipo === '7') {
        out.push({ name: paxNome || nomeLongo || nome, data: u8.slice(ini, fim) });
        nomeLongo = null; paxNome = null;
      } else { nomeLongo = null; paxNome = null; }                                 // pastas, links: pula
      p = ini + Math.ceil(tam / 512) * 512;
    }
    if (!out.length) throw new Error('Arquivo .tar vazio ou não reconhecido');
    return out;
  }
  /** Lê .zip OU .tar/.tar.gz/.tgz/.taz → [{ name, data }] */
  async function readAny(buffer, nome) {
    const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (u8[0] === 0x50 && u8[1] === 0x4b) return read(u8);                         // "PK" = zip (mesmo com outro nome)
    return lerTar(u8);
  }

  SK.zip = { read, write, crc32, readAny, ehCompactado, nomeSemExt };
})(window.SK);
