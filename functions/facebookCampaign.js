/*
 * Facebook Page campaign service.
 *
 * This service creates ready-to-copy drafts only. It never calls the Facebook
 * API and does not require a Page ID or access token.
 */
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

const POSTS_PER_CAMPAIGN = 90;
const CAMPAIGN_DAYS = 30;
const DEFAULT_SITE = 'https://prayerdome.net';
const IMAGE_PATHS = [
  '/assets/og-image.png',
  '/assets/hero-worship.jpg',
  '/assets/logo.png'
];

const MESSAGE_TEMPLATES = [
  'Looking for a place to pray, grow in God’s Word and connect with believers? Visit Prayer Dome today: {url}',
  'Prayer changes lives. Join the Prayer Dome community for prayer, Bible study, worship and encouragement: {url}',
  'A House of Prayer for All Nations. Discover messages, devotionals, live services and more at Prayer Dome: {url}',
  'Need encouragement today? Find Scripture, prayer support and a welcoming faith community at Prayer Dome: {url}',
  'Grow deeper in faith with Bible study, daily devotionals and a community that prays with you. Visit: {url}',
  'Your next moment with God can begin today. Explore Prayer Dome and join our growing online faith family: {url}',
  'Share a prayer request, read the Bible and be encouraged. Prayer Dome is here for you: {url}',
  'Faith, hope and community are waiting for you at Prayer Dome. Visit our website today: {url}',
  'Join a global community seeking God in prayer. Start your journey with Prayer Dome: {url}',
  'Discover a place for worship, discipleship, testimonies and prayer at Prayer Dome: {url}'
];

async function requireAdmin(context) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in as an administrator.');
  const db = admin.firestore();
  const [membership, user] = await Promise.all([
    db.collection('memberships').doc(context.auth.uid).get(),
    db.collection('users').doc(context.auth.uid).get()
  ]);
  if (membership.data()?.role !== 'admin' && user.data()?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Administrator access is required.');
  }
}

function cleanSiteUrl(value) {
  try {
    const url = new URL(value || DEFAULT_SITE);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    return url.toString().replace(/\/$/, '');
  } catch (_) {
    return DEFAULT_SITE;
  }
}

function campaignPosts(siteUrl, start) {
  const startMs = start.getTime();
  const interval = (CAMPAIGN_DAYS * 24 * 60 * 60 * 1000) / POSTS_PER_CAMPAIGN;
  return Array.from({ length: POSTS_PER_CAMPAIGN }, (_, index) => {
    const template = MESSAGE_TEMPLATES[index % MESSAGE_TEMPLATES.length];
    return {
      message: template.replace('{url}', siteUrl),
      imageUrl: `${siteUrl}${IMAGE_PATHS[index % IMAGE_PATHS.length]}`,
      scheduledAt: admin.firestore.Timestamp.fromMillis(startMs + (index * interval)),
      status: 'queued',
      campaignNumber: index + 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
  });
}

async function generateCampaign({ force = false, actor = 'automatic scheduler' } = {}) {
  const db = admin.firestore();
  const settingsRef = db.collection('socialCampaigns').doc('facebook');
  const settingsSnap = await settingsRef.get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  if (!force && settings.enabled === false) return { created: 0, skipped: 'disabled' };

  const now = new Date();
  const due = !settings.nextGenerationAt || settings.nextGenerationAt.toDate() <= now;
  if (!force && !due) return { created: 0, skipped: 'not_due' };

  // When manually regenerating, begin after the latest queued post so posts
  // are not published in a burst or overwrite an active campaign.
  let start = now;
  if (force) {
    const latest = await db.collection('facebookPosts').orderBy('scheduledAt', 'desc').limit(1).get();
    if (!latest.empty) start = new Date(Math.max(now.getTime(), latest.docs[0].data().scheduledAt.toMillis() + 24 * 60 * 60 * 1000));
  }
  const posts = campaignPosts(cleanSiteUrl(settings.websiteUrl), start);
  const batch = db.batch();
  posts.forEach(post => batch.set(db.collection('facebookPosts').doc(), post));
  batch.set(settingsRef, {
    enabled: settings.enabled !== false,
    websiteUrl: cleanSiteUrl(settings.websiteUrl),
    nextGenerationAt: admin.firestore.Timestamp.fromMillis(start.getTime() + CAMPAIGN_DAYS * 24 * 60 * 60 * 1000),
    lastGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastGeneratedBy: actor,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  await batch.commit();
  return { created: posts.length, start: start.toISOString() };
}

exports.getFacebookCampaignStatus = functions.https.onCall(async (_data, context) => {
  await requireAdmin(context);
  return { manual: true };
});

exports.generateFacebookCampaign = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);
  return generateCampaign({ force: data?.force === true, actor: context.auth.token.email || context.auth.uid });
});

// This hourly check creates the next set of drafts after 30 days. It never
// contacts Facebook: administrators copy each post and publish it themselves.
exports.facebookCampaignScheduler = functions.pubsub.schedule('0 * * * *').timeZone('Africa/Lusaka').onRun(async () => {
  try {
    const generation = await generateCampaign();
    if (generation.created) console.log(`Generated ${generation.created} manual Facebook campaign drafts.`);
  } catch (error) { console.error('Facebook campaign scheduler failed:', error); }
  return null;
});
