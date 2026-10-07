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

    /* -------- palette, read from the brand: blue robe, gold trim, warm skin */
    var SKIN = M(new THREE.MeshStandardMaterial({ color: 0xf3c69c, roughness: 0.62, metalness: 0 }));
    var SKIN_DEEP = M(new THREE.MeshStandardMaterial({ color: 0xe0a878, roughness: 0.66, metalness: 0 }));
    var ROBE = M(new THREE.MeshStandardMaterial({ color: 0x1157ab, roughness: 0.58, metalness: 0.04 }));
    var ROBE_DARK = M(new THREE.MeshStandardMaterial({ color: 0x0b3f80, roughness: 0.6, metalness: 0.04 }));
    var GOLD = M(new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.34, metalness: 0.55, emissive: 0x3a2c05, emissiveIntensity: 0.5 }));
    var HAIR = M(new THREE.MeshStandardMaterial({ color: 0x2a1912, roughness: 0.72, metalness: 0 }));
    var EYE_WHITE = M(new THREE.MeshStandardMaterial({ color: 0xfbfbfb, roughness: 0.28, metalness: 0 }));
    var IRIS = M(new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.32, metalness: 0.05 }));
    var PUPIL = M(new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.3, metalness: 0 }));
    var GLINT = M(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    var MOUTH = M(new THREE.MeshStandardMaterial({ color: 0x621c22, roughness: 0.7, metalness: 0 }));
    var LIP = M(new THREE.MeshStandardMaterial({ color: 0xb4615c, roughness: 0.6, metalness: 0 }));
    var TEETH = M(new THREE.MeshStandardMaterial({ color: 0xfdfdfa, roughness: 0.3, metalness: 0 }));
    var TONGUE = M(new THREE.MeshStandardMaterial({ color: 0xc35a63, roughness: 0.55, metalness: 0 }));
    var CHEEK = M(new THREE.MeshStandardMaterial({ color: 0xe07f68, roughness: 0.8, transparent: true, opacity: 0.32 }));
    var BOOK = M(new THREE.MeshStandardMaterial({ color: 0x8d3a33, roughness: 0.6, metalness: 0.06 }));
    var PAGES = M(new THREE.MeshStandardMaterial({ color: 0xf7f0e2, roughness: 0.85, metalness: 0 }));
    var MIC = M(new THREE.MeshStandardMaterial({ color: 0x1b2740, roughness: 0.45, metalness: 0.3 }));
    var SPARK = M(new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 }));

    var rig = { THREE: THREE, version: VERSION };
    var root = group(THREE, null);
    rig.root = root;

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

    part(THREE, figure, G(new THREE.CapsuleGeometry(0.10, 0.10, 6, 16)), SKIN, [0, 1.24, 0]);
    part(THREE, figure, G(new THREE.SphereGeometry(0.20, 22, 16)), ROBE, [0.46, 1.12, 0]);
    part(THREE, figure, G(new THREE.SphereGeometry(0.20, 22, 16)), ROBE, [-0.46, 1.12, 0]);
    part(THREE, figure, G(new THREE.SphereGeometry(0.15, 18, 12)), ROBE_DARK, [0.17, 0.09, 0.05], null, [1.15, 0.55, 1.5]);
    part(THREE, figure, G(new THREE.SphereGeometry(0.15, 18, 12)), ROBE_DARK, [-0.17, 0.09, 0.05], null, [1.15, 0.55, 1.5]);

    /* --------------------------------------------------------------- arms */
    var REST_ARM = 0.17;
    function buildArm(side) {
      var s = side === 'R' ? 1 : -1;
      var shoulder = group(THREE, figure, [s * 0.46, 1.12, 0]);
      shoulder.rotation.z = s * REST_ARM;
      part(THREE, shoulder, G(new THREE.CapsuleGeometry(0.115, 0.30, 8, 18)), ROBE, [0, -0.24, 0]);
      part(THREE, shoulder, G(new THREE.TorusGeometry(0.125, 0.028, 8, 20)), GOLD,
        [0, -0.52, 0], [Math.PI / 2, 0, 0]);
      var hand = part(THREE, shoulder, G(new THREE.SphereGeometry(0.135, 20, 14)), SKIN,
        [0, -0.66, 0.02], null, [1, 0.95, 1]);
      return { root: shoulder, hand: hand, side: side, sign: s };
    }
    var armR = buildArm('R');
    var armL = buildArm('L');
    rig.arms = { R: armR, L: armL };

    // The Bible in his right hand — the same prop the 2D character holds.
    var bible = group(THREE, armR.root, [0.02, -0.72, 0.13]);
    bible.rotation.set(-0.25, 0, 0.12);
    part(THREE, bible, G(new THREE.BoxGeometry(0.30, 0.055, 0.22)), BOOK);
    part(THREE, bible, G(new THREE.BoxGeometry(0.275, 0.035, 0.205)), PAGES, [0, 0.015, 0]);
    part(THREE, bible, G(new THREE.BoxGeometry(0.028, 0.02, 0.16)), GOLD, [0, 0.035, 0]);
    part(THREE, bible, G(new THREE.BoxGeometry(0.10, 0.02, 0.028)), GOLD, [0, 0.035, 0.02]);
    rig.bible = bible;

    // The hand microphone: hidden until Domey listens.
    var mic = group(THREE, armL.root, [0, -0.72, 0.18]);
    mic.rotation.set(-0.5, 0, 0.25);
    part(THREE, mic, G(new THREE.CylinderGeometry(0.038, 0.045, 0.16, 16)), MIC);
    part(THREE, mic, G(new THREE.SphereGeometry(0.062, 18, 14)), MIC, [0, 0.11, 0]);
    part(THREE, mic, G(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 12)), GOLD, [0, -0.10, 0]);
    mic.visible = false;
    rig.mic = mic;

    /* --------------------------------------------------------------- head */
    var head = group(THREE, figure, [0, 1.42, 0]);
    rig.head = head;
    var skull = part(THREE, head, G(new THREE.SphereGeometry(0.42, 34, 26)), SKIN, null, null, [1, 1.05, 0.96]);
    rig.skull = skull;
    part(THREE, head, G(new THREE.SphereGeometry(0.105, 18, 14)), SKIN, [0.415, -0.02, 0], null, [0.45, 1, 0.78]);
    part(THREE, head, G(new THREE.SphereGeometry(0.105, 18, 14)), SKIN, [-0.415, -0.02, 0], null, [0.45, 1, 0.78]);
    part(THREE, head, G(new THREE.SphereGeometry(0.055, 16, 12)), SKIN_DEEP, [0, -0.02, 0.405], null, [0.85, 0.78, 0.9]);
    // Hair: a cap plus three fringe puffs, exactly the silhouette of the drawing.
    part(THREE, head, G(new THREE.SphereGeometry(0.435, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.54)), HAIR,
      [0, 0.02, -0.01], [-0.12, 0, 0], [1.02, 1, 1.02]);
    part(THREE, head, G(new THREE.SphereGeometry(0.15, 18, 14)), HAIR, [-0.17, 0.29, 0.31], null, [1, 0.85, 0.8]);
    part(THREE, head, G(new THREE.SphereGeometry(0.13, 18, 14)), HAIR, [0.02, 0.33, 0.30], null, [1, 0.8, 0.75]);
    part(THREE, head, G(new THREE.SphereGeometry(0.12, 18, 14)), HAIR, [0.20, 0.29, 0.29], null, [1, 0.85, 0.8]);

    var cheeks = [0.25, -0.25].map(function (x, index) {
      return part(THREE, head, G(new THREE.SphereGeometry(0.075, 16, 12)), CHEEK,
        [x, -0.06, 0.30], [-0.2, (index ? -1 : 1) * 0.25, 0], [1, 0.62, 0.3]);
    });
    rig.cheeks = cheeks;

    /* --------------------------------------------------------------- eyes */
    function buildEye(side) {
      var s = side === 'R' ? 1 : -1;
      var socket = group(THREE, head, [s * 0.165, 0.10, 0.368]);
      socket.rotation.x = -0.26;
      var eye = group(THREE, socket);
      part(THREE, eye, G(new THREE.SphereGeometry(0.105, 22, 16)), EYE_WHITE, null, null, [1, 1.02, 0.62]);
      part(THREE, eye, G(new THREE.SphereGeometry(0.052, 18, 14)), IRIS, [0, 0, 0.062]);
      part(THREE, eye, G(new THREE.SphereGeometry(0.027, 14, 12)), PUPIL, [0, 0, 0.088]);
      part(THREE, eye, G(new THREE.SphereGeometry(0.016, 10, 8)), GLINT, [0.024, 0.030, 0.094]);
      return { socket: socket, eye: eye };
    }
    var eyes = { R: buildEye('R'), L: buildEye('L') };
    rig.eyes = eyes;

    function buildBrow(side) {
      var s = side === 'R' ? 1 : -1;
      var brow = group(THREE, head, [s * 0.17, 0.255, 0.352]);
      brow.rotation.set(-0.34, 0, s * 0.12);
      part(THREE, brow, G(new THREE.CapsuleGeometry(0.018, 0.125, 6, 12)), HAIR, null, [0, 0, Math.PI / 2]);
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

      /* ---- eyes: blink, follow the member, widen when celebrating */
      state.blink.next -= step;
      if (state.blink.next <= 0) { state.blink.next = 1.8 + Math.random() * 3.4; state.blink.t = 0.16; }
      if (state.blink.t > 0) {
        state.blink.t -= step;
        state.blink.closed = clamp(state.blink.t / 0.08, 0, 1);
      } else {
        state.blink.closed = approach(state.blink.closed, 0, step, 0.05);
      }
      var surprise = state.state === 'celebrating' ? 1.12 : 1;
      state.look.x = approach(state.look.x, state.gaze.x * 0.045, step, 0.12);
      state.look.y = approach(state.look.y, -state.gaze.y * 0.03, step, 0.12);
      ['R', 'L'].forEach(function (key) {
        var eye = eyes[key];
        eye.eye.position.x = state.look.x;
        eye.eye.position.y = state.look.y;
        eye.eye.scale.set(1, surprise * (1 - state.blink.closed * 0.94), 1);
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

    // Three lights and a very soft floor: enough to read as a real person
    // standing on the stage, cheap enough for a phone.
    var key = new T.DirectionalLight(0xfff2d8, 2.2);
    key.position.set(1.9, 3.3, 2.7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -2;
    key.shadow.camera.right = 2;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    scene.add(key.target);

    var fill = new T.DirectionalLight(0xa9ccff, 0.7);
    fill.position.set(-2.6, 1.7, 1.8);
    scene.add(fill);
    var rim = new T.DirectionalLight(0xffd98a, 1.2);
    rim.position.set(-1.4, 2.4, -2.8);
    scene.add(rim);
    scene.add(new T.HemisphereLight(0xbcd8ff, 0x0a2c55, 0.55));

    var floor = new T.Mesh(new T.CircleGeometry(1.5, 48), new T.ShadowMaterial({ opacity: 0.32 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.001;
    floor.receiveShadow = true;
    scene.add(floor);

    var ring = new T.Mesh(
      new T.TorusGeometry(1.0, 0.016, 8, 72),
      new T.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.6, emissive: 0x3a2c05, emissiveIntensity: 0.6 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    scene.add(ring);

    var rig = options.rig || buildRig(T, options);
    scene.add(rig.root);

    container.appendChild(canvas);

    /* Keep the whole character in frame whatever the stage shape: the panel is
       taller than it is wide, the live lounge is wider than it is tall. */
    var FIT_HEIGHT = 2.12;
    var FIT_WIDTH = 1.72;
    function fit() {
      var width = Math.max(1, container.clientWidth || canvas.clientWidth || 320);
      var height = Math.max(1, container.clientHeight || canvas.clientHeight || 380);
      camera.aspect = width / height;
      var fov = camera.fov * Math.PI / 180;
      var distanceV = (FIT_HEIGHT / 2) / Math.tan(fov / 2);
      var distanceH = (FIT_WIDTH / 2) / (Math.tan(fov / 2) * camera.aspect);
      var distance = Math.max(distanceV, distanceH) * 1.04;
      camera.position.set(0, 1.02, distance);
      camera.lookAt(0, 0.99, 0);
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
