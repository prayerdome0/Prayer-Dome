# Prayer Dome — Upgrade Notes

What shipped in this pass, how to run it, and what your roadmap already had covered.

---

## 1. What was already built

Before adding anything I audited the repo. A large part of your roadmap **already
exists** and did not need rebuilding:

| Roadmap item | Status in repo |
|---|---|
| Email/password + Google login, profiles, roles | `account.html`, `admin.html` — Firebase Auth, roles, member records |
| Prayer wall with anonymous, answered status, comments, prayer counter | `prayer.html` |
| Bible notes, bookmarks, reading plans, search, audio, progress | `bible.html` |
| Chat, rooms, voice notes, image sharing, status, online presence | `chat.html` |
| Live streaming (Cloudinary HLS + RTMP), live chat, recordings | `video.html` |
| Testimonies, events, giving, membership, quiz, gallery, finance | dedicated pages each |
| Push notifications | `firebase-messaging-sw.js`, `functions_index.js` |
| Dark mode | every page |

The genuine gaps were **SEO** (literally none of it existed), **no AI assistant**,
**no Vercel config**, and a **dedicated Live Service page**. That's what this pass
delivers.

---

## 2. SEO foundation

Before this, the site had **zero** meta descriptions, Open Graph tags, canonicals,
structured data, `robots.txt` or `sitemap.xml`. Google had almost nothing to work
with, and links shared to WhatsApp or Facebook showed no preview at all.

### How it works

Metadata lives in one file — **`seo/pages.json`** — and a script writes it into
every page:

```bash
python3 seo/apply-seo.py           # apply metadata + regenerate sitemap/robots
python3 seo/apply-seo.py --check   # report drift without writing (exit 1 if stale)
```

The script injects a block delimited by `<!-- PD-SEO:START -->` / `<!-- PD-SEO:END -->`.
Re-running **replaces** that block rather than duplicating it, and touches nothing
outside the markers — I verified every page body is byte-for-byte unchanged.

To edit a title or description, change `seo/pages.json` and rerun. Don't hand-edit
the block in the HTML; it gets overwritten.

### What each page now has

- Unique `<title>` and meta description written for search intent
- `canonical`, `robots` / `googlebot` with `max-image-preview:large`
- Open Graph + Twitter card → proper previews on WhatsApp, Facebook, X
- `apple-touch-icon`, theme colour, web-app meta for iOS
- `preconnect` / `dns-prefetch` for fonts and CDNs
- JSON-LD: **Church** + **WebSite** + typed **WebPage** + **BreadcrumbList**
  (all validated as parseable JSON)

`admin`, `finance`, `account` and the legacy `Chat.html` are `noindex` and excluded
from the sitemap.

### Files

- `robots.txt` — allows crawling, blocks private pages and Ahrefs/Semrush/MJ12
- `sitemap.xml` — 18 public URLs with priority and change frequency
- `assets/og-image.png` — 1200×630 branded share card (244 KB)

### After you deploy

1. Submit `https://prayerdome.net/sitemap.xml` in [Google Search Console](https://search.google.com/search-console)
2. Test a URL in the [Rich Results Test](https://search.google.com/test/rich-results)
3. Re-scrape your links in the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)

> **Set your real social handle.** `seo/pages.json` has `"twitter": "@prayerdome"`
> as a placeholder — update it (or remove it) and rerun the script.

---

## 3. AI Prayer Assistant — `/ai-prayer`

A member types *"I'm struggling with fear"* and gets matching scriptures, prayer
points, a written prayer and encouragement.

**It runs entirely in the browser.** No API key, no backend, no per-request cost,
and it keeps working offline. That was a deliberate choice: your site is static
HTML + Firebase, and putting a Gemini/OpenAI key in page source would expose it to
anyone who views source and lets strangers bill your account.

- **19 topics** — fear, grief, provision, healing, family, marriage, guidance,
  forgiveness, depression, strength, protection, thanksgiving, faith, salvation,
  work/study, addiction, church, nation, plus a general fallback
- **~114 scriptures**, all KJV (public domain — no licensing issue)
- **Matcher** scores exact phrases above whole words above stems, so
  *"my mother passed away"* → grief and *"i lost my job and cant pay rent"* → provision
- **Honest fallback** — gibberish returns a general prayer and says it couldn't
  match, rather than confidently guessing wrong
- **Crisis safety** — self-harm language surfaces a support banner *above all other
  content*, pointing to pastoral contact and prayer support. Ordinary sadness does
  not trigger it.
- Read-aloud, copy, share, and prayers saved locally to the device
- Deep links: `/ai-prayer?topic=fear` or `/ai-prayer?q=I+am+afraid`

### Adding a topic

Append to `PD_TOPICS` in `ai-prayer-data.js`. Put natural phrasings in `match` —
what people actually type (`"my marriage is falling apart"`), not just keywords.

### If you later want a real LLM

Keep this library as the offline fallback and add a Firebase Cloud Function that
holds the API key server-side. Never call the model directly from the browser.

---

## 4. Live Service — `/live`

Your supplied copy, used verbatim, on a page built around the tap-to-play flow you
described.

It reads the **same Firestore collections your admin dashboard already writes**
(`liveStatus/current`, `liveChat`, `liveRecordings`), so starting a stream from
`admin.html` or `video.html` lights this page up with no extra wiring.

- Big tap-to-play button; HLS via `hls.js` with auto-reconnect on stream errors
- Live/offline state driven by a Firestore listener — flips in real time
- Live viewer count (increments on watch, decrements on leave)
- Live chat with a **"send as prayer request"** toggle — those also post to the
  prayer wall so the team can follow up after the broadcast
- Sermon archive from `liveRecordings`, click to replay
- "Notify me when live" — browser notification the moment a broadcast starts
- Weekly schedule and share button

`video.html` is untouched and still handles broadcasting. `/live` is the
member-facing viewing page.

---

## 5. Routing, PWA and caching

**`vercel.json`** (new) — clean URLs, so `/bible` serves `bible.html`. Includes
301s for legacy paths (`/livestream` → `/live`, `/donate` → `/give`), security
headers (HSTS, nosniff, frame options) and sensible cache headers.

**`firebase.json`** — kept working, and fixed two real bugs:
- `/events` pointed at `event.html` (the other events page)
- `/finance` pointed at `finance-report.html`, **which does not exist** — that
  route was a guaranteed 404

Both hosts now expose identical routes.

**`manifest.json`** — added `id`, `scope`, a maskable icon (stops Android cropping
your logo badly) and app shortcuts for Bible / Prayer / Assistant / Live.

**`sw.js`** — rewritten, and this one matters:
- The old worker was **cache-first for everything**, which meant returning visitors
  would keep seeing the old site after every deploy, possibly forever. HTML is now
  **network-first**, falling back to cache offline.
- Firebase/auth/Cloudinary calls are **never** cached (the old one cached them,
  which can serve stale auth state)
- Old caches are deleted on activate; range requests bypass the worker so audio and
  video seeking works

---

## 6. Tests

```bash
node tests/assistant.test.js                    # 21 assertions, no deps
npm install --no-save jsdom && node tests/pages.test.js   # 36 assertions
python3 seo/apply-seo.py --check                # SEO drift check
```

All passing. Covers topic matching, DOM rendering, localStorage round-trip,
**XSS escaping of user input**, the crisis path, and that `live.html` contains every
element id its script binds to — that last one catches a renamed id that would
otherwise break the page silently at runtime.

---

## 7. Worth knowing

**Your Cloudinary API secret is committed in `live-stream-config.js`.** Anyone who
can read that file can use your Cloudinary account. It's client-side JS, so it's
public to every visitor. I left it alone rather than break your streaming, but you
should **rotate that secret** and move signing to a Cloud Function. Same applies to
the API key in the same file.

The Firebase web config in the HTML is fine to be public — that's normal — but it
means **your Firestore security rules are the only thing protecting your data.**
Worth reviewing that prayer requests marked private, member records and admin
collections are actually locked down server-side.

---

## 8. Suggested next steps

From your roadmap, in the order I'd tackle them:

1. **Firestore security rules audit** — highest value, lowest visibility
2. **Rotate the Cloudinary secret**
3. **Admin analytics dashboard** — the data is already in Firestore; it needs
   Chart.js and aggregate queries
4. **Devotional scheduler** — `devotional-data.js` is static; moving it to Firestore
   with a publish date gives you the admin publishing dashboard
5. **Mobile app** — the PWA work here is the foundation; Capacitor would wrap it
   with the least effort since it reuses these exact pages
6. **Recurring donations / mobile money** — needs a payment provider decision first
   (Flutterwave and Paystack both handle Zambian mobile money)
