// Service Worker with cache versioning to prevent stale content
const CACHE_VERSION = 'v' + Date.now(); // Version changes on each deployment
const CACHE_NAME = 'bastoneres-cache-' + CACHE_VERSION;

// Files that should always be fetched fresh (never cached)
const ALWAYS_FRESH = [
  '/index.html',
  '/manifest.webmanifest',
  '/scripts/main.js',
  '/scripts/api.js',
  '/scripts/dances.js',
  '/styles/main.css',
  '/styles/navbar.css'
];

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Always fetch fresh for critical files
  if (ALWAYS_FRESH.some(path => url.pathname.endsWith(path))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Don't cache, just return the fresh response
          return response;
        })
        .catch(() => {
          // If offline, try to return from cache as fallback
          return caches.match(event.request);
        })
    );
  } else {
    // For other assets, use cache-first strategy
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request).then((response) => {
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            // Only cache GET and HEAD requests (Cache API limitation)
            if (event.request.method === 'GET' || event.request.method === 'HEAD') {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        });
      })
    );
  }
});
