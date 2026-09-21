/* Production upgrade regression tests.
 *
 * Verifies the professional upgrade kept its promises:
 *   • GitHub Android CI is staged and installable
 *   • Live streaming connects through TURN relays with a safe HLS fallback
 *   • Media uploads use the native device picker (no third-party widget)
 *   • Certificates follow the member profile
 *   • Team and resources have admin management + security rules
 *   • The Bible works offline through a chapter cache
 *   • Inter is the application font
 *   • Android has the permissions a live-streaming media app needs
 *
 * Run: node tests/upgrade.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;

function t(name, ok, detail) {
  if (ok) { passed++; console.log('PASS', name); }
  else { failed++; console.log('FAIL', name, detail || ''); }
}
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

/* ------------------------------------------------ 1. GitHub Android CI */
const installer = read('scripts/install-workflows.mjs');
const androidWf = read('mobile/android-build.yml');
const verifyWf = read('ci/verify.yml');
t('a one-command workflow installer ships with the repo',
  installer.includes('.github') && installer.includes('android.yml') && installer.includes('verify.yml'));
t('Android CI builds a debug APK and release APK + AAB on GitHub servers',
  androidWf.includes('assembleDebug') && androidWf.includes('bundleRelease') && androidWf.includes('assembleRelease'));
t('Android CI uploads installable artifacts',
  androidWf.includes('actions/upload-artifact') && androidWf.includes('apk/debug'));
t('Android CI configures release signing from repository secrets',
  androidWf.includes('ANDROID_KEYSTORE_BASE64') && androidWf.includes('keystore.properties'));
t('Android CI enables native push when google-services.json is provided',
  androidWf.includes('GOOGLE_SERVICES_JSON'));
t('Android CI pins Java 21, Android API 36 and Node 22',
  androidWf.includes("java-version: '21'") && androidWf.includes('android-36') && androidWf.includes("node-version: '22'"));
t('the Verify workflow runs lint, tests, functions and the Vercel build',
  verifyWf.includes('npm run lint') && verifyWf.includes('npm test') &&
  verifyWf.includes('npm run functions:verify') && verifyWf.includes('npm run build:vercel'));

/* -------------------------------------------- 2. Live streaming quality */
const live = read('assets/pd-live-webrtc.js');
t('live connections include TURN relays so mobile networks can watch',
  /turn:/.test(live) && /turns:/.test(live));
t('relay configuration can be overridden from PD_LIVE_SERVER.iceServers',
  live.includes('cfg.iceServers'));
t('the viewer never switches to an HLS playlist that does not exist',
  live.includes('probeHls') && /probeHls\(.*hlsUrl/.test(live));
t('dropped connections retry with backoff before giving up',
  live.includes('attemptReconnect') && live.includes('Math.min(1500 * this.reconnectAttempts, 5000)'));
t('an unreachable broadcast is surfaced to the viewer UI with retry',
  live.includes("'unreachable'") && live.includes('Viewer.prototype.retry'));
const liveHtml = read('live.html');
t('the live page offers a tap-for-sound affordance for muted autoplay',
  liveHtml.includes('unmuteOverlay') && liveHtml.includes('Tap for sound'));
t('the live page offers a Try Again action when the stream is unreachable',
  liveHtml.includes('unreachableBox') && liveHtml.includes('retryLive'));
const adminHtml = read('admin.html');
t('going live notifies members through the real push pipeline',
  adminHtml.includes('notifyLiveStarted') && adminHtml.includes("type: 'live'"));

/* ------------------------------------------------- 3. Native media picks */
const uploader = read('assets/pd-upload.js');
t('uploads open the device picker directly, not a hosted widget',
  uploader.includes("input.type = 'file'") && !uploader.includes('openUploadWidget'));
t('uploads report progress and can be retried after failure',
  uploader.includes('onprogress') && uploader.includes('Try Again'));
t('upload failures are explained in plain language',
  uploader.includes('No internet connection') || uploader.includes('back online'));
const widgetUsers = ['index.html', 'prayer.html', 'give.html', 'support.html', 'testimony.html', 'admin.html',
  'account.html', 'membership.html', 'chat.html', 'gallery.html'];
for (const page of widgetUsers) {
  const s = read(page);
  t(`${page} uses the native picker instead of the Cloudinary widget`,
    s.includes('PDUpload') && !s.includes('createUploadWidget') && !s.includes('upload-widget.cloudinary.com'));
}

/* -------------------------------------- 4. Profile-driven certificates */
const academy = read('assets/pd-academy.js');
t('certificate names come from the member profile first',
  academy.includes('window.PD_PROFILE') && academy.indexOf('PD_PROFILE') < academy.indexOf("pd_certificate_name"));
t('the academy refreshes the cached profile from users/{uid}',
  academy.includes('syncMemberProfile') && academy.includes("'users', u.uid"));
const quizHtml = read('quiz.html');
t('the quiz centre issues certificates to the profile name',
  quizHtml.includes('PD_PROFILE') && quizHtml.includes('academyName'));
const account = read('account.html');
t('the account page no longer asks members to type a certificate name',
  !account.includes('certNameInput') && account.includes('certProfileName'));

/* ----------------------------------------------- 5. Team & resources */
const team = read('team.html');
for (const need of ['teamMembers', 'openTeamEditor', 'archiveTeamMember', 'restoreTeamMember', 'PDUpload.pick', 'confirm(']) {
  t(`team page has ${need}`, team.includes(need));
}
t('archived team members are hidden from the public but restorable',
  team.includes('archived') && team.includes('Restore'));
const resources = read('resources.html');
for (const need of ['openResourceEditor', 'archiveResource', 'restoreResource', 'pickResourceFile', 'resources']) {
  t(`resources page has ${need}`, resources.includes(need));
}
t('publishing a resource notifies members', resources.includes('notifyNewResource'));
const rules = read('firestore.rules');
for (const col of ['teamMembers', 'resources', 'statuses', 'userQuiz', 'finalExamSubmissions', 'customGroups',
  'userEvents', 'memberCareRequests', 'bibleProgress', 'worshipSongs', 'privateChats', 'leaderboard',
  'financialReports', 'userReminders', 'livePrayers']) {
  t(`security rules cover ${col}`, rules.includes(`match /${col}/`));
}
t('device tokens never leak to other members', rules.includes("isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid)"));

/* --------------------------------------------------- 6. Offline Bible */
const bible = read('bible.html');
t('read chapters are cached on the device', bible.includes('pd_bible_cache_v1') && bible.includes('cachePut'));
t('offline readers get their saved chapter with a clear notice', bible.includes('showOfflineNotice'));
t('a missing chapter shows a friendly message with Try Again', bible.includes('Unable to load this chapter'));
t('the Bible shows how many chapters are saved offline', bible.includes('savedOfflineBadge'));
const pdApp = read('assets/pd-app.js');
t('every page explains what still works while offline',
  pdApp.includes('pdOfflineBanner') && pdApp.includes('downloaded Bible and saved content are still available'));

/* ------------------------------------------------------ 7. Teaching */
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(read('assets/pd-academy-data.js'), sandbox);
const data = sandbox.window.PD_ACADEMY.DATA;
const total = data.quizzes.reduce((s, q) => s + q.questions.length, 0);
t('every lesson quiz now carries a deep question pool (>= 12)', data.quizzes.every(q => q.questions.length >= 12), total);
t('every lesson has lesson-specific questions', data.quizzes.every(q => q.questions.length > 8));
const academyJs = read('assets/pd-academy.js');
t('lesson quizzes support true/false questions', academyJs.includes("raw[1] === 'True' && p.raw[2] === 'False'"));

/* -------------------------------------------------- 8. Typography */
t('Inter is the shared UI font', read('assets/pd-brand.css').includes("--pd-font-body:     'Inter'"));
let montserrat = 0;
for (const f of fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).concat(['assets/pd-brand.css'])) {
  if (read(f).includes('Montserrat')) montserrat++;
}
t('no page or stylesheet references Montserrat anymore', montserrat === 0, montserrat + ' files');
t('the serif is reserved for display headings and certificates',
  read('assets/pd-brand.css').includes('--pd-font-display') && read('assets/pd-brand.css').includes('--pd-font-script'));

/* ------------------------------------------------ 9. Android build */
const manifest = read('android/app/src/main/AndroidManifest.xml');
for (const perm of ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO',
  'android.permission.POST_NOTIFICATIONS', 'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO', 'android.permission.INTERNET']) {
  t(`Android manifest grants ${perm}`, manifest.includes(perm));
}
t('the app identity stays net.prayerdome.app with a clean label',
  read('android/app/src/main/res/values/strings.xml').includes('net.prayerdome.app') &&
  read('android/app/src/main/res/values/strings.xml').includes('>Prayer Dome<'));
const pkg = JSON.parse(read('package.json'));
t('the native push plugin ships with the app', pkg.dependencies['@capacitor/push-notifications'] !== undefined);
const gradle = read('android/app/build.gradle');
t('the release train is versioned for Play', gradle.includes('versionCode 2') && gradle.includes('versionName "1.1.0"'));

/* -------------------------------------------------------- summary */
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
