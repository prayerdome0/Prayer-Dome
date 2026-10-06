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

  var CHARACTER = [
    '<svg class="pdm-char" viewBox="0 0 220 268" role="img" aria-label="Domey, the Prayer Dome cartoon host">',
    '<defs>',
    '<linearGradient id="pdmRobe" x1="0" y1="0" x2="0" y2="1">',
    '<stop offset="0" stop-color="#1367c4"/><stop offset="1" stop-color="#07244d"/>',
    '</linearGradient>',
    '<radialGradient id="pdmGlow" cx="0.5" cy="0.5" r="0.5">',
    '<stop offset="0" stop-color="#f6df8a" stop-opacity="0.55"/><stop offset="1" stop-color="#f6df8a" stop-opacity="0"/>',
    '</radialGradient>',
    '</defs>',
    '<ellipse class="pdm-shadow" cx="110" cy="252" rx="52" ry="10"/>',
    '<g class="pdm-legs">',
    '<rect class="pdm-leg" x="90" y="192" width="17" height="46" rx="8"/>',
    '<rect class="pdm-leg" x="113" y="192" width="17" height="46" rx="8"/>',
    '<ellipse class="pdm-shoe" cx="98" cy="243" rx="17" ry="10"/>',
    '<ellipse class="pdm-shoe" cx="122" cy="243" rx="17" ry="10"/>',
    '</g>',
    '<g class="pdm-torso">',
    '<path class="pdm-robe" d="M110 96 C86 96 73 112 71 140 L63 198 C62 206 68 211 76 211 L144 211 C152 211 158 206 157 198 L149 140 C147 112 134 96 110 96 Z"/>',
    '<path class="pdm-robe-trim" d="M110 96 C86 96 73 112 71 140 L63 198 C62 206 68 211 76 211 L144 211 C152 211 158 206 157 198 L149 140 C147 112 134 96 110 96 Z"/>',
    '<path class="pdm-sash" d="M73 146 C92 159 128 159 147 146 L147 157 C128 170 92 170 73 157 Z"/>',
    '<g class="pdm-emblem">',
    '<path d="M95 124 C95 112 102 106 110 106 C118 106 125 112 125 124"/>',
    '<path d="M92 124 H128"/>',
    '</g>',
    '</g>',
    '<g class="pdm-arm pdm-arm-l">',
    '<path d="M82 112 C66 126 59 148 63 168" fill="none" stroke="#0f5cae" stroke-width="17" stroke-linecap="round"/>',
    '<circle class="pdm-hand" cx="64" cy="172" r="12"/>',
    '</g>',
    '<g class="pdm-arm pdm-arm-r">',
    '<path d="M138 112 C154 124 160 142 157 162" fill="none" stroke="#0f5cae" stroke-width="17" stroke-linecap="round"/>',
    '<circle class="pdm-hand" cx="156" cy="166" r="12"/>',
    '<g class="pdm-book" transform="rotate(8 158 190)">',
    '<rect class="pdm-book-cover" x="136" y="176" width="44" height="30" rx="5"/>',
    '<rect class="pdm-book-page" x="140" y="180" width="36" height="22" rx="3"/>',
    '<path class="pdm-book-cross" d="M158 182 V200 M150 189 H166"/>',
    '</g>',
    '</g>',
    '<g class="pdm-head">',
    '<ellipse class="pdm-ear" cx="64" cy="64" rx="9" ry="11"/>',
    '<ellipse class="pdm-ear" cx="156" cy="64" rx="9" ry="11"/>',
    '<ellipse class="pdm-face" cx="110" cy="62" rx="47" ry="49"/>',
    '<g class="pdm-hair-group">',
    '<path class="pdm-hair" d="M63 62 C63 24 84 8 110 8 C136 8 157 24 157 62 C151 42 140 32 110 32 C80 32 69 42 63 62 Z"/>',
    '<path class="pdm-hair" d="M100 14 C112 8 128 9 138 17 C128 15 118 15 100 14 Z" opacity="0.55"/>',
    '</g>',
    '<g class="pdm-brows">',
    '<path class="pdm-brow pdm-brow-l" d="M84 46 C90 41 97 41 101 45"/>',
    '<path class="pdm-brow pdm-brow-r" d="M119 45 C123 41 130 41 136 46"/>',
    '</g>',
    '<g class="pdm-eyes">',
    '<g class="pdm-eye pdm-eye-l">',
    '<ellipse class="pdm-eye-white" cx="90" cy="64" rx="12" ry="13"/>',
    '<circle class="pdm-pupil" cx="91" cy="65" r="5.8"/>',
    '<circle class="pdm-glint" cx="88" cy="60" r="2.2"/>',
    '<rect class="pdm-lid" x="78" y="50" width="24" height="26" rx="12"/>',
    '</g>',
    '<g class="pdm-eye pdm-eye-r">',
    '<ellipse class="pdm-eye-white" cx="130" cy="64" rx="12" ry="13"/>',
    '<circle class="pdm-pupil" cx="131" cy="65" r="5.8"/>',
    '<circle class="pdm-glint" cx="128" cy="60" r="2.2"/>',
    '<rect class="pdm-lid" x="118" y="50" width="24" height="26" rx="12"/>',
    '</g>',
    '</g>',
    '<ellipse class="pdm-cheek pdm-cheek-l" cx="72" cy="80" rx="11" ry="7"/>',
    '<ellipse class="pdm-cheek pdm-cheek-r" cx="148" cy="80" rx="11" ry="7"/>',
    '<g class="pdm-mouths">',
    '<path class="pdm-mouth pdm-mouth-smile" d="M96 82 C104 92 116 92 124 82"/>',
    '<ellipse class="pdm-mouth pdm-mouth-open pdm-mouth-fill" cx="110" cy="87" rx="11" ry="9"/>',
    '<path class="pdm-mouth pdm-mouth-think" d="M100 88 C106 87 114 87 120 88"/>',
    '<path class="pdm-mouth pdm-mouth-pray" d="M101 86 C105 82 115 82 119 86"/>',
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

  Voice.prototype.speak = function (text, opts) {
    var self = this;
    opts = opts || {};
    var clean = String(text == null ? '' : text).replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
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

      var guard, safety;
      function finish(spoken, blocked, reason) {
        if (finished) return;
        finished = true;
        clearTimeout(guard);
        clearTimeout(safety);
        resolve({ spoken: spoken, blocked: !!blocked, reason: reason || '' });
      }
      utterance.onstart = function () {
        started = true;
        if (opts.onStart) { try { opts.onStart(); } catch (e) {} }
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

  // One utterance from the member, resolved as { text, reason }.
  Ears.prototype.listenOnce = function (opts) {
    var self = this;
    opts = opts || {};
    if (!this.supported) return Promise.resolve({ text: '', reason: 'unsupported' });
    return new Promise(function (resolve) {
      var settled = false;
      var heard = '';
      var recognition;
      try {
        recognition = new self.Ctor();
      } catch (e) {
        resolve({ text: '', reason: 'unsupported' });
        return;
      }
      recognition.lang = opts.lang || self.lang || 'en';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      self.current = recognition;

      var timeout = setTimeout(function () { done('timeout'); }, opts.timeout || 12000);

      function done(reason, finalText) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        try { recognition.abort(); } catch (e) {}
        if (self.current === recognition) self.current = null;
        resolve({ text: String(finalText != null ? finalText : heard).trim(), reason: reason });
      }

      recognition.onresult = function (event) {
        var interim = '';
        for (var i = event.resultIndex; i < event.results.length; i++) {
          var result = event.results[i];
          var text = result[0] ? result[0].transcript : '';
          if (result.isFinal) { heard = heard ? heard + ' ' + text : text; }
          else interim += text;
        }
        if (opts.onInterim) { try { opts.onInterim(interim || heard); } catch (e) {} }
        if (heard) done('heard', heard);
      };
      recognition.onerror = function (event) {
        var code = (event && event.error) || 'error';
        if (code === 'not-allowed' || code === 'service-not-allowed') self.permission = 'denied';
        done(code === 'no-speech' ? 'silent' : code);
      };
      recognition.onend = function () { done(heard ? 'heard' : 'silent', heard); };

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

  /* ------------------------------------------------------------- the band */

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
    tone: function (freq, start, duration, gain) {
      var ctx = this.context();
      if (!ctx || this.muted) return;
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      var osc = ctx.createOscillator();
      var amp = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      var t0 = ctx.currentTime + (start || 0);
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(gain || 0.06, t0 + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + (duration || 0.18));
      osc.connect(amp).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + (duration || 0.18) + 0.03);
    },
    play: function (name) {
      if (this.muted) return;
      switch (name) {
        case 'correct': this.tone(660, 0, 0.16); this.tone(880, 0.14, 0.22); break;
        case 'wrong': this.tone(320, 0, 0.22, 0.05); this.tone(240, 0.16, 0.26, 0.045); break;
        case 'listen': this.tone(520, 0, 0.1, 0.04); this.tone(720, 0.1, 0.12, 0.04); break;
        case 'start': this.tone(523, 0, 0.14); this.tone(659, 0.12, 0.14); this.tone(784, 0.24, 0.24); break;
        case 'celebrate': this.tone(523, 0, 0.14); this.tone(659, 0.11, 0.14); this.tone(784, 0.22, 0.14); this.tone(1047, 0.33, 0.32); break;
        default: this.tone(600, 0, 0.1, 0.04);
      }
    },
    unlock: function () { var ctx = this.context(); if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} } }
  };

  /* ----------------------------------------------------------- the matcher */

  // Turn a spoken sentence into an answer:
  //   "the first one"            -> { index: 0 }
  //   "noah"                     -> { index: 1 } when a choice matches
  //   "I think it is Moses"      -> { index: 0 }
  function matchChoices(transcript, choices) {
    var text = norm(transcript);
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
      var choice = norm(choices[i]);
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
    captionsOnly: false
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
    this._build();
  }

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
      '<div class="pdm-char-wrap">' + CHARACTER + '</div>' +
      '<div class="pdm-listen-ring"></div>';
    this.hud = el('div', 'pdm-hud');
    this.hud.setAttribute('hidden', '');
    stage.appendChild(this.hud);
    this.stage = stage;

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
    if (!words.length) { this.textEl.innerHTML = ''; return; }
    var perWord = Math.max(90, Math.round(durationMs / words.length));
    var shown = 0;
    this.textEl.innerHTML = words.map(function (w) { return '<span class="pdm-word">' + esc(w) + '</span>'; }).join(' ');
    var spans = this.textEl.querySelectorAll('.pdm-word');
    var tick = setInterval(function () {
      if (self.destroyed || (token && token.cancelled)) { clearInterval(tick); return; }
      if (shown < spans.length) {
        spans[shown].classList.add('shown');
        shown++;
      } else {
        clearInterval(tick);
      }
    }, perWord);
    this.timers.push(tick);
    return { reveal: function () {
      clearInterval(tick);
      spans.forEach(function (s) { s.classList.add('shown'); });
    } };
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
    this.lastSpoken = text;
    this.history.push({ who: 'host', text: text, at: Date.now() });
    this.emit('say', text);

    var words = String(text).split(/\s+/).length;
    var estimate = Math.max(1200, words * (60000 / (170 * (this.options.rate || 1))));
    this._setState(opts.emote || 'speaking');
    this.setStatus(opts.status || 'Speaking');
    var captions = this._renderCaptions(text, estimate, token);

    var speakOpts = {
      rate: opts.rate || this.options.rate,
      pitch: opts.pitch || this.options.pitch,
      lang: opts.lang || this.options.lang
    };
    var spoken = Promise.resolve({ spoken: false, blocked: false, reason: 'captions-only' });
    if (!this.options.captionsOnly && !this.muted) {
      spoken = this.voice.speak(text, speakOpts);
    }

    return spoken.then(function (result) {
      if (token.cancelled || self.destroyed) return result;
      if (result.blocked) {
        self.speechBlocked = true;
        self._pendingSpeech = { text: text, opts: opts };
        // Speech was blocked (no user gesture yet): the captions still play, so
        // the member always sees the greeting even when the browser is strict.
        return self._wait(Math.min(estimate, 5000), token).then(function () {
          if (self.speechBlocked) self.enableBtn.hidden = false;
          captions.reveal();
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
          self._settleAfterSpeak(opts, token);
          return result;
        });
      }
      captions.reveal();
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
    this.voice.stop();
    this.ears.stop();
    if (this.answerResolve) { var r = this.answerResolve; this.answerResolve = null; r({ text: '', source: 'stopped', index: null }); }
    this._setState('idle');
    this.setStatus('Stopped');
  };

  Host.prototype.destroy = function () {
    this.stop();
    if (this._stateTimer) { clearTimeout(this._stateTimer); this._stateTimer = null; }
    this.destroyed = true;
    document.removeEventListener('touchstart', this._unlock);
    document.removeEventListener('click', this._unlock);
    this.root.innerHTML = '';
    this.root.classList.remove('pd-mascot');
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

  Host.prototype.toggleMic = function () {
    this.micEnabled = !this.micEnabled;
    this.micBtn.setAttribute('aria-pressed', this.micEnabled ? 'true' : 'false');
    this.micBtn.querySelector('i').className = iconClass(this.micEnabled ? 'mic' : 'mic-off');
    this.micBtn.querySelector('span').textContent = this.micEnabled ? 'Voice answers on' : 'Answer by voice';
    this.micBtn.classList.toggle('is-live', this.micEnabled);
    if (this.micEnabled) {
      Band.unlock();
      this.setStatus('Listening');
      this.emote('listening');
      this.emit('mic', true);
    } else {
      this.ears.stop();
      this.emit('mic', false);
    }
    return this.micEnabled;
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
      function listenLoop() {
        if (self.destroyed || !self.answerResolve || token.cancelled) return;
        if (!self.micEnabled || !self.ears.supported) return;
        self.emote('listening');
        self.micBadge.hidden = false;
        Band.play('listen');
        self.ears.listenOnce({
          lang: self.options.lang,
          timeout: spec.listenTimeout || 14000,
          onInterim: function (partial) { if (partial) self.setStatus('Heard: ' + partial); }
        }).then(function (result) {
          if (self.destroyed || !self.answerResolve || token.cancelled) return;
          self.micBadge.hidden = true;
          if (result.text) {
            self._setState('thinking');
            var match = spec.kind === 'choice' ? matchChoices(result.text, choices) : { index: null, score: 1 };
            if (spec.kind === 'choice' && match.index == null && (spec.accept || []).length === 0) {
              heardNothing++;
              self.say(match.score > 0.3 ? 'I am not sure I caught that. Let us try once more.' : 'I did not catch an answer. Say it again, or tap a choice.', { status: 'Your turn' })
                .then(function () { if (self.answerResolve) listenLoop(); });
              return;
            }
            self.emit('heard', result.text);
            self._accept(result.text, 'voice', match.index);
            return;
          }
          if (result.reason === 'not-allowed' || result.reason === 'service-not-allowed') {
            self.micEnabled = false;
            self.micBtn.setAttribute('aria-pressed', 'false');
            self.micBtn.querySelector('span').textContent = 'Answer by voice';
            self.say('I cannot reach the microphone, so just type your answer or tap a choice.', { status: 'Your turn' });
            return;
          }
          if (result.reason === 'silent' || result.reason === 'no-speech') {
            heardNothing++;
            if (heardNothing === 3) {
              // Keep the conversation warm, then quietly start listening again
              // so a member who needs a moment can still simply speak.
              self.say('I am still here. Take your time — tap a choice if you would rather not talk.', { status: 'Your turn' })
                .then(function () { if (self.answerResolve) self._later(listenLoop, 2500); });
              return;
            }
            if (heardNothing > 6) return;
            listenLoop();
          }
        });
      }

      self._later(listenLoop, 420);

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
    hud(0);

    var greeting = options.intro || ('Hi! Welcome to Prayer Dome! I am ' + host.options.name +
      ', and I am so glad you are here. Let us play a Bible challenge together — say your answer out loud, tap it, or type it.');

    return host.say(greeting, { emote: 'happy' }).then(function () {
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
      return host.say('Question ' + (index + 1) + '. ' + item.q, { emote: 'thinking', status: 'Your turn' })
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
            host.emote('celebrating', 1600);
            if (options.onScore) options.onScore({ correct: correct, total: questions.length, xp: xp, streak: streak, right: true });
            return host.say(pick(PRAISE) + ' (' + item.verse + ')' , { emote: 'celebrating', hold: 250 });
          }
          streak = 0;
          dots.push('wrong');
          Band.play('wrong');
          host.emote('encouraging', 1600);
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
      if (percent >= 80) Band.play('celebrate');
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
    version: '1.0.0'
  };

  // A one-shot line of speech for pages that only want a voice (no character).
  PDMascot.speak = function (text, opts) {
    var voice = new Voice();
    return voice.speak(text, opts || {});
  };

  global.PDMascot = PDMascot;
})(typeof window !== 'undefined' ? window : this);
