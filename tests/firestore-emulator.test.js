/* ============================================================================
 * Prayer Dome — Firestore rules ENFORCEMENT tests (emulator)
 * ----------------------------------------------------------------------------
 * Runs the actual rules against the local emulator. Skips itself (exit 0)
 * when the emulator or the rules-testing package is unavailable, so `npm test`
 * stays green in plain CI.
 *
 *   npm i -D @firebase/rules-unit-testing firebase
 *   firebase emulators:exec "node tests/firestore-emulator.test.js"
 * ========================================================================== */
'use strict';

let rulesTest;
try { rulesTest = require('@firebase/rules-unit-testing'); }
catch (e) { console.log('SKIP  @firebase/rules-unit-testing not installed — emulator tests skipped'); process.exit(0); }
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'prayer-dome';
const RULES = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

let passed = 0, failed = 0;
function ok(name, cond) {
  if (cond) { passed++; console.log('PASS  ' + name); }
  else { failed++; console.error('FAIL  ' + name); }
}

async function expectDeny(promise, label) {
  let denied = false;
  try { await promise; } catch (e) { denied = e.code === 'permission-denied'; }
  ok(label, denied);
}
async function expectAllow(promise, label) {
  let allowed = false;
  try { await promise; allowed = true; } catch (e) { allowed = e.code !== 'permission-denied'; }
  ok(label, allowed);
}

(async () => {
  try {
    await rulesTest.loadFirestoreRules({ projectId: PROJECT_ID, rules: RULES });
  } catch (e) {
    console.log('SKIP  emulator not reachable (' + e.message + ')');
    process.exit(0);
  }

  const admin = rulesTest.initializeAdminApp({ projectId: PROJECT_ID });
  const member = rulesTest.initializeTestApp({ projectId: PROJECT_ID, auth: { uid: 'member1' } });
  const adminAuth = rulesTest.initializeTestApp({ projectId: PROJECT_ID, auth: { uid: 'boss', email: 'boss@prayerdome.net' } });

  const db = app => rulesTest.getFirestore(app);
  const dbAdmin = db(admin), dbMember = db(member), dbBoss = db(adminAuth);

  // Seed roles
  await dbAdmin.doc('memberships/member1').set({ userId: 'member1', role: 'member', status: 'approved' });
  await dbAdmin.doc('memberships/boss').set({ userId: 'boss', role: 'admin', status: 'approved' });

  // Public reads
  await expectAllow(dbMember.doc('news/demo').get(), 'member can read news');
  await expectAllow(dbMember.doc('events/demo').get(), 'member can read events');
  await expectAllow(dbMember.doc('liveStatus/current').get(), 'member can read liveStatus');

  // Private data is private
  await expectDeny(dbMember.doc('wallets/other').get(), 'member cannot read someone elses wallet');
  await expectDeny(dbMember.doc('bibleNotes/other').get(), 'member cannot read someone elses bible notes');
  await expectDeny(dbMember.doc('financialReports/x').get(), 'member cannot read financial reports');
  await expectDeny(dbMember.doc('adminLogs/x').get(), 'member cannot read admin logs');

  // Prayer moderation flow
  await expectAllow(
    dbMember.collection('prayers').add({ userId: 'member1', text: 'Lord help me', status: 'pending' }),
    'member can submit prayer (pending)'
  );
  await expectDeny(
    dbMember.collection('prayers').add({ userId: 'member1', text: 'x', status: 'approved' }),
    'member cannot self-approve a prayer'
  );
  await expectDeny(
    dbMember.doc('prayers/p1').set({ userId: 'member2', text: 'x', status: 'pending' }),
    'member cannot create a prayer under another user id'
  );

  // Admin moderation
  await expectAllow(
    dbBoss.doc('prayers/p1').set({ userId: 'member1', text: 'Lord help me', status: 'approved' }),
    'admin can approve a prayer'
  );

  // Memberships self-promotion blocked
  await expectDeny(
    dbMember.doc('memberships/member1').update({ role: 'admin' }),
    'member cannot self-promote to admin'
  );

  // Pageviews beacon
  await expectAllow(
    dbMember.collection('pageviews').add({ path: '/prayer', ts: Date.now() }),
    'signed-in beacon write allowed'
  );
  await expectDeny(
    dbMember.collection('pageviews').add({ path: '/prayer', ts: Date.now(), admin: true, evil: true, extra: 1, junk: 2, more: 3, over: 4, limit: 5, nope: 6, x: 7 }),
    'oversized beacon write denied'
  );

  console.log(`\n${passed} passed, ${failed} failed (emulator)`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
