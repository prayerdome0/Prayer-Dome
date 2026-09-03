'use strict';

/*
 * Whole-app translation tests.
 *
 * These guard the two promises the translation layer makes:
 *   1. Selecting a language translates the *page*, not just tagged elements.
 *   2. Switching back to English restores the original text exactly, so a
 *      partially-translated page can never strand a worshipper.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
let passed = 0;
let failed = 0;
function t(name, condition, detail = '') {
  if (condition) passed += 1;
  else failed += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
}

const phrasesSrc = fs.readFileSync(path.join(ROOT, 'assets/pd-phrases.js'), 'utf8');
const enginePrc = fs.readFileSync(path.join(ROOT, 'assets/pd-i18n.js'), 'utf8');
const LANGS = ['tum', 'ssw', 'bem', 'nya'];

function page(file, html) {
  const dom = new JSDOM(html || fs.readFileSync(path.join(ROOT, file), 'utf8'),
    { runScripts: 'outside-only' });
  dom.window.eval(phrasesSrc);
  dom.window.eval(enginePrc);
  return dom.window;
}

/* ---------------------------------------------------------- phrase pack */
const { PD_PHRASES, PD_PHRASE_ROWS } = require(path.join(ROOT, 'assets/pd-phrases.js'));

t('phrase pack exposes every supported language',
  ['en'].concat(LANGS).every(l => PD_PHRASES[l] && typeof PD_PHRASES[l] === 'object'));

t('phrase pack carries a substantial dictionary',
  Object.keys(PD_PHRASES.en).length >= 300,
  `${Object.keys(PD_PHRASES.en).length} phrases`);

t('every language covers every English key',
  LANGS.every(l => Object.keys(PD_PHRASES[l]).length === Object.keys(PD_PHRASES.en).length));

t('no translation is left as an empty string',
  LANGS.every(l => Object.keys(PD_PHRASES[l]).every(k => String(PD_PHRASES[l][k]).trim().length > 0)));

t('no translation is accidentally identical to English for a whole language',
  LANGS.every(l => {
    const keys = Object.keys(PD_PHRASES[l]);
    const same = keys.filter(k => PD_PHRASES[l][k] === k).length;
    return same < keys.length * 0.5;
  }));

t('compact rows declare exactly four languages each',
  Object.keys(PD_PHRASE_ROWS).every(k => Array.isArray(PD_PHRASE_ROWS[k]) &&
    PD_PHRASE_ROWS[k].length === LANGS.length));

/* ------------------------------------------------------- engine basics */
const fixture = `<!doctype html><html><head><title>t</title></head><body>
  <a href="/">Home</a>
  <button title="Cancel">Cancel</button>
  <input placeholder="Full Name">
  <p>  Prayer Wall:  </p>
  <span>🙏 Give</span>
  <script>var untouched = "Home";<\/script>
  <code>Home</code>
  <p data-pd-no-i18n>Home</p>
  <p>Text with no dictionary entry whatsoever</p>
</body></html>`;

{
  const w = page(null, fixture);
  const english = w.document.body.innerHTML;

  w.PDI18n.apply('nya');
  const html = w.document.body.innerHTML;

  t('translates plain element text', html.includes('Kunyumba'));
  t('translates title attributes', w.document.querySelector('button').title === 'Lekani');
  t('translates placeholder attributes',
    w.document.querySelector('input').placeholder === 'Dzina Lonse');
  t('preserves surrounding whitespace and a trailing colon',
    html.includes('  Khoma la Pemphero:  '), JSON.stringify(html.match(/ +Khoma[^<]*/)?.[0]));
  t('keeps decorative emoji in front of a translated word', html.includes('🙏 Perekani'));
  t('never touches script contents', html.includes('var untouched = "Home"'));
  t('never touches code blocks', html.includes('<code>Home</code>'));
  t('honours the data-pd-no-i18n opt-out',
    w.document.querySelector('[data-pd-no-i18n]').textContent === 'Home');
  t('leaves unknown phrases in English',
    html.includes('Text with no dictionary entry whatsoever'));
  t('sets the document language', w.document.documentElement.getAttribute('lang') === 'nya');

  w.PDI18n.apply('en');
  t('switching back to English restores the page byte for byte',
    w.document.body.innerHTML === english);
}

/* Every language must round-trip cleanly, not just one. */
for (const lang of LANGS) {
  const w = page(null, fixture);
  const english = w.document.body.innerHTML;
  w.PDI18n.apply(lang);
  const translated = w.document.body.innerHTML;
  w.PDI18n.apply('en');
  t(`${lang}: translates then restores English exactly`,
    translated !== english && w.document.body.innerHTML === english);
}

/* Dynamically rendered content must be translated too. */
{
  const w = page(null, fixture);
  w.PDI18n.apply('nya');
  const div = w.document.createElement('div');
  div.textContent = 'Testimony';
  w.document.body.appendChild(div);
  // MutationObserver callbacks are microtask-scheduled in jsdom.
  const done = new Promise(resolve => setTimeout(resolve, 0));
  done.then(() => {
    t('a node added after switching language is translated',
      div.textContent === 'Umboni', div.textContent);
    finish();
  });
}

/* ------------------------------------------------- real pages translate */
function finish() {
  const samples = ['index.html', 'prayer.html', 'events.html', 'account.html'];
  for (const file of samples) {
    const w = page(file);
    const before = w.document.body.textContent;
    w.PDI18n.apply('nya');
    const after = w.document.body.textContent;
    const cov = w.PDI18n.coverage('nya');

    t(`${file}: visible text changes when a language is chosen`, before !== after);
    t(`${file}: a meaningful share of the page is translated`, cov.percent >= 20,
      `${cov.percent}% of ${cov.total} text nodes`);

    w.PDI18n.apply('en');
    t(`${file}: returns to the exact English original`,
      w.document.body.textContent === before);
  }

  /* Every page must load the translation layer, or that page stays English. */
  const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
  const missing = pages.filter(p => {
    const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
    return !html.includes('pd-phrases.js') || !html.includes('pd-i18n.js');
  });
  t('every html page ships the translation engine', missing.length === 0, missing.join(', '));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
