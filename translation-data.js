/*
 * Prayer Dome — Multilingual Scripture Pack
 * ===========================================================================
 * English (KJV) · Chitumbuka · siSwati · Bemba · Nyanja
 *
 * ---------------------------------------------------------------------------
 * PLEASE READ BEFORE PUBLISHING — TRANSLATION PROVENANCE
 * ---------------------------------------------------------------------------
 * The English text is King James Version and is public domain: it is exact.
 *
 * The Chitumbuka, siSwati, Bemba and Nyanja renderings in this file are **community drafts**.
 * They were prepared to give the ministry a working starting point, and every
 * entry carries `reviewed: false` until a fluent speaker has checked it. They
 * are NOT a substitute for the published Buku Lakupatulika (Tumbuka Bible) or
 * the siSwati Bible, and they should not be quoted as an official translation.
 *
 * The UI is built to be honest about this: any verse with `reviewed: false`
 * renders with a visible "draft — awaiting review" notice. Do not remove that
 * notice; flip the flag instead, once a reviewer has signed the entry off.
 *
 * HOW TO GET A VERSE REVIEWED
 *   1. A fluent speaker corrects the `tum` / `ssw` string in place.
 *   2. Set `reviewed: { tum: true }` (and/or `ssw: true`) on that verse.
 *   3. Record who reviewed it in `reviewer`.
 * The badge disappears automatically for that language.
 *
 * HOW TO ADD A VERSE
 *   Append to PD_VERSES. `id` must be unique and URL-safe. `topics` lets the
 *   Prayer Assistant and the Sermons page pull the verse in by subject.
 * ===========================================================================
 */

/* --- Languages ---------------------------------------------------------- */
const PD_LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    endonym: 'English',
    flag: '🇬🇧',
    source: 'King James Version (public domain)',
    official: true,
    speech: ['en-GB', 'en-US', 'en'],
    accent: '#0d9488'
  },
  {
    code: 'tum',
    name: 'Tumbuka',
    endonym: 'Chitumbuka',
    flag: '🇲🇼',
    source: 'Prayer Dome community draft — awaiting review',
    official: false,
    // No browser voice ships with Tumbuka. Nyanja/Swahili phonetics are the
    // closest available approximation; we fall back to those, then to English.
    speech: ['ny', 'sw', 'en'],
    accent: '#f59e0b',
    note: 'Spoken by roughly two million people in northern Malawi, eastern Zambia and southern Tanzania.'
  },
  {
    code: 'ssw',
    name: 'siSwati',
    endonym: 'siSwati',
    flag: '🇸🇿',
    source: 'Prayer Dome community draft — awaiting review',
    official: false,
    // Zulu is the nearest Nguni voice most devices actually carry.
    speech: ['zu', 'ss', 'en'],
    accent: '#7c3aed',
    note: 'An official language of Eswatini and South Africa, closely related to isiZulu.'
  },
  {
    code: 'bem',
    name: 'Bemba',
    endonym: 'Ichibemba',
    flag: '🇿🇲',
    source: 'Prayer Dome community draft — awaiting review',
    official: false,
    // No browser voice ships with Bemba; Swahili phonetics are the closest
    // available approximation, then English.
    speech: ['sw', 'en'],
    accent: '#0A4D9B',
    note: 'The largest indigenous language of Zambia, spoken by millions in the Copperbelt and Northern provinces.'
  },
  {
    code: 'nya',
    name: 'Nyanja (Chichewa)',
    endonym: 'Chinyanja',
    flag: '🇲🇼',
    source: 'Prayer Dome community draft — awaiting review',
    official: false,
    // Nyanja has no dedicated browser voice; Swahili phonetics are the
    // closest available approximation, then English.
    speech: ['sw', 'en'],
    accent: '#d4af37',
    note: 'A national language of Malawi and widely spoken in eastern Zambia, especially Lusaka.'
  }
];

/* --- Interface strings -------------------------------------------------- */
/* These short UI phrases were checked more confidently than the scripture
   text, but the same review rule applies — correct them freely. */
const PD_UI_STRINGS = {
  en: {
    'nav.home': 'Home',
    'nav.bible': 'Bible',
    'nav.pray': 'Pray',
    'nav.sermons': 'Sermons',
    'nav.assistant': 'Assistant',
    'nav.chat': 'Chat',
    'nav.account': 'Account',
    'nav.teaching': 'Teaching',
    'nav.stories': 'Stories',
    'nav.resources': 'Resources',
    'nav.quizzes': 'Quizzes',
    'nav.live': 'Live',
    'nav.give': 'Give',
    'nav.events': 'Events',
    'nav.gallery': 'Gallery',
    'nav.media': 'Media',
    'nav.news': 'News',
    'nav.testimony': 'Testimony',
    'nav.support': 'Support',
    'nav.about': 'About',
    'nav.contact': 'Contact',
    'nav.team': 'Team',
    'app.tagline': 'A House of Prayer for All Nations',
    'app.welcome': 'Welcome to Prayer Dome',
    'verse.of.day': 'Verse of the day',
    'action.listen': 'Listen',
    'action.stop': 'Stop',
    'action.copy': 'Copy',
    'action.share': 'Share',
    'action.save': 'Save',
    'action.search': 'Search',
    'action.pray': 'Pray this',
    'action.read': 'Read',
    'action.download': 'Download',
    'action.watch': 'Watch',
    'label.language': 'Language',
    'label.scripture': 'Scripture',
    'label.reference': 'Reference',
    'label.topic': 'Topic',
    'label.draft': 'Community draft — awaiting review by a fluent speaker',
    'label.all': 'All',
    'label.lessons': 'Lessons',
    'label.stories': 'Stories',
    'label.resources': 'Resources',
    'greeting.welcome': 'Welcome to Prayer Dome',
    'greeting.amen': 'Amen',
    'hero.welcome': 'Welcome to Prayer Dome — A House of Prayer for All Nations',
    'portal.bible': 'Bible',
    'portal.assistant': 'Assistant',
    'portal.sermons': 'Sermons',
    'portal.teaching': 'Teaching',
    'portal.stories': 'Stories',
    'portal.resources': 'Resources',
    'portal.translate': 'Translate',
    'portal.gallery': 'Gallery',
    'portal.give': 'Give',
    'portal.live': 'Live',
    'portal.quiz': 'Quiz',
    'portal.membership': 'Membership',
    'portal.support': 'Support',
    'portal.testimony': 'Testimony',
    'portal.events': 'Events',
    'portal.news': 'News',
    'portal.media': 'Media',
    'portal.about': 'About',
    'portal.contact': 'Contact',
    'portal.team': 'Team',
    'portal.chat': 'Chat',
    'academy.title': 'Prayer Dome Academy',
    'academy.lessons': 'Lessons',
    'academy.stories': 'Stories',
    'academy.quizzes': 'Quizzes',
    'academy.resources': 'Resources',
    'academy.track.foundations': 'Foundations',
    'academy.track.prayer': 'Prayer & Intercession',
    'academy.track.word': 'The Word of God',
    'academy.track.spirit': 'Holy Spirit & Gifts',
    'academy.track.character': 'Christlike Character',
    'academy.track.mission': 'Mission & Service',
    'docs.title': 'Document Library',
    'docs.statement': 'Statement of Faith',
    'docs.guide.new': 'New Believer’s Growth Guide',
    'location.title': 'You are worshipping from',
    'location.detect': 'Detecting your location…',
    'announcements.title': 'Announcements',
    'notifications.title': 'Notifications',
    'notifications.empty': 'No notifications yet',
    'scripture.featured': 'Featured Scripture',
    'challenge.title': 'Weekly Prayer Challenge',
    'challenge.prayToday': 'I prayed today',
    'devotional.title': 'Daily Devotional',
    'prayer.wall': 'Prayer Wall',
    'bible.center': 'Bible Center',
    'sermon.center': 'Sermon Center',
    'footer.rights': 'All Rights Reserved',
    'footer.verse': 'He does everything blamelessly. — Mark 7:37'
  },
  tum: {
    'nav.home': 'Kunyumba',
    'nav.bible': 'Baibolo',
    'nav.pray': 'Lomba',
    'nav.sermons': 'Maupharazgi',
    'nav.assistant': 'Wovwiri',
    'nav.chat': 'Kudumbiskana',
    'nav.account': 'Akaunti',
    'nav.teaching': 'Masambiro',
    'nav.stories': 'Nkhani',
    'nav.resources': 'Vya Kukhwaska',
    'nav.quizzes': 'Mafumbo',
    'nav.live': 'Moyo',
    'nav.give': 'Pereka',
    'nav.events': 'Viphikiro',
    'nav.gallery': 'Vithuzi',
    'nav.media': 'Vyakuwona',
    'nav.news': 'Nkhani',
    'nav.testimony': 'Ukwititira',
    'nav.support': 'Wovwiri',
    'nav.about': 'Za ise',
    'nav.contact': 'Dumbiranani',
    'nav.team': 'Gulu',
    'app.tagline': 'Nyumba ya Malombo ya Mitundu Yose',
    'app.welcome': 'Mwakwaniskika ku Prayer Dome',
    'verse.of.day': 'Lemba la zuŵa',
    'action.listen': 'Pulika',
    'action.stop': 'Leka',
    'action.copy': 'Kopa',
    'action.share': 'Gaŵana',
    'action.save': 'Sunga',
    'action.search': 'Penja',
    'action.pray': 'Lombani ili',
    'action.read': 'Ŵerengani',
    'action.download': 'Kufumya',
    'action.watch': 'Wonani',
    'label.language': 'Chiyowoyero',
    'label.scripture': 'Lemba',
    'label.reference': 'Malemba',
    'label.topic': 'Mutu',
    'label.draft': 'Ndemetero — likulindilira kuwunikika na munthu wakumanya chiyowoyero',
    'label.all': 'Vyose',
    'label.lessons': 'Masambiro',
    'label.stories': 'Nkhani',
    'label.resources': 'Vyakukhwaska',
    'greeting.welcome': 'Mwakwaniskika ku Prayer Dome',
    'greeting.amen': 'Ameni',
    'hero.welcome': 'Mwakwaniskika ku Nyumba ya Malombo — Nyumba ya Malombo ya Mitundu Yose',
    'portal.bible': 'Baibolo',
    'portal.assistant': 'Wovwiri',
    'portal.sermons': 'Maupharazgi',
    'portal.teaching': 'Masambiro',
    'portal.stories': 'Nkhani',
    'portal.resources': 'Vya Kukhwaska',
    'portal.translate': 'Sungunula',
    'portal.gallery': 'Vithuzi',
    'portal.give': 'Pereka',
    'portal.live': 'Moyo',
    'portal.quiz': 'Mafumbo',
    'portal.membership': 'Umbali',
    'portal.support': 'Wovwiri',
    'portal.testimony': 'Ukwititira',
    'portal.events': 'Viphikiro',
    'portal.news': 'Nkhani',
    'portal.media': 'Vyakuwona',
    'portal.about': 'Za ise',
    'portal.contact': 'Dumbiranani',
    'portal.team': 'Gulu',
    'portal.chat': 'Kudumbiskana',
    'academy.title': 'Sukulu ya Prayer Dome',
    'academy.lessons': 'Masambiro',
    'academy.stories': 'Nkhani',
    'academy.quizzes': 'Mafumbo',
    'academy.resources': 'Vyakukhwaska',
    'academy.track.foundations': 'Maziko',
    'academy.track.prayer': 'Malombo',
    'academy.track.word': 'Mazgu gha Chiuta',
    'academy.track.spirit': 'Mzimu Mutuŵa',
    'academy.track.character': 'Makhalo gha Khristu',
    'academy.track.mission': 'Uthenga',
    'docs.title': 'Mabuku gha Chisambizgo',
    'docs.statement': 'Chipulikano Chithu',
    'docs.guide.new': 'Kalozgera ka Ŵakupulikana Basi',
    'location.title': 'Mukung’ana kufuma ku',
    'location.detect': 'Kupenja malo ghinu…',
    'announcements.title': 'Vilapo',
    'notifications.title': 'Vimanyikwiso',
    'notifications.empty': 'Palibe vimanyikwiso',
    'scripture.featured': 'Lemba Likulutila',
    'challenge.title': 'Nthowa ya Sabata ya Malombo',
    'challenge.prayToday': 'Nalomba lelo',
    'devotional.title': 'Mphambano ya Zuŵa',
    'prayer.wall': 'Khotolo la Malombo',
    'bible.center': 'Malo gha Baibolo',
    'sermon.center': 'Malo gha Maupharazgi',
    'footer.rights': 'Mazaza Ghose Ghapewa',
    'footer.verse': 'Wacita vinthu vyose makora. — Maliko 7:37'
  },
  ssw: {
    'nav.home': 'Ekhaya',
    'nav.bible': 'LiBhayibheli',
    'nav.pray': 'Thandaza',
    'nav.sermons': 'Tintshumayelo',
    'nav.assistant': 'Umsiti',
    'nav.chat': 'Ingcoco',
    'nav.account': 'I-akhawunti',
    'nav.teaching': 'Kufundzisa',
    'nav.stories': 'Tindzaba',
    'nav.resources': 'Tinsita',
    'nav.quizzes': 'Imibuto',
    'nav.live': 'Bukhoma',
    'nav.give': 'Nikela',
    'nav.events': 'Imicimbi',
    'nav.gallery': 'Tithombe',
    'nav.media': 'Imidiya',
    'nav.news': 'Tindzaba',
    'nav.testimony': 'Bufakazi',
    'nav.support': 'Sekela',
    'nav.about': 'Ngatsi',
    'nav.contact': 'Xhumana',
    'nav.team': 'Licembu',
    'app.tagline': 'Indlu Yemkhuleko Yato Tonkhe Tive',
    'app.welcome': 'Wemukelekile ku-Prayer Dome',
    'verse.of.day': 'Livesi lelusuku',
    'action.listen': 'Lalela',
    'action.stop': 'Yima',
    'action.copy': 'Kopisha',
    'action.share': 'Yabelana',
    'action.save': 'Gcina',
    'action.search': 'Sesha',
    'action.pray': 'Thandaza loku',
    'action.read': 'Fundza',
    'action.download': 'Landa',
    'action.watch': 'Bukela',
    'label.language': 'Lulwimi',
    'label.scripture': 'UmBhalo',
    'label.reference': 'Inkhomba',
    'label.topic': 'Sihloko',
    'label.draft': 'Umculu wekucala — usalindzele kubukwa ngulokhulumako lulwimi',
    'label.all': 'Konkhe',
    'label.lessons': 'Tifundvo',
    'label.stories': 'Tindzaba',
    'label.resources': 'Tinsita',
    'greeting.welcome': 'Wemukelekile ku-Prayer Dome',
    'greeting.amen': 'Amen',
    'hero.welcome': 'Wemukelekile Endlini Yemkhuleko — Indlu Yemkhuleko Yato Tonkhe Tive',
    'portal.bible': 'LiBhayibheli',
    'portal.assistant': 'Umsiti',
    'portal.sermons': 'Tintshumayelo',
    'portal.teaching': 'Kufundzisa',
    'portal.stories': 'Tindzaba',
    'portal.resources': 'Tinsita',
    'portal.translate': 'Humusha',
    'portal.gallery': 'Tithombe',
    'portal.give': 'Nikela',
    'portal.live': 'Bukhoma',
    'portal.quiz': 'Imibuto',
    'portal.membership': 'Bulunga',
    'portal.support': 'Sekela',
    'portal.testimony': 'Bufakazi',
    'portal.events': 'Imicimbi',
    'portal.news': 'Tindzaba',
    'portal.media': 'Imidiya',
    'portal.about': 'Ngatsi',
    'portal.contact': 'Xhumana',
    'portal.team': 'Licembu',
    'portal.chat': 'Ingcoco',
    'academy.title': 'Sikolo se-Prayer Dome',
    'academy.lessons': 'Tifundvo',
    'academy.stories': 'Tindzaba',
    'academy.quizzes': 'Imibuto',
    'academy.resources': 'Tinsita',
    'academy.track.foundations': 'Tisekelo',
    'academy.track.prayer': 'Umkhuleko',
    'academy.track.word': 'Livi laNkulunkulu',
    'academy.track.spirit': 'Moya Longcwele',
    'academy.track.character': 'Similo saKhristu',
    'academy.track.mission': 'Lutshumo',
    'docs.title': 'Imibhalo Yekufundzisa',
    'docs.statement': 'Kukholwa Kwethu',
    'docs.guide.new': 'Umhlahlandlela waLabasha',
    'location.title': 'Ukhonta usuka e',
    'location.detect': 'Kuthola indzawo yakho…',
    'announcements.title': 'Tsimemezelo',
    'notifications.title': 'Taziso',
    'notifications.empty': 'Kute azange kube netaziso',
    'scripture.featured': 'UmBhalo Lokhetsekile',
    'challenge.title': 'Inselele Yemkhuleko Yeviki',
    'challenge.prayToday': 'Ngithandazile lamuhla',
    'devotional.title': 'Kudla Kwalelanga',
    'prayer.wall': 'Ludvonga Lwemkhuleko',
    'bible.center': 'Sikhungo seLiBhayibheli',
    'sermon.center': 'Sikhungo Setintshumayelo',
    'footer.rights': 'Onkhe Amalungelo Agodliwe',
    'footer.verse': 'Wente konkhe kuhle. — Makho 7:37'
  },
  bem: {
    'nav.home': 'Paŵulu',
    'nav.bible': 'Baibolo',
    'nav.pray': 'Lomba',
    'nav.sermons': 'Icilengo',
    'nav.assistant': 'Umwafwilisha',
    'nav.chat': 'Ukulanshana',
    'nav.account': 'Akaunti',
    'nav.teaching': 'Amasambilo',
    'nav.stories': 'Ifyano',
    'nav.resources': 'Ifyakubomfya',
    'nav.quizzes': 'Amepusho',
    'nav.live': 'Ubumi',
    'nav.give': 'Pela',
    'nav.events': 'Ifilonganino',
    'nav.gallery': 'Ifikope',
    'nav.media': 'Imediya',
    'nav.news': 'Ifyashi',
    'nav.testimony': 'Ubwitness',
    'nav.support': 'Wafwilisha',
    'nav.about': 'Palwa ifwe',
    'nav.contact': 'Tumeni',
    'nav.team': 'Ikipani',
    'app.tagline': 'Ing’anda ya Kupempela ya Mitundu Yonse',
    'app.welcome': 'Mwaiseni ku Prayer Dome',
    'verse.of.day': 'Lembelo lya lelo',
    'action.listen': 'Ufwikisha',
    'action.stop': 'Leka',
    'action.copy': 'Kopa',
    'action.share': 'Abelana',
    'action.save': 'Sunga',
    'action.search': 'Fwaya',
    'action.pray': 'Lombela ili',
    'action.read': 'Belenga',
    'action.download': 'Leta',
    'action.watch': 'Mona',
    'label.language': 'Ululimi',
    'label.scripture': 'Ilembelo',
    'label.reference': 'Ishimikila',
    'label.topic': 'Mutu',
    'label.draft': 'Amalembo yasambililo — yalindilila ukubwekwa ku bantu bashimikila ululimi',
    'label.all': 'Fyonse',
    'label.lessons': 'Amasambilo',
    'label.stories': 'Ifyano',
    'label.resources': 'Ifyakubomfya',
    'greeting.welcome': 'Mwaiseni ku Prayer Dome',
    'greeting.amen': 'Ameni',
    'hero.welcome': 'Mwaiseni mu Ng’anda ya Kupempela — Ing’anda ya Kupempela ya Mitundu Yonse',
    'portal.bible': 'Baibolo',
    'portal.assistant': 'Umwafwilisha',
    'portal.sermons': 'Icilengo',
    'portal.teaching': 'Amasambilo',
    'portal.stories': 'Ifyano',
    'portal.resources': 'Ifyakubomfya',
    'portal.translate': 'Alula',
    'portal.gallery': 'Ifikope',
    'portal.give': 'Pela',
    'portal.live': 'Ubumi',
    'portal.quiz': 'Amepusho',
    'portal.membership': 'Bumembala',
    'portal.support': 'Wafwilisha',
    'portal.testimony': 'Ubwitness',
    'portal.events': 'Ifilonganino',
    'portal.news': 'Ifyashi',
    'portal.media': 'Imediya',
    'portal.about': 'Palwa ifwe',
    'portal.contact': 'Tumeni',
    'portal.team': 'Ikipani',
    'portal.chat': 'Ukulanshana',
    'academy.title': 'Sukulu ya Prayer Dome',
    'academy.lessons': 'Amasambilo',
    'academy.stories': 'Ifyano',
    'academy.quizzes': 'Amepusho',
    'academy.resources': 'Ifyakubomfya',
    'academy.track.foundations': 'Imilando',
    'academy.track.prayer': 'Ukupempela',
    'academy.track.word': 'Cebo ca Lesa',
    'academy.track.spirit': 'Mupashi wa Mushilo',
    'academy.track.character': 'Mikalile ya kwa Kristu',
    'academy.track.mission': 'Mulimo wa Kutuma',
    'docs.title': 'Mabuku ya Kusambilisha',
    'docs.statement': 'Icitetekelo Cesu',
    'docs.guide.new': 'Kalozela ka Bakatetekela Bapya',
    'location.title': 'Mulepela ukufuma ku',
    'location.detect': 'Ukufwaya apa muli…',
    'announcements.title': 'Amalumbwe',
    'notifications.title': 'Ifyo mukutiishiba',
    'notifications.empty': 'Tapali ifyo mukutiishiba',
    'scripture.featured': 'Ilembelo Lya Patali',
    'challenge.title': 'Amayesho ya Kupempela ya Iciwela',
    'challenge.prayToday': 'Nalomba lelo',
    'devotional.title': 'Iciwelo ca Bushiku',
    'prayer.wall': 'Cibumba ca Mapempelo',
    'bible.center': 'Cipinda ca Baibolo',
    'sermon.center': 'Cipinda ca Milumbe',
    'footer.rights': 'Insambu Shonse Shasungwa',
    'footer.verse': 'Atenda ifintu fyonse bwino. — Marko 7:37'
  },
  nya: {
    'nav.home': 'Kunyumba',
    'nav.bible': 'Baibulo',
    'nav.pray': 'Pempherani',
    'nav.sermons': 'Ulaliki',
    'nav.assistant': 'Wothandiza',
    'nav.chat': 'Kukambirana',
    'nav.account': 'Akaunti',
    'nav.teaching': 'Kuphunzitsa',
    'nav.stories': 'Nkhani',
    'nav.resources': 'Zothandizira',
    'nav.quizzes': 'Mafunso',
    'nav.live': 'Moyo',
    'nav.give': 'Perekani',
    'nav.events': 'Zochitika',
    'nav.gallery': 'Zithunzi',
    'nav.media': 'Media',
    'nav.news': 'Nkhani',
    'nav.testimony': 'Umboni',
    'nav.support': 'Thandizo',
    'nav.about': 'Za ife',
    'nav.contact': 'Lumikizanani',
    'nav.team': 'Gulu',
    'app.tagline': 'Nyumba ya Pemphero ya Mitundu Yonse',
    'app.welcome': 'Takulandirani ku Prayer Dome',
    'verse.of.day': 'Vesi la lero',
    'action.listen': 'Mverani',
    'action.stop': 'Lekani',
    'action.copy': 'Koperani',
    'action.share': 'Gawanani',
    'action.save': 'Sungani',
    'action.search': 'Fufuzani',
    'action.pray': 'Pempherani ili',
    'action.read': 'Werengani',
    'action.download': 'Tsitsani',
    'action.watch': 'Onani',
    'label.language': 'Chilankhulo',
    'label.scripture': 'Lemba',
    'label.reference': 'Mavesi',
    'label.topic': 'Mutu',
    'label.draft': 'Zolembedwa zoyamba — zikudikirira kuwunikidwa ndi olankhula chinenerocho',
    'label.all': 'Zonse',
    'label.lessons': 'Maphunziro',
    'label.stories': 'Nkhani',
    'label.resources': 'Zothandizira',
    'greeting.welcome': 'Takulandirani ku Prayer Dome',
    'greeting.amen': 'Ameni',
    'hero.welcome': 'Takulandirani ku Nyumba ya Pemphero — Nyumba ya Pemphero ya Mitundu Yonse',
    'portal.bible': 'Baibulo',
    'portal.assistant': 'Wothandiza',
    'portal.sermons': 'Ulaliki',
    'portal.teaching': 'Kuphunzitsa',
    'portal.stories': 'Nkhani',
    'portal.resources': 'Zothandizira',
    'portal.translate': 'Tanthauzirani',
    'portal.gallery': 'Zithunzi',
    'portal.give': 'Perekani',
    'portal.live': 'Moyo',
    'portal.quiz': 'Mafunso',
    'portal.membership': 'Umembala',
    'portal.support': 'Thandizo',
    'portal.testimony': 'Umboni',
    'portal.events': 'Zochitika',
    'portal.news': 'Nkhani',
    'portal.media': 'Media',
    'portal.about': 'Za ife',
    'portal.contact': 'Lumikizanani',
    'portal.team': 'Gulu',
    'portal.chat': 'Kukambirana',
    'academy.title': 'Sukulu ya Prayer Dome',
    'academy.lessons': 'Maphunziro',
    'academy.stories': 'Nkhani',
    'academy.quizzes': 'Mafunso',
    'academy.resources': 'Zothandizira',
    'academy.track.foundations': 'Maziko',
    'academy.track.prayer': 'Pemphero',
    'academy.track.word': 'Mawu a Mulungu',
    'academy.track.spirit': 'Mzimu Woyera',
    'academy.track.character': 'Khalidwe la Khristu',
    'academy.track.mission': 'Utumiki',
    'docs.title': 'Mabuku Ophunzitsa',
    'docs.statement': 'Chikhulupiriro Chathu',
    'docs.guide.new': 'Kalozera wa Okhulupirira Atsopano',
    'location.title': 'Mukupemphera kuchokera ku',
    'location.detect': 'Kufufuza komwe muli…',
    'announcements.title': 'Zolengeza',
    'notifications.title': 'Zidziwitso',
    'notifications.empty': 'Palibe zidziwitso',
    'scripture.featured': 'Lemba Lalikulu',
    'challenge.title': 'Vuto la Pemphero la Sabata',
    'challenge.prayToday': 'Ndaph pemphero lero',
    'devotional.title': 'Mawu a Tsiku',
    'prayer.wall': 'Khoma la Pemphero',
    'bible.center': 'Malo a Baibulo',
    'sermon.center': 'Malo a Ulatiki',
    'footer.rights': 'Ufulu Wonse Wosungidwa',
    'footer.verse': 'Iye wachita zonse bwino. — Maliko 7:37'
  }
};

/* --- Scripture pack ----------------------------------------------------- */
const PD_VERSES = [
  {
    id: 'mark-7-37', ref: { en: 'Mark 7:37', tum: 'Maliko 7:37', ssw: 'Makho 7:37', bem: 'Marko 7:37', nya: 'Maliko 7:37' },
    topics: ['wonder', 'praise', 'healing', 'featured'],
    featured: true,
    en: 'And were beyond measure astonished, saying, He hath done all things well: he maketh both the deaf to hear, and the dumb to speak.',
    theme: 'He does everything blamelessly.',
    tum: 'Iwo ŵakazizwa kujumpha muyeso, ŵakati, Wacita vinthu vyose makora: wakupangiska na ŵakufufuma kuti apulike, na ŵakutetemera kuti ayowoyere.',
    ssw: 'Basebatiwa ngendlela leyendlula kukala, batsi, Wente konkhe kuhle: wenza labo labangalali batwe, nelabangakhulumi bakhulume.',
    bem: 'Ukuti balengele nganshi, balanda abati, Eico atenda ifintu fyonse bwino: aletila abakutwi ukumfwa, kabili abaluluma ukulanda.',
    nya: 'Ndipo anadabwa kwambiri, nati, Iye wachita zonse bwino: amachititsa ogontha kumva, ndi osalankhula kuyankhula.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'john-3-16', ref: { en: 'John 3:16', tum: 'Yohane 3:16', ssw: 'Johane 3:16' , bem: 'Yohane 3:16', nya: 'Yohane 3:16' },
    topics: ['salvation', 'love', 'faith'],
    en: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
    tum: 'Pakuti Chiuta wakatemwa charu chomene, mwakuti wakapeleka Mwana wake yumoza pera, mwakuti waliyose uyo wakumugomezga waleke kuparanyika, kweni waŵe na umoyo wamuyirayira.',
    ssw: 'Ngobe Nkulunkulu walitsandza kangaka live, waze wanikela ngeNdvodzana yakhe leyodvwa letelwe, kuze kutsi bonkhe labakholwa kuyo bangabhubhi, kodvwa babe nekuphila lokuphakadze.',
    bem: 'Pantu Lesa alitemwa isonde lyonsa sana, eico aapele Umwana wakwe umo wine, pakuti onse uyo umwitabika tekuti alobe, sombi akabe no mweo wa muyayaya.',
    nya: 'Pakuti Mulungu anakonda dziko lapansi kotero, kuti anapatsa Mwana wake wobadwa yekha, kuti yense wokhulupirira Iye asatayike, koma akhale ndi moyo wosatha.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'psalm-23-1', ref: { en: 'Psalm 23:1-3', tum: 'Masalimo 23:1-3', ssw: 'Tihlabelelo 23:1-3' , bem: 'Amalumbo 23:1-3', nya: 'Masamu 23:1-3' },
    topics: ['comfort', 'provision', 'guidance'],
    en: 'The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul.',
    tum: 'Yehova ndiye muliska wane; nizamusoŵa chara. Wakunigoneka mu vyaŵi viwisi: wakunilongozga ku maji ghakukhala. Wakuwezga umoyo wane.',
    ssw: 'Simakadze ungumelusi wami; angeke ngiswele lutfo. Ungilalisa emadlelweni laluhlata: ungiholela emantini lathulile. Uyayivuselela umphefumulo wami.',
    bem: 'Yawe e mwangashi wandi; nshakabile icintu. Alanshisha mu cishala icanshisha; alantwala ku menshi ya mutende. Alubula umweo wandi.',
    nya: 'Yehova ndiye mbusa wanga; sindidzasowa kanthu. Amagoneka pa msipu wobiriwira; amanditsogolera ku madzi abata. Abwezeretsa moyo wanga.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'isaiah-41-10', ref: { en: 'Isaiah 41:10', tum: 'Yesaya 41:10', ssw: 'Isaya 41:10' , bem: 'Yesaya 41:10', nya: 'Yesaya 41:10' },
    topics: ['fear', 'strength', 'comfort'],
    en: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.',
    tum: 'Ungawopanga chara; pakuti ndili nawe: ungafwanga mtima chara; pakuti ndine Chiuta wako: nizamukukhozga; enya, nizamukovwira; enya, nizamukukora na woko lane lamalyero la urunji wane.',
    ssw: 'Ungesabi; ngobe nginawe: ungapheli emandla; ngobe nginguNkulunkulu wakho: ngitakucinisa; yebo, ngitakusita; yebo, ngitakubambelela ngesandla sami sekudla sekulunga.',
    bem: 'Witina nakalya, pantu ndi nawe; wiipyasuka, pantu Ne Lesa obe; nko kosa, cine cine nko kwafwa, kabili nko kusunga no kuboko kwandi ukwa kulungama.',
    nya: 'Usaope, pakuti Ine ndili pamodzi nawe; usataye mtima, pakuti Ine ndine Mulungu wako; ndidzakulimbikitsa, ndithudi ndidzakuthandiza, ndidzakugwiriziza ndi dzanja lamanja la chilungamo changa.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'philippians-4-6', ref: { en: 'Philippians 4:6-7', tum: 'Ŵafilipi 4:6-7', ssw: 'Bafiliphi 4:6-7' , bem: 'Filipi 4:6-7', nya: 'Afilipi 4:6-7' },
    topics: ['fear', 'peace', 'prayer'],
    en: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.',
    tum: 'Mungenyekanga na kanthu chara; kweni mu vinthu vyose mwa malombo na ŵeyelero pamoza na kuwonga, maromberezgo ghinu ghamanyikwe kwa Chiuta. Ndipo mtende wa Chiuta, uwo ukuluska kupulikiska kose, uzamusunga mitima na maghanoghano ghinu mwa Khristu Yesu.',
    ssw: 'Ningakhatsateki ngalutfo; kodvwa kuko konkhe ngemkhuleko nangekuncusa kanye nekubonga, ticelo tenu atatiswe kuNkulunkulu. Nekuthula kwaNkulunkulu, lokwedlula konkhe kucondzisisa, kutawugcina tinhlitiyo netingcondvo tenu ngaKhristu Jesu.',
    bem: 'Mwitaabamo icintu na cimo; lelo mu fintu fyonse ukupitila mu mapepo ne mikulilo pamo na kulumba, amapepo yenu ayishibikwe kuli Lesa. No mutende wa kwa Lesa, uupitilila amano yonse, ukasunga imitima yenu ne milangululo yenu muli Kristu Yesu.',
    nya: 'Musadere nkhawa za kanthu; koma mʼzinthu zonse ndi pemphero ndi kupempha pamodzi ndi chiyamiko, zopempha zanu zidziwike kwa Mulungu. Ndipo mtendere wa Mulungu woposa nzeru zonse udzateteza mitima yanu ndi maganizo anu mwa Khristu Yesu.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'jeremiah-29-11', ref: { en: 'Jeremiah 29:11', tum: 'Yeremiya 29:11', ssw: 'Jeremiya 29:11' , bem: 'Yeremiya 29:11', nya: 'Yeremiya 29:11' },
    topics: ['guidance', 'hope', 'future'],
    en: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.',
    tum: 'Pakuti nkhumanya maghanoghano agho nkhughanaghana pa imwe, wakuti Yehova, maghanoghano gha mtende, kuti gha uheni chara, kuti nimupeni chigomezgo cha kunthazi.',
    ssw: 'Ngobe ngiyayati imicabango lengiyicabanga ngani, kusho Simakadze, imicabango yekuthula, hhayi yekubi, kuze nginiphe likusasa lelinelitsemba.',
    bem: 'Pantu nishibe amalangululo ayo nkulanguluka pali imwe, efyo Yawe alandile, amalangululo ya mutende, te ya bubifi, ukuti mbapeni impela ya kusubila.',
    nya: 'Pakuti Ine ndidziwa maganizo amene ndimaganizira pa inu, ati Yehova, maganizo a mtendere, osati a choipa, kuti ndikupatseni tsogolo la chiyembekezo.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'romans-8-28', ref: { en: 'Romans 8:28', tum: 'Ŵaroma 8:28', ssw: 'Bharoma 8:28' , bem: 'Loma 8:28', nya: 'Aroma 8:28' },
    topics: ['hope', 'trust', 'comfort'],
    en: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
    tum: 'Ndipo tikumanya kuti vinthu vyose vikugwira ntchito pamoza kuti viŵe viwemi ku awo ŵakutemwa Chiuta, ku awo ŵakachemeka mwakuyana na khumbo lake.',
    ssw: 'Futsi siyati kutsi tonkhe tintfo tisebentelana ndzawonye kwentela lokuhle kulabo labatsandza Nkulunkulu, kulabo lababitiwe ngekwenhloso yakhe.',
    bem: 'Kabili twishibe ukuti fintu fyonse fikabombela pamo ukuleta icawama ku ba bapala Lesa, ku ba bita ukulingana no kukabila kwakwe.',
    nya: 'Ndipo tidziwa kuti zinthu zonse zigwirira ntchito pamodzi kuchitira zabwino iwo akonda Mulungu, iwo oitanidwa monga mwa kutsimikiza mtima kwake.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'psalm-46-1', ref: { en: 'Psalm 46:1', tum: 'Masalimo 46:1', ssw: 'Tihlabelelo 46:1' , bem: 'Amalumbo 46:1', nya: 'Masamu 46:1' },
    topics: ['fear', 'strength', 'protection'],
    en: 'God is our refuge and strength, a very present help in trouble.',
    tum: 'Chiuta ndiye chibisalilo chithu na nkhongono zithu, movwiri wakusangika luŵiro mu suzgo.',
    ssw: 'Nkulunkulu usiphephelo setfu nemandla etfu, lusito lolukhona kakhulu ekuhluphekeni.',
    bem: 'Lesa e cilonganino cesu ne maka yesu, wafwilisha wapepi sana mu buyanshi.',
    nya: 'Mulungu ndiye pothawira pathu ndi mphamvu yathu, thandizo lopezeka msanga mʼmasautso.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'proverbs-3-5', ref: { en: 'Proverbs 3:5-6', tum: 'Zintharika 3:5-6', ssw: 'Taga 3:5-6' , bem: 'Imilumbe 3:5-6', nya: 'Miyambi 3:5-6' },
    topics: ['guidance', 'trust', 'faith'],
    en: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.',
    tum: 'Gomezga Yehova na mtima wako wose; ungathembanga kupulikiska kwako wekha chara. Mu nthowa zako zose umuzomerezge, ndipo iyo wazamunyoloska nthowa zako.',
    ssw: 'Tsemba Simakadze ngenhlitiyo yakho yonkhe; ungenciki ekucondzisiseni kwakho. Etindleleni takho tonkhe muvume, futsi yena utawucondzisa tindlela takho.',
    bem: 'Citila Yawe no mutima obe onse; wiishintilila pa mano yobe we mwine; mu nshila shobe shonse umwishibe, kabili akolose inshila shobe.',
    nya: 'Khulupirira Yehova ndi mtima wako wonse; usatsamire pa luntha lako wekha. Mʼnjira zako zonse umvomeleze Iye, ndipo adzawongola mapazi ako.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'matthew-11-28', ref: { en: 'Matthew 11:28', tum: 'Mateyu 11:28', ssw: 'Matewu 11:28' , bem: 'Mateyo 11:28', nya: 'Mateyu 11:28' },
    topics: ['rest', 'comfort', 'grief'],
    en: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.',
    tum: 'Zani kwa ine, mose imwe mukugwira ntchito yakusuzga ndipo muli na miligo yizito, ndipo nizamumupani kupumura.',
    ssw: 'Wotani kimi, nonkhe lenisebenta ngemandla lenisindvwa ngemitfwalo, mine ngitaniphumuta.',
    bem: 'Iseni kuli Ne, mwe bonse abacula ne ba katulwa, kabili Nkamitusha.',
    nya: 'Idzani kwa Ine, nonse olemedwa ndi olemedwetsa, ndipo ndidzakupumulitsani.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'psalm-121-1', ref: { en: 'Psalm 121:1-2', tum: 'Masalimo 121:1-2', ssw: 'Tihlabelelo 121:1-2' , bem: 'Amalumbo 121:1-2', nya: 'Masamu 121:1-2' },
    topics: ['protection', 'help', 'strength'],
    en: 'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth.',
    tum: 'Nizamukwezga maso ghane ku mapiri, uko kukufuma wovwiri wane. Wovwiri wane wakufuma kwa Yehova, uyo wakalenga kuchanya na charu.',
    ssw: 'Ngitaphakamisela emehlo ami etintsabeni, lapho kuvela khona lusito lwami. Lusito lwami luvela kuSimakadze, lowenta lizulu nemhlaba.',
    bem: 'Nkasenda amenso yandi ku mpili; bushe ubwafwilisho wandi bufuma kwi? Ubwafwilisho wandi bufuma kuli Yawe, uwaumba umulu ne sonde.',
    nya: 'Ndidzakweza maso anga ku mapiri; kuchokera kuti kudza thandizo langa? Thandizo langa lichokera kwa Yehova, amene analenga kumwamba ndi dziko lapansi.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'joshua-1-9', ref: { en: 'Joshua 1:9', tum: 'Yoshuwa 1:9', ssw: 'Joshuwa 1:9' , bem: 'Yoswa 1:9', nya: 'Yoswa 1:9' },
    topics: ['fear', 'strength', 'courage'],
    en: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.',
    tum: 'Asi nkhakulangura? Uŵe wankhongono na wachikanga; ungawopanga, nesi kufwa mtima: pakuti Yehova Chiuta wako wali nawe kulikose uko ukuluta.',
    ssw: 'Angikayali yini kuwe? Coca ube nemandla ube nesibindzi; ungesabi, futsi ungapheli emandla: ngobe Simakadze Nkulunkulu wakho unawe nome ngukuphi lapho uya khona.',
    bem: 'Bushe nshakukulaya? Kosa, kabili ikata umutima; witina, nangu ukututumuka: pantu Yawe Lesa obe ali nawe ukuya konse ukuya.',
    nya: 'Kodi sindinakulamulira? Limbika, khala wolimba mtima; musawope, musataye mtima; pakuti Yehova Mulungu wako ali nawe kumene ulikonse upitako.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'psalm-91-1', ref: { en: 'Psalm 91:1-2', tum: 'Masalimo 91:1-2', ssw: 'Tihlabelelo 91:1-2' , bem: 'Amalumbo 91:1-2', nya: 'Masamu 91:1-2' },
    topics: ['protection', 'safety', 'fear'],
    en: 'He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty. I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust.',
    tum: 'Uyo wakukhala mu malo ghakubisama gha Wapachanya Nkhanira wazamukhala mu mfwiri wa Wankhongonozose. Nizamuyowoya kwa Yehova, Ndiye chibisalilo chane na chigongwe chane: Chiuta wane; mwa iyo nizamugomezga.',
    ssw: 'Lohlala endzaweni leyimfihlo yaLosetulu Kakhulu utawuhlala ngaphansi kwesitfunti saSomandla. Ngitakusho ngaSimakadze, Usiphephelo sami nenqaba yami: Nkulunkulu wami; ngitawukwetsemba kuye.',
    bem: 'Uyo ekala mu cifiso ca ba pa mulu nganshi, akekala mu cintelelwe ca ba maka yonse. Nkati kuli Yawe, E cilonganino candi ne linga lyandi; Lesa wandi; Nkamucetekela.',
    nya: 'Iye wokhala mʼmalo obisika a Wam’mwambamwamba adzakhala mʼmthunzi wa Wamphamvuzonse. Ndidzati kwa Yehova, Iye ndiye pothawira panga ndi linga langa; Mulungu wanga ndidzamkhulupirira.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'isaiah-40-31', ref: { en: 'Isaiah 40:31', tum: 'Yesaya 40:31', ssw: 'Isaya 40:31' , bem: 'Yesaya 40:31', nya: 'Yesaya 40:31' },
    topics: ['strength', 'hope', 'endurance'],
    en: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.',
    tum: 'Kweni awo ŵakulindilira Yehova ŵazamuwezgeka nkhongono zawo; ŵazamukwera na mapapindo nga ni nombo; ŵazamuchimbira, kwambura kuvuka; ndipo ŵazamwenda, kwambura kufwa mtima.',
    ssw: 'Kodvwa labo labamelele Simakadze batawuvuselela emandla abo; batawukhuphuka ngetimphiko njengetinkhoti; batawugijima, bangakhatsali; futsi batawuhamba, bangapheli emandla.',
    bem: 'Lelo ba balolela Yawe bakapilibula maka yabo; bakakwesha no mapapiko nga mbalaminwe; bakachimbile, tekuti banake; bakalende, tekuti banake umwenso.',
    nya: 'Koma iwo amene adikira Yehova adzawonjezera mphamvu zawo; adzakwera ndi mapiko ngati ziwombankhanga; adzathamanga osatopa, adzayenda osakomoka.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'psalm-34-18', ref: { en: 'Psalm 34:18', tum: 'Masalimo 34:18', ssw: 'Tihlabelelo 34:18' , bem: 'Amalumbo 34:18', nya: 'Masamu 34:18' },
    topics: ['grief', 'comfort', 'depression'],
    en: 'The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.',
    tum: 'Yehova wali pafupi na awo ŵali na mtima wakuphyoka; ndipo wakuponoska awo ŵali na mzimu wakujiyuyura.',
    ssw: 'Simakadze useduze nalabo labanetinhlitiyo letephukile; futsi usindzisa labo labanemoya lodzabukile.',
    bem: 'Yawe ali mupepi na ba mitima isansamunuka; kabili apususha ba na mupashi wa kusakamana.',
    nya: 'Yehova ali pafupi ndi osweka mtima, napulumutsa iwo ali ndi mzimu wosweka.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'john-14-27', ref: { en: 'John 14:27', tum: 'Yohane 14:27', ssw: 'Johane 14:27' , bem: 'Yohane 14:27', nya: 'Yohane 14:27' },
    topics: ['peace', 'fear', 'comfort'],
    en: 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.',
    tum: 'Mtende nkhumulekerani, mtende wane nkhumupani: kuti nga ni umo charu chikupelekera chara, nkhumupani. Mtima winu ungatimbanizgikanga, nesi kuwopa.',
    ssw: 'Kuthula ngishiya nani, kuthula kwami nginipha kona: hhayi njengobe live liniphako, nginipha kona. Inhlitiyo yenu ingakhatsateki, futsi ingesabi.',
    bem: 'Mutende mbashila kuli imwe, umutende wandi mbapela kuli imwe: te ndangati isonde lipele, mbapela. Imitima yenu teiyandamanike, nangu ukutina.',
    nya: 'Mtendere ndikusiyirani, mtendere wanga ndimapatsa kwa inu; osati monga dziko lapansi lipatsa, ndimapatsa kwa inu. Mtima wanu usavutike, kapenanso kuchita mantha.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'philippians-4-13', ref: { en: 'Philippians 4:13', tum: 'Ŵafilipi 4:13', ssw: 'Bafiliphi 4:13' , bem: 'Filipi 4:13', nya: 'Afilipi 4:13' },
    topics: ['strength', 'faith', 'courage'],
    en: 'I can do all things through Christ which strengtheneth me.',
    tum: 'Ningachita vinthu vyose kwizira mwa Khristu uyo wakunikhozga.',
    ssw: 'Ngingakwenta konkhe ngaKhristu longiniketa emandla.',
    bem: 'Nga cita fintu fyonse muli Kristu uwankosa amaka.',
    nya: 'Ndikhoza kuchita zonse mwa Khristu wondilimbikitsa ine.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'psalm-27-1', ref: { en: 'Psalm 27:1', tum: 'Masalimo 27:1', ssw: 'Tihlabelelo 27:1' , bem: 'Amalumbo 27:1', nya: 'Masamu 27:1' },
    topics: ['fear', 'courage', 'protection'],
    en: 'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?',
    tum: 'Yehova ndiye ungweru wane na chiponosko chane; nizamuwopa njani? Yehova ndiye nkhongono za umoyo wane; nizamufwira njani mtima?',
    ssw: 'Simakadze ukukhanya kwami nensindziso yami; ngingesaba bani? Simakadze ungemandla ekuphila kwami; ngingetfuka bani?',
    bem: 'Yawe e lubuto lwandi no pusukilo lwandi; nka tina nani? Yawe e maka ya mweo wandi; nka yandamana nani?',
    nya: 'Yehova ndiye kuunika kwanga ndi chipulumutso changa; ndidzaopa yani? Yehova ndiye mphamvu ya moyo wanga; ndidzaopa yani?',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'matthew-6-9', ref: { en: 'Matthew 6:9-10', tum: 'Mateyu 6:9-10', ssw: 'Matewu 6:9-10' , bem: 'Mateyo 6:9-10', nya: 'Mateyu 6:9-10' },
    topics: ['prayer', 'worship'],
    en: 'Our Father which art in heaven, Hallowed be thy name. Thy kingdom come. Thy will be done in earth, as it is in heaven.',
    tum: 'Adada withu imwe muli kuchanya, Zina linu litumbikike. Ufumu winu wize. Khumbo linu lichitike pa charu, nga umo liliri kuchanya.',
    ssw: 'Babe wetfu losezulwini, Alingcweliswe libito lakho. Umbuso wakho awute. Intsandvo yakho ayentiwe emhlabeni, njengobe yentiwa ezulwini.',
    bem: 'Wishetata uwali mu mulu, Ishina lyobe lipewe ubulemu. Ubufumu bobe bwise. Ukufwaya kwobe kucitwe pa calo, ngefyo cacitwa ku mulu.',
    nya: 'Atate wathu wakumwamba, dzina lanu liyeretsedwe. Ufumu wanu udze. Kufuna kwanu kuchitike padziko lapansi monga kumwamba.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'romans-10-9', ref: { en: 'Romans 10:9', tum: 'Ŵaroma 10:9', ssw: 'Bharoma 10:9' , bem: 'Loma 10:9', nya: 'Aroma 10:9' },
    topics: ['salvation', 'faith'],
    en: 'That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved.',
    tum: 'Kuti usange uzamuzomera na mulomo wako kuti Yesu ni Fumu, ndipo uzamugomezga mu mtima wako kuti Chiuta wakamuwuska ku ŵakufwa, uzamuponoskeka.',
    ssw: 'Kutsi nangabe uvuma ngemlomo wakho kutsi Jesu uyiNkhosi, futsi ukholwe enhlitiyweni yakho kutsi Nkulunkulu wamvusa kulabafile, utawusindziswa.',
    bem: 'Pantu nga cakuti washimikila no kanwa kobe ukuti Yesu e Shikulu, no kutetekela mu mutima obe ukuti Lesa alimubushe ku bafwa, ukapusuka.',
    nya: 'Kuti ngati uvomereza ndi pakamwa pako kuti Yesu ndi Ambuye, ndi kukhulupirira mumtima mwako kuti Mulungu anamuukitsa kwa akufa, udzapulumutsidwa.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'psalm-118-24', ref: { en: 'Psalm 118:24', tum: 'Masalimo 118:24', ssw: 'Tihlabelelo 118:24' , bem: 'Amalumbo 118:24', nya: 'Masamu 118:24' },
    topics: ['thanksgiving', 'joy', 'worship'],
    en: 'This is the day which the LORD hath made; we will rejoice and be glad in it.',
    tum: 'Ili ndilo zuŵa ilo Yehova wakalizenga; tisekelerenge na kukondwa mwa ilo.',
    ssw: 'Lolu lusuku Simakadze lalentako; sitawujabula sitfokoze kulo.',
    bem: 'Uyu e bushiku bwa Yawe apangile; tukasekelele kabili tukondwe mulibyo.',
    nya: 'Lino ndi tsiku limene Yehova analipanga; tidzakondwera ndi kukondwera mmenemo.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: '1-thess-5-16', ref: { en: '1 Thessalonians 5:16-18', tum: '1 Ŵatesalonika 5:16-18', ssw: '1 Thesalonika 5:16-18' , bem: '1 Tesalonika 5:16-18', nya: '1 Atesalonika 5:16-18' },
    topics: ['thanksgiving', 'prayer', 'joy'],
    en: 'Rejoice evermore. Pray without ceasing. In every thing give thanks: for this is the will of God in Christ Jesus concerning you.',
    tum: 'Sekelerani nyengo zose. Lombani kwambura kuleka. Mu vinthu vyose wongani: pakuti ili ndilo khumbo la Chiuta mwa Khristu Yesu pa imwe.',
    ssw: 'Jabulani njalo. Thandazani ningaphetsi. Kuko konkhe bongani: ngobe lena yintsandvo yaNkulunkulu ngaKhristu Jesu ngani.',
    bem: 'Sekelenu umuyaya. Lombeleni ukwabula ukuleka. Mu fintu fyonse tumbeni: pantu ili e kufwaya kwa kwa Lesa muli Kristu Yesu pali imwe.',
    nya: 'Kondwerani nthawi zonse. Pempherani osaleka. Mʼzinthu zonse yamikani, pakuti ichi ndi chifuniro cha Mulungu mwa Khristu Yesu pa inu.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'hebrews-11-1', ref: { en: 'Hebrews 11:1', tum: 'Ŵahebere 11:1', ssw: 'Emaheberu 11:1' , bem: 'Bahebere 11:1', nya: 'Ahebri 11:1' },
    topics: ['faith', 'hope'],
    en: 'Now faith is the substance of things hoped for, the evidence of things not seen.',
    tum: 'Sono chipulikano ntchakukhozgeka cha vinthu ivyo tikugomezga, ukaboni wa vinthu ivyo tikuviwona chara.',
    ssw: 'Nyalo kukholwa kuyincindzeleko yaletintfo letetsenjwako, bufakazi bemitfo lengabonwa.',
    bem: 'Nomba icitetekelo caba icishinka ica fintu fitusubila, ubwene bwa fintu fitumumona nangu.',
    nya: 'Tsopano chikhulupiriro ndi kutsimikiza kwa zinthu zoyembekezeredwa, umboni wa zinthu zosawoneka.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: '2-cor-12-9', ref: { en: '2 Corinthians 12:9', tum: '2 Ŵakorinte 12:9', ssw: '2 Korinte 12:9' , bem: '2 Kolose 12:9', nya: '2 Akorinto 12:9' },
    topics: ['strength', 'grace', 'healing'],
    en: 'My grace is sufficient for thee: for my strength is made perfect in weakness.',
    tum: 'Uchizi wane ngwakukwana kwa iwe: pakuti nkhongono zane zikufikapo mu kulopwa.',
    ssw: 'Umusa wami wanele kuwe: ngobe emandla ami aphelela ebutsakatsakeni.',
    bem: 'Uluse lwandi lwakwana kuli iwe: pantu maka yandi yapwililika mu kunaka.',
    nya: 'Chisomo changa chikukwanira iwe, pakuti mphamvu yanga imakwaniritsidwa mu kufooka.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'psalm-103-2', ref: { en: 'Psalm 103:2-3', tum: 'Masalimo 103:2-3', ssw: 'Tihlabelelo 103:2-3' , bem: 'Amalumbo 103:2-3', nya: 'Masamu 103:2-3' },
    topics: ['healing', 'thanksgiving', 'forgiveness'],
    en: 'Bless the LORD, O my soul, and forget not all his benefits: Who forgiveth all thine iniquities; who healeth all thy diseases.',
    tum: 'Tumbika Yehova, iwe umoyo wane, ndipo ungaluwanga viwemi vyake vyose: Uyo wakugowokera zakwananga zako zose; uyo wakuchizga matenda ghako ghose.',
    ssw: 'Busisa Simakadze, mphefumulo wami, ungakhohlwa tonkhe tinzuzo takhe: Lothethelela tonkhe tono takho; lowelapha tonkhe tifo takho.',
    bem: 'Temba Yawe, we mweo wandi, wiilaba fya sefyo bonse fyakwe: Uwashishi fya bubifi fyobe fyonse; uwanga ubulwele bwobe bonse.',
    nya: 'Lembekeza Yehova, moyo wanga, usaiwale zabwino zake zonse: Iye amene akhululukira mphulupulu zako zonse, amene achiritsa nthenda zako zonse.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'james-1-5', ref: { en: 'James 1:5', tum: 'Yakobe 1:5', ssw: 'Jakobe 1:5' , bem: 'Yakobo 1:5', nya: 'Yakobo 1:5' },
    topics: ['guidance', 'wisdom'],
    en: 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.',
    tum: 'Usange yumoza wa imwe wakusoŵa vinjeru, waromberezge kwa Chiuta, uyo wakupeleka ku ŵanthu wose mwaufumu, kwambura kutukwana; ndipo vizamupika kwa iyo.',
    ssw: 'Nangabe lomunye wenu aswele kuhlakanipha, akacele kuNkulunkulu, lonika bonkhe bantfu ngesihle, angasoli; futsi kutawuniketwa kuye.',
    bem: 'Nga cakuti umo pali mwebo ashiwa amano, aipushe kuli Lesa, uwapele abantu bonse ukwabula ukukana; kabili akapelwa.',
    nya: 'Ngati wina wa inu asowa nzeru, apemphe kwa Mulungu, amene apatsa kwa onse mowolowa manja osadzudzula; ndipo adzapatsidwa.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'psalm-133-1', ref: { en: 'Psalm 133:1', tum: 'Masalimo 133:1', ssw: 'Tihlabelelo 133:1' , bem: 'Amalumbo 133:1', nya: 'Masamu 133:1' },
    topics: ['church', 'family', 'unity'],
    en: 'Behold, how good and how pleasant it is for brethren to dwell together in unity!',
    tum: 'Wonani, ntchiwemi ndipo ntchakukondweska wuli kuti ŵabali ŵakhale pamoza mu umoza!',
    ssw: 'Bukani, kuhle futsi kumnandzi kanjani kutsi bazalwane bahlale ndzawonye ngebunye!',
    bem: 'Mona, nifwama sana kabili nifya kutemwa ukuti bakwasu bekele pamo mu bumo!',
    nya: 'Taonani, nkokoma ndi kokondweretsa bwanji kuti abale akhale pamodzi mu umodzi!',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'malachi-3-10', ref: { en: 'Malachi 3:10', tum: 'Malaki 3:10', ssw: 'Malakhi 3:10' , bem: 'Malaki 3:10', nya: 'Malaki 3:10' },
    topics: ['provision', 'giving', 'blessing'],
    en: 'Bring ye all the tithes into the storehouse, that there may be meat in mine house, and prove me now herewith, saith the LORD of hosts, if I will not open you the windows of heaven, and pour you out a blessing, that there shall not be room enough to receive it.',
    tum: 'Yizgani vyakhumi vyose mu nyumba ya vyakusunga, kuti mukaŵe chakurya mu nyumba yane, ndipo muniyezge sono na ichi, wakuti Yehova wa nkhondo, usange nizamumujulirani mawindo gha kuchanya, na kumuthirirani thumbiko, mwakuti kwazamuŵavya malo ghakukwana kupokelera.',
    ssw: 'Letsani konkhe kweshumi endlini yekugcina, kuze kutsi kube nekudla endlini yami, futsi ningivivinye ngaloku, kusho Simakadze wemabutfo, kutsi angeke yini nginivulele emafasitelo elizulu, nginitfululele sibusiso, kuze kungabikho indzawo lenele yekusemukela.',
    bem: 'Leteni icakumi conse mu inganda ya cishala, pakuti ku musumba kwa Lesa kuli ifyakulya, kabili mungeneshe nomba pali iyi, efyo Yawe wa bufi alandile, nga kuti nshile kwijula iwindo lya mu mulu, no kumitila amapalo ukwabula umwanya wakupokelela.',
    nya: 'Bweretsani chakhumi chonse mʼnyumba yosungiramo, kuti mukhale chakudya mʼnyumba yanga, ndipo ndiyeseni tsopano pa ichi, ati Yehova wa makamu, ngati sindidzatsegula mazenera akumwamba, ndi kukutsanulirani dalitso losowa malo okwanira kulilandira.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'matthew-28-19', ref: { en: 'Matthew 28:19-20', tum: 'Mateyu 28:19-20', ssw: 'Matewu 28:19-20' , bem: 'Mateyo 28:19-20', nya: 'Mateyu 28:19-20' },
    topics: ['mission', 'church', 'nation'],
    en: 'Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost: and, lo, I am with you alway, even unto the end of the world.',
    tum: 'Ntheura lutani, mukasambizge mitundu yose, kuŵabatiza mu zina la Adada, na la Mwana, na la Mzimu Utuŵa: ndipo, wonani, nili namwe nyengo zose, mpaka ku umaliro wa charu.',
    ssw: 'Ngakoke hambani, nifundzise tonkhe tive, nibabhabhadzise egameni leYise, neleNdvodzana, neleMoya Longcwele: futsi, buka, nginani onkhe emalanga, kuze kube sekupheleni kwelive.',
    bem: 'Eico kabiyeni, mukasambilishishe imitungu yonse, ukubabatisha mu shina lya Tata, no Mwana, no Mupashi wa Mushilo: kabili, mona, ndi na imwe nshiku shonse, ukufika ku mapwa ya calo.',
    nya: 'Chifukwa chake pitani, phunzitsani anthu a mitundu yonse, ndi kuwabatiza mʼdzina la Atate, ndi la Mwana, ndi la Mzimu Woyera; ndipo taonani, Ine ndili pamodzi nanu masiku onse, kufikira chimaliziro cha dziko lapansi.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: '1-john-1-9', ref: { en: '1 John 1:9', tum: '1 Yohane 1:9', ssw: '1 Johane 1:9' , bem: '1 Yohane 1:9', nya: '1 Yohane 1:9' },
    topics: ['forgiveness', 'salvation'],
    en: 'If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.',
    tum: 'Usange tikuzomera zakwananga zithu, iyo ngwakugomezgeka ndipo ngwaurunji kutigowokera zakwananga zithu, na kutitozga ku ubudi wose.',
    ssw: 'Nangabe sivuma tono tetfu, yena wetsembekile ulungile kutsi asitsetselele tono tetfu, futsi asihlambulule kuko konkhe kungalungi.',
    bem: 'Nga twashimikila ububifi bwesu, aishiba ukutupokelela no kutusangulula ku bubifi bwesu bonse, no kutusangulula ku bubifiku bonse.',
    nya: 'Ngati tivomereza machimo athu, Iye ali wokhulupirika ndi wolungama kuti atikhululukire machimo athu ndi kutisambitsa ku chosalungama chonse.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'psalm-51-10', ref: { en: 'Psalm 51:10', tum: 'Masalimo 51:10', ssw: 'Tihlabelelo 51:10' , bem: 'Amalumbo 51:10', nya: 'Masamu 51:10' },
    topics: ['forgiveness', 'repentance', 'renewal'],
    en: 'Create in me a clean heart, O God; and renew a right spirit within me.',
    tum: 'Nilengerani mtima utuŵa, imwe Chiuta; ndipo muwezge mzimu wakunyoloka mukati mwane.',
    ssw: 'Ngidalele inhlitiyo lehlantekile, Nkulunkulu; futsi uvuselele umoya lolungile ngekhatsi kwami.',
    bem: 'Lenga muli ine umutima uusanguluka, we Lesa; kabili wapya mupashi uusuminishiw a mukati kandi.',
    nya: 'Lengani mwa ine mtima woyera, Mulungu, ndipo konzanso mzimu wolungama mwa ine.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'revelation-21-4', ref: { en: 'Revelation 21:4', tum: 'Chivumbuzi 21:4', ssw: 'Sembulo 21:4' , bem: 'Kusokolola 21:4', nya: 'Chivumbulutso 21:4' },
    topics: ['grief', 'hope', 'comfort'],
    en: 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain.',
    tum: 'Ndipo Chiuta wazamufyura masozi ghose ku maso ghawo; ndipo kuzamuŵavya nyifwa kuti, nesi chitima, nesi kulira, nesi kuzamuŵavya vyakuŵinya kuti.',
    ssw: 'Futsi Nkulunkulu utawesula tonkhe tinyembeti emehlweni abo; futsi kute kufa lokutawuba khona, nome lusizi, nome kukhala, futsi kute buhlungu lobutawuba khona.',
    bem: 'Kabili Lesa akapukuta amanshi yonse ku menso yabo; takuli mfwa, nangu cililo, nangu muwilo, nangu ubulanda kabili.',
    nya: 'Ndipo Mulungu adzapukuta misozi yonse mʼmaso mwawo; ndipo sipadzakhalanso imfa, kapena chisoni, kapena kulira, kapena kupweteka kowawa.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  },
  {
    id: 'psalm-127-1', ref: { en: 'Psalm 127:1', tum: 'Masalimo 127:1', ssw: 'Tihlabelelo 127:1' , bem: 'Amalumbo 127:1', nya: 'Masamu 127:1' },
    topics: ['family', 'home', 'protection'],
    en: 'Except the LORD build the house, they labour in vain that build it: except the LORD keep the city, the watchman waketh but in vain.',
    tum: 'Kwambura kuti Yehova wazenge nyumba, ŵakugwira ntchito waka awo ŵakuyizenga: kwambura kuti Yehova wasunge msumba, mulinda wakuwuka waka pawaka.',
    ssw: 'Ngaphandle kwekutsi Simakadze akhe indlu, basebenta ngelite labo labayakhako: ngaphandle kwekutsi Simakadze alondze lidolobha, umlindzi ulinda ngelite.',
    bem: 'Kano Yawe takula inganda, abakula bacula bule: kano Yawe tasunga musumba, umulinda alinda bule.',
    nya: 'Ngati Yehova samanga nyumba, iwo akuimanga agwira ntchito pachabe; ngati Yehova sasunga mzinda, mlonda adikira pachabe.',
    reviewed: { en: true, tum: false, ssw: false, bem: false, nya: false }
  }
];

/* ==========================================================================
 * Runtime helpers
 * ======================================================================== */

/** Look up a language descriptor, defaulting to English. */
function pdLanguage(code) {
  return PD_LANGUAGES.find(function (l) { return l.code === code; }) || PD_LANGUAGES[0];
}

/** Translate a UI key. Falls back to English, then to the key itself. */
function pdT(key, lang) {
  var table = PD_UI_STRINGS[lang] || PD_UI_STRINGS.en;
  if (table && table[key]) return table[key];
  if (PD_UI_STRINGS.en[key]) return PD_UI_STRINGS.en[key];
  return key;
}

/** Fetch one verse by id. */
function pdVerse(id) {
  return PD_VERSES.find(function (v) { return v.id === id; }) || null;
}

/**
 * Render a verse in a language.
 * Always returns something usable: if a translation is missing it hands back
 * the English text and says so, rather than an empty string.
 */
function pdRenderVerse(id, lang) {
  var v = typeof id === 'object' ? id : pdVerse(id);
  if (!v) return null;

  var code = pdLanguage(lang).code;
  var text = v[code];
  var fellBack = false;

  if (!text) { text = v.en; code = 'en'; fellBack = true; }

  return {
    id: v.id,
    lang: code,
    requested: lang,
    fellBack: fellBack,
    ref: (v.ref && (v.ref[code] || v.ref.en)) || '',
    text: text,
    reviewed: !!(v.reviewed && v.reviewed[code]),
    topics: v.topics || []
  };
}

/** All verses tagged with a topic, in the requested language. */
function pdVersesByTopic(topic, lang) {
  return PD_VERSES
    .filter(function (v) { return (v.topics || []).indexOf(topic) !== -1; })
    .map(function (v) { return pdRenderVerse(v, lang); });
}

/**
 * Case- and accent-insensitive search across every language at once, so a
 * member can find a verse by typing it in whichever language they think in.
 */
function pdSearchVerses(query, lang) {
  var q = String(query || '').trim().toLowerCase();
  if (!q) return [];

  function norm(s) {
    return String(s || '').toLowerCase()
      .normalize ? String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                 : String(s || '').toLowerCase();
  }
  var nq = norm(q);

  return PD_VERSES.filter(function (v) {
    if (norm(v.en).indexOf(nq) !== -1) return true;
    if (norm(v.tum).indexOf(nq) !== -1) return true;
    if (norm(v.ssw).indexOf(nq) !== -1) return true;
    if (v.bem && norm(v.bem).indexOf(nq) !== -1) return true;
    if (v.nya && norm(v.nya).indexOf(nq) !== -1) return true;
    var refs = v.ref || {};
    return Object.keys(refs).some(function (k) {
      return norm(refs[k]).indexOf(nq) !== -1;
    });
  }).map(function (v) { return pdRenderVerse(v, lang); });
}

/** Deterministic verse of the day — same verse for everyone, all day. */
function pdVerseOfDay(lang, date) {
  var d = date || new Date();
  var dayIndex = Math.floor(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000
  );
  return pdRenderVerse(PD_VERSES[dayIndex % PD_VERSES.length], lang);
}

/**
 * Pick the best speech-synthesis voice for a language.
 * Tumbuka and siSwati have no dedicated voices on any mainstream browser, so
 * PD_LANGUAGES lists phonetically-near fallbacks. Returns null if nothing
 * matches, and the caller should then tell the user rather than read the text
 * in a wildly wrong accent.
 */
function pdPickVoice(langCode, voices) {
  var list = voices || (window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
  if (!list || !list.length) return null;

  var prefs = pdLanguage(langCode).speech || ['en'];
  for (var i = 0; i < prefs.length; i++) {
    var want = prefs[i].toLowerCase();
    var hit = list.find(function (v) {
      var vl = (v.lang || '').toLowerCase().replace('_', '-');
      return vl === want || vl.indexOf(want + '-') === 0;
    });
    if (hit) return hit;
  }
  return null;
}

/* Export for Node-based tests while staying a plain global in the browser. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PD_LANGUAGES: PD_LANGUAGES,
    PD_UI_STRINGS: PD_UI_STRINGS,
    PD_VERSES: PD_VERSES,
    pdLanguage: pdLanguage,
    pdT: pdT,
    pdVerse: pdVerse,
    pdRenderVerse: pdRenderVerse,
    pdVersesByTopic: pdVersesByTopic,
    pdSearchVerses: pdSearchVerses,
    pdVerseOfDay: pdVerseOfDay,
    pdPickVoice: pdPickVoice
  };
}
