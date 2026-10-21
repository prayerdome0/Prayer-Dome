# Deliverable 4 — Domey upgrade

Everything described here is in the working tree and covered by tests. Where a claim cannot be verified in
this environment (real WebGL rendering, frame rate on a physical phone) it is labelled **unverified** and
repeated in the QA report.

## 1. One character, upgraded in place — not four characters

The chain on `game.html` is now:

```
PDMascot.mount()
  └─ _bindRender3D()
      └─ use3D()
          ├─ PDDomeyLady.buildRig()          coded hostess, on screen in milliseconds
          └─ _mount3D()                      one three.js canvas, one render loop
              └─ _upgradeToRealistic()       idle-time, opt-in download
                  └─ PDDomeyHuman.load(THREE) → buildRig() → engine.swapRig(rig, FIT)
```

* `pd-domey-human.js` (VRM 1.0 human) is now loaded by `game.html` and reached by the host. It was dead
  code before.
* `PDDomey3D.swapRig(rig, fit)` replaces the character **inside the existing scene**: no second canvas, no
  flash, no second animation loop, and the camera is re-framed for the new body.
* `live.html` now loads `pd-domey-lady.js`, so the Live Service host is the same semi-realistic woman as
  the game instead of the cartoon fallback.
* Every failure — no WebGL, model 404, timeout, corrupt file, low-end device, `Save-Data`, very slow
  connection — leaves the coded hostess on stage. Nothing waits on a 10.8 MB download.

## 2. The realistic human rig

`assets/pd-domey-human.js` (319 → 705 lines):

| Capability | Detail |
| --- | --- |
| Model | `VRM1_Constraint_Twist_Sample.vrm` (10.8 MB, VRM 1.0) — already vendored, licence checked |
| Skeleton | VRM humanoid bones: hips, spine, chest, upperChest, neck, head, both shoulders, upper/lower arms, hands, index fingers |
| Rest pose | standing, arms down (quaternion ≈ `0,0,0.60,0.80`), elbows slightly bent, weight on both feet |
| Breathing | chest/spine pitch + shoulder lift, ~1.4 s cycle |
| Idle sway | hips yaw/roll and head drift, all scaled by `prefers-reduced-motion` |
| Head | yaw/pitch follow the member's gaze, damped; small speaking nod |
| Eyes | VRM `lookAt` with a live gaze target, plus periodic saccades |
| Blink | procedural: 0.07 s close, 0.10 s open, 25 % double blinks, gaps 2.1–5.2 s |
| Lips | the mascot's own visemes (`A E I O U M F L`) driven by the same `--pdm-jaw` value as the 2D mouth |
| Gestures | 17: `wave, point, open, offer, clap, think, heart, raise, thumb, count, shrug, listen, pray, celebrate, dance, nod, smile`, each with a body pose, `beats`, and an attack/release envelope |
| Aliases | every action name the mascot already used resolves (`mic→listen`, `hand→offer`, `sparkle→open`, `star→raise`, `cheer→celebrate`, `jump→raise`, `happy→smile`, `wave2→wave`) |
| Moods | idle, speaking, listening, thinking, happy, celebrating, encouraging, praying, sleeping → relaxed / happy / sad / surprised face weights |
| Re-trigger | `act('wave')` while already waving restarts the gesture |
| Framing | `FIT = { height: 1.86, width: 1.05, y: 0.93 }` — head to feet, portrait or landscape |
| Cost | no per-frame allocation (scratch `Euler`/`Quaternion`/`Vector3`) |

**Honest limits.** The model has no leg or foot bones, so Domey stands; there is no walking, no sitting and no
hand-finger detail beyond an index-finger curl for pointing. The rig is a standing upper-body performance,
which is exactly what the game asks of a host.

## 3. Device and network gating

`PDDomeyHuman.wanted()` returns `false` — keeping the lightweight coded hostess — when any of these is true:

* `navigator.deviceMemory ≤ 3` (GB)
* `navigator.hardwareConcurrency ≤ 4`
* `navigator.connection.saveData`
* `effectiveType` is `slow-2g`, `2g` or `3g`

The download also starts from `requestIdleCallback` (with a 2.2 s timeout) so it never competes with the
first question, and it is cancelled on `destroy()` (`cancelIdleCallback` / `clearTimeout`).

## 4. Voice: one owner, no overlap, and a pause control

* All speech still goes through the mascot's single voice object, which calls `cancel()` before a new line —
  a new sentence never plays over the old one.
* **New: pause / resume.** `Host.pause()`, `Host.resume()`, `Host.togglePause()` and `Host.isPaused()` back a
  real button in the control bar (icon `pd-i-pause` / `pd-i-play`, `aria-pressed`, label "Pause"/"Resume").
  Pausing holds the mouth, freezes the caption ticker and calls `speechSynthesis.pause()`; resuming restores
  all three. A new line, `stop()` or `destroy()` always clears a pause.
* The button is only shown when there is a voice to pause; captions-only engines keep working without it.
* Where an engine ignores `speechSynthesis.pause()`, the existing replay path still ends the pause — the
  control never becomes a dead button.

## 5. Feedback that matches the result

The chip-colouring logic that used to live inside the tap handler is now one judgement:

```js
judgeAnswer(spec, answer)   // tap, speech and typing all arrive here
markAnswer(verdict)         // paints the chips from that single verdict
```

* the show scores `answer.right` from the same verdict instead of re-matching the answer itself;
* a spoken or typed correct answer now gets the same green chip as a tap;
* a wrong tap marks the chosen chip wrong **and** reveals the right one;
* an answer that is not one of the choices (typed "Goliath") is scored wrong but still reveals the right
  choice — it never invents a wrong chip;
* `skip`/timeout paints nothing, because no answer was given;
* marked chips keep full colour even though every chip is disabled once the answer is in (previously the
  verdict was dimmed to 50 % opacity).

`game.html` no longer rewrites questions into true/false. Every round stays a four-choice question, so a
member who says the obvious name is scored correctly and the quiz is not a coin toss.

## 6. The quiz no longer loses a level in progress

New module `assets/pd-quiz-session.js` plus a resume bar on `quiz.html`:

* after every judged answer the level is saved as numbers only — level, question, score, streak, fifty/fifty
  and freeze counts — never a question, an answer or a name;
* leaving and returning offers "Pick up where you stopped — Level 3, question 4 of 10 · 85 pts · streak 2"
  with **Resume** and **Start over**;
* the level's last question, `endLevel()`, `retryLevel()`, a fresh `startLevel()` and "Reset progress" all
  clear the record, so a finished level is never offered back;
* records older than a week, out of range, fractional, expired or corrupt are discarded silently; a browser
  that refuses `localStorage` simply never offers a resume — the quiz itself is unaffected;
* nothing about the Firestore progress model changed.

## 7. Performance and delivery

| Change | Why |
| --- | --- |
| Service worker `MAX_CACHE_BYTES = 6 MiB` + `cacheableResponse()` | the 10.8 MB VRM is served normally but never bulk-cached into the origin cache (previously a single large asset could blow the storage budget and fail the whole install) |
| `vercel.json` long-cache rules for `/assets/domey/(.*)` and `/assets/vendor/(.*)`, plus `.vrm`/`.glb`/`.mjs` in the static-asset rule | the model and engine are now cached for a week with `stale-while-revalidate`, not left to the CDN default |
| Not marked `immutable` | asset URLs are not content-hashed, so an updated model must still revalidate |
| Model loaded only on the game page, after idle, behind the device gate | 10.8 MB never reaches a page that does not need it |

## 8. Reduced motion

`prefers-reduced-motion` already stopped the CSS performances. It now also scales the human rig: 45 % motion
amplitude and 65 % timing rate, no saccade jitter, and the camera/render loop untouched. The 2D character's
existing rules are unchanged.

## 9. Branding and honesty

* No new colours, fonts or layout: the character lives in the existing stage, and the credit line keeps the
  site's palette.
* `game.html` now credits the actual model: "VRM1_Constraint_Twist_Sample © pixiv Inc., VRM Public License
  1.0" alongside three.js (MIT). The licence permits commercial use, modification, redistribution and
  religious use, and requires no credit — the credit is kept anyway because it is the honest thing to do.
* The render chip tells the member which character they are looking at ("Domey in 3D · realistic model",
  "Domey in 3D · stylised model (light device)", "Domey is here · bringing her realistic face") instead of
  claiming a model that has not arrived yet.

## 10. What is **not** claimed

* No real-browser or device verification was possible here: WebGL output, the actual VRM appearance, frame
  rate on a low-end Android phone, and real speech-engine pause behaviour are **unverified**.
* `quiz.html` still uses its own portrait host rather than `PDMascot`. It is honest about what it is (the
  browser reads the question aloud; the portrait does not claim to be 3D) but it is a second host design.
  Unifying it is listed as a proposal in the final report, not as done work.
* `pd-domey-scan.js` (photogrammetry head, CC BY 3.0) remains unused: its eyes are modelled closed and it
  has no hands, so it cannot meet the blink/gaze/gesture bar. It is left in the tree, unwired, rather than
  deleted, and its test asserts that it stays unwired.
