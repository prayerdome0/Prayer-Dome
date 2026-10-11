/*!
 * Prayer Dome — Domey, the semi-realistic 3D hostess
 * ===========================================================================
 * The character the member talks to on the Faith Journey game: a friendly,
 * realistic-styled three-dimensional woman in a royal-blue dress with gold
 * details, holding a Bible, built entirely out of lit, shaded three.js
 * geometry.
 *
 *   <script src="/assets/pd-domey3d.js" defer></script>
 *   <script src="/assets/pd-domey-lady.js" defer></script>
 *   <script src="/assets/pd-mascot.js" defer></script>
 *
 * PDMascot.mount(stage, { render: 'auto' }) picks her up on its own: this
 * module has no model to download (the whole body is generated from
 * primitives), so she appears instantly, offline, on a cold start and inside
 * the Android WebView. She plugs into the same staging code the cartoon rig
 * uses — PDDomey3D.create(stage, { rig: PDDomeyLady.buildRig(THREE) }) — and
 * honours the same contract:
 *
 *   rig.root                 add to a scene
 *   rig.update(dt, signals)  one animation step ({viseme, jaw, act, state,
 *                            gazeX, gazeY, calm} — every field optional)
 *   rig.setViseme / setState / look / act / react / dispose
 *   rig.head / arms / eyes / mouthParts / speakingMouth / sparks
 *
 * What she does, every frame:
 *   - lip-syncs with the visemes the mascot engine publishes while she
 *     speaks (a real mouth: cavity, lips, teeth and tongue that open, spread
 *     and round per sound, smoothed frame to frame)
 *   - blinks on her own timer (with the occasional natural double blink)
 *   - looks at the member with her eyes and turns her head with the gaze
 *   - breathes, sways, shifts her weight; her hair and skirt sway with her
 *   - acts: waves, points, counts on her fingers, thinks, listens (hand to
 *     ear), celebrates, prays — the Bible stays cradled in her left arm the
 *     whole time, the way a teacher holds a book
 *
 * There is deliberately no photograph and no downloaded model here: a static
 * image cannot move its mouth, and a 10 MB avatar is too heavy for the phones
 * this ministry serves. This body is generated in code so it is always
 * available, always the same, and always in Prayer Dome's blue and gold.
 */
(function (global) {
  'use strict';

  var VERSION = 'lady-1';

  /* The mouth postures the speech engine publishes (kept in step with
     PDMascot.visemes). `open` is jaw drop, `wide` is lip spread, `round` is
     lip rounding, `teeth`/`tongue` how much of each shows. */
  var VISEMES = ['rest', 'M', 'F', 'E', 'I', 'A', 'O', 'U', 'L'];
  var VISEME_SHAPES = {
    rest: { open: 0.06, wide: 0.62, round: 0.00, teeth: 0.18, tongue: 0.00 },
    M: { open: 0.02, wide: 0.68, round: 0.00, teeth: 0.10, tongue: 0.00 },
    F: { open: 0.14, wide: 0.78, round: 0.08, teeth: 0.78, tongue: 0.00 },
    E: { open: 0.48, wide: 0.96, round: 0.04, teeth: 0.62, tongue: 0.42 },
    I: { open: 0.20, wide: 1.04, round: 0.02, teeth: 0.74, tongue: 0.10 },
    A: { open: 0.92, wide: 0.72, round: 0.26, teeth: 0.48, tongue: 0.78 },
    O: { open: 0.64, wide: 0.34, round: 1.00, teeth: 0.14, tongue: 0.30 },
    U: { open: 0.34, wide: 0.26, round: 1.00, teeth: 0.06, tongue: 0.16 },
    L: { open: 0.28, wide: 0.62, round: 0.30, teeth: 0.58, tongue: 0.86 }
  };

  var STATES = ['idle', 'speaking', 'listening', 'thinking', 'celebrating', 'praying', 'happy', 'encouraging'];

  /* Gesture poses. The Bible rides in her left arm, so the left arm mostly
     stays cradled while the right hand does the talking — exactly how a
     teacher with a book in the crook of her arm gestures. Angles are radians
     in the shoulder's local space: z lifts the arm, x swings it forward. */
  var ACTION_POSES = {
    wave: { armR: { z: 1.95, x: -0.35, y: 0.12 }, wave: true },
    point: { armR: { z: 0.95, x: -0.72, y: 0.22 }, lean: 0.03 },
    open: { armR: { z: 0.78, x: -0.55, y: -0.16 } },
    offer: { armR: { z: 0.55, x: -1.02, y: -0.10 }, lean: 0.02 },
    count: { armR: { z: 1.12, x: -0.82, y: 0.26 }, count: true },
    thumb: { armR: { z: 0.50, x: -1.10, y: 0.24 } },
    raise: { armR: { z: 2.25, x: -0.22 }, hop: 0.8 },
    shrug: { armR: { z: 0.72, x: -0.26, y: -0.24 }, armL: { z: -0.42, x: -0.30, y: 0.20 }, shrug: true },
    clap: { armR: { z: 1.55, x: -1.05, y: 0.26 }, hop: 0.6, clap: true },
    heart: { armR: { z: 0.44, x: -1.18, y: 0.50 }, lean: 0.05 },
    think: { armR: { z: 1.30, x: -0.74, y: 0.55 }, head: { tilt: 0.13, pitch: -0.06 } },
    dance: { sway: 1, armR: { z: 1.55, x: -0.50, y: -0.28 }, hop: 0.9 },
    jump: { hop: 1, armR: { z: 1.20, x: -0.24 } },
    mic: { armR: { z: 0.95, x: -1.38, y: 0.52 }, head: { tilt: 0.16, pitch: 0.04 } }
  };
  var ACTIONS = Object.keys(ACTION_POSES);

  /* ---------------------------------------------------------------- helpers */

  function clamp(value, min, max) { return value < min ? min : value > max ? max : value; }
  function approach(from, to, dt, seconds) {
    var k = 1 - Math.exp(-dt / Math.max(0.0001, seconds));
    return from + (to - from) * k;
  }

  function part(THREE, parent, geometry, material, position, rotation, scale) {
    var mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function group(THREE, parent, position) {
    var node = new THREE.Group();
    if (position) node.position.set(position[0], position[1], position[2]);
    if (parent) parent.add(node);
    return node;
  }

  /* ------------------------------------------------------------------- rig */

  /**
   * Build Domey's body. Pure geometry: no renderer, no camera, no DOM, so the
   * character can be exercised in Node (the test suite does exactly that).
   */
  function buildRig(THREE, options) {
    options = options || {};

    var geo = [];
    var mats = [];
    function G(g) { geo.push(g); return g; }
    function M(m) { mats.push(m); return m; }

    var calmMotion = !!options.reducedMotion;
    var amp = calmMotion ? 0.45 : 1;

    /* ---- palette: Prayer Dome blue and gold on warm skin -----------------
       Skin uses a faint warm emissive so it reads soft and alive rather than
       plastic; the dress is the deep royal blue of the branding; the gold is
       a real metal. */
    function skinMat(color, opts) {
      return M(new THREE.MeshStandardMaterial(Object.assign({
        color: color, roughness: 0.52, metalness: 0,
        emissive: 0x5a2c16, emissiveIntensity: 0.05
      }, opts || {})));
    }
    var SKIN = skinMat(0xb47a52);
    var SKIN_DEEP = skinMat(0x96613e, { roughness: 0.6 });
    var SKIN_LIP = skinMat(0xa65a4b, { roughness: 0.42, emissive: 0x58201c, emissiveIntensity: 0.07 });
    var DRESS = M(new THREE.MeshStandardMaterial({ color: 0x0d4f9e, roughness: 0.58, metalness: 0.05,
      emissive: 0x061c3c, emissiveIntensity: 0.16 }));
    var DRESS_DEEP = M(new THREE.MeshStandardMaterial({ color: 0x093568, roughness: 0.64, metalness: 0.04 }));
    var GOLD = M(new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.28, metalness: 0.65,
      emissive: 0x40300a, emissiveIntensity: 0.45 }));
    var HAIR = M(new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.46, metalness: 0.06,
      emissive: 0x120a06, emissiveIntensity: 0.12 }));
    var HAIR_LIGHT = M(new THREE.MeshStandardMaterial({ color: 0x4a2f1e, roughness: 0.5, metalness: 0.04 }));
    var EYE_WHITE = M(new THREE.MeshStandardMaterial({ color: 0xfdfdfd, roughness: 0.22, metalness: 0 }));
    var SCLERA_SHADE = M(new THREE.MeshStandardMaterial({ color: 0xd9b9a0, roughness: 0.3, metalness: 0,
      transparent: true, opacity: 0.4 }));
    var IRIS = M(new THREE.MeshStandardMaterial({ color: 0x4a2c15, roughness: 0.26, metalness: 0.05,
      emissive: 0x1c0f06, emissiveIntensity: 0.1 }));
    var PUPIL = M(new THREE.MeshStandardMaterial({ color: 0x0b0805, roughness: 0.15, metalness: 0 }));
    var GLINT = M(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    var LASH = M(new THREE.MeshStandardMaterial({ color: 0x1c110a, roughness: 0.6, metalness: 0 }));
    var MOUTH = M(new THREE.MeshStandardMaterial({ color: 0x431016, roughness: 0.72, metalness: 0 }));
    var TEETH = M(new THREE.MeshStandardMaterial({ color: 0xf8f5ee, roughness: 0.26, metalness: 0 }));
    var TONGUE = M(new THREE.MeshStandardMaterial({ color: 0xa84a52, roughness: 0.5, metalness: 0,
      emissive: 0x381114, emissiveIntensity: 0.1 }));
    var CHEEK = M(new THREE.MeshStandardMaterial({ color: 0x9c5a45, roughness: 0.9, metalness: 0,
      transparent: true, opacity: 0.3, emissive: 0x5c2c20, emissiveIntensity: 0.05 }));
    var BOOK = M(new THREE.MeshStandardMaterial({ color: 0x14315e, roughness: 0.5, metalness: 0.08 }));
    var PAGES = M(new THREE.MeshStandardMaterial({ color: 0xf7f0e2, roughness: 0.85, metalness: 0 }));
    var NAIL = M(new THREE.MeshStandardMaterial({ color: 0xe8c8a8, roughness: 0.32, metalness: 0 }));
    var SPARK = M(new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 }));

    var rig = { THREE: THREE, version: VERSION };
    var root = group(THREE, null);
    rig.root = root;
    root.position.y = 0.13;              // feet land exactly on the floor ring

    var body = group(THREE, root);       // breathes and hops
    rig.body = body;
    var figure = group(THREE, body);     // leans and dances
    rig.figure = figure;

    /* ------------------------------------------------------------- the dress */
    /* The silhouette is one lathe: hips, a gathered waist, a soft bust, then
       shoulders that taper to the neck. One surface keeps the fabric smooth. */
    var bodice = new THREE.LatheGeometry([
      new THREE.Vector2(0.315, 0.26),
      new THREE.Vector2(0.30, 0.46),
      new THREE.Vector2(0.245, 0.70),
      new THREE.Vector2(0.27, 0.86),
      new THREE.Vector2(0.325, 1.00),
      new THREE.Vector2(0.315, 1.10),
      new THREE.Vector2(0.245, 1.17)
    ], 44);
    part(THREE, figure, G(bodice), DRESS, [0, 0, 0], null, [1, 1, 0.8]);
    // a modest bust so the bodice reads as a woman's dress
    part(THREE, figure, G(new THREE.SphereGeometry(0.125, 22, 16)), DRESS,
      [0.095, 0.965, 0.15], [0.1, 0, 0], [1, 0.92, 0.78]);
    part(THREE, figure, G(new THREE.SphereGeometry(0.125, 22, 16)), DRESS,
      [-0.095, 0.965, 0.15], [0.1, 0, 0], [1, 0.92, 0.78]);
    // shoulder caps — the sleeves of the dress
    part(THREE, figure, G(new THREE.SphereGeometry(0.155, 24, 18)), DRESS,
      [0.335, 1.11, 0], [0, 0, -0.18], [1, 0.72, 0.92]);
    part(THREE, figure, G(new THREE.SphereGeometry(0.155, 24, 18)), DRESS,
      [-0.335, 1.11, 0], [0, 0, 0.18], [1, 0.72, 0.92]);
    // sleeve hems in gold
    part(THREE, figure, G(new THREE.TorusGeometry(0.118, 0.014, 8, 24)), GOLD,
      [0.36, 1.045, 0], [Math.PI / 2, 0, -0.14], [1, 1, 0.9]);
    part(THREE, figure, G(new THREE.TorusGeometry(0.118, 0.014, 8, 24)), GOLD,
      [-0.36, 1.045, 0], [Math.PI / 2, 0, 0.14], [1, 1, 0.9]);
    // the gold belt that gathers the waist, with a small buckle
    part(THREE, figure, G(new THREE.TorusGeometry(0.252, 0.023, 10, 42)), GOLD,
      [0, 0.705, 0], [Math.PI / 2, 0, 0], [1, 1, 0.82]);
    part(THREE, figure, G(new THREE.BoxGeometry(0.075, 0.055, 0.03)), GOLD,
      [0, 0.705, 0.205]);
    // a fold shadow under the bust gives the fabric depth
    part(THREE, figure, G(new THREE.TorusGeometry(0.20, 0.016, 8, 32, Math.PI)), DRESS_DEEP,
      [0, 0.90, 0.05], [Math.PI / 2 + 0.35, 0, Math.PI], [1, 1, 0.72]);

    /* the skirt: an A-line that flares from the belt to just below the knee */
    var skirtGroup = group(THREE, figure, [0, 0.66, 0]);
    rig.skirt = skirtGroup;
    var skirt = new THREE.LatheGeometry([
      new THREE.Vector2(0.001, 0.06),
      new THREE.Vector2(0.16, 0.04),
      new THREE.Vector2(0.30, -0.22),
      new THREE.Vector2(0.44, -0.68),
      new THREE.Vector2(0.545, -1.06)
    ], 48);
    part(THREE, skirtGroup, G(skirt), DRESS, null, null, [1, 1, 0.86]);
    // gold hem — the signature trim
    part(THREE, skirtGroup, G(new THREE.TorusGeometry(0.545, 0.017, 10, 56)), GOLD,
      [0, -1.06, 0], [Math.PI / 2, 0, 0], [1, 1, 0.86]);
    // a second fold ring inside the flare reads as cloth, not a cone
    part(THREE, skirtGroup, G(new THREE.TorusGeometry(0.44, 0.013, 8, 48)), DRESS_DEEP,
      [0, -0.68, 0], [Math.PI / 2, 0, 0], [1, 1, 0.86]);
    // the modesty fill so the open hem never shows up the skirt
    part(THREE, skirtGroup, G(new THREE.SphereGeometry(0.42, 22, 14)), DRESS_DEEP,
      [0, -0.62, 0], null, [1, 0.62, 0.8]);

    /* the necklace: a fine gold chain with a small cross pendant */
    part(THREE, figure, G(new THREE.TorusGeometry(0.108, 0.008, 8, 30)), GOLD,
      [0, 1.155, 0.02], [1.22, 0, 0]);
    var pendant = group(THREE, figure, [0, 1.09, 0.145]);
    part(THREE, pendant, G(new THREE.BoxGeometry(0.014, 0.05, 0.008)), GOLD);
    part(THREE, pendant, G(new THREE.BoxGeometry(0.034, 0.014, 0.008)), GOLD, [0, 0.008, 0]);

    /* --------------------------------------------------------------- legs */
    /* The skirt reaches just below the knee; what shows is the calf, the
       ankle and an elegant blue shoe with a gold strap. */
    function buildLeg(side) {
      var s = side === 'R' ? 1 : -1;
      var hip = group(THREE, figure, [s * 0.145, 0.08, 0.01]);
      var thigh = group(THREE, hip);
      part(THREE, thigh, G(new THREE.CapsuleGeometry(0.105, 0.30, 8, 18)), DRESS_DEEP, [0, -0.17, 0]);
      var knee = group(THREE, thigh, [0, -0.46, 0]);
      part(THREE, knee, G(new THREE.CylinderGeometry(0.052, 0.082, 0.34, 20)), SKIN, [0, -0.17, 0]);
      part(THREE, knee, G(new THREE.SphereGeometry(0.062, 16, 12)), SKIN, [0, -0.33, 0.008]);
      var shoe = group(THREE, knee, [0, -0.395, 0.035]);
      // sole and a low heel
      part(THREE, shoe, G(new THREE.BoxGeometry(0.105, 0.02, 0.25)), DRESS_DEEP, [0, -0.012, 0.02]);
      part(THREE, shoe, G(new THREE.BoxGeometry(0.05, 0.045, 0.05)), DRESS_DEEP, [0, -0.028, -0.075]);
      // the shoe body
      part(THREE, shoe, G(new THREE.SphereGeometry(0.095, 22, 16)), DRESS,
        [0, 0.012, 0.045], null, [0.58, 0.42, 1.12]);
      // gold ankle strap with a tiny buckle
      part(THREE, shoe, G(new THREE.TorusGeometry(0.058, 0.0075, 8, 26)), GOLD,
        [0, 0.045, 0.0], [Math.PI / 2 - 0.12, 0, 0]);
      // a peep of gold on the toe
      part(THREE, shoe, G(new THREE.SphereGeometry(0.032, 14, 10)), GOLD,
        [0, 0.005, 0.155], null, [1, 0.55, 0.75]);
      return { root: hip, thigh: thigh, knee: knee, shoe: shoe, side: side, sign: s };
    }
    var legR = buildLeg('R');
    var legL = buildLeg('L');
    rig.legs = { R: legR, L: legL };

    /* --------------------------------------------------------------- arms */
    var REST_ARM = 0.14;
    function buildHand(side, parent, pos) {
      var s = side === 'R' ? 1 : -1;
      var hand = group(THREE, parent, pos);
      part(THREE, hand, G(new THREE.SphereGeometry(0.082, 20, 14)), SKIN, [0, -0.015, 0.015], null, [1.0, 1.05, 0.7]);
      part(THREE, hand, G(new THREE.SphereGeometry(0.072, 16, 12)), SKIN_DEEP, [0, -0.05, 0.05], null, [1.0, 0.7, 0.55]);
      part(THREE, hand, G(new THREE.TorusGeometry(0.064, 0.017, 6, 18)), SKIN_DEEP, [0, 0.065, 0], [Math.PI / 2, 0, 0]);
      // thumb
      var thumb = group(THREE, hand, [s * 0.072, -0.012, 0.0]);
      thumb.rotation.z = s * 0.62;
      thumb.rotation.x = -0.3;
      part(THREE, thumb, G(new THREE.CapsuleGeometry(0.02, 0.055, 4, 10)), SKIN, [0, -0.032, 0]);
      part(THREE, thumb, G(new THREE.SphereGeometry(0.024, 12, 10)), SKIN, [0, -0.08, 0]);
      // four slender fingers
      var fingerData = [
        { x: -0.040, y: -0.068, z: 0.016, len: [0.044, 0.036, 0.028], r: 0.0175 },
        { x: -0.013, y: -0.080, z: 0.016, len: [0.052, 0.040, 0.030], r: 0.0185 },
        { x:  0.013, y: -0.080, z: 0.016, len: [0.050, 0.038, 0.029], r: 0.018 },
        { x:  0.040, y: -0.070, z: 0.016, len: [0.040, 0.032, 0.025], r: 0.016 }
      ];
      var fingers = [];
      fingerData.forEach(function (f) {
        var base = group(THREE, hand, [f.x, f.y, f.z]);
        var joints = [base];
        for (var j = 0; j < f.len.length; j++) {
          var seg = group(THREE, joints[j]);
          part(THREE, seg, G(new THREE.CapsuleGeometry(f.r, f.len[j], 4, 10)), SKIN, [0, -f.len[j] * 0.5, 0]);
          part(THREE, seg, G(new THREE.SphereGeometry(f.r * 0.95, 10, 8)), SKIN);
          if (j === f.len.length - 1) {
            part(THREE, seg, G(new THREE.SphereGeometry(f.r * 0.78, 10, 8)), NAIL,
              [0, -f.len[j] * 0.95, f.r * 1.25], [Math.PI * 0.5, 0, 0], [1, 0.55, 0.8]);
          }
          joints.push(seg);
        }
        fingers.push({ base: base, joints: joints, lengths: f.len });
      });
      return { root: hand, thumb: thumb, fingers: fingers };
    }
    function buildArm(side) {
      var s = side === 'R' ? 1 : -1;
      var shoulder = group(THREE, figure, [s * 0.345, 1.095, 0]);
      shoulder.rotation.z = s * REST_ARM;
      part(THREE, shoulder, G(new THREE.CapsuleGeometry(0.072, 0.24, 8, 16)), SKIN, [0, -0.17, 0]);
      var elbow = group(THREE, shoulder, [0, -0.36, 0]);
      part(THREE, elbow, G(new THREE.CapsuleGeometry(0.061, 0.22, 8, 16)), SKIN, [0, -0.13, 0]);
      part(THREE, elbow, G(new THREE.SphereGeometry(0.056, 16, 12)), SKIN, [0, -0.245, 0.01]);
      var handInfo = buildHand(side, elbow, [0, -0.28, 0.015]);
      return { root: shoulder, elbow: elbow, hand: handInfo.root, handInfo: handInfo, side: side, sign: s };
    }
    var armR = buildArm('R');
    var armL = buildArm('L');
    rig.arms = { R: armR, L: armL };

    /* a fine gold bracelet on her right wrist */
    part(THREE, armR.elbow, G(new THREE.TorusGeometry(0.062, 0.007, 8, 24)), GOLD,
      [0, -0.215, 0.01], [Math.PI / 2, 0, 0]);

    /* The Bible, cradled in her left arm against the chest. It is parented to
       the forearm, so it rides there through every pose — she never puts it
       down. Gold cross on the cover, cream pages, a gold page edge. */
    var bible = group(THREE, armL.elbow, [0.055, -0.20, 0.14]);
    bible.rotation.set(-0.55, 0.28, 0.10);
    part(THREE, bible, G(new THREE.BoxGeometry(0.235, 0.045, 0.165)), BOOK);
    part(THREE, bible, G(new THREE.BoxGeometry(0.215, 0.03, 0.152)), PAGES, [0.0, 0.012, 0]);
    part(THREE, bible, G(new THREE.BoxGeometry(0.022, 0.014, 0.12)), GOLD, [0, 0.028, 0]);
    part(THREE, bible, G(new THREE.BoxGeometry(0.075, 0.014, 0.022)), GOLD, [0, 0.028, 0.015]);
    rig.bible = bible;

    /* ---------------------------------------------------------------- head */
    /* The skull is a slightly flattened ellipsoid; the features (eyes, brows,
       nose, mouth) all sit OUTSIDE its surface, the way the cartoon rig does
       it — a ray from the camera must reach each feature without passing
       through the skull or the cheek buildup first (scripts/audit-domey.mjs
       checks exactly that). */
    var head = group(THREE, figure, [0, 1.52, 0.015]);
    rig.head = head;
    var skull = part(THREE, head, G(new THREE.SphereGeometry(0.252, 44, 32)), SKIN, null, null, [1, 1.08, 0.92]);
    rig.skull = skull;
    // a softer, narrower jaw than the cartoon: the lower face tapers to the chin
    part(THREE, head, G(new THREE.SphereGeometry(0.205, 30, 22)), SKIN, [0, -0.155, 0.045], null, [0.94, 0.78, 0.92]);
    part(THREE, head, G(new THREE.SphereGeometry(0.135, 22, 16)), SKIN, [0, -0.19, 0.135], null, [0.9, 0.62, 0.8]);
    // chin
    part(THREE, head, G(new THREE.SphereGeometry(0.052, 16, 12)), SKIN, [0, -0.235, 0.175], null, [1, 0.72, 0.7]);
    // cheekbones, placed below the eyeline and to the sides so they never
    // cover the eyes from the camera's slightly low angle
    part(THREE, head, G(new THREE.SphereGeometry(0.085, 18, 14)), SKIN, [0.118, -0.068, 0.155], [0.1, -0.35, 0], [0.95, 0.68, 0.55]);
    part(THREE, head, G(new THREE.SphereGeometry(0.085, 18, 14)), SKIN, [-0.118, -0.068, 0.155], [0.1, 0.35, 0], [0.95, 0.68, 0.55]);
    // temples fill the silhouette between cheekbone and hair
    part(THREE, head, G(new THREE.SphereGeometry(0.072, 16, 12)), SKIN, [0.16, 0.05, 0.085], null, [0.7, 0.95, 0.8]);
    part(THREE, head, G(new THREE.SphereGeometry(0.072, 16, 12)), SKIN, [-0.16, 0.05, 0.085], null, [0.7, 0.95, 0.8]);
    // a soft blush on the apples of the cheeks
    var cheeks = [
      part(THREE, head, G(new THREE.SphereGeometry(0.06, 16, 12)), CHEEK, [0.122, -0.095, 0.178], null, [1, 0.68, 0.42]),
      part(THREE, head, G(new THREE.SphereGeometry(0.06, 16, 12)), CHEEK, [-0.122, -0.095, 0.178], null, [1, 0.68, 0.42])
    ];
    rig.cheeks = cheeks;

    /* ears with a gold stud earring each */
    [-1, 1].forEach(function (s) {
      var ear = group(THREE, head, [s * 0.252, -0.015, -0.005]);
      ear.rotation.y = s * 0.18;
      part(THREE, ear, G(new THREE.SphereGeometry(0.05, 16, 12)), SKIN, null, null, [0.5, 1.0, 0.85]);
      part(THREE, ear, G(new THREE.SphereGeometry(0.034, 14, 10)), SKIN_DEEP, [s * -0.008, -0.005, 0.016], null, [0.65, 0.75, 0.5]);
      part(THREE, ear, G(new THREE.TorusGeometry(0.024, 0.007, 6, 12, Math.PI * 1.35)), SKIN_DEEP,
        [0, 0.004, 0.012], [0, s * 0.3, 0]);
      part(THREE, ear, G(new THREE.SphereGeometry(0.014, 12, 10)), GOLD, [s * 0.004, -0.038, 0.016]);
    });

    /* the nose: bridge, tip and wings, small and softly rounded */
    var nose = group(THREE, head, [0, -0.035, 0.235]);
    rig.nose = nose;
    part(THREE, nose, G(new THREE.CapsuleGeometry(0.017, 0.085, 6, 12)), SKIN, [0, 0.028, 0.008], [-0.12, 0, 0], [0.75, 1, 0.75]);
    part(THREE, nose, G(new THREE.SphereGeometry(0.025, 16, 12)), SKIN, [0, -0.026, 0.022]);
    part(THREE, nose, G(new THREE.SphereGeometry(0.015, 12, 10)), SKIN_DEEP, [0.021, -0.026, 0.008]);
    part(THREE, nose, G(new THREE.SphereGeometry(0.015, 12, 10)), SKIN_DEEP, [-0.021, -0.026, 0.008]);

    /* ---------------------------------------------------------------- eyes */
    function buildEye(side) {
      var s = side === 'R' ? 1 : -1;
      var socket = group(THREE, head, [s * 0.102, 0.026, 0.23]);
      socket.rotation.x = -0.12;
      socket.rotation.y = s * 0.1;
      var eye = group(THREE, socket);
      part(THREE, eye, G(new THREE.SphereGeometry(0.051, 26, 18)), EYE_WHITE, null, null, [1, 1, 0.68]);
      part(THREE, eye, G(new THREE.SphereGeometry(0.038, 16, 12)), SCLERA_SHADE, [-s * 0.022, -0.012, -0.005]);
      var iris = part(THREE, eye, G(new THREE.SphereGeometry(0.0295, 22, 16)), IRIS, [0, 0, 0.031]);
      part(THREE, eye, G(new THREE.SphereGeometry(0.0155, 14, 12)), PUPIL, [0, 0, 0.045]);
      part(THREE, eye, G(new THREE.TorusGeometry(0.0295, 0.0035, 6, 22)), PUPIL, [0, 0, 0.03], [Math.PI / 2, 0, 0]);
      part(THREE, eye, G(new THREE.SphereGeometry(0.0085, 10, 8)), GLINT, [0.013, 0.015, 0.05]);
      part(THREE, eye, G(new THREE.SphereGeometry(0.0045, 8, 6)), GLINT, [-0.011, -0.008, 0.046]);
      // eyelids: skin-coloured shells that close over the eyeball
      var lid = part(THREE, socket, G(new THREE.SphereGeometry(0.055, 24, 16)), SKIN,
        [0, 0.016, -0.004], null, [1.03, 0.34, 0.72]);
      var lidLow = part(THREE, socket, G(new THREE.SphereGeometry(0.053, 24, 16)), SKIN,
        [0, -0.02, -0.006], null, [1.03, 0.24, 0.66]);
      // the lash line hugging the upper lid, plus three fine outer lashes
      part(THREE, socket, G(new THREE.TorusGeometry(0.05, 0.0045, 6, 26, Math.PI * 0.85)), LASH,
        [0, 0.004, 0.008], [Math.PI * 0.58, 0, Math.PI * 0.075]);
      for (var k = 0; k < 3; k++) {
        part(THREE, socket, G(new THREE.CapsuleGeometry(0.0022, 0.02, 4, 6)), LASH,
          [s * (0.036 + k * 0.007), 0.014 - k * 0.004, 0.026],
          [0.2, 0, s * (0.7 + k * 0.12)]);
      }
      // a soft eyeshadow tint just above the lash line
      part(THREE, socket, G(new THREE.SphereGeometry(0.054, 20, 14)), SCLERA_SHADE,
        [0, 0.03, -0.002], null, [1.02, 0.2, 0.6]);
      return { socket: socket, eye: eye, iris: iris, lid: lid, lidLow: lidLow };
    }
    var eyes = { R: buildEye('R'), L: buildEye('L') };
    rig.eyes = eyes;

    /* brows: thin, gently arched */
    function buildBrow(side) {
      var s = side === 'R' ? 1 : -1;
      var brow = group(THREE, head, [s * 0.104, 0.1, 0.218]);
      brow.rotation.set(-0.22, s * 0.16, s * 0.1);
      part(THREE, brow, G(new THREE.TorusGeometry(0.055, 0.0075, 6, 18, Math.PI * 0.52)), HAIR,
        null, [0, 0, Math.PI * 0.24]);
      return brow;
    }
    var brows = { R: buildBrow('R'), L: buildBrow('L') };
    rig.brows = brows;

    /* ---------------------------------------------------------------- mouth */
    /* Two mouth systems, exactly like the cartoon rig: an expression mouth
       that shows how she feels, and the viseme assembly she speaks with. */
    var mouth = group(THREE, head, [0, -0.148, 0.242]);
    mouth.rotation.x = 0.32;
    rig.mouth = mouth;

    var expression = group(THREE, mouth);
    rig.expressionMouth = expression;
    var smile = part(THREE, expression, G(new THREE.TorusGeometry(0.049, 0.0075, 8, 26, Math.PI * 0.68)), SKIN_LIP,
      [0, 0.018, 0.006], [0, 0, Math.PI * 0.16]);
    var smileLow = part(THREE, expression, G(new THREE.CapsuleGeometry(0.0075, 0.06, 6, 12)), SKIN_LIP,
      [0, -0.004, 0.006], [0, 0, Math.PI / 2]);
    var thinkMouth = part(THREE, expression, G(new THREE.CapsuleGeometry(0.0065, 0.028, 6, 12)), SKIN_LIP,
      [0.012, 0.004, 0.006], [0, 0, Math.PI / 2 - 0.18]);
    var prayMouth = part(THREE, expression, G(new THREE.TorusGeometry(0.03, 0.0065, 8, 20, Math.PI)), SKIN_LIP,
      [0, 0.0, 0.006], [0, 0, 0]);
    rig.expressionParts = { smile: smile, smileLow: smileLow, think: thinkMouth, pray: prayMouth };

    var speaking = group(THREE, mouth);
    speaking.visible = false;
    rig.speakingMouth = speaking;
    var cavity = part(THREE, speaking, G(new THREE.SphereGeometry(1, 24, 16)), MOUTH, null, null, [0.052, 0.02, 0.02]);
    var lips = part(THREE, speaking, G(new THREE.TorusGeometry(1, 0.2, 10, 30)), SKIN_LIP, [0, 0, 0.004], null, [0.055, 0.022, 0.016]);
    var teeth = part(THREE, speaking, G(new THREE.SphereGeometry(1, 20, 14)), TEETH, [0, 0, 0.01], null, [0.042, 0.008, 0.018]);
    var tongue = part(THREE, speaking, G(new THREE.SphereGeometry(1, 18, 14)), TONGUE, [0, 0, 0.006], null, [0.026, 0.008, 0.018]);
    rig.mouthParts = { cavity: cavity, lips: lips, teeth: teeth, tongue: tongue };

    /* ---------------------------------------------------------------- hair */
    /* Long, dark and softly waved: a cap over the crown, a centre-parted
       fringe that sweeps to each side, two locks framing the face, and a
       heavy back mass that falls past the shoulders. A fine gold band holds
       the front — the ministry's colours in her hair. */
    var hair = group(THREE, head, [0, 0.012, -0.008]);
    rig.hair = hair;
    // the cap — a shallow shell tilted back so its front edge sits above the
    // brows (a hairline) and its back reaches under the skull equator
    part(THREE, hair, G(new THREE.SphereGeometry(0.262, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.55)), HAIR,
      [0, 0.012, -0.006], [-0.75, 0, 0], [1.02, 1.06, 1.03]);
    // the fringe: two swoops from a centre part
    part(THREE, hair, G(new THREE.SphereGeometry(0.16, 24, 18)), HAIR,
      [0.098, 0.2, 0.135], [0.5, -0.5, -0.34], [1.05, 0.28, 0.5]);
    part(THREE, hair, G(new THREE.SphereGeometry(0.16, 24, 18)), HAIR,
      [-0.098, 0.2, 0.135], [0.5, 0.5, 0.34], [1.05, 0.28, 0.5]);
    // highlights so the hair has sheen
    part(THREE, hair, G(new THREE.SphereGeometry(0.15, 22, 16)), HAIR_LIGHT,
      [0.10, 0.215, 0.105], [0.5, -0.5, -0.34], [0.9, 0.15, 0.34]);
    part(THREE, hair, G(new THREE.SphereGeometry(0.15, 22, 16)), HAIR_LIGHT,
      [-0.10, 0.215, 0.105], [0.5, 0.5, 0.34], [0.9, 0.15, 0.34]);
    // the locks that frame her face
    part(THREE, hair, G(new THREE.CapsuleGeometry(0.055, 0.34, 8, 14)), HAIR,
      [0.228, -0.16, 0.135], [0.06, 0, -0.07], [1, 1, 0.85]);
    part(THREE, hair, G(new THREE.CapsuleGeometry(0.055, 0.34, 8, 14)), HAIR,
      [-0.228, -0.16, 0.135], [0.06, 0, 0.07], [1, 1, 0.85]);
    // the back mass, in two tiers so it reads as waves, not a helmet
    var backHair = group(THREE, hair, [0, -0.2, -0.075]);
    rig.backHair = backHair;
    part(THREE, backHair, G(new THREE.SphereGeometry(0.26, 30, 22)), HAIR,
      [0, 0.02, 0], [0.06, 0, 0], [1.02, 1.35, 0.72]);
    part(THREE, backHair, G(new THREE.SphereGeometry(0.22, 28, 20)), HAIR,
      [0, -0.34, 0.01], [0.03, 0, 0], [0.98, 1.5, 0.62]);
    part(THREE, backHair, G(new THREE.SphereGeometry(0.1, 20, 16)), HAIR_LIGHT,
      [0.07, -0.05, 0.1], [0.05, 0, 0], [0.5, 1.6, 0.4]);
    // side volumes over the ears so no skin peeks through
    part(THREE, hair, G(new THREE.SphereGeometry(0.11, 20, 16)), HAIR,
      [0.225, 0.02, -0.02], [0, -0.35, 0], [0.62, 1.15, 0.85]);
    part(THREE, hair, G(new THREE.SphereGeometry(0.11, 20, 16)), HAIR,
      [-0.225, 0.02, -0.02], [0, 0.35, 0], [0.62, 1.15, 0.85]);
    // the gold band across the crown
    part(THREE, hair, G(new THREE.TorusGeometry(0.268, 0.009, 8, 44, Math.PI * 1.2)), GOLD,
      [0, 0.115, 0.075], [-0.62, 0, Math.PI * 0.9]);
    part(THREE, hair, G(new THREE.SphereGeometry(0.016, 12, 10)), GOLD, [0.252, 0.128, 0.04]);
    part(THREE, hair, G(new THREE.SphereGeometry(0.016, 12, 10)), GOLD, [-0.252, 0.128, 0.04]);

    /* ------------------------------------------------------ celebration dust */
    var sparks = [];
    for (var i = 0; i < 20; i++) {
      var spark = part(THREE, root, G(new THREE.SphereGeometry(0.035, 10, 8)), SPARK);
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
      state: 'idle',
      gaze: { x: 0, y: 0 },
      look: { x: 0, y: 0 },
      blink: { next: 1.8, t: 0, phase: 0, closed: 0, double: false },
      time: 0,
      mouth: { open: 0.05, wide: 0.62, round: 0, teeth: 0.2, tongue: 0 },
      hop: 0,
      sparkle: 0
    };
    rig.state = state;

    var pose = {
      armR: { z: REST_ARM, x: 0.02, y: 0 },
      armL: { z: -0.52, x: -0.98, y: 0.18 },
      elbowR: 0.38, elbowL: 1.42,
      headTilt: 0, headPitch: 0, headYaw: 0,
      lean: 0, hop: 0, sway: 0, shrug: 0,
      browRaise: 0, smile: 0.55, mouthOpen: 0
    };
    var neutral = { armR: { z: REST_ARM, x: 0.02, y: 0 }, armL: { z: -0.52, x: -0.98, y: 0.18 } };
    rig.neutralPose = neutral;

    /* The left arm cradles the Bible against her chest in every state; each
       mood only tunes the head, the brows, the smile and the free right arm. */
    function basePose(name) {
      var p = {
        armR: { z: REST_ARM, x: 0.02, y: 0 },
        armL: { z: -0.52, x: -0.98, y: 0.18 },
        elbowR: 0.38, elbowL: 1.42,
        headTilt: 0, headPitch: 0, headYaw: 0,
        lean: 0, hop: 0, sway: 0, shrug: 0,
        browRaise: 0, smile: 0.55, mouthOpen: 0
      };
      if (name === 'listening') {
        p.headTilt = 0.14; p.headPitch = 0.045; p.browRaise = 0.4; p.smile = 0.5;
        p.armR = { z: 0.82, x: -1.16, y: 0.4 }; p.elbowR = 1.45;   // hand raised to her ear
      } else if (name === 'thinking') {
        p.headTilt = 0.15; p.headPitch = -0.09; p.browRaise = 0.55; p.smile = 0.15;
        p.armR = { z: 1.16, x: -0.72, y: 0.5 }; p.elbowR = 1.62;   // fingers to her chin
      } else if (name === 'celebrating') {
        p.smile = 1; p.hop = 1; p.browRaise = 0.85; p.sparkle = 1;
        p.armR = { z: 2.2, x: -0.26, y: 0.14 }; p.elbowR = 0.2;
      } else if (name === 'praying') {
        p.smile = 0.3; p.headPitch = 0.17; p.lean = 0.04; p.browRaise = 0;
        p.armR = { z: 0.4, x: -1.2, y: 0.5 }; p.elbowR = 1.7;      // hand over her heart
      } else if (name === 'speaking') {
        p.smile = 0.72; p.browRaise = 0.3; p.headPitch = -0.02;
      } else if (name === 'happy') {
        p.smile = 0.95; p.browRaise = 0.6; p.headTilt = 0.05;
      } else if (name === 'encouraging') {
        p.smile = 0.5; p.browRaise = 0.25; p.headPitch = 0.03; p.lean = 0.03;
        p.armR = { z: 0.7, x: -0.6, y: -0.14 }; p.elbowR = 0.5;    // an open, calm hand
      }
      return p;
    }

    function mergePose(target, action) {
      var spec = ACTION_POSES[action];
      if (!spec) return target;
      ['armR', 'armL'].forEach(function (key) {
        if (!spec[key]) return;
        var from = target[key];
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
      return target;
    }

    rig.act = function (name) {
      if (name && !ACTION_POSES[name]) return rig;
      state.action = name || null;
      state.actionAge = 0;
      return rig;
    };

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
        s.mesh.position.set((Math.random() - 0.5) * 1.0, 0.7 + Math.random() * 0.5, 0.25 + Math.random() * 0.35);
        s.vx = (Math.random() - 0.5) * 0.45;
        s.vy = 0.5 + Math.random() * 0.4;
        s.vz = (Math.random() - 0.5) * 0.3;
        s.mesh.scale.setScalar(0.6 + Math.random() * 0.7);
      }
      state.sparkle = 1;
      return rig;
    };

    rig.setState = function (name) {
      state.state = name && STATES.indexOf(name) !== -1 ? name : 'idle';
      return rig;
    };

    rig.setViseme = function (viseme, jaw) {
      state.viseme = viseme && VISEME_SHAPES[viseme] ? viseme : (viseme === 'rest' ? 'rest' : null);
      state.jaw = clamp(typeof jaw === 'number' && isFinite(jaw) ? jaw : 0, 0, 1.2);
      return rig;
    };

    rig.look = function (x, y) {
      state.gaze.x = clamp(x || 0, -1, 1);
      state.gaze.y = clamp(y || 0, -1, 1);
      return rig;
    };

    rig.update = function (dt, signals) {
      signals = signals || {};
      var step = clamp(typeof dt === 'number' && isFinite(dt) ? dt : 1 / 60, 0.001, 0.1);
      var calm = !!signals.calm;
      var speed = calm ? 0.45 : 1;
      state.time += step;

      if ('state' in signals) rig.setState(signals.state);
      if ('viseme' in signals) rig.setViseme(signals.viseme, signals.jaw);
      if ('gazeX' in signals || 'gazeY' in signals) rig.look(signals.gazeX, signals.gazeY);
      if (signals.act !== undefined && signals.act !== state.act) {
        state.act = signals.act;
        rig.act(signals.act);
      }

      /* ---- target pose: the mood, plus the gesture on top */
      var target = basePose(state.state);
      if (state.action) {
        state.actionAge += step;
        if (state.actionAge > 6) state.action = null;
        else mergePose(target, state.action);
      }

      /* ---- life that never stops: breathing, weight shift, hair */
      var breathe = Math.sin(state.time * 1.6) * 0.011 * speed;
      var weight = Math.sin(state.time * 0.7) * 0.02 * speed;
      pose.armR.z = approach(pose.armR.z, target.armR.z, step, 0.16);
      pose.armR.x = approach(pose.armR.x, target.armR.x, step, 0.16);
      pose.armR.y = approach(pose.armR.y, target.armR.y, step, 0.16);
      pose.armL.z = approach(pose.armL.z, target.armL.z, step, 0.2);
      pose.armL.x = approach(pose.armL.x, target.armL.x, step, 0.2);
      pose.armL.y = approach(pose.armL.y, target.armL.y, step, 0.2);
      pose.elbowR = approach(pose.elbowR, target.elbowR, step, 0.16);
      pose.elbowL = approach(pose.elbowL, target.elbowL, step, 0.2);
      pose.lean = approach(pose.lean, (target.lean || 0) + (target.sway ? Math.sin(state.time * 5.2) * 0.05 * speed : 0), step, 0.2);
      pose.shrug = approach(pose.shrug, target.shrug || 0, step, 0.18);
      pose.browRaise = approach(pose.browRaise, target.browRaise || 0, step, 0.2);
      pose.smile = approach(pose.smile, target.smile == null ? 0.55 : target.smile, step, 0.22);

      var hopWave = 0;
      if ((target.hop || 0) > 0 && !calm) {
        hopWave = Math.abs(Math.sin(state.time * 4.1)) * 0.065 * (target.hop || 0);
      }

      /* ---- the head: nods on stressed syllables, follows the member */
      var speakNod = (state.state === 'speaking' || state.viseme)
        ? Math.sin(state.time * 4.6) * 0.03 * speed : 0;
      var yaw = (target.headYaw || 0) + state.gaze.x * 0.22 + Math.sin(state.time * 0.48) * 0.022 * speed;
      var pitch = (target.headPitch || 0) - state.gaze.y * 0.11 + speakNod;
      var tilt = (target.headTilt || 0) + Math.sin(state.time * 0.4) * 0.028 * speed;
      head.rotation.y = approach(head.rotation.y, yaw, step, 0.22);
      head.rotation.x = approach(head.rotation.x, pitch, step, 0.22);
      head.rotation.z = approach(head.rotation.z, tilt, step, 0.24);
      // hair follows the head with a soft lag — it is the little things
      backHair.rotation.z = Math.sin(state.time * 0.9) * 0.02 * speed - head.rotation.z * 0.35;
      backHair.rotation.x = Math.sin(state.time * 0.73 + 1.1) * 0.015 * speed;
      skirtGroup.rotation.z = Math.sin(state.time * 0.8 + 0.6) * 0.016 * speed + (target.sway ? Math.sin(state.time * 5.2) * 0.03 * speed : 0);

      /* ---- arms */
      var waveSwing = 0;
      if (state.action === 'wave' && !calm) waveSwing = Math.sin(state.time * 9.0) * 0.32;
      armR.root.rotation.z = pose.armR.z + waveSwing;
      armR.root.rotation.x = pose.armR.x;
      armR.root.rotation.y = pose.armR.y;
      armL.root.rotation.z = pose.armL.z;
      armL.root.rotation.x = pose.armL.x;
      armL.root.rotation.y = pose.armL.y;
      if (state.action === 'shrug') {
        armR.root.rotation.z += pose.shrug * 0.1;
        armL.root.rotation.z -= pose.shrug * 0.06;
      }
      armR.elbow.rotation.x = approach(armR.elbow.rotation.x, pose.elbowR, step, 0.16);
      armL.elbow.rotation.x = approach(armL.elbow.rotation.x, pose.elbowL, step, 0.18);
      armR.elbow.rotation.z = approach(armR.elbow.rotation.z, 0.08, step, 0.2);
      armL.elbow.rotation.z = approach(armL.elbow.rotation.z, -0.3, step, 0.2);

      /* ---- body */
      body.position.y = hopWave + breathe + pose.shrug * 0.018;
      figure.rotation.z = Math.sin(state.time * 0.62) * 0.012 * speed;
      figure.rotation.y = approach(figure.rotation.y, pose.lean * -1.4, step, 0.3);
      figure.rotation.x = approach(figure.rotation.x, pose.lean * 0.5, step, 0.3);

      /* ---- legs: a natural stance with soft knees and a weight shift */
      legR.root.rotation.x = approach(legR.root.rotation.x, 0.03 + weight, step, 0.3);
      legL.root.rotation.x = approach(legL.root.rotation.x, 0.03 - weight, step, 0.3);
      legR.knee.rotation.x = approach(legR.knee.rotation.x, 0.05 - weight * 0.5, step, 0.3);
      legL.knee.rotation.x = approach(legL.knee.rotation.x, 0.05 + weight * 0.5, step, 0.3);
      if (state.action === 'dance' || state.action === 'jump' || state.state === 'celebrating') {
        var kick = Math.sin(state.time * 5.6) * 0.2;
        legR.knee.rotation.x = approach(legR.knee.rotation.x, 0.28 + kick, step, 0.15);
        legL.knee.rotation.x = approach(legL.knee.rotation.x, 0.28 - kick, step, 0.15);
      }

      /* ---- hands: the right one gestures, the left one holds the Bible */
      function curlFingers(handInfo, amount, spread) {
        if (!handInfo || !handInfo.fingers) return;
        handInfo.fingers.forEach(function (f, idx) {
          var curl = amount;
          var per = [0.95, 1.05, 1.0, 0.85][idx] || 1;
          var sp = (spread || 0) * (idx - 1.5) * 0.05;
          for (var j = 1; j < f.joints.length; j++) {
            var want = curl * per * (0.5 + j * 0.35);
            f.joints[j].rotation.x = approach(f.joints[j].rotation.x, want, step, 0.12);
            f.joints[j].rotation.z = approach(f.joints[j].rotation.z, sp, step, 0.15);
          }
          f.base.rotation.z = approach(f.base.rotation.z, sp, step, 0.15);
        });
        handInfo.thumb.rotation.x = approach(handInfo.thumb.rotation.x, -0.3 - amount * 0.28, step, 0.15);
      }
      var gripL = 0.62;                                        // steady on the Bible
      var gripR = 0.28;
      if (state.action === 'point' || state.action === 'thumb' || state.action === 'wave') gripR = 0.10;
      if (state.action === 'open' || state.action === 'raise' || state.action === 'offer') gripR = 0.02;
      if (state.action === 'count') gripR = 0.32;
      if (state.action === 'mic' || state.state === 'listening') gripR = 0.16;
      if (state.action === 'think' || state.state === 'thinking') gripR = 0.05;
      if (state.action === 'heart') gripR = 0.02;
      curlFingers(armL.handInfo, gripL, 0);
      curlFingers(armR.handInfo, gripR, state.action === 'open' ? 0.5 : 0.12);
      if (armR.handInfo && state.action === 'point') {
        var indexF = armR.handInfo.fingers[1];
        if (indexF) for (var j = 1; j < indexF.joints.length; j++) indexF.joints[j].rotation.x = 0;
      }
      if (armR.handInfo && state.action === 'count') {
        var up = Math.floor((state.actionAge * 2.2) % 4);
        armR.handInfo.fingers.forEach(function (f, idx) {
          var extend = idx <= up ? 0 : 0.5;
          for (var j2 = 1; j2 < f.joints.length; j2++) f.joints[j2].rotation.x = extend;
        });
      }
      if (armR.handInfo && state.action === 'thumb') {
        armR.handInfo.thumb.rotation.z = approach(armR.handInfo.thumb.rotation.z, -1.15, step, 0.18);
      } else if (armR.handInfo) {
        armR.handInfo.thumb.rotation.z = approach(armR.handInfo.thumb.rotation.z, armR.sign * 0.6, step, 0.2);
      }

      /* ---- the mouth: real lip-sync while she speaks ---------------------- */
      speaking.visible = !!state.viseme;
      expression.visible = !state.viseme;
      if (state.viseme) {
        var shape = VISEME_SHAPES[state.viseme] || VISEME_SHAPES.rest;
        var jaw = state.jaw || 0;
        var energy = 0.5 + jaw * 0.8;
        var openTarget = clamp(shape.open * energy, 0.015, 1.0);
        var wideTarget = clamp(shape.wide * (1 - shape.round * 0.4), 0.2, 1.15);
        state.mouth.open = approach(state.mouth.open, openTarget, step, 0.032);
        state.mouth.wide = approach(state.mouth.wide, wideTarget, step, 0.045);
        state.mouth.round = approach(state.mouth.round, shape.round, step, 0.05);
        state.mouth.teeth = approach(state.mouth.teeth, shape.teeth, step, 0.055);
        state.mouth.tongue = approach(state.mouth.tongue, shape.tongue, step, 0.055);

        var m = state.mouth;
        var halfW = 0.05 * m.wide;
        var halfH = 0.006 + 0.042 * m.open * (1 - m.round * 0.32);
        cavity.scale.set(halfW, halfH, 0.02);
        lips.scale.set(halfW * 1.1, halfH * 1.22, 0.016);
        lips.position.y = 0;
        teeth.visible = m.teeth > 0.12;
        if (teeth.visible) {
          teeth.scale.set(halfW * 0.82, 0.006 + halfH * 0.13, 0.018);
          teeth.position.y = halfH * 0.6;
        }
        tongue.visible = m.tongue > 0.1;
        if (tongue.visible) {
          tongue.scale.set(halfW * 0.55, 0.005 + halfH * 0.17, 0.018);
          tongue.position.y = -halfH * 0.5;
        }
      } else {
        var wantSmile = (pose.smile + state.sparkle * 0.25) / 1.25;
        smile.visible = wantSmile > 0.15 && state.state !== 'praying' && state.state !== 'thinking';
        smile.scale.setScalar(0.72 + wantSmile * 0.5);
        smileLow.visible = smile.visible && wantSmile < 0.75;
        smileLow.scale.setScalar(0.7 + wantSmile * 0.4);
        thinkMouth.visible = state.state === 'thinking';
        prayMouth.visible = state.state === 'praying';
        state.mouth.open = approach(state.mouth.open, 0, step, 0.08);
      }

      /* ---- eyes: a natural blink (fast close, slower open, doubles) */
      state.blink.next -= step;
      if (state.blink.next <= 0) {
        state.blink.t = 0;
        state.blink.phase = 0;
        // every fifth blink or so is a natural double blink
        state.blink.double = Math.random() < 0.18;
        state.blink.next = 2.4 + Math.random() * 3.6;
      }
      if (state.blink.t >= 0) {
        state.blink.t += step;
        var closeT = 0.07, openT = 0.11;
        if (state.blink.t < closeT) state.blink.closed = state.blink.t / closeT;
        else if (state.blink.t < closeT + openT) state.blink.closed = 1 - (state.blink.t - closeT) / openT;
        else if (state.blink.double && state.blink.t < closeT + openT + 0.09 + closeT + openT) {
          var t2 = state.blink.t - closeT - openT - 0.09;
          state.blink.closed = t2 < closeT ? t2 / closeT : Math.max(0, 1 - (t2 - closeT) / openT);
        } else {
          state.blink.closed = 0;
          state.blink.t = -1;
        }
        state.blink.closed = clamp(state.blink.closed, 0, 1);
        if (state.blink.closed > 0.95) state.blink.closed = 1;
      } else {
        state.blink.closed = approach(state.blink.closed, 0, step, 0.07);
      }
      // the eyes make brief little glances (saccades) and then come back to
      // the member — a gaze that drifts off centre and stays there reads shifty
      state.saccade = state.saccade || { x: 0, y: 0, t: 0 };
      if (state.saccade.t <= 0 && Math.random() < 0.004 * speed) {
        state.saccade.x = (Math.random() - 0.5) * 0.5;
        state.saccade.y = (Math.random() - 0.5) * 0.32;
        state.saccade.t = 0.5 + Math.random() * 0.3;
      }
      if (state.saccade.t > 0) {
        state.saccade.t -= step;
        state.gaze.x = approach(state.gaze.x, state.saccade.x, step, 0.12);
        state.gaze.y = approach(state.gaze.y, state.saccade.y, step, 0.12);
      } else {
        state.gaze.x = approach(state.gaze.x, 0, step, 0.5);
        state.gaze.y = approach(state.gaze.y, 0, step, 0.5);
      }
      var widen = state.state === 'celebrating' ? 1.08 : (state.state === 'listening' ? 1.03 : 1);
      state.look.x = approach(state.look.x, state.gaze.x * 0.03, step, 0.1);
      state.look.y = approach(state.look.y, -state.gaze.y * 0.022, step, 0.1);
      ['R', 'L'].forEach(function (key) {
        var eye = eyes[key];
        eye.eye.position.x = state.look.x;
        eye.eye.position.y = state.look.y;
        var closed = state.blink.closed;
        eye.lid.scale.y = 0.34 + closed * 1.75;
        eye.lid.position.y = 0.016 + closed * 0.036;
        eye.lidLow.scale.y = 0.24 + closed * 1.4;
        eye.lidLow.position.y = -0.02 - closed * 0.03;
        eye.eye.scale.set(1, widen * (1 - closed * 0.94), 1);
        eye.iris.scale.setScalar(1 + (state.state === 'celebrating' ? 0.12 : 0));
      });

      /* ---- brows rise with the mood */
      var browY = 0.096 + pose.browRaise * 0.02;
      brows.R.position.y = browY;
      brows.L.position.y = browY;
      brows.R.rotation.z = 0.1 - pose.browRaise * 0.05;
      brows.L.rotation.z = -0.1 + pose.browRaise * 0.05;

      /* ---- cheeks glow when she is pleased */
      var glow = clamp(pose.smile * 0.45 + state.sparkle * 0.4, 0, 0.7);
      cheeks.forEach(function (cheek) { cheek.material.opacity = 0.24 + glow * 0.28; });

      /* ---- floating celebration dust */
      for (var i = 0; i < sparks.length; i++) {
        var s = sparks[i];
        if (s.life <= 0) continue;
        s.life -= step;
        if (s.life <= 0) { s.mesh.visible = false; continue; }
        s.mesh.position.x += s.vx * step;
        s.mesh.position.y += s.vy * step;
        s.mesh.position.z += s.vz * step;
        s.vy -= step * 0.26;
        s.mesh.rotation.z += step * 2.2;
        s.mesh.scale.setScalar(0.35 + (s.life / s.max) * 0.9);
      }
      if (state.sparkle > 0) state.sparkle = Math.max(0, state.sparkle - step * 0.9);

      return rig;
    };

    rig.dispose = function () {
      for (var i = 0; i < geo.length; i++) { try { geo[i].dispose(); } catch (e) {} }
      for (var j = 0; j < mats.length; j++) { try { mats[j].dispose(); } catch (e) {} }
      geo.length = 0;
      mats.length = 0;
      if (root.parent) root.parent.remove(root);
      while (root.children.length) root.remove(root.children[0]);
      return rig;
    };

    return rig;
  }

  /* ------------------------------------------------------------------ export */

  global.PDDomeyLady = {
    version: VERSION,
    visemes: VISEMES.slice(),
    visemeShapes: VISEME_SHAPES,
    actions: ACTIONS.slice(),
    states: STATES.slice(),
    actionPoses: ACTION_POSES,
    buildRig: buildRig
  };
})(typeof window !== 'undefined' ? window : this);
