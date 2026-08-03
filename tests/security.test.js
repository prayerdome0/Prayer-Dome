/* ============================================================================
 * Prayer Dome — Security rules tests (static, no emulator required)
 * ----------------------------------------------------------------------------
 * Parses firestore.rules and storage.rules and verifies the permission
 * matrix: public content stays public, private data stays private, and no
 * collection is open for world writes.
 *
 * Optional emulator run for real enforcement checks:
 *   tests/firestore-emulator.test.js  (skips itself unless emulator is up)
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const RULES = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
const STORAGE = fs.readFileSync(path.join(__dirname, '..', 'storage.rules'), 'utf8');

let passed = 0, failed = 0;
function ok(name, cond) {
  if (cond) { passed++; console.log('PASS  ' + name); }
  else { failed++; console.error('FAIL  ' + name); }
}

/* ------------------------------------------------------------- rule parsing */
// Pull each `match /col/{id}` block out of the rules text.
function collectionBlocks(text) {
  const blocks = [];
  const re = /match \/([A-Za-z0-9_{}\/]+)\s*\{([^]*?)\n\s*\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const full = m[1].trim();
    if (full.split('/').length > 2) continue;  // skip nested matches
    // 'memberships/{uid}' -> 'memberships'
    const name = full.replace(/\{[^}]*\}/g, '').replace(/\/+$/, '').trim();
    blocks.push({ name: name, body: m[2] });
  }
  return blocks;
}

const blocks = collectionBlocks(RULES);
const byName = {};
blocks.forEach(b => { byName[b.name] = b; });

/* ------------------------------------------------------------ helper checks */
ok('firestore.rules exists and parses into collections',
  blocks.length >= 30);
ok('helpers defined (isSignedIn / isAdmin / isFinance)',
  RULES.includes('function isSignedIn()')
  && RULES.includes('function isAdmin()')
  && RULES.includes('function isFinance()'));
ok('no allow read, write: if true anywhere',
  !RULES.includes('allow read, write: if true'));
ok('no allow write: if true anywhere',
  !/allow write: if true/.test(RULES));

/* -------------------------------------------------------- public read list */
const publicRead = [
  'news', 'notifications', 'announcements', 'banners', 'communityStats',
  'devotional', 'settings', 'events', 'liveStatus', 'liveChat',
  'liveRecordings', 'reviews', 'statuses'
];
publicRead.forEach(c => {
  ok(`${c} allows public read`, byName[c] && /allow read: if true/.test(byName[c].body));
});

/* ------------------------------------------------------- private read list */
const privateRead = [
  'wallets', 'financialReports', 'deposits', 'withdrawals', 'activePlans',
  'offerings', 'supportClaims', 'memberCareRequests', 'userTokens',
  'userEvents', 'userQuiz', 'bibleNotes', 'bibleProgress', 'adminLogs',
  'test_notifications', 'contactMessages', 'users', 'giving'
];
privateRead.forEach(c => {
  const b = byName[c];
  ok(`${c} is NOT world-readable`, b && !/allow read: if true/.test(b.body));
});

/* -------------------------------------------------------- moderation checks */
['prayers', 'testimonies', 'gallery'].forEach(c => {
  const b = byName[c];
  ok(`${c} create starts as pending`, b
    && /request\.resource\.data\.status == 'pending'/.test(b.body));
  ok(`${c} public read is limited to approved`, b
    && /resource\.data\.status == 'approved'/.test(b.body));
});

/* --------------------------------------------------------- admin-only lists */
['adminLogs', 'test_notifications', 'news', 'announcements', 'banners',
 'communityStats', 'devotional', 'settings', 'liveStatus', 'liveRecordings']
  .forEach(c => {
    const b = byName[c];
    ok(`${c} writes require admin`, b
      && /allow (create|update|write): if isAdmin\(\)/.test(b.body));
  });

/* ------------------------------------------------------- memberships checks */
const memberships = byName['memberships'];
ok('membership application must be own + pending',
  memberships && /status == 'pending'/.test(memberships.body)
  && /role == 'member'/.test(memberships.body));
ok('members cannot self-promote to admin',
  memberships && /request\.resource\.data\.role == resource\.data\.role/.test(memberships.body));

/* --------------------------------------------------------- pageview checks */
const pageviews = byName['pageviews'];
ok('pageviews create-only (no update/delete)',
  pageviews && /allow update: if false/.test(pageviews.body)
  && /allow delete: if false/.test(pageviews.body));
ok('pageviews shape validation present (validBeacon helper)',
  /function validBeacon\(\)/.test(RULES)
  && /request\.resource\.data\.path is string/.test(RULES));

/* ------------------------------------------------------------ giving docs  */
const giving = byName['giving'];
ok('giving is server-write-only (no client writes)',
  giving && /allow create: if false/.test(giving.body)
  && /allow update: if false/.test(giving.body));

/* --------------------------------------------------------------- private DM */
const dm = byName['privateChats'];
ok('private chats restrict read to participants',
  dm && /request\.auth\.uid in resource\.data\.participants/.test(dm.body));

/* ----------------------------------------------------------- storage checks */
ok('storage: no world-write anywhere',
  !/allow write: if true/.test(STORAGE));
ok('storage: admin-only media path',
  /match \/admin\/\{allPaths=\*\*\}/.test(STORAGE)
  && /allow write: if isAdmin\(\)/.test(STORAGE));
ok('storage: chat uploads are owner-scoped',
  /match \/chat\/\{uid\}\/\{filename\}/.test(STORAGE)
  && /request\.auth\.uid == uid/.test(STORAGE));

/* ------------------------------------------------------------- reporting  */
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
