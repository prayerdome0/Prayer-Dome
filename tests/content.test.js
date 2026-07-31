/*
 * Tests for the translation pack and sermon library.
 * No dependencies:  node tests/content.test.js
 */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

const T = require(path.join(ROOT, 'translation-data.js'));
const S = require(path.join(ROOT, 'sermons-data.js'));

let pass = 0, fail = 0;
function t(name, ok, extra) {
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  ' + extra : ''));
}

/* ===================== Translation pack ===================== */

t('three languages are defined', T.PD_LANGUAGES.length === 3);
t('language codes are en / tum / ssw',
  T.PD_LANGUAGES.map(l => l.code).join(',') === 'en,tum,ssw');

t('English is flagged official, drafts are not',
  T.pdLanguage('en').official === true &&
  T.pdLanguage('tum').official === false &&
  T.pdLanguage('ssw').official === false);

t('verse pack is non-empty', T.PD_VERSES.length >= 25, '(' + T.PD_VERSES.length + ' verses)');

// Every verse must carry all three languages and all three references.
let missing = [];
T.PD_VERSES.forEach(v => {
  ['en', 'tum', 'ssw'].forEach(c => {
    if (!v[c] || !String(v[c]).trim()) missing.push(v.id + '/' + c);
    if (!v.ref || !v.ref[c]) missing.push(v.id + '/ref.' + c);
  });
});
t('every verse has text and a reference in all three languages',
  missing.length === 0, missing.slice(0, 5).join(', '));

// Ids must be unique — duplicates would silently shadow each other.
const ids = T.PD_VERSES.map(v => v.id);
t('verse ids are unique', new Set(ids).size === ids.length);

// This is the honesty guarantee the UI depends on.
t('English is marked reviewed on every verse',
  T.PD_VERSES.every(v => v.reviewed && v.reviewed.en === true));
t('no draft language is falsely marked reviewed',
  T.PD_VERSES.every(v => v.reviewed.tum === false && v.reviewed.ssw === false));

const r = T.pdRenderVerse('john-3-16', 'tum');
t('render returns the Tumbuka text', r.lang === 'tum' && r.text === T.pdVerse('john-3-16').tum);
t('render marks a draft as unreviewed', r.reviewed === false);
t('render localises the reference', r.ref === 'Yohane 3:16');

const fb = T.pdRenderVerse('john-3-16', 'klingon');
t('unknown language falls back to English and says so',
  fb.lang === 'en' && fb.text === T.pdVerse('john-3-16').en);

t('missing verse id returns null', T.pdRenderVerse('does-not-exist', 'en') === null);

t('search finds an English phrase', T.pdSearchVerses('shepherd', 'en').length >= 1);
t('search finds a Tumbuka phrase', T.pdSearchVerses('muliska', 'en').length >= 1);
t('search finds a siSwati phrase', T.pdSearchVerses('umelusi', 'en').length >= 1);
t('search matches a reference', T.pdSearchVerses('John 3:16', 'en').length >= 1);
t('empty search returns nothing', T.pdSearchVerses('', 'en').length === 0);
t('gibberish search returns nothing', T.pdSearchVerses('zzzqqqxx', 'en').length === 0);

t('topic filter works', T.pdVersesByTopic('fear', 'en').length >= 3);
t('unknown topic returns empty', T.pdVersesByTopic('nonsense', 'en').length === 0);

// Verse of the day must be stable within a day and move between days.
const d1 = new Date('2026-07-31T06:00:00Z');
const d2 = new Date('2026-07-31T22:00:00Z');
const d3 = new Date('2026-08-01T06:00:00Z');
t('verse of the day is stable across one day',
  T.pdVerseOfDay('en', d1).id === T.pdVerseOfDay('en', d2).id);
t('verse of the day changes the next day',
  T.pdVerseOfDay('en', d1).id !== T.pdVerseOfDay('en', d3).id);
t('verse of the day respects language', T.pdVerseOfDay('ssw', d1).lang === 'ssw');

t('UI strings exist for all three languages',
  ['en', 'tum', 'ssw'].every(c => T.PD_UI_STRINGS[c] && T.PD_UI_STRINGS[c]['nav.home']));

// Every key present in English must exist in the other two, or the interface
// will silently fall back and look half-translated.
const enKeys = Object.keys(T.PD_UI_STRINGS.en);
['tum', 'ssw'].forEach(c => {
  const gaps = enKeys.filter(k => !T.PD_UI_STRINGS[c][k]);
  t('no missing UI strings in ' + c, gaps.length === 0, gaps.slice(0, 4).join(', '));
});

t('pdT falls back to English for an unknown language',
  T.pdT('nav.home', 'zz') === 'Home');
t('pdT returns the key itself when nothing matches',
  T.pdT('no.such.key', 'en') === 'no.such.key');

// Voice picking: Tumbuka/siSwati have no native voices, so the fallback chain matters.
const fakeVoices = [
  { name: 'UK English', lang: 'en-GB' },
  { name: 'Zulu', lang: 'zu-ZA' }
];
t('siSwati borrows the Zulu voice', T.pdPickVoice('ssw', fakeVoices).lang === 'zu-ZA');
t('English picks an English voice', T.pdPickVoice('en', fakeVoices).lang === 'en-GB');
t('Tumbuka falls through to English when no Nyanja voice exists',
  T.pdPickVoice('tum', fakeVoices).lang === 'en-GB');
t('no voices at all returns null', T.pdPickVoice('en', []) === null);

/* ===================== Sermons ===================== */

t('sermon library is non-empty', S.PD_SERMONS.length >= 5, '(' + S.PD_SERMONS.length + ')');

const sids = S.PD_SERMONS.map(s => s.id);
t('sermon ids are unique', new Set(sids).size === sids.length);

t('every sermon has a title, scripture and story',
  S.PD_SERMONS.every(s => s.title && s.scripture && Array.isArray(s.story) && s.story.length >= 5));

t('every sermon has a prayer', S.PD_SERMONS.every(s => s.prayer && s.prayer.length > 40));
t('every sermon has reflection questions',
  S.PD_SERMONS.every(s => Array.isArray(s.reflection) && s.reflection.length >= 2));

// Narration reads one paragraph per utterance. Very long paragraphs get
// truncated by some mobile speech engines, so keep them in range.
const longParas = [];
S.PD_SERMONS.forEach(s => s.story.forEach((p, i) => {
  if (p.length > 600) longParas.push(s.id + '#' + i + ' (' + p.length + ' chars)');
}));
t('no story paragraph exceeds 600 characters', longParas.length === 0, longParas.slice(0, 3).join(', '));

const emptyParas = [];
S.PD_SERMONS.forEach(s => s.story.forEach((p, i) => {
  if (!p || !p.trim()) emptyParas.push(s.id + '#' + i);
}));
t('no empty story paragraphs', emptyParas.length === 0, emptyParas.join(', '));

t('referenced sermon images exist on disk',
  S.PD_SERMONS.filter(s => s.image).every(s =>
    fs.existsSync(path.join(ROOT, s.image.replace(/^\//, '')))),
  S.PD_SERMONS.filter(s => s.image && !fs.existsSync(path.join(ROOT, s.image.replace(/^\//, ''))))
    .map(s => s.image).join(', '));

t('sermons without an image declare a gradient tint',
  S.PD_SERMONS.filter(s => !s.image).every(s =>
    ['dawn', 'ocean', 'horizon', 'gold'].indexOf(s.tint) !== -1));

t('search finds a sermon by title', S.pdSearchSermons('prodigal').length === 1);
t('search finds a sermon by scripture', S.pdSearchSermons('Daniel').length >= 1);
t('empty search returns everything', S.pdSearchSermons('').length === S.PD_SERMONS.length);
t('gibberish search returns nothing', S.pdSearchSermons('zzqqxx').length === 0);
t('topic filter works', S.pdSermonsByTopic('fear').length >= 2);
t('series list is de-duplicated', new Set(S.pdSermonSeries()).size === S.pdSermonSeries().length);
t('word count is plausible', S.pdSermonWordCount(S.pdSermon('prodigal-son')) > 400);
t('unknown sermon id returns null', S.pdSermon('nope') === null);

/* ===================== Page wiring ===================== */

const sermonsHtml = fs.readFileSync(path.join(ROOT, 'sermons.html'), 'utf8');
const translateHtml = fs.readFileSync(path.join(ROOT, 'translate.html'), 'utf8');

// Catch a renamed id that would break the page silently at runtime.
['readerTitle', 'readerStory', 'readerPrayer', 'readerReflect', 'playBtn',
 'narrProgress', 'narrState', 'narrPos', 'prevBtn', 'nextBtn', 'stopBtn',
 'sermonGrid', 'filterRow', 'searchBox', 'speedRange', 'voiceWarn', 'toastWrap']
  .forEach(id => t('sermons.html contains #' + id, sermonsHtml.includes('id="' + id + '"')));

['langSwitch', 'langNote', 'votdWrap', 'verseSearch', 'topicRow', 'verseList',
 'emptyState', 'listCount', 'toastWrap']
  .forEach(id => t('translate.html contains #' + id, translateHtml.includes('id="' + id + '"')));

t('sermons.html loads its data file', sermonsHtml.includes('/sermons-data.js'));
t('translate.html loads its data file', translateHtml.includes('/translation-data.js'));
t('both pages load the brand layer',
  sermonsHtml.includes('pd-brand.css') && translateHtml.includes('pd-brand.css'));

// The draft disclosure is the point of the whole design — assert it is present.
t('translate.html shows the translation-provenance notice',
  translateHtml.includes('community drafts') || translateHtml.includes('community draft'));
t('translate.html names the published Bibles it is not',
  translateHtml.includes('Buku Lakupatulika'));

const brandCss = fs.readFileSync(path.join(ROOT, 'assets/pd-brand.css'), 'utf8');
t('brand css honours prefers-reduced-motion',
  brandCss.includes('prefers-reduced-motion'));
const motionJs = fs.readFileSync(path.join(ROOT, 'assets/pd-motion.js'), 'utf8');
t('motion runtime honours prefers-reduced-motion',
  motionJs.includes('prefers-reduced-motion'));

/* ===================== Result ===================== */
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
