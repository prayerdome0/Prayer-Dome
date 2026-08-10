#!/usr/bin/env node
/**
 * Postinstall hook: install the Firebase Functions sub-package dependencies
 * on clean checkouts so `npm run verify:all` (functions:verify) works locally.
 *
 * Skipped on Vercel: the deployment only serves the static bundle plus the
 * dependency-free handlers in /api, so installing firebase-admin and
 * firebase-functions (~290 packages) there only adds build time and failure
 * surface without affecting the deployed site. Also skipped whenever the
 * functions/ package itself is absent (e.g. filtered uploads), so the hook
 * is safe to keep wired up regardless of environment.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const functionsManifest = new URL('../functions/package.json', import.meta.url);

if (process.env.VERCEL) {
  console.log('postinstall: Vercel build detected — skipping functions/ install (not needed for static hosting or /api handlers).');
  process.exit(0);
}

if (!existsSync(functionsManifest)) {
  console.log('postinstall: functions/package.json not present (filtered checkout) — skipping functions/ install.');
  process.exit(0);
}

const result = spawnSync('npm', ['--prefix', 'functions', 'install', '--no-audit', '--no-fund'], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.error) {
  console.error(`postinstall: failed to run npm install in functions/: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
