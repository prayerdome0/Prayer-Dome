// Prayer Dome Service Worker - Lock Screen Utility
const CACHE_NAME = 'prayer-dome-v2';
const assets = [
    '/',
    '/index.html',
    '/bible.html',
    '/gallery.html',
    '/give.html',
    '/video.html',
    '/quiz.html',
    '/membership.html',
    '/support.html',
    '/team.html',
    '/prayer.html',
    '/account.html',
    'https://i.ibb.co/TB5Fx4tb/logo-0.png'
];

// Install Event
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(assets);
        })
    );
});

// Activate Event
self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

// Fetch Event (Offline Support)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});

// UPGRADE: Handle Notification Click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    // Open the Bible page when the notification is tapped
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url.includes('bible.html') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/bible.html');
            }
        })
    );
});