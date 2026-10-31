// Firebase Cloud Messaging Web Push Service Worker
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: '⚡ ZapBasket Alert', body: event.data.text() };
    }
  }

  const title = data.title || (data.notification ? data.notification.title : '⚡ ZapBasket 12-Min Groceries');
  const body = data.body || (data.notification ? data.notification.body : 'Your grocery order status has been updated.');

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || data.link || (data.orderId ? `/orders/${data.orderId}` : '/'),
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
