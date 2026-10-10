'use strict';

/* Berean Standard Bible (BSB) data checks: the bundled per-book files must
 * match the reader's book list, the known BSB verse counts, and contain only
 * verse text (no footnotes or markup). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BSB_DIR = path.join(ROOT, 'assets', 'bible', 'bsb');
let pass = 0;
let fail = 0;
function t(name, condition, detail = '') {
  if (condition) pass += 1;
  else fail += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
}

const html = fs.readFileSync(path.join(ROOT, 'bible.html'), 'utf8');
const listMatch = html.match(/const bibleBooks = \[([\s\S]*?)\];/);
const readerBooks = [...listMatch[1].matchAll(/\{name:"([^"]+)", ch:(\d+), id:(\d+)\}/g)]
  .map(m => ({ name: m[1], ch: Number(m[2]), id: Number(m[3]) }));

t('reader lists 66 books with ids 1..66 in order', readerBooks.length === 66 &&
  readerBooks.every((b, i) => b.id === i + 1));

const files = fs.readdirSync(BSB_DIR).filter(f => /^\d+\.json$/.test(f));
t('one BSB file per book (66)', files.length === 66, `found ${files.length}`);

const books = readerBooks.map(b => JSON.parse(fs.readFileSync(path.join(BSB_DIR, `${b.id}.json`), 'utf8')));
t('every file declares BSB and the public-domain notice', books.every(b =>
  b.translation === 'BSB' && b.translationName === 'Berean Standard Bible' && /public domain \(CC0\)/.test(b.copyright)));

let chapterMismatch = [];
let stray = [];
let verseTotal = 0;
readerBooks.forEach((b, i) => {
  const data = books[i];
  const chapters = Object.keys(data.chapters).map(Number);
  if (data.id !== b.id || chapters.length !== b.ch || Math.max(...chapters) !== b.ch) {
    chapterMismatch.push(`${b.name} (${chapters.length}/${b.ch})`);
  }
  for (const verses of Object.values(data.chapters)) {
    for (const text of Object.values(verses)) {
      verseTotal += 1;
      if (/\\[a-z]|\\\*|\*\\|\\f|\\x/.test(text) || /<[a-z]/i.test(text)) stray.push(`${b.name}: ${text.slice(0, 50)}`);
    }
  }
});
t('chapter count matches the reader for all 66 books', chapterMismatch.length === 0, chapterMismatch.join(', '));
t('no USFM markup, footnote or HTML left in verse text', stray.length === 0, stray.slice(0, 3).join(' | '));

// Verse counts. Standard counts for these 16 books. BSB omits 16 verses from its
// main text and numbering (e.g. John 5:4, Mark 9:44, Acts 8:37), so six books
// sit below the standard count by exactly those verses. The total is 31,086 against
// the standard 31,102. This is checked exactly, not loosely.
const verseCount = code => {
  const book = books.find(b => b.usfm === code);
  return Object.values(book.chapters).reduce((n, c) => n + Object.keys(c).length, 0);
};
const standard = { GEN: 1533, EXO: 1213, PSA: 2461, PRO: 915, ISA: 1292, JER: 1364, EZK: 1273, MAL: 55,
  MAT: 1071, MRK: 678, LUK: 1151, JHN: 879, ACT: 1007, ROM: 433, REV: 404, '1CH': 942 };
const bsbOmitted = { MAT: 3, MRK: 5, LUK: 2, JHN: 1, ACT: 4, ROM: 1 };
const exactMismatch = Object.entries(standard).filter(([code, n]) => verseCount(code) !== n - (bsbOmitted[code] || 0))
  .map(([code]) => `${code} ${verseCount(code)}`);
t('verse counts match BSB numbering for 16 books (standard minus the omitted verses)', exactMismatch.length === 0, exactMismatch.join(', '));
t('the 16 omitted verses total 16 (standard 31102 -> BSB 31086)',
  Object.values(bsbOmitted).reduce((a, b) => a + b, 0) === 16 && books.reduce((n, b) => n + Object.values(b.chapters).reduce((m, c) => m + Object.keys(c).length, 0), 0) === 31086);

const psalm3 = books[18].chapters[3][1];
t('Psalm superscriptions are kept as verse 1 (as in the BSB)', /A Psalm of David/.test(psalm3));

const jn316 = books[42].chapters[3][16];
t('John 3:16 reads as the BSB text', jn316 === 'For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.', jn316);

const total = books.reduce((n, b) => n + Object.values(b.chapters).reduce((m, c) => m + Object.keys(c).length, 0), 0);
t('total verse entries present', total > 31000, `${total} verses`);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
