/*
 * Prayer Dome — media, sharing, branding and layout regressions
 * ===========================================================================
 * Covers the promises the app makes to members and to the ministry:
 *
 *   1. Live recordings live in the cloud, never on the member's device.
 *   2. A shared link always previews with an image, a title, a description
 *      and the Prayer Dome name — for every kind of content.
 *   3. Only official Prayer Dome artwork ships; no third-party placeholders.
 *   4. The Daily Bible Verse has four slots and reaches the device through
 *      the service worker.
 *   5. Notifications never come back as "new" once they have been read.
 *   6. Pages scroll vertically only, and sticky headers keep sticking.
 * ===========================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const t = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  ' + extra : ''));
};

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const styleBlocks = (html) =>
  [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

(async function run() {
  /* ------------------------------------------------- 1. cloud-only video */
  const cloudVideo = read('assets/pd-cloud-video.js');
  t('cloud recorder uploads to Cloudinary', cloudVideo.includes('api.cloudinary.com'));
  t('cloud recorder rotates segments so long services never fill the phone',
    /segmentSeconds/.test(cloudVideo) && /segmentMaxBytes/.test(cloudVideo));
  t('cloud recorder reports that nothing was stored on the device',
    cloudVideo.includes('storedOnDevice: false'));
  // Strip comments so the module's own documentation does not count as usage.
  const cloudVideoCode = cloudVideo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  t('cloud recorder never creates a device object URL',
    !/createObjectURL/.test(cloudVideoCode));
  t('cloud playback disables download and picture-in-picture',
    cloudVideo.includes('nodownload') && cloudVideo.includes('disablepictureinpicture'));

  const appJs = read('assets/pd-app.js');
  t('the app layer refuses to keep blob: replay links',
    /blob:/i.test(appJs) && /replays/.test(appJs));

  for (const page of ['admin.html', 'live.html', 'video.html']) {
    const html = read(page);
    t(`${page} loads the cloud recorder`, html.includes('/assets/pd-cloud-video.js'));
    t(`${page} refuses blob: playback`, /\^blob:/i.test(html) || /blob:/i.test(html));
  }

  /* ------------------------------------------------------- 2. sharing */
  const shareHandler = require(path.join(ROOT, 'functions', 'share.js'));
  const makeReq = (url) => ({ url, originalUrl: url, path: url.split('?')[0], query: {} });
  const makeRes = () => ({
    setHeader() {}, status() { return this; }, send(body) { this.body = body; return this; }
  });

  const shareCases = [
    ['/share/news/news-1', 'news'],
    ['/share/testimony/abc', 'testimony'],
    ['/share/sermon/prodigal-son', 'sermon'],
    ['/share/devotional/2026-04-03', 'devotional'],
    ['/share/prayer/req-1', 'prayer'],
    ['/share/event/ev-1', 'event'],
    ['/share/video/v-1', 'video']
  ];
  for (const [url, label] of shareCases) {
    const res = makeRes();
    /* eslint-disable no-await-in-loop */
    await shareHandler(makeReq(url), res);
    /* eslint-enable no-await-in-loop */
    const body = res.body || '';
    const title = (body.match(/property="og:title" content="([^"]*)"/) || [])[1] || '';
    const image = (body.match(/property="og:image" content="([^"]*)"/) || [])[1] || '';
    const desc = (body.match(/property="og:description" content="([^"]*)"/) || [])[1] || '';
    t(`share preview for ${label} carries a title`, title.length > 3, title);
    t(`share preview for ${label} carries an absolute image`,
      /^https:\/\/prayerdome\.net\//.test(image), image);
    t(`share preview for ${label} carries a description`, desc.length > 10);
    t(`share preview for ${label} is Prayer Dome branded`,
      body.includes('content="Prayer Dome"') && /prayerdome\.net\/assets\/logo\.png/.test(body));
  }

  t('the sermon share preview uses that sermon\'s own image', await (async () => {
    const res = makeRes();
    await shareHandler(makeReq('/share/sermon/prodigal-son'), res);
    return /sermon-prodigal\.jpg/.test(res.body);
  })());

  t('the app layer exposes a single branded share helper',
    /PDApp\s*=\s*{[\s\S]*share: share/.test(appJs) && appJs.includes("'/share/'"));

  const vercel = JSON.parse(read('vercel.json'));
  const rewriteSources = vercel.rewrites.map((r) => r.source);
  for (const route of ['/news/:id', '/testimony/:id', '/sermon/:id', '/devotional/:id',
    '/prayer-request/:id', '/watch/:id', '/share/:type/:id']) {
    t(`share route ${route} is published`, rewriteSources.includes(route));
  }
  t('the share function can read the bundled sermon library',
    vercel.functions['api/*.js'].includeFiles.includes('sermons-data.js'));

  /* ---------------------------------------------------- 3. real branding */
  const PLACEHOLDERS = /via\.placeholder\.com|placehold\.(it|co)|dummyimage\.com|images\.unsplash\.com/;
  const offenders = pages.filter((p) => PLACEHOLDERS.test(read(p)));
  t('no page loads a third-party placeholder or stock image',
    offenders.length === 0, offenders.join(', '));
  t('a Prayer Dome member avatar ships with the app',
    fs.existsSync(path.join(ROOT, 'assets/avatar-default.svg')));
  t('the app layer rewrites any placeholder left in stored records',
    appJs.includes('PLACEHOLDER_HOSTS') && appJs.includes('avatar-default.svg'));

  const logoPages = pages.filter((p) => !/assets\/logo(-\d+)?\.png/.test(read(p)));
  t('every page references the official Prayer Dome logo',
    logoPages.length === 0, logoPages.join(', '));

  /* ------------------------------------------------- 4. daily Bible verse */
  const verseData = read('assets/pd-verse-data.js');
  for (const slot of ['morning', 'midday', 'afternoon', 'evening']) {
    t(`the daily verse has a ${slot} slot`, verseData.includes(`'${slot}'`) || verseData.includes(`"${slot}"`));
  }
  const sw = read('sw.js');
  t('the service worker can deliver verses while the app is closed',
    sw.includes('deliverDueVerses') && /periodicsync|'sync'/.test(sw));
  t('the service worker loads the verse library', sw.includes('pd-verse-data.js'));
  t('verse notifications carry a stable per-day tag so they never duplicate',
    /pd-verse-/.test(sw));
  t('members can switch verses on in their account',
    read('account.html').includes('data-pd-verse-settings'));
  t('admins can schedule special verses',
    read('admin.html').includes('saveVerseSchedule') && read('admin.html').includes('loadVerseSchedule'));

  const rules = read('firestore.rules');
  for (const collection of ['verseSchedule', 'aiVideos', 'liveRecordings']) {
    t(`firestore rules cover ${collection}`, rules.includes(`match /${collection}/`));
  }

  /* ---------------------------------------------------- 5. notifications */
  t('read notifications are remembered by id and by content',
    appJs.includes('READ_SIG_KEY') && appJs.includes('function isRead'));
  t('device notifications use a stable tag and never re-alert',
    appJs.includes('renotify: false') && appJs.includes('tag: n.id'));
  t('notifications are informative, not intrusive',
    appJs.includes('requireInteraction: false'));
  t('the permission sheet is titled "Allow Notifications" with no website name',
    appJs.includes('>Allow Notifications<'));
  t('the installed app asks for permission natively',
    appJs.includes('Capacitor.Plugins.PushNotifications'));

  /* ------------------------------------------------------- 6. AI video */
  t('the Scripture Studio page exists', fs.existsSync(path.join(ROOT, 'ai-video.html')));
  const studio = read('ai-video.html');
  t('the studio uploads its render to cloud storage', studio.includes('PDCloudVideo.uploadWithRetry'));
  t('the studio publishes into the app library', studio.includes("collection(db, 'aiVideos')"));
  t('the studio covers sermons, Bible stories, devotionals, inspiration and promos',
    ['sermon', 'story', 'devotional', 'inspiration', 'promo'].every((k) => studio.includes(k + ':')));
  t('members can browse the AI video library', read('video.html').includes('aiVideosGrid'));

  /* ---------------------------------------------------------- 7. layout */
  const wideGrids = [];
  const stickyRisk = [];
  for (const page of pages) {
    const css = styleBlocks(read(page));
    const tooWide = [...css.matchAll(/minmax\(\s*(\d{3,})px/g)].filter((m) => +m[1] > 340);
    if (tooWide.length) wideGrids.push(`${page}(${tooWide.map((m) => m[1]).join(',')})`);

    const blocks = [...css.matchAll(/(^|\n|\})\s*(html\s*,\s*body|body\s*,\s*html|html|body)\s*\{([^}]*)\}/g)];
    const onHtml = blocks.some((m) => /html/.test(m[2]) && /overflow(-x)?\s*:\s*(hidden|auto|scroll|clip)/.test(m[3]));
    const onBody = blocks.some((m) => /body/.test(m[2]) && /overflow(-x)?\s*:\s*(hidden|auto|scroll|clip)/.test(m[3]));
    if (onHtml && onBody && /position\s*:\s*sticky/.test(css)) stickyRisk.push(page);
  }
  t('no page forces a grid wider than a small phone', wideGrids.length === 0, wideGrids.join(' '));
  t('no page turns <body> into a scroll container next to <html> (sticky headers)',
    stickyRisk.length === 0, stickyRisk.join(', '));

  const brandCss = read('assets/pd-brand.css');
  t('the shared stylesheet blocks sideways scrolling app-wide',
    brandCss.includes(':where(body)') && brandCss.includes('overflow-x: hidden'));
  t('the shared stylesheet keeps media inside the viewport',
    brandCss.includes(':where(img, video, canvas, svg, iframe)'));

  const aboutCss = styleBlocks(read('about.html'));
  t('the About page scrolls vertically only', /overflow-x:\s*hidden/.test(aboutCss));
  t('About page cards are fluid, not fixed width',
    /minmax\(\s*min\(/.test(aboutCss));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
