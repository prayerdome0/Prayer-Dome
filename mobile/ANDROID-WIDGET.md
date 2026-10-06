# Daily Verse widget (home screen and lock screen)

The Prayer Dome Daily Verse widget puts Scripture on a member's phone **outside
the app**: on the home screen, and on the lock screen wherever Android shows
widgets there. Nothing needs to be opened, unlocked or connected — the card is
rendered by the launcher/SystemUI from data packaged inside the app.

Member-facing setup lives at **[prayerdome.net/widgets](https://prayerdome.net/widgets)**
(`widgets.html`), which also generates a lock-screen **wallpaper** for iPhone and
Android members whose device does not show widgets on the lock screen.

```
assets/pd-verse-data.js                 ← the one verse library (site, worker, notifications)
        │  node scripts/build-widget-verses.mjs
        ▼
android/app/src/main/res/raw/pd_widget_verses.json   ← verses + rotation rule + checkpoints
        │  VerseWidgetData.java
        ▼
VerseWidgetRenderer.java → RemoteViews → launcher / lock screen
        ▲
        │  Capacitor bridge (VerseWidgetPlugin.java) ← assets/pd-widget.js ← widgets.html
```

## What is in the app

| File | Job |
| --- | --- |
| `res/raw/pd_widget_verses.json` | Generated verse library: 4 slots, 80 verses, the rotation rule, the slot boundaries and checkpoints computed by the website library. Never edited by hand. |
| `VerseWidgetData.java` | Loads that JSON, applies the website rotation, replays the checkpoints (`selfCheck()`), falls back to John 3:16 if the data ever disagrees with the site. |
| `VerseWidgetStore.java` | SharedPreferences (`pd_verse_widget`): theme, text size, greeting/reference/brand toggles, and an optional pinned verse. |
| `VerseWidgetRenderer.java` | Builds the RemoteViews card, the four themes, the tap targets (open the app at `/widgets.html`, refresh on the spot). |
| `VerseWidgetProvider.java` | `AppWidgetProvider`: redraws on update, boot, app update and the boundary alarm. |
| `VerseWidgetScheduler.java` | One wake-up per slot boundary (midnight, 11:00, 14:00, 18:00) via `setAndAllowWhileIdle` — four a day, no background service, no exact-alarm permission. |
| `VerseWidgetPlugin.java` | Capacitor plugin `VerseWidget`: `getState`, `setPreferences`, `pinVerse`, `clearPin`, `refresh`, `requestPin`, `pendingRoute`. |
| `res/xml/verse_widget_info.xml` | Widget metadata: `widgetCategory="home_screen|keyguard"`, 4×2 resizable, `updatePeriodMillis="0"`, picker preview. |

`MainActivity` registers the plugin before `super.onCreate` and keeps the launch
intent readable so a widget tap can open `/widgets.html`.

## Verse parity with the website

`scripts/build-widget-verses.mjs` reads `assets/pd-verse-data.js` and writes the
packaged library. It runs automatically in `npm run mobile:sync`, and `npm run
lint` fails when the packaged copy is stale, so a verse edit can never ship a
widget that quotes different Scripture to the site.

The packaged file also carries **checkpoints** — date/slot/reference samples
computed by the website library, including a leap day, a year boundary and every
slot. `VerseWidgetData.selfCheck()` replays them through the Java rotation on the
device; if any mismatch is found the widget shows the fixed fallback verse and
the studio reports that the data needs an app update, rather than displaying a
verse nobody approved.

```sh
node scripts/build-widget-verses.mjs           # regenerate after editing verses
node scripts/build-widget-verses.mjs --check   # what lint runs
node tests/widgets.test.js                     # full contract (parity, resources, page)
```

## Lock-screen support

Android decides where widgets may appear — the app only declares its card:

| Android version | Lock screen behaviour |
| --- | --- |
| Android 15 QPR1+ (tablets) | Widgets on the lock screen; enable *Settings → Display → Lock screen → Show widgets on lock screen*, then add **Daily Verse**. |
| Android 16 QPR1+ (phones) | Same feature on phones, shown when the phone is charging or docked. |
| Older releases / other OEMs | The widget is still offered on the home screen; the wallpaper studio at `/widgets.html` covers the lock screen. |

No extra code is needed for the lock screen — Android shares every widget with
the lock screen — and a member tapping the card is asked to unlock the phone
before the app opens. (Declaring `android:showWhenLocked="true"` on
`MainActivity` would skip that prompt; it is deliberately **not** set, so the
verse is glanceable without the app being reachable while locked.)

On iPhone, where a third-party lock-screen widget requires an App Store build,
`/widgets.html` generates a wallpaper sized for the member's iPhone instead, and
the daily verse notifications keep arriving on the lock screen.

## Testing on a device

```sh
npm run mobile:sync                    # rebuilds mobile/www and the packaged verses
cd android && ./gradlew assembleDebug  # or: npm run mobile:build:debug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

1. Long-press the home screen → **Widgets** → **Prayer Dome** → **Daily Verse**.
2. Check the card matches `/widgets.html` for this hour, then change the theme in
   the studio and watch the card update.
3. Pin a verse in the studio, reboot the phone, and confirm the pinned verse
   comes back (that exercises the boundary alarm and the boot receiver).
4. On Android 16 QPR1+ (or an Android 15 QPR1+ tablet), add the same widget to
   the lock screen and check it renders before unlocking.

Troubleshooting: a card that never changes means the alarm was killed by a
battery manager (`adb shell dumpsys alarm | grep prayerdome`); a card showing
John 3:16 means the packaged data failed its checkpoint self-check.

## Where it is covered by tests

`tests/widgets.test.js` runs without an Android SDK and asserts:

* the packaged library is exactly what the build script generates from the site
  library, and every checkpoint replays correctly;
* the slot boundaries agree with `PD_VERSES.currentSlot()` for all 24 hours;
* the manifest, widget metadata, plugin registration and every `R.*` reference
  (layout, ids, drawables, strings, colours, raw data) exist;
* the studio page renders, styles, pins and drafts wallpapers with the shared
  theme model, and degrades with a clear message where canvas is unavailable;
* the service worker, hosting rewrites, sitemap and SEO metadata all point at
  `/widgets`.
