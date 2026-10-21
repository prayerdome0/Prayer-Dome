# Deliverable 3 — Domey (the host character) audit

**Scope:** `assets/pd-mascot.js`, `assets/pd-mascot.css`, `assets/pd-domey3d.js`,
`assets/pd-domey-lady.js`, `assets/pd-domey-human.js`, `assets/pd-domey-scan.js`,
`assets/pd-domey-questions.js`, `assets/domey/**`, and every page that hosts a Domey
(`game.html` and `live.html` mount `PDMascot`; `quiz.html` runs its own portrait-based host).

**Method:** read the code at commit `7258e9f`; counted what each page actually loads; ran the
existing suites. No headless browser is available in this environment, so rendering quality,
frame rate and microphone behaviour on real hardware are **not** claimed here (see the QA report).

## 1. What existed at `7258e9f`

| Module | Lines | What it did |
| --- | --- | --- |
| `pd-mascot.js` | 2,703 | The host: 2D SVG character, visemes, lip-sync plan, captions, speech engine wrapper, speech recognition, actions, quiz show driver |
| `pd-mascot.css` | 1,295 | Character, mouth shapes, 24 keyframe performances, reduced-motion rules |
| `pd-domey3d.js` | 1,228 | three.js stage: dynamic import of the vendored engine, camera fit, lighting, dust, render loop, context-loss handling |
| `pd-domey-lady.js` | 941 | The hostess built from code: body, face, hair, Bible prop, lip-sync, gestures, eye gaze |
| `pd-domey-human.js` | 319 | **A VRM 1.0 loader and rig that no page loaded** |
| `pd-domey-scan.js` | 360 | A photogrammetry head rig (**also unused**; eyes modelled closed, bust only) |
| `pd-domey-questions.js` | 1,435 | 1,248-question bank with verses and topics |

## 2. Finding 1 — a realistic human existed but was unreachable

`assets/pd-domey-human.js` already contained a working design for the requirement that mattered most:

* `PDDomeyHuman.load(THREE)` — loads `@pixiv/three-vrm` from the vendored bundle and the 10.8 MB
  `VRM1_Constraint_Twist_Sample.vrm`, with a 30-second timeout;
* `PDDomeyHuman.buildRig(THREE, opts)` — VRM humanoid, lip-sync from the mascot's own visemes, blink on a
  timer, look-at, breathing, a nod on `act`;
* `PDDomeyHuman.isLowEnd()` — a device check for low-end Android.

But **no page included the file**, and `pd-mascot.js` had no code path that could reach it. The whole
realistic-character capability was dead code: `grep -n "pd-domey-human" game.html live.html quiz.html`
returned nothing at `7258e9f`. `game.html` loaded `pd-domey3d.js`, `pd-domey-lady.js` and the question bank;
`live.html` loaded the engine and the host but **not** the hostess module, so the Live page silently showed
the cartoon rig instead of the semi-realistic woman.

## 3. Finding 2 — the hostess was a good stylised figure, not a human

`pd-domey-lady.js` is impressive for what it is (royal-blue dress, gold trim, face, hair, Bible, a
15-shape mouth, eye gaze, gestures), and it starts instantly because it is geometry, not an asset. But it is
a stylised figure: its face is built from primitives, its eyes are spheres, and its proportions are
deliberately doll-like. That does not meet "a properly rigged, licensed human character model with a
natural, friendly appearance", and it is the reason the page promised more than it showed.

## 4. Finding 3 — the Live Service host was not the character the page described

`live.html` mounts `PDMascot`, and `use3D()` requires `PDDomeyLady` to build the hostess:

```js
var lady = global.PDDomeyLady;
if (lady && typeof lady.buildRig === 'function' && THREE && !opts.cartoon) { ... }
return this._mount3D(engine, opts);   // cartoon rig
```

`live.html` never loaded `pd-domey-lady.js`, so the condition failed and the page fell back to the cartoon
rig on every device — while the page's own copy talked about the 3D hostess. Two hosts, two personalities,
one product.

## 5. Finding 4 — the quiz page presents a photograph as a talking host

`quiz.html` shows `assets/domey/domey-real.jpg` and adds a `.talking` class plus a "live" dot while the
browser's speech engine reads the question. There is no mouth movement, no blink, no gaze — a still
portrait with a pulsing ring. Its copy is careful ("I read every question out loud", not "3D"), so it does
not lie, but it is exactly the arrangement the brief rules out for a realistic talking character, and it is
a third, unrelated Domey implementation on the same site.

## 6. Finding 5 — feedback did not always match the result

`Host.ask()` painted the verdict **inside the choice-chip click handler only**, and only when the caller
passed `correctIndex`:

* a member who **spoke** the answer got no green/orange chips at all;
* a member who **typed** the answer got none either;
* a typed or spoken answer that the matcher could not place was scored wrong by the show, but the chips
  showed nothing, so the screen and the score disagreed;
* the show then judged the same answer a **second time** with its own copy of the matching logic
  (`chosen == null && answer.text ? matchChoices(...)`), so the two judgements could drift apart;
* on `game.html`, `asTrueFalse()` rewrote every third "Who …?" question into a two-option statement. With
  only "True" and "False" on the chips, a member who answered the obvious "Daniel" was **scored wrong** —
  and a 50/50 question is a coin toss, not a memory of the Word.

## 7. Finding 6 — no pause, and no single owner of the voice

Speech went through one `speechSynthesis` and every new line called `cancel()`. There was a mute toggle and
a replay path for blocked audio, but **no pause/resume control**: a member who was interrupted had to let
Domey finish or mute her. `speechSynthesis.pause()` was only used as a Safari wake-up workaround.

## 8. Finding 7 — progress in the quiz was lost mid-level

The quiz persisted total score, completed levels and current level (locally and, when signed in, to
Firestore), but only at the **end of a level**. A member who left at question 7 of 10 came back to question 1
with a zeroed level score.

## 9. Finding 8 — device and motion policy was uneven

* `isLowEnd()` existed only in the unused VRM module; the 4,000-vertex hostess and the 677 KB three.js
  bundle were used unconditionally on the game page, and `three.module.min.js` was loaded eagerly as a
  module script before the member did anything.
* `prefers-reduced-motion` was honoured by the 2D character and passed into the 3D rigs, but the 3D stage's
  own idle motion (dust, breathing, sway) was not scaled by it in all rigs.
* Nothing gated a heavy download on `saveData` or a slow connection — because the heavy asset was never
  loaded at all.

## 10. What was already good and had to be preserved

* **One host API**: `PDMascot.mount()` → `say / ask / act / react / emote / setHud / show / waitForContinue`,
  used by every page. The upgrade had to stay inside that contract.
* **One lip-sync plan** driving lips, captions and voice from the same timing (`lipSync()`, `VISEME_MS`).
* **Real speech-recognition support** with repeat/hint/skip/slow-down commands and a typed fallback.
* **Graceful degradation**: 3D → cartoon 3D → 2D SVG drawing, and captions-only when the voice engine is
  missing. Nothing was ever left on a permanent loader.
* **Licensing already handled**: VRM PL 1.0 (commercial use, modification, redistribution, religious use
  permitted, credit not required), three.js MIT, `@pixiv/three-vrm` MIT — all vendored, no paid service.
* **Editorial honesty**: the bank never invents a verse quotation; the question bank is validated.

## 11. Root cause, in one sentence

The realistic capability was built but never wired, so three different Domeys shipped on three pages, with
verdict painting bolted onto one input path and no single owner of "is this answer right?".
