/*
 * Prayer Dome — global navigation regression suite (jsdom)
 * ===========================================================================
 * The menu used to be described in four places: the shared layout layer, an
 * "Academy nav" injector, the static markup of each page and the bottom bars.
 * Moving from Home to Games to Teachings therefore appeared to change the menu.
 *
 * These checks pin the fix down:
 *   1. assets/pd-nav.js is the only menu configuration and every destination
 *      points at a page that exists, with an icon that exists.
 *   2. The static markup of every page matches that configuration exactly
 *      (the same check as `node scripts/build-nav.mjs --check`).
 *   3. In a real page DOM the drawer holds the same groups and links on every
 *      route, the right destination is highlighted, and the shared app layer
 *      does not add a second menu.
 *   4. The drawer opens, closes (button, overlay, Escape, choosing a link),
 *      locks the page scroll, moves focus, and the bottom bar is identical and
 *      correctly highlighted on every page that shows one.
 *
 *   node tests/nav.test.js
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0;
let fail = 0;
function t(name, ok, extra) {
  if (ok) { pass += 1; console.log('PASS  ' + name + (extra ? '  ' + extra : '')); }
  else { fail += 1; console.error('FAIL  ' + name + (extra ? '  ' + extra : '')); }
}

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.log('SKIP  jsdom is not installed — run: npm install --no-save jsdom');
  process.exit(0);
}

const NAV_SRC = read('assets/pd-nav.js');
const ICONS_SRC = read('assets/pd-icons.js');
const APP_SRC = read('assets/pd-app.js');
const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

/* ---------------------------------------------------- 1. the configuration */

/** A fresh PDNav bound to one route (no document, no side effects). */
function navFor(route) {
  const window = { location: { pathname: route }, console };
  const context = vm.createContext({ window, console, location: window.location });
  vm.runInContext(NAV_SRC, context, { filename: 'assets/pd-nav.js' });
  return window.PDNav;
}

const nav = navFor('/');
t('pd-nav.js exposes one grouped configuration', Array.isArray(nav.GROUPS) && nav.GROUPS.length >= 4);
t('every group is labelled and non-empty',
  nav.GROUPS.every((g) => g.label && Array.isArray(g.items) && g.items.length > 0));
t('the drawer footer carries the secondary links', nav.SECONDARY.length >= 3);
t('the bottom bar has five or six primary destinations',
  nav.BOTTOM.length >= 5 && nav.BOTTOM.length <= 6);

const items = nav.all();
const hrefs = items.map((item) => item.href);
t('no duplicate menu destinations', new Set(hrefs).size === hrefs.length, hrefs.join(' '));
t('no duplicate group ids', new Set(nav.GROUPS.map((g) => g.id)).size === nav.GROUPS.length);

const missingPages = [...items, ...nav.SECONDARY].filter((item) => {
  const file = item.href === '/' ? 'index.html' : item.href.replace(/^\//, '') + '.html';
  return !fs.existsSync(path.join(ROOT, file));
});
t('every menu destination is a page that exists', missingPages.length === 0,
  missingPages.map((i) => i.href).join(', '));

// Icons: check the names against the generated icon runtime.
const iconNames = (ICONS_SRC.match(/var NAMES = '([^']+)'/) || [, ''])[1].split(' ');
const badIcons = [...items, ...nav.SECONDARY, ...nav.BOTTOM].filter((item) => !iconNames.includes(item.icon));
t('every menu icon exists in the Lucide icon set', badIcons.length === 0,
  badIcons.map((i) => `${i.href}:${i.icon}`).join(', '));

t('no menu label is empty or over 24 characters',
  [...items, ...nav.SECONDARY, ...nav.BOTTOM].every((i) => i.label && i.label.length <= 24));

/* The required behaviour: the same global destinations whatever the route. */
const homeSet = navFor('/').all().map((i) => i.href).join(',');
const routes = ['/', '/game', '/quiz', '/lessons', '/prayer', '/account', '/news', '/lesson', '/resource-view'];
const sameEverywhere = routes.every((route) => navFor(route).all().map((i) => i.href).join(',') === homeSet);
t('the menu list is identical on every route', sameEverywhere);
t('the menu does not depend on page-specific tabs', !/data-tab/.test(NAV_SRC));

/* Active destination, including aliases. */
const activeChecks = [
  ['/', '/'],
  ['/index.html', '/'],
  ['/game', '/game'],
  ['/game.html', '/game'],
  ['/quiz', '/quiz'],
  ['/lessons', '/lessons'],
  ['/lesson', '/lessons'],
  ['/lesson-quiz', '/lessons'],
  ['/resource-view', '/resources'],
  ['/prayer-wall', '/prayer'],
  ['/news.html', '/news']
];
const activeFailures = activeChecks.filter(([route, expected]) => {
  const n = navFor(route);
  const marked = n.all().filter((item) => n.isActive(item.href)).map((item) => item.href);
  return marked.length !== 1 || marked[0] !== expected;
});
t('exactly one destination is active, and it is the right one', activeFailures.length === 0,
  activeFailures.map(([r, e]) => r).join(', '));

/* ------------------------------------------------- 2. static markup parity */

function canonicalise(file, route) {
  const n = navFor(route);
  const source = read(file);
  let out = source;
  out = out.replace(/<aside\b[^>]*\bid="pdDrawer"[^>]*>[\s\S]*?<\/aside>/i,
    () => `<aside class="pd-drawer" id="pdDrawer" aria-label="Main menu">\n${n.drawerMarkup()}\n</aside>`);
  const bar = out.match(/<nav class="nav-bar"[^>]*>[\s\S]*?<\/nav>/i);
  if (bar) out = out.replace(bar[0], () => n.bottomMarkup());
  return out;
}

function normalise(html) {
  return html
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
}

const stale = htmlFiles.filter((file) => {
  const route = file === 'index.html' ? '/' : '/' + file.replace(/\.html$/, '');
  const before = read(file);
  if (!/id="pdDrawer"/.test(before) && !/class="nav-bar"/.test(before)) return false;
  return normalise(before) !== normalise(canonicalise(file, route));
});
t('every page ships the canonical menu markup', stale.length === 0, stale.join(', '));

const pagesWithDrawer = htmlFiles.filter((f) => /id="pdDrawer"/.test(read(f)));
const drawerCounts = pagesWithDrawer.map((f) => (read(f).match(/class="pd-drawer-link/g) || []).length);
t('every page with a drawer lists the whole menu',
  drawerCounts.every((count) => count === items.length), drawerCounts.join(','));

const pagesWithBottom = htmlFiles.filter((f) => /class="nav-bar/.test(read(f)));
t('every page that shows a bottom bar reserves space for it and its safe area',
  pagesWithBottom.length >= 5 && pagesWithBottom.every((f) => /pd-bottom-nav-page/.test(read(f))),
  pagesWithBottom.join(', '));

/* ------------------------------------------------------- 3 + 4. live DOM */

function boot(file, route) {
  const dom = new JSDOM(read(file), {
    url: 'https://prayerdome.net' + route,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({
        matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}
      }));
      window.scrollTo = () => {};
      // jsdom cannot navigate; swallow the click before it complains.
      window.addEventListener('click', (e) => e.preventDefault(), true);
    }
  });
  const { window } = dom;
  window.eval(ICONS_SRC);
  window.eval(NAV_SRC);
  // Pages that own no drawer markup get the shared one injected by the app
  // layer, exactly as in production.
  if (!window.document.getElementById('pdDrawer')) {
    window.eval(read('assets/pd-content-data.js'));
    window.eval(APP_SRC);
    if (window.PDApp && window.PDApp.init) window.PDApp.init();
  }
  // `defer` scripts run before DOMContentLoaded in the browser; jsdom fires it
  // asynchronously, so run the same initialisation step explicitly.
  window.PDNav.init();
  return { dom, window, doc: window.document };
}

const routePages = [
  ['index.html', '/'],
  ['game.html', '/game'],
  ['quiz.html', '/quiz'],
  ['lessons.html', '/lessons'],
  ['prayer.html', '/prayer']
];

const menus = [];
routePages.forEach(([file, route]) => {
  const { window, doc } = boot(file, route);
  const drawer = doc.getElementById('pdDrawer');
  t(`${file}: exactly one drawer`, doc.querySelectorAll('.pd-drawer').length === 1);
  const links = Array.from(drawer.querySelectorAll('.pd-drawer-link')).map((a) => a.getAttribute('data-pd-nav'));
  menus.push({ file, links });
  const groups = Array.from(drawer.querySelectorAll('.pd-drawer-group')).map((g) => g.getAttribute('data-pd-nav-group'));
  t(`${file}: grouped menu with every group`, groups.join(',') === nav.GROUPS.map((g) => g.id).join(','));
  const active = Array.from(drawer.querySelectorAll('.pd-drawer-link.active'));
  t(`${file}: the current page is the only active item`, active.length === 1,
    active.map((a) => a.getAttribute('href')).join(','));
  t(`${file}: the active item carries aria-current`,
    active.length === 1 && active[0].getAttribute('aria-current') === 'page');
  t(`${file}: the drawer starts closed and out of the tab order`,
    !drawer.classList.contains('open') && drawer.hasAttribute('inert'));
  window.close();
});

t('the drawer shows the same destinations on every route',
  menus.every((m) => m.links.join(',') === menus[0].links.join(',')));

/* Interaction: open, focus, scroll lock, close paths. */
{
  const { window, doc } = boot('index.html', '/');
  const drawer = doc.getElementById('pdDrawer');
  const button = doc.getElementById('pdMenuBtn');
  const overlay = doc.getElementById('pdDrawerOverlay');
  t('the menu button is wired for assistive technology',
    button && button.getAttribute('aria-expanded') === 'false');
  t('the drawer has an overlay to dismiss it', !!overlay);

  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  t('the menu opens from the button', drawer.classList.contains('open') && button.getAttribute('aria-expanded') === 'true');
  t('opening moves focus into the menu', drawer.contains(doc.activeElement));
  t('opening locks the page behind the menu', doc.body.classList.contains('pd-nav-open'));

  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  t('Escape closes the menu', !drawer.classList.contains('open') && !doc.body.classList.contains('pd-nav-open'));
  t('closing returns focus to the menu button', doc.activeElement === button);

  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  overlay.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  t('tapping the backdrop closes the menu', !drawer.classList.contains('open'));

  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const link = drawer.querySelector('.pd-drawer-link[href="/bible"]');
  link.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  t('choosing a destination closes the menu', !drawer.classList.contains('open'));
  t('choosing a destination unlocks the page', !doc.body.classList.contains('pd-nav-open'));

  // Back/forward and bfcache restores must not leave the menu over the page.
  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  window.dispatchEvent(new window.Event('pageshow'));
  t('a bfcache restore closes the menu', !drawer.classList.contains('open'));
  window.close();
}

/* The shared layer must not add another menu or overwrite the drawer. */
{
  const { window, doc } = boot('game.html', '/game');
  const before = doc.getElementById('pdDrawer').innerHTML;
  window.eval(read('assets/pd-content-data.js'));
  window.eval(APP_SRC);
  const drawers = doc.querySelectorAll('.pd-drawer');
  t('the shared app layer does not inject a second drawer', drawers.length === 1);
  t('the shared app layer does not rewrite the menu',
    doc.getElementById('pdDrawer').innerHTML === before);
  const academyLinks = Array.from(doc.querySelectorAll('.pd-drawer-link'))
    .filter((a) => /lessons|stories|quiz|resources/.test(a.getAttribute('href')));
  t('the Academy has no private copy of the menu', academyLinks.length === 4);
  window.close();
}

/* Bottom bar: same destinations, same order, correct highlight. */
{
  const bars = [];
  pagesWithBottom.forEach((file) => {
    const route = file === 'index.html' ? '/' : '/' + file.replace(/\.html$/, '');
    const { window, doc } = boot(file, route);
    const bar = doc.querySelector('.bottom-ui-system .nav-bar');
    const links = Array.from(bar.querySelectorAll('.nav-link')).map((a) => a.getAttribute('data-pd-nav'));
    bars.push(links.join(','));
    const active = Array.from(bar.querySelectorAll('.nav-link.active')).map((a) => a.getAttribute('data-pd-nav'));
    // A page outside the six primary destinations (News, Gallery, Sermons…) must
    // never highlight a destination it is not on; it simply highlights none.
    const expected = nav.BOTTOM.some((item) => nav.isActive(item.href, route))
      ? nav.BOTTOM.filter((item) => nav.isActive(item.href, route)).map((item) => item.href)
      : [];
    t(`${file}: one bottom bar, highlighted truthfully`,
      doc.querySelectorAll('.nav-bar').length === 1 &&
      active.length === expected.length && active.every((href) => expected.includes(href)),
      active.join(',') || 'none');
  });
  t('the bottom bar is identical on every page that shows it',
    new Set(bars).size === 1, bars.length + ' pages');
}

console.log(`\nNavigation checks: ${pass} passed, ${fail} failed.`);
// jsdom keeps animation frames alive; exit explicitly so a pending frame in a
// discarded window cannot throw after the report is printed.
process.exit(fail ? 1 : 0);
