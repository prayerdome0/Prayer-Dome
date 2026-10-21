'use strict';

/*
 * Prayer Dome — Domey's realistic character (assets/pd-domey-human.js)
 * ==========================================================================
 * The application upgrades Domey from the coded hostess to a licensed, rigged
 * VRM human on devices that can afford the download. These checks protect the
 * promises that upgrade makes:
 *
 *   1. the model is a real VRM 1.0 file whose metadata permits commercial use,
 *      modification and redistribution, and its licence files ship with it;
 *   2. it is vendored (no CDN, no key) and only loaded on capable devices;
 *   3. the rig actually animates — breathing, blinking, lip-sync, a wave that
 *      lifts the hand and returns it, a gentle mood for a wrong answer;
 *   4. the host mounts it as a progressive upgrade in the same scene, keeps
 *      the coded character when anything fails, and frees the GPU on leaving;
 *   5. the member can pause, resume, mute and repeat her speech.
 *
 * The rig is exercised against a synthetic VRM whose bone hierarchy mirrors the
 * real one, so the maths (not a screenshot) is what is verified here.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
let pass = 0;
let fail = 0;
function t(name, condition, detail = '') {
  if (condition) pass += 1;
  else fail += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ------------------------------------------------ 1. the shipped model */

const vrmPath = path.join(ROOT, 'assets', 'domey', 'human', 'VRM1_Constraint_Twist_Sample.vrm');
const vrm = fs.readFileSync(vrmPath);
t('the model is a binary glTF (GLB) file', vrm.readUInt32LE(0) === 0x46546c67);
const jsonLength = vrm.readUInt32LE(12);
const gltf = JSON.parse(vrm.slice(20, 20 + jsonLength).toString('utf8'));
const meta = gltf.extensions && gltf.extensions.VRMC_vrm && gltf.extensions.VRMC_vrm.meta;
t('the model declares VRM 1.0 metadata', !!meta && !!gltf.extensions.VRMC_vrm.specVersion);
t('the model metadata allows redistribution and modification',
  meta && meta.allowRedistribution === true && /allowModification/.test(meta.modification || ''),
  JSON.stringify(meta && meta.modification));
t('the model metadata allows corporate use and needs no credit line',
  meta && meta.commercialUsage === 'corporation' && meta.creditNotation === 'unnecessary');
const expressions = Object.keys((gltf.extensions.VRMC_vrm.expressions || {}).preset || {});
t('the model has blink and all five mouth shapes (aa, ih, ou, ee, oh)',
  ['blink', 'aa', 'ih', 'ou', 'ee', 'oh'].every((n) => expressions.includes(n)));
t('the model has the moods the game uses (happy, sad, relaxed, surprised)',
  ['happy', 'sad', 'relaxed', 'surprised'].every((n) => expressions.includes(n)));
t('the model has a humanoid skeleton with head, neck, chest and arms',
  ['head', 'neck', 'chest', 'leftUpperArm', 'rightUpperArm', 'hips'].every((b) =>
    gltf.extensions.VRMC_vrm.humanoid && gltf.extensions.VRMC_vrm.humanoid.humanBones[b]));
t('the model has elbows, wrists and fingers for real gestures',
  ['leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand', 'leftIndexProximal'].every((b) =>
    gltf.extensions.VRMC_vrm.humanoid.humanBones[b]));

const modelLicence = read('assets/domey/human/LICENSE.txt');
t('the model licence file names pixiv, the VRM Public License 1.0 and the cost',
  /pixiv Inc/.test(modelLicence) && /VRM Public License 1\.0/.test(modelLicence) && /Cost: free/.test(modelLicence));
const vendorLicence = read('assets/vendor/three-vrm/LICENSE.txt');
t('the vendored three-vrm bundle ships its MIT licence and sources',
  /MIT License/.test(vendorLicence) && /pixiv\/three-vrm/.test(vendorLicence) && /three\.js r165/.test(vendorLicence));

const bundle = read('assets/vendor/three-vrm/three-vrm.bundle.js');
t('the bundle exports the GLTF loader and the VRM plugins',
  /GLTFLoader/.test(bundle) && /VRMLoaderPlugin/.test(bundle) && /VRMUtils|VRMCore/.test(bundle));
t('the bundle imports only the bare "three" name (mapped to the vendored build)',
  (bundle.match(/from\s*"[^"]+"/g) || []).every((m) => /"three"|"srgb-linear"/.test(m)));

/* ------------------------------------------------------ 2. the page wiring */

const game = read('game.html');
const importMapAt = game.indexOf('"importmap"');
const threeAt = game.indexOf('/assets/three.module.min.js" type="module"');
t('the game page maps "three" with an import map before any module script',
  importMapAt > -1 && importMapAt < threeAt && /"three":"\/assets\/three\.module\.min\.js"/.test(game));
t('the game page loads the hostess, the realistic rig and the host',
  /pd-domey-lady\.js/.test(game) && /pd-domey-human\.js/.test(game) && /pd-mascot\.js/.test(game));
t('the retired photogrammetry head is not shipped to the page', !/pd-domey-scan\.js/.test(game));
t('the game page credits the model and its licence', /VRM Public License 1\.0/.test(game));

const human = read('assets/pd-domey-human.js');
t('the human module loads the bundle and model from this site only',
  /\/assets\/vendor\/three-vrm\/three-vrm\.bundle\.js/.test(human) &&
  /\/assets\/domey\/human\/VRM1_Constraint_Twist_Sample\.vrm/.test(human) &&
  !/https?:\/\//.test(human));
t('the human rig implements the host contract (update, setViseme, look, act, dispose)',
  ['update', 'setViseme', 'look', 'act', 'dispose', 'setState'].every((m) => new RegExp(`rig\\.${m} = |${m}: function`).test(human)));
t('a load timeout is set so the character never sits on a permanent loader', /LOAD_TIMEOUT_MS = 30000/.test(human));

const mascot = read('assets/pd-mascot.js');
t('the mascot builds the hostess first, then upgrades to the realistic rig',
  /global\.PDDomeyLady/.test(mascot) && /lady\.buildRig\(THREE/.test(mascot) &&
  /_upgradeToRealistic/.test(mascot) && /human\.load\(THREE\)/.test(mascot));
t('the upgrade swaps the rig in the same scene instead of adding a canvas',
  /swapRig\(rig, human\.FIT/.test(mascot) && /swapRig: function/.test(read('assets/pd-domey3d.js')));
t('the coded hostess is the documented fallback at every failure point',
  /the realistic character is unavailable, keeping the coded hostess/.test(mascot) &&
  /the hostess could not be built, using the cartoon rig/.test(mascot));
t('the hostess is framed head to feet with her own fit, not the cartoon defaults',
  /fit: \{ height: 2\.8, width: 1\.72, y: 0\.55 \}/.test(mascot) && /rig\.root\.position\.y -= 0\.09/.test(mascot));
t('the realistic model is framed for its own height', /var FIT = \{ height: 1\.86, width: 1\.05, y: 0\.93 \}/.test(human));
t('a pending download is cancelled when the member leaves',
  /cancelIdleCallback/.test(mascot) && /this\._humanTimer/.test(mascot));

/* ------------------------------------------------- 3. speech controls exist */
t('the voice engine can pause and resume an utterance',
  /Voice\.prototype\.pause = function/.test(mascot) && /Voice\.prototype\.resume = function/.test(mascot));
t('the host exposes pause, resume and togglePause',
  /Host\.prototype\.pause = function/.test(mascot) && /Host\.prototype\.resume = function/.test(mascot) &&
  /Host\.prototype\.togglePause = function/.test(mascot));
t('the mouth and captions hold still while speech is paused',
  /if \(this\.paused\) \{/.test(mascot) && /if \(self\._paused\) return;/.test(mascot));
t('the control bar offers voice, microphone, repeat and pause',
  /this\.voiceBtn/.test(mascot) && /this\.micBtn/.test(mascot) &&
  /this\.repeatBtn/.test(mascot) && /this\.pauseBtn/.test(mascot));

/* ------------------------------------------------ 4. the rig really animates */

(async () => {
  const THREE = await import('file://' + path.join(ROOT, 'assets/three.module.min.js'));

  /** A synthetic VRM with the same normalised-bone contract as three-vrm. */
  function makeAsset() {
    const scene = new THREE.Group();
    const nodes = {};
    const make = (name, parent, x, y, z) => {
      const node = new THREE.Object3D();
      node.name = name;
      node.position.set(x, y, z);
      (parent || scene).add(node);
      nodes[name] = node;
      return node;
    };
    const hips = make('hips', null, 0, 0.82, 0);
    const spine = make('spine', hips, 0, 0.12, 0);
    const chest = make('chest', spine, 0, 0.16, 0);
    const upperChest = make('upperChest', chest, 0, 0.12, 0);
    const neck = make('neck', upperChest, 0, 0.10, 0);
    const head = make('head', neck, 0, 0.09, 0);
    const lSh = make('leftShoulder', upperChest, 0.04, 0.04, 0);
    const rSh = make('rightShoulder', upperChest, -0.04, 0.04, 0);
    const lUp = make('leftUpperArm', lSh, 0.14, 0, 0);
    const rUp = make('rightUpperArm', rSh, -0.14, 0, 0);
    const lLow = make('leftLowerArm', lUp, 0.26, 0, 0);
    const rLow = make('rightLowerArm', rUp, -0.26, 0, 0);
    make('leftHand', lLow, 0.24, 0, 0);
    make('rightHand', rLow, -0.24, 0, 0);
    make('leftUpperLeg', hips, 0.09, -0.05, 0);
    make('rightUpperLeg', hips, -0.09, -0.05, 0);

    const preset = {};
    ['blink', 'blinkLeft', 'blinkRight', 'happy', 'sad', 'relaxed', 'surprised', 'angry',
      'aa', 'ih', 'ou', 'ee', 'oh'].forEach((name) => { preset[name] = { value: 0 }; });
    const expressionManager = {
      values: {},
      getExpression: (name) => preset[name] || null,
      setValue: (name, value) => { expressionManager.values[name] = value; }
    };
    return {
      values: expressionManager.values,
      asset: {
        THREE,
        vrm: {
          scene,
          humanoid: { getNormalizedBoneNode: (name) => nodes[name] || null },
          expressionManager,
          lookAt: { target: null, autoUpdate: false },
          update() {}
        }
      },
      nodes
    };
  }

  const sandbox = { window: {}, console, Promise, setTimeout, clearTimeout, setInterval, clearInterval };
  require('node:vm').runInNewContext(human, sandbox);
  const PDDomeyHuman = sandbox.window.PDDomeyHuman;

  const rig = PDDomeyHuman.buildRig(THREE, { asset: makeAsset().asset });
  t('buildRig returns the host contract', ['update', 'setViseme', 'look', 'act', 'dispose', 'setState']
    .every((fn) => typeof rig[fn] === 'function'));
  t('the camera framing keeps a whole body in view',
    PDDomeyHuman.FIT.height > 1.6 && PDDomeyHuman.FIT.height < 2.2 && PDDomeyHuman.FIT.width > 0.6);

  const step = (frames, signals, dt = 1 / 60) => {
    for (let i = 0; i < frames; i += 1) rig.update(dt, signals || {});
  };

  /* The model is authored in a T-pose: after building, the arms must hang down
   * (a rotation of roughly a quarter turn from the T-pose), not stick out. */
  const restQuat = new THREE.Quaternion().fromArray(rig.snapshot().bone('rightUpperArm'));
  t('the arms rest at the sides, not in a T-pose',
    Math.abs(restQuat.x) + Math.abs(restQuat.y) + Math.abs(restQuat.z) > 0.2,
    restQuat.toArray().map((n) => n.toFixed(2)).join(','));

  /* Lip-sync: an open "A" opens the mouth; a closed "M" closes it again. */
  rig.setViseme('A', 1);
  step(20);
  const values = rig.vrm.expressionManager.values;
  t('the mouth opens on an "A" viseme', values.aa > 0.6, String(values.aa && values.aa.toFixed(2)));
  rig.setViseme('M', 0);
  step(30);
  t('the mouth closes between words', values.aa < 0.1, String(values.aa && values.aa.toFixed(2)));

  /* Moods: a wrong answer gets a gentle, sad expression, never a celebration. */
  rig.setState('encouraging');
  step(30);
  t('an incorrect answer shows a gentle, understanding face',
    values.sad > 0.1 && values.happy < 0.05,
    `sad ${values.sad.toFixed(2)} happy ${values.happy.toFixed(2)}`);
  rig.setState('celebrating');
  step(40);
  t('a correct answer smiles', values.happy > 0.4 && values.sad < 0.1,
    `happy ${values.happy.toFixed(2)}`);

  /* Blinking: within six seconds she must have blinked, and opened again. */
  rig.setState('idle');
  let closed = false;
  let reopened = false;
  for (let i = 0; i < 60 * 6; i += 1) {
    rig.update(1 / 60, {});
    if (values.blink > 0.6) closed = true;
    if (closed && values.blink < 0.05) { reopened = true; break; }
  }
  t('the eyes blink on their own and open again', closed && reopened);

  /* Gestures: a wave must lift the hand well above its resting height, and the
   * arm must come back down when the gesture ends. */
  function handHeight() {
    let found = null;
    rig.root.traverse((child) => { if (child.name === 'rightHand') found = child; });
    if (!found) return null;
    rig.root.updateMatrixWorld(true);
    return found.getWorldPosition(new THREE.Vector3()).y;
  }
  step(30);
  const lowered = handHeight();
  rig.act('wave', 1600);
  step(45);
  const raised = handHeight();
  t('a wave lifts the hand above its resting height',
    lowered != null && raised != null && raised > lowered + 0.15,
    `${lowered && lowered.toFixed(2)} → ${raised && raised.toFixed(2)}`);
  step(150);                       // hold + release + settle
  const settled = handHeight();
  t('the arm returns to a natural idle posture after the gesture',
    Math.abs(settled - lowered) < 0.06, `${settled && settled.toFixed(2)} vs ${lowered && lowered.toFixed(2)}`);
  rig.act('clap', 800);
  const playing = rig.snapshot().gesture;
  step(80);
  t('the gesture is reported while it plays and cleared afterwards',
    playing === 'clap' && rig.snapshot().gesture === null);

  /* Every gesture the host can ask for is implemented and moves a bone. */
  const gestureNames = Object.keys(PDDomeyHuman.GESTURES || {});
  t('the rig knows every gesture the host plays', gestureNames.length >= 14, String(gestureNames.length));
  const hostActions = ['wave', 'point', 'open', 'offer', 'count', 'thumb', 'raise', 'shrug',
    'clap', 'heart', 'think', 'dance', 'jump', 'mic', 'star', 'cheer', 'sparkle', 'hand'];
  t('every action name the mascot publishes resolves to a pose',
    hostActions.every((name) => {
      rig.act(name, 800);
      return rig.snapshot().gesture !== null;
    }), hostActions.join(' '));

  /* The host sets data-pdm-act and then clears it. The same gesture must be
   * playable again the next time it is asked for. */
  rig.update(1 / 60, { act: 'wave' });
  const firstWave = rig.snapshot().gesture;
  step(90);
  rig.update(1 / 60, { act: null || undefined });
  rig.update(1 / 60, { act: 'wave' });
  t('the same gesture can be replayed after the host clears it',
    firstWave === 'wave' && rig.snapshot().gesture === 'wave');

  /* Reduced motion: smaller movement, same character. */
  const calmRig = PDDomeyHuman.buildRig(THREE, { asset: makeAsset().asset, reducedMotion: true });
  const activeRig = PDDomeyHuman.buildRig(THREE, { asset: makeAsset().asset, reducedMotion: false });
  const headYawRange = (r) => {
    let lo = 9; let hi = -9;
    for (let i = 0; i < 120; i += 1) {
      r.update(1 / 60, { gazeX: 1, gazeY: 0.4 });
      const q = new THREE.Quaternion().fromArray(r.snapshot().bone('head'));
      const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
      lo = Math.min(lo, e.y); hi = Math.max(hi, e.y);
    }
    return hi - lo;
  };
  t('prefers-reduced-motion calms the head movement',
    headYawRange(calmRig) < headYawRange(activeRig),
    `${headYawRange(calmRig).toFixed(3)} < ${headYawRange(activeRig).toFixed(3)}`);

  t('dispose detaches the character and its scene', (() => {
    const holder = new THREE.Scene();
    holder.add(rig.root);
    rig.dispose();
    return holder.children.indexOf(rig.root) === -1;
  })());

  /* ---------------------------------------------- 5. capability gating */
  t('low-end devices and metered connections keep the coded character',
    /saveData === true/.test(human) && /slow-2g\|2g\|3g/.test(human) && /function wanted\(\)/.test(human));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})();
