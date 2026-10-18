// Service Worker for Vyom Class 9 Planner PWA
const CACHE_NAME = 'vyom-planner-v16';

const STATIC_ASSETS = [
  './',
  './Vyom_Planner_offline_copy.html',
  './index.html',
  './manifest.json',
  './cloud-config.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/favicon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache assets individually so failure of one does not break the whole SW install
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (e) {
          // Ignore missing optional files during install
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // For navigation (opening the page), try network first, then cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('./Vyom_Planner_offline_copy.html')))
    );
    return;
  }

  // For other requests (images, PDFs, fonts), try cache first, fallback to network
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // Cache successful local GET responses (including books & weekly packs)
        if (res.status === 200 && (req.url.startsWith('http') || req.url.startsWith('file'))) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        }
        return res;
      }).catch(err => {
        // If offline and not in cache, let caller handle
        return cached;
      });
    })
  );
});
