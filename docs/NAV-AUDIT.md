# Deliverable 1 — Global navigation audit

**Scope:** every user-facing page in the repository at commit `7258e9f` (`main`), the scripts that build
navigation, and the styles that place it. **Method:** the pages were read from the commit itself
(`git show HEAD:<page>`), not from memory, and the counts below come from a script that parsed each
page's `<aside class="pd-drawer">` and `<nav class="nav-bar">` blocks. No browser was available in this
environment, so anything that requires a real viewport is called out as unverified in the QA report.

## 1. What the site is made of

| Thing | Count at `7258e9f` |
| --- | --- |
| HTML pages | 39 |
| Pages carrying a hand-written drawer (`<aside class="pd-drawer">`) | 13 |
| Pages carrying **no** drawer markup at all (built at runtime) | 26 |
| Pages carrying a bottom navigation bar | 7 |
| Distinct drawer link sets | **9** |
| Menu size range | **3 to 17 links** before runtime additions |
| Distinct bottom-bar link sets | **5** (5 or 6 links each) |

## 2. Finding 1 — the menu genuinely changed from page to page

The same member saw a different menu depending on where they were:

| Pages | Links in the drawer | Shape |
| --- | --- | --- |
| `index.html` | 17 | Home, Live, Prayer, Bible, Sermons, Gospel Media, News, Testimony, Events, Community Hub, Prayer Assistant, Gallery, Quiz, Play, Give, Widget, Account |
| `news.html`, `widgets.html` | 13 | similar but missing Gallery/Quiz/Play/Give |
| `radio.html` | 10 | adds Radio, drops Testimony/Events/Hub/Assistant/Gallery/Quiz/Play/Give |
| `lesson.html`, `lessons.html` | 8 | Academy pages only |
| `game.html` | 9 | Academy pages + Play |
| `stories.html` | 6 | |
| `resources.html` | 5 | |
| `resource-view.html` | 4 | |
| `lesson-audio.html`, `lesson-pdf.html`, `lesson-quiz.html` | 3 | Home, Lessons, Quiz |
| 26 other pages | 0 | nothing, until script ran |

There was no single list to change and no single place to look for the truth. The links were also
spelled inconsistently — `/lessons.html` in some pages, `/lessons` in others, `/` in some bars and
`/index.html` in others — so the same destination appeared under two spellings and two labels
("Teaching" versus "Teachings", "Pray" versus "Prayer", "Games" versus "Play with Domey").

## 3. Finding 2 — two scripts competed to build the menu

`assets/pd-app.js` had **two** navigation builders:

1. `layout.ensure()` — if a page's drawer had fewer than five children it replaced the entire list with a
   fixed 10-link array (`DRAWER_LINKS`), using extension-less URLs.
2. `academyNav.init()` — appended four more links (`/lessons.html`, `/stories.html`, `/quiz.html`,
   `/resources.html`) whenever `/lessons.html` was not already in the drawer.

Because the injected list used `/lessons` and the check looked for `/lessons.html`, the condition was
**always true on the pages that had just been rebuilt**. The result on the 26 rebuilt pages was 14 links,
four of which repeated a destination that was already on screen under the same label. On `index.html` the
final menu was 21 links, again with duplicated Teachings, Stories, Quizzes and Resources.

So the runtime was not a fallback for missing markup: it was a second, contradictory source of truth that
fired on the pages that needed consistency most.

## 4. Finding 3 — the drawer had no real interaction contract

The only drawer controller (`ui.drawer()` in `pd-app.js`) did six things: toggle `.open`, toggle the
overlay, set `document.body.style.overflow`, bind the button, bind the overlay, and bind the close
button. It did **not**:

* close on `Escape`;
* move focus into the menu when it opened, or return focus to the button when it closed;
* keep keyboard focus inside the open drawer (Tab walked into the page behind it);
* expose state to assistive technology (`aria-expanded`, `aria-hidden` were never set);
* survive a back/forward-cache restore — after a restore the menu could return **open** with
  `overflow: hidden` left on `<body>`, which freezes scrolling on the page;
* close itself when the viewport grew to desktop width;
* preserve the scroll position while locked (iOS Safari jumps to the top on `overflow:hidden`).

Selection did close the menu, but only because every `<a>` in the drawer was bound individually.

## 5. Finding 4 — tabs and the global menu were mixed

The Academy pages had page-local tabs (Overview / Lessons / Quizzes / Resources) while the drawer
carried *different* versions of the same four destinations. Depending on the page, "Quizzes" meant the
tab, the drawer link or the bottom bar, and each took the member to a different place. Tab state and
global navigation were competing for the same words.

## 6. Finding 5 — the bottom bar was a per-page widget, not a system

Seven pages had a bottom bar, in five different shapes:

| Page | Items |
| --- | --- |
| `index.html`, `ai-prayer.html`, `sermons.html` | Home, Bible, Pray/Prayer, Sermons, Assistant, Account |
| `translate.html` | Home, Bible, Translate, Sermons, Prayer, Account |
| `news.html` | Home, Bible, Prayer, News, Account |
| `radio.html` | Home, Sermons, Media, Radio, Account |
| `widgets.html` | Home, Bible, Prayer, Verse widget, Account |

So the primary navigation at the bottom of the screen changed destination set and labels on every one of
those routes, and the remaining 32 pages had no bottom navigation at all even though the same CSS
reserved a bar-shaped space at the bottom of the viewport on mobile. The active state was a hard-coded
`class="active"` in each page's markup, so a new page could only be right by editing HTML by hand.

## 7. Finding 6 — safe areas and content clearance were per-page

`viewport-fit=cover` was present, but bottom-bar padding for `env(safe-area-inset-bottom)` was declared
per page. Pages without a bar did not reserve clearance for it, and pages with one did not all reserve
the same amount. Any page that gained a bar later could cover its own footer or controls.

## 8. What was already right (and had to stay right)

* The drawer markup, overlay, close button and menu button already existed and were styled in the brand
  palette — the fix belonged in the existing structure, not in a new header.
* 28 distinct drawer/bottom destinations existed, all resolvable to real files; there were no dead
  links in the hand-written drawers (checked against the file system at `7258e9f`).
* The service worker already precached the shared scripts.
* The icons were already the Lucide set (`pd-i-*`), not emoji.
* The i18n layer already translated menu labels through `data-pd-t` attributes.

## 9. Root cause, in one sentence

Navigation was **markup copied into 13 pages plus a runtime patcher that guessed**, with no single
description of the site; every symptom in this audit follows from that.
