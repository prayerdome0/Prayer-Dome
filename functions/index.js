// Use the v1 compatibility surface because these exports intentionally use
// first-generation triggers (pubsub.schedule, firestore.document and onCall).
// firebase-functions v7 no longer exposes that surface from the package root.
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const shareHandler = require('./share');
const crypto = require('crypto');

if (!admin.getApps().length) {
  admin.initializeApp();
}

// Dynamic social sharing pages for news and testimony links.
exports.share = functions.https.onRequest((req, res) => shareHandler(req, res));

// ==========================================
// Secure Server-Side Cloudinary Signing
// ==========================================
// Call this from the client to get a secure upload signature.
// The API secret never leaves the server.
exports.getCloudinarySignature = functions.https.onCall((data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to perform this action.'
    );
  }

  const cloudName = functions.config().cloudinary?.cloud_name || 'prayerdome';
  const apiKey = functions.config().cloudinary?.api_key;
  const apiSecret = functions.config().cloudinary?.api_secret;

  if (!apiKey || !apiSecret) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Cloudinary is not configured. Ask an admin to set firebase functions:config:set cloudinary.api_key=... cloudinary.api_secret=...'
    );
  }

  const timestamp = Math.round((new Date()).getTime() / 1000);
  const params = {
    timestamp: timestamp,
    upload_preset: data.upload_preset || 'live_streams',
    folder: data.folder || 'user_uploads'
  };

  const signature = crypto.createHash('sha1')
    .update(JSON.stringify(params) + apiSecret)
    .digest('hex');

  return {
    signature: signature,
    timestamp: timestamp,
    apiKey: apiKey,
    cloudName: cloudName
  };
});

// ==========================================
// Scheduled Devotional Dispatcher
// ==========================================
// Runs once per day (configure the schedule in Firebase Console
// after deploying). Loads today's devotional from Firestore and
// sends a notification to all users who opted in.
exports.dailyDevotionalNotification = functions.pubsub
  .schedule('0 6 * * *') // 06:00 UTC daily — adjust to your timezone
  .timeZone('Africa/Lusaka')
  .onRun(async () => {
    const db = admin.firestore();
    const today = new Date().toISOString().split('T')[0];

    try {
      const devQ = await db.collection('devotionals')
        .where('publishDate', '==', today)
        .limit(1)
        .get();

      if (devQ.empty) {
        console.log('No devotional scheduled for today:', today);
        return null;
      }

      const dev = devQ.docs[0].data();
      const tokensSnap = await db.collection('userTokens')
        .where('active', '!=', false)
        .get();

      const tokens = [];
      tokensSnap.forEach(doc => {
        const d = doc.data();
        if (d.token && d.notifications !== false) tokens.push(d.token);
      });

      if (tokens.length === 0) {
        console.log('No active push tokens for devotional dispatch.');
        return null;
      }

      const payload = {
        notification: {
          title: '📖 Daily Devotional — Prayer Dome',
          body: dev.title ? `${dev.title}: ${dev.thought ? dev.thought.substring(0, 80) + '…' : 'Read today\'s word.'}` : 'Your daily devotional is ready.',
          icon: '/assets/logo.png',
          badge: '/assets/logo.png'
        },
        data: {
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          screen: 'devotional',
          devId: devQ.docs[0].id
        },
        tokens: tokens
      };

      const response = await admin.messaging().sendEachForMulticast(payload);
      console.log(`Devotional notification sent to ${response.successCount}/${tokens.length} devices.`);

      // Log the dispatch.
      await db.collection('devotionalLogs').add({
        date: today,
        title: dev.title,
        sentCount: response.successCount,
        failureCount: response.failureCount,
        dispatchedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return null;
    } catch (err) {
      console.error('Daily devotional dispatch failed:', err);
      return null;
    }
  });

// ==========================================
// Prayer Reminder Notification Scheduler
// ==========================================
// Users can schedule a daily prayer reminder time. This function
// runs every 15 minutes and sends reminders to users whose
// reminder time matches the current window.
exports.prayerReminderDispatch = functions.pubsub
  .schedule('*/15 * * * *')
  .timeZone('Africa/Lusaka')
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    try {
      // Find users whose reminder window contains the current time.
      // reminderTime is stored as "HH:MM" in local time (Africa/Lusaka).
      const usersSnap = await db.collection('userReminders')
        .where('reminderTime', '!=', null)
        .get();

      const dispatches = [];
      usersSnap.forEach(doc => {
        const ud = doc.data();
        if (!ud.reminderTime || ud.reminderTime === '') return;
        const [rh, rm] = ud.reminderTime.split(':').map(Number);
        const userMinutes = rh * 60 + rm;
        // Send if within 15 minutes of the scheduled time (to account
        // for the 15-min poll interval).
        const diff = Math.abs(currentMinutes - userMinutes);
        if (diff <= 15 || diff >= 1385) { // also catch midnight wrap
          dispatches.push({ id: doc.id, ...ud });
        }
      });

      if (dispatches.length === 0) return null;

      const tokens = [];
      for (const ud of dispatches) {
        if (ud.fcmToken && ud.notifications !== false) {
          tokens.push({ token: ud.fcmToken, userId: ud.userId });
        }
      }

      if (tokens.length === 0) return null;

      const payload = {
        notification: {
          title: '🙏 Prayer Time — Prayer Dome',
          body: 'Take a moment to lift your requests to God. He is listening.',
          icon: '/assets/logo.png',
          badge: '/assets/logo.png'
        },
        data: {
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          screen: 'prayer'
        },
        tokens: tokens.map(t => t.token)
      };

      const response = await admin.messaging().sendEachForMulticast(payload);
      console.log(`Prayer reminders sent to ${response.successCount}/${tokens.length} users.`);

      // Log each dispatch.
      const batch = db.batch();
      for (const t of tokens) {
        const logRef = db.collection('reminderLogs').doc();
        batch.set(logRef, {
          userId: t.userId,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          success: true
        });
      }
      await batch.commit();

      return null;
    } catch (err) {
      console.error('Prayer reminder dispatch failed:', err);
      return null;
    }
  });

// ==========================================
// Send Push Notification (existing — kept)
// ==========================================
exports.sendPushNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    const { title, message, tokens, type } = notification;

    if (!tokens || tokens.length === 0) {
      console.log('No tokens to send to');
      return null;
    }

    const validTokens = tokens.filter(token => token && token.length > 20);
    if (validTokens.length === 0) {
      console.log('No valid tokens');
      return null;
    }

    const payload = {
      notification: {
        title: title,
        body: message,
        icon: '/assets/logo.png',
        badge: '/assets/logo.png',
        vibrate: '200,100,200',
        sound: 'default'
      },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        screen: type || 'news'
      }
    };

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: validTokens,
        ...payload
      });

      console.log(`Sent to ${response.successCount} devices, failed: ${response.failureCount}`);

      await snap.ref.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(validTokens[idx]);
            console.error(`Failed token: ${validTokens[idx]}`, resp.error);
          }
        });

        for (const failedToken of failedTokens) {
          const tokensQuery = await admin.firestore()
            .collection('userTokens')
            .where('token', '==', failedToken)
            .get();

          tokensQuery.forEach(doc => {
            doc.ref.update({ active: false, invalidReason: 'token_expired' });
          });
        }
      }

      return response;
    } catch (error) {
      console.error('Error sending notifications:', error);
      await snap.ref.update({
        status: 'failed',
        error: error.message
      });
      return null;
    }
  });

// Test notification handler (existing — kept)
exports.sendTestNotification = functions.firestore
  .document('test_notifications/{testId}')
  .onCreate(async (snap, context) => {
    const test = snap.data();
    const { title, message, token } = test;

    if (!token) return null;

    const payload = {
      notification: {
        title: title,
        body: message,
        icon: '/assets/logo.png'
      }
    };

    try {
      const response = await admin.messaging().send({
        token: token,
        ...payload
      });

      console.log('Test notification sent:', response);
      await snap.ref.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return response;
    } catch (error) {
      console.error('Test notification failed:', error);
      await snap.ref.update({
        status: 'failed',
        error: error.message
      });
      return null;
    }
  });
