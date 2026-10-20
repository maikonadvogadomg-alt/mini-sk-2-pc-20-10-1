/* Mini SK — service worker
   - Faz o Mini SK instalar como app (PWA) e abrir mais rápido.
   - 🔒 Lacre (só quando registrado como "sw.js?lacre=1", pelo painel ⚡ Node):
     põe Cross-Origin-Opener-Policy + Cross-Origin-Embedder-Policy em tudo que
     vem do próprio Mini SK. É isso que deixa o Node de verdade (WebContainer) ligar.
     "credentialless" = deixa carregar imagens/scripts de outros sites mesmo sem
     autorização especial (atrapalha menos que o "require-corp").
   - Sempre busca a versão nova na internet primeiro; a cópia guardada só é usada sem internet. */
const LACRE = new URL(self.location.href).searchParams.get('lacre') === '1';
const CACHE = 'minisk2-v1'; // Mini SK 2: cache separado do Mini SK original

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE && k.indexOf('minisk2-') === 0) await caches.delete(k); // só os do Mini SK 2 (não mexe no original)
  await self.clients.claim();
})()));

function comLacre(res) {
  if (!LACRE || !res || res.type === 'opaque' || res.type === 'opaqueredirect' || res.status === 0) return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'credentialless');
  h.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;           // só mexe no que é do próprio Mini SK
  e.respondWith((async () => {
    try {
      const res = await fetch(r);
      if (res.ok && res.type === 'basic') { const c = await caches.open(CACHE); c.put(r, res.clone()).catch(() => {}); }
      return comLacre(res);
    } catch (err) {
      const guardada = await caches.match(r);
      if (guardada) return comLacre(guardada);
      throw err;
    }
  })());
});
