'use strict';

function getAcademyData() {
  if (typeof window !== 'undefined' && window.PD_ACADEMY && window.PD_ACADEMY.DATA) {
    return window.PD_ACADEMY.DATA;
  }
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const sandbox = { window: {} };
  sandbox.window.PD_ACADEMY = {};
  const file = path.join(__dirname, '..', 'assets', 'pd-academy-data.js');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: 'pd-academy-data.js' });
  return sandbox.window.PD_ACADEMY.DATA;
}

function send(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  if (res) {
    res.statusCode = status;
    if (typeof res.setHeader === 'function') res.setHeader('Content-Type', 'application/json');
    if (typeof res.setHeader === 'function') res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.end(body);
  }
  return { statusCode: status, body: body };
}

function summaryLesson(l) {
  return {
    id: l.id, trackId: l.trackId, track: l.track, title: l.title, subtitle: l.subtitle,
    scripture: l.scripture, summary: l.summary, level: l.level, minutes: l.minutes,
    objectives: l.objectives, quizId: l.quizId, nextLessonId: l.nextLessonId
  };
}

function handler(req, res) {
  const academy = getAcademyData();
  const headers = (req && req.headers) || {};
  const base = (headers['x-forwarded-proto'] || 'https') + '://' + (headers.host || 'prayerdome.net');
  return send(res, 200, {
    success: true,
    version: academy.version,
    counts: {
      tracks: academy.tracks.length, lessons: academy.lessons.length,
      stories: academy.stories.length, quizzes: academy.quizzes.length,
      resources: academy.resources.length
    },
    tracks: academy.tracks,
    lessons: academy.lessons.map(summaryLesson),
    stories: academy.stories.map(s => ({
      id: s.id, title: s.title, category: s.category, excerpt: s.excerpt,
      readingTime: s.readingTime, author: s.author, date: s.date, image: s.image,
      lessonId: s.lessonId, url: base + '/stories?story=' + encodeURIComponent(s.id)
    })),
    resources: academy.resources.map(r => ({ ...r, url: base + r.url, downloadUrl: base + (r.downloadUrl || r.url) }))
  });
}

if (typeof window !== 'undefined') window.PDAcademyAPI = { handler: handler, data: getAcademyData };
if (typeof module !== 'undefined') {
  module.exports = handler;
  module.exports.handler = handler;
  module.exports.getAcademyData = getAcademyData;
}
