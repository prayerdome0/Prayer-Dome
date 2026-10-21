# Deliverable 6 — Final report

**Project:** Prayer Dome (https://prayerdome.net) — static multi-page app + Capacitor Android package
**Branch:** `arena/8d6a3256-prayer-dome`, branched from `7258e9f` on `main`
**Date:** 2026-10-21
**Approach:** improve the existing architecture. Nothing was rebuilt, no page was redesigned, no feature was
removed, and no mock data, placeholder button or demonstration screen was introduced.

---

## 1. What is finished and verified

Each item below is implemented in this branch, covered by an automated test, and passes `npm test`
(1,718 assertions, exit 0), `npm run lint` (generated artefacts in sync) and `npm run build`
(190 files, 24.89 MiB).

### Part 1 — Global navigation

| Requirement | Outcome |
| --- | --- |
| Menu contents no longer change per page | One configuration (`assets/pd-nav.js`) rendered into all 39 pages by `scripts/build-nav.mjs`; a `--check` mode runs in `npm run lint`, so drift fails the build |
| One authoritative nav config | `PDNav` owns the grouped menu, the secondary links, the bottom bar, the active-state rules and the drawer behaviour |
| Grouped menu, existing features only | Main, Learn & Play, Community, Media, Personal — 22 destinations, all real pages |
| No duplicates or dead links | Asserted: unique destinations, every href resolves to a file, every icon exists in the 277-icon set |
| Opens / closes / closes on mobile selection / active state / scrolls / safe areas | Menu button, close button, backdrop, Escape, destination selection and bfcache restore all close it; the menu scrolls independently; head and foot respect `env(safe-area-inset-*)`; active state is route-derived with aliases |
| Keyboard accessible | `role="dialog"`, `aria-modal`, `inert` when closed, focus moved in on open and returned on close, Tab trapped, `aria-expanded` kept in step |
| Tabs kept separate from the global menu | Page tab strips untouched; the menu holds no tab state, and the old Academy link-injection that duplicated them is gone |
| Bottom nav preserved, no duplicates, never covers content | One six-destination bar on the seven pages that have one, same order and labels everywhere, second bars removed, height plus safe area reserved |

### Parts 2–4 — Domey

| Requirement | Outcome |
| --- | --- |
| Professional, friendly **human** character | A licensed VRM 1.0 human (`VRM1_Constraint_Twist_Sample`, pixiv Inc., VRM PL 1.0) is now actually wired into the game (it was dead code before) and swapped onto the existing stage, keeping the coded hostess as the instant first frame |
| Full body where the technology allows | Full standing body framed head-to-feet (`FIT 1.86 × 1.05`); the model has no leg bones, so there is no walking — stated, not hidden |
| Natural blinking, breathing, head, eyes, lip-sync, gestures | Procedural blink (with double-blinks), breathing, idle sway, gaze + saccades through VRM look-at, lip-sync from the mascot's own visemes, 17 gestures with beats and aliases, 9 moods |
| No uncanny look | Deliberate choices: offset-from-rest poses rather than absolute rotations, blended gesture envelopes, damped head follow, rest pose with relaxed arms. **Appearance itself is unverified** (no GPU here) |
| Voice: existing or browser speech, graceful fallback | Unchanged single voice owner with `cancel()` before every line; captions-only when no engine; replay when autoplay is blocked |
| Correct/incorrect feedback matches the real result | One `judgeAnswer` → `markAnswer` path for tap, speech and typing; the show scores the same verdict; a non-choice answer never invents a wrong chip; skip paints nothing; the true/false rewrite that mis-scored spoken names was removed |
| No overlapping audio | One line at a time (pre-existing), now with an explicit pause that holds speech, mouth and captions together |
| Replay / mute / pause controls | Replay and mute existed; **pause/resume added** with a real button, `aria-pressed` and state that clears on a new line, `stop()` or `destroy()` |
| Quiz scoring, progress, replay, session recovery | Scoring unchanged and now single-source; replay unchanged; **session recovery added** (`assets/pd-quiz-session.js` + resume bar): level, question, score, streak and power-ups survive a call, a locked screen or a closed tab |
| Performance on low-end Android | 3D hostess is pure geometry; the 10.8 MB VRM is gated on `deviceMemory`, `hardwareConcurrency`, `Save-Data` and `effectiveType`, then loaded at idle; VRM excluded from the service-worker bulk cache; long CDN cache for `/assets/domey` and `/assets/vendor` |
| Lazy-load character assets only on game pages | The VRM is referenced only from `game.html` via `pd-domey-human.js`; no other page loads it |
| Respect `prefers-reduced-motion` | 2D and CSS already did; the human rig now scales to 45 % amplitude and 65 % rate with no saccade jitter |

### Part 5 — Technology inspection

Existing stack inspected before any choice: three.js r165 was already vendored and already used by the 3D
stage; `@pixiv/three-vrm` was already vendored in `assets/vendor/three-vrm`; the VRM was already in the
repository with its licence. **No new rendering library was added and none competes with three.js** — the
upgrade reuses the single engine, the single canvas and the single render loop. The unused alternatives
(`pd-domey-scan.js`, CC BY 3.0 photogrammetry head) were inspected and left unwired because that model has
closed eyes and no hands.

### Parts 6–8 — Brand, responsiveness, accessibility, integrations, delivery

* **Branding preserved:** same palette (royal blue/gold), same Poppins/Inter/Lora typography, same page
  structure. New UI (resume bar, character chip states) uses the existing CSS variables and Lucide icons.
* **Mobile-first:** resume bar stacks and stretches its buttons under 520 px; drawer head/foot use safe-area
  insets; the bottom bar keeps its reserved height and safe-area padding (`tests/responsive.test.js` covers
  40 HTML pages).
* **Accessibility:** dialog semantics and focus management on the menu; `role="status"` announcements kept;
  real `<button>`s (no inline `onclick`) for the new controls; verdict colours not dimmed when disabled.
* **Existing systems untouched:** Firebase auth/Firestore paths, the Bible layer, prayer wall, chat,
  payments (Give/Membership), admin console and its role checks are unchanged and their suites still pass
  (admin shell, admin access, finance access, roles, chat moderation, page wiring, certificate/deployment).
  No security rule, API contract or Firestore schema was changed.
* **No secrets added to the client.** The Firebase web config in `quiz.html` is the same public config that
  was already there; no API key was introduced by this work.
* **Tests and build:** `npm test`, `npm run lint`, `npm run build` all green (numbers in section 1).

---

## 2. What is deliberately **not** done (proposals, not completed work)

These were considered and are **not** implemented. They are listed so they are not mistaken for finished work.

1. **Unify `quiz.html`'s host with `PDMascot`.** It currently shows a portrait with a "talking" pulse and
   lets the browser read questions aloud. It is honest in its copy, but it is a second host design. Moving it
   onto `PDMascot` (captions + voice, no 3D) would give one Domey everywhere; it also changes the look of a
   working page, so it needs a design decision first.
2. **Content-hash or version the VRM URL** so it can be served `immutable` instead of just a week of
   `stale-while-revalidate`. Requires rebuilding the asset pipeline.
3. **Pre-compress the VRM at build time** (Brotli/gzip) — the model is binary and compresses poorly, so the
   gain was judged not worth a bespoke build step; not attempted.
4. **Delete or repurpose `pd-domey-scan.js`** — currently unwired and asserted to stay unwired. Removing it
   would be tidy, but it is a licensed asset with its own test, and removal is a product decision.
5. **A shared tab component** for the Academy's page-local tabs. Tabs are correctly separate from the global
   menu; extracting a component is refactoring, not a defect fix.
6. **Real-device performance tuning** (pixel-ratio ladder, shadow-map reduction per device) — the gating is in
   place, but tuning numbers without a physical low-end Android phone would be guesswork.

---

## 3. Limitations of this verification (read before accepting)

1. **No browser, GPU, microphone or audio device exists in this environment.** WebGL rendering, the actual
   appearance of the VRM (proportions, materials, lighting, "friendly vs uncanny"), frame rate, drawer
   animation and safe-area insets on a notched device are **not verified**. Layout and behaviour were verified
   structurally and in jsdom.
2. **Speech.** `speechSynthesis` and `SpeechRecognition` were exercised through stubs. Real-engine behaviour —
   including engines that ignore `pause()` — is **unverified**, though the pause path has a replay fallback.
3. **Nothing was deployed.** No Vercel deployment, no Play Store upload and no Android build was produced
   here; `npm run build` produced `dist/` (190 files) and a local server returned 200 for every page and asset
   checked. The Android signing/assetlinks suites pass but the signing identity was not re-verified against a
   real APK.
4. **The npm registry was reachable for `jsdom` only** because the development dependencies were installed
   from the lockfile; no new runtime dependency was added by this work.

---

## 4. Files of record

| Path | What it is |
| --- | --- |
| `docs/NAV-AUDIT.md` | Deliverable 1 — navigation audit of `main` |
| `docs/NAV-FIXES.md` | Deliverable 2 — navigation changes |
| `docs/DOMEY-AUDIT.md` | Deliverable 3 — Domey audit |
| `docs/DOMEY-UPGRADE.md` | Deliverable 4 — Domey upgrade |
| `docs/QA-REPORT.md` | Deliverable 5 — QA, with the limitations above |
| `docs/FINAL-REPORT.md` | This document (Deliverable 6) |
| `assets/pd-nav.js`, `scripts/build-nav.mjs`, `tests/nav.test.js` | The one navigation system |
| `assets/pd-domey-human.js`, `assets/pd-mascot.js`, `assets/pd-domey3d.js` | The character and its upgrade path |
| `assets/pd-quiz-session.js`, `quiz.html`, `tests/quiz.test.js` | Quiz session recovery |
| `sw.js`, `vercel.json` | Cache policy for the model and engine |
