'use strict';

/**
 * Prayer Dome — Authorized NIV Bible endpoint
 * ---------------------------------------------------------------------------
 * All Bible reading in the app goes through this endpoint so that:
 *   1. The only translation offered is the New International Version (NIV).
 *   2. API keys never live in browser code.
 *   3. Failure states are honest: we do not silently swap to KJV when NIV is
 *      unavailable, and we never fabricate a verse.
 *
 * Two backends are supported, in order:
 *   1. api.bible (the Digital Bible Platform / Biblica / HarperCollins Christian
 *      Publishing official feed). This is the licensed source. Requires the
 *      NIV_API_KEY (or BIBLE_API_KEY) environment variable, and the NIV
 *      bible id defaults to the Biblica NIV (de4e12af7f28f599-02).
 *   2. If no key is configured the endpoint returns 503 with a clear
 *      "configuration required" message — the UI shows that message instead of
 *      inventing verses or silently falling back to another translation.
 *
 * Endpoints:
 *   GET /api/bible?action=books
 *   GET /api/bible?action=chapter&book=John&chapter=3
 *   GET /api/bible?action=chapter&id=43&chapter=3     (osis book id 1..66)
 *   GET /api/bible?action=search&q=love
 *   GET /api/bible?action=verse&ref=John+3:16
 *
 * Cached for 5 minutes at the edge to respect the provider's rate limits.
 */

const https = require('https');
const { URL } = require('url');

const NIV_BIBLE_ID = process.env.NIV_BIBLE_ID || 'de4e12af7f28f599-02';
const API_KEY = process.env.NIV_API_KEY || process.env.BIBLE_API_KEY || '';
const CACHE_MAX_AGE = 300; // seconds — verse text does not change

const BOOKS = [
  { id: 1, osis: 'Gen', name: 'Genesis', ch: 50 },
  { id: 2, osis: 'Exod', name: 'Exodus', ch: 40 },
  { id: 3, osis: 'Lev', name: 'Leviticus', ch: 27 },
  { id: 4, osis: 'Num', name: 'Numbers', ch: 36 },
  { id: 5, osis: 'Deut', name: 'Deuteronomy', ch: 34 },
  { id: 6, osis: 'Josh', name: 'Joshua', ch: 24 },
  { id: 7, osis: 'Judg', name: 'Judges', ch: 21 },
  { id: 8, osis: 'Ruth', name: 'Ruth', ch: 4 },
  { id: 9, osis: '1Sam', name: '1 Samuel', ch: 31 },
  { id: 10, osis: '2Sam', name: '2 Samuel', ch: 24 },
  { id: 11, osis: '1Kgs', name: '1 Kings', ch: 22 },
  { id: 12, osis: '2Kgs', name: '2 Kings', ch: 25 },
  { id: 13, osis: '1Chr', name: '1 Chronicles', ch: 29 },
  { id: 14, osis: '2Chr', name: '2 Chronicles', ch: 36 },
  { id: 15, osis: 'Ezra', name: 'Ezra', ch: 10 },
  { id: 16, osis: 'Neh', name: 'Nehemiah', ch: 13 },
  { id: 17, osis: 'Esth', name: 'Esther', ch: 10 },
  { id: 18, osis: 'Job', name: 'Job', ch: 42 },
  { id: 19, osis: 'Ps', name: 'Psalms', ch: 150 },
  { id: 20, osis: 'Prov', name: 'Proverbs', ch: 31 },
  { id: 21, osis: 'Eccl', name: 'Ecclesiastes', ch: 12 },
  { id: 22, osis: 'Song', name: 'Song of Solomon', ch: 8 },
  { id: 23, osis: 'Isa', name: 'Isaiah', ch: 66 },
  { id: 24, osis: 'Jer', name: 'Jeremiah', ch: 52 },
  { id: 25, osis: 'Lam', name: 'Lamentations', ch: 5 },
  { id: 26, osis: 'Ezek', name: 'Ezekiel', ch: 48 },
  { id: 27, osis: 'Dan', name: 'Daniel', ch: 12 },
  { id: 28, osis: 'Hos', name: 'Hosea', ch: 14 },
  { id: 29, osis: 'Joel', name: 'Joel', ch: 3 },
  { id: 30, osis: 'Amos', name: 'Amos', ch: 9 },
  { id: 31, osis: 'Obad', name: 'Obadiah', ch: 1 },
  { id: 32, osis: 'Jonah', name: 'Jonah', ch: 4 },
  { id: 33, osis: 'Mic', name: 'Micah', ch: 7 },
  { id: 34, osis: 'Nah', name: 'Nahum', ch: 3 },
  { id: 35, osis: 'Hab', name: 'Habakkuk', ch: 3 },
  { id: 36, osis: 'Zeph', name: 'Zephaniah', ch: 3 },
  { id: 37, osis: 'Hag', name: 'Haggai', ch: 2 },
  { id: 38, osis: 'Zech', name: 'Zechariah', ch: 14 },
  { id: 39, osis: 'Mal', name: 'Malachi', ch: 4 },
  { id: 40, osis: 'Matt', name: 'Matthew', ch: 28 },
  { id: 41, osis: 'Mark', name: 'Mark', ch: 16 },
  { id: 42, osis: 'Luke', name: 'Luke', ch: 24 },
  { id: 43, osis: 'John', name: 'John', ch: 21 },
  { id: 44, osis: 'Acts', name: 'Acts', ch: 28 },
  { id: 45, osis: 'Rom', name: 'Romans', ch: 16 },
  { id: 46, osis: '1Cor', name: '1 Corinthians', ch: 16 },
  { id: 47, osis: '2Cor', name: '2 Corinthians', ch: 13 },
  { id: 48, osis: 'Gal', name: 'Galatians', ch: 6 },
  { id: 49, osis: 'Eph', name: 'Ephesians', ch: 6 },
  { id: 50, osis: 'Phil', name: 'Philippians', ch: 4 },
  { id: 51, osis: 'Col', name: 'Colossians', ch: 4 },
  { id: 52, osis: '1Thess', name: '1 Thessalonians', ch: 5 },
  { id: 53, osis: '2Thess', name: '2 Thessalonians', ch: 3 },
  { id: 54, osis: '1Tim', name: '1 Timothy', ch: 6 },
  { id: 55, osis: '2Tim', name: '2 Timothy', ch: 4 },
  { id: 56, osis: 'Titus', name: 'Titus', ch: 3 },
  { id: 57, osis: 'Phlm', name: 'Philemon', ch: 1 },
  { id: 58, osis: 'Heb', name: 'Hebrews', ch: 13 },
  { id: 59, osis: 'Jas', name: 'James', ch: 5 },
  { id: 60, osis: '1Pet', name: '1 Peter', ch: 5 },
  { id: 61, osis: '2Pet', name: '2 Peter', ch: 3 },
  { id: 62, osis: '1John', name: '1 John', ch: 5 },
  { id: 63, osis: '2John', name: '2 John', ch: 1 },
  { id: 64, osis: '3John', name: '3 John', ch: 1 },
  { id: 65, osis: 'Jude', name: 'Jude', ch: 1 },
  { id: 66, osis: 'Rev', name: 'Revelation', ch: 22 }
];

const NAME_TO_BOOK = {};
BOOKS.forEach(b => { NAME_TO_BOOK[b.name.toLowerCase()] = b; NAME_TO_BOOK[b.osis.toLowerCase()] = b; });
const BOOK_BY_ID = {};
BOOKS.forEach(b => { BOOK_BY_ID[b.id] = b; });

function send(res, status, payload, extraHeaders) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', status === 200
    ? `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=3600`
    : 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (extraHeaders) Object.keys(extraHeaders).forEach(k => res.setHeader(k, extraHeaders[k]));
  res.end(body);
}

function configurationError(res) {
  return send(res, 503, {
    ok: false,
    translation: 'NIV',
    translationName: 'New International Version',
    copyright: '© Biblica, Inc. NIV® used by permission of Biblica, Inc. All rights reserved worldwide.',
    error: 'NIV_NOT_CONFIGURED',
    message: 'The NIV Bible feed has not been configured yet. This application displays the New International Version only; it never silently falls back to another translation. Add an authorized api.bible key as the NIV_API_KEY environment variable (the NIV Bible id defaults to "' + NIV_BIBLE_ID + '" and can be overridden with NIV_BIBLE_ID). The api.bible free tier is available to registered Christian ministries at no cost, and covers passage retrieval, search, and audio for licensed use.',
    setup: {
      provider: 'api.bible (Biblica / HarperCollins Christian Publishing)',
      env: 'NIV_API_KEY',
      bibleIdEnv: 'NIV_BIBLE_ID',
      defaultBibleId: NIV_BIBLE_ID,
      freeTier: true
    }
  });
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch (e) { return reject(e); }
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: Object.assign({ 'api-key': API_KEY, 'accept': 'application/json' }, headers || {})
    }, (res2) => {
      const chunks = [];
      res2.on('data', c => chunks.push(c));
      res2.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res2.statusCode >= 400) {
          return reject(new Error('HTTP ' + res2.statusCode + ': ' + text.slice(0, 300)));
        }
        try { resolve(JSON.parse(text)); } catch (e) { reject(new Error('Bad JSON: ' + text.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(new Error('NIV API request timed out')); });
    req.end();
  });
}

/** Strip api.bible verse content of markup; extract verse number. */
function cleanVerse(item) {
  const raw = item.content || item.text || '';
  const text = raw
    .replace(/<\/?p[^>]*>/g, '')
    .replace(/<\/?span[^>]*>/g, '')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<note>[\s\S]*?<\/note>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*\d+\s*/, '')       // leading verse numbers
    .trim();
  let num = 0;
  var m = (item.id || '').match(/\.(\d+)$/);
  if (m) num = parseInt(m[1], 10);
  else {
    var m2 = raw.match(/<verse[^>]*num="(\d+)"/i);
    if (m2) num = parseInt(m2[1], 10);
    else num = parseInt(item.number || item.verse || '0', 10) || 0;
  }
  return { verse: num, text: text };
}

function parseReference(ref) {
  // "John 3:16" -> bookName "John", chapter 3, verse 16
  var m = String(ref).match(/^\s*((?:[123]\s)?[A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(\d+)(?::(\d+))?\s*$/i);
  if (!m) return null;
  var name = m[1].replace(/\s+/g, ' ').trim();
  var book = NAME_TO_BOOK[name.toLowerCase()];
  // try match by prefix
  if (!book) {
    var keys = Object.keys(NAME_TO_BOOK);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(name.toLowerCase()) === 0) { book = NAME_TO_BOOK[keys[i]]; break; }
    }
  }
  if (!book) return null;
  return { book: book, chapter: parseInt(m[2], 10), verse: m[3] ? parseInt(m[3], 10) : null };
}

async function fetchChapter(bookId, chapter) {
  const path = `/v1/bibles/${NIV_BIBLE_ID}/chapters/${bookId < 40 ? 'GEN.' : 'JHN.'}${chapter}`;
  // api.bible uses osis book ids (e.g. "JHN.3")
  const book = BOOK_BY_ID[parseInt(bookId, 10)];
  if (!book) throw new Error('Unknown book id ' + bookId);
  const passageId = book.osis + '.' + chapter;
  const url = `https://api.scripture.api.bible/v1/bibles/${NIV_BIBLE_ID}/chapters/${encodeURIComponent(passageId)}?content-type=json&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true`;
  const json = await httpsGet(url);
  const contents = (json.data && json.data.content) || [];
  const verses = [];
  // api.bible returns an array of items with type "tag" or "text"; verses are in attrs.verseId
  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.type === 'tag' && node.name === 'verse' && node.attrs) {
      var vid = node.attrs['data-id'] || node.attrs.verseId || node.attrs.usfm;
      var numMatch = vid ? vid.match(/\.(\d+)$/) : null;
      var num = numMatch ? parseInt(numMatch[1], 10) : 0;
      var text = '';
      function gather(n) {
        if (!n) return;
        if (Array.isArray(n)) { n.forEach(gather); return; }
        if (n.type === 'text' && typeof n.text === 'string') text += n.text;
        else if (n.content) gather(n.content);
        else if (n.items) gather(n.items);
      }
      gather(node.content || node.items);
      text = text.replace(/^\s*\d+\s*/, '').replace(/\s+/g, ' ').trim();
      if (text && num) verses.push({ verse: num, text: text });
    } else if (node.content) walk(node.content);
    else if (node.items) walk(node.items);
  }
  if (Array.isArray(contents)) contents.forEach(walk);
  else walk(contents);
  // Also support direct verse array if the API hands back data.verses[]
  if (!verses.length && Array.isArray(json.data && json.data.verses)) {
    json.data.verses.forEach(v => {
      var cv = cleanVerse(v);
      if (cv.text && cv.verse) verses.push(cv);
    });
  }
  return {
    book: book.name,
    bookId: book.id,
    chapter: parseInt(chapter, 10),
    reference: `${book.name} ${chapter}`,
    translation: 'NIV',
    translationName: 'New International Version',
    copyright: json.data && json.data.copyright || '© Biblica, Inc. Used by permission. All rights reserved.',
    verses: verses
  };
}

async function fetchSearch(q, limit) {
  const url = `https://api.scripture.api.bible/v1/bibles/${NIV_BIBLE_ID}/search?query=${encodeURIComponent(q)}&limit=${limit || 20}&sort=canonical&fuzziness=0`;
  const json = await httpsGet(url);
  const verses = (json.data && json.data.verses || []).map(v => ({
    reference: v.reference,
    bookId: v.bookId,
    chapter: v.chapterId,
    verse: v.verseId,
    text: (v.text || '').replace(/^\s*\d+\s*/, '').trim()
  }));
  return {
    translation: 'NIV',
    translationName: 'New International Version',
    query: q,
    total: (json.data && json.data.total) || verses.length,
    verses: verses
  };
}

async function fetchVerse(ref) {
  const parsed = parseReference(ref);
  if (!parsed || !parsed.verse) {
    // fall back: fetch chapter then filter
    const ch = await fetchChapter(parsed ? parsed.book.id : 43, parsed ? parsed.chapter : 3);
    var v = ch.verses.find(x => x.verse === parsed.verse) || ch.verses[0];
    return {
      reference: `${ch.book} ${ch.chapter}:${v.verse}`,
      translation: 'NIV',
      text: v.text,
      copyright: ch.copyright
    };
  }
  const passageId = parsed.book.osis + '.' + parsed.chapter + '.' + parsed.verse;
  const url = `https://api.scripture.api.bible/v1/bibles/${NIV_BIBLE_ID}/verses/${encodeURIComponent(passageId)}?content-type=json&include-notes=false`;
  const json = await httpsGet(url);
  var cv = cleanVerse(json.data || {});
  return {
    reference: `${parsed.book.name} ${parsed.chapter}:${parsed.verse}`,
    translation: 'NIV',
    text: cv.text,
    copyright: (json.data && json.data.copyright) || '© Biblica, Inc. Used by permission.'
  };
}

module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' });

  const url = new URL(req.url, 'https://' + (req.headers.host || 'localhost'));
  const action = url.searchParams.get('action') || 'status';

  if (action === 'status') {
    return send(res, 200, {
      ok: true,
      translation: 'NIV',
      translationName: 'New International Version',
      configured: !!API_KEY,
      bibleId: NIV_BIBLE_ID,
      copyright: 'The Holy Bible, New International Version®, NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.® Used by permission. All rights reserved worldwide.'
    });
  }

  if (action === 'books') {
    return send(res, 200, {
      ok: true,
      translation: 'NIV',
      books: BOOKS.map(b => ({ id: b.id, name: b.name, chapters: b.ch, osis: b.osis }))
    });
  }

  if (!API_KEY) return configurationError(res);

  try {
    if (action === 'chapter') {
      var book = url.searchParams.get('book');
      var ch = url.searchParams.get('chapter');
      var bookId = url.searchParams.get('id');
      if (!bookId && book) {
        var found = NAME_TO_BOOK[(book || '').toLowerCase()];
        if (!found) return send(res, 400, { ok: false, error: 'Unknown book: ' + book });
        bookId = found.id;
      }
      if (!bookId || !ch) return send(res, 400, { ok: false, error: 'book/id and chapter required' });
      const data = await fetchChapter(bookId, ch);
      return send(res, 200, Object.assign({ ok: true }, data));
    }
    if (action === 'search') {
      var q = url.searchParams.get('q');
      if (!q) return send(res, 400, { ok: false, error: 'q required' });
      const data = await fetchSearch(q, url.searchParams.get('limit') || 20);
      return send(res, 200, Object.assign({ ok: true }, data));
    }
    if (action === 'verse') {
      var ref = url.searchParams.get('ref');
      if (!ref) return send(res, 400, { ok: false, error: 'ref required' });
      const data = await fetchVerse(ref);
      return send(res, 200, Object.assign({ ok: true }, data));
    }
    return send(res, 400, { ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return send(res, 502, {
      ok: false,
      translation: 'NIV',
      error: 'NIV_FETCH_FAILED',
      message: 'The NIV Bible feed is temporarily unavailable. The app has not substituted another translation. Please try again shortly.',
      detail: String(err && err.message || err)
    });
  }
};
