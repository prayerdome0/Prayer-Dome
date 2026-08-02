/*
 * Prayer Dome — Multilingual Scripture Pack
 * ===========================================================================
 * English (KJV) · Chitumbuka · siSwati
 *
 * ---------------------------------------------------------------------------
 * PLEASE READ BEFORE PUBLISHING — TRANSLATION PROVENANCE
 * ---------------------------------------------------------------------------
 * The English text is King James Version and is public domain: it is exact.
 *
 * The Chitumbuka and siSwati renderings in this file are **community drafts**.
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
    'nav.home': 'Home', 'nav.bible': 'Bible', 'nav.pray': 'Pray',
    'nav.sermons': 'Sermons', 'nav.assistant': 'Assistant', 'nav.chat': 'Chat',
    'nav.account': 'Account',
    'app.tagline': 'A House of Prayer for All Nations',
    'verse.of.day': 'Verse of the day',
    'action.listen': 'Listen', 'action.stop': 'Stop', 'action.copy': 'Copy',
    'action.share': 'Share', 'action.save': 'Save', 'action.search': 'Search',
    'action.pray': 'Pray this',
    'label.language': 'Language', 'label.scripture': 'Scripture',
    'label.reference': 'Reference', 'label.topic': 'Topic',
    'label.draft': 'Community draft — awaiting review by a fluent speaker',
    'greeting.welcome': 'Welcome to Prayer Dome',
    'greeting.amen': 'Amen'
  },
  tum: {
    'nav.home': 'Kunyumba', 'nav.bible': 'Baibolo', 'nav.pray': 'Lomba',
    'nav.sermons': 'Maupharazgi', 'nav.assistant': 'Wovwiri', 'nav.chat': 'Kudumbiskana',
    'nav.account': 'Akaunti',
    'app.tagline': 'Nyumba ya Malombo ya Mitundu Yose',
    'verse.of.day': 'Lemba la zuŵa',
    'action.listen': 'Pulika', 'action.stop': 'Leka', 'action.copy': 'Kopa',
    'action.share': 'Gaŵana', 'action.save': 'Sunga', 'action.search': 'Penja',
    'action.pray': 'Lombani ili',
    'label.language': 'Chiyowoyero', 'label.scripture': 'Lemba',
    'label.reference': 'Malemba', 'label.topic': 'Mutu',
    'label.draft': 'Ndemetero — likulindilira kuwunikika na munthu wakumanya chiyowoyero',
    'greeting.welcome': 'Mwakwaniskika ku Prayer Dome',
    'greeting.amen': 'Ameni'
  },
  ssw: {
    'nav.home': 'Ekhaya', 'nav.bible': 'LiBhayibheli', 'nav.pray': 'Thandaza',
    'nav.sermons': 'Tintshumayelo', 'nav.assistant': 'Umsiti', 'nav.chat': 'Ingcoco',
    'nav.account': 'I-akhawunti',
    'app.tagline': 'Indlu Yemkhuleko Yato Tonkhe Tive',
    'verse.of.day': 'Livesi lelusuku',
    'action.listen': 'Lalela', 'action.stop': 'Yima', 'action.copy': 'Kopisha',
    'action.share': 'Yabelana', 'action.save': 'Gcina', 'action.search': 'Sesha',
    'action.pray': 'Thandaza loku',
    'label.language': 'Lulwimi', 'label.scripture': 'UmBhalo',
    'label.reference': 'Inkhomba', 'label.topic': 'Sihloko',
    'label.draft': 'Umculu wekucala — usalindzele kubukwa ngulokhulumako lulwimi',
    'greeting.welcome': 'Wemukelekile ku-Prayer Dome',
    'greeting.amen': 'Amen'
  },
  bem: {
    'nav.home': 'Paŵulu', 'nav.bible': 'Baibolo', 'nav.pray': 'Lomba',
    'nav.sermons': 'Icilengo', 'nav.assistant': 'Umwafwilisha', 'nav.chat': 'Ukulanshana',
    'nav.account': 'Akaunti',
    'app.tagline': 'Ing’anda ya Kupempela ya Mitundu Yonse',
    'verse.of.day': 'Lembelo lya lelo',
    'action.listen': 'Ufwikisha', 'action.stop': 'Leka', 'action.copy': 'Kopa',
    'action.share': 'Abelana', 'action.save': 'Sunga', 'action.search': 'Fwaya',
    'action.pray': 'Lombela ili',
    'label.language': 'Ululimi', 'label.scripture': 'Ilembelo',
    'label.reference': 'Ishimikila', 'label.topic': 'Mutu',
    'label.draft': 'Amalembo yasambililo — yalindilila ukubwekwa ku bantu bashimikila ululimi',
    'greeting.welcome': 'Mwaiseni ku Prayer Dome',
    'greeting.amen': 'Ameni'
  },
  nya: {
    'nav.home': 'Kunyumba', 'nav.bible': 'Baibulo', 'nav.pray': 'Pempherani',
    'nav.sermons': 'Ulaliki', 'nav.assistant': 'Wothandiza', 'nav.chat': 'Kukambirana',
    'nav.account': 'Akaunti',
    'app.tagline': 'Nyumba ya Pemphero ya Mitundu Yonse',
    'verse.of.day': 'Vesi la lero',
    'action.listen': 'Mverani', 'action.stop': 'Lekani', 'action.copy': 'Koperani',
    'action.share': 'Gawanani', 'action.save': 'Sungani', 'action.search': 'Fufuzani',
    'action.pray': 'Pempherani ili',
    'label.language': 'Chilankhulo', 'label.scripture': 'Lemba',
    'label.reference': 'Mavesi', 'label.topic': 'Mutu',
    'label.draft': 'Zolembedwa zoyamba — zikudikirira kuwunikidwa ndi olankhula chinenerocho',
    'greeting.welcome': 'Takulandirani ku Prayer Dome',
    'greeting.amen': 'Ameni'
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
    id: 'john-3-16', ref: { en: 'John 3:16', tum: 'Yohane 3:16', ssw: 'Johane 3:16' },
    topics: ['salvation', 'love', 'faith'],
    en: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
    tum: 'Pakuti Chiuta wakatemwa charu chomene, mwakuti wakapeleka Mwana wake yumoza pera, mwakuti waliyose uyo wakumugomezga waleke kuparanyika, kweni waŵe na umoyo wamuyirayira.',
    ssw: 'Ngobe Nkulunkulu walitsandza kangaka live, waze wanikela ngeNdvodzana yakhe leyodvwa letelwe, kuze kutsi bonkhe labakholwa kuyo bangabhubhi, kodvwa babe nekuphila lokuphakadze.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'psalm-23-1', ref: { en: 'Psalm 23:1-3', tum: 'Masalimo 23:1-3', ssw: 'Tihlabelelo 23:1-3' },
    topics: ['comfort', 'provision', 'guidance'],
    en: 'The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul.',
    tum: 'Yehova ndiye muliska wane; nizamusoŵa chara. Wakunigoneka mu vyaŵi viwisi: wakunilongozga ku maji ghakukhala. Wakuwezga umoyo wane.',
    ssw: 'Simakadze ungumelusi wami; angeke ngiswele lutfo. Ungilalisa emadlelweni laluhlata: ungiholela emantini lathulile. Uyayivuselela umphefumulo wami.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'isaiah-41-10', ref: { en: 'Isaiah 41:10', tum: 'Yesaya 41:10', ssw: 'Isaya 41:10' },
    topics: ['fear', 'strength', 'comfort'],
    en: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.',
    tum: 'Ungawopanga chara; pakuti ndili nawe: ungafwanga mtima chara; pakuti ndine Chiuta wako: nizamukukhozga; enya, nizamukovwira; enya, nizamukukora na woko lane lamalyero la urunji wane.',
    ssw: 'Ungesabi; ngobe nginawe: ungapheli emandla; ngobe nginguNkulunkulu wakho: ngitakucinisa; yebo, ngitakusita; yebo, ngitakubambelela ngesandla sami sekudla sekulunga.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'philippians-4-6', ref: { en: 'Philippians 4:6-7', tum: 'Ŵafilipi 4:6-7', ssw: 'Bafiliphi 4:6-7' },
    topics: ['fear', 'peace', 'prayer'],
    en: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.',
    tum: 'Mungenyekanga na kanthu chara; kweni mu vinthu vyose mwa malombo na ŵeyelero pamoza na kuwonga, maromberezgo ghinu ghamanyikwe kwa Chiuta. Ndipo mtende wa Chiuta, uwo ukuluska kupulikiska kose, uzamusunga mitima na maghanoghano ghinu mwa Khristu Yesu.',
    ssw: 'Ningakhatsateki ngalutfo; kodvwa kuko konkhe ngemkhuleko nangekuncusa kanye nekubonga, ticelo tenu atatiswe kuNkulunkulu. Nekuthula kwaNkulunkulu, lokwedlula konkhe kucondzisisa, kutawugcina tinhlitiyo netingcondvo tenu ngaKhristu Jesu.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'jeremiah-29-11', ref: { en: 'Jeremiah 29:11', tum: 'Yeremiya 29:11', ssw: 'Jeremiya 29:11' },
    topics: ['guidance', 'hope', 'future'],
    en: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.',
    tum: 'Pakuti nkhumanya maghanoghano agho nkhughanaghana pa imwe, wakuti Yehova, maghanoghano gha mtende, kuti gha uheni chara, kuti nimupeni chigomezgo cha kunthazi.',
    ssw: 'Ngobe ngiyayati imicabango lengiyicabanga ngani, kusho Simakadze, imicabango yekuthula, hhayi yekubi, kuze nginiphe likusasa lelinelitsemba.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'romans-8-28', ref: { en: 'Romans 8:28', tum: 'Ŵaroma 8:28', ssw: 'Bharoma 8:28' },
    topics: ['hope', 'trust', 'comfort'],
    en: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
    tum: 'Ndipo tikumanya kuti vinthu vyose vikugwira ntchito pamoza kuti viŵe viwemi ku awo ŵakutemwa Chiuta, ku awo ŵakachemeka mwakuyana na khumbo lake.',
    ssw: 'Futsi siyati kutsi tonkhe tintfo tisebentelana ndzawonye kwentela lokuhle kulabo labatsandza Nkulunkulu, kulabo lababitiwe ngekwenhloso yakhe.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'psalm-46-1', ref: { en: 'Psalm 46:1', tum: 'Masalimo 46:1', ssw: 'Tihlabelelo 46:1' },
    topics: ['fear', 'strength', 'protection'],
    en: 'God is our refuge and strength, a very present help in trouble.',
    tum: 'Chiuta ndiye chibisalilo chithu na nkhongono zithu, movwiri wakusangika luŵiro mu suzgo.',
    ssw: 'Nkulunkulu usiphephelo setfu nemandla etfu, lusito lolukhona kakhulu ekuhluphekeni.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'proverbs-3-5', ref: { en: 'Proverbs 3:5-6', tum: 'Zintharika 3:5-6', ssw: 'Taga 3:5-6' },
    topics: ['guidance', 'trust', 'faith'],
    en: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.',
    tum: 'Gomezga Yehova na mtima wako wose; ungathembanga kupulikiska kwako wekha chara. Mu nthowa zako zose umuzomerezge, ndipo iyo wazamunyoloska nthowa zako.',
    ssw: 'Tsemba Simakadze ngenhlitiyo yakho yonkhe; ungenciki ekucondzisiseni kwakho. Etindleleni takho tonkhe muvume, futsi yena utawucondzisa tindlela takho.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'matthew-11-28', ref: { en: 'Matthew 11:28', tum: 'Mateyu 11:28', ssw: 'Matewu 11:28' },
    topics: ['rest', 'comfort', 'grief'],
    en: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.',
    tum: 'Zani kwa ine, mose imwe mukugwira ntchito yakusuzga ndipo muli na miligo yizito, ndipo nizamumupani kupumura.',
    ssw: 'Wotani kimi, nonkhe lenisebenta ngemandla lenisindvwa ngemitfwalo, mine ngitaniphumuta.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'psalm-121-1', ref: { en: 'Psalm 121:1-2', tum: 'Masalimo 121:1-2', ssw: 'Tihlabelelo 121:1-2' },
    topics: ['protection', 'help', 'strength'],
    en: 'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth.',
    tum: 'Nizamukwezga maso ghane ku mapiri, uko kukufuma wovwiri wane. Wovwiri wane wakufuma kwa Yehova, uyo wakalenga kuchanya na charu.',
    ssw: 'Ngitaphakamisela emehlo ami etintsabeni, lapho kuvela khona lusito lwami. Lusito lwami luvela kuSimakadze, lowenta lizulu nemhlaba.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'joshua-1-9', ref: { en: 'Joshua 1:9', tum: 'Yoshuwa 1:9', ssw: 'Joshuwa 1:9' },
    topics: ['fear', 'strength', 'courage'],
    en: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.',
    tum: 'Asi nkhakulangura? Uŵe wankhongono na wachikanga; ungawopanga, nesi kufwa mtima: pakuti Yehova Chiuta wako wali nawe kulikose uko ukuluta.',
    ssw: 'Angikayali yini kuwe? Coca ube nemandla ube nesibindzi; ungesabi, futsi ungapheli emandla: ngobe Simakadze Nkulunkulu wakho unawe nome ngukuphi lapho uya khona.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'psalm-91-1', ref: { en: 'Psalm 91:1-2', tum: 'Masalimo 91:1-2', ssw: 'Tihlabelelo 91:1-2' },
    topics: ['protection', 'safety', 'fear'],
    en: 'He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty. I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust.',
    tum: 'Uyo wakukhala mu malo ghakubisama gha Wapachanya Nkhanira wazamukhala mu mfwiri wa Wankhongonozose. Nizamuyowoya kwa Yehova, Ndiye chibisalilo chane na chigongwe chane: Chiuta wane; mwa iyo nizamugomezga.',
    ssw: 'Lohlala endzaweni leyimfihlo yaLosetulu Kakhulu utawuhlala ngaphansi kwesitfunti saSomandla. Ngitakusho ngaSimakadze, Usiphephelo sami nenqaba yami: Nkulunkulu wami; ngitawukwetsemba kuye.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'isaiah-40-31', ref: { en: 'Isaiah 40:31', tum: 'Yesaya 40:31', ssw: 'Isaya 40:31' },
    topics: ['strength', 'hope', 'endurance'],
    en: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.',
    tum: 'Kweni awo ŵakulindilira Yehova ŵazamuwezgeka nkhongono zawo; ŵazamukwera na mapapindo nga ni nombo; ŵazamuchimbira, kwambura kuvuka; ndipo ŵazamwenda, kwambura kufwa mtima.',
    ssw: 'Kodvwa labo labamelele Simakadze batawuvuselela emandla abo; batawukhuphuka ngetimphiko njengetinkhoti; batawugijima, bangakhatsali; futsi batawuhamba, bangapheli emandla.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'psalm-34-18', ref: { en: 'Psalm 34:18', tum: 'Masalimo 34:18', ssw: 'Tihlabelelo 34:18' },
    topics: ['grief', 'comfort', 'depression'],
    en: 'The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.',
    tum: 'Yehova wali pafupi na awo ŵali na mtima wakuphyoka; ndipo wakuponoska awo ŵali na mzimu wakujiyuyura.',
    ssw: 'Simakadze useduze nalabo labanetinhlitiyo letephukile; futsi usindzisa labo labanemoya lodzabukile.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'john-14-27', ref: { en: 'John 14:27', tum: 'Yohane 14:27', ssw: 'Johane 14:27' },
    topics: ['peace', 'fear', 'comfort'],
    en: 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.',
    tum: 'Mtende nkhumulekerani, mtende wane nkhumupani: kuti nga ni umo charu chikupelekera chara, nkhumupani. Mtima winu ungatimbanizgikanga, nesi kuwopa.',
    ssw: 'Kuthula ngishiya nani, kuthula kwami nginipha kona: hhayi njengobe live liniphako, nginipha kona. Inhlitiyo yenu ingakhatsateki, futsi ingesabi.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'philippians-4-13', ref: { en: 'Philippians 4:13', tum: 'Ŵafilipi 4:13', ssw: 'Bafiliphi 4:13' },
    topics: ['strength', 'faith', 'courage'],
    en: 'I can do all things through Christ which strengtheneth me.',
    tum: 'Ningachita vinthu vyose kwizira mwa Khristu uyo wakunikhozga.',
    ssw: 'Ngingakwenta konkhe ngaKhristu longiniketa emandla.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'psalm-27-1', ref: { en: 'Psalm 27:1', tum: 'Masalimo 27:1', ssw: 'Tihlabelelo 27:1' },
    topics: ['fear', 'courage', 'protection'],
    en: 'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?',
    tum: 'Yehova ndiye ungweru wane na chiponosko chane; nizamuwopa njani? Yehova ndiye nkhongono za umoyo wane; nizamufwira njani mtima?',
    ssw: 'Simakadze ukukhanya kwami nensindziso yami; ngingesaba bani? Simakadze ungemandla ekuphila kwami; ngingetfuka bani?',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'matthew-6-9', ref: { en: 'Matthew 6:9-10', tum: 'Mateyu 6:9-10', ssw: 'Matewu 6:9-10' },
    topics: ['prayer', 'worship'],
    en: 'Our Father which art in heaven, Hallowed be thy name. Thy kingdom come. Thy will be done in earth, as it is in heaven.',
    tum: 'Adada withu imwe muli kuchanya, Zina linu litumbikike. Ufumu winu wize. Khumbo linu lichitike pa charu, nga umo liliri kuchanya.',
    ssw: 'Babe wetfu losezulwini, Alingcweliswe libito lakho. Umbuso wakho awute. Intsandvo yakho ayentiwe emhlabeni, njengobe yentiwa ezulwini.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'romans-10-9', ref: { en: 'Romans 10:9', tum: 'Ŵaroma 10:9', ssw: 'Bharoma 10:9' },
    topics: ['salvation', 'faith'],
    en: 'That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved.',
    tum: 'Kuti usange uzamuzomera na mulomo wako kuti Yesu ni Fumu, ndipo uzamugomezga mu mtima wako kuti Chiuta wakamuwuska ku ŵakufwa, uzamuponoskeka.',
    ssw: 'Kutsi nangabe uvuma ngemlomo wakho kutsi Jesu uyiNkhosi, futsi ukholwe enhlitiyweni yakho kutsi Nkulunkulu wamvusa kulabafile, utawusindziswa.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'psalm-118-24', ref: { en: 'Psalm 118:24', tum: 'Masalimo 118:24', ssw: 'Tihlabelelo 118:24' },
    topics: ['thanksgiving', 'joy', 'worship'],
    en: 'This is the day which the LORD hath made; we will rejoice and be glad in it.',
    tum: 'Ili ndilo zuŵa ilo Yehova wakalizenga; tisekelerenge na kukondwa mwa ilo.',
    ssw: 'Lolu lusuku Simakadze lalentako; sitawujabula sitfokoze kulo.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: '1-thess-5-16', ref: { en: '1 Thessalonians 5:16-18', tum: '1 Ŵatesalonika 5:16-18', ssw: '1 Thesalonika 5:16-18' },
    topics: ['thanksgiving', 'prayer', 'joy'],
    en: 'Rejoice evermore. Pray without ceasing. In every thing give thanks: for this is the will of God in Christ Jesus concerning you.',
    tum: 'Sekelerani nyengo zose. Lombani kwambura kuleka. Mu vinthu vyose wongani: pakuti ili ndilo khumbo la Chiuta mwa Khristu Yesu pa imwe.',
    ssw: 'Jabulani njalo. Thandazani ningaphetsi. Kuko konkhe bongani: ngobe lena yintsandvo yaNkulunkulu ngaKhristu Jesu ngani.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'hebrews-11-1', ref: { en: 'Hebrews 11:1', tum: 'Ŵahebere 11:1', ssw: 'Emaheberu 11:1' },
    topics: ['faith', 'hope'],
    en: 'Now faith is the substance of things hoped for, the evidence of things not seen.',
    tum: 'Sono chipulikano ntchakukhozgeka cha vinthu ivyo tikugomezga, ukaboni wa vinthu ivyo tikuviwona chara.',
    ssw: 'Nyalo kukholwa kuyincindzeleko yaletintfo letetsenjwako, bufakazi bemitfo lengabonwa.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: '2-cor-12-9', ref: { en: '2 Corinthians 12:9', tum: '2 Ŵakorinte 12:9', ssw: '2 Korinte 12:9' },
    topics: ['strength', 'grace', 'healing'],
    en: 'My grace is sufficient for thee: for my strength is made perfect in weakness.',
    tum: 'Uchizi wane ngwakukwana kwa iwe: pakuti nkhongono zane zikufikapo mu kulopwa.',
    ssw: 'Umusa wami wanele kuwe: ngobe emandla ami aphelela ebutsakatsakeni.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'psalm-103-2', ref: { en: 'Psalm 103:2-3', tum: 'Masalimo 103:2-3', ssw: 'Tihlabelelo 103:2-3' },
    topics: ['healing', 'thanksgiving', 'forgiveness'],
    en: 'Bless the LORD, O my soul, and forget not all his benefits: Who forgiveth all thine iniquities; who healeth all thy diseases.',
    tum: 'Tumbika Yehova, iwe umoyo wane, ndipo ungaluwanga viwemi vyake vyose: Uyo wakugowokera zakwananga zako zose; uyo wakuchizga matenda ghako ghose.',
    ssw: 'Busisa Simakadze, mphefumulo wami, ungakhohlwa tonkhe tinzuzo takhe: Lothethelela tonkhe tono takho; lowelapha tonkhe tifo takho.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'james-1-5', ref: { en: 'James 1:5', tum: 'Yakobe 1:5', ssw: 'Jakobe 1:5' },
    topics: ['guidance', 'wisdom'],
    en: 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.',
    tum: 'Usange yumoza wa imwe wakusoŵa vinjeru, waromberezge kwa Chiuta, uyo wakupeleka ku ŵanthu wose mwaufumu, kwambura kutukwana; ndipo vizamupika kwa iyo.',
    ssw: 'Nangabe lomunye wenu aswele kuhlakanipha, akacele kuNkulunkulu, lonika bonkhe bantfu ngesihle, angasoli; futsi kutawuniketwa kuye.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'psalm-133-1', ref: { en: 'Psalm 133:1', tum: 'Masalimo 133:1', ssw: 'Tihlabelelo 133:1' },
    topics: ['church', 'family', 'unity'],
    en: 'Behold, how good and how pleasant it is for brethren to dwell together in unity!',
    tum: 'Wonani, ntchiwemi ndipo ntchakukondweska wuli kuti ŵabali ŵakhale pamoza mu umoza!',
    ssw: 'Bukani, kuhle futsi kumnandzi kanjani kutsi bazalwane bahlale ndzawonye ngebunye!',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'malachi-3-10', ref: { en: 'Malachi 3:10', tum: 'Malaki 3:10', ssw: 'Malakhi 3:10' },
    topics: ['provision', 'giving', 'blessing'],
    en: 'Bring ye all the tithes into the storehouse, that there may be meat in mine house, and prove me now herewith, saith the LORD of hosts, if I will not open you the windows of heaven, and pour you out a blessing, that there shall not be room enough to receive it.',
    tum: 'Yizgani vyakhumi vyose mu nyumba ya vyakusunga, kuti mukaŵe chakurya mu nyumba yane, ndipo muniyezge sono na ichi, wakuti Yehova wa nkhondo, usange nizamumujulirani mawindo gha kuchanya, na kumuthirirani thumbiko, mwakuti kwazamuŵavya malo ghakukwana kupokelera.',
    ssw: 'Letsani konkhe kweshumi endlini yekugcina, kuze kutsi kube nekudla endlini yami, futsi ningivivinye ngaloku, kusho Simakadze wemabutfo, kutsi angeke yini nginivulele emafasitelo elizulu, nginitfululele sibusiso, kuze kungabikho indzawo lenele yekusemukela.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'matthew-28-19', ref: { en: 'Matthew 28:19-20', tum: 'Mateyu 28:19-20', ssw: 'Matewu 28:19-20' },
    topics: ['mission', 'church', 'nation'],
    en: 'Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost: and, lo, I am with you alway, even unto the end of the world.',
    tum: 'Ntheura lutani, mukasambizge mitundu yose, kuŵabatiza mu zina la Adada, na la Mwana, na la Mzimu Utuŵa: ndipo, wonani, nili namwe nyengo zose, mpaka ku umaliro wa charu.',
    ssw: 'Ngakoke hambani, nifundzise tonkhe tive, nibabhabhadzise egameni leYise, neleNdvodzana, neleMoya Longcwele: futsi, buka, nginani onkhe emalanga, kuze kube sekupheleni kwelive.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: '1-john-1-9', ref: { en: '1 John 1:9', tum: '1 Yohane 1:9', ssw: '1 Johane 1:9' },
    topics: ['forgiveness', 'salvation'],
    en: 'If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.',
    tum: 'Usange tikuzomera zakwananga zithu, iyo ngwakugomezgeka ndipo ngwaurunji kutigowokera zakwananga zithu, na kutitozga ku ubudi wose.',
    ssw: 'Nangabe sivuma tono tetfu, yena wetsembekile ulungile kutsi asitsetselele tono tetfu, futsi asihlambulule kuko konkhe kungalungi.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'psalm-51-10', ref: { en: 'Psalm 51:10', tum: 'Masalimo 51:10', ssw: 'Tihlabelelo 51:10' },
    topics: ['forgiveness', 'repentance', 'renewal'],
    en: 'Create in me a clean heart, O God; and renew a right spirit within me.',
    tum: 'Nilengerani mtima utuŵa, imwe Chiuta; ndipo muwezge mzimu wakunyoloka mukati mwane.',
    ssw: 'Ngidalele inhlitiyo lehlantekile, Nkulunkulu; futsi uvuselele umoya lolungile ngekhatsi kwami.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'revelation-21-4', ref: { en: 'Revelation 21:4', tum: 'Chivumbuzi 21:4', ssw: 'Sembulo 21:4' },
    topics: ['grief', 'hope', 'comfort'],
    en: 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain.',
    tum: 'Ndipo Chiuta wazamufyura masozi ghose ku maso ghawo; ndipo kuzamuŵavya nyifwa kuti, nesi chitima, nesi kulira, nesi kuzamuŵavya vyakuŵinya kuti.',
    ssw: 'Futsi Nkulunkulu utawesula tonkhe tinyembeti emehlweni abo; futsi kute kufa lokutawuba khona, nome lusizi, nome kukhala, futsi kute buhlungu lobutawuba khona.',
    reviewed: { en: true, tum: false, ssw: false }
  },
  {
    id: 'psalm-127-1', ref: { en: 'Psalm 127:1', tum: 'Masalimo 127:1', ssw: 'Tihlabelelo 127:1' },
    topics: ['family', 'home', 'protection'],
    en: 'Except the LORD build the house, they labour in vain that build it: except the LORD keep the city, the watchman waketh but in vain.',
    tum: 'Kwambura kuti Yehova wazenge nyumba, ŵakugwira ntchito waka awo ŵakuyizenga: kwambura kuti Yehova wasunge msumba, mulinda wakuwuka waka pawaka.',
    ssw: 'Ngaphandle kwekutsi Simakadze akhe indlu, basebenta ngelite labo labayakhako: ngaphandle kwekutsi Simakadze alondze lidolobha, umlindzi ulinda ngelite.',
    reviewed: { en: true, tum: false, ssw: false }
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
