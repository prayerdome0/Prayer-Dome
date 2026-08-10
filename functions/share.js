'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE_ORIGIN = 'https://prayerdome.net';
const PROJECT_ID = 'prayer-dome';
const API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyCxvql0r_aeerphxTA0UUedRppdBxGf7wo';

/**
 * Every shareable content type. `collection` is the Firestore collection the
 * document lives in, `target` is the in-app page a human is forwarded to, and
 * `image` is the branded fallback used when an item has no featured image.
 */
const TYPES = {
  news: {
    collection: 'news',
    title: 'News | Prayer Dome',
    description: 'Read the latest Prayer Dome ministry news and stories.',
    image: '/assets/hero-worship.jpg',
    page: '/news.html',
    param: 'story',
    ogType: 'article'
  },
  testimony: {
    collection: 'testimonies',
    title: 'Testimony | Prayer Dome',
    description: 'Read this Prayer Dome testimony and be encouraged.',
    image: '/assets/testimonies/hero-praise.jpg',
    page: '/testimony.html',
    param: 'story',
    ogType: 'article'
  },
  sermon: {
    collection: 'sermons',
    title: 'Sermon | Prayer Dome',
    description: 'Listen to this Prayer Dome sermon and let the Word settle in your heart.',
    image: '/assets/sermons/sermon-prayer.jpg',
    page: '/sermons.html',
    param: 's',
    ogType: 'article'
  },
  devotional: {
    collection: 'devotionals',
    title: 'Daily Devotional | Prayer Dome',
    description: 'A short daily devotional from Prayer Dome — scripture, a thought and a prayer.',
    image: '/assets/hero-worship.jpg',
    page: '/index.html',
    param: 'devotional',
    ogType: 'article'
  },
  prayer: {
    collection: 'prayers',
    title: 'Prayer Request | Prayer Dome',
    description: 'Stand in agreement with this prayer request on the Prayer Dome global prayer wall.',
    image: '/assets/og-image.png',
    page: '/prayer.html',
    param: 'request',
    ogType: 'article'
  },
  event: {
    collection: 'events',
    title: 'Church Event | Prayer Dome',
    description: 'Join this Prayer Dome gathering — everyone is welcome.',
    image: '/assets/og-image.png',
    page: '/event.html',
    param: 'id',
    ogType: 'article'
  },
  video: {
    collection: 'aiVideos',
    title: 'Video | Prayer Dome',
    description: 'Watch this Prayer Dome video — sermons, Bible stories and daily encouragement.',
    image: '/assets/og-image.png',
    page: '/video.html',
    param: 'v',
    ogType: 'video.other'
  }
};

// Retained for older call sites and tests.
const FALLBACKS = TYPES;

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

/**
 * Sermons and Bible stories that ship with the app (sermons-data.js) are
 * shareable too — they have no Firestore document, so read them from the
 * bundled data file.
 */
let seededSermons;
function getSeededSermon(id) {
  if (!id) return null;
  try {
    if (!seededSermons) {
      seededSermons = [];
      try {
        const file = path.join(process.cwd(), 'sermons-data.js');
        const src = fs.readFileSync(file, 'utf8');
        const sandbox = { module: { exports: {} }, window: {} };
        sandbox.exports = sandbox.module.exports;
        vm.runInNewContext(src, sandbox, { filename: 'sermons-data.js', timeout: 1000 });
        seededSermons = (sandbox.module.exports && sandbox.module.exports.PD_SERMONS) || [];
      } catch (_readError) {
        seededSermons = [];
      }
    }
    return seededSermons.find((s) => s && s.id === id) || null;
  } catch (_e) {
    return null;
  }
}

/** First non-empty featured-image field an editor may have filled in. */
function pickImage(data) {
  if (!data) return null;
  return data.socialImage || data.featuredImage || data.image || data.imageUrl ||
    data.thumb || data.thumbnail || data.coverImage || data.photoUrl || data.banner || null;
}

/** First non-empty description-ish field. */
function pickDescription(data, keys) {
  if (!data) return '';
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value) && value.length && typeof value[0] === 'string') return value.join(' ');
  }
  return '';
}

function brandTitle(title) {
  const clean = text(title, 110);
  return /prayer dome/i.test(clean) ? clean : `${clean} | Prayer Dome`;
}

function normalizeItem(type, id, data) {
  const spec = TYPES[type] || TYPES.news;
  const encodedId = encodeURIComponent(id || '');
  const shareUrl = `${SITE_ORIGIN}/share/${type}/${encodedId}`;
  const target = id
    ? `${SITE_ORIGIN}${spec.page}?${spec.param}=${encodedId}`
    : `${SITE_ORIGIN}${spec.page}`;
  const image = absoluteUrl(pickImage(data), spec.image);

  if (type === 'testimony') {
    const author = text((data && data.author) || 'Anonymous', 80);
    const category = text((data && data.category) || 'Testimony', 80);
    return {
      title: brandTitle(`${category} by ${author}`),
      description: text(pickDescription(data, ['content', 'summary', 'body']) || spec.description, 220),
      image, target, shareUrl, type: spec.ogType,
      label: 'Testimony'
    };
  }

  if (type === 'sermon') {
    const speaker = text((data && (data.speaker || data.author)) || 'Prayer Dome Ministry Team', 80);
    const scripture = text((data && (data.scripture || data.keyVerse)) || '', 70);
    const summary = text(pickDescription(data, ['summary', 'description', 'story', 'body']) || spec.description, 200);
    return {
      title: brandTitle((data && (data.title || data.subtitle)) || spec.title),
      description: [scripture, summary].filter(Boolean).join(' · ') + ` — ${speaker}`,
      image, target, shareUrl, type: spec.ogType,
      label: 'Sermon'
    };
  }

  if (type === 'devotional') {
    const scripture = text((data && (data.scriptureRef || data.scripture)) || '', 70);
    const body = text(pickDescription(data, ['thought', 'scriptureText', 'summary', 'body']) || spec.description, 200);
    return {
      title: brandTitle((data && data.title) || spec.title),
      description: [scripture, body].filter(Boolean).join(' · '),
      image, target, shareUrl, type: spec.ogType,
      label: 'Daily Devotional'
    };
  }

  if (type === 'prayer') {
    const author = text((data && (data.name || data.author)) || 'A member', 60);
    const category = text((data && data.category) || 'Prayer request', 60);
    return {
      title: brandTitle(`${category} — please pray`),
      description: text(pickDescription(data, ['request', 'content', 'body', 'text']) || spec.description, 220) +
        ` (shared by ${author})`,
      image, target, shareUrl, type: spec.ogType,
      label: 'Prayer Wall'
    };
  }

  if (type === 'event') {
    const when = text((data && (data.dateLabel || data.date || data.startDate)) || '', 60);
    const place = text((data && (data.venue || data.location)) || '', 70);
    return {
      title: brandTitle((data && data.title) || spec.title),
      description: [when, place, text(pickDescription(data, ['description', 'summary', 'body']), 160)]
        .filter(Boolean).join(' · ') || spec.description,
      image, target, shareUrl, type: spec.ogType,
      label: 'Church Event'
    };
  }

  if (type === 'video') {
    const scripture = text((data && data.scripture) || '', 70);
    return {
      title: brandTitle((data && data.title) || spec.title),
      description: [scripture, text(pickDescription(data, ['desc', 'description', 'summary']) || spec.description, 200)]
        .filter(Boolean).join(' · '),
      image, target, shareUrl, type: spec.ogType,
      label: 'Prayer Dome Video',
      videoUrl: (data && typeof data.url === 'string' && /^https:\/\//i.test(data.url)) ? data.url : null
    };
  }

  return {
    title: brandTitle((data && data.title) || spec.title),
    description: text(pickDescription(data, ['summary', 'body', 'description', 'content']) || spec.description, 220),
    image, target, shareUrl, type: spec.ogType,
    label: 'Ministry News'
  };
}

const TYPE_ALIASES = {
  stories: 'news', story: 'news', article: 'news', articles: 'news',
  testimonies: 'testimony',
  sermons: 'sermon', message: 'sermon', messages: 'sermon',
  devotionals: 'devotional', daily: 'devotional',
  prayers: 'prayer', 'prayer-wall': 'prayer', request: 'prayer', 'prayer-request': 'prayer',
  events: 'event',
  videos: 'video', aivideo: 'video', 'ai-video': 'video', watch: 'video'
};

function parseParams(req) {
  const query = req.query || {};
  let type = String(query.type || '').toLowerCase();
  let id = String(query.id || query.story || '').trim();
  const url = req.url || req.originalUrl || req.path || '';
  const pathOnly = (req.originalUrl || req.path || url).split('?')[0];
  const parts = pathOnly.split('/').filter(Boolean);

  if ((!type || !id) && parts.length >= 2) {
    const head = String(parts[0] || '').toLowerCase();
    if (head === 'share') {
      type = String(parts[1] || '').toLowerCase();
      id = decodeURIComponent(parts[2] || '');
    } else if (TYPES[head] || TYPE_ALIASES[head]) {
      type = head;
      id = decodeURIComponent(parts[1] || '');
    }
  }

  type = TYPE_ALIASES[type] || type;
  if (!TYPES[type]) type = 'news';
  return { type, id };
}

function render(meta) {
  const title = htmlEscape(meta.title);
  const desc = htmlEscape(meta.description);
  const image = htmlEscape(meta.image);
  const url = htmlEscape(meta.shareUrl);
  const target = htmlEscape(meta.target);
  const type = htmlEscape(meta.type || 'article');
  const label = htmlEscape(meta.label || 'Prayer Dome');
  const videoTags = meta.videoUrl
    ? `\n  <meta property="og:video" content="${htmlEscape(meta.videoUrl)}">` +
      `\n  <meta property="og:video:secure_url" content="${htmlEscape(meta.videoUrl)}">` +
      `\n  <meta property="og:video:type" content="video/mp4">` +
      `\n  <meta name="twitter:player" content="${htmlEscape(meta.videoUrl)}">`
    : '';
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
  <meta property="og:locale" content="en_US">${videoTags}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@prayerdome">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:image:alt" content="${title}">
  <meta name="theme-color" content="#0A4D9B">
  <link rel="icon" type="image/png" href="${SITE_ORIGIN}/assets/logo.png">
  <link rel="apple-touch-icon" href="${SITE_ORIGIN}/assets/logo.png">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: meta.description,
    image: [meta.image],
    mainEntityOfPage: meta.shareUrl,
    publisher: {
      '@type': 'Organization',
      name: 'Prayer Dome',
      logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/assets/logo.png` }
    }
  }).replace(/</g, '\\u003c')}</script>
  <meta http-equiv="refresh" content="0;url=${target}">
  <style>
    *{box-sizing:border-box}
    body{font-family:Montserrat,Arial,sans-serif;background:linear-gradient(180deg,#f6f9ff,#eef3fb);color:#0f172a;
      display:grid;min-height:100vh;place-items:center;text-align:center;padding:24px;margin:0}
    .card{max-width:520px;background:#fff;border-radius:22px;padding:30px 24px;box-shadow:0 18px 46px rgba(10,77,155,.14)}
    .logo{width:76px;height:76px;object-fit:contain;margin:0 auto 6px;display:block}
    .brand{font-weight:800;letter-spacing:.24em;font-size:.68rem;color:#0A4D9B;text-transform:uppercase}
    .kind{display:inline-block;margin:12px 0 4px;font-size:.66rem;font-weight:800;letter-spacing:.12em;
      text-transform:uppercase;color:#8a6414;background:rgba(212,175,55,.16);padding:5px 12px;border-radius:999px}
    h1{font-size:1.22rem;line-height:1.35;margin:10px 0 8px}
    p{color:#475569;font-size:.9rem;line-height:1.6;margin:0 0 18px}
    .cover{width:100%;border-radius:14px;margin:14px 0 4px;display:block;aspect-ratio:1200/630;object-fit:cover;background:#0A4D9B}
    a.go{display:inline-block;background:#0A4D9B;color:#fff;text-decoration:none;font-weight:800;
      padding:13px 26px;border-radius:999px;font-size:.85rem}
  </style>
</head>
<body>
  <main class="card">
    <img class="logo" src="${SITE_ORIGIN}/assets/logo.png" alt="Prayer Dome">
    <span class="brand">Prayer Dome</span>
    <span class="kind">${label}</span>
    <h1>${title}</h1>
    <img class="cover" src="${image}" alt="${title}">
    <p>${desc}</p>
    <p><a class="go" href="${target}">Open in Prayer Dome</a></p>
  </main>
  <script>window.location.replace(${JSON.stringify(meta.target)});</script>
</body>
</html>`;
}

async function handler(req, res) {
  const { type, id } = parseParams(req);
  const spec = TYPES[type] || TYPES.news;
  const remote = await getFirestoreDocument(spec.collection, id);

  // Bundled content (news seeds, sermons) has no Firestore document.
  let seed = null;
  if (!remote) {
    if (type === 'news') seed = getSeededNews(id);
    else if (type === 'sermon') seed = getSeededSermon(id);
  }
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
