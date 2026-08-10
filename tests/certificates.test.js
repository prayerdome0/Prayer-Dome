/*
 * Smoke tests for the certificate tracking UI:
 *   - account.html "My Certificates" section renders local + Firestore certs
 *     and binds download buttons.
 *   - admin.html "Certificates" tracker renders the issued list, KPIs and
 *     search filter from Firestore data.
 * Extracts the relevant code blocks from each page's module script and runs
 * them in jsdom with stubbed Firebase APIs.
 *
 * Requires jsdom (same as pages.test.js / premium.test.js):
 *   npm install --no-save jsdom
 *   node tests/certificates.test.js
 */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function t(name, ok, extra) {
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  ' + extra : ''));
}

try {
  require('jsdom');
} catch (e) {
  console.log('SKIP  jsdom not installed — run: npm install --no-save jsdom');
  process.exit(0);
}

const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');

function moduleScript(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no module script in ' + file);
  return m[1];
}

// Balanced-brace slice starting at `marker` (inclusive of the closing brace line).
function sliceBalanced(code, marker) {
  const start = code.indexOf(marker);
  if (start < 0) throw new Error('marker not found: ' + marker);
  let i = code.indexOf('{', start);
  let depth = 0;
  for (; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) return code.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced block: ' + marker);
}

// ---------------------------------------------------------------- account
(function accountTest() {
  const code = moduleScript('account.html');
  const helpers =
    code.match(/window\.escapeHtml = [^\n]*/)[0] + '\n' +
    sliceBalanced(code, 'window.showToast = (msg, type) => {') + '\n';
  const start = code.indexOf('// ==================== MY CERTIFICATES ====================');
  const end = code.indexOf('function updateVerificationStatus');
  const certCode = code.slice(start, end) +
    '\nwindow._loadMyCerts = loadMyCertificates;';

  const html = fs.readFileSync(path.join(ROOT, 'account.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'https://prayerdome.net/account', runScripts: 'outside-only' });
  const w = dom.window;
  w.localStorage.setItem('pd_academy_progress', JSON.stringify({
    certificates: [{ id: 'PD-LOCAL-1', title: 'Foundations of Prayer', score: 90, date: '2026-07-01T00:00:00Z', name: 'Jane Doe' }]
  }));
  w.localStorage.setItem('pd_certificate_name', 'Jane Doe');
  w.auth = { currentUser: { uid: 'user-1' } };
  w.PDCertificate = {
    bindButton(btn, opts) { btn.__opts = opts; },
    preview: async () => 'data:image/png;base64,AAAA'
  };
  w.getDocs = async () => ({
    empty: false,
    forEach(fn) {
      [
        { id: 'PD-CLOUD-1', data: () => ({ id: 'PD-CLOUD-1', userId: 'user-1', course: 'The Power of Prayer', score: 88, date: '2026-07-15T00:00:00Z', name: 'Jane Doe' }) },
        { id: 'PD-CLOUD-2', data: () => ({ id: 'PD-CLOUD-2', userId: 'user-1', course: 'Intercession 101', score: 95, date: '2026-08-01T00:00:00Z', name: 'Jane Doe' }) }
      ].forEach(fn);
    }
  });
  w.query = () => ({}); w.collection = () => ({}); w.where = () => ({}); w.orderBy = () => ({}); w.limit = () => ({});
  w.db = {};
  w.doc = () => ({}); w.updateDoc = async () => {}; w.increment = n => n;

  try {
    w.eval(helpers);
    w.eval(certCode);
    w._loadMyCerts().then(() => {
      const d = w.document;
      const list = d.getElementById('myCertificatesList');
      t('account: certificate cards render (local + Firestore)',
        d.querySelectorAll('.cert-card').length === 3, d.querySelectorAll('.cert-card').length + ' cards');
      t('account: course titles shown',
        list.textContent.includes('Foundations of Prayer') && list.textContent.includes('The Power of Prayer'));
      t('account: scores and IDs shown',
        list.textContent.includes('90%') && list.textContent.includes('PD-CLOUD-2'));
      t('account: empty state not shown', !list.textContent.includes('No certificates yet'));
      const btns = [...d.querySelectorAll('.cert-download-btn')];
      t('account: download buttons bound to PDCertificate',
        btns.length === 3 && btns.every(b => b.__opts && b.__opts.id && typeof b.__opts.onDownload === 'function'));
      t('account: print buttons present', d.querySelectorAll('.cert-print-btn').length === 3);
    }).catch(e => { fail++; console.log('FAIL  account exception: ' + e.stack); });
  } catch (e) { fail++; console.log('FAIL  account exception: ' + e.stack); }
})();

// ---------------------------------------------------------------- admin
(function adminTest() {
  const code = moduleScript('admin.html');
  const helpers =
    code.match(/window\.escapeHTML = [^\n]*/)[0] + '\n' +
    sliceBalanced(code, 'window.toast = (msg, type = \'success\') => {') + '\n';
  const aStart = code.indexOf('/* ==================== CERTIFICATES TRACKER ==================== */');
  const aEnd = code.indexOf('window.exportCertificatesCSV', aStart);
  const adminCertCode = sliceBalanced(code, 'window.loadCertificates = async function () {') +
    '\n' + code.slice(code.indexOf('window.renderCertificates = function () {'), code.indexOf('window.filterCertificates')) +
    '\n' + code.slice(aEnd, code.indexOf('\n        };\n', aEnd) + 12);

  const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'https://prayerdome.net/admin', runScripts: 'outside-only' });
  const w = dom.window;
  w.moment = (d) => ({ format: () => String(d) });
  w.URL.createObjectURL = () => 'blob:cert';
  w.URL.revokeObjectURL = () => {};
  const origCreate = w.document.createElement.bind(w.document);
  w.document.createElement = (tag) => tag === 'a' ? { click() {}, style: {} } : origCreate(tag);
  w.confirm = () => true;
  w.toast = () => {};
  w.getDocs = async () => ({
    empty: false,
    forEach(fn) {
      const now = new Date();
      [
        { id: 'doc1', data: () => ({ id: 'PD-1', userId: 'u1', name: 'Jane Doe', email: 'jane@x.com', course: 'Foundations of Prayer', score: 90, date: now.toISOString(), downloads: 3 }) },
        { id: 'doc2', data: () => ({ id: 'PD-2', userId: 'u2', name: 'John Smith', email: 'john@x.com', course: 'Intercession 101', score: 85, date: '2025-12-01T00:00:00Z', downloads: 1 }) },
        { id: 'doc3', data: () => ({ id: 'PD-3', course: 'Old Quiz Cert', score: 80, date: '2025-06-01T00:00:00Z', downloads: 0 }) }
      ].forEach(fn);
    }
  });
  w.query = () => ({}); w.collection = () => ({}); w.orderBy = () => ({}); w.limit = () => ({});
  w.db = {};
  w.doc = () => ({}); w.deleteDoc = async () => {};

  try {
    w.eval(helpers);
    w.eval(adminCertCode);
    w.loadCertificates().then(() => {
      const d = w.document;
      t('admin: certificates table renders all records',
        d.querySelectorAll('#certificatesList tr').length === 3, d.querySelectorAll('#certificatesList tr').length + ' rows');
      t('admin: KPI totals computed',
        String(d.getElementById('certTotalIssued').innerText) === '3' &&
        String(d.getElementById('certTotalDownloads').innerText) === '4');
      t('admin: month KPI counts only current month',
        String(d.getElementById('certThisMonth').innerText) === '1', String(d.getElementById('certThisMonth').innerText));
      t('admin: unlinked cert flagged', d.getElementById('certificatesList').textContent.includes('Unlinked'));
      // search filter
      d.getElementById('certSearchInput').value = 'john';
      w.renderCertificates();
      t('admin: search filters the list',
        d.querySelectorAll('#certificatesList tr').length === 1 &&
        d.getElementById('certificatesList').textContent.includes('John Smith'));
      // csv export does not throw
      w.exportCertificatesCSV();
      t('admin: CSV export runs', true);
    }).catch(e => { fail++; console.log('FAIL  admin exception: ' + e.stack); });
  } catch (e) { fail++; console.log('FAIL  admin exception: ' + e.stack); }
})();

setTimeout(() => {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}, 500);
