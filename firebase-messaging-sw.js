// firebase-messaging-sw.js
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

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Background message received:', payload);
    
    const notificationTitle = payload.notification?.title || 'Prayer Dome';
    const notificationOptions = {
        body: payload.notification?.body || 'New Bible verse available',
        icon: 'https://i.ibb.co/TB5Fx4tb/logo-0.png',
        badge: 'https://i.ibb.co/TB5Fx4tb/logo-0.png',
        tag: 'prayer-dome-verse',
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
            url: payload.data?.url || '/bible',
            timestamp: Date.now()
        },
        actions: [
            { action: 'read', title: '📖 Read Verse' },
            { action: 'pray', title: '🙏 Pray Now' }
        ]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const action = event.action;
    const urlToOpen = event.notification.data?.url || '/';
    
    if (action === 'read') {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then((windowClients) => {
                    for (let client of windowClients) {
                        if (client.url.includes('/bible') && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    if (clients.openWindow) {
                        return clients.openWindow('/bible');
                    }
                })
        );
    } else if (action === 'pray') {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then((windowClients) => {
                    for (let client of windowClients) {
                        if (client.url.includes('/prayer') && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    if (clients.openWindow) {
                        return clients.openWindow('/prayer');
                    }
                })
        );
    } else {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then((windowClients) => {
                    for (let client of windowClients) {
                        if ('focus' in client) {
                            return client.focus();
                        }
                    }
                    if (clients.openWindow) {
                        return clients.openWindow(urlToOpen);
                    }
                })
        );
    }
});