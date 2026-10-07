#!/usr/bin/env node
/**
 * Spread the right answers through Domey's question bank.
 *
 * Every question in assets/pd-domey-questions.js is written with the correct
 * choice first, because that is the fastest way to write them accurately. This
 * tool rotates each question's choices by a hash of the question text, so the
 * stored answer index is varied (and stable: re-running changes nothing once a
 * question has moved). It verifies, question by question, that the text of the
 * correct answer is exactly the same before and after the rotation.
 *
 *   node scripts/spread-answers.mjs            # rewrite the bank in place
 *   node scripts/spread-answers.mjs --check    # verify only, change nothing
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../assets/pd-domey-questions.js', import.meta.url));
const CHECK = process.argv.includes('--check');

const LINE = /^(\s*\{q:.*?,o:\[)(.*?)(\],a:)(\d)(,.*)$/;

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // FNV-1a is weak in its low bits, and the low two bits are exactly what we
  // need for a four-way choice — so mix once more before using them.
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

function choices(text) {
  // The choices in this file never contain a quote or a bracket, so a simple
  // split is exact — and the verification below proves it stayed that way.
  const parts = text.split("','");
  return parts.map((part, index) => {
    let value = part;
    if (index === 0) value = value.replace(/^'/, '');
    if (index === parts.length - 1) value = value.replace(/'$/, '');
    return value;
  });
}

function serialise(list) {
  return list.map((value) => "'" + value + "'").join(',');
}

const source = readFileSync(FILE, 'utf8');
const lines = source.split('\n');
let moved = 0;
let checked = 0;
let suspicious = 0;

const out = lines.map((line) => {
  const match = line.match(LINE);
  if (!match) return line;
  const [, pre, optionsText, mid, answerText, post] = match;
  const list = choices(optionsText);
  if (list.length !== 4) { suspicious++; return line; }
  const index = Number(answerText);
  const question = (pre.match(/q:'(.*?)',o:\[$/) || [])[1] || '';
  // The target position is absolute (a property of the question), so running
  // the tool twice leaves the file exactly as it was.
  const target = (question ? hash(question) : 0) % 4;
  if (!question) { suspicious++; return line; }
  if (index === target) { checked++; return line; }
  const rotate = (index - target + 4) % 4;
  const rotated = list.slice(rotate).concat(list.slice(0, rotate));
  const newIndex = (index - rotate + 4) % 4;
  if (rotated[newIndex] !== list[index]) { suspicious++; return line; }
  moved++;
  return pre + serialise(rotated) + mid + String(newIndex) + post;
}).join('\n');

if (suspicious) {
  console.error(`Refusing to write: ${suspicious} line(s) did not look like a question`);
  process.exit(1);
}

/* Now prove it: load the old and the new file and compare the correct answer
   of every single question, word for word. */
function load(text) {
  const sandbox = {};
  const factory = new Function('window', text + '; return window.PDDomeyQuestions.raw;');
  return factory(sandbox);
}
const before = load(source);
const after = load(out);
if (before.length !== after.length) {
  console.error(`Refusing to write: ${before.length} questions became ${after.length}`);
  process.exit(1);
}
for (let i = 0; i < before.length; i++) {
  const a = before[i];
  const b = after[i];
  if (a.q !== b.q || a.o[a.a] !== b.o[b.a] || a.v !== b.v || a.t !== b.t) {
    console.error(`Refusing to write: question ${i} changed its meaning:\n  ${a.q}\n  ${a.o[a.a]} -> ${b.o[b.a]}`);
    process.exit(1);
  }
}

if (CHECK) {
  console.log(`OK — ${before.length} questions verified, ${moved} would move`);
  process.exit(0);
}
if (moved) writeFileSync(FILE, out, 'utf8');
console.log(`OK — ${before.length} questions verified, ${moved} answers spread across the four positions`);
