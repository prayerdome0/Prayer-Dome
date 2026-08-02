/* ==========================================================================
   Prayer Dome — Premium Content Data
   --------------------------------------------------------------------------
   Seed / fallback content for the premium app layer (pd-app.js).
   Admins manage all of this from the Admin Dashboard; those edits are saved
   to localStorage under the same keys and mirrored to Firestore when the
   app is online. These seeds are used only until an admin publishes.

   Plain global script — load BEFORE pd-app.js.
   ========================================================================== */

window.PD_CONTENT = window.PD_CONTENT || {};

/* --- Featured theme scripture (Mark 7:37) -------------------------------- */
PD_CONTENT.THEME_SCRIPTURE = {
  verse: 'Mark 7:37',
  text: 'He hath done all things well: he maketh both the deaf to hear, and the dumb to speak.',
  theme: 'He does everything blamelessly.',
  versions: {
    tum: { verse: 'Maliko 7:37', theme: 'Wacita vinthu vyose makora.' },
    ssw: { verse: 'Makho 7:37', theme: 'Wente konkhe kuhle.' },
    bem: { verse: 'Marko 7:37', theme: 'Atenda ifintu fyonse bwino.' },
    nya: { verse: 'Maliko 7:37', theme: 'Iye wachita zonse bwino.' }
  }
};

/* --- Moving announcement bar (auto-scrolling marquee) --------------------- */
PD_CONTENT.DEFAULT_ANNOUNCEMENTS = [
  { id: 'ann-1', text: 'Welcome to Prayer Dome — A House of Prayer for All Nations', icon: 'fa-church', active: true },
  { id: 'ann-2', text: 'Join Today\'s Prayer Session — every Sunday at 09:00 AM', icon: 'fa-clock', active: true },
  { id: 'ann-3', text: 'New Sermon Available — watch in the Sermon Center', icon: 'fa-microphone-lines', active: true },
  { id: 'ann-4', text: 'Upcoming Revival Meeting — details in Events & News', icon: 'fa-fire', active: true },
  { id: 'ann-5', text: 'Prayer Request Updates — check the Prayer Wall', icon: 'fa-hands-praying', active: true },
  { id: 'ann-6', text: 'Community News — read the latest in the News Center', icon: 'fa-newspaper', active: true }
];

/* --- Scheduled hero banners (video or image) ----------------------------- */
PD_CONTENT.DEFAULT_BANNERS = [
  {
    id: 'banner-1',
    type: 'image',                       // 'video' | 'image'
    mediaUrl: '/assets/hero-worship.jpg',
    headline: 'Welcome to Prayer Dome',
    subtext: 'He does everything blamelessly. — Mark 7:37',
    ctaLabel: 'Watch Live',
    ctaUrl: '/live.html',
    scheduleStart: null,                 // ISO string or null = always
    scheduleEnd: null,
    active: true
  }
];

/* --- Christian News Center seed ------------------------------------------ */
PD_CONTENT.DEFAULT_NEWS = [
  {
    id: 'news-1',
    title: 'Prayer Dome Launches Premium Multi-Language Platform',
    category: 'Ministry News',
    summary: 'The platform now speaks English, Tumbuka, siSwati, Bemba and Nyanja — one family, one house of prayer across nations.',
    body: 'Prayer Dome is excited to announce its premium platform upgrade. Believers across Zambia, Eswatini, South Africa, Malawi and Ireland can now worship, pray, study the Bible and watch live services in their heart language — English, Tumbuka, siSwati, Bemba and Nyanja — all from one integrated app.',
    image: '/assets/hero-worship.jpg',
    author: 'Prayer Dome Media Team',
    date: null,                          // filled at publish time
    featured: true,
    published: true
  },
  {
    id: 'news-2',
    title: 'Revival Weekend Coming — Mark Your Calendar',
    category: 'Event Announcements',
    summary: 'Prepare your heart for a season of supernatural encounter. Details on the Events page.',
    body: 'The ministry is preparing for a revival weekend. Watch the Events page and your notifications for dates, venues and live-stream links. Come expecting — He does everything blamelessly.',
    image: '/assets/og-image.png',
    author: 'Prayer Dome Media Team',
    date: null,
    featured: false,
    published: true
  },
  {
    id: 'news-3',
    title: 'Testimonies: God Is Moving Across the Nations',
    category: 'Testimonies',
    summary: 'Read how believers are experiencing healing, breakthrough and answered prayers.',
    body: 'The Testimony Center is full of fresh testimonies from Zambia, Eswatini, Ireland and beyond. Share what God has done for you — your story strengthens the whole body.',
    image: '/assets/og-image.png',
    author: 'Prayer Dome Media Team',
    date: null,
    featured: false,
    published: true
  }
];

/* --- Gospel Radio & Podcast stations (admin can replace) ------------------ */
PD_CONTENT.DEFAULT_RADIO = [
  {
    id: 'radio-1',
    name: 'Prayer Dome Radio',
    tagline: 'Worship, teaching and prayer around the clock',
    streamUrl: 'https://stream.radio.co/sample.mp3',   // admin replaces with licensed stream
    icon: 'fa-tower-broadcast'
  },
  {
    id: 'radio-2',
    name: 'Prayer Dome Worship Mix',
    tagline: 'Continuous worship atmosphere',
    streamUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', // demo audio — replace in Admin
    icon: 'fa-music'
  }
];

/* --- Podcast episodes (admin can replace) ---------------------------------- */
PD_CONTENT.DEFAULT_PODCASTS = [
  {
    id: 'pod-1',
    title: 'The Father Who Ran — A Story of Grace',
    series: 'Narrated Bible Stories',
    description: 'The prodigal son, told as a story you can hear. Part of the Prayer Dome sermon collection.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // demo audio — replace in Admin
    duration: '~12 min',
    date: null
  },
  {
    id: 'pod-2',
    title: 'Daily Encouragement — He Does Everything Blamelessly',
    series: 'Daily Encouragement',
    description: 'A short word of faith from Mark 7:37 to carry with you through the day.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', // demo audio — replace in Admin
    duration: '~5 min',
    date: null
  },
  {
    id: 'pod-3',
    title: 'The Giant Was the Smaller Problem',
    series: 'Narrated Bible Stories',
    description: 'David and Goliath — a fresh hearing of an old, mighty story.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', // demo audio — replace in Admin
    duration: '~15 min',
    date: null
  }
];

/* --- Community statistics baseline ---------------------------------------- */
PD_CONTENT.DEFAULT_STATS = {
  members: 1284,
  prayerRequests: 3421,
  testimonies: 517,
  countriesReached: 14,
  liveViewers: 0,
  prayerGroups: 36
};

/* --- Language availability (mirrors translation-data.js) ------------------ */
PD_CONTENT.DEFAULT_LANGUAGES = ['en', 'tum', 'ssw', 'bem', 'nya'];
