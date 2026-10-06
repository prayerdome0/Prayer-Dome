/*
 * Admin access behaviour (jsdom, real admin.html module code).
 *
 * The console must never ask an administrator to sign in again while Firestore
 * still reports the admin role for the device's Prayer Dome session. These
 * checks load the *real* admin.html module in jsdom, replace only the Firebase
 * CDN imports with controllable stubs and then drive the real auth state
 * machine end to end:
 *
 *   • signed out                     -> sign-in card with a helpful hint
 *   • admin in memberships/<uid>     -> console opens, session remembered
 *   • admin only in users/<uid>      -> console opens (same fallback the rules use)
 *   • signed in as a member          -> sign-in card, no session kept
 *   • Firestore unreachable + verified session -> console stays open
 *   • role revoked in Firestore      -> console closes immediately
 *   • new tab with a remembered session -> console opens before Firestore answers
 *   • signed out in another tab      -> this tab signs out too
 *
 *   npm install --no-save jsdom
 *   node tests/admin-auth.test.js
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ADMIN_HTML = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');

let passed = 0;
function t(name, ok, extra = '') {
  if (ok) { passed += 1; console.log('PASS  ' + name); }
  else { console.error('FAIL  ' + name + (extra ? '  ' + extra : '')); process.exitCode = 1; }
}

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (error) {
  console.log('SKIP  jsdom is not installed — run: npm install --no-save jsdom');
  process.exit(0);
}

/* The module uses ES imports from the Firebase CDN; point them at the stubs. */
const MODULE_SOURCE = (() => {
  const code = ADMIN_HTML.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const replacements = [
    [/^\s*import \{([^}]+)\} from "[^"]*firebase-app\.js";/m, 'const {$1} = window.__fb.app;'],
    [/^\s*import \{([^}]+)\} from "[^"]*firebase-firestore\.js";/m, 'const {$1} = window.__fb.firestore;'],
    [/^\s*import \{([^}]+)\} from "[^"]*firebase-auth\.js";/m, 'const {$1} = window.__fb.auth;'],
    [/^\s*import \{([^}]+)\} from "[^"]*firebase-functions\.js";/m, 'const {$1} = window.__fb.functions;']
  ];
  let transformed = code;
  for (const [pattern, replacement] of replacements) {
    assert.match(transformed, pattern, 'admin module import shape changed');
    transformed = transformed.replace(pattern, replacement);
  }
  return transformed;
})();

const ADMIN_USER = { uid: 'u1', email: 'admin@prayerdome.net', displayName: 'Pastor Test' };
const MEMBER_USER = { uid: 'u2', email: 'member@prayerdome.net', displayName: 'Member' };

function adminSession(overrides = {}) {
  const now = Date.now();
  return Object.assign({
    version: 2, uid: ADMIN_USER.uid, email: ADMIN_USER.email, name: 'Pastor Test',
    role: 'admin', source: 'memberships', timestamp: now, verifiedAt: now, seenAt: now
  }, overrides);
}

function snapshot(data) {
  return { exists: () => data !== null && data !== undefined, data: () => data || {} };
}

/**
 * Boot the console with stubbed Firebase.
 *   docs: { 'memberships/u1': {...} | null | 'error' }  ('error' throws)
 *   user: the signed-in Firebase user (or null)
 *   session: pre-seeded localStorage session (or null)
 */
async function bootConsole(options = {}) {
  const docs = Object.assign({}, options.docs);
  const calls = { setFirestore: 0, registerDevice: 0, toast: [], switchView: [], signedOut: 0, loaders: [] };
  const snapshotListeners = [];
  const pendingGetDocs = [];

  const dom = new JSDOM(ADMIN_HTML, {
    url: 'https://prayerdome.net/admin.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({
        matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}
      }));
      window.scrollTo = () => {};
      window.HTMLCanvasElement.prototype.getContext = () => ({
        setTransform() {}, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {},
        stroke() {}, fill() {}, closePath() {}, clearRect() {}, fillRect() {}, arc() {},
        measureText: () => ({ width: 0 }), fillText() {}, drawImage() {},
        createLinearGradient: () => ({ addColorStop() {} })
      });
      window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
      window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      window.URL.createObjectURL = () => 'blob:x';
    }
  });

  const { window } = dom;
  if (options.session) window.localStorage.setItem('pd_admin_session', JSON.stringify(options.session));
  else window.localStorage.removeItem('pd_admin_session');

  const emptyQuery = { docs: [], size: 0, empty: true, forEach() {} };
  const docRef = (db, collectionName, id) => ({ collectionName, id });
  const resolveDoc = (ref) => {
    const key = `${ref.collectionName}/${ref.id}`;
    const value = Object.prototype.hasOwnProperty.call(docs, key) ? docs[key] : null;
    if (value === 'error') return Promise.reject(new Error('Firestore unavailable'));
    if (typeof value === 'function') return value();
    return Promise.resolve(snapshot(value));
  };

  window.PDApp = {
    setFirestore() { calls.setFirestore += 1; },
    founder: { refresh: () => Promise.resolve({}) },
    notifications: { registerDevice() { calls.registerDevice += 1; return Promise.resolve('token'); } }
  };

  window.__fb = {
    app: { initializeApp: () => ({ name: 'stub' }) },
    firestore: {
      getFirestore: () => ({}),
      collection: () => ({}),
      doc: docRef,
      getDoc: resolveDoc,
      getDocs: () => {
        const pending = options.getDocs ? options.getDocs() : Promise.resolve(emptyQuery);
        pendingGetDocs.push(pending);
        return pending;
      },
      updateDoc: () => Promise.resolve(),
      setDoc: () => Promise.resolve(),
      deleteDoc: () => Promise.resolve(),
      addDoc: () => Promise.resolve({ id: 'doc' }),
      query: () => ({}), where: () => ({}), orderBy: () => ({}), startAfter: () => ({}),
      limit: () => ({}), serverTimestamp: () => ({}), increment: (value) => value,
      Timestamp: { fromDate: (date) => date },
      writeBatch: () => ({ set() {}, update() {}, delete() {}, commit: () => Promise.resolve() }),
      onSnapshot: (ref, callback) => {
        const listener = { ref, callback };
        snapshotListeners.push(listener);
        return () => {
          const index = snapshotListeners.indexOf(listener);
          if (index >= 0) snapshotListeners.splice(index, 1);
        };
      }
    },
    auth: {
      getAuth: () => ({ currentUser: options.user || null }),
      onAuthStateChanged: (auth, callback) => { window.__authStateChanged = callback; return () => {}; },
      setPersistence: () => Promise.resolve(),
      browserLocalPersistence: 'local',
      signOut: () => { calls.signedOut += 1; return Promise.resolve(); }
    },
    functions: { getFunctions: () => ({}), httpsCallable: () => (() => Promise.resolve({ data: {} })) }
  };

  // Re-stub getAuth so auth.currentUser follows the scenario as it changes.
  window.__fb.auth.getAuth = () => ({
    currentUser: Object.prototype.hasOwnProperty.call(options, 'user') ? options.user : null
  });

  const originalToast = window.console;
  await window.eval(`(async () => {\n${MODULE_SOURCE}\n})()`);

  const realToast = window.toast;
  window.toast = (message, type) => { calls.toast.push({ message, type }); return realToast(message, type); };

  return {
    window,
    document: window.document,
    calls,
    listeners: snapshotListeners,
    // The module captured getDoc/onSnapshot at import time, so scenario changes
    // go through the shared docs map or the captured listener instead.
    setDoc: (key, value) => { docs[key] = value; },
    membershipListener: () => snapshotListeners.find((listener) =>
      listener.ref && listener.ref.collectionName === 'memberships' && listener.ref.id === ADMIN_USER.uid),
    signIn: async (user) => { await window.__authStateChanged(user); },
    session: () => {
      try { return JSON.parse(window.localStorage.getItem('pd_admin_session') || 'null'); }
      catch (error) { return null; }
    },
    loginVisible: () => window.document.getElementById('loginModal').style.display !== 'none',
    loaderVisible: () => window.document.getElementById('globalLoader').style.display !== 'none',
    hint: () => (window.document.getElementById('loginHint') || {}).textContent || '',
    name: () => window.document.getElementById('topbarName').innerText,
    close: () => { try { window.close(); } catch (error) {} },
    pendingGetDocs
  };
}

(async () => {
  /* ------------------------------------------------------------ signed out */
  {
    const console_ = await bootConsole({ user: null });
    await console_.signIn(null);
    t('signed out: the sign-in card is shown', console_.loginVisible());
    t('signed out: the loader is cleared', !console_.loaderVisible());
    t('signed out: the hint explains a single sign-in is enough',
      /no prayer dome session is active/i.test(console_.hint()), console_.hint());
    t('signed out: nothing is stored', console_.session() === null);
    console_.close();
  }

  /* -------------------------------------------------- admin in memberships */
  {
    const console_ = await bootConsole({
      user: ADMIN_USER,
      docs: { 'memberships/u1': { role: 'admin', fullName: 'Pastor Test' }, 'users/u1': { role: 'admin' } }
    });
    await console_.signIn(ADMIN_USER);
    t('admin (memberships): the console opens without the sign-in card', !console_.loginVisible());
    t('admin (memberships): the loader is cleared', !console_.loaderVisible());
    t('admin (memberships): the profile name comes from Firestore',
      console_.name() === 'Pastor Test', console_.name());
    const session = console_.session();
    t('admin (memberships): the verified session is remembered on the device', !!session &&
      session.uid === ADMIN_USER.uid && session.role === 'admin' && session.source === 'memberships');
    t('admin (memberships): Firestore bindings are handed over and push registers once',
      console_.calls.setFirestore >= 1 && console_.calls.registerDevice === 1);
    t('admin (memberships): a live role watch is attached to memberships/<uid>',
      !!console_.membershipListener());
    console_.close();
  }

  /* ---------------------------------------------- admin only in users/<uid> */
  {
    const console_ = await bootConsole({
      user: ADMIN_USER,
      docs: { 'memberships/u1': null, 'users/u1': { role: 'admin', fullName: 'Pastor Test' } }
    });
    await console_.signIn(ADMIN_USER);
    const session = console_.session();
    t('admin (users fallback): the console opens — no second sign-in',
      !console_.loginVisible() && !!session && session.source === 'users',
      JSON.stringify(session));
    console_.close();
  }

  /* ------------------------------------------------- signed in, not an admin */
  {
    const console_ = await bootConsole({
      user: MEMBER_USER,
      docs: { 'memberships/u2': { role: 'member' }, 'users/u2': { role: 'member' } }
    });
    await console_.signIn(MEMBER_USER);
    t('member account: the sign-in card explains the role is missing',
      console_.loginVisible() && /administrator privileges/i.test(console_.hint()), console_.hint());
    t('member account: no admin session is stored', console_.session() === null);
    console_.close();
  }

  /* -------------------------------- Firestore unreachable, verified session */
  {
    const console_ = await bootConsole({
      user: ADMIN_USER,
      session: adminSession(),
      docs: { 'memberships/u1': 'error', 'users/u1': 'error' }
    });
    await console_.signIn(ADMIN_USER);
    t('offline: a verified tab keeps the console open', !console_.loginVisible() &&
      !console_.loaderVisible());
    t('offline: the administrator is told the check will resume',
      console_.calls.toast.some((entry) => /unreachable/i.test(entry.message)) ||
      console_.calls.toast.some((entry) => /offline/i.test(entry.message)),
      JSON.stringify(console_.calls.toast));
    t('offline: the remembered session is kept for the next visit', !!console_.session());
    console_.close();
  }

  /* ------------------------------------------------------ stale local session */
  {
    const console_ = await bootConsole({
      user: ADMIN_USER,
      session: adminSession({ timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, verifiedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 }),
      docs: { 'memberships/u1': null, 'users/u1': null }
    });
    await console_.signIn(ADMIN_USER);
    t('expired session: the console does not open from a stale local session', console_.loginVisible());
    t('expired session: the stale record is cleared', console_.session() === null);
    console_.close();
  }

  /* ------------------------------------------------------- role revoked live */
  {
    const console_ = await bootConsole({
      user: ADMIN_USER,
      docs: { 'memberships/u1': { role: 'admin' }, 'users/u1': { role: 'admin' } }
    });
    await console_.signIn(ADMIN_USER);
    t('revocation: the console is open before the role is removed', !console_.loginVisible());
    // Firestore now reports a member (role removed while the tab is open).
    console_.setDoc('memberships/u1', { role: 'member' });
    console_.setDoc('users/u1', { role: 'member' });
    console_.membershipListener().callback(snapshot({ role: 'member' }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    t('revocation: the console closes as soon as Firestore drops the role',
      console_.loginVisible() && console_.session() === null);
    t('revocation: the administrator is told why', console_.calls.toast.some((entry) =>
      /access was removed/i.test(entry.message)), JSON.stringify(console_.calls.toast));
    console_.close();
  }

  /* ------------------------------- new tab: remembered session, slow network */
  {
    const console_ = await bootConsole({
      user: ADMIN_USER,
      session: adminSession(),
      docs: {
        'memberships/u1': () => new Promise((resolve) => setTimeout(() => resolve(snapshot({ role: 'admin' })), 3000)),
        'users/u1': () => new Promise((resolve) => setTimeout(() => resolve(snapshot({ role: 'admin' })), 3000))
      }
    });
    const signIn = console_.signIn(ADMIN_USER);       // do not await: assert the instant state
    t('new tab: a remembered session shows the console while Firestore is still answering',
      !console_.loginVisible() && !console_.loaderVisible());
    await signIn;
    t('new tab: the background check keeps the console open', !console_.loginVisible());
    console_.close();
  }

  /* -------------------------------------------------- signed out in another tab */
  {
    const console_ = await bootConsole({
      user: ADMIN_USER,
      docs: { 'memberships/u1': { role: 'admin' }, 'users/u1': { role: 'admin' } }
    });
    await console_.signIn(ADMIN_USER);
    // Another tab cleared the shared admin session.
    console_.window.localStorage.removeItem('pd_admin_session');
    console_.window.dispatchEvent(new console_.window.StorageEvent('storage', {
      key: 'pd_admin_session', oldValue: JSON.stringify(adminSession()), newValue: null
    }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    t('cross-tab logout: the console returns to the sign-in card', console_.loginVisible());
    t('cross-tab logout: this tab signs out of Firebase too', console_.calls.signedOut >= 1);
    console_.close();
  }

  console.log(`\nAdmin access behaviour checks passed (${passed} assertions).`);
  process.exit(process.exitCode || 0);
})().catch((error) => {
  console.error('FAIL  admin access behaviour suite crashed:', error);
  process.exit(1);
});
