# Bible translations: sources, licences and configuration

This note is for maintainers. It records where each translation in the reader
comes from, what the licence allows, and which environment variables control
the providers. It is kept in step with `api/bible.js`.

## Where each translation comes from

| Edition | Primary source | Fallback | Licence status |
|---|---|---|---|
| NIV | **None. No API.** The reader lists NIV, shows a licensing message and no text, and makes no provider request. | none | Copyrighted (Biblica). Prayer Dome holds no licence that covers this site. |
| KJV | GetBible v2 (`api.getbible.net/v2/kjv`) | Bolls.life KJV, Strong's numbers removed | Public domain (US). |
| NLT | api.bible when `NLT_BIBLE_ID` and the key are set | Bolls.life NLT | Copyrighted (Tyndale). Bolls.life rights unverified. |
| ESV | Bolls.life ESV | none | Copyrighted (Crossway). Bolls.life rights unverified. |
| MSG | api.bible when `MSG_BIBLE_ID` and the key are set | Bolls.life MSG | Copyrighted (NavPress). Bolls.life rights unverified. |

Rules the code enforces:

- Every provider response is checked against the requested edition. An
  api.bible response must carry the expected Bible ID and a copyright line that
  names the translation. A GetBible response must carry the requested
  abbreviation and passage. Anything else is rejected.
- A translation is never substituted for another. If NIV is unconfigured or
  unavailable, the reader says so and shows no text.
- The Bolls.life `get-chapter` (commentary) route is not used. The reader uses
  `get-text`, and search uses `/v2/find/<slug>`.
- NIV is never requested from any provider. Its status is reported as a licensing limit.
- API keys are read from the environment only. They are sent in a request
  header and are never returned in a response or logged.

## Environment variables

| Variable | Purpose |
|---|---|
| `NIV_API_KEY` (or `BIBLE_API_KEY`) | Optional api.bible key, used only for NLT and MSG. NIV ignores it. |
| `NLT_BIBLE_ID`, `MSG_BIBLE_ID` | Optional api.bible IDs for NLT and MSG, used with the same key. |

Set these in the Vercel project for production. Do not commit them.

## Open decisions for the owner

1. **NIV licence (removed for now).** NIV is not served from any API. To show NIV text in future, the owner must obtain a written licence covering this site. api.bible's Starter plan is free but non-commercial. Its
   Express licence for NIV requires non-commercial use with no ads, no
   in-app purchases and no freemium features, and its help pages say
   commercial use needs a paid plan and per-translation fees. Biblica's
   permissions page says the Express licence also excludes AI or ML features.
   Confirm whether Prayer Dome's membership, upgrade or other features count
   as commercial, and whether any AI features are reachable from the Bible
   reader, before NIV is enabled in production.
2. **Daily verse library.** `assets/pd-verse-data.js` hard-codes short NIV
   passages and says they are used under "the api.bible license". Confirm
   that licence is held, or change the wording and the passage source.
3. **ESV, NLT and MSG on Bolls.life.** Bolls.life is an unofficial mirror and
   its licence for these texts is not stated. Confirm rights before relying on
   these readings in production, or switch them to a licensed source.
4. **Search.** Bolls.life search (`/v2/find`) uses semantic matching for
   phrases, so results can include verses that match in meaning rather than
   wording.

## Coverage

GetBible and Bolls.life do not serve every book and chapter the same way, and
the sandbox used for development had no outbound route to either provider. The
reader was checked against a simulated provider response, not a live one.
Live coverage of all 66 books and their chapters has not been verified.
