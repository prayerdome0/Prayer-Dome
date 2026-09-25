/* ==========================================================================
   Prayer Dome Academy runtime
   --------------------------------------------------------------------------
   Powers /lessons, /stories and /resources. Uses localStorage for progress
   and certificates so every feature works offline. If signed in, progress is
   mirrored to Firestore when pd-app bindings are available.
   ========================================================================== */
(function () {
  'use strict';
  var DATA = (window.PD_ACADEMY && window.PD_ACADEMY.DATA) || { tracks: [], lessons: [], stories: [], resources: [], quizzes: [] };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function storeGet(k, f) { try { var v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch (e) { return f; } }
  function storeSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} return v; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function quizState() {
    var s = storeGet('pd_academy_progress', { completedLessons: [], passedQuizzes: {}, certificates: [] });
    if (!s.completedLessons) s.completedLessons = [];
    if (!s.passedQuizzes) s.passedQuizzes = {};
    if (!s.certificates) s.certificates = [];
    return s;
  }
  function saveState(s) { return storeSet('pd_academy_progress', s); }
  function memberName() {
    // The signed-in member's profile is the single source of truth for the
    // name that appears on certificates. Cached values keep this working
    // offline; the legacy manual key is only a last-resort fallback.
    try {
      var p = window.PD_PROFILE || storeGet('pd_profile', null) || storeGet('pd_account_profile', null) || storeGet('prayerdome_user_profile', null);
      if (p && p.fullName) return p.fullName;
      if (p && p.displayName) return p.displayName;
    } catch (e) {}
    return localStorage.getItem('pd_certificate_name') || 'Prayer Dome Member';
  }
  // Keep the cached profile fresh: when pd-app has Firestore bindings and a
  // member is signed in, load users/{uid} once and cache it. Future
  // certificates automatically use the updated profile name.
  function syncMemberProfile() {
    try {
      var pd = window.PDApp;
      if (!pd || !pd._fb) return;
      var fb = pd._fb;
      var u = fb.auth && fb.auth.currentUser;
      if (!u) return;
      if (window.PD_PROFILE && (window.PD_PROFILE.uid === u.uid) && window.PD_PROFILE.fullName) return;
      fb.getDoc(fb.doc(fb.db, 'users', u.uid)).then(function (snap) {
        if (!snap.exists()) return;
        var d = snap.data();
        var profile = {
          uid: u.uid,
          fullName: d.fullName || u.displayName || (u.email || '').split('@')[0] || '',
          displayName: d.fullName || u.displayName || '',
          email: d.email || u.email || '',
          phone: d.phone || d.phoneNumber || '',
          photoURL: d.photoURL || u.photoURL || ''
        };
        window.PD_PROFILE = profile;
        storeSet('pd_profile', profile);
      }).catch(function () {});
    } catch (e) {}
  }
  function pct() {
    var total = DATA.lessons.length || 1;
    return Math.round((quizState().completedLessons.length / total) * 100);
  }
  function iconFor(trackId) { var t = DATA.tracks.filter(function (x) { return x.id === trackId; })[0]; return t ? t.icon : 'pd-i-book'; }
  function tr(key, fallback) {
    try {
      if (window.pdT) {
        var lang = (window.PDApp && window.PDApp.i18n && window.PDApp.i18n.current) ? window.PDApp.i18n.current() : (localStorage.getItem('pd_lang')||'en');
        var v = window.pdT(key, lang);
        if (v && v !== key) return v;
      }
      if (window.PDApp && window.PDApp.i18n) {
        var vv = window.PDApp.i18n.t(key);
        if (vv && vv !== key) return vv;
      }
    } catch(e){}
    return fallback;
  }
  function trackTitle(t) {
    var key = 'academy.track.' + t.id;
    return tr(key, t.title);
  }

  function renderTrackCards(root) {
    if (!root) return;
    root.innerHTML = DATA.tracks.map(function (t) {
      var count = DATA.lessons.filter(function (l) { return l.trackId === t.id; }).length;
      return '<a class="pd-acad-card pd-lift" href="/lessons?track=' + encodeURIComponent(t.id) + '">' +
        '<div class="pd-acad-icon ' + (t.color === 'gold' ? 'gold' : '') + '"><i class="pd-i ' + esc(t.icon) + '"></i></div>' +
        '<h3>' + esc(trackTitle(t)) + '</h3><p>' + esc(t.summary) + '</p>' +
        '<div class="pd-acad-meta"><span class="pd-acad-chip ' + (t.color === 'gold' ? 'gold' : '') + '">' + count + ' lessons</span></div></a>';
    }).join('');
  }
  function renderLessonList(root, activeId) {
    if (!root) return;
    var state = quizState();
    root.innerHTML = DATA.lessons.map(function (l) {
      var done = state.completedLessons.indexOf(l.id) >= 0;
      var passed = state.passedQuizzes[l.quizId];
      return '<button class="pd-acad-lesson-link ' + (activeId === l.id ? 'is-active' : '') + '" data-lesson="' + esc(l.id) + '">' +
        '<small><i class="pd-i ' + esc(l.icon) + '"></i> ' + esc(tr('academy.track.'+l.trackId, l.track)) + '</small>' +
        '<strong>' + esc(l.order + '. ' + l.title) + '</strong>' +
        '<span>' + esc(l.minutes + ' min · ' + l.level) + (done ? ' · <i class="pd-i pd-i-circle-check" aria-hidden="true"></i> Read' : '') + (passed ? ' · Certificate earned' : '') + '</span></button>';
    }).join('');
    $$('[data-lesson]', root).forEach(function (b) { b.addEventListener('click', function () { location.hash = '#lesson/' + b.getAttribute('data-lesson'); }); });
  }
  /* ==========================================================================
     Lesson hero imagery — picks one of the branded images based on the lesson
     track/order so every lesson has a visual banner even though the data file
     stores no image references.
     ========================================================================== */
  var LESSON_HERO_BANK = [
    '/assets/hero-worship.jpg',
    '/assets/sermons/sermon-david.jpg',
    '/assets/sermons/sermon-abundant.jpg',
    '/assets/sermons/sermon-daniel.jpg',
    '/assets/sermons/sermon-esther.jpg',
    '/assets/sermons/sermon-prayer.jpg',
    '/assets/sermons/sermon-prodigal.jpg',
    '/assets/sermons/sermon-samaritan.jpg',
    '/assets/sermons/sermon-storm.jpg',
    '/assets/ai/topic-family.jpg',
    '/assets/ai/topic-fear.jpg',
    '/assets/ai/topic-grief.jpg',
    '/assets/ai/topic-healing.jpg',
    '/assets/ai/topic-provision.jpg',
    '/assets/ai/topic-strength.jpg',
    '/assets/support/hero-support.jpg',
    '/assets/testimonies/hero-praise.jpg'
  ];
  function lessonHeroImage(lesson) {
    // Stable pick so a given lesson always shows the same banner.
    var idx = 0;
    try {
      var seed = String(lesson.id || lesson.order || 'lesson');
      for (var i = 0; i < seed.length; i++) idx = (idx * 31 + seed.charCodeAt(i)) >>> 0;
      idx = idx % LESSON_HERO_BANK.length;
    } catch (e) { idx = 0; }
    return LESSON_HERO_BANK[idx];
  }

  function lessonObjectiveList(lesson) {
    if (Array.isArray(lesson.objectives) && lesson.objectives.length) return lesson.objectives;
    return [
      'Understand the core teaching of “' + (lesson.title || 'this lesson') + '.”',
      'Connect the teaching to everyday life and ministry.',
      'Pass the linked quiz with 80% or higher to earn your certificate.'
    ];
  }

  /* ==========================================================================
     Lesson completion progress — tracks how much of the lesson the learner
     has actually engaged with so the Take Quiz button only unlocks once the
     reading, video and reflection steps are marked done. State lives in
     localStorage so progress survives reloads.
     ========================================================================== */
  function lessonProgressStore() {
    var store = storeGet('pd_academy_lesson_progress', {});
    return store && typeof store === 'object' ? store : {};
  }
  function saveLessonProgress(store) { storeSet('pd_academy_lesson_progress', store); }
  function getLessonProgress(lessonId) {
    var store = lessonProgressStore();
    var p = store[lessonId] || {};
    return {
      scrolled: !!p.scrolled,
      reflected: !!p.reflected,
      prayer: !!p.prayer,
      readAt: p.readAt || null,
      completedAt: p.completedAt || null
    };
  }
  function markLessonProgressFlag(lessonId, flag) {
    var store = lessonProgressStore();
    store[lessonId] = store[lessonId] || {};
    store[lessonId][flag] = true;
    if (!store[lessonId].readAt) store[lessonId].readAt = new Date().toISOString();
    saveLessonProgress(store);
  }
  function lessonProgressPercent(p) {
    var done = (p.scrolled ? 1 : 0) + (p.reflected ? 1 : 0) + (p.prayer ? 1 : 0);
    return Math.round((done / 3) * 100);
  }
  function isLessonCompleted(lessonId) {
    var s = quizState();
    var p = getLessonProgress(lessonId);
    return s.completedLessons.indexOf(lessonId) >= 0 || p.completedAt;
  }

  /* ==========================================================================
     Reading tracker — wires a scroll listener and reflection/prayer buttons
     so we can mark the lesson read once the learner genuinely engages.
     ========================================================================== */
  function wireReadingTracker(lesson) {
    var state = quizState();
    var alreadyDone = state.completedLessons.indexOf(lesson.id) >= 0;
    var flagProgress = function () {
      markLessonProgressFlag(lesson.id, 'scrolled');
      // After scrolling, refresh the gate UI to show progress.
      var gate = $('#lessonQuizGate-' + lesson.id);
      if (gate) renderQuizGate(lesson, gate);
    };
    if (alreadyDone) return;
    var target = $('#lessonReader');
    if (!target) return;
    var fired = false;
    var onScroll = function () {
      if (fired) return;
      var rect = target.getBoundingClientRect();
      var viewH = window.innerHeight || document.documentElement.clientHeight;
      if (rect.bottom < viewH * 1.4) { fired = true; flagProgress(); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Also fire after a short delay so short lessons still register.
    setTimeout(function () { if (!fired) { fired = true; flagProgress(); } }, 3500);
  }
  function wireReflection(lesson) {
    var btns = $$('.pd-acad-reflection-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        markLessonProgressFlag(lesson.id, btn.getAttribute('data-flag'));
        var gate = $('#lessonQuizGate-' + lesson.id);
        if (gate) renderQuizGate(lesson, gate);
        btn.classList.add('is-complete');
        btn.disabled = true;
      });
    });
  }

  /* ==========================================================================
     Quiz gate UI — shown at the bottom of the lesson. Once progress is 100%
     the learner can launch the quiz. Otherwise they see what's still
     required and a large disabled CTA.
     ========================================================================== */
  function renderQuizGate(lesson, mount) {
    if (!mount) return;
    var state = quizState();
    var passed = state.passedQuizzes[lesson.quizId];
    var p = getLessonProgress(lesson.id);
    var completed = state.completedLessons.indexOf(lesson.id) >= 0 || !!p.completedAt;
    var progress = lessonProgressPercent(p);
    var canTake = completed || progress === 100;
    var q = DATA.quizzes.filter(function (x) { return x.id === lesson.quizId; })[0];
    var bankSize = ((DATA.TOPIC_QUESTION_POOL && DATA.TOPIC_QUESTION_POOL[lesson.id]) || ((q && q.questions) || [])).length || 30;
    var remaining = [];
    if (!p.reflected) remaining.push('Read the reflection questions');
    if (!p.prayer) remaining.push('Pray the opening prayer');
    if (!p.scrolled) remaining.push('Scroll to the end of the lesson');

    var ctaHtml;
    if (passed) {
      ctaHtml = '<button class="pd-acad-btn pd-acad-btn-primary" id="launchQuizBtn"><i class="pd-i pd-i-rotate-cw"></i> Retake Quiz</button>';
    } else if (canTake) {
      ctaHtml = '<button class="pd-acad-take-quiz-cta" id="launchQuizBtn" type="button"><span class="pd-acad-cta-pulse"></span><i class="pd-i pd-i-star"></i> Take Quiz &mdash; Pass for Certificate</button>';
    } else {
      ctaHtml = '<button class="pd-acad-take-quiz-locked" id="launchQuizBtn" type="button" disabled aria-disabled="true"><i class="pd-i pd-i-lock"></i> Take Quiz &mdash; complete lesson first</button>';
    }

    var progressHtml =
      '<div class="pd-acad-completion-progress">' +
        '<small>' + (canTake ? '<i class="pd-i pd-i-circle-check" style="color:#16a34a"></i> Lesson complete &mdash; you may take the quiz.' : 'Complete the lesson to unlock the quiz.') + '</small>' +
        '<div class="pd-acad-progress" aria-label="Lesson completion"><span style="width:' + Math.max(progress, canTake ? 100 : 0) + '%"></span></div>' +
      '</div>';

    var checkListHtml = remaining.length === 0 ? '' :
      '<div class="pd-acad-callout" style="margin-top:14px"><strong>Before you take the quiz:</strong><ul style="margin:8px 0 0 18px; padding:0">' +
        remaining.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';

    var actionsHtml = '<div class="pd-acad-quiz-gate">' + progressHtml +
      (passed ? '<button class="pd-acad-mark-read is-complete"><i class="pd-i pd-i-award"></i> Certificate earned (' + passed.score + '%)</button>' : '') +
      (completed && !passed ? '<button class="pd-acad-mark-read is-complete" disabled><i class="pd-i pd-i-check"></i> Lesson complete</button>' :
        (!completed ? '<button class="pd-acad-mark-read" id="manualMarkCompleteBtn"><i class="pd-i pd-i-circle-check"></i> Mark lesson complete</button>' : '')) +
      ctaHtml +
    '</div>';

    mount.innerHTML =
      '<div class="pd-acad-quiz-gate-wrap">' +
        actionsHtml +
        checkListHtml +
        '<p style="margin-top:14px; font-size:.85rem; color:var(--pd-acad-muted)"><i class="pd-i pd-i-shuffle"></i> Topic-only question bank: ' + bankSize + ' questions from this lesson &mdash; every attempt randomly samples 10, and answer positions shuffle so you cannot memorise them.</p>' +
      '</div>';

    var manualBtn = $('#manualMarkCompleteBtn');
    if (manualBtn) {
      manualBtn.addEventListener('click', function () {
        var s = quizState();
        if (s.completedLessons.indexOf(lesson.id) < 0) s.completedLessons.push(lesson.id);
        var lp = lessonProgressStore();
        lp[lesson.id] = lp[lesson.id] || {};
        lp[lesson.id].completedAt = new Date().toISOString();
        lp[lesson.id].scrolled = lp[lesson.id].scrolled || true;
        lp[lesson.id].reflected = lp[lesson.id].reflected || true;
        lp[lesson.id].prayer = lp[lesson.id].prayer || true;
        saveLessonProgress(lp);
        saveState(s);
        renderLesson(lesson.id);
        renderLessonList($('#lessonList'), lesson.id);
        updateOverview();
        renderStudentDashboard();
      });
    }

    var launch = $('#launchQuizBtn');
    if (launch) {
      launch.addEventListener('click', function () {
        if (launch.disabled || launch.getAttribute('aria-disabled') === 'true') return;
        openQuizModal(lesson, q, passed);
      });
    }
  }

  /* ==========================================================================
     Quiz modal — full-screen take-quiz experience with per-question flow,
     shuffled answers, immediate feedback, end-of-quiz Pass/Fail result, and
     a Review screen listing every question with the correct answer.
     ========================================================================== */
  var ACTIVE_QUIZ = null; // { lesson, quiz, questions, currentIdx, answers, stage }

  /* Build the question set strictly from the topic the learner just studied.
     No other lesson's questions are ever mixed in. */
  function topicQuizQuestions(lesson, q, count) {
    var pool = (DATA.TOPIC_QUESTION_POOL && DATA.TOPIC_QUESTION_POOL[lesson.id]) || [];
    if (!pool.length) {
      // Topic data missing — fall back to the quiz's own bank (already lesson-scoped).
      pool = (q && q.questions) || [];
    }
    var list = shuffle(pool).slice(0, Math.min(count || 10, pool.length));
    return list.map(function (raw, i) {
      var isTF = raw.length === 4 && raw[1] === 'True' && raw[2] === 'False';
      var options = isTF
        ? shuffle([{ t: 'True', correct: raw[3] === 0 }, { t: 'False', correct: raw[3] === 1 }])
        : shuffle([{ t: raw[1], correct: raw[5] === 0 }, { t: raw[2], correct: raw[5] === 1 }, { t: raw[3], correct: raw[5] === 2 }, { t: raw[4], correct: raw[5] === 3 }]);
      return { id: i, text: raw[0], tf: isTF, options: options };
    });
  }

  function openQuizModal(lesson, q, previouslyPassed) {
    if (!q) return;
    var s = quizState();
    if (s.completedLessons.indexOf(lesson.id) < 0) s.completedLessons.push(lesson.id);
    var lp = lessonProgressStore();
    lp[lesson.id] = lp[lesson.id] || {};
    lp[lesson.id].completedAt = lp[lesson.id].completedAt || new Date().toISOString();
    lp[lesson.id].scrolled = true; lp[lesson.id].reflected = true; lp[lesson.id].prayer = true;
    saveLessonProgress(lp);
    saveState(s);

    // Every question comes from this lesson's topic bank.
    var questions = topicQuizQuestions(lesson, q, 10);
    ACTIVE_QUIZ = {
      lesson: lesson, quiz: q, questions: questions, currentIdx: 0, answers: [],
      score: 0, answered: false, selection: null, stage: 'question', gradedRecord: null
    };
    var root = $('#pdLessonModalRoot');
    if (!root) return;
    root.innerHTML = quizModalShell(lesson, q);
    var closeBtn = $('#quizCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeQuizModal);
    renderQuizQuestion();
    document.body.style.overflow = 'hidden';
  }

  function quizModalShell(lesson, q) {
    return '' +
      '<div class="pd-acad-quiz-overlay open" id="quizOverlay" role="dialog" aria-modal="true" aria-label="Take Quiz">' +
        '<div class="pd-acad-quiz-modal" role="document">' +
          '<div class="pd-acad-quiz-modal-head">' +
            '<div>' +
              '<small><i class="pd-i pd-i-graduation-cap"></i> Knowledge Check &middot; Pass ' + q.passingScore + '%+ for a certificate</small>' +
              '<h3>' + esc(lesson.title) + '</h3>' +
            '</div>' +
            '<button class="pd-acad-quiz-modal-close" id="quizCloseBtn" type="button" aria-label="Close quiz"><i class="pd-i pd-i-x"></i></button>' +
          '</div>' +
          '<div class="pd-acad-quiz-progress-strip" id="quizProgressStrip">' +
            '<strong id="quizQNum">Question 1 of 10</strong>' +
            '<div class="pd-acad-progress"><span id="quizProgressBar" style="width:10%"></span></div>' +
            '<small id="quizScoreLive">Questions drawn from this lesson only</small>' +
          '</div>' +
          '<div id="quizBody"></div>' +
        '</div>' +
      '</div>';
  }

  function closeQuizModal() {
    ACTIVE_QUIZ = null;
    var root = $('#pdLessonModalRoot');
    if (root) root.innerHTML = '';
    document.body.style.overflow = '';
  }

  function renderQuizQuestion() {
    var a = ACTIVE_QUIZ;
    if (!a) return;
    a.stage = 'question';
    a.answered = false; a.selection = null;
    var body = $('#quizBody'); if (!body) return;
    var total = a.questions.length;
    var qz = a.questions[a.currentIdx];
    var pct = Math.round((a.currentIdx / total) * 100);
    var qNumEl = $('#quizQNum'); if (qNumEl) qNumEl.innerHTML = 'Question <strong>' + (a.currentIdx + 1) + '</strong> of ' + total;
    var bar = $('#quizProgressBar'); if (bar) bar.style.width = pct + '%';
    var live = $('#quizScoreLive'); if (live) live.textContent = a.currentIdx + ' of ' + total + ' answered — no hints until you submit';

    body.innerHTML = '' +
      '<div class="pd-acad-quiz-question" key="' + a.currentIdx + '">' +
        '<span class="pd-acad-quiz-question-label"><i class="pd-i pd-i-circle-question-mark"></i> Question ' + (a.currentIdx + 1) + ' of ' + total + '</span>' +
        '<h4>' + esc(qz.text) + '</h4>' +
      '</div>' +
      '<div class="pd-acad-quiz-options" id="quizOptions" role="radiogroup" aria-label="Choices">' +
        qz.options.map(function (op, idx) {
          return '<button class="pd-acad-quiz-option" data-idx="' + idx + '" type="button" role="radio" aria-checked="false">' +
            '<span class="pd-acad-quiz-option-letter">' + String.fromCharCode(65 + idx) + '</span>' +
            '<span class="pd-acad-quiz-option-text">' + esc(op.t) + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +
      '<div class="pd-acad-quiz-actions">' +
        '<button class="pd-acad-btn pd-acad-btn-ghost" id="quizCloseBtn2" type="button"><i class="pd-i pd-i-arrow-left"></i> Back to lesson</button>' +
        '<button class="pd-acad-btn pd-acad-btn-primary" id="quizNextBtn" type="button" disabled>' + (a.currentIdx === total - 1 ? '<i class="pd-i pd-i-flag"></i> Review answers &amp; submit' : 'Next question <i class="pd-i pd-i-arrow-right"></i>') + '</button>' +
      '</div>';

    bindQuizQuestion();
  }

  function bindQuizQuestion() {
    var a = ACTIVE_QUIZ;
    var opts = $$('#quizOptions .pd-acad-quiz-option');
    opts.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (a.stage !== 'question') return;
        // Selecting an option is NOT submission — it only records the draft.
        a.selection = parseInt(btn.getAttribute('data-idx'), 10);
        a.answered = true;
        opts.forEach(function (b) { b.classList.remove('is-draft'); b.setAttribute('aria-checked', 'false'); });
        btn.classList.add('is-draft');
        btn.setAttribute('aria-checked', 'true');
        var nextBtn = $('#quizNextBtn'); if (nextBtn) nextBtn.disabled = false;
      });
    });
    var nextBtn = $('#quizNextBtn');
    if (nextBtn) nextBtn.addEventListener('click', function () {
      // The learner may navigate without choosing; unanswered items are
      // surfaced again in review before submission.
      if (a.answered) a.answers[a.currentIdx] = a.selection;
      a.currentIdx += 1;
      if (a.currentIdx >= a.questions.length) return renderQuizReview();
      renderQuizQuestion();
    });
    var closeBtn = $('#quizCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeQuizModal);
    var closeBtn2 = $('#quizCloseBtn2');
    if (closeBtn2) closeBtn2.addEventListener('click', closeQuizModal);
  }

  /* ==========================================================================
     Submission review — shown immediately after the last question. Lists
     every question with the learner's chosen option and highlights anything
     left unanswered. Nothing is graded until the learner confirms.
     ========================================================================== */
  function renderQuizReview() {
    var a = ACTIVE_QUIZ;
    if (!a) return;
    a.stage = 'review';
    var body = $('#quizBody'); if (!body) return;
    var total = a.questions.length;
    var answered = a.answers.reduce(function (s, x) { return s + (x == null ? 0 : 1); }, 0);
    var bar = $('#quizProgressBar'); if (bar) bar.style.width = '100%';
    var qNumEl = $('#quizQNum'); if (qNumEl) qNumEl.innerHTML = 'Submission review';
    var live = $('#quizScoreLive'); if (live) live.textContent = answered + ' of ' + total + ' answered';

    body.innerHTML = '' +
      '<div class="pd-acad-quiz-review is-confirm">' +
        '<div class="pd-acad-quiz-review-head">' +
          '<h3><i class="pd-i pd-i-list-checks"></i> Review your answers</h3>' +
          '<div class="pd-acad-quiz-result-meta">' +
            '<span class="pd-acad-chip"><i class="pd-i pd-i-info"></i> Correct answers appear after you confirm</span>' +
            '<span class="pd-acad-chip ' + (answered === total ? 'gold' : '') + '">' + answered + ' of ' + total + ' answered</span>' +
          '</div>' +
        '</div>' +
        '<div class="pd-acad-quiz-review-list">' +
          a.questions.map(function (qz, i) {
            var ans = a.answers[i];
            var chosen = ans == null ? null : qz.options[ans];
            return '<div class="pd-acad-quiz-review-item ' + (chosen ? 'is-draft' : 'is-unanswered') + '">' +
              '<span class="pd-acad-review-status"><i class="pd-i ' + (chosen ? 'pd-i-check' : 'pd-i-x') + '"></i> ' + (chosen ? 'Answered' : 'Unanswered') + '</span>' +
              '<h5>Q' + (i + 1) + '. ' + esc(qz.text) + '</h5>' +
              (chosen ? '<div class="pd-acad-review-line">Your answer: <em>' + esc(chosen.t) + '</em></div>' : '<div class="pd-acad-review-line">You did not answer this question.</div>') +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="pd-acad-confirm-box">' +
          '<i class="pd-i pd-i-shield-check"></i>' +
          '<div><strong>Ready to submit?</strong><span>Once confirmed, your answers are final for this attempt and will be graded immediately.</span></div>' +
        '</div>' +
        '<div class="pd-acad-quiz-actions">' +
          '<button class="pd-acad-btn pd-acad-btn-ghost" id="quizConfirmBackBtn" type="button"><i class="pd-i pd-i-arrow-left"></i> Go back</button>' +
          '<button class="pd-acad-btn pd-acad-btn-primary" id="quizConfirmSubmitBtn" type="button"><i class="pd-i pd-i-check"></i> Confirm submission</button>' +
        '</div>' +
      '</div>';

    var back = $('#quizConfirmBackBtn');
    if (back) back.addEventListener('click', function () { a.currentIdx = 0; renderQuizQuestion(); });
    var submit = $('#quizConfirmSubmitBtn');
    if (submit) submit.addEventListener('click', renderQuizGrading);
  }

  /* ==========================================================================
     Grading — the only stage that reveals correct answers and the score.
     Passing (>= threshold) unlocks the next topic and issues a certificate;
     failing blocks progression and offers a retake.
     ========================================================================== */
  function renderQuizGrading() {
    var a = ACTIVE_QUIZ;
    if (!a) return;
    a.stage = 'grading';
    var total = a.questions.length;
    a.score = 0;
    a.answers.forEach(function (idx, i) {
      if (idx == null || idx === undefined) return;
      var qz = a.questions[i];
      var correctIdx = qz.options.findIndex(function (o) { return o.correct; });
      if (idx === correctIdx) a.score += 1;
    });
    var percent = Math.round((a.score / total) * 100);
    var passed = percent >= a.quiz.passingScore;

    // Persist exactly once per attempt. Navigating between the result and the
    // post-grading review must not mint duplicate certificates.
    var certificate = null;
    var record;
    if (!a.gradedRecord) {
      record = { score: percent, date: new Date().toISOString(), lessonId: a.lesson.id, total: total, correct: a.score };
      var s = quizState();
      if (passed) {
        s.passedQuizzes[a.quiz.id] = record;
        if (s.completedLessons.indexOf(a.lesson.id) < 0) s.completedLessons.push(a.lesson.id);
        certificate = 'PD-' + a.lesson.id.toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
        s.certificates.push({ id: certificate, lessonId: a.lesson.id, title: a.lesson.title, score: percent, date: record.date, name: memberName() });
        saveState(s);
        persistCertificateToFirestore(certificate, a.lesson, percent);
        unlockNextLesson(a.lesson);
      } else {
        saveState(s);
      }
      a.gradedRecord = record;
      a.gradedCertificate = certificate;
      a.gradedPassed = passed;
    } else {
      record = a.gradedRecord;
      certificate = a.gradedCertificate;
      passed = a.gradedPassed;
    }

    var body = $('#quizBody'); if (!body) return;
    var bar = $('#quizProgressBar'); if (bar) bar.style.width = '100%';
    var qNumEl = $('#quizQNum'); if (qNumEl) qNumEl.innerHTML = 'Result';
    var live = $('#quizScoreLive'); if (live) live.textContent = (passed ? 'Passed' : 'Not passed') + ' — ' + a.quiz.passingScore + '% required to pass';

    body.innerHTML = '' +
      '<div class="pd-acad-quiz-result ' + (passed ? 'is-pass' : 'is-fail') + '">' +
        '<div class="pd-acad-result-icon"><i class="pd-i ' + (passed ? 'pd-i-trophy' : 'pd-i-book-open-text') + '"></i></div>' +
        '<h2>' + (passed ? 'Congratulations!' : 'Keep learning!') + '</h2>' +
        '<div class="pd-acad-result-score">' + percent + '%</div>' +
        '<p>You answered <strong>' + a.score + '</strong> of ' + total + ' questions correctly.</p>' +
        '<div class="pd-acad-result-meta">' +
          '<span class="pd-acad-chip ' + (passed ? 'gold' : '') + '"><i class="pd-i ' + (passed ? 'pd-i-check' : 'pd-i-rotate-cw') + '"></i> ' + (passed ? 'Status: PASSED' : 'Status: FAILED — ' + Math.max(0, a.quiz.passingScore - percent) + '% short of ' + a.quiz.passingScore + '%') + '</span>' +
          '<span class="pd-acad-chip"><i class="pd-i pd-i-clock"></i> ' + a.quiz.passingScore + '% required to pass</span>' +
          (certificate ? '<span class="pd-acad-chip gold"><i class="pd-i pd-i-award"></i> Certificate ' + esc(certificate) + '</span>' : '') +
        '</div>' +
        (passed && a.lesson.nextLessonId
          ? '<div class="pd-acad-unlock-banner"><i class="pd-i pd-i-lock-open"></i><div><strong>Next topic unlocked</strong><span>"' + esc(nextLessonTitle(a.lesson)) + '" is now available to you.</span></div></div>'
          : '') +
        '<div class="pd-acad-quiz-result-actions">' +
          (passed
            ? '<button class="pd-acad-btn pd-acad-btn-primary" id="quizDownloadCertBtn"><i class="pd-i pd-i-download"></i> Download Certificate</button>' +
              (a.lesson.nextLessonId ? '<a class="pd-acad-btn pd-acad-btn-secondary" id="quizContinueBtn" href="#lesson/' + esc(a.lesson.nextLessonId) + '"><i class="pd-i pd-i-arrow-right"></i> Next Topic</a>' : '') +
              '<button class="pd-acad-btn pd-acad-btn-ghost" id="quizReviewBtn"><i class="pd-i pd-i-eye"></i> Review answers & correct choices</button>'
            : '<button class="pd-acad-btn pd-acad-btn-primary" id="quizRetakeBtn"><i class="pd-i pd-i-rotate-cw"></i> Retake quiz</button>' +
              '<button class="pd-acad-btn pd-acad-btn-secondary" id="quizReviewLessonBtn"><i class="pd-i pd-i-book-open"></i> Review lesson</button>' +
              '<button class="pd-acad-btn pd-acad-btn-ghost" id="quizReviewBtn"><i class="pd-i pd-i-eye"></i> Review answers & correct choices</button>') +
        '</div>' +
      '</div>';

    if (passed && window.confetti) {
      try {
        confetti({ particleCount: 220, spread: 120, origin: { y: 0.6 } });
        setTimeout(function () { confetti({ particleCount: 120, angle: 60, spread: 80, origin: { x: 0 } }); }, 250);
        setTimeout(function () { confetti({ particleCount: 120, angle: 120, spread: 80, origin: { x: 1 } }); }, 500);
      } catch (e) {}
    }

    var dl = $('#quizDownloadCertBtn');
    if (dl) {
      if (window.PDCertificate && certificate) {
        window.PDCertificate.bindButton(dl, { name: memberName(), course: a.lesson.title, score: percent, id: certificate, date: record.date });
      } else {
        dl.style.display = 'none';
      }
    }
    var retake = $('#quizRetakeBtn');
    if (retake) retake.addEventListener('click', function () { openQuizModal(a.lesson, a.quiz); });
    var reviewLesson = $('#quizReviewLessonBtn');
    if (reviewLesson) reviewLesson.addEventListener('click', function () { closeQuizModal(); if (a.lesson.id) location.hash = '#lesson/' + a.lesson.id; });
    var review = $('#quizReviewBtn');
    if (review) review.addEventListener('click', function () { renderQuizGradedReview(); });
    var continueBtn = $('#quizContinueBtn');
    if (continueBtn) continueBtn.addEventListener('click', function () { closeQuizModal(); });

    renderStudentDashboard();
    renderLessonList($('#lessonList'), a.lesson.id);
  }

  function nextLessonTitle(lesson) {
    if (!lesson || !lesson.nextLessonId) return '';
    var n = DATA.lessons.filter(function (x) { return x.id === lesson.nextLessonId; })[0];
    return n ? (n.order + '. ' + n.title) : '';
  }

  function unlockNextLesson(lesson) {
    if (!lesson || !lesson.nextLessonId) return;
    var s = quizState();
    if (!s.unlockedLessons) s.unlockedLessons = [];
    if (s.unlockedLessons.indexOf(lesson.nextLessonId) < 0) s.unlockedLessons.push(lesson.nextLessonId);
    saveState(s);
  }

  /* Post-grading review — same list as the pre-submit review, but now every
     question shows the chosen answer and the correct answer side by side. */
  function renderQuizGradedReview() {
    var a = ACTIVE_QUIZ;
    if (!a) return;
    a.stage = 'graded-review';
    var body = $('#quizBody'); if (!body) return;
    var total = a.questions.length;
    var correctCount = 0;
    a.questions.forEach(function (qz, i) {
      var ans = a.answers[i];
      if (ans == null) return;
      var correctIdx = qz.options.findIndex(function (o) { return o.correct; });
      if (ans === correctIdx) correctCount += 1;
    });
    body.innerHTML = '' +
      '<div class="pd-acad-quiz-review">' +
        '<div class="pd-acad-quiz-review-head">' +
          '<h3><i class="pd-i pd-i-list-checks"></i> Answer review</h3>' +
          '<div class="pd-acad-quiz-result-meta">' +
            '<span class="pd-acad-chip">' + correctCount + ' / ' + total + ' correct</span>' +
          '</div>' +
        '</div>' +
        '<div class="pd-acad-quiz-review-list">' +
        a.questions.map(function (qz, i) {
          var ans = a.answers[i];
          var correctOption = qz.options.find(function (o) { return o.correct; }) || qz.options[0];
          var chosenOption = ans == null ? null : qz.options[ans];
          var isCorrect = ans != null && chosenOption && chosenOption.correct;
          return '<div class="pd-acad-quiz-review-item ' + (isCorrect ? 'is-correct' : 'is-wrong') + '">' +
            '<span class="pd-acad-review-status"><i class="pd-i ' + (isCorrect ? 'pd-i-check' : 'pd-i-x') + '"></i> ' + (isCorrect ? 'Correct' : 'Incorrect') + '</span>' +
            '<h5>Q' + (i + 1) + '. ' + esc(qz.text) + '</h5>' +
            (chosenOption ? '<div class="pd-acad-review-line">Your answer: <em>' + esc(chosenOption.t) + '</em></div>' : '<div class="pd-acad-review-line">You did not answer this question.</div>') +
            (isCorrect ? '' : '<div class="pd-acad-review-line">Correct answer: <strong>' + esc(correctOption.t) + '</strong></div>') +
            '<div class="pd-acad-review-explain"><i class="pd-i pd-i-lightbulb"></i> ' +
              esc('Revisit the lesson on this topic before retaking — the next attempt draws 10 fresh questions from the same topic bank.') +
            '</div>' +
          '</div>';
        }).join('') +
        '</div>' +
        '<div class="pd-acad-quiz-actions">' +
          '<button class="pd-acad-btn pd-acad-btn-ghost" id="quizReviewBackBtn"><i class="pd-i pd-i-arrow-left"></i> Back to result</button>' +
          '<button class="pd-acad-btn pd-acad-btn-primary" id="quizRetake2"><i class="pd-i pd-i-rotate-cw"></i> Retake quiz</button>' +
        '</div>' +
      '</div>';
    var back = $('#quizReviewBackBtn'); if (back) back.addEventListener('click', renderQuizGrading);
    var rt = $('#quizRetake2'); if (rt) rt.addEventListener('click', function () { openQuizModal(a.lesson, a.quiz); });
  }

  /* ==========================================================================
     Persistence helpers — push certificates to Firestore if the member is
     signed in. Mirrors the old local behaviour but ensures the certificate
     shows up in the admin tracker too.
     ========================================================================== */
  function persistCertificateToFirestore(certId, lesson, percent) {
    try {
      var pd = window.PDApp;
      if (!pd || !pd._fb) return;
      var fb = pd._fb;
      var u = fb.auth && fb.auth.currentUser;
      if (!u) return;
      var fbMod = window.PDApp._fb;
      var docRef = fbMod.doc(fbMod.db, 'certificates', certId);
      fbMod.setDoc(docRef, {
        id: certId,
        userId: u.uid,
        email: u.email || '',
        name: memberName(),
        course: lesson.title,
        lessonId: lesson.id,
        score: percent,
        date: new Date().toISOString(),
        downloads: 0,
        source: 'academy-quiz',
        createdAt: new Date().toISOString()
      }, { merge: true }).catch(function () {});
    } catch (e) {}
  }

  /* ==========================================================================
     Discussion threads — light-weight per-lesson Q&A stored in localStorage
     and rendered below the lesson. Members can post questions and reply.
     ========================================================================== */
  function discussionStore() { return storeGet('pd_academy_discussion', { threads: {} }); }
  function saveDiscussion(store) { storeSet('pd_academy_discussion', store); }
  function discussionThread(lessonId) {
    var s = discussionStore();
    if (!s.threads[lessonId]) s.threads[lessonId] = [];
    return s.threads[lessonId];
  }
  function renderDiscussion(lesson, mount) {
    if (!mount) return;
    var thread = discussionThread(lesson.id);
    var items = thread.length ? thread.map(function (t) {
      return '<div class="pd-acad-discussion-item">' +
        '<strong>' + esc(t.name || 'Member') + '</strong>' +
        '<small>' + esc(new Date(t.date).toLocaleString()) + (t.pinned ? ' &middot; <i class="pd-i pd-i-pin"></i> Pinned by instructor' : '') + '</small>' +
        '<p>' + esc(t.body) + '</p>' +
      '</div>';
    }).join('') : '<div class="pd-acad-discussion-empty">No questions yet. Be the first to share what you learned or ask for clarity.</div>';
    mount.innerHTML = '' +
      '<header class="pd-acad-discussion-head">' +
        '<h3><i class="pd-i pd-i-messages-square"></i> Q&amp;A &middot; ' + thread.length + ' ' + (thread.length === 1 ? 'post' : 'posts') + '</h3>' +
        '<small>Helpful answers can be pinned by the instructor</small>' +
      '</header>' +
      '<div class="pd-acad-discussion-list">' + items + '</div>' +
      '<form class="pd-acad-discussion-form" id="discussionForm-' + lesson.id + '">' +
        '<textarea name="body" placeholder="Ask a question or share what stood out to you…" required></textarea>' +
        '<div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap">' +
          '<button type="submit" class="pd-acad-btn pd-acad-btn-primary"><i class="pd-i pd-i-send"></i> Post</button>' +
        '</div>' +
      '</form>';

    var form = $('#discussionForm-' + lesson.id);
    if (form) form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var bodyField = form.querySelector('textarea[name="body"]');
      var body = (bodyField.value || '').trim();
      if (!body) return;
      var name = memberName();
      var s = discussionStore();
      if (!s.threads[lesson.id]) s.threads[lesson.id] = [];
      s.threads[lesson.id].push({ name: name, body: body, date: new Date().toISOString() });
      saveDiscussion(s);
      bodyField.value = '';
      renderDiscussion(lesson, mount);
    });
  }

  /* ==========================================================================
     Lesson share row — uses the global PDApp.share.buttons() so the share
     target is the canonical /share/lesson/<id> endpoint with proper OG tags.
     ========================================================================== */
  function renderLessonShareRow(lesson, mount) {
    if (!mount) return;
    mount.innerHTML = '<div class="pd-acad-lesson-share">' +
      '<div>' +
        '<strong><i class="pd-i pd-i-share-2"></i> Share this lesson</strong>' +
        '<br><small>Help a friend grow alongside you.</small>' +
      '</div>' +
      '<div class="pd-share-row" id="pdShareRow-' + lesson.id + '"></div>' +
    '</div>';
    var row = $('#pdShareRow-' + lesson.id);
    if (row && window.PDApp && window.PDApp.share && typeof window.PDApp.share.buttons === 'function') {
      try {
        var url = (window.PDApp.share && window.PDApp.share.url) ? window.PDApp.share.url('lesson', lesson.id) : (location.origin + '/lessons?lesson=' + encodeURIComponent(lesson.id));
        window.PDApp.share.buttons(row, {
          type: 'lesson',
          id: lesson.id,
          url: url,
          title: lesson.title,
          text: lesson.summary || lesson.subtitle || 'Grow with Prayer Dome Academy'
        });
      } catch (e) {
        // Fallback share row if PDApp.share is unavailable
        row.innerHTML = '<a class="pd-share-btn pd-share-fb" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(location.origin + '/lessons?lesson=' + lesson.id) + '"><i class="pd-i pd-i-brand-facebook"></i> Facebook</a>' +
          '<a class="pd-share-btn pd-share-wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(lesson.title + ' — prayerdome.net/lessons?lesson=' + lesson.id) + '"><i class="pd-i pd-i-brand-whatsapp"></i> WhatsApp</a>' +
          '<a class="pd-share-btn pd-share-copy" href="#" onclick="event.preventDefault(); navigator.clipboard.writeText(\'' + (location.origin + '/lessons?lesson=' + lesson.id) + '\')"><i class="pd-i pd-i-link"></i> Copy link</a>';
      }
    }
  }

  /* ==========================================================================
     Student dashboard widget — lessons completed, quizzes passed, average
     score, certificates earned, learning streak.
     ========================================================================== */
  function computeDashboard() {
    var s = quizState();
    var totalLessons = (DATA.lessons && DATA.lessons.length) || 1;
    var passedCount = 0; var totalPercent = 0; var passedArr = [];
    Object.keys(s.passedQuizzes || {}).forEach(function (k) {
      var p = s.passedQuizzes[k];
      if (p && typeof p.score === 'number') { passedCount += 1; totalPercent += p.score; passedArr.push(p); }
    });
    var avgScore = passedCount ? Math.round(totalPercent / passedCount) : null;
    var streak = computeStreak();
    var lastActive = computeLastActive();
    var nextLesson = (function () {
      var ordered = DATA.lessons.slice().sort(function (a, b) { return a.order - b.order; });
      for (var i = 0; i < ordered.length; i++) {
        if (s.completedLessons.indexOf(ordered[i].id) < 0) return ordered[i];
      }
      return null;
    })();
    var lastLessonId = lastActive.lessonId;
    var lastLesson = lastLessonId ? (DATA.lessons.filter(function (x) { return x.id === lastLessonId; })[0] || null) : null;
    var passedQuizzesTotal = (DATA.quizzes && DATA.quizzes.length) || 0;
    return {
      completedLessons: s.completedLessons.length,
      totalLessons: totalLessons,
      passedQuizzes: passedCount,
      totalQuizzes: passedQuizzesTotal,
      avgScore: avgScore,
      streak: streak,
      lastLesson: lastLesson,
      lastLessonAt: lastActive.at,
      nextLesson: nextLesson,
      certificates: (s.certificates || []).length,
      progress: Math.round((s.completedLessons.length / totalLessons) * 100)
    };
  }

  function computeStreak() {
    var s = quizState();
    var dates = [];
    function pushDate(d) {
      if (!d) return;
      var dt = (d instanceof Date) ? d : new Date(d);
      if (!isNaN(dt.getTime())) dates.push(dt.toISOString().slice(0, 10));
    }
    (s.certificates || []).forEach(function (c) { pushDate(c.date); });
    Object.keys(s.passedQuizzes || {}).forEach(function (k) { pushDate(s.passedQuizzes[k].date); });
    var lp = lessonProgressStore();
    Object.keys(lp).forEach(function (id) { pushDate(lp[id].completedAt); pushDate(lp[id].readAt); });
    if (!dates.length) return 0;
    dates.sort();
    var dayMs = 86400000;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var last = new Date(dates[dates.length - 1] + 'T00:00:00');
    var streak = 1;
    for (var i = dates.length - 1; i > 0; i--) {
      var a = new Date(dates[i] + 'T00:00:00');
      var b = new Date(dates[i - 1] + 'T00:00:00');
      var diff = Math.round((a - b) / dayMs);
      if (diff === 1) streak += 1; else if (diff === 0) continue; else break;
    }
    // If the most recent activity is older than today + 1 day, the streak has lapsed.
    var ageDays = Math.round((today - last) / dayMs);
    if (ageDays > 1) return 0;
    return streak;
  }

  function computeLastActive() {
    var s = quizState();
    var bestAt = null; var bestLesson = null;
    Object.keys(s.passedQuizzes || {}).forEach(function (k) {
      var p = s.passedQuizzes[k];
      if (!p) return;
      var at = p.date;
      if (!bestAt || at > bestAt) { bestAt = at; bestLesson = p.lessonId; }
    });
    (s.certificates || []).forEach(function (c) {
      if (!bestAt || c.date > bestAt) { bestAt = c.date; bestLesson = c.lessonId; }
    });
    var lp = lessonProgressStore();
    Object.keys(lp).forEach(function (id) {
      var t = lp[id].completedAt || lp[id].readAt;
      if (t && (!bestAt || t > bestAt)) { bestAt = t; bestLesson = id; }
    });
    return { at: bestAt, lessonId: bestLesson };
  }

  function renderStudentDashboard() {
    var mount = document.getElementById('studentDashboard');
    if (!mount) return;
    var d = computeDashboard();
    var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    set('dashLessons', d.completedLessons + '/' + d.totalLessons);
    set('dashQuizzes', d.passedQuizzes + '/' + d.totalQuizzes);
    set('dashAvgScore', d.avgScore == null ? '—' : d.avgScore + '%');
    set('dashStreak', d.streak + (d.streak === 1 ? ' day' : ' days'));
    set('dashCerts', d.certificates);
    set('dashProgress', d.progress + '%');
    var bar = document.getElementById('dashProgressBar'); if (bar) bar.style.width = d.progress + '%';
    set('dashNext', d.nextLesson ? d.nextLesson.title : 'All caught up!');
    if (d.lastLesson) {
      var ago = '—';
      if (d.lastLessonAt) {
        var diffMs = Date.now() - new Date(d.lastLessonAt).getTime();
        var mins = Math.floor(diffMs / 60000);
        if (mins < 1) ago = 'just now';
        else if (mins < 60) ago = mins + ' min ago';
        else if (mins < 1440) ago = Math.floor(mins / 60) + ' hr ago';
        else ago = Math.floor(mins / 1440) + ' days ago';
      }
      set('dashLast', ago + ' · ' + d.lastLesson.title);
    } else {
      set('dashLast', '—');
    }
    var greetEl = document.getElementById('studentGreeting');
    if (greetEl) {
      var name = memberName();
      var hour = new Date().getHours();
      var salutation = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      greetEl.textContent = salutation + (name && name !== 'Prayer Dome Member' ? ', ' + name.split(' ')[0] : '') + '!';
    }
  }

  function renderLesson(id) {
    var l = DATA.lessons.filter(function (x) { return x.id === id; })[0] || DATA.lessons[0];
    var reader = $('#lessonReader'); if (!reader || !l) return;
    var q = DATA.quizzes.filter(function (x) { return x.id === l.quizId; })[0];
    var state = quizState();
    var passed = state.passedQuizzes[l.quizId];
    var heroImg = lessonHeroImage(l);
    var objectives = lessonObjectiveList(l);
    var heroStats = '' +
      '<span><i class="pd-i pd-i-clock"></i> ' + esc(l.minutes + ' min') + '</span>' +
      '<span><i class="pd-i pd-i-layers"></i> ' + esc(l.level) + '</span>' +
      '<span><i class="pd-i pd-i-circle-question-mark"></i> ' + (((DATA.TOPIC_QUESTION_POOL && DATA.TOPIC_QUESTION_POOL[l.id]) || ((q && q.questions) || [])).length || 30) + ' Q pool</span>';

    var heroBlock = '' +
      '<section class="pd-acad-lesson-hero" aria-label="Lesson hero banner">' +
        '<img class="pd-acad-lesson-hero-img" src="' + esc(heroImg) + '" alt="" loading="lazy">' +
        '<div class="pd-acad-lesson-hero-body">' +
          '<div style="flex:1; min-width: 220px">' +
            '<div class="pd-acad-lesson-hero-meta">' +
              '<span class="pd-acad-chip"><i class="pd-i ' + esc(l.icon) + '"></i> ' + esc(l.track) + '</span>' +
              '<span class="pd-acad-chip"><i class="pd-i pd-i-book-open"></i> Lesson ' + esc(l.order) + '</span>' +
              (passed ? '<span class="pd-acad-chip gold"><i class="pd-i pd-i-award"></i> Passed · ' + passed.score + '%</span>' : '') +
            '</div>' +
            '<h2>' + esc(l.title) + '</h2>' +
            '<p class="subtitle">' + esc(l.subtitle || '') + '</p>' +
          '</div>' +
          '<div class="pd-acad-lesson-hero-stats">' + heroStats + '</div>' +
        '</div>' +
      '</section>';

    var objectivesBlock = '' +
      '<div class="pd-acad-lesson-objectives" aria-label="Lesson objectives">' +
        '<h4><i class="pd-i pd-i-target"></i> What you will learn</h4>' +
        '<ul>' + objectives.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>' +
      '</div>';

    var reflectionBlock = '<div class="pd-acad-callout"><h4 style="margin-top:0"><i class="pd-i pd-i-circle-question-mark"></i> Reflection questions</h4><ul>' +
      l.reflection.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' +
      '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px">' +
        '<button class="pd-acad-btn pd-acad-btn-secondary pd-acad-reflection-btn" data-flag="reflected"><i class="pd-i pd-i-check"></i> I reflected on these</button>' +
        '<button class="pd-acad-btn pd-acad-btn-ghost pd-acad-reflection-btn" data-flag="prayer"><i class="pd-i pd-i-hands-praying"></i> I prayed this through</button>' +
      '</div></div>';

    reader.innerHTML = heroBlock +
      '<div class="pd-acad-meta"><span class="pd-acad-chip"><i class="pd-i ' + esc(l.icon) + '"></i> ' + esc(l.track) + '</span>' +
      '<span class="pd-acad-chip gold"><i class="pd-i pd-i-clock"></i> ' + l.minutes + ' min</span>' +
      '<span class="pd-acad-chip"><i class="pd-i pd-i-layers"></i> ' + esc(l.level) + '</span>' +
      '<span class="pd-acad-chip"><i class="pd-i pd-i-bookmark"></i> Key Scripture: ' + esc(l.scripture) + '</span>' +
      '</div>' +
      '<h2>' + esc(l.title) + '</h2><p class="subtitle">' + esc(l.subtitle) + '</p>' +
      objectivesBlock +
      '<div class="pd-acad-callout"><strong>Key Scripture:</strong> ' + esc(l.scripture) + '<br>' + esc(l.summary) + '</div>' +
      '<div class="pd-acad-callout"><strong>Opening Prayer</strong><br>' + esc(l.openingPrayer) + '</div>' +
      l.sections.map(function (s) { return '<h4>' + esc(s.heading) + '</h4><p>' + esc(s.body) + '</p>'; }).join('') +
      reflectionBlock +
      '<div class="pd-acad-callout"><strong>Action Step:</strong> ' + esc(l.action) + '</div>' +
      '<div id="lessonQuizGate-' + l.id + '"></div>' +
      '<div id="lessonDiscussion-' + l.id + '" class="pd-acad-discussion" style="margin-top:18px"></div>' +
      '<div id="lessonShare-' + l.id + '"></div>';

    // Initial reflection button state
    var lp = getLessonProgress(l.id);
    $$('.pd-acad-reflection-btn').forEach(function (btn) {
      var f = btn.getAttribute('data-flag');
      if (lp[f]) { btn.classList.add('is-complete'); btn.disabled = true; }
    });

    renderQuizGate(l, $('#lessonQuizGate-' + l.id));
    renderDiscussion(l, $('#lessonDiscussion-' + l.id));
    renderLessonShareRow(l, $('#lessonShare-' + l.id));

    // Track scroll + reflection engagement so the gate unlocks naturally.
    wireReadingTracker(l);
    wireReflection(l);

    renderStudentDashboard();
  }
  function sampleQuizQuestions(q, count) {
    var pool = q.questions.map(function (raw, i) { return { raw: raw, id: i }; });
    pool = shuffle(pool).slice(0, Math.min(count, pool.length));
    return pool.map(function (p) {
      // True/False questions use the compact [text, 'True', 'False', answerIdx] form.
      var isTF = p.raw.length === 4 && p.raw[1] === 'True' && p.raw[2] === 'False';
      var options = isTF
        ? shuffle([{ t: 'True', correct: p.raw[3] === 0 }, { t: 'False', correct: p.raw[3] === 1 }])
        : shuffle([{ t: p.raw[1], correct: p.raw[5] === 0 }, { t: p.raw[2], correct: p.raw[5] === 1 }, { t: p.raw[3], correct: p.raw[5] === 2 }, { t: p.raw[4], correct: p.raw[5] === 3 }]);
      return { id: p.id, text: p.raw[0], tf: isTF, options: options };
    });
  }
  function updateOverview() {
    var total = DATA.lessons.length || 1; var state = quizState();
    $$('[data-acad-lesson-count]').forEach(function (e) { e.textContent = DATA.lessons.length; });
    $$('[data-acad-story-count]').forEach(function (e) { e.textContent = DATA.stories.length; });
    $$('[data-acad-quiz-count]').forEach(function (e) { e.textContent = DATA.quizzes.length; });
    $$('[data-acad-resource-count]').forEach(function (e) { e.textContent = DATA.resources.length; });
    $$('[data-acad-progress]').forEach(function (e) { e.textContent = pct() + '%'; });
    $$('[data-acad-progress-bar]').forEach(function (e) { e.style.width = pct() + '%'; });
    $$('[data-acad-cert-count]').forEach(function (e) { e.textContent = state.certificates.length; });
  }
  function initLessonsPage() {
    if (!$('[data-page="lessons"]')) return;
    updateOverview(); renderTrackCards($('#trackGrid')); renderStudentDashboard();
    var params = new URLSearchParams(location.search);
    var track = params.get('track');
    var list = $('#lessonList');
    function refreshList() {
      if (!list) return;
      var filtered = track ? DATA.lessons.filter(function (l) { return l.trackId === track; }) : DATA.lessons;
      var state = quizState();
      list.innerHTML = filtered.map(function (l) {
        var done = state.completedLessons.indexOf(l.id) >= 0;
        return '<button class="pd-acad-lesson-link" data-lesson="' + esc(l.id) + '"><small><i class="pd-i ' + esc(l.icon) + '"></i> ' + esc(l.track) + '</small><strong>' + esc(l.order + '. ' + l.title) + '</strong><span>' + l.minutes + ' min · ' + esc(l.level) + (done ? ' · <i class="pd-i pd-i-circle-check" aria-hidden="true"></i> Read' : '') + '</span></button>';
      }).join('');
      $$('[data-lesson]', list).forEach(function (b) { b.addEventListener('click', function () { location.hash = '#lesson/' + b.getAttribute('data-lesson'); }); });
    }
    refreshList();
    function route() {
      var h = location.hash || ''; var id = h.indexOf('#lesson/') === 0 ? h.split('/')[1] : DATA.lessons[0].id;
      // Allow ?lesson=<id> as a sharing deep link as well.
      var paramLesson = params.get('lesson');
      if (!h && paramLesson && DATA.lessons.some(function (l) { return l.id === paramLesson; })) {
        location.hash = '#lesson/' + paramLesson;
        return;
      }
      if (track && DATA.lessons.filter(function (l) { return l.trackId === track && l.id === id; }).length === 0) id = DATA.lessons.filter(function (l) { return l.trackId === track; })[0].id;
      renderLesson(id); renderLessonList(list, id);
    }
    window.addEventListener('hashchange', route); route();
    var nameInput = $('#certificateName'); if (nameInput) { nameInput.value = memberName(); nameInput.addEventListener('input', function () { localStorage.setItem('pd_certificate_name', nameInput.value); }); }
  }
  function initStoriesPage() {
    if (!$('[data-page="stories"]')) return;
    updateOverview();
    var grid = $('#storyGrid'); var search = $('#storySearch'); var filters = $('#storyFilters');
    var cats = ['All'].concat(Array.from(new Set(DATA.stories.map(function (s) { return s.category; }))));
    if (filters) filters.innerHTML = cats.map(function (c, i) { return '<button class="pd-acad-filter ' + (i === 0 ? 'is-active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
    function render() {
      var q = (search ? search.value : '').toLowerCase(); var cat = $('[data-cat].is-active', filters); cat = cat ? cat.getAttribute('data-cat') : 'All';
      var items = DATA.stories.filter(function (s) { return (cat === 'All' || s.category === cat) && (s.title.toLowerCase().indexOf(q) >= 0 || s.excerpt.toLowerCase().indexOf(q) >= 0 || s.body.join(' ').toLowerCase().indexOf(q) >= 0); });
      if (!grid) return;
      grid.innerHTML = items.length ? items.map(function (s) {
        var lesson = PD_ACADEMY.getLesson(s.lessonId);
        return '<article class="pd-acad-card pd-lift pd-acad-story"><img src="' + esc(s.image) + '" alt=""><div><div class="pd-acad-meta"><span class="pd-acad-chip gold">' + esc(s.category) + '</span><span class="pd-acad-chip"><i class="pd-i pd-i-clock"></i> ' + s.readingTime + ' min</span></div><h3>' + esc(s.title) + '</h3><p>' + esc(s.excerpt) + '</p><p style="margin-top:12px">' + s.body.slice(0, 2).map(esc).join(' ') + '</p><div class="pd-acad-hero-actions"><a class="pd-acad-btn pd-acad-btn-secondary" href="/stories?story=' + encodeURIComponent(s.id) + '"><i class="pd-i pd-i-book-open"></i> Read</a>' + (lesson ? '<a class="pd-acad-btn pd-acad-btn-ghost" href="/lessons?track=' + encodeURIComponent(lesson.trackId) + '#lesson/' + encodeURIComponent(lesson.id) + '">Linked lesson</a>' : '') + '</div></div></article>';
      }).join('') : '<div class="pd-acad-empty">No stories match your search.</div>';
    }
    if (search) search.addEventListener('input', render);
    if (filters) filters.addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (!b) return; $$('[data-cat]', filters).forEach(function (x) { x.classList.remove('is-active'); }); b.classList.add('is-active'); render(); });
    render();
    var p = new URLSearchParams(location.search); var sid = p.get('story'); if (sid) openStory(sid);
  }
  function openStory(id) {
    var s = PD_ACADEMY.getStory(id); if (!s) return;
    var overlay = document.createElement('div');
    overlay.className = 'pd-modern-modal';
    overlay.style.position = 'fixed'; overlay.style.inset = '0'; overlay.style.zIndex = '9999'; overlay.style.background = 'rgba(7,36,77,.72)'; overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center'; overlay.style.padding = '20px';
    overlay.innerHTML = '<div style="max-width:820px;max-height:90vh;overflow:auto;background:var(--pd-acad-card);color:var(--pd-acad-ink);border-radius:28px;padding:30px;box-shadow:var(--pd-shadow-lg);border:1px solid var(--pd-acad-border)">' +
      '<div style="display:flex;justify-content:space-between;gap:16px;align-items:start"><div><span class="pd-acad-chip gold">' + esc(s.category) + '</span><h2 style="font-family:Poppins,Inter,sans-serif;color:var(--pd-acad-blue);margin:12px 0">' + esc(s.title) + '</h2><p style="color:var(--pd-acad-muted)">By ' + esc(s.author) + ' · ' + s.readingTime + ' min read</p></div><button class="pd-acad-btn pd-acad-btn-ghost" data-close aria-label="Close"><i class="pd-i pd-i-x"></i></button></div>' +
      '<img src="' + esc(s.image) + '" style="width:100%;height:280px;object-fit:cover;border-radius:22px;margin:18px 0">' +
      '<div class="pd-acad-story-body">' + s.body.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>' +
      '<div class="pd-acad-callout"><strong>Reflection:</strong> ' + esc(s.prompt) + '</div><a class="pd-acad-btn pd-acad-btn-primary" href="/lessons#lesson/' + encodeURIComponent(s.lessonId) + '"><i class="pd-i pd-i-arrow-right"></i> Continue to lesson</a></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay || e.target.closest('[data-close]')) overlay.remove(); });
  }
  function initResourcesPage() {
    if (!$('[data-page="resources"]')) return;
    updateOverview();
    var grid = $('#resourceGrid'); if (!grid) return;
    grid.innerHTML = DATA.resources.map(function (r) {
      return '<article class="pd-acad-card pd-lift pd-acad-resource"><div class="pd-acad-icon gold"><i class="pd-i ' + esc(r.icon) + '"></i></div><div style="flex:1"><h3>' + esc(r.title) + '</h3><p>' + esc(r.description) + '</p><div class="pd-acad-meta"><span class="pd-acad-chip">' + esc(r.category) + '</span><span class="pd-acad-chip gold">' + esc(r.format) + '</span><span class="pd-acad-chip">' + esc(r.version) + '</span></div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="pd-acad-btn pd-acad-btn-secondary" href="' + esc(r.url) + '"><i class="pd-i pd-i-eye"></i> Read</a><a class="pd-acad-btn pd-acad-btn-primary" href="' + esc(r.downloadUrl || r.url) + '" download><i class="pd-i pd-i-download"></i> Download</a></div></article>';
    }).join('');
  }

  document.addEventListener('pd:lang', function() {
    try {
      renderTrackCards(document.getElementById('trackGrid'));
      renderStudentDashboard();
      var list = document.getElementById('lessonList');
      if (list) {
        var active = (location.hash || '').indexOf('#lesson/')===0 ? location.hash.split('/')[1] : (DATA.lessons[0]&&DATA.lessons[0].id);
        renderLessonList(list, active);
        // re-render lesson reader if open
        if (active) renderLesson(active);
      }
      // re-render resources grid headings if present
      var rg = document.getElementById('resourceGrid');
      if (rg) {
        // re-trigger resource render via initResourcesPage logic: simple reload
        if (window.PD_ACADEMY && rg) {
          // rebuild resource grid with same function but we can just call initResourcesPage indirectly by re-creating
          var grid = document.getElementById('resourceGrid');
          if (grid && DATA.resources) {
            grid.innerHTML = DATA.resources.map(function (r) {
              return '<article class="pd-acad-card pd-lift pd-acad-resource"><div class="pd-acad-icon gold"><i class="pd-i ' + esc(r.icon) + '"></i></div><div style="flex:1"><h3>' + esc(r.title) + '</h3><p>' + esc(r.description) + '</p><div class="pd-acad-meta"><span class="pd-acad-chip">' + esc(r.category) + '</span><span class="pd-acad-chip gold">' + esc(r.format) + '</span><span class="pd-acad-chip">' + esc(r.version) + '</span></div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="pd-acad-btn pd-acad-btn-secondary" href="' + esc(r.url) + '"><i class="pd-i pd-i-eye"></i> ' + tr('action.read','Read') + '</a><a class="pd-acad-btn pd-acad-btn-primary" href="' + esc(r.downloadUrl || r.url) + '" download><i class="pd-i pd-i-download"></i> ' + tr('action.download','Download') + '</a></div></article>';
            }).join('');
          }
        }
      }
      // translate static hero texts via data-pd-t already handled by pd-app, but also translate known hard-coded strings
      var heroTitle = document.querySelector('.pd-acad-hero h1[data-pd-t]');
      // pd-app will handle data-pd-t automatically, no need here
    } catch(e){}
  });

  /* ==========================================================================
     Prayer Dome Academy Upgraded Courses & Exam Module
     ========================================================================== */
  var COURSES_DATA = [
    {
      id: 'salvation',
      title: 'SALVATION',
      description: 'Understanding God\'s plan of redemption, grace, faith, and living a transformed life.',
      image: '/assets/hero-worship.jpg',
      pdfUrl: '/documents/new-believers-guide.pdf',
      modules: [
        {
          id: 'salvation-m1',
          title: 'Understanding Salvation',
          lesson: 'Every person who turns to Jesus enters a new identity that is not self-made but gifted. Salvation is not a reward for the well-behaved; it is rescue for the helpless. God\'s plan of salvation is built on grace. Salvation is the deliverance from sin and its consequences, brought about by faith in Christ. Humanity separated from God by sin, needs grace and repentance to restore communion.',
          pdf: '/documents/new-believers-guide.pdf',
          audio: 'https://res.cloudinary.com/prayerdome/video/upload/salvation-m1.mp3',
          video: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          activity: 'Write down a brief prayer of gratitude for God\'s grace in your life.',
          completed: false
        },
        {
          id: 'salvation-m2',
          title: 'Jesus Christ and Salvation',
          lesson: 'Jesus Christ is the Savior of the world. Who Jesus is: the Son of God, fully God and fully man. The work of Jesus: His sinless life, sacrificial death on the cross, and victorious resurrection. Through Him, we receive redemption, forgiveness of sins, and new life. He bridged the gap that separated us from the Father.',
          pdf: '/documents/new-believers-guide.pdf',
          audio: 'https://res.cloudinary.com/prayerdome/video/upload/salvation-m2.mp3',
          video: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          activity: 'Reflect on what redemption means to you personally and write a short sentence.',
          completed: false
        },
        {
          id: 'salvation-m3',
          title: 'Receiving Salvation',
          lesson: 'Salvation is received by grace through faith. It is not of works, lest anyone should boast. Repentance is a key step: turning away from sin and turning toward God. Accepting Christ involves believing in your heart and confessing with your mouth that Jesus is Lord. Living a changed life is the natural fruit of this transformation.',
          pdf: '/documents/new-believers-guide.pdf',
          audio: 'https://res.cloudinary.com/prayerdome/video/upload/salvation-m3.mp3',
          video: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          activity: 'Read Romans 10:9-10 and write down your declaration of faith.',
          completed: false
        },
        {
          id: 'salvation-m4',
          title: 'Living After Salvation',
          lesson: 'Living as a believer involves growth in grace. The key spiritual disciplines are prayer, Bible study, and fellowship with other believers. Obedience to God\'s Word and developing Christlike character are vital. We are called to serve others and share the good news with the world, walking in daily fellowship with the Holy Spirit.',
          pdf: '/documents/new-believers-guide.pdf',
          audio: 'https://res.cloudinary.com/prayerdome/video/upload/salvation-m4.mp3',
          video: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          activity: 'Plan a daily 10-minute prayer and Bible study routine and write it down.',
          completed: false
        }
      ],
      examQuestions: [
        {
          id: 'eq1',
          type: 'mc',
          text: 'According to Ephesians 2:8-9, salvation is by:',
          options: ['Our good deeds', 'Grace through faith', 'Church membership', 'Moral improvement'],
          correctIdx: 1,
          marks: 10,
          explanation: 'Ephesians 2:8-9 states: "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: Not of works, lest any man should boast."'
        },
        {
          id: 'eq2',
          type: 'mc',
          text: 'What does the word "Redemption" primarily mean in salvation?',
          options: ['Being well behaved', 'Bought back with a price', 'Attending weekly services', 'Bargaining with God'],
          correctIdx: 1,
          marks: 10,
          explanation: 'Redemption refers to being bought back or rescued from captivity through the sacrificial payment of Jesus\' blood.'
        },
        {
          id: 'eq3',
          type: 'tf',
          text: 'Salvation is a reward we earn by our moral improvement and good deeds.',
          options: ['True', 'False'],
          correctIdx: 1,
          marks: 10,
          explanation: 'False. Salvation is the free gift of God, received by grace through faith, not earned by our own efforts.'
        },
        {
          id: 'eq4',
          type: 'tf',
          text: 'Repentance involves a change of mind that leads to a change of action.',
          options: ['True', 'False'],
          correctIdx: 0,
          marks: 10,
          explanation: 'True. True repentance means turning away from sin and turning to God with a changed heart and action.'
        },
        {
          id: 'eq5',
          type: 'blank',
          text: 'Salvation comes through grace, by _______ (one word).',
          correctAnswer: 'faith',
          marks: 10,
          explanation: 'Salvation comes by grace through faith.'
        },
        {
          id: 'eq6',
          type: 'short',
          text: 'In your own words, briefly explain why humanity needs salvation from sin.',
          marks: 10,
          explanation: 'Written responses are submitted to the Admin for manual grading.'
        },
        {
          id: 'eq7',
          type: 'theory',
          text: 'Describe the key spiritual practices a believer should cultivate after receiving salvation, and explain how they foster growth.',
          marks: 20,
          explanation: 'Written responses are submitted to the Admin for manual grading.'
        }
      ]
    }
  ];

  function courseState() {
    var s = storeGet('pd_academy_courses_progress', { completedModules: {}, examSubmissions: {}, certificates: [] });
    if (!s.completedModules) s.completedModules = {};
    if (!s.examSubmissions) s.examSubmissions = {};
    if (!s.certificates) s.certificates = [];
    return s;
  }

  function saveCourseState(s) {
    return storeSet('pd_academy_courses_progress', s);
  }

  var activeCourseId = 'salvation';
  var activeModuleId = 'salvation-m1';
  var activeTab = 'lesson'; // lesson | pdf | audio | video | activity

  function initCoursesPage() {
    var grid = $('#coursesGrid');
    if (!grid) return;

    injectCoursesStyles();
    renderCoursesGrid();
  }

  function injectCoursesStyles() {
    if ($('#pdCoursesStyles')) return;
    var css = document.createElement('style');
    css.id = 'pdCoursesStyles';
    css.textContent = [
      '.pd-course-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 24px; padding: 24px; box-shadow: var(--pd-shadow-sm); cursor: pointer; transition: all 0.2s; }',
      '.pd-course-card:hover { transform: translateY(-4px); border-color: var(--pd-gold); }',
      '.pd-course-card h3 { font-family: "Poppins", sans-serif; font-size: 1.5rem; margin-bottom: 10px; color: var(--pd-blue); }',
      '.pd-course-card p { font-size: 0.88rem; color: var(--text-dim); line-height: 1.5; margin-bottom: 16px; }',
      '.course-progress-bar-wrap { width: 100%; height: 8px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin-top: 10px; }',
      '.course-progress-bar { height: 100%; background: var(--pd-blue); transition: width 0.3s; }',
      '.course-steps-tabbar { display: flex; gap: 6px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 6px; border-bottom: 1px solid var(--border); }',
      '.course-step-tab { flex: 1; min-width: 100px; text-align: center; padding: 12px 8px; font-size: 0.8rem; font-weight: 700; background: var(--bg-elev); border: 1px solid var(--border); border-radius: 12px; cursor: pointer; color: var(--text-dim); transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 4px; }',
      '.course-step-tab.active { background: var(--pd-blue); color: #fff; border-color: var(--pd-blue); }',
      '.course-step-tab i { font-size: 1.2rem; }',
      '.course-congrats-card { background: linear-gradient(135deg, rgba(34,197,94,0.1), rgba(10,77,155,0.05)); border: 2px solid #22c55e; padding: 30px; border-radius: 24px; text-align: center; margin-top: 30px; }',
      '.exam-modal { position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; padding: 20px; }',
      '.exam-modal-content { background: var(--bg-card); color: var(--text); width: 100%; max-width: 800px; max-height: 90vh; overflow-y: auto; border-radius: 28px; padding: 30px; border: 1px solid var(--border); box-shadow: var(--pd-shadow-lg); }',
      '.exam-question-card { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-bottom: 20px; }',
      '.exam-question-title { font-weight: 700; font-size: 1.05rem; margin-bottom: 12px; }',
      '.exam-review-card { border-left: 5px solid var(--border); padding-left: 16px; margin-bottom: 16px; }',
      '.exam-review-card.correct { border-left-color: #22c55e; }',
      '.exam-review-card.incorrect { border-left-color: var(--pd-red); }'
    ].join('\n');
    document.head.appendChild(css);
  }

  function getCourseProgress(courseId) {
    var state = courseState();
    var course = COURSES_DATA.find(function (c) { return c.id === courseId; });
    if (!course) return 0;
    var completedCount = 0;
    course.modules.forEach(function (m) {
      if (state.completedModules[m.id]) completedCount++;
    });
    return Math.round((completedCount / course.modules.length) * 100);
  }

  function renderCoursesGrid() {
    var grid = $('#coursesGrid');
    if (!grid) return;

    grid.innerHTML = COURSES_DATA.map(function (c) {
      var progress = getCourseProgress(c.id);
      return '<div class="pd-course-card" onclick="openCourse(\'' + c.id + '\')">' +
        '<h3>' + esc(c.title) + ' Course</h3>' +
        '<p>' + esc(c.description) + '</p>' +
        '<div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:700;">' +
          '<span>Progress</span>' +
          '<span>' + progress + '%</span>' +
        '</div>' +
        '<div class="course-progress-bar-wrap">' +
          '<div class="course-progress-bar" style="width: ' + progress + '%;"></div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  window.openCourse = function(courseId) {
    activeCourseId = courseId;
    var course = COURSES_DATA.find(function (c) { return c.id === courseId; });
    if (!course) return;

    activeModuleId = course.modules[0].id;
    activeTab = 'lesson';

    $('#courseReaderSection').style.display = 'grid';
    $('#courseReaderSection').scrollIntoView({ behavior: 'smooth' });

    renderCourseModules();
    renderCourseModuleReader();
  };

  function renderCourseModules() {
    var list = $('#courseModuleList');
    if (!list) return;

    var course = COURSES_DATA.find(function (c) { return c.id === activeCourseId; });
    var state = courseState();

    list.innerHTML = '<h3>Modules</h3>' + course.modules.map(function (m, idx) {
      var done = state.completedModules[m.id];
      var active = m.id === activeModuleId;
      return '<button class="pd-acad-lesson-link ' + (active ? 'is-active' : '') + '" onclick="selectCourseModule(\'' + m.id + '\')">' +
        '<small>Module ' + (idx + 1) + '</small>' +
        '<strong>' + esc(m.title) + '</strong>' +
        '<span>' + (done ? '<i class="pd-i pd-i-circle-check" aria-hidden="true"></i> Complete' : 'In Progress') + '</span>' +
      '</button>';
    }).join('');
  }

  window.selectCourseModule = function(moduleId) {
    activeModuleId = moduleId;
    activeTab = 'lesson';
    renderCourseModules();
    renderCourseModuleReader();
  };

  window.setCourseTab = function(tabName) {
    activeTab = tabName;
    renderCourseModuleReader();
  };

  function renderCourseModuleReader() {
    var reader = $('#courseReader');
    if (!reader) return;

    var course = COURSES_DATA.find(function (c) { return c.id === activeCourseId; });
    var m = course.modules.find(function (mod) { return mod.id === activeModuleId; });
    var state = courseState();
    var done = state.completedModules[m.id];
    var progress = getCourseProgress(activeCourseId);

    var isComplete = progress === 100;

    var tabsHtml = '<div class="course-steps-tabbar">' +
      '<button class="course-step-tab ' + (activeTab === 'lesson' ? 'active' : '') + '" onclick="setCourseTab(\'lesson\')"><i class="pd-i pd-i-book-open"></i> Lesson</button>' +
      '<button class="course-step-tab ' + (activeTab === 'pdf' ? 'active' : '') + '" onclick="setCourseTab(\'pdf\')"><i class="pd-i pd-i-file-text"></i> Study PDF</button>' +
      '<button class="course-step-tab ' + (activeTab === 'audio' ? 'active' : '') + '" onclick="setCourseTab(\'audio\')"><i class="pd-i pd-i-headphones"></i> Audio</button>' +
      '<button class="course-step-tab ' + (activeTab === 'video' ? 'active' : '') + '" onclick="setCourseTab(\'video\')"><i class="pd-i pd-i-video"></i> Video</button>' +
      '<button class="course-step-tab ' + (activeTab === 'activity' ? 'active' : '') + '" onclick="setCourseTab(\'activity\')"><i class="pd-i pd-i-notebook-pen"></i> Activity</button>' +
    '</div>';

    var tabContent = '';
    if (activeTab === 'lesson') {
      tabContent = '<div style="font-family:\'Lora\', serif; font-size:1.1rem; line-height:1.7; color:var(--text); max-height:400px; overflow-y:auto; padding-right:10px;">' +
        '<p>' + esc(m.lesson) + '</p>' +
      '</div>';
    } else if (activeTab === 'pdf') {
      tabContent = '<div style="text-align:center; padding:30px;">' +
        '<i class="pd-i pd-i-file-text" style="font-size:4rem; color:var(--pd-red); margin-bottom:16px;"></i>' +
        '<h3>Download Course Study Guide</h3>' +
        '<p style="margin-bottom:20px;">Download the official PDF Guide to study offline and follow along.</p>' +
        '<a class="pd-acad-btn pd-acad-btn-primary" href="' + esc(m.pdf) + '" download><i class="pd-i pd-i-download"></i> Download Study Guide</a>' +
      '</div>';
    } else if (activeTab === 'audio') {
      tabContent = '<div style="text-align:center; padding:30px;">' +
        '<i class="pd-i pd-i-circle-play" style="font-size:4rem; color:var(--pd-blue); margin-bottom:16px;"></i>' +
        '<h3>Audio Narration</h3>' +
        '<audio id="courseAudio" controls src="' + esc(m.audio) + '" style="width:100%; max-width:500px; margin:20px auto 10px; display:block;"></audio>' +
        '<p style="font-size:0.8rem; font-weight:700; color:var(--pd-gold); margin-top:12px;" id="courseAudioCredit">PrayerDome Team Production</p>' +
      '</div>';
      setTimeout(function() {
        var aud = document.getElementById('courseAudio');
        if (aud) {
          aud.addEventListener('ended', function() {
            var credit = document.getElementById('courseAudioCredit');
            if (credit) credit.textContent = "Produced by PrayerDome Team";
          });
        }
      }, 200);
    } else if (activeTab === 'video') {
      tabContent = '<div style="text-align:center; padding:20px;">' +
        '<div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:16px; border:1px solid var(--border);">' +
          '<iframe id="courseVideo" src="' + esc(m.video) + '" style="position:absolute; top:0; left:0; width:100%; height:100%;" frameborder="0" allowfullscreen></iframe>' +
        '</div>' +
        '<p style="font-size:0.8rem; font-weight:700; color:var(--pd-gold); margin-top:12px;">Produced by PrayerDome Team</p>' +
      '</div>';
    } else if (activeTab === 'activity') {
      tabContent = '<div>' +
        '<h4 style="margin-bottom:10px;"><i class="pd-i pd-i-circle-question-mark"></i> Module Activity Challenge:</h4>' +
        '<p style="font-weight:600; margin-bottom:14px; font-family:\'Lora\', serif;">' + esc(m.activity) + '</p>' +
        '<textarea id="activityReflection" class="form-control" rows="4" placeholder="Type your answer here..." style="width:100%; padding:12px; border-radius:12px; margin-bottom:16px;"></textarea>' +
        '<button class="pd-acad-btn pd-acad-btn-primary" onclick="submitCourseModuleActivity()"><i class="pd-i pd-i-circle-check"></i> Complete Module &amp; Save</button>' +
      '</div>';
    }

    reader.innerHTML = '<div class="pd-acad-meta">' +
      '<span class="pd-acad-chip"><i class="pd-i pd-i-scroll-text"></i> ' + esc(course.title) + '</span>' +
      '<span class="pd-acad-chip gold"><i class="pd-i pd-i-layers"></i> Discipleship Course</span>' +
    '</div>' +
    '<h2>' + esc(m.title) + '</h2>' +
    tabsHtml +
    '<div class="situation-card">' + tabContent + '</div>' +
    (isComplete ? renderCourseCongratsCard(course) : '');
  }

  function renderCourseCongratsCard(course) {
    var state = courseState();
    var hasSub = state.examSubmissions[course.id];
    var cert = state.certificates.find(function (c) { return c.courseId === course.id; });

    if (cert) {
      return '<div class="course-congrats-card">' +
        '<h2><i class="pd-i pd-i-graduation-cap" aria-hidden="true"></i> COURSE COMPLETED SUCCESSFULLY!</h2>' +
        '<p style="margin:12px 0 20px;">Congratulations! You have successfully completed the ' + esc(course.title) + ' course and passed the final exam.</p>' +
        '<button class="pd-acad-btn pd-acad-btn-primary" id="downloadCourseCertBtn"><i class="pd-i pd-i-download"></i> Download Official Certificate</button>' +
      '</div>';
    }

    if (hasSub) {
      return '<div class="course-congrats-card">' +
        '<h2><i class="pd-i pd-i-clipboard-check" aria-hidden="true"></i> Final Exam Submitted!</h2>' +
        '<p style="margin:12px 0 20px;">Your final exam answers have been submitted to the Pastor/Admin for grading. Once graded, your certificate will appear here.</p>' +
      '</div>';
    }

    return '<div class="course-congrats-card">' +
      '<h2><i class="pd-i pd-i-party-popper" aria-hidden="true"></i> Congratulations!</h2>' +
      '<p style="margin:12px 0 20px;">You have successfully read and completed all required modules in the <strong>' + esc(course.title) + '</strong> course!</p>' +
      '<button class="pd-acad-btn pd-acad-btn-primary" onclick="startFinalCourseExam()"><i class="pd-i pd-i-graduation-cap"></i> TAKE FINAL EXAM</button>' +
    '</div>';
  }

  window.submitCourseModuleActivity = function() {
    var text = ($('#activityReflection')?.value || '').trim();
    if (!text) return alert('Please enter your response before submitting.');

    var state = courseState();
    state.completedModules[activeModuleId] = true;
    saveCourseState(state);
    confetti({ particleCount: 100, spread: 60, origin: { y: 0.8 } });

    // Try next module
    var course = COURSES_DATA.find(function (c) { return c.id === activeCourseId; });
    var currentIdx = course.modules.findIndex(function (mod) { return mod.id === activeModuleId; });
    if (currentIdx + 1 < course.modules.length) {
      activeModuleId = course.modules[currentIdx + 1].id;
      activeTab = 'lesson';
      alert('Module complete! Proceeding to the next module.');
    } else {
      alert('Incredible work! You have completed all modules for this course.');
    }

    renderCoursesGrid();
    renderCourseModules();
    renderCourseModuleReader();
  };

  /* ==========================================================================
     Course Final Exam Engine
     ========================================================================== */
  var examAnswers = {};

  window.startFinalCourseExam = function() {
    var course = COURSES_DATA.find(function (c) { return c.id === activeCourseId; });
    
    var modal = document.createElement('div');
    modal.className = 'exam-modal';
    modal.id = 'examModal';
    modal.innerHTML = '<div class="exam-modal-content">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:10px;">' +
        '<h2><i class="pd-i pd-i-graduation-cap" style="color:var(--pd-gold);"></i> ' + esc(course.title) + ' Course - Final Exam</h2>' +
        '<button class="pd-acad-btn pd-acad-btn-ghost" onclick="document.getElementById(\'examModal\').remove()" aria-label="Close"><i class="pd-i pd-i-x"></i></button>' +
      '</div>' +
      '<p style="margin-bottom:20px; color:var(--text-dim); font-size:0.95rem;">This final exam contains multiple-choice, true/false, fill-in-the-blank, and written theory questions. Written questions will be manually graded by the Admin.</p>' +
      '<form id="examForm" onsubmit="submitFinalExam(event)">' +
        course.examQuestions.map(function (q, idx) {
          var inputHtml = '';
          if (q.type === 'mc') {
            inputHtml = q.options.map(function (opt, oIdx) {
              return '<label class="pd-acad-option" style="margin-bottom:8px; display:block;"><input type="radio" name="eq-' + q.id + '" value="' + oIdx + '" required> <span>' + esc(opt) + '</span></label>';
            }).join('');
          } else if (q.type === 'tf') {
            inputHtml = q.options.map(function (opt, oIdx) {
              return '<label class="pd-acad-option" style="margin-bottom:8px; display:block;"><input type="radio" name="eq-' + q.id + '" value="' + oIdx + '" required> <span>' + esc(opt) + '</span></label>';
            }).join('');
          } else if (q.type === 'blank') {
            inputHtml = '<input type="text" name="eq-' + q.id + '" class="form-control" placeholder="Type your single-word answer here" required style="width:100%; padding:10px; border-radius:10px;">';
          } else if (q.type === 'short') {
            inputHtml = '<input type="text" name="eq-' + q.id + '" class="form-control" placeholder="Write a short response..." required style="width:100%; padding:10px; border-radius:10px;">';
          } else if (q.type === 'theory') {
            inputHtml = '<textarea name="eq-' + q.id + '" class="form-control" rows="4" placeholder="Write a detailed theological reflection..." required style="width:100%; padding:10px; border-radius:10px;"></textarea>';
          }

          return '<div class="exam-question-card">' +
            '<div class="exam-question-title">' + (idx + 1) + '. ' + esc(q.text) + ' <span style="float:right; font-size:0.8rem; color:var(--pd-gold); font-weight:800;">[' + q.marks + ' Marks]</span></div>' +
            inputHtml +
          '</div>';
        }).join('') +
        '<button type="submit" class="pd-acad-btn pd-acad-btn-primary btn-block" style="margin-top:10px;"><i class="pd-i pd-i-send"></i> SUBMIT FINAL EXAM</button>' +
      '</form>' +
    '</div>';

    document.body.appendChild(modal);
  };

  window.submitFinalExam = async function(e) {
    e.preventDefault();
    var course = COURSES_DATA.find(function (c) { return c.id === activeCourseId; });
    var form = document.getElementById('examForm');
    var formData = new FormData(form);

    var totalAutoMarks = 0;
    var maxAutoMarks = 50; // MC + TF + Blank = 5 * 10 = 50
    var submissions = {};

    course.examQuestions.forEach(function (q) {
      var val = '';
      if (q.type === 'mc' || q.type === 'tf') {
        var selected = form.querySelector('input[name="eq-' + q.id + '"]:checked');
        val = selected ? selected.value : '';
      } else {
        val = form.querySelector('[name="eq-' + q.id + '"]').value.trim();
      }
      submissions[q.id] = val;
    });

    // Score auto-graded questions
    var correctCount = 0;
    var questionsReview = [];

    course.examQuestions.forEach(function (q) {
      var userAns = submissions[q.id];
      var isCorrect = false;
      var earnedMarks = 0;

      if (q.type === 'mc' || q.type === 'tf') {
        isCorrect = parseInt(userAns, 10) === q.correctIdx;
        earnedMarks = isCorrect ? q.marks : 0;
        if (isCorrect) correctCount++;
      } else if (q.type === 'blank') {
        isCorrect = userAns.toLowerCase() === q.correctAnswer.toLowerCase();
        earnedMarks = isCorrect ? q.marks : 0;
        if (isCorrect) correctCount++;
      } else {
        // Theory, short answers: to be graded manually
        isCorrect = null;
        earnedMarks = 0;
      }

      questionsReview.push({
        id: q.id,
        text: q.text,
        type: q.type,
        userAnswer: userAns,
        correctAnswer: q.type === 'blank' ? q.correctAnswer : (q.type === 'mc' || q.type === 'tf' ? q.options[q.correctIdx] : ''),
        isCorrect: isCorrect,
        earnedMarks: earnedMarks,
        maxMarks: q.marks,
        explanation: q.explanation
      });
    });

    var autoPercent = Math.round((correctCount / 5) * 100);

    // Save exam submission in local progress
    var state = courseState();
    state.examSubmissions[activeCourseId] = {
      date: new Date().toISOString(),
      score: autoPercent,
      autoPercent: autoPercent,
      correctCount: correctCount,
      submissions: submissions,
      questionsReview: questionsReview,
      status: 'Pending Grading'
    };
    saveCourseState(state);

    // Dynamic Firebase Submission for Admin Grading
    try {
      var profile = storeGet('pd_profile', null) || {};
      var submissionRef = {
        studentName: memberName(),
        studentEmail: profile.email || 'guest@prayerdome.net',
        studentUid: profile.uid || 'guest-uid-' + Date.now().toString(36),
        courseId: activeCourseId,
        courseTitle: course.title,
        autoPercent: autoPercent,
        autoScore: correctCount * 10,
        submissions: submissions,
        status: 'Pending Grading',
        createdAt: new Date().toISOString()
      };
      
      // Dynamic Firestore addDoc
      import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js").then(function(appMod) {
        import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js").then(function(fsMod) {
          var fbApp = appMod.initializeApp(FCM_CONFIG);
          var fbDb = fsMod.getFirestore(fbApp);
          fsMod.addDoc(fsMod.collection(fbDb, "finalExamSubmissions"), submissionRef).then(function() {
            console.log("Exam successfully submitted to Firestore!");
          });
        });
      });
    } catch(err) {
      console.warn("Could not save exam submission to Firebase:", err);
    }

    // Render detailed Review Page
    renderExamReviewPage(course, autoPercent, questionsReview);
  };

  function renderExamReviewPage(course, percent, review) {
    var modal = document.querySelector('.exam-modal-content');
    if (!modal) return;

    var passed = percent >= 80;

    modal.innerHTML = '<div style="margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:10px;">' +
      '<h2><i class="pd-i pd-i-clipboard-check" style="color:var(--pd-gold);"></i> Final Exam Review</h2>' +
    '</div>' +
    '<div class="glass-card" style="padding:20px; text-align:center; margin-bottom:24px; border:2px solid ' + (passed ? '#22c55e' : 'var(--pd-red)') + ';">' +
      '<h3>Auto-Graded Score: ' + percent + '%</h3>' +
      (passed ? '<p style="color:#22c55e; font-weight:700; font-size:1.1rem; margin-top:8px;"><i class="pd-i pd-i-party-popper" aria-hidden="true"></i> Congratulations! You passed the initial knowledge exam with ' + percent + '%.</p>' :
                '<p style="color:var(--pd-red); font-weight:700; font-size:1.1rem; margin-top:8px;">You scored ' + percent + '%. You need to retake the exam (80% auto-graded is required to pass).</p>') +
      '<p style="font-size:0.9rem; margin-top:8px; color:var(--text-dim);">Your theory and short answers have been submitted to the Admin for grading. Once graded, your certificate will be finalized!</p>' +
    '</div>' +
    '<h3>Question Breakdown:</h3>' +
    review.map(function (q, idx) {
      var isCorrect = q.isCorrect;
      var cardClass = isCorrect === true ? 'correct' : (isCorrect === false ? 'incorrect' : '');
      var indicator = isCorrect === true ? '<span style="color:#22c55e;"><i class="pd-i pd-i-circle-check" aria-hidden="true"></i> Correct</span>' : (isCorrect === false ? '<span style="color:var(--pd-red);"><i class="pd-i pd-i-circle-x" aria-hidden="true"></i> Wrong</span>' : '<span style="color:var(--pd-gold);"><i class="pd-i pd-i-pen-line" aria-hidden="true"></i> Pending Admin Grading</span>');

      return '<div class="exam-review-card ' + cardClass + '" style="background:var(--bg-elev); padding:16px; border-radius:12px; margin-bottom:12px; border-left:4px solid ' + (isCorrect === true ? '#22c55e' : (isCorrect === false ? 'var(--pd-red)' : 'var(--pd-gold)')) + ';">' +
        '<strong>Question ' + (idx + 1) + ': ' + esc(q.text) + '</strong>' +
        '<div style="font-size:0.88rem; margin:8px 0;">' +
          '<div>Your Answer: <em>' + esc(q.type === 'mc' || q.type === 'tf' ? q.userAnswer : q.userAnswer) + '</em></div>' +
          (q.type !== 'short' && q.type !== 'theory' ? '<div>Correct Answer: <strong>' + esc(q.correctAnswer) + '</strong></div>' : '') +
        '</div>' +
        '<div style="font-size:0.85rem; font-weight:700; margin-top:4px;">' + indicator + ' | Marks: ' + q.earnedMarks + ' / ' + q.maxMarks + '</div>' +
        '<p style="font-size:0.85rem; color:var(--text-dim); margin-top:6px; font-style:italic;">Explanation: ' + esc(q.explanation) + '</p>' +
      '</div>';
    }).join('') +
    '<div style="margin-top:20px; display:flex; gap:10px;">' +
      (passed ? '<button class="pd-acad-btn pd-acad-btn-primary btn-block" onclick="document.getElementById(\'examModal\').remove(); renderCourseModuleReader();"><i class="pd-i pd-i-arrow-right"></i> CONTINUE</button>' :
                '<button class="pd-acad-btn pd-acad-btn-primary btn-block" onclick="document.getElementById(\'examModal\').remove(); startFinalCourseExam();"><i class="pd-i pd-i-rotate-cw"></i> RETAKE EXAM</button>') +
    '</div>';
  }

  // Hook certificate button for course certificate
  setTimeout(function() {
    var state = courseState();
    var cert = state.certificates.find(function (c) { return c.courseId === 'salvation'; });
    if (cert) {
      var dlBtn = document.getElementById('downloadCourseCertBtn');
      if (dlBtn && window.PDCertificate) {
        window.PDCertificate.bindButton(dlBtn, {
          name: cert.name,
          course: 'Salvation Course',
          score: cert.score,
          id: cert.id,
          date: cert.date
        });
      }
    }
  }, 1000);

  document.addEventListener('DOMContentLoaded', function () { initLessonsPage(); initStoriesPage(); initResourcesPage(); initCoursesPage(); updateOverview(); syncMemberProfile(); });
  // Also sync shortly after load, in case pd-app's Firestore bindings and the
  // auth session land after DOMContentLoaded.
  setTimeout(syncMemberProfile, 2500);
  window.PD_ACADEMY_APP = { DATA: DATA, pct: pct, state: quizState, memberName: memberName, courseState: courseState, saveCourseState: saveCourseState, syncMemberProfile: syncMemberProfile };
})();

