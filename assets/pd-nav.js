/*!
 * Prayer Dome — the ONE navigation configuration (assets/pd-nav.js)
 * ===========================================================================
 * Every Prayer Dome page used to carry its own copy of the menu: the home page
 * listed 17 destinations, the Academy pages listed 9, the lesson reader listed
 * 3 — and two different scripts (the shared layout layer and the "Academy nav"
 * module) injected further links into whichever drawer happened to be on the
 * page. That is why the menu appeared to change when a member moved from Home
 * to Games to Teachings.
 *
 * This file is now the single authoritative description of:
 *   • the grouped global menu (the drawer),
 *   • the secondary links in the drawer footer,
 *   • the bottom navigation bar.
 *
 * Pages do not need to repeat it: `<script src="/assets/pd-nav.js" defer>`
 * renders the menu into the page's own `#pdDrawer` (or injects one) and repairs
 * the active state, so the same set of destinations is on screen on every
 * route. Page-specific tabs stay in the page — they are never merged into the
 * global menu.
 *
 * Programmatic use:
 *   PDNav.GROUPS                 the menu, grouped
 *   PDNav.all()                  every global destination (flat)
 *   PDNav.isActive('/quiz')      route-aware active test
 *   PDNav.drawerMarkup()         canonical <nav class="pd-drawer-nav"> markup
 *   PDNav.bottomMarkup()         canonical bottom-bar markup
 *   PDNav.open() / close()       drawer control (Escape, focus trap, scroll lock)
 *
 * The markup generators are also used by scripts/build-nav.mjs so the HTML in
 * each page and the configuration here can never drift apart (checked by
 * `npm run nav:check` and tests/nav.test.js).
 */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  /* ---------------------------------------------------------------- config */

  /* Only pages that actually exist are listed. `key` is the translation key in
     assets/pd-app.js (nav.*) where one exists, so the five ministry languages
     keep working. `hint` is only used for the screen-reader description. */
  var GROUPS = [
    {
      id: 'main',
      label: 'Main',
      items: [
        { href: '/', icon: 'house', label: 'Home', key: 'nav.home' },
        { href: '/bible', icon: 'book-open', label: 'Bible', key: 'nav.bible' },
        { href: '/lessons', icon: 'graduation-cap', label: 'Teachings', key: 'nav.teaching' },
        { href: '/prayer', icon: 'hands-praying', label: 'Prayer Wall', key: 'nav.pray' }
      ]
    },
    {
      id: 'learn',
      label: 'Learn & Play',
      items: [
        { href: '/game', icon: 'gamepad-2', label: 'Play with Domey' },
        { href: '/quiz', icon: 'star', label: 'Bible Quizzes', key: 'nav.quizzes' },
        { href: '/stories', icon: 'book-open-text', label: 'Bible Stories', key: 'nav.stories' },
        { href: '/resources', icon: 'folder-open', label: 'Study Resources', key: 'nav.resources' }
      ]
    },
    {
      id: 'community',
      label: 'Community',
      items: [
        { href: '/chat', icon: 'messages-square', label: 'Community Hub', key: 'nav.chat' },
        { href: '/testimony', icon: 'sparkles', label: 'Testimonies', key: 'nav.testimony' },
        { href: '/events', icon: 'calendar-days', label: 'Events', key: 'nav.events' },
        { href: '/gallery', icon: 'images', label: 'Gallery', key: 'nav.gallery' },
        { href: '/news', icon: 'newspaper', label: 'Christian News', key: 'nav.news' }
      ]
    },
    {
      id: 'media',
      label: 'Media',
      items: [
        { href: '/live', icon: 'radio', label: 'Live Service', key: 'nav.live', live: true },
        { href: '/sermons', icon: 'mic', label: 'Sermons', key: 'nav.sermons' },
        { href: '/video', icon: 'circle-play', label: 'Gospel Media', key: 'nav.media' },
        { href: '/radio', icon: 'radio-tower', label: 'Radio & Podcasts' }
      ]
    },
    {
      id: 'personal',
      label: 'Personal',
      items: [
        { href: '/account', icon: 'circle-user', label: 'My Account', key: 'nav.account' },
        { href: '/widgets', icon: 'smartphone', label: 'Verse Widget' },
        { href: '/membership', icon: 'id-card', label: 'Membership' },
        { href: '/give', icon: 'heart', label: 'Give', key: 'nav.give' },
        { href: '/support', icon: 'hand-heart', label: 'Support', key: 'nav.support' }
      ]
    }
  ];

  /* Small print row in the drawer foot — real pages, deliberately secondary. */
  var SECONDARY = [
    { href: '/about', icon: 'church', label: 'About', key: 'nav.about' },
    { href: '/contact', icon: 'mail', label: 'Contact', key: 'nav.contact' },
    { href: '/team', icon: 'users', label: 'Team', key: 'nav.team' },
    { href: '/privacy', icon: 'shield-check', label: 'Privacy' }
  ];

  /* The bottom bar is a different system from the menu: five or six primary
     destinations that are always in the same order and always highlighted with
     the same rule, on every page that shows a bar at all. */
  var BOTTOM = [
    { href: '/', icon: 'house', label: 'Home', key: 'nav.home' },
    { href: '/bible', icon: 'book-open', label: 'Bible', key: 'nav.bible' },
    { href: '/lessons', icon: 'graduation-cap', label: 'Learn', key: 'nav.teaching' },
    { href: '/game', icon: 'gamepad-2', label: 'Play' },
    { href: '/prayer', icon: 'hands-praying', label: 'Pray', key: 'nav.pray' },
    { href: '/account', icon: 'circle-user', label: 'Account', key: 'nav.account' }
  ];

  /* Routes that belong to a section without being the section's own URL (a
     lesson reader is part of Teachings, a shared resource view part of Study
     Resources). aliases keep the highlight correct on those pages instead of
     leaving the whole menu unhighlighted. */
  var ALIASES = {
    '/index': '/',
    '/index.html': '/',
    '/academy': '/lessons',
    '/teaching': '/lessons',
    '/lesson': '/lessons',
    '/lesson-quiz': '/lessons',
    '/lesson-audio': '/lessons',
    '/lesson-pdf': '/lessons',
    '/resource-view': '/resources',
    '/prayer-wall': '/prayer',
    '/event': '/events',
    '/assistant': '/ai-prayer',
    '/giving': '/give',
    '/lock-screen-verse': '/widgets',
    '/sermons-center': '/sermons'
  };

  /* ----------------------------------------------------------------- utils */

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** '/bible.html?x=1#top' -> '/bible' */
  function norm(href) {
    var path = String(href == null ? '' : href).split('#')[0].split('?')[0];
    if (!path) return '/';
    if (path.charAt(0) !== '/') path = '/' + path;
    if (path.length > 1) path = path.replace(/\/+$/, '');
    return path || '/';
  }

  /** The canonical section a URL belongs to (resolves .html, aliases, trailing /). */
  function canonical(href) {
    var path = norm(href);
    if (/\.html$/i.test(path)) path = path.slice(0, -5);
    if (path.length > 1) path = path.replace(/\/+$/, '');
    if (!path) path = '/';
    return ALIASES[path] || path;
  }

  function currentPath() {
    try { return canonical(global.location ? global.location.pathname : '/'); }
    catch (e) { return '/'; }
  }

  /** True when `href` is the section the member is currently in. */
  function isActive(href, page) {
    var here = page ? canonical(page) : currentPath();
    var target = canonical(href);
    if (target === '/') return here === '/';
    if (here === target) return true;
    return here.indexOf(target + '/') === 0;
  }

  function all() {
    var out = [];
    GROUPS.forEach(function (group) { group.items.forEach(function (item) { out.push(item); }); });
    return out;
  }

  function iconName(item) {
    if (global.PDIcons && typeof global.PDIcons.resolve === 'function') {
      return global.PDIcons.resolve(item.icon, 'circle');
    }
    return item.icon || 'circle';
  }

  function labelAttrs(item) {
    return item.key ? ' data-pd-t="' + esc(item.key) + '"' : '';
  }

  /* ------------------------------------------------------------- markup */

  /** Canonical drawer contents (what sits inside #pdDrawer). */
  function drawerMarkup() {
    var head = ''
      + '<div class="pd-drawer-head">'
      + '<img src="/assets/logo.png" alt="Prayer Dome">'
      + '<div class="pd-drawer-brand">'
      + '<div class="pd-drawer-title">Prayer Dome</div>'
      + '<small>A House of Prayer for All Nations</small>'
      + '</div>'
      + '<button class="pd-drawer-close" type="button" aria-label="Close menu"><i class="pd-i pd-i-x" aria-hidden="true"></i></button>'
      + '</div>';

    var nav = '<nav class="pd-drawer-nav" aria-label="Sections of Prayer Dome">';
    GROUPS.forEach(function (group) {
      nav += '\n  <div class="pd-drawer-group" data-pd-nav-group="' + esc(group.id) + '">'
        + '\n    <p class="pd-drawer-group-title" id="pdNavGroup-' + esc(group.id) + '">' + esc(group.label) + '</p>';
      group.items.forEach(function (item) {
        var active = isActive(item.href);
        nav += '\n    <a class="pd-drawer-link' + (item.live ? ' pd-drawer-live' : '') + (active ? ' active' : '') + '"'
          + ' href="' + esc(item.href) + '"'
          + ' data-pd-nav="' + esc(item.href) + '"'
          + (active ? ' aria-current="page"' : '')
          + '>'
          + '<i class="pd-i pd-i-' + iconName(item) + '" aria-hidden="true"></i>'
          + '<span' + labelAttrs(item) + '>' + esc(item.label) + '</span>'
          + '</a>';
      });
      nav += '\n  </div>';
    });
    nav += '\n</nav>';

    var foot = '<div class="pd-drawer-foot">'
      + '<div class="pd-drawer-sub">'
      + SECONDARY.map(function (item) {
        return '\n  <a class="pd-drawer-sub-link" href="' + esc(item.href) + '" data-pd-nav="' + esc(item.href) + '">'
          + '<i class="pd-i pd-i-' + iconName(item) + '" aria-hidden="true"></i>'
          + '<span' + labelAttrs(item) + '>' + esc(item.label) + '</span></a>';
      }).join('')
      + '\n</div>'
      + '<p class="pd-drawer-verse"><i class="pd-i pd-i-book" aria-hidden="true"></i> “He does everything blamelessly.” — Mark 7:37</p>'
      + '<small>© Prayer Dome Ministry · Zambia · Eswatini · South Africa · Malawi · Ireland</small>'
      + '</div>';

    return head + nav + foot;
  }

  /** Canonical bottom navigation markup. */
  function bottomMarkup() {
    var html = '<nav class="nav-bar pd-nav-bar" aria-label="Primary navigation">';
    BOTTOM.forEach(function (item) {
      var active = isActive(item.href);
      html += '\n  <a class="nav-link pd-nav-link' + (active ? ' active' : '') + '"'
        + ' href="' + esc(item.href) + '"'
        + ' data-pd-nav="' + esc(item.href) + '"'
        + (active ? ' aria-current="page"' : '')
        + '>'
        + '<i class="pd-i pd-i-' + iconName(item) + '" aria-hidden="true"></i>'
        + '<span' + labelAttrs(item) + '>' + esc(item.label) + '</span>'
        + '</a>';
    });
    return html + '\n</nav>';
  }

  /* ------------------------------------------------------------ render */

  function hydrateDrawer(root) {
    var drawer = root || document.getElementById('pdDrawer') || document.querySelector('.pd-drawer');
    if (!drawer) return null;
    // The drawer is a live region for the menu button: make its state explicit.
    if (!drawer.hasAttribute('role')) drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    if (!drawer.id) drawer.id = 'pdDrawer';
    if (drawer.getAttribute('aria-label') == null) drawer.setAttribute('aria-label', 'Main menu');
    if (!drawer.hasAttribute('aria-hidden')) drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('tabindex', '-1');
    // A closed drawer is off screen; `inert` (where supported) also keeps its
    // links out of the tab order and away from screen readers.
    if (!drawer.classList.contains('open')) drawer.setAttribute('inert', '');

    // Re-render the contents from the one configuration. Marker prevents the
    // work (and any chance of a double menu) when several scripts call init().
    drawer.innerHTML = drawerMarkup();
    drawer.setAttribute('data-pd-nav-rendered', VERSION);

    // The overlay is part of the drawer system, wherever the page forgot it.
    var overlay = document.getElementById('pdDrawerOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'pd-drawer-overlay';
      overlay.id = 'pdDrawerOverlay';
      overlay.setAttribute('hidden', '');
      if (drawer.parentNode) drawer.parentNode.insertBefore(overlay, drawer);
      else document.body.appendChild(overlay);
    }
    return drawer;
  }

  function hydrateBottomNav() {
    var bars = Array.prototype.slice.call(document.querySelectorAll('.bottom-ui-system .nav-bar, .pd-bottom-header .nav-bar'));
    if (!bars.length) return null;
    var canonicalBar = null;
    bars.forEach(function (bar, index) {
      if (!canonicalBar) {
        // One bar per page: keep its id (the home page wires admin shortcuts to
        // #mainNavBar) but replace the items with the canonical set.
        var id = bar.id || '';
        var wrapper = bar.parentNode;
        var temp = document.createElement('div');
        temp.innerHTML = bottomMarkup();
        var replacement = temp.firstChild;
        if (id) replacement.id = id;
        wrapper.replaceChild(replacement, bar);
        canonicalBar = replacement;
      } else {
        // Never allow a second bottom bar on the same page.
        bar.parentNode.removeChild(bar);
      }
    });
    return canonicalBar;
  }

  /** Re-evaluate the highlight without re-rendering (used on bfcache restore). */
  function refreshActive() {
    Array.prototype.slice.call(document.querySelectorAll('[data-pd-nav]')).forEach(function (link) {
      var target = link.getAttribute('data-pd-nav');
      var active = isActive(target);
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  /* ------------------------------------------------------- drawer control */

  var bound = false;
  var lastFocus = null;
  var savedScrollY = 0;
  var OPEN_CLASS = 'pd-nav-open';

  function drawerEl() { return document.getElementById('pdDrawer') || document.querySelector('.pd-drawer'); }
  function overlayEl() { return document.getElementById('pdDrawerOverlay'); }
  function menuButton() { return document.getElementById('pdMenuBtn'); }
  function isOpen() {
    var drawer = drawerEl();
    return !!(drawer && drawer.classList.contains('open'));
  }

  function focusables(drawer) {
    return Array.prototype.slice.call(drawer.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement; });
  }

  function open(options) {
    var drawer = drawerEl();
    if (!drawer) return false;
    options = options || {};
    lastFocus = document.activeElement;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.removeAttribute('inert');
    var overlay = overlayEl();
    if (overlay) {
      overlay.removeAttribute('hidden');
      overlay.classList.add('open');
    }
    if (options.lockScroll !== false) {
      savedScrollY = global.pageYOffset || 0;
      document.body.classList.add(OPEN_CLASS);
      document.body.style.top = '-' + savedScrollY + 'px';
    }
    var button = menuButton();
    if (button) {
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('aria-label', 'Close menu');
    }
    drawer.setAttribute('data-pd-nav-open', '1');
    // Move focus into the drawer so keyboard and screen-reader users land in
    // the menu instead of behind it.
    try {
      var close = drawer.querySelector('.pd-drawer-close');
      (options.focusEl || close || drawer).focus({ preventScroll: true });
    } catch (e) { /* older WebViews */ }
    document.dispatchEvent(new CustomEvent('pd:nav-open'));
    return true;
  }

  function close(options) {
    var drawer = drawerEl();
    if (!drawer) return false;
    options = options || {};
    var wasOpen = drawer.classList.contains('open');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    drawer.removeAttribute('data-pd-nav-open');
    var overlay = overlayEl();
    if (overlay) {
      overlay.classList.remove('open');
      overlay.setAttribute('hidden', '');
    }
    if (document.body.classList.contains(OPEN_CLASS)) {
      document.body.classList.remove(OPEN_CLASS);
      document.body.style.top = '';
      // Restore the scroll position the lock stole.
      if (savedScrollY) { try { global.scrollTo(0, savedScrollY); } catch (e) {} }
    }
    var button = menuButton();
    if (button) {
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Open menu');
    }
    if (wasOpen && options.restoreFocus !== false) {
      // Return focus where it came from (the hamburger, usually). A body/null
      // origin is not a useful target, so fall back to the menu button.
      var back = (lastFocus && lastFocus !== document.body && lastFocus.focus) ? lastFocus : button;
      try { (back || drawer).focus({ preventScroll: true }); } catch (e) {}
    }
    lastFocus = null;
    if (wasOpen) document.dispatchEvent(new CustomEvent('pd:nav-close'));
    return true;
  }

  function toggle() { return isOpen() ? close() : open(); }

  function setExpanded(button, expanded) {
    if (!button) return;
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.setAttribute('aria-label', expanded ? 'Close menu' : 'Open menu');
  }

  function bind() {
    if (bound) return;
    bound = true;

    // Event delegation: the drawer can be re-rendered at any time (a language
    // switch, a role arriving late) and the open/close behaviour never breaks.
    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var opener = target.closest('#pdMenuBtn, [data-pd-nav-toggle]');
      if (opener) {
        event.preventDefault();
        event.stopPropagation();
        if (isOpen()) close();
        else open();
        return;
      }

      if (target.closest('.pd-drawer-close') || target.closest('#pdDrawerOverlay')) {
        event.preventDefault();
        close();
        return;
      }

      // A destination was chosen: close on every screen size. On mobile the
      // drawer would otherwise stay over the page it just navigated to.
      var link = target.closest('#pdDrawer a[data-pd-nav], .pd-drawer a[data-pd-nav], #pdDrawer a[href]');
      if (link) {
        var href = link.getAttribute('href') || '';
        var samePage = href.charAt(0) === '#' ||
          canonical(href) === currentPath();
        // Same-page anchors (e.g. #weeklyChallenge) keep the menu usable: close
        // anyway, it is still a deliberate tap.
        close({ restoreFocus: false });
        if (!samePage) { /* navigation continues normally */ }
        return;
      }

      // Clicking outside an open drawer closes it, even on a page without an
      // overlay element.
      if (isOpen() && !target.closest('.pd-drawer')) close();
    }, true);

    document.addEventListener('keydown', function (event) {
      if (!isOpen()) return;
      var drawer = drawerEl();
      if (!drawer) return;
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      // Keep Tab inside the open drawer.
      var items = focusables(drawer);
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === drawer)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    // A drawer left open through a bfcache restore or a back/forward press must
    // not sit over the page it returned to.
    global.addEventListener('pageshow', function () { close({ restoreFocus: false }); refreshActive(); });
    global.addEventListener('popstate', function () { close({ restoreFocus: false }); refreshActive(); });
    global.addEventListener('hashchange', refreshActive);
    global.addEventListener('resize', function () {
      if (isOpen() && global.innerWidth > 900) close({ restoreFocus: false });
    });

    // The shared layer announces a language change; the labels are re-rendered
    // from the same config rather than patched element by element.
    document.addEventListener('pd:lang', function () { refreshActive(); });
  }

  /* ------------------------------------------------------------------ init */

  function init() {
    if (typeof document === 'undefined') return;
    // Full-screen shells (admin console) own their navigation.
    var root = document.documentElement;
    var body = document.body;
    var optedOut = (root && root.getAttribute('data-pd-layout') === 'none') ||
      (body && (body.getAttribute('data-pd-layout') === 'none' || body.classList.contains('pd-app-shell'))) ||
      /\/admin(\.html)?$/i.test((global.location && global.location.pathname || '').replace(/\/+$/, ''));
    if (optedOut) return;

    var drawer = hydrateDrawer();
    hydrateBottomNav();
    bind();
    if (drawer) setExpanded(menuButton(), drawer.classList.contains('open'));

    // Any page that shows the shared topbar gets a working overlay even if it
    // forgot the element.
    var topbar = document.querySelector('.pd-topbar');
    if (topbar && !overlayEl() && drawer) {
      var overlay = document.createElement('div');
      overlay.className = 'pd-drawer-overlay';
      overlay.id = 'pdDrawerOverlay';
      drawer.parentNode.insertBefore(overlay, drawer);
    }
    document.documentElement.setAttribute('data-pd-nav', VERSION);
  }

  global.PDNav = {
    version: VERSION,
    GROUPS: GROUPS,
    SECONDARY: SECONDARY,
    BOTTOM: BOTTOM,
    ALIASES: ALIASES,
    all: all,
    norm: norm,
    canonical: canonical,
    currentPath: currentPath,
    isActive: isActive,
    drawerMarkup: drawerMarkup,
    bottomMarkup: bottomMarkup,
    hydrateDrawer: hydrateDrawer,
    hydrateBottomNav: hydrateBottomNav,
    refreshActive: refreshActive,
    open: open,
    close: close,
    toggle: toggle,
    isOpen: isOpen,
    init: init
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { try { init(); } catch (e) { console.warn('[PDNav] init failed', e); } });
    } else {
      try { init(); } catch (e) { console.warn('[PDNav] init failed', e); }
    }
  }
})(typeof window !== 'undefined' ? window : this);
