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
      '.pd-course-card h3 { font-family: "Playfair Display", serif; font-size: 1.5rem; margin-bottom: 10px; color: var(--pd-blue); }',
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
        '<span>' + (done ? '✓ Complete' : 'In Progress') + '</span>' +
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
      '<button class="course-step-tab ' + (activeTab === 'lesson' ? 'active' : '') + '" onclick="setCourseTab(\'lesson\')"><i class="fas fa-book-open"></i> 📖 Lesson</button>' +
      '<button class="course-step-tab ' + (activeTab === 'pdf' ? 'active' : '') + '" onclick="setCourseTab(\'pdf\')"><i class="fas fa-file-pdf"></i> 📄 Study PDF</button>' +
      '<button class="course-step-tab ' + (activeTab === 'audio' ? 'active' : '') + '" onclick="setCourseTab(\'audio\')"><i class="fas fa-headphones"></i> 🎧 Audio</button>' +
      '<button class="course-step-tab ' + (activeTab === 'video' ? 'active' : '') + '" onclick="setCourseTab(\'video\')"><i class="fas fa-video"></i> 🎥 Video</button>' +
      '<button class="course-step-tab ' + (activeTab === 'activity' ? 'active' : '') + '" onclick="setCourseTab(\'activity\')"><i class="fas fa-pen-clip"></i> 📝 Activity</button>' +
    '</div>';

    var tabContent = '';
    if (activeTab === 'lesson') {
      tabContent = '<div style="font-family:\'Lora\', serif; font-size:1.1rem; line-height:1.7; color:var(--text); max-height:400px; overflow-y:auto; padding-right:10px;">' +
        '<p>' + esc(m.lesson) + '</p>' +
      '</div>';
    } else if (activeTab === 'pdf') {
      tabContent = '<div style="text-align:center; padding:30px;">' +
        '<i class="fas fa-file-pdf" style="font-size:4rem; color:var(--pd-red); margin-bottom:16px;"></i>' +
        '<h3>Download Course Study Guide</h3>' +
        '<p style="margin-bottom:20px;">Download the official PDF Guide to study offline and follow along.</p>' +
        '<a class="pd-acad-btn pd-acad-btn-primary" href="' + esc(m.pdf) + '" download><i class="fas fa-download"></i> Download Study Guide</a>' +
      '</div>';
    } else if (activeTab === 'audio') {
      tabContent = '<div style="text-align:center; padding:30px;">' +
        '<i class="fas fa-circle-play" style="font-size:4rem; color:var(--pd-blue); margin-bottom:16px;"></i>' +
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
        '<h4 style="margin-bottom:10px;"><i class="fas fa-question-circle"></i> Module Activity Challenge:</h4>' +
        '<p style="font-weight:600; margin-bottom:14px; font-family:\'Lora\', serif;">' + esc(m.activity) + '</p>' +
        '<textarea id="activityReflection" class="form-control" rows="4" placeholder="Type your answer here..." style="width:100%; padding:12px; border-radius:12px; margin-bottom:16px;"></textarea>' +
        '<button class="pd-acad-btn pd-acad-btn-primary" onclick="submitCourseModuleActivity()"><i class="fas fa-check-circle"></i> Complete Module &amp; Save</button>' +
      '</div>';
    }

    reader.innerHTML = '<div class="pd-acad-meta">' +
      '<span class="pd-acad-chip"><i class="fas fa-scroll"></i> ' + esc(course.title) + '</span>' +
      '<span class="pd-acad-chip gold"><i class="fas fa-layer-group"></i> Discipleship Course</span>' +
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
        '<h2>🎓 COURSE COMPLETED SUCCESSFULLY!</h2>' +
        '<p style="margin:12px 0 20px;">Congratulations! You have successfully completed the ' + esc(course.title) + ' course and passed the final exam.</p>' +
        '<button class="pd-acad-btn pd-acad-btn-primary" id="downloadCourseCertBtn"><i class="fas fa-download"></i> Download Official Certificate</button>' +
      '</div>';
    }

    if (hasSub) {
      return '<div class="course-congrats-card">' +
        '<h2>📝 Final Exam Submitted!</h2>' +
        '<p style="margin:12px 0 20px;">Your final exam answers have been submitted to the Pastor/Admin for grading. Once graded, your certificate will appear here.</p>' +
      '</div>';
    }

    return '<div class="course-congrats-card">' +
      '<h2>🎉 Congratulations!</h2>' +
      '<p style="margin:12px 0 20px;">You have successfully read and completed all required modules in the <strong>' + esc(course.title) + '</strong> course!</p>' +
      '<button class="pd-acad-btn pd-acad-btn-primary" onclick="startFinalCourseExam()"><i class="fas fa-graduation-cap"></i> TAKE FINAL EXAM</button>' +
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
      alert('✓ Module complete! Proceeding to the next module.');
    } else {
      alert('🎉 Incredible work! You have completed all modules for this course.');
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
        '<h2><i class="fas fa-graduation-cap" style="color:var(--pd-gold);"></i> ' + esc(course.title) + ' Course - Final Exam</h2>' +
        '<button class="pd-acad-btn pd-acad-btn-ghost" onclick="document.getElementById(\'examModal\').remove()"><i class="fas fa-times"></i></button>' +
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
        '<button type="submit" class="pd-acad-btn pd-acad-btn-primary btn-block" style="margin-top:10px;"><i class="fas fa-paper-plane"></i> SUBMIT FINAL EXAM</button>' +
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
      '<h2><i class="fas fa-clipboard-check" style="color:var(--pd-gold);"></i> Final Exam Review</h2>' +
    '</div>' +
    '<div class="glass-card" style="padding:20px; text-align:center; margin-bottom:24px; border:2px solid ' + (passed ? '#22c55e' : 'var(--pd-red)') + ';">' +
      '<h3>Auto-Graded Score: ' + percent + '%</h3>' +
      (passed ? '<p style="color:#22c55e; font-weight:700; font-size:1.1rem; margin-top:8px;">🎉 Congratulations! You passed the initial knowledge exam with ' + percent + '%.</p>' :
                '<p style="color:var(--pd-red); font-weight:700; font-size:1.1rem; margin-top:8px;">You scored ' + percent + '%. You need to retake the exam (80% auto-graded is required to pass).</p>') +
      '<p style="font-size:0.9rem; margin-top:8px; color:var(--text-dim);">Your theory and short answers have been submitted to the Admin for grading. Once graded, your certificate will be finalized!</p>' +
    '</div>' +
    '<h3>Question Breakdown:</h3>' +
    review.map(function (q, idx) {
      var isCorrect = q.isCorrect;
      var cardClass = isCorrect === true ? 'correct' : (isCorrect === false ? 'incorrect' : '');
      var indicator = isCorrect === true ? '<span style="color:#22c55e;">✓ Correct</span>' : (isCorrect === false ? '<span style="color:var(--pd-red);">❌ Wrong</span>' : '<span style="color:var(--pd-gold);">✍ Pending Admin Grading</span>');

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
      (passed ? '<button class="pd-acad-btn pd-acad-btn-primary btn-block" onclick="document.getElementById(\'examModal\').remove(); renderCourseModuleReader();"><i class="fas fa-arrow-right"></i> CONTINUE</button>' :
                '<button class="pd-acad-btn pd-acad-btn-primary btn-block" onclick="document.getElementById(\'examModal\').remove(); startFinalCourseExam();"><i class="fas fa-redo"></i> RETAKE EXAM</button>') +
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

  document.addEventListener('DOMContentLoaded', function () { initLessonsPage(); initStoriesPage(); initResourcesPage(); initCoursesPage(); updateOverview(); });
  window.PD_ACADEMY_APP = { DATA: DATA, pct: pct, state: quizState, memberName: memberName, courseState: courseState, saveCourseState: saveCourseState };
})();

