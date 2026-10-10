/*!
 * Prayer Dome — Domey in three dimensions
 * ===========================================================================
 * Domey is not a drawing any more: this file builds him as a real 3D character
 * (a lit, shaded model made of meshes) and animates him every frame, so the
 * character the member talks to is a little person on a stage rather than a
 * flat picture.
 *
 *   <script src="/assets/pd-mascot.js" defer></script>
 *   <script src="/assets/pd-domey3d.js" defer></script>
 *
 *   PDDomey3D.ready().then(function () {          // loads three.js locally
 *     var show = PDDomey3D.create(stageEl, { host: PDMascot.mount(stageEl) });
 *   });
 *
 * What this file promises
 *   • Real talking. The lip-sync plan is still written by pd-mascot.js (one
 *     mouth posture per spoken sound), but here it drives a 3D mouth: cavity,
 *     teeth, tongue, lips and jaw width all move, and they are smoothed from
 *     frame to frame so nothing snaps.
 *   • Real acting. Every gesture the 2D stylesheet knew how to play — wave,
 *     point, clap, dance, think, heart, raise, shrug, thumb, count, offer,
 *     mic — is a pose in three dimensions, blended into and out of the idle
 *     pose.
 *   • Works with zero network. three.js is vendored in /assets and is loaded
 *     by dynamic import; nothing is fetched from a CDN. If WebGL is missing or
 *     the browser cannot load the module, `create()` resolves to null and the
 *     caller keeps the shared SVG character — the show never breaks.
 *   • Cheap and careful. One canvas, ~50 meshes, one animation loop that pauses
 *     when the tab or the stage is not visible, `prefers-reduced-motion` honoured,
 *     and dispose() that hands every buffer back.
 *
 * The model is built by buildRig(), which only ever touches real three.js
 * objects — no DOM, no canvas, no GPU — so the character can be unit tested in
 * Node by importing the vendored three.module.min.js module directly.
 */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  /* three.js r165 is the last release that ships a single self-contained ES
     module, which is what makes the vendored file work offline without a
     bundler. The revision is asserted at load time. */
  var THREE_REVISION = '165';

  var SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript &&
    document.currentScript.src) || '';
  var THREE_URL = SCRIPT_SRC
    ? new URL('three.module.min.js', SCRIPT_SRC).href
    : '/assets/three.module.min.js';

  /* The set of mouth postures the lip-sync engine publishes. Kept in step with
     `PDMascot.visemes`; every one of them has a shape below. */
  var VISEMES = ['rest', 'M', 'F', 'E', 'I', 'A', 'O', 'U', 'L'];

  /* How each posture deforms the mouth. `open` is jaw drop, `wide` is lip
     spread, `round` is lip rounding (O/U), and `teeth`/`tongue` are how much of
     each is showing. The numbers are read from the front row of a real mouth:
     "M" is closed and wide, "A" is tall and open, "O" is small and round. */
  var VISEME_SHAPES = {
    rest: { open: 0.10, wide: 0.66, round: 0.00, teeth: 0.30, tongue: 0.00 },
    M: { open: 0.03, wide: 0.74, round: 0.00, teeth: 0.22, tongue: 0.00 },
    F: { open: 0.16, wide: 0.80, round: 0.10, teeth: 0.80, tongue: 0.00 },
    E: { open: 0.58, wide: 0.98, round: 0.06, teeth: 0.66, tongue: 0.50 },
    I: { open: 0.24, wide: 1.06, round: 0.04, teeth: 0.78, tongue: 0.12 },
    A: { open: 0.96, wide: 0.74, round: 0.30, teeth: 0.52, tongue: 0.82 },
    O: { open: 0.70, wide: 0.34, round: 1.00, teeth: 0.16, tongue: 0.34 },
    U: { open: 0.38, wide: 0.26, round: 1.00, teeth: 0.08, tongue: 0.18 },
    L: { open: 0.32, wide: 0.64, round: 0.34, teeth: 0.62, tongue: 0.88 }
  };

  /* Gestures the host can ask for, with the arm pose each one needs. Angles
     are radians in the shoulder's local space: z lifts an arm sideways, x
     swings it forward (negative) or back, y twists it across the chest. */
  var ACTION_POSES = {
    wave: { armR: { z: 2.05, x: -0.30, y: 0.10 }, wave: 'R' },
    point: { armR: { z: 1.10, x: -0.62, y: 0.18 }, lean: 0.035 },
    open: { armR: { z: 0.92, x: -0.42, y: -0.18 }, armL: { z: -0.92, x: -0.42, y: 0.18 } },
    offer: { armR: { z: 0.68, x: -1.05, y: -0.10 }, armL: { z: -0.52, x: -0.72, y: 0.10 } },
    count: { armR: { z: 1.28, x: -0.78, y: 0.28 }, count: true },
    thumb: { armR: { z: 0.60, x: -1.12, y: 0.22 } },
    raise: { armR: { z: 2.35, x: -0.18 }, armL: { z: -2.35, x: -0.18 }, hop: 0.7 },
    shrug: { armR: { z: 0.80, x: -0.22, y: -0.25 }, armL: { z: -0.80, x: -0.22, y: 0.25 }, shrug: true },
    clap: { armR: { z: 1.62, x: -1.02, y: 0.30 }, armL: { z: -1.62, x: -1.02, y: -0.30 }, clap: true },
    heart: { armR: { z: 0.52, x: -1.14, y: 0.52 }, armL: { z: -0.52, x: -1.14, y: -0.52 }, lean: 0.05 },
    think: { armR: { z: 1.48, x: -0.68, y: 0.54 }, head: { tilt: 0.12, pitch: -0.05 } },
    dance: { sway: 1, armR: { z: 1.72, x: -0.44, y: -0.30 }, armL: { z: -1.62, x: -0.44, y: 0.30 }, hop: 0.9 },
    jump: { hop: 1, armR: { z: 1.35, x: -0.20 }, armL: { z: -1.35, x: -0.20 } },
    mic: { armL: { z: -1.28, x: -0.92, y: 0.30 }, mic: true, head: { pitch: 0.05 } }
  };

  var ACTIONS = Object.keys(ACTION_POSES);
  var STATES = ['idle', 'speaking', 'listening', 'thinking', 'celebrating', 'praying', 'happy'];

  /* ---------------------------------------------------------------- helpers */

  function clamp(value, min, max) { return value < min ? min : value > max ? max : value; }

  /* Frame-rate independent smoothing: how much of the way to `to` we travel
     this frame for a given "time constant" in seconds. */
  function approach(from, to, dt, seconds) {
    var k = 1 - Math.exp(-dt / Math.max(0.0001, seconds));
    return from + (to - from) * k;
  }
  function approachAngle(from, to, dt, seconds) { return approach(from, to, dt, seconds); }

  function prefersReducedMotion() {
    try {
      return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function supportsWebGL() {
    if (typeof document === 'undefined') return false;
    try {
      var canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl'));
    } catch (e) { return false; }
  }

  /* -------------------------------------------------------------- the loader */

  var pending = null;

  /**
   * Load three.js. Resolves with the module namespace (also published as
   * window.THREE). Rejects when the module cannot be fetched or when the
   * browser cannot parse a module at all — callers then keep the SVG Domey.
   */
  function load() {
    if (global.THREE && global.THREE.REVISION) return Promise.resolve(global.THREE);
    if (pending) return pending;
    pending = new Promise(function (resolve, reject) {
      var settled = false;
      try {
        // Dynamic import works from a classic script (and is the only way to
        // load an ES module without turning this file into one, which would
        // break every page that loads it with a plain <script> tag).
        var request = import(/* webpackIgnore: true */ THREE_URL);
        request.then(function (module) {
          if (settled) return;
          settled = true;
          global.THREE = module;
          if (String(module.REVISION) !== THREE_REVISION) {
            console.warn('[PDDomey3D] three.js r' + module.REVISION + ' loaded, r' + THREE_REVISION + ' expected');
          }
          resolve(module);
        }).catch(function (error) {
          if (settled) return;
          settled = true;
          pending = null;
          reject(error);
        });
      } catch (error) {
        settled = true;
        pending = null;
        reject(error);
      }
    });
    return pending;
  }

  function three() { return global.THREE && global.THREE.REVISION ? global.THREE : null; }

  function ready() { return three() ? Promise.resolve(global.THREE) : load(); }

  function available() { return !!three() && supportsWebGL(); }

  /* ------------------------------------------------------------------- rig */

  /* A mesh with a shared material, added to a parent and returned. */
  function part(THREE, parent, geometry, material, position, rotation, scale) {
    var mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  function group(THREE, parent, position) {
    var node = new THREE.Group();
    if (position) node.position.set(position[0], position[1], position[2]);
    if (parent) parent.add(node);
    return node;
  }

  /**
   * Build Domey's body. Pure geometry: no renderer, no camera, no DOM.
   * Returns a rig with `root` (add it to a scene), `update(dt, signals)` and
   * dispose().
   */
  function buildRig(THREE, options) {
    options = options || {};

    var geo = [];
    var mats = [];
    function G(g) { geo.push(g); return g; }
    function M(m) { mats.push(m); return m; }

    /* -------- palette: richer, more human materials (soft subsurface-like skin) */
    var skinMat = function (color, opts) {
      return M(new THREE.MeshStandardMaterial(Object.assign({
        color: color, roughness: 0.58, metalness: 0,
        // A faint warm emissive simulates subsurface scattering on the nose/cheeks.
        emissive: 0x8a4a28, emissiveIntensity: 0.06
      }, opts || {})));
    };
    var SKIN = skinMat(0xf0c193);
    var SKIN_DEEP = skinMat(0xd69a6c, { roughness: 0.66 });
    var SKIN_LIP = skinMat(0xd88a7a, { roughness: 0.48, emissive: 0x6a2a2a, emissiveIntensity: 0.08 });
    var ROBE = M(new THREE.MeshStandardMaterial({ color: 0x0f4e99, roughness: 0.62, metalness: 0.04,
      emissive: 0x08223f, emissiveIntensity: 0.15 }));
    var ROBE_DARK = M(new THREE.MeshStandardMaterial({ color: 0x083269, roughness: 0.68, metalness: 0.04 }));
    var TROUSER = M(new THREE.MeshStandardMaterial({ color: 0x0a1f3d, roughness: 0.78, metalness: 0.02 }));
    var SHOE = M(new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.45, metalness: 0.18 }));
    var GOLD = M(new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.6,
      emissive: 0x3a2c05, emissiveIntensity: 0.5 }));
    var HAIR = M(new THREE.MeshStandardMaterial({ color: 0x1e140d, roughness: 0.78, metalness: 0.02 }));
    var EYE_WHITE = M(new THREE.MeshStandardMaterial({ color: 0xfcfcfc, roughness: 0.24, metalness: 0 }));
    var IRIS = M(new THREE.MeshStandardMaterial({ color: 0x5c3618, roughness: 0.28, metalness: 0.06 }));
    var PUPIL = M(new THREE.MeshStandardMaterial({ color: 0x0c0907, roughness: 0.18, metalness: 0 }));
    var SCLERA_SHADE = M(new THREE.MeshStandardMaterial({ color: 0xe7c9b0, roughness: 0.3, metalness: 0,
      transparent: true, opacity: 0.35 }));
    var GLINT = M(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    var MOUTH = M(new THREE.MeshStandardMaterial({ color: 0x4a151a, roughness: 0.7, metalness: 0 }));
    var LIP = M(new THREE.MeshStandardMaterial({ color: 0xa8554f, roughness: 0.45, metalness: 0 }));
    var TEETH = M(new THREE.MeshStandardMaterial({ color: 0xf8f6ef, roughness: 0.28, metalness: 0 }));
    var TONGUE = M(new THREE.MeshStandardMaterial({ color: 0xb85058, roughness: 0.5, metalness: 0,
      emissive: 0x3a1418, emissiveIntensity: 0.1 }));
    var CHEEK = M(new THREE.MeshStandardMaterial({ color: 0xdb7965, roughness: 0.85,
      transparent: true, opacity: 0.28, emissive: 0x703028, emissiveIntensity: 0.05 }));
    var NOSE = M(new THREE.MeshStandardMaterial({ color: 0xdca57d, roughness: 0.6, metalness: 0,
      emissive: 0x4a2818, emissiveIntensity: 0.04 }));
    var BOOK = M(new THREE.MeshStandardMaterial({ color: 0x8d3a33, roughness: 0.6, metalness: 0.06 }));
    var PAGES = M(new THREE.MeshStandardMaterial({ color: 0xf7f0e2, roughness: 0.85, metalness: 0 }));
    var MIC = M(new THREE.MeshStandardMaterial({ color: 0x1b2740, roughness: 0.4, metalness: 0.35 }));
    var SPARK = M(new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 }));
    var NAIL = M(new THREE.MeshStandardMaterial({ color: 0xecc9a6, roughness: 0.35, metalness: 0 }));

    var rig = { THREE: THREE, version: VERSION };
    var root = group(THREE, null);
    rig.root = root;
    // Lift the figure so the feet land on the floor ring.
    root.position.y = 0.22;

    /* ------------------------------------------------------------- the body */
    var body = group(THREE, root);          // breathes and hops
    rig.body = body;
    var figure = group(THREE, body);        // sways and dances
    rig.figure = figure;

    var torso = part(THREE, figure,
      G(new THREE.CapsuleGeometry(0.40, 0.42, 8, 26)), ROBE, [0, 0.72, 0], null, [1.08, 1, 0.8]);
    rig.torso = torso;
    part(THREE, figure, G(new THREE.CylinderGeometry(0.44, 0.68, 0.62, 30, 1, false)), ROBE,
      [0, 0.36, 0], null, [1.04, 1, 0.82]);
    part(THREE, figure, G(new THREE.CylinderGeometry(0.665, 0.685, 0.06, 30, 1, true)), GOLD,
      [0, 0.08, 0], null, [1.04, 1, 0.82]);
    part(THREE, figure, G(new THREE.TorusGeometry(0.44, 0.052, 10, 40)), GOLD,
      [0, 0.62, 0], [Math.PI / 2, 0, 0], [1.04, 0.8, 1]);
    // The emblem on the chest: an open book, the Prayer Dome mark.
    part(THREE, figure, G(new THREE.BoxGeometry(0.20, 0.15, 0.03)), GOLD, [0, 0.98, 0.30], [0.1, 0, 0]);

    /* neck */
    part(THREE, figure, G(new THREE.CapsuleGeometry(0.10, 0.10, 6, 16)), SKIN, [0, 1.24, 0]);
    /* shoulder pads */
    part(THREE, figure, G(new THREE.SphereGeometry(0.21, 22, 16)), ROBE, [0.46, 1.12, 0], null, [1, 0.78, 0.9]);
    part(THREE, figure, G(new THREE.SphereGeometry(0.21, 22, 16)), ROBE, [-0.46, 1.12, 0], null, [1, 0.78, 0.9]);
    /* robe pocket folds */
    part(THREE, figure, G(new THREE.SphereGeometry(0.15, 18, 12)), ROBE_DARK, [0.18, 0.54, 0.30], null, [1.2, 0.5, 0.6]);
    part(THREE, figure, G(new THREE.SphereGeometry(0.15, 18, 12)), ROBE_DARK, [-0.18, 0.54, 0.30], null, [1.2, 0.5, 0.6]);

    /* --------------------------------------------------------------- legs + feet */
    function buildLeg(side) {
      var s = side === 'R' ? 1 : -1;
      var hip = group(THREE, figure, [s * 0.18, 0.05, 0.02]);
      var thigh = group(THREE, hip);
      part(THREE, thigh, G(new THREE.CapsuleGeometry(0.16, 0.30, 8, 16)), TROUSER, [0, -0.20, 0]);
      part(THREE, thigh, G(new THREE.SphereGeometry(0.17, 16, 12)), TROUSER, [0, 0.05, 0]);
      var knee = group(THREE, thigh, [0, -0.42, 0]);
      part(THREE, knee, G(new THREE.CapsuleGeometry(0.13, 0.32, 8, 16)), TROUSER, [0, -0.18, 0]);
      // cuff of the trousers
      part(THREE, knee, G(new THREE.CylinderGeometry(0.14, 0.15, 0.06, 18)), ROBE_DARK, [0, -0.38, 0]);
      // ankle / skin above the shoe
      part(THREE, knee, G(new THREE.SphereGeometry(0.10, 16, 12)), SKIN_DEEP, [0, -0.44, 0.02]);
      // shoe
      var shoe = group(THREE, knee, [0, -0.50, 0.05]);
      part(THREE, shoe, G(new THREE.CapsuleGeometry(0.10, 0.18, 6, 12)), SHOE, [0, -0.02, 0.04], null, [1, 0.55, 1.5]);
      part(THREE, shoe, G(new THREE.SphereGeometry(0.09, 14, 10)), SHOE, [-0.12, -0.03, 0.02], null, [0.7, 0.5, 1.2]);
      // sole
      part(THREE, shoe, G(new THREE.BoxGeometry(0.22, 0.03, 0.32)), SHOE, [0.02, -0.08, 0.04]);
      return { root: hip, thigh: thigh, knee: knee, shoe: shoe, side: side, sign: s };
    }
    var legR = buildLeg('R');
    var legL = buildLeg('L');
    rig.legs = { R: legR, L: legL };

    /* --------------------------------------------------------------- arms + articulated hands */
    var REST_ARM = 0.17;
    function buildFinger(parent, mat, pos, dir, segLens, radius) {
      // dir: 0..1 — 0 points down, 1 curls forward.
      var finger = group(THREE, parent, pos);
      var nodes = [finger];
      var cursor = finger;
      var segs = [null];
      var total = [0];
      for (var i = 0; i < segLens.length; i++) {
        var knuckle = group(THREE, cursor, [0, -total[i], 0.01 * i]);
        knuckle.rotation.x = (dir || 0) * 0.15;
        part(THREE, knuckle, G(new THREE.CapsuleGeometry(radius, segLens[i], 4, 8)), mat,
          [0, -segLens[i] * 0.5, 0], null, [1, 1, 1]);
        part(THREE, knuckle, G(new THREE.SphereGeometry(radius * 0.9, 10, 8)), mat);
        var nail = part(THREE, knuckle, G(new THREE.SphereGeometry(radius * 0.7, 10, 8)), NAIL,
          [0, -segLens[i] * 0.95, radius * 0.7], [Math.PI * 0.5, 0, 0], [1, 0.55, 0.8]);
        nodes.push(knuckle); segs.push(segLens[i]);
        total.push(total[i] + segLens[i]);
        cursor = knuckle;
      }
      return { root: finger, nodes: nodes, lengths: segs, curl: 0 };
    }
    function buildHand(side, parent, pos) {
      var s = side === 'R' ? 1 : -1;
      var hand = group(THREE, parent, pos);
      // palm
      part(THREE, hand, G(new THREE.SphereGeometry(0.10, 18, 14)), SKIN, [0, -0.02, 0.02], null, [1.0, 1.05, 0.72]);
      part(THREE, hand, G(new THREE.SphereGeometry(0.09, 16, 12)), SKIN_DEEP, [0, -0.06, 0.06], null, [1.0, 0.7, 0.55]);
      // wrist cuff
      part(THREE, hand, G(new THREE.TorusGeometry(0.08, 0.022, 6, 16)), SKIN_DEEP, [0, 0.08, 0], [Math.PI / 2, 0, 0]);
      // thumb
      var thumb = group(THREE, hand, [s * 0.09, -0.02, 0.0]);
      thumb.rotation.z = s * 0.6;
      thumb.rotation.x = -0.35;
      part(THREE, thumb, G(new THREE.CapsuleGeometry(0.025, 0.07, 4, 8)), SKIN, [0, -0.04, 0]);
      var thumbTip = group(THREE, thumb, [0, -0.10, 0]);
      part(THREE, thumbTip, G(new THREE.SphereGeometry(0.030, 12, 10)), SKIN);
      part(THREE, thumbTip, G(new THREE.SphereGeometry(0.020, 10, 8)), NAIL, [0, -0.02, 0.025], [Math.PI * 0.5, 0, 0], [1, 0.5, 0.8]);
      // four fingers (root, mid, tip)
      var fingerData = [
        { x: -0.050, y: -0.085, z: 0.02, len: [0.055, 0.045, 0.035], r: 0.022 },
        { x: -0.017, y: -0.100, z: 0.02, len: [0.065, 0.050, 0.038], r: 0.023 },
        { x:  0.017, y: -0.100, z: 0.02, len: [0.063, 0.048, 0.036], r: 0.022 },
        { x:  0.050, y: -0.088, z: 0.02, len: [0.050, 0.040, 0.032], r: 0.020 }
      ];
      var fingers = [];
      fingerData.forEach(function (f) {
        var base = group(THREE, hand, [f.x, f.y, f.z]);
        var joints = [base];
        for (var j = 0; j < f.len.length; j++) {
          var seg = group(THREE, joints[j]);
          part(THREE, seg, G(new THREE.CapsuleGeometry(f.r, f.len[j], 4, 8)), SKIN,
            [0, -f.len[j] * 0.5, 0], null, [1, 1, 1]);
          part(THREE, seg, G(new THREE.SphereGeometry(f.r * 0.95, 10, 8)), SKIN);
          if (j === f.len.length - 1) {
            part(THREE, seg, G(new THREE.SphereGeometry(f.r * 0.8, 10, 8)), NAIL,
              [0, -f.len[j] * 0.95, f.r * 1.2], [Math.PI * 0.5, 0, 0], [1, 0.55, 0.8]);
          }
          joints.push(seg);
        }
        fingers.push({ base: base, joints: joints, lengths: f.len });
      });
      return { root: hand, thumb: thumb, thumbTip: thumbTip, fingers: fingers };
    }
    function buildArm(side) {
      var s = side === 'R' ? 1 : -1;
      var shoulder = group(THREE, figure, [s * 0.46, 1.12, 0]);
      shoulder.rotation.z = s * REST_ARM;
      // upper arm
      part(THREE, shoulder, G(new THREE.CapsuleGeometry(0.12, 0.30, 8, 18)), ROBE, [0, -0.24, 0]);
      // elbow
      var elbow = group(THREE, shoulder, [0, -0.54, 0]);
      // forearm
      part(THREE, elbow, G(new THREE.CapsuleGeometry(0.10, 0.28, 8, 18)), ROBE, [0, -0.20, 0]);
      // cuff
      part(THREE, elbow, G(new THREE.TorusGeometry(0.11, 0.026, 8, 20)), GOLD,
        [0, -0.40, 0], [Math.PI / 2, 0, 0]);
      // a peek of wrist skin
      part(THREE, elbow, G(new THREE.SphereGeometry(0.10, 16, 12)), SKIN, [0, -0.47, 0.02]);
      var handInfo = buildHand(side, elbow, [0, -0.54, 0.02]);
      return { root: shoulder, elbow: elbow, hand: handInfo.root, handInfo: handInfo, side: side, sign: s };
    }
    var armR = buildArm('R');
    var armL = buildArm('L');
    rig.arms = { R: armR, L: armL };

    // The Bible in his right hand — the same prop the 2D character holds, reparented to the hand.
    var bible = group(THREE, armR.handInfo.root, [-0.02, -0.10, 0.13]);
    bible.rotation.set(-0.35, 0, 0.12);
    part(THREE, bible, G(new THREE.BoxGeometry(0.28, 0.05, 0.20)), BOOK);
    part(THREE, bible, G(new THREE.BoxGeometry(0.26, 0.032, 0.19)), PAGES, [0, 0.015, 0]);
    part(THREE, bible, G(new THREE.BoxGeometry(0.026, 0.018, 0.15)), GOLD, [0, 0.033, 0]);
    part(THREE, bible, G(new THREE.BoxGeometry(0.09, 0.018, 0.026)), GOLD, [0, 0.033, 0.02]);
    rig.bible = bible;

    // The hand microphone: hidden until Domey listens; attached to left hand.
    var mic = group(THREE, armL.handInfo.root, [0.0, -0.05, 0.12]);
    mic.rotation.set(-0.7, 0, 0.15);
    part(THREE, mic, G(new THREE.CylinderGeometry(0.032, 0.038, 0.14, 14)), MIC);
    part(THREE, mic, G(new THREE.SphereGeometry(0.052, 16, 12)), MIC, [0, 0.10, 0]);
    part(THREE, mic, G(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12)), GOLD, [0, -0.10, 0]);
    mic.visible = false;
    rig.mic = mic;

    /* --------------------------------------------------------------- head (more human proportion) */
    var head = group(THREE, figure, [0, 1.40, 0]);
    rig.head = head;
    var skull = part(THREE, head, G(new THREE.SphereGeometry(0.40, 40, 30)), SKIN, null, null, [1, 1.08, 0.98]);
    rig.skull = skull;
    // jaw — gives the head a real chin line instead of a round ball
    part(THREE, head, G(new THREE.SphereGeometry(0.22, 24, 18)), SKIN, [0, -0.32, 0.10], null, [1.05, 0.72, 0.95]);
    part(THREE, head, G(new THREE.SphereGeometry(0.12, 18, 14)), SKIN_DEEP, [0, -0.38, 0.18], null, [1.0, 0.5, 0.8]);
    // chin dimple
    part(THREE, head, G(new THREE.SphereGeometry(0.030, 12, 10)), SKIN_DEEP, [0, -0.40, 0.36], null, [1, 0.5, 0.6]);
    // ears (more detailed)
    [-1, 1].forEach(function (s) {
      var ear = group(THREE, head, [s * 0.39, 0.00, -0.02]);
      ear.rotation.y = s * 0.2;
      part(THREE, ear, G(new THREE.SphereGeometry(0.072, 16, 12)), SKIN, null, null, [0.55, 1.0, 0.9]);
      part(THREE, ear, G(new THREE.SphereGeometry(0.050, 14, 10)), SKIN_DEEP, [s * -0.01, -0.01, 0.02], null, [0.7, 0.75, 0.5]);
      part(THREE, ear, G(new THREE.TorusGeometry(0.032, 0.009, 6, 12, Math.PI * 1.4)), SKIN_DEEP,
        [0, 0, 0.01], [0, s * 0.3, 0]);
    });
    // nose — built from three small blobs so it has bridge, tip and nostrils
    var nose = group(THREE, head, [0, -0.08, 0.38]);
    part(THREE, nose, G(new THREE.CapsuleGeometry(0.032, 0.14, 6, 10)), NOSE, [0, 0.05, 0], null, [0.7, 1.0, 0.6]);
    part(THREE, nose, G(new THREE.SphereGeometry(0.048, 16, 12)), NOSE, [0, -0.03, 0.02]);
    part(THREE, nose, G(new THREE.SphereGeometry(0.022, 12, 10)), SKIN_DEEP, [-0.018, -0.06, 0.04]);
    part(THREE, nose, G(new THREE.SphereGeometry(0.022, 12, 10)), SKIN_DEEP, [0.018, -0.06, 0.04]);
    // Hair: softer, slightly wavier cap with fringe
    part(THREE, head, G(new THREE.SphereGeometry(0.42, 34, 22, 0, Math.PI * 2, 0, Math.PI * 0.58)), HAIR,
      [0, 0.03, -0.015], [-0.14, 0, 0], [1.04, 1.02, 1.04]);
    // sideburns
    part(THREE, head, G(new THREE.SphereGeometry(0.10, 16, 12)), HAIR, [-0.36, -0.05, 0.08], [0, 0.4, 0], [0.6, 1.0, 0.7]);
    part(THREE, head, G(new THREE.SphereGeometry(0.10, 16, 12)), HAIR, [0.36, -0.05, 0.08], [0, -0.4, 0], [0.6, 1.0, 0.7]);
    // fringe tufts
    part(THREE, head, G(new THREE.SphereGeometry(0.12, 18, 14)), HAIR, [-0.18, 0.24, 0.30], [0.3, 0.1, 0], [1.1, 0.75, 0.85]);
    part(THREE, head, G(new THREE.SphereGeometry(0.11, 18, 14)), HAIR, [0.00, 0.28, 0.30], [0.35, 0, 0], [1.1, 0.7, 0.8]);
    part(THREE, head, G(new THREE.SphereGeometry(0.11, 18, 14)), HAIR, [0.18, 0.24, 0.30], [0.3, -0.1, 0], [1.1, 0.75, 0.85]);

    var cheeks = [0.22, -0.22].map(function (x, index) {
      return part(THREE, head, G(new THREE.SphereGeometry(0.078, 16, 12)), CHEEK,
        [x, -0.11, 0.30], [-0.1, (index ? -1 : 1) * 0.20, 0], [1.1, 0.72, 0.5]);
    });
    rig.cheeks = cheeks;

    /* --------------------------------------------------------------- eyes — more human, mobile pupil */
    function buildEye(side) {
      var s = side === 'R' ? 1 : -1;
      var socket = group(THREE, head, [s * 0.155, 0.07, 0.36]);
      socket.rotation.x = -0.15;
      // eyelid (slight hood over top)
      var lid = part(THREE, socket, G(new THREE.SphereGeometry(0.100, 20, 14)), SKIN,
        [0, 0.030, -0.005], null, [1.05, 0.32, 0.72]);
      var lidLow = part(THREE, socket, G(new THREE.SphereGeometry(0.100, 20, 14)), SKIN,
        [0, -0.040, -0.010], null, [1.05, 0.22, 0.72]);
      var eye = group(THREE, socket);
      part(THREE, eye, G(new THREE.SphereGeometry(0.082, 24, 18)), EYE_WHITE, null, null, [1, 1.0, 0.65]);
      // sclera shading at the corner makes it rounder
      part(THREE, eye, G(new THREE.SphereGeometry(0.060, 16, 12)), SCLERA_SHADE, [-s * 0.04, -0.02, -0.01]);
      var iris = part(THREE, eye, G(new THREE.SphereGeometry(0.044, 20, 14)), IRIS, [0, 0, 0.052]);
      var pupil = part(THREE, eye, G(new THREE.SphereGeometry(0.023, 14, 12)), PUPIL, [0, 0, 0.078]);
      // iris ring (dark limbal ring)
      part(THREE, eye, G(new THREE.TorusGeometry(0.044, 0.004, 6, 18)), PUPIL,
        [0, 0, 0.05], [Math.PI / 2, 0, 0]);
      // glints — primary and secondary
      var glint1 = part(THREE, eye, G(new THREE.SphereGeometry(0.012, 10, 8)), GLINT, [0.018, 0.024, 0.080]);
      var glint2 = part(THREE, eye, G(new THREE.SphereGeometry(0.007, 8, 6)), GLINT, [-0.016, -0.010, 0.072]);
      // lashes
      var lash = part(THREE, socket, G(new THREE.CapsuleGeometry(0.005, 0.085, 4, 10)), HAIR,
        [0, 0.055, 0.055], [0.1, 0, 0], [1, 0.5, 0.4]);
      return { socket: socket, eye: eye, iris: iris, pupil: pupil, lid: lid, lidLow: lidLow, glint1: glint1, glint2: glint2 };
    }
    var eyes = { R: buildEye('R'), L: buildEye('L') };
    rig.eyes = eyes;

    function buildBrow(side) {
      var s = side === 'R' ? 1 : -1;
      var brow = group(THREE, head, [s * 0.16, 0.22, 0.34]);
      brow.rotation.set(-0.30, 0, s * 0.10);
      // main ridge
      part(THREE, brow, G(new THREE.CapsuleGeometry(0.015, 0.105, 6, 12)), HAIR, null, [0, 0, Math.PI / 2]);
      // a few hair tufts for thickness
      for (var k = -1; k <= 1; k++) {
        part(THREE, brow, G(new THREE.CapsuleGeometry(0.005, 0.022, 4, 6)), HAIR,
          [k * 0.035, 0.014, 0.01], [0.3, 0, k * s * 0.2]);
      }
      return brow;
    }
    var brows = { R: buildBrow('R'), L: buildBrow('L') };
    rig.brows = brows;

    /* --------------------------------------------------------------- mouth */
    /* Two mouth systems, exactly like the drawing: an expression mouth that
       shows how Domey feels, and the viseme assembly he speaks with. */
    var mouth = group(THREE, head, [0, -0.128, 0.393]);
    mouth.rotation.x = 0.33;
    rig.mouth = mouth;

    var expression = group(THREE, mouth);
    rig.expressionMouth = expression;
    var smile = part(THREE, expression, G(new THREE.TorusGeometry(0.105, 0.014, 8, 26, Math.PI * 0.72)), LIP,
      [0, 0.045, 0.01], [0, 0, Math.PI * 0.14]);
    var openMouth = part(THREE, expression, G(new THREE.SphereGeometry(1, 20, 14)), MOUTH,
      [0, -0.01, 0], null, [0.085, 0.07, 0.02]);
    var thinkMouth = part(THREE, expression, G(new THREE.CapsuleGeometry(0.013, 0.11, 6, 12)), LIP,
      [0, 0.01, 0.01], [0, 0, Math.PI / 2]);
    var prayMouth = part(THREE, expression, G(new THREE.TorusGeometry(0.062, 0.012, 8, 22, Math.PI)), LIP,
      [0, -0.01, 0.01], [0, 0, 0]);
    rig.expressionParts = { smile: smile, open: openMouth, think: thinkMouth, pray: prayMouth };

    var speaking = group(THREE, mouth);
    speaking.visible = false;
    rig.speakingMouth = speaking;
    var cavity = part(THREE, speaking, G(new THREE.SphereGeometry(1, 24, 16)), MOUTH, null, null, [0.13, 0.05, 0.05]);
    var lips = part(THREE, speaking, G(new THREE.TorusGeometry(1, 0.20, 8, 26)), LIP, [0, 0, 0.005], null, [0.14, 0.06, 0.02]);
    var teeth = part(THREE, speaking, G(new THREE.SphereGeometry(1, 20, 14)), TEETH, [0, 0, 0.012], null, [0.10, 0.02, 0.03]);
    var tongue = part(THREE, speaking, G(new THREE.SphereGeometry(1, 18, 14)), TONGUE, [0, 0, 0.008], null, [0.06, 0.02, 0.03]);
    rig.mouthParts = { cavity: cavity, lips: lips, teeth: teeth, tongue: tongue };

    /* ------------------------------------------------------- celebration dust */
    var sparks = [];
    for (var i = 0; i < 22; i++) {
      var spark = part(THREE, root, G(new THREE.SphereGeometry(0.045, 10, 8)), SPARK);
      spark.visible = false;
      spark.castShadow = false;
      sparks.push({ mesh: spark, life: 0, vx: 0, vy: 0, vz: 0 });
    }
    rig.sparks = sparks;

    /* ------------------------------------------------------------ behaviour */
    var state = {
      viseme: null,
      jaw: 0,
      action: null,
      actionAge: 0,
      act: null,
      pose: null,          // smoothed pose actually applied
      gaze: { x: 0, y: 0 },
      look: { x: 0, y: 0 },
      blink: { next: 1.6, t: 0, closed: 0 },
      time: 0,
      mouth: { open: 0.08, wide: 0.66, round: 0, teeth: 0.3, tongue: 0 },
      bob: 0,
      hop: 0,
      sway: 0,
      micWant: 0,
      micShow: 0,
      sparkle: 0
    };
    rig.state = state;

    var neutral = { armR: { z: 0.17, x: 0, y: 0 }, armL: { z: -0.17, x: 0, y: 0 } };
    var pose = {
      armR: { z: 0.17, x: 0, y: 0 }, armL: { z: -0.17, x: 0, y: 0 },
      headTilt: 0, headPitch: 0, headYaw: 0, lean: 0, hop: 0, sway: 0, shrug: 0,
      mic: 0, sparkle: 0, browRaise: 0, smile: 0.6, mouthOpen: 0
    };

    function basePose(name) {
      var p = {
        armR: { z: 0.17, x: 0, y: 0 }, armL: { z: -0.17, x: 0, y: 0 },
        headTilt: 0, headPitch: 0, headYaw: 0, lean: 0, hop: 0, sway: 0, shrug: 0,
        mic: 0, sparkle: 0, browRaise: 0, smile: 0.6, mouthOpen: 0
      };
      if (name === 'listening') {
        p.headTilt = 0.10; p.headPitch = 0.04; p.mic = 1;
        p.armL = { z: -1.28, x: -0.92, y: 0.30 };
        p.smile = 0.5;
      } else if (name === 'thinking') {
        p.headTilt = 0.14; p.headPitch = -0.07; p.browRaise = 0.5; p.smile = 0.1;
        p.armR = { z: 1.45, x: -0.66, y: 0.52 };
      } else if (name === 'celebrating') {
        p.smile = 1; p.hop = 1; p.browRaise = 0.8; p.sparkle = 1;
        p.armR = { z: 2.3, x: -0.25, y: 0.15 }; p.armL = { z: -2.3, x: -0.25, y: -0.15 };
      } else if (name === 'praying') {
        p.smile = 0.35; p.headPitch = 0.16; p.lean = 0.04;
        p.armR = { z: 0.55, x: -1.05, y: 0.55 }; p.armL = { z: -0.55, x: -1.05, y: -0.55 };
      } else if (name === 'speaking') {
        p.smile = 0.75; p.browRaise = 0.3;
      } else if (name === 'happy') {
        p.smile = 0.95; p.browRaise = 0.6;
      }
      return p;
    }

    function mergePose(target, action) {
      var spec = ACTION_POSES[action];
      if (!spec) return target;
      ['armR', 'armL'].forEach(function (key) {
        if (!spec[key]) return;
        var from = target[key];
        // Arms blend 70% of the way to the gesture, so a wave still reads as a
        // greeting rather than a rigid robot arm.
        target[key] = {
          z: from.z + (spec[key].z - from.z) * 0.9,
          x: from.x + (spec[key].x - from.x) * 0.9,
          y: from.y + (spec[key].y - from.y) * 0.9
        };
      });
      if (spec.head) {
        target.headTilt += spec.head.tilt || 0;
        target.headPitch += spec.head.pitch || 0;
        target.headYaw += spec.head.yaw || 0;
      }
      if (spec.lean) target.lean += spec.lean;
      if (spec.hop) target.hop = Math.max(target.hop, spec.hop);
      if (spec.sway) target.sway = Math.max(target.sway, spec.sway);
      if (spec.shrug) target.shrug = 1;
      if (spec.mic) target.mic = 1;
      return target;
    }

    /** Start a gesture. `name` is one of PDDomey3D.actions. */
    rig.act = function (name) {
      if (name && !ACTION_POSES[name]) return rig;
      state.action = name || null;
      state.actionAge = 0;
      return rig;
    };

    /** Float celebration dust. `kind` is only a hint; count is 1..8. */
    rig.react = function (kind, count) {
      var n = clamp(count || 3, 1, 8);
      var started = 0;
      for (var i = 0; i < sparks.length && started < n; i++) {
        var s = sparks[i];
        if (s.life > 0) continue;
        started++;
        s.life = 1.6 + Math.random() * 0.7;
        s.max = s.life;
        s.mesh.visible = true;
        s.mesh.position.set((Math.random() - 0.5) * 1.1, 0.7 + Math.random() * 0.5, 0.3 + Math.random() * 0.4);
        s.vx = (Math.random() - 0.5) * 0.5;
        s.vy = 0.55 + Math.random() * 0.4;
        s.vz = (Math.random() - 0.5) * 0.3;
        s.mesh.scale.setScalar(0.6 + Math.random() * 0.7);
      }
      state.sparkle = 1;
      return rig;
    };

    /** Set the emotional state: idle, speaking, listening, thinking, … */
    rig.setState = function (name) {
      state.state = name && STATES.indexOf(name) !== -1 ? name : 'idle';
      return rig;
    };

    rig.setViseme = function (viseme, jaw) {
      state.viseme = viseme && VISEME_SHAPES[viseme] ? viseme : (viseme === 'rest' ? 'rest' : null);
      state.jaw = clamp(typeof jaw === 'number' && isFinite(jaw) ? jaw : 0, 0, 1.2);
      return rig;
    };

    /** Where the member is looking, in -1..1 on both axes (0 is straight ahead). */
    rig.look = function (x, y) {
      state.gaze.x = clamp(x || 0, -1, 1);
      state.gaze.y = clamp(y || 0, -1, 1);
      return rig;
    };

    /**
     * One animation step. `signals` carries what the host is doing right now:
     *   { viseme, jaw, act, state, gazeX, gazeY, calm }
     * Every field is optional, so the rig also runs standalone.
     */
    rig.update = function (dt, signals) {
      signals = signals || {};
      var step = clamp(typeof dt === 'number' && isFinite(dt) ? dt : 1 / 60, 0.001, 0.1);
      var calm = !!signals.calm;
      state.time += step;

      if ('state' in signals) rig.setState(signals.state);
      if ('viseme' in signals) rig.setViseme(signals.viseme, signals.jaw);
      if ('gazeX' in signals || 'gazeY' in signals) rig.look(signals.gazeX, signals.gazeY);
      if (signals.act !== undefined && signals.act !== state.act) {
        state.act = signals.act;
        rig.act(signals.act);
      }

      /* ---- target pose: the state's base pose, plus the action's gesture */
      var target = basePose(state.state);
      if (state.action) {
        state.actionAge += step;
        if (state.actionAge > 6) { state.action = null; }
        else mergePose(target, state.action);
      }
      var speed = calm ? 0.42 : 1;

      /* ---- procedural, always-on life: breathing and a slow sway */
      var breathe = Math.sin(state.time * 1.7) * 0.012 * speed;
      var sway = Math.sin(state.time * 0.62) * (calm ? 0.008 : 0.022) * speed;
      pose.armR.z = approachAngle(pose.armR.z, target.armR.z, step, 0.16);
      pose.armR.x = approachAngle(pose.armR.x, target.armR.x, step, 0.16);
      pose.armR.y = approachAngle(pose.armR.y, target.armR.y, step, 0.16);
      pose.armL.z = approachAngle(pose.armL.z, target.armL.z, step, 0.16);
      pose.armL.x = approachAngle(pose.armL.x, target.armL.x, step, 0.16);
      pose.armL.y = approachAngle(pose.armL.y, target.armL.y, step, 0.16);
      pose.lean = approach(pose.lean, (target.lean || 0) + (target.sway ? Math.sin(state.time * 5.4) * 0.05 * speed : 0), step, 0.2);
      pose.sway = approach(pose.sway, target.sway || 0, step, 0.25);
      pose.shrug = approach(pose.shrug, target.shrug || 0, step, 0.18);
      pose.mic = approach(pose.mic, target.mic || 0, step, 0.2);
      pose.sparkle = approach(pose.sparkle, target.sparkle || 0, step, 0.3);
      pose.browRaise = approach(pose.browRaise, target.browRaise || 0, step, 0.2);

      var hopWave = 0;
      if ((target.hop || 0) > 0 && !calm) {
        hopWave = Math.abs(Math.sin(state.time * 4.2)) * 0.07 * (target.hop || 0);
      }

      /* ---- the head: nods while speaking, tilts, and follows the member */
      var speakNod = (state.state === 'speaking' || state.viseme)
        ? Math.sin(state.time * 5.1) * 0.035 * speed : 0;
      var yaw = (target.headYaw || 0) + state.gaze.x * 0.24 + Math.sin(state.time * 0.5) * 0.02 * speed;
      var pitch = (target.headPitch || 0) + state.gaze.y * 0.12 + speakNod;
      var tilt = (target.headTilt || 0) + Math.sin(state.time * 0.42) * 0.03 * speed;
      head.rotation.y = approachAngle(head.rotation.y, yaw, step, 0.22);
      head.rotation.x = approachAngle(head.rotation.x, pitch, step, 0.22);
      head.rotation.z = approachAngle(head.rotation.z, tilt, step, 0.24);

      /* ---- arms */
      var waveSwing = 0;
      if (state.action === 'wave' && !calm) waveSwing = Math.sin(state.time * 9.5) * 0.34;
      var clapPhase = 0;
      if (state.action === 'clap' && !calm) clapPhase = Math.abs(Math.sin(state.time * 5.6)) * 0.42;
      var countPhase = 0;
      if (state.action === 'count' && !calm) countPhase = Math.abs(Math.sin(state.time * 4.4)) * 0.16;
      armR.root.rotation.z = pose.armR.z + waveSwing;
      armR.root.rotation.x = pose.armR.x + (state.action === 'clap' ? -0.45 : 0) - countPhase * 0.5;
      armR.root.rotation.y = pose.armR.y + clapPhase;
      armL.root.rotation.z = pose.armL.z;
      armL.root.rotation.x = pose.armL.x - (state.action === 'clap' ? 0.45 : 0);
      armL.root.rotation.y = pose.armL.y - clapPhase;
      if (state.action === 'shrug') {
        armR.root.rotation.z += Math.abs(pose.shrug) * 0.1;
        armL.root.rotation.z -= Math.abs(pose.shrug) * 0.1;
      }

      /* ---- the microphone only appears when he is listening */
      state.micShow = approach(state.micShow, pose.mic > 0.4 ? 1 : 0, step, 0.18);
      mic.visible = state.micShow > 0.35;
      if (mic.visible) mic.scale.setScalar(0.75 + state.micShow * 0.25);

      /* ---- body */
      var shrugLift = pose.shrug * 0.03;
      body.position.y = hopWave + shrugLift + breathe;
      body.rotation.z = sway * 0.5 + Math.sin(state.time * 5.4) * pose.sway * 0.012;
      figure.rotation.y = approachAngle(figure.rotation.y, pose.lean * -1.6, step, 0.3);
      figure.rotation.x = approachAngle(figure.rotation.x, pose.lean, step, 0.3);
      torso.scale.set(1.08 + breathe * 0.35, 1 - breathe * 0.4, 0.8);

      /* ---- legs: natural stance with slight weight shift, knees soft */
      var weightShift = Math.sin(state.time * 0.8) * 0.02 * speed;
      legR.root.rotation.x = approachAngle(legR.root.rotation.x, 0.04 + weightShift, step, 0.3);
      legL.root.rotation.x = approachAngle(legL.root.rotation.x, 0.04 - weightShift, step, 0.3);
      legR.knee.rotation.x = approachAngle(legR.knee.rotation.x, 0.08 - weightShift, step, 0.3);
      legL.knee.rotation.x = approachAngle(legL.knee.rotation.x, 0.08 + weightShift, step, 0.3);
      if (state.action === 'jump' || state.action === 'dance') {
        var kick = Math.sin(state.time * 6) * 0.25;
        legR.knee.rotation.x = approachAngle(legR.knee.rotation.x, 0.4 - kick * 0.4, step, 0.18);
        legL.knee.rotation.x = approachAngle(legL.knee.rotation.x, 0.4 + kick * 0.4, step, 0.18);
      }
      if (state.action === 'clap' || state.state === 'celebrating') {
        var bounce = Math.abs(Math.sin(state.time * 5.5)) * 0.15;
        legR.knee.rotation.x = approachAngle(legR.knee.rotation.x, 0.15 + bounce, step, 0.15);
        legL.knee.rotation.x = approachAngle(legL.knee.rotation.x, 0.15 + bounce, step, 0.15);
      }

      /* ---- fingers: relaxed curl at rest, grip Bible/mic, point, count, clap */
      function curlFingers(handInfo, amount, spread) {
        if (!handInfo || !handInfo.fingers) return;
        var joints = handInfo.fingers.forEach(function (f, idx) {
          var curl = amount;
          // middle finger curls most, pinky least
          var per = [0.95, 1.05, 1.0, 0.85][idx] || 1;
          var sp = (spread || 0) * (idx - 1.5) * 0.05;
          for (var j = 1; j < f.joints.length; j++) {
            var target = curl * per * (0.5 + j * 0.35);
            f.joints[j].rotation.x = approachAngle(f.joints[j].rotation.x, target, step, 0.12);
            f.joints[j].rotation.z = approachAngle(f.joints[j].rotation.z, sp, step, 0.15);
          }
          f.base.rotation.z = approachAngle(f.base.rotation.z, sp, step, 0.15);
        });
        handInfo.thumb.rotation.x = approachAngle(handInfo.thumb.rotation.x, -0.35 - amount * 0.3, step, 0.15);
      }
      var grip = (state.action === 'mic' || pose.mic > 0.5) ? 0.8 : (state.action === 'offer' ? 0.3 : 0.22);
      var gripR = (state.action === 'point' || state.action === 'thumb' || state.action === 'wave') ? 0.10 : 0.35;
      if (state.action === 'count') gripR = 0.35;
      if (state.action === 'open' || state.action === 'raise') gripR = 0.0;
      if (state.action === 'clap') { grip = 0.45; gripR = 0.45; }
      curlFingers(armL.handInfo, grip, state.action === 'open' ? 0.5 : 0);
      curlFingers(armR.handInfo, gripR, state.action === 'open' ? 0.5 : 0);
      // point: extend the index finger
      if (armR.handInfo && state.action === 'point') {
        var index = armR.handInfo.fingers[1];
        if (index) for (var j = 1; j < index.joints.length; j++) index.joints[j].rotation.x = 0;
      }
      // count: cycle through extended fingers
      if (armR.handInfo && state.action === 'count') {
        var upFingers = Math.floor((state.actionAge * 2.2) % 4);
        armR.handInfo.fingers.forEach(function (f, idx) {
          var extend = idx <= upFingers ? 0 : 0.55;
          for (var j = 1; j < f.joints.length; j++) f.joints[j].rotation.x = extend;
        });
      }
      // thumbs up
      if (armR.handInfo && state.action === 'thumb') {
        armR.handInfo.thumb.rotation.z = approachAngle(armR.handInfo.thumb.rotation.z, -1.2, step, 0.18);
      } else if (armR.handInfo) {
        armR.handInfo.thumb.rotation.z = approachAngle(armR.handInfo.thumb.rotation.z, armR.sign * 0.6, step, 0.2);
      }

      /* ---- elbow bend for natural arm shapes */
      var elbowBendL = 0.45 + pose.armL.x * 0.8;
      var elbowBendR = 0.45 + pose.armR.x * 0.8;
      if (state.action === 'clap') { elbowBendL = 1.1; elbowBendR = 1.1; }
      if (state.action === 'think') elbowBendR = 1.3;
      if (state.action === 'mic' || pose.mic > 0.5) elbowBendL = 1.3;
      if (state.action === 'wave') elbowBendR = 0.9;
      armL.elbow.rotation.x = approachAngle(armL.elbow.rotation.x, elbowBendL, step, 0.18);
      armR.elbow.rotation.x = approachAngle(armR.elbow.rotation.x, elbowBendR, step, 0.18);
      armL.elbow.rotation.z = approachAngle(armL.elbow.rotation.z, -0.1, step, 0.2);
      armR.elbow.rotation.z = approachAngle(armR.elbow.rotation.z, 0.1, step, 0.2);

      /* ---- the mouth ------------------------------------------------------
         While a viseme is playing the mouth is a real opening whose height,
         width, roundness, teeth and tongue come from the posture table, scaled
         by the jaw amount the speech engine published this frame. */
      speaking.visible = !!state.viseme;
      expression.visible = !state.viseme;
      if (state.viseme) {
        var shape = VISEME_SHAPES[state.viseme] || VISEME_SHAPES.rest;
        var jaw = state.jaw || 0;
        var energy = 0.55 + jaw * 0.75;                    // how open this frame is
        var openTarget = clamp(shape.open * energy, 0.02, 1.05);
        var wideTarget = clamp(shape.wide * (1 - shape.round * 0.42), 0.2, 1.2);
        state.mouth.open = approach(state.mouth.open, openTarget, step, 0.035);
        state.mouth.wide = approach(state.mouth.wide, wideTarget, step, 0.05);
        state.mouth.round = approach(state.mouth.round, shape.round, step, 0.05);
        state.mouth.teeth = approach(state.mouth.teeth, shape.teeth, step, 0.06);
        state.mouth.tongue = approach(state.mouth.tongue, shape.tongue, step, 0.06);

        var m = state.mouth;
        var halfW = 0.125 * m.wide;
        var halfH = 0.013 + 0.088 * m.open * (1 - m.round * 0.35);
        cavity.scale.set(halfW, halfH, 0.05);
        lips.scale.set(halfW * 1.12, halfH * 1.24, 0.02);
        lips.position.y = 0;
        teeth.visible = m.teeth > 0.12;
        if (teeth.visible) {
          teeth.scale.set(halfW * 0.82, 0.018 + halfH * 0.12, 0.03);
          teeth.position.y = halfH * 0.62;
          teeth.position.z = 0.012;
        }
        tongue.visible = m.tongue > 0.1;
        if (tongue.visible) {
          tongue.scale.set(halfW * 0.55, 0.016 + halfH * 0.16, 0.03);
          tongue.position.y = -halfH * 0.5;
        }
      } else {
        // Expression mouth: the shape tells the member how Domey feels.
        var wantSmile = (pose.smile + (state.sparkle * 0.3)) / 1.3;
        smile.visible = wantSmile > 0.18 && state.state !== 'praying' && state.state !== 'thinking';
        smile.scale.set(0.7 + wantSmile * 0.55, 0.7 + wantSmile * 0.55, 1);
        smile.rotation.z = Math.PI * 0.14 - wantSmile * 0.06;
        openMouth.visible = state.state === 'celebrating';
        if (openMouth.visible) openMouth.scale.set(0.085, 0.075, 0.02);
        thinkMouth.visible = state.state === 'thinking';
        prayMouth.visible = state.state === 'praying';
        state.mouth.open = approach(state.mouth.open, 0, step, 0.08);
      }

      /* ---- eyes: natural blink (fast close, slow open), look around, widen on surprise */
      state.blink.next -= step;
      if (state.blink.next <= 0) {
        state.blink.next = 2.2 + Math.random() * 3.8;
        state.blink.t = 0.18;
        state.blink.phase = 0; // 0->1 closing, 1->2 opening
      }
      if (state.blink.t > 0) {
        state.blink.t -= step;
        if (state.blink.t > 0.09) state.blink.phase = 0;
        else state.blink.phase = 1;
        var blinkProgress = state.blink.phase === 0
          ? clamp((0.18 - state.blink.t) / 0.09, 0, 1)
          : clamp(state.blink.t / 0.09, 0, 1);
        // Ease the curve for a snappy close
        state.blink.closed = (state.blink.phase === 0)
          ? blinkProgress * blinkProgress
          : blinkProgress;
      } else {
        state.blink.closed = approach(state.blink.closed, 0, step, 0.08);
      }
      // Occasional micro-saccades make the gaze feel alive
      if (Math.random() < 0.004 * speed) {
        state.gaze.x = clamp((Math.random() - 0.5) * 0.6, -1, 1);
        state.gaze.y = clamp((Math.random() - 0.5) * 0.4, -1, 1);
      }
      var surprise = state.state === 'celebrating' ? 1.10 : (state.state === 'thinking' ? 0.95 : 1);
      var bored = state.state === 'listening' ? 0.97 : 1;
      state.look.x = approach(state.look.x, state.gaze.x * 0.040, step, 0.10);
      state.look.y = approach(state.look.y, -state.gaze.y * 0.028, step, 0.10);
      ['R', 'L'].forEach(function (key) {
        var eye = eyes[key];
        eye.eye.position.x = state.look.x;
        eye.eye.position.y = state.look.y;
        var closed = state.blink.closed;
        // eyelids scale vertically to cover the eye
        eye.lid.scale.y = 0.32 + closed * 1.8;
        eye.lid.position.y = 0.03 + closed * 0.04;
        eye.lidLow.scale.y = 0.22 + closed * 1.5;
        eye.lidLow.position.y = -0.04 - closed * 0.04;
        eye.eye.scale.set(1, surprise * bored * (1 - closed * 0.92), 1);
        // iris reacts slightly to light (celebrating = a little wider pupil)
        eye.pupil.scale.setScalar(1 + (state.state === 'celebrating' ? 0.15 : 0));
      });

      /* ---- brows: raised on a question or a win, level on a wrong answer */
      var browY = 0.255 + pose.browRaise * 0.035;
      brows.R.position.y = browY;
      brows.L.position.y = browY;
      brows.R.rotation.z = 0.12 - pose.browRaise * 0.06;
      brows.L.rotation.z = -0.12 + pose.browRaise * 0.06;

      /* ---- cheeks glow a little brighter when he is pleased */
      var glow = clamp(pose.smile * 0.5 + state.sparkle * 0.4, 0, 0.75);
      cheeks.forEach(function (cheek) { cheek.material.opacity = 0.22 + glow * 0.3; });

      /* ---- floating celebration dust */
      for (var i = 0; i < sparks.length; i++) {
        var s = sparks[i];
        if (s.life <= 0) continue;
        s.life -= step;
        if (s.life <= 0) { s.mesh.visible = false; s.mesh.scale.setScalar(1); continue; }
        s.mesh.position.x += s.vx * step;
        s.mesh.position.y += s.vy * step;
        s.mesh.position.z += s.vz * step;
        s.vy -= step * 0.28;
        s.mesh.rotation.z += step * 2.4;
        s.mesh.scale.setScalar(0.35 + (s.life / s.max) * 0.9);
      }
      if (state.sparkle > 0) state.sparkle = Math.max(0, state.sparkle - step * 0.9);

      return rig;
    };

    /** Release every buffer this rig allocated. */
    rig.dispose = function () {
      for (var i = 0; i < geo.length; i++) { try { geo[i].dispose(); } catch (e) {} }
      for (var j = 0; j < mats.length; j++) { try { mats[j].dispose(); } catch (e) {} }
      geo.length = 0;
      mats.length = 0;
      if (root.parent) root.parent.remove(root);
      while (root.children.length) root.remove(root.children[0]);
      return rig;
    };

    rig.neutralPose = neutral;
    return rig;
  }

  /* ---------------------------------------------------------------- staging */

  /** Read the live signals the mascot host publishes on its root element. */
  function hostSignals(host) {
    var root = host && host.root;
    if (!root || !root.getAttribute) return {};
    function css(name) {
      var value = root.style && root.style.getPropertyValue ? root.style.getPropertyValue(name) : '';
      var num = parseFloat(value);
      return isFinite(num) ? num : 0;
    }
    return {
      viseme: root.getAttribute('data-pdm-vis') || null,
      jaw: css('--pdm-jaw'),
      act: root.getAttribute('data-pdm-act') || null,
      state: host.state || root.getAttribute('data-pdm-state') || 'idle',
      gazeX: clamp(css('--pdm-gaze-x') / 2.6, -1, 1),
      gazeY: clamp(css('--pdm-gaze-y') / 1.9, -1, 1)
    };
  }

  /**
   * Put the 3D character on a stage: camera, lights, renderer and the loop.
   * Returns null when three.js or WebGL is unavailable, so a caller can always
   * keep the 2D character instead.
   */
  function create(container, options) {
    options = options || {};
    var T = options.three || three();
    if (!T || !container || !container.appendChild) return null;
    if (!options.force && !supportsWebGL()) return null;

    var host = options.host || null;
    var reduced = options.reducedMotion != null ? !!options.reducedMotion : prefersReducedMotion();

    var canvas = document.createElement('canvas');
    canvas.className = 'pdm-canvas3d';
    canvas.setAttribute('aria-hidden', 'true');   // the drawn caption is the accessible text
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    var renderer;
    try {
      renderer = new T.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
    } catch (error) {
      console.warn('[PDDomey3D] no WebGL renderer', error);
      return null;
    }
    renderer.setClearAlpha(0);
    if (T.SRGBColorSpace) renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(30, 1, 0.1, 60);

    // Four lights — key, fill, rim, and a warm bounce — so skin reads as human
    // and the robes stay dimensional. Cheap enough for mid-range Android.
    var key = new T.DirectionalLight(0xfff1d9, 2.4);
    key.position.set(2.0, 3.6, 3.0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 14;
    key.shadow.camera.left = -2.4;
    key.shadow.camera.right = 2.4;
    key.shadow.camera.top = 3.4;
    key.shadow.camera.bottom = -1.4;
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    scene.add(key.target);

    var fill = new T.DirectionalLight(0xbcd6ff, 0.85);
    fill.position.set(-2.8, 1.6, 2.0);
    scene.add(fill);
    var rim = new T.DirectionalLight(0xffd98a, 1.3);
    rim.position.set(-1.6, 2.6, -3.0);
    scene.add(rim);
    var bounce = new T.DirectionalLight(0xd9b98a, 0.35);
    bounce.position.set(0, -1.2, 1.8);
    scene.add(bounce);
    scene.add(new T.HemisphereLight(0xc5dcff, 0x0a2c55, 0.50));
    scene.add(new T.AmbientLight(0xffffff, 0.18));

    var floor = new T.Mesh(new T.CircleGeometry(1.8, 56), new T.ShadowMaterial({ opacity: 0.34 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.70;
    floor.receiveShadow = true;
    scene.add(floor);

    var ring = new T.Mesh(
      new T.TorusGeometry(1.15, 0.014, 8, 80),
      new T.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.6, emissive: 0x3a2c05, emissiveIntensity: 0.55 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.685;
    scene.add(ring);

    var rig = options.rig || buildRig(T, options);
    scene.add(rig.root);

    container.appendChild(canvas);

    /* Keep the whole character in frame whatever the stage shape.
       Full-body framing: camera shows head to feet (Domey now has legs!). */
    var FIT_HEIGHT = 2.85;
    var FIT_WIDTH = 1.95;
    var TARGET_Y = 0.78;
    function fit() {
      var width = Math.max(1, container.clientWidth || canvas.clientWidth || 320);
      var height = Math.max(1, container.clientHeight || canvas.clientHeight || 380);
      camera.aspect = width / height;
      var fov = camera.fov * Math.PI / 180;
      var distanceV = (FIT_HEIGHT / 2) / Math.tan(fov / 2);
      var distanceH = (FIT_WIDTH / 2) / (Math.tan(fov / 2) * camera.aspect);
      var distance = Math.max(distanceV, distanceH) * 1.04;
      camera.position.set(0, TARGET_Y + 0.25, distance);
      camera.lookAt(0, TARGET_Y, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }
    fit();

    var running = true;
    var visible = true;
    var last = 0;
    var frame = 0;
    var contextLost = false;

    function onLost(event) {
      if (event && event.preventDefault) event.preventDefault();
      contextLost = true;
      if (typeof options.onContextLost === 'function') {
        try { options.onContextLost(); } catch (e) {}
      }
    }
    canvas.addEventListener('webglcontextlost', onLost, false);

    function step(now) {
      frame = 0;
      if (!running || contextLost) return;
      var time = typeof now === 'number' ? now : Date.now();
      var dt = last ? (time - last) / 1000 : 1 / 60;
      last = time;
      var signals = host ? hostSignals(host) : (options.signals ? options.signals() : {});
      signals.calm = signals.calm != null ? signals.calm : reduced;
      rig.update(dt, signals);
      ring.rotation.z += dt * 0.22;
      try {
        renderer.render(scene, camera);
      } catch (error) {
        console.warn('[PDDomey3D] render failed', error);
        api.stop();
        return;
      }
      schedule();
    }
    function schedule() {
      if (!running || contextLost) return;
      if (visible) frame = global.requestAnimationFrame(step);
    }
    function onVisibility() {
      if (!running) return;
      visible = !document.hidden;
      if (visible && !frame) schedule();
    }
    function onResize() { fit(); }

    var io = null;
    if (typeof global.IntersectionObserver === 'function') {
      io = new global.IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].target === container) {
            visible = entries[i].isIntersecting && !document.hidden;
            if (visible && !frame) schedule();
          }
        }
      }, { threshold: 0.05 });
      io.observe(container);
    }
    if (typeof global.addEventListener === 'function') global.addEventListener('resize', onResize);
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', onVisibility);
    }

    var api = {
      three: T,
      canvas: canvas,
      scene: scene,
      camera: camera,
      renderer: renderer,
      rig: rig,
      /** The element the canvas lives in (the host's .pdm-stage). */
      container: container,
      fit: fit,
      running: function () { return running && !contextLost; },
      start: function () {
        if (running && !contextLost) { if (!frame) schedule(); return api; }
        running = true;
        visible = !document.hidden;
        last = 0;
        if (!frame) schedule();
        return api;
      },
      stop: function () {
        running = false;
        if (frame && global.cancelAnimationFrame) { try { global.cancelAnimationFrame(frame); } catch (e) {} }
        frame = 0;
        return api;
      },
      dispose: function () {
        api.stop();
        try { canvas.removeEventListener('webglcontextlost', onLost); } catch (e) {}
        if (io) { try { io.disconnect(); } catch (e) {} io = null; }
        if (typeof global.removeEventListener === 'function') global.removeEventListener('resize', onResize);
        if (typeof document !== 'undefined' && document.removeEventListener) {
          document.removeEventListener('visibilitychange', onVisibility);
        }
        try { rig.dispose(); } catch (e) {}
        try { floor.geometry.dispose(); floor.material.dispose(); } catch (e) {}
        try { ring.geometry.dispose(); ring.material.dispose(); } catch (e) {}
        try { renderer.dispose(); } catch (e) {}
        try { if (renderer.forceContextLoss) renderer.forceContextLoss(); } catch (e) {}
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        return null;
      }
    };

    if (!contextLost) schedule();
    return api;
  }

  /* ------------------------------------------------------------------ export */

  global.PDDomey3D = {
    version: VERSION,
    threeRevision: THREE_REVISION,
    threeUrl: THREE_URL,
    visemes: VISEMES.slice(),
    actions: ACTIONS.slice(),
    states: STATES.slice(),
    visemeShapes: VISEME_SHAPES,
    actionPoses: ACTION_POSES,
    load: load,
    ready: ready,
    three: three,
    available: available,
    supportsWebGL: supportsWebGL,
    prefersReducedMotion: prefersReducedMotion,
    hostSignals: hostSignals,
    buildRig: buildRig,
    create: create
  };
})(typeof window !== 'undefined' ? window : this);
