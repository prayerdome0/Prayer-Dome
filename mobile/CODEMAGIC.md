# Codemagic CI/CD

`codemagic.yaml` in the repository root builds and verifies Prayer Dome on
[Codemagic](https://codemagic.io). It mirrors the GitHub Actions workflows kept
in `ci/verify.yml` and `mobile/android-build.yml`, so the two providers produce
the same artifacts from the same source.

## Workflows

| Workflow | Runs on | What it does |
| --- | --- | --- |
| `web-verify` | push + pull request on `main` and `arena/*` | `npm ci`, `npm run lint`, `npm test`, `npm run functions:verify`, `npm run build:vercel` |
| `android-debug` | push on `main` and `arena/*` | Capacitor sync, debug APK plus unsigned release APK/AAB, uploaded as build artifacts |
| `android-release` | tag `v*` (for example `v1.2.0`) | full verification, signed release APK and AAB, signature check, optional Google Play upload |

Every Android workflow runs the same two commands a local build runs:

```sh
npm ci                 # Capacitor CLI + plugins
npm run mobile:sync    # rebuild mobile/www and sync it into android/
cd android && ./gradlew assembleDebug bundleRelease assembleRelease
```

`scripts/prepare-mobile.mjs` decides what lands in the packaged app, so the
website at the repository root stays the single source of truth.

## Setting up Codemagic

1. Codemagic → **Applications → Add application** → choose this repository and
   the **Android** project type. Codemagic reads `codemagic.yaml` automatically;
   no UI-based build steps are needed.
2. Add the environment variables below under
   **Codemagic → Application → Environment variables** and mark them
   **secure**. They are application-level, so every workflow can read them, and
   they use the **same names as the GitHub Actions secrets** — the values only
   have to be collected once per provider.

| Variable | Required for | Value |
| --- | --- | --- |
| `GOOGLE_SERVICES_JSON` | native push notifications | base64 of `android/app/google-services.json` |
| `ANDROID_KEYSTORE_BASE64` | signed releases | base64 of the upload keystore (`.jks` / `.keystore`) |
| `ANDROID_KEYSTORE_PASSWORD` | signed releases | keystore password |
| `ANDROID_KEY_ALIAS` | signed releases | key alias |
| `ANDROID_KEY_PASSWORD` | signed releases | key password |
| `PLAY_UPLOAD_KEY_SHA1` | wrong-key gate | SHA-1 of the upload key certificate (Play Console → **App integrity → Play app signing**). When set, `android-release` fails a bundle signed with any other key instead of letting Play reject the upload later. Without it the workflow still prints the bundle's fingerprint for review. |

Create the base64 values on any machine:

```sh
base64 -w 0 android/app/google-services.json > google-services.b64   # macOS: base64 -i
base64 -w 0 android/release.keystore     > keystore.b64
```

Without `GOOGLE_SERVICES_JSON` the app still builds and falls back to web push
delivery. Without the keystore variables `android-debug` still produces an
installable **debug** APK and unsigned release outputs; `android-release`
deliberately fails so an unsigned build can never be published by mistake.

## Publishing a release

```sh
# 1. Make sure the version is bumped in android/app/build.gradle
#    (versionCode + versionName) and the change is on main.
# 2. Tag it — the tag is what starts the signed build.
git tag v1.2.0
git push origin v1.2.0
```

Codemagic then runs `npm run verify:all`, builds the signed APK/AAB, verifies
the signatures with `apksigner`/`jarsigner`, checks the bundle with
`scripts/play-signing.mjs` against `PLAY_UPLOAD_KEY_SHA1` (the fingerprint of
the upload key certificate Play has on file) and attaches both files to the
build page. The "wrong key" failure Play reports for a mismatch is explained in
**[PLAY-UPLOAD-KEY.md](PLAY-UPLOAD-KEY.md)**.

The Play Console side of the release — listing assets, the policy forms and
the checklist before the first production upload — is in
**[PLAY-STORE.md](PLAY-STORE.md)**.

Google Play upload is opt-in. Connect Play under
**Codemagic → Teams → Integrations**, then add to the `android-release`
workflow:

```yaml
    publishing:
      google_play:
        credentials: <integration name>
        track: internal
        submit_as_draft: true
```

## Local verification

The same checks run offline:

```sh
npm run verify:all        # lint + full test suite + Functions install/verify
node tests/codemagic.test.js   # validates codemagic.yaml itself
npm run mobile:build:debug     # local debug APK without Codemagic
```

`tests/codemagic.test.js` parses `codemagic.yaml`, checks that every
`npm run …` step exists in `package.json`, that both CI providers use the same
secret names, and that the signing heredoc is written correctly. A broken
Codemagic configuration therefore fails `npm test` before it fails a release.
