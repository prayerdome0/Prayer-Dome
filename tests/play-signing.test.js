'use strict';
/*
 * Android signing identity checks (scripts/play-signing.mjs).
 *
 * Play only accepts an App Bundle signed with the upload key certificate
 * registered for the app. This suite pins the tool that answers "which key is
 * this?" before an upload, using fixtures that live in the file itself: a
 * self-signed test certificate, a PKCS#7 signature block and a Java keystore
 * written byte by byte. No Java, openssl or network access is required.
 *
 *   • the built-in ZIP and PKCS#7 readers find the signing certificate in an
 *     AAB/APK and print the fingerprints Play shows,
 *   • a JKS certificate chain is read without decrypting the private key,
 *   • an upload signed with the wrong key fails with exit 1 and says why,
 *   • an unsigned release bundle fails too, so it can never reach Play,
 *   • the repository keeps the key out of Git and documents the procedure.
 */
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { deflateRawSync } = require('node:zlib');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TOOL = path.join('scripts', 'play-signing.mjs');

let passed = 0;
function t(name, ok, extra = '') {
  if (ok) { passed += 1; console.log('PASS  ' + name); }
  else { console.error('FAIL  ' + name + (extra ? '  ' + extra : '')); process.exitCode = 1; }
}

/* ------------------------------------------------------------- fixtures */

// "CN=Prayer Dome Test Fixture, O=Prayer Dome, OU=Automated Tests", RSA 2048,
// self-signed. Public certificate only — the private key is not part of the
// repository and never was.
const FIXTURE_CERT_DER = Buffer.from(
  'MIIDhzCCAm+gAwIBAgIUJCLmhKHSYHqEMZ1WP6LQ3+w2CIIwDQYJKoZIhvcNAQELBQAwUzEhMB8G' +
  'A1UEAwwYUHJheWVyIERvbWUgVGVzdCBGaXh0dXJlMRQwEgYDVQQKDAtQcmF5ZXIgRG9tZTEYMBYG' +
  'A1UECwwPQXV0b21hdGVkIFRlc3RzMB4XDTI2MTAwNjIwMjMzM1oXDTQ2MTAwMTIwMjMzM1owUzEh' +
  'MB8GA1UEAwwYUHJheWVyIERvbWUgVGVzdCBGaXh0dXJlMRQwEgYDVQQKDAtQcmF5ZXIgRG9tZTEY' +
  'MBYGA1UECwwPQXV0b21hdGVkIFRlc3RzMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA' +
  '06V0Jdj8HD/9yPxgZj/lVKttj+iZOel9qfAaRDIfmR5LPANAudVAvSnQrx8lFj9xNtSGJNvW1fWV' +
  'e+heF7L0OAEUI4X8p8VQrvR+JHf8x/zI5aFCcuefWevkBlDzIK7EYU6hRwshLzbBSE9+dUL6kBZq' +
  'm3AqY4Ib9KdkF29SiPS1iWZG2RucSBdcMjWD2WhktaXjE7081VL8OJKHq4UJDdtrMqW2Y4p4TiGz' +
  'yRGhLXLjidWvMO574aYiwb8g2c9VSJswaPZsrIsQAgyNOeRYkFkQ/Du0ODyeySADvr3UMLVg8zhL' +
  'BAXhZdmvrr6suEjsKWxQOrUZ9qzOPoAflaDO1wIDAQABo1MwUTAdBgNVHQ4EFgQUYDNFtNgCsSHj' +
  'KRLFUOQtK8w3Ri4wHwYDVR0jBBgwFoAUYDNFtNgCsSHjKRLFUOQtK8w3Ri4wDwYDVR0TAQH/BAUw' +
  'AwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAqEv4C9kAeCKZp0t277KviaoZBMriChkwlN7RGyqYvMT/' +
  '6A2xddwUfpNqJffMn6bldCW30cJpoQh+pezKs4WTMzoIDy7CyQ8uE1puPDuLf9g43DCd/ioingzU' +
  'dBc7mhRqzzZ7hrPEsqBgEpoyfbR/F6iuZIwPXXdt6AnvkMeQaAxfbeFUcOP/i/K1TIWXhYaolRHA' +
  'wFDtNGtBgarzsoAwqVxsHYdIUTG4cAFUetpTl1roMa5C79F1V8fVz2Ni9EGM4v21G7LuDak0JiTK' +
  'GflZcwgsBkQ0FvNh+78mUJ33gQkp7/XYhMPXKLDM9q02IL0pLo8HlBHzqr27qsfUIbwgoA==', 'base64');

// openssl crl2pkcs7 -nocrl -certfile c.pem -outform DER — the shape of
// META-INF/CERT.RSA inside a signed bundle.
const FIXTURE_PKCS7 = Buffer.from(
  'MIIDtgYJKoZIhvcNAQcCoIIDpzCCA6MCAQExADALBgkqhkiG9w0BBwGgggOLMIIDhzCCAm+gAwIB' +
  'AgIUJCLmhKHSYHqEMZ1WP6LQ3+w2CIIwDQYJKoZIhvcNAQELBQAwUzEhMB8GA1UEAwwYUHJheWVy' +
  'IERvbWUgVGVzdCBGaXh0dXJlMRQwEgYDVQQKDAtQcmF5ZXIgRG9tZTEYMBYGA1UECwwPQXV0b21h' +
  'dGVkIFRlc3RzMB4XDTI2MTAwNjIwMjMzM1oXDTQ2MTAwMTIwMjMzM1owUzEhMB8GA1UEAwwYUHJh' +
  'eWVyIERvbWUgVGVzdCBGaXh0dXJlMRQwEgYDVQQKDAtQcmF5ZXIgRG9tZTEYMBYGA1UECwwPQXV0' +
  'b21hdGVkIFRlc3RzMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA06V0Jdj8HD/9yPxg' +
  'Zj/lVKttj+iZOel9qfAaRDIfmR5LPANAudVAvSnQrx8lFj9xNtSGJNvW1fWVe+heF7L0OAEUI4X8' +
  'p8VQrvR+JHf8x/zI5aFCcuefWevkBlDzIK7EYU6hRwshLzbBSE9+dUL6kBZqm3AqY4Ib9KdkF29S' +
  'iPS1iWZG2RucSBdcMjWD2WhktaXjE7081VL8OJKHq4UJDdtrMqW2Y4p4TiGzyRGhLXLjidWvMO57' +
  '4aYiwb8g2c9VSJswaPZsrIsQAgyNOeRYkFkQ/Du0ODyeySADvr3UMLVg8zhLBAXhZdmvrr6suEjs' +
  'KWxQOrUZ9qzOPoAflaDO1wIDAQABo1MwUTAdBgNVHQ4EFgQUYDNFtNgCsSHjKRLFUOQtK8w3Ri4w' +
  'HwYDVR0jBBgwFoAUYDNFtNgCsSHjKRLFUOQtK8w3Ri4wDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG' +
  '9w0BAQsFAAOCAQEAqEv4C9kAeCKZp0t277KviaoZBMriChkwlN7RGyqYvMT/6A2xddwUfpNqJffM' +
  'n6bldCW30cJpoQh+pezKs4WTMzoIDy7CyQ8uE1puPDuLf9g43DCd/ioingzUdBc7mhRqzzZ7hrPE' +
  'sqBgEpoyfbR/F6iuZIwPXXdt6AnvkMeQaAxfbeFUcOP/i/K1TIWXhYaolRHAwFDtNGtBgarzsoAw' +
  'qVxsHYdIUTG4cAFUetpTl1roMa5C79F1V8fVz2Ni9EGM4v21G7LuDak0JiTKGflZcwgsBkQ0FvNh' +
  '+78mUJ33gQkp7/XYhMPXKLDM9q02IL0pLo8HlBHzqr27qsfUIbwgoDEA', 'base64');

const FIXTURE_SHA1 = 'D5:13:2A:0F:98:D7:2D:0A:7C:46:47:E5:B3:F8:BD:ED:27:85:06:99';
const FIXTURE_SHA256 = '4C:3F:B4:86:E5:D4:77:E6:C9:61:21:A9:54:4D:7B:A4:6E:C7:98:27:66:1E:EB:0E:DA:BA:BE:7D:10:BB:A9:7B';
// The fingerprint Play reported for the Prayer Dome listing when the upload was
// rejected ("expected … 8D:25:36:…EF:73", the bundle carried "A5:9D:61:…03:B2").
// Play accepts only a bundle signed with the registered upload key certificate.
const PLAY_EXPECTED_SHA1 = '8D:25:36:9B:7B:3B:0C:89:9C:00:5E:DE:E4:63:11:08:CA:15:EF:73';

/* -------------------------------------------------------- zip/JKS writers */

function u16(value) { const b = Buffer.alloc(2); b.writeUInt16LE(value); return b; }
function u32(value) { const b = Buffer.alloc(4); b.writeUInt32LE(value); return b; }
function u16be(value) { const b = Buffer.alloc(2); b.writeUInt16BE(value); return b; }
function u32be(value) { const b = Buffer.alloc(4); b.writeUInt32BE(value); return b; }
function i64be(value) {
  const b = Buffer.alloc(8);
  b.writeBigInt64BE(BigInt(value));
  return b;
}

/** Write a small ZIP (store or deflate) the way a build tool would. */
function writeZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const raw = Buffer.from(entry.data);
    const method = entry.deflate ? 8 : 0;
    const data = entry.deflate ? deflateRawSync(raw) : raw;
    const header = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(method), u16(0), u16(0),
      u32(0), u32(data.length), u32(raw.length), u16(name.length), u16(0), name
    ]);
    local.push(header, data);
    central.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(method), u16(0), u16(0),
      u32(0), u32(data.length), u32(raw.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name
    ]));
    offset += header.length + data.length;
  }
  const directory = Buffer.concat(central);
  return Buffer.concat([
    ...local,
    directory,
    Buffer.concat([
      u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
      u32(directory.length), u32(offset), u16(0)
    ])
  ]);
}

/** A Java keystore (v2) with a private key entry and a trusted certificate. */
function writeJks(entries) {
  const utf = (value) => Buffer.concat([u16be(Buffer.byteLength(value)), Buffer.from(value, 'utf8')]);
  const parts = [u32be(0xfeedfeed), u32be(2), u32be(entries.length)];
  for (const entry of entries) {
    if (entry.type === 'private') {
      const key = Buffer.alloc(48, 0x5a); // opaque sealed key — never decrypted
      parts.push(u32be(1), utf(entry.alias), i64be(entry.created || 1759790000000),
        u32be(key.length), key, u32be(entry.certificates.length));
      for (const certificate of entry.certificates) {
        parts.push(utf('X.509'), u32be(certificate.length), certificate);
      }
    } else {
      parts.push(u32be(2), utf(entry.alias), i64be(entry.created || 1759790000000),
        utf('X.509'), u32be(entry.certificates[0].length), entry.certificates[0]);
    }
  }
  parts.push(Buffer.alloc(20)); // keystore integrity digest (not inspected)
  return Buffer.concat(parts);
}

function run(args, env = {}) {
  const result = spawnSync(process.execPath, [TOOL, ...args], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env }
  });
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function hasExecutable(name) {
  const result = spawnSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' });
  return result.status === 0;
}

/* ------------------------------------------------------------------ tests */

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-play-signing-'));
const signedBundle = path.join(directory, 'app-release.aab');
const unsignedBundle = path.join(directory, 'unsigned.aab');
const v2OnlyApk = path.join(directory, 'app-release.apk');
const keystore = path.join(directory, 'release.jks');
const pem = path.join(directory, 'upload_certificate.pem');

fs.writeFileSync(signedBundle, writeZip([
  { name: 'META-INF/MANIFEST.MF', data: 'Manifest-Version: 1.0\n' },
  { name: 'META-INF/CERT.RSA', data: FIXTURE_PKCS7, deflate: true },
  { name: 'base/manifest/AndroidManifest.xml', data: '<manifest/>' }
]));
fs.writeFileSync(unsignedBundle, writeZip([
  { name: 'base/manifest/AndroidManifest.xml', data: '<manifest/>' }
]));
fs.writeFileSync(v2OnlyApk, writeZip([
  { name: 'AndroidManifest.xml', data: '<manifest/>' },
  { name: 'resources.arsc', data: 'APK Sig Block 42' }
]));
fs.writeFileSync(keystore, writeJks([
  { type: 'private', alias: 'prayer-dome', certificates: [FIXTURE_CERT_DER] },
  { type: 'trusted', alias: 'play-app-signing', certificates: [FIXTURE_CERT_DER] }
]));
fs.writeFileSync(pem, '-----BEGIN CERTIFICATE-----\n'
  + FIXTURE_CERT_DER.toString('base64').match(/.{1,64}/g).join('\n')
  + '\n-----END CERTIFICATE-----\n');

(async () => {
  const signing = await import(path.join('file://', ROOT, 'scripts', 'play-signing.mjs'));

  /* ------------------------------------------------------ pure functions */
  const fingerprints = signing.fingerprint(FIXTURE_CERT_DER);
  t('fingerprints are the colon-separated uppercase values Play displays',
    fingerprints.sha1 === FIXTURE_SHA1 && fingerprints.sha256 === FIXTURE_SHA256,
    JSON.stringify(fingerprints));

  const zipEntries = signing.zipEntries(fs.readFileSync(signedBundle));
  t('the built-in zip reader finds the signature entry in an App Bundle',
    zipEntries.some((entry) => entry.name === 'META-INF/CERT.RSA'));
  const signatureEntry = zipEntries.find((entry) => entry.name === 'META-INF/CERT.RSA');
  t('a deflated signature entry inflates back to the PKCS#7 block',
    signing.zipRead(fs.readFileSync(signedBundle), signatureEntry).equals(FIXTURE_PKCS7));

  const fromPkcs7 = signing.pkcs7Certificates(FIXTURE_PKCS7);
  t('the ASN.1 walk extracts the signing certificate from a PKCS#7 block',
    fromPkcs7.length === 1 && fromPkcs7[0].equals(FIXTURE_CERT_DER));

  const fromJks = signing.jksCertificates(fs.readFileSync(keystore));
  t('a Java keystore yields both entries with their certificate chains',
    fromJks.length === 2 && fromJks[0].alias === 'prayer-dome' &&
    fromJks[0].type === 'private key' && fromJks[1].alias === 'play-app-signing',
    JSON.stringify(fromJks.map((entry) => [entry.alias, entry.certificates.length])));
  t('JKS certificates are read without touching the sealed private key',
    fromJks.every((entry) => entry.certificates.every((der) => der.equals(FIXTURE_CERT_DER))));

  const fromPem = signing.pemCertificates(fs.readFileSync(pem, 'utf8'));
  t('PEM certificates decode to the same DER bytes',
    fromPem.length === 1 && fromPem[0].equals(FIXTURE_CERT_DER));

  /* ------------------------------------------------------------- the CLI */
  const good = run(['--bundle', signedBundle, '--expect-sha1', FIXTURE_SHA1, '--expect-sha256', FIXTURE_SHA256]);
  t('a bundle signed with the expected key passes', good.status === 0 && good.stdout.includes('safe to upload'),
    `status ${good.status}: ${good.stdout}${good.stderr}`);

  const lowercase = run(['--bundle', signedBundle, '--expect-sha1', FIXTURE_SHA1.replace(/:/g, '').toLowerCase()]);
  t('fingerprints compare regardless of case and separators', lowercase.status === 0,
    `status ${lowercase.status}: ${lowercase.stdout}`);

  const wrongKey = run(['--bundle', signedBundle, '--expect-sha1', PLAY_EXPECTED_SHA1]);
  t('the rejected bundle fails against the key Play holds',
    wrongKey.status === 1 && wrongKey.stdout.includes(PLAY_EXPECTED_SHA1) &&
    wrongKey.stdout.includes('was not found') && wrongKey.stdout.includes('PLAY-UPLOAD-KEY.md'),
    `status ${wrongKey.status}: ${wrongKey.stdout}`);

  const report = run(['--bundle', signedBundle]);
  t('a report lists the bundle fingerprint in Play\'s format',
    report.status === 0 && report.stdout.includes(FIXTURE_SHA1) && report.stdout.includes(FIXTURE_SHA256));

  const mismatch = run(['--keystore', keystore, '--bundle', unsignedBundle]);
  t('an unsigned release bundle is reported, not silently accepted',
    mismatch.status === 1 && /not signed/.test(mismatch.stdout),
    `status ${mismatch.status}: ${mismatch.stdout}`);

  const otherKeyJks = path.join(directory, 'other.jks');
  fs.writeFileSync(otherKeyJks, writeJks([
    { type: 'private', alias: 'someone-else', certificates: [Buffer.concat([FIXTURE_CERT_DER.subarray(0, 180), Buffer.from([0x00]), FIXTURE_CERT_DER.subarray(181)])] }
  ]));
  const crossed = run(['--keystore', otherKeyJks, '--bundle', signedBundle, '--expect-sha1', FIXTURE_SHA1]);
  t('a bundle signed by a different key than the keystore beside it fails',
    crossed.status === 1 && crossed.stdout.includes('NOT signed with the keystore'),
    `status ${crossed.status}: ${crossed.stdout}`);

  const v2 = run(['--bundle', v2OnlyApk]);
  t('an APK with only a v2/v3 signature block points at apksigner',
    v2.status === 1 && v2.stdout.includes('apksigner'),
    `status ${v2.status}: ${v2.stdout}`);

  const json = run(['--keystore', keystore, '--json']);
  const parsed = JSON.parse(json.stdout);
  t('the JSON report is machine readable',
    json.status === 0 && parsed.ok === true && parsed.certificates.length === 2 &&
    parsed.certificates[0].sha1 === FIXTURE_SHA1, json.stdout);

  const assetlinks = run(['--assetlinks', 'co.median.android.qdoxnjx', '--expect-sha256', FIXTURE_SHA256]);
  t('assetlinks.json can be generated from an app signing key fingerprint',
    assetlinks.status === 0 && assetlinks.stdout.includes('co.median.android.qdoxnjx') &&
    assetlinks.stdout.includes(FIXTURE_SHA256) &&
    assetlinks.stdout.includes('delegate_permission/common.handle_all_urls'),
    assetlinks.stdout);

  const missing = run(['--bundle', path.join(directory, 'nope.aab')]);
  t('a missing input file is a usage error (exit 2)', missing.status === 2, `status ${missing.status}`);

  const usage = run(['--not-an-option']);
  t('unknown options exit 2 with the usage text', usage.status === 2 && usage.stderr.includes('Usage:'));
  t('--help exits 0', run(['--help']).status === 0);

  // keytool is the authoritative reader for both keystore formats, so it is
  // used whenever Java is present and a password was given (Codemagic and the
  // GitHub runners both ship Java). The stub proves that without needing a JDK.
  const bin = path.join(directory, 'bin');
  const marker = path.join(directory, 'keytool-used');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'keytool'), [
    '#!/bin/sh',
    `: > ${marker}`,
    "cat <<'PEM'",
    fs.readFileSync(pem, 'utf8').trim(),
    'PEM',
    ''
  ].join('\n'), { mode: 0o755 });
  const viaKeytool = run(['--keystore', keystore, '--storepass', 'secret'],
    { PATH: `${bin}:${process.env.PATH}` });
  t('keytool is preferred when Java is available and a password is supplied',
    fs.existsSync(marker) && viaKeytool.status === 0 && viaKeytool.stdout.includes(FIXTURE_SHA1),
    `status ${viaKeytool.status}: ${viaKeytool.stdout}${viaKeytool.stderr}`);

  // PKCS#12 keystores are read with openssl when it is installed; the private
  // key generated here lives only in the temporary directory.
  if (hasExecutable('openssl')) {
    const pkcs12 = path.join(directory, 'release.p12');
    const built = spawnSync('sh', ['-c',
      'openssl req -x509 -newkey rsa:2048 -keyout "$1/k.pem" -out "$1/c.pem" -days 2 -nodes '
      + '-subj "/CN=Prayer Dome Test Fixture" >/dev/null 2>&1 && '
      + 'openssl pkcs12 -export -inkey "$1/k.pem" -in "$1/c.pem" -out "$1/release.p12" '
      + '-passout pass:secret -name prayer-dome >/dev/null 2>&1', 'sh', directory],
      { encoding: 'utf8' });
    const expected = spawnSync('sh', ['-c',
      `openssl x509 -in ${path.join(directory, 'c.pem')} -noout -fingerprint -sha1 | cut -d= -f2`],
      { encoding: 'utf8' }).stdout.trim();
    const report = run(['--keystore', pkcs12, '--storepass', 'secret', '--expect-sha1', expected]);
    t('an openssl-readable PKCS#12 keystore reports the same fingerprint',
      built.status === 0 && report.status === 0 && report.stdout.includes(expected),
      `status ${report.status}: ${report.stdout}${report.stderr}`);
  } else {
    t('openssl is not installed — the PKCS#12 path was not exercised here (CI has it)', true);
  }

  /* ------------------------------------------- repository/CI integration */
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  t('package.json exposes the signing check',
    Boolean(pkg.scripts['signing:check']) && pkg.scripts['signing:check'].includes('play-signing.mjs'));
  t('the signing check runs in the test suite',
    pkg.scripts.test.includes('tests/play-signing.test.js'));

  const codemagic = fs.readFileSync(path.join(ROOT, 'codemagic.yaml'), 'utf8');
  const releaseWorkflow = codemagic.slice(codemagic.indexOf('android-release:'));
  t('Codemagic verifies the upload key before a release build is published',
    releaseWorkflow.includes('PLAY_UPLOAD_KEY_SHA1') &&
    releaseWorkflow.includes('play-signing.mjs') &&
    releaseWorkflow.indexOf('play-signing.mjs') < releaseWorkflow.indexOf('apksigner'));
  t('the Codemagic check reports instead of failing until the fingerprint is configured',
    /PLAY_UPLOAD_KEY_SHA1[\s\S]{0,400}(not set|unset)/i.test(releaseWorkflow));
  t('Codemagic documents the variable beside the other secure variables',
    /PLAY_UPLOAD_KEY_SHA1[\s\S]{0,400}App integrity/.test(codemagic));

  const githubWorkflow = fs.readFileSync(path.join(ROOT, 'mobile', 'android-build.yml'), 'utf8');
  t('the GitHub Android workflow can run the same check',
    githubWorkflow.includes('PLAY_UPLOAD_KEY_SHA1') && githubWorkflow.includes('play-signing.mjs'));

  const guide = fs.readFileSync(path.join(ROOT, 'mobile', 'PLAY-UPLOAD-KEY.md'), 'utf8');
  for (const [label, pattern] of [
    ['explains upload key versus app signing key', /upload key[\s\S]{0,400}app signing key/i],
    ['quotes the wrong-key error users see', /signed with the wrong key/i],
    ['covers requesting an upload key reset', /Request upload key reset/i],
    ['covers the hosted-builder (Median) case', /Median/],
    ['covers the assetlinks fingerprint', /assetlinks\.json/],
    ['shows the pre-upload check', /signing:check|play-signing\.mjs/]
  ]) {
    t(`mobile/PLAY-UPLOAD-KEY.md ${label}`, pattern.test(guide));
  }

  const storeDoc = fs.readFileSync(path.join(ROOT, 'mobile', 'PLAY-STORE.md'), 'utf8');
  t('PLAY-STORE.md points at the key guide and the pre-upload check',
    storeDoc.includes('PLAY-UPLOAD-KEY.md') && /signing:check|play-signing\.mjs/.test(storeDoc));

  const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  t('signing material and built bundles stay out of Git',
    ['android/*.jks', 'android/*.keystore', 'android/*.p12', '*.aab', '*.apk', 'upload_certificate.pem']
      .every((entry) => ignore.includes(entry)), ignore);

  const certs = run(['--cert', pem]);
  t('a bare certificate file can be fingerprinted too',
    certs.status === 0 && certs.stdout.includes(FIXTURE_SHA1));

  fs.rmSync(directory, { recursive: true, force: true });
  console.log(`\nAndroid signing identity checks passed (${passed} assertions).`);
})().catch((error) => {
  fs.rmSync(directory, { recursive: true, force: true });
  console.error(error);
  process.exitCode = 1;
});
