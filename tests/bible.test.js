'use strict';

/* Version-aware Bible API and reader regression checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const EventEmitter = require('node:events');
const https = require('node:https');

delete process.env.NIV_API_KEY;
delete process.env.BIBLE_API_KEY;

const handler = require('../api/bible.js');
const ROOT = path.join(__dirname, '..');
let pass = 0;
let fail = 0;
function t(name, condition, detail = '') {
  if (condition) pass += 1;
  else fail += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
}

function responseStub() {
  const response = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = value || ''; }
  };
  return response;
}

async function invoke(url, method = 'GET') {
  const response = responseStub();
  await handler({
    method,
    url,
    headers: { host: 'prayerdome.net' }
  }, response);
  let json = null;
  if (response.body) json = JSON.parse(response.body);
  return { status: response.statusCode, headers: response.headers, json };
}

async function withHttpsResponses(fixtures, run) {
  const realRequest = https.request;
  const requests = [];
  https.request = (options, onResponse) => {
    requests.push(`https://${options.hostname}${options.path}`);
    const request = new EventEmitter();
    request.setTimeout = () => request;
    request.destroy = error => {
      process.nextTick(() => request.emit('error', error));
      return request;
    };
    request.end = () => {
      const fixture = fixtures.shift();
      process.nextTick(() => {
        if (!fixture) {
          request.emit('error', new Error('No HTTP fixture configured'));
          return;
        }
        const response = new EventEmitter();
        response.statusCode = fixture.status || 200;
        onResponse(response);
        const body = typeof fixture.body === 'string' ? fixture.body : JSON.stringify(fixture.body);
        response.emit('data', Buffer.from(body));
        response.emit('end');
      });
    };
    return request;
  };
  try {
    return await run(requests);
  } finally {
    https.request = realRequest;
  }
}

(async function main() {
  const codes = Object.keys(handler.TRANSLATIONS);
  t('all five exact Bible versions are registered', codes.join(',') === 'NIV,KJV,NLT,ESV,MSG', codes.join('/'));
  t('GetBible fallback is restricted to exact editions it actually publishes',
    handler.GETBIBLE_EXACT_EDITIONS.size === 1 && handler.GETBIBLE_EXACT_EDITIONS.has('KJV'));
  t('a normal Bible reference resolves to the correct book and verse',
    (function () {
      const parsed = handler._parseReference('John 3:16');
      return !!parsed && parsed.book.id === 43 && parsed.chapter === 3 && parsed.verse === 16;
    })());
  t('numbered books and multi-word book names parse correctly',
    handler._parseReference('1 John 3:16').book.id === 62 &&
    handler._parseReference('Song of Solomon 2:1').book.id === 22);

  const book = { id: 43, name: 'John', ch: 21 };
  const kjvChapter = {
    abbreviation: 'kjv',
    book_nr: 43,
    chapter: 3,
    verses: [{ chapter: 3, verse: 16, text: 'For God so loved the world.' }]
  };
  const normalizedKjv = handler._normalizeGetBibleChapter(kjvChapter, 'KJV', book, 3);
  t('GetBible chapters normalize with the requested edition and passage metadata',
    normalizedKjv.translation === 'KJV' && normalizedKjv.bookId === 43 &&
    normalizedKjv.chapter === 3 && normalizedKjv.verses[0].verse === 16);
  let mismatchedEditionRejected = false;
  try { handler._normalizeGetBibleChapter(kjvChapter, 'NLT', book, 3); }
  catch (error) { mismatchedEditionRejected = /not NLT/.test(error.message); }
  t('a GetBible response for the wrong edition is rejected, never relabelled', mismatchedEditionRejected);
  let mismatchedPassageRejected = false;
  try { handler._normalizeGetBibleChapter({ ...kjvChapter, book_nr: 1 }, 'KJV', book, 3); }
  catch (error) { mismatchedPassageRejected = /different passage/.test(error.message); }
  t('a GetBible response for a different book or chapter is rejected', mismatchedPassageRejected);

  const status = await invoke('/api/bible?action=status&version=MSG');
  t('status reports the selected version instead of forcing NIV',
    status.status === 200 && status.json.translation === 'MSG' &&
    status.json.translationName === 'The Message');
  t('status clearly reports the current GetBible coverage',
    status.json.getBibleFallbackAvailable === false && status.json.providers.includes('Bolls.life'));
  const nivStatus = await invoke('/api/bible?action=status&version=NIV');
  t('NIV is not marked ready without its authorized api.bible key',
    nivStatus.status === 200 && nivStatus.json.configured === false &&
    !nivStatus.json.providers.includes('Bolls.life') && /NIV_API_KEY/.test(nivStatus.json.message));
  const nivWithoutKey = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
  t('NIV never uses the blocked Bolls route or a different translation when unconfigured',
    nivWithoutKey.status === 503 && nivWithoutKey.json.error === 'NIV_NOT_CONFIGURED' &&
    /not substitute/.test(nivWithoutKey.json.message));
  const unsupported = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=AMP');
  t('unsupported version codes are rejected before any provider call',
    unsupported.status === 400 && unsupported.json.error === 'UNSUPPORTED_TRANSLATION');

  const bollsFixture = [{ verse: 1, text: 'In the <b>beginning</b> &amp; beyond.' }];
  await withHttpsResponses([{ body: bollsFixture }], async requests => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NLT');
    t('Bolls chapters preserve the requested version and are HTML-cleaned',
      result.status === 200 && result.json.translation === 'NLT' &&
      result.json.translationName === 'New Living Translation' &&
      result.json.verses[0].text === 'In the beginning & beyond.');
    t('each Bolls chapter URL is pinned to its requested translation code (get-text, no commentary)',
      requests.length === 1 && requests[0].includes('/get-text/NLT/43/3/'));
  });

  t('the NIV Bible ID is the api.bible NIV edition, not the KJV edition',
    handler.NIV_BIBLE_ID_DEFAULT === '78a9f6124f344018-01' && handler._apiBibleIdFor('NIV') === '78a9f6124f344018-01');
  t('the NIV Bible ID can be overridden only by configuration', (function () {
    process.env.NIV_BIBLE_ID = 'test-override';
    const value = handler._apiBibleIdFor('NIV');
    delete process.env.NIV_BIBLE_ID;
    return value === 'test-override';
  })());

  // KJV: GetBible is the exact-edition primary; Bolls is the cleaned fallback.
  await withHttpsResponses([{ body: kjvChapter }], async requests => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=KJV');
    t('KJV is served by the exact GetBible edition first',
      result.status === 200 && result.json.provider === 'GetBible.net' && result.json.fallbackUsed === false);
    t('KJV primary request is the exact GetBible v2 edition and passage',
      requests.length === 1 && requests[0] === 'https://api.getbible.net/v2/kjv/43/3.json');
  });

  await withHttpsResponses([
    { status: 503, body: { message: 'primary temporarily unavailable' } },
    { body: [{ verse: 1, text: '1161 There was2258 a man444 of1537 the Pharisees5330, named3686 846 Nicodemus3530.' }] }
  ], async requests => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=KJV');
    t('KJV falls back to the Bolls KJV feed with Strong\'s numbers removed',
      result.status === 200 && result.json.provider === 'Bolls.life' && result.json.fallbackUsed === true &&
      result.json.verses[0].text === 'There was a man of the Pharisees, named Nicodemus.');
    t('KJV fallback is requested from the Bolls KJV feed only',
      requests[1] === 'https://bolls.life/get-text/KJV/43/3/');
  });

  await withHttpsResponses([
    { status: 503, body: { message: 'primary temporarily unavailable' } },
    { status: 503, body: { message: 'fallback temporarily unavailable' } }
  ], async () => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=KJV');
    t('a mismatched or unavailable KJV feed is never substituted under another label',
      result.status === 502 && result.json.translation === 'KJV' &&
      result.json.error === 'TRANSLATION_UNAVAILABLE' && /not substituted/.test(result.json.message));
  });
  await withHttpsResponses([
    { body: { ...kjvChapter, abbreviation: 'nlt' } },
    { status: 503, body: {} }
  ], async () => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=KJV');
    t('a GetBible response for another edition is rejected before it reaches the reader',
      result.status === 502 && result.json.translation === 'KJV' && result.json.error === 'TRANSLATION_UNAVAILABLE');
  });

  // NIV through api.bible: the chapter request, the response guard and the parser.
  const nivChapter = {
    data: {
      id: 'JHN.3',
      bibleId: '78a9f6124f344018-01',
      reference: 'John 3',
      copyright: 'Scripture quotations taken from The Holy Bible, New International Version® NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.®',
      content: '<p class="p"><span data-number="1" data-sid="JHN 3:1" class="v">1</span>Now there was a Pharisee named Nicodemus.</p>' +
        '<p class="p"><span data-number="2" data-sid="JHN 3:2" class="v">2</span>He came to Jesus by night. <span class="note">x</span></p>' +
        '<p class="p"><span data-number="3" data-sid="JHN 3:3" class="v">3</span>Jesus replied, <span class="wj">Very truly</span> I tell you.</p>'
    }
  };
  process.env.NIV_API_KEY = 'test-key-not-real';
  await withHttpsResponses([{ body: nivChapter }], async requests => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    t('NIV chapters come from api.bible with the NIV edition ID and USFM chapter ID',
      requests.length === 1 && requests[0] === 'https://rest.api.bible/v1/bibles/78a9f6124f344018-01/chapters/JHN.3?content-type=html&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true',
      requests[0]);
    t('NIV chapters are labelled NIV with their verses in order',
      result.status === 200 && result.json.translation === 'NIV' && result.json.provider === 'api.bible' &&
      result.json.verses.length === 3 && result.json.verses[2].text === 'Jesus replied, Very truly I tell you.');
    t('the API key is never echoed in a response',
      !JSON.stringify(result.json).includes('test-key-not-real'));
  });
  await withHttpsResponses([{ body: { data: { ...nivChapter.data, bibleId: 'de4e12af7f28f599-01', copyright: 'King James Version' } } }], async () => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    t('api.bible text for a different Bible ID is rejected and never shown as NIV',
      result.status === 502 && result.json.error === 'TRANSLATION_UNAVAILABLE');
  });
  await withHttpsResponses([{ body: { data: { ...nivChapter.data, copyright: 'Some other copyright' } } }], async () => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    t('api.bible text without the NIV copyright line is rejected',
      result.status === 502);
  });
  t('out-of-sequence verses are rejected rather than shown out of order', (function () {
    try { handler._parseApiBibleHtml('<span class="v" data-number="1">1</span>a <span class="v" data-number="3">3</span>b'); return false; }
    catch (error) { return /out of sequence/.test(error.message); }
  })());
  delete process.env.NIV_API_KEY;

  // Bolls search uses the current v2 find endpoint and returns verse references.
  await withHttpsResponses([{ body: { exact_matches: 1, total: 1, results: [{ pk: 1, translation: 'NLT', book: 43, chapter: 3, verse: 16, text: 'For God so loved the world…' }] } }], async requests => {
    const result = await invoke('/api/bible?action=search&q=loved&version=NLT');
    t('search uses the Bolls v2 find endpoint for the requested edition',
      requests[0].startsWith('https://bolls.life/v2/find/NLT?search=loved'));
    t('search results carry the book, chapter and verse reference',
      result.status === 200 && result.json.verses[0].reference === 'John 3:16' && result.json.translation === 'NLT');
  });
  await withHttpsResponses([{ body: { results: [{ book: 43, chapter: 3, verse: 16, text: 'For God so loved the world.' }] } }], async () => {
    const result = await invoke('/api/bible?action=search&q=loved&version=NIV');
    t('NIV search without a configured api.bible key reports NIV_NOT_CONFIGURED instead of using another source',
      result.status === 503 && result.json.error === 'NIV_NOT_CONFIGURED');
  });

  const html = fs.readFileSync(path.join(ROOT, 'bible.html'), 'utf8');
  t('the Bible reader exposes NIV, KJV, NLT, ESV and MSG controls',
    ['NIV', 'KJV', 'NLT', 'ESV', 'MSG'].every(code =>
      html.includes(`data-version="${code}"`) && html.includes(`setVersion('${code}')`)));
  t('chapter and search requests send the selected version to the API',
    /action=chapter[^`]*version=/.test(html) && /action=search[^`]*version=/.test(html));
  t('reader typography is fluid and prevents horizontal overflow',
    /font-size:\s*clamp\(/.test(html) && /overflow-wrap:\s*anywhere/.test(html) &&
    /overflow-x:\s*hidden/.test(html));
  t('text-size controls persist the reader preference and keep A-/A/A+ labels',
    html.includes("pd_bible_textsize") && html.includes('>A-</button>') &&
    html.includes('>A</button>') && html.includes('>A+</button>'));
  t('chapter metadata and the translation copyright are rendered',
    html.includes('chapter-translation') && html.includes('bible-copyright') &&
    html.includes('BIBLE_VERSIONS[code].copyright'));
  t('the curated daily verse library remains explicitly NIV (separate from the reader)',
    fs.readFileSync(path.join(ROOT, 'assets/pd-verse-data.js'), 'utf8').includes('Daily Verse Library (NIV)'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
