#!/usr/bin/env node
/*
 * Prayer Dome — renders the one navigation configuration into the pages.
 * ---------------------------------------------------------------------------
 * assets/pd-nav.js is the single source of truth for the global menu, the
 * secondary drawer links and the bottom bar. This script writes that markup
 * into each page's #pdDrawer and .bottom-ui-system, with the correct active
 * destination for that page's own route, so:
 *
 *   • the HTML a browser receives already matches the menu the runtime
 *     renders (nothing flickers, nothing drifts between deploys),
 *   • `npm run nav:check` fails loudly when a page or the config is edited
 *     without regenerating (tests/nav.test.js runs the same check),
 *   • there is no second, page-local list of menu items anywhere.
 *
 * Usage:
 *   node scripts/build-nav.mjs           rewrite the pages
 *   node scripts/build-nav.mjs --check   report stale pages, exit 1
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAV_SRC = readFileSync(join(ROOT, 'assets', 'pd-nav.js'), 'utf8');
const CHECK = process.argv.includes('--check');

/** A fresh PDNav bound to one route, exactly as the browser would see it. */
function navFor(pagePath) {
  const window = { location: { pathname: pagePath }, console };
  const context = vm.createContext({ window, console, location: window.location });
  vm.runInContext(NAV_SRC, context, { filename: 'assets/pd-nav.js' });
  return window.PDNav;
}

function routeFor(file) {
  if (file === 'index.html') return '/';
  return '/' + file.replace(/\.html$/, '');
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : '';
}

const ASIDE = /<aside\b[^>]*\bid="pdDrawer"[^>]*>[\s\S]*?<\/aside>/i;
const BOTTOM = /<div class="bottom-ui-system">[\s\S]*?<\/div>\s*<\/div>/i;

function render(file) {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const nav = navFor(routeFor(file));
  let out = source;
  let changed = false;

  if (ASIDE.test(out)) {
    out = out.replace(ASIDE, () => {
      changed = true;
      return `<aside class="pd-drawer" id="pdDrawer" aria-label="Main menu">\n${indentBlock(nav.drawerMarkup(), 4)}</aside>`;
    });
  }

  // Only pages that already own a bottom bar get one; the bar's destinations
  // and active state always come from the shared config.
  const bar = out.match(/<nav class="nav-bar"[^>]*>[\s\S]*?<\/nav>/i);
  if (bar) {
    const id = attr(bar[0], 'id');
    out = out.replace(bar[0], () => {
      let markup = nav.bottomMarkup();
      if (id) markup = markup.replace('<nav class="nav-bar pd-nav-bar"', `<nav class="nav-bar pd-nav-bar" id="${id}"`);
      changed = true;
      return indentBlock(markup, 4).trimStart();
    });
  }

  return changed ? out : source;
}

/** Indent every line of a markup block (keeps the page's formatting readable). */
function indentBlock(html, spaces) {
  const pad = ' '.repeat(spaces);
  return html.split('\n').map((line) => pad + line).join('\n') + '\n';
}

const pages = readdirSync(ROOT).filter((name) => name.endsWith('.html')).sort();
const stale = [];
let written = 0;

for (const file of pages) {
  const before = readFileSync(join(ROOT, file), 'utf8');
  const after = render(file);
  if (after === before) continue;
  stale.push(file);
  if (!CHECK) {
    writeFileSync(join(ROOT, file), after);
    written += 1;
  }
}

if (CHECK) {
  if (stale.length) {
    console.error(`Navigation markup is stale in ${stale.length} page(s): ${stale.join(', ')}`);
    console.error('Run: node scripts/build-nav.mjs');
    process.exit(1);
  }
  console.log(`Navigation markup matches assets/pd-nav.js in all ${pages.length} pages.`);
} else {
  console.log(`Navigation rendered into ${written} page(s) from assets/pd-nav.js.`);
}
