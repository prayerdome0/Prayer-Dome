/* ==========================================================================
   Prayer Dome — Premium App Layer (pd-app.js)
   --------------------------------------------------------------------------
   Shared functionality for every page: language selector, live location,
   moving announcements, notification center, scheduled hero banners,
   community statistics, live-stream bridge, news center, splash screen,
   drawer navigation and gospel radio.

   Plain global script. Load AFTER assets/pd-content-data.js and
   assets/pd-motion.js. Every module scans for its own targets and no-ops
   gracefully when the page does not include them.

   Pages that use Firestore register it once:
     PDApp.setFirestore({ db, doc, getDoc, setDoc, addDoc, collection,
                          query, orderBy, limit, getDocs, onSnapshot,
                          serverTimestamp, Timestamp });
   Everything else works fully offline with localStorage + BroadcastChannel.
   ========================================================================== */

(function () {
  'use strict';

  var VERSION = '1.0.1';
  var BRAND_LOGO = '/assets/logo.png'; // official Prayer Dome mark
  var channel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('pd-app') : null;
  var fb = null;            // Firestore bindings, set via setFirestore()
  var listeners = [];

  /* ---------------------------------------------------------------- utils */
  function lsGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* full */ }
  }
  function esc(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function toast(message, type) {
    var container = $('#toastContainer') || $('#pdToast');
    if (!container) {
      container = document.createElement('div');
      container.id = 'pdToast';
      container.className = 'pd-toast-container';
      document.body.appendChild(container);
    }
    var t = document.createElement('div');
    t.className = 'pd-toast' + (type === 'error' ? ' pd-toast-error' : '');
    t.innerHTML = '<i class="fas ' + (type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle') + '"></i> ' + esc(message);
    container.appendChild(t);
    setTimeout(function () { t.classList.add('pd-toast-out'); setTimeout(function () { t.remove(); }, 400); }, 3400);
  }
  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }
  function broadcast(type, payload) {
    if (channel) { try { channel.postMessage({ type: type, payload: payload || {} }); } catch (e) {} }
    if (fb && fb.db) {
      var evt = new CustomEvent('pd:' + type, { detail: payload || {} });
      document.dispatchEvent(evt);
    }
  }
  function on(type, fn) { listeners.push([type, fn]); document.addEventListener('pd:' + type, fn); }
  if (channel) {
    channel.onmessage = function (ev) {
      var msg = ev.data || {};
      var evt = new CustomEvent('pd:' + msg.type, { detail: msg.payload || {} });
      document.dispatchEvent(evt);
    };
  }

  /* --------------------------------------------------------- academy nav */
  var academyNav = {
    links: [
      { href: '/lessons.html', icon: 'fa-graduation-cap', label: 'Teaching', match: 'lessons' },
      { href: '/stories.html', icon: 'fa-book-open-reader', label: 'Stories', match: 'stories' },
      { href: '/quiz.html', icon: 'fa-star', label: 'Quizzes', match: 'quiz' },
      { href: '/resources.html', icon: 'fa-folder-open', label: 'Resources', match: 'resources' }
    ],
    init: function () {
      var nav = $('#pdDrawer .pd-drawer-nav');
      if (!nav || nav.dataset.academyNav === 'ready') return;
      var drawerHtml = nav.innerHTML;
      if (drawerHtml.indexOf('/lessons.html') === -1) {
        var prayerLink = $('a[href="/bible.html"], a[href="/sermons.html"]', nav);
        var html = academyNav.links.map(function (l) {
          return '<a class="pd-drawer-link" href="' + l.href + '"><i class="fas ' + l.icon + '"></i> ' + esc(l.label) + '</a>';
        }).join('');
        if (prayerLink) prayerLink.insertAdjacentHTML('afterend', html);
        else nav.insertAdjacentHTML('beforeend', html);
      }
      nav.dataset.academyNav = 'ready';
    }
  };

  /* ------------------------------------------------------------ Firestore */
  function setFirestore(bindings) {
    if (bindings && bindings.db) fb = bindings;
  }
  function fsGet(docRef, fallback) {
    if (!fb || !fb.getDoc) return Promise.resolve(fallback);
    return fb.getDoc(docRef).then(function (snap) {
      return snap.exists() ? snap.data() : fallback;
    }).catch(function () { return fallback; });
  }
  function fsSet(docRef, data) {
    if (!fb || !fb.setDoc) return Promise.resolve(false);
    return fb.setDoc(docRef, data, { merge: true }).then(function () { return true; }).catch(function () { return false; });
  }
  function fsAdd(collectionRef, data) {
    if (!fb || !fb.addDoc) return Promise.resolve(null);
    return fb.addDoc(collectionRef, data).then(function (r) { return r.id; }).catch(function () { return null; });
  }
  function fsWatch(docRef, cb) {
    if (!fb || !fb.onSnapshot) return null;
    return fb.onSnapshot(docRef, function (snap) {
      cb(snap.exists() ? snap.data() : null);
    }, function () {});
  }

  /* ------------------------------------------------------------- storage */
  var store = {
    get: function (key, seedKey) {
      var val = lsGet('pd_' + key, null);
      if (val !== null) return val;
      var seed = (window.PD_CONTENT || {})[seedKey || 'DEFAULT_' + key.toUpperCase()];
      return seed !== undefined ? seed : null;
    },
    set: function (key, value) {
      lsSet('pd_' + key, value);
      broadcast('store:' + key, value);
      return value;
    },
    patch: function (key, patch) {
      var cur = store.get(key) || {};
      if (typeof cur === 'object' && !Array.isArray(cur)) {
        var next = Object.assign({}, cur, patch);
        store.set(key, next);
        return next;
      }
      store.set(key, patch);
      return patch;
    }
  };

  /* ----------------------------------------------------------- theme ui --- */
  /* ------------------------------------------------------------- branding
   * Prayer Dome ships its own artwork. Nothing in the app may fall back to a
   * third-party placeholder service, a stock-photo host or a stand-in logo.
   * DEFAULT_AVATAR is the branded member silhouette; BRAND_LOGO is the one
   * official mark used for icons, splash screens and every fallback.
   * ---------------------------------------------------------------------- */
  var DEFAULT_AVATAR = '/assets/avatar-default.svg';
  var PLACEHOLDER_HOSTS = /(^|\/\/)(www\.)?(via\.placeholder\.com|placehold\.it|placehold\.co|placekitten\.com|dummyimage\.com|loremflickr\.com)/i;

  /** Resolve any avatar URL to something Prayer Dome actually owns. */
  function avatarUrl(url) {
    if (!url || typeof url !== 'string') return DEFAULT_AVATAR;
    var clean = url.trim();
    if (!clean || PLACEHOLDER_HOSTS.test(clean)) return DEFAULT_AVATAR;
    return clean;
  }

  /**
   * Sweep the page for any image still pointing at a placeholder service —
   * including ones rendered later from stored member records — and swap in
   * the official Prayer Dome avatar. Runs once now, then watches for new
   * nodes so historical data never shows a grey stand-in again.
   */
  function enforceBranding(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var images = scope.querySelectorAll ? scope.querySelectorAll('img[src]') : [];
    for (var i = 0; i < images.length; i++) {
      var src = images[i].getAttribute('src') || '';
      if (PLACEHOLDER_HOSTS.test(src)) images[i].setAttribute('src', DEFAULT_AVATAR);
    }
  }

  function watchBranding() {
    enforceBranding(document);
    if (typeof MutationObserver === 'undefined') return;
    var pending = false;
    var observer = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; enforceBranding(document); });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  var ui = {
    init: function () {
      ui.drawer();
      ui.splash();
      ui.syncTheme();
      try { watchBranding(); } catch (e) { /* branding sweep is best-effort */ }
      // Auto-show the friendly "Allow notifications?" pop-up once per
      // device, ~6s after the app loads, so members get the OS push
      // experience they expect without hunting for a bell.
      setTimeout(function () {
        if (notifications.canPrompt && notifications.canPrompt() && !localStorage.getItem('pd_notif_pop_dismissed')) {
          notifications.showEnablePop();
        }
      }, 6000);
    },
    drawer: function () {
      var btn = $('#pdMenuBtn');
      var drawer = $('#pdDrawer');
      var overlay = $('#pdDrawerOverlay');
      if (!btn || !drawer) return;
      var toggle = function (open) {
        drawer.classList.toggle('open', open);
        if (overlay) overlay.classList.toggle('open', open);
        document.body.style.overflow = open ? 'hidden' : '';
      };
      btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(!drawer.classList.contains('open')); });
      if (overlay) overlay.addEventListener('click', function () { toggle(false); });
      $$('.pd-drawer-close', drawer).forEach(function (el) {
        el.addEventListener('click', function () { toggle(false); });
      });
      $$('a', drawer).forEach(function (a) {
        a.addEventListener('click', function () { toggle(false); });
      });
    },
    splash: function () {
      var splash = $('#pdSplash');
      if (!splash) return;
      if (sessionStorage.getItem('pd_splash_seen')) { splash.remove(); return; }
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) { sessionStorage.setItem('pd_splash_seen', '1'); splash.remove(); return; }
      splash.classList.add('pd-splash-show');
      var hide = function () {
        splash.classList.remove('pd-splash-show');
        splash.classList.add('pd-splash-hide');
        sessionStorage.setItem('pd_splash_seen', '1');
        setTimeout(function () { splash.remove(); }, 650);
      };
      var t = setTimeout(hide, 2600);
      splash.addEventListener('click', function () { clearTimeout(t); hide(); });
      // Keep the theme verse in sync with the chosen language.
      document.addEventListener('pd:lang', function () { scripture.render($('#pdSplash .pd-splash-verse')); });
    },
    syncTheme: function () {
      // Keep `dark-mode` mirrored onto <html> so fixed overlays match.
      var sync = function () {
        if (document.body.classList.contains('dark-mode')) document.documentElement.classList.add('dark-mode');
        else document.documentElement.classList.remove('dark-mode');
      };
      sync();
      if (window.MutationObserver) {
        new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
      }
    },
    toggleNotifPanel: function (forceOpen) {
      var panel = notifications.panelEl;
      if (!panel) return;
      var open = typeof forceOpen === 'boolean' ? forceOpen : !panel.classList.contains('open');
      panel.classList.toggle('open', open);
      if (open) notifications.syncBadge();
    },
    /* Branded member photo — falls back to the Prayer Dome avatar, never to a
       third-party placeholder image. */
    avatar: avatarUrl,
    defaultAvatar: DEFAULT_AVATAR,
    brandLogo: BRAND_LOGO
  };

  /* --------------------------------------------------------- translations */
  var lang = localStorage.getItem('pd_lang') || 'en';
  var i18n = {
    current: function () { return lang; },
    set: function (code) {
      lang = code;
      try { localStorage.setItem('pd_lang', code); } catch (e) {}
      $$('[data-pd-t]').forEach(function (el) {
        var key = el.getAttribute('data-pd-t');
        var txt = i18n.t(key);
        if (txt && txt !== key) el.innerHTML = txt;
      });
      var sel = $('.pd-lang-select');
      if (sel) sel.value = code;
      broadcast('lang', { code: code });
    },
    t: function (key) {
      if (window.pdT) {
        try {
          var v = window.pdT(key, lang);
          // pdT returns the key itself when unknown — only accept real hits.
          if (v && v !== key) return v;
        } catch (e) {}
      }
            var table = {
        'nav.home': { en: 'Home', tum: 'Kunyumba', ssw: 'Ekhaya', bem: 'Paŵulu', nya: 'Kunyumba' },
        'nav.bible': { en: 'Bible', tum: 'Baibolo', ssw: 'LiBhayibheli', bem: 'Baibolo', nya: 'Baibulo' },
        'nav.pray': { en: 'Pray', tum: 'Lomba', ssw: 'Thandaza', bem: 'Lomba', nya: 'Pempherani' },
        'nav.sermons': { en: 'Sermons', tum: 'Maupharazgi', ssw: 'Tintshumayelo', bem: 'Icilengo', nya: 'Ulaliki' },
        'nav.assistant': { en: 'Assistant', tum: 'Wovwiri', ssw: 'Umsiti', bem: 'Umwafwilisha', nya: 'Wothandiza' },
        'nav.chat': { en: 'Chat', tum: 'Kudumbiskana', ssw: 'Ingcoco', bem: 'Ukulanshana', nya: 'Kukambirana' },
        'nav.account': { en: 'Account', tum: 'Akaunti', ssw: 'I-akhawunti', bem: 'Akaunti', nya: 'Akaunti' },
        'nav.teaching': { en: 'Teaching', tum: 'Masambiro', ssw: 'Kufundzisa', bem: 'Amasambilo', nya: 'Kuphunzitsa' },
        'nav.stories': { en: 'Stories', tum: 'Nkhani', ssw: 'Tindzaba', bem: 'Ifyano', nya: 'Nkhani' },
        'nav.resources': { en: 'Resources', tum: 'Vya Kukhwaska', ssw: 'Tinsita', bem: 'Ifyakubomfya', nya: 'Zothandizira' },
        'nav.quizzes': { en: 'Quizzes', tum: 'Mafumbo', ssw: 'Imibuto', bem: 'Amepusho', nya: 'Mafunso' },
        'nav.live': { en: 'Live', tum: 'Moyo', ssw: 'Bukhoma', bem: 'Ubumi', nya: 'Moyo' },
        'nav.give': { en: 'Give', tum: 'Pereka', ssw: 'Nikela', bem: 'Pela', nya: 'Perekani' },
        'nav.events': { en: 'Events', tum: 'Viphikiro', ssw: 'Imicimbi', bem: 'Ifilonganino', nya: 'Zochitika' },
        'nav.gallery': { en: 'Gallery', tum: 'Vithuzi', ssw: 'Tithombe', bem: 'Ifikope', nya: 'Zithunzi' },
        'nav.media': { en: 'Media', tum: 'Vyakuwona', ssw: 'Imidiya', bem: 'Imediya', nya: 'Media' },
        'nav.news': { en: 'News', tum: 'Nkhani', ssw: 'Tindzaba', bem: 'Ifyashi', nya: 'Nkhani' },
        'nav.testimony': { en: 'Testimony', tum: 'Ukwititira', ssw: 'Bufakazi', bem: 'Ubwitness', nya: 'Umboni' },
        'nav.support': { en: 'Support', tum: 'Wovwiri', ssw: 'Sekela', bem: 'Wafwilisha', nya: 'Thandizo' },
        'nav.about': { en: 'About', tum: 'Za ise', ssw: 'Ngatsi', bem: 'Palwa ifwe', nya: 'Za ife' },
        'nav.contact': { en: 'Contact', tum: 'Dumbiranani', ssw: 'Xhumana', bem: 'Tumeni', nya: 'Lumikizanani' },
        'nav.team': { en: 'Team', tum: 'Gulu', ssw: 'Licembu', bem: 'Ikipani', nya: 'Gulu' },
        'app.tagline': {
          en: 'A House of Prayer for All Nations', tum: 'Nyumba ya Malombo ya Mitundu Yose',
          ssw: 'Indlu Yemkhuleko Yato Tonkhe Tive', bem: 'Ing\'anda ya Kupempela ya Mitundu Yonse',
          nya: 'Nyumba ya Pemphero ya Mitundu Yonse'
        },
        'app.welcome': { en: 'Welcome to Prayer Dome', tum: 'Mwakwaniskika ku Prayer Dome', ssw: 'Wemukelekile ku-Prayer Dome', bem: 'Mwaiseni ku Prayer Dome', nya: 'Takulandirani ku Prayer Dome' },
        'verse.of.day': { en: 'Verse of the day', tum: 'Lemba la zuŵa', ssw: 'Livesi lelusuku', bem: 'Lembelo lya lelo', nya: 'Vesi la lero' },
        'action.listen': { en: 'Listen', tum: 'Pulika', ssw: 'Lalela', bem: 'Ufwikisha', nya: 'Mverani' },
        'action.stop': { en: 'Stop', tum: 'Leka', ssw: 'Yima', bem: 'Leka', nya: 'Lekani' },
        'action.copy': { en: 'Copy', tum: 'Kopa', ssw: 'Kopisha', bem: 'Kopa', nya: 'Koperani' },
        'action.share': { en: 'Share', tum: 'Gaŵana', ssw: 'Yabelana', bem: 'Abelana', nya: 'Gawanani' },
        'action.save': { en: 'Save', tum: 'Sunga', ssw: 'Gcina', bem: 'Sunga', nya: 'Sungani' },
        'action.search': { en: 'Search', tum: 'Penja', ssw: 'Sesha', bem: 'Fwaya', nya: 'Fufuzani' },
        'action.pray': { en: 'Pray this', tum: 'Lombani ili', ssw: 'Thandaza loku', bem: 'Lombela ili', nya: 'Pempherani ili' },
        'action.read': { en: 'Read', tum: 'Ŵerengani', ssw: 'Fundza', bem: 'Belenga', nya: 'Werengani' },
        'action.download': { en: 'Download', tum: 'Kufumya', ssw: 'Landa', bem: 'Leta', nya: 'Tsitsani' },
        'action.watch': { en: 'Watch', tum: 'Wonani', ssw: 'Bukela', bem: 'Mona', nya: 'Onani' },
        'label.language': { en: 'Language', tum: 'Chiyowoyero', ssw: 'Lulwimi', bem: 'Ululimi', nya: 'Chilankhulo' },
        'label.scripture': { en: 'Scripture', tum: 'Lemba', ssw: 'UmBhalo', bem: 'Ilembelo', nya: 'Lemba' },
        'label.reference': { en: 'Reference', tum: 'Malemba', ssw: 'Inkhomba', bem: 'Ishimikila', nya: 'Mavesi' },
        'label.topic': { en: 'Topic', tum: 'Mutu', ssw: 'Sihloko', bem: 'Mutu', nya: 'Mutu' },
        'label.draft': { en: 'Community draft — awaiting review by a fluent speaker', tum: 'Ndemetero — likulindilira kuwunikika na munthu wakumanya chiyowoyero', ssw: 'Umculu wekucala — usalindzele kubukwa ngulokhulumako lulwimi', bem: 'Amalembo yasambililo — yalindilila ukubwekwa ku bantu bashimikila ululimi', nya: 'Zolembedwa zoyamba — zikudikirira kuwunikidwa ndi olankhula chinenerocho' },
        'label.all': { en: 'All', tum: 'Vyose', ssw: 'Konkhe', bem: 'Fyonse', nya: 'Zonse' },
        'label.lessons': { en: 'Lessons', tum: 'Masambiro', ssw: 'Tifundvo', bem: 'Amasambilo', nya: 'Maphunziro' },
        'label.stories': { en: 'Stories', tum: 'Nkhani', ssw: 'Tindzaba', bem: 'Ifyano', nya: 'Nkhani' },
        'label.resources': { en: 'Resources', tum: 'Vya Kukhwaska', ssw: 'Tinsita', bem: 'Ifyakubomfya', nya: 'Zothandizira' },
        'bible': { en: 'Bible', tum: 'Baibolo', ssw: 'LiBhayibheli', bem: 'Baibolo', nya: 'Baibulo' },
        'assistant': { en: 'Assistant', tum: 'Wovwiri', ssw: 'Umsiti', bem: 'Umwafwilisha', nya: 'Wothandiza' },
        'sermons': { en: 'Sermons', tum: 'Maupharazgi', ssw: 'Tintshumayelo', bem: 'Icilengo', nya: 'Ulaliki' },
        'teaching': { en: 'Teaching', tum: 'Masambiro', ssw: 'Kufundzisa', bem: 'Amasambilo', nya: 'Kuphunzitsa' },
        'stories': { en: 'Stories', tum: 'Nkhani', ssw: 'Tindzaba', bem: 'Ifyano', nya: 'Nkhani' },
        'resources': { en: 'Resources', tum: 'Vya Kukhwaska', ssw: 'Tinsita', bem: 'Ifyakubomfya', nya: 'Zothandizira' },
        'translate': { en: 'Translate', tum: 'Sungunula', ssw: 'Humusha', bem: 'Alula', nya: 'Tanthauzirani' },
        'gallery': { en: 'Gallery', tum: 'Vithuzi', ssw: 'Tithombe', bem: 'Ifikope', nya: 'Zithunzi' },
        'give': { en: 'Give', tum: 'Pereka', ssw: 'Nikela', bem: 'Pela', nya: 'Perekani' },
        'live': { en: 'Live', tum: 'Moyo', ssw: 'Bukhoma', bem: 'Ubumi', nya: 'Moyo' },
        'quiz': { en: 'Quiz', tum: 'Mafumbo', ssw: 'Imibuto', bem: 'Amepusho', nya: 'Mafunso' },
        'membership': { en: 'Membership', tum: 'Umbali', ssw: 'Bulunga', bem: 'Bumembala', nya: 'Umembala' },
        'support': { en: 'Support', tum: 'Wovwiri', ssw: 'Sekela', bem: 'Wafwilisha', nya: 'Thandizo' },
        'testimony': { en: 'Testimony', tum: 'Ukwititira', ssw: 'Bufakazi', bem: 'Ubwitness', nya: 'Umboni' },
        'events': { en: 'Events', tum: 'Viphikiro', ssw: 'Imicimbi', bem: 'Ifilonganino', nya: 'Zochitika' },
        'news': { en: 'News', tum: 'Nkhani', ssw: 'Tindzaba', bem: 'Ifyashi', nya: 'Nkhani' },
        'media': { en: 'Media', tum: 'Vyakuwona', ssw: 'Imidiya', bem: 'Imediya', nya: 'Media' },
        'about': { en: 'About', tum: 'Za ise', ssw: 'Ngatsi', bem: 'Palwa ifwe', nya: 'Za ife' },
        'contact': { en: 'Contact', tum: 'Dumbiranani', ssw: 'Xhumana', bem: 'Tumeni', nya: 'Lumikizanani' },
        'team': { en: 'Team', tum: 'Gulu', ssw: 'Licembu', bem: 'Ikipani', nya: 'Gulu' },
        'chat': { en: 'Chat', tum: 'Kudumbiskana', ssw: 'Ingcoco', bem: 'Ukulanshana', nya: 'Kukambirana' },
        'academy.title': { en: 'Prayer Dome Academy', tum: 'Sukulu ya Prayer Dome', ssw: 'Sikolo se-Prayer Dome', bem: 'Sukulu ya Prayer Dome', nya: 'Sukulu ya Prayer Dome' },
        'academy.lessons': { en: 'Lessons', tum: 'Masambiro', ssw: 'Tifundvo', bem: 'Amasambilo', nya: 'Maphunziro' },
        'academy.stories': { en: 'Stories', tum: 'Nkhani', ssw: 'Tindzaba', bem: 'Ifyano', nya: 'Nkhani' },
        'academy.quizzes': { en: 'Quizzes', tum: 'Mafumbo', ssw: 'Imibuto', bem: 'Amepusho', nya: 'Mafunso' },
        'academy.resources': { en: 'Resources', tum: 'Vya Kukhwaska', ssw: 'Tinsita', bem: 'Ifyakubomfya', nya: 'Zothandizira' },
        'academy.track.foundations': { en: 'Foundations', tum: 'Maziko', ssw: 'Tisekelo', bem: 'Imilando', nya: 'Maziko' },
        'academy.track.prayer': { en: 'Prayer & Intercession', tum: 'Malombo', ssw: 'Umkhuleko', bem: 'Ukupempela', nya: 'Pemphero' },
        'academy.track.word': { en: 'The Word of God', tum: 'Mazgu gha Chiuta', ssw: 'Livi laNkulunkulu', bem: 'Cebo ca Lesa', nya: 'Mawu a Mulungu' },
        'academy.track.spirit': { en: 'Holy Spirit & Gifts', tum: 'Mzimu Mutuŵa', ssw: 'Moya Longcwele', bem: 'Mupashi wa Mushilo', nya: 'Mzimu Woyera' },
        'academy.track.character': { en: 'Christlike Character', tum: 'Makhalo gha Khristu', ssw: 'Similo saKhristu', bem: 'Mikalile ya kwa Kristu', nya: 'Khalidwe la Khristu' },
        'academy.track.mission': { en: 'Mission & Service', tum: 'Uthenga', ssw: 'Lutshumo', bem: 'Mulimo wa Kutuma', nya: 'Utumiki' },
        'docs.title': { en: 'Document Library', tum: 'Mabuku gha Chisambizgo', ssw: 'Imibhalo Yekufundzisa', bem: 'Mabuku ya Kusambilisha', nya: 'Mabuku Ophunzitsa' },
        'docs.statement': { en: 'Statement of Faith', tum: 'Chipulikano Chithu', ssw: 'Kukholwa Kwethu', bem: 'Icitetekelo Cesu', nya: 'Chikhulupiriro Chathu' },
        'docs.guide.new': { en: 'New Believer’s Growth Guide', tum: 'Kalozgera ka Ŵakupulikana Basi', ssw: 'Umhlahlandlela waLabasha', bem: 'Kalozela ka Bakatetekela Bapya', nya: 'Kalozera wa Okhulupirira Atsopano' },
        'location.title': { en: 'You are worshipping from', tum: 'Mukung’ana kufuma ku', ssw: 'Ukhonta usuka e', bem: 'Mulepela ukufuma ku', nya: 'Mukupemphera kuchokera ku' },
        'location.detect': { en: 'Detecting your location…', tum: 'Kupenja malo ghinu…', ssw: 'Kuthola indzawo yakho…', bem: 'Ukufwaya apa muli…', nya: 'Kufufuza komwe muli…' },
        'announcements.title': { en: 'Announcements', tum: 'Vilapo', ssw: 'Tsimemezelo', bem: 'Amalumbwe', nya: 'Zolengeza' },
        'notifications.title': { en: 'Notifications', tum: 'Vimanyikwiso', ssw: 'Taziso', bem: 'Ifyo mukutiishiba', nya: 'Zidziwitso' },
        'notifications.empty': { en: 'No notifications yet', tum: 'Palibe vimanyikwiso', ssw: 'Kute azange kube netaziso', bem: 'Tapali ifyo mukutiishiba', nya: 'Palibe zidziwitso' },
        'scripture.featured': { en: 'Featured Scripture', tum: 'Lemba Likulutila', ssw: 'UmBhalo Lokhetsekile', bem: 'Ilembelo Lya Patali', nya: 'Lemba Lalikulu' },
        'stat.members': { en: 'Members', tum: 'Ŵabali', ssw: 'Emalunga', bem: 'Abalongo', nya: 'Mamembala' },
        'stat.prayers': { en: 'Prayer Requests', tum: 'Malombo', ssw: 'Ticelo', bem: 'Ukupepela', nya: 'Zopemphera' },
        'stat.testimonies': { en: 'Testimonies', tum: 'Ukwititira', ssw: 'Bufakazi', bem: 'Ubwitness', nya: 'Umboni' },
        'stat.countries': { en: 'Countries Reached', tum: 'Mayiko Ghakafika', ssw: 'Emave Latifikile', bem: 'Ifyalo Ifikilwa', nya: 'Mayiko Ofikiridwa' },
        'stat.live': { en: 'Live Viewers', tum: 'Ŵakuwona Pa Lubali', ssw: 'Babukela Baphilile', bem: 'Abalemona Pa Live', nya: 'Owonera Pa Live' },
        'stat.groups': { en: 'Prayer Groups', tum: 'Magulu gha Malombo', ssw: 'Emacembu Emkhuleko', bem: 'Amapinda ya Kupempela', nya: 'Magulu a Pemphero' },
        'challenge.title': { en: 'Weekly Prayer Challenge', tum: 'Nthowa ya Sabata ya Malombo', ssw: 'Inselele Yemkhuleko Yeviki', bem: 'Amayesho ya Kupempela ya Iciwela', nya: 'Vuto la Pemphero la Sabata' },
        'challenge.prayToday': { en: 'I prayed today', tum: 'Nalomba lelo', ssw: 'Ngithandazile lamuhla', bem: 'Nalomba lelo', nya: 'Ndaph pemphero lero' },
        'devotional.title': { en: 'Daily Devotional', tum: 'Mphambano ya Zuŵa', ssw: 'Kudla Kwalelanga', bem: 'Iciwelo ca Bushiku', nya: 'Mawu a Tsiku' },
        'prayer.wall': { en: 'Prayer Wall', tum: 'Khotolo la Malombo', ssw: 'Ludvonga Lwemkhuleko', bem: 'Cibumba ca Mapempelo', nya: 'Khoma la Pemphero' },
        'bible.center': { en: 'Bible Center', tum: 'Malo gha Baibolo', ssw: 'Sikhungo seLiBhayibheli', bem: 'Cipinda ca Baibolo', nya: 'Malo a Baibulo' },
        'sermon.center': { en: 'Sermon Center', tum: 'Malo gha Maupharazgi', ssw: 'Sikhungo Setintshumayelo', bem: 'Cipinda ca Milumbe', nya: 'Malo a Ulatiki' },
        'footer.rights': { en: 'All Rights Reserved', tum: 'Mazaza Ghose Ghapewa', ssw: 'Onkhe Amalungelo Agodliwe', bem: 'Insambu Shonse Shasungwa', nya: 'Ufulu Wonse Wosungidwa' },
        'footer.verse': { en: 'He does everything blamelessly. — Mark 7:37', tum: 'Wacita vinthu vyose makora. — Maliko 7:37', ssw: 'Wente konkhe kuhle. — Makho 7:37', bem: 'Atenda ifintu fyonse bwino. — Marko 7:37', nya: 'Iye wachita zonse bwino. — Maliko 7:37' }
      };
      var row = table[key];
      if (!row) return key;
      return row[lang] || row.en || key;
    },
    init: function () {
      var sel = $('.pd-lang-select');
      if (sel) {
        sel.value = lang;
        sel.addEventListener('change', function () { i18n.set(sel.value); });
      }
      // Honour the Admin Dashboard's Language Manager: hide disabled languages.
      i18n.applyEnabled();
      // Apply strings to any [data-pd-t] elements.
      $$('[data-pd-t]').forEach(function (el) {
        var txt = i18n.t(el.getAttribute('data-pd-t'));
        if (txt) el.innerHTML = txt;
      });
      document.dispatchEvent(new CustomEvent('pd:lang', { detail: { code: lang } }));
      on('store:languages', i18n.applyEnabled);
    },
    applyEnabled: function () {
      var sel = $('.pd-lang-select');
      if (!sel) return;
      var enabled = store.get('languages', 'DEFAULT_LANGUAGES') || ['en'];
      if (!enabled.length) enabled = ['en'];
      $$('option', sel).forEach(function (opt) {
        opt.style.display = enabled.indexOf(opt.value) >= 0 ? '' : 'none';
      });
      // If the current language was disabled, fall back to English.
      if (enabled.indexOf(lang) < 0) i18n.set('en');
    }
  };

  /* ------------------------------------------------------------------ geo */
  // Real IP-geolocation via free, keyless HTTPS APIs — ipwho.is (rich:
  // flag, region, timezone, local time, ISP) with ipapi.co as fallback.
  // Results are cached for 24h so repeat visits are instant and the free
  // quotas are never stressed.
  var GEO_CACHE_KEY = 'pd_ip_geo';
  var GEO_CACHE_TTL = 24 * 60 * 60 * 1000;
  var geo = {
    // Two-letter ISO country code -> flag emoji (regional indicators).
    flagEmoji: function (code) {
      if (!code || typeof code !== 'string') return '';
      return code.toUpperCase().replace(/./g, function (ch) {
        return String.fromCodePoint(127397 + ch.charCodeAt(0));
      });
    },
    formatLocalTime: function (tz, date) {
      try {
        return new Intl.DateTimeFormat([], {
          timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
        }).format(date || new Date());
      } catch (e) { return ''; }
    },
    // Accepts either the ipwho.is shape or the ipapi.co shape.
    normalize: function (raw, source) {
      if (!raw || raw.success === false) return null;
      var tz = raw.timezone;
      if (tz && typeof tz === 'object') tz = tz.id || null;
      if (!tz) return null;
      var flag = '';
      if (raw.flag && typeof raw.flag === 'object') flag = raw.flag.emoji || '';
      else if (raw.flag && typeof raw.flag === 'string') flag = raw.flag;
      var conn = raw.connection && typeof raw.connection === 'object'
        ? (raw.connection.isp || raw.connection.org || '') : (raw.isp || '');
      var info = {
        source: source,
        timezone: tz,
        city: raw.city || null,
        region: raw.region || raw.regionName || null,
        country: raw.country_name || raw.country || null,
        countryCode: raw.countryCode || raw.country_code || null,
        flag: flag || null,
        lat: raw.latitude != null ? Number(raw.latitude) : null,
        lon: raw.longitude != null ? Number(raw.longitude) : null,
        isp: conn || null,
        localTime: geo.formatLocalTime(tz)
      };
      if (!info.flag && info.countryCode) info.flag = geo.flagEmoji(info.countryCode);
      return info;
    },
    lookupIP: function (force) {
      // 1) Fresh cache wins — instant render, no quota use.
      if (!force) {
        var cached = lsGet(GEO_CACHE_KEY, null);
        if (cached && cached.data && cached.ts && (Date.now() - cached.ts) < GEO_CACHE_TTL) {
          return Promise.resolve(cached.data);
        }
      }
      if (typeof fetch !== 'function') return Promise.resolve(null);
      var endpoints = [
        { url: 'https://ipwho.is/', name: 'ipwho.is' },
        { url: 'https://ipapi.co/json/', name: 'ipapi.co' }
      ];
      var attempt = function (i) {
        if (i >= endpoints.length) return Promise.resolve(null);
        return fetch(endpoints[i].url)
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) { return geo.normalize(d, endpoints[i].name); })
          .then(function (info) {
            if (!info) return attempt(i + 1);
            lsSet(GEO_CACHE_KEY, { ts: Date.now(), data: info });
            return info;
          })
          .catch(function () { return attempt(i + 1); });
      };
      return attempt(0);
    }
  };

  /* -------------------------------------------------------------- location */
  var location = {
    state: null,
    init: function () {
      var card = $('#pdLocationCard');
      if (!card) return;
      var nameEl = $('#pdLocationName', card);
      var subEl = $('#pdLocationSub', card);
      var textEl = nameEl || subEl;

      // 1. Cached value first (instant render).
      var cached = lsGet('pd_location', null);
      if (cached && textEl) {
        textEl.textContent = cached.name;
        if (subEl) subEl.textContent = cached.coords;
        card.classList.add('pd-loc-found');
      }

      // 2. Ask the browser for a precise fix.
      var done = false;
      var finish = function (result) {
        if (done) return; done = true;
        location.state = result;
        lsSet('pd_location', result);
        if (textEl) {
          textEl.textContent = result.name;
          if (subEl) subEl.textContent = result.coords;
        }
        card.classList.add('pd-loc-found');
        card.classList.remove('pd-loc-loading');
        broadcast('location', result);
      };

      if (!navigator.geolocation) { location.ipFallback(finish); return; }
      card.classList.add('pd-loc-loading');
      if (nameEl && subEl) { nameEl.textContent = i18n.t('location.detect'); subEl.textContent = '…'; }
      navigator.geolocation.getCurrentPosition(function (pos) {
        var lat = pos.coords.latitude, lng = pos.coords.longitude;
        var fallbackName = lat.toFixed(3) + ', ' + lng.toFixed(3);
        var base = { name: fallbackName, coords: lat.toFixed(3) + '°, ' + lng.toFixed(3) + '°', lat: lat, lng: lng };
        // Reverse geocode (BigDataCloud — free, no key).
        if (typeof fetch !== 'function') { finish(base); return; }
        fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lng + '&localityLanguage=en')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var city = d.city || d.locality || d.principalSubdivision || '';
            var country = d.countryName || '';
            base.name = [city, country].filter(Boolean).join(', ') || fallbackName;
            finish(base);
          })
          .catch(function () { finish(base); });
        // Enrich the sub-line with local time + ISP from the IP API.
        geo.lookupIP().then(function (d) {
          if (!d || !subEl) return;
          var extra = [];
          if (d.localTime) extra.push(d.localTime);
          if (d.isp) extra.push(d.isp);
          if (extra.length) subEl.textContent = base.coords + ' · ' + extra.join(' · ');
        }).catch(function () { /* enrichment is optional */ });
      }, function () {
        location.ipFallback(finish);
      }, { timeout: 8000, maximumAge: 300000 });

      // Retry button.
      var retry = $('#pdLocationRetry', card);
      if (retry) retry.addEventListener('click', function () {
        card.classList.add('pd-loc-loading');
        done = false;
        location.init();
      });
    },
    ipFallback: function (finish) {
      var offline = { name: 'Global Network', coords: 'Online — connecting Zambia, Eswatini & Ireland' };
      if (typeof fetch !== 'function') { finish(offline); return; }
      geo.lookupIP().then(function (d) {
        if (!d || !d.country) { finish(offline); return; }
        var name = [d.city, d.region, d.country].filter(Boolean).join(', ') || 'Global Network';
        if (d.flag) name = d.flag + ' ' + name;
        var sub = [];
        if (d.lat != null && d.lon != null) sub.push(Number(d.lat).toFixed(2) + '°, ' + Number(d.lon).toFixed(2) + '°');
        if (d.localTime) sub.push(d.localTime);
        if (d.isp) sub.push(d.isp);
        finish({
          name: name,
          coords: sub.join(' · ') || 'Online',
          lat: d.lat, lng: d.lon
        });
      }).catch(function () { finish(offline); });
    }
  };

  /* --------------------------------------------------------- announcements */
  var announcements = {
    init: function () {
      var bar = $('#pdAnnouncementBar');
      if (!bar) return;
      var items = (store.get('announcements', 'DEFAULT_ANNOUNCEMENTS') || []).filter(function (a) { return a && a.active !== false; });
      var track = $('.pd-marquee-track', bar);
      if (!track) return;
      if (!items.length) { bar.style.display = 'none'; return; }
      var render = function () {
        var html = items.map(function (a, i) {
          return '<span class="pd-marquee-item" data-i="' + i + '"><i class="fas ' + esc(a.icon || 'fa-bullhorn') + '"></i> ' + esc(a.text) + '</span>';
        }).join('<i class="fas fa-cross pd-marquee-sep"></i>');
        // Duplicate for a seamless loop.
        track.innerHTML = '<div class="pd-marquee-group">' + html + '</div><div class="pd-marquee-group" aria-hidden="true">' + html + '</div>';
      };
      render();
      bar.classList.add('pd-marquee-ready');
      // Pause on hover / touch.
      bar.addEventListener('mouseenter', function () { bar.classList.add('pd-marquee-paused'); });
      bar.addEventListener('mouseleave', function () { bar.classList.remove('pd-marquee-paused'); });
      on('store:announcements', function (e) { items = (e.detail || []).filter(function (a) { return a.active !== false; }); render(); });
      on('announcement', function (e) { items = (e.detail || []).filter(function (a) { return a.active !== false; }); render(); });
    }
  };

  /* ---------------------------------------------------------- notifications
     Three problems this module solves:
       1. The permission prompt must read professionally — we show our own
          "Allow Notifications" sheet first, and on the native Android build we
          ask through Capacitor so the browser origin is never displayed.
       2. Notifications must reach the *device* (notification shade / lock
          screen), not just the in-app bell — so we hand them to the service
          worker, which is what Android and installed iOS PWAs require.
       3. Once an item is read it must never come back as new — read state is
          stored per notification id and applied to the Firestore mirror too. */
  var READ_KEY = 'pd_notif_read_ids';
  var SHOWN_KEY = 'pd_notif_shown_ids';

  function idList(key) { var v = lsGet(key, []); return Array.isArray(v) ? v : []; }
  function rememberId(key, id, cap) {
    if (!id) return;
    var list = idList(key);
    if (list.indexOf(id) > -1) return;
    list.unshift(id);
    lsSet(key, list.slice(0, cap || 300));
  }
  function signature(n) {
    return [n.type || 'general', (n.title || '').trim(), (n.message || '').trim()].join('|');
  }

  var notifications = {
    items: lsGet('pd_notifications', []),
    badgeEl: null,
    listEl: null,
    panelEl: null,
    init: function () {
      notifications.badgeEl = $('#pdNotifBadge') || $('.pd-bell-badge') || $('#notifBadge');
      notifications.listEl = $('#pdNotifList');
      notifications.panelEl = $('#pdNotifPanel');
      // Apply stored read state on boot so nothing reappears as "new".
      var readIds = idList(READ_KEY);
      notifications.items = notifications.items.map(function (n) {
        if (readIds.indexOf(n.id) > -1) n.read = true;
        return n;
      });
      if (notifications.listEl) notifications.render();
      notifications.syncBadge();

      // Bell opens the in-app notification center — and if the browser
      // permission is still "default", it pops the friendly enable dialog
      // (instead of leaving the user wondering why nothing pings).
      var bell = $('#pdNotifBell') || $('#notificationBell');
      if (bell) {
        bell.addEventListener('click', function (e) {
          e.stopPropagation();
          if (notifications.canPrompt() && !localStorage.getItem('pd_notif_pop_dismissed')) {
            notifications.showEnablePop();
          } else {
            ui.toggleNotifPanel();
          }
        });
      }
      document.addEventListener('click', function (e) {
        var panel = notifications.panelEl;
        if (panel && panel.classList.contains('open') &&
            !panel.contains(e.target) && bell && !bell.contains(e.target)) {
          ui.toggleNotifPanel(false);
        }
      });
      // Listen for new pushes from other tabs / the admin dashboard.
      on('notification', function (e) {
        if (e && e.detail) notifications.push(e.detail, { silent: true });
      });
      // A dismissed system notification counts as seen.
      if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', function (event) {
          var msg = event.data || {};
          if (msg.type === 'pd-notification-dismissed' && msg.id) notifications.markRead(msg.id);
        });
      }
      // Firestore live mirror (liveStatus style): watch notifications in real time.
      if (fb && fb.db && fb.collection && fb.query && fb.orderBy && fb.limit && fb.getDocs) {
        var q = fb.query(fb.collection(fb.db, 'notifications'), fb.orderBy('createdAt', 'desc'), fb.limit(20));
        fb.getDocs(q).then(function (snap) {
          var remote = [];
          snap.forEach(function (d) {
            var x = d.data();
            remote.push({
              id: d.id, type: x.type || 'general', title: x.title || 'Update',
              message: x.message || '', link: x.link || null,
              time: x.createdAt ? (x.createdAt.toDate ? x.createdAt.toDate().toISOString() : new Date(x.createdAt).toISOString()) : new Date().toISOString(),
              read: idList(READ_KEY).indexOf(d.id) > -1
            });
          });
          if (remote.length) notifications.merge(remote);
        }).catch(function () {});
      }
    },

    /* Merge remote items without duplicating what is already local and without
       resurrecting anything the member already read. */
    merge: function (remote) {
      var readIds = idList(READ_KEY);
      var seenIds = {};
      var seenSignatures = {};
      var merged = [];

      remote.concat(notifications.items).forEach(function (n) {
        if (!n || !n.id) return;
        var sig = signature(n);
        if (seenIds[n.id] || seenSignatures[sig]) return;
        seenIds[n.id] = true;
        seenSignatures[sig] = true;
        if (readIds.indexOf(n.id) > -1) n.read = true;
        merged.push(n);
      });

      merged.sort(function (a, b) { return new Date(b.time) - new Date(a.time); });
      notifications.items = merged.slice(0, 40);
      lsSet('pd_notifications', notifications.items);
      notifications.render();
      notifications.syncBadge();

      // Surface genuinely fresh remote items on the device (last 10 minutes).
      var cutoff = Date.now() - 10 * 60 * 1000;
      notifications.items.forEach(function (n) {
        if (!n.read && new Date(n.time).getTime() > cutoff) notifications.notifyDevice(n);
      });
    },

    canPrompt: function () {
      return typeof Notification !== 'undefined' && Notification.permission === 'default';
    },

    /* Our own "Allow Notifications" sheet. Browsers always add their own
       origin line to the *system* prompt (that text cannot be changed by a
       website), so we make the request feel professional by asking first, in
       Prayer Dome's own words, and by using the native permission dialog on the
       installed Android app where no website name is shown at all. */
    showEnablePop: function () {
      if (document.getElementById('pdNotifPop')) return;
      var overlay = document.createElement('div');
      overlay.id = 'pdNotifPop';
      overlay.className = 'pd-notif-pop-overlay';
      overlay.innerHTML =
        '<div class="pd-notif-pop" role="dialog" aria-modal="true" aria-labelledby="pdNotifPopTitle">' +
          '<div class="pd-notif-pop-icon"><img src="' + BRAND_LOGO + '" alt="Prayer Dome" width="44" height="44"></div>' +
          '<h3 id="pdNotifPopTitle">Allow Notifications</h3>' +
          '<p>Prayer Dome would like to send you daily Bible verses, live service alerts and prayer updates. You can turn this off at any time in Settings.</p>' +
          '<div class="pd-notif-pop-actions">' +
            '<button class="pd-notif-pop-btn pd-notif-pop-btn--ghost" data-action="dismiss">Not now</button>' +
            '<button class="pd-notif-pop-btn pd-notif-pop-btn--primary" data-action="enable"><i class="fas fa-bell"></i> Allow</button>' +
          '</div>' +
          '<small class="pd-notif-pop-hint">Prayer Dome · A House of Prayer for All Nations</small>' +
        '</div>';
      document.body.appendChild(overlay);
      requestAnimationFrame(function () { overlay.classList.add('pd-notif-pop-open'); });
      overlay.addEventListener('click', function (e) {
        var action = e.target && e.target.closest && e.target.closest('[data-action]')
          ? e.target.closest('[data-action]').getAttribute('data-action')
          : (e.target === overlay ? 'dismiss' : null);
        if (!action) return;
        if (action === 'enable') {
          notifications.requestPermission().then(function (perm) {
            if (perm === 'granted') toast('Notifications are on — you will hear from us', 'success');
            else if (perm === 'denied') toast('Notifications are blocked. You can allow them in your device settings.', 'error');
            closePop();
          });
        } else {
          closePop();
          localStorage.setItem('pd_notif_pop_dismissed', new Date().toISOString());
        }
        function closePop() { overlay.classList.remove('pd-notif-pop-open'); setTimeout(function () { overlay.remove(); }, 250); }
      });
    },

    /** Native permission on the packaged app, browser permission on the web. */
    requestPermission: function () {
      var native = window.Capacitor && window.Capacitor.Plugins &&
        (window.Capacitor.Plugins.PushNotifications || window.Capacitor.Plugins.LocalNotifications);
      if (native && native.requestPermissions) {
        return native.requestPermissions()
          .then(function (res) {
            var granted = res && (res.receive === 'granted' || res.display === 'granted');
            if (granted && window.Capacitor.Plugins.PushNotifications) {
              try { window.Capacitor.Plugins.PushNotifications.register(); } catch (e) {}
            }
            return granted ? 'granted' : 'denied';
          })
          .catch(function () { return 'denied'; });
      }
      if (typeof Notification === 'undefined') return Promise.resolve('unsupported');
      try { return Promise.resolve(Notification.requestPermission()); }
      catch (e) {
        // Some browsers throw if not from a user gesture — fall back to in-app only.
        return Promise.resolve(Notification.permission || 'default');
      }
    },

    /* Show the notification on the device itself. Android and installed iOS
       PWAs only display notifications raised by the service worker, so that is
       the preferred path; the page-level API is the desktop fallback. */
    notifyDevice: function (n) {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      if (idList(SHOWN_KEY).indexOf(n.id) > -1) return;
      rememberId(SHOWN_KEY, n.id, 200);

      var options = {
        body: n.message || '',
        icon: BRAND_LOGO,
        badge: '/assets/logo-192.png',
        tag: n.id,                 // one entry per item — never a duplicate
        renotify: false,
        requireInteraction: false, // informative, not intrusive
        timestamp: new Date(n.time).getTime() || Date.now(),
        data: { url: n.link || '/index.html', id: n.id, kind: n.type || 'general' }
      };
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready
          .then(function (reg) { return reg.showNotification(n.title, options); })
          .catch(function () {
            try { new Notification(n.title, options); } catch (e) {}
          });
      } else {
        try { new Notification(n.title, options); } catch (e) {}
      }
    },

    push: function (item, opts) {
      opts = opts || {};
      var now = new Date().toISOString();
      var n = {
        id: item.id || uid('notif'),
        type: item.type || 'general',
        title: item.title || 'Prayer Dome Update',
        message: item.message || '',
        link: item.link || null,
        time: item.time || now,
        read: idList(READ_KEY).indexOf(item.id) > -1
      };
      // Never store the same announcement twice (e.g. local push + Firestore mirror).
      var sig = signature(n);
      var duplicate = notifications.items.filter(function (existing) {
        return existing.id === n.id || signature(existing) === sig;
      })[0];
      if (duplicate) return duplicate;

      notifications.items = [n].concat(notifications.items).slice(0, 40);
      lsSet('pd_notifications', notifications.items);
      if (notifications.listEl) notifications.render();
      notifications.syncBadge();

      if (!opts.silent) {
        // Let every other open tab render it instantly (they re-push silently,
        // so this does not loop).
        broadcast('notification', n);
        toast(n.title + (n.message ? ' — ' + n.message : ''), 'success');
        notifications.notifyDevice(n);
      }
      // Persist to Firestore once (as a broadcast record, without FCM tokens).
      if (!opts.localOnly && fb && fb.db && fb.collection && fb.addDoc && fb.serverTimestamp && !n._persisted) {
        n._persisted = true;
        fb.addDoc(fb.collection(fb.db, 'notifications'), {
          type: n.type, title: n.title, message: n.message, link: n.link || null,
          createdAt: fb.serverTimestamp()
        }).then(function (ref) {
          // Adopt the server id so the mirror does not re-add this as new.
          if (!ref || !ref.id) return;
          var wasRead = n.read;
          n.id = ref.id;
          if (wasRead) rememberId(READ_KEY, ref.id, 300);
          lsSet('pd_notifications', notifications.items);
        }).catch(function () {});
      }
      return n;
    },

    render: function () {
      var list = notifications.listEl;
      if (!list) return;
      if (!notifications.items.length) {
        list.innerHTML = '<div class="pd-notif-empty"><i class="fas fa-bell-slash"></i><p>' + esc(i18n.t('notifications.empty')) + '</p></div>';
        return;
      }
      var icons = {
        live: 'fa-tower-broadcast', sermon: 'fa-microphone-lines', prayer: 'fa-hands-praying',
        event: 'fa-calendar-day', news: 'fa-newspaper', scripture: 'fa-book-bible', general: 'fa-bullhorn'
      };
      list.innerHTML = notifications.items.map(function (n) {
        var when = new Date(n.time);
        var label = isNaN(when) ? '' : when.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return '<div class="pd-notif-item' + (n.read ? '' : ' pd-notif-unread') + '" data-id="' + esc(n.id) + '">' +
          '<div class="pd-notif-icon"><i class="fas ' + (icons[n.type] || icons.general) + '"></i></div>' +
          '<div class="pd-notif-body"><div class="pd-notif-title">' + esc(n.title) + '</div>' +
          '<div class="pd-notif-msg">' + esc(n.message) + '</div>' +
          '<div class="pd-notif-time">' + esc(label) + '</div></div>' +
          (n.link ? '<a class="pd-notif-go" href="' + esc(n.link) + '"><i class="fas fa-chevron-right"></i></a>' : '') +
          '</div>';
      }).join('');
      $$('.pd-notif-item', list).forEach(function (el) {
        el.addEventListener('click', function () {
          var id = el.getAttribute('data-id');
          notifications.markRead(id);
          var item = notifications.items.filter(function (n) { return n.id === id; })[0];
          if (item && item.link && item.link !== '#') window.location.href = item.link;
        });
      });
    },

    markRead: function (id) {
      rememberId(READ_KEY, id, 300);
      notifications.items = notifications.items.map(function (n) {
        if (n.id === id) n.read = true;
        return n;
      });
      lsSet('pd_notifications', notifications.items);
      // Clear it from the device shade too, so it cannot be tapped again later.
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function (reg) {
          if (reg.active) reg.active.postMessage({ type: 'pd-clear-notification', tag: id });
        }).catch(function () {});
      }
      notifications.render();
      notifications.syncBadge();
    },

    markAllRead: function () {
      notifications.items.forEach(function (n) {
        n.read = true;
        rememberId(READ_KEY, n.id, 300);
      });
      lsSet('pd_notifications', notifications.items);
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function (reg) {
          return reg.getNotifications ? reg.getNotifications() : [];
        }).then(function (list) {
          (list || []).forEach(function (note) { note.close(); });
        }).catch(function () {});
      }
      notifications.render();
      notifications.syncBadge();
    },

    clear: function () {
      // Remember what was cleared so the Firestore mirror cannot resurrect it.
      notifications.items.forEach(function (n) { rememberId(READ_KEY, n.id, 300); });
      notifications.items = [];
      lsSet('pd_notifications', []);
      notifications.render();
      notifications.syncBadge();
    },

    unread: function () {
      return notifications.items.filter(function (n) { return !n.read; }).length;
    },

    syncBadge: function () {
      var n = notifications.unread();
      var legacy = 0;
      var legacyBadge = $('#notifBadge');
      if (legacyBadge && legacyBadge !== notifications.badgeEl &&
          legacyBadge.style.display !== 'none' && legacyBadge.textContent) {
        legacy = parseInt(legacyBadge.textContent, 10) || 0;
      }
      var total = n + legacy;
      var badge = notifications.badgeEl;
      // Keep the app icon badge (installed PWA) in step with the bell.
      if (navigator.setAppBadge) {
        if (total > 0) navigator.setAppBadge(total).catch(function () {});
        else if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {});
      }
      if (!badge) return;
      if (total > 0) {
        badge.style.display = 'flex';
        badge.textContent = total > 9 ? '9+' : total;
      } else {
        badge.style.display = 'none';
      }
    }
  };

  /* --------------------------------------------------------------- banners */
  var banners = {
    init: function () {
      var hero = $('[data-pd-hero]');
      if (!hero) return;
      var list = (store.get('banners', 'DEFAULT_BANNERS') || []).filter(function (b) { return b && b.active; });
      var now = Date.now();
      var banner = null;
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        var start = b.scheduleStart ? new Date(b.scheduleStart).getTime() : 0;
        var end = b.scheduleEnd ? new Date(b.scheduleEnd).getTime() : Infinity;
        if (now >= start && now <= end) { banner = b; break; }
      }
      if (!banner) return; // page keeps its static hero
      banners.render(hero, banner);
      on('store:banners', function (e) {
        var next = (e.detail || []).filter(function (b) { return b && b.active; });
        for (var j = 0; j < next.length; j++) {
          var bb = next[j];
          var s = bb.scheduleStart ? new Date(bb.scheduleStart).getTime() : 0;
          var en = bb.scheduleEnd ? new Date(bb.scheduleEnd).getTime() : Infinity;
          if (now >= s && now <= en) { banners.render(hero, bb); return; }
        }
      });
    },
    render: function (hero, banner) {
      var video = banner.type === 'video' && banner.mediaUrl;
      var media = video
        ? '<video class="pd-hero-video" autoplay muted loop playsinline preload="auto" poster="' + esc(banner.poster || '/assets/hero-worship.jpg') + '">' +
          '<source src="' + esc(banner.mediaUrl) + '" type="video/mp4"></video>'
        : '<img class="pd-hero-img pd-kenburns" src="' + esc(banner.mediaUrl || '/assets/hero-worship.jpg') + '" alt="' + esc(banner.headline || 'Prayer Dome') + '">';
      hero.classList.add('pd-hero-managed');
      hero.innerHTML =
        media +
        '<div class="pd-hero-shade"></div>' +
        '<div class="pd-hero-content">' +
          '<img class="pd-hero-logo" src="' + BRAND_LOGO + '" alt="Prayer Dome logo" loading="lazy" onerror="this.remove()">' +
          (banner.badge ? '<span class="pd-hero-badge">' + esc(banner.badge) + '</span>' : '') +
          '<p class="pd-hero-eyebrow pd-brand-mark">Prayer Dome</p>' +
          '<h1 class="pd-hero-headline">' + esc(banner.headline || 'Welcome to Prayer Dome') + '</h1>' +
          (banner.subtext ? '<p class="pd-hero-subtext">' + esc(banner.subtext) + '</p>' : '') +
          (banner.ctaLabel ? '<a class="pd-btn ' + (banner.ctaStyle === 'gold' ? 'pd-btn-gold' : 'pd-btn-dawn') + '" href="' + esc(banner.ctaUrl || '#') + '">' + esc(banner.ctaLabel) + '</a>' : '') +
        '</div>' +
        '<div class="pd-hero-live" id="pdHeroLive" style="display:none"><span class="pd-live-dot"></span> LIVE NOW — Watch</div>';
      // If a live stream is active, show the live pill linking to /live.html
      if (live.getStatus() && live.getStatus().live) {
        var pill = $('#pdHeroLive', hero);
        if (pill) {
          pill.style.display = 'flex';
          pill.addEventListener('click', function () { window.location.href = '/live.html'; });
        }
      }
    }
  };

  /* ---------------------------------------------------------------- stats */
  var stats = {
    init: function () {
      var els = $$('[data-pd-stat]');
      if (!els.length) return;
      var render = function () {
        var data = store.get('stats', 'DEFAULT_STATS') || {};
        els.forEach(function (el) {
          var key = el.getAttribute('data-pd-stat');
          var map = {
            members: data.members, prayerRequests: data.prayerRequests, testimonies: data.testimonies,
            countriesReached: data.countriesReached, liveViewers: data.liveViewers, prayerGroups: data.prayerGroups
          };
          if (map[key] === undefined) return;
          var target = Number(map[key]) || 0;
          var suffix = el.getAttribute('data-pd-suffix') || '';
          stats.countUp(el, target, suffix);
        });
      };
      render();
      on('store:stats', render);
      on('live', function () { render(); });
      if (fb && fb.db && fb.doc && fb.getDoc) {
        fsGet(fb.doc(fb.db, 'communityStats', 'current'), null).then(function (d) {
          if (d) { store.set('stats', Object.assign(store.get('stats', 'DEFAULT_STATS') || {}, d)); render(); }
        });
      }
    },
    bump: function (key, delta) {
      var data = store.get('stats', 'DEFAULT_STATS') || {};
      data[key] = (Number(data[key]) || 0) + (delta || 1);
      store.set('stats', data);
      if (fb && fb.db && fb.doc && fb.setDoc) {
        var patch = {}; patch[key] = data[key];
        fsSet(fb.doc(fb.db, 'communityStats', 'current'), patch);
      }
      return data[key];
    },
    countUp: function (el, target, suffix) {
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced || !window.requestAnimationFrame) { el.textContent = Number(target).toLocaleString() + suffix; return; }
      var dur = 1100, start = performance.now(), from = 0;
      var step = function (t) {
        var p = Math.min(1, (t - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(from + (target - from) * eased).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  };

  /* ----------------------------------------------------------------- live */
  var live = {
    _status: lsGet('pd_live_status', null),
    _viewerId: null,
    init: function () {
      // Watch Firestore live status so viewers see admin broadcasts.
      if (fb && fb.db && fb.doc) {
        fsWatch(fb.doc(fb.db, 'liveStatus', 'current'), function (d) {
          if (d) { live._status = d; lsSet('pd_live_status', d); broadcast('live', d); }
        });
      }
      // Join as a viewer once per tab session.
      live._viewerId = sessionStorage.getItem('pd_viewer_id') || uid('vw');
      sessionStorage.setItem('pd_viewer_id', live._viewerId);
      if (live.getStatus() && live.getStatus().live) live.joinViewer();
      window.addEventListener('beforeunload', function () { live.leaveViewer(); });
      // Keep the viewer count honest: refresh presence and counts every 15s.
      setInterval(function () {
        if (live.getStatus() && live.getStatus().live) {
          live.ping();
          live.syncViewerCount();
        }
      }, 15000);
    },
    getStatus: function () {
      return live._status;
    },
    setStatus: function (status) {
      live._status = status;
      lsSet('pd_live_status', status);
      if (fb && fb.db && fb.doc && fb.setDoc) {
        var payload = Object.assign({}, status);
        delete payload.viewers;
        fsSet(fb.doc(fb.db, 'liveStatus', 'current'), payload);
      }
      broadcast('live', status);
      return status;
    },
    joinViewer: function () {
      var s = live._status;
      if (!s || !s.live) return;
      var viewers = lsGet('pd_live_viewers', {});
      if (viewers[live._viewerId]) return;
      viewers[live._viewerId] = Date.now();
      lsSet('pd_live_viewers', viewers);
      live.syncViewerCount();
      live.ping();
    },
    leaveViewer: function () {
      var viewers = lsGet('pd_live_viewers', {});
      if (viewers[live._viewerId]) { delete viewers[live._viewerId]; lsSet('pd_live_viewers', viewers); live.syncViewerCount(); }
    },
    syncViewerCount: function () {
      var s = live._status;
      if (!s) return;
      var viewers = lsGet('pd_live_viewers', {});
      // Drop stale entries (> 60s) — keeps the count honest.
      var now = Date.now(), keep = {};
      Object.keys(viewers).forEach(function (k) { if (now - viewers[k] < 60000) keep[k] = viewers[k]; });
      lsSet('pd_live_viewers', keep);
      var count = Object.keys(keep).length;
      var el = $('#pdLiveViewers');
      if (el) el.textContent = count;
      if (fb && fb.db && fb.doc && fb.updateDoc) {
        fb.updateDoc(fb.doc(fb.db, 'liveStatus', 'current'), { viewers: count }).catch(function () {});
      }
      // Emit so the whole app can show it.
      broadcast('viewers', { count: count });
      return count;
    },
    ping: function () {
      var viewers = lsGet('pd_live_viewers', {});
      viewers[live._viewerId] = Date.now();
      lsSet('pd_live_viewers', viewers);
    },
    comments: function () { return lsGet('pd_live_comments', []); },
    addComment: function (name, text) {
      var c = { id: uid('c'), name: name || 'Guest', text: text, time: new Date().toISOString() };
      var list = live.comments();
      list.push(c);
      lsSet('pd_live_comments', list.slice(-200));
      broadcast('live:comment', c);
      if (fb && fb.db && fb.collection && fb.addDoc && fb.serverTimestamp) {
        fb.addDoc(fb.collection(fb.db, 'liveChat'), Object.assign({}, c, { createdAt: fb.serverTimestamp() })).catch(function () {});
      }
      return c;
    },
    reactions: function () { return lsGet('pd_live_reactions', {}); },
    addReaction: function (emoji) {
      var r = live.reactions();
      r[emoji] = (r[emoji] || 0) + 1;
      lsSet('pd_live_reactions', r);
      broadcast('live:reaction', { emoji: emoji });
      return r;
    },
    addPrayerRequest: function (text) {
      var p = { id: uid('pray'), text: text, time: new Date().toISOString() };
      var list = live.prayerRequests();
      list.push(p);
      lsSet('pd_live_prayers', list.slice(-100));
      broadcast('live:prayer', p);
      if (fb && fb.db && fb.collection && fb.addDoc && fb.serverTimestamp) {
        fb.addDoc(fb.collection(fb.db, 'livePrayers'), Object.assign({}, p, { createdAt: fb.serverTimestamp() })).catch(function () {});
      }
      return p;
    },
    prayerRequests: function () { return lsGet('pd_live_prayers', []); },
    schedule: function () { return lsGet('pd_live_schedule', []); },
    addScheduled: function (item) {
      var list = live.schedule();
      list.push(Object.assign({ id: uid('sched') }, item));
      lsSet('pd_live_schedule', list);
      broadcast('live:schedule', list);
      return list;
    },
    /* Replays are cloud recordings only. Any legacy `blob:` entry (a replay
       that lived in the browser's memory on one device) is dropped so members
       never see a broken "Play" that only worked for the person who recorded
       it — every recording now streams from Prayer Dome cloud storage. */
    isCloudUrl: function (url) {
      return typeof url === 'string' && /^https?:\/\//i.test(url) && !/^blob:/i.test(url);
    },
    replays: function () {
      var list = lsGet('pd_live_replays', []);
      var cloudOnly = list.filter(function (r) {
        return r && (live.isCloudUrl(r.url) || live.isCloudUrl(r.playbackUrl) ||
          (Array.isArray(r.parts) && r.parts.length && live.isCloudUrl(r.parts[0] && r.parts[0].url)));
      });
      if (cloudOnly.length !== list.length) lsSet('pd_live_replays', cloudOnly);
      return cloudOnly;
    },
    addReplay: function (item) {
      item = item || {};
      var url = item.url || item.playbackUrl ||
        (Array.isArray(item.parts) && item.parts[0] ? item.parts[0].url : null);
      if (!live.isCloudUrl(url)) {
        // Refuse device-local recordings — they must be uploaded to the cloud.
        console.warn('[PDApp] Ignoring a non-cloud replay URL; recordings must live in cloud storage.');
        return live.replays();
      }
      var list = live.replays();
      list.unshift(Object.assign({ id: uid('rec'), storage: 'cloud' }, item, { url: url }));
      lsSet('pd_live_replays', list.slice(0, 30));
      broadcast('live:replay', list);
      return list;
    }
  };

  /* ------------------------------------------------------------------ news */
  var news = {
    list: function () {
      return (store.get('news', 'DEFAULT_NEWS') || []).filter(function (n) { return n && n.published; });
    },
    get: function (id) {
      var all = store.get('news', 'DEFAULT_NEWS') || [];
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
      return null;
    },
    publish: function (item) {
      var all = store.get('news', 'DEFAULT_NEWS') || [];
      var n = Object.assign({ id: item.id || uid('news'), date: item.date || new Date().toISOString(), published: true }, item);
      var idx = -1;
      for (var i = 0; i < all.length; i++) if (all[i].id === n.id) idx = i;
      if (idx >= 0) all[idx] = n; else all.unshift(n);
      store.set('news', all);
      if (fb && fb.db && fb.collection && fb.serverTimestamp) {
        var payload = Object.assign({}, n, {
          id: n.id,
          featuredImage: n.featuredImage || n.image || '',
          socialImage: n.socialImage || n.featuredImage || n.image || '',
          updatedAt: fb.serverTimestamp()
        });
        if (fb.setDoc && fb.doc) {
          if (!payload.createdAt) payload.createdAt = fb.serverTimestamp();
          fb.setDoc(fb.doc(fb.db, 'news', n.id), payload, { merge: true }).catch(function () {});
        } else if (fb.addDoc) {
          payload.createdAt = fb.serverTimestamp();
          fb.addDoc(fb.collection(fb.db, 'news'), payload).catch(function () {});
        }
      }
      broadcast('news', n);
      return n;
    },
    remove: function (id) {
      var all = store.get('news', 'DEFAULT_NEWS') || [];
      store.set('news', all.filter(function (n) { return n.id !== id; }));
      broadcast('news:remove', { id: id });
    }
  };

  /* ------------------------------------------------------------- scripture */
  var scripture = {
    render: function (el) {
      if (!el) return;
      var theme = (window.PD_CONTENT || {}).THEME_SCRIPTURE || {};
      var v = theme.versions && theme.versions[lang];
      var ref = v ? v.verse : (theme.verse || 'Mark 7:37');
      var text = v ? v.theme : (theme.theme || '');
      var cls = el.getAttribute('data-pd-scripture-style') || 'default';
      if (cls === 'bare') {
        el.innerHTML = '<span class="pd-scripture-text">"' + esc(text) + '"</span><span class="pd-scripture-ref">' + esc(ref) + '</span>';
        return;
      }
      el.innerHTML =
        '<div class="pd-scripture-card">' +
          '<div class="pd-scripture-icon"><i class="fas fa-book-bible"></i></div>' +
          '<p class="pd-scripture-kicker">' + esc(i18n.t('scripture.featured')) + '</p>' +
          '<blockquote class="pd-scripture-text">“' + esc(text) + '”</blockquote>' +
          '<p class="pd-scripture-ref">— ' + esc(ref) + '</p>' +
          '<p class="pd-scripture-verse">' + esc(theme.text || '') + '</p>' +
        '</div>';
    },
    init: function () {
      $$('[data-pd-scripture]').forEach(function (el) { scripture.render(el); });
      document.addEventListener('pd:lang', function () {
        $$('[data-pd-scripture]').forEach(function (el) { scripture.render(el); });
      });
    }
  };

  /* ---------------------------------------------------------------- radio */
  var radio = {
    audio: null,
    playing: false,
    _bound: false,
    init: function () {
      if (!radio._bound) {
        // Delegated binding — safe to re-render the grid and call init() again.
        document.addEventListener('click', function (e) {
          var btn = e.target.closest ? e.target.closest('[data-pd-radio]') : null;
          if (!btn) return;
          var url = btn.getAttribute('data-pd-radio');
          var name = btn.getAttribute('data-pd-radio-name') || 'Prayer Dome Radio';
          radio.toggle(url, name, btn);
        });
        radio._bound = true;
      }
      document.addEventListener('pd:radio', function (e) {
        var d = e.detail || {};
        var btn = $('[data-pd-radio="' + d.url + '"]');
        radio.toggle(d.url, d.name || 'Prayer Dome Radio', btn);
      });
    },
    toggle: function (url, name, btn) {
      if (!radio.audio) radio.audio = new Audio();
      if (radio.playing && radio.audio.src.split('?')[0] === url.split('?')[0]) {
        radio.audio.pause();
        radio.playing = false;
        if (btn) btn.classList.remove('pd-radio-playing');
        var icon = btn && btn.querySelector('i');
        if (icon) icon.className = 'fas fa-play';
        var indicator = $('#pdRadioNow');
        if (indicator) indicator.style.display = 'none';
        broadcast('radio:stopped', { url: url });
        return;
      }
      radio.audio.src = url;
      radio.audio.play().then(function () {
        radio.playing = true;
        $$('[data-pd-radio]').forEach(function (b) {
          b.classList.remove('pd-radio-playing');
          var ic = b.querySelector('i');
          if (ic) ic.className = 'fas fa-play';
        });
        if (btn) {
          btn.classList.add('pd-radio-playing');
          var icon2 = btn.querySelector('i');
          if (icon2) icon2.className = 'fas fa-pause';
        }
        var indicator = $('#pdRadioNow');
        if (indicator) {
          indicator.style.display = 'flex';
          indicator.innerHTML = '<span class="pd-live-dot"></span> Now playing: ' + esc(name);
        }
        broadcast('radio:playing', { url: url, name: name });
      }).catch(function () {
        toast('Unable to play this stream. Check the station URL in the Admin Dashboard.', 'error');
      });
    },
    stop: function () {
      if (radio.audio) radio.audio.pause();
      radio.playing = false;
      var indicator = $('#pdRadioNow');
      if (indicator) indicator.style.display = 'none';
    }
  };

  /* ----------------------------------------------------------------- share
   * Social sharing that always carries the featured image, the content title,
   * a short description and Prayer Dome branding.
   *
   * Every shared link points at /share/<type>/<id>, which is answered by the
   * share function (functions/share.js). That endpoint renders real Open Graph
   * tags — og:image, og:title, og:description, og:site_name — then forwards a
   * human straight to the page. WhatsApp, Facebook, X, Telegram and iMessage
   * all read those tags, so the preview card is correct everywhere.
   * ---------------------------------------------------------------------- */
  var SHARE_ORIGIN = 'https://prayerdome.net';
  var SHARE_TYPES = {
    news: 'news', story: 'news', article: 'news',
    testimony: 'testimony', testimonies: 'testimony',
    sermon: 'sermon', sermons: 'sermon',
    devotional: 'devotional', devotionals: 'devotional',
    prayer: 'prayer', prayers: 'prayer',
    event: 'event', events: 'event',
    video: 'video', aivideo: 'video'
  };

  var share = {
    /** Canonical, preview-friendly link for a piece of content. */
    url: function (type, id) {
      var kind = SHARE_TYPES[String(type || '').toLowerCase()] || 'news';
      if (!id) return SHARE_ORIGIN + '/';
      return SHARE_ORIGIN + '/share/' + kind + '/' + encodeURIComponent(String(id));
    },

    /** A short branded blurb to accompany the link. */
    text: function (opts) {
      opts = opts || {};
      var title = String(opts.title || 'Prayer Dome').trim();
      var desc = String(opts.description || '').replace(/\s+/g, ' ').trim();
      if (desc.length > 160) desc = desc.slice(0, 159).trim() + '…';
      return desc ? (title + '\n\n' + desc + '\n\n— Prayer Dome') : (title + '\n\n— Prayer Dome');
    },

    /**
     * Share a piece of content. Uses the device share sheet when available
     * (Android/iOS/Chrome), otherwise falls back to copying the link.
     */
    open: function (opts) {
      opts = opts || {};
      var link = opts.url || share.url(opts.type, opts.id);
      var body = share.text(opts);
      if (navigator.share) {
        return navigator.share({ title: opts.title || 'Prayer Dome', text: body, url: link })
          .catch(function () { /* the member dismissed the sheet */ });
      }
      return share.copy(link);
    },

    /** Copy a link to the clipboard and confirm it quietly. */
    copy: function (link) {
      var done = function () { toast('Link copied — it will preview with the image and title.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(link).then(done).catch(function () { window.prompt('Copy this link', link); });
      }
      window.prompt('Copy this link', link);
      return Promise.resolve();
    },

    /** Per-network share links, for pages that render their own buttons. */
    links: function (opts) {
      opts = opts || {};
      var link = opts.url || share.url(opts.type, opts.id);
      var body = share.text(opts);
      var u = encodeURIComponent(link);
      var t = encodeURIComponent(body);
      return {
        url: link,
        whatsapp: 'https://wa.me/?text=' + encodeURIComponent(body + '\n' + link),
        facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + u,
        x: 'https://twitter.com/intent/tweet?text=' + t + '&url=' + u,
        telegram: 'https://t.me/share/url?url=' + u + '&text=' + t,
        email: 'mailto:?subject=' + encodeURIComponent(opts.title || 'Prayer Dome') + '&body=' + encodeURIComponent(body + '\n\n' + link)
      };
    },

    /** Render a consistent row of share buttons into a container. */
    buttons: function (container, opts) {
      var host = (typeof container === 'string') ? $(container) : container;
      if (!host) return;
      var l = share.links(opts);
      host.classList.add('pd-share-row');
      host.innerHTML =
        '<a class="pd-share-btn pd-share-wa" target="_blank" rel="noopener" href="' + l.whatsapp + '"><i class="fab fa-whatsapp"></i> WhatsApp</a>' +
        '<a class="pd-share-btn pd-share-fb" target="_blank" rel="noopener" href="' + l.facebook + '"><i class="fab fa-facebook-f"></i> Facebook</a>' +
        '<a class="pd-share-btn pd-share-x" target="_blank" rel="noopener" href="' + l.x + '"><i class="fab fa-x-twitter"></i> X</a>' +
        '<a class="pd-share-btn pd-share-tg" target="_blank" rel="noopener" href="' + l.telegram + '"><i class="fab fa-telegram"></i> Telegram</a>' +
        '<button type="button" class="pd-share-btn pd-share-copy"><i class="fas fa-link"></i> Copy link</button>';
      var copyBtn = host.querySelector('.pd-share-copy');
      if (copyBtn) copyBtn.addEventListener('click', function () { share.copy(l.url); });
    }
  };

  /* ---------------------------------------------------------------- public */
  window.PDApp = {
    version: VERSION,
    setFirestore: setFirestore,
    store: store,
    ui: ui,
    i18n: i18n,
    geo: geo,
    location: location,
    announcements: announcements,
    notifications: notifications,
    banners: banners,
    stats: stats,
    live: live,
    news: news,
    academyNav: academyNav,
    scripture: scripture,
    radio: radio,
    share: share,
    toast: toast,
    broadcast: broadcast,
    on: on,
    init: function () {
      // Each module is isolated: one failure must never break the rest.
      var modules = [
        ['ui', ui.init], ['i18n', i18n.init], ['location', location.init],
        ['announcements', announcements.init], ['notifications', notifications.init],
        ['banners', banners.init], ['stats', stats.init], ['live', live.init],
        ['scripture', scripture.init], ['radio', radio.init], ['academyNav', academyNav.init]
      ];
      modules.forEach(function (m) {
        try { m[1](); } catch (e) { /* module failed — continue */ }
      });
      // Broadcast that the app layer is ready (pages may hook here).
      document.dispatchEvent(new CustomEvent('pd:ready', { detail: { version: VERSION } }));
    }
  };

  // Auto-init after DOM ready (defensive: pages that need a hook can call PDApp.init() again).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.PDApp.init(); });
  } else {
    window.PDApp.init();
  }
})();
