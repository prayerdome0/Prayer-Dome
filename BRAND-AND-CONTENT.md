# Prayer Dome — Brand, Sermons, Translation & Premium Platform

What shipped across the last passes, how to use it, and what to review before
promoting the translation feature.

---

## 1. The "Royal" brand system — Blue · Gold · White

The platform now carries the official **Prayer Dome premium identity**:

| Token | Value | Role |
|---|---|---|
| `--pd-blue` / `--pd-royal` | `#0A4D9B` | Primary Blue — actions, headers, heroes |
| `--pd-gold` / `--pd-amber` | `#D4AF37` | Premium Gold — highlights, accents |
| `--pd-blue-deep` / `--pd-navy` | `#0a3d7a` / `#07244d` | Deep shades for gradients & dark surfaces |
| `--pd-blue-mid` | `#3b82f6` | Bright blue for hover/light states |

Shared files, loaded on every page:

| File | Purpose |
|---|---|
| `assets/pd-brand.css` | Palette, gradients, glass surfaces, motion primitives, **premium components** (topbar, drawer, splash, marquee, location card, notification center, hero banner, stats, scripture card, radio) |
| `assets/pd-motion.js` | Scroll reveal, progress bar, tilt, count-up, parallax, ripple |
| `assets/pd-content-data.js` | Seed content: announcements, banners, news, radio, podcasts, stats, Mark 7:37 theme |
| `assets/pd-app.js` | **Premium app layer** — `PDApp` with modules: `ui`, `i18n`, `location`, `announcements`, `notifications`, `banners`, `stats`, `live`, `news`, `scripture`, `radio` |

### Palette

```
--pd-blue  #0A4D9B   --pd-gold #D4AF37   --pd-blue-mid  #3b82f6
--pd-blue-deep #0a3d7a                  --pd-navy #07244d

--pd-grad-dawn     blue → deep blue → gold   (primary actions, headings)
--pd-grad-ocean    navy → blue → bright blue (secondary)
--pd-grad-horizon  navy → blue → gold        (hero backdrops)
--pd-grad-gold     white → pale gold → gold  (highlights)
```

The old `--accent-green` / `--pd-green-*` names still work — they are **aliased
to the blue brand**, so every page picked up the rebrand without being
rewritten. Old hex values (`#0a5c36`, `#15803d`, `#22c55e`, `#064e3b`,
`#022c22` …) were converted repo-wide to the blue scale, including `rgba()`
forms, the manifest theme colour, SEO theme-colour and the OG share card
(`assets/og-image.png`).

### Using the premium layer

```html
<!-- top bar: hamburger · centred logo · bell + language + theme -->
<header class="pd-topbar">…</header>

<!-- everything else is data-driven; pd-app.js scans for its targets -->
<div class="pd-location-card" id="pdLocationCard">…</div>   <!-- live location -->
<div class="pd-marquee" id="pdAnnouncementBar">…</div>      <!-- moving announcements -->
<div class="hero" data-pd-hero>…</div>                       <!-- admin-scheduled banner -->
<div data-pd-scripture></div>                                <!-- Mark 7:37 card -->
<div class="pd-stats-strip">…<div data-pd-stat="members">…   <!-- community stats -->
```

Pages with Firestore register it once so everything syncs live:

```js
PDApp.setFirestore({ db, doc, getDoc, setDoc, updateDoc, addDoc, collection,
                    query, orderBy, limit, getDocs, onSnapshot, serverTimestamp, Timestamp });
```

Everything else works fully offline via localStorage + BroadcastChannel.

### Accessibility

Every animation is switched off under `prefers-reduced-motion: reduce` — the
aurora stops drifting, reveals appear instantly, the marquee freezes, the
progress bar is not even created. This is tested (`tests/content.test.js`,
`tests/premium.test.js`).

### One thing worth knowing

The aurora backdrop sits at `z-index: -2`, and your pages paint an opaque
colour on `<body>`, which would hide it. `pd-motion.js` therefore adds
`.pd-has-aurora` to `<html>`, moves the background colour up one level and lets
`<body>` go transparent. It also mirrors `dark-mode` onto `<html>`.

If a page ever looks wrong, `<body data-pd-no-aurora>` opts it out entirely.

---

## 2. Sermons — `/sermons`

Six full narrated Bible stories, written specifically to be *heard*:

- The Father Who Ran (prodigal son)
- The Giant Was the Smaller Problem (David and Goliath)
- He Was in the Boat the Whole Time (calming the storm)
- The Window He Refused to Close (Daniel)
- For Such a Time as This (Esther)
- Who Is My Neighbour? (good Samaritan)

Each has a key verse, a prayer and reflection questions.

### How the narration works

The page speaks **one paragraph per utterance** rather than the whole sermon at
once. That was deliberate and buys three things:

1. The highlight is accurate — you always know which line is being read.
2. Skip forward/back and tap-a-paragraph-to-start-there become possible.
3. It sidesteps the ~200-character truncation bug in several mobile speech
   engines, which silently cuts long utterances short.

Controls: play/pause, previous/next paragraph, stop, speed 0.6×–1.4×, click any
paragraph to jump there. Keyboard: `Space`, `←`, `→`, `Esc`.

If the device has no speech engine the page says so plainly and the full text is
still there to read.

### Adding a sermon

**Bundled** — append to `PD_SERMONS` in `sermons-data.js`. Keep paragraphs to
2–4 sentences and under 600 characters (there is a test enforcing this), and
spell things out — write "chapter three", not "ch. 3", or the synthesiser
mangles it.

**From the admin dashboard** — the page already accepts Firestore documents.
Call `pdMergeAdminSermons(docs)` with an array shaped like:

```js
{ title, subtitle, series, speaker, scripture, summary, keyVerse,
  body,            // plain text; blank lines become paragraphs
  topics: [], image, prayer, reflection: [] }
```

Admin sermons appear above the bundled ones with a "New" badge. Wiring the
actual Firestore listener in `admin.html` is the remaining step.

---

## 3. Translation — `/translate`

English (KJV), **Chitumbuka, siSwati, Bemba and Nyanja** (5 languages). 33+
verses including the featured **Mark 7:37** theme, side-by-side comparison,
cross-language search, verse of the day, read-aloud, plus a language selector
in the app top bar (`pd-app.js` → `PDApp.i18n`).

Cross-language search is genuinely useful: typing the siSwati word *umelusi* or
the Tumbuka *muliska* both find Psalm 23. A member can search in whichever
language they think in.

**Bemba (`bem`) and Nyanja (`nya`)** were added as community drafts with the
same `reviewed: false` discipline as Tumbuka and siSwati — the draft badge
shows until a fluent speaker signs each string off. Voices fall back to the
nearest available browser voice (Swahili phonetics), then English.

### ⚠️ Read this before you promote the feature

**The Tumbuka, siSwati, Bemba and Nyanja text is a draft, not a published translation.**

The English is KJV and exact. The other two are machine-assisted renderings
prepared to give you a working starting point. Every entry carries
`reviewed: false`, and the UI is built around that honesty:

- Each verse shows a **"Draft"** badge
- The page carries a prominent notice at the top saying the text is a community
  draft, is awaiting review, and is **not** the published *Buku Lakupatulika*
  or the siSwati Bible
- Copied and shared text includes `[Community draft — awaiting review]`

Please do not remove those notices. They are the difference between an honest
work-in-progress and misrepresenting scripture to your members — and a church
publishing a wrong translation in someone's mother tongue is a real harm, not a
cosmetic one.

**My recommendation:** before you advertise this, get one fluent Tumbuka speaker
and one fluent siSwati speaker to work through the 32 verses. That is perhaps an
evening's work each, and it turns a caveated draft into something the church can
genuinely stand behind. The page already invites readers to volunteer.

### Signing off a verse

1. A fluent speaker corrects the `tum` / `ssw` string in `translation-data.js`
2. Set `reviewed: { en: true, tum: true, ssw: false }` for that verse
3. Record who checked it in a `reviewer` field

The Draft badge disappears automatically for that language.

There is a test asserting no draft language is marked reviewed — when you start
flipping flags for real, update `tests/content.test.js` accordingly.

### Voices

No browser ships a Chitumbuka or siSwati voice. `PD_LANGUAGES` declares a
fallback chain — Nyanja/Swahili for Tumbuka, Zulu for siSwati (nearest Nguni) —
and the page **tells the user** when it is borrowing another language's voice
rather than pretending the accent is correct.

---

## 4. AI Assistant — what changed

- Dawn sunrise photograph behind the hero
- Illustrated artwork for ten topics; the other nine fall back to a gradient
  tile with the topic glyph, so adding a topic never leaves a broken image
- Topic chips show artwork thumbnails
- **Per-verse translation.** Where a verse the assistant showed also exists in
  the translation pack, Chitumbuka and siSwati buttons appear beneath it, with
  the same draft disclosure. Verses not in the pack simply show no buttons —
  silence is better than a wrong translation.

The assistant still runs entirely in the browser: no API key, no backend, works
offline.

---

## 5. Routing, PWA, SEO

`/sermons` and `/translate` were added to `vercel.json`, `firebase.json`,
`manifest.json` shortcuts, `seo/pages.json`, the sitemap, and the service worker
precache. Cache name bumped to `prayer-dome-v4` so returning visitors get the
new build.

Bottom navigation is now: Home · Bible · Sermons · Pray · Assistant · Account.
Chat and Translate live in the homepage portal grid.

---

## 6. Tests

```bash
node tests/content.test.js      # 83 assertions — new
node tests/assistant.test.js    # 21
npm install --no-save jsdom && node tests/pages.test.js   # 36
python3 seo/apply-seo.py --check
```

**140 passing.** The new suite covers translation completeness across all three
languages, that no draft is falsely marked reviewed, cross-language search,
verse-of-the-day stability, the voice fallback chain, UI-string parity,
paragraph length limits for narration, that every referenced image exists on
disk, that both new pages contain every element id their scripts bind to, and
that reduced-motion is honoured.

---

## 7. Still outstanding

1. **Get the translations reviewed** — see above. This is the top priority.
2. **Wire admin sermon publishing** — the page consumes Firestore already;
   `admin.html` needs the compose form and the listener call.
3. Three sermons have no artwork (Daniel, Esther, Samaritan) and use gradient
   tiles. They look fine, but images would be better.
4. **Rotate the Cloudinary secret in `live-stream-config.js`** — still committed
   and still public to every visitor. Flagged in the previous pass; unchanged.
