/*
 * Lock-screen verse widget contract checks.
 *
 * The widget is the one Prayer Dome surface that is not a web page: it is Java
 * inside the Android project, rendering Scripture on a phone that never opened
 * the app. That makes it easy to break silently — a verse edit that never
 * reaches res/raw, a theme renamed in Java but not in the studio, a drawable
 * typo that only the Gradle build would catch, a page that ships without the
 * bridge script.
 *
 * These checks run without an Android SDK and verify:
 *
 *   1. verse parity — the packaged res/raw library is byte-for-byte what
 *      scripts/build-widget-verses.mjs generates from assets/pd-verse-data.js,
 *      the website's checkpoints replay correctly and the slot boundaries agree
 *      with PD_VERSES.currentSlot() for every hour of the day;
 *   2. native wiring — the manifest receiver, widget metadata (home screen and
 *      keyguard), Capacitor plugin registration and every R.* reference that
 *      VerseWidget*.java makes (layouts, ids, drawables, strings, colours,
 *      raw data) actually exist;
 *   3. the studio — /widgets.html renders today's verse, styles it through the
 *      shared theme model and reaches the native bridge in jsdom, with the
 *      service worker, hosting rewrites, sitemap and SEO metadata wired in.
 *
 * Run: node tests/widgets.test.js
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

let JSDOM;
let VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
catch (error) {
  console.error('jsdom is not installed. Run:  npm install --no-save jsdom');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const exists = (name) => fs.existsSync(path.join(ROOT, name));

let passed = 0;
function t(name, ok, extra = '') {
  if (ok) { passed += 1; console.log('PASS  ' + name); }
  else { console.error('FAIL  ' + name + (extra ? '  ' + extra : '')); process.exitCode = 1; }
}

const ANDROID = 'android/app/src/main';
const JAVA_DIR = path.join(ROOT, ANDROID, 'java/net/prayerdome/app');
const javaFiles = fs.readdirSync(JAVA_DIR).filter((name) => name.endsWith('.java'));
const java = Object.fromEntries(javaFiles.map((name) => [name, read(path.join(ANDROID, 'java/net/prayerdome/app', name))]));
const javaAll = Object.values(java).join('\n');

/* --------------------------------------- Java cross-file sanity (no SDK) */
/* The Android build cannot run in this repository's CI image, so these checks
   stand in for the compiler where the dangerous mistakes live: a method called
   on a sibling class that does not exist, an import that points nowhere, and a
   JSON key read by Java that the generator never wrote. */
function declaredMethods(source) {
  const names = new Set();
  // `public void foo(`, `private static long bar(`, `Verse bazz(` …
  for (const match of source.matchAll(/\b(?:public|private|protected|static)\s+(?:static\s+|final\s+)*[A-Za-z_$][\w$<>\[\],. ]*\s+([a-z_$][\w$]*)\s*\(/g)) {
    names.add(match[1]);
  }
  return names;
}
const ourClasses = {};
for (const [file, source] of Object.entries(java)) {
  for (const match of source.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) {
    ourClasses[match[1]] = { file: file, methods: declaredMethods(source), source: source };
  }
}

const methodTypos = [];
for (const [name, info] of Object.entries(ourClasses)) {
  for (const match of javaAll.matchAll(new RegExp('\\b' + name + '\\.([a-z_$][\\w$]*)\\s*\\(', 'g'))) {
    if (!info.methods.has(match[1])) methodTypos.push(`${name}.${match[1]}`);
  }
}
t('every method called on a sibling widget class is declared on it',
  methodTypos.length === 0, [...new Set(methodTypos)].join(', '));

const missingClasses = [];
for (const match of javaAll.matchAll(/\bnew\s+([A-Z][\w$]*)\s*\(/g)) {
  const name = match[1];
  if (ourClasses[name]) continue;
  if (/^(String|JSONObject|JSONArray|ArrayList|ByteArrayOutputStream|Intent|PendingIntent|ComponentName|Calendar|RemoteViews|JSObject|JSArray|Object|Exception|RuntimeException)$/.test(name)) continue;
  missingClasses.push(name);
}
t('no widget class is used before it exists', missingClasses.length === 0, [...new Set(missingClasses)].join(', '));

const strayImports = [];
for (const match of javaAll.matchAll(/^import\s+([\w.]+);/gm)) {
  const imported = match[1];
  const simple = imported.split('.').pop();
  if (ourClasses[simple]) continue;
  if (/^(java|javax|android|org\.json|com\.getcapacitor|androidx)\b/.test(imported)) continue;
  strayImports.push(imported);
}
t('every Java import resolves to a JDK, Android, Capacitor or widget class',
  strayImports.length === 0, strayImports.join(', '));

/* ===================================================== 1. verse parity === */

const library = require(path.join(ROOT, 'assets/pd-verse-data.js'));
const rawFile = ANDROID + '/res/raw/pd_widget_verses.json';
t('the packaged widget verse library exists', exists(rawFile), rawFile);
const rawText = read(rawFile);
const widgetData = JSON.parse(rawText);

t('the packaged library declares every site slot',
  widgetData.slots.map((slot) => slot.id).join(',') === library.SLOTS.map((slot) => slot.id).join(','),
  widgetData.slots.map((slot) => slot.id).join(','));

const siteVerses = library.SLOTS.flatMap((slot) => library.VERSES[slot.id].map((verse) => slot.id + '|' + verse.ref + '|' + verse.text));
const widgetVerses = widgetData.slots.flatMap((slot) => widgetData.verses[slot.id].map((verse) => slot.id + '|' + verse.ref + '|' + verse.text));
t('every verse, reference and slot reaches the widget unchanged',
  siteVerses.length === widgetVerses.length && siteVerses.every((verse, index) => verse === widgetVerses[index]),
  `${siteVerses.length} site verses, ${widgetVerses.length} packaged`);
t('the widget data is NIV', /NIV|New International Version/i.test(widgetData.translation));

/* The JSON keys Java reads must exist in the generated data — a renamed key
   would only surface as a blank widget on a phone. */
const jsonKeys = new Set();
(function collect(node) {
  if (Array.isArray(node)) node.forEach(collect);
  else if (node && typeof node === 'object') {
    Object.keys(node).forEach((key) => { jsonKeys.add(key); collect(node[key]); });
  }
})(widgetData);
const readKeys = new Set();
for (const match of java['VerseWidgetData.java'].matchAll(/opt(?:String|Int|Boolean|Double|JSONObject|JSONArray)\(\s*"([A-Za-z0-9_]+)"/g)) readKeys.add(match[1]);
const unknownKeys = [...readKeys].filter((key) => !jsonKeys.has(key));
t('every JSON key the widget reads exists in the packaged library',
  unknownKeys.length === 0, unknownKeys.join(', '));
t('the widget reads the verse text, the reference and the checkpoint dates',
  readKeys.has('ref') && readKeys.has('text') && readKeys.has('date') && readKeys.has('slot'));


/* The real parity test: the packaged checkpoints are replayed through the site
   library. If a verse is edited or a slot reordered, these fail before a user
   ever sees a widget quoting a different Scripture to the app. */
const mismatched = widgetData.checkpoints.filter((point) => {
  const [year, month, day] = point.date.split('-').map(Number);
  const verse = library.verseFor(point.slot, new Date(year, month - 1, day));
  return verse.reference !== point.ref || library.dayIndex(new Date(year, month - 1, day)) !== point.dayIndex;
});
t(`all ${widgetData.checkpoints.length} packaged checkpoints match the site rotation`, mismatched.length === 0,
  mismatched.slice(0, 3).map((point) => `${point.date}/${point.slot} ${point.ref}`).join(', '));
t('checkpoints cover a leap day, a year boundary and every slot',
  widgetData.checkpoints.some((point) => point.date === '2024-02-29') &&
  widgetData.checkpoints.some((point) => point.date.endsWith('12-31')) &&
  new Set(widgetData.checkpoints.map((point) => point.slot)).size === library.SLOTS.length);

const boundaryDrift = [];
for (let hour = 0; hour < 24; hour += 1) {
  const now = new Date(2026, 5, 15, hour, 30);
  let index = 0;
  widgetData.rotation.slotBoundaries.forEach((boundary, boundaryIndex) => {
    if (hour >= boundary) index = boundaryIndex;
  });
  const fromJson = widgetData.slots[index].id;
  const fromSite = library.currentSlot(now);
  if (fromJson !== fromSite) boundaryDrift.push(`${hour}:00 ${fromJson} vs ${fromSite}`);
}
t('the packaged slot boundaries agree with PD_VERSES.currentSlot() every hour',
  boundaryDrift.length === 0 && widgetData.rotation.slotBoundaries.length === library.SLOTS.length,
  boundaryDrift.join(', '));
t('the packaged rotation keeps the site formula and day counter',
  widgetData.rotation.indexFormula === '(dayIndex * slotCount + slotIndex) % poolSize' &&
  widgetData.rotation.dayIndexMillisecondsPerDay === 86400000 &&
  widgetData.rotation.slotOrder.join(',') === library.SLOTS.map((slot) => slot.id).join(','));

/* Java must apply that same rule — check the expressions, since the class cannot
   run in this environment. */
const dataJava = java['VerseWidgetData.java'];
t('Java applies the site rotation formula and a floored day counter',
  dataJava.includes('Math.floorMod(dayIndex(day) * slots.size() + index, (long) pool.size())') &&
  dataJava.includes('Math.floorDiv(day.getTimeInMillis() - start.getTimeInMillis(), MILLIS_PER_DAY)') &&
  dataJava.includes('R.raw.pd_widget_verses'));
t('Java replays the packaged checkpoints before trusting the data',
  dataJava.includes('public int selfCheck()') && dataJava.includes('checkpointRefs') &&
  dataJava.includes('isVerified()'));
t('the build script is the only writer of the packaged library',
  read('scripts/build-widget-verses.mjs').includes('pd_widget_verses.json'));

const regenerated = spawnSync(process.execPath, ['scripts/build-widget-verses.mjs', '--check'], { cwd: ROOT });
t('the packaged library is up to date with assets/pd-verse-data.js',
  regenerated.status === 0, String(regenerated.stderr || '').trim());

/* =================================================== 2. native wiring === */

const manifest = read(ANDROID + '/AndroidManifest.xml');
t('the manifest registers the verse widget receiver privately',
  /<receiver\s+android:name="\.VerseWidgetProvider"[\s\S]*?android:exported="false"/.test(manifest));
t('the receiver answers APPWIDGET_UPDATE and refreshes after a restart or update',
  ['android.appwidget.action.APPWIDGET_UPDATE', 'android.intent.action.BOOT_COMPLETED',
    'android.intent.action.MY_PACKAGE_REPLACED'].every((action) => manifest.includes(action)) &&
  manifest.includes('android.permission.RECEIVE_BOOT_COMPLETED'));
t('the receiver points at the widget metadata',
  manifest.includes('android.appwidget.provider') && manifest.includes('@xml/verse_widget_info'));

const widgetInfo = read(ANDROID + '/res/xml/verse_widget_info.xml');
t('the widget is offered on the home screen AND the lock screen',
  /android:widgetCategory="home_screen\|keyguard"/.test(widgetInfo));
t('the widget does not ask Android to poll it every 30 minutes',
  /android:updatePeriodMillis="0"/.test(widgetInfo));
t('the widget declares a resizable 4x2 card with a picker preview',
  widgetInfo.includes('android:targetCellWidth="4"') && widgetInfo.includes('android:targetCellHeight="2"') &&
  widgetInfo.includes('@layout/verse_widget_preview') && widgetInfo.includes('android:resizeMode="horizontal|vertical"'));

t('the Capacitor shell registers the widget plugin before the bridge starts',
  /registerPlugin\(VerseWidgetPlugin\.class\);\s*\n\s*super\.onCreate\(savedInstanceState\)/.test(java['MainActivity.java']));
t('the plugin exposes the studio API',
  ['getState', 'setPreferences', 'pinVerse', 'clearPin', 'refresh', 'requestPin', 'pendingRoute']
    .every((method) => new RegExp(`public void ${method}\\(PluginCall call\\)`).test(java['VerseWidgetPlugin.java'])) &&
  /@CapacitorPlugin\(name = "VerseWidget"\)/.test(java['VerseWidgetPlugin.java']));
t('tapping the widget opens the app at the verse studio',
  java['VerseWidgetRenderer.java'].includes('https://prayerdome.net/widgets') &&
  java['VerseWidgetRenderer.java'].includes('pd_route') &&
  java['VerseWidgetPlugin.java'].includes('pd_route'));
t('the widget schedules itself at the four slot boundaries',
  java['VerseWidgetScheduler.java'].includes('setAndAllowWhileIdle') &&
  java['VerseWidgetScheduler.java'].includes('millisUntilNextBoundary') &&
  java['VerseWidgetProvider.java'].includes('VerseWidgetScheduler.schedule(context)'));
t('the four boundary hours are midnight, 11:00, 14:00 and 18:00',
  library.SLOTS.length === 4 && widgetData.rotation.slotBoundaries.join(',') === '0,11,14,18');

/* Every resource the Java code references must exist — this is the check the
   Android build would otherwise only surface in a signed release. */
const resourceFiles = {};
function walkResources(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) { walkResources(full); continue; }
    const relative = path.relative(path.join(ROOT, ANDROID, 'res'), full).split(path.sep).join('/');
    // Text resources are read; binaries (splash PNGs) only need to exist.
    resourceFiles[relative] = /\.(xml|json)$/i.test(entry.name) ? fs.readFileSync(full, 'utf8') : '';
  }
}
walkResources(path.join(ROOT, ANDROID, 'res'));
const resourceCorpus = Object.values(resourceFiles).join('\n');

const missingResources = [];
for (const match of javaAll.matchAll(/\bR\.(layout|drawable|mipmap|string|color|raw|id|xml)\.([A-Za-z0-9_]+)/g)) {
  const kind = match[1];
  const name = match[2];
  const found = (() => {
    switch (kind) {
      case 'layout': return Object.keys(resourceFiles).some((file) => file.startsWith('layout') && file.endsWith('/' + name + '.xml'));
      case 'drawable': return Object.keys(resourceFiles).some((file) => file.startsWith('drawable') && /\/[^/]+\.xml$/.test(file) && path.basename(file, '.xml') === name);
      case 'mipmap': return Object.keys(resourceFiles).some((file) => file.startsWith('mipmap') && path.basename(file).startsWith(name + '.'));
      case 'raw': return Object.keys(resourceFiles).some((file) => file.startsWith('raw') && path.basename(file).startsWith(name + '.'));
      case 'xml': return Object.keys(resourceFiles).some((file) => file.startsWith('xml') && file.endsWith('/' + name + '.xml'));
      case 'string': return new RegExp(`<string name="${name}"`).test(resourceCorpus);
      case 'color': return new RegExp(`<color name="${name}"`).test(resourceCorpus);
      case 'id': return new RegExp(`@\\+id/${name}["\\s/>]`).test(resourceCorpus);
      default: return true;
    }
  })();
  if (!found) missingResources.push(`R.${kind}.${name}`);
}
t('every Android resource the widget Java references exists',
  missingResources.length === 0, missingResources.join(', '));

const layout = read(ANDROID + '/res/layout/verse_widget.xml');
const layoutIds = new Set([...layout.matchAll(/@\+id\/([A-Za-z0-9_]+)/g)].map((match) => match[1]));
const javaIds = new Set([...javaAll.matchAll(/\bR\.id\.([A-Za-z0-9_]+)/g)].map((match) => match[1]));
t('the card layout and the renderer agree on every view id',
  [...javaIds].every((id) => layoutIds.has(id)) && layoutIds.size >= 6,
  `java: ${[...javaIds].join(',')} | layout: ${[...layoutIds].join(',')}`);
t('the card uses only RemoteViews-safe view types',
  ['LinearLayout', 'TextView', 'ImageView'].every((type) => layout.includes(type)) &&
  !/(WebView|RecyclerView|ConstraintLayout)/.test(layout));

/* ==================================================== 3. the studio ===== */

t('the studio page exists and is written to disk', exists('widgets.html'));
const studio = read('widgets.html');
t('the studio loads the verse library and the widget bridge',
  studio.includes('/assets/pd-verse-data.js') && studio.includes('/assets/pd-widget.js'));
t('the studio carries managed SEO metadata and the icon system',
  studio.includes('PD-SEO:START') && studio.includes('rel="canonical" href="https://prayerdome.net/widgets"') &&
  studio.includes('/assets/pd-icons.css') && studio.includes('<script src="/assets/pd-icons.js"></script>'));
t('the studio explains both platforms',
  /Android/.test(studio) && /iPhone/.test(studio) && studio.includes('lock screen'));

const ids = [...studio.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
t('the studio has no duplicate element ids', duplicateIds.length === 0, [...new Set(duplicateIds)].join(', '));

/* The bridge script is a plain asset: run it in a sandbox and inspect the API. */
const bridgeSource = read('assets/pd-widget.js');
const sandbox = { console };
sandbox.window = sandbox;
sandbox.localStorage = {
  _data: {},
  getItem(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
  setItem(key, value) { this._data[key] = String(value); }
};
vm.createContext(sandbox);
vm.runInContext(bridgeSource, sandbox, { filename: 'pd-widget.js' });
vm.runInContext(read('assets/pd-verse-data.js'), sandbox, { filename: 'pd-verse-data.js' });
const verseLibrary = sandbox.PD_VERSES;
vm.runInContext('PDVerseWidget = (function(){ var api = window.PDVerseWidget; return api; })();', sandbox);
const bridge = sandbox.PDVerseWidget;

t('the bridge exposes the studio API',
  ['THEMES', 'preferences', 'savePreferences', 'available', 'state', 'pin', 'clearPin', 'refresh',
    'requestPin', 'todaysVerse', 'allVerses', 'searchVerses', 'renderCard']
    .every((key) => bridge[key] !== undefined));
t('the bridge is web-safe: no Capacitor means available() === false and the local verse still resolves',
  bridge.available() === false &&
  bridge.todaysVerse('morning').reference === verseLibrary.verseFor('morning').reference);
t('preferences round-trip through localStorage',
  (function () {
    bridge.savePreferences({ theme: 'dawn', textScale: 1.2, showBrand: false });
    const stored = JSON.parse(sandbox.localStorage.getItem('pd_verse_widget') || '{}');
    return stored.theme === 'dawn' && Math.abs(stored.textScale - 1.2) < 1e-9 && stored.showBrand === false;
  })());
t('the bridge clamps text size the same way the widget store does',
  bridge.clampScale(9) === 1.35 && bridge.clampScale(0.1) === 0.85);

const javaThemes = (java['VerseWidgetStore.java'].match(/THEMES = \{([^}]*)\}/) || ['', ''])[1]
  .split(',').map((value) => value.trim().replace(/^THEME_/, '').toLowerCase()).filter(Boolean);
t('the four themes are identical in the studio and on the phone',
  bridge.THEMES.map((theme) => theme.id).join(',') === javaThemes.join(','),
  `${bridge.THEMES.map((theme) => theme.id).join(',')} vs ${javaThemes.join(',')}`);
t('every studio theme has a matching native background drawable',
  bridge.THEMES.every((theme) => exists(`${ANDROID}/res/drawable/widget_verse_background${theme.id === 'midnight' ? '' : '_' + theme.id}.xml`)));

/* Record the wallpaper drawing calls: jsdom has no 2D context, and a fake one
   lets the studio's real canvas code run — line wrapping included. */
function installCanvasStub(window, sink) {
  window.HTMLCanvasElement.prototype.getContext = function (kind) {
    if (kind !== '2d') return null;
    const context = {
      canvas: this,
      font: '500 40px sans-serif',
      fillStyle: '', strokeStyle: '', lineWidth: 0, globalAlpha: 1, textAlign: 'center',
      createLinearGradient: () => ({ addColorStop: (stop, colour) => sink.push(['gradient', stop, colour]) }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      fillRect: () => {}, strokeRect: () => {},
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, quadraticCurveTo: () => {}, closePath: () => {},
      fill: () => {}, stroke: () => sink.push(['stroke', context.strokeStyle]),
      fillText: (value, x, y) => sink.push(['text', context.font, String(value), x, y]),
      measureText: (value) => ({ width: value.length * (Number((context.font.match(/(\d+)px/) || [0, 40])[1]) * 0.5) })
    };
    return context;
  };
}

/* The page itself, booted in jsdom with the real assets. */
(async () => {
  const virtualConsole = new VirtualConsole();
  const jsdomErrors = [];
  virtualConsole.on('jsdomError', (error) => jsdomErrors.push(String(error && error.message)));
  const dom = new JSDOM(studio, {
    runScripts: 'outside-only',
    url: 'https://prayerdome.net/widgets',
    virtualConsole
  });
  const w = dom.window;

  const drawCalls = [];
  installCanvasStub(w, drawCalls);
  w.PD_VERSES = verseLibrary;
  w.eval(bridgeSource);
  const inline = [...w.document.querySelectorAll('script:not([src]):not([type])')].map((node) => node.textContent).join('\n');
  try { w.eval(inline); } catch (error) { console.error('studio script error:', error.message); }
  if (w.document.readyState === 'loading') w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const canvasMissing = jsdomErrors.some((message) => /getContext/.test(message));
  const d = w.document;
  const card = d.getElementById('pdWidgetPreview');
  t('the studio renders today’s verse card on load',
    !!card && card.textContent.trim().length > 40 &&
    card.textContent.includes(verseLibrary.verseFor(verseLibrary.currentSlot()).reference),
    card ? card.textContent.slice(0, 60) : 'no card');
  t('the theme picker lists all four themes',
    d.getElementById('vwTheme') && d.getElementById('vwTheme').options.length === bridge.THEMES.length);
  t('the device picker offers iPhone and Android wallpaper sizes',
    d.getElementById('vwDevice') && d.getElementById('vwDevice').options.length >= 5 &&
    /iPhone/.test(d.getElementById('vwDevice').textContent) && /Android/.test(d.getElementById('vwDevice').textContent));
  t('the verse library lists verses and filters on search',
    (function () {
      const list = d.getElementById('vwVerseList');
      const before = list.querySelectorAll('.vw-verse-item').length;
      const input = d.getElementById('vwVerseSearch');
      input.value = 'Psalm 4';
      input.dispatchEvent(new w.Event('input'));
      const after = list.querySelectorAll('.vw-verse-item').length;
      return before > 5 && after > 0 && after < before;
    })());

  t('choosing a verse shows it on the card and drafts the wallpaper',
    (function () {
      const first = d.querySelector('#vwVerseList .vw-verse-item');
      first.dispatchEvent(new w.Event('click', { bubbles: true }));
      return d.getElementById('pdWidgetPreview').textContent.includes('Psalm 4') &&
        /Wallpaper drafted/.test(d.getElementById('vwWallStatus').textContent);
    })());

  t('the web studio tells members the widget needs the app',
    /website/.test(d.getElementById('vwStatusText').textContent) ||
    /steps/.test(d.getElementById('vwStatusText').textContent));
  t('the bridge never claims a widget is placed outside the app',
    /No widget placed|website|steps/.test(d.getElementById('vwStatusText').textContent));
  t('the wallpaper canvas is drawn at the phone resolution with the theme gradient',
    (function () {
      drawCalls.length = 0;
      d.getElementById('vwWallTheme').value = 'midnight';
      d.getElementById('vwWallTheme').dispatchEvent(new w.Event('change'));
      const canvas = d.getElementById('vwCanvas');
      const stops = drawCalls.filter((call) => call[0] === 'gradient').map((call) => call[2]);
      return canvas.width >= 1080 && canvas.height > canvas.width &&
        stops.includes('#07244D') && stops.includes('#0A3D7A') &&
        drawCalls.some((call) => call[0] === 'stroke');
    })());
  t('the wallpaper prints the wrapped verse, its reference and the Prayer Dome wordmark',
    (function () {
      const printed = drawCalls.filter((call) => call[0] === 'text').map((call) => call[2]);
      const body = printed.filter((line) => !/^— /.test(line) && line !== 'PRAYER DOME' && line !== 'prayerdome.net');
      return body.length >= 3 && body.join(' ').length > 60 &&
        printed.some((line) => /— .+ \(NIV\)$/.test(line)) &&
        printed.includes('PRAYER DOME') && printed.includes('prayerdome.net');
    })());
  t('changing the phone model redraws at the new resolution',
    (function () {
      d.getElementById('vwDevice').value = 'android-qhd';
      d.getElementById('vwDevice').dispatchEvent(new w.Event('change'));
      return d.getElementById('vwCanvas').width === 1440 && d.getElementById('vwCanvas').height === 3120;
    })());
  t('turning the reference off removes it from the next draw',
    (function () {
      drawCalls.length = 0;
      d.getElementById('vwWallRef').checked = false;
      d.getElementById('vwWallRef').dispatchEvent(new w.Event('change'));
      return !drawCalls.some((call) => call[0] === 'text' && /\(NIV\)$/.test(call[2]));
    })());
  t('the verse size slider scales the printed Scripture',
    (function () {
      drawCalls.length = 0;
      const slider = d.getElementById('vwWallScale');
      slider.value = '1.3';
      slider.dispatchEvent(new w.Event('change'));
      const sizes = drawCalls.filter((call) => call[0] === 'text' && /^\(?/.test(call[1]))
        .map((call) => Number((call[1].match(/(\d+)px/) || [0, 0])[1]));
      return Math.max(...sizes) > 1440 * 0.062 * 1.25;
    })());

  t('a browser without canvas support is told the preview cannot be drawn',
    (function () {
      const original = w.HTMLCanvasElement.prototype.getContext;
      w.HTMLCanvasElement.prototype.getContext = function () { return null; };
      const device = d.getElementById('vwDevice');
      device.dispatchEvent(new w.Event('change'));
      const message = d.getElementById('vwWallStatus').textContent;
      w.HTMLCanvasElement.prototype.getContext = original;
      device.dispatchEvent(new w.Event('change'));
      return /cannot draw the wallpaper/.test(message);
    })(),
    'jsdom reported: ' + (canvasMissing ? 'no canvas' : 'canvas stub in use'));

  /* ================================= 3b. inside the app (native bridge) == */
  /* The Capacitor plugin is Java, so the contract these checks hold is the
     other half: with a native widget present the studio must render the phone's
     own preferences, save through the plugin, pin/unpin through it, ask it to
     place the widget, and read the route a widget tap came in on. */
  const nativeCalls = [];
  const nativeDom = new JSDOM(studio, { runScripts: 'outside-only', url: 'https://prayerdome.net/widgets.html' });
  const nw = nativeDom.window;
  const nativePreferences = {
    theme: 'dome', textScale: 1.15, showGreeting: false, showReference: true, showBrand: true,
    mode: 'auto', pinnedReference: '', pinnedText: '', pinnedLabel: '', themes: ['midnight', 'dome', 'dawn', 'paper']
  };
  nw.Capacitor = {
    Plugins: {
      VerseWidget: {
        getState: () => Promise.resolve({
          available: true, placed: 1, canPin: true, verified: true,
          preferences: nativePreferences,
          verse: { reference: 'Psalm 23:1', text: 'The LORD is my shepherd; I shall not want.',
            slot: 'morning', slotLabel: 'Morning Verse', greeting: 'Good morning', translation: "NIV" },
          slots: []
        }),
        setPreferences: (payload) => { nativeCalls.push(['setPreferences', payload]); return Promise.resolve({}); },
        pinVerse: (payload) => { nativeCalls.push(['pinVerse', payload]); return Promise.resolve({}); },
        clearPin: () => { nativeCalls.push(['clearPin']); return Promise.resolve({}); },
        refresh: () => { nativeCalls.push(['refresh']); return Promise.resolve({}); },
        requestPin: () => { nativeCalls.push(['requestPin']); return Promise.resolve({ requested: true }); },
        pendingRoute: () => { nativeCalls.push(['pendingRoute']); return Promise.resolve({ route: '/widgets.html' }); }
      }
    }
  };
  installCanvasStub(nw, nativeCalls);
  nw.PD_VERSES = verseLibrary;
  nw.eval(bridgeSource);
  const nativeInline = [...nw.document.querySelectorAll('script:not([src]):not([type])')].map((node) => node.textContent).join('\n');
  try { nw.eval(nativeInline); } catch (error) { console.error('native studio script error:', error.message); }
  if (nw.document.readyState === 'loading') nw.document.dispatchEvent(new nw.Event('DOMContentLoaded'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const nd = nw.document;

  t('inside the app the studio knows the widget is placed and verified',
    /on this phone/.test(nd.getElementById('vwStatusText').textContent) &&
    !/website/.test(nd.getElementById('vwStatusText').textContent),
    nd.getElementById('vwStatusText').textContent);
  t('the phone\u2019s own preferences fill the studio controls',
    nd.getElementById('vwTheme').value === 'dome' &&
    Math.abs(Number(nd.getElementById('vwScale').value) - 1.15) < 1e-9 &&
    nd.getElementById('vwGreeting').checked === false);
  t('the widget card shows the verse the phone is displaying',
    nd.getElementById('pdWidgetPreview').textContent.includes('Psalm 23:1'));

  nd.getElementById('vwReference').checked = false;
  nd.getElementById('vwSave').dispatchEvent(new nw.Event('click'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const saved = nativeCalls.find((call) => call[0] === 'setPreferences');
  t('saving sends the theme, size and toggles to the native widget',
    !!saved && saved[1].theme === 'dome' && saved[1].showReference === false &&
    typeof saved[1].textScale === 'number',
    saved ? JSON.stringify(saved[1]) : 'no call');

  nd.querySelector('#vwVerseList .vw-verse-item').dispatchEvent(new nw.Event('click', { bubbles: true }));
  nd.getElementById('vwPinSelected').dispatchEvent(new nw.Event('click'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const pinned = nativeCalls.find((call) => call[0] === 'pinVerse');
  t('pinning hands the chosen verse to the widget',
    !!pinned && !!pinned[1].reference && pinned[1].text.length > 10,
    pinned ? pinned[1].reference : 'no call');

  nd.getElementById('vwUnpin').dispatchEvent(new nw.Event('click'));
  nd.getElementById('vwRefresh').dispatchEvent(new nw.Event('click'));
  nd.getElementById('vwAddWidget').dispatchEvent(new nw.Event('click'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  t('unpin, refresh and add-widget every reach the plugin',
    nativeCalls.some((call) => call[0] === 'clearPin') &&
    nativeCalls.some((call) => call[0] === 'refresh') &&
    nativeCalls.some((call) => call[0] === 'requestPin'));
  t('the studio reports that Android is placing the widget',
    /asking where to place/.test(nd.getElementById('vwStatusText').textContent),
    nd.getElementById('vwStatusText').textContent);
  t('a widget tap brings its route into the app',
    (await nw.PDVerseWidget.pendingRoute()) === '/widgets.html');

  /* ============================================ 4. plumbing ============== */
  const sw = read('sw.js');
  t('the service worker precaches the studio and the bridge',
    sw.includes("'/widgets.html'") && sw.includes("'/assets/pd-widget.js'"));
  const vercel = JSON.parse(read('vercel.json'));
  const firebase = JSON.parse(read('firebase.json'));
  t('Vercel rewrites /widgets to the page',
    (vercel.rewrites || []).some((rule) => rule.source === '/widgets' && rule.destination === '/widgets.html'));
  t('Firebase hosting rewrites /widgets to the page',
    (firebase.hosting.rewrites || []).some((rule) => rule.source === '/widgets' && rule.destination === '/widgets.html'));
  t('the sitemap lists the studio', /<loc>https:\/\/prayerdome\.net\/widgets<\/loc>/.test(read('sitemap.xml')));
  const seo = JSON.parse(read('seo/pages.json'));
  t('the SEO source of truth describes the studio',
    seo.pages['widgets.html'] && seo.pages['widgets.html'].path === '/widgets' &&
    /lock screen/i.test(seo.pages['widgets.html'].description));
  t('the verse settings card links members to the studio', read('assets/pd-verse-alerts.js').includes('/widgets.html'));
  t('the pages a widget tap can land on load the bridge',
    ['index.html', 'account.html'].every((page) => read(page).includes('/assets/pd-widget.js')));
  t('the shared drawer offers the studio on pages without their own drawer',
    read('assets/pd-app.js').includes("{href:'/widgets', icon:'pd-i-smartphone', label:'Verse Widget'}"));
  t('the home screen offers the studio',
    read('index.html').includes('href="/widgets.html"'));
  t('the widget build runs on sync and is checked by lint',
    JSON.parse(read('package.json')).scripts['mobile:prepare'].includes('build-widget-verses.mjs') &&
    JSON.parse(read('package.json')).scripts.lint.includes('build-widget-verses.mjs --check'));

  console.log(`\n${passed} widget checks passed${process.exitCode ? ' with failures' : ''}.`);
})();
