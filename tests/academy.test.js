const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function t(name, ok, extra = '') { ok ? pass++ : fail++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  ' + extra : '')); }

function loadAcademy() {
  const sandbox = { window: {} };
  sandbox.window.PD_ACADEMY = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets', 'pd-academy-data.js'), 'utf8'), sandbox);
  return sandbox.window.PD_ACADEMY.DATA;
}

const data = loadAcademy();
t('academy data has six learning tracks', data.tracks.length === 6, data.tracks.length);
t('academy data has at least 18 lessons', data.lessons.length >= 18, data.lessons.length);
t('academy data has at least 10 stories', data.stories.length >= 10, data.stories.length);
t('academy data has at least six resources', data.resources.length >= 6, data.resources.length);
t('every lesson has a linked quiz', data.lessons.every(l => data.quizzes.some(q => q.id === l.quizId)));
t('every quiz has six questions and 80% pass mark', data.quizzes.every(q => q.questions.length === 6 && q.passingScore === 80));
t('every lesson contains detailed teaching sections', data.lessons.every(l => Array.isArray(l.sections) && l.sections.length >= 5 && l.reflection.length >= 4));
t('every resource file exists on disk', data.resources.every(r => fs.existsSync(path.join(ROOT, (r.downloadUrl || r.url).replace(/^\//, '')))));
t('every story links to a valid lesson', data.stories.every(s => data.lessons.some(l => l.id === s.lessonId)));
t('lesson ids are unique', new Set(data.lessons.map(l => l.id)).size === data.lessons.length);

const requiredFiles = [
  path.join('api', 'academy.js'),
  path.join('assets', 'pd-academy.js'),
  path.join('assets', 'pd-academy-data.js'),
  path.join('assets', 'pd-certificate.js'),
  'lessons.html', 'stories.html', 'resources.html', 'resource-view.html'
];
for (const f of requiredFiles) t(f + ' exists', fs.existsSync(path.join(ROOT, f)));
for (const f of ['lessons', 'stories', 'quizzes', 'resources', 'progress', 'academy']) {
  const handler = require(path.join(ROOT, 'api', f + '.js'));
  let body;
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(x) { body = x; } };
  handler({ headers: { host: 'prayerdome.net', 'x-forwarded-proto': 'https' } }, res);
  const json = JSON.parse(body);
  t('/api/' + f + ' returns success', res.statusCode === 200 && json.success === true);
}

const quizHtml = fs.readFileSync(path.join(ROOT, 'quiz.html'), 'utf8');
t('quiz page includes academy teaching quizzes', quizHtml.includes('Teaching Quizzes & Certificates') && quizHtml.includes('academyQuizGrid'));
t('quiz page supports certificate downloads', quizHtml.includes('pd-certificate.js') && quizHtml.includes('PDCertificate.bindButton') && quizHtml.includes('Download Certificate'));
t('quiz page records earned certificates for admin tracking', quizHtml.includes('doc(db, "certificates", certId)') && quizHtml.includes('increment(1)'));

const lessonsHtml = fs.readFileSync(path.join(ROOT, 'lessons.html'), 'utf8');
t('lessons page supports certificate downloads', lessonsHtml.includes('pd-certificate.js'));

const academyJs = fs.readFileSync(path.join(ROOT, 'assets', 'pd-academy.js'), 'utf8');
t('academy runtime offers certificate downloads', academyJs.includes('PDCertificate.bindButton') && academyJs.includes('Download Certificate'));

(function () {
  const sandbox = { window: {}, console };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets', 'pd-certificate.js'), 'utf8'), sandbox);
  t('certificate module exposes download API', sandbox.window.PDCertificate && typeof sandbox.window.PDCertificate.download === 'function' && typeof sandbox.window.PDCertificate.bindButton === 'function');
})();

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
t('home links teaching, stories and resources', ['/lessons.html', '/stories.html', '/resources.html'].every(u => indexHtml.includes(u)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
