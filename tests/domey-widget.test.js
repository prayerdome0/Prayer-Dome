/*
 * Three.ws "Domey" companion widget integration contract.
 * No dependencies:  node tests/domey-widget.test.js
 *
 * Domey's avatar, chat, voice and Bible quiz live in one saved three.ws widget
 * (wdgt_fRRTp6-HRgOh). Prayer Dome only embeds it, so these checks pin the
 * things a broken embed silently loses:
 *
 *   1. the embed — the exact widget URL, title, sandbox and feature allowlist
 *      (voice input needs `microphone`, speech needs `autoplay`),
 *   2. responsiveness — the frame scales inside the page on phones, tablets
 *      and desktops without ever causing horizontal scrolling,
 *   3. failure handling — a loading placeholder with a bounded life, a helpful
 *      error panel with retry + direct link, and offline awareness. No endless
 *      spinner, even if the loader script itself never arrives,
 *   4. secrets — the widget's AI provider is configured in Three.ws Studio, so
 *      no API key of any kind may appear in the site's code.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0, fail = 0;
function t(name, ok, extra = '') {
  if (ok) { pass += 1; console.log('PASS  ' + name); }
  else { fail += 1; console.error('FAIL  ' + name + (extra ? '  ' + extra : '')); }
}

const page = read('ai-prayer.html');
const loader = read('assets/pd-domey-widget.js');
const vercel = JSON.parse(read('vercel.json'));
const sw = read('sw.js');

/* ------------------------------------------------------------- 1. the embed */
const EMBED_SRC = 'https://three.ws/widget#widget=wdgt_fRRTp6-HRgOh&kiosk=true';
t('the AI assistant page embeds the exact Three.ws widget URL', page.includes(`src="${EMBED_SRC}"`));
t('the widget URL is used once (no duplicate avatar embeds)',
  page.split(EMBED_SRC).length === 2, String(page.split(EMBED_SRC).length - 1) + ' uses');

const iframe = page.match(/<iframe\b[^>]*wdgt_fRRTp6-HRgOh[^>]*>/);
t('the widget is embedded as an iframe', !!iframe);
if (iframe) {
  const tag = iframe[0];
  t('the embed keeps the three.ws title', tag.includes('title="Domey - PrayerDome AI Companion and Bible Quiz"'));
  t('the embed keeps the published 600×600 frame size',
    tag.includes('width="600"') && tag.includes('height="600"'));
  t('the embed sandbox allows scripts, same-origin, popups and forms',
    ['allow-scripts', 'allow-same-origin', 'allow-popups', 'allow-forms']
      .every(token => tag.includes(token)));
  const allow = (tag.match(/allow="([^"]*)"/) || [, ''])[1];
  t('the embed allows autoplay (Domey speaks), microphone (voice chat), xr and clipboard',
    ['autoplay', 'microphone', 'xr-spatial-tracking', 'clipboard-write']
      .every(token => allow.includes(token)));
  t('the embed loads lazily below the fold', tag.includes('loading="lazy"'));
}

t('the fallback page link to Domey is present', page.includes('https://three.ws/w/wdgt_fRRTp6-HRgOh'));

/* ------------------------------------------------------- 2. responsiveness */
const stageCss = (page.match(/\.domey-widget-stage\s*\{([^}]*)\}/) || [, ''])[1];
t('the widget stage fits the available width on phones (width:100%)',
  /width:\s*100%/.test(stageCss));
t('the widget stage caps at the published 600px on tablets and desktops',
  /max-width:\s*600px/.test(stageCss));
t('the widget stage is square (600×600 frame scaled down)',
  /aspect-ratio:\s*1\s*\/\s*1/.test(stageCss));
t('the widget stage cannot overflow its card', /overflow:\s*hidden/.test(stageCss));
const frameCss = (page.match(/\.domey-widget-frame\s*\{([^}]*)\}/) || [, ''])[1];
t('the iframe scales inside the stage with no fixed width left behind',
  /width:\s*100%/.test(frameCss) && /max-width:\s*100%/.test(frameCss) &&
  /height:\s*100%/.test(frameCss) && /border:\s*0/.test(frameCss));
t('the embed page has a mobile breakpoint for the widget card',
  /@media \(max-width: 600px\)[\s\S]*\.domey-widget-card/.test(page));

/* ------------------------------------------------- 3. graceful failure UX */
t('a loading placeholder announces itself to screen readers',
  page.includes('id="domeyWidgetLoading"') && page.includes('role="status"'));
t('the placeholder clears itself even without the loader script (no endless spinner)',
  page.includes('domeyLoadingFade') && /animation:\s*domeyLoadingFade[^;]*20s/.test(page));
t('a failure panel with a plain-language explanation exists',
  page.includes('id="domeyWidgetError"') && page.includes('id="domeyWidgetErrorText"'));
t('the failure panel offers Try again', page.includes('id="domeyWidgetRetry"'));
t('the failure panel offers opening Domey in a new tab',
  /domeyWidgetError[\s\S]*?target="_blank"[^>]*href="https:\/\/three\.ws\/w\/wdgt_fRRTp6-HRgOh"|domeyWidgetError[\s\S]*?href="https:\/\/three\.ws\/w\/wdgt_fRRTp6-HRgOh"[^>]*target="_blank"/.test(page) ||
  /Open Domey in a new tab/.test(page));

t('the loader publishes PDDomeyWidget for the retry control', /window\.PDDomeyWidget\s*=/.test(loader));
t('the loader retries by reinstalling the frame', /function retry\(/.test(loader) && /cloneNode/.test(loader));
t('the loader never leaves the spinner running past its watchdog',
  /LOAD_TIMEOUT_MS/.test(loader) && /settleFailed\(/.test(loader));
t('the loader reports the offline case in words',
  /navigator\.onLine/.test(loader) && /addEventListener\('offline'/.test(loader));
t('the loader probes reachability so network failures are not blank frames',
  /fetch\(WIDGET_PAGE/.test(loader) && /no-cors/.test(loader));
t('the loader only starts the watchdog when the lazy frame is near the viewport',
  /IntersectionObserver/.test(loader));
t('the loader keeps the exact embed URL', loader.includes(EMBED_SRC));

/* The wiring must actually load on the page. */
t('the AI assistant page loads the widget loader',
  /<script[^>]+src="\/assets\/pd-domey-widget\.js"/.test(page));

/* ------------------------------------------- headers: voice in the iframe */
const globalHeaders = (vercel.headers || []).find(rule => rule.source === '/(.*)');
const headerMap = Object.fromEntries((globalHeaders && globalHeaders.headers || [])
  .map(header => [header.key.toLowerCase(), header.value]));
t('Permissions-Policy delegates the microphone to the widget origin for voice chat',
  /microphone=\(self "https:\/\/three\.ws"\)/.test(headerMap['permissions-policy'] || ''));
t('Content-Security-Policy still allows three.ws to be framed',
  /frame-src[^;]*https:/.test(headerMap['content-security-policy'] || ''));

/* ------------------------------------------------- offline shell caching */
t('the service worker precaches the widget loader',
  sw.includes("'/assets/pd-domey-widget.js'"));
t('the cache version was bumped for the new precache entry',
  /const CACHE_NAME = 'prayer-dome-v(\d+)';/.test(sw) &&
  Number((sw.match(/prayer-dome-v(\d+)/) || [, 0])[1]) >= 31);

/* ------------------------------------------------------------- 4. secrets */
const secretPattern = /(GROQ_API_KEY|groq_api_key|gsk_[A-Za-z0-9]{8,}|sk-[A-Za-z0-9]{16,}|api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{12,})/;
t('the embed and loader carry no AI provider key (providers live in Three.ws Studio)',
  !secretPattern.test(page) && !secretPattern.test(loader));
t('the widget loader never calls an AI endpoint of its own',
  !/\/api\/(chat|ai|groq|completion)/i.test(loader));
t('no environment key name leaks into the widget loader',
  !/process\.env/.test(loader) && !/GROQ/i.test(loader));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
