/*
 * Admin console shell checks (jsdom).
 *
 * The console is a full-screen app shell with its own sidebar. Two bugs made it
 * look like the menu "did not move" when a page was clicked:
 *
 *   1. the shared marketing layer (assets/pd-app.js) injected its topbar, drawer
 *      and footer into the console, adding a second menu on top of the sidebar
 *      (the sidebar sits at z-index 100, the injected header at 900);
 *   2. the dashboard shortcuts highlighted the wrong sidebar item because they
 *      looked items up by their position in the list.
 *
 * These checks load the real pages in jsdom, run the real shared layer and
 * assert the console keeps exactly one navigation, while the marketing pages
 * still get theirs. They also unit-test the pdNavFor() resolver that every menu
 * click now goes through.
 *
 *   npm install --no-save jsdom
 *   node tests/admin-menu.test.js
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

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (error) {
  console.log('SKIP  jsdom is not installed — run: npm install --no-save jsdom');
  process.exit(0);
}

// The shared layer is a classic script; run it in a page and let PDApp.init()
// do exactly what it does in the browser.
function bootPage(file, url) {
  const dom = new JSDOM(read(file), {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({
        matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}
      }));
      window.scrollTo = () => {};
      window.PDApp = undefined;
    }
  });
  const { window } = dom;
  window.eval(read('assets/pd-content-data.js'));
  window.eval(read('assets/pd-app.js'));
  window.PDApp.init();
  return window;
}

/* ------------------------------------------- 1. the console keeps one menu */
const adminWindow = bootPage('admin.html', 'https://prayerdome.net/admin.html');
const adminDoc = adminWindow.document;

t('the shared layer does not inject a marketing topbar into the console',
  !adminDoc.querySelector('.pd-topbar'), 'a second header would sit above the sidebar');
t('the shared layer does not inject a site drawer into the console',
  !adminDoc.getElementById('pdDrawer') && !adminDoc.querySelector('.pd-drawer'));
t('the shared layer does not inject a site footer into the console',
  !adminDoc.querySelector('.pd-footer'));
t('the console keeps its single sidebar navigation',
  adminDoc.querySelectorAll('.sidebar .nav-menu').length === 1 &&
  adminDoc.querySelectorAll('.sidebar .nav-item').length >= 25,
  adminDoc.querySelectorAll('.sidebar .nav-item').length + ' items');
t('the console keeps no site menu button that would open a foreign menu',
  !adminDoc.getElementById('pdMenuBtn'));
t('the sidebar scrim exists for tap-to-close on mobile',
  adminDoc.getElementById('sidebarScrim') && adminDoc.body.contains(adminDoc.getElementById('sidebarScrim')));
t('the sign-in card is hidden until access is actually denied',
  adminDoc.getElementById('loginModal').style.display === 'none');
t('the console ships the PWA worker registration through the shared layer',
  typeof adminWindow.PDApp.pwa.register === 'function' &&
  adminWindow.PDApp.layout.enabled() === false);

/* ------------------------------- 2. marketing pages still get their chrome */
const homeWindow = bootPage('index.html', 'https://prayerdome.net/');
const homeDoc = homeWindow.document;
t('the home page still receives the shared topbar, drawer and footer',
  !!homeDoc.querySelector('.pd-topbar') && !!homeDoc.getElementById('pdDrawer') &&
  !!homeDoc.querySelector('.pd-footer'));
t('layout.enabled() still returns true for marketing pages',
  homeWindow.PDApp.layout.enabled() === true);

/* --------------------------------------- 3. pdNavFor resolves the right item */
const moduleScript = read('admin.html').match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const start = moduleScript.indexOf('window.pdNavFor =');
assert.ok(start !== -1, 'pdNavFor must be defined in the admin module');
let depth = 0;
let end = -1;
for (let index = moduleScript.indexOf('{', start); index < moduleScript.length; index += 1) {
  if (moduleScript[index] === '{') depth += 1;
  else if (moduleScript[index] === '}') { depth -= 1; if (depth === 0) { end = index + 1; break; } }
}
const pdNavForSource = moduleScript.slice(start, end);
adminWindow.eval(pdNavForSource);

const navFor = adminWindow.pdNavFor;
t('pdNavFor is installed as a global for the inline menu handlers', typeof navFor === 'function');
t('pdNavFor finds an item by view id',
  navFor('members') && navFor('members').getAttribute('data-view') === 'members');
t('pdNavFor finds the dashboard item that also carries the active class',
  navFor('dashboard') && navFor('dashboard').classList.contains('active'));
t('pdNavFor passes a clicked nav element straight through',
  navFor(adminDoc.querySelector('.nav-item[data-view="news"]')).getAttribute('data-view') === 'news');
t('pdNavFor returns null for unknown or empty input',
  navFor('does-not-exist') === null && navFor() === null && navFor('') === null);

/* ----------------- picker sanity: the shortcuts point at the right menu items */
const html = read('admin.html');
const shortcutPairs = [...html.matchAll(/switchView\('([a-z_-]+)', pdNavFor\('([a-z_-]+)'\)\)/g)];
t('every shortcut asks for the same view it opens',
  shortcutPairs.length > 0 && shortcutPairs.every((match) => match[1] === match[2]),
  shortcutPairs.filter((match) => match[1] !== match[2]).map((match) => match[0]).join(' | '));
t('the Publish News shortcut now highlights News Center, not another item',
  /switchView\('news', pdNavFor\('news'\)\)/.test(html) && !html.includes("querySelectorAll('.nav-item')["));
t('every sidebar item maps to a view panel (Team Management opens a page)',
  [...html.matchAll(/data-view="([a-z_-]+)"/g)]
    .every((match) => match[1] === 'team' || html.includes(`id="view-${match[1]}"`)));

console.log(`\nAdmin console shell checks passed (${passed} assertions).`);

// jsdom keeps timers and BroadcastChannel handles alive: close the pages and
// exit with the assertion result.
try { adminWindow.close(); homeWindow.close(); } catch (error) { /* already closed */ }
process.exit(process.exitCode || 0);
