# Prayer Dome

Prayer Dome is a static, Firebase-backed Christian prayer and Bible community
web app. It is also packaged as an Android app with Capacitor for Google Play
publishing.

## Web app

The production web app is hosted at [prayerdome.net](https://prayerdome.net).
Firebase/Vercel hosting serves the website files from the repository root.

## Android app

The Android wrapper uses application ID `net.prayerdome.app` and embeds a clean
copy of the website bundle. It is ready to open in Android Studio after the
Capacitor sync step:

```bash
npm install
npm run mobile:sync
npm run mobile:open
```

Build a test APK from the command line:

```bash
npm run mobile:build:debug
# android/app/build/outputs/apk/debug/app-debug.apk
```

Build a Play Store bundle after configuring a release keystore:

```bash
npm run mobile:build:release
# android/app/build/outputs/bundle/release/app-release.aab
```

See [`mobile/README.md`](mobile/README.md) and
[`mobile/PLAY-STORE.md`](mobile/PLAY-STORE.md) for Android Studio, signing,
Play Console, and GitHub Actions instructions. The release keystore and
passwords must never be committed.

## Tests

```bash
npm test
```
