/*
 * Daily verse delivery checks (the notification half of the verse feature).
 *
 * The widget tests cover Scripture rendering outside the app. This file covers
 * what members see on the lock screen *from* the app: the four daily verse
 * notifications. Nothing here had coverage before, so the checks follow the
 * real module (assets/pd-verse-alerts.js) in jsdom with the browser APIs it
 * uses stubbed — Notification, a service-worker registration, the branded card
 * canvas, and a Firestore override:
 *
 *   • the settings a member saves are the settings the timer reads;
 *   • a due verse is delivered once per slot per day, with the reference, the
 *     Prayer Dome logo and the branded card image, and lands in the in-app
 *     notification centre too;
 *   • the catch-up window (3 hours) is respected and skipped slots stay silent;
 *   • an administrator's special verse overrides the rotation for the slots it
 *     names, and only those;
 *   • the settings card renders, refuses to switch on without permission, and
 *     points members at the lock-screen studio.
 *
 * Run: node tests/verse-alerts.test.js
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let JSDOM;
let VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
catch (error) {
  console.error('jsdom is not installed. Run:  npm install --no-save jsdom');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

let passed = 0;
function t(name, ok, extra = '') {
  if (ok) { passed += 1; console.log('PASS  ' + name); }
  else { console.error('FAIL  ' + name + (extra ? '  ' + extra : '')); process.exitCode = 1; }
}

const library = require(path.join(ROOT, 'assets/pd-verse-data.js'));
const alertsSource = read('assets/pd-verse-alerts.js');

/* --------------------------------------------------------------- browser --- */
function boot() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><head></head><body><div id="verseHost"></div></body></html>',
    { runScripts: 'outside-only', url: 'https://prayerdome.net/account', virtualConsole: new VirtualConsole() }
  );
  const w = dom.window;
  const log = { notifications: [], pageNotifications: [], toasts: [], drawn: [], cardBlob: null };

  /* Notification API, granted unless a test flips it. */
  w.__permission = 'granted';
  function StubNotification(title, options) {
    if (w.__permission !== 'granted') throw new Error('permission denied');
    log.notifications.push({ via: 'page', title, options });
  }
  Object.defineProperty(StubNotification, 'permission', { get: () => w.__permission });
  StubNotification.requestPermission = () => Promise.resolve(w.__permission);
  w.Notification = StubNotification;

  /* Service worker registration: showNotification is the primary path. */
  const registration = {
    active: { postMessage() {} },
    periodicSync: { register: () => Promise.resolve(), unregister: () => Promise.resolve() },
    showNotification: (title, options) => {
      if (w.__permission !== 'granted') throw new Error('permission denied');
      log.notifications.push({ via: 'worker', title, options });
      return Promise.resolve();
    }
  };
  w.navigator.serviceWorker = { ready: Promise.resolve(registration) };
  w.__registration = registration;

  /* The branded verse card canvas (buildVerseCard) plus a logo that loads. */
  w.HTMLCanvasElement.prototype.getContext = function (kind) {
    if (kind !== '2d') return null;
    const context = {
      font: '500 30px sans-serif', fillStyle: '', strokeStyle: '', lineWidth: 0,
      createLinearGradient: () => ({ addColorStop: () => {} }),
      fillRect: () => {}, strokeRect: () => {},
      fillText: (value) => log.drawn.push(String(value)),
      measureText: (value) => ({ width: value.length * 14 }),
      drawImage: () => log.drawn.push('[logo]')
    };
    return context;
  };
  w.HTMLCanvasElement.prototype.toBlob = function (callback) {
    log.cardBlob = new w.Blob(['verse-card'], { type: 'image/png' });
    callback(log.cardBlob);
  };
  w.URL.createObjectURL = () => 'blob:pd-verse-card';
  w.URL.revokeObjectURL = () => {};
  w.Image = class {
    set src(value) { this._src = value; setTimeout(() => this.onload && this.onload(), 0); }
    get src() { return this._src; }
  };

  /* In-app notification centre (PDApp) so the local push can be asserted. */
  w.PDApp = {
    toast: (message, type) => log.toasts.push([message, type]),
    notifications: {
      push: (entry, options) => log.pageNotifications.push({ entry, options }),
      requestPermission: () => Promise.resolve(w.__permission)
    }
  };

  w.eval(read('assets/pd-verse-data.js'));
  w.eval(alertsSource);
  return { dom, w, log, registration };
}

const today = () => {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
};
const hhmm = (minutes) => {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return String(Math.floor(wrapped / 60)).padStart(2, '0') + ':' + String(wrapped % 60).padStart(2, '0');
};
const nowMinutes = () => { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); };
const flush = () => new Promise((resolve) => setTimeout(resolve, 5));

(async () => {
  /* =================================================== settings =========== */
  const main = boot();
  const { w, log } = main;
  const alerts = w.PDVerseAlerts;

  t('the module publishes its API', ['settings', 'save', 'showVerse', 'verseForSlot', 'buildVerseCard',
    'check', 'enable', 'disable', 'init', 'renderSettings'].every((key) => typeof alerts[key] === 'function'));

  const defaults = alerts.settings();
  t('verses start switched off, with all four slots enabled at their default times',
    defaults.enabled === false &&
    Object.keys(defaults.slots).join(',') === library.SLOTS.map((slot) => slot.id).join(',') &&
    library.SLOTS.every((slot) => defaults.slots[slot.id].on === true && defaults.slots[slot.id].time === slot.defaultTime),
    JSON.stringify(defaults.slots));

  alerts.save(Object.assign({}, defaults, {
    enabled: true,
    sound: false,
    slots: Object.assign({}, defaults.slots, { evening: { on: false, time: '21:15' } })
  }));
  const saved = alerts.settings();
  t('saved preferences survive a round trip through storage',
    saved.enabled === true && saved.sound === false &&
    saved.slots.evening.time === '21:15' && saved.slots.evening.on === false &&
    saved.slots.morning.time === library.SLOTS[0].defaultTime);

  /* =================================================== delivery =========== */
  const verse = library.verseFor('morning');
  const sent = await alerts.showVerse(verse);
  t('a verse is delivered through the service worker registration', sent === true && log.notifications.length === 1);
  const note = log.notifications[0];
  t('the notification is tagged per slot and day, so a verse never repeats',
    note.options.tag === 'pd-verse-morning-' + today(), note.options.tag);
  t('the notification carries the Scripture, its reference and the translation',
    note.options.body.includes(verse.text) && note.options.body.includes(verse.reference) &&
    note.options.body.includes('KJV'));
  t('the notification is branded with the Prayer Dome logo and badge',
    note.options.icon === '/assets/logo-192.png' && note.options.badge === '/assets/logo-192.png');
  t('the notification opens the Bible at the verse, with read and pray actions',
    note.options.data.url === '/bible.html?verse=' + encodeURIComponent(verse.reference) &&
    note.options.data.kind === 'verse' &&
    note.options.actions.map((action) => action.action).join(',') === 'read,pray');
  t('the branded verse card is attached as the notification image',
    note.options.image === 'blob:pd-verse-card' && log.cardBlob && log.cardBlob.size > 0 &&
    log.drawn.includes('PRAYER DOME  ·  A House of Prayer for All Nations') &&
    log.drawn.some((line) => line.includes(verse.reference) && line.includes('KJV')));
  t('the card draws the verse text itself', log.drawn.some((line) => verse.text.startsWith(line.slice(0, 20))));

  await alerts.showVerse(verse, { silent: true });
  t('a silent verse stays silent', log.notifications[1].options.silent === true);

  // Permission withdrawn: nothing may leave the device.
  log.notifications.length = 0;
  w.__permission = 'default';
  t('without permission nothing is delivered', (await alerts.showVerse(verse)) === false &&
    log.notifications.length === 0);
  alerts.disable();
  t('enabling verses without permission is refused, and nothing is switched on',
    (await alerts.enable()) === false && alerts.settings().enabled === false);
  w.__permission = 'granted';
  t('with permission the master switch turns verses on', (await alerts.enable()) === true &&
    alerts.settings().enabled === true);
  alerts.disable();
  t('switching verses off persists', alerts.settings().enabled === false);

  t('the card generator degrades to null instead of throwing when a browser cannot draw',
    (await (async function () {
      const broken = boot();
      broken.w.HTMLCanvasElement.prototype.getContext = () => { throw new Error('no canvas'); };
      const result = await broken.w.PDVerseAlerts.buildVerseCard(library.verseFor('midnight' in library.VERSES ? 'evening' : 'evening'));
      broken.dom.window.close();
      return result === null;
    })()) === true);

  /* =================================================== scheduling ========= */
  const schedule = boot();
  const scheduleLog = schedule.log;
  schedule.w.PD_VERSES = library;
  const sAlerts = schedule.w.PDVerseAlerts;
  const base = sAlerts.settings();

  // Morning is due (five minutes ago); midday is four hours late; the others are
  // switched off, which is exactly the shape of a real member's settings.
  sAlerts.save({
    enabled: true,
    sound: true,
    lastSent: {},
    slots: {
      morning: { on: true, time: hhmm(nowMinutes() - 5) },
      midday: { on: true, time: hhmm(nowMinutes() - 240) },
      afternoon: { on: false, time: '15:30' },
      evening: { on: false, time: '20:00' }
    }
  });

  await sAlerts.check(false);
  t('a verse whose time has come is delivered once',
    scheduleLog.notifications.length === 1 &&
    scheduleLog.notifications[0].options.tag === 'pd-verse-morning-' + today(),
    JSON.stringify(scheduleLog.notifications.map((note) => note.options.tag)));
  t('delivery is recorded so the same verse is never sent twice in a day',
    sAlerts.settings().lastSent.morning === today());
  t('a slot that is more than three hours late is skipped, not delivered in a burst',
    !sAlerts.settings().lastSent.midday && scheduleLog.notifications.length === 1);
  t('slots switched off stay silent',
    !sAlerts.settings().lastSent.afternoon && !sAlerts.settings().lastSent.evening);

  await sAlerts.check(false);
  t('checking again on the same day sends nothing new', scheduleLog.notifications.length === 1);

  /* Overlapping checks — the timer's first tick during start-up, or a settings
     change while an earlier check is still awaiting the override fetch — used
     to deliver the same verse twice, because `lastSent` is only written after
     the delivery resolves. */
  const beforeRace = scheduleLog.notifications.length;
  await Promise.all([sAlerts.check(false), sAlerts.check(false), sAlerts.check(false), sAlerts.check(false)]);
  t('overlapping checks cannot deliver the same verse twice',
    scheduleLog.notifications.length === beforeRace,
    `${scheduleLog.notifications.length} notifications after 4 concurrent checks`);

  const slow = boot();
  const slowAlerts = slow.w.PDVerseAlerts;
  slow.w.fetch = () => new Promise((resolve) => setTimeout(() => resolve({ ok: false }), 25));
  slowAlerts.save({
    enabled: true, sound: true, lastSent: {},
    slots: {
      morning: { on: true, time: hhmm(nowMinutes() - 5) },
      midday: { on: false, time: '12:00' },
      afternoon: { on: false, time: '15:30' },
      evening: { on: false, time: '20:00' }
    }
  });
  await Promise.all([slowAlerts.check(false), slowAlerts.check(false)]);
  t('a check that is still fetching a special verse blocks a second one',
    slow.log.notifications.length === 1,
    `${slow.log.notifications.length} notifications`);
  slow.dom.window.close();

  await sAlerts.check(true);
  t('forcing a check delivers every switched-on slot and pushes them to the in-app centre',
    scheduleLog.notifications.length === 3 &&
    scheduleLog.pageNotifications.length === 3 &&
    scheduleLog.pageNotifications.every((push) => push.entry.type === 'scripture' && push.entry.message.length > 20) &&
    scheduleLog.pageNotifications.some((push) => push.entry.title.startsWith('Midday')),
    JSON.stringify(scheduleLog.pageNotifications.map((push) => push.entry.title)));

  const off = boot();
  off.w.PDVerseAlerts.save(Object.assign({}, off.w.PDVerseAlerts.settings(), { enabled: false }));
  await off.w.PDVerseAlerts.check(true);
  t('a disabled schedule delivers nothing even when forced', off.log.notifications.length === 0);

  /* ============================================ administrator override === */
  const special = boot();
  const specialAlerts = special.w.PDVerseAlerts;
  special.w.fetch = (url) => {
    if (String(url).includes('verseSchedule')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          fields: { text: { stringValue: 'Be still, and know that I am God.' },
            reference: { stringValue: 'Psalm 46:10' },
            title: { stringValue: 'Fasting week' },
            slots: { stringValue: 'morning,evening' } }
        })
      });
    }
    return Promise.reject(new Error('offline'));
  };

  const morningOverride = await specialAlerts.verseForSlot('morning');
  const middayRotation = await specialAlerts.verseForSlot('midday');
  t('an administrator\u2019s special verse overrides the rotation for the slots it names',
    morningOverride.reference === 'Psalm 46:10' && morningOverride.special === true &&
    morningOverride.slotLabel === 'Fasting week' && morningOverride.text.includes('Be still'));
  t('slots the special verse does not name keep the daily rotation',
    middayRotation.special === undefined && middayRotation.reference === library.verseFor('midday').reference);
  t('the override keeps the slot\u2019s own label and greeting for the notification title',
    morningOverride.slot === 'morning' && morningOverride.icon === library.SLOTS[0].icon);

  const offline = boot();
  offline.w.fetch = () => Promise.reject(new Error('offline'));
  const offlineVerse = await offline.w.PDVerseAlerts.verseForSlot('evening');
  t('without a connection the rotation still delivers', offlineVerse.reference === library.verseFor('evening').reference);

  /* =================================================== settings card ===== */
  const ui = boot();
  const host = ui.w.document.getElementById('verseHost');
  ui.w.PDVerseAlerts.renderSettings(host);
  const card = host.querySelector('.pd-verse-card');
  t('the settings card renders with the daily-verse switch and all four slots',
    !!card && !!host.querySelector('#pdVerseMaster') &&
    host.querySelectorAll('[data-verse-slot]').length === library.SLOTS.length &&
    host.querySelectorAll('[data-verse-time]').length === library.SLOTS.length);
  t('each slot shows its label, icon and scheduled time',
    library.SLOTS.every((slot) => card.textContent.includes(slot.label)) &&
    library.SLOTS.every((slot) => host.querySelector('[data-verse-time="' + slot.id + '"]').value === slot.defaultTime));
  t('the card explains that verses arrive on the lock screen',
    /lock screen/i.test(card.textContent));
  t('the card links members to the verse widget studio',
    !!card.querySelector('a[href="/widgets.html"]'));
  await flush();
  t('the preview shows today\u2019s verse for the current hour',
    host.querySelector('#pdVersePreview').textContent.includes(
      library.verseFor(library.currentSlot()).reference));
  t('the settings card brings its own styles once', host.querySelector('.pd-verse-card') &&
    ui.w.document.querySelectorAll('#pdVerseAlertStyles').length === 1);

  // Turning the master switch on asks for permission and tells the member.
  ui.w.__permission = 'default';
  const master = host.querySelector('#pdVerseMaster');
  master.checked = true;
  master.dispatchEvent(new ui.w.Event('change'));
  await flush();
  t('switching verses on requests permission and refuses politely when denied',
    master.checked === false && ui.log.toasts.some((toast) => /allow notifications/i.test(toast[0])),
    JSON.stringify(ui.log.toasts));

  ui.w.__permission = 'granted';
  master.checked = true;
  master.dispatchEvent(new ui.w.Event('change'));
  await flush();
  t('once permission is granted the switch stays on and is saved',
    master.checked === true && ui.w.PDVerseAlerts.settings().enabled === true &&
    ui.log.toasts.some((toast) => /switched on/i.test(toast[0])));

  const timeInput = host.querySelector('[data-verse-time="evening"]');
  timeInput.value = '21:45';
  timeInput.dispatchEvent(new ui.w.Event('change'));
  t('changing a slot time is saved for the timer',
    ui.w.PDVerseAlerts.settings().slots.evening.time === '21:45' &&
    ui.log.toasts.some((toast) => /time updated/i.test(toast[0])));

  host.querySelector('#pdVerseTest').dispatchEvent(new ui.w.Event('click'));
  await flush();
  t('the test button sends a verse to this device',
    ui.log.notifications.length === 1 && ui.log.toasts.some((toast) => /sent to your device/i.test(toast[0])),
    JSON.stringify(ui.log.toasts));

  /* The module must not leave timers running once verses are switched off. */
  ui.w.PDVerseAlerts.disable();
  t('switching verses off stops the in-app timer', ui.w.PDVerseAlerts.settings().enabled === false);

  for (const session of [main, schedule, off, special, offline, ui]) session.dom.window.close();
  console.log(`\n${passed} verse delivery checks passed${process.exitCode ? ' with failures' : ''}.`);
})();
