# Google Play release

Prayer Dome ships to Android as a Capacitor app: the website at the repository
root is packaged into `android/` by `npm run mobile:sync`, and the signed App
Bundle is built by CI. This page is the Play Console side of that path —
[Codemagic](CODEMAGIC.md) covers the build itself.

| | |
| --- | --- |
| Application ID | `net.prayerdome.app` |
| Version | `android/app/build.gradle` → `versionCode` + `versionName` |
| Min / target SDK | 24 / 36 (`android/variables.gradle`) |
| Artifact to upload | `.aab` (App Bundle) from the `android-release` workflow |
| Keystore | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` |
| Push | `GOOGLE_SERVICES_JSON` (base64 of `android/app/google-services.json`) |

## 1. One-time Play Console setup

1. Create the app in [Play Console](https://play.google.com/console) with the
   application ID above and the default language.
2. **App integrity → Play app signing** stays enabled (the AAB is signed with
   the upload key; Google re-signs for delivery).
3. Create the upload keystore once and store it with the secrets above:

   ```sh
   keytool -genkeypair -v -keystore android/release.keystore \
     -alias prayer-dome -keyalg RSA -keysize 2048 -validity 10000
   base64 -w 0 android/release.keystore > keystore.b64   # macOS: base64 -i
   ```

   Keep the keystore and its passwords outside the repository — losing them
   means a new upload key (Play Console → App integrity → Request upload key
   reset).
4. Fill in **Store settings** and the policy forms in section 3 below.

## 2. Publishing a build

```sh
# 1. Bump versionCode (Play requires a higher number for every upload) and
#    versionName in android/app/build.gradle, then merge to main.
# 2. Tag it — the tag starts the signed build in Codemagic and GitHub Actions.
git tag v1.2.0 && git push origin v1.2.0
```

Codemagic runs `npm run verify:all`, builds and signature-checks the signed APK
and AAB, and attaches both to the build page (`android-release` deliberately
fails without the keystore secrets, so an unsigned bundle can never be
published). Upload the `.aab`:

- **Testing → Internal testing → Create new release** for the first smoke test
  with the ministry team (fast review, no production impact),
- then **Production → Create new release** with the same bundle and promote
  through closed/open testing as needed.

Google Play upload can also be automated: connect Play in Codemagic and add the
`publishing.google_play` block shown in [CODEMAGIC.md](CODEMAGIC.md#publishing-a-release).

## 3. Store listing and policy forms

| Requirement | Where it comes from |
| --- | --- |
| App icon 512 × 512 PNG | `assets/logo.png` (exactly 512 × 512) |
| Feature graphic 1024 × 500 | render from `assets/hero-worship.jpg` or `assets/logo-master.png` |
| Phone screenshots (2–8) | capture from the app or `https://prayerdome.net` |
| App name (30 chars) | Prayer Dome |
| Short description (80 chars) | one line on the ministry and the app |
| Full description (4000 chars) | reuse the website copy (`index.html` hero + features) |
| Privacy policy URL | `https://prayerdome.net/privacy.html` |
| Account deletion | in-app **Delete Account** on the account page; state the same URL for deletion requests |
| Data safety | declare what the app collects: name, email, phone, photos/media, device push token, approximate location (prayer times), plus the diagnostics Firebase reports |
| Content rating questionnaire | religious/ministerial content, no ads |
| Target audience | 13+ (the registration form refuses under-13 accounts) |
| Ads | none |
| App access | most of the app is public; the Admin Console and Finance Portal are role-restricted — list the demo credentials in the "instructions for reviewers" field |

Answers must match the permissions the bundle requests
(`android/app/src/main/AndroidManifest.xml`): internet and network state,
camera and microphone (live audio/video calls, voice notes, profile photo),
media read access (upload the member's own photos/videos/audio),
`POST_NOTIFICATIONS` (announcements, prayer reminders, daily verse) and
`WAKE_LOCK` (background verse delivery). All of them are optional in the
product: only a member who places a call, records a voice note or enables
notifications sees the prompt.

## 4. Before the first production release

- [ ] `npm run verify:all` green on the tagged commit
- [ ] `tests/codemagic.test.js`, `tests/deployment.test.js` and `tests/pwa.test.js` pass (they validate the CI contract, the hosting config and the installable-app contract)
- [ ] Install the internal-testing build on a real device and check: sign-in persists across a restart, announcements arrive as push, live stream plays, chat sends text/photos/voice notes, offline reads a downloaded Bible chapter, and the "Install the Prayer Dome app" prompt is absent (the packaged app is already installed)
- [ ] Bump `versionCode` before every upload — Play rejects a duplicate
