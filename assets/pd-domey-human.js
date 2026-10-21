/*!
 * Prayer Dome — Domey, the realistic three-dimensional Bible host
 * ===========================================================================
 * Domey is a rigged, licensed VRM 1.0 human character (VRM1_Constraint_Twist_
 * Sample, © 2022 pixiv Inc., VRM Public License 1.0 — free for commercial use,
 * modification and redistribution; see assets/domey/human/LICENSE.txt). She is
 * rendered with three.js r165 and @pixiv/three-vrm 3.5.5 (MIT, see
 * assets/vendor/three-vrm/LICENSE.txt). Both are vendored on this site: no
 * paid service, no API key, nothing fetched from a third party.
 *
 *   PDDomeyHuman.wanted()            -> boolean   is this a device/connection that should upgrade?
 *   PDDomeyHuman.load(THREE)         -> Promise<asset>   (rejects readably on any failure)
 *   PDDomeyHuman.buildRig(THREE, o)  -> rig       (the character below)
 *   PDDomeyHuman.FIT                 -> camera framing for the shared stage
 *
 * The rig is a drop-in for the same contract as the other Domey renderers in
 * this folder, so the mascot host can mount it without changing anything else:
 *   rig.update(dt, signals)   one frame: {viseme, jaw, act, state, gazeX, gazeY, calm}
 *   rig.setState(name) / setViseme(v, jaw) / look(x, y) / act(name) / react(name)
 *   rig.dispose()
 *
 * What she actually does, every frame:
 *   • breathes and shifts her weight (chest, spine, hips) instead of standing
 *     frozen between lines;
 *   • blinks on her own rhythm, with an occasional natural double blink;
 *   • looks at the member: her eyes follow a gaze target (VRM look-at) and her
 *     head and neck turn a fraction of the way with them, then return;
 *   • lip-syncs the visemes the mascot engine publishes (aa/ih/ou/ee/oh) with
 *     softly interpolated shapes and expression-driven smiles;
 *   • performs the host's gestures — wave, point, open, offer, clap, think,
 *     heart, raise, thumb, count, shrug, listen, pray, celebrate, dance — by
 *     blending normalised humanoid bones in and out of the idle pose, with the
 *     elbow, wrist and finger bones moving too (never one stiff arm);
 *   • holds a gentle expression for an encouraging (wrong answer) moment and a
 *     warm smile for a correct one, and blends between them;
 *   • honours `prefers-reduced-motion` (smaller, slower movement) and costs
 *     nothing on a page where it is not mounted.
 *
 * The model is loaded once and cached by the module; the mascot disposes the
 * rig when the member leaves the game, which gives the GPU buffers back.
 */
(function (global) {
  'use strict';

  var BUNDLE_URL = '/assets/vendor/three-vrm/three-vrm.bundle.js';
  var MODEL_URL = '/assets/domey/human/VRM1_Constraint_Twist_Sample.vrm';
  var LOAD_TIMEOUT_MS = 30000;
  var MOUTH_RATE = 16;     // how quickly mouth shapes move toward their target (per second)
  var BLINK_CLOSE = 0.07;  // seconds to close
  var BLINK_OPEN = 0.10;   // seconds to open
  var POSE_RATE = 5.5;     // bone blend speed (per second)
  var FACE_RATE = 5;       // expression blend speed (per second)

  /* Camera framing for the shared stage: head to feet, centred on the chest. */
  var FIT = { height: 1.86, width: 1.05, y: 0.93 };

  /* Viseme -> VRM mouth expression weights at full jaw opening. */
  var VISEME_SHAPE = {
    rest: {},
    M: { ou: 0.12 },
    F: { ih: 0.3 },
    L: { ee: 0.35 },
    E: { ee: 0.8 },
    I: { ih: 0.75 },
    A: { aa: 1 },
    O: { oh: 0.9 },
    U: { ou: 0.85 }
  };
  var MOUTH_NAMES = ['aa', 'ih', 'ou', 'ee', 'oh'];

  /* How she holds herself for each mood the host asks for. Values are VRM
   * expression weights, blended (never snapped) frame to frame. */
  var MOODS = {
    idle: { relaxed: 0.12 },
    speaking: { relaxed: 0.08 },
    listening: { relaxed: 0.16, surprised: 0.04 },
    thinking: { relaxed: 0.22 },
    happy: { happy: 0.55, relaxed: 0.06 },
    celebrating: { happy: 0.72 },
    encouraging: { sad: 0.20, relaxed: 0.18 },
    praying: { relaxed: 0.34 },
    sleeping: { relaxed: 0.30 }
  };

  /* Gesture poses, in radians, on the *normalised* humanoid bones three-vrm
   * provides (identity at rest, model facing +Z). The base standing pose has
   * already brought the arms down, so these are offsets from it. `beats` adds a
   * repeated motion (a wave, a clap, a dance) while the gesture is held. */
  var GESTURES = {
    wave: {
      rightShoulder: { z: -0.10 },
      rightUpperArm: { z: -0.95, x: 0.06 },
      rightLowerArm: { z: -1.15 },
      rightHand: { z: -0.12 },
      chest: { y: 0.07 }, head: { y: 0.09, z: -0.03 },
      beats: { bone: 'rightLowerArm', axis: 'z', amp: 0.22, hz: 3.2 }
    },
    point: {
      rightUpperArm: { z: -0.42, x: -0.55 },
      rightLowerArm: { x: -0.30 },
      rightHand: { x: -0.10 },
      chest: { y: 0.06 }, head: { y: 0.05 }
    },
    open: {
      leftUpperArm: { z: 0.16, x: -0.34 },
      rightUpperArm: { z: -0.16, x: -0.34 },
      leftLowerArm: { x: -0.24 }, rightLowerArm: { x: -0.24 },
      chest: { x: -0.03 }
    },
    offer: {
      leftUpperArm: { z: 0.10, x: -0.58 },
      leftLowerArm: { x: -0.72 },
      rightUpperArm: { z: -0.08, x: -0.46 },
      rightLowerArm: { x: -0.50 },
      chest: { x: 0.03 }, head: { x: -0.04 }
    },
    clap: {
      leftUpperArm: { z: 0.14, x: -0.48 },
      rightUpperArm: { z: -0.14, x: -0.48 },
      leftLowerArm: { y: -0.55, x: -0.55 },
      rightLowerArm: { y: 0.55, x: -0.55 },
      leftHand: { y: -0.25 }, rightHand: { y: 0.25 },
      chest: { x: -0.05 }, head: { x: -0.03 },
      beats: { bone: 'leftLowerArm', axis: 'y', amp: 0.16, hz: 2.6 }
    },
    think: {
      rightUpperArm: { z: 0.30, x: -0.55 },
      rightLowerArm: { x: -1.35, y: 0.35 },
      rightHand: { x: -0.20 },
      head: { x: 0.10, y: 0.10, z: 0.05 },
      chest: { x: 0.04 }
    },
    heart: {
      leftUpperArm: { z: 0.26, x: -0.70 },
      rightUpperArm: { z: -0.26, x: -0.70 },
      leftLowerArm: { x: -0.95, y: -0.35 },
      rightLowerArm: { x: -0.95, y: 0.35 },
      head: { x: -0.05 }, chest: { x: -0.04 }
    },
    raise: {
      leftUpperArm: { z: 1.05 }, rightUpperArm: { z: -1.05 },
      leftLowerArm: { z: 0.25 }, rightLowerArm: { z: -0.25 },
      head: { x: -0.10 }, chest: { x: -0.05 }
    },
    thumb: {
      rightUpperArm: { z: 0.20, x: -0.45 },
      rightLowerArm: { x: -0.95 },
      rightHand: { y: 0.25, z: -0.35 },
      head: { y: 0.05 }
    },
    count: {
      rightUpperArm: { z: -0.05, x: -0.50 },
      rightLowerArm: { x: -0.85 },
      rightHand: { z: -0.20 },
      head: { y: 0.06 },
      beats: { bone: 'rightHand', axis: 'z', amp: 0.14, hz: 1.6 }
    },
    shrug: {
      leftUpperArm: { z: 0.22, x: -0.10 },
      rightUpperArm: { z: -0.22, x: -0.10 },
      leftLowerArm: { y: -0.30, x: -0.30 },
      rightLowerArm: { y: 0.30, x: -0.30 },
      head: { x: 0.06, z: 0.06 }, chest: { x: 0.03 }
    },
    listen: {
      rightUpperArm: { z: -0.30, x: -0.35 },
      rightLowerArm: { x: -1.45, y: 0.30 },
      rightHand: { x: -0.15 },
      head: { z: 0.10, y: 0.06 }, chest: { x: -0.03 }
    },
    pray: {
      leftUpperArm: { z: 0.20, x: -0.62 },
      rightUpperArm: { z: -0.20, x: -0.62 },
      leftLowerArm: { x: -1.05, y: -0.30 },
      rightLowerArm: { x: -1.05, y: 0.30 },
      head: { x: 0.14 }, chest: { x: 0.05 }
    },
    celebrate: {
      leftUpperArm: { z: 1.25 }, rightUpperArm: { z: -1.25 },
      leftLowerArm: { z: 0.35 }, rightLowerArm: { z: -0.35 },
      head: { x: -0.12 },
      beats: { bone: 'chest', axis: 'x', amp: 0.05, hz: 2.2 }
    },
    dance: {
      leftUpperArm: { z: 0.75, x: -0.25 },
      rightUpperArm: { z: -0.55, x: -0.25 },
      leftLowerArm: { z: 0.45 }, rightLowerArm: { z: -0.45 },
      hips: { z: 0.06 },
      beats: { bone: 'hips', axis: 'y', amp: 0.10, hz: 1.7 }
    },
    nod: { head: { x: 0.10 } },
    smile: {}
  };

  /* The host's gesture vocabulary predates this rig (and the coded hostess has
     her own set), so a few names are aliases rather than new poses. */
  var GESTURE_ALIASES = {
    mic: 'listen',
    hand: 'offer',
    sparkle: 'open',
    star: 'raise',
    cheer: 'celebrate',
    jump: 'raise',
    happy: 'smile',
    wave2: 'wave'
  };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function num(v, fallback) { return typeof v === 'number' && isFinite(v) ? v : fallback; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  /* ----------------------------------------------------------- device check */

  /** Low-end Android (or a device that reports little memory or few cores). */
  function isLowEnd() {
    var nav = global.navigator || {};
    var ua = String(nav.userAgent || '');
    var android = /Android/i.test(ua);
    var lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 3;
    var fewCores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4;
    return !!(android && (lowMemory || fewCores)) || !!(lowMemory && fewCores);
  }

  function prefersReducedMotion() {
    try {
      return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  /**
   * Should this visit upgrade to the realistic model?
   *
   * She is a 10 MB download with high-resolution textures, so she is loaded only
   * where the device and the connection can afford her. Everything else keeps
   * the instantly-built Domey in royal blue and gold (pd-domey-lady.js) — the
   * game stays playable, just less photoreal.
   */
  function wanted() {
    if (isLowEnd()) return false;
    var nav = global.navigator || {};
    var connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (connection) {
      if (connection.saveData === true) return false;
      if (/^(slow-2g|2g|3g)$/i.test(String(connection.effectiveType || ''))) return false;
    }
    return true;
  }

  /* ---------------------------------------------------------------- loading */

  var bundlePromise = null;
  var assetPromise = null;

  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error(label + ' took too long to load.')); }, ms);
      promise.then(function (value) { clearTimeout(timer); resolve(value); },
        function (error) { clearTimeout(timer); reject(error); });
    });
  }

  function loadBundle() {
    if (!bundlePromise) {
      bundlePromise = import(BUNDLE_URL).catch(function (error) {
        bundlePromise = null;
        throw new Error('The character library could not be downloaded (' + (error && error.message || 'network') + ').');
      });
    }
    return bundlePromise;
  }

  /**
   * Load the VRM once and keep it. Rejects with a readable message on any failure,
   * so the caller can fall back to the character built in code.
   */
  function load(THREE) {
    if (!THREE) return Promise.reject(new Error('three.js is not loaded.'));
    if (!assetPromise) {
      assetPromise = withTimeout(loadBundle().then(function (lib) {
        return new Promise(function (resolve, reject) {
          var loader = new lib.GLTFLoader();
          loader.register(function (parser) { return new lib.VRMLoaderPlugin(parser); });
          loader.load(MODEL_URL, resolve, undefined, function (error) {
            reject(new Error('The character model could not be downloaded (' + (error && error.message || 'network') + ').'));
          });
        }).then(function (gltf) {
          var vrm = gltf.userData && gltf.userData.vrm;
          if (!vrm) throw new Error('The character file is not a VRM model.');
          // VRM 1.0 models look down -Z in glTF; three-vrm rotates them to face
          // the camera. Asking the library to do it keeps the light rig and the
          // gaze target in the same space as every other rig.
          if (lib.VRMUtils && lib.VRMUtils.rotateVRM0) { try { lib.VRMUtils.rotateVRM0(vrm); } catch (e) {} }
          return { vrm: vrm, lib: lib, THREE: THREE };
        });
      }), LOAD_TIMEOUT_MS, 'The character').catch(function (error) {
        assetPromise = null;
        throw error;
      });
    }
    return assetPromise;
  }

  /** Release the cached model (tests and a "light mode" switch can call this). */
  function unload() {
    assetPromise = null;
    bundlePromise = null;
  }
  /* --------------------------------------------------------------- the rig */

  /**
   * Build a live, animated human rig from a loaded VRM.
   *
   * options: { asset, reducedMotion, lowEnd }
   * Returns the shared rig contract used by every Domey renderer.
   */
  function buildRig(T, options) {
    options = options || {};
    var asset = options.asset;
    if (!asset || !asset.vrm) throw new Error('buildRig needs a loaded VRM asset.');
    var vrm = asset.vrm;
    var calm = options.reducedMotion != null ? !!options.reducedMotion : prefersReducedMotion();
    var amp = calm ? 0.45 : 1;
    var rate = calm ? 0.65 : 1;

    var root = new T.Group();
    root.name = 'pd-domey-human';
    root.add(vrm.scene);
    vrm.scene.rotation.y = 0;          // VRM 1.0 faces +Z, the same way the camera looks

    /* The eyes follow this point; the head turns a fraction of the way with it,
       which is how a real person looks at someone instead of swivelling. */
    var gazeTarget = new T.Object3D();
    gazeTarget.position.set(0, 1.45, 1.7);
    root.add(gazeTarget);
    if (vrm.lookAt) {
      vrm.lookAt.target = gazeTarget;
      vrm.lookAt.autoUpdate = true;
    }

    var humanoid = vrm.humanoid;
    var BONE_NAMES = [
      'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
      'leftShoulder', 'rightShoulder',
      'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm',
      'leftHand', 'rightHand',
      'leftUpperLeg', 'rightUpperLeg'
    ];
    var bones = {};
    var rest = {};
    BONE_NAMES.forEach(function (name) {
      var node = humanoid && humanoid.getNormalizedBoneNode ? humanoid.getNormalizedBoneNode(name) : null;
      if (node) { bones[name] = node; rest[name] = node.quaternion.clone(); }
    });

    /* A VRM is authored in a T-pose. Bring the arms down to a natural standing
       pose once, and treat that as "rest" for everything below: every gesture
       is then a small offset from a posture that already looks like a person. */
    var armDrop = 1.28;
    ['leftUpperArm', 'rightUpperArm'].forEach(function (name) {
      var node = bones[name];
      if (!node) return;
      var side = name.indexOf('left') === 0 ? 1 : -1;
      var drop = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), -side * armDrop);
      node.quaternion.premultiply(drop);
      rest[name] = node.quaternion.clone();
    });
    [['leftLowerArm', 1], ['rightLowerArm', -1]].forEach(function (pair) {
      var node = bones[pair[0]];
      if (!node) return;
      // A soft, slightly bent elbow: straight arms hanging like a mannequin's
      // are one of the things that reads as "not human".
      var bend = new T.Quaternion().setFromEuler(new T.Euler(-0.10, pair[1] * 0.06, 0, 'YXZ'));
      node.quaternion.multiply(bend);
      rest[pair[0]] = node.quaternion.clone();
    });
    ['leftHand', 'rightHand'].forEach(function (name) {
      var node = bones[name];
      if (!node) return;
      node.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(-0.05, 0, 0, 'YXZ')));
      rest[name] = node.quaternion.clone();
    });

    var expr = vrm.expressionManager;
    var EXPRESSION_NAMES = ['blink', 'blinkLeft', 'blinkRight', 'happy', 'sad', 'relaxed', 'surprised', 'angry',
      'aa', 'ih', 'ou', 'ee', 'oh'];
    var hasExpr = {};
    EXPRESSION_NAMES.forEach(function (name) {
      hasExpr[name] = !!(expr && expr.getExpression && expr.getExpression(name));
    });

    var state = {
      time: 0,
      mode: 'idle',
      speaking: 0,
      viseme: 'rest',
      jaw: 0,
      gazeX: 0,
      gazeY: 0,
      mood: 'idle',
      mouth: { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 },
      face: {},
      blinkWait: 1.2 + Math.random() * 1.8,
      blinkT: -1,
      blinkDouble: 0,
      saccade: { x: 0, y: 0, wait: 1.5 },
      gesture: null,
      lastGesture: null,
      lastSignalAct: null,
      headYaw: 0, headPitch: 0, headRoll: 0
    };

    /* Start every face channel at its idle value so the first frame is not a
       visible jump from a blank expression. */
    EXPRESSION_NAMES.forEach(function (name) { state.face[name] = 0; });
    Object.keys(MOODS.idle).forEach(function (name) { state.face[name] = MOODS.idle[name]; });

    function setExpression(name, value) {
      if (!hasExpr[name]) return;
      try { expr.setValue(name, clamp(value, 0, 1)); } catch (e) { /* older library */ }
    }

    /* Scratch objects: the animation loop runs 60 times a second on a phone,
       so it must not allocate a quaternion per bone per frame. */
    var scratchEuler = new T.Euler(0, 0, 0, 'YXZ');
    var scratchQuat = new T.Quaternion();
    var scratchTarget = new T.Quaternion();
    var scratchVec = new T.Vector3();
    function poseQuat(x, y, z, out) {
      scratchEuler.set(x || 0, y || 0, z || 0, 'YXZ');
      return (out || scratchQuat).setFromEuler(scratchEuler);
    }

    /* ---------------------------------------------------------- expressions */

    function applyFace(dt) {
      var mood = MOODS[state.mood] || MOODS.idle;
      var k = Math.min(1, dt * FACE_RATE);
      EXPRESSION_NAMES.forEach(function (name) {
        if (MOUTH_NAMES.indexOf(name) > -1 || name === 'blink' || name === 'blinkLeft' || name === 'blinkRight') return;
        var target = mood[name] || 0;
        state.face[name] += (target - state.face[name]) * k;
        setExpression(name, state.face[name]);
      });
    }

    function applyMouth(dt) {
      var target = {};
      MOUTH_NAMES.forEach(function (n) { target[n] = 0; });
      var shape = VISEME_SHAPE[state.viseme] || {};
      var jaw = clamp(state.jaw, 0, 1.15);
      Object.keys(shape).forEach(function (n) { target[n] = shape[n] * jaw; });
      var k = Math.min(1, dt * MOUTH_RATE);
      MOUTH_NAMES.forEach(function (n) {
        state.mouth[n] += (target[n] - state.mouth[n]) * k;
        setExpression(n, state.mouth[n]);
      });
    }

    function applyBlink(dt) {
      if (!hasExpr.blink) return;
      if (state.blinkT < 0) {
        state.blinkWait -= dt;
        if (state.blinkWait <= 0) {
          state.blinkT = 0;
          // One in four blinks is a double blink, the way people really blink.
          state.blinkDouble = Math.random() < 0.25 ? 1 : 0;
        }
        setExpression('blink', 0);
        return;
      }
      state.blinkT += dt;
      var close = BLINK_CLOSE / rate;
      var open = BLINK_OPEN / rate;
      var v;
      if (state.blinkT < close) v = state.blinkT / close;
      else if (state.blinkT < close + open) v = 1 - (state.blinkT - close) / open;
      else {
        v = 0;
        state.blinkT = -1;
        if (state.blinkDouble) {
          state.blinkDouble = 0;
          state.blinkWait = 0.22;
        } else {
          state.blinkWait = (2.1 + Math.random() * 3.1) / rate;
        }
      }
      setExpression('blink', v);
    }

    /* -------------------------------------------------------------- gestures */

    var ATTACK = 0.38;
    var RELEASE = 0.55;

    function gestureWeight() {
      var g = state.gesture;
      if (!g) return 0;
      var w = 1;
      if (g.age < ATTACK) w = smooth(g.age / ATTACK);
      var remain = g.dur - g.age;
      if (remain < RELEASE) w *= smooth(remain / RELEASE);
      return clamp(w, 0, 1);
    }

    function gestureOffset(name, weight, t) {
      var pose = GESTURES[name];
      if (!pose) return null;
      var out = {};
      Object.keys(pose).forEach(function (bone) {
        if (bone === 'beats' || bone === 'head') return;
        var e = pose[bone];
        out[bone] = { x: (e.x || 0) * weight, y: (e.y || 0) * weight, z: (e.z || 0) * weight };
      });
      if (pose.beats) {
        var b = pose.beats;
        var beat = Math.sin(t * Math.PI * 2 * b.hz) * b.amp * weight;
        var entry = out[b.bone] || (out[b.bone] = { x: 0, y: 0, z: 0 });
        entry[b.axis] = (entry[b.axis] || 0) + beat;
      }
      return out;
    }

    /* ------------------------------------------------------------------ frame */

    function applyPose(dt) {
      var t = state.time;
      var speakingTarget = state.viseme !== 'rest' ? 1 : 0;
      state.speaking += (speakingTarget - state.speaking) * Math.min(1, dt * 6);

      // Blink-driven and gaze-driven head motion is shared by neck and head, so
      // the neck takes a third of the turn and the head the rest.
      var yaw = (state.gazeX * 0.20 + state.saccade.x * 0.05 + Math.sin(t * 0.52) * 0.024) * amp;
      var pitch = (-state.gazeY * 0.13 + state.saccade.y * 0.03 + Math.sin(t * 0.41 + 1.2) * 0.018
        + state.speaking * Math.sin(t * 8.4) * 0.012) * amp;
      var roll = (Math.sin(t * 0.31) * 0.014 - state.gazeX * 0.03) * amp;
      state.headYaw += (yaw - state.headYaw) * Math.min(1, dt * 4.5);
      state.headPitch += (pitch - state.headPitch) * Math.min(1, dt * 4.5);
      state.headRoll += (roll - state.headRoll) * Math.min(1, dt * 4.5);

      var breathe = Math.sin(t * 1.35) * 0.013 * amp;
      var weight = gestureWeight();
      var gesture = weight > 0 ? gestureOffset(state.gesture.name, weight, t) : null;

      function offsetFor(name) {
        var o = gesture && gesture[name];
        return o || { x: 0, y: 0, z: 0 };
      }

      var targets = {
        neck: { x: state.headPitch * 0.38, y: state.headYaw * 0.38, z: state.headRoll * 0.45 },
        head: { x: state.headPitch * 0.62, y: state.headYaw * 0.62, z: state.headRoll * 0.55 },
        chest: { x: breathe + Math.sin(t * 0.44) * 0.008 * amp, y: Math.sin(t * 0.47) * 0.014 * amp, z: 0 },
        upperChest: { x: breathe * 0.6, y: Math.sin(t * 0.47 + 0.4) * 0.012 * amp, z: 0 },
        spine: { x: breathe * 0.4, y: Math.sin(t * 0.44 + 0.8) * 0.016 * amp, z: Math.sin(t * 0.38) * 0.01 * amp },
        hips: { x: 0, y: Math.sin(t * 0.44) * 0.02 * amp, z: Math.sin(t * 0.44 + 0.8) * 0.012 * amp },
        leftShoulder: { x: 0, y: 0, z: breathe * 0.5 },
        rightShoulder: { x: 0, y: 0, z: -breathe * 0.5 },
        // A quiet arm sway keeps the silhouette alive between gestures.
        leftUpperArm: { x: Math.sin(t * 0.6 + 0.4) * 0.014 * amp, y: 0, z: 0 },
        rightUpperArm: { x: Math.sin(t * 0.6 + 1.9) * 0.014 * amp, y: 0, z: 0 },
        leftLowerArm: { x: 0, y: 0, z: 0 },
        rightLowerArm: { x: 0, y: 0, z: 0 },
        leftHand: { x: Math.sin(t * 0.5) * 0.01 * amp, y: 0, z: 0 },
        rightHand: { x: Math.sin(t * 0.5 + 1) * 0.01 * amp, y: 0, z: 0 },
        leftUpperLeg: { x: 0, y: 0, z: 0 },
        rightUpperLeg: { x: 0, y: 0, z: 0 }
      };

      // The gesture's own head direction (a nod, a tilt) rides on top.
      if (gesture && GESTURES[state.gesture.name] && GESTURES[state.gesture.name].head && weight > 0) {
        var h = GESTURES[state.gesture.name].head;
        targets.head.x += (h.x || 0) * weight;
        targets.head.y += (h.y || 0) * weight;
        targets.head.z += (h.z || 0) * weight;
      }

      var blend = Math.min(1, dt * POSE_RATE);
      Object.keys(targets).forEach(function (name) {
        var node = bones[name];
        if (!node) return;
        var base = targets[name];
        var add = offsetFor(name);
        scratchTarget.copy(rest[name]);
        scratchTarget.multiply(poseQuat(base.x + add.x, base.y + add.y, base.z + add.z, scratchQuat));
        node.quaternion.slerp(scratchTarget, blend);
      });

      // Eyes: the member's position, plus small saccades so the gaze is alive.
      state.saccade.wait -= dt;
      if (state.saccade.wait <= 0) {
        state.saccade.x = (Math.random() - 0.5) * 0.55;
        state.saccade.y = (Math.random() - 0.5) * 0.30;
        state.saccade.wait = 1.4 + Math.random() * 2.8;
      }
      var tx = state.gazeX * 0.55 + state.saccade.x * 0.20;
      var ty = 1.45 + state.gazeY * 0.22 + state.saccade.y * 0.10;
      gazeTarget.position.x += ((tx * 0.8) - gazeTarget.position.x) * Math.min(1, dt * 6);
      gazeTarget.position.y += (ty - gazeTarget.position.y) * Math.min(1, dt * 6);
      gazeTarget.position.z = 1.7;
    }

    var rig = {
      THREE: T,
      version: 'human-2',
      root: root,
      vrm: vrm,
      fit: FIT,
      neutralPose: {},
      /** One animation step. `signals` may carry any subset of the host state. */
      update: function (dt, signals) {
        signals = signals || {};
        var step = clamp(num(dt, 1 / 60), 0.001, 0.1);
        state.time += step * rate;
        if (signals.state && signals.state !== state.mode) rig.setState(signals.state);
        if ('viseme' in signals || 'jaw' in signals) rig.setViseme(signals.viseme, signals.jaw);
        if ('gazeX' in signals || 'gazeY' in signals) rig.look(signals.gazeX, signals.gazeY);
        if (signals.act !== state.lastSignalAct) {
          // The host publishes an action and then clears it; tracking the raw
          // signal means the same gesture can be played again later.
          state.lastSignalAct = signals.act || null;
          if (signals.act) rig.act(signals.act);
        }
        if (state.gesture) {
          state.gesture.age += step;
          if (state.gesture.age >= state.gesture.dur) {
            state.gesture = null;
            state.lastGesture = null;
          }
        }
        applyBlink(step);
        applyFace(step);
        applyMouth(step);
        applyPose(step);
        if (vrm.update) vrm.update(step);
        return rig;
      },
      setState: function (name) {
        state.mode = name || 'idle';
        // The host's state names are also the mood names for the face.
        state.mood = MOODS[state.mode] ? state.mode : 'idle';
        return rig;
      },
      setMood: function (name) {
        state.mood = MOODS[name] ? name : 'idle';
        return rig;
      },
      setViseme: function (viseme, jaw) {
        state.viseme = VISEME_SHAPE[viseme] ? viseme : 'rest';
        state.jaw = clamp(num(jaw, 0), 0, 1.15);
        return rig;
      },
      look: function (x, y) {
        state.gazeX = clamp(num(x, 0), -1, 1);
        state.gazeY = clamp(num(y, 0), -1, 1);
        return rig;
      },
      /**
       * Play a gesture. `ms` is how long it is held; the pose eases in and out
       * so repeated taps never snap the body.
       */
      act: function (name, ms) {
        var pose = GESTURE_ALIASES[name] || name;
        if (!pose || !GESTURES[pose]) return rig;
        var dur = Math.max(0.4, num(ms, 1600) / 1000);
        // Re-triggering the same gesture restarts it, so a double tap on
        // "Say again" visibly re-plays the movement instead of doing nothing.
        state.gesture = { name: pose, age: 0, dur: dur };
        state.lastGesture = pose;
        return rig;
      },
      react: function (name, ms) { return rig.act(name, ms); },
      /** Read-only state, used by the tests and by the game's host chip. */
      snapshot: function () {
        return {
          mood: state.mood,
          viseme: state.viseme,
          gesture: state.gesture ? state.gesture.name : null,
          weight: gestureWeight(),
          bone: function (name) { return bones[name] ? bones[name].quaternion.toArray() : null; }
        };
      },
      dispose: function () {
        state.gesture = null;
        try { root.remove(vrm.scene); } catch (e) {}
        if (root.parent) root.parent.remove(root);
        return null;
      }
    };
    return rig;
  }

  global.PDDomeyHuman = {
    load: load,
    unload: unload,
    buildRig: buildRig,
    wanted: wanted,
    isLowEnd: isLowEnd,
    prefersReducedMotion: prefersReducedMotion,
    FIT: FIT,
    GESTURES: GESTURES,
    MOODS: MOODS,
    LICENSE: 'VRM1_Constraint_Twist_Sample by pixiv Inc., VRM Public License 1.0 (free, commercial use allowed); three-vrm MIT; three.js MIT',
    version: 'human-2'
  };
})(typeof window !== 'undefined' ? window : this);
