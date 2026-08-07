'use strict';

/**
 * News API endpoint.
 * Returns the 20 most recent published news stories as JSON.
 * Used by the News Center (/news.html) and any external consumers.
 *
 * This module reuses the PDApp news store when running client-side,
 * and falls back to a static JSON response for server-side/SSR usage.
 */

const DEFAULT_NEWS = (typeof window !== 'undefined' && window.PD_CONTENT && window.PD_CONTENT.DEFAULT_NEWS)
  ? window.PD_CONTENT.DEFAULT_NEWS
  : [];

function getNews() {
  // When running in Node (serverless), PD_CONTENT won't be available.
  // In that case return the static seed — admin edits live in Firestore
  // and are fetched client-side by pd-app.js.
  if (typeof module !== 'undefined' && module.exports) {
    return DEFAULT_NEWS.filter(function (n) { return n && n.published !== false; });
  }
  // Browser: use the live store from pd-app.js if available.
  try {
    var store = window.PDApp && window.PDApp.store;
    if (store) {
      var all = store.get('news', 'DEFAULT_NEWS') || [];
      return all.filter(function (n) { return n && n.published !== false; });
    }
  } catch (e) { /* fall through */ }
  return DEFAULT_NEWS.filter(function (n) { return n && n.published !== false; });
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
    featured: !!item.featured,
    published: !!item.published,
    url: '/news/' + encodeURIComponent(item.id || '')
  };
}

// Browser export
if (typeof window !== 'undefined') {
  window.PDApp = window.PDApp || {};
  window.PDApp.getNews = getNews;
}

// Serverless function handler (Netlify / Vercel / Firebase)
function handler(req, res) {
  var items = getNews().slice(0, 20).map(serialize);
  var body = JSON.stringify({
    success: true,
    count: items.length,
    stories: items
  }, null, 2);

  if (req && req.headers && req.headers['accept'] === 'application/json') {
    res && res.setHeader('Content-Type', 'application/json');
    res && res.end(body);
    return body;
  }

  // Default: return JSON
  if (res) {
    res.setHeader('Content-Type', 'application/json');
    res.end(body);
  }
  return body;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.handler = handler;
}
