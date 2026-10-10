/*!
 * Prayer Dome — Cartoon Host Engine ("Domey")
 * ===========================================================================
 * A friendly cartoon character that greets members out loud, asks questions and
 * listens to the answers — so the app feels like a person is talking with you
 * rather than a form.
 *
 *   PDMascot.mount('#stage', { name: 'Domey' })   -> host
 *   await host.say('Hi! Welcome to Prayer Dome!');     // speaks + captions
 *   const a = await host.ask({ text: 'Who built the ark?', choices: [...] });
 *   await PDMascot.show(host, { rounds: 5, onScore: fn });   // the game show
 *   await PDMascot.lounge(host, { onPrayer: fn });           // live waiting room
 *
 * Design rules this file follows:
 *   • Works with zero network: the character is hand-drawn inline SVG, every
 *     sound is synthesised with WebAudio, nothing is downloaded at runtime.
 *   • Never assumes a microphone: answers can be spoken, tapped or typed, and
 *     every path is available at all times.
 *   • Never assumes autoplay: if the browser blocks speech until the member
 *     taps, the captions still play and a "tap to hear me" button appears.
 *   • Never traps the member: `stop()`, `destroy()` and leaving the page cancel
 *     speech, listening and every pending timer.
 *   • Accessible: captions are an aria-live region, every control is a real
 *     button with a label, and motion respects prefers-reduced-motion.
 */
(function (global) {
  'use strict';

  var CANCELLED = { cancelled: true };

  /* ---------------------------------------------------------------- utils */

  function esc(value) {
    var d = document.createElement('div');
    d.textContent = value == null ? '' : String(value);
    return d.innerHTML;
  }
  // Build a Lucide icon class list. The shared icon runtime resolves legacy
  // names and emoji too, so a saved/translated value always finds an icon.
  function iconClass(name, fallback) {
    if (global.PDIcons && typeof global.PDIcons.cls === 'function') {
      return global.PDIcons.cls(name, fallback || 'sparkles');
    }
    return ['pd-i', String(name || fallback || 'sparkles')].join(' ');
  }
  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }
  function norm(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[^a-z0-9'\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function shuffled(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function titleCase(value) {
    return String(value || '').replace(/\S+/g, function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    });
  }
  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  var ORDINALS = {
    first: 0, one: 0, won: 0, a: 0, '1': 0,
    second: 1, two: 1, to: 1, too: 1, b: 1, '2': 1,
    third: 2, three: 2, tree: 2, c: 2, '3': 2,
    fourth: 3, four: 3, d: 3, '4': 3,
    fifth: 4, five: 4, e: 4, '5': 4,
    sixth: 5, six: 5, f: 5, '6': 5,
    seventh: 6, seven: 6, g: 6, '7': 6,
    eighth: 7, eight: 7, h: 7, '8': 7
  };

  /* --------------------------------------------------------- the character */

  /* One character, drawn once, shared by every page.
   *
   * Everything is inline SVG and every gradient carries a per-mount id, so two
   * Domeys on one page (the game stage and a helper in the corner) never steal
   * each other's paint. Shape names are stable because the stylesheet drives
   * the expressions, the lip-sync visemes and the hand gestures from them.
   */
  function characterMarkup(id) {
    var robe = 'pdmRobe-' + id;
    var robeLight = 'pdmRobeLight-' + id;
    var skin = 'pdmSkin-' + id;
    var hair = 'pdmHair-' + id;
    var iris = 'pdmIris-' + id;
    var glow = 'pdmGlow-' + id;
    var book = 'pdmBook-' + id;
    return [
      '<svg class="pdm-char" viewBox="0 0 220 268" role="img" aria-label="Domey, the Prayer Dome cartoon host">',
      '<defs>',
      '<linearGradient id="' + robe + '" x1="0.15" y1="0" x2="0.85" y2="1">',
      '<stop offset="0" stop-color="#2180e2"/><stop offset="0.5" stop-color="#0d4f9e"/><stop offset="1" stop-color="#062a58"/>',
      '</linearGradient>',
      '<linearGradient id="' + robeLight + '" x1="0" y1="0" x2="1" y2="1">',
      '<stop offset="0" stop-color="#8fc6ff" stop-opacity="0.55"/><stop offset="1" stop-color="#8fc6ff" stop-opacity="0"/>',
      '</linearGradient>',
      '<linearGradient id="' + skin + '" x1="0.2" y1="0" x2="0.8" y2="1">',
      '<stop offset="0" stop-color="#fbd9b4"/><stop offset="0.62" stop-color="#f0c193"/><stop offset="1" stop-color="#dda878"/>',
      '</linearGradient>',
      '<linearGradient id="' + hair + '" x1="0" y1="0" x2="0.4" y2="1">',
      '<stop offset="0" stop-color="#4a3327"/><stop offset="1" stop-color="#211510"/>',
      '</linearGradient>',
      '<radialGradient id="' + iris + '" cx="0.4" cy="0.35" r="0.75">',
      '<stop offset="0" stop-color="#8a5f36"/><stop offset="0.7" stop-color="#4a2d18"/><stop offset="1" stop-color="#22140c"/>',
      '</radialGradient>',
      '<linearGradient id="' + book + '" x1="0" y1="0" x2="1" y2="1">',
      '<stop offset="0" stop-color="#8d3a33"/><stop offset="1" stop-color="#5d231f"/>',
      '</linearGradient>',
      '<radialGradient id="' + glow + '" cx="0.5" cy="0.5" r="0.5">',
      '<stop offset="0" stop-color="#f6df8a" stop-opacity="0.55"/><stop offset="1" stop-color="#f6df8a" stop-opacity="0"/>',
      '</radialGradient>',
      '</defs>',
      '<ellipse class="pdm-glow-pool" cx="110" cy="150" rx="86" ry="96" fill="url(#' + glow + ')"/>',
      '<ellipse class="pdm-shadow" cx="110" cy="252" rx="54" ry="10"/>',
      // ---- legs, shoes ----
      '<g class="pdm-legs">',
      '<rect class="pdm-leg" x="90" y="188" width="17" height="50" rx="8"/>',
      '<rect class="pdm-leg" x="113" y="188" width="17" height="50" rx="8"/>',
      '<ellipse class="pdm-shoe" cx="97" cy="243" rx="18" ry="10"/>',
      '<ellipse class="pdm-shoe" cx="123" cy="243" rx="18" ry="10"/>',
      '</g>',
      // ---- neck (behind the robe) ----
      '<path class="pdm-neck" d="M100 78 H120 V104 C120 110 100 110 100 104 Z" fill="url(#' + skin + ')"/>',
      '<path class="pdm-neck-shade" d="M100 92 C105 100 115 100 120 92 V100 C115 106 105 106 100 100 Z"/>',
      // ---- torso ----
      '<g class="pdm-torso">',
      '<path class="pdm-robe" d="M110 96 C86 96 73 112 71 140 L63 198 C62 206 68 211 76 211 L144 211 C152 211 158 206 157 198 L149 140 C147 112 134 96 110 96 Z" fill="url(#' + robe + ')"/>',
      '<path class="pdm-robe-light" d="M96 102 C86 118 82 142 82 166 C82 182 84 196 88 206 L82 206 C78 190 77 168 79 146 C80 128 86 112 96 102 Z" fill="url(#' + robeLight + ')"/>',
      '<path class="pdm-robe-fold" fill="none" d="M104 104 C100 138 99 174 101 208"/>',
      '<path class="pdm-robe-fold" fill="none" d="M128 106 C132 140 133 176 131 208"/>',
      '<path class="pdm-robe-hem" fill="none" d="M64 202 C88 208 132 208 156 202"/>',
      '<path class="pdm-robe-trim" fill="none" d="M110 96 C86 96 73 112 71 140 L63 198 C62 206 68 211 76 211 L144 211 C152 211 158 206 157 198 L149 140 C147 112 134 96 110 96 Z"/>',
      '<path class="pdm-sash" d="M73 146 C92 159 128 159 147 146 L147 157 C128 170 92 170 73 157 Z"/>',
      '<path class="pdm-sash-knot" d="M101 151 C105 147 115 147 119 151 L115 163 H105 Z"/>',
      '<path class="pdm-sash-tail" fill="none" d="M108 162 C104 170 102 178 102 186"/>',
      '<g class="pdm-emblem">',
      '<path d="M95 124 C95 112 102 106 110 106 C118 106 125 112 125 124"/>',
      '<path d="M92 124 H128"/>',
      '</g>',
        '</g>',
      // ---- arms, hands, and the props that make a gesture readable ----
      '<g class="pdm-arm pdm-arm-l">',
      '<path class="pdm-sleeve" d="M82 112 C66 126 59 148 63 168" fill="none" stroke="#0f5cae" stroke-width="17" stroke-linecap="round"/>',
      '<path class="pdm-sleeve-light" d="M80 110 C70 122 64 136 63 150" fill="none" stroke="#8fc6ff" stroke-width="3.5" stroke-linecap="round" opacity="0.45"/>',
      '<circle class="pdm-hand" cx="64" cy="172" r="12"/>',
      '<g class="pdm-fingers"><path class="pdm-finger" fill="none" d="M57 176 C59 181 64 182 69 179"/><path class="pdm-finger" fill="none" d="M56 171 C58 176 63 177 68 174"/></g>',
      // The hand microphone: hidden until Domey listens, then raised to his mouth.
      '<g class="pdm-prop pdm-prop-mic" transform="translate(10 -10) rotate(18 66 150)">',
      '<rect class="pdm-mic-stem" x="62" y="156" width="7" height="20" rx="3.5"/>',
      '<rect class="pdm-mic-body" x="56" y="126" width="20" height="34" rx="10" fill="#1b2740"/>',
      '<circle class="pdm-mic-grille" cx="66" cy="135" r="6"/>',
      '<path class="pdm-mic-band" fill="none" d="M56 148 H76"/>',
      '</g>',
      '</g>',
      '<g class="pdm-arm pdm-arm-r">',
      '<path class="pdm-sleeve" d="M138 112 C154 124 160 142 157 162" fill="none" stroke="#0f5cae" stroke-width="17" stroke-linecap="round"/>',
      '<path class="pdm-sleeve-light" d="M140 112 C150 122 156 134 157 148" fill="none" stroke="#8fc6ff" stroke-width="3" stroke-linecap="round" opacity="0.35"/>',
      '<circle class="pdm-hand" cx="156" cy="166" r="12"/>',
      '<g class="pdm-book" transform="rotate(10 156 168)">',
      '<rect class="pdm-book-cover" x="138" y="158" width="40" height="27" rx="5" fill="url(#' + book + ')"/>',
      '<rect class="pdm-book-page" x="141" y="161" width="34" height="21" rx="3"/>',
      '<path class="pdm-book-lines" fill="none" d="M147 168 H171 M147 173 H171"/>',
      '<path class="pdm-book-cross" fill="none" d="M156 163 V180 M148 170 H164"/>',
      '</g>',
      '</g>',
      '<g class="pdm-head">',
    '<ellipse class="pdm-ear" cx="66" cy="65" rx="8.5" ry="10.5"/>',
    '<ellipse class="pdm-ear" cx="154" cy="65" rx="8.5" ry="10.5"/>',
    '<ellipse class="pdm-face" cx="110" cy="62" rx="47" ry="49" fill="url(#' + skin + ')"/>',
    '<path class="pdm-face-side" fill="#dda878" opacity="0.12" d="M63 62 C63 88 84 111 110 111 C136 111 157 88 157 62 C157 84 138 104 110 104 C82 104 63 84 63 62 Z"/>',
    '<ellipse class="pdm-face-light" fill="#ffffff" cx="97" cy="42" rx="24" ry="16"/>',
    '<ellipse class="pdm-face-shade" fill="#b8804f" cx="110" cy="102" rx="26" ry="10"/>',
    '<g class="pdm-hair-group">',
    '<path class="pdm-hair" d="M63 62 C63 24 84 8 110 8 C136 8 157 24 157 62 C151 42 140 32 110 32 C80 32 69 42 63 62 Z" fill="url(#' + hair + ')"/>',
    '<path class="pdm-hair-lock" d="M100 14 C112 8 128 9 138 17 C128 15 118 15 100 14 Z" opacity="0.55"/>',
    '<path class="pdm-hair-lock" d="M74 40 C78 26 88 16 102 12 C90 20 82 30 78 44 Z" opacity="0.45"/>',
    '<path class="pdm-hair-lock" d="M63 62 C64 50 66 44 70 40 C68 48 67 54 67 62 Z" opacity="0.5"/>',
    '</g>',
    '<g class="pdm-brows">',
    '<path class="pdm-brow pdm-brow-l" fill="none" d="M83 47 C89 41 97 41 102 45"/>',
    '<path class="pdm-brow pdm-brow-r" fill="none" d="M118 45 C123 41 131 41 137 47"/>',
    '</g>',
    // nose (a tiny line and its shadow — enough to read as a face)
    '<path class="pdm-nose" fill="none" d="M110 68 C108 72 108 75 111 76"/>',
    '<path class="pdm-nose-shade" fill="none" d="M106 76 C108.5 78 112 78 114 76"/>',
    '<g class="pdm-eyes">',
    '<g class="pdm-eye pdm-eye-l">',
    '<ellipse class="pdm-eye-white" cx="90" cy="64" rx="12.5" ry="13.5"/>',
    '<g class="pdm-gaze">',
    '<ellipse class="pdm-iris" cx="91" cy="65" rx="7" ry="7" fill="url(#' + iris + ')"/>',
    '<circle class="pdm-pupil" cx="91" cy="65" r="3.4"/>',
    '<circle class="pdm-glint" cx="88.4" cy="61" r="2.3"/>',
    '<circle class="pdm-glint pdm-glint-sm" cx="93.4" cy="68.4" r="1.1"/>',
    '</g>',
    '<path class="pdm-lash" fill="none" d="M78.5 56 C82 51.5 88 49.5 94 51.5"/>',
    '<rect class="pdm-lid" x="77" y="49.5" width="26" height="27" rx="13"/>',
    '</g>',
    '<g class="pdm-eye pdm-eye-r">',
    '<ellipse class="pdm-eye-white" cx="130" cy="64" rx="12.5" ry="13.5"/>',
    '<g class="pdm-gaze">',
    '<ellipse class="pdm-iris" cx="131" cy="65" rx="7" ry="7" fill="url(#' + iris + ')"/>',
    '<circle class="pdm-pupil" cx="131" cy="65" r="3.4"/>',
    '<circle class="pdm-glint" cx="128.4" cy="61" r="2.3"/>',
    '<circle class="pdm-glint pdm-glint-sm" cx="133.4" cy="68.4" r="1.1"/>',
    '</g>',
    '<path class="pdm-lash" fill="none" d="M126 51.5 C132 49.5 138 51.5 141.5 56"/>',
    '<rect class="pdm-lid" x="117" y="49.5" width="26" height="27" rx="13"/>',
    '</g>',
    '</g>',
    '<ellipse class="pdm-cheek pdm-cheek-l" cx="73" cy="79" rx="11" ry="7"/>',
    '<ellipse class="pdm-cheek pdm-cheek-r" cx="147" cy="79" rx="11" ry="7"/>',
    // ---- expression mouths (one shape at a time, chosen by the mood) ----
    '<g class="pdm-mouths">',
    '<path class="pdm-mouth pdm-mouth-smile" fill="none" d="M96 82 C104 92 116 92 124 82"/>',
    '<ellipse class="pdm-mouth pdm-mouth-open pdm-mouth-fill" cx="110" cy="87" rx="11" ry="9"/>',
    '<path class="pdm-mouth pdm-mouth-think" fill="none" d="M100 88 C106 87 114 87 120 88"/>',
    '<path class="pdm-mouth pdm-mouth-pray" fill="none" d="M101 86 C105 82 115 82 119 86"/>',
    '</g>',
    // ---- speaking mouths: the viseme set the lip-sync engine plays ----
    '<g class="pdm-visemes">',
    '<g class="pdm-vis pdm-vis-rest"><path class="pdm-lip" fill="none" d="M97 84 C104 88 116 88 123 84"/></g>',
    '<g class="pdm-vis pdm-vis-M"><path class="pdm-lip-fill" d="M96.5 84 C102 81 118 81 123.5 84 C118 87.5 102 87.5 96.5 84 Z"/>',
    '<path class="pdm-lip" fill="none" d="M96.5 84 C102 86.5 118 86.5 123.5 84"/></g>',
    '<g class="pdm-vis pdm-vis-E"><path class="pdm-mouth-cavity" d="M96.5 83 C103 77.5 117 77.5 123.5 83 C117 92.5 103 92.5 96.5 83 Z"/>',
    '<path class="pdm-teeth" d="M99.5 80.5 H120.5 V85 H99.5 Z"/>',
    '<path class="pdm-tongue" d="M104 89 C107 92 113 92 116 89 C113 88 107 88 104 89 Z"/></g>',
    '<g class="pdm-vis pdm-vis-I"><ellipse class="pdm-mouth-cavity" cx="110" cy="84.5" rx="13" ry="5.6"/>',
    '<path class="pdm-teeth" d="M99 81.5 H121 V84.5 H99 Z"/></g>',
    '<g class="pdm-vis pdm-vis-A"><ellipse class="pdm-mouth-cavity" cx="110" cy="85.5" rx="11" ry="11"/>',
    '<path class="pdm-teeth" d="M101 76 H119 V81.5 H101 Z"/>',
    '<ellipse class="pdm-tongue" cx="110" cy="93" rx="7" ry="4.2"/></g>',
    '<g class="pdm-vis pdm-vis-O"><ellipse class="pdm-mouth-cavity" cx="110" cy="84.5" rx="8" ry="9.6"/>',
    '<ellipse class="pdm-tongue" cx="110" cy="90.5" rx="5.4" ry="3.4"/></g>',
    '<g class="pdm-vis pdm-vis-U"><ellipse class="pdm-mouth-cavity" cx="110" cy="84.5" rx="6" ry="7.2"/>',
    '<ellipse class="pdm-tongue" cx="110" cy="88.5" rx="4" ry="2.6"/></g>',
    '<g class="pdm-vis pdm-vis-F"><path class="pdm-mouth-cavity" d="M99 82 C104 80 116 80 121 82 C118 88 102 88 99 82 Z"/>',
    '<path class="pdm-teeth" d="M100 81 H120 V84.5 H100 Z"/></g>',
    '<g class="pdm-vis pdm-vis-L"><ellipse class="pdm-mouth-cavity" cx="110" cy="85" rx="10" ry="6.4"/>',
    '<path class="pdm-teeth" d="M101 81 H119 V84 H101 Z"/></g>',
    '</g>',
    '</g>',
    '<g class="pdm-sparkle-group">',
    '<path class="pdm-sparkle" d="M40 44 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z"/>',
    '<path class="pdm-sparkle" d="M182 62 l2.5 7 7 2.5 -7 2.5 -2.5 7 -2.5 -7 -7 -2.5 7 -2.5 z"/>',
    '<path class="pdm-sparkle" d="M30 168 l2.5 7 7 2.5 -7 2.5 -2.5 7 -2.5 -7 -7 -2.5 7 -2.5 z"/>',
    '<path class="pdm-sparkle" d="M188 170 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z"/>',
    '</g>',
      '</svg>'
    ].join('');
  }

  /* ------------------------------------------------------------ the voice */

  var VOICE_PRIORITY = [
    'google uk english female', 'google uk english male',
    'google us english', 'microsoft aria', 'microsoft jenny', 'microsoft guy',
    'microsoft libby', 'microsoft sonia', 'samantha', 'karen', 'moira', 'tessa',
    'daniel', 'alex', 'rishi', 'serena'
  ];

  function Voice() {
    this.supported = typeof global.speechSynthesis !== 'undefined' &&
      typeof global.SpeechSynthesisUtterance !== 'undefined';
    this.voices = [];
    this.selected = null;
    this.lang = 'en';
    this._bound = false;
    // Chrome / Edge load the voice list asynchronously — a pick made before
    // the list arrives would drop back to the robotic default voice forever.
    if (this.supported && typeof global.speechSynthesis.addEventListener === 'function') {
      try {
        global.speechSynthesis.addEventListener('voiceschanged', function () { this.selected = null; }.bind(this));
      } catch (e) { /* older browsers ignore it */ }
    }
  }

  Voice.prototype.list = function (lang) {
    if (!this.supported) return [];
    var voices = [];
    try { voices = global.speechSynthesis.getVoices() || []; } catch (e) { voices = []; }
    this.voices = voices;
    if (!voices.length) return [];
    var want = String(lang || this.lang || 'en').slice(0, 2).toLowerCase();
    var matching = voices.filter(function (v) { return String(v.lang || '').toLowerCase().indexOf(want) === 0; });
    if (!matching.length) matching = voices.filter(function (v) { return /^en/i.test(v.lang || ''); });
    return matching.length ? matching : voices;
  };

  Voice.prototype.pick = function (lang) {
    if (!this.supported) return null;
    if (this.selected && this.selected.lang) return this.selected;
    var candidates = this.list(lang);
    if (!candidates.length) return null;
    var best = null, bestScore = -1;
    for (var i = 0; i < candidates.length; i++) {
      var v = candidates[i];
      var name = String(v.name || '').toLowerCase();
      var score = 0;
      var rank = VOICE_PRIORITY.indexOf(name);
      if (rank !== -1) score += 60 - rank * 2;
      if (/google/.test(name)) score += 22;
      if (/microsoft/.test(name)) score += 16;
      if (/natural|neural|enhanced|premium/.test(name)) score += 18;
      if (/female|woman|aria|jenny|sonia|libby|samantha|karen|moira|tessa|serena|zira|amy/.test(name)) score += 10;
      if (v.localService) score += 4;
      if (v.default) score += 3;
      if (score > bestScore) { bestScore = score; best = v; }
    }
    this.selected = best;
    return best;
  };

  /** One canonical form of a line, shared by captions, lip-sync and the voice. */
  function cleanSpeech(text) {
    return String(text == null ? '' : text).replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Which printed word contains this character offset (speech boundary → lips). */
  function wordIndexAt(text, charIndex) {
    var words = String(text).split(' ').filter(Boolean);
    var cursor = 0;
    for (var i = 0; i < words.length; i++) {
      var start = String(text).indexOf(words[i], cursor);
      var end = start + words[i].length;
      if (charIndex < end) return i;
      cursor = end;
    }
    return Math.max(0, words.length - 1);
  }

  Voice.prototype.speak = function (text, opts) {
    var self = this;
    opts = opts || {};
    var clean = cleanSpeech(text);
    if (!clean) return Promise.resolve({ spoken: false, blocked: false, reason: 'empty' });
    if (!this.supported) return Promise.resolve({ spoken: false, blocked: false, reason: 'unsupported' });
    return new Promise(function (resolve) {
      var finished = false;
      var started = false;
      var utterance;
      try {
        utterance = new global.SpeechSynthesisUtterance(clean);
      } catch (e) {
        resolve({ spoken: false, blocked: false, reason: 'unsupported' });
        return;
      }
      var voice = self.pick(opts.lang || self.lang);
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
      else { utterance.lang = (opts.lang || self.lang || 'en'); }
      utterance.rate = opts.rate || 0.98;
      utterance.pitch = opts.pitch || 1.06;
      utterance.volume = opts.volume == null ? 1 : opts.volume;

      var guard, safety, keepAlive;
      function finish(spoken, blocked, reason) {
        if (finished) return;
        finished = true;
        clearTimeout(guard);
        clearTimeout(safety);
        clearInterval(keepAlive);
        resolve({ spoken: spoken, blocked: !!blocked, reason: reason || '' });
      }
      utterance.onstart = function () {
        started = true;
        if (opts.onStart) { try { opts.onStart(); } catch (e) {} }
        // Chrome silently stops long utterances after ~15 seconds of speech.
        // Nudging the engine keeps a spoken prayer going to its amen.
        keepAlive = setInterval(function () {
          if (finished) { clearInterval(keepAlive); return; }
          try {
            if (global.speechSynthesis.speaking && !global.speechSynthesis.paused) {
              global.speechSynthesis.pause();
              global.speechSynthesis.resume();
            }
          } catch (e) { /* engine does not support pausing */ }
        }, 9000);
      };
      // Word boundaries are what make the mouth really match the voice: the
      // engine says "this word starts here" and the lip-sync jumps to it.
      utterance.onboundary = function (event) {
        if (!opts.onWord) return;
        var name = event && event.name;
        if (name && name !== 'word') return;
        try { opts.onWord(wordIndexAt(clean, event.charIndex || 0), event.charIndex || 0); } catch (e) {}
      };
      utterance.onend = function () { finish(true, false, 'ended'); };
      utterance.onerror = function () { finish(false, false, 'error'); };
      // Some browsers silently never start an utterance that was not triggered
      // by a user gesture. Detect that instead of waiting forever.
      guard = setTimeout(function () { if (!started) finish(false, true, 'blocked'); }, 1500);
      safety = setTimeout(function () { finish(started, false, 'timeout'); }, Math.max(5000, clean.length * 90 + 4000));

      try { global.speechSynthesis.cancel(); } catch (e) {}
      try { global.speechSynthesis.speak(utterance); }
      catch (e) { finish(false, false, 'error'); }
    });
  };

  Voice.prototype.stop = function () {
    if (!this.supported) return;
    try { global.speechSynthesis.cancel(); } catch (e) {}
  };

  /* ------------------------------------------------------------ the ears */

  function Ears(lang) {
    var Ctor = global.SpeechRecognition || global.webkitSpeechRecognition || null;
    this.Ctor = Ctor;
    this.supported = !!Ctor;
    this.lang = lang || 'en';
    this.current = null;
    this.permission = 'unknown';
  }

  /**
   * One utterance from the member, resolved as { text, reason }.
   *
   * Two modes, because the two moments are different:
   *   • short answers (a name, a quiz choice) end as soon as the browser
   *     delivers a final result — quick and snappy;
   *   • a prayer request is a full sentence, so `continuous` keeps the ears
   *     open and closes them a moment after the member stops talking.
   *
   * Interim words are never thrown away: a member whose browser ends the
   * session before finalising the last word still gets understood.
   */
  Ears.prototype.listenOnce = function (opts) {
    var self = this;
    opts = opts || {};
    if (!this.supported) return Promise.resolve({ text: '', reason: 'unsupported' });
    return new Promise(function (resolve) {
      var settled = false;
      var heard = '';
      var interim = '';
      var silence = null;
      var recognition;
      try {
        recognition = new self.Ctor();
      } catch (e) {
        resolve({ text: '', reason: 'unsupported' });
        return;
      }
      recognition.lang = opts.lang || self.lang || 'en';
      recognition.continuous = !!opts.continuous;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      self.current = recognition;

      var timeout = setTimeout(function () { done('timeout'); }, opts.timeout || 12000);

      function done(reason, finalText) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (silence) clearTimeout(silence);
        try { recognition.abort(); } catch (e) {}
        if (self.current === recognition) self.current = null;
        var text = String(finalText != null ? finalText : (heard || interim)).trim();
        resolve({ text: text, reason: text ? (reason === 'silent' ? 'heard' : reason) : reason });
      }

      // A member who pauses mid-sentence must not be cut off, but the host
      // also cannot wait for ever: close the ears shortly after real speech
      // stops arriving.
      function armSilence() {
        if (!opts.continuous) return;
        if (silence) clearTimeout(silence);
        silence = setTimeout(function () { done(heard ? 'heard' : 'silent', heard); }, opts.silence || 1400);
      }

      recognition.onresult = function (event) {
        interim = '';
        for (var i = event.resultIndex; i < event.results.length; i++) {
          var result = event.results[i];
          var text = result[0] ? result[0].transcript : '';
          if (result.isFinal) { heard = heard ? heard + ' ' + text : text; }
          else if (opts.continuous) { interim = interim ? interim + ' ' + text : text; }
        }
        if (opts.onInterim) { try { opts.onInterim((interim || heard).trim()); } catch (e) {} }
        if (opts.continuous) {
          if (heard && !interim) armSilence();
          else if (interim && silence) clearTimeout(silence);
          return;
        }
        if (heard) done('heard', heard);
      };
      recognition.onerror = function (event) {
        var code = (event && event.error) || 'error';
        if (code === 'not-allowed' || code === 'service-not-allowed') self.permission = 'denied';
        done(code === 'no-speech' ? 'silent' : code);
      };
      recognition.onend = function () { done(heard ? 'heard' : 'silent', heard || interim); };

      try {
        recognition.start();
        self.permission = 'granted';
      } catch (e) {
        done('error');
      }
      self.cancel = function () { done('cancelled'); };
    });
  };

  Ears.prototype.stop = function () {
    if (this.current) { try { this.current.abort(); } catch (e) {} this.current = null; }
  };

  /**
   * Ask the browser for the microphone while a real tap is still "fresh".
   *
   * Chrome and Safari only raise the permission prompt from a user gesture, so
   * the moment the member taps "Start the show" is the one good chance to get
   * the ears open. Anything the engine may catch during this 1.2s warm-up is
   * thrown away — the host is still greeting, nothing is being answered yet.
   */
  Ears.prototype.warmUp = function () {
    var self = this;
    if (!this.supported) return Promise.resolve('unsupported');
    if (this.permission === 'denied') return Promise.resolve('denied');
    if (this._warming) return this._warming;
    this._warming = this.listenOnce({ timeout: 1200 }).then(function (result) {
      self._warming = null;
      if (self.permission !== 'denied') self.permission = 'granted';
      return self.permission;
    }, function () {
      self._warming = null;
      return self.permission;
    });
    return this._warming;
  };

  /* ------------------------------------------------------------- the band */

  /* Every cue is synthesised on the spot — there is not one audio file in the
     whole character, so Domey is just as lively on a cold start, offline, in
     the Android WebView, and on a slow phone. */
  var Band = {
    ctx: null,
    muted: false,
    context: function () {
      if (this.ctx) return this.ctx;
      var Ctor = global.AudioContext || global.webkitAudioContext;
      if (!Ctor) return null;
      try { this.ctx = new Ctor(); } catch (e) { this.ctx = null; }
      return this.ctx;
    },
    tone: function (freq, start, duration, gain, type) {
      var ctx = this.context();
      if (!ctx || this.muted) return;
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      var osc = ctx.createOscillator();
      var amp = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      var t0 = ctx.currentTime + (start || 0);
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(gain || 0.06, t0 + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + (duration || 0.18));
      osc.connect(amp).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + (duration || 0.18) + 0.03);
    },
    /* Claps and applause are shaped noise, not tones — a short burst of it
       reads instantly as an audience celebrating with the member. */
    noise: function (start, duration, gain, tail) {
      var ctx = this.context();
      if (!ctx || this.muted) return;
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      var frames = Math.max(1, Math.floor(ctx.sampleRate * (duration + (tail || 0))));
      var buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < frames; i++) {
        var decay = Math.max(0, 1 - (i / (ctx.sampleRate * (duration || 0.2))));
        data[i] = (Math.random() * 2 - 1) * decay * decay;
      }
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      var filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1500;
      var amp = ctx.createGain();
      amp.gain.value = gain || 0.09;
      src.connect(filter).connect(amp).connect(ctx.destination);
      src.start(ctx.currentTime + (start || 0));
    },
    clap: function (start) {
      this.noise(start, 0.05, 0.05);
      this.noise((start || 0) + 0.12, 0.05, 0.04);
    },
    play: function (name) {
      if (this.muted) return;
      switch (name) {
        case 'correct': this.tone(660, 0, 0.16); this.tone(880, 0.14, 0.22); break;
        case 'wrong': this.tone(320, 0, 0.22, 0.05); this.tone(240, 0.16, 0.26, 0.045); break;
        case 'listen': this.tone(520, 0, 0.1, 0.04); this.tone(720, 0.1, 0.12, 0.04); break;
        case 'start': this.tone(523, 0, 0.14); this.tone(659, 0.12, 0.14); this.tone(784, 0.24, 0.24); break;
        case 'celebrate': this.tone(523, 0, 0.14); this.tone(659, 0.11, 0.14); this.tone(784, 0.22, 0.14); this.tone(1047, 0.33, 0.32); break;
        case 'pop': this.tone(880, 0, 0.08, 0.05); break;
        case 'ding': this.tone(1320, 0, 0.18, 0.05); this.tone(1760, 0.06, 0.2, 0.035); break;
        case 'whoosh': this.noise(0, 0.22, 0.04, 0.06); break;
        case 'boing': this.tone(180, 0, 0.18, 0.05, 'triangle'); this.tone(260, 0.1, 0.22, 0.045, 'triangle'); break;
        case 'applause': this.noise(0, 0.9, 0.05, 0.5); this.clap(0.05); this.clap(0.4); this.clap(0.7); break;
        case 'fanfare':
          this.tone(523, 0, 0.18); this.tone(659, 0.14, 0.18); this.tone(784, 0.28, 0.2);
          this.tone(1047, 0.44, 0.5); this.tone(784, 0.44, 0.3, 0.04); break;
        case 'dance':
          this.tone(523, 0, 0.12, 0.05); this.tone(659, 0.12, 0.12, 0.05); this.tone(784, 0.24, 0.12, 0.05);
          this.tone(880, 0.36, 0.16, 0.05); this.tone(784, 0.54, 0.12, 0.05); this.tone(659, 0.66, 0.2, 0.05); break;
        case 'tick': this.tone(1200, 0, 0.05, 0.03, 'square'); break;
        case 'sad': this.tone(392, 0, 0.24, 0.05); this.tone(330, 0.2, 0.34, 0.045); break;
        default: this.tone(600, 0, 0.1, 0.04);
      }
    },
    unlock: function () { var ctx = this.context(); if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} } }
  };

  /* ------------------------------------------------------- the lip-sync ear */

  /* Domey's mouth is not one shape that flaps: it is a small set of mouth
     postures — the same idea as the visemes a real animator uses — and the
     engine below walks through them as the sentence is spoken.
       M  lips together (m, b, p)          F  teeth on lip (f, v)
       E  relaxed open (e, s, c)           I  wide smile-open (i, y, k)
       A  big open (a, h)                  O  round (o, w)
       U  small round (u, r, q)            L  tongue-tip (l, n, d, t)         */
  var VISEME_MS = { M: 88, F: 84, E: 82, I: 88, A: 112, O: 108, U: 100, L: 74, rest: 130 };

  function visemeFor(ch) {
    if ('mbp'.indexOf(ch) > -1) return 'M';
    if (ch === 'f' || ch === 'v') return 'F';
    if (ch === 'o' || ch === 'w') return 'O';
    if (ch === 'u' || ch === 'q' || ch === 'r') return 'U';
    if (ch === 'i' || ch === 'j' || ch === 'y') return 'I';
    if (ch === 'a') return 'A';
    if (ch === 'h') return 'A';
    if (ch === 'e') return 'E';
    if ('lntd'.indexOf(ch) > -1) return 'L';
    if ('szckgx'.indexOf(ch) > -1) return 'I';
    if (ch === ' ') return 'rest';
    return 'E';
  }

  /**
   * Turn one line of speech into a mouth plan: one entry per printed word, each
   * with the postures that word needs and how long each is held. The words are
   * kept exactly as the captions print them, so lips, captions and voice all
   * march in step.
   */
  function speechPlan(text, rate) {
    var pace = Math.max(0.62, Math.min(1.7, 1 / (rate || 1)));
    return String(text == null ? '' : text).replace(/\s+/g, ' ').trim()
      .split(' ').filter(Boolean).map(function (word) {
        var letters = word.toLowerCase().replace(/[^a-z0-9']/g, '');
        var frames = [];
        for (var i = 0; i < letters.length; i++) {
          var v = visemeFor(letters[i]);
          var last = frames[frames.length - 1];
          if (last && last.v === v) { last.ms += 24; continue; }
          frames.push({ v: v, ms: Math.round((VISEME_MS[v] || 86) * pace) });
        }
        if (!frames.length) frames.push({ v: 'rest', ms: 110 });
        var total = frames.reduce(function (n, f) { return n + f.ms; }, 0);
        return { word: word, frames: frames, ms: total };
      });
  }

  function MouthMotor(host) {
    this.host = host;
    this.plan = null;
    this.timer = null;
    this.wi = 0;
    this.fi = 0;
    this.done = true;
    this.onWord = null;
  }
  /** Move the lips: `data-pdm-vis` is what tells the stylesheet which mouth
   *  posture to show, and the jaw amount is how far open it sits. */
  MouthMotor.prototype.set = function (viseme, jaw) {
    var root = this.host.root;
    if (!root) return;
    root.setAttribute('data-pdm-vis', viseme || 'rest');
    root.style.setProperty('--pdm-jaw', String(jaw == null ? 0.4 : jaw));
  };
  /** Hand the mouth back to the expression layer (the smile, the pout…). */
  MouthMotor.prototype.release = function () {
    var root = this.host.root;
    if (!root) return;
    root.removeAttribute('data-pdm-vis');
    root.style.setProperty('--pdm-jaw', '0');
  };
  MouthMotor.prototype.start = function (plan) {
    this.stop(false);
    this.plan = plan && plan.length ? plan : null;
    this.wi = 0;
    this.fi = 0;
    this.done = !this.plan;
    if (this.done) { this.set('rest', 0.1); return this; }
    if (this.onWord) this.onWord(0);
    this.tick();
    return this;
  };
  MouthMotor.prototype.tick = function () {
    var self = this;
    if (this.done || !this.plan || this.host.destroyed) return;
    var word = this.plan[this.wi];
    if (!word) { this.finish(); return; }
    var frame = word.frames[this.fi] || { v: 'rest', ms: 90 };
    this.set(frame.v, frame.v === 'A' ? 0.95 : frame.v === 'rest' ? 0.1 : frame.v === 'O' || frame.v === 'U' ? 0.7 : 0.5);
    // The motor clears this timer itself (start/stop/hurry all go through it),
    // so it is deliberately not pushed onto the host's timer list.
    this.timer = setTimeout(function () { self.advance(); }, frame.ms);
  };
  MouthMotor.prototype.advance = function () {
    if (this.done || !this.plan) return;
    var word = this.plan[this.wi];
    this.fi++;
    if (word && this.fi >= word.frames.length) {
      this.wi++;
      this.fi = 0;
      if (this.wi >= this.plan.length) { this.finish(); return; }
      if (this.onWord) this.onWord(this.wi);
    }
    this.tick();
  };
  /**
   * The speech engine reports which word it is pronouncing. Jumping the mouth
   * there is what turns a guessed flap into real lip-sync: on a device that
   * reports boundaries, the lips follow the voice instead of a timer.
   */
  MouthMotor.prototype.jumpToWord = function (index) {
    if (this.done || !this.plan || index == null) return;
    if (index <= this.wi || index >= this.plan.length) return;
    this.wi = index;
    this.fi = 0;
    if (this.onWord) this.onWord(index);
    this.tick();
  };
  MouthMotor.prototype.finish = function () {
    this.done = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.release();
  };
  MouthMotor.prototype.stop = function (reset) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.plan = null;
    this.done = true;
    if (reset !== false) this.release();
  };

  /* ---------------------------------------------------------- the gestures */

  /* Short, readable actions Domey plays with his hands, head and body. Every
     one of them is a class on the root, so the stylesheet owns the performance
     and `prefers-reduced-motion` can simply stop it. */
  var TALK_GESTURES = ['open', 'point', 'count', 'raise', 'wave', 'thumb', 'shrug', 'offer'];
  var ALL_GESTURES = TALK_GESTURES.concat(['clap', 'heart', 'think', 'mic', 'dance', 'jump']);

  /* ---------------------------------------------------- the notification-y bits */

  var REACTIONS = {
    sparkle: 'pd-i-sparkles',
    star: 'pd-i-star',
    heart: 'pd-i-heart',
    cheer: 'pd-i-party-popper',
    zap: 'pd-i-zap',
    hand: 'pd-i-hand'
  };

  /* ----------------------------------------------------------- the matcher */

  // Turn a spoken sentence into an answer:
  //   "the first one"            -> { index: 0 }
  //   "noah"                     -> { index: 1 } when a choice matches
  //   "I think it is Moses"      -> { index: 0 }
  /* Spoken answers arrive as words, printed answers arrive as digits: "forty"
     has to be understood as 40, and "seven" as 7, or a member who speaks the
     right answer is marked wrong. */
  var NUMBER_WORDS = {
    zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6',
    seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
    twenty: '20', thirty: '30', forty: '40', fourty: '40', fifty: '50',
    sixty: '60', seventy: '70', eighty: '80', ninety: '90', hundred: '100',
    thousand: '1000'
  };
  function withNumbers(text) {
    var words = String(text || '').split(' ').filter(Boolean);
    var out = [];
    for (var i = 0; i < words.length; i++) {
      var digits = NUMBER_WORDS[words[i]];
      if (digits == null) { out.push(words[i]); continue; }
      var next = words[i + 1] ? NUMBER_WORDS[words[i + 1]] : null;
      // "twenty two" is 22, not 20 then 2.
      if (next != null && Number(next) >= 1 && Number(next) <= 9 && digits.length === 2 && digits[1] === '0') {
        out.push(String(Number(digits) + Number(next)));
        i++;
        continue;
      }
      out.push(digits);
    }
    return out.join(' ');
  }

  function matchChoices(transcript, choices) {
    var text = withNumbers(norm(transcript));
    if (!text || !choices || !choices.length) return { index: null, score: 0 };
    var words = text.split(' ').filter(Boolean);
    var best = { index: null, score: 0 };

    // Explicit ordinal or letter: "b", "second", "number three"
    for (var w = 0; w < words.length; w++) {
      var word = words[w];
      if (Object.prototype.hasOwnProperty.call(ORDINALS, word)) {
        var idx = ORDINALS[word];
        if (idx < choices.length && (words.length <= 4 || /^(the|option|answer|number|is|it|its|it's|letter)$/i.test(words[w - 1] || '') || word.length > 1)) {
          return { index: idx, score: 1 };
        }
      }
    }

    for (var i = 0; i < choices.length; i++) {
      var choice = withNumbers(norm(choices[i]));
      if (!choice) continue;
      if (choice === text) return { index: i, score: 1 };
      if (text.indexOf(choice) !== -1 || choice.indexOf(text) !== -1) {
        var lenScore = Math.min(choice.length, text.length) / Math.max(choice.length, text.length);
        if (0.4 + lenScore > best.score) best = { index: i, score: 0.72 + lenScore * 0.2 };
        continue;
      }
      var choiceWords = choice.split(' ').filter(Boolean);
      var overlap = 0;
      for (var c = 0; c < choiceWords.length; c++) {
        for (var t = 0; t < words.length; t++) {
          if (choiceWords[c] === words[t] || (choiceWords[c].length > 4 && words[t].indexOf(choiceWords[c]) === 0)) { overlap++; break; }
        }
      }
      var score = overlap / Math.max(choiceWords.length, 1);
      if (score > best.score) best = { index: i, score: score };
    }
    return best.score >= 0.5 ? best : { index: null, score: best.score };
  }

  // Words that mean the member did not give a name (a spoken sentence, a
  // refusal, a question) — "I'd rather not say" must never become "Rather Not".
  var NOT_A_NAME = /^(not|no|nope|none|never|nothing|nobody|dont|don't|cant|can't|wont|won't|wouldnt|wouldn't|sorry|maybe|rather|tell|telling|say|saying|speak|speaking|know|remember|forget|why|what|who|how|is|are|was|am|you|it|that|this|there|here)$/i;

  function cleanName(spoken, fallback) {
    var text = String(spoken || '').trim().replace(/[.!,?]+$/, '');
    text = text.replace(/^(my name is|i am|i'm|im|it's|its|call me|this is|they call me)\s+/i, '');
    var words = text.split(/\s+/).filter(Boolean);
    if (!words.length) return fallback || '';
    var candidates = words.slice(0, 3);
    if (candidates.some(function (word) { return NOT_A_NAME.test(word); })) return fallback || '';
    var name = words.slice(0, 2).join(' ').replace(/[^A-Za-z' -]/g, '').trim();
    if (!name || name.length < 2) return fallback || '';
    if (/^(what|who|how|why|no|yes|ok|okay|hi|hello)$/i.test(name)) return fallback || '';
    return titleCase(name);
  }

  /* ------------------------------------------------------------- the host */

  var DEFAULT_OPTIONS = {
    name: 'Domey',
    role: 'Prayer Dome Prayer Buddy',
    lang: 'en',
    muted: false,
    voiceEnabled: true,
    compact: false,
    rate: 0.98,
    pitch: 1.06,
    placeholder: 'Type your answer…',
    captionsOnly: false,
    // Lip-sync and the little hand actions; both are pure decoration, so a page
    // that wants a calm Domey can simply switch them off.
    lipSync: true,
    actions: true,
    // Which character: 'auto' uses the three-dimensional Domey
    // (/assets/pd-domey3d.js) as soon as that module and WebGL are ready and
    // falls back to the inline SVG otherwise; 'svg' always keeps the drawing.
    render: 'auto'
  };

  function Host(target, options) {
    var node = typeof target === 'string' ? document.querySelector(target) : target;
    if (!node) throw new Error('PDMascot.mount: host element not found');
    this.root = node;
    this.options = Object.assign({}, DEFAULT_OPTIONS, options || {});
    // Respect the member's earlier choice about Domey's voice.
    if (!options || options.muted == null) {
      try {
        if (global.localStorage.getItem('pd-domey-muted') === '1') this.options.muted = true;
      } catch (e) { /* private mode */ }
    }
    this.muted = !!this.options.muted;
    Band.muted = this.muted;
    try { this.name = global.localStorage.getItem('pd_domey_name') || ''; } catch (e) { this.name = ''; }
    this.id = 'pdm-' + Math.random().toString(36).slice(2, 8);
    this.voice = new Voice();
    this.ears = new Ears(this.options.lang);
    this.listeners = {};
    this.state = 'idle';
    this.question = null;
    this.answerResolve = null;
    this.timers = [];
    this._pendingWaits = [];
    this.destroyed = false;
    this.speechBlocked = false;
    this.lastSpoken = '';
    this.name = '';
    this.history = [];
    this._stateTimer = null;
    this._actTimer = null;
    this._gazeFrame = null;
    this._gaze = null;
    this.mouth = new MouthMotor(this);
    this.mouthOn = !this.options.captionsOnly && this.options.lipSync !== false;
    this.actionsOn = this.options.actions !== false;
    this.renderer3d = null;
    this._build();
    this._bindGaze();
    this._bindRender3D();
  }

  /**
   * Upgrade the character to the 3D renderer when the page loaded it.
   *
   * The 2D drawing is always built first, so the stage is never empty: the
   * three-dimensional Domey simply takes over when /assets/pd-domey3d.js (and
   * the vendored three.js module it imports) are ready and WebGL is available.
   * Nothing else about the host changes — the same root element carries the
   * same `data-pdm-vis`, `data-pdm-act`, `data-pdm-state` and gaze signals, so
   * captions, lip-sync, gestures, listening and the scoreboard all keep working.
   */
  Host.prototype._bindRender3D = function () {
    var self = this;
    if (this.options.render === 'svg') return;
    var engine = global.PDDomey3D;
    if (!engine || typeof engine.create !== 'function') return;
    // Already loaded (a page that puts pd-domey3d.js before pd-mascot.js):
    // upgrade on the next tick so the caller can finish mount() first.
    if (engine.three && engine.three()) {
      this._later(function () { self.use3D(); }, 0);
      return;
    }
    if (typeof engine.ready !== 'function') return;
    engine.ready().then(function () {
      if (self.destroyed) return;
      self.use3D();
    }).catch(function (error) {
      // No 3D on this device: the drawing stays, and the show goes on.
      console.warn('[PDMascot] 3D character unavailable, keeping the drawing', error);
    });
  };

  /**
   * Swap the drawing for the 3D character. Returns the renderer, or null when
   * there is nothing to swap (no module, no WebGL, already upgraded).
   *
   * When the page ships the realistic head (pd-domey-scan.js), that head is used
   * first. If the model cannot load, the cartoon rig is used instead, and if
   * that fails too the drawing stays. Nothing is left on a permanent loader.
   */
  Host.prototype.use3D = function (opts) {
    var self = this;
    if (this.renderer3d || this.destroyed || this.options.render === 'svg') return this.renderer3d;
    var engine = global.PDDomey3D;
    if (!engine || typeof engine.create !== 'function' || !engine.available()) return null;
    opts = opts || {};
    var human = global.PDDomeyHuman;
    if (human && !opts.cartoon && !opts.asset && typeof human.load === 'function' && engine.three && engine.three()) {
      var THREE = engine.three();
      // Low-end Android keeps the light 2D drawing: the stylised human is not
      // loaded there, so the page stays responsive.
      if (human.isLowEnd()) {
        this.root.setAttribute('data-pdm-model', '2d-low-end');
        this.emit('renderer', 'svg');
        return null;
      }
      // The 2D drawing is already on stage, so a slow or failed download never
      // leaves a blank or permanently loading character.
      this.root.setAttribute('data-pdm-model', 'loading');
      human.load(THREE).then(function (asset) {
        if (self.destroyed || self.renderer3d) return;
        self._mount3D(engine, { asset: asset, three: THREE, human: true });
      }).catch(function (error) {
        console.warn('[PDMascot] stylised character unavailable, keeping the drawing', error && error.message);
        if (!self.destroyed) {
          self.root.setAttribute('data-pdm-model', 'error');
          self.emit('renderer', 'svg');
        }
      });
      return null;
    }
    return this._mount3D(engine, opts);
  };

  Host.prototype._mount3D = function (engine, opts) {
    var self = this;
    var createOptions = {
      host: this,
      reducedMotion: engine.prefersReducedMotion && engine.prefersReducedMotion(),
      maxPixelRatio: opts.lowEnd ? 1 : 2,
      onContextLost: function () {
        // The GPU went away mid-show: drop back to the drawing, not to a blank
        // stage, and keep the conversation running.
        self.use2D();
      }
    };
    if (opts.human && opts.asset && global.PDDomeyHuman) {
      createOptions.three = opts.three;
      createOptions.rig = global.PDDomeyHuman.buildRig(opts.three, {
        asset: opts.asset,
        lowEnd: false,
        reducedMotion: createOptions.reducedMotion
      });
    }
    var instance = engine.create(this.stage, createOptions);
    if (!instance) return null;
    this.renderer3d = instance;
    this.root.classList.add('pdm-render-3d');
    this.root.setAttribute('data-pdm-render', '3d');
    this.root.setAttribute('data-pdm-model', createOptions.rig ? 'human' : 'cartoon');
    this.emit('renderer', '3d');
    return instance;
  };

  /** Go back to the inline SVG character (WebGL lost, or by request). */
  Host.prototype.use2D = function () {
    if (this.renderer3d) {
      try { this.renderer3d.dispose(); } catch (e) {}
      this.renderer3d = null;
    }
    this.root.classList.remove('pdm-render-3d');
    this.root.setAttribute('data-pdm-render', '2d');
    this.emit('renderer', 'svg');
    return this;
  };

  /** True while the three-dimensional character is on stage. */
  Host.prototype.is3D = function () { return !!this.renderer3d; };

  Host.prototype.on = function (evt, fn) {
    (this.listeners[evt] = this.listeners[evt] || []).push(fn);
    return this;
  };
  Host.prototype.emit = function (evt, payload) {
    (this.listeners[evt] || []).forEach(function (fn) {
      try { fn(payload); } catch (e) { console.warn('[PDMascot] listener failed', e); }
    });
    return this;
  };
  Host.prototype._later = function (fn, ms) {
    var self = this;
    var id = setTimeout(function () {
      if (self.destroyed) return;
      try { fn(); } catch (e) { console.warn('[PDMascot] task failed', e); }
    }, ms);
    this.timers.push(id);
    if (this.timers.length > 200) this.timers = this.timers.slice(-60);
    return id;
  };
  Host.prototype._clearTimers = function () {
    // Caption revealers are intervals pushed into the same list; clearing both
    // kinds keeps a stopped host from waking up again.
    this.timers.forEach(function (id) { clearTimeout(id); clearInterval(id); });
    this.timers = [];
    // A pending caption wait must still resolve, otherwise `say()` would hang
    // for ever after the member stops the conversation.
    this._pendingWaits.forEach(function (resolve) { resolve(); });
    this._pendingWaits = [];
  };

  Host.prototype._build = function () {
    var self = this;
    this.root.innerHTML = '';
    this.root.classList.add('pd-mascot');
    if (this.options.compact) this.root.classList.add('pdm-compact');
    this.root.setAttribute('data-pdm-state', 'idle');

    var stage = el('div', 'pdm-stage');
    stage.innerHTML =
      '<div class="pdm-spot"></div>' +
      '<div class="pdm-halo"></div>' +
      '<div class="pdm-floor"></div>' +
      '<div class="pdm-char-wrap">' + characterMarkup(this.id) + '</div>' +
      '<div class="pdm-listen-ring"></div>' +
      '<div class="pdm-reactions" aria-hidden="true"></div>';
    this.hud = el('div', 'pdm-hud');
    this.hud.setAttribute('hidden', '');
    stage.appendChild(this.hud);
    this.stage = stage;
    this.reactions = stage.querySelector('.pdm-reactions');
    this.character = stage.querySelector('.pdm-char-wrap');

    var dialog = el('div', 'pdm-dialog');
    this.bubble = el('div', 'pdm-bubble');
    this.bubble.innerHTML =
      '<span class="pdm-name"><i class="pd-i pd-i-sparkles" aria-hidden="true"></i> ' +
      '<span class="pdm-who">' + esc(this.options.name) + '</span></span>' +
      '<p class="pdm-text" role="status" aria-live="polite"></p>' +
      '<span class="pdm-status"><span class="pdm-pip"></span><span class="pdm-status-text">Ready when you are</span></span>';
    this.textEl = this.bubble.querySelector('.pdm-text');
    this.statusEl = this.bubble.querySelector('.pdm-status-text');
    this.bubble.setAttribute('title', 'Tap to skip ahead');
    this.bubble.addEventListener('click', function () { self.hurry(); });

    this.chips = el('div', 'pdm-chips');
    this.chips.setAttribute('role', 'group');
    this.chips.setAttribute('aria-label', 'Answer choices');

    this.answerForm = el('form', 'pdm-answer');
    this.answerForm.setAttribute('hidden', '');
    this.answerInput = el('input');
    this.answerInput.type = 'text';
    this.answerInput.autocomplete = 'off';
    this.answerInput.setAttribute('aria-label', 'Type your answer to Domey');
    this.answerInput.placeholder = this.options.placeholder;
    var send = el('button', 'pdm-send', '<i class="pd-i pd-i-send" aria-hidden="true"></i> Send');
    send.type = 'submit';
    this.answerForm.appendChild(this.answerInput);
    this.answerForm.appendChild(send);
    this.answerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var value = self.answerInput.value.trim();
      if (!value) return;
      self.answerInput.value = '';
      self._accept(value, 'typed');
    });

    var enable = el('button', 'pdm-enable-voice',
      '<i class="pd-i pd-i-volume-2" aria-hidden="true"></i> Tap to let Domey speak');
    enable.type = 'button';
    enable.hidden = true;
    enable.addEventListener('click', function () {
      self.speechBlocked = false;
      enable.hidden = true;
      Band.unlock();
      self.setMuted(false);
      if (self._pendingSpeech) { self._replayPending(); }
      else { self.say('There we go. I can talk with you now.'); }
    });
    this.enableBtn = enable;

    this.micBadge = el('span', 'pdm-mic-badge', '<i class="pd-i pd-i-mic" aria-hidden="true"></i> Listening…');
    this.micBadge.hidden = true;

    var bar = el('div', 'pdm-bar');
    this.voiceBtn = this._barButton('pd-i-volume-2', 'Voice on', function () { self.toggleMuted(); });
    this.voiceBtn.setAttribute('aria-pressed', this.options.muted ? 'false' : 'true');
    this.voiceBtn.querySelector('span').textContent = this.options.muted ? 'Voice off' : 'Voice on';

    this.micBtn = this._barButton('pd-i-mic', 'Answer by voice', function () { self.toggleMic(); });
    this.micBtn.setAttribute('aria-pressed', 'false');

    this.repeatBtn = this._barButton('pd-i-rotate-ccw', 'Say again', function () {
      if (!self.lastSpoken) return;
      self.say(self.lastSpoken, { emote: 'happy' });
    });

    bar.appendChild(this.voiceBtn);
    bar.appendChild(this.micBtn);
    bar.appendChild(this.repeatBtn);
    bar.appendChild(this.micBadge);

    this.hint = el('p', 'pdm-hint');
    this.hint.textContent = this.ears.supported
      ? 'Answer by talking (tap the microphone), tapping a choice, or typing.'
      : 'Answer by tapping a choice or typing.';

    dialog.appendChild(this.bubble);
    dialog.appendChild(this.chips);
    dialog.appendChild(this.answerForm);
    dialog.appendChild(enable);
    dialog.appendChild(bar);
    dialog.appendChild(this.hint);

    this.root.appendChild(stage);
    this.root.appendChild(dialog);

    // First touch anywhere unlocks audio + speech on mobile browsers.
    this._unlock = function () { Band.unlock(); };
    document.addEventListener('touchstart', this._unlock, { passive: true });
    document.addEventListener('click', this._unlock);

    // Tapping the character himself opens his ears: it is a real gesture (the
    // only kind a browser accepts before showing the microphone prompt) and it
    // is the most natural thing a member will try first.
    if (this.options.listenOnTap !== false) {
      stage.addEventListener('click', function () {
        if (self.micEnabled || !self.ears.supported || self.destroyed) return;
        self.enableMic().then(function (granted) {
          if (!granted || self.destroyed) return;
          // Never talk over a question that is already waiting for an answer:
          // the question simply starts listening instead.
          if (self.answerResolve || self.state !== 'idle') return;
          self.setStatus('Listening — say what is on your heart');
          self.say('I can hear you now. Ask me anything, or tap Start the show.', { emote: 'listening' });
        });
      });
      stage.setAttribute('title', this.ears.supported ? 'Tap Domey to let him hear you' : 'Domey, your Prayer Dome host');
    }
  };

  Host.prototype._barButton = function (icon, label, onClick) {
    var btn = el('button', 'pdm-btn',
      '<i class="pd-i ' + icon + '" aria-hidden="true"></i> <span>' + esc(label) + '</span>');
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', onClick);
    return btn;
  };

  Host.prototype._setState = function (state) {
    if (this.state === state) return;
    this.state = state;
    this.root.setAttribute('data-pdm-state', state);
    this.root.setAttribute('data-pdm-name', this.name || '');
    // A state is also a piece of acting: celebration claps, listening raises
    // the microphone, thinking rubs the chin.
    if (state === 'celebrating') this.act('clap', 1800);
    else if (state === 'listening') this.act('mic', 0);
    else if (state === 'thinking') this.act('think', 2600);
    else if (state !== 'speaking' && this._actTimer) this.act(null);
    this.emit('state', state);
  };

  Host.prototype.setStatus = function (text) {
    this.statusEl.textContent = text || '';
  };

  Host.prototype.emote = function (state, ms) {
    var self = this;
    this._setState(state);
    if (this._stateTimer) clearTimeout(this._stateTimer);
    if (ms) {
      this._stateTimer = setTimeout(function () {
        if (!self.destroyed && self.state === state) self._setState('idle');
      }, ms);
    }
    return this;
  };

  /* ------------------------------------------------------------- acting */

  /**
   * Play one short action: wave, point, open hands, clap, heart, think, dance…
   * Passing no name clears whatever is playing. Actions are pure CSS classes on
   * the root, so they cost nothing and stop dead under reduced-motion.
   */
  Host.prototype.act = function (name, ms) {
    var self = this;
    var root = this.root;
    if (this._actTimer) { clearTimeout(this._actTimer); this._actTimer = null; }
    for (var i = 0; i < ALL_GESTURES.length; i++) root.classList.remove('pdm-act-' + ALL_GESTURES[i]);
    if (!name || !this.actionsOn) {
      root.removeAttribute('data-pdm-act');
      return this;
    }
    // Restart the animation even when the same action is replayed back-to-back.
    void root.offsetWidth;
    root.classList.add('pdm-act-' + name);
    root.setAttribute('data-pdm-act', name);
    this.emit('action', name);
    if (ms) {
      this._actTimer = setTimeout(function () {
        self._actTimer = null;
        if (self.destroyed) return;
        for (var j = 0; j < ALL_GESTURES.length; j++) root.classList.remove('pdm-act-' + ALL_GESTURES[j]);
        root.removeAttribute('data-pdm-act');
      }, ms);
    }
    return this;
  };

  /** Float a little icon up the stage — the visual "well done!". */
  Host.prototype.react = function (kind, count) {
    if (!this.reactions || this.destroyed) return this;
    var icon = REACTIONS[kind] || REACTIONS.sparkle;
    var n = Math.max(1, Math.min(6, count || 3));
    for (var i = 0; i < n; i++) {
      var node = el('span', 'pdm-reaction');
      node.style.left = (18 + Math.random() * 64).toFixed(1) + '%';
      node.style.animationDelay = (i * 110) + 'ms';
      node.innerHTML = '<i class="pd-i ' + icon + '" aria-hidden="true"></i>';
      this.reactions.appendChild(node);
      (function (child) {
        setTimeout(function () { if (child.parentNode) child.parentNode.removeChild(child); }, 2200 + n * 120);
      })(node);
    }
    return this;
  };

  /**
   * Keep the show moving with small, human movements: a hand that opens while
   * explaining, a wave hello, a shrug on a tricky question. Only runs while
   * Domey is actually speaking, so a listening Domey stays still and attentive.
   */
  Host.prototype._gestureLoop = function (token) {
    var self = this;
    function next(delay) {
      self._later(function () {
        if (token.cancelled || self.destroyed) return;
        if (self.state !== 'speaking' || !self.actionsOn) { next(700); return; }
        var pick = TALK_GESTURES[Math.floor(Math.random() * TALK_GESTURES.length)];
        self.act(pick, 950 + Math.round(Math.random() * 700));
        next(1500 + Math.round(Math.random() * 1300));
      }, delay);
    }
    next(500 + Math.round(Math.random() * 800));
  };

  /**
   * Eyes that follow the member's pointer. This is the cheapest possible trick
   * that makes a drawing feel alive: the pupils track, and in the idle pose the
   * head leans a little toward wherever the member is.
   */
  Host.prototype._bindGaze = function () {
    var self = this;
    if (typeof document === 'undefined' || !document.addEventListener) return;
    if (typeof global.matchMedia === 'function' && !global.matchMedia('(hover: hover)').matches) return;
    var raf = global.requestAnimationFrame || function (fn) { return setTimeout(fn, 40); };
    this._gaze = function (event) {
      if (self.destroyed || self._gazeFrame) return;
      var x = event.clientX, y = event.clientY;
      self._gazeFrame = raf(function () {
        self._gazeFrame = null;
        if (self.destroyed || !self.stage) return;
        var box = self.stage.getBoundingClientRect();
        if (!box || !box.width) return;
        var dx = Math.max(-1, Math.min(1, (x - (box.left + box.width / 2)) / (box.width * 0.75)));
        var dy = Math.max(-1, Math.min(1, (y - (box.top + box.height * 0.3)) / (box.height * 0.7)));
        self.root.style.setProperty('--pdm-gaze-x', (dx * 2.6).toFixed(2) + 'px');
        self.root.style.setProperty('--pdm-gaze-y', (dy * 1.9).toFixed(2) + 'px');
        self.root.style.setProperty('--pdm-head-yaw', (dx * 2.4).toFixed(2) + 'deg');
      });
    };
    document.addEventListener('pointermove', this._gaze, { passive: true });
  };

  Host.prototype._unbindGaze = function () {
    if (this._gaze) {
      document.removeEventListener('pointermove', this._gaze);
      this._gaze = null;
    }
    if (this._gazeFrame && global.cancelAnimationFrame) {
      try { global.cancelAnimationFrame(this._gazeFrame); } catch (e) {}
    }
    this._gazeFrame = null;
  };

  Host.prototype.setHud = function (data) {
    data = data || {};
    var parts = [];
    if (data.round != null && data.total != null) {
      parts.push('<span class="pdm-hud-chip"><i class="pd-i pd-i-gamepad-2" aria-hidden="true"></i> Round ' +
        esc(data.round) + ' / ' + esc(data.total) + '</span>');
    }
    if (data.score != null) {
      parts.push('<span class="pdm-hud-chip good"><i class="pd-i pd-i-star" aria-hidden="true"></i> ' + esc(data.score) + ' correct</span>');
    }
    if (data.xp != null) {
      parts.push('<span class="pdm-hud-chip warn"><i class="pd-i pd-i-zap" aria-hidden="true"></i> ' + esc(data.xp) + ' XP</span>');
    }
    if (data.dots && data.dots.length) {
      var dots = data.dots.map(function (dot) {
        var cls = 'pdm-dot' + (dot === 'correct' ? ' is-correct' : dot === 'wrong' ? ' is-wrong' : dot === 'current' ? ' is-current' : '');
        return '<span class="' + cls + '"></span>';
      }).join('');
      parts.push('<span class="pdm-dots">' + dots + '</span>');
    }
    if (!parts.length) { this.hud.setAttribute('hidden', ''); return this; }
    this.hud.innerHTML = parts.join('');
    this.hud.removeAttribute('hidden');
    return this;
  };

  /* ----------------------------------------------------- captions + speech */

  Host.prototype._renderCaptions = function (text, durationMs, token) {
    var self = this;
    var words = String(text || '').split(/\s+/).filter(Boolean);
    if (!words.length) { this.textEl.innerHTML = ''; return { reveal: function () {}, showWord: function () {} }; }
    var perWord = Math.max(90, Math.round(durationMs / words.length));
    var shown = 0;
    this.textEl.innerHTML = words.map(function (w) { return '<span class="pdm-word">' + esc(w) + '</span>'; }).join(' ');
    var spans = this.textEl.querySelectorAll('.pdm-word');
    function showWord(index) {
      // The mouth and the captions are driven by the same plan: revealing the
      // word the lips are on is what makes the whole thing feel spoken.
      while (shown <= index && shown < spans.length) {
        spans[shown].classList.add('shown');
        shown++;
      }
    }
    // A fallback ticker: on a browser with no speech engine (or a muted voice)
    // there are no word boundaries, so the captions keep their own pace.
    var tick = setInterval(function () {
      if (self.destroyed || (token && token.cancelled)) { clearInterval(tick); return; }
      if (shown < spans.length) { showWord(shown); } else { clearInterval(tick); }
    }, perWord);
    this.timers.push(tick);
    return {
      showWord: showWord,
      reveal: function () {
        clearInterval(tick);
        spans.forEach(function (s) { s.classList.add('shown'); });
      }
    };
  };

  Host.prototype.say = function (text, opts) {
    var self = this;
    opts = opts || {};
    // Two kinds of cancellation: `token` paces this one line of speech, while
    // `this._token` cancels the whole conversation. A line spoken while a
    // question is still waiting for an answer must not kill that question.
    var token = { cancelled: false };
    if (this._speechToken) this._speechToken.cancelled = true;
    this._speechToken = token;
    if (!this.answerResolve) {
      if (this._token) this._token.cancelled = true;
      this._token = { cancelled: false };
    }
    var line = cleanSpeech(text);
    this.lastSpoken = line;
    this.history.push({ who: 'host', text: line, at: Date.now() });
    this.emit('say', line);

    var words = line ? line.split(' ').filter(Boolean).length : 0;
    var rate = opts.rate || this.options.rate || 1;
    var estimate = Math.max(1200, words * (60000 / (170 * rate)));
    this._setState(opts.emote || 'speaking');
    this.setStatus(opts.status || 'Speaking');

    // Captions, lips and voice all read from the same plan, so the member hears
    // a word, sees it light up and sees the mouth shape that word needs.
    var captions = this._renderCaptions(line, estimate, token);
    var plan = speechPlan(line, rate);
    if (this.mouthOn) {
      this.mouth.onWord = function (index) { captions.showWord(index); };
      this.mouth.start(plan);
    }
    if (opts.emote !== 'praying' && this.actionsOn) this._gestureLoop(token);

    var speakOpts = {
      rate: rate,
      pitch: opts.pitch || this.options.pitch,
      lang: opts.lang || this.options.lang,
      onStart: opts.onStart,
      // The engine's word boundaries keep the lips honest; without them the
      // plan simply plays at its own pace.
      onWord: function (index) {
        if (!self.mouthOn) return;
        captions.showWord(index);
        self.mouth.jumpToWord(index);
      }
    };
    var spoken = Promise.resolve({ spoken: false, blocked: false, reason: 'captions-only' });
    if (!this.options.captionsOnly && !this.muted) {
      spoken = this.voice.speak(line, speakOpts);
    }

    function landed(result) {
      if (!self.mouthOn) return result;
      // Only the line that owns the mouth may rest it, otherwise a slow line
      // would silence the mouth of the line that replaced it.
      if (self.mouth.plan === plan) self.mouth.stop();
      return result;
    }

    return spoken.then(function (result) {
      if (token.cancelled || self.destroyed) return result;
      if (result.blocked) {
        self.speechBlocked = true;
        self._pendingSpeech = { text: line, opts: opts };
        // Speech was blocked (no user gesture yet): the captions still play, so
        // the member always sees the greeting even when the browser is strict.
        return self._wait(Math.min(estimate, 5000), token).then(function () {
          if (self.speechBlocked) self.enableBtn.hidden = false;
          captions.reveal();
          landed(result);
          self._settleAfterSpeak(opts, token);
          return result;
        });
      }
      if (!result.spoken) {
        // No speech engine at all, or the member muted the voice: keep a
        // talking pace so the character still feels alive, and let the
        // captions carry every word (capped so a long line never drags).
        return self._wait(Math.min(estimate * 0.85, 12000), token).then(function () {
          captions.reveal();
          landed(result);
          self._settleAfterSpeak(opts, token);
          return result;
        });
      }
      captions.reveal();
      // The voice has stopped, so the lips stop with it — a mouth that keeps
      // flapping after the last word is the one thing that breaks the illusion.
      landed(result);
      return self._wait(opts.hold || 350, token).then(function () {
        self._settleAfterSpeak(opts, token);
        return result;
      });
    });
  };

  Host.prototype._settleAfterSpeak = function (opts, token) {
    if (token.cancelled || this.destroyed) return;
    this.setStatus(opts.emote === 'praying' ? 'Praying with you' : 'Waiting for you');
    if (this.state === 'speaking' || this.state === 'happy' || this.state === 'celebrating' || this.state === 'praying' || this.state === 'encouraging') {
      var keep = opts.emote || 'idle';
      this._setState(keep === 'happy' || keep === 'celebrating' ? keep : 'idle');
    }
  };

  Host.prototype._wait = function (ms, token) {
    var self = this;
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        if (self._hurry === finish) self._hurry = null;
        resolve();
      }
      var id = setTimeout(finish, Math.max(0, ms));
      self.timers.push(id);
      self._pendingWaits.push(finish);
      // Tapping the speech bubble (or pressing Enter while it has focus) lets
      // an impatient member skip the rest of the line instantly.
      self._hurry = finish;
      if (token) token.onCancel = finish;
    });
  };

  Host.prototype.hurry = function () {
    // Skipping ahead must skip the whole performance: the lips, the captions
    // and the wait all jump to the end of the line together.
    if (this.mouthOn) this.mouth.finish();
    if (typeof this._hurry === 'function') this._hurry();
    return this;
  };

  Host.prototype._replayPending = function () {
    var pending = this._pendingSpeech;
    this._pendingSpeech = null;
    if (pending) this.say(pending.text, pending.opts);
  };

  Host.prototype.stop = function () {
    if (this._token) this._token.cancelled = true;
    if (this._speechToken) this._speechToken.cancelled = true;
    this._clearTimers();
    this.mouth.stop();
    this.voice.stop();
    this.ears.stop();
    this.act(null);
    if (this.answerResolve) { var r = this.answerResolve; this.answerResolve = null; r({ text: '', source: 'stopped', index: null }); }
    this._setState('idle');
    this.setStatus('Stopped');
  };

  Host.prototype.destroy = function () {
    this.stop();
    if (this._stateTimer) { clearTimeout(this._stateTimer); this._stateTimer = null; }
    this.destroyed = true;
    this._unbindGaze();
    // Hand the GPU buffers back before the markup goes away; a page that mounts
    // and destroys Domey repeatedly must not leak a WebGL context each time.
    if (this.renderer3d) {
      try { this.renderer3d.dispose(); } catch (e) {}
      this.renderer3d = null;
    }
    document.removeEventListener('touchstart', this._unlock);
    document.removeEventListener('click', this._unlock);
    this.root.innerHTML = '';
    this.root.classList.remove('pd-mascot');
    this.root.classList.remove('pdm-render-3d');
    this.root.removeAttribute('data-pdm-render');
  };

  /* -------------------------------------------------------- voice controls */

  Host.prototype.setMuted = function (muted) {
    this.muted = !!muted;
    this.options.muted = this.muted;
    Band.muted = this.muted;
    if (this.muted) this.voice.stop();
    var label = this.voiceBtn.querySelector('span');
    if (label) label.textContent = this.muted ? 'Voice off' : 'Voice on';
    this.voiceBtn.querySelector('i').className = iconClass(this.muted ? 'volume-x' : 'volume-2');
    this.voiceBtn.setAttribute('aria-pressed', this.muted ? 'false' : 'true');
    this.emit('muted', this.muted);
    try { global.localStorage.setItem('pd-domey-muted', this.muted ? '1' : '0'); } catch (e) {}
    return this;
  };

  Host.prototype.toggleMuted = function () {
    this.speechBlocked = false;
    this.enableBtn.hidden = true;
    return this.setMuted(!this.muted);
  };

  Host.prototype.setLang = function (lang) {
    this.options.lang = lang || 'en';
    this.ears.lang = this.options.lang;
    this.voice.lang = this.options.lang;
    this.voice.selected = null;
    return this;
  };

  Host.prototype.micEnabled = false;

  Host.prototype._micUi = function (on) {
    if (this.micBtn) {
      this.micBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var icon = this.micBtn.querySelector('i');
      if (icon) icon.className = iconClass(on ? 'mic' : 'mic-off');
      var label = this.micBtn.querySelector('span');
      if (label) label.textContent = on ? 'Voice answers on' : 'Answer by voice';
      this.micBtn.classList.toggle('is-live', !!on);
    }
    this.root.classList.toggle('pdm-mic-on', !!on);
  };

  /**
   * Open the ears.
   *
   * A host who cannot hear the member is only half a host, so this is what the
   * show calls the instant the member taps "Start the show" — that tap is the
   * one gesture browsers accept before they will allow a microphone prompt.
   * Nothing is recorded: the browser's own speech engine turns the answer into
   * text on the device, and the host keeps only the answer.
   */
  Host.prototype.enableMic = function (opts) {
    var self = this;
    opts = opts || {};
    if (!this.ears.supported) {
      this.setStatus('This browser cannot listen — tap a choice or type');
      return Promise.resolve(false);
    }
    // A member who already blocked the microphone is not asked again: the host
    // keeps working, it just stops offering to listen.
    if (this.ears.permission === 'denied' && this._micWarmed) {
      this.setStatus('Microphone blocked — tap a choice or type instead');
      return Promise.resolve(false);
    }
    Band.unlock();
    if (!this.micEnabled) {
      this.micEnabled = true;
      this._micUi(true);
      this.emote('listening');
      this.emit('mic', true);
    }
    // A question that is already on screen starts listening again right away.
    if (this.answerResolve && this._listenLoop) this._later(this._listenLoop, 220);
    if (opts.warmUp === false || this._micWarmed) return Promise.resolve(true);
    this._micWarmed = true;
    return this.ears.warmUp().then(function () {
      if (self.destroyed) return false;
      if (self.ears.permission === 'denied') {
        self.disableMic();
        self.setStatus('Microphone blocked — tap a choice or type instead');
        return false;
      }
      if (self.answerResolve && self._listenLoop) self._later(self._listenLoop, 220);
      return true;
    });
  };

  /** Can this browser let Domey hear spoken answers at all? */
  Host.prototype.canHear = function () { return !!this.ears.supported; };

  Host.prototype.disableMic = function () {
    this.micEnabled = false;
    this._micUi(false);
    this.ears.stop();
    if (this.state === 'listening') this._setState('idle');
    this.emit('mic', false);
    return this;
  };

  Host.prototype.toggleMic = function () {
    if (this.micEnabled) { this.disableMic(); return false; }
    this.enableMic();
    return true;
  };

  /* ------------------------------------------------------------- the ask */

  Host.prototype._clearQuestion = function () {
    this.question = null;
    this.chips.innerHTML = '';
    this.answerForm.setAttribute('hidden', '');
    this.micBadge.hidden = true;
  };

  Host.prototype._accept = function (value, source, index) {
    if (!this.answerResolve) return false;
    var resolve = this.answerResolve;
    this.answerResolve = null;
    this._listenLoop = null;
    this.question = null;
    this.ears.stop();
    this.micBadge.hidden = true;
    // Freeze the choice chips so one answer is never sent twice.
    this.chips.querySelectorAll('.pdm-chip').forEach(function (chip) { chip.disabled = true; });
    Band.play('listen');
    resolve({ text: String(value == null ? '' : value), source: source, index: index == null ? null : index });
    return true;
  };

  /**
   * Ask one question and wait for a spoken, tapped or typed answer.
   * spec: { text, kind: 'choice'|'text'|'name', choices, accept, allowSkip,
   *         timeout, listen, emote, echo }
   * Resolves { text, source, index } where index is the chosen option (if any).
   */
  Host.prototype.ask = function (spec) {
    var self = this;
    spec = spec || {};
    if (!spec.text) return Promise.reject(new Error('PDMascot.ask needs spec.text'));
    var choices = (spec.choices || []).slice();
    // A question that lists choices is a choice question, whether or not the
    // page remembered to say so — otherwise a spoken answer would be accepted
    // as free text and marked against nothing.
    if (!spec.kind) spec.kind = choices.length ? 'choice' : 'text';

    // Clear the previous question straight away — a leftover choice chip must
    // never sit on screen looking clickable while Domey asks something new.
    this._clearQuestion();
    this.micBadge.hidden = true;

    return this.say(spec.text, { emote: spec.emote || 'idle', status: 'Your turn' }).then(function () {
      if (self.destroyed) return { text: '', source: 'destroyed', index: null };
      self.question = spec;
      self.chips.innerHTML = '';
      self.answerForm.removeAttribute('hidden');
      // Only pop the keyboard on devices with a real pointer: on a phone the
      // member is far more likely to answer with the microphone.
      var typingDevice = typeof global.matchMedia === 'function' && global.matchMedia('(hover: hover)').matches;
      if (typingDevice) { try { self.answerInput.focus({ preventScroll: true }); } catch (e) {} }
      self.setStatus('Your turn');

      var promise = new Promise(function (resolve) { self.answerResolve = resolve; });
      var token = self._token;

      choices.forEach(function (choice, index) {
        var chip = el('button', 'pdm-chip', esc(choice));
        chip.type = 'button';
        chip.addEventListener('click', function () {
          self.chips.querySelectorAll('.pdm-chip').forEach(function (c) { c.classList.remove('is-picked'); });
          chip.classList.add('is-picked');
          if (spec.correctIndex != null) {
            chip.classList.add(index === spec.correctIndex ? 'is-correct' : 'is-wrong');
          }
          self._accept(choice, 'chip', index);
        });
        self.chips.appendChild(chip);
      });

      if (spec.allowSkip !== false) {
        // A member is never forced to speak or share a name.
        var skipLabel = spec.kind === 'name'
          ? '<i class="pd-i pd-i-user" aria-hidden="true"></i> Just call me friend'
          : '<i class="pd-i pd-i-arrow-right" aria-hidden="true"></i> Skip';
        var skip = el('button', 'pdm-chip', skipLabel);
        skip.type = 'button';
        skip.addEventListener('click', function () { self._accept('', 'skip', null); });
        self.chips.appendChild(skip);
      }

      var heardNothing = 0;

      /**
       * Things a member can simply say to the host, in the middle of a
       * question: "say that again", "give me a hint", "skip", "slow down".
       * Answering a question is not the only way to talk to Domey.
       */
      function voiceCommand(spoken) {
        var text = norm(spoken);
        if (/^(repeat|again|say (that|it) again|pardon|come again|what)\b/.test(text)) {
          self.say('Of course. ' + (spec.text || '') + (spec.hints && spec.hints.length ? ' A hint for you: ' + spec.hints.join(' ') + '.' : ''), { emote: 'happy', status: 'Your turn' })
            .then(function () { if (self.answerResolve) listenLoop(); });
          return true;
        }
        if (/^(hint|help|clue|i need help)\b/.test(text)) {
          self.say(spec.hints && spec.hints.length
            ? 'Here is your hint: ' + spec.hints.join(' ') + '.'
            : 'Think about who God chose for that moment in the story.', { emote: 'thinking', status: 'Your turn' })
            .then(function () { if (self.answerResolve) listenLoop(); });
          return true;
        }
        if (/^(skip|pass|next|move on|no idea|i do not know|i dont know|dont know|i don't know)\b/.test(text)) {
          self.emit('heard', spoken);
          self._accept('', 'skip', null);
          return true;
        }
        if (/^(slow down|speak slower|too fast)\b/.test(text)) {
          self.options.rate = Math.max(0.7, (self.options.rate || 1) - 0.14);
          self.say('No problem, I will speak a little slower.', { emote: 'happy', status: 'Your turn' })
            .then(function () { if (self.answerResolve) listenLoop(); });
          return true;
        }
        if (/^(stop|quiet|silence|be quiet)\b/.test(text)) {
          self._accept('', 'skip', null);
          return true;
        }
        return false;
      }

      function listenLoop() {
        if (self.destroyed || !self.answerResolve || token.cancelled) return;
        if (!self.micEnabled || !self.ears.supported) return;
        self.emote('listening');
        self.micBadge.hidden = false;
        Band.play('listen');
        self.ears.listenOnce({
          lang: self.options.lang,
          timeout: spec.listenTimeout || 14000,
          // A prayer request or a spoken sentence is longer than one quiz word,
          // so those keep the ears open a moment after the member stops.
          continuous: spec.kind === 'text' || !!spec.continuous,
          onInterim: function (partial) { if (partial) self.setStatus('Heard: ' + partial); }
        }).then(function (result) {
          if (self.destroyed || !self.answerResolve || token.cancelled) return;
          self.micBadge.hidden = true;
          if (result.text) {
            self._setState('thinking');
            if (voiceCommand(result.text)) return;
            var match = spec.kind === 'choice' ? matchChoices(result.text, choices) : { index: null, score: 1 };
            if (spec.kind === 'choice' && match.index == null && (spec.accept || []).length === 0) {
              heardNothing++;
              self.react('hand', 1);
              self.say(match.score > 0.3 ? 'I am not sure I caught that. Let us try once more.' : 'I did not catch an answer. Say it again, or tap a choice.', { status: 'Your turn' })
                .then(function () { if (self.answerResolve) listenLoop(); });
              return;
            }
            self.emit('heard', result.text);
            self._accept(result.text, 'voice', match.index);
            return;
          }
          if (result.reason === 'not-allowed' || result.reason === 'service-not-allowed') {
            self.disableMic();
            self.say('I cannot reach the microphone, so just type your answer or tap a choice.', { emote: 'encouraging', status: 'Your turn' });
            return;
          }
          if (result.reason === 'silent' || result.reason === 'no-speech' || result.reason === 'aborted') {
            heardNothing++;
            if (heardNothing === 3) {
              // Keep the conversation warm, then quietly start listening again
              // so a member who needs a moment can still simply speak.
              self.say('I am still here. Take your time — tap a choice if you would rather not talk.', { emote: 'encouraging', status: 'Your turn' })
                .then(function () { if (self.answerResolve) self._later(listenLoop, 2500); });
              return;
            }
            if (heardNothing > 6) return;
            self._later(listenLoop, 260);
          }
        });
      }

      // The show opens the ears itself; a page that only wants tapping can pass
      // `listen: false` and never touch the microphone.
      //
      // The open question owns its ears: however the microphone is opened — the
      // Start button, the microphone button, or a tap on Domey himself — the
      // question starts listening again instead of waiting in silence.
      if (spec.listen !== false && self.ears.supported) self._listenLoop = listenLoop;
      if (spec.listen !== false && self.ears.supported && !self.micEnabled) {
        self.enableMic({ warmUp: !!spec.warmUp }).then(function () {
          if (self.destroyed || !self.answerResolve) return;
          self._later(listenLoop, 260);
        });
      } else {
        self._later(listenLoop, 420);
      }

      // A gentle nudge keeps a silent conversation moving without ever
      // cancelling the question: the member can answer at any time.
      self._later(function () {
        if (!self.answerResolve) return;
        if (self.micEnabled) return;
        self.say(spec.nudge || 'Take your time. Tap a choice, or type your answer — I am listening.', { status: 'Your turn' });
      }, spec.nudgeAfter || 32000);

      // Never leave a conversation hanging: after the (generous) timeout the
      // host politely moves on.
      self._later(function () {
        if (self.answerResolve) self._accept('', 'timeout', null);
      }, spec.timeout || 180000);
      return promise;
    });
  };

  /* ------------------------------------------------------- provider hooks */

  Host.prototype.setBank = function (bank) { this.bank = bank; return this; };

  /* ---------------------------------------------------------- the show */

  var QUIZ_BANK = [
    { q: 'Who built the ark that saved his family from the flood?', options: ['Noah', 'Moses', 'Abraham', 'Job'], answer: 0, verse: 'Genesis 6:14' },
    { q: 'Who led the people of Israel out of Egypt?', options: ['Moses', 'David', 'Joshua', 'Samuel'], answer: 0, verse: 'Exodus 14:21' },
    { q: 'How many days did Jesus fast in the wilderness?', options: ['Forty', 'Seven', 'Twelve', 'Three'], answer: 0, verse: 'Matthew 4:2' },
    { q: 'Who was thrown into the den of lions but was kept safe?', options: ['Daniel', 'Elijah', 'Joseph', 'Paul'], answer: 0, verse: 'Daniel 6:22' },
    { q: 'In which town was Jesus born?', options: ['Bethlehem', 'Nazareth', 'Jerusalem', 'Capernaum'], answer: 0, verse: 'Luke 2:4-7' },
    { q: 'What is the greatest commandment?', options: ['Love God and love your neighbour', 'Keep the Sabbath', 'Fast every week', 'Give all you own'], answer: 0, verse: 'Matthew 22:37-39' },
    { q: 'Who betrayed Jesus for thirty pieces of silver?', options: ['Judas Iscariot', 'Peter', 'Thomas', 'Andrew'], answer: 0, verse: 'Matthew 26:15' },
    { q: 'Which shepherd boy defeated the giant Goliath?', options: ['David', 'Saul', 'Jonathan', 'Gideon'], answer: 0, verse: '1 Samuel 17:49' },
    { q: 'What did Jesus turn into wine at the wedding in Cana?', options: ['Water', 'Milk', 'Oil', 'Honey'], answer: 0, verse: 'John 2:9' },
    { q: 'Which book of the Bible begins, In the beginning God created the heavens and the earth?', options: ['Genesis', 'Exodus', 'Psalms', 'Revelation'], answer: 0, verse: 'Genesis 1:1' },
    { q: 'Who walked on the water toward Jesus?', options: ['Peter', 'John', 'Matthew', 'Philip'], answer: 0, verse: 'Matthew 14:29' },
    { q: 'Which apostle doubted the resurrection until he saw Jesus?', options: ['Thomas', 'Bartholomew', 'Simon', 'James'], answer: 0, verse: 'John 20:27' },
    { q: 'What did God give Moses on Mount Sinai?', options: ['The Ten Commandments', 'A crown', 'A sword', 'A map'], answer: 0, verse: 'Exodus 20' },
    { q: 'Which young man was sold by his brothers into Egypt?', options: ['Joseph', 'Benjamin', 'Reuben', 'Levi'], answer: 0, verse: 'Genesis 37:28' },
    { q: 'Which prophet was swallowed by a great fish?', options: ['Jonah', 'Amos', 'Hosea', 'Micah'], answer: 0, verse: 'Jonah 1:17' },
    { q: 'How many fruits of the Spirit are listed in Galatians 5?', options: ['Nine', 'Seven', 'Ten', 'Twelve'], answer: 0, verse: 'Galatians 5:22-23' },
    { q: 'Who is called the beloved physician and wrote a gospel?', options: ['Luke', 'Mark', 'Titus', 'Timothy'], answer: 0, verse: 'Colossians 4:14' },
    { q: 'Which sea did the Israelites cross on dry ground?', options: ['The Red Sea', 'The Dead Sea', 'The Sea of Galilee', 'The Mediterranean'], answer: 0, verse: 'Exodus 14:22' },
    { q: 'What is the first book of the New Testament?', options: ['Matthew', 'Mark', 'Acts', 'Romans'], answer: 0, verse: 'Matthew 1:1' },
    { q: 'Which woman said, Thy people shall be my people, and thy God my God?', options: ['Ruth', 'Esther', 'Hannah', 'Rachel'], answer: 0, verse: 'Ruth 1:16' },
    { q: 'Who was the mother of Jesus?', options: ['Mary', 'Martha', 'Elizabeth', 'Anna'], answer: 0, verse: 'Luke 1:31' },
    { q: 'What did Jesus say is the greatest in the kingdom of heaven?', options: ['A humble servant', 'A rich ruler', 'A strong soldier', 'A wise scholar'], answer: 0, verse: 'Matthew 18:4' },
    { q: 'Which mountain did Noahs ark rest on?', options: ['Ararat', 'Sinai', 'Carmel', 'Zion'], answer: 0, verse: 'Genesis 8:4' },
    { q: 'How many books are in the Bible?', options: ['Sixty-six', 'Sixty-two', 'Seventy', 'Seventy-three'], answer: 0, verse: 'The canon of Scripture' }
  ];

  var PRAISE = [
    'Amen! That is exactly right.', 'Beautiful — well done!', 'Yes! You know the Word.',
    'Excellent answer!', 'That is correct, praise God.', 'Wonderful — you are learning fast.'
  ];
  var ENCOURAGE = [
    'Not quite, but you are close. Let us learn it together.',
    'That one is tricky. Here is the answer we are looking for.',
    'Good try! Keep this one in your heart.',
    'Almost! Let me share it with you.'
  ];
  var QUIPS = [
    'You are doing great, {name}.',
    'Ooh, this next one is a good one.',
    'Stay with me, {name} — here comes another.',
    'I love playing this with you.',
    'Let us see what you remember from the Word.',
    'Ready? This one is a favourite of mine.'
  ];
  var TWO_IN_A_ROW = [
    'Two in a row, {name}!',
    'Look at that, {name} — two in a row!',
    'You are warming up, {name}!'
  ];
  var STREAK_CHEERS = [
    'Three in a row, {name}! You are on fire!',
    'Three in a row! {name}, that is wonderful!',
    'And that makes three! Well done, {name}!'
  ];

  function buildQuestion(item) {
    // Shuffle so the right answer is never always first.
    var pairs = item.options.map(function (text, index) { return { text: text, correct: index === item.answer }; });
    var mixed = shuffled(pairs);
    return {
      q: item.q,
      verse: item.verse,
      options: mixed.map(function (p) { return p.text; }),
      correctIndex: mixed.findIndex(function (p) { return p.correct; }),
      explanation: item.explanation || ''
    };
  }

  /**
   * Run the talking game show: Domey greets, asks the member's name, then asks
   * questions and reacts to each answer. Options:
   *   rounds, bank, intro, onScore({correct,total,xp,streak}), onFinish(summary)
   */
  function show(host, options) {
    options = options || {};
    var rounds = Math.max(1, options.rounds || 5);
    var bank = shuffled(options.bank && options.bank.length ? options.bank : QUIZ_BANK);
    var questions = bank.slice(0, rounds).map(buildQuestion);
    var correct = 0;
    var xp = 0;
    var streak = 0;
    var bestStreak = 0;
    var dots = [];
    var token = { cancelled: false };

    function hud(round) {
      var shown = dots.concat(new Array(Math.max(0, questions.length - dots.length)).fill(null));
      host.setHud({
        round: Math.min(round, questions.length),
        total: questions.length,
        score: correct,
        xp: xp,
        dots: shown.map(function (d, i) { return d || (i === round - 1 ? 'current' : null); })
      });
    }

    host.emit('show:start', { total: questions.length });
    Band.play('start');
    host.act('wave', 1800);
    host.react('sparkle', 3);
    hud(0);

    var greeting = options.intro || ('Hi! Welcome to Prayer Dome! I am ' + host.options.name +
      ', and I am so glad you are here. Let us play a Bible challenge together — say your answer out loud, tap it, or type it.');

    return host.say(greeting, { emote: 'happy' }).then(function () {
      if (token.cancelled) return null;
      // If the microphone is open, say so out loud — half the fun of talking to
      // Domey is finding out he really does hear you.
      if (host.ears.supported && host.micEnabled) {
        return host.say('My ears are open — you can answer by talking.', { emote: 'listening' });
      }
      return null;
    }).then(function () {
      if (token.cancelled) return null;
      return host.ask({
        text: 'Before we start, what should I call you?',
        kind: 'name',
        allowSkip: true,
        listen: true,
        listenTimeout: 9000
      });
    }).then(function (nameAnswer) {
      if (token.cancelled) return null;
      var name = cleanName(nameAnswer && nameAnswer.text, 'friend');
      host.name = name;
      host.emit('name', name);
      var hello = name && name !== 'friend'
        ? 'Lovely to meet you, ' + name + '! Let us begin.'
        : 'No problem, friend. Let us begin.';
      return host.say(hello, { emote: 'happy' });
    }).then(function step() {
      if (token.cancelled) return null;
      var index = dots.length;
      if (index >= questions.length) return finish();
      var item = questions[index];
      hud(index + 1);
      host.emit('round', { index: index, total: questions.length, question: item });
      host._setState('thinking');
      host.act('point', 1200);
      Band.play('tick');
      // A little variety keeps five rounds from sounding like one: every third
      // question gets a quip before the question itself.
      var quip = index > 0 && index % 2 === 1 ? pick(QUIPS).replace('{name}', host.name || 'friend') + ' ' : '';
      return host.say(quip + 'Question ' + (index + 1) + '. ' + item.q, { emote: 'thinking', status: 'Your turn' })
        .then(function () {
          if (token.cancelled) return null;
          return host.ask({
            text: item.q,
            kind: 'choice',
            choices: item.options,
            correctIndex: item.correctIndex,
            listen: true,
            listenTimeout: 15000,
            hints: [item.verse]
          });
        })
        .then(function (answer) {
          if (token.cancelled) return null;
          var chosen = answer.index;
          // Typed or free-spoken answers arrive as text: match them against the
          // printed choices so "the first one" and "Moses" both count.
          if (chosen == null && answer.text) {
            var m = matchChoices(answer.text, item.options);
            if (m.index != null) chosen = m.index;
          }
          var isRight = chosen === item.correctIndex;
          if (isRight) {
            correct++;
            streak++;
            bestStreak = Math.max(bestStreak, streak);
            xp += 20 + Math.min(30, streak * 5);
            dots.push('correct');
            Band.play('correct');
            host.emote('celebrating', 2000);
            host.react('star', streak >= 2 ? 4 : 2);
            host.act(streak >= 2 ? 'raise' : 'thumb', 1400);
            if (options.onScore) options.onScore({ correct: correct, total: questions.length, xp: xp, streak: streak, right: true });
            var cheer = pick(PRAISE);
            var who = host.name && host.name !== 'friend' ? host.name + ', ' : '';
            if (streak >= 3) {
              // Three in a row deserves the dance.
              Band.play('dance');
              host.act('dance', 2200);
              host.react('cheer', 4);
              cheer = pick(STREAK_CHEERS).replace('{name}', who ? who.trim().replace(/,$/, '') : 'friend');
            } else if (streak === 2) {
              cheer = pick(TWO_IN_A_ROW).replace('{name}', who ? who.trim().replace(/,$/, '') : 'friend');
            }
            return host.say(cheer + ' (' + item.verse + ')', { emote: 'celebrating', hold: 250 });
          }
          streak = 0;
          dots.push('wrong');
          Band.play('wrong');
          host.emote('encouraging', 2000);
          host.react('heart', 2);
          host.act('open', 1500);
          if (options.onScore) options.onScore({ correct: correct, total: questions.length, xp: xp, streak: streak, right: false });
          var right = item.options[item.correctIndex];
          return host.say(pick(ENCOURAGE) + ' The answer is ' + right + '. ' + item.verse + ' says it clearly.',
            { emote: 'encouraging', hold: 250 });
        })
        .then(function () {
          if (token.cancelled) return null;
          host.setStatus('Let us keep going');
          return step();
        });
    }).then(function (summary) {
      if (token.cancelled) return null;
      return summary;
    });

    function finish() {
      var total = questions.length;
      var percent = Math.round((correct / total) * 100);
      var badge = percent >= 80
        ? 'You passed with flying colours!'
        : percent >= 50
          ? 'Well done — every question makes you stronger.'
          : 'Thank you for playing. Let us read together and try again.';
      var closing = 'That is ' + correct + ' out of ' + total + '. ' + badge +
        ' You earned ' + xp + ' Faith Points. Come back any time — I am always here, and I love talking with you.';
      host.emote('celebrating');
      if (percent >= 80) {
        Band.play('fanfare');
        Band.play('applause');
        host.react('cheer', 6);
        host.act('dance', 2600);
      } else if (percent >= 50) {
        Band.play('celebrate');
        host.react('sparkle', 4);
        host.act('raise', 1800);
      } else {
        Band.play('applause');
        host.react('heart', 3);
        host.act('open', 1600);
      }
      host.emit('show:end', { correct: correct, total: total, xp: xp, percent: percent, bestStreak: bestStreak });
      if (options.onFinish) options.onFinish({ correct: correct, total: total, xp: xp, percent: percent, bestStreak: bestStreak });
      return host.say(closing, { emote: 'celebrating', hold: 600 }).then(function () {
        host.setStatus('The show is finished — tap Start to play again');
        return { correct: correct, total: total, xp: xp, percent: percent, bestStreak: bestStreak, name: host.name };
      });
    }
  }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  /* -------------------------------------------------- the live waiting room */

  var LOUNGE_TOPICS = [
    { key: 'peace', verse: 'John 14:27', say: 'Peace I leave with you, my peace I give unto you.', prayer: 'Father, we ask for Your peace to guard every heart right now.' },
    { key: 'strength', verse: 'Isaiah 40:31', say: 'They that wait upon the LORD shall renew their strength.', prayer: 'Lord, renew strength for everyone who is tired today.' },
    { key: 'healing', verse: 'Psalm 103:2-3', say: 'Bless the LORD, O my soul, who healeth all thy diseases.', prayer: 'Father, we bring every sickness before You and ask for healing.' },
    { key: 'family', verse: 'Joshua 24:15', say: 'As for me and my house, we will serve the LORD.', prayer: 'Lord, bless our homes and keep our families in Your care.' },
    { key: 'provision', verse: 'Philippians 4:19', say: 'My God shall supply all your need according to his riches in glory.', prayer: 'Father, provide for every need in Jesus name.' },
    { key: 'protection', verse: 'Psalm 91:11', say: 'He shall give his angels charge over thee, to keep thee in all thy ways.', prayer: 'Lord, watch over us and our loved ones wherever we travel.' },
    { key: 'thanksgiving', verse: 'Psalm 100:4', say: 'Enter into his gates with thanksgiving, and into his courts with praise.', prayer: 'Thank You Lord for Your goodness and mercy toward us.' }
  ];

  function greetingFor(name, now) {
    var hour = (now || new Date()).getHours();
    var time = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return time + (name ? ', ' + name : '') + '!';
  }

  /**
   * The Live page waiting room. Options:
   *   onPrayer({ topic, text, name }), nextService(), verse(), greeting()
   */
  function buildLounge(host, options) {
    options = options || {};
    var topic = null;

    function guard(token) { return !(token && token.cancelled) && !host.destroyed; }

    function greeting() {
      var service = typeof options.nextService === 'function' ? options.nextService() : null;
      var lines = [greetingFor(host.name) + ' Welcome to Prayer Dome!'];
      lines.push('I am ' + host.options.name + ', your prayer buddy. The service has not started yet, so let us pray together while we wait.');
      if (service) lines.push('The next live service is ' + service + '.');
      host.emote('happy');
      return lines.join(' ');
    }

    function askName(token) {
      return host.ask({
        text: 'Before we pray — what should I call you?',
        kind: 'name',
        allowSkip: true,
        listenTimeout: 8000
      }).then(function (nameAnswer) {
        if (!guard(token)) return null;
        var name = cleanName(nameAnswer && nameAnswer.text, host.name);
        if (name) {
          host.name = name;
          try { global.localStorage.setItem('pd_domey_name', name); } catch (e) {}
          host.emit('name', name);
          if (options.onName) options.onName(name);
        }
        return name;
      });
    }

    function verseFlow(token) {
      var verse = typeof options.verse === 'function' ? options.verse() : null;
      verse = verse || { ref: 'Psalm 23:1', text: 'The LORD is my shepherd; I shall not want.' };
      host.emote('praying');
      return host.say('Here is a verse for you today. ' + verse.text + ' That is ' + verse.ref + '.', { emote: 'praying' })
        .then(function () {
          if (!guard(token)) return null;
          return host.ask({
            text: 'Would you like me to pray with you now, or hear another verse?',
            kind: 'choice',
            choices: ['Pray with me', 'Another verse', 'That is all for now'],
            listenTimeout: 10000
          });
        }).then(function (answer) {
          if (!guard(token) || !answer) return null;
          var choice = norm(answer.text);
          if (answer.index === 0 || /pray/.test(choice)) return prayerFlow(token);
          if (answer.index === 1 || /another|verse/.test(choice)) return verseFlow(token);
          return host.say('God bless you. I will stay right here until the service begins.');
        });
    }

    function prayerFlow(token) {
      return host.say('I would be honoured to pray with you. Tell me what is on your heart — say it out loud, or tap a topic.',
        { emote: 'encouraging' })
        .then(function () {
          if (!guard(token)) return null;
          if (!host.micEnabled && host.ears.supported) {
            return host.say('If you would like to speak it out loud, tap the microphone button and I will listen.',
              { emote: 'idle' }).then(function () {
                if (!guard(token)) return null;
                return host.ask({ text: 'What would you like prayer for today?', kind: 'text', timeout: 45000, listenTimeout: 16000 });
              });
          }
          return host.ask({ text: 'What would you like prayer for today?', kind: 'text', timeout: 45000, listenTimeout: 16000 });
        }).then(function (answer) {
          if (!guard(token) || !answer) return null;
          var text = String(answer.text || '').trim();
          var covered = LOUNGE_TOPICS[Math.abs(hash(text)) % LOUNGE_TOPICS.length];
          topic = covered;
          if (text) {
            host.history.push({ who: 'member', text: text, at: Date.now() });
            if (options.onPrayer) { try { options.onPrayer({ topic: covered.key, text: text, name: host.name }); } catch (e) {} }
          }
          var lines = [];
          if (text) lines.push('Thank you for sharing that. I will carry it to God with you.');
          lines.push(covered.prayer);
          lines.push('In the name of Jesus, amen.');
          host.emote('praying');
          return host.say(lines.join(' '), { emote: 'praying' }).then(function () {
            if (!guard(token)) return null;
            host.emote('happy');
            return host.say('Amen! ' + covered.say + ' That promise is from ' + covered.verse + '.');
          });
        });
    }

    function aboutFlow(token) {
      return host.say('Prayer Dome is a home of prayer, the Word and worship. Here you can watch live services, ' +
        'join the prayer wall, study in the Academy, and play Bible games with me. Everything is free, and you are welcome here.',
        { emote: 'happy' }).then(function () {
        if (!guard(token)) return null;
        return verseFlow(token);
      });
    }

    function main() {
      var token = { cancelled: false };
      return host.say(greeting(), { emote: 'happy' }).then(function () {
        if (!guard(token)) return null;
        return askName(token);
      }).then(function (name) {
        if (!guard(token)) return null;
        return host.say(name ? 'Thank you, ' + name + '. What would you like to do?' : 'What would you like to do?',
          { emote: 'idle' });
      }).then(function () {
        if (!guard(token)) return null;
        return host.ask({
          text: 'You can ask me to pray with you, share a Bible verse, or tell you about Prayer Dome.',
          kind: 'choice',
          choices: ['Pray with me', 'Give me a verse', 'Tell me about Prayer Dome'],
          listenTimeout: 12000
        });
      }).then(function (answer) {
        if (!guard(token) || !answer) return null;
        var choice = norm(answer.text);
        if (answer.index === 0 || /pray/.test(choice)) return prayerFlow(token);
        if (answer.index === 1 || /verse|scripture|word/.test(choice)) return verseFlow(token);
        if (answer.index === 2 || /about|prayer dome|church/.test(choice)) return aboutFlow(token);
        return prayerFlow(token);
      }).then(function () {
        if (!guard(token)) return null;
        return host.say('I am still here whenever you need me. You can talk with me again before or after the service.');
      });
    }

    // Every flow can be started on its own (the Live page offers "Pray with me"
    // and "Verse for today" as separate buttons) and shares one cancellation
    // token per session, so Stop silences whichever flow is running.
    var sessionToken = { cancelled: false };
    function tokenized(fn) {
      return function (token) { return fn(token || sessionToken); };
    }
    return {
      token: sessionToken,
      cancel: function () { sessionToken.cancelled = true; },
      main: tokenized(main),
      prayerFlow: tokenized(prayerFlow),
      verseFlow: tokenized(verseFlow),
      aboutFlow: tokenized(aboutFlow),
      askName: tokenized(askName),
      greeting: greeting,
      topics: LOUNGE_TOPICS,
      get topic() { return topic; }
    };
  }

  /** Run the whole waiting-room conversation (greeting -> prayer/verse/about). */
  function lounge(host, options) {
    return buildLounge(host, options).main();
  }

  function hash(text) {
    var h = 0;
    for (var i = 0; i < String(text || '').length; i++) { h = (h * 31 + text.charCodeAt(i)) | 0; }
    return h;
  }

  /* ------------------------------------------------------------ public API */

  var PDMascot = {
    mount: function (target, options) { return new Host(target, options); },
    show: show,
    lounge: lounge,
    // A lounge session exposes the individual flows, so a page can offer
    // "Pray for me" and "Verse for today" as separate buttons.
    loungeSession: buildLounge,
    questions: QUIZ_BANK,
    topics: LOUNGE_TOPICS,
    match: matchChoices,
    cleanName: cleanName,
    greetingFor: greetingFor,
    supportsVoice: function () { return typeof global.speechSynthesis !== 'undefined' && typeof global.SpeechSynthesisUtterance !== 'undefined'; },
    supportsListening: function () { return !!(global.SpeechRecognition || global.webkitSpeechRecognition); },
    stopped: function () { try { global.speechSynthesis.cancel(); } catch (e) {} },
    band: Band,
    // The mouth shapes and hand actions the character can perform, plus the
    // planner that turns a sentence into them, published for pages and tests.
    visemes: ['rest', 'M', 'F', 'E', 'I', 'A', 'O', 'U', 'L'],
    actions: ALL_GESTURES,
    lipSync: speechPlan,
    // The 3D character (/assets/pd-domey3d.js) is optional: pages that load it
    // get a three-dimensional Domey automatically, pages that do not keep the
    // drawing. These two helpers let a page check before it promises him.
    supports3D: function () {
      return !!(global.PDDomey3D && global.PDDomey3D.available && global.PDDomey3D.available());
    },
    dimensions: ['2d', '3d'],
    version: '1.2.0'
  };

  // A one-shot line of speech for pages that only want a voice (no character).
  PDMascot.speak = function (text, opts) {
    var voice = new Voice();
    return voice.speak(text, opts || {});
  };

  global.PDMascot = PDMascot;
})(typeof window !== 'undefined' ? window : this);
