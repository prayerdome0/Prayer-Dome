/*!
 * Prayer Dome — stylised cartoon human host for the "Talk with Domey" game.
 *
 * A VRM 1.0 avatar (VRM1_Constraint_Twist_Sample.vrm, pixiv Inc., VRM Public
 * License 1.0, see assets/domey/human/LICENSE.txt) rendered with three.js r165
 * and @pixiv/three-vrm 3.5.5 (MIT, see assets/vendor/three-vrm/LICENSE.txt).
 * Everything is vendored on this site: no paid service, key or subscription.
 *
 * It plugs into the same host contract as the other 3D rigs in this folder:
 *   PDDomeyHuman.load(THREE)        -> Promise<asset>   (rejects on any failure)
 *   PDDomeyHuman.buildRig(THREE, o) -> rig              (update / setViseme / look / act / dispose)
 *   PDDomeyHuman.isLowEnd()         -> boolean          (low-end Android: use the 2D drawing)
 *
 * What the character does, all from the host's signals:
 *   - blinks on its own timer (VRM "blink" expression, eyes shut for ~0.16 s)
 *   - lip-syncs with the visemes the mascot already produces while it speaks
 *     (A, E, I, O, U and softer M/F/L shapes, scaled by the jaw amount)
 *   - looks at the child with its eyes (VRM look-at) and turns its head with the gaze
 *   - breathes, sways and nods (head, neck, spine and hips bones)
 *   - reacts to gestures (`act`) with a small nod
 */
(function (global) {
  'use strict';

  var BUNDLE_URL = '/assets/vendor/three-vrm/three-vrm.bundle.js';
  var MODEL_URL = '/assets/domey/human/VRM1_Constraint_Twist_Sample.vrm';
  var LOAD_TIMEOUT_MS = 30000;
  var MOUTH_RATE = 16;     // how quickly mouth shapes move toward their target (per second)
  var BLINK_CLOSE = 0.07;  // seconds to close
  var BLINK_OPEN = 0.09;   // seconds to open

  // Viseme -> VRM mouth expression weights at full jaw opening.
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

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function num(v, fallback) { return typeof v === 'number' && isFinite(v) ? v : fallback; }

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
   * so the caller can fall back to the 2D drawing.
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
          return { vrm: vrm, lib: lib, THREE: THREE };
        });
      }), LOAD_TIMEOUT_MS, 'The character').catch(function (error) {
        assetPromise = null;
        throw error;
      });
    }
    return assetPromise;
  }

  /* --------------------------------------------------------------- the rig */

  function buildRig(T, options) {
    options = options || {};
    var asset = options.asset;
    if (!asset || !asset.vrm) throw new Error('buildRig needs a loaded VRM asset.');
    var vrm = asset.vrm;
    var lib = asset.lib;
    var lowEnd = !!options.lowEnd;
    var calmMotion = !!options.reducedMotion;

    var root = new T.Group();
    root.name = 'pd-domey-human';
    root.add(vrm.scene);
    // VRM 1.0 models face +Z, the same way the game camera looks.
    vrm.scene.rotation.y = 0;

    // Gaze target the eyes follow (a point just in front of the child).
    var gazeTarget = new T.Object3D();
    gazeTarget.position.set(0, 1.42, 1.6);
    root.add(gazeTarget);
    if (vrm.lookAt) vrm.lookAt.target = gazeTarget;

    var humanoid = vrm.humanoid;
    var bones = {};
    var rest = {};
    ['head', 'neck', 'chest', 'spine', 'hips', 'leftUpperArm', 'rightUpperArm'].forEach(function (name) {
      var node = humanoid && humanoid.getNormalizedBoneNode ? humanoid.getNormalizedBoneNode(name) : null;
      if (node) { bones[name] = node; rest[name] = node.quaternion.clone(); }
    });

    // Drop the arms when the model is posed in a T-pose, so it stands naturally.
    var armDrop = 0;
    if (bones.leftUpperArm && humanoid.getNormalizedBoneNode('leftLowerArm')) {
      vrm.scene.updateMatrixWorld(true);
      var a = new T.Vector3(), b = new T.Vector3();
      bones.leftUpperArm.getWorldPosition(a);
      humanoid.getNormalizedBoneNode('leftLowerArm').getWorldPosition(b);
      // A T-pose has the upper arm running sideways: the arm's own length is mostly along x.
      if (Math.abs(b.x - a.x) > Math.abs(b.y - a.y)) armDrop = 1.25;
    }
    if (armDrop) {
      ['leftUpperArm', 'rightUpperArm'].forEach(function (name) {
        var node = humanoid.getNormalizedBoneNode(name);
        if (!node) return;
        var side = name.indexOf('left') === 0 ? 1 : -1;
        var q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), -side * armDrop);
        node.quaternion.premultiply(q);
        rest[name] = node.quaternion.clone();
      });
    }

    var expr = vrm.expressionManager;
    var hasExpr = {};
    ['blink', 'aa', 'ih', 'ou', 'ee', 'oh', 'happy'].forEach(function (name) {
      hasExpr[name] = !!(expr && expr.getExpression && expr.getExpression(name));
    });

    var state = {
      time: 0,
      mode: 'idle',
      viseme: 'rest',
      jaw: 0,
      gazeX: 0,
      gazeY: 0,
      lastAct: null,
      actAge: 9,
      speaking: 0,
      blinkWait: 1.5 + Math.random() * 2,
      blinkT: -1,
      mouth: { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 },
      headYaw: 0,
      headPitch: 0,
      headRoll: 0
    };
    var amp = calmMotion ? 0.4 : 1;

    function setBone(name, yaw, pitch, roll) {
      var node = bones[name];
      if (!node) return;
      var q = new T.Quaternion().setFromEuler(new T.Euler(pitch, yaw, roll, 'YXZ'));
      node.quaternion.copy(rest[name]).multiply(q);
    }

    function setExpression(name, value) {
      if (!hasExpr[name]) return;
      expr.setValue(name, clamp(value, 0, 1));
    }

    function applyMouth(dt) {
      var target = {};
      MOUTH_NAMES.forEach(function (n) { target[n] = 0; });
      var shape = VISEME_SHAPE[state.viseme] || {};
      var jaw = clamp(state.jaw, 0, 1.2);
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
        if (state.blinkWait <= 0) state.blinkT = 0;
        setExpression('blink', 0);
        return;
      }
      state.blinkT += dt;
      var v;
      if (state.blinkT < BLINK_CLOSE) v = state.blinkT / BLINK_CLOSE;
      else if (state.blinkT < BLINK_CLOSE + BLINK_OPEN) v = 1 - (state.blinkT - BLINK_CLOSE) / BLINK_OPEN;
      else {
        v = 0;
        state.blinkT = -1;
        state.blinkWait = 2.2 + Math.random() * 3.2;
      }
      setExpression('blink', v);
    }

    function applyPose(dt) {
      var t = state.time;
      var speakingTarget = state.viseme !== 'rest' ? 1 : 0;
      state.speaking += (speakingTarget - state.speaking) * Math.min(1, dt * 6);
      var nod = state.actAge < 0.9 ? Math.sin(state.actAge / 0.9 * Math.PI) * 0.12 : 0;
      var yaw = state.gazeX * 0.22 * amp + Math.sin(t * 0.55) * 0.04 * amp;
      var pitch = -state.gazeY * 0.16 * amp + Math.sin(t * 0.4 + 1.3) * 0.025 * amp
        + state.speaking * Math.sin(t * 9) * 0.02 * amp - nod;
      var roll = Math.sin(t * 0.33) * 0.02 * amp + state.gazeX * -0.04 * amp;
      state.headYaw += (yaw - state.headYaw) * Math.min(1, dt * 5);
      state.headPitch += (pitch - state.headPitch) * Math.min(1, dt * 5);
      state.headRoll += (roll - state.headRoll) * Math.min(1, dt * 5);
      setBone('neck', state.headYaw * 0.4, state.headPitch * 0.35, state.headRoll * 0.5);
      setBone('head', state.headYaw * 0.6, state.headPitch * 0.65, state.headRoll * 0.5);
      var breath = Math.sin(t * 1.5) * 0.012 * amp;
      setBone('chest', 0, breath, 0);
      setBone('spine', Math.sin(t * 0.5) * 0.02 * amp, breath * 0.5, 0);
      setBone('hips', Math.sin(t * 0.5 + 0.8) * 0.025 * amp, 0, Math.sin(t * 0.5) * 0.01 * amp);

      // Gaze target: moves a little with the child's position, then the eyes follow it.
      gazeTarget.position.set(state.gazeX * 0.7, 1.42 + state.gazeY * 0.25, 1.6);

      var happy = state.mode === 'celebrate' || state.mode === 'happy';
      setExpression('happy', happy ? 0.7 : 0);
    }

    var rig = {
      THREE: T,
      version: 'human-1',
      root: root,
      vrm: vrm,
      lowEnd: lowEnd,
      neutralPose: {},
      update: function (dt, signals) {
        signals = signals || {};
        var step = clamp(num(dt, 1 / 60), 0.001, 0.1);
        state.time += step;
        if ('state' in signals) rig.setState(signals.state);
        if ('viseme' in signals || 'jaw' in signals) rig.setViseme(signals.viseme, signals.jaw);
        if ('gazeX' in signals || 'gazeY' in signals) rig.look(signals.gazeX, signals.gazeY);
        if (signals.act && signals.act !== state.lastAct) { state.lastAct = signals.act; rig.act(signals.act); }
        state.actAge += step;
        applyBlink(step);
        applyMouth(step);
        applyPose(step);
        vrm.update(step);
        return rig;
      },
      setState: function (name) {
        state.mode = name || 'idle';
        return rig;
      },
      setViseme: function (viseme, jaw) {
        state.viseme = VISEME_SHAPE[viseme] ? viseme : 'rest';
        state.jaw = clamp(num(jaw, 0), 0, 1.2);
        return rig;
      },
      look: function (x, y) {
        state.gazeX = clamp(num(x, 0), -1, 1);
        state.gazeY = clamp(num(y, 0), -1, 1);
        return rig;
      },
      act: function () { state.actAge = 0; return rig; },
      react: function () { state.actAge = 0; return rig; },
      dispose: function () {
        // The shared VRM stays cached for the next mount; only this instance leaves the scene.
        if (root.parent) root.parent.remove(root);
      }
    };
    return rig;
  }

  global.PDDomeyHuman = {
    load: load,
    buildRig: buildRig,
    isLowEnd: isLowEnd,
    prefersReducedMotion: prefersReducedMotion,
    LICENSE: 'VRM1_Constraint_Twist_Sample by pixiv Inc., VRM Public License 1.0 (free, commercial use allowed); three-vrm MIT; three.js MIT',
    version: 'human-1'
  };
})(typeof window !== 'undefined' ? window : this);
