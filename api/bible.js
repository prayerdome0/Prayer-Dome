'use strict';

/**
 * Prayer Dome — version-aware Bible endpoint
 * ---------------------------------------------------------------------------
 * The reader offers NIV, KJV, NLT, ESV, MSG and BSB. Every provider request is
 * pinned to the requested edition, every response is checked against the
 * edition and passage it claims to be, and a provider response is never
 * relabelled as another translation.
 *
 * Providers, per edition:
 *   - NIV, MSG: API.Bible only, through this Prayer Dome account's own key.
 *     There is no mirror fallback for these two: if the account cannot serve
 *     the text, the reader says so and shows no text from anywhere else.
 *   - KJV: GetBible v2 (kjv, public domain), then Bolls.life KJV with Strong's
 *     numbers removed.
 *   - NLT: API.Bible when NLT_BIBLE_ID and the key are configured, otherwise
 *     Bolls.life's version-specific feed.
 *   - ESV: Bolls.life's version-specific feed. Rights for that feed are not
 *     verified; see docs/BIBLE-LICENSING.md.
 *   - BSB: bundled public-domain files in assets/bible/bsb/. The reader loads
 *     those itself; this function is not involved.
 *
 * API.Bible credentials
 *   - Key:      BIBLE_API_KEY (legacy aliases: NIV_API_KEY, API_BIBLE_KEY).
 *               Read from the environment on every request. Sent only in the
 *               `api-key` request header, never in a URL, a response or a log.
 *   - Bible ID: NIV_BIBLE_ID / MSG_BIBLE_ID override the lookup. Without an
 *               override the ID comes from the account's own Bible listing
 *               (GET /v1/bibles), so the app can only read editions the
 *               account is actually licensed for. If that listing cannot be
 *               reached, NIV falls back to the ID published in the API.Bible
 *               docs; MSG reports that the ID still has to be configured.
 *
 * Endpoints:
 *   GET /api/bible?action=status&version=NIV
 *   GET /api/bible?action=setup&version=MSG
 *   GET /api/bible?action=bibles
 *   GET /api/bible?action=books&version=NIV
 *   GET /api/bible?action=chapter&id=43&chapter=3&version=KJV
 *   GET /api/bible?action=search&q=love&version=NIV
 *   GET /api/bible?action=verse&ref=John+3:16&version=NIV
 *
 * Secrets: the JSON writer redacts the key from every response body as a
 * second line of defence.
 */

const https = require('https');
const { URL } = require('url');

const API_BIBLE_BASE = 'https://rest.api.bible/v1';
const API_BIBLE_LISTING_URL = `${API_BIBLE_BASE}/bibles?language=eng`;
const REQUEST_TIMEOUT_MS = 3500;
const API_BIBLE_TIMEOUT_MS = 6000;
const CACHE_MAX_AGE = 300;

/* The NIV Bible ID published in the API.Bible "Bibles" guide
   (https://docs.api.bible/guides/bibles/). It is only used when the account
   listing cannot be reached; when the listing answers, the ID comes from the
   account itself. MSG has no published ID, so it must come from the account
   listing or from MSG_BIBLE_ID. */
const NIV_DOCUMENTED_BIBLE_ID = '78a9f6124f344018-01';
const BIBLE_ID_PATTERN = /^[0-9a-f]{16}-\d{1,2}$/i;

const TRANSLATIONS = {
  NIV: {
    name: 'New International Version',
    getBibleCode: null,
    bolls: null,
    apiBibleOnly: true,
    apiBibleEnv: 'NIV_BIBLE_ID',
    apiBibleDocumentedId: NIV_DOCUMENTED_BIBLE_ID,
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
    bolls: null,
    apiBibleOnly: true,
    apiBibleEnv: 'MSG_BIBLE_ID',
    copyrightMatch: /The Message/i,
    copyright: 'The Message® copyright © 1993, 2002, 2018 by Eugene H. Peterson. Used by permission of NavPress. All rights reserved.'
  }
};

// GetBible v2 publishes KJV only among these editions. Do not infer others.
const GETBIBLE_EXACT_EDITIONS = new Set(['KJV']);

// USFM book codes used by api.bible chapter, verse and book IDs.
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
const BOOK_BY_USFM = Object.create(null);
BOOKS.forEach(book => {
  BOOK_BY_ID[book.id] = book;
  BOOK_BY_USFM[USFM[book.id]] = book;
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

/* ---------------------------------------------------------------------------
 * In-memory memoisation
 * Successful api.bible reads are kept for ten minutes and failures for one, so
 * a warm serverless instance does not spend the account's monthly call quota
 * on the same chapter twice and a provider outage is not retried on every
 * request. In-flight requests for the same key share one promise.
 * ------------------------------------------------------------------------- */
const MEMO_SUCCESS_TTL_MS = 10 * 60 * 1000;
const MEMO_FAILURE_TTL_MS = 60 * 1000;
const MEMO_MAX_ENTRIES = 300;
const memoStore = new Map();
const memoPending = new Map();

function memoRead(key) {
  const entry = memoStore.get(key);
  if (!entry) return null;
  if (entry.expires <= Date.now()) {
    memoStore.delete(key);
    return null;
  }
  return entry;
}

function memoWrite(key, value, ttlMs) {
  if (memoStore.size >= MEMO_MAX_ENTRIES) {
    const oldest = memoStore.keys().next();
    if (!oldest.done) memoStore.delete(oldest.value);
  }
  memoStore.set(key, { value, expires: Date.now() + ttlMs });
}

/* Rebuilds a thrown error from its cached shape so callers keep the code and
   the message that describe the failure. */
function revivedError(shape) {
  const error = new Error(shape.message);
  error.code = shape.code;
  error.providerAttempts = [];
  return error;
}

async function memoize(key, factory) {
  const cached = memoRead(key);
  if (cached) {
    if (cached.value.error) throw revivedError(cached.value.error);
    return cached.value.result;
  }
  if (memoPending.has(key)) return memoPending.get(key);
  const pending = (async () => {
    try {
      const result = await factory();
      memoWrite(key, { result }, MEMO_SUCCESS_TTL_MS);
      return result;
    } catch (error) {
      if (error && error.memoizable !== false) {
        memoWrite(key, { error: { code: error.code, message: error.message } }, MEMO_FAILURE_TTL_MS);
      }
      throw error;
    } finally {
      memoPending.delete(key);
    }
  })();
  memoPending.set(key, pending);
  return pending;
}

function resetCaches() {
  memoStore.clear();
  memoPending.clear();
}

/* ---------------------------------------------------------------------------
 * Configuration
 * ------------------------------------------------------------------------- */

/* The key is read on every request so a configuration change takes effect
   without a code change, and tests can set it per case. */
function apiBibleKey() {
  return process.env.BIBLE_API_KEY || process.env.NIV_API_KEY || process.env.API_BIBLE_KEY || '';
}

function apiBibleIdOverride(version) {
  const envName = TRANSLATIONS[version] && TRANSLATIONS[version].apiBibleEnv;
  return envName ? String(process.env[envName] || '').trim() : '';
}

function apiBibleDocumentedId(version) {
  return TRANSLATIONS[version] && TRANSLATIONS[version].apiBibleDocumentedId || '';
}

/* True when this edition is served by api.bible (always for NIV and MSG). */
function usesApiBible(version) {
  const edition = TRANSLATIONS[version];
  if (!edition) return false;
  return Boolean(edition.apiBibleOnly || edition.apiBibleEnv);
}

/* True when api.bible is the only source this edition may use. */
function apiBibleOnly(version) {
  return Boolean(TRANSLATIONS[version] && TRANSLATIONS[version].apiBibleOnly);
}

function isValidBibleId(value) {
  return BIBLE_ID_PATTERN.test(String(value || '').trim());
}

function bibleError(code, message, extra) {
  const error = new Error(message);
  error.code = code;
  error.providerAttempts = [];
  if (extra) Object.assign(error, extra);
  return error;
}

/* Reader-facing text stays free of environment-variable names; the owner
   instructions travel in `detail`, which the reader never renders. */
function missingKeyError(version) {
  const edition = TRANSLATIONS[version];
  const bibleIdIsSet = Boolean(apiBibleIdOverride(version));
  const idNote = bibleIdIsSet
    ? ' A Bible ID is configured, but an API.Bible server key is also required; the ID alone cannot authorize requests.'
    : ' A server-side API.Bible key is required to read this translation.';
  const idSetup = bibleIdIsSet
    ? ` ${edition.apiBibleEnv} is already set and can remain unchanged.`
    : edition.apiBibleEnv
      ? ` Set ${edition.apiBibleEnv} only if you want to pin an ID instead of using the account list.`
      : '';
  return bibleError('TRANSLATION_NOT_CONFIGURED',
    `${edition.name} is served from API.Bible and is not configured on this server right now.${idNote} No ${version} text is shown. No other translation has been substituted.`,
    { detail: `Set BIBLE_API_KEY (the API.Bible key) in Vercel → Settings → Environment Variables, then redeploy.${idSetup} A free API.Bible Starter key is enough: sign up at ${API_BIBLE_LINKS.signUp}, add ${edition.name} to the account (Starter includes up to three licensed Bibles), then set BIBLE_API_KEY. Full steps: GET /api/bible?action=setup&version=${version}.` });
}

/* The key is present, the account list could not be read, and there is no
   published fallback ID (MSG): say so rather than inventing an ID. */
function bibleIdUnresolvedError(version, listingError) {
  const edition = TRANSLATIONS[version];
  const cause = listingError ? String(listingError.message || listingError).slice(0, 120) : '';
  return bibleError('TRANSLATION_NOT_CONFIGURED',
    `${edition.name} is served from API.Bible and its Bible ID could not be resolved right now, so no ${version} text is shown. No other translation has been substituted.`,
    { detail: `Set ${edition.apiBibleEnv} to the Bible ID from your API.Bible account, or retry once the account's Bible list (GET /v1/bibles) can be reached.${cause ? ` Last error: ${cause}` : ''} A free API.Bible Starter key works for this: add ${edition.name} to the account (Starter includes up to three licensed Bibles), then set BIBLE_API_KEY. Steps: GET /api/bible?action=setup&version=${version}.` });
}

function notInAccountError(version) {
  const edition = TRANSLATIONS[version];
  return bibleError('TRANSLATION_NOT_IN_ACCOUNT',
    `${edition.name} is not available through this site's API.Bible account, so no ${version} text is shown. No other translation has been substituted.`,
    { detail: `Your API.Bible account does not list ${edition.name}. Add this translation to your API.Bible plan — the free Starter plan includes up to three licensed Bibles, so it costs nothing — or set ${edition.apiBibleEnv} to its ID from the account. See GET /api/bible?action=setup&version=${version} for the steps.` });
}

/* ---------------------------------------------------------------------------
 * Free setup guide
 * ---------------------------------------------------------------------------
 * The Message and the NIV are licensed translations, so a public-domain mirror
 * may not serve them and the reader never substitutes another edition. They do
 * not have to be paid for either: API.Bible's free Starter plan is $0 a month,
 * includes up to three licensed Bibles, and The Message is one of the choices.
 * The steps below are the same text the owner sees in the reader, in
 * GET /api/bible?action=setup and from `npm run bible:ids -- --setup`. */

const API_BIBLE_LINKS = {
  signUp: 'https://api.bible/sign-up',
  dashboard: 'https://api.bible/dashboard',
  bibles: 'https://api.bible/bibles',
  gettingStarted: 'https://api.bible/getting-started',
  docs: 'https://docs.api.bible/'
};

/* Why a free key is enough, in the owner's words. `version` picks the edition
   named in the steps; the plan facts are the same for every edition. */
function freePlan(version) {
  const edition = TRANSLATIONS[version];
  return {
    provider: 'api.bible',
    plan: 'Starter',
    price: '$0 per month',
    callLimit: '5,000 API calls per month',
    licensedBibles: 'up to 3 licensed Bibles, plus every open-access Bible',
    commercialUse: false,
    note: 'The Starter plan is for non-commercial use: no ads and no fees or upsells for the content. A church site with free membership and voluntary giving fits that; if the site is ever run for revenue, API.Bible\'s paid plan is needed.',
    keyEnv: 'BIBLE_API_KEY',
    idEnv: edition.apiBibleEnv || null,
    links: API_BIBLE_LINKS,
    steps: [
      {
        title: 'Create a free API.Bible account',
        detail: `Open ${API_BIBLE_LINKS.signUp} and sign up. No card is asked for and no plan has to be bought: the Starter plan is $0 per month.`
      },
      {
        title: `Add ${edition.name} (${version}) to the account`,
        detail: `In the API.Bible dashboard (${API_BIBLE_LINKS.dashboard}) add ${edition.name} to your plan. Starter includes up to three licensed Bibles, so pick ${version}. If all three slots are already used, remove one and add ${version}.`
      },
      {
        title: 'Copy the account API key',
        detail: 'On the dashboard, copy the API key for the account. It is a long string; keep it private (never commit it or paste it in chat).'
      },
      {
        title: 'Give the key to Prayer Dome',
        detail: 'Vercel → the Prayer Dome project → Settings → Environment Variables → add BIBLE_API_KEY with that value (tick Production, and Preview/Development if you use them), then redeploy. Locally, start the server with BIBLE_API_KEY=<key> npm run dev.'
      },
      {
        title: 'Check that it worked',
        detail: `Open /api/bible?action=status&version=${version} and look for "configured": true, or run BIBLE_API_KEY=<key> npm run bible:ids -- --setup --verify. The reader then loads ${edition.name} chapters and says which Bible ID it read.`
      }
    ]
  };
}

/* The reader and the owner both get this: a reader-facing summary line, plus
   the owner steps folded into a "site owner?" section. */
function setupPayload(version) {
  const plan = freePlan(version);
  return {
    needed: true,
    summary: `${TRANSLATIONS[version].name} is a licensed translation, so it is read from API.Bible rather than a free mirror. Switching it on costs nothing: the free API.Bible Starter plan covers it. No other translation is ever shown in its place.`,
    plan: {
      name: plan.plan,
      price: plan.price,
      callLimit: plan.callLimit,
      licensedBibles: plan.licensedBibles,
      commercialUse: plan.commercialUse,
      note: plan.note
    },
    env: { key: plan.keyEnv, bibleId: plan.idEnv },
    links: plan.links,
    steps: plan.steps
  };
}

/* ---------------------------------------------------------------------------
 * Account Bible listing and ID resolution
 * ------------------------------------------------------------------------- */

function normalizeMatchKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/* Ranks one API.Bible listing entry against the requested edition. 3 = the
   abbreviation is exactly the reader's code, 2 = the full name matches, 1 =
   the name starts with the edition name, 0 = not this edition. */
function bibleMatchRank(entry, version) {
  const edition = TRANSLATIONS[version];
  if (!entry || !edition) return 0;
  const code = normalizeMatchKey(version);
  const name = normalizeMatchKey(edition.name);
  const abbreviations = [entry.abbreviation, entry.abbreviationLocal].map(normalizeMatchKey);
  const names = [entry.name, entry.nameLocal].map(normalizeMatchKey);
  if (abbreviations.indexOf(code) !== -1) return 3;
  if (names.indexOf(name) !== -1) return 2;
  if (names.some(value => value && value.indexOf(name) === 0)) return 1;
  return 0;
}

/* Chooses the entry the account itself lists for this edition. Nothing is
   guessed: an entry must match the abbreviation or the full name. */
function matchBibleFromListing(listing, version) {
  let best = null;
  let bestRank = 0;
  (Array.isArray(listing) ? listing : []).forEach(entry => {
    if (!entry || !isValidBibleId(entry.id)) return;
    const rank = bibleMatchRank(entry, version);
    if (rank > bestRank) {
      best = entry;
      bestRank = rank;
    }
  });
  if (!best) return null;
  return {
    bibleId: best.id,
    name: best.name || best.nameLocal || TRANSLATIONS[version].name,
    abbreviation: best.abbreviationLocal || best.abbreviation || version
  };
}

async function fetchApiBibleListing() {
  const json = await httpsGet(API_BIBLE_LISTING_URL, { 'api-key': apiBibleKey() }, { timeoutMs: API_BIBLE_TIMEOUT_MS });
  const data = json && json.data;
  if (!Array.isArray(data)) {
    throw bibleError('PROVIDER_UNREACHABLE', 'API.Bible returned an unexpected Bible list.');
  }
  return data.map(entry => ({
    id: entry && entry.id,
    abbreviation: entry && entry.abbreviation,
    abbreviationLocal: entry && entry.abbreviationLocal,
    name: entry && entry.name,
    nameLocal: entry && entry.nameLocal
  }));
}

function apiBibleListing() {
  return memoize('apiBible:listing', fetchApiBibleListing);
}

/* Resolves the Bible ID this account should read for an edition:
   environment override, then the account's own listing, then (NIV only) the
   ID published in the API.Bible documentation. */
async function resolveBibleId(version) {
  const override = apiBibleIdOverride(version);
  if (override) {
    if (!isValidBibleId(override)) {
      throw bibleError('TRANSLATION_NOT_CONFIGURED',
        `${TRANSLATIONS[version].apiBibleEnv} is not a valid API.Bible Bible ID. Copy the ID from your API.Bible account's Bible list. No other translation is shown in its place.`);
    }
    return { bibleId: override, source: 'environment' };
  }
  let listing = null;
  let listingError = null;
  try {
    listing = await apiBibleListing();
  } catch (error) {
    listingError = error;
  }
  if (listing) {
    const match = matchBibleFromListing(listing, version);
    if (match) return Object.assign({ source: 'account-listing' }, match);
    throw notInAccountError(version);
  }
  const documented = apiBibleDocumentedId(version);
  if (documented) return { bibleId: documented, source: 'documented-default' };
  throw bibleIdUnresolvedError(version, listingError);
}

/* ---------------------------------------------------------------------------
 * HTTP
 * ------------------------------------------------------------------------- */

function send(res, status, payload) {
  let body = JSON.stringify(payload);
  const key = apiBibleKey();
  // The key must never reach a client, not even through an unexpected message.
  if (key) body = body.split(key).join('[redacted]');
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', status === 200
    ? `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=3600`
    : 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(body);
}

function httpsGet(url, headers, options) {
  const timeoutMs = (options && options.timeoutMs) || REQUEST_TIMEOUT_MS;
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
        const status = response.statusCode || 0;
        if (status < 200 || status >= 300) {
          // The provider's own message is kept for the server log and mapping.
          // It is never copied into a response: it can name account details.
          const error = new Error(`HTTP ${status} from ${parsed.hostname}`);
          error.status = status;
          error.providerMessage = providerMessage(text);
          reject(error);
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
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Bible provider request timed out')));
    req.end();
  });
}

/* Trimmed provider error text, for logs only. */
function providerMessage(text) {
  try {
    const parsed = JSON.parse(text);
    const message = parsed && (parsed.message || parsed.error);
    if (typeof message === 'string') return message.slice(0, 200);
  } catch (error) { /* not JSON */ }
  return String(text || '').slice(0, 200);
}

/* Maps an api.bible failure onto a code, a public message and an HTTP status.
   Returns null when the failure is generic and the caller should keep its own
   fallback wording. */
function apiBibleFailure(error, version) {
  const edition = TRANSLATIONS[version];
  const status = error && error.status;
  if (status === 401) {
    return {
      code: 'API_KEY_REJECTED',
      httpStatus: 502,
      message: `API.Bible rejected this site's API key, so ${edition.name} is unavailable. No other translation has been substituted.`,
      detail: 'Check BIBLE_API_KEY in the deployment environment; the key must be the one from the Prayer Dome API.Bible account.'
    };
  }
  if (status === 403) {
    return {
      code: 'TRANSLATION_NOT_LICENSED',
      httpStatus: 451,
      message: `This site's API.Bible account is not licensed for ${edition.name}, so no ${version} text is shown. No other translation has been substituted.`,
      detail: `Add ${edition.name} to the API.Bible account's plan (Starter plans include a limited number of licensed translations) or contact API.Bible support about access to this translation.`
    };
  }
  if (status === 404) {
    return {
      code: 'BIBLE_NOT_FOUND',
      httpStatus: 502,
      message: `API.Bible has no Bible with the configured ID for ${edition.name}, so no ${version} text is shown. No other translation has been substituted.`,
      detail: `Check ${edition.apiBibleEnv} against your API.Bible account's Bible list (GET /v1/bibles), or clear it to let the account list decide.`
    };
  }
  if (status === 429) {
    return {
      code: 'RATE_LIMITED',
      httpStatus: 503,
      message: `The API.Bible call limit for this account has been reached, so ${edition.name} cannot be loaded right now. Try again later. No other translation has been substituted.`,
      detail: 'The account has used its monthly api.bible call allowance. Raise the plan, wait for the next period, or cache more aggressively.'
    };
  }
  return null;
}

/* ---------------------------------------------------------------------------
 * Text handling
 * ------------------------------------------------------------------------- */

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
    .replace(/<\/(?:p|div|q|title|chapter|h\d|li|ul|ol)\b[^>]*>/gi, ' ')
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
   the earlier verse. Numbers may be printed as a range ("16-21"), may skip
   (editions differ in versification and The Message folds several numbered
   verses into one paragraph), and may repeat after a section break — those are
   all read as the edition's own numbering. Only a number that runs backwards
   is rejected, because that would reorder the text.

   Some editions mark verses with data-verse-id / data-sid attributes instead;
   those are read the same way when the default markers are absent. */
/* Verse numbers can be printed on their own ("16") or as the start of a range
   ("16-21"), which is how The Message groups most of its paragraphs; both are
   read as the verse the text begins at. */
const VERSE_NUMBER = '(\\d+)(?:\\s*[-\\u2013\\u2014]\\s*\\d+)?';

function findVerseMarkers(source) {
  const markerRe = new RegExp(`<span\\b([^>]*\\bclass="[^"]*\\bv\\b[^"]*"[^>]*)>\\s*${VERSE_NUMBER}\\s*<\\/span>`, 'gi');
  const attributeRe = new RegExp(`data-number="${VERSE_NUMBER}"`);
  const markers = [];
  let match;
  while ((match = markerRe.exec(source)) !== null) {
    const attr = match[1].match(attributeRe);
    const number = parseInt(attr ? attr[1] : match[2], 10);
    markers.push({ number, start: match.index, end: match.index + match[0].length });
  }
  if (markers.length) return markers;

  // Alternate shape: <span data-verse-id="JHN.3.16"> ... </span>
  const alternateRe = /<span\b[^>]*\bdata-verse-id="([A-Z0-9]{3})\.(\d+)\.(\d+)"[^>]*>/gi;
  while ((match = alternateRe.exec(source)) !== null) {
    markers.push({ number: parseInt(match[3], 10), start: match.index + match[0].length, end: source.length });
  }
  for (let index = 0; index < markers.length - 1; index += 1) {
    markers[index].end = markers[index + 1].start;
  }
  return markers;
}

function parseApiBibleHtml(html) {
  const source = String(html || '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<note\b[^>]*>[\s\S]*?<\/note>/gi, '');
  // Markers numbered 0 (a chapter introduction in some editions) carry no
  // verse of their own; they are dropped rather than rendered as verse 0.
  const markers = findVerseMarkers(source).filter(marker => marker.number > 0);
  const verses = [];
  markers.forEach((marker, index) => {
    const next = markers[index + 1];
    const segment = source.slice(marker.end, next ? next.start : source.length);
    const text = decodeText(segment);
    if (!text) return;
    const last = verses[verses.length - 1];
    if (last && marker.number < last.verse) {
      throw new Error('api.bible returned verses out of sequence');
    }
    if (last && marker.number === last.verse) {
      // The same verse number printed again after a paragraph or section break
      // is a continuation of that verse, not a second verse.
      last.text = `${last.text} ${text}`.replace(/\s+/g, ' ').trim();
      return;
    }
    verses.push({ verse: marker.number, text });
  });
  return verses;
}

/* ---------------------------------------------------------------------------
 * api.bible reads
 * ------------------------------------------------------------------------- */

function assertApiBibleIdentity(data, version, expectedBibleId) {
  if (!data) throw new Error('api.bible returned no text');
  // The text must be the edition that was requested. Check the Bible ID and
  // the copyright line; a mismatch means the wrong Bible was configured.
  if (String(data.bibleId || '').toLowerCase() !== String(expectedBibleId).toLowerCase()) {
    throw new Error(`api.bible returned Bible ${data.bibleId || 'unknown'}, not the configured ${version}`);
  }
  const copyright = String(data.copyright || '');
  if (!TRANSLATIONS[version].copyrightMatch.test(copyright)) {
    throw new Error(`api.bible copyright does not identify ${TRANSLATIONS[version].name}`);
  }
  return copyright;
}

async function fetchApiBibleChapter(version, book, chapter) {
  const resolved = await resolveBibleId(version);
  const chapterId = `${USFM[book.id]}.${chapter}`;
  return memoize(`apiBible:chapter:${resolved.bibleId}:${chapterId}`, async () => {
    const query = 'content-type=html&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true';
    const url = `${API_BIBLE_BASE}/bibles/${encodeURIComponent(resolved.bibleId)}/chapters/${encodeURIComponent(chapterId)}?${query}`;
    const json = await httpsGet(url, { 'api-key': apiBibleKey() }, { timeoutMs: API_BIBLE_TIMEOUT_MS });
    const data = json && json.data ? json.data : null;
    const copyright = assertApiBibleIdentity(data, version, resolved.bibleId);
    let verses = [];
    try {
      verses = parseApiBibleHtml(data.content);
    } catch (parseError) {
      // The provider's own text stays out of the response; the reader is told
      // what happened without pretending the edition is simply offline.
      console.warn(`api.bible ${version} chapter ${chapterId} could not be laid out: ${String(parseError.message || parseError).slice(0, 120)}`);
      throw bibleError('CHAPTER_FORMAT_UNSUPPORTED',
        `API.Bible returned ${TRANSLATIONS[version].name} chapter ${chapterId} in a verse order the reader cannot lay out, so no ${version} text is shown. The text has not been substituted.`);
    }
    if (!verses.length) {
      throw bibleError('CHAPTER_FORMAT_UNSUPPORTED',
        `API.Bible returned ${TRANSLATIONS[version].name} chapter ${chapterId} without verse numbers, so the reader cannot lay it out. The text has not been substituted.`);
    }
    return {
      book: book.name,
      bookId: book.id,
      chapter,
      reference: `${book.name} ${chapter}`,
      translation: version,
      translationName: TRANSLATIONS[version].name,
      copyright: copyright || TRANSLATIONS[version].copyright,
      bibleId: resolved.bibleId,
      bibleIdSource: resolved.source,
      verses
    };
  });
}

async function fetchApiBibleVerse(version, book, chapter, verseNumber) {
  const resolved = await resolveBibleId(version);
  const verseId = `${USFM[book.id]}.${chapter}.${verseNumber}`;
  const query = 'content-type=html&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=false';
  const url = `${API_BIBLE_BASE}/bibles/${encodeURIComponent(resolved.bibleId)}/verses/${encodeURIComponent(verseId)}?${query}`;
  const json = await httpsGet(url, { 'api-key': apiBibleKey() }, { timeoutMs: API_BIBLE_TIMEOUT_MS });
  const data = json && json.data ? json.data : null;
  const copyright = assertApiBibleIdentity(data, version, resolved.bibleId);
  const text = decodeText(data.content);
  if (!text) throw new Error('api.bible returned an empty verse');
  return {
    reference: `${book.name} ${chapter}:${verseNumber}`,
    bookId: book.id,
    chapter,
    verse: verseNumber,
    translation: version,
    translationName: TRANSLATIONS[version].name,
    copyright: copyright || TRANSLATIONS[version].copyright,
    text,
    provider: 'api.bible',
    fallbackUsed: false
  };
}

async function fetchApiBibleBooks(version) {
  const resolved = await resolveBibleId(version);
  return memoize(`apiBible:books:${resolved.bibleId}`, async () => {
    const url = `${API_BIBLE_BASE}/bibles/${encodeURIComponent(resolved.bibleId)}/books?include-chapters=true`;
    const json = await httpsGet(url, { 'api-key': apiBibleKey() }, { timeoutMs: API_BIBLE_TIMEOUT_MS });
    const data = json && json.data;
    if (!Array.isArray(data)) throw new Error('api.bible returned no book list');
    const books = data.map(entry => {
      const book = BOOK_BY_USFM[String(entry && entry.id || '').toUpperCase()];
      if (!book) return null;
      const chapters = Array.isArray(entry.chapters) ? entry.chapters.length : 0;
      return {
        id: book.id,
        name: book.name,
        chapters: chapters || book.ch,
        osis: book.osis
      };
    }).filter(Boolean).sort((a, b) => a.id - b.id);
    if (!books.length) throw new Error('api.bible returned no recognised books');
    return books;
  });
}

/* ---------------------------------------------------------------------------
 * Other providers (unchanged behaviour)
 * ------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------
 * Chapter, verse, search
 * ------------------------------------------------------------------------- */

/* Translate an api.bible failure into the reader's error vocabulary, keeping
   the specific reason (no licence, rejected key, wrong ID, rate limit) instead
   of a generic "unavailable". The provider's own text stays in the server log. */
function mapApiBibleError(error, version) {
  if (!error) return error;
  if (error.providerMessage) logProviderFailure(version, error);
  const mapped = error.status ? apiBibleFailure(error, version) : null;
  if (mapped) {
    error.readerCode = mapped.code;
    error.httpStatus = mapped.httpStatus;
    error.message = mapped.message;
    error.detail = mapped.detail;
  }
  return error;
}

function logProviderFailure(version, error) {
  const key = apiBibleKey();
  const text = key
    ? String(error.providerMessage).split(key).join('[redacted]')
    : String(error.providerMessage);
  console.warn(`api.bible ${version} request failed: HTTP ${error.status || 'n/a'} — ${text.slice(0, 200)}`);
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

  // NIV and MSG are read from API.Bible and nowhere else: a mirror is never
  // shown in their place.
  if (apiBibleOnly(version)) {
    if (!apiBibleKey()) throw missingKeyError(version);
    try {
      const licensed = await fetchApiBibleChapter(version, book, chapter);
      return Object.assign(licensed, { provider: 'api.bible', fallbackUsed: false });
    } catch (error) {
      error.providerAttempts = [{ provider: 'api.bible', error: String(error.message || error) }];
      throw mapApiBibleError(error, version);
    }
  }

  if (usesApiBible(version) && apiBibleKey() && apiBibleIdOverride(version)) {
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

/* Single verse. API.Bible editions use the dedicated verse endpoint; every
   other edition keeps the existing chapter-then-pick route. */
async function fetchVerse(version, book, chapter, verseNumber) {
  if (apiBibleOnly(version)) {
    if (!apiBibleKey()) throw missingKeyError(version);
    try {
      return await fetchApiBibleVerse(version, book, chapter, verseNumber);
    } catch (error) {
      // A verse the edition does not carry is a 404, not a provider outage.
      if (error.status === 404) {
        const notFound = new Error(`${TRANSLATIONS[version].name} does not carry ${book.name} ${chapter}:${verseNumber}.`);
        notFound.code = 'VERSE_NOT_FOUND';
        notFound.providerAttempts = [{ provider: 'api.bible', error: String(error.message || error) }];
        throw notFound;
      }
      error.providerAttempts = [{ provider: 'api.bible', error: String(error.message || error) }];
      throw mapApiBibleError(error, version);
    }
  }

  if (usesApiBible(version) && apiBibleKey() && apiBibleIdOverride(version)) {
    try {
      return await fetchApiBibleVerse(version, book, chapter, verseNumber);
    } catch (error) {
      if (error.status === 404) {
        const notFound = new Error(`${TRANSLATIONS[version].name} does not carry ${book.name} ${chapter}:${verseNumber}.`);
        notFound.code = 'VERSE_NOT_FOUND';
        throw notFound;
      }
      // Fall through to the chapter route, which owns its own fallbacks.
    }
  }

  const data = await fetchChapter(version, book, chapter);
  const verse = data.verses.find(item => item.verse === verseNumber);
  if (!verse) {
    const error = new Error(`${TRANSLATIONS[version].name} does not carry ${book.name} ${chapter}:${verseNumber}.`);
    error.code = 'VERSE_NOT_FOUND';
    throw error;
  }
  return {
    reference: `${book.name} ${chapter}:${verseNumber}`,
    bookId: book.id,
    chapter,
    verse: verseNumber,
    translation: version,
    translationName: TRANSLATIONS[version].name,
    copyright: data.copyright,
    text: verse.text,
    provider: data.provider,
    fallbackUsed: data.fallbackUsed
  };
}

async function fetchApiBibleSearch(version, query, limit) {
  const resolved = await resolveBibleId(version);
  const url = `${API_BIBLE_BASE}/bibles/${encodeURIComponent(resolved.bibleId)}/search?query=${encodeURIComponent(query)}&limit=${limit}&sort=canonical&fuzziness=0`;
  const json = await httpsGet(url, { 'api-key': apiBibleKey() }, { timeoutMs: API_BIBLE_TIMEOUT_MS });
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
  if (apiBibleOnly(version)) {
    if (!apiBibleKey()) throw missingKeyError(version);
    try {
      return await fetchApiBibleSearch(version, query, limit);
    } catch (error) {
      error.providerAttempts = [{ provider: 'api.bible', error: String(error.message || error) }];
      throw mapApiBibleError(error, version);
    }
  }

  if (usesApiBible(version) && apiBibleKey() && apiBibleIdOverride(version)) {
    try { return await fetchApiBibleSearch(version, query, limit); }
    catch (error) { /* fall back to the mirror search below */ }
  }
  if (TRANSLATIONS[version].bolls) return fetchBollsSearch(version, query, limit);
  const error = new Error(`${TRANSLATIONS[version].name} search is unavailable`);
  error.providerAttempts = [];
  throw error;
}

/* ---------------------------------------------------------------------------
 * Status
 * ------------------------------------------------------------------------- */

/* The sources that will actually be tried for this edition right now. NIV and
   MSG always list api.bible; the optional licensed feed (NLT) only counts when
   its Bible ID is pinned, because otherwise the mirror is what answers. */
function providerList(version) {
  const providers = [];
  if (apiBibleOnly(version) || (usesApiBible(version) && apiBibleKey() && apiBibleIdOverride(version))) {
    providers.push('api.bible');
  }
  if (GETBIBLE_EXACT_EDITIONS.has(version)) providers.push('GetBible.net');
  if (TRANSLATIONS[version].bolls) providers.push('Bolls.life');
  return providers;
}

async function statusPayload(version) {
  const edition = TRANSLATIONS[version];
  const required = apiBibleOnly(version);
  const providers = providerList(version);
  // An edition that is not switched on carries the free Starter-plan steps, so
  // the reader (and the owner reading over their shoulder) can see how to fix
  // it without hunting through the deployment docs.
  const finish = value => (value.configured ? value : Object.assign(value, { setup: setupPayload(version) }));
  const payload = {
    ok: true,
    translation: version,
    translationName: edition.name,
    // NIV and MSG have no other source, so only they can be unconfigured.
    configured: !required,
    providers,
    provider: providers[0] || null,
    apiBible: usesApiBible(version),
    apiBibleRequired: required,
    getBibleFallbackAvailable: GETBIBLE_EXACT_EDITIONS.has(version),
    getBibleCode: edition.getBibleCode,
    bibleId: null,
    bibleIdSource: null,
    copyright: edition.copyright,
    message: ''
  };
  if (!usesApiBible(version)) return payload;
  if (!apiBibleKey()) {
    if (required) {
      const error = missingKeyError(version);
      payload.configured = false;
      payload.message = error.message;
      payload.detail = error.detail;
    }
    return finish(payload);
  }
  if (!required && !apiBibleIdOverride(version)) {
    // Optional licensed feed without a pinned ID: the mirror answers, and the
    // account is not queried for this edition at all.
    payload.message = `API.Bible is optional for ${edition.name}; set ${edition.apiBibleEnv} to read it from the licensed feed instead of the mirror.`;
    return payload;
  }
  try {
    const resolved = await resolveBibleId(version);
    payload.bibleId = resolved.bibleId;
    payload.bibleIdSource = resolved.source;
    payload.configured = true;
  } catch (error) {
    payload.message = String(error && error.message || 'API.Bible is not configured for this translation.');
    if (error && error.detail) payload.detail = error.detail;
    if (required) payload.configured = false;
  }
  return finish(payload);
}

/* The owner-facing check: which Bible IDs this account resolves for the
   translations that use API.Bible, without exposing the whole catalogue. */
async function biblesPayload() {
  const payload = {
    ok: true,
    provider: 'api.bible',
    endpoint: API_BIBLE_LISTING_URL,
    translations: {},
    message: ''
  };
  if (!apiBibleKey()) {
    payload.ok = false;
    payload.message = 'No API.Bible key is configured on this server. A Bible ID, including MSG_BIBLE_ID, cannot replace the required key. Set BIBLE_API_KEY in Vercel and redeploy.';
    return payload;
  }
  const versions = Object.keys(TRANSLATIONS).filter(usesApiBible);
  await Promise.all(versions.map(async version => {
    try {
      const resolved = await resolveBibleId(version);
      payload.translations[version] = {
        available: true,
        bibleId: resolved.bibleId,
        source: resolved.source,
        name: resolved.name || TRANSLATIONS[version].name
      };
    } catch (error) {
      payload.translations[version] = {
        available: false,
        bibleId: null,
        source: null,
        message: String(error && error.message || 'unavailable'),
        detail: error && error.detail ? error.detail : undefined
      };
    }
  }));
  return payload;
}

/* The owner-facing setup answer for one edition: current state plus the free
   steps. Works with no key at all — that is the case it is written for. */
async function setupAction(version) {
  const status = await statusPayload(version);
  const edition = TRANSLATIONS[version];
  const payload = {
    ok: true,
    action: 'setup',
    translation: version,
    translationName: edition.name,
    apiBible: usesApiBible(version),
    required: apiBibleOnly(version),
    configured: status.configured,
    providers: status.providers,
    bibleId: status.bibleId || null,
    bibleIdSource: status.bibleIdSource || null,
    copyright: edition.copyright,
    message: '',
    detail: status.detail || ''
  };
  if (!usesApiBible(version)) {
    payload.message = `${edition.name} needs no API.Bible key: it is read from ${status.providers.join(', ') || 'the bundled public-domain files'}. There is nothing to set up.`;
    return payload;
  }
  payload.free = freePlan(version);
  payload.setup = setupPayload(version);
  payload.message = status.configured
    ? `${edition.name} is already switched on${status.bibleId ? ` (Bible ID ${status.bibleId})` : ''}. The free steps below are kept for when the key or the plan has to be set up again.`
    : `${edition.name} is not switched on yet. The free API.Bible Starter plan covers it — ${freePlan(version).steps.length} steps, no payment.`;
  return payload;
}

function providerLabel(attempt) {
  if (typeof attempt === 'string') return attempt.split(':')[0];
  return attempt && attempt.provider;
}

/* Reader-facing codes this function raises itself, with their status. The
   message on the error already explains what the owner or reader can do. */
const EXPLAINED_ERROR_STATUS = {
  TRANSLATION_NOT_CONFIGURED: 503,
  TRANSLATION_NOT_IN_ACCOUNT: 451,
  API_KEY_REJECTED: 502,
  TRANSLATION_NOT_LICENSED: 451,
  BIBLE_NOT_FOUND: 502,
  RATE_LIMITED: 503,
  CHAPTER_FORMAT_UNSUPPORTED: 502
};

/* Failures the owner can fix (a missing key, a translation that is not on the
   plan, a spent call allowance) carry the free Starter-plan steps, so the
   reader can show the owner what to do without a second request. */
const OWNER_ACTION_CODES = new Set([
  'TRANSLATION_NOT_CONFIGURED',
  'TRANSLATION_NOT_IN_ACCOUNT',
  'TRANSLATION_NOT_LICENSED',
  'API_KEY_REJECTED',
  'BIBLE_NOT_FOUND',
  'RATE_LIMITED'
]);

function failureBody(version, error, fallbackCode, fallbackMessage) {
  const code = error && (error.readerCode || (error.code && EXPLAINED_ERROR_STATUS[error.code] ? error.code : null));
  const explained = code && EXPLAINED_ERROR_STATUS[code] ? code : null;
  const body = {
    ok: false,
    translation: version,
    translationName: TRANSLATIONS[version].name,
    copyright: TRANSLATIONS[version].copyright,
    error: explained || fallbackCode,
    message: explained ? error.message : fallbackMessage,
    detail: explained && error.detail ? error.detail : undefined,
    providersTried: (error && error.providerAttempts || []).map(providerLabel)
  };
  if (explained && OWNER_ACTION_CODES.has(explained) && usesApiBible(version)) {
    body.setup = setupPayload(version);
  }
  return {
    status: explained ? (error.readerCode ? error.httpStatus || EXPLAINED_ERROR_STATUS[explained] : EXPLAINED_ERROR_STATUS[explained]) : 502,
    body
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' });

  const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const action = requestUrl.searchParams.get('action') || 'status';

  if (action === 'bibles') {
    const payload = await biblesPayload();
    return send(res, payload.ok ? 200 : 503, payload);
  }

  const version = getVersion(requestUrl.searchParams.get('version'));
  if (!version) {
    return send(res, 400, {
      ok: false,
      error: 'UNSUPPORTED_TRANSLATION',
      message: 'Choose one of the supported Bible versions: NIV, KJV, NLT, ESV or MSG.'
    });
  }

  if (action === 'status') return send(res, 200, await statusPayload(version));

  if (action === 'setup') return send(res, 200, await setupAction(version));

  if (action === 'books') {
    const bundled = {
      ok: true,
      translation: version,
      translationName: TRANSLATIONS[version].name,
      source: 'bundled',
      books: BOOKS.map(book => ({ id: book.id, name: book.name, chapters: book.ch, osis: book.osis }))
    };
    // API.Bible editions list their own books; the canonical list is the
    // fallback so the endpoint never fails outright.
    if (usesApiBible(version) && apiBibleKey()) {
      try {
        const books = await fetchApiBibleBooks(version);
        return send(res, 200, {
          ok: true,
          translation: version,
          translationName: TRANSLATIONS[version].name,
          source: 'api.bible',
          provider: 'api.bible',
          books
        });
      } catch (error) {
        return send(res, 200, Object.assign(bundled, {
          warning: String(error && error.message || 'API.Bible book list unavailable')
        }));
      }
    }
    return send(res, 200, bundled);
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
      const failure = failureBody(version, error, 'TRANSLATION_UNAVAILABLE',
        `${TRANSLATIONS[version].name} is temporarily unavailable right now. Prayer Dome has not substituted a different translation. Please try again shortly.`);
      return send(res, failure.status, failure.body);
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
      const failure = failureBody(version, error, 'SEARCH_UNAVAILABLE',
        `${TRANSLATIONS[version].name} search is temporarily unavailable. No other translation has been substituted. Please try again shortly.`);
      return send(res, failure.status, failure.body);
    }
  }

  if (action === 'verse') {
    const reference = requestUrl.searchParams.get('ref') || '';
    const parsed = parseReference(reference);
    if (!parsed || !parsed.verse) {
      return send(res, 400, { ok: false, error: 'INVALID_REFERENCE', message: 'Use a reference such as John 3:16.' });
    }
    try {
      const data = await fetchVerse(version, parsed.book, parsed.chapter, parsed.verse);
      return send(res, 200, Object.assign({ ok: true }, data));
    } catch (error) {
      if (error && error.code === 'VERSE_NOT_FOUND') {
        return send(res, 404, { ok: false, error: 'VERSE_NOT_FOUND', translation: version, message: error.message });
      }
      const failure = failureBody(version, error, 'TRANSLATION_UNAVAILABLE',
        `${TRANSLATIONS[version].name} is temporarily unavailable right now. No other translation has been substituted.`);
      return send(res, failure.status, failure.body);
    }
  }

  return send(res, 400, { ok: false, error: `Unknown action: ${action}` });
};

module.exports.TRANSLATIONS = TRANSLATIONS;
module.exports.GETBIBLE_EXACT_EDITIONS = GETBIBLE_EXACT_EDITIONS;
module.exports.USFM = USFM;
module.exports.NIV_DOCUMENTED_BIBLE_ID = NIV_DOCUMENTED_BIBLE_ID;
module.exports._normalizeGetBibleChapter = normalizeGetBibleChapter;
module.exports._normalizeVerses = normalizeVerses;
module.exports._parseApiBibleHtml = parseApiBibleHtml;
module.exports._matchBibleFromListing = matchBibleFromListing;
module.exports._bibleMatchRank = bibleMatchRank;
module.exports._isValidBibleId = isValidBibleId;
module.exports._apiBibleIdOverride = apiBibleIdOverride;
module.exports._apiBibleKey = apiBibleKey;
module.exports._resolveBibleId = resolveBibleId;
module.exports._usesApiBible = usesApiBible;
module.exports._resetCaches = resetCaches;
module.exports._freePlan = freePlan;
module.exports._setupPayload = setupPayload;
module.exports._stripStrongs = stripStrongs;
module.exports._decodeText = decodeText;
module.exports._parseReference = parseReference;
module.exports._getVersion = getVersion;
