'use strict';

/*
 * Whole-app translation tests.
 *
 * These guard the promises the translation layer makes:
 *   1. Selecting a language translates the *page*, not just tagged elements.
 *   2. Switching back to English restores the original text exactly, so a
 *      partially-translated page can never strand a worshipper.
 *   3. The auto tier (live machine translation for text the reviewed phrase
 *      pack does not cover) translates everything else, badges it with an
 *      "auto" chip, caches it, and can never override the pack.
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
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

/* A deterministic fake machine translator: each phrase becomes
 * "⟦tum⟧ " + reversed words, so tests can tell Tier-2 output from Tier-1. */
function fakeTranslator(callLog) {
  const calls = callLog || [];
  return function (texts, lang) {
    calls.push({ lang, texts: texts.slice() });
    return Promise.resolve(texts.map(s =>
      '⟦' + lang + '⟧ ' + s.split(/\s+/).reverse().join(' ')));
  };
}

async function main() {
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
    t('leaves unknown phrases in English without a translator',
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

  /* ---------------------------------------------- Tier 2 — auto tier ------ */
  const autoFixture = `<!doctype html><html><head></head><body>
  <p id="packHit">Home</p>
  <p>Text with no dictionary entry whatsoever</p>
  <input placeholder="Tell us what happened today">
  <select aria-label="Language"><option value="en">English</option><option value="tum">Tumbuka</option></select>
  <p data-pd-no-auto>This sentence lives under an opt-out marker.</p>
  <p>Prayer Dome Zambia</p>
</body></html>`;

  /* 1. Everything the pack misses is auto-translated, badged, cached. */
  {
    const calls = [];
    const w = page(null, autoFixture);
    w.PDI18n.setTranslator(fakeTranslator(calls));
    const englishBody = w.document.body.innerHTML;
    w.PDI18n.apply('tum');
    await w.PDI18n.autoReady();

    const text = w.document.body.textContent;
    t('auto tier translates long paragraphs the pack does not cover',
      text.includes('⟦tum⟧') , text.slice(0, 300));
    t('auto tier translates untouched placeholder attributes too',
      w.document.querySelector('input').placeholder.includes('⟦tum⟧'),
      w.document.querySelector('input').placeholder);
    t('auto output is badged with a visible chip',
      w.document.querySelectorAll('.pd-auto-chip').length >= 1,
      `${w.document.querySelectorAll('.pd-auto-chip').length} chips`);
    t('badge explains it is machine output awaiting review',
      (w.document.querySelector('.pd-auto-chip').getAttribute('title') || '').includes('have not checked yet'));
    t('auto tier never touches select option labels',
      [...w.document.querySelectorAll('option')].every(o => /^(English|Tumbuka)$/.test(o.textContent)));
    t('data-pd-no-auto subtrees are exempt from the machine tier',
      w.document.body.textContent.includes('This sentence lives under an opt-out marker.'));
    t('reviewed pack entries still win over the auto tier',
      w.document.querySelector('#packHit').textContent === 'Kunyumba',
      w.document.querySelector('#packHit').textContent);
    t('a pack-translated block never receives an auto badge',
      !w.document.querySelector('#packHit').querySelector('.pd-auto-chip'));
    t('the machine tier fetched only the phrases that needed it',
      calls.every(c => c.texts.every(s => s !== 'Home')), JSON.stringify(calls));

    /* Cache: switching away and back must not call the translator again. */
    w.PDI18n.apply('en');
    const before = calls.length;
    w.PDI18n.apply('tum');
    await w.PDI18n.autoReady();
    t('auto translations are cached — a second visit never re-fetches',
      calls.length === before, `${before} → ${calls.length} translator calls`);

    w.PDI18n.apply('en');
    t('auto tier round-trips back to byte-exact English and drops badges',
      w.document.body.innerHTML === englishBody && w.document.querySelectorAll('.pd-auto-chip').length === 0);
  }

  /* 2. Failure is graceful: no translator service → English, no crash. */
  {
    const w = page(null, autoFixture);
    w.PDI18n.apply('bem');
    await w.PDI18n.autoReady();
    t('without a configured translator the page stays safely in English',
      w.document.body.textContent.includes('Text with no dictionary entry whatsoever'));
  }

  /* 3. A rejecting translator also degrades gracefully. */
  {
    const w = page(null, autoFixture);
    w.PDI18n.setTranslator(() => Promise.reject(new Error('offline')));
    w.PDI18n.apply('nya');
    await w.PDI18n.autoReady();
    t('a failed auto request leaves English and raises no unhandled error',
      w.document.body.textContent.includes('Text with no dictionary entry whatsoever') &&
      w.document.querySelectorAll('.pd-auto-chip').length === 0);
  }

  /* 3b. Google leaves proper nouns / brand text unchanged — that must be a
     cached no-op, never a rewritten node and never a repeated request. */
  {
    const calls = [];
    const w = page(null, autoFixture);
    w.PDI18n.setTranslator((texts) => {
      calls.push(texts.length);
      return Promise.resolve(texts.map(s => s));       // identity translation
    });
    w.PDI18n.apply('tum');
    await w.PDI18n.autoReady();
    const afterFirst = calls.length;
    t('an unchanged machine response never rewrites page text',
      w.document.body.textContent.includes('Text with no dictionary entry whatsoever') &&
      w.document.body.textContent.includes('This sentence lives under an opt-out marker.') &&
      w.document.querySelector('input').placeholder === 'Tell us what happened today' &&
      w.document.querySelectorAll('.pd-auto-chip').length === 0,
      w.document.body.textContent.slice(0, 200));
    t('unchanged responses are still fetched only when needed',
      afterFirst >= 1, `${afterFirst} request(s)`);
    w.PDI18n.apply('en');
    w.PDI18n.apply('tum');
    await w.PDI18n.autoReady();
    t('no-op results are cached — the translator is not asked twice',
      calls.length === afterFirst, `${afterFirst} → ${calls.length}`);
  }

  /* 4. Dynamically rendered content reaches the auto tier too. */
  {
    const calls = [];
    const w = page(null, autoFixture);
    w.PDI18n.setTranslator(fakeTranslator(calls));
    w.PDI18n.apply('ssw');
    await w.PDI18n.autoReady();

    const div = w.document.createElement('div');
    div.textContent = 'A brand new dynamic announcement with fresh words';
    w.document.body.appendChild(div);
    await sleep(140);           // observer microtask + 80 ms scan debounce
    await w.PDI18n.autoReady();

    t('content added after language switch is auto-translated too',
      div.textContent.includes('⟦ssw⟧'), div.textContent);
  }

  /* 5. End-to-end: the engine's default translator posts to the real relay
     handler (functions/translate.js) with Google stubbed behind it. */
  {
    const relay = require(path.join(ROOT, 'functions', 'translate.js'));
    const { PassThrough } = require('stream');
    const googleCalls = [];
    const savedFetch = global.fetch;
    global.fetch = async (url) => {
      googleCalls.push(url);
      const q = new URL(url).searchParams.get('q') || '';
      return { ok: true, json: async () => [[[`⟦${q}⟧`, q, null, null, 1]]] };
    };
    try {
      const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'privacy.html'), 'utf8'),
        { runScripts: 'outside-only' });
      /* Give the engine a fetch: the same-origin relay, in-process. */
      dom.window.fetch = (url, opts) => {
        const req = new PassThrough();
        req.method = (opts && opts.method) || 'POST';
        req.url = url;
        req.headers = { origin: 'https://prayerdome.net' };
        if (opts && opts.body) req.write(opts.body);
        req.end();
        const res = {
          headers: {},
          statusCode: 200,
          body: '',
          setHeader(k, v) { this.headers[k] = v; },
          writeHead(code, h) { this.statusCode = code; if (h) Object.assign(this.headers, h); },
          end(body) { this.body = body || ''; }
        };
        return relay(req, res).then(() => ({
          ok: res.statusCode < 400,
          json: async () => JSON.parse(res.body)
        }));
      };
      dom.window.eval(phrasesSrc);
      dom.window.eval(enginePrc);
      const w = dom.window;
      const english = w.document.body.innerHTML;
      w.PDI18n.apply('tum');
      await w.PDI18n.autoReady();

      const hasAuto = w.document.body.innerHTML.includes('⟦');
      t('end-to-end: relay-backed engine machine-translates an entire content page',
        hasAuto && w.document.querySelectorAll('.pd-auto-chip').length >= 1,
        `${w.document.querySelectorAll('.pd-auto-chip').length} chips, ${googleCalls.length} upstream call(s)`);
      t('end-to-end: relay output survives a byte-exact English round-trip',
        (() => { w.PDI18n.apply('en'); return w.document.body.innerHTML === english; })());
    } finally {
      global.fetch = savedFetch;
    }
  }

  /* ------------------------------------------------- real pages translate */
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

  /* Curated Scripture keeps its own provenance workflow: machine text may
     never pose as Scripture. */
  const scriptureMarked = ['translate.html', 'bible.html', 'offline.html', 'index.html']
    .filter(f => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('data-pd-no-auto'));
  t('curated Scripture containers opt out of the machine tier',
    scriptureMarked.length === 4, scriptureMarked.join(', '));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
