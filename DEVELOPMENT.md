# Prayer Dome — Development & Deployment

This document is for maintainers and developers. Member-facing documentation
lives in `README.md` and the website user guide.

## Local development

```bash
npm install          # install dependencies
npm run verify:all   # lint + full test suite + Cloud Functions verify + Vercel bundle
npm run dev          # local preview server (http://localhost:8000)
npm test             # the test suite alone
npm run lint         # production validation + managed SEO check
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
  (brand system) and `assets/pd-motion.js` (reduced-motion-aware animation).
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
