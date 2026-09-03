'use strict';

/*
 * Prayer Dome — server-side translation relay.
 * ===========================================================================
 * The browser cannot call Google's translation endpoint directly (it sends no
 * CORS headers), so the site relays batches through this same-origin handler.
 * It proxies to Google Translate for the four languages Prayer Dome ships:
 *
 *     tum  (Tumbuka)   ssw  (siSwati, Google code "ss")
 *     bem  (Bemba)     nya  (Nyanja/Chichewa, Google code "ny")
 *
 * Google Translate added Tumbuka, siSwati and Bemba in its 2024–2026
 * expansions; Nyanja has long been covered as Chichewa. This is the *auto*
 * tier behind assets/pd-i18n.js: it only ever receives text the reviewed
 * Prayer Dome phrase pack (assets/pd-phrases.js) does not cover, and the
 * client badges every machine translation with an "auto" chip until a fluent
 * reviewer signs a better phrase-pack entry off.
 *
 * Deliberately plain Node (no firebase-functions dependency) so the exact
 * same module runs on Vercel (api/translate.js) and Firebase Cloud
 * Functions (wrapped in functions/index.js). To move to an official engine
 * later, only the translateOne() function needs to change — or point
 * PDI18n.setTranslator() at your service.
 *
 * Request  (POST /api/translate, JSON):
 *   { lang: 'tum' | 'ssw' | 'bem' | 'nya', texts: [string, ...] }
 * Response:
 *   { ok: true, results: [string|null, ...] }   (null = that item failed)
 *
 * GET ?lang=tum&text=… is accepted for manual testing only.
 */

const GOOGLE_CODES = { tum: 'tum', ssw: 'ss', bem: 'bem', nya: 'ny' };

const MAX_TEXTS = 40;        // items per request
const MAX_TEXT_LEN = 6000;   // longest single item (the client splits at 5000)
const MAX_TOTAL = 24000;     // total characters per request
const MAX_CHUNK = 950;       // Google GET URLs stay short: split long text
const CONCURRENCY = 4;       // parallel upstream calls per request
const UPSTREAM_TIMEOUT = 8000;
const CACHE_MAX = 800;       // short phrases only — see cachePut()
const CACHE_TTL = 24 * 60 * 60 * 1000;

/* Short, bounded in-memory cache. Long paragraphs are never cached here;
   the client keeps its own localStorage cache on top of this. */
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL) { cache.delete(key); return undefined; }
  return hit.value;
}
function cachePut(key, value) {
  if (key.length > 700) return; // keep memory bounded — only short phrases
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value: value, at: Date.now() });
}

/* ------------------------------------------------------------------ utils */
function allowedOrigin(origin) {
  if (!origin) return true;
  let host;
  try { host = new URL(origin).hostname; } catch (e) { return false; }
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1') return true;
  return h === 'prayerdome.net' || h.endsWith('.prayerdome.net') ||
         h.endsWith('.e2b.app') || h.endsWith('.vercel.app') ||
         h.endsWith('.web.app') || h.endsWith('.firebaseapp.com');
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
  }
  if (res.status && res.send) {
    res.status(status).send(body);
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* ------------------------------------------------------------- Google bit */
function chunkText(text, limit) {
  if (text.length <= limit) return [text];
  const pieces = [];
  let rest = text;
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    /* Cut after a sentence separator (including its trailing space) so no
       characters — especially a final space — are ever lost at a seam. */
    let cut = window.lastIndexOf('. ');
    if (cut < limit * 0.5) cut = window.lastIndexOf('! ');
    if (cut < limit * 0.5) cut = window.lastIndexOf('? ');
    if (cut < limit * 0.5) cut = window.lastIndexOf('; ');
    if (cut < limit * 0.5) cut = window.lastIndexOf('\n');
    const take = (cut < limit * 0.5) ? limit : cut + 2;
    pieces.push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  if (rest) pieces.push(rest);
  return pieces;
}

async function translateOne(text, code) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
    encodeURIComponent(code) + '&dt=t&q=' + encodeURIComponent(text);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) return null;
    const data = await resp.json();
    const rows = (data && Array.isArray(data[0])) ? data[0] : null;
    if (!rows || !rows.length) return null;
    return rows.map((r) => (r && typeof r[0] === 'string') ? r[0] : '').join('');
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function translateTexts(texts, code) {
  const results = new Array(texts.length).fill(null);
  let idx = 0;
  async function worker() {
    for (;;) {
      const i = idx;
      idx += 1;
      if (i >= texts.length) return;
      const cached = cacheGet(code + '\u001F' + texts[i]);
      if (cached !== undefined) { results[i] = cached; continue; }
      try {
        const pieces = chunkText(texts[i], MAX_CHUNK);
        const outs = [];
        for (const piece of pieces) {
          const t = await translateOne(piece, code);
          if (t === null) break;
          outs.push(t);
        }
        if (outs.length === pieces.length) {
          const joined = outs.join('');
          results[i] = joined;
          cachePut(code + '\u001F' + texts[i], joined);
        }
      } catch (e) { /* results[i] stays null */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, texts.length) }, worker));
  return results;
}

/* ------------------------------------------------------------------ main */
async function handleTranslate(req, res) {
  const origin = (req.headers && req.headers.origin) || null;
  if (!allowedOrigin(origin)) {
    send(res, 403, { ok: false, error: 'Origin not allowed' });
    return;
  }
  if (origin && res.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    if (res.status) return res.status(204).end();
    res.writeHead(204);
    return res.end();
  }

  let lang = null;
  let texts = null;

  if (method === 'POST') {
    let raw;
    try {
      raw = await readBody(req, 64 * 1024);
      const body = JSON.parse(raw || '{}');
      lang = body.lang;
      texts = body.texts;
    } catch (e) {
      return send(res, 400, { ok: false, error: 'Invalid JSON body' });
    }
  } else if (method === 'GET') {
    try {
      const url = new URL(req.url, 'http://x');
      lang = url.searchParams.get('lang');
      const text = url.searchParams.get('text') || '';
      if (text) texts = [text];
    } catch (e) { /* fall through to validation */ }
  } else {
    return send(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const code = GOOGLE_CODES[lang];
  if (!code || !Array.isArray(texts) || !texts.length || texts.length > MAX_TEXTS) {
    return send(res, 400, { ok: false, error: 'lang must be tum|ssw|bem|nya and texts a non-empty array' });
  }
  const clean = texts.map((t) => String(t == null ? '' : t));
  let total = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const t = clean[i];
    /* Whitespace is checked but preserved: the chunker relies on exact
       boundaries so a re-joined paragraph never loses a character. */
    if (!t.trim() || t.length > MAX_TEXT_LEN) {
      return send(res, 400, { ok: false, error: 'Each text must be 1–' + MAX_TEXT_LEN + ' characters' });
    }
    total += t.length;
  }
  if (total > MAX_TOTAL) {
    return send(res, 400, { ok: false, error: 'Request too large; keep total under ' + MAX_TOTAL + ' characters' });
  }

  const results = await translateTexts(clean, code);
  return send(res, 200, { ok: true, results: results });
}

module.exports = handleTranslate;
module.exports.handler = handleTranslate;
