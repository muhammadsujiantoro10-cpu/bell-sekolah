/* ============================================================
   SERVICE WORKER — Smart School Bell System PRO v6.0
   SMPN 2 Umbulsari
   • Cache-first untuk semua aset statis
   • Fallback ke index.html saat offline
   • Auto-update cache saat versi berubah
   ============================================================ */

const CACHE_NAME = 'smartbell-v6.0';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './favicon.png'
];

// INSTALL: cache semua aset penting
self.addEventListener('install', e => {
  console.log('[SW v6] Installing...');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE: hapus cache versi lama
self.addEventListener('activate', e => {
  console.log('[SW v6] Activating...');
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW v6] Deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH: cache-first, network fallback
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Abaikan request ke IndexedDB / blob (audio)
  if (e.request.url.startsWith('blob:')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request)
        .then(res => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});

// MESSAGE: skip waiting saat ada update
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
