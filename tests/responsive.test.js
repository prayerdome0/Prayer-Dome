'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const htmlFiles = [
  ...fs.readdirSync(ROOT).filter(name => name.endsWith('.html')).map(name => path.join(ROOT, name)),
  path.join(ROOT, 'documents', 'index.html')
];

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /<meta\s+name=["']viewport["']/i, `${path.relative(ROOT, file)} needs a mobile viewport`);
}

function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 's'));
  assert.ok(match, `Missing CSS rule: ${selector}`);
  return match[1];
}

function rules(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'gs'))].map(match => match[1]);
}

const admin = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
assert.match(rule(admin, 'body'), /height:\s*100vh;[\s\S]*height:\s*100dvh;/,
  'Admin shell should use the dynamic viewport height on mobile browsers');
assert.match(rule(admin, '.main-content'), /min-height:\s*0/,
  'Admin flex content must be allowed to shrink into its scroll area');
assert.match(rule(admin, '.content-area'), /overflow-y:\s*auto/);
assert.match(rule(admin, '.content-area'), /min-height:\s*0/);
assert.match(rule(admin, '.modal-overlay'), /height:\s*100dvh/);
assert.match(rule(admin, '.modal-card'), /overflow-y:\s*auto/);

const chat = fs.readFileSync(path.join(ROOT, 'chat.html'), 'utf8');
assert.match(rule(chat, 'body'), /height:\s*100vh;[\s\S]*height:\s*100dvh;/,
  'Chat shell should use the dynamic viewport height on mobile browsers');
assert.match(rule(chat, '.tab-content'), /min-height:\s*0/);
assert.match(rule(chat, '.tab-content.active'), /min-height:\s*0/);
for (const selector of ['.messages-area', '.status-container', '.settings-container']) {
  assert.match(rule(chat, selector), /overflow-y:\s*auto/, `${selector} must remain scrollable`);
  assert.match(rule(chat, selector), /min-height:\s*0/, `${selector} must fit within the available viewport`);
}
assert.match(rule(chat, '.modal-overlay'), /height:\s*100dvh/);
assert.match(rule(chat, '.status-view-modal'), /height:\s*100dvh/);

const live = fs.readFileSync(path.join(ROOT, 'live.html'), 'utf8');
assert.match(rule(live, 'body'), /height:\s*100vh;\s*height:\s*100dvh;/,
  'Live player shell should use the dynamic viewport height');
assert.match(rule(live, '.offline'), /overflow-y:\s*auto/);
assert.match(rule(live, '.live-layout'), /min-height:\s*0/);
assert.ok(rules(live, '.live-layout').some(declarations => /overflow-y:\s*auto/.test(declarations)
  && /grid-template-rows:\s*auto auto/.test(declarations)),
  'The live player and chat should scroll on narrow screens instead of clipping below the fold');
assert.match(live, /height:\s*min\(42dvh,\s*360px\)/,
  'Live chat should size to the dynamic viewport while retaining a usable minimum height');

console.log(`Responsive viewport and scroll-safety checks passed for ${htmlFiles.length} HTML pages and all full-screen views.`);

// Mobile polish stays scoped away from full-screen chat/live/admin shells.
const brand = fs.readFileSync(path.join(ROOT, 'assets/pd-brand.css'), 'utf8');
const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert.match(brand, /body\.pd-bottom-nav-page\s*\{\s*padding-bottom:\s*calc\(100px \+ env\(safe-area-inset-bottom/);
assert.match(brand, /\.pd-challenge-days\s*\{[^}]*grid-auto-columns:\s*132px;[^}]*overflow-x:\s*auto/);
assert.match(brand, /\.pd-challenge-day-tip\s*\{[^}]*display:\s*block;[^}]*overflow:\s*visible/);
assert.doesNotMatch(brand, /animation:\s*(ribbonSheen|ringFloat)/);
assert.match(home, /<button type="button" class="pd-challenge-share"/);
assert.match(home, /id="challengeDays" tabindex="0" role="region"/);
assert.equal((home.match(/<footer\b/g) || []).length, 1);
assert.match(home, /<footer class="pd-footer pd-home-footer">/);
for (const name of ['index.html', 'ai-prayer.html', 'news.html', 'radio.html']) {
  const page = fs.readFileSync(path.join(ROOT, name), 'utf8');
  assert.match(page, /<body class="[^"]*pd-bottom-nav-page/);
  assert.match(page, /viewport-fit=cover/);
}
console.log('Mobile shell, daily-task readability and homepage semantics checks passed.');
