#!/usr/bin/env node
/*
 * Prayer Dome — still preview of the 3D host, no browser needed.
 * ---------------------------------------------------------------------------
 * Renders the character rigs (assets/pd-domey-lady.js and friends) with a
 * small ray caster built on the vendored three.js, and writes a PNG so the
 * character can be judged on any machine — including CI — without WebGL.
 *
 *   node scripts/preview-domey.mjs [rig] [out.png] [width]
 *     rig   lady | cartoon          (default lady)
 *
 * The shading mirrors the lights PDDomey3D.create() puts on the real stage
 * (warm key, cool blue fill, gold rim), so what you see here is close to what
 * the member sees on the page.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const THREE = await import(pathToFileURL(path.join(ROOT, 'assets/three.module.min.js')));

/* Load a classic "publishes itself on window" asset into a sandbox. */
function loadAsset(rel) {
  const sandbox = {};
  new Function('window', readFileSync(path.join(ROOT, rel), 'utf8'))(sandbox);
  return sandbox;
}

const rigName = process.argv[2] || 'lady';
const outPath = process.argv[3] || path.join(ROOT, 'tmp-preview.png');
const WIDTH = Math.max(80, Math.min(420, parseInt(process.argv[4] || '300', 10)));

const rig = rigName === 'cartoon'
  ? loadAsset('assets/pd-domey3d.js').PDDomey3D.buildRig(THREE, {})
  : loadAsset('assets/pd-domey-lady.js').PDDomeyLady.buildRig(THREE, {});

/* --- scene ---------------------------------------------------------------- */
const scene = new THREE.Scene();
scene.add(rig.root);
// warm the rig up a little so the pose reads (not the very first frame)
for (let i = 0; i < 90; i += 1) rig.update(1 / 60, { state: process.env.POSE || 'idle' });
if (process.env.VISEME) for (let i = 0; i < 30; i += 1) rig.update(1/60, { state: 'speaking', viseme: process.env.VISEME, jaw: 0.9 });

const HEIGHT = Math.round(WIDTH * 13 / 11);
const camera = new THREE.PerspectiveCamera(30, WIDTH / HEIGHT, 0.1, 60);
const FIT_HEIGHT = rigName === 'cartoon' ? 2.85 : 2.78;
const TARGET_Y = rigName === 'cartoon' ? 0.78 : 0.66;
const fov = camera.fov * Math.PI / 180;
const distance = (FIT_HEIGHT / 2) / Math.tan(fov / 2) * 1.04;
camera.position.set(0, TARGET_Y + 0.22, distance);
camera.lookAt(0, TARGET_Y, 0);
camera.updateProjectionMatrix();
camera.updateMatrixWorld();

/* --- lights (mirrors PDDomey3D.create) ------------------------------------ */
const LIGHTS = [
  { dir: new THREE.Vector3(2.0, 3.6, 3.0).normalize(), color: [1.0, 0.945, 0.87], power: 2.15 },
  { dir: new THREE.Vector3(-2.8, 1.6, 2.0).normalize(), color: [0.74, 0.84, 1.0], power: 0.85 },
  { dir: new THREE.Vector3(-1.6, 2.6, -3.0).normalize(), color: [1.0, 0.85, 0.54], power: 1.25 },
  { dir: new THREE.Vector3(0, -1.2, 1.8).normalize(), color: [0.85, 0.73, 0.58], power: 0.35 }
];
const AMBIENT = [0.30, 0.34, 0.42];
const SKY = [0.06, 0.15, 0.32];   // the stage's deep blue, for the backdrop

const raycaster = new THREE.Raycaster();
const normalMatrix = new THREE.Matrix3();
const N = new THREE.Vector3();
const V = new THREE.Vector3();
const hitPoint = new THREE.Vector3();

function shade(hit, viewDir) {
  const mesh = hit.object;
  const mat = mesh.material;
  if (!mat || !mat.color) return [1, 0, 1];
  normalMatrix.getNormalMatrix(mesh.matrixWorld);
  N.copy(hit.face.normal).applyMatrix3(normalMatrix).normalize();
  hitPoint.copy(hit.point);
  let r = AMBIENT[0] * 0.9, g = AMBIENT[1] * 0.9, b = AMBIENT[2] * 0.9;
  for (const light of LIGHTS) {
    const ndl = Math.max(0, N.dot(light.dir));
    r += light.color[0] * light.power * ndl * 0.45;
    g += light.color[1] * light.power * ndl * 0.45;
    b += light.color[2] * light.power * ndl * 0.45;
  }
  // gold rim light from behind
  const rim = Math.pow(1 - Math.max(0, N.dot(viewDir)), 3);
  r += rim * 0.55 * 1.0; g += rim * 0.55 * 0.8; b += rim * 0.55 * 0.35;
  const cr = mat.color.r, cg = mat.color.g, cb = mat.color.b;
  let out = [cr * r, cg * g, cb * b];
  if (mat.emissive && mat.emissiveIntensity) {
    out[0] += mat.emissive.r * mat.emissiveIntensity;
    out[1] += mat.emissive.g * mat.emissiveIntensity;
    out[2] += mat.emissive.b * mat.emissiveIntensity;
  }
  return out;
}

const pixels = Buffer.alloc(WIDTH * HEIGHT * 3);
const ndc = new THREE.Vector2();
const viewDir = new THREE.Vector3();

const t0 = Date.now();
let hitsCount = 0;
for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    const px = (y * WIDTH + x) * 3;
    ndc.set((x / WIDTH) * 2 - 1 + 1 / WIDTH, 1 - (y / HEIGHT) * 2 - 1 / HEIGHT);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(rig.root, true);
    let color = null;
    let alpha = 0;
    // composite up to three transparent shells (blush, sclera shade, …)
    for (let i = Math.min(hits.length, 3) - 1; i >= 0; i -= 1) {
      const hit = hits[i];
      const mat = hit.object.material;
      if (!mat || !mat.color) continue;
      viewDir.copy(raycaster.ray.direction).negate();
      const c = shade(hit, viewDir);
      const a = mat.transparent ? Math.min(1, mat.opacity) : 1;
      if (a >= 1 || !color) {
        if (a >= 1) { color = c; alpha = 1; break; }
        color = c; alpha = a;
      } else {
        color = [color[0] * (1 - a) + c[0] * a, color[1] * (1 - a) + c[1] * a, color[2] * (1 - a) + c[2] * a];
        alpha = Math.min(1, alpha + a);
      }
    }
    if (hits.length) hitsCount += 1;
    if (color && alpha > 0.02) {
      pixels[px] = Math.max(0, Math.min(255, Math.round(color[0] * 255)));
      pixels[px + 1] = Math.max(0, Math.min(255, Math.round(color[1] * 255)));
      pixels[px + 2] = Math.max(0, Math.min(255, Math.round(color[2] * 255)));
    } else {
      // stage backdrop: soft radial blue with a warm glow up top
      const fx = (x / WIDTH - 0.5), fy = (y / HEIGHT - 0.28);
      const d = Math.min(1, Math.sqrt(fx * fx + fy * fy) * 1.9);
      pixels[px] = Math.round((SKY[0] * (1 - d) + 0.02) * 255 * (0.55 + 0.45 * d));
      pixels[px + 1] = Math.round((SKY[1] * (1 - d) + 0.03) * 255 * (0.55 + 0.45 * d));
      pixels[px + 2] = Math.round((SKY[2] * (1 - d) + 0.05) * 255 * (0.55 + 0.45 * d));
    }
  }
}

/* --- write a PNG (via PPM + no deps: minimal encoder using zlib) ---------- */
function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i += 1) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const { deflateSync } = require('node:zlib');
const raw = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT);
for (let y = 0; y < HEIGHT; y += 1) {
  raw[y * (WIDTH * 3 + 1)] = 0;
  pixels.copy(raw, y * (WIDTH * 3 + 1) + 1, y * WIDTH * 3, (y + 1) * WIDTH * 3);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0); ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 6 })),
  chunk('IEND', Buffer.alloc(0))
]);
writeFileSync(outPath, png);
console.log(`preview: ${outPath}  ${WIDTH}x${HEIGHT}  ${Date.now() - t0}ms  ${hitsCount} shaded pixels`);
