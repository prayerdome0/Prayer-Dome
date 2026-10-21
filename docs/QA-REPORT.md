# Deliverable 5 — QA report

**Date:** 2026-10-21 · **Branch:** `arena/8d6a3256-prayer-dome` (from `7258e9f` on `main`)
**Environment:** Linux sandbox, Node 22.22.3, jsdom, no headless browser, no GPU, no audio device, no
Android device.

## 1. Result summary

| Check | Command | Result |
| --- | --- | --- |
| Full automated suite | `npm test` | **exit 0 · 1,718 PASS · 0 FAIL** |
| Lint + generated-artefact checks | `npm run lint` | **exit 0** — 277 icons (266 referenced), navigation markup matches `pd-nav.js` in all 39 pages, 114 JavaScript files / inline scripts validated, SEO 30 up to date |
| Production bundle | `npm run build` | **exit 0** — 190 files, 24.89 MiB in `dist/` |
| Preview HTTP | `PORT=4173 node scripts/dev-server.mjs` + curl | **all 200** — 9 pages, `pd-nav.js` (23 KB), `pd-quiz-session.js` (6.4 KB), `pd-domey-human.js` (28 KB), VRM (10,776,032 B) |
| Browser rendering, WebGL, microphone, speech audio | — | **not run** (no browser in this environment) |

## 2. Suites that changed or were added

| Suite | Assertions | What it covers |
| --- | --- | --- |
| `tests/nav.test.js` | 63 | One grouped config, every destination exists, every icon exists, no duplicates, identical menu on every route, generated markup in sync, open/Escape/backdrop/selection/bfcache, focus trap and return, scroll lock, bottom bar and safe areas |
| `tests/quiz.test.js` (new) | 25 | Session record round-trip, numbers-only shape, expiry, corruption, unavailable storage, refusal of impossible records, and the page wiring (save/clear/resume) |
| `tests/domey-human.test.js` | 46 | VRM file and licence, bundle + import-map wiring, rig maths on a synthetic VRM (blink, viseme, moods, 17 gestures, aliases, replay, reduced motion, dispose), device gating including 3G |
| `tests/domey.test.js` | 69 | Verdict painting on **every** answer path (tap right/wrong, typed right, unrecognised typed, spoken, skip), plus pause/resume, and all the pre-existing host behaviour |
| `tests/lady.test.js` | 38 | Hostess rig, companion layout, spoken + tapped rounds, and the removal of the true/false rewrite |
| `tests/vercel.test.js` | 27 | Security headers, rewrites, and the new long-cache rules for `/assets/domey` and `/assets/vendor` (assets not marked `immutable`) |
| `tests/pwa.test.js` | 65 | Service-worker contract, including the 6 MiB bulk-cache guard and the new precached script |
| Others (unchanged, re-run) | 1,315 | academy, admin (shell/access), certificates, challenge, bible/bsb, content, deployment, dev-server, geo, i18n, learning-flow, media, pages, page-wiring, premium, roles, chat-admin, responsive, translate, widgets, android signing, assetlinks, codemagic |

## 3. Functional checks performed

*Every claim below was executed in this environment unless marked otherwise.*

**Navigation**

* All 39 pages contain the same 22-item grouped drawer and at most one bottom bar (7 pages).
* The menu opens from the button, sets `aria-expanded="true"`, moves focus to the close button and locks the
  page; Escape, the backdrop, choosing a destination and a `pageshow` (bfcache) all close it and restore the
  page; focus returns to the menu button.
* Each of the 39 routes produces exactly one active item, and it is the correct one (including alias routes:
  lesson reader → Teachings, resource view → Study Resources).
* The app layer never injects a second drawer or rewrites the rendered menu.

**Domey**

* `judgeAnswer` / `markAnswer`: a correct tap marks exactly one green chip; a wrong tap marks it orange and
  reveals the green one; a correct spoken answer and a correct typed answer mark the same green chip; a typed
  non-choice ("Goliath") is scored wrong without inventing a wrong chip; skip paints nothing.
* `show()` no longer re-judges answers, so the score and the chips always agree.
* Pause: `pause()` holds the line, swaps the control to "Resume" with `aria-pressed="true"`, and pauses the
  mouth; `pause()` twice does not stack; `resume()` restores; a new line, `stop()` and `destroy()` clear it.
* The human rig: blink timing and double-blink rate, viseme weights, 17 gestures plus aliases, gesture replay,
  moods, gaze, arm rest pose, reduced-motion scaling (head range 0.003 rad vs 0.005 threshold), and full
  disposal on `dispose()`.
* Device gate: `wanted()` false for `deviceMemory ≤ 3`, `hardwareConcurrency ≤ 4`, `saveData` and
  `slow-2g`/`2g`/`3g`; the VRM never loads when it is false.

**Quiz recovery**

* Save/load round trip, numbers-only record, one-week expiry, corrupt JSON, storage that throws, refusal of
  out-of-range/fractional records, and "no record until a question has been answered".
* Page wiring: save after every judged answer, clear on the last question, on `endLevel()`, on reset; the bar
  is refreshed whenever the map is shown; Resume re-enters the stored question.

## 4. Accessibility checks

* Drawer is `role="dialog"`, `aria-modal="true"`, `aria-hidden` and `inert` when closed, focus moves in on
  open, Tab is trapped, focus returns on close.
* Every answer path announces through the existing `role="status"` bubble; the quiz resume bar is real
  `<button>` elements with text, not icons alone.
* Marked chips keep full opacity when disabled, so the verdict does not fade below contrast.
* `prefers-reduced-motion` is honoured by the CSS performances, the 2D character and the human rig.

## 5. Performance checks

* The 10.8 MB VRM is requested only on `game.html`, only after `requestIdleCallback`, and only when the device
  gate passes.
* `sw.js` refuses to bulk-cache any response above 6 MiB, so the model cannot exhaust the origin cache.
* `vercel.json` caches `/assets/domey/(.*)` and `/assets/vendor/(.*)` for a week with
  `stale-while-revalidate`, and does not mark them `immutable` because the filenames are not hashed.
* 3D stages stop rendering when the tab is hidden or the stage scrolls out of view (pre-existing, unchanged).

## 6. What could **not** be verified here (explicit limitations)

1. **Any real browser rendering.** There is no Chromium/Playwright/Puppeteer in this environment. Layout,
   drawer animation, safe-area insets on a notched phone, and dark mode were verified structurally (CSS and
   markup assertions) and in jsdom, **not visually**.
2. **WebGL / the VRM itself.** `game.html`'s `three.module.min.js` cannot be executed in jsdom
   (`Unexpected token 'export'`); the rig maths is tested against a synthetic VRM, so the code paths are
   covered but the *appearance* of the model — proportions, materials, lighting, whether it reads as friendly
   rather than uncanny — is **unverified**.
3. **Frame rate on a low-end Android phone.** Only the decision logic is tested.
4. **Speech synthesis and recognition.** `speechSynthesis.pause()` is ignored by some engines; the tests use
   stubs. Audio quality, timing and the pause behaviour on real iOS/Android are **unverified**.
5. **Deployment.** Nothing was deployed. The bundle was built and served locally; production hosting,
   the Android package and Play integrity are unchanged and untested here.
6. **Lighthouse / Core Web Vitals.** Not run.

## 7. Known gaps carried into the final report

* `quiz.html` keeps its own portrait host rather than `PDMascot` (honest copy, but a second host design).
* `assets/pd-domey-scan.js` remains unwired (its scan has closed eyes and no hands).
* The Academy's tab strip and the global menu are separate systems, as required, but no shared component
  extracts the tab pattern — a proposal, not a defect.
