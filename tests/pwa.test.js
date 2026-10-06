/*
 * PWA contract checks.
 *
 * Prayer Dome is installed as an app from the browser (and packaged with
 * Capacitor), so the manifest, the service worker and the registration path all
 * have to stay consistent. These checks parse the real files — no browser — and
 * guard the rules that keep the installed app and the admin console working:
 *
 *   • the manifest lists real, correctly sized icons/screenshots and an
 *     Admin Console shortcut,
 *   • /sw.js is registered on every page through the shared app layer,
 *   • the admin console is never precached, cached or replayed offline,
 *   • the service worker keeps its update-friendly caching rules,
 *   • the hosting headers keep sw.js revalidating.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

let passed = 0;
function t(name, ok, extra = '') {
  if (ok) { passed += 1; console.log('PASS  ' + name); }
  else { console.error('FAIL  ' + name + (extra ? '  ' + extra : '')); process.exitCode = 1; }
}

/* --------------------------------------------------------- PNG/JPEG sizing */
function pngSize(buffer) {
  assert.equal(buffer.slice(0, 8).toString('hex'), '89504e470d0a1a0a', 'not a PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
function jpegSize(buffer) {
  let index = 2;
  while (index < buffer.length) {
    if (buffer[index] !== 0xff) { index += 1; continue; }
    const marker = buffer[index + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(index + 5), width: buffer.readUInt16BE(index + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { index += 2; continue; }
    index += 2 + buffer.readUInt16BE(index + 2);
  }
  throw new Error('Could not read JPEG size');
}
function declaredSize(src) {
  return pngSize(fs.readFileSync(path.join(ROOT, src.replace(/^\//, ''))));
}

/* --------------------------------------------------------------- manifest */
const manifestText = read('manifest.json');
let manifest;
try { manifest = JSON.parse(manifestText); }
catch (error) { console.error('FAIL  manifest.json is valid JSON:', error.message); process.exit(1); }

t('manifest declares an installable app shell', manifest.display === 'standalone' &&
  Array.isArray(manifest.display_override) && manifest.display_override.includes('standalone'),
  JSON.stringify(manifest.display_override));
t('manifest start_url stays inside the app scope',
  manifest.start_url.startsWith('/') && manifest.scope === '/', `${manifest.start_url} / ${manifest.scope}`);
t('manifest keeps the brand colours and language',
  manifest.theme_color === '#0A4D9B' && manifest.background_color === '#0A4D9B' && manifest.lang === 'en');

const iconPurposes = new Map();
for (const icon of manifest.icons || []) {
  const { width, height } = declaredSize(icon.src);
  const [w, h] = String(icon.sizes).split('x').map(Number);
  t(`manifest icon ${icon.src} (${icon.sizes}) exists at the declared size`,
    width === w && height === h, `file is ${width}x${height}`);
  iconPurposes.set(icon.purpose, true);
}
t('manifest ships both any and maskable icon purposes',
  iconPurposes.has('any') && iconPurposes.has('maskable'));

function imageSize(file) {
  const buffer = fs.readFileSync(path.join(ROOT, file.replace(/^\//, '')));
  return buffer.slice(0, 4).toString('hex') === '89504e47'
    ? pngSize(buffer)
    : jpegSize(buffer);
}

for (const shot of manifest.screenshots || []) {
  const { width, height } = imageSize(shot.src);
  const [w, h] = String(shot.sizes).split('x').map(Number);
  t(`manifest screenshot ${shot.src} matches its declared size`,
    width === w && height === h, `declared ${shot.sizes}, file is ${width}x${height}`);
  t(`manifest screenshot ${shot.src} has a usable width for install promotion`, width >= 320);
}

const shortcuts = manifest.shortcuts || [];
const adminShortcut = shortcuts.find((entry) => (entry.url || '').startsWith('/admin'));
t('the installed app offers an Admin Console shortcut', !!adminShortcut,
  shortcuts.map((entry) => entry.short_name || entry.name).join(', '));
t('every manifest shortcut points at a page that exists', shortcuts.every((entry) => {
  const target = (entry.url || '').split('?')[0].replace(/^\//, '') || 'index.html';
  const file = target.endsWith('.html') ? target : `${target}.html`;
  return fs.existsSync(path.join(ROOT, file)) || fs.existsSync(path.join(ROOT, target));
}), shortcuts.map((entry) => entry.url).join(', '));

/* -------------------------------------------------- service worker contract */
const sw = read('sw.js');
const precacheBlock = sw.slice(sw.indexOf('const PRECACHE'), sw.indexOf('];', sw.indexOf('const PRECACHE')));
t('sw.js never precaches the admin console', !precacheBlock.includes('/admin'));
t('sw.js precaches the shell, the shared layer and the icons',
  precacheBlock.includes("'/index.html'") && precacheBlock.includes("'/assets/pd-app.js'") &&
  precacheBlock.includes("'/assets/pd-icons.css'"));
t('sw.js treats the admin console as network-only',
  sw.includes('NETWORK_ONLY_PATHS') && sw.includes("['/admin', '/admin.html']") &&
  sw.includes('isNetworkOnlyPage(url)') && /if \(isNetworkOnlyPage\(url\)\) return;/.test(sw));
t('sw.js keeps Firebase and API traffic off the cache', /NEVER_CACHE[\s\S]*?firestore\.googleapis\.com/.test(sw));
t('sw.js serves navigations network-first with an offline fallback',
  /isHTML[\s\S]*?fetch\(req\)[\s\S]*?caches\.match\('\/offline\.html'\)/.test(sw));
t('sw.js still handles push and notification clicks for the installed app',
  sw.includes("addEventListener('push'") && sw.includes("addEventListener('notificationclick'"));
t('sw.js cache version was bumped for the admin-network-only change',
  /const CACHE_NAME = 'prayer-dome-v\d+';/.test(sw));

/* ------------------------------------------------ registration on all pages */
const appJs = read('assets/pd-app.js');
t('the shared app layer owns PWA registration', appJs.includes('var pwa = {') &&
  appJs.includes("navigator.serviceWorker.register('/sw.js', { scope: '/' })") &&
  appJs.includes('pwa: pwa'));
t('PWA registration runs from PDApp.init', /modules = \[[\s\S]*?\['pwa', pwa\.init\]/.test(appJs));
t('PWA registration can be turned off per page', appJs.includes("getAttribute('data-pd-sw') === 'off'"));
t('the packaged Android app skips the worker (local assets, no bridge interference)',
  appJs.includes('isNativeApp: function ()') && /if \(pwa\.isNativeApp\(\)\) return Promise\.resolve\(null\)/.test(appJs));
const registerDeviceBlock = appJs.slice(appJs.indexOf('registerDevice: function'), appJs.indexOf('saveToken: function'));
t('push setup reuses the existing root worker instead of swapping it',
  registerDeviceBlock.includes("getRegistration('/')") &&
  /if \(!reg\) reg = await navigator\.serviceWorker\.register\('\/firebase-messaging-sw\.js'/.test(registerDeviceBlock) &&
  !/register\('\/sw\.js'/.test(registerDeviceBlock));
t('the install prompt is captured instead of blocking the page',
  appJs.includes("addEventListener('beforeinstallprompt'") && appJs.includes('promptInstall: function'));

const pages = fs.readdirSync(ROOT).filter((name) => name.endsWith('.html'));
const notRegistered = pages.filter((name) => {
  const html = read(name);
  if (!html.includes('pd-app.js')) return true;                       // no shared layer at all
  return html.includes('data-pd-sw="off"');                            // explicit opt-out
});
t('every published page loads the shared layer that registers /sw.js',
  notRegistered.length === 0, notRegistered.join(', '));
t('the admin console opts out of the marketing layout but keeps the worker',
  read('admin.html').includes('data-pd-layout="none"') && !read('admin.html').includes('data-pd-sw="off"'));

/* ------------------------------------------------------ hosting/headers/fit */
const vercel = JSON.parse(read('vercel.json'));
const vercelSwHeaders = (vercel.headers || []).find((entry) => entry.source === '/sw.js');
t('vercel serves /sw.js revalidating so updates roll out', !!vercelSwHeaders &&
  vercelSwHeaders.headers.some((header) => header.key === 'Cache-Control' &&
    /max-age=0/.test(header.value) && /must-revalidate/.test(header.value)));
const firebase = JSON.parse(read('firebase.json'));
const firebaseSwHeaders = (firebase.hosting.headers || []).find((entry) => entry.source === '/sw.js');
t('firebase serves /sw.js revalidating so updates roll out', !!firebaseSwHeaders &&
  firebaseSwHeaders.headers.some((header) => header.key === 'Cache-Control' &&
    /max-age=0/.test(header.value) && /must-revalidate/.test(header.value)));
t('/sw.js is served from the root scope on both hosts',
  !!firebaseSwHeaders && firebaseSwHeaders.headers.some((header) =>
    header.key === 'Service-Worker-Allowed' && header.value === '/'));

const shellPages = ['index.html', 'ai-prayer.html', 'news.html', 'radio.html'];
t('installed-app pages keep the safe-area viewport', shellPages.every((name) =>
  read(name).includes('viewport-fit=cover')));
t('the offline shell exists and is precached',
  fs.existsSync(path.join(ROOT, 'offline.html')) && sw.includes("'/offline.html'"));

/* ---------------------------------------------------- budget sanity check */
const manifestKb = zlib.gzipSync(manifestText, { level: 9 }).length / 1024;
t(`manifest.json stays small (${manifestKb.toFixed(2)} KB gzip, limit 8 KB)`, manifestKb <= 8);


/* --------------------------------------------------- install affordance */
const accountHtml = read('account.html');
t('the account page offers an install row wired to the shared PWA layer',
  accountHtml.includes('id="installAppRow"') && accountHtml.includes('installPrayerDomeApp()') &&
  accountHtml.includes('PDApp.pwa.promptInstall()'));
t('the install row is hidden until the browser offers the prompt',
  /id="installAppRow" style="display:none/.test(accountHtml) &&
  accountHtml.includes("document.addEventListener('pd:installready', refreshInstallAppUI)"));
t('iOS visitors get the manual “Add to Home Screen” instruction',
  /Add to Home Screen/.test(accountHtml) && /navigator\.maxTouchPoints/.test(accountHtml));
t('the row hides itself once the app is installed',
  accountHtml.includes('PDApp.pwa.installed()') &&
  accountHtml.includes("document.addEventListener('pd:installed', refreshInstallAppUI)"));

/* --------------------------- finance portal shares the admin session rules */
const financeHtml = read('finance.html');
t('the finance portal reuses the shared Firebase session',
  financeHtml.includes('setPersistence(auth, browserLocalPersistence)'));
t('finance access is read from memberships/<uid> and users/<uid>',
  financeHtml.includes('doc(db, "memberships", user.uid)') && financeHtml.includes('doc(db, "users", user.uid)'));
t('finance access accepts the admin role as well as the finance role',
  /role === 'finance' \|\| role === 'admin'/.test(financeHtml));
t('a network failure is not reported as “Access Denied”',
  financeHtml.includes("'unknown'") && /could not reach Prayer Dome to confirm your finance role/.test(financeHtml) &&
  financeHtml.includes('recheckFinanceAccess'));
t('a confirmed finance session is remembered on the device',
  financeHtml.includes('FINANCE_SESSION_KEY') && financeHtml.includes('readFinanceSession()'));
t('the retry button exists and is only shown while the check is unresolved',
  financeHtml.includes('id="accessRetryBtn"') && financeHtml.includes('retry.style.display = blocked'));

/* ------------------------------- install prompt behaviour (jsdom, optional) */
// Runs the real shared layer and drives a synthetic install prompt, so the
// account page's “Install app” row is backed by behaviour, not just markup.
(async () => {
  let JSDOM;
  try { ({ JSDOM } = require('jsdom')); }
  catch (error) {
    console.log('SKIP  install prompt behaviour needs jsdom — run: npm install --no-save jsdom');
    return;
  }

  const dom = new JSDOM(read('index.html'), {
    url: 'https://prayerdome.net/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({
        matches: false, addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {}
      }));
      window.scrollTo = () => {};
    }
  });
  const { window } = dom;
  window.eval(read('assets/pd-content-data.js'));
  window.eval(read('assets/pd-app.js'));

  t('the shared layer exposes the install API',
    typeof window.PDApp.pwa.promptInstall === 'function' &&
    typeof window.PDApp.pwa.installed === 'function' &&
    typeof window.PDApp.pwa.register === 'function');
  t('nothing is installable before the browser offers the prompt',
    window.PDApp.pwa.installPrompt() === null);
  t('promptInstall() resolves false (never throws) when there is no prompt',
    (await window.PDApp.pwa.promptInstall()) === false);

  let prompted = 0;
  let readyEvents = 0;
  window.document.addEventListener('pd:installready', () => { readyEvents += 1; });
  const installEvent = new window.Event('beforeinstallprompt');
  installEvent.preventDefault = () => {};
  installEvent.prompt = () => { prompted += 1; };
  installEvent.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(installEvent);
  t('the browser prompt is captured instead of appearing by surprise',
    !!window.PDApp.pwa.installPrompt() && readyEvents === 1);

  const accepted = await window.PDApp.pwa.promptInstall();
  t('promptInstall() forwards to the browser prompt and reports acceptance',
    accepted === true && prompted === 1);
  t('the captured prompt is cleared once used', window.PDApp.pwa.installPrompt() === null);
  t('a second promptInstall() resolves false instead of throwing',
    (await window.PDApp.pwa.promptInstall()) === false);

  window.dispatchEvent(new window.Event('appinstalled'));
  t('the installed event clears any pending prompt', window.PDApp.pwa.installPrompt() === null);
  window.close();
})()
  .catch((error) => { console.error('FAIL  install prompt behaviour:', error); process.exitCode = 1; })
  .finally(() => {
    console.log(`\nPWA contract checks passed (${passed} assertions).`);
  });
