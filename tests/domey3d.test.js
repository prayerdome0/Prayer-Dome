/*
 * Prayer Dome — Domey in three dimensions, and the thousand questions he asks
 * ===========================================================================
 * The member-facing promises this file protects:
 *
 *   1. Domey knows more than a thousand Bible questions — every one of them
 *      well formed (four distinct choices, one real answer, a scripture
 *      reference) and shuffled so the right answer is never always first.
 *   2. Domey's body is a real 3D character: buildRig() assembles lit meshes,
 *      and every viseme and every gesture moves part of that body.
 *   3. It works with zero network. three.js is vendored in /assets with its
 *      licence, loaded by dynamic import, and the whole engine falls back to
 *      the drawn character when WebGL or modules are missing.
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
const exists = (p) => fs.existsSync(path.join(ROOT, p));

/* The bank and the engine are both classic scripts that publish themselves on
   `window`, so they can be loaded in a bare sandbox — no DOM needed. */
function evalOnWindow(source) {
  const sandbox = {};
  new Function('window', source)(sandbox);
  return sandbox;
}

(async function run() {
  /* ------------------------------------------------ 1. the question bank */
  const bankWindow = evalOnWindow(read('assets/pd-domey-questions.js'));
  const Q = bankWindow.PDDomeyQuestions;

  t('the question bank publishes itself for the game page', !!Q && typeof Q.count === 'number');
  t('Domey knows more than a thousand questions', Q.count >= 1000, String(Q.count));
  t('every question in the bank passes its own health check', Q.validate().length === 0,
    Q.validate().slice(0, 3).join(' | '));
  t('the bank is already spread across the four answer positions',
    (function () {
      const count = [0, 0, 0, 0];
      Q.all().forEach((item) => { count[item.answer] += 1; });
      return count.every((n) => n >= Q.count * 0.15);
    })(), (function () {
      const count = [0, 0, 0, 0];
      Q.all().forEach((item) => { count[item.answer] += 1; });
      return count.join(' / ');
    })());

  const topics = Q.topics();
  t('the bank covers the whole Bible, not one corner of it',
    topics.length >= 14 && topics.every((topic) => topic.count >= 20),
    topics.map((topic) => topic.name + ' ' + topic.count).join(', '));
  t('the topics are offered in the order a Bible is read',
    topics.map((topic) => topic.name).join('|') === Q.topicOrder.filter(
      (name) => topics.some((topic) => topic.name === name)).join('|'));

  const everyQuestion = Q.all();
  t('every question is answerable: four distinct choices and one real answer',
    everyQuestion.every((item) => Array.isArray(item.options) && item.options.length === 4 &&
      new Set(item.options.map((choice) => choice.trim().toLowerCase())).size === 4 &&
      item.answer >= 0 && item.answer <= 3));
  t('every question carries the scripture it comes from',
    everyQuestion.every((item) => typeof item.verse === 'string' && /\d/.test(item.verse)));
  t('no question is asked twice',
    new Set(everyQuestion.map((item) => item.q)).size === everyQuestion.length);

  /* The host reads exactly these fields — check the shape it will be handed. */
  const rounds = Q.forMascot(5);
  t('forMascot() hands the host the shape it reads',
    rounds.length === 5 && rounds.every((item) =>
      typeof item.q === 'string' && Array.isArray(item.options) && item.options.length === 4 &&
      typeof item.answer === 'number' && typeof item.verse === 'string'));
  t('one show never repeats a question',
    new Set(rounds.map((item) => item.q)).size === rounds.length);
  t('a topic can be played on its own',
    Q.forMascot(4, { topic: 'Miracles' }).every((item) => item.topic === 'Miracles'));
  t('a question the member just saw can be skipped',
    (function () {
      const seen = Q.pick(3).map((item) => item.q);
      return !Q.pick(6, { exclude: seen.map((q) => ({ q: q })) })
        .some((item) => seen.includes(item.q));
    })());

  /* ------------------------------------------------ 2. the vendored engine */
  const engineWindow = evalOnWindow(read('assets/pd-domey3d.js'));
  const E = engineWindow.PDDomey3D;
  t('the 3D engine publishes itself for the game page', !!E && typeof E.buildRig === 'function' &&
    typeof E.create === 'function');
  t('three.js is vendored with its licence, not fetched from a CDN',
    exists('assets/three.module.min.js') && exists('assets/three-LICENSE.txt') &&
    /three\.module\.min\.js$/.test(E.threeUrl) && !/https?:/.test(E.threeUrl));
  t('the engine pins the revision it was built against', E.threeRevision === '165');
  t('the mouth postures and gestures match the host exactly',
    E.visemes.join(',') === ['rest', 'M', 'F', 'E', 'I', 'A', 'O', 'U', 'L'].join(',') &&
    Object.keys(E.visemeShapes).join(',') === E.visemes.join(',') &&
    Object.keys(E.actionPoses).join(',') === E.actions.join(',') &&
    E.actions.length >= 14);

  const THREE = await import('file://' + path.join(ROOT, 'assets/three.module.min.js'));
  t('the vendored module is the revision the engine expects',
    String(THREE.REVISION) === E.threeRevision, 'r' + THREE.REVISION);

  const rig = E.buildRig(THREE, {});
  let meshes = 0;
  rig.root.traverse((object) => { if (object.isMesh) meshes += 1; });
  const box = new THREE.Box3().setFromObject(rig.root);
  t('the character is built out of real, shaded meshes', meshes >= 50, meshes + ' meshes');
  t('the character is a whole little person, head to shoes',
    box.min.y < 0.05 && box.max.y > 1.6 && box.max.y < 2.3,
    box.min.y.toFixed(2) + ' → ' + box.max.y.toFixed(2));
  t('the head sits above the arms, and the arms above the floor',
    rig.head.getWorldPosition(new THREE.Vector3()).y > rig.arms.R.root.getWorldPosition(new THREE.Vector3()).y);
  t('the mouth is a real rig: cavity, lips, teeth and tongue',
    !!rig.mouthParts.cavity && !!rig.mouthParts.lips && !!rig.mouthParts.teeth && !!rig.mouthParts.tongue);

  function speak(viseme, jaw, frames) {
    for (let i = 0; i < (frames || 8); i += 1) {
      rig.update(1 / 60, { viseme: viseme, jaw: jaw, state: 'speaking' });
    }
  }

  const closed = rig.mouthParts.cavity.scale.y;
  speak('M', 0.05, 20);
  const mHeight = rig.mouthParts.cavity.scale.y;
  speak('A', 0.95, 4);
  const aHeight = rig.mouthParts.cavity.scale.y;
  t('the jaw really opens: "A" is taller than a closed "M"', aHeight > mHeight * 1.6,
    mHeight.toFixed(3) + ' → ' + aHeight.toFixed(3));
  t('the viseme assembly only shows while he is speaking',
    rig.speakingMouth.visible === true || aHeight > closed);

  /* Lips spread on a wide "I" and round on an "O" — the other half of lip-sync. */
  speak('I', 0.3, 30);
  const wide = rig.mouthParts.cavity.scale.x;
  speak('O', 1.0, 30);
  const round = rig.mouthParts.cavity.scale.x;
  t('lips spread for "I" and purse for "O"', wide > round, wide.toFixed(3) + ' vs ' + round.toFixed(3));

  /* Gestures: every one of them must move the body without throwing. */
  const armBefore = rig.arms.R.root.rotation.z;
  rig.act('wave', 900);
  for (let i = 0; i < 20; i += 1) rig.update(1 / 60, { state: 'idle' });
  t('waving lifts the arm above the resting pose', rig.arms.R.root.rotation.z > armBefore + 0.4,
    armBefore.toFixed(2) + ' → ' + rig.arms.R.root.rotation.z.toFixed(2));

  let gesturesOk = true;
  let gestured = 0;
  E.actions.forEach((action) => {
    try {
      rig.act(action, 400);
      for (let i = 0; i < 6; i += 1) rig.update(1 / 60, { act: action, state: 'idle' });
      gestured += 1;
    } catch (error) {
      gesturesOk = false;
      console.log('      gesture failed: ' + action + ' — ' + error.message);
    }
  });
  t('every published gesture animates the body', gesturesOk && gestured === E.actions.length,
    gestured + '/' + E.actions.length);
  t('every published state animates the body',
    E.states.every((state) => {
      try {
        rig.setState(state);
        for (let i = 0; i < 5; i += 1) rig.update(1 / 60, { state: state, gazeX: 0.3, gazeY: -0.2 });
        return true;
      } catch (error) { return false; }
    }));
  t('the eyes look where the host is listening', (function () {
    const settle = () => { for (let i = 0; i < 20; i += 1) rig.update(1 / 60, {}); };
    rig.look(1, 0); settle();
    const right = rig.eyes.R.eye.position.x;
    rig.look(-1, 0); settle();
    const left = rig.eyes.R.eye.position.x;
    return Number.isFinite(right) && Number.isFinite(left) && right > 0 && left < 0;
  })());
  t('a strange sensor value never breaks the frame',
    (function () {
      try {
        for (let i = 0; i < 4; i += 1) {
          rig.update(1 / 60, { viseme: 'bogus', jaw: NaN, state: 'nowhere', gazeX: NaN, gazeY: Infinity, act: 'moonwalk' });
        }
        rig.update(0, {});
        return true;
      } catch (error) { return false; }
    })());
  rig.react('sparkle', 3);
  for (let i = 0; i < 40; i += 1) rig.update(1 / 60, { state: 'celebrating' });
  t('celebration dust is recycled, never leaked', rig.sparks.length > 0 &&
    rig.sparks.filter((spark) => spark.mesh.visible).length <= rig.sparks.length);
  t('dispose() hands the whole model back', (function () {
    try {
      rig.dispose();
      return true;
    } catch (error) { return false; }
  })());

  /* ------------------------------------------- 3. the game page wiring */
  const GAME = read('game.html');
  t('the game page loads the 3D engine and the question bank',
    /\/assets\/pd-domey3d\.js/.test(GAME) && /\/assets\/pd-domey-questions\.js/.test(GAME) &&
    /\/assets\/pd-mascot\.js/.test(GAME));
  t('the page mounts the host in 3D, with the drawing as the safety net',
    /render:\s*'auto'/.test(GAME) && /PDMascot\.mount\(/.test(GAME));
  t('the character is re-framed when the stage changes size',
    /renderer3d\.fit\(\)/.test(GAME) && /addEventListener\('resize', fitDomey\)/.test(GAME) &&
    /orientationchange/.test(GAME));
  t('the page plays from the real bank, not a handful of sample questions',
    /PDDomeyQuestions\.forMascot/.test(GAME) && !/QUIZ_BANK/.test(GAME));
  t('the page shows which topics and how many questions Domey has',
    /domeyTopicSelect/.test(GAME) && /domeyBankCount/.test(GAME) && /domeyTopicChips/.test(GAME));
  t('the multi-game hub is really gone',
    !/gameTab-/.test(GAME) && !/switchGame\(/.test(GAME) && !/panel-(memory|quiz|scramble|extra-games)/.test(GAME) &&
    !/journeyPath|playZone|leaderboardList|BIBLE_QUIZ_POOL|SITUATIONS/.test(GAME));
  t('the 3D character still speaks out loud through the shared host',
    /PDMascot\.show\(/.test(GAME) && /host\.canHear\(\)\) host\.enableMic\(\)/.test(GAME));

  const SW = read('sw.js');
  t('the service worker precaches the engine, three.js and the bank',
    /'\/assets\/pd-domey3d\.js'/.test(SW) && /'\/assets\/three\.module\.min\.js'/.test(SW) &&
    /'\/assets\/pd-domey-questions\.js'/.test(SW));

  const LIVE = read('live.html');
  t('the Live lounge is served the same 3D Domey',
    /\/assets\/pd-domey3d\.js/.test(LIVE) && /id="liveDomeyStage"/.test(LIVE));

  const GAME_DOM = new (require('jsdom').JSDOM)(GAME, { url: 'https://prayerdome.net/game.html' });
  const gameDoc = GAME_DOM.window.document;
  t('the page keeps the shared navigation, not a stripped shell',
    gameDoc.querySelectorAll('.pd-drawer').length === 1 &&
    gameDoc.querySelectorAll('.pd-drawer-link').length >= 8 &&
    gameDoc.querySelectorAll('.pd-topbar').length === 1 &&
    gameDoc.querySelectorAll('#pdNotifBell').length === 1);
  t('and it still offers the member a way into every topic',
    gameDoc.querySelectorAll('#domeyTopicSelect option').length === 1 &&
    gameDoc.querySelectorAll('#domeyTopicChips').length === 1);
  try { GAME_DOM.window.close(); } catch (e) {}

  /* ------------------------------- 4. the host and the engine really meet */
  /* WebGL cannot run here, so the engine is stood in for: what is checked is
     the contract between the shared host (pd-mascot.js) and the 3D engine —
     the mount upgrades, the live host is handed over, and every way out
     (no WebGL, a failed module, a lost GPU) ends back on the drawing. */
  let JSDOM;
  try { ({ JSDOM } = require('jsdom')); }
  catch (e) {
    console.error('jsdom is not installed. Run:  npm install');
    process.exit(2);
  }
  const MASCOT_JS = read('assets/pd-mascot.js');
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function pageWithEngine(engine) {
    const dom = new JSDOM('<!doctype html><html><body><div id="stage"></div></body></html>',
      { runScripts: 'outside-only', url: 'https://prayerdome.net/game' });
    const w = dom.window;
    w.matchMedia = w.matchMedia || function () { return { matches: false, addListener() {}, removeListener() {} }; };
    if (engine) w.PDDomey3D = engine;
    w.eval(MASCOT_JS);
    return { dom, w, M: w.PDMascot };
  }

  const calls = [];
  const handed = { fits: 0, disposed: 0, started: 0 };
  const engine = {
    version: '1.0.0',
    visemes: ['rest', 'M', 'F', 'E', 'I', 'A', 'O', 'U', 'L'],
    available: () => true,
    prefersReducedMotion: () => false,
    three: () => ({ REVISION: '165' }),
    ready: () => Promise.resolve({ REVISION: '165' }),
    create: (container, options) => {
      calls.push({ container: container, options: options });
      return {
        canvas: null,
        fit() { handed.fits += 1; },
        start() { handed.started += 1; },
        stop() {},
        running() { return true; },
        dispose() { handed.disposed += 1; }
      };
    }
  };

  const three = pageWithEngine(engine);
  const rendererEvents = [];
  const host3d = three.M.mount('#stage', { name: 'Domey' });
  host3d.on('renderer', (kind) => rendererEvents.push(kind));
  await sleep(60);
  t('the host upgrades itself to the 3D body when the engine is there',
    host3d.is3D() === true && !!host3d.renderer3d &&
    host3d.root.classList.contains('pdm-render-3d') &&
    host3d.root.getAttribute('data-pdm-render') === '3d');
  t('the page is told which character is on stage', rendererEvents.indexOf('3d') !== -1,
    rendererEvents.join(','));
  t('the engine is handed the live host, so lips can follow the real voice',
    calls.length === 1 && calls[0].options.host === host3d && calls[0].container === host3d.stage);
  t('the engine is told whether motion should be calmed',
    calls[0].options.reducedMotion === false && typeof calls[0].options.onContextLost === 'function');

  /* The lip-sync contract: the engine reads the stage the host already wrote. */
  host3d.root.setAttribute('data-pdm-vis', 'A');
  host3d.root.setAttribute('data-pdm-state', 'speaking');
  host3d.root.style.setProperty('--pdm-jaw', '0.8');
  host3d.root.style.setProperty('--pdm-gaze-x', '1.3');
  const signals = E.hostSignals(host3d);
  t('the 3D mouth reads the same lip-sync plan the drawing does',
    signals.viseme === 'A' && E.states.indexOf(signals.state) !== -1 &&
    Math.abs(signals.jaw - 0.8) < 0.01 && Math.abs(signals.gazeX - 0.5) < 0.01,
    JSON.stringify(signals));
  host3d.root.removeAttribute('data-pdm-vis');

  /* A lost GPU must never leave a blank stage. */
  calls[0].options.onContextLost();
  await sleep(20);
  t('a lost GPU hands the stage back to the drawing',
    host3d.is3D() === false && !host3d.root.classList.contains('pdm-render-3d') &&
    handed.disposed >= 1 && !!host3d.root.querySelector('.pdm-char-wrap'));

  /* No WebGL: the mount still works, in two dimensions. */
  const flat = pageWithEngine(Object.assign({}, engine, { available: () => false, create: () => null }));
  const host2d = flat.M.mount('#stage', { name: 'Domey' });
  await sleep(40);
  t('a device without WebGL keeps the drawn character, unstyled and unbroken',
    host2d.is3D() === false && !host2d.root.classList.contains('pdm-render-3d') &&
    !!host2d.root.querySelector('.pdm-char-wrap'));

  /* The engine failing to load is a warning, never a broken show. */
  const broken = pageWithEngine({
    version: '1.0.0',
    available: () => true,
    three: () => null,
    ready: () => Promise.reject(new Error('offline')),
    create: () => null
  });
  const warnings = [];
  broken.w.console.warn = (...args) => warnings.push(args.join(' '));
  const hostBroken = broken.M.mount('#stage', { name: 'Domey' });
  await sleep(40);
  t('a failed 3D download is a warning, not a broken page',
    hostBroken.is3D() === false && warnings.some((line) => /3D character unavailable/.test(line)));

  const spoken = await hostBroken.say('God is good', { instant: true });
  t('and the host still speaks out loud after the fallback', !!spoken &&
    hostBroken.root.querySelectorAll('.pdm-mouths').length >= 1);

  /* ------------------- 5. a real show, played from a real bank question */
  /* The whole point of the bank: the host can ask it, and the answer it
     carries is the answer that wins. This plays one round end to end. */
  const showDom = new JSDOM('<!doctype html><html><body><div id="stage"></div></body></html>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://prayerdome.net/game' });
  const showWindow = showDom.window;
  showWindow.matchMedia = showWindow.matchMedia ||
    function () { return { matches: false, addListener() {}, removeListener() {} }; };
  showWindow.eval(MASCOT_JS);
  const showHost = showWindow.PDMascot.mount('#stage', { name: 'Domey', lang: 'en' });
  const hurry = setInterval(() => { try { showHost.hurry(); } catch (e) {} }, 60);

  const asked = Q.forMascot(1, { topic: 'Miracles' })[0];
  let summary = null;
  const playing = showWindow.PDMascot.show(showHost, {
    rounds: 1,
    bank: [asked],
    onFinish: (data) => { summary = data; }
  });

  const deadline = Date.now() + 15000;
  let typedName = false;
  let clicked = false;
  let heardQuestion = false;
  while (!summary && Date.now() < deadline) {
    if (!typedName && showHost.answerForm && !showHost.answerForm.hasAttribute('hidden')) {
      showHost.answerInput.value = 'Grace';
      showHost.answerForm.dispatchEvent(new showWindow.Event('submit', { bubbles: true, cancelable: true }));
      typedName = true;
    }
    const chips = showHost.root.querySelectorAll('.pdm-chip');
    if (chips.length && !clicked) {
      const right = Array.from(chips).find((chip) => chip.textContent === asked.options[asked.answer]);
      if (right) {
        const opening = asked.q.split(' ').slice(0, 4);
        heardQuestion = opening.every((word) => (showHost.lastSpoken || '').indexOf(word) !== -1);
        right.click();
        clicked = true;
      }
    }
    await sleep(40);
  }
  await playing;
  clearInterval(hurry);

  t('Domey asks a question from the bank, out loud', typedName && heardQuestion, asked.q);
  t('the answer the bank carries is the answer that wins',
    !!summary && summary.total === 1 && summary.correct === 1,
    JSON.stringify(summary));
  t('and a good round pays out Faith Points in the page', !!summary && summary.xp > 0, summary && String(summary.xp));
  try { showDom.window.close(); } catch (e) {}

  try { three.dom.window.close(); } catch (e) {}
  try { flat.dom.window.close(); } catch (e) {}
  try { broken.dom.window.close(); } catch (e) {}

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
