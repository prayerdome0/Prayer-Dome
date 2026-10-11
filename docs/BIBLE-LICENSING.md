# Bible translations: sources, licences and configuration

This note is for maintainers. It records where each translation in the reader
comes from, what the licence allows, and which environment variables control
the providers. It is kept in step with `api/bible.js`.

## Where each translation comes from

| Edition | Source | Fallback | Licence status |
|---|---|---|---|
| NIV | **api.bible** (`/v1/bibles/{id}/…`), key `BIBLE_API_KEY`, Bible ID from `NIV_BIBLE_ID` or the account's Bible list. | **None.** No mirror is ever shown in its place. | Copyrighted (Biblica). Served through the Prayer Dome api.bible account, which must have NIV licensed. A free Starter key is enough. |
| MSG | **api.bible**, same key, Bible ID from `MSG_BIBLE_ID` or the account's Bible list. | **None.** The old Bolls.life MSG feed was removed so an unlicensed mirror can never be shown as The Message. | Copyrighted (NavPress). Served through the Prayer Dome api.bible account, which must have The Message licensed. A free Starter key is enough. |
| BSB | Bundled files in `assets/bible/bsb/` (no API, no key). Built by `scripts/build-bsb.mjs` from the USFM build in github.com/ethnosdev/bsb (CC0, `database_builder/bsb_usfm`). | none | Public domain. The Berean Standard Bible was dedicated to the public domain (CC0) on 30 April 2023. 31,086 verse entries. 16 verses the BSB omits from its main text (e.g. John 5:4) are not shown. |
| KJV | GetBible v2 (`api.getbible.net/v2/kjv`) | Bolls.life KJV, Strong's numbers removed | Public domain (US). |
| NLT | api.bible when `NLT_BIBLE_ID` and the key are set | Bolls.life NLT | Copyrighted (Tyndale). Bolls.life rights unverified. |
| ESV | Bolls.life ESV | none | Copyrighted (Crossway). Bolls.life rights unverified. |

Rules the code enforces:

- Every provider response is checked against the requested edition. An
  api.bible response must carry the expected Bible ID and a copyright line that
  names the translation. A GetBible response must carry the requested
  abbreviation and passage. Anything else is rejected.
- A translation is never substituted for another. If NIV or MSG is
  unconfigured or unavailable, the reader says so and shows no text.
- NIV and MSG are read from api.bible and nowhere else. Removing the mirror
  fallback is deliberate: the reader offers those two editions only because the
  Prayer Dome api.bible account is licensed for them.
- Bible IDs are not guessed. `NIV_BIBLE_ID` / `MSG_BIBLE_ID` win when set;
  otherwise the ID comes from the account's own Bible list
  (`GET /v1/bibles?language=eng`), matched on the edition's abbreviation or full
  name. If the account does not list an edition, the reader says so and names
  the variable to set. The published NIV ID (`78a9f6124f344018-01`, from the
  api.bible documentation) is only used when the account list cannot be
  reached; MSG has no published ID, so it is reported as needing configuration
  instead.
- api.bible failures are reported for what they are: 401 rejected key, 403
  translation not licensed to the account, 404 unknown Bible ID, 429 call limit.
  The provider's own message is logged server-side, never returned.
- The licensed editions do not have to be paid for. API.Bible's free Starter
  plan is $0/month, includes up to three licensed Bibles and 5,000 calls a
  month for non-commercial use, and The Message is one of the choices. The
  steps are the same in three places, kept in step by hand: `freePlan()` in
  `api/bible.js` (returned by `GET /api/bible?action=setup&version=MSG` and by
  `?action=status` whenever an edition is not configured), `setupSteps()` in
  `scripts/bible-ids.mjs` (`npm run bible:setup`), and DEPLOYMENT.md. Failures
  the owner can fix (`TRANSLATION_NOT_CONFIGURED`, `TRANSLATION_NOT_IN_ACCOUNT`,
  `TRANSLATION_NOT_LICENSED`, `API_KEY_REJECTED`, `BIBLE_NOT_FOUND`,
  `RATE_LIMITED`) carry the same steps in a `setup` block of the response body.
- The reader shows a reader-facing sentence plus the owner steps folded into a
  collapsed "site owner?" section, so the congregation is never faced with
  deployment instructions.
- Chapters are laid out exactly as the edition numbers them: a number may be
  printed as a range (`16-21`), skipped, or repeated after a section break —
  The Message does all three, and reading only strict 1-2-3 numbering made
  every MSG chapter fail while verses and search worked. A number that runs
  backwards is still rejected (`CHAPTER_FORMAT_UNSUPPORTED`), because that
  would reorder the text; a verse 0 marker is dropped rather than shown as
  verse 0.
- Error and status payloads carry two audiences: `message` is written for the
  reader and never names environment variables, while `detail` holds the owner
  instructions (`BIBLE_API_KEY`, `NIV_BIBLE_ID`, plan/access steps). The reader
  shows `message`; the status tooltip and `/api/bible?action=bibles` show the
  `detail`.
- Successful api.bible reads are memoised in the serverless instance for ten
  minutes (failures for one) so one chapter read does not spend the account's
  monthly call quota twice.
- The Bolls.life `get-chapter` (commentary) route is not used. The reader uses
  `get-text`, and search uses `/v2/find/<slug>`.
- API keys are read from the environment only. They are sent in an `api-key`
  request header, never in a URL, and the JSON writer redacts them from every
  response body as a second line of defence.

## Environment variables

| Variable | Purpose |
|---|---|
| `BIBLE_API_KEY` | api.bible key for NIV, MSG and (optionally) NLT. A free Starter-plan key is enough (add The Message and the NIV to the account). Legacy aliases still read: `NIV_API_KEY`, `API_BIBLE_KEY`. Run `npm run bible:setup` for the free steps. |
| `NIV_BIBLE_ID` | Optional. Pins the NIV Bible ID instead of using the account's Bible list. |
| `MSG_BIBLE_ID` | Optional. Pins The Message Bible ID instead of using the account's Bible list. |
| `NLT_BIBLE_ID` | Optional. Enables the licensed NLT feed; without it NLT stays on the mirror. |

Set these in the Vercel project for production. Do not commit them.

To read the IDs your account is entitled to, run the helper with the same key
and copy the values it prints:

```sh
BIBLE_API_KEY=<your key> node scripts/bible-ids.mjs
```

`GET /api/bible?action=bibles` reports the same resolution from the deployed
site (it never returns the key). `GET /api/bible?action=status&version=NIV`
reports the provider, the resolved Bible ID and its source.

## Open decisions for the owner

1. **api.bible plan limits.** API.Bible grants access per account and per plan.
   The intended free route is the Starter plan ($0/month, up to three licensed
   Bibles, 5,000 calls a month, non-commercial): add NIV and The Message in the
   dashboard and the site is licensed for both. Confirm the account lists both —
   if it does not, the reader reports `TRANSLATION_NOT_IN_ACCOUNT` and shows no
   text. If Prayer Dome ever takes ads or fees, or outgrows 5,000 calls a month
   (the ten-minute memoisation keeps one chapter read to a single call), the
   plan has to change before the licensed editions can stay on the site.
2. **Attribution.** api.bible requires the translation's copyright line to be
   shown with the text. The reader renders the `copyright` string returned by
   api.bible with every chapter; do not remove it. Confirm any further
   attribution requirements (FUMS reporting, publisher wordmarks) with
   api.bible support before launch.
3. **Daily verse library.** `assets/pd-verse-data.js` hard-codes short NIV
   passages and says they are used under "the api.bible license". Those curated
   verses are separate from this endpoint; confirm the same licence covers them.
4. **ESV and NLT on Bolls.life.** Bolls.life is an unofficial mirror and its
   licence for these texts is not stated. Confirm rights before relying on
   these readings in production, or switch them to a licensed source.
5. **Search.** Bolls.life search (`/v2/find`) uses semantic matching for
   phrases, so results can include verses that match in meaning rather than
   wording. api.bible search is exact (`fuzziness=0`) and is used for NIV and
   MSG.

## Coverage

The api.bible paths were verified against simulated provider responses and the
documented request shapes. The development sandbox has no outbound route to
`rest.api.bible`, so a live call with the Prayer Dome key must be run once from
a networked machine (`npm run bible:ids`) before launch. GetBible and Bolls.life
are likewise unreachable from the sandbox; live coverage of all 66 books and
their chapters has not been verified.
