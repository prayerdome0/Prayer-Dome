'use strict';

/* Version-aware Bible API and reader regression checks.
   NIV and MSG are read from API.Bible with the account's key and Bible IDs.
   Every other translation keeps the source it had before. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const EventEmitter = require('node:events');
const https = require('node:https');

for (const name of ['BIBLE_API_KEY', 'NIV_API_KEY', 'API_BIBLE_KEY', 'NIV_BIBLE_ID', 'MSG_BIBLE_ID', 'NLT_BIBLE_ID']) {
  delete process.env[name];
}

const handler = require('../api/bible.js');
const ROOT = path.join(__dirname, '..');
const TEST_KEY = 'test-key-not-real';
const NIV_ID = handler.NIV_DOCUMENTED_BIBLE_ID;
const MSG_ID = 'e2f4b1e15d7d0b8f-01';
let pass = 0;
let fail = 0;
function t(name, condition, detail = '') {
  if (condition) pass += 1;
  else fail += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
}

function responseStub() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = value || ''; }
  };
}

async function invoke(url, method = 'GET') {
  const response = responseStub();
  await handler({ method, url, headers: { host: 'prayerdome.net' } }, response);
  let json = null;
  if (response.body) json = JSON.parse(response.body);
  return { status: response.statusCode, headers: response.headers, body: response.body, json };
}

/* Replaces https.request for one case. Each fixture renders one provider call:
     { status, body }  normal response (status defaults to 200)
     { error }         connection failure
     { hang: true }    a request that never answers until the timeout fires   */
async function withHttpsResponses(fixtures, run) {
  const realRequest = https.request;
  const requests = [];
  https.request = (options, onResponse) => {
    requests.push({ url: `https://${options.hostname}${options.path}`, headers: options.headers || {} });
    const request = new EventEmitter();
    request.timeoutHandler = null;
    request.setTimeout = (ms, callback) => { request.timeoutHandler = callback; return request; };
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
        if (fixture.error) {
          request.emit('error', new Error(fixture.error));
          return;
        }
        if (fixture.hang) {
          if (typeof request.timeoutHandler === 'function') request.timeoutHandler();
          else request.emit('error', new Error('Bible provider request timed out'));
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

/* A chapter as api.bible returns it: every verse marked in order from 1. */
function apiBibleChapterFixture(chapterId, bibleId, texts, copyright, reference) {
  const content = texts.map((text, index) => {
    const number = index + 1;
    return `<span data-number="${number}" class="v">${number}</span>${text} `;
  }).join('');
  return {
    data: {
      id: chapterId,
      bibleId,
      bookId: chapterId.split('.')[0],
      chapterId,
      reference,
      content,
      copyright
    }
  };
}

/* Verse texts for a chapter, overriding the verses a case cares about. */
function verseTexts(count, overrides) {
  return Array.from({ length: count }, (_, index) =>
    (overrides && overrides[index + 1]) || `Verse ${index + 1}.`);
}

function listingFixture(entries) {
  return {
    data: entries.map(entry => ({
      id: entry.id,
      abbreviation: entry.abbreviation,
      abbreviationLocal: entry.abbreviationLocal,
      name: entry.name,
      nameLocal: entry.nameLocal
    }))
  };
}

const NIV_COPYRIGHT = 'The Holy Bible, New International Version®, NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.® Used by permission. All rights reserved worldwide.';
const MSG_COPYRIGHT = 'The Message, copyright © 1993, 2002, 2018 by Eugene H. Peterson. All rights reserved.';

function setConfigured(version, id) {
  process.env.BIBLE_API_KEY = TEST_KEY;
  if (version === 'NIV') process.env.NIV_BIBLE_ID = id || NIV_ID;
  if (version === 'MSG') process.env.MSG_BIBLE_ID = id || MSG_ID;
  handler._resetCaches();
}

function clearConfiguration() {
  for (const name of ['BIBLE_API_KEY', 'NIV_API_KEY', 'API_BIBLE_KEY', 'NIV_BIBLE_ID', 'MSG_BIBLE_ID', 'NLT_BIBLE_ID']) {
    delete process.env[name];
  }
  handler._resetCaches();
}

(async function main() {
  /* ---------------------------------------------------------------- registry */
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

  /* ------------------------------------------------- NIV and MSG are api.bible */
  t('NIV is an API.Bible edition with no mirror fallback',
    handler.TRANSLATIONS.NIV.apiBibleOnly === true && handler.TRANSLATIONS.NIV.bolls === null &&
    handler.TRANSLATIONS.NIV.getBibleCode === null && handler._usesApiBible('NIV'));
  t('MSG is an API.Bible edition with no mirror fallback',
    handler.TRANSLATIONS.MSG.apiBibleOnly === true && handler.TRANSLATIONS.MSG.bolls === null &&
    handler._usesApiBible('MSG'));
  t('the other translations keep their free sources',
    handler.TRANSLATIONS.KJV.getBibleCode === 'kjv' && handler.TRANSLATIONS.KJV.bolls === 'KJV' &&
    handler.TRANSLATIONS.ESV.bolls === 'ESV' && handler.TRANSLATIONS.NLT.bolls === 'NLT' &&
    handler.TRANSLATIONS.NLT.apiBibleEnv === 'NLT_BIBLE_ID');

  /* ------------------------------------------------------------ Bible IDs */
  clearConfiguration();
  process.env.NIV_BIBLE_ID = NIV_ID;
  handler._resetCaches();
  const overrideResolution = await handler._resolveBibleId('NIV');
  t('an explicit NIV_BIBLE_ID is used as given, without a listing call',
    overrideResolution.bibleId === NIV_ID && overrideResolution.source === 'environment');

  handler._resetCaches();
  process.env.BIBLE_API_KEY = TEST_KEY;
  delete process.env.NIV_BIBLE_ID;
  handler._resetCaches();
  await withHttpsResponses([{ status: 503, body: { message: 'listing unavailable' } }], async requests => {
    const resolution = await handler._resolveBibleId('NIV');
    t('when the account listing is unreachable, NIV uses the ID published in the API.Bible docs',
      resolution.bibleId === NIV_ID && resolution.source === 'documented-default',
      `${resolution.bibleId}/${resolution.source}`);
    t('the documented fallback is still requested from the account endpoint',
      requests[0].url === 'https://rest.api.bible/v1/bibles?language=eng');
  });

  clearConfiguration();
  process.env.BIBLE_API_KEY = TEST_KEY;
  handler._resetCaches();
  await withHttpsResponses([{ error: 'getaddrinfo ENOTFOUND rest.api.bible' }], async () => {
    let error = null;
    try { await handler._resolveBibleId('MSG'); } catch (caught) { error = caught; }
    t('an MSG ID is never invented when the account list cannot be reached',
      !!error && error.code === 'TRANSLATION_NOT_CONFIGURED' &&
      /Bible ID could not be resolved right now/.test(error.message) &&
      /No other translation has been substituted/.test(error.message) &&
      /MSG_BIBLE_ID/.test(error.detail));
  });

  clearConfiguration();
  process.env.BIBLE_API_KEY = TEST_KEY;
  handler._resetCaches();
  await withHttpsResponses([{
    body: listingFixture([
      { id: 'de4e12af7f28f599-01', abbreviation: 'engKJV', abbreviationLocal: 'KJV', name: 'King James (Authorised) Version' },
      { id: 'ffffffffffffffff-01', abbreviation: 'NIV', abbreviationLocal: 'NIV', name: 'New International Version' },
      { id: 'e2f4b1e15d7d0b8f-01', abbreviation: 'MSG', abbreviationLocal: 'MSG', name: 'The Message' }
    ])
  }], async () => {
    const niv = await handler._resolveBibleId('NIV');
    const msg = await handler._resolveBibleId('MSG');
    t('the account listing decides the NIV Bible ID, not a hard-coded guess',
      niv.bibleId === 'ffffffffffffffff-01' && niv.source === 'account-listing', niv.bibleId);
    t('the account listing decides The Message Bible ID',
      msg.bibleId === MSG_ID && msg.source === 'account-listing', msg.bibleId);
  });

  clearConfiguration();
  process.env.BIBLE_API_KEY = TEST_KEY;
  handler._resetCaches();
  await withHttpsResponses([{
    body: listingFixture([{ id: NIV_ID, abbreviation: 'NIV', abbreviationLocal: 'NIV', name: 'New International Version' }])
  }], async () => {
    let error = null;
    try { await handler._resolveBibleId('MSG'); } catch (caught) { error = caught; }
    t('an MSG ID is never guessed when the account does not list The Message',
      !!error && error.code === 'TRANSLATION_NOT_IN_ACCOUNT' &&
      /not available through this site's API.Bible account/.test(error.message) &&
      /No other translation has been substituted/.test(error.message) &&
      /Add this translation to your API.Bible plan/.test(error.detail));
  });

  clearConfiguration();
  process.env.BIBLE_API_KEY = TEST_KEY;
  process.env.MSG_BIBLE_ID = 'not-a-bible-id';
  handler._resetCaches();
  let invalidId = null;
  try { await handler._resolveBibleId('MSG'); } catch (caught) { invalidId = caught; }
  t('a malformed Bible ID is rejected before any provider request',
    !!invalidId && invalidId.code === 'TRANSLATION_NOT_CONFIGURED' && /not a valid API\.Bible Bible ID/.test(invalidId.message));

  /* -------------------------------------------------- NIV chapters via API.Bible */
  clearConfiguration();
  setConfigured('NIV');
  await withHttpsResponses([
    {
      body: apiBibleChapterFixture('JHN.3', NIV_ID, verseTexts(17, {
        16: 'For God so loved <b>the world</b> &amp; everyone in it.',
        17: 'God did not send his Son to condemn the world.'
      }), NIV_COPYRIGHT, 'John 3')
    }
  ], async requests => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    t('NIV loads a chapter from API.Bible',
      result.status === 200 && result.json.translation === 'NIV' &&
      result.json.translationName === 'New International Version' &&
      result.json.verses.length === 17 &&
      result.json.verses[15].text === 'For God so loved the world & everyone in it.',
      JSON.stringify(result.json).slice(0, 160));
    t('NIV chapter requests hit the configured account Bible ID with the documented query',
      requests.length === 1 &&
      requests[0].url.startsWith(`https://rest.api.bible/v1/bibles/${NIV_ID}/chapters/JHN.3?`) &&
      /content-type=html/.test(requests[0].url) && /include-verse-numbers=true/.test(requests[0].url));
    t('the API.Bible key travels in the api-key header, never in the URL',
      requests[0].headers['api-key'] === TEST_KEY && !requests[0].url.includes(TEST_KEY));
    t('the NIV copyright line comes back with the text',
      /New International Version/.test(result.json.copyright));
    t('the reader is told which provider served the chapter',
      result.json.provider === 'api.bible' && result.json.fallbackUsed === false);
  });

  handler._resetCaches();
  await withHttpsResponses([
    {
      body: apiBibleChapterFixture('JHN.3', NIV_ID, verseTexts(2, { 1: 'There was a man.' }), NIV_COPYRIGHT, 'John 3')
    }
  ], async requests => {
    const first = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    const second = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    t('a repeated chapter read is served from the server cache, not the account quota',
      first.status === 200 && second.status === 200 && requests.length === 1 &&
      second.json.verses[0].text === 'There was a man.');
  });

  handler._resetCaches();
  await withHttpsResponses([
    { body: apiBibleChapterFixture('JHN.3', 'aaaaaaaaaaaaaaaa-01', verseTexts(1, { 1: 'Wrong Bible.' }), NIV_COPYRIGHT, 'John 3') }
  ], async () => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    t('an API.Bible response for a different Bible ID is rejected, never relabelled',
      result.status === 502 && result.json.translation === 'NIV' && !JSON.stringify(result.json).includes('Wrong Bible'));
  });

  handler._resetCaches();
  await withHttpsResponses([
    { body: apiBibleChapterFixture('JHN.3', NIV_ID, verseTexts(1, { 1: 'Wrong edition.' }), 'The Message, copyright © NavPress.', 'John 3') }
  ], async () => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    t('an API.Bible copyright line for another edition is rejected',
      result.status === 502 && !JSON.stringify(result.json).includes('Wrong edition.'));
  });

  /* ------------------------------------------------------------ MSG chapters */
  clearConfiguration();
  setConfigured('MSG');
  await withHttpsResponses([
    {
      body: apiBibleChapterFixture('JHN.3', MSG_ID, verseTexts(17, {
        16: 'This is how much God loved the world: He gave his Son.'
      }), MSG_COPYRIGHT, 'John 3')
    }
  ], async requests => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=MSG');
    t('MSG loads a chapter from API.Bible under its own label',
      result.status === 200 && result.json.translation === 'MSG' &&
      result.json.translationName === 'The Message' &&
      /The Message/.test(result.json.copyright) &&
      result.json.verses[15].text.indexOf('This is how much God loved the world') === 0,
      JSON.stringify(result.json).slice(0, 160));
    t('MSG requests the MSG Bible ID and never a Bolls.life mirror',
      requests.length === 1 && requests[0].url.includes(`/bibles/${MSG_ID}/chapters/JHN.3`) &&
      !requests.some(item => item.url.includes('bolls.life')));
  });

  handler._resetCaches();
  await withHttpsResponses([
    { status: 502, body: { message: 'mirror would have answered' } }
  ], async requests => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=MSG');
    t('MSG is never served from another provider when API.Bible fails',
      result.status === 502 && result.json.translation === 'MSG' && /not substituted/.test(result.json.message) &&
      requests.length === 1 && requests[0].url.includes('rest.api.bible'),
      JSON.stringify(result.json).slice(0, 160));
  });

  /* ------------------------------------------- configuration and access errors */
  clearConfiguration();
  await withHttpsResponses([{ body: { data: { content: 'never used' } } }], async requests => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    t('NIV without a key makes no provider request and shows readers an honest message',
      requests.length === 0 && result.status === 503 && result.json.error === 'TRANSLATION_NOT_CONFIGURED' &&
      /not configured on this server right now/.test(result.json.message) &&
      !/BIBLE_API_KEY/.test(result.json.message));
    t('the missing-key response tells the owner exactly what to set',
      /BIBLE_API_KEY/.test(result.json.detail) && /NIV_BIBLE_ID/.test(result.json.detail));
    t('no key material or provider payload is echoed back',
      !result.body.includes(TEST_KEY) && !JSON.stringify(result.json).includes('never used'));
  });

  clearConfiguration();
  process.env.MSG_BIBLE_ID = MSG_ID;
  handler._resetCaches();
  await withHttpsResponses([{ body: { data: { content: 'never used' } } }], async requests => {
    const status = await invoke('/api/bible?action=status&version=MSG');
    const chapter = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=MSG');
    t('MSG with only MSG_BIBLE_ID configured explains that the API.Bible key is also required',
      requests.length === 0 && status.status === 200 && status.json.configured === false &&
      /Bible ID is configured/.test(status.json.message) && /ID alone cannot authorize/.test(status.json.message) &&
      /BIBLE_API_KEY/.test(status.json.detail) && /redeploy/.test(status.json.detail));
    t('an MSG chapter with an ID but no API.Bible key returns a clear setup error without provider calls',
      requests.length === 0 && chapter.status === 503 &&
      chapter.json.error === 'TRANSLATION_NOT_CONFIGURED' &&
      /Bible ID is configured/.test(chapter.json.message) && /API.Bible server key is also required/.test(chapter.json.message));
  });

  clearConfiguration();
  setConfigured('MSG');
  await withHttpsResponses([{ status: 403, body: { message: 'You are not authorized to access this Bible' } }], async () => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=MSG');
    t('a 403 from API.Bible says the account is not licensed for that translation',
      result.status === 451 && result.json.error === 'TRANSLATION_NOT_LICENSED' &&
      /not licensed for The Message/.test(result.json.message) &&
      /No other translation has been substituted/.test(result.json.message));
    t('the not-licensed response tells the owner what access is needed',
      /Add The Message to the API.Bible account's plan/.test(result.json.detail) &&
      /contact API.Bible support/.test(result.json.detail));
    t('the provider body is not copied into the response',
      !result.body.includes('not authorized') && !result.body.includes(TEST_KEY));
  });

  clearConfiguration();
  setConfigured('NIV');
  await withHttpsResponses([{ status: 401, body: { message: 'Invalid API key' } }], async () => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    t('a rejected API.Bible key is reported as a configuration problem',
      result.status === 502 && result.json.error === 'API_KEY_REJECTED' &&
      /rejected this site's API key/.test(result.json.message) &&
      !/BIBLE_API_KEY/.test(result.json.message) &&
      /BIBLE_API_KEY/.test(result.json.detail) && !result.body.includes(TEST_KEY));
  });

  clearConfiguration();
  setConfigured('NIV');
  await withHttpsResponses([{ status: 404, body: { message: 'Bible not found' } }], async () => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    t('an unknown Bible ID is reported against the configured variable',
      result.status === 502 && result.json.error === 'BIBLE_NOT_FOUND' &&
      /no Bible with the configured ID/.test(result.json.message) && /NIV_BIBLE_ID/.test(result.json.detail));
  });

  clearConfiguration();
  setConfigured('NIV');
  await withHttpsResponses([{ status: 429, body: { message: 'Rate limit exceeded' } }], async () => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    t('the API.Bible call limit is reported without breaking the reader',
      result.status === 503 && result.json.error === 'RATE_LIMITED' && /call limit/.test(result.json.message));
  });

  clearConfiguration();
  setConfigured('NIV');
  await withHttpsResponses([{ hang: true }], async () => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    t('a provider timeout degrades gracefully instead of hanging or swapping text',
      result.status === 502 && result.json.translation === 'NIV' && /not substituted/.test(result.json.message));
  });

  clearConfiguration();
  setConfigured('NIV');
  await withHttpsResponses([{ error: 'socket hang up' }], async () => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    t('a dropped connection is reported as a temporary failure',
      result.status === 502 && result.json.error === 'TRANSLATION_UNAVAILABLE' && /Please try again/.test(result.json.message));
  });

  /* ------------------------------------------------------------ single verses */
  clearConfiguration();
  setConfigured('NIV');
  await withHttpsResponses([{
    body: { data: { id: 'JHN.3.16', bibleId: NIV_ID, reference: 'John 3:16', content: '<p>For God so loved the world.</p>', copyright: NIV_COPYRIGHT } }
  }], async requests => {
    const result = await invoke('/api/bible?action=verse&ref=John+3:16&version=NIV');
    t('NIV single verses use the API.Bible verse endpoint',
      result.status === 200 && result.json.reference === 'John 3:16' &&
      result.json.text === 'For God so loved the world.' && result.json.translation === 'NIV');
    t('the verse request is pinned to the account Bible ID and the USFM verse ID',
      requests[0].url.startsWith(`https://rest.api.bible/v1/bibles/${NIV_ID}/verses/JHN.3.16?`));
  });

  clearConfiguration();
  setConfigured('MSG');
  await withHttpsResponses([{ status: 404, body: { message: 'Verse not found' } }], async () => {
    const result = await invoke('/api/bible?action=verse&ref=John+3:99&version=MSG');
    t('a verse the edition does not carry reports a clean not-found, not an outage',
      result.status === 404 && result.json.error === 'VERSE_NOT_FOUND', JSON.stringify(result.json).slice(0, 120));
  });

  /* ----------------------------------------------------------------- searching */
  clearConfiguration();
  setConfigured('NIV');
  await withHttpsResponses([{
    body: {
      data: {
        total: 1,
        verses: [{
          id: 'JHN.3.16', bookId: 'JHN', chapterId: '3', verseId: '16',
          reference: 'John 3:16', text: 'For God <b>so</b> loved the world.'
        }]
      }
    }
  }], async requests => {
    const result = await invoke('/api/bible?action=search&q=loved&version=NIV');
    t('NIV search runs against API.Bible for the account Bible ID',
      requests[0].url.startsWith(`https://rest.api.bible/v1/bibles/${NIV_ID}/search?query=loved`) &&
      result.status === 200 && result.json.translation === 'NIV' &&
      result.json.verses[0].reference === 'John 3:16' && result.json.verses[0].text === 'For God so loved the world.');
  });

  clearConfiguration();
  const unconfiguredSearch = await invoke('/api/bible?action=search&q=loved&version=NIV');
  t('NIV search without a key explains the missing configuration',
    unconfiguredSearch.status === 503 && unconfiguredSearch.json.error === 'TRANSLATION_NOT_CONFIGURED' &&
    /BIBLE_API_KEY/.test(unconfiguredSearch.json.detail));

  /* -------------------------------------------------------------------- books */
  clearConfiguration();
  setConfigured('NIV');
  await withHttpsResponses([{
    body: {
      data: [
        { id: 'GEN', name: 'Genesis', chapters: new Array(50).fill({}) },
        { id: 'JHN', name: 'John', chapters: new Array(21).fill({}) }
      ]
    }
  }], async requests => {
    const result = await invoke('/api/bible?action=books&version=NIV');
    t('NIV book lists come from API.Bible for the account Bible ID',
      requests[0].url.startsWith(`https://rest.api.bible/v1/bibles/${NIV_ID}/books`) &&
      result.status === 200 && result.json.source === 'api.bible' &&
      result.json.books[0].id === 1 && result.json.books[0].chapters === 50 && result.json.books[1].id === 43);
  });

  clearConfiguration();
  setConfigured('NIV');
  await withHttpsResponses([{ status: 503, body: {} }], async () => {
    const result = await invoke('/api/bible?action=books&version=NIV');
    t('the book list falls back to the canonical list when API.Bible is unreachable',
      result.status === 200 && result.json.source === 'bundled' && result.json.books.length === 66 &&
      typeof result.json.warning === 'string');
  });

  /* ------------------------------------------------------- account ID check */
  clearConfiguration();
  process.env.BIBLE_API_KEY = TEST_KEY;
  handler._resetCaches();
  await withHttpsResponses([{
    body: listingFixture([
      { id: 'ffffffffffffffff-01', abbreviation: 'NIV', abbreviationLocal: 'NIV', name: 'New International Version' },
      { id: MSG_ID, abbreviation: 'MSG', abbreviationLocal: 'MSG', name: 'The Message' }
    ])
  }], async () => {
    const result = await invoke('/api/bible?action=bibles');
    t('the account check reports the resolved NIV and MSG Bible IDs',
      result.status === 200 && result.json.translations.NIV.bibleId === 'ffffffffffffffff-01' &&
      result.json.translations.MSG.bibleId === MSG_ID &&
      result.json.translations.NIV.source === 'account-listing');
    t('the account check never exposes the API key',
      !result.body.includes(TEST_KEY));
  });

  clearConfiguration();
  process.env.MSG_BIBLE_ID = MSG_ID;
  handler._resetCaches();
  const noKeyBibles = await invoke('/api/bible?action=bibles');
  t('the account check explains that an MSG Bible ID does not replace the required API.Bible key',
    noKeyBibles.status === 503 && /MSG_BIBLE_ID, cannot replace the required key/.test(noKeyBibles.json.message) &&
    /BIBLE_API_KEY/.test(noKeyBibles.json.message) && /redeploy/.test(noKeyBibles.json.message));

  clearConfiguration();
  process.env.BIBLE_API_KEY = TEST_KEY;
  handler._resetCaches();
  await withHttpsResponses([{
    body: listingFixture([{ id: NIV_ID, abbreviation: 'NIV', abbreviationLocal: 'NIV', name: 'New International Version' }])
  }], async () => {
    const result = await invoke('/api/bible?action=bibles');
    t('the account check says which translation the account is missing and how to add it',
      result.json.translations.MSG.available === false &&
      /not available through this site's API.Bible account/.test(result.json.translations.MSG.message) &&
      /Add this translation to your API.Bible plan/.test(result.json.translations.MSG.detail));
  });

  /* --------------------------------------------------- other translations (unchanged) */
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

  clearConfiguration();
  const status = await invoke('/api/bible?action=status&version=MSG');
  t('status reports the selected version instead of forcing NIV',
    status.status === 200 && status.json.translation === 'MSG' &&
    status.json.translationName === 'The Message');
  t('status for an unconfigured API.Bible edition says what is missing',
    status.json.configured === false && /not configured on this server/.test(status.json.message) &&
    status.json.providers.join(',') === 'api.bible' && /BIBLE_API_KEY/.test(status.json.detail));
  const unsupported = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=AMP');
  t('unsupported version codes are rejected before any provider call',
    unsupported.status === 400 && unsupported.json.error === 'UNSUPPORTED_TRANSLATION');

  clearConfiguration();
  await withHttpsResponses([{ body: [{ verse: 1, text: 'In the <b>beginning</b> &amp; beyond.' }] }], async requests => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NLT');
    t('Bolls chapters preserve the requested version and are HTML-cleaned',
      result.status === 200 && result.json.translation === 'NLT' &&
      result.json.translationName === 'New Living Translation' &&
      result.json.verses[0].text === 'In the beginning & beyond.');
    t('each Bolls chapter URL is pinned to its requested translation code (get-text, no commentary)',
      requests.length === 1 && requests[0].url.includes('/get-text/NLT/43/3/'));
  });

  clearConfiguration();
  process.env.BIBLE_API_KEY = TEST_KEY;
  process.env.NLT_BIBLE_ID = 'a761ca71e0b3ddcf-01';
  handler._resetCaches();
  await withHttpsResponses([{
    body: apiBibleChapterFixture('JHN.3', 'a761ca71e0b3ddcf-01', [{ verse: 16, text: 'NLT text.' }], 'Holy Bible, New Living Translation®, copyright © 1996, 2004, 2015 by Tyndale House Foundation.', 'John 3')
  }], async requests => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NLT');
    t('NLT keeps its optional API.Bible route when NLT_BIBLE_ID is configured',
      result.status === 200 && result.json.provider === 'api.bible' &&
      requests[0].url.includes('/bibles/a761ca71e0b3ddcf-01/chapters/JHN.3'));
  });

  clearConfiguration();
  process.env.BIBLE_API_KEY = TEST_KEY;
  handler._resetCaches();
  await withHttpsResponses([], async requests => {
    const result = await invoke('/api/bible?action=status&version=NLT');
    t('an optional API.Bible feed is reported accurately when its ID is not pinned',
      result.json.configured === true && result.json.providers.join(',') === 'Bolls.life' &&
      /NLT_BIBLE_ID/.test(result.json.message) && requests.length === 0);
  });

  clearConfiguration();
  process.env.BIBLE_API_KEY = TEST_KEY;
  process.env.NLT_BIBLE_ID = 'a761ca71e0b3ddcf-01';
  handler._resetCaches();
  await withHttpsResponses([], async requests => {
    const result = await invoke('/api/bible?action=status&version=NLT');
    t('a pinned optional API.Bible feed is listed first and resolves without a provider call',
      result.json.providers.join(',') === 'api.bible,Bolls.life' &&
      result.json.bibleId === 'a761ca71e0b3ddcf-01' && requests.length === 0);
  });
  clearConfiguration();

  await withHttpsResponses([{ body: kjvChapter }], async requests => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=KJV');
    t('KJV is served by the exact GetBible edition first',
      result.status === 200 && result.json.provider === 'GetBible.net' && result.json.fallbackUsed === false);
    t('KJV primary request is the exact GetBible v2 edition and passage',
      requests.length === 1 && requests[0].url === 'https://api.getbible.net/v2/kjv/43/3.json');
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
      requests[1].url === 'https://bolls.life/get-text/KJV/43/3/');
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

  clearConfiguration();
  await withHttpsResponses([{ body: [{ verse: 1, text: 'In the beginning.' }] }], async () => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=ESV');
    t('ESV keeps its Bolls.life feed',
      result.status === 200 && result.json.translation === 'ESV' && result.json.provider === 'Bolls.life');
  });

  /* ---------------------------------------------------- parser and hardening */
  t('out-of-sequence verses are rejected rather than shown out of order', (function () {
    try { handler._parseApiBibleHtml('<span class="v" data-number="1">1</span>a <span class="v" data-number="3">3</span>b'); return false; }
    catch (error) { return /out of sequence/.test(error.message); }
  })());

  clearConfiguration();
  setConfigured('NIV');
  await withHttpsResponses([{
    body: { data: { id: 'JHN.3', bibleId: NIV_ID, content: '<p>Text without any verse markers.</p>', copyright: NIV_COPYRIGHT } }
  }], async () => {
    const result = await invoke('/api/bible?action=chapter&id=43&chapter=3&version=NIV');
    t('a chapter without verse numbers is reported honestly, not rendered as one block',
      result.status === 502 && /without verse numbers/.test(result.json.message));
  });

  /* --------------------------------------------------------- the reader page */
  const html = fs.readFileSync(path.join(ROOT, 'bible.html'), 'utf8');
  t('BSB is its own labelled translation read from the bundled public-domain files',
    html.includes("BSB: { name: 'Berean Standard Bible'") && html.includes("version === 'BSB'") &&
    html.includes('/assets/bible/bsb/'));
  t('the Bible reader exposes NIV, KJV, NLT, ESV, MSG and BSB controls',
    ['NIV', 'KJV', 'NLT', 'ESV', 'MSG', 'BSB'].every(code =>
      html.includes(`data-version="${code}"`) && html.includes(`setVersion('${code}')`)));
  t('chapter and search requests send the selected version to the API',
    /action=chapter[^`]*version=/.test(html) && /action=search[^`]*version=/.test(html));
  t('the reader no longer claims NIV is unavailable for licensing reasons',
    !html.includes('licensing limit') &&
    html.includes("`${currentTranslationName} · setup required`"));
  t('an unconfigured translation shows the server message, not a substitute',
    html.includes('json.message') && html.includes('No other translation'));
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

  /* ---------------------------------------------------------- maintainer docs */
  const licensing = fs.readFileSync(path.join(ROOT, 'docs/BIBLE-LICENSING.md'), 'utf8');
  t('the licensing note documents API.Bible as the NIV and MSG source',
    /NIV[^\n]*api\.bible/i.test(licensing) && /MSG[^\n]*api\.bible/i.test(licensing) &&
    /BIBLE_API_KEY/.test(licensing) && /NIV_BIBLE_ID/.test(licensing) && /MSG_BIBLE_ID/.test(licensing));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
