// firebase-messaging-sw.js
// Background push delivery for Prayer Dome (Firebase Cloud Messaging).
// Notifications are branded with the official Prayer Dome logo, tagged per
// message so the same item never arrives twice, and are quiet rather than
// intrusive (no forced interaction, no repeated re-alerts).
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyCxvql0r_aeerphxTA0UUedRppdBxGf7wo",
    authDomain: "prayer-dome.firebaseapp.com",
    projectId: "prayer-dome",
    storageBucket: "prayer-dome.firebasestorage.app",
    messagingSenderId: "198295153196",
    appId: "1:198295153196:web:1222b31948d7974ba3bf89"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

const LOGO = '/assets/logo-192.png';

function targetFor(data, action) {
    if (action === 'read') {
        return data.reference
            ? '/bible.html?verse=' + encodeURIComponent(data.reference)
            : '/bible.html';
    }
    if (action === 'pray') return '/prayer.html';
    if (data.url) return data.url;
    if (data.link) return data.link;
    if (data.screen) return '/' + String(data.screen).replace(/^\//, '') + '.html';
    return '/index.html';
}

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    const note = payload.notification || {};
    const data = payload.data || {};
    const isVerse = data.kind === 'verse' || data.type === 'verse';

    const notificationTitle = note.title || data.title || 'Prayer Dome';
    const notificationOptions = {
        body: note.body || data.body || data.message || 'A new word from Prayer Dome',
        icon: LOGO,
        badge: LOGO,
        image: note.image || data.image || undefined,
        // A stable tag per message keeps the shade tidy and prevents the same
        // notification from being shown again as if it were new.
        tag: data.tag || ('pd-' + (data.id || data.kind || 'update') + '-' + (data.day || new Date().toDateString())),
        renotify: false,
        requireInteraction: false,
        silent: false,
        vibrate: [180, 90, 180],
        timestamp: Date.now(),
        data: {
            url: targetFor(data),
            id: data.id || null,
            kind: data.kind || data.type || 'general',
            reference: data.reference || null
        }
    };

    if (isVerse) {
        notificationOptions.actions = [
            { action: 'read', title: '📖 Read in Bible' },
            { action: 'pray', title: '🙏 Pray now' }
        ];
    }

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data || {};
    const urlToOpen = targetFor(data, event.action);
    const base = urlToOpen.split('?')[0];

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes(base) && 'focus' in client) return client.focus();
            }
            if (windowClients.length && 'navigate' in windowClients[0]) {
                return windowClients[0].navigate(urlToOpen).then((c) => c && c.focus());
            }
            if (clients.openWindow) return clients.openWindow(urlToOpen);
            return null;
        })
    );
});
