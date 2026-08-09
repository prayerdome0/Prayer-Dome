/*
 * Smoke test for the Weekly Prayer Challenge card on the home page.
 * Runs the real index.html module script in jsdom with stubbed Firebase/CDN
 * imports and verifies the card renders, persists and updates.
 *
 * Requires jsdom (same as pages.test.js / premium.test.js):
 *   npm install --no-save jsdom
 *   node tests/challenge.test.js
 */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function t(name, ok, extra) {
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  ' + extra : ''));
}

try {
  require('jsdom');
} catch (e) {
  console.log('SKIP  jsdom not installed — run: npm install --no-save jsdom');
  process.exit(0);
}

const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'https://prayerdome.net/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.matchMedia = window.matchMedia || function () {
      return { matches: false, addListener() {}, removeListener() {} };
    };
    window.scrollTo = () => {};
    window.confetti = () => {};
    window.moment = (d) => ({ format: () => String(d), toDate: () => new Date(d) });
  }
});
const w = dom.window;
w.eval(fs.readFileSync(path.join(ROOT, 'assets/pd-content-data.js'), 'utf8'));
w.eval(fs.readFileSync(path.join(ROOT, 'assets/pd-motion.js'), 'utf8'));

// Stub Firebase/CDN imports: strip import lines and inject fake APIs.
let inline = [...w.document.querySelectorAll('script[type="module"]')]
  .map(s => s.textContent).join('\n');
inline = inline
  .replace(/import\s*\{[^}]*\}\s*from\s*"[^"]*";?/g, '')
  .replace(/import\s*\{[^}]*\}\s*from\s*'[^']*';?/g, '')
  .replace(/import\s*[^;]*?from\s*"[^"]*";?/g, '')
  .replace(/import\s*[^;]*?from\s*'[^']*';?/g, '');

const api = {
  initializeApp: () => ({}),
  getFirestore: () => ({}),
  getAuth: () => ({ currentUser: null, onAuthStateChanged: () => {} }),
  onAuthStateChanged: () => {},
  doc: () => ({}),
  getDoc: async () => ({ exists: () => false }),
  setDoc: async () => {},
  updateDoc: async () => {},
  addDoc: async () => {},
  getDocs: async () => ({ empty: true, docs: [] }),
  query: () => ({}), orderBy: () => ({}), limit: () => ({}), where: () => ({}),
  collection: () => ({}),
  serverTimestamp: () => new Date(),
  Timestamp: { now: () => new Date(), fromDate: (d) => new Date(d) },
  deleteDoc: async () => {},
  increment: n => n
};
for (const k of Object.keys(api)) w[k] = api[k];
w.getDailyDevotional = () => ({});
w.getNextUpdateTime = () => new Date();
w.formatCountdown = () => '--:--';
w.branches = [];
w.PDApp = {
  setFirestore() {}, on() {}, location: { state: null }, ui: {}, live: {},
  i18n: { t: () => '' }, news: { list: () => [] }, notifications: {}
};

try {
  w.eval(inline);
  if (w.PDChallenge && w.PDChallenge.init) w.PDChallenge.init(); // DOMContentLoaded already fired in jsdom
  const d = w.document;
  const challenge = w.PDChallenge;
  t('PDChallenge global exposed', typeof challenge === 'object');
  t('challenge title rendered from data pool',
    (d.getElementById('challengeTitle')?.textContent || '').includes('Week of'));
  t('challenge focus rendered',
    (d.getElementById('challengeFocus')?.textContent || '').length > 20);
  t('challenge verse + reference rendered',
    (d.getElementById('challengeVerse')?.textContent || '').includes('“') &&
    (d.getElementById('challengeVerseRef')?.textContent || '').startsWith('—'));
  t('7 day chips rendered', d.querySelectorAll('#challengeDays .pd-challenge-day').length === 7);
  t('progress ring initialised', (d.getElementById('challengeRingFg')?.style.strokeDashoffset || '') !== '');
  t('pray button has label', (d.getElementById('challengePrayTodayLabel')?.textContent || '').includes('I prayed today'));
  t('week dates shown', (d.getElementById('challengeDates')?.textContent || '').includes('—'));

  challenge.prayToday();
  const saved = JSON.parse(w.localStorage.getItem('pd_challenge_' + challenge.weekKey));
  t('prayToday persists to localStorage', saved && saved.days[challenge.todayIndex] === true);
  t('button flips to done state', (d.getElementById('challengePrayTodayLabel')?.textContent || '').includes('Done for today'));
  t('done count updates', d.getElementById('challengeDoneCount')?.textContent === '1');
  challenge.prayToday(); // restore
} catch (e) {
  fail++;
  console.log('FAIL  exception: ' + e.stack);
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
