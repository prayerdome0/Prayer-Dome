/*
 * Regression checks for the administrator module.
 * The page is a browser module, so parse it with Node without executing it.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!match) throw new Error('admin.html module script not found');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prayer-dome-admin-'));
const moduleFile = path.join(tempDir, 'admin.mjs');
fs.writeFileSync(moduleFile, match[1]);
try {
  execFileSync(process.execPath, ['--check', moduleFile], { stdio: 'pipe' });
  console.log('PASS  admin module is valid JavaScript');
} catch (error) {
  process.stderr.write(error.stdout || '');
  process.stderr.write(error.stderr || '');
  console.error('FAIL  admin module is valid JavaScript');
  process.exitCode = 1;
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

const messagingInit = /\bgetMessaging\s*\(/.test(match[1]);
if (messagingInit) {
  console.error('FAIL  admin module does not require unsupported WebView messaging APIs');
  process.exitCode = 1;
} else {
  console.log('PASS  admin module does not require unsupported WebView messaging APIs');
}

for (const s of ['view-certificates', 'loadCertificates', 'renderCertificates',
  'exportCertificatesCSV', "collection(db, \"certificates\")"]) {
  if (html.includes(s)) {
    console.log('PASS  admin.html includes ' + s);
  } else {
    console.error('FAIL  admin.html is missing ' + s);
    process.exitCode = 1;
  }
}

// Facebook drafts are a manual publishing workflow. Keep the visual library,
// search, caption copy and image hand-off controls from being accidentally
// reduced to the old 25-row text-only table.
for (const s of ['view-facebook', 'Generated posts with images', 'facebookPostSearch',
  'facebook-post-card', 'loadAllFacebookPosts', 'copyFacebookPost',
  'copyFacebookImage', 'downloadFacebookImage', "collection(db, 'facebookPosts')"]) {
  if (html.includes(s)) {
    console.log('PASS  Facebook post library includes ' + s);
  } else {
    console.error('FAIL  Facebook post library is missing ' + s);
    process.exitCode = 1;
  }
}
