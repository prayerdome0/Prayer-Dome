/* Smoke-tests assets/pd-certificate.js with a stubbed Canvas 2D context.
   Verifies the download pipeline runs end to end without exceptions and that
   every drawing op stays on the canvas with finite coordinates. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function t(name, ok, extra = '') { ok ? pass++ : fail++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  ' + extra : '')); }

function makeCtx(log) {
  const ctx = {
    canvas: null, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'start',
    _fontSize: 20,
    ops: [],
    measureText(s) { s = String(s == null ? '' : s); const m = /(\d+(?:\.\d+)?)px/.exec(this.font); const size = m ? +m[1] : 20; this._fontSize = size; return { width: s.length * size * 0.52 }; },
    fillText(s, x, y) { this.ops.push(['fillText', String(s), x, y]); },
    fillRect(x, y, w, h) { this.ops.push(['fillRect', x, y, w, h]); },
    strokeRect(x, y, w, h) { this.ops.push(['strokeRect', x, y, w, h]); },
    drawImage(img, x, y, w, h) { this.ops.push(['drawImage', x, y, w, h]); },
    createRadialGradient() { return { addColorStop() {} }; },
    beginPath() {}, closePath() {}, fill() { this.ops.push(['fill']); }, stroke() { this.ops.push(['stroke']); },
    moveTo(x, y) { this.ops.push(['moveTo', x, y]); }, lineTo(x, y) { this.ops.push(['lineTo', x, y]); },
    quadraticCurveTo(a, b, c, d) { this.ops.push(['quad', a, b, c, d]); },
    arc(x, y, r) { this.ops.push(['arc', x, y, r]); }, ellipse(x, y, rx, ry) { this.ops.push(['ellipse', x, y, rx, ry]); },
    save() {}, restore() {}, translate(x, y) { this.ops.push(['translate', x, y]); }
  };
  return ctx;
}

function runHarness(opts, { logoOk = true, toBlobOk = true } = {}) {
  const logs = { drew: null, saved: [], alerts: [] };
  const sandbox = {
    console: { error() {}, log() {}, warn() {} },
    setTimeout(fn, ms) { fn(); return 0; },
    Image: function () {
      const img = {};
      Object.defineProperty(img, 'src', {
        // fire handlers synchronously so the module's real async timeout guard (4000 ms)
        // cannot win the race against the host event loop in this harness
        set(v) { this._src = v; if (logoOk) { this.naturalWidth = 2457; this.naturalHeight = 2305; if (this.onload) this.onload(); } else if (this.onerror) this.onerror(); },
        get() { return this._src; }
      });
      return img;
    },
    URL: { createObjectURL: () => 'blob:fake', revokeObjectURL() {} },
    Blob: function (parts, o) { this.parts = parts; this.type = o && o.type; },
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    Uint8Array,
    Promise,
    alert(msg) { logs.alerts.push(String(msg)); },
    document: {
      createElement(tag) {
        if (tag === 'canvas') {
          const ctx = makeCtx();
          const canvas = { width: 0, height: 0, getContext: () => { logs.drew = ctx; return ctx; } };
          if (toBlobOk) {
            canvas.toBlob = cb => cb({ fake: true });
            canvas.toDataURL = () => 'data:image/png;base64,AAAA';
          }
          return canvas;
        }
        return { style: {}, click() { logs.saved.push(this.download); }, remove() {} };
      },
      body: { appendChild() {}, removeChild() {} }
    },
    window: {}
  };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets', 'pd-certificate.js'), 'utf8'), sandbox);
  return { PC: sandbox.window.PDCertificate, logs };
}

function assertOpsSane(ops) {
  if (!ops.length) return false;
  return ops.every(op => op.slice(1).every(v => typeof v !== 'number' || (isFinite(v) && v > -1e5 && v < 1e5)));
}

(async () => {
  // Full pipeline with logo available
  const h1 = runHarness({ name: 'Jane Doe', course: 'Foundations of Prayer', score: 92, id: 'PD-FOUND-ABC123', date: '2026-08-09T10:00:00Z' });
  const ok1 = await h1.PC.download({ name: 'Jane Doe', course: 'Foundations of Prayer', score: 92, id: 'PD-FOUND-ABC123', date: '2026-08-09T10:00:00Z' });
  t('download() resolves when rendering succeeds', ok1 === true);
  t('certificate PNG download is triggered with a sane filename', h1.logs.saved.length === 1 && /^prayer-dome-certificate-pd-found-abc123\.png$/.test(h1.logs.saved[0]), h1.logs.saved[0]);
  const ops = h1.logs.drew ? h1.logs.drew.ops : [];
  t('drawing ops have finite in-range coordinates', assertOpsSane(ops), ops.length + ' ops');
  t('logo is drawn onto the certificate', ops.some(o => o[0] === 'drawImage'));
  t('recipient, course and verse are rendered', ['Jane Doe', 'Foundations of Prayer'].every(s => ops.some(o => o[0] === 'fillText' && o[1] === s)));
  t('certificate id is included on the certificate', ops.some(o => o[0] === 'fillText' && o[1].includes('PD-FOUND-ABC123')));

  // Long values must not throw (fitFont shrinks them)
  const h2 = runHarness();
  const ok2 = await h2.PC.download({ name: 'A Very Long Recipient Name That Must Shrink Nicely Onto One Line', course: 'An Extremely Long Course Title About Deep Prayer And Intercession For The Nations Of The Earth Track One', score: 100, id: 'PD-X', date: 'bad-date' });
  t('oversized names and titles still render', ok2 === true && assertOpsSane(h2.logs.drew.ops));

  // Logo failing to load must not break the download
  const h3 = runHarness({}, { logoOk: false });
  const ok3 = await h3.PC.download({ name: 'John Doe', course: 'Prayer 101', score: 80, id: 'PD-P101-QR9', date: '2026-01-01' });
  t('download() still works when the logo cannot load', ok3 === true && !h3.logs.drew.ops.some(o => o[0] === 'drawImage'));

  // Canvas failure surfaces a rejection instead of a crash
  const h4 = runHarness({}, { toBlobOk: false });
  let rejected = false;
  try { await h4.PC.download({ name: 'x', course: 'y' }); } catch (e) { rejected = true; }
  t('download() rejects cleanly when canvas export fails', rejected);

  // preview() renders a data URL (used for the account-page Print flow)
  const h5 = runHarness({ name: 'Print Me', course: 'Prayer 101', score: 85, id: 'PD-PRINT-1' });
  const previewUrl = await h5.PC.preview({ name: 'Print Me', course: 'Prayer 101', score: 85, id: 'PD-PRINT-1' });
  t('preview() returns a PNG data URL', typeof previewUrl === 'string' && previewUrl.startsWith('data:image/png;base64,'));

  // bindButton() fires the onDownload tracking hook after a successful download
  let tracked = null;
  const h6 = runHarness({ name: 'Tracked', course: 'Prayer 101', score: 80, id: 'PD-TRACK-1' });
  const btn = {
    addEventListener(type, fn) { this.fn = fn; },
    disabled: false,
    innerHTML: ''
  };
  h6.PC.bindButton(btn, { name: 'Tracked', course: 'Prayer 101', score: 80, id: 'PD-TRACK-1', onDownload: (o) => { tracked = o; } });
  await btn.fn();
  t('onDownload hook fires with the certificate options', !!tracked && tracked.id === 'PD-TRACK-1');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
