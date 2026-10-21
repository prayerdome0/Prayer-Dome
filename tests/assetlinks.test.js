'use strict';
/*
 * Android Digital Asset Links checks (scripts/assetlinks.mjs).
 *
 * The published /.well-known/assetlinks.json is what Android fetches to decide
 * whether a link opens in the Prayer Dome app or in the browser. Both halves
 * have to agree with the shipped app, and neither failure is visible in the
 * browser, so these checks pin:
 *
 *   • the file is valid JSON and carries a statement for the package this
 *     repository builds (net.prayerdome.app) — the regression that shipped a
 *     file referring only to the legacy Median listing,
 *   • every fingerprint is a 32-byte SHA-256 value; the SHA-1 fingerprints that
 *     Play and keytool print first are rejected with an explanation,
 *   • a certificate cannot be pasted next to a package that is not this app,
 *   • the deployed endpoint must answer 200 with JSON, not redirect, and match
 *     the repository — tested against local servers, no network needed,
 *   • the hosting headers keep serving it as JSON,
 *   • nothing spoofs a user agent to fake a browser identity.
 */
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TOOL = path.join('scripts', 'assetlinks.mjs');
const FILE = path.join(ROOT, '.well-known', 'assetlinks.json');

let passed = 0;
function t(name, ok, extra = '') {
  if (ok) { passed += 1; console.log('PASS  ' + name); }
  else { console.error('FAIL  ' + name + (extra ? '  ' + extra : '')); process.exitCode = 1; }
}

// The values the app owner supplied, kept here so the triage is regression
// tested: three are 32-byte SHA-256, three are 20-byte SHA-1 and can never be
// used in this file.
const SHA256_PRIMARY = '43:70:D7:09:23:4E:F0:0B:A5:E0:88:1E:24:23:C6:1D:BB:76:48:F0:FB:31:1E:00:1F:D2:7B:D2:5A:B9:5C:70';
const SHA256_SECOND = '8E:FE:79:08:BE:C6:D9:EA:8F:4E:F7:9C:66:FE:4B:1E:07:3C:76:59:D1:96:42:C6:93:90:3C:7A:B7:AE:67:D5';
const SHA1_SUPPLIED = '80:6D:53:AC:A3:CA:F6:D7:7D:F8:37:39:F4:F6:DE:43:F3:F4:2B:0E';

const statement = (packageName, fingerprints, relation = ['delegate_permission/common.handle_all_urls']) => ([{
  relation,
  target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: fingerprints }
}]);

function run(args) {
  const result = spawnSync(process.execPath, [TOOL, ...args], { cwd: ROOT, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

/** Serve a fixed response so the endpoint checks run without the internet. */
function serve(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

(async () => {
  const links = await import(path.join('file://', ROOT, 'scripts', 'assetlinks.mjs'));

  /* ------------------------------------------------------ fingerprints */
  const primary = links.describeFingerprint(SHA256_PRIMARY);
  t('a 32-byte SHA-256 fingerprint is accepted',
    primary.ok === true && primary.bytes === 32 && primary.normalized === SHA256_PRIMARY);

  const sha1 = links.describeFingerprint(SHA1_SUPPLIED);
  t('a 20-byte SHA-1 fingerprint is rejected and named as SHA-1',
    sha1.ok === false && sha1.bytes === 20 && /SHA-1/.test(sha1.reason) && /SHA-256/.test(sha1.reason),
    JSON.stringify(sha1));

  t('a truncated or padded fingerprint is rejected',
    links.describeFingerprint('43:70:D7:09:23:4E:F0:0B:A5:E0:88:1E:24:23:C6:1D:BB:76:48:F0:FB:31:1E:00:1F:D2:7B:D2:5A:B9:5C').ok === false);
  t('a value with non-hex characters is rejected',
    links.describeFingerprint('ZZ:70:D7:09').ok === false);
  t('a non-string is rejected', links.describeFingerprint(null).ok === false);

  const lowercase = links.describeFingerprint(SHA256_PRIMARY.toLowerCase());
  t('a valid fingerprint in lower case is accepted but flagged as non-canonical',
    lowercase.ok === true && lowercase.normalized === SHA256_PRIMARY && /uppercase/.test(lowercase.reason));

  /* ------------------------------------------------ the shipped file */
  const packages = links.readAppPackages(ROOT);
  t('the app package is read from Gradle and Capacitor, and they agree',
    packages.gradle === 'net.prayerdome.app' && packages.capacitor === 'net.prayerdome.app',
    JSON.stringify(packages));

  const shipped = links.validateText(fs.readFileSync(FILE, 'utf8'), { appPackages: packages.packages });
  t('the published assetlinks.json is valid', shipped.ok === true, shipped.errors.join('\n'));
  t('it has a statement for the app this repository builds',
    shipped.targets.some((target) => target.package === 'net.prayerdome.app' && target.kind === 'application'),
    JSON.stringify(shipped.targets.map((target) => target.package)));
  t('it has no SHA-1 fingerprints in sha256_cert_fingerprints',
    shipped.targets.every((target) => target.fingerprints.every((entry) => entry.bytes === 32)));
  t('it keeps the legacy Median listing instead of dropping installed installs',
    shipped.targets.some((target) => target.package === 'co.median.android.qdoxnjx' && target.kind === 'legacy'));
  t('the app package statement carries the supplied SHA-256 fingerprint',
    shipped.targets.find((target) => target.package === 'net.prayerdome.app')
      .fingerprints.some((entry) => entry.normalized === SHA256_PRIMARY));

  /* ------------------------------------------------------- validation rules */
  const options = { appPackages: ['net.prayerdome.app'], legacyPackages: links.LEGACY_PACKAGES };

  t('a JSON object instead of an array is rejected',
    links.validateText('{"target":{}}', options).ok === false &&
    /array/.test(links.validateText('{"target":{}}', options).errors.join(' ')));

  const broken = links.validateText('{ not json', options);
  t('invalid JSON is reported as such and not thrown',
    broken.ok === false && /not valid JSON/.test(broken.errors[0]));

  const sha1File = links.validateAssetLinks(statement('net.prayerdome.app', [SHA1_SUPPLIED]), options);
  t('a SHA-1 fingerprint inside the shipped file is an error',
    sha1File.ok === false && /SHA-1/.test(sha1File.errors.join('\n')), sha1File.errors.join('\n'));

  const stranger = links.validateAssetLinks(statement('com.example.other', [SHA256_PRIMARY]), options);
  t('a package that is not this app is rejected',
    stranger.ok === false && /not the package this repository builds/.test(stranger.errors.join('\n')),
    stranger.errors.join('\n'));

  const misplaced = links.validateAssetLinks([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'net.prayerdome.app',
      // Fingerprint 1 belongs with net.prayerdome.app; putting a second app's
      // certificate here would hand this domain's links to that other app.
      sha256_cert_fingerprints: [SHA256_PRIMARY, 'not-a-fingerprint']
    }
  }], options);
  t('a malformed fingerprint is reported per value',
    misplaced.ok === false && /fingerprint 2/.test(misplaced.errors.join('\n')));

  const noRelation = links.validateAssetLinks(statement('net.prayerdome.app', [SHA256_PRIMARY], ['delegate_permission/common.use_as_origin']), options);
  t('a statement without handle_all_urls is rejected',
    noRelation.ok === false && /handle_all_urls/.test(noRelation.errors.join('\n')));

  const wrongNamespace = links.validateAssetLinks([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'web', package_name: 'net.prayerdome.app', sha256_cert_fingerprints: [SHA256_PRIMARY] }
  }], options);
  t('a non-android_app namespace is rejected',
    wrongNamespace.ok === false && /namespace/.test(wrongNamespace.errors.join('\n')));

  const duplicated = links.validateAssetLinks([
    ...statement('net.prayerdome.app', [SHA256_PRIMARY]),
    ...statement('net.prayerdome.app', [SHA256_SECOND])
  ], options);
  t('the same package twice is rejected (fingerprints belong in one target)',
    duplicated.ok === false && /merge the fingerprints/.test(duplicated.errors.join('\n')));

  const noApp = links.validateAssetLinks(statement('co.median.android.qdoxnjx', ['40:9D:FC:AF:E0:C9:6F:71:EF:01:20:3E:92:F6:B3:6C:22:CF:93:70:22:F5:F9:2E:4B:78:DD:8A:92:46:70:E8']), options);
  t('a file that forgets the app this repository builds is rejected',
    noApp.ok === false && /no statement for it/.test(noApp.errors.join('\n')), noApp.errors.join('\n'));

  const duplicatedWithin = links.validateAssetLinks(statement('net.prayerdome.app', [SHA256_PRIMARY, SHA256_PRIMARY]), options);
  t('the same fingerprint twice inside one target is rejected',
    duplicatedWithin.ok === false && /listed twice/.test(duplicatedWithin.errors.join('\n')));

  /* ------------------------------------------------------ endpoint fetch */
  t('an origin becomes the well-known URL',
    links.assetLinksUrl('prayerdome.net') === 'https://prayerdome.net/.well-known/assetlinks.json');
  t('a full endpoint URL is kept as given',
    links.assetLinksUrl('https://prayerdome.net/.well-known/assetlinks.json') === 'https://prayerdome.net/.well-known/assetlinks.json');

  const body = fs.readFileSync(FILE, 'utf8');
  const good = await serve((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(body);
  });
  const fetched = await links.inspectEndpoint(good.base);
  t('a 200 application/json endpoint is accepted', fetched.ok === true, JSON.stringify(fetched.problems));

  const validRemote = links.validateText(fetched.text, { appPackages: packages.packages });
  t('the fetched body is validated like the local file', validRemote.ok === true);
  t('a deployed copy identical to the repository is not reported as drift',
    links.compareWithLocal(validRemote.targets, shipped.targets).length === 0);

  const redirected = await serve((request, response) => {
    response.writeHead(302, { location: 'https://prayerdome.net/404.html' });
    response.end();
  });
  const redirectCheck = await links.inspectEndpoint(redirected.base);
  t('a redirect is rejected the way Android rejects it',
    redirectCheck.ok === false && /redirect/.test(redirectCheck.problems.join(' ')),
    JSON.stringify(redirectCheck.problems));

  const html = await serve((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(body);
  });
  const htmlCheck = await links.inspectEndpoint(html.base);
  t('a JSON body served as HTML is rejected',
    htmlCheck.ok === false && /application\/json/.test(htmlCheck.problems.join(' ')),
    JSON.stringify(htmlCheck.problems));

  const missing = await serve((request, response) => {
    response.writeHead(404, { 'content-type': 'text/html' });
    response.end('Not found');
  });
  const missingCheck = await links.inspectEndpoint(missing.base);
  t('a 404 endpoint is rejected',
    missingCheck.ok === false && /HTTP 404/.test(missingCheck.problems.join(' ')),
    JSON.stringify(missingCheck.problems));

  const drifted = await serve((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(statement('net.prayerdome.app', [SHA256_SECOND])));
  });
  const driftedCheck = await links.inspectEndpoint(drifted.base);
  const drift = links.compareWithLocal(
    links.validateText(driftedCheck.text, { appPackages: packages.packages }).targets,
    shipped.targets
  );
  t('a deployed copy with a different fingerprint is reported as drift',
    drift.length > 0 && drift.some((entry) => /not in the repository file/.test(entry)), JSON.stringify(drift));

  const unreachable = await links.inspectEndpoint('http://127.0.0.1:1');
  t('an unreachable endpoint reports a problem instead of throwing',
    unreachable.ok === false && Array.isArray(unreachable.problems) && unreachable.problems.length > 0);

  for (const { server } of [good, redirected, html, missing, drifted]) {
    await new Promise((resolve) => server.close(resolve));
  }

  /* -------------------------------------------------------------- hosting */
  for (const [name, source] of [['vercel.json', '/.well-known/assetlinks.json'], ['firebase.json', '/.well-known/assetlinks.json']]) {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));
    const headers = name === 'vercel.json' ? config.headers : config.hosting.headers;
    const rule = (headers || []).find((entry) => entry.source === source);
    t(`${name} serves assetlinks.json as JSON`,
      Boolean(rule) && rule.headers.some((header) => header.key === 'Content-Type' &&
        /^application\/json/.test(header.value)), JSON.stringify(rule));
  }
  for (const [name, config] of [['vercel.json', JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))],
    ['firebase.json', JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8')).hosting]]) {
    const redirects = config.redirects || [];
    t(`${name} does not redirect the well-known path`,
      !redirects.some((rule) => String(rule.source || '').includes('well-known')));
  }

  /* ------------------------------------------------------------- tooling */
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  t('package.json exposes the check', Boolean(pkg.scripts['assetlinks:check']));
  t('package.json exposes the deployed-endpoint check', /--url/.test(pkg.scripts['assetlinks:verify'] || ''));
  t('the check runs in the test suite', pkg.scripts.test.includes('tests/assetlinks.test.js'));

  const cli = run([]);
  t('the CLI exits 0 for the shipped file', cli.status === 0, cli.stdout + cli.stderr);
  t('the CLI prints the verified SHA-256 next to the package',
    cli.stdout.includes('net.prayerdome.app') && cli.stdout.includes(SHA256_PRIMARY));

  const json = run(['--json']);
  const parsed = JSON.parse(json.stdout);
  t('the CLI emits a machine-readable report',
    json.status === 0 && parsed.ok === true && parsed.local.targets.length >= 2);
  t('a missing file is reported, not thrown',
    run(['--file', path.join(ROOT, 'does-not-exist.json')]).status === 1);
  t('an unknown option is a usage error (exit 2)', run(['--nope']).status === 2);
  t('--help exits 0', run(['--help']).status === 0);

  /* --------------------------------------------- identity, not disguise */
  // The brief forbids faking a browser identity. Nothing in the site may
  // rewrite navigator.userAgent; the only legitimate use is reading it.
  const pages = fs.readdirSync(ROOT).filter((name) => name.endsWith('.html'));
  const spoofs = pages.filter((name) => /navigator\s*\.\s*userAgent\s*=/.test(fs.readFileSync(path.join(ROOT, name), 'utf8')));
  t('no page rewrites navigator.userAgent to impersonate a browser', spoofs.length === 0, spoofs.join(', '));

  console.log(`\nAndroid Digital Asset Links checks passed (${passed} assertions).`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
