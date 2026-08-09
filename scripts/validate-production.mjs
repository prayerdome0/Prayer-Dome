#!/usr/bin/env node
/**
 * Production-safe static validation for the dependency-free web bundle.
 *
 * Checks every first-party JavaScript file and all executable inline scripts.
 * JSON-LD script tags are deliberately excluded because they are data, not
 * JavaScript source. This catches a syntax failure before static hosting or a
 * Capacitor packaging build ships it to users.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const ignoredDirectories = new Set(['.git', 'android', 'node_modules']);
const sourceFiles = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    const file = join(directory, entry);
    const stat = statSync(file);
    if (stat.isDirectory()) walk(file);
    else if (['.js', '.mjs'].includes(extname(file))) sourceFiles.push(file);
  }
}

function check(file, code = null) {
  let temporaryDirectory = null;
  try {
    if (code !== null) {
      temporaryDirectory = mkdtempSync(join(tmpdir(), 'prayer-dome-validate-'));
      const temporary = join(temporaryDirectory, 'inline-script.mjs');
      writeFileSync(temporary, code, 'utf8');
      execFileSync(process.execPath, ['--check', temporary], { stdio: 'pipe' });
    } else {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    }
  } catch (error) {
    const diagnostic = String(error.stderr || error.stdout || error.message).trim();
    throw new Error(`${relative(root, file)} has invalid JavaScript:\n${diagnostic}`);
  } finally {
    if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

walk(root);
for (const file of sourceFiles) check(file);

const htmlFiles = readdirSync(root)
  .filter(file => extname(file).toLowerCase() === '.html')
  .map(file => join(root, file));
const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  let match;
  let index = 0;
  while ((match = scriptPattern.exec(html))) {
    const [, attributes, code] = match;
    index += 1;
    if (!code.trim() || /\btype\s*=\s*["']application\/(?:ld\+)?json["']/i.test(attributes)) continue;
    try {
      check(file, code);
    } catch (error) {
      throw new Error(`${error.message}\nInline script index: ${index}`);
    }
  }
}

console.log(`Validated ${sourceFiles.length} JavaScript files and executable inline scripts in ${htmlFiles.length} HTML pages.`);
