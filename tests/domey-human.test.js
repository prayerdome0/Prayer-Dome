'use strict';

/* Stylised cartoon human host (VRM) checks: the vendored model must be a real
 * VRM 1.0 file whose metadata permits free use, the licence files must be
 * present, the page must map "three" to the vendored r165 build, and the
 * mascot must fall back to the 2D drawing on any failure or on low-end Android. */
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
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ---- the model is a real VRM 1.0 file with a free licence
const vrmPath = path.join(ROOT, 'assets', 'domey', 'human', 'VRM1_Constraint_Twist_Sample.vrm');
const vrm = fs.readFileSync(vrmPath);
t('the model is a binary glTF (GLB) file', vrm.readUInt32LE(0) === 0x46546c67);
const jsonLength = vrm.readUInt32LE(12);
const gltf = JSON.parse(vrm.slice(20, 20 + jsonLength).toString('utf8'));
const meta = gltf.extensions && gltf.extensions.VRMC_vrm && gltf.extensions.VRMC_vrm.meta;
t('the model declares VRM 1.0 metadata', !!meta && !!gltf.extensions.VRMC_vrm.specVersion);
t('the model metadata allows redistribution and modification',
  meta && meta.allowRedistribution === true && /allowModification/.test(meta.modification || ''), JSON.stringify(meta && meta.modification));
t('the model metadata allows corporate use and needs no credit line',
  meta && meta.commercialUsage === 'corporation' && meta.creditNotation === 'unnecessary');
const expressions = Object.keys((gltf.extensions.VRMC_vrm.expressions || {}).preset || {});
t('the model has blink and all five mouth shapes (aa, ih, ou, ee, oh)',
  ['blink', 'aa', 'ih', 'ou', 'ee', 'oh'].every(n => expressions.includes(n)));
t('the model has a humanoid skeleton with head, neck, chest and arms',
  ['head', 'neck', 'chest', 'leftUpperArm', 'rightUpperArm', 'hips'].every(b =>
    gltf.extensions.VRMC_vrm.humanoid && gltf.extensions.VRMC_vrm.humanoid.humanBones[b]));

// ---- licences are present and name the right sources
const modelLicence = read('assets/domey/human/LICENSE.txt');
t('the model licence file names pixiv, the VRM Public License 1.0 and the cost',
  /pixiv Inc/.test(modelLicence) && /VRM Public License 1\.0/.test(modelLicence) && /Cost: free/.test(modelLicence));
const vendorLicence = read('assets/vendor/three-vrm/LICENSE.txt');
t('the vendored three-vrm bundle ships its MIT licence and sources',
  /MIT License/.test(vendorLicence) && /pixiv\/three-vrm/.test(vendorLicence) && /three\.js r165/.test(vendorLicence));

// ---- the bundle is vendored (no CDN) and exports what the rig uses
const bundle = read('assets/vendor/three-vrm/three-vrm.bundle.js');
t('the bundle exports the GLTF loader and the VRM plugins',
  /GLTFLoader/.test(bundle) && /VRMLoaderPlugin/.test(bundle) && /VRMUtils|VRMCore/.test(bundle));
t('the bundle imports only the bare "three" name (mapped to the vendored build)',
  (bundle.match(/from\s*"[^"]+"/g) || []).every(m => /"three"|"srgb-linear"/.test(m)));

// ---- the page wires it up correctly
const game = read('game.html');
const importMapAt = game.indexOf('"importmap"');
const threeAt = game.indexOf('/assets/three.module.min.js" type="module"');
t('the game page maps "three" with an import map before any module script',
  importMapAt > -1 && importMapAt < threeAt && /"three":"\/assets\/three\.module\.min\.js"/.test(game));
t('the game page loads the stylised human script', /pd-domey-human\.js/.test(game));
t('the game page no longer loads the realistic scan', !/pd-domey-scan\.js/.test(game));
t('the game page describes Domey as a stylised cartoon human', /stylised cartoon human/.test(game));

// ---- the rig module and the mascot integration
const human = read('assets/pd-domey-human.js');
t('the human module loads the bundle and model from this site only',
  /\/assets\/vendor\/three-vrm\/three-vrm\.bundle\.js/.test(human) && /\/assets\/domey\/human\/VRM1_Constraint_Twist_Sample\.vrm/.test(human) &&
  !/https?:\/\//.test(human));
t('the human rig implements the host contract (update, setViseme, look, act, dispose)',
  ['update', 'setViseme', 'look', 'act', 'dispose', 'setState'].every(m => new RegExp(`rig\\.${m} = |${m}: function`).test(human)));
t('the mascot keeps the 2D drawing on low-end Android and on any load failure',
  /isLowEnd\(\)/.test(read('assets/pd-mascot.js')) && /2d-low-end/.test(read('assets/pd-mascot.js')) &&
  /data-pdm-model', 'error'/.test(read('assets/pd-mascot.js')));
t('a load timeout is set so the character never sits on a permanent loader', /LOAD_TIMEOUT_MS = 30000/.test(human));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
