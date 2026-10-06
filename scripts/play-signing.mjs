#!/usr/bin/env node
/**
 * Prayer Dome — Android signing identity report and pre-upload check.
 *
 * Google Play only accepts a release that is signed with the upload key
 * certificate registered for the app. When two different keys exist (a hosted
 * builder's key, a CI key, a laptop's key, or a freshly generated key after a
 * reset) the upload fails with:
 *
 *   Your Android App Bundle is signed with the wrong key … expected
 *   SHA1: 8D:25:36:… but the certificate used … has fingerprint
 *   SHA1: A5:9D:61:…
 *
 * This script answers "which key signed this?" before the upload, without
 * needing Android Studio:
 *
 *   node scripts/play-signing.mjs --bundle app-release.aab
 *   node scripts/play-signing.mjs --keystore android/release.keystore --bundle app-release.aab
 *   node scripts/play-signing.mjs --bundle app-release.aab --expect-sha1 8D:25:36:…
 *   node scripts/play-signing.mjs --keystore release.jks --assetlinks co.median.android.qdoxnjx
 *
 * Sources it understands:
 *   • Java keystores (.jks/.keystore) — certificate chain read directly from the
 *     documented JKS layout; the private key is never decrypted or exported.
 *   • PKCS#12 keystores (.p12/.pfx) — via `openssl pkcs12` when installed.
 *   • App Bundles and APKs — the PKCS#7 signature block in META-INF, read with a
 *     built-in zip reader and ASN.1 walk (no `keytool`/`apksigner` required).
 *   • Certificates — PEM or DER.
 *
 * Exit codes: 0 = report only, or every `--expect-*` value matched;
 *             1 = an expected certificate was not found, or the bundle is
 *                 unsigned; 2 = bad usage / unreadable input.
 *
 * The full Play procedure is in mobile/PLAY-UPLOAD-KEY.md.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SIGNATURE_ENTRY = /^META-INF\/[^/]+\.(RSA|DSA|EC)$/i;
const APK_SIGNING_BLOCK = 'APK Sig Block 42';

/* ------------------------------------------------------------------ ASN.1 */

const TAG_SEQUENCE = 0x30;
const TAG_SET = 0x31;
const TAG_CONTEXT_0 = 0xa0;
const TAG_CONTEXT_1 = 0xa1;

/** Read one TLV at `offset`; returns lengths relative to the whole buffer. */
function readTlv(buffer, offset) {
  if (offset + 2 > buffer.length) throw new Error('DER: truncated tag/length');
  const tag = buffer[offset];
  let length = 0;
  let cursor = offset + 1;
  const first = buffer[cursor];
  cursor += 1;
  if (first < 0x80) {
    length = first;
  } else if (first === 0x80) {
    throw new Error('DER: indefinite lengths are not valid in DER');
  } else {
    const bytes = first & 0x7f;
    if (bytes > 4) throw new Error('DER: length field too large');
    if (cursor + bytes > buffer.length) throw new Error('DER: truncated long length');
    for (let i = 0; i < bytes; i += 1) length = (length << 8) | buffer[cursor + i];
    cursor += bytes;
  }
  const contentStart = cursor;
  const end = contentStart + length;
  if (end > buffer.length) throw new Error('DER: value runs past end of input');
  return { tag, contentStart, end };
}

function readChildren(buffer, start, end) {
  const children = [];
  let offset = start;
  while (offset < end) {
    const tlv = readTlv(buffer, offset);
    children.push({ tag: tlv.tag, start: offset, contentStart: tlv.contentStart, end: tlv.end });
    offset = tlv.end;
  }
  return children;
}

/**
 * Collect the X.509 certificates from a PKCS#7/CMS SignedData blob (the
 * `META-INF/*.RSA` sibling file inside a signed JAR, APK or App Bundle).
 *
 * Layout: SEQUENCE { OID signedData, [0] { SEQUENCE { version,
 * digestAlgorithms, encapContentInfo, [0] certificates, … } } }
 */
export function pkcs7Certificates(der) {
  const outer = readTlv(der, 0);
  if (outer.tag !== TAG_SEQUENCE) throw new Error('PKCS#7: outer element is not a SEQUENCE');
  let signedData = null;
  for (const child of readChildren(der, outer.contentStart, outer.end)) {
    if (child.tag !== TAG_CONTEXT_0) continue;
    for (const inner of readChildren(der, child.contentStart, child.end)) {
      if (inner.tag === TAG_SEQUENCE) signedData = inner;
    }
  }
  if (!signedData) throw new Error('PKCS#7: signedData content not found');

  const certificates = [];
  const children = readChildren(der, signedData.contentStart, signedData.end);
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child.tag !== TAG_CONTEXT_0 && child.tag !== TAG_SET) continue;
    // The certificates field follows version, digestAlgorithms and the
    // encapsulated content; a [1] field would be the (unused) CRLs.
    if (child.tag === TAG_SET && index < 3) continue;
    for (const candidate of readChildren(der, child.contentStart, child.end)) {
      if (candidate.tag !== TAG_SEQUENCE) continue;
      certificates.push(der.subarray(candidate.start, candidate.end));
    }
    if (certificates.length) break;
  }
  if (!certificates.length) throw new Error('PKCS#7: no certificates found');
  return certificates;
}

/* -------------------------------------------------------------- zip input */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** Minimal ZIP central-directory reader — enough for the signature entries. */
export function zipEntries(buffer) {
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('not a zip archive (no end-of-central-directory record)');
  const count = buffer.readUInt16LE(eocd + 10);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (directoryOffset === 0xffffffff || count === 0xffff) {
    throw new Error('ZIP64 archives are not supported by this reader');
  }
  const entries = [];
  let offset = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) throw new Error('ZIP: bad central directory');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.push({ name, method, compressedSize, uncompressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function zipRead(buffer, entry) {
  const local = entry.localOffset;
  if (buffer.readUInt32LE(local) !== LOCAL_SIGNATURE) throw new Error(`ZIP: bad local header for ${entry.name}`);
  const nameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  const start = local + 30 + nameLength + extraLength;
  const data = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(data);
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`ZIP: unsupported compression method ${entry.method} for ${entry.name}`);
}

/* ------------------------------------------------- certificate containers */

export function fingerprint(der) {
  const hash = (algorithm) => createHash(algorithm).update(der).digest('hex')
    .toUpperCase().match(/../g).join(':');
  return { sha1: hash('sha1'), sha256: hash('sha256'), bytes: der.length };
}

export function pemCertificates(text) {
  const certificates = [];
  const pattern = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g;
  for (const match of text.matchAll(pattern)) {
    certificates.push(Buffer.from(match[1].replace(/\s+/g, ''), 'base64'));
  }
  return certificates;
}

/** Java KeyStore: aliases and certificate chains, without decrypting keys. */
export function jksCertificates(buffer) {
  if (buffer.length < 12 || buffer.readUInt32BE(0) !== 0xfeedfeed) {
    throw new Error('not a JKS keystore (bad magic)');
  }
  const version = buffer.readUInt32BE(4);
  if (version !== 1 && version !== 2) throw new Error(`unsupported JKS version ${version}`);
  const count = buffer.readUInt32BE(8);
  const readUtf = (offset) => {
    const length = buffer.readUInt16BE(offset);
    return {
      value: buffer.toString('utf8', offset + 2, offset + 2 + length),
      next: offset + 2 + length
    };
  };
  const aliases = [];
  let offset = 12;
  for (let index = 0; index < count; index += 1) {
    const tag = buffer.readUInt32BE(offset);
    offset += 4;
    if (tag === 1) {
      const alias = readUtf(offset);
      offset = alias.next + 8;                       // creation timestamp
      offset += 4 + buffer.readUInt32BE(offset);     // sealed private key
      const chainLength = buffer.readUInt32BE(offset);
      offset += 4;
      const certificates = [];
      for (let link = 0; link < chainLength; link += 1) {
        const type = readUtf(offset);
        offset = type.next;
        const length = buffer.readUInt32BE(offset);
        offset += 4;
        certificates.push(Buffer.from(buffer.subarray(offset, offset + length)));
        offset += length;
      }
      aliases.push({ alias: alias.value, type: 'private key', certificates });
    } else if (tag === 2) {
      const alias = readUtf(offset);
      offset = alias.next + 8;                       // creation timestamp
      const type = readUtf(offset);
      offset = type.next;
      const length = buffer.readUInt32BE(offset);
      offset += 4;
      const certificate = Buffer.from(buffer.subarray(offset, offset + length));
      offset += length;
      aliases.push({ alias: alias.value, type: `trusted certificate (${type.value})`, certificates: [certificate] });
    } else {
      throw new Error(`JKS: unknown entry tag ${tag} at record ${index + 1}`);
    }
  }
  return aliases;
}

function openssl(args, options = {}) {
  try {
    return execFileSync('openssl', args, { stdio: options.stdio || 'pipe', encoding: options.encoding });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('`openssl` is not installed — install OpenSSL, or use a JKS/p12 keystore on a machine that has it');
    }
    throw new Error(`openssl ${args[0]} failed: ${String(error.stderr || error.message).trim()}`);
  }
}

export function pkcs12Certificates(file, password) {
  const directory = mkdtempSync(join(tmpdir(), 'pd-signing-'));
  try {
    const output = join(directory, 'certs.pem');
    const args = ['pkcs12', '-in', file, '-nokeys', '-clcerts', '-out', output];
    if (password !== undefined) args.push('-passin', `pass:${password}`);
    else args.push('-passin', 'pass:');
    openssl(args);
    return pemCertificates(readFileSync(output, 'utf8'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function certificateFile(file) {
  const buffer = readFileSync(file);
  if (buffer.toString('utf8', 0, 27).includes('-----BEGIN CERTIFICATE-----')) {
    return pemCertificates(buffer.toString('utf8'));
  }
  return [buffer];
}

/**
 * Certificates from `keytool -list -rfc`, the authoritative reader for both JKS
 * and PKCS#12. Only called when a password was supplied, because keytool would
 * otherwise prompt and block a non-interactive run.
 */
export function keytoolCertificates(file, password) {
  const output = execFileSync('keytool', ['-list', '-rfc', '-keystore', file, '-storepass', password],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return pemCertificates(output);
}

/** Certificates behind a keystore / bundle / certificate path. */
export function certificatesFrom(source, kind, password) {
  if (kind === 'keystore') {
    const buffer = readFileSync(source);
    const looksLikePem = /\.(pem|crt|cer)$/i.test(source) || buffer.toString('utf8', 0, 27).includes('-----BEGIN');
    if (password !== undefined && !looksLikePem) {
      try {
        const certificates = keytoolCertificates(source, password);
        if (certificates.length) {
          return certificates.map((der, index) => ({
            label: `${basename(source)}${index ? ` #${index + 1}` : ''}`, der
          }));
        }
      } catch {
        // No Java on this machine (or the password is wrong): the built-in
        // readers below never prompt and never decrypt the private key.
      }
    }
    if (buffer.length >= 4 && buffer.readUInt32BE(0) === 0xfeedfeed) {
      return jksCertificates(buffer).flatMap((entry) =>
        entry.certificates.map((der) => ({ label: `${basename(source)} — alias "${entry.alias}"`, der })));
    }
    if (/\.(pem|crt|cer)$/i.test(source) || buffer.toString('utf8', 0, 27).includes('-----BEGIN')) {
      return pemCertificates(buffer.toString('utf8'))
        .map((der) => ({ label: basename(source), der }));
    }
    return pkcs12Certificates(source, password).map((der) => ({ label: basename(source), der }));
  }
  if (kind === 'certificate') {
    return certificateFile(source).map((der, index) => ({
      label: `${basename(source)}${index ? ` #${index + 1}` : ''}`, der
    }));
  }
  // App Bundle / APK
  const buffer = readFileSync(source);
  const signatures = zipEntries(buffer).filter((entry) => SIGNATURE_ENTRY.test(entry.name));
  if (!signatures.length) {
    const error = new Error(buffer.includes(APK_SIGNING_BLOCK)
      ? 'APK carries only a v2/v3 APK Signing Block signature — read it with `apksigner verify --print-certs`'
      : 'no META-INF/*.RSA signature block — this file is not signed with a v1 (JAR) signature. '
        + 'Play needs an App Bundle signed with the upload keystore; a release built without '
        + 'android/keystore.properties (or without the CI keystore secret) is unsigned.');
    error.code = buffer.includes(APK_SIGNING_BLOCK) ? 'v2-only' : 'unsigned';
    throw error;
  }
  const found = [];
  for (const entry of signatures) {
    const block = zipRead(buffer, entry);
    let certificates = [];
    try {
      certificates = pkcs7Certificates(block);
    } catch (error) {
      // A v1 (JAR) signature that this walk cannot read might still be readable
      // by openssl; try that before giving up on the entry.
      const directory = mkdtempSync(join(tmpdir(), 'pd-signing-'));
      try {
        const file = join(directory, 'block.p7');
        const output = join(directory, 'certs.pem');
        writeFileSync(file, block);
        openssl(['pkcs7', '-inform', 'DER', '-in', file, '-print_certs', '-out', output]);
        certificates = pemCertificates(readFileSync(output, 'utf8'));
      } catch {
        certificates = [];
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
      if (!certificates.length) continue;
    }
    for (const der of certificates) found.push({ label: `${basename(source)} — ${entry.name}`, der });
  }
  return found;
}

/* -------------------------------------------------------------- reporting */

function formatTable(rows) {
  const headers = ['Source', 'SHA-1', 'SHA-256'];
  const widths = headers.map((header, column) => Math.max(
    header.length,
    ...rows.map((row) => row[column].length)
  ));
  const line = (cells) => cells.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd();
  return [line(headers), line(widths.map((width) => '-'.repeat(width))), ...rows.map(line)].join('\n');
}

function normalizeFingerprint(value) {
  return value.replace(/[^0-9a-f]/gi, '').toUpperCase().match(/../g).join(':');
}

const USAGE = `Prayer Dome — Android signing identity

Usage:
  node scripts/play-signing.mjs [--keystore <file>] [--bundle <file>]
                                [--cert <file>] [--storepass <password>]
                                [--expect-sha1 <fingerprint>] [--expect-sha256 <fingerprint>]
                                [--assetlinks <package name>] [--json]

  --keystore <file>       .jks / .keystore / .p12 / .pfx, or a PEM certificate
  --bundle <file>         App Bundle (.aab) or APK to inspect
  --cert <file>           PEM or DER certificate to inspect
  --storepass <password>  password for a PKCS#12 keystore (JKS certificates need none)
  --expect-sha1 <-fp->    Play's "Upload key certificate" SHA-1 — exit 1 when it is
  --expect-sha256 <-fp->  not among the certificates found (repeatable)
  --assetlinks <package>  print the assetlinks.json target for the certificates found
  --json                  machine-readable report

Docs: mobile/PLAY-UPLOAD-KEY.md`;

function parseArguments(argv) {
  const options = { expect: [], sources: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${argument} needs a value`);
      return argv[index];
    };
    switch (argument) {
      case '--keystore': options.sources.push({ kind: 'keystore', file: next() }); break;
      case '--bundle': options.sources.push({ kind: 'bundle', file: next() }); break;
      case '--cert': options.sources.push({ kind: 'certificate', file: next() }); break;
      case '--storepass': options.storepass = next(); break;
      case '--expect-sha1': options.expect.push({ algorithm: 'sha1', value: next() }); break;
      case '--expect-sha256': options.expect.push({ algorithm: 'sha256', value: next() }); break;
      case '--assetlinks': options.assetlinks = next(); break;
      case '--json': options.json = true; break;
      case '--help':
      case '-h': options.help = true; break;
      default: throw new Error(`unknown option ${argument}`);
    }
  }
  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  if (!options.sources.length && !options.assetlinks && !options.expect.length) {
    console.error(USAGE);
    return 2;
  }

  const certificates = [];
  const problems = [];
  let unsigned = false;
  let blocked = false;
  let inputErrors = 0;
  for (const source of options.sources) {
    const file = resolve(source.file);
    if (!existsSync(file) || !statSync(file).isFile()) {
      problems.push(`${relative(ROOT, file) || source.file}: file not found`);
      inputErrors += 1;
      continue;
    }
    try {
      const found = certificatesFrom(file, source.kind, options.storepass);
      if (!found.length) {
        problems.push(`${basename(file)}: no certificates found`);
        inputErrors += 1;
        continue;
      }
      certificates.push(...found.map((entry) => ({ ...entry, kind: source.kind })));
    } catch (error) {
      if (error.code === 'unsigned') unsigned = true;
      else if (error.code) blocked = true;
      else inputErrors += 1;
      problems.push(`${basename(file)}: ${error.message}`);
    }
  }

  const keystoreFingerprints = new Set(certificates
    .filter((entry) => entry.kind === 'keystore')
    .map((entry) => fingerprint(entry.der).sha1));
  const bundleFingerprints = new Set(certificates
    .filter((entry) => entry.kind === 'bundle')
    .map((entry) => fingerprint(entry.der).sha1));
  const bundleSignedByKeystore = !keystoreFingerprints.size || !bundleFingerprints.size
    || [...bundleFingerprints].some((value) => keystoreFingerprints.has(value));

  const rows = certificates.map(({ label, der }) => {
    const { sha1, sha256 } = fingerprint(der);
    return { label, sha1, sha256 };
  });

  // Expectations are verified against the certificates that were actually
  // read. Without a source there is nothing to verify — the values are still
  // used to render assetlinks.json (e.g. with an app signing key from Play).
  const comparisons = [];
  for (const expectation of options.expect) {
    const wanted = normalizeFingerprint(expectation.value);
    const matches = rows.filter((row) => row[expectation.algorithm] === wanted);
    comparisons.push({ ...expectation, wanted, matches, verified: rows.length > 0 });
  }
  const failed = comparisons.filter((comparison) => comparison.verified && !comparison.matches.length);
  const inspectedBundle = certificates.some((entry) => entry.kind === 'bundle');

  if (options.json) {
    console.log(JSON.stringify({
      ok: !failed.length && !unsigned && !blocked && bundleSignedByKeystore,
      certificates: rows,
      expectations: comparisons.map(({ algorithm, wanted, matches }) => ({
        algorithm, wanted, matched: matches.map((match) => match.label)
      })),
      bundleSignedByKeystore,
      problems
    }, null, 2));
  } else {
    const lines = [];
    if (rows.length) {
      lines.push(formatTable(rows.map((row) => [row.label, row.sha1, row.sha256])));
    } else {
      lines.push('No certificates found.');
    }
    if (options.assetlinks) {
      const fingerprints = rows.length
        ? rows.map((row) => row.sha256)
        : comparisons.filter((comparison) => comparison.algorithm === 'sha256').map((comparison) => comparison.wanted);
      lines.push('');
      lines.push(`assetlinks.json target for ${options.assetlinks}`);
      lines.push('(App Links verify against the *app signing key* — the fingerprint Google');
      lines.push('Play shows under App integrity → App signing key certificate, not the upload key.');
      lines.push('Add every fingerprint the installed app can present, newest first.)');
      lines.push('');
      lines.push('  {');
      lines.push('    "relation": ["delegate_permission/common.handle_all_urls"],');
      lines.push('    "target": {');
      lines.push('      "namespace": "android_app",');
      lines.push(`      "package_name": "${options.assetlinks}",`);
      lines.push(`      "sha256_cert_fingerprints": [${fingerprints.length ? '\n        ' + fingerprints.map((value) => `"${value}"`).join(',\n        ') + '\n      ' : ''}]`);
      lines.push('    }');
      lines.push('  }');
    }
    for (const problem of problems) lines.push(`\n! ${problem}`);
    if (!bundleSignedByKeystore) {
      lines.push('\nFAIL  the bundle was NOT signed with the keystore given beside it:');
      lines.push(`      keystore SHA-1 ${[...keystoreFingerprints].join(', ')}`);
      lines.push(`      bundle   SHA-1 ${[...bundleFingerprints].join(', ')}`);
      lines.push('      Rebuild the bundle with the keystore whose certificate Play has on file.');
    }
    for (const comparison of comparisons) {
      const actual = comparison.algorithm === 'sha1' ? 'SHA-1' : 'SHA-256';
      if (!comparison.verified) {
        lines.push(`\nNOTE  ${actual} ${comparison.wanted} — no source to verify against (value used as given).`);
      } else if (comparison.matches.length) {
        lines.push(`\nPASS  ${actual} ${comparison.wanted} — ${comparison.matches.map((match) => match.label).join(', ')}`);
      } else {
        lines.push(`\nFAIL  ${actual} ${comparison.wanted} was not found in any source.`);
        lines.push('      Rebuild with the keystore for this certificate, or reset the upload key');
        lines.push('      in Play Console (Protected with Play → Manage Play app signing).');
        lines.push('      See mobile/PLAY-UPLOAD-KEY.md.');
      }
    }
    if (inspectedBundle && comparisons.length && !failed.length && !unsigned && !blocked && bundleSignedByKeystore) {
      lines.push('\nThe bundle is signed with the expected upload key certificate. It is safe to upload.');
    } else if (!comparisons.length && !problems.length && bundleSignedByKeystore && certificates.length) {
      lines.push('\nCompare these fingerprints with App integrity → Play app signing in Play Console.');
    }
    console.log(lines.join('\n'));
  }

  if (inputErrors) return 2;
  return failed.length || unsigned || blocked || !bundleSignedByKeystore ? 1 : 0;
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]));
if (invokedDirectly) {
  process.exitCode = main(process.argv.slice(2));
}
