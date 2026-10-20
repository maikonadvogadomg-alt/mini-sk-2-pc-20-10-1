// service-worker.js — gerado pelo Mini SK em 20/10/2026, 16:22:28
// Não precisa mexer: ele guarda sozinho o que o app usa.
const PREFIXO = 'sk-mini-sk-2-pc-20-10-1-';
const CACHE = PREFIXO + 'mvh2lhap';
// Lista feita automaticamente (para funcionar sem internet logo após instalar)
const GUARDAR = [
  "./",
  "./app/css/app.css",
  "./app/favicon.ico",
  "./app/icons/apple-touch-icon.png",
  "./app/icons/icon-16.png",
  "./app/icons/icon-32.png",
  "./app/icons/icon-48.png",
  "./app/icons/icon-72.png",
  "./app/icons/icon-96.png",
  "./app/icons/icon-128.png",
  "./app/icons/icon-144.png",
  "./app/icons/icon-152.png",
  "./app/icons/icon-180.png",
  "./app/icons/icon-192.png",
  "./app/icons/icon-384.png",
  "./app/icons/icon-512.png",
  "./app/icons/icon.svg",
  "./app/icons/maskable-192.png",
  "./app/icons/maskable-512.png",
  "./app/icons/maskable.svg",
  "./app/index.html",
  "./app/js/00-core.js",
  "./app/js/04-conta.js",
  "./app/js/10-fs.js",
  "./app/js/20-zip.js",
  "./app/js/30-highlight.js",
  "./app/js/40-editor.js",
  "./app/js/50-tree.js",
  "./app/js/60-preview.js",
  "./app/js/61-tsx.js",
  "./app/js/70-search.js",
  "./app/js/80-ai.js",
  "./app/js/81-gasto.js",
  "./app/js/83-voz.js",
  "./app/js/84-ponte.js",
  "./app/js/85-checkpoints.js",
  "./app/js/86-terminal.js",
  "./app/js/86b-node.js",
  "./app/js/86c-termux.js",
  "./app/js/86e-atalhos.js",
  "./app/js/86f-pasta-viva.js",
  "./app/js/86g-largura.js",
  "./app/js/87-links.js",
  "./app/js/88-inventario.js",
  "./app/js/89-config.js",
  "./app/js/90-github.js",
  "./app/js/91-acoes.js",
  "./app/js/92-playground.js",
  "./app/js/92c-importar.js",
  "./app/js/93-conversa.js",
  "./app/js/94-fatiador.js",
  "./app/js/95-pwa.js",
  "./app/js/96-apk.js",
  "./app/js/96b-eas.js",
  "./app/js/96c-preparar.js",
  "./app/js/97-analise.js",
  "./app/js/98-api.js",
  "./app/js/99-app.js",
  "./app/js/lib/expo-core.js",
  "./app/js/lib/jszip.min.js",
  "./app/js/lib/nacl-fast.min.js",
  "./app/js/lib/picotador/00-base.js",
  "./app/js/lib/picotador/10-ler.js",
  "./app/js/lib/picotador/20-projetos.js",
  "./app/js/lib/picotador/30-mensagens.js",
  "./app/js/lib/plano-core.js",
  "./app/js/lib/ponte-termux.cjs.txt",
  "./app/js/lib/receita-core.js",
  "./app/js/lib/selar.js",
  "./app/LEIA-ME.md",
  "./app/manifest.json",
  "./app/service-worker.js",
  "./app/sw.js",
  "./electron/main.cjs",
  "./electron/ponte.cjs",
  "./electron/preload.cjs",
  "./electron/terminal.cjs",
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
  "./LEIA-ME.md",
  "./manifest.json",
  "./package.json",
  "./PLANO.md"
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
