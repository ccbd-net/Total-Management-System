// Progressive Web App Service Worker with Live Brand Asset & Icon Sync
const RAW_BRAND_TOKEN = '__BRAND_ASSET_VERSION__';
const BRAND_VERSION = RAW_BRAND_TOKEN.indexOf('__') === 0 ? '2026112701' : RAW_BRAND_TOKEN;
const CACHE_NAME = `vms-pwa-v5-${BRAND_VERSION}`;

const BRAND_ASSET_PATHS = new Set([
  '/manifest.json',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon.png',
  '/logo.png',
  '/logo.jpg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
]);

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  `/favicon.ico?v=${BRAND_VERSION}`,
  `/favicon.png?v=${BRAND_VERSION}`,
  `/logo.png?v=${BRAND_VERSION}`,
  `/pwa-192x192.png?v=${BRAND_VERSION}`,
  `/pwa-512x512.png?v=${BRAND_VERSION}`,
  `/pwa-maskable-512x512.png?v=${BRAND_VERSION}`,
  `/apple-touch-icon.png?v=${BRAND_VERSION}`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          ASSETS_TO_CACHE.map((url) =>
            fetch(url, { credentials: 'include', cache: 'reload' }).then((res) => {
              if (res.ok && !res.redirected) {
                return cache.put(url, res);
              }
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: 'VMS_SW_ACTIVATED', version: BRAND_VERSION });
          }
        })
      )
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Network-First with cache-revalidated brand icons & offline fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, cross-origin, and API calls (never cache /api)
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api')
  ) {
    return;
  }

  const isBrandAsset = BRAND_ASSET_PATHS.has(url.pathname);

  event.respondWith(
    fetch(isBrandAsset ? new Request(event.request, { cache: 'no-store' }) : event.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic' &&
          !networkResponse.redirected
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return Response.error();
        });
      })
  );
});
