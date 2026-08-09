/*
 * Smoke test for the premium app layer (assets/pd-app.js) against the real
 * home page DOM: splash, drawer, location card, marquee, notification center,
 * language selector, featured scripture and community stats.
 *
 * Requires jsdom (same as pages.test.js):
 *   npm install --no-save jsdom
 *   node tests/premium.test.js
 */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

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
  }
});
const { window } = dom;
window.eval(fs.readFileSync(path.join(ROOT, 'assets/pd-content-data.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(ROOT, 'assets/pd-app.js'), 'utf8'));

setTimeout(() => {
  const doc = window.document;
  try {
    t('splash screen exists', !!doc.getElementById('pdSplash'));
    t('drawer navigation exists', !!doc.getElementById('pdDrawer'));
    t('live location card exists', !!doc.getElementById('pdLocationCard'));
    t('moving announcement bar exists', !!doc.getElementById('pdAnnouncementBar'));
    t('marquee renders seeded announcements',
      (doc.querySelector('.pd-marquee-track')?.innerHTML || '').includes('Welcome to Prayer Dome'));
    t('notification panel exists', !!doc.getElementById('pdNotifPanel'));
    t('language selector exists', !!doc.querySelector('.pd-lang-select'));
    t('featured scripture card renders Mark 7:37',
      (doc.querySelector('[data-pd-scripture]')?.innerHTML || '').includes('Mark 7:37'));
    t('splash verse renders Mark 7:37',
      (doc.querySelector('#pdSplash .pd-scripture-ref')?.textContent || '').includes('Mark 7:37'));
    t('weekly prayer challenge card exists on the home page',
      !!doc.getElementById('weeklyChallenge'));
    t('weekly challenge data engine returns a challenge for any week',
      typeof window.PD_CONTENT.getWeeklyChallenge === 'function' &&
      !!window.PD_CONTENT.getWeeklyChallenge(new Date()) &&
      window.PD_CONTENT.WEEKLY_CHALLENGES.length >= 8);
    t('PDApp global is available', typeof window.PDApp === 'object' && typeof window.PDApp.init === 'function');
    t('i18n resolves English strings', window.PDApp.i18n.t('nav.home') === 'Home');
    window.PDApp.i18n.set('bem');
    t('i18n switches to Bemba', window.PDApp.i18n.t('nav.home') === 'Pa\u0175ulu');
    window.PDApp.i18n.set('en');
    t('live module exposes status API', typeof window.PDApp.live.setStatus === 'function');
    t('news module exposes publish API', typeof window.PDApp.news.publish === 'function');
    t('notifications module exposes push API', typeof window.PDApp.notifications.push === 'function');
    window.PDApp.ui.toggleNotifPanel(true);
    t('notification panel opens', doc.getElementById('pdNotifPanel').classList.contains('open'));
    window.PDApp.notifications.push({ type: 'news', title: 'Smoke Test', message: 'Hello' });
    t('pushed notification renders in panel',
      doc.querySelectorAll('.pd-notif-item').length >= 1);
  } catch (e) {
    fail++;
    console.log('FAIL  exception: ' + e.message);
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}, 250);
