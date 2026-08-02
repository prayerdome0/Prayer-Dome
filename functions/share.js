'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE_ORIGIN = 'https://prayerdome.net';
const PROJECT_ID = 'prayer-dome';
const API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyCxvql0r_aeerphxTA0UUedRppdBxGf7wo';

const FALLBACKS = {
  news: {
    title: 'News | Prayer Dome',
    description: 'Read the latest Prayer Dome ministry news and stories.',
    image: '/assets/hero-worship.jpg',
    target: '/news.html'
  },
  testimony: {
    title: 'Testimony | Prayer Dome',
    description: 'Read this Prayer Dome testimony and be encouraged.',
    image: '/assets/testimonies/hero-praise.jpg',
    target: '/testimony.html'
  }
};

function htmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function text(value, max = 220) {
  const clean = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1).trim() + '…' : clean;
}

function absoluteUrl(url, fallback) {
  const candidate = url || fallback;
  try { return new URL(candidate, SITE_ORIGIN).href; }
  catch (_e) { return new URL(fallback, SITE_ORIGIN).href; }
}

function parseFirestoreValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseFirestoreValue);
  if ('mapValue' in v) {
    const out = {};
    const fields = v.mapValue.fields || {};
    for (const [key, value] of Object.entries(fields)) out[key] = parseFirestoreValue(value);
    return out;
  }
  return null;
}

function parseFirestoreDocument(doc) {
  if (!doc || !doc.fields) return null;
  const out = {};
  for (const [key, value] of Object.entries(doc.fields)) out[key] = parseFirestoreValue(value);
  if (!out.id && doc.name) out.id = doc.name.split('/').pop();
  return out;
}

async function getFirestoreDocument(collection, id) {
  if (!id || !global.fetch) return null;
  const safeId = encodeURIComponent(id);
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${safeId}?key=${API_KEY}`;
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    return parseFirestoreDocument(await response.json());
  } catch (_e) {
    return null;
  }
}

let seededNews;
function getSeededNews(id) {
  if (!id) return null;
  try {
    if (!seededNews) {
      const builtInSeeds = [
        {
          id: 'news-1',
          title: 'Prayer Dome Launches Premium Multi-Language Platform',
          summary: 'The platform now speaks English, Tumbuka, siSwati, Bemba and Nyanja — one family, one house of prayer across nations.',
          image: '/assets/hero-worship.jpg'
        },
        {
          id: 'news-2',
          title: 'Revival Weekend Coming — Mark Your Calendar',
          summary: 'Prepare your heart for a season of supernatural encounter. Details on the Events page.',
          image: '/assets/hero-worship.jpg'
        },
        {
          id: 'news-3',
          title: 'Testimonies: God Is Moving Across the Nations',
          summary: 'Read how believers are experiencing healing, breakthrough and answered prayers.',
          image: '/assets/testimonies/hero-praise.jpg'
        }
      ];
      try {
        const file = path.join(process.cwd(), 'assets', 'pd-content-data.js');
        const src = fs.readFileSync(file, 'utf8');
        const sandbox = { window: {} };
        sandbox.window.PD_CONTENT = {};
        sandbox.PD_CONTENT = sandbox.window.PD_CONTENT;
        vm.runInNewContext(src, sandbox, { filename: 'pd-content-data.js', timeout: 1000 });
        seededNews = (sandbox.window.PD_CONTENT && sandbox.window.PD_CONTENT.DEFAULT_NEWS) || builtInSeeds;
      } catch (_readError) {
        seededNews = builtInSeeds;
      }
    }
    return seededNews.find((n) => n && n.id === id) || null;
  } catch (_e) {
    return null;
  }
}

function normalizeItem(type, id, data) {
  const fallback = FALLBACKS[type] || FALLBACKS.news;
  if (type === 'testimony') {
    const image = data && (data.socialImage || data.featuredImage || data.imageUrl || data.image || data.photoUrl);
    const author = text((data && data.author) || 'Anonymous', 80);
    const category = text((data && data.category) || 'Testimony', 80);
    const body = text((data && data.content) || fallback.description, 220);
    return {
      title: `${category} by ${author} | Prayer Dome`,
      description: body,
      image: absoluteUrl(image, fallback.image),
      target: `${SITE_ORIGIN}/testimony.html?story=${encodeURIComponent(id || '')}`,
      shareUrl: `${SITE_ORIGIN}/testimony/${encodeURIComponent(id || '')}`,
      type: 'article'
    };
  }

  const image = data && (data.socialImage || data.featuredImage || data.image || data.imageUrl || data.photoUrl);
  const title = text((data && data.title) || fallback.title, 120);
  const description = text((data && (data.summary || data.body || data.description)) || fallback.description, 220);
  return {
    title: `${title}${/Prayer Dome/i.test(title) ? '' : ' | Prayer Dome'}`,
    description,
    image: absoluteUrl(image, fallback.image),
    target: `${SITE_ORIGIN}/news.html?story=${encodeURIComponent(id || '')}`,
    shareUrl: `${SITE_ORIGIN}/news/${encodeURIComponent(id || '')}`,
    type: 'article'
  };
}

function parseParams(req) {
  const query = req.query || {};
  let type = String(query.type || '').toLowerCase();
  let id = String(query.id || query.story || '').trim();
  const url = req.url || req.originalUrl || req.path || '';
  const pathOnly = (req.originalUrl || req.path || url).split('?')[0];
  const parts = pathOnly.split('/').filter(Boolean);

  if ((!type || !id) && parts.length >= 2) {
    if (parts[0] === 'news' || parts[0] === 'testimony') {
      type = parts[0];
      id = decodeURIComponent(parts[1] || '');
    } else if (parts[0] === 'share') {
      type = String(parts[1] || '').toLowerCase();
      id = decodeURIComponent(parts[2] || '');
    }
  }

  if (type === 'stories' || type === 'story') type = 'news';
  if (type === 'testimonies') type = 'testimony';
  if (type !== 'news' && type !== 'testimony') type = 'news';
  return { type, id };
}

function render(meta) {
  const title = htmlEscape(meta.title);
  const desc = htmlEscape(meta.description);
  const image = htmlEscape(meta.image);
  const url = htmlEscape(meta.shareUrl);
  const target = htmlEscape(meta.target);
  const type = htmlEscape(meta.type || 'article');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="Prayer Dome">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:secure_url" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${title}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${image}">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: meta.description,
    image: [meta.image],
    mainEntityOfPage: meta.shareUrl,
    publisher: { '@type': 'Organization', name: 'Prayer Dome' }
  }).replace(/</g, '\\u003c')}</script>
  <meta http-equiv="refresh" content="0;url=${target}">
  <style>body{font-family:Inter,Arial,sans-serif;background:#f8fafc;color:#0f172a;display:grid;min-height:100vh;place-items:center;text-align:center;padding:24px}a{color:#0A4D9B;font-weight:700}</style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${desc}</p>
    <p><a href="${target}">Open in Prayer Dome</a></p>
  </main>
  <script>window.location.replace(${JSON.stringify(meta.target)});</script>
</body>
</html>`;
}

async function handler(req, res) {
  const { type, id } = parseParams(req);
  const collection = type === 'testimony' ? 'testimonies' : 'news';
  const remote = await getFirestoreDocument(collection, id);
  const seed = type === 'news' ? getSeededNews(id) : null;
  const meta = normalizeItem(type, id, remote || seed || null);

  if (res.setHeader) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  }
  if (res.status) return res.status(200).send(render(meta));
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  return res.end(render(meta));
}

module.exports = handler;
module.exports.handler = handler;
