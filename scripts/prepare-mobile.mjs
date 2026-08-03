import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(repoRoot, 'mobile', 'www');

// The website is intentionally kept at the repository root because Firebase and
// Vercel serve it directly. Capacitor gets a clean, generated copy so the
// Android project never bundles server-only files or its own build directory.
const excludedDirectories = new Set([
  '.git',
  '.github',
  '.idea',
  '.next',
  '.vercel',
  'android',
  'api',
  'functions',
  'mobile',
  'node_modules',
  'scripts',
  'seo',
  'tests'
]);

const excludedFiles = new Set([
  '.gitignore',
  'BRAND-AND-CONTENT.md',
  'README.md',
  'UPGRADE-NOTES.md',
  'capacitor.config.json',
  'package.json',
  'package-lock.json',
  'vercel.json',
  'firebase.json',
  'functions_index.js',
  'firestore.rules',
  'storage.rules'
]);

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

async function copyEntry(name) {
  if (excludedFiles.has(name) || excludedDirectories.has(name)) return;
  await cp(path.join(repoRoot, name), path.join(outputDir, name), {
    recursive: true,
    force: true,
    dereference: true
  });
}

const entries = await readdir(repoRoot, { withFileTypes: true });
for (const entry of entries) {
  await copyEntry(entry.name);
}

console.log(`Prepared ${outputDir.replace(`${repoRoot}${path.sep}`, '')} from the web source.`);
