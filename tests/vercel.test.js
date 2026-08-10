'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let passed = 0;
let failed = 0;
function test(name, condition, detail = '') {
  if (condition) passed += 1;
  else failed += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
}

function invoke(modulePath, method = 'GET') {
  const handler = require(path.join(ROOT, modulePath));
  const headers = {};
  let body = '';
  const response = {
    statusCode: 200,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    writeHead(status, values = {}) {
      this.statusCode = status;
      for (const [name, value] of Object.entries(values)) this.setHeader(name, value);
    },
    status(status) { this.statusCode = status; return this; },
    send(value) { body = value || ''; return value; },
    end(value) { body = value || ''; return value; }
  };
  const request = {
    method,
    headers: { host: 'prayerdome.net', 'x-forwarded-proto': 'https' },
    query: {},
    url: '/'
  };
  return Promise.resolve(handler(request, response)).then(() => ({
    status: response.statusCode,
    headers,
    body,
    json: body ? JSON.parse(body) : null
  }));
}

(async function run() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

  test('Vercel uses the explicit static framework preset', config.framework === null);
  test('Vercel skips the unnecessary dependency install', config.installCommand === '');
  test('Vercel builds an allowlisted public bundle',
    config.buildCommand === 'node scripts/build-vercel.mjs' && config.outputDirectory === 'dist');
  test('Vercel functions have bounded execution time and traced data files',
    config.functions && config.functions['api/*.js'] &&
    config.functions['api/*.js'].maxDuration === 10 &&
    config.functions['api/*.js'].includeFiles.includes('pd-content-data.js'));
  test('automatic deployments are limited to the production branch',
    config.git && config.git.deploymentEnabled.main === true &&
    config.git.deploymentEnabled['**'] === false);

  for (const section of ['rewrites', 'redirects', 'headers']) {
    const sources = (config[section] || []).map(item => item.source);
    test(`${section} do not contain duplicate source rules`, new Set(sources).size === sources.length);
  }

  const missingDestinations = [];
  for (const rule of config.rewrites || []) {
    const destination = rule.destination.split('?')[0];
    if (destination.includes(':')) continue;
    if (destination.startsWith('/api/')) {
      if (!fs.existsSync(path.join(ROOT, `${destination.slice(1)}.js`))) missingDestinations.push(destination);
    } else if (path.extname(destination) && !fs.existsSync(path.join(ROOT, destination.slice(1)))) {
      missingDestinations.push(destination);
    }
  }
  test('every concrete Vercel rewrite target exists', missingDestinations.length === 0,
    missingDestinations.join(', '));

  const globalHeaders = (config.headers || []).find(rule => rule.source === '/(.*)');
  const headerMap = Object.fromEntries((globalHeaders && globalHeaders.headers || [])
    .map(header => [header.key.toLowerCase(), header.value]));
  test('Vercel sends the core security headers',
    ['content-security-policy', 'strict-transport-security', 'x-content-type-options',
      'x-frame-options', 'referrer-policy', 'permissions-policy']
      .every(name => headerMap[name]));
  test('content policy blocks plugins and unsafe base URLs',
    headerMap['content-security-policy'].includes("object-src 'none'") &&
    headerMap['content-security-policy'].includes("base-uri 'self'"));

  execFileSync(process.execPath, ['scripts/build-vercel.mjs'], { cwd: ROOT, stdio: 'inherit' });
  const output = path.join(ROOT, 'dist');
  const htmlPages = fs.readdirSync(ROOT).filter(name => name.endsWith('.html'));
  const missingPages = htmlPages.filter(name => !fs.existsSync(path.join(output, name)));
  test('the Vercel bundle contains every website page', missingPages.length === 0,
    missingPages.join(', '));
  test('the Vercel bundle contains PWA and SEO files',
    ['manifest.json', 'sw.js', 'firebase-messaging-sw.js', 'robots.txt', 'sitemap.xml']
      .every(name => fs.existsSync(path.join(output, name))));
  test('private repository files are not published',
    ['README.md', 'package.json', 'firebase.json', 'firestore.rules', 'tests', 'android', 'scripts']
      .every(name => !fs.existsSync(path.join(output, name))));

  const news = await invoke('api/news.js');
  test('/api/news returns a successful non-empty payload',
    news.status === 200 && news.json.success === true && news.json.count > 0 &&
    news.json.count === news.json.stories.length);
  test('/api/news sets JSON and CDN cache headers',
    news.headers['content-type'].startsWith('application/json') &&
    news.headers['cache-control'].includes('s-maxage=300'));

  const radio = await invoke('api/radio.js');
  test('/api/radio returns stations and podcasts',
    radio.status === 200 && radio.json.success === true && radio.json.radio.length > 0 &&
    radio.json.podcasts.length > 0);

  const rejected = await invoke('api/news.js', 'POST');
  test('read-only APIs reject unsupported methods',
    rejected.status === 405 && rejected.headers.allow === 'GET, HEAD');
  const head = await invoke('api/radio.js', 'HEAD');
  test('read-only APIs support bodyless HEAD probes', head.status === 200 && head.body === '');

  const health = await invoke('api/health.js');
  test('/api/health is available for deployment monitoring',
    health.status === 200 && health.json.ok === true && health.json.service === 'prayer-dome' &&
    health.headers['cache-control'] === 'no-store');

  const ignore = fs.readFileSync(path.join(ROOT, '.vercelignore'), 'utf8');
  test('.vercelignore excludes the repository by default and allows required sources',
    ignore.includes('\n/*\n') && ignore.includes('!api/') &&
    ignore.includes('!scripts/build-vercel.mjs') && ignore.includes('!functions/share.js'));
  test('.vercelignore keeps the postinstall hook that `npm install` runs on Vercel',
    ignore.includes('!scripts/install-functions.mjs'),
    'package.json "postinstall" must survive the upload filter');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}()).catch(error => {
  console.error(error);
  process.exit(1);
});
