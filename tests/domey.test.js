/*
 * Prayer Dome — Domey, the talking host who hears you (and the bell that opens)
 * ===========================================================================
 * The member-facing promises this file protects:
 *
 *   1. Domey's mouth really moves: the character carries a set of mouth
 *      postures (visemes) and the line being spoken drives them word by word —
 *      lips, captions and voice all read from the same plan.
 *   2. Domey acts: he waves, points, claps, dances. Actions are classes on the
 *      character, so they are cheap, and `prefers-reduced-motion` stops them.
 *   3. Domey hears the member: the microphone opens from the SAME tap that
 *      starts the show (the only moment a browser allows it), the answer is
 *      matched to the question, and "repeat"/"hint"/"skip" are understood.
 *   4. Tapping the notification bell always DISPLAYS something — on a page
 *      that never carried the panel markup, the panel is built for it.
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

const MASCOT_JS = read('assets/pd-mascot.js');
const MASCOT_CSS = read('assets/pd-mascot.css');
const GAME = read('game.html');
const APP_JS = read('assets/pd-app.js');
const BRAND_CSS = read('assets/pd-brand.css');

/* A stand-in for the browser speech engine: it starts, it can be "spoken to"
   and it reports results exactly like the real SpeechRecognition object. */
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
  window.__sessions = sessions;
  window.__say = (transcript, final) => {
    const live = sessions.filter((s) => s.started && !s.aborted);
    const session = live[live.length - 1];
    if (!session || !session.onresult) return false;
    const result = [{ transcript: transcript }];
    result.isFinal = final !== false;
    const results = [result];
    session.onresult({ resultIndex: 0, results: results });
    return true;
  };
  return sessions;
}

(async function run() {
  /* ------------------------------------------------ 1. the visible character */
  t('the character is drawn with a real mouth: one shape per viseme',
    ['pdm-vis-M', 'pdm-vis-F', 'pdm-vis-E', 'pdm-vis-I', 'pdm-vis-A', 'pdm-vis-O', 'pdm-vis-U', 'pdm-vis-L']
      .every((cls) => MASCOT_JS.includes(cls)) &&
    MASCOT_CSS.includes('.pdm-visemes .pdm-vis { opacity: 0;'));
  t('the viseme mouth owns the mouth only while the engine is speaking',
    /\.pd-mascot\[data-pdm-vis\] \.pdm-mouths \{ opacity: 0; \}/.test(MASCOT_CSS) &&
    /data-pdm-vis="A"\] \.pdm-vis-A/.test(MASCOT_CSS) &&
    /MouthMotor\.prototype\.release/.test(MASCOT_JS));
  t('the lips are moved by a jaw amount the engine sets',
    MASCOT_JS.includes('--pdm-jaw') && MASCOT_CSS.includes('var(--pdm-jaw'));
  t('the character has eyes that follow the member and a nose, lashes and shading',
    MASCOT_JS.includes('pdm-gaze') && MASCOT_JS.includes('pdm-nose') &&
    MASCOT_JS.includes('pdm-lash') && MASCOT_JS.includes('pdm-face-shade'));
  t('the hand microphone is raised when Domey listens',
    MASCOT_JS.includes('pdm-prop-mic') &&
    /data-pdm-state="listening"\] \.pdm-prop-mic/.test(MASCOT_CSS));
  t('every action has a stylesheet performance (wave, point, clap, dance…)',
    ['wave', 'point', 'open', 'offer', 'count', 'thumb', 'raise', 'shrug', 'clap', 'heart', 'think', 'dance', 'mic']
      .every((name) => MASCOT_CSS.includes('.pdm-act-' + name + ' ')) &&
    (MASCOT_CSS.match(/@keyframes pdm-g-/g) || []).length >= 15);

  t('the stylesheet is still self-contained (no downloads, reduced-motion safe)',
    !/url\(\s*['"]?https?:/i.test(MASCOT_CSS) && /@media \(prefers-reduced-motion: reduce\)/.test(MASCOT_CSS));
  t('richer sound cues are synthesised, never downloaded',
    /case 'applause'/.test(MASCOT_JS) && /case 'fanfare'/.test(MASCOT_JS) &&
    /createBuffer/.test(MASCOT_JS) && !/\.mp3|\.wav/.test(MASCOT_JS));

  /* ------------------------------------------- 2. behaviour in a real DOM */
  const dom = new JSDOM('<!doctype html><html><body><div id="stage"></div></body></html>',
    { runScripts: 'outside-only', url: 'https://prayerdome.net/game' });
  const w = dom.window;
  const sessions = installFakeEars(w);
  w.eval(MASCOT_JS);
  const M = w.PDMascot;
  const host = M.mount('#stage', { name: 'Domey', actions: true, lipSync: true });
  const hurry = setInterval(() => { try { host.hurry(); } catch (e) {} }, 70);

  t('the host knows it can hear (fake speech engine present)', host.canHear() === true && M.supportsListening() === true);
  t('the published action list matches what the stylesheet can perform',
    M.actions.every((name) => MASCOT_CSS.includes('pdm-act-' + name)), M.actions.join(' '));

  /* lip-sync plan: one entry per printed word, every shape a real viseme */
  const plan = M.lipSync('God is good', 1);
  t('a spoken line becomes a per-word mouth plan',
    plan.length === 3 && plan.map((p) => p.word).join(' ') === 'God is good' &&
    plan.every((p) => p.frames.length > 0) &&
    plan.every((p) => p.frames.every((f) => M.visemes.includes(f.v))),
    JSON.stringify(plan.map((p) => p.frames.map((f) => f.v).join(''))));
  t('a word with only consonants still gets a mouth posture',
    M.lipSync('mm', 1)[0].frames.length > 0);

  /* The mouth really moves. Watched on an unhurried host: the hurry ticker the
     rest of this file uses skips to the end of a line, which is exactly what a
     member does when they tap the bubble. */
  const mouthStage = w.document.createElement('div');
  w.document.body.appendChild(mouthStage);
  const talker = M.mount(mouthStage, { name: 'Domey' });
  const seenVisemes = new Set();
  const mouthWatch = setInterval(() => { seenVisemes.add(mouthStage.getAttribute('data-pdm-vis')); }, 25);
  const line = talker.say('Moses led the people out of Egypt.', { hold: 0 });
  await sleep(700);
  t('the mouth changes posture while the line is being spoken',
    seenVisemes.size >= 4 && !seenVisemes.has(null), [...seenVisemes].join(' '));
  clearInterval(mouthWatch);
  const gesturing = new Set();
  const gestureWatch = setInterval(() => { gesturing.add(mouthStage.getAttribute('data-pdm-act')); }, 60);
  await line;
  clearInterval(gestureWatch);
  t('Domey gestures on his own while he talks',
    [...gesturing].filter(Boolean).length >= 1, [...gesturing].join(' '));
  t('when the line ends the mouth is handed back to the expression (Domey smiles again)',
    mouthStage.getAttribute('data-pdm-vis') === null &&
    mouthStage.getAttribute('data-pdm-state') !== 'speaking');
  t('a spoken line is captioned word by word for the member who cannot hear it',
    mouthStage.querySelectorAll('.pdm-word').length > 0 &&
    mouthStage.querySelectorAll('.pdm-word.shown').length === mouthStage.querySelectorAll('.pdm-word').length);
  talker.destroy();

  /* captions and lips are driven by the same plan */
  await host.say('Trust in the Lord with all your heart.', { hold: 0 });
  t('the caption of every word the lips reached is revealed',
    host.root.querySelectorAll('.pdm-word').length > 0 &&
    host.root.querySelectorAll('.pdm-word.shown').length === host.root.querySelectorAll('.pdm-word').length);

  /* actions */
  host.act('wave', 260);
  t('an action is played on the character (and announced)',
    host.root.classList.contains('pdm-act-wave') && host.root.getAttribute('data-pdm-act') === 'wave');
  await sleep(360);
  t('the action clears itself so the hands return to rest',
    !host.root.classList.contains('pdm-act-wave') && !host.root.getAttribute('data-pdm-act'));

  /* floating reactions */
  host.react('star', 3);
  t('a win floats a little celebration up the stage',
    host.root.querySelectorAll('.pdm-reaction').length === 3);

  /* ---------------------------------- 3. hearing the member's voice */
  const nameAsk = host.ask({ text: 'What should I call you?', kind: 'name', allowSkip: true, listenTimeout: 4000 });
  await sleep(700);
  t('the question opens the microphone by itself (no extra tap)',
    host.micEnabled === true && host.root.classList.contains('pdm-mic-on'));
  t('Domey raises the microphone to his mouth when listening',
    host.root.getAttribute('data-pdm-state') === 'listening' && host.root.getAttribute('data-pdm-act') === 'mic');
  w.__say('My name is Grace');
  const nameAnswer = await nameAsk;
  t('a spoken answer is heard and understood',
    nameAnswer.source === 'voice' && /grace/i.test(nameAnswer.text), JSON.stringify(nameAnswer));

  /* tapping the character himself opens his ears */
  const tapper = M.mount(w.document.createElement('div'), { name: 'Domey' });
  t('tapping Domey himself offers to open his ears (a real gesture)',
    tapper.stage.getAttribute('title') === 'Tap Domey to let him hear you');
  tapper.stage.click();
  await sleep(120);
  t('and the microphone really opens when he is tapped',
    tapper.micEnabled === true && tapper.root.classList.contains('pdm-mic-on'));
  tapper.destroy();

  /* real questions: a right answer, then the spoken commands */
  const heard = [];
  host.on('heard', (text) => heard.push(text));
  const q = host.ask({
    text: 'Who built the ark?',
    kind: 'choice',
    choices: ['Noah', 'Moses', 'Abraham'],
    correctIndex: 0,
    hints: ['Genesis 6:14'],
    listenTimeout: 4000
  });
  await sleep(600);
  w.__say('hint');
  await sleep(700);
  t('saying "hint" makes Domey give the hint and stay on the question',
    /Genesis 6:14/.test(host.lastSpoken || '') && typeof host.answerResolve === 'function',
    host.lastSpoken);
  await sleep(500);
  w.__say('Noah');
  const answered = await q;
  t('a spoken Bible answer is matched to the right choice',
    answered.index === 0 && answered.source === 'voice' && heard.includes('Noah'),
    JSON.stringify(answered));

  const skipQ = host.ask({ text: 'Shall we keep going?', choices: ['Yes', 'No'], listenTimeout: 4000 });
  await sleep(600);
  w.__say('skip');
  const skipped = await skipQ;
  t('saying "skip" moves the show along without a tap',
    skipped.source === 'skip' && skipped.text === '');

  const repeatQ = host.ask({
    text: 'How many days did Jesus fast?',
    kind: 'choice',
    choices: ['40', '7'],
    listenTimeout: 4000
  });
  await sleep(600);
  w.__say('say that again');
  await sleep(700);
  t('saying "repeat" makes Domey say the question again',
    /How many days did Jesus fast/.test(host.lastSpoken || ''), host.lastSpoken);
  await sleep(500);
  w.__say('I think it was forty days');
  const repeated = await repeatQ;
  t('and a spoken number is understood as the printed answer (forty -> 40)',
    repeated.index === 0 && repeated.source === 'voice', JSON.stringify(repeated));
  t('spoken numbers are matched to printed digits by the shared matcher',
    M.match('forty', ['40', '7']).index === 0 && M.match('seven', ['40', '7']).index === 1 &&
    M.match('twenty two', ['22', '20']).index === 0);

  /* Domey always tries to hear: a question reopens the ears by itself. */
  host.disableMic();
  const midQ = host.ask({
    text: 'Who was thrown into the lions den?',
    kind: 'choice',
    choices: ['Daniel', 'Jonah'],
    listenTimeout: 4000
  });
  await sleep(600);
  t('a question opens the ears again even after they were closed',
    host.micEnabled === true && host.root.classList.contains('pdm-mic-on'));
  w.__say('Daniel');
  const midAnswer = await midQ;
  t('and the spoken answer is heard', midAnswer.index === 0 && midAnswer.source === 'voice');

  /* A member who blocked the microphone is never trapped in a deaf question. */
  host.ears.permission = 'denied';
  host._micWarmed = true;
  host.disableMic();
  t('Domey stops offering a microphone the member blocked',
    (await host.enableMic()) === false && host.micEnabled === false);
  const typedQ = host.ask({ text: 'Name a prophet.', kind: 'text', listenTimeout: 400, timeout: 8000 });
  await sleep(300);
  host.answerInput.value = 'Isaiah';
  host.answerForm.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  const typedAnswer = await typedQ;
  t('typing still answers, so the show always moves on',
    typedAnswer.text === 'Isaiah' && typedAnswer.source === 'typed');
  host.ears.permission = 'granted';

  clearInterval(hurry);
  host.destroy();
  t('destroy() still cleans the character up completely', host.root.innerHTML === '');

  /* ---------------------------------- 4. the game page wires it together */
  t('the game page shows Domey first, not hidden behind a tab',
    /id="panel-talk"[^>]*style="padding:24px/.test(GAME) && /function wakeDomey/.test(GAME));
  t('starting the show opens the microphone from the same tap',
    /host\.canHear\(\)\) host\.enableMic\(\)/.test(GAME));
  t('the game page tells the member what Domey can do (and that nothing is recorded)',
    /domeyMicNote/.test(GAME) && /Nothing is recorded/.test(GAME) &&
    /<strong>repeat<\/strong>, <strong>hint<\/strong>/.test(GAME));
  t('the stage is enlarged so the mouth and hands are easy to see',
    /#panel-talk \.pd-mascot/.test(GAME) && /#panel-talk \.pdm-stage/.test(GAME));

  /* ---------------------------------- 5. the bell always displays something */
  const gameDom = new JSDOM(GAME, {
    url: 'https://prayerdome.net/game.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.Notification = { permission: 'default', requestPermission: () => Promise.resolve('granted') };
      window.matchMedia = window.matchMedia || function () { return { matches: false, addListener() {}, removeListener() {} }; };
      window.scrollTo = () => {};
      window.confirm = () => true;
    }
  });
  const gw = gameDom.window;
  gw.eval(read('assets/pd-content-data.js'));
  gw.eval(APP_JS);
  await sleep(120);

  const gdoc = gw.document;
  t('the game page keeps exactly one bell', gdoc.querySelectorAll('#pdNotifBell').length === 1);
  const bell = gdoc.getElementById('pdNotifBell');
  t('a page that never had the panel markup gets one built for it',
    !!gdoc.getElementById('pdNotifPanel') && !!gdoc.getElementById('pdNotifList'));

  bell.click();
  await sleep(40);
  const panel = gdoc.getElementById('pdNotifPanel');
  t('tapping the bell opens the notification centre',
    panel.classList.contains('open') && bell.getAttribute('aria-expanded') === 'true');
  t('the open centre shows a real empty state, not a blank box',
    (panel.textContent || '').includes('No notifications yet') ||
    panel.querySelectorAll('.pd-notif-item').length > 0);
  t('device alerts are offered inside the centre, without stealing the tap',
    !!panel.querySelector('[data-pd-notif="enable"]') &&
    !panel.querySelector('[data-pd-notif="alerts"]').hidden);

  gw.PDApp.notifications.push({ type: 'live', title: 'Prayer Dome Live', message: 'Sunday service starts now', link: '/live.html' });
  await sleep(30);
  t('a new announcement appears in the centre as unread',
    panel.querySelectorAll('.pd-notif-item').length >= 1 &&
    panel.querySelectorAll('.pd-notif-unread').length >= 1 &&
    gdoc.getElementById('pdNotifBadge').style.display === 'flex');
  t('the announcement is a real row a member can open',
    (panel.querySelector('.pd-notif-title') || {}).textContent === 'Prayer Dome Live' &&
    !!panel.querySelector('.pd-notif-go'));

  gw.document.dispatchEvent(new gw.KeyboardEvent('keydown', { key: 'Escape' }));
  await sleep(30);
  t('Escape closes the centre again', !panel.classList.contains('open'));

  bell.click();
  await sleep(30);
  gdoc.body.click();
  await sleep(30);
  t('tapping outside closes it too, so nothing is ever stuck open', !panel.classList.contains('open'));

  t('the in-centre "turn on" button asks the browser for permission',
    /data-pd-notif="enable"[\s\S]{0,80}showEnablePop|showEnablePop\(\)/.test(APP_JS) &&
    /notifications\.syncAlerts\(\)/.test(APP_JS));
  t('the centre is styled from the shared brand stylesheet',
    BRAND_CSS.includes('.pd-notif-alerts') && MASCOT_CSS.includes('.pdm-reactions'));

  /* Every other page that shows a bell: the same tap must display something.
     lessons.html is one of the pages that never carried the panel markup. */
  const pageFiles = require('fs').readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  const bellPages = pageFiles.filter((f) => read(f).includes('pdNotifBell'));
  const missing = bellPages.filter((f) => !read(f).includes('pdNotifPanel'));
  t('the bell is offered on many pages, most of them with no panel markup',
    bellPages.length >= 8 && missing.length >= 5, `${bellPages.length} bells, ${missing.length} without markup`);

  const lessonsDom = new JSDOM(read('lessons.html'), {
    url: 'https://prayerdome.net/lessons.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.Notification = { permission: 'default', requestPermission: () => Promise.resolve('granted') };
      window.matchMedia = window.matchMedia || function () { return { matches: false, addListener() {}, removeListener() {} }; };
      window.scrollTo = () => {};
    }
  });
  lessonsDom.window.eval(read('assets/pd-content-data.js'));
  lessonsDom.window.eval(APP_JS);
  await sleep(120);
  const lessonsBell = lessonsDom.window.document.getElementById('pdNotifBell');
  lessonsBell.click();
  await sleep(40);
  t('a lesson page bell opens a real notification centre too',
    lessonsDom.window.document.getElementById('pdNotifPanel').classList.contains('open'));
  lessonsDom.window.PDApp.ui.toggleNotifPanel(true);
  t('toggleNotifPanel() never silently does nothing',
    lessonsDom.window.document.getElementById('pdNotifPanel').classList.contains('open'));

  // Both windows hold timers (the host schedules its own), so close them or
  // the process would sit here until the last one fires.
  try { lessonsDom.window.close(); } catch (e) {}
  try { gameDom.window.close(); } catch (e) {}
  try { dom.window.close(); } catch (e) {}

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
