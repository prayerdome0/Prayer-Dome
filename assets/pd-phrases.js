/*
 * Prayer Dome — application phrase pack
 * ===========================================================================
 * A plain English-keyed dictionary consumed by assets/pd-i18n.js, which
 * translates the whole rendered page rather than only the handful of elements
 * that carry a `data-pd-t` key.
 *
 * ---------------------------------------------------------------------------
 * TRANSLATION PROVENANCE — PLEASE READ BEFORE EDITING
 * ---------------------------------------------------------------------------
 * The Chitumbuka, siSwati, Bemba and Nyanja entries are **community drafts**,
 * exactly like the Scripture pack in translation-data.js. They give the
 * ministry a working interface in each language; they are not a certified
 * translation. A fluent speaker should correct them in place.
 *
 * The seed entries were carried over from the reviewed PD_UI_STRINGS table so
 * the two packs never disagree with each other.
 *
 * RULES
 *   * The key is the exact English string as it appears in the markup, with
 *     surrounding whitespace, decorative emoji and a trailing colon removed —
 *     pd-i18n.js strips and restores those automatically.
 *   * Omit a language rather than guessing. A missing entry first falls back
 *     to English, then the reader's browser offers it to the live auto tier
 *     (Google, via the site's own /api/translate relay) which renders it
 *     badged "auto" until a reviewer promotes it here. A wrong entry misleads
 *     a worshipper; an "auto" one is at least labelled as unreviewed.
 *   * Proper nouns (Prayer Dome, Cloudinary, Facebook, people's names, place
 *     names, currency codes) are deliberately absent: they are not translated.
 * ===========================================================================
 */
(function (global) {
  'use strict';

  /*
   * Authoring format: one row per English phrase, `[tum, ssw, bem, nya]`.
   * An empty string means "not translated yet" and falls back to English.
   * This shape keeps the file readable and roughly a quarter of the size of
   * repeating the language keys on every entry.
   */
  var ROWS = {
    /* ------------------------------------------------------- navigation */
    'Home': ['Kunyumba', 'Ekhaya', 'Paŵulu', 'Kunyumba'],
    'Bible': ['Baibolo', 'LiBhayibheli', 'Baibolo', 'Baibulo'],
    'Pray': ['Lomba', 'Thandaza', 'Lomba', 'Pempherani'],
    'Prayer': ['Malombo', 'Umkhuleko', 'Ipepo', 'Pemphero'],
    'Sermons': ['Maupharazgi', 'Tintshumayelo', 'Icilengo', 'Ulaliki'],
    'Assistant': ['Wovwiri', 'Umsiti', 'Umwafwilisha', 'Wothandiza'],
    'Chat': ['Kudumbiskana', 'Ingcoco', 'Ukulanshana', 'Kukambirana'],
    'Account': ['Akaunti', 'I-akhawunti', 'Akaunti', 'Akaunti'],
    'Teaching': ['Masambiro', 'Kufundzisa', 'Amasambilo', 'Kuphunzitsa'],
    'Stories': ['Nkhani', 'Tindzaba', 'Ifyano', 'Nkhani'],
    'Resources': ['Vya Kukhwaska', 'Tinsita', 'Ifyakubomfya', 'Zothandizira'],
    'Quizzes': ['Mafumbo', 'Imibuto', 'Amepusho', 'Mafunso'],
    'Quiz': ['Mafumbo', 'Imibuto', 'Amepusho', 'Mafunso'],
    'Live': ['Moyo', 'Bukhoma', 'Ubumi', 'Moyo'],
    'Give': ['Pereka', 'Nikela', 'Pela', 'Perekani'],
    'Events': ['Viphikiro', 'Imicimbi', 'Ifilonganino', 'Zochitika'],
    'Gallery': ['Vithuzi', 'Tithombe', 'Ifikope', 'Zithunzi'],
    'Media': ['Vyakuwona', 'Imidiya', 'Imediya', 'Media'],
    'News': ['Nkhani', 'Tindzaba', 'Ifyashi', 'Nkhani'],
    'Testimony': ['Ukwititira', 'Bufakazi', 'Ubunte', 'Umboni'],
    'Testimonies': ['Ukwititira', 'Bufakazi', 'Ubunte', 'Maumboni'],
    'Support': ['Wovwiri', 'Sekela', 'Wafwilisha', 'Thandizo'],
    'About': ['Za ise', 'Ngatsi', 'Palwa ifwe', 'Za ife'],
    'About Us': ['Za ise', 'Ngatsi', 'Palwa ifwe', 'Za ife'],
    'Contact': ['Dumbiranani', 'Xhumana', 'Tumeni', 'Lumikizanani'],
    'Team': ['Gulu', 'Licembu', 'Ikipani', 'Gulu'],
    'Our Team': ['Gulu Lithu', 'Licembu Lethu', 'Ikipani Yesu', 'Gulu Lathu'],
    'Membership': ['Umbali', 'Bulunga', 'Bumembala', 'Umembala'],
    'Translate': ['Sungunula', 'Humusha', 'Alula', 'Tanthauzirani'],
    'Translation': ['Kusungunula', 'Kuhumusha', 'Ukwalula', 'Kumasulira'],
    'Prayer Wall': ['Khotolo la Malombo', 'Ludvonga Lwemkhuleko', 'Cibumba ca Mapempelo', 'Khoma la Pemphero'],
    'Bible Center': ['Malo gha Baibolo', 'Sikhungo seLiBhayibheli', 'Cipinda ca Baibolo', 'Malo a Baibulo'],
    'Sermon Center': ['Malo gha Maupharazgi', 'Sikhungo Setintshumayelo', 'Cipinda ca Milumbe', 'Malo a Ulaliki'],
    'Testimony Center': ['Malo gha Ukwititira', 'Sikhungo Sebufakazi', 'Cipinda ca Bunte', 'Malo a Umboni'],
    'Main menu': ['Menyu yikuru', 'Imenyu lenkhulu', 'Menyu ikalamba', 'Menyu yaikulu'],
    'Open menu': ['Jula menyu', 'Vula imenyu', 'Isula menyu', 'Tsegulani menyu'],
    'Close menu': ['Jala menyu', 'Vala imenyu', 'Isala menyu', 'Tsekani menyu'],
    'Privacy': ['Vyachisisi', 'Imfihlo', 'Ubumfisolo', 'Zachinsinsi'],
    'Dashboard': ['Chikuwa', 'Ibhodi', 'Ibodi', 'Bolodi'],
    'Finance': ['Ndalama', 'Timali', 'Indalama', 'Ndalama'],
    'Devotional': ['Mphambano', 'Kudla Kwamoya', 'Iciwelo', 'Mawu a Tsiku'],
    'Devotionals': ['Mphambano', 'Kudla Kwamoya', 'Ifiwelo', 'Mawu a Tsiku'],
    'Prayer Assistant': ['Wovwiri wa Malombo', 'Umsiti Wemkhuleko', 'Umwafwilisha wa Mapempelo', 'Wothandiza wa Pemphero'],
    'Prayer Requests': ['Malombo', 'Ticelo Temkhuleko', 'Ukupepela', 'Zopempha Pemphero'],
    'Prayer Request': ['Lombo', 'Sicelo Semkhuleko', 'Ipepo', 'Chopempha Pemphero'],
    'Prayer Meeting': ['Ungano wa Malombo', 'Umhlangano Wemkhuleko', 'Ukulongana kwa Kupepela', 'Msonkhano wa Pemphero'],
    'Resource Library': ['Nyumba ya Mabuku', 'Umtapo Wetincwadzi', 'Ing\'anda ya Mabuku', 'Laibulale ya Zothandizira'],
    'Document': ['Chikalata', 'Umbhalo', 'Icipepala', 'Chikalata'],
    'Community Hub': ['Malo gha Wanthu', 'Sikhungo Semmango', 'Cipinda ca Bantu', 'Malo a Anthu'],
    'Event Calendar': ['Kalendala ya Viphikiro', 'Ikhalenda Yemicimbi', 'Kalenda ya Filonganino', 'Kalendala ya Zochitika'],
    'Gospel Media': ['Vyakuwona vya Uthenga', 'Imidiya Yelivangeli', 'Imediya ya Mbila Nsuma', 'Media ya Uthenga'],
    'My Account': ['Akaunti Yane', 'I-akhawunti Yami', 'Akaunti Yandi', 'Akaunti Yanga'],
    'My Events': ['Viphikiro Vyane', 'Imicimbi Yami', 'Ifilonganino Fyandi', 'Zochitika Zanga'],
    'My Certificates': ['Masatifiketi Ghane', 'Tisitifikethi Tami', 'Ifikwabilo Fyandi', 'Satifiketi Zanga'],

    /* ---------------------------------------------------------- actions */
    'Cancel': ['Leka', 'Khansela', 'Leka', 'Lekani'],
    'Close': ['Jala', 'Vala', 'Isala', 'Tsekani'],
    'Refresh': ['Wezgerapo', 'Vuselela', 'Bwesheshapo', 'Tsitsimutsani'],
    'Reload': ['Wezgerapo', 'Layisha kabusha', 'Bwesheshapo', 'Tsitsimutsani'],
    'Reset': ['Wezgera', 'Setha kabusha', 'Bwesha', 'Bwezerani'],
    'Clear': ['Fumyapo', 'Sula', 'Fumyapo', 'Chotsani'],
    'Save': ['Sunga', 'Gcina', 'Sunga', 'Sungani'],
    'Save Changes': ['Sunga Masinthu', 'Gcina Tinguculo', 'Sunga Amasinto', 'Sungani Zosintha'],
    'Save Note': ['Sunga Kalata', 'Gcina Inothi', 'Sunga Icipepala', 'Sungani Zolemba'],
    'Save Name': ['Sunga Zina', 'Gcina Ligama', 'Sunga Ishina', 'Sungani Dzina'],
    'Send': ['Tuma', 'Tfumela', 'Tuma', 'Tumizani'],
    'Share': ['Gaŵana', 'Yabelana', 'Abelana', 'Gawanani'],
    'Copy': ['Kopa', 'Kopisha', 'Kopa', 'Koperani'],
    'COPY': ['KOPA', 'KOPISHA', 'KOPA', 'KOPERANI'],
    'Search': ['Penja', 'Sesha', 'Fwaya', 'Fufuzani'],
    'Read': ['Ŵerengani', 'Fundza', 'Belenga', 'Werengani'],
    'Listen': ['Pulika', 'Lalela', 'Ufwikisha', 'Mverani'],
    'Stop': ['Leka', 'Yima', 'Leka', 'Lekani'],
    'Watch': ['Wonani', 'Bukela', 'Mona', 'Onani'],
    'Watch Live': ['Wonani Pa Lubali', 'Bukela Uphilile', 'Mona pa Live', 'Onani pa Live'],
    'Download': ['Kufumya', 'Landa', 'Leta', 'Tsitsani'],
    'Preview': ['Wonelerapo', 'Bukelela', 'Monenapo', 'Onerani'],
    'Publish': ['Longosora', 'Shicilela', 'Sabankanya', 'Falitsani'],
    'Submit': ['Tumizga', 'Tfumela', 'Tuma', 'Tumizani'],
    'Continue': ['Lutilira', 'Chubeka', 'Twalilila', 'Pitirizani'],
    'Back': ['Kunyuma', 'Emuva', 'Kunuma', 'Kumbuyo'],
    'Return home': ['Welerani kunyumba', 'Buyela ekhaya', 'Bwelela kuŵulu', 'Bwererani kunyumba'],
    'Edit': ['Sintha', 'Hlela', 'Alula', 'Sinthani'],
    'Delete': ['Fumyapo', 'Susa', 'Fumyapo', 'Chotsani'],
    'View All': ['Wonani Vyose', 'Buka Konkhe', 'Mona Fyonse', 'Onani Zonse'],
    'Sign In': ['Njirani', 'Ngena', 'Ingila', 'Lowani'],
    'Logout': ['Fumani', 'Phuma', 'Fuma', 'Tulukani'],
    'Create Account': ['Pangani Akaunti', 'Yenta I-akhawunti', 'Panga Akaunti', 'Pangani Akaunti'],
    'Create Event': ['Pangani Chiphikiro', 'Yenta Umcimbi', 'Panga Icilonganino', 'Pangani Chochitika'],
    'Create Group': ['Pangani Gulu', 'Yenta Licembu', 'Panga Ibumba', 'Pangani Gulu'],
    'Mark all read': ['Ŵerengani vyose', 'Maka konkhe kufundziwe', 'Lemba fyonse nafibelengwa', 'Lembani zonse kuti zawerengedwa'],
    'Upload Image': ['Tumizgani Chithuzi', 'Layisha Sitfombe', 'Tumina Icikope', 'Kwezani Chithunzi'],
    'Upload Photo': ['Tumizgani Chithuzi', 'Layisha Sitfombe', 'Tumina Icikope', 'Kwezani Chithunzi'],
    'Change Photo': ['Sinthani Chithuzi', 'Gucula Sitfombe', 'Alula Icikope', 'Sinthani Chithunzi'],
    'Complete': ['Malizga', 'Cedzisa', 'Pwisha', 'Malizani'],
    'Reply as Admin': ['Zgorani nga ni Admin', 'Phendvula njenge-Admin', 'Asuka nge Admin', 'Yankhani ngati Admin'],

    /* ------------------------------------------------- labels and forms */
    'Language': ['Chiyowoyero', 'Lulwimi', 'Ululimi', 'Chilankhulo'],
    'Name': ['Zina', 'Ligama', 'Ishina', 'Dzina'],
    'Full Name': ['Zina Lose', 'Ligama Leliphelele', 'Ishina Lyonse', 'Dzina Lonse'],
    'Your Name': ['Zina Linu', 'Ligama Lakho', 'Ishina Lyenu', 'Dzina Lanu'],
    'User Name': ['Zina la Ntchito', 'Ligama Lemsebentisi', 'Ishina lya Kabomfeshi', 'Dzina la Wogwiritsa'],
    'Email': ['Imelo', 'I-imeyili', 'Imeli', 'Imelo'],
    'Email Address': ['Adilesi ya Imelo', 'Likheli Le-imeyili', 'Adresi ya Imeli', 'Adilesi ya Imelo'],
    'Email (optional)': ['Imelo (mwakukhumba)', 'I-imeyili (nangabe ufuna)', 'Imeli (nga mulefwaya)', 'Imelo (ngati mukufuna)'],
    'Password': ['Sisiri', 'Liphasiwedi', 'Ishiwi lya nkama', 'Achinsinsi'],
    'Confirm Password': ['Simikizgani Sisiri', 'Cinisekisa Liphasiwedi', 'Shininkisha Ishiwi', 'Tsimikizani Achinsinsi'],
    'Forgot Password?': ['Mwaluwa sisiri?', 'Ukhohliwe liphasiwedi?', 'Mwalaba ishiwi?', 'Mwaiwala achinsinsi?'],
    'Reset Password': ['Sinthani Sisiri', 'Setha Liphasiwedi Kabusha', 'Bwesha Ishiwi', 'Sinthani Achinsinsi'],
    'Phone': ['Foni', 'Lucingo', 'Foni', 'Foni'],
    'Phone Number': ['Nambala ya Foni', 'Inombolo Yelucingo', 'Namba ya Foni', 'Nambala ya Foni'],
    'Date': ['Zuŵa', 'Lusuku', 'Ubushiku', 'Tsiku'],
    'Date & Time': ['Zuŵa na Nyengo', 'Lusuku Nesikhatsi', 'Ubushiku ne Nshita', 'Tsiku ndi Nthawi'],
    'Date of Birth': ['Zuŵa la Kubabika', 'Lusuku Lwekutalwa', 'Ubushiku bwa Kufyalwa', 'Tsiku Lobadwa'],
    'Time': ['Nyengo', 'Sikhatsi', 'Inshita', 'Nthawi'],
    'Duration': ['Utali wa nyengo', 'Bude besikhatsi', 'Ubutali bwa nshita', 'Kutalika kwa nthawi'],
    'Location': ['Malo', 'Indzawo', 'Incende', 'Malo'],
    'Title': ['Mutu', 'Sihloko', 'Umutwe', 'Mutu'],
    'Description': ['Kulongosora', 'Inchazelo', 'Ubulondoloshi', 'Kufotokoza'],
    'Category': ['Gulu', 'Sigaba', 'Ibumba', 'Gulu'],
    'Categories': ['Magulu', 'Tigaba', 'Amabumba', 'Magulu'],
    'Status': ['Umo viliri', 'Simo', 'Imimonekele', 'Mkhalidwe'],
    'Type': ['Mtundu', 'Luhlobo', 'Umusango', 'Mtundu'],
    'Role': ['Ntchito', 'Indzima', 'Umulimo', 'Udindo'],
    'Message': ['Uthenga', 'Umbiko', 'Ubukombe', 'Uthenga'],
    'Subject': ['Mutu', 'Sihloko', 'Umutwe', 'Mutu'],
    'Author': ['Wakulemba', 'Umbhali', 'Kalemba', 'Wolemba'],
    'Speaker': ['Wakuyowoya', 'Sikhulumi', 'Kalanda', 'Wolankhula'],
    'Series': ['Nkhani', 'Luchungechunge', 'Umulongo', 'Mndandanda'],
    'Scripture': ['Lemba', 'UmBhalo', 'Ilembelo', 'Lemba'],
    'Notes': ['Malemba', 'Emanothi', 'Ifipepala', 'Zolemba'],
    'Amount': ['Ndalama', 'Inani', 'Umwingi', 'Ndalama'],
    'Actions': ['Vyakuchita', 'Tento', 'Ifyakucita', 'Zochita'],
    'Action': ['Chakuchita', 'Sento', 'Icakucita', 'Chochita'],
    'Gender': ['Munthurumi/Munthukazi', 'Bulili', 'Ubwaume/Ubwanakashi', 'Mkazi kapena Mwamuna'],
    'Male': ['Munthurumi', 'Umlisa', 'Umwaume', 'Wamwamuna'],
    'Female': ['Munthukazi', 'Umfati', 'Umwanakashi', 'Wamkazi'],
    'Marital Status': ['Umo Wakutorana', 'Simo Semshado', 'Imimonekele ya Cupo', 'Mkhalidwe wa Ukwati'],
    'Single': ['Wandatorane', 'Longakashadi', 'Uushaupile', 'Osakwatira'],
    'Married': ['Wakutorana', 'Loshadile', 'Uwaupile', 'Wokwatira'],
    'Divorced': ['Wakupatukana', 'Lodivosiwe', 'Uwalekene', 'Wosudzulana'],
    'Widowed': ['Wamasiye', 'Umfelokati', 'Umukamfwilwa', 'Wamasiye'],
    'Occupation': ['Ntchito', 'Umsebenti', 'Umulimo', 'Ntchito'],
    'Children': ['Ŵana', 'Bantfwana', 'Abana', 'Ana'],
    'Branch': ['Nthambi', 'Ligatja', 'Isambo', 'Nthambi'],
    'Yes': ['Enya', 'Yebo', 'Ee', 'Inde'],
    'No': ['Yayi', 'Cha', 'Awe', 'Ayi'],
    'All': ['Vyose', 'Konkhe', 'Fyonse', 'Zonse'],
    'Today': ['Muhanya uno', 'Lamuhla', 'Lelo', 'Lero'],
    'Everyone': ['Wanthu wose', 'Wonkhe muntfu', 'Bonse', 'Aliyense'],
    'Nobody': ['Palije', 'Kute muntfu', 'Takuli umo', 'Palibe'],
    'General': ['Vya wose', 'Konkhe', 'Fyonse', 'Zonse'],
    'Loading': ['Kunyamura', 'Kulayisha', 'Ukutumina', 'Kutsegula'],
    'Loading...': ['Kunyamura...', 'Kulayisha...', 'Ukutumina...', 'Kutsegula...'],
    'Active': ['Vikugwira ntchito', 'Kuyasebenta', 'Ilebomba', 'Zikugwira ntchito'],
    'Pending': ['Vikulindilira', 'Kusalindzelwe', 'Ilelolela', 'Zikudikira'],
    'Approved': ['Vyazomerezgeka', 'Kuvunyiwe', 'Fyasuminishiwa', 'Zavomerezedwa'],
    'Rejected': ['Vyakanika', 'Kwaliwe', 'Fyakaniwa', 'Zakanidwa'],
    'Suspended': ['Vyayimikika', 'Kumisiwe', 'Fyaiminina', 'Zaimitsidwa'],
    'Scheduled': ['Vyanozgeka', 'Kuhlelwe', 'Fyapangwa', 'Zakonzedwa'],
    'Idle': ['Vikupumura', 'Kuphumule', 'Ilepumuna', 'Zikupuma'],
    'Comments': ['Mazgu', 'Emavi', 'Amashiwi', 'Ndemanga'],
    'Shares': ['Kugaŵana', 'Kwabelana', 'Ukwabelana', 'Kugawana'],
    'Reactions': ['Vyakuzgora', 'Tento', 'Ifyakwasuka', 'Zoyankha'],
    'Viewers': ['Ŵakuwona', 'Lababukelako', 'Abalemona', 'Owonera'],
    'Live Viewers': ['Ŵakuwona Pa Lubali', 'Babukela Baphilile', 'Abalemona pa Live', 'Owonera pa Live'],
    'watching': ['ŵakuwona', 'bayabukela', 'balemona', 'akuonera'],
    'Live Chat': ['Kudumbiskana Pa Lubali', 'Ingcoco Lephilile', 'Ukulanshana pa Live', 'Kukambirana pa Live'],
    'Live Service': ['Wupembezi Pa Lubali', 'Inkhonzo Lephilile', 'Ukupepa pa Live', 'Mpingo pa Live'],
    'Notifications': ['Vimanyikwiso', 'Taziso', 'Ifyo mukutiishiba', 'Zidziwitso'],
    'Notification Settings': ['Manozgero gha Vimanyikwiso', 'Tilungiselelo Tetaziso', 'Amasetingi ya Filangililo', 'Makonzedwe a Zidziwitso'],
    'Worship': ['Kusopa', 'Kukhonta', 'Ukupepa', 'Kulambira'],
    'Praise': ['Kulumba', 'Kudvumisa', 'Ukutasha', 'Kutamanda'],
    'Praise & Worship': ['Kulumba na Kusopa', 'Kudvumisa Nekukhonta', 'Ukutasha no Kupepa', 'Kutamanda ndi Kulambira'],
    'Bible Study': ['Kusambira Baibolo', 'Kufundza LiBhayibheli', 'Ukusambilila Baibolo', 'Kuphunzira Baibulo'],
    'Sunday Service': ['Wupembezi wa Sabata', 'Inkhonzo YeliSontfo', 'Ukupepa kwa Pa Sunde', 'Mpingo wa Lamlungu'],
    'Amen': ['Ameni', 'Amen', 'Ameni', 'Ameni'],
    'Healing': ['Kuchira', 'Kuphilisa', 'Ukuposha', 'Machiritso'],
    'Provision': ['Vyakupeleka', 'Kuniketwa', 'Ukupekwa', 'Zopereka'],
    'Family': ['Banja', 'Umndeni', 'Ulupwa', 'Banja'],
    'Protection': ['Kuvikilira', 'Kuvikela', 'Ukucingilila', 'Chitetezo'],
    'Thanksgiving': ['Kuwonga', 'Kubonga', 'Ukutootela', 'Kuyamika'],
    'Sickness': ['Nthenda', 'Kugula', 'Ubulwele', 'Matenda'],
    'Deliverance': ['Kuthaskika', 'Kukhululeka', 'Ukupokololwa', 'Chipulumutso'],
    'Miracle': ['Chachizizwa', 'Simangaliso', 'Icipesha amano', 'Chozizwitsa'],
    'Faith in God': ['Chipulikano mwa Chiuta', 'Kukholwa kuNkulunkulu', 'Icitetekelo muli Lesa', 'Chikhulupiriro mwa Mulungu'],
    'Countries': ['Mayiko', 'Emave', 'Ifyalo', 'Mayiko'],
    'Members': ['Ŵabali', 'Emalunga', 'Abalongo', 'Mamembala'],
    'Member': ['Mubali', 'Ilunga', 'Umulongo', 'Membala'],
    'Welcome to Prayer Dome': ['Mwakwaniskika ku Prayer Dome', 'Wemukelekile ku-Prayer Dome', 'Mwaiseni ku Prayer Dome', 'Takulandirani ku Prayer Dome'],
    'Welcome Back': ['Mwaŵerera', 'Wemukelekile Futsi', 'Mwabwelela', 'Takulandiraninso'],
    'A House of Prayer for All Nations': [
      'Nyumba ya Malombo ya Mitundu Yose',
      'Indlu Yemkhuleko Yato Tonkhe Tive',
      'Ing\'anda ya Kupempela ya Mitundu Yonse',
      'Nyumba ya Pemphero ya Mitundu Yonse'
    ],
    'All Rights Reserved': ['Mazaza Ghose Ghapewa', 'Onkhe Amalungelo Agodliwe', 'Insambu Shonse Shasungwa', 'Ufulu Wonse Wosungidwa'],
    'Verse of the day': ['Lemba la zuŵa', 'Livesi lelusuku', 'Lembelo lya lelo', 'Vesi la lero'],
    'Daily Devotional': ['Mphambano ya Zuŵa', 'Kudla Kwalelanga', 'Iciwelo ca Bushiku', 'Mawu a Tsiku'],
    'Featured Scripture': ['Lemba Likulutila', 'UmBhalo Lokhetsekile', 'Ilembelo Lya Patali', 'Lemba Lalikulu'],
    'Announcements': ['Vilapo', 'Tsimemezelo', 'Amalumbwe', 'Zolengeza'],
    'Upcoming Events': ['Viphikiro Vikwiza', 'Imicimbi Letako', 'Ifilonganino Fileisa', 'Zochitika Zikubwera'],
    'Coming Soon': ['Vikwiza sonosono', 'Kuyeta masinyane', 'Fileisa nomba line', 'Zikubwera posachedwa'],
    'Toggle dark mode': ['Sinthani ku mdima', 'Gucula ube mnyama', 'Alula ku mfifi', 'Sinthani ku mdima'],

    /* ---------------------------------------------------- offline shell */
    'You are offline': ['Mulije pa intaneti', 'Awukho ku-inthanethi', 'Tamuli pa intaneti', 'Mulibe intaneti'],
    'Try again': ['Yezgani so', 'Zama futsi', 'Eseni na kabili', 'Yesaninso'],
    'Available offline': ['Vilipo kwambura intaneti', 'Kuyatfolakala ngaphandle kwe-inthanethi', 'Filiko ukwabula intaneti', 'Zilipo popanda intaneti'],
    'Waiting for a connection…': ['Kulindilira intaneti…', 'Kulindzela luchumano…', 'Ukulolela intaneti…', 'Kudikira intaneti…'],

    /* --------------------------------------------------- days and weeks */
    'Sun': ['Sab', 'Son', 'Sun', 'Lam'],
    'Mon': ['Muv', 'Mso', 'Mus', 'Lem'],
    'Tue': ['Chi', 'Lsb', 'Cib', 'Lch'],
    'Wed': ['Cha', 'Lsi', 'Cit', 'Lta'],
    'Thu': ['Chn', 'Lsn', 'Cin', 'Lch'],
    'Fri': ['Chs', 'Lsh', 'Cis', 'Lsh'],
    'Sat': ['Mug', 'Mgc', 'Cib', 'Loi'],

    /* --------------------------------------- ministry roles and teams */
    'Admin': ['Wakulongozga', 'Umphatsi', 'Kateka', 'Woyang\'anira'],
    'Pastor': ['Mliska', 'Umfundisi', 'Shimapepo', 'Mbusa'],
    'Pastors & Leaders': ['Ŵaliska na Ŵalongozgi', 'Bafundisi Netiholi', 'Bashimapepo na Batungulushi', 'Abusa ndi Atsogoleri'],
    'Intercessor': ['Wakulombera', 'Umkhulekeli', 'Kapempela', 'Wopempherera'],
    'Usher': ['Wakupokelera', 'Umamukeli', 'Kapokelela', 'Wolandira'],
    'Outreach': ['Uthenga ku Ŵanthu', 'Kufinyelela', 'Ukufikila Abantu', 'Kufikira Anthu'],
    'Ministries': ['Milimo ya Mpingo', 'Emisebenti Yasebandla', 'Imilimo ya Cilonganino', 'Utumiki'],
    'Worship Team': ['Gulu la Kusopa', 'Licembu Lekukhonta', 'Ibumba lya Kupepa', 'Gulu la Kulambira'],
    'Seeker': ['Wakupenja', 'Umfuni', 'Kafwaya', 'Wofunafuna'],
    'Leader': ['Mulongozgi', 'Umholi', 'Umutungulushi', 'Mtsogoleri'],
    'Disciple': ['Msambiri', 'Umfundzi', 'Umusambi', 'Wophunzira'],
    'Warrior': ['Msilikari', 'Libutfo', 'Umulwi', 'Msilikali'],
    'Children\'s Ministry': ['Ntchito ya Ŵana', 'Umsebenti Webantfwana', 'Umulimo wa Bana', 'Utumiki wa Ana'],

    /* ------------------------------------------- vision, values, pages */
    'Who We Are': ['Ise Ndise Njani', 'Singobani', 'Ifwe Tuli Bani', 'Ife Ndife Ndani'],
    'What We Do': ['Icho Tikuchita', 'Lesikwentako', 'Ico Tucita', 'Zomwe Timachita'],
    'Our Mission': ['Chilato Chithu', 'Umgomo Wetfu', 'Ubuyo Bwesu', 'Cholinga Chathu'],
    'Our Vision': ['Chiwoneko Chithu', 'Umbono Wetfu', 'Icimonwa Cesu', 'Masomphenya Athu'],
    'Our Core Values': ['Vyakuzirwa Vithu', 'Timiselo Tetfu', 'Ifyacindama Fyesu', 'Zofunika Zathu'],
    'Years of Ministry': ['Vyaka vya Uteŵeti', 'Iminyaka Yenkonzo', 'Imyaka ya Mulimo', 'Zaka za Utumiki'],
    'Team Members': ['Ŵabali ŵa Gulu', 'Emalunga Elicembu', 'Abalongo ba Kipani', 'Mamembala a Gulu'],
    'Church Locations': ['Malo gha Mpingo', 'Tindzawo Temabandla', 'Incende sha Cilonganino', 'Malo a Mpingo'],
    'Headquarters': ['Ofesi Yikuru', 'Inhlokohhovisi', 'Ofeshi Ikalamba', 'Likulu'],
    'Faith Journey': ['Ulendo wa Chipulikano', 'Luhambo Lwekukholwa', 'Ubwendo bwa Citetekelo', 'Ulendo wa Chikhulupiriro'],
    'Prayer & Intercession': ['Malombo', 'Umkhuleko', 'Ukupempela', 'Pemphero'],
    'Prayer & Worship': ['Malombo na Kusopa', 'Umkhuleko Nekukhonta', 'Ukupempela no Kupepa', 'Pemphero ndi Kulambira'],
    'Bible Teaching': ['Kusambizga Baibolo', 'Kufundzisa LiBhayibheli', 'Ukusambilisha Baibolo', 'Kuphunzitsa Baibulo'],
    'Bible Study Groups': ['Magulu gha Kusambira Baibolo', 'Emacembu Ekufundza LiBhayibheli', 'Amabumba ya Kusambilila Baibolo', 'Magulu Ophunzira Baibulo'],
    'Community Outreach': ['Kovwira Ŵanthu', 'Kufinyelela Kwemmango', 'Ukwafwa Abantu', 'Kuthandiza Anthu'],
    'Leadership Development': ['Kukuzga Ŵalongozgi', 'Kutfutfukisa Buholi', 'Ukukusha Batungulushi', 'Kukulitsa Atsogoleri'],
    'Corporate Prayer': ['Malombo gha Wose', 'Umkhuleko Wonkhe', 'Ukupempela Bonse', 'Pemphero la Onse'],
    'Morning Devotion': ['Mphambano ya Mulenji', 'Kudla Kwamoya Kwasekuseni', 'Iciwelo ca Lucelo', 'Mawu a M\'mawa'],
    'Sunday Worship Services': ['Wupembezi wa Sabata', 'Tinkhonzo TeliSontfo', 'Ukupepa kwa Pa Sunde', 'Mipingo ya Lamlungu'],
    'Teaching & Discipleship': ['Kusambizga na Usambiri', 'Kufundzisa Nebufundzi', 'Ukusambilisha no Busambi', 'Kuphunzitsa ndi Uphunzitsi'],
    'Youth Service': ['Wupembezi wa Ŵawukirano', 'Inkhonzo Yentsha', 'Ukupepa kwa Bacaice', 'Mpingo wa Achinyamata'],
    'Worship Night': ['Usiku wa Kusopa', 'Busuku Bekukhonta', 'Ubushiku bwa Kupepa', 'Usiku wa Kulambira'],
    'Daily Night Service': ['Wupembezi wa Usiku', 'Inkhonzo Yebusuku', 'Ukupepa kwa Bushiku', 'Mpingo wa Usiku'],
    'Special Event': ['Chiphikiro Chapadera', 'Umcimbi Lokhetsekile', 'Icilonganino Icapaalwa', 'Chochitika Chapadera'],
    'Conference': ['Ungano Ukuru', 'Ingcungcuthela', 'Ukulongana Ukukalamba', 'Msonkhano Waukulu'],
    'Welfare Support': ['Wovwiri wa Umoyo', 'Lusito Lwenhlalakahle', 'Ukwafwa kwa Bumi', 'Thandizo la Moyo'],
    'Christian News': ['Nkhani za Chikhristu', 'Tindzaba TemaKhristu', 'Ifyashi fya Bwina Kristu', 'Nkhani za Chikhristu'],
    'Christian News Center': ['Malo gha Nkhani za Chikhristu', 'Sikhungo Setindzaba TemaKhristu', 'Cipinda ca Fyashi fya Bwina Kristu', 'Malo a Nkhani za Chikhristu'],
    'Share Your Story': ['Gaŵanani Nkhani Yinu', 'Yabelana Ngendzaba Yakho', 'Abelaneni Ilyashi Lyenu', 'Gawanani Nkhani Yanu'],
    'Share Testimony': ['Gaŵanani Ukwititira', 'Yabelana Ngebufakazi', 'Abelaneni Ubunte', 'Gawanani Umboni'],
    'Spiritual History': ['Mdauko wa Mzimu', 'Umlandvo Wemoya', 'Ubulondoloshi bwa Mupashi', 'Mbiri ya Uzimu'],
    'Spiritual Growth': ['Kukura mu Mzimu', 'Kukhula Kwamoya', 'Ukukula kwa Mupashi', 'Kukula Mwauzimu'],
    'Personal Details': ['Vinthu Vyakwinu', 'Imininingwane Yakho', 'Ifyenu Fine', 'Zambiri Zanu'],
    'Ministry Choice': ['Uteŵeti Wakusankha', 'Inkhetho Yenkonzo', 'Umulimo Uwasalwa', 'Utumiki Wosankha'],
    'Ministry Interest': ['Uteŵeti Ukukhumbika', 'Intalakhelo Yenkonzo', 'Umulimo Uwafwaya', 'Utumiki Wofuna'],
    'Ministry Involvement': ['Kunjira mu Uteŵeti', 'Kubandzakanya Enkonzweni', 'Ukubomba mu Mulimo', 'Kutenga Nawo mu Utumiki'],
    'Born Again?': ['Mwababika so?', 'Utalwe kabusha?', 'Mwafyalwa cipya?', 'Mwabadwanso?'],
    'Water Baptised?': ['Mwabapatizika mu maji?', 'Ubhabhathiziwe ngemanti?', 'Mwabatishiwa mu menshi?', 'Mwabatizidwa m\'madzi?'],
    'Speak in Tongues?': ['Mukuyowoya malulimi?', 'Ukhuluma ngetilwimi?', 'Mulalanda indimi?', 'Mumalankhula malilime?'],
    'Preaching': ['Kupharazga', 'Kushumayela', 'Ukushimikila', 'Kulalikira'],
    'Compassionate': ['Chitima', 'Sihawu', 'Uluse', 'Chifundo'],
    'Instruments': ['Vyakwimbira', 'Emathulusi Emculo', 'Ifya kulisha', 'Zoimbira'],
    'Attach a Photo (Optional)': ['Sazgirapo Chithuzi (mwakukhumba)', 'Namatsisela Sitfombe (nangabe ufuna)', 'Lundikapo Icikope (nga mulefwaya)', 'Onjezani Chithunzi (ngati mukufuna)'],
    'Healing & Health': ['Kuchira na Umoyo', 'Kuphilisa Nemphilo', 'Ukuposha no Bumi', 'Machiritso ndi Thanzi'],
    'Protection & Safety': ['Kuvikilira na Chimango', 'Kuvikela Nekuphepha', 'Ukucingilila no Mutelelwe', 'Chitetezo ndi Chisungiko'],
    'Family & Relationships': ['Banja na Ubali', 'Umndeni Nebudlelwane', 'Ulupwa no Bucibusa', 'Banja ndi Maubwenzi'],
    'Thanksgiving / Praise': ['Kuwonga / Kulumba', 'Kubonga / Kudvumisa', 'Ukutootela / Ukutasha', 'Kuyamika / Kutamanda'],
    'Total Views': ['Ŵakuwona Wose', 'Kubukelwa Konkhe', 'Abamona Bonse', 'Owonera Onse'],
    'total views': ['ŵakuwona wose', 'kubukelwa konkhe', 'abamona bonse', 'owonera onse'],
    'Total Income': ['Ndalama Zose', 'Timali Tonkhe', 'Indalama Shonse', 'Ndalama Zonse'],
    'Total Attendees': ['Ŵakwiza Wose', 'Labekhona Bonkhe', 'Abaishile Bonse', 'Opezeka Onse'],
    'New Followers': ['Ŵakulondezga Ŵaphya', 'Balandzeli Labasha', 'Abakonka Abapya', 'Otsatira Atsopano'],
    'Peak Viewers': ['Ŵakuwona Ŵanandi', 'Lababukele Kakhulu', 'Abamona Abengi', 'Owonera Ambiri'],
    'This Month': ['Mwezi Uno', 'Lenyanga', 'Uyu Mweshi', 'Mwezi Uno'],
    'Today\'s Events': ['Viphikiro vya Muhanya Uno', 'Imicimbi Yalamuhla', 'Ifilonganino fya Lelo', 'Zochitika za Lero'],
    'Add New Event': ['Sazgirapo Chiphikiro', 'Ngeta Umcimbi Lomusha', 'Lundapo Icilonganino', 'Onjezani Chochitika'],
    'Add notes': ['Sazgirapo malemba', 'Ngeta emanothi', 'Lundapo ifipepala', 'Onjezani zolemba'],
    'Submit Report': ['Tumizgani Lipoti', 'Tfumela Umbiko', 'Tumeni Lipoti', 'Tumizani Lipoti'],
    'Blocked Users': ['Ŵakujalikika', 'Basebentisi Labavimbelekile', 'Abasangwa Abakaanwa', 'Ogwiritsa Otsekedwa'],
    'Voice Message': ['Uthenga wa Mazgu', 'Umbiko Welivi', 'Ubukombe bwa Ishiwi', 'Uthenga wa Mawu'],
    'Attach': ['Sazgirapo', 'Namatsisela', 'Lundikapo', 'Onjezani'],
    'Share Contact': ['Gaŵanani Nambala', 'Yabelana Ngeluchumano', 'Abelaneni Adresi', 'Gawanani Nambala'],
    'Past Lives': ['Vyakale vya Pa Lubali', 'Lokuphilile Kwangaphambili', 'Ifya Live Fyakale', 'Za Live Zakale'],
    'Upcoming Lives': ['Vya Pa Lubali Vikwiza', 'Lokuphilile Lotako', 'Ifya Live Fileisa', 'Za Live Zikubwera'],
    'Live service': ['Wupembezi pa lubali', 'Inkhonzo lephilile', 'Ukupepa pa live', 'Mpingo pa live'],
    'Now Ministering': ['Sono Wakuteŵetera', 'Nyalo Uyakhonza', 'Nomba Alebomba', 'Tsopano Akutumikira'],
    'Full Bible reader': ['Baibolo Lose', 'Umfundzi WeliBhayibheli Lonkhe', 'Kabelenga wa Baibolo Lyonse', 'Woŵerenga Baibulo Lonse'],
    'Get support': ['Sangani wovwiri', 'Tfola lusito', 'Fwayeni ukwafwa', 'Pezani thandizo'],
    'This page could not be found': [
      'Peji ili likusangika yayi',
      'Leli likhasi alitfolakali',
      'Ili peji talyasangwa',
      'Tsamba ili silinapezeke'
    ],
    'Powered by': ['Vikwendeskeka na', 'Kucutjwa ngu', 'Ciletungululwa na', 'Zoyendetsedwa ndi'],
    'Number of Dependants': ['Unandi wa Ŵakupwelelera', 'Linani Lebantfu Lobondliwe', 'Ubwingi bwa Bakusakamana', 'Chiwerengero cha Odalira'],
    'Current Branch': ['Nthambi Yinu', 'Ligatja Lakho', 'Isambo Lyenu', 'Nthambi Yanu'],
    'Your Branch': ['Nthambi Yinu', 'Ligatja Lakho', 'Isambo Lyenu', 'Nthambi Yanu'],
    'Status & Occupation': ['Umo Viliri na Ntchito', 'Simo Nemsebenti', 'Imimonekele no Mulimo', 'Mkhalidwe ndi Ntchito'],
    'Edit Profile': ['Sinthani Profayilo', 'Hlela Iphrofayela', 'Alula Profailo', 'Sinthani Mbiri'],
    'Delete Account': ['Fumyani Akaunti', 'Susa I-akhawunti', 'Fumyeni Akaunti', 'Chotsani Akaunti'],
    'Verify Email': ['Simikizgani Imelo', 'Cinisekisa I-imeyili', 'Shininkisheni Imeli', 'Tsimikizani Imelo'],
    'Resend Email': ['Tumaniso Imelo', 'Tfumela Futsi I-imeyili', 'Tumeni na kabili Imeli', 'Tumizaninso Imelo'],
    'Not specified': ['Vindalongosoreka', 'Akushiwo', 'Tafyalondololwa', 'Sizinatchulidwe'],
    'Not Assigned': ['Vindapelekeke', 'Akunikwanga', 'Tafyapelwa', 'Sizinaperekedwe'],
    'Score': ['Maki', 'Emamaki', 'Amamaki', 'Maki'],
    'Course': ['Sambiro', 'Sifundvo', 'Isambililo', 'Phunziro'],
    'Headline': ['Mutu wa Nkhani', 'Sihloko Sendzaba', 'Umutwe wa Lyashi', 'Mutu wa Nkhani'],
    'Schedule': ['Nozgani', 'Hlela', 'Pangeni', 'Konzani'],
    'Notices': ['Vimanyisko', 'Tatiso', 'Amalumbwe', 'Zidziwitso'],
    'Publish Date': ['Zuŵa la Kulongosora', 'Lusuku Lwekushicilela', 'Ubushiku bwa Kusabankanya', 'Tsiku Lofalitsa'],
    'Approved By': ['Wakuzomerezga', 'Kuvunywe Ngu', 'Uwasuminishe', 'Wovomereza'],
    'Publish News': ['Longosorani Nkhani', 'Shicilela Tindzaba', 'Sabankanyeni Ifyashi', 'Falitsani Nkhani'],
    'Contact Messages': ['Mauthenga', 'Imibiko Yekuchumana', 'Ubukombe bwa Kutumina', 'Mauthenga'],
    'Church & Locations': ['Mpingo na Malo', 'Libandla Netindzawo', 'Icilonganino ne Ncende', 'Mpingo ndi Malo'],
    'Gospel Radio & Podcasts': ['Wailesi ya Uthenga', 'Umsakato Welivangeli', 'Wailesi ya Mbila Nsuma', 'Wailesi ya Uthenga'],
    'Worship & Music Library': ['Nyumba ya Sumu', 'Umtapo Wemculo', 'Ing\'anda ya Nyimbo', 'Laibulale ya Nyimbo'],
    'Upload Song': ['Tumizgani Sumu', 'Layisha Ingoma', 'Tumineni Ulwimbo', 'Kwezani Nyimbo']
  };

  var LANGS = ['tum', 'ssw', 'bem', 'nya'];

  /* Expand the compact rows into the per-language tables pd-i18n.js expects. */
  var PD_PHRASES = { en: {} };
  LANGS.forEach(function (code) { PD_PHRASES[code] = {}; });

  Object.keys(ROWS).forEach(function (english) {
    PD_PHRASES.en[english] = english;
    var row = ROWS[english];
    LANGS.forEach(function (code, i) {
      var value = row[i];
      if (value) PD_PHRASES[code][english] = value;
    });
  });

  global.PD_PHRASES = PD_PHRASES;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PD_PHRASES: PD_PHRASES, PD_PHRASE_ROWS: ROWS };
  }
})(typeof window !== 'undefined' ? window : globalThis);
