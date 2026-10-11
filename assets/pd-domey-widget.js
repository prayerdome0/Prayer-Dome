/*
 * Prayer Dome — Domey live companion (the hosted Three.ws widget).
 * ---------------------------------------------------------------------------
 * Domey's avatar, chat, voice and Bible quiz are one saved widget on three.ws
 * (wdgt_fRRTp6-HRgOh). This file only *embeds* that widget and keeps the embed
 * honest about its state:
 *
 *   • a loading placeholder while the frame arrives,
 *   • a helpful panel — never an endless spinner — when the browser is offline
 *     or three.ws cannot be reached, with "Try again" and a direct link,
 *   • a retry control that reinstalls the frame and restarts the watch.
 *
 * The AI behind the avatar lives with the widget: its provider and behaviour
 * are configured in Three.ws Studio for this widget id, so no AI key of any
 * kind is read from, or needed by, this website. Nothing here calls an AI
 * endpoint.
 *
 * The page ships the embed markup (#domeyWidgetStage with the iframe, the
 * loading and error panels); this script wires the life cycle and publishes
 * PDDomeyWidget for the Retry control.
 */
(function () {
  'use strict';

  var EMBED_SRC = 'https://three.ws/widget#widget=wdgt_fRRTp6-HRgOh&kiosk=true';
  var WIDGET_PAGE = 'https://three.ws/w/wdgt_fRRTp6-HRgOh';
  var LOAD_TIMEOUT_MS = 20000;
  var PROBE_TIMEOUT_MS = 8000;
  var OFFLINE_TEXT = 'You appear to be offline. Reconnect to the internet, then tap Try again.';
  var UNREACHABLE_TEXT = 'We could not reach Domey on three.ws. Check your connection and tap Try again — or open Domey in a new tab.';
  var TIMEOUT_TEXT = 'Domey is taking longer than expected to load. Check your connection and tap Try again — or open her in a new tab.';

  var loadTimer = null;
  var probeController = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function parts() {
    return {
      stage: byId('domeyWidgetStage'),
      frame: byId('domeyWidgetFrame'),
      loading: byId('domeyWidgetLoading'),
      error: byId('domeyWidgetError'),
      errorText: byId('domeyWidgetErrorText'),
      retry: byId('domeyWidgetRetry')
    };
  }

  function show(element, visible) {
    if (!element) return;
    if (visible) element.removeAttribute('hidden');
    else element.setAttribute('hidden', '');
  }

  function showLoading() {
    var p = parts();
    if (!p.loading) return;
    /* Restart the CSS "no-JS" auto-fade so a retried placeholder is visible
       again even if an earlier timeout animation already finished. */
    p.loading.style.animation = 'none';
    void p.loading.offsetWidth;
    p.loading.style.animation = '';
    show(p.loading, true);
  }

  function stopWatchers() {
    if (loadTimer !== null) {
      clearTimeout(loadTimer);
      loadTimer = null;
    }
    if (probeController) {
      try { probeController.abort(); } catch (e) { /* already aborted */ }
      probeController = null;
    }
  }

  function settleLoaded() {
    stopWatchers();
    var p = parts();
    show(p.loading, false);
    show(p.error, false);
  }

  function settleFailed(message) {
    stopWatchers();
    var p = parts();
    show(p.loading, false);
    if (p.errorText && message) p.errorText.textContent = message;
    show(p.error, true);
  }

  function wire(frame) {
    if (!frame) return;
    frame.addEventListener('load', function () {
      frame.setAttribute('data-loaded', '1');
      settleLoaded();
    });
    frame.addEventListener('error', function () {
      frame.setAttribute('data-failed', '1');
      settleFailed(UNREACHABLE_TEXT);
    });
  }

  /* A fresh frame node: clones keep every attribute of the embed (src, title,
     allow, sandbox, width/height, loading) but drop the load markers, and
     reassigning a brand-new element is the one reload every browser agrees on. */
  function installFrame() {
    var p = parts();
    if (!p.frame || !p.stage || !p.frame.parentNode) return null;
    var fresh = p.frame.cloneNode(false);
    fresh.removeAttribute('data-loaded');
    fresh.removeAttribute('data-failed');
    fresh.setAttribute('loading', 'eager');
    p.frame.parentNode.replaceChild(fresh, p.frame);
    wire(fresh);
    return fresh;
  }

  function beginWatch() {
    var p = parts();
    if (!p.stage) return;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      settleFailed(OFFLINE_TEXT);
      return;
    }

    showLoading();
    show(p.error, false);

    /* Probe three.ws first (no-cors: any HTTP answer counts as reachable;
       only a genuine network failure rejects). Iframes fire `load` even for
       browser error pages, so the probe is what lets us tell "widget loaded"
       apart from "you are offline" and say so instead of leaving a blank box. */
    if (typeof fetch === 'function') {
      probeController = typeof AbortController === 'function' ? new AbortController() : null;
      var probeOptions = { mode: 'no-cors', cache: 'no-store' };
      if (probeController) probeOptions.signal = probeController.signal;
      var probeTimer = setTimeout(function () {
        if (probeController) {
          try { probeController.abort(); } catch (e) { /* ignore */ }
        }
      }, PROBE_TIMEOUT_MS);
      fetch(WIDGET_PAGE, probeOptions).then(function () {
        clearTimeout(probeTimer);
        probeController = null;
        installFrame();
        startLoadTimer();
      }, function () {
        clearTimeout(probeTimer);
        probeController = null;
        settleFailed(UNREACHABLE_TEXT);
      });
      return;
    }

    installFrame();
    startLoadTimer();
  }

  function startLoadTimer() {
    if (loadTimer !== null) clearTimeout(loadTimer);
    loadTimer = setTimeout(function () {
      loadTimer = null;
      var p = parts();
      if (p.frame && p.frame.getAttribute('data-loaded') === '1') return;
      settleFailed(TIMEOUT_TEXT);
    }, LOAD_TIMEOUT_MS);
  }

  function retry() {
    var p = parts();
    if (!p.stage) return;
    stopWatchers();
    show(p.error, false);
    showLoading();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      settleFailed(OFFLINE_TEXT);
      return;
    }
    /* Retry is a user gesture: skip the probe's caution and reinstall at once —
       the 20s watchdog still reports a frame that never arrives. */
    installFrame();
    startLoadTimer();
  }

  function init() {
    var p = parts();
    if (!p.stage || !p.frame) return;

    wire(p.frame);
    if (p.retry) p.retry.addEventListener('click', retry);

    window.addEventListener('offline', function () {
      var q = parts();
      if (q.frame && q.frame.getAttribute('data-loaded') === '1') return;
      settleFailed(OFFLINE_TEXT);
    });
    window.addEventListener('online', function () {
      var q = parts();
      if (q.frame && q.frame.getAttribute('data-loaded') === '1') return;
      if (q.error && !q.error.hasAttribute('hidden')) retry();
    });

    /* The embed is loading="lazy" (as shipped by three.ws), so the watchdog
       only starts once the stage is near the viewport — otherwise a visitor
       who never scrolls would get a false "not loading" panel. */
    if (p.frame.getAttribute('data-loaded') === '1') {
      settleLoaded();
      return;
    }
    if (p.frame.getAttribute('data-failed') === '1') {
      settleFailed(UNREACHABLE_TEXT);
      return;
    }
    if (typeof IntersectionObserver === 'function') {
      var observer = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i += 1) {
          if (!entries[i].isIntersecting) continue;
          observer.disconnect();
          beginWatch();
          break;
        }
      }, { rootMargin: '200px 0px' });
      observer.observe(p.stage);
    } else {
      beginWatch();
    }
  }

  window.PDDomeyWidget = {
    embedSrc: EMBED_SRC,
    widgetPage: WIDGET_PAGE,
    retry: retry,
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
