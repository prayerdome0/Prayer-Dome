/*!
 * Prayer Dome — Lock-screen verse widget bridge (pd-widget.js)
 * ---------------------------------------------------------------------------
 * The verse widget lives outside the app: on the Android home screen and, where
 * Android shows widgets there, on the lock screen. This file is the web half of
 * it. It does three jobs:
 *
 *   1. one theme + layout model shared by the phone widget, the preview on
 *      /widgets.html and the lock-screen wallpaper studio, so what a member
 *      designs on the page is what the phone renders;
 *   2. a bridge to the native widget through the Capacitor plugin
 *      VerseWidgetPlugin (Android) — theme, text size, pinned verse, redraw and
 *      "add the widget to my home screen";
 *   3. a graceful web-only mode: without Capacitor everything still works, the
 *      preferences are remembered in localStorage and the page shows the manual
 *      instructions instead of the one-tap button.
 *
 * Load after assets/pd-verse-data.js (the verse library) and before the page
 * script that uses it.
 */
(function (global) {
    'use strict';

    var VERSION = '1.0.0';
    var STORE_KEY = 'pd_verse_widget';
    var PLUGIN = 'VerseWidget';

    /* Four themes. The same four exist as drawables in the Android project
       (widget_verse_background*.xml) and as names in VerseWidgetStore.java, so a
       theme picked here renders identically on the phone. */
    var THEMES = [
        {
            id: 'midnight',
            name: 'Deep Navy',
            note: 'The Prayer Dome default — gold on midnight blue.',
            from: '#07244D',
            to: '#0A3D7A',
            border: 'rgba(212, 175, 55, 0.85)',
            borderSolid: '#D4AF37',
            verse: '#FFFFFF',
            reference: '#F6DF8A',
            greeting: '#D4AF37',
            brand: '#93C5FD'
        },
        {
            id: 'dome',
            name: 'Royal Dome',
            note: 'The ministry blue, for daytime reading.',
            from: '#0A3D7A',
            to: '#0A4D9B',
            border: 'rgba(246, 223, 138, 0.85)',
            borderSolid: '#F6DF8A',
            verse: '#FFFFFF',
            reference: '#F6DF8A',
            greeting: '#93C5FD',
            brand: 'rgba(255, 255, 255, 0.75)'
        },
        {
            id: 'dawn',
            name: 'Sunrise Gold',
            note: 'Warm and high contrast in bright sunlight.',
            from: '#FFE9B0',
            to: '#F6C453',
            border: 'rgba(166, 124, 0, 0.85)',
            borderSolid: '#A67C00',
            verse: '#0F172A',
            reference: '#7C2D12',
            greeting: '#92400E',
            brand: '#7C2D12'
        },
        {
            id: 'paper',
            name: 'Quiet Paper',
            note: 'A light card that stays readable over any wallpaper.',
            from: '#FFFFFF',
            to: '#F1F5F9',
            border: 'rgba(212, 175, 55, 0.85)',
            borderSolid: '#D4AF37',
            verse: '#0F172A',
            reference: '#0A4D9B',
            greeting: '#A67C00',
            brand: '#64748B'
        }
    ];

    /* The CSS gradient the preview uses, derived from the two canvas stops so
       the widget preview and the wallpaper can never drift apart. */
    THEMES.forEach(function (item) {
        item.background = 'linear-gradient(135deg, ' + item.from + ' 0%, ' + item.to + ' 100%)';
    });

    var DEFAULTS = {
        theme: 'midnight',
        textScale: 1,
        showGreeting: true,
        showReference: true,
        showBrand: true
    };

    /* --------------------------------------------------------------- helpers */
    function esc(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function readLocal() {
        var prefs = {};
        Object.keys(DEFAULTS).forEach(function (key) { prefs[key] = DEFAULTS[key]; });
        try {
            var raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
            if (raw && typeof raw === 'object') {
                if (theme(raw.theme)) prefs.theme = raw.theme;
                if (typeof raw.textScale === 'number') prefs.textScale = clampScale(raw.textScale);
                ['showGreeting', 'showReference', 'showBrand'].forEach(function (key) {
                    if (typeof raw[key] === 'boolean') prefs[key] = raw[key];
                });
            }
        } catch (error) { /* private mode */ }
        return prefs;
    }

    function writeLocal(prefs) {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(prefs)); } catch (error) { /* full */ }
        return prefs;
    }

    function clampScale(value) {
        var scale = Number(value);
        if (!isFinite(scale)) return 1;
        return Math.min(1.35, Math.max(0.85, Math.round(scale * 100) / 100));
    }

    function theme(id) {
        for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
        return THEMES[0];
    }

    function normalise(prefs) {
        var base = readLocal();
        if (prefs) {
            if (theme(prefs.theme)) base.theme = prefs.theme;
            if (typeof prefs.textScale === 'number') base.textScale = clampScale(prefs.textScale);
            ['showGreeting', 'showReference', 'showBrand'].forEach(function (key) {
                if (typeof prefs[key] === 'boolean') base[key] = prefs[key];
            });
        }
        return base;
    }

    /* ------------------------------------------------- native plugin access */
    function nativePlugin() {
        try {
            var cap = global.Capacitor;
            if (!cap) return null;
            if (cap.Plugins && cap.Plugins[PLUGIN]) return cap.Plugins[PLUGIN];
            if (typeof cap.registerPlugin === 'function') return cap.registerPlugin(PLUGIN);
        } catch (error) { /* not in the app */ }
        return null;
    }

    function available() {
        return !!nativePlugin();
    }

    /* --------------------------------------------------------- verse lookup */
    /** Today's verse for the slot we are in, from the shared verse library. */
    function todaysVerse(slotId) {
        var library = global.PD_VERSES;
        if (!library) {
            return { reference: 'John 3:16', text: 'For God so loved the world…', slot: 'morning', slotLabel: 'Daily Verse', greeting: 'Peace be with you' };
        }
        var slot = slotId || library.currentSlot();
        return library.verseFor(slot) || library.verseFor('morning');
    }

    /** Every verse in the library, once, with its slot — used by the pickers. */
    function allVerses() {
        var library = global.PD_VERSES;
        var list = [];
        if (!library) return list;
        library.SLOTS.forEach(function (slot) {
            (library.VERSES[slot.id] || []).forEach(function (verse) {
                list.push({
                    reference: verse.ref,
                    text: verse.text,
                    slot: slot.id,
                    slotLabel: slot.label,
                    greeting: slot.greeting,
                    translation: 'NIV'
                });
            });
        });
        return list;
    }

    function searchVerses(query) {
        var needle = String(query || '').trim().toLowerCase();
        var list = allVerses();
        if (!needle) return list;
        return list.filter(function (verse) {
            return verse.reference.toLowerCase().indexOf(needle) !== -1 ||
                verse.text.toLowerCase().indexOf(needle) !== -1;
        });
    }

    /* ------------------------------------------------------------- rendering */
    /**
     * Render the widget card into a host element.
     * The markup mirrors android/app/src/main/res/layout/verse_widget.xml: the
     * greeting line, the Scripture, the reference and the brand credit.
     */
    function renderCard(host, verse, prefs) {
        var el = typeof host === 'string' ? document.querySelector(host) : host;
        if (!el) return null;
        var settings = normalise(prefs);
        var palette = theme(settings.theme);
        var data = verse || todaysVerse();
        var scale = settings.textScale;

        el.className = 'pd-vw-card';
        el.setAttribute('style',
            'background:' + palette.background + ';' +
            'border:1.5px solid ' + palette.border + ';');
        el.innerHTML =
            (settings.showGreeting
                ? '<div class="pd-vw-greeting" style="color:' + palette.greeting + ';font-size:' + (11 * scale).toFixed(1) + 'px;">' +
                    esc(data.slotLabel === 'Pinned verse' ? 'Pinned verse' : (data.greeting || data.slotLabel)) + '</div>'
                : '') +
            '<div class="pd-vw-verse" style="color:' + palette.verse + ';font-size:' + (15 * scale).toFixed(1) + 'px;">' +
                esc(data.text) + '</div>' +
            (settings.showReference
                ? '<div class="pd-vw-ref" style="color:' + palette.reference + ';font-size:' + (12 * scale).toFixed(1) + 'px;">— ' +
                    esc(data.reference) + ' (NIV)</div>'
                : '') +
            (settings.showBrand
                ? '<div class="pd-vw-brand" style="color:' + palette.brand + ';font-size:' + (9 * scale).toFixed(1) + 'px;">' +
                    '<img src="/assets/logo-192.png" alt="" width="16" height="16"> PRAYER DOME · PRAYERDOME.NET</div>'
                : '');
        return el;
    }

    /* ------------------------------------------------------------ native API */
    function state() {
        var plugin = nativePlugin();
        if (!plugin || typeof plugin.getState !== 'function') {
            return Promise.resolve({
                available: false,
                placed: 0,
                canPin: false,
                verified: true,
                preferences: readLocal(),
                verse: todaysVerse()
            });
        }
        return Promise.resolve(plugin.getState()).catch(function () {
            return { available: false, placed: 0, canPin: false, verified: true, preferences: readLocal(), verse: todaysVerse() };
        });
    }

    function savePreferences(prefs) {
        var settings = writeLocal(normalise(prefs));
        var plugin = nativePlugin();
        if (plugin && typeof plugin.setPreferences === 'function') {
            return Promise.resolve(plugin.setPreferences(settings)).catch(function () { return { preferences: settings }; });
        }
        return Promise.resolve({ available: false, preferences: settings });
    }

    function pin(verse) {
        var payload = {
            reference: verse && (verse.reference || verse.ref) || '',
            text: verse && verse.text || '',
            label: verse && (verse.slotLabel || 'Pinned verse') || 'Pinned verse'
        };
        if (!payload.reference || !payload.text) {
            return Promise.reject(new Error('A pinned verse needs a reference and the Scripture text'));
        }
        var plugin = nativePlugin();
        if (plugin && typeof plugin.pinVerse === 'function') {
            return Promise.resolve(plugin.pinVerse(payload));
        }
        writeLocal(Object.assign(readLocal(), { pinned: payload }));
        return Promise.resolve({ available: false, pinned: payload });
    }

    function clearPin() {
        var plugin = nativePlugin();
        if (plugin && typeof plugin.clearPin === 'function') {
            return Promise.resolve(plugin.clearPin());
        }
        var prefs = readLocal();
        delete prefs.pinned;
        writeLocal(prefs);
        return Promise.resolve({ available: false });
    }

    function refresh() {
        var plugin = nativePlugin();
        if (plugin && typeof plugin.refresh === 'function') return Promise.resolve(plugin.refresh());
        return Promise.resolve({ available: false });
    }

    function requestPin() {
        var plugin = nativePlugin();
        if (plugin && typeof plugin.requestPin === 'function') {
            return Promise.resolve(plugin.requestPin()).catch(function () {
                return { requested: false, reason: 'error' };
            });
        }
        return Promise.resolve({ requested: false, reason: 'web' });
    }

    /** Where the member tapped in from — the widget opens /widgets.html. */
    function pendingRoute() {
        var plugin = nativePlugin();
        if (plugin && typeof plugin.pendingRoute === 'function') {
            return Promise.resolve(plugin.pendingRoute()).then(function (result) {
                return result && result.route ? result.route : '';
            }).catch(function () { return ''; });
        }
        return Promise.resolve('');
    }

    var API = {
        VERSION: VERSION,
        THEMES: THEMES,
        DEFAULTS: DEFAULTS,
        theme: theme,
        preferences: readLocal,
        savePreferences: savePreferences,
        available: available,
        state: state,
        pin: pin,
        clearPin: clearPin,
        refresh: refresh,
        requestPin: requestPin,
        pendingRoute: pendingRoute,
        todaysVerse: todaysVerse,
        allVerses: allVerses,
        searchVerses: searchVerses,
        renderCard: renderCard,
        clampScale: clampScale,
        escape: esc
    };

    /* When the widget was the way into the app, land on the verse studio. */
    if (available()) {
        pendingRoute().then(function (route) {
            if (route && typeof route === 'string' && route.indexOf('/') === 0 &&
                global.location && global.location.pathname !== route) {
                global.location.replace(route);
            }
        });
    }

    global.PDVerseWidget = API;
})(window);
