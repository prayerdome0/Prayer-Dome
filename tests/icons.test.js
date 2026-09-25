/* Icon system regression tests.
 *
 * Prayer Dome uses ONE icon library: Lucide (plus two glyphs drawn to the Lucide spec and
 * Simple Icons brand marks), rendered as CSS-mask SVGs from assets/pd-icons.css. These tests
 * keep it that way:
 *   • no Font Awesome (or any other icon library) and no emoji used as UI icons
 *   • every page loads the icon system and every icon name in use exists
 *   • icon-only buttons and links have an accessible name
 *   • legacy Font Awesome / emoji values saved in Firestore still resolve to Lucide icons
 *   • the generated files are up to date, self-contained, offline-ready and within budget
 *
 * Run: node tests/icons.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;

function t(name, ok, detail) {
  if (ok) { passed++; console.log('PASS', name); }
  else { failed++; console.log('FAIL', name, detail || ''); }
}
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function list(dir, ext) {
  return fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(ext)).sort()
    .map((f) => (dir === '.' ? f : `${dir}/${f}`));
}
function sample(items, n = 6) {
  return items.slice(0, n).join(' | ') + (items.length > n ? ` … (+${items.length - n} more)` : '');
}
function lineOf(text, index) { return text.slice(0, index).split('\n').length; }

const PAGES = list('.', '.html').concat(['documents/index.html']);
const GENERATED = new Set(['assets/pd-icons.css', 'assets/pd-icons.js']);
const UI_FILES = [
  ...PAGES, ...list('.', '.js'), ...list('assets', '.js'), ...list('assets', '.css'),
  ...list('api', '.js'), 'functions/index.js'
].filter((f) => !GENERATED.has(f));
const SOURCE = Object.fromEntries(UI_FILES.map((f) => [f, read(f)]));
const MARKUP_FILES = UI_FILES.filter((f) => !f.endsWith('.css'));
const css = read('assets/pd-icons.css');
const runtime = read('assets/pd-icons.js');

/** Every match of `re` in the UI source as "file:line match". */
function findAll(re, files = UI_FILES, keep = () => true) {
  const out = [];
  for (const f of files) {
    for (const m of SOURCE[f].matchAll(re)) if (keep(m, f)) out.push(`${f}:${lineOf(SOURCE[f], m.index)} ${m[0].slice(0, 60)}`);
  }
  return out;
}

/* ------------------------------------------------ 1. One icon library */
t('no Font Awesome or other icon library is loaded anywhere',
  findAll(/font-?awesome|material-(?:icons|symbols)|heroicons|phosphor|ionicons|bootstrap-icons|boxicons|remixicon|line-awesome/gi).length === 0,
  sample(findAll(/font-?awesome|material-(?:icons|symbols)|heroicons|phosphor|ionicons|bootstrap-icons|boxicons|remixicon|line-awesome/gi)));
const faTokens = findAll(/(?<![\w-])fa-[a-z][a-z0-9-]*(?![\w-])/g);
t('no Font Awesome fa-* classes remain in markup, scripts or styles', faTokens.length === 0, sample(faTokens));
const faStyles = findAll(/class(?:Name)?\s*=\s*["'`][^"'`]*(?<![\w-])(?:fa|fas|far|fab)(?![\w-])/g, MARKUP_FILES);
t('no Font Awesome style classes (fa / fas / far / fab) remain', faStyles.length === 0, sample(faStyles));
t('the icon stylesheet ships Lucide (ISC) and Simple Icons brand marks (CC0) with attribution',
  /Lucide v\d+\.\d+\.\d+/.test(css) && css.includes('ISC License') && css.includes('CC0') &&
  fs.existsSync(path.join(ROOT, 'scripts/icons/brands/README.md')));

/* ------------------------------------------------ 2. Every page loads it */
const notLoaded = PAGES.filter((p) => {
  const head = read(p).split(/<\/head>/i)[0];
  return !head.includes('<link rel="stylesheet" href="/assets/pd-icons.css">') ||
    !head.includes('<script src="/assets/pd-icons.js"></script>');
});
t(`all ${PAGES.length} pages load pd-icons.css and pd-icons.js (synchronously) in <head>`,
  PAGES.length >= 35 && notLoaded.length === 0, sample(notLoaded));

/* ------------------------------------------------ 3. No emoji as UI icons */
// One emoji "cluster": pictograph (+VS16 / skin tone / keycap), ZWJ sequences, or a flag pair,
// plus the typographic stand-ins that were used as icons (check marks, stars, notes, play, dots).
const EMOJI = /(?:\p{Regional_Indicator}{2}|(?:\p{Extended_Pictographic}|[#*0-9]\uFE0F?\u20E3)[\uFE0F\u{1F3FB}-\u{1F3FF}]*(?:\u200D\p{Extended_Pictographic}[\uFE0F\u{1F3FB}-\u{1F3FF}]*)*)/gu;
const SYMBOLS = /[\u2713\u2714\u2717\u2718\u2715\u2716\u2605\u2606\u266A\u266B\u25B6\u25C0\u25CF\u25CB\u2661]/gu;
const TEXT_SYMBOLS = new Set(['\u00A9', '\u00AE', '\u2122', '\u2194', '\u2195', '\u2196', '\u2197', '\u2198', '\u2199']);
// The chat emoji keyboard inserts emoji into the user's message: user content, not UI icons.
const KEYBOARD = /<div\b[^>]*\bdata-pd-emoji-keyboard\b[^>]*>[\s\S]*?<\/div>/g;
const emojiHits = [];
for (const f of UI_FILES) {
  const text = SOURCE[f].replace(KEYBOARD, (m) => m.replace(/[^\n]/g, ' '));
  for (const re of [EMOJI, SYMBOLS]) {
    for (const m of text.matchAll(re)) if (!TEXT_SYMBOLS.has(m[0])) emojiHits.push(`${f}:${lineOf(text, m.index)} ${m[0]}`);
  }
}
t('no emoji or emoji-like symbols are used as UI icons', emojiHits.length === 0, sample(emojiHits, 10));
const keyboardUsers = UI_FILES.filter((f) => SOURCE[f].includes('data-pd-emoji-keyboard'));
const keyboard = (SOURCE['chat.html'].match(KEYBOARD) || [''])[0];
const keys = keyboard.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) || [];
t('the only emoji left are the chat emoji keyboard keys, and each one inserts into the message',
  keyboardUsers.join() === 'chat.html' && keys.length > 0 &&
  keys.every((b) => /onclick="insertEmoji\('[^']+'\)"/.test(b)), `${keyboardUsers.join()} keys=${keys.length}`);

/* ------------------------------------------------ 4. Every icon name exists */
const MODIFIERS = new Set(['spin', 'fw', 'xs', 'sm', 'lg', '2x', '3x', '4x', '5x', 'inline']);
const defined = new Set([...css.matchAll(/\.pd-i-([a-z0-9-]+)\{--pd-i:/g)].map((m) => m[1]));
const variables = new Set([...css.matchAll(/--pd-icon-([a-z0-9-]+):/g)].map((m) => m[1]));
const runtimeNames = (runtime.match(/var NAMES = '([^']*)'/) || ['', ''])[1].trim().split(/\s+/);
t(`the icon stylesheet defines ${defined.size} icons, the same set the runtime knows`,
  defined.size >= 250 && runtimeNames.length === defined.size && runtimeNames.every((n) => defined.has(n)));
const unknown = findAll(/(?<![\w-])pd-i-([a-z0-9]+(?:-[a-z0-9]+)*)/g, UI_FILES,
  (m) => !MODIFIERS.has(m[1]) && !defined.has(m[1]));
t('every pd-i-* icon used by the app exists (pages, scripts, styles, API, functions)', unknown.length === 0, sample(unknown));
const unknownVars = findAll(/var\(--pd-icon-([a-z0-9-]+)\)/g, UI_FILES, (m) => !variables.has(m[1]));
t('every --pd-icon-* mask variable used in CSS exists', unknownVars.length === 0, sample(unknownVars));
const spliced = findAll(/pd-i-[a-z0-9-]+(?:\$\{|['"`]\s*\+)/g, MARKUP_FILES);
t('icon names are never spliced together at runtime (e.g. pd-i-eye${x}), so every name is checkable',
  spliced.length === 0, sample(spliced));
const bare = findAll(/class(?:Name)?\s*=\s*(["'])\s*pd-i\s*\1/g, MARKUP_FILES);
t('no bare class="pd-i" without an icon name', bare.length === 0, sample(bare));

/* ------------------------------------------------ 5. Accessible icon-only controls */
const ICON_ONLY = /<(button|a)\b([^>]*)>\s*<i\s+class=["'][^"']*\bpd-i\b[^"']*["'][^>]*>\s*<\/i>\s*<\/\1>/g;
let iconOnly = 0;
const unnamed = findAll(ICON_ONLY, MARKUP_FILES, (m) => {
  iconOnly++;
  return !/\b(?:aria-label|aria-labelledby|title)\s*=/.test(m[2]);
});
t(`all ${iconOnly} icon-only buttons and links have an accessible name`, iconOnly > 150 && unnamed.length === 0, sample(unnamed));

/* ------------------------------------------------ 6. Runtime: legacy values */
const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(runtime, sandbox, { filename: 'pd-icons.js' });
const I = sandbox.PDIcons;
t('PDIcons exposes has / resolve / cls / html / plain / inline / upgrade',
  !!I && ['has', 'resolve', 'cls', 'html', 'plain', 'inline', 'upgrade'].every((k) => typeof I[k] === 'function'));
t('PDIcons.has knows Lucide names only', I.has('house') && I.has('hands-praying') && !I.has('home') && !I.has(''));
t('legacy Font Awesome values resolve to Lucide (fa-bullhorn -> megaphone)', I.resolve('fa-bullhorn') === 'megaphone');
t('legacy Font Awesome class lists resolve (fas fa-church -> church)', I.resolve('fas fa-church') === 'church');
t('Font Awesome Pro-only names that rendered blank now resolve (fa-calendar-star)', I.resolve('fa-solid fa-calendar-star') === 'calendar-clock');
t('pd-i classes and bare Lucide names resolve to themselves', I.resolve('pd-i-bell') === 'bell' && I.resolve('bell') === 'bell');
t('legacy emoji values resolve (\u{1F64F} -> hands-praying)', I.resolve('\u{1F64F}') === 'hands-praying');
t('emoji with or without VS16 resolve (\u2764\uFE0F -> heart)', I.resolve('\u2764\uFE0F') === 'heart' && I.resolve('\u2764') === 'heart');
t('emoji-prefixed labels saved before the migration resolve', I.resolve('\u{1F64F} Prayer') === 'hands-praying');
t('unknown values resolve to nothing, or to the fallback', I.resolve('not-an-icon') === '' && I.resolve('not-an-icon', 'pd-i-circle') === 'circle');
t('PDIcons.cls always yields a renderable class list',
  I.cls(undefined) === 'pd-i pd-i-circle' && I.cls('fa-bullhorn', null, 'pd-i-lg') === 'pd-i pd-i-megaphone pd-i-lg');
t('PDIcons.html renders decorative (aria-hidden) markup', I.html('bell') === '<i class="pd-i pd-i-bell" aria-hidden="true"></i>');
t('PDIcons.plain drops a leading emoji or flag but keeps (c)/(R)/TM',
  I.plain('\u{1F30D} General') === 'General' && I.plain('\u{1F1FF}\u{1F1F2} Zambia') === 'Zambia' &&
  I.plain('\u00A9 2026 Prayer Dome') === '\u00A9 2026 Prayer Dome' && I.plain(null) === '');
function mapEntries(file) {
  return Object.entries(JSON.parse(read(file))).filter(([key]) => !key.startsWith('_'));
}
const faMap = mapEntries('scripts/icons/legacy-fontawesome.json');
const emojiMap = mapEntries('scripts/icons/legacy-emoji.json');
const badFa = faMap.filter(([name, icon]) => !I.has(icon) || I.resolve(`fa-${name}`) !== icon).map(([n]) => n);
t(`all ${faMap.length} legacy Font Awesome names map to shipped icons`, faMap.length >= 300 && badFa.length === 0, sample(badFa));
const badEmoji = emojiMap.filter(([emoji, icon]) => !I.has(icon) || I.resolve(emoji) !== icon).map(([e]) => e);
t(`all ${emojiMap.length} legacy emoji map to shipped icons`, emojiMap.length >= 90 && badEmoji.length === 0, sample(badEmoji));

/* ------------------------------------------------ 7. Runtime: markup upgrader */
let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch (e) { /* optional */ }

async function upgraderTests() {
  if (!JSDOM) { console.log('SKIP  upgrader tests: jsdom not installed (npm install --no-save jsdom)'); return; }
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="box">' +
    '<i class="fas fa-home"></i><span class="fab fa-whatsapp"></span>' +
    '<i class="fa-solid fa-spinner fa-spin"></i><i class="pd-i pd-i-bell"></i></div></body></html>',
  { runScripts: 'outside-only' });
  const { window } = dom;
  window.eval(runtime);
  if (window.document.readyState === 'loading') {
    await new Promise((resolve) => window.document.addEventListener('DOMContentLoaded', resolve));
  }
  const [home, whatsapp, spinner, bell] = window.document.getElementById('box').children;
  t('the upgrader converts <i class="fas fa-home"> to the Lucide house icon',
    home.className === 'pd-i pd-i-house' && home.getAttribute('aria-hidden') === 'true', home.className);
  t('the upgrader converts brand icons and keeps modifiers',
    whatsapp.className === 'pd-i pd-i-brand-whatsapp' && spinner.className === 'pd-i pd-i-loader-circle pd-i-spin',
    `${whatsapp.className} / ${spinner.className}`);
  t('the upgrader leaves Lucide markup alone', bell.className === 'pd-i pd-i-bell');
  const late = window.document.createElement('div');
  late.innerHTML = '<i class="fas fa-bullhorn"></i>';
  window.document.body.appendChild(late);
  const changed = window.document.createElement('i');
  window.document.body.appendChild(changed);
  await new Promise((resolve) => setTimeout(resolve, 0));
  changed.className = 'far fa-bookmark';
  await new Promise((resolve) => setTimeout(resolve, 0));
  t('legacy markup added later (stale cached script, saved HTML) is upgraded automatically',
    late.firstChild.className === 'pd-i pd-i-megaphone' && changed.className === 'pd-i pd-i-bookmark',
    `${late.firstChild.className} / ${changed.className}`);
  window.close();
}

/* ------------------------------------------------ 8. Build, size, offline */
function staticTests() {
  const check = spawnSync(process.execPath, [path.join(ROOT, 'scripts/build-icons.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' });
  t('generated icon files are up to date (npm run build:icons)', check.status === 0, `${check.stdout}${check.stderr}`.trim());
  t('the icon stylesheet is self-contained: data-URI SVGs only, no fonts, imports or remote URLs',
    !/url\(\s*["']?(?:https?:)?\/\//.test(css) && !/@import|@font-face/.test(css) &&
    [...css.matchAll(/--pd-i:url\("data:image\/svg\+xml,/g)].length === defined.size);
  const gzip = (text) => zlib.gzipSync(text, { level: 9 }).length;
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  t(`icon stylesheet stays within budget (${kb(css.length)}, ${kb(gzip(css))} gzip; limit 24 KB gzip)`, gzip(css) <= 24 * 1024);
  t(`icon runtime stays within budget (${kb(runtime.length)}, ${kb(gzip(runtime))} gzip; limit 9 KB gzip)`, gzip(runtime) <= 9 * 1024);
  const sw = read('sw.js');
  t('the service worker precaches the icon files, so icons work offline',
    sw.includes("'/assets/pd-icons.css'") && sw.includes("'/assets/pd-icons.js'"));
  t('the Vercel build publishes the assets directory', /PUBLIC_DIRECTORIES\s*=\s*\[[^\]]*'assets'/.test(read('scripts/build-vercel.mjs')));
  const brand = read('assets/pd-brand.css');
  const darkMissing = ['.pd-drawer-link i', '.pd-drawer-link.pd-drawer-live i', '.pd-menu-btn', '.pd-bell-btn', '.pd-notif-icon']
    .filter((sel) => !brand.includes(`body.dark-mode ${sel}`));
  t('shared icon tiles and icon buttons have dark-mode colours', darkMissing.length === 0, sample(darkMissing));
  // Found by a pixel contrast scan: brand blue (#0A4D9B) icons and headings were ~2:1 on navy,
  // and unstyled chips/calendar buttons painted black icons on dark surfaces.
  const darkPages = ['about.html', 'account.html', 'ai-prayer.html', 'chat.html', 'contact.html', 'event.html',
    'events.html', 'gallery.html', 'give.html', 'index.html', 'news.html', 'radio.html', 'quiz.html', 'team.html', 'testimony.html'];
  const noDark = darkPages.filter((p) => !read(p).includes('light brand tint (#93c5fd)'));
  t(`the ${darkPages.length} pages that coloured icons brand blue have dark-mode overrides`, noDark.length === 0, sample(noDark));
  t('assistant topic icons use a theme-aware brand blue (navy in light mode, light tint in dark mode)',
    (read('ai-prayer-data.js').match(/var\(--topic-brand, #0A4D9B\)/g) || []).length === 3 &&
    read('ai-prayer.html').includes('body.dark-mode { --topic-brand: #93c5fd; }'));
  const pkg = JSON.parse(read('package.json'));
  t('npm scripts build and check the icons', pkg.scripts['build:icons'] === 'node scripts/build-icons.mjs' &&
    pkg.scripts.lint.includes('build-icons.mjs --check') && pkg.scripts.test.includes('tests/icons.test.js'));
}

staticTests();
upgraderTests().catch((error) => t('upgrader tests ran', false, error && error.stack)).finally(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
});
