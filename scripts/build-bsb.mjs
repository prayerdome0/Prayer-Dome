// Converts the Berean Standard Bible USFM files into one JSON file per book.
// Source: github.com/ethnosdev/bsb (database_builder/bsb_usfm, CC0), an
// exact USFM build of the BSB, which was dedicated to the public domain
// (CC0) on 30 April 2023. Footnotes, cross-references, section headings and
// psalm titles are removed; only verse text is kept.
//
// Usage: node scripts/build-bsb.mjs <path-to-bsb_usfm-dir>
import fs from 'fs';
import path from 'path';

const src = process.argv[2];
const outDir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'assets', 'bible', 'bsb');
if (!src || !fs.existsSync(src)) { console.error('Give the bsb_usfm directory as the first argument.'); process.exit(1); }

// Book order and numbering must match api/bible.js (OSIS-style ids 1..66).
const CODES = ['GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZK','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL','MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV'];

function clean(text) {
  return text
    .replace(/\\f\b[\s\S]*?\\f\*/g, ' ')      // footnotes
    .replace(/\\x\b[\s\S]*?\\x\*/g, ' ')      // cross-references
    .replace(/\\\+?\w+\*/g, ' ')                // closing markers
    .replace(/\\\+?[a-z]+\d?\s?/gi, ' ')      // opening markers (\wj, \add, \q1 …)
    .replace(/\s+/g, ' ')
    .trim();
}

let total = 0, books = 0;
fs.mkdirSync(outDir, { recursive: true });
CODES.forEach((code, index) => {
  const file = path.join(src, code + '.usfm');
  if (!fs.existsSync(file)) throw new Error('Missing ' + file);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const chapters = {};
  let chapter = null, verse = null, buf = [];
  const flush = () => {
    if (chapter != null && verse != null) {
      // A verse with no main text (the BSB moves some verses into footnotes)
      // is kept as an empty entry so verse numbers stay in step with the book.
      chapters[chapter][verse] = clean(buf.join(' '));
    }
    buf = [];
  };
  for (const raw of lines) {
    // Skip metadata, section headings and cross-reference lines. \d lines hold
    // psalm and prophecy superscriptions, which the BSB numbers as verse 1, so they are kept.
    if (/^\\(id|usfm|h|toc\d|mt\d?|ms\d?|s\d?|r|sp|cl|rem|b)\b/.test(raw)) continue;
    const c = raw.match(/^\\c\s+(\d+)/);
    if (c) { flush(); chapter = parseInt(c[1], 10); chapters[chapter] = {}; verse = null; continue; }
    if (chapter == null) continue;
    // A line may hold several verse markers; split on them.
    const parts = raw.split(/(\\v\s+\d+(?:-\d+)?)/);
    for (const part of parts) {
      const v = part.match(/^\\v\s+(\d+)/);
      if (v) { flush(); verse = parseInt(v[1], 10); continue; }
      if (verse != null) buf.push(part);
      else if (part.trim() && !/^\\/.test(part.trim())) { /* text before first verse: ignore */ }
    }
  }
  flush();
  const count = Object.values(chapters).reduce((n, ch) => n + Object.keys(ch).length, 0);
  total += count; books++;
  const out = { id: index + 1, usfm: code, translation: 'BSB', translationName: 'Berean Standard Bible', copyright: 'Berean Standard Bible: dedicated to the public domain (CC0) on 30 April 2023 by the Berean Bible translation team and BSB Publishing.', chapters };
  fs.writeFileSync(path.join(outDir, (index + 1) + '.json'), JSON.stringify(out));
});
console.log(`Wrote ${books} books, ${total} verses to ${outDir}`);
