# Deliverable 2 — Global navigation changes

Everything here is implemented in the working tree, covered by `tests/nav.test.js`
(63 assertions) and run by `npm test` / `npm run lint`. Nothing in this document is a proposal.

## 1. One authoritative configuration

**`assets/pd-nav.js`** (new, `PDNav` 1.0.0) now describes the whole site menu:

| Group | Destinations |
| --- | --- |
| Main | Home, Bible, Teachings, Prayer Wall |
| Learn & Play | Play with Domey, Bible Quizzes, Bible Stories, Study Resources |
| Community | Community Hub, Testimonies, Events, Gallery, Christian News |
| Media | Live Service, Sermons, Gospel Media, Radio & Podcasts |
| Personal | My Account, Verse Widget, Membership, Give, Support |

Plus a secondary foot row (About, Contact, Team, Privacy) and a six-destination bottom bar
(Home, Bible, Learn, Play, Pray, Account). 22 menu destinations, 4 secondary, 6 bottom — every one of them
a page that exists, with a Lucide icon that exists, and a `nav.*` translation key where the i18n layer
already had one.

The module also owns:

* `all()` — the flat menu, for code that iterates destinations;
* `isActive(href, page)` — route-aware highlighting with aliases, so a lesson reader highlights
  **Teachings** and a shared resource highlights **Study Resources** instead of leaving the menu blank;
* `drawerMarkup()` / `bottomMarkup()` — the canonical HTML, used by both the runtime and the build;
* `open()`, `close()`, `toggle()`, `refreshActive()` and `init()`.

## 2. The markup is generated, not hand-copied

**`scripts/build-nav.mjs`** (new) renders the configuration into every page's `#pdDrawer` and
`.bottom-ui-system` with the correct active destination for that page's route:

* `node scripts/build-nav.mjs` rewrites the pages;
* `node scripts/build-nav.mjs --check` exits 1 when a page and the configuration disagree.

`npm run lint` runs the check, so a menu edit that forgets to regenerate the HTML fails the build instead
of shipping a stale menu. All 39 pages now carry the same 22-item drawer.

## 3. The competing builders are gone

In `assets/pd-app.js`:

* `layout.ensure()` no longer writes its own `DRAWER_LINKS` array; it guarantees the drawer element exists
  and hands it to `PDNav.hydrateDrawer()`, which renders the canonical menu;
* the footer reads its links from `PDNav.BOTTOM`, so footer and bottom bar cannot disagree;
* `PDApp.academyNav` is kept as a compatibility entry point (`init()` simply calls `PDNav.init()`), but it
  no longer appends a second set of Academy links — the duplicate Teachings/Stories/Quizzes/Resources
  entries found in the audit are gone;
* `PDApp.ui.drawer()` delegates to `PDNav` when it is present and keeps the old behaviour only as a
  fallback for a build without the module.

## 4. The drawer is now a real dialog

| Requirement | Implementation |
| --- | --- |
| Opens and closes | menu button, close button, backdrop, **Escape**, choosing any destination, `pageshow` (bfcache), and a resize to desktop width |
| Keyboard accessible | `aria-expanded` on the button, `role="dialog"` + `aria-modal` on the drawer, focus moves to the close button on open, Tab is trapped inside, focus returns to the menu button on close, `aria-hidden` + `inert` while closed |
| Active state | computed from the route (`aria-current="page"` + `.active`), never hand-written |
| Scrolls | the drawer is a flex column: fixed head, scrolling nav (`overscroll-behavior: contain`), fixed foot |
| Safe areas | head padding uses `env(safe-area-inset-top)`, foot padding uses `env(safe-area-inset-bottom)` |
| Doesn't freeze the page | `body.pd-nav-open` locks with `position: fixed` and restores the exact `scrollY` on close, so iOS does not jump to the top |
| Live Service | marked with the existing `.pd-drawer-live` treatment; it is an existing feature, not a new one |

The runtime render is idempotent (`data-pd-nav-rendered`), so any number of scripts calling `init()` still
produces exactly one drawer.

## 5. Tabs are separate again

Page-local tabs were left in their pages. The global menu no longer contains a second copy of those
destinations in a different form: the Academy's own tab strip stays in the Academy, and the global menu
always answers with the same 22 destinations. `PDNav` never reads or writes tab state.

## 6. Bottom navigation is one system

* The seven pages that had a bar now show the **same six destinations in the same order**
  (`index`, `ai-prayer`, `news`, `radio`, `sermons`, `translate`, `widgets`).
* The active item is derived from the route, so every page highlights the right tab without hand-editing.
* A second bar on the same page is removed by `hydrateBottomNav()`; no page can show two.
* Pages without a bar are left alone — the bar was never a universal element, and adding it to reading
  pages would only cover their content.
* The bar exists in `.bottom-ui-system`, which already reserves the bar's height; the mobile stylesheet
  keeps `body` padding for it plus `env(safe-area-inset-bottom)`, so it never covers page content or
  controls.

## 7. No dead or duplicate destinations

`tests/nav.test.js` asserts, and `npm run lint` re-asserts at build time:

* no duplicate destinations anywhere in the menu or the bar;
* every destination resolves to a file in the repository;
* every icon exists in the generated Lucide set (277 icons);
* every label is non-empty and shorter than 24 characters;
* exactly one destination is active on each of the 39 routes, and it is the right one (checked by booting
  each page's markup in jsdom with `PDNav`);
* every page ships the canonical markup and lists the whole menu;
* every page with a bottom bar reserves space and safe-area padding for it.

## 8. Behaviour checks (jsdom)

`tests/nav.test.js` boots `index.html` and `game.html` with the real scripts and asserts:

* the button opens the drawer, sets `aria-expanded`, moves focus inside and locks the page;
* Escape closes it, unlocks the page and returns focus to the button;
* the backdrop closes it;
* choosing a destination closes it and unlocks the page;
* a `pageshow` event closes it;
* the app layer never injects a second drawer and never rewrites the menu;
* the menu is identical on every route (`game.html` and `index.html` produce the same destination list).

## 9. What this did **not** change

Page structure, header layout, palette, typography, page titles, tab strips, footers' visual design, the
admin console (which opts out with `data-pd-layout="none"` and keeps its own sidebar), and every existing
destination. No feature was removed and no menu entry points at a page that does not exist.
