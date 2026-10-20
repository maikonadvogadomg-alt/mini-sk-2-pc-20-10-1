// service-worker.js — gerado pelo Mini SK em 20/10/2026, 16:22:12
// Não precisa mexer: ele guarda sozinho o que o app usa.
const PREFIXO = 'sk-mini-sk-2-';
const CACHE = PREFIXO + 'mvh2l4u5';
// Lista feita automaticamente (para funcionar sem internet logo após instalar)
const GUARDAR = [
  "./",
  "./css/app.css",
  "./favicon.ico",
  "./icons/apple-touch-icon.png",
  "./icons/icon-16.png",
  "./icons/icon-32.png",
  "./icons/icon-48.png",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-384.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./icons/maskable.svg",
  "./index.html",
  "./js/00-core.js",
  "./js/04-conta.js",
  "./js/10-fs.js",
  "./js/20-zip.js",
  "./js/30-highlight.js",
  "./js/40-editor.js",
  "./js/50-tree.js",
  "./js/60-preview.js",
  "./js/61-tsx.js",
  "./js/70-search.js",
  "./js/80-ai.js",
  "./js/81-gasto.js",
  "./js/83-voz.js",
  "./js/84-ponte.js",
  "./js/85-checkpoints.js",
  "./js/86-terminal.js",
  "./js/86b-node.js",
  "./js/86c-termux.js",
  "./js/86e-atalhos.js",
  "./js/86f-pasta-viva.js",
  "./js/86g-largura.js",
  "./js/87-links.js",
  "./js/88-inventario.js",
  "./js/89-config.js",
  "./js/90-github.js",
  "./js/91-acoes.js",
  "./js/92-playground.js",
  "./js/92c-importar.js",
  "./js/93-conversa.js",
  "./js/94-fatiador.js",
  "./js/95-pwa.js",
  "./js/96-apk.js",
  "./js/96b-eas.js",
  "./js/96c-preparar.js",
  "./js/97-analise.js",
  "./js/98-api.js",
  "./js/99-app.js",
  "./js/lib/expo-core.js",
  "./js/lib/jszip.min.js",
  "./js/lib/nacl-fast.min.js",
  "./js/lib/picotador/00-base.js",
  "./js/lib/picotador/10-ler.js",
  "./js/lib/picotador/20-projetos.js",
  "./js/lib/picotador/30-mensagens.js",
  "./js/lib/plano-core.js",
  "./js/lib/ponte-termux.cjs.txt",
  "./js/lib/receita-core.js",
  "./js/lib/selar.js",
  "./LEIA-ME.md",
  "./manifest.json",
  "./sw.js"
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(GUARDAR.map((u) => c.add(u).catch(() => null)))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIXO) && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Primeiro a internet (sempre a versão nova); sem internet, a cópia guardada.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      // Igual ao Workbox da Replit: página que não existe (rota do app) abre o index
      if (res.status === 404 && req.mode === 'navigate') return caches.match('./').then((r) => r || fetch('./'));
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? caches.match('./') : undefined)))
  );
});
