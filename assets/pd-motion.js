/*
 * Prayer Dome — motion runtime
 * ---------------------------------------------------------------------------
 * Powers the classes defined in pd-brand.css. Pure vanilla, no dependencies,
 * safe to drop on any page with:
 *
 *     <script src="/assets/pd-motion.js" defer></script>
 *
 * It is deliberately defensive: everything is feature-detected, and if the
 * visitor has asked their OS to reduce motion it reveals content immediately
 * and skips every animated behaviour.
 */
(function () {
  'use strict';

  /* Mark JS as live immediately so CSS can safely pre-hide reveal targets. */
  document.documentElement.classList.add('pd-js');

  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
   * 1. Aurora backdrop — injected once, behind everything.
   * ------------------------------------------------------------------- */
  function mountAurora() {
    if (document.querySelector('.pd-aurora')) return;
    if (document.body.hasAttribute('data-pd-no-aurora')) return;
    var el = document.createElement('div');
    el.className = 'pd-aurora';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span></span>';
    document.body.insertBefore(el, document.body.firstChild);

    // Hand the page background up to <html> so the backdrop is visible behind
    // <body>. Doing it here rather than in CSS means a page that never loads
    // this script keeps its original opaque background and looks unchanged.
    document.documentElement.classList.add('pd-has-aurora');

    // Dark mode flips --bg-primary on <body>, so mirror the class onto <html>
    // and keep it in sync when the visitor toggles the theme.
    function syncTheme() {
      document.documentElement.classList.toggle(
        'dark-mode', document.body.classList.contains('dark-mode')
      );
    }
    syncTheme();
    if (window.MutationObserver) {
      new MutationObserver(syncTheme).observe(document.body, {
        attributes: true, attributeFilter: ['class']
      });
    }
  }

  /* ---------------------------------------------------------------------
   * 2. Scroll progress bar.
   * ------------------------------------------------------------------- */
  function mountProgress() {
    if (reduce) return;
    if (document.querySelector('.pd-progress')) return;
    if (document.body.hasAttribute('data-pd-no-progress')) return;

    var bar = document.createElement('div');
    bar.className = 'pd-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    var ticking = false;
    function update() {
      var doc = document.documentElement;
      var max = (doc.scrollHeight - doc.clientHeight) || 1;
      var pct = Math.min(1, Math.max(0, (window.scrollY || doc.scrollTop) / max));
      bar.style.transform = 'scaleX(' + pct + ')';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------------------------------------------------------------------
   * 3. Scroll reveal for .pd-reveal elements.
   *    Honours data-pd-delay="200" (milliseconds) for staggering.
   * ------------------------------------------------------------------- */
  var observer = null;

  function revealNow(el) {
    el.classList.add('is-visible');
  }

  function observe(el) {
    if (!observer) { revealNow(el); return; }
    observer.observe(el);
  }

  function mountReveal() {
    var nodes = document.querySelectorAll('.pd-reveal');

    if (reduce || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(nodes, revealNow);
      return;
    }

    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.getAttribute('data-pd-delay') || '0', 10);
        if (delay > 0) el.style.transitionDelay = delay + 'ms';
        revealNow(el);
        observer.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    Array.prototype.forEach.call(nodes, observe);
  }

  /* Re-scan after dynamically injecting markup. */
  function refresh(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('.pd-reveal:not(.is-visible)');
    Array.prototype.forEach.call(nodes, function (el) {
      if (reduce || !observer) { revealNow(el); } else { observer.observe(el); }
    });
    autoScan(scope);
  }

  /* ---------------------------------------------------------------------
   * 3b. Automatic entrance motion for every page.
   *     - `main` rises softly once on load (.pd-page-enter).
   *     - top-level `main > section|article` blocks fade/slide in as they
   *       enter the viewport, staggered in source order.
   *     Opt out per-page with data-pd-no-auto-reveal / data-pd-no-enter
   *     on <body>, or per-block with data-pd-no-reveal.
   * ------------------------------------------------------------------- */
  var autoObserver = null;

  function autoRevealNow(el) {
    el.classList.add('is-visible');
    el.classList.remove('pd-auto-reveal');
  }

  function ensureAutoObserver() {
    if (autoObserver || !('IntersectionObserver' in window)) return;
    autoObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        autoRevealNow(el);
        autoObserver.unobserve(el);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
  }

  /* Blocks that get the fade-rise treatment as they enter the viewport.
     Sections lead wherever a page defines them; common card classes cover
     the div-based pages. Elements inside an already-revealed ancestor are
     skipped so animations never nest. */
  var AUTO_TARGETS =
    'main > section:not([data-pd-no-reveal]), ' +
    'main > article:not([data-pd-no-reveal]), ' +
    '.container > section:not([data-pd-no-reveal]), ' +
    '.main-container > section:not([data-pd-no-reveal]), ' +
    '.app-wrapper > section:not([data-pd-no-reveal]), ' +
    '.content > section:not([data-pd-no-reveal]), ' +
    '[class*="-grid"] > *:not([data-pd-no-reveal]), ' +
    '.tab-content:not([data-pd-no-reveal]), ' +
    '.content-card:not([data-pd-no-reveal]), ' +
    '.news-card:not([data-pd-no-reveal]), ' +
    '.panel-card:not([data-pd-no-reveal]), ' +
    '.stat-card:not([data-pd-no-reveal]), ' +
    '.kpi-card:not([data-pd-no-reveal]), ' +
    '.settings-card:not([data-pd-no-reveal]), ' +
    '.glass-card:not([data-pd-no-reveal]), ' +
    '.hero-card:not([data-pd-no-reveal]), ' +
    '.benefit-card:not([data-pd-no-reveal])';

  function autoScan(root) {
    if (reduce || !('IntersectionObserver' in window)) return;
    if (document.body.hasAttribute('data-pd-no-auto-reveal')) return;
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    var blocks = scope.querySelectorAll(AUTO_TARGETS);
    var i = 0;
    Array.prototype.forEach.call(blocks, function (el) {
      if (el.hasAttribute('data-pd-auto-done')) return;
      var parent = el.parentElement && el.parentElement.closest('.pd-auto-reveal');
      if (parent) return;
      el.classList.add('pd-auto-reveal');
      el.setAttribute('data-pd-auto-done', '1');
      el.style.transitionDelay = Math.min(i * 70, 350) + 'ms';
      i += 1;
      ensureAutoObserver();
      if (autoObserver) autoObserver.observe(el);
      else autoRevealNow(el);
    });
  }

  function mountAutoReveal() {
    if (reduce) return;
    if (!document.body.hasAttribute('data-pd-no-enter')) {
      var hero = document.querySelector('main') ||
                 document.querySelector('.container') ||
                 document.querySelector('.main-container') ||
                 document.querySelector('.app-wrapper') ||
                 document.querySelector('.page-wrapper');
      if (hero && !hero.classList.contains('pd-page-enter')) {
        hero.classList.add('pd-page-enter');
      }
    }
    autoScan(document);

    /* Pages that render lists after first paint (radio, news, sermons…)
       get the same treatment: re-scan (cheap, done-marked) when new nodes
       appear so fresh cards rise in as well. */
    if (window.MutationObserver && !document.body.hasAttribute('data-pd-no-auto-reveal')) {
      var scheduled = false;
      new MutationObserver(function () {
        if (scheduled) return;
        scheduled = true;
        setTimeout(function () {
          scheduled = false;
          autoScan(document);
        }, 120);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  function applyStagger() {
    var groups = document.querySelectorAll('[data-pd-stagger]');
    Array.prototype.forEach.call(groups, function (group) {
      var step = parseInt(group.getAttribute('data-pd-stagger') || '90', 10);
      var kids = group.querySelectorAll(':scope > .pd-reveal');
      Array.prototype.forEach.call(kids, function (kid, i) {
        if (!kid.hasAttribute('data-pd-delay')) {
          kid.setAttribute('data-pd-delay', String(i * step));
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
   * 4. Magnetic tilt for [data-pd-tilt] cards (pointer devices only).
   * ------------------------------------------------------------------- */
  function mountTilt() {
    if (reduce) return;
    if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;

    var cards = document.querySelectorAll('[data-pd-tilt]');
    Array.prototype.forEach.call(cards, function (card) {
      var max = parseFloat(card.getAttribute('data-pd-tilt')) || 7;
      card.style.transformStyle = 'preserve-3d';
      card.style.transition = 'transform .25s cubic-bezier(.16,1,.3,1)';

      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          'perspective(900px) rotateX(' + (-py * max).toFixed(2) + 'deg) ' +
          'rotateY(' + (px * max).toFixed(2) + 'deg) translateY(-6px)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
      });
    });
  }

  /* ---------------------------------------------------------------------
   * 5. Count-up numbers: <span data-pd-count="1200">0</span>
   * ------------------------------------------------------------------- */
  function mountCounters() {
    var nodes = document.querySelectorAll('[data-pd-count]');
    if (!nodes.length) return;

    function run(el) {
      var target = parseFloat(el.getAttribute('data-pd-count')) || 0;
      var suffix = el.getAttribute('data-pd-suffix') || '';
      if (reduce) { el.textContent = target.toLocaleString() + suffix; return; }

      var dur = parseInt(el.getAttribute('data-pd-duration') || '1600', 10);
      var start = performance.now();
      (function step(now) {
        var t = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased).toLocaleString() + suffix;
        if (t < 1) requestAnimationFrame(step);
      })(start);
    }

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(nodes, run);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        run(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.4 });
    Array.prototype.forEach.call(nodes, function (n) { io.observe(n); });
  }

  /* ---------------------------------------------------------------------
   * 6. Gentle parallax for [data-pd-parallax="0.2"].
   * ------------------------------------------------------------------- */
  function mountParallax() {
    if (reduce) return;
    var nodes = document.querySelectorAll('[data-pd-parallax]');
    if (!nodes.length) return;

    var ticking = false;
    function update() {
      var vh = window.innerHeight;
      Array.prototype.forEach.call(nodes, function (el) {
        var speed = parseFloat(el.getAttribute('data-pd-parallax')) || 0.15;
        var r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        var offset = (r.top + r.height / 2 - vh / 2) * speed;
        el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------------------------------------------------------------------
   * 7. Ripple on .pd-btn clicks.
   * ------------------------------------------------------------------- */
  function mountRipple() {
    if (reduce) return;
    document.addEventListener('pointerdown', function (e) {
      var btn = e.target.closest && e.target.closest('.pd-btn');
      if (!btn) return;
      var r = btn.getBoundingClientRect();
      var size = Math.max(r.width, r.height);
      var ink = document.createElement('span');
      ink.style.cssText =
        'position:absolute;border-radius:50%;pointer-events:none;' +
        'background:rgba(255,255,255,.45);transform:scale(0);opacity:1;' +
        'width:' + size + 'px;height:' + size + 'px;' +
        'left:' + (e.clientX - r.left - size / 2) + 'px;' +
        'top:'  + (e.clientY - r.top  - size / 2) + 'px;' +
        'transition:transform .55s cubic-bezier(.16,1,.3,1),opacity .6s ease;';
      btn.appendChild(ink);
      requestAnimationFrame(function () {
        ink.style.transform = 'scale(2.4)';
        ink.style.opacity = '0';
      });
      setTimeout(function () { ink.remove(); }, 700);
    }, { passive: true });
  }

  /* ---------------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------------- */
  function init() {
    mountAurora();
    mountProgress();
    applyStagger();
    mountReveal();
    mountAutoReveal();
    mountTilt();
    mountCounters();
    mountParallax();
    mountRipple();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.PDMotion = { refresh: refresh, reduced: reduce };
})();
