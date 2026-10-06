/*
 * Chat moderation role continuity (jsdom, real chat.html module).
 *
 * The chat room used to decide "is this account an administrator?" with one
 * Firestore read inside a single try/catch: a hiccup silently removed the
 * Admin button and every Delete action, and a reload asked Firestore again even
 * though the device had been verified already. The page now uses the shared
 * role layer (PDApp.roles) — durable session first, then memberships/<uid> and
 * users/<uid> with retries — so these checks drive the real auth state machine:
 *
 *   • a verified device keeps the moderation tools before (and through) a
 *     slow or unreachable Firestore,
 *   • memberships/<uid> and users/<uid> are both honoured,
 *   • a member, or an outage on a device that never proved the role, gets no
 *     tools and cannot delete anything,
 *   • a live revocation removes the tools (and the rendered Delete badges),
 *   • signing out forgets the shared session.
 *
 *   npm install --no-save jsdom
 *   node tests/chat-admin.test.js
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CHAT_HTML = fs.readFileSync(path.join(ROOT, 'chat.html'), 'utf8');
const PD_APP = fs.readFileSync(path.join(ROOT, 'assets', 'pd-app.js'), 'utf8');
const PD_ICONS = fs.readFileSync(path.join(ROOT, 'assets', 'pd-icons.js'), 'utf8');
const ADMIN_SESSION_KEY = 'pd_admin_session';

let passed = 0;
function t(name, ok, extra = '') {
  if (ok) { passed += 1; console.log('PASS  ' + name); }
  else { console.error('FAIL  ' + name + (extra ? '  ' + extra : '')); process.exitCode = 1; }
}

let JSDOM;
let VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
catch (error) {
  console.log('SKIP  jsdom is not installed — run: npm install --no-save jsdom');
  process.exit(0);
}

const MODULE_SOURCE = (() => {
  const code = CHAT_HTML.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const replacements = [
    [/^\s*import \{([^}]+)\} from "[^"]*firebase-app\.js";/m, 'const {$1} = window.__fb.app;'],
    [/^\s*import \{([^}]+)\} from "[^"]*firebase-firestore\.js";/m, 'const {$1} = window.__fb.firestore;'],
    [/^\s*import \{([^}]+)\} from "[^"]*firebase-auth\.js";/m, 'const {$1} = window.__fb.auth;'],
    [/^\s*import \{([^}]+)\} from "[^"]*firebase-storage\.js";/m, 'const {$1} = window.__fb.storage;']
  ];
  let transformed = code;
  for (const [pattern, replacement] of replacements) {
    assert.match(transformed, pattern, 'chat module import shape changed');
    transformed = transformed.replace(pattern, replacement);
  }
  return transformed;
})();

const ADMIN = { uid: 'a1', email: 'lead@prayerdome.net', displayName: 'Lead Admin' };
const MEMBER = { uid: 'm1', email: 'member@prayerdome.net', displayName: 'Member' };
const DAY = 24 * 60 * 60 * 1000;

function adminSession(overrides = {}) {
  const now = Date.now();
  return Object.assign({
    version: 2, uid: ADMIN.uid, email: ADMIN.email, name: 'Lead Admin', role: 'admin',
    source: 'memberships', timestamp: now, verifiedAt: now, seenAt: now
  }, overrides);
}

function docSnapshot(data) {
  return { exists: () => data !== null && data !== undefined, data: () => data || {} };
}

const MESSAGES_PATH = 'groupMessages_general/general/messages';

function momentStub() {
  const chain = () => ({
    format: () => '2026-01-01', fromNow: () => 'just now', calendar: () => 'Today',
    toDate: () => new Date(), add: () => chain(), subtract: () => chain(), valueOf: () => Date.now()
  });
  const api = () => chain();
  api.locale = () => chain();
  return api;
}

async function bootChat(options = {}) {
  const docs = Object.assign({}, options.docs);
  const calls = { deleteDoc: 0, alerts: [], toasts: [] };
  const watchers = {};          // path -> snapshot callback
  const unsubscribed = [];
  const pending = [];

  // Signing out leaves the page for account.html; jsdom cannot navigate, and
  // that single "not implemented" line is not a failure of the page.
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    if (!/Not implemented/.test(String(error && error.message))) console.error(error && error.message);
  });

  const dom = new JSDOM(CHAT_HTML, {
    url: 'https://prayerdome.net/chat.html',
    runScripts: 'outside-only',
    virtualConsole,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({
        matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}
      }));
      window.scrollTo = () => {};
      window.alert = (message) => calls.alerts.push(String(message));
      window.confirm = () => true;
      window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 16);
      window.cancelAnimationFrame = (id) => window.clearTimeout(id);
      window.HTMLCanvasElement.prototype.getContext = () => ({
        setTransform() {}, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {},
        stroke() {}, fill() {}, closePath() {}, clearRect() {}, fillRect() {}, arc() {},
        measureText: () => ({ width: 0 }), fillText() {}, drawImage() {}
      });
      window.console.error = () => {};
      window.console.warn = () => {};
      window.moment = momentStub();
      // jsdom has no Notification API; the page only raises one when granted.
      window.Notification = function Notification() {};
      window.Notification.permission = 'denied';
      window.Notification.requestPermission = () => Promise.resolve('denied');
    }
  });

  const { window } = dom;
  window.eval(PD_ICONS); // the real icon runtime (room labels resolve icons)
  window.eval(PD_APP);   // the real shared layer + PDApp.roles

  const pathOf = (ref) => (ref && ref.path) || 'unknown';
  const resolveDoc = (ref) => {
    const key = pathOf(ref);
    const value = Object.prototype.hasOwnProperty.call(docs, key) ? docs[key] : null;
    if (value === 'error') return Promise.reject(new Error('Firestore unavailable'));
    if (typeof value === 'function') return value();
    return Promise.resolve(docSnapshot(value));
  };
  const docRef = (db, ...parts) => ({ path: parts.join('/'), collectionName: parts[0], id: parts[parts.length - 1] });
  const collectionRef = (db, ...parts) => ({ path: parts.join('/'), collectionName: parts[0] });

  window.__fb = {
    app: { initializeApp: () => ({}) },
    firestore: {
      getFirestore: () => ({}),
      collection: collectionRef,
      doc: docRef,
      getDoc: resolveDoc,
      setDoc: () => Promise.resolve(),
      updateDoc: () => Promise.resolve(),
      addDoc: () => Promise.resolve({ id: 'new' }),
      deleteDoc: () => { calls.deleteDoc += 1; return Promise.resolve(); },
      getDocs: () => { const p = Promise.resolve({ docs: [], size: 0, empty: true, forEach() {} }); pending.push(p); return p; },
      onSnapshot: (ref, cb) => {
        watchers[pathOf(ref)] = cb;
        return () => { unsubscribed.push(pathOf(ref)); delete watchers[pathOf(ref)]; };
      },
      query: (ref) => ref || {},
      orderBy: () => ({}),
      where: () => ({}),
      limit: () => ({}),
      serverTimestamp: () => ({}),
      increment: (n) => n,
      arrayUnion: () => ({}),
      arrayRemove: () => ({}),
      Timestamp: { now: () => ({}), fromDate: (d) => d, fromMillis: (n) => n }
    },
    auth: {
      getAuth: () => ({ currentUser: options.user || null }),
      onAuthStateChanged: (auth, callback) => { window.__authStateChanged = callback; return () => {}; },
      signOut: () => Promise.resolve()
    },
    storage: {
      getStorage: () => ({}),
      ref: () => ({}),
      uploadBytes: () => Promise.resolve({}),
      getDownloadURL: () => Promise.resolve('https://cdn.prayerdome.net/media.jpg')
    }
  };

  if (options.session) window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(options.session));
  else window.localStorage.removeItem(ADMIN_SESSION_KEY);

  await window.eval(`(async () => {\n${MODULE_SOURCE}\n})()`);

  const messageSnapshot = (messages) => ({
    forEach(cb) { messages.forEach((msg) => cb({ id: msg.id, data: () => msg })); }
  });

  return {
    window,
    document: window.document,
    calls,
    session: () => {
      try { return JSON.parse(window.localStorage.getItem(ADMIN_SESSION_KEY) || 'null'); }
      catch (error) { return null; }
    },
    /* Kick the real auth flow off without waiting for Firestore. */
    signInStarted: (user) => window.__authStateChanged(user),
    signIn: async (user) => { await window.__authStateChanged(user); },
    adminButton: () => window.document.getElementById('chatAdminBtn'),
    renderMessages: (messages) => window.renderMessages(messages),
    messagesHtml: () => window.document.getElementById('messagesArea').innerHTML,
    deleteMessage: (id) => window.deleteMessage(id),
    emitDoc: (path, data) => { if (watchers[path]) watchers[path](docSnapshot(data)); },
    emitMessages: (messages) => { if (watchers[MESSAGES_PATH]) watchers[MESSAGES_PATH](messageSnapshot(messages)); },
    watchedPaths: () => Object.keys(watchers),
    unsubscribed,
    setDoc: (path, value) => { docs[path] = value; },
    /* Let the page's un-awaited post-sign-in work settle before the window is
       torn down, so a half-finished handler cannot report a phantom error. */
    close: async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      try { window.close(); } catch (error) {}
    }
  };
}

const thread = [
  { id: 'm2', userId: MEMBER.uid, userName: 'Member', text: 'Praying for you' },
  { id: 'm3', userId: 'someone', userName: 'Someone', text: 'Amen' }
];

(async () => {
  /* ----------------------------------- remembered device, slow Firestore */
  {
    const chat = await bootChat({
      user: ADMIN,
      session: adminSession(),
      docs: {
        'memberships/a1': () => new Promise((resolve) => setTimeout(() => resolve(docSnapshot({ role: 'admin' })), 400)),
        'users/a1': () => new Promise((resolve) => setTimeout(() => resolve(docSnapshot({ role: 'admin' })), 400))
      }
    });
    const signIn = chat.signInStarted(ADMIN);
    t('a verified device shows the Admin tools before Firestore answers', !!chat.adminButton());
    await signIn;
    t('the moderation tools survive the Firestore confirmation', !!chat.adminButton());
    t('the shared session is refreshed, still in the console’s shape',
      !!chat.session() && chat.session().role === 'admin' &&
      chat.session().verifiedAt >= chat.session().timestamp - 1);
    t('the page keeps a live watch on the membership document',
      chat.watchedPaths().includes('memberships/a1'));
    chat.emitMessages(thread);
    t('an admin sees a Delete badge on other people’s messages',
      chat.messagesHtml().includes('Delete'));
    await chat.close();
  }

  /* ------------------------------------------------- memberships vs users */
  {
    const chat = await bootChat({
      user: ADMIN,
      docs: { 'memberships/a1': { role: 'member' }, 'users/a1': { role: 'admin' } }
    });
    await chat.signIn(ADMIN);
    t('a role granted on users/<uid> also opens the moderation tools', !!chat.adminButton());
    await chat.close();
  }

  /* ------------------------------------------------- Firestore is unreachable */
  {
    const chat = await bootChat({
      user: ADMIN,
      session: adminSession(),
      docs: { 'memberships/a1': 'error', 'users/a1': 'error' }
    });
    await chat.signIn(ADMIN);
    t('an outage never takes the tools away from a verified device', !!chat.adminButton());
    t('the remembered session is kept through the outage', !!chat.session());
    chat.emitMessages(thread);
    t('the Delete badges are still offered during the outage',
      chat.messagesHtml().includes('Delete'));
    await chat.close();
  }
  {
    const chat = await bootChat({ user: MEMBER, docs: { 'memberships/m1': 'error', 'users/m1': 'error' } });
    await chat.signIn(MEMBER);
    t('an outage on a device that never proved the role shows no tools', !chat.adminButton());
    await chat.deleteMessage('m3');
    t('a member cannot delete a message by confirming a dialog',
      chat.calls.deleteDoc === 0);
    await chat.close();
  }

  /* --------------------------------------------------- plain member account */
  {
    // The remembered session belongs to a different account (a1), and this
    // device is signed in as a plain member.
    const chat = await bootChat({
      user: MEMBER,
      session: adminSession(),
      docs: { 'memberships/m1': { role: 'member' }, 'users/m1': { role: 'member' } }
    });
    const signIn = chat.signInStarted(MEMBER);
    t('another account’s remembered session never paints this member’s tools', !chat.adminButton());
    await signIn;
    t('a plain member is confirmed without moderation tools', !chat.adminButton());
    t('the stale session from the other account is dropped', chat.session() === null);
    await chat.close();
  }

  /* ---------------------------------------------------------- live revocation */
  {
    const chat = await bootChat({
      user: ADMIN,
      docs: { 'memberships/a1': { role: 'admin' }, 'users/a1': { role: 'admin' } }
    });
    await chat.signIn(ADMIN);
    chat.emitMessages(thread);
    t('the admin starts with the Delete badges', !!chat.adminButton() && chat.messagesHtml().includes('Delete'));
    chat.setDoc('memberships/a1', { role: 'member' });
    chat.setDoc('users/a1', { role: 'member' });
    chat.emitDoc('memberships/a1', { role: 'member' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    t('a revoked admin loses the Admin button', !chat.adminButton());
    t('the already-rendered Delete badges disappear too', !chat.messagesHtml().includes('Delete'));
    t('the revoked session is forgotten', chat.session() === null);
    await chat.deleteMessage('m3');
    t('a revoked admin can no longer delete messages', chat.calls.deleteDoc === 0);
    await chat.close();
  }
  {
    const chat = await bootChat({
      user: ADMIN,
      docs: { 'memberships/a1': { role: 'member' }, 'users/a1': { role: 'member' } }
    });
    await chat.signIn(ADMIN);
    chat.emitDoc('memberships/a1', { role: 'admin' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    t('a role granted while the page is open appears immediately', !!chat.adminButton());
    await chat.close();
  }

  /* ------------------------------------------------------------ signing out */
  {
    const chat = await bootChat({
      user: ADMIN,
      session: adminSession(),
      docs: { 'memberships/a1': { role: 'admin' }, 'users/a1': { role: 'admin' } }
    });
    await chat.signIn(ADMIN);
    t('the session exists before signing out', !!chat.session());
    await chat.signIn(null);
    t('signing out forgets the shared admin session', chat.session() === null);
    t('signing out releases the role watch', chat.unsubscribed.includes('memberships/a1'));
    await chat.close();
  }

  console.log(`\nChat moderation role checks passed (${passed} assertions).`);
  process.exit(process.exitCode || 0);
})().catch((error) => {
  console.error('FAIL  chat moderation suite crashed:', error);
  process.exit(1);
});
