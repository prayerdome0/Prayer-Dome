/*
 * Prayer Dome — the hostess and the learning experience she carries
 * ===========================================================================
 * The member-facing promises this file protects:
 *
 *   1. Domey on the game page is the hostess: the page mounts her in the
 *      companion layout, with the manual reading pace (the Continue button).
 *   2. Nothing is ever written over her face: the progress bar (back · round ·
 *      correct · XP) sits in its own bar above the stage, and every word —
 *      hers and the member's — lives in the dialogue card or the written
 *      conversation below her.
 *   3. The four choices are big A–D buttons; answering by voice ("option C"),
 *      by tap and by typing all reach the same evaluation, once.
 *   4. What the member says appears on screen as they say it (interim), is
 *      shown exactly as understood before it is judged, and lands in the
 *      written conversation with DOMEY/YOU labels.
 *   5. Her lips follow her real voice: the mouth plan runs with the speech
 *      engine's own word boundaries, stretches when the voice speaks slower
 *      than planned, and closes when the voice ends.
 *   6. A wrong answer is a learning moment: the tapped button is marked wrong,
 *      the right one is shown, and the scripture explanation is spoken and
 *      written before the member continues.
 * ===========================================================================
 */
'use strict';

const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.error('jsdom is not installed. Run:  npm install');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const t = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  ' + extra : ''));
};
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* A stand-in for the browser speech engine that behaves like the real one:
 * it starts, it reports word boundaries AS IT SPEAKS (so the lips can follow),
 * and it can be interrupted. WordsPerSecond is adjustable so the pacing tests
 * can make the voice slower or faster than the mouth plan expects. */
function installFakeVoice(window, opts = {}) {
  const msPerWord = opts.msPerWord || 120;
  let current = null;
  let timers = [];
  window.SpeechSynthesisUtterance = function FakeUtterance(text) {
    this.text = String(text);
  };
  window.speechSynthesis = {
    speaking: false,
    paused: false,
    getVoices: () => [{ name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US', localService: false, default: true }],
    cancel: () => {
      timers.forEach(clearTimeout); timers = [];
      if (current && current.onend) { try { current.onend({}); } catch (e) {} }
      window.speechSynthesis.speaking = false;
      current = null;
    },
    pause: () => { window.speechSynthesis.paused = true; },
    resume: () => { window.speechSynthesis.paused = false; },
    speak: (utterance) => {
      current = utterance;
      window.speechSynthesis.speaking = true;
      const words = utterance.text.split(' ').filter(Boolean);
      let cursor = 0;
      const starts = [];
      words.forEach((word) => { starts.push(cursor); cursor += word.length + 1; });
      const fire = (fn, arg, delay) => timers.push(setTimeout(() => { try { fn(arg); } catch (e) {} }, delay));
      fire(utterance.onstart, {}, 10);
      words.forEach((word, i) => {
        fire(utterance.onboundary, { name: 'word', charIndex: starts[i] }, 60 + i * msPerWord);
      });
      fire(() => {
        window.speechSynthesis.speaking = false;
        if (utterance.onend) utterance.onend({});
      }, null, 60 + words.length * msPerWord + 40);
    }
  };
}

/* The microphone: sessions that can be "spoken to", like the real thing. */
function installFakeEars(window) {
  const sessions = [];
  window.SpeechRecognition = function FakeRecognition() {
    const self = this;
    self.started = false;
    self.aborted = false;
    sessions.push(self);
    self.start = () => { self.started = true; };
    self.stop = () => { if (self.onend) self.onend({}); };
    self.abort = () => { self.aborted = true; };
  };
  window.__say = (transcript, final) => {
    const live = sessions.filter((s) => s.started && !s.aborted);
    const session = live[live.length - 1];
    if (!session || !session.onresult) return false;
    const result = [{ transcript: transcript }];
    result.isFinal = final !== false;
    session.onresult({ resultIndex: 0, results: [result] });
    return true;
  };
  return sessions;
}

(async function run() {
  const MASCOT_JS = read('assets/pd-mascot.js');
  const MASCOT_CSS = read('assets/pd-mascot.css');
  const LADY_JS = read('assets/pd-domey-lady.js');
  const GAME = read('game.html');

  /* --------------------------------------------- 1. the game page wiring */
  t('the game page mounts the host in the companion layout',
    /layout:\s*'companion'/.test(GAME) && /back:\s*\{\s*href:\s*'\/'/.test(GAME) && /log:\s*true/.test(GAME));
  t('the show runs at the member\'s reading pace (the Continue button)',
    /pace:\s*'manual'/.test(GAME));
  t('the hostess script is loaded before the mascot engine',
    GAME.indexOf('pd-domey-lady.js') > -1 && GAME.indexOf('pd-domey-lady.js') < GAME.indexOf('pd-mascot.js'));

  /* The hostess herself is protected by scripts/audit-domey.mjs (22 geometric
     checks); here we protect the engine contract she plugs into. */
  t('the hostess honours the renderer contract (buildRig + update + setViseme + look + act + dispose)',
    /buildRig:\s*function|function buildRig/.test(LADY_JS) &&
    ['update', 'setViseme', 'setState', 'look', 'act', 'dispose']
      .every((m) => new RegExp('rig\\.' + m + '\\s*=|' + m + ':\\s*function').test(LADY_JS)));
  t('the mascot prefers the hostess and falls back to the cartoon rig',
    /global\.PDDomeyLady/.test(MASCOT_JS) && /the hostess could not be built, using the cartoon rig/.test(MASCOT_JS));
  t('the hostess is framed head to feet (her own fit, not the cartoon defaults)',
    /fit:\s*\{\s*height:\s*2\.8,\s*width:\s*1\.72,\s*y:\s*0\.55\s*\}/.test(MASCOT_JS) &&
    /\(options\.fit && options\.fit\.height\) \|\| 2\.85/.test(read('assets/pd-domey3d.js')));
  t('she is stood on the engine\'s stage floor, not hovering above it',
    /rig\.root\.position\.y -= 0\.09/.test(MASCOT_JS));

  /* ------------------------------- 1b. every question keeps four choices */
  /* A true-or-false rewrite used to live here. It was removed because with
     only "True" and "False" on the chips a member who answered the obvious
     name was scored wrong — a 50/50 coin toss, not a memory of the Word. */
  t('the game never turns a four-choice question into a two-way coin toss',
    !/asTrueFalse/.test(GAME) && !/True or false: /.test(GAME) && !/kind: 'tf'/.test(GAME));
  t('verse completion is deliberately not invented from references',
    /deliberately NOT generated/.test(GAME));
  t('the bank still hands Domey four distinct choices for every question',
    (() => {
      const bankWindow = {};
      new Function('window', read('assets/pd-domey-questions.js'))(bankWindow);
      const items = bankWindow.PDDomeyQuestions.all();
      return items.length >= 1000 && items.every((i) => i.options.length === 4 &&
        new Set(i.options).size === 4 && i.options[i.answer] != null);
    })());

  /* ------------------------------------------ 2. the companion layout DOM */
  const dom = new JSDOM('<!doctype html><html><body><div id="stage"></div></body></html>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://prayerdome.net/game' });
  const w = dom.window;
  installFakeEars(w);
  installFakeVoice(w, { msPerWord: 60 });
  w.eval(MASCOT_JS);
  const M = w.PDMascot;

  const host = M.mount('#stage', {
    name: 'Domey',
    layout: 'companion',
    back: { href: '/', label: 'Home' },
    log: true
  });
  const hurry = setInterval(() => { try { host.hurry(); } catch (e) {} }, 70);
  const root = host.root;

  t('the companion layout is marked on the root',
    root.classList.contains('pdm-companion'));
  t('a compact bar carries the back button and the scoreboard, above the stage',
    !!root.querySelector('.pdm-topbar') && !!root.querySelector('.pdm-topbar .pdm-back') &&
    !!root.querySelector('.pdm-topbar .pdm-hud') &&
    root.querySelector('.pdm-topbar').compareDocumentPosition(root.querySelector('.pdm-stage')) === 4 /* FOLLOWING */);
  t('the scoreboard is NOT floating over the character (the stage holds no hud)',
    !root.querySelector('.pdm-stage .pdm-hud'));
  t('the dialogue card carries her name, her message, the listening line and the controls',
    !!root.querySelector('.pdm-dialogue-card') &&
    !!root.querySelector('.pdm-dialogue-card .pdm-bubble .pdm-who') &&
    !!root.querySelector('.pdm-dialogue-card .pdm-text') &&
    !!root.querySelector('.pdm-dialogue-card .pdm-heard') &&
    !!root.querySelector('.pdm-dialogue-card .pdm-bar'));
  t('the written conversation is rendered under everything she says',
    !!root.querySelector('.pdm-log'));

  /* The HUD a member actually reads: round, correct answers, XP. */
  host.setHud({ round: 1, total: 5, score: 2, xp: 45, dots: ['correct', 'wrong', 'current'] });
  const hudText = root.querySelector('.pdm-topbar .pdm-hud').textContent;
  t('the scoreboard reads Round, correct and XP with small icon chips',
    /Round 1 \/ 5/.test(hudText) && /2 correct/.test(hudText) && /45 XP/.test(hudText) &&
    !!root.querySelector('.pdm-topbar .pdm-hud .pdm-hud-chip i'));

  /* -------------------------------- 3. a full round, answered by voice */
  const verdicts = [];
  host.on('verdict', (v) => verdicts.push(v));
  const scores = [];
  const rounds = [];
  host.on('round', (r) => rounds.push(r.question));
  const bank = [
    { q: 'Who built the ark?', verse: 'Genesis 6:14 says Noah built the ark.',
      options: ['Abraham', 'Noah', 'Moses', 'David'], answer: 1, kind: 'choice' },
    { q: 'How many disciples did Jesus choose?', verse: 'Luke 6:13 names twelve apostles.',
      options: ['Seven', 'Ten', 'Twelve', 'Twenty'], answer: 2, kind: 'choice' }
  ];
  const playing = M.show(host, { rounds: 2, bank, pace: 'manual', onScore: (s) => scores.push(s) });

  /* The show shuffles both the questions and the answer positions, so the
     driver reads the live question (from the 'round' event) and plays it like
     a member would: say the right answer out loud, then tap a wrong one. */
  const q1 = () => rounds[0];
  const q2 = () => rounds[1];
  const chipFor = (text) => [...root.querySelectorAll('.pdm-chip .pdm-chip-label')]
    .find((label) => label.textContent === text);

  const deadline = Date.now() + 40000;
  let sawInterim = false;
  let markedWrong = 0;
  let markedRight = 0;
  let nameDone = false;
  let q1Done = false;
  let q2Done = false;
  const seenVisemes = new Set();
  const visemeWatch = setInterval(() => {
    seenVisemes.add(root.getAttribute('data-pdm-vis'));
  }, 20);

  while (Date.now() < deadline) {
    await sleep(40);

    // The name question: answer it by voice — but only once the question is
    // actually listening (its say() has finished and the ears are open).
    if (!nameDone && host.answerResolve && /what should I call you/i.test(host.lastSpoken || '')) {
      for (let i = 0; i < 40 && !(host.ears && host.ears.current); i++) await sleep(50);
      w.__say('My name is Grace');
      nameDone = true;
      continue;
    }

    const chips = [...root.querySelectorAll('.pdm-chip')].filter((c) => !c.disabled);

    // Question 1: four big A–D buttons, answered by VOICE — the right answer,
    // spoken like a member would say it.
    if (nameDone && !q1Done && host.answerResolve && chips.length >= 4 && q1()) {
      const letters = chips.slice(0, 4).map((c) => (c.querySelector('.pdm-chip-letter') || {}).textContent);
      if (letters.join('') !== 'ABCD' || !chips[0].classList.contains('pdm-chip-big')) continue;
      for (let i = 0; i < 40 && !(host.ears && host.ears.current); i++) await sleep(50);
      // interim first: the member's words appear on screen as they are spoken…
      w.__say('The answer', false);
      await sleep(60);
      const heard = root.querySelector('.pdm-heard');
      sawInterim = !!heard && !heard.hidden && /answer/i.test(heard.textContent || '');
      // …then the final, understood answer.
      w.__say('The answer is ' + q1().options[q1().correctIndex], true);
      q1Done = true;
      continue;
    }

    // After the verdict: the Continue button holds the explanation on screen.
    if (q1Done && !q2Done && chips.some((c) => c.classList.contains('pdm-chip-continue'))) {
      const logText = root.querySelector('.pdm-log').textContent;
      if (new RegExp(q1().verse.split(' ')[0] + ' \\d+').test(logText) || /says|names/.test(logText)) {
        root.querySelector('.pdm-chip-continue').click();
        q2Done = true;
      }
      continue;
    }

    // Question 2: answered by TAPPING a wrong choice on purpose.
    if (q2Done === true && host.answerResolve && chips.filter((c) => c.classList.contains('pdm-chip-big')).length >= 4 && q2()) {
      const wrong = q2().options.find((text, i) => i !== q2().correctIndex);
      const chip = chipFor(wrong);
      if (chip) {
        chip.closest('.pdm-chip').click();
        q2Done = 'answered';
        markedWrong = root.querySelectorAll('.pdm-chip.is-wrong').length;
        markedRight = root.querySelectorAll('.pdm-chip.is-correct').length;
      }
      continue;
    }

    if (q2Done === 'answered' && chips.some((c) => c.classList.contains('pdm-chip-continue'))) {
      const logText = root.querySelector('.pdm-log').textContent;
      if (/The answer is /.test(logText)) {
        root.querySelector('.pdm-chip-continue').click();
        break;
      }
      continue;
    }
  }

  clearInterval(visemeWatch);
  const summary = await Promise.race([playing, sleep(15000).then(() => null)]);
  clearInterval(hurry);

  t('the round plays to the end with a summary',
    !!summary && summary.total === 2, JSON.stringify(summary));
  t('answering by voice (speaking the printed answer) matched the right choice',
    verdicts.length >= 1 && verdicts[0].right === true &&
    verdicts[0].chosenText === rounds[0].options[rounds[0].correctIndex],
    JSON.stringify(verdicts[0]));
  t('the spoken answer appeared on screen as it was spoken (interim transcription)',
    sawInterim === true);
  t('the final understood answer is written into the conversation as YOU',
    (() => {
      const you = [...root.querySelectorAll('.pdm-log-row.pdm-log-you')];
      return you.some((r) => /The answer is/i.test(r.textContent));
    })());
  t('the verdict and verse for a wrong answer are spoken AND written',
    verdicts.length >= 2 && verdicts[1].right === false &&
    new RegExp('The answer is ' + (rounds[1] ? rounds[1].options[rounds[1].correctIndex] : ''))
      .test(root.querySelector('.pdm-log').textContent));
  t('a wrong tap marks the wrong button and reveals the right one',
    markedWrong === 1 && markedRight >= 1,
    'wrong ' + markedWrong + ' / right ' + markedRight);
  t('one score event per question — no duplicate awards',
    scores.length === 2 && scores.filter((s) => s.right).length === 1,
    JSON.stringify(scores.map((s) => s.right)));

  const logRows = [...root.querySelectorAll('.pdm-log-row')];
  t('the written conversation carries DOMEY and YOU labels in distinct styles',
    logRows.some((r) => r.classList.contains('pdm-log-host') && /Domey/.test(r.querySelector('.pdm-log-who').textContent)) &&
    logRows.some((r) => r.classList.contains('pdm-log-you') && /You/.test(r.querySelector('.pdm-log-who').textContent)) &&
    logRows.some((r) => r.classList.contains('pdm-log-host') && r.classList.contains('pdm-log-you')) === false);
  t('her spoken words and the written words are the same words',
    logRows.some((r) => /Question 1\./.test(r.textContent)) &&
    logRows.some((r) => /Who built the ark\?/.test(r.textContent)));
  t('the microphone really heard the member (both questions came back by voice or tap)',
    verdicts.length === 2);
  t('the mouth moved through several visemes while she spoke',
    seenVisemes.size >= 3, [...seenVisemes].filter(Boolean).join(' '));

  host.destroy();
  t('destroy() empties the stage', root.childElementCount === 0);

  /* ------------------------- 4. the mouth follows the VOICE's own clock */
  /* The MouthMotor learns the voice's real pace from the gaps between its
     word boundaries, stretches its frames when the voice is slower, and jumps
     BACK to the word the voice is actually saying when it ran ahead. */
  const paceDom = new JSDOM('<!doctype html><html><body><div id="stage"></div></body></html>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://prayerdome.net/game' });
  const pw = paceDom.window;
  installFakeVoice(pw, { msPerWord: 400 });
  pw.eval(MASCOT_JS);
  const PM = pw.PDMascot;
  const paceHost = PM.mount('#stage', { name: 'Domey', layout: 'companion', log: false });

  const plan = PM.lipSync('one two three four five six', 1);
  paceHost.mouth.start(plan);
  // The voice starts on word one (the motor's own timer is held so the
  // arithmetic below is exact — this is a unit check of the pace learning)…
  paceHost.mouth.jumpToWord(0);
  pw.clearTimeout(paceHost.mouth.timer);
  // …and takes about twice as long as the plan allowed for it:
  await sleep(Math.round(plan[0].ms * 2.2));
  paceHost.mouth.jumpToWord(1);            // word two finally arrives
  t('a slow voice stretches the mouth plan (frames held longer)',
    paceHost.mouth.rateScale > 1.05, String(paceHost.mouth.rateScale));
  // The voice is still on word one while the mouth ran ahead to four:
  paceHost.mouth.wi = 3;
  paceHost.mouth.jumpToWord(1);
  t('a boundary behind the current word pulls the mouth back to the spoken word',
    paceHost.mouth.wi === 1);
  // Now the voice races ahead while the mouth is behind: its boundaries
  // arrive faster than the plan expected, so the frames are compressed.
  paceHost.mouth.rateScale = 1;
  paceHost.mouth.lastBoundaryAt = 0;
  paceHost.mouth.jumpToWord(1);
  pw.clearTimeout(paceHost.mouth.timer);
  await sleep(40);
  paceHost.mouth.jumpToWord(2);
  t('a quick voice compresses the mouth plan',
    paceHost.mouth.rateScale < 0.95, String(paceHost.mouth.rateScale));

  /* End to end with the fake voice: the whole line is spoken, boundaries fire
     as it goes, and the lips close when it ends. */
  await paceHost.say('Trust in the Lord with all your heart', { hold: 0 });
  t('the mouth plan finishes with the voice and the lips close',
    paceHost.mouth.done === true &&
    (paceHost.root.getAttribute('data-pdm-vis') === null || paceHost.root.style.getPropertyValue('--pdm-jaw') === '0'));
  paceHost.destroy();

  /* ------------------------------------- 5. mishearing: retry or edit */
  const retryDom = new JSDOM('<!doctype html><html><body><div id="stage"></div></body></html>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://prayerdome.net/game' });
  const rw = retryDom.window;
  installFakeEars(rw);
  installFakeVoice(rw, { msPerWord: 60 });
  rw.eval(MASCOT_JS);
  const RM = rw.PDMascot;
  const retryHost = RM.mount('#stage', { name: 'Domey', layout: 'companion', log: true });
  const retryHurry = setInterval(() => { try { retryHost.hurry(); } catch (e) {} }, 60);

  const retryQ = retryHost.ask({
    text: 'Who built the ark?',
    kind: 'choice',
    choices: ['Abraham', 'Noah', 'Moses', 'David'],
    correctIndex: 1,
    listen: true,
    listenTimeout: 3000
  });
  for (let i = 0; i < 50 && !retryHost.answerResolve; i++) await sleep(100);
  await sleep(350);                        // the ears open a beat after
  rw.__say('Ummm let me think', false);   // interim noise
  await sleep(60);
  rw.__say('the boat man maybe');          // not a match
  await sleep(400);
  const nudged = /catch|try once more|not sure/i.test(retryHost.lastSpoken || '');
  t('a misheard answer keeps the question open and invites another try',
    nudged && typeof retryHost.answerResolve === 'function', retryHost.lastSpoken);
  const heardBeforeTyping = (() => {
    const heard = retryHost.root.querySelector('.pdm-heard');
    return !!heard && !heard.hidden && /boat man/i.test(heard.textContent || '');
  })();
  t('the recognized text stayed on screen for the member to check',
    heardBeforeTyping === true);
  // …and the member can always EDIT: type the answer instead.
  retryHost.answerInput.value = 'Noah';
  retryHost.answerForm.dispatchEvent(new rw.Event('submit', { bubbles: true, cancelable: true }));
  const retried = await retryQ;
  t('typing the answer after a mishearing is judged by the same evaluation',
    retried.source === 'typed' && retried.index === 1, JSON.stringify(retried));
  clearInterval(retryHurry);
  retryHost.destroy();

  /* ------------------------------ 6. the stylesheet keeps her uncovered */
  t('the companion stylesheet: one column, big A–D buttons, stacked on phones',
    /\.pd-mascot\.pdm-companion\s*\{[^}]*grid-template-columns:\s*1fr;/.test(MASCOT_CSS) &&
    /\.pdm-chip\.pdm-chip-big/.test(MASCOT_CSS) &&
    /@media \(max-width: 420px\)/.test(MASCOT_CSS) &&
    /\.pdm-companion \.pdm-chips\s*\{[^}]*grid-template-columns:\s*1fr 1fr;/.test(MASCOT_CSS));
  t('the dialogue card and conversation are styled, not bare',
    /\.pdm-companion \.pdm-dialogue-card/.test(MASCOT_CSS) && /\.pdm-log-row/.test(MASCOT_CSS) &&
    /\.pdm-log-you/.test(MASCOT_CSS) && /\.pdm-log-host/.test(MASCOT_CSS));
  t('the listening indicator lives inside the dialogue card',
    /\.pdm-companion \.pdm-dialogue-card \.pdm-bar/.test(MASCOT_CSS) && /\.pdm-heard/.test(MASCOT_CSS));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
