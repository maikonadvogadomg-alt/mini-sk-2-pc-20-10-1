/* =========================================================================
   Mini SK — js/lib/selar.js
   "Tranca" um segredo do jeito que o GitHub exige para guardar em
   Settings → Secrets (libsodium "sealed box"):
     chave temporária (X25519) + nonce = BLAKE2b(chaveTemp || chaveDoRepo, 24 bytes)
     + caixa NaCl (XSalsa20-Poly1305).
   Usa a tweetnacl (js/lib/nacl-fast.min.js, domínio público).
   SK.selar(textoSegredo, chavePublicaBase64) → base64 pronto para a API.
   ========================================================================= */
(function (SK) {
  'use strict';

  // ── BLAKE2b (RFC 7693), sem chave, saída de 1 a 64 bytes ────────────────────
  // palavras de 64 bits guardadas como (metade baixa, metade alta)
  const IV = [0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85, 0xfe94f82b, 0x3c6ef372, 0x5f1d36f1, 0xa54ff53a,
    0xade682d1, 0x510e527f, 0x2b3e6c1f, 0x9b05688c, 0xfb41bd6b, 0x1f83d9ab, 0x137e2179, 0x5be0cd19];
  const SIGMA = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3,
    11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4, 7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8,
    9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13, 2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9,
    12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11, 13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10,
    6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5, 10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0,
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3].map((x) => x * 2);
  function add64(v, a, b) { const o0 = v[a] + v[b]; let o1 = v[a + 1] + v[b + 1]; if (o0 >= 0x100000000) o1++; v[a] = o0 >>> 0; v[a + 1] = o1 >>> 0; }
  function add64c(v, a, b0, b1) { let o0 = v[a] + b0; if (b0 < 0) o0 += 0x100000000; let o1 = v[a + 1] + b1; if (o0 >= 0x100000000) o1++; v[a] = o0 >>> 0; v[a + 1] = o1 >>> 0; }
  function g(v, m, a, b, c, d, ix, iy) {
    const x0 = m[ix], x1 = m[ix + 1], y0 = m[iy], y1 = m[iy + 1];
    add64(v, a, b); add64c(v, a, x0, x1);
    let xor0 = v[d] ^ v[a], xor1 = v[d + 1] ^ v[a + 1]; v[d] = xor1; v[d + 1] = xor0;
    add64(v, c, d);
    xor0 = v[b] ^ v[c]; xor1 = v[b + 1] ^ v[c + 1]; v[b] = (xor0 >>> 24) ^ (xor1 << 8); v[b + 1] = (xor1 >>> 24) ^ (xor0 << 8);
    add64(v, a, b); add64c(v, a, y0, y1);
    xor0 = v[d] ^ v[a]; xor1 = v[d + 1] ^ v[a + 1]; v[d] = (xor0 >>> 16) ^ (xor1 << 16); v[d + 1] = (xor1 >>> 16) ^ (xor0 << 16);
    add64(v, c, d);
    xor0 = v[b] ^ v[c]; xor1 = v[b + 1] ^ v[c + 1]; v[b] = (xor1 >>> 31) ^ (xor0 << 1); v[b + 1] = (xor0 >>> 31) ^ (xor1 << 1);
  }
  function compress(ctx, last) {
    const v = new Uint32Array(32), m = new Uint32Array(32);
    for (let i = 0; i < 16; i++) { v[i] = ctx.h[i]; v[i + 16] = IV[i]; }
    v[24] ^= ctx.t; v[25] ^= ctx.t / 0x100000000;
    if (last) { v[28] = ~v[28]; v[29] = ~v[29]; }
    for (let i = 0; i < 32; i++) m[i] = ctx.b[i * 4] ^ (ctx.b[i * 4 + 1] << 8) ^ (ctx.b[i * 4 + 2] << 16) ^ (ctx.b[i * 4 + 3] << 24);
    for (let i = 0; i < 12; i++) {
      const s = i * 16;
      g(v, m, 0, 8, 16, 24, SIGMA[s], SIGMA[s + 1]); g(v, m, 2, 10, 18, 26, SIGMA[s + 2], SIGMA[s + 3]);
      g(v, m, 4, 12, 20, 28, SIGMA[s + 4], SIGMA[s + 5]); g(v, m, 6, 14, 22, 30, SIGMA[s + 6], SIGMA[s + 7]);
      g(v, m, 0, 10, 20, 30, SIGMA[s + 8], SIGMA[s + 9]); g(v, m, 2, 12, 22, 24, SIGMA[s + 10], SIGMA[s + 11]);
      g(v, m, 4, 14, 16, 26, SIGMA[s + 12], SIGMA[s + 13]); g(v, m, 6, 8, 18, 28, SIGMA[s + 14], SIGMA[s + 15]);
    }
    for (let i = 0; i < 16; i++) ctx.h[i] = ctx.h[i] ^ v[i] ^ v[i + 16];
  }
  function blake2b(input, outlen) {
    const ctx = { b: new Uint8Array(128), h: new Uint32Array(16), t: 0, c: 0 };
    for (let i = 0; i < 16; i++) ctx.h[i] = IV[i];
    ctx.h[0] ^= 0x01010000 ^ outlen;
    for (let i = 0; i < input.length; i++) {
      if (ctx.c === 128) { ctx.t += ctx.c; compress(ctx, false); ctx.c = 0; }
      ctx.b[ctx.c++] = input[i];
    }
    ctx.t += ctx.c;
    while (ctx.c < 128) ctx.b[ctx.c++] = 0;
    compress(ctx, true);
    const out = new Uint8Array(outlen);
    for (let i = 0; i < outlen; i++) out[i] = ctx.h[i >> 2] >> (8 * (i & 3));
    return out;
  }

  const b64para = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const paraB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };

  function selar(texto, chavePublicaB64) {
    const nacl = window.nacl;
    if (!nacl) throw new Error('Falta a biblioteca de criptografia (js/lib/nacl-fast.min.js).');
    const pk = b64para(chavePublicaB64);
    if (pk.length !== 32) throw new Error('Chave do repositório inválida.');
    const temp = nacl.box.keyPair();
    const junto = new Uint8Array(64); junto.set(temp.publicKey, 0); junto.set(pk, 32);
    const nonce = blake2b(junto, 24);
    const caixa = nacl.box(new TextEncoder().encode(texto), nonce, pk, temp.secretKey);
    const saida = new Uint8Array(32 + caixa.length); saida.set(temp.publicKey, 0); saida.set(caixa, 32);
    return paraB64(saida);
  }
  // Para conferência (testes): abre o que foi selado, com a chave secreta do repositório
  function abrir(seladoB64, pkB64, skB64) {
    const nacl = window.nacl, c = b64para(seladoB64), pk = b64para(pkB64), sk = b64para(skB64);
    const epk = c.slice(0, 32), junto = new Uint8Array(64); junto.set(epk, 0); junto.set(pk, 32);
    const m = nacl.box.open(c.slice(32), blake2b(junto, 24), epk, sk);
    return m ? new TextDecoder().decode(m) : null;
  }

  SK.selar = selar;
  SK._selar = { blake2b, abrir, paraB64, b64para };
})(window.SK = window.SK || {});
