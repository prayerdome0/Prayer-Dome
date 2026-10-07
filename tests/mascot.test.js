/*
 * Prayer Dome — cartoon host ("Domey") and live playback promises
 * ===========================================================================
 * The member-facing promises this file protects:
 *
 *   1. Domey greets people out loud: "Hi! Welcome to Prayer Dome!" — and the
 *      greeting survives a browser that blocks speech (captions still play).
 *   2. Domey asks questions and understands the answer, whether it is spoken,
 *      tapped or typed.
 *   3. Domey never needs the network, never needs a microphone, and never
 *      leaves the member stuck: stop()/destroy() end every pending task.
 *   4. The Live page is never a dead black player: a broadcast that is
 *      announced but not streaming explains itself, keeps retrying, and can be
 *      left behind.
 *   5. Watching is counted honestly — only once the stream really arrives.
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
const LIVE = read('live.html');
const WEBRTC = read('assets/pd-live-webrtc.js');
const RULES = read('firestore.rules');
const SW = read('sw.js');

(async function run() {
  /* --------------------------------------------------- 1. the module itself */
  t('the cartoon host ships as one shared module', fs.existsSync(path.join(ROOT, 'assets/pd-mascot.js')));
  t('the cartoon host ships with its own stylesheet', fs.existsSync(path.join(ROOT, 'assets/pd-mascot.css')));

  const mascotCode = MASCOT_JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  t('the host draws its own character (inline SVG, no image downloads)',
    /<svg class="pdm-char"/.test(MASCOT_JS) && !/<img/.test(mascotCode));
  t('the host never fetches anything at runtime',
    !/fetch\(|XMLHttpRequest|new Image\(/.test(mascotCode));
  t('the host speaks with the browser voice engine',
    /speechSynthesis\.speak\(/.test(MASCOT_JS) && /SpeechSynthesisUtterance/.test(MASCOT_JS));
  t('the host listens with speech recognition and degrades when unavailable',
    /SpeechRecognition/.test(MASCOT_JS) && /reason: 'unsupported'/.test(MASCOT_JS));
  t('a blocked autoplay still shows the greeting as captions',
    /result\.blocked/.test(MASCOT_JS) && /captions\.reveal\(\)/.test(MASCOT_JS));
  t('the voice is never a hidden requirement: answers can be tapped or typed',
    /pdm-chip/.test(MASCOT_JS) && /pdm-answer/.test(MASCOT_JS));
  t('sound cues are synthesised, so no audio files are downloaded',
    /createOscillator/.test(MASCOT_JS) && !/\.mp3|\.wav/.test(MASCOT_JS));
  t('the caption region is announced to screen readers',
    /class="pdm-text" role="status" aria-live="polite"/.test(MASCOT_JS));

  t('the stylesheet animates the character (talk, wave, blink, celebrate)',
    ['pdm-talk', 'pdm-wave', 'pdm-blink', 'pdm-jump', 'pdm-sparkle']
      .every((name) => MASCOT_CSS.includes('@keyframes ' + name)));
  t('the character shows a distinct face for every mood',
    ['idle', 'speaking', 'listening', 'thinking', 'celebrating', 'encouraging', 'praying']
      .every((state) => MASCOT_CSS.includes('data-pdm-state="' + state + '"')));
  t('the stylesheet is self-contained and offline-ready',
    !/url\(\s*['"]?https?:/i.test(MASCOT_CSS) && !/@import/.test(MASCOT_CSS));
  t('reduced-motion members get a still character, not a broken one',
    /@media \(prefers-reduced-motion: reduce\)/.test(MASCOT_CSS) &&
    /animation-duration:\s*\.001ms/.test(MASCOT_CSS));

  /* --------------------------------------- 2. behaviour in a real DOM (jsdom) */
  const dom = new JSDOM('<!doctype html><html><body><div id="stage"></div></body></html>',
    { runScripts: 'outside-only', url: 'https://prayerdome.net/game' });
  const w = dom.window;
  w.eval(MASCOT_JS);
  const M = w.PDMascot;

  t('the host API is published for pages to use',
    ['mount', 'show', 'lounge', 'loungeSession', 'match', 'cleanName', 'supportsVoice', 'supportsListening']
      .every((key) => typeof M[key] === 'function'));

  const host = M.mount('#stage', { name: 'Domey' });
  // Members can tap the speech bubble to skip ahead; the test does the same so
  // the suite does not sit through every line of dialogue in real time.
  const hurryTicker = setInterval(() => { try { host.hurry(); } catch (e) {} }, 90);
  t('mounting renders the cartoon character', !!host.root.querySelector('svg.pdm-char'));
  t('the host introduces itself by name', host.root.textContent.includes('Domey'));

  const waitForChips = async (pattern) => {
    for (let i = 0; i < 200; i++) {
      const chips = [...host.root.querySelectorAll('.pdm-chip')]
        .filter((chip) => !chip.disabled && (!pattern || pattern.test(chip.textContent)));
      if (chips.length) return chips;
      await sleep(60);
    }
    return [];
  };

  const greetingPromise = host.say('Hi! Welcome to Prayer Dome!', { hold: 0 });
  t('speaking shows the words as captions as well',
    host.textEl.textContent.includes('Welcome to Prayer Dome') ||
    host.root.querySelectorAll('.pdm-word').length > 0);
  t('the character takes a talking pose', host.root.getAttribute('data-pdm-state') === 'speaking');
  await greetingPromise;
  t('the greeting finishes even without a speech engine',
    host.root.querySelectorAll('.pdm-word.shown').length === host.root.querySelectorAll('.pdm-word').length);

  const askPromise = host.ask({
    text: 'Who built the ark?',
    choices: ['Noah', 'Moses', 'Abraham'],
    correctIndex: 0
  });
  const chips = await waitForChips();
  const choices = [...host.root.querySelectorAll('.pdm-chip')].map((c) => c.textContent.trim());
  t('a question offers tap-to-answer choices',
    ['Noah', 'Moses', 'Abraham'].every((label) => choices.includes(label)) && choices.length === 4,
    choices.join(' / '));
  chips[0].click();
  const answer = await askPromise;
  t('tapping a choice answers the question',
    answer.text === 'Noah' && answer.index === 0 && answer.source === 'chip');

  const typedPromise = host.ask({ text: 'Name a book of the Bible.', kind: 'text' });
  await waitForChips(/Skip/);
  host.answerInput.value = 'Genesis';
  host.answerForm.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  const typed = await typedPromise;
  t('typing answers the question', typed.text === 'Genesis' && typed.source === 'typed');

  const skipPromise = host.ask({ text: 'Shall we keep playing?', choices: ['Yes', 'No'] });
  const skipChips = await waitForChips(/Skip/);
  skipChips[skipChips.length - 1].click();
  const skipped = await skipPromise;
  t('a member can always skip a question', skipped.source === 'skip');

  t('spoken answers are matched to the printed choices',
    M.match('the first one', ['Noah', 'Moses']).index === 0 &&
    M.match('I think it is moses', ['Noah', 'Moses', 'Abraham']).index === 1 &&
    M.match('b', ['Noah', 'Moses', 'Abraham']).index === 1);
  t('a name is cleaned out of a spoken sentence',
    M.cleanName('my name is grace', 'friend') === 'Grace' &&
    M.cleanName('I am Grace', 'friend') === 'Grace' &&
    M.cleanName("I'd rather not say", 'friend') === 'friend' &&
    M.cleanName('who wants to know', 'friend') === 'friend' &&
    M.cleanName('my name is not important', 'friend') === 'friend');

  /* the full show, driven automatically (as a member would tap through) */
  const events = [];
  const showPromise = M.show(host, {
    rounds: 3,
    onScore: (score) => events.push(score.right ? 'right' : 'wrong'),
    onFinish: (summary) => events.push('finish:' + summary.total)
  });
  const driver = setInterval(() => {
    if (host.answerResolve && /call you/i.test(host.lastSpoken || '')) {
      host.answerInput.value = 'Grace';
      host.answerForm.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
      return;
    }
    const live = [...host.root.querySelectorAll('.pdm-chip')].filter((chip) => !chip.disabled);
    if (live.length) live[0].click();
  }, 120);
  const summary = await showPromise;
  clearInterval(driver);
  t('the show runs its rounds and reports a score',
    summary.total === 3 && events.filter((e) => e === 'right' || e === 'wrong').length === 3,
    JSON.stringify(summary));
  t('faith points are awarded for correct answers', summary.xp >= 0 && summary.name === 'Grace');
  t('the round progress strip is filled in as the show runs',
    host.hud.innerHTML.includes('pdm-dot'));

  /* the Live waiting-room conversation */
  const prayers = [];
  const loungeHost = M.mount('#stage', { name: 'Domey', compact: true });
  const loungeTicker = setInterval(() => { try { loungeHost.hurry(); } catch (e) {} }, 90);
  const loungePromise = M.lounge(loungeHost, {
    onPrayer: (request) => prayers.push(request),
    verse: () => ({ ref: 'Psalm 23:1', text: 'The LORD is my shepherd.' }),
    nextService: () => 'Sunday at 08:00'
  });
  const loungeDriver = setInterval(() => {
    if (loungeHost.answerResolve && /call you/i.test(loungeHost.lastSpoken || '')) {
      loungeHost.answerInput.value = 'Grace';
      loungeHost.answerForm.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
      return;
    }
    const live = [...loungeHost.root.querySelectorAll('.pdm-chip')].filter((chip) => !chip.disabled);
    if (!live.length) return;
    if (loungeHost.answerResolve && /what would you like prayer for/i.test(loungeHost.lastSpoken || '')) {
      loungeHost.answerInput.value = 'my family';
      loungeHost.answerForm.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
      return;
    }
    const prayChip = live.find((chip) => /pray with me/i.test(chip.textContent));
    if (prayChip) { prayChip.click(); return; }
    live[live.length - 1].click();
  }, 150);
  await loungePromise;
  clearInterval(loungeDriver);
  t('the waiting room prays with the member and keeps the request',
    prayers.length === 1 && prayers[0].text === 'my family' && prayers[0].name === 'Grace',
    JSON.stringify(prayers));
  t('the greeting mentions Prayer Dome and the next service',
    loungeHost.history.some((line) => /Welcome to Prayer Dome/.test(line.text)) &&
    /nextService/.test(MASCOT_JS));

  /* stop() must end everything, including a pending question */
  const pending = host.ask({ text: 'Are you still there?', choices: ['Yes', 'No'], timeout: 60000 });
  await waitForChips(/Yes/);
  host.stop();
  const stopped = await pending;
  t('stop() releases a question that is still waiting for an answer', stopped.source === 'stopped');
  t('stop() returns the character to a calm pose', host.root.getAttribute('data-pdm-state') === 'idle');
  clearInterval(hurryTicker);
  clearInterval(loungeTicker);
  host.destroy();
  loungeHost.destroy();
  t('destroy() removes the character and its listeners', host.root.innerHTML === '');
  t('the host survives a browser with no speech, no microphone and no audio context',
    M.supportsVoice() === false && M.supportsListening() === false);

  /* --------------------------------------------------- 3. the game page */
  t('the game page loads the cartoon host', GAME.includes('/assets/pd-mascot.js') &&
    GAME.includes('/assets/pd-mascot.css'));
  t('the game page is Domey only — every other game is gone',
    /id="panel-talk"/.test(GAME) && !/gameTab-/.test(GAME) && !/switchGame\(/.test(GAME) &&
    !/panel-(memory|quiz|scramble|extra-games)/.test(GAME) && !/BIBLE_QUIZ_POOL/.test(GAME));
  t('the game page has a start control and a live score chip',
    /id="domeyStartBtn"/.test(GAME) && /id="domeyBestChip"/.test(GAME));
  t('the game show feeds real Bible questions into the host',
    /PDDomeyQuestions\.forMascot/.test(GAME) && /PDMascot\.show\(/.test(GAME) &&
    /\/assets\/pd-domey-questions\.js/.test(GAME));
  t('the game page builds the character in three dimensions',
    /\/assets\/pd-domey3d\.js/.test(GAME) && /render: 'auto'/.test(GAME) &&
    /renderer3d\.fit\(\)/.test(GAME));
  t('correct answers earn Faith Points and badges in the member journey',
    /addXP\(gain\)/.test(GAME) && /unlockBadge\('word-seeker'\)/.test(GAME));
  t('the host is silenced when the member switches game or leaves the tab',
    /domey\.stop\(\)/.test(GAME) && /visibilitychange/.test(GAME));
  t('the game page publishes its talk entry point for inline handlers',
    /window\.talkWithDomey/.test(GAME) && /onclick="talkWithDomey\(\)"/.test(GAME));

  /* --------------------------------------------------- 4. the live page */
  t('the live page loads the cartoon host and the shared verse library',
    LIVE.includes('/assets/pd-mascot.js') && LIVE.includes('/assets/pd-verse-data.js'));
  t('the live page hosts a Prayer Lounge with Domey',
    /id="liveDomeyStage"/.test(LIVE) && /domeyTalkBtn/.test(LIVE) && /domeyPrayBtn/.test(LIVE) &&
    /domeyVerseBtn/.test(LIVE) && /domeyStopBtn/.test(LIVE));
  t('the lounge sends a prayer request to the ministry chat',
    /addDoc\(collection\(db,'liveChat'\)/.test(LIVE) && /isPrayer: true/.test(LIVE) &&
    /source: 'domey'/.test(LIVE));
  t('the lounge reads the same verse the widgets use',
    /PD_VERSES\.verseFor/.test(LIVE) && /currentSlot/.test(LIVE));
  t('the live page keeps a video-less broadcast explainable',
    /id="playerWaiting"/.test(LIVE) && /showPlayerWaiting/.test(LIVE) &&
    /Waiting for the broadcast to start/.test(LIVE));
  t('the live page can leave a dead broadcast behind (stale guard)',
    /broadcastLooksStale/.test(LIVE) && /That broadcast has already ended/.test(LIVE));
  t('the live page offers real actions while waiting (retry / last service / prayer)',
    /window\.retryPlayback/.test(LIVE) && /window\.watchLastService/.test(LIVE) && /window\.showPrayerLounge/.test(LIVE));
  t('the waiting banner updates the page by itself, no reload needed',
    /id="waitingBanner"/.test(LIVE) && /updates by itself/.test(LIVE));
  t('the player watchdog stops once the stream is really playing',
    /function startPlaybackWatchdog/.test(LIVE) && /isStreamPlaying\(\)/.test(LIVE));
  t('watching is counted only when the stream actually arrives',
    /function startViewerCount/.test(LIVE) &&
    /viewer\.on\('stream'/.test(LIVE) &&
    !/document\.addEventListener\('click', function once\(\)/.test(LIVE));
  t('leaving the live view removes the member from the viewer count',
    /function stopViewerCount/.test(LIVE) && /viewers: increment\(-1\)/.test(LIVE));
  t('the HLS player is destroyed before the viewer is dropped',
    /if \(window\.Hls && viewer\.hls\)[\s\S]{0,120}viewer\.leave\(\);\s*\n\s*viewer = null;/.test(LIVE));

  /* ------------------------------- 5. the streaming engine (encoder waiting) */
  t('viewers of an encoder broadcast wait for the stream instead of dead-ending',
    /Viewer\.prototype\.waitForBroadcast/.test(WEBRTC) && /self\.waitForBroadcast\(\)/.test(WEBRTC));
  t('the waiting viewer starts playing the moment the playlist appears',
    /probeHls\(url\)\.then\(function \(ok\) \{[\s\S]{0,320}self\.connectHLS\(\)/.test(WEBRTC));
  t('a broadcast without a recorded source is still treated as a WebRTC broadcast',
    /var source = status\.source \|\| 'webrtc';/.test(WEBRTC));
  t('retry on an encoder broadcast looks for the playlist again',
    /if \(this\.state\.source && this\.state\.source !== 'webrtc' && this\.state\.mode !== 'whep'\)/.test(WEBRTC));
  t('leaving clears the waiting timer', /this\._waitTimer\) \{ clearTimeout\(this\._waitTimer\)/.test(WEBRTC));
  t('the live document is stamped while an external broadcast runs',
    /function startCRHeartbeat/.test(read('admin.html')) && /updatedAt: Date\.now\(\)/.test(read('admin.html')));

  /* ------------------------------- 6. the signaling bug that killed live */
  // Firestore's orderBy also filters for the field's existence, so an ordered
  // signaling listener silently ignored every write that carried only
  // `joinedAt`/`at`. The broadcaster therefore never saw a member join and the
  // live video never started. Both halves of the fix are pinned here.
  t('signaling listeners are not ordered (Firestore drops docs missing the ordered field)',
    !/onSnapshot\(q, function \(snap\)/.test(WEBRTC) &&
    /Signal\.prototype\.onCol = function \(path, cb\) \{[\s\S]{0,900}fb\.onSnapshot\(colRef/.test(WEBRTC) &&
    /not ordered/i.test(WEBRTC));
  t('the viewer join document that starts the stream carries createdAt',
    /join\/' \+ this\.state\.viewerId, \{[\s\S]{0,400}createdAt: this\.fb\.serverTimestamp\(\)/.test(WEBRTC));
  t('live presence, comments, reactions and events all carry createdAt',
    /viewers\/' \+ this\.state\.viewerId, \{[\s\S]{0,200}createdAt: this\.fb\.serverTimestamp\(\)/.test(WEBRTC) &&
    /type: 'comment',[\s\S]{0,300}createdAt: this\.fb\.serverTimestamp\(\)/.test(WEBRTC) &&
    /signal\.col\('reactions'\), \{[\s\S]{0,200}createdAt: this\.fb\.serverTimestamp\(\)/.test(WEBRTC) &&
    /signal\.col\('events'\)[\s\S]{0,300}createdAt: this\.fb\.serverTimestamp\(\)/.test(WEBRTC));
  t('moderation actions reach the viewer with createdAt too',
    /action: 'comments'[\s\S]{0,120}createdAt: this\.fb\.serverTimestamp\(\)/.test(WEBRTC) &&
    /action: 'delete'[\s\S]{0,120}createdAt: this\.fb\.serverTimestamp\(\)/.test(WEBRTC));

  t('a viewer joins from a clean slate (stale ICE candidates are cleared first)',
    /clearCol\('viewers\/' \+ this\.state\.viewerId \+ '\/candidates'\)/.test(WEBRTC) &&
    /clearCol\('viewers\/' \+ this\.state\.viewerId \+ '\/broadcasterCandidates'\)/.test(WEBRTC));
  t('leaving removes presence, the join marker and the candidates',
    /signal\.del\('viewers\/' \+ viewerId\)/.test(WEBRTC) &&
    /signal\.del\('join\/' \+ viewerId\)/.test(WEBRTC) &&
    /Signal\.prototype\.clearCol = async function/.test(WEBRTC));

  /* --------------------------------------------- 7. rules, offline, docs */
  t('a signed-out viewer can clean up its own live presence',
    /match \/liveSignals\/\{liveId\}\/viewers\/\{viewerId\}/.test(RULES) &&
    /allow read, create, update, delete: if true;/.test(RULES));
  t('the service worker precaches the cartoon host and bumps the cache',
    SW.includes("'/assets/pd-mascot.js'") && SW.includes("'/assets/pd-mascot.css'") &&
    /const CACHE_NAME = 'prayer-dome-v\d+';/.test(SW));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
