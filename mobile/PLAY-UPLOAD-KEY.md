# Play upload key: "Your Android App Bundle is signed with the wrong key"

Google Play refused an App Bundle with:

> Your Android App Bundle is signed with the wrong key. Ensure that your App
> Bundle is signed with the correct signing key and try again. Your App Bundle
> is expected to be signed with the certificate with fingerprint:
> `SHA1: 8D:25:36:9B:7B:3B:0C:89:9C:00:5E:DE:E4:63:11:08:CA:15:EF:73`
> but the certificate used to sign the App Bundle you uploaded has fingerprint:
> `SHA1: A5:9D:61:1D:3C:E4:B0:46:E1:C2:E2:85:40:A3:BC:CF:FF:30:03:B2`

Nothing is broken in the app or in this repository. Play has **two different
keys** for an app, and the bundle was signed with a key that is not the one Play
verifies:

| | Who holds it | What it does |
| --- | --- | --- |
| **Upload key** (a.k.a. upload certificate) | You / your CI / your hosted builder | Signs the `.aab` **before** upload. Play checks it to prove the release came from you. **This is the key Play is complaining about.** |
| **App signing key** (a.k.a. deployment key) | Google, when Play App Signing is on | Re-signs the app for devices. It is the fingerprint APIs, App Links and Firebase see. |

Play accepts an upload only when the bundle carries the **registered upload key
certificate**. The error means the bundle carries a different one — a new
keystore, another machine, another builder, another app's key, or a key that was
replaced without Play being told.

> If the package name of the bundle does not match the listing, Play reports a
> different error. Confirm both: the app's package name is shown on the Play
> Console app dashboard, and it is printed by
> `node scripts/play-signing.mjs --bundle <file.aab>` from the bundle itself.
> This repository's Capacitor app is `net.prayerdome.app`
> (`android/app/build.gradle`, `capacitor.config.json`); the App Links file
> `.well-known/assetlinks.json` references the hosted-builder package
> `co.median.android.qdoxnjx`. A bundle can only update the listing whose
> package name it carries.

## 1. Fingerprint the bundle before uploading it

```sh
npm run signing:check -- --bundle "Prayer Dome.aab"
# or, directly:
node scripts/play-signing.mjs --bundle path/to/app-release.aab
node scripts/play-signing.mjs --keystore android/release.keystore --bundle path/to/app-release.aab
```

The report prints the SHA-1 and SHA-256 of every certificate it can find, in the
same format Play uses:

```
Source                               SHA-1                                              SHA-256
-----------------------------------  -------------------------------------------------  ------------------------------------------------------------------
app-release.aab — META-INF/CERT.RSA  A5:9D:61:1D:3C:E4:B0:46:E1:C2:E2:85:40:A3:BC:CF:FF   …
```

Compare the SHA-1 with **Play Console → App integrity → Play app signing →
Upload key certificate**. Add the check to the release so the mistake is caught
before the upload:

```sh
node scripts/play-signing.mjs --bundle app-release.aab --expect-sha1 8D:25:36:9B:7B:3B:0C:89:9C:00:5E:DE:E4:63:11:08:CA:15:EF:73
# exit 0 → safe to upload;  exit 1 → Play will reject this bundle
```

CI runs the same check: set the SHA-1 of the registered upload certificate in
the `PLAY_UPLOAD_KEY_SHA1` secret/variable and `android-release` (Codemagic) and
the GitHub Android workflow fail a wrong-key bundle before anyone uploads it.
See [CODEMAGIC.md](CODEMAGIC.md).

## 2. Fix it — pick the path that matches your situation

### Path A — you still have the keystore that signed the accepted releases

Re-sign (or rebuild) with it. Nothing in Play needs to change.

*Android Studio*: **Build → Generate Signed Bundle / APK → Android App Bundle**,
then choose your `.jks`, the alias and the passwords.

*A local Gradle build or CI*: point the build at that keystore through
`android/keystore.properties` (already gitignored), which `android/app/build.gradle`
reads:

```properties
storeFile=/absolute/path/to/release.keystore
storePassword=…
keyAlias=…
keyPassword=…
```

```sh
npm run mobile:sync
cd android && ./gradlew clean bundleRelease
node ../scripts/play-signing.mjs --bundle app/build/outputs/bundle/release/app-release.aab
```

For Codemagic or GitHub Actions, replace the keystore secret with the base64 of
this file and the matching passwords/alias
([CODEMAGIC.md](CODEMAGIC.md) lists the five variable names):

```sh
base64 -w 0 release.keystore > keystore.b64     # macOS: base64 -i release.keystore
```

Losing this key is recoverable (Path B); losing the *app signing* key is not,
which is exactly why Play App Signing should stay enabled.

### Path B — the upload key is lost, or you want a new one

Play can replace the upload key while keeping the app signing key, the listing
and every installed app untouched. One request per app:

1. Create the new upload key (25-year validity, RSA 2048+):

   ```sh
   keytool -genkeypair -v -keystore upload-keystore.jks -alias upload \
     -keyalg RSA -keysize 2048 -validity 9125
   keytool -export -rfc -keystore upload-keystore.jks -alias upload \
     -file upload_certificate.pem
   ```

2. In Play Console open the app → **Protected with Play → Play Store
   protection → Manage Play app signing** (older consoles: **Test and release →
   App integrity → App signing**) → **Upload key certificate** → the
   **Request upload key reset** button.
3. Give the reason, attach `upload_certificate.pem`, and submit. Google reviews
   it — usually **one to two business days** — and emails the account owner when
   the new upload key is registered.
4. Sign the next release with the **new** keystore, verify with
   `npm run signing:check -- --bundle … --expect-sha1 <new fingerprint>`, then
   upload. Replace the CI keystore secret with the new `.jks`, and store the
   base64 and passwords somewhere outside the repository.

Note the fingerprint in Play Console changes after the reset: use the SHA-1
Play shows *after* the new key is registered for
`PLAY_UPLOAD_KEY_SHA1` and for any fingerprint you pin in this repository.

### Path C — the bundle came from a hosted builder (Median, GoNative, …)

A hosted builder signs with **its own** keystore, so its AAB cannot be
re-signed by hand and will keep failing until the two keys agree:

* In the builder's Android settings, download/replace the signing keystore with
  the one Play has registered (the same `.jks`/passwords as Path A) and rebuild; **or**
* keep the builder's key and register it with Play through a reset (Path B) —
  attach the builder's certificate as the new upload key; **or**
* build the release from this repository instead, where Codemagic/GitHub Actions
  own the keystore secrets.

Whichever path you take, the key that ends up signing uploads must be the one
Play lists under **Upload key certificate**, and it should be stored offline for
safekeeping — a zip of the `.jks`, the alias and both passwords in a password
manager or safe.

## 3. Keep App Links (and API fingerprints) pointing at the right key

Android App Links are verified against the **app signing key**, not the upload
key, because that is the certificate the installed app presents (Google
re-signs the delivered APK). `.well-known/assetlinks.json` must therefore list
the SHA-256 from **Play Console → App integrity → Play app signing → App signing
key certificate**:

```sh
node scripts/play-signing.mjs --assetlinks co.median.android.qdoxnjx \
  --expect-sha256 <app signing key SHA-256 from Play Console>
```

That prints the `target` block to paste into `.well-known/assetlinks.json`
(`scripts/build-vercel.mjs` copies the file into the published bundle). Update
the same fingerprints in Firebase, Google Sign-In and any other API that
authenticates by certificate. If more than one APK can open the site (for
example a hosted-builder build and a Capacitor build), keep one `target` per
package name inside the same JSON array.

## 4. Release checklist

- [ ] `versionCode` in `android/app/build.gradle` is higher than the last
      upload for that package name (`versionName` is for humans)
- [ ] `npm run signing:check -- --bundle <file>.aab` prints the fingerprint Play
      lists under **Upload key certificate**
- [ ] `PLAY_UPLOAD_KEY_SHA1` is set in CI so a wrong-key bundle fails the build
- [ ] the keystore, alias and passwords are backed up outside the repository
- [ ] `.well-known/assetlinks.json` matches the **app signing key** SHA-256
- [ ] Play Console → **App integrity** shows Play App Signing enabled

## 5. Useful commands

```sh
# Everything this repository ships
node scripts/play-signing.mjs --help

# The certificate inside an App Bundle (needs Java, readable everywhere)
keytool -printcert -jarfile app-release.aab
jarsigner -verify app-release.aab

# The certificate of an APK (v2/v3 signature block)
apksigner verify --print-certs app-release.apk

# The certificate inside a keystore
keytool -list -v -keystore release.keystore -alias <alias>
```

`scripts/play-signing.mjs` works without Java: it reads Java keystores
(certificates only — the private key is never decrypted), PKCS#12 files (when
`openssl` is installed), PEM/DER certificates, and the signature block inside an
`.aab` or `.apk` with a built-in ZIP and PKCS#7 reader.
