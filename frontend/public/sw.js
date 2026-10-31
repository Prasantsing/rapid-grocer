const CACHE_NAME = 'zapbasket-cache-v3';
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip caching for backend write requests
  if (event.request.method !== 'GET') {
    return;
  }

  // API Requests: Network-first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Navigation requests (HTML pages): ALWAYS Network-first so the browser gets the latest script hashes
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // JavaScript chunks and module scripts: Network-first to ensure newest code, validate MIME type
  const isScript = url.pathname.endsWith('.js') || url.pathname.endsWith('.mjs') || url.pathname.includes('chunk-');
  if (isScript) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cType = networkResponse.headers.get('content-type') || '';
            // Only cache valid javascript files; never cache HTML fallback as JS!
            if (cType.includes('javascript')) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) {
            const cType = cached.headers.get('content-type') || '';
            if (cType.includes('javascript')) {
              return cached;
            }
            // Corrupt cached entry (e.g. HTML served for JS), remove it
            const cache = await caches.open(CACHE_NAME);
            await cache.delete(event.request);
          }
          return new Response('/* Chunk offline or not found */', {
            status: 404,
            statusText: 'Not Found',
            headers: { 'Content-Type': 'application/javascript; charset=UTF-8' },
          });
        })
    );
    return;
  }

  // Other static assets (CSS, Fonts, Images): Cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});

// --- FIREBASE CLOUD MESSAGING & WEB PUSH EVENT LISTENERS ---
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: '⚡ ZapBasket Alert', body: event.data.text() };
    }
  }

  const title = data.title || '⚡ ZapBasket 12-Min Groceries';
  const options = {
    body: data.body || 'Your grocery order status has been updated.',
    icon: '/icon-192.png',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || (data.orderId ? `/orders/${data.orderId}` : '/'),
      orderId: data.orderId,
    },
    actions: [
      { action: 'open_order', title: 'View Update' },
      { action: 'dismiss', title: 'Close' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

