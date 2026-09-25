/*
 * End-to-end regression checks for the upgraded e-learning flow:
 *   Lesson → Mark Complete → Take Quiz → Pass/Fail → Next Lesson
 *
 * Loads lessons.html in jsdom, executes the real page scripts and walks a
 * learner through the completion gate, a full 10-question quiz attempt and
 * the pass/fail result screens. Question sampling is deterministic because
 * Math.random is seeded, so the test can know exactly which option is
 * correct for every rendered question.
 *
 * Requires jsdom:  npm install --no-save jsdom && node tests/learning-flow.test.js
 */
'use strict';

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function t(name, ok, extra = '') { ok ? pass++ : fail++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  ' + extra : '')); }

const html = fs.readFileSync(path.join(ROOT, 'lessons.html'), 'utf8');
const academyJs = fs.readFileSync(path.join(ROOT, 'assets', 'pd-academy.js'), 'utf8');
const academyData = fs.readFileSync(path.join(ROOT, 'assets', 'pd-academy-data.js'), 'utf8');
const academyQuestions = fs.readFileSync(path.join(ROOT, 'assets', 'pd-academy-questions.js'), 'utf8');

// ---------------------------------------------------------------- static checks
t('lessons page loads the expanded question bank', html.includes('pd-academy-questions.js'));
t('lessons page loads confetti for quiz celebrations', html.includes('canvas-confetti'));
t('lessons page renders the student dashboard', html.includes('id="studentDashboard"') && html.includes('id="dashStreak"'));
t('lessons page has a modal root for the quiz flow', html.includes('id="pdLessonModalRoot"'));
t('runtime implements the quiz gate', academyJs.includes('renderQuizGate') && academyJs.includes('pd-acad-take-quiz-cta'));
t('runtime implements grading result screen', academyJs.includes('renderQuizGrading') && academyJs.includes('Status: PASSED'));
t('runtime implements pre-submit review screen', academyJs.includes('renderQuizReview') && academyJs.includes('Confirm submission'));
t('runtime implements post-grading answer review', academyJs.includes('renderQuizGradedReview'));
t('runtime computes learning streak', academyJs.includes('computeStreak'));
t('runtime renders student dashboard', academyJs.includes('renderStudentDashboard'));
t('runtime samples 10 questions per attempt, topic-only', academyJs.includes('topicQuizQuestions(lesson, q, 10)'));
t('runtime draws questions from the studied topic only', academyJs.includes('TOPIC_QUESTION_POOL') && academyJs.includes('DATA.TOPIC_QUESTION_POOL'));
t('runtime supports ?lesson= deep links for sharing', academyJs.includes("params.get('lesson')"));

// The question bank must give every lesson 30+ unique questions.
(function () {
  const sandbox = { window: {} };
  sandbox.window.PD_ACADEMY = {};
  vm.runInNewContext(academyData, sandbox);
  vm.runInNewContext(academyQuestions, sandbox);
  const DATA = sandbox.window.PD_ACADEMY.DATA;
  const sizes = DATA.quizzes.map(q => q.questions.length);
  const min = Math.min.apply(null, sizes);
  const max = Math.max.apply(null, sizes);
  t('every lesson quiz has a 30+ question bank', min >= 30, `min=${min} max=${max}`);
  t('track-level question banks are 18 each', Object.values(DATA.TRACK_QUESTION_POOL).every(v => v.length === 18));
  t('every question row is a 6-element MC or 4-element T/F with valid index',
    DATA.quizzes.every(q => q.questions.every(r =>
      Array.isArray(r) &&
      ((r.length === 6 && r[5] >= 0 && r[5] <= 3) ||
       (r.length === 4 && r[1] === 'True' && r[2] === 'False' && (r[3] === 0 || r[3] === 1))))));
  const extras = academyQuestions.split('EXTRA_LESSON_QUESTIONS = {').length - 1;
  t('question bank file defines per-lesson extra questions', extras === 1);
  const lessonKeys = (academyQuestions.match(/^\s+l\d{2}:\s*\[/gm) || []).length;
  t('question bank covers all 18 lessons', lessonKeys === 18, lessonKeys);
  const topicPool = DATA.TOPIC_QUESTION_POOL || {};
  const topicKeys = Object.keys(topicPool);
  t('every lesson exposes a topic-only question pool', topicKeys.length === 18);
  t('every topic pool has 30+ unique questions', topicKeys.length === 18 && topicKeys.every(k => topicPool[k].length >= 30));
})();

// ---------------------------------------------------------------- jsdom runtime
const dom = new JSDOM(html, {
  url: 'http://localhost/lessons',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const { window } = dom;
const doc = window.document;

window.HTMLElement.prototype.scrollIntoView = function () {};
window.scrollTo = function () {};
window.alert = function () {};
window.confirm = function () { return true; };
window.matchMedia = window.matchMedia || function () { return { matches: false, addListener() {}, removeListener() {} }; };

function run(code, name) {
  try { window.eval(code); return true; }
  catch (e) { console.log('ERROR running ' + name + ': ' + e.message); return false; }
}
t('pd-academy-data.js executes in jsdom', run(academyData, 'pd-academy-data.js'));
t('pd-academy-questions.js executes in jsdom', run(academyQuestions, 'pd-academy-questions.js'));
t('pd-academy.js executes in jsdom', run(academyJs, 'pd-academy.js'));

// The page scripts listen for DOMContentLoaded; jsdom already fired it while
// parsing, so dispatch it again to run the initialisation.
doc.dispatchEvent(new window.Event('DOMContentLoaded'));

t('student dashboard rendered with progress widgets',
  doc.getElementById('studentDashboard') !== null && doc.getElementById('dashLessons').textContent.includes('/'));
t('fresh learner sees 0/18 lessons', doc.getElementById('dashLessons').textContent === '0/18', doc.getElementById('dashLessons').textContent);
t('fresh learner sees 0/18 quizzes', doc.getElementById('dashQuizzes').textContent === '0/18', doc.getElementById('dashQuizzes').textContent);
t('student dashboard greeting rendered', (doc.getElementById('studentGreeting').textContent || '').length > 0);
t('first lesson rendered with hero banner', doc.querySelector('.pd-acad-lesson-hero') !== null && doc.querySelector('.pd-acad-lesson-hero img') !== null);
t('lesson shows objectives block', doc.querySelector('.pd-acad-lesson-objectives') !== null);
t('lesson shows quiz gate', doc.getElementById('lessonQuizGate-l01') !== null && doc.getElementById('lessonQuizGate-l01').innerHTML.length > 0);
t('quiz gate initially locked for a fresh learner',
  doc.getElementById('launchQuizBtn') !== null &&
  (doc.getElementById('launchQuizBtn').disabled || doc.getElementById('launchQuizBtn').classList.contains('pd-acad-take-quiz-locked')));
t('lesson shows discussion area', doc.getElementById('lessonDiscussion-l01') !== null && (doc.getElementById('lessonDiscussion-l01').textContent || '').includes('Q&A'));
t('lesson shows share row', doc.getElementById('lessonShare-l01') !== null && doc.getElementById('lessonShare-l01').innerHTML.toLowerCase().includes('share'));

// ---------------------------------------------------------------- deterministic quiz helper
function seededRandom(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Mirrors topicQuizQuestions() in pd-academy.js exactly (same shuffle order)
// so the test can compute the correct option index for every rendered question.
function replicateTopicPool(lessonId, seed, count) {
  const rand = seededRandom(seed);
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  const pool = (window.PD_ACADEMY.DATA.TOPIC_QUESTION_POOL && window.PD_ACADEMY.DATA.TOPIC_QUESTION_POOL[lessonId]) || [];
  const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
  return picked.map((raw, i) => {
    const isTF = raw.length === 4 && raw[1] === 'True' && raw[2] === 'False';
    const options = isTF
      ? shuffle([{ t: 'True', correct: raw[3] === 0 }, { t: 'False', correct: raw[3] === 1 }])
      : shuffle([{ t: raw[1], correct: raw[5] === 0 }, { t: raw[2], correct: raw[5] === 1 }, { t: raw[3], correct: raw[5] === 2 }, { t: raw[4], correct: raw[5] === 3 }]);
    return { id: i, text: raw[0], tf: isTF, options };
  });
}

const SEED = 1337;
const expected = replicateTopicPool('l01', SEED, 10);

function clickCorrectOption(q) {
  const correctIdx = q.options.findIndex(o => o.correct);
  const options = Array.from(doc.querySelectorAll('#quizOptions .pd-acad-quiz-option'));
  options[correctIdx].click();
}
function clickWrongOption(q) {
  const correctIdx = q.options.findIndex(o => o.correct);
  const options = Array.from(doc.querySelectorAll('#quizOptions .pd-acad-quiz-option'));
  const wrong = options[(correctIdx + 1) % options.length];
  wrong.click();
}

// ---------------------------------------------------------------- funnel: complete lesson → pass quiz
(async function main() {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const markBtn = doc.getElementById('manualMarkCompleteBtn');
  t('mark-lesson-complete button available before completion', markBtn !== null);
  markBtn.click();
  // The reading tracker's fallback timer re-renders the gate after ~3.5s;
  // wait past it so we always interact with the latest gate node.
  await sleep(3800);

  const gate = doc.getElementById('lessonQuizGate-l01');
  t('gate unlocks after lesson completion', gate.innerHTML.includes('pd-acad-take-quiz-cta'));
  let cta = doc.querySelector('#launchQuizBtn');
  t('take-quiz CTA present and enabled', cta !== null && !cta.disabled);

  window.Math.random = seededRandom(SEED);
  cta.click();
  t('quiz modal opens', doc.getElementById('quizOverlay') !== null);
  t('quiz shows question 1 of 10', (doc.getElementById('quizQNum').textContent || '').includes('1 of 10'));
  t('quiz renders four options', doc.querySelectorAll('#quizOptions .pd-acad-quiz-option').length === 4);
  t('next button disabled before answering', doc.getElementById('quizNextBtn').disabled === true);

  let allCorrect = true;
  for (let i = 0; i < expected.length; i++) {
    const currentQ = expected[i];
    const renderedText = (doc.querySelector('.pd-acad-quiz-question h4') || {}).textContent || '';
    if (renderedText.indexOf(currentQ.text.slice(0, 30)) !== 0) allCorrect = false;
    clickCorrectOption(currentQ);
    // Selecting drafts an answer; correctness is NOT revealed before submission.
    const draftSelected = doc.querySelector('#quizOptions .pd-acad-quiz-option.is-draft') !== null;
    t('question ' + (i + 1) + ' sampled question matches seeded pool and drafts an answer without grading',
      renderedText.indexOf(currentQ.text.slice(0, 30)) === 0 && draftSelected,
      renderedText.slice(0, 30));
    const next = doc.getElementById('quizNextBtn');
    if (next && !next.disabled) next.click();
  }

  // After the last question the learner lands on the submission review screen.
  t('submission review appears after the last question', doc.querySelector('.pd-acad-quiz-review.is-confirm') !== null);
  t('review lists all 10 questions with choices', doc.querySelectorAll('.pd-acad-quiz-review-list .pd-acad-quiz-review-item').length === expected.length);
  t('review shows confirm-submission button', doc.getElementById('quizConfirmSubmitBtn') !== null);
  t('review shows go-back button', doc.getElementById('quizConfirmBackBtn') !== null);

  // Confirm submission → grading reveals the score.
  doc.getElementById('quizConfirmSubmitBtn').click();
  const result = doc.querySelector('.pd-acad-quiz-result');
  t('result screen appears after confirming submission', result !== null);
  t('perfect run is a pass', result && result.classList.contains('is-pass'));
  t('score shows 100%', result && (doc.querySelector('.pd-acad-result-score').textContent || '').includes('100%'));
  t('status chip says PASSED', result && result.innerHTML.includes('Status: PASSED'));

  const saved = JSON.parse(window.localStorage.getItem('pd_academy_progress') || '{}');
  t('pass persisted in local progress', !!(saved.passedQuizzes && saved.passedQuizzes['quiz-l01']));
  t('certificate recorded locally', Array.isArray(saved.certificates) && saved.certificates.length === 1 && /PD-L01-/.test(saved.certificates[0].id));
  t('lesson marked complete', saved.completedLessons && saved.completedLessons.indexOf('l01') >= 0);
  t('next lesson unlocked after passing', Array.isArray(saved.unlockedLessons) && saved.unlockedLessons.indexOf('l02') >= 0);

  t('download certificate button bound on pass', doc.getElementById('quizDownloadCertBtn') !== null);
  const continueBtn = doc.getElementById('quizContinueBtn');
  t('next-topic button shown after passing', continueBtn !== null && continueBtn.getAttribute('href').indexOf('l02') >= 0);

  // ---------------------------------------------------------------- graded review screen
  const reviewBtn = doc.getElementById('quizReviewBtn');
  if (reviewBtn) {
    reviewBtn.click();
    const items = doc.querySelectorAll('.pd-acad-quiz-review-item');
    t('graded review lists every question', items.length === expected.length, items.length);
    t('graded review shows all-correct for a perfect run', Array.from(items).every(el => el.classList.contains('is-correct')));
    t('graded review can return to result', doc.getElementById('quizReviewBackBtn') !== null);
  } else {
    t('graded review screen reachable', false);
  }

  // ---------------------------------------------------------------- fail run: retake with wrong answers
  window.localStorage.clear();
  // Re-open the quiz from the gate (which still shows the pass CTA).
  const gate2 = doc.getElementById('lessonQuizGate-l01');
  const cta2 = gate2.querySelector('#launchQuizBtn');
  window.Math.random = seededRandom(SEED + 1);
  cta2.click();
  t('retake re-opens the quiz modal', doc.getElementById('quizOverlay') !== null);

  for (let i = 0; i < expected.length; i++) {
    const currentQ = expected[i];
    clickWrongOption(currentQ);
    const next = doc.getElementById('quizNextBtn');
    if (next && !next.disabled) next.click();
  }
  t('fail run reaches submission review', doc.querySelector('.pd-acad-quiz-review.is-confirm') !== null);
  doc.getElementById('quizConfirmSubmitBtn').click();
  const failResult = doc.querySelector('.pd-acad-quiz-result');
  t('all-wrong run is a fail', failResult && failResult.classList.contains('is-fail'));
  t('fail screen shows retake action', doc.getElementById('quizRetakeBtn') !== null);
  t('fail screen shows review-lesson action', doc.getElementById('quizReviewLessonBtn') !== null);
  const savedFail = JSON.parse(window.localStorage.getItem('pd_academy_progress') || '{}');
  t('fail does not record a pass', !(savedFail.passedQuizzes && savedFail.passedQuizzes['quiz-l01']));

  // ---------------------------------------------------------------- discussion thread
  const form = doc.getElementById('discussionForm-l01');
  t('discussion form present', form !== null);
  t('discussion area shows Q&A header', (doc.getElementById('lessonDiscussion-l01').textContent || '').includes('Q&A'));
  const textarea = form.querySelector('textarea[name="body"]');
  textarea.value = 'What does "grace through faith" mean in daily life?';
  form.dispatchEvent(new window.Event('submit', { cancelable: true }));
  const thread = doc.getElementById('lessonDiscussion-l01');
  t('discussion post appears after submit', thread.innerHTML.includes('grace through faith'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Test harness error:', e); process.exit(1); });
