// Prayer Dome Service Worker
// Bump CACHE_NAME whenever the precache list changes.
const CACHE_NAME = 'prayer-dome-v6';

// Shell assets worth having available offline.
const PRECACHE = [
    '/',
    '/index.html',
    '/bible.html',
    '/prayer.html',
    '/ai-prayer.html',
    '/ai-prayer-data.js',
    '/sermons.html',
    '/sermons-data.js',
    '/translate.html',
    '/translation-data.js',
    '/assets/pd-brand.css',
    '/assets/pd-motion.js',
    '/live.html',
    '/gallery.html',
    '/give.html',
    '/video.html',
    '/quiz.html',
    '/membership.html',
    '/support.html',
    '/team.html',
    '/account.html',
    '/manifest.json',
    'https://i.ibb.co/TB5Fx4tb/logo-0.png',
    '/news.html',
    '/radio.html',
    '/assets/pd-app.js',
    '/assets/pd-content-data.js',
    '/assets/hero-worship.jpg'
];

// ---------------------------------------------------------------------------
// Install — precache the shell. Individual failures must not abort the install,
// so each request is added on a best-effort basis.
// ---------------------------------------------------------------------------
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            Promise.all(
                PRECACHE.map(url =>
                    cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
                )
            )
        )
    );
});

// ---------------------------------------------------------------------------
// Activate — drop caches from previous versions.
// ---------------------------------------------------------------------------
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// ---------------------------------------------------------------------------
// Fetch strategy
//   * Navigations / HTML  -> network first, fall back to cache (then offline shell).
//     This is what makes deploys visible immediately instead of serving a stale
//     page forever, which the previous cache-first worker did.
//   * Firebase & APIs     -> always network; never cached.
//   * Everything else     -> stale-while-revalidate.
// ---------------------------------------------------------------------------
const NEVER_CACHE = [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'firebaseinstallations.googleapis.com',
    'fcmregistrations.googleapis.com',
    'www.googleapis.com',
    'api.cloudinary.com',
    'res.cloudinary.com'
];

self.addEventListener('fetch', event => {
    const req = event.request;

    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    if (NEVER_CACHE.some(host => url.hostname.includes(host))) return;
    // Range requests (audio/video seeking) must go straight to the network.
    if (req.headers.has('range')) return;

    const isHTML = req.mode === 'navigate' ||
                   (req.headers.get('accept') || '').includes('text/html');

    if (isHTML) {
        event.respondWith(
            fetch(req)
                .then(res => {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
                    return res;
                })
                .catch(() =>
                    caches.match(req).then(hit => hit || caches.match('/index.html'))
                )
        );
        return;
    }

    event.respondWith(
        caches.match(req).then(hit => {
            const network = fetch(req)
                .then(res => {
                    if (res && res.status === 200 && res.type !== 'opaque') {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
                    }
                    return res;
                })
                .catch(() => hit);
            return hit || network;
        })
    );
});

// ---------------------------------------------------------------------------
// Notification click — route to the page the notification came from.
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', event => {
    event.notification.close();

    const data = event.notification.data || {};
    const target = data.url || data.screen || '/index.html';
    const path = target.startsWith('/') ? target : '/' + target + '.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const client of list) {
                if (client.url.includes(path) && 'focus' in client) return client.focus();
            }
            // Nothing matching open — reuse any window if we can, else open one.
            if (list.length && 'navigate' in list[0]) {
                return list[0].navigate(path).then(c => c && c.focus());
            }
            return clients.openWindow(path);
        })
    );
});

// Allow a page to trigger an immediate update.
self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
