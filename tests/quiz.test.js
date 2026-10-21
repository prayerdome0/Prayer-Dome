/*
 * Prayer Dome — the quiz never loses a level in progress
 * ===========================================================================
 * What this file protects:
 *
 *   1. A member who leaves in the middle of a level can come back to the same
 *      question, score, streak and power-ups.
 *   2. Only a real, in-progress level is ever offered: a corrupt record, an
 *      expired one, or one that points past the end of the map is discarded
 *      instead of being turned into a broken screen.
 *   3. The record holds numbers only — never an answer, a question or a name.
 *   4. The quiz page is wired to that module: it saves after every judged
 *      answer, clears when the level ends or progress is reset, and offers the
 *      resume bar on load.
 * ===========================================================================
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const t = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  ' + extra : ''));
};
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* A storage stand-in that behaves like the real one: strings in, strings out,
   plus a switch to make every call throw (private mode, quota, disabled). */
function makeStorage() {
  const map = new Map();
  const store = {
    map,
    broken: false,
    getItem(k) { if (store.broken) throw new Error('denied'); return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { if (store.broken) throw new Error('quota'); map.set(k, String(v)); },
    removeItem(k) { if (store.broken) throw new Error('denied'); map.delete(k); }
  };
  return store;
}

const opts = { perLevel: 10, totalLevels: 7, powerups: 3 };
const fresh = () => {
  delete require.cache[require.resolve('../assets/pd-quiz-session.js')];
  global.localStorage = makeStorage();
  return require('../assets/pd-quiz-session.js');
};

/* --------------------------------------------------------- 1. the module */
{
  const S = fresh();
  t('the record survives a round trip with the exact question and score',
    (() => {
      const saved = S.save({ level: 3, question: 4, score: 120, streak: 2, fifty: 1, freeze: 3 }, opts);
      const back = S.load(opts);
      return saved === true && back.level === 3 && back.question === 4 && back.score === 120 &&
        back.streak === 2 && back.fifty === 1 && back.freeze === 3;
    })());

  t('the record holds numbers only — no question text, answer or name',
    (() => {
      const raw = JSON.parse(global.localStorage.getItem(S.KEY));
      const keys = Object.keys(raw).sort().join(',');
      return keys === 'fifty,freeze,level,question,savedAt,score,streak' &&
        Object.values(raw).every((v) => typeof v === 'number');
    })());

  t('the resume sentence is the one the member reads',
    S.describe({ level: 3, question: 4 }, opts) === 'Level 3, question 4 of 10');

  t('clearing the record leaves nothing behind',
    S.clear() === true && S.load(opts) === null && global.localStorage.getItem(S.KEY) === null);

  /* ---- refusal: nothing that cannot be resumed is ever written or offered */
  const bad = [
    ['level above the map', { level: 99, question: 2, score: 10, streak: 0, fifty: 3, freeze: 3 }],
    ['level zero', { level: 0, question: 2, score: 10, streak: 0, fifty: 3, freeze: 3 }],
    ['question past the end of the level', { level: 2, question: 11, score: 10, streak: 0, fifty: 3, freeze: 3 }],
    ['negative score', { level: 2, question: 3, score: -5, streak: 0, fifty: 3, freeze: 3 }],
    ['a power-up above the limit', { level: 2, question: 3, score: 10, streak: 0, fifty: 9, freeze: 3 }],
    ['a fractional question', { level: 2, question: 2.5, score: 10, streak: 0, fifty: 3, freeze: 3 }]
  ];
  bad.forEach(([name, state]) => {
    const S2 = fresh();
    t('refuses a record with ' + name, S2.save(state, opts) === false && S2.load(opts) === null);
  });

  /* ---- expiry: a week-old level is not offered back */
  {
    const S2 = fresh();
    S2.save({ level: 2, question: 5, score: 40, streak: 1, fifty: 2, freeze: 3 }, opts);
    const stored = JSON.parse(global.localStorage.getItem(S2.KEY));
    stored.savedAt = Date.now() - (S2.MAX_AGE_MS + 60000);
    global.localStorage.setItem(S2.KEY, JSON.stringify(stored));
    t('an expired session is dropped and removed, not resumed',
      S2.load(opts) === null && global.localStorage.getItem(S2.KEY) === null);
  }

  /* ---- corruption: hand-edited or half-written JSON is not a crash */
  {
    const S2 = fresh();
    global.localStorage.setItem(S2.KEY, '{not json');
    let threw = false;
    let loaded;
    try { loaded = S2.load(opts); } catch (e) { threw = true; }
    t('corrupt JSON is treated as "no session", never as an error',
      threw === false && loaded === null && global.localStorage.getItem(S2.KEY) === null);
  }

  /* ---- storage unavailable: the quiz still plays, only recovery is off */
  {
    const S2 = fresh();
    global.localStorage.broken = true;
    let threw = false;
    let saved, loaded;
    try { saved = S2.save({ level: 2, question: 3, score: 10, streak: 0, fifty: 3, freeze: 3 }, opts); loaded = S2.load(opts); }
    catch (e) { threw = true; }
    t('a browser that refuses storage never breaks the quiz',
      threw === false && saved === false && loaded === null);
  }

  t('a record starts existing only once a question has actually been answered',
    (() => {
      const S2 = fresh();
      const first = S2.save({ level: 1, question: 1, score: 0, streak: 0, fifty: 3, freeze: 3 }, opts);
      const later = S2.save({ level: 1, question: 2, score: 0, streak: 0, fifty: 3, freeze: 3 }, opts);
      return first === false && later === true;
    })());
}

/* ------------------------------------------------------- 2. the quiz page */
const QUIZ = read('quiz.html');
const SW = read('sw.js');

t('the quiz page loads the session module before its own script',
  (() => {
    const mod = QUIZ.indexOf('/assets/pd-quiz-session.js');
    const page = QUIZ.indexOf('<script type="module">');
    return mod > 0 && page > mod && /<script src="\/assets\/pd-quiz-session\.js" defer><\/script>/.test(QUIZ);
  })());
t('the session module is cached for offline use',
  SW.includes("'/assets/pd-quiz-session.js'"));
t('the resume bar is markup on the page, hidden until there is a session',
  /id="quizResume"[^>]*hidden/.test(QUIZ) && /id="quizResumeBtn"/.test(QUIZ) &&
  /id="quizResumeDiscard"/.test(QUIZ) && /id="quizResumeLine"/.test(QUIZ));
t('resume and start-over are real buttons, not inline handlers',
  !/onclick="(resumeQuiz|discardQuizSession)\(/.test(QUIZ) &&
  /getElementById\('quizResumeBtn'\)|resumeBtn\.addEventListener\('click'/.test(QUIZ) &&
  /getElementById\('quizResumeDiscard'\)|discardBtn\.addEventListener\('click'/.test(QUIZ) &&
  /(resumeBtn|discardBtn)\.addEventListener\('click'/.test(QUIZ));

t('a fresh level clears any old record, a resumed one restores its numbers',
  /if \(resume\) \{[\s\S]{0,220}\} else \{\s*clearQuizSession\(\);/.test(QUIZ) &&
  /scoreInLevel = resume \? resume\.score : 0/.test(QUIZ) &&
  /powerups = \{ fifty: resume \? resume\.fifty : 3, freeze: resume \? resume\.freeze : 3 \}/.test(QUIZ));

t('every judged answer saves the level at the question now on screen',
  /scoreInLevel \+= ptsEarned;/.test(QUIZ) &&
  (QUIZ.match(/saveQuizSession\(\);/g) || []).length >= 2 &&
  /question: qIndex \+ 1,/.test(QUIZ));
t('the last question of a level clears the record instead of saving it',
  (QUIZ.match(/if \(qIndex \+ 1 >= QUESTIONS_PER_LEVEL\) clearQuizSession\(\);/g) || []).length >= 2);
t('finishing, retrying or resetting the quiz clears the record',
  /function endLevel\(\) \{[\s\S]{0,200}?clearQuizSession\(\);/.test(QUIZ) &&
  /clearQuizSession\(\);\s*\n\s*initUI\(\);/.test(QUIZ));
t('the resume bar is refreshed whenever the level map is shown',
  /function initUI\(\) \{\s*renderResumeBar\(\);/.test(QUIZ));
t('resuming re-enters the level at the stored question',
  /window\.resumeQuiz = function\(\) \{/.test(QUIZ) &&
  /startLevel\(state\.level, state\)/.test(QUIZ));
t('the resume bar keeps the page own look (brand tokens, no new palette)',
  /\.quiz-resume \{/.test(QUIZ) && /var\(--border-color\)/.test(QUIZ.split('.quiz-resume {')[1] || ''));

console.log(`\nQuiz session recovery checks: ${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
