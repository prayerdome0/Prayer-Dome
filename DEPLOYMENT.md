# Deployment checklist

## Status

The public bundle and application checks pass locally. This is **not a sign-off
for unrestricted production use**: the live/community security review and
external-service checks below remain launch gates. No production deployment,
credentials, database contents, or project settings were changed.

## Reproducible checks

Use Node.js 22 and Python 3:

```sh
npm ci                        # also npm ci in functions/
npm run verify:all            # lint, application + packaging + HTTP tests, Functions load
npm run build                # allowlisted public files in dist/
npm audit --audit-level=moderate
npm --prefix functions audit --audit-level=moderate
npm run test:rules            # needs Java 21; downloads pinned Firebase CLI/emulator
npm run dev                  # public bundle + local APIs on port 8000
```

`test:rules` targets only `demo-prayer-dome`, never the production database.
Its authorization tests were added but could not be executed in the preparation
environment: Java was unavailable and binary download attempts were blocked.
Run them successfully before deploying rules. The other commands above were
validated locally, including HTTP responses and private-file isolation.

The verification workflow is staged in `ci/verify.yml`, including emulator and
dependency checks. As described in DEVELOPMENT.md, a maintainer must activate it
with `node scripts/install-workflows.mjs` if `.github/workflows/` is absent.
Require a passing Verify check before merging into the production branch.

The same verification and Android builds also run on Codemagic: `codemagic.yaml`
defines `web-verify`, `android-debug` (debug APK plus release outputs on every
push) and `android-release` (signed APK/AAB from a `v*` tag). The secure
variables and the one-time application setup are documented in
**[mobile/CODEMAGIC.md](mobile/CODEMAGIC.md)**; `tests/codemagic.test.js` keeps
that configuration valid on every `npm test` run. Play accepts a bundle only
when it carries the upload key certificate registered for the app: set
`PLAY_UPLOAD_KEY_SHA1` so a wrong-key bundle fails the release instead of the
upload, and follow **[mobile/PLAY-UPLOAD-KEY.md](mobile/PLAY-UPLOAD-KEY.md)**
when Play reports "signed with the wrong key".

## Vercel website

1. Import this repository using the existing `vercel.json` (Other framework,
   Node 22, build `node scripts/build-vercel.mjs`, output `dist`). Do not publish
   the repository root as a static directory.
2. The upload filter includes both shared API handlers and the lockfile. Keep
   `functions/translate.js` and `functions/share.js` in serverless uploads.
3. Automatic deployments are intentionally enabled only for `main`; this work
   stays on the session branch. Use a manual preview deployment or review/merge
   before a production deployment. The local preview is not a Vercel deployment.
4. Check `/api/health`, `/api/news`, `/api/radio`, `/lessons`, the language picker,
   an unknown URL, and sharing previews on the deployed host. `/package.json`,
   `/firestore.rules`, and `/functions/index.js` must not be publicly served.
5. Vercel does **not** deploy Firebase Functions or Firestore rules.

## Firebase

Use an explicitly selected project; do not guess a project from the browser's
public Firebase config:

```sh
firebase deploy --only firestore:rules --project <project-id>
firebase deploy --only functions --project <project-id>
# Alternative to Vercel hosting, not an additional required step:
firebase deploy --only hosting --project <project-id>
```

Firebase Hosting now builds and publishes `dist/`, not repository sources.
The Firestore rules target is explicitly configured. Firebase Hosting does not
implement every Vercel-only `/api/*` handler; Vercel remains the recommended
website target. Confirm feature parity before switching hosting providers.

### Bible reader (API.Bible)

NIV and The Message (MSG) are read from API.Bible through `/api/bible`. The
server-side API.Bible key is **required**; a `MSG_BIBLE_ID` by itself is not
sufficient to authorize requests. Add the key in Vercel → Settings → Environment
Variables (or with `vercel env add`) and never put it in a committed file:

```sh
vercel env add BIBLE_API_KEY production   # your API.Bible key (required)
```

**The key does not have to cost anything.** API.Bible's free Starter plan is
$0/month and includes up to three licensed Bibles (plus every open-access one),
5,000 API calls a month, for non-commercial use. The Message is one of the
choices, so MSG can be read on the free plan. The steps, printed by the setup
guide and returned by `GET /api/bible?action=setup&version=MSG`:

1. Create a free account at <https://api.bible/sign-up>. No card is asked for.
2. In the dashboard (<https://api.bible/dashboard>), add **The Message** (and
   **New International Version**) to the account. Starter allows three licensed
   Bibles; if all three slots are taken, remove one and add the edition you want.
3. Copy the account API key.
4. Add it to Vercel as `BIBLE_API_KEY` (above) and redeploy.
5. Check it: `GET /api/bible?action=status&version=MSG` should say
   `"configured": true`.

With no key, `npm run bible:setup` prints the same steps without needing one.
Readers never see these instructions — the reader shows a plain note that the
translation is not switched on yet plus a collapsed "site owner?" section, and
no text from any other translation is shown in its place.

Add the key to every Vercel environment you use (Production, Preview, and/or
Development). Vercel environment changes apply to new deployments, so redeploy
after saving the key. The Bible IDs are optional, non-secret overrides; without
one, the server resolves each translation from the API.Bible account's Bible
list. To pin an exact ID instead of using that account list:

```sh
vercel env add NIV_BIBLE_ID production    # e.g. 78a9f6124f344018-01
vercel env add MSG_BIBLE_ID production    # the ID from your account
```

Check the IDs the account is entitled to before deploying (run locally, the key
is read from the environment and never printed):

```sh
BIBLE_API_KEY=<your key> npm run bible:ids -- --verify
```

After deploying, `GET /api/bible?action=bibles` reports the resolved IDs and
`GET /api/bible?action=status&version=NIV` reports the provider and the ID
source. If an edition is missing from the account, the reader shows a
"setup required" note — with the free Starter-plan steps attached in
`GET /api/bible?action=setup&version=NIV|MSG` — and no text from any other
translation.

### Cloudinary callable function

Copy `functions/.env.example` to `functions/.env.<project-id>` and supply your
cloud name, API key and upload preset. Put the secret in Secret Manager:

```sh
firebase functions:secrets:set CLOUDINARY_API_SECRET --project <project-id>
```

Deploy Functions after configuring the values and secret. Legacy
`functions:config:set` is no longer used. The callable requires authentication,
signs canonical Cloudinary parameters, and fixes uploads to a per-user folder.
Clients must submit the returned `folder`, `upload_preset`, `timestamp`, `apiKey`
(as `api_key`) and `signature` unchanged. Test a real upload with your preset;
verify its allowed formats, size limits and moderation in Cloudinary.

## Required security and service checks before launch

- **Audit existing administrators:** previous rules allowed profile/membership
  self-promotion. Review `users` and `memberships` for unauthorized roles using
  trusted administrator tooling. Rule changes do not repair existing data.
  Bootstrap legitimate admins via trusted server tooling/Firebase Console,
  never a client-side role assignment.
- **Live signaling is still public-write by design.** The `liveSignals` rules
  permit guests to exchange WebRTC signaling. This also permits tampering and
  abuse. Before enabling public broadcasting, implement authenticated (possibly
  Firebase Anonymous Auth) per-viewer ownership and broadcaster-only answer/ICE
  writes, or move signaling behind an authenticated service. Do not treat a
  random client-generated viewer ID as authorization. This requires coordinating
  viewer code, broadcaster code, project Auth settings and rules.
- Public contact/report/chat submission also needs server-side abuse controls,
  quotas and moderation. Review financial/profile read permissions and all
  member-owned writes against your privacy policy. The targeted rule fixes are
  not a complete security audit of every collection.
- Verify Firebase Auth authorized domains, password reset/email verification,
  OAuth redirect behavior, indexes, billing, quotas, and restricted public API
  keys. Test ordinary-member and administrator accounts separately.
- Smoke-test uploads, prayer/testimony moderation, membership approval, Academy
  certificates, giving/support, notifications, and live playback with real
  services. Confirm TURN/media server availability and third-party translation
  behavior; these were not validated using production credentials.
- Android store release/signing and device testing are separate release gates.

## After deployment

Check `/api/health` and provider logs, then test both a fresh browser and a
returning installed PWA (including offline pages). Watch errors, quota usage
and rejected Firestore operations. Keep the previous Vercel deployment available
for rollback. Roll back code/config deliberately; never restore the vulnerable
role-assignment rules as a quick fix.
