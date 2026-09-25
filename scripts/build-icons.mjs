#!/usr/bin/env node
/**
 * Prayer Dome icon system: build step.
 *
 * Generates the two icon files every page loads:
 *
 *   assets/pd-icons.css  The `.pd-i` base class plus one rule per icon. Each icon
 *                        is an SVG used as a CSS mask and painted with
 *                        `currentColor`, so it:
 *                          - scales without blurring at any size or pixel ratio,
 *                          - follows the text colour, so light and dark mode need no extra CSS,
 *                          - is sized by `font-size`, exactly like the text next to it.
 *   assets/pd-icons.js   `window.PDIcons` helpers, plus the upgrader that turns
 *                        icon names saved before the migration (Font Awesome
 *                        names or emoji in stored data and stale caches) into
 *                        Lucide icons.
 *
 * Icon sources. The whole app uses one visual language (24px grid, 2px round stroke):
 *   1. Lucide (https://lucide.dev, ISC). All UI icons. Only the icons the app
 *      uses are vendored in scripts/icons/lucide-subset.json, so installs stay light.
 *   2. scripts/icons/custom/*.svg: two faith glyphs Lucide lacks (praying hands,
 *      Latin cross), drawn to Lucide's spec.
 *   3. scripts/icons/brands/*.svg: third-party logos from Simple Icons (CC0), exposed
 *      only as `pd-i-brand-*` for share buttons and social links.
 *
 * Only referenced icons are bundled. The build scans the web source for
 * `pd-i-<name>` classes and `--pd-icon-<name>` custom properties, and adds every
 * target of the legacy maps so saved data can always be upgraded. An unknown name
 * fails the build, so a typo can never ship as a blank icon.
 *
 * Usage
 *   node scripts/build-icons.mjs           regenerate the outputs
 *   node scripts/build-icons.mjs --check   exit 1 if the outputs are stale or an icon is unknown
 *
 * To add a new Lucide icon, use it in markup (`<i class="pd-i pd-i-anchor"></i>`), then run:
 *   npm i --no-save lucide-static@<version in lucide-subset.json> && npm run build:icons
 * (or point LUCIDE_STATIC_DIR at an existing lucide-static checkout).
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = join(ROOT, 'scripts', 'icons');
const SUBSET_FILE = join(ICONS, 'lucide-subset.json');
const OUT_CSS = join(ROOT, 'assets', 'pd-icons.css');
const OUT_JS = join(ROOT, 'assets', 'pd-icons.js');
const CHECK = process.argv.includes('--check');

/** Size/animation helpers. These are `pd-i-*` classes, but not icons. */
const MODIFIERS = ['spin', 'fw', 'xs', 'sm', 'lg', '2x', '3x', '4x', '5x'];
/** Lucide shapes that also get a solid `-fill` variant (rating stars, live/online dots). */
const FILLABLE = new Set(['circle', 'star', 'heart', 'bookmark', 'play']);

const SCAN_SKIP = new Set([
  '.git', '.github', 'node_modules', 'android', 'dist', 'mobile', 'scripts', 'tests',
  'functions', 'api', 'seo'
]);
const SCAN_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css']);
const CLASS_PATTERN = /(?<![\w-])pd-i-([a-z0-9]+(?:-[a-z0-9]+)*)/g;
const VAR_PATTERN = /--pd-icon-([a-z0-9]+(?:-[a-z0-9]+)*)/g;

function readJSON(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function mapEntries(file) {
  return Object.entries(readJSON(file)).filter(([key]) => !key.startsWith('_'));
}

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    if (SCAN_SKIP.has(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (SCAN_EXTENSIONS.has(extname(entry)) && path !== OUT_CSS && path !== OUT_JS) files.push(path);
  }
  return files;
}

/** Every icon referenced by the web source, with the first place it is used. */
function scanUsage() {
  const classes = new Map();
  const variables = new Map();
  for (const file of walk(ROOT)) {
    const text = readFileSync(file, 'utf8');
    const where = (index) => `${relative(ROOT, file)}:${text.slice(0, index).split('\n').length}`;
    for (const match of text.matchAll(CLASS_PATTERN)) {
      if (MODIFIERS.includes(match[1])) continue;
      if (!classes.has(match[1])) classes.set(match[1], where(match.index));
    }
    for (const match of text.matchAll(VAR_PATTERN)) {
      if (!variables.has(match[1])) variables.set(match[1], where(match.index));
    }
  }
  return { classes, variables };
}

/** Inner markup of an SVG file: no comments, no <title>, no outer <svg> element. */
function svgBody(svg) {
  return svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<svg\b[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

function findLucideStatic() {
  const candidates = [process.env.LUCIDE_STATIC_DIR, join(ROOT, 'node_modules', 'lucide-static')].filter(Boolean);
  return candidates.find((dir) => existsSync(join(dir, 'icons'))) || null;
}

const STROKE_SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>";
const FILLED_SVG = STROKE_SVG.replace("fill='none'", "fill='#000'");
// Brand marks fill their whole 24px box; the -2 -2 28 28 viewBox insets them to
// match the optical size of Lucide icons, which keep 2px of padding.
const BRAND_SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='-2 -2 28 28' fill='#000'>";

function dataUri(svg) {
  const compact = svg.replace(/"/g, "'").replace(/\s+/g, ' ').trim();
  const encoded = compact
    .replace(/%/g, '%25').replace(/#/g, '%23')
    .replace(/</g, '%3C').replace(/>/g, '%3E')
    .replace(/\{/g, '%7B').replace(/\}/g, '%7D');
  return `url("data:image/svg+xml,${encoded}")`;
}

function fail(message) {
  console.error(`\n[build-icons] ${message}\n`);
  process.exit(1);
}

// ------------------------------------------------------------------ resolve --
const faMap = mapEntries(join(ICONS, 'legacy-fontawesome.json'));
const emojiMap = mapEntries(join(ICONS, 'legacy-emoji.json'));
const { classes, variables } = scanUsage();

const needed = new Map([...classes]);
for (const [name, where] of variables) if (!needed.has(name)) needed.set(name, where);
for (const [key, name] of faMap) if (!needed.has(name)) needed.set(name, `legacy-fontawesome.json (${key})`);
for (const [key, name] of emojiMap) if (!needed.has(name)) needed.set(name, `legacy-emoji.json (${key})`);

const customNames = new Set(readdirSync(join(ICONS, 'custom')).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)));
const brandNames = new Set(readdirSync(join(ICONS, 'brands')).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)));

const subset = existsSync(SUBSET_FILE) ? readJSON(SUBSET_FILE) : { source: 'lucide-static', license: 'ISC', icons: {} };
const lucideNeeded = new Set();
for (const name of needed.keys()) {
  if (name.startsWith('brand-') || customNames.has(name)) continue;
  const base = name.endsWith('-fill') && FILLABLE.has(name.slice(0, -5)) ? name.slice(0, -5) : name;
  lucideNeeded.add(base);
}

// Pull icons that are missing from the vendored subset out of lucide-static, if installed.
const missing = [...lucideNeeded].filter((name) => !subset.icons[name]);
if (missing.length) {
  const lucideDir = findLucideStatic();
  if (lucideDir && !CHECK) {
    const pkg = readJSON(join(lucideDir, 'package.json'));
    const tags = existsSync(join(lucideDir, 'tags.json')) ? readJSON(join(lucideDir, 'tags.json')) : null;
    for (const name of missing) {
      const file = join(lucideDir, 'icons', `${name}.svg`);
      if (!existsSync(file)) continue;
      if (tags && !tags[name]) console.warn(`[build-icons] "${name}" is a deprecated Lucide alias; prefer its canonical name.`);
      subset.icons[name] = svgBody(readFileSync(file, 'utf8'));
    }
    subset.source = `lucide-static@${pkg.version}`;
  }
}

const unknown = [];
for (const [name, where] of needed) {
  if (name.startsWith('brand-')) {
    if (!brandNames.has(name.slice(6))) unknown.push(`${name}  (used at ${where})`);
    continue;
  }
  if (customNames.has(name)) continue;
  const base = name.endsWith('-fill') && FILLABLE.has(name.slice(0, -5)) ? name.slice(0, -5) : name;
  if (!subset.icons[base]) unknown.push(`${name}  (used at ${where})`);
}
if (unknown.length) {
  fail(
    `Unknown icon name(s):\n  ${unknown.join('\n  ')}\n\n` +
    'Use a Lucide name from https://lucide.dev/icons. To vendor a new Lucide icon run\n' +
    `  npm i --no-save ${subset.source || 'lucide-static'} && npm run build:icons`
  );
}

// ----------------------------------------------------------------- generate --
function iconSvg(name) {
  if (name.startsWith('brand-')) {
    const svg = readFileSync(join(ICONS, 'brands', `${name.slice(6)}.svg`), 'utf8');
    return BRAND_SVG + svgBody(svg) + '</svg>';
  }
  if (customNames.has(name)) {
    return STROKE_SVG + svgBody(readFileSync(join(ICONS, 'custom', `${name}.svg`), 'utf8')) + '</svg>';
  }
  if (name.endsWith('-fill') && FILLABLE.has(name.slice(0, -5))) {
    return FILLED_SVG + subset.icons[name.slice(0, -5)] + '</svg>';
  }
  return STROKE_SVG + subset.icons[name] + '</svg>';
}

const names = [...needed.keys()].sort();
const varNames = [...variables.keys()].sort();

const css = `/*
 * Prayer Dome icon system. GENERATED by scripts/build-icons.mjs; do not edit by hand.
 *
 * Usage:   <i class="pd-i pd-i-bell" aria-hidden="true"></i>
 * Size:    font-size (1em icon), or pd-i-xs | sm | lg | 2x | 3x | 4x | 5x
 * Colour:  currentColor, so icons follow light/dark mode and any text colour
 * Extras:  pd-i-fw (fixed width), pd-i-spin (loading spinners)
 * In CSS:  mask-image: var(--pd-icon-<name>) for pseudo-element icons
 *
 * Icons:   Lucide ${subset.source.replace('lucide-static@', 'v')}, https://lucide.dev (ISC License, (c) Lucide Contributors)
 * Custom:  hands-praying, latin-cross, drawn to the Lucide spec by Prayer Dome
 * Brands:  brand-* from Simple Icons, https://simpleicons.org (CC0 1.0)
 */
.pd-i {
  display: inline-block;
  flex-shrink: 0;
  font-style: normal;
  font-variant: normal;
  font-weight: normal;
  line-height: 1;
  text-rendering: auto;
}
.pd-i::before {
  content: "";
  display: inline-block;
  width: 1em;
  height: 1em;
  vertical-align: -0.125em;
  background-color: currentColor;
  -webkit-mask-image: var(--pd-i, linear-gradient(transparent, transparent));
  mask-image: var(--pd-i, linear-gradient(transparent, transparent));
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.pd-i-fw { width: 1.25em; text-align: center; }
.pd-i-xs { font-size: 0.75em; }
.pd-i-sm { font-size: 0.875em; }
.pd-i-lg { font-size: 1.25em; line-height: 0.05em; vertical-align: -0.075em; }
.pd-i-2x { font-size: 2em; }
.pd-i-3x { font-size: 3em; }
.pd-i-4x { font-size: 4em; }
.pd-i-5x { font-size: 5em; }
.pd-i-spin::before { animation: pd-i-spin 0.9s linear infinite; }
@keyframes pd-i-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .pd-i-spin::before { animation-duration: 1.8s; }
}
/* PDIcons.inline(): canvas/PDF capture (html2canvas cannot paint CSS masks). */
.pd-i-inline::before { display: none; }
.pd-i-inline > img { display: inline-block; width: 1em; height: 1em; vertical-align: -0.125em; }
@media (forced-colors: active) {
  .pd-i::before { forced-color-adjust: none; background-color: currentColor; }
}
${varNames.length ? `:root {\n${varNames.map((n) => `  --pd-icon-${n}: ${dataUri(iconSvg(n))};`).join('\n')}\n}\n` : ''}${names.map((n) => `.pd-i-${n}{--pd-i:${dataUri(iconSvg(n))}}`).join('\n')}
`;

function jsString(value) {
  // ASCII-only output: emoji keys are written as \\u escapes.
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

const js = `/*
 * Prayer Dome icon runtime. GENERATED by scripts/build-icons.mjs; do not edit by hand.
 *
 *   PDIcons.html('bell')                     -> '<i class="pd-i pd-i-bell" aria-hidden="true"></i>'
 *   PDIcons.cls(savedIcon, 'pd-i-megaphone') -> 'pd-i pd-i-<resolved>' (falls back to megaphone)
 *   PDIcons.resolve('fas fa-church')         -> 'church'  (legacy Font Awesome name)
 *   PDIcons.resolve('\\ud83d\\ude4f')                -> 'hands-praying' (legacy emoji value)
 *
 * It also upgrades legacy Font Awesome markup (e.g. from a script still in a
 * cache during a deploy, or HTML saved in the database) to the Lucide icons.
 * PDIcons.inline(el) prepares icons for html2canvas/PDF capture.
 * PDIcons.plain(text) drops a leading emoji from labels saved before the migration.
 */
(function (global) {
  'use strict';
  var NAMES = ' ${names.join(' ')} ';
  var FA = ${jsString(Object.fromEntries(faMap))};
  var EMOJI = ${jsString(Object.fromEntries(emojiMap.map(([k, v]) => [k.replace(/\uFE0F/g, ''), v])))};
  var MODS = ${jsString(Object.fromEntries(MODIFIERS.map((m) => [m, 1])))};
  var STYLE = /^(fa|fas|far|fab|fa-solid|fa-regular|fa-brands|fa-light|fa-thin|fa-duotone)$/;

  function has(name) {
    return typeof name === 'string' && name !== '' && NAMES.indexOf(' ' + name + ' ') !== -1;
  }

  function lookup(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return '';
    var bare = text.replace(/\\ufe0f/g, '');
    if (EMOJI[bare]) return EMOJI[bare];
    var tokens = text.split(/\\s+/);
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.indexOf('pd-i-') === 0) { if (has(t.slice(5))) return t.slice(5); }
      else if (t.indexOf('fa-') === 0) { if (FA[t.slice(3)]) return FA[t.slice(3)]; }
      else if (has(t)) return t;
    }
    // Emoji followed by text, e.g. a saved "\\ud83d\\ude4f Prayer" label.
    for (var key in EMOJI) if (bare.indexOf(key) === 0) return EMOJI[key];
    return '';
  }

  /** Lucide name for a Lucide name, pd-i class, Font Awesome class/name or emoji. */
  function resolve(value, fallback) {
    return lookup(value) || (fallback ? lookup(fallback) : '') || '';
  }

  function cls(value, fallback, extra) {
    var name = resolve(value, fallback || 'pd-i-circle');
    return 'pd-i pd-i-' + name + (extra ? ' ' + extra : '');
  }

  function html(value, extra, fallback) {
    return '<i class="' + cls(value, fallback, extra) + '" aria-hidden="true"></i>';
  }

  /**
   * Swap mask icons inside \`root\` for recoloured <img> SVGs. Use it in
   * html2canvas's \`onclone\` hook: canvas capture cannot paint CSS masks.
   */
  function inline(root) {
    if (!root || !root.querySelectorAll) return root;
    var view = (root.ownerDocument || root).defaultView || global;
    var icons = root.querySelectorAll('.pd-i');
    for (var i = 0; i < icons.length; i++) {
      var el = icons[i];
      if (el.classList.contains('pd-i-inline')) continue;
      var style = view.getComputedStyle(el);
      var match = /url\\(\\s*"data:image\\/svg\\+xml,([^"]*)"\\s*\\)/.exec(style.getPropertyValue('--pd-i'));
      if (!match) continue;
      var svg = decodeURIComponent(match[1]).replace(/#000/g, style.color || '#000');
      var img = (el.ownerDocument || global.document).createElement('img');
      img.alt = '';
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      el.classList.add('pd-i-inline');
      el.appendChild(img);
    }
    return root;
  }

  /* Text without leading emoji, for labels saved before the migration
   * ("\ud83c\udf0d General" -> "General"). (c), (R) and TM are kept. */
  var LEADING = /^(?![\\u00A9\\u00AE\\u2122])(?:\\p{Extended_Pictographic}|\\p{Regional_Indicator})(?:[\\uFE0F\\u200D]|\\p{Extended_Pictographic}|\\p{Regional_Indicator}|\\p{Emoji_Modifier})*\\s*/u;
  function plain(text) {
    return String(text == null ? '' : text).replace(LEADING, '');
  }

  function upgradeElement(el) {
    if (!el || typeof el.className !== 'string' || el.className.indexOf('fa') === -1) return;
    var tokens = el.className.split(/\\s+/);
    var isLegacy = false;
    for (var i = 0; i < tokens.length; i++) if (STYLE.test(tokens[i])) { isLegacy = true; break; }
    if (!isLegacy) return;
    var out = ['pd-i'];
    for (var j = 0; j < tokens.length; j++) {
      var t = tokens[j];
      if (!t || STYLE.test(t) || t === 'pd-i') continue;
      if (t.indexOf('fa-') === 0) {
        var n = t.slice(3);
        if (MODS[n]) out.push('pd-i-' + n);
        else if (n === 'pulse' || n === 'spin-pulse') out.push('pd-i-spin');
        else if (FA[n]) out.push('pd-i-' + FA[n]);
      } else {
        out.push(t);
      }
    }
    el.className = out.join(' ');
    if (!el.hasAttribute('aria-hidden') && !el.textContent) el.setAttribute('aria-hidden', 'true');
  }

  function upgrade(root) {
    root = root || global.document;
    if (!root) return;
    if (root.nodeType === 1) upgradeElement(root);
    if (!root.querySelectorAll) return;
    var found = root.querySelectorAll('[class*="fa-"]');
    for (var i = 0; i < found.length; i++) upgradeElement(found[i]);
  }

  function watch() {
    upgrade(global.document);
    if (typeof global.MutationObserver !== 'function') return;
    new global.MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === 'attributes') { upgradeElement(r.target); continue; }
        for (var j = 0; j < r.addedNodes.length; j++) {
          var node = r.addedNodes[j];
          if (node.nodeType === 1) upgrade(node);
        }
      }
    }).observe(global.document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  if (global.document) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', watch);
    else watch();
  }

  global.PDIcons = { has: has, resolve: resolve, cls: cls, html: html, plain: plain, inline: inline, upgrade: upgrade };
})(typeof window !== 'undefined' ? window : this);
`;

// -------------------------------------------------------------------- write --
const subsetOut = {
  source: subset.source,
  license: 'ISC (c) Lucide Contributors, https://lucide.dev/license',
  note: 'Vendored subset of the Lucide icons Prayer Dome uses. Maintained by scripts/build-icons.mjs; do not edit by hand.',
  icons: Object.fromEntries([...lucideNeeded].sort().map((name) => [name, subset.icons[name]]))
};
const outputs = [
  [OUT_CSS, css],
  [OUT_JS, js],
  [SUBSET_FILE, JSON.stringify(subsetOut, null, 2) + '\n']
];

if (CHECK) {
  const stale = outputs
    .filter(([file, content]) => file !== SUBSET_FILE && (!existsSync(file) || readFileSync(file, 'utf8') !== content))
    .map(([file]) => relative(ROOT, file));
  if (stale.length) fail(`Out of date: ${stale.join(', ')}. Run: npm run build:icons`);
  console.log(`Icons OK: ${names.length} icons (${classes.size} referenced in source), outputs up to date.`);
} else {
  for (const [file, content] of outputs) writeFileSync(file, content);
  const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB';
  console.log(`Built ${names.length} icons -> assets/pd-icons.css (${kb(css)}), assets/pd-icons.js (${kb(js)}).`);
}
