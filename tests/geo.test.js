/*
 * Tests for the shared IP-geolocation layer (assets/pd-app.js -> PDApp.geo)
 * and the location fallback card.
 * Requires jsdom:  node tests/geo.test.js
 */
const { JSDOM } = require('jsdom');
const { readFileSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');
const APP = readFileSync(join(ROOT, 'assets', 'pd-app.js'), 'utf8');

let pass = 0, fail = 0;
function t(name, ok, extra) {
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  ' + extra : ''));
}

const IPWHO_JSON = {
  success: true, ip: '41.216.0.0', type: 'IPv4', continent: 'Africa',
  continent_code: 'AF', country: 'Zambia', country_code: 'ZM',
  region: 'Eastern Province', region_code: '03', city: 'Chipata',
  latitude: -13.6333, longitude: 32.65, postal: '10101',
  timezone: { id: 'Africa/Lusaka', abbr: 'CAT', is_dst: false, offset: 7200, utc: '+02:00', current_time: '2026-08-10T14:32:00+02:00' },
  flag: { img: 'https://cdn.ipwho.is/flags/zm.svg', emoji: '🇿🇲', emoji_unicode: 'U+1F1FF U+1F1F2' },
  connection: { asn: 37171, org: 'ZAMTEL', isp: 'ZAMTEL', domain: 'zamtel.zm' },
  currency: { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK' }
};

const IPAPI_JSON = {
  ip: '41.216.0.0', city: 'Chipata', region: 'Eastern Province',
  region_code: '03', country: 'ZM', country_name: 'Zambia',
  country_code: 'ZM', latitude: -13.6333, longitude: 32.65,
  timezone: 'Africa/Lusaka', utc_offset: '+02:00', isp: 'ZAMTEL', org: 'ZAMTEL'
};

function makeWindow(fetchImpl, urls) {
  const dom = new JSDOM('<!doctype html><html><body><div id="pdLocationCard"><div id="pdLocationName"></div><div id="pdLocationSub"></div></div></body></html>', {
    url: 'https://prayerdome.net/',
    runScripts: 'outside-only'
  });
  const w = dom.window;
  w.fetch = function (url) {
    if (urls[String(url)] !== undefined) return Promise.resolve({ ok: true, json: () => Promise.resolve(urls[String(url)]) });
    return fetchImpl ? fetchImpl(String(url)) : Promise.reject(new Error('unexpected fetch ' + url));
  };
  w.eval(APP);
  return w;
}

(async () => {
  /* ---------- 1. ipwho.is primary lookup (rich data) ---------- */
  let fetchCalls = 0;
  const w1 = makeWindow(null, {
    'https://ipwho.is/': IPWHO_JSON,
    'https://ipapi.co/json/': IPAPI_JSON
  });
  w1.fetch = function (url) {
    fetchCalls++;
    const hit = { 'https://ipwho.is/': IPWHO_JSON, 'https://ipapi.co/json/': IPAPI_JSON }[String(url)];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(hit) });
  };
  const info1 = await w1.PDApp.geo.lookupIP();
  t('geo.lookupIP resolves from ipwho.is', !!info1 && info1.source === 'ipwho.is');
  t('timezone id extracted from nested object', info1 && info1.timezone === 'Africa/Lusaka');
  t('flag emoji extracted', info1 && info1.flag === '🇿🇲');
  t('region included', info1 && info1.region === 'Eastern Province');
  t('city + country included', info1 && info1.city === 'Chipata' && info1.country === 'Zambia');
  t('coordinates parsed', info1 && info1.lat === -13.6333 && info1.lon === 32.65);
  t('ISP extracted from connection', info1 && info1.isp === 'ZAMTEL');
  t('local time computed for tz', !!info1 && /^\d{2}:\d{2}$/.test(info1.localTime), JSON.stringify(info1 && info1.localTime));
  t('result cached in localStorage', !!w1.localStorage.getItem('pd_ip_geo'));
  const cached = JSON.parse(w1.localStorage.getItem('pd_ip_geo'));
  t('cache has timestamp + data', !!cached && typeof cached.ts === 'number' && cached.data.timezone === 'Africa/Lusaka');

  // Second lookup must come from cache (no extra fetch).
  const before = fetchCalls;
  const info1b = await w1.PDApp.geo.lookupIP();
  t('second lookup served from cache', fetchCalls === before && info1b.timezone === 'Africa/Lusaka');

  /* ---------- 2. fallback to ipapi.co when ipwho.is fails ---------- */
  const w2 = makeWindow(null, {
    'https://ipapi.co/json/': IPAPI_JSON
  });
  // ipwho.is rejects (network error) — chain must continue to ipapi.co
  w2.fetch = function (url) {
    if (String(url).includes('ipwho')) return Promise.reject(new Error('network down'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve(IPAPI_JSON) });
  };
  const info2 = await w2.PDApp.geo.lookupIP();
  t('falls back to ipapi.co when ipwho.is fails', !!info2 && info2.source === 'ipapi.co' && info2.timezone === 'Africa/Lusaka');
  t('flag derived from country_code on fallback', info2 && info2.flag === '🇿🇲');
  t('ipapi region/city/country mapped', info2 && info2.city === 'Chipata' && info2.region === 'Eastern Province' && info2.country === 'Zambia');
  t('ipapi ISP mapped', info2 && info2.isp === 'ZAMTEL');

  /* ---------- 3. both APIs down -> null (caller handles) ---------- */
  const w3 = makeWindow(null, {});
  w3.fetch = function () { return Promise.reject(new Error('offline')); };
  const info3 = await w3.PDApp.geo.lookupIP();
  t('lookupIP resolves null when both APIs fail', info3 === null);

  /* ---------- 4. bad payloads are rejected ---------- */
  t('normalize rejects success:false', w3.PDApp.geo.normalize({ success: false, message: 'invalid' }, 'ipwho.is') === null);
  t('normalize rejects missing timezone', w3.PDApp.geo.normalize({ city: 'X' }, 'ipwho.is') === null);

  /* ---------- 5. location.ipFallback renders rich info ---------- */
  const w4 = makeWindow(null, { 'https://ipwho.is/': IPWHO_JSON, 'https://ipapi.co/json/': IPAPI_JSON });
  const result = await new Promise(resolve => w4.PDApp.location.ipFallback(resolve));
  t('ipFallback name includes flag + city + region + country',
    result.name === '🇿🇲 Chipata, Eastern Province, Zambia', JSON.stringify(result.name));
  t('ipFallback coords include lat/lon + time + ISP',
    /-13\.63°/.test(result.coords) && /\d{2}:\d{2}/.test(result.coords) && result.coords.includes('ZAMTEL'), JSON.stringify(result.coords));
  t('ipFallback exposes lat/lng', result.lat === -13.6333 && result.lng === 32.65);

  /* ---------- 6. ipFallback offline graceful ---------- */
  const w5 = makeWindow(null, {});
  w5.fetch = function () { return Promise.reject(new Error('offline')); };
  const offline = await new Promise(resolve => w5.PDApp.location.ipFallback(resolve));
  t('ipFallback falls back to Global Network offline', offline.name === 'Global Network');

  /* ---------- 7. flagEmoji helper ---------- */
  t('flagEmoji builds regional-indicator flags', w5.PDApp.geo.flagEmoji('zm') === '🇿🇲' && w5.PDApp.geo.flagEmoji('IE') === '🇮🇪');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
