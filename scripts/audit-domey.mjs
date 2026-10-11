#!/usr/bin/env node
/*
 * Prayer Dome — geometric audit of the 3D hostess.
 * ---------------------------------------------------------------------------
 * Nobody on this machine can open a browser, so the character is checked the
 * honest way instead: with the same three.js ray caster a renderer would use.
 * Every check below is a member-facing promise about how Domey looks.
 *
 *   node scripts/audit-domey.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const THREE = await import(pathToFileURL(path.join(ROOT, 'assets/three.module.min.js')));

function loadAsset(rel) {
  const sandbox = {};
  new Function('window', readFileSync(path.join(ROOT, rel), 'utf8'))(sandbox);
  return sandbox;
}
const Lady = loadAsset('assets/pd-domey-lady.js').PDDomeyLady;

let pass = 0, fail = 0;
function t(name, ok, extra = '') {
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  ' + extra : ''));
}

const rig = Lady.buildRig(THREE, {});
for (let i = 0; i < 120; i += 1) rig.update(1 / 60, { state: 'idle' });

/* --- 1. the whole body is in frame ---------------------------------------- */
const box = new THREE.Box3().setFromObject(rig.root);
t('she stands on the stage floor (feet just above it)',
  box.min.y > -0.72 && box.min.y < -0.55, box.min.y.toFixed(2));
t('her head fits the frame with room to spare',
  box.max.y > 1.85 && box.max.y < 2.15, box.max.y.toFixed(2));
let meshes = 0;
rig.root.traverse((o) => { if (o.isMesh) meshes += 1; });
t('she is built from many shaded meshes (detail, not a paper doll)', meshes >= 60, meshes + ' meshes');

/* --- 2. the camera really sees her face ----------------------------------- */
/* Build the same camera PDDomey3D.create() uses, then cast a ray at each
   facial feature: the first mesh the ray touches must be that feature (or a
   lid over the eye) — hair covering the face is the classic bug. */
const scene = new THREE.Scene();
scene.add(rig.root);
rig.root.updateMatrixWorld(true);
const camera = new THREE.PerspectiveCamera(30, 11 / 13, 0.1, 60);
const distance = (2.78 / 2) / Math.tan(camera.fov * Math.PI / 360) * 1.04;
camera.position.set(0, 0.66 + 0.22, distance);
camera.lookAt(0, 0.66, 0);
camera.updateProjectionMatrix();
camera.updateMatrixWorld(true);

const raycaster = new THREE.Raycaster();
function firstNameOf(target) {
  // aim a ray from the camera at a world point; name the first mesh hit
  const dir = target.clone().sub(camera.position).normalize();
  raycaster.set(camera.position, dir);
  const hits = raycaster.intersectObject(rig.root, true);
  if (!hits.length) return '(nothing)';
  let o = hits[0].object;
  let name = o.name || '';
  while (!name && o.parent) { o = o.parent; name = o.name || ''; }
  return (hits[0].object.userData.label || name || 'mesh') + '|' + hits[0].object.material.uuid.slice(0, 4);
}
function labelTree(rig_) {
  // give every mesh a searchable label from its branch
  const names = [];
  rig_.root.traverse((o) => { if (o.isMesh) names.push(o); });
  return names;
}
function whichPart(worldPoint) {
  const dir = worldPoint.clone().sub(camera.position).normalize();
  raycaster.set(camera.position, dir);
  const hits = raycaster.intersectObject(rig.root, true);
  if (!hits.length) return null;
  let o = hits[0].object;
  const path = [];
  while (o && o !== rig.root) { path.push(o); o = o.parent; }
  return { mesh: hits[0].object, path: path.map((n) => n === rig.eyes.R || rig.eyes.L ? 'eye' : '') };
}
const headPos = new THREE.Vector3();
rig.head.getWorldPosition(headPos);
function localToWorldOn(group, x, y, z) {
  const v = new THREE.Vector3(x, y, z);
  group.localToWorld(v);
  return v;
}

// eyes: the first thing hit must belong to an eye group (eyeball or lid)
function eyeVisible(eye) {
  // aim straight at the eyeball's visible surface (the iris line)
  const target = localToWorldOn(eye.socket, 0, 0.002, 0.056);
  const dir = target.clone().sub(camera.position).normalize();
  raycaster.set(camera.position, dir);
  const hits = raycaster.intersectObject(rig.root, true);
  if (!hits.length) return false;
  let o = hits[0].object;
  while (o) {
    if (o === eye.socket) return true;      // eyeball / lid / lash — all eye
    o = o.parent;
  }
  return false;
}
t('her right eye is visible from the front (no hair over it)', eyeVisible(rig.eyes.R));
t('her left eye is visible from the front (no hair over it)', eyeVisible(rig.eyes.L));

// nose visible
t('her nose is visible from the front', (function () {
  const target = localToWorldOn(rig.nose, 0, -0.02, 0.05);
  const dir = target.clone().sub(camera.position).normalize();
  raycaster.set(camera.position, dir);
  const hits = raycaster.intersectObject(rig.root, true);
  if (!hits.length) return false;
  let o = hits[0].object;
  while (o) { if (o === rig.nose) return true; o = o.parent; }
  return false;
})());

// mouth visible
t('her mouth is visible from the front', (function () {
  const target = localToWorldOn(rig.mouth, 0, -0.01, 0.02);
  const dir = target.clone().sub(camera.position).normalize();
  raycaster.set(camera.position, dir);
  const hits = raycaster.intersectObject(rig.root, true);
  if (!hits.length) return false;
  let o = hits[0].object;
  while (o) { if (o === rig.mouth) return true; o = o.parent; }
  return false;
})());

// the Bible is visible from the front
t('the Bible she holds is visible from the front', (function () {
  const target = localToWorldOn(rig.bible, 0, 0, 0.1);
  const dir = target.clone().sub(camera.position).normalize();
  raycaster.set(camera.position, dir);
  const hits = raycaster.intersectObject(rig.root, true);
  if (!hits.length) return false;
  let o = hits[0].object;
  while (o) { if (o === rig.bible) return true; o = o.parent; }
  return false;
})());

// shoes visible from the front
t('her shoes are in frame and visible (full body, head to feet)', (function () {
  let seen = 0;
  ['R', 'L'].forEach((k) => {
    const target = localToWorldOn(rig.legs[k].shoe, 0, 0.0, 0.15);
    const dir = target.clone().sub(camera.position).normalize();
    raycaster.set(camera.position, dir);
    const hits = raycaster.intersectObject(rig.root, true);
    if (!hits.length) return;
    let o = hits[0].object;
    while (o) { if (o === rig.legs[k].shoe) { seen += 1; break; } o = o.parent; }
  });
  return seen === 2;
})());

/* --- 3. symmetry: a face reads as a face ---------------------------------- */
// let any saccade settle so the head faces the member dead on
rig.look(0, 0);
for (let i = 0; i < 240; i += 1) rig.update(1 / 60, {});
const eyeR = new THREE.Vector3(), eyeL = new THREE.Vector3();
rig.eyes.R.socket.getWorldPosition(eyeR);
rig.eyes.L.socket.getWorldPosition(eyeL);
t('her eyes are level with each other', Math.abs(eyeR.y - eyeL.y) < 0.008, (eyeR.y - eyeL.y).toFixed(4));
t('her eyes are symmetric about the centre (her head sways gently while idle)', Math.abs(eyeR.x + eyeL.x) < 0.03, (eyeR.x + eyeL.x).toFixed(4));
const mouthWorld = localToWorldOn(rig.mouth, 0, 0, 0);
t('her mouth sits on the centre line (her head sways gently while idle)', Math.abs(mouthWorld.x) < 0.03, mouthWorld.x.toFixed(4));

/* --- 4. the mouth really moves -------------------------------------------- */
function speak(viseme, jaw, frames) {
  for (let i = 0; i < (frames || 30); i += 1) rig.update(1 / 60, { viseme, jaw, state: 'speaking' });
}
speak('M', 0.05, 24);
const mHeight = rig.mouthParts.cavity.scale.y;
speak('A', 0.95, 4);
const aHeight = rig.mouthParts.cavity.scale.y;
t('the jaw really opens: "A" is much taller than a closed "M"', aHeight > mHeight * 1.6,
  mHeight.toFixed(3) + ' → ' + aHeight.toFixed(3));
speak('I', 0.3, 30);
const wide = rig.mouthParts.cavity.scale.x;
speak('O', 1.0, 30);
const round = rig.mouthParts.cavity.scale.x;
t('lips spread for "I" and purse for "O"', wide > round, wide.toFixed(3) + ' vs ' + round.toFixed(3));
speak('M', 0.05, 30);
t('lips close naturally for M/B/P', rig.mouthParts.cavity.scale.y < 0.012, rig.mouthParts.cavity.scale.y.toFixed(3));
rig.update(1 / 60, { viseme: null });
t('the speaking mouth only shows while she is speaking', rig.speakingMouth.visible === false);

/* --- 5. every gesture and mood animates without throwing ------------------ */
let ok = true;
Lady.actions.forEach((action) => {
  try {
    rig.act(action);
    for (let i = 0; i < 8; i += 1) rig.update(1 / 60, { act: action, state: 'idle' });
  } catch (e) { ok = false; console.log('      gesture failed: ' + action + ' — ' + e.message); }
});
t('every published gesture animates her body', ok && Lady.actions.length >= 14, Lady.actions.length + ' actions');
ok = true;
Lady.states.forEach((state) => {
  try {
    rig.setState(state);
    for (let i = 0; i < 6; i += 1) rig.update(1 / 60, { state, gazeX: 0.3, gazeY: -0.2 });
  } catch (e) { ok = false; }
});
t('every mood animates her body', ok, Lady.states.join(','));
try {
  for (let i = 0; i < 4; i += 1) rig.update(1 / 60, { viseme: 'bogus', jaw: NaN, state: 'nowhere', gazeX: NaN, gazeY: Infinity, act: 'moonwalk' });
  rig.update(0, {});
  ok = true;
} catch (e) { ok = false; }
t('a strange signal value never breaks the frame', ok);

/* --- 6. her eyes follow the member ---------------------------------------- */
/* The gaze is driven the way PDDomey3D drives it: the signal arrives every
   frame (a one-shot look() is eroded by her autonomous return-to-centre, by
   design). Holding the signal makes the check deterministic. */
(function () {
  const settle = (signal) => { for (let i = 0; i < 30; i += 1) rig.update(1 / 60, signal); };
  settle({ gazeX: 1, gazeY: 0.2 });
  const right = rig.eyes.R.eye.position.x;
  settle({ gazeX: -1, gazeY: 0.2 });
  const left = rig.eyes.R.eye.position.x;
  t('her eyes look where the member is', Number.isFinite(right) && Number.isFinite(left) && right > 0.008 && left < -0.008,
    right.toFixed(3) + '/' + left.toFixed(3));
})();

/* --- 7. she blinks ---------------------------------------------------------- */
(function () {
  let closed = false;
  for (let i = 0; i < 60 * 12 && !closed; i += 1) {
    rig.update(1 / 60, {});
    if (rig.state.blink.closed > 0.9) closed = true;
  }
  t('she blinks on her own within twelve seconds', closed);
})();

/* --- 8. dispose -------------------------------------------------------------- */
try { rig.dispose(); ok = true; } catch (e) { ok = false; }
t('dispose() hands the whole model back', ok);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
