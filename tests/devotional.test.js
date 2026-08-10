/*
 * Tests for the Daily Devotional system (devotional-data.js) and its
 * integration with the homepage (index.html).
 * No dependencies:  node tests/devotional.test.js
 */
const { execFileSync } = require('child_process');
const { readFileSync, writeFileSync, mkdtempSync, rmSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');

const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'devotional-data.js');
const HOME = join(ROOT, 'index.html');

let pass = 0, fail = 0;
function t(name, ok, extra) {
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  ' + extra : ''));
}

/* ===================== 1. Module parses ===================== */
// The homepage `import`s devotional-data.js as an ES module. `node --check`
// on a plain .js file runs the CommonJS parser only and misses module syntax
// errors, so check a .mjs copy to use the real ES module parser.
let tempDir = null;
try {
  tempDir = mkdtempSync(join(tmpdir(), 'pd-devotional-test-'));
  const mjs = join(tempDir, 'devotional-data.mjs');
  writeFileSync(mjs, readFileSync(DATA, 'utf8'), 'utf8');
  execFileSync(process.execPath, ['--check', mjs], { stdio: 'pipe' });
  t('devotional-data.js parses as an ES module', true);
} catch (e) {
  t('devotional-data.js parses as an ES module', false,
    String(e.stderr || e.message).trim().split('\n').slice(0, 4).join(' '));
} finally {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
}

/* ===================== 2. Module works ===================== */
const probe = `
  const m = await import(${JSON.stringify(DATA)});
  const failures = [];
  const ok = (c, msg) => { if (!c) failures.push(msg); };

  // Data shape: every devotional in every period must be complete.
  for (const period of ['morning', 'afternoon', 'evening']) {
    const list = m.devotionalsDB[period];
    ok(Array.isArray(list) && list.length > 0, period + ' is a non-empty array');
    for (const d of list || []) {
      for (const field of ['verse', 'text', 'message', 'prayer']) {
        ok(d && typeof d[field] === 'string' && d[field].trim().length > 0,
           period + ' entry missing ' + field + ' (' + (d && d.verse) + ')');
      }
    }
  }

  // getDailyDevotional() must return a complete devotional for today.
  const dev = m.getDailyDevotional();
  ok(dev && typeof dev.period === 'string' && dev.period.length > 0, 'period set');
  ok(dev && typeof dev.periodName === 'string' && dev.periodName.length > 0, 'periodName set');
  for (const field of ['verse', 'text', 'message', 'prayer']) {
    ok(dev && typeof dev[field] === 'string' && dev[field].trim().length > 0,
       'today missing ' + field);
  }

  // Countdown helpers.
  const remaining = m.getNextUpdateTime();
  ok(typeof remaining === 'number' && remaining > 0 && remaining < 24 * 3600 * 1000,
     'getNextUpdateTime returns a sane value (' + remaining + ')');
  ok(/^\\d+h \\d+m \\d+s$/.test(m.formatCountdown(2 * 3600 * 1000 + 61 * 1000)),
     'formatCountdown returns "Xh Ym Zs" (' + m.formatCountdown(2 * 3600 * 1000 + 61 * 1000) + ')');

  // Day of year is 1..366.
  const doy = m.getDayOfYear();
  ok(doy >= 1 && doy <= 366, 'getDayOfYear in range (' + doy + ')');

  console.log(failures.length ? 'FAILURES:' + JSON.stringify(failures) : 'PROBE OK');
  process.exit(failures.length ? 1 : 0);
`;
let probeOut = '';
try {
  probeOut = execFileSync(process.execPath, ['--input-type=module', '-e', probe],
    { stdio: 'pipe', encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  t('getDailyDevotional returns a complete devotional', probeOut.includes('PROBE OK'));
} catch (e) {
  t('getDailyDevotional returns a complete devotional', false,
    String(e.stdout || e.stderr || e.message).trim().split('\n').slice(0, 4).join(' '));
}

/* ===================== 3. Homepage integration ===================== */
const home = readFileSync(HOME, 'utf8');
const importMatch = home.match(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/devotional-data\.js['"]/);
const imported = importMatch ? importMatch[1] : '';
t('index.html imports ./devotional-data.js', !!importMatch);
t('index.html imports getDailyDevotional', /getDailyDevotional/.test(imported));
t('index.html imports getNextUpdateTime', /getNextUpdateTime/.test(imported));
t('index.html imports formatCountdown', /formatCountdown/.test(imported));
for (const id of ['timezoneInfo', 'dailyScripture', 'dailyRef', 'dailyMessage', 'dailyPrayer', 'nextUpdateCountdown']) {
  t('index.html has #' + id, new RegExp('id="' + id + '"').test(home));
}
t('index.html calls initDevotionalSystem()', /initDevotionalSystem\(\)/.test(home));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
