'use strict';

/**
 * Public News API.
 *
 * The same seed module is consumed in the browser and in this function. Live
 * administrator edits continue to come from Firestore in the browser; this
 * endpoint provides a reliable, non-empty public fallback for server-side and
 * external consumers.
 */

const CONTENT = (typeof window !== 'undefined' && window.PD_CONTENT)
  ? window.PD_CONTENT
  : require('../assets/pd-content-data.js');
const DEFAULT_NEWS = Array.isArray(CONTENT.DEFAULT_NEWS) ? CONTENT.DEFAULT_NEWS : [];

function getNews() {
  if (typeof window === 'undefined') {
    return DEFAULT_NEWS.filter(function (item) { return item && item.published !== false; });
  }

  try {
    var store = window.PDApp && window.PDApp.store;
    if (store) {
      var all = store.get('news', 'DEFAULT_NEWS') || [];
      return all.filter(function (item) { return item && item.published !== false; });
    }
  } catch (_error) { /* use the built-in fallback */ }

  return DEFAULT_NEWS.filter(function (item) { return item && item.published !== false; });
}

function serialize(item) {
  return {
    id: item.id || '',
    title: item.title || '',
    category: item.category || 'Ministry News',
    summary: item.summary || '',
    body: item.body || '',
    image: item.image || item.featuredImage || '/assets/hero-worship.jpg',
    socialImage: item.socialImage || item.featuredImage || item.image || '/assets/og-image.png',
    author: item.author || 'Prayer Dome Media Team',
    date: item.date ? (typeof item.date === 'string' ? item.date : item.date.toISOString()) : null,
    featured: Boolean(item.featured),
    published: item.published !== false,
    url: '/news/' + encodeURIComponent(item.id || '')
  };
}

function send(res, status, payload, method) {
  const body = JSON.stringify(payload, null, 2);
  if (!res) return body;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', status === 200
    ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600'
    : 'no-store');
  if (method === 'HEAD') return res.end();
  return res.end(body);
}

function handler(req, res) {
  const method = (req && req.method) || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    if (res && res.setHeader) res.setHeader('Allow', 'GET, HEAD');
    return send(res, 405, { success: false, error: 'Method not allowed' }, method);
  }

  const items = getNews().slice(0, 20).map(serialize);
  return send(res, 200, {
    success: true,
    count: items.length,
    stories: items
  }, method);
}

if (typeof window !== 'undefined') {
  window.PDApp = window.PDApp || {};
  window.PDApp.getNews = getNews;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.handler = handler;
  module.exports.getNews = getNews;
}
