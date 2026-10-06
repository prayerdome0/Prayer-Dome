/*
 * Page wiring audit — the "the page loaded but the control does nothing" class
 * of bug, checked statically for every HTML page:
 *
 * Inline attributes (`onclick="loadGallery()"`, `onchange="…"`) are compiled by
 * the browser into a function whose scope chain ends at the global object —
 * they cannot see `let`/`const`/`function` declarations that live inside
 * <script type="module">, because module scope is private. When a page moved a
 * helper into its module without publishing it on `window`, the control simply
 * stopped responding (the click threw a ReferenceError and nothing else
 * happened) — the same symptom as "I click and no page moves".
 *
 * Three audits live here:
 *
 *   1. every call made from an inline handler must be reachable — published on
 *      window/self/globalThis, declared in a classic script, provided by a
 *      shared asset, or a browser global. `${…}` interpolations inside
 *      template-built markup are removed first, because those calls are
 *      evaluated while the markup is generated (in module scope) and never run
 *      in the handler itself.
 *   2. every `window.<name> = <value>;` publish must resolve that value, so the
 *      module cannot throw a ReferenceError part-way through loading and leave
 *      everything after it unexecuted.
 *   3. no page re-uses a static element id, so `getElementById` always reaches
 *      the element the code means (duplicates silently bind listeners and
 *      styles to the wrong node).
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const IGNORED_PAGES = new Set(['404.html', 'offline.html']);

/* Browser globals an inline handler may always call. */
const BROWSER_GLOBALS = new Set([
  'window', 'document', 'event', 'this', 'location', 'history', 'navigator', 'console',
  'alert', 'confirm', 'prompt', 'open', 'close', 'print', 'focus', 'blur', 'scrollTo',
  'scrollBy', 'URL', 'URLSearchParams', 'JSON', 'Object', 'Array', 'Math', 'String',
  'Number', 'Boolean', 'Date', 'RegExp', 'Error', 'Promise', 'Set', 'Map', 'WeakMap',
  'Intl', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'parseInt',
  'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'encodeURIComponent', 'decodeURI',
  'decodeURIComponent', 'structuredClone', 'requestAnimationFrame', 'cancelAnimationFrame',
  'fetch', 'Notification', 'CustomEvent', 'Event', 'FormData', 'Blob', 'File', 'FileReader',
  'Image', 'Audio', 'XMLHttpRequest', 'AbortController', 'crypto', 'performance',
  'localStorage', 'sessionStorage', 'matchMedia', 'getComputedStyle', 'btoa', 'atob',
  'screen', 'innerWidth', 'innerHeight', 'devicePixelRatio', 'queueMicrotask'
]);
/* Keywords and control-flow words that look like calls in the regex. */
const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'return', 'typeof', 'new', 'delete', 'void', 'in', 'of',
  'true', 'false', 'null', 'undefined', 'function', 'catch', 'try', 'switch', 'case',
  'do', 'throw', 'instanceof', 'class', 'await', 'async', 'yield', 'super', 'import',
  'export', 'let', 'const', 'var', 'break', 'continue', 'finally', 'default', 'extends'
]);

let passed = 0;
function t(name, ok, extra = '') {
  if (ok) { passed += 1; console.log('PASS  ' + name); }
  else { console.error('FAIL  ' + name + (extra ? '  ' + extra : '')); process.exitCode = 1; }
}

/** Remove ${ … } (nesting aware) so only the handler's own text is analysed. */
function stripInterpolations(text) {
  let output = '';
  let index = 0;
  while (index < text.length) {
    if (text[index] === '$' && text[index + 1] === '{') {
      let depth = 0;
      index += 1;
      do {
        if (text[index] === '{') depth += 1;
        else if (text[index] === '}') depth -= 1;
        index += 1;
      } while (index < text.length && depth > 0);
      output += 'VALUE';
      continue;
    }
    output += text[index];
    index += 1;
  }
  return output;
}

const HANDLER_ATTRIBUTE = /\son(?:click|change|input|submit|keyup|keydown|keypress|blur|focus|error|load|dblclick|drag\w*|drop|mouse\w+|touch\w+|scroll)\s*=\s*("([^"]*)"|'([^']*)')/g;

function handlerBodies(html) {
  const bodies = [];
  for (const match of html.matchAll(HANDLER_ATTRIBUTE)) {
    bodies.push(stripInterpolations(match[2] !== undefined ? match[2] : match[3] || ''));
  }
  return bodies;
}

function calledNames(body) {
  const names = new Set();
  // Ignore member calls (`foo.bar()`), string contents and property positions.
  for (const match of body.matchAll(/(^|[^.\w$'"`])([A-Za-z_$][\w$]*)\s*\(/g)) names.add(match[2]);
  return [...names];
}

function classicScripts(html) {
  // Scripts without type="module" (or a different type) execute in global scope.
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((match) => !/type\s*=\s*["']module["']/.test(match[1]))
    .filter((match) => !/type\s*=\s*["'](?:application|text)\/(?:ld\+json|json|template)["']/.test(match[1]))
    .map((match) => match[2])
    .join('\n');
}

function reachableNames(html, file) {
  const names = new Set();
  // Anything explicitly published, anywhere in the page.
  for (const match of html.matchAll(/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(match[1]);
  for (const match of html.matchAll(/\b(?:window|self|globalThis)\[['"]([A-Za-z_$][\w$]*)['"]\]\s*=/g)) names.add(match[1]);
  // Top-level declarations of classic scripts.
  const classic = classicScripts(html);
  for (const match of classic.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) names.add(match[1]);
  for (const match of classic.matchAll(/^\s*(?:var|let|const)\s+([A-Za-z_$][\w$]*)/gm)) names.add(match[1]);
  // Shared asset bundles define plenty of globals; treat their files as sources.
  for (const match of html.matchAll(/<script[^>]*src=["']([^"']+\.js)["']/g)) {
    const relative = match[1].replace(/^\//, '');
    const source = path.join(ROOT, relative);
    if (!fs.existsSync(source)) continue;
    const assets = fs.readFileSync(source, 'utf8');
    for (const assigned of assets.matchAll(/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(assigned[1]);
  }
  return names;
}

const pages = fs.readdirSync(ROOT)
  .filter((name) => name.endsWith('.html') && !IGNORED_PAGES.has(name))
  .filter((name) => /<script[^>]*type\s*=\s*["']module["']/.test(fs.readFileSync(path.join(ROOT, name), 'utf8')));

t('the audit finds the module pages that can break inline handlers', pages.length >= 20, `${pages.length} pages`);

const problems = [];
let handlerCount = 0;
for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const reachable = reachableNames(html, page);
  for (const body of handlerBodies(html)) {
    if (!body.trim()) continue;
    handlerCount += 1;
    for (const name of calledNames(body)) {
      if (BROWSER_GLOBALS.has(name) || KEYWORDS.has(name)) continue;
      if (!reachable.has(name)) problems.push(`${page}: ${name}() — ${body.trim().slice(0, 60)}`);
    }
  }
}

t(`every inline handler on ${pages.length} module pages can resolve its call (${handlerCount} handlers scanned)`,
  problems.length === 0, '\n     ' + problems.join('\n     '));

// The specific controls that used to be dead because their helper stayed
// module-private. They must keep working.
for (const [page, needle, label] of [
  ['admin.html', 'window.loadGallery = loadGallery;', 'admin gallery Refresh / status / category filters'],
  ['event.html', 'window.loadMyEvents = loadMyEvents;', 'event page “Refresh”'],
  ['events.html', 'window.showLoginPrompt = showLoginPrompt;', 'events “Login to RSVP”'],
  ['give.html', 'window.fetchExchangeRates = fetchExchangeRates;', 'giving page exchange-rate refresh'],
  ['live.html', 'window.closeModal = closeModal;', 'live modals (share / report) Close'],
  ['live.html', 'window.toggleDark = toggleDark;', 'live theme toggle'],
  ['live.html', 'window.esc = esc;', 'live avatar-initials fallback'],
  ['testimony.html', 'window.scrollToGrid = scrollToGrid;', 'testimonies “Read Stories”']
]) {
  t(`${page} publishes ${label} for its inline handler`,
    fs.readFileSync(path.join(ROOT, page), 'utf8').includes(needle));
}


/* ---------------------------------------------------------------------------
 * Unresolvable publication.
 *
 * `window.helper = helper;` works when `helper` is either a binding declared in
 * the module *or* a property of the global object (a bare identifier resolves
 * through the scope chain to window), which is why the publish blocks at the
 * end of several page modules are fine even though the names are not declared
 * with `function`. The line that genuinely breaks is the one whose identifier
 * resolves nowhere: it throws a ReferenceError while the module is evaluating,
 * and every statement after it silently stops running.
 *
 * So the rule is resolvability, not "must be declared here": the right-hand
 * side has to be a module binding, a window property created earlier in the
 * page/module, an import, or a browser global.
 * ------------------------------------------------------------------------- */
function moduleBindings(code) {
  const bound = new Set();
  for (const match of code.matchAll(/(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g)) bound.add(match[1]);
  for (const match of code.matchAll(/(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) bound.add(match[1]);
  for (const match of code.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
    for (const part of match[1].split(',')) bound.add(part.trim().split(/\s+as\s+/).pop().trim());
  }
  for (const match of code.matchAll(/import\s+\*?\s*([A-Za-z_$][\w$]*)\s+from/g)) bound.add(match[1]);
  for (const match of code.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const part of match[1].split(',')) bound.add(part.trim().split(':').pop().trim());
  }
  for (const match of code.matchAll(/(?:const|let|var)\s*\[([^\]]*)\]\s*=/g)) {
    for (const part of match[1].split(',')) bound.add(part.trim());
  }
  for (const match of code.matchAll(/function[^(]*\(([^)]*)\)/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/[=:]/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) bound.add(name);
    }
  }
  return bound;
}

/** Global properties a page creates anywhere in its scripts. */
function pageGlobals(html) {
  const names = new Set();
  for (const match of html.matchAll(/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(match[1]);
  for (const match of html.matchAll(/\b(?:window|self|globalThis)\[['"]([A-Za-z_$][\w$]*)['"]\]\s*=/g)) names.add(match[1]);
  const classic = classicScripts(html);
  for (const match of classic.matchAll(/^\s*(?:var|function)\s+([A-Za-z_$][\w$]*)/gm)) names.add(match[1]);
  // Implicit globals: `something = function …` without a declaration keyword.
  for (const match of classic.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function|\()/gm)) names.add(match[1]);
  return names;
}

const unresolvable = [];
let publishCount = 0;

/** Global properties created by the shared assets a page loads before its module. */
function assetGlobals(html) {
  const names = new Set();
  for (const match of html.matchAll(/<script[^>]*src=["']([^"']+\.js)["']/g)) {
    const source = path.join(ROOT, match[1].replace(/^\//, ''));
    if (!fs.existsSync(source)) continue;
    const asset = fs.readFileSync(source, 'utf8');
    for (const assigned of asset.matchAll(/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(assigned[1]);
    for (const assigned of asset.matchAll(/^\s*(?:var|function)\s+([A-Za-z_$][\w$]*)/gm)) names.add(assigned[1]);
  }
  return names;
}

/** Names a classic (non-module) script leaves on the global object. */
function classicGlobals(html) {
  const classic = classicScripts(html);
  const names = new Set();
  for (const match of classic.matchAll(/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(match[1]);
  for (const match of classic.matchAll(/^\s*(?:var|function)\s+([A-Za-z_$][\w$]*)/gm)) names.add(match[1]);
  for (const match of classic.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function|\()/gm)) names.add(match[1]);
  return names;
}

for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const assets = assetGlobals(html);
  const classic = classicGlobals(html);
  const modules = [...html.matchAll(/<script[^>]*type\s*=\s*["']module["'][^>]*>([\s\S]*?)<\/script>/g)];
  for (const moduleMatch of modules) {
    const code = moduleMatch[1];
    const bound = moduleBindings(code);
    // Global properties this module creates, in source order: a publish may
    // only rely on values that already exist when its line runs.
    const created = new Set();
    const lines = code.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      // Evaluate the publishes against what exists *before* this line — a line
      // cannot satisfy itself (`window.helper = helper;` with nothing else
      // declaring helper is exactly the failure this audit looks for).
      for (const match of line.matchAll(/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;/g)) {
        publishCount += 1;
        const [, left, right] = match;
        if (bound.has(right) || created.has(right) || assets.has(right) || classic.has(right) ||
            BROWSER_GLOBALS.has(right) || KEYWORDS.has(right)) continue;
        unresolvable.push(`${page}:${index + 1}  window.${left} = ${right};  (${right} resolves to nothing — this throws while the module loads)`);
      }
      // Then record the globals this line creates for the lines that follow.
      for (const match of line.matchAll(/\b(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*(?:=|\[)/g)) created.add(match[1]);
      for (const match of line.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function|\()/g)) created.add(match[1]);
    }
  }
}

t(`every window.<name> publish resolves its value (${publishCount} publishes scanned)`,
  unresolvable.length === 0, '\n     ' + unresolvable.join('\n     '));

// The controls repaired in this pass: module-scoped helpers that inline markup
// calls directly, published so the click no longer throws.
for (const [page, needle, label] of [
  ['admin.html', 'window.loadGallery = loadGallery;', 'gallery Refresh + status/category filters'],
  ['event.html', 'window.loadMyEvents = loadMyEvents;', '“Refresh” on the event page'],
  ['events.html', 'window.showLoginPrompt = showLoginPrompt;', '“Login to RSVP” on the events list'],
  ['give.html', 'window.fetchExchangeRates = fetchExchangeRates;', 'exchange-rate refresh'],
  ['live.html', 'window.closeModal = closeModal;', 'share/report modal Close'],
  ['live.html', 'window.toggleDark = toggleDark;', 'theme toggle'],
  ['live.html', 'window.esc = esc;', 'avatar-initials fallback'],
  ['testimony.html', 'window.scrollToGrid = scrollToGrid;', '“Read Stories” jump link']
]) {
  t(`${page} publishes ${label}`, fs.readFileSync(path.join(ROOT, page), 'utf8').includes(needle));
}

/* ---------------------------------------------------------- 3. DOM conflicts */
const duplicateIds = [];
for (const page of fs.readdirSync(ROOT).filter((name) => name.endsWith('.html') && !IGNORED_PAGES.has(name))) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  // Markup only: ids inside <script>/<style> are templates or selectors.
  const markup = html
    .replace(/<script[\s\S]*?<\/script>/g, '<script></script>')
    .replace(/<style[\s\S]*?<\/style>/g, '');
  const seen = new Map();
  for (const match of markup.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)) {
    seen.set(match[1], (seen.get(match[1]) || 0) + 1);
  }
  for (const [id, count] of seen) {
    if (count > 1) duplicateIds.push(`${page}: #${id} appears ${count} times`);
  }
}
t('no page declares the same element id twice', duplicateIds.length === 0,
  '\n     ' + duplicateIds.join('\n     '));

// The console is the page where a wrong lookup is most visible: every view,
// modal and control id must be unique so handlers bind to the intended node.
const adminMarkup = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/g, '<script></script>');
const adminIds = [...adminMarkup.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)].map((match) => match[1]);
t(`the admin console's ${adminIds.length} element ids are unique`,
  new Set(adminIds).size === adminIds.length);
t('every admin view panel has a matching sidebar entry',
  [...adminMarkup.matchAll(/data-view="([a-z_-]+)"/g)]
    .every((match) => match[1] === 'team' || adminMarkup.includes(`id="view-${match[1]}"`)));

console.log(`\nPage wiring audit passed (${passed} assertions).`);
