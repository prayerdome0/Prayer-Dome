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
    try {
      var p = storeGet('pd_profile', null) || storeGet('pd_account_profile', null) || storeGet('prayerdome_user_profile', null);
      if (p && p.fullName) return p.fullName;
    } catch (e) {}
    return localStorage.getItem('pd_certificate_name') || 'Prayer Dome Member';
  }
  function pct() {
    var total = DATA.lessons.length || 1;
    return Math.round((quizState().completedLessons.length / total) * 100);
  }
  function iconFor(trackId) { var t = DATA.tracks.filter(function (x) { return x.id === trackId; })[0]; return t ? t.icon : 'fa-book'; }
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
        '<div class="pd-acad-icon ' + (t.color === 'gold' ? 'gold' : '') + '"><i class="fas ' + esc(t.icon) + '"></i></div>' +
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
        '<small><i class="fas ' + esc(l.icon) + '"></i> ' + esc(tr('academy.track.'+l.trackId, l.track)) + '</small>' +
        '<strong>' + esc(l.order + '. ' + l.title) + '</strong>' +
        '<span>' + esc(l.minutes + ' min · ' + l.level + (done ? ' · ✓ Read' : '') + (passed ? ' · Certificate earned' : '')) + '</span></button>';
    }).join('');
    $$('[data-lesson]', root).forEach(function (b) { b.addEventListener('click', function () { location.hash = '#lesson/' + b.getAttribute('data-lesson'); }); });
  }
  function renderLesson(id) {
    var l = DATA.lessons.filter(function (x) { return x.id === id; })[0] || DATA.lessons[0];
    var reader = $('#lessonReader'); if (!reader || !l) return;
    var q = DATA.quizzes.filter(function (x) { return x.id === l.quizId; })[0];
    var state = quizState();
    var passed = state.passedQuizzes[l.quizId];
    // Pick a fresh random set of questions for this attempt so a retake never
    // shows the exact same quiz twice.
    var sample = q ? sampleQuizQuestions(q, 5) : null;
    var canNext = !q || !!passed;
    reader.innerHTML =
      '<div class="pd-acad-meta"><span class="pd-acad-chip"><i class="fas ' + esc(l.icon) + '"></i> ' + esc(l.track) + '</span>' +
      '<span class="pd-acad-chip gold"><i class="fas fa-clock"></i> ' + l.minutes + ' min</span>' +
      '<span class="pd-acad-chip"><i class="fas fa-layer-group"></i> ' + esc(l.level) + '</span></div>' +
      '<h2>' + esc(l.title) + '</h2><p class="subtitle">' + esc(l.subtitle) + '</p>' +
      '<div class="pd-acad-callout"><strong>Key Scripture:</strong> ' + esc(l.scripture) + '<br>' + esc(l.summary) + '</div>' +
      '<div class="pd-acad-callout"><strong>Opening Prayer</strong><br>' + esc(l.openingPrayer) + '</div>' +
      l.sections.map(function (s) { return '<h4>' + esc(s.heading) + '</h4><p>' + esc(s.body) + '</p>'; }).join('') +
      '<h4>Reflection Questions</h4><ul>' + l.reflection.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' +
      '<div class="pd-acad-callout"><strong>Action Step:</strong> ' + esc(l.action) + '</div>' +
      '<div class="pd-acad-hero-actions">' +
        '<button class="pd-acad-btn pd-acad-btn-primary" id="markReadBtn"><i class="fas fa-check"></i> Mark Lesson Complete</button>' +
        (q ? '<button class="pd-acad-btn pd-acad-btn-secondary" id="startQuizBtn"><i class="fas fa-star"></i> Take Linked Quiz</button>' : '') +
        ((canNext || state.completedLessons.indexOf(l.id) >= 0) && l.nextLessonId ? '<a class="pd-acad-btn pd-acad-btn-ghost" href="#lesson/' + esc(l.nextLessonId) + '">Next lesson <i class="fas fa-arrow-right"></i></a>' : '') +
      '</div>' +
      (q ? renderQuiz(q, passed, sample) : '');
    if (state.completedLessons.indexOf(l.id) < 0) {
      $('#markReadBtn').addEventListener('click', function () {
        state = quizState(); if (state.completedLessons.indexOf(l.id) < 0) state.completedLessons.push(l.id); saveState(state);
        updateOverview(); renderLessonList($('#lessonList'), l.id);
        b(this, '✓ Lesson Complete');
      });
    } else { b($('#markReadBtn'), '✓ Completed'); }
    var sq = $('#startQuizBtn'); if (sq) sq.addEventListener('click', function () { var qz = $('#academyQuiz'); qz.style.display = 'block'; qz.scrollIntoView({ behavior: 'smooth' }); });
    wireQuiz(q, l, sample);
  }
  function sampleQuizQuestions(q, count) {
    var pool = q.questions.map(function (raw, i) { return { raw: raw, id: i }; });
    pool = shuffle(pool).slice(0, Math.min(count, pool.length));
    return pool.map(function (p) {
      return { id: p.id, text: p.raw[0], options: shuffle([{ t: p.raw[1], correct: p.raw[5] === 0 }, { t: p.raw[2], correct: p.raw[5] === 1 }, { t: p.raw[3], correct: p.raw[5] === 2 }, { t: p.raw[4], correct: p.raw[5] === 3 }]) };
    });
  }
  function b(el, txt) { if (el) el.innerHTML = '<i class="fas fa-check"></i> ' + esc(txt); el.disabled = true; }
  function renderQuiz(q, passed, questions) {
    questions = questions || sampleQuizQuestions(q, 5);
    return '<div class="pd-acad-quiz" id="academyQuiz" style="display:' + (passed ? 'block' : 'none') + '"><h3><i class="fas fa-certificate"></i> Knowledge Check</h3>' +
      '<p>' + esc(q.description) + '</p>' +
      questions.map(function (qz, i) {
        return '<div class="pd-acad-quiz-q"><p>' + (i + 1) + '. ' + esc(qz.text) + '</p>' + qz.options.map(function (op) {
          return '<label class="pd-acad-option"><input type="radio" name="q' + q.id + '-' + qz.id + '" value="' + (op.correct ? '1' : '0') + '"><span>' + esc(op.t) + '</span></label>';
        }).join('') + '</div>';
      }).join('') +
      '<button class="pd-acad-btn pd-acad-btn-primary" id="submitAcademyQuiz"><i class="fas fa-paper-plane"></i> Submit Quiz</button>' +
      '<div id="academyQuizResult"></div></div>';
  }
  function wireQuiz(q, lesson, questions) {
    var btn = $('#submitAcademyQuiz'); if (!btn) return;
    questions = questions || sampleQuizQuestions(q, 5);
    btn.addEventListener('click', function () {
      var score = 0; var total = questions.length;
      questions.forEach(function (qz) {
        var selected = $('input[name="q' + q.id + '-' + qz.id + '"]:checked');
        if (selected && selected.value === '1') score++;
      });
      var percent = Math.round((score / total) * 100);
      var state = quizState();
      var result = $('#academyQuizResult');
      if (percent >= q.passingScore) {
        state.passedQuizzes[q.id] = { score: percent, date: new Date().toISOString(), lessonId: lesson.id };
        if (state.completedLessons.indexOf(lesson.id) < 0) state.completedLessons.push(lesson.id);
        var certId = 'PD-' + lesson.id.toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
        state.certificates.push({ id: certId, lessonId: lesson.id, title: lesson.title, score: percent, date: new Date().toISOString(), name: memberName() });
        saveState(state);
        result.innerHTML = '<div class="pd-acad-cert">' +
          '<img class="pd-acad-cert-logo" src="/assets/logo.png" alt="Prayer Dome logo">' +
          '<span class="pd-acad-cert-brand">Prayer Dome Academy</span>' +
          '<h3>Certificate of Completion</h3>' +
          '<p>This certifies that</p>' +
          '<div class="name">' + esc(memberName()) + '</div>' +
          '<p>has successfully completed</p>' +
          '<h3 class="cert-course">' + esc(lesson.title) + '</h3>' +
          '<p class="cert-meta">Score: ' + percent + '% · Certificate ID: ' + esc(certId) + '</p>' +
          '<p class="pd-acad-cert-verse">“He does everything blamelessly.” — Mark 7:37</p>' +
          '<div class="pd-acad-cert-foot">' +
            '<div class="pd-acad-cert-sign"><span class="sig">Prayer Dome</span><em>Ministry Team</em></div>' +
            '<div class="pd-acad-cert-seal"><i class="fas fa-award"></i></div>' +
          '</div>' +
          '<div class="pd-acad-cert-actions no-print">' +
          '<button class="pd-acad-btn pd-acad-btn-primary" id="downloadCertBtn"><i class="fas fa-download"></i> Download Certificate</button> ' +
          '<button class="pd-acad-btn pd-acad-btn-secondary" onclick="window.print()"><i class="fas fa-print"></i> Print / Save</button>' +
          (lesson.nextLessonId ? ' <a class="pd-acad-btn pd-acad-btn-ghost" href="#lesson/' + esc(lesson.nextLessonId) + '">Next lesson <i class="fas fa-arrow-right"></i></a>' : '') +
          '</div></div>';
        var dlBtn = $('#downloadCertBtn');
        if (dlBtn) {
          if (window.PDCertificate) {
            window.PDCertificate.bindButton(dlBtn, { name: memberName(), course: lesson.title, score: percent, id: certId, date: new Date().toISOString() });
          } else {
            dlBtn.style.display = 'none';
          }
        }
        // Re-render the lesson to show the next button now that it's completed
        renderLesson(lesson.id);
        updateOverview(); renderLessonList($('#lessonList'), lesson.id);
      } else {
        result.innerHTML = '<div class="pd-acad-callout"><strong>Almost there.</strong> You scored ' + percent + '%. Review the lesson and try again — 80% is required to earn your certificate. The questions change on each attempt.</div>' +
          '<div class="pd-acad-hero-actions" style="margin-top:14px"><button class="pd-acad-btn pd-acad-btn-primary" id="retakeAcademyQuizBtn"><i class="fas fa-redo"></i> Retake Quiz</button></div>';
        var rt = $('#retakeAcademyQuizBtn');
        if (rt) rt.addEventListener('click', function () { renderLesson(lesson.id); var qz = $('#academyQuiz'); if (qz) { qz.style.display = 'block'; qz.scrollIntoView({ behavior: 'smooth' }); } });
      }
      result.scrollIntoView({ behavior: 'smooth' });
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
    updateOverview(); renderTrackCards($('#trackGrid'));
    var params = new URLSearchParams(location.search);
    var track = params.get('track');
    var list = $('#lessonList');
    function refreshList() {
      if (!list) return;
      var filtered = track ? DATA.lessons.filter(function (l) { return l.trackId === track; }) : DATA.lessons;
      var state = quizState();
      list.innerHTML = filtered.map(function (l) {
        var done = state.completedLessons.indexOf(l.id) >= 0;
        return '<button class="pd-acad-lesson-link" data-lesson="' + esc(l.id) + '"><small><i class="fas ' + esc(l.icon) + '"></i> ' + esc(l.track) + '</small><strong>' + esc(l.order + '. ' + l.title) + '</strong><span>' + l.minutes + ' min · ' + esc(l.level) + (done ? ' · ✓ Read' : '') + '</span></button>';
      }).join('');
      $$('[data-lesson]', list).forEach(function (b) { b.addEventListener('click', function () { location.hash = '#lesson/' + b.getAttribute('data-lesson'); }); });
    }
    refreshList();
    function route() {
      var h = location.hash || ''; var id = h.indexOf('#lesson/') === 0 ? h.split('/')[1] : DATA.lessons[0].id;
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
        return '<article class="pd-acad-card pd-lift pd-acad-story"><img src="' + esc(s.image) + '" alt=""><div><div class="pd-acad-meta"><span class="pd-acad-chip gold">' + esc(s.category) + '</span><span class="pd-acad-chip"><i class="fas fa-clock"></i> ' + s.readingTime + ' min</span></div><h3>' + esc(s.title) + '</h3><p>' + esc(s.excerpt) + '</p><p style="margin-top:12px">' + s.body.slice(0, 2).map(esc).join(' ') + '</p><div class="pd-acad-hero-actions"><a class="pd-acad-btn pd-acad-btn-secondary" href="/stories?story=' + encodeURIComponent(s.id) + '"><i class="fas fa-book-open"></i> Read</a>' + (lesson ? '<a class="pd-acad-btn pd-acad-btn-ghost" href="/lessons?track=' + encodeURIComponent(lesson.trackId) + '#lesson/' + encodeURIComponent(lesson.id) + '">Linked lesson</a>' : '') + '</div></div></article>';
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
      '<div style="display:flex;justify-content:space-between;gap:16px;align-items:start"><div><span class="pd-acad-chip gold">' + esc(s.category) + '</span><h2 style="font-family:Playfair Display,Georgia,serif;color:var(--pd-acad-blue);margin:12px 0">' + esc(s.title) + '</h2><p style="color:var(--pd-acad-muted)">By ' + esc(s.author) + ' · ' + s.readingTime + ' min read</p></div><button class="pd-acad-btn pd-acad-btn-ghost" data-close><i class="fas fa-times"></i></button></div>' +
      '<img src="' + esc(s.image) + '" style="width:100%;height:280px;object-fit:cover;border-radius:22px;margin:18px 0">' +
      '<div class="pd-acad-story-body">' + s.body.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>' +
      '<div class="pd-acad-callout"><strong>Reflection:</strong> ' + esc(s.prompt) + '</div><a class="pd-acad-btn pd-acad-btn-primary" href="/lessons#lesson/' + encodeURIComponent(s.lessonId) + '"><i class="fas fa-arrow-right"></i> Continue to lesson</a></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay || e.target.closest('[data-close]')) overlay.remove(); });
  }
  function initResourcesPage() {
    if (!$('[data-page="resources"]')) return;
    updateOverview();
    var grid = $('#resourceGrid'); if (!grid) return;
    grid.innerHTML = DATA.resources.map(function (r) {
      return '<article class="pd-acad-card pd-lift pd-acad-resource"><div class="pd-acad-icon gold"><i class="fas ' + esc(r.icon) + '"></i></div><div style="flex:1"><h3>' + esc(r.title) + '</h3><p>' + esc(r.description) + '</p><div class="pd-acad-meta"><span class="pd-acad-chip">' + esc(r.category) + '</span><span class="pd-acad-chip gold">' + esc(r.format) + '</span><span class="pd-acad-chip">' + esc(r.version) + '</span></div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="pd-acad-btn pd-acad-btn-secondary" href="' + esc(r.url) + '"><i class="fas fa-eye"></i> Read</a><a class="pd-acad-btn pd-acad-btn-primary" href="' + esc(r.downloadUrl || r.url) + '" download><i class="fas fa-download"></i> Download</a></div></article>';
    }).join('');
  }

  document.addEventListener('pd:lang', function() {
    try {
      renderTrackCards(document.getElementById('trackGrid'));
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
              return '<article class="pd-acad-card pd-lift pd-acad-resource"><div class="pd-acad-icon gold"><i class="fas ' + esc(r.icon) + '"></i></div><div style="flex:1"><h3>' + esc(r.title) + '</h3><p>' + esc(r.description) + '</p><div class="pd-acad-meta"><span class="pd-acad-chip">' + esc(r.category) + '</span><span class="pd-acad-chip gold">' + esc(r.format) + '</span><span class="pd-acad-chip">' + esc(r.version) + '</span></div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="pd-acad-btn pd-acad-btn-secondary" href="' + esc(r.url) + '"><i class="fas fa-eye"></i> ' + tr('action.read','Read') + '</a><a class="pd-acad-btn pd-acad-btn-primary" href="' + esc(r.downloadUrl || r.url) + '" download><i class="fas fa-download"></i> ' + tr('action.download','Download') + '</a></div></article>';
            }).join('');
          }
        }
      }
      // translate static hero texts via data-pd-t already handled by pd-app, but also translate known hard-coded strings
      var heroTitle = document.querySelector('.pd-acad-hero h1[data-pd-t]');
      // pd-app will handle data-pd-t automatically, no need here
    } catch(e){}
  });

  document.addEventListener('DOMContentLoaded', function () { initLessonsPage(); initStoriesPage(); initResourcesPage(); updateOverview(); });
  window.PD_ACADEMY_APP = { DATA: DATA, pct: pct, state: quizState, memberName: memberName };
})();
