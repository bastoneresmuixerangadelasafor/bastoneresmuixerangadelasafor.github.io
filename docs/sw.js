// Service Worker with cache versioning to prevent stale content
const CACHE_VERSION = 'v' + Date.now(); // Version changes on each deployment
const CACHE_NAME = 'bastoneres-cache-' + CACHE_VERSION;

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const swParams = new URL(self.location.href).searchParams;
const firebaseConfigParam = swParams.get('firebase');
if (firebaseConfigParam) {
  try {
    firebase.initializeApp(JSON.parse(decodeURIComponent(firebaseConfigParam)));
    const messaging = firebase.messaging();
    const NOTIFICATION_ICON = new URL('images/android/android-launchericon-192-192.png', self.registration.scope).href;
    const NOTIFICATION_BADGE = new URL('images/android/notification-badge-96.png', self.registration.scope).href;
    messaging.onBackgroundMessage((payload) => {
      const title = payload.data?.title || 'Bastoneres';
      const body = payload.data?.body || '';
      self.registration.showNotification(title, {
        body,
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_BADGE,
        tag: 'bastoneres-notification',
        renotify: true,
        data: { url: payload.fcmOptions?.link || self.registration.scope },
      });
    });
  } catch (e) {
    console.error('SW: Firebase init error', e);
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// Files that should always be fetched fresh (never cached)
const ALWAYS_FRESH = [
  '/index.html',
  '/manifest.webmanifest',
  '/scripts/app.js',
  '/scripts/navigation.js',
  '/scripts/utils.js',
  '/scripts/auth.js',
  '/scripts/home.js',
  '/scripts/members.js',
  '/scripts/cache.js',
  '/scripts/api_client.js',
  '/scripts/trainings.js',
  '/scripts/dashboard.js',
  '/scripts/dances.js',
  '/scripts/notifications.js',
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
