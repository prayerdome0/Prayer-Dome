/*
 * Shared role layer (assets/pd-app.js) — PDApp.roles.
 *
 * Every page that shows leadership tools must get the same answer, and it must
 * be the *right* answer:
 *
 *   • a device that already proved the admin (or finance) role keeps working
 *     through a reload and through a Firestore outage,
 *   • Firestore is still the truth — memberships/<uid> first, then users/<uid>
 *     (the two documents firestore.rules trusts) — and a flaky connection is
 *     never read as "not an administrator" (retries, tri-state),
 *   • a definite "no leadership role" drops the remembered session, so a
 *     revoked administrator loses the tools everywhere,
 *   • the role change is announced (`pd:role`) and watchable live.
 *
 * The static half of the file pins the pages onto that shared layer, so the
 * single-shot Firestore reads cannot creep back in.
 *
 *   npm install --no-save jsdom
 *   node tests/roles.test.js
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

let passed = 0;
function t(name, ok, extra = '') {
  if (ok) { passed += 1; console.log('PASS  ' + name); }
  else { console.error('FAIL  ' + name + (extra ? '  ' + extra : '')); process.exitCode = 1; }
}

const PD_APP = read('assets/pd-app.js');
const CHAT_HTML = read('chat.html');
const INDEX_HTML = read('index.html');
const ACCOUNT_HTML = read('account.html');
const ADMIN_SESSION_KEY = 'pd_admin_session';
const FINANCE_SESSION_KEY = 'pd_finance_session';
const ADMIN_USER = { uid: 'a1', email: 'lead@prayerdome.net', displayName: 'Lead Admin' };
const MEMBER_USER = { uid: 'm1', email: 'member@prayerdome.net', displayName: 'Member' };
const DAY = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------- static half */

t('pages ask the shared role layer instead of reading Firestore themselves',
  CHAT_HTML.includes('PDApp.roles.admin(') && CHAT_HTML.includes('PDApp.roles.remembered(') &&
  CHAT_HTML.includes('PDApp.roles.watch(') &&
  INDEX_HTML.includes('PDApp.roles.remembered(') && INDEX_HTML.includes('PDApp.roles.finance(') &&
  ACCOUNT_HTML.includes('PDApp.roles.remembered(') && ACCOUNT_HTML.includes('PDApp.roles.finance('));
t('the chat page hands its Firestore bindings to the shared layer',
  /PDApp\.setFirestore\(\{[^}]*onSnapshot[^}]*\}\)/.test(CHAT_HTML));
t('chat moderation is applied through one idempotent role function',
  CHAT_HTML.includes('function applyAdminRole(role)') &&
  CHAT_HTML.includes("document.getElementById('chatAdminBtn')") &&
  CHAT_HTML.includes('existing.remove()'));
t('a Firestore outage in chat never strips the moderation tools',
  /status === 'unknown'/.test(CHAT_HTML) && /applyAdminRole\(PDApp\.roles\.remembered\(user\) \|\| 'none'\)/.test(CHAT_HTML));
t('the chat Delete action is administrator-only',
  /if \(!isAdmin\) \{ showToast\("Only administrators can delete messages"/.test(CHAT_HTML));
t('the console hand-off on the account page uses the same role layer',
  /PDApp\.roles\.admin\(user\)/.test(ACCOUNT_HTML) && ACCOUNT_HTML.includes('trustedOffline'));
t('the home page reserves the install-banner slot',
  INDEX_HTML.includes('<div data-pd-install-banner></div>'));

/* -------------------------------------------------------- behavioural half */

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (error) {
  console.log('SKIP  jsdom is not installed — run: npm install --no-save jsdom');
  process.exit(0);
}

function snapshot(data) {
  return { exists: () => data !== null && data !== undefined, data: () => data || {} };
}

/* Boots the real shared layer in jsdom with stubbed Firebase bindings. */
function bootLayer(options = {}) {
  const docs = Object.assign({}, options.docs);
  const calls = { signedOut: 0 };
  const roleEvents = [];
  const watchers = {};          // 'collection/id' -> snapshot callback
  const unsubscribed = [];

  const dom = new JSDOM('<!doctype html><html><body><div data-pd-install-banner></div></body></html>', {
    url: 'https://prayerdome.net/index.html',
    runScripts: 'outside-only',
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({
        matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}
      }));
      window.scrollTo = () => {};
      // A plain timer instead of jsdom's own animation-frame loop: the shared
      // layer animates a few things, and the loop would keep ticking after the
      // window is closed.
      window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 16);
      window.cancelAnimationFrame = (id) => window.clearTimeout(id);
    }
  });

  const { window } = dom;
  window.eval(PD_APP);

  const keyOf = (ref) => `${ref.collectionName}/${ref.id}`;
  const resolveDoc = (ref) => {
    const key = keyOf(ref);
    const value = Object.prototype.hasOwnProperty.call(docs, key) ? docs[key] : null;
    if (value === 'error') return Promise.reject(new Error('Firestore unavailable'));
    if (typeof value === 'function') return value();
    return Promise.resolve(snapshot(value));
  };

  if (options.bindings !== false) {
    window.PDApp.setFirestore({
      db: {},
      doc: (db, collectionName, id) => ({ collectionName, id }),
      getDoc: resolveDoc,
      setDoc: () => Promise.resolve(),
      updateDoc: () => Promise.resolve(),
      collection: () => ({}),
      query: () => ({}),
      orderBy: () => ({}),
      limit: () => ({}),
      getDocs: () => Promise.resolve({ docs: [], size: 0, empty: true, forEach() {} }),
      onSnapshot: (ref, cb) => {
        watchers[keyOf(ref)] = cb;
        return () => { unsubscribed.push(keyOf(ref)); delete watchers[keyOf(ref)]; };
      },
      serverTimestamp: () => ({}),
      auth: { signOut: () => Promise.resolve() }
    });
  }

  window.document.addEventListener('pd:role', (event) => roleEvents.push(event.detail));
  if (options.session) window.localStorage.setItem(options.session.key, JSON.stringify(options.session.value));

  return {
    window,
    roleEvents,
    calls,
    session: (key = ADMIN_SESSION_KEY) => {
      try { return JSON.parse(window.localStorage.getItem(key) || 'null'); }
      catch (error) { return null; }
    },
    /* Deliver a live snapshot to whatever PDApp.roles.watch() subscribed. */
    emit: (key, data) => { if (watchers[key]) watchers[key](snapshot(data)); },
    unsubscribed,
    setDoc: (key, value) => { docs[key] = value; },
    close: () => { try { window.close(); } catch (error) {} }
  };
}

function rememberedSession(overrides = {}) {
  return Object.assign({
    version: 2, uid: ADMIN_USER.uid, email: ADMIN_USER.email, name: 'Lead Admin',
    role: 'admin', source: 'memberships', timestamp: Date.now(), verifiedAt: Date.now()
  }, overrides);
}

(async () => {
  /* ------------------------------------------------------- remembered only */
  {
    const layer = bootLayer({ bindings: false, session: { key: ADMIN_SESSION_KEY, value: rememberedSession() } });
    t('a verified device is remembered without asking Firestore',
      layer.window.PDApp.roles.remembered(ADMIN_USER) === 'admin');
    t('with no Firestore bindings the answer is “unknown”, never a denial',
      (await layer.window.PDApp.roles.admin(ADMIN_USER)) === 'unknown');
    t('nothing is remembered for a signed-out visitor',
      layer.window.PDApp.roles.remembered(null) === null);
    t('a signed-out visitor resolves to “none”',
      (await layer.window.PDApp.roles.admin(null)) === 'none');
    layer.close();
  }

  /* ------------------------------------------------------ admin in memberships */
  {
    const layer = bootLayer({
      docs: { 'memberships/a1': { role: 'admin', fullName: 'Lead Admin' }, 'users/a1': { role: 'member' } }
    });
    const status = await layer.window.PDApp.roles.admin(ADMIN_USER);
    t('memberships/<uid>.role=admin grants admin', status === 'admin');
    const admin = layer.session(ADMIN_SESSION_KEY);
    t('the shared console session is written in the shape the console reads',
      !!admin && admin.uid === ADMIN_USER.uid && admin.role === 'admin' && admin.version === 2 &&
      typeof admin.verifiedAt === 'number' && admin.source === 'memberships');
    const finance = layer.session(FINANCE_SESSION_KEY);
    t('one verified role also opens the finance portal instantly',
      !!finance && finance.role === 'admin');
    t('the resolution is announced on pd:role',
      layer.roleEvents.length === 1 && layer.roleEvents[0].admin === true && layer.roleEvents[0].finance === true);
    layer.close();
  }

  /* ---------------------------------------------- users/<uid> is the fallback */
  {
    const layer = bootLayer({
      docs: { 'memberships/a1': { role: 'member' }, 'users/a1': { role: 'admin' } }
    });
    t('an admin role stored on users/<uid> also grants admin',
      (await layer.window.PDApp.roles.admin(ADMIN_USER)) === 'admin');
    t('the remembered session records where the role came from',
      (layer.session().source) === 'users');
    layer.close();
  }

  /* ----------------------------------------------------------- finance role */
  {
    const layer = bootLayer({
      docs: { 'memberships/a1': { role: 'finance' }, 'users/a1': { role: 'finance' } }
    });
    t('the finance role resolves as finance', (await layer.window.PDApp.roles.finance(ADMIN_USER)) === 'finance');
    t('an admin also passes the finance check', (await layer.window.PDApp.roles.admin(ADMIN_USER)) === 'none');
    t('finance never writes an admin session', layer.session(ADMIN_SESSION_KEY) === null);
    t('finance is remembered in the portal’s own session key',
      (layer.session(FINANCE_SESSION_KEY) || {}).role === 'finance');
    layer.close();
  }

  /* ---------------------------------------------- admin passes finance check */
  {
    const layer = bootLayer({
      docs: { 'memberships/a1': { role: 'admin' }, 'users/a1': { role: 'admin' } }
    });
    t('the finance check accepts the admin role',
      (await layer.window.PDApp.roles.finance(ADMIN_USER)) === 'admin');
    layer.close();
  }

  /* ------------------------------------------------------------- revocation */
  {
    const layer = bootLayer({
      session: { key: ADMIN_SESSION_KEY, value: rememberedSession() },
      docs: { 'memberships/a1': { role: 'member' }, 'users/a1': { role: 'member' } }
    });
    t('a revoked administrator resolves to none',
      (await layer.window.PDApp.roles.admin(ADMIN_USER)) === 'none');
    t('the revoked device session is dropped',
      layer.session(ADMIN_SESSION_KEY) === null && layer.session(FINANCE_SESSION_KEY) === null);
    layer.close();
  }

  /* ----------------------------------------------------------- outage cases */
  {
    const layer = bootLayer({ docs: { 'memberships/a1': 'error', 'users/a1': 'error' } });
    t('an unreachable Firestore resolves to unknown, not a denial',
      (await layer.window.PDApp.roles.admin(ADMIN_USER)) === 'unknown');
    t('an outage writes no session', layer.session(ADMIN_SESSION_KEY) === null);
    layer.close();
  }
  {
    const layer = bootLayer({
      session: { key: ADMIN_SESSION_KEY, value: rememberedSession() },
      docs: { 'memberships/a1': 'error', 'users/a1': 'error' }
    });
    t('a verified device keeps its role through an outage',
      (await layer.window.PDApp.roles.admin(ADMIN_USER)) === 'unknown' &&
      layer.window.PDApp.roles.remembered(ADMIN_USER) === 'admin' &&
      !!layer.session(ADMIN_SESSION_KEY));
    layer.close();
  }
  {
    let first = true;
    const layer = bootLayer({
      docs: {
        'memberships/a1': () => {
          if (first) { first = false; return Promise.reject(new Error('flaky')); }
          return Promise.resolve(snapshot({ role: 'admin' }));
        },
        'users/a1': () => Promise.resolve(snapshot({ role: 'member' }))
      }
    });
    t('a flaky first attempt is retried instead of reported as “not an admin”',
      (await layer.window.PDApp.roles.admin(ADMIN_USER, { attempts: 2 })) === 'admin');
    layer.close();
  }

  /* ------------------------------------------------------------ stale/other */
  {
    const layer = bootLayer({
      session: { key: ADMIN_SESSION_KEY, value: rememberedSession({ timestamp: Date.now() - 8 * DAY, verifiedAt: Date.now() - 8 * DAY }) }
    });
    t('a device session older than the 7-day window is ignored',
      layer.window.PDApp.roles.remembered(ADMIN_USER) === null);
    layer.close();
  }
  {
    const layer = bootLayer({ session: { key: ADMIN_SESSION_KEY, value: rememberedSession({ uid: 'someone-else' }) } });
    t('another account’s remembered session never counts', layer.window.PDApp.roles.remembered(ADMIN_USER) === null);
    t('a member account can forget both remembered roles', (() => {
      layer.window.PDApp.roles.forget();
      return layer.session(ADMIN_SESSION_KEY) === null && layer.session(FINANCE_SESSION_KEY) === null;
    })());
    layer.close();
  }

  /* ------------------------------------------------------------ live watch */
  {
    const layer = bootLayer({ docs: { 'memberships/a1': { role: 'member' }, 'users/a1': { role: 'member' } } });
    const seen = [];
    const stop = layer.window.PDApp.roles.watch(ADMIN_USER, (role) => seen.push(role));
    t('watch() subscribes to the membership document', typeof stop === 'function');
    layer.emit('memberships/a1', { role: 'admin' });
    t('the role being granted live reaches the page', seen.includes('admin') &&
      layer.window.PDApp.roles.remembered(ADMIN_USER) === 'admin');
    layer.setDoc('users/a1', { role: 'admin' });
    layer.emit('memberships/a1', null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    t('removing the membership falls back to users/<uid> before acting',
      seen[seen.length - 1] === 'admin' && layer.session(ADMIN_SESSION_KEY) !== null);
    layer.setDoc('users/a1', { role: 'member' });
    layer.emit('memberships/a1', null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    t('a fully revoked role reaches the page as “none” and forgets the session',
      seen[seen.length - 1] === 'none' && layer.session(ADMIN_SESSION_KEY) === null);
    const before = seen.length;
    stop();
    layer.emit('memberships/a1', { role: 'admin' });
    t('unsubscribing stops the callbacks', seen.length === before);
    t('the watch was released', layer.unsubscribed.includes('memberships/a1'));
    layer.close();
  }
  {
    const layer = bootLayer({ bindings: false });
    t('without Firestore the watch degrades to null, so pages re-check on focus',
      layer.window.PDApp.roles.watch(ADMIN_USER, () => {}) === null);
    layer.close();
  }

  console.log(`\nShared role layer checks passed (${passed} assertions).`);
  process.exit(process.exitCode || 0);
})().catch((error) => {
  console.error('FAIL  shared role layer suite crashed:', error);
  process.exit(1);
});
