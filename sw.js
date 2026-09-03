// Prayer Dome Service Worker
// Also delivers the Daily Bible Verse to the device (lock screen / notification
// shade) even when the app is closed — see /assets/pd-verse-data.js.
try { importScripts('/assets/pd-verse-data.js'); } catch (e) { /* verses unavailable offline */ }
// Bump CACHE_NAME whenever the precache list changes.
const CACHE_NAME = 'prayer-dome-v17';

// Shell assets worth having available offline.
const PRECACHE = [
    '/',
    '/index.html',
    // The dedicated offline shell shown when a navigation cannot be served at
    // all — far friendlier than falling back to a half-empty home page.
    '/offline.html',
    '/devotional-data.js',
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
    '/assets/logo.png',
    '/assets/logo-192.png',
    '/news.html',
    '/radio.html',
    '/lessons.html',
    '/stories.html',
    '/resources.html',
    '/resource-view.html',
    '/documents/statement-of-faith.pdf',
    '/documents/new-believers-guide.pdf',
    '/documents/prayer-watch-guide.pdf',
    '/documents/serving-teams-handbook.pdf',
    '/documents/small-group-guide.pdf',
    '/Prayer-Dome-User-Guide.pdf',
    '/assets/pd-academy-data.js',
    '/assets/pd-academy.js',
    '/assets/pd-certificate.js',
    '/assets/pd-app.js',
    '/assets/pd-phrases.js',
    '/assets/pd-i18n.js',
    '/assets/pd-cloud-video.js',
    '/assets/pd-verse-data.js',
    '/assets/pd-verse-alerts.js',
    '/assets/pd-content-data.js',
    '/assets/hero-worship.jpg',
    '/assets/testimonies/hero-praise.jpg',
    '/assets/avatar-default.svg',
    '/assets/og-image.png'
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
                    caches.match(req)
                        .then(hit => hit || caches.match('/offline.html'))
                        .then(hit => hit || caches.match('/index.html'))
                        .then(hit => hit || new Response(
                            '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
                            '<p style="font:16px system-ui;padding:24px">Prayer Dome is offline.</p>',
                            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
                        ))
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
// Daily Bible Verse — background delivery
// The worker keeps its own copy of the member's verse settings (the Cache API
// is the only storage a service worker can use synchronously across wake-ups).
// ---------------------------------------------------------------------------
const SETTINGS_CACHE = 'pd-settings';
const SETTINGS_URL = '/__pd/verse-settings.json';

async function readVerseSettings() {
    try {
        const cache = await caches.open(SETTINGS_CACHE);
        const hit = await cache.match(SETTINGS_URL);
        if (!hit) return null;
        return await hit.json();
    } catch (e) { return null; }
}

async function writeVerseSettings(settings) {
    try {
        const cache = await caches.open(SETTINGS_CACHE);
        await cache.put(SETTINGS_URL, new Response(JSON.stringify(settings), {
            headers: { 'Content-Type': 'application/json' }
        }));
    } catch (e) { /* storage unavailable */ }
}

function todayStamp() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function minutesOf(hhmm) {
    const parts = String(hhmm || '00:00').split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

async function specialVerseForToday() {
    try {
        const res = await fetch(
            'https://firestore.googleapis.com/v1/projects/prayer-dome/databases/(default)/documents/verseSchedule/' +
            todayStamp(), { headers: { accept: 'application/json' } });
        if (!res.ok) return null;
        const doc = await res.json();
        const f = doc.fields || {};
        const text = f.text && f.text.stringValue;
        const reference = f.reference && f.reference.stringValue;
        if (!text || !reference) return null;
        return {
            text, reference,
            title: (f.title && f.title.stringValue) || null,
            slots: (f.slots && f.slots.stringValue) || 'all',
            translation: (f.translation && f.translation.stringValue) || 'KJV'
        };
    } catch (e) { return null; }
}

async function showVerseNotification(verse) {
    const title = (verse.icon ? verse.icon + ' ' : '') +
        (verse.slotLabel || 'Daily Verse') + ' \u00b7 Prayer Dome';
    return self.registration.showNotification(title, {
        body: '\u201C' + verse.text + '\u201D\n\u2014 ' + verse.reference +
              ' (' + (verse.translation || 'KJV') + ')',
        icon: '/assets/logo-192.png',
        badge: '/assets/logo-192.png',
        tag: 'pd-verse-' + verse.slot + '-' + todayStamp(),
        renotify: false,
        data: {
            url: '/bible.html?verse=' + encodeURIComponent(verse.reference),
            kind: 'verse',
            slot: verse.slot
        },
        actions: [
            { action: 'read', title: 'Read in Bible' },
            { action: 'pray', title: 'Pray now' }
        ]
    });
}

/** Deliver any verse that is due today and has not been sent yet. */
async function deliverDueVerses(force) {
    if (!self.PD_VERSES) return;
    const settings = await readVerseSettings();
    if (!settings || !settings.enabled) return;

    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const stamp = todayStamp();
    const special = await specialVerseForToday();
    let changed = false;
    settings.lastSent = settings.lastSent || {};

    for (const slot of self.PD_VERSES.SLOTS) {
        const conf = (settings.slots || {})[slot.id];
        if (!conf || conf.on === false) continue;
        if (settings.lastSent[slot.id] === stamp && !force) continue;
        const due = minutesOf(conf.time);
        if (!force && (minutes < due || minutes - due > 180)) continue;

        let verse = self.PD_VERSES.verseFor(slot.id);
        if (special && (special.slots === 'all' || String(special.slots).includes(slot.id))) {
            verse = Object.assign({}, verse, {
                text: special.text,
                reference: special.reference,
                translation: special.translation,
                slotLabel: special.title || verse.slotLabel
            });
        }
        await showVerseNotification(verse);
        settings.lastSent[slot.id] = stamp;
        changed = true;
    }
    if (changed) await writeVerseSettings(settings);
}

// Periodic background sync (installed PWA on Android/Chrome).
self.addEventListener('periodicsync', event => {
    if (event.tag === 'pd-verse-alerts') event.waitUntil(deliverDueVerses(false));
});

// One-off background sync fallback.
self.addEventListener('sync', event => {
    if (event.tag === 'pd-verse-alerts') event.waitUntil(deliverDueVerses(false));
});

// ---------------------------------------------------------------------------
// Push — server-sent verses, live alerts and ministry notices.
// ---------------------------------------------------------------------------
self.addEventListener('push', event => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; } catch (e) {
        payload = { notification: { title: 'Prayer Dome', body: event.data ? event.data.text() : '' } };
    }
    const note = payload.notification || payload;
    const data = payload.data || {};
    const title = note.title || 'Prayer Dome';
    const options = {
        body: note.body || note.message || '',
        icon: note.icon || '/assets/logo-192.png',
        badge: '/assets/logo-192.png',
        image: note.image || undefined,
        // A stable tag per message id keeps a notification from arriving twice.
        tag: data.tag || note.tag || ('pd-' + (data.id || Date.now())),
        renotify: false,
        data: {
            url: data.url || data.link || (data.screen ? '/' + data.screen + '.html' : '/index.html'),
            id: data.id || null,
            kind: data.kind || 'general'
        }
    };
    if (data.kind === 'verse') {
        options.actions = [
            { action: 'read', title: 'Read in Bible' },
            { action: 'pray', title: 'Pray now' }
        ];
    }
    event.waitUntil(self.registration.showNotification(title, options));
});

// ---------------------------------------------------------------------------
// Notification click — route to the page the notification came from.
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', event => {
    event.notification.close();

    const data = event.notification.data || {};
    let target = data.url || data.screen || '/index.html';
    if (event.action === 'read') target = data.reference
        ? '/bible.html?verse=' + encodeURIComponent(data.reference)
        : '/bible.html';
    if (event.action === 'pray') target = '/prayer.html';

    const path = target.startsWith('/') ? target : '/' + target + '.html';
    const base = path.split('?')[0];

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const client of list) {
                if (client.url.includes(base) && 'focus' in client) return client.focus();
            }
            // Nothing matching open — reuse any window if we can, else open one.
            if (list.length && 'navigate' in list[0]) {
                return list[0].navigate(path).then(c => c && c.focus());
            }
            return clients.openWindow(path);
        })
    );
});

// Let the app tell the worker when a notification was read, so the same item is
// never surfaced again as if it were new.
self.addEventListener('notificationclose', event => {
    const data = event.notification.data || {};
    if (!data.id) return;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            list.forEach(c => c.postMessage({ type: 'pd-notification-dismissed', id: data.id }));
        })
    );
});

// Messages from the app: verse settings, immediate checks, worker updates.
self.addEventListener('message', event => {
    const msg = event.data;
    if (msg === 'SKIP_WAITING') { self.skipWaiting(); return; }
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'pd-verse-settings') {
        event.waitUntil(writeVerseSettings(msg.settings || {}));
    } else if (msg.type === 'pd-verse-check') {
        event.waitUntil(deliverDueVerses(!!msg.force));
    } else if (msg.type === 'pd-clear-notification' && msg.tag) {
        event.waitUntil(
            self.registration.getNotifications({ tag: msg.tag })
                .then(list => list.forEach(n => n.close()))
        );
    }
});

// Catch-up: whenever the worker wakes for a navigation, quietly check whether a
// verse was due while the device was asleep (throttled to once every 30 min).
let lastCatchUp = 0;
self.addEventListener('fetch', event => {
    if (event.request.mode !== 'navigate') return;
    const now = Date.now();
    if (now - lastCatchUp < 30 * 60 * 1000) return;
    lastCatchUp = now;
    event.waitUntil(deliverDueVerses(false).catch(() => {}));
});
