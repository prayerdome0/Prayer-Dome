/*
 * Prayer Dome — whole-app translation engine
 * ===========================================================================
 * The original i18n layer only translated elements that carried an explicit
 * `data-pd-t` key, which meant a handful of nav labels changed language and
 * the other ~1,900 phrases in the app stayed in English. This module
 * translates the *entire* rendered page instead, in two tiers:
 *
 *   TIER 1 — the reviewed phrase pack (assets/pd-phrases.js). A plain
 *   English-keyed dictionary that pages need no markup changes to use.
 *   Entries here have been curated by Prayer Dome (community drafts, exactly
 *   like the Scripture pack), so they are authoritative and unbadged.
 *
 *   TIER 2 — live machine translation for everything else. Whatever text the
 *   pack does not cover yet — long articles, dynamic sermons, admin tables —
 *   is auto-translated in the reader's browser through the site's own
 *   /api/translate relay (see functions/translate.js), so the *whole page*
 *   reads in the chosen language. Auto output is visually badged with a small
 *   "auto" chip, is cached on the device for speed and offline repeat reads,
 *   and can never override a Tier-1 pack entry. To swap in an official
 *   engine later, implement PDI18n.setTranslator() or point
 *   setServiceUrl() at your endpoint.
 *
 * Mechanics (both tiers):
 *
 *   1. It walks every text node and every human-readable attribute
 *      (placeholder, title, aria-label, alt, and button values).
 *   2. It remembers the original English in a WeakMap, so switching back to
 *      English — or to a language that lacks a given phrase — restores the
 *      exact source text rather than leaving a stale translation behind.
 *   3. A MutationObserver re-translates anything rendered later by the app
 *      (prayer cards, chat messages, admin tables, dialogs) and hands the
 *      new English text to the same auto-translation tier.
 *
 * Anything not in the dictionary AND not machine-translatable (offline, an
 * opt-out subtree, or a proper noun the engine returned unchanged) is left
 * in English on purpose: a wrong translation is worse than an untranslated
 * string, and the ministry's own review workflow (see translation-data.js)
 * is the way entries get promoted out of the "auto" tier.
 *
 * Public API — window.PDI18n
 *   .apply(langCode)       translate the whole document into a language
 *   .translatePhrase(s)    translate one string (for JS-built text)
 *   .observe()             start watching for dynamically added content
 *   .coverage(lang)        { total, translated, percent } for the current page
 *   .setTranslator(fn)     override the machine translator (tests, official API)
 *   .setServiceUrl(url)    where the auto tier posts batches ('/api/translate')
 *   .autoReady()           Promise resolving when queued auto work is finished
 *   .pendingAuto()         number of phrases still queued for auto translation
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

  /* ================================================================
   * Tier 2 — live machine translation ("translate everything").
   * Text the reviewed pack does not cover is sent to the site's own
   * /api/translate relay in batches and applied when it comes back,
   * badged with a small "auto" chip. All state here is reset whenever
   * PDI18n.apply() runs, so switching languages (or back to English)
   * always restores the exact source text first.
   * ================================================================ */
  var AUTO_CACHE_KEY = 'pd-auto-cache-v1';
  var AUTO_FAIL_MS = 10 * 60 * 1000;   // retry a failed phrase after 10 min
  var AUTO_CACHE_MAX = 2000;           // phrases kept on the device
  var AUTO_BATCH = 16;                 // texts per relay request
  var AUTO_BATCH_CHARS = 16000;        // total characters per request
  var AUTO_MAX_LEN = 5000;             // longest single text we will send

  /* Elements whose text is a picker/identity list (language names, endonyms)
     rather than content — the auto tier leaves them alone. The dictionary
     tier may still translate them when it has an entry. */
  var AUTO_SKIP_TAGS = { SELECT: 1, OPTION: 1, OPTGROUP: 1 };

  var autoGen = 0;            // bumped on every reset; stale replies ignored
  var autoScanTimer = null;
  var autoItems = [];         // queued { english, lead, tail, body, nodes, attrs }
  var autoPending = {};       // body -> true while a request is in flight
  var autoFailed = {};        // body -> timestamp when a request failed
  var autoMap = new Map();    // text node -> { english, last }
  var autoAttrMap = new Map(); // element -> { attr: english }
  var autoChips = [];         // chip elements injected for the badge
  var autoPumping = false;
  var autoActive = 0;         // requests in flight (for autoReady)
  var autoIdle = [];          // resolvers waiting for the queue to drain
  var translator = null;      // async fn(texts[], lang) -> Promise<string[]|null>
  var serviceUrl = '/api/translate';
  var memoryCache = new Map(); // lang\u001Fbody -> translation
  var cacheLoaded = false;
  var autoWarned = false;

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
    /* Our own auto-translation badge chip is UI chrome, never content. */
    if (el.classList && el.classList.contains('pd-auto-chip')) return true;
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

  /* -------------------------------------------------------- auto tier -----
   * Everything below this line implements Tier 2: text the reviewed pack
   * does not contain is translated in the reader's browser, badged "auto".
   * ---------------------------------------------------------------------- */

  function dictHas(english, lang) {
    var table = dict(lang || currentLang);
    if (!table) return false;
    indexed(table);
    return lookup(english, table) != null;
  }

  function autoSkip(el) {
    if (!el) return true;
    if (shouldSkip(el)) return true;
    if (AUTO_SKIP_TAGS[el.tagName]) return true;
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return true;
    /* data-pd-no-auto opts a subtree out of *machine* translation only —
       the reviewed dictionary tier still applies. Used for curated
       Scripture blocks whose provenance the ministry manages separately. */
    if (el.hasAttribute && el.hasAttribute('data-pd-no-auto')) return true;
    return false;
  }

  function inAutoSkippedTree(node) {
    for (var el = node.parentElement; el; el = el.parentElement) {
      if (autoSkip(el)) return true;
    }
    return false;
  }

  /* -------------------------------- device cache ------------------------- */
  var persistTimer = null;

  function loadCache() {
    if (cacheLoaded) return;
    cacheLoaded = true;
    try {
      var raw = global.localStorage.getItem(AUTO_CACHE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(function (k) { memoryCache.set(k, data[k]); });
      }
    } catch (e) { /* corrupt or unavailable storage — memory cache only */ }
  }

  function readCache(lang, body) {
    loadCache();
    var v = memoryCache.get(lang + '\u001F' + body);
    return v === undefined ? undefined : v; // string, or null for a known no-op
  }

  function persistCache() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      persistTimer = null;
      if (!memoryCache.size) return;
      try {
        var obj = {};
        memoryCache.forEach(function (val, k) { obj[k] = val; });
        global.localStorage.setItem(AUTO_CACHE_KEY, JSON.stringify(obj));
      } catch (e) { /* quota — the memory cache still serves this session */ }
    }, 700);
  }

  function writeCache(lang, body, value) {
    loadCache();
    memoryCache.set(lang + '\u001F' + body, value == null ? null : value);
    while (memoryCache.size > AUTO_CACHE_MAX) {
      var first = memoryCache.keys().next().value;
      if (first === undefined) break;
      memoryCache.delete(first);
    }
    persistCache();
  }

  /* -------------------------------------------- badge chips ("auto" pill) */
  function ensureAutoCSS() {
    try {
      if (!global.document.getElementById('pd-auto-css')) {
        var st = global.document.createElement('style');
        st.id = 'pd-auto-css';
        st.textContent =
          '.pd-auto-chip{display:inline-block;vertical-align:middle;margin:0 7px 0 0;padding:2px 7px;' +
          'border-radius:999px;border:1px dashed rgba(100,116,139,.55);background:rgba(100,116,139,.12);' +
          'font:700 8px/1.5 "Montserrat",system-ui,sans-serif;letter-spacing:1.2px;text-transform:uppercase;' +
          'color:inherit;opacity:.8;cursor:help;user-select:none}' +
          'body.dark-mode .pd-auto-chip{background:rgba(148,163,184,.16);border-color:rgba(148,163,184,.4)}';
        (global.document.head || global.document.documentElement).appendChild(st);
      }
    } catch (e) { /* styling is cosmetic — never block translation on it */ }
  }

  function addChip(host) {
    if (!host || host._pdAutoChipped) return;
    host._pdAutoChipped = true;
    ensureAutoCSS();
    try {
      var chip = global.document.createElement('span');
      chip.className = 'pd-auto-chip';
      chip.textContent = 'auto';
      chip.setAttribute('title',
        'Auto-translated by Google Translate — machine output that Prayer Dome reviewers have not checked yet. ' +
        'Prayer Dome\u2019s own reviewed translations always take precedence.');
      host.insertBefore(chip, host.firstChild);
      autoChips.push(chip);
    } catch (e) { /* never break translation on badge insertion */ }
  }

  function chipHostFor(node) {
    var el = node.parentElement;
    while (el && el !== global.document.body) {
      var t = el.tagName;
      if (/^(P|LI|BLOCKQUOTE|TD|TH|FIGCAPTION|CAPTION|DD|DT|LABEL|SUMMARY|H[1-6])$/.test(t)) return el;
      /* A DIV that holds only text is a self-contained reading block. */
      if (t === 'DIV' && !el.children.length) return el;
      el = el.parentElement;
    }
    return null;
  }

  /* ------------------------------------------ restore / reset on re-apply */
  function resetAuto() {
    autoGen += 1;
    if (autoScanTimer) { clearTimeout(autoScanTimer); autoScanTimer = null; }
    autoItems = [];
    autoPending = {};
    autoFailed = {};
    autoMap.forEach(function (info, node) {
      if (node && node.nodeType === 3 && info && node.nodeValue !== info.english) {
        node.nodeValue = info.english;
      }
    });
    autoMap.clear();
    autoAttrMap.forEach(function (vals, el) {
      if (!el || !el.getAttribute) return;
      Object.keys(vals).forEach(function (attr) {
        var info = vals[attr];
        if (!info) return;
        var english = info.english;
        var cur = el.getAttribute(attr);
        if (english && cur !== english && cur === info.last) el.setAttribute(attr, english);
      });
    });
    autoAttrMap.clear();
    autoChips.forEach(function (chip) {
      try {
        var host = chip.parentNode;
        if (host) host._pdAutoChipped = false;
        if (chip.parentNode) chip.parentNode.removeChild(chip);
      } catch (e) { /* already detached */ }
    });
    autoChips = [];
    settleAuto();
  }

  /* --------------------------------------------------------- scan & apply */
  function scanAuto() {
    if (currentLang === 'en' || !translator || !global.document || !global.document.body) return;
    var items = new Map();

    function offer(english, kind, node, el, attr) {
      if (!english) return;
      var lead = (english.match(/^\s*/) || [''])[0];
      var rest = english.slice(lead.length);
      var tail = (rest.match(/\s*$/) || [''])[0];
      var body = rest.slice(0, rest.length - tail.length);
      if (!body) return;
      if (body.length > AUTO_MAX_LEN) return;
      /* Check the pack on the same normalised form the dictionary tier uses
         (emoji lead, trailing colons stripped) so Tier-1 phrases are never
         re-sent to the machine tier. */
      var core = split(english).body.trim();
      if (!core || dictHas(core, currentLang)) return;
      if (!/[a-z]/.test(body)) return;                 // all-caps = acronyms
      if (/[{}<>]/.test(body)) return;                 // looks like code/templates
      if (body.indexOf('//') !== -1) return;           // urls
      if (/^\S+@\S+$/.test(body)) return;              // emails
      if (/^\S+\.\S+$/.test(body)) return;             // single-token domain-ish
      if (/^[A-Z][A-Za-z]*$/.test(body)) return;       // capitalised single word

      var item = items.get(body);
      if (!item) {
        item = { body: body, nodes: [], attrs: [] };
        items.set(body, item);
      }
      if (kind === 'attr') item.attrs.push({ el: el, attr: attr, english: english, lead: lead, tail: tail });
      else item.nodes.push({ node: node, english: english, lead: lead, tail: tail });
    }

    var doc = global.document;
    var walker = doc.createTreeWalker(doc.body, 1 | 4, {
      acceptNode: function (n) {
        if (n.nodeType === 1) {
          return autoSkip(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
        return /[A-Za-z]{2}/.test(n.nodeValue)
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 1) {
        if (autoAttrMap.has(n)) continue;
        var saved = originalAttrs.get(n);
        TEXT_ATTRS.forEach(function (attr) {
          var v = n.getAttribute && n.getAttribute(attr);
          if (!v || !/[A-Za-z]{2}/.test(v)) return;
          /* The dictionary tier owns this attribute the moment its value no
             longer equals the English source. Offer only untouched ones. */
          var englishVal = (saved && saved[attr]) || v;
          if (n.getAttribute(attr) !== englishVal) return;
          if (autoMap.has(n) || autoAttrMap.has(n)) return;
          offer(englishVal, 'attr', null, n, attr);
        });
        if (n.tagName === 'INPUT') {
          var type = (n.getAttribute('type') || '').toLowerCase();
          if (type === 'button' || type === 'submit' || type === 'reset') {
            var val = n.getAttribute('value');
            if (val && /[A-Za-z]{2}/.test(val)) {
              var englishVal2 = (saved && saved.value) || val;
              if (n.getAttribute('value') === englishVal2) {
                offer(englishVal2, 'attr', null, n, 'value');
              }
            }
          }
        }
        continue;
      }
      if (inAutoSkippedTree(n)) continue;
      if (autoMap.has(n)) continue;               // already auto-translated
      if (originalText.get(n) === undefined && !/[A-Za-z]{2}/.test(n.nodeValue)) continue;
      /* Prefer the stored English so a re-scan never poisons the source. */
      offer(originalText.get(n) !== undefined ? originalText.get(n) : n.nodeValue,
            'text', n, null, null);
    }

    items.forEach(function (item) {
      if (!item.nodes.length && !item.attrs.length) return;
      var cached = readCache(currentLang, item.body);
      if (cached === null) return;                       // known no-op
      if (cached !== undefined) { applyAutoItem(item, cached); return; }
      if (autoPending[item.body]) return;
      var failedAt = autoFailed[item.body];
      if (failedAt) {
        if (Date.now() - failedAt < AUTO_FAIL_MS) return;   // back off briefly
        delete autoFailed[item.body];
      }
      autoPending[item.body] = true;
      autoItems.push(item);
    });
    if (autoItems.length) pumpAuto();
    else settleAuto();
  }

  function scheduleAutoScan() {
    if (currentLang === 'en' || !translator) return;
    if (autoScanTimer) clearTimeout(autoScanTimer);
    autoScanTimer = setTimeout(function () {
      autoScanTimer = null;
      try { scanAuto(); } catch (e) {
        /* A scan failure must never break the page — and must never leave
           an autoReady() waiter hanging. */
        try { console.warn('Prayer Dome auto-translation scan failed', e); } catch (e2) { /* noop */ }
        settleAuto();
      }
    }, 80);
  }

  function applyAutoItem(item, result) {
    if (!result || !item) return;
    var translated = String(result);
    var appliedAny = false;
    (item.nodes || []).forEach(function (entry) {
      var node = entry.node;
      if (!node || node.nodeType !== 3) return;
      /* Only write back when the app has not changed the node meanwhile. */
      if (node.nodeValue !== entry.english) return;
      var full = entry.lead + translated + entry.tail;
      node.nodeValue = full;
      autoMap.set(node, { english: entry.english, last: full });
      if (full !== entry.english) appliedAny = true;
    });
    (item.attrs || []).forEach(function (entry) {
      var el = entry.el;
      if (!el || !el.getAttribute || el.getAttribute(entry.attr) !== entry.english) return;
      var full = entry.lead + translated + entry.tail;
      el.setAttribute(entry.attr, full);
      if (!autoAttrMap.has(el)) autoAttrMap.set(el, {});
      autoAttrMap.get(el)[entry.attr] = { english: entry.english, last: full };
      appliedAny = true;
    });
    /* One badge per reading block, regardless of how many nodes in it. */
    if (appliedAny) {
      (item.nodes || []).forEach(function (entry) {
        var host = chipHostFor(entry.node);
        if (host) addChip(host);
      });
    }
  }

  function pumpAuto() {
    if (autoPumping) return;
    if (currentLang === 'en' || !translator) return;
    if (!autoItems.length) { settleAuto(); return; }
    autoPumping = true;
    var gen = autoGen;

    function next() {
      if (gen !== autoGen || currentLang === 'en' || !translator) {
        autoPumping = false;
        settleAuto();
        return;
      }
      if (!autoItems.length) {
        autoPumping = false;
        settleAuto();
        return;
      }
      var batch = [];
      var budget = AUTO_BATCH_CHARS;
      while (autoItems.length && batch.length < AUTO_BATCH) {
        if (autoItems[0].body.length > budget) break;
        budget -= autoItems[0].body.length;
        batch.push(autoItems.shift());
      }
      if (!batch.length) {
        /* A single item over budget can never send — drop it rather than
           spin (unreachable while AUTO_MAX_LEN <= AUTO_BATCH_CHARS). */
        delete autoPending[autoItems[0].body];
        autoItems.shift();
        next();
        return;
      }
      var bodies = batch.map(function (i) { return i.body; });
      autoActive += 1;
      Promise.resolve().then(function () {
        return translator(bodies, currentLang);
      }).then(function (results) {
        if (gen !== autoGen) return;
        if (results && results.length) {
          results.forEach(function (r, idx) {
            var item = batch[idx];
            if (!item) return;
            delete autoPending[item.body];
            if (r == null || !String(r).trim()) {
              autoFailed[item.body] = Date.now();
              return;
            }
            var clean = String(r).trim();
            if (clean.toLowerCase() === item.body.toLowerCase()) {
              /* Google left it unchanged (usually a proper noun) — remember
                 the no-op so we never ask about it again this device. */
              writeCache(currentLang, item.body, null);
              return;
            }
            writeCache(currentLang, item.body, clean);
            applyAutoItem(item, clean);
          });
        } else {
          batch.forEach(function (item) {
            delete autoPending[item.body];
            autoFailed[item.body] = Date.now();
          });
        }
      }, function () {
        if (gen !== autoGen) return;
        batch.forEach(function (item) {
          delete autoPending[item.body];
          autoFailed[item.body] = Date.now();
        });
        if (!autoWarned) {
          autoWarned = true;
          try {
            console.warn('Prayer Dome: auto-translation service unavailable. ' +
              'Text the reviewed pack does not cover yet is shown in English.');
          } catch (e) { /* ignore */ }
        }
      }).then(function () {
        autoActive -= 1;
        settleAuto();
        next();
      });
    }
    next();
  }

  function settleAuto() {
    if (autoActive > 0 || autoItems.length || autoScanTimer || autoPumping) return;
    if (!autoIdle.length) return;
    var list = autoIdle;
    autoIdle = [];
    list.forEach(function (resolve) { try { resolve(true); } catch (e) { /* noop */ } });
  }

  function autoReady() {
    return new Promise(function (resolve) {
      if (autoActive === 0 && !autoItems.length && !autoScanTimer && !autoPumping) {
        resolve(true);
      } else {
        autoIdle.push(resolve);
      }
    });
  }

  /* Default machine translator: batch POST to the site's own relay, which
     proxies Google Translate server-side (browsers cannot call Google's
     endpoint directly — no CORS headers). Only enabled where fetch exists. */
  function defaultTranslator(texts, lang) {
    return fetch(serviceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: lang, texts: texts })
    }).then(function (resp) {
      return resp.ok ? resp.json() : null;
    }).then(function (json) {
      return (json && Array.isArray(json.results)) ? json.results : null;
    });
  }

  /* -------------------------------------------------------------- observer */
  function observe() {
    if (observer || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(function (records) {
      if (applying || currentLang === 'en') return;
      applying = true;
      var external = false;
      try {
        records.forEach(function (rec) {
          if (rec.type === 'childList') {
            Array.prototype.forEach.call(rec.addedNodes, function (n) {
              if (!n) return;
              /* Our own badge chips are UI chrome, not new content. */
              if (n.nodeType === 1 && n.classList && n.classList.contains('pd-auto-chip')) return;
              walk(n, currentLang);
              external = true;
            });
          } else if (rec.type === 'attributes' && rec.target && rec.target.nodeType === 1) {
            if (observerAttr(rec.target, rec.attributeName, currentLang)) external = true;
          } else if (rec.type === 'characterData' && rec.target && rec.target.nodeType === 3) {
            if (observerText(rec.target, currentLang)) external = true;
          }
        });
      } finally { applying = false; }
      /* Only newly added/app-rewritten content needs the auto tier — our own
         writes are managed by the auto state and must not re-trigger scans. */
      if (external) scheduleAutoScan();
    });

    /* A text node changed. Returns true when the app actually rewrote it
       (so the new value becomes English source for dictionary + auto tiers).
       If WE own it (auto tier) and it still holds our translation, this is
       our own write — false, no re-scan. */
    function observerText(node, lang) {
      var info = autoMap.get(node);
      if (info) {
        if (node.nodeValue === info.last || node.nodeValue === info.english) return false;
        autoMap.delete(node);
      }
      var english = originalText.get(node);
      if (english === undefined) {
        applyToTextNode(node, lang);
        return /[A-Za-z]{2}/.test(node.nodeValue);
      }
      var expected = lang === 'en' ? english : translatePhrase(english, lang);
      if (node.nodeValue === expected) return false; // already in the right state
      originalText.delete(node);                  // app changed it: re-baseline
      applyToTextNode(node, lang);
      return true;
    }

    /* An attribute we translate changed. Auto-owned attributes are restored
       on reset, so here we only need to protect them from being treated as
       brand-new English and to re-baseline genuine app rewrites. Returns
       true when the app rewrote something worth re-scanning. */
    function observerAttr(el, attr, lang) {
      if (!attr || el.getAttribute(attr) === null) return false;
      var owned = autoAttrMap.get(el);
      if (owned && owned[attr] !== undefined) {
        var info = owned[attr];
        var curOwned = el.getAttribute(attr);
        /* Still our auto translation (or restored English during reset):
           the observer must not treat it as new source text. */
        if (curOwned === info.last || curOwned === info.english) return false;
        /* The app rewrote the attribute: release ownership below. */
        delete owned[attr];
        if (!Object.keys(owned).length) autoAttrMap.delete(el);
      }
      var saved = originalAttrs.get(el);
      var english = saved ? saved[attr] : undefined;
      var cur = el.getAttribute(attr);
      if (english === undefined) {
        /* Unknown to the dictionary tier: baseline it now and translate it
           if the pack has an entry. */
        if (!/[A-Za-z]{2}/.test(cur)) return false;
        if (!saved) { saved = {}; originalAttrs.set(el, saved); }
        saved[attr] = cur;
        var n1 = lang === 'en' ? cur : translatePhrase(cur, lang);
        if (cur !== n1) el.setAttribute(attr, n1);
        return true;
      }
      var expected = lang === 'en' ? english : translatePhrase(english, lang);
      if (cur === expected) return false;         // already in the right state
      saved[attr] = cur;                          // app changed it: new source
      var next = lang === 'en' ? cur : translatePhrase(cur, lang);
      if (cur !== next) el.setAttribute(attr, next);
      return true;
    }
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
    /* Restore every auto-translated node to English and drop the "auto"
       badges first, so switching languages never mixes two targets and
       switching back to English is byte-exact. */
    resetAuto();
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
    if (currentLang !== 'en') scheduleAutoScan();
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

  /* Enable the auto tier where the browser can reach the relay. Tests and
     offline shells disable it by simply never calling setTranslator(). */
  if (typeof fetch === 'function') translator = defaultTranslator;

  var PDI18n = {
    apply: apply,
    observe: observe,
    coverage: coverage,
    translatePhrase: function (text, lang) { return translatePhrase(text, lang); },
    current: function () { return currentLang; },
    /* Tier-2 configuration & diagnostics. */
    setTranslator: function (fn) { translator = fn || null; },
    setServiceUrl: function (url) { serviceUrl = url || '/api/translate'; },
    autoReady: autoReady,
    pendingAuto: function () {
      return autoItems.length + Object.keys(autoPending).length;
    }
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
