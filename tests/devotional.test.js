/* ============================================================================
 * Prayer Dome — Devotional scheduler tests
 * ----------------------------------------------------------------------------
 * Verifies the Cloud Function picker (functions/devotionals.js) agrees with
 * the client data (devotional-data.js) and behaves correctly across seasons,
 * featured days and the day-of-year rotation. No Firebase SDKs needed.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const dev = require(path.join(ROOT, 'functions', 'devotionals.js'));
const fnData = JSON.parse(fs.readFileSync(path.join(ROOT, 'functions', 'devotionals.json'), 'utf8'));

let passed = 0, failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('PASS  ' + name); }
  else { failed++; console.error('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
}

/* ------------------------------------------------------------- data parity */
const clientSrc = fs.readFileSync(path.join(ROOT, 'devotional-data.js'), 'utf8');
ok('devotionals.json mirrors the client morning set', fnData.devotionalsDB.morning.length === 10);
ok('devotionals.json mirrors the client afternoon set', fnData.devotionalsDB.afternoon.length === 10);
ok('devotionals.json mirrors the client evening set', fnData.devotionalsDB.evening.length === 10);
ok('seasonal devotionals carried over',
  ['christmas', 'easter', 'newYear', 'thanksgiving', 'valentines', 'palmSunday', 'pentecost', 'advent']
    .every(s => fnData.seasonalDevotionals[s] && fnData.seasonalDevotionals[s].verse));
// Parse the client file with the same extraction the JSON was generated with,
// then require exact parity — the scheduler must never drift from the site.
function grab(name) {
  const key = name + ' = ';
  const start = clientSrc.indexOf(key) + key.length;
  let depth = 0, i = start;
  for (; i < clientSrc.length; i++) {
    const c = clientSrc[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  return new Function('return (' + clientSrc.slice(start, i + 1) + ')')();
}
ok('functions/devotionals.json is byte-identical to the client data',
  JSON.stringify(fnData) === JSON.stringify({ devotionalsDB: grab('devotionalsDB'), seasonalDevotionals: grab('seasonalDevotionals') }));

/* ------------------------------------------------------------ date helpers */
const parts = dev.localParts(new Date('2026-08-03T13:00:00Z'));
ok('localParts resolves timezone (Lusaka = UTC+2)', parts.hour === 15, 'hour=' + parts.hour);

/* --------------------------------------------------------------- picker   */
const ordinary = dev.pickDevotional(new Date('2026-08-03T08:00:00'));
ok('ordinary day returns a daily devotional', ordinary.period === 'morning' && !!ordinary.verse);
ok('ordinary day carries a date key', ordinary.date === '2026-08-03');
ok('afternoon picks afternoon set', dev.pickDevotional(new Date('2026-08-03T13:00:00')).period === 'afternoon');
ok('evening picks evening set', dev.pickDevotional(new Date('2026-08-03T20:00:00')).period === 'evening');
ok('late night (00:30) still counts as evening', dev.pickDevotional(new Date('2026-08-04T00:30:00')).period === 'evening');

const xmas = dev.pickDevotional(new Date('2026-12-24T08:00:00'));
ok('Christmas season wins over the daily rotation', xmas.period === 'christmas' && xmas.verse === 'Luke 2:10-11');
const easter = dev.pickDevotional(new Date('2026-04-02T08:00:00'));
ok('Easter season wins over the daily rotation', easter.period === 'easter');
const featured = dev.pickDevotional(new Date('2026-08-15T08:00:00'));
ok('the 1st/15th surface the Mark 7:37 theme', featured.period === 'featured' && featured.verse === 'Mark 7:37');
ok('theme scripture text matches brand copy',
  featured.text.includes('He hath done all things well'));

/* ------------------------------------------------------ day-of-year cycle */
const a = dev.pickDevotional(new Date('2026-08-03T08:00:00'));
const b = dev.pickDevotional(new Date('2026-08-04T08:00:00'));
ok('devotionals rotate day by day', a.verse !== b.verse);
const a2 = dev.pickDevotional(new Date('2026-08-03T08:00:00'));
ok('same day always gives the same devotional', a2.verse === a.verse);
const leap = dev.pickDevotional(new Date('2028-02-29T08:00:00'));
ok('leap day still resolves', !!leap.verse && !!leap.text);

/* ------------------------------------------------------- season boundaries */
const jan5 = dev.pickDevotional(new Date('2026-01-05T08:00:00'));
ok('Jan 5 is still christmas season', jan5.period === 'christmas');
const jan6 = dev.pickDevotional(new Date('2026-01-06T08:00:00'));
ok('Jan 6 returns to the daily rotation', jan6.period !== 'christmas' && !!jan6.verse);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
