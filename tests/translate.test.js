'use strict';

/*
 * Relay tests for functions/translate.js (served as /api/translate on both
 * Vercel and Firebase). The browser's auto tier (pd-i18n.js) posts batches
 * here because Google's endpoint sends no CORS headers. Google is stubbed
 * with a fake global fetch so the suite runs fully offline.
 */

const { PassThrough } = require('stream');
const path = require('path');

const handler = require(path.join(__dirname, '..', 'functions', 'translate.js'));

let passed = 0;
let failed = 0;
function t(name, condition, detail = '') {
  if (condition) passed += 1;
  else failed += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
}

let fetchCalls = [];

/* Fake Google Translate: every chunk is translated to "M" + itself. */
function stubFetch() {
  global.fetch = async (url) => {
    fetchCalls.push(url);
    const u = new URL(url);
    const q = u.searchParams.get('q') || '';
    return {
      ok: true,
      json: async () => [[[`M${q}`, q, null, null, 1]]]
    };
  };
}

function mockRes() {
  return {
    headers: {},
    statusCode: 200,
    body: '',
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(code, h) { this.statusCode = code; if (h) Object.assign(this.headers, h); },
    end(body) { this.body = body || ''; },
    status(code) { if (code !== undefined) this.statusCode = code; return this; },
    send(body) { this.body = body || ''; }
  };
}

function mockReq(method, payload, origin) {
  const req = new PassThrough();
  req.method = method;
  req.url = '/api/translate';
  req.headers = { origin: origin || undefined };
  if (payload !== '') {
    req.write(typeof payload === 'string' ? payload : JSON.stringify(payload));
  }
  req.end();
  return req;
}

function post(body, origin, res) {
  return handler(mockReq('POST', body, origin), res || mockRes());
}
function get(query, origin, res) {
  const req = new PassThrough();
  req.method = 'GET';
  req.url = '/api/translate?' + query;
  req.headers = { origin: origin || undefined };
  req.end();
  return handler(req, res || mockRes());
}

async function main() {
  /* ---- basic happy paths ------------------------------------------------- */
  {
    fetchCalls = [];
    stubFetch();
    const res = mockRes();
    const req = mockReq('POST', { lang: 'tum', texts: ['hello world', 'good morning'] });
    await handler(req, res);

    const json = JSON.parse(res.body);
    t('POST batch returns ok with aligned results', json.ok && json.results.length === 2);
    t('each text was relayed to Google with the right language code',
      fetchCalls.length === 2 &&
      fetchCalls.every(u => u.includes('client=gtx') && u.includes('sl=auto') && u.includes('tl=tum')));
    t('Google output is returned to the client', json.results[0] === 'Mhello world');
    t('relay marks responses uncacheable', (res.headers['Cache-Control'] || '').includes('no-store'));
  }

  {
    fetchCalls = [];
    stubFetch();
    const res = mockRes();
    await get('lang=ssw&text=hello', 'https://prayerdome.net', res);
    const json = JSON.parse(res.body);
    t('GET fallback works and maps siSwati to Google code ss',
      json.ok && json.results[0] === 'Mhello' &&
      fetchCalls[0].includes('tl=ss') && fetchCalls[0].includes('q=hello'),
      fetchCalls[0]);
    t('known origin receives CORS headers back',
      res.headers['Access-Control-Allow-Origin'] === 'https://prayerdome.net');
  }

  /* ---- validation -------------------------------------------------------- */
  {
    const res = mockRes();
    await post({ lang: 'xh', texts: ['hello'] }, null, res);
    t('unsupported languages are rejected', res.statusCode === 400);

    const res2 = mockRes();
    await post({ lang: 'nya', texts: [] }, null, res2);
    t('empty text arrays are rejected', res2.statusCode === 400);

    const res3 = mockRes();
    await post({ lang: 'bem', texts: [''] }, null, res3);
    t('blank texts are rejected', res3.statusCode === 400);

    const res4 = mockRes();
    await post({ lang: 'bem', texts: ['ok'] }, 'https://evil.example', res4);
    t('foreign origins are refused', res4.statusCode === 403);
  }

  /* ---- preflight & long text -------------------------------------------- */
  {
    const res = mockRes();
    const req = mockReq('OPTIONS', '', 'https://prayerdome.net');
    await handler(req, res);
    t('OPTIONS preflight is answered', res.statusCode === 204 &&
      res.headers['Access-Control-Allow-Origin'] === 'https://prayerdome.net');
  }

  {
    fetchCalls = [];
    stubFetch();
    const long = 'Each of these sentences is long enough to force a split. '.repeat(30); // ~ 1450 chars
    const res = mockRes();
    await post({ lang: 'nya', texts: [long] }, null, res);
    const json = JSON.parse(res.body);
    t('long paragraphs are split into several upstream calls and re-joined',
      fetchCalls.length >= 2 && json.results[0].replace(/M/g, '') === long,
      `${fetchCalls.length} upstream call(s)`);
  }

  /* ---- upstream failure -------------------------------------------------- */
  {
    global.fetch = async () => ({ ok: false, json: async () => ({}) });
    const res = mockRes();
    await post({ lang: 'tum', texts: ['hello'] }, null, res);
    const json = JSON.parse(res.body);
    t('an upstream failure surfaces as a null result, not a crash',
      json.ok === true && json.results[0] === null);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
