#!/usr/bin/env node
/**
 * Build the Vercel static output from an explicit public-file allowlist.
 *
 * Without an output directory Vercel's "Other" framework preset can publish
 * repository files that were never meant to be web assets (tests, Android
 * sources, build scripts, and configuration). This build keeps serverless
 * functions in /api while ensuring only the website is emitted to /dist.
 */
import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync
} from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';

const ROOT = process.cwd();
const OUTPUT = join(ROOT, 'dist');
const PUBLIC_DIRECTORIES = ['assets', 'documents'];
const PUBLIC_ROOT_FILES = [
  'Prayer-Dome-User-Guide.pdf',
  'ai-prayer-data.js',
  'devotional-data.js',
  'firebase-messaging-sw.js',
  'live-stream-config.js',
  'manifest.json',
  'robots.txt',
  'sermons-data.js',
  'sitemap.xml',
  'sw.js',
  'translation-data.js'
];
// Source artefacts that live in a published directory but are build inputs only.
const EXCLUDED_PUBLIC_FILES = new Set([
  join('assets', 'logo-master.png'),
  join('assets', 'logo-source.png')
]);

function copyRequired(source, destination) {
  if (!existsSync(source)) {
    throw new Error(`Required public file is missing: ${relative(ROOT, source)}`);
  }
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(OUTPUT, { recursive: true });

for (const name of readdirSync(ROOT)) {
  if (extname(name).toLowerCase() !== '.html') continue;
  copyRequired(join(ROOT, name), join(OUTPUT, name));
}

for (const name of PUBLIC_ROOT_FILES) {
  copyRequired(join(ROOT, name), join(OUTPUT, name));
}

for (const directory of PUBLIC_DIRECTORIES) {
  const source = join(ROOT, directory);
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    throw new Error(`Required public directory is missing: ${directory}`);
  }
  cpSync(source, join(OUTPUT, directory), {
    recursive: true,
    // Design-time originals are kept in the repository for scripts/build-logo.py
    // but must never be published: they are large and serve no visitor.
    filter: (from) => !EXCLUDED_PUBLIC_FILES.has(relative(ROOT, from))
  });
}

let files = 0;
let bytes = 0;
function measure(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) measure(path);
    else {
      files += 1;
      bytes += stat.size;
    }
  }
}
measure(OUTPUT);

console.log(`Vercel public bundle: ${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MiB in dist/.`);
