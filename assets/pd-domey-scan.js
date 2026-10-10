/*!
 * Prayer Dome — Domey's realistic head (scan-based 3D rig)
 * ---------------------------------------------------------------------------
 * Domey is drawn from a real human head scan, not a cartoon:
 *   "Infinite-Level 3D Head Scan" by Lee Perry-Smith, triplegangers.com,
 *   licensed CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/).
 *   Licence and attribution: assets/domey/scan/LeePerrySmith_License.txt
 *   The model and its colour map are bundled, so nothing is downloaded from a
 *   paid or rate-limited service at run time.
 *
 * What the rig does, on the CPU, against the scan's own vertices:
 *   - lip-sync: the jaw and lower lip drop with the speech signal (`jaw`), the
 *     mouth widens or rounds for the viseme (`viseme`), and a dark mouth
 *     cavity opens behind the lips.
 *   - head: the head turns toward the gaze, nods on acts, tilts for thinking
 *     and leans for listening. Shoulders stay still; the blend is smooth.
 *   - breathing and a slow idle sway, lighter when `calm` or reduced motion.
 *
 * Honest limits: the scan's eyes are modelled closed, and it is a bust (no
 * arms or hands), so this rig has no blink, no eye gaze and no hand gestures.
 * Those signals are accepted and ignored rather than faked.
 *
 * Works with the existing PDDomey3D host contract: `buildRig(THREE, options)`
 * returns an object with root, update(dt, signals), setViseme, setState, look,
 * act, react, neutralPose and dispose — the same shape as the cartoon rig.
 */
(function (global) {
  'use strict';

  var MODEL_URL = '/assets/domey/scan/LeePerrySmith.glb';
  var TEXTURE_URL = '/assets/domey/scan/Map-COL.jpg';
  var LOAD_TIMEOUT_MS = 15000;

  // Model units (the scan is about 8 units tall, nose tip at z≈2.59).
  var MOUTH_Y = 0.6;        // upper lip line
  var PIVOT = { x: 0, y: -0.7, z: 0 }; // neck pivot for head motion
  var SCALE = 0.34;         // fits the bust in the game's stage
  var MAX_JAW_DROP = 0.42;  // model units at full speech opening
  var CAVITY_Z = 1.85;      // mouth cavity sits just behind the lips

  var VISEME_WIDTH = {
    rest: 1, M: 0.96, F: 0.98, E: 1.1, I: 1.08, A: 1.02, O: 0.86, U: 0.84, L: 1.03
  };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function smooth(e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /* ------------------------------------------------------------- GLB reader */

  var COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  var READERS = {
    5120: function (dv, o) { return dv.getInt8(o); },
    5121: function (dv, o) { return dv.getUint8(o); },
    5122: function (dv, o) { return dv.getInt16(o, true); },
    5123: function (dv, o) { return dv.getUint16(o, true); },
    5125: function (dv, o) { return dv.getUint32(o, true); },
    5126: function (dv, o) { return dv.getFloat32(o, true); }
  };
  var SIZES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

  function readAccessor(gltf, bin, index) {
    var acc = gltf.accessors[index];
    var view = gltf.bufferViews[acc.bufferView];
    var n = COMPONENTS[acc.type];
    var size = SIZES[acc.componentType];
    var stride = view.byteStride || n * size;
    var base = (view.byteOffset || 0) + (acc.byteOffset || 0);
    var dv = new DataView(bin);
    var read = READERS[acc.componentType];
    var out = new Float32Array(acc.count * n);
    for (var i = 0; i < acc.count; i++) {
      for (var c = 0; c < n; c++) {
        out[i * n + c] = read(dv, base + i * stride + c * size);
      }
    }
    return { data: out, count: acc.count, components: n };
  }

  /** Parse a binary glTF (.glb) into plain typed arrays. Throws on bad files. */
  function parseGLB(arrayBuffer) {
    var dv = new DataView(arrayBuffer);
    if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Not a GLB file');
    var jsonLength = dv.getUint32(12, true);
    var jsonText = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer, 20, jsonLength));
    var gltf = JSON.parse(jsonText);
    var binOffset = 20 + jsonLength + 8;
    var bin = arrayBuffer.slice(binOffset);
    var prim = gltf.meshes[0].primitives[0];
    var position = readAccessor(gltf, bin, prim.attributes.POSITION);
    var normal = prim.attributes.NORMAL != null ? readAccessor(gltf, bin, prim.attributes.NORMAL) : null;
    var uv = prim.attributes.TEXCOORD_0 != null ? readAccessor(gltf, bin, prim.attributes.TEXCOORD_0) : null;
    var idx = readAccessor(gltf, bin, prim.indices);
    var indices = new Uint32Array(idx.count);
    for (var i = 0; i < idx.count; i++) indices[i] = idx.data[i];
    return {
      positions: position.data,
      normals: normal ? normal.data : null,
      uvs: uv ? uv.data : null,
      indices: indices,
      vertexCount: position.count
    };
  }

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

  /* ---------------------------------------------------------------- loading */

  var cached = null;

  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error(label + ' took too long')); }, ms);
      promise.then(function (value) { clearTimeout(timer); resolve(value); },
        function (error) { clearTimeout(timer); reject(error); });
    });
  }

  /**
   * Fetch the model and its colour map once. Resolves with the parsed mesh and
   * a THREE.Texture. Rejects on network failure, bad data or timeout, so the
   * caller can fall back to the cartoon rig instead of showing a stuck loader.
   */
  function load(THREE) {
    if (cached) return cached;
    if (!THREE || !global.fetch) return Promise.reject(new Error('3D scan unsupported'));
    var geometryPromise = withTimeout(
      global.fetch(MODEL_URL, { cache: 'force-cache' }).then(function (res) {
        if (!res.ok) throw new Error('Model HTTP ' + res.status);
        return res.arrayBuffer();
      }).then(parseGLB),
      LOAD_TIMEOUT_MS, 'Head model'
    );
    var texturePromise = withTimeout(new Promise(function (resolve, reject) {
      new THREE.TextureLoader().load(TEXTURE_URL, function (tex) {
        if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      }, undefined, function () { reject(new Error('Colour map failed to load')); });
    }), LOAD_TIMEOUT_MS, 'Colour map');
    cached = Promise.all([geometryPromise, texturePromise]).then(function (parts) {
      return { mesh: parts[0], texture: parts[1] };
    });
    cached.catch(function () { cached = null; });
    return cached;
  }

  /* ------------------------------------------------------------------- rig */

  /**
   * Build the rig from a loaded asset (see load). Synchronous, so it can be
   * handed straight to PDDomey3D.create({ rig }).
   */
  function buildRig(THREE, options) {
    options = options || {};
    var asset = options.asset;
    if (!asset || !asset.mesh) throw new Error('buildRig needs a loaded scan asset');
    var lowEnd = options.lowEnd != null ? !!options.lowEnd : isLowEnd();
    var mesh = asset.mesh;
    var n = mesh.vertexCount;
    var base = new Float32Array(mesh.positions); // untouched rest pose
    var pos = new Float32Array(mesh.positions);

    // Per-vertex weights, computed once from the rest pose.
    var wJaw = new Float32Array(n);   // how much the jaw drops this vertex
    var wHead = new Float32Array(n);  // how much the head turn applies
    var wMouth = new Float32Array(n); // lip/mouth region, for width changes
    var wLower = new Float32Array(n); // lower-lip weight, to pull the lip down
    for (var i = 0; i < n; i++) {
      var x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      var front = smooth(0.6, 1.4, z);
      var lateral = 1 - smooth(0.9, 1.6, Math.abs(x));
      var below = 1 - smooth(-1.2, -1.9, y); // stops the drop reaching the neck
      var lower = smooth(MOUTH_Y, MOUTH_Y - 0.25, y);
      wLower[i] = lower * front * lateral;
      wJaw[i] = Math.max(lower, smooth(-0.1, -0.5, y)) * front * lateral * below;
      wMouth[i] = front * lateral * smooth(-0.4, 0.2, y) * (1 - smooth(MOUTH_Y + 0.25, MOUTH_Y + 0.5, y));
      wHead[i] = smooth(-1.1, -0.35, y);
    }

    var geometry = new THREE.BufferGeometry();
    var posAttr = new THREE.BufferAttribute(pos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage || 35048);
    geometry.setAttribute('position', posAttr);
    if (mesh.uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(mesh.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geometry.computeVertexNormals();

    var material = new THREE.MeshStandardMaterial({
      map: asset.texture || null,
      color: 0xffffff,
      roughness: 0.62,
      metalness: 0.0
    });
    var face = new THREE.Mesh(geometry, material);

    // Mouth cavity: a dark disc just behind the lips, seen only when the mouth opens.
    var cavityMat = new THREE.MeshBasicMaterial({ color: 0x3a0f12, side: THREE.DoubleSide });
    var cavity = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), cavityMat);
    cavity.position.set(0, MOUTH_Y - 0.12, CAVITY_Z);
    cavity.scale.set(1.0, 0.02, 1);

    var root = new THREE.Group();
    root.name = 'pd-domey-scan';
    root.add(face);
    root.add(cavity);
    root.scale.setScalar(SCALE);
    root.position.set(0, 0.62, 0); // bust base sits on the stage floor ring

    var state = {
      jaw: 0, jawTarget: 0, viseme: 'rest', width: 1, widthTarget: 1,
      yaw: 0, pitch: 0, roll: 0, lean: 0, actNod: 0, actAge: 99,
      gazeX: 0, gazeY: 0, mode: 'idle', time: 0, frame: 0, calm: false
    };
    var dirtyFrames = 0;

    function applyPose(dt) {
      var k = 1 - Math.exp(-dt * 10);
      state.jaw += (state.jawTarget - state.jaw) * k;
      state.width += (state.widthTarget - state.width) * k;

      var modeLean = state.mode === 'listening' ? 0.06 : 0;
      var modeRoll = state.mode === 'thinking' ? 0.07 : 0;
      var speed = state.calm ? 0.45 : 1;
      var idleYaw = Math.sin(state.time * 0.55) * 0.025 * speed;
      var idlePitch = Math.sin(state.time * 0.8) * 0.012 * speed;
      var nod = state.actAge < 1.2 ? Math.sin(state.actAge * Math.PI / 1.2) * 0.12 : 0;
      var targetYaw = clamp(state.gazeX, -1, 1) * 0.32 + idleYaw;
      var targetPitch = clamp(-state.gazeY, -1, 1) * 0.16 + idlePitch + nod;
      var targetRoll = modeRoll + Math.sin(state.time * 0.4) * 0.008 * speed;
      state.yaw += (targetYaw - state.yaw) * k;
      state.pitch += (targetPitch - state.pitch) * k;
      state.roll += (targetRoll - state.roll) * k;
      state.lean += ((modeLean) - state.lean) * k;

      var mouthOpen = clamp(state.jaw, 0, 1.2);
      var drop = MAX_JAW_DROP * mouthOpen;
      var cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
      var cx = Math.cos(state.pitch + state.lean), sx = Math.sin(state.pitch + state.lean);
      var cz = Math.cos(state.roll), sz = Math.sin(state.roll);
      var w = state.width;

      for (var i = 0; i < n; i++) {
        var bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
        var x = bx, y = by, z = bz;

        // 1. speech: the jaw and lower lip drop, the chin draws back a little.
        var jw = wJaw[i];
        var lw = wLower[i];
        if (drop > 0) {
          y -= drop * (jw * 0.6 + lw * 0.4);
          z -= drop * jw * 0.12;
        }
        // 2. viseme: mouth width (E/I wider, O/U rounder).
        var wm = wMouth[i];
        if (wm > 0 && w !== 1) x *= 1 + (w - 1) * wm;

        // 3. head turn, blended in above the neck, around the neck pivot.
        var hw = wHead[i];
        if (hw > 0) {
          var px = x - PIVOT.x, py = y - PIVOT.y, pz = z - PIVOT.z;
          // roll (z axis)
          var rx = px * cz - py * sz, ry = px * sz + py * cz, rz = pz;
          // yaw (y axis)
          var yx = rx * cy + rz * sy, yy = ry, yz = -rx * sy + rz * cy;
          // pitch (x axis)
          var fx = yx, fy = yy * cx - yz * sx, fz = yy * sx + yz * cx;
          x = PIVOT.x + (x - PIVOT.x) * (1 - hw) + (fx) * hw;
          y = PIVOT.y + (fy) * hw + (y - PIVOT.y) * (1 - hw) ;
          z = PIVOT.z + (fz) * hw + (z - PIVOT.z) * (1 - hw);
        }
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      }
      posAttr.needsUpdate = true;

      // Normals are the expensive part on phones; refresh them less often there.
      dirtyFrames++;
      var every = lowEnd ? 6 : 1;
      if (dirtyFrames >= every) {
        geometry.computeVertexNormals();
        dirtyFrames = 0;
      }

      // Mouth cavity opens with the jaw.
      var open = clamp(mouthOpen, 0, 1);
      cavity.scale.set(0.5 + 0.5 * open, 0.02 + 0.5 * open * (w > 1 ? 0.9 : 1), 1);
      cavity.visible = open > 0.03;
    }

    var rig = {
      THREE: THREE,
      version: 'scan-1',
      root: root,
      lowEnd: lowEnd,
      neutralPose: {},
      update: function (dt, signals) {
        signals = signals || {};
        var step = clamp(typeof dt === 'number' && isFinite(dt) ? dt : 1 / 60, 0.001, 0.1);
        state.time += step;
        state.calm = !!signals.calm;
        if ('state' in signals) rig.setState(signals.state);
        if ('viseme' in signals) rig.setViseme(signals.viseme, signals.jaw);
        if ('gazeX' in signals || 'gazeY' in signals) rig.look(signals.gazeX, signals.gazeY);
        if (signals.act && signals.act !== state.lastAct) { state.lastAct = signals.act; rig.act(signals.act); }
        state.actAge += step;
        state.frame++;
        // On low-end phones the lip-sync and head motion run every other frame.
        if (!lowEnd || state.frame % 2 === 0) applyPose(lowEnd ? step * 2 : step);
        return rig;
      },
      setState: function (name) {
        state.mode = name || 'idle';
        return rig;
      },
      setViseme: function (viseme, jaw) {
        state.viseme = viseme || 'rest';
        state.jawTarget = clamp(typeof jaw === 'number' && isFinite(jaw) ? jaw : 0, 0, 1.2);
        var width = VISEME_WIDTH[state.viseme];
        state.widthTarget = typeof width === 'number' ? width : 1;
        return rig;
      },
      look: function (x, y) {
        state.gazeX = clamp(x || 0, -1, 1);
        state.gazeY = clamp(y || 0, -1, 1);
        return rig;
      },
      act: function () { state.actAge = 0; return rig; },
      react: function () { state.actAge = 0; return rig; },
      dispose: function () {
        geometry.dispose();
        material.dispose();
        cavity.geometry.dispose();
        cavityMat.dispose();
        if (asset.texture) asset.texture.dispose();
        if (root.parent) root.parent.remove(root);
      }
    };
    return rig;
  }

  global.PDDomeyScan = {
    load: load,
    buildRig: buildRig,
    parseGLB: parseGLB,
    isLowEnd: isLowEnd,
    LICENSE: 'Infinite-Level 3D Head Scan by Lee Perry-Smith, triplegangers.com, CC BY 3.0',
    version: 'scan-1'
  };
})(typeof window !== 'undefined' ? window : this);
