/*
 * Prayer Dome — whole-app translation engine
 * ===========================================================================
 * The original i18n layer only translated elements that carried an explicit
 * `data-pd-t` key, which meant a handful of nav labels changed language and
 * the other ~1,900 phrases in the app stayed in English. This module
 * translates the *entire* rendered page instead:
 *
 *   1. It walks every text node and every human-readable attribute
 *      (placeholder, title, aria-label, alt, value on buttons, and the
 *      labels of <option> elements).
 *   2. It looks each phrase up in PD_PHRASES (assets/pd-phrases.js), a plain
 *      English-keyed dictionary, so pages need no markup changes at all.
 *   3. It remembers the original English in a WeakMap, so switching back to
 *      English — or to a language that lacks a given phrase — restores the
 *      exact source text rather than leaving a stale translation behind.
 *   4. A MutationObserver re-translates anything rendered later by the app
 *      (prayer cards, chat messages, admin tables, dialogs).
 *
 * Anything not in the dictionary is left in English on purpose: a wrong
 * translation is worse than an untranslated string, and the ministry's own
 * review workflow (see translation-data.js) is the way entries get promoted.
 *
 * Public API — window.PDI18n
 *   .apply(langCode)     translate the whole document into a language
 *   .translatePhrase(s)  translate one string (for JS-built text)
 *   .observe()           start watching for dynamically added content
 *   .coverage(lang)      { total, translated, percent } for the current page
 * ===========================================================================
 */
(function (global) {
  'use strict';

  /* Elements whose text is code, markup or data — never translate inside. */
  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1, TEXTAREA: 1,
    SVG: 1, CANVAS: 1, TEMPLATE: 1, IFRAME: 1
  };

  /* Attributes that hold text a person reads. */
  var TEXT_ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'aria-placeholder'];

  /* Original English kept per node so language switching is lossless. */
  var originalText = new WeakMap();   // text node  -> English string
  var originalAttrs = new WeakMap();  // element    -> { attr: English string }

  var currentLang = 'en';
  var observer = null;
  var applying = false;

  function dict(lang) {
    var all = global.PD_PHRASES;
    return (all && all[lang]) || null;
  }

  /* ------------------------------------------------------------- matching */
  /*
   * Phrases in markup carry incidental whitespace, trailing colons, and
   * decorative emoji/arrows. We match on a normalised form and then re-apply
   * whatever punctuation and spacing the original had, so layout is preserved.
   */
  var LEAD_TRIM = /^[\s\u00a0]*((?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u2190-\u21FF\uFE0F\u200D]\s*)*)/u;
  var TAIL_TRIM = /((?:\s*[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u2190-\u21FF\uFE0F\u200D])*)[\s\u00a0]*$/u;

  function split(raw) {
    var lead = '';
    var tail = '';
    var body = String(raw);

    var lm = body.match(LEAD_TRIM);
    if (lm) { lead = lm[0]; body = body.slice(lm[0].length); }
    var tm = body.match(TAIL_TRIM);
    if (tm && tm[0]) { tail = tm[0]; body = body.slice(0, body.length - tm[0].length); }

    /* Trailing punctuation is restored rather than being part of the key. */
    var punct = '';
    var pm = body.match(/([\s]*[:：*…]+)$/);
    if (pm) { punct = pm[1]; body = body.slice(0, body.length - pm[1].length); }

    return { lead: lead, body: body, punct: punct, tail: tail };
  }

  function lookup(body, table) {
    if (!body) return null;
    if (Object.prototype.hasOwnProperty.call(table, body)) return table[body];
    /* Case-insensitive second chance (headings are often upper-cased in CSS
       but upper-cased in the markup too). */
    var lower = body.toLowerCase();
    if (table.__lower__ && Object.prototype.hasOwnProperty.call(table.__lower__, lower)) {
      var hit = table.__lower__[lower];
      if (body === body.toUpperCase() && body !== body.toLowerCase()) return hit.toUpperCase();
      return hit;
    }
    return null;
  }

  /* Build (once per language) a lower-cased index for the fallback lookup. */
  function indexed(table) {
    if (!table || table.__lower__) return table;
    var lower = {};
    Object.keys(table).forEach(function (k) {
      var lk = k.toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(lower, lk)) lower[lk] = table[k];
    });
    Object.defineProperty(table, '__lower__', { value: lower, enumerable: false });
    return table;
  }

  /**
   * Translate a single phrase. Returns the English input unchanged when the
   * dictionary has no entry, which is the deliberate safe default.
   */
  function translatePhrase(raw, lang) {
    var table = dict(lang || currentLang);
    if (!table || !raw) return raw;
    indexed(table);
    var parts = split(raw);
    var hit = lookup(parts.body.trim(), table);
    if (hit == null) return raw;
    /* Preserve the original leading/trailing spacing inside the body slot. */
    var leftPad = parts.body.match(/^\s*/)[0];
    var rightPad = parts.body.match(/\s*$/)[0];
    return parts.lead + leftPad + hit + rightPad + parts.punct + parts.tail;
  }

  /* --------------------------------------------------------------- walking */
  function shouldSkip(el) {
    if (!el) return true;
    if (SKIP_TAGS[el.tagName]) return true;
    if (el.getAttribute && el.getAttribute('translate') === 'no') return true;
    if (el.classList && el.classList.contains('notranslate')) return true;
    /* data-pd-no-i18n opts a subtree out: user content, names, code samples. */
    if (el.hasAttribute && el.hasAttribute('data-pd-no-i18n')) return true;
    return false;
  }

  function inSkippedTree(node) {
    for (var el = node.parentElement; el; el = el.parentElement) {
      if (shouldSkip(el)) return true;
    }
    return false;
  }

  function applyToTextNode(node, lang) {
    var english = originalText.get(node);
    if (english === undefined) {
      english = node.nodeValue;
      /* Nothing to translate in pure whitespace, numbers or punctuation. */
      if (!/[A-Za-z]{2}/.test(english)) return;
      originalText.set(node, english);
    }
    var next = lang === 'en' ? english : translatePhrase(english, lang);
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function applyToAttributes(el, lang) {
    var saved = originalAttrs.get(el);
    if (saved === undefined) {
      saved = {};
      TEXT_ATTRS.forEach(function (attr) {
        var v = el.getAttribute(attr);
        if (v && /[A-Za-z]{2}/.test(v)) saved[attr] = v;
      });
      /* Button/submit value attributes are visible labels. */
      if (el.tagName === 'INPUT') {
        var type = (el.getAttribute('type') || '').toLowerCase();
        if (type === 'button' || type === 'submit' || type === 'reset') {
          var val = el.getAttribute('value');
          if (val && /[A-Za-z]{2}/.test(val)) saved.value = val;
        }
      }
      if (!Object.keys(saved).length) { originalAttrs.set(el, saved); return; }
      originalAttrs.set(el, saved);
    }
    Object.keys(saved).forEach(function (attr) {
      var english = saved[attr];
      var next = lang === 'en' ? english : translatePhrase(english, lang);
      if (el.getAttribute(attr) !== next) el.setAttribute(attr, next);
    });
  }

  function walk(root, lang) {
    if (!root) return;

    if (root.nodeType === 3) {
      if (!inSkippedTree(root)) applyToTextNode(root, lang);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && shouldSkip(root)) return;

    var doc = root.ownerDocument || document;
    var walker = doc.createTreeWalker(root, 1 /* ELEMENT */ | 4 /* TEXT */, {
      acceptNode: function (node) {
        if (node.nodeType === 1) {
          return shouldSkip(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
        return /[A-Za-z]{2}/.test(node.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });

    if (root.nodeType === 1) applyToAttributes(root, lang);

    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 1) applyToAttributes(node, lang);
      else applyToTextNode(node, lang);
    }
  }

  /* -------------------------------------------------------------- observer */
  function observe() {
    if (observer || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(function (records) {
      if (applying || currentLang === 'en') return;
      applying = true;
      try {
        records.forEach(function (rec) {
          if (rec.type === 'childList') {
            Array.prototype.forEach.call(rec.addedNodes, function (n) { walk(n, currentLang); });
          } else if (rec.type === 'attributes' && rec.target && rec.target.nodeType === 1) {
            /* An attribute we translate was rewritten by the app: re-baseline. */
            originalAttrs.delete(rec.target);
            applyToAttributes(rec.target, currentLang);
          } else if (rec.type === 'characterData' && rec.target) {
            originalText.delete(rec.target);
            applyToTextNode(rec.target, currentLang);
          }
        });
      } finally { applying = false; }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TEXT_ATTRS
    });
  }

  /* ------------------------------------------------------------------ api */
  function apply(lang) {
    currentLang = lang || 'en';
    applying = true;
    try {
      walk(document.body || document.documentElement, currentLang);
      if (document.documentElement) {
        /* Screen readers and the browser's own translate prompt both rely on
           an accurate lang attribute. */
        document.documentElement.setAttribute('lang', currentLang === 'en' ? 'en' : currentLang);
      }
    } finally { applying = false; }
    observe();
    return currentLang;
  }

  /** Reporting aid: how much of the current page a language actually covers. */
  function coverage(lang) {
    var table = dict(lang);
    var total = 0;
    var done = 0;
    if (!document.body) return { total: 0, translated: 0, percent: 0 };
    var walker = document.createTreeWalker(document.body, 4, {
      acceptNode: function (n) {
        return /[A-Za-z]{2}/.test(n.nodeValue) && !inSkippedTree(n)
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var node;
    while ((node = walker.nextNode())) {
      var english = originalText.get(node);
      if (english === undefined) english = node.nodeValue;
      var body = split(english).body.trim();
      if (!body) continue;
      total += 1;
      if (table && lookup(body, indexed(table)) != null) done += 1;
    }
    return {
      total: total,
      translated: done,
      percent: total ? Math.round((done / total) * 100) : 0
    };
  }

  var PDI18n = {
    apply: apply,
    observe: observe,
    coverage: coverage,
    translatePhrase: function (text, lang) { return translatePhrase(text, lang); },
    current: function () { return currentLang; }
  };

  global.PDI18n = PDI18n;

  /* Follow the language the shared app layer broadcasts. */
  if (global.document) {
    document.addEventListener('pd:lang', function (e) {
      var code = (e && e.detail && e.detail.code) || 'en';
      if (code !== currentLang || code !== 'en') apply(code);
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDI18n;
  }
})(typeof window !== 'undefined' ? window : globalThis);
