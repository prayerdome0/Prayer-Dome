'use strict';
// Run against the local emulator only. No production credentials are used.
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, deleteField, increment } = require('firebase/firestore');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  assert(process.env.FIRESTORE_EMULATOR_HOST, 'Use npm run test:rules, never a production database');
  const env = await initializeTestEnvironment({ projectId: 'demo-prayer-dome',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
  try {
    const member = env.authenticatedContext('member').firestore();
    const other = env.authenticatedContext('other').firestore();
    const admin = env.authenticatedContext('admin').firestore();
    const guest = env.unauthenticatedContext().firestore();
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'users/admin'), { role: 'admin' });
      await setDoc(doc(db, 'liveStatus/current'), { viewers: 2, totalViews: 5, isLive: true });
    });
    for (const collection of ['users', 'memberships']) {
      await assertFails(setDoc(doc(member, `${collection}/member`), { role: 'admin' }));
      await assertSucceeds(setDoc(doc(member, `${collection}/member`), { role: 'member', status: 'pending' }));
      await assertFails(updateDoc(doc(member, `${collection}/member`), { role: 'admin' }));
      await assertFails(updateDoc(doc(member, `${collection}/member`), { role: deleteField() }));
      await assertFails(updateDoc(doc(other, `${collection}/member`), { fullName: 'Impersonation' }));
      await assertSucceeds(updateDoc(doc(member, `${collection}/member`), { fullName: 'Member' }));
      await assertSucceeds(updateDoc(doc(admin, `${collection}/member`), { role: 'leader' }));
    }
    await assertFails(updateDoc(doc(member, 'memberships/member'), { status: 'approved' }));
    await assertSucceeds(updateDoc(doc(admin, 'memberships/member'), { status: 'approved' }));
    await assertFails(setDoc(doc(member, 'announcements/forged'), { title: 'Forged' }));
    await assertSucceeds(updateDoc(doc(guest, 'liveStatus/current'), { viewers: increment(1), totalViews: increment(1) }));
    await assertSucceeds(updateDoc(doc(guest, 'liveStatus/current'), { viewers: increment(-1) }));
    await assertFails(updateDoc(doc(guest, 'liveStatus/current'), { isLive: false }));
    await assertFails(updateDoc(doc(member, 'liveStatus/current'), { viewers: 9999 }));
    for (const collection of ['userTokens', 'userEvents']) {
      await assertSucceeds(setDoc(doc(member, `${collection}/owned`), { userId: 'member' }));
      await assertFails(updateDoc(doc(other, `${collection}/owned`), { userId: 'other' }));
      await assertFails(getDoc(doc(other, `${collection}/owned`)));
      await assertSucceeds(updateDoc(doc(member, `${collection}/owned`), { active: true }));
    }
    for (const collection of ['prayers', 'testimonies', 'gallery']) {
      await assertFails(setDoc(doc(member, `${collection}/new`), { userId: 'member', status: 'approved' }));
      await assertFails(setDoc(doc(member, `${collection}/new`), { userId: 'other', status: 'pending' }));
      await assertSucceeds(setDoc(doc(member, `${collection}/new`), { userId: 'member', status: 'pending' }));
      await assertSucceeds(updateDoc(doc(admin, `${collection}/new`), { status: 'approved' }));
      await assertSucceeds(getDoc(doc(guest, `${collection}/new`)));
    }
    console.log('Firestore authorization regression checks passed.');
  } finally { await env.cleanup(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
