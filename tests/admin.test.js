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

// Admin access must reuse the shared Firebase session; there is intentionally
// no second credential form or localStorage-based authentication shortcut.
for (const [label, ok] of [
  ['admin persistence uses Firebase browserLocalPersistence', html.includes('browserLocalPersistence') && html.includes('setPersistence(auth, browserLocalPersistence)')],
  ['admin dashboard is gated by the existing Firebase auth state', html.includes('onAuthStateChanged(auth') && html.includes("snap.data().role === 'admin'")],
  ['admin page does not expose a second sign-in flow', !html.includes('signInWithEmailAndPassword') && !html.includes('id="adminPassword"') && !html.includes('window.adminLogin')]
]) {
  if (ok) console.log('PASS  ' + label);
  else { console.error('FAIL  ' + label); process.exitCode = 1; }
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

/* ---------------------------------------------------------------------------
 * Admin session continuity — "sign in once, stay signed in".
 * Firestore is the authority on the admin role, the confirmed session is
 * mirrored per device, and the console must never ask a verified administrator
 * to sign in again (reload, new tab, second tab, slow network).
 * ------------------------------------------------------------------------- */
for (const [label, ok] of [
  ['admin console accepts the admin role from memberships/<uid>',
    html.includes('doc(db, "memberships", user.uid)') && html.includes('adminRoleFromSnap(membershipSnap)')],
  ['admin console accepts the admin role from users/<uid> (the rules fallback)',
    html.includes('doc(db, "users", user.uid)') && html.includes('adminRoleFromSnap(userSnap)')],
  ['role checks retry instead of treating a network blip as "not an admin"',
    /async function verifyAdminRole\(user, attempts = 3\)/.test(html) && html.includes('await sleep(500 * (attempt + 1))')],
  ['a confirmed session is remembered on the device (localStorage mirror)',
    html.includes('ADMIN_SESSION_TTL') && html.includes('trustedSessionFor(user)') &&
    html.includes('sessionIsFresh(session)')],
  ['the console opens from the stored session before Firestore answers',
    /trusted = trustedSessionFor\(user\)[\s\S]*?openAdminConsole\(user, \{ fullName: trusted\.name \}/.test(html)],
  ['an unreachable Firestore keeps a verified tab inside the console',
    html.includes("verdict.reason === 'error' && trusted && sessionIsFresh(trusted)")],
  ['a revoked role closes the console live (onSnapshot on memberships)',
    html.includes('onSnapshot(doc(db, "memberships", user.uid)') && html.includes('function watchAdminRole(user)')],
  ['signing out in another tab is picked up here',
    html.includes("window.addEventListener('storage'") && html.includes('event.key !== ADMIN_SESSION_KEY')],
  ['returning to the tab re-checks access without a reload',
    html.includes("window.addEventListener('focus'") && html.includes('window.recheckAdminAccess = async (silent = false)')],
  ['the fallback loader never sends a verified session back to sign-in',
    html.includes('function sessionIsTrusted()') &&
    /if \(sessionIsTrusted\(\)\) return;/.test(html)],
  ['the sign-in card offers a retry and the single sign-in entry point',
    html.includes('onclick="recheckAdminAccess()"') && html.includes('href="account.html?next=admin"') &&
    html.includes('id="loginHint"')],
  ['the console never trusts the local session without Firestore while online',
    /if \(verdict\.admin\) \{[\s\S]*?return;[\s\S]*?\}/.test(html) && html.includes('stopAdminRoleWatch()')]
]) {
  if (ok) console.log('PASS  ' + label);
  else { console.error('FAIL  ' + label); process.exitCode = 1; }
}

// The console owns exactly one navigation. The marketing topbar/drawer must
// never be injected next to the admin sidebar, and every menu item must resolve
// its view from data, not from its position in the list.
for (const [label, ok] of [
  ['admin console opts out of the injected marketing layout',
    /<html[^>]*data-pd-layout="none"/.test(html)],
  ['every sidebar item carries the view it opens',
    [...html.matchAll(/<div class="nav-item[^"]*"[^>]*>/g)].every((match) => /data-view="/.test(match[0])) &&
    /class="nav-item active" data-view="dashboard"/.test(html)],
  ['menu highlighting is resolved by view id, never by position',
    html.includes('window.pdNavFor = (viewOrElement)') && !html.includes("querySelectorAll('.nav-item')[")],
  ['every switchView target exists as a view panel', (() => {
    const views = new Set([...html.matchAll(/id="view-([a-z_-]+)"/g)].map((match) => match[1]));
    return [...html.matchAll(/switchView\('([a-z_-]+)'/g)].every((match) => views.has(match[1]));
  })()],
  ['view switching closes the mobile menu, resets scroll and keeps the URL in step',
    html.includes('window.toggleSidebar(false)') && /content\.scrollTop = 0/.test(html) &&
    html.includes('history.replaceState(null, \'\', hash)')],
  ['deep links and back/forward switch views in place',
    html.includes("window.addEventListener('hashchange'") && html.includes('function viewFromHash()')],
  ['the mobile menu closes from the scrim and the Escape key',
    html.includes('id="sidebarScrim"') && html.includes("if (event.key === 'Escape') window.toggleSidebar(false);")],
  ['the account page hands an admin straight to the console',
    fs.readFileSync(path.join(root, 'account.html'), 'utf8').includes('continueToAdminConsoleIfRequested')]
]) {
  if (ok) console.log('PASS  ' + label);
  else { console.error('FAIL  ' + label); process.exitCode = 1; }
}
