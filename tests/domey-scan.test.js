/*
 * Prayer Dome — Domey's realistic head (assets/pd-domey-scan.js)
 * ===========================================================================
 *   1. The head is the bundled human scan, parsed from the real .glb file —
 *      not a stand-in and not a cartoon.
 *   2. Its licence (CC BY 3.0) and attribution ship with the model and on the
 *      game page.
 *   3. The game uses it first, and falls back to the cartoon rig when the
 *      model cannot load, so nothing sits on a permanent loader.
 *   4. Low-end Android gets a lighter path (pixel ratio 1, normals less often).
 * ===========================================================================
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let failures = 0;
function t(name, ok, detail) {
  if (ok) console.log('PASS  ' + name);
  else { failures++; console.log('FAIL  ' + name + (detail ? '  ' + detail : '')); }
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const scanSrc = read('assets/pd-domey-scan.js');
const sandbox = { window: undefined, navigator: { userAgent: 'x' }, TextDecoder };
vm.createContext(sandbox);
vm.runInContext(scanSrc.replace(/^\/\*![\s\S]*?\*\//, ''), sandbox);
const scan = sandbox.PDDomeyScan;

t('the scan module exposes load, buildRig and parseGLB', !!scan && typeof scan.load === 'function' && typeof scan.buildRig === 'function' && typeof scan.parseGLB === 'function');

const glbPath = path.join(ROOT, 'assets/domey/scan/LeePerrySmith.glb');
const glb = fs.readFileSync(glbPath);
const mesh = scan.parseGLB(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength));
t('the bundled GLB parses to the documented scan (9,279 vertices, UVs and normals)',
  mesh.vertexCount === 9279 && mesh.uvs && mesh.uvs.length === 9279 * 2 && mesh.normals && mesh.indices.length % 3 === 0,
  mesh.vertexCount);
let maxIdx = 0;
for (let i = 0; i < mesh.indices.length; i++) if (mesh.indices[i] > maxIdx) maxIdx = mesh.indices[i];
t('every triangle index points at a real vertex', maxIdx < mesh.vertexCount);
t('the parsed model is upright with the face toward +Z (nose tip is the front-most point)', (function () {
  let best = 0; let bestZ = -Infinity;
  for (let i = 0; i < mesh.vertexCount; i++) { const z = mesh.positions[i * 3 + 2]; if (z > bestZ) { bestZ = z; best = i; } }
  return Math.abs(mesh.positions[best * 3]) < 0.5 && mesh.positions[best * 3 + 1] > 0.5;
})());

const licence = read('assets/domey/scan/LeePerrySmith_License.txt');
t('the model licence (CC BY 3.0) ships beside the model', /Attribution 3\.0/.test(licence) && /triplegangers/.test(licence));
const game = read('game.html');
t('the game page credits the stylised character and links its licence', /VRM1_Constraint_Twist_Sample/.test(game) && /vrm\.dev\/licenses\/1\.0/.test(game));
t('the game page loads the character script before the mascot', game.indexOf('pd-domey-human.js') > -1 && game.indexOf('pd-domey-human.js') < game.indexOf('pd-mascot.js'));

const mascot = read('assets/pd-mascot.js');
t('the mascot uses the stylised human first and keeps the 2D drawing if it fails',
  /global\.PDDomeyHuman/.test(mascot) && /human\.load\(THREE\)/.test(mascot) && /stylised character unavailable, keeping the drawing/.test(mascot) && /2d-low-end/.test(mascot));
t('the stylised human is passed to the engine as its rig', /createOptions\.rig = global\.PDDomeyHuman\.buildRig/.test(mascot));
t('the engine honours a lower pixel ratio on low-end devices', /maxPixelRatio/.test(read('assets/pd-domey3d.js')) && /maxPixelRatio: opts\.lowEnd \? 1 : 2/.test(mascot));
t('low-end detection covers Android devices with little memory or few cores', /lowMemory && fewCores|android && \(lowMemory \|\| fewCores\)/.test(scanSrc));

const rig = (function () {
  // A minimal THREE stand-in: enough to build and drive the rig logic without WebGL.
  const T = {
    BufferGeometry: function () { this.attributes = {}; this.index = null; this.setAttribute = (k, v) => { this.attributes[k] = v; }; this.setIndex = (v) => { this.index = v; }; this.computeVertexNormals = () => {}; this.dispose = () => {}; },
    BufferAttribute: function (array) { this.array = array; this.needsUpdate = false; this.setUsage = () => {}; },
    MeshStandardMaterial: function (o) { Object.assign(this, o); this.dispose = () => {}; },
    MeshBasicMaterial: function (o) { Object.assign(this, o); this.dispose = () => {}; },
    Mesh: function (g, m) { this.geometry = g; this.material = m; this.position = { set() {} }; this.scale = { set() {}, setScalar() {} }; this.visible = true; },
    CircleGeometry: function () { this.dispose = () => {}; },
    Group: function () { this.children = []; this.position = { set() {} }; this.scale = { setScalar() {} }; this.add = (c) => this.children.push(c); this.remove = () => {}; },
    DoubleSide: 2, DynamicDrawUsage: 35048
  };
  T.Mesh.prototype = {};
  return scan.buildRig(T, { asset: { mesh, texture: null }, lowEnd: true });
})();
t('the rig exposes the host contract (root, update, setViseme, setState, look, act, dispose)',
  rig.root && ['update', 'setViseme', 'setState', 'look', 'act', 'react', 'dispose'].every(k => typeof rig[k] === 'function'));
let threw = false;
try {
  for (let i = 0; i < 30; i++) rig.update(1 / 30, { viseme: 'A', jaw: 0.9, gazeX: 0.5, gazeY: -0.2, state: 'speaking' });
  rig.setViseme('O', 0.4).update(1 / 30, {});
  rig.setState('listening').look(-1, 1).act('nod').update(1 / 30, { calm: true });
  rig.dispose();
} catch (e) { threw = true; }
t('the rig runs speech, gaze and state updates without error', !threw);

const quiz = read('lesson-quiz.html');
t('quiz Start lands on the quiz panel, not the page top', /startQuizBtn[\s\S]{0,200}scrollToQuizPanel\(\)/.test(quiz));
t('quiz Next and Retake keep the quiz panel in view', (quiz.match(/scrollToQuizPanel\(\)/g) || []).length >= 4);
const quizPage = read('quiz.html');
t('quiz game screens scroll to the screen that opened, not the top', /pdScrollToScreen\('quizActiveScreen'\)/.test(quizPage) && /pdScrollToScreen\('levelMap'\)/.test(quizPage));

console.log(failures ? `\n${failures} failed` : '\nAll domey-scan checks passed');
process.exit(failures ? 1 : 0);
