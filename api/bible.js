'use strict';

/**
 * Prayer Dome — version-aware Bible endpoint
 * ---------------------------------------------------------------------------
 * The reader offers NIV, KJV, NLT, ESV and MSG. Every provider request is
 * pinned to the requested edition, every response is checked against the
 * edition and passage it claims to be, and a provider response is never
 * relabelled as another translation.
 *
 * Providers (in order of preference, per edition):
 *   - NIV: no API. NIV is a copyrighted Biblica text and Prayer Dome holds no
 *     licence that covers this site, so the reader lists NIV but shows no NIV
 *     text, and makes no request to any provider for it. Bolls.life flags its
 *     NIV texts as ablated (removed) and is never used for NIV either.
 *   - KJV: GetBible v2 (kjv, public domain), then Bolls.life KJV with Strong's
 *     numbers removed.
 *   - NLT, MSG: api.bible when NLT_BIBLE_ID / MSG_BIBLE_ID and the API key are
 *     configured, otherwise Bolls.life's version-specific feeds.
 *   - ESV: Bolls.life's version-specific feed. Rights for that feed are not
 *     verified; see docs/BIBLE-LICENSING.md.
 *
 * Endpoints:
 *   GET /api/bible?action=status&version=NIV
 *   GET /api/bible?action=books
 *   GET /api/bible?action=chapter&id=43&chapter=3&version=KJV
 *   GET /api/bible?action=search&q=love&version=NIV
 *   GET /api/bible?action=verse&ref=John+3:16&version=NIV
 *
 * Secrets: API keys are read from the environment only. They are sent to the
 * provider in a request header and are never included in responses, logs or
 * error messages.
 */

const https = require('https');
const { URL } = require('url');

const API_BIBLE_BASE = 'https://rest.api.bible/v1';
const NIV_UNAVAILABLE_MESSAGE = 'NIV text is not shown. It is licensed by Biblica, and Prayer Dome does not hold a licence that covers this site. No other translation is shown in its place.';
const CACHE_MAX_AGE = 300;
const REQUEST_TIMEOUT_MS = 3500;

const TRANSLATIONS = {
  NIV: {
    name: 'New International Version',
    getBibleCode: null,
    bolls: null,
    // The text must come back from api.bible under this copyright line.
    copyrightMatch: /New International Version|NIV/,
    copyright: 'The Holy Bible, New International Version®, NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.® Used by permission. All rights reserved worldwide.'
  },
  KJV: {
    name: 'King James Version',
    getBibleCode: 'kjv',
    bolls: 'KJV',
    strongs: true,
    copyrightMatch: /King James/i,
    copyright: 'King James Version (KJV). Public domain in the United States.'
  },
  NLT: {
    name: 'New Living Translation',
    getBibleCode: null,
    bolls: 'NLT',
    apiBibleEnv: 'NLT_BIBLE_ID',
    copyrightMatch: /New Living Translation/,
    copyright: 'Holy Bible, New Living Translation®, copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Inc. All rights reserved.'
  },
  ESV: {
    name: 'English Standard Version',
    getBibleCode: null,
    bolls: 'ESV',
    copyrightMatch: /English Standard Version|ESV/,
    copyright: 'The Holy Bible, English Standard Version® (ESV®), copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.'
  },
  MSG: {
    name: 'The Message',
    getBibleCode: null,
    bolls: 'MSG',
    apiBibleEnv: 'MSG_BIBLE_ID',
    copyrightMatch: /The Message/,
    copyright: 'The Message® copyright © 1993, 2002, 2018 by Eugene H. Peterson. Used by permission of NavPress. All rights reserved.'
  }
};

// GetBible v2 publishes KJV only among these editions. Do not infer others.
const GETBIBLE_EXACT_EDITIONS = new Set(['KJV']);

// USFM book codes used by api.bible chapter and verse IDs.
const USFM = {
  1: 'GEN', 2: 'EXO', 3: 'LEV', 4: 'NUM', 5: 'DEU', 6: 'JOS', 7: 'JDG', 8: 'RUT',
  9: '1SA', 10: '2SA', 11: '1KI', 12: '2KI', 13: '1CH', 14: '2CH', 15: 'EZR', 16: 'NEH',
  17: 'EST', 18: 'JOB', 19: 'PSA', 20: 'PRO', 21: 'ECC', 22: 'SNG', 23: 'ISA', 24: 'JER',
  25: 'LAM', 26: 'EZK', 27: 'DAN', 28: 'HOS', 29: 'JOL', 30: 'AMO', 31: 'OBA', 32: 'JON',
  33: 'MIC', 34: 'NAM', 35: 'HAB', 36: 'ZEP', 37: 'HAG', 38: 'ZEC', 39: 'MAL', 40: 'MAT',
  41: 'MRK', 42: 'LUK', 43: 'JHN', 44: 'ACT', 45: 'ROM', 46: '1CO', 47: '2CO', 48: 'GAL',
  49: 'EPH', 50: 'PHP', 51: 'COL', 52: '1TH', 53: '2TH', 54: '1TI', 55: '2TI', 56: 'TIT',
  57: 'PHM', 58: 'HEB', 59: 'JAS', 60: '1PE', 61: '2PE', 62: '1JN', 63: '2JN', 64: '3JN',
  65: 'JUD', 66: 'REV'
};

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

const BOOK_BY_ID = Object.create(null);
const NAME_TO_BOOK = Object.create(null);
BOOKS.forEach(book => {
  BOOK_BY_ID[book.id] = book;
  NAME_TO_BOOK[book.name.toLowerCase()] = book;
  NAME_TO_BOOK[book.osis.toLowerCase()] = book;
});
Object.assign(NAME_TO_BOOK, {
  psalm: BOOK_BY_ID[19],
  psalms: BOOK_BY_ID[19],
  song: BOOK_BY_ID[22],
  'song of songs': BOOK_BY_ID[22],
  revelations: BOOK_BY_ID[66],
  mt: BOOK_BY_ID[40],
  mk: BOOK_BY_ID[41],
  lk: BOOK_BY_ID[42],
  jn: BOOK_BY_ID[43],
  rev: BOOK_BY_ID[66]
});

/* Environment is read on every request so a configuration change takes effect
   without a code change, and tests can set it per case. */
function apiBibleKey() {
  return process.env.NIV_API_KEY || process.env.BIBLE_API_KEY || '';
}

function apiBibleIdFor(version) {
  // NIV has no API route (see the header), so it never has an ID.
  if (version === 'NIV') return '';
  const envName = TRANSLATIONS[version] && TRANSLATIONS[version].apiBibleEnv;
  return envName ? (process.env[envName] || '') : '';
}

/* Whether api.bible can serve this edition with the current configuration. */
function apiBibleConfigured(version) {
  return !!apiBibleKey() && !!apiBibleIdFor(version);
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', status === 200
    ? `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=3600`
    : 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(payload));
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch (error) { reject(error); return; }
    if (parsed.protocol !== 'https:') {
      reject(new Error('Only HTTPS Bible providers are permitted'));
      return;
    }

    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: Object.assign({ accept: 'application/json' }, headers || {})
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode} from ${parsed.hostname}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(new Error(`Invalid JSON from ${parsed.hostname}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('Bible provider request timed out')));
    req.end();
  });
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, '\u2019')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (match, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (match, code) => String.fromCodePoint(parseInt(code, 16)));
}

/* Plain text from provider markup. Footnotes and cross-references are removed
   entirely so their text can never join a verse. */
function decodeText(value) {
  return decodeEntities(String(value || '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(note|f|x|sup)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(?:p|div|q|title|chapter|h\d|li|ul|ol)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/* Strong's concordance numbers are printed inside the KJV text of Bolls.life
   (for example "There was2258 a man444"). They are not part of the English. */
function stripStrongs(value) {
  return decodeText(String(value || '')
    .replace(/<S\b[^>]*>[\s\S]*?<\/S>/g, ' ')
    .replace(/<w\b[^>]*>[\s\S]*?<\/w>/gi, m => m.replace(/<[^>]+>/g, ' ')))
    .replace(/(?<=[A-Za-z\u00C0-\u024F'\u2019,;:.!?])\d{1,5}(?!\d)/g, '')
    .replace(/(^|\s)\d{1,5}(?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeVerses(verses, clean) {
  if (!Array.isArray(verses)) return [];
  const cleaner = clean || decodeText;
  return verses.map(item => ({
    verse: parseInt(item.verse || item.number || item.num, 10) || 0,
    text: cleaner(item.text || item.content || '')
  })).filter(item => item.verse > 0 && item.text);
}

function getVersion(value) {
  const code = String(value || 'NIV').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(TRANSLATIONS, code) ? code : null;
}

function validateChapter(bookId, chapterNumber) {
  const idValue = String(bookId == null ? '' : bookId);
  const chapterValue = String(chapterNumber == null ? '' : chapterNumber);
  if (!/^\d+$/.test(idValue) || !/^\d+$/.test(chapterValue)) return null;
  const book = BOOK_BY_ID[Number(idValue)];
  const chapter = Number(chapterValue);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.ch) return null;
  return { book, chapter };
}

function parseReference(reference) {
  const match = String(reference || '').trim().match(/^(.+?)\s+(\d+)(?::(\d+))?$/);
  if (!match) return null;
  const name = match[1].replace(/\s+/g, ' ').trim().toLowerCase();
  const book = NAME_TO_BOOK[name];
  const chapter = parseInt(match[2], 10);
  const verse = match[3] ? parseInt(match[3], 10) : null;
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.ch ||
      (verse !== null && (!Number.isInteger(verse) || verse < 1))) return null;
  return { book, chapter, verse };
}

/* api.bible returns chapter HTML where each verse starts with
   <span data-number="N" class="v">N</span>. Text between two markers belongs to
   the earlier verse. Verse numbers must run in order from 1 without gaps or
   repeats, otherwise the response is rejected rather than shown out of order. */
function parseApiBibleHtml(html) {
  const source = String(html || '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<note\b[^>]*>[\s\S]*?<\/note>/gi, '');
  const markerRe = /<span\b([^>]*\bclass="[^"]*\bv\b[^"]*"[^>]*)>\s*(\d+)\s*<\/span>/gi;
  const markers = [];
  let match;
  while ((match = markerRe.exec(source)) !== null) {
    const attr = match[1].match(/data-number="(\d+)"/);
    const number = parseInt(attr ? attr[1] : match[2], 10);
    markers.push({ number, start: match.index, end: match.index + match[0].length });
  }
  const verses = [];
  markers.forEach((marker, index) => {
    const next = markers[index + 1];
    const segment = source.slice(marker.end, next ? next.start : source.length);
    const text = decodeText(segment);
    if (text) verses.push({ verse: marker.number, text });
  });
  verses.forEach((item, index) => {
    if (item.verse !== index + 1) {
      throw new Error('api.bible returned verses out of sequence');
    }
  });
  return verses;
}

function normalizeApiBibleChapter(json, version, book, chapter, expectedBibleId) {
  const data = json && json.data ? json.data : null;
  if (!data) throw new Error('api.bible returned no chapter data');
  // The text must be the edition that was requested. Check the Bible ID and
  // the copyright line; a mismatch means the wrong Bible was configured.
  if (String(data.bibleId || '').toLowerCase() !== String(expectedBibleId).toLowerCase()) {
    throw new Error(`api.bible returned Bible ${data.bibleId || 'unknown'}, not the configured ${version}`);
  }
  const copyright = String(data.copyright || '');
  if (!TRANSLATIONS[version].copyrightMatch.test(copyright)) {
    throw new Error(`api.bible copyright does not identify ${TRANSLATIONS[version].name}`);
  }
  const verses = parseApiBibleHtml(data.content);
  if (!verses.length) throw new Error('api.bible returned no chapter verses');
  return {
    book: book.name,
    bookId: book.id,
    chapter,
    reference: `${book.name} ${chapter}`,
    translation: version,
    translationName: TRANSLATIONS[version].name,
    copyright: copyright || TRANSLATIONS[version].copyright,
    verses
  };
}

async function fetchApiBibleChapter(version, book, chapter) {
  const bibleId = apiBibleIdFor(version);
  const chapterId = `${USFM[book.id]}.${chapter}`;
  const query = 'content-type=html&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true';
  const url = `${API_BIBLE_BASE}/bibles/${encodeURIComponent(bibleId)}/chapters/${encodeURIComponent(chapterId)}?${query}`;
  const json = await httpsGet(url, { 'api-key': apiBibleKey() });
  return normalizeApiBibleChapter(json, version, book, chapter, bibleId);
}

async function fetchBollsChapter(version, book, chapter) {
  const code = TRANSLATIONS[version].bolls;
  const url = `https://bolls.life/get-text/${encodeURIComponent(code)}/${book.id}/${chapter}/`;
  const json = await httpsGet(url);
  const clean = TRANSLATIONS[version].strongs ? stripStrongs : decodeText;
  const verses = normalizeVerses(Array.isArray(json) ? json : (json && (json.verses || json.data)), clean);
  if (!verses.length) throw new Error('Bolls.life returned no chapter verses');
  return {
    book: book.name,
    bookId: book.id,
    chapter,
    reference: `${book.name} ${chapter}`,
    translation: version,
    translationName: TRANSLATIONS[version].name,
    copyright: TRANSLATIONS[version].copyright,
    verses
  };
}

function normalizeGetBibleChapter(json, version, book, chapter) {
  if (!TRANSLATIONS[version]) throw new Error('Unsupported GetBible edition');
  const abbreviation = String(json && json.abbreviation || '').toUpperCase();
  if (abbreviation !== version) {
    throw new Error(`GetBible returned ${abbreviation || 'an unidentified edition'}, not ${version}`);
  }
  if (Number(json && json.book_nr) !== book.id || Number(json && json.chapter) !== chapter) {
    throw new Error('GetBible returned a different passage');
  }
  const verses = normalizeVerses(json.verses);
  if (!verses.length) throw new Error('GetBible returned no chapter verses');
  return {
    book: book.name,
    bookId: book.id,
    chapter,
    reference: `${book.name} ${chapter}`,
    translation: version,
    translationName: TRANSLATIONS[version].name,
    copyright: TRANSLATIONS[version].copyright,
    verses
  };
}

async function fetchGetBibleChapter(version, book, chapter) {
  const edition = TRANSLATIONS[version];
  const url = `https://api.getbible.net/v2/${encodeURIComponent(edition.getBibleCode)}/${book.id}/${chapter}.json`;
  const json = await httpsGet(url);
  return normalizeGetBibleChapter(json, version, book, chapter);
}

function nivUnavailableError() {
  const error = new Error(NIV_UNAVAILABLE_MESSAGE);
  error.code = 'NIV_UNAVAILABLE';
  error.providerAttempts = [];
  return error;
}

async function fetchChapter(version, book, chapter) {
  const attempts = [];
  const tryProvider = async (name, operation, fallbackUsed) => {
    try {
      const result = await operation();
      return Object.assign(result, { provider: name, fallbackUsed: !!fallbackUsed });
    } catch (error) {
      attempts.push({ provider: name, error: String(error && error.message || error) });
      return null;
    }
  };

  if (version === 'NIV') throw nivUnavailableError();

  if (apiBibleConfigured(version)) {
    const licensed = await tryProvider('api.bible', () => fetchApiBibleChapter(version, book, chapter), false);
    if (licensed) return licensed;
  }

  if (GETBIBLE_EXACT_EDITIONS.has(version)) {
    const primary = await tryProvider('GetBible.net', () => fetchGetBibleChapter(version, book, chapter), false);
    if (primary) return primary;
  }

  if (TRANSLATIONS[version].bolls) {
    const secondary = await tryProvider('Bolls.life', () => fetchBollsChapter(version, book, chapter), GETBIBLE_EXACT_EDITIONS.has(version));
    if (secondary) return secondary;
  }

  const error = new Error(`${TRANSLATIONS[version].name} is unavailable from its exact-version providers`);
  error.providerAttempts = attempts;
  throw error;
}

async function fetchApiBibleSearch(version, query, limit) {
  const bibleId = apiBibleIdFor(version);
  const url = `${API_BIBLE_BASE}/bibles/${encodeURIComponent(bibleId)}/search?query=${encodeURIComponent(query)}&limit=${limit}&sort=canonical&fuzziness=0`;
  const json = await httpsGet(url, { 'api-key': apiBibleKey() });
  const data = json && json.data || {};
  const verses = (data.verses || []).map(item => {
    const reference = String(item.reference || '').trim();
    return {
      reference,
      bookId: item.bookId,
      chapter: item.chapterId,
      verse: item.verseId,
      text: decodeText(item.text || '')
    };
  }).filter(item => item.reference && item.text);
  return {
    translation: version,
    translationName: TRANSLATIONS[version].name,
    query,
    total: parseInt(data.total, 10) || verses.length,
    verses
  };
}

async function fetchBollsSearch(version, query, limit) {
  const code = TRANSLATIONS[version].bolls;
  const url = `https://bolls.life/v2/find/${encodeURIComponent(code)}?search=${encodeURIComponent(query)}&limit=${limit}&page=1`;
  const json = await httpsGet(url);
  const rows = Array.isArray(json) ? json : (json && Array.isArray(json.results) ? json.results : null);
  if (!rows) throw new Error('Bolls.life returned an invalid search response');
  const clean = TRANSLATIONS[version].strongs ? stripStrongs : decodeText;
  const verses = rows.slice(0, limit).map(item => {
    const book = BOOK_BY_ID[parseInt(item.book, 10)];
    const chapter = parseInt(item.chapter, 10);
    const verse = parseInt(item.verse, 10);
    if (!book || !chapter || !verse) return null;
    return {
      reference: `${book.name} ${chapter}:${verse}`,
      bookId: book.id,
      chapter,
      verse,
      text: clean(item.text || '')
    };
  }).filter(item => item && item.text);
  return {
    translation: version,
    translationName: TRANSLATIONS[version].name,
    query,
    total: verses.length,
    verses
  };
}

async function fetchSearch(version, query, limit) {
  const attempts = [];
  if (version === 'NIV') throw nivUnavailableError();
  if (apiBibleConfigured(version)) {
    try { return await fetchApiBibleSearch(version, query, limit); }
    catch (error) { attempts.push(`api.bible: ${String(error.message || error)}`); }
  }
  if (TRANSLATIONS[version].bolls) {
    try { return await fetchBollsSearch(version, query, limit); }
    catch (error) { attempts.push(`Bolls.life: ${String(error.message || error)}`); }
  }
  const error = new Error(`${TRANSLATIONS[version].name} search is unavailable`);
  error.providerAttempts = attempts;
  throw error;
}

function statusPayload(version) {
  const providers = [];
  if (apiBibleConfigured(version)) providers.push('api.bible');
  if (GETBIBLE_EXACT_EDITIONS.has(version)) providers.push('GetBible.net');
  if (TRANSLATIONS[version].bolls) providers.push('Bolls.life');
  const configured = version !== 'NIV';
  return {
    ok: true,
    translation: version,
    translationName: TRANSLATIONS[version].name,
    configured,
    providers,
    getBibleFallbackAvailable: GETBIBLE_EXACT_EDITIONS.has(version),
    getBibleCode: TRANSLATIONS[version].getBibleCode,
    copyright: TRANSLATIONS[version].copyright,
    message: version === 'NIV' ? NIV_UNAVAILABLE_MESSAGE : ''
  };
}

function providerLabel(attempt) {
  if (typeof attempt === 'string') return attempt.split(':')[0];
  return attempt && attempt.provider;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' });

  const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const action = requestUrl.searchParams.get('action') || 'status';
  const version = getVersion(requestUrl.searchParams.get('version'));
  if (!version) {
    return send(res, 400, {
      ok: false,
      error: 'UNSUPPORTED_TRANSLATION',
      message: 'Choose one of the supported Bible versions: NIV, KJV, NLT, ESV or MSG.'
    });
  }

  if (action === 'status') return send(res, 200, statusPayload(version));
  if (action === 'books') {
    return send(res, 200, {
      ok: true,
      translation: version,
      books: BOOKS.map(book => ({ id: book.id, name: book.name, chapters: book.ch, osis: book.osis }))
    });
  }

  if (action === 'chapter') {
    const rawBookId = requestUrl.searchParams.get('id');
    const rawBookName = requestUrl.searchParams.get('book');
    const validBookId = rawBookId && /^\d+$/.test(rawBookId);
    const book = rawBookId
      ? (validBookId ? BOOK_BY_ID[Number(rawBookId)] : null)
      : NAME_TO_BOOK[String(rawBookName || '').toLowerCase()];
    const chapter = requestUrl.searchParams.get('chapter');
    const valid = book && validateChapter(book.id, chapter);
    if (!valid) return send(res, 400, { ok: false, error: 'INVALID_PASSAGE', message: 'A valid book and chapter are required.' });
    try {
      const data = await fetchChapter(version, valid.book, valid.chapter);
      return send(res, 200, Object.assign({ ok: true }, data));
    } catch (error) {
      const notConfigured = error.code === 'NIV_UNAVAILABLE';
      return send(res, notConfigured ? 451 : 502, {
        ok: false,
        translation: version,
        translationName: TRANSLATIONS[version].name,
        copyright: TRANSLATIONS[version].copyright,
        error: notConfigured ? 'NIV_UNAVAILABLE' : 'TRANSLATION_UNAVAILABLE',
        message: notConfigured
          ? NIV_UNAVAILABLE_MESSAGE
          : `The ${TRANSLATIONS[version].name} text is temporarily unavailable. Prayer Dome has not substituted a different translation. Please try again shortly.`,
        providersTried: (error.providerAttempts || []).map(providerLabel)
      });
    }
  }

  if (action === 'search') {
    const query = String(requestUrl.searchParams.get('q') || '').trim().slice(0, 100);
    if (!query) return send(res, 400, { ok: false, error: 'QUERY_REQUIRED', message: 'Enter a word or phrase to search.' });
    const limit = Math.max(1, Math.min(parseInt(requestUrl.searchParams.get('limit'), 10) || 20, 30));
    try {
      const data = await fetchSearch(version, query, limit);
      return send(res, 200, Object.assign({ ok: true }, data));
    } catch (error) {
      const notConfigured = error.code === 'NIV_UNAVAILABLE';
      return send(res, notConfigured ? 451 : 502, {
        ok: false,
        translation: version,
        translationName: TRANSLATIONS[version].name,
        error: notConfigured ? 'NIV_UNAVAILABLE' : 'SEARCH_UNAVAILABLE',
        message: notConfigured
          ? NIV_UNAVAILABLE_MESSAGE
          : `${TRANSLATIONS[version].name} search is temporarily unavailable. No other translation has been substituted. Please try again shortly.`,
        providersTried: (error.providerAttempts || []).map(providerLabel)
      });
    }
  }

  if (action === 'verse') {
    const reference = requestUrl.searchParams.get('ref') || '';
    const parsed = parseReference(reference);
    if (!parsed || !parsed.verse) {
      return send(res, 400, { ok: false, error: 'INVALID_REFERENCE', message: 'Use a reference such as John 3:16.' });
    }
    try {
      const data = await fetchChapter(version, parsed.book, parsed.chapter);
      const verse = data.verses.find(item => item.verse === parsed.verse);
      if (!verse) return send(res, 404, { ok: false, error: 'VERSE_NOT_FOUND', translation: version });
      return send(res, 200, {
        ok: true,
        reference: `${parsed.book.name} ${parsed.chapter}:${verse.verse}`,
        translation: version,
        translationName: TRANSLATIONS[version].name,
        copyright: data.copyright,
        text: verse.text,
        provider: data.provider,
        fallbackUsed: data.fallbackUsed
      });
    } catch (error) {
      const notConfigured = error.code === 'NIV_UNAVAILABLE';
      return send(res, notConfigured ? 451 : 502, {
        ok: false,
        translation: version,
        translationName: TRANSLATIONS[version].name,
        error: notConfigured ? 'NIV_UNAVAILABLE' : 'TRANSLATION_UNAVAILABLE',
        message: notConfigured
          ? NIV_UNAVAILABLE_MESSAGE
          : `The ${TRANSLATIONS[version].name} text is temporarily unavailable. No other translation has been substituted.`
      });
    }
  }

  return send(res, 400, { ok: false, error: `Unknown action: ${action}` });
};

module.exports.TRANSLATIONS = TRANSLATIONS;
module.exports.GETBIBLE_EXACT_EDITIONS = GETBIBLE_EXACT_EDITIONS;
module.exports.USFM = USFM;
module.exports._normalizeGetBibleChapter = normalizeGetBibleChapter;
module.exports._normalizeVerses = normalizeVerses;
module.exports._normalizeApiBibleChapter = normalizeApiBibleChapter;
module.exports._parseApiBibleHtml = parseApiBibleHtml;
module.exports._stripStrongs = stripStrongs;
module.exports._decodeText = decodeText;
module.exports._parseReference = parseReference;
module.exports._getVersion = getVersion;
module.exports._apiBibleIdFor = apiBibleIdFor;
