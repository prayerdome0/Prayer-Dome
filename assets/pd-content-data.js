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
    image: '/assets/hero-worship.jpg',
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
    image: '/assets/testimonies/hero-praise.jpg',
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

/* --- Scripture translations seed ----------------------------------------- */
/* Elders review these from Admin → Translation Review and sign each off.     */
PD_CONTENT.DEFAULT_TRANSLATIONS = [
  {
    id: 'ts-1',
    verseRef: 'Mark 7:37',
    english: 'He does everything blamelessly.',
    translation: 'Wacita vinthu vyose makora.',
    lang: 'tum',
    reviewed: false
  },
  {
    id: 'ts-2',
    verseRef: 'Mark 7:37',
    english: 'He does everything blamelessly.',
    translation: 'Wente konkhe kuhle.',
    lang: 'ssw',
    reviewed: false
  },
  {
    id: 'ts-3',
    verseRef: 'Mark 7:37',
    english: 'He does everything blamelessly.',
    translation: 'Atenda ifintu fyonse bwino.',
    lang: 'bem',
    reviewed: false
  },
  {
    id: 'ts-4',
    verseRef: 'Mark 7:37',
    english: 'He does everything blamelessly.',
    translation: 'Iye wachita zonse bwino.',
    lang: 'nya',
    reviewed: false
  }
];

/* --- Weekly Prayer Challenge pool ----------------------------------------
   The home page shows one challenge per week, rotating through this pool by
   ISO week number so the focus changes every Monday automatically. Each
   challenge carries 7 daily tasks (one per day) and a guiding scripture.
   ------------------------------------------------------------------------- */
PD_CONTENT.WEEKLY_CHALLENGES = [
  {
    id: 'chal-praise',
    title: 'The Week of Praise',
    icon: 'fa-hands-praying',
    focus: 'Begin every day with thanksgiving. Before you ask God for anything, praise Him for who He is and what He has already done.',
    verse: 'Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.',
    verseRef: 'Psalm 100:4',
    tasks: [
      'Start the day with 5 minutes of spoken praise',
      'Thank God for three specific things before lunch',
      'Sing or hum a worship song while you work',
      'Send a thank-you message to someone who helped you',
      'Praise God for an answered prayer from your past',
      'Share one testimony of God\u2019s goodness with a friend',
      'Close the week with a private praise service to the Lord'
    ]
  },
  {
    id: 'chal-fast',
    title: 'The Week of Fasting',
    icon: 'fa-dove',
    focus: 'Set aside something this week — a meal, a habit, a comfort — and give that space to prayer and seeking God\u2019s face.',
    verse: 'But thou, when thou fastest, anoint thine head, and wash thy face; That thou appear not unto men to fast, but unto thy Father which is in secret.',
    verseRef: 'Matthew 6:17-18',
    tasks: [
      'Choose one meal a day to give up for prayer',
      'Replace screen time with 15 minutes of scripture',
      'Pray for a need you have been avoiding',
      'Give what you saved from fasting to someone in need',
      'Fast from negative words for a whole day',
      'Spend your usual coffee break in silent prayer',
      'Break the week with a communion of thanks and praise'
    ]
  },
  {
    id: 'chal-family',
    title: 'The Week of Family Prayer',
    icon: 'fa-people-roof',
    focus: 'Pray with your household or your spiritual family every day. Agreement in prayer opens doors that solitude cannot.',
    verse: 'Again I say unto you, That if two of you shall agree on earth as touching any thing that they shall ask, it shall be done for them of my Father which is in heaven.',
    verseRef: 'Matthew 18:19',
    tasks: [
      'Gather the household for 5 minutes of prayer tonight',
      'Ask each family member for one prayer request',
      'Pray over a meal together out loud',
      'Call a friend or relative and pray with them',
      'Pray for your local church and its leaders',
      'Forgive and pray for someone you are holding against',
      'Hold a family praise and testimony hour'
    ]
  },
  {
    id: 'chal-word',
    title: 'The Week of the Word',
    icon: 'fa-book-bible',
    focus: 'Let scripture lead your prayers. Read, meditate and pray the Word back to God instead of only praying your own words.',
    verse: 'Thy word is a lamp unto my feet, and a light unto my path.',
    verseRef: 'Psalm 119:105',
    tasks: [
      'Read one full chapter of the Gospels',
      'Memorise one verse and repeat it all day',
      'Pray the words of a Psalm back to God',
      'Write down one promise of God and claim it',
      'Read scripture out loud in the evening',
      'Share a verse that encouraged you with someone',
      'End the week by writing a prayer using only scripture'
    ]
  },
  {
    id: 'chal-intercession',
    title: 'The Week of Intercession',
    icon: 'fa-earth-africa',
    focus: 'Stand in the gap for others — your family, your church, your nation and the nations. Intercession is love on its knees.',
    verse: 'I exhort therefore, that, first of all, supplications, prayers, intercessions, and giving of thanks, be made for all men.',
    verseRef: '1 Timothy 2:1',
    tasks: [
      'Pray for your nation\u2019s leaders by name',
      'Pray for a sick or grieving person today',
      'Intercede for an unsaved family member',
      'Pray for missionaries and persecuted believers',
      'Pray for peace in a war-torn region of the world',
      'Pray for your pastor and church workers',
      'Make a list of 7 people and pray for each one'
    ]
  },
  {
    id: 'chal-silence',
    title: 'The Week of Stillness',
    icon: 'fa-moon',
    focus: 'Be still and know. This week, learn to listen — silence your words, your devices and your worries so God can speak.',
    verse: 'Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.',
    verseRef: 'Psalm 46:10',
    tasks: [
      'Spend 10 minutes in complete silence before God',
      'Put your phone away for one full hour',
      'Journal what you sense God saying to you',
      'Take a quiet walk and pray without words',
      'Turn off all noise for the evening',
      'Ask God one question and wait for His answer',
      'End the week with a silent hour of adoration'
    ]
  },
  {
    id: 'chal-generosity',
    title: 'The Week of Generosity',
    icon: 'fa-hand-holding-heart',
    focus: 'Give as you have received — time, money, food, encouragement. A generous heart is a praying heart made visible.',
    verse: 'Give, and it shall be given unto you; good measure, pressed down, and shaken together, and running over, shall men give into your bosom.',
    verseRef: 'Luke 6:38',
    tasks: [
      'Give a gift to someone who cannot repay you',
      'Serve someone in your church this week',
      'Donate to a person in need today',
      'Write a generous note of encouragement',
      'Give your time — visit or call someone lonely',
      'Give to the work of God with a cheerful heart',
      'Host or cook a meal for someone in need'
    ]
  },
  {
    id: 'chal-healing',
    title: 'The Week of Healing',
    icon: 'fa-heart-pulse',
    focus: 'Bring every wound — body, mind and heart — before the Healer. Pray healing over yourself, your loved ones and your memories.',
    verse: 'He healeth the broken in heart, and bindeth up their wounds.',
    verseRef: 'Psalm 147:3',
    tasks: [
      'Pray healing over your own body',
      'Pray for someone you know who is sick',
      'Forgive someone and release the wound',
      'Pray against anxiety and fear for yourself',
      'Speak life over a broken relationship',
      'Anoint and pray for your household',
      'Praise God for the healing already done'
    ]
  },
  {
    id: 'chal-gratitude',
    title: 'The Week of Gratitude',
    icon: 'fa-star',
    focus: 'Cultivate a heart of thanks. Gratitude is the language of heaven — the more you thank God, the more you see His hand.',
    verse: 'In every thing give thanks: for this is the will of God in Christ Jesus concerning you.',
    verseRef: '1 Thessalonians 5:18',
    tasks: [
      'Write down 10 things you are thankful for',
      'Thank God for your body and breath today',
      'Thank someone who has shaped your life',
      'Give thanks in the middle of a difficulty',
      'Thank God for past deliverances',
      'Count the small mercies of today',
      'Close the week with a written prayer of thanks'
    ]
  },
  {
    id: 'chal-humility',
    title: 'The Week of Humility',
    icon: 'fa-person-praying',
    focus: 'Bow low so God can lift you high. This week, practise humility before God and before people.',
    verse: 'Humble yourselves in the sight of the Lord, and he shall lift you up.',
    verseRef: 'James 4:10',
    tasks: [
      'Begin each day on your knees in prayer',
      'Apologise to someone you have wronged',
      'Serve in a task no one wants to do',
      'Ask for help instead of doing it alone',
      'Give someone else the credit today',
      'Listen more than you speak',
      'End the week by washing someone\u2019s feet in service'
    ]
  },
  {
    id: 'chal-awakening',
    title: 'The Week of Awakening',
    icon: 'fa-fire',
    focus: 'Ask the Lord to rekindle your first love. Pray for personal revival and for a spiritual awakening across your community.',
    verse: 'Will thou not revive us again: that thy people may rejoice in thee?',
    verseRef: 'Psalm 85:6',
    tasks: [
      'Pray for your own heart to be set on fire again',
      'Pray for revival in your church',
      'Pray for the youth of your nation',
      'Confess and turn from one secret sin',
      'Pray for a fresh outpouring of the Holy Spirit',
      'Invite someone to join you in praying for revival',
      'Pray that Prayer Dome would reach the nations'
    ]
  },
  {
    id: 'chal-soulwinning',
    title: 'The Week of the Harvest',
    icon: 'fa-seedling',
    focus: 'Pray for souls. Intercede for the lost, pray for boldness to witness, and look for one open door to share your faith.',
    verse: 'The harvest truly is plenteous, but the labourers are few; Pray ye therefore the Lord of the harvest, that he will send forth labourers into his harvest.',
    verseRef: 'Matthew 9:37-38',
    tasks: [
      'Pray for five unsaved people by name',
      'Ask God to give you boldness to witness',
      'Share your testimony with one person',
      'Pray for an open door to speak about Jesus',
      'Bless someone who does not yet know God',
      'Pray for the harvest fields of your town',
      'Commit the week\u2019s labour to the Lord of the harvest'
    ]
  }
];

/* Returns the challenge for a given date by rotating through the pool by
   ISO week number. Falls back to the first challenge for invalid dates. */
PD_CONTENT.getWeeklyChallenge = function (date) {
  var pool = PD_CONTENT.WEEKLY_CHALLENGES || [];
  if (!pool.length) return null;
  var d = date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) d = new Date();
  // ISO week number of the given date
  var copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + 3 - ((copy.getDay() + 6) % 7));
  var week1 = new Date(copy.getFullYear(), 0, 4);
  var isoWeek = 1 + Math.round(((copy - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  var index = Math.abs(isoWeek) % pool.length;
  return pool[index];
};

/* Monday of the week containing the given date (local time), as a Date. */
PD_CONTENT.weekStart = function (date) {
  var d = date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) d = new Date();
  var day = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
};

/* Stable key for the week containing `date`, e.g. "2026-W32". */
PD_CONTENT.weekKey = function (date) {
  var monday = PD_CONTENT.weekStart(date);
  var y = monday.getFullYear();
  var jan4 = new Date(y, 0, 4);
  var week = 1 + Math.round(((monday - new Date(y, 0, 1)) / 86400000 + ((jan4.getDay() + 6) % 7)) / 7);
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  return y + '-W' + pad(week);
};
