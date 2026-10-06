/*
 * Finance portal access (jsdom, real finance.html module code).
 *
 * The portal shares the platform session: signing in once on Prayer Dome must
 * cover it, and a slow or unreachable Firestore must never be reported as
 * "not finance" (that used to lock real finance staff out of their own report).
 * These checks run the real module against stubbed Firebase and drive the real
 * auth state machine:
 *
 *   • signed out                      -> access card, blocked, no session kept
 *   • memberships/<uid>.role=finance  -> portal opens, session remembered
 *   • memberships/<uid>.role=admin    -> portal opens
 *   • users/<uid>.role=finance        -> portal opens (rules fallback)
 *   • member                          -> blocked with the "restricted" message
 *   • Firestore down + verified device-> portal stays open, no denial
 *   • Firestore down, no session      -> “could not reach … Check again”
 *   • reload with a remembered session-> portal opens before Firestore answers
 *
 *   npm install --no-save jsdom
 *   node tests/finance-access.test.js
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FINANCE_HTML = fs.readFileSync(path.join(ROOT, 'finance.html'), 'utf8');

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

const MODULE_SOURCE = (() => {
  const code = FINANCE_HTML.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const replacements = [
    [/^\s*import \{([^}]+)\} from "[^"]*firebase-app\.js";/m, 'const {$1} = window.__fb.app;'],
    [/^\s*import \{([^}]+)\} from "[^"]*firebase-firestore\.js";/m, 'const {$1} = window.__fb.firestore;'],
    [/^\s*import \{([^}]+)\} from "[^"]*firebase-auth\.js";/m, 'const {$1} = window.__fb.auth;']
  ];
  let transformed = code;
  for (const [pattern, replacement] of replacements) {
    assert.match(transformed, pattern, 'finance module import shape changed');
    transformed = transformed.replace(pattern, replacement);
  }
  return transformed;
})();

const FINANCE_USER = { uid: 'f1', email: 'finance@prayerdome.net', displayName: 'Finance Lead' };
const MEMBER_USER = { uid: 'm1', email: 'member@prayerdome.net', displayName: 'Member' };

function financeSession(overrides = {}) {
  const now = Date.now();
  return Object.assign({
    version: 1, uid: FINANCE_USER.uid, email: FINANCE_USER.email,
    role: 'finance', name: 'Finance Lead', timestamp: now
  }, overrides);
}

function snapshot(data) {
  return { exists: () => data !== null && data !== undefined, data: () => data || {} };
}

function momentStub() {
  const api = () => chain();
  const chain = () => ({
    format: () => '2026-01-01', fromNow: () => 'just now', toDate: () => new Date(),
    add: () => chain(), subtract: () => chain(), valueOf: () => Date.now()
  });
  api.locale = () => chain();
  return api;
}

async function bootPortal(options = {}) {
  const docs = Object.assign({}, options.docs);
  const calls = { toast: [], signedOutCalls: 0 };
  const pending = [];

  const dom = new JSDOM(FINANCE_HTML, {
    url: 'https://prayerdome.net/finance.html',
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
      window.confetti = () => {};
      window.moment = momentStub();
      // The module logs each retry while Firestore is down; that is expected
      // here and would otherwise flood the test output.
      window.console.error = () => {};
      window.console.warn = () => {};
      window.PDApp = { toast: (message, type) => calls.toast.push({ message, type }) };
    }
  });

  const { window } = dom;
  if (options.session) window.localStorage.setItem('pd_finance_session', JSON.stringify(options.session));
  else window.localStorage.removeItem('pd_finance_session');

  const emptyQuery = { docs: [], size: 0, empty: true, forEach() {} };
  const docRef = (db, collectionName, id) => ({ collectionName, id });
  const resolveDoc = (ref) => {
    const key = `${ref.collectionName}/${ref.id}`;
    const value = Object.prototype.hasOwnProperty.call(docs, key) ? docs[key] : null;
    if (value === 'error') return Promise.reject(new Error('Firestore unavailable'));
    if (typeof value === 'function') return value();
    return Promise.resolve(snapshot(value));
  };

  window.__fb = {
    app: { initializeApp: () => ({}) },
    firestore: {
      getFirestore: () => ({}), collection: () => ({}), doc: docRef, getDoc: resolveDoc,
      getDocs: () => { const p = options.getDocs ? options.getDocs() : Promise.resolve(emptyQuery); pending.push(p); return p; },
      addDoc: () => Promise.resolve({ id: 'report' }), setDoc: () => Promise.resolve(),
      updateDoc: () => Promise.resolve(), deleteDoc: () => Promise.resolve(),
      query: () => ({}), where: () => ({}), orderBy: () => ({}), limit: () => ({}),
      onSnapshot: () => () => {}, serverTimestamp: () => ({}), increment: (n) => n,
      Timestamp: { now: () => ({}), fromDate: (d) => d, fromMillis: (n) => n }
    },
    auth: {
      getAuth: () => ({ currentUser: options.user || null }),
      onAuthStateChanged: (auth, callback) => { window.__authStateChanged = callback; return () => {}; },
      setPersistence: () => Promise.resolve(),
      browserLocalPersistence: 'local',
      signOut: () => { calls.signedOutCalls += 1; return Promise.resolve(); }
    }
  };

  await window.eval(`(async () => {\n${MODULE_SOURCE}\n})()`);

  return {
    window,
    document: window.document,
    calls,
    signIn: async (user) => { await window.__authStateChanged(user); },
    session: () => {
      try { return JSON.parse(window.localStorage.getItem('pd_finance_session') || 'null'); }
      catch (error) { return null; }
    },
    portalVisible: () => window.document.getElementById('reportContent').style.display === 'block',
    cardVisible: () => window.document.getElementById('accessDenied').style.display === 'block',
    cardTitle: () => window.document.getElementById('accessDeniedTitle').textContent,
    cardText: () => window.document.getElementById('accessDeniedMessage').textContent,
    retryVisible: () => window.document.getElementById('accessRetryBtn').style.display !== 'none',
    close: () => { try { window.close(); } catch (error) {} },
    setDoc: (key, value) => { docs[key] = value; }
  };
}

(async () => {
  /* ------------------------------------------------------------ signed out */
  {
    const portal = await bootPortal({ user: null });
    await portal.signIn(null);
    t('signed out: the access card is shown, not the report', portal.cardVisible() && !portal.portalVisible());
    t('signed out: the message points at the one Prayer Dome sign-in',
      /sign in on prayer dome first/i.test(portal.cardText()), portal.cardText());
    t('signed out: nothing is remembered', portal.session() === null);
    portal.close();
  }

  /* ------------------------------------------------- finance in memberships */
  {
    const portal = await bootPortal({
      user: FINANCE_USER,
      docs: { 'memberships/f1': { role: 'finance', fullName: 'Finance Lead' }, 'users/f1': { role: 'finance' } }
    });
    await portal.signIn(FINANCE_USER);
    t('finance role (memberships): the report opens', portal.portalVisible() && !portal.cardVisible());
    const session = portal.session();
    t('finance role (memberships): the verified session is remembered',
      !!session && session.uid === FINANCE_USER.uid && session.role === 'finance');
    t('finance role (memberships): the report date is pre-filled',
      !!portal.document.getElementById('reportDate').value);
    portal.close();
  }

  /* -------------------------------------------------------- admin override */
  {
    const portal = await bootPortal({
      user: FINANCE_USER,
      docs: { 'memberships/f1': { role: 'admin' }, 'users/f1': { role: 'admin' } }
    });
    await portal.signIn(FINANCE_USER);
    t('an admin opens the finance portal too', portal.portalVisible() &&
      portal.session() && portal.session().role === 'admin');
    portal.close();
  }

  /* -------------------------------------------------- users/<uid> fallback */
  {
    const portal = await bootPortal({
      user: FINANCE_USER,
      docs: { 'memberships/f1': { role: 'member' }, 'users/f1': { role: 'finance' } }
    });
    await portal.signIn(FINANCE_USER);
    t('a finance role stored on users/<uid> also opens the portal', portal.portalVisible());
    portal.close();
  }

  /* ----------------------------------------------------------- plain member */
  {
    const portal = await bootPortal({
      user: MEMBER_USER,
      docs: { 'memberships/m1': { role: 'member' }, 'users/m1': { role: 'member' } }
    });
    await portal.signIn(MEMBER_USER);
    t('a member is blocked with the restricted message',
      portal.cardVisible() && portal.cardTitle() === 'Access Denied' &&
      /restricted to Finance Department personnel/i.test(portal.cardText()));
    t('a member has no retry button (the answer is final)', !portal.retryVisible());
    t('a member has no remembered session', portal.session() === null);
    portal.close();
  }

  /* ------------------------------------------- Firestore down, no session yet */
  {
    const portal = await bootPortal({
      user: FINANCE_USER,
      docs: { 'memberships/f1': 'error', 'users/f1': 'error' }
    });
    await portal.signIn(FINANCE_USER);
    t('outage without a session: not reported as “Access Denied”',
      portal.cardVisible() && portal.cardTitle() !== 'Access Denied', portal.cardTitle());
    t('outage without a session: the visitor is told to check the connection and retry',
      /could not reach prayer dome/i.test(portal.cardText()) && portal.retryVisible(), portal.cardText());
    t('outage without a session: no session is written', portal.session() === null);
    portal.close();
  }

  /* ------------------------------- Firestore down, device already verified */
  {
    const portal = await bootPortal({
      user: FINANCE_USER,
      session: financeSession(),
      docs: { 'memberships/f1': 'error', 'users/f1': 'error' }
    });
    await portal.signIn(FINANCE_USER);
    t('outage with a verified device: the portal stays open', portal.portalVisible() && !portal.cardVisible());
    t('outage with a verified device: nothing is cleared', !!portal.session());
    portal.close();
  }

  /* -------------------------------------------------- stale remembered session */
  {
    const portal = await bootPortal({
      user: FINANCE_USER,
      session: financeSession({ timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000 }),
      docs: { 'memberships/f1': { role: 'member' }, 'users/f1': { role: 'member' } }
    });
    await portal.signIn(FINANCE_USER);
    t('an expired device session does not open the portal', portal.cardVisible() && !portal.portalVisible());
    t('an expired device session is cleared', portal.session() === null);
    portal.close();
  }

  /* ------------------------------------------ reload with remembered session */
  {
    const portal = await bootPortal({
      user: FINANCE_USER,
      session: financeSession(),
      docs: {
        'memberships/f1': () => new Promise((resolve) => setTimeout(() => resolve(snapshot({ role: 'finance' })), 2500)),
        'users/f1': () => new Promise((resolve) => setTimeout(() => resolve(snapshot({ role: 'finance' })), 2500))
      }
    });
    const signIn = portal.signIn(FINANCE_USER);
    t('reload: the remembered session shows the report while Firestore is still answering',
      portal.portalVisible() && !portal.cardVisible());
    await signIn;
    t('reload: the background check keeps the report open', portal.portalVisible());
    portal.close();
  }

  /* ------------------------------------------- role removed while open */
  {
    const portal = await bootPortal({
      user: FINANCE_USER,
      docs: { 'memberships/f1': { role: 'finance' }, 'users/f1': { role: 'finance' } }
    });
    await portal.signIn(FINANCE_USER);
    t('revocation: the portal is open before the role is removed', portal.portalVisible());
    portal.setDoc('memberships/f1', { role: 'member' });
    portal.setDoc('users/f1', { role: 'member' });
    await portal.window.recheckFinanceAccess();
    t('revocation: re-checking blocks a demoted account',
      portal.cardVisible() && !portal.portalVisible(), `${portal.cardTitle()} / ${portal.cardText()}`);
    t('revocation: the remembered session is dropped',
      portal.session() === null);
    portal.close();
  }

  console.log(`\nFinance portal access checks passed (${passed} assertions).`);
  process.exit(process.exitCode || 0);
})().catch((error) => {
  console.error('FAIL  finance access suite crashed:', error);
  process.exit(1);
});
