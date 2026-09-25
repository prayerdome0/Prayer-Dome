# Prayer Dome — Development & Deployment

This document is for maintainers and developers. Member-facing documentation
lives in `README.md` and the website user guide.

## Local development

```bash
npm install          # install dependencies
npm run verify:all   # lint + full test suite + Cloud Functions verify + Vercel bundle
npm run dev          # local preview server (http://localhost:8000)
npm test             # the test suite alone
npm run lint         # icon build check + production validation + managed SEO check
```

The test suite (`tests/*.test.js`) runs in CI on every push. New production
behaviour should ship with regression tests the same way.

## Android builds through GitHub Actions

The Android app (`net.prayerdome.app`, version 1.1.0) is built entirely on
GitHub's servers — no local Android Studio is required. The workflow files are
staged at `mobile/android-build.yml` (Android) and `ci/verify.yml` (verification)
because the integration that pushes this branch cannot create files under
`.github/workflows/`. A maintainer activates CI once with:

```bash
node scripts/install-workflows.mjs
git push
```

From then on every push to `main`:

1. Runs the full verification suite (`ci/verify.yml`).
2. Prepares the Capacitor web bundle, builds `assembleDebug`, `assembleRelease`
   and `bundleRelease`, and attaches the APK/AAB artifacts to the run
   (`mobile/android-build.yml`).

### Optional repository secrets

| Secret | Purpose |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | Produces signed release APK/AAB ready for Google Play |
| `GOOGLE_SERVICES_JSON` (base64) | Enables native Firebase Cloud Messaging push inside the Android app |

## Production deployment

- **Website** — deploy the repository root with the Vercel preset
  (`vercel.json`, `npm run build:vercel` builds the public bundle).
- **Cloud Functions** — `firebase deploy --only functions` (see `functions/`).
- **Firestore rules** — `firebase deploy --only firestore:rules`
  (`firestore.rules`; covers team, resources, live, privacy and every
  member-data collection).
- **Android** — download the signed AAB from the GitHub Actions run and upload
  it to Google Play Console.

## Architecture notes

- Static, multi-page web app served from the repository root; shared layers in
  `assets/pd-app.js` (app shell, notifications, i18n), `assets/pd-brand.css`
  (brand system), `assets/pd-icons.css` + `assets/pd-icons.js` (icon system,
  see below) and `assets/pd-motion.js` (reduced-motion-aware animation).
- **Live streaming** — `assets/pd-live-webrtc.js`: WebRTC one-to-many with
  Firestore signaling, TURN relays for carrier NAT, optional WHIP/WHEP media
  server via `assets/pd-live-server-config.js`, Cloudinary rolling recording.
- **Uploads** — `assets/pd-upload.js`: native device picker → preview →
  background upload with progress/retry to the ministry's media buckets.
- **Certificates** — `assets/pd-certificate.js` renders certificates on
  canvas using the real Prayer Dome logo; names always come from the member
  profile (`users/{uid}.fullName`).
- **Offline** — `sw.js` precaches the app shell; the Bible caches every read
  chapter locally (`pd_bible_cache_v1`) so downloaded chapters open offline.

## Icon system

The app uses **one icon library: [Lucide](https://lucide.dev/icons)** (v1.48.0,
ISC licence). Icons are SVGs rendered through CSS masks, so they stay sharp at
any size and pixel density and take the surrounding text colour (`currentColor`)
in light and dark mode. Two glyphs Lucide lacks, `hands-praying` and
`latin-cross`, are drawn on the Lucide grid in `scripts/icons/custom/`. Social
logos come from Simple Icons (CC0) as `brand-*`. Emoji and icon fonts are not
used as UI icons, and `tests/icons.test.js` enforces this. The one exception is
the chat emoji keyboard (`data-pd-emoji-keyboard`), which inserts emoji into a
member's message.

```html
<i class="pd-i pd-i-bell" aria-hidden="true"></i>                  <!-- 1em, text colour -->
<i class="pd-i pd-i-heart-fill pd-i-lg"></i>                       <!-- filled variant, 1.25em -->
<button aria-label="Close"><i class="pd-i pd-i-x"></i></button>   <!-- icon-only: always label it -->
```

- **Size** with `font-size` or `pd-i-xs | sm | lg | 2x | 3x | 4x | 5x`;
  `pd-i-fw` gives a fixed width and `pd-i-spin` spins loaders. **Colour** with
  `color`. `-fill` variants exist for `circle`, `star`, `heart`, `bookmark` and
  `play`.
- **Pseudo-elements**: `mask: var(--pd-icon-<name>) center / contain no-repeat;`
  with `background: currentColor`. Variables are generated for every
  `--pd-icon-<name>` the CSS references.
- **In JavaScript**, write complete class names (`'pd-i-megaphone'`). Never
  build them (`'pd-i-' + name`, `pd-i-eye${x}`), because the build and tests
  find icons by scanning the source.
- **Saved values** (Firestore icons, radio stations, challenges): render them
  with `PDIcons.cls(value, 'pd-i-<fallback>')`. It also resolves the legacy Font
  Awesome names (`fas fa-church`) and emoji that older app builds still write.
  Page code that tests run outside a browser guards it as
  `window.PDIcons ? PDIcons.cls(...) : 'pd-i pd-i-<fallback>'`.
  `PDIcons.plain(label)` strips a leading emoji from labels saved before the
  migration.
- **Canvas capture**: html2canvas cannot paint CSS masks. Call
  `PDIcons.inline(clonedDoc.body)` in its `onclone` hook.
- **Stale markup**: `pd-icons.js` upgrades legacy `fas fa-*` markup it finds,
  for example from a script still cached during a deploy.

### Adding or changing icons

`assets/pd-icons.css` and `assets/pd-icons.js` are generated; never edit them by
hand. Use the Lucide name in markup, then rebuild:

```bash
npm i --no-save lucide-static@1.48.0   # only for icons that are not vendored yet
npm run build:icons                    # scans the source and writes both files
```

The build keeps only the icons in use in `scripts/icons/lucide-subset.json`,
so there is no runtime dependency and the bundle stays small (about 19 KB
gzipped for 277 icons). Set `LUCIDE_STATIC_DIR` to use another lucide-static
checkout. Unknown names fail the build, and `npm run lint` fails when the
generated files are stale.

- Custom glyphs go in `scripts/icons/custom/<name>.svg`: 24×24, 2px round
  stroke, `currentColor`.
- Brand marks go in `scripts/icons/brands/`; attribution is in its README.
- Legacy lookups live in `scripts/icons/legacy-fontawesome.json` and
  `legacy-emoji.json`.

**When deploying icon changes**, bump `CACHE_NAME` in `sw.js`. JS/CSS are
cached for 7 days and served stale-while-revalidate, so without the bump a
returning visitor can briefly see a newly added icon blank.
