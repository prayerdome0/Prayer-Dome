#!/usr/bin/env node
/**
 * Prayer Dome — API.Bible account check
 * ---------------------------------------------------------------------------
 * Lists the Bibles the Prayer Dome api.bible account can read and prints the
 * Bible IDs that resolve for NIV and The Message, so the IDs can be pinned with
 * NIV_BIBLE_ID / MSG_BIBLE_ID if the owner wants them explicit.
 *
 * The key is read from the environment (BIBLE_API_KEY, or the legacy aliases
 * NIV_API_KEY / API_BIBLE_KEY) or from --key=. It is never written to a file,
 * never printed, and never put in a URL.
 *
 * Usage:
 *   BIBLE_API_KEY=<your key> node scripts/bible-ids.mjs [--verify] [--json]
 *
 *   --verify  also fetch John 3 in each matched translation to prove the text
 *             really is the edition that was requested
 *   --json    print the result as JSON instead of a report
 */

const API_BIBLE_BASE = 'https://rest.api.bible/v1';

function parseArgs(argv) {
  const options = { verify: false, json: false };
  argv.forEach(value => {
    if (value.startsWith('--key=')) options.key = value.slice(6);
    else if (value === '--verify') options.verify = true;
    else if (value === '--json') options.json = true;
    else if (value === '--help' || value === '-h') options.help = true;
  });
  return options;
}

function apiKey(options) {
  return options.key ||
    process.env.BIBLE_API_KEY ||
    process.env.NIV_API_KEY ||
    process.env.API_BIBLE_KEY ||
    '';
}

async function callApiBible(pathname, key) {
  const response = await fetch(`${API_BIBLE_BASE}${pathname}`, {
    headers: { 'api-key': key, accept: 'application/json' }
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch (error) { /* handled below */ }
  if (!response.ok) {
    const detail = json && (json.message || json.error) ? ` — ${json.message || json.error}` : '';
    const error = new Error(`HTTP ${response.status}${detail}`);
    error.status = response.status;
    throw error;
  }
  if (!json) throw new Error('The response was not JSON');
  return json;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/* Keep in step with bibleMatchRank() in api/bible.js. */
function matchBibles(bibles, code, name) {
  const wantedCode = normalize(code);
  const wantedName = normalize(name);
  const ranked = bibles.map(bible => {
    const abbreviations = [bible.abbreviation, bible.abbreviationLocal].map(normalize);
    const names = [bible.name, bible.nameLocal].map(normalize);
    let rank = 0;
    if (abbreviations.includes(wantedCode)) rank = 3;
    else if (names.includes(wantedName)) rank = 2;
    else if (names.some(value => value && value.startsWith(wantedName))) rank = 1;
    return { bible, rank };
  }).filter(item => item.rank > 0);
  ranked.sort((a, b) => b.rank - a.rank);
  return ranked.map(item => item.bible);
}

async function verifyPassage(bibleId, key) {
  const json = await callApiBible(
    `/bibles/${encodeURIComponent(bibleId)}/chapters/JHN.3?content-type=html&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true`,
    key
  );
  const data = json.data || {};
  const content = String(data.content || '');
  return {
    bibleId: data.bibleId,
    reference: data.reference,
    copyright: data.copyright,
    hasVerseMarkers: /data-number="/.test(content),
    verseCount: (content.match(/data-number="/g) || []).length
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: BIBLE_API_KEY=<your key> node scripts/bible-ids.mjs [--verify] [--json]');
    return 0;
  }
  const key = apiKey(options);
  if (!key) {
    console.error('No API.Bible key found. Set BIBLE_API_KEY (or NIV_API_KEY / API_BIBLE_KEY), or pass --key=…');
    return 2;
  }

  let listing;
  try {
    listing = await callApiBible('/bibles?language=eng', key);
  } catch (error) {
    console.error(`Could not reach API.Bible: ${error.message}`);
    if (error.status === 401) console.error('The key was rejected. Check the key from your API.Bible account.');
    return 1;
  }

  const bibles = Array.isArray(listing.data) ? listing.data : [];
  const report = {
    endpoint: `${API_BIBLE_BASE}/bibles?language=eng`,
    englishBibles: bibles.length,
    translations: {},
    bibles: bibles.map(bible => ({
      id: bible.id,
      abbreviation: bible.abbreviationLocal || bible.abbreviation,
      name: bible.nameLocal || bible.name
    }))
  };

  for (const [code, name] of [['NIV', 'New International Version'], ['MSG', 'The Message']]) {
    const matches = matchBibles(bibles, code, name);
    report.translations[code] = matches.length
      ? { available: true, bibleId: matches[0].id, name: matches[0].nameLocal || matches[0].name, alternatives: matches.slice(1).map(b => b.id) }
      : { available: false, bibleId: null, message: `This account does not list ${name}. Add it to your API.Bible plan, then run this check again.` };
    if (options.verify && matches.length) {
      try {
        report.translations[code].verified = await verifyPassage(matches[0].id, key);
      } catch (error) {
        report.translations[code].verified = { error: error.message };
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return report.translations.NIV.available && report.translations.MSG.available ? 0 : 1;
  }

  console.log(`API.Bible account check — ${report.englishBibles} English Bibles available\n`);
  for (const code of ['NIV', 'MSG']) {
    const entry = report.translations[code];
    if (entry.available) {
      console.log(`${code}: available — Bible ID ${entry.bibleId} (${entry.name})`);
      if (entry.alternatives.length) console.log(`     other candidates: ${entry.alternatives.join(', ')}`);
      if (entry.verified) {
        if (entry.verified.error) console.log(`     verification failed: ${entry.verified.error}`);
        else {
          console.log(`     John 3 verified: ${entry.verified.verseCount} verses, verse markers ${entry.verified.hasVerseMarkers ? 'present' : 'MISSING'}`);
          if (entry.verified.copyright) console.log(`     copyright: ${String(entry.verified.copyright).slice(0, 160)}`);
        }
      }
    } else {
      console.log(`${code}: NOT in this account — ${entry.message}`);
    }
  }
  console.log('\nPin the IDs (optional) with NIV_BIBLE_ID and MSG_BIBLE_ID in the Vercel project.');
  console.log('The full Bible list is in the report above; this script never prints your key.');
  return report.translations.NIV.available && report.translations.MSG.available ? 0 : 1;
}

main()
  .then(code => { process.exitCode = code; })
  .catch(error => {
    console.error(`Account check failed: ${error && error.message || error}`);
    process.exitCode = 1;
  });
