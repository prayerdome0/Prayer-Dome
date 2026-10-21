# Android identity: why Prayer Dome "shows up as Chrome", and what actually fixes it

This note records the investigation behind the Chrome/Brave identification
report, what was wrong in the repository, what was changed, and the parts that
are decided by Android and the browser rather than by configuration here.

Short version: **the app that identifies itself as Chrome is a WebAPK that
Chrome installed.** Resetting or reinstalling it cannot make it a Brave app,
and `.well-known/assetlinks.json` does not influence that label at all. The
real defect this repository had was different, and it is fixed: the App Links
file only described the legacy hosted-builder listing and had no statement for
the app this repository actually builds.

---

## 1. Three different things can be installed under the Prayer Dome name

| What is installed | Android package | Who "installed" it | Shows in Settings → Apps |
| --- | --- | --- | --- |
| PWA installed from **Chrome** ("Add to Home screen") | `org.chromium.webapk.<hash>_v2` | Chrome | Yes — *installed by Chrome* |
| PWA installed from **Brave** | *(none — Brave creates a home-screen shortcut)* | Brave | No |
| The **Capacitor app** built from this repository / Play | `net.prayerdome.app` | Play Store or the APK | Yes — *installed by Play Store / Packager* |

Two facts drive the whole report:

* **A Chrome-installed PWA is a WebAPK.** Chrome asks Google's WebAPK minting
  server to build and sign a real APK; Play Services installs it. That APK has
  its own package name, its own entry in Settings → Apps, and Android records
  **Chrome as its installer**. Its WebView data lives inside Chrome's profile.
  Android 15 shows this correctly in App info; Android 14 and older mislabel
  WebAPKs as "installed by Play Store".

* **Brave does not mint WebAPKs.** Brave has no trusted minting server, so
  "Add to Home screen" produces a *shortcut* that opens the site in Brave, not
  an Android package. There is therefore no Brave-owned app for Android to
  identify. (Brave does support Trusted Web Activities — see §6.)

So "the app still identifies itself as Chrome after a reset" is Android
reporting the truth about a Chrome-installed WebAPK. It is not a misconfigured
manifest.

## 2. Digital Asset Links has no influence on that label

`assetlinks.json` answers exactly one question: *may this app open links for
this domain?* It is consulted for

* **App Links** when the app declares an `autoVerify` `VIEW` intent filter for
  the domain, and
* **Trusted Web Activities** when a TWA app launches the domain.

It is not read when Android decides which browser or store installed an app,
it does not rename anything in App info, and it cannot move an installation
from Chrome to Brave. Changing it will never change that label — which is why
the label must be fixed by installing the app from the browser you want, not by
editing JSON.

> User-agent spoofing is not a fix. Nothing in this repository rewrites
> `navigator.userAgent`; `tests/assetlinks.test.js` keeps it that way.

## 3. What was actually wrong in this repository

| Area | State found | Action |
| --- | --- | --- |
| `.well-known/assetlinks.json` | Only `co.median.android.qdoxnjx` (the legacy Median-hosted build). **No statement for `net.prayerdome.app`** | Added a statement for `net.prayerdome.app`; kept the legacy one so devices that still have that build keep verified links |
| Fingerprints supplied for verification | 3 × SHA-256, **3 × SHA-1** | Only the SHA-256 values can be used; see §4 |
| `manifest.json` | Valid; `id`, `start_url` (`/?source=pwa`), `scope` (`/`), names, icons, `display` correct; `prefer_related_applications: false` | Verified, unchanged |
| Hosting headers | `vercel.json` and `firebase.json` already serve the file as `application/json`, no redirects on the path; `scripts/build-vercel.mjs` publishes it | Verified, unchanged |
| `android/app/build.gradle`, `capacitor.config.json` | `net.prayerdome.app` in both | Verified — they agree, nothing to change |
| Trusted Web Activity | **None.** No `androidbrowserhelper`/Custom Tabs dependency, no TWA activity, no `LAUNCHING_BROWSER` metadata | Not applicable. The Capacitor app ships its own web assets (`webDir: mobile/www`) and renders them in its own WebView |
| App Links intent filter | **None.** `AndroidManifest.xml` has no `VIEW` filter for `prayerdome.net` | Left as is — see §6 |
| Browser identity / user agent | No spoofing anywhere | Verified |

Because the native app declares no App Links filter, the `assetlinks.json`
statement is dormant for it today. It becomes active the moment an `autoVerify`
filter is added, and it is required for any future TWA, so it is correct to
have it in place — but it is not what makes the installed app look like Chrome.

## 4. The six supplied fingerprints are not one list of six usable values

Android only accepts the **32-byte SHA-256** digest of the signing certificate.
`play-signing.mjs`, `keytool -list` and `apksigner` all print the SHA-1 value
first, and copying that into `sha256_cert_fingerprints` produces a file that
looks right and verifies nothing.

| # | Bytes | Usable in `assetlinks.json`? |
| --- | --- | --- |
| 1 `43:70:D7:…:B9:5C:70` | 32 | Yes — SHA-256. **Confirmed as the same certificate as 4** |
| 2 `8E:FE:79:…:AE:67:D5` | 32 | Yes — SHA-256, but not yet tied to this package |
| 3 `29:82:29:…:1D:83:0B:CA` | 32 | Yes — SHA-256, but not yet tied to this package |
| 4 `80:6D:53:…:F4:2B:0E` | 20 | **No — SHA-1.** Same certificate as 1 |
| 5 `A6:71:0E:…:39:27:CA` | 20 | **No — SHA-1** |
| 6 `B9:DB:A4:…:8E:DB:53` | 20 | **No — SHA-1** |

Fingerprint 1 is the value the supplied reference block paired with
`net.prayerdome.app`, so it is the one now published for that package.

**1 and 4 are one certificate** (supplied by the key owner as `Shai 256` /
`Shai 1` — the same key, once as SHA-256 and once as SHA-1). That is a useful
result rather than a sixth value: the SHA-1 is what Play, `keytool`, `apksigner`
and Firebase display, so it is the value you can match by eye against Play
Console, while the SHA-256 is the one the file must carry. It also means the six
supplied values are not six distinct keys — they look like **three certificates
each shown twice**. If the pairing holds, 2+5 and 3+6 are the other two:

| Certificate | SHA-256 | SHA-1 (to confirm) |
| --- | --- | --- |
| Prayer Dome (`Shai`) — published | 1 `43:70:D7:…` | 4 `80:6D:53:…` ✔ confirmed |
| unknown — not published | 2 `8E:FE:79:…` | 5 `A6:71:0E:…` ? |
| unknown — not published | 3 `29:82:29:…` | 6 `B9:DB:A4:…` ? |

Confirm any pair against a real artifact — supplying both values together makes
the tool require that **one certificate** carries both, so a SHA-1 from one key
and a SHA-256 from another cannot be mistaken for a match:

```sh
node scripts/play-signing.mjs --bundle app-release.aab \
  --expect-sha1 80:6D:53:AC:A3:CA:F6:D7:7D:F8:37:39:F4:F6:DE:43:F3:F4:2B:0E \
  --expect-sha256 43:70:D7:09:23:4E:F0:0B:A5:E0:88:1E:24:23:C6:1D:BB:76:48:F0:FB:31:1E:00:1F:D2:7B:D2:5A:B9:5C:70
```

Fingerprints 2 and 3 are valid SHA-256 but were supplied without a package;
they are **not** published, because a fingerprint next to a package is a
permission and a wrong one hands this domain's links to a different app. 4–6
cannot be used in `assetlinks.json` in any form — the schema has no SHA-1 field,
and adding one is silently ignored.

`npm run assetlinks:check` enforces all of the above and refuses a SHA-1 value.

### Does the published value belong to an upload key or the Play app signing key?

A SHA-1/SHA-256 pair you hold yourself (`Shai` — a keystore in your possession)
is by definition a **local/upload key**, not the key Google holds. Which one
Android compares against depends on how the APK on the device was signed:

| How the app was installed | Certificate Android compares | Action |
| --- | --- | --- |
| Play, **Play App Signing on** | Google's *app signing key* | Add that key's SHA-256 from Play Console → App integrity → *App signing key certificate*, **alongside** the current one. The upload key alone will not verify. |
| Play, Play App Signing off / sideloaded / CI `assembleRelease` | the key that signed the APK — your `Shai` key | Fingerprint 1 (already published) is correct |
| Built by the Median hosted builder | that builder's key | The `co.median.android.qdoxnjx` statement already covers it |

Keeping both fingerprints in one target is normal and safe: the file says "these
certificates may open links for this domain", and more than one is expected when
an app moves to Play App Signing. Removing the one that is still on a device is
what breaks links, which is why the legacy listing above was kept rather than
deleted.

### Establishing the certificate that is actually installed

App Links, and the certificate Android compares against, are verified against
the certificate that signed the **installed APK** — which, with Play App
Signing enabled, is Google's *app signing key*, not your *upload key*.

1. **Play-distributed** → Play Console → **App integrity → Play app signing →
   App signing key certificate** → SHA-256. This is the one that matters.
2. **Sideloaded / your own keystore** → print it from the artifact:
   ```sh
   node scripts/play-signing.mjs --bundle app-release.aab --assetlinks net.prayerdome.app
   # or
   apksigner verify --print-certs app-release.apk
   ```
3. Add the confirmed value to the `net.prayerdome.app` statement (keep the
   existing one if both certificates can genuinely sign the app — for example
   an upload key and a Play app signing key), then:
   ```sh
   npm run assetlinks:check
   npm run assetlinks:verify   # fetches https://prayerdome.net/.well-known/assetlinks.json
   ```

Let Google's own API confirm the deployment too:

```
https://digitalassetlinks.googleapis.com/v1/statements:list
  ?source.web.site=https://prayerdome.net
  &relation=delegate_permission/common.handle_all_urls
```

A verified statement appears in the response; a wrong fingerprint does not.

## 5. Why reinstalling did not clear the Chrome association

Uninstalling a WebAPK removes the package, but the next install from Chrome is
again a Chrome-minted WebAPK with Chrome as its installer, and the app's web
data still lives in Chrome's profile. Android has no "change the installing
application" operation. Clearing browser data is likewise not a fix — it only
discards the WebAPK's local storage.

Two supported ways out, depending on what you actually want:

* **A Brave-launched install.** In Brave, open `https://prayerdome.net/` and use
  **⋮ → Add to Home screen**. Uninstall the Chrome copy first so the two do not
  compete. Expect a Brave *shortcut*: it launches Prayer Dome's standalone
  window in Brave and does not appear in Settings → Apps, because Brave does
  not mint WebAPKs. That is a platform limitation, not a manifest fault.
* **A real Android app.** Install `net.prayerdome.app` from Play. Its identity
  is fixed and it is listed by its own package name and publisher — the app
  label is no longer about Chrome, because a browser is not involved.

If what matters is that the *installed app* opens Brave instead of Chrome, that
is a Trusted Web Activity decision, not a PWA one.

## 6. If a Trusted Web Activity is wanted

This repository does not ship a TWA. A TWA is a small native app that opens the
site in the user's browser engine full screen, and **the browser it opens in is
chosen at launch, not by the manifest**:

* with `android-browser-helper`, `TwaProviderPicker` prefers the user's
  **default browser** if it supports Trusted Web Activities, then any installed
  browser that does, and falls back to a Custom Tab;
* Brave **does** support TWAs (Chrome, Brave, Vivaldi, Edge and Samsung Internet
  do);
* pinning a specific browser is possible with the `LAUNCHING_BROWSER` (plus
  `LAUNCHING_BROWSER_TOKEN`) metadata, at the cost of ignoring the user's
  default choice and requiring that exact browser to be installed;
* a TWA must declare an `autoVerify` App Links filter for the domain and pass
  Digital Asset Links verification, or it degrades to a Custom Tab with a URL
  bar.

Adopting a TWA would replace the current Capacitor shell, which carries the
verse widget, push notifications and the bundled offline web app. That is a
product decision, not a configuration fix, so nothing was changed here.

Same reasoning applies to adding an `autoVerify` App Links filter to the
current app: it would make `net.prayerdome.app` compete with the installed PWA
for `prayerdome.net` links. Correct only if that is the intent.

## 7. Verifying on a real device

```sh
# Which Prayer Dome packages exist, and who installed each one?
adb shell pm list packages | grep -iE 'prayerdome|webapk'
adb shell dumpsys package net.prayerdome.app | grep -i installerPackageName
adb shell dumpsys package org.chromium.webapk.* | grep -i installerPackageName

# Does the system hand prayerdome.net links to an app?
adb shell pm get-app-links net.prayerdome.app
adb shell am start -a android.intent.action.VIEW -d "https://prayerdome.net/"

# Does the deployed file parse over HTTPS?
curl -sS -D- https://prayerdome.net/.well-known/assetlinks.json | head
```

`adb shell pm get-app-links net.prayerdome.app` reporting `none` is expected
until an `autoVerify` filter is declared; it reporting `verified` is what a
working App Links setup looks like.

Checklist used for this change:

- [x] `manifest.json` accessible, valid, with `id`/`start_url`/`scope`/`name`/`short_name`/icons
- [x] package name in `assetlinks.json` matches `android/app/build.gradle` and `capacitor.config.json`
      (`scripts/assetlinks.mjs` reads both and fails if they disagree)
- [x] every published fingerprint is a 32-byte SHA-256 value
- [x] the legacy listing is preserved rather than revoked
- [x] hosting serves the file as `application/json` with no redirect
- [ ] **the published fingerprint matches the certificate that signed the installed APK** — must be
      confirmed against Play Console → App integrity on the real release
- [ ] **`npm run assetlinks:verify` against production** — must be run where `prayerdome.net` is
      reachable; it could not be reached from the environment this change was prepared in
- [ ] install/launch test on a real device in Brave and in Chrome
