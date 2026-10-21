#!/usr/bin/env node
/**
 * Prayer Dome — Android Digital Asset Links (/.well-known/assetlinks.json).
 *
 * Android verifies App Links and Trusted Web Activities by fetching
 *
 *   https://<domain>/.well-known/assetlinks.json
 *
 * and matching the installed app's package name against the SHA-256
 * fingerprint of the certificate that signed the installed APK. Getting either
 * half wrong fails silently on the device: the app still opens, the site just
 * opens in the browser instead of the app. This tool makes both halves visible
 * before that happens.
 *
 *   node scripts/assetlinks.mjs                       # check the file in the repo
 *   node scripts/assetlinks.mjs --url https://prayerdome.net   # check what Android fetches
 *   node scripts/assetlinks.mjs --url https://prayerdome.net --json
 *
 * What it refuses:
 *   • a SHA-1 fingerprint in `sha256_cert_fingerprints` (20 bytes, not 32) —
 *     the single most common way a valid-looking file fails verification,
 *   • a package the repository does not build and that is not a known legacy
 *     listing, so one app's certificate can never be pasted into another's,
 *   • a file with no statement for the app this repository actually ships,
 *   • a deployed copy that is missing, redirects, is served as HTML, or has
 *     drifted from the file in the repository.
 *
 * The fingerprints themselves still have to come from the real signing
 * certificate. Print them from a keystore, APK or App Bundle with:
 *
 *   node scripts/play-signing.mjs --bundle app-release.aab --assetlinks net.prayerdome.app
 *
 * Background: mobile/ANDROID-IDENTITY.md.  Exit codes: 0 = valid,
 * 1 = problems found, 2 = bad usage.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const FILE_PATH = '.well-known/assetlinks.json';
export const HANDLE_ALL_URLS = 'delegate_permission/common.handle_all_urls';

/**
 * Packages that are not built by this repository but are allowed to appear in
 * the published file. Each one is a real, previously shipped Prayer Dome
 * listing; removing it would revoke App Links that are already installed on
 * devices, so it is kept rather than silently dropped.
 */
export const LEGACY_PACKAGES = new Map([
  ['co.median.android.qdoxnjx',
    'the Median-hosted Prayer Dome build that predates the Capacitor app']
]);

const HEX_ONLY = /^[0-9A-Fa-f]+$/;
const PACKAGE_NAME = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;

/* ------------------------------------------------------------ fingerprints */

/**
 * Describe one value from `sha256_cert_fingerprints`.
 *
 * Android only accepts the 32-byte SHA-256 digest, colon separated. A 20-byte
 * SHA-1 fingerprint is the value Play, `keytool -list` and `apksigner` print
 * most prominently, and copying it here is the usual cause of a file that
 * looks correct and verifies nothing — so it gets its own explanation rather
 * than a generic "invalid fingerprint".
 */
export function describeFingerprint(value) {
  if (typeof value !== 'string') {
    return { ok: false, reason: 'is not a string' };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, reason: 'is empty' };

  const hex = trimmed.replace(/:/g, '');
  if (!HEX_ONLY.test(hex)) {
    return { ok: false, reason: 'contains something other than hexadecimal digits and ":" separators' };
  }
  if (hex.length % 2 !== 0) {
    return { ok: false, reason: `has an odd number of hex digits (${hex.length})` };
  }

  const bytes = hex.length / 2;
  const normalized = hex.toUpperCase().match(/../g).join(':');

  if (bytes === 20) {
    return {
      ok: false,
      bytes,
      normalized,
      reason: `is a SHA-1 fingerprint (20 bytes). Android Digital Asset Links needs the 32-byte `
        + `SHA-256 fingerprint of the signing certificate; this value cannot verify anything.`
    };
  }
  if (bytes !== 32) {
    return { ok: false, bytes, reason: `has ${bytes} bytes; a SHA-256 fingerprint must have exactly 32` };
  }
  if (normalized !== trimmed) {
    return {
      ok: true,
      bytes,
      normalized,
      reason: 'is valid SHA-256 but is not written in uppercase, colon-separated form'
    };
  }
  return { ok: true, bytes, normalized };
}

/* --------------------------------------------------------- app packages */

/**
 * The package names this repository actually builds. Read from the Gradle
 * applicationId and the Capacitor appId — the two places a rename has to agree
 * — so assetlinks.json cannot drift away from the shipped app.
 */
export function readAppPackages(root = ROOT) {
  const gradleFile = resolve(root, 'android/app/build.gradle');
  const capacitorFile = resolve(root, 'capacitor.config.json');
  const gradle = existsSync(gradleFile)
    ? readFileSync(gradleFile, 'utf8').match(/applicationId\s+["']([^"']+)["']/)?.[1] ?? null
    : null;
  let capacitor = null;
  if (existsSync(capacitorFile)) {
    try { capacitor = JSON.parse(readFileSync(capacitorFile, 'utf8')).appId ?? null; } catch { capacitor = null; }
  }
  return { gradle, capacitor, packages: [...new Set([gradle, capacitor].filter(Boolean))] };
}

/* -------------------------------------------------------------- validation */

/**
 * Validate a parsed assetlinks.json.
 *
 * @param {unknown} document parsed JSON
 * @param {{appPackages?: string[], legacyPackages?: Map<string,string>}} options
 * @returns {{ok: boolean, errors: string[], warnings: string[], targets: object[]}}
 */
export function validateAssetLinks(document, options = {}) {
  const appPackages = options.appPackages ?? [];
  const legacyPackages = options.legacyPackages ?? LEGACY_PACKAGES;
  const errors = [];
  const warnings = [];
  const targets = [];

  if (!Array.isArray(document)) {
    return {
      ok: false,
      errors: ['the file must be a JSON array of statements (Android reads an array, even for one app)'],
      warnings,
      targets
    };
  }
  if (!document.length) errors.push('the array is empty — no app can be associated with this domain');

  const packagesSeen = new Map();

  document.forEach((statement, index) => {
    const where = `statement ${index + 1}`;
    if (!statement || typeof statement !== 'object' || Array.isArray(statement)) {
      errors.push(`${where}: is not an object`);
      return;
    }

    const relations = statement.relation;
    if (!Array.isArray(relations) || !relations.length || relations.some((value) => typeof value !== 'string')) {
      errors.push(`${where}: "relation" must be a non-empty array of strings`);
    } else if (!relations.includes(HANDLE_ALL_URLS)) {
      errors.push(`${where}: "relation" must include "${HANDLE_ALL_URLS}" to open links in the app`);
    }

    const target = statement.target;
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      errors.push(`${where}: "target" is missing or is not an object`);
      return;
    }
    if (target.namespace !== 'android_app') {
      errors.push(`${where}: "target.namespace" must be "android_app" (found ${JSON.stringify(target.namespace)})`);
    }

    const packageName = target.package_name;
    if (typeof packageName !== 'string' || !packageName.trim()) {
      errors.push(`${where}: "target.package_name" is missing`);
      return;
    }
    if (!PACKAGE_NAME.test(packageName)) {
      errors.push(`${where}: "${packageName}" is not a valid Android package name`);
    }
    if (packagesSeen.has(packageName)) {
      errors.push(`${where}: "${packageName}" already has a statement in statement ${packagesSeen.get(packageName) + 1}; `
        + 'merge the fingerprints into one target instead of repeating the package');
    } else {
      packagesSeen.set(packageName, index);
    }

    const raw = target.sha256_cert_fingerprints;
    const fingerprints = [];
    if (!Array.isArray(raw) || !raw.length) {
      errors.push(`${where} (${packageName}): "sha256_cert_fingerprints" must be a non-empty array`);
    } else {
      const seen = new Set();
      raw.forEach((value, position) => {
        const described = describeFingerprint(value);
        if (!described.ok) {
          errors.push(`${where} (${packageName}): fingerprint ${position + 1} ${described.reason}`
            + (typeof value === 'string' ? `\n      ${value}` : ''));
          return;
        }
        if (described.reason) warnings.push(`${where} (${packageName}): fingerprint ${position + 1} ${described.reason}`);
        if (seen.has(described.normalized)) {
          errors.push(`${where} (${packageName}): fingerprint ${described.normalized} is listed twice`);
          return;
        }
        seen.add(described.normalized);
        fingerprints.push({ normalized: described.normalized, bytes: described.bytes });
      });
    }

    let kind = 'unknown';
    if (appPackages.includes(packageName)) kind = 'application';
    else if (legacyPackages.has(packageName)) {
      kind = 'legacy';
      warnings.push(`${where}: "${packageName}" is a legacy listing (${legacyPackages.get(packageName)}). `
        + 'It is kept so devices that still have that build keep their verified links.');
    } else {
      errors.push(`${where}: "${packageName}" is not the package this repository builds `
        + `(${appPackages.join(', ') || 'none detected'}) and is not a known legacy listing — `
        + 'a statement here hands this domain\'s links to an app that is not this one');
    }

    targets.push({
      package: packageName,
      namespace: target.namespace,
      relations: Array.isArray(relations) ? relations : [],
      fingerprints,
      kind
    });
  });

  for (const packageName of appPackages) {
    if (!packagesSeen.has(packageName)) {
      errors.push(`"${packageName}" is the package this repository builds but the file has no statement for it, `
        + 'so Android can never verify links into that app');
    }
  }

  return { ok: errors.length === 0, errors, warnings, targets };
}

/** Parse and validate the file text. Keeps JSON syntax errors on the report. */
export function validateText(text, options = {}) {
  let document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      errors: [`the file is not valid JSON: ${error.message}`],
      warnings: [],
      targets: []
    };
  }
  return validateAssetLinks(document, options);
}

/* ---------------------------------------------------------------- network */

/** Accept an origin, a full file URL, or a bare host and return the file URL. */
export function assetLinksUrl(input) {
  const value = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(value);
  if (!url.pathname || url.pathname === '/') url.pathname = `/${FILE_PATH}`;
  return url.toString();
}

/**
 * Fetch the file the way Android does: HTTPS, no redirects followed, and the
 * body read as JSON. Returns the problems rather than throwing so a deploy can
 * report every fault at once.
 */
export async function inspectEndpoint(input, options = {}) {
  const endpoint = assetLinksUrl(input);
  const problems = [];
  let response;
  try {
    response = await fetch(endpoint, {
      redirect: 'manual',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(options.timeout ?? 15000)
    });
  } catch (error) {
    return { endpoint, ok: false, problems: [`could not reach the endpoint: ${error.message}`] };
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const location = response.headers.get('location');

  if (response.status >= 300 && response.status < 400) {
    problems.push(`responds with HTTP ${response.status}`
      + (location ? ` redirecting to ${location}` : '')
      + ' — Android expects a direct 200 and does not follow redirects here');
  } else if (response.status !== 200) {
    problems.push(`responds with HTTP ${response.status}; it must be 200 without authentication`);
  }

  if (response.status === 200) {
    if (!contentType.includes('json')) {
      problems.push(`is served as "${contentType || 'no content-type'}"; it must be JSON `
        + '(application/json) — a hosting rewrite that returns the HTML 404 page reads as an invalid file');
    } else if (!contentType.startsWith('application/json') && !contentType.includes('+json')) {
      problems.push(`is served as "${contentType}"; application/json is the type Android expects`);
    }
  }

  let text = null;
  if (response.status === 200) {
    try { text = await response.text(); } catch (error) { problems.push(`the body could not be read: ${error.message}`); }
  }

  return { endpoint, ok: problems.length === 0 && text !== null, status: response.status, contentType, text, problems };
}

/** Compare a deployed document with the one in the repository. */
export function compareWithLocal(remote, local) {
  const problems = [];
  const summarize = (targets) => targets
    .map((target) => `${target.package}:${target.fingerprints.map((entry) => entry.normalized).sort().join(',')}`)
    .sort();
  const remoteSummary = summarize(remote);
  const localSummary = summarize(local);
  for (const entry of localSummary) {
    if (!remoteSummary.includes(entry)) problems.push(`deployed copy is missing ${entry} (present in the repository file)`);
  }
  for (const entry of remoteSummary) {
    if (!localSummary.includes(entry)) problems.push(`deployed copy has ${entry}, which is not in the repository file`);
  }
  return problems;
}

/* ------------------------------------------------------------------- CLI */

const USAGE = `Prayer Dome — Android Digital Asset Links

Usage:
  node scripts/assetlinks.mjs [--file <path>] [--url <origin>] [--json]

  --file <path>   assetlinks.json to check (default: ${FILE_PATH})
  --url <origin>  also fetch what Android fetches, e.g. https://prayerdome.net
  --json          machine-readable report

Exit codes: 0 = valid, 1 = problems found, 2 = bad usage.
Docs: mobile/ANDROID-IDENTITY.md`;

function parseArguments(argv) {
  const options = { file: resolve(ROOT, FILE_PATH) };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${argument} needs a value`);
      return argv[index];
    };
    switch (argument) {
      case '--file': options.file = resolve(next()); break;
      case '--url': options.url = next(); break;
      case '--json': options.json = true; break;
      case '--check': break;
      case '--help':
      case '-h': options.help = true; break;
      default: throw new Error(`unknown option ${argument}`);
    }
  }
  return options;
}

async function main(argv) {
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

  const { gradle, capacitor, packages } = readAppPackages();
  if (!existsSync(options.file)) {
    console.error(`! ${options.file} does not exist`);
    return 1;
  }
  const text = readFileSync(options.file, 'utf8');
  const local = validateText(text, { appPackages: packages });

  let remote = null;
  if (options.url) {
    const inspected = await inspectEndpoint(options.url);
    const problems = [...inspected.problems];
    if (inspected.text !== null) {
      const deployed = validateText(inspected.text, { appPackages: packages });
      problems.push(...deployed.errors);
      if (!problems.length) problems.push(...compareWithLocal(deployed.targets, local.targets));
      remote = { endpoint: inspected.endpoint, status: inspected.status, contentType: inspected.contentType, problems };
    } else {
      remote = { endpoint: inspected.endpoint, status: inspected.status, contentType: inspected.contentType, problems };
    }
  }

  const failed = !local.ok || (remote && remote.problems.length);

  if (options.json) {
    console.log(JSON.stringify({
      ok: !failed,
      file: options.file,
      appPackages: { gradle, capacitor },
      local: { ok: local.ok, errors: local.errors, warnings: local.warnings, targets: local.targets },
      remote
    }, null, 2));
    return failed ? 1 : 0;
  }

  const lines = [];
  lines.push(`assetlinks.json — ${options.file}`);
  lines.push(`app package in this repository: ${packages.join(', ') || 'NOT FOUND'}`
    + (gradle && capacitor && gradle !== capacitor ? '  (build.gradle and capacitor.config.json disagree)' : ''));

  if (local.targets.length) {
    lines.push('');
    for (const target of local.targets) {
      lines.push(`  ${target.package}  [${target.kind}]`);
      for (const fingerprint of target.fingerprints) lines.push(`    SHA-256 ${fingerprint.normalized}`);
    }
  }

  for (const warning of local.warnings) lines.push(`\nNOTE  ${warning}`);
  for (const error of local.errors) lines.push(`\nFAIL  ${error}`);

  if (remote) {
    lines.push('');
    lines.push(`deployed ${remote.endpoint}`);
    lines.push(`  HTTP ${remote.status ?? '—'}  ${remote.contentType || 'no content-type'}`);
    for (const problem of remote.problems) lines.push(`\nFAIL  deployed file ${problem}`);
    if (!remote.problems.length) lines.push('  the endpoint returns the same statements as the repository');
  }

  if (!failed) {
    lines.push('');
    lines.push('The file is valid. Android can only verify a device once the fingerprints match the');
    lines.push('certificate that signed the *installed* APK — confirm that with Play Console →');
    lines.push('App integrity, or `node scripts/play-signing.mjs --bundle <file.aab> --assetlinks '
      + (packages[0] || 'your.package') + '`.');
  }
  console.log(lines.join('\n'));
  return failed ? 1 : 0;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  process.exitCode = await main(process.argv.slice(2));
}
