# Play Store release checklist

The Android wrapper is configured with the permanent application ID:

```text
net.prayerdome.app
```

Create the Play Console application with this exact ID. It cannot be changed
after the first Play Store upload.

## Signing

For a first release, the recommended path is **Google Play App Signing**:

1. Create a new upload keystore and store it in a password manager or offline
   backup. Never commit it to Git.
2. In Play Console, enroll the app in Play App Signing and upload the public
   certificate when requested.
3. In Android Studio, choose **Build > Generate Signed Bundle / APK > Android
   App Bundle**, select `release`, and use the upload keystore.
4. Upload the resulting `app-release.aab` to an internal testing track before
   production.

For command-line or CI builds, create `android/keystore.properties` locally:

```properties
storeFile=/absolute/path/to/prayer-dome-upload.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=YOUR_KEY_ALIAS
keyPassword=YOUR_KEY_PASSWORD
```

This file is ignored by Git. The release Gradle configuration reads it when it
exists. It can also be supplied through Gradle properties or a CI secret; keep
all passwords outside the repository.

## Versioning

Increase both `versionCode` and `versionName` in `android/app/build.gradle` for
every Play Store upload. The initial values are `1` and `1.0.0`.

## Store requirements still needed

- A public privacy policy URL. The app uses Firebase Authentication,
  Firestore/Storage, optional location, notifications, and third-party media
  services. Complete the Play Console Data safety form accurately.
- App icon, feature graphic, phone screenshots, and a short/long description.
- Content rating, target audience, ads declaration, and a support email.
- Internal testing with the signed AAB on several Android screen sizes.

The website/PWA can be tested at https://prayerdome.net. The native build embeds
the same web experience and needs network access for Firebase-backed features.
