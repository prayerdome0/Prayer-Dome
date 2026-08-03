// ============================================================================
// Prayer Dome — Devotional scheduler
// ----------------------------------------------------------------------------
// Publishes today's devotional to Firestore (`devotional/current`) three
// times a day in Africa/Lusaka time and pushes it to members who subscribed
// (devotionalSubscribers/{uid}). The picker mirrors devotional-data.js
// exactly so the website, the app and the push all agree on the same verse.
// ============================================================================
'use strict';

const DATA = require('./devotionals.json');

const TZ = 'Africa/Lusaka';

/* ------------------------------------------------------------- date utils */

// Local calendar parts in the ministry's timezone.
function localParts(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: p.hour === '24' ? 0 : +p.hour };
}

// 0-364 like the client's getDayOfYear()
function dayOfYear(parts) {
  const start = Date.UTC(parts.year, 0, 0);
  const now = Date.UTC(parts.year, parts.month - 1, parts.day);
  return Math.floor((now - start) / 86400000);
}

function currentSeason(parts) {
  const m = parts.month, d = parts.day;
  if ((m === 12 && d >= 20) || (m === 1 && d <= 5)) return 'christmas';
  if ((m === 3 && d >= 20) || (m === 4 && d <= 10)) return 'easter';
  if (m === 1 && d <= 5) return 'newYear';
  if (m === 11 && d >= 20) return 'thanksgiving';
  if (m === 2 && d === 14) return 'valentines';
  if ((m === 3 && d >= 20 && d <= 30) || (m === 4 && d <= 5)) return 'palmSunday';
  if ((m === 5 && d >= 20) || (m === 6 && d <= 10)) return 'pentecost';
  if (m === 12 && d <= 24) return 'advent';
  return null;
}

/* ------------------------------------------------------------- the picker */

// Mirror of getDailyDevotional() in devotional-data.js.
function pickDevotional(now) {
  const parts = localParts(now);
  const season = currentSeason(parts);
  if (season && DATA.seasonalDevotionals[season]) {
    const s = DATA.seasonalDevotionals[season];
    return {
      period: season,
      periodName: season.charAt(0).toUpperCase() + season.slice(1) + ' Special 🎉',
      verse: s.verse, text: s.text, message: s.message, prayer: s.prayer,
      isSpecial: true, date: dateKey(parts)
    };
  }
  if (parts.day === 1 || parts.day === 15) {
    let periodName = 'Morning Devotional 🌅';
    if (parts.hour >= 12 && parts.hour < 17) periodName = 'Afternoon Devotional ☀️';
    else if (parts.hour >= 17 || parts.hour < 5) periodName = 'Evening Devotional 🌙';
    return {
      period: 'featured',
      periodName: 'Theme Scripture — Mark 7:37 ✨',
      verse: 'Mark 7:37',
      text: 'He hath done all things well: he maketh both the deaf to hear, and the dumb to speak.',
      theme: 'He does everything blamelessly.',
      message: 'The crowd stood astonished at Jesus. Everything He touched was made whole — the deaf heard, the mute spoke. His works were not almost right; they were blameless. Whatever you are carrying today, the same hands that did all things well are at work in your life. He does everything blamelessly — trust the process, the timing, and the outcome to Him.',
      prayer: 'Lord Jesus, You do all things well. I place my life, my needs, and my future into Your blameless hands. Perfect what concerns me today, and let my testimony bring You glory. Amen.',
      isSpecial: true, featured: true, date: dateKey(parts)
    };
  }
  let period = 'morning', periodName = 'Morning Devotional 🌅';
  if (parts.hour >= 12 && parts.hour < 17) { period = 'afternoon'; periodName = 'Afternoon Devotional ☀️'; }
  else if (parts.hour >= 17 || parts.hour < 5) { period = 'evening'; periodName = 'Evening Devotional 🌙'; }
  const list = DATA.devotionalsDB[period] || [];
  const index = dayOfYear(parts) % list.length;
  const d = list[index] || {};
  return Object.assign({}, d, {
    period, periodName, isSpecial: false, date: dateKey(parts)
  });
}

function dateKey(parts) {
  return parts.year + '-' + String(parts.month).padStart(2, '0') + '-' + String(parts.day).padStart(2, '0');
}

/* --------------------------------------------------------------- publish  */

  async function publish(now, { force = false } = {}) {
  const admin = require('firebase-admin');   // lazy: keeps pickDevotional testable without SDKs
  const db = admin.firestore();
  const devotional = pickDevotional(now);
  const currentRef = db.doc('devotional/current');

  const settingsSnap = await db.doc('settings/devotionalPush').get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const pushEnabled = force ? true : settings.enabled !== false;

  await currentRef.set(Object.assign({}, devotional, { publishedAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });

  let sent = 0, subscribers = 0;
  if (pushEnabled) {
    const snap = await db.collection('devotionalSubscribers').get();
    const tokens = [];
    snap.forEach(doc => {
      const d = doc.data();
      if (d && d.token && d.token.length > 20 && d.active !== false) {
        tokens.push(d.token);
        subscribers++;
      }
    });
    if (tokens.length) {
      const payload = {
        notification: {
          title: '📖 ' + devotional.periodName,
          body: devotional.verse + ' — ' + (devotional.text || '').slice(0, 90) + '…',
          icon: 'https://i.ibb.co/TB5Fx4tb/logo-0.png',
          badge: 'https://i.ibb.co/TB5Fx4tb/logo-0.png',
          sound: 'default'
        },
        data: { click_action: 'FLUTTER_NOTIFICATION_CLICK', screen: 'home' }
      };
      const response = await admin.messaging().sendEachForMulticast({ tokens, ...payload });
      sent = response.successCount;
      // Retire invalid tokens so the list stays clean.
      const failed = [];
      response.responses.forEach((r, i) => { if (!r.success) failed.push(tokens[i]); });
      if (failed.length) {
        const fSnap = await db.collection('devotionalSubscribers').get();
        fSnap.forEach(doc => {
          const d = doc.data();
          if (d && d.token && failed.includes(d.token)) doc.ref.update({ active: false, invalidReason: 'token_expired' });
        });
      }
    }
  }

  // In-app notification (no tokens → the sendPushNotification trigger skips).
  await db.collection('notifications').add({
    type: 'devotional',
    title: '📖 ' + devotional.periodName,
    message: devotional.verse + ' — ' + devotional.text,
    link: '/',
    status: 'sent',
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    tokens: []
  });

  console.log(`Devotional published for ${devotional.date} (${devotional.period}): push ${sent}/${subscribers}`);
  return { date: devotional.date, period: devotional.period, sent, subscribers };
}

/* -------------------------------------------------------------- exports  */

  // Scheduled runs — morning, afternoon and evening in Africa/Lusaka.
  // Wrapped in a lazy loader so the pure picker logic stays require-able in
  // unit tests without the Firebase SDKs installed.
  function sched(cron, name) {
    return function () {
      const functions = require('firebase-functions');
      return functions.pubsub.schedule(cron).timeZone(TZ).onRun(async () => publish(new Date()));
    };
  }
  exports.publishDailyDevotionalMorning = sched('5 5 * * *', 'morning');
  exports.publishDailyDevotionalAfternoon = sched('5 12 * * *', 'afternoon');
  exports.publishDailyDevotionalEvening = sched('5 17 * * *', 'evening');

  // Manual publish from the admin dashboard (callable).
  exports.publishDevotional = function () {
    const functions = require('firebase-functions');
    return functions.https.onCall(async (data, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
      }
      const admin = require('firebase-admin');
      const db = admin.firestore();
      const m = await db.doc('memberships/' + context.auth.uid).get();
      if (!m.exists || m.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Admins only.');
      }
      return publish(new Date(), { force: !!(data && data.force) });
    });
  };

  // What would be published right now — used by the admin preview pane.
  exports.previewDevotional = function () {
    const functions = require('firebase-functions');
    return functions.https.onCall(async (data, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
      }
      return pickDevotional(new Date());
    });
  };

module.exports = { pickDevotional, publish, localParts, currentSeason };
