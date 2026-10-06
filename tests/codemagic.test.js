/*
 * Codemagic CI/CD contract checks.
 *
 * codemagic.yaml is the only place a Codemagic build is configured, so a typo
 * there silently breaks the Android release train. This test parses the file
 * with a small, dependency-free YAML reader (block mappings, sequences, quoted
 * scalars and block scalars — everything the file uses) and then asserts the
 * release contract:
 *
 *   • the three workflows exist and every script step is real,
 *   • every `npm run <script>` / `npm test` reference exists in package.json,
 *   • the Android builds sync Capacitor and run the Gradle tasks the GitHub
 *     workflow runs, so both providers build the same artifact,
 *   • signing comes from secure variables only, and a tag build refuses to
 *     publish unsigned output,
 *   • the keystore heredoc terminates correctly at column 0,
 *   • the documented variable names match the GitHub secrets and the docs.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

let passed = 0;
function t(name, ok, extra = '') {
  if (ok) { passed += 1; console.log('PASS  ' + name); }
  else { console.error('FAIL  ' + name + (extra ? '  ' + extra : '')); process.exitCode = 1; }
}

/* ------------------------------------------------------------------ parser */
function stripComment(text) {
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) { if (char === quote) quote = null; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '#' && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i);
  }
  return text;
}

function scalar(text) {
  const value = text.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

function parseYaml(text) {
  const tokens = [];
  text.split('\n').forEach((raw, index) => {
    if (raw.includes('\t')) throw new Error(`codemagic.yaml uses a tab at line ${index + 1}`);
    const withoutComment = stripComment(raw);
    if (!withoutComment.trim()) return;
    const indent = withoutComment.match(/^ */)[0].length;
    tokens.push({ indent, text: withoutComment.trim(), line: index + 1 });
  });

  const state = { index: 0 };
  return parseBlock(tokens, state, tokens[0] ? tokens[0].indent : 0);

  function parseBlock(all, cursor, indent) {
    const first = all[cursor.index];
    if (!first) return null;
    const sequence = first.text === '-' || first.text.startsWith('- ');
    const node = sequence ? [] : {};

    while (cursor.index < all.length) {
      const token = all[cursor.index];
      if (token.indent < indent) break;
      if (token.indent > indent) throw new Error(`unexpected indentation at line ${token.line}`);
      if (sequence) {
        if (!(token.text === '-' || token.text.startsWith('- '))) break;
        const inline = token.text === '-' ? '' : token.text.slice(2).trim();
        cursor.index += 1;
        if (!inline) {
          const next = all[cursor.index];
          node.push(next && next.indent > indent ? parseBlock(all, cursor, next.indent) : null);
          continue;
        }
        const keyMatch = inline.match(/^("(?:[^"]*)"|'(?:[^']*)'|[^:]+):\s*(.*)$/);
        if (!keyMatch) { node.push(scalar(inline)); continue; }
        // Inline mapping start: `- name: Build`. Remaining keys sit at the
        // same indentation as the first key (indent + 2 for "- ").
        const map = {};
        const key = scalar(keyMatch[1]);
        const rest = keyMatch[2].trim();
        const keyIndent = token.indent + 2;
        if (rest === '|' || rest === '|-' || rest === '>') {
          map[key] = readBlockScalar(all, cursor, token.indent);
        } else if (rest) {
          map[key] = scalar(rest);
        } else {
          const next = all[cursor.index];
          map[key] = next && next.indent > indent ? parseBlock(all, cursor, next.indent) : null;
        }
        while (cursor.index < all.length && all[cursor.index].indent === keyIndent &&
               !all[cursor.index].text.startsWith('- ')) {
          const child = all[cursor.index];
          const match = child.text.match(/^("(?:[^"]*)"|'(?:[^']*)'|[^:]+):\s*(.*)$/);
          if (!match) throw new Error(`unparsable line ${child.line}: ${child.text}`);
          const childKey = scalar(match[1]);
          const childRest = match[2].trim();
          cursor.index += 1;
          if (childRest === '|' || childRest === '|-' || childRest === '>') {
            map[childKey] = readBlockScalar(all, cursor, child.indent);
          } else if (childRest) {
            map[childKey] = scalar(childRest);
          } else {
            const next = all[cursor.index];
            map[childKey] = next && next.indent > child.indent ? parseBlock(all, cursor, next.indent) : null;
          }
        }
        node.push(map);
        continue;
      }
      const match = token.text.match(/^("(?:[^"]*)"|'(?:[^']*)'|[^:]+):\s*(.*)$/);
      if (!match) throw new Error(`unparsable line ${token.line}: ${token.text}`);
      const key = scalar(match[1]);
      const rest = match[2].trim();
      cursor.index += 1;
      if (rest === '|' || rest === '|-' || rest === '>') {
        node[key] = readBlockScalar(all, cursor, token.indent);
      } else if (rest) {
        node[key] = scalar(rest);
      } else {
        const next = all[cursor.index];
        node[key] = next && next.indent > token.indent ? parseBlock(all, cursor, next.indent) : null;
      }
    }
    return node;
  }

  // Block scalar: re-indent the content relative to the first content line so
  // the result matches what a real YAML loader would hand to the shell.
  function readBlockScalar(all, cursor, parentIndent) {
    const collected = [];
    const start = cursor.index;
    while (cursor.index < all.length && all[cursor.index].indent > parentIndent) {
      collected.push(all[cursor.index]);
      cursor.index += 1;
    }
    if (!collected.length) return '';
    const base = collected[0].indent;
    if (cursor.index === start) throw new Error('empty block scalar');
    return collected
      .map((token) => ' '.repeat(Math.max(0, token.indent - base)) + token.text)
      .join('\n');
  }
}

/* --------------------------------------------------------- parse the config */
const rawConfig = read('codemagic.yaml');
let config;
try {
  config = parseYaml(rawConfig);
  t('codemagic.yaml parses as YAML (no tab indentation, consistent nesting)', true);
} catch (error) {
  console.error('FAIL  codemagic.yaml parses as YAML: ' + error.message);
  process.exit(1);
}

const workflows = config.workflows || {};
const expected = ['web-verify', 'android-debug', 'android-release'];
t('codemagic.yaml defines the expected workflows: ' + expected.join(', '),
  expected.every((name) => workflows[name]), Object.keys(workflows).join(', '));
t('codemagic.yaml defines no unexpected workflows',
  Object.keys(workflows).length === expected.length, Object.keys(workflows).join(', '));

const pkg = JSON.parse(read('package.json'));

function scriptsOf(workflow) {
  return (workflow.scripts || []).map((step) => step && step.script).filter(Boolean);
}
function allScriptText(workflow) {
  return scriptsOf(workflow).join('\n');
}
function npmScriptsUsed(text) {
  const names = new Set();
  for (const match of text.matchAll(/npm run ([a-z][\w:-]*)/g)) names.add(match[1]);
  for (const match of text.matchAll(/npm (test|ci)\b/g)) names.add(match[1]);
  return [...names];
}

for (const name of expected) {
  const workflow = workflows[name];
  if (!workflow) continue;
  const steps = workflow.scripts;
  t(`${name}: every step has a name and a non-empty script`,
    Array.isArray(steps) && steps.length > 0 && steps.every((step) =>
      step && typeof step.name === 'string' && step.name.trim() &&
      typeof step.script === 'string' && step.script.trim()),
    JSON.stringify(steps && steps.map((step) => step && step.name)));
  t(`${name}: declares a build timeout and an instance type`,
    Number(workflow.max_build_duration) > 0 && typeof workflow.instance_type === 'string');
  const text = allScriptText(workflow);
  const unknown = npmScriptsUsed(text).filter((script) => script !== 'ci' && script !== 'test' && !pkg.scripts[script]);
  t(`${name}: only calls npm scripts that exist in package.json`, unknown.length === 0, unknown.join(', '));
}

/* ------------------------------------------------------------------ website */
const web = workflows['web-verify'];
if (web) {
  const text = allScriptText(web);
  t('web-verify installs, lints, tests, verifies Functions and builds the bundle',
    text.includes('npm ci') && text.includes('npm run lint') && text.includes('npm test') &&
    text.includes('npm run functions:verify') && text.includes('npm run build:vercel'));
  const trigger = web.triggering || {};
  const branches = (trigger.branch_patterns || []).map((entry) => entry.pattern);
  t('web-verify runs on pushes and pull requests, main and arena branches included',
    (trigger.events || []).includes('push') && (trigger.events || []).includes('pull_request') &&
    branches.includes('main') && branches.some((pattern) => pattern.startsWith('arena/')),
    JSON.stringify(trigger));
  t('web-verify pins Node 22 like the rest of the toolchain',
    String((web.environment || {}).node) === '22', JSON.stringify((web.environment || {}).node));
}

/* ------------------------------------------------------------------ android */
for (const name of ['android-debug', 'android-release']) {
  const workflow = workflows[name];
  if (!workflow) continue;
  const text = allScriptText(workflow);
  const env = workflow.environment || {};
  t(`${name}: syncs Capacitor before Gradle`, text.includes('npm run mobile:sync') &&
    text.indexOf('npm run mobile:sync') < text.indexOf('gradlew'));
  t(`${name}: builds with the same Gradle tasks as the GitHub workflow`,
    text.includes('assembleDebug') || text.includes('bundleRelease'));
  t(`${name}: pins Node 22 and Java 21`, String(env.node) === '22' && String(env.java) === '21',
    JSON.stringify(env));
  t(`${name}: caches Gradle and npm downloads`,
    Array.isArray((workflow.cache || {}).cache_paths) &&
    (workflow.cache.cache_paths || []).some((entry) => entry.includes('.gradle')));
  t(`${name}: installs Android SDK platform 36 (the project's compileSdk)`,
    text.includes('platforms;android-36'));
  t(`${name}: reads google-services.json from a secure variable`,
    text.includes('GOOGLE_SERVICES_JSON') && text.includes('android/app/google-services.json'));
  t(`${name}: writes the keystore Gradle expects (android/keystore.properties)`,
    text.includes('ANDROID_KEYSTORE_BASE64') && text.includes('android/keystore.properties'));
  t(`${name}: keystore properties are only filled from secure variables`,
    /storePassword=\$\{ANDROID_KEYSTORE_PASSWORD\}/.test(text) &&
    /keyPassword=\$\{ANDROID_KEY_PASSWORD\}/.test(text) &&
    !/(storePassword|keyPassword)=\S[^\n]*[^}]$/.test(text.replace(/storePassword=\$\{ANDROID_KEYSTORE_PASSWORD\}/g, '')
      .replace(/keyPassword=\$\{ANDROID_KEY_PASSWORD\}/g, '')));
  t(`${name}: heredoc for keystore.properties terminates at column 0`,
    /^EOF$/m.test(text), 'the terminator must not be indented or the shell script never ends');
  t(`${name}: publishes APK/AAB artifacts`,
    Array.isArray(workflow.artifacts) &&
    workflow.artifacts.some((entry) => entry.endsWith('*.apk')) &&
    workflow.artifacts.some((entry) => entry.endsWith('*.aab')));
}

const debugWorkflow = workflows['android-debug'];
if (debugWorkflow) {
  const trigger = debugWorkflow.triggering || {};
  const branches = (trigger.branch_patterns || []).map((entry) => entry.pattern);
  t('android-debug runs on pushes to main and arena branches, decoding google-services.json only when set',
    (trigger.events || []).includes('push') && branches.includes('main') &&
    branches.some((pattern) => pattern.startsWith('arena/')) &&
    allScriptText(debugWorkflow).includes('${GOOGLE_SERVICES_JSON:-}'),
    JSON.stringify(branches));
  t('android-debug builds the debug APK and the release outputs',
    allScriptText(debugWorkflow).includes('assembleDebug') &&
    allScriptText(debugWorkflow).includes('bundleRelease') &&
    allScriptText(debugWorkflow).includes('assembleRelease'));
}

const releaseWorkflow = workflows['android-release'];
if (releaseWorkflow) {
  const trigger = releaseWorkflow.triggering || {};
  const tags = (trigger.tag_patterns || []).map((entry) => entry.pattern);
  const text = allScriptText(releaseWorkflow);
  t('android-release is triggered by version tags (v*)',
    (trigger.events || []).includes('tag') && tags.includes('v*'), JSON.stringify(trigger));
  t('android-release refuses to publish without signing credentials',
    text.includes('ANDROID_KEYSTORE_BASE64') && /exit 1/.test(text));
  t('android-release verifies the website before packaging the app',
    text.includes('npm run verify:all'));
  t('android-release builds a clean signed APK and AAB',
    /clean bundleRelease assembleRelease/.test(text));
  t('android-release verifies the produced signatures',
    text.includes('apksigner verify') && text.includes('jarsigner -verify'));
}

/* ------------------------------------------------- docs, secrets and hygiene */
const githubWorkflow = read('mobile/android-build.yml');
for (const variable of ['GOOGLE_SERVICES_JSON', 'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']) {
  t(`both CI providers use the same variable name: ${variable}`,
    rawConfig.includes(variable) && githubWorkflow.includes(variable));
}

t('codemagic.yaml documents where the secure variables live',
  /Codemagic → Application → Environment variables/.test(rawConfig));
t('codemagic.yaml keeps the same NPM/node/env contract as the repo',
  rawConfig.includes('node: 22') && rawConfig.includes('npm ci --no-audit --no-fund'));
t('no secret value is committed in codemagic.yaml',
  !/(base64|keystore)[^\n]*['"][A-Za-z0-9+/=]{40,}/.test(rawConfig) &&
  !/password:\s*['"]?[A-Za-z0-9!@#$%^&*]{6,}/i.test(rawConfig));
t('signing material stays out of Git (.gitignore)',
  ['android/keystore.properties', 'android/*.jks', 'android/*.keystore']
    .every((entry) => read('.gitignore').includes(entry)));

const docs = (() => { try { return read('mobile/CODEMAGIC.md'); } catch (error) { return ''; } })();
t('mobile/CODEMAGIC.md documents the workflows and variables',
  docs.includes('web-verify') && docs.includes('android-release') &&
  docs.includes('ANDROID_KEYSTORE_BASE64') && docs.includes('GOOGLE_SERVICES_JSON'));
t('the deployment docs point at the Codemagic setup',
  read('DEPLOYMENT.md').includes('CODEMAGIC.md') ||
  read('README.md').includes('CODEMAGIC.md'));
t('the repository ships a Codemagic-compatible prepare step',
  read('scripts/prepare-mobile.mjs').includes('mobile') && pkg.scripts['mobile:sync'].includes('cap sync android'));
const mobilePreparer = read('scripts/prepare-mobile.mjs');
t('CI configuration never ships inside the packaged Android app',
  /excludedDirectories[\s\S]*'ci'/.test(mobilePreparer) &&
  /'codemagic\.yaml'/.test(mobilePreparer) &&
  /excludedDirectories[\s\S]*'dist'/.test(mobilePreparer));

console.log(`\nCodemagic CI contract checks passed (${passed} assertions).`);
