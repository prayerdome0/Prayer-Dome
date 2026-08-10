/*!
 * Prayer Dome — Daily Bible Verse on the phone
 * ---------------------------------------------------------------------------
 * Puts God's Word on the member's device four times a day — morning, midday,
 * afternoon and evening — even when the app is closed. Delivery uses every
 * layer the device supports, in this order:
 *
 *   1. Push notifications (Firebase Cloud Messaging) — works with the app shut.
 *   2. Service-worker periodic background sync — Android/Chrome installed PWA.
 *   3. Service-worker catch-up — the next time the worker wakes it sends any
 *      verse that was due and has not been delivered today.
 *   4. In-app timers while a Prayer Dome tab is open.
 *   5. Android home-screen / lock-screen widget (see android/ VerseWidget).
 *
 * Every notification carries the reference (e.g. John 3:16), the Prayer Dome
 * logo and a branded verse card image, and is tagged per slot so a member never
 * receives the same verse twice.
 *
 * Administrators can schedule special verses (holidays, fasting seasons, church
 * programmes) in Firestore `verseSchedule/{YYYY-MM-DD}`; those override the
 * daily rotation for every member.
 */
(function (global) {
    'use strict';

    var STORE_KEY = 'pd_verse_alerts';
    var LOGO = '/assets/logo-192.png';
    var BADGE = '/assets/logo-192.png';

    function defaults() {
        var slots = {};
        (global.PD_VERSES ? PD_VERSES.SLOTS : []).forEach(function (s) {
            slots[s.id] = { on: true, time: s.defaultTime };
        });
        return {
            enabled: false,
            slots: slots,
            sound: true,
            lastSent: {},          // { morning: '2026-08-10', ... }
            special: null          // admin-scheduled override for today
        };
    }

    function read() {
        try {
            var raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
            if (!raw) return defaults();
            var base = defaults();
            base.enabled = !!raw.enabled;
            base.sound = raw.sound !== false;
            base.lastSent = raw.lastSent || {};
            Object.keys(base.slots).forEach(function (id) {
                if (raw.slots && raw.slots[id]) {
                    base.slots[id].on = raw.slots[id].on !== false;
                    base.slots[id].time = raw.slots[id].time || base.slots[id].time;
                }
            });
            return base;
        } catch (e) { return defaults(); }
    }

    function write(settings) {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* private mode */ }
        syncToWorker(settings);
        return settings;
    }

    function today() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function minutesOf(hhmm) {
        var parts = String(hhmm || '00:00').split(':');
        return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    }

    /* ------------------------------------------------ service worker bridge */
    function syncToWorker(settings) {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.ready.then(function (reg) {
            if (reg.active) {
                reg.active.postMessage({ type: 'pd-verse-settings', settings: settings });
            }
            // Ask for periodic background sync so verses arrive with the app closed.
            if (settings.enabled && reg.periodicSync) {
                reg.periodicSync.register('pd-verse-alerts', { minInterval: 60 * 60 * 1000 })
                    .catch(function () { /* needs an installed PWA + permission */ });
            } else if (reg.periodicSync && reg.periodicSync.unregister) {
                reg.periodicSync.unregister('pd-verse-alerts').catch(function () {});
            }
        }).catch(function () {});
    }

    /* --------------------------------------------------- branded verse card */
    /** Draw a share-ready Prayer Dome verse card (used as the notification image). */
    function buildVerseCard(verse) {
        return new Promise(function (resolve) {
            try {
                var canvas = document.createElement('canvas');
                canvas.width = 1024; canvas.height = 512;
                var ctx = canvas.getContext('2d');

                var gradient = ctx.createLinearGradient(0, 0, 1024, 512);
                gradient.addColorStop(0, '#0A4D9B');
                gradient.addColorStop(1, '#07244d');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 1024, 512);

                ctx.strokeStyle = 'rgba(212,175,55,0.85)';
                ctx.lineWidth = 5;
                ctx.strokeRect(26, 26, 972, 460);

                ctx.fillStyle = '#f6df8a';
                ctx.font = 'bold 26px Montserrat, Arial, sans-serif';
                ctx.fillText((verse.icon || '') + '  ' + (verse.slotLabel || 'Daily Verse').toUpperCase(), 70, 96);

                // Verse body — wrapped
                ctx.fillStyle = '#ffffff';
                ctx.font = '400 34px Georgia, "Times New Roman", serif';
                var words = String(verse.text || '').split(' ');
                var line = '', y = 175, maxWidth = 880, lines = [];
                for (var i = 0; i < words.length; i++) {
                    var test = line ? line + ' ' + words[i] : words[i];
                    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = words[i]; }
                    else line = test;
                    if (lines.length === 6) break;
                }
                if (line && lines.length < 7) lines.push(line);
                lines.forEach(function (l) { ctx.fillText(l, 70, y); y += 46; });

                ctx.fillStyle = '#f6df8a';
                ctx.font = 'bold 30px Montserrat, Arial, sans-serif';
                ctx.fillText(verse.reference + '  (' + (verse.translation || 'KJV') + ')', 70, Math.min(y + 22, 430));

                ctx.fillStyle = 'rgba(255,255,255,0.75)';
                ctx.font = '600 22px Montserrat, Arial, sans-serif';
                ctx.fillText('PRAYER DOME  ·  A House of Prayer for All Nations', 70, 468);

                var logo = new Image();
                logo.crossOrigin = 'anonymous';
                logo.onload = function () {
                    ctx.drawImage(logo, 872, 372, 104, 104);
                    canvas.toBlob(function (blob) {
                        resolve(blob ? URL.createObjectURL(blob) : null);
                    }, 'image/png');
                };
                logo.onerror = function () {
                    canvas.toBlob(function (blob) {
                        resolve(blob ? URL.createObjectURL(blob) : null);
                    }, 'image/png');
                };
                logo.src = '/assets/logo-192.png';
            } catch (e) { resolve(null); }
        });
    }

    /* ------------------------------------------------------------- delivery */
    async function showVerse(verse, options) {
        options = options || {};
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;

        var title = (verse.icon ? verse.icon + ' ' : '') + (verse.slotLabel || 'Daily Verse') + ' · Prayer Dome';
        var body = '\u201C' + verse.text + '\u201D\n— ' + verse.reference + ' (' + (verse.translation || 'KJV') + ')';
        var image = null;
        try { image = await buildVerseCard(verse); } catch (e) { image = null; }

        var payload = {
            body: body,
            icon: LOGO,
            badge: BADGE,
            image: image || undefined,
            tag: 'pd-verse-' + verse.slot + '-' + today(),
            renotify: false,
            requireInteraction: false,
            silent: options.silent === true,
            timestamp: Date.now(),
            data: {
                url: '/bible.html?verse=' + encodeURIComponent(verse.reference),
                reference: verse.reference,
                slot: verse.slot,
                kind: 'verse'
            },
            actions: [
                { action: 'read', title: 'Read in Bible' },
                { action: 'pray', title: 'Pray now' }
            ]
        };

        try {
            if ('serviceWorker' in navigator) {
                var reg = await navigator.serviceWorker.ready;
                await reg.showNotification(title, payload);
                return true;
            }
        } catch (e) { /* fall through to page notification */ }
        try { new Notification(title, payload); return true; } catch (e) { return false; }
    }

    /* ---------------------------------------------- admin special schedules */
    var specialCache = { date: null, verse: null };

    async function loadSpecialVerse() {
        var key = today();
        if (specialCache.date === key) return specialCache.verse;
        specialCache.date = key;
        specialCache.verse = null;
        try {
            var res = await fetch(
                'https://firestore.googleapis.com/v1/projects/prayer-dome/databases/(default)/documents/verseSchedule/' +
                encodeURIComponent(key), { headers: { accept: 'application/json' } });
            if (res.ok) {
                var doc = await res.json();
                var f = doc.fields || {};
                var text = f.text && f.text.stringValue;
                var ref = f.reference && f.reference.stringValue;
                if (text && ref) {
                    specialCache.verse = {
                        text: text,
                        reference: ref,
                        title: (f.title && f.title.stringValue) || null,
                        slots: (f.slots && f.slots.stringValue) || 'all',
                        translation: (f.translation && f.translation.stringValue) || 'KJV'
                    };
                }
            }
        } catch (e) { /* offline — fall back to the rotation */ }
        return specialCache.verse;
    }

    async function verseForSlot(slotId) {
        var base = global.PD_VERSES ? PD_VERSES.verseFor(slotId) : null;
        if (!base) return null;
        var special = await loadSpecialVerse();
        if (special && (special.slots === 'all' || String(special.slots).indexOf(slotId) > -1)) {
            return Object.assign({}, base, {
                text: special.text,
                reference: special.reference,
                translation: special.translation,
                slotLabel: special.title || base.slotLabel,
                special: true
            });
        }
        return base;
    }

    /* --------------------------------------------------------- in-app timer */
    var timer = null;

    async function checkDue(force) {
        var settings = read();
        if (!settings.enabled) return;
        var now = new Date();
        var minutes = now.getHours() * 60 + now.getMinutes();
        var stamp = today();
        var slots = global.PD_VERSES ? PD_VERSES.SLOTS : [];

        for (var i = 0; i < slots.length; i++) {
            var id = slots[i].id;
            var conf = settings.slots[id];
            if (!conf || conf.on === false) continue;
            if (settings.lastSent[id] === stamp && !force) continue;
            var due = minutesOf(conf.time);
            // Deliver at the scheduled minute, or catch up within 3 hours if the
            // device was asleep / the app was closed.
            if (force || (minutes >= due && minutes - due <= 180)) {
                /* eslint-disable no-await-in-loop */
                var verse = await verseForSlot(id);
                if (verse) {
                    var ok = await showVerse(verse);
                    if (ok || force) {
                        settings.lastSent[id] = stamp;
                        write(settings);
                        if (global.PDApp && PDApp.notifications) {
                            PDApp.notifications.push({
                                id: 'verse-' + id + '-' + stamp,
                                type: 'scripture',
                                title: verse.slotLabel + ' — ' + verse.reference,
                                message: verse.text,
                                link: '/bible.html'
                            }, { silent: true, localOnly: true });
                        }
                    }
                }
                /* eslint-enable no-await-in-loop */
            }
        }
    }

    function startTimer() {
        if (timer) clearInterval(timer);
        timer = setInterval(function () { checkDue(false); }, 60 * 1000);
        checkDue(false);
    }

    /* ------------------------------------------------------------ settings UI */
    var STYLE_ID = 'pdVerseAlertStyles';
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var css = document.createElement('style');
        css.id = STYLE_ID;
        css.textContent = [
            '.pd-verse-card{background:var(--bg-card,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:20px;padding:20px;box-shadow:0 10px 25px -5px rgba(0,0,0,.06);width:100%;max-width:100%;overflow:hidden}',
            '.pd-verse-card h3{display:flex;align-items:center;gap:10px;font-size:1.05rem;color:var(--accent-green,#0A4D9B);margin:0 0 6px}',
            '.pd-verse-card p.pd-verse-sub{font-size:.82rem;color:var(--text-secondary,#64748b);margin:0 0 16px;line-height:1.6}',
            '.pd-verse-master{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:linear-gradient(135deg,rgba(10,77,155,.07),rgba(212,175,55,.07));border-radius:14px;padding:12px 14px;margin-bottom:14px}',
            '.pd-verse-master strong{font-size:.9rem}',
            '.pd-verse-slots{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,215px),1fr));gap:10px}',
            '.pd-verse-slot{display:flex;align-items:center;gap:10px;border:1px solid var(--border-color,#e2e8f0);border-radius:14px;padding:10px 12px;min-width:0}',
            '.pd-verse-slot .pd-vs-icon{font-size:1.2rem}',
            '.pd-verse-slot .pd-vs-body{flex:1;min-width:0}',
            '.pd-verse-slot .pd-vs-name{display:block;font-weight:700;font-size:.84rem;color:var(--text-primary,#0f172a)}',
            '.pd-verse-slot input[type=time]{border:1px solid var(--border-color,#e2e8f0);border-radius:8px;padding:3px 6px;font-size:.75rem;background:transparent;color:inherit;max-width:110px}',
            '.pd-switch{position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0}',
            '.pd-switch input{opacity:0;width:0;height:0}',
            '.pd-switch span{position:absolute;cursor:pointer;inset:0;background:#cbd5e1;border-radius:999px;transition:.25s}',
            '.pd-switch span:before{content:"";position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.25s}',
            '.pd-switch input:checked + span{background:var(--accent-green,#0A4D9B)}',
            '.pd-switch input:checked + span:before{transform:translateX(20px)}',
            '.pd-verse-preview{margin-top:14px;border-left:3px solid var(--accent-gold,#d4af37);padding:8px 0 8px 12px;font-size:.84rem;color:var(--text-secondary,#64748b);font-style:italic}',
            '.pd-verse-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}',
            '.pd-verse-btn{border:1px solid var(--border-color,#e2e8f0);background:transparent;color:inherit;border-radius:999px;padding:8px 16px;font-size:.8rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:7px}',
            '.pd-verse-btn.primary{background:var(--accent-green,#0A4D9B);color:#fff;border-color:transparent}',
            '.pd-verse-note{font-size:.72rem;color:var(--text-secondary,#64748b);margin-top:12px;line-height:1.6}'
        ].join('\n');
        document.head.appendChild(css);
    }

    function renderSettings(target) {
        var host = typeof target === 'string' ? document.querySelector(target) : target;
        if (!host) return;
        injectStyles();
        var settings = read();
        var slots = global.PD_VERSES ? PD_VERSES.SLOTS : [];

        host.innerHTML =
            '<div class="pd-verse-card">' +
              '<h3><i class="fas fa-book-bible"></i> Daily Bible Verse on your phone</h3>' +
              '<p class="pd-verse-sub">Receive Scripture on your device through the day — morning, midday, afternoon and evening. Verses appear as notifications on your lock screen, with the reference and Prayer Dome branding.</p>' +
              '<div class="pd-verse-master">' +
                '<div><strong>Send me daily verses</strong><br><small style="font-size:.72rem;opacity:.75;">Works even when the app is closed</small></div>' +
                '<label class="pd-switch"><input type="checkbox" id="pdVerseMaster"' + (settings.enabled ? ' checked' : '') + '><span></span></label>' +
              '</div>' +
              '<div class="pd-verse-slots">' +
                slots.map(function (s) {
                    var conf = settings.slots[s.id] || { on: true, time: s.defaultTime };
                    return '<div class="pd-verse-slot">' +
                        '<span class="pd-vs-icon">' + s.icon + '</span>' +
                        '<div class="pd-vs-body">' +
                          '<span class="pd-vs-name">' + s.label + '</span>' +
                          '<input type="time" value="' + conf.time + '" data-verse-time="' + s.id + '">' +
                        '</div>' +
                        '<label class="pd-switch"><input type="checkbox" data-verse-slot="' + s.id + '"' + (conf.on ? ' checked' : '') + '><span></span></label>' +
                      '</div>';
                }).join('') +
              '</div>' +
              '<div class="pd-verse-preview" id="pdVersePreview">Loading today\u2019s verse…</div>' +
              '<div class="pd-verse-actions">' +
                '<button class="pd-verse-btn primary" id="pdVerseTest"><i class="fas fa-bell"></i> Send a test verse now</button>' +
                '<a class="pd-verse-btn" href="/bible.html"><i class="fas fa-book-open"></i> Open the Bible</a>' +
              '</div>' +
              '<p class="pd-verse-note"><i class="fas fa-circle-info"></i> On Android you can also add the <strong>Prayer Dome Verse widget</strong> to your home or lock screen. On iPhone, install Prayer Dome to the Home Screen and allow notifications to receive verses on the lock screen.</p>' +
            '</div>';

        var preview = host.querySelector('#pdVersePreview');
        verseForSlot(global.PD_VERSES ? PD_VERSES.currentSlot() : 'morning').then(function (v) {
            if (preview && v) preview.innerHTML = '\u201C' + v.text + '\u201D<br><strong style="font-style:normal;">— ' + v.reference + ' (' + v.translation + ')</strong>';
        });

        host.querySelector('#pdVerseMaster').addEventListener('change', async function (e) {
            var s = read();
            if (e.target.checked) {
                var perm = (typeof Notification !== 'undefined') ? Notification.permission : 'denied';
                if (perm === 'default' && global.PDApp && PDApp.notifications) {
                    perm = await PDApp.notifications.requestPermission();
                } else if (perm === 'default' && typeof Notification !== 'undefined') {
                    perm = await Notification.requestPermission();
                }
                if (perm !== 'granted') {
                    e.target.checked = false;
                    if (global.PDApp) PDApp.toast('Allow notifications to receive daily verses', 'error');
                    return;
                }
            }
            s.enabled = e.target.checked;
            write(s);
            if (s.enabled) { startTimer(); if (global.PDApp) PDApp.toast('Daily verses switched on 🙏', 'success'); }
            else if (global.PDApp) PDApp.toast('Daily verses switched off');
        });

        host.querySelectorAll('[data-verse-slot]').forEach(function (el) {
            el.addEventListener('change', function () {
                var s = read();
                s.slots[el.getAttribute('data-verse-slot')].on = el.checked;
                write(s);
            });
        });
        host.querySelectorAll('[data-verse-time]').forEach(function (el) {
            el.addEventListener('change', function () {
                var s = read();
                s.slots[el.getAttribute('data-verse-time')].time = el.value;
                write(s);
                if (global.PDApp) PDApp.toast('Verse time updated');
            });
        });
        host.querySelector('#pdVerseTest').addEventListener('click', async function () {
            var perm = (typeof Notification !== 'undefined') ? Notification.permission : 'denied';
            if (perm === 'default') {
                perm = global.PDApp && PDApp.notifications
                    ? await PDApp.notifications.requestPermission()
                    : await Notification.requestPermission();
            }
            if (perm !== 'granted') {
                if (global.PDApp) PDApp.toast('Allow notifications first', 'error');
                return;
            }
            var v = await verseForSlot(global.PD_VERSES ? PD_VERSES.currentSlot() : 'morning');
            if (v) await showVerse(v, { silent: false });
            if (global.PDApp) PDApp.toast('Verse sent to your device 📖', 'success');
        });
    }

    /* ------------------------------------------------------------------ init */
    function init() {
        var settings = read();
        syncToWorker(settings);
        if (settings.enabled) startTimer();
        document.querySelectorAll('[data-pd-verse-settings]').forEach(function (el) { renderSettings(el); });
    }

    global.PDVerseAlerts = {
        settings: read,
        save: write,
        renderSettings: renderSettings,
        showVerse: showVerse,
        verseForSlot: verseForSlot,
        buildVerseCard: buildVerseCard,
        check: checkDue,
        enable: async function () {
            var s = read();
            var perm = (typeof Notification !== 'undefined') ? Notification.permission : 'denied';
            if (perm === 'default') perm = await Notification.requestPermission();
            if (perm !== 'granted') return false;
            s.enabled = true; write(s); startTimer();
            return true;
        },
        disable: function () { var s = read(); s.enabled = false; write(s); if (timer) clearInterval(timer); },
        init: init
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(window);
