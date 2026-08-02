# Prayer Dome Android app

This directory contains the Android packaging inputs for the Prayer Dome PWA.
The website remains at the repository root for Firebase/Vercel hosting; the
`mobile:prepare` script creates the clean web bundle that Capacitor embeds in
Android.

## Requirements

- Node.js 22 or newer
- Android Studio with Android SDK 36 and a JDK 21 installation
- An Android device or emulator for testing

## Build and run

From the repository root:

```bash
npm install
npm run mobile:sync
npm run mobile:build:debug
```

The debug APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

To open the project in Android Studio:

```bash
npm run mobile:open
```

The first sync must be run after any web source change. It copies the root
website into `mobile/www` and then runs `npx cap sync android`.

## Release AAB

A Play Store upload must be a **signed release AAB**. Do not commit a keystore
or its passwords. In Android Studio use **Build > Generate Signed Bundle / APK**
and choose `android/app` and the `release` variant, or configure the environment
variables described in `PLAY-STORE.md` and run:

```bash
npm run mobile:build:release
```

The bundle is written to:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

## GitHub Actions artifact

A ready-to-run GitHub Actions workflow is provided at
`mobile/android-build.yml`. A repository maintainer can copy it to
`.github/workflows/android.yml` (GitHub requires workflow write permission for
that path). After it runs, list builds and download the artifact with GitHub
CLI:

```bash
gh run list --repo prayerdome0/Prayer-Dome --workflow android.yml
gh run download RUN_ID --repo prayerdome0/Prayer-Dome --dir downloads
```

Without the four Android signing secrets, the workflow still produces a debug
APK and unsigned release outputs for testing. Only a signed release AAB can be
uploaded to Google Play.
